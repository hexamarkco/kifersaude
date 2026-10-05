BEGIN;

-- Mensagens novas inbound reabrem chats nao mutados; outbound reabre todos.
-- Deduplicacao continua distinguindo mensagens de ecos/atualizacoes de status.
-- Alterar somente estes blocos preserva as otimizacoes e ACLs das RPCs atuais.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_old_condition text := $old$WHEN v_inserted
        AND v_has_visible_summary
        AND NOT public.comm_whatsapp_chats.is_muted
        AND public.comm_whatsapp_chats.is_archived
        AND (public.comm_whatsapp_chats.archived_at IS NULL OR v_message_at > public.comm_whatsapp_chats.archived_at)$old$;
  v_new_condition text := $new$WHEN v_inserted
        AND (
          v_direction = 'outbound'
          OR (v_direction = 'inbound' AND NOT public.comm_whatsapp_chats.is_muted)
        )$new$;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO v_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'comm_whatsapp_persist_message_internal' AND p.pronargs = 28;

  IF v_definition IS NULL OR
     (length(v_definition) - length(replace(v_definition, v_old_condition, ''))) / length(v_old_condition) <> 2 THEN
    RAISE EXCEPTION 'Blocos de arquivamento da persistencia interna nao encontrados.';
  END IF;
  v_updated_definition := replace(v_definition, v_old_condition, v_new_condition);
  EXECUTE v_updated_definition;

  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO v_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'comm_whatsapp_persist_message' AND p.pronargs = 28;

  v_old_condition := $old$  IF v_result.inserted
    AND v_direction = 'inbound'
    AND COALESCE(p_increment_unread, false)
    AND v_summary_text IS NOT NULL
  THEN
    UPDATE public.comm_whatsapp_chats chat
    SET is_archived = false, archived_at = NULL, updated_at = now()
    WHERE chat.id = v_canonical_chat_id
      AND chat.is_archived
      AND NOT chat.is_muted
      AND (chat.archived_at IS NULL OR v_message_at > chat.archived_at)
    RETURNING chat.unread_count INTO v_unread_count;
  END IF;

  -- A funcao interna pode reabrir outbound novos. Se o chat ja estava
  -- arquivado quando a RPC adquiriu o lock, o arquivamento manual vence
  -- qualquer eco de envio, persistencia tardia ou atualizacao de status.
  IF v_direction = 'outbound' AND v_was_archived THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET is_archived = true,
        archived_at = v_archived_at,
        updated_at = now()
    WHERE chat.id = v_canonical_chat_id;
  END IF;$old$;
  v_new_condition := $new$  IF v_result.inserted AND v_direction IN ('inbound', 'outbound') THEN
    UPDATE public.comm_whatsapp_chats chat
    SET is_archived = false, archived_at = NULL, updated_at = now()
    WHERE chat.id = v_canonical_chat_id
      AND chat.is_archived
      AND (v_direction = 'outbound' OR NOT chat.is_muted)
    RETURNING chat.unread_count INTO v_unread_count;
  END IF;$new$;

  IF v_definition IS NULL OR position(v_old_condition IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Bloco de arquivamento da persistencia canonica nao encontrado.';
  END IF;
  v_updated_definition := replace(v_definition, v_old_condition, v_new_condition);
  EXECUTE v_updated_definition;
END;
$migration$;

-- A persistencia ja protege inbound mutado. O trigger legado inferia a
-- direcao pelo contador e bloqueava outbound com incremento de nao lidas.
DROP TRIGGER IF EXISTS trg_comm_whatsapp_preserve_archived_when_muted ON public.comm_whatsapp_chats;

NOTIFY pgrst, 'reload schema';
COMMIT;
