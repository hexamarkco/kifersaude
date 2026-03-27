import {
  getSupabaseErrorMessage,
  supabase,
  supabaseFunctionsUrl,
  type CommWhatsAppChannel,
  type CommWhatsAppChat,
  type CommWhatsAppMessage,
} from './supabase';

export type CommWhatsAppOperationalState = {
  channel: CommWhatsAppChannel | null;
  configEnabled: boolean;
  tokenConfigured: boolean;
};

type ListChatsParams = {
  search?: string;
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

export type CommWhatsAppMediaSendKind = 'image' | 'document' | 'audio' | 'voice';

const mediaObjectUrlCache = new Map<string, Promise<string>>();

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
    let query = supabase
      .from('comm_whatsapp_chats')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (params.onlyUnread) {
      query = query.gt('unread_count', 0);
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

    return (data ?? []) as CommWhatsAppChat[];
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

  async sendMediaMessage(params: {
    chatId: string;
    kind: CommWhatsAppMediaSendKind;
    file: File;
    caption?: string;
    durationSeconds?: number;
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
    form.append('file', params.file, params.file.name);

    const response = await fetch(`${supabaseFunctionsUrl}/comm-whatsapp-send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: form,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : 'Nao foi possivel enviar a midia no WhatsApp.';
      throw new Error(message);
    }

    return {
      messageId: typeof payload?.messageId === 'string' ? payload.messageId : null,
      status: typeof payload?.status === 'string' ? payload.status : 'pending',
    };
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
