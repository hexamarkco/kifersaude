BEGIN;

-- Shared portfolio: execution identity is separate from authorization and ownership.
CREATE SCHEMA IF NOT EXISTS production_private;
REVOKE ALL ON SCHEMA production_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.production_operators (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id),
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.production_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  started_at timestamptz
);
INSERT INTO public.production_settings(singleton) VALUES (true);
INSERT INTO public.production_operators(user_id, display_name)
SELECT id, CASE WHEN username = 'nick' THEN 'Nick' ELSE 'Luiza' END
FROM public.user_profiles WHERE username IN ('nick', 'luiza.kifer');

CREATE TABLE production_private.attribution (
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  operator_user_id uuid REFERENCES public.production_operators(user_id),
  authorizer_user_id uuid REFERENCES public.user_profiles(id),
  origin text NOT NULL CHECK (origin IN ('crm','mcp','automation','external','unknown')),
  identity_kind text NOT NULL CHECK (identity_kind IN ('authenticated','declared','unidentified')),
  PRIMARY KEY (entity_table, entity_id)
);
CREATE TABLE public.production_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text UNIQUE NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  lead_id uuid,
  operator_user_id uuid REFERENCES public.production_operators(user_id),
  authorizer_user_id uuid REFERENCES public.user_profiles(id),
  origin text NOT NULL,
  identity_kind text NOT NULL,
  action text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  active boolean NOT NULL DEFAULT true,
  state text,
  scheduled boolean NOT NULL DEFAULT false
);
CREATE INDEX production_activities_period_operator ON public.production_activities(occurred_at, operator_user_id);
CREATE INDEX production_activities_entity ON public.production_activities(entity_table, entity_id);
CREATE INDEX production_activities_lead ON public.production_activities(lead_id, occurred_at);
ALTER TABLE public.production_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_operators_read ON public.production_operators FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY['dashboard','leads','contracts','whatsapp-inbox']));
CREATE POLICY production_settings_read ON public.production_settings FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY['dashboard','leads','contracts','whatsapp-inbox']));
CREATE POLICY production_activities_read ON public.production_activities FOR SELECT TO authenticated
  USING (public.current_user_can_view_any_module(ARRAY['dashboard']));
GRANT SELECT ON public.production_operators, public.production_settings, public.production_activities TO authenticated;
GRANT ALL ON public.production_operators, public.production_settings, public.production_activities TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.production_activities_id_seq TO service_role;

