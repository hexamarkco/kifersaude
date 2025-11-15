/*
  # Ensure commission receipt flag exists on contracts

  ## Description
  Adds the `comissao_recebimento_adiantado` column to the contracts table when
  it is missing and backfills existing records with a default value. This fixes
  PostgREST errors when saving contracts.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contracts'
      AND column_name = 'comissao_recebimento_adiantado'
  ) THEN
    ALTER TABLE contracts
      ADD COLUMN comissao_recebimento_adiantado boolean DEFAULT true;

    COMMENT ON COLUMN contracts.comissao_recebimento_adiantado IS
      'Indica se a comissão prevista será recebida de forma adiantada (pagamento único).';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contracts'
      AND column_name = 'comissao_recebimento_adiantado'
  ) THEN
    ALTER TABLE contracts
      ALTER COLUMN comissao_recebimento_adiantado SET DEFAULT true;
  END IF;

  UPDATE contracts
     SET comissao_recebimento_adiantado = true
   WHERE comissao_recebimento_adiantado IS NULL;
END $$;
