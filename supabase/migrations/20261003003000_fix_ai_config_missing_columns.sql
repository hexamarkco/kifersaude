/*
  # Fix AI Config Tables — add missing columns for frontend

  The original migration (20261003001000) created the tables but missed
  columns the frontend needs:
  - ai_features: category, available_variables, default_* columns
  - ai_feature_configs: activated_at, deactivated_at
  - ai_global_configs: rebuilt as simple key-value (not versioned)
*/

-- ============================================================
-- 1. AI FEATURES — add missing columns
-- ============================================================

ALTER TABLE ai_features ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outros';
ALTER TABLE ai_features ADD COLUMN IF NOT EXISTS available_variables jsonb DEFAULT '[]'::jsonb;
ALTER TABLE ai_features ADD COLUMN IF NOT EXISTS default_feature_prompt text DEFAULT '';
ALTER TABLE ai_features ADD COLUMN IF NOT EXISTS default_output_instructions text DEFAULT '';
ALTER TABLE ai_features ADD COLUMN IF NOT EXISTS default_temperature float DEFAULT 0.4;
ALTER TABLE ai_features ADD COLUMN IF NOT EXISTS default_max_output_tokens int DEFAULT 500;

-- ============================================================
-- 2. AI FEATURE CONFIGS — add timestamp columns
-- ============================================================

ALTER TABLE ai_feature_configs ADD COLUMN IF NOT EXISTS activated_at timestamptz;
ALTER TABLE ai_feature_configs ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- ============================================================
-- 3. AI GLOBAL CONFIGS — rebuild as simple key-value
-- ============================================================

-- Drop old versioned structure
DROP TABLE IF EXISTS ai_global_configs CASCADE;

CREATE TABLE IF NOT EXISTS ai_global_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text DEFAULT '',
  description text,
  updated_by text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_global_configs_key ON ai_global_configs(key);

-- RLS for global configs
ALTER TABLE ai_global_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage ai_global_configs"
  ON ai_global_configs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage ai_global_configs"
  ON ai_global_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Update seed data — add categories, variables, defaults
-- ============================================================

UPDATE ai_features SET
  category = 'messaging',
  available_variables = '["transcript", "style_profile", "company_name", "lead_name", "temporal_facts", "conversation_summary"]'::jsonb,
  default_feature_prompt = 'Você é um assistente de comunicação que reescreve mensagens de WhatsApp para soar mais naturais e eficazes.',
  default_output_instructions = 'Retorne apenas o texto reescrito, sem aspas, sem explicações extras.',
  default_temperature = 0.45,
  default_max_output_tokens = 320
WHERE key = 'message.rewrite';

UPDATE ai_features SET
  category = 'messaging',
  available_variables = '["transcript", "style_profile", "company_name", "lead_name", "current_message", "custom_instructions"]'::jsonb,
  default_feature_prompt = 'Você é um assistente de comunicação que sugere a próxima mensagem ideal em uma conversa comercial de WhatsApp.',
  default_output_instructions = 'Retorne a mensagem sugerida em texto puro.',
  default_temperature = 0.65,
  default_max_output_tokens = 420
WHERE key = 'message.suggest';

UPDATE ai_features SET
  category = 'followup',
  available_variables = '["transcript", "style_profile", "temporal_facts", "lead_context", "recent_audits", "commercial_analysis", "strategy"]'::jsonb,
  default_feature_prompt = 'Você é um analista comercial que avalia conversas de WhatsApp e define a melhor estratégia de follow-up.',
  default_output_instructions = 'Retorne um JSON com analysis e strategy seguindo o schema definido.',
  default_temperature = 0.3,
  default_max_output_tokens = 900
WHERE key = 'followup.analysis';

UPDATE ai_features SET
  category = 'followup',
  available_variables = '["transcript", "style_profile", "temporal_facts", "lead_context", "commercial_analysis", "strategy", "validation_feedback"]'::jsonb,
  default_feature_prompt = 'Você é Luiza, corretora especialista em planos de saúde da Kifer Saude. Sua tarefa é escrever a mensagem de follow-up que executa exatamente a estratégia definida.',
  default_output_instructions = 'Retorne JSON com {"messages": [{"text": "...", "delay_amount": 0}], "commercial_function": "...", "goal": "..."}',
  default_temperature = 0.7,
  default_max_output_tokens = 520
WHERE key = 'followup.generate';

