import {
  getSupabaseErrorMessage,
  supabase,
  supabaseFunctionsUrl,
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

type ListChatsParams = {
  search?: string;
  activityFilter?: 'all' | 'unread';
  leadFilter?: 'all' | 'with_lead' | 'without_lead';
  savedFilter?: 'all' | 'saved' | 'unsaved';
  leadStatusFilters?: string[];
  onlyUnread?: boolean;
  limit?: number;
};

type MessageCursor = {
  messageAt: string;
  id: string;
};

type ListMessagesPageParams = {
  limit?: number;
  before?: MessageCursor | null;
};

export type CommWhatsAppMessagesPage = {
  messages: CommWhatsAppMessage[];
  hasMore: boolean;
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

export type CommWhatsAppTranscriptionResult = {
  transcription_text: string;
  transcription_status: 'completed';
  transcription_provider?: string | null;
  transcription_model?: string | null;
  fallback_used?: boolean;
};

export type CommWhatsAppFollowUpSuggestion = {
  text: string;
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

export const commWhatsAppService = {
  rememberLocalMediaPreview(messageId: string, objectUrl: string) {
    if (!messageId || !objectUrl) return;
    localMediaPreviewByMessageId.set(messageId, objectUrl);
  },

  getRememberedLocalMediaPreview(messageId?: string | null) {
    if (!messageId) return null;
    return localMediaPreviewByMessageId.get(messageId) ?? null;
  },

  async getOperationalState(): Promise<CommWhatsAppOperationalState | null> {
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

  async listChats(params: ListChatsParams = {}): Promise<CommWhatsAppChat[]> {
    const limit = Math.min(Math.max(params.limit ?? 80, 1), 200);
    const activityFilter = params.activityFilter ?? (params.onlyUnread ? 'unread' : 'all');
    const leadFilter = params.leadFilter ?? 'all';
    const savedFilter = params.savedFilter ?? 'all';
    const leadStatusFilters = (params.leadStatusFilters ?? []).map((value) => value.trim()).filter(Boolean);

    let query = supabase
      .from('comm_whatsapp_chats')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (activityFilter === 'unread') {
      query = query.gt('unread_count', 0);
    }

    if (leadFilter === 'with_lead') {
      query = query.not('lead_id', 'is', null);
    } else if (leadFilter === 'without_lead') {
      query = query.is('lead_id', null);
    }

    if (savedFilter === 'saved') {
      query = query.not('saved_contact_name', 'is', null);
    } else if (savedFilter === 'unsaved') {
      query = query.is('saved_contact_name', null);
    }

    const search = sanitizeSearch(params.search ?? '');
    if (search) {
      query = query.or(
        [
          `display_name.ilike.%${search}%`,
          `push_name.ilike.%${search}%`,
          `phone_number.ilike.%${search}%`,
        ].join(','),
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as conversas do WhatsApp.'));
    }

    let chats = (data ?? []) as CommWhatsAppChat[];

    const leadIds = chats.map((chat) => chat.lead_id).filter((leadId): leadId is string => Boolean(leadId));
    if (leadIds.length > 0) {
      const uniqueLeadIds = Array.from(new Set(leadIds));
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, status')
        .in('id', uniqueLeadIds);

      if (leadsError) {
        throw new Error(getSupabaseErrorMessage(leadsError, 'Nao foi possivel carregar os status dos leads vinculados.'));
      }

      const leadStatusById = new Map<string, string | null>();
      for (const lead of leads ?? []) {
        leadStatusById.set(String(lead.id), typeof lead.status === 'string' ? lead.status : null);
      }

      chats = chats.map((chat) => ({
        ...chat,
        lead_status: chat.lead_id ? (leadStatusById.get(chat.lead_id) ?? null) : null,
      }));
    }

    if (leadStatusFilters.length > 0) {
      const allowedStatuses = new Set(leadStatusFilters.map((status) => status.toLowerCase()));
      chats = chats.filter((chat) => {
        const status = chat.lead_status?.trim().toLowerCase();
        return status ? allowedStatuses.has(status) : false;
      });
    }

    return chats;
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

  async listMessagesPage(chatId: string, params: ListMessagesPageParams = {}): Promise<CommWhatsAppMessagesPage> {
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

  async syncChatHistory(chatId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('comm-whatsapp-sync-chat', {
      body: { chatId },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel sincronizar o historico da conversa.'));
    }
  },

  async markChatRead(chatId: string): Promise<void> {
    const { error } = await supabase.rpc('comm_whatsapp_mark_chat_read', {
      p_chat_id: chatId,
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel marcar a conversa como lida.'));
    }
  },

  async sendTextMessage(chatId: string, text: string): Promise<{ messageId: string | null; status: string }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-send', {
      body: { chatId, text },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel enviar a mensagem no WhatsApp.'));
    }

    const payload = (data ?? {}) as { messageId?: string | null; status?: string };
    return {
      messageId: payload.messageId ?? null,
      status: payload.status ?? 'pending',
    };
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

  async generateFollowUp(chatId: string, options: { customInstructions?: string } = {}): Promise<CommWhatsAppFollowUpSuggestion> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-generate-follow-up', {
      body: {
        chatId,
        customInstructions: options.customInstructions?.trim() || '',
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel gerar o follow-up com IA.'));
    }

    const payload = (data ?? {}) as CommWhatsAppFollowUpSuggestion;
    if (!payload.text?.trim()) {
      throw new Error('A IA nao retornou uma sugestao de follow-up.');
    }

    return {
      text: payload.text.trim(),
      provider: payload.provider ?? null,
      model: payload.model ?? null,
      fallback_used: payload.fallback_used === true,
    };
  },

  async retryMediaMessage(messageId: string): Promise<{ messageId: string | null; status: string }> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-retry-message', {
      body: { messageId },
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
    onUploadProgress?: (progress: number | null) => void;
    signal?: AbortSignal;
  }): Promise<{ messageId: string | null; status: string }> {
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
    form.append('caption', params.caption?.trim() || '');
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

        finalize(() =>
          resolve({
            messageId: typeof payload.messageId === 'string' ? payload.messageId : null,
            status: typeof payload.status === 'string' ? payload.status : 'pending',
          }),
        );
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

  async resolveMediaObjectUrl(params: { mediaId?: string | null; mediaUrl?: string | null }): Promise<string | null> {
    if (params.mediaUrl?.trim()) {
      return params.mediaUrl.trim();
    }

    const mediaId = params.mediaId?.trim();
    if (!mediaId) {
      return null;
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
