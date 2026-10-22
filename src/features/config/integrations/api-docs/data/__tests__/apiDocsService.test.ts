import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { apiEndpoints } from '../../domain/catalog';
import { createRequestDraft, prepareApiRequest } from '../../domain/request';

const mocks = vi.hoisted(() => ({ session: { access_token: 'user-test-token' } as { access_token: string } | null, sessionCalls: 0 }));
vi.mock('../../../../../../infrastructure/supabase', () => ({
  supabaseFunctionsUrl: 'https://example.supabase.co/functions/v1',
  supabase: { auth: { getSession: async () => { mocks.sessionCalls++; return { data: { session: mocks.session }, error: null }; } } },
}));
import { executeApiRequest, leadsApiBaseUrl } from '../apiDocsService';

const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
const responses: Response[] = [];
const request = (id: string) => {
  const endpoint = apiEndpoints.find((item) => item.id === id);
  if (!endpoint) throw new Error('Operação ausente');
  return prepareApiRequest(leadsApiBaseUrl, endpoint, createRequestDraft(endpoint));
};
const withFetch = async (check: () => Promise<void>) => {
  const previous = globalThis.fetch;
  mocks.session = { access_token: 'user-test-token' };
  mocks.sessionCalls = 0;
  calls.length = 0;
  responses.length = 0;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return responses.shift() ?? new Response('{"success":true,"count":0,"data":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try { await check(); } finally { globalThis.fetch = previous; }
};

test('usa a sessão atual como bearer e a chave pública como apikey', () => withFetch(async () => {
  const signal = new AbortController().signal;
  const result = await executeApiRequest(request('list-leads'), signal);
  assert.equal(calls[0].input, `${leadsApiBaseUrl}/leads?limit=25`);
  assert.deepEqual(calls[0].init, {
    method: 'GET', headers: { Authorization: 'Bearer user-test-token', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, signal,
    credentials: 'omit', redirect: 'error', body: undefined,
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.includes('"count": 0'));
  assert.ok(result.headers.includes('content-type: application/json'));
}));

test('não exige sessão para verificar a conexão', () => withFetch(async () => {
  await executeApiRequest(request('health'), new AbortController().signal);
  assert.equal(mocks.sessionCalls, 0);
  assert.deepEqual(calls[0].init?.headers, { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY });
}));

test('bloqueia rotina interna, sessão ausente e destino externo antes de enviar', () => withFetch(async () => {
  const signal = new AbortController().signal;
  await assert.rejects(executeApiRequest(request('process-flow-jobs'), signal), /servidor/);
  await assert.rejects(executeApiRequest({ ...request('list-leads'), url: 'https://external.example/leads' }, signal), /ambiente/);
  await assert.rejects(executeApiRequest({ ...request('list-leads'), url: `${leadsApiBaseUrl}?action=process-flow-jobs`, method: 'POST' }, signal), /ambiente/);
  mocks.session = null;
  await assert.rejects(executeApiRequest(request('list-leads'), signal), /sessão expirou/);
  assert.equal(calls.length, 0);
}));

test('preserva corpo e status de erros HTTP e sinaliza falha parcial', () => withFetch(async () => {
  responses.push(new Response('Acesso recusado', { status: 403 }));
  const result = await executeApiRequest(request('list-leads'), new AbortController().signal);
  assert.equal(result.status, 403);
  assert.equal(result.ok, false);
  assert.equal(result.body, 'Acesso recusado');
  responses.push(new Response('{"success":[],"failed":[{"index":0}]}', { status: 200 }));
  assert.equal((await executeApiRequest(request('list-leads'), new AbortController().signal)).applicationIssue, true);
}));
