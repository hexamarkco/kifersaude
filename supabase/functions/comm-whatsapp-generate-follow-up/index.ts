import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { generateTextWithRouting } from '../_shared/ai-router.ts';
import { AI_FEATURES } from '../_shared/ai-feature-registry.ts';
import { loadFeatureConfig } from '../_shared/ai-config-resolver.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  resolveCommWhatsAppCanonicalChatRouteByUuid,
  toTrimmedString,
} from '../_shared/comm-whatsapp.ts';
import {
  buildStyleProfile,
  buildStyleProfileText,
  STYLE_SAMPLE_LIMIT,
} from '../_shared/comm-whatsapp-transcript.ts';
import { COMMERCIAL_THREAD_RULE } from '../_shared/comm-whatsapp-follow-up-commercial-thread.ts';
import type {
  CommercialAnalysis,
  FollowUpStrategy,
  AnalysisAndStrategyResult,
} from '../_shared/comm-whatsapp-follow-up-v3-types.ts';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  COPY_SYSTEM_PROMPT,
  buildCopyUserPrompt,
} from '../_shared/comm-whatsapp-follow-up-v3-prompts.ts';
import {
  validateCommercialMessage,
  formatValidationFeedback,
  type ValidationResult,
} from '../_shared/comm-whatsapp-follow-up-v3-validator.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type GenerateFollowUpBody = {
  chatId?: string;
  customInstructions?: string;
  mode?: string;
  currentMessage?: string;
  adjustmentInstruction?: string;
  variantCount?: number;
  sourceReminderId?: string;
  batchId?: string;
  triggerSource?: 'individual' | 'batch' | 'refine' | 'other';
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

class FollowUpValidationError extends Error {}

const AI_FOLLOW_UP_PROMPT_SLUG = 'ai_follow_up_prompt';
const DEFAULT_SYSTEM_TIMEZONE = 'America/Sao_Paulo';
const MESSAGE_PAGE_SIZE = 1000;
const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Áudio sem transcrição]';
const MAX_FOLLOW_UP_VARIANTS = 5;
const DAILY_FOLLOW_UP_CAPACITY = 15;
const WAIT_COOLDOWN_BUSINESS_DAYS = 7;
const FOLLOW_UP_SCHEDULE_HOURS = [10, 11, 14, 15, 16] as const;
const OUTBOUND_ATTEMPT_GROUP_GAP_MS = 2 * 60 * 60 * 1000;
const RECENT_OUTBOUND_WAIT_MS = 12 * 60 * 60 * 1000;
// Teto de sanidade para qualquer sugestao de data/prazo vinda da IA (combinado
// explicito ou atraso sugerido): o backend nunca aceita algo alem disso,
// mesmo que a IA sugira — evita agendamentos "impossiveis" ou absurdamente
// distantes por erro de interpretacao do modelo.
const MAX_SUGGESTED_DELAY_DAYS = 30;

// ---- Taxonomia comercial enxuta usada pelo modelo para descrever a leitura
// da conversa (analytics futuro: quais combinacoes de estagio/bloqueio/
// objetivo tem melhor taxa de resposta). Nao substitui cenario/tom/tecnica
// antigos — a estrategia agora nasce da leitura real da conversa, nao de um
// preset escolhido manualmente. ----

const FOLLOW_UP_STAGES = [
  'qualificacao',
  'cotacao_apresentada',
  'avaliando_opcoes',
  'objecao',
  'aguardando_decisor',
  'sinal_de_compra',
  'aguardando_acao',
  'proposta_em_andamento',
  'reativacao',
  'pos_venda',
  'outro',
] as const;
type FollowUpStage = (typeof FOLLOW_UP_STAGES)[number];
const isFollowUpStage = (value: string): value is FollowUpStage => (FOLLOW_UP_STAGES as readonly string[]).includes(value);

const FOLLOW_UP_BLOCKERS = [
  'preco',
  'inseguranca',
  'comparacao',
  'terceiro_decisor',
  'sem_urgencia',
  'falta_de_informacao',
  'acao_nao_executada',
  'silencio',
  'contexto_pessoal',
  'nao_identificado',
] as const;
type FollowUpBlocker = (typeof FOLLOW_UP_BLOCKERS)[number];
const isFollowUpBlocker = (value: string): value is FollowUpBlocker => (FOLLOW_UP_BLOCKERS as readonly string[]).includes(value);

const FOLLOW_UP_GOALS = [
  'retomar_conversa',
  'obter_preferencia',
  'reduzir_objecao',
  'descobrir_bloqueio',
  'confirmar_decisao',
  'solicitar_documentos',
  'avancar_proposta',
  'definir_vigencia',
  'envolver_decisor',
  'reativar_oportunidade',
  'encerrar_sem_pressao',
] as const;
type FollowUpGoal = (typeof FOLLOW_UP_GOALS)[number];
const isFollowUpGoal = (value: string): value is FollowUpGoal => (FOLLOW_UP_GOALS as readonly string[]).includes(value);

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
  stage: FollowUpStage | null;
  blocker: FollowUpBlocker | null;
  goal: FollowUpGoal | null;
  emotionalContext: EmotionalContext | null;
  rationale: string | null;
  currentAction: 'send' | 'wait' | null;
  currentActionReason: string | null;
  opportunityRecommendation: 'continue' | 'pause' | 'mark_lost_recommended' | null;
  commercialFunction: CommercialFunction | null;
  nextActionOwner: NextActionOwner | null;
  pendingMicrodecision: string | null;
  lastCommercialCommitment: string | null;
  decisionMaker: string | null;
  scheduleAction: 'schedule' | 'no_schedule' | null;
  scheduleReason: string | null;
  scheduleConfidence: 'high' | 'medium' | 'low' | null;
  // Sugestoes opcionais do modelo para o agendamento — o backend valida e
  // pode descartar qualquer uma delas (ver resolveInitialCandidateDay).
  nextActionSuggestedDelayBusinessDays: number | null;
  nextActionSuggestedDate: string | null; // "YYYY-MM-DD"
};

const COMMERCIAL_FUNCTIONS = ['retomar_contexto', 'obter_microdecisao', 'reduzir_opcoes', 'remover_atrito', 'esclarecer_objecao', 'diagnosticar_bloqueio', 'cobrar_acao_combinada', 'confirmar_decisao', 'facilitar_documentacao', 'retomar_em_data_combinada', 'obter_posicionamento', 'reativar', 'encerrar_elegantemente', 'nenhuma'] as const;
type CommercialFunction = (typeof COMMERCIAL_FUNCTIONS)[number];
type NextActionOwner = 'client' | 'seller' | 'third_party' | 'operator' | 'date' | 'none';
const isCommercialFunction = (value: string): value is CommercialFunction => (COMMERCIAL_FUNCTIONS as readonly string[]).includes(value);
const isNextActionOwner = (value: string): value is NextActionOwner => ['client', 'seller', 'third_party', 'operator', 'date', 'none'].includes(value);

const normalizeNextActionType = (value: unknown): FollowUpNextActionType | null => {
  const candidate = toTrimmedString(value);
  return candidate === 'schedule' || candidate === 'wait' || candidate === 'mark_lost_recommended' ? candidate : null;
};

const normalizeNextActionPriority = (value: unknown): FollowUpNextAction['priority'] | null => {
  const candidate = toTrimmedString(value);
  return candidate === 'baixa' || candidate === 'normal' || candidate === 'alta' ? candidate : null;
};

