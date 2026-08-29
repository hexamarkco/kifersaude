-- comm_whatsapp_get_dashboard_metrics quebrava com "column reference
-- last_message_delivery_status is ambiguous". Causa: a subconsulta de
-- recent_chats fazia `c.*` (que hoje ja inclui a coluna real
-- comm_whatsapp_chats.last_message_delivery_status, adicionada em
-- 20260913130000_add_comm_whatsapp_chat_last_message_status_sync.sql) e
-- AINDA recalculava o mesmo valor via LATERAL JOIN em
-- comm_whatsapp_messages, apelidado com o mesmo nome. O resultado tinha
-- duas colunas "last_message_delivery_status" em `ranked`, e a referencia
-- externa `ranked.last_message_delivery_status` ficava ambigua.
--
-- Igual ja foi feito em comm_whatsapp_list_chats
-- (20260913300000_use_chat_last_message_status_column_in_list_chats.sql),
-- esta migration passa a ler a coluna real do chat direto, removendo o
-- LATERAL JOIN redundante.

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_dashboard_metrics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH permission AS (
    SELECT public.current_user_can_view_comm_whatsapp() AS ok
  ),
  channel AS (
    SELECT
      c.id,
      c.name,
      c.enabled,
      c.connection_status,
      c.health_status,
      c.phone_number,
      c.connected_user_name,
      c.last_health_check_at,
      c.last_webhook_received_at,
      c.last_error,
      c.updated_at
    FROM public.comm_whatsapp_channels c
    WHERE c.slug = 'primary'
      AND EXISTS (SELECT 1 FROM permission WHERE ok)
    LIMIT 1
  ),
  chats AS (
    SELECT c.*
    FROM public.comm_whatsapp_chats c
    INNER JOIN channel ch ON ch.id = c.channel_id
    WHERE c.deleted_at IS NULL
      AND c.merged_into_chat_id IS NULL
  ),
  -- Janela de 24h: bounded por message_at, usa o índice (chat_id, message_at DESC, ...).
  recent_messages AS (
    SELECT m.direction, m.delivery_status
    FROM public.comm_whatsapp_messages m
    INNER JOIN chats c ON c.id = m.chat_id
    WHERE m.message_at >= now() - interval '24 hours'
  ),
  -- Sem recorte de tempo por design (mensagem pendente há dias precisa continuar
  -- visível); mantido rápido pelo índice parcial idx_comm_whatsapp_messages_pending_outbound.
  pending_outbound_messages AS (
    SELECT m.id
    FROM public.comm_whatsapp_messages m
    INNER JOIN chats c ON c.id = m.chat_id
    WHERE m.direction = 'outbound'
      AND lower(m.delivery_status) IN ('pending', 'queued', 'sending')
  ),
  chat_metrics AS (
    SELECT
      COUNT(*) AS total_chats,
      COUNT(*) FILTER (WHERE NOT COALESCE(is_archived, false)) AS active_chats,
      COUNT(*) FILTER (WHERE COALESCE(is_archived, false)) AS archived_chats,
      COUNT(*) FILTER (WHERE COALESCE(unread_count, 0) > 0 OR COALESCE(manual_unread, false)) AS unread_chats,
      COALESCE(SUM(GREATEST(COALESCE(unread_count, 0), 0)), 0) AS unread_messages,
      COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS linked_lead_chats,
      COUNT(*) FILTER (WHERE lead_id IS NULL AND NOT COALESCE(is_archived, false)) AS active_unlinked_chats,
      COUNT(*) FILTER (WHERE COALESCE(is_pinned, false)) AS pinned_chats,
      COUNT(*) FILTER (WHERE COALESCE(is_muted, false)) AS muted_chats,
      COUNT(*) FILTER (
        WHERE (COALESCE(unread_count, 0) > 0 OR COALESCE(manual_unread, false))
          AND last_message_at < now() - interval '2 hours'
      ) AS stale_unread_chats,
      MIN(last_message_at) FILTER (WHERE COALESCE(unread_count, 0) > 0 OR COALESCE(manual_unread, false)) AS oldest_unread_at,
      MAX(last_message_at) FILTER (WHERE last_message_direction = 'inbound') AS last_inbound_at,
      MAX(last_message_at) FILTER (WHERE last_message_direction = 'outbound') AS last_outbound_at
    FROM chats
  ),
  message_metrics AS (
    SELECT
      COUNT(*) AS messages_24h,
      COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound_24h,
      COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound_24h,
      COUNT(*) FILTER (WHERE direction = 'outbound' AND lower(delivery_status) IN ('failed', 'error')) AS failed_outbound_24h
    FROM recent_messages
  ),
  pending_outbound_metrics AS (
    SELECT COUNT(*) AS pending_outbound
    FROM pending_outbound_messages
  ),
  reminder_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE NOT COALESCE(r.lido, false) AND r.data_lembrete < now()) AS overdue_reminders,
      COUNT(*) FILTER (WHERE NOT COALESCE(r.lido, false) AND r.data_lembrete >= now() AND r.data_lembrete < now() + interval '24 hours') AS upcoming_reminders_24h
    FROM public.reminders r
    WHERE r.lead_id IN (
      SELECT DISTINCT lead_id
      FROM chats
      WHERE lead_id IS NOT NULL
    )
  ),
  recent_chats AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ranked.id,
          'displayName', ranked.display_name,
          'phoneNumber', ranked.phone_number,
          'leadId', ranked.lead_id,
          'leadStatus', ranked.lead_status,
          'unreadCount', ranked.unread_count,
          'manualUnread', ranked.manual_unread,
          'isArchived', ranked.is_archived,
          'isMuted', ranked.is_muted,
          'isPinned', ranked.is_pinned,
          'lastMessageAt', ranked.last_message_at,
          'lastMessageDirection', ranked.last_message_direction,
          'lastMessageStatus', ranked.last_message_delivery_status,
          'lastMessageText', ranked.last_message_text
        )
        ORDER BY ranked.last_message_at DESC NULLS LAST, ranked.updated_at DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        c.*,
        l.status AS lead_status
      FROM chats c
      LEFT JOIN public.leads l ON l.id = c.lead_id
      WHERE NOT COALESCE(c.is_archived, false)
      ORDER BY COALESCE(c.is_pinned, false) DESC, c.pinned_at DESC NULLS LAST, c.last_message_at DESC NULLS LAST, c.updated_at DESC
      LIMIT 8
    ) ranked
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM permission WHERE ok) THEN jsonb_build_object('authorized', false)
    ELSE jsonb_build_object(
      'authorized', true,
      'generatedAt', now(),
      'channel', (SELECT to_jsonb(channel) FROM channel),
      'chatMetrics', (SELECT to_jsonb(chat_metrics) FROM chat_metrics),
      'messageMetrics', (
        SELECT to_jsonb(mm) || to_jsonb(pm)
        FROM message_metrics mm, pending_outbound_metrics pm
      ),
      'reminderMetrics', (SELECT to_jsonb(reminder_metrics) FROM reminder_metrics),
      'recentChats', COALESCE((SELECT items FROM recent_chats), '[]'::jsonb)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_dashboard_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_dashboard_metrics() TO authenticated;

NOTIFY pgrst, 'reload schema';
