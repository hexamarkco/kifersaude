/*
  Test: Burst retry after failure in msg4

  Scenario:
  - Stage with 5 messages (step_index 0-4, stage_index 0)
  - msg1 → sent, msg2 → sent, msg3 → sent
  - msg4 → failed retryable (429 rate limit)
  - msg5 pending → cancelled by cancelFuturePendingDispatches
  - Target released → re-claimed
  - msg4 retry → sent
  - msg5 retry → re-reserved and sent
  - msg1-3 NOT re-sent

  Expected states after initial burst:
    msg1: sent (external_message_id present)
    msg2: sent (external_message_id present)
    msg3: sent (external_message_id present)
    msg4: failed (next_retry_at = now + 5min)
    msg5: cancelled (resolution = 'future_pending_after_failure')

  Expected states after retry:
    msg1: sent (unchanged)
    msg2: sent (unchanged)
    msg3: sent (unchanged)
    msg4: sent (external_message_id present)
    msg5: sent (external_message_id present)

  Daily limit:
    - After initial burst: 1 stage_dispatch_reserved event (count=5)
    - After retry: 1 more stage_dispatch_reserved event (is_retry=true)
    - Daily limit check SKIPPED on retry (slots already consumed)
*/

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- Setup: Create test campaign, steps, and target
-- ═══════════════════════════════════════════════════════════════

-- Campaign
INSERT INTO public.comm_whatsapp_campaigns (
  id, name, status, audience_source, message_text,
  pacing_per_minute, daily_send_limit, stop_on_reply,
  created_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Burst Retry',
  'running',
  'crm',
  'Mensagem teste',
  12,
  100,
  true,
  NULL
);

-- Steps: 5 messages in same stage (stage_index=0)
INSERT INTO public.comm_whatsapp_campaign_steps (
  campaign_id, step_index, stage_index, step_kind,
  message_text, delay_amount, delay_unit, variant_label
) VALUES
  ('00000000-0000-0000-0000-000000000001', 0, 0, 'message', 'Msg 1', 0, 'minutes', 'ANY'),
  ('00000000-0000-0000-0000-000000000001', 1, 0, 'message', 'Msg 2', 0, 'minutes', 'ANY'),
  ('00000000-0000-0000-0000-000000000001', 2, 0, 'message', 'Msg 3', 0, 'minutes', 'ANY'),
  ('00000000-0000-0000-0000-000000000001', 3, 0, 'message', 'Msg 4', 0, 'minutes', 'ANY'),
  ('00000000-0000-0000-0000-000000000001', 4, 0, 'message', 'Msg 5', 0, 'minutes', 'ANY');

-- Target (simulate claimed state: status=sending, lock_token set)
INSERT INTO public.comm_whatsapp_campaign_targets (
  id, campaign_id, phone_number, phone_digits,
  status, current_step_index, whatsapp_check_status,
  lock_token, locked_at
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '5511999999999',
  '5511999999999',
  'sending',
  0,
  'skipped',
  'test-lock-token',
  now()
);

-- ═══════════════════════════════════════════════════════════════
-- Step 1: Reserve stage (all 5 as pending)
-- ═══════════════════════════════════════════════════════════════

SELECT public.reserve_comm_whatsapp_campaign_stage_dispatch(
  p_campaign_id := '00000000-0000-0000-0000-000000000001',
  p_target_id := '00000000-0000-0000-0000-000000000010',
  p_lock_token := 'test-lock-token',
  p_stage_index := 0,
  p_expected_message_count := 5,
  p_steps := '[
    {"step_index": 0, "stage_index": 0, "step_kind": "message", "message_text": "Msg 1", "media_url": null},
    {"step_index": 1, "stage_index": 0, "step_kind": "message", "message_text": "Msg 2", "media_url": null},
    {"step_index": 2, "stage_index": 0, "step_kind": "message", "message_text": "Msg 3", "media_url": null},
    {"step_index": 3, "stage_index": 0, "step_kind": "message", "message_text": "Msg 4", "media_url": null},
    {"step_index": 4, "stage_index": 0, "step_kind": "message", "message_text": "Msg 5", "media_url": null}
  ]'::jsonb
);

-- Verify: all 5 dispatches as pending
DO $$
DECLARE
  v_pending_count integer;
BEGIN
  SELECT COUNT(*) INTO v_pending_count
  FROM public.comm_whatsapp_campaign_step_dispatches
  WHERE target_id = '00000000-0000-0000-0000-000000000010'
    AND status = 'pending';

  ASSERT v_pending_count = 5,
    format('Expected 5 pending dispatches, got %s', v_pending_count);

  RAISE NOTICE 'Step 1 OK: 5 dispatches reserved as pending';
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Step 2: Simulate burst (msg1-3 sent, msg4 failed)
-- ═══════════════════════════════════════════════════════════════

