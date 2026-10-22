BEGIN;

-- The same reminder rows used by Agenda; no second scheduling queue is created.
CREATE OR REPLACE FUNCTION public.mcp_mutate_agenda_reminders(
  p_actor_user_id uuid,
  p_operation text,
  p_items jsonb,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_item jsonb;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_lead_ids uuid[];
  v_current public.reminders%ROWTYPE;
  v_count integer;
  v_date timestamptz;
  v_version timestamptz;
  v_preview jsonb;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_actor_user_id AND role = 'admin' AND NULLIF(btrim(email), '') IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Administrador ativo obrigatório.');
  END IF;
  IF p_operation IS NULL OR p_operation NOT IN ('reschedule', 'reopen', 'delete') OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'Operação e lote de agenda inválidos.');
  END IF;
  v_count := jsonb_array_length(p_items);
  IF v_count < 1 OR v_count > 100 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'Informe de 1 a 100 lembretes por lote.');
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'Item de agenda inválido.');
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_item) AS key WHERE key NOT IN ('reminder_id', 'expected_ultima_modificacao') AND (p_operation <> 'reschedule' OR key NOT IN ('data_lembrete', 'reopen')))
      OR jsonb_typeof(v_item->'reminder_id') IS DISTINCT FROM 'string'
      OR NOT (v_item ? 'expected_ultima_modificacao')
      OR jsonb_typeof(v_item->'expected_ultima_modificacao') NOT IN ('null', 'string') THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'Informe somente ID, versão e os campos permitidos para a operação.');
    END IF;
    v_ids := array_append(v_ids, (v_item->>'reminder_id')::uuid);
    v_version := (v_item->>'expected_ultima_modificacao')::timestamptz;
    IF v_version IS NOT NULL AND NOT isfinite(v_version) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'Versão inválida.');
    END IF;
    IF p_operation = 'reschedule' THEN
      IF jsonb_typeof(v_item->'data_lembrete') IS DISTINCT FROM 'string'
        OR (v_item->>'data_lembrete') !~* 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
        OR (v_item ? 'reopen' AND jsonb_typeof(v_item->'reopen') IS DISTINCT FROM 'boolean') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'Informe data com fuso e reopen booleano.');
      END IF;
      v_date := (v_item->>'data_lembrete')::timestamptz;
      IF NOT isfinite(v_date) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'Data inválida.');
      END IF;
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT id) FROM unnest(v_ids) AS id) <> v_count THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'IDs duplicados no lote.');
  END IF;

  -- Lock the whole batch in a stable order and validate every version before
  -- writing anything, so one stale/missing row cannot leave a partial schedule.
  PERFORM id FROM public.reminders WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.reminders WHERE id = ANY(v_ids)) <> v_count THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Um ou mais lembretes não existem; nenhum item foi alterado.');
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO STRICT v_current FROM public.reminders WHERE id = (v_item->>'reminder_id')::uuid;
    IF v_current.ultima_modificacao IS DISTINCT FROM (v_item->>'expected_ultima_modificacao')::timestamptz THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'CONFLICT', 'message', 'Um lembrete mudou desde a leitura; consulte o lote novamente. Nenhum item foi alterado.', 'reminder_id', v_current.id);
    END IF;
  END LOOP;
  SELECT array_agg(DISTINCT lead_id) FILTER (WHERE lead_id IS NOT NULL) INTO v_lead_ids FROM public.reminders WHERE id = ANY(v_ids);
  SELECT jsonb_agg(jsonb_build_object('id', r.id, 'previous_date', r.data_lembrete, 'data_lembrete', CASE WHEN p_operation = 'reschedule' THEN (item.value->>'data_lembrete')::timestamptz ELSE r.data_lembrete END, 'lido', r.lido, 'ultima_modificacao', r.ultima_modificacao) ORDER BY item.ordinality)
    INTO v_preview FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(value, ordinality) JOIN public.reminders r ON r.id = (item.value->>'reminder_id')::uuid;
  IF COALESCE(p_dry_run, false) THEN
    RETURN jsonb_build_object('success', true, 'dry_run', true, 'operation', p_operation, 'requested_count', v_count, 'changed_count', 0, 'reminders', v_preview);
  END IF;

  IF p_operation = 'delete' THEN
    DELETE FROM public.reminders WHERE id = ANY(v_ids);
    v_result := jsonb_build_object('deleted_ids', to_jsonb(v_ids));
  ELSE
    UPDATE public.reminders AS r SET
      data_lembrete = CASE WHEN p_operation = 'reschedule' THEN item.data_lembrete ELSE r.data_lembrete END,
      lido = CASE WHEN p_operation = 'reopen' OR COALESCE(item.reopen, false) THEN false ELSE r.lido END,
      concluido_em = CASE WHEN p_operation = 'reopen' OR COALESCE(item.reopen, false) THEN NULL ELSE r.concluido_em END,
      cancelled_at = CASE WHEN p_operation = 'reopen' OR COALESCE(item.reopen, false) THEN NULL ELSE r.cancelled_at END,
      cancelled_by = CASE WHEN p_operation = 'reopen' OR COALESCE(item.reopen, false) THEN NULL ELSE r.cancelled_by END,
      cancellation_reason = CASE WHEN p_operation = 'reopen' OR COALESCE(item.reopen, false) THEN NULL ELSE r.cancellation_reason END,
      ultima_modificacao = clock_timestamp()
    FROM jsonb_to_recordset(p_items) AS item(reminder_id uuid, data_lembrete timestamptz, reopen boolean)
    WHERE r.id = item.reminder_id;
    SELECT jsonb_build_object('reminders', jsonb_agg(jsonb_build_object('id', id, 'lead_id', lead_id, 'contract_id', contract_id, 'data_lembrete', data_lembrete, 'lido', lido, 'ultima_modificacao', ultima_modificacao) ORDER BY id)) INTO v_result FROM public.reminders WHERE id = ANY(v_ids);
  END IF;
  -- Preserve the Agenda rule: next return is the earliest unread future reminder.
  PERFORM id FROM public.leads WHERE id = ANY(v_lead_ids) ORDER BY id FOR UPDATE;
  UPDATE public.leads AS lead SET proximo_retorno = (
    SELECT min(r.data_lembrete) FROM public.reminders r WHERE r.lead_id = lead.id AND r.lido = false AND r.data_lembrete >= now()
  ) WHERE lead.id = ANY(v_lead_ids);
  v_result := v_result || jsonb_build_object('success', true, 'dry_run', false, 'operation', p_operation, 'requested_count', v_count, 'changed_count', v_count);
  INSERT INTO public.mcp_action_audit_log(tool_name, action_type, actor, actor_id, request_payload, result_payload, success, source)
  VALUES (CASE p_operation WHEN 'reschedule' THEN 'kifer_reschedule_reminders' WHEN 'reopen' THEN 'kifer_reopen_reminder' ELSE 'kifer_delete_reminders' END,
    'agenda_' || p_operation, 'chatgpt_mcp', p_actor_user_id,
    jsonb_build_object('reminder_ids', to_jsonb(v_ids), 'count', v_count), v_result, true, 'chatgpt_mcp');
  RETURN v_result;
EXCEPTION
  WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT', 'message', 'ID, versão ou data inválida; nenhum item foi alterado.');
  WHEN foreign_key_violation OR check_violation THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CONFLICT', 'message', 'Um vínculo do lembrete impede a operação; nenhum item foi alterado.');
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_mutate_agenda_reminders(uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_mutate_agenda_reminders(uuid, text, jsonb, boolean) TO service_role;
COMMENT ON FUNCTION public.mcp_mutate_agenda_reminders(uuid, text, jsonb, boolean) IS 'Admin MCP agenda actions: atomic versioned batches, optional preview and next-return synchronization. Does not send WhatsApp or execute automation workers.';
NOTIFY pgrst, 'reload schema';
COMMIT;
