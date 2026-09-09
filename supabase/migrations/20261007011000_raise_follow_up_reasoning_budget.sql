/*
  Aumenta o orçamento de saída de followup.generate.

  Modelos de raciocínio contabilizam os tokens internos dentro de
  max_output_tokens. O limite anterior de 520 interrompia a resposta antes
  de sobrar espaço para a mensagem visível. A mensagem continua curta pelas
  instruções de saída; este teto dá espaço para análise + texto final.
*/

BEGIN;

UPDATE public.ai_features
SET
  default_max_output_tokens = GREATEST(COALESCE(default_max_output_tokens, 0), 1600),
  updated_at = now()
WHERE key = 'followup.generate';

DO $migration$
DECLARE
  v_feature_id uuid;
  v_current public.ai_feature_configs%ROWTYPE;
  v_next_version integer;
BEGIN
  SELECT id
    INTO v_feature_id
    FROM public.ai_features
    WHERE key = 'followup.generate';

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Feature followup.generate não encontrada';
  END IF;

  SELECT *
    INTO v_current
    FROM public.ai_feature_configs
    WHERE feature_id = v_feature_id
      AND is_active = true
    ORDER BY version DESC
    LIMIT 1
    FOR UPDATE;

  IF v_current.id IS NULL OR COALESCE(v_current.max_output_tokens, 0) >= 1600 THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.ai_feature_configs
    WHERE feature_id = v_feature_id;

  UPDATE public.ai_feature_configs
  SET
    is_active = false,
    deactivated_at = now()
  WHERE feature_id = v_feature_id
    AND is_active = true;

  INSERT INTO public.ai_feature_configs (
    feature_id,
    version,
    is_active,
    provider,
    model,
    fallback_model,
    model_override_enabled,
    temperature,
    max_output_tokens,
    reasoning_effort,
    timeout_ms,
    retry_count,
    use_global_instructions,
    use_global_style,
    feature_prompt,
    output_instructions,
    context_config_json,
    created_by,
    activated_at
  ) VALUES (
    v_feature_id,
    v_next_version,
    true,
    v_current.provider,
    v_current.model,
    v_current.fallback_model,
    v_current.model_override_enabled,
    v_current.temperature,
    1600,
    v_current.reasoning_effort,
    v_current.timeout_ms,
    v_current.retry_count,
    v_current.use_global_instructions,
    v_current.use_global_style,
    v_current.feature_prompt,
    v_current.output_instructions,
    v_current.context_config_json,
    'migration:raise_follow_up_reasoning_budget',
    now()
  );
END;
$migration$;

COMMIT;
