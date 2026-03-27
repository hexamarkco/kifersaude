BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_comm_whatsapp_event_receipts(
  p_retention interval DEFAULT interval '7 days',
  p_batch_limit integer DEFAULT 10000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer := 0;
BEGIN
  DELETE FROM public.comm_whatsapp_event_receipts
  WHERE id IN (
    SELECT id
    FROM public.comm_whatsapp_event_receipts
    WHERE received_at < now() - COALESCE(p_retention, interval '7 days')
    ORDER BY received_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_batch_limit, 10000), 1), 50000)
  );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_comm_whatsapp_event_receipts(interval, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_comm_whatsapp_event_receipts(interval, integer) TO service_role;

DO $scheduler$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'pg_cron extension unavailable, skipping comm_whatsapp_event_receipts scheduler setup.';
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-comm-whatsapp-event-receipts-daily') THEN
      PERFORM cron.unschedule('cleanup-comm-whatsapp-event-receipts-daily');
    END IF;

    PERFORM cron.schedule(
      'cleanup-comm-whatsapp-event-receipts-daily',
      '17 3 * * *',
      $job$SELECT public.cleanup_comm_whatsapp_event_receipts();$job$
    );
  END IF;
END $scheduler$;

COMMIT;
