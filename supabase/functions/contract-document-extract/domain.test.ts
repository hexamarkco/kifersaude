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

test('converte as variações dos PDFs para as opções fechadas do CRM', () => {
  const extraction = parseContractDocumentExtraction(JSON.stringify({
    profile: 'auto',
    fields: {
      modalidade: 'Individual familiar',
      abrangencia: 'Grupo de Municípios',
      acomodacao: 'ENFERMARIA – Quarto Coletivo de até 3 leitos',
      carencia: 'Carência reduzida para consultas e exames',
    },
  }));

  assert.deepEqual(extraction.fields, {
    modalidade: 'Pessoa física',
    abrangencia: 'Regional',
    acomodacao: 'Enfermaria',
    carencia: 'Reduzida',
  });
});

test('não mantém dados empresariais em contratos sem empresa cliente', () => {
  const extraction = parseContractDocumentExtraction(JSON.stringify({
    profile: 'planium',
    fields: {
      modalidade: 'Individual',
      cnpj: '12.345.678/0001-90',
      razao_social: 'Dados da operadora que não são do cliente',
    },
    field_sources: {
      cnpj: 'Página 1',
      razao_social: 'Página 1',
    },
  }));

  assert.deepEqual(extraction.fields, { modalidade: 'Pessoa física' });
  assert.deepEqual(extraction.fieldSources, {});
  assert.equal(extraction.warnings.length, 1);
});

test('normaliza o plano Qualicorp marcado e a acomodação coletiva', () => {
  const extraction = parseContractDocumentExtraction(JSON.stringify({
    profile: 'qualicorp',
    fields: {
      modalidade: 'Coletivo por adesão',
      operadora: 'Assim Saúde',
      produto_plano: 'A40 QC ADESÃO COM COPART PARCIAL',
      acomodacao: 'Coletiva',
      cnpj: '00.000.000/0001-00',
      razao_social: 'Qualicorp Administradora de Benefícios',
    },
    field_sources: {
      produto_plano: 'Página 3 da proposta',
      acomodacao: 'Página 3 da proposta',
      cnpj: 'Página 1 da proposta',
    },
  }));

  assert.deepEqual(extraction.fields, {
    modalidade: 'Adesão',
    operadora: 'Assim Saúde',
    produto_plano: 'A40 QC ADESÃO COM COPART PARCIAL',
    acomodacao: 'Enfermaria',
  });
  assert.equal(extraction.fieldSources.cnpj, undefined);
  assert.equal(extraction.warnings.length, 1);
});

test('rejeita retorno que não seja JSON de objeto', () => {
  assert.throws(() => parseContractDocumentExtraction('[]'));
});

test('normaliza o padrão MedSênior e não usa dados da operadora como dados do cliente', () => {
  const extraction = parseContractDocumentExtraction(JSON.stringify({
    profile: 'medsenior',
    fields: {
      modalidade: 'Individual',
      operadora: 'SAMEDIL - SERVIÇOS DE ATENDIMENTO MÉDICO S.A.',
      produto_plano: 'MEDSÊNIOR RJ 1',
      acomodacao: 'ENFERMARIA – Quarto Coletivo de até 3 (três) leitos',
      cnpj: '31.466.949/0001-05',
      razao_social: 'SAMEDIL - SERVIÇOS DE ATENDIMENTO MÉDICO S.A.',
      nome_fantasia: 'MedSênior',
      endereco_empresa: 'Rua Pedro Fonseca, nº 170, Vitória - ES',
    },
    holder: {
      nome_completo: 'Alba Cristina Aquino dos Santos',
      cpf: '123.456.789-00',
      data_nascimento: '01/02/1960',
      telefone: '(27) 99999-9999',
    },
    field_sources: {
      cnpj: 'Página 2 do contrato',
      razao_social: 'Página 2 do contrato',
    },
  }));

  assert.equal(extraction.fields.modalidade, 'Pessoa física');
  assert.equal(extraction.fields.operadora, 'MedSênior');
  assert.equal(extraction.fields.produto_plano, 'RJ1');
  assert.equal(extraction.fields.acomodacao, 'Enfermaria');
  assert.equal(extraction.fields.cnpj, undefined);
  assert.equal(extraction.fields.razao_social, undefined);
  assert.equal(extraction.fields.nome_fantasia, undefined);
  assert.equal(extraction.fields.endereco_empresa, undefined);
  assert.equal(extraction.fieldSources.cnpj, undefined);
  assert.equal(extraction.warnings.length, 1);
  assert.deepEqual(extraction.holder, {
    nome_completo: 'Alba Cristina Aquino dos Santos',
    cpf: '123.456.789-00',
    data_nascimento: '1960-02-01',
    telefone: '(27) 99999-9999',
  });
});
