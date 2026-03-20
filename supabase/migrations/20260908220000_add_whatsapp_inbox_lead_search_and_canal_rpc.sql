/*
  # Add WhatsApp inbox lead search and campaign canal RPCs

  - Replaces full lead-table bootstrap scans in the inbox with targeted lead lookups.
  - Moves campaign canal distinct loading to the database.
*/

CREATE OR REPLACE FUNCTION public.search_whatsapp_inbox_leads(
  p_query text DEFAULT NULL,
  p_phone_numbers text[] DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  telefone text,
  status text,
  responsavel_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized_query AS (
    SELECT
      NULLIF(btrim(COALESCE(p_query, '')), '') AS query_text,
      NULLIF(regexp_replace(COALESCE(p_query, ''), '\D', '', 'g'), '') AS query_digits,
      LEAST(GREATEST(COALESCE(p_limit, 200), 1), 300) AS query_limit
  ),
  requested_phone_keys AS (
    SELECT DISTINCT key
    FROM (
      SELECT NULLIF(regexp_replace(value, '\D', '', 'g'), '') AS key
      FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
      UNION
      SELECT NULLIF(public.normalize_whatsapp_campaign_phone(value), '') AS key
      FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
      UNION
      SELECT NULLIF(public.storage_whatsapp_campaign_phone(value), '') AS key
      FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
    ) normalized
    WHERE key IS NOT NULL
  )
  SELECT
    l.id,
    l.nome_completo,
    l.telefone,
    l.status,
    l.responsavel_id
  FROM public.leads l
  CROSS JOIN normalized_query nq
  WHERE auth.uid() IS NOT NULL
    AND COALESCE(l.arquivado, false) = false
    AND NULLIF(btrim(COALESCE(l.telefone, '')), '') IS NOT NULL
    AND (
      NOT EXISTS (SELECT 1 FROM requested_phone_keys)
      OR EXISTS (
        SELECT 1
        FROM requested_phone_keys requested
        WHERE requested.key = NULLIF(regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g'), '')
           OR requested.key = NULLIF(public.normalize_whatsapp_campaign_phone(l.telefone), '')
           OR requested.key = NULLIF(public.storage_whatsapp_campaign_phone(l.telefone), '')
      )
    )
    AND (
      nq.query_text IS NULL
      OR COALESCE(l.nome_completo, '') ILIKE '%' || nq.query_text || '%'
      OR COALESCE(l.telefone, '') ILIKE '%' || nq.query_text || '%'
      OR (
        nq.query_digits IS NOT NULL
        AND regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g') LIKE '%' || nq.query_digits || '%'
      )
    )
  ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
  LIMIT (SELECT query_limit FROM normalized_query);
$$;

REVOKE ALL ON FUNCTION public.search_whatsapp_inbox_leads(text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_whatsapp_inbox_leads(text, text[], integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_whatsapp_campaign_canais()
RETURNS TABLE(canal text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT btrim(l.canal) AS canal
  FROM public.leads l
  WHERE public.current_user_can_edit_whatsapp()
    AND COALESCE(l.arquivado, false) = false
    AND NULLIF(btrim(COALESCE(l.canal, '')), '') IS NOT NULL
  ORDER BY canal;
$$;

REVOKE ALL ON FUNCTION public.list_whatsapp_campaign_canais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_whatsapp_campaign_canais() TO authenticated;
