/*
  # Controle local de leitura de conversas do WhatsApp

  Esta migration adiciona os campos necessários para registrar o último ponto
  de leitura local de cada chat e inicializa esses marcadores a partir do
  histórico existente. Os campos serão utilizados pela aplicação para calcular
  a quantidade de mensagens não lidas sem depender da API externa.
*/

ALTER TABLE whatsapp_chat_peers
  ADD COLUMN IF NOT EXISTS last_read_message_id uuid,
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

ALTER TABLE whatsapp_chat_peers
  DROP CONSTRAINT IF EXISTS whatsapp_chat_peers_last_read_message_id_fkey;

ALTER TABLE whatsapp_chat_peers
  ADD CONSTRAINT whatsapp_chat_peers_last_read_message_id_fkey
    FOREIGN KEY (last_read_message_id)
    REFERENCES whatsapp_conversations(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_peers_last_read_at
  ON whatsapp_chat_peers(last_read_at DESC);

WITH read_messages AS (
  SELECT
    id,
    COALESCE(NULLIF(phone_number, ''), NULLIF(target_phone, '')) AS chat_identifier,
    COALESCE(timestamp, created_at) AS message_ts,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(phone_number, ''), NULLIF(target_phone, ''))
      ORDER BY COALESCE(timestamp, created_at) DESC, id DESC
    ) AS rn
  FROM whatsapp_conversations
  WHERE message_type = 'received'
    AND read_status IS TRUE
),
latest_per_chat AS (
  SELECT chat_identifier, id, message_ts
  FROM read_messages
  WHERE rn = 1 AND chat_identifier IS NOT NULL
)
UPDATE whatsapp_chat_peers peers
SET
  last_read_message_id = latest.id,
  last_read_at = latest.message_ts
FROM latest_per_chat latest
WHERE latest.chat_identifier IS NOT NULL
  AND (
    (peers.normalized_phone IS NOT NULL AND peers.normalized_phone = latest.chat_identifier) OR
    (peers.normalized_chat_lid IS NOT NULL AND peers.normalized_chat_lid = latest.chat_identifier) OR
    (peers.raw_chat_lid IS NOT NULL AND peers.raw_chat_lid = latest.chat_identifier)
  );
