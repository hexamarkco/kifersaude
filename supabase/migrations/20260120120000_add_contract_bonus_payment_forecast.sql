-- Adds previsao_pagamento_bonificacao column to contracts to track expected bonus payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contracts'
      AND column_name = 'previsao_pagamento_bonificacao'
  ) THEN
    ALTER TABLE contracts ADD COLUMN previsao_pagamento_bonificacao date;
  END IF;
END $$;
