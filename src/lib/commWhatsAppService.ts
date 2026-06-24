import {
  getSupabaseErrorMessage,
  supabase,
  supabaseFunctionsUrl,
  waitForSupabaseSession,
  type CommWhatsAppChannel,
  type CommWhatsAppChat,
  type CommWhatsAppMessage,
  type CommWhatsAppPhoneContact,
  type Contract,
} from './supabase';

export type CommWhatsAppOperationalState = {
  channel: CommWhatsAppChannel | null;
  configEnabled: boolean;
  tokenConfigured: boolean;
};

export type CommWhatsAppDashboardRecentChat = {
  id: string;
  displayName: string;
  phoneNumber: string;
  leadId?: string | null;
  leadStatus?: string | null;
  unreadCount: number;
  manualUnread: boolean;
  isArchived: boolean;
  isMuted: boolean;
  isPinned: boolean;
  lastMessageAt?: string | null;
  lastMessageDirection?: string | null;
  lastMessageStatus?: string | null;
  lastMessageText?: string | null;
};

export type CommWhatsAppDashboardMetrics = {
  generatedAt?: string | null;
  channel: Pick<
    CommWhatsAppChannel,
    | 'id'
    | 'name'
    | 'enabled'
    | 'connection_status'
    | 'health_status'
    | 'phone_number'
    | 'connected_user_name'
    | 'last_health_check_at'
    | 'last_webhook_received_at'
    | 'last_error'
    | 'updated_at'
  > | null;
  chatMetrics: {
    totalChats: number;
    activeChats: number;
    archivedChats: number;
    unreadChats: number;
    unreadMessages: number;
    linkedLeadChats: number;
    activeUnlinkedChats: number;
    pinnedChats: number;
    mutedChats: number;
    staleUnreadChats: number;
    oldestUnreadAt?: string | null;
    lastInboundAt?: string | null;
    lastOutboundAt?: string | null;
  };
  messageMetrics: {
    messages24h: number;
    inbound24h: number;
    outbound24h: number;
    pendingOutbound: number;
    failedOutbound24h: number;
  };
  reminderMetrics: {
    overdueReminders: number;
    upcomingReminders24h: number;
  };
  recentChats: CommWhatsAppDashboardRecentChat[];
};

export type CommWhatsAppMarkChatReadResult = {
  id: string;
  unreadCount: number;
  lastReadAt?: string | null;
};

export type CommWhatsAppFollowUpIntensity = 'leve' | 'moderada' | 'direta' | 'ultima_tentativa';

type ListChatsParams = {
  search?: string;
  activityFilter?: 'all' | 'unread';
  leadFilter?: 'all' | 'with_lead' | 'without_lead';
  savedFilter?: 'all' | 'saved' | 'unsaved';
  archivedFilter?: 'all' | 'active' | 'archived';
  leadStatusFilters?: string[];
  onlyUnread?: boolean;
  limit?: number;
  offset?: number;
};

type MessageCursor = {
  messageAt: string;
  id: string;
};

type ListMessagesPageParams = {
  limit?: number;
  before?: MessageCursor | null;
};

type SearchMessagesParams = {
  search: string;
  chatIds?: string[];
  archivedFilter?: 'all' | 'active' | 'archived';
  limit?: number;
};

type CommWhatsAppSendResult = {
  messageId: string | null;
  status: string;
};

type CommWhatsAppSendResponsePayload = {
  messageId?: string | null;
  status?: string;
  duplicate?: boolean;
};

export type CommWhatsAppMessagesPage = {
  messages: CommWhatsAppMessage[];
  hasMore: boolean;
};

export type CommWhatsAppChatThread = {
  chat: CommWhatsAppChat;
  lead: CommWhatsAppLeadPanel | null;
  messages: CommWhatsAppMessage[];
  hasMore: boolean;
  generatedAt?: string | null;
};

export type CommWhatsAppRefreshedMessageStatus = {
  id: string;
  external_message_id: string;
  previous_status: string;
  delivery_status: string;
  whapi_delivery_status?: string;
  updated: boolean;
};

export type CommWhatsAppRefreshMessageStatusResult = {
  refreshed: CommWhatsAppRefreshedMessageStatus[];
  checked: number;
  updated: number;
};

export type CommWhatsAppMessageSearchResult = {
  message: CommWhatsAppMessage;
  chat: CommWhatsAppChat;
};

export type CommWhatsAppInboxExportProgress = {
  chatsLoaded: number;
  chatsExported: number;
  messagesExported: number;
};

export type CommWhatsAppInboxExportPayload = {
  schema: 'kifer.comm_whatsapp_inbox_export.v1';
  generatedAt: string;
  summary: {
    chats: number;
    messages: number;
  };
  conversations: Array<{
    chat: CommWhatsAppChat;
    messages: CommWhatsAppMessage[];
  }>;
};

export type CommWhatsAppLeadSearchResult = {
  id: string;
  nome_completo: string;
  telefone: string;
  status_nome?: string | null;
  status_value?: string | null;
  responsavel_label?: string | null;
  responsavel_value?: string | null;
};

export type CommWhatsAppLeadPanel = {
  id: string;
  nome_completo: string;
  telefone: string;
  observacoes?: string | null;
  status_nome?: string | null;
  status_value?: string | null;
  responsavel_label?: string | null;
  responsavel_value?: string | null;
};

export type CommWhatsAppLeadContractSummary = Pick<
  Contract,
  'id' | 'codigo_contrato' | 'status' | 'modalidade' | 'operadora' | 'produto_plano' | 'mensalidade_total'
>;

export type CommWhatsAppStartChatResult = {
  chat: CommWhatsAppChat;
};

export type CommWhatsAppSavedContactsPage = {
  contacts: CommWhatsAppPhoneContact[];
  total: number;
  hasMore: boolean;
};

export type CommWhatsAppSavedContactResult = {
  id: string;
  channel_id: string;
  contact_id: string;
  phone_number: string;
  phone_digits: string;
  display_name: string;
  short_name: string | null;
  saved: boolean;
  last_synced_at: string;
  updated_at: string;
};

export type CommWhatsAppTranscriptionResult = {
  transcription_text: string;
  transcription_status: 'completed';
  transcription_provider?: string | null;
  transcription_model?: string | null;
  fallback_used?: boolean;
};

export type CommWhatsAppFollowUpVariation = {
  label: string;
  text: string;
};

export type CommWhatsAppFollowUpAiContext = {
  situationPresetIds: string[];
  tone: CommWhatsAppFollowUpTone;
  salesTechniques: string[];
  rationale?: string | null;
};

