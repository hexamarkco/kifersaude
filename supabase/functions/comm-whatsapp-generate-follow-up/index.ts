import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  resolveCommWhatsAppCanonicalChatRouteByUuid,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';
import {
  buildStyleExamples,
  buildStyleProfile,
  buildStyleProfileText,
  STYLE_SAMPLE_LIMIT,
} from '../_shared/comm-whatsapp-transcript.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type FollowUpTone = 'consultivo' | 'amigavel' | 'direto' | 'reativacao' | 'premium';

type GenerateFollowUpBody = {
  chatId?: string;
  customInstructions?: string;
  tone?: string;
  mode?: string;
  currentMessage?: string;
  adjustmentInstruction?: string;
  variantCount?: number;
  salesTechniques?: unknown;
  situationPresetIds?: unknown;
  autoSelectContext?: boolean;
  manualContext?: unknown;
};

const FOLLOW_UP_TONES: FollowUpTone[] = ['consultivo', 'amigavel', 'direto', 'reativacao', 'premium'];

const isFollowUpTone = (value: string): value is FollowUpTone => FOLLOW_UP_TONES.includes(value as FollowUpTone);

const getFollowUpToneInstruction = (tone: FollowUpTone) => {
  switch (tone) {
    case 'amigavel':
      return 'Tom amigavel: escreva de forma leve, acolhedora e proxima, mantendo profissionalismo e objetividade.';
    case 'direto':
      return 'Tom direto: seja breve, objetivo e claro sobre o proximo passo, sem parecer frio ou pressionar demais.';
    case 'reativacao':
      return 'Tom de reativacao: retome a conversa parada com naturalidade, baixa pressao e uma pergunta simples para facilitar resposta.';
    case 'premium':
      return 'Tom premium: transmita cuidado personalizado, atencao consultiva e sensacao de atendimento diferenciado, sem exageros.';
    case 'consultivo':
    default:
      return 'Tom consultivo: oriente com contexto, demonstre escuta ativa e proponha um proximo passo claro e util.';
  }
};

type ChatRow = {
  id: string;
  phone_number: string;
  display_name: string;
  saved_contact_name: string | null;
  push_name: string | null;
  lead_id: string | null;
};

type LeadRow = {
  id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  origem: string | null;
  status: string | null;
  responsavel: string | null;
};

type LookupLabelRow = {
  nome?: string | null;
  label?: string | null;
  value?: string | null;
};

type MessageRow = {
  id: string;
  direction: 'inbound' | 'outbound' | 'system';
  message_type: string;
  delivery_status: string;
  text_content: string | null;
  message_at: string;
  media_caption: string | null;
  transcription_text: string | null;
};

type SystemSettingsRow = {
  company_name: string | null;
  timezone: string | null;
};

type IntegrationSettingRow = {
  settings: Record<string, unknown> | null;
};

type FollowUpLeadContext = {
  nome: string;
  primeiro_nome: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const AI_FOLLOW_UP_PROMPT_SLUG = 'ai_follow_up_prompt';
const DEFAULT_SYSTEM_TIMEZONE = 'America/Sao_Paulo';
const MESSAGE_PAGE_SIZE = 1000;
const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Áudio sem transcrição]';
const MAX_FOLLOW_UP_VARIANTS = 5;
const DAILY_FOLLOW_UP_CAPACITY = 15;
const WAIT_COOLDOWN_BUSINESS_DAYS = 7;
const FOLLOW_UP_SCHEDULE_HOURS = [10, 11, 14, 15, 16] as const;
const OUTBOUND_ATTEMPT_GROUP_GAP_MS = 2 * 60 * 60 * 1000;
const FOLLOW_UP_SITUATION_PRESETS = [
  {
    id: 'cliente_sumiu',
    label: 'Cliente sumiu',
    instruction: 'Cenário: cliente parou de responder. Faça um follow-up curto, leve e sem cobrança. Reforce que está disponível para ajudar e termine com uma pergunta simples para retomar a conversa.',
  },
  {
    id: 'achou_caro',
    label: 'Achou caro',
    instruction: 'Cenário: cliente achou o plano caro. Reconheça a preocupação com preço, destaque valor e adequação do plano, ofereça revisar alternativas e evite tom defensivo.',
  },
  {
    id: 'comparando_concorrente',
    label: 'Comparando concorrente',
    instruction: 'Cenário: cliente está comparando com concorrentes. Oriente a mensagem a comparar benefícios, rede, carências e suporte de forma objetiva, sem desqualificar outras empresas.',
  },
  {
    id: 'pediu_retorno_depois',
    label: 'Pediu retorno depois',
    instruction: 'Cenário: cliente pediu para retornar depois. Seja respeitoso com o prazo, mencione que está retomando conforme combinado e proponha um próximo passo objetivo.',
  },
  {
    id: 'aguardando_documentos',
    label: 'Aguardando documentos',
    instruction: 'Cenário: estamos aguardando documentos. Lembre de forma cordial quais documentos faltam, explique que eles são necessários para avançar e ofereça ajuda em caso de dúvida.',
  },
] as const;
const FOLLOW_UP_SITUATION_PRESET_BY_ID: ReadonlyMap<string, (typeof FOLLOW_UP_SITUATION_PRESETS)[number]> = new Map(
  FOLLOW_UP_SITUATION_PRESETS.map((preset) => [preset.id, preset]),
);

type FollowUpSalesTechniqueOption = {
  id: string;
  name: string;
  description: string;
};

const FOLLOW_UP_SALES_TECHNIQUE_OPTIONS = [
  {
    id: 'rapport',
    name: 'Rapport',
    description: 'Criar proximidade e demonstrar atenção ao contexto do cliente.',
  },
  {
    id: 'spin-selling',
    name: 'SPIN Selling',
    description: 'Explorar situação, problema, implicação e necessidade de solução.',
  },
  {
    id: 'social-proof',
    name: 'Prova social',
    description: 'Reforçar segurança com exemplos ou validações sem inventar dados.',
  },
  {
    id: 'scarcity-urgency',
    name: 'Escassez e urgência',
    description: 'Indicar próximos passos e timing com cuidado, sem pressão artificial.',
  },
  {
    id: 'objection-handling',
    name: 'Contorno de objeções',
    description: 'Responder dúvidas prováveis com empatia e clareza comercial.',
  },
  {
    id: 'assumptive-close',
    name: 'Fechamento assumitivo',
    description: 'Conduzir para uma decisão ou ação objetiva de forma natural.',
  },
] as const satisfies readonly FollowUpSalesTechniqueOption[];

const FOLLOW_UP_SALES_TECHNIQUE_BY_ID: ReadonlyMap<string, FollowUpSalesTechniqueOption> = new Map(
  FOLLOW_UP_SALES_TECHNIQUE_OPTIONS.map((technique) => [technique.id, technique]),
);

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeGeneratedText = (value: string) => {
  let next = value.trim();
  if (next.startsWith('```') && next.endsWith('```')) {
    next = next.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
  }
  if (
    (next.startsWith('"') && next.endsWith('"'))
    || (next.startsWith("'") && next.endsWith("'"))
    || (next.startsWith('“') && next.endsWith('”'))
  ) {
    next = next.slice(1, -1).trim();
  }
  return next;
};

const normalizeSalesTechniques = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const selected: FollowUpSalesTechniqueOption[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const techniqueId = toTrimmedString(item);
    if (!techniqueId || seen.has(techniqueId)) {
      continue;
    }

    const technique = FOLLOW_UP_SALES_TECHNIQUE_BY_ID.get(techniqueId);
    if (!technique) {
      continue;
    }

    selected.push(technique);
    seen.add(techniqueId);
  }

  return selected;
};

