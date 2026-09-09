-- A single persisted slot serializes auto-contact WhatsApp dispatches across
-- concurrent Edge Function invocations. The reservation is short and never
-- holds a database lock while an external WhatsApp request is in progress.
CREATE TABLE IF NOT EXISTS public.auto_contact_dispatch_throttle (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  next_send_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_contact_dispatch_throttle ENABLE ROW LEVEL SECURITY;

INSERT INTO public.auto_contact_dispatch_throttle (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_auto_contact_send_slot(
  p_interval_seconds integer DEFAULT 180
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval interval;
  v_reserved_at timestamptz;
BEGIN
  IF p_interval_seconds < 1 OR p_interval_seconds > 3600 THEN
    RAISE EXCEPTION 'p_interval_seconds must be between 1 and 3600';
  END IF;

  v_interval := make_interval(secs => p_interval_seconds);

  UPDATE public.auto_contact_dispatch_throttle
  SET
    next_send_at = GREATEST(next_send_at, clock_timestamp()) + v_interval,
    updated_at = clock_timestamp()
  WHERE singleton = true
  RETURNING next_send_at - v_interval INTO v_reserved_at;

  RETURN v_reserved_at;
END;
$$;

REVOKE ALL ON TABLE public.auto_contact_dispatch_throttle FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_auto_contact_send_slot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_auto_contact_send_slot(integer) TO service_role;