const normalizeSuggestedDelayBusinessDays = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(toTrimmedString(value));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > MAX_SUGGESTED_DELAY_DAYS) {
    return null;
  }

  return rounded;
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
  const stageCandidate = toTrimmedString(parsed.stage);
  const blockerCandidate = toTrimmedString(parsed.blocker);
  const goalCandidate = toTrimmedString(parsed.goal);
  const scheduleRecommendation = isRecord(parsed.scheduleRecommendation) ? parsed.scheduleRecommendation : null;
  const currentAction = toTrimmedString(parsed.currentAction);
  const opportunityRecommendation = toTrimmedString(parsed.opportunityRecommendation);
  // Compatibilidade para respostas geradas antes do deploy completo da V2.
  const legacyNextAction = isRecord(parsed.nextAction) ? parsed.nextAction : null;

  return {
    // Se o modelo mandar algo fora da lista, cai num "outro"/"nao_identificado"
    // em vez de descartar silenciosamente — mantem o dado util para analytics
    // mesmo quando a IA erra a taxonomia exata.
    stage: isFollowUpStage(stageCandidate) ? stageCandidate : (stageCandidate ? 'outro' : null),
    blocker: isFollowUpBlocker(blockerCandidate) ? blockerCandidate : (blockerCandidate ? 'nao_identificado' : null),
    goal: isFollowUpGoal(goalCandidate) ? goalCandidate : null,
    emotionalContext: parseEmotionalContext(parsed.emotionalContext),
    rationale: toTrimmedString(parsed.rationale) || null,
    currentAction: currentAction === 'send' || currentAction === 'wait'
      ? currentAction
      : (normalizeNextActionType(legacyNextAction?.type) === 'wait' ? 'wait' : 'send'),
    currentActionReason: toTrimmedString(parsed.currentActionReason) || toTrimmedString(legacyNextAction?.reason) || null,
    opportunityRecommendation: opportunityRecommendation === 'continue' || opportunityRecommendation === 'pause' || opportunityRecommendation === 'mark_lost_recommended'
      ? opportunityRecommendation
      : (normalizeNextActionType(legacyNextAction?.type) === 'mark_lost_recommended' ? 'mark_lost_recommended' : 'continue'),
    commercialFunction: isCommercialFunction(toTrimmedString(parsed.commercialFunction)) ? toTrimmedString(parsed.commercialFunction) as CommercialFunction : null,
    nextActionOwner: isNextActionOwner(toTrimmedString(parsed.nextActionOwner)) ? toTrimmedString(parsed.nextActionOwner) as NextActionOwner : null,
    pendingMicrodecision: toTrimmedString(parsed.pendingMicrodecision) || null,
    lastCommercialCommitment: toTrimmedString(parsed.lastCommercialCommitment) || null,
    decisionMaker: toTrimmedString(parsed.decisionMaker) || null,
    scheduleAction: toTrimmedString(scheduleRecommendation?.action) === 'schedule' || toTrimmedString(scheduleRecommendation?.action) === 'no_schedule'
      ? toTrimmedString(scheduleRecommendation?.action) as 'schedule' | 'no_schedule'
      : (normalizeNextActionType(legacyNextAction?.type) === 'mark_lost_recommended' ? 'no_schedule' : 'schedule'),
    scheduleReason: toTrimmedString(scheduleRecommendation?.reason) || toTrimmedString(legacyNextAction?.reason) || null,
    scheduleConfidence: ['high', 'medium', 'low'].includes(toTrimmedString(scheduleRecommendation?.confidence))
      ? toTrimmedString(scheduleRecommendation?.confidence) as 'high' | 'medium' | 'low'
      : null,
    nextActionSuggestedDelayBusinessDays: normalizeSuggestedDelayBusinessDays(scheduleRecommendation?.suggestedDelayBusinessDays ?? legacyNextAction?.suggestedDelayBusinessDays),
    nextActionSuggestedDate: toTrimmedString(scheduleRecommendation?.suggestedDate ?? legacyNextAction?.suggestedDate) || null,
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

// Se o JSON.parse direto falhar (texto extra antes/depois do objeto), tenta
// recuperar so o trecho entre a primeira "{" e a ultima "}" antes de desistir.
const tryExtractJsonObject = (raw: string): string | null => {
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return raw.slice(firstBrace, lastBrace + 1);
};

// Parser unico: a mesma chamada de IA que interpreta a conversa (estagio,
// bloqueio, objetivo, contexto emocional, proxima acao) tambem escreve a
// mensagem final, entao os dois vem juntos no mesmo JSON.
const parseFollowUpGenerationResult = (value: string, shouldGenerateVariations: boolean): FollowUpGenerationResult => {
  const candidate = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

  const attemptParse = (text: string): Record<string, unknown> | null => {
    try {
      const result = JSON.parse(text) as unknown;
      return isRecord(result) ? result : null;
    } catch {
      return null;
    }
  };

  const parsed = attemptParse(candidate) ?? (() => {
    const extracted = tryExtractJsonObject(candidate);
    return extracted ? attemptParse(extracted) : null;
  })();

  if (!parsed) {
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
};

const isValidFollowUpGenerationResult = (result: FollowUpGenerationResult, shouldGenerateVariations: boolean): boolean => (
  shouldGenerateVariations
    ? result.variations.length > 0 && result.variations.every((variation) => Boolean(variation.text))
    : result.aiContext?.currentAction === 'wait' || Boolean(result.text)
);

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

// Se a data cair num fim de semana (combinado explicito da IA cai num
// sabado/domingo, por exemplo), empurra pro proximo dia util antes de entrar
// na busca por capacidade — mantendo a mesma regra de dias uteis do resto do
// sistema.
const rollToNextBusinessDay = (date: Date): Date => {
  const { year, month, day } = getSaoPauloDateParts(date);
  const base = new Date(Date.UTC(year, month - 1, day));
  const weekday = base.getUTCDay();
  if (weekday === 6) base.setUTCDate(base.getUTCDate() + 2);
  else if (weekday === 0) base.setUTCDate(base.getUTCDate() + 1);
  return base;
};

// Valida um "YYYY-MM-DD" sugerido pela IA como combinado explicito: precisa
// ser uma data real, nao pode estar no passado e nao pode estar absurdamente
// longe no futuro (provavel erro de interpretacao). O backend e a autoridade
// final — a IA so recomenda.
const parseAiSuggestedDate = (value: string | null, now: Date): Date | null => {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidateUtc = Date.UTC(year, month - 1, day);
  const candidate = new Date(candidateUtc);
  if (Number.isNaN(candidate.getTime()) || candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return null;
  }

  const nowParts = getSaoPauloDateParts(now);
  const nowUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);

  if (candidateUtc < nowUtc) {
    return null;
  }

  const maxUtc = nowUtc + MAX_SUGGESTED_DELAY_DAYS * 24 * 60 * 60 * 1000;
  if (candidateUtc > maxUtc) {
    return null;
  }

  return candidate;
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

const hasRecentOutboundWithoutInbound = (messages: MessageRow[], now: Date): boolean => {
  const useful = messages.filter((message) => Boolean(buildTranscriptContent(message)));
  const lastOutbound = [...useful].reverse().find((message) => message.direction === 'outbound');
  if (!lastOutbound) return false;
  const outboundAt = Date.parse(lastOutbound.message_at);
  if (Number.isNaN(outboundAt) || now.getTime() - outboundAt >= RECENT_OUTBOUND_WAIT_MS) return false;
  return !useful.some((message) => message.direction === 'inbound' && Date.parse(message.message_at) > outboundAt);
};

const normalizeGreetingForTemporalFacts = (text: string, facts: TemporalFacts): string => {
  if (!text) return text;
  const lines = text.split('\n');
  const greetingPattern = /\b(bom dia|boa tarde|boa noite)\b/iu;
  if (facts.contactedToday) {
    return lines.filter((line) => !greetingPattern.test(line)).join('\n').replace(/^\s*---\s*$/m, '').trim();
  }
  const expected = facts.periodOfDay === 'manha' ? 'Bom dia' : facts.periodOfDay === 'tarde' ? 'Boa tarde' : 'Boa noite';
  return lines.map((line) => line.replace(greetingPattern, expected)).join('\n');
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
  'ESTA REGRA E SOBRE O NUMERO DE TENTATIVAS: quanto maior o numero de tentativas consecutivas acima, maior a tendencia de sair de "lembrar a acao pendente" para "investigar o bloqueio real" e depois "pedir posicionamento sobre continuidade ou recomendar pausar a oportunidade" — mas isto nao e uma regra cega por contagem: o conteudo real da conversa sempre pesa mais que o numero.',
].join('\n');

// Primeiro candidato de dia para o agendamento: se a IA identificou um
// combinado explicito de data no historico (validado e nao-passado), usa
// isso; senao usa o atraso em dias uteis sugerido pela IA (se plausivel);
// senao cai no valor padrao do sistema para este tipo de acao/tentativa.
const resolveInitialCandidateDay = (params: {
  now: Date;
  aiContext: AiContextRecommendation | null;
  fallbackBusinessDays: number;
}): { day: Date; source: 'ai_date' | 'ai_delay' | 'default'; businessDaysUsed: number } => {
  const aiDate = parseAiSuggestedDate(params.aiContext?.nextActionSuggestedDate ?? null, params.now);
  if (aiDate) {
    return { day: rollToNextBusinessDay(aiDate), source: 'ai_date', businessDaysUsed: params.fallbackBusinessDays };
  }

  const aiDelay = params.aiContext?.nextActionSuggestedDelayBusinessDays ?? null;
  if (aiDelay !== null) {
    return { day: addBusinessDays(params.now, aiDelay), source: 'ai_delay', businessDaysUsed: aiDelay };
  }

  return { day: addBusinessDays(params.now, params.fallbackBusinessDays), source: 'default', businessDaysUsed: params.fallbackBusinessDays };
};

const computeAvailableFollowUpDate = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  initialCandidateDay: Date,
) => {
  let candidateDay = initialCandidateDay;
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
  aiContext: AiContextRecommendation | null;
  now: Date;
}): Promise<FollowUpNextAction> => {
  const consecutiveOutboundAttempts = countConsecutiveOutboundAttempts(params.messages);
  const attemptNumber = Math.min(Math.max(consecutiveOutboundAttempts, 1), 5);
  const maxAttempts = 4;
  const leadStatus = toTrimmedString(params.lead?.status).toLowerCase();
  const aiNextActionType: FollowUpNextActionType | null = params.aiContext?.opportunityRecommendation === 'mark_lost_recommended'
    ? 'mark_lost_recommended'
    : params.aiContext?.currentAction === 'wait'
      ? 'wait'
      : 'schedule';
  const aiNextActionReason = params.aiContext?.scheduleReason ?? params.aiContext?.currentActionReason ?? null;
  const aiNextActionPriority: FollowUpNextAction['priority'] | null = null;

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
    const initialCandidate = resolveInitialCandidateDay({
      now: params.now,
      aiContext: params.aiContext,
      fallbackBusinessDays: WAIT_COOLDOWN_BUSINESS_DAYS,
    });
    const { suggestedDate: waitDate, dayLoad: waitDayLoad } = await computeAvailableFollowUpDate(
      params.supabaseAdmin,
      initialCandidate.day,
    );

    return {
      type: 'wait',
      suggestedDateTime: waitDate.toISOString(),
      priority: aiNextActionPriority ?? 'baixa',
      title: `Retomar contato: ${params.leadContext.nome}`,
      reason: aiNextActionReason || (
        initialCandidate.source === 'ai_date'
          ? 'Combinado explícito identificado na conversa — mantivemos a data indicada pelo cliente para retomar contato.'
          : 'O contexto da conversa indica que ainda não é o momento de uma nova cobrança; agendamos um retorno mais distante para reavaliar.'
      ),
      attemptNumber,
      maxAttempts,
      dayLoad: waitDayLoad,
      dailyCapacity: DAILY_FOLLOW_UP_CAPACITY,
      giveUpRecommendation: 'Acompanhe o contexto antes de criar uma nova cobrança ou marcar o lead como perdido.',
    };
  }

  if (aiNextActionType === 'mark_lost_recommended') {
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

  const defaultBusinessDays = getBusinessDayOffsetForAttempt(attemptNumber);
  const initialCandidate = resolveInitialCandidateDay({
    now: params.now,
    aiContext: params.aiContext,
    fallbackBusinessDays: defaultBusinessDays,
  });
  const { suggestedDate, dayLoad } = await computeAvailableFollowUpDate(params.supabaseAdmin, initialCandidate.day);
  const isLastAttempt = attemptNumber >= maxAttempts;
  // "Aguardando documentos" nao existe mais como preset — o sinal equivalente
  // agora e a IA ter identificado esse como o objetivo comercial da mensagem.
  const isDocumentRequestGoal = params.aiContext?.goal === 'solicitar_documentos';

  const dayWasFull = dayLoad !== null && dayLoad >= DAILY_FOLLOW_UP_CAPACITY;
  const defaultReason = initialCandidate.source === 'ai_date'
    ? (dayWasFull
      ? 'Havia um combinado de data com o cliente, mas o dia estava cheio — sugerimos o próximo dia útil disponível a partir dele.'
      : 'Combinado explícito identificado na conversa — mantivemos a data indicada pelo cliente.')
    : (dayWasFull
      ? `A data inicial estava cheia. Sugeri o próximo dia útil com menos de ${DAILY_FOLLOW_UP_CAPACITY} lembretes pendentes.`
      : `Cadência sugerida para a tentativa ${attemptNumber}: +${initialCandidate.businessDaysUsed} dia(s) útil(eis), evitando concentrar mais de ${DAILY_FOLLOW_UP_CAPACITY} follow-ups no mesmo dia.`);

  return {
    type: 'schedule',
    suggestedDateTime: suggestedDate.toISOString(),
    priority: aiNextActionPriority ?? (isDocumentRequestGoal || isLastAttempt ? 'alta' : 'normal'),
    title: `${isLastAttempt ? 'Última tentativa' : 'Follow-up'}: ${params.leadContext.nome}`,
    reason: aiNextActionReason || defaultReason,
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

type FollowUpAuditContextRow = Record<string, unknown>;
type FollowUpReminderContextRow = Record<string, unknown>;

// A Edge Function pode ser implantada antes da migration correspondente. Para
// esse intervalo de rollout, nao podemos deixar uma coluna V2 ausente derrubar
// toda a geracao. Reexecutamos a leitura com o contrato legado; apos a
// migration, a primeira consulta volta a fornecer a contextualizacao completa.
const loadRecentFollowUpAudits = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  chatId: string,
): Promise<FollowUpAuditContextRow[]> => {
  const v2Result = await supabaseAdmin
    .from('comm_follow_up_audit_log')
    .select('id, sent_at, sent_at_actual, current_action, commercial_function, goal, generated_text, sent_text, text_content')
    .eq('chat_id', chatId)
    .order('sent_at', { ascending: false })
    .limit(8);

  if (!v2Result.error) {
    return (v2Result.data ?? []) as FollowUpAuditContextRow[];
  }

  console.warn('[FollowUpAI][edge] contexto V2 de auditoria indisponivel; usando contrato legado', {
    message: v2Result.error.message,
  });
  const legacyResult = await supabaseAdmin
    .from('comm_follow_up_audit_log')
    .select('id, sent_at, text_content')
    .eq('chat_id', chatId)
    .order('sent_at', { ascending: false })
    .limit(8);

  if (legacyResult.error) {
    throw new Error(`Erro ao carregar historico de follow-ups: ${legacyResult.error.message}`);
  }

  return (legacyResult.data ?? []) as FollowUpAuditContextRow[];
};

const loadFollowUpReminders = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  leadId: string | null,
): Promise<FollowUpReminderContextRow[]> => {
  if (!leadId) return [];

  const v2Result = await supabaseAdmin
    .from('reminders')
    .select('id, titulo, descricao, data_lembrete, lido, follow_up_origin')
    .eq('lead_id', leadId)
    .order('data_lembrete', { ascending: false })
    .limit(8);

  if (!v2Result.error) {
    return (v2Result.data ?? []) as FollowUpReminderContextRow[];
  }

  console.warn('[FollowUpAI][edge] contexto V2 de lembretes indisponivel; usando contrato legado', {
    message: v2Result.error.message,
  });
  const legacyResult = await supabaseAdmin
    .from('reminders')
    .select('id, titulo, descricao, data_lembrete, lido')
    .eq('lead_id', leadId)
    .order('data_lembrete', { ascending: false })
    .limit(8);

  if (legacyResult.error) {
    throw new Error(`Erro ao carregar lembretes: ${legacyResult.error.message}`);
  }

  return (legacyResult.data ?? []) as FollowUpReminderContextRow[];
};

