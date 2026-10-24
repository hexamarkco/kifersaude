BEGIN;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='meta_ads_worker_secret') THEN
    PERFORM vault.create_secret(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
      'meta_ads_worker_secret','Autenticação restrita ao processamento Meta Ads');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.invoke_meta_ads_worker()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_secret text; v_request bigint;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.integration_settings WHERE slug='facebook_ads_manager' AND settings->>'enabled'='true') THEN
    RETURN NULL;
  END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='meta_ads_worker_secret';
  IF v_secret IS NULL OR v_secret !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'META_WORKER_SECRET_MISSING'; END IF;
  SELECT net.http_post(
    url:='https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/meta-ads-worker',
    headers:=jsonb_build_object('Content-Type','application/json','x-meta-worker-secret',v_secret),
    body:='{}'::jsonb,timeout_milliseconds:=140000
  ) INTO v_request;
  RETURN v_request;
END;
$$;
REVOKE ALL ON FUNCTION private.invoke_meta_ads_worker() FROM PUBLIC,anon,authenticated,service_role;
-- The cron is intentionally activated separately, after provisioning the same
-- dedicated secret in the Edge runtime. No service-role key is stored in cron.
COMMIT;
