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
  senderName?: string;
  senderPhoto?: string;
  chatName?: string;
  quotedMessageId?: string;
  quotedText?: string;
  quotedSenderName?: string;
  quotedFromMe?: boolean;
  quotedMediaType?: ZAPIMediaType;
  quotedMediaUrl?: string;
}

export interface ZAPIGroupParticipant {
  phone: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  short?: string;
  name?: string;
}

export interface ZAPIGroupMetadata {
  phone: string;
  description?: string | null;
  owner?: string | null;
  subject?: string | null;
  creation?: number | null;
  invitationLink?: string | null;
  invitationLinkError?: string | null;
  communityId?: string | null;
  adminOnlyMessage?: boolean | null;
  adminOnlySettings?: boolean | null;
  requireAdminApproval?: boolean | null;
  isGroupAnnouncement?: boolean | null;
  participants?: ZAPIGroupParticipant[];
  subjectTime?: number | null;
  subjectOwner?: string | null;
}

export interface ZAPIChatNote {
  id: string;
  content: string;
  createdAt: number;
  lastUpdateAt: number;
}

export interface ZAPIChatMetadata {
  phone: string;
  unread?: string | null;
  lastMessageTime?: string | null;
  isMuted?: string | null;
  isMarkedSpam?: boolean | null;
  profileThumbnail?: string | null;
  isGroupAnnouncement?: boolean | null;
  isGroup?: boolean | null;
  notes?: ZAPIChatNote[];
  about?: string | null;
  displayName?: string | null;
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

  async forwardMessage(
    targetPhone: string,
    messageId: string,
    messagePhone: string,
    delayMessage?: number
  ): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const phone = this.normalizePhoneNumber(targetPhone);
      const sourcePhone = this.normalizePhoneNumber(messagePhone);

      if (!messageId) {
        return { success: false, error: 'ID da mensagem é obrigatório' };
      }

      const payload: Record<string, string | number> = {
        phone,
        messageId,
        messagePhone: sourcePhone,
      };

      if (typeof delayMessage === 'number' && Number.isFinite(delayMessage)) {
        payload.delayMessage = delayMessage;
      }

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/forward-message`,
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
        let errorMessage = 'Falha ao encaminhar mensagem';
        try {
          const errorData = (await response.json()) as { message?: string };
          errorMessage = errorData?.message || errorMessage;
        } catch (error) {
          console.warn('Erro ao interpretar resposta de encaminhamento:', error);
        }
        return { success: false, error: errorMessage };
      }

      let data: unknown = null;
      try {
        data = (await response.json()) as unknown;
      } catch (error) {
        data = null;
        console.warn('Resposta sem JSON ao encaminhar mensagem:', error);
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
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

  private pickFirstString(...candidates: unknown[]): string | null {
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    return null;
  }

  private detectGroupChatFromMessage(msg: any, normalizedPhone?: string | null): boolean {
    if (typeof msg?.isGroup === 'boolean') {
      return msg.isGroup;
    }

    if (typeof msg?.chat?.isGroup === 'boolean') {
      return msg.chat.isGroup;
    }

    const candidates = [normalizedPhone, msg?.phone, msg?.chatId, msg?.remoteJid, msg?.jid, msg?.groupId, msg?.id];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const lowerCandidate = candidate.toLowerCase();
        if (lowerCandidate.includes('@g.us') || lowerCandidate.includes('-group')) {
          return true;
        }
        const digits = candidate.replace(/\D/g, '');
        if (digits.length >= 20) {
          return true;
        }
      }
    }

    return false;
  }

  private extractSenderNameFromMessage(msg: any): string | null {
    return this.pickFirstString(
      msg?.senderName,
      msg?.sender_name,
      msg?.sender?.name,
      msg?.sender?.shortName,
      msg?.sender?.pushName,
      msg?.sender?.notifyName,
      msg?.participantName,
      msg?.participantPushName,
      msg?.pushName,
      msg?.contact?.displayName,
      msg?.contact?.name,
      msg?.contact?.formattedName,
      msg?.contact?.shortName,
      msg?.name,
    );
  }

  private extractChatNameFromMessage(msg: any, senderName?: string | null, normalizedPhone?: string | null): string | null {
    const isGroup = this.detectGroupChatFromMessage(msg, normalizedPhone);

    if (isGroup) {
      const explicitGroupName = this.pickFirstString(
        msg?.chatName,
        msg?.chat?.name,
        msg?.chat?.displayName,
        msg?.chat?.subject,
        msg?.groupName,
        msg?.groupSubject,
        msg?.subject,
      );
      if (explicitGroupName) {
        return explicitGroupName;
      }
    }

    return (
      this.pickFirstString(
        msg?.chatName,
        msg?.chat?.name,
        msg?.chat?.displayName,
        msg?.contact?.displayName,
        msg?.contact?.name,
        msg?.contact?.formattedName,
        msg?.contact?.shortName,
      ) || senderName || null
    );
  }

  private extractSenderPhotoFromMessage(msg: any): string | null {
    return this.pickFirstString(
      msg?.senderPhoto,
      msg?.photo,
      msg?.profilePicUrl,
      msg?.profilePicThumb,
      msg?.contact?.photoUrl,
      msg?.chat?.photoUrl,
      msg?.chat?.thumbnailUrl,
      msg?.chat?.icon,
    );
  }

  private extractChatDisplayNameFromMetadata(metadata: any): string | null {
    return this.pickFirstString(
      metadata?.displayName,
      metadata?.name,
      metadata?.profileName,
      metadata?.contactName,
      metadata?.pushName,
      metadata?.formattedName,
      metadata?.shortName,
      metadata?.businessName,
      metadata?.businessProfile?.name,
      metadata?.chatName,
      metadata?.chat?.name,
      metadata?.chat?.displayName,
      metadata?.contact?.displayName,
      metadata?.contact?.formattedName,
    );
  }

  private buildGroupIdCandidates(phone: string): string[] {
    const candidates = new Set<string>();
    const normalized = typeof phone === 'string' ? phone.trim() : '';

    if (normalized) {
      candidates.add(normalized);
    }

    if (normalized.includes('@')) {
      const withoutDomain = normalized.split('@')[0] ?? '';
      if (withoutDomain) {
        candidates.add(withoutDomain);
      }
    }

    const withoutSpaces = normalized.replace(/\s+/g, '');
    if (withoutSpaces) {
      candidates.add(withoutSpaces);
    }

    const baseCandidate = normalized.includes('@') ? normalized.split('@')[0] ?? '' : normalized;
    const digitsOnly = baseCandidate.replace(/\D/g, '');
    if (digitsOnly) {
      candidates.add(digitsOnly);
    }

    const ensureGroupSuffix = (value: string) => {
      if (!value) {
        return;
      }
      if (!value.toLowerCase().includes('-group')) {
        candidates.add(`${value}-group`);
      }
    };

    if (baseCandidate) {
      ensureGroupSuffix(baseCandidate);
    }

    if (digitsOnly) {
      ensureGroupSuffix(digitsOnly);
    }

    return Array.from(candidates).filter((candidate) => candidate.length > 0);
  }

  async sendTextMessage(
    phoneNumber: string,
    message: string,
    replyMessageId?: string
  ): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const phone = this.normalizePhoneNumber(phoneNumber);

      const payload: Record<string, unknown> = {
        phone: phone,
        message: message,
      };

      if (replyMessageId) {
        payload.replyMessageId = replyMessageId;
        payload.quotedMessageId = replyMessageId;
      }

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/send-text`,
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

