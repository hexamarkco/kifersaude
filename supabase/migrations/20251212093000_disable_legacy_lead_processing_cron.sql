/*
  # Disable legacy lead processing cron job

  The default automation now runs through the leads-api auto-contact trigger.
  The scheduled process-pending-leads cron job is kept for backwards
  compatibility, but is disabled to avoid double-processing.
*/

-- Disable the legacy cron job if it exists
SELECT cron.unschedule('process-pending-leads-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-pending-leads-every-minute'
);

-- Optional: keep a note for operators
DO $$
BEGIN
  RAISE NOTICE 'Legacy cron job process-pending-leads-every-minute disabled. leads-api auto-contact trigger is the default.';
END $$;
