import { supabase, WhatsAppConversation } from './supabase';

export interface ZAPIConfig {
  instanceId: string;
  token: string;
}

export type ZAPIMediaType = 'image' | 'video' | 'audio' | 'document';

export interface ZAPIMessage {
  messageId: string;
  phone: string;
  text: string;
  type: 'sent' | 'received';
  timestamp: number;
  fromMe: boolean;
  mediaUrl?: string;
  mediaType?: ZAPIMediaType;
  mediaMimeType?: string;
  mediaDurationSeconds?: number;
  mediaThumbnailUrl?: string;
  mediaCaption?: string;
  mediaViewOnce?: boolean;
}

export interface ZAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const CLIENT_TOKEN = 'Faca52aa7804f429186a4a7734f8a3d66S';

class ZAPIService {
  private baseUrl = 'https://api.z-api.io';
  private clientToken = CLIENT_TOKEN;

  private normalizePhoneNumber(phoneNumber: string): string {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  }

  private getMediaFallbackText(mediaType?: ZAPIMediaType, durationSeconds?: number): string {
    if (!mediaType) {
      return 'Mensagem recebida';
    }

    switch (mediaType) {
      case 'audio': {
        const seconds = typeof durationSeconds === 'number' ? `${Math.round(durationSeconds)}s` : null;
        return seconds ? `Áudio recebido (${seconds})` : 'Áudio recebido';
      }
      case 'video': {
        const seconds = typeof durationSeconds === 'number' ? `${Math.round(durationSeconds)}s` : null;
        return seconds ? `Vídeo recebido (${seconds})` : 'Vídeo recebido';
      }
      case 'image':
        return 'Imagem recebida';
      case 'document':
        return 'Documento recebido';
      default:
        return 'Mensagem recebida';
    }
  }

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
            'Client-Token': this.clientToken,
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

      const phone = this.normalizePhoneNumber(phoneNumber);

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/messages/${phone}?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': this.clientToken,
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

