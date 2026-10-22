BEGIN;

CREATE OR REPLACE FUNCTION public.advance_step_dispatch(
  p_dispatch_key text,
  p_new_status text,
  p_external_message_id text DEFAULT NULL,
  p_delivery_status text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_next_retry_at timestamptz DEFAULT NULL,
  p_resolution text DEFAULT NULL
)
RETURNS TABLE (
  dispatch_id uuid,
  old_status text,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch public.comm_whatsapp_campaign_step_dispatches%ROWTYPE;
BEGIN
  SELECT * INTO v_dispatch
  FROM public.comm_whatsapp_campaign_step_dispatches
  WHERE dispatch_key = p_dispatch_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  old_status := v_dispatch.status;
  new_status := v_dispatch.status;

  UPDATE public.comm_whatsapp_campaign_step_dispatches AS dispatch
  SET status = p_new_status,
      external_message_id = COALESCE(p_external_message_id, dispatch.external_message_id),
      delivery_status = COALESCE(p_delivery_status, dispatch.delivery_status),
      error_message = p_error_message,
      next_retry_at = p_next_retry_at,
      resolution = COALESCE(p_resolution, dispatch.resolution),
      resolved_at = CASE WHEN p_new_status IN ('sent', 'failed', 'uncertain', 'cancelled', 'skipped')
                         THEN clock_timestamp()
                         ELSE dispatch.resolved_at END,
      provider_accepted_at = CASE WHEN p_new_status = 'sending' AND p_external_message_id IS NOT NULL
                                  THEN clock_timestamp()
                                  ELSE dispatch.provider_accepted_at END,
      persisted_at = CASE WHEN p_new_status = 'sent'
                          THEN clock_timestamp()
                          ELSE dispatch.persisted_at END,
      updated_at = clock_timestamp()
  WHERE dispatch.dispatch_key = p_dispatch_key
    AND (
      (p_new_status = 'sending' AND dispatch.status = 'pending')
      OR (p_new_status = 'sent' AND dispatch.status = 'sending')
      OR (p_new_status = 'failed' AND dispatch.status = 'sending')
      OR (p_new_status = 'uncertain' AND dispatch.status = 'sending')
      OR (p_new_status = 'cancelled' AND dispatch.status IN ('pending', 'sending'))
      OR (p_new_status = 'skipped' AND dispatch.status = 'pending')
      OR (p_new_status = 'sending' AND dispatch.status = 'failed')
    )
  RETURNING dispatch.id, dispatch.status INTO dispatch_id, new_status;

  IF dispatch_id IS NULL THEN
    dispatch_id := v_dispatch.id;
    new_status := v_dispatch.status;
  END IF;

  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_step_dispatch(
  text, text, text, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_step_dispatch(
  text, text, text, text, text, timestamptz, text
) TO service_role;

COMMIT;
