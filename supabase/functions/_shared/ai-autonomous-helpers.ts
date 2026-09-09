import {
  buildStyleExamples,
  buildStyleProfile,
  buildStyleProfileText,
  type MessageRow,
} from './comm-whatsapp-transcript.ts';

export type AutonomousMessageRow = {
  role: 'lead' | 'ai';
  content: string;
};

export type AutonomousReplyValidationResult = {
  valid: boolean;
  stopReason?: 'empty_response' | 'invalid_output';
  message?: string;
};

export const HANDOFF_TAG_REGEX = /\[\[HANDOFF:\s*([^\]]{1,200})\]\]\s*$/i;
export const OPENING_MESSAGE_SPLIT_REGEX = /\n?-{3,}\n?/;

// Este bloco e anexado por ultimo ao prompt configuravel. Ele protege regras
// semanticas que nao podem depender de exemplos historicos (que podem conter
// os mesmos vicios que queremos corrigir) nem de uma versao antiga salva no
// painel de configuracoes.
export const AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS = [
  '--- REGRAS CRITICAS DE CONVERSA NATURAL E QUALIFICACAO ---',
  'Pense antes de perguntar: quem esta conversando pode ser apenas o contato, e nao necessariamente uma das pessoas que entrarao no plano. Diferencie sempre INTERLOCUTOR de BENEFICIARIOS usando o historico.',
  'CNPJ/MEI pertence a qualificacao dos beneficiarios da cotacao. Se o plano for para uma terceira pessoa, pergunte por ela (ex.: "Seu filho tem CNPJ ou MEI?"). Se houver mais de um beneficiario, pergunte de forma abrangente (ex.: "Voce ou seu marido, algum dos dois tem CNPJ ou MEI?" ou "Alguem que vai entrar no plano tem CNPJ ou MEI?"). Nunca limite a pergunta somente a quem esta digitando quando outra pessoa tambem ou exclusivamente entrara no plano.',
  'Se perguntarem por que CNPJ/MEI importa ou se muda o valor, responda primeiro com clareza: em geral, planos empresariais por CNPJ/MEI ficam mais em conta que pessoa fisica; valor e elegibilidade finais dependem da cotacao. Depois continue a qualificacao.',
  'MEI so pode ser usado para contratar plano empresarial depois de completar 6 meses de abertura. Se o lead informar que o MEI tem menos de 6 meses, diga isso com seguranca, NAO peca o numero do CNPJ e ofereca cotar pessoa fisica como solucao temporaria para ele nao ficar sem cobertura ate o MEI completar o prazo. Espere a pessoa aceitar ou recusar essa alternativa antes de concluir a qualificacao.',
  'PARTO: no atendimento comercial, informe com seguranca que a carencia para parto a termo e de 10 meses (300 dias) e nao prometa reducao por plano anterior. Para quem AINDA planeja engravidar, prefira a explicacao positiva: depois de 2 meses de plano ja pode engravidar, pois ao chegar aos 9 meses de gestacao o plano tera completado os 10 meses. Nao use essa explicacao com quem ja esta gravida; nesse caso, deixe claro que uma nova contratacao nao completara a carencia do parto a termo da gestacao atual.',
  'Se perguntarem especificamente sobre parto prematuro, explique que ate 36 semanas e 6 dias ele nao e parto a termo e fica fora da carencia de 10 meses do parto a termo, sendo tratado pelas regras de urgencia/emergencia apos 24 horas. Nao prometa cobertura irrestrita: ressalve a segmentacao/cobertura hospitalar contratada e as regras assistenciais aplicaveis.',
  'CRIANCA MENOR DE 12 ANOS: so explique a necessidade de adulto titular quando a cotacao pedida for exclusivamente para uma ou mais criancas menores de 12 anos e ainda nao houver adulto beneficiario confirmado. Se um adulto ja estiver incluido na cotacao, a composicao titular/dependente e natural e nao precisa ser explicada nem gerar alerta; continue a qualificacao sem discurso sobre dependencia ou mensalidade, salvo se o lead perguntar.',
  'Quando uma resposta curta admitir uma interpretacao muito provavel, nao reinicie a coleta como formulario e nao assuma silenciosamente. Faca uma confirmacao fechada e facil. Exemplo: voce perguntou as idades de um casal e recebeu apenas "56"; a melhor resposta e "So para confirmar: voces dois tem 56 anos?", e nao "Qual a idade do seu marido?".',
  'A abordagem inicial ja apresentou a Luiza. Na primeira resposta do lead, nao se apresente de novo e nao force frases como "prazer em falar com voce" ou "que bom falar com voce". Acolha o conteudo real e avance naturalmente.',
  'Nao transforme cada turno em "marcador + pergunta". Varie a estrutura: as vezes va direto a pergunta, as vezes faca uma confirmacao breve, e use o primeiro nome apenas ocasionalmente quando trouxer proximidade real. Nao use o nome em mensagens consecutivas.',
  'Nao comece com o mesmo marcador usado nas tres respostas anteriores (por exemplo: Certo, Perfeito, Entendi, Otimo, Beleza ou Maravilha). Evite especialmente sequencias de "Certo!".',
  'Responda sempre a pergunta, duvida, objecao ou contexto humano trazido pelo lead antes de fazer a proxima pergunta de qualificacao. Empatia deve ser especifica ao que foi dito, curta e sincera.',
  'Preserve informacoes ja dadas e promessas ja feitas. Uma pergunta de confirmacao so e apropriada quando existe ambiguidade real e deve apresentar a hipotese mais provavel para exigir o minimo de esforco do lead.',
].join('\n');

