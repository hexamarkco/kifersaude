-- Align the autonomous turn guard with the Inbox's technical marker visibility.
-- Keep audit rows intact; only exclude non-conversational events from AI turns.
CREATE OR REPLACE FUNCTION public.latest_ai_autonomous_inbound(p_chat_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT m.id
  FROM public.comm_whatsapp_messages AS m
  CROSS JOIN LATERAL (
    SELECT
      lower(btrim(coalesce(m.message_type, ''))) AS kind,
      translate(lower(btrim(coalesce(m.text_content, ''))),
        'áàâãéêíóôõúüç', 'aaaaeeiooouuc') AS marker,
      btrim(coalesce(m.media_caption, '')) AS caption,
      btrim(coalesce(m.transcription_text, '')) AS transcription
  ) AS visible
  WHERE m.chat_id = p_chat_id
    AND m.direction = 'inbound'
    -- Provider status, receipts, phone events and chat-state transitions
    -- must never become a customer reply.
    AND visible.kind NOT IN (
      'receipt', 'ack', 'status', 'notification', 'reaction', 'protocol',
      'system', 'call', 'pin', 'story'
    )
    -- Bare action markers are audit records, not messages to answer.
    AND NOT (
      visible.kind = 'action'
      AND (visible.marker = '' OR visible.marker ~ '^\[[^]]+\]$')
    )
    -- The Inbox hides generic technical placeholders when they carry
    -- neither real text/caption/transcription nor actual media.
    AND NOT (
      visible.marker ~ '^\[[^]]+\]$'
      AND visible.marker NOT IN (
        '[imagem]', '[video]', '[documento]', '[audio]', '[link]',
        '[localizacao]', '[sticker]', '[contato]', '[enquete]', '[quiz]',
        '[pergunta]', '[evento]', '[produto]', '[catalogo]', '[convite]',
        '[newsletter]', '[convite admin]', '[sistema]', '[chamada]',
        '[fixada]', '[status]', '[resposta]', '[lista]', '[botoes]',
        '[mensagem interativa]'
      )
      AND visible.caption = '' AND visible.transcription = ''
      AND m.media_id IS NULL AND m.media_url IS NULL
    )
    AND (
      visible.marker <> '' OR visible.caption <> '' OR visible.transcription <> ''
      OR m.media_id IS NOT NULL OR m.media_url IS NOT NULL
      OR visible.kind IN ('image', 'video', 'gif', 'short', 'document',
        'audio', 'voice', 'sticker', 'contact', 'contact_list')
    )
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.latest_ai_autonomous_inbound(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.latest_ai_autonomous_inbound(uuid) TO service_role;
