import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isDynamicImportError } from '../lazyImport';

test('reconhece falha de carregamento de chunk como erro recuperável', () => {
  assert.equal(isDynamicImportError(new TypeError('Failed to fetch dynamically imported module: /assets/inbox.js')), true);
  assert.equal(isDynamicImportError(new Error('Loading chunk WhatsAppInbox failed')), true);
  assert.equal(isDynamicImportError(new Error('Falha de permissão ao carregar dados')), false);
});
