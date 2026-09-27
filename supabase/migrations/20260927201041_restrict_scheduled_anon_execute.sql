BEGIN;

-- These RPCs are used by the authenticated Inbox/agenda. A historical
-- explicit anon grant survived REVOKE ... FROM PUBLIC, so remove it directly
-- while preserving the operator and worker roles.
REVOKE EXECUTE ON FUNCTION public.cancel_scheduled_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_message(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.schedule_follow_up_reminder(uuid, text, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_follow_up_reminder(uuid, text, text, timestamptz, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.schedule_follow_up_reminder_v2(uuid, text, text, timestamptz, text, uuid, uuid, text, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_follow_up_reminder_v2(uuid, text, text, timestamptz, text, uuid, uuid, text, uuid, timestamptz) TO authenticated, service_role;

COMMIT;
