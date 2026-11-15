// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { mergeInterpretation, initialState, type V2State } from '../../ai-autonomous-reply-worker/domain/state.ts';
import { decide, requirements } from '../../ai-autonomous-reply-worker/domain/decision.ts';
import { date, interpretation, scenarios } from './fixtures/autonomous-v2-scenarios.ts';

let db: PGlite;
const chat = '00000000-0000-0000-0000-000000000001';
const lead = '00000000-0000-0000-0000-000000000002';
const job = '00000000-0000-0000-0000-000000000003';
const source = '00000000-0000-0000-0000-000000000004';
const newer = '00000000-0000-0000-0000-000000000005';
const quoteStatus = '00000000-0000-0000-0000-000000000006';
const attendanceStatus = '00000000-0000-0000-0000-000000000007';
const scenarioState = (index = 1): V2State => mergeInterpretation(initialState(), interpretation(scenarios[index].values, scenarios[index].messages), scenarios[index].messages, date);
const canComplete = async (state: unknown) => (await db.query<{ ok: boolean }>('select ai_autonomous_qualification_can_complete($1) ok', [state])).rows[0].ok;
const save = async (state: V2State) => db.query('insert into ai_autonomous_qualification_states values($1,$2,$3,1) on conflict(chat_id) do update set state=excluded.state',
  [chat, lead, { schemaVersion: 2, source_message_id: source, attendanceV2: state }]);
const handoff = (code = 'QUALIFICACAO_COMPLETA') => db.query('select * from complete_ai_autonomous_attendance_handoff($1,$2,$3)', [chat, lead, code]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE comm_whatsapp_chats(id uuid primary key, lead_id uuid, deleted_at timestamptz, autonomous_attendance_status text, updated_at timestamptz);
    CREATE TABLE comm_whatsapp_messages(id uuid primary key, chat_id uuid, direction text, message_type text, text_content text,
      media_caption text, transcription_text text, delivery_status text default 'received', created_at timestamptz default now(), created_by uuid);
    CREATE TABLE ai_autonomous_reply_jobs(id uuid primary key, chat_id uuid, lead_id uuid, status text, updated_at timestamptz default now(), last_error text);
    CREATE TABLE ai_autonomous_reply_locks(chat_id uuid primary key, owner_id text, lease_until timestamptz);
    CREATE TABLE ai_autonomous_reply_delivery_keys(idempotency_key text primary key, chat_id uuid, job_id uuid, message_index integer, status text default 'reserved');
    CREATE TABLE ai_autonomous_qualification_states(chat_id uuid primary key, lead_id uuid, state jsonb, version bigint);
    CREATE TABLE leads(id uuid primary key, status_id uuid);
    CREATE TABLE lead_status_config(id uuid primary key, nome text, ordem integer, created_at timestamptz);
    CREATE FUNCTION comm_whatsapp_lock_canonical_chat_uuid(p_chat_id uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT p_chat_id $$;
    CREATE FUNCTION upsert_ai_autonomous_qualification_state(p_chat_id uuid,p_lead_id uuid,p_state jsonb) RETURNS void LANGUAGE sql AS $$
      INSERT INTO ai_autonomous_qualification_states VALUES(p_chat_id,p_lead_id,p_state,1)
      ON CONFLICT(chat_id) DO UPDATE SET state=excluded.state,version=ai_autonomous_qualification_states.version+1 $$;`);
  await db.exec(readFileSync('supabase/migrations/20261029195235_harden_autonomous_turn_delivery.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261114193309_autonomous_attendance_v2_handoff_guard.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261115000607_autonomous_v2_residence_neighborhood.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261115024410_autonomous_v2_optional_qualification_fields.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261115123308_autonomous_v2_city_neighborhood_question.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261115124035_autonomous_v2_qualification_only_handoff.sql', 'utf8'));
}, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE comm_whatsapp_chats,comm_whatsapp_messages,ai_autonomous_reply_jobs,ai_autonomous_reply_locks,
    ai_autonomous_reply_delivery_keys,ai_autonomous_qualification_states,leads,lead_status_config;
    INSERT INTO comm_whatsapp_chats VALUES('${chat}','${lead}',null,'active',now());
    INSERT INTO leads VALUES('${lead}','${attendanceStatus}');
    INSERT INTO lead_status_config VALUES('${quoteStatus}','Aguardando cotação',1,now());
    INSERT INTO ai_autonomous_reply_jobs VALUES('${job}','${chat}','${lead}','processing',now(),null);
    INSERT INTO ai_autonomous_reply_locks VALUES('${chat}','${job}',now()+interval '2 minutes');
    INSERT INTO comm_whatsapp_messages(id,chat_id,direction,message_type,text_content,created_at) VALUES('${source}','${chat}','inbound','text','Mensagem sintética',now()-interval '1 minute');`);
});

