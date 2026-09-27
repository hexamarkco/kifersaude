BEGIN;

-- The protected media endpoint looks up message metadata by media_id before
-- downloading from Storage or Whapi. Keep that lookup independent from the
-- broader chat-media partial index, which otherwise scans every media row.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_media_id
  ON public.comm_whatsapp_messages (media_id)
  WHERE media_id IS NOT NULL;

COMMIT;
