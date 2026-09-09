-- Registra a IA de leitura de PDFs de contrato. Não altera contratos nem documentos existentes.
INSERT INTO public.ai_features (
  key,
  name,
  description,
  task_type,
  category,
  available_variables,
  default_feature_prompt,
  default_output_instructions,
  default_temperature,
  default_max_output_tokens
)
VALUES (
  'contract.document_extract',
  'Ler documentos de contrato',
  'Lê PDFs de proposta e contrato para sugerir o preenchimento do cadastro de contrato.',
  'structured_output',
  'contratos',
  '[
    {"key":"document_profiles","label":"Perfis de documento","description":"Perfil escolhido ou detectado para os PDFs enviados."},
    {"key":"requested_fields","label":"Campos solicitados","description":"Campos do cadastro de contrato que a IA deve tentar extrair."}
  ]'::jsonb,
  'Extraia dados de propostas e contratos de planos de saúde com precisão. Nunca invente ou complete valores ausentes.',
  'Retorne somente o JSON estruturado solicitado, sem markdown.',
  0,
  1800
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ai_feature_configs (
  feature_id,
  version,
  is_active,
  provider,
  model,
  model_override_enabled,
  temperature,
  max_output_tokens,
  reasoning_effort,
  use_global_instructions,
  use_global_style,
  feature_prompt,
  output_instructions,
  context_config_json
)
SELECT
  id,
  1,
  true,
  'openai',
  'gpt-4o-mini',
  true,
  0,
  1800,
  null,
  false,
  false,
  'Extraia dados de propostas e contratos de planos de saúde com precisão. Nunca invente ou complete valores ausentes.',
  'Retorne somente o JSON estruturado solicitado, sem markdown.',
  '{"documentProfiles":true,"requestedFields":true}'::jsonb
FROM public.ai_features
WHERE key = 'contract.document_extract'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_feature_configs
    WHERE feature_id = ai_features.id
  );
