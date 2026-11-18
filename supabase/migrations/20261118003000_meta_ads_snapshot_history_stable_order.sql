-- Preserve keyset pagination order in JSON history. A subquery ORDER BY does not
-- guarantee the jsonb_agg array order. Keep the previously deployed snapshot
-- shape, admin check, security mode and permissions intact.
BEGIN;
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
    'history',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY (t.id)::bigint DESC) FROM (
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
COMMIT;
