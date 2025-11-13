-- Adiciona relacionamento explícito entre whatsapp_conversations e whatsapp_chat_peers
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS peer_id uuid REFERENCES whatsapp_chat_peers(id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_peer_id
  ON whatsapp_conversations(peer_id);

-- Vincula conversas existentes ao peer correspondente e normaliza identificadores
WITH matched_conversations AS (
  SELECT
    wc.id,
    p.id AS peer_id,
    p.normalized_phone,
    p.normalized_chat_lid,
    p.raw_chat_lid,
    ROW_NUMBER() OVER (
      PARTITION BY wc.id
      ORDER BY
        CASE
          WHEN p.normalized_phone IS NOT NULL AND p.normalized_phone <> '' THEN 1
          WHEN p.normalized_chat_lid IS NOT NULL AND p.normalized_chat_lid <> '' THEN 2
          WHEN p.raw_chat_lid IS NOT NULL AND p.raw_chat_lid <> '' THEN 3
          ELSE 4
        END
    ) AS rn
  FROM whatsapp_conversations wc
  JOIN whatsapp_chat_peers p ON (
    p.normalized_phone IS NOT NULL AND p.normalized_phone <> '' AND (
      p.normalized_phone = wc.phone_number OR p.normalized_phone = wc.target_phone
    )
  ) OR (
    p.normalized_chat_lid IS NOT NULL AND p.normalized_chat_lid <> '' AND (
      p.normalized_chat_lid = wc.phone_number OR p.normalized_chat_lid = wc.target_phone
    )
  ) OR (
    p.raw_chat_lid IS NOT NULL AND p.raw_chat_lid <> '' AND (
      p.raw_chat_lid = wc.phone_number OR p.raw_chat_lid = wc.target_phone
    )
  )
),
chosen_peers AS (
  SELECT *
  FROM matched_conversations
  WHERE rn = 1
)
UPDATE whatsapp_conversations wc
SET
  peer_id = COALESCE(wc.peer_id, cp.peer_id),
  phone_number = CASE
    WHEN cp.normalized_phone IS NOT NULL AND cp.normalized_phone <> '' THEN cp.normalized_phone
    WHEN cp.normalized_chat_lid IS NOT NULL AND cp.normalized_chat_lid <> '' THEN cp.normalized_chat_lid
    WHEN cp.raw_chat_lid IS NOT NULL AND cp.raw_chat_lid <> '' THEN cp.raw_chat_lid
    ELSE wc.phone_number
  END,
  target_phone = CASE
    WHEN cp.normalized_phone IS NOT NULL AND cp.normalized_phone <> '' THEN
      CASE
        WHEN wc.target_phone IS NULL OR wc.target_phone = '' OR wc.target_phone = cp.normalized_chat_lid OR wc.target_phone = cp.raw_chat_lid THEN cp.normalized_phone
        ELSE wc.target_phone
      END
    ELSE wc.target_phone
  END
FROM chosen_peers cp
WHERE wc.id = cp.id;