const getLastUnansweredCommercialFunction = (
  audits: FollowUpAuditContextRow[],
  messages: MessageRow[],
): CommercialFunction | null => {
  for (const audit of audits) {
    const commercialFunction = toTrimmedString(audit.commercial_function);
    const sentAt = toTrimmedString(audit.sent_at_actual) || toTrimmedString(audit.sent_at);
    const sentAtMs = Date.parse(sentAt);
    if (!isCommercialFunction(commercialFunction) || commercialFunction === 'nenhuma' || Number.isNaN(sentAtMs)) {
      continue;
    }

    const hasInboundAfter = messages.some((message) => (
      message.direction === 'inbound' && Date.parse(message.message_at) > sentAtMs
    ));
    if (!hasInboundAfter) return commercialFunction;
  }

  return null;
};

// ---- Blocos de prompt: regras nucleares (sempre ativas, nunca substituiveis
// pelo prompt customizado da operacao) ----

const CORE_STRATEGY_RULES = [
  'Voce e responsavel por decidir e escrever o proximo follow-up de vendas mais eficaz para fazer esta oportunidade comercial avancar pelo WhatsApp.',
  'Antes de escrever qualquer mensagem, raciocine internamente (nao precisa mostrar esse raciocinio, so aplica-lo) respondendo: 1) qual e o ultimo fio comercial ainda nao resolvido? 2) em que estagio da venda este lead esta? 3) o que ele realmente quer? 4) o que ja sabemos sobre ele e a negociacao? 5) o que ainda precisamos descobrir? 6) qual e o principal bloqueio atual? 7) existem sinais de compra? 8) qual foi a ultima microdecisao solicitada a ele? 9) ele executou essa acao? 10) ja houve follow-up tentando provocar exatamente a mesma acao, sem resposta? 11) qual e a proxima microdecisao mais adequada agora? 12) qual funcao comercial esta nova mensagem precisa cumprir?',
  'PRINCIPIO CENTRAL: toda mensagem de follow-up precisa ter uma funcao comercial clara. Nunca gere uma mensagem apenas para "manter contato" ou por habito de cadencia.',
  'A pergunta que guia a mensagem e sempre: qual e o melhor proximo movimento para aumentar a chance desta venda avancar?',
].join('\n');

