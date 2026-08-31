/*
  # Prioritize due follow-up steps in WhatsApp campaign queue

  Multi-message campaign stages flatten into individual campaign steps. The
  daily cap/pacing gate only applies to step 0 (new-contact admission), but the
  claim queue was ordering old step-0 targets ahead of already-admitted targets
  waiting on step 1+. In large CSV campaigns this starved the immediate
  follow-up messages behind thousands of new contacts that were rate-limited.
*/

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
