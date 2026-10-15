-- Operational status references follow the catalog UUID through rename aliases.
-- Preserve name-based HTTP/JSON contracts and historical messages/status history.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.lead_status_aliases (
  name_key text PRIMARY KEY,
  status_id uuid NOT NULL REFERENCES public.lead_status_config(id) ON DELETE CASCADE
);
ALTER TABLE private.lead_status_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.lead_status_aliases FROM PUBLIC, anon, authenticated;

INSERT INTO private.lead_status_aliases(name_key, status_id)
SELECT lower(btrim(nome)), id FROM public.lead_status_config;

-- Repair the confirmed historical rename, without guessing other status identities.
INSERT INTO private.lead_status_aliases(name_key, status_id)
SELECT 'em atendimento', id FROM public.lead_status_config
WHERE nome = 'Atendimento'
  AND NOT EXISTS (SELECT 1 FROM public.lead_status_config WHERE lower(btrim(nome)) = 'em atendimento')
ON CONFLICT DO NOTHING;

CREATE FUNCTION private.current_lead_status_name(p_name text)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT s.nome FROM private.lead_status_aliases a
    JOIN public.lead_status_config s ON s.id = a.status_id
    WHERE a.name_key = lower(btrim(p_name))
  ), p_name);
$$;

CREATE FUNCTION private.refresh_lead_status_references(p_document jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  result jsonb := p_document;
  item record;
  name_key text;
  names jsonb;
BEGIN
  IF jsonb_typeof(p_document) = 'array' THEN
    SELECT COALESCE(jsonb_agg(private.refresh_lead_status_references(value) ORDER BY ordinality), '[]'::jsonb)
    INTO result FROM jsonb_array_elements(p_document) WITH ORDINALITY;
  ELSIF jsonb_typeof(p_document) = 'object' THEN
    FOR item IN SELECT key, value FROM jsonb_each(p_document) LOOP
      result := jsonb_set(result, ARRAY[item.key], private.refresh_lead_status_references(item.value));
    END LOOP;
    FOREACH name_key IN ARRAY ARRAY['triggerStatus', 'statusToSet', 'statusOnSend', 'invalidNumberStatus', 'finalStatus', 'status_name'] LOOP
      IF jsonb_typeof(result->name_key) = 'string' THEN
        result := jsonb_set(result, ARRAY[name_key], to_jsonb(private.current_lead_status_name(result->>name_key)));
      END IF;
    END LOOP;
    FOREACH name_key IN ARRAY ARRAY['triggerStatuses', 'statuses'] LOOP
      IF jsonb_typeof(result->name_key) = 'array' THEN
        SELECT COALESCE(jsonb_agg(
          CASE WHEN jsonb_typeof(value) = 'string'
            THEN to_jsonb(private.current_lead_status_name(value #>> '{}')) ELSE value END
          ORDER BY ordinality), '[]'::jsonb)
        INTO names FROM jsonb_array_elements(result->name_key) WITH ORDINALITY;
        result := jsonb_set(result, ARRAY[name_key], names);
      END IF;
    END LOOP;
    IF result->>'field' = 'status' AND jsonb_typeof(result->'value') = 'string' THEN
      IF result->>'operator' IN ('in_list', 'not_in_list') THEN
        SELECT to_jsonb(string_agg(private.current_lead_status_name(btrim(value)), ';' ORDER BY ordinality))
        INTO names FROM regexp_split_to_table(result->>'value', '[;,]') WITH ORDINALITY AS parts(value, ordinality);
      ELSE
        names := to_jsonb(private.current_lead_status_name(result->>'value'));
      END IF;
      result := jsonb_set(result, '{value}', names);
    END IF;
  END IF;
  RETURN result;
END;
$$;

-- Guards also canonicalize stale writes from an already-open browser or worker.
CREATE FUNCTION private.canonicalize_operational_lead_statuses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'integration_settings' THEN
    IF NEW.slug = 'whatsapp_auto_contact' THEN
      NEW.settings := private.refresh_lead_status_references(NEW.settings);
    END IF;
  ELSIF TG_TABLE_NAME IN ('auto_contact_flow_jobs', 'comm_whatsapp_campaign_steps') THEN
    NEW.status_to_set := private.current_lead_status_name(NEW.status_to_set);
  ELSIF TG_TABLE_NAME = 'comm_whatsapp_campaigns' THEN
    NEW.audience_config := private.refresh_lead_status_references(NEW.audience_config);
  ELSIF TG_TABLE_NAME = 'comm_whatsapp_scheduled_sequence_actions' THEN
    IF NEW.action_type = 'update_status' THEN
      NEW.config := private.refresh_lead_status_references(NEW.config);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER canonicalize_auto_contact_statuses BEFORE INSERT OR UPDATE OF settings
ON public.integration_settings FOR EACH ROW EXECUTE FUNCTION private.canonicalize_operational_lead_statuses();
CREATE TRIGGER canonicalize_auto_contact_job_status BEFORE INSERT OR UPDATE OF status_to_set
ON public.auto_contact_flow_jobs FOR EACH ROW EXECUTE FUNCTION private.canonicalize_operational_lead_statuses();
CREATE TRIGGER canonicalize_campaign_step_status BEFORE INSERT OR UPDATE OF status_to_set
ON public.comm_whatsapp_campaign_steps FOR EACH ROW EXECUTE FUNCTION private.canonicalize_operational_lead_statuses();
CREATE TRIGGER canonicalize_campaign_audience_statuses BEFORE INSERT OR UPDATE OF audience_config
ON public.comm_whatsapp_campaigns FOR EACH ROW EXECUTE FUNCTION private.canonicalize_operational_lead_statuses();
CREATE TRIGGER canonicalize_scheduled_action_status BEFORE INSERT OR UPDATE OF config
ON public.comm_whatsapp_scheduled_sequence_actions FOR EACH ROW EXECUTE FUNCTION private.canonicalize_operational_lead_statuses();

CREATE FUNCTION private.synchronize_renamed_lead_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.lead_status_aliases
    WHERE name_key = lower(btrim(NEW.nome)) AND status_id <> NEW.id) THEN
    RAISE EXCEPTION 'Este nome já identifica outro status, inclusive em referências anteriores.';
  END IF;
  INSERT INTO private.lead_status_aliases(name_key, status_id)
  VALUES (lower(btrim(NEW.nome)), NEW.id) ON CONFLICT DO NOTHING;
  IF TG_OP = 'INSERT' OR NEW.nome IS NOT DISTINCT FROM OLD.nome THEN RETURN NEW; END IF;

  UPDATE public.integration_settings SET settings = private.refresh_lead_status_references(settings)
  WHERE slug = 'whatsapp_auto_contact'
    AND settings IS DISTINCT FROM private.refresh_lead_status_references(settings);
  UPDATE public.auto_contact_flow_jobs SET status_to_set = private.current_lead_status_name(status_to_set)
  WHERE status IN ('pending', 'processing') AND status_to_set IS DISTINCT FROM private.current_lead_status_name(status_to_set);
  UPDATE public.comm_whatsapp_campaign_steps SET status_to_set = private.current_lead_status_name(status_to_set)
  WHERE status_to_set IS DISTINCT FROM private.current_lead_status_name(status_to_set);
  UPDATE public.comm_whatsapp_campaigns SET audience_config = private.refresh_lead_status_references(audience_config)
  WHERE audience_config IS DISTINCT FROM private.refresh_lead_status_references(audience_config);
  UPDATE public.comm_whatsapp_scheduled_sequence_actions SET config = private.refresh_lead_status_references(config)
  WHERE action_type = 'update_status' AND config IS DISTINCT FROM private.refresh_lead_status_references(config);
  UPDATE public.leads SET status = NEW.nome WHERE status_id = NEW.id AND status IS DISTINCT FROM NEW.nome;
  RETURN NEW;
END;
$$;

CREATE TRIGGER synchronize_lead_status_rename AFTER INSERT OR UPDATE OF nome
ON public.lead_status_config FOR EACH ROW EXECUTE FUNCTION private.synchronize_renamed_lead_status();

-- A label rename is not a commercial status transition: dispatch by identity.
DROP TRIGGER trigger_auto_send_on_lead_change ON public.leads;
CREATE TRIGGER trigger_auto_send_on_lead_change AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_send_lead_messages();
CREATE TRIGGER trigger_auto_send_on_lead_status_change AFTER UPDATE ON public.leads
FOR EACH ROW WHEN (
  OLD.status_id IS DISTINCT FROM NEW.status_id OR
  ((OLD.status_id IS NULL OR NEW.status_id IS NULL) AND OLD.status IS DISTINCT FROM NEW.status)
) EXECUTE FUNCTION public.trigger_auto_send_lead_messages();

UPDATE public.integration_settings SET settings = private.refresh_lead_status_references(settings)
WHERE slug = 'whatsapp_auto_contact' AND settings IS DISTINCT FROM private.refresh_lead_status_references(settings);
UPDATE public.auto_contact_flow_jobs SET status_to_set = private.current_lead_status_name(status_to_set)
WHERE status IN ('pending', 'processing') AND status_to_set IS DISTINCT FROM private.current_lead_status_name(status_to_set);
UPDATE public.comm_whatsapp_campaign_steps SET status_to_set = private.current_lead_status_name(status_to_set)
WHERE status_to_set IS DISTINCT FROM private.current_lead_status_name(status_to_set);
UPDATE public.comm_whatsapp_campaigns SET audience_config = private.refresh_lead_status_references(audience_config)
WHERE audience_config IS DISTINCT FROM private.refresh_lead_status_references(audience_config);
UPDATE public.comm_whatsapp_scheduled_sequence_actions SET config = private.refresh_lead_status_references(config)
WHERE action_type = 'update_status' AND config IS DISTINCT FROM private.refresh_lead_status_references(config);
UPDATE public.leads l SET status = s.nome FROM public.lead_status_config s
WHERE l.status_id = s.id AND l.status IS DISTINCT FROM s.nome;

REVOKE ALL ON FUNCTION private.current_lead_status_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.refresh_lead_status_references(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.canonicalize_operational_lead_statuses() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.synchronize_renamed_lead_status() FROM PUBLIC, anon, authenticated;
