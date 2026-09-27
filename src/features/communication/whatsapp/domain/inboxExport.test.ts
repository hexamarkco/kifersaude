import assert from 'node:assert/strict';
import { test } from 'vitest';

import { loadInboxConversations } from './inboxExport';

const waitFor = async (predicate: () => boolean) => {
  while (!predicate()) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

test('carrega mensagens em paralelo limitado e preserva a ordem dos chats', async () => {
  const chats = ['chat-1', 'chat-2', 'chat-3', 'chat-4'];
  const releases = new Map<string, () => void>();
  const started: string[] = [];
  let active = 0;
  let maxActive = 0;

  const resultPromise = loadInboxConversations({
    chats,
    concurrency: 2,
    loadMessages: (chat) => new Promise<string[]>((resolve) => {
      started.push(chat);
      active += 1;
      maxActive = Math.max(maxActive, active);
      releases.set(chat, () => {
        active -= 1;
        resolve([`${chat}-message`]);
      });
    }),
  });

  await waitFor(() => started.length === 2);
  assert.equal(maxActive, 2);

  releases.get('chat-2')?.();
  await waitFor(() => started.includes('chat-3'));
  releases.get('chat-1')?.();
  releases.get('chat-3')?.();
  await waitFor(() => started.includes('chat-4'));
  releases.get('chat-4')?.();

  const result = await resultPromise;
  assert.deepEqual(result.conversations.map(({ chat }) => chat), chats);
  assert.equal(result.messagesExported, 4);
});

test('interrompe a exportação quando um chat falha', async () => {
  await assert.rejects(
    () => loadInboxConversations({
      chats: ['chat-1'],
      loadMessages: async () => {
        throw new Error('falha ao carregar mensagens');
      },
    }),
    /falha ao carregar mensagens/,
  );
});
