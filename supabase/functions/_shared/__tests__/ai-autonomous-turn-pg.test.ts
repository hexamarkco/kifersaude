// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const chat = '00000000-0000-0000-0000-000000000001';
const lead = '00000000-0000-0000-0000-000000000002';
const job = '00000000-0000-0000-0000-000000000003';
const inbound = '00000000-0000-0000-0000-000000000004';
const newer = '00000000-0000-0000-0000-000000000005';
const otherJob = '00000000-0000-0000-0000-000000000006';
const key = `autonomous:${chat}:${inbound}:0`;
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE comm_whatsapp_chats(id uuid primary key, lead_id uuid, deleted_at timestamptz, autonomous_attendance_status text);
    CREATE TABLE comm_whatsapp_messages(id uuid primary key, chat_id uuid, direction text, message_type text,
      text_content text, media_caption text, transcription_text text, delivery_status text default 'received',
      created_at timestamptz default now(), created_by uuid);
    CREATE TABLE ai_autonomous_reply_jobs(id uuid primary key, chat_id uuid, lead_id uuid, status text,
      updated_at timestamptz default now(), last_error text);
    CREATE UNIQUE INDEX one_pending ON ai_autonomous_reply_jobs(chat_id) WHERE status='pending';
    CREATE TABLE ai_autonomous_reply_locks(chat_id uuid primary key, owner_id text, lease_until timestamptz);
    CREATE TABLE ai_autonomous_reply_delivery_keys(idempotency_key text primary key, chat_id uuid, job_id uuid,
      message_index integer, status text default 'reserved');
    CREATE TABLE ai_autonomous_qualification_states(chat_id uuid primary key, lead_id uuid, state jsonb, version bigint);
    CREATE FUNCTION public.upsert_ai_autonomous_qualification_state(p_chat_id uuid, p_lead_id uuid, p_state jsonb)
    RETURNS void LANGUAGE sql SET search_path = public AS $$
      INSERT INTO public.ai_autonomous_qualification_states VALUES(p_chat_id, p_lead_id, p_state, 1)
      ON CONFLICT(chat_id) DO UPDATE SET state=excluded.state, version=ai_autonomous_qualification_states.version+1;
    $$;
  `);
  await db.exec(readFileSync(resolve('supabase/migrations/20261029195235_harden_autonomous_turn_delivery.sql'), 'utf8'));
}, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE comm_whatsapp_chats, comm_whatsapp_messages, ai_autonomous_reply_jobs,
    ai_autonomous_reply_locks, ai_autonomous_reply_delivery_keys, ai_autonomous_qualification_states;
    INSERT INTO comm_whatsapp_chats VALUES('${chat}','${lead}',null,'active');
    INSERT INTO ai_autonomous_reply_jobs(id,chat_id,lead_id,status) VALUES('${job}','${chat}','${lead}','processing'), ('${otherJob}','${chat}','${lead}','processing');
    INSERT INTO ai_autonomous_reply_locks VALUES('${chat}','${job}', now()+interval '2 minutes');
    INSERT INTO comm_whatsapp_messages(id,chat_id,direction,message_type,text_content,created_at)
      VALUES('${inbound}','${chat}','inbound','text','Tenho plano',now()-interval '1 minute');`);
});
const claim = async (owner = job, deliveryKey = key, index = 0) => (
  await db.query<{ ok: boolean }>('select public.claim_ai_autonomous_reply_delivery_key($1,$2,$3,$4) ok', [deliveryKey, chat, owner, index])
).rows[0].ok;
const canSend = async () => (
  await db.query<{ ok: boolean }>('select public.can_send_ai_autonomous_reply($1,$2,$3,$4) ok', [chat, job, inbound, key])
).rows[0].ok;

test('T10 one logical reservation survives immediate + cron, redelivery and lease takeover after a crash', async () => {
  expect(await Promise.all([claim(), claim(), claim(otherJob)])).toEqual([true, false, false]);
  expect(await canSend()).toBe(true);
  await db.query('update ai_autonomous_reply_locks set owner_id=$1', [otherJob]);
  expect(await claim(otherJob)).toBe(false);
  expect(await claim(otherJob, `autonomous:${chat}:${inbound}:1`, 1)).toBe(false);
  expect(await canSend()).toBe(false);
});

