import {
  getSupabaseErrorMessage,
  supabase,
  type CommWhatsAppChannel,
  type CommWhatsAppChat,
  type CommWhatsAppMessage,
} from './supabase';

export type CommWhatsAppAdminState = {
  channel: CommWhatsAppChannel;
  config: {
    enabled: boolean;
    token: string;
    tokenConfigured: boolean;
    webhookUrl: string;
  };
};

type ListChatsParams = {
  search?: string;
  onlyUnread?: boolean;
  limit?: number;
};

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
  async getPrimaryChannel(): Promise<CommWhatsAppChannel | null> {
    const { data, error } = await supabase.rpc('comm_whatsapp_get_channel_state');

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar o canal do WhatsApp.'));
    }

    const rows = Array.isArray(data) ? data : [];
    return (rows[0] as CommWhatsAppChannel | undefined) ?? null;
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

  async listMessages(chatId: string, limit: number = 80): Promise<CommWhatsAppMessage[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const { data, error } = await supabase
      .from('comm_whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('message_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar as mensagens do WhatsApp.'));
    }

    return ((data ?? []) as CommWhatsAppMessage[]).reverse();
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

  async getAdminState(): Promise<CommWhatsAppAdminState> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-admin', {
      body: { action: 'getConfig' },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar a configuracao do WhatsApp.'));
    }

    return data as CommWhatsAppAdminState;
  },

  async saveAdminConfig(payload: { token: string; enabled: boolean }): Promise<CommWhatsAppAdminState> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-admin', {
      body: {
        action: 'saveConfig',
        token: payload.token,
        enabled: payload.enabled,
      },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel salvar a configuracao do WhatsApp.'));
    }

    return data as CommWhatsAppAdminState;
  },

  async refreshHealth(): Promise<CommWhatsAppAdminState> {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-admin', {
      body: { action: 'refreshHealth' },
    });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error, 'Nao foi possivel atualizar a saude do canal.'));
    }

    return data as CommWhatsAppAdminState;
  },
};
