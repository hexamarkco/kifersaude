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
