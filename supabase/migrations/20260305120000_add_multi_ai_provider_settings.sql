/*
  # Multi-provider AI settings and routing

  Adds first-class provider records for OpenAI, Gemini and Claude, plus
  task routing so each AI feature can choose provider/model independently.
  Keeps backward compatibility by migrating values from gpt_transcription.
*/

DO $$
DECLARE
  legacy_settings jsonb := '{}'::jsonb;
  legacy_api_key text := '';
  legacy_text_model text := 'gpt-4o-mini';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM integration_settings
    WHERE slug = 'gpt_transcription'
  ) THEN
    SELECT COALESCE(settings, '{}'::jsonb)
      INTO legacy_settings
    FROM integration_settings
    WHERE slug = 'gpt_transcription'
    LIMIT 1;

    legacy_api_key := COALESCE(NULLIF(BTRIM(legacy_settings->>'apiKey'), ''), '');
    legacy_text_model := COALESCE(
      NULLIF(BTRIM(legacy_settings->>'textModel'), ''),
      NULLIF(BTRIM(legacy_settings->>'model'), ''),
      'gpt-4o-mini'
    );
  END IF;

  INSERT INTO integration_settings (slug, name, description, settings)
  VALUES (
    'ai_provider_openai',
    'IA - OpenAI',
    'Credenciais e modelos padrao para recursos de IA com OpenAI.',
    jsonb_build_object(
      'enabled', CASE WHEN legacy_api_key <> '' THEN true ELSE false END,
      'apiKey', legacy_api_key,
      'defaultModelText', legacy_text_model,
      'defaultModelTranscription', 'gpt-4o-mini-transcribe',
      'baseUrl', 'https://api.openai.com/v1'
    )
  )
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO integration_settings (slug, name, description, settings)
  VALUES (
    'ai_provider_gemini',
    'IA - Gemini',
    'Credenciais e modelos padrao para recursos de IA com Google Gemini.',
    jsonb_build_object(
      'enabled', false,
      'apiKey', '',
      'defaultModelText', 'gemini-2.0-flash',
      'defaultModelTranscription', 'gemini-2.0-flash'
    )
  )
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO integration_settings (slug, name, description, settings)
  VALUES (
    'ai_provider_claude',
    'IA - Claude',
    'Credenciais e modelos padrao para recursos de IA com Claude (Anthropic).',
    jsonb_build_object(
      'enabled', false,
      'apiKey', '',
      'defaultModelText', 'claude-3-5-sonnet-latest',
      'defaultModelTranscription', 'claude-3-5-sonnet-latest'
    )
  )
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO integration_settings (slug, name, description, settings)
  VALUES (
    'ai_routing',
    'IA - Roteamento de Funcionalidades',
    'Define qual provedor/modelo cada funcionalidade de IA deve usar.',
    jsonb_build_object(
      'fallbackEnabled', true,
      'fallbackProvider', 'openai',
      'tasks', jsonb_build_object(
        'rewrite_message', jsonb_build_object(
          'provider', 'openai',
          'model', legacy_text_model,
          'fallbackToOpenAi', true
        ),
        'follow_up_generation', jsonb_build_object(
          'provider', 'openai',
          'model', legacy_text_model,
          'fallbackToOpenAi', true
        ),
        'whatsapp_audio_transcription', jsonb_build_object(
          'provider', 'openai',
          'model', 'gpt-4o-mini-transcribe',
          'fallbackToOpenAi', true
        )
      )
    )
  )
  ON CONFLICT (slug) DO NOTHING;

  UPDATE integration_settings
  SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('apiKey', legacy_api_key)
  WHERE slug = 'ai_provider_openai'
    AND legacy_api_key <> ''
    AND COALESCE(NULLIF(BTRIM(COALESCE(settings->>'apiKey', '')), ''), '') = '';

  UPDATE integration_settings
  SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('defaultModelText', legacy_text_model)
  WHERE slug = 'ai_provider_openai'
    AND legacy_text_model <> ''
    AND COALESCE(NULLIF(BTRIM(COALESCE(settings->>'defaultModelText', '')), ''), '') = '';

  UPDATE integration_settings
  SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('enabled', true)
  WHERE slug = 'ai_provider_openai'
    AND legacy_api_key <> ''
    AND NOT (COALESCE(settings, '{}'::jsonb) ? 'enabled');

  UPDATE integration_settings
  SET settings = jsonb_build_object(
    'fallbackEnabled', true,
    'fallbackProvider', 'openai',
    'tasks', jsonb_build_object(
      'rewrite_message', jsonb_build_object(
        'provider', 'openai',
        'model', legacy_text_model,
        'fallbackToOpenAi', true
      ),
      'follow_up_generation', jsonb_build_object(
        'provider', 'openai',
        'model', legacy_text_model,
        'fallbackToOpenAi', true
      ),
      'whatsapp_audio_transcription', jsonb_build_object(
        'provider', 'openai',
        'model', 'gpt-4o-mini-transcribe',
        'fallbackToOpenAi', true
      )
    )
  )
  WHERE slug = 'ai_routing'
    AND (
      settings IS NULL
      OR jsonb_typeof(settings) <> 'object'
      OR NOT (settings ? 'tasks')
    );
END $$;
