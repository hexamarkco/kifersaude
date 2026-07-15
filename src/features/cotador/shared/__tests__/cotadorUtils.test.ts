import assert from 'node:assert/strict';
import { test } from 'vitest';

import { decodeCotadorCatalogItemKey } from '../cotadorUtils';

test('decodifica chaves de catalogo validas', () => {
  assert.equal(decodeCotadorCatalogItemKey('amil%20premium'), 'amil premium');
});

test('rejeita chaves de catalogo malformadas sem quebrar a rota', () => {
  assert.equal(decodeCotadorCatalogItemKey('%'), null);
  assert.equal(decodeCotadorCatalogItemKey(null), null);
});
