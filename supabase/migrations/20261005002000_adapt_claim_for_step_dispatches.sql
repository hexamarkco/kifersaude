/*
  # Adapt claim query to support burst retry

  Guard 2 is refined: a target with pending/sending dispatches is normally
  blocked, UNLESS there is a failed dispatch with next_retry_at <= now()
  (meaning a retry is due). This prevents the deadlock where:
    - msg4 fails retryable → msg5 stays pending → target blocked forever.

  When the burst fails and cancels future pending dispatches, the target
  has no pending/sending rows → claim succeeds. On retry re-entry, the
  burst loop detects the failed step and re-reserves future steps.
*/

BEGIN;

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
    SELECT target.id
    FROM public.comm_whatsapp_campaign_targets AS target
    WHERE target.campaign_id = p_campaign_id
      AND (
        target.status IN ('pending', 'scheduled')
        OR (target.status = 'sending' AND target.locked_at < now() - p_lock_ttl)
      )
      AND target.whatsapp_check_status IN ('skipped', 'valid')
      AND COALESCE(target.next_retry_at, target.next_send_at, '-infinity'::timestamptz) <= now()
      AND (target.locked_at IS NULL OR target.locked_at < now() - p_lock_ttl)
      -- Guard 1: no in-flight events from the single-message path
      AND NOT EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_campaign_events AS pending_event
        WHERE pending_event.target_id = target.id
          AND pending_event.event_type IN (
            'target_provider_send_started',
            'target_provider_accepted_persistence_pending'
          )
          AND NOT (pending_event.payload ? 'recovered_at')
          AND NOT (pending_event.payload ? 'resolved_at')
      )
      -- Guard 2: no non-terminal step_dispatches, EXCEPT when a failed
      -- step has next_retry_at <= now (retry is due). This allows the
      -- target to be re-claimed for retry without deadlock.
      AND (
        NOT EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_campaign_step_dispatches AS sd
          WHERE sd.target_id = target.id
            AND sd.status IN ('pending', 'sending')
        )
        OR EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_campaign_step_dispatches AS sd_retry
          WHERE sd_retry.target_id = target.id
            AND sd_retry.status = 'failed'
            AND sd_retry.next_retry_at IS NOT NULL
            AND sd_retry.next_retry_at <= now()
        )
      )
    ORDER BY
      CASE WHEN COALESCE(target.current_step_index, 0) > 0 THEN 0 ELSE 1 END,
      COALESCE(target.next_send_at, target.next_retry_at, target.created_at),
      target.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  )
  UPDATE public.comm_whatsapp_campaign_targets AS target
  SET status = 'sending',
      locked_at = now(),
      lock_token = p_lock_token,
      error_message = NULL,
      updated_at = now()
  FROM due_targets
  WHERE target.id = due_targets.id
  RETURNING target.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) TO service_role;

COMMIT;
