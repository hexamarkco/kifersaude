/*
  # AI Model Pricing

  Versioned pricing table for AI models.
  Each row represents a price period for a specific model.
  estimated_cost_usd on ai_call_attempts is calculated at call time
  and persisted, so future price changes don't affect historical data.
*/

CREATE TABLE IF NOT EXISTS ai_model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  input_per_million numeric(10,6) NOT NULL DEFAULT 0,
  cached_input_per_million numeric(10,6),
  output_per_million numeric(10,6) NOT NULL DEFAULT 0,
  is_transcription boolean DEFAULT false,
  transcription_per_minute numeric(10,6),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_pricing_lookup
  ON ai_model_pricing (model, active, effective_from DESC)
  WHERE active = true;

CREATE OR REPLACE FUNCTION set_ai_model_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_model_pricing_updated_at ON ai_model_pricing;
CREATE TRIGGER trg_ai_model_pricing_updated_at
  BEFORE UPDATE ON ai_model_pricing
  FOR EACH ROW
  EXECUTE FUNCTION set_ai_model_pricing_updated_at();

-- Seeds: current OpenAI / Anthropic / Google pricing
INSERT INTO ai_model_pricing (provider, model, input_per_million, cached_input_per_million, output_per_million) VALUES
  ('openai', 'gpt-5.5',         5.00,  0.50,  30.00),
  ('openai', 'gpt-4o',          2.50,  0.25,  10.00),
  ('openai', 'gpt-4o-mini',     0.15,  0.075,  0.60),
  ('gemini', 'gemini-2.0-flash', 0.10, 0.01,   0.40),
  ('claude', 'claude-3-5-sonnet-latest', 3.00, 0.30, 15.00);

INSERT INTO ai_model_pricing (provider, model, is_transcription, transcription_per_minute) VALUES
  ('openai', 'gpt-4o-transcribe',      true, 0.006),
  ('openai', 'gpt-4o-mini-transcribe',  true, 0.003);

-- RLS
ALTER TABLE ai_model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage ai_model_pricing"
  ON ai_model_pricing FOR ALL TO authenticated
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

CREATE POLICY "Service role can manage ai_model_pricing"
  ON ai_model_pricing FOR ALL TO service_role USING (true) WITH CHECK (true);
