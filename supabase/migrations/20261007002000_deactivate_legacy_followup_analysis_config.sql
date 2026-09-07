/*
  Mantem followup.analysis apenas como historico:
  - a Feature continua desabilitada;
  - nenhuma versao de configuracao permanece ativa;
  - o conteudo das versoes anteriores nao e apagado.
*/

UPDATE public.ai_feature_configs
SET
  is_active = false,
  deactivated_at = COALESCE(deactivated_at, now())
WHERE feature_id = (
  SELECT id
  FROM public.ai_features
  WHERE key = 'followup.analysis'
)
AND is_active = true;

UPDATE public.ai_features
SET
  enabled = false,
  description = 'Feature legada de análise estruturada; não participa mais do pipeline normal de follow-up.',
  updated_at = now()
WHERE key = 'followup.analysis';
