-- Kifer WhatsApp: global quota counts NEW recipient per campaign, never bubbles/follow-ups.
-- Existing campaign statuses, schedules, targets, priorities and 20-slot setting are untouched.
BEGIN;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_reserve_new_contact(p_campaign_id uuid, p_target_id uuid, p_channel_key text, p_time_zone text, p_now timestamp with time zone)
 RETURNS TABLE(result text, retry_at timestamp with time zone, reason text, admission_exists boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_existing public.comm_whatsapp_campaign_admissions%ROWTYPE;
  v_target public.comm_whatsapp_campaign_targets%ROWTYPE;
  v_channel_key text := left(COALESCE(NULLIF(btrim(p_channel_key), ''), 'whatsapp'), 160);
  v_time_zone text := COALESCE(NULLIF(p_time_zone, ''), 'America/Sao_Paulo');
  v_reason text;
  v_campaign_admitted integer := 0;
  v_campaign_retry_at timestamptz;
  v_last_campaign_at timestamptz;
  v_last_channel_at timestamptz;
  v_last_channel_campaign uuid;
  v_campaign_interval interval;
  v_channel_interval interval;
  v_window_minutes integer;
  v_rate numeric := 0;
  v_candidate_ids uuid[];
  v_turn_campaign uuid;
  v_inserted integer := 0;
  v_endpoint_hash text;
  v_global_contact_limit integer;
  v_global_started_count integer;
  v_global_retry_at timestamptz;
BEGIN
  -- Serialize admissions across all campaign channels on a shared contact budget.
  PERFORM pg_advisory_xact_lock(hashtextextended('comm_whatsapp_campaign_global_new_contacts', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('comm_whatsapp_campaign_admission:' || v_channel_key, 0));

  SELECT * INTO v_campaign FROM public.comm_whatsapp_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    result := 'campaign_not_found'; retry_at := NULL; reason := 'Campanha não encontrada.'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;
  IF v_campaign.status NOT IN ('queued', 'running', 'scheduled')
     OR (v_campaign.scheduled_at IS NOT NULL AND v_campaign.scheduled_at > p_now) THEN
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(
      p_campaign_id, p_target_id, v_channel_key, 'campaign_inactive', NULL, p_now
    );
    result := 'campaign_inactive'; retry_at := NULL; reason := 'Campanha fora do estado de envio.'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;
  IF NOT public._comm_whatsapp_campaign_window_open(v_campaign, p_now, v_time_zone) THEN
    retry_at := public._comm_whatsapp_campaign_next_window_at(v_campaign, p_now, v_time_zone);
    reason := 'Fora do dia ou da janela permitida.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, 'window_closed', retry_at, p_now);
    result := 'window_closed'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  v_reason := public._comm_whatsapp_campaign_target_marketing_reason(p_campaign_id, p_target_id);
  IF v_reason IS NOT NULL THEN
    reason := v_reason;
    retry_at := NULL;
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, v_reason, NULL, p_now);
    result := 'eligibility_blocked'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_existing FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.campaign_id = p_campaign_id AND admission.target_id = p_target_id;
  IF FOUND THEN
    result := 'reserved'; retry_at := NULL; reason := NULL; admission_exists := true; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_target FROM public.comm_whatsapp_campaign_targets AS target
  WHERE target.id = p_target_id AND target.campaign_id = p_campaign_id;
  IF NOT FOUND OR NULLIF(v_target.phone_digits, '') IS NULL THEN
    result := 'eligibility_blocked'; retry_at := NULL; reason := 'campaign_target_phone_missing'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;
  v_endpoint_hash := encode(extensions.digest(convert_to(v_target.phone_digits, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_existing FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.campaign_id = p_campaign_id AND admission.endpoint_hash = v_endpoint_hash;
  IF FOUND THEN
    retry_at := NULL;
    reason := 'contact_duplicate_in_campaign';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(
      p_campaign_id, p_target_id, v_channel_key, 'contact_duplicate_in_campaign', NULL, p_now
    );
    result := 'eligibility_blocked'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  -- A previous admission in the same campaign already returned above:
  -- subsequent bubbles, retries and follow-ups do not consume more quota.
  -- The same endpoint in a DIFFERENT campaign consumes a new quota slot.
  SELECT settings.daily_message_limit INTO v_global_contact_limit
  FROM public.comm_whatsapp_campaign_global_settings AS settings
  WHERE settings.channel_key = 'whatsapp';
  IF v_global_contact_limit IS NULL THEN
    RAISE EXCEPTION 'Limite global de novos contatos não configurado.';
  END IF;
  SELECT count(*)::integer, min(admission.admitted_at + interval '24 hours')
    INTO v_global_started_count, v_global_retry_at
  FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.admitted_at > p_now - interval '24 hours';
  IF v_global_started_count >= v_global_contact_limit THEN
    retry_at := COALESCE(v_global_retry_at, p_now + interval '24 hours');
    reason := 'Limite global de novos contatos por campanha atingido nas últimas 24 horas.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(
      p_campaign_id, p_target_id, v_channel_key, 'global_new_contacts_limit', retry_at, p_now
    );
    result := 'daily_limited'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  IF v_campaign.daily_send_limit IS NOT NULL AND v_campaign.daily_send_limit > 0 THEN
    SELECT count(*)::integer, min(admission.admitted_at + interval '24 hours')
    INTO v_campaign_admitted, v_campaign_retry_at
    FROM public.comm_whatsapp_campaign_admissions AS admission
    WHERE admission.campaign_id = p_campaign_id
      AND admission.admitted_at >= p_now - interval '24 hours';
    IF v_campaign_admitted >= v_campaign.daily_send_limit THEN
      retry_at := COALESCE(v_campaign_retry_at, p_now + interval '24 hours');
      reason := 'Limite de novos contatos da campanha atingido nas últimas 24 horas.';
      PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, 'campaign_daily_limit', retry_at, p_now);
      result := 'daily_limited'; admission_exists := false; RETURN NEXT; RETURN;
    END IF;
  END IF;

  v_campaign_interval := make_interval(secs =>
    public._comm_whatsapp_campaign_contact_interval_seconds(v_campaign)::double precision);

  SELECT max(admission.admitted_at) INTO v_last_campaign_at
  FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.campaign_id = p_campaign_id;
  IF v_last_campaign_at IS NOT NULL AND v_last_campaign_at + v_campaign_interval > p_now THEN
    retry_at := v_last_campaign_at + v_campaign_interval;
    reason := 'Intervalo mínimo de admissão da campanha ainda não atingido.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, 'campaign_pacing', retry_at, p_now);
    result := 'rate_limited'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  -- Keep configured rates from campaigns with remaining eligible audiences
  -- in the channel denominator even after one campaign reaches its cap. This
  -- preserves the shared interval until those targets are exhausted, so the
  -- other campaign can still use its remaining daily admissions. Campaigns
  -- without a daily cap retain their legacy pacing rate.
  SELECT array_agg(candidate.id ORDER BY candidate.id)
           FILTER (WHERE candidate.has_daily_capacity AND candidate.has_ready_target),
         sum(candidate.rate_per_minute)
  INTO v_candidate_ids, v_rate
  FROM (
    SELECT campaign.id,
      60::numeric / public._comm_whatsapp_campaign_contact_interval_seconds(campaign) AS rate_per_minute,
      campaign.daily_send_limit IS NULL
        OR (SELECT count(*) FROM public.comm_whatsapp_campaign_admissions AS recent
            WHERE recent.campaign_id = campaign.id
              AND recent.admitted_at >= p_now - interval '24 hours') < campaign.daily_send_limit
        AS has_daily_capacity,
      EXISTS (
        SELECT 1 FROM public.comm_whatsapp_campaign_targets AS ready_target
        WHERE ready_target.campaign_id = campaign.id
          AND ready_target.status IN ('pending', 'scheduled', 'sending', 'failed')
          AND (ready_target.next_send_at IS NULL OR ready_target.next_send_at <= p_now)
          AND (ready_target.next_retry_at IS NULL OR ready_target.next_retry_at <= p_now)
          AND NOT EXISTS (
            SELECT 1 FROM public.comm_whatsapp_campaign_admissions AS admitted
            WHERE admitted.campaign_id = ready_target.campaign_id AND admitted.target_id = ready_target.id
          )
          AND public._comm_whatsapp_campaign_target_marketing_reason(campaign.id, ready_target.id) IS NULL
      ) AS has_ready_target
    FROM public.comm_whatsapp_campaigns AS campaign
    WHERE campaign.status IN ('queued', 'running', 'scheduled')
      AND (campaign.scheduled_at IS NULL OR campaign.scheduled_at <= p_now)
      AND (campaign.daily_send_limit IS NULL OR campaign.daily_send_limit > 0)
      AND public._comm_whatsapp_campaign_window_open(campaign, p_now, v_time_zone)
      AND EXISTS (
        SELECT 1 FROM public.comm_whatsapp_campaign_targets AS target
        WHERE target.campaign_id = campaign.id
          AND target.status IN ('pending', 'scheduled', 'sending', 'failed')
          AND NOT EXISTS (
            SELECT 1 FROM public.comm_whatsapp_campaign_admissions AS admitted
            WHERE admitted.campaign_id = target.campaign_id AND admitted.target_id = target.id
          )
          AND public._comm_whatsapp_campaign_target_marketing_reason(campaign.id, target.id) IS NULL
      )
  ) AS candidate;

  IF COALESCE(v_rate, 0) <= 0 OR COALESCE(cardinality(v_candidate_ids), 0) = 0 THEN
    retry_at := p_now + interval '1 minute';
    reason := 'Nenhuma campanha elegível está pronta para admissão neste canal.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, 'no_eligible_channel_campaign', retry_at, p_now);
    result := 'rate_limited'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;
  v_channel_interval := make_interval(secs => (60 / v_rate)::double precision);

  SELECT admission.admitted_at, admission.campaign_id
  INTO v_last_channel_at, v_last_channel_campaign
  FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.channel_key = v_channel_key
  ORDER BY admission.admitted_at DESC, admission.created_at DESC, admission.id DESC
  LIMIT 1;

  IF v_last_channel_at IS NOT NULL AND v_last_channel_at + v_channel_interval > p_now THEN
    retry_at := v_last_channel_at + v_channel_interval;
    reason := 'Intervalo global mínimo de admissão do canal ainda não atingido.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, 'channel_pacing', retry_at, p_now);
    result := 'rate_limited'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  SELECT candidate.campaign_id INTO v_turn_campaign
  FROM unnest(v_candidate_ids) AS candidate(campaign_id)
  JOIN public.comm_whatsapp_campaigns AS weighted ON weighted.id = candidate.campaign_id
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS sent
    FROM public.comm_whatsapp_campaign_admissions AS admission
    WHERE admission.channel_key = v_channel_key
      AND admission.campaign_id = candidate.campaign_id
      AND admission.admitted_at >= p_now - interval '24 hours'
  ) AS usage ON true
  ORDER BY (usage.sent + 1)::numeric / weighted.dispatch_priority,
    weighted.dispatch_priority DESC, candidate.campaign_id
  LIMIT 1;

  IF v_turn_campaign IS DISTINCT FROM p_campaign_id THEN
    retry_at := GREATEST(COALESCE(v_last_channel_at + v_channel_interval, p_now), p_now + interval '1 minute');
    reason := 'A vez de admissão deste canal pertence a outra campanha.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, 'round_robin_wait', retry_at, p_now);
    result := 'rate_limited'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.comm_whatsapp_campaign_admissions (
    campaign_id, target_id, channel_key, endpoint_hash, admitted_at, admission_reason
  ) VALUES (
    p_campaign_id, p_target_id, v_channel_key, v_endpoint_hash, p_now, 'first_message_reserved'
  ) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_existing
    FROM public.comm_whatsapp_campaign_admissions AS admission
    WHERE admission.campaign_id = p_campaign_id
      AND (admission.target_id = p_target_id OR admission.endpoint_hash = v_endpoint_hash)
    ORDER BY CASE WHEN admission.target_id = p_target_id THEN 0 ELSE 1 END
    LIMIT 1;
    IF FOUND AND v_existing.target_id <> p_target_id THEN
      retry_at := NULL;
      reason := 'contact_duplicate_in_campaign';
      PERFORM public._comm_whatsapp_campaign_record_admission_deferred(
        p_campaign_id, p_target_id, v_channel_key, 'contact_duplicate_in_campaign', NULL, p_now
      );
      result := 'eligibility_blocked'; admission_exists := false; RETURN NEXT; RETURN;
    END IF;
    result := 'reserved'; retry_at := NULL; reason := NULL; admission_exists := true; RETURN NEXT; RETURN;
  END IF;

  result := 'reserved'; retry_at := NULL; reason := NULL; admission_exists := false;
  RETURN NEXT;
END;
$function$
;


-- Stage, retry and legacy dispatches never consume global contact slots.
CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(
 p_campaign_id uuid,p_target_id uuid,p_lock_token text,
 p_stage_index integer,p_expected_message_count integer,p_steps jsonb
) RETURNS TABLE(result text,retry_at timestamptz,reason text)
LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog, public
AS $quota$ SELECT * FROM public.reserve_comm_whatsapp_campaign_stage_dispatch_unlimited($1,$2,$3,$4,$5,$6) $quota$;

CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(
 p_campaign_id uuid,p_target_id uuid,p_lock_token text,p_stage_index integer,p_steps jsonb
) RETURNS TABLE(result text,retry_at timestamptz,reason text)
LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog, public
AS $quota$ SELECT * FROM public.reserve_comm_whatsapp_campaign_stage_dispatch_retry_unlimited($1,$2,$3,$4,$5) $quota$;

CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(
 p_campaign_id uuid,p_target_id uuid,p_lock_token text,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(result text,event_id uuid,attempts integer,retry_at timestamptz,reason text,reserved_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog, public
AS $quota$ SELECT * FROM public.reserve_comm_whatsapp_campaign_dispatch_unlimited($1,$2,$3,$4) $quota$;

-- New frontend uses unambiguous contact fields.
CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_global_contact_status()
RETURNS TABLE(daily_contact_limit integer,started_contacts_24h integer,remaining_contacts integer,next_available_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public
AS $status$
DECLARE v_limit integer;v_used integer;v_next timestamptz;
BEGIN
 IF NOT (public.current_user_can_view_comm_whatsapp() OR public.current_user_can_edit_comm_whatsapp()) THEN
   RAISE EXCEPTION 'Permissao insuficiente';
 END IF;
 SELECT s.daily_message_limit INTO v_limit FROM public.comm_whatsapp_campaign_global_settings s WHERE s.channel_key='whatsapp';
 SELECT count(*)::integer,min(a.admitted_at+interval '24 hours')
   INTO v_used,v_next FROM public.comm_whatsapp_campaign_admissions a
   WHERE a.admitted_at>clock_timestamp()-interval '24 hours';
 RETURN QUERY SELECT v_limit,v_used,GREATEST(v_limit-v_used,0),
   CASE WHEN v_used>=v_limit THEN v_next ELSE NULL::timestamptz END;
END;$status$;
REVOKE ALL ON FUNCTION public.get_comm_whatsapp_campaign_global_contact_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_global_contact_status() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_global_status()
 RETURNS TABLE(daily_message_limit integer, reserved_messages_24h integer, remaining_messages integer, next_available_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_limit integer;v_used integer;v_next timestamptz;
BEGIN
 IF NOT (public.current_user_can_view_comm_whatsapp() OR public.current_user_can_edit_comm_whatsapp()) THEN
   RAISE EXCEPTION 'Permissao insuficiente';
 END IF;
 SELECT s.daily_message_limit INTO v_limit FROM public.comm_whatsapp_campaign_global_settings s WHERE s.channel_key='whatsapp';
 SELECT count(*)::integer,min(r.admitted_at+interval '24 hours')
 INTO v_used,v_next FROM public.comm_whatsapp_campaign_admissions r
 WHERE r.admitted_at>clock_timestamp()-interval '24 hours';
 RETURN QUERY SELECT v_limit,v_used,GREATEST(v_limit-v_used,0),CASE WHEN v_used>=v_limit THEN v_next ELSE NULL::timestamptz END;
END;$function$
;

CREATE OR REPLACE FUNCTION public.mcp_get_comm_whatsapp_campaign_global_status(p_actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_limit integer;
  v_updated timestamptz;
  v_used integer;
  v_next timestamptz;
  v_as_of timestamptz := clock_timestamp();
BEGIN
  PERFORM public._mcp_comm_whatsapp_campaign_assert_admin(p_actor_user_id);
  SELECT daily_message_limit, updated_at
    INTO v_limit, v_updated
    FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp';
  IF NOT FOUND THEN RAISE EXCEPTION 'MCP_GLOBAL_CAMPAIGN_QUOTA_NOT_FOUND'; END IF;
  SELECT count(*)::integer, min(admitted_at+interval '24 hours')
    INTO v_used, v_next
    FROM public.comm_whatsapp_campaign_admissions
    WHERE admitted_at > v_as_of - interval '24 hours';
  RETURN jsonb_build_object(
    'success',true,'channel_key','whatsapp','period','rolling_24h',
    'daily_contact_limit',v_limit,'started_contacts_24h',v_used,
    'remaining_contacts',GREATEST(v_limit-v_used,0),
    'next_available_at',CASE WHEN v_used>=v_limit THEN v_next ELSE NULL::timestamptz END,
    'updated_at',v_updated,'as_of',v_as_of,
    'counting','first_contact_per_campaign_excludes_bubbles_followups_retries'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mcp_set_comm_whatsapp_campaign_global_limit(p_actor_user_id uuid, p_limit integer, p_expected_updated_at timestamp with time zone, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_gate jsonb;
  v_result jsonb;
  v_existing public.comm_whatsapp_campaign_global_settings%ROWTYPE;
  v_used integer;
BEGIN
  PERFORM public._mcp_comm_whatsapp_campaign_assert_admin(p_actor_user_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MCP_CAMPAIGN_GLOBAL_LIMIT_INVALID';
  END IF;
  v_gate := public._mcp_comm_whatsapp_campaign_begin(
    p_actor_user_id,p_client_request_id,'set_global_limit',NULL,NULL,
    jsonb_build_object('operation','set_global_limit','limit',p_limit,'expected_updated_at',p_expected_updated_at)
  );
  IF (v_gate->>'replayed')::boolean THEN RETURN (v_gate->'result')||jsonb_build_object('replayed',true); END IF;
  SELECT * INTO v_existing FROM public.comm_whatsapp_campaign_global_settings
    WHERE channel_key='whatsapp' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MCP_GLOBAL_CAMPAIGN_QUOTA_NOT_FOUND'; END IF;
  IF p_expected_updated_at IS NULL OR v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := jsonb_build_object('success',false,'error_code','STALE_WRITE','actual_updated_at',v_existing.updated_at,
      'message','A configuração global foi modificada desde a última leitura.','replayed',false);
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id,p_client_request_id,v_result);
    RETURN v_result;
  END IF;
  UPDATE public.comm_whatsapp_campaign_global_settings
    SET daily_message_limit=p_limit, updated_at=clock_timestamp()
    WHERE channel_key='whatsapp' RETURNING * INTO v_existing;
  SELECT count(*)::integer INTO v_used
    FROM public.comm_whatsapp_campaign_admissions
    WHERE admitted_at > clock_timestamp()-interval '24 hours';
  v_result:=jsonb_build_object('success',true,'channel_key','whatsapp','daily_contact_limit',v_existing.daily_message_limit,
    'started_contacts_24h',v_used,'remaining_contacts',GREATEST(p_limit-v_used,0),
    'updated_at',v_existing.updated_at,'replayed',false);
  PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id,p_client_request_id,v_result);
  RETURN v_result;
END;
$function$
;
COMMIT;