test.each(scenarios)('SQL parity with real backend policy — $id $name', async (scenario) => {
  const input = interpretation(scenario.values, scenario.messages, scenario.extras);
  const state = mergeInterpretation(initialState(), input, scenario.messages, date);
  const decision = decide(state, input);
  expect(await canComplete({ attendanceV2: state })).toBe(requirements(state).length === 0);
  if (decision.action === 'complete') expect(await canComplete({ attendanceV2: state })).toBe(true);
});
test('actual RPC refuses fabricated completion and preserves both chat and commercial status', async () => {
  await save(initialState());
  await expect(handoff()).rejects.toThrow('Qualificacao incompleta');
  expect((await db.query('select autonomous_attendance_status from comm_whatsapp_chats')).rows[0]).toEqual({ autonomous_attendance_status: 'active' });
  expect((await db.query('select status_id from leads')).rows[0]).toEqual({ status_id: attendanceStatus });
});
test('actual RPC completes a current validated turn once and cancels pending replies', async () => {
  await save(scenarioState());
  await db.query('insert into ai_autonomous_reply_jobs(id,chat_id,lead_id,status) values($1,$2,$3,$4)', [newer, chat, lead, 'pending']);
  expect((await handoff()).rows[0]).toMatchObject({ status_applied: true });
  expect((await handoff()).rows[0]).toMatchObject({ status_applied: false });
  expect((await db.query('select status_id from leads')).rows[0]).toEqual({ status_id: quoteStatus });
  expect((await db.query('select status from ai_autonomous_reply_jobs where id=$1', [newer])).rows[0]).toEqual({ status: 'cancelled' });
});
test('handoff with missing essential data is early and never marks the lead qualified', async () => {
  const state = scenarioState(0); delete state.facts.city;
  await save(state);
  await expect(handoff()).rejects.toThrow('Qualificacao incompleta');
  await handoff('PRECISA_HUMANO');
  expect((await db.query('select status_id from leads')).rows[0]).toEqual({ status_id: attendanceStatus });
});
test('explicit refusal preserves the existing lost-status contract', async () => {
  const lostStatus = '00000000-0000-0000-0000-000000000008';
  await db.query('insert into lead_status_config values($1,$2,2,now())', [lostStatus, 'Perdido']);
  await handoff('RECUSOU_COTACAO');
  expect((await db.query('select status_id from leads')).rows[0]).toEqual({ status_id: lostStatus });
});
test('late inbound and human intervention prevent completion after the visible message', async () => {
  await save(scenarioState());
  await db.query('insert into comm_whatsapp_messages(id,chat_id,direction,message_type,text_content) values($1,$2,$3,$4,$5)', [newer, chat, 'inbound', 'text', 'Mais uma informação']);
  await expect(handoff()).rejects.toThrow('Turno de qualificacao desatualizado');
  await db.query('update comm_whatsapp_messages set direction=$1,created_by=$2 where id=$3', ['outbound', lead, newer]);
  await expect(handoff()).rejects.toThrow('Turno de qualificacao desatualizado');
});
test('atomic worker handoff rejects stale early transfers and accepts terminal processing failure only for human review', async () => {
  const transfer = (code = 'PRECISA_HUMANO') => db.query<{ status_applied: boolean }>('select * from complete_ai_autonomous_turn_handoff($1,$2,$3,$4,$5)', [chat, lead, code, job, source]);
  await save(scenarioState(0));
  await db.query('insert into comm_whatsapp_messages(id,chat_id,direction,message_type,text_content) values($1,$2,$3,$4,$5)', [newer, chat, 'inbound', 'text', 'Corrigindo']);
  expect((await transfer()).rows[0].status_applied).toBe(false);
  await db.query('delete from comm_whatsapp_messages where id=$1', [newer]);
  await db.query('update ai_autonomous_reply_jobs set status=$1 where id=$2', ['failed', job]);
  expect((await transfer('QUALIFICACAO_COMPLETA')).rows[0].status_applied).toBe(false);
  expect((await transfer()).rows[0].status_applied).toBe(true);
  expect((await db.query('select status_id from leads')).rows[0]).toEqual({ status_id: attendanceStatus });
});
test.each([null, {}, { qualification: { status: 'complete', missingRequiredFields: [] } }, { attendanceV2: { version: 2, facts: {} } }])('malformed or tag-only snapshot fails closed: %j', async (state) => {
  expect(await canComplete(state)).toBe(false);
});
test('SQL recalculates ages and field statuses instead of trusting declared missing fields', async () => {
  const state = scenarioState();
  state.facts.beneficiaries = { ...state.facts.beneficiaries!, value: [{ id: 'self', label: 'cliente', age: null }] };
  expect(await canComplete({ attendanceV2: state, missingRequiredFields: [] })).toBe(false);
  state.facts.beneficiaries.value = [{ id: 'self', label: 'cliente', age: 35 }];
  state.facts.companyPresence!.status = 'unknown';
  expect(await canComplete({ attendanceV2: state })).toBe(false);
});

