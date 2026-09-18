import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

import {
  AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS,
  AUTONOMOUS_QUALIFICATION_HANDOFF_INSTRUCTION,
  buildAutonomousAttendanceUserPrompt,
  buildReplyUserPrompt,
  getReliableLeadFirstName,
  normalizeLeadVisibleMessageStyle,
  splitGeneratedReply,
  extractHandoff,
  normalizeHandoffCode,
  validateAutonomousReplyOutput,
  HANDOFF_CODES,
  CHILD_ONLY_ELIGIBILITY_VALIDATION_MESSAGE,
  CHILD_ONLY_SCOPE_VALIDATION_MESSAGE,
  QUALIFICATION_CLOSURE_VALIDATION_MESSAGE,
  QUALIFICATION_REPETITION_VALIDATION_MESSAGE,
  MULTIPLE_BENEFICIARIES_SCOPE_VALIDATION_MESSAGE,
  SINGLE_ADULT_WITH_MINORS_BUSINESS_ID_VALIDATION_MESSAGE,
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

describe('paridade do prompt de atendimento', () => {
  test('usa o historico como fonte e inclui as regras de handoff no prompt usado pelo inbox', () => {
    const prompt = buildAutonomousAttendanceUserPrompt(
      [{ role: 'lead', content: 'Tenho 44 anos.' }],
    );

    assert.match(prompt, /ANALISE O HISTORICO/);
    assert.doesNotMatch(prompt, /ESTADO DETERMINISTICO DA QUALIFICACAO/);
    assert.equal(prompt.includes(AUTONOMOUS_QUALIFICATION_HANDOFF_INSTRUCTION), true);
  });
});

describe('AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS', () => {
  test('protege interlocutor, beneficiarios e confirmacao de resposta ambigua', () => {
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /INTERLOCUTOR de BENEFICIARIOS/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /algum beneficiario adulto tem CNPJ ou MEI/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /JUSTIFICATIVA CNPJ\/MEI/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /pode ficar mais em conta por CNPJ\/MEI/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /coletivo por adesao/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /VINCULO PUBLICO E COLETIVO POR ADESAO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /tabelas melhores ou mais competitivas/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Nao diga que ser funcionario publico nao impede a cotacao/);
    assert.doesNotMatch(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Ser funcionária pública não impede a cotação/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /CNPJ\/MEI E IDADE/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Criancas e adolescentes nao contam/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /pergunte diretamente ao adulto/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /voces dois tem 56 anos/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /planos empresariais por CNPJ\/MEI ficam mais em conta/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /depois de completar 6 meses de abertura/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /pessoa fisica como solucao temporaria/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /carencia para parto a termo e de 10 meses/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /ate 36 semanas e 6 dias/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /BASE OBRIGATORIA DA QUALIFICACAO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /PLANO ATUAL E MOTIVO DA TROCA/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /custo, rede, reajuste, atendimento, cobertura/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /contexto comercial opcional e nunca bloqueia/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /bairro quando essa cidade for uma capital/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /MENOR DE 12 ANOS/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Não aplique essa regra a adolescentes de 12 anos ou mais/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /mostre que entendeu a situação concreta/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /voce e sempre a Luiza Kifer/i);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /nunca diga ou sugira que e IA/i);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /VINCULO ANTES DO ROTEIRO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /criar proximidade real/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /nao precisa parecer uma sequencia de formulario/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Se o lead ja disser que e pessoa fisica/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /EMPATIA SEM ENROLAÇÃO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /TOM MEIGO E PROXIMO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Nao use coracao como recurso padrao/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /PONTE HUMANA ANTES DA PERGUNTA/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Agora preciso saber/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Se as duas respostas anteriores da Luiza foram perguntas diretas/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /RITMO HUMANO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /COPY VISIVEL/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /nao pode usar travessao.*dois-pontos/i);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /REPETIÇÃO ZERO/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /Vou considerar/);
    assert.match(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, /ENCERRAMENTO HUMANO/);
  });
});

