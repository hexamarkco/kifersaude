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

export const HANDOFF_TAG_REGEX = /\[\[HANDOFF:\s*([^\]]{1,200})\]\]\s*$/i;
export const OPENING_MESSAGE_SPLIT_REGEX = /\n?-{3,}\n?/;

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
  const mandatoryOpening = options.isFirstLeadReplyAfterApproach
    ? [
        '--- ABERTURA OBRIGATORIA DESTA RESPOSTA ---',
        'Esta e a primeira resposta apos a abordagem inicial. Comece a mensagem visivel com uma apresentacao curta e pessoal ANTES de responder ao conteudo ou fazer a proxima pergunta.',
        firstName
          ? `Use somente este primeiro nome validado, nunca o nome completo: "${firstName}". Escolha uma abertura natural no mesmo sentido de "${firstName}, prazer em falar com você." ou "${firstName}, que bom falar com você.".`
          : 'O nome do CRM nao foi validado. Nao use nem invente nome; abra naturalmente, por exemplo "Prazer em falar com você." ou "Que bom falar com você.".',
        'Nao use bom dia, boa tarde, boa noite ou outra saudacao de horario. Use essa apresentacao mesmo que o lead ja tenha dado informacoes na primeira mensagem. Em seguida, acolha o que ele disse e continue a qualificacao com no maximo uma pergunta. Nao repita essa apresentacao nas respostas seguintes.',
      ].join('\n')
    : '';
  return [
    '--- CONVERSA ATE AGORA (LEAD = pessoa simulando o cliente, VOCE = suas respostas anteriores) ---',
    transcriptLines.join('\n'),
    nameUsageGuidance,
    mandatoryOpening,
    '',
    '--- TAREFA ---',
    'Gere a proxima resposta, como VOCE, para a ultima mensagem do LEAD.',
  ].join('\n');
};

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