export type CommWhatsAppFollowUpNextAction = {
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

export type CommWhatsAppFollowUpSuggestion = {
  text: string;
  variations?: CommWhatsAppFollowUpVariation[];
  aiContext?: CommWhatsAppFollowUpAiContext;
  nextAction?: CommWhatsAppFollowUpNextAction | null;
  provider?: string | null;
  model?: string | null;
  fallback_used?: boolean;
};

export type CommWhatsAppFollowUpTone = 'consultivo' | 'amigavel' | 'direto' | 'reativacao' | 'premium';

export type FollowUpAgendaOrganizerMode = 'balanced' | 'urgency' | 'minimal_changes';

export type FollowUpAgendaOrganizerOptions = {
  dailyLimit: number;
  queueTime: string;
  startDate: string;
  weekdaysOnly: boolean;
  includeOverdue: boolean;
  preserveToday: boolean;
  priorityMode: FollowUpAgendaOrganizerMode;
};

export type FollowUpAgendaOrganizerChange = {
  reminderId: string;
  leadId: string | null;
  leadName: string;
  title: string;
  currentDateTime: string;
  newDateTime: string;
  priority: string;
  score: number;
  reasons: string[];
  changed: boolean;
};

export type FollowUpAgendaOrganizerPreview = {
  options: FollowUpAgendaOrganizerOptions;
  generatedAt: string;
  totalCandidates: number;
  totalChanges: number;
  groupedDays: Record<string, number>;
  changes: FollowUpAgendaOrganizerChange[];
  ai?: { provider?: string | null; model?: string | null; fallback_used?: boolean } | null;
};

export type FollowUpAgendaOrganizerApplyResult = {
  applied: number;
  skipped: number;
};

export type CommWhatsAppRewriteTone = 'grammar' | 'professional' | 'friendly' | 'shorter' | 'assertive' | 'adapt_context';

export type CommWhatsAppPendingFollowUpChat = {
  chat_id: string;
  external_chat_id: string;
  lead_id: string;
  lead_name: string | null;
  lead_phone: string | null;
  reminder_id: string;
  reminder_title: string;
  reminder_due_at: string;
  reminder_priority: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
};

export type CommWhatsAppFollowUpRefinementSuggestion = CommWhatsAppFollowUpSuggestion;

export type CommWhatsAppRewriteSuggestion = {
  text: string;
  provider?: string | null;
  model?: string | null;
  fallback_used?: boolean;
};

export type CommWhatsAppReplySuggestion = {
  text: string;
  mode?: 'suggest_reply' | 'complete_draft' | string;
  provider?: string | null;
  model?: string | null;
  fallback_used?: boolean;
};

export type CommWhatsAppMediaSendKind = 'image' | 'video' | 'document' | 'audio' | 'voice';

const mediaObjectUrlCache = new Map<string, Promise<string>>();
const localMediaPreviewByMessageId = new Map<string, string>();

const sanitizeSearch = (value: string) =>
  value
    .trim()
    .replace(/[,%]/g, ' ')
    .replace(/\s+/g, ' ');

const getFunctionInvokeErrorMessage = async (error: unknown, fallbackMessage: string): Promise<string> => {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : null;

  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null) as { error?: unknown; message?: unknown } | null;
    const message = typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : '';

    if (message) {
      return message;
    }
  }

  return getSupabaseErrorMessage(error, fallbackMessage);
};

const parseSendResponse = (data: unknown, fallbackStatus = 'pending'): CommWhatsAppSendResult => {
  const payload = (data ?? {}) as CommWhatsAppSendResponsePayload;
  const messageId = typeof payload.messageId === 'string' && payload.messageId.trim()
    ? payload.messageId.trim()
    : null;
  const status = typeof payload.status === 'string' && payload.status.trim()
    ? payload.status.trim()
    : fallbackStatus;

  if (payload.duplicate === true && !messageId && status.toLowerCase() === 'sending') {
    throw new Error('Este envio ainda está em andamento. Aguarde a confirmação antes de reenviar.');
  }

  return { messageId, status };
};

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const readNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');

const normalizeDashboardRecentChat = (value: unknown): CommWhatsAppDashboardRecentChat => {
  const row = toRecord(value);
  return {
    id: readString(row.id),
    displayName: readString(row.displayName) || readString(row.display_name) || readString(row.phoneNumber) || readString(row.phone_number),
    phoneNumber: readString(row.phoneNumber) || readString(row.phone_number),
    leadId: readString(row.leadId) || readString(row.lead_id) || null,
    leadStatus: readString(row.leadStatus) || readString(row.lead_status) || null,
    unreadCount: readNumber(row.unreadCount ?? row.unread_count),
    manualUnread: row.manualUnread === true || row.manual_unread === true,
    isArchived: row.isArchived === true || row.is_archived === true,
    isMuted: row.isMuted === true || row.is_muted === true,
    isPinned: row.isPinned === true || row.is_pinned === true,
    lastMessageAt: readString(row.lastMessageAt) || readString(row.last_message_at) || null,
    lastMessageDirection: readString(row.lastMessageDirection) || readString(row.last_message_direction) || null,
    lastMessageStatus: readString(row.lastMessageStatus) || readString(row.last_message_status) || readString(row.last_message_delivery_status) || null,
    lastMessageText: readString(row.lastMessageText) || readString(row.last_message_text) || null,
  };
};

