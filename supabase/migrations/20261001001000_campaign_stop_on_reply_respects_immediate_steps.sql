/*
  # Campaign stop_on_reply must ignore invisible inbound events

  The webhook calls this RPC for every inbound message. Technical WhatsApp
  events such as message_type='unknown' with text '[Mensagem]' are persisted
  for audit/debugging, but they are intentionally hidden from the inbox and
  must not stop a campaign sequence.

  Real replies during a zero-delay message package are still recorded in
  responded_at, but the sequence only stops before the next step that has a
  real wait, matching the campaign worker behavior.
*/

CREATE OR REPLACE FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(
  p_chat_id uuid,
  p_message_at timestamptz
)
RETURNS TABLE(target_id uuid, campaign_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  v_phone_digits text;
  v_inbound_preview text;
BEGIN
  IF v_chat_id IS NULL THEN
    RETURN;
  END IF;

  SELECT NULLIF(btrim(chat.phone_digits), '')
  INTO v_phone_digits
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id;

  SELECT public.comm_whatsapp_message_preview_text(
      message.media_caption,
      message.text_content,
      message.message_type
    )
  INTO v_inbound_preview
  FROM public.comm_whatsapp_messages AS message
  WHERE public.comm_whatsapp_resolve_chat_uuid(message.chat_id) = v_chat_id
    AND message.direction = 'inbound'
    AND message.message_at >= p_message_at - interval '2 seconds'
    AND message.message_at <= p_message_at + interval '2 seconds'
  ORDER BY abs(extract(epoch FROM (message.message_at - p_message_at))),
    message.created_at DESC,
    message.id DESC
  LIMIT 1;

  IF v_inbound_preview IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matched_target AS (
    SELECT
      target.id,
      target.campaign_id,
      target.status,
      target.current_step_index,
      step.id AS step_id,
      step.delay_amount,
      CASE
        WHEN target.status = 'sent' THEN true
        WHEN step.id IS NULL THEN true
        ELSE COALESCE(step.delay_amount, 0) > 0
      END AS should_stop
    FROM public.comm_whatsapp_campaign_targets AS target
    JOIN public.comm_whatsapp_campaigns AS campaign ON campaign.id = target.campaign_id
    LEFT JOIN LATERAL (
      SELECT campaign_step.id, campaign_step.delay_amount
      FROM public.comm_whatsapp_campaign_steps AS campaign_step
      WHERE campaign_step.campaign_id = target.campaign_id
        AND campaign_step.step_index = COALESCE(target.current_step_index, 0)
        AND campaign_step.variant_label IN ('ANY', COALESCE(target.ab_variant, 'A'))
      ORDER BY
        CASE
          WHEN campaign_step.variant_label = COALESCE(target.ab_variant, 'A') THEN 0
          WHEN campaign_step.variant_label = 'ANY' THEN 1
          ELSE 2
        END
      LIMIT 1
    ) AS step ON true
    WHERE (
        public.comm_whatsapp_resolve_chat_uuid(target.chat_id) = v_chat_id
        OR (
          v_phone_digits IS NOT NULL
          AND public.comm_whatsapp_phone_lookup_keys(target.phone_digits)
            && public.comm_whatsapp_phone_lookup_keys(v_phone_digits)
        )
      )
      AND campaign.stop_on_reply = true
      AND target.status IN ('scheduled', 'sent', 'sending')
      AND target.responded_at IS NULL
    ORDER BY target.sent_at DESC NULLS LAST
    LIMIT 1
  )
  UPDATE public.comm_whatsapp_campaign_targets AS target
  SET status = CASE WHEN matched_target.should_stop THEN 'responded' ELSE target.status END,
      responded_at = p_message_at,
      stopped_at = CASE WHEN matched_target.should_stop THEN p_message_at ELSE target.stopped_at END,
      stopped_reason = CASE WHEN matched_target.should_stop THEN 'inbound_reply' ELSE target.stopped_reason END,
      chat_id = v_chat_id,
      updated_at = now()
  FROM matched_target
  WHERE target.id = matched_target.id
  RETURNING matched_target.id, matched_target.campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(uuid, timestamptz) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(uuid, timestamptz) TO service_role;

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
  v_channel_id uuid;
  v_chat_id uuid;
BEGIN
  SELECT channel.id
  INTO v_channel_id
  FROM public.comm_whatsapp_channels AS channel
  WHERE channel.slug = 'primary'
  LIMIT 1;

  v_chat_id := public.comm_whatsapp_resolve_canonical_chat_uuid(v_channel_id, p_external_chat_id);
  IF v_chat_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT result.target_id, result.campaign_id
  FROM public.resolve_comm_whatsapp_campaign_stop_on_reply(v_chat_id, p_message_at) AS result;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(text, timestamptz) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(text, timestamptz) TO service_role;
