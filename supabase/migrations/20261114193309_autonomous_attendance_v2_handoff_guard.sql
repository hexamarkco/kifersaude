-- Local proposal. No data/configuration rewrite and no historical migration edits.
BEGIN;

CREATE OR REPLACE FUNCTION public.ai_autonomous_qualification_can_complete(p_state jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_q jsonb; v_f jsonb; v_lives jsonb; v_life jsonb; v_count integer; v_field text;
  v_intent text; v_company text; v_current text; v_required text[];
BEGIN
  IF p_state ? 'attendanceV2' THEN
    v_q := p_state->'attendanceV2'; v_f := v_q->'facts';
    IF v_q->>'version' IS DISTINCT FROM '2' OR v_q->>'policyVersion' IS DISTINCT FROM '2026-11-14'
      OR jsonb_typeof(v_f) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    v_intent := v_f->'intent'->>'value';
    IF v_intent IS NULL OR v_intent NOT IN ('first_plan','replace_operator','reduce_cost','expand_network',
      'upgrade','downgrade','pf_to_mei','add_dependents','portability','defined_choice','guided_choice') THEN RETURN false; END IF;
    -- Product-specific eligibility/network/portability is never authorized by an LLM.
    IF v_intent IN ('pf_to_mei','portability','expand_network') OR v_f->'companyPresence'->>'value' = 'yes'
      OR v_f->'targetModality'->>'value' IN ('mei','company') THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(v_f) AS facts WHERE facts.value->>'status' = 'conflict') THEN RETURN false; END IF;
    IF jsonb_typeof(v_f->'preferences'->'value') = 'array' AND jsonb_array_length(v_f->'preferences'->'value') > 0 THEN RETURN false; END IF;
    v_required := ARRAY['intent','goal','beneficiaryCount','beneficiaries','city','state'];
    IF v_intent <> 'first_plan' THEN v_required := v_required || ARRAY['hasCurrentPlan']; END IF;
    v_current := v_f->'hasCurrentPlan'->>'value';
    IF v_intent IN ('replace_operator','reduce_cost','upgrade','downgrade','add_dependents') AND v_current IS DISTINCT FROM 'no'
      THEN v_required := v_required || ARRAY['currentOperator']; END IF;
    v_lives := v_f->'beneficiaries'->'value';
    IF jsonb_typeof(v_lives) IS DISTINCT FROM 'array' OR jsonb_typeof(v_f->'beneficiaryCount'->'value') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    v_count := (v_f->'beneficiaryCount'->>'value')::integer;
    IF v_count < 1 OR v_count > 100 OR jsonb_array_length(v_lives) <> v_count THEN RETURN false; END IF;
    IF (SELECT count(DISTINCT life->>'id') FROM jsonb_array_elements(v_lives) life) <> v_count THEN RETURN false; END IF;
    FOR v_life IN SELECT value FROM jsonb_array_elements(v_lives) LOOP
      IF jsonb_typeof(v_life->'age') IS DISTINCT FROM 'number' OR (v_life->>'age')::numeric <> trunc((v_life->>'age')::numeric)
        OR (v_life->>'age')::integer NOT BETWEEN 0 AND 120 OR length(trim(COALESCE(v_life->>'id',''))) = 0
        OR length(trim(COALESCE(v_life->>'label',''))) = 0 THEN RETURN false; END IF;
      IF (v_life->>'age')::integer >= 18 THEN v_required := v_required || ARRAY['companyPresence']; END IF;
      IF v_count = 1 AND (v_life->>'age')::integer < 12 THEN RETURN false; END IF;
    END LOOP;
    FOREACH v_field IN ARRAY v_required LOOP
      IF v_f->v_field->>'status' IS DISTINCT FROM 'confirmed' OR v_f->v_field->'value' IS NULL
        OR v_f->v_field->'value' = 'null'::jsonb THEN RETURN false; END IF;
    END LOOP;
    IF length(trim(COALESCE(v_f->'goal'->>'value',''))) = 0 OR length(trim(COALESCE(v_f->'city'->>'value',''))) = 0 THEN RETURN false; END IF;
    IF v_f->'state'->>'value' IS NULL OR v_f->'state'->>'value' NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RETURN false; END IF;
    v_company := v_f->'companyPresence'->>'value';
    IF 'companyPresence' = ANY(v_required) AND v_company IS DISTINCT FROM 'no' THEN RETURN false; END IF;
    IF v_intent <> 'first_plan' AND (v_current IS NULL OR v_current NOT IN ('yes','no')) THEN RETURN false; END IF;
    IF 'currentOperator' = ANY(v_required) AND length(trim(COALESCE(v_f->'currentOperator'->>'value',''))) = 0 THEN RETURN false; END IF;
    RETURN true;
  END IF;
  -- Backwards-compatible snapshots still require actual data, not just a status/tag.
  v_q := COALESCE(p_state->'qualification', p_state);
  IF v_q->>'status' IS DISTINCT FROM 'complete' OR v_q->'missingRequiredFields' IS DISTINCT FROM '[]'::jsonb
    OR v_q->>'compositionValid' IS DISTINCT FROM 'true' THEN RETURN false; END IF;
  v_count := (v_q->'lives'->>'count')::integer;
  v_lives := v_q->'lives'->'items';
  IF v_count IS NULL OR v_count < 1 OR jsonb_typeof(v_lives) IS DISTINCT FROM 'array' OR jsonb_array_length(v_lives) <> v_count THEN RETURN false; END IF;
  FOR v_life IN SELECT value FROM jsonb_array_elements(v_lives) LOOP
    IF v_life->>'ageStatus' IS DISTINCT FROM 'known' OR jsonb_typeof(v_life->'age') IS DISTINCT FROM 'number'
      OR (v_life->>'age')::numeric <> trunc((v_life->>'age')::numeric) OR (v_life->>'age')::integer NOT BETWEEN 0 AND 120 THEN RETURN false; END IF;
    IF v_count = 1 AND (v_life->>'age')::integer < 12 THEN RETURN false; END IF;
    IF (v_life->>'age')::integer >= 18 AND (v_q->'company'->>'answerStatus' IS DISTINCT FROM 'known'
      OR COALESCE(v_q->'company'->>'hasCnpjOrMei','') NOT IN ('yes','no')) THEN RETURN false; END IF;
  END LOOP;
  RETURN COALESCE(v_q->'location'->>'cityStatus' = 'known' AND length(trim(v_q->'location'->>'city')) > 0
    AND v_q->'location'->>'state' IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    AND v_q->'currentHealthPlan'->>'answerStatus' = 'known'
    AND v_q->'currentHealthPlan'->>'hasPlan' IN ('yes','no'), false);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ai_autonomous_attendance_handoff(p_chat_id uuid, p_lead_id uuid, p_handoff_code text)
