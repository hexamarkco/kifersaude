import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import {
  AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS,
  buildReplyUserPrompt,
  inferQualificationCompletionHandoff,
  getReliableLeadFirstName,
  splitGeneratedReply,
  extractHandoff,
  normalizeHandoffCode,
  validateAutonomousReplyOutput,
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
  test('nao reapresenta a Luiza nem exige frase social na primeira resposta', () => {
    const prompt = buildReplyUserPrompt([
      { role: 'ai', content: 'Oi, tudo bem?' },
      { role: 'lead', content: 'Quero um plano para mim.' },
    ], {
      isFirstLeadReplyAfterApproach: true,
      leadFirstName: 'Maria',
    });

    assert.match(prompt, /PRIMEIRA RESPOSTA APOS A ABORDAGEM/);
    assert.match(prompt, /ja cumprimentou e apresentou a Luiza/i);
    assert.match(prompt, /pode usar apenas o primeiro nome validado "Maria"/i);
    assert.match(prompt, /Evite aberturas prontas como "prazer em falar com voce"/i);
    assert.doesNotMatch(prompt, /ABERTURA OBRIGATORIA DESTA RESPOSTA/);
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

    assert.doesNotMatch(prompt, /PRIMEIRA RESPOSTA APOS A ABORDAGEM/);
  });
});

describe('AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS', () => {
  test('protege interlocutor, beneficiarios e confirmacao de resposta ambigua', () => {
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /INTERLOCUTOR de BENEFICIARIOS/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Alguem que vai entrar no plano tem CNPJ ou MEI/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /voces dois tem 56 anos/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /planos empresariais por CNPJ\/MEI ficam mais em conta/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /depois de completar 6 meses de abertura/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /pessoa fisica como solucao temporaria/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /carencia para parto a termo e de 10 meses/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /ate 36 semanas e 6 dias/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /nunca apresente a idade de 12 anos como uma regra universal/i);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /o adolescente mais velho pode ser titular e o menor dependente/i);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /não insista para que um adulto que já tem plano entre em uma nova cotação/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /mostre que entendeu a situação concreta/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /voce e sempre a Luiza Kifer/i);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /nunca diga ou sugira que e IA/i);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /VINCULO ANTES DO ROTEIRO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /criar proximidade real/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /nao precisa parecer uma sequencia de formulario/);
  });
});

