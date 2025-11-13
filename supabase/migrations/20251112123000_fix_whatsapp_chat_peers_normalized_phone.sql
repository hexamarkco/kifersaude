-- Corrige registros em whatsapp_chat_peers onde normalized_phone contém chatLid
UPDATE whatsapp_chat_peers
SET normalized_phone = NULL,
    updated_at = NOW()
WHERE normalized_phone IS NOT NULL
  AND (
    normalized_phone = normalized_chat_lid
    OR normalized_phone ~* '(@lid|lid@|:lid|lid:)'
  );
