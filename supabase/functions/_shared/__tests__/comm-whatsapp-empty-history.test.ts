import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

import { syncWhapiDirectChatMessages } from '../comm-whatsapp.ts';

const lid = '83313809203402@lid';
const phone = '5521991994782@s.whatsapp.net';
const channel = { id: 'channel', connected_user_name: 'Operadora', phone_number: '5521999999999' };

afterEach(() => vi.unstubAllGlobals());

function setup(options: { messages?: Record<string, unknown>[]; failHistory?: boolean; verified?: boolean; existing?: boolean; replay?: boolean } = {}) {
  const requests: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const path = decodeURIComponent(url.pathname);
    requests.push(path);
    if (path.startsWith('/messages/list/')) {
      return options.failHistory
        ? Response.json({ error: 'Unavailable' }, { status: 503 })
        : Response.json({ messages: options.messages ?? [], count: options.messages?.length ?? 0 });
    }
    if (options.verified && path === `/contacts/ids/${lid}`) return Response.json({ id: phone });
    if (options.verified && path === `/contacts/lids/${phone}`) return Response.json({ lid });
    if (path.startsWith('/chats/')) return Response.json({ name: 'Fabiola (Super)' });
    if (path.startsWith('/contacts/')) return new Response('{}', { status: 404 });
    throw new Error(`Unexpected provider request: ${path}`);
  }));
  const rpc = vi.fn(async (name: string, _input: Record<string, unknown>) => {
    switch (name) {
      case 'comm_whatsapp_get_canonical_chat_route':
        return { error: null, data: options.existing ? [{ chat_id: 'canonical', external_chat_id: phone }] : [] };
      case 'comm_whatsapp_reconcile_lid_identifier':
        return { error: null, data: [{ chat_id: 'canonical', external_chat_id: phone, merged: true }] };
      case 'comm_whatsapp_persist_message':
        return { error: null, data: [{ chat_id: 'canonical', message_id: 'message', inserted: !options.replay }] };
      default:
        throw new Error(`Unexpected RPC: ${name}`);
    }
  });
  const client = { rpc } as unknown as Parameters<typeof syncWhapiDirectChatMessages>[0];
  return { rpc, requests, run: () => syncWhapiDirectChatMessages(client, { channel, token: 'test', externalChatId: lid, timeTo: 900 }) };
}

test('imports real history through the verified canonical identity and retains the original provider id in metadata', async () => {
  const fixture = setup({ verified: true, messages: [{ id: 'provider-message', timestamp: 800, type: 'text', text: { body: 'Bom dia' } }] });
  const result = await fixture.run();
  assert.equal(result.chatId, 'canonical');
  assert.equal(result.inserted, 1);
  const persisted = fixture.rpc.mock.calls.find(([name]) => name === 'comm_whatsapp_persist_message')?.[1];
  assert.equal(persisted?.p_external_chat_id, phone);
  assert.equal((persisted?.p_metadata as Record<string, unknown>).chat_id, lid);
});

test('does not create or reconcile a discovered private chat with empty history', async () => {
  const fixture = setup({ verified: true });
  const result = await fixture.run();
  assert.equal(result.chatId, null);
  assert.equal(result.inserted, 0);
  assert.deepEqual(fixture.rpc.mock.calls.map(([name]) => name), ['comm_whatsapp_get_canonical_chat_route']);
  assert.deepEqual(fixture.requests, [`/messages/list/${lid}`]);
});

test('returns the existing canonical route for empty history without updating the chat', async () => {
  const fixture = setup({ existing: true });
  const result = await fixture.run();
  assert.equal(result.chatId, 'canonical');
  assert.equal(result.canonicalExternalChatId, phone);
  assert.equal(result.updated, 0);
  assert.deepEqual(fixture.rpc.mock.calls.map(([name]) => name), ['comm_whatsapp_get_canonical_chat_route']);
});

test('does not leave a ghost chat when the provider rejects the history request', async () => {
  const fixture = setup({ failHistory: true });
  await assert.rejects(fixture.run());
  assert.equal(fixture.rpc.mock.calls.length, 0);
});

test('preserves real private messages when the provider cannot resolve a phone', async () => {
  const fixture = setup({ messages: [{ id: 'private-message', timestamp: 800, type: 'text', text: { body: 'Olá' } }] });
  const result = await fixture.run();
  assert.equal(result.inserted, 1);
  const persisted = fixture.rpc.mock.calls.find(([name]) => name === 'comm_whatsapp_persist_message')?.[1];
  assert.equal(persisted?.p_external_chat_id, lid);
  assert.equal(persisted?.p_phone_number, '');
});

test('a page containing only existing messages does not prepare a second empty private chat', async () => {
  const fixture = setup({ replay: true, messages: [{ id: 'existing-message', timestamp: 800, type: 'text', text: { body: 'Bom dia' } }] });
  const result = await fixture.run();
  assert.equal(result.chatId, 'canonical');
  assert.equal(result.inserted, 0);
  assert.equal(result.updated, 1);
  assert.deepEqual(fixture.rpc.mock.calls.map(([name]) => name), [
    'comm_whatsapp_get_canonical_chat_route', 'comm_whatsapp_persist_message',
  ]);
});
