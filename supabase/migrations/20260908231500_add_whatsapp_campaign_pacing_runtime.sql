/*
  # Add WhatsApp campaign pacing runtime fields

  Stores lightweight runtime state for campaign-level pacing controls such as
  daily send limits and minimum interval between sends.
*/

ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS last_dispatch_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_day date,
  ADD COLUMN IF NOT EXISTS dispatches_today integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.whatsapp_campaigns.last_dispatch_at IS 'Timestamp do ultimo envio realizado pela campanha.';
COMMENT ON COLUMN public.whatsapp_campaigns.dispatch_day IS 'Dia local (America/Sao_Paulo) usado para controlar o limite diario da campanha.';
COMMENT ON COLUMN public.whatsapp_campaigns.dispatches_today IS 'Quantidade de envios ja realizados pela campanha no dia armazenado em dispatch_day.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_dispatch_day
  ON public.whatsapp_campaigns (dispatch_day, status);
