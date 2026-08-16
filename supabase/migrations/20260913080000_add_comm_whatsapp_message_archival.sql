-- Estratégia de retenção/particionamento para comm_whatsapp_messages: hoje só
-- comm_whatsapp_event_receipts tem limpeza automática. Mensagens e chats
-- crescem indefinidamente, o que agrava progressivamente o custo de qualquer
-- operação que precise tocar a tabela inteira (dashboard, busca, backup).
--
-- Escopo deliberadamente conservador: só arquiva mensagens de chats que o
-- usuário JÁ escolheu excluir (soft-delete, comm_whatsapp_chats.deleted_at)
-- há muito tempo — nunca toca em dados de conversas ativas. O mecanismo é
-- criado e testado aqui, mas NÃO é agendado via pg_cron nesta migration: o
-- limiar de dias e a cadência de execução em produção ficam como decisão
-- operacional explícita antes de rodar automaticamente (ver plano de ação).

-- Mesma estrutura de comm_whatsapp_messages (colunas, defaults, índices,
-- constraints de CHECK/NOT NULL) via LIKE ... INCLUDING ALL, para não haver
-- risco de a tabela de arquivo divergir da tabela real. Constraints de FK
-- nunca são copiadas pelo LIKE, então o arquivo não fica preso à existência
-- futura da linha de chat original.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_messages_archive (
  LIKE public.comm_whatsapp_messages INCLUDING ALL
);

ALTER TABLE public.comm_whatsapp_messages_archive
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.comm_whatsapp_messages_archive ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comm_whatsapp_messages_archive FROM PUBLIC;
GRANT SELECT ON TABLE public.comm_whatsapp_messages_archive TO service_role;

CREATE POLICY "Comm WhatsApp inbox users can view archived messages"
  ON public.comm_whatsapp_messages_archive
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

-- Quantas mensagens seriam arquivadas hoje, sem executar nada — para decidir
-- o limiar de dias com dado real antes de agendar a execução automática.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_report_storage_growth()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN NOT public.current_user_can_view_comm_whatsapp() THEN jsonb_build_object('authorized', false)
    ELSE jsonb_build_object(
      'authorized', true,
      'generatedAt', now(),
      'messagesTotal', (SELECT count(*) FROM public.comm_whatsapp_messages),
      'messagesArchived', (SELECT count(*) FROM public.comm_whatsapp_messages_archive),
      'oldestMessageAt', (SELECT min(message_at) FROM public.comm_whatsapp_messages),
      'archivableMessagesOlderThan180Days', (
        SELECT count(*)
        FROM public.comm_whatsapp_messages m
        INNER JOIN public.comm_whatsapp_chats c ON c.id = m.chat_id
        WHERE c.deleted_at IS NOT NULL AND c.deleted_at < now() - interval '180 days'
      ),
      'messagesTableSizeBytes', pg_total_relation_size('public.comm_whatsapp_messages'),
      'archiveTableSizeBytes', pg_total_relation_size('public.comm_whatsapp_messages_archive')
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_report_storage_growth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_report_storage_growth() TO authenticated;

-- Move (INSERT no arquivo + DELETE da tabela viva, atômico) mensagens de
-- chats soft-deleted há mais de p_older_than_days. Nunca toca mensagens de
-- chats ativos (deleted_at IS NULL) nem de chats deletados recentemente.
-- Retorna quantas linhas foram arquivadas nesta chamada (chame em loop até
-- retornar 0 para processar tudo, respeitando p_batch_size por vez).
-- Manutenção: o INSERT abaixo usa `m.*` posicional contra as colunas de
-- comm_whatsapp_messages_archive (que ficaram "congeladas" no formato de
-- comm_whatsapp_messages no momento do LIKE, mais archived_at ao final). Se
-- uma migration futura adicionar coluna em comm_whatsapp_messages, esta
-- função passa a falhar com erro de contagem de colunas no INSERT (falha
-- segura — nada é apagado se o INSERT falhar) até a tabela de arquivo ser
-- atualizada para acompanhar (ALTER TABLE ... ADD COLUMN correspondente).
CREATE OR REPLACE FUNCTION public.archive_comm_whatsapp_old_deleted_chat_messages(
  p_older_than_days integer DEFAULT 180,
  p_batch_size integer DEFAULT 5000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived_count integer := 0;
BEGIN
  IF p_older_than_days IS NULL OR p_older_than_days < 90 THEN
    RAISE EXCEPTION 'p_older_than_days deve ser >= 90 (protecao contra archival acidental de dados recentes)';
  END IF;

  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 20000 THEN
    RAISE EXCEPTION 'p_batch_size deve estar entre 1 e 20000';
  END IF;

  WITH candidates AS (
    SELECT m.id
    FROM public.comm_whatsapp_messages m
    INNER JOIN public.comm_whatsapp_chats c ON c.id = m.chat_id
    WHERE c.deleted_at IS NOT NULL
      AND c.deleted_at < now() - make_interval(days => p_older_than_days)
    LIMIT p_batch_size
  ),
  archived AS (
    INSERT INTO public.comm_whatsapp_messages_archive
    SELECT m.*, now() AS archived_at
    FROM public.comm_whatsapp_messages m
    WHERE m.id IN (SELECT id FROM candidates)
    RETURNING id
  )
  DELETE FROM public.comm_whatsapp_messages
  WHERE id IN (SELECT id FROM archived);

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  RETURN v_archived_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_comm_whatsapp_old_deleted_chat_messages(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_comm_whatsapp_old_deleted_chat_messages(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_comm_whatsapp_old_deleted_chat_messages(integer, integer) TO service_role;

-- Intencionalmente SEM agendamento via pg_cron aqui. Habilitar depois de
-- decidir p_older_than_days com o time, ex.:
--   SELECT cron.schedule('archive-comm-whatsapp-old-messages', '17 4 * * *',
--     $$ SELECT public.archive_comm_whatsapp_old_deleted_chat_messages(180, 5000); $$);

NOTIFY pgrst, 'reload schema';
