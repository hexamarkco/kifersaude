import assert from 'node:assert/strict';
import { test } from 'vitest';

import { canSearchWhatsAppMessages, MIN_MESSAGE_SEARCH_LENGTH } from '../messageSearch';

test('exige duas letras antes de consultar mensagens remotas', () => {
  assert.equal(MIN_MESSAGE_SEARCH_LENGTH, 2);
  assert.equal(canSearchWhatsAppMessages(''), false);
  assert.equal(canSearchWhatsAppMessages(' a '), false);
  assert.equal(canSearchWhatsAppMessages('ab'), true);
});

test('aceita consultas com acentos e espaços depois do limite mínimo', () => {
  assert.equal(canSearchWhatsAppMessages(' mãe '), true);
});
