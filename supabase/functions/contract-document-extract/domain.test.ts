import assert from 'node:assert/strict';
import { test } from 'vitest';

import { normalizeContractDate, normalizeContractFieldValue } from './domain.ts';

test('normaliza datas brasileiras para o formato do formulário', () => {
  assert.equal(normalizeContractDate('10/10/2025'), '2025-10-10');
  assert.equal(normalizeContractDate('2025-10-10'), '2025-10-10');
  assert.equal(normalizeContractDate('sem data'), 'sem data');
});

test('normaliza as variações dos PDFs para as opções fechadas do CRM', () => {
  assert.equal(normalizeContractFieldValue('modalidade', 'Individual familiar'), 'Pessoa física');
  assert.equal(normalizeContractFieldValue('abrangencia', 'Grupo de Municípios'), 'Regional');
  assert.equal(
    normalizeContractFieldValue('acomodacao', 'ENFERMARIA – Quarto Coletivo de até 3 leitos'),
    'Enfermaria',
  );
  assert.equal(
    normalizeContractFieldValue('carencia', 'Carência reduzida para consultas e exames'),
    'Reduzida',
  );
});

test('normaliza mês de reajuste e quantidade de vidas', () => {
  assert.equal(normalizeContractFieldValue('mes_reajuste', '2'), '02');
  assert.equal(normalizeContractFieldValue('vidas', '03'), '3');
});