      const phone = this.normalizePhoneNumber(phoneNumber);

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': this.clientToken,
          },
          body: JSON.stringify({
            phone: phone,
            message: message,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Falha ao enviar mensagem';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (error) {
          console.error('Erro ao interpretar resposta de erro do Z-API:', error);
        }
        return { success: false, error: errorMessage };
      }

      const data = await response
        .json()
        .catch(() => ({ message: 'Mensagem enviada' }));
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private async fileToDataUrl(file: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Falha ao converter arquivo para Base64.'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  private getFileExtension(filename: string): string | null {
    const parts = filename.split('.');
    if (parts.length < 2) {
      return null;
    }
    return parts.pop()?.toLowerCase() ?? null;
  }

  async sendMediaMessage(
    phoneNumber: string,
    file: Blob,
    filename: string,
    mediaType: ZAPIMediaType,
    caption?: string,
    preEncodedDataUrl?: string
  ): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const phone = this.normalizePhoneNumber(phoneNumber);

      const dataUrl = preEncodedDataUrl ?? (await this.fileToDataUrl(file));

      if (mediaType === 'audio') {
        console.log('Áudio convertido para Base64:', dataUrl);
      }

      let endpoint: string;
      const payload: Record<string, unknown> = {
        phone,
      };

      switch (mediaType) {
        case 'image':
          endpoint = 'send-image';
          payload.image = dataUrl;
          if (caption) {
            payload.caption = caption;
          }
          break;
        case 'audio':
          endpoint = 'send-audio';
          payload.audio = dataUrl;
          break;
        case 'video':
          endpoint = 'send-video';
          payload.video = dataUrl;
          if (caption) {
            payload.caption = caption;
          }
          break;
        case 'document':
        default: {
          const extension = this.getFileExtension(filename) ?? 'bin';
          endpoint = `send-document/${extension}`;
          payload.document = dataUrl;
          payload.fileName = filename;
          if (caption) {
            payload.caption = caption;
          }
          break;
        }
      }

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': this.clientToken,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        let errorMessage = 'Falha ao enviar mídia';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (error) {
          console.error('Erro ao interpretar resposta de erro do Z-API:', error);
        }
        return { success: false, error: errorMessage };
      }

      const data = await response
        .json()
        .catch(() => ({ message: 'Mídia enviada' }));
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
        message_text: msg.text || this.getMediaFallbackText(msg.mediaType, msg.mediaDurationSeconds),
        message_type: msg.fromMe ? 'sent' : 'received',
        timestamp: new Date(msg.timestamp * 1000).toISOString(),
        read_status: true,
        media_url: msg.mediaUrl,
        media_type: msg.mediaType,
        media_mime_type: msg.mediaMimeType,
        media_duration_seconds:
          typeof msg.mediaDurationSeconds === 'number' ? Math.round(msg.mediaDurationSeconds) : undefined,
        media_thumbnail_url: msg.mediaThumbnailUrl,
        media_caption: msg.mediaCaption,
        media_view_once: typeof msg.mediaViewOnce === 'boolean' ? msg.mediaViewOnce : undefined,
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

    const getMessageText = (msg: any): string => {
      if (!msg) return '';

      const candidates = [
        msg.text?.message,
        typeof msg.text === 'string' ? msg.text : undefined,
        msg.text?.body,
        msg.text?.text,
        msg.body,
        msg.message,
        msg.content,
        msg.caption,
      ];

      const normalized = candidates.find((value) => typeof value === 'string') || '';
      return normalized.trim();
    };

    const pickFirstString = (...values: any[]): string | undefined => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return undefined;
    };

    const determineMediaType = (msg: any, mediaUrl?: string): ZAPIMediaType | undefined => {
      const rawType = typeof msg.type === 'string' ? msg.type.toLowerCase() : undefined;
      const mimeType = typeof msg.mimetype === 'string' ? msg.mimetype.toLowerCase() : undefined;
      const captionType = typeof msg.mediaType === 'string' ? msg.mediaType.toLowerCase() : undefined;
      const source = mediaUrl || '';
      const extension = source.split('?')[0]?.split('.').pop()?.toLowerCase();

      const matchesType = (...types: string[]) =>
        [rawType, captionType, extension, mimeType].some((value) =>
          value ? types.some((type) => value.includes(type)) : false
        );

      if (matchesType('audio', 'ptt', 'voice')) {
        return { type: 'audio' };
      }

      if (matchesType('gif') || rawType === 'gif' || msg.gifPlayback === true || msg.isGif === true) {
        return { type: 'gif', isGif: true };
      }

      if (matchesType('sticker', 'webp')) {
        return { type: 'sticker' };
      }

      if (matchesType('video', 'mp4', 'mov', 'mkv', '3gp', 'webm')) {
        return { type: 'video' };
      }

      if (matchesType('image', 'jpg', 'jpeg', 'png', 'gif', 'webp')) {
        const isGif = matchesType('gif');
        return { type: isGif ? 'gif' : 'image', isGif };
      }

      if (mediaUrl) {
        return { type: 'document' };
      }

      return { type: undefined };
    };

    const normalizedMessages: ZAPIMessage[] = [];

    rawMessages.forEach((msg) => {
      const mediaUrl = msg.mediaUrl || msg.media;
      const text = getMessageText(msg);
      const { type: mediaType, isGif } = determineMediaType(msg, mediaUrl);
      const hasContent = Boolean(text) || Boolean(mediaUrl) || Boolean(msg.notification);

      if (!hasContent) {
        return;
      }

      const mediaDurationSeconds =
        typeof msg.seconds === 'number'
          ? msg.seconds
          : typeof msg.duration === 'number'
          ? msg.duration
          : typeof msg.length === 'number'
          ? msg.length
          : undefined;

      const mediaCaption = pickFirstString(msg.caption, msg.title, msg.description);
      const mediaThumbnailUrl = pickFirstString(
        msg.thumbnailUrl,
        msg.thumbUrl,
        msg.preview,
        msg.previewUrl,
        msg.image,
        msg.thumbnail
      );
      const mediaViewOnce =
        typeof msg.viewOnce === 'boolean'
          ? msg.viewOnce
          : typeof msg.isViewOnce === 'boolean'
          ? msg.isViewOnce
          : undefined;

      normalizedMessages.push({
        messageId: msg.messageId || msg.id || String(Date.now()),
        phone: msg.phone || msg.chatId || '',
        text: resolvedText,
        type: (msg.fromMe ? 'sent' : 'received') as 'sent' | 'received',
        timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
        fromMe: msg.fromMe || false,
        mediaUrl: mediaUrl || undefined,
        mediaType,
        mediaMimeType: msg.mimetype || msg.mimeType,
        mediaDurationSeconds,
        mediaThumbnailUrl,
        mediaCaption,
        mediaViewOnce,
      });
    });

    return normalizedMessages.sort((a, b) => a.timestamp - b.timestamp);
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
