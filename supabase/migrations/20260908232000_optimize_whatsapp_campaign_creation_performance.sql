/*
  # Optimize WhatsApp campaign creation performance

  Reduces campaign creation timeouts by adding the indexes used by the
  WhatsApp audience resolver and CSV lead matching paths, and raises the
  function-local statement timeout for the heavier campaign RPCs.
*/

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_campaign_status_id
  ON public.leads (status_id)
  WHERE COALESCE(arquivado, false) = false;

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_campaign_origem_id
  ON public.leads (origem_id)
  WHERE COALESCE(arquivado, false) = false;

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_campaign_responsavel_id
  ON public.leads (responsavel_id)
  WHERE COALESCE(arquivado, false) = false;

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_campaign_canal
  ON public.leads (canal)
  WHERE COALESCE(arquivado, false) = false;

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_campaign_phone_rank
  ON public.leads (
    public.normalize_whatsapp_campaign_phone(telefone),
    COALESCE(updated_at, created_at, data_criacao) DESC,
    id DESC
  )
  WHERE COALESCE(arquivado, false) = false
    AND NULLIF(btrim(COALESCE(telefone, '')), '') IS NOT NULL;

ALTER FUNCTION public.resolve_whatsapp_campaign_filter_leads(jsonb)
  SET statement_timeout = '120s';

ALTER FUNCTION public.preview_whatsapp_campaign_audience(jsonb, integer)
  SET statement_timeout = '120s';

ALTER FUNCTION public.create_whatsapp_campaign_atomic(text, text, jsonb, text, jsonb, jsonb, timestamptz, jsonb)
  SET statement_timeout = '120s';
