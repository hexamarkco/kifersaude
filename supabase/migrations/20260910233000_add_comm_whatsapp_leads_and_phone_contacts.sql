BEGIN;

ALTER TABLE public.comm_whatsapp_chats
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saved_contact_name text;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_lead_id
  ON public.comm_whatsapp_chats (lead_id);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_phone_contacts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  contact_id text NOT NULL,
  phone_number text NOT NULL,
  phone_digits text NOT NULL,
  display_name text NOT NULL,
  short_name text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_phone_contacts_cache_phone_digits
  ON public.comm_whatsapp_phone_contacts_cache (channel_id, phone_digits);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_phone_contacts_cache_updated_at ON public.comm_whatsapp_phone_contacts_cache;
CREATE TRIGGER trg_comm_whatsapp_phone_contacts_cache_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_phone_contacts_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comm_whatsapp_phone_contacts_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp phone contacts cache" ON public.comm_whatsapp_phone_contacts_cache;
CREATE POLICY "Authenticated users can view comm whatsapp phone contacts cache"
  ON public.comm_whatsapp_phone_contacts_cache
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE OR REPLACE FUNCTION public.comm_whatsapp_format_phone_label(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN digits = '' THEN 'Numero desconhecido'
    WHEN char_length(digits) = 13 AND digits LIKE '55%' THEN
      '+55 (' || substring(digits from 3 for 2) || ') ' || substring(digits from 5 for 5) || '-' || substring(digits from 10)
    WHEN char_length(digits) = 12 AND digits LIKE '55%' THEN
      '+55 (' || substring(digits from 3 for 2) || ') ' || substring(digits from 5 for 4) || '-' || substring(digits from 9)
    ELSE digits
  END
  FROM (
    SELECT COALESCE(public.normalize_comm_whatsapp_phone(p_phone), '') AS digits
  ) normalized;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_format_phone_label(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_format_phone_label(text) TO authenticated;

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
    AND c.phone_digits = v_chat.phone_digits
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

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(p_channel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat record;
  v_count integer := 0;
BEGIN
  FOR v_chat IN
    SELECT id
    FROM public.comm_whatsapp_chats
    WHERE channel_id = p_channel_id
  LOOP
    PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_channel_chat_identities(uuid) TO authenticated, service_role;

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
    FROM (
      SELECT NULLIF(regexp_replace(value, '\D', '', 'g'), '') AS key
      FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
      UNION
      SELECT NULLIF(public.normalize_comm_whatsapp_phone(value), '') AS key
      FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
    ) normalized
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
        WHERE requested.key = NULLIF(regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g'), '')
           OR requested.key = NULLIF(public.normalize_comm_whatsapp_phone(l.telefone), '')
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

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_crm_leads(text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_crm_leads(text, text[], integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_chat_lead_panel(p_chat_id uuid)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  telefone text,
  observacoes text,
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
  SELECT
    l.id,
    l.nome_completo,
    l.telefone,
    l.observacoes,
    l.status AS status_nome,
    l.status AS status_value,
    ro.label AS responsavel_label,
    COALESCE(ro.value, '') AS responsavel_value
  FROM public.comm_whatsapp_chats c
  JOIN public.leads l ON l.id = c.lead_id
  LEFT JOIN public.lead_responsaveis ro
    ON ro.id = l.responsavel_id
  WHERE c.id = p_chat_id
    AND public.current_user_can_view_comm_whatsapp();
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_lead_panel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_lead_panel(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_lead_contracts(p_lead_id uuid)
RETURNS TABLE(
  id uuid,
  codigo_contrato text,
  status text,
  modalidade text,
  operadora text,
  produto_plano text,
  mensalidade_total numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    c.id,
    c.codigo_contrato,
    c.status,
    c.modalidade,
    c.operadora,
    c.produto_plano,
    c.mensalidade_total
  FROM public.contracts c
  WHERE c.lead_id = p_lead_id
    AND public.current_user_can_view_comm_whatsapp()
  ORDER BY COALESCE(c.updated_at, c.created_at) DESC NULLS LAST, c.id DESC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_lead_contracts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_lead_contracts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_link_chat_lead(p_chat_id uuid, p_lead_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para vincular lead.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'Lead nao encontrado para vinculo.';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET lead_id = p_lead_id,
      updated_at = now()
  WHERE id = p_chat_id;

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(p_chat_id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_link_chat_lead(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_link_chat_lead(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_unlink_chat_lead(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para desvincular lead.';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET lead_id = NULL,
      updated_at = now()
  WHERE id = p_chat_id;

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(p_chat_id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_unlink_chat_lead(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_unlink_chat_lead(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_linked_lead_status(p_chat_id uuid, p_new_status text)
RETURNS TABLE(
  lead_id uuid,
  status text,
  ultimo_contato timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_new_status text := NULLIF(btrim(COALESCE(p_new_status, '')), '');
  v_timestamp timestamptz := now();
  v_status_id uuid;
  v_responsavel_label text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar status do lead.';
  END IF;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Novo status do lead obrigatorio.';
  END IF;

  SELECT l.*
  INTO v_lead
  FROM public.comm_whatsapp_chats c
  JOIN public.leads l ON l.id = c.lead_id
  WHERE c.id = p_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum lead vinculado a esta conversa.';
  END IF;

  SELECT id
  INTO v_status_id
  FROM public.lead_status_config
  WHERE nome = v_new_status
  LIMIT 1;

  UPDATE public.leads
  SET
    status = v_new_status,
    status_id = COALESCE(v_status_id, public.leads.status_id),
    ultimo_contato = v_timestamp,
    updated_at = v_timestamp
  WHERE id = v_lead.id;

  SELECT lr.label
  INTO v_responsavel_label
  FROM public.lead_responsaveis lr
  WHERE lr.id = v_lead.responsavel_id
  LIMIT 1;

  INSERT INTO public.interactions (lead_id, tipo, descricao, responsavel)
  VALUES (
    v_lead.id,
    'Observação',
    'Status alterado de "' || COALESCE(v_lead.status, 'Sem status') || '" para "' || v_new_status || '" via WhatsApp',
    COALESCE(v_responsavel_label, 'WhatsApp Inbox')
  );

  INSERT INTO public.lead_status_history (lead_id, status_anterior, status_novo, responsavel)
  VALUES (
    v_lead.id,
    COALESCE(v_lead.status, 'Sem status'),
    v_new_status,
    COALESCE(v_responsavel_label, 'WhatsApp Inbox')
  );

  RETURN QUERY
  SELECT l.id, l.status, l.ultimo_contato
  FROM public.leads l
  WHERE l.id = v_lead.id;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_linked_lead_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_linked_lead_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_linked_lead_responsavel(p_chat_id uuid, p_new_responsavel_value text)
RETURNS TABLE(
  lead_id uuid,
  responsavel text,
  responsavel_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_option public.lead_responsaveis%ROWTYPE;
  v_value text := NULLIF(btrim(COALESCE(p_new_responsavel_value, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar responsavel do lead.';
  END IF;

  IF v_value IS NULL THEN
    RAISE EXCEPTION 'Responsavel obrigatorio.';
  END IF;

  SELECT l.*
  INTO v_lead
  FROM public.comm_whatsapp_chats c
  JOIN public.leads l ON l.id = c.lead_id
  WHERE c.id = p_chat_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum lead vinculado a esta conversa.';
  END IF;

  SELECT *
  INTO v_option
  FROM public.lead_responsaveis
  WHERE value = v_value
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsavel nao encontrado.';
  END IF;

  UPDATE public.leads
  SET
    responsavel_id = v_option.id,
    updated_at = now()
  WHERE id = v_lead.id;

  RETURN QUERY
  SELECT l.id, v_option.label, l.responsavel_id
  FROM public.leads l
  WHERE l.id = v_lead.id;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_linked_lead_responsavel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_linked_lead_responsavel(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_open_or_create_chat(
  p_external_chat_id text,
  p_phone_number text,
  p_push_name text DEFAULT NULL,
  p_saved_contact_name text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_saved_contact_name text := NULLIF(btrim(COALESCE(p_saved_contact_name, '')), '');
  v_push_name text := NULLIF(btrim(COALESCE(p_push_name, '')), '');
  v_lead_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para iniciar conversa.';
  END IF;

  IF v_phone_number IS NULL THEN
    RAISE EXCEPTION 'Numero obrigatorio para iniciar conversa.';
  END IF;

  SELECT id
  INTO v_channel_id
  FROM public.comm_whatsapp_channels
  WHERE slug = 'primary'
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    RAISE EXCEPTION 'Canal WhatsApp principal nao encontrado.';
  END IF;

  IF p_lead_id IS NOT NULL THEN
    SELECT NULLIF(btrim(nome_completo), '') INTO v_lead_name FROM public.leads WHERE id = p_lead_id;
  END IF;

  INSERT INTO public.comm_whatsapp_chats (
    channel_id,
    external_chat_id,
    phone_number,
    phone_digits,
    display_name,
    push_name,
    saved_contact_name,
    lead_id,
    last_message_direction,
    unread_count,
    status
  )
  VALUES (
    v_channel_id,
    p_external_chat_id,
    v_phone_number,
    v_phone_number,
    COALESCE(v_saved_contact_name, v_lead_name, v_push_name, public.comm_whatsapp_format_phone_label(v_phone_number)),
    v_push_name,
    v_saved_contact_name,
    p_lead_id,
    'system',
    0,
    'open'
  )
  ON CONFLICT (channel_id, external_chat_id)
  DO UPDATE SET
    phone_number = EXCLUDED.phone_number,
    phone_digits = EXCLUDED.phone_digits,
    push_name = COALESCE(EXCLUDED.push_name, public.comm_whatsapp_chats.push_name),
    saved_contact_name = COALESCE(EXCLUDED.saved_contact_name, public.comm_whatsapp_chats.saved_contact_name),
    lead_id = COALESCE(EXCLUDED.lead_id, public.comm_whatsapp_chats.lead_id),
    updated_at = now()
  RETURNING * INTO v_chat;

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) TO authenticated;

COMMIT;
