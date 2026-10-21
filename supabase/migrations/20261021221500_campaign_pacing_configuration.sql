BEGIN;

ALTER TABLE public.comm_whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS contact_interval_minutes integer,
  ADD COLUMN IF NOT EXISTS inter_message_interval_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.comm_whatsapp_campaigns
  DROP CONSTRAINT IF EXISTS comm_whatsapp_campaigns_contact_interval_minutes_check,
  ADD CONSTRAINT comm_whatsapp_campaigns_contact_interval_minutes_check
    CHECK (contact_interval_minutes IS NULL OR contact_interval_minutes BETWEEN 1 AND 1440),
  DROP CONSTRAINT IF EXISTS comm_whatsapp_campaigns_inter_message_interval_minutes_check,
  ADD CONSTRAINT comm_whatsapp_campaigns_inter_message_interval_minutes_check
    CHECK (inter_message_interval_minutes BETWEEN 0 AND 1440);

COMMENT ON COLUMN public.comm_whatsapp_campaigns.contact_interval_minutes IS
  'Minimum interval between admissions of new campaign contacts; NULL distributes eligible audience across the daily send window.';
COMMENT ON COLUMN public.comm_whatsapp_campaigns.inter_message_interval_minutes IS
  'Minimum interval between consecutive message bubbles; 0 keeps sequential burst behavior.';

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_contact_interval_seconds(
  p_campaign public.comm_whatsapp_campaigns
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_eligible_targets integer := 0;
  v_per_day integer;
  v_window_seconds numeric;
BEGIN
  IF p_campaign.contact_interval_minutes IS NOT NULL THEN
    RETURN p_campaign.contact_interval_minutes * 60;
  END IF;

  SELECT count(*)::integer
  INTO v_eligible_targets
  FROM public.comm_whatsapp_campaign_targets AS target
  WHERE target.campaign_id = p_campaign.id
    AND target.status IN ('pending', 'scheduled', 'sending', 'failed', 'sent', 'responded')
    AND public._comm_whatsapp_campaign_target_marketing_reason(p_campaign.id, target.id) IS NULL;

  IF p_campaign.daily_send_limit IS NOT NULL AND p_campaign.daily_send_limit > 0 THEN
    v_per_day := LEAST(p_campaign.daily_send_limit, GREATEST(v_eligible_targets, 1));
  ELSE
    v_per_day := GREATEST(v_eligible_targets, 1);
  END IF;

  v_window_seconds := public._comm_whatsapp_campaign_window_minutes(p_campaign)::numeric * 60;
  -- The worker runs on a one-minute schedule. Keep automatically derived
  -- intervals at that resolution so a preview never promises faster pacing.
  RETURN GREATEST(60, CEIL(v_window_seconds / v_per_day)::integer);
END;
$function$;

REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_contact_interval_seconds(public.comm_whatsapp_campaigns)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_pacing jsonb;
  v_contact_interval integer;
  v_message_interval integer;
BEGIN
  v_pacing := NEW.audience_config->'__mcp_campaign_pacing';
  IF v_pacing IS NULL THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(v_pacing) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PACING_INVALID';
  END IF;

  IF v_pacing ? 'contact_interval_minutes' THEN
    v_contact_interval := CASE
      WHEN jsonb_typeof(v_pacing->'contact_interval_minutes') = 'null' THEN NULL
      ELSE NULLIF(v_pacing->>'contact_interval_minutes', '')::integer
    END;
    IF v_contact_interval IS NOT NULL AND v_contact_interval NOT BETWEEN 1 AND 1440 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_CONTACT_INTERVAL_INVALID';
    END IF;
    NEW.contact_interval_minutes := v_contact_interval;
  END IF;

  IF v_pacing ? 'inter_message_interval_minutes' THEN
    v_message_interval := (v_pacing->>'inter_message_interval_minutes')::integer;
    IF v_message_interval NOT BETWEEN 0 AND 1440 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MESSAGE_INTERVAL_INVALID';
    END IF;
    NEW.inter_message_interval_minutes := v_message_interval;
  END IF;

  NEW.audience_config := NEW.audience_config - '__mcp_campaign_pacing';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mcp_comm_whatsapp_campaign_apply_pacing_insert ON public.comm_whatsapp_campaigns;
CREATE TRIGGER trg_mcp_comm_whatsapp_campaign_apply_pacing_insert
  BEFORE INSERT ON public.comm_whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config();
DROP TRIGGER IF EXISTS trg_mcp_comm_whatsapp_campaign_apply_pacing_update ON public.comm_whatsapp_campaigns;
CREATE TRIGGER trg_mcp_comm_whatsapp_campaign_apply_pacing_update
  BEFORE UPDATE OF audience_config ON public.comm_whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config();
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_campaign_apply_pacing_config() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_reserve_new_contact(
  p_campaign_id uuid,
  p_target_id uuid,
  p_channel_key text,
  p_time_zone text,
  p_now timestamptz
)
RETURNS TABLE(result text, retry_at timestamptz, reason text, admission_exists boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
BEGIN
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
  ORDER BY CASE
      WHEN v_last_channel_campaign IS NULL OR candidate.campaign_id > v_last_channel_campaign THEN 0
      ELSE 1
    END,
    candidate.campaign_id
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
$function$;

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_admission_turn(
  p_channel_key text,
  p_time_zone text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE(campaign_id uuid, available_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
  ORDER BY CASE
      WHEN v_last_channel_campaign IS NULL OR candidate.id > v_last_channel_campaign THEN 0
      ELSE 1
    END,
    candidate.id
  LIMIT 1;

  v_channel_interval := make_interval(secs => (60 / v_rate)::double precision);
  available_at := GREATEST(COALESCE(v_last_channel_at + v_channel_interval, v_now), v_now);

  SELECT * INTO v_campaign
  FROM public.comm_whatsapp_campaigns AS campaign
  WHERE campaign.id = v_turn_campaign;

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
$function$;

REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_reserve_new_contact(uuid, uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._comm_whatsapp_campaign_reserve_new_contact(uuid, uuid, text, text, timestamptz)
  TO service_role;
REVOKE ALL ON FUNCTION public.get_comm_whatsapp_campaign_admission_turn(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_admission_turn(text, text)
  TO service_role;

COMMIT;
