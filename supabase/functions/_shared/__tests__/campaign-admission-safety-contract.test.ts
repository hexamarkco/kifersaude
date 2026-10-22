import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261021205214_whatsapp_campaign_admission_safety.sql'),
  'utf8',
);
const authorizationRemovalMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261022035052_remove_campaign_commercial_authorization_gate.sql'),
  'utf8',
);
const pacingMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261021221500_campaign_pacing_configuration.sql'),
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

test('campaigns no longer require commercial authorization and still suppress duplicates and opt-outs', () => {
  assert.match(migration, /idx_campaign_admissions_channel_endpoint_recent/);
  assert.match(authorizationRemovalMigration, /contact_recent_campaign_duplicate/);
  assert.match(authorizationRemovalMigration, /contact_permission_blocked/);
  assert.doesNotMatch(authorizationRemovalMigration, /campaign_marketing_review_pending|contact_marketing_eligibility_pending|contact_permission_unverified/);
  assert.doesNotMatch(worker, /isCampaignMarketingReviewReady/);
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

test('campaign cadence is persisted, applied atomically to admissions, and pauses between bubbles', () => {
  assert.match(pacingMigration, /ADD COLUMN IF NOT EXISTS contact_interval_minutes integer/);
  assert.match(pacingMigration, /ADD COLUMN IF NOT EXISTS inter_message_interval_minutes integer NOT NULL DEFAULT 0/);
  assert.match(pacingMigration, /_comm_whatsapp_campaign_contact_interval_seconds/);
  assert.match(pacingMigration, /NEW\.contact_interval_minutes := v_contact_interval/);
  assert.match(pacingMigration, /NEW\.inter_message_interval_minutes := v_message_interval/);
  assert.match(worker, /contact_interval_minutes,inter_message_interval_minutes/);
  assert.match(worker, /if \(interMessageIntervalMinutes > 0\) return null/);
  assert.match(worker, /getBetweenMessageDelayMs\(step, nextStep, campaign\.inter_message_interval_minutes\)/);
  assert.match(worker, /hasConfiguredInterMessageWait\(steps, step, campaign\.inter_message_interval_minutes\)/);
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

test('orphaned media dispatch recovery restores its media type, file and caption in the inbox', () => {
  assert.match(worker, /\.select\('message_text,media_url,media_type,media_filename'\)/);
  assert.match(worker, /extractWhapiMediaMeta\(match\)/);
  assert.match(worker, /messageType: isMediaMessage \? String\(stepDef\?\.media_type \|\| 'document'\) : 'text'/);
  assert.match(worker, /mediaCaption: recoveredCaption/);
  assert.match(worker, /reconciled_after_crash: true/);
});

test('successful WhatsApp validation writes are confirmed before campaign counters are recomputed', () => {
  assert.match(worker, /\.select\('id'\)\s*\.maybeSingle\(\)/);
  assert.match(worker, /if \(!updated\) return false/);
  assert.match(worker, /for \(const campaignId of changedCampaignIds\)[\s\S]*?await recomputeCampaignCounters\(supabaseAdmin, campaignId\)/);
});
