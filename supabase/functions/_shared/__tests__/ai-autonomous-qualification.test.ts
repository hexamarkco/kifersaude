import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  extractAutonomousQualificationState,
  qualificationStateIsComplete,
  type QualificationMessage,
} from '../ai-autonomous-qualification.ts';

const stateFrom = (messages: QualificationMessage[]) => extractAutonomousQualificationState(messages, '2026-09-17T12:00:00.000Z');

describe('ai autonomous qualification state', () => {
test('qualificacao completa com informacoes espontaneas nao cria perguntas artificiais', () => {
  const state = stateFrom([
    {
      role: 'lead',
      content: 'É para mim e minha esposa. Eu tenho 41 anos e ela 39. Somos de Niterói, no bairro Icaraí. Nenhum dos dois tem CNPJ ou MEI e hoje não temos plano.',
    },
  ]);

  assert.equal(state.lives.count, 2);
  assert.deepEqual(state.lives.items.map((life) => life.age), [41, 39]);
  assert.equal(state.location.city, 'Niterói');
  assert.equal(state.location.neighborhoodRequired, false);
  assert.equal(state.company.hasCnpjOrMei, 'no');
  assert.equal(state.currentHealthPlan.hasPlan, 'no');
  assert.equal(qualificationStateIsComplete(state), true);
});

test('capital exige bairro e bairro informado libera a qualificacao', () => {
  const withoutNeighborhood = stateFrom([
    { role: 'lead', content: 'É para mim, tenho 38 anos. Moro no Rio de Janeiro. Não tenho CNPJ nem MEI e não tenho plano.' },
  ]);
  assert.equal(withoutNeighborhood.location.isCapital, true);
  assert.deepEqual(withoutNeighborhood.missingRequiredFields, ['neighborhood']);

  const withNeighborhood = stateFrom([
    { role: 'lead', content: 'É para mim, tenho 38 anos. Moro no Rio de Janeiro, bairro Tijuca. Não tenho CNPJ nem MEI e não tenho plano.' },
  ]);
  assert.equal(withNeighborhood.location.neighborhood, 'Tijuca');
  assert.equal(qualificationStateIsComplete(withNeighborhood), true);
});

test('numero do CNPJ e detalhes da operadora nao bloqueiam a conclusao', () => {
  const state = stateFrom([
    { role: 'lead', content: 'É para mim, tenho 32 anos, moro em Campinas. Tenho MEI, mas prefiro não passar o número. Tenho plano, mas não sei qual é.' },
  ]);

  assert.equal(state.company.hasCnpjOrMei, 'yes');
  assert.equal(state.company.numberStatus, 'unknown');
  assert.equal(state.currentHealthPlan.hasPlan, 'yes');
  assert.equal(qualificationStateIsComplete(state), true);
});

test('menor de 12 sozinho exige adulto e 12 anos nao ativa a regra', () => {
  const childOnly = stateFrom([
    { role: 'lead', content: 'Quero cotação só para minha filha de 8 anos.' },
  ]);
  assert.equal(childOnly.singleUnderTwelveWithoutAdult, true);
  assert.equal(childOnly.compositionValid, false);
  assert.ok(childOnly.missingRequiredFields.includes('adult_for_under_12'));

  const twelve = stateFrom([
    { role: 'lead', content: 'É só para meu filho de 12 anos, em Niterói. Não tenho CNPJ nem MEI e não tenho plano.' },
  ]);
  assert.equal(twelve.singleUnderTwelveWithoutAdult, false);
  assert.equal(twelve.missingRequiredFields.includes('adult_for_under_12'), false);
});

test('mais de uma crianca nao e tratada como uma unica vida', () => {
  const state = stateFrom([
    { role: 'lead', content: 'Quero cotacao para meus dois filhos de 8 e 10 anos.' },
  ]);

  assert.equal(state.lives.count, 2);
  assert.deepEqual(state.lives.items.map((life) => life.age), [8, 10]);
  assert.equal(state.singleUnderTwelveWithoutAdult, false);
  assert.ok(state.missingRequiredFields.includes('adult_for_under_12') === false);
});

test('correcao mais recente substitui a idade anterior', () => {
  const state = stateFrom([
    { role: 'lead', content: 'É para mim e meu filho. Eu tenho 36 anos e ele tem 8 anos.' },
    { role: 'lead', content: 'Desculpa, ele fez 9 mês passado.' },
  ]);

  assert.deepEqual(state.lives.items.map((life) => life.age), [36, 9]);
});

test('respostas curtas sao extraidas usando a pergunta anterior como contexto', () => {
  const state = stateFrom([
    { role: 'ai', content: 'Para quantas pessoas e quais as idades?' },
    { role: 'lead', content: '3' },
    { role: 'ai', content: 'Quais sao as idades?' },
    { role: 'lead', content: '41, 39 e 9' },
    { role: 'ai', content: 'Em qual cidade voces moram?' },
    { role: 'lead', content: 'Niterói' },
    { role: 'ai', content: 'Alguem tem CNPJ ou MEI?' },
    { role: 'lead', content: 'Tem sim' },
    { role: 'ai', content: 'Hoje voces ja tem plano?' },
    { role: 'lead', content: 'Nao' },
  ]);

  assert.equal(state.lives.count, 3);
  assert.deepEqual(state.lives.items.map((life) => life.age), [41, 39, 9]);
  assert.equal(state.location.city, 'Niterói');
  assert.equal(state.company.hasCnpjOrMei, 'yes');
  assert.equal(state.currentHealthPlan.hasPlan, 'no');
  assert.equal(qualificationStateIsComplete(state), true);
});

test('interpreta quantidade e idade enviadas em mensagens curtas consecutivas', () => {
  const state = stateFrom([
    { role: 'ai', content: 'Você busca um plano só para você ou para mais alguém da família?' },
    { role: 'lead', content: 'Para 1' },
    { role: 'lead', content: '49' },
    { role: 'ai', content: 'Para uma pessoa de 49 anos, em qual cidade o plano será utilizado?' },
    { role: 'lead', content: 'São Gonçalo' },
  ]);

  assert.equal(state.lives.count, 1);
  assert.deepEqual(state.lives.items.map((life) => life.age), [49]);
  assert.equal(state.missingRequiredFields.includes('lives'), false);
  assert.equal(state.missingRequiredFields.includes('ages'), false);
});
});
