-- Shared pacing only for reactivation of existing conversations in Contato Inicial
-- and Atendimento. New-lead outreach and AI autonomous replies remain unchanged.
CREATE TABLE IF NOT EXISTS public.auto_contact_reactivation_throttle (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  next_send_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auto_contact_reactivation_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_contact_reactivation_throttle FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.auto_contact_reactivation_throttle TO service_role;
INSERT INTO public.auto_contact_reactivation_throttle(singleton,next_send_at)
VALUES (true,now()) ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_auto_contact_reactivation_slot(
  p_interval_seconds integer DEFAULT 1200
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public
AS $claim$
DECLARE
  v_current timestamptz := clock_timestamp();
  v_next timestamptz;
  v_reserved boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE='42501';
  END IF;
  IF p_interval_seconds < 60 OR p_interval_seconds > 3600 THEN
    RAISE EXCEPTION 'interval must be between 60 and 3600 seconds';
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
$claim$;

REVOKE ALL ON FUNCTION public.claim_auto_contact_reactivation_slot(integer)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_auto_contact_reactivation_slot(integer) TO service_role;
