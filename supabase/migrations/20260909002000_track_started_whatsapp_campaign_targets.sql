/*
  # Track started WhatsApp campaign targets

  - Backfills `sent_at` for targets that already sent at least one campaign step.
  - Recomputes campaign counters so `sent_targets` reflects contacted leads.
  - Keeps campaign completion tied to open targets, not just untouched ones.
*/

UPDATE public.whatsapp_campaign_targets
SET sent_at = COALESCE(sent_at, last_sent_step_at, last_attempt_at, created_at)
WHERE sent_at IS NULL
  AND COALESCE(last_completed_step_index, -1) >= 0;

CREATE OR REPLACE FUNCTION public.recompute_whatsapp_campaign_counters(
  p_campaign_id uuid
)
RETURNS public.whatsapp_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.whatsapp_campaigns%ROWTYPE;
  v_total_targets integer := 0;
  v_open_targets integer := 0;
  v_pending_targets integer := 0;
  v_sent_targets integer := 0;
  v_failed_targets integer := 0;
  v_invalid_targets integer := 0;
  v_auth_role text := auth.role();
BEGIN
  IF auth.uid() IS NULL AND COALESCE(v_auth_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF COALESCE(v_auth_role, '') <> 'service_role' AND NOT public.current_user_can_edit_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para recalcular contadores de campanhas do WhatsApp';
  END IF;

  SELECT *
  INTO v_campaign
  FROM public.whatsapp_campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha nao encontrada';
  END IF;

  SELECT
    COUNT(*)::int,
    (COUNT(*) FILTER (WHERE status IN ('pending', 'processing')))::int,
    (
      COUNT(*) FILTER (
        WHERE status IN ('pending', 'processing')
          AND COALESCE(last_completed_step_index, -1) < 0
          AND sent_at IS NULL
      )
    )::int,
    (
      COUNT(*) FILTER (
        WHERE status = 'sent'
          OR sent_at IS NOT NULL
          OR COALESCE(last_completed_step_index, -1) >= 0
      )
    )::int,
    (COUNT(*) FILTER (WHERE status = 'failed'))::int,
    (COUNT(*) FILTER (WHERE status = 'invalid'))::int
  INTO
    v_total_targets,
    v_open_targets,
    v_pending_targets,
    v_sent_targets,
    v_failed_targets,
    v_invalid_targets
  FROM public.whatsapp_campaign_targets
  WHERE campaign_id = p_campaign_id;

  UPDATE public.whatsapp_campaigns
  SET
    total_targets = v_total_targets,
    pending_targets = v_pending_targets,
    sent_targets = v_sent_targets,
    failed_targets = v_failed_targets,
    invalid_targets = v_invalid_targets,
    status = CASE
      WHEN v_open_targets = 0 AND status = 'running' THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN v_open_targets = 0 AND status = 'running' THEN COALESCE(completed_at, now())
      ELSE completed_at
    END
  WHERE id = p_campaign_id
  RETURNING * INTO v_campaign;

  RETURN v_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_whatsapp_campaign_counters(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_whatsapp_campaign_counters(uuid) TO authenticated;

WITH aggregated AS (
  SELECT
    campaign_id,
    COUNT(*)::int AS total_targets,
    (COUNT(*) FILTER (WHERE status IN ('pending', 'processing')))::int AS open_targets,
    (
      COUNT(*) FILTER (
        WHERE status IN ('pending', 'processing')
          AND COALESCE(last_completed_step_index, -1) < 0
          AND sent_at IS NULL
      )
    )::int AS pending_targets,
    (
      COUNT(*) FILTER (
        WHERE status = 'sent'
          OR sent_at IS NOT NULL
          OR COALESCE(last_completed_step_index, -1) >= 0
      )
    )::int AS sent_targets,
    (COUNT(*) FILTER (WHERE status = 'failed'))::int AS failed_targets,
    (COUNT(*) FILTER (WHERE status = 'invalid'))::int AS invalid_targets
  FROM public.whatsapp_campaign_targets
  GROUP BY campaign_id
)
UPDATE public.whatsapp_campaigns c
SET
  total_targets = a.total_targets,
  pending_targets = a.pending_targets,
  sent_targets = a.sent_targets,
  failed_targets = a.failed_targets,
  invalid_targets = a.invalid_targets,
  status = CASE
    WHEN a.open_targets = 0 AND c.status = 'running' THEN 'completed'
    ELSE c.status
  END,
  completed_at = CASE
    WHEN a.open_targets = 0 AND c.status = 'running' THEN COALESCE(c.completed_at, now())
    ELSE c.completed_at
  END
FROM aggregated a
WHERE c.id = a.campaign_id;

UPDATE public.whatsapp_campaigns c
SET
  total_targets = 0,
  pending_targets = 0,
  sent_targets = 0,
  failed_targets = 0,
  invalid_targets = 0,
  status = CASE
    WHEN c.status = 'running' THEN 'completed'
    ELSE c.status
  END,
  completed_at = CASE
    WHEN c.status = 'running' THEN COALESCE(c.completed_at, now())
    ELSE c.completed_at
  END
WHERE NOT EXISTS (
  SELECT 1
  FROM public.whatsapp_campaign_targets t
  WHERE t.campaign_id = c.id
);
