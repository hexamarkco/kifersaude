-- The campaign worker checks this queue on every tick. Once a persistence is
-- recovered, the row remains in the event log, so filtering the whole table
-- repeatedly becomes increasingly expensive even when there is no pending
-- work. Keep only unresolved persistence events in an index ordered by the
-- worker's oldest-first reconciliation query.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_events_pending_persistence
  ON public.comm_whatsapp_campaign_events (created_at ASC)
  WHERE event_type = 'target_provider_accepted_persistence_pending'
    AND payload->>'recovered_at' IS NULL;
