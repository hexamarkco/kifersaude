BEGIN;

-- A reservation is one distinct person entering one campaign. Keep the row
-- after target cleanup (recurrences) so rolling limits cannot be reset by a
-- retry or by rebuilding the target list.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE CASCADE,
  target_id uuid NOT NULL,
  channel_key text NOT NULL,
  endpoint_hash text,
  admitted_at timestamptz NOT NULL,
  admission_reason text NOT NULL DEFAULT 'first_message_reserved',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT comm_whatsapp_campaign_admissions_target_unique UNIQUE (campaign_id, target_id),
  CONSTRAINT comm_whatsapp_campaign_admissions_channel_check CHECK (length(btrim(channel_key)) > 0)
);

ALTER TABLE public.comm_whatsapp_campaign_admissions
  ADD COLUMN IF NOT EXISTS endpoint_hash text;

CREATE INDEX IF NOT EXISTS idx_campaign_admissions_campaign_recent
  ON public.comm_whatsapp_campaign_admissions (campaign_id, admitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_admissions_channel_recent
  ON public.comm_whatsapp_campaign_admissions (channel_key, admitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_admissions_channel_endpoint_recent
  ON public.comm_whatsapp_campaign_admissions (channel_key, endpoint_hash, admitted_at DESC)
  WHERE endpoint_hash IS NOT NULL;

ALTER TABLE public.comm_whatsapp_campaign_admissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comm_whatsapp_campaign_admissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.comm_whatsapp_campaign_admissions TO service_role;

-- Backfill old first-message reservations as one admission per target, not
-- one row per physical message. Include reservations even when the provider
-- subsequently failed: retries retain the original slot.
INSERT INTO public.comm_whatsapp_campaign_admissions (
  campaign_id, target_id, channel_key, admitted_at, admission_reason
)
SELECT DISTINCT ON (event.campaign_id, event.target_id)
  event.campaign_id,
  event.target_id,
  'whatsapp',
  event.created_at,
  'backfilled_first_message_reservation'
FROM public.comm_whatsapp_campaign_events AS event
WHERE event.target_id IS NOT NULL
  AND COALESCE(event.payload->>'dispatch_permit_state', 'reserved') <> 'released'
  AND (
    (event.event_type = 'stage_dispatch_reserved' AND COALESCE((event.payload->>'stage_index')::integer, -1) = 0)
    OR (event.event_type = 'target_provider_send_started' AND COALESCE((event.payload->>'stepIndex')::integer, -1) = 0)
  )
ORDER BY event.campaign_id, event.target_id, event.created_at
ON CONFLICT (campaign_id, target_id) DO NOTHING;

-- Hash endpoint digits already present for earlier admissions; raw numbers
-- are not copied into the admission ledger.
UPDATE public.comm_whatsapp_campaign_admissions AS admission
SET endpoint_hash = encode(extensions.digest(convert_to(target.phone_digits, 'UTF8'), 'sha256'), 'hex')
FROM public.comm_whatsapp_campaign_targets AS target
WHERE target.id = admission.target_id
  AND admission.endpoint_hash IS NULL
  AND target.phone_digits IS NOT NULL
  AND target.phone_digits <> '';

-- The campaign panel currently has one configured WhatsApp sender shared by
-- every campaign. Use the sender id supplied by the worker when reserving;
-- legacy reservations are backfilled to the conservative shared key above.

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_window_minutes(
  p_campaign public.comm_whatsapp_campaigns
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_start integer;
  v_end integer;
BEGIN
  IF p_campaign.send_window_start IS NULL OR p_campaign.send_window_end IS NULL
     OR p_campaign.send_window_start = p_campaign.send_window_end THEN
    RETURN 1440;
  END IF;

  v_start := EXTRACT(HOUR FROM p_campaign.send_window_start)::integer * 60
    + EXTRACT(MINUTE FROM p_campaign.send_window_start)::integer;
  v_end := EXTRACT(HOUR FROM p_campaign.send_window_end)::integer * 60
    + EXTRACT(MINUTE FROM p_campaign.send_window_end)::integer;
  RETURN CASE WHEN v_start < v_end THEN v_end - v_start ELSE 1440 - v_start + v_end END;
END;
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_window_open(
  p_campaign public.comm_whatsapp_campaigns,
  p_now timestamptz,
  p_time_zone text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_local timestamp;
  v_minute integer;
  v_start integer;
  v_end integer;
  v_weekday integer;
BEGIN
  v_local := p_now AT TIME ZONE COALESCE(NULLIF(p_time_zone, ''), 'America/Sao_Paulo');
  v_weekday := EXTRACT(DOW FROM v_local)::integer;
  IF COALESCE(cardinality(p_campaign.active_weekdays), 0) > 0
     AND NOT (v_weekday = ANY(p_campaign.active_weekdays)) THEN
    RETURN false;
  END IF;

  IF p_campaign.send_window_start IS NULL OR p_campaign.send_window_end IS NULL
     OR p_campaign.send_window_start = p_campaign.send_window_end THEN
    RETURN true;
  END IF;

  v_minute := EXTRACT(HOUR FROM v_local)::integer * 60 + EXTRACT(MINUTE FROM v_local)::integer;
  v_start := EXTRACT(HOUR FROM p_campaign.send_window_start)::integer * 60
    + EXTRACT(MINUTE FROM p_campaign.send_window_start)::integer;
  v_end := EXTRACT(HOUR FROM p_campaign.send_window_end)::integer * 60
    + EXTRACT(MINUTE FROM p_campaign.send_window_end)::integer;
  RETURN CASE
    WHEN v_start < v_end THEN v_minute >= v_start AND v_minute < v_end
    ELSE v_minute >= v_start OR v_minute < v_end
  END;
EXCEPTION WHEN invalid_parameter_value THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_next_window_at(
  p_campaign public.comm_whatsapp_campaigns,
  p_now timestamptz,
  p_time_zone text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_timezone text := COALESCE(NULLIF(p_time_zone, ''), 'America/Sao_Paulo');
  v_local timestamp;
  v_local_date date;
  v_local_minute integer;
  v_start integer;
  v_end integer;
  v_candidate timestamp;
  v_weekday integer;
  v_offset integer;
BEGIN
  v_local := p_now AT TIME ZONE v_timezone;
  v_local_date := v_local::date;
  v_local_minute := EXTRACT(HOUR FROM v_local)::integer * 60 + EXTRACT(MINUTE FROM v_local)::integer;
  v_start := CASE WHEN p_campaign.send_window_start IS NULL THEN 0
    ELSE EXTRACT(HOUR FROM p_campaign.send_window_start)::integer * 60
      + EXTRACT(MINUTE FROM p_campaign.send_window_start)::integer END;
  v_end := CASE WHEN p_campaign.send_window_end IS NULL THEN 0
    ELSE EXTRACT(HOUR FROM p_campaign.send_window_end)::integer * 60
      + EXTRACT(MINUTE FROM p_campaign.send_window_end)::integer END;

  FOR v_offset IN 0..8 LOOP
    v_weekday := EXTRACT(DOW FROM (v_local_date + v_offset))::integer;
    IF COALESCE(cardinality(p_campaign.active_weekdays), 0) > 0
       AND NOT (v_weekday = ANY(p_campaign.active_weekdays)) THEN
      CONTINUE;
    END IF;

    IF p_campaign.send_window_start IS NULL OR p_campaign.send_window_end IS NULL
       OR p_campaign.send_window_start = p_campaign.send_window_end THEN
      IF v_offset = 0 THEN RETURN p_now; END IF;
      v_candidate := (v_local_date + v_offset)::timestamp;
    ELSIF v_start < v_end THEN
      IF v_offset = 0 AND v_local_minute >= v_start AND v_local_minute < v_end THEN RETURN p_now; END IF;
      v_candidate := (v_local_date + v_offset)::timestamp + make_interval(mins => v_start);
    ELSE
      IF v_offset = 0 AND (v_local_minute >= v_start OR v_local_minute < v_end) THEN RETURN p_now; END IF;
      v_candidate := (v_local_date + v_offset)::timestamp + make_interval(mins => v_start);
    END IF;

    IF (v_candidate AT TIME ZONE v_timezone) > p_now THEN
      RETURN v_candidate AT TIME ZONE v_timezone;
    END IF;
  END LOOP;
  RETURN p_now + interval '8 days';
EXCEPTION WHEN invalid_parameter_value THEN
  RETURN p_now + interval '8 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_marketing_review_ready(p_config jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
  SELECT COALESCE(
    jsonb_typeof(p_config->'marketing_review') = 'object'
      AND p_config->'marketing_review'->'legal_basis_reviewed' = 'true'::jsonb
      AND length(btrim(COALESCE(p_config->'marketing_review'->>'legal_basis_reference', ''))) > 0
      AND p_config->'marketing_review'->'promotion_reviewed' = 'true'::jsonb
      AND length(btrim(COALESCE(p_config->'marketing_review'->>'promotion_reference', ''))) > 0,
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_required_image_ready(
  p_campaign public.comm_whatsapp_campaigns
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT CASE
    WHEN p_campaign.id NOT IN (
      '96da372c-b76d-4e12-a4e5-a93b6c60c084'::uuid,
      '663279e5-739c-4efc-916e-cdf13142a458'::uuid
    ) THEN true
    WHEN p_campaign.ab_test_enabled THEN
      EXISTS (
        SELECT 1 FROM public.comm_whatsapp_campaign_steps AS step
        WHERE step.campaign_id = p_campaign.id AND step.step_index = 0
          AND step.variant_label = 'ANY' AND step.step_kind = 'message'
          AND step.media_type = 'image' AND NULLIF(btrim(step.media_url), '') IS NOT NULL
      ) OR (
        EXISTS (
          SELECT 1 FROM public.comm_whatsapp_campaign_steps AS step
          WHERE step.campaign_id = p_campaign.id AND step.step_index = 0
            AND step.variant_label = 'A' AND step.step_kind = 'message'
            AND step.media_type = 'image' AND NULLIF(btrim(step.media_url), '') IS NOT NULL
        ) AND EXISTS (
          SELECT 1 FROM public.comm_whatsapp_campaign_steps AS step
          WHERE step.campaign_id = p_campaign.id AND step.step_index = 0
            AND step.variant_label = 'B' AND step.step_kind = 'message'
            AND step.media_type = 'image' AND NULLIF(btrim(step.media_url), '') IS NOT NULL
        )
      )
    ELSE EXISTS (
      SELECT 1 FROM public.comm_whatsapp_campaign_steps AS step
      WHERE step.campaign_id = p_campaign.id AND step.step_index = 0
        AND step.variant_label IN ('ANY', 'A') AND step.step_kind = 'message'
        AND step.media_type = 'image' AND NULLIF(btrim(step.media_url), '') IS NOT NULL
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_target_marketing_reason(
  p_campaign_id uuid,
  p_target_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_target public.comm_whatsapp_campaign_targets%ROWTYPE;
  v_policy public.contact_permission_policies%ROWTYPE;
  v_evidence jsonb;
BEGIN
  SELECT * INTO v_campaign FROM public.comm_whatsapp_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN 'campaign_not_found'; END IF;
  IF NOT public._comm_whatsapp_campaign_marketing_review_ready(v_campaign.audience_config) THEN
    RETURN 'campaign_marketing_review_pending';
  END IF;
  IF NOT public._comm_whatsapp_campaign_required_image_ready(v_campaign) THEN
    RETURN 'campaign_promotion_image_pending';
  END IF;

  SELECT * INTO v_target FROM public.comm_whatsapp_campaign_targets
  WHERE id = p_target_id AND campaign_id = p_campaign_id;
  IF NOT FOUND THEN RETURN 'campaign_target_not_found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.contact_permission_policies AS blocked
    WHERE blocked.channel = 'whatsapp'
      AND blocked.endpoint_normalized = v_target.phone_digits
      AND blocked.purpose_scope IN ('global', 'commercial')
      AND blocked.state = 'blocked'
  ) THEN
    RETURN 'contact_permission_blocked';
  END IF;

  SELECT * INTO v_policy FROM public.contact_permission_policies AS policy
  WHERE policy.channel = 'whatsapp'
    AND policy.endpoint_normalized = v_target.phone_digits
    AND policy.purpose_scope = 'commercial';
  IF NOT FOUND THEN
    RETURN 'contact_permission_unverified';
  END IF;
  IF v_policy.state <> 'allowed' THEN
    RETURN 'contact_permission_unverified';
  END IF;

  v_evidence := v_policy.evidence->'campaign_marketing_eligibility'->p_campaign_id::text;
  IF jsonb_typeof(v_evidence) IS DISTINCT FROM 'object'
     OR v_evidence->>'status' IS DISTINCT FROM 'approved'
     OR v_evidence->>'purpose' IS DISTINCT FROM 'marketing'
     OR length(btrim(COALESCE(v_evidence->>'legal_basis', ''))) = 0
     OR length(btrim(COALESCE(v_evidence->>'evidence_reference', ''))) = 0 THEN
    RETURN 'contact_marketing_eligibility_pending';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_campaign_admissions AS prior
    WHERE prior.campaign_id <> p_campaign_id
      AND prior.channel_key = 'whatsapp'
      AND prior.endpoint_hash = encode(extensions.digest(convert_to(v_target.phone_digits, 'UTF8'), 'sha256'), 'hex')
      AND prior.admitted_at >= statement_timestamp() - interval '24 hours'
  ) THEN
    RETURN 'contact_recent_campaign_duplicate';
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_marketing_readiness(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_total integer := 0;
  v_eligible integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM public.comm_whatsapp_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', false, 'reason_codes', jsonb_build_array('campaign_not_found'), 'total_targets', 0, 'eligible_targets', 0, 'pending_targets', 0);
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE readiness.reason IS NULL)::integer,
         COALESCE(jsonb_agg(DISTINCT readiness.reason) FILTER (WHERE readiness.reason IS NOT NULL), '[]'::jsonb)
  INTO v_total, v_eligible, v_reasons
  FROM (
    SELECT public._comm_whatsapp_campaign_target_marketing_reason(p_campaign_id, target.id) AS reason
    FROM public.comm_whatsapp_campaign_targets AS target
    WHERE target.campaign_id = p_campaign_id
  ) AS readiness;

  IF v_total = 0 THEN
    v_reasons := CASE WHEN public._comm_whatsapp_campaign_marketing_review_ready(v_campaign.audience_config)
      THEN jsonb_build_array('campaign_contacts_required')
      ELSE jsonb_build_array('campaign_marketing_review_pending') END;
    IF NOT public._comm_whatsapp_campaign_required_image_ready(v_campaign) THEN
      v_reasons := v_reasons || jsonb_build_array('campaign_promotion_image_pending');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ready', v_total > 0 AND v_eligible = v_total AND jsonb_array_length(v_reasons) = 0,
    'total_targets', v_total,
    'eligible_targets', v_eligible,
    'pending_targets', GREATEST(v_total - v_eligible, 0),
    'reason_codes', v_reasons
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_record_admission_deferred(
  p_campaign_id uuid,
  p_target_id uuid,
  p_channel_key text,
  p_reason text,
  p_retry_at timestamptz,
  p_now timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_campaign_events AS event
    WHERE event.campaign_id = p_campaign_id
      AND event.target_id = p_target_id
      AND event.event_type = 'target_admission_deferred'
      AND event.payload->>'reason' = p_reason
      AND event.created_at >= p_now - interval '10 minutes'
  ) THEN
    INSERT INTO public.comm_whatsapp_campaign_events (campaign_id, target_id, event_type, payload, created_at)
    VALUES (
      p_campaign_id, p_target_id, 'target_admission_deferred',
      jsonb_build_object('reason', p_reason, 'retry_at', p_retry_at, 'channel_key', p_channel_key),
      p_now
    );
  END IF;
END;
$function$;

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
    v_window_minutes := public._comm_whatsapp_campaign_window_minutes(v_campaign);
    v_campaign_interval := make_interval(secs => (v_window_minutes::numeric * 60 / v_campaign.daily_send_limit)::double precision);
  ELSE
    v_campaign_interval := make_interval(secs => 60.0 / GREATEST(v_campaign.pacing_per_minute, 1));
  END IF;

  SELECT max(admission.admitted_at) INTO v_last_campaign_at
  FROM public.comm_whatsapp_campaign_admissions AS admission
  WHERE admission.campaign_id = p_campaign_id;
  IF v_last_campaign_at IS NOT NULL AND v_last_campaign_at + v_campaign_interval > p_now THEN
    retry_at := v_last_campaign_at + v_campaign_interval;
    reason := 'Intervalo mínimo de admissão da campanha ainda não atingido.';
    PERFORM public._comm_whatsapp_campaign_record_admission_deferred(p_campaign_id, p_target_id, v_channel_key, 'campaign_pacing', retry_at, p_now);
    result := 'rate_limited'; admission_exists := false; RETURN NEXT; RETURN;
  END IF;

  -- Sum the active campaigns' admission rates for this sender. With two
  -- campaigns at 30 contacts per 570-minute window, the shared interval is
  -- 570 / 60 = 9.5 minutes. Campaigns without a daily cap retain their
  -- legacy pacing rate. The campaign table has no per-campaign sender field,
  -- so the active set is shared by all campaigns on this configured sender.
  SELECT array_agg(candidate.id ORDER BY candidate.id), sum(candidate.rate_per_minute)
  INTO v_candidate_ids, v_rate
  FROM (
    SELECT campaign.id,
      CASE
        WHEN campaign.daily_send_limit IS NOT NULL AND campaign.daily_send_limit > 0
          THEN campaign.daily_send_limit::numeric / public._comm_whatsapp_campaign_window_minutes(campaign)
        ELSE GREATEST(campaign.pacing_per_minute, 1)::numeric / 60
      END AS rate_per_minute
    FROM public.comm_whatsapp_campaigns AS campaign
    WHERE campaign.status IN ('queued', 'running', 'scheduled')
      AND (campaign.scheduled_at IS NULL OR campaign.scheduled_at <= p_now)
      AND (campaign.daily_send_limit IS NULL OR campaign.daily_send_limit > 0)
      AND public._comm_whatsapp_campaign_window_open(campaign, p_now, v_time_zone)
      AND (
        campaign.daily_send_limit IS NULL
        OR (SELECT count(*) FROM public.comm_whatsapp_campaign_admissions AS recent
            WHERE recent.campaign_id = campaign.id
              AND recent.admitted_at >= p_now - interval '24 hours') < campaign.daily_send_limit
      )
      AND EXISTS (
        SELECT 1 FROM public.comm_whatsapp_campaign_targets AS target
        WHERE target.campaign_id = campaign.id
          AND target.status IN ('pending', 'scheduled', 'sending', 'failed')
          AND (target.next_send_at IS NULL OR target.next_send_at <= p_now)
          AND (target.next_retry_at IS NULL OR target.next_retry_at <= p_now)
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
  ) ON CONFLICT (campaign_id, target_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  result := 'reserved'; retry_at := NULL; reason := NULL; admission_exists := (v_inserted = 0);
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(
  p_campaign_id uuid,
  p_target_id uuid,
  p_lock_token text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(result text, event_id uuid, attempts integer, retry_at timestamptz, reason text, reserved_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_attempts integer;
  v_event_id uuid;
  v_gate record;
  v_channel_key text := COALESCE(NULLIF(p_payload->>'channel_id', ''), 'whatsapp');
  v_time_zone text := COALESCE(NULLIF(p_payload->>'time_zone', ''), 'America/Sao_Paulo');
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'O payload da reserva de campanha deve ser um objeto JSON.';
  END IF;

  SELECT * INTO v_campaign FROM public.comm_whatsapp_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha nao encontrada.'; END IF;

  SELECT target.attempts INTO v_attempts
  FROM public.comm_whatsapp_campaign_targets AS target
  WHERE target.id = p_target_id AND target.campaign_id = p_campaign_id
    AND target.status = 'sending' AND target.lock_token = p_lock_token
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'lease_lost'::text, NULL::uuid, NULL::integer, NULL::timestamptz,
      'A reserva do alvo expirou ou foi assumida por outro worker.'::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_campaign.status NOT IN ('queued', 'running', 'scheduled')
     OR (v_campaign.scheduled_at IS NOT NULL AND v_campaign.scheduled_at > v_now) THEN
    RETURN QUERY SELECT 'campaign_inactive'::text, NULL::uuid, NULL::integer, NULL::timestamptz,
      'Campanha fora do estado de envio.'::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT public._comm_whatsapp_campaign_window_open(v_campaign, v_now, v_time_zone) THEN
    RETURN QUERY SELECT 'window_closed'::text, NULL::uuid, NULL::integer,
      public._comm_whatsapp_campaign_next_window_at(v_campaign, v_now, v_time_zone),
      'Fora do dia ou da janela permitida.'::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM public._comm_whatsapp_campaign_reserve_new_contact(
    p_campaign_id, p_target_id, v_channel_key, v_time_zone, v_now
  );
  IF v_gate.result <> 'reserved' THEN
    RETURN QUERY SELECT v_gate.result, NULL::uuid, NULL::integer, v_gate.retry_at, v_gate.reason, NULL::timestamptz;
    RETURN;
  END IF;

  v_attempts := v_attempts + 1;
  UPDATE public.comm_whatsapp_campaign_targets AS target
  SET attempts = v_attempts, last_attempt_at = v_now, locked_at = v_now,
      error_message = NULL, updated_at = v_now
  WHERE target.id = p_target_id AND target.status = 'sending' AND target.lock_token = p_lock_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'lease_lost'::text, NULL::uuid, NULL::integer, NULL::timestamptz,
      'A reserva do alvo expirou ou foi assumida por outro worker.'::text, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.comm_whatsapp_campaign_events (campaign_id, target_id, event_type, payload, created_at)
  VALUES (p_campaign_id, p_target_id, 'target_provider_send_started',
    p_payload || jsonb_build_object('dispatch_permit_state', 'reserved', 'reserved_at', v_now), v_now)
  RETURNING id INTO v_event_id;

  RETURN QUERY SELECT 'reserved'::text, v_event_id, v_attempts, NULL::timestamptz, NULL::text, v_now;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(
  p_campaign_id uuid,
  p_target_id uuid,
  p_lock_token text,
  p_stage_index integer,
  p_expected_message_count integer,
  p_steps jsonb
)
RETURNS TABLE(result text, retry_at timestamptz, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_step jsonb;
  v_step_index integer;
  v_stage_index integer;
  v_dispatch_key text;
  v_first_step boolean := false;
  v_channel_key text := 'whatsapp';
  v_time_zone text := 'America/Sao_Paulo';
  v_gate record;
BEGIN
  IF p_steps IS NULL OR jsonb_typeof(p_steps) <> 'array' OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'A reserva de stage requer ao menos um step.';
  END IF;
  IF p_expected_message_count < 1 OR p_expected_message_count <> jsonb_array_length(p_steps) THEN
    RAISE EXCEPTION 'A quantidade de mensagens esperada deve corresponder aos despachos do stage.';
  END IF;

  SELECT * INTO v_campaign FROM public.comm_whatsapp_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha nao encontrada.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_campaign_targets
    WHERE id = p_target_id AND campaign_id = p_campaign_id AND status = 'sending' AND lock_token = p_lock_token
  ) THEN
    RETURN QUERY SELECT 'lease_lost'::text, NULL::timestamptz,
      'A reserva do alvo expirou ou foi assumida por outro worker.'::text;
    RETURN;
  END IF;
  IF v_campaign.status NOT IN ('queued', 'running', 'scheduled')
     OR (v_campaign.scheduled_at IS NOT NULL AND v_campaign.scheduled_at > v_now) THEN
    RETURN QUERY SELECT 'campaign_inactive'::text, NULL::timestamptz, 'Campanha fora do estado de envio.'::text;
    RETURN;
  END IF;

  v_channel_key := COALESCE(NULLIF(p_steps->0->>'channel_id', ''), 'whatsapp');
  v_time_zone := COALESCE(NULLIF(p_steps->0->>'time_zone', ''), 'America/Sao_Paulo');
  IF NOT public._comm_whatsapp_campaign_window_open(v_campaign, v_now, v_time_zone) THEN
    RETURN QUERY SELECT 'window_closed'::text,
      public._comm_whatsapp_campaign_next_window_at(v_campaign, v_now, v_time_zone),
      'Fora do dia ou da janela permitida.'::text;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM public._comm_whatsapp_campaign_reserve_new_contact(
    p_campaign_id, p_target_id, v_channel_key, v_time_zone, v_now
  );
  IF v_gate.result <> 'reserved' THEN
    RETURN QUERY SELECT v_gate.result, v_gate.retry_at, v_gate.reason;
    RETURN;
  END IF;
  v_first_step := NOT COALESCE(v_gate.admission_exists, false);

  FOR v_step IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    v_step_index := (v_step->>'step_index')::integer;
    v_stage_index := COALESCE((v_step->>'stage_index')::integer, p_stage_index);
    v_dispatch_key := p_campaign_id || ':' || p_target_id || ':' || v_step_index;
    INSERT INTO public.comm_whatsapp_campaign_step_dispatches (
      campaign_id, target_id, step_index, stage_index, dispatch_key, status
    ) VALUES (p_campaign_id, p_target_id, v_step_index, v_stage_index, v_dispatch_key, 'pending')
    ON CONFLICT (dispatch_key) DO UPDATE SET
      status = CASE
        WHEN comm_whatsapp_campaign_step_dispatches.status = 'cancelled'
          AND comm_whatsapp_campaign_step_dispatches.resolution IN ('campaign_paused', 'send_window_closed')
          THEN 'pending'
        ELSE comm_whatsapp_campaign_step_dispatches.status
      END,
      updated_at = v_now,
      next_retry_at = CASE
        WHEN comm_whatsapp_campaign_step_dispatches.status = 'cancelled'
          AND comm_whatsapp_campaign_step_dispatches.resolution IN ('campaign_paused', 'send_window_closed')
          THEN NULL
        ELSE comm_whatsapp_campaign_step_dispatches.next_retry_at
      END,
      error_message = CASE
        WHEN comm_whatsapp_campaign_step_dispatches.status = 'cancelled'
          AND comm_whatsapp_campaign_step_dispatches.resolution IN ('campaign_paused', 'send_window_closed')
          THEN NULL
        ELSE comm_whatsapp_campaign_step_dispatches.error_message
      END,
      resolved_at = CASE
        WHEN comm_whatsapp_campaign_step_dispatches.status = 'cancelled'
          AND comm_whatsapp_campaign_step_dispatches.resolution IN ('campaign_paused', 'send_window_closed')
          THEN NULL
        ELSE comm_whatsapp_campaign_step_dispatches.resolved_at
      END,
      resolution = CASE
        WHEN comm_whatsapp_campaign_step_dispatches.status = 'cancelled'
          AND comm_whatsapp_campaign_step_dispatches.resolution IN ('campaign_paused', 'send_window_closed')
          THEN NULL
        ELSE comm_whatsapp_campaign_step_dispatches.resolution
      END
      WHERE comm_whatsapp_campaign_step_dispatches.status IN ('pending', 'sending')
        OR (comm_whatsapp_campaign_step_dispatches.status = 'cancelled'
          AND comm_whatsapp_campaign_step_dispatches.resolution IN ('campaign_paused', 'send_window_closed'));
  END LOOP;

  INSERT INTO public.comm_whatsapp_campaign_events (campaign_id, target_id, event_type, payload, created_at)
  VALUES (p_campaign_id, p_target_id, 'stage_dispatch_reserved', jsonb_build_object(
    'stage_index', p_stage_index,
    'expected_message_count', p_expected_message_count,
    'dispatch_permit_state', 'reserved',
    'new_contact_admission', v_first_step,
    'channel_key', v_channel_key,
    'reserved_at', v_now
  ), v_now);

  RETURN QUERY SELECT 'reserved'::text, NULL::timestamptz, NULL::text;
END;
$function$;

REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_window_minutes(public.comm_whatsapp_campaigns) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_window_open(public.comm_whatsapp_campaigns, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_next_window_at(public.comm_whatsapp_campaigns, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_marketing_review_ready(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_required_image_ready(public.comm_whatsapp_campaigns) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_target_marketing_reason(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_record_admission_deferred(uuid, uuid, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_reserve_new_contact(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_comm_whatsapp_campaign_marketing_readiness(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(uuid, uuid, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._comm_whatsapp_campaign_target_marketing_reason(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._comm_whatsapp_campaign_reserve_new_contact(uuid, uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_marketing_readiness(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(uuid, uuid, text, integer, integer, jsonb) TO service_role;

-- Keep campaign media in the existing public bucket, but constrain future
-- uploads to the formats and size that the worker can validate before send.
UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf']::text[]
WHERE id = 'whatsapp-campaign-media';

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_campaign_replace_steps(
  p_campaign_id uuid,
  p_steps jsonb,
  p_fallback_message text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, storage
AS $function$
DECLARE
  v_step jsonb;
  v_ordinal integer := 0;
  v_step_index integer;
  v_stage_index integer;
  v_message text;
  v_delay integer;
  v_unit text;
  v_variant_label text;
  v_step_kind text;
  v_status_to_set text;
  v_media_path text;
  v_media_url text;
  v_media_type text;
  v_media_filename text;
  v_media_mime text;
  v_media_size bigint;
  v_first_message text := '';
  v_existing public.comm_whatsapp_campaign_steps%ROWTYPE;
  v_updated integer;
  v_steps jsonb := p_steps;
BEGIN
  IF v_steps IS NULL THEN
    v_steps := jsonb_build_array(jsonb_build_object('message', COALESCE(p_fallback_message, '')));
  ELSIF jsonb_typeof(v_steps) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEPS_INVALID';
  ELSIF jsonb_array_length(v_steps) = 0 THEN
    v_steps := jsonb_build_array(jsonb_build_object('message', COALESCE(p_fallback_message, '')));
  END IF;
  IF jsonb_array_length(v_steps) > 30 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_TOO_MANY_STEPS';
  END IF;

  FOR v_step IN SELECT value FROM jsonb_array_elements(v_steps)
  LOOP
    v_ordinal := v_ordinal + 1;
    IF jsonb_typeof(v_step) <> 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    IF v_step ? 'media_url' OR v_step ? 'media_type' OR v_step ? 'media_filename' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MEDIA_URL_NOT_ALLOWED';
    END IF;

    IF NULLIF(v_step->>'step_index', '') IS NOT NULL THEN
      v_step_index := (v_step->>'step_index')::integer;
    ELSE
      SELECT indices.step_index INTO v_step_index
      FROM (
        SELECT DISTINCT step.step_index
        FROM public.comm_whatsapp_campaign_steps AS step
        WHERE step.campaign_id = p_campaign_id
        ORDER BY step.step_index
      ) AS indices
      OFFSET v_ordinal - 1 LIMIT 1;
      v_step_index := COALESCE(v_step_index, v_ordinal - 1);
    END IF;
    v_variant_label := NULLIF(v_step->>'variant_label', '');
    IF v_step_index < 0 OR v_step_index > 29
       OR (v_variant_label IS NOT NULL AND v_variant_label NOT IN ('ANY', 'A', 'B')) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    IF v_variant_label IS NULL THEN
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id AND step_index = v_step_index AND variant_label = 'ANY') THEN 'ANY'
        WHEN EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id AND step_index = v_step_index AND variant_label = 'A') THEN 'A'
        WHEN EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id AND step_index = v_step_index AND variant_label = 'B') THEN 'B'
        ELSE 'ANY'
      END INTO v_variant_label;
    END IF;
    v_message := btrim(COALESCE(v_step->>'message', v_step->>'message_text', ''));
    IF v_message = '' OR char_length(v_message) > 4096 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MESSAGE_REQUIRED';
    END IF;
    v_first_message := COALESCE(NULLIF(v_first_message, ''), v_message);

    v_delay := NULLIF(v_step->>'delay_amount', '')::integer;
    v_unit := NULLIF(v_step->>'delay_unit', '');
    IF (v_delay IS NOT NULL AND (v_delay < 0 OR v_delay > 31622400))
       OR (v_unit IS NOT NULL AND v_unit NOT IN ('seconds', 'minutes', 'hours', 'days')) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_DELAY_INVALID';
    END IF;
    v_stage_index := NULLIF(v_step->>'stage_index', '')::integer;
    IF v_stage_index IS NOT NULL AND v_stage_index < 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    v_step_kind := NULLIF(v_step->>'step_kind', '');
    IF v_step_kind IS NOT NULL AND v_step_kind NOT IN ('message', 'status_change') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEP_INVALID';
    END IF;
    v_status_to_set := NULLIF(btrim(v_step->>'status_to_set'), '');

    v_media_url := NULL;
    v_media_type := NULL;
    v_media_filename := NULL;
    IF v_step ? 'media_storage_path' AND jsonb_typeof(v_step->'media_storage_path') <> 'null' THEN
      v_media_path := v_step->>'media_storage_path';
      IF v_media_path IS NULL OR length(v_media_path) > 512 OR v_media_path = ''
         OR left(v_media_path, 1) = '/' OR position(chr(92) in v_media_path) > 0
         OR v_media_path LIKE '%//%'
         OR v_media_path ~ '(^|/)\.\.?(/|$)'
         OR v_media_path ~* '%(2e|2f|5c)' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MEDIA_PATH_INVALID';
      END IF;
      SELECT object.metadata->>'mimetype', NULLIF(object.metadata->>'size', '')::bigint
      INTO v_media_mime, v_media_size
      FROM storage.objects AS object
      WHERE object.bucket_id = 'whatsapp-campaign-media' AND object.name = v_media_path;
      IF NOT FOUND OR v_media_mime NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf')
         OR COALESCE(v_media_size, 0) < 1 OR v_media_size > 20971520 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MEDIA_OBJECT_INVALID';
      END IF;
      v_media_url := 'storage://whatsapp-campaign-media/' || v_media_path;
      v_media_type := CASE WHEN v_media_mime LIKE 'image/%' THEN 'image'
        WHEN v_media_mime = 'video/mp4' THEN 'video' ELSE 'document' END;
      v_media_filename := right(v_media_path, 120);
    ELSIF v_step ? 'media_storage_path' THEN
      v_media_path := NULL;
    END IF;

    v_updated := 0;
    FOR v_existing IN
      SELECT * FROM public.comm_whatsapp_campaign_steps AS step
      WHERE step.campaign_id = p_campaign_id
        AND step.step_index = v_step_index
        AND step.variant_label = v_variant_label
      ORDER BY CASE step.variant_label WHEN 'ANY' THEN 0 WHEN 'A' THEN 1 ELSE 2 END
    LOOP
      UPDATE public.comm_whatsapp_campaign_steps AS step
      SET stage_index = COALESCE(v_stage_index, v_existing.stage_index),
          step_kind = COALESCE(v_step_kind, v_existing.step_kind),
          status_to_set = CASE WHEN v_step ? 'status_to_set' THEN v_status_to_set ELSE v_existing.status_to_set END,
          message_text = v_message,
          delay_amount = COALESCE(v_delay, v_existing.delay_amount),
          delay_unit = COALESCE(v_unit, v_existing.delay_unit),
          media_url = CASE WHEN v_step ? 'media_storage_path' THEN v_media_url ELSE v_existing.media_url END,
          media_type = CASE WHEN v_step ? 'media_storage_path' THEN v_media_type ELSE v_existing.media_type END,
          media_filename = CASE WHEN v_step ? 'media_storage_path' THEN v_media_filename ELSE v_existing.media_filename END,
          variant_label = COALESCE(v_variant_label, v_existing.variant_label),
          updated_at = now()
      WHERE step.id = v_existing.id;
      v_updated := v_updated + 1;
    END LOOP;

    IF v_updated = 0 THEN
      v_variant_label := COALESCE(v_variant_label, 'ANY');
      IF COALESCE(v_step_kind, 'message') = 'status_change' AND v_status_to_set IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STATUS_REQUIRED';
      END IF;
      INSERT INTO public.comm_whatsapp_campaign_steps (
        campaign_id, step_index, stage_index, step_kind, status_to_set,
        message_text, delay_amount, delay_unit, media_url, media_type,
        media_filename, variant_label
      ) VALUES (
        p_campaign_id, v_step_index, COALESCE(v_stage_index, 0), COALESCE(v_step_kind, 'message'),
        v_status_to_set, v_message, COALESCE(v_delay, 0), COALESCE(v_unit, 'minutes'),
        v_media_url, v_media_type, v_media_filename, v_variant_label
      );
    END IF;
  END LOOP;

  RETURN v_first_message;
END;
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_preserve_marketing_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD.audience_config ? 'marketing_review'
     AND NOT (COALESCE(NEW.audience_config, '{}'::jsonb) ? 'marketing_review') THEN
    NEW.audience_config := COALESCE(NEW.audience_config, '{}'::jsonb)
      || jsonb_build_object('marketing_review', OLD.audience_config->'marketing_review');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_sync_base_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.message_text IS DISTINCT FROM OLD.message_text THEN
    UPDATE public.comm_whatsapp_campaign_steps AS step
    SET message_text = NEW.message_text, updated_at = now()
    WHERE step.campaign_id = NEW.id
      AND step.step_index = 0
      AND step.variant_label = 'ANY';
    IF NOT FOUND THEN
      UPDATE public.comm_whatsapp_campaign_steps AS step
      SET message_text = NEW.message_text, updated_at = now()
      WHERE step.campaign_id = NEW.id
        AND step.step_index = 0
        AND step.variant_label = 'A';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_sync_base_message ON public.comm_whatsapp_campaigns;
CREATE TRIGGER trg_comm_whatsapp_campaign_sync_base_message
  AFTER UPDATE OF message_text ON public.comm_whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public._comm_whatsapp_campaign_sync_base_message();
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_sync_base_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_preserve_marketing_review ON public.comm_whatsapp_campaigns;
CREATE TRIGGER trg_comm_whatsapp_campaign_preserve_marketing_review
  BEFORE UPDATE OF audience_config ON public.comm_whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public._comm_whatsapp_campaign_preserve_marketing_review();
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_preserve_marketing_review() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._comm_whatsapp_campaign_enforce_activation_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_readiness jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('scheduled', 'queued', 'running') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CAMPAIGN_MUST_BE_ACTIVATED_EXPLICITLY';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('scheduled', 'queued', 'running') THEN
    v_readiness := public.get_comm_whatsapp_campaign_marketing_readiness(NEW.id);
    IF COALESCE((v_readiness->>'ready')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'CAMPAIGN_MARKETING_ELIGIBILITY_PENDING',
        DETAIL = COALESCE((v_readiness->'reason_codes')::text, '[]');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_campaign_activation_readiness ON public.comm_whatsapp_campaigns;
CREATE TRIGGER trg_comm_whatsapp_campaign_activation_readiness
  BEFORE INSERT OR UPDATE OF status ON public.comm_whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public._comm_whatsapp_campaign_enforce_activation_readiness();
REVOKE ALL ON FUNCTION public._comm_whatsapp_campaign_enforce_activation_readiness() FROM PUBLIC, anon, authenticated;

COMMIT;
