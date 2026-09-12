import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

const FUNCTION_PATH = '/functions/v1/chatgpt-mcp';
const AUTHORIZE_PATH = '/oauth/authorize';
const AUTHORIZE_COMPLETE_PATH = '/oauth/authorize/complete';
const TOKEN_PATH = '/oauth/token';
const OAUTH_METADATA_PATH = '/.well-known/oauth-authorization-server';
const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';
const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60;
const REFRESH_TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const AUTHORIZATION_CODE_LIFETIME_SECONDS = 5 * 60;
const ALLOWED_SCOPES = new Set(['openid', 'offline_access', 'kifer.read']);

type OAuthPrincipal = {
  actor: string;
  userId: string;
};

type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
};

type OAuthTokenRecord = {
  user_id: string;
  client_id: string;
  scope: string;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id',
};

const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

const tokenError = (error: string, description: string, status = 400) =>
  json({ error, error_description: description }, status, { 'WWW-Authenticate': 'Bearer' });

const oauthConfig = () => ({
  clientId: text(Deno.env.get('KIFER_MCP_OAUTH_CLIENT_ID')) || 'chatgpt-kifer',
  redirectUri: text(Deno.env.get('KIFER_MCP_OAUTH_REDIRECT_URI')),
  authorizationUiUrl: text(Deno.env.get('KIFER_MCP_OAUTH_UI_URL')),
});

// A plataforma termina TLS antes de entregar a requisicao ao runtime Deno;
// portanto request.url pode aparecer como http internamente. O endpoint MCP
// publico e sempre HTTPS e os metadados OAuth precisam anunciar essa URL.
const getBaseUrl = (request: Request): string => {
  const url = new URL(request.url);
  const host = text(request.headers.get('x-forwarded-host')) || url.host;
  return `https://${host}${FUNCTION_PATH}`;
};

const getRoute = (request: Request): string => {
  const path = new URL(request.url).pathname;
  // O gateway remoto da Supabase remove o prefixo da function, enquanto o
  // runtime local o preserva. Aceitar ambas as formas mantém a descoberta
  // OAuth funcional nos dois ambientes.
  const functionNameIndex = path.indexOf('/chatgpt-mcp');
  return functionNameIndex >= 0 ? path.slice(functionNameIndex + '/chatgpt-mcp'.length) || '/' : path || '/';
};

const getAdmin = (): SupabaseClient => {
  const url = text(Deno.env.get('SUPABASE_URL'));
  const serviceRoleKey = text(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !serviceRoleKey) throw new Error('Configuracao Supabase ausente.');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
};

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

const randomToken = (bytes = 32): string => {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return base64Url(values);
};

