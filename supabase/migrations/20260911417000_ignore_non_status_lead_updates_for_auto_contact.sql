/*
  # Ignore non-status lead updates in auto-contact trigger

  Internal updates such as `ultimo_contato` happen while flow jobs are being
  processed. They must not re-enter the auto-contact handler because the handler
  can otherwise cancel pending jobs for the same flow.
*/

CREATE OR REPLACE FUNCTION trigger_auto_send_lead_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
  event_type text;
  is_status_change boolean;
  has_label boolean := false;
  has_value boolean := false;
  has_config_key boolean := false;
  has_config_value boolean := false;
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.skip_automation, false) THEN
    UPDATE public.leads
    SET skip_automation = false
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND COALESCE(OLD.skip_automation, false)
    AND NOT COALESCE(NEW.skip_automation, false)
  THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.canal, '') = 'whatsapp_campaign' THEN
    IF TG_OP = 'INSERT' AND NOT COALESCE(NEW.skip_automation, false) THEN
      UPDATE public.leads
      SET skip_automation = true
      WHERE id = NEW.id
        AND NOT COALESCE(skip_automation, false);
    END IF;

    RAISE LOG 'Skipping auto-contact trigger for campaign lead %', NEW.id;
    RETURN NEW;
  END IF;

  is_status_change := (
    TG_OP = 'UPDATE'
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.status_id IS DISTINCT FROM NEW.status_id
    )
  );

  IF TG_OP = 'UPDATE' AND NOT is_status_change THEN
    RAISE LOG 'Skipping auto-contact trigger for non-status lead update %', NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    event_type := 'lead_created';
  ELSIF is_status_change THEN
    event_type := 'status_changed';
  ELSE
    event_type := 'update';
  END IF;

  BEGIN
    function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    function_url := NULL;
  END;

  BEGIN
    service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'label'
  ) INTO has_label;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'value'
  ) INTO has_value;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_key'
  ) INTO has_config_key;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_value'
  ) INTO has_config_value;

  IF function_url IS NULL AND has_label AND has_value THEN
    SELECT NULLIF(trim(both '"' FROM value), '') INTO function_url
    FROM public.system_configurations
    WHERE label = 'supabase_url'
    LIMIT 1;
  END IF;

  IF service_role_key IS NULL AND has_label AND has_value THEN
    SELECT NULLIF(trim(both '"' FROM value), '') INTO service_role_key
    FROM public.system_configurations
    WHERE label = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF function_url IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM public.system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NOT NULL THEN
    function_url := rtrim(function_url, '/') || '/functions/v1/leads-api?action=auto-contact';
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Configuracoes do Supabase nao encontradas em system_configurations.';
    RETURN NEW;
  END IF;

  SELECT INTO request_id net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', event_type,
      'table', 'leads',
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
      'is_status_change', is_status_change
    ),
    timeout_milliseconds := 30000
  );

  RAISE LOG 'Auto-contact trigger dispatched for lead %, request_id: %, event: %', NEW.id, request_id, event_type;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao disparar automacao no leads-api: %', SQLERRM;
    RETURN NEW;
END;
$$;
