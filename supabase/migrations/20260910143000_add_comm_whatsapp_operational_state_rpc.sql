BEGIN;

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
      CASE
        WHEN lower(COALESCE(settings->>'enabled', 'false')) = 'true' THEN true
        ELSE false
      END AS config_enabled,
      NULLIF(btrim(COALESCE(settings->>'token', settings->>'apiKey', '')), '') IS NOT NULL AS token_configured
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
    COALESCE(config_state.token_configured, false) AS token_configured
  FROM public.comm_whatsapp_channels c
  LEFT JOIN config_state ON true
  WHERE c.slug = 'primary'
    AND public.current_user_can_view_comm_whatsapp()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_operational_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_operational_state() TO authenticated;

COMMIT;
