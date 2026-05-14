BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_leads_by_conversation_topic(
  p_search text,
  p_terms text[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  chat jsonb,
  lead jsonb,
  latest_message_at timestamptz,
  match_count integer,
  snippets jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50) AS safe_limit,
      ARRAY(
        SELECT DISTINCT normalized.term
        FROM (
          SELECT NULLIF(btrim(COALESCE(p_search, '')), '') AS value
          UNION ALL
          SELECT NULLIF(btrim(term), '') AS value
          FROM unnest(COALESCE(p_terms, ARRAY[]::text[])) AS term
        ) raw
        CROSS JOIN LATERAL (
          SELECT NULLIF(
            translate(
              lower(raw.value),
              'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
              'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
            ),
            ''
          ) AS term
        ) normalized
        WHERE normalized.term IS NOT NULL
      ) AS terms
  ),
  matched_messages AS (
    SELECT
      m.id,
      m.chat_id,
      m.message_at,
      m.created_at,
      m.direction,
      m.message_type,
      COALESCE(NULLIF(btrim(m.text_content), ''), NULLIF(btrim(m.media_caption), ''), NULLIF(btrim(m.transcription_text), ''), '[' || COALESCE(NULLIF(btrim(m.message_type), ''), 'mensagem') || ']') AS snippet_text
    FROM public.comm_whatsapp_messages m
    CROSS JOIN input
    CROSS JOIN LATERAL (
      SELECT translate(
        lower(COALESCE(m.text_content, '') || ' ' || COALESCE(m.media_caption, '') || ' ' || COALESCE(m.transcription_text, '')),
        'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
      ) AS searchable_text
    ) normalized_message
    WHERE cardinality(input.terms) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(input.terms) AS term
        WHERE normalized_message.searchable_text LIKE '%' || term || '%'
      )
  ),
  ranked_messages AS (
    SELECT
      mm.*,
      row_number() OVER (PARTITION BY mm.chat_id ORDER BY mm.message_at DESC, mm.created_at DESC, mm.id DESC) AS snippet_rank,
      count(*) OVER (PARTITION BY mm.chat_id) AS chat_match_count,
      max(mm.message_at) OVER (PARTITION BY mm.chat_id) AS chat_latest_message_at
    FROM matched_messages mm
  ),
  grouped_chats AS (
    SELECT
      c.id AS chat_id,
      to_jsonb(c) || jsonb_build_object('lead_status', l.status) AS chat,
      CASE
        WHEN l.id IS NULL THEN NULL::jsonb
        ELSE jsonb_build_object(
          'id', l.id,
          'nome_completo', l.nome_completo,
          'telefone', l.telefone,
          'status_nome', l.status,
          'status_value', l.status,
          'responsavel_label', ro.label,
          'responsavel_value', COALESCE(ro.value, '')
        )
      END AS lead,
      max(rm.chat_latest_message_at) AS latest_message_at,
      max(rm.chat_match_count)::integer AS match_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'messageId', rm.id,
            'direction', rm.direction,
            'type', rm.message_type,
            'at', rm.message_at,
            'text', left(rm.snippet_text, 500)
          )
          ORDER BY rm.message_at DESC, rm.created_at DESC, rm.id DESC
        ) FILTER (WHERE rm.snippet_rank <= 3),
        '[]'::jsonb
      ) AS snippets
    FROM ranked_messages rm
    JOIN public.comm_whatsapp_chats c ON c.id = rm.chat_id
    LEFT JOIN public.leads l ON l.id = c.lead_id
    LEFT JOIN public.lead_responsaveis ro ON ro.id = l.responsavel_id
    GROUP BY c.id, l.id, ro.label, ro.value
  )
  SELECT
    grouped_chats.chat,
    grouped_chats.lead,
    grouped_chats.latest_message_at,
    grouped_chats.match_count,
    grouped_chats.snippets
  FROM grouped_chats
  ORDER BY grouped_chats.latest_message_at DESC NULLS LAST, grouped_chats.chat_id DESC
  LIMIT (SELECT safe_limit FROM input);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_leads_by_conversation_topic(text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_leads_by_conversation_topic(text, text[], integer) TO service_role;

COMMIT;
