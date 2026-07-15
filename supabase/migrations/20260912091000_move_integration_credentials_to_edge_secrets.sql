BEGIN;

-- Provider credentials belong exclusively in Supabase Edge Secrets, never in
-- client-readable integration settings.
UPDATE public.integration_settings
SET
  settings = COALESCE(settings, '{}'::jsonb) - 'apiKey' - 'token',
  updated_at = now()
WHERE slug IN (
  'gpt_transcription',
  'ai_provider_openai',
  'ai_provider_gemini',
  'ai_provider_claude',
  'whatsapp_auto_contact'
)
  AND (COALESCE(settings, '{}'::jsonb) ? 'apiKey' OR COALESCE(settings, '{}'::jsonb) ? 'token');

CREATE OR REPLACE FUNCTION public.reject_legacy_integration_credentials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IN (
    'gpt_transcription',
    'ai_provider_openai',
    'ai_provider_gemini',
    'ai_provider_claude',
    'whatsapp_auto_contact'
  )
  AND (COALESCE(NEW.settings, '{}'::jsonb) ? 'apiKey' OR COALESCE(NEW.settings, '{}'::jsonb) ? 'token') THEN
    RAISE EXCEPTION 'Use Supabase Edge Secrets for integration credentials.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_legacy_integration_credentials ON public.integration_settings;

CREATE TRIGGER trg_reject_legacy_integration_credentials
  BEFORE INSERT OR UPDATE OF slug, settings
  ON public.integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_legacy_integration_credentials();

-- The secret is no longer represented in SQL, so this RPC only reports
-- non-secret operational configuration. Secret status is exposed to admins by
-- comm-whatsapp-admin after authorization.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_operational_state()
RETURNS TABLE(
  id uuid,
  slug text,
  name text,
  enabled boolean,
  whapi_channel_id text,
  connection_status text,
  health_status text,
  phone_number text,
  connected_user_name text,
  last_health_check_at timestamptz,
  last_webhook_received_at timestamptz,
  last_error text,
  health_snapshot jsonb,
  limits_snapshot jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  config_enabled boolean,
  token_configured boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH config_state AS (
    SELECT
      lower(COALESCE(settings->>'enabled', 'false')) = 'true' AS config_enabled
    FROM public.integration_settings
    WHERE slug = 'whatsapp_auto_contact'
    LIMIT 1
  )
  SELECT
    c.id,
    c.slug,
    c.name,
    c.enabled,
    c.whapi_channel_id,
    c.connection_status,
    c.health_status,
    c.phone_number,
    c.connected_user_name,
    c.last_health_check_at,
    c.last_webhook_received_at,
    c.last_error,
    c.health_snapshot,
    c.limits_snapshot,
    c.created_at,
    c.updated_at,
    COALESCE(config_state.config_enabled, false) AS config_enabled,
    false AS token_configured
  FROM public.comm_whatsapp_channels c
  LEFT JOIN config_state ON true
  WHERE c.slug = 'primary'
    AND public.current_user_can_view_comm_whatsapp()
  LIMIT 1;
$$;

COMMIT;
