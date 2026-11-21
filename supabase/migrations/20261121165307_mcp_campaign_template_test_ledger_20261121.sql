-- Paridade de modelos de Disparos + envio de teste idempotente.
-- Nenhuma tabela existente é esvaziada ou excluída.
ALTER TABLE public.comm_whatsapp_campaign_templates
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_templates_unarchived
  ON public.comm_whatsapp_campaign_templates (created_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mcp_whatsapp_campaign_test_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  client_request_id text NOT NULL CHECK (length(client_request_id) BETWEEN 1 AND 128),
  campaign_id uuid NOT NULL REFERENCES public.comm_whatsapp_campaigns(id),
  phone_digest text NOT NULL CHECK (length(phone_digest) = 64),
  request_digest text NOT NULL CHECK (length(request_digest) = 64),
  variant_label text NOT NULL CHECK (variant_label ~ '^[A-Z]$'),
  step_index integer NOT NULL CHECK (step_index >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','confirmed','failed','ambiguous')),
  response_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (actor_id, client_request_id)
);
ALTER TABLE public.mcp_whatsapp_campaign_test_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_whatsapp_campaign_test_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.mcp_whatsapp_campaign_test_requests TO service_role;

CREATE INDEX IF NOT EXISTS idx_mcp_whatsapp_campaign_test_requests_actor_time
  ON public.mcp_whatsapp_campaign_test_requests (actor_id,created_at DESC);
