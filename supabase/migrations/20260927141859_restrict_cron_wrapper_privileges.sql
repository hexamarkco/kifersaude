BEGIN;

REVOKE ALL ON FUNCTION public.comm_whatsapp_invoke_auto_contact_flow_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comm_whatsapp_invoke_ai_autonomous_reply_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_invoke_auto_contact_flow_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_invoke_ai_autonomous_reply_jobs() TO service_role;

COMMIT;
