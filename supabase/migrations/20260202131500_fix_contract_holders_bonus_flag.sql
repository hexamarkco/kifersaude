/*
  # Fix contract_holders bonus flag
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_holders' AND column_name = 'bonus_por_vida_aplicado'
  ) THEN
    ALTER TABLE contract_holders ADD COLUMN bonus_por_vida_aplicado boolean DEFAULT false;
  END IF;
END $$;
