import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

import {
  extractWhapiContactPhone,
  extractWhapiContactCardMeta,
  extractWhapiContactSaved,
  extractWhapiSavedContactName,
  fetchWhapiChatName,
  getDirectChatDisplayNameCandidate,
  isValidCommWhatsAppDisplayName,
  resolveVerifiedWhapiDirectIdentity,
} from '../comm-whatsapp';
import {
  extractWhapiParticipantDigits,
  isDirectWhapiChatId,
  isInboxWhapiChatId,
  isWhapiGroupChatId,
  normalizeWhapiChatId,
  normalizeWhapiParticipantId,
} from '../comm-whatsapp/identity';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockIdentityFetch = (responses: Record<string, unknown>) => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const key = decodeURIComponent(url.pathname);
    if (!(key in responses)) return new Response('{}', { status: 404 });
    return Response.json(responses[key]);
  }) as typeof fetch;
};

test('does not treat a LID as a phone number', () => {
  assert.equal(extractWhapiContactPhone({ id: '123456@lid', phone: '123456@lid' }), '');
});

test('keeps saved names separate from push names', () => {
  assert.equal(extractWhapiSavedContactName({ name: 'Contato salvo', phonebook: true }), 'Contato salvo');
  assert.equal(extractWhapiSavedContactName({ name: 'Push indevido', pushname: 'Push indevido', saved: false }), '');
});

test('ignores Whapi "saved" flag, since it is true for every chat partner, not just phonebook contacts', () => {
  assert.equal(extractWhapiContactSaved({ phonebook: true }), true);
  assert.equal(extractWhapiContactSaved({ saved: true }), false);
  assert.equal(extractWhapiContactSaved({ saved: true, phonebook: false }), false);
});

test('rejects provider identifiers as display names', () => {
  assert.equal(isValidCommWhatsAppDisplayName('123456@lid'), false);
  assert.equal(isValidCommWhatsAppDisplayName('5511999999999@s.whatsapp.net'), false);
});

test('prioritizes a profile push name over chat_name from an inbound webhook', () => {
  const name = getDirectChatDisplayNameCandidate({
    chat_name: 'Unidade: CMK - Nova Iguaçu',
    push_name: 'Klini Saúde',
  }, 'inbound');

  assert.equal(name, 'Klini Saúde');
});

test('does not use a shared contact card as the sender identity', () => {
  for (const type of ['contact', 'contact_list', ' CONTACT ']) {
    const message = {
      type,
      from_name: 'Mãe',
      contact: { name: 'Rafaela', pushname: 'Rafaela', push_name: 'Rafaela' },
    };
    assert.equal(getDirectChatDisplayNameCandidate(message, 'inbound'), 'Mãe');
    assert.equal(getDirectChatDisplayNameCandidate({ ...message, from_name: null }, 'inbound'), '');
  }
});

test('keeps shared card contents separate from inbound and outbound chat names', () => {
  const message = {
    type: 'contact',
    chat_name: 'Mãe',
    contact: { name: 'Rafaela', vcard: 'BEGIN:VCARD\nFN:Rafaela\nTEL:+5521983042170\nEND:VCARD' },
  };
  for (const direction of ['inbound', 'outbound'] as const) {
    assert.equal(getDirectChatDisplayNameCandidate(message, direction), 'Mãe');
  }
  assert.equal(extractWhapiContactCardMeta(message)?.items[0]?.name, 'Rafaela');
});

test('preserves contact identity metadata on messages without a shared card', () => {
  assert.equal(getDirectChatDisplayNameCandidate({
    type: 'text',
    contact: { name: 'Contato remetente' },
    from_name: 'Nome alternativo',
  }, 'inbound'), 'Contato remetente');
});

test('uses contact profile metadata before a low-confidence chat label', async () => {
  mockIdentityFetch({
    '/chats/552130550790@s.whatsapp.net': { chat_name: 'Unidade: CMK - Nova Iguaçu' },
    '/contacts/552130550790@s.whatsapp.net': { pushname: 'Klini Saúde' },
  });

  const name = await fetchWhapiChatName({
    token: 'test',
    chatId: '552130550790@s.whatsapp.net',
  });

  assert.equal(name, 'Klini Saúde');
});

test('accepts only a round-trip verified LID and WA ID pair', async () => {
  mockIdentityFetch({
    '/contacts/ids/123456@lid': { id: '5511999999999@s.whatsapp.net' },
    '/contacts/lids/5511999999999@s.whatsapp.net': { lid: '123456@lid' },
  });

  const identity = await resolveVerifiedWhapiDirectIdentity({ token: 'test', chatId: '123456@lid' });

  assert.equal(identity.verified, true);
  assert.equal(identity.lidChatId, '123456@lid');
  assert.equal(identity.phoneChatId, '5511999999999@s.whatsapp.net');
});

test('accepts Whapi canonicalization between equivalent Brazilian phone variants', async () => {
  mockIdentityFetch({
    '/contacts/lids/551187654321@s.whatsapp.net': { lid: '987654@lid' },
    '/contacts/ids/987654@lid': { id: '5511987654321@s.whatsapp.net' },
  });

  const identity = await resolveVerifiedWhapiDirectIdentity({
    token: 'test',
    chatId: '551187654321@s.whatsapp.net',
  });

  assert.equal(identity.verified, true);
  assert.equal(identity.phoneChatId, '5511987654321@s.whatsapp.net');
});

test('rejects a divergent reverse mapping', async () => {
  mockIdentityFetch({
    '/contacts/ids/123456@lid': { id: '5511999999999@s.whatsapp.net' },
    '/contacts/lids/5511999999999@s.whatsapp.net': { lid: '654321@lid' },
  });

  const identity = await resolveVerifiedWhapiDirectIdentity({ token: 'test', chatId: '123456@lid' });

  assert.equal(identity.verified, false);
  assert.equal(identity.reason, 'reverse_mismatch');
});

test('keeps group ids outside direct identity checks', () => {
  assert.equal(normalizeWhapiChatId('120363012345678901@g.us'), '120363012345678901@g.us');
  assert.equal(normalizeWhapiChatId('5511999999999'), '5511999999999@s.whatsapp.net');
  assert.equal(isWhapiGroupChatId('120363012345678901@g.us'), true);
  assert.equal(isDirectWhapiChatId('120363012345678901@g.us'), false);
  assert.equal(isInboxWhapiChatId('120363012345678901@g.us'), true);
  assert.equal(normalizeWhapiParticipantId('61371989950'), '61371989950');
  assert.equal(extractWhapiParticipantDigits('61371989950'), '61371989950');
});
