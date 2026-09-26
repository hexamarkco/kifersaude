BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.comm_whatsapp_refresh_chat_identities_for_phones(
  p_channel_id uuid,
  p_phone_digits text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat record;
  v_count integer := 0;
  v_phone_digits text[];
BEGIN
  SELECT COALESCE(
    array_agg(DISTINCT NULLIF(btrim(phone.value), '') ORDER BY NULLIF(btrim(phone.value), '')),
    ARRAY[]::text[]
  )
  INTO v_phone_digits
  FROM unnest(COALESCE(p_phone_digits, ARRAY[]::text[])) AS phone(value)
  WHERE NULLIF(btrim(phone.value), '') IS NOT NULL;

  IF cardinality(v_phone_digits) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_chat IN
    SELECT chat.id
    FROM public.comm_whatsapp_chats chat
    WHERE chat.channel_id = p_channel_id
      AND chat.merged_into_chat_id IS NULL
      AND chat.phone_digits = ANY(v_phone_digits)
  LOOP
    PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_refresh_chat_identities_for_phones(uuid, text[]) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_refresh_chat_identities_for_phones(uuid, text[]) TO service_role;

COMMIT;
