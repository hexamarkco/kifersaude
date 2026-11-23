-- Shared quota: evenly spaced new contacts; MedSenior paragraph-to-balloon materialization.
-- The global limit remains 20/rolling 24h and already-sent contacts are NOT retried.
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
  v_last_global_at timestamptz;
  v_global_window_seconds double precision;
  v_global_interval interval;
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

  -- The 24h cap limits NEW recipients, not the number of outgoing bubbles.
  -- Serialize and spread new admissions across the configured send window.
  -- For 08:00-18:00 with a cap of 20, this is one new contact per 30 minutes.
  -- Previously admitted recipients (including follow-ups) already returned above.
  SELECT max(admission.admitted_at) INTO v_last_global_at
  FROM public.comm_whatsapp_campaign_admissions AS admission;
  v_global_window_seconds := COALESCE(
    EXTRACT(EPOCH FROM (v_campaign.send_window_end - v_campaign.send_window_start))::double precision,
    36000.0
  );
  IF v_global_window_seconds <= 0 THEN
    v_global_window_seconds := v_global_window_seconds + 86400.0;
  END IF;
  v_global_interval := make_interval(secs =>
    GREATEST(60.0, v_global_window_seconds / GREATEST(v_global_contact_limit, 1)));
  IF v_last_global_at IS NOT NULL AND v_last_global_at + v_global_interval > p_now THEN
    retry_at := v_last_global_at + v_global_interval;
    reason := 'Aguardando a próxima vaga de novo contato distribuída na janela de envio.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(
      p_campaign_id, p_target_id, v_channel_key, 'global_new_contact_pacing', retry_at, p_now);
    result := 'rate_limited'; admission_exists := false; RETURN NEXT; RETURN;
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

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_admission_turn(p_channel_key text, p_time_zone text DEFAULT 'America/Sao_Paulo'::text)
 RETURNS TABLE(campaign_id uuid, available_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_channel_key text := left(COALESCE(NULLIF(btrim(p_channel_key), ''), 'whatsapp'), 160);
  v_time_zone text := COALESCE(NULLIF(p_time_zone, ''), 'America/Sao_Paulo');
  v_candidate_ids uuid[];
  v_rate numeric;
  v_last_channel_at timestamptz;
  v_last_channel_campaign uuid;
  v_turn_campaign uuid;
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_last_campaign_at timestamptz;
  v_campaign_interval interval;
  v_channel_interval interval;
  v_global_limit integer;
  v_global_used integer;
  v_global_next timestamptz;
  v_global_last timestamptz;
  v_global_window_seconds double precision;
BEGIN
  SELECT array_agg(candidate.id ORDER BY candidate.id)
           FILTER (WHERE candidate.has_daily_capacity AND candidate.has_ready_target),
         sum(candidate.rate_per_minute)
  INTO v_candidate_ids, v_rate
  FROM (
    SELECT active_campaign.id,
      60::numeric / public._comm_whatsapp_campaign_contact_interval_seconds(active_campaign) AS rate_per_minute,
      active_campaign.daily_send_limit IS NULL
        OR (SELECT count(*) FROM public.comm_whatsapp_campaign_admissions AS recent
            WHERE recent.campaign_id = active_campaign.id
              AND recent.admitted_at >= v_now - interval '24 hours') < active_campaign.daily_send_limit
        AS has_daily_capacity,
      EXISTS (
        SELECT 1 FROM public.comm_whatsapp_campaign_targets AS ready_target
        WHERE ready_target.campaign_id = active_campaign.id
          AND ready_target.status IN ('pending', 'scheduled', 'sending', 'failed')
          AND (ready_target.next_send_at IS NULL OR ready_target.next_send_at <= v_now)
          AND (ready_target.next_retry_at IS NULL OR ready_target.next_retry_at <= v_now)
          AND NOT EXISTS (
            SELECT 1 FROM public.comm_whatsapp_campaign_admissions AS admitted
            WHERE admitted.campaign_id = ready_target.campaign_id AND admitted.target_id = ready_target.id
          )
          AND public._comm_whatsapp_campaign_target_marketing_reason(active_campaign.id, ready_target.id) IS NULL
      ) AS has_ready_target
    FROM public.comm_whatsapp_campaigns AS active_campaign
    WHERE active_campaign.status IN ('queued', 'running', 'scheduled')
      AND (active_campaign.scheduled_at IS NULL OR active_campaign.scheduled_at <= v_now)
      AND (active_campaign.daily_send_limit IS NULL OR active_campaign.daily_send_limit > 0)
      AND public._comm_whatsapp_campaign_window_open(active_campaign, v_now, v_time_zone)
      AND EXISTS (
        SELECT 1 FROM public.comm_whatsapp_campaign_targets AS target
        WHERE target.campaign_id = active_campaign.id
          AND target.status IN ('pending', 'scheduled', 'sending', 'failed')
          AND NOT EXISTS (
            SELECT 1 FROM public.comm_whatsapp_campaign_admissions AS admitted
            WHERE admitted.campaign_id = target.campaign_id AND admitted.target_id = target.id
          )
          AND public._comm_whatsapp_campaign_target_marketing_reason(active_campaign.id, target.id) IS NULL
      )
  ) AS candidate;

  IF COALESCE(v_rate, 0) <= 0 OR COALESCE(cardinality(v_candidate_ids), 0) = 0 THEN
    RETURN;
  END IF;

  SELECT admission.admitted_at, admission.campaign_id
  INTO v_last_channel_at, v_last_channel_campaign
  FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.channel_key = v_channel_key
  ORDER BY admission.admitted_at DESC, admission.created_at DESC, admission.id DESC
  LIMIT 1;

  SELECT candidate.id INTO v_turn_campaign
  FROM unnest(v_candidate_ids) AS candidate(id)
  JOIN public.comm_whatsapp_campaigns AS weighted ON weighted.id = candidate.id
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS sent
    FROM public.comm_whatsapp_campaign_admissions AS admission
    WHERE admission.channel_key = v_channel_key
      AND admission.campaign_id = candidate.id
      AND admission.admitted_at >= v_now - interval '24 hours'
  ) AS usage ON true
  ORDER BY (usage.sent + 1)::numeric / weighted.dispatch_priority,
    weighted.dispatch_priority DESC, candidate.id
  LIMIT 1;

  v_channel_interval := make_interval(secs => (60 / v_rate)::double precision);
  available_at := GREATEST(COALESCE(v_last_channel_at + v_channel_interval, v_now), v_now);

  SELECT * INTO v_campaign
  FROM public.comm_whatsapp_campaigns AS campaign
  WHERE campaign.id = v_turn_campaign;

  SELECT s.daily_message_limit INTO v_global_limit FROM public.comm_whatsapp_campaign_global_settings AS s
  WHERE s.channel_key='whatsapp';
  SELECT count(*)::integer, min(a.admitted_at + interval '24 hours'), max(a.admitted_at)
  INTO v_global_used, v_global_next, v_global_last
  FROM public.comm_whatsapp_campaign_admissions a
  WHERE a.admitted_at > v_now-interval '24 hours';
  IF v_global_limit IS NOT NULL AND v_global_used >= v_global_limit THEN
    available_at := GREATEST(available_at, COALESCE(v_global_next, v_now + interval '24 hours'));
  END IF;
  v_global_window_seconds := COALESCE(
    EXTRACT(EPOCH FROM (v_campaign.send_window_end - v_campaign.send_window_start))::double precision,
    36000.0
  );
  IF v_global_window_seconds <= 0 THEN v_global_window_seconds := v_global_window_seconds + 86400.0; END IF;
  IF v_global_last IS NOT NULL AND v_global_limit > 0 THEN
    available_at := GREATEST(
      available_at,
      v_global_last + make_interval(secs => GREATEST(60.0, v_global_window_seconds / v_global_limit))
    );
  END IF;

  SELECT max(admission.admitted_at) INTO v_last_campaign_at
  FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.campaign_id = v_turn_campaign;

  v_campaign_interval := make_interval(secs =>
    public._comm_whatsapp_campaign_contact_interval_seconds(v_campaign)::double precision);
  IF v_last_campaign_at IS NOT NULL THEN
    available_at := GREATEST(available_at, v_last_campaign_at + v_campaign_interval);
  END IF;

  campaign_id := v_turn_campaign;
  RETURN NEXT;
