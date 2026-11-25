CREATE OR REPLACE FUNCTION public.meta_ads_validate_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.slug = 'facebook_ads_manager' AND (
    jsonb_typeof(NEW.settings) <> 'object' OR
    NEW.settings - ARRAY['enabled','pageId','formId','adAccountId','defaultOrigem','defaultResponsavel','commercialField','unconfirmedOrigem','forms'] <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'Meta credentials and delivery approvals belong in Edge Secrets';
  END IF;
  IF NEW.slug = 'facebook_ads_manager' AND NEW.settings ? 'forms' THEN
    IF jsonb_typeof(NEW.settings->'forms') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'INVALID_FORM_MAPPING';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(NEW.settings->'forms') f WHERE
      f.key !~ '^[0-9]{1,32}$' OR jsonb_typeof(f.value) <> 'string'
      OR length(f.value #>> '{}') NOT BETWEEN 1 AND 200
      OR btrim(f.value #>> '{}') <> (f.value #>> '{}')
      OR f.key = NEW.settings->>'formId') THEN
      RAISE EXCEPTION 'INVALID_FORM_MAPPING';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.meta_ads_enqueue(p_receipts jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_settings jsonb; v_count integer;
BEGIN
  SELECT settings INTO STRICT v_settings FROM public.integration_settings WHERE slug = 'facebook_ads_manager';
  IF v_settings->>'enabled' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'META_PAUSED'; END IF;
  IF jsonb_typeof(p_receipts) <> 'array' OR jsonb_array_length(p_receipts) > 100 THEN
    RAISE EXCEPTION 'INVALID_BATCH';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_receipts) r
    WHERE r->>'page_id' IS DISTINCT FROM v_settings->>'pageId'
       OR (r->>'form_id' IS DISTINCT FROM v_settings->>'formId' AND NOT COALESCE((v_settings->'forms') ? (r->>'form_id'),false))) THEN RAISE EXCEPTION 'ORIGIN_MISMATCH'; END IF;
  INSERT INTO public.meta_lead_receipts(leadgen_id,page_id,form_id,ad_id,meta_created_at)
  SELECT r->>'leadgen_id', r->>'page_id', r->>'form_id', r->>'ad_id', (r->>'meta_created_at')::timestamptz
  FROM jsonb_array_elements(p_receipts) r ON CONFLICT (leadgen_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.meta_ads_import(p_id text, p_lock uuid, p_lead jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF v_receipt.page_id IS DISTINCT FROM v_settings->>'pageId' OR (v_receipt.form_id IS DISTINCT FROM v_settings->>'formId' AND NOT COALESCE((v_settings->'forms') ? v_receipt.form_id,false)) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.meta_ads_save_form(p_actor uuid, p_form_id text, p_field text, p_expected_field text)
RETURNS boolean LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $$
DECLARE v_settings jsonb; v_current text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_form_id IS NULL OR p_form_id !~ '^[0-9]{1,32}$' OR p_field IS NULL OR length(p_field) NOT BETWEEN 1 AND 200 OR btrim(p_field) <> p_field THEN RAISE EXCEPTION 'INVALID_FORM_MAPPING'; END IF;
  SELECT settings INTO STRICT v_settings FROM public.integration_settings WHERE slug='facebook_ads_manager' FOR UPDATE;
  IF p_form_id = v_settings->>'formId' THEN
    v_current := v_settings->>'commercialField';
  ELSE
    v_current := v_settings->'forms'->>p_form_id;
  END IF;
  IF v_current IS DISTINCT FROM p_expected_field THEN RETURN false; END IF;
  IF p_form_id = v_settings->>'formId' THEN
    v_settings := jsonb_set(v_settings,'{commercialField}',to_jsonb(p_field));
  ELSE
    v_settings := jsonb_set(v_settings,'{forms}',COALESCE(v_settings->'forms','{}'::jsonb) || jsonb_build_object(p_form_id,p_field));
  END IF;
  UPDATE public.integration_settings SET settings=v_settings,updated_at=now() WHERE slug='facebook_ads_manager';
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_ads_save_form(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ads_save_form(uuid,text,text,text) TO service_role;

UPDATE public.integration_settings SET settings=jsonb_set(settings,'{forms}',COALESCE(settings->'forms','{}'::jsonb) || jsonb_build_object('1683135126631039','possui_cnpj_mei')),updated_at=now() WHERE slug='facebook_ads_manager' AND settings->>'formId'='2050340295676923' AND NOT COALESCE((settings->'forms') ? '1683135126631039',false);
