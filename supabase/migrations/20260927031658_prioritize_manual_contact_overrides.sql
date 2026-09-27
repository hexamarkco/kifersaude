BEGIN;

-- Contatos salvos antes da coluna manual_override podem manter o contact_id
-- original do provedor. O identificador manual: continua válido para linhas
-- novas, mas a flag persistida é a fonte de verdade para linhas antigas.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_is_manual_contact_cache_row(
  p_manual_override boolean,
  p_contact_id text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT COALESCE(p_manual_override, false) OR p_contact_id LIKE 'manual:%';
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_is_manual_contact_cache_row(boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_is_manual_contact_cache_row(boolean, text) TO authenticated, service_role;

-- Todas as projeções do Inbox passam por este resolver. A precedência manual
-- precisa funcionar tanto para linhas manual: quanto para linhas antigas que
-- só carregam manual_override=true.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preferred_saved_contact_name(
  p_channel_id uuid,
  p_chat_id uuid,
  p_phone_digits text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
  WITH lookup_keys AS MATERIALIZED (
    SELECT public.comm_whatsapp_phone_lookup_keys(p_phone_digits) AS keys
  ),
  phone_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache contact
    CROSS JOIN lookup_keys
    WHERE contact.channel_id = p_channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
      AND contact.phone_digits = ANY(lookup_keys.keys)
  ),
  direct_identifier_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache contact
    JOIN public.comm_whatsapp_chat_identifiers identifier
      ON identifier.channel_id = p_channel_id
     AND identifier.chat_id = p_chat_id
     AND contact.contact_id = identifier.external_chat_id
    WHERE contact.channel_id = p_channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
  ),
  normalized_identifier_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache contact
    JOIN public.comm_whatsapp_chat_identifiers identifier
      ON identifier.channel_id = p_channel_id
     AND identifier.chat_id = p_chat_id
     AND public.normalize_comm_whatsapp_chat_id(contact.contact_id) = identifier.external_chat_id
    WHERE NOT EXISTS (SELECT 1 FROM phone_matches)
      AND NOT EXISTS (SELECT 1 FROM direct_identifier_matches)
      AND contact.channel_id = p_channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
  ),
  indexed_matches AS MATERIALIZED (
    SELECT * FROM phone_matches
    UNION ALL
    SELECT * FROM direct_identifier_matches
    UNION ALL
    SELECT * FROM normalized_identifier_matches
  ),
  fallback_matches AS MATERIALIZED (
    SELECT
      contact.id,
      NULLIF(btrim(contact.display_name), '') AS display_name,
      public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) AS is_manual,
      contact.updated_at,
      contact.last_synced_at
    FROM public.comm_whatsapp_phone_contacts_cache contact
    CROSS JOIN lookup_keys
    WHERE NOT EXISTS (SELECT 1 FROM indexed_matches)
      AND NULLIF(btrim(p_phone_digits), '') IS NOT NULL
      AND contact.channel_id = p_channel_id
      AND contact.saved = true
      AND public.comm_whatsapp_is_valid_display_name(contact.display_name)
      AND public.comm_whatsapp_phone_lookup_keys(contact.phone_digits)
        && lookup_keys.keys
  ),
  candidates AS (
    SELECT DISTINCT ON (id)
      id, display_name, is_manual, updated_at, last_synced_at
    FROM (
      SELECT * FROM indexed_matches
      UNION ALL
      SELECT * FROM fallback_matches
    ) matches
    ORDER BY id
  )
  SELECT candidates.display_name
  FROM candidates
  ORDER BY
    candidates.is_manual DESC,
    candidates.updated_at DESC,
    candidates.last_synced_at DESC,
    candidates.id DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preferred_saved_contact_name(uuid, uuid, text) TO authenticated, service_role;

-- A persistência de mensagens também recalcula a identidade do chat. Use a
-- mesma regra do Inbox para que o nome não volte ao valor do provedor.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_chat_identity(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_saved_contact_name text;
  v_lead_name text;
  v_connected_user_name text;
  v_safe_push_name text;
  v_display_name text;
BEGIN
  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_saved_contact_name := public.comm_whatsapp_preferred_saved_contact_name(
    v_chat.channel_id,
    v_chat.id,
    v_chat.phone_digits
  );

  IF v_saved_contact_name IS NULL
    AND public.comm_whatsapp_is_valid_display_name(v_chat.saved_contact_name)
  THEN
    v_saved_contact_name := NULLIF(btrim(v_chat.saved_contact_name), '');
  END IF;

  SELECT NULLIF(btrim(lead.nome_completo), '')
  INTO v_lead_name
  FROM public.leads AS lead
  WHERE lead.id = v_chat.lead_id
    AND public.comm_whatsapp_is_valid_display_name(lead.nome_completo);

  SELECT NULLIF(btrim(channel.connected_user_name), '')
  INTO v_connected_user_name
  FROM public.comm_whatsapp_channels AS channel
  WHERE channel.id = v_chat.channel_id;

  v_safe_push_name := NULLIF(btrim(v_chat.push_name), '');
  IF v_safe_push_name IS NOT NULL AND (
    NOT public.comm_whatsapp_is_valid_display_name(v_safe_push_name)
    OR (v_connected_user_name IS NOT NULL AND lower(v_safe_push_name) = lower(v_connected_user_name))
  ) THEN
    v_safe_push_name := NULL;
  END IF;

  v_display_name := COALESCE(
    v_saved_contact_name,
    v_lead_name,
    v_safe_push_name,
    CASE
      WHEN NULLIF(btrim(COALESCE(v_chat.phone_number, '')), '') IS NOT NULL
        THEN public.comm_whatsapp_format_phone_label(v_chat.phone_number)
      ELSE 'Contato privado'
    END
  );

  IF v_chat.saved_contact_name IS DISTINCT FROM v_saved_contact_name
    OR v_chat.push_name IS DISTINCT FROM v_safe_push_name
    OR v_chat.display_name IS DISTINCT FROM v_display_name
  THEN
    UPDATE public.comm_whatsapp_chats
    SET saved_contact_name = v_saved_contact_name,
        push_name = v_safe_push_name,
        display_name = v_display_name,
        updated_at = now()
    WHERE id = v_chat.id
    RETURNING * INTO v_chat;
  END IF;

  RETURN NEXT v_chat;
END;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) TO service_role;

