BEGIN;

CREATE OR REPLACE FUNCTION public.mcp_mutate_ai_configuration(
  p_actor_user_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_feature public.ai_features;
  v_config public.ai_feature_configs;
  v_model public.ai_models;
  v_global public.ai_global_configs;
  v_feature_id uuid;
  v_config_id uuid;
  v_expected_version integer;
  v_latest_version integer;
  v_temperature double precision;
  v_max_tokens integer;
  v_reasoning_effort text;
  v_model_override boolean;
  v_model_name text;
  v_key text;
  v_value text;
  v_expected_updated_at timestamptz;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'MCP_INVALID_AI_CONFIGURATION' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'save_feature_config' THEN
    v_feature_id := NULLIF(p_payload->>'feature_id', '')::uuid;
    IF v_feature_id IS NULL OR jsonb_typeof(p_payload->'expected_latest_version') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_payload->'feature_prompt') IS DISTINCT FROM 'string'
       OR jsonb_typeof(p_payload->'output_instructions') IS DISTINCT FROM 'string'
       OR jsonb_typeof(p_payload->'temperature') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_payload->'max_output_tokens') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_payload->'model_override_enabled') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'MCP_INVALID_AI_CONFIGURATION' USING ERRCODE = '22023';
    END IF;
    IF (p_payload->>'expected_latest_version')::numeric < 0
       OR (p_payload->>'expected_latest_version')::numeric <> trunc((p_payload->>'expected_latest_version')::numeric) THEN
      RAISE EXCEPTION 'MCP_INVALID_AI_CONFIGURATION' USING ERRCODE = '22023';
    END IF;
    v_expected_version := (p_payload->>'expected_latest_version')::integer;
    v_temperature := (p_payload->>'temperature')::double precision;
    v_max_tokens := (p_payload->>'max_output_tokens')::integer;
    v_model_override := (p_payload->>'model_override_enabled')::boolean;
    v_reasoning_effort := NULLIF(p_payload->>'reasoning_effort', '');
    v_model_name := NULLIF(btrim(p_payload->>'model'), '');

    SELECT * INTO v_feature FROM public.ai_features AS feature
    WHERE feature.id = v_feature_id FOR UPDATE;
    IF NOT FOUND OR v_feature.enabled IS DISTINCT FROM true OR v_feature.key = 'sandbox.chat' THEN
      RAISE EXCEPTION 'MCP_AI_FEATURE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected_version < 0
       OR btrim(p_payload->>'feature_prompt') = ''
       OR char_length(p_payload->>'feature_prompt') > 100000
       OR char_length(p_payload->>'output_instructions') > 50000
       OR v_temperature NOT BETWEEN 0 AND 1
       OR v_max_tokens NOT BETWEEN 100 AND 8000
       OR v_max_tokens::text <> p_payload->>'max_output_tokens'
       OR (v_reasoning_effort IS NOT NULL AND v_reasoning_effort NOT IN ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max')) THEN
      RAISE EXCEPTION 'MCP_INVALID_AI_CONFIGURATION' USING ERRCODE = '22023';
    END IF;
    IF v_model_override THEN
      IF p_payload->>'provider' IS DISTINCT FROM 'openai' OR v_model_name IS NULL OR char_length(v_model_name) > 255 THEN
        RAISE EXCEPTION 'MCP_INVALID_AI_MODEL' USING ERRCODE = '22023';
      END IF;
      SELECT * INTO v_model FROM public.ai_models AS model
      WHERE model.provider = 'openai' AND model.model = v_model_name FOR SHARE;
      IF NOT FOUND OR v_model.active IS DISTINCT FROM true OR v_model.deprecated_at IS NOT NULL THEN
        RAISE EXCEPTION 'MCP_INVALID_AI_MODEL' USING ERRCODE = '22023';
      END IF;
      IF (v_feature.task_type = 'transcription' AND NOT (v_model.capabilities @> ARRAY['transcription']::text[]))
         OR (v_feature.task_type = 'structured_output' AND NOT (v_model.capabilities @> ARRAY['text', 'structured_output']::text[]))
         OR (v_feature.task_type = 'text' AND NOT (v_model.capabilities @> ARRAY['text']::text[]))
         OR (v_reasoning_effort IS NOT NULL AND v_reasoning_effort <> 'none' AND NOT (v_model.capabilities @> ARRAY['reasoning']::text[])) THEN
        RAISE EXCEPTION 'MCP_INVALID_AI_MODEL_CAPABILITY' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_model_name := NULL;
      v_reasoning_effort := NULLIF(v_reasoning_effort, '');
    END IF;

    SELECT COALESCE(MAX(config.version), 0) INTO v_latest_version
    FROM public.ai_feature_configs AS config WHERE config.feature_id = v_feature_id;
    IF v_latest_version <> v_expected_version THEN
      RAISE EXCEPTION 'MCP_AI_CONFIGURATION_CONFLICT' USING ERRCODE = '40001';
    END IF;

    UPDATE public.ai_feature_configs AS config
    SET is_active = false, deactivated_at = clock_timestamp()
    WHERE config.feature_id = v_feature_id AND config.is_active = true;

    INSERT INTO public.ai_feature_configs (
      feature_id, version, is_active, provider, model, model_override_enabled,
      reasoning_effort, temperature, max_output_tokens, feature_prompt,
      output_instructions, created_by, activated_at, deactivated_at
    ) VALUES (
      v_feature_id, v_latest_version + 1, true,
      CASE WHEN v_model_override THEN 'openai' ELSE NULL END,
      v_model_name, v_model_override, v_reasoning_effort,
      v_temperature, v_max_tokens, p_payload->>'feature_prompt',
      p_payload->>'output_instructions', p_actor_user_id::text, clock_timestamp(), NULL
    ) RETURNING * INTO v_config;

    INSERT INTO public.ai_config_versions(scope, scope_key, version, snapshot, created_by)
    VALUES ('feature', v_feature.key, v_config.version, to_jsonb(v_config), p_actor_user_id::text);
    RETURN jsonb_build_object('config', to_jsonb(v_config));
  ELSIF p_action = 'set_feature_config_active' THEN
    v_config_id := NULLIF(p_payload->>'config_id', '')::uuid;
    IF v_config_id IS NULL OR jsonb_typeof(p_payload->'active') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'MCP_INVALID_AI_CONFIGURATION' USING ERRCODE = '22023';
    END IF;
    SELECT feature.* INTO v_feature
    FROM public.ai_features AS feature
    JOIN public.ai_feature_configs AS config ON config.feature_id = feature.id
    WHERE config.id = v_config_id FOR UPDATE OF feature;
    IF NOT FOUND OR v_feature.enabled IS DISTINCT FROM true OR v_feature.key = 'sandbox.chat' THEN
      RAISE EXCEPTION 'MCP_AI_FEATURE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_config FROM public.ai_feature_configs AS config
    WHERE config.id = v_config_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MCP_AI_CONFIGURATION_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF (p_payload->>'active')::boolean THEN
      UPDATE public.ai_feature_configs AS config
      SET is_active = false, deactivated_at = clock_timestamp()
      WHERE config.feature_id = v_config.feature_id AND config.id <> v_config_id AND config.is_active = true;
      UPDATE public.ai_feature_configs AS config
      SET is_active = true, activated_at = clock_timestamp(), deactivated_at = NULL
      WHERE config.id = v_config_id
      RETURNING * INTO v_config;
    ELSE
      UPDATE public.ai_feature_configs AS config
      SET is_active = false, deactivated_at = clock_timestamp()
      WHERE config.id = v_config_id
      RETURNING * INTO v_config;
    END IF;
    INSERT INTO public.ai_config_versions(scope, scope_key, version, snapshot, created_by)
    VALUES ('feature', v_feature.key, v_config.version,
      jsonb_build_object('action', p_action, 'config', to_jsonb(v_config)), p_actor_user_id::text);
    RETURN jsonb_build_object('config', to_jsonb(v_config));
  ELSIF p_action = 'update_global_config' THEN
    v_key := p_payload->>'key';
    v_value := p_payload->>'value';
    IF v_key IS NULL OR v_key NOT IN ('global_instructions', 'global_style')
       OR jsonb_typeof(p_payload->'value') IS DISTINCT FROM 'string'
       OR char_length(v_value) > 100000 THEN
      RAISE EXCEPTION 'MCP_INVALID_AI_GLOBAL_CONFIGURATION' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mcp-ai-global:' || v_key));
    SELECT * INTO v_global FROM public.ai_global_configs AS config
    WHERE config.key = v_key FOR UPDATE;
    IF p_payload->'expected_updated_at' IS NULL OR p_payload->'expected_updated_at' = 'null'::jsonb THEN
      v_expected_updated_at := NULL;
    ELSE
      v_expected_updated_at := (p_payload->>'expected_updated_at')::timestamptz;
    END IF;
    IF (FOUND AND v_global.updated_at IS DISTINCT FROM v_expected_updated_at)
       OR (NOT FOUND AND v_expected_updated_at IS NOT NULL) THEN
      RAISE EXCEPTION 'MCP_AI_GLOBAL_CONFIGURATION_CONFLICT' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.ai_global_configs(key, value, updated_by, updated_at)
    VALUES (v_key, v_value, p_actor_user_id::text, clock_timestamp())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
    RETURNING * INTO v_global;
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_latest_version
    FROM public.ai_config_versions AS history
    WHERE history.scope = 'global' AND history.scope_key = v_key;
    INSERT INTO public.ai_config_versions(scope, scope_key, version, snapshot, created_by)
    VALUES ('global', v_key, v_latest_version, to_jsonb(v_global), p_actor_user_id::text);
    RETURN jsonb_build_object('config', to_jsonb(v_global));
  ELSE
    RAISE EXCEPTION 'MCP_AI_CONFIGURATION_ACTION_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_mutate_ai_configuration(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_mutate_ai_configuration(uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.mcp_mutate_ai_configuration(uuid, text, jsonb) IS
  'Atomically creates and activates versioned AI prompts, activates/deactivates a version, or updates allowlisted global prompts after revalidating the MCP administrator.';

COMMIT;