const NO_REPEAT_STRATEGY_RULE = [
  'REGRA CRITICA — NAO REPETIR A MESMA ESTRATEGIA: releia com atencao suas proprias mensagens anteriores ("Eu") no historico. Nunca repita a mesma funcao comercial de um follow-up anterior que ficou sem resposta, mesmo trocando as palavras — reformular "Conseguiu separar os documentos?" como "Voce conseguiu organizar a documentacao?" e a MESMA estrategia e e proibido.',
  'Quando uma abordagem ja foi tentada sem resposta, mude o angulo. Uma progressao natural (nao uma sequencia rigida — o conteudo real da conversa manda mais que a contagem) tende a ser: 1a tentativa = pedir a acao pendente; 2a tentativa sem resposta = facilitar a microdecisao ou mudar o angulo; tentativa seguinte = investigar o verdadeiro bloqueio; tentativa posterior = pedir posicionamento sobre continuidade ou recomendar pausar a oportunidade.',
].join('\n');

const STAGE_AWARENESS_RULE = [
  'RECONHECA O ESTAGIO DA VENDA: nao trate a conversa como se estivesse sempre no inicio.',
  'Se o cliente ja escolheu o plano, nao continue "vendendo" beneficios como se ele ainda estivesse comparando opcoes.',
  'Se ele perguntou sobre documentacao, boleto, vigencia, inicio ou proximo passo, isso e sinal de compra — trate como tal.',
  'Se ele disse algo como "vamos fazer", "pode ser esse", "qual o proximo passo?", trate como fechamento e conduza a execucao, nao a persuasao.',
  'Se o cliente ja decidiu e o que falta sao documentos, o problema nao e convence-lo de novo sobre rede/preco.',
  'Se documentos foram pedidos repetidamente e ele nao envia, considere que o bloqueio real pode nao ser a documentacao em si — investigue se algo mudou, surgiu inseguranca, um terceiro decisor entrou, ele esta comparando ou desistiu.',
].join('\n');

const NOT_A_COLLECTION_CALL_RULE = [
  'FOLLOW-UP NAO E COBRANCA: evite depender repetidamente de frases genericas como "Conseguiu analisar?", "Viu minha mensagem?", "Ficou com alguma duvida?", "Conseguiu separar os documentos?", "Gostaria de prosseguir?", "Estou a disposicao." ou "Quando puder me avisa." Elas podem aparecer quando forem realmente a coisa certa a dizer, mas nunca como estrategia padrao.',
  'Antes de escrever, considere: quanto tempo passou, o estagio anterior, a ultima mensagem do cliente, a sua propria ultima mensagem, quantas tentativas ja foram feitas sem resposta, o possivel motivo do silencio, sinais de interesse ou de resistencia, a acao que ja foi pedida, e se a estrategia anterior falhou.',
].join('\n');

const MICRODECISION_RULE = [
  'BUSQUE UMA MICRODECISAO CONCRETA sempre que possivel: escolher entre duas opcoes, confirmar qual plano agradou mais, definir enfermaria ou apartamento, escolher vigencia, confirmar beneficiarios, validar se ainda existe interesse, descobrir o que esta impedindo a contratacao, enviar documentos, iniciar a proposta, ou confirmar quem participa da decisao.',
  'Quanto mais proximo do fechamento estiver o lead, mais especifico deve ser o proximo passo proposto.',
].join('\n');

const OBJECTION_READING_RULE = [
  'OBJECOES E "ENROLACAO": nao trate toda resposta evasiva como uma objecao final e definitiva. Frases como "Vou pensar.", "Vou falar com meu marido.", "Depois vejo.", "Estou comparando.", "Agora nao.", "Vou te chamar." ou "Deixa eu analisar." podem esconder preco, falta de percepcao de valor, inseguranca, desconfianca, um terceiro decisor, comparacao com concorrente, ausencia de urgencia real, uma duvida nao verbalizada, ou apenas uma forma educada de encerrar a conversa.',
  'O follow-up deve tentar reduzir ou descobrir esse bloqueio real — nunca apenas perguntar de novo, com outras palavras, se a pessoa ja analisou.',
].join('\n');

const NO_INVENTED_URGENCY_RULE = 'NUNCA INVENTAR URGENCIA: nao crie ou insinue prazo, reajuste, promocao, desconto, escassez, disponibilidade limitada, regra de operadora ou qualquer condicao comercial que nao esteja explicitamente no historico da conversa, nos fatos temporais fornecidos, nas instrucoes extras do operador, ou em outra informacao confiavel ja carregada pelo sistema. Se nao houver urgencia real registrada, nao fabrique uma.';

const STYLE_RULE = [
  'ESTILO: escreva como uma excelente corretora humana conversando no WhatsApp — acolhedora, consultiva, tecnicamente segura, natural, persuasiva sem manipulacao, relativamente curta, facil de responder, contextualizada e sem cara de template.',
  'Evite: linguagem robotica, frases de coach, excesso de emojis, formalidade excessiva, falsa intimidade, pressao artificial, textos enormes e cliches comerciais.',
  'NUNCA use abreviacoes como "pra" ou "pro" — use sempre "para", "para o", "para a", etc.',
].join('\n');

const DEFAULT_CONDUCT_RULES = [
  'REGRAS DE CONDUTA:',
  '- Cada mensagem individual deve ser curta e direta: 1 a 2 frases curtas no maximo. NUNCA escreva paragrafos longos.',
  '- SEMPRE use "---" para quebrar em 2-3 mensagens quando tiver mais de uma frase. A unica excecao e uma unica frase curta.',
  '- NUNCA use listas, bullets ou numeracao. Markdown so e permitido na forma do separador "---" descrito acima.',
  '- Dentro de cada mensagem, uma unica pergunta ou proximo passo por vez — nao empilhe varias perguntas na mesma mensagem.',
  '- Use o nome do lead se fizer sentido. Nao force.',
].join('\n');

