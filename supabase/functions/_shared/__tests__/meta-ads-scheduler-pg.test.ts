// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { expect,it } from 'vitest';

it('keeps the scheduler credential in Vault and dispatches only when reception is enabled',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE SCHEMA private;CREATE SCHEMA vault;CREATE SCHEMA net;
      CREATE TABLE public.integration_settings(slug text,settings jsonb);
      INSERT INTO public.integration_settings VALUES('facebook_ads_manager','{"enabled":false}');
      CREATE TABLE vault.secrets(id uuid DEFAULT gen_random_uuid(),secret text,name text,description text);
      CREATE VIEW vault.decrypted_secrets AS SELECT name,secret AS decrypted_secret FROM vault.secrets;
      CREATE FUNCTION vault.create_secret(text,text,text) RETURNS uuid LANGUAGE sql AS $$INSERT INTO vault.secrets(secret,name,description)VALUES($1,$2,$3)RETURNING id$$;
      CREATE TABLE net.test_requests(id bigint GENERATED ALWAYS AS IDENTITY,url text,headers jsonb,body jsonb);
      CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)RETURNS bigint LANGUAGE sql AS $$
        INSERT INTO net.test_requests(url,headers,body)VALUES($1,$2,$3)RETURNING id$$;`);
    await db.exec(readFileSync(resolve('supabase/migrations/20261024023443_meta_ads_worker_schedule.sql'),'utf8'));
    const secret=(await db.query<{secret:string}>('SELECT secret FROM vault.secrets')).rows[0].secret;
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    expect((await db.query<{id:number|null}>('SELECT private.invoke_meta_ads_worker() AS id')).rows[0].id).toBeNull();
    await db.exec(`UPDATE integration_settings SET settings='{"enabled":true}'`);
    await db.query('SELECT private.invoke_meta_ads_worker()');
    const request=(await db.query<{url:string;headers:Record<string,string>}>('SELECT url,headers FROM net.test_requests')).rows[0];
    expect(request.url).toBe('https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/meta-ads-worker');
    expect(request.headers['x-meta-worker-secret']).toBe(secret);
    expect(request.headers.Authorization).toBeUndefined();
    await db.exec('SET ROLE anon');
    await expect(db.query('SELECT private.invoke_meta_ads_worker()')).rejects.toThrow('permission denied');
    await db.exec('RESET ROLE');
  }finally{await db.close();}
},20000);
