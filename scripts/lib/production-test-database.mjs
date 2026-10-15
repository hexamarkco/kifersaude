import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { Blob } from 'node:buffer';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Minimal pre-existing schema; the production migration itself is executed unchanged.
export async function createProductionTestDatabase() {
  const require = createRequire(import.meta.url);
  const assets = new URL('./', pathToFileURL(require.resolve('@electric-sql/pglite')));
  const db = new PGlite({
    pgliteWasmModule: await WebAssembly.compile(await readFile(new URL('pglite.wasm',assets))),
    initdbWasmModule: await WebAssembly.compile(await readFile(new URL('initdb.wasm',assets))),
    fsBundle: new Blob([await readFile(new URL('pglite.data',assets))]),
  });
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
  `);
  await db.exec(`
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY,username text,role text);
    CREATE FUNCTION public.current_user_can_view_any_module(text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin') $$;
    CREATE TABLE public.lead_responsaveis(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),label text,value text,ativo boolean,ordem integer);
    CREATE TABLE public.lead_status_config(id uuid PRIMARY KEY,nome text,ordem integer);
    CREATE TABLE public.leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status_id uuid,status text);
    CREATE TABLE public.contracts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid,status text);
    CREATE TABLE public.interactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid);
    CREATE TABLE public.reminders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid,concluido_em timestamptz,cancelled_at timestamptz,lido boolean DEFAULT false);
    CREATE TABLE public.comm_whatsapp_chats(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid);
    CREATE TABLE public.comm_whatsapp_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_id uuid,chat_id uuid,direction text,source text,delivery_status text,external_message_id text,created_by uuid);
    CREATE TABLE public.comm_whatsapp_scheduled_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid,sequence_id uuid,status text,created_by uuid);
    CREATE TABLE public.comm_whatsapp_scheduled_sequences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid,status text,created_by uuid);
    GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
    GRANT SELECT ON public.user_profiles TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    INSERT INTO public.user_profiles VALUES ('11111111-1111-4111-8111-111111111111','luiza.kifer','admin'),('22222222-2222-4222-8222-222222222222','nick','admin'),('33333333-3333-4333-8333-333333333333','qa-teste','admin');
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261014203527_team_production_attribution.sql',import.meta.url),'utf8'));
  return db;
}
