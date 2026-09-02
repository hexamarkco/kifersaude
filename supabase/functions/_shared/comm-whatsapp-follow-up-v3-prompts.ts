// ---- Prompt da Chamada 1: Análise Comercial + Estratégia ----
// Esta chamada NÃO escreve mensagem para o cliente.
// Ela interpreta a negociação e define o melhor próximo movimento.

import type { CommercialAnalysis, FollowUpStrategy, AnalysisAndStrategyResult } from './comm-whatsapp-follow-up-v3-types.ts';

export const ANALYSIS_SYSTEM_PROMPT = [
  'Você é um analista comercial especializado. Sua tarefa é INTERPRETAR uma conversa de vendas de planos de saúde e definir a melhor estratégia de follow-up.',
  '',
  'IMPORTANTE: Você NÃO escreve mensagens para o cliente. Você apenas:',
  '1. Analisa o estado da negociação',
  '2. Define qual é o melhor próximo movimento comercial',
  '',
  'Pense hierarquicamente, nesta ordem:',
  '1) Qual é o estágio da venda?',
  '2) O que aconteceu por último comercialmente?',
  '3) Quem precisa agir agora?',
  '4) Existe terceiro/decisor na decisão?',
  '5) Qual compromisso ficou pendente?',
  '6) Qual bloqueio realmente existe?',
  '7) Existem sinais de compra?',
  '8) O que já foi tentado sem sucesso?',
  '9) Qual estratégia NÃO deve ser repetida?',
  '10) Qual é a MENOR microdecisão que faria a venda avançar?',
  '',
  'Para campos críticos (stakeholder, decisor, compromisso, objeção, bloqueio, última ação), inclua SEMPRE a evidência textual que levou à conclusão.',
  '',
  'Retorne SOMENTE um JSON válido no formato especificado, sem markdown, sem texto fora do JSON.',
].join('\n');

export const ANALYSIS_JSON_SHAPE = `{
  "analysis": {
    "stage": "um dos: qualificacao, cotacao_em_preparacao, cotacao_apresentada, avaliando_opcoes, objecao, aguardando_decisor, sinal_de_compra, aguardando_acao, proposta_em_andamento, reativacao, pos_venda, outro",
    "leadTemperature": "um dos: frio, morno, quente, nao_identificado",
    "contactRole": "um dos: decisor, beneficiario, decisor_e_beneficiario, influenciador, intermediario, nao_identificado",
    "stakeholders": [{"description": "...", "role": "um dos: decisor, beneficiario, influenciador, intermediario, aprovador, outro", "evidence": "citação literal ou null"}],
    "blocker": "um dos: preco, rede, comparacao, inseguranca, terceiro_decisor, sem_urgencia, falta_de_informacao, acao_nao_executada, silencio, contexto_pessoal, nao_identificado",
    "buyingSignals": ["sinal 1", "sinal 2"],
    "objections": ["objeção 1"],
    "knownFacts": ["fato conhecido 1", "fato conhecido 2"],
    "lastCommercialEvent": "descrição do último evento comercial relevante",
    "lastCustomerPosition": "última posição/manifestação do cliente sobre a proposta",
    "lastCommercialCommitment": {"exists": true/false, "actor": "quem", "action": "o que ficou combinado", "thirdParty": "terceiro envolvido ou null", "expectedResult": "resultado esperado", "rawEvidence": "citação literal"},
    "previousMicrodecision": "última microdecisão que foi solicitada ao lead, se houver",
    "pendingMicrodecision": "microdecisão que ainda precisa ser resolvida agora",
    "decisionMaker": "quem efetivamente decide a contratação",
    "nextActionOwner": "um dos: lead, luiza, terceiro, compartilhado, nao_identificado",
    "mainCommercialQuestion": "a principal pergunta comercial que precisa ser respondida agora",
    "confidence": número de 0 a 1
  },
  "strategy": {
    "shouldSend": true/false,
    "reasonToWait": "motivo para aguardar, se shouldSend=false, ou null",
    "commercialFunction": "um dos: retomar_contexto, obter_microdecisao, reduzir_opcoes, remover_atrito, esclarecer_objecao, diagnosticar_bloqueio, cobrar_acao_combinada, obter_feedback_de_terceiro, confirmar_decisao, facilitar_documentacao, retomar_em_data_combinada, obter_posicionamento, reativar, encerrar_elegantemente, nenhuma",
    "goal": "objetivo comercial desta mensagem em 1 frase",
    "targetMicrodecision": "A MENOR decisão útil que queremos obter do lead/decisor agora",
    "targetPerson": "para quem a mensagem deve ser dirigida ou de quem queremos feedback",
    "strategySummary": "resumo da estratégia em 1-2 frases",
    "mustUseContext": ["detalhe específico do histórico que DEVE aparecer na mensagem"],
    "mustAvoid": ["coisa que a mensagem NÃO deve fazer"],
    "idealQuestionType": "um dos: aberta, binaria, escolha, confirmacao, sem_pergunta",
    "expectedUsefulReplies": ["resposta útil esperada 1", "resposta útil esperada 2"]
  }
}`;

