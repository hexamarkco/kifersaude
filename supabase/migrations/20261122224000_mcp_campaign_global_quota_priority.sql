-- Exposure for the global 20-message campaign quota and weighted priorities via MCP.
-- No campaigns are activated or modified by this migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_campaign_mutation(p_actor_user_id uuid, p_operation text, p_campaign_id uuid DEFAULT NULL::uuid, p_target_id uuid DEFAULT NULL::uuid, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_client_request_id text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'auth'
AS $function$
DECLARE
  v_gate jsonb;
  v_result jsonb;
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_target public.comm_whatsapp_campaign_targets%ROWTYPE;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_config jsonb;
  v_steps jsonb;
  v_name text;
  v_message text;
  v_first_message text;
  v_status text;
  v_scheduled_at timestamptz;
  v_weekdays smallint[];
  v_pacing integer;
  v_daily_limit integer;
  v_priority integer;
  v_stop_on_reply boolean;
  v_validate_numbers boolean;
  v_index integer;
  v_item jsonb;
  v_raw_phone text;
  v_digits text;
  v_display_name text;
  v_custom_fields jsonb;
  v_seen text[] := ARRAY[]::text[];
  v_outcomes jsonb := '[]'::jsonb;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_invalid integer := 0;
  v_blocked integer := 0;
  v_failed integer := 0;
  v_outcome text;
  v_metrics jsonb;
BEGIN
  PERFORM public._mcp_comm_whatsapp_campaign_assert_admin(p_actor_user_id);
  IF p_operation IS NULL OR p_operation NOT IN (
    'create', 'update', 'import_contacts', 'remove_contact', 'activate',
    'pause', 'resume', 'schedule', 'delete'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_OPERATION_INVALID';
  END IF;
  IF jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PAYLOAD_INVALID';
  END IF;

  v_gate := public._mcp_comm_whatsapp_campaign_begin(
    p_actor_user_id, p_client_request_id, p_operation, p_campaign_id, p_target_id,
    jsonb_build_object(
      'operation', p_operation, 'campaign_id', p_campaign_id, 'target_id', p_target_id,
      'expected_updated_at', p_expected_updated_at, 'payload', v_payload
    )
  );
  IF (v_gate ->> 'replayed')::boolean THEN
    RETURN (v_gate -> 'result') || jsonb_build_object('replayed', true);
  END IF;

  IF p_operation = 'create' THEN
    v_name := btrim(COALESCE(v_payload->>'name', ''));
    IF v_name = '' OR char_length(v_name) > 160 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_NAME_REQUIRED';
    END IF;
    v_message := btrim(COALESCE(v_payload->>'message', v_payload->>'message_text', ''));
    v_steps := CASE WHEN v_payload ? 'steps' THEN v_payload->'steps' ELSE NULL END;
    IF v_steps IS NOT NULL AND jsonb_typeof(v_steps) <> 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_STEPS_INVALID';
    END IF;
    IF v_message = '' AND (v_steps IS NULL OR jsonb_array_length(v_steps) = 0) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MESSAGE_REQUIRED';
    END IF;
    v_status := COALESCE(NULLIF(v_payload->>'status', ''), 'draft');
    IF v_status NOT IN ('draft', 'paused') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_CREATE_STATUS_INVALID';
    END IF;
    v_pacing := COALESCE(NULLIF(v_payload->>'pacing_per_minute', '')::integer, 12);
    IF v_pacing NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PACING_INVALID';
    END IF;
    v_daily_limit := NULLIF(v_payload->>'daily_send_limit', '')::integer;
    IF v_daily_limit IS NOT NULL AND v_daily_limit < 1 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_DAILY_LIMIT_INVALID';
    END IF;
    v_priority := COALESCE(NULLIF(v_payload->>'dispatch_priority', '')::integer, 1);
    IF v_priority NOT BETWEEN 1 AND 3 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PRIORITY_INVALID';
    END IF;
    v_stop_on_reply := COALESCE((v_payload->>'stop_on_reply')::boolean, true);
    v_validate_numbers := COALESCE((v_payload->>'validate_whatsapp_numbers')::boolean, false);
    IF v_payload ? 'allowed_weekdays' THEN
      IF jsonb_typeof(v_payload->'allowed_weekdays') <> 'array' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_WEEKDAYS_INVALID';
      END IF;
      SELECT array_agg(value::smallint ORDER BY ordinality)
        INTO v_weekdays
      FROM jsonb_array_elements_text(v_payload->'allowed_weekdays') WITH ORDINALITY AS item(value, ordinality);
    ELSE
      v_weekdays := ARRAY[0,1,2,3,4,5,6]::smallint[];
    END IF;
    IF v_weekdays IS NULL OR cardinality(v_weekdays) = 0 OR NOT (v_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_WEEKDAYS_INVALID';
    END IF;
    v_scheduled_at := NULLIF(v_payload->>'scheduled_at', '')::timestamptz;
    v_config := CASE
      WHEN jsonb_typeof(v_payload->'audience_config') = 'object' THEN v_payload->'audience_config'
      ELSE '{}'::jsonb
    END;
    v_config := jsonb_set(v_config, '{exclude_opt_out}', 'true'::jsonb, true);
    v_config := jsonb_set(v_config, '{source}', '"mcp"'::jsonb, true);

    INSERT INTO public.comm_whatsapp_campaigns (
      name, objective, status, audience_source, audience_config, message_text,
      scheduled_at, pacing_per_minute, daily_send_limit, dispatch_priority, send_window_start,
      send_window_end, active_weekdays, stop_on_reply, create_leads_from_csv,
      validate_whatsapp_numbers, created_by
    ) VALUES (
      v_name, NULLIF(btrim(v_payload->>'objective'), ''), v_status, 'csv', v_config,
      v_message, v_scheduled_at, v_pacing, v_daily_limit, v_priority,
      NULLIF(v_payload->>'start_hour', '')::time,
      NULLIF(v_payload->>'end_hour', '')::time,
      v_weekdays, v_stop_on_reply, false, v_validate_numbers, p_actor_user_id
    ) RETURNING * INTO v_campaign;

    v_first_message := public._mcp_comm_whatsapp_campaign_replace_steps(v_campaign.id, v_steps, v_message);
    UPDATE public.comm_whatsapp_campaigns
    SET message_text = v_first_message, updated_at = now()
    WHERE id = v_campaign.id
    RETURNING * INTO v_campaign;

    v_result := jsonb_build_object(
      'success', true, 'campaign_id', v_campaign.id, 'status', v_campaign.status,
      'created', true, 'replayed', false,
      'campaign', to_jsonb(v_campaign)
    );
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
    RETURN v_result;
  END IF;

  SELECT * INTO v_campaign
  FROM public.comm_whatsapp_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CAMPAIGN_NOT_FOUND';
  END IF;

  IF p_operation = 'import_contacts' THEN
    IF v_campaign.status NOT IN ('draft', 'scheduled', 'paused') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_CONTACT_IMPORT_NOT_ALLOWED';
    END IF;
    IF jsonb_typeof(v_payload->'contacts') <> 'array' OR jsonb_array_length(v_payload->'contacts') > 500 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_CONTACT_BATCH_INVALID';
    END IF;
    v_index := 0;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload->'contacts') LOOP
      v_index := v_index + 1;
      IF jsonb_typeof(v_item) <> 'object' THEN
        v_failed := v_failed + 1;
        v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object('row', v_index, 'outcome', 'failed'));
        CONTINUE;
      END IF;
      v_raw_phone := btrim(COALESCE(v_item->>'phone', v_item->>'phone_number', ''));
      v_digits := public._mcp_comm_whatsapp_campaign_normalize_phone(v_raw_phone);
      IF v_digits = '' THEN
        v_invalid := v_invalid + 1;
        v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object('row', v_index, 'outcome', 'invalid_phone'));
        CONTINUE;
      END IF;
      IF v_digits = ANY(v_seen) OR EXISTS (
        SELECT 1 FROM public.comm_whatsapp_campaign_targets AS target
        WHERE target.campaign_id = p_campaign_id AND target.phone_digits = v_digits
      ) THEN
        v_duplicates := v_duplicates + 1;
        v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object('row', v_index, 'outcome', 'duplicate'));
        CONTINUE;
      END IF;
      v_seen := array_append(v_seen, v_digits);
      v_display_name := NULLIF(btrim(COALESCE(v_item->>'name', v_item->>'display_name', '')), '');
      IF char_length(COALESCE(v_display_name, '')) > 160 THEN
        v_display_name := left(v_display_name, 160);
      END IF;
      v_custom_fields := CASE
        WHEN jsonb_typeof(v_item->'custom_fields') = 'object' THEN v_item->'custom_fields'
        ELSE '{}'::jsonb
      END;
      INSERT INTO public.comm_whatsapp_campaign_targets (
        campaign_id, phone_number, phone_digits, display_name, source_kind,
        source_payload, status, whatsapp_check_status
      ) VALUES (
        p_campaign_id, v_raw_phone, v_digits, v_display_name, 'csv', v_custom_fields,
        'pending', CASE WHEN v_campaign.validate_whatsapp_numbers THEN 'pending' ELSE 'skipped' END
      );
      v_inserted := v_inserted + 1;
      IF EXISTS (
        SELECT 1 FROM public.contact_permission_policies AS policy
        WHERE policy.channel = 'whatsapp'
          AND policy.endpoint_normalized = v_digits
          AND policy.state = 'blocked'
          AND policy.purpose_scope IN ('global', 'commercial')
      ) THEN
        v_blocked := v_blocked + 1;
        v_outcome := 'blocked';
      ELSE
        v_outcome := 'inserted';
      END IF;
      v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object('row', v_index, 'outcome', v_outcome));
    END LOOP;
    v_metrics := public._mcp_comm_whatsapp_campaign_recount(p_campaign_id);
    v_result := jsonb_build_object(
      'success', true, 'campaign_id', p_campaign_id, 'client_request_id', p_client_request_id,
      'inserted', v_inserted, 'duplicate', v_duplicates, 'invalid_phone', v_invalid,
      'blocked', v_blocked, 'failed', v_failed, 'rows', v_outcomes, 'metrics', v_metrics,
      'replayed', false
    );
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
    RETURN v_result;
  END IF;

  IF p_operation = 'update' THEN
    IF v_campaign.status NOT IN ('draft', 'scheduled', 'paused') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_UPDATE_NOT_ALLOWED';
    END IF;
    IF p_expected_updated_at IS NULL OR v_campaign.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      v_result := jsonb_build_object(
        'success', false, 'error_code', 'STALE_WRITE',
        'message', 'A campanha foi alterada desde a última leitura.',
        'actual_updated_at', v_campaign.updated_at, 'replayed', false
      );
      PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
      RETURN v_result;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.comm_whatsapp_campaign_targets AS target
      WHERE target.campaign_id = p_campaign_id
        AND target.status IN ('sending', 'sent', 'responded', 'stopped', 'failed', 'invalid')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_HAS_PROCESSED_CONTACTS';
    END IF;
    v_name := CASE WHEN v_payload ? 'name' THEN btrim(COALESCE(v_payload->>'name', '')) ELSE v_campaign.name END;
    v_message := CASE WHEN v_payload ? 'message' THEN btrim(COALESCE(v_payload->>'message', '')) ELSE v_campaign.message_text END;
    IF v_name = '' OR char_length(v_name) > 160 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_NAME_REQUIRED'; END IF;
    IF v_message = '' OR char_length(v_message) > 4096 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MESSAGE_REQUIRED'; END IF;
    IF p_payload ? 'pacing_per_minute' THEN
      v_pacing := (p_payload->>'pacing_per_minute')::integer;
      IF v_pacing NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PACING_INVALID'; END IF;
    END IF;
    IF p_payload ? 'daily_send_limit' THEN
      v_daily_limit := NULLIF(p_payload->>'daily_send_limit', '')::integer;
      IF v_daily_limit IS NOT NULL AND v_daily_limit < 1 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_DAILY_LIMIT_INVALID'; END IF;
    END IF;
    IF p_payload ? 'dispatch_priority' THEN
      v_priority := NULLIF(p_payload->>'dispatch_priority', '')::integer;
      IF v_priority NOT BETWEEN 1 AND 3 OR v_priority IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PRIORITY_INVALID';
      END IF;
    END IF;
    IF p_payload ? 'allowed_weekdays' THEN
      IF jsonb_typeof(p_payload->'allowed_weekdays') <> 'array' THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_WEEKDAYS_INVALID'; END IF;
      SELECT array_agg(value::smallint ORDER BY ordinality)
        INTO v_weekdays
      FROM jsonb_array_elements_text(p_payload->'allowed_weekdays') WITH ORDINALITY AS item(value, ordinality);
      IF v_weekdays IS NULL OR cardinality(v_weekdays) = 0 OR NOT (v_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_WEEKDAYS_INVALID';
      END IF;
    END IF;
    v_config := CASE
      WHEN jsonb_typeof(v_payload->'audience_config') = 'object' THEN v_payload->'audience_config'
      ELSE v_campaign.audience_config
    END;
    v_config := jsonb_set(v_config, '{exclude_opt_out}', 'true'::jsonb, true);
    UPDATE public.comm_whatsapp_campaigns
    SET name = v_name,
        objective = CASE WHEN v_payload ? 'objective' THEN NULLIF(btrim(v_payload->>'objective'), '') ELSE v_campaign.objective END,
        audience_config = v_config,
        message_text = v_message,
        scheduled_at = CASE WHEN v_payload ? 'scheduled_at' THEN NULLIF(v_payload->>'scheduled_at', '')::timestamptz ELSE v_campaign.scheduled_at END,
        pacing_per_minute = CASE WHEN v_payload ? 'pacing_per_minute' THEN (v_payload->>'pacing_per_minute')::integer ELSE v_campaign.pacing_per_minute END,
        daily_send_limit = CASE WHEN v_payload ? 'daily_send_limit' THEN NULLIF(v_payload->>'daily_send_limit', '')::integer ELSE v_campaign.daily_send_limit END,
        dispatch_priority = COALESCE(v_priority, v_campaign.dispatch_priority),
        send_window_start = CASE WHEN v_payload ? 'start_hour' THEN NULLIF(v_payload->>'start_hour', '')::time ELSE v_campaign.send_window_start END,
        send_window_end = CASE WHEN v_payload ? 'end_hour' THEN NULLIF(v_payload->>'end_hour', '')::time ELSE v_campaign.send_window_end END,
        active_weekdays = CASE WHEN v_payload ? 'allowed_weekdays' THEN (
          SELECT array_agg(value::smallint ORDER BY ordinality)
          FROM jsonb_array_elements_text(v_payload->'allowed_weekdays') WITH ORDINALITY AS item(value, ordinality)
        ) ELSE v_campaign.active_weekdays END,
        stop_on_reply = CASE WHEN v_payload ? 'stop_on_reply' THEN (v_payload->>'stop_on_reply')::boolean ELSE v_campaign.stop_on_reply END,
        validate_whatsapp_numbers = CASE WHEN v_payload ? 'validate_whatsapp_numbers' THEN (v_payload->>'validate_whatsapp_numbers')::boolean ELSE v_campaign.validate_whatsapp_numbers END,
        create_leads_from_csv = false,
        updated_at = now()
    WHERE id = p_campaign_id
    RETURNING * INTO v_campaign;
    IF p_payload ? 'steps' THEN
      v_first_message := public._mcp_comm_whatsapp_campaign_replace_steps(p_campaign_id, p_payload->'steps', v_message);
      UPDATE public.comm_whatsapp_campaigns SET message_text = v_first_message, updated_at = now() WHERE id = p_campaign_id RETURNING * INTO v_campaign;
    END IF;
    v_result := jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'updated', true, 'campaign', to_jsonb(v_campaign), 'replayed', false);
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
    RETURN v_result;
  END IF;

  IF p_operation = 'remove_contact' THEN
    SELECT * INTO v_target
    FROM public.comm_whatsapp_campaign_targets
    WHERE id = p_target_id AND campaign_id = p_campaign_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CAMPAIGN_CONTACT_NOT_FOUND'; END IF;
    IF v_target.status NOT IN ('pending', 'scheduled') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_CONTACT_ALREADY_PROCESSED';
    END IF;
    IF p_expected_updated_at IS NULL OR v_target.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      v_result := jsonb_build_object('success', false, 'error_code', 'STALE_WRITE', 'actual_updated_at', v_target.updated_at, 'replayed', false);
      PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
      RETURN v_result;
    END IF;
    UPDATE public.comm_whatsapp_campaign_targets
    SET status = 'cancelled', stopped_at = now(), stopped_reason = 'removed_by_mcp', updated_at = now()
    WHERE id = p_target_id;
    v_metrics := public._mcp_comm_whatsapp_campaign_recount(p_campaign_id);
    v_result := jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'target_id', p_target_id, 'removed', true, 'metrics', v_metrics, 'replayed', false);
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
    RETURN v_result;
  END IF;

  IF p_expected_updated_at IS NULL OR v_campaign.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := jsonb_build_object('success', false, 'error_code', 'STALE_WRITE', 'actual_updated_at', v_campaign.updated_at, 'replayed', false);
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
    RETURN v_result;
  END IF;

  IF p_operation = 'activate' THEN
    IF v_campaign.status NOT IN ('draft', 'scheduled', 'paused') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_ACTIVATE_NOT_ALLOWED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_targets WHERE campaign_id = p_campaign_id) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_CONTACTS_REQUIRED';
    END IF;
    IF lower(COALESCE(v_campaign.audience_config->>'exclude_opt_out', 'true')) = 'false' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_OPTOUT_REQUIRED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_steps WHERE campaign_id = p_campaign_id AND length(btrim(message_text)) > 0) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_MESSAGE_REQUIRED';
    END IF;
    -- Keep the row paused while the Edge Function is invoked.  The existing
    -- worker only accepts draft/scheduled/paused on its activation boundary;
    -- it is the worker, not this RPC, that materializes CRM audiences and
    -- transitions to queued/scheduled.
    v_status := 'paused';
    UPDATE public.comm_whatsapp_campaigns
    SET status = 'paused', last_error = NULL, updated_at = now()
    WHERE id = p_campaign_id
    RETURNING * INTO v_campaign;
    v_metrics := public._mcp_comm_whatsapp_campaign_recount(p_campaign_id);
    v_result := jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'status', v_status, 'activation_accepted', true, 'metrics', v_metrics, 'replayed', false);
  ELSIF p_operation = 'schedule' THEN
    v_scheduled_at := NULLIF(v_payload->>'scheduled_at', '')::timestamptz;
    IF v_scheduled_at IS NULL THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_SCHEDULE_REQUIRED'; END IF;
    IF v_campaign.status NOT IN ('draft', 'scheduled') THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_SCHEDULE_NOT_ALLOWED'; END IF;
    UPDATE public.comm_whatsapp_campaigns SET scheduled_at = v_scheduled_at, status = 'scheduled', updated_at = now() WHERE id = p_campaign_id RETURNING * INTO v_campaign;
    v_result := jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'status', 'scheduled', 'campaign', to_jsonb(v_campaign), 'replayed', false);
  ELSIF p_operation = 'pause' THEN
    IF v_campaign.status NOT IN ('queued', 'running', 'scheduled') THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_PAUSE_NOT_ALLOWED'; END IF;
    UPDATE public.comm_whatsapp_campaigns SET status = 'paused', last_error = NULL, updated_at = now() WHERE id = p_campaign_id RETURNING * INTO v_campaign;
    UPDATE public.comm_whatsapp_campaign_targets SET status = 'scheduled', locked_at = NULL, lock_token = NULL, updated_at = now() WHERE campaign_id = p_campaign_id AND status = 'sending';
    v_result := jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'status', 'paused', 'replayed', false);
  ELSIF p_operation = 'resume' THEN
    IF v_campaign.status <> 'paused' THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_RESUME_NOT_ALLOWED'; END IF;
    v_status := CASE WHEN v_campaign.scheduled_at IS NOT NULL AND v_campaign.scheduled_at > now() THEN 'scheduled' ELSE 'queued' END;
    UPDATE public.comm_whatsapp_campaigns SET status = v_status, last_error = NULL, updated_at = now() WHERE id = p_campaign_id RETURNING * INTO v_campaign;
    v_result := jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'status', v_status, 'replayed', false);
  ELSIF p_operation = 'delete' THEN
    IF v_campaign.status NOT IN ('draft', 'scheduled', 'paused') THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_DELETE_NOT_ALLOWED'; END IF;
    IF EXISTS (SELECT 1 FROM public.comm_whatsapp_campaign_targets WHERE campaign_id = p_campaign_id AND status NOT IN ('pending', 'scheduled', 'cancelled')) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CAMPAIGN_HAS_PROCESSED_CONTACTS';
    END IF;
    DELETE FROM public.comm_whatsapp_campaigns WHERE id = p_campaign_id;
    v_result := jsonb_build_object('success', true, 'campaign_id', p_campaign_id, 'deleted', true, 'replayed', false);
  END IF;

  PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id, p_client_request_id, v_result);
  RETURN v_result;
