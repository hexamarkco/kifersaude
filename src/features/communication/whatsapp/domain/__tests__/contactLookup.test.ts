import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  addSavedContactsToNameMap,
  applySavedContactNameFromLookup,
  applySavedContactNameToContact,
  buildSavedContactNameMap,
  collectPhoneLookupKeys,
  getSavedContactNameForPhone,
  mergeSavedContactPages,
  resolveSavedContactName,
  selectPreferredSavedContacts,
} from '../contactLookup';
import type { CommWhatsAppChat, CommWhatsAppPhoneContact } from '../types';

test('creates Brazilian lookup variants with and without country code and ninth digit', () => {
  assert.deepEqual(
    new Set(collectPhoneLookupKeys('+55 (11) 99999-9999')),
    new Set(['5511999999999', '11999999999', '1199999999', '551199999999']),
  );
  assert.deepEqual(collectPhoneLookupKeys(''), []);
});

test('adds only saved named contacts to the phone lookup map', () => {
  const createContact = (overrides: Partial<CommWhatsAppPhoneContact>): CommWhatsAppPhoneContact => ({
    id: 'contact-1',
    channel_id: 'channel-1',
    contact_id: 'external-1',
    phone_number: '5511999999999',
    phone_digits: '5511999999999',
    display_name: 'Maria',
    saved: true,
    last_synced_at: '2026-09-08T12:00:00.000Z',
    created_at: '2026-09-08T12:00:00.000Z',
    updated_at: '2026-09-08T12:00:00.000Z',
    ...overrides,
  });
  const map = new Map<string, string>();

  addSavedContactsToNameMap(map, [
    createContact({}),
    createContact({ id: 'unsaved', saved: false, display_name: 'Ignorar' }),
    createContact({ id: 'unnamed', display_name: '  ' }),
  ]);

  assert.equal(map.get('5511999999999'), 'Maria');
  assert.equal(Array.from(map.values()).includes('Ignorar'), false);
});

test('keeps manual contact names in a separate higher-priority map', () => {
  const createContact = (overrides: Partial<CommWhatsAppPhoneContact>): CommWhatsAppPhoneContact => ({
    id: 'contact-1',
    channel_id: 'channel-1',
    contact_id: 'external-1',
    phone_number: '5511999999999',
    phone_digits: '5511999999999',
    display_name: 'Mariangela - Cliente',
    saved: true,
    last_synced_at: '2026-09-08T12:00:00.000Z',
    created_at: '2026-09-08T12:00:00.000Z',
    updated_at: '2026-09-08T12:00:00.000Z',
    ...overrides,
  });
  const synchronizedNames = new Map<string, string>();
  const manualNames = new Map<string, string>();

  addSavedContactsToNameMap(synchronizedNames, [
    createContact({}),
    createContact({
      id: 'manual-contact',
      contact_id: 'manual:5511999999999',
      display_name: 'Mariangela',
    }),
  ], manualNames);

  assert.equal(synchronizedNames.get('5511999999999'), 'Mariangela - Cliente');
  assert.equal(manualNames.get('5511999999999'), 'Mariangela');
  assert.equal(getSavedContactNameForPhone('5511999999999', manualNames, synchronizedNames), 'Mariangela');
});

test('does not let an older duplicate contact overwrite the newest name', () => {
  const createContact = (overrides: Partial<CommWhatsAppPhoneContact>): CommWhatsAppPhoneContact => ({
    id: 'contact-1',
    channel_id: 'channel-1',
    contact_id: 'external-1',
    phone_number: '5511999999999',
    phone_digits: '5511999999999',
    display_name: 'Nome atual',
    saved: true,
    last_synced_at: '2026-09-08T12:00:00.000Z',
    created_at: '2026-09-08T12:00:00.000Z',
    updated_at: '2026-09-08T12:00:00.000Z',
    ...overrides,
  });

  const preferred = selectPreferredSavedContacts([
    createContact({
      id: 'older',
      contact_id: 'external-older',
      display_name: 'Nome antigo',
      updated_at: '2026-09-08T11:00:00.000Z',
    }),
    createContact({
      id: 'newer',
      contact_id: 'external-newer',
      display_name: 'Nome atual',
      updated_at: '2026-09-08T13:00:00.000Z',
    }),
  ]);

  assert.deepEqual(preferred.map((contact) => contact.display_name), ['Nome atual']);
});