-- Trigger-only privileged writes keep the ledger atomic without giving clients write access.
CREATE FUNCTION production_private.context() RETURNS production_private.attribution
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result production_private.attribution;
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  actor uuid;
BEGIN
  result.origin := 'unknown'; result.identity_kind := 'unidentified';
  IF claims->>'role' = 'service_role' THEN
    IF headers ? 'x-kifer-production-schedule-id' THEN
      SELECT * INTO result FROM production_private.attribution
      WHERE entity_table = CASE WHEN headers->>'x-kifer-production-schedule-kind' = 'sequence'
        THEN 'comm_whatsapp_scheduled_sequences' ELSE 'comm_whatsapp_scheduled_messages' END
        AND entity_id = (headers->>'x-kifer-production-schedule-id')::uuid;
      IF FOUND THEN RETURN result; END IF;
      result.origin := 'unknown'; result.identity_kind := 'unidentified';
      RETURN result;
    END IF;
    actor := nullif(headers->>'x-kifer-production-authorizer','')::uuid;
    IF actor IS NOT NULL THEN
      IF headers->>'x-kifer-production-source' = 'mcp' AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = actor AND role = 'admin'
      ) THEN RAISE EXCEPTION 'MCP authorization required' USING ERRCODE = '42501'; END IF;
      result.operator_user_id := nullif(headers->>'x-kifer-production-operator','')::uuid;
      result.authorizer_user_id := actor;
      result.origin := CASE WHEN headers->>'x-kifer-production-source' = 'mcp' THEN 'mcp' ELSE 'crm' END;
      result.identity_kind := CASE WHEN result.origin = 'mcp' THEN 'declared' ELSE 'authenticated' END;
      IF result.origin = 'crm' AND actor IS DISTINCT FROM result.operator_user_id THEN
        RAISE EXCEPTION 'CRM operator must match authenticated user' USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.production_operators WHERE user_id = result.operator_user_id AND active) THEN
        -- Non-operational CRM users can still work; their work is not credited to an operator.
        IF result.origin = 'mcp' THEN RAISE EXCEPTION 'INVALID_OPERATOR' USING ERRCODE = '22023'; END IF;
        result.operator_user_id := NULL;
      END IF;
    ELSE result.origin := CASE WHEN headers->>'x-kifer-production-source' = 'external' THEN 'external' ELSE 'automation' END; END IF;
  ELSE
    actor := auth.uid();
    result.authorizer_user_id := actor;
    SELECT user_id INTO result.operator_user_id FROM public.production_operators WHERE user_id = actor AND active;
    IF actor IS NOT NULL THEN result.origin := 'crm'; result.identity_kind := 'authenticated'; END IF;
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION production_private.record(
  p_table text, p_id uuid, p_lead uuid, p_action text, p_key text,
  p_context production_private.attribution, p_state text DEFAULT NULL, p_scheduled boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.production_settings WHERE started_at IS NOT NULL AND started_at <= clock_timestamp()) THEN RETURN; END IF;
  INSERT INTO public.production_activities(event_key,entity_table,entity_id,lead_id,operator_user_id,
    authorizer_user_id,origin,identity_kind,action,state,scheduled)
  VALUES(p_key,p_table,p_id,p_lead,p_context.operator_user_id,p_context.authorizer_user_id,
    coalesce(p_context.origin,'unknown'),coalesce(p_context.identity_kind,'unidentified'),p_action,p_state,p_scheduled)
  ON CONFLICT (event_key) DO UPDATE SET state = EXCLUDED.state,
    operator_user_id = coalesce(production_activities.operator_user_id, EXCLUDED.operator_user_id),
    authorizer_user_id = coalesce(production_activities.authorizer_user_id, EXCLUDED.authorizer_user_id),
    origin = CASE WHEN production_activities.operator_user_id IS NULL AND (EXCLUDED.operator_user_id IS NOT NULL OR EXCLUDED.origin='automation') THEN EXCLUDED.origin ELSE production_activities.origin END,
    identity_kind = CASE WHEN production_activities.operator_user_id IS NULL AND EXCLUDED.operator_user_id IS NOT NULL THEN EXCLUDED.identity_kind ELSE production_activities.identity_kind END;
END $$;

