import assert from 'node:assert/strict';
import { test } from 'vitest';

import { normalizeCommWhatsAppPhoneDigits, normalizeWhapiDirectChatId } from '../whatsAppChatId';

test('normalizes Brazilian phone digits with missing country code', () => {
  assert.equal(normalizeCommWhatsAppPhoneDigits('(22) 99929-7995'), '5522999297995');
  assert.equal(normalizeCommWhatsAppPhoneDigits('5522999297995'), '5522999297995');
});

test('canonicalizes direct Whapi chat ids before sending', () => {
  assert.equal(normalizeWhapiDirectChatId('22999297995@s.whatsapp.net'), '5522999297995@s.whatsapp.net');
  assert.equal(normalizeWhapiDirectChatId('22999297995@c.us'), '5522999297995@s.whatsapp.net');
  assert.equal(normalizeWhapiDirectChatId('+55 (22) 99929-7995'), '5522999297995@s.whatsapp.net');
});

test('preserves non-direct chat identifiers', () => {
  assert.equal(normalizeWhapiDirectChatId('120363000000000000@g.us'), '120363000000000000@g.us');
});
