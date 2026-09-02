BEGIN;

-- Migration V3: expande audit log e reminders com campos de análise/estratégia.
-- Compatível com dados V2 existentes (todas as colunas são aditivas).

ALTER TABLE public.comm_follow_up_audit_log
  ADD COLUMN IF NOT EXISTS v3_analysis jsonb,
  ADD COLUMN IF NOT EXISTS v3_strategy jsonb,
  ADD COLUMN IF NOT EXISTS v3_validation jsonb,
  ADD COLUMN IF NOT EXISTS v3_regeneration_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS v3_analysis_model text,
  ADD COLUMN IF NOT EXISTS v3_copy_model text,
  ADD COLUMN IF NOT EXISTS v3_feedback text,
  ADD COLUMN IF NOT EXISTS v3_feedback_at timestamptz;

-- Índice para queries de analytics futuras
CREATE INDEX IF NOT EXISTS idx_follow_up_audit_v3_analysis
  ON public.comm_follow_up_audit_log USING gin (v3_analysis)
  WHERE v3_analysis IS NOT NULL;

COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_analysis IS 'CommercialAnalysis estruturada da V3';
COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_strategy IS 'FollowUpStrategy estruturada da V3';
COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_validation IS 'Validation result do V3';
COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_regeneration_count IS 'Quantas vezes o validador rejeitou e regenerou';
COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_analysis_model IS 'Modelo usado na chamada de análise';
COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_copy_model IS 'Modelo usado na chamada de redação';
COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_feedback IS 'Feedback do operador (ex: rejected, edited, approved)';
COMMENT ON COLUMN public.comm_follow_up_audit_log.v3_feedback_at IS 'Timestamp do feedback';

COMMIT;
