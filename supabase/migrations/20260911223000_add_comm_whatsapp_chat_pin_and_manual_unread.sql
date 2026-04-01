BEGIN;

ALTER TABLE public.comm_whatsapp_chats
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_unread boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_unread_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_pinned_last_message
  ON public.comm_whatsapp_chats (is_pinned, pinned_at DESC NULLS LAST, last_message_at DESC NULLS LAST, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_manual_unread
  ON public.comm_whatsapp_chats (manual_unread);

DROP FUNCTION IF EXISTS public.comm_whatsapp_update_chat_inbox_state(uuid, boolean, boolean);

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
    last_read_at = CASE
      WHEN p_mark_as_unread THEN NULL
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

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_chat_read(p_chat_id uuid)
RETURNS TABLE(
  id uuid,
  unread_count integer,
  last_read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  RETURN QUERY
  UPDATE public.comm_whatsapp_chats
  SET
    unread_count = 0,
    manual_unread = false,
    manual_unread_at = NULL,
    last_read_at = now(),
    updated_at = now()
  WHERE public.comm_whatsapp_chats.id = p_chat_id
  RETURNING
    comm_whatsapp_chats.id,
    comm_whatsapp_chats.unread_count,
    comm_whatsapp_chats.last_read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_clear_manual_unread_on_real_unread()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.unread_count, 0) > COALESCE(OLD.unread_count, 0) THEN
    NEW.manual_unread := false;
    NEW.manual_unread_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_clear_manual_unread_on_real_unread ON public.comm_whatsapp_chats;
CREATE TRIGGER trg_comm_whatsapp_clear_manual_unread_on_real_unread
  BEFORE UPDATE ON public.comm_whatsapp_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_clear_manual_unread_on_real_unread();

COMMIT;
