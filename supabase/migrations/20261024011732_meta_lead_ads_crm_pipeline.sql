BEGIN;

-- Reuse the installed integration. Only non-secret, explicitly supported keys
-- survive; the old browser-readable credentials must be rotated before rollout.
UPDATE public.integration_settings
SET settings = jsonb_build_object(
  'enabled', false, 'pageId', '547836751743652', 'formId', '2050340295676923',
  'adAccountId', 'act_9519030184783024',
  'defaultOrigem', COALESCE(settings->>'defaultOrigem', 'tráfego pago'),
  'defaultResponsavel', COALESCE(settings->>'defaultResponsavel', 'Luiza'),
  'commercialField', '', 'unconfirmedOrigem', 'Meta — origem não confirmada'
), updated_at = now()
WHERE slug = 'facebook_ads_manager';

INSERT INTO public.lead_origens(nome,ativo) VALUES('Meta — origem não confirmada',true) ON CONFLICT (nome) DO NOTHING;

CREATE FUNCTION public.meta_ads_validate_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.slug = 'facebook_ads_manager' AND (
    jsonb_typeof(NEW.settings) <> 'object' OR
    NEW.settings - ARRAY['enabled','pageId','formId','adAccountId','defaultOrigem','defaultResponsavel','commercialField','unconfirmedOrigem'] <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'Meta credentials and delivery approvals belong in Edge Secrets';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER meta_ads_validate_settings BEFORE INSERT OR UPDATE ON public.integration_settings
FOR EACH ROW EXECUTE FUNCTION public.meta_ads_validate_settings();

CREATE TABLE public.meta_lead_receipts (
  leadgen_id text PRIMARY KEY CHECK (leadgen_id ~ '^[0-9]{1,32}$'),
  page_id text NOT NULL, form_id text NOT NULL, ad_id text,
  meta_created_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','imported','dead')),
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz, lock_token uuid, last_error_code text,
  imported_at timestamptz, lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT
);
CREATE INDEX meta_lead_receipts_due ON public.meta_lead_receipts(next_attempt_at, received_at)
WHERE status IN ('pending','processing');

CREATE TABLE public.meta_lead_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leadgen_id text NOT NULL UNIQUE REFERENCES public.meta_lead_receipts(leadgen_id),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  page_id text NOT NULL, form_id text NOT NULL, ad_id text,
  campaign_id text, campaign_name text, adset_id text, adset_name text, ad_name text,
  commercial_answer text CHECK (length(commercial_answer) <= 500),
  traffic_type text NOT NULL CHECK (traffic_type IN ('paid','organic','unknown')),
  meta_created_at timestamptz NOT NULL, received_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  matched_existing boolean NOT NULL
);
CREATE INDEX meta_lead_attributions_lead ON public.meta_lead_attributions(lead_id);

CREATE TABLE public.meta_commercial_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.meta_lead_attributions(id),
  actor_id uuid NOT NULL,
  criteria_version text NOT NULL DEFAULT 'pme-mei-v1',
  eligible_business boolean NOT NULL, lives integer NOT NULL CHECK (lives BETWEEN 1 AND 100000),
  region_served boolean NOT NULL, interest_confirmed boolean NOT NULL,
  qualified boolean NOT NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE RESTRICT,
  contract_completed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qualified = (eligible_business AND lives >= 2 AND region_served AND interest_confirmed)),
  CHECK (NOT contract_completed OR contract_id IS NOT NULL)
);
CREATE INDEX meta_reviews_attribution ON public.meta_commercial_reviews(attribution_id, reviewed_at DESC);