-- msg1: pending → sending → sent
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:0', 'sending');
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:0', 'sent', 'ext-msg-001', 'sent');

-- msg2: pending → sending → sent
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:1', 'sending');
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:1', 'sent', 'ext-msg-002', 'sent');

-- msg3: pending → sending → sent
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:2', 'sending');
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:2', 'sent', 'ext-msg-003', 'sent');

-- msg4: pending → sending → failed (retryable, 429)
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:3', 'sending');
SELECT public.advance_step_dispatch(
  '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:3',
  'failed',
  NULL,
  NULL,
  'Rate limit 429',
  now(),  -- next_retry_at = now() so claim can pick it up immediately
  NULL
);

-- msg5: cancel future pending
SELECT public.cancel_future_pending_dispatches(
  '00000000-0000-0000-0000-000000000010',
  3  -- after step_index 3
);

-- ═══════════════════════════════════════════════════════════════
-- Step 3: Verify states after failure
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_msg1_status text;
  v_msg2_status text;
  v_msg3_status text;
  v_msg4_status text;
  v_msg5_status text;
  v_msg4_retry_at timestamptz;
  v_msg5_resolution text;
BEGIN
  SELECT status INTO v_msg1_status FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:0';
  SELECT status INTO v_msg2_status FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:1';
  SELECT status INTO v_msg3_status FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:2';
  SELECT status, next_retry_at INTO v_msg4_status, v_msg4_retry_at FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:3';
  SELECT status, resolution INTO v_msg5_status, v_msg5_resolution FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:4';

  ASSERT v_msg1_status = 'sent', format('msg1: expected sent, got %s', v_msg1_status);
  ASSERT v_msg2_status = 'sent', format('msg2: expected sent, got %s', v_msg2_status);
  ASSERT v_msg3_status = 'sent', format('msg3: expected sent, got %s', v_msg3_status);
  ASSERT v_msg4_status = 'failed', format('msg4: expected failed, got %s', v_msg4_status);
  ASSERT v_msg4_retry_at IS NOT NULL, 'msg4: next_retry_at should be set';
  ASSERT v_msg5_status = 'cancelled', format('msg5: expected cancelled, got %s', v_msg5_status);
  ASSERT v_msg5_resolution = 'future_pending_after_failure',
    format('msg5: expected resolution future_pending_after_failure, got %s', v_msg5_resolution);

  RAISE NOTICE 'Step 3 OK: msg1-3 sent, msg4 failed with retry_at, msg5 cancelled';
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Step 4: Verify claim can proceed (no deadlock)
-- ═══════════════════════════════════════════════════════════════

-- Release target (simulate burst exit, set retry_at to now so claim can pick it up)
UPDATE public.comm_whatsapp_campaign_targets
SET status = 'scheduled',
    locked_at = NULL,
    lock_token = NULL,
    next_retry_at = now()
WHERE id = '00000000-0000-0000-0000-000000000010';

-- Try to claim — should succeed because retry is due
DO $$
DECLARE
  v_claimed_count integer;
BEGIN
  SELECT COUNT(*) INTO v_claimed_count
  FROM public.claim_comm_whatsapp_campaign_targets(
    '00000000-0000-0000-0000-000000000001',
    25,
    'test-lock-token-retry'
  );

  ASSERT v_claimed_count = 1,
    format('Expected 1 claimed target, got %s', v_claimed_count);

  RAISE NOTICE 'Step 4 OK: Target re-claimed for retry (no deadlock)';
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Step 5: Simulate retry (msg4 → sent, msg5 → re-reserved → sent)
-- ═══════════════════════════════════════════════════════════════

-- Re-reserve msg5 (was cancelled, now pending again via retry reservation)
SELECT public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(
  p_campaign_id := '00000000-0000-0000-0000-000000000001',
  p_target_id := '00000000-0000-0000-0000-000000000010',
  p_lock_token := 'test-lock-token-retry',
  p_stage_index := 0,
  p_steps := '[
    {"step_index": 4, "stage_index": 0, "step_kind": "message", "message_text": "Msg 5", "media_url": null}
  ]'::jsonb
);

-- msg4 retry: failed → sending → sent
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:3', 'sending');
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:3', 'sent', 'ext-msg-004-retry', 'sent');

-- msg5 retry: pending → sending → sent
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:4', 'sending');
SELECT public.advance_step_dispatch('00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:4', 'sent', 'ext-msg-005-retry', 'sent');

