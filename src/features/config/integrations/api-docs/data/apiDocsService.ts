import { supabase, supabaseFunctionsUrl } from '../../../../../infrastructure/supabase';
import { apiEndpoints } from '../domain/catalog';
import { formatApiBody, hasApplicationIssue, type ApiTestResult, type PreparedApiRequest } from '../domain/request';

export const leadsApiBaseUrl = `${supabaseFunctionsUrl.replace(/\/+$/, '')}/leads-api`;

export async function executeApiRequest(request: PreparedApiRequest, signal: AbortSignal): Promise<ApiTestResult> {
  const endpoint = apiEndpoints.find((item) => item.id === request.endpointId);
  if (!endpoint || endpoint.access === 'server') throw new Error('Esta rotina deve ser executada no servidor.');
  const target = new URL(request.url);
  const base = new URL(leadsApiBaseUrl);
  const expectedPath = endpoint.path.includes('{id}')
    ? new RegExp(`^${base.pathname}/leads/[a-f0-9-]{36}$`, 'i').test(target.pathname)
    : target.pathname === base.pathname + endpoint.path;
  if (target.origin !== base.origin || !expectedPath || request.method !== endpoint.method
    || (target.searchParams.get('action') ?? undefined) !== endpoint.action) {
    throw new Error('As chamadas precisam usar o serviço configurado neste ambiente.');
  }
  const headers: Record<string, string> = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY };
  if (endpoint.access !== 'public') {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Sua sessão expirou. Entre novamente no CRM para testar.');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  if (request.body !== undefined) headers['Content-Type'] = 'application/json';
  const start = performance.now();
  const response = await fetch(request.url, {
    method: request.method, headers, body: request.body, signal, credentials: 'omit', redirect: 'error',
  });
  const text = await response.text();
  return {
    endpointId: request.endpointId, url: request.url, status: response.status, statusText: response.statusText,
    durationMs: Math.round(performance.now() - start), ok: response.ok,
    applicationIssue: hasApplicationIssue(text), body: formatApiBody(text),
    headers: Array.from(response.headers.entries()).map(([key, value]) => `${key}: ${value}`).join('\n'),
  };
}