type FollowUpNextAction = {
  type: 'schedule' | 'wait' | 'mark_lost_recommended';
  suggestedDateTime: string | null;
  priority: 'baixa' | 'normal' | 'alta';
  title: string;
  reason: string;
  attemptNumber: number;
  maxAttempts: number;
  dayLoad: number | null;
  dailyCapacity: number;
  giveUpRecommendation: string;
};

type FollowUpNextActionType = FollowUpNextAction['type'];

type EmotionalContext = {
  detected: boolean;
  guidance: string | null;
};

type AiContextRecommendation = {
  situationSummary: string | null;
  emotionalContext: EmotionalContext | null;
  situationPresetIds: string[];
  tone: FollowUpTone;
  salesTechniques: string[];
  rationale: string | null;
  nextActionType: FollowUpNextActionType | null;
  nextActionReason: string | null;
  nextActionPriority: FollowUpNextAction['priority'] | null;
};

const normalizeNextActionType = (value: unknown): FollowUpNextActionType | null => {
  const candidate = toTrimmedString(value);
  return candidate === 'schedule' || candidate === 'wait' || candidate === 'mark_lost_recommended' ? candidate : null;
};

const normalizeNextActionPriority = (value: unknown): FollowUpNextAction['priority'] | null => {
  const candidate = toTrimmedString(value);
  return candidate === 'baixa' || candidate === 'normal' || candidate === 'alta' ? candidate : null;
};

const normalizeSituationPresetIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const selected: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const presetId = toTrimmedString(item);
    if (!presetId || seen.has(presetId) || !FOLLOW_UP_SITUATION_PRESET_BY_ID.has(presetId)) {
      continue;
    }

    selected.push(presetId);
    seen.add(presetId);
  }

  return selected;
};

const parseEmotionalContext = (value: unknown): EmotionalContext | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    detected: value.detected === true,
    guidance: toTrimmedString(value.guidance) || null,
  };
};

const parseAiContextFromRecord = (parsed: Record<string, unknown>): AiContextRecommendation => {
  const toneCandidate = toTrimmedString(parsed.tone);
  const tone = isFollowUpTone(toneCandidate) ? toneCandidate : 'consultivo';
  const situationPresetIds = normalizeSituationPresetIds(parsed.situationPresetIds);
  const salesTechniques = normalizeSalesTechniques(parsed.salesTechniques).map((technique) => technique.id);
  const nextAction = isRecord(parsed.nextAction) ? parsed.nextAction : null;

  return {
    situationSummary: toTrimmedString(parsed.situationSummary) || null,
    emotionalContext: parseEmotionalContext(parsed.emotionalContext),
    situationPresetIds,
    tone,
    salesTechniques,
    rationale: toTrimmedString(parsed.rationale) || null,
    nextActionType: normalizeNextActionType(nextAction?.type),
    nextActionReason: toTrimmedString(nextAction?.reason) || null,
    nextActionPriority: normalizeNextActionPriority(nextAction?.priority),
  };
};

const clampVariantCount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_FOLLOW_UP_VARIANTS, Math.round(value)));
};

type FollowUpVariation = { label: string; text: string };

type FollowUpGenerationResult = {
  aiContext: AiContextRecommendation | null;
  text: string | null;
  variations: FollowUpVariation[];
};

// Parser unico: a mesma chamada de IA que interpreta a conversa (resumo,
// contexto emocional, cenario/tom/tecnica, proxima acao) tambem escreve a
// mensagem final, entao os dois vem juntos no mesmo JSON.
const parseFollowUpGenerationResult = (value: string, shouldGenerateVariations: boolean): FollowUpGenerationResult => {
  const candidate = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!isRecord(parsed)) {
      return { aiContext: null, text: null, variations: [] };
    }

    const aiContext = parseAiContextFromRecord(parsed);

    if (shouldGenerateVariations) {
      const rawVariations = Array.isArray(parsed.variations) ? parsed.variations : [];
      const variations = rawVariations
        .map((variation, index) => {
          if (!isRecord(variation)) return null;
          const text = toTrimmedString(variation.text);
          if (!text) return null;
          return { label: toTrimmedString(variation.label) || `Variacao ${index + 1}`, text };
        })
        .filter((variation): variation is FollowUpVariation => Boolean(variation));

      return { aiContext, text: null, variations };
    }

    return { aiContext, text: toTrimmedString(parsed.text) || null, variations: [] };
  } catch {
    return { aiContext: null, text: null, variations: [] };
  }
};

const normalizeSystemTimeZone = (value: unknown) => {
  const candidate = toTrimmedString(value);
  if (!candidate) {
    return DEFAULT_SYSTEM_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_SYSTEM_TIMEZONE;
  }
};

const getDateTimeParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
    hour: read('hour'),
    minute: read('minute'),
  };
};

const isManualContextFlagEnabled = (value: unknown, key: string) => {
  if (!isRecord(value)) {
    return false;
  }

  return value[key] === true;
};

const getBusinessDayOffsetForAttempt = (attemptNumber: number) => {
  if (attemptNumber <= 1) return 1;
  if (attemptNumber === 2) return 2;
  if (attemptNumber === 3) return 3;
  return 5;
};

const addBusinessDays = (date: Date, businessDays: number) => {
  const next = new Date(date);
  let added = 0;

  while (added < businessDays) {
    next.setUTCDate(next.getUTCDate() + 1);
    const day = next.getUTCDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return next;
};

const getSaoPauloDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_SYSTEM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read('year'), month: read('month'), day: read('day') };
};

const buildSaoPauloDateTimeUtc = (date: Date, hour: number) => {
  const { year, month, day } = getSaoPauloDateParts(date);
  return new Date(Date.UTC(year, month - 1, day, hour + 3, 0, 0, 0));
};

const getSaoPauloDayUtcRange = (date: Date) => {
  const { year, month, day } = getSaoPauloDateParts(date);
  return {
    start: new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0, 0)),
  };
};

const countPendingRemindersForDay = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  date: Date,
) => {
  const range = getSaoPauloDayUtcRange(date);
  const { count, error } = await supabaseAdmin
    .from('reminders')
    .select('id', { count: 'exact', head: true })
    .eq('lido', false)
    .gte('data_lembrete', range.start.toISOString())
    .lt('data_lembrete', range.end.toISOString());

  if (error) {
    console.error('[comm-whatsapp-generate-follow-up] erro ao contar lembretes do dia', error);
    return null;
  }

  return count ?? 0;
};

const countConsecutiveOutboundAttempts = (messages: MessageRow[]) => {
  let lastInboundIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].direction === 'inbound') {
      lastInboundIndex = index;
      break;
    }
  }

  const outboundMessages = messages
    .slice(lastInboundIndex + 1)
    .filter((message) => message.direction === 'outbound' && buildTranscriptContent(message));

  if (outboundMessages.length === 0) {
    return 0;
  }

  let attempts = 1;
  let previousMessageAt = Date.parse(outboundMessages[0].message_at);

  for (const message of outboundMessages.slice(1)) {
    const messageAt = Date.parse(message.message_at);
    if (!Number.isNaN(messageAt) && !Number.isNaN(previousMessageAt) && messageAt - previousMessageAt > OUTBOUND_ATTEMPT_GROUP_GAP_MS) {
      attempts += 1;
    }

    previousMessageAt = messageAt;
  }

  return attempts;
};

// ---- Temporal facts (calculados em codigo, nao adivinhados pela IA a
// partir de timestamps brutos do transcript) ----

type PeriodOfDay = 'manha' | 'tarde' | 'noite';

