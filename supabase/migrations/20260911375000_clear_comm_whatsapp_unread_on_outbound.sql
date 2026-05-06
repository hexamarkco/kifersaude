CREATE OR REPLACE FUNCTION public.comm_whatsapp_clear_unread_on_outbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction <> 'outbound' THEN
    RETURN NEW;
  END IF;

  UPDATE public.comm_whatsapp_chats c
  SET
    unread_count = 0,
    manual_unread = false,
    manual_unread_at = NULL,
    last_read_at = GREATEST(
      COALESCE(c.last_read_at, '-infinity'::timestamptz),
      COALESCE(NEW.message_at, now())
    ),
    updated_at = now()
  WHERE c.id = NEW.chat_id
    AND (
      c.unread_count > 0
      OR c.manual_unread = true
      OR c.last_read_at IS NULL
      OR COALESCE(NEW.message_at, now()) > c.last_read_at
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comm_whatsapp_clear_unread_on_outbound_message_trigger
  ON public.comm_whatsapp_messages;

CREATE TRIGGER comm_whatsapp_clear_unread_on_outbound_message_trigger
AFTER INSERT ON public.comm_whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.comm_whatsapp_clear_unread_on_outbound_message();
