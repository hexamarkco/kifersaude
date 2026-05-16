BEGIN;

DROP FUNCTION IF EXISTS public.comm_whatsapp_search_leads_by_conversation_topic(text, text[], integer);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_leads_by_conversation_topic(
  p_search text,
  p_terms text[] DEFAULT NULL,
  p_required_terms text[] DEFAULT NULL,
  p_optional_terms text[] DEFAULT NULL,
  p_direction text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
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
      NULLIF(lower(btrim(COALESCE(p_direction, ''))), '') AS direction_filter,
      p_since AS since_filter,
      ARRAY(
        SELECT DISTINCT normalized.term
        FROM (
          SELECT NULLIF(btrim(COALESCE(p_search, '')), '') AS value
          UNION ALL
          SELECT NULLIF(btrim(term), '') AS value
          FROM unnest(COALESCE(p_required_terms, ARRAY[]::text[])) AS term
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
      ) AS required_terms,
      ARRAY(
        SELECT DISTINCT normalized.term
        FROM (
          SELECT NULLIF(btrim(term), '') AS value
          FROM unnest(COALESCE(p_optional_terms, p_terms, ARRAY[]::text[])) AS term
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
      ) AS optional_terms
  ),
  matched_messages AS (
    SELECT
      m.id,
      m.chat_id,
      m.message_at,
      m.created_at,
      m.direction,
      m.message_type,
      COALESCE(NULLIF(btrim(m.text_content), ''), NULLIF(btrim(m.media_caption), ''), NULLIF(btrim(m.transcription_text), ''), '[' || COALESCE(NULLIF(btrim(m.message_type), ''), 'mensagem') || ']') AS snippet_text,
      (
        SELECT count(*)::integer
        FROM unnest(input.optional_terms) AS term
        WHERE normalized_message.searchable_text LIKE '%' || term || '%'
      ) AS optional_match_count
    FROM public.comm_whatsapp_messages m
    CROSS JOIN input
    CROSS JOIN LATERAL (
      SELECT translate(
        lower(COALESCE(m.text_content, '') || ' ' || COALESCE(m.media_caption, '') || ' ' || COALESCE(m.transcription_text, '')),
        'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
      ) AS searchable_text
    ) normalized_message
    WHERE cardinality(input.required_terms) > 0
      AND (input.direction_filter IS NULL OR lower(m.direction) = input.direction_filter)
      AND (input.since_filter IS NULL OR m.message_at >= input.since_filter)
      AND EXISTS (
        SELECT 1
        FROM unnest(input.required_terms) AS term
        WHERE normalized_message.searchable_text LIKE '%' || term || '%'
      )
  ),
  ranked_messages AS (
    SELECT
      mm.*,
      row_number() OVER (PARTITION BY mm.chat_id ORDER BY mm.message_at DESC, mm.created_at DESC, mm.id DESC) AS snippet_rank,
      count(*) OVER (PARTITION BY mm.chat_id) AS chat_match_count,
      max(mm.message_at) OVER (PARTITION BY mm.chat_id) AS chat_latest_message_at,
      sum(mm.optional_match_count) OVER (PARTITION BY mm.chat_id) AS chat_optional_score
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
            'text', left(rm.snippet_text, 500),
            'matchedRequiredTerm', true,
            'optionalMatchCount', rm.optional_match_count
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

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_leads_by_conversation_topic(text, text[], text[], text[], text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_leads_by_conversation_topic(text, text[], text[], text[], text, timestamptz, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_cotador_quotes_by_topic(
  p_search text,
  p_terms text[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  quote jsonb,
  lead jsonb,
  latest_item_at timestamptz,
  match_count integer,
  items jsonb
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
  matched_items AS (
    SELECT
      q.id AS quote_id,
      qi.id AS item_id,
      qi.created_at AS item_created_at,
      COALESCE(NULLIF(btrim(qi.operadora_nome_snapshot), ''), NULLIF(btrim(o.nome), '')) AS operadora_nome,
      NULLIF(btrim(qi.titulo_snapshot), '') AS titulo,
      NULLIF(btrim(qi.subtitulo_snapshot), '') AS subtitulo,
      NULLIF(btrim(qi.linha_nome_snapshot), '') AS linha,
      NULLIF(btrim(qi.tabela_nome_snapshot), '') AS tabela,
      qi.mensalidade_total_snapshot AS mensalidade_total
    FROM public.cotador_quotes q
    LEFT JOIN public.cotador_quote_items qi ON qi.quote_id = q.id
    LEFT JOIN public.operadoras o ON o.id = COALESCE(qi.operadora_id, NULL)
    CROSS JOIN input
    CROSS JOIN LATERAL (
      SELECT translate(
        lower(
          COALESCE(q.nome, '') || ' ' ||
          COALESCE(qi.operadora_nome_snapshot, '') || ' ' ||
          COALESCE(o.nome, '') || ' ' ||
          COALESCE(qi.titulo_snapshot, '') || ' ' ||
          COALESCE(qi.subtitulo_snapshot, '') || ' ' ||
          COALESCE(qi.linha_nome_snapshot, '') || ' ' ||
          COALESCE(qi.tabela_nome_snapshot, '') || ' ' ||
          COALESCE(qi.codigo_tabela_snapshot, '') || ' ' ||
          COALESCE(qi.modalidade_snapshot, '') || ' ' ||
          COALESCE(qi.abrangencia_snapshot, '')
        ),
        'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
      ) AS searchable_text
    ) normalized_quote
    WHERE cardinality(input.terms) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(input.terms) AS term
        WHERE normalized_quote.searchable_text LIKE '%' || term || '%'
      )
  ),
  ranked_items AS (
    SELECT
      mi.*,
      row_number() OVER (PARTITION BY mi.quote_id ORDER BY mi.item_created_at DESC NULLS LAST, mi.item_id DESC NULLS LAST) AS item_rank,
      count(*) OVER (PARTITION BY mi.quote_id) AS quote_match_count,
      max(mi.item_created_at) OVER (PARTITION BY mi.quote_id) AS quote_latest_item_at
    FROM matched_items mi
  ),
  grouped_quotes AS (
    SELECT
      q.id AS quote_id,
      jsonb_build_object(
        'id', q.id,
        'nome', q.nome,
        'modalidade', q.modalidade,
        'total_vidas', q.total_vidas,
        'lead_id', q.lead_id,
        'created_at', q.created_at,
        'updated_at', q.updated_at
      ) AS quote,
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
      COALESCE(max(ri.quote_latest_item_at), q.updated_at) AS latest_item_at,
      max(ri.quote_match_count)::integer AS match_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', ri.item_id,
            'operadora', ri.operadora_nome,
            'titulo', ri.titulo,
            'subtitulo', ri.subtitulo,
            'linha', ri.linha,
            'tabela', ri.tabela,
            'mensalidade_total', ri.mensalidade_total,
            'created_at', ri.item_created_at
          )
          ORDER BY ri.item_created_at DESC NULLS LAST, ri.item_id DESC NULLS LAST
        ) FILTER (WHERE ri.item_rank <= 5 AND ri.item_id IS NOT NULL),
        '[]'::jsonb
      ) AS items
    FROM ranked_items ri
    JOIN public.cotador_quotes q ON q.id = ri.quote_id
    LEFT JOIN public.leads l ON l.id = q.lead_id
    LEFT JOIN public.lead_responsaveis ro ON ro.id = l.responsavel_id
    GROUP BY q.id, l.id, ro.label, ro.value
  )
  SELECT
    grouped_quotes.quote,
    grouped_quotes.lead,
    grouped_quotes.latest_item_at,
    grouped_quotes.match_count,
    grouped_quotes.items
  FROM grouped_quotes
  ORDER BY grouped_quotes.latest_item_at DESC NULLS LAST, grouped_quotes.quote_id DESC
  LIMIT (SELECT safe_limit FROM input);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_cotador_quotes_by_topic(text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_cotador_quotes_by_topic(text, text[], integer) TO service_role;

COMMIT;
