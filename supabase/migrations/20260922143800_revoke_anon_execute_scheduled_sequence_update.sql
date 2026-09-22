BEGIN;

REVOKE ALL ON FUNCTION public.update_scheduled_message_sequence(uuid, timestamptz, jsonb, text, boolean)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_scheduled_message_sequence(uuid, timestamptz, jsonb, text, boolean)
  TO authenticated;

COMMIT;
