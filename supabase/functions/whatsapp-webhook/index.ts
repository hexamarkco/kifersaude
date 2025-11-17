import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

type ChatLeadSummary = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  status: string | null;
  responsavel: string | null;
  ultimo_contato: string | null;
  proximo_retorno: string | null;
};

type ChatContractSummary = {
  id: string;
  codigo_contrato: string | null;
  status: string | null;
  modalidade: string | null;
  operadora: string | null;
  produto_plano: string | null;
  mensalidade_total: number | null;
  comissao_prevista: number | null;
  responsavel: string | null;
  previsao_recebimento_comissao: string | null;
  previsao_pagamento_bonificacao: string | null;
};

type ChatFinancialSummary = {
  total_mensalidade: number | null;
  total_comissao: number | null;
  total_bonus: number | null;
};

type WhatsappChat = {
  id: string;
  phone: string;
  chat_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  is_group: boolean;
  sender_photo: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  display_name?: string | null;
  crm_lead?: ChatLeadSummary | null;
  crm_contracts?: ChatContractSummary[];
  crm_financial_summary?: ChatFinancialSummary | null;
  sla_metrics?: ChatSlaMetrics | null;
};

type ChatSlaMetrics = {
  chat_id: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_response_ms: number | null;
  pending_inbound_count: number;
  waiting_since: string | null;
  waiting_minutes: number | null;
  sla_status: 'healthy' | 'warning' | 'critical';
};

type WhatsappMessage = {
  id: string;
  chat_id: string;
  message_id: string | null;
  from_me: boolean;
  status: string | null;
  text: string | null;
  moment: string | null;
  raw_payload: Record<string, any> | null;
};

type ZapiContact = {
  phone?: string;
  name?: string;
  short?: string;
  vname?: string;
  notify?: string;
};

type LeadSummaryRecord = {
  id: string;
  telefone: string | null;
  nome_completo: string | null;
  status: string | null;
  responsavel: string | null;
  ultimo_contato: string | null;
  proximo_retorno: string | null;
  updated_at: string | null;
};

type ContractSummaryRecord = {
  id: string | null;
  lead_id: string | null;
  codigo_contrato: string | null;
  status: string | null;
  modalidade: string | null;
  operadora: string | null;
  produto_plano: string | null;
  mensalidade_total: number | string | null;
  comissao_prevista: number | string | null;
  comissao_recebimento_adiantado: boolean | number | string | null;
  responsavel: string | null;
  previsao_recebimento_comissao: string | null;
  previsao_pagamento_bonificacao: string | null;
  bonus_por_vida_valor: number | string | null;
  bonus_por_vida_aplicado: boolean | number | string | null;
  vidas: number | string | null;
};

type ZapiWebhookPayload = {
  type?: string;
  phone?: string;
  ids?: (string | number | null | undefined)[] | null;
  id?: string | number | null;
  chatLid?: string;
  fromMe?: boolean;
  momment?: number | string;
  status?: string;
  chatName?: string;
  senderName?: string;
  senderPhoto?: string;
  messageId?: string;
  text?: { message?: string } | null;
  hydratedTemplate?: { message?: string } | null;
  notification?: string | null;
  notificationParameters?: unknown;
  requestMethod?: string | null;
  isGroup?: boolean;
  [key: string]: unknown;
};

type SendMessageBody = {
  phone?: string;
  message?: string;
};

type SendDocumentBody = {
  phone?: string;
  document?: string;
  fileName?: string;
  caption?: string;
  extension?: string;
};

type SendImageBody = {
  phone?: string;
  image?: string;
  caption?: string;
  viewOnce?: boolean;
};

type SendVideoBody = {
  phone?: string;
  video?: string;
  caption?: string;
  viewOnce?: boolean;
  async?: boolean;
};

type SendAudioBody = {
  phone?: string;
  audio?: string;
  seconds?: number;
  duration?: number;
  mimeType?: string;
  ptt?: boolean;
};

type SendLocationBody = {
  phone?: string;
  title?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
};

type SendContactBody = {
  phone?: string;
  contactName?: string;
  contactPhone?: string;
  contactBusinessDescription?: string;
  delayMessage?: number;
};

type TranscribeAudioBody = {
  audioUrl?: string;
};

type RewriteMessageBody = {
  text?: string;
};

type DeleteMessageBody = {
  messageId?: string;
  phone?: string;
  owner?: boolean;
};

type RewriteSuggestion = {
  tone: string;
  text: string;
};

type WhatsappContactSummary = {
  phone: string;
  name: string | null;
  isBusiness: boolean;
};

type PendingReceivedEntry = {
  payload: ZapiWebhookPayload;
  receivedAt: number;
};

type PendingSendEntry = {
  payload: Record<string, unknown>;
  phone?: string;
  receivedAt: number;
};

type UpdateChatFlagsBody = {
  is_archived?: boolean;
  is_pinned?: boolean;
};

type UpdateLeadStatusBody = {
  leadId?: string;
  newStatus?: string;
  responsavel?: string | null;
};

type LeadStatusUpdateResult = {
  id: string;
  status: string;
  ultimo_contato: string;
  responsavel: string;
};

type ZapiChatMetadata = {
  phone?: string;
  unread?: string | number;
  lastMessageTime?: string | number;
  isMuted?: string | number | boolean;
  isMarkedSpam?: string | boolean;
  profileThumbnail?: string | null;
  isGroupAnnouncement?: string | boolean;
  isGroup?: string | boolean;
  about?: string;
  notes?: {
    id?: string;
    content?: string;
    createdAt?: string | number;
    lastUpdateAt?: string | number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type ChatMetadataNote = {
  id: string | null;
  content: string | null;
  createdAt: number | null;
  createdAtIso: string | null;
  lastUpdateAt: number | null;
  lastUpdateAtIso: string | null;
};

type ChatMetadataSummary = {
  phone: string | null;
  unread: number | null;
  lastMessageTime: string | number | null;
  lastMessageTimestamp: number | null;
  lastMessageAt: string | null;
  isMuted: boolean | null;
  isMarkedSpam: boolean | null;
  profileThumbnail: string | null;
  isGroupAnnouncement: boolean | null;
  isGroup: boolean | null;
  about: string | null;
  notes: ChatMetadataNote | null;
  raw: Record<string, unknown> | null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.');
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

type IntegrationSettingsRow = {
  slug: string;
  settings: Record<string, unknown> | null;
  updated_at: string | null;
};

type GptIntegrationSettings = {
  apiKey: string | null;
  textModel: string | null;
};

const GPT_TRANSCRIPTION_INTEGRATION_SLUG = 'gpt_transcription';
const GPT_CONFIG_CACHE_TTL_MS = 60 * 1000;
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';
const OPENAI_AUDIO_TRANSCRIPTION_MODEL = 'whisper-1';
const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-4o-mini';

let cachedGptIntegration: { value: GptIntegrationSettings | null; fetchedAt: number } = {
  value: null,
  fetchedAt: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeGptIntegrationSettings = (settings: Record<string, unknown> | null): GptIntegrationSettings => {
  const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const record = settings && isRecord(settings) ? settings : null;
  const apiKey = toTrimmedString(record?.apiKey);
  const textModel = toTrimmedString(record?.textModel) || toTrimmedString(record?.model);

  return {
    apiKey: apiKey || null,
    textModel: textModel || null,
  };
};

const fetchIntegrationSettingsRow = async (slug: string): Promise<IntegrationSettingsRow | null> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const { data, error } = await supabaseAdmin
    .from('integration_settings')
    .select('slug, settings, updated_at')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    const normalizedCode = typeof error.code === 'string' ? error.code.toUpperCase() : '';
    if (['PGRST302', 'PGRST301', '42P01'].includes(normalizedCode)) {
      throw new Error(
        'Tabela integration_settings não encontrada. Execute as migrações e configure Configurações > Integrações.',
      );
    }

    throw new Error(error.message || 'Erro ao carregar configurações da integração GPT.');
  }

  return data as IntegrationSettingsRow | null;
};

const getGptIntegrationConfig = async (): Promise<{ apiKey: string; textModel: string }> => {
  const now = Date.now();
  const shouldRefresh = !cachedGptIntegration.value || now - cachedGptIntegration.fetchedAt > GPT_CONFIG_CACHE_TTL_MS;

  if (shouldRefresh) {
    const integration = await fetchIntegrationSettingsRow(GPT_TRANSCRIPTION_INTEGRATION_SLUG);
    cachedGptIntegration = {
      value: normalizeGptIntegrationSettings(integration?.settings ?? null),
      fetchedAt: now,
    };
  }

  const config = cachedGptIntegration.value;

  if (!config?.apiKey) {
    throw new Error(
      'Configure a chave da integração GPT em Configurações > Integrações antes de usar recursos como transcrição de áudios e reescrita de mensagens.',
    );
  }

  const textModel = config.textModel || DEFAULT_OPENAI_TEXT_MODEL;

  return { apiKey: config.apiKey, textModel };
};

const pendingReceivedFromMeMessages = new Map<string, PendingReceivedEntry>();
const pendingSendPayloads = new Map<string, PendingSendEntry>();

const PENDING_ENTRY_TTL_MS = 5 * 60 * 1000;

const safeJsonStringify = (value: unknown): string => {
  const seenObjects = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, serializedValue) => {
      if (typeof serializedValue === 'bigint') {
        return serializedValue.toString();
      }

      if (typeof serializedValue === 'object' && serializedValue !== null) {
        if (seenObjects.has(serializedValue as object)) {
          return '[Circular]';
        }

        seenObjects.add(serializedValue as object);
      }

      return serializedValue;
    });
  } catch (_error) {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return String(value);
    } catch (_stringError) {
      return '[unserializable value]';
    }
  }
};

const logWebhookPayload = (label: string, payload: unknown) => {
  try {
    console.log(label, safeJsonStringify(payload));
  } catch (error) {
    console.error(`Não foi possível registrar o payload do webhook ${label}.`, error);
  }
};

const cleanupPendingEntries = () => {
  const now = Date.now();

  for (const [messageId, entry] of pendingReceivedFromMeMessages.entries()) {
    if (now - entry.receivedAt > PENDING_ENTRY_TTL_MS) {
      pendingReceivedFromMeMessages.delete(messageId);
    }
  }

  for (const [messageId, entry] of pendingSendPayloads.entries()) {
    if (now - entry.receivedAt > PENDING_ENTRY_TTL_MS) {
      pendingSendPayloads.delete(messageId);
    }
  }
};

const toIsoStringOrNull = (value: Date | string | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const asNumber = typeof value === 'string' ? Number(value) : value;
  if (typeof asNumber === 'number' && Number.isFinite(asNumber)) {
    return new Date(asNumber).toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
};

const UNSUPPORTED_MESSAGE_PLACEHOLDER = '[tipo de mensagem não suportado ainda]';

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNonEmptyStringLike = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }

  return toNonEmptyString(value);
};

const toNonEmptyStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toNonEmptyStringLike(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const normalizeStatusValue = (value: unknown): string | null => {
  const status = toNonEmptyString(value);
  return status ? status.toUpperCase() : null;
};

const resolveStatusWebhookIds = (payload: ZapiWebhookPayload): string[] => {
  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  const combined = [
    ...ids,
    payload.id,
    payload.messageId,
    (payload as { message_id?: string | number | null | undefined }).message_id,
  ].filter((entry) => entry !== null && entry !== undefined);
  const uniqueIds = new Set<string>();

  for (const entry of combined) {
    if (typeof entry === 'string') {
      const normalized = entry.trim();
      if (normalized) {
        uniqueIds.add(normalized);
      }
    } else if (typeof entry === 'number' && Number.isFinite(entry)) {
      uniqueIds.add(entry.toString());
    }
  }

  return Array.from(uniqueIds);
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    if (!value.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toIntegerOrNull = (value: unknown): number | null => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) {
    return null;
  }

  const truncated = Math.trunc(parsed);
  return Number.isFinite(truncated) ? truncated : null;
};

const parseMoment = (value: number | string | undefined): Date | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;

  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
    return null;
  }

  return new Date(numericValue);
};

const parseBooleanish = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (normalized === '1' || normalized === 'true') {
      return true;
    }

    if (normalized === '0' || normalized === 'false') {
      return false;
    }
  }

  return null;
};

const parseInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return Math.trunc(parsed);
  }

  return null;
};

const normalizeZapiTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return value < 1_000_000_000_000 ? Math.round(value * 1000) : Math.round(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return normalizeZapiTimestamp(numeric);
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  return null;
};

const normalizeMetadataNote = (value: unknown): ChatMetadataNote | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const createdAt = normalizeZapiTimestamp(record.createdAt);
  const lastUpdateAt = normalizeZapiTimestamp(record.lastUpdateAt);

  return {
    id: toNonEmptyString(record.id),
    content: toNonEmptyString(record.content),
    createdAt,
    createdAtIso: toIsoStringOrNull(createdAt),
    lastUpdateAt,
    lastUpdateAtIso: toIsoStringOrNull(lastUpdateAt),
  };
};

const resolveCallNotificationText = (payload: ZapiWebhookPayload): string | null => {
  const notification = toNonEmptyString(payload?.notification);

  if (!notification) {
    return null;
  }

  switch (notification) {
    case 'CALL_VOICE':
      return 'Chamada recebida';
    case 'CALL_MISSED_VOICE':
      return 'Chamada perdida';
    default:
      return null;
  }
};

const resolveMembershipRequestMethodText = (method: string | null): string | null => {
  if (!method) {
    return null;
  }

  switch (method) {
    case 'invite_link':
      return 'via link de convite';
    case 'non_admin_add':
      return 'adicionado por participante';
    default:
      return method;
  }
};

const resolveNotificationText = (payload: ZapiWebhookPayload): string | null => {
  const notification = toNonEmptyString(payload?.notification);

  if (!notification) {
    return null;
  }

  const parameters = toNonEmptyStringArray(payload?.notificationParameters);
  const participantsText = parameters.length ? parameters.join(', ') : null;

  if (notification === 'MEMBERSHIP_APPROVAL_REQUEST') {
    const requestMethod = resolveMembershipRequestMethodText(toNonEmptyString(payload.requestMethod));
    const details = [requestMethod, participantsText ? `participante(s): ${participantsText}` : null]
      .filter(Boolean)
      .join(' - ');
    return details
      ? `Solicitação de aprovação para novo membro - ${details}`
      : 'Solicitação de aprovação para novo membro';
  }

  if (notification === 'REVOKED_MEMBERSHIP_REQUESTS') {
    return participantsText
      ? `Solicitação de participação revogada: ${participantsText}`
      : 'Solicitações de participação revogadas';
  }

  if (notification === 'NEWSLETTER_ADMIN_PROMOTE' || notification === 'NEWSLETTER_ADMIN_DEMOTE') {
    const [targetParticipant, role] = parameters;
    const participantText = targetParticipant ?? 'Participante do canal';
    const roleText = role ?? (notification === 'NEWSLETTER_ADMIN_PROMOTE' ? 'ADMIN' : 'SUBSCRIBER');
    const actionText = notification === 'NEWSLETTER_ADMIN_PROMOTE' ? 'promovido' : 'rebaixado';

    return `${participantText} ${actionText}${roleText ? ` para ${roleText}` : ''} no canal`;
  }

  if (notification.startsWith('GROUP_PARTICIPANT_')) {
    switch (notification) {
      case 'GROUP_PARTICIPANT_INVITE':
        return participantsText
          ? `Convite enviado para participar do grupo: ${participantsText}`
          : 'Convite enviado para participar do grupo';
      case 'GROUP_PARTICIPANT_ADD':
        return participantsText
          ? `Novo participante adicionado ao grupo: ${participantsText}`
          : 'Novo participante adicionado ao grupo';
      case 'GROUP_PARTICIPANT_LINK_JOIN':
        return participantsText
          ? `Entrada no grupo via link de convite: ${participantsText}`
          : 'Entrada no grupo via link de convite';
      case 'GROUP_PARTICIPANT_LEAVE':
        return participantsText
          ? `Participante saiu do grupo: ${participantsText}`
          : 'Participante saiu do grupo';
      case 'GROUP_PARTICIPANT_REMOVE':
        return participantsText
          ? `Participante removido do grupo: ${participantsText}`
          : 'Participante removido do grupo';
      case 'GROUP_PARTICIPANT_PROMOTE':
        return participantsText
          ? `Participante promovido a admin do grupo: ${participantsText}`
          : 'Participante promovido a admin do grupo';
      case 'GROUP_PARTICIPANT_DEMOTE':
        return participantsText
          ? `Participante rebaixado para membro do grupo: ${participantsText}`
          : 'Participante rebaixado para membro do grupo';
      default:
        return participantsText
          ? `Atualização de participantes do grupo: ${participantsText}`
          : 'Atualização de participantes do grupo';
    }
  }

  return `Notificação: ${notification}`;
};

const resolveMessageText = (payload: ZapiWebhookPayload): string => {
  const textMessage = toNonEmptyString(payload?.text?.message);
  if (textMessage) {
    return textMessage;
  }

  const hydratedTemplateMessage = toNonEmptyString(payload?.hydratedTemplate?.message);
  if (hydratedTemplateMessage) {
    return hydratedTemplateMessage;
  }

  const callNotificationText = resolveCallNotificationText(payload);
  if (callNotificationText) {
    return callNotificationText;
  }

  const notificationText = resolveNotificationText(payload);
  if (notificationText) {
    return notificationText;
  }

  const rawPayload = (payload ?? null) as Record<string, unknown> | null;

  const imagePayload = rawPayload?.image;
  if (imagePayload && typeof imagePayload === 'object') {
    const { caption } = imagePayload as { caption?: unknown };
    const captionText = toNonEmptyString(caption);
    return `Imagem recebida${captionText ? ` - ${captionText}` : ''}`;
  }

  const audioPayload = rawPayload?.audio;
  if (audioPayload && typeof audioPayload === 'object') {
    const { seconds } = audioPayload as { seconds?: unknown };
    const secondsNumber =
      typeof seconds === 'number' && Number.isFinite(seconds)
        ? Math.round(seconds)
        : null;
    const secondsText = secondsNumber !== null ? ` (${secondsNumber}s)` : '';
    return `Áudio recebido${secondsText}`;
  }

  const videoPayload = rawPayload?.video;
  if (videoPayload && typeof videoPayload === 'object') {
    const { caption } = videoPayload as { caption?: unknown };
    const captionText = toNonEmptyString(caption);
    return `Vídeo recebido${captionText ? ` - ${captionText}` : ''}`;
  }

  const documentPayload = rawPayload?.document;
  if (documentPayload && typeof documentPayload === 'object') {
    const { title, fileName } = documentPayload as {
      title?: unknown;
      fileName?: unknown;
    };
    const descriptor = toNonEmptyString(title) ?? toNonEmptyString(fileName) ?? null;
    return `Documento recebido${descriptor ? `: ${descriptor}` : ''}`;
  }

  const locationPayload = rawPayload?.location;
  if (locationPayload && typeof locationPayload === 'object') {
    const { title } = locationPayload as { title?: unknown };
    const titleText = toNonEmptyString(title);
    return `Localização recebida${titleText ? `: ${titleText}` : ''}`;
  }

  const contactPayload = rawPayload?.contact;
  if (contactPayload && typeof contactPayload === 'object') {
    const { name } = contactPayload as { name?: unknown };
    const nameText = toNonEmptyString(name);
    return `Contato recebido${nameText ? `: ${nameText}` : ''}`;
  }

  const contactsPayload = rawPayload?.contacts;
  if (Array.isArray(contactsPayload) && contactsPayload.length > 0) {
    const firstContact = contactsPayload[0] as { name?: unknown };
    const nameText = toNonEmptyString(firstContact?.name);
    return `Contato recebido${nameText ? `: ${nameText}` : ''}`;
  }

  return UNSUPPORTED_MESSAGE_PLACEHOLDER;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/json': 'json',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/ogg': 'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/wav': 'wav',
};

const TEMP_AUDIO_BUCKET = 'whatsapp-temp-audio';
const TEMP_AUDIO_URL_TTL_SECONDS = 60 * 60 * 24; // 24 horas
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/aac',
  'audio/mp4',
  'audio/amr',
  'audio/mpeg',
  'audio/ogg',
]);
const SUPPORTED_AUDIO_FORMATS_MESSAGE =
  'Use um dos formatos aceitos: audio/aac, audio/mp4, audio/amr, audio/mpeg ou audio/ogg (opus). Para ogg/opus, apenas áudios de canal único são aceitos pelo WhatsApp.';

const extractExtensionFromFileName = (fileName: string | null): string | null => {
  if (!fileName) {
    return null;
  }

  const trimmed = fileName.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/\.([A-Za-z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
};

const extractExtensionFromDataUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/^data:([^;,]+)[;,]/i);
  if (!match) {
    return null;
  }

  const mime = match[1]?.toLowerCase();
  return mime ? MIME_EXTENSION_MAP[mime] ?? null : null;
};

const sanitizeExtension = (extension: string | null): string | null => {
  if (!extension) {
    return null;
  }

  const trimmed = extension.trim().toLowerCase().replace(/^[.]+/, '');
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/[^a-z0-9]/g, '');
};

const normalizeMimeType = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const [mime] = value.split(';', 1);
  const trimmed = mime?.trim().toLowerCase();
  return trimmed || null;
};

const generateAudioFileName = (extension: string | null): string => {
  const sanitizedExtension = sanitizeExtension(extension) ?? 'bin';
  const uniqueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36);

  return `audio-${uniqueId}.${sanitizedExtension}`;
};

const createFileFromDataUrl = (dataUrl: string): File => {
  const [header, base64Content] = dataUrl.split(',', 2);
  if (!header || !base64Content || !header.toLowerCase().includes(';base64')) {
    throw new Error('Formato de áudio inválido para transcrição');
  }

  const mimeMatch = header.match(/^data:([^;,]+)(?:;.*)?$/i);
  const mime = normalizeMimeType(mimeMatch?.[1]?.toLowerCase() ?? null) ?? 'application/octet-stream';
  const binary = atob(base64Content);
  const buffer = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    buffer[index] = binary.charCodeAt(index);
  }

  const extension = MIME_EXTENSION_MAP[mime] ?? 'bin';
  return new File([buffer], generateAudioFileName(extension), { type: mime });
};

