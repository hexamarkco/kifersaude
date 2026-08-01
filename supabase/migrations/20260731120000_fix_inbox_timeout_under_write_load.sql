/*
  Fix inbox timeout under write load and prevent cron from blocking DB

  1. Replaces the per-row LATERAL JOIN in comm_whatsapp_list_chats with a single
     DISTINCT ON subquery that prefetches delivery_status for the entire page.
     This avoids 80 individual index lookups timing out under write pressure.

  2. Caps check_auto_contact_inactivity_triggers at 20 leads per 5 min run so
     concurrent net.http_post calls do not keep the function open for minutes.
     Remaining leads are picked up in subsequent cron ticks.
*/

-- 1. Optimize listChats: replace LATERAL JOIN with bulk prefetch
CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats(
  p_search text DEFAULT NULL,
  p_activity_filter text DEFAULT 'all',
  p_lead_filter text DEFAULT 'all',
  p_saved_filter text DEFAULT 'all',
  p_archived_filter text DEFAULT 'active',
  p_lead_status_filters text[] DEFAULT NULL,
  p_limit integer DEFAULT 80,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  channel_id uuid,
  external_chat_id text,
  phone_number text,
  phone_digits text,
  display_name text,
  saved_contact_name text,
  push_name text,
  lead_id uuid,
  lead_name text,
  lead_status text,
  is_archived boolean,
  archived_at timestamptz,
  is_muted boolean,
  muted_at timestamptz,
  is_pinned boolean,
  pinned_at timestamptz,
  manual_unread boolean,
  manual_unread_at timestamptz,
  last_message_text text,
  last_message_direction text,
  last_message_at timestamptz,
  last_message_delivery_status text,
  unread_count integer,
  status text,
  last_read_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH input AS (
    SELECT
      NULLIF(btrim(COALESCE(p_search, '')), '') AS search_text,
      regexp_replace(COALESCE(p_search, ''), '\D', '', 'g') AS search_digits,
      lower(NULLIF(btrim(COALESCE(p_activity_filter, 'all')), '')) AS activity_filter,
      lower(NULLIF(btrim(COALESCE(p_lead_filter, 'all')), '')) AS lead_filter,
      lower(NULLIF(btrim(COALESCE(p_saved_filter, 'all')), '')) AS saved_filter,
      lower(NULLIF(btrim(COALESCE(p_archived_filter, 'active')), '')) AS archived_filter,
      ARRAY(
        SELECT lower(btrim(value))
        FROM unnest(COALESCE(p_lead_status_filters, ARRAY[]::text[])) AS value
        WHERE btrim(value) <> ''
      ) AS lead_status_filters,
      LEAST(GREATEST(COALESCE(p_limit, 80), 1), 500) AS safe_limit,
      GREATEST(COALESCE(p_offset, 0), 0) AS safe_offset
  ),
  page AS MATERIALIZED (
    SELECT
      c.*,
      l.nome_completo AS resolved_lead_name,
      COALESCE(lsc.nome, l.status) AS resolved_lead_status
    FROM public.comm_whatsapp_chats c
    LEFT JOIN public.leads l ON l.id = c.lead_id
    LEFT JOIN public.lead_status_config lsc ON lsc.id = l.status_id
    CROSS JOIN input
    WHERE public.current_user_can_view_comm_whatsapp()
      AND c.deleted_at IS NULL
      AND (
        input.activity_filter IS NULL OR input.activity_filter = 'all'
        OR (input.activity_filter = 'unread' AND (c.unread_count > 0 OR c.manual_unread = true))
      )
      AND (
        input.lead_filter IS NULL OR input.lead_filter = 'all'
        OR (input.lead_filter = 'with_lead' AND c.lead_id IS NOT NULL)
        OR (input.lead_filter = 'without_lead' AND c.lead_id IS NULL)
      )
      AND (
        input.saved_filter IS NULL OR input.saved_filter = 'all'
        OR (input.saved_filter = 'saved' AND NULLIF(btrim(c.saved_contact_name), '') IS NOT NULL)
        OR (input.saved_filter = 'unsaved' AND NULLIF(btrim(c.saved_contact_name), '') IS NULL)
      )
      AND (
        input.archived_filter IS NULL OR input.archived_filter = 'all'
        OR (input.archived_filter = 'active' AND c.is_archived = false)
        OR (input.archived_filter = 'archived' AND c.is_archived = true)
      )
      AND (
        cardinality(input.lead_status_filters) = 0
        OR lower(COALESCE(lsc.nome, l.status, '')) = ANY(input.lead_status_filters)
      )
      AND (
        input.search_text IS NULL
        OR c.display_name ILIKE '%' || input.search_text || '%'
        OR c.saved_contact_name ILIKE '%' || input.search_text || '%'
        OR c.push_name ILIKE '%' || input.search_text || '%'
        OR l.nome_completo ILIKE '%' || input.search_text || '%'
        OR c.phone_number ILIKE '%' || input.search_text || '%'
        OR (input.search_digits <> '' AND c.phone_digits ILIKE '%' || input.search_digits || '%')
      )
    ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC
    LIMIT (SELECT safe_limit FROM input)
    OFFSET (SELECT safe_offset FROM input)
  ),
  page_delivery AS MATERIALIZED (
    SELECT DISTINCT ON (m.chat_id) m.chat_id, m.delivery_status
    FROM public.comm_whatsapp_messages m
    WHERE m.chat_id IN (SELECT id FROM page)
    ORDER BY m.chat_id, m.message_at DESC, m.created_at DESC, m.id DESC
  )
  SELECT
    c.id,
    c.channel_id,
    c.external_chat_id,
    c.phone_number,
    c.phone_digits,
    COALESCE(NULLIF(btrim(c.saved_contact_name), ''), NULLIF(btrim(c.resolved_lead_name), ''), c.display_name) AS display_name,
    c.saved_contact_name,
    c.push_name,
    c.lead_id,
    c.resolved_lead_name AS lead_name,
    c.resolved_lead_status AS lead_status,
    c.is_archived,
    c.archived_at,
    c.is_muted,
    c.muted_at,
    c.is_pinned,
    c.pinned_at,
    c.manual_unread,
    c.manual_unread_at,
    c.last_message_text,
    c.last_message_direction,
    c.last_message_at,
    pd.delivery_status AS last_message_delivery_status,
    c.unread_count,
    c.status,
    c.last_read_at,
    c.created_at,
    c.updated_at
  FROM page c
  LEFT JOIN page_delivery pd ON pd.chat_id = c.id
  ORDER BY c.is_pinned DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats(text, text, text, text, text, text[], integer, integer) TO authenticated;


-- 2. Cap inactivity cron at 20 leads per run to avoid minutes-long function execution
CREATE OR REPLACE FUNCTION public.check_auto_contact_inactivity_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_function_url text;
  v_flow jsonb;
  v_lead record;
  v_duration_hours integer;
  v_activated_at timestamptz;
  v_lead_count integer;
BEGIN
  SELECT NULLIF(trim(both '"' FROM config_value::text), '')
  INTO v_supabase_url
  FROM public.system_configurations
  WHERE config_key = 'supabase_url'
  LIMIT 1;

  SELECT NULLIF(trim(both '"' FROM config_value::text), '')
  INTO v_service_role_key
  FROM public.system_configurations
  WHERE config_key = 'supabase_service_role_key'
  LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'Inactivity automation check skipped: missing Supabase configuration.';
    RETURN;
  END IF;

  v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/leads-api?action=check-inactivity-duration';

  FOR v_flow IN
    SELECT flow.value
    FROM public.integration_settings settings
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(settings.settings->'flows', '[]'::jsonb)) AS flow(value)
    WHERE settings.slug = 'whatsapp_auto_contact'
      AND settings.settings->>'enabled' = 'true'
      AND settings.settings->>'autoSend' = 'true'
      AND flow.value->>'triggerType' = 'inactivity_duration'
  LOOP
    BEGIN
      v_activated_at := NULLIF(v_flow->>'triggerActivatedAt', '')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format THEN
      v_activated_at := NULL;
    END;

    IF v_activated_at IS NULL THEN
      CONTINUE;
    END IF;

    v_duration_hours := GREATEST(24, COALESCE(NULLIF(v_flow->>'triggerDurationHours', '')::integer, 24));
    v_lead_count := 0;

    FOR v_lead IN
      WITH chat_activity AS (
        SELECT c.lead_id, MAX(m.message_at) AS last_activity_at
        FROM public.comm_whatsapp_chats c
        INNER JOIN public.comm_whatsapp_messages m ON m.chat_id = c.id
        WHERE c.lead_id IS NOT NULL
          AND public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
        GROUP BY c.lead_id
      ), status_entries AS (
        SELECT lead_id, MAX(created_at) AS status_entered_at
        FROM public.lead_status_history
        GROUP BY lead_id
      ), trigger_statuses AS (
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(v_flow->'triggerStatuses', '[]'::jsonb))
        ) AS values
      )
      SELECT
        l.id,
        COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at) AS inactivity_started_at
      FROM public.leads l
      LEFT JOIN public.lead_status_config status_config ON status_config.id = l.status_id
      LEFT JOIN chat_activity a ON a.lead_id = l.id
      LEFT JOIN status_entries h ON h.lead_id = l.id
      CROSS JOIN trigger_statuses ts
      WHERE l.ativo = true
        AND l.arquivado = false
        AND cardinality(ts.values) > 0
        AND COALESCE(status_config.nome, l.status) = ANY(ts.values)
        AND GREATEST(
          COALESCE(a.last_activity_at, h.status_entered_at, l.updated_at, l.created_at),
          v_activated_at
        ) <= now() - make_interval(hours => v_duration_hours)
        AND NOT EXISTS (
          SELECT 1
          FROM public.auto_contact_flow_jobs j
          WHERE j.lead_id = l.id
            AND j.flow_id = v_flow->>'id'
            AND j.status IN ('pending', 'processing')
        )
      ORDER BY l.created_at ASC
    LOOP
      v_lead_count := v_lead_count + 1;
      IF v_lead_count > 20 THEN
        EXIT;
      END IF;

      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'lead_id', v_lead.id,
          'flow_id', v_flow->>'id',
          'inactivity_started_at', v_lead.inactivity_started_at
        ),
        timeout_milliseconds := 10000
      );
    END LOOP;
  END LOOP;
END;
$$;