const EMOTIONAL_CONTEXT_INSTRUCTION = [
  'CONTEXTO HUMANO E EMPATIA (sempre ativo — nao e uma preferencia de estilo, e uma regra de bom senso, e nunca e substituivel pelo prompt customizado da operacao):',
  'Antes de decidir a abordagem, procure no historico sinais de que a conversa deixou de ser puramente comercial: doenca, luto, dificuldade pessoal, ansiedade ou frustracao, desabafo, problema profissional, ou qualquer acontecimento pessoal importante que o cliente tenha compartilhado — mesmo que tenha sido ha alguns dias.',
  'Se detectar algo assim, decida com bom senso qual a melhor resposta: pode ser uma mensagem puramente humana (perguntar como a pessoa esta, sem qualquer vies comercial), pode fazer sentido reconhecer brevemente o que foi dito antes de qualquer coisa comercial (so avance pro comercial se houver abertura natural depois), ou pode ser melhor simplesmente nao pressionar agora. A decisao e sua, nao existe um roteiro fixo pra isso.',
  'Contexto emocional detectado tem prioridade sobre qualquer objetivo comercial planejado para esta mensagem. Nunca ignore um assunto pessoal sensivel para voltar direto ao comercial como se nada tivesse sido dito.',
].join('\n');

const OWN_LAST_MESSAGE_AWARENESS_INSTRUCTION = [
  'ATENCAO A SUA PROPRIA ULTIMA MENSAGEM (sempre ativo): releia com atencao a(s) sua(s) ultima(s) mensagem(ns) marcadas como "Eu" no historico, principalmente se o cliente ainda nao respondeu depois delas.',
  'NUNCA reformule ou repita, como se fosse novidade, algo que voce mesmo ja disse na ultima mensagem (a mesma sugestao, o mesmo pedido, o mesmo prazo ou referencia de dia). Se voce ja pediu para o cliente ver algo ate um dia especifico (ex.: "ve isso no fim de semana") e esse dia ja passou segundo os FATOS TEMPORAIS, NAO repita essa instrucao como se ainda fosse futura — em vez disso, pergunte se ele conseguiu ver, sem soar repetitivo.',
  'O follow-up precisa ser uma CONTINUACAO real da conversa, acrescentando algo novo (uma checagem, uma pergunta de acompanhamento, uma informacao adicional) — nunca apenas parafrasear o que voce mesmo ja escreveu.',
].join('\n');

const MULTI_MESSAGE_MECHANISM_NOTE = 'MECANISMO DO SISTEMA: uma linha contendo APENAS "---" (nada mais nela, nem antes nem depois na mesma linha) e reconhecida como separador entre mensagens distintas do WhatsApp — cada trecho entre separadores vira uma mensagem enviada em sequencia. Isso e diferente dos cabecalhos como "--- CONTEXTO ---" usados neste prompt como organizacao visual: so conta como separador real quando a linha tiver somente os tres tracos, sem texto colado.';

const MESSAGE_SPLITTING_INSTRUCTION = 'DIVISAO EM MENSAGENS (REGRAS OBRIGATORIAS): SEMPRE quebre o follow-up em 2 a 3 mensagens curtas usando o separador "---" (linha com APENAS 3 traços, sem nada antes ou depois). Cada mensagem: 1 a 2 frases curtas no maximo. NUNCA escreva blocos longos. Formato: primeira mensagem cumprimenta ou retoma contexto; segunda desenvolve; terceira faz pergunta ou pede acao. A UNICA excecao para NAO usar "---" e quando o conteudo for EXATAMENTE uma unica frase curta (tipo "Oi, tudo bem?"). Se tiver mais de 2 frases, OBRIGATORIAMENTE use "---" para quebrar. Como uma pessoa real digitando mensagens separadas no WhatsApp em vez de um unico textao. Exemplo de formato dividido (nao copie o conteudo, so o formato):\nOi Fernanda, tudo bem?\n---\nVi que ficou de dar uma olhada na proposta.\n---\nAinda faz sentido pra voce?';

