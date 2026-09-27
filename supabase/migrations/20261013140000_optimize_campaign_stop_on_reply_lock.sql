BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- This lookup runs for every inbound message and is best-effort in the
-- webhook. Resolving the canonical chat does not mutate identity state, so
-- it must not wait for a row lock held by a concurrent chat update.
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
  v_chat_id uuid := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);
  v_chat_ids uuid[];
  v_phone_digits text;
  v_phone_lookup_keys text[];
  v_inbound_preview text;
BEGIN
  IF v_chat_id IS NULL THEN
    RETURN;
  END IF;

  SELECT NULLIF(btrim(chat.phone_digits), '')
  INTO v_phone_digits
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id;

  -- Resolve the canonical chat and its merged aliases once. The previous
  -- implementation called comm_whatsapp_resolve_chat_uuid(message.chat_id)
  -- and the same function on every campaign target row, preventing the
  -- existing chat_id indexes from being used efficiently.
  SELECT COALESCE(array_agg(resolved.id), ARRAY[v_chat_id]::uuid[])
  INTO v_chat_ids
  FROM (
    WITH RECURSIVE chat_tree(id, path) AS (
      SELECT chat.id, ARRAY[chat.id]::uuid[]
      FROM public.comm_whatsapp_chats AS chat
      WHERE chat.id = v_chat_id

      UNION ALL

      SELECT alias_chat.id, chat_tree.path || alias_chat.id
      FROM public.comm_whatsapp_chats AS alias_chat
      JOIN chat_tree ON alias_chat.merged_into_chat_id = chat_tree.id
      WHERE NOT alias_chat.id = ANY(chat_tree.path)
    )
    SELECT chat_tree.id
    FROM chat_tree
  ) AS resolved;

  v_phone_lookup_keys := public.comm_whatsapp_phone_lookup_keys(v_phone_digits);

  SELECT public.comm_whatsapp_message_preview_text(
      message.media_caption,
      message.text_content,
      message.message_type
    )
  INTO v_inbound_preview
  FROM public.comm_whatsapp_messages AS message
  WHERE message.chat_id = ANY(v_chat_ids)
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
        target.chat_id = ANY(v_chat_ids)
        OR (
          v_phone_digits IS NOT NULL
          AND public.comm_whatsapp_phone_lookup_keys(target.phone_digits)
            && v_phone_lookup_keys
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

COMMIT;
