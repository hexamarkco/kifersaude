import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { apiEndpoints } from '../catalog';
import { createRequestDraft, generateApiCurl, hasApplicationIssue, prepareApiRequest } from '../request';

const baseUrl = 'https://example.supabase.co/functions/v1/leads-api';
const endpoint = (id: string) => {
  const item = apiEndpoints.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Operação ausente: ${id}`);
  return item;
};

test('documenta todas as ações e rotas implementadas no serviço', () => {
  const source = readFileSync('supabase/functions/leads-api/index.ts', 'utf8').split('Deno.serve(')[1];
  const actions = [...source.matchAll(/action === '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(new Set(apiEndpoints.flatMap((item) => item.action ? [item.action] : [])), new Set(actions));
  const paths = [...source.matchAll(/path.endsWith\('([^']+)'\)/g)].map((match) => match[1]);
  for (const path of paths) assert.ok(apiEndpoints.some((item) => item.path === path));
  assert.equal(new Set(apiEndpoints.map((item) => item.id)).size, apiEndpoints.length);
});

test('envia ações pela query da function, com JSON, sem inventar caminhos', () => {
  const item = endpoint('manual-automation');
  const request = prepareApiRequest(`${baseUrl}/`, item, { leadId: '', query: '', body: '{"chatId":"chat","messages":["Olá"]}' });
  assert.equal(request.url, `${baseUrl}?action=manual-automation`);
  assert.equal(request.method, 'POST');
  assert.deepEqual(JSON.parse(request.body ?? ''), { chatId: 'chat', messages: ['Olá'] });
});

test('codifica filtros e permite os aliases por ID', () => {
  const item = endpoint('list-leads');
  const request = prepareApiRequest(baseUrl, item, { ...createRequestDraft(item), query: 'email=ana%2Bteste%40exemplo.com&status_id=123&limit=25' });
  assert.equal(new URL(request.url).searchParams.get('email'), 'ana+teste@exemplo.com');
  assert.equal(new URL(request.url).searchParams.get('status_id'), '123');
  assert.equal(request.body, undefined);
});

test('exige UUID e bloqueia JSON inválido, exemplos pendentes e troca de ação', () => {
  const update = endpoint('update-lead');
  assert.throws(() => prepareApiRequest(baseUrl, update, createRequestDraft(update)), /UUID/);
  const leadId = 'aabbccdd-1234-5678-9012-aabbccddeeff';
  assert.equal(prepareApiRequest(baseUrl, update, { ...createRequestDraft(update), leadId }).url, `${baseUrl}/leads/${leadId}`);
  assert.equal(prepareApiRequest(baseUrl, update, { ...createRequestDraft(update), leadId: leadId.toUpperCase() }).url, `${baseUrl}/leads/${leadId}`);
  assert.throws(() => prepareApiRequest(baseUrl, update, { leadId, query: '', body: '{' }), /JSON/);
  assert.throws(() => prepareApiRequest(baseUrl, endpoint('create-lead'), createRequestDraft(endpoint('create-lead'))), /Substitua/);
  assert.throws(() => prepareApiRequest(baseUrl, endpoint('health'), { leadId: '', query: 'action=process-flow-jobs', body: '' }), /catálogo/);
});

test('gera cURL com variáveis de ambiente, aspas seguras e rota correta', () => {
  const item = endpoint('preview-flow-message');
  const curl = generateApiCurl(baseUrl, item, { leadId: '', query: '', body: JSON.stringify({ instruction: "Use d'água e $TOKEN" }) });
  assert.ok(curl.includes(`${baseUrl}?action=preview-flow-message`));
  assert.ok(curl.includes('$ACCESS_TOKEN'));
  assert.ok(curl.includes('$SUPABASE_ANON_KEY'));
  assert.ok(curl.includes(`d'"'"'água`));
  const server = endpoint('process-flow-jobs');
  assert.ok(generateApiCurl(baseUrl, server, createRequestDraft(server)).includes('$SUPABASE_SERVICE_ROLE_KEY'));
});

test('distingue falha parcial ou execução ignorada de sucesso HTTP', () => {
  assert.equal(hasApplicationIssue('{"success":false}'), true);
  assert.equal(hasApplicationIssue('{"success":[],"failed":[{"index":0}]}'), true);
  assert.equal(hasApplicationIssue('{"success":true,"skipped":true}'), true);
  assert.equal(hasApplicationIssue('{"success":[],"failed":[]}'), false);
  assert.equal(hasApplicationIssue(''), false);
});
