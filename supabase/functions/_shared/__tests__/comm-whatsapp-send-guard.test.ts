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
