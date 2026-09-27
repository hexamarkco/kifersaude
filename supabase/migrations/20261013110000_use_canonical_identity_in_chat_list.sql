BEGIN;

-- The Inbox list used to resolve saved contacts with a local lateral join that
-- only matched the exact phone_digits value. The thread and identity refresh
-- already use comm_whatsapp_preferred_saved_contact_name(), which also knows
-- manual overrides, Brazilian phone variants and chat identifiers. Keeping a
-- second resolver here allowed an old provider name to reappear briefly in the
-- list even when the canonical chat identity was already correct.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_projection_start integer;
  v_projection_end integer;
  v_join_start integer;
  v_join_end integer;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc AS p
  WHERE p.oid = 'public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer)'::regprocedure;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Funcao comm_whatsapp_list_chats/9 nao encontrada.';
  END IF;

  v_projection_start := position(E'    COALESCE(\n      CASE WHEN saved_contact.is_manual' IN v_definition);
  v_projection_end := position(E'    c.push_name,' IN v_definition);
  IF v_projection_start = 0 OR v_projection_end <= v_projection_start THEN
    RAISE EXCEPTION 'Projecao de identidade do Inbox nao encontrada em comm_whatsapp_list_chats.';
  END IF;

  v_updated_definition :=
    left(v_definition, v_projection_start - 1)
    || E'    COALESCE(\n'
    || E'      saved_contact.display_name,\n'
    || E'      NULLIF(btrim(c.saved_contact_name), \'\'),\n'
    || E'      NULLIF(btrim(c.resolved_lead_name), \'\'),\n'
    || E'      c.display_name\n'
    || E'    ) AS display_name,\n'
    || E'    saved_contact.display_name AS saved_contact_name,\n'
    || substring(v_definition FROM v_projection_end);

  v_join_start := position(E'  LEFT JOIN LATERAL (' IN v_updated_definition);
  v_join_end := position(E'  LEFT JOIN page_delivery pd' IN v_updated_definition);
  IF v_join_start = 0 OR v_join_end <= v_join_start THEN
    RAISE EXCEPTION 'Consulta de contato salvo do Inbox nao encontrada em comm_whatsapp_list_chats.';
  END IF;

  v_updated_definition :=
    left(v_updated_definition, v_join_start - 1)
    || E'  LEFT JOIN LATERAL (\n'
    || E'    SELECT public.comm_whatsapp_preferred_saved_contact_name(\n'
    || E'      c.channel_id,\n'
    || E'      c.id,\n'
    || E'      COALESCE(c.phone_digits, c.phone_number)\n'
    || E'    ) AS display_name\n'
    || E'  ) AS saved_contact ON true\n'
    || substring(v_updated_definition FROM v_join_end);

  IF position('public.comm_whatsapp_preferred_saved_contact_name(' IN v_updated_definition) = 0
    OR position('saved_contact.is_manual' IN v_updated_definition) > 0
  THEN
    RAISE EXCEPTION 'Nao foi possivel alinhar o Inbox ao resolvedor canonico de identidade.';
  END IF;

  EXECUTE v_updated_definition;
END;
$migration$;

NOTIFY pgrst, 'reload schema';

COMMIT;
