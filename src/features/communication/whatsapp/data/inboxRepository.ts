import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import {
  databaseClient,
  fetchAllPages,
  type Database,
} from '../../../../infrastructure/supabase';
import type { Lead } from '../../../leads';
import {
  normalizeReminderTitle,
  normalizeReminderType,
  type Reminder,
} from '../../../reminders';
import type { CommWhatsAppChat, CommWhatsAppPresence } from '../domain/types';

type SubscriptionStatusHandler = (status: 'connected' | 'unavailable') => void;

export type InboxAgendaSummaryReminder = Pick<
  Reminder,
  'id' | 'tipo' | 'titulo' | 'data_lembrete' | 'lido'
>;

export function subscribeToInboxLead(
  leadId: string,
  onUpdate: (lead: Partial<Lead>) => void,
  onStatus?: SubscriptionStatusHandler,
): () => void {
  const channel = databaseClient
    .channel(`comm-whatsapp-selected-lead-${leadId}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
      (payload) => onUpdate(payload.new as Partial<Lead>),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus?.('connected');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus?.('unavailable');
    });
  return () => { void databaseClient.removeChannel(channel); };
}

export function subscribeToInboxReminders(
  leadId: string,
  contractIds: string[],
  onChange: () => void,
): () => void {
  const normalizedLeadId = leadId.trim();
  const normalizedContractIds = Array.from(
    new Set(contractIds.map((contractId) => contractId.trim()).filter(Boolean)),
  );

  if (!normalizedLeadId && normalizedContractIds.length === 0) {
    return () => undefined;
  }

  const channel = databaseClient.channel(`whatsapp-chat-agenda-summary-${crypto.randomUUID()}`);

  if (normalizedLeadId) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reminders',
        filter: `lead_id=eq.${normalizedLeadId}`,
      },
      onChange,
    );
  }

  if (normalizedContractIds.length > 0) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reminders',
        filter: `contract_id=in.(${normalizedContractIds.join(',')})`,
      },
      onChange,
    );
  }

  channel.subscribe();
  return () => { void databaseClient.removeChannel(channel); };
}

export function subscribeToInboxChats(
  channelId: string,
  onChange: (payload: RealtimePostgresChangesPayload<CommWhatsAppChat>) => void,
  onStatus?: SubscriptionStatusHandler,
): () => void {
  const channel = databaseClient
    .channel(`comm-whatsapp-chats-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comm_whatsapp_chats',
        filter: `channel_id=eq.${channelId}`,
      },
      onChange,
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus?.('connected');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus?.('unavailable');
    });
  return () => { void databaseClient.removeChannel(channel); };
}

export function subscribeToInboxPresences(
  channelId: string,
  onChange: (payload: RealtimePostgresChangesPayload<CommWhatsAppPresence>) => void,
  onStatus?: SubscriptionStatusHandler,
): () => void {
  const channel = databaseClient
    .channel(`comm-whatsapp-presences-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comm_whatsapp_presences',
        filter: `channel_id=eq.${channelId}`,
      },
      onChange,
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus?.('connected');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus?.('unavailable');
    });
  return () => { void databaseClient.removeChannel(channel); };
}

export async function listInboxAgendaReminders(
  leadId: string,
  contractIds: string[],
): Promise<InboxAgendaSummaryReminder[]> {
  const [leadReminders, contractReminders] = await Promise.all([
    fetchAllPages<InboxAgendaSummaryReminder>(async (from, to) => databaseClient
      .from('reminders')
      .select('id, tipo, titulo, data_lembrete, lido')
      .eq('lead_id', leadId)
      .order('data_lembrete', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
      .overrideTypes<InboxAgendaSummaryReminder[], { merge: false }>()),
    contractIds.length > 0
      ? fetchAllPages<InboxAgendaSummaryReminder>(async (from, to) => databaseClient
          .from('reminders')
          .select('id, tipo, titulo, data_lembrete, lido')
          .in('contract_id', contractIds)
          .order('data_lembrete', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
          .overrideTypes<InboxAgendaSummaryReminder[], { merge: false }>())
      : Promise.resolve([]),
  ]);

  return Array.from(
    new Map([...leadReminders, ...contractReminders].map((reminder) => [reminder.id, reminder])).values(),
  ).map((reminder) => ({
    ...reminder,
    tipo: normalizeReminderType(reminder.tipo),
    titulo: normalizeReminderTitle(reminder.titulo),
  }));
}

export async function clearInboxLeadAgenda(leadId: string): Promise<void> {
  const { error: reminderError } = await databaseClient.from('reminders').delete().eq('lead_id', leadId);
  if (reminderError) throw reminderError;
  const { error: leadError } = await databaseClient.from('leads').update({ proximo_retorno: null }).eq('id', leadId);
  if (leadError) throw leadError;
}

export async function scheduleInboxFollowUp(input: {
  leadId: string;
  title: string;
  description: string | null;
  dueAt: string;
  priority: string;
  generationId?: string | null;
  origin?: string;
}): Promise<{ inserted: boolean | null; reminderId: string | null }> {
  const result = input.generationId
    ? await databaseClient.rpc('schedule_follow_up_reminder_v2', {
        p_lead_id: input.leadId,
        p_title: normalizeReminderTitle(input.title),
        p_description: input.description,
        p_due_at: input.dueAt,
        p_priority: input.priority,
        p_generation_id: input.generationId,
        p_origin: input.origin ?? 'follow_up_v2_batch',
      } as unknown as Database['public']['Functions']['schedule_follow_up_reminder_v2']['Args'])
    : await databaseClient.rpc('schedule_follow_up_reminder', {
        p_lead_id: input.leadId,
        p_title: normalizeReminderTitle(input.title),
        p_description: input.description,
        p_due_at: input.dueAt,
        p_priority: input.priority,
      } as unknown as Database['public']['Functions']['schedule_follow_up_reminder']['Args']);
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    inserted: row && typeof row === 'object' && 'inserted' in row ? row.inserted === true : null,
    reminderId: row && typeof row === 'object' && 'reminder_id' in row ? String(row.reminder_id) : null,
  };
}

export async function markInboxRemindersRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await databaseClient.from('reminders').update({ lido: true }).in('id', ids);
  if (error) throw error;
}

export async function approveInboxFollowUpSchedule(input: {
  generationId: string;
  dueAt: string;
  reminderId: string | null;
}): Promise<void> {
  const { error } = await databaseClient
    .from('comm_follow_up_audit_log')
    .update({
      schedule_approved: true,
      schedule_approved_at: new Date().toISOString(),
      approved_schedule_date: input.dueAt,
      created_reminder_id: input.reminderId,
    })
    .eq('id', input.generationId);
  if (error) throw error;
}

export async function updateInboxFollowUpSentAudits(
  audits: Array<{ id: string; sentText: string }>,
  sentAt: string,
): Promise<void> {
  const results = await Promise.all(audits.map((audit) => databaseClient
    .from('comm_follow_up_audit_log')
    .update({ sent_text: audit.sentText, sent_at_actual: sentAt })
    .eq('id', audit.id)));
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
}

export async function updateInboxFollowUpSentAudit(
  generationId: string,
  sentText: string,
): Promise<void> {
  await updateInboxFollowUpSentAudits(
    [{ id: generationId, sentText }],
    new Date().toISOString(),
  );
}

export async function insertInboxLegacyFollowUpAudits(
  entries: Array<Record<string, unknown>>,
): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await databaseClient
    .from('comm_follow_up_audit_log')
    .insert(entries as Database['public']['Tables']['comm_follow_up_audit_log']['Insert'][]);
  if (error) throw error;
}