CREATE TABLE public.meta_conversion_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.meta_lead_attributions(id),
  review_id uuid NOT NULL REFERENCES public.meta_commercial_reviews(id),
  kind text NOT NULL CHECK (kind IN ('qualified_lead','contract_completed')),
  subject_key text NOT NULL, occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','pending','processing','sent','dead')),
  dataset_id text, event_name text, approval_reference text,
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz, lock_token uuid, last_error_code text, sent_at timestamptz,
  UNIQUE (attribution_id, kind, subject_key)
);
CREATE INDEX meta_conversion_events_due ON public.meta_conversion_events(next_attempt_at)
WHERE status IN ('pending','processing');
CREATE UNIQUE INDEX meta_conversion_contract_once ON public.meta_conversion_events(subject_key) WHERE kind='contract_completed';

-- Attempts contain only operational codes: no Graph payload, names, phones,
-- answers, arbitrary exception messages or credentials.
CREATE TABLE public.meta_integration_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  entity_id text NOT NULL, attempt integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('started','success','retry','dead','requeued')),
  error_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_integration_attempts_recent ON public.meta_integration_attempts(created_at DESC);

ALTER TABLE public.meta_lead_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_lead_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_commercial_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_integration_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_lead_receipts, public.meta_lead_attributions,
  public.meta_commercial_reviews, public.meta_conversion_events, public.meta_integration_attempts
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.meta_lead_receipts, public.meta_lead_attributions,
  public.meta_commercial_reviews, public.meta_conversion_events, public.meta_integration_attempts TO service_role;
GRANT USAGE ON SEQUENCE public.meta_integration_attempts_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_comm_whatsapp_phone(text) TO service_role;

CREATE FUNCTION public.meta_ads_enqueue(p_receipts jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_settings jsonb; v_count integer;
BEGIN
  SELECT settings INTO STRICT v_settings FROM public.integration_settings WHERE slug = 'facebook_ads_manager';
  IF v_settings->>'enabled' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'META_PAUSED'; END IF;
  IF jsonb_typeof(p_receipts) <> 'array' OR jsonb_array_length(p_receipts) > 100 THEN
    RAISE EXCEPTION 'INVALID_BATCH';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_receipts) r
    WHERE r->>'page_id' IS DISTINCT FROM v_settings->>'pageId'
       OR r->>'form_id' IS DISTINCT FROM v_settings->>'formId') THEN RAISE EXCEPTION 'ORIGIN_MISMATCH'; END IF;
  INSERT INTO public.meta_lead_receipts(leadgen_id,page_id,form_id,ad_id,meta_created_at)
  SELECT r->>'leadgen_id', r->>'page_id', r->>'form_id', r->>'ad_id', (r->>'meta_created_at')::timestamptz
  FROM jsonb_array_elements(p_receipts) r ON CONFLICT (leadgen_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.meta_ads_claim(p_direction text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_receipt public.meta_lead_receipts; v_event public.meta_conversion_events;
BEGIN
  IF p_direction = 'inbound' THEN
    SELECT * INTO v_receipt FROM public.meta_lead_receipts
    WHERE (status = 'pending' AND next_attempt_at <= now()) OR (status = 'processing' AND locked_until < now())
    ORDER BY next_attempt_at, received_at FOR UPDATE SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF v_receipt.attempts >= 8 THEN
      UPDATE public.meta_lead_receipts SET status='dead', last_error_code='ATTEMPTS_EXHAUSTED' WHERE leadgen_id=v_receipt.leadgen_id;
      INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome,error_code)
      VALUES('inbound',v_receipt.leadgen_id,v_receipt.attempts,'dead','ATTEMPTS_EXHAUSTED');
      RETURN NULL;
    END IF;
    UPDATE public.meta_lead_receipts SET status='processing', attempts=attempts+1,
      lock_token=gen_random_uuid(), locked_until=now()+interval '2 minutes'
      WHERE leadgen_id=v_receipt.leadgen_id RETURNING * INTO v_receipt;
    INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome)
    VALUES ('inbound',v_receipt.leadgen_id,v_receipt.attempts,'started');
    RETURN to_jsonb(v_receipt);
  ELSIF p_direction = 'outbound' THEN
    SELECT * INTO v_event FROM public.meta_conversion_events
    WHERE (status = 'pending' AND next_attempt_at <= now()) OR (status = 'processing' AND locked_until < now())
    ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF v_event.attempts >= 8 THEN
      UPDATE public.meta_conversion_events SET status='dead', last_error_code='ATTEMPTS_EXHAUSTED' WHERE event_id=v_event.event_id;
      INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome,error_code)
      VALUES('outbound',v_event.event_id::text,v_event.attempts,'dead','ATTEMPTS_EXHAUSTED');
      RETURN NULL;
    END IF;
    UPDATE public.meta_conversion_events SET status='processing', attempts=attempts+1,
      lock_token=gen_random_uuid(), locked_until=now()+interval '2 minutes'
      WHERE event_id=v_event.event_id RETURNING * INTO v_event;
    INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome)
    VALUES ('outbound',v_event.event_id::text,v_event.attempts,'started');
    RETURN to_jsonb(v_event) || (SELECT jsonb_build_object('leadgen_id',a.leadgen_id,'meta_created_at',a.meta_created_at)
      FROM public.meta_lead_attributions a WHERE a.id=v_event.attribution_id);
  END IF;
  RAISE EXCEPTION 'INVALID_DIRECTION';
