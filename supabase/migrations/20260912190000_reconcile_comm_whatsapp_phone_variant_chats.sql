-- Mesmo lead com 2 chats por variante do digitado 9 no telefone brasileiro.
--
-- Contexto: o WhatsApp mobile BR tem E.164 com 13 digitos (55 + DDD + 9 + 8),
-- porem o CRM/lead/import pode guardar a forma antiga de 12 digitos (sem o 9).
-- O chat e chaveado por external_chat_id exato, entao a mesma pessoa acabava
-- com dois chats no mesmo canal: um completo (13 digitos, com inbound real) e
-- outro "só outbound" (12 digitos, criado a partir do leads.telefone sem o 9).
--
-- Correcao em duas camadas:
--   1. Sistêmica: comm_whatsapp_resolve_canonical_chat_uuid passa a cair na
--      variante do digito 9 quando nao resolve por identificador exato. Assim
--      persist/send/open_or_create passam a direcionar a mensagem para o mesmo
--      chat canônico sempre que o numero for a variação do 9 do outro numero
--      existente no canal (nao cria mais chat separado para a forma de 12 digitos).
--      comm_whatsapp_resolve_canonical_chat_id so passa a delegar para esse
--      resolver canonico, cobrindo tambem o caminho open_or_create_chat.
--   2. Data: reconcile unico dos pares existentes. Canonico = chat de 13 digitos
--      (forma WhatsApp real, segura o inbound). O chat da forma de 12 digitos
--      e mesclado (mensagens, enrichment, sugestoes, campanha, opt-outs,
--      identifiers, conflitos e follow-up) e apagado, com o identificador
--      vinculado ao canonico para resolver rapidamente no futuro.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Resolver canonico com fallback de variante do digito 9
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(
  p_channel_id uuid,
  p_external_chat_id text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_chat_id uuid;
  v_phone_digits text;
BEGIN
  IF p_channel_id IS NULL OR v_external_chat_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT identifier.chat_id
  INTO v_chat_id
  FROM public.comm_whatsapp_chat_identifiers identifier
  WHERE identifier.channel_id = p_channel_id
    AND identifier.external_chat_id = v_external_chat_id
    AND identifier.is_verified;

  IF v_chat_id IS NULL THEN
    SELECT chat.id
    INTO v_chat_id
    FROM public.comm_whatsapp_chats chat
    WHERE chat.channel_id = p_channel_id
      AND chat.external_chat_id = v_external_chat_id;
  END IF;

  -- Fallback: numeros brasileiros que se diferenciam apenas pelo digito 9
  -- (ex.: 55+DDD+9+8 digitos x 55+DDD+8 digitos) representam o MESMO contacto.
  -- Sem isso, uma forma de 12 digitos para que ja existe chat de 13 digitos
  -- criava um chat separado. Safe do heuristic: o crossover so acontece quando
  -- um numero e a variante com/sem 9 do outro (comm_whatsapp_phone_lookup_keys).
  IF v_chat_id IS NULL AND v_external_chat_id ~* '@s\.whatsapp\.net$' THEN
    v_phone_digits := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_external_chat_id, '@', 1)), '');
    IF v_phone_digits IS NOT NULL THEN
      SELECT chat.id
      INTO v_chat_id
      FROM public.comm_whatsapp_chats chat
      WHERE chat.channel_id = p_channel_id
        AND chat.external_chat_id IS DISTINCT FROM v_external_chat_id
        AND chat.merged_into_chat_id IS NULL
        AND NULLIF(btrim(chat.phone_digits), '') IS NOT NULL
        AND (
          public.comm_whatsapp_phone_lookup_keys(v_phone_digits)
          && public.comm_whatsapp_phone_lookup_keys(chat.phone_digits)
        )
      ORDER BY
        CASE WHEN btrim(chat.phone_digits) ~ '^55\d{2}9\d{8}$' THEN 0 ELSE 1 END,
        CASE WHEN chat.deleted_at IS NULL THEN 0 ELSE 1 END,
        chat.id ASC
      LIMIT 1;
    END IF;
  END IF;

  RETURN public.comm_whatsapp_resolve_chat_uuid(v_chat_id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(uuid, text) TO service_role;

-- Delegar a resolucao string para o resolver com fallback (cobre open_or_create_chat)
CREATE OR REPLACE FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(
  p_channel_id uuid,
  p_external_chat_id text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT chat.external_chat_id
      FROM public.comm_whatsapp_chats chat
      WHERE chat.id = public.comm_whatsapp_resolve_canonical_chat_uuid(p_channel_id, p_external_chat_id)
    ),
    public.normalize_comm_whatsapp_chat_id(p_external_chat_id)
  );
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Reconciliação one-time dos pares 12x13 digitos existentes
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_winner public.comm_whatsapp_chats%ROWTYPE;
  v_loser public.comm_whatsapp_chats%ROWTYPE;
  v_group record;
  v_latest_row record;
  v_preview text;
  v_unread integer;
  v_winner_read_at timestamptz;
