-- Add configurable commission installments to contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contracts'
      AND column_name = 'comissao_parcelas'
  ) THEN
    ALTER TABLE public.contracts
      ADD COLUMN comissao_parcelas jsonb DEFAULT '[]'::jsonb;

    COMMENT ON COLUMN public.contracts.comissao_parcelas IS 'Parcelamento de comissão (percentual por parcela e data prevista)';
  END IF;
END $$;
