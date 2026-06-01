BEGIN;

WITH ranked_duplicates AS (
  SELECT
    m.id,
    row_number() OVER (
      PARTITION BY
        m.chat_id,
        lower(btrim(COALESCE(m.direction, ''))),
        lower(btrim(COALESCE(m.message_type, ''))),
        date_trunc('second', m.message_at),
        lower(btrim(COALESCE(m.sender_phone, ''))),
        lower(regexp_replace(btrim(COALESCE(NULLIF(m.media_caption, ''), NULLIF(m.text_content, ''), NULLIF(m.transcription_text, ''))), '[[:space:]]+', ' ', 'g'))
      ORDER BY
        CASE WHEN NULLIF(btrim(COALESCE(m.external_message_id, '')), '') IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN NULLIF(btrim(COALESCE(m.media_id, '')), '') IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN NULLIF(btrim(COALESCE(m.transcription_text, '')), '') IS NOT NULL THEN 0 ELSE 1 END,
        CASE lower(btrim(COALESCE(m.delivery_status, '')))
          WHEN 'played' THEN 0
          WHEN 'viewed' THEN 1
          WHEN 'seen' THEN 1
          WHEN 'read' THEN 1
          WHEN 'delivered' THEN 2
          WHEN 'received' THEN 3
          WHEN 'sent' THEN 3
          WHEN 'pending' THEN 4
          ELSE 5
        END,
        m.status_updated_at DESC NULLS LAST,
        m.created_at DESC NULLS LAST,
        m.id DESC
    ) AS duplicate_rank
  FROM public.comm_whatsapp_messages m
  WHERE m.message_at IS NOT NULL
    AND m.direction IN ('inbound', 'outbound')
    AND length(btrim(COALESCE(NULLIF(m.media_caption, ''), NULLIF(m.text_content, ''), NULLIF(m.transcription_text, '')))) >= 12
)
DELETE FROM public.comm_whatsapp_messages m
USING ranked_duplicates d
WHERE m.id = d.id
  AND d.duplicate_rank > 1;

COMMIT;