CREATE FUNCTION production_private.capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  row_data jsonb := to_jsonb(NEW);
  previous jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  ctx production_private.attribution;
  saved_ctx production_private.attribution;
  entity uuid := (row_data->>'id')::uuid;
  lead uuid := nullif(row_data->>'lead_id','')::uuid;
  kind text;
  previous_order integer;
  next_order integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.production_settings WHERE started_at IS NOT NULL AND started_at <= clock_timestamp()) THEN RETURN NEW; END IF;
  ctx := production_private.context();
  IF TG_TABLE_NAME = 'comm_whatsapp_messages' THEN
    IF row_data->>'direction' <> 'outbound' THEN RETURN NEW; END IF;
    IF TG_OP = 'INSERT' THEN
      IF ctx.origin = 'automation' AND row_data->>'source' IN ('whapi','webhook','sync') THEN ctx.origin := 'external'; END IF;
      IF ctx.origin = 'automation' AND row_data->>'source' IN ('api','mcp','scheduled') THEN ctx.origin := 'unknown'; END IF;
      INSERT INTO production_private.attribution SELECT TG_TABLE_NAME,entity,ctx.operator_user_id,ctx.authorizer_user_id,ctx.origin,ctx.identity_kind
      ON CONFLICT DO NOTHING;
    END IF;
    SELECT * INTO saved_ctx FROM production_private.attribution WHERE entity_table = TG_TABLE_NAME AND entity_id = entity;
    IF row_data->>'delivery_status' IN ('sent','delivered','read','played') THEN
      SELECT lead_id INTO lead FROM public.comm_whatsapp_chats WHERE id = (row_data->>'chat_id')::uuid;
      PERFORM production_private.record(TG_TABLE_NAME,entity,lead,'message_sent','message:'||entity,saved_ctx,row_data->>'delivery_status',row_data->>'source' = 'scheduled');
    END IF;
  ELSIF TG_TABLE_NAME IN ('comm_whatsapp_scheduled_messages','comm_whatsapp_scheduled_sequences') THEN
    IF TG_OP = 'INSERT' THEN
      -- Sequence children inherit the original attribution, never the cron identity.
      IF nullif(row_data->>'sequence_id','') IS NOT NULL THEN
        SELECT * INTO ctx FROM production_private.attribution WHERE entity_table = 'comm_whatsapp_scheduled_sequences' AND entity_id = (row_data->>'sequence_id')::uuid;
      END IF;
      INSERT INTO production_private.attribution SELECT TG_TABLE_NAME,entity,ctx.operator_user_id,ctx.authorizer_user_id,coalesce(ctx.origin,'unknown'),coalesce(ctx.identity_kind,'unidentified') ON CONFLICT DO NOTHING;
      IF nullif(row_data->>'sequence_id','') IS NULL THEN
        PERFORM production_private.record(TG_TABLE_NAME,entity,lead,'schedule_created','schedule:'||entity,ctx,row_data->>'status',true);
      END IF;
    ELSE
      UPDATE public.production_activities SET state = row_data->>'status' WHERE event_key = 'schedule:'||entity;
      IF (row_data - ARRAY['updated_at','ultima_modificacao']) IS DISTINCT FROM (previous - ARRAY['updated_at','ultima_modificacao']) AND ctx.operator_user_id IS NOT NULL THEN
        PERFORM production_private.record(TG_TABLE_NAME,entity,lead,'schedule_updated',TG_TABLE_NAME||':'||entity||':'||txid_current(),ctx,row_data->>'status',true);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'interactions' AND TG_OP = 'INSERT' THEN
    IF ctx.operator_user_id IS NOT NULL THEN
      PERFORM production_private.record(TG_TABLE_NAME,entity,lead,'interaction_created','interaction:'||entity,ctx);
    END IF;
  ELSIF TG_TABLE_NAME = 'reminders' THEN
    IF row_data->>'concluido_em' IS DISTINCT FROM previous->>'concluido_em' THEN
      UPDATE public.production_activities SET active = false WHERE entity_table = TG_TABLE_NAME AND entity_id = entity AND action = 'reminder_completed';
      IF row_data->>'concluido_em' IS NOT NULL AND row_data->>'cancelled_at' IS NULL THEN
        PERFORM production_private.record(TG_TABLE_NAME,entity,lead,'reminder_completed','reminder:'||entity||':'||txid_current(),ctx);
      END IF;
    END IF;
    IF row_data->>'cancelled_at' IS NOT NULL THEN
      UPDATE public.production_activities SET active = false WHERE entity_table = TG_TABLE_NAME AND entity_id = entity AND action = 'reminder_completed';
    END IF;
  ELSIF TG_TABLE_NAME = 'leads' AND TG_OP = 'UPDATE' AND row_data->>'status_id' IS DISTINCT FROM previous->>'status_id' THEN
    SELECT ordem INTO previous_order FROM public.lead_status_config WHERE id = nullif(previous->>'status_id','')::uuid;
    SELECT ordem INTO next_order FROM public.lead_status_config WHERE id = nullif(row_data->>'status_id','')::uuid;
    kind := CASE WHEN row_data->>'status' ~* '(perdid|cancel|recus)' THEN 'stage_lost'
      WHEN next_order > previous_order THEN 'stage_advanced' WHEN next_order < previous_order THEN 'stage_regressed' ELSE 'stage_changed' END;
    PERFORM production_private.record(TG_TABLE_NAME,entity,entity,kind,'stage:'||entity||':'||txid_current(),ctx);
  ELSIF TG_TABLE_NAME = 'contracts' THEN
    IF row_data->>'status' IN ('Emitido','Ativo') AND (TG_OP = 'INSERT' OR previous->>'status' NOT IN ('Emitido','Ativo')) THEN
      SELECT * INTO saved_ctx FROM production_private.attribution WHERE entity_table = TG_TABLE_NAME AND entity_id = entity;
      IF NOT FOUND AND ctx.operator_user_id IS NOT NULL THEN
        IF NEW.sale_operator_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.production_operators WHERE user_id = NEW.sale_operator_user_id AND active) THEN
          RAISE EXCEPTION 'Escolha Nick ou Luiza como responsável pela venda.' USING ERRCODE = '22023';
        END IF;
        saved_ctx := ctx; saved_ctx.operator_user_id := NEW.sale_operator_user_id;
        INSERT INTO production_private.attribution SELECT TG_TABLE_NAME,entity,saved_ctx.operator_user_id,saved_ctx.authorizer_user_id,saved_ctx.origin,saved_ctx.identity_kind;
        PERFORM production_private.record(TG_TABLE_NAME,entity,lead,'sale_closed','sale:'||entity,saved_ctx,row_data->>'status');
      END IF;
    END IF;
    IF row_data->>'status' = 'Cancelado' AND previous->>'status' IS DISTINCT FROM 'Cancelado' THEN
      SELECT * INTO saved_ctx FROM production_private.attribution WHERE entity_table = TG_TABLE_NAME AND entity_id = entity;
      IF FOUND THEN PERFORM production_private.record(TG_TABLE_NAME,entity,lead,'sale_cancelled','sale-cancel:'||entity,saved_ctx,'Cancelado'); END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
