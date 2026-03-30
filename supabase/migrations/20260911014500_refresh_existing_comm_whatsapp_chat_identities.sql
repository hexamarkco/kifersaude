BEGIN;

SELECT public.comm_whatsapp_refresh_channel_chat_identities(id)
FROM public.comm_whatsapp_channels;

COMMIT;