// Codigos fixos de handoff: permitem mapear o desfecho da IA para uma acao
// deterministica no CRM (status do lead) sem depender de interpretar texto
// livre. QUALQUER OUTRO CODIGO NAO RECONHECIDO cai em PRECISA_HUMANO.
export const HANDOFF_CODES = ['QUALIFICACAO_COMPLETA', 'RECUSOU_COTACAO', 'FORA_DE_ESCOPO', 'PRECISA_HUMANO'] as const;
export type HandoffCode = typeof HANDOFF_CODES[number];

export const normalizeHandoffCode = (raw: string): HandoffCode => {
  const upper = raw.trim().toUpperCase();
  return (HANDOFF_CODES as readonly string[]).includes(upper) ? (upper as HandoffCode) : 'PRECISA_HUMANO';
};

export const buildStylePrompt = (styleMessages: MessageRow[]): string => {
  const styleProfileText = buildStyleProfileText(buildStyleProfile(styleMessages));
  const styleExamples = buildStyleExamples(styleMessages);
  return [
    styleProfileText ? `${styleProfileText}\n` : '',
    styleExamples.length > 0
      ? `EXEMPLOS REAIS DO SEU ESTILO (copie o padrao de escrita, nunca o conteudo):\n${styleExamples.map((text, i) => `${i + 1}. ${text}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n');
};

export type QuickReplyRef = { name: string; text: string };
export type SimilarSituationRef = { situacao: string; resposta: string };

const QUICK_REPLIES_INTEGRATION_SLUG = 'whatsapp_quick_replies';

/**
 * Puxa as Mensagens Rapidas cadastradas no inbox (integration_settings) —
 * templates reais que a operacao ja usa e que a IA pode adaptar ao
 * contexto em vez de sempre escrever do zero.
 */
// deno-lint-ignore no-explicit-any
export const fetchQuickReplies = async (supabaseAdmin: any): Promise<QuickReplyRef[]> => {
  const { data, error } = await supabaseAdmin
    .from('integration_settings')
    .select('settings')
    .eq('slug', QUICK_REPLIES_INTEGRATION_SLUG)
    .maybeSingle();

  if (error || !data?.settings) return [];

  const settings = data.settings as { quickReplies?: unknown[]; quick_replies?: unknown[] };
  const raw = Array.isArray(settings.quickReplies) ? settings.quickReplies : Array.isArray(settings.quick_replies) ? settings.quick_replies : [];

  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      text: typeof item.text === 'string' ? item.text.trim() : '',
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, 30);
};

/**
 * Busca, via similaridade de texto (pg_trgm) no historico real do
 * WhatsApp, mensagens de clientes parecidas com a mensagem atual do lead
 * e a resposta real que a operacao deu na epoca — a "biblioteca de
 * situacoes ja vividas" que embasa a resposta da IA em casos reais em
 * vez de so no tom generico.
 */