ALTER TABLE public.contracts ADD COLUMN sale_operator_user_id uuid REFERENCES public.production_operators(user_id);
CREATE FUNCTION production_private.sale_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE headers jsonb := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
  saved uuid;
BEGIN
  SELECT operator_user_id INTO saved FROM production_private.attribution WHERE entity_table='contracts' AND entity_id=NEW.id;
  IF saved IS NOT NULL THEN NEW.sale_operator_user_id := saved;
  ELSIF claims->>'role' = 'service_role' AND headers->>'x-kifer-production-sale-operator' IS NOT NULL THEN
    NEW.sale_operator_user_id := (headers->>'x-kifer-production-sale-operator')::uuid;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER production_sale_owner BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION production_private.sale_owner();
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['comm_whatsapp_messages','comm_whatsapp_scheduled_messages','comm_whatsapp_scheduled_sequences','interactions','reminders','leads','contracts'] LOOP
    EXECUTE format('CREATE TRIGGER production_capture AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION production_private.capture()',table_name);
  END LOOP;
END $$;

-- Enrollment happens after the existing manage-users flow finalizes the username/role.
CREATE FUNCTION production_private.enroll_operator() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_label text;
BEGIN
  IF NEW.username IN ('nick','luiza.kifer') AND NEW.role='admin' THEN
    v_label := CASE WHEN NEW.username='nick' THEN 'Nick' ELSE 'Luiza' END;
    INSERT INTO public.production_operators(user_id,display_name) VALUES(NEW.id,v_label) ON CONFLICT(user_id) DO NOTHING;
    INSERT INTO public.lead_responsaveis(label,value,ativo,ordem)
    SELECT v_label,v_label,true,coalesce((SELECT max(ordem)+1 FROM public.lead_responsaveis),0)
    WHERE NOT EXISTS (SELECT 1 FROM public.lead_responsaveis r WHERE lower(r.value)=lower(v_label));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER production_enroll_operator AFTER INSERT OR UPDATE OF username,role ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION production_private.enroll_operator();

