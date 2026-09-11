import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import { hcommerceBeneficiaries, hcommerceCompany, syntheticPdf } from '../__tests__/fixtures.ts';
import { classifyDocuments } from '../engine/analyze-documents.ts';
import { buildContractDocumentExtraction } from '../engine/build-extraction.ts';
import {
  extractDeterministically,
  isValidCnpj,
  isValidCpf,
  resolveFieldCandidates,
} from './deterministic.ts';

describe('extração determinística V2', () => {
  test('valida CPF e CNPJ com dígitos verificadores', () => {
    assert.equal(isValidCpf('529.982.247-25'), true);
    assert.equal(isValidCpf('123.456.789-00'), false);
    assert.equal(isValidCnpj('11.222.333/0001-81'), true);
    assert.equal(isValidCnpj('11.111.111/1111-11'), false);
  });

  test('consolida empresa, titular e contrato de um bundle HCommerce sintético', () => {
    const classifications = classifyDocuments([
      hcommerceCompany(),
      hcommerceBeneficiaries(),
    ], 'auto');
    const deterministic = extractDeterministically(classifications);
    const extraction = buildContractDocumentExtraction({
      classifications,
      deterministic,
      usedLlm: false,
      usedVision: false,
    });

    assert.equal(extraction.fields.codigo_contrato, 'PJ100001');
    assert.equal(extraction.fields.modalidade, 'Empresarial');
    assert.equal(extraction.fields.operadora, 'Assim Saúde');
    assert.equal(extraction.fields.cnpj, '11.222.333/0001-81');
    assert.equal(extraction.fields.razao_social, 'EMPRESA EXEMPLO LTDA');
    assert.equal(extraction.fields.produto_plano, 'ASSIM CLASSIC');
    assert.equal(extraction.fields.mensalidade_total, '1.234,56');
    assert.equal(extraction.fields.vidas, '3');
    assert.equal(extraction.holder?.cpf, '529.982.247-25');
    assert.equal(extraction.holderCount, 1);
    assert.equal(extraction.dependentCount, 2);
    assert.equal(extraction.metadata.bundleComplete, true);
    assert.equal(extraction.metadata.usedLlm, false);
    assert.equal(extraction.fieldProvenance.modalidade.method, 'deterministic');
    assert.equal(extraction.fieldProvenance.cnpj.method, 'text_parser');
  });

  test('Porto não promove orçamento ou estudo a código de contrato', () => {
    const classifications = classifyDocuments([syntheticPdf('porto', [
      `PORTO SAÚDE INDICATIVO DE PREÇOS SAÚDE PME ORÇAMENTO DE PLANO DE SAÚDE
       Orçamento: 700001 Número e validade do estudo 800002
       Dados da Empresa Razão Social: EMPRESA EXEMPLO LTDA CNPJ: 11.222.333/0001-81
       Data de vigência 10/10/2026
       Resumo OURO REGIONAL R$ 950,00 3 vidas Enfermaria Regional
       Valor total mensal para 3 vidas: R$ 2.850,00`,
    ])], 'auto');
    const deterministic = extractDeterministically(classifications);
    const extraction = buildContractDocumentExtraction({ classifications, deterministic, usedLlm: false, usedVision: false });

    assert.equal(extraction.profile, 'porto');
    assert.equal(extraction.fields.codigo_contrato, undefined);
    assert.equal(extraction.fields.mensalidade_total, '2.850,00');
    assert.equal(extraction.fields.vidas, '3');
    assert.equal(extraction.metadata.sourceDocumentNumbers.quoteNumber, '700001');
    assert.equal(extraction.metadata.sourceDocumentNumbers.studyNumber, '800002');
  });

  test('MedSênior preserva marca comercial e remove dados de empresa em modalidade individual', () => {
    const classifications = classifyDocuments([syntheticPdf('medsenior', [
      `MEDSÊNIOR SAMEDIL CONTRATO INDIVIDUAL Contrato nº: 900001
       PROPOSTA DE ADESÃO Nome Completo: Pessoa Exemplo CPF: 529.982.247-25
       Nome do Plano: MEDSÊNIOR RJ 1
       PADRÃO DE ACOMODAÇÃO EM INTERNAÇÃO ENFERMARIA
       ÁREA GEOGRÁFICA DE ABRANGÊNCIA DO PLANO DE SAÚDE Grupo de Municípios
       Razão Social: SAMEDIL CNPJ: 11.222.333/0001-81`,
    ])], 'auto');
    const deterministic = extractDeterministically(classifications);
    const extraction = buildContractDocumentExtraction({ classifications, deterministic, usedLlm: false, usedVision: false });

    assert.equal(extraction.fields.operadora, 'MedSênior');
    assert.equal(extraction.fields.produto_plano, 'RJ1');
    assert.equal(extraction.fields.acomodacao, 'Enfermaria');
    assert.equal(extraction.fields.cnpj, undefined);
    assert.equal(extraction.fields.razao_social, undefined);
  });

  test('Qualicorp lê plano, acomodação e abrangência somente da linha marcada', () => {
    const document = syntheticPdf('qualicorp', [
      `QUALICORP CONTRATO DE ADESÃO ASSIM SAÚDE
       PLANO PRETENDIDO
       A40 QC ADESÃO COM COPART PARCIAL Coletiva Grupo de Municípios
       CONDIÇÕES GERAIS Acomodação Apartamento Abrangência Nacional`,
    ]);
    document.pages[0].items = [
      { text: 'X', x: 56, y: 600, width: 8, height: 10 },
      { text: 'A40 QC ADESÃO COM', x: 174, y: 606, width: 95, height: 10 },
      { text: 'COPART PARCIAL', x: 174, y: 594, width: 75, height: 10 },
      { text: 'Coletiva', x: 437, y: 600, width: 50, height: 10 },
      { text: 'Grupo de', x: 508, y: 606, width: 45, height: 10 },
      { text: 'municípios³', x: 508, y: 594, width: 60, height: 10 },
      { text: 'Apartamento', x: 300, y: 300, width: 70, height: 10 },
      { text: 'Nacional', x: 400, y: 300, width: 50, height: 10 },
    ];
    const classifications = classifyDocuments([document], 'auto');
    const deterministic = extractDeterministically(classifications);
    const extraction = buildContractDocumentExtraction({ classifications, deterministic, usedLlm: false, usedVision: false });

    assert.equal(extraction.profile, 'qualicorp');
    assert.equal(extraction.fields.produto_plano, 'A40');
    assert.equal(extraction.fields.acomodacao, 'Enfermaria');
    assert.equal(extraction.fields.abrangencia, 'Regional');
    assert.match(extraction.fieldSources.produto_plano ?? '', /página 1 — PLANO PRETENDIDO — LINHA MARCADA/);
  });

  test('Qualicorp não promove menções contratuais sem uma linha visual marcada', () => {
    const classifications = classifyDocuments([syntheticPdf('qualicorp-sem-layout', [
      `QUALICORP CONTRATO DE ADESÃO ASSIM SAÚDE PLANO PRETENDIDO
       CONDIÇÕES GERAIS Acomodação Apartamento Abrangência Nacional`,
    ])], 'auto');
    const deterministic = extractDeterministically(classifications);

    assert.equal(deterministic.values.produto_plano, undefined);
    assert.equal(deterministic.values.acomodacao, undefined);
    assert.equal(deterministic.values.abrangencia, undefined);
  });

  test('não escolhe um valor quando candidatos de mesma prioridade conflitam', () => {
    const resolved = resolveFieldCandidates([
      { key: 'produto_plano', value: 'Plano A', priority: 90, provenance: { fileId: 'a', page: 1, section: 'PLANO', method: 'text_parser' } },
      { key: 'produto_plano', value: 'Plano B', priority: 90, provenance: { fileId: 'b', page: 1, section: 'PLANO', method: 'text_parser' } },
    ]);

    assert.equal(resolved.values.produto_plano, undefined);
    assert.equal(resolved.states.produto_plano, 'conflicting');
  });

  test('marca bundle HCommerce sem identificador comum como incompleto', () => {
    const beneficiaryWithoutKey = syntheticPdf('beneficiarios-sem-chave', [
      'Proposta de Admissão - Coletivo Empresarial Assim Saúde DADOS DO BENEFICIÁRIO TITULAR',
    ]);
    const classifications = classifyDocuments([hcommerceCompany(), beneficiaryWithoutKey], 'auto');
    const deterministic = extractDeterministically(classifications);
    const extraction = buildContractDocumentExtraction({ classifications, deterministic, usedLlm: false, usedVision: false });

    assert.equal(extraction.metadata.bundleComplete, false);
    assert.ok(extraction.warnings.some((warning) => warning.includes('Bundle HCommerce incompleto')));
  });
});