-- ═══════════════════════════════════════════════════════════════
-- Step 6: Verify final states
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_msg1_status text;
  v_msg1_ext_id text;
  v_msg2_status text;
  v_msg2_ext_id text;
  v_msg3_status text;
  v_msg3_ext_id text;
  v_msg4_status text;
  v_msg4_ext_id text;
  v_msg5_status text;
  v_msg5_ext_id text;
BEGIN
  SELECT status, external_message_id INTO v_msg1_status, v_msg1_ext_id FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:0';
  SELECT status, external_message_id INTO v_msg2_status, v_msg2_ext_id FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:1';
  SELECT status, external_message_id INTO v_msg3_status, v_msg3_ext_id FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:2';
  SELECT status, external_message_id INTO v_msg4_status, v_msg4_ext_id FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:3';
  SELECT status, external_message_id INTO v_msg5_status, v_msg5_ext_id FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE dispatch_key = '00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000010:4';

  -- msg1-3: unchanged (sent with original external_message_ids)
  ASSERT v_msg1_status = 'sent', format('msg1: expected sent, got %s', v_msg1_status);
  ASSERT v_msg1_ext_id = 'ext-msg-001', format('msg1: ext_id should not change, got %s', v_msg1_ext_id);
  ASSERT v_msg2_status = 'sent', format('msg2: expected sent, got %s', v_msg2_status);
  ASSERT v_msg2_ext_id = 'ext-msg-002', format('msg2: ext_id should not change, got %s', v_msg2_ext_id);
  ASSERT v_msg3_status = 'sent', format('msg3: expected sent, got %s', v_msg3_status);
  ASSERT v_msg3_ext_id = 'ext-msg-003', format('msg3: ext_id should not change, got %s', v_msg3_ext_id);

  -- msg4: now sent with retry external_message_id
  ASSERT v_msg4_status = 'sent', format('msg4: expected sent, got %s', v_msg4_status);
  ASSERT v_msg4_ext_id = 'ext-msg-004-retry', format('msg4: ext_id should be retry one, got %s', v_msg4_ext_id);

  -- msg5: now sent with retry external_message_id
  ASSERT v_msg5_status = 'sent', format('msg5: expected sent, got %s', v_msg5_status);
  ASSERT v_msg5_ext_id = 'ext-msg-005-retry', format('msg5: ext_id should be retry one, got %s', v_msg5_ext_id);

  RAISE NOTICE 'Step 6 OK: All 5 messages sent, msg1-3 unchanged, msg4-5 with retry ids';
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Step 7: Verify daily limit (retry should not over-count)
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_stage_events integer;
  v_retry_events integer;
  v_total_dispatches integer;
BEGIN
  -- Count stage_dispatch_reserved events
  SELECT COUNT(*) INTO v_stage_events FROM public.comm_whatsapp_campaign_events
  WHERE campaign_id = '00000000-0000-0000-0000-000000000001'
    AND event_type = 'stage_dispatch_reserved'
    AND COALESCE(payload->>'dispatch_permit_state', 'reserved') <> 'released';

  -- Count retry events
  SELECT COUNT(*) INTO v_retry_events FROM public.comm_whatsapp_campaign_events
  WHERE campaign_id = '00000000-0000-0000-0000-000000000001'
    AND event_type = 'stage_dispatch_reserved'
    AND COALESCE(payload->>'is_retry', 'false') = 'true';

  -- Count actual dispatches (sent only)
  SELECT COUNT(*) INTO v_total_dispatches FROM public.comm_whatsapp_campaign_step_dispatches
  WHERE target_id = '00000000-0000-0000-0000-000000000010'
    AND status = 'sent';

  ASSERT v_stage_events = 2,
    format('Expected 2 stage_dispatch_reserved events (original + retry), got %s', v_stage_events);
  ASSERT v_retry_events = 1,
    format('Expected 1 retry event, got %s', v_retry_events);
  ASSERT v_total_dispatches = 5,
    format('Expected 5 sent dispatches, got %s', v_total_dispatches);

  RAISE NOTICE 'Step 7 OK: 2 stage events (1 original + 1 retry), 5 sent dispatches';
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Cleanup
-- ═══════════════════════════════════════════════════════════════

DELETE FROM public.comm_whatsapp_campaign_step_dispatches
  WHERE campaign_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.comm_whatsapp_campaign_events
  WHERE campaign_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.comm_whatsapp_campaign_steps
  WHERE campaign_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.comm_whatsapp_campaign_targets
  WHERE campaign_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.comm_whatsapp_campaigns
  WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$ BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'ALL TESTS PASSED: Burst retry scenario validated';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;
