CREATE TABLE IF NOT EXISTS public.audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  total_leads integer DEFAULT 0,
  summary jsonb DEFAULT '{}'::jsonb,
  created_by text DEFAULT 'dry_run_audit',
  notes text
);

CREATE TABLE IF NOT EXISTS public.audit_run_targets (
  run_id uuid NOT NULL REFERENCES public.audit_runs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  processed_at timestamptz,
  PRIMARY KEY (run_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_run_targets_run_pending
  ON public.audit_run_targets (run_id, ordinal)
  WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.audit_runs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_nome text,
  lead_telefone text,
  classification text NOT NULL,
  confidence numeric(3,2) DEFAULT 0.50,
  reason_code text NOT NULL,
  reason_text text,
  has_conversation boolean DEFAULT false,
  message_count integer DEFAULT 0,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_direction text,
  furthest_stage text,
  do_not_reactivate boolean DEFAULT false,
  evidence_snippet text,
  chat_resolution_method text DEFAULT 'none',
  created_at timestamptz DEFAULT now(),
  UNIQUE (run_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_results_run_id ON public.audit_results (run_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_classification ON public.audit_results (classification);
CREATE INDEX IF NOT EXISTS idx_audit_results_reason_code ON public.audit_results (reason_code);
CREATE INDEX IF NOT EXISTS idx_audit_results_lead_id ON public.audit_results (lead_id);
