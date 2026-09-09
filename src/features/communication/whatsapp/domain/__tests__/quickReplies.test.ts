import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  getActiveQuickReplyMatch,
  normalizeWhatsAppQuickRepliesSettings,
  sanitizeWhatsAppQuickReplies,
  sanitizeWhatsAppQuickReplyShortcut,
  summarizeQuickReplyPreview,
  type WhatsAppQuickReply,
} from '../quickReplies';

const createQuickReply = (overrides: Partial<WhatsAppQuickReply> = {}): WhatsAppQuickReply => ({
  id: 'quick-1',
  name: 'Enviar proposta',
  shortcut: 'proposta',
  text: 'Segue a proposta.',
  created_at: null,
  updated_at: null,
  ...overrides,
});

test('normalizes shortcuts and makes duplicates deterministic', () => {
  assert.equal(sanitizeWhatsAppQuickReplyShortcut('  Olá, Cliente!  '), 'ola-cliente');
  assert.deepEqual(
    sanitizeWhatsAppQuickReplies([
      createQuickReply({ id: 'first' }),
      createQuickReply({ id: 'second' }),
    ]).map((quickReply) => quickReply.shortcut),
    ['proposta', 'proposta-2'],
  );
});

test('accepts the legacy quick_replies settings key', () => {
  const result = normalizeWhatsAppQuickRepliesSettings({
    quick_replies: [{ title: 'Saudação', text: 'Olá!' }],
  });

  assert.equal(result.quickReplies[0].name, 'Saudação');
  assert.equal(result.quickReplies[0].shortcut, 'saudacao');
});

test('finds an active slash command only at a word boundary', () => {
  assert.deepEqual(getActiveQuickReplyMatch('Oi /prop', { start: 8, end: 8 }), {
    query: 'prop',
    start: 3,
    end: 8,
  });
  assert.equal(getActiveQuickReplyMatch('url/prop', { start: 8, end: 8 }), null);
  assert.equal(getActiveQuickReplyMatch('/prop', { start: 0, end: 3 }), null);
});

test('creates a compact preview without cutting beyond 120 characters', () => {
  const preview = summarizeQuickReplyPreview(`  ${'a'.repeat(130)}  `);
  assert.equal(preview.length, 120);
  assert.equal(preview.endsWith('...'), true);
});
