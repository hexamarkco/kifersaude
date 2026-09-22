BEGIN;

-- Reuse the Inbox transaction and its locks, while authenticating the MCP actor.
CREATE OR REPLACE FUNCTION public.update_scheduled_message_sequence_for_mcp(
  p_actor_id uuid,
  p_sequence_id uuid,
  p_expected_updated_at timestamptz,
  p_scheduled_at timestamptz,
  p_steps jsonb,
  p_label text,
  p_cancel_on_inbound_message boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated_at timestamptz;
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_result boolean;
BEGIN
  PERFORM 1 FROM public.user_profiles
   WHERE id = p_actor_id AND role = 'admin'
     AND NULLIF(btrim(email), '') IS NOT NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MCP_ADMIN_REQUIRED';
  END IF;

  SELECT updated_at INTO v_updated_at
    FROM public.comm_whatsapp_scheduled_sequences
   WHERE id = p_sequence_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'SCHEDULE_NOT_FOUND';
  END IF;
  IF p_expected_updated_at IS NULL OR v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'SCHEDULE_VERSION_CONFLICT';
  END IF;

  -- auth.uid() uses this transaction-local claim. Restore it after delegation;
  -- PostgreSQL also rolls it back automatically if the delegated call raises.
  PERFORM set_config('request.jwt.claim.sub', p_actor_id::text, true);
  v_result := public.update_scheduled_message_sequence(
    p_sequence_id, p_scheduled_at, p_steps, p_label, p_cancel_on_inbound_message
  );
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_previous_sub, ''), true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_scheduled_message_sequence_for_mcp(uuid, uuid, timestamptz, timestamptz, jsonb, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_scheduled_message_sequence_for_mcp(uuid, uuid, timestamptz, timestamptz, jsonb, text, boolean)
  TO service_role;

COMMIT;
