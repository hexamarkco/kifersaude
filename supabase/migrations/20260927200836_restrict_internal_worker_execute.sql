BEGIN;

-- These functions are called by cron/Edge Function workers with service_role.
-- They do not belong to the browser-facing API. Keeping EXECUTE for
-- authenticated users would expose lock, dispatch and internal state
-- transitions through PostgREST without adding any operator capability.
REVOKE ALL ON FUNCTION public.advance_step_dispatch(text, text, text, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_future_pending_dispatches(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_ai_autonomous_reply_delivery_key(text, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_comm_whatsapp_enrichment_jobs(integer, text, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_comm_whatsapp_event_receipts(interval, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_comm_whatsapp_webhook_archive(interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_autonomous_attendance_handoff(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_apply_pending_message_mutations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_apply_pending_message_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_clear_unread_on_outbound_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_seed_delivery_status_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_sync_chat_last_message_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dispatch_web_push_event(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_comm_whatsapp_message_enrichment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_comm_whatsapp_campaign_worker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_comm_whatsapp_enrichment_worker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_ai_autonomous_reply_delivery_key_sent(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_ai_autonomous_attendance_reply(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_autonomous_attendance_event(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_comm_whatsapp_identity_after_lead_name_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ai_autonomous_reply_lock(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_pending_stage_dispatches(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(uuid, uuid, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(uuid, uuid, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_acquire_ai_autonomous_reply_lock(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_ai_autonomous_qualification_state(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.advance_step_dispatch(text, text, text, text, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_future_pending_dispatches(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_ai_autonomous_reply_delivery_key(text, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_comm_whatsapp_enrichment_jobs(integer, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_comm_whatsapp_event_receipts(interval, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_comm_whatsapp_webhook_archive(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_autonomous_attendance_handoff(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_apply_pending_message_mutations() TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_apply_pending_message_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_clear_unread_on_outbound_message() TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_preserve_saved_contact_display_name() TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_uuid(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_seed_delivery_status_history() TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_sync_chat_last_message_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_web_push_event(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_comm_whatsapp_message_enrichment() TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_comm_whatsapp_campaign_worker() TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_comm_whatsapp_enrichment_worker() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_ai_autonomous_reply_delivery_key_sent(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_ai_autonomous_attendance_reply(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_ai_autonomous_attendance_event(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_comm_whatsapp_identity_after_lead_name_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_autonomous_reply_lock(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pending_stage_dispatches(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_dispatch(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch(uuid, uuid, text, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_comm_whatsapp_campaign_stage_dispatch_retry(uuid, uuid, text, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_ai_autonomous_reply_lock(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_ai_autonomous_qualification_state(uuid, uuid, jsonb) TO service_role;

COMMIT;
