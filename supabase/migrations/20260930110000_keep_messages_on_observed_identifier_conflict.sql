-- Uma observacao de mensagem e evidencia fraca: se o identificador recebido ja
-- pertence de forma verificada a outro chat, ela nao pode roubar a identidade
-- nem abortar a transacao que acabou de persistir a mensagem. O abort anterior
-- fazia o webhook responder 500/409 e revertia inclusive a mensagem valida.
--
-- Vinculos verificados continuam fail-closed. Somente p_verified=false passa a
-- registrar o conflito para reconciliacao posterior e retorna o dono atual.

CREATE OR REPLACE FUNCTION public.comm_whatsapp_register_chat_identifier(
  p_channel_id uuid,
  p_chat_id uuid,
  p_external_chat_id text,
  p_source text DEFAULT 'observed',
  p_verified boolean DEFAULT false,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_chat_id uuid;
  v_existing_chat_id uuid;
  v_existing_verified boolean := false;
  v_primary_chat_id uuid;
  v_conflicting_chat_id uuid;
  v_kind text;
BEGIN
  v_chat_id := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);

  IF p_channel_id IS NULL OR v_chat_id IS NULL OR v_external_chat_id IS NULL THEN
    RAISE EXCEPTION 'Canal, chat e identificador sao obrigatorios.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('comm-whatsapp-identity:' || p_channel_id::text || ':' || v_external_chat_id, 0)
  );

  v_chat_id := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.comm_whatsapp_chats c
    WHERE c.id = v_chat_id AND c.channel_id = p_channel_id
  ) THEN
    RAISE EXCEPTION 'Chat canonico nao pertence ao canal informado.';
  END IF;

  SELECT public.comm_whatsapp_resolve_chat_uuid(identifier.chat_id), identifier.is_verified
  INTO v_existing_chat_id, v_existing_verified
  FROM public.comm_whatsapp_chat_identifiers identifier
  WHERE identifier.channel_id = p_channel_id
    AND identifier.external_chat_id = v_external_chat_id;

  IF v_existing_chat_id IS NOT NULL AND v_existing_chat_id <> v_chat_id AND v_existing_verified THEN
    IF COALESCE(p_verified, false) THEN
      RAISE EXCEPTION 'Identificador ja pertence a outro chat canonico.';
    END IF;
    v_conflicting_chat_id := v_existing_chat_id;
  END IF;

  SELECT public.comm_whatsapp_resolve_chat_uuid(chat.id)
  INTO v_primary_chat_id
  FROM public.comm_whatsapp_chats chat
  WHERE chat.channel_id = p_channel_id
    AND chat.external_chat_id = v_external_chat_id;

  IF v_primary_chat_id IS NOT NULL AND v_primary_chat_id <> v_chat_id THEN
    IF COALESCE(p_verified, false) THEN
      RAISE EXCEPTION 'Identificador primario ja pertence a outro chat canonico.';
    END IF;
    v_conflicting_chat_id := COALESCE(v_conflicting_chat_id, v_primary_chat_id);
  END IF;

  IF v_conflicting_chat_id IS NOT NULL THEN
    INSERT INTO public.comm_whatsapp_identity_conflicts (
      dedupe_key, channel_id, chat_id, conflict_type, status, details
    ) VALUES (
      'observed-identifier:' || p_channel_id::text || ':' || v_external_chat_id || ':' || v_chat_id::text,
      p_channel_id,
      v_chat_id,
      'identifier_conflict',
      'open',
      jsonb_build_object(
        'source', COALESCE(NULLIF(btrim(p_source), ''), 'observed'),
        'external_chat_id', v_external_chat_id,
        'observed_chat_id', v_chat_id,
        'owner_chat_id', v_conflicting_chat_id,
        'owner_verified', COALESCE(v_existing_verified, false),
        'evidence', COALESCE(p_evidence, '{}'::jsonb)
      )
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET status = 'open',
        details = EXCLUDED.details,
        updated_at = now(),
        resolved_at = NULL,
        resolved_by = NULL;

    RETURN v_conflicting_chat_id;
  END IF;

  v_kind := CASE
    WHEN v_external_chat_id ~* '@lid$' THEN 'lid'
    WHEN v_external_chat_id ~* '@s\.whatsapp\.net$' THEN 'wa_id'
    ELSE 'other'
  END;

  INSERT INTO public.comm_whatsapp_chat_identifiers (
    channel_id, external_chat_id, chat_id, source, identifier_kind,
    is_verified, evidence, last_confirmed_at, last_observed_at
  )
  VALUES (
    p_channel_id, v_external_chat_id, v_chat_id,
    COALESCE(NULLIF(btrim(p_source), ''), 'observed'), v_kind,
    COALESCE(p_verified, false), COALESCE(p_evidence, '{}'::jsonb), now(), now()
  )
  ON CONFLICT (channel_id, external_chat_id) DO UPDATE
  SET chat_id = EXCLUDED.chat_id,
      source = EXCLUDED.source,
      identifier_kind = EXCLUDED.identifier_kind,
      is_verified = public.comm_whatsapp_chat_identifiers.is_verified OR EXCLUDED.is_verified,
      evidence = public.comm_whatsapp_chat_identifiers.evidence || EXCLUDED.evidence,
      last_confirmed_at = CASE
        WHEN EXCLUDED.is_verified THEN now()
        ELSE public.comm_whatsapp_chat_identifiers.last_confirmed_at
      END,
      last_observed_at = now();

  RETURN v_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_register_chat_identifier(uuid, uuid, text, text, boolean, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_register_chat_identifier(uuid, uuid, text, text, boolean, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
