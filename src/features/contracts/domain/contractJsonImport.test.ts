import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  parseBulkContractJsonImport,
  parseContractJsonImport,
} from './contractJsonImport';

const bulkContract = (overrides: Record<string, unknown> = {}) => ({
  codigo_contrato: 'CTR-001',
  status: 'Ativo',
  modalidade: 'PME',
  operadora: 'Operadora Exemplo',
  produto_plano: 'Plano Exemplo',
  responsavel: 'Equipe Comercial',
  ...overrides,
});

test('importação JSON de contratos: lê contrato e titular e converte números localizados', () => {
  const payload = parseContractJsonImport(JSON.stringify({
    contrato: {
      codigo_contrato: 'CTR-001',
      mensalidade_total: '1.250,50',
      data_inicio: '2026-10-01',
      data_renovacao: '2027-10',
    },
    titular: {
      nome_completo: 'Pessoa Exemplo',
      percentual_societario: '25,5',
    },
  }));

  assert.deepEqual(payload, {
    contract: {
      codigo_contrato: 'CTR-001',
      mensalidade_total: 1250.5,
      data_inicio: '2026-10-01',
      data_renovacao: '2027-10',
    },
    holder: {
      nome_completo: 'Pessoa Exemplo',
      percentual_societario: 25.5,
    },
  });
});

test('importação JSON de contratos: recusa campos desconhecidos', () => {
  assert.throws(() => parseContractJsonImport(JSON.stringify({
      contrato: { codigo: 'CTR-001' },
  })), /Campo não reconhecido em contrato: "codigo"/);
});

test('importação JSON de contratos: ignora bloco de titular sem dados', () => {
  const payload = parseContractJsonImport(JSON.stringify({
    contrato: { codigo_contrato: 'CTR-001' },
    titular: { nome_completo: '' },
  }));

  assert.equal(payload.holder, null);
});

test('importação JSON de contratos: valida datas em formato ISO', () => {
  assert.throws(() => parseContractJsonImport(JSON.stringify({
    contrato: { data_inicio: '31/10/2026' },
  })), /"contrato.data_inicio" deve usar o formato AAAA-MM-DD/);
});

test('importação JSON de contratos: recusa valores negativos em campos numéricos', () => {
  assert.throws(() => parseContractJsonImport(JSON.stringify({
    contrato: { mensalidade_total: -1250 },
  })), /"contrato.mensalidade_total" não pode ser negativo/);
});

test('importação JSON em massa: valida o lote e detecta códigos repetidos', () => {
  const parsed = parseBulkContractJsonImport(JSON.stringify({
    contratos: [bulkContract(), bulkContract({ codigo_contrato: 'CTR-002' })],
  }));

  assert.equal(parsed.contracts.length, 2);
  assert.throws(() => parseBulkContractJsonImport(JSON.stringify({
    contratos: [bulkContract(), bulkContract()],
  })), /O código "CTR-001" aparece mais de uma vez no arquivo/);
});

test('importação JSON em massa: rejeita campos obrigatórios ausentes', () => {
  const contractWithoutCode = {
    status: 'Ativo',
    modalidade: 'PME',
    operadora: 'Operadora Exemplo',
    produto_plano: 'Plano Exemplo',
    responsavel: 'Equipe Comercial',
  };

  assert.throws(() => parseBulkContractJsonImport(JSON.stringify({
    contratos: [contractWithoutCode],
  })), /Preencha "codigo_contrato" no contrato 1/);
});
