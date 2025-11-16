/*
  # Align GPT integration settings with OpenAI Responses API

  Ensures existing installations store only the API key and the
  selected text model, dropping legacy apiUrl/model fields.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'integration_settings'
  ) THEN
    UPDATE integration_settings
    SET settings = jsonb_build_object(
      'apiKey', COALESCE(settings->>'apiKey', ''),
      'textModel', COALESCE(
        NULLIF(settings->>'textModel', ''),
        NULLIF(settings->>'model', ''),
        'gpt-4o-mini'
      )
    )
    WHERE slug = 'gpt_transcription';
  END IF;
END $$;
