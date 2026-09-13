-- Garante que um retry do MCP não programe uma segunda mensagem para o mesmo canal.
ALTER TABLE public.comm_whatsapp_scheduled_messages
  ADD COLUMN IF NOT EXISTS mcp_client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_messages_mcp_client_request
  ON public.comm_whatsapp_scheduled_messages (channel_id, mcp_client_request_id)
  WHERE mcp_client_request_id IS NOT NULL;
