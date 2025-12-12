/*
  Normalização de chats e mensagens do WhatsApp para o formato canônico
  DDI_DDD_TELEFONE@s.whatsapp.net.

  Objetivo:
    - Garantir que whatsapp_chats tenha apenas uma entrada por telefone usando
      o sufixo @s.whatsapp.net.
    - Atualizar whatsapp_messages para apontar para o chat canônico.
    - Remover variações anteriores (ex.: @c.us ou sem sufixo) após a migração.

  Recomendações:
    - Execute dentro de uma transação e revise os resultados antes do COMMIT.
    - Ajuste nomes/last_message_at conforme necessário caso existam políticas
      específicas de negócio.
*/

BEGIN;

-- 1) Garantir que cada telefone tenha um chat canônico usando @s.whatsapp.net
WITH chat_variations AS (
  SELECT
    id AS old_id,
    COALESCE(phone_number, regexp_replace(id, '(@c\\.us|@s\\.whatsapp\\.net)$', '')) AS phone_number,
    name,
    last_message_at,
    created_at,
    updated_at,
    is_group
  FROM whatsapp_chats
  WHERE is_group = false
),
canonical AS (
  SELECT DISTINCT
    phone_number,
    phone_number || '@s.whatsapp.net' AS canonical_id
  FROM chat_variations
  WHERE phone_number <> ''
),
inserted AS (
  INSERT INTO whatsapp_chats (id, name, is_group, last_message_at, created_at, updated_at, phone_number)
  SELECT
    c.canonical_id,
    cv.name,
    false,
    cv.last_message_at,
    now(),
    now(),
    c.phone_number
  FROM canonical c
  CROSS JOIN LATERAL (
    SELECT name, last_message_at
    FROM chat_variations cv
    WHERE cv.phone_number = c.phone_number
    ORDER BY cv.last_message_at DESC NULLS LAST, cv.updated_at DESC NULLS LAST, cv.created_at DESC NULLS LAST
    LIMIT 1
  ) cv
  WHERE NOT EXISTS (SELECT 1 FROM whatsapp_chats w WHERE w.id = c.canonical_id)
  RETURNING id, phone_number
),
updated AS (
  UPDATE whatsapp_chats c
  SET
    name = COALESCE(c.name, meta.name),
    last_message_at = GREATEST(c.last_message_at, meta.last_message_at),
    phone_number = meta.phone_number
  FROM (
    SELECT
      phone_number,
      MAX(last_message_at) AS last_message_at,
      MAX(name) FILTER (WHERE name IS NOT NULL AND name <> '') AS name
    FROM chat_variations
    GROUP BY phone_number
  ) meta
  WHERE c.id = meta.phone_number || '@s.whatsapp.net'
)
SELECT 'canonical chats ensured' AS status;

-- 2) Atualizar mensagens para apontarem para o chat_id canônico
WITH mapping AS (
  SELECT
    old_id,
    phone_number || '@s.whatsapp.net' AS canonical_id
  FROM (
    SELECT
      id AS old_id,
      COALESCE(phone_number, regexp_replace(id, '(@c\\.us|@s\\.whatsapp\\.net)$', '')) AS phone_number
    FROM whatsapp_chats
    WHERE is_group = false
  ) v
  WHERE old_id <> phone_number || '@s.whatsapp.net'
)
UPDATE whatsapp_messages m
SET chat_id = mapping.canonical_id
FROM mapping
WHERE m.chat_id = mapping.old_id;

-- 3) Remover variações antigas após redirecionar as mensagens
DELETE FROM whatsapp_chats w
WHERE w.is_group = false
  AND w.id NOT LIKE '%@s.whatsapp.net'
  AND w.phone_number IS NOT NULL;

COMMIT;
