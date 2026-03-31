BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_phone_lookup_keys(p_phone text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_normalized text := NULLIF(public.normalize_comm_whatsapp_phone(v_digits), '');
  v_national text;
  v_mobile_variant text;
  v_keys text[] := ARRAY[]::text[];
BEGIN
  IF v_digits <> '' AND NOT v_digits = ANY(v_keys) THEN
    v_keys := array_append(v_keys, v_digits);
  END IF;

  IF v_normalized IS NOT NULL AND NOT v_normalized = ANY(v_keys) THEN
    v_keys := array_append(v_keys, v_normalized);
  END IF;

  IF v_digits LIKE '55%' AND char_length(v_digits) IN (12, 13) THEN
    v_national := substring(v_digits from 3);
  ELSIF char_length(v_digits) IN (10, 11) THEN
    v_national := v_digits;
  ELSIF v_normalized LIKE '55%' AND char_length(v_normalized) IN (12, 13) THEN
    v_national := substring(v_normalized from 3);
  ELSE
    v_national := NULL;
  END IF;

  IF v_national IS NOT NULL THEN
    IF NOT v_national = ANY(v_keys) THEN
      v_keys := array_append(v_keys, v_national);
    END IF;

    IF NOT ('55' || v_national) = ANY(v_keys) THEN
      v_keys := array_append(v_keys, '55' || v_national);
    END IF;

    IF char_length(v_national) = 10 AND substring(v_national from 3 for 1) ~ '^[6-9]$' THEN
      v_mobile_variant := substring(v_national from 1 for 2) || '9' || substring(v_national from 3);

      IF NOT v_mobile_variant = ANY(v_keys) THEN
        v_keys := array_append(v_keys, v_mobile_variant);
      END IF;

      IF NOT ('55' || v_mobile_variant) = ANY(v_keys) THEN
        v_keys := array_append(v_keys, '55' || v_mobile_variant);
      END IF;
    ELSIF char_length(v_national) = 11
      AND substring(v_national from 3 for 1) = '9'
      AND substring(v_national from 4 for 1) ~ '^[6-9]$' THEN
      v_mobile_variant := substring(v_national from 1 for 2) || substring(v_national from 4);

      IF NOT v_mobile_variant = ANY(v_keys) THEN
        v_keys := array_append(v_keys, v_mobile_variant);
      END IF;

      IF NOT ('55' || v_mobile_variant) = ANY(v_keys) THEN
        v_keys := array_append(v_keys, '55' || v_mobile_variant);
      END IF;
    END IF;
  END IF;

  RETURN v_keys;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_phone_lookup_keys(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_phone_lookup_keys(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_chat_identity(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_saved_contact_name text;
  v_lead_name text;
BEGIN
  SELECT *
  INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE id = p_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT NULLIF(btrim(c.display_name), '')
  INTO v_saved_contact_name
  FROM public.comm_whatsapp_phone_contacts_cache c
  WHERE c.channel_id = v_chat.channel_id
    AND c.saved = true
    AND public.comm_whatsapp_phone_lookup_keys(c.phone_digits) && public.comm_whatsapp_phone_lookup_keys(v_chat.phone_digits)
  ORDER BY c.updated_at DESC, c.last_synced_at DESC, c.id DESC
  LIMIT 1;

  SELECT NULLIF(btrim(l.nome_completo), '')
  INTO v_lead_name
  FROM public.leads l
  WHERE l.id = v_chat.lead_id;

  UPDATE public.comm_whatsapp_chats
  SET
    saved_contact_name = v_saved_contact_name,
    display_name = COALESCE(
      v_saved_contact_name,
      v_lead_name,
      NULLIF(btrim(v_chat.push_name), ''),
      public.comm_whatsapp_format_phone_label(v_chat.phone_number)
    ),
    updated_at = now()
  WHERE id = v_chat.id
  RETURNING * INTO v_chat;

  RETURN NEXT v_chat;
END;
$$;

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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH normalized_query AS (
    SELECT
      NULLIF(btrim(COALESCE(p_query, '')), '') AS query_text,
      NULLIF(regexp_replace(COALESCE(p_query, ''), '\D', '', 'g'), '') AS query_digits,
      LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50) AS query_limit
  ),
  requested_phone_keys AS (
    SELECT DISTINCT key
    FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
    CROSS JOIN LATERAL unnest(public.comm_whatsapp_phone_lookup_keys(value)) AS key
    WHERE key IS NOT NULL
  )
  SELECT
    l.id,
    l.nome_completo,
    l.telefone,
    l.status AS status_nome,
    l.status AS status_value,
    ro.label AS responsavel_label,
    COALESCE(ro.value, '') AS responsavel_value
  FROM public.leads l
  CROSS JOIN normalized_query nq
  LEFT JOIN public.lead_responsaveis ro
    ON ro.id = l.responsavel_id
  WHERE public.current_user_can_view_comm_whatsapp()
    AND COALESCE(l.arquivado, false) = false
    AND (
      NOT EXISTS (SELECT 1 FROM requested_phone_keys)
      OR EXISTS (
        SELECT 1
        FROM requested_phone_keys requested
        WHERE requested.key = ANY(public.comm_whatsapp_phone_lookup_keys(COALESCE(l.telefone, '')))
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

COMMIT;