RETURNS TABLE (chat_id uuid, lead_status_id uuid, status_applied boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_chat_id uuid; v_chat public.comm_whatsapp_chats%ROWTYPE; v_memory jsonb;
  v_target_name text; v_target_id uuid; v_source uuid; v_job uuid;
BEGIN
  IF p_handoff_code IS NULL OR p_handoff_code NOT IN ('QUALIFICACAO_COMPLETA','RECUSOU_COTACAO','FORA_DE_ESCOPO','PRECISA_HUMANO') THEN
    RAISE EXCEPTION 'Codigo de handoff invalido.' USING ERRCODE = '22023';
  END IF;
  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  SELECT chats.* INTO v_chat FROM public.comm_whatsapp_chats chats WHERE chats.id = v_chat_id FOR UPDATE;
  IF NOT FOUND OR v_chat.lead_id IS DISTINCT FROM p_lead_id OR v_chat.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Conversa ou lead invalido.' USING ERRCODE = 'P0002';
  END IF;
  IF v_chat.autonomous_attendance_status IS DISTINCT FROM 'active' THEN
    RETURN QUERY SELECT v_chat_id, NULL::uuid, false; RETURN;
  END IF;
  SELECT states.state INTO v_memory FROM public.ai_autonomous_qualification_states states
    WHERE states.chat_id = v_chat_id AND states.lead_id = p_lead_id;
  IF p_handoff_code = 'QUALIFICACAO_COMPLETA' THEN
    IF NOT public.ai_autonomous_qualification_can_complete(v_memory) THEN
      RAISE EXCEPTION 'Qualificacao incompleta ou exige validacao humana.' USING ERRCODE = '23514';
    END IF;
    v_source := (v_memory->>'source_message_id')::uuid;
    SELECT locks.owner_id::uuid INTO v_job FROM public.ai_autonomous_reply_locks locks WHERE locks.chat_id = v_chat_id;
    IF v_source IS NULL OR v_job IS NULL OR NOT public.ai_autonomous_turn_is_current(v_chat_id, v_job, v_source) THEN
      RAISE EXCEPTION 'Turno de qualificacao desatualizado.' USING ERRCODE = '23514';
    END IF;
  END IF;
  v_target_name := CASE p_handoff_code WHEN 'QUALIFICACAO_COMPLETA' THEN 'Aguardando cotação' WHEN 'RECUSOU_COTACAO' THEN 'Perdido' ELSE NULL END;
  IF v_target_name IS NOT NULL THEN
    SELECT statuses.id INTO v_target_id FROM public.lead_status_config statuses
    WHERE lower(trim(statuses.nome)) = lower(v_target_name)
      OR (v_target_name = 'Aguardando cotação' AND lower(trim(statuses.nome)) = 'aguardando cotacao')
    ORDER BY statuses.ordem ASC NULLS LAST, statuses.created_at ASC LIMIT 1;
    IF v_target_id IS NULL THEN RAISE EXCEPTION 'Status de handoff nao encontrado.' USING ERRCODE = '23514'; END IF;
  END IF;
  UPDATE public.comm_whatsapp_chats chats SET autonomous_attendance_status = 'handed_off', updated_at = now() WHERE chats.id = v_chat_id;
  UPDATE public.ai_autonomous_reply_jobs jobs SET status = 'cancelled', last_error = 'Atendimento autonomo encerrado: handoff para atendimento manual', updated_at = now()
    WHERE jobs.chat_id = v_chat_id AND jobs.status = 'pending';
  IF v_target_id IS NOT NULL THEN UPDATE public.leads leads SET status_id = v_target_id WHERE leads.id = p_lead_id; END IF;
  RETURN QUERY SELECT v_chat_id, v_target_id, true;
END;
$$;
-- Worker-specific entrypoint closes the race for early human transfers too.
-- Keep the existing three-argument RPC contract for other authorized callers.
CREATE OR REPLACE FUNCTION public.complete_ai_autonomous_turn_handoff(
  p_chat_id uuid, p_lead_id uuid, p_handoff_code text, p_job_id uuid, p_source_message_id uuid
) RETURNS TABLE (chat_id uuid, lead_status_id uuid, status_applied boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_chat_id uuid;
BEGIN
  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  PERFORM 1 FROM public.comm_whatsapp_chats c
    JOIN public.ai_autonomous_reply_jobs j ON j.chat_id = c.id AND j.lead_id = c.lead_id
    JOIN public.ai_autonomous_reply_locks l ON l.chat_id = c.id AND l.owner_id = j.id::text
    WHERE c.id = v_chat_id AND c.lead_id = p_lead_id AND c.deleted_at IS NULL AND c.autonomous_attendance_status = 'active'
      AND j.id = p_job_id AND (j.status = 'processing' OR (j.status = 'failed' AND p_handoff_code = 'PRECISA_HUMANO'))
      AND l.lease_until > now() AND public.latest_ai_autonomous_inbound(c.id) = p_source_message_id
      AND NOT EXISTS (SELECT 1 FROM public.comm_whatsapp_messages human
        JOIN public.comm_whatsapp_messages inbound ON inbound.id = p_source_message_id
        WHERE human.chat_id = c.id AND human.direction = 'outbound' AND human.created_by IS NOT NULL
          AND human.delivery_status <> 'failed' AND human.created_at >= inbound.created_at)
    FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN QUERY SELECT v_chat_id, NULL::uuid, false; RETURN; END IF;
  RETURN QUERY SELECT * FROM public.complete_ai_autonomous_attendance_handoff(v_chat_id,p_lead_id,p_handoff_code);
END;
$$;
REVOKE ALL ON FUNCTION public.ai_autonomous_qualification_can_complete(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_autonomous_attendance_handoff(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_autonomous_turn_handoff(uuid, uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_autonomous_qualification_can_complete(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_autonomous_attendance_handoff(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_autonomous_turn_handoff(uuid, uuid, text, uuid, uuid) TO service_role;
COMMIT;
