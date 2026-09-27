-- The canonical inbox identity resolver compares all normalized phone variants
-- with the requested chat number when the direct cache lookup misses. A
-- functional GIN index keeps that fallback bounded to matching contacts
-- instead of scanning every saved contact for the channel.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_phone_contacts_cache_lookup_keys_saved
  ON public.comm_whatsapp_phone_contacts_cache
  USING gin (public.comm_whatsapp_phone_lookup_keys(phone_digits))
  WHERE saved = true;
