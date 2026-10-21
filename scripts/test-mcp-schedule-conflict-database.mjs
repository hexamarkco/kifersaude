import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Blob } from 'node:buffer';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('MCP schedule migration rejects stale versions without retryable SQLSTATE and preserves authorization', async () => {
  const require = createRequire(import.meta.url);
  const assets = new URL('./', pathToFileURL(require.resolve('@electric-sql/pglite')));
  const db = new PGlite({
    pgliteWasmModule: await WebAssembly.compile(await readFile(new URL('pglite.wasm', assets))),
    initdbWasmModule: await WebAssembly.compile(await readFile(new URL('initdb.wasm', assets))),
    fsBundle: new Blob([await readFile(new URL('pglite.data', assets))]),
  });
  const actorId = '11111111-1111-4111-8111-111111111111';
  const sequenceId = '22222222-2222-4222-8222-222222222222';
  const version = '2026-10-19T12:00:00.123456Z';
  const call = (actor, sequence, expected) => db.query(`
    SELECT public.update_scheduled_message_sequence_for_mcp(
      $1::uuid, $2::uuid, $3::timestamptz, '2026-10-20T12:00:00Z', '[]'::jsonb, 'Retorno', true
    ) AS result`, [actor, sequence, expected]);
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.user_profiles(id uuid PRIMARY KEY, role text, email text);
      CREATE TABLE public.comm_whatsapp_scheduled_sequences(id uuid PRIMARY KEY, updated_at timestamptz);
      CREATE TABLE public.delegated_calls(actor text, label text, cancel_on_inbound boolean);
      CREATE FUNCTION public.update_scheduled_message_sequence(uuid, timestamptz, jsonb, text, boolean)
      RETURNS boolean LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO public.delegated_calls VALUES (current_setting('request.jwt.claim.sub', true), $4, $5);
        RETURN true;
      END;
      $$;
    `);
    await db.query('INSERT INTO public.user_profiles VALUES ($1, $2, $3)', [actorId, 'admin', 'admin@kifer.test']);
    await db.query('INSERT INTO public.comm_whatsapp_scheduled_sequences VALUES ($1, $2)', [sequenceId, version]);
    // Execute the actual new production migration, never a copy of its implementation.
    await db.exec(await readFile(new URL('../supabase/migrations/20261019162944_fix_mcp_schedule_conflict_retry.sql', import.meta.url), 'utf8'));
    for (const staleVersion of [null, '2026-10-19T12:00:00.123Z']) {
      await assert.rejects(call(actorId, sequenceId, staleVersion), { code: 'PT409', message: 'SCHEDULE_VERSION_CONFLICT' });
    }
    await assert.rejects(call(sequenceId, sequenceId, version), { code: '42501', message: 'MCP_ADMIN_REQUIRED' });
    await assert.rejects(call(actorId, actorId, version), { code: 'P0002', message: 'SCHEDULE_NOT_FOUND' });
    assert.deepEqual((await db.query('SELECT * FROM public.delegated_calls')).rows, []);
    await db.query("SELECT set_config('request.jwt.claim.sub', 'original', false)");
    assert.deepEqual((await call(actorId, sequenceId, version)).rows, [{ result: true }]);
    assert.deepEqual((await db.query('SELECT * FROM public.delegated_calls')).rows, [{ actor: actorId, label: 'Retorno', cancel_on_inbound: true }]);
    assert.equal((await db.query("SELECT current_setting('request.jwt.claim.sub') AS actor")).rows[0].actor, 'original');
    const permissions = await db.query(`SELECT
      has_function_privilege('anon', 'public.update_scheduled_message_sequence_for_mcp(uuid,uuid,timestamptz,timestamptz,jsonb,text,boolean)', 'EXECUTE') AS anon,
      has_function_privilege('authenticated', 'public.update_scheduled_message_sequence_for_mcp(uuid,uuid,timestamptz,timestamptz,jsonb,text,boolean)', 'EXECUTE') AS authenticated,
      has_function_privilege('service_role', 'public.update_scheduled_message_sequence_for_mcp(uuid,uuid,timestamptz,timestamptz,jsonb,text,boolean)', 'EXECUTE') AS service_role`);
    assert.deepEqual(permissions.rows, [{ anon: false, authenticated: false, service_role: true }]);
  } finally {
    await db.close();
  }
});
