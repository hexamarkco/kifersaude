/*
  # Add WhatsApp campaign worker execution logs

  Stores each campaign worker run so operators can verify cron health and
  diagnose processing failures without inspecting Edge Function logs.
*/

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_campaign_worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL DEFAULT 'process',
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  campaign_id uuid REFERENCES public.comm_whatsapp_campaigns(id) ON DELETE SET NULL,
  processed integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  stopped integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_campaign_worker_runs_action_check
    CHECK (action IN ('activate', 'process')),
  CONSTRAINT comm_whatsapp_campaign_worker_runs_source_check
    CHECK (source IN ('cron', 'manual', 'dashboard', 'api')),
  CONSTRAINT comm_whatsapp_campaign_worker_runs_status_check
    CHECK (status IN ('running', 'success', 'failed')),
  CONSTRAINT comm_whatsapp_campaign_worker_runs_counts_check
    CHECK (processed >= 0 AND sent >= 0 AND failed >= 0 AND stopped >= 0)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_worker_runs_started
  ON public.comm_whatsapp_campaign_worker_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_worker_runs_status_started
  ON public.comm_whatsapp_campaign_worker_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_worker_runs_campaign_started
  ON public.comm_whatsapp_campaign_worker_runs (campaign_id, started_at DESC);

ALTER TABLE public.comm_whatsapp_campaign_worker_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comm whatsapp campaign worker runs"
  ON public.comm_whatsapp_campaign_worker_runs FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

CREATE POLICY "Service role can manage comm whatsapp campaign worker runs"
  ON public.comm_whatsapp_campaign_worker_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