const sha256 = async (value: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

const equalStrings = (left: string, right: string): boolean => {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
};

const isSafeCodeChallenge = (value: string): boolean => /^[A-Za-z0-9._~-]{43,128}$/.test(value);

const normalizeScope = (rawScope: string): { scope?: string; error?: string } => {
  const requested = rawScope.split(/\s+/).filter(Boolean);
  if (requested.some((scope) => !ALLOWED_SCOPES.has(scope))) return { error: 'Escopo OAuth nao permitido.' };
  const scopes = new Set(requested);
  scopes.add('kifer.read');
  return { scope: [...scopes].sort().join(' ') };
};

const parseAuthorizationRequest = (url: URL): { request?: AuthorizationRequest; error?: string } => {
  const config = oauthConfig();
  if (!config.redirectUri) return { error: 'OAuth ainda nao foi configurado no servidor.' };
  const clientId = text(url.searchParams.get('client_id'));
  const redirectUri = text(url.searchParams.get('redirect_uri'));
  const state = text(url.searchParams.get('state'));
  const codeChallenge = text(url.searchParams.get('code_challenge'));
  const codeChallengeMethod = text(url.searchParams.get('code_challenge_method'));
  const scopeResult = normalizeScope(text(url.searchParams.get('scope')));

  if (text(url.searchParams.get('response_type')) !== 'code') return { error: 'Somente response_type=code e suportado.' };
  if (clientId !== config.clientId) return { error: 'Cliente OAuth desconhecido.' };
  if (redirectUri !== config.redirectUri) return { error: 'URL de retorno nao autorizada.' };
  if (!state) return { error: 'O parametro state e obrigatorio.' };
  if (codeChallengeMethod !== 'S256' || !isSafeCodeChallenge(codeChallenge)) return { error: 'PKCE S256 e obrigatorio.' };
  if (scopeResult.error || !scopeResult.scope) return { error: scopeResult.error || 'Escopo OAuth invalido.' };

  return { request: { clientId, redirectUri, state, codeChallenge, scope: scopeResult.scope } };
};

const redirectWithAuthorizationCode = (authorization: AuthorizationRequest, code: string): Response => {
  const target = new URL(authorization.redirectUri);
  target.searchParams.set('code', code);
  target.searchParams.set('state', authorization.state);
  return new Response(null, { status: 303, headers: { Location: target.toString(), 'Cache-Control': 'no-store' } });
};

const createAuthorizationCode = async (admin: SupabaseClient, request: AuthorizationRequest, userId: string): Promise<string> => {
  const code = randomToken();
  const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_LIFETIME_SECONDS * 1000).toISOString();
  const { error } = await admin.from('chatgpt_mcp_oauth_authorization_codes').insert({
    code_hash: await sha256(code), user_id: userId, client_id: request.clientId, redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge, scope: request.scope, expires_at: expiresAt,
  });
  if (error) throw new Error(`Falha ao criar autorizacao OAuth: ${error.message}`);
  return code;
};

const authorizeGet = (request: Request): Response => {
  const parsed = parseAuthorizationRequest(new URL(request.url));
  if (!parsed.request) return new Response(parsed.error || 'Solicitacao OAuth invalida.', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const authorizationUiUrl = oauthConfig().authorizationUiUrl;
  if (!authorizationUiUrl) return new Response('OAuth ainda nao foi configurado no servidor.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const destination = new URL(authorizationUiUrl);
  destination.searchParams.set('client_id', parsed.request.clientId);
  destination.searchParams.set('redirect_uri', parsed.request.redirectUri);
  destination.searchParams.set('state', parsed.request.state);
  destination.searchParams.set('code_challenge', parsed.request.codeChallenge);
  destination.searchParams.set('scope', parsed.request.scope);
  return new Response(null, { status: 303, headers: { Location: destination.toString(), 'Cache-Control': 'no-store' } });
};

const parseAuthorizationPayload = (payload: unknown): { request?: AuthorizationRequest; error?: string } => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'Solicitacao OAuth invalida.' };
  const values = payload as Record<string, unknown>;
  const url = new URL('https://oauth.invalid');
  for (const field of ['client_id', 'redirect_uri', 'state', 'code_challenge', 'scope']) {
    const value = text(values[field]);
    if (value) url.searchParams.set(field, value);
  }
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge_method', 'S256');
  return parseAuthorizationRequest(url);
};

const completeAuthorization = async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json({ error: 'Use POST para concluir a autorizacao.' }, 405);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Corpo JSON invalido.' }, 400);
  }
  const parsed = parseAuthorizationPayload(payload);
  if (!parsed.request) return json({ error: parsed.error || 'Solicitacao OAuth invalida.' }, 400);
  const bearer = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  if (!bearer) return json({ error: 'Faca login como administrador para continuar.' }, 401);
  try {
    const admin = getAdmin();
    const { data, error } = await admin.auth.getUser(bearer);
    if (error || !data.user) return json({ error: 'Sua sessao expirou. Faca login novamente.' }, 401);
    if (!(await ensureActiveAdmin(admin, data.user.id))) return json({ error: 'Esta conta nao possui permissao de administrador.' }, 403);
    const code = await createAuthorizationCode(admin, parsed.request, data.user.id);
    const callback = new URL(parsed.request.redirectUri);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', parsed.request.state);
    return json({ redirect_to: callback.toString() });
  } catch (error) {
    console.error('[chatgpt-mcp] falha ao concluir autorizacao OAuth:', error instanceof Error ? error.message : error);
    return json({ error: 'Nao foi possivel autorizar agora. Tente novamente.' }, 500);
  }
};

