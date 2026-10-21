import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261021205214_whatsapp_campaign_admission_safety.sql'),
  'utf8',
);

const getFunctionSql = (name: string): string => {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Função ausente na migração: ${name}`);
  const end = migration.indexOf('$function$;', start);
  if (end < 0) throw new Error(`Fim de função ausente na migração: ${name}`);
  return migration.slice(start, end + '$function$;'.length);
};

const campaignIdA = '00000000-0000-0000-0000-000000000001';
const campaignIdB = '00000000-0000-0000-0000-000000000002';
const makeTargetId = (index: number) => `00000000-0000-0000-0001-${String(index).padStart(12, '0')}`;
const campaignStart = '2026-10-21T12:00:00.000Z'; // 09:00 em America/Sao_Paulo

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA extensions;
    CREATE TABLE public.comm_whatsapp_campaigns (
      id uuid PRIMARY KEY,
      status text NOT NULL,
      scheduled_at timestamptz,
      send_window_start time,
      send_window_end time,
      active_weekdays smallint[] NOT NULL,
      daily_send_limit integer,
      pacing_per_minute integer NOT NULL DEFAULT 6
    );
    CREATE TABLE public.comm_whatsapp_campaign_targets (
      id uuid PRIMARY KEY,
      campaign_id uuid NOT NULL,
      phone_digits text,
      status text NOT NULL DEFAULT 'pending',
      next_send_at timestamptz,
      next_retry_at timestamptz
    );
    CREATE TABLE public.comm_whatsapp_campaign_admissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid NOT NULL,
      target_id uuid NOT NULL,
      channel_key text NOT NULL,
      endpoint_hash text,
      admitted_at timestamptz NOT NULL,
      admission_reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      UNIQUE (campaign_id, target_id),
      UNIQUE (campaign_id, endpoint_hash)
    );
    CREATE TABLE public.comm_whatsapp_campaign_events (
      campaign_id uuid NOT NULL,
      target_id uuid,
      event_type text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE FUNCTION extensions.digest(bytea, text) RETURNS bytea
      LANGUAGE sql IMMUTABLE AS $$ SELECT decode(md5(encode($1, 'hex')), 'hex') $$;
    CREATE FUNCTION public._comm_whatsapp_campaign_target_marketing_reason(uuid, uuid)
      RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
  `);
  await db.exec([
    getFunctionSql('_comm_whatsapp_campaign_window_minutes'),
    getFunctionSql('_comm_whatsapp_campaign_window_open'),
    getFunctionSql('_comm_whatsapp_campaign_record_admission_deferred'),
    getFunctionSql('_comm_whatsapp_campaign_reserve_new_contact'),
    getFunctionSql('get_comm_whatsapp_campaign_admission_turn'),
  ].join('\n'));
});

afterEach(async () => {
  await db.close();
});

const addCampaign = async (id: string) => db.query(
  `INSERT INTO public.comm_whatsapp_campaigns
    (id, status, send_window_start, send_window_end, active_weekdays, daily_send_limit, pacing_per_minute)
   VALUES ($1, 'running', '09:00', '18:30', ARRAY[1,2,3,4,5]::smallint[], 30, 6)`,
  [id],
);

const addTargets = async (campaignId: string, offset: number, count: number) => {
  for (let index = 0; index < count; index += 1) {
    const targetIndex = offset + index;
    await db.query(
      'INSERT INTO public.comm_whatsapp_campaign_targets (id, campaign_id, phone_digits) VALUES ($1, $2, $3)',
      [makeTargetId(targetIndex), campaignId, `555000${String(targetIndex).padStart(5, '0')}`],
    );
  }
};

const reserve = async (campaignId: string, targetId: string, at: string) => {
  const { rows } = await db.query(
    `SELECT * FROM public._comm_whatsapp_campaign_reserve_new_contact(
      $1::uuid, $2::uuid, 'whatsapp', 'America/Sao_Paulo', $3::timestamptz
    )`,
    [campaignId, targetId, at],
  );
  return rows[0] as { result: string; retry_at: string | null; admission_exists: boolean };
};

test('30 contatos com retry idempotente e alvo 31 bloqueado contam como admissões distintas', async () => {
  await addCampaign(campaignIdA);
  await addTargets(campaignIdA, 1, 32);
  await db.query(
    `UPDATE public.comm_whatsapp_campaign_targets AS duplicate
     SET phone_digits = original.phone_digits
     FROM public.comm_whatsapp_campaign_targets AS original
     WHERE duplicate.id = $1::uuid AND original.id = $2::uuid`,
    [makeTargetId(32), makeTargetId(1)],
  );

  for (let index = 0; index < 30; index += 1) {
    const at = new Date(Date.parse(campaignStart) + index * 19 * 60_000).toISOString();
    expect((await reserve(campaignIdA, makeTargetId(index + 1), at)).result).toBe('reserved');
  }

  const retry = await reserve(campaignIdA, makeTargetId(1), '2026-10-21T21:25:00.000Z');
  const thirtyFirst = await reserve(campaignIdA, makeTargetId(31), '2026-10-21T21:25:00.000Z');
  const duplicate = await reserve(campaignIdA, makeTargetId(32), '2026-10-21T21:25:00.000Z');
  const { rows } = await db.query('SELECT count(*)::integer AS total FROM public.comm_whatsapp_campaign_admissions');

  expect(retry).toMatchObject({ result: 'reserved', admission_exists: true });
  expect(thirtyFirst.result).toBe('daily_limited');
  expect(duplicate.result).toBe('eligibility_blocked');
  expect(rows[0].total).toBe(30);
});

test('duas campanhas no mesmo canal alternam admissões em 9m30 sem passar de 30 cada', async () => {
  await addCampaign(campaignIdA);
  await addCampaign(campaignIdB);
  await addTargets(campaignIdA, 1, 30);
  await addTargets(campaignIdB, 101, 30);

  for (let slot = 0; slot < 60; slot += 1) {
    const campaignId = slot % 2 === 0 ? campaignIdA : campaignIdB;
    const targetOffset = slot % 2 === 0 ? 1 : 101;
    const targetIndex = targetOffset + Math.floor(slot / 2);
    const at = new Date(Date.parse(campaignStart) + slot * 9.5 * 60_000).toISOString();
    expect((await reserve(campaignId, makeTargetId(targetIndex), at)).result).toBe('reserved');
  }

  const counts = await db.query(
    'SELECT campaign_id, count(*)::integer AS total FROM public.comm_whatsapp_campaign_admissions GROUP BY campaign_id ORDER BY campaign_id',
  );
  const nextTurn = await db.query(
    `SELECT campaign_id, available_at FROM public.get_comm_whatsapp_campaign_admission_turn('whatsapp', 'America/Sao_Paulo')`,
  );

  expect(counts.rows.map((row) => row.total)).toEqual([30, 30]);
  expect(nextTurn.rows).toHaveLength(0);
});

test('reservas concorrentes no mesmo instante não iniciam duas campanhas juntas', async () => {
  await addCampaign(campaignIdA);
  await addCampaign(campaignIdB);
  await addTargets(campaignIdA, 1, 1);
  await addTargets(campaignIdB, 101, 1);

  const results = await Promise.all([
    reserve(campaignIdA, makeTargetId(1), campaignStart),
    reserve(campaignIdB, makeTargetId(101), campaignStart),
  ]);
  const { rows } = await db.query('SELECT count(*)::integer AS total FROM public.comm_whatsapp_campaign_admissions');

  expect(results.map((result) => result.result).sort()).toEqual(['rate_limited', 'reserved']);
  expect(rows[0].total).toBe(1);
});
