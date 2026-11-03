// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const migration = readFileSync(new URL('../../../migrations/20261103122551_whatsapp_provider_dispatch.sql', import.meta.url), 'utf8');
const phone = '5511888888888';
const actor = 'aa8bd633-27cf-41c4-a604-05f3d0f45a99';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table comm_whatsapp_channels (id uuid primary key default gen_random_uuid(), slug text unique, phone_number text);
    insert into comm_whatsapp_channels (slug, phone_number) values ('primary', '${phone}');
    create table comm_whatsapp_send_requests (status text, channel_id uuid, client_request_id text, updated_at timestamptz default now());
    create table comm_whatsapp_campaigns (status text);
    create table comm_whatsapp_campaign_step_dispatches (status text);
    create table comm_whatsapp_scheduled_messages (status text, next_retry_at timestamptz);
    create table comm_whatsapp_scheduled_sequences (status text);
    create table comm_whatsapp_scheduled_sequence_steps (status text);
    create table ai_autonomous_reply_jobs (status text);
    create table auto_contact_flow_jobs (status text);
    grant select, update on all tables in schema public to service_role;
  `);
  await db.exec(migration);
}, 20_000);

afterAll(async () => { await db?.close(); });

const switchProvider = (revision: number, provider: string, verifiedPhone = phone, transferPending = false) =>
  db.query<{ revision: number }>('select whatsapp_transport_switch($1,$2,$3,$4,$5,$6) revision', [
    revision, provider, actor, verifiedPhone, provider === 'zapi' ? 'inst-01' : null, transferPending,
  ]);

const begin = async (revision: number, provider: string, operationKey?: string) => {
  const result = await db.query<{ result: { state: string; id?: string; result?: unknown } }>(
    'select whatsapp_transport_begin($1,$2,$3) result', [revision, provider, operationKey ?? null],
  );
  return result.rows[0].result;
};

describe.sequential('persisted switch and dispatch fencing', () => {
  test('defaults to WHAPI, hides the state from authenticated users, and rejects a different number', async () => {
    expect((await db.query('select provider,revision from whatsapp_transport_state')).rows)
      .toEqual([{ provider: 'whapi', revision: 0 }]);
    await db.exec('set role authenticated');
    try {
      await expect(switchProvider(0, 'zapi')).rejects.toThrow(/permission denied/);
      await expect(db.query('select * from whatsapp_transport_state')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
    await expect(switchProvider(0, 'zapi', '5511999999999')).rejects.toThrow(/mesmo do canal/);
  });

  test.each([
    ['comm_whatsapp_send_requests', 'sending'],
    ['comm_whatsapp_scheduled_sequences', 'paused'],
    ['comm_whatsapp_campaigns', 'running'],
    ['comm_whatsapp_campaign_step_dispatches', 'uncertain'],
    ['auto_contact_flow_jobs', 'pending'],
    ['ai_autonomous_reply_jobs', 'processing'],
  ])('blocks a switch while %s is %s', async (table, status) => {
    await db.query(`insert into ${table} (status) values ($1)`, [status]);
    try {
      await expect(switchProvider(0, 'zapi')).rejects.toThrow(/pendentes|em andamento/);
    } finally {
      await db.exec(`delete from ${table}`);
    }
  });

  test('blocks a switch during an in-flight WHAPI send and rejects a stale worker after switching', async () => {
    const active = await begin(0, 'whapi', 'legacy-operation');
    expect(active.state).toBe('started');
    await expect(switchProvider(0, 'zapi')).rejects.toThrow(/em andamento/);
    await db.query('delete from whatsapp_transport_attempts where id = $1', [active.id]);
    await db.exec('set role service_role');
    try {
      expect((await switchProvider(0, 'zapi')).rows).toEqual([{ revision: 1 }]);
    } finally {
      await db.exec('reset role');
    }
    expect(await begin(0, 'whapi')).toEqual({ state: 'changed' });
    await expect(switchProvider(0, 'whapi')).rejects.toThrow(/provedor mudou/);
  });

  test('reuses accepted Z-API operations, fences uncertain attempts and never transfers a key to WHAPI', async () => {
    const attempts = await Promise.all([begin(1, 'zapi', 'job:1'), begin(1, 'zapi', 'job:1')]);
    expect(attempts.map(({ state }) => state).sort()).toEqual(['started', 'uncertain']);
    await expect(switchProvider(1, 'whapi', phone, true)).rejects.toThrow(/em andamento/);
    const result = { id: 'zapi:inst-01:ABC', status: 'queued' };
    await db.query('update whatsapp_transport_attempts set result = $1, finished_at = now() where id = $2',
      [JSON.stringify(result), attempts.find(({ state }) => state === 'started')?.id]);
    expect(await begin(1, 'zapi', 'job:1')).toEqual({ state: 'recorded', result });
    expect((await switchProvider(1, 'whapi')).rows).toEqual([{ revision: 2 }]);
    expect(await begin(2, 'whapi', 'job:1')).toEqual({ state: 'uncertain' });
    expect((await db.query('select provider, revision from whatsapp_transport_switches order by revision')).rows)
      .toEqual([{ provider: 'zapi', revision: 1 }, { provider: 'whapi', revision: 2 }]);
  });

  test('allows a manual contingency switch with pending work and quarantines an uncertain send', async () => {
    const attempt = await begin(2, 'whapi', 'job:uncertain');
    await db.query('update whatsapp_transport_attempts set uncertain = true where id = $1', [attempt.id]);
    await db.exec("insert into comm_whatsapp_campaigns values ('running')");
    try {
      await expect(switchProvider(2, 'zapi')).rejects.toThrow(/pendentes/);
      expect((await switchProvider(2, 'zapi', phone, true)).rows).toEqual([{ revision: 3 }]);
      expect(await begin(3, 'zapi', 'job:uncertain')).toEqual({ state: 'uncertain' });
      expect((await db.query("select status from comm_whatsapp_campaigns")).rows).toEqual([{ status: 'running' }]);
      expect((await db.query("select transfer_pending from whatsapp_transport_switches where revision = 3")).rows)
        .toEqual([{ transfer_pending: true }]);
    } finally {
      await db.exec('delete from comm_whatsapp_campaigns');
    }
  });
});
