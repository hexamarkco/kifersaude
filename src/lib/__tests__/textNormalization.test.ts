import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  normalizeContractTypeLabel,
  normalizeOperadoraLabel,
} from '../textNormalization';

test('normalizes operator labels before displaying or grouping them', () => {
  assert.equal(normalizeOperadoraLabel('Assim saúde'), 'Assim Saúde');
  assert.equal(normalizeOperadoraLabel('Assim Saúde'), 'Assim Saúde');
  assert.equal(normalizeOperadoraLabel('Porto Seguro'), 'Porto Seguro');
  assert.equal(normalizeOperadoraLabel('  Porto   seguro  '), 'Porto Seguro');
  assert.equal(normalizeOperadoraLabel(null), '');
});

test('groups PME contract type variants under one dashboard label', () => {
  assert.equal(normalizeContractTypeLabel('PME'), 'PME');
  assert.equal(normalizeContractTypeLabel('CNPJ'), 'PME');
  assert.equal(normalizeContractTypeLabel('MEI'), 'PME');
  assert.equal(normalizeContractTypeLabel('Empresarial'), 'PME');
  assert.equal(normalizeContractTypeLabel('Pessoa física'), 'Pessoa Física');
  assert.equal(normalizeContractTypeLabel('Adesao'), 'Adesão');
});
