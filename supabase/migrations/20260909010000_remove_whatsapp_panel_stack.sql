/*
  # Remove WhatsApp panel and campaign stack

  Preserves only the WhatsApp integration used by automations.
  Removes inbox, campaigns, sync/webhook storage, quick replies, and related infra.
*/

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-whatsapp-contact-photos-daily') THEN
      PERFORM cron.unschedule('sync-whatsapp-contact-photos-daily');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-whatsapp-group-names') THEN
      PERFORM cron.unschedule('sync-whatsapp-group-names');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-broadcast-campaigns') THEN
      PERFORM cron.unschedule('process-whatsapp-broadcast-campaigns');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-campaign-imports') THEN
      PERFORM cron.unschedule('process-whatsapp-campaign-imports');
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_chats, public.whatsapp_messages;
    EXCEPTION
      WHEN undefined_object OR undefined_table THEN
        NULL;
    END;
  END IF;
END $$;

DROP POLICY IF EXISTS "Public can view WhatsApp campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload WhatsApp campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view WhatsApp campaign imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload WhatsApp campaign imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update WhatsApp campaign imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete WhatsApp campaign imports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view WhatsApp webhook archive" ON storage.objects;

DELETE FROM storage.objects
WHERE bucket_id IN (
  'whatsapp-contact-photos',
  'whatsapp-campaign-media',
  'whatsapp-webhook-archive',
  'whatsapp-campaign-imports'
);

DELETE FROM storage.buckets
WHERE id IN (
  'whatsapp-contact-photos',
  'whatsapp-campaign-media',
  'whatsapp-webhook-archive',
  'whatsapp-campaign-imports'
);

DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'update_whatsapp_groups_updated_at',
        'update_whatsapp_group_participants_updated_at',
        'log_message_change',
        'get_whatsapp_unread_counts',
        'mark_whatsapp_chat_read',
        'advance_whatsapp_chat_read_cursor',
        'enforce_whatsapp_group_chat_name',
        'set_whatsapp_quick_replies_updated_at',
        'set_whatsapp_campaigns_updated_at',
        'set_whatsapp_campaign_targets_updated_at',
        'current_user_can_edit_whatsapp',
        'normalize_whatsapp_campaign_phone',
        'storage_whatsapp_campaign_phone',
        'create_whatsapp_campaign_atomic',
        'cancel_whatsapp_campaign_atomic',
        'recompute_whatsapp_campaign_counters',
        'resolve_whatsapp_campaign_filter_leads',
        'preview_whatsapp_campaign_audience',
        'search_whatsapp_inbox_leads',
        'list_whatsapp_campaign_canais',
        'set_whatsapp_campaign_import_jobs_updated_at',
        'create_whatsapp_campaign_csv_import_atomic',
        'append_whatsapp_campaign_csv_targets_batch'
      ])
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_args
    );
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.idx_leads_whatsapp_campaign_status_id;
DROP INDEX IF EXISTS public.idx_leads_whatsapp_campaign_origem_id;
DROP INDEX IF EXISTS public.idx_leads_whatsapp_campaign_responsavel_id;
DROP INDEX IF EXISTS public.idx_leads_whatsapp_campaign_canal;
DROP INDEX IF EXISTS public.idx_leads_whatsapp_campaign_phone_rank;

DROP TABLE IF EXISTS public.whatsapp_campaign_import_jobs CASCADE;
DROP TABLE IF EXISTS public.whatsapp_chat_read_cursors CASCADE;
DROP TABLE IF EXISTS public.whatsapp_campaign_targets CASCADE;
DROP TABLE IF EXISTS public.whatsapp_campaigns CASCADE;
DROP TABLE IF EXISTS public.whatsapp_quick_replies CASCADE;
DROP TABLE IF EXISTS public.whatsapp_message_reads CASCADE;
DROP TABLE IF EXISTS public.whatsapp_message_history CASCADE;
DROP TABLE IF EXISTS public.whatsapp_group_events CASCADE;
DROP TABLE IF EXISTS public.whatsapp_group_participants CASCADE;
DROP TABLE IF EXISTS public.whatsapp_groups CASCADE;
DROP TABLE IF EXISTS public.whatsapp_contact_photos CASCADE;
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_chats CASCADE;
DROP TABLE IF EXISTS public.whatsapp_webhook_events CASCADE;
