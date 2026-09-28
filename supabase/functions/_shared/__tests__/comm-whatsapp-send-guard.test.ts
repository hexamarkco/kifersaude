import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

import { createWhapiClient } from '../comm-whatsapp';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('rechecks permission before each text POST and stops a retry when the guard blocks it', async () => {
  let requests = 0;
  let checks = 0;
  globalThis.fetch = vi.fn(async () => {
    requests += 1;
    return new Response('{}', { status: 429 });
  }) as typeof fetch;

  const client = createWhapiClient('test-token');
  await assert.rejects(
    client.sendText('5521999991234@s.whatsapp.net', 'Campaign message', undefined, async () => {
      checks += 1;
      if (checks === 2) throw new Error('consent revoked');
    }),
    /consent revoked/,
  );

  assert.equal(checks, 2);
  assert.equal(requests, 1);
});

test('runs the optional guard before each generic POST attempt', async () => {
  let requests = 0;
  let checks = 0;
  globalThis.fetch = vi.fn(async () => {
    requests += 1;
    return new Response('{}', { status: requests === 1 ? 429 : 200 });
  }) as typeof fetch;

  const response = await createWhapiClient('test-token').post(
    'https://gate.whapi.cloud/messages/image',
    '{}',
    { 'Content-Type': 'application/json' },
    30_000,
    async () => { checks += 1; },
  );

  assert.equal(response.status, 200);
  assert.equal(requests, 2);
  assert.equal(checks, 2);
});

test('runs the optional guard before media POST and preserves unguarded health/read calls', async () => {
  let checks = 0;
  let requests = 0;
  const events: string[] = [];
  globalThis.fetch = vi.fn(async () => {
    requests += 1;
    events.push('fetch');
    const statuses = [200, 200, 200, 429, 200];
    return new Response('{}', { status: statuses[requests - 1] });
  }) as typeof fetch;

  const client = createWhapiClient('test-token');
  const mediaResponse = await client.sendMedia(
    'image',
    'body',
    { 'Content-Type': 'application/octet-stream' },
    undefined,
    async () => {
      checks += 1;
      events.push('permission');
    },
  );
  const healthResponse = await client.health();
  const readResponse = await client.fetchMessage('message-id');
  const unguardedSendResponse = await client.sendText('5521999991234@s.whatsapp.net', 'Noncommercial reply');

  assert.equal(mediaResponse.status, 200);
  assert.equal(healthResponse.status, 200);
  assert.equal(readResponse.status, 200);
  assert.equal(unguardedSendResponse.status, 200);
  assert.equal(checks, 1);
  assert.equal(requests, 5);
  assert.deepEqual(events, ['permission', 'fetch', 'fetch', 'fetch', 'fetch', 'fetch']);
});

test('preserves count and offset when requesting paginated Whapi resources', async () => {
  const requestedUrls: string[] = [];
  globalThis.fetch = vi.fn(async (input) => {
    requestedUrls.push(String(input));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  const client = createWhapiClient('test-token');
  await client.fetchChatMessages('5511999991234@s.whatsapp.net', {
    count: 100,
    offset: 200,
    sort: 'desc',
    timeTo: 1_700_000_000,
  });
  await client.fetchContacts({ count: 50, offset: 150 });

  const chatUrl = new URL(requestedUrls[0] ?? '');
  const contactsUrl = new URL(requestedUrls[1] ?? '');

  assert.equal(chatUrl.searchParams.get('count'), '100');
  assert.equal(chatUrl.searchParams.get('offset'), '200');
  assert.equal(chatUrl.searchParams.get('sort'), 'desc');
  assert.equal(chatUrl.searchParams.get('time_to'), '1700000000');
  assert.equal(contactsUrl.searchParams.get('count'), '50');
  assert.equal(contactsUrl.searchParams.get('offset'), '150');
});
