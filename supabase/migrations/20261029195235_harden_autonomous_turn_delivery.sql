-- Local review only. Deploy this migration before the dependent worker.
BEGIN;

CREATE OR REPLACE FUNCTION public.latest_ai_autonomous_inbound(p_chat_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT m.id FROM public.comm_whatsapp_messages AS m
  WHERE m.chat_id = p_chat_id AND m.direction = 'inbound'
    AND lower(trim(m.message_type)) NOT IN ('receipt', 'ack', 'status', 'notification', 'reaction', 'protocol')
    AND NOT (lower(trim(m.message_type)) = 'unknown'
      AND lower(trim(COALESCE(m.text_content, ''))) IN ('', '[mensagem]')
      AND trim(COALESCE(m.media_caption, '')) = '' AND trim(COALESCE(m.transcription_text, '')) = '')
    AND (trim(COALESCE(m.text_content, '')) <> '' OR trim(COALESCE(m.media_caption, '')) <> ''
      OR trim(COALESCE(m.transcription_text, '')) <> ''
      OR lower(trim(m.message_type)) IN ('image', 'video', 'gif', 'short', 'document', 'audio', 'voice'))
  ORDER BY m.created_at DESC, m.id DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ai_autonomous_turn_is_current(
  p_chat_id uuid, p_job_id uuid, p_source_message_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_chats AS c
    JOIN public.ai_autonomous_reply_jobs AS j ON j.chat_id = c.id
    JOIN public.ai_autonomous_reply_locks AS l ON l.chat_id = c.id
    WHERE c.id = p_chat_id AND c.deleted_at IS NULL AND c.autonomous_attendance_status = 'active'
      AND c.lead_id IS NOT NULL AND j.lead_id = c.lead_id
      AND j.id = p_job_id AND j.status = 'processing'
      AND l.owner_id = p_job_id::text AND l.lease_until > now()
      AND public.latest_ai_autonomous_inbound(c.id) = p_source_message_id
      AND NOT EXISTS (
        SELECT 1 FROM public.comm_whatsapp_messages AS human
        JOIN public.comm_whatsapp_messages AS inbound ON inbound.id = p_source_message_id
        WHERE human.chat_id = c.id AND human.direction = 'outbound' AND human.created_by IS NOT NULL
          AND human.delivery_status <> 'failed' AND human.created_at >= inbound.created_at
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_ai_autonomous_reply_delivery_key(
  p_idempotency_key text, p_chat_id uuid, p_job_id uuid, p_message_index integer
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_source uuid; v_inserted integer;
BEGIN
  PERFORM 1 FROM public.comm_whatsapp_chats WHERE id = p_chat_id FOR UPDATE;
  IF split_part(p_idempotency_key, ':', 1) <> 'autonomous'
    OR split_part(p_idempotency_key, ':', 2) <> p_chat_id::text
    OR split_part(p_idempotency_key, ':', 4) <> p_message_index::text THEN RETURN false; END IF;
  BEGIN v_source := split_part(p_idempotency_key, ':', 3)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  IF NOT public.ai_autonomous_turn_is_current(p_chat_id, p_job_id, v_source) THEN RETURN false; END IF;
  -- A crash or uncertain earlier bubble never authorizes continuation by a new job.
  IF p_message_index > 0 AND NOT EXISTS (
    SELECT 1 FROM public.ai_autonomous_reply_delivery_keys
    WHERE idempotency_key = 'autonomous:' || p_chat_id::text || ':' || v_source::text || ':' || (p_message_index - 1)::text
      AND job_id = p_job_id AND status = 'sent'
  ) THEN RETURN false; END IF;
  INSERT INTO public.ai_autonomous_reply_delivery_keys(idempotency_key, chat_id, job_id, message_index)
  VALUES (p_idempotency_key, p_chat_id, p_job_id, p_message_index)
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_send_ai_autonomous_reply(
  p_chat_id uuid, p_job_id uuid, p_source_message_id uuid, p_idempotency_key text
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.ai_autonomous_turn_is_current(p_chat_id, p_job_id, p_source_message_id)
    AND EXISTS (SELECT 1 FROM public.ai_autonomous_reply_delivery_keys AS d
      WHERE d.idempotency_key = p_idempotency_key AND d.job_id = p_job_id AND d.chat_id = p_chat_id AND d.status = 'reserved');
$$;

CREATE OR REPLACE FUNCTION public.save_ai_autonomous_turn_memory(
  p_chat_id uuid, p_lead_id uuid, p_job_id uuid, p_source_message_id uuid, p_state jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.comm_whatsapp_chats WHERE id = p_chat_id AND lead_id = p_lead_id FOR UPDATE;
  IF NOT FOUND OR NOT public.ai_autonomous_turn_is_current(p_chat_id, p_job_id, p_source_message_id)
    OR p_state->>'schemaVersion' IS DISTINCT FROM '2'
    OR p_state->>'source_message_id' IS DISTINCT FROM p_source_message_id::text THEN RETURN false; END IF;
  -- Keep the existing table, version increment and canonical chat/lead validation.
  PERFORM public.upsert_ai_autonomous_qualification_state(p_chat_id, p_lead_id, p_state);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_stalled_ai_autonomous_jobs()
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtext('recover_stalled_ai_autonomous_jobs'));
  UPDATE public.ai_autonomous_reply_jobs AS j SET
    status = CASE
      WHEN EXISTS (SELECT 1 FROM public.ai_autonomous_reply_delivery_keys AS d WHERE d.job_id = j.id) THEN 'failed'
      WHEN NOT EXISTS (SELECT 1 FROM public.comm_whatsapp_chats AS c WHERE c.id = j.chat_id
        AND c.deleted_at IS NULL AND c.autonomous_attendance_status = 'active') THEN 'cancelled'
      WHEN EXISTS (SELECT 1 FROM public.ai_autonomous_reply_jobs AS pending
        WHERE pending.chat_id = j.chat_id AND pending.status = 'pending') THEN 'cancelled'
      WHEN EXISTS (SELECT 1 FROM public.ai_autonomous_reply_jobs AS earlier
        WHERE earlier.chat_id = j.chat_id AND earlier.status = 'processing'
          AND earlier.updated_at < now() - interval '10 minutes' AND earlier.id < j.id
          AND NOT EXISTS (SELECT 1 FROM public.ai_autonomous_reply_delivery_keys AS d WHERE d.job_id = earlier.id)) THEN 'cancelled'
      ELSE 'pending' END,
    last_error = 'Processamento interrompido. Entregas reservadas exigem conferencia humana.', updated_at = now()
  WHERE j.status = 'processing' AND j.updated_at < now() - interval '10 minutes';
$$;

REVOKE ALL ON FUNCTION public.latest_ai_autonomous_inbound(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_autonomous_turn_is_current(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_ai_autonomous_reply_delivery_key(text, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_send_ai_autonomous_reply(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_ai_autonomous_turn_memory(uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_stalled_ai_autonomous_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.latest_ai_autonomous_inbound(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_autonomous_turn_is_current(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_ai_autonomous_reply_delivery_key(text, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_send_ai_autonomous_reply(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_ai_autonomous_turn_memory(uuid, uuid, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_stalled_ai_autonomous_jobs() TO service_role;
COMMIT;
