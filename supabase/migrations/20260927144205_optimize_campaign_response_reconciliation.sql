BEGIN;

-- The campaign worker reconciles up to 500 sent targets on every run. The
-- previous implementation resolved the canonical chat and loaded messages
-- through separate HTTP requests for every target, creating a large N+1 burst
-- in PostgREST. Keep the same visibility and 20-second auto-reply guardrails,
-- but let Postgres resolve the whole batch in one request.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_find_campaign_replies(
  p_targets jsonb
)
RETURNS TABLE(
  target_id uuid,
  chat_id uuid,
  message_id uuid,
  message_type text,
  text_content text,
  media_caption text,
  transcription_text text,
  message_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT
      target.target_id,
      target.chat_id,
      NULLIF(btrim(target.phone_digits), '') AS phone_digits,
      target.sent_at,
      target.sent_at + interval '20 seconds' AS earliest_genuine_reply_at
    FROM jsonb_to_recordset(COALESCE(p_targets, '[]'::jsonb)) AS target(
      target_id uuid,
      chat_id uuid,
      phone_digits text,
      sent_at timestamptz
    )
    WHERE target.target_id IS NOT NULL
      AND target.sent_at IS NOT NULL
  ),
  resolved AS (
    SELECT
      requested.*,
      CASE
        WHEN requested.chat_id IS NULL THEN NULL::uuid
        ELSE public.comm_whatsapp_resolve_chat_uuid(requested.chat_id)
      END AS canonical_chat_id
    FROM requested
  ),
  candidate_chats AS (
    SELECT DISTINCT ON (resolved.target_id)
      resolved.target_id,
      COALESCE(resolved.canonical_chat_id, phone_chat.id) AS chat_id,
      resolved.earliest_genuine_reply_at
    FROM resolved
    LEFT JOIN public.comm_whatsapp_chats AS phone_chat
      ON resolved.canonical_chat_id IS NULL
      AND phone_chat.phone_digits = resolved.phone_digits
      AND phone_chat.merged_into_chat_id IS NULL
      AND phone_chat.deleted_at IS NULL
    JOIN public.comm_whatsapp_chats AS chat
      ON chat.id = COALESCE(resolved.canonical_chat_id, phone_chat.id)
    WHERE chat.last_message_direction = 'inbound'
      AND chat.last_message_at > resolved.earliest_genuine_reply_at
      AND chat.merged_into_chat_id IS NULL
      AND chat.deleted_at IS NULL
    ORDER BY
      resolved.target_id,
      chat.last_message_at DESC NULLS LAST,
      chat.updated_at DESC
  ),
  latest_visible AS (
    SELECT
      candidate.target_id,
      candidate.chat_id,
      message.id AS message_id,
      message.message_type,
      message.text_content,
      message.media_caption,
      message.transcription_text,
      message.message_at,
      public.comm_whatsapp_message_preview_text(
        message.media_caption,
        message.text_content,
        message.message_type
      ) AS preview_text
    FROM candidate_chats AS candidate
    CROSS JOIN LATERAL (
      SELECT
        message.id,
        message.message_type,
        message.text_content,
        message.media_caption,
        message.transcription_text,
        message.message_at,
        public.comm_whatsapp_message_preview_text(
          message.media_caption,
          message.text_content,
          message.message_type
        ) AS preview_text
      FROM public.comm_whatsapp_messages AS message
      WHERE message.chat_id = candidate.chat_id
        AND message.direction = 'inbound'
        AND message.message_at > candidate.earliest_genuine_reply_at
      ORDER BY message.message_at DESC, message.created_at DESC, message.id DESC
      LIMIT 10
    ) AS message
    WHERE message.preview_text IS NOT NULL
  )
  SELECT DISTINCT ON (latest_visible.target_id)
    latest_visible.target_id,
    latest_visible.chat_id,
    latest_visible.message_id,
    latest_visible.message_type,
    latest_visible.text_content,
    latest_visible.media_caption,
    latest_visible.transcription_text,
    latest_visible.message_at
  FROM latest_visible
  ORDER BY latest_visible.target_id, latest_visible.message_at DESC, latest_visible.message_id DESC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_find_campaign_replies(jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_find_campaign_replies(jsonb) TO service_role;

COMMIT;
