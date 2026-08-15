-- Adiciona pg_trgm + índices GIN para busca textual em comm_whatsapp_messages e
-- comm_whatsapp_chats. Sem isso, toda busca com ILIKE '%termo%' (usada por
-- comm_whatsapp_search_messages e comm_whatsapp_list_chats) força sequential
-- scan nas colunas de texto — inviável a partir de ~100k-1M linhas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- comm_whatsapp_messages: usado por comm_whatsapp_search_messages
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_text_content_trgm
  ON public.comm_whatsapp_messages USING gin (text_content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_media_caption_trgm
  ON public.comm_whatsapp_messages USING gin (media_caption gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_transcription_text_trgm
  ON public.comm_whatsapp_messages USING gin (transcription_text gin_trgm_ops);

-- comm_whatsapp_chats: usado por comm_whatsapp_list_chats
CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_display_name_trgm
  ON public.comm_whatsapp_chats USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_saved_contact_name_trgm
  ON public.comm_whatsapp_chats USING gin (saved_contact_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_push_name_trgm
  ON public.comm_whatsapp_chats USING gin (push_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_phone_number_trgm
  ON public.comm_whatsapp_chats USING gin (phone_number gin_trgm_ops);

-- leads.nome_completo participa da mesma cláusula OR de busca de
-- comm_whatsapp_list_chats (busca de chat pelo nome do lead vinculado). Sem
-- índice aqui, a query inteira ainda cai para sequential scan mesmo com os
-- índices acima, porque um ramo do OR permanece sem suporte de índice.
CREATE INDEX IF NOT EXISTS idx_leads_nome_completo_trgm
  ON public.leads USING gin (nome_completo gin_trgm_ops);

ANALYZE public.comm_whatsapp_messages;
ANALYZE public.comm_whatsapp_chats;
ANALYZE public.leads;

NOTIFY pgrst, 'reload schema';
