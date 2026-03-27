BEGIN;

UPDATE public.comm_whatsapp_chats AS chats
SET
  phone_number = public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)),
  phone_digits = public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)),
  display_name = CASE
    WHEN NULLIF(btrim(chats.push_name), '') IS NOT NULL THEN btrim(chats.push_name)
    WHEN NULLIF(btrim(chats.display_name), '') IS NULL THEN
      CASE
        WHEN char_length(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1))) = 13 THEN
          '+55 (' || substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 3 for 2) || ') ' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 5 for 5) || '-' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 10)
        WHEN char_length(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1))) = 12 THEN
          '+55 (' || substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 3 for 2) || ') ' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 5 for 4) || '-' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 9)
        ELSE public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1))
      END
    WHEN EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_channels channels
      WHERE channels.id = chats.channel_id
        AND NULLIF(btrim(channels.connected_user_name), '') IS NOT NULL
        AND lower(btrim(chats.display_name)) = lower(btrim(channels.connected_user_name))
    ) THEN
      CASE
        WHEN char_length(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1))) = 13 THEN
          '+55 (' || substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 3 for 2) || ') ' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 5 for 5) || '-' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 10)
        WHEN char_length(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1))) = 12 THEN
          '+55 (' || substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 3 for 2) || ') ' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 5 for 4) || '-' ||
          substring(public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1)) from 9)
        ELSE public.normalize_comm_whatsapp_phone(split_part(chats.external_chat_id, '@', 1))
      END
    ELSE chats.display_name
  END,
  updated_at = now()
WHERE chats.external_chat_id LIKE '%@s.whatsapp.net';

COMMIT;
