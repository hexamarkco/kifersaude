-- Contract document extraction V2: private result cache and PII-free operational telemetry.

CREATE TABLE IF NOT EXISTS public.contract_document_extraction_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  parser_version text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  extraction jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  CONSTRAINT contract_document_extraction_cache_extraction_object
    CHECK (jsonb_typeof(extraction) = 'object'),
  CONSTRAINT contract_document_extraction_cache_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_contract_document_extraction_cache_expires_at
  ON public.contract_document_extraction_cache (expires_at);

ALTER TABLE public.contract_document_extraction_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contract_document_extraction_cache FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contract_document_extraction_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.contract_document_extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  document_family text NOT NULL,
  document_type text NOT NULL,
  document_roles text[] NOT NULL DEFAULT '{}',
  operator text,
  administrator text,
  support_status text NOT NULL,
  number_of_files integer NOT NULL,
  total_pages integer NOT NULL,
  candidate_pages_count integer NOT NULL,
  pages_sent_to_llm integer NOT NULL DEFAULT 0,
  text_extraction_success boolean NOT NULL,
  text_quality text NOT NULL,
  bundle_complete boolean,
  used_llm boolean NOT NULL DEFAULT false,
  used_vision boolean NOT NULL DEFAULT false,
  fallback_reason text,
  input_tokens integer,
  cached_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(18, 8),
  retry_count integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL,
  fields_resolved integer NOT NULL DEFAULT 0,
  fields_missing integer NOT NULL DEFAULT 0,
  fields_ambiguous integer NOT NULL DEFAULT 0,
  fields_conflicting integer NOT NULL DEFAULT 0,
  cache_hit boolean NOT NULL DEFAULT false,
  parser_version text NOT NULL,
  prompt_version text NOT NULL,
  provider text,
  model text,
  CONSTRAINT contract_document_extraction_runs_support_status
    CHECK (support_status IN ('SUPPORTED_PROFILE', 'GENERIC_FALLBACK', 'UNKNOWN')),
  CONSTRAINT contract_document_extraction_runs_text_quality
    CHECK (text_quality IN ('good', 'partial', 'poor', 'none')),
  CONSTRAINT contract_document_extraction_runs_provider
    CHECK (provider IS NULL OR provider = 'openai'),
  CONSTRAINT contract_document_extraction_runs_retry_count
    CHECK (retry_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_contract_document_extraction_runs_created_at
  ON public.contract_document_extraction_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_document_extraction_runs_family_created_at
  ON public.contract_document_extraction_runs (document_family, created_at DESC);

ALTER TABLE public.contract_document_extraction_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contract_document_extraction_runs FROM anon, authenticated;
GRANT INSERT, SELECT ON TABLE public.contract_document_extraction_runs TO service_role;

COMMENT ON TABLE public.contract_document_extraction_cache IS
  'Private service-role cache. Contains extracted contract data and must never be exposed through client policies.';
COMMENT ON TABLE public.contract_document_extraction_runs IS
  'PII-free telemetry for contract.document_extract V2.';
