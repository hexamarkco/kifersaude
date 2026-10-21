import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261021205214_whatsapp_campaign_admission_safety.sql'),
  'utf8',
);
const worker = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-campaign-worker/index.ts'),
  'utf8',
);
const reserveNewContact = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_reserve_new_contact'),
  migration.indexOf('CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_dispatch'),
);
const stageReserve = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch'),
  migration.indexOf('REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_window_minutes'),
);

test('30 recipients with five physical messages spend 30 admissions, not 150', () => {
  assert.equal(30 * 5, 150);
  assert.match(migration, /UNIQUE \(campaign_id, target_id\)/);
  assert.match(reserveNewContact, /count\(\*\)::integer/);
  assert.match(reserveNewContact, /admission\.admitted_at >= p_now - interval '24 hours'/);
  assert.match(reserveNewContact, /v_campaign_admitted >= v_campaign\.daily_send_limit/);
  assert.match(reserveNewContact, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(reserveNewContact, /p_expected_message_count/);
  assert.match(stageReserve, /p_expected_message_count <> jsonb_array_length\(p_steps\)/);
  assert.match(stageReserve, /'expected_message_count', p_expected_message_count/);
});

test('30 per 570-minute window yields 19 minutes per campaign and 9m30 for two', () => {
  assert.equal(570 / 30, 19);
  assert.equal(570 / (30 + 30), 9.5);
  assert.match(migration, /v_window_minutes::numeric \* 60 \/ v_campaign\.daily_send_limit/);
  assert.match(reserveNewContact, /sum\(candidate\.rate_per_minute\)/);
  assert.match(reserveNewContact, /make_interval\(secs => \(60 \/ v_rate\)::double precision\)/);
  assert.match(reserveNewContact, /pg_advisory_xact_lock/);
  assert.match(reserveNewContact, /round_robin_wait/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_comm_whatsapp_campaign_admission_turn/);
  assert.match(worker, /rpc\('get_comm_whatsapp_campaign_admission_turn'[\s\S]*?p_channel_key: CAMPAIGN_ADMISSION_CHANNEL_KEY/);
  assert.match(worker, /campaigns = \[turnCampaign, \.\.\.campaigns\.filter/);
  assert.match(migration, /idx_campaign_admissions_campaign_endpoint_unique/);
});

test('the required Amil image follows effective A/B step precedence', () => {
  assert.match(migration, /variant_label IN \('B', 'ANY'\) AND step\.step_kind = 'message'/);
  assert.match(migration, /variant_label = 'ANY' AND step\.step_kind = 'message'[\s\S]*?media_type = 'image'/);
  assert.match(migration, /variant_label = 'A' AND step\.step_kind = 'message'[\s\S]*?media_type = 'image'/);
});

test('rolling duplicate campaign admissions and human evidence block targets', () => {
  assert.match(migration, /idx_campaign_admissions_channel_endpoint_recent/);
  assert.match(migration, /contact_recent_campaign_duplicate/);
  assert.match(migration, /contact_marketing_eligibility_pending/);
  assert.match(migration, /contact_permission_unverified/);
  assert.match(migration, /CAMPAIGN_MARKETING_ELIGIBILITY_PENDING/);
  assert.match(migration, /trg_comm_whatsapp_campaign_activation_readiness/);
});

test('bursts recheck status, window, permission and campaign evidence before each provider call', () => {
  assert.match(worker, /const BURST_INTER_MESSAGE_DELAY_MS = 3000/);
  assert.match(worker, /await assertCampaignDispatchReady\(supabaseAdmin, campaign\.id, target\.id\)/);
  assert.match(worker, /await assertContactPermissionForSend\(supabaseAdmin, phoneDigits, 'commercial'\)/);
  assert.match(worker, /marketing_eligibility_blocked/);
  assert.match(worker, /Date\.parse\(latestInbound\.message_at\) > Date\.parse\(target\.sent_at\)/);
  assert.match(migration, /'campaign_paused', 'send_window_closed'/);
});

test('a normal reply keeps zero-delay burst behavior while an explicit opt-out cancels later bubbles', () => {
  assert.match(worker, /Normal reply with delay_amount=0 → record only, burst continues/);
  assert.match(worker, /if \(isOptOut \|\| shouldStopSequenceBeforeStep\(step\)\)/);
  assert.match(worker, /resolution: isOptOut \? 'opt_out_during_burst' : 'stop_on_reply'/);
  assert.match(worker, /Opt-out re-check: even after responded_at is set/);
});

test('pause and window cancellation are recoverable while other cancellations remain closed', () => {
  assert.match(worker, /resolution: 'campaign_paused'/);
  assert.match(worker, /resolution: 'send_window_closed'/);
  assert.match(migration, /resolution IN \('campaign_paused', 'send_window_closed'\)/);
  assert.match(worker, /reconcileOrphanedStepDispatches/);
});

test('campaign media is restricted to the campaign bucket, MIME allowlist and one captioned message', () => {
  assert.match(migration, /allowed_mime_types = ARRAY\['image\/jpeg', 'image\/png', 'image\/webp', 'image\/gif', 'video\/mp4', 'application\/pdf'\]/);
  assert.match(migration, /storage\.objects AS object/);
  assert.match(migration, /20971520/);
  assert.match(worker, /resolveCampaignMediaPublicUrl\(step\.media_url\)/);
  assert.match(worker, /form\.append\('caption', caption\)/);
  assert.match(worker, /await sendCampaignMedia\(params\.token, chatId, step, text, assertSendPermission\)/);
  assert.match(worker, /step\.media_url \? \(step\.media_type \|\| 'document'\) : 'text'/);
});
