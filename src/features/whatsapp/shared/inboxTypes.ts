import type { Lead } from '../../../lib/supabase';
import type { OutboundRetryPayload } from '../composer/types';

export type WhatsAppChat = {
  id: string;
  name: string | null;
  is_group: boolean;
  phone_number?: string | null;
  lid?: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_direction?: 'inbound' | 'outbound' | null;
  unread_count?: number;
  archived?: boolean | null;
  pinned?: number | null;
  mute_until?: string | null;
};

export type WhatsAppMessageAction = {
  type?: string;
  target?: string;
  emoji?: string;
  [key: string]: unknown;
};

export type WhatsAppMessageReaction = {
  emoji?: string;
  count?: number;
};

export type WhatsAppMessagePayload = {
  action?: WhatsAppMessageAction;
  reactions?: WhatsAppMessageReaction[];
  [key: string]: unknown;
};

export type WhatsAppMessage = {
  id: string;
  local_ref?: string | null;
  chat_id: string;
  from_number: string | null;
  to_number: string | null;
  type: string | null;
  body: string | null;
  has_media: boolean;
  timestamp: string | null;
  direction: 'inbound' | 'outbound' | null;
  ack_status: number | null;
  send_state?: 'pending' | 'failed' | null;
  error_message?: string | null;
  retry_payload?: OutboundRetryPayload | null;
  created_at: string;
  payload?: WhatsAppMessagePayload | null;
  transcription_text?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  edit_count?: number;
  edited_at?: string | null;
  original_body?: string | null;
  author?: string | null;
};

export type ChatKindFilter = 'groups' | 'direct' | 'channels' | 'broadcasts';

export type ReminderQuickOpenItem = {
  id: string;
  title: string;
  type: string;
  priority: string;
  contractId?: string | null;
  description?: string | null;
  dueAt: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadStatus?: string | null;
};

export type ReminderQuickOpenPeriod = 'overdue' | 'today' | 'thisWeek' | 'thisMonth' | 'later';

export type ReminderQuickOpenSchedulerDefaults = {
  defaultTitle?: string;
  defaultDescription?: string;
  defaultType?: 'Retorno' | 'Follow-up' | 'Outro';
  defaultPriority?: 'normal' | 'alta' | 'baixa';
};

export type ChatLeadPresenceFilter = 'all' | 'withLead' | 'withoutLead';

export type ChatMenuSource = 'row' | 'header-button';

export type ChatMenuState = {
  chatId: string;
  anchorRect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  source: ChatMenuSource;
};

export type ReminderSchedulerRequest = {
  lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;
  promptMessage?: string;
  defaults?: ReminderQuickOpenSchedulerDefaults;
};
