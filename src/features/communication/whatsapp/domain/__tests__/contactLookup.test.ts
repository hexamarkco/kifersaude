import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  addSavedContactsToNameMap,
  collectPhoneLookupKeys,
  getSavedContactNameForPhone,
  resolveSavedContactName,
} from '../contactLookup';
import type { CommWhatsAppPhoneContact } from '../types';

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
