ALTER TABLE public.comm_whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS daily_send_limit integer;

ALTER TABLE public.comm_whatsapp_campaigns
  DROP CONSTRAINT IF EXISTS comm_whatsapp_campaigns_daily_send_limit_check;

ALTER TABLE public.comm_whatsapp_campaigns
  ADD CONSTRAINT comm_whatsapp_campaigns_daily_send_limit_check
  CHECK (daily_send_limit IS NULL OR daily_send_limit BETWEEN 1 AND 120);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_campaign_sent_at
  ON public.comm_whatsapp_campaign_targets (campaign_id, sent_at DESC)
  WHERE sent_at IS NOT NULL;
