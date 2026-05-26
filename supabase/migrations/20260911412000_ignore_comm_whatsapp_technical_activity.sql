BEGIN;

DO $$
DECLARE
  v_function_sql text;
BEGIN
  SELECT pg_get_functiondef('public.comm_whatsapp_persist_message(uuid,text,text,text,text,text,text,timestamp with time zone,boolean,text,text,text,text,text,uuid,text,text,text,timestamp with time zone,text,jsonb,text,text,text,text,bigint,integer,text)'::regprocedure)
  INTO v_function_sql;

  v_function_sql := replace(
    v_function_sql,
    'WHEN COALESCE(p_increment_unread, false) AND v_inserted THEN public.comm_whatsapp_chats.unread_count + 1',
    'WHEN COALESCE(p_increment_unread, false) AND v_inserted AND v_has_visible_summary THEN public.comm_whatsapp_chats.unread_count + 1'
  );

  v_function_sql := replace(
    v_function_sql,
    'WHEN v_inserted AND NOT public.comm_whatsapp_chats.is_muted THEN',
    'WHEN v_inserted AND v_has_visible_summary AND NOT public.comm_whatsapp_chats.is_muted THEN'
  );

  EXECUTE v_function_sql;
END;
$$;

COMMIT;
