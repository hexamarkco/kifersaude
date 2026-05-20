BEGIN;

CREATE INDEX IF NOT EXISTS idx_leads_comm_whatsapp_phone_lookup_keys_active
  ON public.leads USING gin (public.comm_whatsapp_phone_lookup_keys(telefone))
  WHERE COALESCE(arquivado, false) = false
    AND NULLIF(btrim(COALESCE(telefone, '')), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_crm_leads(
  p_query text DEFAULT NULL,
  p_phone_numbers text[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  telefone text,
  status_nome text,
  status_value text,
  responsavel_label text,
  responsavel_value text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_query_text text := NULLIF(btrim(COALESCE(p_query, '')), '');
  v_query_digits text := NULLIF(regexp_replace(COALESCE(p_query, ''), '\D', '', 'g'), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_phone_keys text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT key), ARRAY[]::text[])
  INTO v_phone_keys
  FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
  CROSS JOIN LATERAL unnest(public.comm_whatsapp_phone_lookup_keys(value)) AS key
  WHERE key IS NOT NULL
    AND key <> '';

  IF COALESCE(array_length(v_phone_keys, 1), 0) > 0 THEN
    RETURN QUERY
    SELECT
      l.id,
      l.nome_completo,
      l.telefone,
      l.status AS status_nome,
      l.status AS status_value,
      ro.label AS responsavel_label,
      COALESCE(ro.value, '') AS responsavel_value
    FROM public.leads l
    LEFT JOIN public.lead_responsaveis ro
      ON ro.id = l.responsavel_id
    WHERE COALESCE(l.arquivado, false) = false
      AND public.comm_whatsapp_phone_lookup_keys(l.telefone) && v_phone_keys
      AND (
        v_query_text IS NULL
        OR COALESCE(l.nome_completo, '') ILIKE '%' || v_query_text || '%'
        OR COALESCE(l.telefone, '') ILIKE '%' || v_query_text || '%'
        OR (
          v_query_digits IS NOT NULL
          AND regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g') LIKE '%' || v_query_digits || '%'
        )
      )
    ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
    LIMIT v_limit;

    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.nome_completo,
    l.telefone,
    l.status AS status_nome,
    l.status AS status_value,
    ro.label AS responsavel_label,
    COALESCE(ro.value, '') AS responsavel_value
  FROM public.leads l
  LEFT JOIN public.lead_responsaveis ro
    ON ro.id = l.responsavel_id
  WHERE COALESCE(l.arquivado, false) = false
    AND (
      v_query_text IS NULL
      OR COALESCE(l.nome_completo, '') ILIKE '%' || v_query_text || '%'
      OR COALESCE(l.telefone, '') ILIKE '%' || v_query_text || '%'
      OR (
        v_query_digits IS NOT NULL
        AND regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g') LIKE '%' || v_query_digits || '%'
      )
    )
  ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_crm_leads(text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_crm_leads(text, text[], integer) TO authenticated;

COMMIT;
