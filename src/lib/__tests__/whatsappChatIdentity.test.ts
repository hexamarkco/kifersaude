import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  buildDirectChatAliasSet,
  extractDirectPhoneNumber,
  getWhatsAppChatIdType,
  normalizeWhatsAppChatId,
  resolveInboundCanonicalDirectChatId,
} from '../whatsappChatIdentity';

test('normalizes legacy direct ids to the canonical phone JID', () => {
  assert.equal(normalizeWhatsAppChatId('5511998765432@c.us'), '5511998765432@s.whatsapp.net');
  assert.equal(getWhatsAppChatIdType('5511998765432@s.whatsapp.net'), 'phone');
});

test('treats lid ids as aliases instead of phone numbers', () => {
  assert.equal(getWhatsAppChatIdType('16946724607181@lid'), 'lid');
  assert.equal(extractDirectPhoneNumber('16946724607181@lid'), null);
  assert.deepEqual(buildDirectChatAliasSet({ chatId: '16946724607181@lid' }), ['16946724607181@lid']);
});

test('promotes inbound lid messages to the canonical phone chat when sender is known', () => {
  assert.equal(
    resolveInboundCanonicalDirectChatId(
      '16946724607181@lid',
      '16946724607181@lid',
      '5511998765432@s.whatsapp.net',
    ),
    '5511998765432@s.whatsapp.net',
  );
});
