BEGIN;

WITH latest_visible_message AS (
  SELECT DISTINCT ON (m.chat_id)
    m.chat_id,
    m.direction,
    m.message_at,
    m.delivery_status,
    NULLIF(
      CASE
        WHEN lower(btrim(COALESCE(NULLIF(btrim(m.media_caption), ''), NULLIF(btrim(m.text_content), ''), ''))) IN (
          '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[mensagem sem conteúdo]',
          '[payload invalido]', '[payload inválido]', '[acao]', '[ação]', '[action]', '[reacao]', '[reação]',
          '[reaction]', '[atualizacao de midia]', '[atualização de mídia]', '[media update]', '[voto em enquete]'
        ) THEN ''
        ELSE COALESCE(
          NULLIF(btrim(m.media_caption), ''),
          NULLIF(btrim(m.text_content), ''),
          CASE
            WHEN m.message_type IN ('audio', 'voice') THEN '[Áudio]'
            WHEN m.message_type = 'image' THEN '[Imagem]'
            WHEN m.message_type = 'video' THEN '[Vídeo]'
            WHEN m.message_type = 'document' THEN '[Documento]'
            WHEN m.message_type IS NOT NULL THEN '[' || initcap(m.message_type) || ']'
            ELSE NULL
          END
        )
      END,
      ''
    ) AS preview_text
  FROM public.comm_whatsapp_messages m
  ORDER BY m.chat_id, m.message_at DESC, m.created_at DESC, m.id DESC
)
UPDATE public.comm_whatsapp_chats c
SET
  last_message_text = latest_visible_message.preview_text,
  last_message_direction = COALESCE(NULLIF(btrim(c.last_message_direction), ''), latest_visible_message.direction),
  last_message_at = COALESCE(c.last_message_at, latest_visible_message.message_at),
  updated_at = now()
FROM latest_visible_message
WHERE latest_visible_message.chat_id = c.id
  AND latest_visible_message.preview_text IS NOT NULL
  AND (
    NULLIF(btrim(COALESCE(c.last_message_text, '')), '') IS NULL
    OR lower(btrim(COALESCE(c.last_message_text, ''))) IN (
      '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[mensagem sem conteúdo]',
      '[payload invalido]', '[payload inválido]', '[acao]', '[ação]', '[action]', '[reacao]', '[reação]',
      '[reaction]', '[atualizacao de midia]', '[atualização de mídia]', '[media update]', '[voto em enquete]'
    )
  );

COMMIT;
