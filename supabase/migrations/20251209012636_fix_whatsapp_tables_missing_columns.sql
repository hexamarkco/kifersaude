/*
  # Corrigir colunas faltantes nas tabelas WhatsApp

  ## Descrição
  Esta migração adiciona as colunas faltantes nas tabelas whatsapp_chats e whatsapp_messages
  que são necessárias para o funcionamento correto do webhook do WhatsApp.

  ## Mudanças na tabela whatsapp_chats
  - Adiciona `phone_number` (text) - Número de telefone extraído do chat_id
  - Adiciona `lid` (text, nullable) - WhatsApp Local ID para chats que usam @lid

  ## Mudanças na tabela whatsapp_messages
  - Adiciona `direction` (text) - Direção da mensagem: 'inbound' ou 'outbound'
  - Adiciona `author` (text, nullable) - Autor da mensagem em grupos
  - Adiciona `ack_status` (integer) - Status de confirmação (0=falha, 1=enviando, 2=enviado, 3=recebido, 4=lido)
  - Adiciona `original_body` (text, nullable) - Conteúdo original antes de edições
  - Adiciona `is_deleted` (boolean) - Indica se a mensagem foi deletada
  - Adiciona `edit_count` (integer) - Contador de edições
  - Adiciona `edited_at` (timestamptz, nullable) - Data da última edição
  - Adiciona `deleted_at` (timestamptz, nullable) - Data da deleção
  - Adiciona `deleted_by` (text, nullable) - Quem deletou a mensagem

  ## Índices
  - Adiciona índice em phone_number para buscas rápidas
  - Adiciona índice em direction para filtros
  - Adiciona índice em ack_status para rastreamento de status
*/

-- Adicionar colunas na tabela whatsapp_chats
DO $$
BEGIN
  -- phone_number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE whatsapp_chats ADD COLUMN phone_number text;
  END IF;

  -- lid (WhatsApp Local ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'lid'
  ) THEN
    ALTER TABLE whatsapp_chats ADD COLUMN lid text;
  END IF;
END $$;

-- Adicionar colunas na tabela whatsapp_messages
DO $$
BEGIN
  -- direction
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'direction'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN direction text;
    ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_direction_check 
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;

  -- author (para mensagens de grupos)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'author'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN author text;
  END IF;

  -- ack_status (status de confirmação)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'ack_status'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN ack_status integer;
  END IF;

  -- original_body (corpo original antes de edições)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'original_body'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN original_body text;
  END IF;

  -- is_deleted (marca se a mensagem foi deletada)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;

  -- edit_count (contador de edições)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'edit_count'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN edit_count integer DEFAULT 0;
  END IF;

  -- edited_at (data da última edição)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN edited_at timestamptz;
  END IF;

  -- deleted_at (data da deleção)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN deleted_at timestamptz;
  END IF;

  -- deleted_by (quem deletou)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN deleted_by text;
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone_number ON whatsapp_chats(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_lid ON whatsapp_chats(lid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ack_status ON whatsapp_messages(ack_status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_author ON whatsapp_messages(author);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_is_deleted ON whatsapp_messages(is_deleted) WHERE is_deleted = true;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN whatsapp_chats.phone_number IS 'Número de telefone extraído do chat_id (sem sufixos @c.us, @g.us, etc)';
COMMENT ON COLUMN whatsapp_chats.lid IS 'WhatsApp Local ID para chats que usam @lid';
COMMENT ON COLUMN whatsapp_messages.direction IS 'Direção da mensagem: inbound (recebida) ou outbound (enviada)';
COMMENT ON COLUMN whatsapp_messages.author IS 'Autor da mensagem em conversas de grupo (phone number)';
COMMENT ON COLUMN whatsapp_messages.ack_status IS 'Status de confirmação: 0=falha, 1=enviando, 2=enviado, 3=recebido, 4=lido';
COMMENT ON COLUMN whatsapp_messages.original_body IS 'Conteúdo original da mensagem antes de edições';
COMMENT ON COLUMN whatsapp_messages.is_deleted IS 'Indica se a mensagem foi deletada';
COMMENT ON COLUMN whatsapp_messages.edit_count IS 'Número de vezes que a mensagem foi editada';
COMMENT ON COLUMN whatsapp_messages.edited_at IS 'Data e hora da última edição';
COMMENT ON COLUMN whatsapp_messages.deleted_at IS 'Data e hora em que a mensagem foi deletada';
COMMENT ON COLUMN whatsapp_messages.deleted_by IS 'Identificador de quem deletou a mensagem';
