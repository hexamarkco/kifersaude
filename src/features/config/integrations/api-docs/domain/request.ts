import type { ApiEndpoint } from './catalog';

export type ApiRequestDraft = { leadId: string; query: string; body: string };
export type PreparedApiRequest = { endpointId: string; url: string; method: ApiEndpoint['method']; body?: string };
export type ApiTestResult = {
  endpointId: string; url: string; status: number; statusText: string;
  durationMs: number; body: string; headers: string; ok: boolean; applicationIssue: boolean;
};

export function createRequestDraft(endpoint: ApiEndpoint): ApiRequestDraft {
  return {
    leadId: '',
    query: new URLSearchParams(endpoint.parameters.flatMap((item) => item.example ? [[item.name, item.example]] : [])).toString(),
    body: endpoint.body === undefined ? '' : JSON.stringify(endpoint.body, null, 2),
  };
}

export function prepareApiRequest(baseUrl: string, endpoint: ApiEndpoint, draft: ApiRequestDraft): PreparedApiRequest {
  const base = new URL(baseUrl);
  if (!['https:', 'http:'].includes(base.protocol) || base.search || base.hash || base.username || base.password) {
    throw new Error('O endereço do serviço precisa ser uma URL HTTP válida, sem parâmetros ou credenciais.');
  }
  let path = endpoint.path;
  if (path.includes('{id}')) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(draft.leadId.trim())) {
      throw new Error('Informe um UUID válido para identificar o lead.');
    }
    path = path.replace('{id}', draft.leadId.trim().toLowerCase());
  }
  const url = new URL(base.toString().replace(/\/+$/, '') + path);
  const query = new URLSearchParams(draft.query.replace(/^\?/, ''));
  if (query.has('action')) throw new Error('Selecione a ação no catálogo em vez de alterar o parâmetro action.');
  query.forEach((value, key) => { if (value.trim()) url.searchParams.append(key, value); });
  if (endpoint.action) url.searchParams.set('action', endpoint.action);
  let body: string | undefined;
  if (endpoint.method !== 'GET') {
    try {
      const parsed: unknown = JSON.parse(draft.body);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      if (/PREENCHA_|UUID_DO_|ID_DO_|ID_DA_/.test(draft.body)) {
        throw new Error('Substitua os valores de exemplo pelos dados do seu ambiente.');
      }
      body = JSON.stringify(parsed);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Substitua')) throw error;
      throw new Error('O corpo precisa ser um objeto JSON válido. Revise aspas, vírgulas e chaves.');
    }
  }
  return { endpointId: endpoint.id, url: url.toString(), method: endpoint.method, body };
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function generateApiCurl(baseUrl: string, endpoint: ApiEndpoint, draft: ApiRequestDraft): string {
  // The preview remains useful before placeholder IDs have been filled in.
  const url = baseUrl.replace(/\/+$/, '') + endpointPathForCurl(endpoint, draft);
  const lines = [`curl --request ${endpoint.method} ${shellQuote(url)}`];
  if (endpoint.access !== 'public') {
    lines.push(endpoint.access === 'server'
      ? '  --header "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"'
      : '  --header "Authorization: Bearer $ACCESS_TOKEN"');
  }
  lines.push('  --header "apikey: $SUPABASE_ANON_KEY"');
  if (endpoint.method !== 'GET') {
    lines.push('  --header "Content-Type: application/json"');
    if (draft.body.trim()) lines.push(`  --data-raw ${shellQuote(draft.body)}`);
  }
  return lines.join(' \\\n');
}

function endpointPathForCurl(endpoint: ApiEndpoint, draft: ApiRequestDraft): string {
  const query = new URLSearchParams(draft.query.replace(/^\?/, ''));
  for (const [key, value] of query) { if (!value.trim()) query.delete(key); }
  query.delete('action');
  if (endpoint.action) query.set('action', endpoint.action);
  const search = query.toString();
  return endpoint.path.replace('{id}', draft.leadId.trim().toLowerCase() || '{id}') + (search ? `?${search}` : '');
}

export function formatApiBody(text: string): string {
  if (!text) return '(sem corpo de resposta)';
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

export function hasApplicationIssue(text: string): boolean {
  try {
    const payload: unknown = JSON.parse(text);
    return Boolean(payload && typeof payload === 'object' && (
      ('success' in payload && payload.success === false)
      || ('failed' in payload && Array.isArray(payload.failed) && payload.failed.length > 0)
      || ('skipped' in payload && payload.skipped === true)
    ));
  } catch { return false; }
}