describe('validateAutonomousReplyOutput', () => {
  const iedaHistory: AutonomousMessageRow[] = [
    { role: 'lead', content: 'eu e meu marido' },
    { role: 'ai', content: 'Pode me dizer as idades de vocês?' },
    { role: 'lead', content: '56' },
  ];

  test('rejeita pedir apenas a idade do marido depois de uma unica idade no plural', () => {
    const result = validateAutonomousReplyOutput('E qual é a idade do seu marido?', iedaHistory);
    assert.equal(result.valid, false);
    assert.match(result.message ?? '', /Confirme em pergunta fechada/i);
  });

  test('aceita confirmar a hipotese mais provavel para as duas pessoas', () => {
    const result = validateAutonomousReplyOutput('Só para confirmar: vocês dois têm 56 anos?', iedaHistory);
    assert.equal(result.valid, true);
  });

  test('rejeita assumir a idade e seguir para outra pergunta', () => {
    const result = validateAutonomousReplyOutput('Em qual cidade vocês moram?', iedaHistory);
    assert.equal(result.valid, false);
  });

  test('rejeita CNPJ restrito ao interlocutor quando ha casal', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'O plano é para eu e meu marido.' },
      { role: 'ai', content: 'Vocês moram em qual cidade?' },
      { role: 'lead', content: 'Rio de Janeiro.' },
    ];
    assert.equal(validateAutonomousReplyOutput('Certo! Você possui CNPJ ou MEI?', history).valid, false);
    assert.equal(validateAutonomousReplyOutput('Você ou seu marido, algum dos dois tem CNPJ ou MEI?', history).valid, true);
    assert.equal(validateAutonomousReplyOutput('Alguém que vai entrar no plano tem CNPJ ou MEI?', history).valid, true);
  });

  test('direciona CNPJ ao filho quando o pai apenas conversa', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Estou procurando um plano para o meu filho.' },
      { role: 'ai', content: 'Qual a idade dele?' },
      { role: 'lead', content: '23 anos.' },
    ];
    assert.equal(validateAutonomousReplyOutput('Você tem CNPJ ou MEI?', history).valid, false);
    assert.equal(validateAutonomousReplyOutput('Seu filho tem CNPJ ou MEI?', history).valid, true);
  });

  test('responde com clareza quando o lead pergunta se CNPJ ou MEI muda o valor', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'ai', content: 'Alguém que vai entrar no plano tem CNPJ ou MEI?' },
      { role: 'lead', content: 'Isso muda alguma coisa?' },
    ];
    assert.equal(validateAutonomousReplyOutput('Vocês já possuem plano atualmente?', history).valid, false);
    assert.equal(
      validateAutonomousReplyOutput('Sim. Plano empresarial por CNPJ ou MEI geralmente fica mais em conta que pessoa física. Alguém da cotação possui?', history).valid,
      true,
    );
  });

  test('MEI com menos de 6 meses recebe oferta temporaria de pessoa fisica', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
      { role: 'lead', content: 'Tenho MEI sim, abri há 3 meses. Já consigo contratar por ele?' },
    ];

    assert.equal(
      validateAutonomousReplyOutput('A elegibilidade precisa ser confirmada. Me envia o número do CNPJ?', history).valid,
      false,
    );
    assert.equal(
      validateAutonomousReplyOutput('Como seu MEI tem 3 meses, ele ainda não pode ser usado: precisa completar 6 meses. Enquanto isso, posso cotar pessoa física para você não ficar sem cobertura. Faz sentido?', history).valid,
      true,
    );
  });

  test('informa 10 meses para parto mesmo quando havia plano anterior', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Estou grávida e já tive plano antes.' },
      { role: 'ai', content: 'Você está com plano hoje?' },
      { role: 'lead', content: 'Estou sem plano. Como funciona a carência para o parto?' },
    ];

    assert.equal(
      validateAutonomousReplyOutput('A carência e o aproveitamento do plano anterior precisam ser verificados na cotação.', history).valid,
      false,
    );
    assert.equal(
      validateAutonomousReplyOutput('Para parto a termo, a carência é de 10 meses, mesmo você já tendo tido plano antes. Como você já está grávida, uma contratação agora não completaria esse prazo para o parto desta gestação.', history).valid,
      true,
    );
  });

  test('usa o enquadramento de 2 meses somente para quem planeja engravidar', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Quero engravidar. Como funciona a carência do parto?' },
    ];
    assert.equal(validateAutonomousReplyOutput('A carência para parto é de 10 meses.', history).valid, false);
    assert.equal(
      validateAutonomousReplyOutput('A carência do parto a termo é de 10 meses. Na prática, depois de 2 meses de plano você já pode engravidar, porque os outros meses se completam durante a gestação.', history).valid,
      true,
    );
  });

  test('explica parto prematuro com corte e regra de urgencia', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'E se o parto for prematuro, o plano cobre mesmo na carência?' },
    ];
    assert.equal(validateAutonomousReplyOutput('Isso depende da operadora.', history).valid, false);
    assert.equal(
      validateAutonomousReplyOutput('Até 36 semanas e 6 dias, é parto prematuro e fica fora da carência de 10 meses do parto a termo. Ele segue as regras de urgência e emergência após 24 horas, conforme a cobertura hospitalar contratada.', history).valid,
      true,
    );
  });

  test('nao explica dependencia quando um adulto ja integra a cotacao', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Somos 6: eu 45, esposa 42 e filhos 20, 17, 14 e 10.' },
    ];
    assert.equal(
      validateAutonomousReplyOutput('O filho de 10 anos precisa entrar como dependente de um adulto titular. Em qual cidade vocês moram?', history).valid,
      false,
    );
    assert.equal(validateAutonomousReplyOutput('Em qual cidade vocês vão utilizar o plano?', history).valid, true);
  });

  test('rejeita exigir adulto como regra universal para cotacao apenas infantil', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Quero um plano para meus netos de 8 e 13 anos. Eu e a mãe deles já temos plano.' },
    ];

    const result = validateAutonomousReplyOutput(
      'Para o neto de 8 anos, é necessário um adulto titular entrar no plano.',
      history,
    );
    assert.equal(result.valid, false);
    assert.match(result.message ?? '', /elegibilidade varia por operadora/i);
  });

  test('aceita conduzir com acolhimento e elegibilidade condicionada à operadora', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Quero um plano para meus netos de 8 e 13 anos. Eu e a mãe deles já temos plano.' },
    ];

    assert.equal(
      validateAutonomousReplyOutput(
        'Entendo. Como vocês adultas já têm plano, a composição para os dois depende da operadora. Vou verificar a alternativa adequada e já te retorno. [[HANDOFF: PRECISA_HUMANO | elegibilidade infantil depende da operadora]]',
        history,
      ).valid,
      true,
    );
  });

  test('rejeita expor IA ou direcionar o lead para outra pessoa', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Quero cotar um plano para meus netos.' },
    ];

    for (const candidate of [
      'Sou uma assistente virtual e vou analisar isso.',
      'Vou pedir para o time verificar e já te retorno.',
      'Uma especialista vai conferir essa possibilidade.',
    ]) {
      const result = validateAutonomousReplyOutput(candidate, history);
      assert.equal(result.valid, false, candidate);
      assert.match(result.message ?? '', /conversa sempre com a Luiza/i);
    }
  });

  test('rejeita repetir o mesmo marcador das respostas recentes', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'ai', content: 'Certo! Quantas pessoas vão entrar?' },
      { role: 'lead', content: 'Duas.' },
    ];
    assert.equal(validateAutonomousReplyOutput('Certo! Quais são as idades?', history).valid, false);
    assert.equal(validateAutonomousReplyOutput('E quais são as idades?', history).valid, true);
  });

  test('aceita handoff tag-only para o encerramento seguro do worker', () => {
    assert.equal(
      validateAutonomousReplyOutput('[[HANDOFF: QUALIFICACAO_COMPLETA | completo]]', []).valid,
      true,
    );
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
