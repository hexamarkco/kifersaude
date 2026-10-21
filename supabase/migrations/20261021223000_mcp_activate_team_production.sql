BEGIN;

CREATE OR REPLACE FUNCTION public.mcp_activate_team_production(p_actor_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_started_at timestamptz;
BEGIN
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.id = p_actor_user_id AND profile.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'MCP_ACTOR_NOT_ACTIVE_ADMIN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.production_settings AS settings
  SET started_at = COALESCE(settings.started_at, clock_timestamp())
  WHERE settings.singleton = true
  RETURNING settings.started_at INTO v_started_at;

  IF v_started_at IS NULL THEN
    RAISE EXCEPTION 'MCP_PRODUCTION_SETTINGS_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_started_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_activate_team_production(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_activate_team_production(uuid) TO service_role;

COMMENT ON FUNCTION public.mcp_activate_team_production(uuid) IS
  'Starts team production measurement once after revalidating the active CRM administrator; does not attribute historical events.';

COMMIT;