const downloadAudioFile = async (audioUrl: string): Promise<File> => {
  if (audioUrl.startsWith('data:')) {
    return createFileFromDataUrl(audioUrl);
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Falha ao baixar áudio (${response.status}): ${details || 'erro desconhecido'}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeHeader = response.headers.get('content-type');
  const mime = normalizeMimeType(mimeHeader) ?? 'audio/mpeg';
  const extension = MIME_EXTENSION_MAP[mime] ?? 'mp3';
  return new File([arrayBuffer], generateAudioFileName(extension), { type: mime });
};

const uploadAudioToTemporaryStorage = async (
  audioFile: File,
  mimeType: string | null,
): Promise<{ signedUrl: string; mimeType: string }> => {
  if (!supabaseAdmin) {
    throw new Error('Cliente do Supabase não configurado para upload de áudio.');
  }

  const normalizedMimeType = normalizeMimeType(mimeType) ?? normalizeMimeType(audioFile.type);
  if (!normalizedMimeType || !ALLOWED_AUDIO_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error(SUPPORTED_AUDIO_FORMATS_MESSAGE);
  }

  const extensionFromName = extractExtensionFromFileName(audioFile.name);
  const extensionFromMime = MIME_EXTENSION_MAP[normalizedMimeType];
  const sanitizedExtension = sanitizeExtension(extensionFromName ?? extensionFromMime) ?? 'bin';
  const storageFileName = generateAudioFileName(sanitizedExtension);
  const now = new Date();
  const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const storagePath = `${datePath}/${storageFileName}`;

  const fileBuffer = await audioFile.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(TEMP_AUDIO_BUCKET)
    .upload(storagePath, new Uint8Array(fileBuffer), {
      cacheControl: '86400',
      upsert: false,
      contentType: normalizedMimeType,
    });

  if (uploadError) {
    throw new Error(`Falha ao enviar o áudio para armazenamento temporário: ${uploadError.message}`);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
    .from(TEMP_AUDIO_BUCKET)
    .createSignedUrl(storagePath, TEMP_AUDIO_URL_TTL_SECONDS, {
      download: storageFileName,
    });

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(
      `Erro ao gerar link temporário para o áudio: ${signedUrlError?.message || 'resposta inválida'}`,
    );
  }

  return { signedUrl: signedUrlData.signedUrl, mimeType: normalizedMimeType };
};

const transcribeAudioFromUrl = async (audioUrl: string): Promise<string> => {
  if (!audioUrl) {
    throw new Error('URL do áudio não informada para transcrição');
  }

  const { apiKey } = await getGptIntegrationConfig();
  const audioFile = await downloadAudioFile(audioUrl);

  const formData = new FormData();
  formData.append('model', OPENAI_AUDIO_TRANSCRIPTION_MODEL);
  formData.append('file', audioFile, audioFile.name);
  formData.append('response_format', 'json');

  const response = await fetch(`${OPENAI_API_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(
      `Falha ao transcrever áudio (${response.status}): ${rawBody || 'erro desconhecido'}`,
    );
  }

  let result: { text?: string | null } | null = null;
  try {
    result = rawBody ? (JSON.parse(rawBody) as { text?: string | null }) : null;
  } catch (_error) {
    result = rawBody ? { text: rawBody } : null;
  }

  const transcription = result?.text?.trim();
  if (!transcription) {
    throw new Error('A API GPT retornou uma transcrição vazia.');
  }

  return transcription;
};

const createRewritePrompt = (text: string) => {
  const sanitized = text.trim();
  return [
    'Reescreva a mensagem abaixo em português com variações de tom.',
    'Gere ao menos três versões diferentes, incluindo tons como "Sério", "Descontraído" e "Profissional cordial".',
    'Responda apenas em JSON no formato {"variations":[{"tone":"Sério","text":"..."}]} sem texto adicional.',
    `Mensagem original: "${sanitized}"`,
  ].join('\n');
};

const extractRewriteSuggestionsFromRaw = (rawText: string): RewriteSuggestion[] => {
  const suggestions: RewriteSuggestion[] = [];

  const stripMarkdownCodeFence = (text: string): string => {
    const trimmed = text.trim();
    const fencedMatch = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/m.exec(trimmed);

    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    return trimmed;
  };

  const normalizeList = (entries: unknown): RewriteSuggestion[] => {
    const extractVariations = (candidate: unknown): unknown[] | null => {
      if (!candidate || typeof candidate !== 'object') {
        return null;
      }

      if (Array.isArray(candidate)) {
        return candidate;
      }

      const record = candidate as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        const normalizedKey = key.toLowerCase();
        if (normalizedKey === 'variations' || normalizedKey === 'versoes' || normalizedKey === 'versions') {
          if (Array.isArray(value)) {
            return value;
          }
        }
      }

      for (const value of Object.values(record)) {
        if (Array.isArray(value)) {
          return value;
        }

        const nested = extractVariations(value);
        if (nested) {
          return nested;
        }
      }

      return null;
    };

    if (!entries || typeof entries !== 'object') {
      return [];
    }

    const variations = extractVariations(entries);

    if (!variations) {
      return [];
    }

    const normalized: RewriteSuggestion[] = [];

    for (const entry of variations) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const tone =
        toNonEmptyString((entry as { tone?: unknown }).tone) ??
        toNonEmptyString((entry as { estilo?: unknown }).estilo) ??
        'Sugestão';

      const text =
        toNonEmptyString((entry as { text?: unknown }).text) ??
        toNonEmptyString((entry as { mensagem?: unknown }).mensagem);

      if (text) {
        normalized.push({ tone, text });
      }
    }

    return normalized;
  };

  const trimmed = stripMarkdownCodeFence(rawText);

  try {
    const parsedJson = JSON.parse(trimmed) as unknown;
    suggestions.push(...normalizeList(parsedJson));
  } catch (_error) {
    // Ignore JSON parsing errors and try other strategies below.
  }

  if (suggestions.length === 0) {
    const lines = trimmed
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const match = /^[-*•]?\s*(?<tone>[^:]{1,40}):\s*(?<text>.+)$/iu.exec(line);
      const tone = match?.groups?.tone ?? 'Sugestão';
      const text = match?.groups?.text ?? line;

      if (text) {
        suggestions.push({ tone: tone.trim(), text: text.trim() });
      }
    }
  }

  if (suggestions.length === 0 && trimmed) {
    suggestions.push({ tone: 'Sugestão', text: trimmed });
  }

  const uniqueSuggestions = suggestions.filter(
    (suggestion, index, list) =>
      list.findIndex(
        (entry) => entry.tone.toLowerCase() === suggestion.tone.toLowerCase() && entry.text === suggestion.text,
      ) === index,
  );

  return uniqueSuggestions;
};

const extractOpenAiResponseText = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const topLevelText = (payload as { output_text?: unknown }).output_text;
  if (typeof topLevelText === 'string' && topLevelText.trim()) {
    return topLevelText.trim();
  }

  const outputList = (payload as { output?: unknown }).output;
  if (Array.isArray(outputList)) {
    for (const entry of outputList) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const entryText = (entry as { output_text?: unknown }).output_text;
      if (typeof entryText === 'string' && entryText.trim()) {
        return entryText.trim();
      }

      const content = (entry as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const contentEntry of content) {
        if (!contentEntry || typeof contentEntry !== 'object') {
          continue;
        }

        const contentText = (contentEntry as { text?: unknown }).text;
        if (typeof contentText === 'string' && contentText.trim()) {
          return contentText.trim();
        }

        const contentOutputText = (contentEntry as { output_text?: unknown }).output_text;
        if (typeof contentOutputText === 'string' && contentOutputText.trim()) {
          return contentOutputText.trim();
        }
      }
    }
  }

  return null;
};

const rewriteMessageWithGpt = async (text: string): Promise<RewriteSuggestion[]> => {
  const { apiKey, textModel } = await getGptIntegrationConfig();

  const response = await fetch(`${OPENAI_API_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: textModel || DEFAULT_OPENAI_TEXT_MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: createRewritePrompt(text),
            },
          ],
        },
      ],
      max_output_tokens: 300,
    }),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `Falha ao reescrever mensagem (${response.status}): ${rawBody || 'erro desconhecido'}`,
    );
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch (_error) {
    parsedBody = rawBody ? { output_text: rawBody } : null;
  }

  const rewritten = extractOpenAiResponseText(parsedBody);
  if (!rewritten) {
    throw new Error('A API GPT não retornou texto reescrito.');
  }

  const suggestions = extractRewriteSuggestionsFromRaw(rewritten);
  if (suggestions.length === 0) {
    throw new Error('A API GPT não retornou variações de reescrita.');
  }

  return suggestions;
};

const ensureJsonBody = async <T = unknown>(req: Request): Promise<T | null> => {
  try {
    return (await req.json()) as T;
  } catch (_error) {
    return null;
  }
};

const respondJson = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getZapiCredentials = () => {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!instanceId || !token || !clientToken) {
    return null;
  }

  return { instanceId, token, clientToken };
};

class ZapiRequestError extends Error {
  status: number;

  details: Record<string, unknown> | null;

  constructor(status: number, message: string, details: Record<string, unknown> | null = null) {
    super(message);
    this.name = 'ZapiRequestError';
    this.status = status;
    this.details = details;
  }
}

const buildCombinedRawPayload = (
  responseBody: unknown,
  override: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  const normalizedResponse =
    responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)
      ? (responseBody as Record<string, unknown>)
      : null;

  if (!override) {
    return normalizedResponse;
  }

  return {
    ...(normalizedResponse ?? {}),
    ...override,
  };
};

