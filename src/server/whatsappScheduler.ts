import { supabaseAdmin } from '../lib/supabaseAdmin';
import { sendWhatsappMessage } from '../lib/whatsappApi';
import type {
  WhatsappScheduledMessage,
  WhatsappScheduledMessageStatus,
} from '../types/whatsapp';

const SCHEDULE_TABLE = 'whatsapp_scheduled_messages';

type CreateScheduleInput = {
  chatId: string;
  phone: string;
  message: string;
  scheduledSendAt: string;
};

type ScheduleUpdatePayload = Partial<{
  status: WhatsappScheduledMessageStatus;
  sent_at: string | null;
  cancelled_at: string | null;
  last_error: string | null;
  updated_at: string;
}>;

export const scheduleWhatsappMessage = async (
  input: CreateScheduleInput,
): Promise<WhatsappScheduledMessage> => {
  const { chatId, phone, message, scheduledSendAt } = input;

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new Error('Mensagem não pode ser vazia para agendamento.');
  }

  const { data, error } = await supabaseAdmin
    .from(SCHEDULE_TABLE)
    .insert({
      chat_id: chatId,
      phone,
      message: normalizedMessage,
      scheduled_send_at: scheduledSendAt,
      status: 'pending',
    })
    .select('*')
    .single<WhatsappScheduledMessage>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Falha ao criar agendamento de mensagem.');
  }

  return data;
};

type ProcessOptions = {
  now?: Date;
  fetchImpl?: typeof fetch;
};

type ProcessResult = {
  id: string;
  status: 'sent' | 'failed';
  error?: string;
};

const shouldProcessRecord = (record: WhatsappScheduledMessage, reference: Date) => {
  if (record.status !== 'pending') {
    return false;
  }

  const scheduledAt = new Date(record.scheduled_send_at);
  if (Number.isNaN(scheduledAt.getTime())) {
    return false;
  }

  return scheduledAt.getTime() <= reference.getTime();
};

const updateSchedule = async (id: string, payload: ScheduleUpdatePayload) => {
  const { error } = await supabaseAdmin
    .from(SCHEDULE_TABLE)
    .update(payload)
    .eq('id', id);

  if (error) {
    throw error;
  }
};

export const processScheduledMessages = async (
  options: ProcessOptions = {},
): Promise<ProcessResult[]> => {
  const reference = options.now ?? new Date();
  const fetcher = options.fetchImpl ?? fetch;

  const { data, error } = await supabaseAdmin
    .from(SCHEDULE_TABLE)
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_send_at', reference.toISOString())
    .order('scheduled_send_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const records = (data ?? []).filter(record => shouldProcessRecord(record, reference));

  if (records.length === 0) {
    return [];
  }

  const results: ProcessResult[] = [];

  for (const record of records) {
    try {
      const { data: updated, error: processingUpdateError } = await supabaseAdmin
        .from(SCHEDULE_TABLE)
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', record.id)
        .eq('status', 'pending')
        .select('id');

      if (processingUpdateError) {
        throw processingUpdateError;
      }

      if (!updated || updated.length === 0) {
        // O registro foi atualizado por outro worker antes deste ciclo.
        continue;
      }

      await sendWhatsappMessage(
        { phone: record.phone, message: record.message },
        { fetchImpl: fetcher, useServiceKey: true },
      );

      await updateSchedule(record.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
      });

      results.push({ id: record.id, status: 'sent' });
    } catch (processingError) {
      const normalizedError =
        processingError instanceof Error ? processingError.message : String(processingError);

      try {
        await updateSchedule(record.id, {
          status: 'failed',
          updated_at: new Date().toISOString(),
          last_error: normalizedError,
        });
      } catch (updateError) {
        console.error('Falha ao atualizar agendamento após erro:', updateError);
      }

      results.push({ id: record.id, status: 'failed', error: normalizedError });
    }
  }

  return results;
};

export const cancelScheduledMessage = async (id: string) => {
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from(SCHEDULE_TABLE)
    .update({
      status: 'cancelled',
      cancelled_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', id)
    .in('status', ['pending', 'processing']);

  if (error) {
    throw error;
  }
};

export type { WhatsappScheduledMessage };
