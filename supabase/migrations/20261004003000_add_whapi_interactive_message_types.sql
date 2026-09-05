BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_is_hidden_preview_text(
  p_value text,
  p_message_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  WITH normalized AS (
    SELECT lower(btrim(COALESCE(p_value, ''))) AS value,
      lower(btrim(COALESCE(p_message_type, ''))) AS message_type
  ), marker AS (
    SELECT value, CASE
      WHEN message_type = 'text' THEN '[mensagem]'
      WHEN message_type = 'image' THEN '[imagem]'
      WHEN message_type IN ('video', 'gif', 'short') THEN '[video]'
      WHEN message_type IN ('audio', 'voice') THEN '[audio]'
      WHEN message_type IN ('document', 'documentWithCaption') THEN '[documento]'
      WHEN message_type = 'link_preview' THEN '[link]'
      WHEN message_type IN ('location', 'live_location') THEN '[localizacao]'
      WHEN message_type = 'sticker' THEN '[sticker]'
      WHEN message_type IN ('contact', 'contact_list') THEN '[contato]'
      WHEN message_type = 'poll' THEN '[enquete]'
      WHEN message_type = 'quiz' THEN '[quiz]'
      WHEN message_type = 'question' THEN '[pergunta]'
      WHEN message_type = 'event' THEN '[evento]'
      WHEN message_type = 'product' THEN '[produto]'
      WHEN message_type = 'catalog' THEN '[catalogo]'
      WHEN message_type = 'group_invite' THEN '[convite]'
      WHEN message_type = 'newsletter_invite' THEN '[newsletter]'
      WHEN message_type = 'admin_invite' THEN '[convite admin]'
      WHEN message_type = 'system' THEN '[sistema]'
      WHEN message_type = 'call' THEN '[chamada]'
      WHEN message_type = 'pin' THEN '[fixada]'
      WHEN message_type = 'story' THEN '[status]'
      WHEN message_type = 'album' THEN '[album]'
      WHEN message_type = 'reply' THEN '[resposta]'
      WHEN message_type = 'list' THEN '[lista]'
      WHEN message_type = 'buttons' THEN '[botoes]'
      WHEN message_type IN ('interactive', 'hsm', 'carousel') THEN '[mensagem interativa]'
      WHEN message_type <> '' THEN '[' || message_type || ']'
      ELSE NULL
    END AS message_marker
    FROM normalized
  )
  SELECT value <> '' AND (
    value IN (
      '[mensagem]', '[mensagem sem texto]', '[mensagem sem conteudo]', '[mensagem sem conteúdo]',
      '[payload invalido]', '[payload inválido]', '[acao]', '[ação]', '[action]', '[reacao]', '[reação]',
      '[reaction]', '[atualizacao de midia]', '[atualização de mídia]', '[media update]', '[voto em enquete]'
    )
    OR (message_marker IS NOT NULL AND value = message_marker AND value NOT IN (
      '[imagem]', '[video]', '[documento]', '[audio]', '[link]', '[localizacao]', '[sticker]', '[contato]',
      '[enquete]', '[quiz]', '[pergunta]', '[evento]', '[produto]', '[catalogo]', '[convite]', '[newsletter]',
      '[convite admin]', '[sistema]', '[chamada]', '[fixada]', '[status]', '[album]',
      '[resposta]', '[lista]', '[botoes]', '[mensagem interativa]'
    ))
    OR (value ~ '^\[[^\]]+\]$' AND value NOT IN (
      '[imagem]', '[video]', '[documento]', '[audio]', '[link]', '[localizacao]', '[sticker]', '[contato]',
      '[enquete]', '[quiz]', '[pergunta]', '[evento]', '[produto]', '[catalogo]', '[convite]', '[newsletter]',
      '[convite admin]', '[sistema]', '[chamada]', '[fixada]', '[status]', '[album]',
      '[resposta]', '[lista]', '[botoes]', '[mensagem interativa]'
    ))
  )
  FROM marker;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_message_preview_text(
  p_media_caption text,
  p_text_content text,
  p_message_type text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH candidate AS (
    SELECT NULLIF(btrim(COALESCE(p_media_caption, '')), '') AS caption,
      NULLIF(btrim(COALESCE(p_text_content, '')), '') AS text_content,
      lower(btrim(COALESCE(p_message_type, ''))) AS message_type
  )
  SELECT NULLIF(
    COALESCE(
      CASE WHEN caption IS NOT NULL AND NOT public.comm_whatsapp_is_hidden_preview_text(caption, message_type) THEN caption END,
      CASE WHEN text_content IS NOT NULL AND NOT public.comm_whatsapp_is_hidden_preview_text(text_content, message_type) THEN text_content END,
      CASE
        WHEN message_type IN ('audio', 'voice') THEN '[Audio]'
        WHEN message_type = 'image' THEN '[Imagem]'
        WHEN message_type IN ('video', 'gif', 'short') THEN '[Video]'
        WHEN message_type IN ('document', 'documentWithCaption') THEN '[Documento]'
        WHEN message_type = 'link_preview' THEN '[Link]'
        WHEN message_type IN ('location', 'live_location') THEN '[Localizacao]'
        WHEN message_type = 'sticker' THEN '[Sticker]'
        WHEN message_type IN ('contact', 'contact_list') THEN '[Contato]'
        WHEN message_type = 'poll' THEN '[Enquete]'
        WHEN message_type = 'quiz' THEN '[Quiz]'
        WHEN message_type = 'question' THEN '[Pergunta]'
        WHEN message_type = 'event' THEN '[Evento]'
        WHEN message_type = 'product' THEN '[Produto]'
        WHEN message_type = 'catalog' THEN '[Catalogo]'
        WHEN message_type = 'group_invite' THEN '[Convite]'
        WHEN message_type = 'newsletter_invite' THEN '[Newsletter]'
        WHEN message_type = 'admin_invite' THEN '[Convite admin]'
        WHEN message_type = 'system' THEN '[Sistema]'
        WHEN message_type = 'call' THEN '[Chamada]'
        WHEN message_type = 'pin' THEN '[Fixada]'
        WHEN message_type = 'story' THEN '[Status]'
        WHEN message_type = 'album' THEN '[Album]'
        WHEN message_type = 'reply' THEN '[Resposta]'
        WHEN message_type = 'list' THEN '[Lista]'
        WHEN message_type = 'buttons' THEN '[Botoes]'
        WHEN message_type IN ('interactive', 'hsm', 'carousel') THEN '[Mensagem interativa]'
        ELSE NULL
      END
    ),
    ''
  )
  FROM candidate;
$$;

COMMIT;
