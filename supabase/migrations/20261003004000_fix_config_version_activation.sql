/*
  # Corrigir ativação de versão de configs IA

  Garante que ao criar uma nova config para um feature, a versão anterior
  seja desativada automaticamente (deactivated_at = now()). Sem isso,
  múltiplas versões podem ficar ativas simultaneamente.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.create_ai_feature_config(
  p_feature_key text,
  p_prompt text,
  p_config jsonb DEFAULT '{}'::jsonb,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_version integer;
  v_new_id uuid;
BEGIN
  -- Calcular próxima versão
  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.ai_feature_configs
    WHERE feature_key = p_feature_key;

  -- Desativar versões anteriores
  UPDATE public.ai_feature_configs
    SET deactivated_at = now()
    WHERE feature_key = p_feature_key
      AND deactivated_at IS NULL;

  -- Inserir nova versão ativa
  INSERT INTO public.ai_feature_configs (
    feature_key, version, prompt, config, created_by
  ) VALUES (
    p_feature_key, v_next_version, p_prompt, p_config, p_created_by
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ai_feature_config(text, text, jsonb, uuid) TO service_role;

COMMIT;
