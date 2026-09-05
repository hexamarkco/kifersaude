/*
  # AI Models Catalog

  Central catalog of available AI models per provider.
  Separated from ai_model_pricing (which is exclusively for price history).

  capabilities text[] allows a model to support multiple use cases:
    - text: chat/completion
    - structured_output: JSON mode / function calling
    - reasoning: extended thinking / chain-of-thought
    - transcription: audio-to-text
    - multimodal: image/vision input

  UNIQUE(provider, model) prevents duplicates.
  active = false disables without deleting.
  deprecated_at signals provider has end-of-lifed the model.
*/

CREATE TABLE IF NOT EXISTS ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  display_name text NOT NULL,
  capabilities text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  deprecated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ai_models_provider_model_unique UNIQUE (provider, model)
);

CREATE INDEX IF NOT EXISTS idx_ai_models_active ON ai_models (provider, active) WHERE active = true;

CREATE OR REPLACE FUNCTION set_ai_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_models_updated_at ON ai_models;
CREATE TRIGGER trg_ai_models_updated_at
  BEFORE UPDATE ON ai_models
  FOR EACH ROW
  EXECUTE FUNCTION set_ai_models_updated_at();

-- ============================================================
-- Seed: known models per provider
-- ============================================================

INSERT INTO ai_models (provider, model, display_name, capabilities) VALUES
  -- OpenAI text/reasoning
  ('openai', 'gpt-5.5',                'GPT-5.5',                ARRAY['text', 'structured_output', 'reasoning']),
  ('openai', 'gpt-4o',                 'GPT-4o',                 ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('openai', 'gpt-4o-mini',            'GPT-4o Mini',            ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('openai', 'gpt-4.1',                'GPT-4.1',                ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('openai', 'gpt-4.1-mini',           'GPT-4.1 Mini',           ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('openai', 'gpt-4.1-nano',           'GPT-4.1 Nano',           ARRAY['text', 'structured_output', 'reasoning']),
  ('openai', 'o3',                     'o3',                     ARRAY['text', 'structured_output', 'reasoning']),
  ('openai', 'o4-mini',                'o4-mini',                ARRAY['text', 'structured_output', 'reasoning']),
  -- OpenAI transcription
  ('openai', 'gpt-4o-transcribe',      'GPT-4o Transcribe',      ARRAY['transcription']),
  ('openai', 'gpt-4o-mini-transcribe', 'GPT-4o Mini Transcribe', ARRAY['transcription']),
  ('openai', 'whisper-1',              'Whisper 1',              ARRAY['transcription']),
  -- Gemini
  ('gemini', 'gemini-2.5-pro',         'Gemini 2.5 Pro',         ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('gemini', 'gemini-2.5-flash',       'Gemini 2.5 Flash',       ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('gemini', 'gemini-2.0-flash',       'Gemini 2.0 Flash',       ARRAY['text', 'structured_output', 'multimodal']),
  -- Claude
  ('claude', 'claude-sonnet-4-20250514',  'Claude Sonnet 4',    ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('claude', 'claude-3-5-sonnet-latest',  'Claude 3.5 Sonnet',  ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('claude', 'claude-3-5-haiku-latest',   'Claude 3.5 Haiku',   ARRAY['text', 'structured_output', 'multimodal'])
ON CONFLICT (provider, model) DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage ai_models"
  ON ai_models FOR ALL TO authenticated
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

CREATE POLICY "Service role can manage ai_models"
  ON ai_models FOR ALL TO service_role USING (true) WITH CHECK (true);
