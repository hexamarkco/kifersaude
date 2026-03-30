BEGIN;

ALTER TABLE public.comm_whatsapp_phone_contacts_cache
  ADD COLUMN IF NOT EXISTS saved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_phone_contacts_cache_saved_display_name
  ON public.comm_whatsapp_phone_contacts_cache (channel_id, saved, display_name);

COMMIT;