-- O trigger é executado em atualizações vindas do provedor e precisa aplicar
-- a mesma precedência antes de o realtime publicar a linha.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_saved_contact_name text;
  v_phone_lookup_value text;
BEGIN
  IF COALESCE(NEW.is_group, false) THEN
    RETURN NEW;
  END IF;

  v_phone_lookup_value := COALESCE(
    NULLIF(btrim(NEW.phone_digits), ''),
    NULLIF(btrim(NEW.phone_number), ''),
    NULLIF(btrim(OLD.phone_digits), ''),
    NULLIF(btrim(OLD.phone_number), '')
  );

  SELECT NULLIF(btrim(contact.display_name), '')
  INTO v_saved_contact_name
  FROM public.comm_whatsapp_phone_contacts_cache AS contact
  WHERE contact.channel_id = NEW.channel_id
    AND contact.saved = true
    AND NULLIF(btrim(contact.display_name), '') IS NOT NULL
    AND public.comm_whatsapp_phone_lookup_keys(COALESCE(contact.phone_digits, contact.phone_number))
      && public.comm_whatsapp_phone_lookup_keys(v_phone_lookup_value)
  ORDER BY
    public.comm_whatsapp_is_manual_contact_cache_row(contact.manual_override, contact.contact_id) DESC,
    contact.updated_at DESC,
    contact.last_synced_at DESC,
    contact.id DESC
  LIMIT 1;

  v_saved_contact_name := COALESCE(
    v_saved_contact_name,
    NULLIF(btrim(OLD.saved_contact_name), ''),
    NULLIF(btrim(NEW.saved_contact_name), '')
  );

  IF v_saved_contact_name IS NOT NULL THEN
    NEW.saved_contact_name := v_saved_contact_name;
    NEW.display_name := v_saved_contact_name;
  END IF;

  RETURN NEW;
END;
$function$;

-- Há um segundo trigger de proteção que recebe o nome enviado pelo provedor.
-- Faça-o consultar a mesma fonte canônica para que a ordem dos triggers não
-- reintroduza o nome antigo depois da correção acima.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_preserve_saved_contact_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_saved_name text;
BEGIN
  IF COALESCE(NEW.is_group, false) THEN
    RETURN NEW;
  END IF;

  v_saved_name := public.comm_whatsapp_preferred_saved_contact_name(
    NEW.channel_id,
    NEW.id,
    COALESCE(NEW.phone_digits, NEW.phone_number)
  );
  v_saved_name := COALESCE(
    v_saved_name,
    NULLIF(btrim(NEW.saved_contact_name), ''),
    CASE WHEN TG_OP = 'UPDATE' THEN NULLIF(btrim(OLD.saved_contact_name), '') END
  );

  IF public.comm_whatsapp_is_valid_display_name(v_saved_name) THEN
    NEW.saved_contact_name := v_saved_name;
    NEW.display_name := v_saved_name;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_preserve_saved_contact_name() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preserve_saved_contact_name() TO service_role;

-- Corrige imediatamente os chats já persistidos com a identidade antiga.
DO $repair$
DECLARE
  v_chat record;
  v_canonical_name text;
BEGIN
  FOR v_chat IN
    SELECT chat.id, chat.channel_id, chat.phone_digits,
           chat.saved_contact_name, chat.display_name
    FROM public.comm_whatsapp_chats AS chat
    WHERE COALESCE(chat.is_group, false) = false
      AND chat.deleted_at IS NULL
      AND chat.merged_into_chat_id IS NULL
  LOOP
    v_canonical_name := public.comm_whatsapp_preferred_saved_contact_name(
      v_chat.channel_id,
      v_chat.id,
      v_chat.phone_digits
    );

    IF v_canonical_name IS NOT NULL
      AND (
        v_chat.saved_contact_name IS DISTINCT FROM v_canonical_name
        OR v_chat.display_name IS DISTINCT FROM v_canonical_name
      )
    THEN
      UPDATE public.comm_whatsapp_chats
      SET saved_contact_name = v_canonical_name,
          display_name = v_canonical_name,
          updated_at = now()
      WHERE id = v_chat.id;
    END IF;
  END LOOP;
END;
$repair$;

NOTIFY pgrst, 'reload schema';

COMMIT;
