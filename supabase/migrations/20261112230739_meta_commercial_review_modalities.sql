-- Preserve historical PME/MEI reviews and the legacy RPC. New reviews explicitly
-- describe the product modality and can record a sale before contract entry.
ALTER TABLE public.meta_commercial_reviews
  ADD COLUMN contracting_modality text,
  ADD COLUMN eligibility_confirmed boolean,
  ADD COLUMN sale_closed boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT meta_reviews_modality_valid CHECK (
    contracting_modality IS NULL OR contracting_modality IN ('individual', 'business', 'collective_membership')
  ),
  ADD CONSTRAINT meta_reviews_completed_sale CHECK (
    criteria_version <> 'all-modalities-v2' OR NOT contract_completed OR sale_closed
  );

ALTER TABLE public.meta_commercial_reviews DROP CONSTRAINT meta_commercial_reviews_check;
ALTER TABLE public.meta_commercial_reviews ADD CONSTRAINT meta_reviews_qualification_by_criteria CHECK (
  CASE WHEN criteria_version = 'all-modalities-v2' THEN
    contracting_modality IS NOT NULL AND eligibility_confirmed IS NOT NULL
    AND qualified = (eligibility_confirmed AND lives >= 1 AND region_served AND interest_confirmed)
    AND eligible_business = (contracting_modality = 'business' AND eligibility_confirmed)
  ELSE qualified = (eligible_business AND lives >= 2 AND region_served AND interest_confirmed) END
);