  async sendReaction(
    phoneNumber: string,
    messageId: string,
    reaction: string,
    delayMessage?: number
  ): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      if (!messageId) {
        return { success: false, error: 'ID da mensagem é obrigatório' };
      }

      if (!reaction) {
        return { success: false, error: 'Escolha uma reação para enviar.' };
      }

      const trimmedPhone = phoneNumber.trim();
      if (!trimmedPhone) {
        return { success: false, error: 'Telefone ou identificador do chat é obrigatório.' };
      }

      const phone = trimmedPhone.includes('@')
        ? trimmedPhone
        : this.normalizePhoneNumber(trimmedPhone);

      const payload: Record<string, unknown> = {
        phone,
        reaction,
        messageId,
      };

      if (typeof delayMessage === 'number') {
        payload.delayMessage = Math.min(Math.max(Math.round(delayMessage), 1), 15);
      }

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/send-reaction`,
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
        let errorMessage = 'Falha ao enviar reação';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (error) {
          console.error('Erro ao interpretar resposta de erro do Z-API:', error);
        }
        return { success: false, error: errorMessage };
      }

      const data = await response.json().catch(() => ({ message: 'Reação enviada' }));
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
    preEncodedDataUrl?: string,
    replyMessageId?: string
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

      if (replyMessageId) {
        payload.replyMessageId = replyMessageId;
        payload.quotedMessageId = replyMessageId;
      }

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
        sender_name: msg.senderName,
        sender_photo: msg.senderPhoto,
        chat_name: msg.chatName,
        quoted_message_id: msg.quotedMessageId,
        quoted_message_text: msg.quotedText,
        quoted_message_sender: msg.quotedSenderName,
        quoted_message_from_me:
          typeof msg.quotedFromMe === 'boolean' ? msg.quotedFromMe : undefined,
        quoted_message_type: msg.quotedMediaType,
        quoted_message_media_url: msg.quotedMediaUrl,
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

    const pickFirstString = (...values: any[]): string | undefined => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return undefined;
    };

    const formatCurrency = (value: unknown, currency?: string): string | null => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
      }

      try {
        const formatter = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: currency && currency.length === 3 ? currency : 'BRL',
          minimumFractionDigits: 2,
        });
        const normalizedValue = value >= 1000 ? value / 100 : value;
        return formatter.format(normalizedValue);
      } catch (error) {
        console.error('Erro ao formatar valor monetário:', error);
        return `${value} ${currency ?? ''}`.trim();
      }
    };

    const describeButtons = (buttons: any[]): string | null => {
      if (!Array.isArray(buttons) || buttons.length === 0) {
        return null;
      }

      const labels = buttons
        .map((button) => {
          if (!button) {
            return null;
          }

          const displayText = pickFirstString(
            button.buttonText?.displayText,
            button.displayText,
            button.urlButton?.displayText,
            button.quickReplyButton?.displayText,
            button.callButton?.displayText,
          );

          if (displayText) {
            return displayText;
          }

          if (typeof button?.text === 'string' && button.text.trim()) {
            return button.text.trim();
          }

          return null;
        })
        .filter((value): value is string => Boolean(value));

      if (labels.length === 0) {
        return null;
      }

      return labels.join(', ');
    };

    const describeNotification = (
      notification: unknown,
      parameters: unknown,
      extras: { profileName?: string | null; updatedPhoto?: string | null; requestMethod?: string | null }
    ): string | null => {
      if (typeof notification !== 'string') {
        return null;
      }

      const normalizedNotification = notification.toUpperCase();
      const paramsArray: any[] = Array.isArray(parameters) ? parameters : parameters ? [parameters] : [];

      const joinParameters = (separator: string = ', '): string | null => {
        const formatted = paramsArray
          .map((item) => {
            if (!item) {
              return null;
            }

            if (typeof item === 'string') {
              return item.trim();
            }

            if (typeof item === 'object') {
              const phone = pickFirstString(item.phone);
              const label = pickFirstString(item.label, item.name, item.role);
              if (phone && label) {
                return `${phone} (${label})`;
              }
              if (phone) {
                return phone;
              }
              if (label) {
                return label;
              }
              return JSON.stringify(item);
            }

            return String(item);
          })
          .filter((value): value is string => Boolean(value));

        if (formatted.length === 0) {
          return null;
        }

        return formatted.join(separator);
      };

      switch (normalizedNotification) {
        case 'MEMBERSHIP_APPROVAL_REQUEST': {
          const participants = joinParameters();
          const method = extras.requestMethod === 'invite_link' ? 'link de convite' : 'participante';
          if (participants) {
            return `Solicitação de entrada no grupo por ${participants} (${method}).`;
          }
          return 'Solicitação de entrada no grupo recebida.';
        }
        case 'REVOKED_MEMBERSHIP_REQUESTS': {
          const participants = joinParameters();
          if (participants) {
            return `Solicitação de entrada cancelada por ${participants}.`;
          }
          return 'Solicitação de entrada cancelada pelo participante.';
        }
        case 'GROUP_PARTICIPANT_ADD': {
          const participants = joinParameters();
          if (participants) {
            return `Participante ${participants} adicionado ao grupo.`;
          }
          return 'Participante adicionado ao grupo.';
        }
        case 'GROUP_PARTICIPANT_REMOVE': {
          const participants = joinParameters();
          if (participants) {
            return `Participante ${participants} removido do grupo.`;
          }
          return 'Participante removido do grupo.';
        }
        case 'GROUP_PARTICIPANT_LEAVE': {
          const participants = joinParameters();
          if (participants) {
            return `Participante ${participants} saiu do grupo.`;
          }
          return 'Participante saiu do grupo.';
        }
        case 'GROUP_CREATE': {
          const subject = joinParameters();
          if (subject) {
            return `Grupo "${subject}" criado.`;
          }
          return 'Grupo criado.';
        }
        case 'GROUP_PARTICIPANT_INVITE': {
          const participants = joinParameters();
          if (participants) {
            return `Convite enviado para ${participants}.`;
          }
          return 'Convite de grupo enviado.';
        }
        case 'CALL_VOICE':
          return 'Chamada de voz recebida.';
        case 'CALL_MISSED_VOICE':
          return 'Chamada de voz perdida.';
        case 'CALL_MISSED_VIDEO':
          return 'Chamada de vídeo perdida.';
        case 'E2E_ENCRYPTED':
        case 'CIPHERTEXT':
          return 'As mensagens são protegidas com criptografia de ponta a ponta.';
        case 'BLUE_MSG_SELF_PREMISE_UNVERIFIED':
          return 'Conta comercial não verificada pelo WhatsApp.';
        case 'BLUE_MSG_SELF_PREMISE_VERIFIED':
          return 'Conta comercial verificada pelo WhatsApp.';
        case 'BIZ_MOVE_TO_CONSUMER_APP':
          return 'Esta conta comercial passou a ser pessoal.';
        case 'REVOKE':
          return 'Uma mensagem foi apagada.';
        case 'NEWSLETTER_ADMIN_PROMOTE': {
          const participant = joinParameters();
          if (participant) {
            return `Administrador promovido no canal: ${participant}.`;
          }
          return 'Administrador promovido no canal.';
        }
        case 'NEWSLETTER_ADMIN_DEMOTE': {
          const participant = joinParameters();
          if (participant) {
            return `Administrador removido do canal: ${participant}.`;
          }
          return 'Administrador removido do canal.';
        }
        case 'PROFILE_NAME_UPDATED': {
          const profileName = pickFirstString(extras.profileName, joinParameters());
          if (profileName) {
            return `Nome do perfil atualizado para ${profileName}.`;
          }
          return 'Nome do perfil atualizado.';
        }
        case 'PROFILE_PICTURE_UPDATED': {
          const photoUrl = pickFirstString(extras.updatedPhoto, joinParameters());
          if (photoUrl) {
            return `Foto do perfil atualizada (${photoUrl}).`;
          }
          return 'Foto do perfil atualizada.';
        }
        case 'CHAT_LABEL_ASSOCIATION': {
          const labels = joinParameters('; ');
          if (labels) {
            return `Atualização de etiquetas: ${labels}.`;
          }
          return 'Etiquetas do chat foram atualizadas.';
        }
        case 'PAYMENT_ACTION_REQUEST_DECLINED':
          return 'Pedido de pagamento foi recusado.';
        default: {
          const params = joinParameters();
          if (params) {
            return `${notification}: ${params}`;
          }
          return notification;
        }
      }
    };

    const describeLocation = (location: any): string | null => {
      if (!location || typeof location !== 'object') {
        return null;
      }

      const parts: string[] = [];
      const title = pickFirstString(location.name, location.title);
      const address = pickFirstString(location.address);
      if (title) {
        parts.push(title);
      }
      if (address) {
        parts.push(address);
      }

      if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        parts.push(`(${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`);
      }

      if (parts.length === 0 && typeof location.url === 'string') {
        parts.push(location.url);
      }

      return parts.length > 0 ? parts.join(' • ') : 'Localização compartilhada';
    };

    const joinNonEmptyParts = (parts: (string | null | undefined)[], separator: string = ' • '): string | null => {
      const filtered = parts.filter((part): part is string => Boolean(part && part.trim()));
      return filtered.length > 0 ? filtered.join(separator) : null;
    };

    const getMessageText = (msg: any): string => {
      if (!msg) return '';

      const baseText = pickFirstString(
        msg.text?.message,
        typeof msg.text === 'string' ? msg.text : undefined,
        msg.text?.body,
        msg.text?.text,
        msg.body,
        msg.message,
        msg.content,
        msg.caption,
      );

      if (baseText) {
        return baseText;
      }

      if (msg.waitingMessage === true) {
        return 'Mensagem aguardando confirmação do WhatsApp.';
      }

      if (msg.reaction?.value) {
        const reference = msg.reaction?.referencedMessage?.messageId
          ? ` à mensagem ${msg.reaction.referencedMessage.messageId}`
          : '';
        return `Reação ${msg.reaction.value}${reference}.`;
      }

      if (msg.buttonsResponseMessage) {
        const response = msg.buttonsResponseMessage;
        const buttonLabel = pickFirstString(response.message);
        const buttonId = pickFirstString(response.buttonId);
        if (buttonLabel && buttonId) {
          return `Resposta de botão: "${buttonLabel}" (ID ${buttonId}).`;
        }
        if (buttonLabel) {
          return `Resposta de botão: "${buttonLabel}".`;
        }
        if (buttonId) {
          return `Resposta de botão com ID ${buttonId}.`;
        }
        return 'Resposta de botão recebida.';
      }

      if (msg.buttonsMessage) {
        const message = pickFirstString(msg.buttonsMessage.message);
        const buttons = describeButtons(msg.buttonsMessage.buttons);
        return (
          joinNonEmptyParts([
            'Mensagem com botões',
            message,
            buttons ? `Opções: ${buttons}` : null,
          ]) ?? 'Mensagem com botões recebida.'
        );
      }

      if (msg.listResponseMessage) {
        const response = msg.listResponseMessage;
        const title = pickFirstString(response.title);
        const selection = pickFirstString(response.message);
        const rowId = pickFirstString(response.selectedRowId);
        return (
          joinNonEmptyParts([
            'Resposta de lista',
            title ? `Lista: ${title}` : null,
            selection,
            rowId ? `Opção ID: ${rowId}` : null,
          ]) ?? 'Resposta de lista recebida.'
        );
      }

      if (msg.hydratedTemplate) {
        const template = msg.hydratedTemplate;
        const headerLocation = describeLocation(template.header?.location);
        const headerText = pickFirstString(
          template.header?.text,
          template.header?.title,
          template.header?.subtitle,
        );
        const title = pickFirstString(template.title);
        const message = pickFirstString(template.message);
        const footer = pickFirstString(template.footer);
        const buttonSummary = describeButtons(template.hydratedButtons);

        return (
          joinNonEmptyParts(
            [
              'Template recebido',
              headerLocation,
              headerText,
              title,
              message,
              footer,
              buttonSummary ? `Botões: ${buttonSummary}` : null,
            ],
            ' • '
          ) ?? 'Template recebido.'
        );
      }

      if (msg.pixKeyMessage) {
        const pix = msg.pixKeyMessage;
        const parts = [
          'Chave PIX recebida',
          pix.key ? `Chave: ${pix.key}` : null,
          pix.keyType ? `Tipo: ${pix.keyType}` : null,
          pix.referenceId ? `Referência: ${pix.referenceId}` : null,
          pix.merchantName ? `Nome: ${pix.merchantName}` : null,
          pix.currency ? `Moeda: ${pix.currency}` : null,
        ];
        return joinNonEmptyParts(parts) ?? 'Chave PIX recebida.';
      }

      if (msg.carouselMessage) {
        const carousel = msg.carouselMessage;
        const cards = Array.isArray(carousel.cards) ? carousel.cards.length : 0;
        return (
          joinNonEmptyParts([
            'Mensagem em carrossel',
            pickFirstString(carousel.text),
            cards > 0 ? `${cards} cartões` : null,
          ]) ?? 'Mensagem em carrossel enviada.'
        );
      }

      if (msg.externalAdReply) {
        const ad = msg.externalAdReply;
        return (
          joinNonEmptyParts([
            'Mensagem de anúncio',
            pickFirstString(ad.title),
            pickFirstString(ad.body),
            pickFirstString(ad.sourceUrl),
          ]) ?? 'Mensagem de anúncio recebida.'
        );
      }

      if (msg.contact) {
        const contact = msg.contact;
        const name = pickFirstString(contact.displayName, contact.name);
        return name ? `Contato compartilhado: ${name}.` : 'Contato compartilhado.';
      }

      if (Array.isArray(msg.contacts) && msg.contacts.length > 0) {
        const names = msg.contacts
          .map((contact: any) => pickFirstString(contact.displayName, contact.name))
          .filter((value): value is string => Boolean(value));
        if (names.length > 0) {
          return `Contatos compartilhados: ${names.join(', ')}.`;
        }
        return 'Contatos compartilhados.';
      }

      if (msg.location) {
        return describeLocation(msg.location) ?? 'Localização compartilhada.';
      }

      if (msg.poll) {
        const question = pickFirstString(msg.poll.question);
        const options = Array.isArray(msg.poll.options)
          ? msg.poll.options
              .map((option: any) => pickFirstString(option.name))
              .filter((value): value is string => Boolean(value))
          : [];
        return (
          joinNonEmptyParts([
            'Enquete recebida',
            question,
            options.length > 0 ? `Opções: ${options.join(', ')}` : null,
          ]) ?? 'Enquete recebida.'
        );
      }

      if (msg.pollVote) {
        const selected = Array.isArray(msg.pollVote.options)
          ? msg.pollVote.options
              .map((option: any) => pickFirstString(option.name))
              .filter((value): value is string => Boolean(value))
          : [];
        return (
          joinNonEmptyParts([
            'Resposta de enquete',
            selected.length > 0 ? `Opções: ${selected.join(', ')}` : null,
          ]) ?? 'Resposta de enquete recebida.'
        );
      }

      if (msg.product) {
        const product = msg.product;
        const price = formatCurrency(product.price, product.currencyCode);
        return (
          joinNonEmptyParts([
            'Produto compartilhado',
            pickFirstString(product.title),
            price ? `Preço: ${price}` : null,
          ]) ?? 'Produto compartilhado.'
        );
      }

      if (msg.order) {
        const order = msg.order;
        const total = formatCurrency(order.total, order.currency);
        return (
          joinNonEmptyParts([
            'Carrinho recebido',
            pickFirstString(order.orderTitle),
            total ? `Total: ${total}` : null,
            typeof order.itemCount === 'number' ? `${order.itemCount} itens` : null,
          ]) ?? 'Carrinho recebido.'
        );
      }

      if (msg.reviewAndPay) {
        const review = msg.reviewAndPay;
        const total = formatCurrency(review.total, review.currency);
        return (
          joinNonEmptyParts([
            'Pedido enviado',
            pickFirstString(review.referenceId),
            total ? `Total: ${total}` : null,
            review.orderStatus ? `Status: ${review.orderStatus}` : null,
            review.paymentStatus ? `Pagamento: ${review.paymentStatus}` : null,
          ]) ?? 'Pedido enviado.'
        );
      }

      if (msg.reviewOrder) {
        const review = msg.reviewOrder;
        const total = formatCurrency(review.total, review.currency);
        return (
          joinNonEmptyParts([
            'Atualização de pedido',
            pickFirstString(review.referenceId),
            total ? `Total: ${total}` : null,
            review.orderStatus ? `Status: ${review.orderStatus}` : null,
            review.paymentStatus ? `Pagamento: ${review.paymentStatus}` : null,
          ]) ?? 'Atualização de pedido recebida.'
        );
      }

      if (msg.requestPayment) {
        const request = msg.requestPayment;
        const amount = formatCurrency(request.value, request.currencyCode);
        const expiration = typeof request.expiration === 'number'
          ? new Date(request.expiration).toLocaleString('pt-BR')
          : null;
        return (
          joinNonEmptyParts([
            'Solicitação de pagamento',
            amount ? `Valor: ${amount}` : null,
            request.requestPhone ? `Para: ${request.requestPhone}` : null,
            expiration ? `Expira em: ${expiration}` : null,
            request.paymentInfo?.status ? `Status: ${request.paymentInfo.status}` : null,
          ]) ?? 'Solicitação de pagamento recebida.'
        );
      }

      if (msg.sendPayment) {
        const info = msg.sendPayment.paymentInfo;
        const amount = formatCurrency(info?.value, info?.currencyCode);
        return (
          joinNonEmptyParts([
            'Pagamento recebido',
            amount ? `Valor: ${amount}` : null,
            info?.transactionStatus ? `Status: ${info.transactionStatus}` : null,
            info?.receiverPhone ? `Destinatário: ${info.receiverPhone}` : null,
          ]) ?? 'Pagamento recebido.'
        );
      }

      if (msg.notification) {
        const description = describeNotification(msg.notification, msg.notificationParameters, {
          profileName: msg.profileName,
          updatedPhoto: msg.updatedPhoto,
          requestMethod: msg.requestMethod,
        });
        if (description) {
          return description;
        }
      }

      if (msg.newsletterAdminInvite) {
        const invite = msg.newsletterAdminInvite;
        return (
          joinNonEmptyParts([
            'Convite para administrador de canal',
            pickFirstString(invite.newsletterName),
            pickFirstString(invite.text),
          ]) ?? 'Convite para administrador de canal recebido.'
        );
      }

      if (msg.pinMessage) {
        const pin = msg.pinMessage;
        const action = pin.action === 'unpin' ? 'Mensagem desafixada' : 'Mensagem fixada';
        const duration = typeof pin.pinDurationInSecs === 'number'
          ? `Duração: ${pin.pinDurationInSecs}s`
          : null;
        return joinNonEmptyParts([action, duration]) ?? action;
      }

      if (msg.event) {
        const event = msg.event;
        const date = typeof event.scheduleTime === 'number'
          ? new Date(event.scheduleTime * 1000).toLocaleString('pt-BR')
          : null;
        return (
          joinNonEmptyParts([
            'Evento compartilhado',
            pickFirstString(event.name),
            pickFirstString(event.description),
            date,
          ]) ?? 'Evento compartilhado.'
        );
      }

      if (msg.eventResponse) {
        const response = msg.eventResponse;
        const time = typeof response.time === 'number'
          ? new Date(response.time).toLocaleString('pt-BR')
          : null;
        return (
          joinNonEmptyParts([
            'Resposta de evento',
            pickFirstString(response.response),
            response.responseFrom ? `De: ${response.responseFrom}` : null,
            time,
          ]) ?? 'Resposta de evento recebida.'
        );
      }

      if (msg.statusImage) {
        return (
          joinNonEmptyParts([
            'Resposta de status',
            pickFirstString(msg.text?.message, msg.text?.text),
          ]) ?? 'Resposta de status recebida.'
        );
      }

      if (msg.sticker) {
        return 'Figurinha recebida.';
      }

      if (msg.video) {
        const caption = pickFirstString(msg.video.caption);
        return caption ? caption : 'Vídeo recebido.';
      }

      if (msg.audio) {
        return 'Mensagem de áudio recebida.';
      }

      if (msg.image) {
        const caption = pickFirstString(msg.image.caption);
        return caption ? caption : 'Imagem recebida.';
      }

      if (msg.document) {
        const title = pickFirstString(msg.document.title, msg.document.fileName);
        return title ? `Documento recebido: ${title}.` : 'Documento recebido.';
      }

      return '';
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

      if (msg.audio || matchesType('audio', 'ptt', 'voice')) {
        return { type: 'audio' };
      }

      if (
        msg.video ||
        matchesType('video', 'mp4', 'mov', 'mkv', '3gp', 'webm')
      ) {
        return { type: 'video' };
      }

      if (
        msg.document ||
        matchesType('pdf', 'doc', 'xls', 'ppt', 'document')
      ) {
        return { type: 'document' };
      }

      if (
        msg.sticker ||
        msg.statusImage ||
        msg.buttonsMessage?.imageUrl ||
        msg.hydratedTemplate?.header?.image ||
        msg.image ||
        matchesType('image', 'jpg', 'jpeg', 'png', 'gif', 'webp')
      ) {
        const isGif =
          matchesType('gif') ||
          msg.image?.isGif === true ||
          msg.image?.gifPlayback === true ||
          msg.gifPlayback === true ||
          msg.isGif === true;
        return { type: isGif ? 'gif' : 'image', isGif };
      }

      if (matchesType('sticker', 'webp')) {
        return { type: 'sticker' };
      }

      if (mediaUrl) {
        return { type: 'document' };
      }

      return { type: undefined };
    };

    const inferMediaType = (value: any): ZAPIMediaType | undefined => {
      if (!value) {
        return undefined;
      }

      const candidate = typeof value === 'object' && 'type' in value ? value.type : value;

      if (candidate === 'gif' || candidate === 'sticker') {
        return 'image';
      }

      return candidate as ZAPIMediaType | undefined;
    };

    const extractMediaDetails = (msg: any) => {
      if (!msg || typeof msg !== 'object') {
        return {} as {
          url?: string;
          type?: ZAPIMediaType;
          mimeType?: string;
          caption?: string;
          thumbnailUrl?: string;
          durationSeconds?: number;
          viewOnce?: boolean;
        };
      }

      const mediaCandidates: {
        url?: string;
        type?: ZAPIMediaType;
        mimeType?: string;
        caption?: string;
        thumbnailUrl?: string;
        durationSeconds?: number;
        viewOnce?: boolean;
      }[] = [];

      const pushCandidate = (type: ZAPIMediaType, source: any) => {
        if (!source) {
          return;
        }

        const url = pickFirstString(
          source.imageUrl,
          source.videoUrl,
          source.audioUrl,
          source.documentUrl,
          source.url,
          source.mediaUrl,
          source.downloadUrl,
          source.directPath,
          source.previewUrl,
        );

        if (!url) {
          return;
        }

        mediaCandidates.push({
          type,
          url,
          mimeType: pickFirstString(source.mimeType, source.mimetype),
          caption: pickFirstString(source.caption, source.title, source.description),
          thumbnailUrl: pickFirstString(
            source.thumbnailUrl,
            source.previewUrl,
            source.image,
            source.thumbnail,
          ),
          durationSeconds:
            typeof source.seconds === 'number'
              ? source.seconds
              : typeof source.duration === 'number'
              ? source.duration
              : undefined,
          viewOnce: typeof source.viewOnce === 'boolean' ? source.viewOnce : undefined,
        });
      };

      pushCandidate('image', msg.image);
      pushCandidate('image', msg.statusImage);
      pushCandidate('image', msg.hydratedTemplate?.header?.image);
      pushCandidate('image', msg.hydratedTemplate?.header?.sticker);

      if (msg.buttonsMessage?.imageUrl) {
        pushCandidate('image', {
          imageUrl: msg.buttonsMessage.imageUrl,
          caption: msg.buttonsMessage.message,
        });
      }

      if (Array.isArray(msg.carouselMessage?.cards)) {
        const firstCard = msg.carouselMessage.cards.find((card: any) => card?.header?.image);
        if (firstCard?.header?.image) {
          pushCandidate('image', firstCard.header.image);
        }
      }

      if (msg.sticker?.stickerUrl) {
        pushCandidate('image', {
          imageUrl: msg.sticker.stickerUrl,
          mimeType: msg.sticker.mimeType,
        });
      }

      pushCandidate('video', msg.video);
      pushCandidate('video', msg.hydratedTemplate?.header?.video);

      if (msg.buttonsMessage?.videoUrl) {
        pushCandidate('video', {
          videoUrl: msg.buttonsMessage.videoUrl,
          caption: msg.buttonsMessage.message,
        });
      }

      pushCandidate('audio', msg.audio);
      pushCandidate('document', msg.document);
      pushCandidate('document', msg.hydratedTemplate?.header?.document);

      const candidateWithUrl = mediaCandidates.find((candidate) => candidate.url);

      if (candidateWithUrl) {
        return candidateWithUrl;
      }

      const fallbackUrl = pickFirstString(
        msg.mediaUrl,
        msg.media,
        msg.url,
        msg.downloadUrl,
        msg.directPath,
        msg.previewUrl,
        msg.file,
        msg.fileUrl,
        msg.imageUrl,
        msg.videoUrl,
        msg.audioUrl,
        msg.documentUrl,
        msg.statusImage?.imageUrl,
        msg.buttonsMessage?.videoUrl,
        msg.buttonsMessage?.imageUrl,
        msg.hydratedTemplate?.header?.image?.imageUrl,
        msg.hydratedTemplate?.header?.video?.videoUrl,
        msg.hydratedTemplate?.header?.document?.documentUrl,
        msg.image?.imageUrl,
        msg.image?.url,
        msg.video?.videoUrl,
        msg.video?.url,
        msg.audio?.audioUrl,
        msg.audio?.url,
        msg.document?.documentUrl,
        msg.document?.url,
        msg.sticker?.stickerUrl,
      );

      if (!fallbackUrl) {
        return {};
      }

      const fallbackMimeType = pickFirstString(
        msg.mimetype,
        msg.mimeType,
        msg.mediaMimeType,
        msg.document?.mimeType,
        msg.image?.mimeType,
        msg.audio?.mimeType,
        msg.video?.mimeType,
        msg.statusImage?.mimeType,
        msg.statusImage?.mimetype,
        msg.hydratedTemplate?.header?.image?.mimeType,
        msg.hydratedTemplate?.header?.video?.mimeType,
        msg.hydratedTemplate?.header?.document?.mimeType,
      );

      const fallbackCaption = pickFirstString(
        msg.caption,
        msg.title,
        msg.description,
        msg.image?.caption,
        msg.video?.caption,
        msg.document?.caption,
        msg.document?.title,
        msg.statusImage?.caption,
        msg.buttonsMessage?.message,
        msg.hydratedTemplate?.message,
        msg.hydratedTemplate?.title,
      );

      const fallbackThumbnail = pickFirstString(
        msg.thumbnailUrl,
        msg.thumbUrl,
        msg.preview,
        msg.previewUrl,
        msg.image?.thumbnailUrl,
        msg.video?.thumbnailUrl,
        msg.document?.thumbnailUrl,
        msg.statusImage?.thumbnailUrl,
        msg.hydratedTemplate?.header?.image?.thumbnailUrl,
        msg.hydratedTemplate?.header?.video?.thumbnailUrl,
      );

      const fallbackDuration =
        typeof msg.seconds === 'number'
          ? msg.seconds
          : typeof msg.duration === 'number'
          ? msg.duration
          : typeof msg.length === 'number'
          ? msg.length
          : typeof msg.audio?.seconds === 'number'
          ? msg.audio.seconds
          : typeof msg.video?.seconds === 'number'
          ? msg.video.seconds
          : undefined;

      const fallbackViewOnce =
        typeof msg.viewOnce === 'boolean'
          ? msg.viewOnce
          : typeof msg.isViewOnce === 'boolean'
          ? msg.isViewOnce
          : typeof msg.image?.viewOnce === 'boolean'
          ? msg.image.viewOnce
          : typeof msg.video?.viewOnce === 'boolean'
          ? msg.video.viewOnce
          : typeof msg.statusImage?.viewOnce === 'boolean'
          ? msg.statusImage.viewOnce
          : undefined;

      const fallbackType = inferMediaType(determineMediaType(msg, fallbackUrl));

      return {
        url: fallbackUrl,
        type: fallbackType,
        mimeType: fallbackMimeType ?? undefined,
        caption: fallbackCaption ?? undefined,
        thumbnailUrl: fallbackThumbnail ?? undefined,
        durationSeconds: fallbackDuration,
        viewOnce: fallbackViewOnce,
      };
    };

    const normalizedMessages: ZAPIMessage[] = [];

    const extractQuotedMessageInfo = (msg: any) => {
      if (!msg) {
        return null;
      }

      const contextInfo = msg.contextInfo || msg.context || {};
      const directQuoted = msg.quotedMsg ?? msg.quotedMessage ?? msg.quoted ?? null;
      const contextQuoted = contextInfo.quotedMessage ?? contextInfo.quotedMsg ?? null;

      const objectCandidates: Record<string, any>[] = [];
      if (directQuoted && typeof directQuoted === 'object') {
        objectCandidates.push(directQuoted);
      }
      if (contextQuoted && typeof contextQuoted === 'object') {
        objectCandidates.push(contextQuoted);
      }

      const quotedIds: unknown[] = [
        msg.quotedMessageId,
        msg.quotedMsgId,
        contextInfo.stanzaId,
        contextInfo.stanzaID,
        contextInfo.stanzaid,
        contextInfo.quotedMessageId,
        contextInfo.id,
      ];

      objectCandidates.forEach((candidate) => {
        quotedIds.push(
          candidate.id,
          candidate.messageId,
          candidate.msgId,
          candidate.stanzaId,
          candidate.stanzaID,
          candidate.key?.id
        );
      });

      const quotedMessageId = pickFirstString(...quotedIds);

      const quotedSenderCandidates: unknown[] = [
        msg.quotedSender,
        msg.quotedParticipantName,
        msg.quotedParticipant,
        contextInfo.participant,
        contextInfo.participantName,
        contextInfo.author,
      ];

      objectCandidates.forEach((candidate) => {
        quotedSenderCandidates.push(
          candidate.senderName,
          candidate.notifyName,
          candidate.pushName,
          candidate.author,
          candidate.participant,
          candidate.sender,
          candidate.from
        );
      });

      const quotedSenderName = pickFirstString(...quotedSenderCandidates);

      const quotedTextCandidates: unknown[] = [
        msg.quotedText,
        msg.quotedBody,
        contextInfo.quotedMessageBody,
        typeof directQuoted === 'string' ? directQuoted : undefined,
        typeof contextQuoted === 'string' ? contextQuoted : undefined,
      ];

      objectCandidates.forEach((candidate) => {
        quotedTextCandidates.push(
          candidate.text,
          candidate.body,
          candidate.caption,
          candidate.title,
          candidate.description,
          candidate.conversation,
          candidate.message?.conversation,
          candidate.message?.extendedTextMessage?.text,
          candidate.message?.imageMessage?.caption,
          candidate.message?.videoMessage?.caption,
          candidate.message?.documentMessage?.caption
        );

        const nestedMessage = candidate.message;
        if (nestedMessage) {
          quotedTextCandidates.push(
            nestedMessage.extendedTextMessage?.text,
            nestedMessage.imageMessage?.caption,
            nestedMessage.videoMessage?.caption,
            nestedMessage.documentMessage?.caption
          );
        }
      });

      const quotedText = pickFirstString(...quotedTextCandidates);

      const quotedMediaCandidates: unknown[] = [];
      objectCandidates.forEach((candidate) => {
        quotedMediaCandidates.push(
          candidate.mediaUrl,
          candidate.media,
          candidate.url,
          candidate.downloadUrl,
          candidate.directPath,
          candidate.previewUrl,
          candidate.imageUrl
        );

        const nestedMessage = candidate.message;
        if (nestedMessage) {
          quotedMediaCandidates.push(
            nestedMessage.imageMessage?.url,
            nestedMessage.videoMessage?.url,
            nestedMessage.documentMessage?.url,
            nestedMessage.audioMessage?.url,
            nestedMessage.stickerMessage?.url
          );
        }
      });

      const quotedMediaUrl = pickFirstString(...quotedMediaCandidates);
      const mediaTypeSource = objectCandidates[0] ?? contextInfo.quotedMessage ?? contextInfo.quotedMsg ?? {};
      const mediaTypeResult = determineMediaType(mediaTypeSource, quotedMediaUrl);
      const quotedMediaType = inferMediaType(mediaTypeResult);

      let quotedFromMe: boolean | undefined;
      for (const candidate of objectCandidates) {
        if (typeof candidate?.fromMe === 'boolean') {
          quotedFromMe = candidate.fromMe;
          break;
        }
        if (typeof candidate?.key?.fromMe === 'boolean') {
          quotedFromMe = candidate.key.fromMe;
          break;
        }
      }

      if (typeof quotedFromMe === 'undefined' && typeof contextInfo.fromMe === 'boolean') {
        quotedFromMe = contextInfo.fromMe;
      }

      if (!quotedMessageId && !quotedText && !quotedMediaUrl && !quotedMediaType) {
        return null;
      }

      return {
        messageId: quotedMessageId ?? undefined,
        text:
          quotedText ||
          (quotedMediaType ? this.getMediaFallbackText(quotedMediaType, undefined) : undefined),
        senderName: quotedSenderName ?? undefined,
        fromMe: quotedFromMe,
        mediaType: quotedMediaType,
        mediaUrl: quotedMediaUrl ?? undefined,
      };
    };

    rawMessages.forEach((msg) => {
      const text = getMessageText(msg);
      const mediaDetails = extractMediaDetails(msg);
      const mediaUrl = mediaDetails.url;
      const fallbackMediaType = inferMediaType(determineMediaType(msg, mediaUrl));
      const resolvedMediaType = mediaDetails.type ?? fallbackMediaType;

      const hasContent =
        Boolean(text) ||
        Boolean(mediaUrl) ||
        Boolean(msg.notification) ||
        Boolean(msg.waitingMessage);

      if (!hasContent) {
        return;
      }

      const mediaDurationSeconds =
        mediaDetails.durationSeconds ??
        (typeof msg.seconds === 'number'
          ? msg.seconds
          : typeof msg.duration === 'number'
          ? msg.duration
          : typeof msg.length === 'number'
          ? msg.length
          : undefined);

      const mediaCaption =
        mediaDetails.caption ?? pickFirstString(msg.caption, msg.title, msg.description, msg.message);
      const mediaThumbnailUrl =
        mediaDetails.thumbnailUrl ??
        pickFirstString(
          msg.thumbnailUrl,
          msg.thumbUrl,
          msg.preview,
          msg.previewUrl,
          msg.image,
          msg.thumbnail,
          msg.image?.thumbnailUrl,
          msg.video?.thumbnailUrl,
          msg.document?.thumbnailUrl,
        );
      const mediaViewOnce =
        typeof mediaDetails.viewOnce === 'boolean'
          ? mediaDetails.viewOnce
          : typeof msg.viewOnce === 'boolean'
          ? msg.viewOnce
          : typeof msg.isViewOnce === 'boolean'
          ? msg.isViewOnce
          : undefined;

      const resolvedText = text || this.getMediaFallbackText(resolvedMediaType, mediaDurationSeconds);

      const phoneValue = msg.phone || msg.chatId || '';
      const normalizedPhone = typeof phoneValue === 'string' ? phoneValue.trim() : '';
      const senderName = this.extractSenderNameFromMessage(msg);
      const chatName = this.extractChatNameFromMessage(msg, senderName, normalizedPhone);
      const senderPhoto = this.extractSenderPhotoFromMessage(msg);
      const quotedInfo = extractQuotedMessageInfo(msg);

      normalizedMessages.push({
        messageId: msg.messageId || msg.id || String(Date.now()),
        phone: phoneValue,
        text: resolvedText,
        type: (msg.fromMe ? 'sent' : 'received') as 'sent' | 'received',
        timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
        fromMe: msg.fromMe || false,
        mediaUrl: mediaUrl || undefined,
        mediaType: resolvedMediaType,
        mediaMimeType:
          mediaDetails.mimeType ||
          pickFirstString(
            msg.mimetype,
            msg.mimeType,
            msg.mediaMimeType,
            msg.document?.mimeType,
            msg.image?.mimeType,
            msg.audio?.mimeType,
            msg.video?.mimeType,
            msg.statusImage?.mimeType,
            msg.statusImage?.mimetype,
            msg.hydratedTemplate?.header?.image?.mimeType,
            msg.hydratedTemplate?.header?.video?.mimeType,
            msg.hydratedTemplate?.header?.document?.mimeType,
          ),
        mediaDurationSeconds,
        mediaThumbnailUrl,
        mediaCaption,
        mediaViewOnce,
        senderName: senderName || undefined,
        chatName: chatName || undefined,
        senderPhoto: senderPhoto || undefined,
        quotedMessageId: quotedInfo?.messageId,
        quotedText: quotedInfo?.text,
        quotedSenderName: quotedInfo?.senderName,
        quotedFromMe: quotedInfo?.fromMe,
        quotedMediaType: quotedInfo?.mediaType,
        quotedMediaUrl: quotedInfo?.mediaUrl,
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

  async getChatMetadata(phoneNumber: string): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const phone = this.normalizePhoneNumber(phoneNumber);

      const response = await fetch(
        `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/chats/${phone}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': this.clientToken,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = 'Falha ao buscar metadata do chat';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (error) {
          console.error('Erro ao interpretar resposta de erro do Z-API:', error);
        }
        return { success: false, error: errorMessage };
      }

