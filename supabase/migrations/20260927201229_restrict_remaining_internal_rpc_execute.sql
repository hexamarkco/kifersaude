BEGIN;

-- Keep the small public API explicit. These routines are used by cron,
-- triggers or service-role workers and must not be callable through PostgREST
-- by anonymous or signed-in users.
REVOKE ALL ON FUNCTION public.ai_lead_is_waiting_for_quote(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_flows_health() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_auto_contact_jobs_on_inbound_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_auto_contact_inactivity_triggers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_lead_created_backlog_triggers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_status_duration_triggers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_logs_7d() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debug_comm_auth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_process_pending_leads() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_web_push_lead() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_web_push_reminder() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preserve_inactivity_flow_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_whatsapp_schedule_with_reminder() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_auto_send_lead_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_lead_processing_now() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_reminders_modified_time() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ai_lead_is_waiting_for_quote(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.automation_flows_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_auto_contact_jobs_on_inbound_message() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_auto_contact_inactivity_triggers() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_lead_created_backlog_triggers() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_status_duration_triggers() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_logs_7d() TO service_role;
GRANT EXECUTE ON FUNCTION public.debug_comm_auth() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_process_pending_leads() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_web_push_lead() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_web_push_reminder() TO service_role;
GRANT EXECUTE ON FUNCTION public.preserve_inactivity_flow_activation() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_whatsapp_schedule_with_reminder() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_auto_send_lead_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_lead_processing_now() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_reminders_modified_time() TO service_role;

-- These functions are part of the authenticated application API, but never
-- need to be exposed to an anonymous client.
REVOKE EXECUTE ON FUNCTION public.create_ai_feature_config(text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ai_feature_config(text, text, jsonb, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_user_access_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_access_role() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_edit_any_module(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_any_module(text[]) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_edit_comm_whatsapp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_comm_whatsapp() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_edit_whatsapp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_whatsapp() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_manage_access_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_access_profiles() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_manage_system_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_system_catalog() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_manage_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_users() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_view_any_module(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_any_module(text[]) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_can_view_comm_whatsapp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_comm_whatsapp() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_is_access_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_access_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_failure_reasons(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_failure_reasons(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_target_status_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_comm_whatsapp_campaign_target_status_counts(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.replace_cotador_produto_rede_hospitalar(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_cotador_produto_rede_hospitalar(uuid, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO authenticated, service_role;

-- Public login and public-link/form counters intentionally remain exposed.

COMMIT;