CREATE FUNCTION public.activate_team_production() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501'; END IF;
  UPDATE public.production_settings SET started_at = coalesce(started_at,clock_timestamp()) RETURNING started_at INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.production_scheduled_operator(p_message_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result uuid;
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service required' USING ERRCODE='42501'; END IF;
  SELECT a.operator_user_id INTO result FROM public.comm_whatsapp_scheduled_messages m
  JOIN production_private.attribution a ON a.entity_id=coalesce(m.sequence_id,m.id)
    AND a.entity_table=CASE WHEN m.sequence_id IS NULL THEN 'comm_whatsapp_scheduled_messages' ELSE 'comm_whatsapp_scheduled_sequences' END
  WHERE m.id=p_message_id;
  RETURN result;
END $$;

CREATE FUNCTION public.production_message_attribution(p_external_message_id text, p_channel_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE message_id uuid; ctx production_private.attribution;
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service required' USING ERRCODE='42501'; END IF;
  ctx := production_private.context();
  IF p_external_message_id IS NULL OR p_external_message_id = '' THEN RETURN NULL; END IF;
  SELECT id INTO message_id FROM public.comm_whatsapp_messages WHERE external_message_id = p_external_message_id AND channel_id = p_channel_id LIMIT 1 FOR UPDATE;
  IF message_id IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_settings WHERE started_at IS NOT NULL) THEN RETURN ctx.operator_user_id; END IF;
  INSERT INTO production_private.attribution SELECT 'comm_whatsapp_messages',message_id,ctx.operator_user_id,ctx.authorizer_user_id,ctx.origin,ctx.identity_kind
  ON CONFLICT(entity_table,entity_id) DO UPDATE SET operator_user_id=EXCLUDED.operator_user_id,authorizer_user_id=EXCLUDED.authorizer_user_id,origin=EXCLUDED.origin,identity_kind=EXCLUDED.identity_kind
  WHERE attribution.operator_user_id IS NULL AND (EXCLUDED.operator_user_id IS NOT NULL OR EXCLUDED.origin='automation');
  -- Re-run capture with authoritative context even when a webhook won the INSERT race.
  UPDATE public.comm_whatsapp_messages SET created_by=coalesce((SELECT a.operator_user_id FROM production_private.attribution a WHERE a.entity_table='comm_whatsapp_messages' AND a.entity_id=message_id),created_by),
    source=CASE WHEN coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb ? 'x-kifer-production-schedule-id' THEN 'scheduled' ELSE source END
  WHERE id=message_id;
  RETURN ctx.operator_user_id;
END $$;

CREATE FUNCTION public.team_production_report(p_start date, p_end date, p_operator uuid DEFAULT NULL, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH events AS (
    SELECT a.* FROM public.production_activities a, public.production_settings s
    WHERE a.occurred_at >= greatest(p_start::timestamp AT TIME ZONE 'America/Sao_Paulo',s.started_at)
      AND a.occurred_at < ((p_end+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND s.started_at IS NOT NULL AND (p_operator IS NULL OR a.operator_user_id=p_operator)
  ), groups AS (
    SELECT o.user_id,o.display_name FROM public.production_operators o WHERE o.active AND (p_operator IS NULL OR o.user_id=p_operator)
    UNION ALL SELECT NULL::uuid,'Equipe'
  ), summaries AS (
    SELECT g.user_id,g.display_name,
      count(DISTINCT e.lead_id) FILTER(WHERE e.active AND e.action IN ('message_sent','interaction_created') AND e.operator_user_id IS NOT NULL) AS clients,
      count(e.id) FILTER(WHERE e.active AND e.action='message_sent' AND e.operator_user_id IS NOT NULL AND NOT e.scheduled) AS messages,
      count(e.id) FILTER(WHERE e.active AND e.action='message_sent' AND e.operator_user_id IS NOT NULL AND e.scheduled) AS scheduled_messages,
      count(e.id) FILTER(WHERE e.action='schedule_created' AND e.operator_user_id IS NOT NULL) AS schedules,
      count(e.id) FILTER(WHERE e.active AND e.action='reminder_completed' AND e.operator_user_id IS NOT NULL) AS reminders,
      count(e.id) FILTER(WHERE e.active AND e.action='stage_advanced' AND e.operator_user_id IS NOT NULL) AS advances,
      count(e.id) FILTER(WHERE e.action='stage_regressed' AND e.operator_user_id IS NOT NULL) AS regressions,
      count(e.id) FILTER(WHERE e.action='stage_lost' AND e.operator_user_id IS NOT NULL) AS losses,
      count(e.id) FILTER(WHERE e.action='sale_closed' AND e.operator_user_id IS NOT NULL) AS sales,
      count(e.id) FILTER(WHERE e.action='sale_cancelled' AND e.operator_user_id IS NOT NULL) AS cancellations
    FROM groups g LEFT JOIN events e ON g.user_id IS NULL OR e.operator_user_id=g.user_id GROUP BY g.user_id,g.display_name
  ) SELECT jsonb_build_object(
    'started_at',(SELECT started_at FROM public.production_settings),
    'operators',coalesce((SELECT jsonb_agg(o ORDER BY display_name) FROM public.production_operators o WHERE active),'[]'),
    'summary',coalesce((SELECT jsonb_agg(s) FROM summaries s),'[]'),
    'unattributed',jsonb_build_object(
      'automation',(SELECT count(*) FROM events WHERE action='message_sent' AND origin='automation'),
      'external',(SELECT count(*) FROM events WHERE action='message_sent' AND origin='external'),
      'unknown',(SELECT count(*) FROM events WHERE action='message_sent' AND operator_user_id IS NULL AND origin NOT IN ('automation','external'))),
    'total_events',(SELECT count(*) FROM events),
    'events',coalesce((SELECT jsonb_agg(d) FROM (SELECT * FROM events ORDER BY occurred_at DESC,id DESC LIMIT 50 OFFSET greatest(p_offset,0)) d),'[]')
  );
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA production_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_scheduled_operator(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.production_scheduled_operator(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.activate_team_production(),public.production_message_attribution(text,uuid),public.team_production_report(date,date,uuid,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.production_message_attribution(text,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.activate_team_production(),public.team_production_report(date,date,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.production_message_attribution(text,uuid),public.team_production_report(date,date,uuid,integer) TO service_role;

COMMIT;
