BEGIN;

-- Identity refresh was passing only phone_digits to the canonical resolver.
-- Chats created with phone_number populated but phone_digits empty could lose
-- the saved name when a provider update triggered a refresh.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_old_call text := E'    v_chat.phone_digits\n  );';
  v_new_call text := E'    COALESCE(v_chat.phone_digits, v_chat.phone_number)\n  );';
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc AS p
  WHERE p.oid = 'public.comm_whatsapp_refresh_chat_identity(uuid)'::regprocedure;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Funcao comm_whatsapp_refresh_chat_identity nao encontrada.';
  END IF;

  v_updated_definition := replace(v_definition, v_old_call, v_new_call);

  IF v_updated_definition = v_definition THEN
    IF position('COALESCE(v_chat.phone_digits, v_chat.phone_number)' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Fallback de telefone nao encontrado em comm_whatsapp_refresh_chat_identity.';
    END IF;
  ELSE
    EXECUTE v_updated_definition;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';

COMMIT;