describe('copy visible style', () => {
  test('pede resposta curta, contextualizada e sem pontuacao rejeitada', () => {
    const prompt = buildReplyUserPrompt([
      { role: 'ai', content: 'Oi, tudo bem?' },
      { role: 'lead', content: 'Quero cotar para minhas filhas em Campos.' },
    ]);

    assert.match(prompt, /Mostre que voce entendeu somente quando isso trouxer proximidade real/i);
    assert.match(prompt, /Faca no maximo uma pergunta/i);
    assert.match(prompt, /ultima mensagem do LEAD.*saudacao.*ultima resposta substantiva/i);
    assert.match(prompt, /nao pode conter travessao.*dois-pontos/i);
  });

  test('normaliza dois-pontos e travessao antes do envio', () => {
    const normalized = normalizeLeadVisibleMessageStyle('Entendi: vamos comparar as opções — para você.');
    assert.equal(normalized, 'Entendi, vamos comparar as opções, para você.');
    assert.doesNotMatch(normalized, /[:：—–]/);
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
    const result = validateAutonomousReplyOutput('Só para confirmar, vocês dois têm 56 anos?', iedaHistory);
    assert.equal(result.valid, true);
  });

  test('rejeita espelhamento artificial no encerramento da qualificacao', () => {
    const completeHistory: AutonomousMessageRow[] = [
      { role: 'ai', content: 'O plano será somente para você?' },
      { role: 'lead', content: 'Só para mim, tenho 27 anos.' },
      { role: 'ai', content: 'Em qual cidade você vai utilizar o plano e qual bairro?' },
      { role: 'lead', content: 'Rio de Janeiro, Santa Cruz.' },
      { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
      { role: 'lead', content: 'MEI.' },
      { role: 'ai', content: 'Você já tem plano de saúde atualmente?' },
      { role: 'lead', content: 'klin' },
    ];
    const result = validateAutonomousReplyOutput(
      'Você já utiliza a Klin. Vou preparar e enviar sua cotação. [[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]',
      completeHistory,
    );

    assert.equal(result.valid, false);
    assert.equal(result.message, QUALIFICATION_REPETITION_VALIDATION_MESSAGE);
  });

  test('aceita encerramento humano sem recapitular os dados', () => {
    const completeHistory: AutonomousMessageRow[] = [
      { role: 'ai', content: 'O plano será somente para você?' },
      { role: 'lead', content: 'Só para mim, tenho 27 anos.' },
      { role: 'ai', content: 'Em qual cidade você vai utilizar o plano e qual bairro?' },
      { role: 'lead', content: 'Rio de Janeiro, Santa Cruz.' },
      { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
      { role: 'lead', content: 'MEI.' },
      { role: 'ai', content: 'Você já tem plano de saúde atualmente?' },
      { role: 'lead', content: 'klin' },
    ];
    const result = validateAutonomousReplyOutput(
      'Perfeito, Nick. Já consegui as informações que precisava por aqui. Vou montar as opções que façam mais sentido para o seu perfil e te mando a cotação. [[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]',
      completeHistory,
    );

    assert.equal(result.valid, true);
  });

  test('rejeita encerramento que nao avisa que a cotacao sera enviada', () => {
    const completeHistory: AutonomousMessageRow[] = [
      { role: 'ai', content: 'O plano será somente para você?' },
      { role: 'lead', content: 'Só para mim, tenho 27 anos.' },
      { role: 'ai', content: 'Em qual cidade você vai utilizar o plano e qual bairro?' },
      { role: 'lead', content: 'Rio de Janeiro, Méier.' },
      { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
      { role: 'lead', content: 'sim' },
      { role: 'ai', content: 'Você já tem plano de saúde atualmente?' },
      { role: 'lead', content: 'sim' },
    ];
    const result = validateAutonomousReplyOutput(
      'Perfeito. Já consegui as informações que precisava por aqui e vou preparar as opções para você. [[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]',
      completeHistory,
    );

    assert.equal(result.valid, false);
    assert.equal(result.message, QUALIFICATION_CLOSURE_VALIDATION_MESSAGE);
  });

  test('rejeita encerramento funcional mas seco', () => {
    const completeHistory: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Pra mim, tenho 44 anos.' },
      { role: 'ai', content: 'Em qual cidade você vai usar o plano?' },
      { role: 'lead', content: 'Cachoeiro de Itapemirim.' },
      { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
      { role: 'lead', content: 'Não.' },
      { role: 'ai', content: 'Você já tem plano de saúde atualmente?' },
      { role: 'lead', content: 'Não.' },
    ];
    const result = validateAutonomousReplyOutput(
      'Certo. Já consegui as informações que precisava por aqui. Vou preparar a cotação e te envio as opções. [[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]',
      completeHistory,
    );

    assert.equal(result.valid, false);
    assert.equal(result.message, QUALIFICATION_CLOSURE_VALIDATION_MESSAGE);
  });

  test('rejeita mais de uma pergunta no mesmo turno', () => {
    const result = validateAutonomousReplyOutput('Entendi o cenário. Qual a cidade? E qual o orçamento?', [
      { role: 'lead', content: 'Quero cotar para minhas filhas.' },
    ]);
    assert.equal(result.valid, false);
    assert.match(result.message ?? '', /no maximo uma pergunta/i);
  });

  test('aceita a pergunta social da abertura junto com a primeira pergunta de qualificacao', () => {
    const result = validateAutonomousReplyOutput(
      'Oi, tudo bem? Sou a Luiza Kifer. Você busca um plano só para você ou para mais alguém?',
      [],
    );
    assert.equal(result.valid, true);
  });

  test('rejeita dois-pontos e travessao na copy visivel', () => {
    const result = validateAutonomousReplyOutput('Entendi: vamos seguir — em qual cidade vocês vão usar?', [
      { role: 'lead', content: 'Quero cotar para minhas filhas.' },
    ]);
    assert.equal(result.valid, false);
    assert.match(result.message ?? '', /dois-pontos ou travessao/i);
  });

  test('rejeita resposta prolixa', () => {
    const result = validateAutonomousReplyOutput('a'.repeat(721), [
      { role: 'lead', content: 'Quero cotar para minhas filhas.' },
    ]);
    assert.equal(result.valid, false);
    assert.match(result.message ?? '', /longa demais/i);
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

  test('direciona CNPJ ao unico adulto quando os demais beneficiarios sao menores', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Um seria pra mim, tenho 67 anos.' },
      { role: 'lead', content: 'Outro para uma adolescente de 13 anos e um bebê de 2 meses.' },
    ];

    assert.equal(
      validateAutonomousReplyOutput('Alguém que vai entrar no plano tem CNPJ ou MEI?', history).message,
      SINGLE_ADULT_WITH_MINORS_BUSINESS_ID_VALIDATION_MESSAGE,
    );
    assert.equal(validateAutonomousReplyOutput('Você tem CNPJ ou MEI?', history).valid, true);
  });

  test('pergunta CNPJ de forma abrangente depois que a cidade foi informada', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Para mim é para meus 2 filhos.' },
      { role: 'ai', content: 'Para os seus dois filhos, quais são as idades deles?' },
      { role: 'lead', content: '11 e 22.' },
      { role: 'ai', content: 'Para eu verificar a melhor alternativa, em qual cidade o plano será utilizado?' },
      { role: 'lead', content: 'Nova Friburgo!' },
    ];

    assert.equal(
      validateAutonomousReplyOutput('Você possui CNPJ ou MEI?', history).message,
      MULTIPLE_BENEFICIARIES_SCOPE_VALIDATION_MESSAGE,
    );
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
      validateAutonomousReplyOutput('Como seu MEI tem 3 meses, ele ainda não pode ser usado, precisa completar 6 meses. Enquanto isso, posso cotar pessoa física para você não ficar sem cobertura. Faz sentido?', history).valid,
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
    assert.equal(result.message, CHILD_ONLY_SCOPE_VALIDATION_MESSAGE);
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

  test('exige adulto somente para uma unica vida abaixo de 12 anos', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Quero cotar somente para meu filho de 10 anos.' },
    ];
    const result = validateAutonomousReplyOutput(
      'Vou verificar uma opção para ele e já te retorno.',
      history,
    );

    assert.equal(result.valid, false);
    assert.equal(result.message, CHILD_ONLY_ELIGIBILITY_VALIDATION_MESSAGE);

  });

  test('reconhece uma unica vida infantil quando o lead responde de forma curta', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'ai', content: 'Você busca um plano só para você ou para mais alguém da família?' },
      { role: 'lead', content: 'neto' },
      { role: 'ai', content: 'Para eu encontrar opções adequadas para ele, qual é a idade do seu neto?' },
      { role: 'lead', content: '10 anos' },
    ];

    assert.equal(
      validateAutonomousReplyOutput(
        'Para conseguir contratar o plano para seu neto, é necessário incluir um adulto junto.',
        history,
      ).valid,
      true,
    );
  });

  test('nao aplica a regra de adulto a adolescente de 15 anos', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'A cotação é para meu filho de 15 anos.' },
    ];

    assert.equal(validateAutonomousReplyOutput('Em qual cidade ele vai utilizar o plano?', history).valid, true);
  });

  test('nao exige handoff infantil quando um adulto tambem entra na cotacao', () => {
    const history: AutonomousMessageRow[] = [
      { role: 'lead', content: 'Eu e meus filhos menores de 18 vamos entrar no plano.' },
    ];

    assert.equal(validateAutonomousReplyOutput('Em qual cidade vocês vão utilizar o plano?', history).valid, true);
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
      validateAutonomousReplyOutput('[[HANDOFF: QUALIFICACAO_COMPLETA | completo]]', [
        { role: 'lead', content: 'Eu tenho 35 anos e minha esposa tem 34 anos. Vamos usar no Rio de Janeiro, no Centro. Não temos CNPJ ou MEI e não temos plano atualmente.' },
        { role: 'ai', content: 'Qual é o bairro?' },
        { role: 'lead', content: 'Centro.' },
        { role: 'ai', content: 'Algum beneficiário tem CNPJ ou MEI?' },
        { role: 'lead', content: 'Não temos.' },
        { role: 'ai', content: 'Vocês têm plano atualmente?' },
        { role: 'lead', content: 'Não temos plano.' },
      ]).valid,
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
