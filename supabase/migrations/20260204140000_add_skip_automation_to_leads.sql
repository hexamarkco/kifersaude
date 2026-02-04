/*
  # Add skip_automation flag for lead creation

  1. Add skip_automation column to leads
  2. Update trigger to skip automation on insert when flag is set
     and ignore the follow-up update that clears the flag
*/

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS skip_automation boolean DEFAULT false;

CREATE OR REPLACE FUNCTION trigger_auto_send_lead_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.skip_automation, false) THEN
    UPDATE leads
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

  SELECT 
    (config_value->>'supabase_url')::text,
    (config_value->>'supabase_service_role_key')::text
  INTO function_url, service_role_key
  FROM (
    SELECT jsonb_object_agg(config_key, config_value) as config_value
    FROM system_configurations
    WHERE config_key IN ('supabase_url', 'supabase_service_role_key')
  ) configs;

  IF function_url IS NOT NULL THEN
    function_url := function_url || '/functions/v1/leads-api?action=auto-contact';
  END IF;

  RAISE LOG 'Auto-contact trigger: URL=%, has_key=%', function_url, (service_role_key IS NOT NULL);

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Configurações do Supabase não encontradas em system_configurations. Configure supabase_url e supabase_service_role_key.';
    RETURN NEW;
  END IF;

  SELECT INTO request_id net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', 'leads',
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
    )
  );

  RAISE LOG 'Auto-contact trigger disparado para lead %, request_id: %', NEW.id, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao disparar automação no leads-api: %', SQLERRM;
    RETURN NEW;
END;
$$;