type TemporalFacts = {
  lastMessageElapsed: string | null;
  lastInboundElapsed: string | null;
  lastOutboundElapsed: string | null;
  contactedToday: boolean;
  periodOfDay: PeriodOfDay;
  consecutiveOutboundAttempts: number;
};

const formatElapsedPortuguese = (rawMs: number): string => {
  const ms = Math.max(0, rawMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (ms < minute) return 'agora mesmo';

  if (ms < hour) {
    const minutes = Math.round(ms / minute);
    return `há ${minutes} minuto${minutes === 1 ? '' : 's'}`;
  }

  if (ms < day) {
    const hours = Math.round(ms / hour);
    return `há ${hours} hora${hours === 1 ? '' : 's'}`;
  }

  const days = Math.round(ms / day);
  if (days < 30) {
    return `há ${days} dia${days === 1 ? '' : 's'}`;
  }

  const months = Math.round(days / 30);
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
};

const isSameCalendarDay = (a: Date, b: Date, timeZone: string): boolean => {
  const partsA = getDateTimeParts(a, timeZone);
  const partsB = getDateTimeParts(b, timeZone);
  return partsA.year === partsB.year && partsA.month === partsB.month && partsA.day === partsB.day;
};

const getPeriodOfDay = (date: Date, timeZone: string): PeriodOfDay => {
  const hour = Number(getDateTimeParts(date, timeZone).hour);
  if (hour >= 5 && hour < 12) return 'manha';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
};

const buildTemporalFacts = (messages: MessageRow[], now: Date, timeZone: string): TemporalFacts => {
  const contentMessages = messages.filter((message) => Boolean(buildTranscriptContent(message)));
  const last = contentMessages[contentMessages.length - 1] ?? null;
  const lastInbound = [...contentMessages].reverse().find((message) => message.direction === 'inbound') ?? null;
  const lastOutbound = [...contentMessages].reverse().find((message) => message.direction === 'outbound') ?? null;

  const elapsedFrom = (message: MessageRow | null): string | null => {
    if (!message) return null;
    const messageAt = Date.parse(message.message_at);
    if (Number.isNaN(messageAt)) return null;
    return formatElapsedPortuguese(now.getTime() - messageAt);
  };

  const lastDate = last ? new Date(Date.parse(last.message_at)) : null;
  const contactedToday = Boolean(lastDate && !Number.isNaN(lastDate.getTime()) && isSameCalendarDay(lastDate, now, timeZone));

  return {
    lastMessageElapsed: elapsedFrom(last),
    lastInboundElapsed: elapsedFrom(lastInbound),
    lastOutboundElapsed: elapsedFrom(lastOutbound),
    contactedToday,
    periodOfDay: getPeriodOfDay(now, timeZone),
    consecutiveOutboundAttempts: countConsecutiveOutboundAttempts(messages),
  };
};

const formatTemporalFactsForPrompt = (facts: TemporalFacts): string => [
  'FATOS TEMPORAIS (calculados pelo sistema — use exatamente estes fatos, nao tente recalcular tempo decorrido lendo os timestamps do historico):',
  `- Ultima mensagem nesta conversa, de qualquer lado: ${facts.lastMessageElapsed ?? 'sem historico util'}.`,
  `- Ultima mensagem do cliente: ${facts.lastInboundElapsed ?? 'o cliente ainda nao respondeu nesta conversa'}.`,
  `- Sua ultima mensagem: ${facts.lastOutboundElapsed ?? 'voce ainda nao enviou nada nesta conversa'}.`,
  `- Ja houve contato (de qualquer lado) hoje, antes de agora: ${facts.contactedToday ? 'sim' : 'nao'}.`,
  `- Periodo do dia agora: ${facts.periodOfDay}.`,
  `- Tentativas consecutivas de follow-up sem resposta do cliente desde a ultima mensagem dele: ${facts.consecutiveOutboundAttempts}.`,
  'REGRA DE SAUDACAO: se ja houve contato hoje, NUNCA repita saudacao — continue a conversa diretamente, como uma pessoa real continuaria. Se ainda NAO houve contato hoje, uma saudacao (bom dia/boa tarde/boa noite/oi) normalmente cabe e e o mais natural, principalmente quando a ultima mensagem de qualquer lado foi ha dias — retomar contato depois de um tempo sem nenhuma saudacao soa abrupto e frio, como se a conversa nunca tivesse parado; use bom senso apenas se o contexto humano/emocional pedir uma abertura diferente. Nunca trate "ha alguns dias" ou "ha algumas horas" como se fosse "ontem" ou "agora ha pouco" — use a distancia real informada acima.',
].join('\n');

const computeAvailableFollowUpDate = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  now: Date,
  businessDays: number,
) => {
  let candidateDay = addBusinessDays(now, businessDays);
  let dayLoad: number | null = null;

  for (let attempts = 0; attempts < 10; attempts += 1) {
    dayLoad = await countPendingRemindersForDay(supabaseAdmin, candidateDay);
    if (dayLoad === null || dayLoad < DAILY_FOLLOW_UP_CAPACITY) break;
    candidateDay = addBusinessDays(candidateDay, 1);
  }

  const hour = FOLLOW_UP_SCHEDULE_HOURS[Math.max(0, Math.min(FOLLOW_UP_SCHEDULE_HOURS.length - 1, dayLoad ?? 0)) % FOLLOW_UP_SCHEDULE_HOURS.length];
  return { suggestedDate: buildSaoPauloDateTimeUtc(candidateDay, hour), dayLoad };
};

