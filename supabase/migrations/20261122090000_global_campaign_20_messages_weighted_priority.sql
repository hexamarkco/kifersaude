-- Global WhatsApp campaign message limit and weighted admission.
-- Existing campaign statuses/targets are not changed by this migration.
BEGIN;

ALTER TABLE public.comm_whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS dispatch_priority integer NOT NULL DEFAULT 1;
ALTER TABLE public.comm_whatsapp_campaigns
  DROP CONSTRAINT IF EXISTS comm_whatsapp_campaign_dispatch_priority_check;
ALTER TABLE public.comm_whatsapp_campaigns
  ADD CONSTRAINT comm_whatsapp_campaign_dispatch_priority_check
  CHECK (dispatch_priority IN (1,2,3));

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_global_settings (
  channel_key text PRIMARY KEY,
  daily_message_limit integer NOT NULL CHECK (daily_message_limit BETWEEN 1 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.comm_whatsapp_campaign_global_settings(channel_key,daily_message_limit)
VALUES ('whatsapp',20)
ON CONFLICT(channel_key) DO UPDATE
SET daily_message_limit=20, updated_at=now();

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_global_message_reservations (
  reservation_key text PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.comm_whatsapp_campaigns(id),
  target_id uuid NOT NULL REFERENCES public.comm_whatsapp_campaign_targets(id),
  message_count integer NOT NULL CHECK (message_count BETWEEN 1 AND 1000),
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_campaign_global_messages_reserved_at
  ON public.comm_whatsapp_campaign_global_message_reservations(reserved_at);
ALTER TABLE public.comm_whatsapp_campaign_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_campaign_global_message_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_global_settings_read ON public.comm_whatsapp_campaign_global_settings;
CREATE POLICY campaign_global_settings_read ON public.comm_whatsapp_campaign_global_settings FOR SELECT TO authenticated
USING (public.current_user_can_view_comm_whatsapp() OR public.current_user_can_edit_comm_whatsapp());
REVOKE ALL ON public.comm_whatsapp_campaign_global_message_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.comm_whatsapp_campaign_global_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.comm_whatsapp_campaign_global_settings TO authenticated;

-- Rename the pre-existing implementations once, keeping their complete behavior.
DO $migration$
BEGIN
  IF to_regprocedure('public.reserve_comm_whatsapp_campaign_stage_dispatch_unlimited(uuid,uuid,text,integer,integer,jsonb)') IS NULL THEN
    ALTER FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(uuid,uuid,text,integer,integer,jsonb)
      RENAME TO reserve_comm_whatsapp_campaign_stage_dispatch_unlimited;
  END IF;
  IF to_regprocedure('public.reserve_comm_whatsapp_campaign_stage_dispatch_retry_unlimited(uuid,uuid,text,integer,jsonb)') IS NULL THEN
    ALTER FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(uuid,uuid,text,integer,jsonb)
      RENAME TO reserve_comm_whatsapp_campaign_stage_dispatch_retry_unlimited;
  END IF;
  IF to_regprocedure('public.reserve_comm_whatsapp_campaign_dispatch_unlimited(uuid,uuid,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid,uuid,text,jsonb)
      RENAME TO reserve_comm_whatsapp_campaign_dispatch_unlimited;
  END IF;
END
$migration$;

-- The following wrappers hold the campaign row and the shared quota row before
-- checking capacity; the original reservation is still the authoritative gate.
-- Counting a whole multi-bubble stage before sending is deliberately conservative.
CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(
 p_campaign_id uuid,p_target_id uuid,p_lock_token text,
 p_stage_index integer,p_expected_message_count integer,p_steps jsonb
)
RETURNS TABLE(result text,retry_at timestamptz,reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $quota$
DECLARE
 v_now timestamptz:=clock_timestamp();
 v_key text:='stage:'||p_campaign_id||':'||p_target_id||':'||p_stage_index;
 v_previous timestamptz; v_needed integer; v_used integer; v_next timestamptz;
 v_old record;
BEGIN
  PERFORM 1 FROM public.comm_whatsapp_campaigns WHERE id=p_campaign_id FOR UPDATE;
  PERFORM 1 FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Global WhatsApp quota configuration missing'; END IF;
  SELECT reserved_at INTO v_previous FROM public.comm_whatsapp_campaign_global_message_reservations WHERE reservation_key=v_key;
  v_needed:=CASE WHEN v_previous>=v_now-interval '24 hours' THEN 0 ELSE p_expected_message_count END;
  SELECT COALESCE(sum(message_count),0)::integer,min(reserved_at+interval '24 hours')
    INTO v_used,v_next FROM public.comm_whatsapp_campaign_global_message_reservations
   WHERE reserved_at>v_now-interval '24 hours';
  IF v_needed>0 AND v_used+v_needed>(SELECT daily_message_limit FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp') THEN
    RETURN QUERY SELECT 'daily_limited'::text,COALESCE(v_next,v_now+interval '1 minute'),'Limite global de mensagens em 24h atingido.'::text; RETURN;
  END IF;
  SELECT * INTO v_old FROM public.reserve_comm_whatsapp_campaign_stage_dispatch_unlimited(
    p_campaign_id,p_target_id,p_lock_token,p_stage_index,p_expected_message_count,p_steps);
  IF v_old.result='reserved' AND v_needed>0 THEN
    INSERT INTO public.comm_whatsapp_campaign_global_message_reservations(reservation_key,campaign_id,target_id,message_count,reserved_at)
    VALUES(v_key,p_campaign_id,p_target_id,p_expected_message_count,v_now)
    ON CONFLICT(reservation_key) DO UPDATE SET message_count=excluded.message_count,reserved_at=excluded.reserved_at;
  END IF;
  RETURN QUERY SELECT v_old.result::text,v_old.retry_at::timestamptz,v_old.reason::text;
END;$quota$;

CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(
 p_campaign_id uuid,p_target_id uuid,p_lock_token text,p_stage_index integer,p_steps jsonb
)
RETURNS TABLE(result text,retry_at timestamptz,reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $quota$
DECLARE
 v_now timestamptz:=clock_timestamp(); v_used integer;v_next timestamptz;v_needed integer;v_old record;
BEGIN
  v_needed:=CASE WHEN p_steps IS NULL THEN 1 ELSE GREATEST(jsonb_array_length(p_steps),1) END;
  PERFORM 1 FROM public.comm_whatsapp_campaigns WHERE id=p_campaign_id FOR UPDATE;
  PERFORM 1 FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Global WhatsApp quota configuration missing'; END IF;
  SELECT COALESCE(sum(message_count),0)::integer,min(reserved_at+interval '24 hours')
    INTO v_used,v_next FROM public.comm_whatsapp_campaign_global_message_reservations
   WHERE reserved_at>v_now-interval '24 hours';
  IF v_used+v_needed>(SELECT daily_message_limit FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp') THEN
    RETURN QUERY SELECT 'rate_limited'::text,COALESCE(v_next,v_now+interval '1 minute'),'Limite global de mensagens em 24h atingido.'::text; RETURN;
  END IF;
  SELECT * INTO v_old FROM public.reserve_comm_whatsapp_campaign_stage_dispatch_retry_unlimited(
    p_campaign_id,p_target_id,p_lock_token,p_stage_index,p_steps);
  IF v_old.result='reserved' THEN
    INSERT INTO public.comm_whatsapp_campaign_global_message_reservations(reservation_key,campaign_id,target_id,message_count,reserved_at)
    VALUES('retry:'||gen_random_uuid(),p_campaign_id,p_target_id,v_needed,v_now);
  END IF;
  RETURN QUERY SELECT v_old.result::text,v_old.retry_at::timestamptz,v_old.reason::text;
END;$quota$;

CREATE OR REPLACE FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(
 p_campaign_id uuid,p_target_id uuid,p_lock_token text,p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(result text,event_id uuid,attempts integer,retry_at timestamptz,reason text,reserved_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $quota$
DECLARE
 v_now timestamptz:=clock_timestamp();v_used integer;v_next timestamptz;v_old record;
BEGIN
  PERFORM 1 FROM public.comm_whatsapp_campaigns WHERE id=p_campaign_id FOR UPDATE;
  PERFORM 1 FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Global WhatsApp quota configuration missing'; END IF;
  SELECT COALESCE(sum(message_count),0)::integer,min(reserved_at+interval '24 hours')
    INTO v_used,v_next FROM public.comm_whatsapp_campaign_global_message_reservations
   WHERE reserved_at>v_now-interval '24 hours';
  IF v_used+1>(SELECT daily_message_limit FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp') THEN
    RETURN QUERY SELECT 'daily_limited'::text,NULL::uuid,NULL::integer,COALESCE(v_next,v_now+interval '1 minute'),
      'Limite global de mensagens em 24h atingido.'::text,NULL::timestamptz; RETURN;
  END IF;
  SELECT * INTO v_old FROM public.reserve_comm_whatsapp_campaign_dispatch_unlimited(
    p_campaign_id,p_target_id,p_lock_token,p_payload);
  IF v_old.result='reserved' THEN
    INSERT INTO public.comm_whatsapp_campaign_global_message_reservations(reservation_key,campaign_id,target_id,message_count,reserved_at)
    VALUES('legacy:'||gen_random_uuid(),p_campaign_id,p_target_id,1,v_now);
  END IF;
  RETURN QUERY SELECT v_old.result::text,v_old.event_id::uuid,v_old.attempts::integer,v_old.retry_at::timestamptz,
    v_old.reason::text,v_old.reserved_at::timestamptz;
END;$quota$;

REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(uuid,uuid,text,integer,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(uuid,uuid,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(uuid,uuid,text,integer,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(uuid,uuid,text,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_unlimited(uuid,uuid,text,integer,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry_unlimited(uuid,uuid,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch_unlimited(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_comm_whatsapp_campaign_global_status()
RETURNS TABLE(daily_message_limit integer,reserved_messages_24h integer,remaining_messages integer,next_available_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $quota$
DECLARE v_limit integer;v_used integer;v_next timestamptz;
BEGIN
 IF NOT (public.current_user_can_view_comm_whatsapp() OR public.current_user_can_edit_comm_whatsapp()) THEN
   RAISE EXCEPTION 'Permissao insuficiente';
 END IF;
 SELECT s.daily_message_limit INTO v_limit FROM public.comm_whatsapp_campaign_global_settings s WHERE s.channel_key='whatsapp';
 SELECT COALESCE(sum(r.message_count),0)::integer,min(r.reserved_at+interval '24 hours')
 INTO v_used,v_next FROM public.comm_whatsapp_campaign_global_message_reservations r
 WHERE r.reserved_at>clock_timestamp()-interval '24 hours';
 RETURN QUERY SELECT v_limit,v_used,GREATEST(v_limit-v_used,0),CASE WHEN v_used>=v_limit THEN v_next ELSE NULL::timestamptz END;
END;$quota$;
REVOKE ALL ON FUNCTION public.get_comm_whatsapp_campaign_global_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_global_status() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.set_comm_whatsapp_campaign_global_limit(p_limit integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $quota$
BEGIN
 IF NOT public.current_user_can_edit_comm_whatsapp() THEN RAISE EXCEPTION 'Permissao insuficiente'; END IF;
 IF p_limit NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Limite invalido'; END IF;
 UPDATE public.comm_whatsapp_campaign_global_settings
 SET daily_message_limit=p_limit,updated_at=now() WHERE channel_key='whatsapp';
END;$quota$;
REVOKE ALL ON FUNCTION public.set_comm_whatsapp_campaign_global_limit(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_comm_whatsapp_campaign_global_limit(integer) TO authenticated;

-- Weighted fair share (1 normal, 2 high, 3 maximum).
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
COMMIT;
