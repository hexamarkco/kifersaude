/*
  # Add next step scheduling to WhatsApp campaign targets

  Adds a due timestamp for the next flow step so the worker can respect
  per-step wait intervals without scanning the full queue in memory.
*/

DO $$
BEGIN
  IF to_regclass('public.whatsapp_campaign_targets') IS NULL THEN
    RAISE NOTICE 'public.whatsapp_campaign_targets not found, skipping next step due migration.';
    RETURN;
  END IF;

  ALTER TABLE public.whatsapp_campaign_targets
    ADD COLUMN IF NOT EXISTS next_step_due_at timestamptz;

  UPDATE public.whatsapp_campaign_targets
  SET next_step_due_at = NULL
  WHERE status IN ('sent', 'failed', 'invalid', 'cancelled');
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_targets_next_step_due
  ON public.whatsapp_campaign_targets (status, next_step_due_at, created_at)
  WHERE status IN ('pending', 'processing');