const GUIDELINE_FRAMING_INSTRUCTION = 'COMO DECIDIR (nesta ordem): 1) interprete o que realmente aconteceu na conversa e o historico completo; 2) reconstrua o ultimo fio comercial ainda nao resolvido, sem confundi-lo com a ultima mensagem cronologica; 3) entenda o momento (fatos temporais acima); 4) entenda a pessoa (contexto humano/emocional acima); 5) identifique o estagio, o bloqueio e a ultima microdecisao pedida; 6) defina qual funcao comercial esta mensagem precisa cumprir agora; 7) so entao escreva a mensagem mais adequada para cumprir essa funcao.';

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
    const refinementMode = toTrimmedString(body.mode) === 'refine';
    const currentMessage = toTrimmedString(body.currentMessage);
    const adjustmentInstruction = toTrimmedString(body.adjustmentInstruction);
    const variantCount = refinementMode ? 1 : clampVariantCount(body.variantCount);
    const shouldGenerateVariations = !refinementMode && variantCount > 1;

    // Não logar `body`, `customInstructions`, `currentMessage` nem `adjustmentInstruction`:
    // contêm o texto real da conversa com o lead/paciente (dado sensível), que não deve
    // ir para logs de produção da Edge Function.
    console.log('[FollowUpAI][edge] request received', {
      chatId,
      refinementMode,
      hasCustomInstructions: Boolean(customInstructions),
      hasCurrentMessage: Boolean(currentMessage),
      hasAdjustmentInstruction: Boolean(adjustmentInstruction),
      variantCount,
      shouldGenerateVariations,
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

    const [messages, lead, systemSettingsResult, promptResult, recentAudits, reminders] = await Promise.all([
      loadAllMessagesForChat(supabaseAdmin, chat.id),
      loadLeadContext(supabaseAdmin, chat.lead_id),
      supabaseAdmin.from('system_settings').select('company_name, timezone').limit(1).maybeSingle(),
      supabaseAdmin.from('integration_settings').select('settings').eq('slug', AI_FOLLOW_UP_PROMPT_SLUG).maybeSingle(),
      loadRecentFollowUpAudits(supabaseAdmin, chat.id),
      loadFollowUpReminders(supabaseAdmin, chat.lead_id),
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
    const hasCustomInstructions = Boolean(configuredInstructions);

    const now = new Date();
    const temporalFacts = buildTemporalFacts(messages, now, systemTimeZone);
    const temporalFactsText = formatTemporalFactsForPrompt(temporalFacts);
    const recentFollowUpsText = recentAudits.length === 0 ? 'Nenhum follow-up auditado anteriormente.' : recentAudits.map((audit) => {
      const sentAt = toTrimmedString(audit.sent_at_actual) || toTrimmedString(audit.sent_at);
      const hasReply = messages.some((message) => message.direction === 'inbound' && Date.parse(message.message_at) > Date.parse(sentAt));
      return `- ${sentAt ? formatDateForPrompt(new Date(sentAt), systemTimeZone) : 'data indisponivel'}: commercialFunction=${toTrimmedString(audit.commercial_function) || 'nao registrada'} | goal=${toTrimmedString(audit.goal) || 'nao registrado'} | cliente respondeu depois? ${hasReply ? 'sim' : 'nao'}.`;
    }).join('\n');
    const reminderContextText = reminders.map((reminder) => `- ${reminder.lido === true ? 'concluido' : 'aberto'} | ${toTrimmedString(reminder.data_lembrete)} | ${toTrimmedString(reminder.titulo)}${toTrimmedString(reminder.descricao) ? ` | ${toTrimmedString(reminder.descricao)}` : ''}`).join('\n') || 'Nenhum lembrete relevante.';

    // ---- Shared context block (used by both V3 and refinement) ----
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
      'FOLLOW-UPS RECENTES (evidencia auxiliar; transcript prevalece):',
      recentFollowUpsText,
      '',
      'LEMBRETES RELACIONADOS (evidencia auxiliar; transcript prevalece):',
      reminderContextText,
      '',
      'Historico completo da conversa:',
      transcriptLines.join('\n'),
    ].join('\n');

    // =====================================================================
    // REFINEMENT MODE: keep the existing single-call path for editing
    // =====================================================================
    if (refinementMode) {
      const refineConfig = await loadFeatureConfig(supabaseAdmin, AI_FEATURES.FOLLOWUP_REFINE).catch(() => null);

      const baseIdentityBlock = [
        `Voce gera follow-ups de WhatsApp para a operacao ${companyName}.`,
        'Cada mensagem deve ser contextualizada no historico real do chat.',
        'A mensagem precisa soar como uma continuacao natural do ultimo contato.',
      ].join('\n');

      const operationCustomPromptBlock = configuredInstructions
        ? ['PERSONALIZACAO DA OPERACAO:', configuredInstructions].join('\n')
        : '';

      const refinementSystemPrompt = [
        refineConfig?.featurePrompt || baseIdentityBlock,
        operationCustomPromptBlock,
        'A mensagem deve soar NATURAL, como se fosse escrita por um humano — jamais como texto gerado por IA.',
        MULTI_MESSAGE_MECHANISM_NOTE,
        MESSAGE_SPLITTING_INSTRUCTION,
        STYLE_RULE,
        DEFAULT_CONDUCT_RULES,
        ['REGRAS DE ESTILO (aprendidas do historico real):', styleProfileText].join('\n'),
        COMMERCIAL_THREAD_RULE,
        NO_REPEAT_STRATEGY_RULE,
        NOT_A_COLLECTION_CALL_RULE,
        OBJECTION_READING_RULE,
        NO_INVENTED_URGENCY_RULE,
        EMOTIONAL_CONTEXT_INSTRUCTION,
        OWN_LAST_MESSAGE_AWARENESS_INSTRUCTION,
        'Leia todo o historico antes de responder e respeite a cronologia do transcript.',
        'Nao invente fatos, promessas, dados, respostas do cliente ou combinados que nao estejam no historico.',
        refineConfig?.outputInstructions || 'Retorne apenas o texto final sugerido, em texto puro (sem JSON), sem aspas, sem explicacoes extras e sem listar alternativas, usando o separador "---" entre mensagens quando dividido.',
      ].filter(Boolean).join('\n\n');

      const refinementUserPrompt = [
        baseContextPrompt,
        '',
        'Mensagem atual a refinar:',
        currentMessage,
        '',
        'Ajuste solicitado:',
        adjustmentInstruction,
        '',
        'Tarefa: Reescreva apenas a mensagem atual aplicando o ajuste solicitado e o contexto do chat. Retorne somente a mensagem final em texto puro.',
      ].filter(Boolean).join('\n');

      const result = await generateTextWithRouting({
        supabaseAdmin,
        task: 'follow_up_generation',
        systemPrompt: refinementSystemPrompt,
        userPrompt: refinementUserPrompt,
        temperature: hasCustomInstructions ? 0.5 : (refineConfig?.temperature || 0.7),
        maxTokens: refineConfig?.maxOutputTokens || 320,
      });

      const responseText = normalizeGreetingForTemporalFacts(
        sanitizeGeneratedText(result.text.trim()),
        temporalFacts,
      );

      return new Response(
        JSON.stringify({
          success: true,
          text: responseText,
          provider: result.provider,
          model: result.model,
          fallback_used: result.fallbackUsed,
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // =====================================================================
    // V3: CALL 1 — Commercial Analysis + Strategy
    // =====================================================================
    const analysisUserPrompt = buildAnalysisUserPrompt({
      transcript: transcriptLines.join('\n'),
      temporalFacts: temporalFactsText,
      leadContext: baseContextPrompt,
      previousState: null,
      recentAudits: recentFollowUpsText,
    });

    console.log('[FollowUpAI][v3] CALL 1 — analysis', { task: 'follow_up_analysis' });

    const analysisConfig = await loadFeatureConfig(supabaseAdmin, AI_FEATURES.FOLLOWUP_ANALYSIS).catch(() => null);

    const analysisResult = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_analysis',
      systemPrompt: analysisConfig?.featurePrompt || ANALYSIS_SYSTEM_PROMPT,
      userPrompt: analysisUserPrompt,
      temperature: analysisConfig?.temperature || 0.3,
      maxTokens: analysisConfig?.maxOutputTokens || 900,
    });

    let analysisAndStrategy: AnalysisAndStrategyResult;
    try {
      analysisAndStrategy = JSON.parse(analysisResult.text.trim()) as AnalysisAndStrategyResult;
    } catch {
      console.error('[FollowUpAI][v3] CALL 1 returned invalid JSON, falling back to single-call');
      const fallbackResult = await generateTextWithRouting({
        supabaseAdmin,
        task: 'follow_up_generation',
        systemPrompt: 'Gere um follow-up de WhatsApp simples e direto para este chat.',
        userPrompt: baseContextPrompt,
        temperature: 0.7,
        maxTokens: 520,
      });
      return new Response(
        JSON.stringify({
          success: true,
          text: sanitizeGeneratedText(fallbackResult.text.trim()),
          provider: fallbackResult.provider,
          model: fallbackResult.model,
          fallback_used: true,
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const { analysis, strategy } = analysisAndStrategy;

    // If shouldSend is false, return early with a wait response
    if (strategy.shouldSend === false) {
      console.log('[FollowUpAI][v3] shouldSend=false', {
        stage: analysis.stage,
        blocker: analysis.blocker,
      });

      // Persist commercial state for next analysis
      try {
        await supabaseAdmin.rpc('upsert_commercial_state', {
          p_chat_id: chat.id,
          p_lead_id: chat.lead_id || null,
          p_stage: analysis.stage || 'outro',
          p_lead_temperature: analysis.leadTemperature || 'nao_identificado',
          p_contact_role: analysis.contactRole || 'nao_identificado',
          p_decision_maker: analysis.decisionMaker || null,
          p_stakeholders: JSON.stringify(analysis.stakeholders || []),
          p_blocker: analysis.blocker || 'nao_identificado',
          p_buying_signals: JSON.stringify(analysis.buyingSignals || []),
          p_objections: JSON.stringify(analysis.objections || []),
          p_known_facts: JSON.stringify(analysis.knownFacts || []),
          p_last_commercial_event: analysis.lastCommercialEvent || null,
          p_last_customer_position: analysis.lastCustomerPosition || null,
          p_last_commitment: analysis.lastCommitment ? JSON.stringify(analysis.lastCommitment) : null,
          p_previous_microdecision: analysis.previousMicrodecision || null,
          p_pending_microdecision: analysis.pendingMicrodecision || null,
          p_next_action_owner: analysis.nextActionOwner || 'nao_identificado',
          p_main_commercial_question: analysis.mainCommercialQuestion || null,
          p_last_commercial_function: strategy.commercialFunction || null,
          p_last_strategy_summary: strategy.rationale || null,
          p_analysis_confidence: analysis.confidence || 0.5,
          p_source_last_message_id: null,
          p_source_last_message_at: null,
        });
      } catch (stateErr) {
        console.error('[FollowUpAI][v3] failed to persist commercial state', stateErr);
      }

      // Audit log (V3 wait)
      let generationId: string | null = null;
      if (chat.lead_id) {
        const { data: auditRow } = await supabaseAdmin.from('comm_follow_up_audit_log').insert({
          lead_id: chat.lead_id,
          chat_id: chat.id,
          source_reminder_id: toTrimmedString(body.sourceReminderId) || null,
          batch_id: toTrimmedString(body.batchId) || null,
          trigger_source: toTrimmedString(body.triggerSource) || 'individual',
          generated_by: authResult.user.profileId,
          provider: analysisResult.provider,
          model: analysisResult.model,
          current_action: 'wait',
          current_action_reason: strategy.waitReason || 'Analise comercial indica que nao e adequado enviar follow-up agora.',
          stage: analysis.stage,
          blocker: analysis.blocker,
          goal: analysis.goal,
          commercial_function: strategy.commercialFunction,
          next_action_owner: analysis.nextActionOwner,
          pending_microdecision: analysis.pendingMicrodecision,
          last_commercial_commitment: analysis.lastCommitment,
          decision_maker: analysis.decisionMaker,
          opportunity_recommendation: 'pause',
          schedule_action: strategy.scheduleRecommendation?.action || 'no_schedule',
          schedule_suggested_date: strategy.scheduleRecommendation?.suggestedDate || null,
          schedule_reason: strategy.scheduleRecommendation?.reason || null,
          schedule_confidence: strategy.scheduleRecommendation?.confidence || 'medium',
          rationale: strategy.rationale,
          generated_text: null,
          text_content: '[WAIT — sem mensagem gerada]',
          v3_analysis: analysis,
          v3_strategy: strategy,
          v3_analysis_model: analysisResult.model,
          v3_regeneration_count: 0,
        }).select('id').maybeSingle();
        generationId = toTrimmedString(auditRow?.id) || null;
      }

      return new Response(
        JSON.stringify({
          success: true,
          text: null,
          aiContext: {
            stage: analysis.stage,
            blocker: analysis.blocker,
            goal: analysis.goal,
            emotionalContext: analysis.emotionalContext,
            rationale: strategy.rationale,
            commercialFunction: strategy.commercialFunction,
            nextActionOwner: analysis.nextActionOwner,
            pendingMicrodecision: analysis.pendingMicrodecision,
            lastCommercialCommitment: analysis.lastCommitment,
            decisionMaker: analysis.decisionMaker,
          },
          currentAction: 'wait',
          currentActionReason: strategy.waitReason || 'Analise comercial indica que nao e adequado enviar follow-up agora.',
          opportunityRecommendation: 'pause',
          scheduleRecommendation: strategy.scheduleRecommendation || null,
          generationId,
          provider: analysisResult.provider,
          model: analysisResult.model,
          fallback_used: false,
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // =====================================================================
    // V3: CALL 2 — Copy Generation
    // =====================================================================
    const copyConfig = await loadFeatureConfig(supabaseAdmin, AI_FEATURES.FOLLOWUP_GENERATE).catch(() => null);

    const copySystemPrompt = [
      copyConfig?.featurePrompt || COPY_SYSTEM_PROMPT,
      '',
      STYLE_RULE,
      DEFAULT_CONDUCT_RULES,
      ['REGRAS DE ESTILO (aprendidas do historico real — use apenas o padrao de tom e estrutura):', styleProfileText].join('\n'),
      COMMERCIAL_THREAD_RULE,
      NO_REPEAT_STRATEGY_RULE,
      NOT_A_COLLECTION_CALL_RULE,
      OBJECTION_READING_RULE,
      NO_INVENTED_URGENCY_RULE,
      EMOTIONAL_CONTEXT_INSTRUCTION,
      OWN_LAST_MESSAGE_AWARENESS_INSTRUCTION,
      MULTI_MESSAGE_MECHANISM_NOTE,
      MESSAGE_SPLITTING_INSTRUCTION,
    ].filter(Boolean).join('\n\n');

    const copyUserPrompt = buildCopyUserPrompt({
      analysis,
      strategy,
      relevantTranscript: transcriptLines.join('\n'),
      styleProfile: styleProfileText,
      temporalFacts: temporalFactsText,
      leadContext: baseContextPrompt,
      validationFeedback: null,
    });

    const maxTokens = shouldGenerateVariations
      ? Math.min(1400, 340 * variantCount)
      : 520;

    console.log('[FollowUpAI][v3] CALL 2 — copy generation', {
      commercialFunction: strategy.commercialFunction,
      goal: analysis.goal,
      maxTokens,
    });

    let copyResult = await generateTextWithRouting({
      supabaseAdmin,
      task: 'follow_up_generation',
      systemPrompt: copySystemPrompt,
      userPrompt: copyUserPrompt,
      temperature: hasCustomInstructions ? 0.5 : (copyConfig?.temperature || 0.7),
      maxTokens,
    });

    let parsed = parseFollowUpGenerationResult(copyResult.text, shouldGenerateVariations);

    // JSON schema retry (same as V2)
    if (!isValidFollowUpGenerationResult(parsed, shouldGenerateVariations)) {
      console.warn('[FollowUpAI][v3] copy response did not follow schema, retrying once');
      try {
        const retryResult = await generateTextWithRouting({
          supabaseAdmin,
          task: 'follow_up_generation',
          systemPrompt: `${copySystemPrompt}\n\nATENCAO: sua resposta anterior nao seguiu exatamente o formato JSON exigido. Retorne SOMENTE o JSON valido no formato especificado, sem nenhum texto fora do JSON e sem markdown.`,
          userPrompt: copyUserPrompt,
          temperature: hasCustomInstructions ? 0.5 : (copyConfig?.temperature || 0.7),
          maxTokens,
        });
        const retryParsed = parseFollowUpGenerationResult(retryResult.text, shouldGenerateVariations);
        if (isValidFollowUpGenerationResult(retryParsed, shouldGenerateVariations)) {
          parsed = retryParsed;
          copyResult = retryResult;
        }
      } catch (retryError) {
        console.error('[FollowUpAI][v3] copy retry failed', retryError);
      }
    }

    // =====================================================================
    // V3: VALIDATION + REGENERATION LOOP (max 2 retries)
    // =====================================================================
    const maxRetries = 2;
    let regenerationCount = 0;
    let validation: ValidationResult = { valid: true, issues: [] };
    let validatedText = '';
    let aiContext: AiContextRecommendation | null = null;

    const extractResponseText = (p: ReturnType<typeof parseFollowUpGenerationResult>): string => {
      if (p.variations?.length > 0 && p.variations[0]?.text) {
        return sanitizeGeneratedText(p.variations[0].text);
      }
      return p.text ? sanitizeGeneratedText(p.text) : '';
    };

    if (shouldGenerateVariations) {
      validatedText = extractResponseText(parsed);
      aiContext = parsed.aiContext;
    } else {
      // Validate the copy
      const candidateText = extractResponseText(parsed);
      validation = validateCommercialMessage(candidateText, {
        analysis,
        strategy,
        transcriptLines,
        recentAudits,
        messages,
      });

      if (!validation.valid && regenerationCount < maxRetries) {
        console.warn('[FollowUpAI][v3] validation failed, regenerating', {
          issues: validation.issues,
        });

        const feedback = formatValidationFeedback(validation);

        for (let attempt = 0; attempt < maxRetries && !validation.valid; attempt++) {
          regenerationCount++;

          const retryCopyPrompt = [
            copyUserPrompt,
            '',
            'CORRECAO NECESSARIA — a mensagem anterior falhou na validacao:',
            feedback,
            '',
            'Gere uma nova mensagem corrigindo todos os problemas acima. Respeite a estrategia definida mas ajuste o texto.',
          ].join('\n');

          try {
            const retryResult = await generateTextWithRouting({
              supabaseAdmin,
              task: 'follow_up_generation',
              systemPrompt: copySystemPrompt,
              userPrompt: retryCopyPrompt,
              temperature: hasCustomInstructions ? 0.5 : 0.7,
              maxTokens,
            });

            const retryParsed = parseFollowUpGenerationResult(retryResult.text, false);
            if (isValidFollowUpGenerationResult(retryParsed, false)) {
              const retryText = extractResponseText(retryParsed);
              const retryValidation = validateCommercialMessage(retryText, {
                analysis,
                strategy,
                transcriptLines,
                recentAudits,
                messages,
              });

              if (retryValidation.valid || attempt === maxRetries - 1) {
                validation = retryValidation;
                validatedText = retryText;
                parsed = retryParsed;
                copyResult = retryResult;
                aiContext = retryParsed.aiContext;
                break;
              }
            }
          } catch (retryErr) {
            console.error('[FollowUpAI][v3] regeneration attempt failed', retryErr);
            break;
          }
        }
      }

      if (!validatedText) {
        validatedText = extractResponseText(parsed);
        aiContext = parsed.aiContext;
      }
    }

    // =====================================================================
    // POST-COPY: outbound guard, state persistence, audit, response
    // =====================================================================

    // Merge analysis-derived fields into aiContext for downstream compat
    if (aiContext) {
      aiContext = {
        ...aiContext,
        stage: aiContext.stage || analysis.stage,
        blocker: aiContext.blocker || analysis.blocker,
        goal: aiContext.goal || analysis.goal,
        commercialFunction: aiContext.commercialFunction || strategy.commercialFunction,
        nextActionOwner: aiContext.nextActionOwner || analysis.nextActionOwner,
        pendingMicrodecision: aiContext.pendingMicrodecision || analysis.pendingMicrodecision,
        lastCommercialCommitment: aiContext.lastCommercialCommitment || analysis.lastCommitment,
        decisionMaker: aiContext.decisionMaker || analysis.decisionMaker,
        emotionalContext: aiContext.emotionalContext || analysis.emotionalContext,
      };
    }

    // Outbound guard: suppress if a recent outbound was sent without reply
    if (hasRecentOutboundWithoutInbound(messages, now) && !customInstructions && !validation.valid) {
      aiContext = {
        ...(aiContext ?? parseAiContextFromRecord({})),
        currentAction: 'wait',
        currentActionReason: 'Há uma mensagem outbound útil enviada há menos de 12 horas sem resposta; aguarde tempo razoável de análise.',
        commercialFunction: 'nenhuma',
        scheduleAction: aiContext?.scheduleAction ?? 'schedule',
        scheduleReason: aiContext?.scheduleReason ?? 'Dar tempo para avaliação antes de nova retomada.',
        scheduleConfidence: aiContext?.scheduleConfidence ?? 'high',
      };
      validatedText = '';
    }

    let responseText = validatedText;

    if (!responseText && aiContext?.currentAction !== 'wait') {
      throw new Error('A IA nao retornou um follow-up valido.');
    }

    if (responseText) {
      responseText = normalizeGreetingForTemporalFacts(responseText, temporalFacts);
    }

    // Persist commercial state
    try {
      await supabaseAdmin.rpc('upsert_commercial_state', {
        p_chat_id: chat.id,
        p_lead_id: chat.lead_id || null,
        p_stage: analysis.stage || 'outro',
        p_lead_temperature: analysis.leadTemperature || 'nao_identificado',
        p_contact_role: analysis.contactRole || 'nao_identificado',
        p_decision_maker: analysis.decisionMaker || null,
        p_stakeholders: JSON.stringify(analysis.stakeholders || []),
        p_blocker: analysis.blocker || 'nao_identificado',
        p_buying_signals: JSON.stringify(analysis.buyingSignals || []),
        p_objections: JSON.stringify(analysis.objections || []),
        p_known_facts: JSON.stringify(analysis.knownFacts || []),
        p_last_commercial_event: analysis.lastCommercialEvent || null,
        p_last_customer_position: analysis.lastCustomerPosition || null,
        p_last_commitment: analysis.lastCommitment ? JSON.stringify(analysis.lastCommitment) : null,
        p_previous_microdecision: analysis.previousMicrodecision || null,
        p_pending_microdecision: analysis.pendingMicrodecision || null,
        p_next_action_owner: analysis.nextActionOwner || 'nao_identificado',
        p_main_commercial_question: analysis.mainCommercialQuestion || null,
        p_last_commercial_function: strategy.commercialFunction || null,
        p_last_strategy_summary: strategy.rationale || null,
        p_analysis_confidence: analysis.confidence || 0.5,
        p_source_last_message_id: null,
        p_source_last_message_at: null,
      });
    } catch (stateErr) {
      console.error('[FollowUpAI][v3] failed to persist commercial state', stateErr);
    }

    const nextAction = await buildFollowUpNextAction({
      supabaseAdmin,
      messages,
      lead,
      leadContext,
      aiContext,
      now,
    });

    console.log('[FollowUpAI][v3] final response', {
      commercialFunction: strategy.commercialFunction,
      stage: analysis.stage,
      blocker: analysis.blocker,
      regenerationCount,
      validationValid: validation.valid,
      responseTextLength: responseText?.length || 0,
    });

    const scheduleRecommendation = {
      action: aiContext?.scheduleAction ?? (nextAction?.suggestedDateTime ? 'schedule' : 'no_schedule'),
      suggestedDate: aiContext?.scheduleAction === 'no_schedule' ? null : nextAction?.suggestedDateTime ?? null,
      reason: aiContext?.scheduleReason ?? nextAction?.reason ?? 'Recomendação de agenda indisponível.',
      confidence: aiContext?.scheduleConfidence ?? 'medium',
    };

    // Audit log
    let generationId: string | null = null;
    if (chat.lead_id) {
      const { data: auditRow, error: auditError } = await supabaseAdmin.from('comm_follow_up_audit_log').insert({
        lead_id: chat.lead_id,
        chat_id: chat.id,
        source_reminder_id: toTrimmedString(body.sourceReminderId) || null,
        batch_id: toTrimmedString(body.batchId) || null,
        trigger_source: toTrimmedString(body.triggerSource) || 'individual',
        generated_by: authResult.user.profileId,
        provider: copyResult.provider,
        model: copyResult.model,
        current_action: aiContext?.currentAction,
        current_action_reason: aiContext?.currentActionReason,
        stage: aiContext?.stage,
        blocker: aiContext?.blocker,
        goal: aiContext?.goal,
        commercial_function: aiContext?.commercialFunction,
        next_action_owner: aiContext?.nextActionOwner,
        pending_microdecision: aiContext?.pendingMicrodecision,
        last_commercial_commitment: aiContext?.lastCommercialCommitment,
        decision_maker: aiContext?.decisionMaker,
        opportunity_recommendation: aiContext?.opportunityRecommendation,
        schedule_action: scheduleRecommendation.action,
        schedule_suggested_date: scheduleRecommendation.suggestedDate,
        schedule_reason: scheduleRecommendation.reason,
        schedule_confidence: scheduleRecommendation.confidence,
        rationale: aiContext?.rationale,
        generated_text: responseText || null,
        text_content: responseText || '[WAIT — sem mensagem gerada]',
        v3_analysis: analysis,
        v3_strategy: strategy,
        v3_validation: validation,
        v3_regeneration_count: regenerationCount,
        v3_analysis_model: analysisResult.model,
        v3_copy_model: copyResult.model,
      }).select('id').maybeSingle();
      if (auditError) console.error('[FollowUpAI][v3] audit log error', auditError);
      generationId = toTrimmedString(auditRow?.id) || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: responseText || null,
        variations: shouldGenerateVariations && parsed.variations?.length > 0 ? parsed.variations : undefined,
        aiContext: {
          stage: aiContext?.stage ?? null,
          blocker: aiContext?.blocker ?? null,
          goal: aiContext?.goal ?? null,
          emotionalContext: aiContext?.emotionalContext ?? null,
          rationale: aiContext?.rationale ?? null,
          commercialFunction: aiContext?.commercialFunction ?? null,
          nextActionOwner: aiContext?.nextActionOwner ?? null,
          pendingMicrodecision: aiContext?.pendingMicrodecision ?? null,
          lastCommercialCommitment: aiContext?.lastCommercialCommitment ?? null,
          decisionMaker: aiContext?.decisionMaker ?? null,
        },
        currentAction: aiContext?.currentAction ?? 'send',
        currentActionReason: aiContext?.currentActionReason ?? null,
        opportunityRecommendation: aiContext?.opportunityRecommendation ?? 'continue',
        scheduleRecommendation,
        nextAction,
        generationId,
        provider: copyResult.provider,
        model: copyResult.model,
        fallback_used: copyResult.fallbackUsed,
        v3: {
          analysisModel: analysisResult.model,
          copyModel: copyResult.model,
          validation,
          regenerationCount,
        },
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    console.error('[comm-whatsapp-generate-follow-up] erro inesperado', msg, stack);
    return new Response(
      JSON.stringify({ error: `[follow-up] ${msg}${stack ? ' | ' + stack : ''}` }),
      {
        status: error instanceof FollowUpValidationError ? 422 : 500,
        headers: jsonHeaders,
      },
    );
  }
});
