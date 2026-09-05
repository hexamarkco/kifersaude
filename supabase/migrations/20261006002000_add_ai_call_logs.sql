/*
  # AI Call Logs + Attempts

  Two-table telemetry for every AI API call:
  - ai_call_logs: one row per logical feature execution (summary)
  - ai_call_attempts: one row per physical provider call (detail)

  cost_usd is calculated and persisted at call time using ai_model_pricing,
  so future price changes don't alter historical records.
*/

-- ============================================================
-- 1. AI CALL LOGS — one row per feature execution
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Identification
  feature_key text NOT NULL,
  ai_task text NOT NULL,
  edge_function text,

  -- Final result summary
  success boolean NOT NULL DEFAULT false,
  final_provider text,
  final_model text,
  fallback_used boolean NOT NULL DEFAULT false,
  attempts_count smallint NOT NULL DEFAULT 0,

  -- Aggregate cost (sum of all attempts)
  total_input_tokens int,
  total_cached_tokens int,
  total_output_tokens int,
  total_reasoning_tokens int,
  total_tokens int,
  total_duration_ms int,
  total_estimated_cost_usd numeric(12,8),

  -- Context (optional)
  lead_id uuid,
  chat_id uuid,
  message_id uuid
);

CREATE INDEX IF NOT EXISTS idx_ai_call_logs_created_at ON ai_call_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_feature ON ai_call_logs (feature_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_model ON ai_call_logs (final_model, created_at DESC);

-- ============================================================
-- 2. AI CALL ATTEMPTS — one row per physical provider call
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES ai_call_logs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  attempt_number smallint NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  resolution_source text NOT NULL
    CHECK (resolution_source IN ('feature', 'ai_routing', 'provider_default', 'fallback')),

  -- Tokens (from provider response usage)
  input_tokens int,
  cached_input_tokens int,
  output_tokens int,
  reasoning_tokens int,
  total_tokens int,

  -- Cost
  estimated_cost_usd numeric(12,8),

  -- Performance
  duration_ms int,

  -- Status
  success boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_ai_call_attempts_call_id ON ai_call_attempts (call_id);
CREATE INDEX IF NOT EXISTS idx_ai_call_attempts_model ON ai_call_attempts (model, created_at DESC);

-- ============================================================
-- 3. Add model_override_enabled to ai_feature_configs
-- ============================================================

ALTER TABLE ai_feature_configs
  ADD COLUMN IF NOT EXISTS model_override_enabled boolean DEFAULT false;

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE ai_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read ai_call_logs"
  ON ai_call_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can read ai_call_attempts"
  ON ai_call_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage ai_call_logs"
  ON ai_call_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage ai_call_attempts"
  ON ai_call_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
