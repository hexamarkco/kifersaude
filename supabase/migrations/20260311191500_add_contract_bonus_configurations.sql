ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS bonus_por_vida_configuracoes jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN contracts.bonus_por_vida_configuracoes IS 'Distribuicao de bonus por vida com quantidade de vidas e valor individual de cada faixa.';

UPDATE contracts
SET bonus_por_vida_configuracoes = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy',
    'quantidade', COALESCE(NULLIF(vidas_elegiveis_bonus, 0), NULLIF(vidas, 0), 1),
    'valor', bonus_por_vida_valor
  )
)
WHERE COALESCE(jsonb_array_length(bonus_por_vida_configuracoes), 0) = 0
  AND bonus_por_vida_aplicado = true
  AND COALESCE(bonus_por_vida_valor, 0) > 0;