const clientConfigEndpoint = (): Response => {
  const supabaseUrl = text(Deno.env.get('SUPABASE_URL'));
  const anonKey = text(Deno.env.get('SUPABASE_ANON_KEY')) || text(Deno.env.get('SUPABASE_PUBLISHABLE_KEY'));
  if (!supabaseUrl || !anonKey) return json({ error: 'Configuracao publica do Supabase indisponivel.' }, 503);
  return json({ supabase_url: supabaseUrl, anon_key: anonKey });
};

const issueTokens = async (admin: SupabaseClient, record: OAuthTokenRecord): Promise<Record<string, unknown>> => {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();
  const { error } = await admin.from('chatgpt_mcp_oauth_access_tokens').insert({
    token_hash: await sha256(accessToken), user_id: record.user_id, client_id: record.client_id, scope: record.scope,
    expires_at: new Date(now + ACCESS_TOKEN_LIFETIME_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(`Falha ao criar token de acesso: ${error.message}`);
  if (record.scope.split(' ').includes('offline_access')) {
    const { error: refreshError } = await admin.from('chatgpt_mcp_oauth_refresh_tokens').insert({
      token_hash: await sha256(refreshToken), user_id: record.user_id, client_id: record.client_id, scope: record.scope,
      expires_at: new Date(now + REFRESH_TOKEN_LIFETIME_SECONDS * 1000).toISOString(),
    });
    if (refreshError) throw new Error(`Falha ao criar token de renovacao: ${refreshError.message}`);
  }
  return {
    access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_LIFETIME_SECONDS, scope: record.scope,
    ...(record.scope.split(' ').includes('offline_access') ? { refresh_token: refreshToken } : {}),
  };
};

const consumeAuthorizationCode = async (admin: SupabaseClient, code: string, clientId: string, redirectUri: string, codeVerifier: string): Promise<OAuthTokenRecord | null> => {
  const { data, error } = await admin.from('chatgpt_mcp_oauth_authorization_codes')
    .delete().eq('code_hash', await sha256(code)).eq('client_id', clientId).eq('redirect_uri', redirectUri).gt('expires_at', new Date().toISOString())
    .select('user_id,client_id,scope,code_challenge').maybeSingle();
  if (error) throw new Error(`Falha ao validar codigo OAuth: ${error.message}`);
  if (!data || !equalStrings(await sha256(codeVerifier), text(data.code_challenge))) return null;
  return { user_id: text(data.user_id), client_id: text(data.client_id), scope: text(data.scope) };
};

const consumeRefreshToken = async (admin: SupabaseClient, refreshToken: string, clientId: string): Promise<OAuthTokenRecord | null> => {
  const { data, error } = await admin.from('chatgpt_mcp_oauth_refresh_tokens')
    .update({ revoked_at: new Date().toISOString() }).eq('token_hash', await sha256(refreshToken)).eq('client_id', clientId).is('revoked_at', null).gt('expires_at', new Date().toISOString())
    .select('user_id,client_id,scope').maybeSingle();
  if (error) throw new Error(`Falha ao renovar token OAuth: ${error.message}`);
  return data ? { user_id: text(data.user_id), client_id: text(data.client_id), scope: text(data.scope) } : null;
};

const ensureActiveAdmin = async (admin: SupabaseClient, userId: string): Promise<{ email: string } | null> => {
  const { data, error } = await admin.from('user_profiles').select('email,role').eq('id', userId).maybeSingle();
  if (error) throw new Error(`Falha ao validar acesso: ${error.message}`);
  return data?.role === 'admin' && text(data.email) ? { email: text(data.email) } : null;
};

const tokenEndpoint = async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return tokenError('invalid_request', 'Use POST para obter tokens.', 405);
  const form = await request.formData();
  const config = oauthConfig();
  const clientId = text(form.get('client_id'));
  if (clientId !== config.clientId) return tokenError('invalid_client', 'Cliente OAuth desconhecido.', 401);
  try {
    const admin = getAdmin();
    const grantType = text(form.get('grant_type'));
    let record: OAuthTokenRecord | null = null;
    if (grantType === 'authorization_code') {
      const redirectUri = text(form.get('redirect_uri'));
      const code = text(form.get('code'));
      const verifier = text(form.get('code_verifier'));
      if (!code || !verifier || !redirectUri) return tokenError('invalid_request', 'code, code_verifier e redirect_uri sao obrigatorios.');
      record = await consumeAuthorizationCode(admin, code, clientId, redirectUri, verifier);
    } else if (grantType === 'refresh_token') {
      const refreshToken = text(form.get('refresh_token'));
      if (!refreshToken) return tokenError('invalid_request', 'refresh_token e obrigatorio.');
      record = await consumeRefreshToken(admin, refreshToken, clientId);
    } else {
      return tokenError('unsupported_grant_type', 'Grant OAuth nao suportado.');
    }
    if (!record || !(await ensureActiveAdmin(admin, record.user_id))) return tokenError('invalid_grant', 'Autorizacao invalida, expirada ou revogada.');
    return json(await issueTokens(admin, record));
  } catch (error) {
    console.error('[chatgpt-mcp] falha no endpoint OAuth token:', error instanceof Error ? error.message : error);
    return tokenError('server_error', 'Nao foi possivel emitir o token agora.', 500);
  }
};

export async function handleOAuthRoute(request: Request): Promise<Response | null> {
  const route = getRoute(request);
  const baseUrl = getBaseUrl(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (route === OAUTH_METADATA_PATH && request.method === 'GET') {
    return json({
      issuer: baseUrl, authorization_endpoint: `${baseUrl}${AUTHORIZE_PATH}`, token_endpoint: `${baseUrl}${TOKEN_PATH}`,
      response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [...ALLOWED_SCOPES],
    });
  }
  if (route === RESOURCE_METADATA_PATH && request.method === 'GET') {
    return json({ resource: baseUrl, authorization_servers: [baseUrl], scopes_supported: [...ALLOWED_SCOPES], bearer_methods_supported: ['header'] });
  }
  if (route === AUTHORIZE_PATH) return request.method === 'GET' ? authorizeGet(request) : new Response('Metodo nao permitido', { status: 405 });
  if (route === AUTHORIZE_COMPLETE_PATH) return completeAuthorization(request);
  if (route === '/oauth/client-config' && request.method === 'GET') return clientConfigEndpoint();
  if (route === TOKEN_PATH) return tokenEndpoint(request);
  return null;
}

export async function authenticateOAuthAccessToken(request: Request): Promise<OAuthPrincipal | null> {
  const authorization = request.headers.get('Authorization') || '';
  const received = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  if (!received) return null;
  const admin = getAdmin();
  const { data, error } = await admin.from('chatgpt_mcp_oauth_access_tokens')
    .select('user_id,client_id,scope').eq('token_hash', await sha256(received)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw new Error(`Falha ao validar token OAuth: ${error.message}`);
  if (!data || text(data.client_id) !== oauthConfig().clientId || !text(data.scope).split(' ').includes('kifer.read')) return null;
  const user = await ensureActiveAdmin(admin, text(data.user_id));
  return user ? { userId: text(data.user_id), actor: `chatgpt:${user.email}` } : null;
}

export const getMcpOAuthChallenge = (request: Request): string =>
  `Bearer realm="Kifer Saude MCP", resource_metadata="${getBaseUrl(request)}${RESOURCE_METADATA_PATH}", scope="kifer.read"`;
