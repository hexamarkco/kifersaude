-- 2026-05-20: Preserva `last_read_at` quando o usuario marca um chat como
-- "nao lida" manualmente. Antes desta migration o RPC zerava
-- `last_read_at = NULL`, o que fazia com que a proxima abertura do chat
-- recalculasse o estado como "totalmente nao lido" e o effect automatico
-- de mark-as-read zerasse `manual_unread` quase instantaneamente.
--
-- A nova logica mantem o `last_read_at` historico, mas desloca-o 1 ms para
-- tras do `last_message_at` quando este existe, garantindo que o efeito
-- visual do "manual_unread = true" persista ate o usuario interagir
-- explicitamente com o chat (scroll, foco, abrir mensagem).

BEGIN;

DROP FUNCTION IF EXISTS public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_update_chat_inbox_state(
  p_chat_id uuid,
  p_is_archived boolean DEFAULT NULL,
  p_is_muted boolean DEFAULT NULL,
  p_is_pinned boolean DEFAULT NULL,
  p_mark_as_unread boolean DEFAULT NULL
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  UPDATE public.comm_whatsapp_chats
  SET
    is_archived = COALESCE(p_is_archived, public.comm_whatsapp_chats.is_archived),
    archived_at = CASE
      WHEN p_is_archived IS NULL THEN public.comm_whatsapp_chats.archived_at
      WHEN p_is_archived THEN COALESCE(public.comm_whatsapp_chats.archived_at, now())
      ELSE NULL
    END,
    is_muted = COALESCE(p_is_muted, public.comm_whatsapp_chats.is_muted),
    muted_at = CASE
      WHEN p_is_muted IS NULL THEN public.comm_whatsapp_chats.muted_at
      WHEN p_is_muted THEN COALESCE(public.comm_whatsapp_chats.muted_at, now())
      ELSE NULL
    END,
    is_pinned = COALESCE(p_is_pinned, public.comm_whatsapp_chats.is_pinned),
    pinned_at = CASE
      WHEN p_is_pinned IS NULL THEN public.comm_whatsapp_chats.pinned_at
      WHEN p_is_pinned THEN COALESCE(public.comm_whatsapp_chats.pinned_at, now())
      ELSE NULL
    END,
    manual_unread = CASE
      WHEN p_mark_as_unread IS NULL THEN public.comm_whatsapp_chats.manual_unread
      WHEN p_mark_as_unread AND public.comm_whatsapp_chats.unread_count = 0 THEN true
      ELSE false
    END,
    manual_unread_at = CASE
      WHEN p_mark_as_unread IS NULL THEN public.comm_whatsapp_chats.manual_unread_at
      WHEN p_mark_as_unread AND public.comm_whatsapp_chats.unread_count = 0 THEN COALESCE(public.comm_whatsapp_chats.manual_unread_at, now())
      ELSE NULL
    END,
    -- BUG FIX (2026-05-20, BUG #11): preserva last_read_at ao marcar nao lida.
    -- Antes: marcava NULL e o auto-mark-read disparava imediatamente.
    -- Agora: deslocamos 1ms para tras do last_message_at (ou mantemos
    -- o valor anterior) para que o estado "nao lida manual" persista.
    last_read_at = CASE
      WHEN p_mark_as_unread = true THEN
        CASE
          WHEN public.comm_whatsapp_chats.last_message_at IS NOT NULL
            THEN public.comm_whatsapp_chats.last_message_at - INTERVAL '1 millisecond'
          ELSE public.comm_whatsapp_chats.last_read_at
        END
      WHEN p_mark_as_unread = false THEN now()
      ELSE public.comm_whatsapp_chats.last_read_at
    END,
    unread_count = CASE
      WHEN p_mark_as_unread = false THEN 0
      ELSE public.comm_whatsapp_chats.unread_count
    END,
    updated_at = now()
  WHERE public.comm_whatsapp_chats.id = p_chat_id
  RETURNING * INTO v_chat;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa do WhatsApp nao encontrada.';
  END IF;

  RETURN QUERY SELECT v_chat.*;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean, boolean, boolean) TO authenticated;

COMMIT;
