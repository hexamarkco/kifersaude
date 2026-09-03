/*
  # AI Feature Configuration Tables

  ## Description
  Creates the centralized AI configuration system:
  - ai_features: registry of all AI features in the system
  - ai_feature_configs: versioned configuration per feature (model, prompts, params)
  - ai_global_configs: shared global prompts (Closer PRO instructions, style rules)
  - ai_config_versions: immutable snapshots for history/rollback

  This replaces hardcoded prompts and parameters with a database-driven
  configuration system editable via the admin panel.
*/

-- ============================================================
-- 1. AI FEATURES — registry of all AI capabilities
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  task_type text NOT NULL CHECK (task_type IN ('text', 'structured_output', 'transcription')),
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_features_key ON ai_features(key);

CREATE OR REPLACE FUNCTION set_ai_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_features_updated_at ON ai_features;
CREATE TRIGGER trg_ai_features_updated_at
  BEFORE UPDATE ON ai_features
  FOR EACH ROW
  EXECUTE FUNCTION set_ai_features_updated_at();

-- ============================================================
-- 2. AI FEATURE CONFIGS — versioned config per feature
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_feature_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES ai_features(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  is_active boolean DEFAULT false,

  -- Provider / model
  provider text,
  model text,
  fallback_model text,

  -- Generation parameters
  temperature float,
  max_output_tokens int,
  reasoning_effort text CHECK (reasoning_effort IN ('none', 'minimal') OR reasoning_effort IS NULL),
  timeout_ms int,
  retry_count int,

  -- Prompt composition
  use_global_instructions boolean DEFAULT true,
  use_global_style boolean DEFAULT true,
  feature_prompt text DEFAULT '',
  output_instructions text DEFAULT '',

  -- Context configuration (which blocks to include)
  context_config_json jsonb DEFAULT '{}'::jsonb,

  -- Metadata
  created_by text,
  created_at timestamptz DEFAULT now(),

  UNIQUE(feature_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_feature_configs_feature_id ON ai_feature_configs(feature_id);
CREATE INDEX IF NOT EXISTS idx_ai_feature_configs_active ON ai_feature_configs(feature_id, is_active) WHERE is_active = true;

-- ============================================================
-- 3. AI GLOBAL CONFIGS — shared prompts (Closer PRO, style)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_global_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  version int NOT NULL DEFAULT 1,
  is_active boolean DEFAULT false,
  content text DEFAULT '',
  created_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(key, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_global_configs_key ON ai_global_configs(key);
CREATE INDEX IF NOT EXISTS idx_ai_global_configs_active ON ai_global_configs(key, is_active) WHERE is_active = true;

-- ============================================================
-- 4. AI CONFIG VERSIONS — immutable snapshots for history
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'feature')),
  scope_key text NOT NULL,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_config_versions_scope ON ai_config_versions(scope, scope_key);

-- ============================================================
-- 5. RLS — admin only
-- ============================================================

ALTER TABLE ai_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feature_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_global_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage ai_features"
  ON ai_features FOR ALL TO authenticated
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

CREATE POLICY "Only admins can manage ai_feature_configs"
  ON ai_feature_configs FOR ALL TO authenticated
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

CREATE POLICY "Only admins can manage ai_config_versions"
  ON ai_config_versions FOR ALL TO authenticated
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

-- Service role bypass for Edge Functions
CREATE POLICY "Service role can manage ai_features"
  ON ai_features FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage ai_feature_configs"
  ON ai_feature_configs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage ai_global_configs"
  ON ai_global_configs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage ai_config_versions"
  ON ai_config_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