BEGIN
  FOR v_group IN
    WITH families AS (
      SELECT chat.id, chat.channel_id, chat.phone_digits,
        CASE
          WHEN chat.phone_digits ~ '^55\d{2}9\d{8}$' THEN chat.phone_digits
          WHEN chat.phone_digits ~ '^55\d{2}[6-9]\d{7}$'
            THEN substring(chat.phone_digits, 1, 4) || '9' || substring(chat.phone_digits, 5)
          ELSE NULL
        END AS canonical_key
      FROM public.comm_whatsapp_chats chat
      WHERE chat.merged_into_chat_id IS NULL
        AND chat.external_chat_id ~* '@s\.whatsapp\.net$'
    )
    SELECT canonical_key, channel_id, count(*) AS members
    FROM families
    WHERE canonical_key IS NOT NULL
    GROUP BY canonical_key, channel_id
    HAVING count(*) > 1
  LOOP
    SELECT * INTO v_winner
    FROM public.comm_whatsapp_chats chat
    WHERE chat.channel_id = v_group.channel_id
      AND chat.merged_into_chat_id IS NULL
      AND chat.external_chat_id ~* '@s\.whatsapp\.net$'
      AND (
        (chat.phone_digits ~ '^55\d{2}9\d{8}$' AND chat.phone_digits = v_group.canonical_key)
        OR (
          chat.phone_digits ~ '^55\d{2}[6-9]\d{7}$'
          AND substring(chat.phone_digits, 1, 4) || '9' || substring(chat.phone_digits, 5) = v_group.canonical_key
        )
      )
    ORDER BY
      CASE WHEN chat.phone_digits = v_group.canonical_key THEN 0 ELSE 1 END,
      CASE WHEN chat.deleted_at IS NULL THEN 0 ELSE 1 END,
      COALESCE(chat.last_message_at, chat.created_at) DESC NULLS LAST,
      chat.id ASC
    LIMIT 1;

    IF v_winner.id IS NULL THEN
      CONTINUE;
    END IF;

    v_winner_read_at := v_winner.last_read_at;

    FOR v_loser IN
      SELECT *
      FROM public.comm_whatsapp_chats chat
      WHERE chat.channel_id = v_group.channel_id
        AND chat.merged_into_chat_id IS NULL
        AND chat.id <> v_winner.id
        AND chat.external_chat_id ~* '@s\.whatsapp\.net$'
        AND (
          (chat.phone_digits ~ '^55\d{2}9\d{8}$' AND chat.phone_digits = v_group.canonical_key)
          OR (
            chat.phone_digits ~ '^55\d{2}[6-9]\d{7}$'
            AND substring(chat.phone_digits, 1, 4) || '9' || substring(chat.phone_digits, 5) = v_group.canonical_key
          )
        )
    LOOP
      IF v_winner.lead_id IS NOT NULL AND v_loser.lead_id IS NOT NULL
        AND v_winner.lead_id <> v_loser.lead_id
      THEN
        RAISE NOTICE 'Recon: lead_conflict; mantem dois chats: %, %', v_winner.external_chat_id, v_loser.external_chat_id;
        CONTINUE;
      END IF;

      PERFORM pg_advisory_xact_lock(hashtextextended(
        'comm-whatsapp-identity:' || v_group.channel_id::text || ':' || v_winner.external_chat_id, 0
      ));
      PERFORM pg_advisory_xact_lock(hashtextextended(
        'comm-whatsapp-identity:' || v_group.channel_id::text || ':' || v_loser.external_chat_id, 0
      ));

      UPDATE public.comm_whatsapp_messages
      SET chat_id = v_winner.id
      WHERE chat_id = v_loser.id;

      UPDATE public.comm_whatsapp_enrichment_jobs
      SET chat_id = v_winner.id
      WHERE chat_id = v_loser.id;

      UPDATE public.comm_whatsapp_ai_intent_suggestions
      SET chat_id = v_winner.id
      WHERE chat_id = v_loser.id;

      UPDATE public.comm_whatsapp_campaign_targets
      SET chat_id = v_winner.id
      WHERE chat_id = v_loser.id;

      UPDATE public.comm_whatsapp_opt_outs
      SET source_chat_id = v_winner.id
      WHERE source_chat_id = v_loser.id;

      UPDATE public.comm_follow_up_audit_log
      SET chat_id = v_winner.id::text
      WHERE chat_id = v_loser.id::text;

      UPDATE public.comm_whatsapp_identity_conflicts
      SET chat_id = v_winner.id
      WHERE chat_id = v_loser.id;

      DELETE FROM public.comm_whatsapp_chat_identifiers AS alias
      WHERE alias.chat_id = v_loser.id
        AND EXISTS (
          SELECT 1 FROM public.comm_whatsapp_chat_identifiers AS existing
          WHERE existing.channel_id = alias.channel_id
            AND existing.external_chat_id = alias.external_chat_id
            AND existing.chat_id = v_winner.id
        );

      UPDATE public.comm_whatsapp_chat_identifiers
      SET chat_id = v_winner.id, last_confirmed_at = now()
      WHERE chat_id = v_loser.id;

      INSERT INTO public.comm_whatsapp_chat_identifiers (channel_id, external_chat_id, chat_id, source)
      VALUES (v_loser.channel_id, v_loser.external_chat_id, v_winner.id, 'reconcile_phone_variant')
      ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

      UPDATE public.comm_whatsapp_chats
      SET
        lead_id = COALESCE(public.comm_whatsapp_chats.lead_id, v_loser.lead_id),
        phone_number = CASE
          WHEN NULLIF(btrim(public.comm_whatsapp_chats.phone_number), '') IS NULL THEN v_loser.phone_number
          ELSE public.comm_whatsapp_chats.phone_number
        END,
        phone_digits = CASE
          WHEN NULLIF(btrim(public.comm_whatsapp_chats.phone_digits), '') IS NULL THEN v_loser.phone_digits
          ELSE public.comm_whatsapp_chats.phone_digits
        END,
        is_archived = public.comm_whatsapp_chats.is_archived OR v_loser.is_archived,
        is_muted = public.comm_whatsapp_chats.is_muted OR v_loser.is_muted,
        is_pinned = public.comm_whatsapp_chats.is_pinned OR v_loser.is_pinned,
        last_read_at = GREATEST(
          COALESCE(public.comm_whatsapp_chats.last_read_at, '-infinity'::timestamptz),
          COALESCE(v_loser.last_read_at, '-infinity'::timestamptz)
        ),
        deleted_at = CASE
          WHEN public.comm_whatsapp_chats.deleted_at IS NOT NULL AND v_loser.deleted_at IS NOT NULL
            THEN LEAST(public.comm_whatsapp_chats.deleted_at, v_loser.deleted_at)
          ELSE NULL
        END,
        updated_at = now()
      WHERE id = v_winner.id;

      v_winner_read_at := GREATEST(v_winner_read_at, v_loser.last_read_at);

      DELETE FROM public.comm_whatsapp_chat_merge_log
      WHERE winner_chat_id = v_loser.id OR loser_chat_id = v_loser.id;

      DELETE FROM public.comm_whatsapp_chats
      WHERE id = v_loser.id;
    END LOOP;

    SELECT m.text_content, m.message_at, m.direction, m.message_type, m.media_caption
    INTO v_latest_row
    FROM public.comm_whatsapp_messages AS m
    WHERE m.chat_id = v_winner.id
      AND COALESCE(m.delivery_status, '') <> 'deleted'
    ORDER BY m.message_at DESC
    LIMIT 1;

    v_preview := NULL;
    IF v_latest_row.message_at IS NOT NULL THEN
      v_preview := public.comm_whatsapp_message_preview_text(
        v_latest_row.media_caption,
        v_latest_row.text_content,
        v_latest_row.message_type
      );
    END IF;

    SELECT count(*) INTO v_unread
    FROM public.comm_whatsapp_messages AS msg
    WHERE msg.chat_id = v_winner.id
      AND msg.direction = 'inbound'
      AND COALESCE(msg.delivery_status, '') <> 'deleted'
      AND (v_winner_read_at IS NULL OR msg.message_at > v_winner_read_at);

    UPDATE public.comm_whatsapp_chats
    SET
      last_message_text = CASE
        WHEN v_preview IS NOT NULL THEN v_preview
        ELSE public.comm_whatsapp_chats.last_message_text
      END,
      last_message_direction = CASE
        WHEN v_preview IS NOT NULL THEN v_latest_row.direction
        ELSE public.comm_whatsapp_chats.last_message_direction
      END,
      last_message_at = CASE
        WHEN v_preview IS NOT NULL THEN v_latest_row.message_at
        ELSE public.comm_whatsapp_chats.last_message_at
      END,
      unread_count = v_unread,
      updated_at = now()
    WHERE id = v_winner.id;

    PERFORM public.comm_whatsapp_refresh_chat_identity(v_winner.id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;