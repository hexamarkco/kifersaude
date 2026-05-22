/*
  # Harden WhatsApp campaign queue processing

  Adds target-level locking metadata and a SECURITY DEFINER claim helper so
  concurrent cron/manual worker executions cannot process the same target batch.
*/

ALTER TABLE public.comm_whatsapp_campaign_targets
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_token text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

ALTER TABLE public.comm_whatsapp_campaign_targets
  DROP CONSTRAINT IF EXISTS comm_whatsapp_campaign_targets_retry_count_check;

ALTER TABLE public.comm_whatsapp_campaign_targets
  ADD CONSTRAINT comm_whatsapp_campaign_targets_retry_count_check CHECK (retry_count >= 0);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_due_queue
  ON public.comm_whatsapp_campaign_targets (campaign_id, status, next_send_at, created_at)
  WHERE status IN ('pending', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_lock
  ON public.comm_whatsapp_campaign_targets (locked_at)
  WHERE locked_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_comm_whatsapp_campaign_targets(
  p_campaign_id uuid,
  p_limit integer DEFAULT 25,
  p_lock_token text DEFAULT gen_random_uuid()::text,
  p_lock_ttl interval DEFAULT interval '15 minutes'
)
RETURNS SETOF public.comm_whatsapp_campaign_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due_targets AS (
    SELECT id
    FROM public.comm_whatsapp_campaign_targets
    WHERE campaign_id = p_campaign_id
      AND (
        status IN ('pending', 'scheduled')
        OR (status = 'sending' AND locked_at < now() - p_lock_ttl)
      )
      AND COALESCE(next_retry_at, next_send_at, '-infinity'::timestamptz) <= now()
      AND (locked_at IS NULL OR locked_at < now() - p_lock_ttl)
    ORDER BY COALESCE(next_send_at, created_at), created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  )
  UPDATE public.comm_whatsapp_campaign_targets target
  SET status = 'sending',
      locked_at = now(),
      lock_token = p_lock_token,
      attempts = target.attempts + 1,
      last_attempt_at = now(),
      error_message = NULL,
      updated_at = now()
  FROM due_targets
  WHERE target.id = due_targets.id
  RETURNING target.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) TO service_role;