-- Only definer RPCs below may use this lookup. A shared negotiation permits the
-- operator to select a beneficiary's contract; it never infers a sale by itself.
CREATE FUNCTION public.meta_ads_contract_is_related(
  p_lead uuid, p_received_at timestamptz, p_contract uuid, p_opportunity uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = p_contract AND c.created_at >= p_received_at AND (
      c.lead_id = p_lead OR EXISTS (
        SELECT 1 FROM public.opportunities o
        JOIN public.opportunity_leads contact ON contact.opportunity_id = o.id
          AND contact.lead_id = p_lead AND contact.removed_at IS NULL
        JOIN public.opportunity_leads beneficiary ON beneficiary.opportunity_id = o.id
          AND beneficiary.lead_id = c.lead_id AND beneficiary.removed_at IS NULL
        WHERE o.id = p_opportunity AND NOT o.archived
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.meta_ads_contract_is_related(uuid,timestamptz,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meta_ads_review_v2(
  p_actor uuid, p_attribution uuid, p_modality text, p_eligibility boolean,
  p_lives integer, p_region boolean, p_interest boolean, p_sale_closed boolean,
  p_opportunity uuid DEFAULT NULL, p_contract uuid DEFAULT NULL, p_completed boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_attr public.meta_lead_attributions;
  v_review uuid;
  v_qualified boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_actor AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_modality IS NULL OR p_modality NOT IN ('individual', 'business', 'collective_membership')
    OR p_lives IS NULL OR p_lives NOT BETWEEN 1 AND 100000
    OR p_eligibility IS NULL OR p_region IS NULL OR p_interest IS NULL OR p_sale_closed IS NULL OR p_completed IS NULL THEN
    RAISE EXCEPTION 'INVALID_REVIEW';
  END IF;
  IF p_completed AND (NOT p_sale_closed OR p_contract IS NULL) THEN RAISE EXCEPTION 'CONTRACT_CONFIRMATION_REQUIRED'; END IF;
  SELECT * INTO STRICT v_attr FROM public.meta_lead_attributions WHERE id = p_attribution FOR UPDATE;
  IF p_opportunity IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.opportunities o JOIN public.opportunity_leads ol ON ol.opportunity_id = o.id
    WHERE o.id = p_opportunity AND NOT o.archived AND ol.lead_id = v_attr.lead_id AND ol.removed_at IS NULL
  ) THEN RAISE EXCEPTION 'OPPORTUNITY_MISMATCH'; END IF;
  IF p_contract IS NOT NULL AND NOT public.meta_ads_contract_is_related(v_attr.lead_id, v_attr.meta_created_at, p_contract, p_opportunity) THEN
    RAISE EXCEPTION 'CONTRACT_MISMATCH';
  END IF;
  -- Product-specific minimums and eligibility are confirmed by the operator;
  -- neither the contact's company nor a blanket two-life threshold is assumed.
  v_qualified := p_eligibility AND p_lives >= 1 AND p_region AND p_interest;
  INSERT INTO public.meta_commercial_reviews (
    attribution_id, actor_id, criteria_version, contracting_modality, eligibility_confirmed,
    eligible_business, lives, region_served, interest_confirmed, qualified,
    opportunity_id, contract_id, sale_closed, contract_completed, reviewed_at
  ) VALUES (
    p_attribution, p_actor, 'all-modalities-v2', p_modality, p_eligibility,
    p_modality = 'business' AND p_eligibility, p_lives, p_region, p_interest, v_qualified,
    p_opportunity, p_contract, p_sale_closed, p_completed, clock_timestamp()
  ) RETURNING id INTO v_review;

  IF v_qualified AND v_attr.traffic_type = 'paid' THEN
    INSERT INTO public.meta_conversion_events(attribution_id,review_id,kind,subject_key,occurred_at)
    VALUES(p_attribution,v_review,'qualified_lead','qualification',now()) ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.meta_conversion_events SET status='dead',last_error_code='QUALIFICATION_REVOKED'
    WHERE attribution_id=p_attribution AND kind='qualified_lead' AND status IN ('held','pending');
  END IF;
  -- Closing the sale with contract entry pending prepares no conversion event.
  -- Only explicit confirmation of an actual related contract can do that.
  IF p_completed AND v_attr.traffic_type = 'paid' THEN
    IF EXISTS (SELECT 1 FROM public.meta_conversion_events WHERE kind='contract_completed'
      AND subject_key=p_contract::text AND attribution_id<>p_attribution) THEN RAISE EXCEPTION 'CONTRACT_ALREADY_ATTRIBUTED'; END IF;
    INSERT INTO public.meta_conversion_events(attribution_id,review_id,kind,subject_key,occurred_at)
    VALUES(p_attribution,v_review,'contract_completed',p_contract::text,now()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_review;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_ads_review_v2(uuid,uuid,text,boolean,integer,boolean,boolean,boolean,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ads_review_v2(uuid,uuid,text,boolean,integer,boolean,boolean,boolean,uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_ads_validate_event(p_id uuid,p_lock uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
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
  RETURN EXISTS (
    SELECT 1 FROM public.meta_commercial_reviews r WHERE r.id=v_event.review_id AND r.contract_completed
      AND r.contract_id::text=v_event.subject_key
      AND public.meta_ads_contract_is_related(v_attr.lead_id,v_attr.meta_created_at,r.contract_id,r.opportunity_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.meta_ads_validate_event(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ads_validate_event(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_ads_snapshot(p_actor uuid,p_search text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
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
        (SELECT to_jsonb(r) FROM public.meta_commercial_reviews r WHERE r.attribution_id=a.id ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1) AS latest_review,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id',c.id,'label',c.codigo_contrato,'lead_id',c.lead_id,'lead_name',c.lead_name,'opportunity_ids',c.opportunity_ids
        ) ORDER BY c.id) FROM (
          SELECT contract.id,contract.codigo_contrato,contract.lead_id,owner.nome_completo AS lead_name,
            ARRAY(SELECT DISTINCT o.id FROM public.opportunities o
              JOIN public.opportunity_leads contact ON contact.opportunity_id=o.id AND contact.lead_id=a.lead_id AND contact.removed_at IS NULL
              JOIN public.opportunity_leads beneficiary ON beneficiary.opportunity_id=o.id AND beneficiary.lead_id=contract.lead_id AND beneficiary.removed_at IS NULL
              WHERE NOT o.archived) AS opportunity_ids
          FROM public.contracts contract LEFT JOIN public.leads owner ON owner.id=contract.lead_id
          WHERE contract.created_at>=a.meta_created_at
            AND (contract.lead_id=a.lead_id OR contract.lead_id IN (
              SELECT beneficiary.lead_id FROM public.opportunity_leads contact
              JOIN public.opportunities o ON o.id=contact.opportunity_id AND NOT o.archived
              JOIN public.opportunity_leads beneficiary ON beneficiary.opportunity_id=o.id AND beneficiary.removed_at IS NULL
              WHERE contact.lead_id=a.lead_id AND contact.removed_at IS NULL
            ))
        ) c WHERE c.lead_id=a.lead_id OR cardinality(c.opportunity_ids)>0),'[]'::jsonb) AS contracts,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'label',o.name,'status',o.status))
          FROM public.opportunities o JOIN public.opportunity_leads ol ON ol.opportunity_id=o.id
          WHERE ol.lead_id=a.lead_id AND ol.removed_at IS NULL AND NOT o.archived),'[]'::jsonb) AS opportunities
      FROM public.meta_lead_attributions a WHERE NULLIF(btrim(p_search),'') IS NULL OR a.leadgen_id=btrim(p_search)
        OR EXISTS(SELECT 1 FROM public.leads l WHERE l.id=a.lead_id AND l.nome_completo ILIKE '%' || left(p_search,100) || '%')
      ORDER BY a.imported_at DESC LIMIT 50) t),'[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.meta_ads_snapshot(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ads_snapshot(uuid,text) TO service_role;
