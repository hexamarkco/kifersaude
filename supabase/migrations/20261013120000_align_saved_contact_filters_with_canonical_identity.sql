BEGIN;

-- The Inbox list now presents the canonical saved-contact name, but its
-- saved/unsaved filters and text search still depended only on an exact
-- phone_digits match. Keep that indexed check for the common path and add
-- the canonical resolver for LID, phone-format and manual-override variants.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_anchor_pos integer;
  v_marker_pos integer;
  v_canonical_filter text := E'             OR NULLIF(btrim(public.comm_whatsapp_preferred_saved_contact_name(\n'
    || E'               c.channel_id,\n'
    || E'               c.id,\n'
    || E'               COALESCE(c.phone_digits, c.phone_number)\n'
    || E'             )), '''') IS NOT NULL';
  v_canonical_unsaved_filter text := E'             AND NULLIF(btrim(public.comm_whatsapp_preferred_saved_contact_name(\n'
    || E'               c.channel_id,\n'
    || E'               c.id,\n'
    || E'               COALESCE(c.phone_digits, c.phone_number)\n'
    || E'             )), '''') IS NULL';
  v_canonical_search text := E'         OR public.comm_whatsapp_preferred_saved_contact_name(\n'
    || E'           c.channel_id,\n'
    || E'           c.id,\n'
    || E'           COALESCE(c.phone_digits, c.phone_number)\n'
    || E'         ) ILIKE ''%'' || input.search_text || ''%''';
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc AS p
  WHERE p.oid = 'public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer)'::regprocedure;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Funcao comm_whatsapp_list_chats/9 nao encontrada.';
  END IF;

  v_updated_definition := v_definition;

  v_anchor_pos := position(E'input.saved_filter = ''saved''' IN v_updated_definition);
  v_marker_pos := position(E'OR EXISTS (' IN substring(v_updated_definition FROM v_anchor_pos FOR 1800));
  IF v_anchor_pos = 0 OR v_marker_pos = 0 THEN
    RAISE EXCEPTION 'Filtro de contatos salvos nao encontrado no Inbox.';
  END IF;
  v_marker_pos := v_anchor_pos + v_marker_pos - 1;
  v_updated_definition := left(v_updated_definition, v_marker_pos - 1)
    || v_canonical_filter || E'\n'
    || substring(v_updated_definition FROM v_marker_pos);

  v_anchor_pos := position(E'input.saved_filter = ''unsaved''' IN v_updated_definition);
  v_marker_pos := position(E'AND NOT EXISTS (' IN substring(v_updated_definition FROM v_anchor_pos FOR 1800));
  IF v_anchor_pos = 0 OR v_marker_pos = 0 THEN
    RAISE EXCEPTION 'Filtro de contatos nao salvos nao encontrado no Inbox.';
  END IF;
  v_marker_pos := v_anchor_pos + v_marker_pos - 1;
  v_updated_definition := left(v_updated_definition, v_marker_pos - 1)
    || v_canonical_unsaved_filter || E'\n'
    || substring(v_updated_definition FROM v_marker_pos);

  v_anchor_pos := position(E'input.search_text IS NULL' IN v_updated_definition);
  v_marker_pos := position(E'OR EXISTS (' IN substring(v_updated_definition FROM v_anchor_pos FOR 2200));
  IF v_anchor_pos = 0 OR v_marker_pos = 0 THEN
    RAISE EXCEPTION 'Busca por contatos salvos nao encontrada no Inbox.';
  END IF;
  v_marker_pos := v_anchor_pos + v_marker_pos - 1;
  v_updated_definition := left(v_updated_definition, v_marker_pos - 1)
    || v_canonical_search || E'\n'
    || substring(v_updated_definition FROM v_marker_pos);

  IF position('public.comm_whatsapp_preferred_saved_contact_name(' IN v_updated_definition) = 0
  THEN
    RAISE EXCEPTION 'Nao foi possivel alinhar os filtros de identidade do Inbox.';
  END IF;

  EXECUTE v_updated_definition;
END;
$migration$;

NOTIFY pgrst, 'reload schema';

COMMIT;
