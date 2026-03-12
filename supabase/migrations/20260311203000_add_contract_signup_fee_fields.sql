ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS taxa_adesao_tipo text DEFAULT 'nao_cobrar';

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS taxa_adesao_percentual numeric(10,2);

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS taxa_adesao_valor numeric(10,2);

COMMENT ON COLUMN contracts.taxa_adesao_tipo IS 'Define como a taxa de adesao do contrato e cobrada: nao_cobrar, percentual_mensalidade ou valor_fixo.';
COMMENT ON COLUMN contracts.taxa_adesao_percentual IS 'Percentual da mensalidade usado para calcular a taxa de adesao quando aplicavel.';
COMMENT ON COLUMN contracts.taxa_adesao_valor IS 'Valor fixo da taxa de adesao quando aplicavel.';