END;
$$;

-- Same canonical INSERT as the lead form/public submission: configured FKs,
-- default status and the existing lead_created trigger/flow engine. No direct
-- Whapi call or second lead table. Linking an existing contact never updates it.
CREATE FUNCTION public.meta_ads_import(p_id text, p_lock uuid, p_lead jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_receipt public.meta_lead_receipts; v_lead uuid; v_matches uuid[]; v_settings jsonb;
  v_origin uuid; v_responsible uuid; v_status public.lead_status_config; v_phone text;
  v_existing boolean;
BEGIN
  SELECT * INTO STRICT v_receipt FROM public.meta_lead_receipts WHERE leadgen_id=p_id FOR UPDATE;
  IF v_receipt.status='imported' THEN RETURN v_receipt.lead_id; END IF;
  IF v_receipt.status<>'processing' OR v_receipt.lock_token IS DISTINCT FROM p_lock OR v_receipt.locked_until < now() THEN
    RAISE EXCEPTION 'LEASE_LOST';
  END IF;
  SELECT settings INTO STRICT v_settings FROM public.integration_settings WHERE slug='facebook_ads_manager';
  IF v_settings->>'enabled' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'META_PAUSED'; END IF;
  IF v_receipt.page_id IS DISTINCT FROM v_settings->>'pageId' OR v_receipt.form_id IS DISTINCT FROM v_settings->>'formId' THEN
    RAISE EXCEPTION 'ORIGIN_MISMATCH';
  END IF;
  v_phone := p_lead->>'phone';
  IF v_phone IS NULL OR v_phone !~ '^[0-9]{10,15}$' OR length(btrim(COALESCE(p_lead->>'name',''))) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'MISSING_CONTACT_FIELDS';
  END IF;
  -- Serialize this integration's imports for the same canonical endpoint.
  PERFORM pg_advisory_xact_lock(hashtextextended('meta-phone:' || v_phone, 0));
  SELECT array_agg(id) INTO v_matches FROM public.leads
  WHERE CASE WHEN btrim(telefone) LIKE '+%' THEN regexp_replace(telefone,'\D','','g')
    ELSE public.normalize_comm_whatsapp_phone(telefone) END = v_phone
    OR regexp_replace(telefone,'\D','','g') = v_phone;
  IF cardinality(v_matches)>1 THEN RAISE EXCEPTION 'AMBIGUOUS_CONTACT'; END IF;
  v_lead := v_matches[1]; v_existing := v_lead IS NOT NULL;
  IF v_lead IS NULL THEN
    SELECT id INTO v_origin FROM public.lead_origens WHERE ativo AND nome=CASE
      WHEN p_lead->>'traffic_type'='paid' THEN v_settings->>'defaultOrigem' ELSE v_settings->>'unconfirmedOrigem' END;
    SELECT id INTO v_responsible FROM public.lead_responsaveis WHERE ativo
      AND (label=v_settings->>'defaultResponsavel' OR value=v_settings->>'defaultResponsavel') ORDER BY id LIMIT 1;
    SELECT * INTO v_status FROM public.lead_status_config WHERE ativo AND padrao ORDER BY ordem,id LIMIT 1;
    IF v_origin IS NULL OR v_responsible IS NULL OR v_status.id IS NULL THEN RAISE EXCEPTION 'LEAD_DEFAULTS_MISSING'; END IF;
    INSERT INTO public.leads(nome_completo,telefone,origem_id,responsavel_id,status_id,status,data_criacao,arquivado,skip_automation)
    VALUES(p_lead->>'name',v_phone,v_origin,v_responsible,v_status.id,v_status.nome,now(),false,false) RETURNING id INTO v_lead;
  END IF;
  INSERT INTO public.meta_lead_attributions(leadgen_id,lead_id,page_id,form_id,ad_id,meta_created_at,received_at,
    campaign_id,campaign_name,adset_id,adset_name,ad_name,commercial_answer,matched_existing,traffic_type)
  VALUES(p_id,v_lead,v_receipt.page_id,v_receipt.form_id,COALESCE(v_receipt.ad_id,p_lead->>'ad_id'),v_receipt.meta_created_at,v_receipt.received_at,
    p_lead->>'campaign_id',p_lead->>'campaign_name',p_lead->>'adset_id',p_lead->>'adset_name',p_lead->>'ad_name',p_lead->>'commercial_answer',v_existing,p_lead->>'traffic_type');
  UPDATE public.meta_lead_receipts SET status='imported',lead_id=v_lead,imported_at=now(),locked_until=NULL,
    last_error_code=NULL WHERE leadgen_id=p_id;
  INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome) VALUES('inbound',p_id,v_receipt.attempts,'success');
  RETURN v_lead;