const buildFollowUpNextAction = async (params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  messages: MessageRow[];
  lead: LeadRow | null;
  leadContext: FollowUpLeadContext;
  effectiveSituationPresetIds: string[];
  aiContext: AiContextRecommendation | null;
  now: Date;
}): Promise<FollowUpNextAction> => {
  const consecutiveOutboundAttempts = countConsecutiveOutboundAttempts(params.messages);
  const attemptNumber = Math.min(Math.max(consecutiveOutboundAttempts, 1), 5);
  const maxAttempts = 4;
  const leadStatus = toTrimmedString(params.lead?.status).toLowerCase();
  const aiNextActionType = params.aiContext?.nextActionType ?? null;
  const aiNextActionReason = params.aiContext?.nextActionReason ?? null;
  const aiNextActionPriority = params.aiContext?.nextActionPriority ?? null;

  if (['perdido', 'convertido', 'fechado', 'duplicado'].includes(leadStatus)) {
    return {
      type: 'wait',
      suggestedDateTime: null,
      priority: 'baixa',
      title: `Follow-up: ${params.leadContext.nome}`,
      reason: 'O status atual do lead não pede novo follow-up automático.',
      attemptNumber,
      maxAttempts,
      dayLoad: null,
      dailyCapacity: DAILY_FOLLOW_UP_CAPACITY,
      giveUpRecommendation: 'Não agendar novo retorno enquanto o status permanecer finalizado.',
    };
  }

  if (aiNextActionType === 'wait') {
    const { suggestedDate: waitDate, dayLoad: waitDayLoad } = await computeAvailableFollowUpDate(
      params.supabaseAdmin,
      params.now,
      WAIT_COOLDOWN_BUSINESS_DAYS,
    );

    return {
      type: 'wait',
      suggestedDateTime: waitDate.toISOString(),
      priority: aiNextActionPriority ?? 'baixa',
      title: `Retomar contato: ${params.leadContext.nome}`,
      reason: aiNextActionReason || 'O contexto da conversa indica que ainda não é o momento de uma nova cobrança; agendamos um retorno mais distante para reavaliar.',
      attemptNumber,
      maxAttempts,
      dayLoad: waitDayLoad,
      dailyCapacity: DAILY_FOLLOW_UP_CAPACITY,
      giveUpRecommendation: 'Acompanhe o contexto antes de criar uma nova cobrança ou marcar o lead como perdido.',
    };
  }

  if (aiNextActionType === 'mark_lost_recommended' || (!params.aiContext && attemptNumber > maxAttempts)) {
    return {
      type: 'mark_lost_recommended',
      suggestedDateTime: null,
      priority: aiNextActionPriority ?? 'baixa',
      title: `Última tentativa: ${params.leadContext.nome}`,
      reason: aiNextActionReason || 'Já houve várias tentativas consecutivas sem resposta do cliente.',
      attemptNumber,
      maxAttempts,
      dayLoad: null,
      dailyCapacity: DAILY_FOLLOW_UP_CAPACITY,
      giveUpRecommendation: 'Se não houver resposta após esta mensagem, recomendamos marcar o lead como Perdido e limpar próximos lembretes.',
    };
  }

  const businessDays = getBusinessDayOffsetForAttempt(attemptNumber);
  const { suggestedDate, dayLoad } = await computeAvailableFollowUpDate(params.supabaseAdmin, params.now, businessDays);
  const isLastAttempt = attemptNumber >= maxAttempts;
  const hasDocumentScenario = params.effectiveSituationPresetIds.includes('aguardando_documentos');

  return {
    type: 'schedule',
    suggestedDateTime: suggestedDate.toISOString(),
    priority: aiNextActionPriority ?? (hasDocumentScenario || isLastAttempt ? 'alta' : 'normal'),
    title: `${isLastAttempt ? 'Última tentativa' : 'Follow-up'}: ${params.leadContext.nome}`,
    reason: aiNextActionReason || (dayLoad !== null && dayLoad >= DAILY_FOLLOW_UP_CAPACITY
      ? `A data inicial estava cheia. Sugeri o próximo dia útil com menos de ${DAILY_FOLLOW_UP_CAPACITY} lembretes pendentes.`
      : `Cadência sugerida para a tentativa ${attemptNumber}: +${businessDays} dia(s) útil(eis), evitando concentrar mais de ${DAILY_FOLLOW_UP_CAPACITY} follow-ups no mesmo dia.`),
    attemptNumber,
    maxAttempts,
    dayLoad,
    dailyCapacity: DAILY_FOLLOW_UP_CAPACITY,
    giveUpRecommendation: isLastAttempt
      ? 'Esta deve ser a última tentativa. Se não houver resposta, recomendamos marcar como Perdido.'
      : `Se não houver resposta até a tentativa ${maxAttempts}, recomendamos fazer uma última tentativa leve e depois marcar como Perdido.`,
  };
};

const formatTranscriptTimestamp = (value: string, timeZone: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '[--:--, --/--/----]';
  }

  const parts = getDateTimeParts(date, timeZone);
  return `[${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}]`;
};

const formatDateForPrompt = (date: Date, timeZone: string) => {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.day}/${parts.month}/${parts.year}`;
};

const formatTimeForPrompt = (date: Date, timeZone: string) => {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
};

const formatDateTimeForPrompt = (date: Date, timeZone: string) => {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};

const getFirstName = (value: string) => value.trim().split(/\s+/)[0] ?? '';

const buildFollowUpLeadContext = (lead: LeadRow | null, chat: ChatRow): FollowUpLeadContext => {
  const nome =
    toTrimmedString(chat.saved_contact_name) ||
    toTrimmedString(lead?.nome_completo) ||
    toTrimmedString(chat.push_name) ||
    toTrimmedString(chat.display_name) ||
    toTrimmedString(chat.phone_number) ||
    'Contato';

  return {
    nome,
    primeiro_nome: getFirstName(nome),
  };
};

const applyFollowUpPromptVariables = (template: string, context: FollowUpLeadContext, timeZone: string) => {
  const now = new Date();
  const replacements: Array<[RegExp, string]> = [
    [/{{\s*nome\s*}}/gi, context.nome],
    [/{{\s*primeiro_nome\s*}}/gi, context.primeiro_nome],
    [/{{\s*data_hoje\s*}}/gi, formatDateForPrompt(now, timeZone)],
    [/{{\s*hora_agora\s*}}/gi, formatTimeForPrompt(now, timeZone)],
    [/{{\s*data_hora_atual_sistema\s*}}/gi, formatDateTimeForPrompt(now, timeZone)],
    [/{{\s*data_hora_atual_brasilia\s*}}/gi, formatDateTimeForPrompt(now, timeZone)],
  ];

  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), template).trim();
};

const normalizeTranscriptText = (value: string) => value.replace(/\s+/g, ' ').trim();

const getUnknownMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();
  if (!normalized) {
    return '[Mensagem sem conteudo]';
  }

  return `[${normalized}]`;
};

const getDeletedMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();

  switch (normalized) {
    case 'image':
      return '[Imagem apagada]';
    case 'video':
    case 'gif':
    case 'short':
      return '[Video apagado]';
    case 'audio':
    case 'voice':
      return '[Audio apagado]';
    case 'document':
      return '[Documento apagado]';
    case 'sticker':
      return '[Sticker apagado]';
    case 'contact':
    case 'contact_list':
      return '[Contato apagado]';
    case 'poll':
      return '[Enquete apagada]';
    default:
      return '[Mensagem apagada]';
  }
};

const buildTranscriptContent = (message: MessageRow) => {
  if (message.direction === 'system') {
    return '';
  }

  if (message.direction === 'outbound' && message.delivery_status.trim().toLowerCase() === 'failed') {
    return '';
  }

  const text = normalizeTranscriptText(toTrimmedString(message.text_content));
  const caption = normalizeTranscriptText(toTrimmedString(message.media_caption));
  const transcription = normalizeTranscriptText(toTrimmedString(message.transcription_text));
  const kind = message.message_type.trim().toLowerCase();
  const isDeleted = message.delivery_status.trim().toLowerCase() === 'deleted';

  const withDeletedFlag = (content: string) => {
    if (!isDeleted) {
      return content;
    }

    return content ? `[Mensagem apagada] ${content}` : getDeletedMessageMarker(kind);
  };

  if (kind === 'text') {
    return withDeletedFlag(text);
  }

  if (kind === 'image') {
    return withDeletedFlag(caption ? `[Imagem] ${caption}` : '[Imagem]');
  }

  if (kind === 'video' || kind === 'gif' || kind === 'short') {
    return withDeletedFlag(caption ? `[Video] ${caption}` : '[Video]');
  }

  if (kind === 'document') {
    return withDeletedFlag(caption ? `[Documento] ${caption}` : '[Documento]');
  }

  if (kind === 'audio' || kind === 'voice') {
    return withDeletedFlag(transcription || AUDIO_WITHOUT_TRANSCRIPTION_MARKER);
  }

  if (caption) {
    return withDeletedFlag(caption);
  }

  if (text) {
    return withDeletedFlag(text);
  }

  if (transcription) {
    return withDeletedFlag(transcription);
  }

  return withDeletedFlag(getUnknownMessageMarker(kind));
};

const buildTranscriptLine = (message: MessageRow, leadLabel: string, timeZone: string) => {
  const content = buildTranscriptContent(message);
  if (!content) {
    return null;
  }

  const author = message.direction === 'outbound' ? 'Eu' : leadLabel;
  return `${formatTranscriptTimestamp(message.message_at, timeZone)} ${author}: ${content}`;
};

const loadAllMessagesForChat = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  chatId: string,
) => {
  const messages: MessageRow[] = [];

  for (let pageStart = 0; ; pageStart += MESSAGE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('id, direction, message_type, delivery_status, text_content, message_at, media_caption, transcription_text')
      .eq('chat_id', chatId)
      .order('message_at', { ascending: true })
      .order('id', { ascending: true })
      .range(pageStart, pageStart + MESSAGE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao carregar historico do WhatsApp: ${error.message}`);
    }

    const page = (data ?? []) as MessageRow[];
    messages.push(...page);

    if (page.length < MESSAGE_PAGE_SIZE) {
      break;
    }
  }

  return messages;
};