const normalizeDashboardMetrics = (value: unknown): CommWhatsAppDashboardMetrics => {
  const payload = toRecord(value);
  const channel = toRecord(payload.channel);
  const chatMetrics = toRecord(payload.chatMetrics ?? payload.chat_metrics);
  const messageMetrics = toRecord(payload.messageMetrics ?? payload.message_metrics);
  const reminderMetrics = toRecord(payload.reminderMetrics ?? payload.reminder_metrics);
  const rawRecentChats = payload.recentChats ?? payload.recent_chats;
  const recentChats = Array.isArray(rawRecentChats) ? rawRecentChats : [];

  return {
    generatedAt: readString(payload.generatedAt) || readString(payload.generated_at) || null,
    channel: Object.keys(channel).length > 0
      ? {
          id: readString(channel.id),
          name: readString(channel.name),
          enabled: channel.enabled === true,
          connection_status: readString(channel.connection_status),
          health_status: readString(channel.health_status),
          phone_number: readString(channel.phone_number) || null,
          connected_user_name: readString(channel.connected_user_name) || null,
          last_health_check_at: readString(channel.last_health_check_at) || null,
          last_webhook_received_at: readString(channel.last_webhook_received_at) || null,
          last_error: readString(channel.last_error) || null,
          updated_at: readString(channel.updated_at),
        }
      : null,
    chatMetrics: {
      totalChats: readNumber(chatMetrics.totalChats ?? chatMetrics.total_chats),
      activeChats: readNumber(chatMetrics.activeChats ?? chatMetrics.active_chats),
      archivedChats: readNumber(chatMetrics.archivedChats ?? chatMetrics.archived_chats),
      unreadChats: readNumber(chatMetrics.unreadChats ?? chatMetrics.unread_chats),
      unreadMessages: readNumber(chatMetrics.unreadMessages ?? chatMetrics.unread_messages),
      linkedLeadChats: readNumber(chatMetrics.linkedLeadChats ?? chatMetrics.linked_lead_chats),
      activeUnlinkedChats: readNumber(chatMetrics.activeUnlinkedChats ?? chatMetrics.active_unlinked_chats),
      pinnedChats: readNumber(chatMetrics.pinnedChats ?? chatMetrics.pinned_chats),
      mutedChats: readNumber(chatMetrics.mutedChats ?? chatMetrics.muted_chats),
      staleUnreadChats: readNumber(chatMetrics.staleUnreadChats ?? chatMetrics.stale_unread_chats),
      oldestUnreadAt: readString(chatMetrics.oldestUnreadAt) || readString(chatMetrics.oldest_unread_at) || null,
      lastInboundAt: readString(chatMetrics.lastInboundAt) || readString(chatMetrics.last_inbound_at) || null,
      lastOutboundAt: readString(chatMetrics.lastOutboundAt) || readString(chatMetrics.last_outbound_at) || null,
    },
    messageMetrics: {
      messages24h: readNumber(messageMetrics.messages24h ?? messageMetrics.messages_24h),
      inbound24h: readNumber(messageMetrics.inbound24h ?? messageMetrics.inbound_24h),
      outbound24h: readNumber(messageMetrics.outbound24h ?? messageMetrics.outbound_24h),
      pendingOutbound: readNumber(messageMetrics.pendingOutbound ?? messageMetrics.pending_outbound),
      failedOutbound24h: readNumber(messageMetrics.failedOutbound24h ?? messageMetrics.failed_outbound_24h),
    },
    reminderMetrics: {
      overdueReminders: readNumber(reminderMetrics.overdueReminders ?? reminderMetrics.overdue_reminders),
      upcomingReminders24h: readNumber(reminderMetrics.upcomingReminders24h ?? reminderMetrics.upcoming_reminders_24h),
    },
    recentChats: recentChats.map(normalizeDashboardRecentChat),
  };
};

export const formatCommWhatsAppPhoneLabel = (value?: string | null) => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  return value?.trim() || 'Numero desconhecido';
};

