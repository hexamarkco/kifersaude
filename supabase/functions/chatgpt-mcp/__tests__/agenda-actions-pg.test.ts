// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261022041916_mcp_agenda_reminder_actions.sql'), 'utf8');
const actorId = '11111111-1111-4111-8111-111111111111';
const leadId = '22222222-2222-4222-8222-222222222222';
const version = '2026-10-22T00:00:00Z';
const reminderId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
let db: PGlite;
const mutate = async (operation: string, items: unknown[], dryRun = false, actor = actorId) =>
  (await db.query<{ result: Record<string, unknown> }>('SELECT public.mcp_mutate_agenda_reminders($1::uuid,$2::text,$3::jsonb,$4::boolean) AS result', [actor, operation, JSON.stringify(items), dryRun])).rows[0].result;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY, role text, email text);
    CREATE TABLE public.leads(id uuid PRIMARY KEY, proximo_retorno timestamptz);
    CREATE TABLE public.reminders(id uuid PRIMARY KEY, lead_id uuid REFERENCES public.leads(id), contract_id uuid, data_lembrete timestamptz NOT NULL, lido boolean DEFAULT false, concluido_em timestamptz, cancelled_at timestamptz, cancelled_by text, cancellation_reason text, ultima_modificacao timestamptz);
    CREATE TABLE public.mcp_action_audit_log(tool_name text, action_type text, actor text, actor_id uuid, request_payload jsonb, result_payload jsonb, success boolean, source text);
    INSERT INTO public.user_profiles VALUES ('${actorId}','admin','synthetic@kifer.test');
    INSERT INTO public.leads VALUES ('${leadId}',NULL);
    INSERT INTO public.reminders(id,lead_id,data_lembrete,ultima_modificacao)
      SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,'${leadId}','2030-01-01T12:00:00Z','${version}' FROM generate_series(1,20) i;
  `);
  await db.exec(migration);
});
afterEach(async () => { await db.close(); });

describe('transactional MCP agenda actions', () => {
  it('reschedules 20 reminders at three minute intervals and synchronizes the lead in the same transaction', async () => {
    const start = Date.parse('2030-10-22T09:00:00-03:00');
    const items = Array.from({ length: 20 }, (_, index) => ({ reminder_id: reminderId(index + 1), expected_ultima_modificacao: version, data_lembrete: new Date(start + index * 180000).toISOString() }));
    expect(await mutate('reschedule', items)).toMatchObject({ success: true, changed_count: 20 });
    const rows = (await db.query<{ id: string; due: number }>('SELECT id,extract(epoch from data_lembrete)::float8 AS due FROM reminders ORDER BY id')).rows;
    expect(rows.map((row) => Number(row.due) * 1000)).toEqual(items.map((item) => Date.parse(item.data_lembrete)));
    const next = (await db.query<{ due: number }>('SELECT extract(epoch from proximo_retorno)::float8 AS due FROM leads')).rows[0];
    expect(Number(next.due) * 1000).toBe(start);
    expect((await db.query('SELECT * FROM mcp_action_audit_log')).rows).toHaveLength(1);
  });

  it('leaves the entire batch unchanged when one version is stale or one ID is missing', async () => {
    const first = { reminder_id: reminderId(1), expected_ultima_modificacao: version, data_lembrete: '2030-10-22T12:00:00Z' };
    expect(await mutate('reschedule', [first, { ...first, reminder_id: reminderId(2), expected_ultima_modificacao: '2025-01-01T00:00:00Z' }])).toMatchObject({ success: false, error_code: 'CONFLICT' });
    expect(await mutate('reschedule', [first, { ...first, reminder_id: reminderId(99) }])).toMatchObject({ success: false, error_code: 'NOT_FOUND' });
    expect((await db.query("SELECT id FROM reminders WHERE data_lembrete <> '2030-01-01T12:00:00Z'")).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM mcp_action_audit_log')).rows).toHaveLength(0);
  });

  it('previews without changing reminders, lead dates or audit records and validates duplicates', async () => {
    const item = { reminder_id: reminderId(1), expected_ultima_modificacao: version, data_lembrete: '2030-10-22T12:00:00Z' };
    expect(await mutate('reschedule', [item], true)).toMatchObject({ success: true, dry_run: true, changed_count: 0 });
    expect(await mutate('reschedule', [item, item])).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect((await db.query('SELECT proximo_retorno FROM leads')).rows[0]).toEqual({ proximo_retorno: null });
    expect((await db.query('SELECT * FROM mcp_action_audit_log')).rows).toHaveLength(0);
  });

  it('reopens cancelled reminders and supports explicit deletion with next-return synchronization', async () => {
    await db.exec(`UPDATE reminders SET lido=true,concluido_em=now(),cancelled_at=now(),cancelled_by='synthetic',cancellation_reason='synthetic' WHERE id='${reminderId(1)}'`);
    expect(await mutate('reopen', [{ reminder_id: reminderId(1), expected_ultima_modificacao: version }])).toMatchObject({ success: true });
    expect((await db.query(`SELECT lido,concluido_em,cancelled_at,cancelled_by,cancellation_reason FROM reminders WHERE id='${reminderId(1)}'`)).rows[0]).toEqual({ lido: false, concluido_em: null, cancelled_at: null, cancelled_by: null, cancellation_reason: null });
    expect(await mutate('delete', [{ reminder_id: reminderId(2), expected_ultima_modificacao: version }])).toMatchObject({ success: true, changed_count: 1, deleted_ids: [reminderId(2)] });
    expect((await db.query(`SELECT id FROM reminders WHERE id='${reminderId(2)}'`)).rows).toHaveLength(0);
  });

  it('rolls back reminder mutations when the transaction cannot persist its audit', async () => {
    await db.exec('ALTER TABLE mcp_action_audit_log ADD CONSTRAINT synthetic_audit_failure CHECK (success = false)');
    expect(await mutate('reschedule', [{ reminder_id: reminderId(1), expected_ultima_modificacao: version, data_lembrete: '2030-10-22T12:00:00Z' }])).toMatchObject({ success: false, error_code: 'CONFLICT' });
    expect((await db.query("SELECT id FROM reminders WHERE data_lembrete <> '2030-01-01T12:00:00Z'")).rows).toHaveLength(0);
    expect((await db.query('SELECT proximo_retorno FROM leads')).rows[0]).toEqual({ proximo_retorno: null });
  });

  it('requires an active admin and restricts execution to the service role', async () => {
    expect(await mutate('reopen', [{ reminder_id: reminderId(1), expected_ultima_modificacao: version }], false, leadId)).toMatchObject({ success: false, error_code: 'UNAUTHORIZED' });
    const privilege = (await db.query("SELECT has_function_privilege('anon','public.mcp_mutate_agenda_reminders(uuid,text,jsonb,boolean)','execute') AS anon,has_function_privilege('service_role','public.mcp_mutate_agenda_reminders(uuid,text,jsonb,boolean)','execute') AS service,prosecdef FROM pg_proc WHERE proname='mcp_mutate_agenda_reminders'")).rows[0];
    expect(privilege).toEqual({ anon: false, service: true, prosecdef: false });
  });
});
