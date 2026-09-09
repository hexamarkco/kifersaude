import assert from 'node:assert/strict';
import { test } from 'vitest';

import { formatCommWhatsAppPhoneLabel } from '../phonePresentation';

test('formats Brazilian WhatsApp numbers without changing private identifiers', () => {
  assert.equal(formatCommWhatsAppPhoneLabel('5511999999999'), '+55 (11) 99999-9999');
  assert.equal(formatCommWhatsAppPhoneLabel('551133334444'), '+55 (11) 3333-4444');
  assert.equal(formatCommWhatsAppPhoneLabel('12345@lid'), 'Contato privado');
  assert.equal(formatCommWhatsAppPhoneLabel(null), 'Contato privado');
});
