BEGIN;

UPDATE public.integration_settings
SET settings = jsonb_set(
  CASE
    WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)) = 'object' THEN COALESCE(settings, '{}'::jsonb)
    ELSE '{}'::jsonb
  END,
  '{tasks}',
  CASE
    WHEN jsonb_typeof(settings->'tasks') = 'object' THEN settings->'tasks' - 'whatsapp_assistant'
    ELSE '{}'::jsonb
  END,
  true
)
WHERE slug = 'ai_routing';

DROP FUNCTION IF EXISTS public.comm_whatsapp_search_leads_by_conversation_topic(text, text[], integer);
DROP FUNCTION IF EXISTS public.comm_whatsapp_search_leads_by_conversation_topic(text, text[], text[], text[], text, timestamptz, integer);
DROP FUNCTION IF EXISTS public.comm_whatsapp_search_cotador_quotes_by_topic(text, text[], integer);

COMMIT;
