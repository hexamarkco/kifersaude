import assert from 'node:assert/strict';
import { test } from 'vitest';

import { parseContractDocumentExtraction } from './domain.ts';

test('normaliza os valores de importação esperados pelo formulário de contrato', () => {
  const extraction = parseContractDocumentExtraction(JSON.stringify({
    profile: 'hcommerce',
    fields: {
      codigo_contrato: 'PJ0495808',
      data_inicio: '10/10/2025',
      mes_reajuste: '10',
      vidas: '03',
      ignored: 'não deve entrar',
    },
    field_sources: { codigo_contrato: 'titulares.pdf, página 1' },
    holder_count: 1,
    dependent_count: 2,
    warnings: ['Mensalidade não encontrada'],
  }));

  assert.equal(extraction.profile, 'hcommerce');
  assert.equal(extraction.fields.data_inicio, '2025-10-10');
  assert.equal(extraction.fields.mes_reajuste, '10');
  assert.equal(extraction.fields.vidas, '3');
  assert.equal(extraction.fields.codigo_contrato, 'PJ0495808');
  assert.equal(extraction.holderCount, 1);
  assert.equal(extraction.dependentCount, 2);
});

test('rejeita retorno que não seja JSON de objeto', () => {
  assert.throws(() => parseContractDocumentExtraction('[]'));
});
