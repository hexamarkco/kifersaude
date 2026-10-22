BEGIN;

-- Only token hashes cross this boundary. Existing grants and scopes are never
-- upgraded; a failed insert rolls back consumption of the original credential.
CREATE FUNCTION public.mcp_exchange_oauth_tokens(
  p_grant_type text,
  p_credential_hash text,
  p_client_id text,
  p_resource text,
  p_redirect_uri text,
  p_code_challenge text,
  p_access_token_hash text,
  p_refresh_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid;
  v_scope text;
  v_resource text;
  v_code public.chatgpt_mcp_oauth_authorization_codes%ROWTYPE;
  v_refresh public.chatgpt_mcp_oauth_refresh_tokens%ROWTYPE;
BEGIN
  IF p_grant_type IS NULL OR p_grant_type NOT IN ('authorization_code', 'refresh_token')
    OR NULLIF(btrim(p_client_id), '') IS NULL OR NULLIF(btrim(p_resource), '') IS NULL
    OR p_credential_hash IS NULL OR p_credential_hash !~ '^[A-Za-z0-9_-]{43}$'
    OR p_access_token_hash IS NULL OR p_access_token_hash !~ '^[A-Za-z0-9_-]{43}$'
    OR p_refresh_token_hash IS NULL OR p_refresh_token_hash !~ '^[A-Za-z0-9_-]{43}$'
    OR p_access_token_hash IN (p_refresh_token_hash, p_credential_hash)
    OR p_refresh_token_hash = p_credential_hash THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF p_grant_type = 'authorization_code' THEN
    SELECT * INTO v_code FROM public.chatgpt_mcp_oauth_authorization_codes
      WHERE code_hash = p_credential_hash AND client_id = p_client_id
        AND expires_at > now() FOR UPDATE;
    IF NOT FOUND OR v_code.redirect_uri IS DISTINCT FROM p_redirect_uri
      OR v_code.code_challenge IS DISTINCT FROM p_code_challenge THEN
      RETURN jsonb_build_object('success', false);
    END IF;
    v_user_id := v_code.user_id;
    v_scope := v_code.scope;
    v_resource := v_code.resource;
  ELSE
    SELECT * INTO v_refresh FROM public.chatgpt_mcp_oauth_refresh_tokens
      WHERE token_hash = p_credential_hash AND client_id = p_client_id
        AND revoked_at IS NULL AND expires_at > now() FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false); END IF;
    v_user_id := v_refresh.user_id;
    v_scope := v_refresh.scope;
    v_resource := v_refresh.resource;
  END IF;

  IF (v_resource IS NOT NULL AND v_resource <> p_resource)
    OR NOT ('kifer.read' = ANY(regexp_split_to_array(v_scope, '\s+')))
    OR NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id
      AND role = 'admin' AND NULLIF(btrim(email), '') IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  INSERT INTO public.chatgpt_mcp_oauth_access_tokens(token_hash, user_id, client_id, scope, resource, expires_at)
    VALUES (p_access_token_hash, v_user_id, p_client_id, v_scope, p_resource, now() + interval '1 hour');
  -- All approved connections receive a rotating renewal credential, including
  -- an authorization code issued immediately before offline_access was added.
  INSERT INTO public.chatgpt_mcp_oauth_refresh_tokens(token_hash, user_id, client_id, scope, resource, expires_at)
    VALUES (p_refresh_token_hash, v_user_id, p_client_id, v_scope, p_resource, now() + interval '30 days');
  IF p_grant_type = 'authorization_code' THEN
    DELETE FROM public.chatgpt_mcp_oauth_authorization_codes WHERE code_hash = p_credential_hash;
  ELSE
    UPDATE public.chatgpt_mcp_oauth_refresh_tokens SET revoked_at = now() WHERE token_hash = p_credential_hash;
  END IF;
  RETURN jsonb_build_object('success', true, 'scope', v_scope, 'expires_in', 3600);
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_exchange_oauth_tokens(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_exchange_oauth_tokens(text, text, text, text, text, text, text, text) TO service_role;
COMMENT ON FUNCTION public.mcp_exchange_oauth_tokens(text, text, text, text, text, text, text, text)
  IS 'Service-only atomic OAuth code exchange and refresh rotation; hashes only, same scopes and active admin revalidation.';
NOTIFY pgrst, 'reload schema';
COMMIT;
