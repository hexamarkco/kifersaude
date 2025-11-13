/*
  # Dedicated tables for configuration options

  ## Description
  Creates dedicated tables for configuration domains that were previously stored
  in the shared system_configurations table. Each table mirrors the behaviour of
  existing dedicated tables such as lead_status_config and lead_origens.
  Existing configuration values are migrated into the new tables and RLS
  policies are applied to keep admin-only write access.
*/

-- Ensure helper function exists to update updated_at columns
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Utility to coalesce blank values during migration
CREATE OR REPLACE FUNCTION normalize_config_value(text, text)
RETURNS text AS $$
  SELECT CASE WHEN length(trim($1)) > 0 THEN $1 ELSE $2 END;
$$ LANGUAGE sql IMMUTABLE;

-- Lead contract type options
CREATE TABLE IF NOT EXISTS lead_tipos_contratacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_lead_tipos_contratacao_ordem ON lead_tipos_contratacao(ordem);
CREATE INDEX IF NOT EXISTS idx_lead_tipos_contratacao_ativo ON lead_tipos_contratacao(ativo);

DROP TRIGGER IF EXISTS trg_lead_tipos_contratacao_updated_at ON lead_tipos_contratacao;
CREATE TRIGGER trg_lead_tipos_contratacao_updated_at
  BEFORE UPDATE ON lead_tipos_contratacao
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE lead_tipos_contratacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can view lead tipos contratacao"
  ON lead_tipos_contratacao FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins manage lead tipos contratacao"
  ON lead_tipos_contratacao FOR ALL
  TO authenticated
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

-- Lead responsible options
CREATE TABLE IF NOT EXISTS lead_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_lead_responsaveis_ordem ON lead_responsaveis(ordem);
CREATE INDEX IF NOT EXISTS idx_lead_responsaveis_ativo ON lead_responsaveis(ativo);

DROP TRIGGER IF EXISTS trg_lead_responsaveis_updated_at ON lead_responsaveis;
CREATE TRIGGER trg_lead_responsaveis_updated_at
  BEFORE UPDATE ON lead_responsaveis
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE lead_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can view lead responsaveis"
  ON lead_responsaveis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins manage lead responsaveis"
  ON lead_responsaveis FOR ALL
  TO authenticated
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

-- Contract status options
CREATE TABLE IF NOT EXISTS contract_status_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_status_config_ordem ON contract_status_config(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_status_config_ativo ON contract_status_config(ativo);

DROP TRIGGER IF EXISTS trg_contract_status_config_updated_at ON contract_status_config;
CREATE TRIGGER trg_contract_status_config_updated_at
  BEFORE UPDATE ON contract_status_config
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_status_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can view contract status"
  ON contract_status_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins manage contract status"
  ON contract_status_config FOR ALL
  TO authenticated
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

-- Contract modality options
CREATE TABLE IF NOT EXISTS contract_modalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_modalidades_ordem ON contract_modalidades(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_modalidades_ativo ON contract_modalidades(ativo);

DROP TRIGGER IF EXISTS trg_contract_modalidades_updated_at ON contract_modalidades;
CREATE TRIGGER trg_contract_modalidades_updated_at
  BEFORE UPDATE ON contract_modalidades
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can view contract modalidades"
  ON contract_modalidades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins manage contract modalidades"
  ON contract_modalidades FOR ALL
  TO authenticated
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

-- Contract coverage options
CREATE TABLE IF NOT EXISTS contract_abrangencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_abrangencias_ordem ON contract_abrangencias(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_abrangencias_ativo ON contract_abrangencias(ativo);

DROP TRIGGER IF EXISTS trg_contract_abrangencias_updated_at ON contract_abrangencias;
CREATE TRIGGER trg_contract_abrangencias_updated_at
  BEFORE UPDATE ON contract_abrangencias
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_abrangencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can view contract abrangencias"
  ON contract_abrangencias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins manage contract abrangencias"
  ON contract_abrangencias FOR ALL
  TO authenticated
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

-- Contract accommodation options
CREATE TABLE IF NOT EXISTS contract_acomodacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_acomodacoes_ordem ON contract_acomodacoes(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_acomodacoes_ativo ON contract_acomodacoes(ativo);

DROP TRIGGER IF EXISTS trg_contract_acomodacoes_updated_at ON contract_acomodacoes;
CREATE TRIGGER trg_contract_acomodacoes_updated_at
  BEFORE UPDATE ON contract_acomodacoes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_acomodacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can view contract acomodacoes"
  ON contract_acomodacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins manage contract acomodacoes"
  ON contract_acomodacoes FOR ALL
  TO authenticated
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

-- Contract grace period options
CREATE TABLE IF NOT EXISTS contract_carencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_carencias_ordem ON contract_carencias(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_carencias_ativo ON contract_carencias(ativo);

DROP TRIGGER IF EXISTS trg_contract_carencias_updated_at ON contract_carencias;
CREATE TRIGGER trg_contract_carencias_updated_at
  BEFORE UPDATE ON contract_carencias
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_carencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated can view contract carencias"
  ON contract_carencias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins manage contract carencias"
  ON contract_carencias FOR ALL
  TO authenticated
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

-- Data migration from legacy system_configurations entries
INSERT INTO lead_tipos_contratacao (id, label, value, description, ordem, ativo, metadata, created_at, updated_at)
SELECT id, label, normalize_config_value(value, label), description, ordem, ativo, metadata, created_at, updated_at
FROM system_configurations
WHERE category = 'lead_tipo_contratacao'
ON CONFLICT (id) DO NOTHING;

INSERT INTO lead_responsaveis (id, label, value, description, ordem, ativo, metadata, created_at, updated_at)
SELECT id, label, normalize_config_value(value, label), description, ordem, ativo, metadata, created_at, updated_at
FROM system_configurations
WHERE category = 'lead_responsavel'
ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_status_config (id, label, value, description, ordem, ativo, metadata, created_at, updated_at)
SELECT id, label, normalize_config_value(value, label), description, ordem, ativo, metadata, created_at, updated_at
FROM system_configurations
WHERE category = 'contract_status'
ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_modalidades (id, label, value, description, ordem, ativo, metadata, created_at, updated_at)
SELECT id, label, normalize_config_value(value, label), description, ordem, ativo, metadata, created_at, updated_at
FROM system_configurations
WHERE category = 'contract_modalidade'
ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_abrangencias (id, label, value, description, ordem, ativo, metadata, created_at, updated_at)
SELECT id, label, normalize_config_value(value, label), description, ordem, ativo, metadata, created_at, updated_at
FROM system_configurations
WHERE category = 'contract_abrangencia'
ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_acomodacoes (id, label, value, description, ordem, ativo, metadata, created_at, updated_at)
SELECT id, label, normalize_config_value(value, label), description, ordem, ativo, metadata, created_at, updated_at
FROM system_configurations
WHERE category = 'contract_acomodacao'
ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_carencias (id, label, value, description, ordem, ativo, metadata, created_at, updated_at)
SELECT id, label, normalize_config_value(value, label), description, ordem, ativo, metadata, created_at, updated_at
FROM system_configurations
WHERE category = 'contract_carencia'
ON CONFLICT (id) DO NOTHING;

-- Remove migrated rows from legacy table to avoid duplicates
DELETE FROM system_configurations
WHERE category IN (
  'lead_tipo_contratacao',
  'lead_responsavel',
  'contract_status',
  'contract_modalidade',
  'contract_abrangencia',
  'contract_acomodacao',
  'contract_carencia'
);

-- Cleanup helper function created for migration use only
DROP FUNCTION IF EXISTS normalize_config_value(text, text);
