/*
  # Allow service role to recompute WhatsApp campaign counters

  The broadcast worker now reuses the aggregated RPC instead of recalculating
  counters in memory. This patch allows service-role edge functions to invoke
  the same RPC while preserving the existing dashboard permission checks for
  authenticated users.
*/

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
    (COUNT(*) FILTER (WHERE status = 'sent'))::int,
    (COUNT(*) FILTER (WHERE status = 'failed'))::int,
    (COUNT(*) FILTER (WHERE status = 'invalid'))::int
  INTO
    v_total_targets,
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
      WHEN v_pending_targets = 0 AND status = 'running' THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN v_pending_targets = 0 AND status = 'running' THEN COALESCE(completed_at, now())
      ELSE completed_at
    END
  WHERE id = p_campaign_id
  RETURNING * INTO v_campaign;

  RETURN v_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_whatsapp_campaign_counters(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_whatsapp_campaign_counters(uuid) TO authenticated;
