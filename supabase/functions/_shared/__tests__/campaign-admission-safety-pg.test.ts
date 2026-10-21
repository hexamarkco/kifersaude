// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261021205214_whatsapp_campaign_admission_safety.sql'),
  'utf8',
);
const pacingMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261021221500_campaign_pacing_configuration.sql'),
  'utf8',
);

const getFunctionSql = (name: string): string => {
  for (const source of [pacingMigration, migration]) {
    const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    if (start < 0) continue;
    const end = source.indexOf('$function$;', start);
    if (end < 0) throw new Error(`Fim de função ausente na migração: ${name}`);
    return source.slice(start, end + '$function$;'.length);
  }
  throw new Error(`Função ausente na migração: ${name}`);
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
    CREATE SCHEMA storage;
    CREATE TABLE public.comm_whatsapp_campaigns (
      id uuid PRIMARY KEY,
      status text NOT NULL,
      scheduled_at timestamptz,
      send_window_start time,
      send_window_end time,
      active_weekdays smallint[] NOT NULL,
      daily_send_limit integer,
      contact_interval_minutes integer,
      inter_message_interval_minutes integer NOT NULL DEFAULT 0,
      pacing_per_minute integer NOT NULL DEFAULT 6,
      audience_config jsonb NOT NULL DEFAULT '{}'::jsonb,
      ab_test_enabled boolean NOT NULL DEFAULT false
    );
    CREATE TABLE public.comm_whatsapp_campaign_targets (
      id uuid PRIMARY KEY,
      campaign_id uuid NOT NULL,
      phone_digits text,
      status text NOT NULL DEFAULT 'pending',
      next_send_at timestamptz,
      next_retry_at timestamptz,
      whatsapp_check_status text NOT NULL DEFAULT 'valid'
    );
    CREATE TABLE public.comm_whatsapp_campaign_steps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid NOT NULL,
      step_index integer NOT NULL,
      stage_index integer NOT NULL DEFAULT 0,
      variant_label text NOT NULL,
      step_kind text NOT NULL,
      status_to_set text,
      message_text text NOT NULL DEFAULT '',
      delay_amount integer NOT NULL DEFAULT 0,
      delay_unit text NOT NULL DEFAULT 'minutes',
      media_type text,
      media_url text,
      media_filename text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (campaign_id, step_index, variant_label)
    );
    CREATE TABLE storage.objects (bucket_id text NOT NULL, name text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
    CREATE TABLE public.contact_permission_policies (
      channel text NOT NULL,
      endpoint_normalized text NOT NULL,
      purpose_scope text NOT NULL,
      state text NOT NULL,
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb
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
  `);
  await db.exec([
    getFunctionSql('_comm_whatsapp_campaign_window_minutes'),
    getFunctionSql('_comm_whatsapp_campaign_window_open'),
    getFunctionSql('_comm_whatsapp_campaign_marketing_review_ready'),
    getFunctionSql('_comm_whatsapp_campaign_required_image_ready'),
    getFunctionSql('_comm_whatsapp_campaign_target_marketing_reason'),
    getFunctionSql('_comm_whatsapp_campaign_record_admission_deferred'),
    getFunctionSql('_comm_whatsapp_campaign_contact_interval_seconds'),
    getFunctionSql('_mcp_comm_whatsapp_campaign_apply_pacing_config'),
    getFunctionSql('_comm_whatsapp_campaign_reserve_new_contact'),
    getFunctionSql('get_comm_whatsapp_campaign_admission_turn'),
    getFunctionSql('_mcp_comm_whatsapp_campaign_replace_steps'),
  ].join('\n'));
  await db.exec(`
    CREATE TRIGGER test_campaign_pacing_insert
      BEFORE INSERT ON public.comm_whatsapp_campaigns
      FOR EACH ROW EXECUTE FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config();
    CREATE TRIGGER test_campaign_pacing_update
      BEFORE UPDATE OF audience_config ON public.comm_whatsapp_campaigns
      FOR EACH ROW EXECUTE FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config();
  `);
});

afterEach(async () => {
  await db.close();
});

const addCampaign = async (id: string) => db.query(
  `INSERT INTO public.comm_whatsapp_campaigns
    (id, status, send_window_start, send_window_end, active_weekdays, daily_send_limit, pacing_per_minute, audience_config)
   VALUES ($1, 'running', '09:00', '18:30', ARRAY[1,2,3,4,5]::smallint[], 30, 6,
     jsonb_build_object('marketing_review', jsonb_build_object(
       'legal_basis_reviewed', true, 'legal_basis_reference', 'synthetic-legal-review',
       'promotion_reviewed', true, 'promotion_reference', 'synthetic-promotion-review'
     )))`,
  [id],
);

const addTargets = async (campaignId: string, offset: number, count: number) => {
  for (let index = 0; index < count; index += 1) {
    const targetIndex = offset + index;
    await db.query(
      'INSERT INTO public.comm_whatsapp_campaign_targets (id, campaign_id, phone_digits, whatsapp_check_status) VALUES ($1, $2, $3, \'valid\')',
      [makeTargetId(targetIndex), campaignId, `555000${String(targetIndex).padStart(5, '0')}`],
    );
    const evidence = JSON.stringify({
      campaign_marketing_eligibility: {
        [campaignId]: {
          status: 'approved',
          purpose: 'marketing',
          legal_basis: 'synthetic-only',
          evidence_reference: 'synthetic-review-fixture',
        },
      },
    });
    await db.query(
      `INSERT INTO public.contact_permission_policies
        (channel, endpoint_normalized, purpose_scope, state, evidence)
       VALUES ('whatsapp', $1, 'commercial', 'allowed', $2::jsonb)`,
      [`555000${String(targetIndex).padStart(5, '0')}`, evidence],
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
  return rows[0] as { result: string; retry_at: string | null; reason: string | null; admission_exists: boolean };
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

  const retry = await reserve(campaignIdA, makeTargetId(1), '2026-10-22T12:00:00.000Z');
  const thirtyFirst = await reserve(campaignIdA, makeTargetId(31), '2026-10-22T12:00:00.000Z');
  const duplicate = await reserve(campaignIdA, makeTargetId(32), '2026-10-22T12:00:00.000Z');
  const { rows } = await db.query('SELECT count(*)::integer AS total FROM public.comm_whatsapp_campaign_admissions');

  expect(retry).toMatchObject({ result: 'reserved', admission_exists: true });
  expect(thirtyFirst.result).toBe('daily_limited');
  expect(duplicate.result).toBe('eligibility_blocked');
  expect(rows[0].total).toBe(30);
});

test('intervalo de contatos configurado prevalece e o modo automático distribui a audiência pela janela', async () => {
  await addCampaign(campaignIdA);
  await addTargets(campaignIdA, 1, 2);
  await db.query('UPDATE public.comm_whatsapp_campaigns SET contact_interval_minutes = 5 WHERE id = $1', [campaignIdA]);

  expect((await reserve(campaignIdA, makeTargetId(1), campaignStart)).result).toBe('reserved');
  const configuredWait = await reserve(campaignIdA, makeTargetId(2), '2026-10-21T12:04:00.000Z');
  expect(configuredWait.result).toBe('rate_limited');
  expect(new Date(configuredWait.retry_at!).toISOString()).toBe('2026-10-21T12:05:00.000Z');

  await db.query('DELETE FROM public.comm_whatsapp_campaign_admissions');
  await db.query('UPDATE public.comm_whatsapp_campaigns SET contact_interval_minutes = NULL, daily_send_limit = NULL WHERE id = $1', [campaignIdA]);
  const automatic = await db.query(
    `SELECT public._comm_whatsapp_campaign_contact_interval_seconds(campaign) AS interval_seconds
     FROM public.comm_whatsapp_campaigns AS campaign WHERE campaign.id = $1`,
    [campaignIdA],
  );
  expect(automatic.rows[0].interval_seconds).toBe(285 * 60);
});

test('mutation MCP grava a cadência nas colunas e remove a chave de transporte do audience_config', async () => {
  await db.query(
    `INSERT INTO public.comm_whatsapp_campaigns
      (id, status, active_weekdays, audience_config)
     VALUES ($1, 'draft', ARRAY[1,2,3,4,5]::smallint[],
       jsonb_build_object('__mcp_campaign_pacing', jsonb_build_object(
         'contact_interval_minutes', NULL, 'inter_message_interval_minutes', 3
       )))`,
    [campaignIdA],
  );
  await db.query(
    `UPDATE public.comm_whatsapp_campaigns
     SET audience_config = jsonb_build_object('__mcp_campaign_pacing', jsonb_build_object('contact_interval_minutes', 5))
     WHERE id = $1`,
    [campaignIdA],
  );

  const result = await db.query(
    "SELECT contact_interval_minutes, inter_message_interval_minutes, audience_config ? '__mcp_campaign_pacing' AS leaked FROM public.comm_whatsapp_campaigns WHERE id = $1",
    [campaignIdA],
  );
  expect(result.rows[0]).toEqual({ contact_interval_minutes: 5, inter_message_interval_minutes: 3, leaked: false });
});

test('duas campanhas no mesmo canal alternam admissões em 9m30 sem passar de 30 cada', async () => {
  await addCampaign(campaignIdA);
  await addCampaign(campaignIdB);
  // Keep one eligible target beyond each 30-contact cap, as in the large
  // October campaigns, so the capped campaign still contributes its share
  // to the sender-wide cadence for the final slot of the other campaign.
  await addTargets(campaignIdA, 1, 31);
  await addTargets(campaignIdB, 101, 31);

  for (let slot = 0; slot < 60; slot += 1) {
    const campaignId = slot % 2 === 0 ? campaignIdA : campaignIdB;
    const targetOffset = slot % 2 === 0 ? 1 : 101;
    const targetIndex = targetOffset + Math.floor(slot / 2);
    const at = new Date(Date.parse(campaignStart) + slot * 9.5 * 60_000).toISOString();
    const reservation = await reserve(campaignId, makeTargetId(targetIndex), at);
    expect(reservation.result, `slot=${slot}; reason=${reservation.reason}; retry_at=${reservation.retry_at}`).toBe('reserved');
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

test('WhatsApp marcado como válido sem permissão comercial comprovada continua bloqueado', async () => {
  await addCampaign(campaignIdA);
  const targetId = makeTargetId(1);
  const phoneDigits = '55500000001';
  await db.query(
    `INSERT INTO public.comm_whatsapp_campaign_targets
      (id, campaign_id, phone_digits, whatsapp_check_status)
     VALUES ($1, $2, $3, 'valid')`,
    [targetId, campaignIdA, phoneDigits],
  );
  await db.query(
    `INSERT INTO public.contact_permission_policies
      (channel, endpoint_normalized, purpose_scope, state)
     VALUES ('whatsapp', $1, 'commercial', 'unknown')`,
    [phoneDigits],
  );

  const result = await reserve(campaignIdA, targetId, campaignStart);

  expect(result.result).toBe('eligibility_blocked');
  expect(result.reason).toBe('contact_permission_unverified');
});

test('edição MCP de texto preserva a mídia da primeira etapa e os quatro balões seguintes', async () => {
  await addCampaign(campaignIdA);
  for (let stepIndex = 0; stepIndex < 5; stepIndex += 1) {
    await db.query(
      `INSERT INTO public.comm_whatsapp_campaign_steps
        (campaign_id, step_index, stage_index, variant_label, step_kind, message_text, media_type, media_url, media_filename)
       VALUES ($1, $2, 0, 'ANY', 'message', $3, $4, $5, $6)`,
      [
        campaignIdA,
        stepIndex,
        `Mensagem sintética ${stepIndex + 1}`,
        stepIndex === 0 ? 'image' : null,
        stepIndex === 0 ? 'storage://whatsapp-campaign-media/uploads/synthetic.png' : null,
        stepIndex === 0 ? 'synthetic.png' : null,
      ],
    );
  }
  const updatedSteps = Array.from({ length: 5 }, (_, stepIndex) => ({
    step_index: stepIndex,
    stage_index: 0,
    variant_label: 'ANY',
    step_kind: 'message',
    message: `Texto editado ${stepIndex + 1}`,
  }));

  await db.query(
    'SELECT public._mcp_comm_whatsapp_campaign_replace_steps($1, $2::jsonb, NULL)',
    [campaignIdA, JSON.stringify(updatedSteps)],
  );
  const { rows } = await db.query(
    'SELECT step_index, media_type, media_url, message_text FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = $1 ORDER BY step_index',
    [campaignIdA],
  );

  expect(rows).toHaveLength(5);
  expect(rows[0]).toMatchObject({
    media_type: 'image',
    media_url: 'storage://whatsapp-campaign-media/uploads/synthetic.png',
    message_text: 'Texto editado 1',
  });
  expect(rows.slice(1).map((row) => row.media_url)).toEqual([null, null, null, null]);
});
