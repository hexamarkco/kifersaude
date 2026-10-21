BEGIN;

CREATE OR REPLACE FUNCTION public.mcp_set_whatsapp_integration_enabled(
  p_actor_user_id uuid,
  p_expected_channel_updated_at timestamptz,
  p_expected_settings_updated_at timestamptz,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_channel_id uuid;
  v_channel_updated_at timestamptz;
  v_settings_id uuid;
  v_settings jsonb;
  v_settings_updated_at timestamptz;
  v_updated_at timestamptz;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);

  IF p_expected_channel_updated_at IS NULL
     OR p_expected_settings_updated_at IS NULL
     OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'MCP_INVALID_WHATSAPP_INTEGRATION_INPUT'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mcp-whatsapp-integration-enabled', 0)
  );

  SELECT channel.id, channel.updated_at
  INTO v_channel_id, v_channel_updated_at
  FROM public.comm_whatsapp_channels AS channel
  WHERE channel.slug = 'primary'
  FOR UPDATE;

  SELECT settings.id, settings.settings, settings.updated_at
  INTO v_settings_id, v_settings, v_settings_updated_at
  FROM public.integration_settings AS settings
  WHERE settings.slug = 'whatsapp_auto_contact'
  FOR UPDATE;

  IF v_channel_id IS NULL OR v_settings_id IS NULL THEN
    RAISE EXCEPTION 'MCP_WHATSAPP_INTEGRATION_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_channel_updated_at IS DISTINCT FROM p_expected_channel_updated_at
     OR v_settings_updated_at IS DISTINCT FROM p_expected_settings_updated_at THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error_code', 'STALE_WRITE',
      'channel_updated_at', v_channel_updated_at,
      'settings_updated_at', v_settings_updated_at
    );
  END IF;

  v_updated_at := pg_catalog.transaction_timestamp();

  UPDATE public.integration_settings AS settings
  SET settings = pg_catalog.jsonb_set(
        COALESCE(v_settings, '{}'::jsonb),
        '{enabled}',
        pg_catalog.to_jsonb(p_enabled),
        true
      ),
      updated_at = v_updated_at
  WHERE settings.id = v_settings_id;

  UPDATE public.comm_whatsapp_channels AS channel
  SET enabled = p_enabled,
      updated_at = v_updated_at
  WHERE channel.id = v_channel_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'channel_updated_at', v_updated_at,
    'settings_updated_at', v_updated_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_set_whatsapp_integration_enabled(uuid, timestamptz, timestamptz, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_whatsapp_integration_enabled(uuid, timestamptz, timestamptz, boolean)
  TO service_role;

COMMIT;
