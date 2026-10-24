BEGIN;

ALTER TABLE public.meta_lead_receipts DROP CONSTRAINT meta_lead_receipts_status_check;
ALTER TABLE public.meta_lead_receipts ADD CONSTRAINT meta_lead_receipts_status_check
  CHECK (status IN ('pending','processing','imported','dead','validation_passed'));
ALTER TABLE public.meta_integration_attempts DROP CONSTRAINT meta_integration_attempts_outcome_check;
ALTER TABLE public.meta_integration_attempts ADD CONSTRAINT meta_integration_attempts_outcome_check
  CHECK (outcome IN ('started','success','retry','dead','requeued','validation_passed'));

-- Called only for the exact official Meta test ID pinned in a server secret.
-- No CRM record, attribution, trigger work or pg_net request survives the inner
-- subtransaction. PostgreSQL starts pg_net requests only after commit.
CREATE FUNCTION public.meta_ads_validate_test_import(p_id text,p_lock uuid,p_lead jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_lead uuid; v_attempt integer; v_result jsonb;
BEGIN
  IF p_lead->>'name' IS DISTINCT FROM 'KIFER TESTE DE INTEGRACAO'
    OR p_lead->>'phone' IS DISTINCT FROM '12025550100'
    OR NULLIF(p_lead->>'commercial_answer','') IS NULL THEN
    RAISE EXCEPTION 'INVALID_VALIDATION_CONTACT';
  END IF;
  SELECT attempts INTO v_attempt FROM public.meta_lead_receipts
    WHERE leadgen_id=p_id AND status='processing' AND lock_token=p_lock AND locked_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  BEGIN
    v_lead:=public.meta_ads_import(p_id,p_lock,p_lead);
    IF NOT EXISTS(SELECT 1 FROM public.leads WHERE id=v_lead AND telefone='12025550100')
      OR NOT EXISTS(SELECT 1 FROM public.meta_lead_attributions WHERE leadgen_id=p_id AND lead_id=v_lead AND NOT matched_existing) THEN
      RAISE EXCEPTION 'VALIDATION_IMPORT_FAILED';
    END IF;
    v_result:=jsonb_build_object('canonical_import_validated',true,'crm_record_persisted',false,'outbound_dispatched',false);
    -- Deliberately roll back only the inner transaction, including all triggers.
    RAISE EXCEPTION USING ERRCODE='PZ001',MESSAGE='ROLLBACK_VALIDATION_ONLY';
  EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.leads WHERE id=v_lead)
    OR EXISTS(SELECT 1 FROM public.meta_lead_attributions WHERE leadgen_id=p_id) THEN RAISE EXCEPTION 'VALIDATION_ROLLBACK_FAILED'; END IF;
  UPDATE public.meta_lead_receipts SET status='validation_passed',locked_until=NULL,lock_token=NULL,last_error_code=NULL
    WHERE leadgen_id=p_id AND lock_token=p_lock;
  INSERT INTO public.meta_integration_attempts(direction,entity_id,attempt,outcome)
    VALUES('inbound',p_id,v_attempt,'validation_passed');
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_ads_validate_test_import(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ads_validate_test_import(text,uuid,jsonb) TO service_role;
COMMIT;
