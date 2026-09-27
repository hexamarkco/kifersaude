BEGIN;

-- Campaign target pages are ordered by creation time in the detail screen.
-- Large CSV campaigns otherwise scan and sort every target for each page.
-- The id tie-breaker also makes offset pagination deterministic when many
-- targets share the same created_at value.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_campaign_created_id
  ON public.comm_whatsapp_campaign_targets (campaign_id, created_at ASC, id ASC);

COMMIT;
