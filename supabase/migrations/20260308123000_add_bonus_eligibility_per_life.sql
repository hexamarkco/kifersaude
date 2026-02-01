-- Add bonus eligibility per life for holders and dependents, plus eligible lives count on contracts.

ALTER TABLE contract_holders
  ADD COLUMN IF NOT EXISTS bonus_por_vida_aplicado boolean DEFAULT true;

ALTER TABLE dependents
  ADD COLUMN IF NOT EXISTS bonus_por_vida_aplicado boolean DEFAULT true;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS vidas_elegiveis_bonus integer;

COMMENT ON COLUMN contract_holders.bonus_por_vida_aplicado IS 'Indica se esta vida (titular) é elegível ao bônus por vida.';
COMMENT ON COLUMN dependents.bonus_por_vida_aplicado IS 'Indica se esta vida (dependente) é elegível ao bônus por vida.';
COMMENT ON COLUMN contracts.vidas_elegiveis_bonus IS 'Quantidade de vidas elegíveis para bônus por vida (titulares + dependentes).';