const sendZapiAndPersist = async (input: {
  phone: string;
  endpoint: string;
  body: Record<string, unknown>;
  messagePreview: string | null;
  rawPayloadOverride?: Record<string, unknown> | null;
}): Promise<{ chat: WhatsappChat; message: WhatsappMessage }> => {
  const credentials = getZapiCredentials();

  if (!credentials) {
    throw new Error('Credenciais da Z-API não configuradas');
  }

  const { instanceId, token, clientToken } = credentials;
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}${input.endpoint}`;

  let responseBody: Record<string, unknown> | null = null;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify(input.body),
  });

  try {
    responseBody = (await response.json()) as Record<string, unknown>;
  } catch (_error) {
    responseBody = null;
  }

  if (!response.ok) {
    throw new ZapiRequestError(response.status, 'Falha ao enviar mensagem pela Z-API', responseBody);
  }

  const now = new Date();
  const zapiStatus =
    typeof responseBody?.status === 'string' ? (responseBody.status as string) : 'SENT';
  const messageId =
    typeof responseBody?.messageId === 'string' ? (responseBody.messageId as string) : null;
  const responsePhone =
    typeof responseBody?.phone === 'string' && responseBody.phone
      ? (responseBody.phone as string)
      : input.phone;
  const chatName =
    typeof responseBody?.chatName === 'string' ? (responseBody.chatName as string) : undefined;
  const senderPhoto =
    typeof responseBody?.senderPhoto === 'string' ? (responseBody.senderPhoto as string) : undefined;
  const isGroupChat = responsePhone.endsWith('-group');
  const resolvedSenderPhoto = isGroupChat ? undefined : senderPhoto;

  const chat = await upsertChatRecord({
    phone: responsePhone,
    chatName,
    senderPhoto: resolvedSenderPhoto,
    isGroup: isGroupChat,
    lastMessageAt: now,
    lastMessagePreview: input.messagePreview ?? null,
  });

  const mergedRawPayload = buildCombinedRawPayload(responseBody, input.rawPayloadOverride);

  const message = await insertWhatsappMessage({
    chatId: chat.id,
    messageId,
    fromMe: true,
    status: zapiStatus,
    text: input.messagePreview,
    moment: now,
    rawPayload: mergedRawPayload,
  });

  return { chat, message };
};

const normalizePhoneIdentifier = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.endsWith('-group')) {
    return trimmed;
  }

  const withoutAt = trimmed.includes('@') ? trimmed.slice(0, trimmed.indexOf('@')) : trimmed;
  if (withoutAt.endsWith('-group')) {
    return withoutAt;
  }

  const digitsOnly = withoutAt.replace(/\D+/g, '');

  if (digitsOnly.length >= 5) {
    return digitsOnly;
  }

  return null;
};

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const resolvePhoneFromPayload = (payload: ZapiWebhookPayload): string | null => {
  const candidates = [payload.phone, payload.chatLid, payload.chatName];

  for (const candidate of candidates) {
    const normalized = normalizePhoneIdentifier(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const normalizeDigitsOnly = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, '');
  return digits.length > 0 ? digits : null;
};

const buildPhoneVariants = (value: string): string[] => {
  const normalized = normalizeDigitsOnly(value);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>();
  variants.add(normalized);

  if (normalized.startsWith('55') && normalized.length > 2) {
    variants.add(normalized.slice(2));
  } else if (!normalized.startsWith('55') && normalized.length >= 10) {
    variants.add(`55${normalized}`);
  }

  return Array.from(variants);
};

const findLeadSummaryForPhone = (
  normalizedPhone: string | null,
  leadsMap: Map<string, ChatLeadSummary>,
): ChatLeadSummary | null => {
  if (!normalizedPhone || normalizedPhone.endsWith('-group')) {
    return null;
  }

  for (const variant of buildPhoneVariants(normalizedPhone)) {
    const summary = leadsMap.get(variant);
    if (summary) {
      return summary;
    }
  }

  return null;
};

const buildIlikePattern = (digits: string): string | null => {
  const normalized = normalizeDigitsOnly(digits);
  if (!normalized) {
    return null;
  }

  return `*${normalized.split('').join('*')}*`;
};

const formatPhoneForDisplay = (digits: string | null): string | null => {
  if (!digits) {
    return null;
  }

  if (digits.startsWith('55')) {
    const areaCode = digits.slice(2, 4);
    const localPart = digits.slice(4);

    if (areaCode.length === 2 && localPart.length >= 4) {
      const prefixLength = localPart.length === 9
        ? 5
        : localPart.length === 8
          ? 4
          : Math.max(1, localPart.length - 4);
      const prefix = localPart.slice(0, prefixLength);
      const suffix = localPart.slice(prefix.length);

      if (suffix) {
        return `+55 ${areaCode} ${prefix}-${suffix}`;
      }

      return `+55 ${areaCode} ${prefix}`;
    }
  }

  if (digits.length > 4) {
    const prefix = digits.slice(0, digits.length - 4);
    const suffix = digits.slice(-4);
    return `+${prefix}-${suffix}`;
  }

  return `+${digits}`;
};

const MAX_CONTACT_PAGES = 10;
const CONTACTS_PAGE_SIZE = 500;

const fetchZapiContacts = async (): Promise<ZapiContact[]> => {
  const credentials = getZapiCredentials();

  if (!credentials) {
    return [];
  }

  const { instanceId, token, clientToken } = credentials;
  const contacts: ZapiContact[] = [];

  for (let page = 1; page <= MAX_CONTACT_PAGES; page += 1) {
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/contacts?page=${page}&pageSize=${CONTACTS_PAGE_SIZE}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Client-Token': clientToken },
      });

      if (!response.ok) {
        console.error('Falha ao carregar contatos da Z-API:', response.status, response.statusText);
        break;
      }

      const pageData = (await response.json()) as unknown;

      if (!Array.isArray(pageData) || pageData.length === 0) {
        break;
      }

      contacts.push(...(pageData as ZapiContact[]));

      if (pageData.length < CONTACTS_PAGE_SIZE) {
        break;
      }
    } catch (error) {
      console.error('Erro ao buscar contatos da Z-API:', error);
      break;
    }
  }

  return contacts;
};

const buildContactsMap = async (): Promise<Map<string, ZapiContact>> => {
  const contacts = await fetchZapiContacts();
  const map = new Map<string, ZapiContact>();

  for (const contact of contacts) {
    const normalized = normalizePhoneIdentifier(contact.phone ?? null);

    if (!normalized || normalized.endsWith('-group')) {
      continue;
    }

    if (!map.has(normalized)) {
      map.set(normalized, contact);
    }
  }

  return map;
};

const fetchLeadSummariesByPhones = async (
  phones: string[],
): Promise<Map<string, ChatLeadSummary>> => {
  const leadsMap = new Map<string, ChatLeadSummary>();

  if (phones.length === 0) {
    return leadsMap;
  }

  const variantSet = new Set<string>();
  for (const phone of phones) {
    for (const variant of buildPhoneVariants(phone)) {
      variantSet.add(variant);
    }
  }

  const variants = Array.from(variantSet);
  if (variants.length === 0) {
    return leadsMap;
  }

  const conditions: string[] = [];

  for (const variant of variants) {
    conditions.push(`telefone.eq.${variant}`);
    const likePattern = buildIlikePattern(variant);
    if (likePattern) {
      conditions.push(`telefone.ilike.${likePattern}`);
    }
  }

  const conditionChunks: string[][] = [];
  const CHUNK_SIZE = 20;
  for (let index = 0; index < conditions.length; index += CHUNK_SIZE) {
    conditionChunks.push(conditions.slice(index, index + CHUNK_SIZE));
  }

  try {
    for (const chunk of conditionChunks) {
      if (chunk.length === 0) {
        continue;
      }

      const query = supabaseAdmin
        .from('leads')
        .select(
          'id, telefone, nome_completo, status, responsavel, ultimo_contato, proximo_retorno, updated_at',
        )
        .or(chunk.join(','))
        .returns<LeadSummaryRecord[]>();

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      for (const lead of data ?? []) {
        const normalizedPhone = normalizeDigitsOnly(lead.telefone ?? null);
        const summary: ChatLeadSummary = {
          id: lead.id,
          nome_completo:
            typeof lead.nome_completo === 'string' && lead.nome_completo.trim().length > 0
              ? lead.nome_completo.trim()
              : null,
          telefone:
            typeof lead.telefone === 'string' && lead.telefone.trim().length > 0
              ? lead.telefone.trim()
              : null,
          status:
            typeof lead.status === 'string' && lead.status.trim().length > 0
              ? lead.status.trim()
              : null,
          responsavel:
            typeof lead.responsavel === 'string' && lead.responsavel.trim().length > 0
              ? lead.responsavel.trim()
              : null,
          ultimo_contato:
            typeof lead.ultimo_contato === 'string' && lead.ultimo_contato.trim().length > 0
              ? lead.ultimo_contato
              : null,
          proximo_retorno:
            typeof lead.proximo_retorno === 'string' && lead.proximo_retorno.trim().length > 0
              ? lead.proximo_retorno
              : null,
        };

        if (!normalizedPhone) {
          continue;
        }

        for (const variant of buildPhoneVariants(normalizedPhone)) {
          if (!leadsMap.has(variant)) {
            leadsMap.set(variant, summary);
          }
        }
      }
    }
  } catch (error) {
    console.error('Erro ao buscar leads para nomes de chats:', error);
  }

  return leadsMap;
};

const fetchContractSummariesByLeadIds = async (
  leadIds: string[],
): Promise<{
  contractsByLeadId: Map<string, ChatContractSummary[]>;
  financialSummaryByLeadId: Map<string, ChatFinancialSummary>;
}> => {
  const contractsByLeadId = new Map<string, ChatContractSummary[]>();
  const financialSummaryByLeadId = new Map<string, ChatFinancialSummary>();

  if (!supabaseAdmin || leadIds.length === 0) {
    return { contractsByLeadId, financialSummaryByLeadId };
  }

  const uniqueLeadIds = Array.from(new Set(leadIds.filter(Boolean)));
  if (uniqueLeadIds.length === 0) {
    return { contractsByLeadId, financialSummaryByLeadId };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('contracts')
      .select(
        'id, lead_id, codigo_contrato, status, modalidade, operadora, produto_plano, mensalidade_total, comissao_prevista, comissao_recebimento_adiantado, responsavel, previsao_recebimento_comissao, previsao_pagamento_bonificacao, bonus_por_vida_valor, bonus_por_vida_aplicado, vidas',
      )
      .in('lead_id', uniqueLeadIds)
      .order('created_at', { ascending: false })
      .returns<ContractSummaryRecord[]>();

    if (error) {
      throw error;
    }

    for (const record of data ?? []) {
      const leadId = toNonEmptyString(record.lead_id);
      const contractId = toNonEmptyString(record.id);

      if (!leadId || !contractId) {
        continue;
      }

      const mensalidade = toNumberOrNull(record.mensalidade_total);
      const comissao = toNumberOrNull(record.comissao_prevista);
      const comissaoAdiantada = parseBooleanish(record.comissao_recebimento_adiantado);
      const bonusValor = toNumberOrNull(record.bonus_por_vida_valor);
      const vidas = toIntegerOrNull(record.vidas) ?? 0;
      const bonusAplicado = parseBooleanish(record.bonus_por_vida_aplicado) ?? false;

      let bonusTotal: number | null = null;
      if (bonusValor !== null) {
        bonusTotal = bonusAplicado ? bonusValor * (vidas > 0 ? vidas : 1) : bonusValor;
      }

      const summary: ChatContractSummary = {
        id: contractId,
        codigo_contrato: toNonEmptyString(record.codigo_contrato),
        status: toNonEmptyString(record.status),
        modalidade: toNonEmptyString(record.modalidade),
        operadora: toNonEmptyString(record.operadora),
        produto_plano: toNonEmptyString(record.produto_plano),
        mensalidade_total: mensalidade,
        comissao_prevista: comissao,
        comissao_recebimento_adiantado: comissaoAdiantada,
        responsavel: toNonEmptyString(record.responsavel),
        previsao_recebimento_comissao: toIsoStringOrNull(record.previsao_recebimento_comissao),
        previsao_pagamento_bonificacao: toIsoStringOrNull(record.previsao_pagamento_bonificacao),
      };

      const existingContracts = contractsByLeadId.get(leadId) ?? [];
      existingContracts.push(summary);
      contractsByLeadId.set(leadId, existingContracts);

      const currentTotals = financialSummaryByLeadId.get(leadId) ?? {
        total_mensalidade: 0,
        total_comissao: 0,
        total_bonus: 0,
      };

      if (mensalidade !== null) {
        currentTotals.total_mensalidade += mensalidade;
      }

      if (comissao !== null) {
        currentTotals.total_comissao += comissao;
      }

      if (bonusTotal !== null) {
        currentTotals.total_bonus += bonusTotal;
      }

      financialSummaryByLeadId.set(leadId, currentTotals);
    }
  } catch (error) {
    console.error('Erro ao buscar contratos para nomes de chats:', error);
    return { contractsByLeadId, financialSummaryByLeadId };
  }

  return { contractsByLeadId, financialSummaryByLeadId };
};

const fetchChatSlaMetrics = async (): Promise<Map<string, ChatSlaMetrics>> => {
  if (!supabaseAdmin) {
    return new Map();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chat_sla_metrics')
      .select(
        'chat_id, last_inbound_at, last_outbound_at, last_message_at, last_response_ms, pending_inbound_count, waiting_since, waiting_minutes, sla_status',
      );

    if (error) {
      throw error;
    }

    const metricsMap = new Map<string, ChatSlaMetrics>();
    for (const record of data ?? []) {
      const normalized = record as ChatSlaMetrics;
      metricsMap.set(normalized.chat_id, normalized);
    }

    return metricsMap;
  } catch (error) {
    console.error('Erro ao carregar métricas de SLA dos chats do WhatsApp:', error);
    return new Map();
  }
};

const resolveContactDisplayName = (contact: ZapiContact | undefined): string | null => {
  if (!contact) {
    return null;
  }

  const candidates = [contact.short, contact.name, contact.vname, contact.notify];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
};

const resolveChatDisplayName = (
  chat: WhatsappChat,
  contactMap: Map<string, ZapiContact>,
  leadsMap: Map<string, ChatLeadSummary>,
): string | null => {
  if (chat.is_group) {
    return chat.chat_name ?? null;
  }

  const normalizedPhone = normalizePhoneIdentifier(chat.phone);

  if (!normalizedPhone || normalizedPhone.endsWith('-group')) {
    return chat.chat_name ?? chat.phone ?? null;
  }

  const contactName = resolveContactDisplayName(contactMap.get(normalizedPhone));
  if (contactName) {
    return contactName;
  }

  const leadSummary = findLeadSummaryForPhone(normalizedPhone, leadsMap);
  if (leadSummary?.nome_completo) {
    return leadSummary.nome_completo;
  }

  return formatPhoneForDisplay(normalizedPhone) ?? chat.chat_name ?? chat.phone ?? null;
};

const persistReceivedMessage = async (
  payload: ZapiWebhookPayload,
  options?: { overridePhone?: string | null; originalPhone?: string | null }
): Promise<{ chat: WhatsappChat; message: WhatsappMessage }> => {
  const phoneFromPayload = typeof payload.phone === 'string' ? payload.phone : undefined;
  const normalizedOverride = normalizePhoneIdentifier(options?.overridePhone ?? null);
  const phone = normalizedOverride ?? normalizePhoneIdentifier(phoneFromPayload) ?? undefined;
  const originalPhone = options?.originalPhone ?? phoneFromPayload ?? null;

  if (!phone) {
    throw new Error('Campo phone é obrigatório');
  }

  const messageText = resolveMessageText(payload);
  const momentDate = parseMoment(payload.momment) ?? new Date();
  const isGroup = payload.isGroup === true || phone.endsWith('-group');
  const chatName = payload.chatName ?? payload.senderName ?? phone;
  const senderPhoto = payload.senderPhoto ?? null;
  const resolvedSenderPhoto = isGroup ? undefined : senderPhoto;

  const chat = await upsertChatRecord({
    phone,
    chatName,
    isGroup,
    senderPhoto: resolvedSenderPhoto,
    lastMessageAt: momentDate,
    lastMessagePreview: messageText,
  });

  const normalizedRawPayload: Record<string, any> = {
    ...(payload as Record<string, any>),
    phone,
  };

  if (phone && originalPhone && phone !== originalPhone) {
    normalizedRawPayload._originalPhone = originalPhone;
  }

  const message = await insertWhatsappMessage({
    chatId: chat.id,
    messageId: typeof payload.messageId === 'string' ? payload.messageId : null,
    fromMe: payload.fromMe === true,
    status: typeof payload.status === 'string' ? payload.status : null,
    text: messageText,
    moment: momentDate,
    rawPayload: normalizedRawPayload,
  });

  return { chat, message };
};

const upsertChatRecord = async (input: {
  phone: string;
  chatName?: string | null;
  isGroup?: boolean;
  senderPhoto?: string | null;
  lastMessageAt?: Date | string | number | null;
  lastMessagePreview?: string | null;
}): Promise<WhatsappChat> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const {
    phone,
    chatName,
    isGroup,
    senderPhoto,
    lastMessageAt,
    lastMessagePreview,
  } = input;

  if (!phone) {
    throw new Error('Phone number is required to upsert a WhatsApp chat');
  }

  const { data: existingChat, error: fetchError } = await supabaseAdmin
    .from('whatsapp_chats')
    .select('*')
    .eq('phone', phone)
    .maybeSingle<WhatsappChat>();

  if (fetchError) {
    throw fetchError;
  }

  const normalizedLastMessageAt = toIsoStringOrNull(lastMessageAt);
  const updatePayload: Record<string, unknown> = {
    last_message_at: normalizedLastMessageAt,
    last_message_preview: lastMessagePreview ?? null,
  };

  if (typeof isGroup === 'boolean') {
    updatePayload.is_group = isGroup;
  }

  if (chatName !== undefined) {
    updatePayload.chat_name = chatName;
  }

  if (senderPhoto !== undefined) {
    updatePayload.sender_photo = senderPhoto;
  }

  if (existingChat) {
    const { error: updateError } = await supabaseAdmin
      .from('whatsapp_chats')
      .update(updatePayload)
      .eq('id', existingChat.id);

    if (updateError) {
      throw updateError;
    }

    return {
      ...existingChat,
      chat_name: updatePayload.chat_name ?? (existingChat.chat_name ?? null),
      sender_photo: updatePayload.sender_photo ?? (existingChat.sender_photo ?? null),
      is_group:
        typeof updatePayload.is_group === 'boolean' ? Boolean(updatePayload.is_group) : existingChat.is_group,
      last_message_at: normalizedLastMessageAt,
      last_message_preview:
        typeof updatePayload.last_message_preview === 'string'
          ? (updatePayload.last_message_preview as string)
          : existingChat.last_message_preview,
    };
  }

  const { data: insertedChat, error: insertError } = await supabaseAdmin
    .from('whatsapp_chats')
    .insert({
      phone,
      chat_name: chatName ?? null,
      last_message_at: normalizedLastMessageAt,
      last_message_preview: lastMessagePreview ?? null,
      is_group: Boolean(isGroup),
      sender_photo: senderPhoto ?? null,
      is_archived: false,
      is_pinned: false,
    })
    .select('*')
    .single<WhatsappChat>();

  if (insertError) {
    throw insertError;
  }

  if (!insertedChat) {
    throw new Error('Failed to insert WhatsApp chat');
  }

  return insertedChat;
};

const normalizeMessageStatus = (
  status: string | null | undefined,
  fromMe: boolean,
): string | null => {
  if (!status) {
    return null;
  }

  if (fromMe && status.toUpperCase() === 'RECEIVED') {
    return 'SENT';
  }

  return status;
};

const insertWhatsappMessage = async (input: {
  chatId: string;
  messageId?: string | null;
  fromMe: boolean;
  status?: string | null;
  text?: string | null;
  moment?: Date | string | number | null;
  rawPayload?: Record<string, any> | null;
}): Promise<WhatsappMessage> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const { chatId, messageId, fromMe, status, text, moment, rawPayload } = input;

  if (!chatId) {
    throw new Error('chatId is required to insert a WhatsApp message');
  }

  const normalizedMoment = toIsoStringOrNull(moment);
  const normalizedStatus = normalizeMessageStatus(status, fromMe);

  const { data: insertedMessage, error: insertError } = await supabaseAdmin
    .from('whatsapp_messages')
    .insert({
      chat_id: chatId,
      message_id: messageId ?? null,
      from_me: fromMe,
      status: normalizedStatus,
      text: text ?? null,
      moment: normalizedMoment,
      raw_payload: rawPayload ?? null,
    })
    .select('*')
    .single<WhatsappMessage>();

  if (insertError) {
    throw insertError;
  }

  if (!insertedMessage) {
    throw new Error('Failed to insert WhatsApp message');
  }

  return insertedMessage;
};

const updateExistingWhatsappMessagesStatus = async (status: string, messageIds: string[]) => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const normalizedIds = (messageIds ?? []).map((id) => id?.toString().trim()).filter(Boolean) as string[];

  if (normalizedIds.length === 0) {
    return { updated: 0, missingIds: [] as string[] };
  }

  const { data: messages, error: fetchError } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id, message_id, from_me')
    .in('message_id', normalizedIds)
    .returns<Pick<WhatsappMessage, 'id' | 'message_id' | 'from_me'>[]>();

  if (fetchError) {
    throw fetchError;
  }

  const foundIds = new Set<string>();
  const updatesByStatus = new Map<string, string[]>();

  for (const message of messages ?? []) {
    if (message.message_id) {
      foundIds.add(message.message_id);
    }

    const normalizedStatus = normalizeMessageStatus(status, message.from_me);

    if (!normalizedStatus) {
      continue;
    }

    const rows = updatesByStatus.get(normalizedStatus) ?? [];
    rows.push(message.id);
    updatesByStatus.set(normalizedStatus, rows);
  }

  let updated = 0;

  for (const [nextStatus, rowIds] of updatesByStatus.entries()) {
    if (rowIds.length === 0) {
      continue;
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('whatsapp_messages')
      .update({ status: nextStatus })
      .in('id', rowIds)
      .select('id');

    if (updateError) {
      throw updateError;
    }

    updated += data?.length ?? 0;
  }

  const missingIds = normalizedIds.filter((id) => !foundIds.has(id));

  return { updated, missingIds };
};

const deleteWhatsappMessagesByMessageId = async (messageId: string): Promise<number> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase client não configurado');
  }

  const trimmedId = messageId.trim();
  if (!trimmedId) {
    return 0;
  }

  const { error, count } = await supabaseAdmin
    .from('whatsapp_messages')
    .delete({ count: 'exact' })
    .eq('message_id', trimmedId);

  if (error) {
    throw error;
  }

  return count ?? 0;
};

const handleOnMessageStatus = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  cleanupPendingEntries();

  const payload = (await ensureJsonBody<ZapiWebhookPayload>(req)) ?? {};

  try {
    logWebhookPayload('whatsapp-webhook on-message-status payload:', payload);
  } catch (_error) {
    console.error('Não foi possível registrar o payload do webhook de status.');
  }

  const status = normalizeStatusValue(payload.status);
  const messageIds = resolveStatusWebhookIds(payload);
  const isStatusPayload = payload.type === 'MessageStatusCallback' || messageIds.length > 0;

  if (!isStatusPayload) {
    return respondJson(200, { success: true, ignored: true });
  }

  if (!status || messageIds.length === 0) {
    return respondJson(400, { success: false, error: 'Campos status e ids são obrigatórios' });
  }

  try {
    const { updated, missingIds } = await updateExistingWhatsappMessagesStatus(status, messageIds);
    return respondJson(200, { success: true, status, updated, missingIds });
  } catch (error) {
    console.error('Erro ao processar webhook da Z-API:', error);
    return respondJson(500, { success: false, error: 'Falha ao processar webhook' });
  }
};

const handleOnMessageReceived = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  cleanupPendingEntries();

  const payload = (await ensureJsonBody<ZapiWebhookPayload>(req)) ?? {};

  try {
    logWebhookPayload('whatsapp-webhook on-message-received payload:', payload);
  } catch (_error) {
    console.error('Não foi possível registrar o payload do webhook recebido.');
  }

  if (payload.type !== 'ReceivedCallback') {
    return respondJson(200, { success: true, ignored: true });
  }

  const fromMe = payload.fromMe === true;
  const messageId = typeof payload.messageId === 'string' ? payload.messageId : undefined;

  try {
    if (fromMe) {
      if (!messageId) {
        return respondJson(400, {
          success: false,
          error: 'Campo messageId é obrigatório para mensagens enviadas pelo próprio número',
        });
      }

      const pendingSend = pendingSendPayloads.get(messageId);
      const pendingPhone = pendingSend?.phone;

      if (pendingSend && typeof pendingPhone === 'string') {
        try {
          const resolvedPhone = normalizePhoneIdentifier(pendingPhone) ?? pendingPhone;
          const { chat, message } = await persistReceivedMessage(payload, {
            overridePhone: resolvedPhone,
            originalPhone: typeof payload.phone === 'string' ? payload.phone : null,
          });
          pendingReceivedFromMeMessages.delete(messageId);
          pendingSendPayloads.delete(messageId);

          return respondJson(200, { success: true, chat, message, matched: true });
        } catch (error) {
          console.error('Erro ao persistir mensagem enviada (resolução via received):', error);
          return respondJson(500, { success: false, error: 'Falha ao processar webhook' });
        }
      }

      const derivedPhone = resolvePhoneFromPayload(payload);

      if (derivedPhone) {
        try {
          const { chat, message } = await persistReceivedMessage(payload, {
            overridePhone: derivedPhone,
            originalPhone: typeof payload.phone === 'string' ? payload.phone : null,
          });
          pendingSendPayloads.delete(messageId);

          return respondJson(200, { success: true, chat, message, matched: false, derived: true });
        } catch (error) {
          console.error('Erro ao persistir mensagem enviada (derivação local):', error);
          return respondJson(500, { success: false, error: 'Falha ao processar webhook' });
        }
      }

      pendingReceivedFromMeMessages.set(messageId, {
        payload,
        receivedAt: Date.now(),
      });

      return respondJson(200, { success: true, deferred: true });
    }

    const { chat, message } = await persistReceivedMessage(payload, {
      originalPhone: typeof payload.phone === 'string' ? payload.phone : null,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Campo phone é obrigatório') {
      console.error('Payload recebido sem phone válido:', error);
      return respondJson(400, { success: false, error: error.message });
    }

    console.error('Erro ao processar webhook da Z-API:', error);
    return respondJson(500, { success: false, error: 'Falha ao processar webhook' });
  }
};

const handleOnMessageSend = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  cleanupPendingEntries();

  const payload = (await ensureJsonBody<Record<string, unknown>>(req)) ?? {};

  try {
    logWebhookPayload('whatsapp-webhook on-message-send payload:', payload);
  } catch (_error) {
    console.error('Não foi possível registrar o payload do webhook de envio.');
  }

  const messageId = typeof payload?.messageId === 'string' ? (payload.messageId as string) : undefined;
  const phone = typeof payload?.phone === 'string' ? (payload.phone as string) : undefined;

  if (!messageId) {
    return respondJson(400, { success: false, error: 'Campo messageId é obrigatório' });
  }

  if (!phone) {
    return respondJson(400, { success: false, error: 'Campo phone é obrigatório' });
  }

  const pendingReceived = pendingReceivedFromMeMessages.get(messageId);

  if (pendingReceived) {
    try {
      const { chat, message } = await persistReceivedMessage(pendingReceived.payload, {
        overridePhone: phone,
        originalPhone:
          typeof pendingReceived.payload?.phone === 'string' ? pendingReceived.payload.phone : null,
      });
      pendingReceivedFromMeMessages.delete(messageId);
      pendingSendPayloads.delete(messageId);

      return respondJson(200, { success: true, chat, message, matched: true });
    } catch (error) {
      console.error('Erro ao persistir mensagem enviada (resolução via send):', error);
      return respondJson(500, { success: false, error: 'Falha ao processar webhook' });
    }
  }

  pendingSendPayloads.set(messageId, { payload, phone, receivedAt: Date.now() });

  return respondJson(200, { success: true, deferred: true });
};

const handleSendMessage = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendMessageBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!phone || !message) {
    return respondJson(400, { success: false, error: 'Os campos phone e message são obrigatórios' });
  }
  try {
    const { chat, message: insertedMessage } = await sendZapiAndPersist({
      phone,
      endpoint: '/send-text',
      body: { phone, message },
      messagePreview: message,
    });

    return respondJson(200, { success: true, message: insertedMessage, chat });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao enviar mensagem pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar mensagem' });
  }
};

const handleDeleteMessage = async (req: Request) => {
  if (!['POST', 'DELETE'].includes(req.method)) {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const { searchParams } = new URL(req.url);
  const body = req.method === 'DELETE' ? null : (await ensureJsonBody<DeleteMessageBody>(req));
  const rawMessageId = body?.messageId ?? searchParams.get('messageId');
  const rawPhone = body?.phone ?? searchParams.get('phone');
  const rawOwner = body?.owner ?? searchParams.get('owner');

  const messageId = typeof rawMessageId === 'string' ? rawMessageId.trim() : '';
  const phone = normalizePhoneIdentifier(rawPhone);
  const owner = normalizeBoolean(rawOwner);

  if (!messageId) {
    return respondJson(400, { success: false, error: 'Campo messageId é obrigatório' });
  }

  if (!phone) {
    return respondJson(400, { success: false, error: 'Campo phone é obrigatório' });
  }

  if (owner === null) {
    return respondJson(400, { success: false, error: 'Campo owner é obrigatório' });
  }

  if (!getZapiCredentials()) {
    return respondJson(500, { success: false, error: 'Credenciais da Z-API não configuradas' });
  }

  const { instanceId, token, clientToken } = credentials;
  const searchParams = new URLSearchParams({
    messageId,
    phone,
    owner: owner ? 'true' : 'false',
  });

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/messages?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Client-Token': clientToken },
    });

    const rawBody = await response.text().catch(() => '');
    let responseBody: unknown = null;
    try {
      responseBody = rawBody ? JSON.parse(rawBody) : null;
    } catch (_error) {
      responseBody = rawBody || null;
    }

    if (!response.ok) {
      throw new ZapiRequestError(response.status, 'Falha ao apagar mensagem na Z-API', responseBody);
    }

    const removed = await deleteWhatsappMessagesByMessageId(messageId);

    return respondJson(200, {
      success: true,
      removedLocalMessages: removed,
    });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details,
      });
    }

    console.error('Erro ao apagar mensagem pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro ao apagar mensagem' });
  }
};

const handleSendDocument = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendDocumentBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const document = typeof body.document === 'string' ? body.document.trim() : '';

  if (!phone || !document) {
    return respondJson(400, { success: false, error: 'Os campos phone e document são obrigatórios' });
  }

  const fileName = toNonEmptyString(body.fileName);
  const caption = toNonEmptyString(body.caption);
  const rawExtension =
    toNonEmptyString(body.extension) ??
    extractExtensionFromFileName(fileName ?? null) ??
    extractExtensionFromDataUrl(document);
  const extension = sanitizeExtension(rawExtension);

  if (!extension) {
    return respondJson(400, {
      success: false,
      error: 'Não foi possível determinar a extensão do arquivo. Informe o campo extension.',
    });
  }

  const requestBody: Record<string, unknown> = { phone, document };

  if (fileName) {
    requestBody.fileName = fileName;
  }

  if (caption) {
    requestBody.caption = caption;
  }

  try {
    const previewText = caption ?? (fileName ? `📄 ${fileName}` : '📄 Documento enviado');
    const rawPayloadOverride: Record<string, unknown> = {
      document: {
        documentUrl: document,
        fileName: fileName ?? null,
        title: fileName ?? null,
        caption: caption ?? null,
      },
    };

    const { chat, message } = await sendZapiAndPersist({
      phone,
      endpoint: `/send-document/${extension}`,
      body: requestBody,
      messagePreview: previewText,
      rawPayloadOverride,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao enviar documento pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar documento' });
  }
};

const handleSendImage = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendImageBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const image = typeof body.image === 'string' ? body.image.trim() : '';

  if (!phone || !image) {
    return respondJson(400, { success: false, error: 'Os campos phone e image são obrigatórios' });
  }

  const caption = toNonEmptyString(body.caption);
  const requestBody: Record<string, unknown> = { phone, image };

  if (caption) {
    requestBody.caption = caption;
  }

  if (typeof body.viewOnce === 'boolean') {
    requestBody.viewOnce = body.viewOnce;
  }

  try {
    const previewText = caption ?? '🖼️ Imagem enviada';
    const rawPayloadOverride: Record<string, unknown> = {
      image: {
        imageUrl: image,
        caption: caption ?? null,
      },
    };

    const { chat, message } = await sendZapiAndPersist({
      phone,
      endpoint: '/send-image',
      body: requestBody,
      messagePreview: previewText,
      rawPayloadOverride,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao enviar imagem pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar imagem' });
  }
};

const handleSendVideo = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendVideoBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const video = typeof body.video === 'string' ? body.video.trim() : '';

  if (!phone || !video) {
    return respondJson(400, { success: false, error: 'Os campos phone e video são obrigatórios' });
  }

  const caption = toNonEmptyString(body.caption);
  const requestBody: Record<string, unknown> = { phone, video };

  if (caption) {
    requestBody.caption = caption;
  }

  if (typeof body.viewOnce === 'boolean') {
    requestBody.viewOnce = body.viewOnce;
  }

  if (typeof body.async === 'boolean') {
    requestBody.async = body.async;
  }

  try {
    const previewText = caption ?? '🎬 Vídeo enviado';
    const rawPayloadOverride: Record<string, unknown> = {
      video: {
        videoUrl: video,
        caption: caption ?? null,
      },
    };

    const { chat, message } = await sendZapiAndPersist({
      phone,
      endpoint: '/send-video',
      body: requestBody,
      messagePreview: previewText,
      rawPayloadOverride,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao enviar vídeo pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar vídeo' });
  }
};

const handleSendAudio = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendAudioBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const audio = typeof body.audio === 'string' ? body.audio.trim() : '';

  if (!phone || !audio) {
    return respondJson(400, { success: false, error: 'Os campos phone e audio são obrigatórios' });
  }

  const parsedSeconds =
    typeof body.seconds === 'number' && Number.isFinite(body.seconds) && body.seconds >= 0
      ? Number(body.seconds.toFixed(2))
      : null;
  const parsedDuration =
    typeof body.duration === 'number' && Number.isFinite(body.duration) && body.duration >= 0
      ? Number(body.duration.toFixed(2))
      : null;
  const seconds = parsedSeconds ?? parsedDuration;
  const ptt = typeof body.ptt === 'boolean' ? body.ptt : true;

  const providedMimeType = toNonEmptyString(body.mimeType);

  let audioUrl = audio;
  let normalizedMimeType: string | null = null;

  try {
    const audioFile = await downloadAudioFile(audio);
    const uploadResult = await uploadAudioToTemporaryStorage(audioFile, providedMimeType);
    audioUrl = uploadResult.signedUrl;
    normalizedMimeType = uploadResult.mimeType;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao preparar o áudio para envio.';
    return respondJson(400, { success: false, error: message });
  }

  const requestBody: Record<string, unknown> = { phone, audio: audioUrl, ptt };

  if (seconds !== null) {
    requestBody.seconds = seconds;
    requestBody.duration = seconds;
  }

  if (normalizedMimeType) {
    requestBody.mimeType = normalizedMimeType;
  }

  try {
    const rawPayloadOverride: Record<string, unknown> = {
      audio: {
        audioUrl,
        seconds,
        duration: seconds,
        mimeType: normalizedMimeType ?? null,
        ptt,
      },
    };

    const { chat, message } = await sendZapiAndPersist({
      phone,
      endpoint: '/send-audio',
      body: requestBody,
      messagePreview: '🎤 Áudio enviado',
      rawPayloadOverride,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao enviar áudio pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar áudio' });
  }
};

const handleTranscribeAudio = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<TranscribeAudioBody>(req)) ?? {};
  const audioUrl = toNonEmptyString(body.audioUrl);

  if (!audioUrl) {
    return respondJson(400, { success: false, error: 'Campo audioUrl é obrigatório' });
  }

  try {
    const transcription = await transcribeAudioFromUrl(audioUrl);
    return respondJson(200, { success: true, transcription });
  } catch (error) {
    console.error('Erro ao transcrever áudio com GPT:', error);
    const message = error instanceof Error ? error.message : 'Erro ao transcrever áudio';
    return respondJson(500, { success: false, error: message });
  }
};

const handleRewriteMessage = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<RewriteMessageBody>(req)) ?? {};
  const text = toNonEmptyString(body.text);

  if (!text) {
    return respondJson(400, { success: false, error: 'Campo text é obrigatório para reescrever.' });
  }

  try {
    const rewrittenVersions = await rewriteMessageWithGpt(text);
    return respondJson(200, { success: true, rewrittenVersions });
  } catch (error) {
    console.error('Erro ao reescrever mensagem com GPT:', error);
    const message = error instanceof Error ? error.message : 'Erro ao reescrever a mensagem';
    return respondJson(500, { success: false, error: message });
  }
};

const handleSendLocation = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendLocationBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const title = toNonEmptyString(body.title);
  const address = toNonEmptyString(body.address);
  const latitude = toNonEmptyString(body.latitude);
  const longitude = toNonEmptyString(body.longitude);

  if (!phone || !title || !address || !latitude || !longitude) {
    return respondJson(400, {
      success: false,
      error:
        'Os campos phone, title, address, latitude e longitude são obrigatórios para enviar localização.',
    });
  }

  const requestBody: Record<string, unknown> = {
    phone,
    title,
    address,
    latitude,
    longitude,
  };

  try {
    const previewText = `📍 ${title}`;
    const rawPayloadOverride: Record<string, unknown> = {
      location: {
        title,
        address,
        latitude,
        longitude,
      },
    };

    const { chat, message } = await sendZapiAndPersist({
      phone,
      endpoint: '/send-location',
      body: requestBody,
      messagePreview: previewText,
      rawPayloadOverride,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao enviar localização pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar localização' });
  }
};

const handleSendContact = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = (await ensureJsonBody<SendContactBody>(req)) ?? {};
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const contactName = toNonEmptyString(body.contactName);
  const contactPhone = toNonEmptyString(body.contactPhone);
  const businessDescription = toNonEmptyString(body.contactBusinessDescription);

  if (!phone || !contactName || !contactPhone) {
    return respondJson(400, {
      success: false,
      error: 'Os campos phone, contactName e contactPhone são obrigatórios para enviar contato.',
    });
  }

  const requestBody: Record<string, unknown> = {
    phone,
    contactName,
    contactPhone,
  };

  if (businessDescription) {
    requestBody.contactBusinessDescription = businessDescription;
  }

  if (typeof body.delayMessage === 'number' && Number.isFinite(body.delayMessage)) {
    const normalizedDelay = Math.max(1, Math.min(15, Math.floor(body.delayMessage)));
    requestBody.delayMessage = normalizedDelay;
  }

  try {
    const previewText = `👤 ${contactName}`;
    const rawPayloadOverride: Record<string, unknown> = {
      contacts: [
        {
          name: contactName,
          phones: [contactPhone],
          businessDescription: businessDescription ?? null,
        },
      ],
    };

    const { chat, message } = await sendZapiAndPersist({
      phone,
      endpoint: '/send-contact',
      body: requestBody,
      messagePreview: previewText,
      rawPayloadOverride,
    });

    return respondJson(200, { success: true, chat, message });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao enviar contato pela Z-API:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao enviar contato' });
  }
};

const handleListContacts = async (req: Request) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const credentials = getZapiCredentials();

  if (!credentials) {
    return respondJson(500, { success: false, error: 'Credenciais da Z-API não configuradas' });
  }

  try {
    const contactsMap = await buildContactsMap();
    const normalizedContacts: WhatsappContactSummary[] = [];

    for (const [phone, entry] of contactsMap.entries()) {

      if (!phone) {
        continue;
      }

      const name =
        toNonEmptyString((entry as { name?: unknown }).name) ??
        toNonEmptyString((entry as { shortName?: unknown }).shortName) ??
        toNonEmptyString((entry as { businessName?: unknown }).businessName) ??
        null;

      const isBusiness = (() => {
        const rawIsBusiness = (entry as { isBusiness?: unknown }).isBusiness;
        if (typeof rawIsBusiness === 'boolean') {
          return rawIsBusiness;
        }

        const typeText = toNonEmptyString((entry as { type?: unknown }).type);
        if (!typeText) {
          return false;
        }

        const normalizedType = typeText.toLowerCase();
        return normalizedType.includes('business') || normalizedType.includes('empresa');
      })();

      normalizedContacts.push({ phone, name, isBusiness });
    }

    normalizedContacts.sort((first, second) => {
      const firstName = first.name ?? '';
      const secondName = second.name ?? '';

      if (firstName && secondName) {
        return firstName.localeCompare(secondName, 'pt-BR');
      }

      if (firstName) {
        return -1;
      }

      if (secondName) {
        return 1;
      }

      return first.phone.localeCompare(second.phone, 'pt-BR');
    });

    return respondJson(200, { contacts: normalizedContacts });
  } catch (error) {
    if (error instanceof ZapiRequestError) {
      return respondJson(error.status, {
        success: false,
        error: error.message,
        details: error.details ?? undefined,
      });
    }

    console.error('Erro ao listar contatos do WhatsApp:', error);
    return respondJson(500, {
      success: false,
      error: 'Não foi possível carregar os contatos do WhatsApp',
    });
  }
};

const handleEnsureChat = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  const body = await ensureJsonBody<{ phone?: string; chatName?: string | null }>(req);
  const phone = normalizePhoneIdentifier(body?.phone ?? null);

  if (!phone) {
    return respondJson(400, {
      success: false,
      error: 'Informe um telefone válido para criar a conversa.',
    });
  }

  const chatName = toNonEmptyString(body?.chatName);

  try {
    const chat = await upsertChatRecord({
      phone,
      chatName: chatName ?? null,
      isGroup: phone.endsWith('-group'),
      lastMessageAt: null,
      lastMessagePreview: null,
    });

    return respondJson(200, { success: true, chat });
  } catch (error) {
    console.error('Erro ao garantir chat do WhatsApp:', error);
    return respondJson(500, {
      success: false,
      error: 'Não foi possível criar ou atualizar a conversa.',
    });
  }
};

const handleHealthcheck = async (req: Request) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  return respondJson(200, {
    success: true,
    service: 'whatsapp-webhook',
    timestamp: new Date().toISOString(),
  });
};

const handleFetchChatMetadata = async (req: Request, chatId: string) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  const normalizedChatId = chatId.trim();
  if (!normalizedChatId) {
    return respondJson(400, { success: false, error: 'Parâmetro chatId é obrigatório' });
  }

  try {
    const { data: chatRecord, error: fetchError } = await supabaseAdmin
      .from('whatsapp_chats')
      .select('*')
      .eq('id', normalizedChatId)
      .maybeSingle<WhatsappChat>();

    if (fetchError) {
      throw fetchError;
    }

    if (!chatRecord) {
      return respondJson(404, { success: false, error: 'Chat não encontrado' });
    }

    const phoneForApi = normalizePhoneIdentifier(chatRecord.phone);

    if (!phoneForApi) {
      return respondJson(400, {
        success: false,
        error: 'Telefone do chat inválido para buscar metadata',
      });
    }

    const credentials = getZapiCredentials();

    if (!credentials) {
      return respondJson(500, { success: false, error: 'Credenciais da Z-API não configuradas' });
    }

    let metadataResponse: Response;

    try {
      metadataResponse = await fetch(
        `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/chats/${encodeURIComponent(phoneForApi)}`,
        {
          method: 'GET',
          headers: { 'Client-Token': credentials.clientToken },
        },
      );
    } catch (error) {
      console.error('Erro ao buscar metadata do chat na Z-API:', error);
      return respondJson(500, { success: false, error: 'Erro ao buscar metadata do chat na Z-API' });
    }

    let responseBody: unknown = null;
    try {
      responseBody = await metadataResponse.json();
    } catch (_error) {
      responseBody = null;
    }

    if (!metadataResponse.ok) {
      console.error('Falha ao buscar metadata do chat na Z-API:', metadataResponse.status, responseBody);
      return respondJson(metadataResponse.status, {
        success: false,
        error: 'Falha ao buscar metadata do chat na Z-API',
        details:
          responseBody && typeof responseBody === 'object'
            ? (responseBody as Record<string, unknown>)
            : undefined,
      });
    }

    const metadataRecord =
      responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)
        ? (responseBody as ZapiChatMetadata)
        : null;

    const hasProfileThumbnailField =
      metadataRecord ? Object.prototype.hasOwnProperty.call(metadataRecord, 'profileThumbnail') : false;
    const rawProfileThumbnail = hasProfileThumbnailField ? metadataRecord?.profileThumbnail ?? null : undefined;
    const profileThumbnail = toNonEmptyString(rawProfileThumbnail ?? null);
    const isGroupFromMetadata = parseBooleanish(metadataRecord?.isGroup);
    const lastMessageTimestamp = normalizeZapiTimestamp(metadataRecord?.lastMessageTime);

    const resolvedSenderPhoto =
      profileThumbnail ?? (hasProfileThumbnailField ? null : chatRecord.sender_photo ?? null);

    const resolvedIsGroup =
      isGroupFromMetadata !== null
        ? isGroupFromMetadata
        : typeof chatRecord.is_group === 'boolean'
        ? chatRecord.is_group
        : phoneForApi.endsWith('-group')
        ? true
        : undefined;

    const resolvedLastMessageAt = lastMessageTimestamp ?? chatRecord.last_message_at;
    const resolvedLastMessagePreview = chatRecord.last_message_preview;

    const metadataSummary: ChatMetadataSummary | null = metadataRecord
      ? {
          phone: toNonEmptyString(metadataRecord.phone) ?? chatRecord.phone ?? phoneForApi,
          unread: parseInteger(metadataRecord.unread),
          lastMessageTime:
            typeof metadataRecord.lastMessageTime === 'string' || typeof metadataRecord.lastMessageTime === 'number'
              ? metadataRecord.lastMessageTime
              : null,
          lastMessageTimestamp,
          lastMessageAt: lastMessageTimestamp !== null ? toIsoStringOrNull(lastMessageTimestamp) : null,
          isMuted: parseBooleanish(metadataRecord.isMuted),
          isMarkedSpam: parseBooleanish(metadataRecord.isMarkedSpam),
          profileThumbnail: resolvedSenderPhoto,
          isGroupAnnouncement: parseBooleanish(metadataRecord.isGroupAnnouncement),
          isGroup:
            isGroupFromMetadata !== null
              ? isGroupFromMetadata
              : resolvedIsGroup === true
              ? true
              : resolvedIsGroup === false
              ? false
              : null,
          about: toNonEmptyString(metadataRecord.about),
          notes: normalizeMetadataNote(metadataRecord.notes ?? null),
          raw: metadataRecord as Record<string, unknown>,
        }
      : null;

    const updatedChat = await upsertChatRecord({
      phone: chatRecord.phone,
      chatName: chatRecord.chat_name,
      isGroup: resolvedIsGroup,
      senderPhoto: resolvedSenderPhoto,
      lastMessageAt: resolvedLastMessageAt,
      lastMessagePreview: resolvedLastMessagePreview,
    });

    return respondJson(200, {
      success: true,
      metadata: metadataSummary,
      chat: updatedChat,
    });
  } catch (error) {
    console.error('Erro ao atualizar metadata do chat:', error);
    return respondJson(500, { success: false, error: 'Erro interno ao atualizar metadata do chat' });
  }
};

const handleListChats = async (req: Request) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chats')
      .select('*')
      .order('is_archived', { ascending: true })
      .order('is_pinned', { ascending: false })
      .order('last_message_at', { ascending: false });

    if (error) {
      throw error;
    }

    const chats = (data ?? []) as WhatsappChat[];
    const contactMap = await buildContactsMap();
    const phonesToLookup = new Set<string>();

    for (const chat of chats) {
      if (chat.is_group) {
        continue;
      }

      const normalizedPhone = normalizePhoneIdentifier(chat.phone);
      if (normalizedPhone && !normalizedPhone.endsWith('-group')) {
        phonesToLookup.add(normalizedPhone);
      }
    }

    const leadsMap = await fetchLeadSummariesByPhones(Array.from(phonesToLookup));
    const leadIds = Array.from(new Set(Array.from(leadsMap.values()).map(lead => lead.id)));
    const { contractsByLeadId, financialSummaryByLeadId } = await fetchContractSummariesByLeadIds(leadIds);
    const slaMetricsMap = await fetchChatSlaMetrics();

    const enrichedChats = chats.map(chat => {
      const normalizedPhone = normalizePhoneIdentifier(chat.phone);
      const leadSummary = chat.is_group ? null : findLeadSummaryForPhone(normalizedPhone, leadsMap);
      const leadId = leadSummary?.id ?? null;

      return {
        ...chat,
        display_name: resolveChatDisplayName(chat, contactMap, leadsMap),
        crm_lead: leadSummary ? { ...leadSummary } : null,
        crm_contracts: leadId ? contractsByLeadId.get(leadId) ?? [] : [],
        crm_financial_summary: leadId ? financialSummaryByLeadId.get(leadId) ?? null : null,
        sla_metrics: slaMetricsMap.get(chat.id) ?? null,
      };
    });

    return respondJson(200, { chats: enrichedChats });
  } catch (error) {
    console.error('Erro ao listar chats do WhatsApp:', error);
    return respondJson(500, { success: false, error: 'Falha ao carregar chats' });
  }
};

const handleUpdateLeadStatus = async (req: Request) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  const body = (await ensureJsonBody<UpdateLeadStatusBody>(req)) ?? {};
  const leadId = toNonEmptyString(body.leadId);
  const newStatus = toNonEmptyString(body.newStatus);

  if (!leadId) {
    return respondJson(400, {
      success: false,
      error: 'Identificador do lead não informado.',
    });
  }

  if (!newStatus) {
    return respondJson(400, {
      success: false,
      error: 'Informe um status válido para o lead.',
    });
  }

  try {
    const { data: leadRecord, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('id, status, responsavel')
      .eq('id', leadId)
      .maybeSingle<{ id: string; status: string | null; responsavel: string | null }>();

    if (fetchError) {
      throw fetchError;
    }

    if (!leadRecord) {
      return respondJson(404, {
        success: false,
        error: 'Lead não encontrado.',
      });
    }

    const statusAnterior = toNonEmptyString(leadRecord.status) ?? 'Sem status';
    const responsavelRegistro =
      toNonEmptyString(body.responsavel) ?? toNonEmptyString(leadRecord.responsavel) ?? 'Sistema';
    const nowIso = new Date().toISOString();

    const { error: updateLeadError } = await supabaseAdmin
      .from('leads')
      .update({
        status: newStatus,
        ultimo_contato: nowIso,
      })
      .eq('id', leadId);

    if (updateLeadError) {
      throw updateLeadError;
    }

    const descricao = `Status alterado de "${statusAnterior}" para "${newStatus}" pelo chat do WhatsApp`;

    const [interactionResult, historyResult] = await Promise.all([
      supabaseAdmin
        .from('interactions')
        .insert([
          {
            lead_id: leadId,
            tipo: 'Observação',
            descricao,
            responsavel: responsavelRegistro,
          },
        ]),
      supabaseAdmin
        .from('lead_status_history')
        .insert([
          {
            lead_id: leadId,
            status_anterior: statusAnterior,
            status_novo: newStatus,
            responsavel: responsavelRegistro,
          },
        ]),
    ]);

    if (interactionResult.error) {
      throw interactionResult.error;
    }

    if (historyResult.error) {
      throw historyResult.error;
    }

    const responsePayload: LeadStatusUpdateResult = {
      id: leadId,
      status: newStatus,
      ultimo_contato: nowIso,
      responsavel: responsavelRegistro,
    };

    return respondJson(200, { success: true, lead: responsePayload });
  } catch (error) {
    console.error('Erro ao atualizar status do lead via WhatsApp:', error);
    return respondJson(500, {
      success: false,
      error: 'Erro ao atualizar status do lead.',
    });
  }
};

const handleUpdateChatFlags = async (req: Request, chatId: string) => {
  if (req.method !== 'POST') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  const body = (await ensureJsonBody<UpdateChatFlagsBody>(req)) ?? {};

  const updatePayload: Record<string, boolean> = {};

  if (typeof body.is_archived === 'boolean') {
    updatePayload.is_archived = body.is_archived;
    if (body.is_archived) {
      updatePayload.is_pinned = false;
    }
  }

  if (typeof body.is_pinned === 'boolean') {
    updatePayload.is_pinned = body.is_archived === true ? false : body.is_pinned;
  }

  if (Object.keys(updatePayload).length === 0) {
    return respondJson(400, { success: false, error: 'Nenhuma alteração informada.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chats')
      .update(updatePayload)
      .eq('id', chatId)
      .select('*')
      .maybeSingle<WhatsappChat>();

    if (error) {
      throw error;
    }

    if (!data) {
      return respondJson(404, { success: false, error: 'Conversa não encontrada.' });
    }

    return respondJson(200, { success: true, chat: data });
  } catch (error) {
    console.error('Erro ao atualizar flags do chat:', error);
    return respondJson(500, { success: false, error: 'Falha ao atualizar conversa' });
  }
};

const handleListChatMessages = async (req: Request, chatId: string) => {
  if (req.method !== 'GET') {
    return respondJson(405, { success: false, error: 'Método não permitido' });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('moment', { ascending: true });

    if (error) {
      throw error;
    }

    return respondJson(200, { messages: data ?? [] });
  } catch (error) {
    console.error('Erro ao listar mensagens do WhatsApp:', error);
    return respondJson(500, { success: false, error: 'Falha ao carregar mensagens' });
  }
};

const resolveSubPath = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('whatsapp-webhook');
  if (functionIndex === -1) {
    return '/';
  }

  const subSegments = segments.slice(functionIndex + 1);
  return `/${subSegments.join('/')}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!supabaseAdmin) {
    return respondJson(500, { success: false, error: 'Supabase client não configurado' });
  }

  const { pathname } = new URL(req.url);
  const subPath = resolveSubPath(pathname);

  const chatMetadataMatch = subPath.match(/^\/chats\/([^/]+)\/metadata$/);
  const chatMessagesMatch = subPath.match(/^\/chats\/([^/]+)\/messages$/);
  const chatFlagsMatch = subPath.match(/^\/chats\/([^/]+)\/flags$/);

  if (subPath === '/chats') {
    return handleListChats(req);
  }

  if (subPath === '/contacts') {
    return handleListContacts(req);
  }

  if (subPath === '/leads/update-status') {
    return handleUpdateLeadStatus(req);
  }

  if (chatMessagesMatch) {
    const chatId = decodeURIComponent(chatMessagesMatch[1]);
    return handleListChatMessages(req, chatId);
  }

  if (chatFlagsMatch) {
    const chatId = decodeURIComponent(chatFlagsMatch[1]);
    return handleUpdateChatFlags(req, chatId);
  }

  switch (subPath) {
    case '/on-message-status':
      return handleOnMessageStatus(req);
    case '/on-message-received':
      return handleOnMessageReceived(req);
    case '/on-message-send':
      return handleOnMessageSend(req);
    case '/send-message':
      return handleSendMessage(req);
    case '/delete-message':
      return handleDeleteMessage(req);
    case '/send-document':
      return handleSendDocument(req);
    case '/send-image':
      return handleSendImage(req);
    case '/send-audio':
      return handleSendAudio(req);
    case '/rewrite-message':
      return handleRewriteMessage(req);
    case '/transcribe-audio':
      return handleTranscribeAudio(req);
    case '/send-video':
      return handleSendVideo(req);
    case '/send-location':
      return handleSendLocation(req);
    case '/send-contact':
      return handleSendContact(req);
    case '/ensure-chat':
      return handleEnsureChat(req);
    case '/health':
      return handleHealthcheck(req);
    case '/':
    case '':
      return respondJson(200, { success: true, service: 'whatsapp-webhook' });
    default:
      return respondJson(404, { success: false, error: 'Endpoint não encontrado' });
  }
});
