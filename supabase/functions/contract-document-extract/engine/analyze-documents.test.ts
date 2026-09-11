import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import { hcommerceBeneficiaries, hcommerceCompany, syntheticPdf } from '../__tests__/fixtures.ts';
import { classifyDocuments, selectCandidatePages, validateDocumentSet } from './analyze-documents.ts';

describe('classificação documental V2', () => {
  test('consolida bundle HCommerce pela chave interna, independentemente da ordem', () => {
    const classified = classifyDocuments([
      hcommerceBeneficiaries(),
      hcommerceCompany(),
    ], 'auto');

    assert.deepEqual(classified.map((item) => item.role), ['beneficiaries', 'company']);
    assert.deepEqual(classified.map((item) => item.family), ['hcommerce', 'hcommerce']);
    assert.deepEqual(classified.map((item) => item.bundleKey), ['PJ100001', 'PJ100001']);
    assert.doesNotThrow(() => validateDocumentSet(classified));
  });

  test('rejeita PDFs HCommerce de propostas diferentes', () => {
    const classified = classifyDocuments([
      hcommerceBeneficiaries('PJ100001'),
      hcommerceCompany('PJ200002'),
    ], 'auto');

    assert.throws(
      () => validateDocumentSet(classified),
      /identificadores de proposta diferentes/,
    );
  });

  test.each([
    ['planium', 'PROPOSTA DE CONTRATAÇÃO PF LEVE SAÚDE Dados cadastrais do Contratante'],
    ['qualicorp', 'QUALICORP CONTRATO DE ADESÃO PROPONENTE TITULAR'],
    ['supermed', 'SUPERMED CONTRATO DE ADESÃO Beneficiário Titular OPERADORA AMIL'],
    ['porto', 'PORTO SAÚDE INDICATIVO DE PREÇOS SAÚDE PME ORÇAMENTO DE PLANO DE SAÚDE'],
    ['medsenior', 'MEDSÊNIOR CONTRATO INDIVIDUAL SAMEDIL'],
  ] as const)('detecta a família %s pelas âncoras do conteúdo', (expected, text) => {
    const [classification] = classifyDocuments([syntheticPdf(expected, [text])], 'auto');
    assert.equal(classification.family, expected);
    assert.equal(classification.supportStatus, 'SUPPORTED_PROFILE');
  });

  test('mantém operador conhecido fora dos wrappers em fallback genérico', () => {
    const [classification] = classifyDocuments([
      syntheticPdf('generico', ['Proposta comercial SulAmérica para beneficiário']),
    ], 'auto');

    assert.equal(classification.family, 'generic');
    assert.equal(classification.operator, 'SulAmérica');
    assert.equal(classification.supportStatus, 'GENERIC_FALLBACK');
  });

  test.each([
    ['SulAmérica', 'SULAMÉRICA DIRETO RIO'],
    ['Klini Saúde', 'KLINI 300'],
    ['Assim Saúde', 'ASSIM SAÚDE A40'],
  ] as const)('Qualicorp preserva a operadora real %s', (expected, product) => {
    const [classification] = classifyDocuments([
      syntheticPdf('qualicorp', [`QUALICORP CONTRATO DE ADESÃO PLANO PRETENDIDO ${product}`]),
    ], 'auto');

    assert.equal(classification.family, 'qualicorp');
    assert.equal(classification.operator, expected);
  });

  test('Qualicorp não escolhe arbitrariamente quando há marcas de operadoras diferentes', () => {
    const [classification] = classifyDocuments([
      syntheticPdf('qualicorp-conflitante', [
        'QUALICORP CONTRATO DE ADESÃO PLANO PRETENDIDO SULAMÉRICA referência contratual ASSIM SAÚDE',
      ]),
    ], 'auto');

    assert.equal(classification.operator, null);
  });

  test('Qualicorp usa a identificação inicial quando o nome da operadora não aparece na tabela', () => {
    const [classification] = classifyDocuments([
      syntheticPdf('qualicorp-operadora-inicial', [
        'QUALICORP CONTRATO DE ADESÃO OPERADORA KLINI',
        'PLANO PRETENDIDO Produto 300 Adesão',
      ]),
    ], 'auto');

    assert.equal(classification.operator, 'Klini Saúde');
  });

  test('seleciona páginas por âncoras e exclui páginas apenas contratuais', () => {
    const [classification] = classifyDocuments([syntheticPdf('planium', [
      'CONDIÇÕES GERAIS LEI GERAL DE PROTEÇÃO DE DADOS',
      'PROPOSTA DE CONTRATAÇÃO PF LEVE SAÚDE RESUMO DA CONTRATAÇÃO Plano: Leve 200',
    ])], 'auto');
    const selected = selectCandidatePages([classification]);

    assert.equal(selected[0]?.page.page, 2);
  });

  test('reserva contexto para cada arquivo de um bundle', () => {
    const classified = classifyDocuments([
      hcommerceBeneficiaries(),
      hcommerceCompany(),
    ], 'auto');
    const selected = selectCandidatePages(classified, 2, 4_000);

    assert.deepEqual(new Set(selected.map((item) => item.document.fileId)), new Set(['beneficiarios', 'empresa']));
    assert.ok(selected.reduce((sum, item) => sum + item.page.text.length, 0) <= 4_000);
  });
});
