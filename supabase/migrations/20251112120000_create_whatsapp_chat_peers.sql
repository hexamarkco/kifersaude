/*
  # Unificação de Contatos do WhatsApp

  Esta migration cria a infraestrutura necessária para unificar contatos do WhatsApp
  utilizando telefone e chatLid como dois identificadores de uma mesma pessoa.
  Também normaliza os números existentes nas conversas para remover sufixos @lid/:lid
  e assegurar que o telefone com DDI seja a referência principal de cada chat.
*/

CREATE TABLE IF NOT EXISTS whatsapp_chat_peers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text,
  normalized_chat_lid text,
  raw_chat_lid text,
  chat_lid_history text[],
  is_group boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_chat_peers_phone
  ON whatsapp_chat_peers(normalized_phone)
  WHERE normalized_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_chat_peers_chat_lid
  ON whatsapp_chat_peers(normalized_chat_lid)
  WHERE normalized_chat_lid IS NOT NULL;

ALTER TABLE whatsapp_chat_peers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp peers"
  ON whatsapp_chat_peers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert whatsapp peers"
  ON whatsapp_chat_peers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update whatsapp peers"
  ON whatsapp_chat_peers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_whatsapp_chat_peers_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_chat_peers_updated_at
      BEFORE UPDATE ON whatsapp_chat_peers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Normalização dos identificadores já existentes nas conversas
WITH raw_identifiers AS (
  SELECT DISTINCT trim(value) AS identifier
  FROM (
    SELECT phone_number AS value FROM whatsapp_conversations
    UNION ALL
    SELECT target_phone AS value FROM whatsapp_conversations
  ) entries
  WHERE value IS NOT NULL
    AND trim(value) <> ''
    AND NOT (lower(trim(value)) LIKE '%@g.us' OR lower(trim(value)) LIKE '%-group')
),
normalized_identifiers AS (
  SELECT
    identifier,
    CASE
      WHEN lower(identifier) LIKE 'lid@%' OR lower(identifier) LIKE '%@lid' OR lower(identifier) LIKE '%:lid'
        THEN identifier
      ELSE NULL
    END AS raw_chat_lid,
    regexp_replace(
      regexp_replace(identifier, '(^lid@)|(@lid$)|(:lid$)', '', 'gi'),
      '\\D',
      '',
      'g'
    ) AS digits
  FROM raw_identifiers
),
prepared_identifiers AS (
  SELECT
    identifier,
    raw_chat_lid,
    digits,
    CASE
      WHEN digits LIKE '55%' THEN digits
      WHEN length(digits) = 13 AND digits LIKE '550%' THEN '55' || substring(digits FROM 4)
      WHEN length(digits) = 12 AND digits LIKE '550%' THEN '55' || substring(digits FROM 3)
      WHEN length(digits) = 11 THEN '55' || digits
      WHEN length(digits) >= 10 THEN digits
      ELSE NULL
    END AS normalized_phone,
    CASE
      WHEN raw_chat_lid IS NOT NULL THEN
        CASE
          WHEN digits LIKE '55%' THEN digits
          WHEN length(digits) = 13 AND digits LIKE '550%' THEN '55' || substring(digits FROM 4)
          WHEN length(digits) = 12 AND digits LIKE '550%' THEN '55' || substring(digits FROM 3)
          WHEN length(digits) = 11 THEN '55' || digits
          WHEN length(digits) >= 10 THEN digits
          ELSE NULL
        END
      ELSE NULL
    END AS normalized_chat_lid
  FROM normalized_identifiers
  WHERE digits IS NOT NULL AND digits <> ''
),
aggregated_peers AS (
  SELECT
    COALESCE(normalized_phone, normalized_chat_lid, digits) AS lookup_key,
    MAX(normalized_phone) FILTER (WHERE normalized_phone IS NOT NULL) AS normalized_phone,
    MAX(normalized_chat_lid) FILTER (WHERE normalized_chat_lid IS NOT NULL) AS normalized_chat_lid,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT raw_chat_lid), NULL) AS raw_chat_lids
  FROM prepared_identifiers
  GROUP BY COALESCE(normalized_phone, normalized_chat_lid, digits)
)
INSERT INTO whatsapp_chat_peers (normalized_phone, normalized_chat_lid, raw_chat_lid, chat_lid_history, created_at, updated_at)
SELECT
  normalized_phone,
  normalized_chat_lid,
  raw_chat_lids[1],
  CASE WHEN array_length(raw_chat_lids, 1) > 0 THEN raw_chat_lids ELSE NULL END,
  now(),
  now()
FROM aggregated_peers
ON CONFLICT DO NOTHING;

-- Atualização das conversas existentes para utilizar o telefone normalizado como chave
WITH normalized_conversations AS (
  SELECT
    id,
    CASE
      WHEN phone_number IS NULL OR trim(phone_number) = '' THEN NULL
      WHEN lower(phone_number) LIKE '%@g.us' OR lower(phone_number) LIKE '%-group' THEN trim(phone_number)
      ELSE (
        SELECT CASE
          WHEN digits LIKE '55%' THEN digits
          WHEN length(digits) = 13 AND digits LIKE '550%' THEN '55' || substring(digits FROM 4)
          WHEN length(digits) = 12 AND digits LIKE '550%' THEN '55' || substring(digits FROM 3)
          WHEN length(digits) = 11 THEN '55' || digits
          WHEN length(digits) >= 10 THEN digits
          ELSE trim(phone_number)
        END
        FROM (
          SELECT regexp_replace(
                   regexp_replace(trim(coalesce(phone_number, '')),
                     '(^lid@)|(@lid$)|(:lid$)', '', 'gi'),
                   '\\D', '', 'g'
                 ) AS digits
        ) AS normalized_digits
      )
    END AS normalized_phone_number,
    CASE
      WHEN target_phone IS NULL OR trim(target_phone) = '' THEN NULL
      WHEN lower(target_phone) LIKE '%@g.us' OR lower(target_phone) LIKE '%-group' THEN trim(target_phone)
      ELSE (
        SELECT CASE
          WHEN digits LIKE '55%' THEN digits
          WHEN length(digits) = 13 AND digits LIKE '550%' THEN '55' || substring(digits FROM 4)
          WHEN length(digits) = 12 AND digits LIKE '550%' THEN '55' || substring(digits FROM 3)
          WHEN length(digits) = 11 THEN '55' || digits
          WHEN length(digits) >= 10 THEN digits
          ELSE trim(target_phone)
        END
        FROM (
          SELECT regexp_replace(
                   regexp_replace(trim(coalesce(target_phone, '')),
                     '(^lid@)|(@lid$)|(:lid$)', '', 'gi'),
                   '\\D', '', 'g'
                 ) AS digits
        ) AS normalized_digits
      )
    END AS normalized_target_phone
  FROM whatsapp_conversations
)
UPDATE whatsapp_conversations wc
SET
  phone_number = COALESCE(nc.normalized_phone_number, wc.phone_number),
  target_phone = COALESCE(nc.normalized_target_phone, wc.target_phone)
FROM normalized_conversations nc
WHERE wc.id = nc.id
  AND (
    wc.phone_number IS DISTINCT FROM nc.normalized_phone_number OR
    wc.target_phone IS DISTINCT FROM nc.normalized_target_phone
  );

