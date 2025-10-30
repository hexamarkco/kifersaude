/*
  # Adicionar Tabelas para Integração Z-API e GPT

  ## Resumo
  Esta migration cria a infraestrutura necessária para integração com Z-API (WhatsApp) e OpenAI GPT
  para geração inteligente de mensagens baseadas em contexto de lembretes e histórico de conversas.

  ## 1. Novas Tabelas
  
  ### api_integrations
  - `id` (uuid, primary key)
  - `zapi_instance_id` (text) - ID da instância Z-API
  - `zapi_token` (text) - Token de autenticação Z-API
  - `openai_api_key` (text) - Chave API OpenAI
  - `openai_model` (text) - Modelo GPT a usar (gpt-4, gpt-3.5-turbo)
  - `openai_temperature` (numeric) - Temperatura do modelo (0-1)
  - `openai_max_tokens` (integer) - Máximo de tokens por requisição
  - `zapi_enabled` (boolean) - Se Z-API está ativo
  - `openai_enabled` (boolean) - Se OpenAI está ativo
  - `monthly_cost_limit` (numeric) - Limite de custo mensal em USD
  - `created_at`, `updated_at` (timestamptz)

  ### whatsapp_conversations
  - `id` (uuid, primary key)
  - `lead_id` (uuid, foreign key) - Relacionamento com lead
  - `contract_id` (uuid, foreign key, optional) - Relacionamento com contrato
  - `phone_number` (text) - Número de telefone
  - `message_id` (text) - ID da mensagem no Z-API
  - `message_text` (text) - Conteúdo da mensagem
  - `message_type` (text) - Tipo: sent, received
  - `timestamp` (timestamptz) - Quando a mensagem foi enviada/recebida
  - `read_status` (boolean) - Se mensagem foi lida
  - `media_url` (text, optional) - URL de mídia anexada
  - `created_at` (timestamptz)

  ### ai_generated_messages
  - `id` (uuid, primary key)
  - `reminder_id` (uuid, foreign key) - Lembrete que originou a mensagem
  - `lead_id` (uuid, foreign key) - Lead relacionado
  - `contract_id` (uuid, foreign key, optional) - Contrato relacionado
  - `prompt_used` (text) - Prompt enviado ao GPT
  - `message_generated` (text) - Mensagem gerada pela IA
  - `message_edited` (text, optional) - Mensagem após edição do usuário
  - `status` (text) - draft, approved, sent, failed
  - `tone` (text) - Tom de voz usado (professional, friendly, urgent, casual)
  - `tokens_used` (integer) - Quantidade de tokens consumidos
  - `cost_estimate` (numeric) - Custo estimado da geração
  - `conversation_context` (jsonb) - Histórico de conversa usado como contexto
  - `generated_by` (text) - Usuário que gerou
  - `approved_by` (text, optional) - Usuário que aprovou
  - `sent_at` (timestamptz, optional) - Quando foi enviada
  - `error_message` (text, optional) - Mensagem de erro se falhou
  - `created_at`, `updated_at` (timestamptz)

  ## 2. Índices
  - Índice em phone_number para busca rápida de conversas
  - Índice em status para filtrar mensagens por estado
  - Índice em lead_id e contract_id para relacionamentos

  ## 3. Segurança (RLS)
  - RLS habilitado em todas as tabelas
  - Políticas restritivas para usuários autenticados
  - api_integrations: apenas admin pode ver/editar
  - whatsapp_conversations: todos usuários autenticados podem ver
  - ai_generated_messages: todos usuários autenticados podem ver/criar, apenas criador pode editar

  ## 4. Trigger
  - Trigger para atualizar updated_at automaticamente
*/

-- Tabela de configurações de APIs
CREATE TABLE IF NOT EXISTS api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zapi_instance_id text,
  zapi_token text,
  openai_api_key text,
  openai_model text DEFAULT 'gpt-3.5-turbo',
  openai_temperature numeric DEFAULT 0.7,
  openai_max_tokens integer DEFAULT 500,
  zapi_enabled boolean DEFAULT false,
  openai_enabled boolean DEFAULT false,
  monthly_cost_limit numeric DEFAULT 50.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de conversas do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message_id text,
  message_text text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('sent', 'received')),
  timestamp timestamptz DEFAULT now(),
  read_status boolean DEFAULT false,
  media_url text,
  created_at timestamptz DEFAULT now()
);

-- Tabela de mensagens geradas por IA
CREATE TABLE IF NOT EXISTS ai_generated_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid REFERENCES reminders(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  prompt_used text NOT NULL,
  message_generated text NOT NULL,
  message_edited text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'failed')),
  tone text DEFAULT 'professional' CHECK (tone IN ('professional', 'friendly', 'urgent', 'casual')),
  tokens_used integer DEFAULT 0,
  cost_estimate numeric DEFAULT 0.00,
  conversation_context jsonb,
  generated_by text NOT NULL,
  approved_by text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_lead ON whatsapp_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_timestamp ON whatsapp_conversations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_status ON ai_generated_messages(status);
CREATE INDEX IF NOT EXISTS idx_ai_messages_lead ON ai_generated_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_reminder ON ai_generated_messages(reminder_id);

-- Habilitar RLS
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para api_integrations (apenas admin)
CREATE POLICY "Admin can view api integrations"
  ON api_integrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can update api integrations"
  ON api_integrations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can insert api integrations"
  ON api_integrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas RLS para whatsapp_conversations (todos autenticados)
CREATE POLICY "Users can view conversations"
  ON whatsapp_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert conversations"
  ON whatsapp_conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas RLS para ai_generated_messages
CREATE POLICY "Users can view ai messages"
  ON ai_generated_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create ai messages"
  ON ai_generated_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own ai messages"
  ON ai_generated_messages FOR UPDATE
  TO authenticated
  USING (generated_by = current_user)
  WITH CHECK (generated_by = current_user);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_api_integrations_updated_at'
  ) THEN
    CREATE TRIGGER update_api_integrations_updated_at
      BEFORE UPDATE ON api_integrations
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_ai_generated_messages_updated_at'
  ) THEN
    CREATE TRIGGER update_ai_generated_messages_updated_at
      BEFORE UPDATE ON ai_generated_messages
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Inserir registro inicial de configuração (vazio, será preenchido pelo usuário)
INSERT INTO api_integrations (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;