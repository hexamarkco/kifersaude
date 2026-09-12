import { supabase } from '../../../../infrastructure/supabase';

export type ScheduledMessageStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'expired';
export type ScheduledMessageRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type ScheduledMessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'voice';

export type ScheduledMessage = {
  id: string;
  channel_id: string;
  chat_id: string | null;
  phone_digits: string;
  phone_number: string | null;
  display_name: string | null;
  message_type: ScheduledMessageType;
  text_content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  media_size_bytes: number | null;
  scheduled_at: string;
  recurrence: ScheduledMessageRecurrence;
  recurrence_config: Record<string, unknown>;
  next_run_at: string | null;
  recurrence_ends_at: string | null;
  status: ScheduledMessageStatus;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  error_message: string | null;
  external_message_id: string | null;
  delivery_status: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_by: string | null;
  lead_id: string | null;
  contract_id: string | null;
  label: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateScheduledMessageInput = {
  channelId: string;
  phoneDigits: string;
  scheduledAt: string;
  messageType?: ScheduledMessageType;
  textContent?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  recurrence?: ScheduledMessageRecurrence;
  recurrenceConfig?: Record<string, unknown>;
  recurrenceEndsAt?: string | null;
  leadId?: string | null;
  contractId?: string | null;
  label?: string | null;
  notes?: string | null;
  maxAttempts?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function createScheduledMessage(input: CreateScheduledMessageInput): Promise<string> {
  const { data, error } = await db.rpc('create_scheduled_message', {
    p_channel_id: input.channelId,
    p_phone_digits: input.phoneDigits,
    p_scheduled_at: input.scheduledAt,
    p_message_type: input.messageType ?? 'text',
    p_text_content: input.textContent ?? null,
    p_media_url: input.mediaUrl ?? null,
    p_media_mime_type: input.mediaMimeType ?? null,
    p_media_file_name: input.mediaFileName ?? null,
    p_recurrence: input.recurrence ?? 'none',
    p_recurrence_config: input.recurrenceConfig ?? {},
    p_recurrence_ends_at: input.recurrenceEndsAt ?? null,
    p_lead_id: input.leadId ?? null,
    p_contract_id: input.contractId ?? null,
    p_label: input.label ?? null,
    p_notes: input.notes ?? null,
    p_max_attempts: input.maxAttempts ?? 3,
  });

  if (error) throw error;
  return data as string;
}

export async function listScheduledMessages(options?: {
  channelId?: string;
  status?: ScheduledMessageStatus;
  createdBy?: string;
  leadId?: string;
  phoneDigits?: string;
  limit?: number;
  offset?: number;
}): Promise<ScheduledMessage[]> {
  let query = db
    .from('comm_whatsapp_scheduled_messages')
    .select('*')
    .order('scheduled_at', { ascending: false })
    .order('id', { ascending: true });

  if (options?.channelId) {
    query = query.eq('channel_id', options.channelId);
  }
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.createdBy) {
    query = query.eq('created_by', options.createdBy);
  }
  if (options?.leadId) {
    query = query.eq('lead_id', options.leadId);
  }
  if (options?.phoneDigits) {
    query = query.eq('phone_digits', options.phoneDigits);
  }

  const from = options?.offset ?? 0;
  const to = options?.limit ? from + options.limit - 1 : from + 99;

  const { data, error } = await query.range(from, to);

  if (error) throw error;
  return (data ?? []) as ScheduledMessage[];
}

export async function getScheduledMessage(id: string): Promise<ScheduledMessage | null> {
  const { data, error } = await db
    .from('comm_whatsapp_scheduled_messages')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ScheduledMessage;
}

export async function cancelScheduledMessage(id: string, reason?: string): Promise<boolean> {
  const { data, error } = await db.rpc('cancel_scheduled_message', {
    p_message_id: id,
    p_reason: reason ?? null,
  });

  if (error) throw error;
  return data as boolean;
}

export async function deleteScheduledMessage(id: string): Promise<void> {
  const { error } = await db
    .from('comm_whatsapp_scheduled_messages')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateScheduledMessage(
  id: string,
  updates: Partial<Pick<ScheduledMessage,
    | 'text_content'
    | 'media_url'
    | 'media_mime_type'
    | 'media_file_name'
    | 'media_size_bytes'
    | 'scheduled_at'
    | 'recurrence'
    | 'recurrence_config'
    | 'recurrence_ends_at'
    | 'label'
    | 'notes'
    | 'message_type'
  >>,
): Promise<void> {
  const { error } = await db
    .from('comm_whatsapp_scheduled_messages')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function countScheduledMessagesByStatus(
  channelId: string,
): Promise<Record<ScheduledMessageStatus, number>> {
  const { data, error } = await db
    .from('comm_whatsapp_scheduled_messages')
    .select('status')
    .eq('channel_id', channelId);

  if (error) throw error;

  const counts: Record<ScheduledMessageStatus, number> = {
    scheduled: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    expired: 0,
  };

  for (const row of (data ?? []) as { status: string }[]) {
    const status = row.status as ScheduledMessageStatus;
    if (status in counts) {
      counts[status]++;
    }
  }

  return counts;
}

export async function listScheduledMessagesForLead(leadId: string): Promise<ScheduledMessage[]> {
  const { data, error } = await db
    .from('comm_whatsapp_scheduled_messages')
    .select('*')
    .eq('lead_id', leadId)
    .in('status', ['scheduled', 'failed'])
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScheduledMessage[];
}

export function subscribeToScheduledMessages(
  channelId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`comm-whatsapp-scheduled-messages-${channelId}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comm_whatsapp_scheduled_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      onChange,
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}