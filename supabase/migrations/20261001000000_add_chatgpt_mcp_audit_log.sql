-- Auditoria exclusiva da integracao ChatGPT/MCP. Ela nunca e utilizada para
-- decidir permissoes; registra apenas metadados da consulta, sem o conteudo
-- retornado nem valores pesquisados.
CREATE TABLE IF NOT EXISTS public.chatgpt_mcp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  tool_name text NOT NULL,
  resource_name text,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatgpt_mcp_audit_log_created_at
  ON public.chatgpt_mcp_audit_log (created_at DESC);

ALTER TABLE public.chatgpt_mcp_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chatgpt_mcp_audit_log FROM PUBLIC;
GRANT SELECT ON TABLE public.chatgpt_mcp_audit_log TO authenticated, service_role;