UPDATE ai_features SET
  category = 'followup',
  available_variables = '["transcript", "style_profile", "temporal_facts", "current_message", "adjustment_instruction"]'::jsonb,
  default_feature_prompt = 'Você refin mensagens de follow-up de WhatsApp aplicando ajustes solicitados.',
  default_output_instructions = 'Retorne apenas o texto final da mensagem refinada.',
  default_temperature = 0.7,
  default_max_output_tokens = 320
WHERE key = 'followup.refine';

UPDATE ai_features SET
  category = 'campaign',
  available_variables = '["message_text", "company_name"]'::jsonb,
  default_feature_prompt = 'Você classifica a intenção de uma resposta recebida no WhatsApp após uma campanha comercial da Kifer Saude.',
  default_output_instructions = 'Retorne somente JSON válido, sem markdown.',
  default_temperature = 0.1,
  default_max_output_tokens = 280
WHERE key = 'campaign.intent';

UPDATE ai_features SET
  category = 'agenda',
  available_variables = '["candidates", "options"]'::jsonb,
  default_feature_prompt = 'Você prioriza uma fila diária de follow-ups comerciais de planos de saúde usando principalmente o contexto real de mensagens de cada chat.',
  default_output_instructions = 'Retorne apenas JSON válido no formato {"items":[{"id":"...","score":0,"reason":"motivo"}]}',
  default_temperature = 0.15,
  default_max_output_tokens = 1800
WHERE key = 'agenda.organize';

UPDATE ai_features SET
  category = 'transcription',
  available_variables = '["audio_url", "language"]'::jsonb,
  default_feature_prompt = 'Transcreva o áudio fornecido em português do Brasil.',
  default_output_instructions = 'Retorne o texto transcrito.',
  default_temperature = 0.0,
  default_max_output_tokens = 2048
WHERE key = 'audio.transcribe';

UPDATE ai_features SET
  category = 'autonomous',
  available_variables = '["transcript", "style_profile", "reference_prompt", "lead_name"]'::jsonb,
  default_feature_prompt = 'Você é a Luiza, corretora especialista em planos de saúde da Kifer Saude, falando no WhatsApp. Você NÃO é uma assistente, NÃO é uma IA — para todos os efeitos, você É a Luiza.',
  default_output_instructions = 'Retorne a resposta em texto puro, usando "---" para separar mensagens quando apropriado.',
  default_temperature = 0.6,
  default_max_output_tokens = 350
WHERE key = 'autonomous.reply';

UPDATE ai_features SET
  category = 'sandbox',
  available_variables = '["transcript", "style_profile", "reference_prompt", "lead_name"]'::jsonb,
  default_feature_prompt = 'Você é a Luiza, corretora especialista em planos de saúde da Kifer Saude, falando no WhatsApp. Simulação interna para testes.',
  default_output_instructions = 'Retorne a resposta em texto puro, usando "---" para separar mensagens.',
  default_temperature = 0.6,
  default_max_output_tokens = 350
WHERE key = 'sandbox.chat';

UPDATE ai_features SET
  category = 'sandbox',
  available_variables = '["scenario_config", "lead_persona", "rules"]'::jsonb,
  default_feature_prompt = 'Você executa cenários de teste automatizados para simular conversas de atendimento.',
  default_output_instructions = 'Retorne JSON com o resultado do cenário.',
  default_temperature = 0.6,
  default_max_output_tokens = 450
WHERE key = 'sandbox.scenario';

UPDATE ai_features SET
  category = 'messaging',
  available_variables = '["transcript", "company_name", "lead_name", "recent_audits"]'::jsonb,
  default_feature_prompt = 'Você é um supervisor de qualidade (QA) que avalia atendimentos de vendas de planos de saúde pelo WhatsApp.',
  default_output_instructions = 'Retorne SOMENTE um objeto JSON válido com resumo, avaliação, pontos fortes, pontos de atenção e erros.',
  default_temperature = 0.3,
  default_max_output_tokens = 1100
WHERE key = 'attendance.critique';

-- ============================================================
-- 5. Seed global configs
-- ============================================================

INSERT INTO ai_global_configs (key, value, description) VALUES
  ('global_instructions', 'Você é um copiloto comercial especializado em vendas de planos de saúde. Seu objetivo é ajudar o corretor a avançar a venda de forma estratégica e humana.', 'Instruções globais que se aplicam a todas as features de IA.'),
  ('global_style', 'Escreva de forma natural, como se fosse uma conversa humana no WhatsApp. Evite linguagem robótica, formalidade excessiva e textos grandes. Respeite o estilo da conversa anterior.', 'Estilo global de comunicação para todas as respostas.')
ON CONFLICT (key) DO NOTHING;