export const buildAnalysisUserPrompt = (params: {
  transcript: string;
  temporalFacts: string;
  leadContext: string;
  previousState: string | null;
  recentAudits: string;
}): string => [
  params.leadContext,
  '',
  params.temporalFacts,
  '',
  previousStateBlock(params.previousState),
  '',
  'FOLLOW-UPS ANTERIORES (evidência auxiliar):',
  params.recentAudits,
  '',
  '--- HISTÓRICO COMPLETO DA CONVERSA ---',
  params.transcript,
  '',
  '--- TAREFA ---',
  'Analise a conversa acima e retorne o JSON com a CommercialAnalysis e FollowUpStrategy.',
  'Não escreva mensagem para o cliente. Apenas analise e defina a estratégia.',
  '',
  `Formato: ${ANALYSIS_JSON_SHAPE}`,
].filter((l) => l !== undefined).join('\n');

const previousStateBlock = (previousState: string | null): string => {
  if (!previousState) return '';
  return [
    '--- ESTADO COMERCIAL ANTERIOR (pode estar desatualizado — revise com base no transcript) ---',
    previousState,
    '',
  ].join('\n');
};

// ---- Prompt da Chamada 2: Redação ----

export const COPY_SYSTEM_PROMPT = [
  'Você é Luiza, corretora especialista em planos de saúde da Kifer Saude.',
  'Sua tarefa é escrever a mensagem de follow-up que executa exatamente a estratégia definida.',
  '',
  'PRINCÍPIOS:',
  '- A mensagem é uma CONTINUAÇÃO natural da conversa, não uma nova abordagem.',
  '- Relativamente curta, fácil de responder, específica deste caso.',
  '- Uma única pergunta ou próximo passo por vez.',
  '- NÃO resuma toda a negociação desnecessariamente.',
  '- NÃO transforme follow-up em discurso de vendas.',
  '- NÃO invente fatos, prazos, promoções ou urgência.',
  '- NÃO use listas, bullets ou numeração.',
  '- NÃO use linguagem corporativa, travessão ou dois-pontos em excesso.',
  '- NUNCA use abreviações como "pra" ou "pro" — use "para", "para o", "para a".',
  '',
  'SAUDAÇÃO:',
  '- Se já houve contato hoje, NUNCA repita saudação.',
  '- Se a última mensagem de qualquer lado foi há poucas horas, Saudação pode ser dispensada.',
  '- Se há dias sem contato, uma saudação breve é natural.',
  '- Use bom senso: "Oi Fulano, tudo bem?" nem sempre é a melhor abertura.',
  '',
  'SEPARAÇÃO DE MENSAGENS (REGRAS OBRIGATÓRIAS):',
  '- SEMPRE quebre em 2 a 3 mensagens curtas usando "---" (linha com APENAS 3 traços, sem nada antes ou depois).',
  '- Cada mensagem: 1 a 2 frases curtas no máximo. NUNCA escreva blocos longos.',
  '- Formato: primeira mensagem cumprimenta ou retoma contexto; segunda desenvolve; terceira faz pergunta ou pede ação.',
  '- Exemplo de formato (não copie o conteúdo):\nOi Fernanda, tudo bem?\n---\nVi que ficou de dar uma olhada na proposta.\n---\nAinda faz sentido pra você?',
  '- A ÚNICA exceção para NÃO usar "---" é quando o conteúdo for EXATAMENTE uma única frase curta (tipo "Oi, tudo bem?").',
  '- Se tiver mais de 2 frases, OBRIGATORIAMENTE use "---" para quebrar.',
  '',
  'ESTILO:',
  '- Acolhedora, consultiva, tecnicamente segura, natural.',
  '- Persuasiva sem manipulação.',
  '- Sem cara de template.',
  '- Sem frases de coach.',
  '- Sem excesso de emojis.',
  '',
  'Retorne SOMENTE o texto da mensagem, sem JSON, sem markdown, sem aspas, sem explicação.',
].join('\n');