test('T03 a persisted inbound during generation prevents reservation and a newer job can answer it', async () => {
  await db.exec(`INSERT INTO comm_whatsapp_messages(id,chat_id,direction,message_type,text_content)
    VALUES('${newer}','${chat}','inbound','text','Tenho Med Sênior');`);
  expect(await claim()).toBe(false);
  expect(await claim(job, `autonomous:${chat}:${newer}:0`)).toBe(true);
});

test('T03 inbound after reservation but before the HTTP request fails the final gate', async () => {
  expect(await claim()).toBe(true);
  await db.exec(`INSERT INTO comm_whatsapp_messages(id,chat_id,direction,message_type,text_content)
    VALUES('${newer}','${chat}','inbound','text','MedSênior');`);
  expect(await canSend()).toBe(false);
});

test.each(['cancelled', 'completed', 'failed'])('T12 terminal job %s cannot deliver', async (status) => {
  await db.query('update ai_autonomous_reply_jobs set status=$1 where id=$2', [status, job]);
  expect(await claim()).toBe(false);
});
test.each(['handed_off', 'inactive'])('T12 chat %s cannot deliver', async (status) => {
  await db.query('update comm_whatsapp_chats set autonomous_attendance_status=$1', [status]);
  expect(await claim()).toBe(false);
});
test('T12 manual intervention and soft deletion block delivery after reservation', async () => {
  expect(await claim()).toBe(true);
  await db.exec(`INSERT INTO comm_whatsapp_messages(id,chat_id,direction,message_type,text_content,created_by)
    VALUES('${newer}','${chat}','outbound','text','Atendimento humano','${lead}');`);
  expect(await canSend()).toBe(false);
  await db.query('delete from comm_whatsapp_messages where id=$1', [newer]);
  await db.exec('update comm_whatsapp_chats set deleted_at=now();');
  expect(await canSend()).toBe(false);
});

test.each(['unknown', 'receipt', 'ack', 'status', 'reaction'])('T11 technical %s does not change the useful turn', async (kind) => {
  await db.query('insert into comm_whatsapp_messages(id,chat_id,direction,message_type,text_content) values($1,$2,$3,$4,$5)',
    [newer, chat, 'inbound', kind, '[Mensagem]']);
  expect(await claim()).toBe(true);
});

test('memory refuses stale/cross-chat/legacy writes and preserves old rows until a valid v2 snapshot', async () => {
  await db.query('insert into ai_autonomous_qualification_states values($1,$2,$3,7)', [chat, lead, { schemaVersion: 1 }]);
  const save = async (source = inbound, person = lead, state: object = { schemaVersion: 2, source_message_id: source }) => (
    await db.query<{ ok: boolean }>('select save_ai_autonomous_turn_memory($1,$2,$3,$4,$5) ok', [chat, person, job, source, state])
  ).rows[0].ok;
  expect(await save(inbound, lead, { schemaVersion: 1 })).toBe(false);
  expect(await save(inbound, chat)).toBe(false);
  expect(await save(newer)).toBe(false);
  expect(await save()).toBe(true);
  expect((await db.query<{ version: number }>('select version from ai_autonomous_qualification_states')).rows[0].version).toBe(8);
});

test('internal functions are unavailable to API roles', async () => {
  const result = await db.query<{ allowed: boolean }>(`select has_function_privilege('authenticated',
    'public.can_send_ai_autonomous_reply(uuid,uuid,uuid,text)', 'execute') allowed`);
  expect(result.rows[0].allowed).toBe(false);
});

test('T10 crash recovery never requeues reserved/unknown/sent delivery and coalesces older processing jobs', async () => {
  expect(await claim()).toBe(true);
  await db.exec("update ai_autonomous_reply_jobs set updated_at=now()-interval '11 minutes';");
  await db.exec('select public.recover_stalled_ai_autonomous_jobs();');
  const statuses = (await db.query<{ id: string; status: string }>('select id,status from ai_autonomous_reply_jobs order by id')).rows;
  expect(statuses).toEqual([{ id: job, status: 'failed' }, { id: otherJob, status: 'pending' }]);
  expect(await claim()).toBe(false);
});

test('T10 two interrupted jobs produce only one pending job', async () => {
  await db.exec("update ai_autonomous_reply_jobs set updated_at=now()-interval '11 minutes';");
  await db.exec('select public.recover_stalled_ai_autonomous_jobs();');
  expect((await db.query<{ count: number }>("select count(*)::int count from ai_autonomous_reply_jobs where status='pending'")).rows[0].count).toBe(1);
});
