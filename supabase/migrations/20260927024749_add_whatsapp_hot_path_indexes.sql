BEGIN;

-- O worker consulta eventos pelo alvo durante a recuperação de envios aceitos.
-- O índice parcial evita carregar eventos sem alvo, que não participam desse
-- fluxo.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_events_target_id
  ON public.comm_whatsapp_campaign_events (target_id)
  WHERE target_id IS NOT NULL;

-- Jobs de enriquecimento são localizados pelo message_id em rotinas de
-- atualização/reprocessamento. Todos os registros atuais possuem mensagem,
-- mas manter o índice parcial deixa o caminho seguro para linhas futuras nulas.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_enrichment_jobs_message_id
  ON public.comm_whatsapp_enrichment_jobs (message_id)
  WHERE message_id IS NOT NULL;

-- A tela administrativa verifica o último evento de mensagem por canal e tipo.
-- A ordem do índice acompanha exatamente o filtro e o ORDER BY dessa consulta.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_event_receipts_message_health
  ON public.comm_whatsapp_event_receipts (channel_id, event_type, received_at DESC)
  WHERE event_type = 'message';

-- O diagnóstico do canal busca a última mensagem recebida. O índice parcial
-- evita ordenar mensagens de saída para responder uma consulta de saúde.
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_channel_inbound_latest
  ON public.comm_whatsapp_messages (channel_id, message_at DESC)
  WHERE direction = 'inbound';

COMMIT;
