BEGIN;

DO $$
DECLARE
  v_function_sql text;
BEGIN
  SELECT pg_get_functiondef('public.comm_whatsapp_persist_message(uuid,text,text,text,text,text,text,timestamp with time zone,boolean,text,text,text,text,text,uuid,text,text,text,timestamp with time zone,text,jsonb,text,text,text,text,bigint,integer,text)'::regprocedure)
  INTO v_function_sql;

  v_function_sql := replace(
    v_function_sql,
    'v_summary_text text := public.comm_whatsapp_message_preview_text(p_media_caption, COALESCE(p_text_content, p_last_message_text), v_message_type);',
    'v_summary_text text := public.comm_whatsapp_message_preview_text(p_media_caption, p_text_content, v_message_type);'
  );

  EXECUTE v_function_sql;
END;
$$;

WITH latest_visible AS (
  SELECT DISTINCT ON (m.chat_id)
    m.chat_id,
    public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) AS preview_text,
    m.direction,
    m.message_at
  FROM public.comm_whatsapp_messages m
  WHERE public.comm_whatsapp_message_preview_text(m.media_caption, m.text_content, m.message_type) IS NOT NULL
  ORDER BY m.chat_id, m.message_at DESC, m.created_at DESC, m.id DESC
)
UPDATE public.comm_whatsapp_chats c
SET
  last_message_text = lv.preview_text,
  last_message_direction = lv.direction,
  last_message_at = lv.message_at,
  updated_at = now()
FROM latest_visible lv
WHERE lv.chat_id = c.id
  AND (
    c.last_message_text IS DISTINCT FROM lv.preview_text
    OR c.last_message_direction IS DISTINCT FROM lv.direction
    OR c.last_message_at IS DISTINCT FROM lv.message_at
  );

COMMIT;