END;
$function$
;


-- Normalize only the still-pending MedSenior broadcasts where a single text
-- step carries newline-separated paragraphs. Preserve already-sent targets,
-- their dispatch state, and completed campaigns. Existing rows are UPDATED,
-- new physical balloon steps are INSERTED. No record is deleted.
CREATE TEMP TABLE _ms_split_original ON COMMIT DROP AS
SELECT s.id AS original_step_id, s.campaign_id, s.variant_label, s.message_text,
       s.stage_index, s.delay_amount, s.delay_unit
FROM public.comm_whatsapp_campaign_steps s
JOIN public.comm_whatsapp_campaigns c ON c.id=s.campaign_id
WHERE c.status IN ('queued','running','scheduled')
  AND (c.name ILIKE 'MedSênior%' OR c.name ILIKE 'MS |%' OR c.name ILIKE 'MS PJ%')
  AND s.step_kind='message' AND s.step_index=0 AND s.media_url IS NULL
  AND s.message_text LIKE '%' || chr(10) || '%'
  AND (SELECT count(*) FROM public.comm_whatsapp_campaign_steps original
       WHERE original.campaign_id=c.id)=3
  AND (SELECT count(*) FROM public.comm_whatsapp_campaign_steps original
       WHERE original.campaign_id=c.id AND original.step_index=0
         AND original.variant_label IN('A','B','C'))=3
  AND NOT EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_targets t
                  WHERE t.campaign_id=c.id AND
                   (t.status='sending' OR (t.current_step_index>0 AND t.status IN('pending','scheduled','failed'))))
  AND NOT EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_step_dispatches d
                  WHERE d.campaign_id=c.id AND d.status IN('pending','sending','uncertain'));
