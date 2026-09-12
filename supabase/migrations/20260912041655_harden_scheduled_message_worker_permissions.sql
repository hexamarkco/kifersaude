BEGIN;

REVOKE ALL ON FUNCTION public.poll_scheduled_messages(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_scheduled_message(uuid, text, text, text, text, timestamptz) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_scheduled_messages_worker() FROM anon, authenticated;

COMMIT;
