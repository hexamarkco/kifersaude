export type QuickReply = {
  id: string;
  title: string | null;
  text: string;
  created_at: string | null;
  updated_at: string | null;
};

export type CommWhatsAppChannel = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  whapi_channel_id?: string | null;
  connection_status: string;
  health_status: string;
  phone_number?: string | null;
  connected_user_name?: string | null;
  last_health_check_at?: string | null;
  last_webhook_received_at?: string | null;
  last_error?: string | null;
  health_snapshot?: Record<string, unknown> | null;
  limits_snapshot?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppChat = {
  id: string;
  channel_id: string;
  external_chat_id: string;
  phone_number: string;
  phone_digits: string;
  display_name: string;
  saved_contact_name?: string | null;
  push_name?: string | null;
  lead_id?: string | null;
  lead_name?: string | null;
  lead_status?: string | null;
  lead_responsavel_id?: string | null;
  lead_responsavel?: string | null;
  merged_into_chat_id: string | null;
  lead_link_source: 'legacy' | 'manual' | 'crm_start' | 'auto_phone' | 'repair' | null;
  lead_linked_at: string | null;
  lead_linked_by: string | null;
  auto_link_blocked: boolean;
  identity_conflict: boolean;
  is_archived: boolean;
  archived_at?: string | null;
  is_muted: boolean;
  muted_at?: string | null;
  is_pinned: boolean;
  pinned_at?: string | null;
  manual_unread: boolean;
  manual_unread_at?: string | null;
  last_message_text?: string | null;
  last_message_direction: 'inbound' | 'outbound' | 'system';
  last_message_at?: string | null;
  last_message_delivery_status?: string | null;
  unread_count: number;
  status: 'open' | 'pending' | 'closed';
  autonomous_attendance_status: 'inactive' | 'active' | 'handed_off';
  last_read_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppPhoneContact = {
  id: string;
  channel_id: string;
  contact_id: string;
  phone_number: string | null;
  phone_digits: string | null;
  display_name: string;
  short_name?: string | null;
  push_name?: string | null;
  saved: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppMessage = {
  id: string;
  chat_id: string;
  channel_id: string;
  external_message_id?: string | null;
  direction: 'inbound' | 'outbound' | 'system';
  message_type: string;
  delivery_status: string;
  text_content?: string | null;
  message_at: string;
  created_by?: string | null;
  source?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  status_updated_at?: string | null;
  error_message?: string | null;
  media_id?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_file_name?: string | null;
  media_size_bytes?: number | null;
  media_duration_seconds?: number | null;
  media_caption?: string | null;
  transcription_text?: string | null;
  transcription_status?: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | null;
  transcription_provider?: string | null;
  transcription_model?: string | null;
  transcription_error?: string | null;
  transcription_updated_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WhatsAppChat = {
  id: string;
  name: string | null;
  is_group: boolean;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppMessage = {
  id: string;
  chat_id: string;
  from_number: string | null;
  to_number: string | null;
  type: string | null;
  body: string | null;
  has_media: boolean;
  timestamp: string | null;
  direction: 'inbound' | 'outbound' | null;
  payload: Record<string, unknown>;
  transcription_text?: string | null;
  created_at: string;
};

export type WhatsAppWebhookEvent = {
  id: string;
  event: string | null;
  payload: Record<string, unknown>;
  headers: Record<string, unknown> | null;
  created_at: string;
};