// deno-lint-ignore no-explicit-any
export const fetchSimilarSituations = async (supabaseAdmin: any, queryText: string, limit = 4): Promise<SimilarSituationRef[]> => {
  const trimmed = queryText.trim();
  if (trimmed.length < 8) return [];

  const { data, error } = await supabaseAdmin.rpc('comm_whatsapp_find_similar_situations', {
    p_query: trimmed.slice(0, 600),
    p_limit: limit,
  });

  if (error || !Array.isArray(data)) return [];

  return data
    .filter((row: { situacao?: unknown; resposta?: unknown }) => typeof row.situacao === 'string' && typeof row.resposta === 'string')
    .map((row: { situacao: string; resposta: string }) => ({ situacao: row.situacao.trim(), resposta: row.resposta.trim() }))
    .filter((row: SimilarSituationRef) => row.situacao && row.resposta);
};

export const buildReferencePrompt = (quickReplies: QuickReplyRef[], similarSituations: SimilarSituationRef[]): string => {
  const parts: string[] = [];

  if (quickReplies.length > 0) {
    parts.push(
      'MENSAGENS RAPIDAS DA OPERACAO (templates reais ja usados no inbox):',
      quickReplies.map((qr, i) => `${i + 1}. [${qr.name}] "${qr.text}"`).join('\n'),
      'Quando uma dessas se encaixar na situacao, use como base e ADAPTE ao contexto da conversa (nome, detalhes ja mencionados) em vez de copiar igual. Quando nenhuma se encaixar bem, escreva a resposta livremente seguindo o playbook e o estilo.',
    );
  }

  if (similarSituations.length > 0) {
    parts.push(
      '',
      'SITUACOES PARECIDAS JA ATENDIDAS DE VERDADE (exemplos reais do historico, para voce se inspirar em COMO abordar, nao no conteudo especifico):',
      similarSituations.map((s, i) => `${i + 1}. Cliente disse algo parecido com: "${s.situacao}"\n   Resposta real dada na epoca: "${s.resposta}"`).join('\n'),
      'Use isso so como referencia de abordagem/tom para uma situacao semelhante — nunca copie valores, nomes, operadoras ou detalhes especificos desses exemplos para o lead atual, cada caso e unico.',
      'ATENCAO: essas respostas reais foram escritas por uma pessoa e podem conter erros (ex: repetir uma pergunta ja respondida, perguntar bairro fora do Rio, etc.). Copie o TOM delas, mas NUNCA copie um erro — as REGRAS CRITICAS deste prompt sempre valem, mesmo quando o exemplo real nao seguiu.',
    );
  }

  return parts.join('\n');
};

export const buildOpeningUserPrompt = (leadName: string): string => [
  '--- SITUACAO ---',
  'Voce esta iniciando o contato agora — este e um lead que demonstrou interesse em uma cotacao de plano de saude e ainda nao trocou nenhuma mensagem com voce.',
  leadName ? `Nome do lead: ${leadName}` : 'Nome do lead: desconhecido — cumprimente sem usar nome.',
  '',
  '--- TAREFA ---',
  'Escreva a abordagem inicial completa (cumprimento + apresentacao rapida + mencionar que viu o interesse na cotacao + a primeira pergunta do roteiro de qualificacao).',
  'Divida em ate 3 mensagens curtas, do jeito que a operacao realmente manda no WhatsApp (mensagens curtas em sequencia, nao um paragrafo unico). Separe cada mensagem em uma linha contendo apenas "---".',
].join('\n');

export type ReplyPromptOptions = {
  isFirstLeadReplyAfterApproach?: boolean;
  leadFirstName?: string;
};

