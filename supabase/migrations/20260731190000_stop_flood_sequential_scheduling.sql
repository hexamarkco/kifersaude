/*
  Stop automation floods: sequential-only scheduling support + cleanup

  1. Unique partial index on active jobs (lead_id, flow_id, step_order) so the
     sequential chaining in the edge function can never double-schedule a step.
  2. Collapses the "Abordagem dos leads" burst (3 send steps, delay 0) into a
     single multi-message step (step.messages[]), keeping the update_status step.
  3. One-time operational rule: leads without an active WhatsApp chat are moved
     to "Perdido" (except Converted leads, leads with contracts, archived leads,
     and leads created in the last 48h).
*/

-- 1. Dedupe any active job duplicates (keep the most recent), then guard
DELETE FROM public.auto_contact_flow_jobs a
USING public.auto_contact_flow_jobs b
WHERE a.id <> b.id
  AND a.lead_id = b.lead_id
  AND a.flow_id = b.flow_id
  AND a.step_order = b.step_order
  AND a.status IN ('pending', 'processing')
  AND b.status IN ('pending', 'processing')
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_auto_contact_flow_jobs_active_step
  ON public.auto_contact_flow_jobs (lead_id, flow_id, step_order)
  WHERE status IN ('pending', 'processing');


-- 2. Collapse "Abordagem dos leads" burst into one multi-message step
DO $$
DECLARE
  v_settings jsonb;
  v_flows jsonb;
  v_flow jsonb;
  v_steps jsonb;
  v_send_steps jsonb;
  v_first_step jsonb;
  v_messages jsonb;
  v_step jsonb;
  v_rest jsonb;
  v_flow_idx int;
  v_step_idx int;
  v_changed boolean := false;
BEGIN
  SELECT settings INTO v_settings
  FROM public.integration_settings
  WHERE slug = 'whatsapp_auto_contact';

  IF v_settings IS NULL THEN
    RETURN;
  END IF;

  v_flows := COALESCE(v_settings->'flows', '[]'::jsonb);

  FOR v_flow_idx IN 0 .. jsonb_array_length(v_flows) - 1
  LOOP
    v_flow := v_flows->v_flow_idx;
    IF v_flow->>'name' <> 'Abordagem dos leads' THEN
      CONTINUE;
    END IF;

    v_steps := COALESCE(v_flow->'steps', '[]'::jsonb);
    v_send_steps := '[]'::jsonb;
    v_rest := '[]'::jsonb;

    FOR v_step_idx IN 0 .. jsonb_array_length(v_steps) - 1
    LOOP
      v_step := v_steps->v_step_idx;
      IF v_step->>'actionType' = 'send_message'
         AND COALESCE(NULLIF(v_step->>'delayValue', '')::numeric, 0) = 0
      THEN
        v_send_steps := v_send_steps || jsonb_build_array(v_step);
      ELSE
        v_rest := v_rest || jsonb_build_array(v_step);
      END IF;
    END LOOP;

    IF jsonb_array_length(v_send_steps) <= 1 THEN
      CONTINUE;
    END IF;

    v_first_step := v_send_steps->0;
    v_messages := '[]'::jsonb;
    FOR v_step_idx IN 0 .. jsonb_array_length(v_send_steps) - 1
    LOOP
      v_step := v_send_steps->v_step_idx;
      v_messages := v_messages || jsonb_build_object(
        'custom', jsonb_build_object(
          'type', COALESCE(v_step->'customMessage'->>'type', 'text'),
          'text', COALESCE(v_step->'customMessage'->>'text', ''),
          'mediaUrl', COALESCE(v_step->'customMessage'->>'mediaUrl', ''),
          'caption', COALESCE(v_step->'customMessage'->>'caption', ''),
          'filename', COALESCE(v_step->'customMessage'->>'filename', '')
        )
      )::jsonb;
    END LOOP;

    v_first_step := jsonb_set(v_first_step, ARRAY['messages'], v_messages, true);
    v_first_step := jsonb_set(v_first_step, ARRAY['delayValue'], '0'::jsonb, true);
    v_first_step := jsonb_set(v_first_step, ARRAY['delayUnit'], '"seconds"'::jsonb, true);

    v_steps := jsonb_build_array(v_first_step) || v_rest;
    v_flow := jsonb_set(v_flow, ARRAY['steps'], v_steps, true);
    v_flows := jsonb_set(v_flows, ARRAY[v_flow_idx::text], v_flow, true);
    v_changed := true;
  END LOOP;

  IF v_changed THEN
    v_settings := jsonb_set(COALESCE(v_settings, '{}'::jsonb), ARRAY['flows'], v_flows, true);
    UPDATE public.integration_settings
    SET settings = v_settings, updated_at = now()
    WHERE slug = 'whatsapp_auto_contact';
    RAISE NOTICE 'Abordagem dos leads collapsed into a multi-message step.';
  ELSE
    RAISE NOTICE 'Abordagem dos leads already collapsed or not found.';
  END IF;
END $$;


-- 3. One-time sweep: leads without active chat -> Perdido
DO $$
DECLARE
  v_perdido_id uuid;
  v_convertido_id uuid;
  v_count integer;
BEGIN
  SELECT id INTO v_perdido_id FROM public.lead_status_config WHERE nome = 'Perdido' LIMIT 1;
  SELECT id INTO v_convertido_id FROM public.lead_status_config WHERE nome = 'Convertido' LIMIT 1;

  IF v_perdido_id IS NULL THEN
    RAISE NOTICE 'Status Perdido nao encontrado; sweep skipped.';
    RETURN;
  END IF;

  UPDATE public.leads l
  SET status_id = v_perdido_id,
      updated_at = now()
  WHERE NOT EXISTS (
        SELECT 1 FROM public.comm_whatsapp_chats c
        WHERE c.lead_id = l.id AND c.deleted_at IS NULL
      )
    AND COALESCE(l.status, '') <> 'Convertido'
    AND (v_convertido_id IS NULL OR l.status_id IS DISTINCT FROM v_convertido_id)
    AND NOT EXISTS (
        SELECT 1 FROM public.contracts ct WHERE ct.lead_id = l.id
      )
    AND l.arquivado = false
    AND l.created_at <= now() - interval '48 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Sweep: % lead(s) moved to Perdido (sem chat ativo).', v_count;
END $$;
