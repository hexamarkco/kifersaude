// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
const original = readMigration('20260912040243_add_chatgpt_mcp_oauth_tokens.sql');
const migration = readMigration('20261022190618_mcp_oauth_atomic_token_exchange.sql');
const userId = '11111111-1111-4111-8111-111111111111';
const resource = 'https://project.supabase.co/functions/v1/chatgpt-mcp';
const hash = (letter: string) => letter.repeat(43);
const originalScope = 'kifer.read kifer.write';
let db: PGlite;
const exchange = async (grant = 'authorization_code', credential = hash('c'), access = hash('a'), refresh = hash('r'), overrides: { client?: string; resource?: string; redirect?: string; challenge?: string } = {}) =>
  (await db.query<{ result: Record<string, unknown> }>('SELECT public.mcp_exchange_oauth_tokens($1,$2,$3,$4,$5,$6,$7,$8) AS result', [grant, credential, overrides.client ?? 'chatgpt-kifer', overrides.resource ?? resource, overrides.redirect ?? 'https://client.test/callback', overrides.challenge ?? hash('v'), access, refresh])).rows[0].result;
const seedRefresh = () => db.query('INSERT INTO public.chatgpt_mcp_oauth_refresh_tokens(token_hash,user_id,client_id,scope,resource,expires_at) VALUES ($1,$2,$3,$4,$5,now()+interval \'1 day\')', [hash('f'), userId, 'chatgpt-kifer', originalScope, resource]);

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY,role text,email text);
    INSERT INTO auth.users VALUES ('${userId}');
    INSERT INTO public.user_profiles VALUES ('${userId}','admin','synthetic@kifer.test');`);
  await db.exec(original);
  await db.exec(`ALTER TABLE public.chatgpt_mcp_oauth_authorization_codes ADD COLUMN resource text;
    ALTER TABLE public.chatgpt_mcp_oauth_access_tokens ADD COLUMN resource text;
    ALTER TABLE public.chatgpt_mcp_oauth_refresh_tokens ADD COLUMN resource text;`);
  await db.exec(migration);
  await db.query('INSERT INTO public.chatgpt_mcp_oauth_authorization_codes(code_hash,user_id,client_id,redirect_uri,code_challenge,scope,resource,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval \'5 minutes\')', [hash('c'), userId, 'chatgpt-kifer', 'https://client.test/callback', hash('v'), originalScope, resource]);
});
afterEach(async () => { await db.close(); });

describe('atomic OAuth renewal', () => {
  it('issues access and refresh for a previously approved code without offline_access, preserving its exact scopes', async () => {
    expect(await exchange()).toEqual({ success: true, scope: originalScope, expires_in: 3600 });
    const access = (await db.query('SELECT token_hash,scope,resource,extract(epoch from expires_at-created_at)::integer AS lifetime FROM public.chatgpt_mcp_oauth_access_tokens')).rows;
    const refresh = (await db.query('SELECT token_hash,scope,extract(epoch from expires_at-created_at)::integer AS lifetime FROM public.chatgpt_mcp_oauth_refresh_tokens')).rows;
    expect(access).toEqual([{ token_hash: hash('a'), scope: originalScope, resource, lifetime: 3600 }]);
    expect(refresh).toEqual([{ token_hash: hash('r'), scope: originalScope, lifetime: 30 * 86400 }]);
    expect(await exchange('authorization_code', hash('c'), hash('b'), hash('s'))).toEqual({ success: false });
  });

  it('renews after the access token has expired and rotates the renewal token for successive uses', async () => {
    await exchange();
    await db.exec("UPDATE public.chatgpt_mcp_oauth_access_tokens SET expires_at=now()-interval '1 minute'");
    expect(await exchange('refresh_token', hash('r'), hash('b'), hash('s'))).toEqual({ success: true, scope: originalScope, expires_in: 3600 });
    expect(await exchange('refresh_token', hash('r'), hash('d'), hash('t'))).toEqual({ success: false });
    expect(await exchange('refresh_token', hash('s'), hash('d'), hash('t'))).toMatchObject({ success: true });
    expect((await db.query("SELECT count(*)::integer AS count FROM public.chatgpt_mcp_oauth_refresh_tokens WHERE revoked_at IS NULL AND expires_at>now()")).rows[0]).toEqual({ count: 1 });
  });

  it('does not consume authorization when verifier, redirect, client or resource is wrong', async () => {
    for (const overrides of [{ challenge: hash('x') }, { redirect: 'https://other.test' }, { client: 'other-client' }, { resource: 'https://other.test' }]) {
      expect(await exchange('authorization_code', hash('c'), hash('a'), hash('r'), overrides)).toEqual({ success: false });
    }
    expect(await exchange()).toMatchObject({ success: true });
  });

  it('rejects a wrong refresh resource/client without revoking the legitimate credential', async () => {
    await seedRefresh();
    expect(await exchange('refresh_token', hash('f'), hash('a'), hash('r'), { resource: 'https://other.test' })).toEqual({ success: false });
    expect(await exchange('refresh_token', hash('f'), hash('a'), hash('r'), { client: 'other-client' })).toEqual({ success: false });
    expect(await exchange('refresh_token', hash('f'))).toMatchObject({ success: true });
  });

  it('rolls back both inserts and keeps a refresh credential usable after a persistence failure', async () => {
    await seedRefresh();
    await db.exec("ALTER TABLE public.chatgpt_mcp_oauth_refresh_tokens ADD CONSTRAINT synthetic_failure CHECK (token_hash <> repeat('r',43))");
    await expect(exchange('refresh_token', hash('f'))).rejects.toThrow();
    expect((await db.query('SELECT token_hash FROM public.chatgpt_mcp_oauth_access_tokens')).rows).toHaveLength(0);
    expect((await db.query('SELECT revoked_at FROM public.chatgpt_mcp_oauth_refresh_tokens')).rows[0]).toEqual({ revoked_at: null });
    expect(await exchange('refresh_token', hash('f'), hash('b'), hash('s'))).toMatchObject({ success: true });
  });

  it('keeps an authorization code usable when replacement persistence fails', async () => {
    await db.exec("ALTER TABLE public.chatgpt_mcp_oauth_refresh_tokens ADD CONSTRAINT synthetic_failure CHECK (token_hash <> repeat('r',43))");
    await expect(exchange()).rejects.toThrow();
    expect((await db.query('SELECT code_hash FROM public.chatgpt_mcp_oauth_authorization_codes')).rows).toHaveLength(1);
    expect((await db.query('SELECT token_hash FROM public.chatgpt_mcp_oauth_access_tokens')).rows).toHaveLength(0);
    expect(await exchange('authorization_code', hash('c'), hash('b'), hash('s'))).toMatchObject({ success: true });
  });

  it('rejects expired or revoked grants and revalidates the administrator before renewing', async () => {
    await seedRefresh();
    await db.exec("UPDATE public.chatgpt_mcp_oauth_authorization_codes SET expires_at=now()-interval '1 minute'");
    expect(await exchange()).toEqual({ success: false });
    await db.exec("UPDATE public.chatgpt_mcp_oauth_refresh_tokens SET expires_at=now()-interval '1 minute'");
    expect(await exchange('refresh_token', hash('f'))).toEqual({ success: false });
    await db.exec("UPDATE public.chatgpt_mcp_oauth_refresh_tokens SET expires_at=now()+interval '1 day',revoked_at=now()");
    expect(await exchange('refresh_token', hash('f'))).toEqual({ success: false });
    await db.exec("UPDATE public.chatgpt_mcp_oauth_refresh_tokens SET revoked_at=NULL; UPDATE public.user_profiles SET role='user'");
    expect(await exchange('refresh_token', hash('f'))).toEqual({ success: false });
    expect((await db.query('SELECT token_hash FROM public.chatgpt_mcp_oauth_access_tokens')).rows).toHaveLength(0);
  });

  it('renews a legacy read-only grant without upgrading data permissions', async () => {
    await db.exec("UPDATE public.chatgpt_mcp_oauth_authorization_codes SET resource=NULL,scope='kifer.read'");
    expect(await exchange()).toEqual({ success: true, scope: 'kifer.read', expires_in: 3600 });
    expect(await exchange('refresh_token', hash('r'), hash('b'), hash('s'))).toEqual({ success: true, scope: 'kifer.read', expires_in: 3600 });
  });

  it('limits database execution to the service role and does not use SECURITY DEFINER', async () => {
    const row = (await db.query("SELECT has_function_privilege('anon',oid,'execute') AS anon,has_function_privilege('authenticated',oid,'execute') AS authenticated,has_function_privilege('service_role',oid,'execute') AS service,prosecdef FROM pg_proc WHERE proname='mcp_exchange_oauth_tokens'")).rows[0];
    expect(row).toEqual({ anon: false, authenticated: false, service: true, prosecdef: false });
  });
});