const NAME_CONNECTORS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);
const UNSAFE_LEAD_NAME_TOKENS = new Set([
  'cliente', 'contato', 'lead', 'leads', 'nome', 'semnome', 'desconhecido',
  'teste', 'test', 'null', 'undefined', 'unknown', 'whatsapp', 'naoinformado',
]);
const NAME_TOKEN_REGEX = /^[\p{L}]+(?:['-][\p{L}]+)*$/u;

/**
 * O nome no CRM pode vir de formulario ou importacao. So usamos o primeiro
 * nome se o valor inteiro parecer um nome humano completo; caso contrario a
 * IA abre a conversa sem arriscar chamar a pessoa por um apelido ou lixo.
 */
export const getReliableLeadFirstName = (fullName: string | null | undefined): string | null => {
  const normalized = fullName?.trim().replace(/\s+/g, ' ') ?? '';
  if (!normalized || normalized.length > 80) return null;

  const tokens = normalized.split(' ');
  if (tokens.length < 2 || tokens.length > 6 || !tokens.every((token) => NAME_TOKEN_REGEX.test(token))) {
    return null;
  }

  const normalizedTokens = tokens.map((token) => token.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  if (normalizedTokens.some((token) => UNSAFE_LEAD_NAME_TOKENS.has(token))) return null;

  const nameTokens = tokens.filter((token, index) => !NAME_CONNECTORS.has(normalizedTokens[index]));
  if (nameTokens.length < 2) return null;

  const firstName = nameTokens[0];
  const comparableFirstName = normalizedTokens[tokens.indexOf(firstName)];
  if (!firstName || /^(.)(\1){2,}$/i.test(comparableFirstName)) return null;

  return firstName.charAt(0).toLocaleUpperCase('pt-BR') + firstName.slice(1).toLocaleLowerCase('pt-BR');
};

export const buildReplyUserPrompt = (
  history: AutonomousMessageRow[],
  options: ReplyPromptOptions = {},
): string => {
  const transcriptLines = history.map((row) => `${row.role === 'lead' ? 'LEAD' : 'VOCE'}: ${row.content}`);
  const firstName = options.leadFirstName ?? '';
  const nameUsageGuidance = firstName
    ? `Primeiro nome validado para uso eventual: "${firstName}". Use somente esse primeiro nome, nunca o nome completo; use-o apenas quando soar natural e nao em mensagens consecutivas.`
    : 'Nenhum primeiro nome foi validado para esta conversa. Nao use nem invente nome.';
  const firstReplyGuidance = options.isFirstLeadReplyAfterApproach
    ? [
        '--- PRIMEIRA RESPOSTA APOS A ABORDAGEM ---',
        'A abordagem anterior ja cumprimentou e apresentou a Luiza. Nao se apresente novamente e nao force uma frase social antes de responder ao conteudo do lead.',
        firstName
          ? `Se trouxer proximidade de verdade, voce pode usar apenas o primeiro nome validado "${firstName}"; nao e obrigatorio e nunca use o nome completo.`
          : 'O nome do CRM nao foi validado. Nao use nem invente nome.',
        'Acolha ou confirme objetivamente o que a pessoa informou e continue a qualificacao com no maximo uma pergunta. Evite aberturas prontas como "prazer em falar com voce" e "que bom falar com voce".',
      ].join('\n')
    : '';
  return [
    '--- CONVERSA ATE AGORA (LEAD = pessoa simulando o cliente, VOCE = suas respostas anteriores) ---',
    transcriptLines.join('\n'),
    nameUsageGuidance,
    firstReplyGuidance,
    '',
    '--- TAREFA ---',
    'Gere a proxima resposta, como VOCE, para a ultima mensagem do LEAD.',
  ].join('\n');
};

const normalizeForSemanticMatch = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const getReplyOpener = (value: string): string | null => {
  const normalized = normalizeForSemanticMatch(value);
  return normalized.match(/^(certo|perfeito|otimo|entendi|beleza|maravilha|sem problema)\b/)?.[1] ?? null;
};

const BARE_AGE_REGEX = /^(?:tenho\s+)?(\d{1,3})(?:\s*anos?)?[.!]?$/;
const GROUP_AGE_QUESTION_REGEX = /(?:\bidades\s+(?:de\s+)?voces\b|\bidades\s+d[oa]s?\b|\bidade\s+de\s+cada\b|\bquais\s+sao\s+as\s+idades\b)/;
const GROUP_CONFIRMATION_REGEX = /\b(voces\s+dois|os\s+dois|as\s+duas|ambos|ambas|todo(?:s|as))\b/;
const CNPJ_OR_MEI_REGEX = /\b(cnpj|mei)\b/;
const BUSINESS_ID_VALUE_QUESTION_REGEX = /(?:\bmuda\b|\bfaz\s+diferenca\b|\bqual\s+(?:e\s+)?a\s+diferenca\b|\bmais\s+(?:barato|em\s+conta)\b)/;
const BUSINESS_ID_VALUE_ANSWER_REGEX = /(?:\bempresari[oa]\b.*\bmais\s+(?:barato|em\s+conta)\b|\bmais\s+(?:barato|em\s+conta)\b.*\b(?:cnpj|mei|pessoa\s+fisica)\b)/;
const MEI_AGE_IN_MONTHS_REGEX = /\b(\d{1,2})\s*mes(?:es)?\b/;
const MEI_SIX_MONTH_RULE_REGEX = /\b6\s*mes(?:es)?\b/;
const PERSONA_FISICA_REGEX = /\bpessoa\s+fisica\b/;
const PREGNANCY_CONTEXT_REGEX = /\b(gravida|gestante|gestacao|engravid|parto)\b/;
const MATERNITY_QUESTION_REGEX = /\b(carencia|parto|gestacao|pre[- ]?natal|engravid)\b/;
const TERM_BIRTH_WAIT_REGEX = /(?:\b10\s*mes(?:es)?\b|\b300\s*dias\b)/;
const PLANNING_PREGNANCY_REGEX = /\b(planej|pretend|quero\s+engravid|posso\s+engravid|quando\s+engravid)\w*/;
const TWO_MONTH_COMMERCIAL_FRAME_REGEX = /\b2\s*mes(?:es)?\b/;
const PREMATURE_BIRTH_QUESTION_REGEX = /(?:\bprematur\w*\b|\b36\s*(?:s\b|semanas?\b)|\bantes\s+d[ea]\s+37\s+semanas?\b)/;
const PREMATURE_CUTOFF_REGEX = /(?:\b36\s*(?:s\s*e?\s*6\s*d|semanas?\s+e\s+6\s+dias?)\b|\bantes\s+d[ea]\s+37\s+semanas?\b)/;
const URGENT_COVERAGE_REGEX = /\b(urgencia|emergencia)\b/;
const TWENTY_FOUR_HOURS_REGEX = /\b24\s*horas?\b/;
const DEPENDENCY_EXPLANATION_REGEX = /\b(titular|dependente|mensalidade)\b/;
const CHILD_COMPOSITION_QUESTION_REGEX = /\b(titular|dependente|mensalidade|entra\s+no\s+plano|pode\s+entrar)\b/;
const ONLY_INTERLOCUTOR_BUSINESS_ID_REGEX = /\bvoce\s+(?:tem|possui|teria)\b/;
const GROUP_BUSINESS_ID_SCOPE_REGEX = /\b(alguem\s+que\s+(?:vai|ira)\s+entrar|alguem\s+d[oa]\s+cotacao|algum(?:a)?\s+d[oa]s?\s+(?:beneficiari|pessoa)|voces|voce\s+ou)\b/;
const MULTIPLE_BENEFICIARIES_REGEX = /(?:\beu\s+e\s+(?:meu|minha)\b|\b(?:para|pro|pra)\s+mim\s+e\b|\bpara\s+(?:nos|a\s+gente)\s+dois\b|\bsomos\s+[2-9]\b|\b(?:duas|dois|tres|quatro|[2-9])\s+(?:vidas|pessoas|beneficiarios)\b|\bcasal\b|\bminha\s+familia\b)/;
const THIRD_PARTY_RELATION_REGEX = /(?:meu|minha)\s+(?:filh[oa]|net[oa]|sobrinh[oa]|marido|esposa|pai|mae)/;
const THIRD_PARTY_ONLY_REGEX = new RegExp(
  `\\b(?:para|pro|pra)\\s+(?:o\\s+|a\\s+)?${THIRD_PARTY_RELATION_REGEX.source}`,
);
const THIRD_PARTY_BUSINESS_ID_SCOPE_REGEX = new RegExp(
  `(?:(?:seu|sua)\\s+(?:filh[oa]|net[oa]|sobrinh[oa]|marido|esposa|pai|mae)|\\bbeneficiari[oa]\\b|\\bquem\\s+vai\\s+entrar\\b|\\balguem\\s+que\\s+(?:vai|ira)\\s+entrar\\b)`,
);

/**
 * Valida somente erros conversacionais de alta confianca. O modelo recebe uma
 * segunda tentativa no mesmo modelo quando a saida repetiria um vicio ou
 * qualificaria a pessoa errada; nuances abertas continuam a cargo do prompt.
 */
export const validateAutonomousReplyOutput = (
  rawText: string,
  history: AutonomousMessageRow[],
): AutonomousReplyValidationResult => {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, stopReason: 'empty_response', message: 'Resposta vazia.' };
  }
  if (trimmed.length > 1_200) {
    return { valid: false, stopReason: 'invalid_output', message: 'Resposta longa demais para WhatsApp.' };
  }
  if (trimmed.includes('[[HANDOFF') && !HANDOFF_TAG_REGEX.test(trimmed)) {
    return { valid: false, stopReason: 'invalid_output', message: 'Tag interna de handoff malformada ou fora do final.' };
  }

  // Tag-only e aceita aqui porque o worker possui um encerramento seguro
  // especifico para esse caso e nao deve transformar handoff em fallback.
  const visibleCandidate = extractHandoff(trimmed).text;
  if (!visibleCandidate) return { valid: true };

  const candidateOpener = getReplyOpener(visibleCandidate);
  if (candidateOpener) {
    const recentAiOpeners = history
      .filter((row) => row.role === 'ai')
      .slice(-3)
      .map((row) => getReplyOpener(row.content));
    if (recentAiOpeners.includes(candidateOpener)) {
      return {
        valid: false,
        stopReason: 'invalid_output',
        message: `A abertura "${candidateOpener}" ja foi usada recentemente. Varie a estrutura e responda sem esse marcador.`,
      };
    }
  }

  const previousAi = [...history].reverse().find((row) => row.role === 'ai');
  const latestLead = [...history].reverse().find((row) => row.role === 'lead');
  const normalizedPreviousAi = normalizeForSemanticMatch(previousAi?.content ?? '');
  const normalizedLatestLead = normalizeForSemanticMatch(latestLead?.content ?? '');
  const normalizedCandidate = normalizeForSemanticMatch(visibleCandidate);
  const bareAge = normalizedLatestLead.match(BARE_AGE_REGEX)?.[1];
  if (bareAge && GROUP_AGE_QUESTION_REGEX.test(normalizedPreviousAi)) {
    const confirmsLikelyGroupAge = normalizedCandidate.includes(bareAge)
      && GROUP_CONFIRMATION_REGEX.test(normalizedCandidate)
      && visibleCandidate.includes('?');
    if (!confirmsLikelyGroupAge) {
      return {
        valid: false,
        stopReason: 'invalid_output',
        message: `A resposta "${bareAge}" veio depois de uma pergunta de idades no plural. Confirme em pergunta fechada se essa idade vale para todos, sem perguntar apenas por uma pessoa nem seguir assumindo.`,
      };
    }
  }

  if (
    CNPJ_OR_MEI_REGEX.test(normalizedPreviousAi)
    && BUSINESS_ID_VALUE_QUESTION_REGEX.test(normalizedLatestLead)
    && !BUSINESS_ID_VALUE_ANSWER_REGEX.test(normalizedCandidate)
  ) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'O lead perguntou se CNPJ/MEI muda algo. Responda primeiro, com clareza, que o plano empresarial geralmente fica mais em conta que pessoa fisica; depois continue a qualificacao.',
    };
  }

  const meiAgeMonths = CNPJ_OR_MEI_REGEX.test(normalizedLatestLead)
    ? Number(normalizedLatestLead.match(MEI_AGE_IN_MONTHS_REGEX)?.[1] ?? Number.NaN)
    : Number.NaN;
  if (Number.isFinite(meiAgeMonths) && meiAgeMonths < 6) {
    const explainsSixMonthRule = MEI_SIX_MONTH_RULE_REGEX.test(normalizedCandidate);
    const offersTemporaryIndividualPlan = PERSONA_FISICA_REGEX.test(normalizedCandidate);
    const asksForCnpjNumber = /\b(?:numero|cnpj)\b.*\b(?:envia|mande|passa|informa|consult)/.test(normalizedCandidate)
      || /\b(?:envia|mande|passa|informa)\b.*\bcnpj\b/.test(normalizedCandidate);
    if (!explainsSixMonthRule || !offersTemporaryIndividualPlan || asksForCnpjNumber) {
      return {
        valid: false,
        stopReason: 'invalid_output',
        message: `O lead informou MEI com ${meiAgeMonths} meses. Explique que o empresarial por MEI exige 6 meses, nao peca o CNPJ agora e ofereca pessoa fisica como solucao temporaria ate completar o prazo.`,
      };
    }
  }

  const leadHistoryText = normalizeForSemanticMatch(
    history.filter((row) => row.role === 'lead').map((row) => row.content).join(' '),
  );
  if (PREGNANCY_CONTEXT_REGEX.test(leadHistoryText) && MATERNITY_QUESTION_REGEX.test(normalizedLatestLead)) {
    const explainsTermBirthWait = TERM_BIRTH_WAIT_REGEX.test(normalizedCandidate);
    const treatsWaitAsUncertain = /(?:depende\s+d[ae]\s+operadora|precisa\s+ser\s+verificad|carencias?\s+aplicaveis|aproveitamento.*plano\s+anterior)/.test(normalizedCandidate);
    const needsPlanningFrame = PLANNING_PREGNANCY_REGEX.test(normalizedLatestLead)
      && !/\b(ja\s+estou|estou)\s+gravida\b/.test(leadHistoryText);
    if (!explainsTermBirthWait || treatsWaitAsUncertain || (needsPlanningFrame && !TWO_MONTH_COMMERCIAL_FRAME_REGEX.test(normalizedCandidate))) {
      return {
        valid: false,
        stopReason: 'invalid_output',
        message: needsPlanningFrame
          ? 'Explique que parto a termo tem 10 meses de carencia e use o enquadramento comercial correto: apos 2 meses de plano, a pessoa pode engravidar e completar a carencia durante os 9 meses de gestacao.'
          : 'A carencia de parto a termo deve ser informada como 10 meses (300 dias), sem tratar como incerta nem prometer aproveitamento do plano anterior. Se a pessoa ja esta gravida, nao use o enquadramento de esperar 2 meses para engravidar.',
      };
    }
  }

  if (PREMATURE_BIRTH_QUESTION_REGEX.test(normalizedLatestLead)) {
    const explainsPrematureRule = PREMATURE_CUTOFF_REGEX.test(normalizedCandidate)
      && URGENT_COVERAGE_REGEX.test(normalizedCandidate)
      && TWENTY_FOUR_HOURS_REGEX.test(normalizedCandidate);
    if (!explainsPrematureRule) {
      return {
        valid: false,
        stopReason: 'invalid_output',
        message: 'Explique que parto prematuro ate 36 semanas e 6 dias fica fora da carencia de 10 meses do parto a termo e segue urgencia/emergencia apos 24 horas, sem prometer cobertura alem da segmentacao contratada.',
      };
    }
  }

  const agesInLatestLead = [...normalizedLatestLead.matchAll(/\b(\d{1,2})\b/g)]
    .map((match) => Number(match[1]));
  const hasAdultAndChildUnder12 = MULTIPLE_BENEFICIARIES_REGEX.test(normalizedLatestLead)
    && /\b(filh|crianc)\w*/.test(normalizedLatestLead)
    && agesInLatestLead.some((age) => age >= 18)
    && agesInLatestLead.some((age) => age < 12);
  const leadAskedAboutChildComposition = normalizedLatestLead.includes('?')
    && CHILD_COMPOSITION_QUESTION_REGEX.test(normalizedLatestLead);
  if (
    hasAdultAndChildUnder12
    && !leadAskedAboutChildComposition
    && DEPENDENCY_EXPLANATION_REGEX.test(normalizedCandidate)
  ) {
    return {
      valid: false,
      stopReason: 'invalid_output',
      message: 'A cotacao ja inclui adulto e crianca menor de 12 anos. Nao explique titular, dependente ou mensalidade sem o lead perguntar; essa regra so precisa ser apresentada quando a cotacao e exclusivamente para crianca menor de 12 anos.',
    };
  }

  if (CNPJ_OR_MEI_REGEX.test(normalizedCandidate) && visibleCandidate.includes('?')) {
    const hasMultipleBeneficiaries = MULTIPLE_BENEFICIARIES_REGEX.test(leadHistoryText);
    const isThirdPartyOnly = THIRD_PARTY_ONLY_REGEX.test(leadHistoryText) && !hasMultipleBeneficiaries;
    const hasGroupScope = GROUP_BUSINESS_ID_SCOPE_REGEX.test(normalizedCandidate);
    const hasThirdPartyScope = THIRD_PARTY_BUSINESS_ID_SCOPE_REGEX.test(normalizedCandidate);
    const asksOnlyInterlocutor = ONLY_INTERLOCUTOR_BUSINESS_ID_REGEX.test(normalizedCandidate) && !hasGroupScope;
    const hasWrongScope = hasMultipleBeneficiaries
      ? !hasGroupScope
      : isThirdPartyOnly && !hasThirdPartyScope;
    if (hasWrongScope || ((hasMultipleBeneficiaries || isThirdPartyOnly) && asksOnlyInterlocutor)) {
      return {
        valid: false,
        stopReason: 'invalid_output',
        message: hasMultipleBeneficiaries
          ? 'A cotacao tem mais de um beneficiario. Pergunte se alguem que entrara no plano tem CNPJ/MEI, ou nomeie todos os envolvidos; nao pergunte apenas ao interlocutor.'
          : 'O interlocutor esta cotando para outra pessoa. Direcione CNPJ/MEI ao beneficiario, nao a quem esta digitando.',
      };
    }
  }

  return { valid: true };
};

