-- Covers the lead_id foreign key on the 70k+ row campaign target table.
-- It avoids a full target-table scan when a lead is updated or deleted and
-- keeps lead-scoped campaign maintenance queries indexable.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_lead_id
  ON public.comm_whatsapp_campaign_targets (lead_id);
