BEGIN;

-- A policy that allows SELECT on the channel table also exposes every column
-- unless the table privilege is narrowed explicitly. The webhook secret is
-- only needed by service-role Edge Functions; authenticated Inbox users need
-- the operational channel fields, never this credential.
REVOKE SELECT ON public.comm_whatsapp_channels FROM authenticated;

GRANT SELECT (
  id,
  slug,
  name,
  enabled,
  whapi_channel_id,
  connection_status,
  health_status,
  phone_number,
  connected_user_name,
  last_health_check_at,
  last_webhook_received_at,
  last_error,
  health_snapshot,
  limits_snapshot,
  created_at,
  updated_at
)
ON public.comm_whatsapp_channels
TO authenticated;

COMMIT;
