import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import { hcommerceBeneficiaries, syntheticPdf } from '../__tests__/fixtures.ts';
import { classifyDocuments } from '../engine/analyze-documents.ts';
import { extractDeterministically } from './deterministic.ts';
import { buildLlmFallbackSchema, getLlmFallbackScope, parseLlmFallback } from './llm-fallback.ts';

describe('fallback seletivo V2', () => {
  test('não chama LLM quando todos os campos críticos foram resolvidos', () => {
    const classifications = classifyDocuments([hcommerceBeneficiaries()], 'auto');
    const deterministic = extractDeterministically(classifications);
    const scope = getLlmFallbackScope(classifications, deterministic);

    assert.equal(scope.shouldUseLlm, false);
  });

  test('schema contém somente campos ausentes e exige proveniência', () => {
    const classifications = classifyDocuments([
      syntheticPdf('generico', ['Proposta comercial sem campos identificáveis']),
    ], 'auto');
    const deterministic = extractDeterministically(classifications);
    const scope = getLlmFallbackScope(classifications, deterministic);
    const schema = buildLlmFallbackSchema(scope.fields, scope.holderFields, classifications) as {
      properties: { fields: { properties: Record<string, unknown> } };
    };

    assert.equal(scope.shouldUseLlm, true);
    assert.ok(schema.properties.fields.properties.codigo_contrato);
    assert.ok(schema.properties.fields.properties.produto_plano);
  });

  test('descarta CPF inválido e evidência com página inexistente', () => {
    const classifications = classifyDocuments([
      syntheticPdf('generico', ['Beneficiário Titular em proposta genérica']),
    ], 'auto');
    const patch = parseLlmFallback({
      text: JSON.stringify({
        fields: {
          produto_plano: { value: 'Plano Exemplo', file_id: 'generico', page: 99, section: 'Plano' },
        },
        holder: {
          cpf: { value: '123.456.789-00', file_id: 'generico', page: 1, section: 'Titular' },
        },
        warnings: [],
      }),
      fields: ['produto_plano'],
      holderFields: ['cpf'],
      classifications,
      method: 'llm_text',
    });

    assert.deepEqual(patch.values, {});
    assert.deepEqual(patch.provenance, {});
  });
});
