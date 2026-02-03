/*
  # Fix contracts schema to match app fields

  ## Description
  Ensures the contracts table contains every column used by the frontend and
  aligns the mes_reajuste type with the UI (month as integer).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'data_renovacao'
  ) THEN
    ALTER TABLE contracts ADD COLUMN data_renovacao date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'mes_reajuste'
  ) THEN
    ALTER TABLE contracts ADD COLUMN mes_reajuste integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'comissao_multiplicador'
  ) THEN
    ALTER TABLE contracts ADD COLUMN comissao_multiplicador numeric(5,2) DEFAULT 2.8;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'comissao_recebimento_adiantado'
  ) THEN
    ALTER TABLE contracts ADD COLUMN comissao_recebimento_adiantado boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'comissao_parcelas'
  ) THEN
    ALTER TABLE contracts ADD COLUMN comissao_parcelas jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'previsao_recebimento_comissao'
  ) THEN
    ALTER TABLE contracts ADD COLUMN previsao_recebimento_comissao date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'previsao_pagamento_bonificacao'
  ) THEN
    ALTER TABLE contracts ADD COLUMN previsao_pagamento_bonificacao date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'vidas'
  ) THEN
    ALTER TABLE contracts ADD COLUMN vidas integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'vidas_elegiveis_bonus'
  ) THEN
    ALTER TABLE contracts ADD COLUMN vidas_elegiveis_bonus integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'bonus_por_vida_valor'
  ) THEN
    ALTER TABLE contracts ADD COLUMN bonus_por_vida_valor numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'bonus_por_vida_aplicado'
  ) THEN
    ALTER TABLE contracts ADD COLUMN bonus_por_vida_aplicado boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'cnpj'
  ) THEN
    ALTER TABLE contracts ADD COLUMN cnpj text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'razao_social'
  ) THEN
    ALTER TABLE contracts ADD COLUMN razao_social text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'nome_fantasia'
  ) THEN
    ALTER TABLE contracts ADD COLUMN nome_fantasia text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'endereco_empresa'
  ) THEN
    ALTER TABLE contracts ADD COLUMN endereco_empresa text;
  END IF;
END $$;

DO $$
DECLARE
  mes_type text;
BEGIN
  SELECT data_type INTO mes_type
  FROM information_schema.columns
  WHERE table_name = 'contracts' AND column_name = 'mes_reajuste';

  IF mes_type = 'date' THEN
    ALTER TABLE contracts
      ALTER COLUMN mes_reajuste TYPE integer
      USING EXTRACT(MONTH FROM mes_reajuste)::int;
  END IF;
END $$;
