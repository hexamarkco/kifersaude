BEGIN;

DO $$
DECLARE
  text_model text := 'gpt-4o-mini';
  default_route jsonb;
BEGIN
  SELECT COALESCE(NULLIF(BTRIM(settings->>'defaultModelText'), ''), 'gpt-4o-mini')
    INTO text_model
  FROM public.integration_settings
  WHERE slug = 'ai_provider_openai'
  LIMIT 1;

  text_model := COALESCE(NULLIF(BTRIM(text_model), ''), 'gpt-4o-mini');
  default_route := jsonb_build_object(
    'provider', 'openai',
    'model', text_model,
    'fallbackToOpenAi', true
  );

  INSERT INTO public.integration_settings (slug, name, description, settings)
  VALUES (
    'ai_routing',
    'IA - Roteamento de Funcionalidades',
    'Define qual provedor/modelo cada funcionalidade de IA deve usar.',
    jsonb_build_object(
      'fallbackEnabled', true,
      'fallbackProvider', 'openai',
      'tasks', jsonb_build_object(
        'whatsapp_assistant', default_route
      )
    )
  )
  ON CONFLICT (slug) DO NOTHING;

  UPDATE public.integration_settings
  SET settings = jsonb_set(
    CASE WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)) = 'object' THEN COALESCE(settings, '{}'::jsonb) ELSE '{}'::jsonb END,
    '{tasks,whatsapp_assistant}',
    COALESCE(
      CASE
        WHEN jsonb_typeof(settings #> '{tasks,whatsapp_assistant}') = 'object'
        THEN settings #> '{tasks,whatsapp_assistant}'
        ELSE NULL
      END,
      default_route
    ),
    true
  )
  WHERE slug = 'ai_routing';
END $$;

COMMIT;