const loadLeadContext = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  leadId: string | null,
): Promise<LeadRow | null> => {
  if (!leadId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar lead vinculado: ${error.message}`);
  }

  if (!isRecord(data)) {
    return null;
  }

  const statusId = toTrimmedString(data.status_id);
  const origemId = toTrimmedString(data.origem_id);
  const responsavelId = toTrimmedString(data.responsavel_id);

  const [statusLookup, origemLookup, responsavelLookup] = await Promise.all([
    !toTrimmedString(data.status) && statusId
      ? supabaseAdmin.from('lead_status_config').select('nome').eq('id', statusId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    !toTrimmedString(data.origem) && origemId
      ? supabaseAdmin.from('lead_origens').select('nome').eq('id', origemId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    !toTrimmedString(data.responsavel) && responsavelId
      ? supabaseAdmin.from('lead_responsaveis').select('label, value').eq('id', responsavelId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (statusLookup.error) {
    throw new Error(`Erro ao carregar label de status do lead: ${statusLookup.error.message}`);
  }

  if (origemLookup.error) {
    throw new Error(`Erro ao carregar label de origem do lead: ${origemLookup.error.message}`);
  }

  if (responsavelLookup.error) {
    throw new Error(`Erro ao carregar label de responsavel do lead: ${responsavelLookup.error.message}`);
  }

  const statusData = (statusLookup.data ?? null) as LookupLabelRow | null;
  const origemData = (origemLookup.data ?? null) as LookupLabelRow | null;
  const responsavelData = (responsavelLookup.data ?? null) as LookupLabelRow | null;

  return {
    id: toTrimmedString(data.id) || leadId,
    nome_completo: toTrimmedString(data.nome_completo),
    telefone: toTrimmedString(data.telefone) || null,
    email: toTrimmedString(data.email) || null,
    cidade: toTrimmedString(data.cidade) || null,
    origem: toTrimmedString(data.origem) || toTrimmedString(origemData?.nome) || null,
    status: toTrimmedString(data.status) || toTrimmedString(statusData?.nome) || null,
    responsavel:
      toTrimmedString(data.responsavel) ||
      toTrimmedString(responsavelData?.label) ||
      toTrimmedString(responsavelData?.value) ||
      null,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const authResult = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: COMM_WHATSAPP_MODULE,
      requiredPermission: 'view',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as GenerateFollowUpBody;
    const chatId = toTrimmedString(body.chatId);
    const customInstructions = toTrimmedString(body.customInstructions);
    const toneCandidate = toTrimmedString(body.tone);
    const requestedTone = isFollowUpTone(toneCandidate) ? toneCandidate : 'consultivo';
    const refinementMode = toTrimmedString(body.mode) === 'refine';
    const currentMessage = toTrimmedString(body.currentMessage);
    const adjustmentInstruction = toTrimmedString(body.adjustmentInstruction);
    const variantCount = refinementMode ? 1 : clampVariantCount(body.variantCount);
    const shouldGenerateVariations = !refinementMode && variantCount > 1;
    const requestedSalesTechniqueIds = normalizeSalesTechniques(body.salesTechniques).map((technique) => technique.id);
    const requestedSituationPresetIds = normalizeSituationPresetIds(body.situationPresetIds);
    const autoSelectContext = body.autoSelectContext !== false && !refinementMode;
    const manualContext = {
      tone: isManualContextFlagEnabled(body.manualContext, 'tone'),
      situationPresetIds: isManualContextFlagEnabled(body.manualContext, 'situationPresetIds'),
      salesTechniques: isManualContextFlagEnabled(body.manualContext, 'salesTechniques'),
    };

    // Não logar `body`, `customInstructions`, `currentMessage` nem `adjustmentInstruction`:
    // contêm o texto real da conversa com o lead/paciente (dado sensível), que não deve
    // ir para logs de produção da Edge Function.
    console.log('[FollowUpAI][edge] request received', {
      chatId,
      requestedTone,
      refinementMode,
      hasCustomInstructions: Boolean(customInstructions),
      hasCurrentMessage: Boolean(currentMessage),
      hasAdjustmentInstruction: Boolean(adjustmentInstruction),
      variantCount,
      shouldGenerateVariations,
      requestedSalesTechniqueIds,
      requestedSituationPresetIds,
      autoSelectContext,
      manualContext,
    });

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Conversa obrigatoria para gerar follow-up.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (refinementMode && !currentMessage) {
      return new Response(JSON.stringify({ error: 'Mensagem atual obrigatoria para refinar follow-up.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (refinementMode && !adjustmentInstruction) {
      return new Response(JSON.stringify({ error: 'Instrucao de ajuste obrigatoria para refinar follow-up.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const chatRoute = await resolveCommWhatsAppCanonicalChatRouteByUuid(supabaseAdmin, chatId);
    if (!chatRoute?.chatId) {
      return new Response(JSON.stringify({ error: 'Conversa do WhatsApp nao encontrada.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const { data: chatData, error: chatError } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('id, phone_number, display_name, saved_contact_name, push_name, lead_id')
      .eq('id', chatRoute.chatId)
      .maybeSingle();

    if (chatError) {
      throw new Error(`Erro ao localizar conversa do WhatsApp: ${chatError.message}`);
    }

    if (!chatData) {
      return new Response(JSON.stringify({ error: 'Conversa do WhatsApp nao encontrada.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const chat = chatData as ChatRow;

    const [messages, lead, systemSettingsResult, promptResult] = await Promise.all([
      loadAllMessagesForChat(supabaseAdmin, chat.id),
      loadLeadContext(supabaseAdmin, chat.lead_id),
      supabaseAdmin.from('system_settings').select('company_name, timezone').limit(1).maybeSingle(),
      supabaseAdmin.from('integration_settings').select('settings').eq('slug', AI_FOLLOW_UP_PROMPT_SLUG).maybeSingle(),
    ]);

    if (systemSettingsResult.error) {
      throw new Error(`Erro ao carregar configuracoes do sistema: ${systemSettingsResult.error.message}`);
    }

    if (promptResult.error) {
      throw new Error(`Erro ao carregar prompt de follow-up: ${promptResult.error.message}`);
    }
    const systemSettings = (systemSettingsResult.data ?? null) as SystemSettingsRow | null;
    const promptIntegration = (promptResult.data ?? null) as IntegrationSettingRow | null;
    const systemTimeZone = normalizeSystemTimeZone(systemSettings?.timezone);
    const companyName = toTrimmedString(systemSettings?.company_name) || 'Kifer Saude';
    const leadContext = buildFollowUpLeadContext(lead, chat);
    const transcriptLines = messages
      .map((message) => buildTranscriptLine(message, leadContext.nome, systemTimeZone))
      .filter((line): line is string => Boolean(line));

    // ---- Style analysis (aprende o estilo real de escrita a partir do
    // proprio historico ja carregado, sem round-trip extra ao banco) ----

    const styleMessages = messages
      .filter((message) => (
        message.direction === 'outbound'
        && message.message_type === 'text'
        && message.delivery_status.trim().toLowerCase() !== 'failed'
        && Boolean(toTrimmedString(message.text_content))
      ))
      .slice(-STYLE_SAMPLE_LIMIT);
    const styleProfile = buildStyleProfile(styleMessages);
    const styleProfileText = buildStyleProfileText(styleProfile);
    const styleExamples = buildStyleExamples(styleMessages);

    console.log('[FollowUpAI][edge] loaded context', {
      chat,
      lead,
      systemSettings,
      promptIntegration,
      systemTimeZone,
      companyName,
      leadContext,
      rawMessagesCount: messages.length,
      rawMessages: messages,
      transcriptLinesCount: transcriptLines.length,
      transcriptLines,
    });

    if (transcriptLines.length === 0) {
      return new Response(JSON.stringify({ error: 'Nao ha historico util suficiente para gerar follow-up.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const promptSettings = isRecord(promptIntegration?.settings) ? promptIntegration.settings : {};
    const configuredInstructions = applyFollowUpPromptVariables(
      toTrimmedString(promptSettings.instructions),
      leadContext,
      systemTimeZone,
    );

    const now = new Date();
    const temporalFacts = buildTemporalFacts(messages, now, systemTimeZone);
    const temporalFactsText = formatTemporalFactsForPrompt(temporalFacts);

    const baseContextPrompt = [
      'Contexto do chat:',
      `- Nome do contato: ${leadContext.nome}`,
      `- Telefone: ${toTrimmedString(lead?.telefone) || toTrimmedString(chat.phone_number) || 'Nao informado'}`,
      `- Lead vinculado: ${lead ? 'Sim' : 'Nao'}`,
      `- Status do lead: ${toTrimmedString(lead?.status) || 'Nao informado'}`,
      `- Responsavel: ${toTrimmedString(lead?.responsavel) || 'Nao informado'}`,
      `- Fuso do sistema: ${systemTimeZone}`,
      `- Agora no sistema: ${formatDateTimeForPrompt(now, systemTimeZone)}`,
      '',
      temporalFactsText,
      '',
      'Historico completo da conversa:',
      transcriptLines.join('\n'),
    ].join('\n');

    const hasCustomInstructions = Boolean(configuredInstructions);

    // Fato tecnico do sistema: sempre precisa ser dito, independente de haver
    // prompt customizado ou nao, porque e o proprio mecanismo de envio (nao e
    // uma preferencia de estilo) que reconhece este separador.
    const multiMessageMechanismNote = 'MECANISMO DO SISTEMA: uma linha contendo APENAS "---" (nada mais nela, nem antes nem depois na mesma linha) e reconhecida como separador entre mensagens distintas do WhatsApp — cada trecho entre separadores vira uma mensagem enviada em sequencia. Isso e diferente dos cabecalhos como "--- CONTEXTO ---" usados neste prompt como organizacao visual: so conta como separador real quando a linha tiver somente os tres tracos, sem texto colado.';

    // Tambem sempre ativo, independente de prompt customizado: SABER O
    // MECANISMO (acima) nao e o mesmo que saber QUANDO usa-lo. Sem isto, um
    // prompt customizado que nao mencione explicitamente "---" faz o modelo
    // nunca dividir a mensagem, mesmo tendo mais de uma ideia. Isto e
    // comportamento de segmentacao de envio, nao preferencia de estilo/voz —
    // por isso fica de fora do gate de hasCustomInstructions.
    const messageSplittingInstruction = 'DIVISAO EM MENSAGENS: sempre que o follow-up tiver mais de uma ideia (por exemplo: retomar o assunto + fazer uma pergunta; ou reconhecer algo + propor o proximo passo), quebre em 2 a 3 mensagens curtas em sequencia usando o separador "---", como uma pessoa real digitando mensagens separadas em vez de um unico bloco longo. So use uma unica mensagem sem separador quando o conteudo for realmente uma unica ideia curta. Exemplo de formato dividido (nao copie o conteudo, so o formato):\nOi Fernanda, tudo bem?\n---\nVi que ficou de dar uma olhada na proposta. Ainda faz sentido pra você?';

    // Instrucao pontual desta geracao especifica (campo "Instrucoes
    // personalizadas" no modal). Fica logo apos a voz-alvo, em posicao de
    // alta saliencia — antes ficava por ultimo, depois de tres catalogos
    // inteiros (cenarios/tons/tecnicas), o que na pratica fazia o modelo
    // dar menos peso a ela do que o "prioridade alta" prometia.
    const userCustomInstructionsBlock = customInstructions
      ? [
          'INSTRUCAO ESPECIFICA DESTA GERACAO (maxima prioridade, aplique de forma literal):',
          customInstructions,
          'Se esta instrucao mencionar uma data, prazo ou fato especifico (ex.: "hoje e dia X"), use exatamente esse dado na mensagem de forma clara e inequivoca — nao troque por uma referencia vaga nem deixe ambiguo se e hoje, uma data futura ou passada.',
        ].join('\n')
      : '';

    const configuredPromptBase = configuredInstructions || [
      `Voce gera sugestoes de follow-up prontas para envio no WhatsApp da operacao ${companyName}.`,
      'Cada mensagem deve ser contextualizada no historico real do chat: retome o ultimo assunto tratado, use os detalhes especificos da conversa e evite frases que servem para qualquer lead.',
      'A mensagem precisa soar como uma continuacao natural do ultimo contato, nao como um template pre-definido.',
    ].join('\n');

    // As regras genericas de brevidade/tom abaixo so entram quando NAO ha um
    // prompt customizado configurado (aba Integracoes). Se a operacao ja
    // definiu sua propria estrutura, duplicar essa orientacao aqui em
    // palavras diferentes so dilui a instrucao especifica dela em meio a
    // mais texto — melhor deixar o prompt customizado mandar sozinho nisso.
    // A divisao em "---" NAO entra aqui: e mecanismo de envio, nao estilo,
    // e fica sempre ativa via messageSplittingInstruction acima.
    const defaultConductRules = hasCustomInstructions ? '' : [
      'REGRAS DE CONDUTA:',
      '- Cada mensagem individual deve ser curta e direta, como uma mensagem real de WhatsApp: normalmente 1 a 2 frases curtas. Nao escreva paragrafos longos.',
      '- NUNCA use listas, bullets ou numeracao. Markdown so e permitido na forma do separador "---" descrito acima.',
      '- Dentro de cada mensagem, uma unica pergunta ou proximo passo por vez — nao empilhe varias perguntas na mesma mensagem.',
      '- Use o nome do lead se fizer sentido. Nao force.',
    ].join('\n');

    // Quando ha prompt customizado, ele define a voz-alvo (persona, regras
    // rigidas de pontuacao etc.) de forma explicita. Mensagens reais antigas
    // podem nao seguir essas regras novas (ex.: ainda usar "pra" ou dois
    // pontos) — copiar esses exemplos aqui puxaria o modelo de volta ao
    // habito antigo em vez da voz definida no prompt customizado. Por isso
    // o perfil/exemplos de estilo real so entram no fallback generico.
    const styleProfileSection = hasCustomInstructions
      ? ''
      : ['REGRAS DE ESTILO (aprendidas do historico real de mensagens da operacao):', styleProfileText].join('\n');

    // Sempre ativo, independente de prompt customizado: contexto emocional
    // detectado tem prioridade sobre qualquer tom/cenario/tecnica.
    const emotionalContextInstruction = [
      'CONTEXTO HUMANO E EMPATIA (sempre ativo — nao e uma preferencia de estilo, e uma regra de bom senso):',
      'Antes de decidir a abordagem, procure no historico sinais de que a conversa deixou de ser puramente comercial: doenca, luto, dificuldade pessoal, ansiedade ou frustracao, desabafo, problema profissional, ou qualquer acontecimento pessoal importante que o cliente tenha compartilhado — mesmo que tenha sido ha alguns dias.',
      'Se detectar algo assim, decida com bom senso qual a melhor resposta: pode ser uma mensagem puramente humana (perguntar como a pessoa esta, sem qualquer viés comercial), pode fazer sentido reconhecer brevemente o que foi dito antes de qualquer coisa comercial (so avance pro comercial se houver abertura natural depois), ou pode ser melhor simplesmente nao pressionar agora. A decisao e sua, nao existe um roteiro fixo pra isso.',
      'Contexto emocional detectado tem prioridade sobre qualquer tom, cenario ou tecnica comercial — inclusive os selecionados manualmente pelo usuario. Nunca ignore um assunto pessoal sensivel para voltar direto ao comercial como se nada tivesse sido dito.',
    ].join('\n');

    // Sempre ativo: sem isto, quando o cliente ainda nao respondeu apos a
    // ultima mensagem enviada ("Eu"), o modelo tende a reformular essa mesma
    // mensagem como se fosse um follow-up novo (ex.: repetir um prazo ou
    // pedido ja feito, mesmo que o prazo citado ja tenha passado segundo os
    // FATOS TEMPORAIS acima). Isso da a impressao de que a IA nao leu as
    // proprias mensagens ("Eu") no historico.
    const ownLastMessageAwarenessInstruction = [
      'ATENCAO A SUA PROPRIA ULTIMA MENSAGEM (sempre ativo): releia com atencao a(s) sua(s) ultima(s) mensagem(ns) marcadas como "Eu" no historico, principalmente se o cliente ainda nao respondeu depois delas.',
      'NUNCA reformule ou repita, como se fosse novidade, algo que voce mesmo ja disse na ultima mensagem (a mesma sugestao, o mesmo pedido, o mesmo prazo ou referencia de dia). Se voce ja pediu para o cliente ver algo ate um dia especifico (ex.: "ve isso no fim de semana") e esse dia ja passou segundo os FATOS TEMPORAIS, NAO repita essa instrucao como se ainda fosse futura — em vez disso, pergunte se ele conseguiu ver, sem soar repetitivo.',
      'O follow-up precisa ser uma CONTINUACAO real da conversa, acrescentando algo novo (uma checagem, uma pergunta de acompanhamento, uma informacao adicional) — nunca apenas parafrasear o que voce mesmo ja escreveu.',
    ].join('\n');

    // Ordem de raciocinio pedida: interpretar a conversa -> entender o
    // momento -> entender a pessoa -> identificar o objetivo -> so entao
    // decidir tom/tecnica/mensagem. Cenario/tom/tecnica sao diretrizes que a
    // IA pode combinar, adaptar ou descartar, nao um roteiro fixo a seguir.
    const guidelineFramingInstruction = [
      'COMO DECIDIR (nesta ordem): 1) interprete o que realmente aconteceu na conversa e o histórico completo; 2) entenda o momento (fatos temporais acima); 3) entenda a pessoa (contexto humano/emocional acima); 4) identifique qual e o objetivo certo deste follow-up agora — pode ser comercial, pode ser humano, pode ser so uma pergunta leve, pode ser nao insistir; 5) so entao escolha tom, cenario e tecnica coerentes com essa leitura.',
      'Cenario, tom e tecnicas comerciais sao DIRETRIZES, nao roteiro fixo: combine, adapte ou descarte o que nao fizer sentido para esta conversa especifica. Nao force uma tecnica comercial so porque ela existe na lista — muitas vezes a melhor mensagem nao usa nenhuma tecnica nomeada.',
    ].join('\n');

    const situationPresetCatalog = FOLLOW_UP_SITUATION_PRESETS
      .map((preset) => `- ${preset.id} (${preset.label}): ${preset.instruction}`)
      .join('\n');
    const toneCatalog = FOLLOW_UP_TONES
      .map((tone) => `- ${tone}: ${getFollowUpToneInstruction(tone)}`)
      .join('\n');
    const salesTechniqueCatalog = FOLLOW_UP_SALES_TECHNIQUE_OPTIONS
      .map((technique) => `- ${technique.id} (${technique.name}): ${technique.description}`)
      .join('\n');

    // Selecoes manuais do usuario (feitas na UI antes de gerar) sempre
    // vencem no valor final devolvido pro frontend — isso e garantido em
    // codigo mais abaixo, nao so confiado ao prompt. Aqui so avisamos o
    // modelo pra nao tentar escolher algo diferente por conta propria.
    const manualToneFixed = manualContext.tone || !autoSelectContext;
    const manualSituationFixed = manualContext.situationPresetIds || !autoSelectContext;
    const manualTechniquesFixed = manualContext.salesTechniques || !autoSelectContext;

    const manualSelectionNote = [
      manualToneFixed
        ? `- Tom: ja definido pelo usuario como "${requestedTone}". Use exatamente este valor no campo "tone".`
        : null,
      manualSituationFixed
        ? (requestedSituationPresetIds.length > 0
            ? `- Cenario: ja definido pelo usuario: ${requestedSituationPresetIds.join(', ')}. Use exatamente estes ids no campo "situationPresetIds".`
            : '- Cenario: usuario nao selecionou nenhum manualmente; retorne "situationPresetIds" vazio a menos que algo se encaixe claramente.')
        : null,
      manualTechniquesFixed
        ? (requestedSalesTechniqueIds.length > 0
            ? `- Tecnicas comerciais: ja definidas pelo usuario: ${requestedSalesTechniqueIds.join(', ')}. Use exatamente estes ids no campo "salesTechniques", mas ainda com bom senso — se o contexto emocional pedir uma abordagem mais humana, priorize isso na mensagem mesmo assim.`
            : '- Tecnicas comerciais: usuario nao selecionou nenhuma manualmente; retorne "salesTechniques" vazio a menos que alguma se encaixe claramente.')
        : null,
    ].filter(Boolean).join('\n');

    const jsonShape = shouldGenerateVariations
      ? '{"situationSummary":"...","emotionalContext":{"detected":true|false,"guidance":"..."|null},"situationPresetIds":["..."],"tone":"...","salesTechniques":["..."],"nextAction":{"type":"schedule|wait|mark_lost_recommended","reason":"...","priority":"baixa|normal|alta"},"rationale":"...","variations":[{"label":"...","text":"..."}]}'
      : '{"situationSummary":"...","emotionalContext":{"detected":true|false,"guidance":"..."|null},"situationPresetIds":["..."],"tone":"...","salesTechniques":["..."],"nextAction":{"type":"schedule|wait|mark_lost_recommended","reason":"...","priority":"baixa|normal|alta"},"rationale":"...","text":"..."}';

    const responseFormatInstruction = [
      `Retorne SOMENTE um JSON valido, sem markdown, no formato exato: ${jsonShape}`,
      '"situationSummary": 1-2 frases livres sobre o que realmente esta acontecendo nesta conversa agora — sua propria interpretacao, nao uma categoria fixa.',
      '"emotionalContext": preencha conforme a regra de CONTEXTO HUMANO E EMPATIA acima.',
      '"situationPresetIds": 0 a 2 ids do catalogo de cenarios abaixo, so quando fizer sentido claro no historico — nao force.',
      '"tone": um dos valores do catalogo de tons abaixo.',
      '"salesTechniques": 0 a 3 ids do catalogo de tecnicas abaixo — pode ficar vazio, nao force.',
      '"nextAction": decida lendo a conversa inteira, nao por quantidade bruta de mensagens. Varios envios seguidos da mesma proposta/cotacao contam como um unico bloco de contexto, nao varias tentativas. Use "mark_lost_recommended" so com sinais claros de varias tentativas reais em dias diferentes sem resposta util. Use "wait" quando o cliente ja respondeu, existe combinado pendente, o contexto emocional pede pausa, ou ainda nao cabe nova cobranca.',
      '"rationale": resumo curto e legivel (1-3 frases) do seu raciocinio — inclua o que motivou tom/cenario/tecnica e qualquer contexto temporal ou emocional relevante. Isso e mostrado para quem esta usando o sistema.',
      shouldGenerateVariations
        ? `"variations": gere exatamente ${variantCount} variacoes com labels curtos e distintos (ex.: "Direta", "Consultiva", "Leve"); cada "text" segue a regra de divisao em multiplas mensagens.`
        : '"text": o follow-up final pronto para envio, seguindo a regra de divisao em multiplas mensagens.',
    ].join('\n');

    const systemPrompt = refinementMode
      ? [
          configuredPromptBase,
          'A mensagem deve soar NATURAL, como se fosse escrita por um humano — jamais como texto gerado por IA.',
          multiMessageMechanismNote,
          messageSplittingInstruction,
          styleProfileSection,
          defaultConductRules,
          emotionalContextInstruction,
          ownLastMessageAwarenessInstruction,
          'Leia todo o historico antes de responder e respeite a cronologia do transcript. Considere os fatos temporais acima como referencia principal.',
          'Nao invente fatos, promessas, dados, respostas do cliente ou combinados que nao estejam no historico.',
          'Retorne apenas o texto final sugerido, em texto puro (sem JSON), sem aspas, sem explicacoes extras e sem listar alternativas, usando o separador "---" entre mensagens quando dividido.',
        ].filter(Boolean).join('\n\n')
      : [
          configuredPromptBase,
          userCustomInstructionsBlock,
          'A mensagem deve soar NATURAL, como se fosse escrita por um humano — jamais como texto gerado por IA.',
          multiMessageMechanismNote,
          messageSplittingInstruction,
          styleProfileSection,
          defaultConductRules,
          emotionalContextInstruction,
          ownLastMessageAwarenessInstruction,
          guidelineFramingInstruction,
          'Leia todo o historico antes de responder e respeite a cronologia do transcript. Considere os fatos temporais acima como referencia principal.',
          'Nao invente fatos, promessas, dados, respostas do cliente ou combinados que nao estejam no historico.',
          'USE DETALHES ESPECIFICOS do historico na mensagem: retome produtos, valores, objecoes, prazos e combinados reais da conversa, como se fosse o corretor continuando a conversa real de onde parou. A mensagem final deve fazer sentido APENAS para este lead nesta conversa — jamais use frases coringas que caberiam em qualquer chat.',
          responseFormatInstruction,
          `Catalogo de cenarios (use somente os ids exatos):\n${situationPresetCatalog}`,
          `Catalogo de tons (use somente os valores exatos):\n${toneCatalog}`,
          `Catalogo de tecnicas comerciais (use somente os ids exatos):\n${salesTechniqueCatalog}`,
          manualSelectionNote ? `Selecoes ja fixadas pelo usuario para esta geracao:\n${manualSelectionNote}` : '',
        ].filter(Boolean).join('\n\n');

    const baseUserPrompt = [
      baseContextPrompt,
      '',
      !hasCustomInstructions && styleExamples.length > 0
        ? '--- EXEMPLOS REAIS DO SEU ESTILO (copie o padrao, nao o conteudo) ---\n' + styleExamples.map((text, i) => `${i + 1}. ${text}`).join('\n') + '\n'
        : '',
      shouldGenerateVariations
        ? `Interprete a conversa acima e gere ${variantCount} variacoes do proximo follow-up mais adequado para enviar agora neste chat. Cada variacao deve soar humana, comercialmente coerente e pronta para copiar e enviar no WhatsApp.`
        : 'Interprete a conversa acima e gere o proximo follow-up mais adequado para enviar agora neste chat. Deve soar humano, comercialmente coerente e pronto para copiar e enviar no WhatsApp.',
    ].filter(Boolean).join('\n');

    const userPrompt = refinementMode
      ? [
          baseUserPrompt,
          '',
          'Mensagem atual a refinar:',
          currentMessage,
          '',
          'Ajuste solicitado:',
          adjustmentInstruction,
          '',
          'Tarefa:',
          'Reescreva apenas a mensagem atual aplicando o ajuste solicitado e o contexto do chat (incluindo os fatos temporais e o contexto humano acima). Retorne somente a mensagem final em texto puro, sem JSON, sem explicações.',
        ].join('\n')
      : baseUserPrompt;

    const temperature = hasCustomInstructions ? 0.5 : 0.7;
    const maxTokens = refinementMode
      ? 320
      : shouldGenerateVariations
        ? Math.min(1400, 340 * variantCount)
        : 520;

    console.log('[FollowUpAI][edge] final generation prompt', {
      configuredPromptBase,
      temporalFacts,
      manualSelectionNote,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
    });

    const result = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
    });

    let aiContext: AiContextRecommendation | null = null;
    let variations: FollowUpVariation[] = [];
    let responseText: string;

    if (refinementMode) {
      responseText = sanitizeGeneratedText(result.text.trim());
    } else {
      const parsed = parseFollowUpGenerationResult(result.text, shouldGenerateVariations);
      aiContext = parsed.aiContext;

      if (shouldGenerateVariations) {
        variations = parsed.variations;
        responseText = variations[0]?.text ? sanitizeGeneratedText(variations[0].text) : '';
      } else {
        responseText = parsed.text ? sanitizeGeneratedText(parsed.text) : '';
      }

      // Se o modelo nao seguiu o formato JSON pedido (raro, mas providers
      // podem falhar nisso), cai pro texto bruto em vez de retornar vazio.
      if (!responseText) {
        responseText = sanitizeGeneratedText(result.text.trim());
      }
    }

    if (!responseText) {
      throw new Error('A IA nao retornou um follow-up valido.');
    }

    const effectiveSituationPresetIds = manualSituationFixed
      ? requestedSituationPresetIds
      : (aiContext?.situationPresetIds ?? requestedSituationPresetIds);
    const effectiveTone = manualToneFixed
      ? requestedTone
      : (aiContext?.tone ?? requestedTone);
    const effectiveSalesTechniqueIds = manualTechniquesFixed
      ? requestedSalesTechniqueIds
      : (aiContext?.salesTechniques ?? requestedSalesTechniqueIds);

    const nextAction = refinementMode ? null : await buildFollowUpNextAction({
      supabaseAdmin,
      messages,
      lead,
      leadContext,
      effectiveSituationPresetIds,
      aiContext,
      now,
    });

    console.log('[FollowUpAI][edge] final generation response', {
      result,
      aiContext,
      variations,
      responseText,
      nextAction,
    });

    return new Response(
      JSON.stringify({
        success: true,
        text: responseText,
        variations: variations.length > 0 ? variations : undefined,
        aiContext: {
          situationSummary: aiContext?.situationSummary ?? null,
          emotionalContext: aiContext?.emotionalContext ?? null,
          situationPresetIds: effectiveSituationPresetIds,
          tone: effectiveTone,
          salesTechniques: effectiveSalesTechniqueIds,
          rationale: aiContext?.rationale ?? null,
        },
        nextAction,
        provider: result.provider,
        model: result.model,
        fallback_used: result.fallbackUsed,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  } catch (error) {
    console.error('[comm-whatsapp-generate-follow-up] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao gerar follow-up.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