export const buildAutonomousValidationRetryInstruction = (
  validation: AutonomousReplyValidationResult,
): string => [
  '--- CORRECAO OBRIGATORIA DA RESPOSTA ANTERIOR ---',
  validation.message ?? 'A resposta anterior violou uma regra critica de qualificacao.',
  'Reescreva a resposta inteira de forma curta, natural e coerente com o historico. Nao mencione esta validacao nem diga que esta corrigindo uma resposta.',
].join('\n');

export const extractHandoff = (
  text: string,
): { text: string; handoffCode: HandoffCode | null; handoffNote: string | null } => {
  const match = text.match(HANDOFF_TAG_REGEX);
  if (!match) return { text: text.trim(), handoffCode: null, handoffNote: null };
  const raw = match[1].trim();
  const [rawCode, ...rest] = raw.split('|');
  const handoffCode = normalizeHandoffCode(rawCode ?? raw);
  const handoffNote = rest.join('|').trim() || null;
  return { text: text.slice(0, match.index).trim(), handoffCode, handoffNote };
};

export const normalizeLeadVisibleMessageStyle = (text: string): string =>
  text
    .replace(/(\d{1,2}):(\d{2})/g, '$1h$2')
    .replace(/\s*[:：]\s*/g, ', ')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,\s*([!?])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Recebe o texto bruto do modelo (que pode vir com o separador "---" no modo
 * abertura) e devolve as mensagens finais + o handoff extraido da ultima parte.
 */
