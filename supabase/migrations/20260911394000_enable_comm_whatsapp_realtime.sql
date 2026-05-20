ALTER TABLE public.comm_whatsapp_chats REPLICA IDENTITY FULL;
ALTER TABLE public.comm_whatsapp_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comm_whatsapp_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_whatsapp_chats;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comm_whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_whatsapp_messages;
  END IF;
END $$;
