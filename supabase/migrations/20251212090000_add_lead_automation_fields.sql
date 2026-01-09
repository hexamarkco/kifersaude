/*
  # Add lead automation configuration fields

  Adds per-lead scheduling controls used by the automation scheduler.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'blackout_dates'
  ) THEN
    ALTER TABLE leads ADD COLUMN blackout_dates DATE[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'daily_send_limit'
  ) THEN
    ALTER TABLE leads ADD COLUMN daily_send_limit INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN leads.blackout_dates IS 'Datas (AAAA-MM-DD) em que o lead não deve receber automações.';
COMMENT ON COLUMN leads.daily_send_limit IS 'Limite diário de mensagens automáticas específicas para este lead.';
