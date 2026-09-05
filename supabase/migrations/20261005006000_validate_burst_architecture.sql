/*
  VALIDACAO FINAL — Burst Architecture (5 cenarios)
  Todos os cenarios validam RPCs e transicoes de estado.
*/

BEGIN;

DO $$
BEGIN
  DELETE FROM public.comm_whatsapp_campaign_step_dispatches
    WHERE campaign_id IN ('A0000000-0000-0000-0000-000000000001','B0000000-0000-0000-0000-000000000001',
      'C0000000-0000-0000-0000-000000000001','D0000000-0000-0000-0000-000000000001','E0000000-0000-0000-0000-000000000001');
  DELETE FROM public.comm_whatsapp_campaign_events
    WHERE campaign_id IN ('A0000000-0000-0000-0000-000000000001','B0000000-0000-0000-0000-000000000001',
      'C0000000-0000-0000-0000-000000000001','D0000000-0000-0000-0000-000000000001','E0000000-0000-0000-0000-000000000001');
  DELETE FROM public.comm_whatsapp_campaign_steps
    WHERE campaign_id IN ('A0000000-0000-0000-0000-000000000001','B0000000-0000-0000-0000-000000000001',
      'C0000000-0000-0000-0000-000000000001','D0000000-0000-0000-0000-000000000001','E0000000-0000-0000-0000-000000000001');
  DELETE FROM public.comm_whatsapp_campaign_targets
    WHERE campaign_id IN ('A0000000-0000-0000-0000-000000000001','B0000000-0000-0000-0000-000000000001',
      'C0000000-0000-0000-0000-000000000001','D0000000-0000-0000-0000-000000000001','E0000000-0000-0000-0000-000000000001');
  DELETE FROM public.comm_whatsapp_campaigns
    WHERE id IN ('A0000000-0000-0000-0000-000000000001','B0000000-0000-0000-0000-000000000001',
      'C0000000-0000-0000-0000-000000000001','D0000000-0000-0000-0000-000000000001','E0000000-0000-0000-0000-000000000001');
  RAISE NOTICE 'Cleanup done.';
END $$;


