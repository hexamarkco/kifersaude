import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

import { fetchWhapiChatMessagesPage } from '../comm-whatsapp.ts';

const syncAllSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-sync-all-chats/index.ts'),
  'utf8',
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('a sincronização geral busca a página mais recente da Whapi', () => {
  const syncCallStart = syncAllSource.indexOf('syncWhapiInboxChatMessages(supabaseAdmin, {');
  assert.notEqual(syncCallStart, -1);
  assert.match(syncAllSource.slice(syncCallStart, syncCallStart + 400), /sort: 'desc'/);
});

test('a consulta à Whapi preserva o sentido de ordenação solicitado', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  await fetchWhapiChatMessagesPage({
    token: 'test-token',
    chatId: '5521979352990@s.whatsapp.net',
    count: 25,
    offset: 0,
    sort: 'desc',
  });

  const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
  assert.equal(requestedUrl.searchParams.get('sort'), 'desc');
  assert.equal(requestedUrl.searchParams.get('count'), '25');
  assert.equal(requestedUrl.searchParams.get('offset'), '0');
});

test('repete somente a leitura de histórico após timeout e preserva o cursor', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockImplementationOnce((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('The signal has been aborted', 'AbortError')));
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'recovered' }] })));
  vi.stubGlobal('fetch', fetchMock);

  const pending = fetchWhapiChatMessagesPage({ token: 'test-token', chatId: '123@s.whatsapp.net', offset: 25, count: 25, timeTo: 900, sort: 'desc' });
  await vi.advanceTimersByTimeAsync(30_000);
  const page = await pending;
  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[0][0], fetchMock.mock.calls[1][0]);
  assert.equal(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('offset'), '25');
  assert.equal(page.messages[0].id, 'recovered');
  assert.equal(vi.getTimerCount(), 0);
});

test('encerra após dois timeouts com orientação em português', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('The signal has been aborted', 'AbortError')));
  }));
  vi.stubGlobal('fetch', fetchMock);
  const pending = fetchWhapiChatMessagesPage({ token: 'test-token', chatId: '123@s.whatsapp.net' });
  const rejected = assert.rejects(pending, /WhatsApp demorou.*tente recuperar/);
  await vi.advanceTimersByTimeAsync(60_000);
  await rejected;
  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(vi.getTimerCount(), 0);
});

test('não repete consulta rejeitada por autenticação', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
  vi.stubGlobal('fetch', fetchMock);
  await assert.rejects(fetchWhapiChatMessagesPage({ token: 'test-token', chatId: '123@s.whatsapp.net' }));
  assert.equal(fetchMock.mock.calls.length, 1);
});