test('combina páginas de contatos sem duplicar uma linha repetida', () => {
  const createContact = (overrides: Partial<CommWhatsAppPhoneContact>): CommWhatsAppPhoneContact => ({
    id: 'contact-1',
    channel_id: 'channel-1',
    contact_id: 'external-1',
    phone_number: '5511999999999',
    phone_digits: '5511999999999',
    display_name: 'Nome antigo',
    saved: true,
    last_synced_at: '2026-09-08T12:00:00.000Z',
    created_at: '2026-09-08T12:00:00.000Z',
    updated_at: '2026-09-08T12:00:00.000Z',
    ...overrides,
  });

  const merged = mergeSavedContactPages(
    [createContact({})],
    [
      createContact({ display_name: 'Nome atualizado', updated_at: '2026-09-08T13:00:00.000Z' }),
      createContact({ id: 'contact-2', contact_id: 'external-2', phone_digits: '5521999999999', display_name: 'Outro contato' }),
    ],
  );

  assert.deepEqual(merged.map((contact) => contact.id), ['contact-1', 'contact-2']);
  assert.equal(merged[0]?.display_name, 'Nome atualizado');
});

test('sempre prioriza o contato salvo manualmente sobre o nome sincronizado', () => {
  const createContact = (overrides: Partial<CommWhatsAppPhoneContact>): CommWhatsAppPhoneContact => ({
    id: 'contact-1',
    channel_id: 'channel-1',
    contact_id: 'external-1',
    phone_number: '5521982965495',
    phone_digits: '5521982965495',
    display_name: 'Mariangela - Cliente',
    saved: true,
    last_synced_at: '2026-09-08T13:00:00.000Z',
    created_at: '2026-09-08T13:00:00.000Z',
    updated_at: '2026-09-08T13:00:00.000Z',
    ...overrides,
  });
  const map = new Map<string, string>();
  const manualNames = new Map<string, string>();

  addSavedContactsToNameMap(map, [
    createContact({}),
    createContact({
      id: 'manual',
      contact_id: 'manual:5521982965495',
      display_name: 'Mariangela',
      updated_at: '2026-09-08T09:00:00.000Z',
    }),
  ], manualNames);

  assert.equal(map.get('5521982965495'), 'Mariangela - Cliente');
  assert.equal(manualNames.get('5521982965495'), 'Mariangela');
  assert.equal(getSavedContactNameForPhone('5521982965495', manualNames, map), 'Mariangela');
});

test('mantém o nome manual ao consolidar respostas fora de ordem', () => {
  const contacts: CommWhatsAppPhoneContact[] = [
    {
      id: 'manual',
      channel_id: 'channel-1',
      contact_id: 'manual:5521982965495',
      phone_number: '5521982965495',
      phone_digits: '5521982965495',
      display_name: 'Mariangela',
      saved: true,
      manual_override: true,
      manual_override_name: 'Mariangela',
      last_synced_at: '2026-09-08T09:00:00.000Z',
      created_at: '2026-09-08T09:00:00.000Z',
      updated_at: '2026-09-08T09:00:00.000Z',
    },
    {
      id: 'provider',
      channel_id: 'channel-1',
      contact_id: 'provider-1',
      phone_number: '5521982965495',
      phone_digits: '5521982965495',
      display_name: 'Mariangela - Cliente',
      saved: true,
      manual_override: false,
      manual_override_name: null,
      last_synced_at: '2026-09-08T13:00:00.000Z',
      created_at: '2026-09-08T13:00:00.000Z',
      updated_at: '2026-09-08T13:00:00.000Z',
    },
  ];

  assert.equal(buildSavedContactNameMap(contacts).get('5521982965495'), 'Mariangela');
});

test('prioriza contato antigo marcado manualmente mesmo com contact_id do provedor', () => {
  const createContact = (overrides: Partial<CommWhatsAppPhoneContact>): CommWhatsAppPhoneContact => ({
    id: 'contact-1',
    channel_id: 'channel-1',
    contact_id: 'external-1',
    phone_number: '5521982965495',
    phone_digits: '5521982965495',
    display_name: 'Mariangela - Cliente',
    saved: true,
    last_synced_at: '2026-09-08T13:00:00.000Z',
    created_at: '2026-09-08T13:00:00.000Z',
    updated_at: '2026-09-08T13:00:00.000Z',
    ...overrides,
  });
  const synchronizedNames = new Map<string, string>();
  const manualNames = new Map<string, string>();

  addSavedContactsToNameMap(synchronizedNames, [
    createContact({
      id: 'manual-override',
      display_name: 'Mariangela',
      manual_override: true,
      manual_override_name: 'Mariangela',
      updated_at: '2026-09-08T09:00:00.000Z',
    }),
    createContact({
      id: 'provider-newer',
      display_name: 'Mariangela - Cliente',
      updated_at: '2026-09-08T13:00:00.000Z',
    }),
  ], manualNames);

  assert.equal(manualNames.get('5521982965495'), 'Mariangela');
  assert.equal(getSavedContactNameForPhone('5521982965495', manualNames, synchronizedNames), 'Mariangela');
});

