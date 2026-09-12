-- Tokens OAuth exclusivos do conector ChatGPT/MCP. Os valores originais nunca
-- sao persistidos: apenas hashes SHA-256 ficam no banco. O unico consumidor
-- dessas tabelas e a Edge Function com service role.
CREATE TABLE public.chatgpt_mcp_oauth_authorization_codes (
  code_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chatgpt_mcp_oauth_access_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chatgpt_mcp_oauth_refresh_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chatgpt_mcp_oauth_access_tokens_expires_at
  ON public.chatgpt_mcp_oauth_access_tokens (expires_at);

CREATE INDEX idx_chatgpt_mcp_oauth_refresh_tokens_expires_at
  ON public.chatgpt_mcp_oauth_refresh_tokens (expires_at);

ALTER TABLE public.chatgpt_mcp_oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_mcp_oauth_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_mcp_oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chatgpt_mcp_oauth_authorization_codes FROM PUBLIC;
REVOKE ALL ON TABLE public.chatgpt_mcp_oauth_access_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.chatgpt_mcp_oauth_refresh_tokens FROM PUBLIC;

GRANT ALL ON TABLE public.chatgpt_mcp_oauth_authorization_codes TO service_role;
GRANT ALL ON TABLE public.chatgpt_mcp_oauth_access_tokens TO service_role;
GRANT ALL ON TABLE public.chatgpt_mcp_oauth_refresh_tokens TO service_role;
