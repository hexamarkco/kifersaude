BEGIN;

-- A persistencia interna ja atualiza a identidade uma vez. Em chats normais
-- com telefone, o wrapper repetia o mesmo refresh depois de registrar o
-- identificador e tentar o auto-link, mesmo quando nenhuma dessas etapas
-- alterava a identidade. Chats LID/sem telefone continuam fazendo o refresh
-- final, pois o identificador recém-observado pode revelar o contato salvo.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'comm_whatsapp_persist_message'
    AND p.pronargs = 28;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Funcao comm_whatsapp_persist_message/28 nao encontrada.';
  END IF;

  v_updated_definition := replace(
    v_definition,
    $old$  PERFORM public.comm_whatsapp_refresh_chat_identity(v_canonical_chat_id);$old$,
    $new$  IF v_input_is_lid OR v_phone_number IS NULL THEN
    PERFORM public.comm_whatsapp_refresh_chat_identity(v_canonical_chat_id);
  END IF;$new$
  );

  IF v_updated_definition = v_definition THEN
    RAISE EXCEPTION 'Nao foi possivel localizar o refresh redundante da persistencia de mensagens.';
  END IF;

  EXECUTE v_updated_definition;
END;
$migration$;

NOTIFY pgrst, 'reload schema';

COMMIT;
