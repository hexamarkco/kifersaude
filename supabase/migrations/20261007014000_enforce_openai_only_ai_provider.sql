/*
  # Enforce OpenAI as the only active AI provider

  Historical call telemetry is intentionally preserved. Runtime configuration,
  provider integrations, model catalog entries and pricing are restricted to
  OpenAI from this migration forward.
*/

-- Foreign provider overrides cannot be reused with OpenAI model identifiers.
UPDATE ai_feature_configs
SET
  provider = 'openai',
  model = NULL,
  model_override_enabled = false,
  fallback_model = NULL
WHERE provider IS NOT NULL
  AND provider <> 'openai';

UPDATE ai_feature_configs
SET fallback_model = NULL
WHERE fallback_model IS NOT NULL;

-- Intent classification does not benefit from sales-persona or WhatsApp-style
-- layers; excluding them avoids repeated fixed context without changing the
-- classification contract.
UPDATE ai_feature_configs AS config
SET
  use_global_instructions = false,
  use_global_style = false
FROM ai_features AS feature
WHERE config.feature_id = feature.id
  AND feature.key = 'campaign.intent';

-- Normalize every live route. Preserve valid OpenAI models; routes from an old
-- provider return to the safe OpenAI default for their task type.
DO $$
DECLARE
  current_settings jsonb;
  current_tasks jsonb;
  normalized_tasks jsonb := '{}'::jsonb;
  route_key text;
  route_value jsonb;
  normalized_model text;
BEGIN
  SELECT COALESCE(settings, '{}'::jsonb)
  INTO current_settings
  FROM integration_settings
  WHERE slug = 'ai_routing'
  LIMIT 1;

  IF current_settings IS NOT NULL THEN
    current_tasks := COALESCE(current_settings -> 'tasks', '{}'::jsonb);

    FOR route_key, route_value IN
      SELECT key, value FROM jsonb_each(current_tasks)
    LOOP
      normalized_model := CASE
        WHEN COALESCE(route_value ->> 'provider', 'openai') = 'openai'
          AND NULLIF(BTRIM(route_value ->> 'model'), '') IS NOT NULL
          THEN BTRIM(route_value ->> 'model')
        WHEN route_key = 'whatsapp_audio_transcription'
          THEN 'gpt-4o-mini-transcribe'
        ELSE 'gpt-4o-mini'
      END;

      normalized_tasks := normalized_tasks || jsonb_build_object(
        route_key,
        (route_value - 'provider' - 'fallbackToOpenAi') || jsonb_build_object(
          'provider', 'openai',
          'model', normalized_model
        )
      );
    END LOOP;

    UPDATE integration_settings
    SET settings = (current_settings - 'fallbackProvider' - 'fallbackEnabled' - 'tasks')
      || jsonb_build_object(
        'tasks', normalized_tasks
      )
    WHERE slug = 'ai_routing';
  END IF;
END;
$$;

DELETE FROM integration_settings
WHERE slug IN ('ai_provider_gemini', 'ai_provider_claude');

DELETE FROM ai_models
WHERE provider <> 'openai';

DELETE FROM ai_model_pricing
WHERE provider <> 'openai';

ALTER TABLE ai_feature_configs
  ADD CONSTRAINT ai_feature_configs_provider_openai_only
  CHECK (provider IS NULL OR provider = 'openai');

ALTER TABLE ai_models
  ADD CONSTRAINT ai_models_provider_openai_only
  CHECK (provider = 'openai');

ALTER TABLE ai_model_pricing
  ADD CONSTRAINT ai_model_pricing_provider_openai_only
  CHECK (provider = 'openai');

COMMENT ON COLUMN ai_feature_configs.provider IS
  'OpenAI when a feature-level model override is enabled; NULL follows global OpenAI routing.';
