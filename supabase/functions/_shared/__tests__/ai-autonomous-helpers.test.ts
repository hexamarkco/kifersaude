import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import {
  buildReplyUserPrompt,
  inferQualificationCompletionHandoff,
  getReliableLeadFirstName,
  splitGeneratedReply,
  extractHandoff,
  normalizeHandoffCode,
  HANDOFF_CODES,
  type AutonomousMessageRow,
} from '../ai-autonomous-helpers';

describe('getReliableLeadFirstName', () => {
  test('aceita somente primeiro nome de um nome completo confiavel', () => {
    assert.equal(getReliableLeadFirstName('mARIA da sILVA'), 'Maria');
    assert.equal(getReliableLeadFirstName('Cliente Teste'), null);
    assert.equal(getReliableLeadFirstName('OFERTA 2026'), null);
    assert.equal(getReliableLeadFirstName('Maria'), null);
  });
});

describe('buildReplyUserPrompt', () => {
  test('abre a primeira resposta apos a abordagem com apresentacao pessoal', () => {
    const prompt = buildReplyUserPrompt([
      { role: 'ai', content: 'Oi, tudo bem?' },
      { role: 'lead', content: 'Quero um plano para mim.' },
    ], {
      isFirstLeadReplyAfterApproach: true,
      leadFirstName: 'Maria',
    });

    assert.match(prompt, /ABERTURA OBRIGATORIA DESTA RESPOSTA/);
    assert.match(prompt, /somente este primeiro nome validado, nunca o nome completo/i);
  });

  test('nao usa nome quando o CRM nao forneceu um nome confiavel', () => {
    const prompt = buildReplyUserPrompt([
      { role: 'ai', content: 'Oi, tudo bem?' },
      { role: 'lead', content: 'Quero um plano para mim.' },
    ], {
      isFirstLeadReplyAfterApproach: true,
    });

    assert.match(prompt, /nome do CRM nao foi validado/i);
  });

  test('mantem o primeiro nome validado disponivel para uso ocasional', () => {
    const prompt = buildReplyUserPrompt([
      { role: 'ai', content: 'Oi, tudo bem?' },
      { role: 'lead', content: 'Quero um plano para mim.' },
      { role: 'ai', content: 'Maria, prazer em falar com você. Qual a sua idade?' },
      { role: 'lead', content: 'Tenho 32 anos.' },
    ], {
      leadFirstName: 'Maria',
    });

    assert.match(prompt, /Primeiro nome validado para uso eventual: "Maria"/);
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
  });
});

describe('normalizeHandoffCode', () => {
  test('reconhece todos os codigos validos', () => {
    assert.equal(normalizeHandoffCode('QUALIFICACAO_COMPLETA'), 'QUALIFICACAO_COMPLETA');
    assert.equal(normalizeHandoffCode('RECUSOU_COTACAO'), 'RECUSOU_COTACAO');
    assert.equal(normalizeHandoffCode('FORA_DE_ESCOPO'), 'FORA_DE_ESCOPO');
    assert.equal(normalizeHandoffCode('PRECISA_HUMANO'), 'PRECISA_HUMANO');
  });

  test('normaliza minusculas e espacos', () => {
    assert.equal(normalizeHandoffCode('  qualificacao_completa  '), 'QUALIFICACAO_COMPLETA');
    assert.equal(normalizeHandoffCode('recusou_cotacao'), 'RECUSOU_COTACAO');
  });

  test('codigo desconhecido cai em PRECISA_HUMANO', () => {
    assert.equal(normalizeHandoffCode('CODIGO_INEXISTENTE'), 'PRECISA_HUMANO');
    assert.equal(normalizeHandoffCode(''), 'PRECISA_HUMANO');
  });
});

describe('extractHandoff', () => {
  test('extrai codigo e nota de tag completa', () => {
    const result = extractHandoff('Perfeito, já tenho as infos. [[HANDOFF: QUALIFICACAO_COMPLETA | qualificacao completa]]');
    assert.equal(result.handoffCode, 'QUALIFICACAO_COMPLETA');
    assert.equal(result.handoffNote, 'qualificacao completa');
    assert.equal(result.text, 'Perfeito, já tenho as infos.');
  });

  test('extrai codigo sem nota', () => {
    const result = extractHandoff('Mensagem final. [[HANDOFF: FORA_DE_ESCOPO]]');
    assert.equal(result.handoffCode, 'FORA_DE_ESCOPO');
    assert.equal(result.handoffNote, null);
    assert.equal(result.text, 'Mensagem final.');
  });

  test('retorna null quando nao ha tag', () => {
    const result = extractHandoff('Mensagem normal sem handoff.');
    assert.equal(result.handoffCode, null);
    assert.equal(result.handoffNote, null);
    assert.equal(result.text, 'Mensagem normal sem handoff.');
  });

  test('tag-only retorna handoff com texto vazio', () => {
    const result = extractHandoff('[[HANDOFF: QUALIFICACAO_COMPLETA | completo]]');
    assert.equal(result.handoffCode, 'QUALIFICACAO_COMPLETA');
    assert.equal(result.text, '');
  });

  test('remove tag do texto visivel', () => {
    const result = extractHandoff('Oi! Tudo certo. [[HANDOFF: PRECISA_HUMANO | situacao complexa]]');
    assert.ok(!result.text.includes('[[HANDOFF'));
    assert.ok(result.text.startsWith('Oi!'));
  });
});