test('SQL and backend both block a capital without neighborhood, but never require intent, goal or a current plan', async () => {
  const state = scenarioState();
  delete state.facts.intent; delete state.facts.goal; delete state.facts.hasCurrentPlan;
  expect(await canComplete({ attendanceV2: state })).toBe(true);
  delete state.facts.neighborhood;
  expect(await canComplete({ attendanceV2: state, missingRequiredFields: [] })).toBe(false);
  await save(state);
  await expect(handoff()).rejects.toThrow('Qualificacao incompleta');
  state.facts.city!.value = 'Niterói';
  expect(await canComplete({ attendanceV2: state })).toBe(true);
});

test('SQL does not promote optional refusal/conflict to an essential prerequisite', async () => {
  const state = scenarioState();
  state.facts.goal!.status = 'conflict';
  state.facts.hasCurrentPlan!.status = 'declined'; state.facts.hasCurrentPlan!.value = null;
  state.facts.companyNumber = { ...state.facts.goal!, value: null, status: 'declined' };
  expect(await canComplete({ attendanceV2: state })).toBe(true);
  state.facts.neighborhood!.status = 'conflict';
  expect(await canComplete({ attendanceV2: state })).toBe(false);
});

test('SQL accepts a noncapital with city alone without demanding neighborhood or a separate state answer', async () => {
  const state = scenarioState();
  state.facts.city!.value = 'Duque de Caxias';
  delete state.facts.state; delete state.facts.neighborhood;
  expect(await canComplete({ attendanceV2: state })).toBe(true);
});

test('MEI and network preferences do not block qualified handoff or approve any product', async () => {
  const state = scenarioState();
  state.facts.companyPresence!.value = 'yes';
  state.facts.preferences = { ...state.facts.city!, value: ['Plano para a família', 'Melhorar a rede'] };
  state.facts.companyNumber = { ...state.facts.city!, value: null, status: 'unknown' };
  expect(await canComplete({ attendanceV2: state })).toBe(true);
  await save(state);
  expect((await handoff()).rows[0]).toMatchObject({ status_applied: true });
  expect((await db.query('select status_id from leads')).rows[0]).toEqual({ status_id: quoteStatus });
});

test('a child in the composition is collected as informed without the AI applying a product eligibility rule', async () => {
  const state = scenarioState();
  state.facts.beneficiaries!.value = [{ id: 'child', label: 'filho', age: 0 }];
  expect(await canComplete({ attendanceV2: state })).toBe(true);
  state.facts.beneficiaries!.value = [{ id: 'child', label: 'filho', age: null }];
  expect(await canComplete({ attendanceV2: state })).toBe(false);
});

test.each([
  ['Rio', 'RJ'], ['Rio de Janeiro', 'RJ'], ['Rio Branco', 'AC'], ['Maceió', 'AL'], ['Macapá', 'AP'], ['Manaus', 'AM'],
  ['Salvador', 'BA'], ['Fortaleza', 'CE'], ['Brasília', 'DF'], ['Vitória', 'ES'], ['Goiânia', 'GO'], ['São Luís', 'MA'],
  ['Cuiabá', 'MT'], ['Campo Grande', 'MS'], ['Belo Horizonte', 'MG'], ['Belém', 'PA'], ['João Pessoa', 'PB'], ['Curitiba', 'PR'],
  ['Recife', 'PE'], ['Teresina', 'PI'], ['Natal', 'RN'], ['Porto Alegre', 'RS'], ['Porto Velho', 'RO'], ['Boa Vista', 'RR'],
  ['Florianópolis', 'SC'], ['São Paulo', 'SP'], ['Aracaju', 'SE'], ['Palmas', 'TO'],
])('capital geography has SQL/backend parity for %s, %s', async (city, uf) => {
  const values = { ...scenarios[1].values, city }; delete values.state;
  const state = mergeInterpretation(initialState(), interpretation(values, scenarios[1].messages), scenarios[1].messages, date);
  expect(state.facts.state?.value).toBe(uf);
  expect(await canComplete({ attendanceV2: state })).toBe(true);
  state.facts.state!.value = 'XX';
  expect(await canComplete({ attendanceV2: state })).toBe(false);
  state.facts.state!.value = uf;
  delete state.facts.neighborhood;
  expect(await canComplete({ attendanceV2: state })).toBe(false);
  expect(decide(state, interpretation({}, scenarios[1].messages))).toMatchObject({ action: 'ask', field: 'neighborhood' });
});
test('internal validators and handoff remain restricted to service role', async () => {
  for (const fn of ['ai_autonomous_qualification_can_complete(jsonb)', 'complete_ai_autonomous_attendance_handoff(uuid,uuid,text)', 'complete_ai_autonomous_turn_handoff(uuid,uuid,text,uuid,uuid)']) {
    for (const role of ['anon', 'authenticated']) expect((await db.query<{ ok: boolean }>('select has_function_privilege($1,$2,$3) ok', [role, fn, 'execute'])).rows[0].ok).toBe(false);
  }
});
