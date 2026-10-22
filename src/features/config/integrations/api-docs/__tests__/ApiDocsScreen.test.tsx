import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import type { PreparedApiRequest } from '../domain/request';

const mocks = vi.hoisted(() => ({
  auth: { isAdmin: true, isObserver: false },
  calls: [] as PreparedApiRequest[],
  waitForAbort: false,
  execute: async (request: PreparedApiRequest, signal: AbortSignal) => {
    mocks.calls.push(request);
    if (mocks.waitForAbort) {
      await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('abort')), { once: true }));
    }
    return { endpointId: request.endpointId, url: request.url, status: 200, statusText: 'OK', durationMs: 12, body: '{"status":"ok"}', headers: 'content-type: application/json', ok: true, applicationIssue: false };
  },
}));
vi.mock('../../../../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../data/apiDocsService', () => ({
  leadsApiBaseUrl: 'https://api.example.com/functions/v1/leads-api', executeApiRequest: mocks.execute,
}));
import ApiDocsScreen from '../ApiDocsScreen';

const withView = async (check: () => Promise<void>, observer = false) => {
  mocks.auth.isAdmin = !observer;
  mocks.auth.isObserver = observer;
  mocks.calls.length = 0;
  mocks.waitForAbort = false;
  const view = render(<ApiDocsScreen />);
  try { await check(); } finally { view.unmount(); }
};
const button = (label: string) => {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent?.trim() === label);
  if (!found) throw new Error(`Botão ausente: ${label}`);
  return found;
};
const selectEndpoint = async (title: string) => {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('.kds-api-endpoint')).find((item) => item.querySelector('strong')?.textContent === title);
  if (!found) throw new Error('Operação ausente');
  await act(async () => { found.click(); });
};
const setInput = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

test('não executa chamadas ao abrir ou trocar de operação; exibe resultado de consulta', () => withView(async () => {
  assert.ok(document.body.textContent?.includes('Nenhuma chamada executada'));
  await selectEndpoint('Consultar leads');
  assert.equal(mocks.calls.length, 0);
  await act(async () => { button('Executar chamada').click(); });
  assert.equal(mocks.calls.length, 1);
  assert.ok(mocks.calls[0].url.includes('/leads?limit=25'));
  assert.ok(document.body.textContent?.includes('HTTP 200'));
}));

test('exige revisão de chamadas com efeito real e envia exatamente o JSON confirmado', () => withView(async () => {
  await selectEndpoint('Pré-visualizar mensagem de IA');
  await setInput(document.querySelector('textarea')!, '{"instruction":"Uma prévia de teste"}');
  await act(async () => { button('Executar chamada').click(); });
  assert.equal(mocks.calls.length, 0);
  assert.ok(document.querySelector('[role="dialog"]')?.textContent?.includes('Uma prévia de teste'));
  await act(async () => { button('Revisar dados').click(); });
  assert.equal(mocks.calls.length, 0);
  await act(async () => { button('Executar chamada').click(); });
  await act(async () => { button('Confirmar e executar').click(); });
  assert.equal(mocks.calls.length, 1);
  assert.equal(mocks.calls[0].body, '{"instruction":"Uma prévia de teste"}');
  assert.equal(mocks.calls[0].url, 'https://api.example.com/functions/v1/leads-api?action=preview-flow-message');
}));

test('bloqueia JSON inválido e exemplos pendentes antes da confirmação', () => withView(async () => {
  await selectEndpoint('Criar lead');
  await act(async () => { button('Executar chamada').click(); });
  assert.ok(document.body.textContent?.includes('Substitua os valores de exemplo'));
  await setInput(document.querySelector('textarea')!, '{');
  await act(async () => { button('Executar chamada').click(); });
  assert.ok(document.body.textContent?.includes('objeto JSON válido'));
  assert.equal(mocks.calls.length, 0);
}));

test('mantém as permissões de observador e reserva rotinas internas ao servidor', () => withView(async () => {
  await selectEndpoint('Criar lead');
  assert.equal(button('Executar chamada').disabled, true);
  await selectEndpoint('Consultar leads');
  assert.equal(button('Executar chamada').disabled, false);
  await selectEndpoint('Processar fila de fluxos');
  assert.equal(button('Executar chamada').disabled, true);
  assert.ok(document.querySelector('pre[aria-label="cURL"]')?.textContent?.includes('$SUPABASE_SERVICE_ROLE_KEY'));
  assert.equal(mocks.calls.length, 0);
}, true));

test('filtra catálogo e preserva rascunho de cada operação', () => withView(async () => {
  await selectEndpoint('Pré-visualizar mensagem de IA');
  await setInput(document.querySelector('textarea')!, '{"instruction":"Meu rascunho"}');
  await selectEndpoint('Verificar conexão');
  await selectEndpoint('Pré-visualizar mensagem de IA');
  assert.ok(document.querySelector('textarea')?.value.includes('Meu rascunho'));
  const search = document.querySelector<HTMLInputElement>('input[placeholder="Nome ou caminho"]')!;
  await setInput(search, 'inatividade');
  assert.equal(document.querySelectorAll('.kds-api-endpoint').length, 1);
  await setInput(search, 'inexistente');
  assert.ok(document.body.textContent?.includes('Nenhuma operação encontrada'));
}));

test('cancela a espera sem indicar que uma operação no servidor foi desfeita', () => withView(async () => {
  mocks.waitForAbort = true;
  await act(async () => { button('Executar chamada').click(); });
  assert.equal(mocks.calls.length, 1);
  assert.ok(document.querySelectorAll<HTMLButtonElement>('.kds-api-endpoint')[0].disabled);
  await act(async () => { button('Cancelar espera').click(); });
  assert.ok(document.body.textContent?.includes('Uma operação já recebida pelo servidor pode continuar'));
  assert.equal(button('Executar chamada').disabled, false);
}));