END;
$$;

CREATE FUNCTION public.meta_ads_finish(p_direction text,p_id text,p_lock uuid,p_error text DEFAULT NULL,p_retry_seconds integer DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_attempt integer; v_status text;
BEGIN
  IF p_error IS NOT NULL AND p_error !~ '^[A-Z_]{1,64}$' THEN RAISE EXCEPTION 'INVALID_ERROR_CODE'; END IF;
  v_status := CASE WHEN p_error IS NULL THEN 'sent' WHEN p_retry_seconds IS NOT NULL THEN 'pending' ELSE 'dead' END;
  IF p_direction='inbound' AND p_error IS NOT NULL THEN
    UPDATE public.meta_lead_receipts SET status=v_status,last_error_code=p_error,locked_until=NULL,
      next_attempt_at=now()+make_interval(secs=>least(21630,greatest(30,COALESCE(p_retry_seconds,30))))
    WHERE leadgen_id=p_id AND status='processing' AND lock_token=p_lock RETURNING attempts INTO v_attempt;
  ELSIF p_direction='outbound' THEN
    UPDATE public.meta_conversion_events SET status=v_status,last_error_code=p_error,locked_until=NULL,
      sent_at=CASE WHEN p_error IS NULL THEN now() ELSE NULL END,
      next_attempt_at=now()+make_interval(secs=>least(21630,greatest(30,COALESCE(p_retry_seconds,30))))
    WHERE event_id::text=p_id AND status='processing' AND lock_token=p_lock RETURNING attempts INTO v_attempt;
  ELSE RAISE EXCEPTION 'INVALID_FINISH'; END IF;
  IF v_attempt IS NULL THEN RETURN false; END IF;
  INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome,error_code)
  VALUES(p_direction,p_id,v_attempt,CASE WHEN p_error IS NULL THEN 'success' WHEN p_retry_seconds IS NULL THEN 'dead' ELSE 'retry' END,p_error);
  RETURN true;
END;
$$;