CREATE TEMP TABLE _ms_split_parts ON COMMIT DROP AS
SELECT campaign_id,original_step_id,variant_label,stage_index,delay_amount,delay_unit,
       row_number() OVER (PARTITION BY original_step_id ORDER BY ordinal)-1 AS new_index,
       btrim(fragment) AS message_part
FROM _ms_split_original s
CROSS JOIN LATERAL regexp_split_to_table(replace(s.message_text,E'\r\n',E'\n'), E'\n+') WITH ORDINALITY AS parts(fragment,ordinal)
WHERE btrim(fragment)<>'';

DO $verify$
DECLARE mismatch integer;
BEGIN
 SELECT count(*) INTO mismatch FROM (
 SELECT o.campaign_id FROM _ms_split_original o
 LEFT JOIN _ms_split_parts p ON p.original_step_id=o.original_step_id
 GROUP BY o.campaign_id
 HAVING count(DISTINCT o.variant_label)<>3 OR count(p.*)<6 OR max(p.new_index)>29
 ) issues;
 IF mismatch>0 THEN RAISE EXCEPTION 'Cohort has invalid variation step counts'; END IF;
END $verify$;

INSERT INTO public.comm_whatsapp_campaign_steps
  (campaign_id,step_index,stage_index,step_kind,status_to_set,message_text,delay_amount,delay_unit,variant_label,
   media_url,media_type,media_filename)
SELECT p.campaign_id,p.new_index::int,p.stage_index,'message',NULL,p.message_part,0,'seconds',p.variant_label,
       NULL,NULL,NULL
FROM _ms_split_parts p WHERE p.new_index>0
ORDER BY p.campaign_id,p.new_index,p.variant_label;

UPDATE public.comm_whatsapp_campaign_steps s
SET message_text=p.message_part,updated_at=clock_timestamp()
FROM _ms_split_parts p WHERE s.id=p.original_step_id AND p.new_index=0;

UPDATE public.comm_whatsapp_campaigns c
SET audience_config=jsonb_set(COALESCE(c.audience_config,'{}'::jsonb),'{variant_sequences_v2}','true'::jsonb,true),
    message_text=COALESCE(
       (SELECT message_part FROM _ms_split_parts p WHERE p.campaign_id=c.id AND p.variant_label='A' AND p.new_index=0 LIMIT 1),
       c.message_text
    ),
    updated_at=clock_timestamp()
WHERE c.id IN (SELECT DISTINCT campaign_id FROM _ms_split_original);

INSERT INTO public.comm_whatsapp_campaign_events (campaign_id,event_type,payload,created_at)
SELECT o.campaign_id,'campaign_message_balloon_split',
       jsonb_build_object('reason','newline_to_separate_balloons',
                          'original_variations',3,
                          'new_physical_steps',(SELECT count(*) FROM _ms_split_parts p WHERE p.campaign_id=o.campaign_id),
                          'only_unsent_targets_affected',true),
       clock_timestamp()
FROM (SELECT DISTINCT campaign_id FROM _ms_split_original) o;


COMMIT;