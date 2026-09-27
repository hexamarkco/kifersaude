BEGIN;

-- Registros marcados como salvos já representam uma decisão do operador.
-- Transforme essa decisão antiga no novo formato protegido antes da próxima
-- sincronização do provedor.
UPDATE public.comm_whatsapp_phone_contacts_cache AS contact
SET manual_override = true,
    manual_override_name = NULLIF(btrim(contact.display_name), '')
WHERE contact.saved = true
  AND NULLIF(btrim(contact.display_name), '') IS NOT NULL
  AND (
    COALESCE(contact.manual_override, false) = false
    OR NULLIF(btrim(contact.manual_override_name), '') IS NULL
  );

-- Corrija também a cópia exibida na conversa quando existir uma identidade
-- salva correspondente. O cache continua sendo a fonte canônica para novos
-- carregamentos e a atualização evita que uma tela antiga reapareça com o
-- nome do provedor.
WITH canonical_contacts AS (
  SELECT DISTINCT ON (contact.channel_id, contact.phone_digits)
    contact.channel_id,
    contact.phone_digits,
    contact.display_name
  FROM public.comm_whatsapp_phone_contacts_cache AS contact
  WHERE contact.saved = true
    AND contact.manual_override = true
    AND NULLIF(btrim(contact.manual_override_name), '') IS NOT NULL
    AND contact.phone_digits IS NOT NULL
  ORDER BY contact.channel_id, contact.phone_digits, contact.updated_at DESC, contact.id DESC
)
UPDATE public.comm_whatsapp_chats AS chat
SET saved_contact_name = canonical.display_name,
    display_name = canonical.display_name,
    updated_at = now()
FROM canonical_contacts AS canonical
WHERE chat.channel_id = canonical.channel_id
  AND chat.phone_digits = canonical.phone_digits
  AND COALESCE(chat.is_group, false) = false
  AND (
    chat.saved_contact_name IS DISTINCT FROM canonical.display_name
    OR chat.display_name IS DISTINCT FROM canonical.display_name
  );

COMMIT;
