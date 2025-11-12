import {
  supabase,
  type WhatsAppScheduledMessage,
  type WhatsAppScheduledMessageStatus,
} from './supabase';

export type ScheduleWhatsAppMessagePayload = {
  phoneNumber: string;
  message: string;
  scheduledAt: string;
  timezone?: string | null;
  replyMessageId?: string | null;
};

export type ListScheduledMessagesOptions = {
  statuses?: WhatsAppScheduledMessageStatus[];
  includePast?: boolean;
  limit?: number;
};

const TABLE_NAME = 'whatsapp_scheduled_messages';

const mapScheduledMessage = (row: any): WhatsAppScheduledMessage => ({
  id: row.id,
  phone_number: row.phone_number,
  message_text: row.message_text ?? null,
  media_payload: row.media_payload ?? null,
  scheduled_for: row.scheduled_for,
  status: (row.status as WhatsAppScheduledMessageStatus) ?? 'pending',
  timezone: row.timezone ?? null,
  reply_to_message_id: row.reply_to_message_id ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at ?? null,
  error_message: row.error_message ?? null,
});

export const listScheduledWhatsAppMessages = async (
  phoneNumber: string,
  options: ListScheduledMessagesOptions = {}
): Promise<WhatsAppScheduledMessage[]> => {
  const normalizedPhone = phoneNumber.trim();
  if (!normalizedPhone) {
    return [];
  }

  const { statuses, includePast = false, limit } = options;
  const defaultStatuses: WhatsAppScheduledMessageStatus[] = ['pending', 'scheduled'];
  const query = supabase
    .from(TABLE_NAME)
    .select(
      'id, phone_number, message_text, media_payload, scheduled_for, status, timezone, reply_to_message_id, created_at, updated_at, error_message'
    )
    .eq('phone_number', normalizedPhone)
    .order('scheduled_for', { ascending: true });

  const effectiveStatuses =
    statuses && statuses.length > 0 ? statuses : defaultStatuses;

  query.in('status', effectiveStatuses);

  if (!includePast) {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - 5);
    query.gte('scheduled_for', cutoff.toISOString());
  }

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar mensagens agendadas:', error);
    throw new Error(error.message || 'Não foi possível carregar as mensagens agendadas.');
  }

  return (data ?? []).map(mapScheduledMessage);
};

export const scheduleWhatsAppMessage = async (
  payload: ScheduleWhatsAppMessagePayload
): Promise<WhatsAppScheduledMessage> => {
  const insertPayload: Record<string, unknown> = {
    phone_number: payload.phoneNumber.trim(),
    message_text: payload.message,
    scheduled_for: payload.scheduledAt,
    timezone: payload.timezone ?? null,
    reply_to_message_id: payload.replyMessageId ?? null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(insertPayload)
    .select(
      'id, phone_number, message_text, media_payload, scheduled_for, status, timezone, reply_to_message_id, created_at, updated_at, error_message'
    )
    .single();

  if (error) {
    console.error('Erro ao agendar mensagem do WhatsApp:', error);
    throw new Error(error.message || 'Não foi possível agendar a mensagem.');
  }

  if (!data) {
    throw new Error('Mensagem agendada, mas dados não retornados pelo servidor.');
  }

  return mapScheduledMessage(data);
};

export const cancelScheduledWhatsAppMessage = async (
  id: string
): Promise<WhatsAppScheduledMessage> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select(
      'id, phone_number, message_text, media_payload, scheduled_for, status, timezone, reply_to_message_id, created_at, updated_at, error_message'
    )
    .single();

  if (error) {
    console.error('Erro ao cancelar mensagem agendada:', error);
    throw new Error(error.message || 'Não foi possível cancelar a mensagem agendada.');
  }

  if (!data) {
    throw new Error('Mensagem agendada não encontrada para cancelamento.');
  }

  return mapScheduledMessage(data);
};