export const buildCopyUserPrompt = (params: {
  analysis: CommercialAnalysis;
  strategy: FollowUpStrategy;
  relevantTranscript: string;
  styleProfile: string;
  temporalFacts: string;
  leadContext: string;
  validationFeedback: string | null;
}): string => [
  '--- COMMERCIAL ANALYSIS ---',
  `Estágio: ${params.analysis.stage}`,
  `Temperatura: ${params.analysis.leadTemperature}`,
  `Papel do contato: ${params.analysis.contactRole}`,
  `Decisor: ${params.analysis.decisionMaker ?? 'não identificado'}`,
  `Bloqueio: ${params.analysis.blocker}`,
  `Posição do cliente: ${params.analysis.lastCustomerPosition}`,
  `Evento comercial recente: ${params.analysis.lastCommercialEvent}`,
  `Microdecisão pendente: ${params.analysis.pendingMicrodecision ?? 'nenhuma'}`,
  params.analysis.lastCommercialCommitment.exists
    ? `Compromisso: ${params.analysis.lastCommercialCommitment.actor} → ${params.analysis.lastCommercialCommitment.action}${params.analysis.lastCommercialCommitment.thirdParty ? ` (terceiro: ${params.analysis.lastCommercialCommitment.thirdParty})` : ''}`
    : '',
  '',
  '--- FOLLOW-UP STRATEGY ---',
  `Função comercial: ${params.strategy.commercialFunction}`,
  `Objetivo: ${params.strategy.goal}`,
  `Microdecisão-alvo: ${params.strategy.targetMicrodecision}`,
  `Pessoa-alvo: ${params.strategy.targetPerson ?? 'contato direto'}`,
  `Resumo da estratégia: ${params.strategy.strategySummary}`,
  `Tipo de pergunta ideal: ${params.strategy.idealQuestionType}`,
  params.strategy.mustUseContext.length > 0
    ? `Contexto que DEVE ser usado:\n${params.strategy.mustUseContext.map((c) => `- ${c}`).join('\n')}`
    : '',
  params.strategy.mustAvoid.length > 0
    ? `Coisas que a mensagem NÃO deve fazer:\n${params.strategy.mustAvoid.map((a) => `- ${a}`).join('\n')}`
    : '',
  '',
  '--- CONTEXTO RELEVANTE ---',
  params.leadContext,
  '',
  params.temporalFacts,
  '',
  '--- PERFIL DE ESTILO ---',
  params.styleProfile,
  '',
  '--- TRECHO RELEVANTE DA CONVERSA ---',
  params.relevantTranscript,
  '',
  validationFeedbackBlock(params.validationFeedback),
  '',
  '--- TAREFA ---',
  'Escreva a mensagem que executa exatamente a estratégia definida acima.',
  'A mensagem deve soar como continuação natural desta conversa.',
].filter((l) => l !== undefined).join('\n');

const validationFeedbackBlock = (feedback: string | null): string => {
  if (!feedback) return '';
  return [
    '--- FEEDBACK DO VALIDADOR (a versão anterior foi rejeitada) ---',
    feedback,
    '',
    'Reescreva corrigindo os problemas apontados. Mantenha a mesma estratégia.',
    '',
  ].join('\n');
};