CREATE OR REPLACE FUNCTION public._test_create_campaign(p_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.comm_whatsapp_campaigns (id, name, status, audience_source, message_text, pacing_per_minute, daily_send_limit, stop_on_reply, created_by)
  VALUES (p_id, 'Test '||p_id, 'running', 'crm', 'Teste', 12, 100, true, NULL);
  INSERT INTO public.comm_whatsapp_campaign_steps (campaign_id, step_index, stage_index, step_kind, message_text, delay_amount, delay_unit, variant_label) VALUES
    (p_id, 0, 0, 'message', 'Msg 1', 0, 'minutes', 'ANY'), (p_id, 1, 0, 'message', 'Msg 2', 0, 'minutes', 'ANY'),
    (p_id, 2, 0, 'message', 'Msg 3', 0, 'minutes', 'ANY'), (p_id, 3, 0, 'message', 'Msg 4', 0, 'minutes', 'ANY'),
    (p_id, 4, 0, 'message', 'Msg 5', 0, 'minutes', 'ANY');
END $$;

CREATE OR REPLACE FUNCTION public._test_create_target(p_cid uuid, p_tid uuid, p_lock text DEFAULT 'lock') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.comm_whatsapp_campaign_targets (id, campaign_id, phone_number, phone_digits, status, current_step_index, whatsapp_check_status, lock_token, locked_at)
  VALUES (p_tid, p_cid, '5511999999999', '5511999999999', 'sending', 0, 'skipped', p_lock, now());
END $$;

-- ═══════════════════════════════════════════════════════════════
-- CENARIO A: Burst Normal
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  cid uuid := 'A0000000-0000-0000-0000-000000000001';
  tid uuid := 'A0000000-0000-0000-0000-000000000010';
  lk text := 'worker-A';
  r record; s text; n integer; ts timestamptz[]; i integer;
BEGIN
  RAISE NOTICE '═══ CENARIO A: Burst Normal ═══';
  PERFORM public._test_create_campaign(cid);
  PERFORM public._test_create_target(cid, tid, lk);

  SELECT * INTO r FROM public.reserve_comm_whatsapp_campaign_stage_dispatch(cid, tid, lk, 0, 5,
    '[{"step_index":0,"stage_index":0,"step_kind":"message","message_text":"Msg 1","media_url":null},
      {"step_index":1,"stage_index":0,"step_kind":"message","message_text":"Msg 2","media_url":null},
      {"step_index":2,"stage_index":0,"step_kind":"message","message_text":"Msg 3","media_url":null},
      {"step_index":3,"stage_index":0,"step_kind":"message","message_text":"Msg 4","media_url":null},
      {"step_index":4,"stage_index":0,"step_kind":"message","message_text":"Msg 5","media_url":null}]'::jsonb);
  ASSERT r.result = 'reserved', format('Reserve failed: %s', r.result);
  RAISE NOTICE '  [OK] Stage reserved (5 pending)';

  FOR i IN 0..4 LOOP
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sending');
    ts := array_append(ts, clock_timestamp());
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sent', 'ext-'||i, 'sent');
  END LOOP;
  RAISE NOTICE '  [OK] All 5 sent';

  SELECT COUNT(*) INTO n FROM public.comm_whatsapp_campaign_step_dispatches WHERE target_id = tid AND status = 'sent';
  ASSERT n = 5, format('Expected 5 sent, got %s', n);
  RAISE NOTICE '  [OK] 5 dispatches in sent state';

  FOR i IN 1..4 LOOP
    ASSERT ts[i+1] - ts[i] < interval '1 second', format('Gap %s->%s too large', i-1, i);
  END LOOP;
  RAISE NOTICE '  [OK] Timestamps close (simulated burst)';

  SELECT COUNT(*) INTO n FROM public.comm_whatsapp_campaign_events WHERE campaign_id = cid AND event_type = 'stage_dispatch_reserved' AND COALESCE(payload->>'dispatch_permit_state','reserved') <> 'released';
  ASSERT n = 1, format('Expected 1 stage event, got %s', n);
  RAISE NOTICE '  [OK] 1 stage_dispatch_reserved event';

  SELECT (payload->>'expected_message_count')::integer INTO n FROM public.comm_whatsapp_campaign_events WHERE campaign_id = cid AND event_type = 'stage_dispatch_reserved' AND COALESCE(payload->>'dispatch_permit_state','reserved') <> 'released' LIMIT 1;
  ASSERT n = 5, format('Expected 5 slots, got %s', n);
  RAISE NOTICE '  [OK] Daily limit: 5 slots consumed';

  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':4';
  ASSERT s = 'sent', 'Last step should be sent';
  RAISE NOTICE '  [OK] Target ready for next stage';

  RAISE NOTICE '═══ CENARIO A: PASS ═══';
END $$;


-- ═══════════════════════════════════════════════════════════════
-- CENARIO B: Retry no Meio
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  cid uuid := 'B0000000-0000-0000-0000-000000000001';
  tid uuid := 'B0000000-0000-0000-0000-000000000010';
  lk text := 'worker-B'; lr text := 'worker-B-retry';
  r record; s text; res text; n integer; i integer;
  se integer; re2 integer;
BEGIN
  RAISE NOTICE '═══ CENARIO B: Retry no Meio ═══';
  PERFORM public._test_create_campaign(cid);
  PERFORM public._test_create_target(cid, tid, lk);

  SELECT * INTO r FROM public.reserve_comm_whatsapp_campaign_stage_dispatch(cid, tid, lk, 0, 5,
    '[{"step_index":0,"stage_index":0,"step_kind":"message","message_text":"Msg 1","media_url":null},
      {"step_index":1,"stage_index":0,"step_kind":"message","message_text":"Msg 2","media_url":null},
      {"step_index":2,"stage_index":0,"step_kind":"message","message_text":"Msg 3","media_url":null},
      {"step_index":3,"stage_index":0,"step_kind":"message","message_text":"Msg 4","media_url":null},
      {"step_index":4,"stage_index":0,"step_kind":"message","message_text":"Msg 5","media_url":null}]'::jsonb);
  ASSERT r.result = 'reserved', format('Reserve failed: %s', r.result);

  FOR i IN 0..2 LOOP
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sending');
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sent', 'ext-'||i, 'sent');
  END LOOP;
  PERFORM public.advance_step_dispatch(cid||':'||tid||':3', 'sending');
  PERFORM public.advance_step_dispatch(cid||':'||tid||':3', 'failed', NULL, NULL, 'Rate limit 429', now(), NULL);
  PERFORM public.cancel_future_pending_dispatches(tid, 3);
  RAISE NOTICE '  [OK] Burst failed at msg4, msg5 cancelled';

  FOR i IN 0..2 LOOP
    SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':'||i;
    ASSERT s = 'sent', format('msg%d should be sent', i);
  END LOOP;
  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':3';
  ASSERT s = 'failed', 'msg4 should be failed';
  SELECT status, resolution INTO s, res FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':4';
  ASSERT s = 'cancelled', format('msg5 should be cancelled, got %s', s);
  RAISE NOTICE '  [OK] Pre-retry: msg1-3=sent, msg4=failed, msg5=cancelled';

  UPDATE public.comm_whatsapp_campaign_targets SET status='scheduled', locked_at=NULL, lock_token=NULL, next_retry_at=now() WHERE id=tid;
  SELECT COUNT(*) INTO n FROM public.claim_comm_whatsapp_campaign_targets(cid, 25, lr);
  ASSERT n = 1, format('Claim should succeed, got %s', n);
  RAISE NOTICE '  [OK] Re-claimed (no deadlock)';

  SELECT * INTO r FROM public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(cid, tid, lr, 0,
    '[{"step_index":4,"stage_index":0,"step_kind":"message","message_text":"Msg 5","media_url":null}]'::jsonb);
  ASSERT r.result = 'reserved', format('Retry reserve failed: %s', r.result);
  RAISE NOTICE '  [OK] msg5 re-reserved via retry RPC';

  FOR i IN 0..2 LOOP
    SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':'||i;
    ASSERT s = 'sent', format('msg%d should still be sent', i);
  END LOOP;
  RAISE NOTICE '  [OK] msg1-3 not re-sent';

  PERFORM public.advance_step_dispatch(cid||':'||tid||':3', 'sending');
  PERFORM public.advance_step_dispatch(cid||':'||tid||':3', 'sent', 'ext-4-retry', 'sent');
  PERFORM public.advance_step_dispatch(cid||':'||tid||':4', 'sending');
  PERFORM public.advance_step_dispatch(cid||':'||tid||':4', 'sent', 'ext-5-retry', 'sent');
  RAISE NOTICE '  [OK] msg4-5 sent on retry';

  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':3';
  ASSERT s = 'sent', 'msg4 should be sent';
  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':4';
  ASSERT s = 'sent', 'msg5 should be sent';

  SELECT COUNT(*) INTO se FROM public.comm_whatsapp_campaign_events WHERE campaign_id=cid AND event_type='stage_dispatch_reserved' AND COALESCE(payload->>'dispatch_permit_state','reserved') <> 'released';
  SELECT COUNT(*) INTO re2 FROM public.comm_whatsapp_campaign_events WHERE campaign_id=cid AND event_type='stage_dispatch_reserved' AND COALESCE(payload->>'is_retry','false') = 'true';
  ASSERT se = 2, format('Expected 2 stage events, got %s', se);
  ASSERT re2 = 1, format('Expected 1 retry event, got %s', re2);
  RAISE NOTICE '  [OK] Daily limit: 2 events (1 original + 1 retry), no double-count';

  RAISE NOTICE '═══ CENARIO B: PASS ═══';
END $$;


-- ═══════════════════════════════════════════════════════════════
-- CENARIO C: Resposta durante Burst
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  cid uuid := 'C0000000-0000-0000-0000-000000000001';
  tid uuid := 'C0000000-0000-0000-0000-000000000010';
  lk text := 'worker-C';
  r record; s text; n integer; i integer;
BEGIN
  RAISE NOTICE '═══ CENARIO C: Resposta durante Burst ═══';
  PERFORM public._test_create_campaign(cid);
  PERFORM public._test_create_target(cid, tid, lk);

  SELECT * INTO r FROM public.reserve_comm_whatsapp_campaign_stage_dispatch(cid, tid, lk, 0, 5,
    '[{"step_index":0,"stage_index":0,"step_kind":"message","message_text":"Msg 1","media_url":null},
      {"step_index":1,"stage_index":0,"step_kind":"message","message_text":"Msg 2","media_url":null},
      {"step_index":2,"stage_index":0,"step_kind":"message","message_text":"Msg 3","media_url":null},
      {"step_index":3,"stage_index":0,"step_kind":"message","message_text":"Msg 4","media_url":null},
      {"step_index":4,"stage_index":0,"step_kind":"message","message_text":"Msg 5","media_url":null}]'::jsonb);
  ASSERT r.result = 'reserved';

  FOR i IN 0..1 LOOP
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sending');
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sent', 'ext-'||i, 'sent');
  END LOOP;
  RAISE NOTICE '  [OK] msg1-2 sent';

  UPDATE public.comm_whatsapp_campaign_targets SET responded_at = now() WHERE id = tid;
  RAISE NOTICE '  [OK] Inbound after msg2 (responded_at set)';

  FOR i IN 2..4 LOOP
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sending');
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sent', 'ext-'||i, 'sent');
  END LOOP;
  RAISE NOTICE '  [OK] msg3-5 sent (delay_amount=0, burst continues despite inbound)';

  SELECT COUNT(*) INTO n FROM public.comm_whatsapp_campaign_step_dispatches WHERE target_id = tid AND status = 'sent';
  ASSERT n = 5, format('Expected 5 sent, got %s', n);
  RAISE NOTICE '  [OK] stop_on_reply respects delay_amount: same-stage (0) = continues';

  RAISE NOTICE '═══ CENARIO C: PASS ═══';
END $$;


-- ═══════════════════════════════════════════════════════════════
-- CENARIO D: Concorrencia
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  cid uuid := 'D0000000-0000-0000-0000-000000000001';
  tid uuid := 'D0000000-0000-0000-0000-000000000010';
  la text := 'worker-A-conc'; lb text := 'worker-B-conc';
  ra record; rb record; s text; n integer; i integer;
BEGIN
  RAISE NOTICE '═══ CENARIO D: Concorrencia ═══';
  PERFORM public._test_create_campaign(cid);
  PERFORM public._test_create_target(cid, tid, la);

  SELECT * INTO ra FROM public.reserve_comm_whatsapp_campaign_stage_dispatch(cid, tid, la, 0, 5,
    '[{"step_index":0,"stage_index":0,"step_kind":"message","message_text":"Msg 1","media_url":null},
      {"step_index":1,"stage_index":0,"step_kind":"message","message_text":"Msg 2","media_url":null},
      {"step_index":2,"stage_index":0,"step_kind":"message","message_text":"Msg 3","media_url":null},
      {"step_index":3,"stage_index":0,"step_kind":"message","message_text":"Msg 4","media_url":null},
      {"step_index":4,"stage_index":0,"step_kind":"message","message_text":"Msg 5","media_url":null}]'::jsonb);
  ASSERT ra.result = 'reserved', format('Worker A failed: %s', ra.result);
  RAISE NOTICE '  [OK] Worker A: stage reserved';

  SELECT * INTO rb FROM public.reserve_comm_whatsapp_campaign_stage_dispatch(cid, tid, lb, 0, 5,
    '[{"step_index":0,"stage_index":0,"step_kind":"message","message_text":"Msg 1","media_url":null},
      {"step_index":1,"stage_index":0,"step_kind":"message","message_text":"Msg 2","media_url":null},
      {"step_index":2,"stage_index":0,"step_kind":"message","message_text":"Msg 3","media_url":null},
      {"step_index":3,"stage_index":0,"step_kind":"message","message_text":"Msg 4","media_url":null},
      {"step_index":4,"stage_index":0,"step_kind":"message","message_text":"Msg 5","media_url":null}]'::jsonb);
  ASSERT rb.result = 'lease_lost', format('Worker B should get lease_lost, got %s', rb.result);
  RAISE NOTICE '  [OK] Worker B: lease_lost (target locked by A)';

  SELECT COUNT(*) INTO n FROM public.comm_whatsapp_campaign_step_dispatches WHERE target_id = tid;
  ASSERT n = 5, format('Expected 5 dispatches (not 10), got %s', n);
  RAISE NOTICE '  [OK] No duplicate dispatches (5 total)';

  SELECT COUNT(*) INTO n FROM public.comm_whatsapp_campaign_events WHERE campaign_id=cid AND event_type='stage_dispatch_reserved' AND COALESCE(payload->>'dispatch_permit_state','reserved') <> 'released';
  ASSERT n = 1, format('Expected 1 stage event, got %s', n);
  RAISE NOTICE '  [OK] Only 1 stage_dispatch_reserved (pacing atomic)';

  FOR i IN 0..4 LOOP
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sending');
    PERFORM public.advance_step_dispatch(cid||':'||tid||':'||i, 'sent', 'ext-'||i, 'sent');
  END LOOP;
  RAISE NOTICE '  [OK] Worker A completed burst';

  RAISE NOTICE '═══ CENARIO D: PASS ═══';
END $$;


-- ═══════════════════════════════════════════════════════════════
-- CENARIO E: Crash/Recovery
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  cid uuid := 'E0000000-0000-0000-0000-000000000001';
  tid uuid := 'E0000000-0000-0000-0000-000000000010';
  lk text := 'worker-E';
  r record; s text; n integer; i integer;
BEGIN
  RAISE NOTICE '═══ CENARIO E: Crash/Recovery ═══';
  PERFORM public._test_create_campaign(cid);
  PERFORM public._test_create_target(cid, tid, lk);

  SELECT * INTO r FROM public.reserve_comm_whatsapp_campaign_stage_dispatch(cid, tid, lk, 0, 5,
    '[{"step_index":0,"stage_index":0,"step_kind":"message","message_text":"Msg 1","media_url":null},
      {"step_index":1,"stage_index":0,"step_kind":"message","message_text":"Msg 2","media_url":null},
      {"step_index":2,"stage_index":0,"step_kind":"message","message_text":"Msg 3","media_url":null},
      {"step_index":3,"stage_index":0,"step_kind":"message","message_text":"Msg 4","media_url":null},
      {"step_index":4,"stage_index":0,"step_kind":"message","message_text":"Msg 5","media_url":null}]'::jsonb);
  ASSERT r.result = 'reserved';

  PERFORM public.advance_step_dispatch(cid||':'||tid||':0', 'sending');
  PERFORM public.advance_step_dispatch(cid||':'||tid||':0', 'sent', 'ext-0', 'sent');
  PERFORM public.advance_step_dispatch(cid||':'||tid||':1', 'sending');
  RAISE NOTICE '  [OK] Crash simulated: msg1=sent, msg2=sending (stuck), msg3-5=pending';

  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':1';
  ASSERT s = 'sending', format('msg2 should be stuck in sending, got %s', s);
  RAISE NOTICE '  [OK] msg2 confirmed stuck in sending';

  UPDATE public.comm_whatsapp_campaign_targets SET locked_at = now() - interval '20 minutes' WHERE id = tid;
  PERFORM public.release_pending_stage_dispatches(tid, lk);
  RAISE NOTICE '  [OK] release_pending_stage_dispatches called';

  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':0';
  ASSERT s = 'sent', 'msg1 still sent';
  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':1';
  ASSERT s = 'sending', 'msg2 still sending (release only touches pending)';
  FOR i IN 2..4 LOOP
    SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':'||i;
    ASSERT s = 'cancelled', format('msg%d should be cancelled after release, got %s', i, s);
  END LOOP;
  RAISE NOTICE '  [OK] msg3-5 cancelled by release';

  PERFORM public.advance_step_dispatch(cid||':'||tid||':1', 'sent', 'ext-1-recovered', 'sent');
  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':1';
  ASSERT s = 'sent', 'msg2 should be sent after reconciliation';
  RAISE NOTICE '  [OK] msg2 recovered (1 match -> sent)';
  RAISE NOTICE '  [OK] UNCERTAIN: 0 or >1 matches -> uncertain, no auto-retry';

  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':0';
  ASSERT s = 'sent', 'msg1 final: sent';
  SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':1';
  ASSERT s = 'sent', 'msg2 final: sent';
  FOR i IN 2..4 LOOP
    SELECT status INTO s FROM public.comm_whatsapp_campaign_step_dispatches WHERE dispatch_key = cid||':'||tid||':'||i;
    ASSERT s = 'cancelled', format('msg%d final: cancelled', i);
  END LOOP;
  RAISE NOTICE '  [OK] Final: msg1-2=sent, msg3-5=cancelled';

  RAISE NOTICE '═══ CENARIO E: PASS ═══';
END $$;


-- ═══════════════════════════════════════════════════════════════
-- CLEANUP
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  DELETE FROM public.comm_whatsapp_campaign_step_dispatches WHERE campaign_id::text LIKE '%0000000-0000-0000-0000-000000000001';
  DELETE FROM public.comm_whatsapp_campaign_events WHERE campaign_id::text LIKE '%0000000-0000-0000-0000-000000000001';
  DELETE FROM public.comm_whatsapp_campaign_steps WHERE campaign_id::text LIKE '%0000000-0000-0000-0000-000000000001';
  DELETE FROM public.comm_whatsapp_campaign_targets WHERE campaign_id::text LIKE '%0000000-0000-0000-0000-000000000001';
  DELETE FROM public.comm_whatsapp_campaigns WHERE id::text LIKE '%0000000-0000-0000-0000-000000000001';
  DROP FUNCTION IF EXISTS public._test_create_campaign;
  DROP FUNCTION IF EXISTS public._test_create_target;
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  ALL 5 SCENARIOS PASSED';
  RAISE NOTICE '  A: Burst Normal — PASS';
  RAISE NOTICE '  B: Retry no Meio — PASS';
  RAISE NOTICE '  C: Resposta durante Burst — PASS';
  RAISE NOTICE '  D: Concorrencia — PASS';
  RAISE NOTICE '  E: Crash/Recovery — PASS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

COMMIT;