      const rawMetadata = await response.json();

      const normalizedNotes: ZAPIChatNote[] | undefined = Array.isArray(rawMetadata?.notes)
        ? rawMetadata.notes
            .filter((note: any) => note && typeof note === 'object')
            .map((note: any) => ({
              id: String(note.id ?? ''),
              content: typeof note.content === 'string' ? note.content : '',
              createdAt: Number(note.createdAt ?? 0),
              lastUpdateAt: Number(note.lastUpdateAt ?? 0),
            }))
        : rawMetadata?.notes && typeof rawMetadata.notes === 'object'
        ? [
            {
              id: String(rawMetadata.notes.id ?? ''),
              content: typeof rawMetadata.notes.content === 'string' ? rawMetadata.notes.content : '',
              createdAt: Number(rawMetadata.notes.createdAt ?? 0),
              lastUpdateAt: Number(rawMetadata.notes.lastUpdateAt ?? 0),
            },
          ]
        : undefined;

      const displayName = this.extractChatDisplayNameFromMetadata(rawMetadata);

      const metadata: ZAPIChatMetadata = {
        phone: this.pickFirstString(rawMetadata?.phone, phone) ?? phone,
        unread: typeof rawMetadata?.unread === 'string' ? rawMetadata.unread : null,
        lastMessageTime: rawMetadata?.lastMessageTime ? String(rawMetadata.lastMessageTime) : null,
        isMuted: typeof rawMetadata?.isMuted === 'string' ? rawMetadata.isMuted : null,
        isMarkedSpam:
          typeof rawMetadata?.isMarkedSpam === 'boolean'
            ? rawMetadata.isMarkedSpam
            : typeof rawMetadata?.isMarkedSpam === 'string'
            ? rawMetadata.isMarkedSpam.toLowerCase() === 'true'
            : null,
        profileThumbnail: this.pickFirstString(rawMetadata?.profileThumbnail, rawMetadata?.profilePicUrl),
        isGroupAnnouncement:
          typeof rawMetadata?.isGroupAnnouncement === 'boolean'
            ? rawMetadata.isGroupAnnouncement
            : null,
        isGroup: typeof rawMetadata?.isGroup === 'boolean' ? rawMetadata.isGroup : null,
        notes: normalizedNotes,
        about: typeof rawMetadata?.about === 'string' ? rawMetadata.about : null,
        displayName: displayName,
      };

      return { success: true, data: metadata };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getGroupMetadata(groupId: string): Promise<ZAPIResponse> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'Z-API não configurado' };
      }

      const candidates = this.buildGroupIdCandidates(groupId);
      let lastError: string | undefined;

      for (const candidate of candidates) {
        try {
          const response = await fetch(
            `${this.baseUrl}/instances/${config.instanceId}/token/${config.token}/group-metadata/${encodeURIComponent(candidate)}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': this.clientToken,
              },
            }
          );

          if (response.ok) {
            const data = (await response.json()) as ZAPIGroupMetadata;
            return { success: true, data };
          }

          if (response.status === 404) {
            lastError = 'Grupo não encontrado';
            continue;
          }

          try {
            const errorData = await response.json();
            lastError = errorData.message || 'Falha ao buscar metadata do grupo';
          } catch (error) {
            lastError = 'Falha ao buscar metadata do grupo';
          }
        } catch (error) {
          lastError = String(error);
        }
      }

      return { success: false, error: lastError || 'Falha ao buscar metadata do grupo' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export const zapiService = new ZAPIService();
