-- Remove all legacy WhatsApp artefacts from the database
DROP VIEW IF EXISTS public.whatsapp_scheduled_messages_period_summary;
DROP VIEW IF EXISTS public.whatsapp_chat_sla_snapshot;

DROP TABLE IF EXISTS public.whatsapp_chat_sla_alerts CASCADE;
DROP TABLE IF EXISTS public.whatsapp_chat_sla_metrics CASCADE;
DROP TABLE IF EXISTS public.whatsapp_scheduled_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_campaign_targets CASCADE;
DROP TABLE IF EXISTS public.whatsapp_campaign_steps CASCADE;
DROP TABLE IF EXISTS public.whatsapp_campaigns CASCADE;
DROP TABLE IF EXISTS public.whatsapp_quick_replies CASCADE;
DROP TABLE IF EXISTS public.whatsapp_contact_photos CASCADE;
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_chats CASCADE;

DELETE FROM storage.buckets WHERE id IN ('whatsapp-chat-photos', 'whatsapp-temp-audio');
DELETE FROM lead_origens WHERE lower(nome) = 'whatsapp';
