/*
  # WhatsApp chat archive + mute
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.whatsapp_chats ADD COLUMN archived boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'mute_until'
  ) THEN
    ALTER TABLE public.whatsapp_chats ADD COLUMN mute_until timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_archived
  ON public.whatsapp_chats(archived);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_mute_until
  ON public.whatsapp_chats(mute_until);