test('prioritizes a locally saved name over a stale synchronized name', () => {
  const localOverrides = new Map([['5511999999999', 'Fabiola']]);
  const synchronizedNames = new Map([['5511999999999', 'Leve Saúde Operadora - Apoio Corretor']]);

  assert.equal(
    getSavedContactNameForPhone('+55 (11) 99999-9999', localOverrides, synchronizedNames),
    'Fabiola',
  );
});

test('ignores a blank chat name and falls back to the synchronized saved name', () => {
  const synchronizedNames = new Map([['5511999999999', 'Fabiola']]);

  assert.equal(
    resolveSavedContactName('+55 (11) 99999-9999', '   ', new Map(), synchronizedNames),
    'Fabiola',
  );
});

test('prioriza o contato salvo atual sobre um nome histórico retornado pelo chat', () => {
  const synchronizedNames = new Map([['5511999999999', 'Fabiola']]);

  assert.equal(
    resolveSavedContactName('+55 (11) 99999-9999', 'Leve Saúde Operadora - Apoio Corretor', new Map(), synchronizedNames),
    'Fabiola',
  );
});

test('mantém o nome do chat apenas quando o cache de contatos ainda não respondeu', () => {
  assert.equal(
    resolveSavedContactName('+55 (11) 99999-9999', 'Mariangela', new Map(), new Map()),
    'Mariangela',
  );
});

test('uses the synchronized saved name when the chat has no saved name yet', () => {
  const synchronizedNames = new Map([['5511999999999', 'Fabiola']]);

  assert.equal(
    resolveSavedContactName('+55 (11) 99999-9999', '   ', new Map(), synchronizedNames),
    'Fabiola',
  );
});

test('aplica o nome salvo também em um resultado de busca que veio com nome antigo', () => {
  const chat = {
    id: 'chat-1',
    channel_id: 'channel-1',
    external_chat_id: '5511999999999@s.whatsapp.net',
    phone_number: '+55 (11) 99999-9999',
    phone_digits: '5511999999999',
    display_name: 'Mariangela - Cliente',
    saved_contact_name: null,
    push_name: 'Mariangela 🤍',
    is_group: false,
  } as CommWhatsAppChat;

  const result = applySavedContactNameFromLookup(
    chat,
    new Map([['5511999999999', 'Mariangela']]),
    new Map([['5511999999999', 'Mariangela - Cliente']]),
  );

  assert.equal(result.display_name, 'Mariangela');
  assert.equal(result.saved_contact_name, 'Mariangela');
});

test('usa o nome do contato salvo como fonte canônica mesmo quando o chat veio com outro nome', () => {
  const chat = {
    id: 'chat-1',
    phone_number: '+55 (21) 98296-5495',
    phone_digits: '5521982965495',
    display_name: 'Leve Saúde Operadora - Apoio Corretor',
    saved_contact_name: 'Leve Saúde Operadora - Apoio Corretor',
    push_name: 'Mariangela - Cliente',
    is_group: false,
  } as CommWhatsAppChat;

  const result = applySavedContactNameFromLookup(
    chat,
    new Map(),
    new Map([['5521982965495', 'Mariangela']]),
  );

  assert.equal(result.display_name, 'Mariangela');
  assert.equal(result.saved_contact_name, 'Mariangela');
});

test('aplica o nome salvo também na lista de contatos do modal de novo chat', () => {
  const contact: CommWhatsAppPhoneContact = {
    id: 'contact-1',
    channel_id: 'channel-1',
    contact_id: 'external-1',
    phone_number: '+55 (21) 98296-5495',
    phone_digits: '5521982965495',
    display_name: 'Mariangela - Cliente',
    saved: true,
    last_synced_at: '2026-09-08T13:00:00.000Z',
    created_at: '2026-09-08T13:00:00.000Z',
    updated_at: '2026-09-08T13:00:00.000Z',
  };

  const result = applySavedContactNameToContact(
    contact,
    new Map([['5521982965495', 'Mariangela']]),
    new Map([['5521982965495', 'Mariangela - Cliente']]),
  );

  assert.equal(result.display_name, 'Mariangela');
});
