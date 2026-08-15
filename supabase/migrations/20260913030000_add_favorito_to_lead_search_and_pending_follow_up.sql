/*
  # Inclui favorito nas buscas de lead e follow-ups pendentes do WhatsApp

  comm_whatsapp_search_crm_leads (busca de lead pra iniciar/vincular chat) e
  comm_whatsapp_pending_follow_up_chats (fila do lote de follow-ups) não
  devolviam leads.favorito. Redefine as duas functions pra incluir a coluna,
  permitindo mostrar a estrela de favorito nesses fluxos.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_crm_leads(
  p_query text DEFAULT NULL,
  p_phone_numbers text[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  telefone text,
  status_nome text,
  status_value text,
  responsavel_label text,
  responsavel_value text,
  favorito boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_query_text text := NULLIF(btrim(COALESCE(p_query, '')), '');
  v_query_digits text := NULLIF(regexp_replace(COALESCE(p_query, ''), '\D', '', 'g'), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_phone_keys text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT key), ARRAY[]::text[])
  INTO v_phone_keys
  FROM unnest(COALESCE(p_phone_numbers, ARRAY[]::text[])) AS value
  CROSS JOIN LATERAL unnest(public.comm_whatsapp_phone_lookup_keys(value)) AS key
  WHERE key IS NOT NULL
    AND key <> '';

  IF COALESCE(array_length(v_phone_keys, 1), 0) > 0 THEN
    RETURN QUERY
    SELECT
      l.id,
      l.nome_completo,
      l.telefone,
      l.status AS status_nome,
      l.status AS status_value,
      ro.label AS responsavel_label,
      COALESCE(ro.value, '') AS responsavel_value,
      l.favorito
    FROM public.leads l
    LEFT JOIN public.lead_responsaveis ro
      ON ro.id = l.responsavel_id
    WHERE COALESCE(l.arquivado, false) = false
      AND public.comm_whatsapp_phone_lookup_keys(l.telefone) && v_phone_keys
      AND (
        v_query_text IS NULL
        OR COALESCE(l.nome_completo, '') ILIKE '%' || v_query_text || '%'
        OR COALESCE(l.telefone, '') ILIKE '%' || v_query_text || '%'
        OR (
          v_query_digits IS NOT NULL
          AND regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g') LIKE '%' || v_query_digits || '%'
        )
      )
    ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
    LIMIT v_limit;

    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.nome_completo,
    l.telefone,
    l.status AS status_nome,
    l.status AS status_value,
    ro.label AS responsavel_label,
    COALESCE(ro.value, '') AS responsavel_value,
    l.favorito
  FROM public.leads l
  LEFT JOIN public.lead_responsaveis ro
    ON ro.id = l.responsavel_id
  WHERE COALESCE(l.arquivado, false) = false
    AND (
      v_query_text IS NULL
      OR COALESCE(l.nome_completo, '') ILIKE '%' || v_query_text || '%'
      OR COALESCE(l.telefone, '') ILIKE '%' || v_query_text || '%'
      OR (
        v_query_digits IS NOT NULL
        AND regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g') LIKE '%' || v_query_digits || '%'
      )
    )
  ORDER BY COALESCE(l.updated_at, l.created_at, l.data_criacao) DESC NULLS LAST, l.id DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_search_crm_leads(text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_search_crm_leads(text, text[], integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_pending_follow_up_chats()
RETURNS TABLE(
  chat_id uuid,
  external_chat_id text,
  lead_id uuid,
  lead_name text,
  lead_phone text,
  reminder_id uuid,
  reminder_title text,
  reminder_due_at timestamptz,
  reminder_priority text,
  last_message_at timestamptz,
  last_message_text text,
  lead_favorito boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    chat.id,
    chat.external_chat_id,
    lead.id,
    lead.nome_completo,
    lead.telefone,
    reminder.id,
    reminder.titulo,
    reminder.data_lembrete,
    reminder.prioridade,
    chat.last_message_at,
    chat.last_message_text,
    lead.favorito
  FROM public.reminders AS reminder
  JOIN public.leads AS lead
    ON lead.id = reminder.lead_id
   AND COALESCE(lead.arquivado, false) = false
  JOIN LATERAL (
    SELECT candidate.*
    FROM public.comm_whatsapp_chats AS candidate
    WHERE candidate.lead_id = lead.id
      AND candidate.deleted_at IS NULL
      AND candidate.merged_into_chat_id IS NULL
    ORDER BY
      CASE
        WHEN candidate.external_chat_id = public.normalize_comm_whatsapp_chat_id(
          COALESCE(lead.telefone, candidate.external_chat_id)
        ) THEN 0
        ELSE 1
      END,
      CASE
        WHEN candidate.external_chat_id = public.normalize_comm_whatsapp_chat_id(candidate.external_chat_id) THEN 0
        ELSE 1
      END,
      CASE WHEN NULLIF(btrim(COALESCE(candidate.external_chat_id, '')), '') IS NULL THEN 1 ELSE 0 END,
      candidate.last_message_at DESC NULLS LAST,
      candidate.updated_at DESC NULLS LAST,
      candidate.id ASC
    LIMIT 1
  ) AS chat ON true
  WHERE COALESCE(reminder.lido, false) = false
    AND reminder.tipo = 'Follow-up'
    AND reminder.data_lembrete <= now()
  ORDER BY reminder.prioridade DESC, reminder.data_lembrete ASC, lead.nome_completo ASC;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_pending_follow_up_chats() TO authenticated;

COMMIT;
