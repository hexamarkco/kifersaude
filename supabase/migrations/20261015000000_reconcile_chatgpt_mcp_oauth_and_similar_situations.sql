BEGIN;

-- Bind OAuth credentials to the MCP resource. NULL remains valid only for
-- credentials issued before this migration; new grants always store a value.
ALTER TABLE public.chatgpt_mcp_oauth_authorization_codes
  ADD COLUMN IF NOT EXISTS resource text;
ALTER TABLE public.chatgpt_mcp_oauth_access_tokens
  ADD COLUMN IF NOT EXISTS resource text;
ALTER TABLE public.chatgpt_mcp_oauth_refresh_tokens
  ADD COLUMN IF NOT EXISTS resource text;

-- These tables are consumed only by the server-side MCP function.
ALTER TABLE public.chatgpt_mcp_oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_mcp_oauth_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_mcp_oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_mcp_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chatgpt_mcp_oauth_authorization_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatgpt_mcp_oauth_access_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatgpt_mcp_oauth_refresh_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chatgpt_mcp_audit_log FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.chatgpt_mcp_oauth_authorization_codes TO service_role;
GRANT ALL ON TABLE public.chatgpt_mcp_oauth_access_tokens TO service_role;
GRANT ALL ON TABLE public.chatgpt_mcp_oauth_refresh_tokens TO service_role;
GRANT INSERT ON TABLE public.chatgpt_mcp_audit_log TO service_role;

-- The similar-situations lookup is called by the autonomous reply worker
-- with its service-role client. Its original migration version collided with
-- a different already-applied migration, so recreate it under this version.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_find_similar_situations(
  p_query text,
  p_limit integer DEFAULT 4
)
RETURNS TABLE (situacao text, resposta text, similaridade real)
LANGUAGE sql
STABLE
AS $$
  WITH candidatos AS (
    SELECT
      m.id,
      m.chat_id,
      m.text_content,
      m.message_at,
      similarity(m.text_content, p_query) AS sim
    FROM public.comm_whatsapp_messages m
    WHERE m.direction = 'inbound'
      AND m.message_type = 'text'
      AND m.text_content IS NOT NULL
      AND length(m.text_content) BETWEEN 8 AND 600
      AND length(p_query) >= 8
      AND m.text_content % p_query
    ORDER BY sim DESC
    LIMIT GREATEST(p_limit, 1) * 4
  ),
  pareados AS (
    SELECT DISTINCT ON (c.chat_id)
      c.text_content AS situacao,
      c.sim,
      (
        SELECT o.text_content
        FROM public.comm_whatsapp_messages o
        WHERE o.chat_id = c.chat_id
          AND o.direction = 'outbound'
          AND o.message_type = 'text'
          AND o.text_content IS NOT NULL
          AND o.delivery_status <> 'failed'
          AND o.message_at > c.message_at
          AND o.message_at < c.message_at + interval '2 hours'
        ORDER BY o.message_at ASC
        LIMIT 1
      ) AS resposta
    FROM candidatos c
    ORDER BY c.chat_id, c.sim DESC
  )
  SELECT situacao, resposta, sim AS similaridade
  FROM pareados
  WHERE resposta IS NOT NULL
  ORDER BY sim DESC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_find_similar_situations(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_find_similar_situations(text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