const invokeFollowUpAgendaOrganizer = async (body: Record<string, unknown>) => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(getSupabaseErrorMessage(sessionError, 'Nao foi possivel autenticar a organizacao da agenda.'));
  }

  if (!session?.access_token) {
    throw new Error('Sua sessao expirou. Entre novamente para organizar a agenda.');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${supabaseFunctionsUrl}/organize-follow-up-agenda`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'Nao foi possivel organizar a agenda de follow-ups.';
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A organizacao da agenda demorou mais que 60 segundos. Tente reduzir o volume de follow-ups.');
    }

    throw error instanceof Error ? error : new Error('Nao foi possivel organizar a agenda de follow-ups.');
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const commWhatsAppService = {
  async getUnreadChatsCount(params: { includeArchived?: boolean } = {}): Promise<number> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para carregar as conversas não lidas do WhatsApp.' });

    let query = supabase
      .from('comm_whatsapp_chats')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .or('unread_count.gt.0,manual_unread.eq.true');

    if (!params.includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar a contagem de conversas nao lidas do WhatsApp.'));
    }

    return count ?? 0;
  },

  rememberLocalMediaPreview(messageId: string, objectUrl: string) {
    if (!messageId || !objectUrl) return;
    localMediaPreviewByMessageId.set(messageId, objectUrl);
  },

  getRememberedLocalMediaPreview(messageId?: string | null) {
    if (!messageId) return null;
    return localMediaPreviewByMessageId.get(messageId) ?? null;
  },

  async getOperationalState(): Promise<CommWhatsAppOperationalState | null> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para verificar o status do WhatsApp.' });

    const { data, error } = await supabase.rpc('comm_whatsapp_get_operational_state');

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar o status operacional do WhatsApp.'));
    }

    const rows = Array.isArray(data) ? data : [];
    const row = (rows[0] ?? null) as (CommWhatsAppChannel & {
      config_enabled?: boolean | null;
      token_configured?: boolean | null;
    }) | null;

    if (!row) {
      return null;
    }

    return {
      channel: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        enabled: row.enabled,
        whapi_channel_id: row.whapi_channel_id,
        connection_status: row.connection_status,
        health_status: row.health_status,
        phone_number: row.phone_number,
        connected_user_name: row.connected_user_name,
        last_health_check_at: row.last_health_check_at,
        last_webhook_received_at: row.last_webhook_received_at,
        last_error: row.last_error,
        health_snapshot: row.health_snapshot,
        limits_snapshot: row.limits_snapshot,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      configEnabled: row.config_enabled === true,
      tokenConfigured: row.token_configured === true,
    };
  },

  async getDashboardMetrics(): Promise<CommWhatsAppDashboardMetrics> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para visualizar o Painel WhatsApp.' });

    const { data, error } = await supabase.rpc('comm_whatsapp_get_dashboard_metrics' as never);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as metricas do Painel WhatsApp.'));
    }

    const payload = toRecord(data);
    if (payload.authorized === false) {
      throw new Error('Permissao insuficiente para visualizar o Painel WhatsApp.');
    }

    return normalizeDashboardMetrics(payload);
  },

  async listChats(params: ListChatsParams = {}): Promise<CommWhatsAppChat[]> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para carregar as conversas do WhatsApp.' });

    const limit = Math.min(Math.max(params.limit ?? 80, 1), 500);
    const offset = Math.max(params.offset ?? 0, 0);
    const activityFilter = params.activityFilter ?? (params.onlyUnread ? 'unread' : 'all');
    const leadFilter = params.leadFilter ?? 'all';
    const savedFilter = params.savedFilter ?? 'all';
    const archivedFilter = params.archivedFilter ?? 'all';
    const leadStatusFilters = (params.leadStatusFilters ?? []).map((value) => value.trim()).filter(Boolean);

    const search = sanitizeSearch(params.search ?? '');

    const { data, error } = await supabase.rpc('comm_whatsapp_list_chats', {
      p_search: search || null,
      p_activity_filter: activityFilter,
      p_lead_filter: leadFilter,
      p_saved_filter: savedFilter,
      p_archived_filter: archivedFilter,
      p_lead_status_filters: leadStatusFilters.length > 0 ? leadStatusFilters : null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as conversas do WhatsApp.'));
    }

    return (Array.isArray(data) ? data : []) as CommWhatsAppChat[];
  },

  async exportInboxConversations(params: {
    onProgress?: (progress: CommWhatsAppInboxExportProgress) => void;
  } = {}): Promise<CommWhatsAppInboxExportPayload> {
    const chats: CommWhatsAppChat[] = [];
    let offset = 0;

    while (true) {
      const page = await this.listChats({
        archivedFilter: 'all',
        limit: 500,
        offset,
      });

      chats.push(...page);
      params.onProgress?.({
        chatsLoaded: chats.length,
        chatsExported: 0,
        messagesExported: 0,
      });

      if (page.length < 500) {
        break;
      }

      offset += page.length;
    }

    const conversations: CommWhatsAppInboxExportPayload['conversations'] = [];
    let messagesExported = 0;

    for (const chat of chats) {
      const messages = await this.listAllMessages(chat.id);
      messagesExported += messages.length;
      conversations.push({ chat, messages });

      params.onProgress?.({
        chatsLoaded: chats.length,
        chatsExported: conversations.length,
        messagesExported,
      });
    }

    return {
      schema: 'kifer.comm_whatsapp_inbox_export.v1',
      generatedAt: new Date().toISOString(),
      summary: {
        chats: conversations.length,
        messages: messagesExported,
      },
      conversations,
    };
  },

  async updateChatInboxState(chatId: string, options: {
    isArchived?: boolean | null;
    isMuted?: boolean | null;
    isPinned?: boolean | null;
    markAsUnread?: boolean | null;
  }): Promise<CommWhatsAppChat> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para atualizar esta conversa.' });

    const { data, error } = await supabase.rpc('comm_whatsapp_update_chat_inbox_state', {
      p_chat_id: chatId,
      p_is_archived: typeof options.isArchived === 'boolean' ? options.isArchived : null,
      p_is_muted: typeof options.isMuted === 'boolean' ? options.isMuted : null,
      p_is_pinned: typeof options.isPinned === 'boolean' ? options.isPinned : null,
      p_mark_as_unread: typeof options.markAsUnread === 'boolean' ? options.markAsUnread : null,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel atualizar o estado desta conversa.'));
    }

    const rows = Array.isArray(data) ? data : [];
    const row = rows[0] as CommWhatsAppChat | undefined;
    if (!row) {
      throw new Error('A conversa atualizada nao foi retornada.');
    }

    return row;
  },

  async deleteChat(chatId: string): Promise<CommWhatsAppChat> {
    const { data, error } = await supabase.rpc('comm_whatsapp_delete_chat', {
      p_chat_id: chatId,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel excluir esta conversa.'));
    }

    const rows = Array.isArray(data) ? data : [];
    const row = rows[0] as CommWhatsAppChat | undefined;
    if (!row) {
      throw new Error('A conversa excluida nao foi retornada.');
    }

    return row;
  },

  async searchMessages(params: SearchMessagesParams): Promise<CommWhatsAppMessageSearchResult[]> {
    const search = sanitizeSearch(params.search ?? '');
    if (!search) {
      return [];
    }

    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
    const chatIds = Array.from(new Set((params.chatIds ?? []).filter(Boolean)));
    if (params.chatIds && chatIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase.rpc('comm_whatsapp_search_messages', {
      p_search: search,
      p_chat_ids: chatIds.length > 0 ? chatIds : null,
      p_archived_filter: params.archivedFilter ?? 'all',
      p_limit: limit,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel buscar mensagens do WhatsApp.'));
    }

    return (Array.isArray(data) ? data : []).flatMap((row) => {
      const candidate = row as { message?: unknown; chat?: unknown };
      if (!candidate.message || !candidate.chat) {
        return [];
      }

      return [{
        message: candidate.message as CommWhatsAppMessage,
        chat: candidate.chat as CommWhatsAppChat,
      }];
    });
  },

  async searchCrmLeads(params: { query?: string; phoneNumbers?: string[]; limit?: number } = {}): Promise<CommWhatsAppLeadSearchResult[]> {
    const { data, error } = await supabase.rpc('comm_whatsapp_search_crm_leads', {
      p_query: params.query?.trim() || null,
      p_phone_numbers: params.phoneNumbers && params.phoneNumbers.length > 0 ? params.phoneNumbers : null,
      p_limit: params.limit ?? 20,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel buscar leads do CRM.'));
    }

    return (Array.isArray(data) ? data : []) as CommWhatsAppLeadSearchResult[];
  },

  async getChatLeadPanel(chatId: string): Promise<CommWhatsAppLeadPanel | null> {
    const { data, error } = await supabase.rpc('comm_whatsapp_get_chat_lead_panel', {
      p_chat_id: chatId,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar o lead vinculado ao chat.'));
    }

    const rows = Array.isArray(data) ? data : [];
    return (rows[0] as CommWhatsAppLeadPanel | undefined) ?? null;
  },

  async getChatThread(chatId: string, params: { limit?: number } = {}): Promise<CommWhatsAppChatThread> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para carregar esta conversa do WhatsApp.' });

    const safeLimit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const { data, error } = await supabase.rpc('comm_whatsapp_get_chat_thread' as never, {
      p_chat_id: chatId,
      p_limit: safeLimit,
    } as never);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar a conversa do WhatsApp.'));
    }

    const payload = toRecord(data);
    const chat = toRecord(payload.chat) as CommWhatsAppChat;
    if (!chat.id) {
      throw new Error('A conversa do WhatsApp nao retornou dados suficientes.');
    }

    const leadPayload = toRecord(payload.lead);
    const lead = leadPayload.id ? (leadPayload as CommWhatsAppLeadPanel) : null;
    const messages = Array.isArray(payload.messages) ? payload.messages as CommWhatsAppMessage[] : [];

    return {
      chat,
      lead,
      messages,
      hasMore: payload.hasMore === true || payload.has_more === true,
      generatedAt: readString(payload.generatedAt) || readString(payload.generated_at) || null,
    };
  },

  async listLeadContracts(leadId: string): Promise<CommWhatsAppLeadContractSummary[]> {
    const { data, error } = await supabase.rpc('comm_whatsapp_list_lead_contracts', {
      p_lead_id: leadId,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar os contratos do lead.'));
    }

    return (Array.isArray(data) ? data : []) as CommWhatsAppLeadContractSummary[];
  },

  async linkChatLead(chatId: string, leadId: string): Promise<CommWhatsAppChat> {
    const { data, error } = await supabase.rpc('comm_whatsapp_link_chat_lead', {
      p_chat_id: chatId,
      p_lead_id: leadId,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel vincular o lead ao chat.'));
    }

    const rows = Array.isArray(data) ? data : [];
    const row = rows[0] as CommWhatsAppChat | undefined;
    if (!row) {
      throw new Error('O vinculo do lead nao retornou a conversa atualizada.');
    }

    return row;
  },

  async unlinkChatLead(chatId: string): Promise<CommWhatsAppChat> {
    const { data, error } = await supabase.rpc('comm_whatsapp_unlink_chat_lead', {
      p_chat_id: chatId,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel desvincular o lead do chat.'));
    }

    const rows = Array.isArray(data) ? data : [];
    const row = rows[0] as CommWhatsAppChat | undefined;
    if (!row) {
      throw new Error('A conversa atualizada nao foi retornada apos desvincular o lead.');
    }

    return row;
  },

  async updateLinkedLeadStatus(chatId: string, newStatus: string): Promise<void> {
    const { error } = await supabase.rpc('comm_whatsapp_update_linked_lead_status', {
      p_chat_id: chatId,
      p_new_status: newStatus,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel atualizar o status do lead.'));
    }
  },

  async updateLinkedLeadResponsavel(chatId: string, responsavelValue: string): Promise<void> {
    const { error } = await supabase.rpc('comm_whatsapp_update_linked_lead_responsavel', {
      p_chat_id: chatId,
      p_new_responsavel_value: responsavelValue,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel atualizar o responsavel do lead.'));
    }
  },

  async listSavedContacts(params: { query?: string; forceSync?: boolean; page?: number; pageSize?: number } = {}): Promise<CommWhatsAppSavedContactsPage> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-contacts', {
      body: {
        action: 'listContacts',
        query: params.query?.trim() || '',
        forceSync: params.forceSync === true,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar os contatos salvos do WhatsApp.'));
    }

    const payload = (data ?? {}) as { contacts?: CommWhatsAppPhoneContact[]; total?: number; hasMore?: boolean };

    return {
      contacts: (payload.contacts ?? []) as CommWhatsAppPhoneContact[],
      total: typeof payload.total === 'number' ? payload.total : 0,
      hasMore: payload.hasMore === true,
    };
  },

  async lookupSavedContactsByPhones(params: { phoneNumbers: string[]; forceSync?: boolean }): Promise<CommWhatsAppPhoneContact[]> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-contacts', {
      body: {
        action: 'lookupContactsByPhones',
        phoneNumbers: params.phoneNumbers,
        forceSync: params.forceSync === true,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel localizar contatos salvos do WhatsApp.'));
    }

    const payload = (data ?? {}) as { contacts?: CommWhatsAppPhoneContact[] };
    return (payload.contacts ?? []) as CommWhatsAppPhoneContact[];
  },

  async startChat(params:
    | { source: 'saved_contact'; phoneNumber: string; displayName?: string | null; contactId?: string | null }
    | { source: 'crm'; leadId: string }
    | { source: 'manual'; phoneNumber: string }): Promise<CommWhatsAppStartChatResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-contacts', {
      body: {
        action: 'startChat',
        ...params,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel iniciar a conversa no WhatsApp.'));
    }

    const payload = (data ?? {}) as { chat?: CommWhatsAppChat };
    if (!payload.chat) {
      throw new Error('A conversa iniciada nao retornou dados suficientes.');
    }

    return { chat: payload.chat };
  },

  async saveContact(params: { phoneNumber: string; displayName: string }): Promise<CommWhatsAppSavedContactResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-contacts', {
      body: {
        action: 'saveContact',
        phoneNumber: params.phoneNumber,
        displayName: params.displayName,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel salvar o contato do WhatsApp.'));
    }

    const payload = (data ?? {}) as { contact?: CommWhatsAppSavedContactResult };
    if (!payload.contact) {
      throw new Error('O contato salvo nao retornou dados suficientes.');
    }

    return payload.contact;
  },

  async findExistingChat(params: { leadId?: string | null; phoneDigits?: string[] }): Promise<CommWhatsAppChat | null> {
    const normalizedLeadId = params.leadId?.trim() || null;
    const normalizedPhoneDigits = Array.from(new Set((params.phoneDigits ?? []).map((value) => value.trim()).filter(Boolean)));

    if (normalizedLeadId) {
      const { data, error } = await supabase
        .from('comm_whatsapp_chats')
        .select('*')
        .eq('lead_id', normalizedLeadId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel localizar a conversa existente deste lead.'));
      }

      if (data) {
        return data as CommWhatsAppChat;
      }
    }

    if (normalizedPhoneDigits.length === 0) {
      return null;
    }

    const { data, error } = await supabase
      .from('comm_whatsapp_chats')
      .select('*')
      .in('phone_digits', normalizedPhoneDigits)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel localizar a conversa existente deste numero.'));
    }

    return ((data ?? [])[0] as CommWhatsAppChat | undefined) ?? null;
  },

  async listMessagesPage(chatId: string, params: ListMessagesPageParams = {}): Promise<CommWhatsAppMessagesPage> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para carregar as mensagens do WhatsApp.' });

    const safeLimit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const { data, error } = await supabase.rpc('comm_whatsapp_list_messages_page', {
      p_chat_id: chatId,
      p_before_message_at: params.before?.messageAt ?? null,
      p_before_id: params.before?.id ?? null,
      p_limit: safeLimit + 1,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as mensagens do WhatsApp.'));
    }

    const rows = (data ?? []) as CommWhatsAppMessage[];
    const hasMore = rows.length > safeLimit;
    const page = rows.slice(0, safeLimit).reverse();

    return {
      messages: page,
      hasMore,
    };
  },

  async listMessageContext(chatId: string, messageId: string): Promise<CommWhatsAppMessage[]> {
    const { data, error } = await supabase.rpc('comm_whatsapp_list_message_context' as never, {
      p_chat_id: chatId,
      p_message_id: messageId,
      p_before_limit: 50,
      p_after_limit: 50,
    } as never);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar o contexto da mensagem.'));
    }

    return (Array.isArray(data) ? data : []) as CommWhatsAppMessage[];
  },

  async listAllMessages(chatId: string): Promise<CommWhatsAppMessage[]> {
    const messages: CommWhatsAppMessage[] = [];
    let before: MessageCursor | null = null;

    while (true) {
      const page = await this.listMessagesPage(chatId, {
        limit: 200,
        before,
      });

      if (page.messages.length === 0) {
        break;
      }

      messages.unshift(...page.messages);

      if (!page.hasMore) {
        break;
      }

      const oldestMessage = page.messages[0];
      before = oldestMessage
        ? {
            messageAt: oldestMessage.message_at,
            id: oldestMessage.id,
          }
        : null;
    }

    return messages;
  },

  async syncChatHistory(chatId: string): Promise<{ imported: number; fetched: number; inserted: number; updated: number }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-sync-chat', {
      body: { chatId },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel sincronizar o historico da conversa.'));
    }

    const payload = (data ?? {}) as { imported?: number; fetched?: number; inserted?: number; updated?: number };
    return {
      imported: typeof payload.imported === 'number' ? payload.imported : 0,
      fetched: typeof payload.fetched === 'number' ? payload.fetched : 0,
      inserted: typeof payload.inserted === 'number' ? payload.inserted : typeof payload.imported === 'number' ? payload.imported : 0,
      updated: typeof payload.updated === 'number' ? payload.updated : 0,
    };
  },

  async refreshMessageStatuses(params: {
    chatId?: string;
    externalMessageIds?: string[];
    limit?: number;
  }): Promise<CommWhatsAppRefreshMessageStatusResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-refresh-message-status', {
      body: {
        chatId: params.chatId?.trim() || '',
        externalMessageIds: params.externalMessageIds?.map((id) => id.trim()).filter(Boolean) ?? [],
        limit: params.limit,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel atualizar o status das mensagens.'));
    }

    const payload = (data ?? {}) as Partial<CommWhatsAppRefreshMessageStatusResult>;
    return {
      refreshed: Array.isArray(payload.refreshed) ? payload.refreshed : [],
      checked: typeof payload.checked === 'number' ? payload.checked : 0,
      updated: typeof payload.updated === 'number' ? payload.updated : 0,
    };
  },

  async markChatRead(chatId: string, cursor: { messageAt?: string | null; messageId?: string | null } = {}): Promise<CommWhatsAppMarkChatReadResult> {
    await waitForSupabaseSession({ errorMessage: 'Sua sessão expirou. Entre novamente para marcar a conversa como lida.' });

    console.debug('[WhatsAppInbox][mark-read][service] rpc:start', {
      chatId,
      cursor,
    });

    const { data, error } = await supabase.rpc('comm_whatsapp_mark_chat_read', {
      p_chat_id: chatId,
      p_last_seen_message_at: cursor.messageAt ?? null,
      p_last_seen_message_id: cursor.messageId ?? null,
    });

    console.debug('[WhatsAppInbox][mark-read][service] rpc:result', {
      chatId,
      data,
      error,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel marcar a conversa como lida.'));
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
      console.warn('[WhatsAppInbox][mark-read][service] rpc:empty-result:retry', {
        chatId,
        cursor,
        data,
      });

      // Retry the RPC once — the empty result is often a PostgREST serialization
      // issue with data-modifying CTEs, not a logical failure.
      const { data: retryData, error: retryError } = await supabase.rpc('comm_whatsapp_mark_chat_read', {
        p_chat_id: chatId,
        p_last_seen_message_at: cursor.messageAt ?? null,
        p_last_seen_message_id: cursor.messageId ?? null,
      });

      if (!retryError) {
        const retryRow = Array.isArray(retryData) ? retryData[0] : retryData;
        if (retryRow && typeof retryRow === 'object') {
          const retryPayload = retryRow as { id?: unknown; unread_count?: unknown; last_read_at?: unknown };
          const retryResult = {
            id: typeof retryPayload.id === 'string' ? retryPayload.id : chatId,
            unreadCount: typeof retryPayload.unread_count === 'number' && Number.isFinite(retryPayload.unread_count) ? retryPayload.unread_count : 0,
            lastReadAt: typeof retryPayload.last_read_at === 'string' ? retryPayload.last_read_at : null,
          };
          console.debug('[WhatsAppInbox][mark-read][service] retry:success', retryResult);
          return retryResult;
        }
      }

      console.warn('[WhatsAppInbox][mark-read][service] rpc:empty-result:fallback-optimistic', {
        chatId,
        cursor,
        retryError,
        retryData,
      });

      // Both RPC attempts returned empty.  The UPDATEs likely executed (PostgREST
      // serialization issue) or the function truly failed.  Trust the optimistic
      // state (unreadCount: 0) to avoid stuck unreads; the next poll or refresh
      // will reconcile any discrepancy.
      return {
        id: chatId,
        unreadCount: 0,
        lastReadAt: cursor.messageAt ?? null,
      };
    }

    const payload = row as { id?: unknown; unread_count?: unknown; unreadCount?: unknown; last_read_at?: unknown; lastReadAt?: unknown };
    const resultId = typeof payload.id === 'string' ? payload.id : chatId;
    const unreadCountRaw = payload.unread_count ?? payload.unreadCount;
    const unreadCount = typeof unreadCountRaw === 'number' && Number.isFinite(unreadCountRaw) ? unreadCountRaw : 0;
    const lastReadAtRaw = payload.last_read_at ?? payload.lastReadAt;

    const result = {
      id: resultId,
      unreadCount,
      lastReadAt: typeof lastReadAtRaw === 'string' ? lastReadAtRaw : null,
    };

    console.debug('[WhatsAppInbox][mark-read][service] rpc:return', result);
    return result;
  },

  async sendTextMessage(chatId: string, text: string, options: {
    clientRequestId?: string;
    quotedMessageId?: string;
    quotedPreviewText?: string;
    quotedType?: string;
    quotedAuthorPhone?: string;
  } = {}): Promise<CommWhatsAppSendResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-send', {
      body: {
        chatId,
        text,
        clientRequestId: options.clientRequestId?.trim() || '',
        quotedMessageId: options.quotedMessageId?.trim() || '',
        quotedPreviewText: options.quotedPreviewText?.trim() || '',
        quotedType: options.quotedType?.trim() || '',
        quotedAuthorPhone: options.quotedAuthorPhone?.trim() || '',
      },
    });

    if (error) {
      throw new Error(await getFunctionInvokeErrorMessage(error, 'Nao foi possivel enviar a mensagem no WhatsApp.'));
    }

    return parseSendResponse(data);
  },

  async transcribeMessage(messageId: string, options: { force?: boolean } = {}): Promise<CommWhatsAppTranscriptionResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-transcribe', {
      body: {
        messageId,
        force: options.force === true,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel transcrever o audio do WhatsApp.'));
    }

    const payload = (data ?? {}) as CommWhatsAppTranscriptionResult;
    if (!payload.transcription_text?.trim()) {
      throw new Error('A transcricao nao retornou texto.');
    }

    return payload;
  },

  async generateFollowUp(chatId: string, options: { customInstructions?: string; tone?: CommWhatsAppFollowUpTone; variantCount?: number; salesTechniques?: string[]; situationPresetIds?: string[]; autoSelectContext?: boolean; manualContext?: { tone?: boolean; situationPresetIds?: boolean; salesTechniques?: boolean } } = {}): Promise<CommWhatsAppFollowUpSuggestion> {
    const requestBody = {
      chatId,
      customInstructions: options.customInstructions?.trim() || '',
      tone: options.tone ?? 'consultivo',
      variantCount: options.variantCount,
      salesTechniques: options.salesTechniques ?? [],
      situationPresetIds: options.situationPresetIds ?? [],
      autoSelectContext: options.autoSelectContext !== false,
      manualContext: options.manualContext ?? {},
    };
    console.debug('[FollowUpAI][service] invoke request', requestBody);

    const { data, error } = await supabase.functions.invoke('comm-whatsapp-generate-follow-up', {
      body: requestBody,
    });

    console.debug('[FollowUpAI][service] invoke response', { data, error });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel gerar o follow-up com IA.'));
    }

    const payload = (data ?? {}) as CommWhatsAppFollowUpSuggestion;
    const variations = Array.isArray(payload.variations)
      ? payload.variations
          .map((variation, index) => ({
            label: variation.label?.trim() || `Variação ${index + 1}`,
            text: variation.text?.trim() || '',
          }))
          .filter((variation) => variation.text)
      : [];
    const text = payload.text?.trim() || variations[0]?.text || '';

    if (!text) {
      throw new Error('A IA nao retornou uma sugestao de follow-up.');
    }

    return {
      text,
      variations: variations.length > 0 ? variations : undefined,
      aiContext: payload.aiContext,
      nextAction: payload.nextAction ?? null,
      provider: payload.provider ?? null,
      model: payload.model ?? null,
      fallback_used: payload.fallback_used === true,
    };
  },

  async getPendingFollowUpChats(): Promise<CommWhatsAppPendingFollowUpChat[]> {
    const { data, error } = await supabase.rpc('comm_whatsapp_pending_follow_up_chats');
    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar os follow-ups pendentes.'));
    }
    return (Array.isArray(data) ? data : []) as CommWhatsAppPendingFollowUpChat[];
  },

  async refineFollowUp(chatId: string, options: {
    currentMessage: string;
    adjustmentInstruction: string;
  }): Promise<CommWhatsAppFollowUpRefinementSuggestion> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-generate-follow-up', {
      body: {
        chatId,
        mode: 'refine',
        currentMessage: options.currentMessage,
        adjustmentInstruction: options.adjustmentInstruction.trim(),
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel refinar o follow-up com IA.'));
    }

    const payload = (data ?? {}) as CommWhatsAppFollowUpRefinementSuggestion;
    if (!payload.text?.trim()) {
      throw new Error('A IA nao retornou um refinamento de follow-up valido.');
    }

    return {
      text: payload.text.trim(),
      provider: payload.provider ?? null,
      model: payload.model ?? null,
      fallback_used: payload.fallback_used === true,
    };
  },

  async previewFollowUpAgendaOrganization(options: FollowUpAgendaOrganizerOptions): Promise<FollowUpAgendaOrganizerPreview> {
    const payload = await invokeFollowUpAgendaOrganizer({ action: 'preview', options }) as { preview?: FollowUpAgendaOrganizerPreview };
    if (!payload.preview || !Array.isArray(payload.preview.changes)) {
      throw new Error('A organizacao da agenda nao retornou uma previa valida.');
    }

    return payload.preview;
  },

  async applyFollowUpAgendaOrganization(changes: FollowUpAgendaOrganizerChange[]): Promise<FollowUpAgendaOrganizerApplyResult> {
    const payload = await invokeFollowUpAgendaOrganizer({
      action: 'apply',
      changes: changes.map((change) => ({
        reminderId: change.reminderId,
        leadId: change.leadId,
        newDateTime: change.newDateTime,
      })),
    }) as Partial<FollowUpAgendaOrganizerApplyResult>;
    return {
      applied: typeof payload.applied === 'number' ? payload.applied : 0,
      skipped: typeof payload.skipped === 'number' ? payload.skipped : 0,
    };
  },

  async rewriteMessage(options: {
    message: string;
    chatId?: string | null;
    tone?: CommWhatsAppRewriteTone;
    customInstructions?: string;
  }): Promise<CommWhatsAppRewriteSuggestion> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-rewrite-message', {
      body: {
        message: options.message,
        chatId: options.chatId ?? null,
        tone: options.tone ?? 'grammar',
        customInstructions: options.customInstructions?.trim() || '',
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel reescrever a mensagem com IA.'));
    }

    const payload = (data ?? {}) as CommWhatsAppRewriteSuggestion;
    if (!payload.text?.trim()) {
      throw new Error('A IA nao retornou uma reescrita valida.');
    }

    return {
      text: payload.text.trim(),
      provider: payload.provider ?? null,
      model: payload.model ?? null,
      fallback_used: payload.fallback_used === true,
    };
  },

  async suggestReply(options: {
    chatId: string;
    composerDraft?: string;
    mode?: 'suggest_reply' | 'complete_draft';
  }): Promise<CommWhatsAppReplySuggestion> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-suggest-reply', {
      body: {
        chatId: options.chatId,
        composerDraft: options.composerDraft ?? '',
        mode: options.mode,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel sugerir uma resposta com IA.'));
    }

    const payload = (data ?? {}) as CommWhatsAppReplySuggestion;
    if (!payload.text?.trim()) {
      throw new Error('A IA nao retornou uma sugestao valida.');
    }

    return {
      text: payload.text.trim(),
      mode: payload.mode ?? options.mode,
      provider: payload.provider ?? null,
      model: payload.model ?? null,
      fallback_used: payload.fallback_used === true,
    };
  },

  async retryMediaMessage(messageId: string, options: { clientRequestId?: string } = {}): Promise<{ messageId: string | null; status: string }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-retry-message', {
      body: { messageId, clientRequestId: options.clientRequestId?.trim() || '' },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel reenviar a midia no WhatsApp.'));
    }

    const payload = (data ?? {}) as { messageId?: string | null; status?: string };
    return {
      messageId: payload.messageId ?? null,
      status: payload.status ?? 'pending',
    };
  },

  async sendMediaMessage(params: {
    chatId: string;
    kind: CommWhatsAppMediaSendKind;
    file: File;
    caption?: string;
    durationSeconds?: number;
    waveform?: string;
    clientRequestId?: string;
    quotedMessageId?: string;
    quotedPreviewText?: string;
    quotedType?: string;
    quotedAuthorPhone?: string;
    onUploadProgress?: (progress: number | null) => void;
    signal?: AbortSignal;
  }): Promise<CommWhatsAppSendResult> {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(getSupabaseErrorMessage(sessionError, 'Nao foi possivel autenticar o envio de midia.'));
    }

    if (!session?.access_token) {
      throw new Error('Sua sessao expirou. Entre novamente para enviar midia.');
    }

    const form = new FormData();
    form.append('chatId', params.chatId);
    form.append('type', params.kind);
    form.append('clientRequestId', params.clientRequestId?.trim() || '');
    form.append('caption', params.caption?.trim() || '');
    form.append('quotedMessageId', params.quotedMessageId?.trim() || '');
    form.append('quotedPreviewText', params.quotedPreviewText?.trim() || '');
    form.append('quotedType', params.quotedType?.trim() || '');
    form.append('quotedAuthorPhone', params.quotedAuthorPhone?.trim() || '');
    if (typeof params.durationSeconds === 'number' && Number.isFinite(params.durationSeconds)) {
      form.append('durationSeconds', String(Math.max(0, Math.round(params.durationSeconds))));
    }
    if (params.waveform?.trim()) {
      form.append('waveform', params.waveform.trim());
    }
    form.append('file', params.file, params.file.name);

    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;

      const finalize = (callback: () => void) => {
        if (settled) return;
        settled = true;
        params.signal?.removeEventListener('abort', handleAbort);
        callback();
      };

      const handleAbort = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          xhr.abort();
        }
      };

      if (params.signal?.aborted) {
        reject(new Error('Envio de midia cancelado.'));
        return;
      }

      params.signal?.addEventListener('abort', handleAbort, { once: true });

      xhr.open('POST', `${supabaseFunctionsUrl}/comm-whatsapp-send`);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.responseType = 'text';
      xhr.timeout = 120000;

      xhr.upload.onprogress = (event) => {
        if (!params.onUploadProgress) {
          return;
        }

        if (event.lengthComputable && event.total > 0) {
          params.onUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        } else {
          params.onUploadProgress(null);
        }
      };

      xhr.onload = () => {
        params.onUploadProgress?.(100);

        let payload: Record<string, unknown> = {};
        try {
          payload = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : {};
        } catch {
          payload = {};
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          const message =
            typeof payload.error === 'string' && payload.error.trim()
              ? payload.error.trim()
              : 'Nao foi possivel enviar a midia no WhatsApp.';
          finalize(() => reject(new Error(message)));
          return;
        }

        try {
          const result = parseSendResponse(payload);
          finalize(() => resolve(result));
        } catch (error) {
          finalize(() => reject(error));
        }
      };

      xhr.onerror = () => {
        finalize(() => reject(new Error('Falha de rede ao enviar a midia no WhatsApp.')));
      };

      xhr.ontimeout = () => {
        finalize(() => reject(new Error('Tempo limite excedido ao enviar a midia no WhatsApp.')));
      };

      xhr.onabort = () => {
        finalize(() => reject(new Error('Envio de midia cancelado.')));
      };

      xhr.send(form);
    });
  },

  async sendRemoteMediaMessage(params: {
    chatId: string;
    kind: 'image' | 'video' | 'document';
    remoteUrl: string;
    fileName?: string;
    mimeType?: string;
    caption?: string;
    clientRequestId?: string;
    quotedMessageId?: string;
    quotedPreviewText?: string;
    quotedType?: string;
    quotedAuthorPhone?: string;
  }): Promise<CommWhatsAppSendResult> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-send', {
      body: {
        chatId: params.chatId,
        type: params.kind,
        caption: params.caption?.trim() || '',
        remoteUrl: params.remoteUrl,
        fileName: params.fileName?.trim() || '',
        mimeType: params.mimeType?.trim() || '',
        clientRequestId: params.clientRequestId?.trim() || '',
        quotedMessageId: params.quotedMessageId?.trim() || '',
        quotedPreviewText: params.quotedPreviewText?.trim() || '',
        quotedType: params.quotedType?.trim() || '',
        quotedAuthorPhone: params.quotedAuthorPhone?.trim() || '',
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel enviar a midia remota no WhatsApp.'));
    }

    return parseSendResponse(data);
  },

  async reactToMessage(params: { chatId: string; messageId: string; emoji?: string | null }): Promise<void> {
    const { error } = await supabase.functions.invoke('comm-whatsapp-react', {
      body: {
        chatId: params.chatId,
        messageId: params.messageId,
        emoji: params.emoji?.trim() || '',
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Não foi possível reagir à mensagem no WhatsApp.'));
    }
  },

  async editMessage(messageId: string, text: string): Promise<{ editedText: string; editedAt: string | null }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-manage-message', {
      body: {
        messageId,
        action: 'edit',
        text,
      },
    });

    if (error) {
      throw new Error(await getFunctionInvokeErrorMessage(error, 'Nao foi possivel editar a mensagem no WhatsApp.'));
    }

    const payload = (data ?? {}) as { editedText?: string; editedAt?: string | null };
    return {
      editedText: typeof payload.editedText === 'string' ? payload.editedText.trim() : text.trim(),
      editedAt: typeof payload.editedAt === 'string' ? payload.editedAt : null,
    };
  },

  async deleteMessage(messageId: string): Promise<{ deletedAt: string | null }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-manage-message', {
      body: {
        messageId,
        action: 'delete',
      },
    });

    if (error) {
      throw new Error(await getFunctionInvokeErrorMessage(error, 'Nao foi possivel apagar a mensagem no WhatsApp.'));
    }

    const payload = (data ?? {}) as { deletedAt?: string | null };
    return {
      deletedAt: typeof payload.deletedAt === 'string' ? payload.deletedAt : null,
    };
  },

  async forwardMessage(messageId: string, targetChatId: string): Promise<{ messageId: string | null; status: string }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-manage-message', {
      body: {
        messageId,
        action: 'forward',
        targetChatId,
      },
    });

    if (error) {
      throw new Error(await getFunctionInvokeErrorMessage(error, 'Nao foi possivel encaminhar a mensagem no WhatsApp.'));
    }

    return parseSendResponse(data);
  },

  async resolveMediaObjectUrl(params: { mediaId?: string | null; mediaUrl?: string | null }): Promise<string | null> {
    const mediaId = params.mediaId?.trim();
    if (!mediaId) {
      return params.mediaUrl?.trim() || null;
    }

    if (!mediaObjectUrlCache.has(mediaId)) {
      mediaObjectUrlCache.set(
        mediaId,
        (async () => {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            throw new Error(getSupabaseErrorMessage(sessionError, 'Nao foi possivel autenticar a midia do WhatsApp.'));
          }

          if (!session?.access_token) {
            throw new Error('Sua sessao expirou. Entre novamente para carregar a midia.');
          }

          const response = await fetch(
            `${supabaseFunctionsUrl}/comm-whatsapp-media?mediaId=${encodeURIComponent(mediaId)}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            },
          );

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(
              typeof payload?.error === 'string' && payload.error.trim()
                ? payload.error.trim()
                : 'Nao foi possivel carregar a midia do WhatsApp.',
            );
          }

          const blob = await response.blob();
          return URL.createObjectURL(blob);
        })().catch((error) => {
          mediaObjectUrlCache.delete(mediaId);
          throw error;
        }),
      );
    }

    return mediaObjectUrlCache.get(mediaId) ?? null;
  },
};
