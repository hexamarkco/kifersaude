-- Allow dynamic reactivation pacing for small daily quotas and long send windows.
-- The worker still supplies the computed interval on each call.
CREATE OR REPLACE FUNCTION public.claim_auto_contact_reactivation_slot(p_interval_seconds integer DEFAULT 1200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_current timestamptz := clock_timestamp();
  v_next timestamptz;
  v_reserved boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE='42501';
  END IF;
  IF p_interval_seconds < 60 OR p_interval_seconds > 86400 THEN
    RAISE EXCEPTION 'interval must be between 60 and 86400 seconds';
  END IF;
  -- Row locking serializes concurrent workers. Do not queue future slots
  -- here: a lead may respond or the automation window may close meanwhile.
  SELECT next_send_at INTO v_next FROM public.auto_contact_reactivation_throttle
  WHERE singleton=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reactivation throttle is not initialized'; END IF;

  IF v_next <= v_current THEN
    v_reserved := true;
    v_next := v_current + make_interval(secs=>p_interval_seconds);
    UPDATE public.auto_contact_reactivation_throttle SET
      next_send_at=v_next,updated_at=v_current
    WHERE singleton=true;
  END IF;
  RETURN jsonb_build_object(
    'allowed',v_reserved,
    'next_available_at',v_next,
    'interval_seconds',p_interval_seconds
  );
END;
$function$
;
