-- Durable, privacy-preserving buckets for the public lead form. IP addresses are
-- salted and hashed in the Edge Function before they reach this table.
CREATE TABLE IF NOT EXISTS public.public_lead_rate_limits (
  ip_hash text PRIMARY KEY CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count smallint NOT NULL DEFAULT 1 CHECK (request_count BETWEEN 1 AND 5),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_lead_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_lead_rate_limits FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_lead_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_lead_rate_limit(p_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
BEGIN
  IF p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid public lead rate limit key';
  END IF;

  INSERT INTO public.public_lead_rate_limits (
    ip_hash,
    window_started_at,
    request_count,
    last_seen_at
  )
  VALUES (p_ip_hash, v_now, 1, v_now)
  ON CONFLICT (ip_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN public_lead_rate_limits.window_started_at <= v_now - interval '1 hour' THEN v_now
      ELSE public_lead_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN public_lead_rate_limits.window_started_at <= v_now - interval '1 hour' THEN 1
      ELSE public_lead_rate_limits.request_count + 1
    END,
    last_seen_at = v_now
  WHERE public_lead_rate_limits.window_started_at <= v_now - interval '1 hour'
     OR public_lead_rate_limits.request_count < 5
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_lead_rate_limit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_public_lead_rate_limit(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_lead_rate_limit(text) TO service_role;
