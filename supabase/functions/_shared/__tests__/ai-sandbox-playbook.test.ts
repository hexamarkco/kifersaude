import assert from 'node:assert/strict';
import { test } from 'vitest';

import { buildReplyUserPrompt, getReliableLeadFirstName, SYSTEM_PLAYBOOK } from '../ai-sandbox-playbook';

test('aceita somente primeiro nome de um nome completo confiavel', () => {
  assert.equal(getReliableLeadFirstName('mARIA da sILVA'), 'Maria');
  assert.equal(getReliableLeadFirstName('Cliente Teste'), null);
  assert.equal(getReliableLeadFirstName('OFERTA 2026'), null);
  assert.equal(getReliableLeadFirstName('Maria'), null);
});

test('abre a primeira resposta apos a abordagem com apresentacao pessoal, sem saudacao de horario', () => {
  const prompt = buildReplyUserPrompt([
    { role: 'ai', content: 'Oi, tudo bem?' },
    { role: 'lead', content: 'Quero um plano para mim.' },
  ], {
    isFirstLeadReplyAfterApproach: true,
    leadFirstName: 'Maria',
  });

  assert.match(prompt, /ABERTURA OBRIGATORIA DESTA RESPOSTA/);
  assert.match(prompt, /somente este primeiro nome validado, nunca o nome completo/i);
  assert.match(prompt, /"Maria, prazer em falar com você\."/);
  assert.match(prompt, /Nao use bom dia, boa tarde, boa noite/i);
  assert.match(prompt, /mesmo que o lead ja tenha dado informacoes/i);
});

test('nao usa nome quando o CRM nao forneceu um nome confiavel', () => {
  const prompt = buildReplyUserPrompt([
    { role: 'ai', content: 'Oi, tudo bem?' },
    { role: 'lead', content: 'Quero um plano para mim.' },
  ], {
    isFirstLeadReplyAfterApproach: true,
  });

  assert.match(prompt, /nome do CRM nao foi validado/i);
  assert.match(prompt, /Nao use nem invente nome/);
});

test('mantem o primeiro nome validado disponivel para uso ocasional ao longo da conversa', () => {
  const prompt = buildReplyUserPrompt([
    { role: 'ai', content: 'Oi, tudo bem?' },
    { role: 'lead', content: 'Quero um plano para mim.' },
    { role: 'ai', content: 'Maria, prazer em falar com você. Qual a sua idade?' },
    { role: 'lead', content: 'Tenho 32 anos.' },
  ], {
    leadFirstName: 'Maria',
  });

  assert.match(prompt, /Primeiro nome validado para uso eventual: "Maria"/);
  assert.match(prompt, /nao em mensagens consecutivas/);
});

test('exige variacao de confirmacoes e evita perfeito como muleta', () => {
  assert.match(SYSTEM_PLAYBOOK, /Nao repita a mesma abertura, elogio ou estrutura/i);
  assert.match(SYSTEM_PLAYBOOK, /"Perfeito" pode ser usado quando for genuino/i);
  assert.match(SYSTEM_PLAYBOOK, /NUNCA como muleta/i);
  assert.match(SYSTEM_PLAYBOOK, /detalhe concreto da resposta/i);
});

test('aplica as regras comerciais de MEI, CNPJ e quantidade minima de vidas', () => {
  assert.match(SYSTEM_PLAYBOOK, /MEI com mais de 6 meses de abertura/i);
  assert.match(SYSTEM_PLAYBOOK, /MEI tiver 6 meses ou menos.*NAO habilita plano empresarial/i);
  assert.match(SYSTEM_PLAYBOOK, /NAO explique prazo, alternativa de plano, migracao, reajuste ou estrategia ao lead/i);
  assert.match(SYSTEM_PLAYBOOK, /NAO prometa que vai ver, buscar ou enviar opcoes com base nesse MEI/i);
  assert.match(SYSTEM_PLAYBOOK, /MEI com menos de 6 meses/i);
  assert.doesNotMatch(SYSTEM_PLAYBOOK, /plano pessoa fisica temporario/i);
  assert.match(SYSTEM_PLAYBOOK, /CNPJ que NAO e MEI.*varia por operadora/i);
  assert.match(SYSTEM_PLAYBOOK, /algumas operadoras aceitam a partir de 1 vida, outras exigem 2 e outras 3/i);
  assert.match(SYSTEM_PLAYBOOK, /nao liste operadoras sem necessidade/i);
});

test('pede o numero do CNPJ primeiro e so pergunta sobre MEI quando ele nao estiver disponivel', () => {
  assert.match(SYSTEM_PLAYBOOK, /Pergunte o numero do CNPJ da empresa/i);
  assert.match(SYSTEM_PLAYBOOK, /Pode me mandar o numero do CNPJ, por favor/i);
  assert.match(SYSTEM_PLAYBOOK, /Se o lead nao estiver com o numero em maos, ai sim pergunte se a empresa e MEI ou outro tipo de CNPJ/i);
  assert.match(SYSTEM_PLAYBOOK, /isso influencia as opcoes e o valor/i);
  assert.match(SYSTEM_PLAYBOOK, /algumas operadoras so permitem fazer a cotacao com o CNPJ/i);
});

test('nao repete a apresentacao depois da primeira resposta', () => {
  const prompt = buildReplyUserPrompt([
    { role: 'ai', content: 'Oi, tudo bem?' },
    { role: 'lead', content: 'Quero um plano para mim.' },
    { role: 'ai', content: 'Maria, prazer em falar com você. Qual a sua idade?' },
    { role: 'lead', content: 'Tenho 32 anos.' },
  ], {
    isFirstLeadReplyAfterApproach: false,
    leadFirstName: 'Maria',
  });

  assert.doesNotMatch(prompt, /ABERTURA OBRIGATORIA DESTA RESPOSTA/);
  assert.doesNotMatch(prompt, /Esta e a primeira resposta apos a abordagem/);
});