-- Narrow service-only administrative APIs revalidate the human actor in the DB.
-- Definer access is needed for opportunity tables which deny service_role access.
CREATE FUNCTION public.meta_ads_review(p_actor uuid,p_attribution uuid,p_eligible boolean,p_lives integer,p_region boolean,
  p_interest boolean,p_opportunity uuid DEFAULT NULL,p_contract uuid DEFAULT NULL,p_completed boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_attr public.meta_lead_attributions; v_review uuid; v_qualified boolean;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO STRICT v_attr FROM public.meta_lead_attributions WHERE id=p_attribution FOR UPDATE;
  IF p_opportunity IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.opportunity_leads
    WHERE opportunity_id=p_opportunity AND lead_id=v_attr.lead_id AND removed_at IS NULL) THEN RAISE EXCEPTION 'OPPORTUNITY_MISMATCH'; END IF;
  IF p_contract IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contracts
    WHERE id=p_contract AND lead_id=v_attr.lead_id AND created_at>=v_attr.meta_created_at) THEN RAISE EXCEPTION 'CONTRACT_MISMATCH'; END IF;
  v_qualified := p_eligible AND p_lives>=2 AND p_region AND p_interest;
  INSERT INTO public.meta_commercial_reviews(attribution_id,actor_id,eligible_business,lives,region_served,interest_confirmed,
    qualified,opportunity_id,contract_id,contract_completed)
  VALUES(p_attribution,p_actor,p_eligible,p_lives,p_region,p_interest,v_qualified,p_opportunity,p_contract,p_completed) RETURNING id INTO v_review;
  IF v_qualified AND v_attr.traffic_type='paid' THEN
    INSERT INTO public.meta_conversion_events(attribution_id,review_id,kind,subject_key,occurred_at)
    VALUES(p_attribution,v_review,'qualified_lead','qualification',now()) ON CONFLICT DO NOTHING;
  ELSE
    -- An updated decision invalidates unsent qualification; history is retained.
    UPDATE public.meta_conversion_events SET status='dead', last_error_code='QUALIFICATION_REVOKED'
    WHERE attribution_id=p_attribution AND kind='qualified_lead' AND status IN ('held','pending');
  END IF;
  IF p_completed AND v_attr.traffic_type='paid' THEN
    IF EXISTS(SELECT 1 FROM public.meta_conversion_events WHERE kind='contract_completed' AND subject_key=p_contract::text
      AND attribution_id<>p_attribution) THEN RAISE EXCEPTION 'CONTRACT_ALREADY_ATTRIBUTED'; END IF;
    INSERT INTO public.meta_conversion_events(attribution_id,review_id,kind,subject_key,occurred_at)
    VALUES(p_attribution,v_review,'contract_completed',p_contract::text,now()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_review;
END;
$$;

-- Explicit release only, no cron or UI switch enables CAPI. Each destination,
-- event mapping and authorization reference is frozen before the first attempt.
CREATE FUNCTION public.meta_ads_release(p_ids uuid[],p_dataset text,p_qualified_event text,p_contract_event text,p_approval text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
  IF COALESCE(p_dataset,'') !~ '^[0-9]{1,32}$' OR COALESCE(p_qualified_event,'') !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
    OR COALESCE(p_contract_event,'') !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$' OR p_qualified_event=p_contract_event
    OR length(btrim(COALESCE(p_approval,''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'APPROVAL_REQUIRED'; END IF;
  UPDATE public.meta_conversion_events e SET status='pending',dataset_id=p_dataset,next_attempt_at=now(),last_error_code=NULL,
    event_name=CASE WHEN kind='qualified_lead' THEN p_qualified_event ELSE p_contract_event END,approval_reference=p_approval
  WHERE event_id=ANY(p_ids) AND status='held' AND occurred_at>now()-interval '7 days'
    AND (dataset_id IS NULL OR (dataset_id=p_dataset AND event_name=CASE WHEN kind='qualified_lead' THEN p_qualified_event ELSE p_contract_event END
      AND approval_reference=p_approval))
    AND occurred_at<=now() AND EXISTS(SELECT 1 FROM public.meta_lead_attributions a WHERE a.id=e.attribution_id AND a.meta_created_at<=e.occurred_at);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.meta_ads_requeue(p_actor uuid,p_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_attempt integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.meta_lead_receipts SET status='pending',attempts=0,next_attempt_at=now(),locked_until=NULL,lock_token=NULL
  WHERE leadgen_id=p_id AND status='dead' RETURNING attempts INTO v_attempt;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome) VALUES('inbound',p_id,v_attempt,'requeued');
  RETURN true;
END;
$$;

CREATE FUNCTION public.meta_ads_validate_event(p_id uuid,p_lock uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_event public.meta_conversion_events; v_attr public.meta_lead_attributions;
BEGIN
  SELECT * INTO v_event FROM public.meta_conversion_events WHERE event_id=p_id AND lock_token=p_lock
    AND status='processing' AND locked_until>now();
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO STRICT v_attr FROM public.meta_lead_attributions WHERE id=v_event.attribution_id;
  IF v_attr.traffic_type<>'paid' THEN RETURN false; END IF;
  IF v_event.kind='qualified_lead' THEN
    RETURN COALESCE((SELECT qualified FROM public.meta_commercial_reviews WHERE attribution_id=v_attr.id ORDER BY reviewed_at DESC,id DESC LIMIT 1),false);
  END IF;
  RETURN EXISTS(SELECT 1 FROM public.contracts c JOIN public.meta_commercial_reviews r ON r.id=v_event.review_id
    WHERE c.id=r.contract_id AND c.id::text=v_event.subject_key AND c.lead_id=v_attr.lead_id
      AND c.created_at>=v_attr.meta_created_at AND r.contract_completed);
END;
$$;

CREATE FUNCTION public.meta_ads_requeue_event(p_actor uuid,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_attempt integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  -- Manual reconciliation preserves event identity, business time, destination
  -- and approval. Retrying never fabricates a fresh event to bypass the deadline.
  UPDATE public.meta_conversion_events SET status='held',attempts=0,locked_until=NULL,lock_token=NULL
  WHERE event_id=p_id AND status='dead' AND last_error_code NOT IN ('QUALIFICATION_REVOKED','COMMERCIAL_SIGNAL_REVOKED')
    AND occurred_at>now()-interval '7 days' RETURNING attempts INTO v_attempt;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome) VALUES('outbound',p_id::text,v_attempt,'requeued');
  RETURN true;
END;
$$;

CREATE FUNCTION public.meta_ads_reconcile()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
  WITH expired AS (
    SELECT event_id FROM public.meta_conversion_events
    WHERE status IN ('held','pending','processing') AND occurred_at<=now()-interval '7 days'
    ORDER BY occurred_at FOR UPDATE SKIP LOCKED LIMIT 500
  ), changed AS (
    UPDATE public.meta_conversion_events e SET status='dead',last_error_code='EVENT_TIME_INVALID',locked_until=NULL,lock_token=NULL
    FROM expired x WHERE e.event_id=x.event_id RETURNING e.event_id,e.attempts
  )
  INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome,error_code)
  SELECT 'outbound',event_id::text,attempts,'dead','EVENT_TIME_INVALID' FROM changed;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.meta_ads_snapshot(p_actor uuid,p_search text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object(
    'settings',(SELECT settings FROM public.integration_settings WHERE slug='facebook_ads_manager'),
    'received',(SELECT count(*) FROM public.meta_lead_receipts),
    'imported',(SELECT count(*) FROM public.meta_lead_receipts WHERE status='imported'),
    'pending',(SELECT count(*) FROM public.meta_lead_receipts WHERE status IN ('pending','processing')),
    'failed',(SELECT count(*) FROM public.meta_lead_receipts WHERE status='dead'),
    'eventsHeld',(SELECT count(*) FROM public.meta_conversion_events WHERE status='held'),
    'eventsPending',(SELECT count(*) FROM public.meta_conversion_events WHERE status IN ('pending','processing')),
    'eventsFailed',(SELECT count(*) FROM public.meta_conversion_events WHERE status='dead'),
    'events',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT event_id,kind,status,occurred_at,last_error_code FROM public.meta_conversion_events WHERE status='dead' ORDER BY occurred_at DESC LIMIT 50) t),'[]'::jsonb),
    'lastReceivedAt',(SELECT max(received_at) FROM public.meta_lead_receipts),
    'lastImportedAt',(SELECT max(imported_at) FROM public.meta_lead_receipts),
    'receipts',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT leadgen_id,status,received_at,last_error_code FROM public.meta_lead_receipts WHERE status='dead' ORDER BY received_at DESC LIMIT 50) t),'[]'::jsonb),
    'history',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT id::text,direction,entity_id,attempt,outcome,error_code,created_at FROM public.meta_integration_attempts ORDER BY id DESC LIMIT 50) t),'[]'::jsonb),
    'attributions',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT a.id,a.lead_id,(SELECT nome_completo FROM public.leads WHERE id=a.lead_id) AS lead_name,
        a.leadgen_id,a.campaign_id,a.campaign_name,a.adset_id,a.adset_name,a.ad_id,a.ad_name,a.form_id,
        a.meta_created_at,a.received_at,a.matched_existing,a.commercial_answer,a.traffic_type,
        (SELECT to_jsonb(r) FROM public.meta_commercial_reviews r WHERE r.attribution_id=a.id ORDER BY r.reviewed_at DESC LIMIT 1) AS latest_review,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'label',c.codigo_contrato)) FROM public.contracts c
          WHERE c.lead_id=a.lead_id AND c.created_at>=a.meta_created_at),'[]'::jsonb) AS contracts,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'label',o.name,'status',o.status))
          FROM public.opportunities o JOIN public.opportunity_leads ol ON ol.opportunity_id=o.id
          WHERE ol.lead_id=a.lead_id AND ol.removed_at IS NULL AND NOT o.archived),'[]'::jsonb) AS opportunities
      FROM public.meta_lead_attributions a WHERE NULLIF(btrim(p_search),'') IS NULL OR a.leadgen_id=btrim(p_search)
        OR EXISTS(SELECT 1 FROM public.leads l WHERE l.id=a.lead_id AND l.nome_completo ILIKE '%' || left(p_search,100) || '%')
      ORDER BY a.imported_at DESC LIMIT 50) t),'[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.meta_ads_history(p_actor uuid,p_before bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT id::text,direction,entity_id,attempt,outcome,error_code,created_at FROM public.meta_integration_attempts
    WHERE id<p_before ORDER BY id DESC LIMIT 50) t),'[]'::jsonb);
END;
$$;

-- No anonymous/user RPC access, including default PostgreSQL PUBLIC execute.
REVOKE ALL ON FUNCTION public.meta_ads_validate_settings() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_enqueue(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_claim(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_import(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_finish(text,text,uuid,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_review(uuid,uuid,boolean,integer,boolean,boolean,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_release(uuid[],text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_requeue(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_snapshot(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_history(uuid,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_validate_event(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_requeue_event(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.meta_ads_reconcile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ads_enqueue(jsonb),public.meta_ads_claim(text),public.meta_ads_import(text,uuid,jsonb),
  public.meta_ads_finish(text,text,uuid,text,integer),public.meta_ads_review(uuid,uuid,boolean,integer,boolean,boolean,uuid,uuid,boolean),
  public.meta_ads_release(uuid[],text,text,text,text),public.meta_ads_requeue(uuid,text),public.meta_ads_snapshot(uuid,text),public.meta_ads_history(uuid,bigint),
  public.meta_ads_validate_event(uuid,uuid),public.meta_ads_requeue_event(uuid,uuid),public.meta_ads_reconcile() TO service_role;
COMMIT;