export const splitGeneratedReply = (
  rawText: string,
  splitIntoParts: boolean,
): { messages: string[]; handoffCode: HandoffCode | null; handoffNote: string | null } => {
  const rawParts = splitIntoParts
    ? rawText.split(OPENING_MESSAGE_SPLIT_REGEX).map((part) => part.trim()).filter(Boolean)
    : [rawText.trim()];

  if (rawParts.length === 0) return { messages: [], handoffCode: null, handoffNote: null };

  let handoffCode: HandoffCode | null = null;
  let handoffNote: string | null = null;
  const messages = rawParts.map((part, index) => {
    if (index !== rawParts.length - 1) return normalizeLeadVisibleMessageStyle(part);
    const extracted = extractHandoff(part);
    handoffCode = extracted.handoffCode;
    handoffNote = extracted.handoffNote;
    return normalizeLeadVisibleMessageStyle(extracted.text);
  }).filter(Boolean);

  return { messages, handoffCode, handoffNote };
};

// Safety net for the terminal commercial commitment. The primary path remains
// the explicit technical tag, but a model must not be allowed to promise a
// quotation and then leave the autonomous attendant active just because it
// omitted that invisible tag.
const QUALIFICATION_COMPLETION_COMMITMENT_REGEX = /\b(?:vou|irei|vamos|já vou|agora vou)\s+(?:preparar|montar|elaborar|enviar|encaminhar|providenciar)\s+(?:(?:a|uma)\s+)?(?:(?:sua|a sua)\s+)?(?:cotação|cotacao|proposta)\b/i;

export const inferQualificationCompletionHandoff = (visibleMessages: string[]): HandoffCode | null => {
  const visibleReply = visibleMessages.join('\n').trim();
  return QUALIFICATION_COMPLETION_COMMITMENT_REGEX.test(visibleReply) ? 'QUALIFICACAO_COMPLETA' : null;
};
