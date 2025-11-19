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

export type WhatsappLaunchParams = {
  phone: string;
  message?: string | null;
  chatName?: string | null;
  leadId?: string | null;
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
  photo_refreshed_at?: string | null;
  display_name?: string | null;
  crm_lead?: WhatsappChatLeadSummary | null;
  crm_contracts?: WhatsappChatContractSummary[];
  crm_financial_summary?: WhatsappChatFinancialSummary | null;
  sla_metrics?: WhatsappChatSlaMetrics | null;
};

export type WhatsappPresenceStatus = 'online' | 'offline' | 'unknown';

export type WhatsappChatPresenceEvent = {
  type: string | null;
  phone: string | null;
  chatId: string | null;
  status: string | null;
  presence: WhatsappPresenceStatus | null;
  isTyping?: boolean;
  activity?: 'recording' | 'typing';
  lastSeenIso?: string | null;
  timestamp?: number | null;
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

export type WhatsappChatInsightSentiment = 'positive' | 'neutral' | 'negative';

export type WhatsappChatInsight = {
  id: string;
  chat_id: string;
  summary: string | null;
  sentiment: WhatsappChatInsightSentiment | null;
  created_at: string;
};

export type WhatsappChatInsightStatus = 'idle' | 'loading' | 'success' | 'error';

export type WhatsappScheduledMessageStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type WhatsappScheduledMessagePriority = 'low' | 'normal' | 'high' | 'urgent';

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
  priority_level?: WhatsappScheduledMessagePriority;
  priority_order?: number | null;
};

export type WhatsappScheduledMessagesPeriodSummary = {
  period_start: string;
  period_end: string;
  priority_level: WhatsappScheduledMessagePriority;
  status: WhatsappScheduledMessageStatus;
  message_count: number;
  next_scheduled_at: string | null;
};

export type WhatsappChatSlaStatus = 'healthy' | 'warning' | 'critical';

export type WhatsappChatSlaMetrics = {
  chat_id: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_response_ms: number | null;
  pending_inbound_count: number;
  waiting_since: string | null;
  waiting_minutes: number | null;
  sla_status: WhatsappChatSlaStatus;
  sla_breach_started_at?: string | null;
  longest_waiting_response_ms?: number | null;
};

export type WhatsappChatSlaAlert = {
  id: string;
  chat_id: string;
  sla_status: WhatsappChatSlaStatus;
  pending_inbound_count: number;
  waiting_since: string | null;
  waiting_minutes: number | null;
  alert_message: string | null;
  created_at: string;
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