describe('splitGeneratedReply — handoff lifecycle', () => {
  test('mensagem + QUALIFICACAO_COMPLETA → mensagem visivel + codigo', () => {
    const raw = 'Perfeito, já tenho as informações necessárias. Vou preparar as opções. [[HANDOFF: QUALIFICACAO_COMPLETA | qualificacao completa]]';
    const { messages, handoffCode, handoffNote } = splitGeneratedReply(raw, false);

    assert.equal(handoffCode, 'QUALIFICACAO_COMPLETA');
    assert.equal(handoffNote, 'qualificacao completa');
    assert.equal(messages.length, 1);
    assert.ok(!messages[0].includes('[[HANDOFF'));
    assert.ok(messages[0].includes('Perfeito'));
  });

  test('tag-only retorna mensagem vazia + handoff code', () => {
    const raw = '[[HANDOFF: QUALIFICACAO_COMPLETA | completo]]';
    const { messages, handoffCode } = splitGeneratedReply(raw, false);

    assert.equal(handoffCode, 'QUALIFICACAO_COMPLETA');
    assert.equal(messages.length, 0);
  });

  test('mensagem sem handoff → sem codigo', () => {
    const raw = 'Oi! Tudo bem? Qual a sua idade?';
    const { messages, handoffCode } = splitGeneratedReply(raw, false);

    assert.equal(handoffCode, null);
    assert.equal(messages.length, 1);
    assert.equal(messages[0], 'Oi! Tudo bem? Qual a sua idade?');
  });

  test('RECUSOU_COTACAO funciona igual', () => {
    const raw = 'Entendo, vou encerrar por aqui. [[HANDOFF: RECUSOU_COTACAO | lead recusou]]';
    const { handoffCode } = splitGeneratedReply(raw, false);
    assert.equal(handoffCode, 'RECUSOU_COTACAO');
  });

  test('FORA_DE_ESCOPO funciona igual', () => {
    const raw = 'Desculpe, não trabalho com isso. [[HANDOFF: FORA_DE_ESCOPO | seguro de vida]]';
    const { handoffCode } = splitGeneratedReply(raw, false);
    assert.equal(handoffCode, 'FORA_DE_ESCOPO');
  });

  test('tag removida antes de envio ao WhatsApp', () => {
    const raw = 'Mensagem final. [[HANDOFF: QUALIFICACAO_COMPLETA | ok]]';
    const { messages } = splitGeneratedReply(raw, false);
    for (const msg of messages) {
      assert.ok(!msg.includes('[['), `Mensagem contém tag: ${msg}`);
      assert.ok(!msg.includes('HANDOFF'), `Mensagem contém HANDOFF: ${msg}`);
    }
  });

  test('splitIntoParts=false mantém como unica mensagem', () => {
    const raw = 'Linha 1\n---\nLinha 2 [[HANDOFF: QUALIFICACAO_COMPLETA]]';
    const { messages, handoffCode } = splitGeneratedReply(raw, false);
    assert.equal(handoffCode, 'QUALIFICACAO_COMPLETA');
    assert.equal(messages.length, 1);
  });

  test('splitIntoParts=true separa por ---', () => {
    const raw = 'Mensagem 1\n---\nMensagem 2 [[HANDOFF: QUALIFICACAO_COMPLETA]]';
    const { messages, handoffCode } = splitGeneratedReply(raw, true);
    assert.equal(handoffCode, 'QUALIFICACAO_COMPLETA');
    assert.equal(messages.length, 2);
    assert.ok(messages[0].includes('Mensagem 1'));
    assert.ok(messages[1].includes('Mensagem 2'));
  });
});

describe('inferQualificationCompletionHandoff', () => {
  test('protege o handoff quando a IA promete preparar a cotação sem a tag técnica', () => {
    assert.equal(
      inferQualificationCompletionHandoff(['Certo, Jefferson! Vou preparar sua cotação e já te retorno.']),
      'QUALIFICACAO_COMPLETA',
    );
  });

  test('nao encerra apenas por mencionar cotação sem assumir o envio', () => {
    assert.equal(
      inferQualificationCompletionHandoff(['Posso preparar uma cotação depois que eu confirmar a sua cidade.']),
      null,
    );
  });
});

describe('contrato de handoff — códigos validos', () => {
  test('todos os codigos sao strings nao-vazias', () => {
    for (const code of HANDOFF_CODES) {
      assert.ok(typeof code === 'string');
      assert.ok(code.length > 0);
      assert.equal(code, code.toUpperCase());
    }
  });

  test('QUALIFICACAO_COMPLETA existe', () => {
    assert.ok(HANDOFF_CODES.includes('QUALIFICACAO_COMPLETA'));
  });

  test('RECUSOU_COTACAO existe', () => {
    assert.ok(HANDOFF_CODES.includes('RECUSOU_COTACAO'));
  });

  test('FORA_DE_ESCOPO existe', () => {
    assert.ok(HANDOFF_CODES.includes('FORA_DE_ESCOPO'));
  });

  test('PRECISA_HUMANO existe', () => {
    assert.ok(HANDOFF_CODES.includes('PRECISA_HUMANO'));
  });
});
