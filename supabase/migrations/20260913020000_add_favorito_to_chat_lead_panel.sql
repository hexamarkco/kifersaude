/*
  # Inclui favorito no painel de lead do WhatsApp

  comm_whatsapp_get_chat_lead_panel não devolvia leads.favorito, então o
  painel do lead dentro do inbox do WhatsApp não tinha como mostrar a
  estrela de favorito. Redefine a function pra incluir a coluna.
*/

BEGIN;

DROP FUNCTION IF EXISTS public.comm_whatsapp_get_chat_lead_panel(uuid);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_chat_lead_panel(p_chat_id uuid)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  telefone text,
  observacoes text,
  status_nome text,
  status_value text,
  responsavel_label text,
  responsavel_value text,
  favorito boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    lead.id,
    lead.nome_completo,
    lead.telefone,
    lead.observacoes,
    COALESCE(status_config.nome, lead.status),
    COALESCE(status_config.nome, lead.status),
    responsible.label,
    COALESCE(responsible.value, ''),
    lead.favorito
  FROM public.comm_whatsapp_chats AS chat
  JOIN public.leads AS lead ON lead.id = chat.lead_id
  LEFT JOIN public.lead_status_config AS status_config ON status_config.id = lead.status_id
  LEFT JOIN public.lead_responsaveis AS responsible ON responsible.id = lead.responsavel_id
  WHERE chat.id = public.comm_whatsapp_resolve_chat_uuid(p_chat_id)
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
    AND public.current_user_can_view_comm_whatsapp();
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_lead_panel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_lead_panel(uuid) TO authenticated;

COMMIT;
