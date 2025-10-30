import { supabase, WhatsAppConversation } from './supabase';

export interface ZAPIConfig {
  instanceId: string;
  token: string;
}

export interface ZAPIMessage {
  messageId: string;
  phone: string;
  text: string;
  type: 'sent' | 'received';
  timestamp: number;
  fromMe: boolean;
  mediaUrl?: string;
}

export interface ZAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

class ZAPIService {
  private baseUrl = 'https://api.z-api.io';

  async getConfig(): Promise<ZAPIConfig | null> {
    try {
      const { data, error } = await supabase
        .from('api_integrations')
        .select('zapi_instance_id, zapi_token, zapi_enabled')
        .maybeSingle();

      if (error || !data || !data.zapi_enabled) {
        return null;
      }

      if (!data.zapi_instance_id || !data.zapi_token) {
        throw new Error('Configurações do Z-API incompletas');
      }

      return {
        instanceId: data.zapi_instance_id,
        token: data.zapi_token,
      };
    } catch (error) {
      console.error('Erro ao buscar configuração Z-API:', error);
      return null;
    }
  }

  async testConnection(): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return { success: false, error: 'Falha ao conectar com Z-API' };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getChatHistory(phoneNumber: string, limit: number = 100): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/messages/${phone}?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Falha ao buscar histórico' };
      }

      const data = await response.json();
      return { success: true, data: data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async sendTextMessage(phoneNumber: string, message: string): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: phone,
            message: message,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Falha ao enviar mensagem' };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async saveConversationToDatabase(
    leadId: string,
    phoneNumber: string,
    messages: ZAPIMessage[],
    contractId?: string
  ): Promise<void> {
    try {
      const conversations: Partial<WhatsAppConversation>[] = messages.map((msg) => ({
        lead_id: leadId,
        contract_id: contractId,
        phone_number: phoneNumber,
        message_id: msg.messageId,
        message_text: msg.text,
        message_type: msg.fromMe ? 'sent' : 'received',
        timestamp: new Date(msg.timestamp * 1000).toISOString(),
        read_status: true,
        media_url: msg.mediaUrl,
      }));

      for (const conv of conversations) {
        const { error } = await supabase
          .from('whatsapp_conversations')
          .upsert(conv, { onConflict: 'message_id', ignoreDuplicates: true });

        if (error) {
          console.error('Erro ao salvar conversa:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar conversas no banco:', error);
    }
  }

  normalizeZAPIMessages(rawMessages: any[]): ZAPIMessage[] {
    if (!Array.isArray(rawMessages)) return [];

    return rawMessages
      .filter((msg) => msg && msg.text)
      .map((msg) => ({
        messageId: msg.messageId || msg.id || String(Date.now()),
        phone: msg.phone || msg.chatId || '',
        text: msg.text?.message || msg.text || msg.body || '',
        type: msg.fromMe ? 'sent' : 'received',
        timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
        fromMe: msg.fromMe || false,
        mediaUrl: msg.mediaUrl || msg.media,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async fetchAndSaveHistory(
    leadId: string,
    phoneNumber: string,
    contractId?: string
  ): Promise<{ success: boolean; messages: ZAPIMessage[]; error?: string }> {
    try {
      const result = await this.getChatHistory(phoneNumber);

      if (!result.success) {
        return { success: false, messages: [], error: result.error };
      }

      const messages = this.normalizeZAPIMessages(result.data);

      await this.saveConversationToDatabase(leadId, phoneNumber, messages, contractId);

      return { success: true, messages };
    } catch (error) {
      return { success: false, messages: [], error: String(error) };
    }
  }
}

export const zapiService = new ZAPIService();