END;
$function$
;


CREATE OR REPLACE FUNCTION public.mcp_get_comm_whatsapp_campaign_global_status(
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, auth
AS $mcp_global$
DECLARE
  v_limit integer;
  v_updated timestamptz;
  v_used integer;
  v_next timestamptz;
  v_as_of timestamptz := clock_timestamp();
BEGIN
  PERFORM public._mcp_comm_whatsapp_campaign_assert_admin(p_actor_user_id);
  SELECT daily_message_limit, updated_at
    INTO v_limit, v_updated
    FROM public.comm_whatsapp_campaign_global_settings WHERE channel_key='whatsapp';
  IF NOT FOUND THEN RAISE EXCEPTION 'MCP_GLOBAL_CAMPAIGN_QUOTA_NOT_FOUND'; END IF;
  SELECT COALESCE(sum(message_count),0)::integer, min(reserved_at+interval '24 hours')
    INTO v_used, v_next
    FROM public.comm_whatsapp_campaign_global_message_reservations
    WHERE reserved_at > v_as_of - interval '24 hours';
  RETURN jsonb_build_object(
    'success',true,'channel_key','whatsapp','period','rolling_24h',
    'daily_message_limit',v_limit,'reserved_messages_24h',v_used,
    'remaining_messages',GREATEST(v_limit-v_used,0),
    'next_available_at',CASE WHEN v_used>=v_limit THEN v_next ELSE NULL::timestamptz END,
    'updated_at',v_updated,'as_of',v_as_of,
    'counting','message_reservations_including_followups_and_bubbles'
  );
END;
$mcp_global$;

CREATE OR REPLACE FUNCTION public.mcp_set_comm_whatsapp_campaign_global_limit(
  p_actor_user_id uuid, p_limit integer, p_expected_updated_at timestamptz,
  p_client_request_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, auth
AS $mcp_global$
DECLARE
  v_gate jsonb;
  v_result jsonb;
  v_existing public.comm_whatsapp_campaign_global_settings%ROWTYPE;
  v_used integer;
BEGIN
  PERFORM public._mcp_comm_whatsapp_campaign_assert_admin(p_actor_user_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MCP_CAMPAIGN_GLOBAL_LIMIT_INVALID';
  END IF;
  v_gate := public._mcp_comm_whatsapp_campaign_begin(
    p_actor_user_id,p_client_request_id,'set_global_limit',NULL,NULL,
    jsonb_build_object('operation','set_global_limit','limit',p_limit,'expected_updated_at',p_expected_updated_at)
  );
  IF (v_gate->>'replayed')::boolean THEN RETURN (v_gate->'result')||jsonb_build_object('replayed',true); END IF;
  SELECT * INTO v_existing FROM public.comm_whatsapp_campaign_global_settings
    WHERE channel_key='whatsapp' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MCP_GLOBAL_CAMPAIGN_QUOTA_NOT_FOUND'; END IF;
  IF p_expected_updated_at IS NULL OR v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := jsonb_build_object('success',false,'error_code','STALE_WRITE','actual_updated_at',v_existing.updated_at,
      'message','A configuração global foi modificada desde a última leitura.','replayed',false);
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id,p_client_request_id,v_result);
    RETURN v_result;
  END IF;
  UPDATE public.comm_whatsapp_campaign_global_settings
    SET daily_message_limit=p_limit, updated_at=clock_timestamp()
    WHERE channel_key='whatsapp' RETURNING * INTO v_existing;
  SELECT COALESCE(sum(message_count),0)::integer INTO v_used
    FROM public.comm_whatsapp_campaign_global_message_reservations
    WHERE reserved_at > clock_timestamp()-interval '24 hours';
  v_result:=jsonb_build_object('success',true,'channel_key','whatsapp','daily_message_limit',v_existing.daily_message_limit,
    'reserved_messages_24h',v_used,'remaining_messages',GREATEST(p_limit-v_used,0),
    'updated_at',v_existing.updated_at,'replayed',false);
  PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id,p_client_request_id,v_result);
  RETURN v_result;
END;
$mcp_global$;

CREATE OR REPLACE FUNCTION public.mcp_set_comm_whatsapp_campaign_priority(
  p_actor_user_id uuid, p_campaign_id uuid, p_priority integer,
  p_expected_updated_at timestamptz, p_client_request_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, auth
AS $mcp_priority$
DECLARE
  v_gate jsonb;
  v_result jsonb;
  v_campaign public.comm_whatsapp_campaigns%ROWTYPE;
  v_previous_priority integer;
BEGIN
  PERFORM public._mcp_comm_whatsapp_campaign_assert_admin(p_actor_user_id);
  IF p_campaign_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MCP_CAMPAIGN_ID_REQUIRED'; END IF;
  IF p_priority IS NULL OR p_priority NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MCP_CAMPAIGN_PRIORITY_INVALID';
  END IF;
  v_gate:=public._mcp_comm_whatsapp_campaign_begin(
    p_actor_user_id,p_client_request_id,'set_priority',p_campaign_id,NULL,
    jsonb_build_object('operation','set_priority','campaign_id',p_campaign_id,'priority',p_priority,
      'expected_updated_at',p_expected_updated_at)
  );
  IF (v_gate->>'replayed')::boolean THEN RETURN (v_gate->'result')||jsonb_build_object('replayed',true); END IF;
  SELECT * INTO v_campaign FROM public.comm_whatsapp_campaigns WHERE id=p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MCP_CAMPAIGN_NOT_FOUND'; END IF;
  IF v_campaign.status NOT IN ('draft','scheduled','queued','running','paused') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MCP_CAMPAIGN_PRIORITY_NOT_EDITABLE';
  END IF;
  IF p_expected_updated_at IS NULL OR v_campaign.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result:=jsonb_build_object('success',false,'error_code','STALE_WRITE','actual_updated_at',v_campaign.updated_at,
      'message','A campanha foi modificada desde a última leitura.','replayed',false);
    PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id,p_client_request_id,v_result);
    RETURN v_result;
  END IF;
  v_previous_priority:=v_campaign.dispatch_priority;
  UPDATE public.comm_whatsapp_campaigns
    SET dispatch_priority=p_priority,updated_at=clock_timestamp()
    WHERE id=p_campaign_id
    RETURNING * INTO v_campaign;
  v_result:=jsonb_build_object('success',true,'campaign_id',v_campaign.id,'previous_priority',v_previous_priority,
    'dispatch_priority',v_campaign.dispatch_priority,'status',v_campaign.status,
    'updated_at',v_campaign.updated_at,'replayed',false);
  PERFORM public._mcp_comm_whatsapp_campaign_complete(p_actor_user_id,p_client_request_id,v_result);
  RETURN v_result;
END;
$mcp_priority$;

REVOKE ALL ON FUNCTION public.mcp_get_comm_whatsapp_campaign_global_status(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mcp_set_comm_whatsapp_campaign_global_limit(uuid,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mcp_set_comm_whatsapp_campaign_priority(uuid,uuid,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_comm_whatsapp_campaign_global_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_set_comm_whatsapp_campaign_global_limit(uuid,integer,timestamptz,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_set_comm_whatsapp_campaign_priority(uuid,uuid,integer,timestamptz,text) TO service_role;

COMMIT;
