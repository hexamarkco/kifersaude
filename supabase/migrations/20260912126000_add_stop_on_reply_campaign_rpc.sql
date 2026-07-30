CREATE OR REPLACE FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(
  p_external_chat_id text,
  p_message_at timestamptz
)
RETURNS TABLE(target_id uuid, campaign_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_digits text;
BEGIN
  v_phone_digits := regexp_replace(p_external_chat_id, '@.*$', '');

  IF v_phone_digits = '' OR v_phone_digits = p_external_chat_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matched_target AS (
    SELECT t.id, t.campaign_id
    FROM public.comm_whatsapp_campaign_targets t
    JOIN public.comm_whatsapp_campaigns c ON c.id = t.campaign_id
    WHERE t.phone_digits = v_phone_digits
      AND c.stop_on_reply = true
      AND t.status IN ('scheduled', 'sent', 'sending')
      AND t.responded_at IS NULL
    ORDER BY t.sent_at DESC NULLS LAST
    LIMIT 1
  )
  UPDATE public.comm_whatsapp_campaign_targets t
  SET status = 'responded',
      responded_at = p_message_at,
      stopped_at = p_message_at,
      stopped_reason = 'inbound_reply',
      updated_at = now()
  FROM matched_target
  WHERE t.id = matched_target.id
  RETURNING matched_target.id, matched_target.campaign_id;
END;
$$;
