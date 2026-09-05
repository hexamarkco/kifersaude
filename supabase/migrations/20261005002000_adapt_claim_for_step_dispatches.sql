/*
  # Adapt claim query to also block on non-terminal step_dispatches

  The existing NOT EXISTS on target_provider_send_started /
  target_provider_accepted_persistence_pending events continues to work for
  the single-message path. This migration adds an additional guard: a target
  with any step_dispatch in ('sending') state cannot be re-claimed, since a
  burst is actively in progress.

  Dispatches in 'pending' state DO block re-claim too (the stage was
  reserved but the burst hasn't started — the lease holder should be the
  one to execute or abandon them).
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
      -- Guard 2: no non-terminal step_dispatches (burst in progress or reserved)
      AND NOT EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_campaign_step_dispatches AS sd
        WHERE sd.target_id = target.id
          AND sd.status IN ('pending', 'sending')
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
