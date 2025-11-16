export type WhatsappChatLeadSummary = {
  id: string;
  nome_completo: string | null;
  telefone: string | null;
  status: string | null;
  responsavel: string | null;
  ultimo_contato?: string | null;
  proximo_retorno?: string | null;
};

export type WhatsappChatContractSummary = {
  id: string;
  codigo_contrato: string | null;
  status: string | null;
  modalidade: string | null;
  operadora: string | null;
  produto_plano: string | null;
  mensalidade_total: number | null;
  comissao_prevista: number | null;
  comissao_recebimento_adiantado: boolean | null;
  responsavel: string | null;
  previsao_recebimento_comissao: string | null;
  previsao_pagamento_bonificacao: string | null;
};

export type WhatsappChatFinancialSummary = {
  total_mensalidade?: number | null;
  total_comissao?: number | null;
  total_bonus?: number | null;
};

export type WhatsappChat = {
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
  crm_lead?: WhatsappChatLeadSummary | null;
  crm_contracts?: WhatsappChatContractSummary[];
  crm_financial_summary?: WhatsappChatFinancialSummary | null;
};

export type WhatsappMessage = {
  id: string;
  chat_id: string;
  message_id: string | null;
  from_me: boolean;
  status: string | null;
  text: string | null;
  moment: string | null;
  raw_payload: Record<string, any> | null;
};

export type SendWhatsappMessageResponse =
  | {
      success: true;
      message: WhatsappMessage;
      chat: WhatsappChat;
    }
  | {
      success: false;
      error?: string;
    };

export type WhatsappScheduledMessageStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type WhatsappScheduledMessage = {
  id: string;
  chat_id: string;
  phone: string;
  message: string;
  scheduled_send_at: string;
  status: WhatsappScheduledMessageStatus;
  created_at: string | null;
  updated_at: string | null;
  sent_at: string | null;
  cancelled_at?: string | null;
  last_error?: string | null;
};

export type WhatsappChatMetadataNote = {
  id: string | null;
  content: string | null;
  createdAt: number | null;
  createdAtIso: string | null;
  lastUpdateAt: number | null;
  lastUpdateAtIso: string | null;
};

export type WhatsappChatMetadata = {
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
  notes: WhatsappChatMetadataNote | null;
  raw: Record<string, unknown> | null;
};
