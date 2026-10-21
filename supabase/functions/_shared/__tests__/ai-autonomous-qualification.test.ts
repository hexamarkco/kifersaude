import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { BRAZIL_STATES } from '../../../../src/lib/brasilLocations';
import {
  extractAutonomousQualificationState,
  normalizeKnownOperator,
  qualificationStateIsComplete,
  type QualificationMessage,
} from '../ai-autonomous-qualification.ts';

const stateFrom = (messages: QualificationMessage[]) => extractAutonomousQualificationState(messages, '2026-09-17T12:00:00.000Z');

describe('ai autonomous qualification state', () => {
test('cidade sem UF conhecida nao conclui antes de obter o estado', () => {
  const state = stateFrom([
    { role: 'lead', content: 'Só para mim, tenho 38 anos. Moro em Santa Helena. Não tenho CNPJ nem MEI e não tenho plano.' },
  ]);
  assert.equal(state.location.state, null);
  assert.deepEqual(state.missingRequiredFields, ['state']);
  assert.equal(qualificationStateIsComplete(state), false);
});

test.each(BRAZIL_STATES)('aceita nome ou sigla de $nome sem substituir a cidade', ({ uf, nome }) => {
  for (const answer of [uf, uf.toLowerCase(), nome, `Sou do ${nome}`]) {
    const state = stateFrom([
      { role: 'lead', content: 'Só para mim, tenho 38 anos. Moro em Santa Helena. Não tenho CNPJ nem MEI e não tenho plano.' },
      { role: 'ai', content: 'Em qual estado fica Santa Helena?' },
      { role: 'lead', content: answer },
    ]);
    assert.equal(state.location.city, 'Santa Helena');
    assert.equal(state.location.state, uf);
    assert.equal(qualificationStateIsComplete(state), true);
  }
});

test.each(['Campinas, SP', 'Campinas/SP', 'Campinas - SP', 'Campinas SP', 'Campinas, sp', 'Campinas, São Paulo', 'Campinas no estado de São Paulo'])(
  'aproveita cidade e estado juntos em %s sem confundir o estado com a capital', (answer) => {
    const state = stateFrom([
      { role: 'ai', content: 'Em qual cidade e estado você precisa de atendimento?' },
      { role: 'lead', content: answer },
    ]);
    assert.equal(state.location.city, 'Campinas');
    assert.equal(state.location.state, 'SP');
    assert.equal(state.location.isCapital, false);
  },
);

test('aproveita cidade e estado enviados em mensagens consecutivas', () => {
  const state = stateFrom([
    { role: 'ai', content: 'Em qual cidade e estado você precisa de atendimento?' },
    { role: 'lead', content: 'Campinas' },
    { role: 'lead', content: 'São Paulo' },
  ]);
  assert.equal(state.location.city, 'Campinas');
  assert.equal(state.location.state, 'SP');
});

test('cidade e UF informadas no CRM sao aproveitadas sem nova pergunta', () => {
  const state = extractAutonomousQualificationState([
    { role: 'lead', content: 'Só para mim, tenho 38 anos. Não tenho CNPJ nem MEI e não tenho plano.' },
  ], '2026-10-19T16:00:00Z', { city: 'Campinas', state: 'São Paulo' });
  assert.equal(state.location.state, 'SP');
  assert.equal(qualificationStateIsComplete(state), true);
});

test('mudanca de cidade nao reaproveita UF antiga sem evidencia', () => {
  const state = stateFrom([
    { role: 'lead', content: 'Moro em Porto Alegre.' },
    { role: 'lead', content: 'Na verdade vou usar em Santa Helena.' },
  ]);
  assert.equal(state.location.city, 'Santa Helena');
  assert.equal(state.location.state, null);
  assert.ok(state.missingRequiredFields.includes('state'));
});

test('qualificacao completa com informacoes espontaneas nao cria perguntas artificiais', () => {
  const state = stateFrom([
    {
      role: 'lead',
      content: 'É para mim e minha esposa. Eu tenho 41 anos e ela 39. Somos de Niterói, RJ, no bairro Icaraí. Nenhum dos dois tem CNPJ ou MEI e hoje não temos plano.',
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

test('bairro e opcional mesmo em capital e continua sendo aproveitado quando informado', () => {
  const withoutNeighborhood = stateFrom([
    { role: 'lead', content: 'É para mim, tenho 38 anos. Moro no Rio de Janeiro. Não tenho CNPJ nem MEI e não tenho plano.' },
  ]);
  assert.equal(withoutNeighborhood.location.isCapital, true);
  assert.equal(withoutNeighborhood.location.neighborhoodRequired, false);
  assert.deepEqual(withoutNeighborhood.missingRequiredFields, []);
  assert.equal(qualificationStateIsComplete(withoutNeighborhood), true);

  const withNeighborhood = stateFrom([
    { role: 'lead', content: 'É para mim, tenho 38 anos. Moro no Rio de Janeiro, bairro Tijuca. Não tenho CNPJ nem MEI e não tenho plano.' },
  ]);
  assert.equal(withNeighborhood.location.neighborhood, 'Tijuca');
  assert.equal(qualificationStateIsComplete(withNeighborhood), true);
});

test.each(['Porto Alegre', 'Manaus', 'Recife', 'São Paulo', 'Brasília', 'Goiânia', 'Florianópolis'])(
  'qualifica em %s sem exigir bairro, inclusive com cidade vinda do CRM', (city) => {
    const messages: QualificationMessage[] = [
      { role: 'lead', content: 'Só para mim, tenho 38 anos. Não tenho CNPJ nem MEI e não tenho plano.' },
    ];
    const seeded = extractAutonomousQualificationState(messages, '2026-10-19T16:00:00Z', { city });
    const spoken = stateFrom([...messages, { role: 'lead', content: `Vou usar em ${city}.` }]);
    for (const state of [seeded, spoken]) {
      assert.equal(state.location.city, city);
      assert.equal(state.location.neighborhoodRequired, false);
      assert.equal(qualificationStateIsComplete(state), true);
    }
  },
);

test('aproveita idades em linhas separadas para mae e filha adulta sem criar terceira vida', () => {
  const state = stateFrom([
    { role: 'ai', content: 'Você busca um plano só para você ou para mais alguém da família?' },
    { role: 'lead', content: 'Sou eu e filha' },
    { role: 'lead', content: 'Ou só pra mim' },
    { role: 'lead', content: '54\n26' },
    { role: 'lead', content: 'Idades' },
    { role: 'ai', content: 'Em qual cidade vocês precisam de atendimento?' },
    { role: 'lead', content: 'Porto Alegre' },
  ]);
  assert.equal(state.lives.count, 2);
  assert.deepEqual(state.lives.items.map((life) => life.age), [54, 26]);
  assert.equal(state.location.city, 'Porto Alegre');
  assert.deepEqual(state.missingRequiredFields, ['has_cnpj_or_mei', 'has_current_health_plan']);
});

test('preserva tres vidas quando ha um adulto, uma adolescente e um bebe', () => {
  const state = stateFrom([
    { role: 'lead', content: 'Um seria pra mim, tenho 67 anos.' },
    { role: 'lead', content: 'Outro para uma adolescente de 13 anos e um bebê de 2 meses.' },
  ]);
  assert.equal(state.lives.count, 3);
  assert.deepEqual(state.lives.items.map((life) => life.age), [67, 13, 0]);
  assert.deepEqual(state.lives.items.map((life) => life.role), ['adult', 'child', 'child']);
});

test('numero do CNPJ e detalhes da operadora nao bloqueiam a conclusao', () => {
  const state = stateFrom([
    { role: 'lead', content: 'É para mim, tenho 32 anos, moro em Campinas, SP. Tenho MEI, mas prefiro não passar o número. Tenho plano, mas não sei qual é.' },
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
    { role: 'lead', content: 'Niterói, RJ' },
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

test('corrige somente o erro obvio de Klini sem inventar operadora', () => {
  assert.equal(normalizeKnownOperator('klin'), 'Klini');
  assert.equal(normalizeKnownOperator('Klini'), 'Klini');
  assert.equal(normalizeKnownOperator('operadora desconhecida'), null);

  const state = stateFrom([
    { role: 'ai', content: 'O plano será somente para você ou para mais alguém?' },
    { role: 'lead', content: 'Só para mim, tenho 27 anos.' },
    { role: 'ai', content: 'Em qual cidade você vai utilizar o plano e qual bairro?' },
    { role: 'lead', content: 'Rio de Janeiro, Santa Cruz.' },
    { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
    { role: 'lead', content: 'MEI.' },
    { role: 'ai', content: 'Você já tem plano de saúde atualmente?' },
    { role: 'lead', content: 'klin' },
  ]);

  assert.equal(state.currentHealthPlan.operator, 'Klini');
  assert.equal(qualificationStateIsComplete(state), true);
});

test('nao transforma a mesma idade repetida em novas vidas', () => {
  const state = stateFrom([
    { role: 'ai', content: 'Você busca um plano só para você ou para mais alguém da família?' },
    { role: 'lead', content: 'Só para minha filha de 46 anos' },
    { role: 'ai', content: 'Qual é a idade da sua filha?' },
    { role: 'lead', content: '46 anos' },
    { role: 'ai', content: 'Qual é a idade dela?' },
    { role: 'lead', content: 'Idade 46 anos' },
    { role: 'ai', content: 'Além dela, quais são as idades das outras duas pessoas que entrarão no plano?' },
    { role: 'lead', content: 'Ninguém vai no plano, só ela.' },
  ]);

  assert.equal(state.lives.count, 1);
  assert.deepEqual(state.lives.items.map((life) => life.age), [46]);
  assert.equal(state.missingRequiredFields.includes('lives'), false);
  assert.equal(state.missingRequiredFields.includes('ages'), false);
});

test('nao interpreta o numero de uma reclamacao como idade', () => {
  const state = stateFrom([
    { role: 'ai', content: 'O plano será somente para você ou para mais alguém da família?' },
    { role: 'lead', content: 'Só para minha filha de 46 anos' },
    { role: 'ai', content: 'Qual é a idade da sua filha?' },
    { role: 'lead', content: '46 anos' },
    { role: 'ai', content: 'Qual é a idade dela?' },
    { role: 'lead', content: 'Idade 46 anos' },
    { role: 'ai', content: 'Além dela, quais são as idades das outras duas pessoas que entrarão no plano?' },
    { role: 'lead', content: 'Você já me fez essa pergunta 2 vezes.' },
  ]);

  assert.equal(state.lives.count, 1);
  assert.deepEqual(state.lives.items.map((life) => life.age), [46]);
});

test('consolida respostas curtas da Karine sem inventar CNPJ ou plano', () => {
  const state = stateFrom([
    { role: 'lead', content: 'Pra mim' },
    { role: 'lead', content: 'Bom dia' },
    { role: 'ai', content: 'Bom dia. Qual é a sua idade?' },
    { role: 'lead', content: '44' },
    { role: 'ai', content: 'Em qual cidade você vai usar o plano?' },
    { role: 'lead', content: 'Cachoeiro de Itapemirim' },
    { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
    { role: 'lead', content: 'Nao' },
    { role: 'lead', content: 'Sou funcionária pública municipal' },
    { role: 'lead', content: 'Efetiva' },
    { role: 'ai', content: 'Você já tem plano de saúde atualmente?' },
    { role: 'lead', content: 'Nao' },
  ]);

  assert.equal(state.lives.count, 1);
  assert.deepEqual(state.lives.items.map((life) => life.age), [44]);
  assert.equal(state.location.city, 'Cachoeiro De Itapemirim');
  assert.equal(state.location.state, null);
  assert.equal(state.company.hasCnpjOrMei, 'no');
  assert.equal(state.currentHealthPlan.hasPlan, 'no');
  assert.equal(qualificationStateIsComplete(state), false);
  assert.deepEqual(state.missingRequiredFields, ['state']);
});
});
