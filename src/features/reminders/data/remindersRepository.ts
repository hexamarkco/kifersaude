import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import {
  databaseClient,
  fetchAllPages,
  type Database,
} from '../../../infrastructure/supabase';
import type { Contract } from '../../contracts';
import type { Lead } from '../../leads';
import type { Reminder } from '../domain/types';
import { normalizeReminderTitle, normalizeReminderType } from '../shared/reminderTypes';

type ReminderPatch = Database['public']['Tables']['reminders']['Update'];

export type ReminderCreateInput =
  Database['public']['Tables']['reminders']['Insert'];

export type ReminderRealtimeChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  current: Reminder | null;
  previous: Reminder | null;
};

const normalizeReminder = (reminder: Reminder): Reminder => ({
  ...reminder,
  tipo: normalizeReminderType(reminder.tipo),
  titulo: normalizeReminderTitle(reminder.titulo),
});

const batchesOf = <T>(items: T[], size = 100): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

export async function listReminders(): Promise<Reminder[]> {
  const reminders = await fetchAllPages<Reminder>(async (from, to) => {
    const result = await databaseClient
      .from('reminders')
      .select('*')
      .order('data_lembrete', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
      .overrideTypes<Reminder[], { merge: false }>();
    return result;
  });
  return reminders.map(normalizeReminder);
}

const listRemindersByRelation = (
  relation: 'lead_id' | 'contract_id',
  ids: string[],
): Promise<Reminder[]> => {
  if (ids.length === 0) return Promise.resolve([]);
  return fetchAllPages<Reminder>(async (from, to) => {
    const result = await databaseClient
      .from('reminders')
      .select('*')
      .in(relation, ids)
      .order('data_lembrete', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
      .overrideTypes<Reminder[], { merge: false }>();
    return result;
  }).then((reminders) => reminders.map(normalizeReminder));
};

export async function listRemindersForLeadContext(
  leadId: string,
  contractIds: string[],
): Promise<{ leadReminders: Reminder[]; contractReminders: Reminder[] }> {
  const [leadReminders, contractReminders] = await Promise.all([
    listRemindersByRelation('lead_id', [leadId]),
    listRemindersByRelation('contract_id', contractIds),
  ]);
  return { leadReminders, contractReminders };
}

async function listByIds<T>(params: {
  table: 'contracts' | 'leads';
  ids: string[];
}): Promise<T[]> {
  const ids = [...new Set(params.ids.filter(Boolean))];
  if (ids.length === 0) {
    return [];
  }

  const pages = await Promise.all(
    batchesOf(ids).map(async (batch) => {
      const result = await databaseClient
        .from(params.table)
        .select('*')
        .in('id', batch);
      if (result.error) {
        throw result.error;
      }
      return result.data as T[];
    }),
  );
  return pages.flat();
}

export const listReminderContracts = (ids: string[]) =>
  listByIds<Contract>({ table: 'contracts', ids });

export const listReminderLeads = (ids: string[]) =>
  listByIds<Lead>({ table: 'leads', ids });

export async function getReminderLead(leadId: string): Promise<Lead | null> {
  const { data, error } = await databaseClient
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as Lead | null;
}

export async function updateReminder(
  reminderId: string,
  patch: ReminderPatch,
): Promise<void> {
  const { error } = await databaseClient
    .from('reminders')
    .update(patch)
    .eq('id', reminderId);
  if (error) {
    throw error;
  }
}

export async function updateReminders(
  reminderIds: string[],
  patch: ReminderPatch,
): Promise<void> {
  const { error } = await databaseClient
    .from('reminders')
    .update(patch)
    .in('id', reminderIds);
  if (error) {
    throw error;
  }
}

export async function createReminder(
  input: ReminderCreateInput,
): Promise<Reminder | null> {
  const normalizedInput = {
    ...input,
    tipo: normalizeReminderType(input.tipo),
    titulo: normalizeReminderTitle(input.titulo),
  };
  const { data, error } = await databaseClient
    .from('reminders')
    .insert(normalizedInput)
    .select('*')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? normalizeReminder(data as Reminder) : null;
}

export async function deleteReminder(reminderId: string): Promise<void> {
  const { error } = await databaseClient
    .from('reminders')
    .delete()
    .eq('id', reminderId);
  if (error) {
    throw error;
  }
}

export async function deleteReminders(reminderIds: string[]): Promise<void> {
  if (reminderIds.length === 0) return;
  const { error } = await databaseClient
    .from('reminders')
    .delete()
    .in('id', reminderIds);
  if (error) throw error;
}

export async function deleteRemindersForLead(leadId: string): Promise<void> {
  const { error } = await databaseClient
    .from('reminders')
    .delete()
    .eq('lead_id', leadId);
  if (error) {
    throw error;
  }
}

export async function markLeadLostFromAgenda(params: {
  leadId: string;
  previousStatus: string;
  responsible?: string | null;
  changedAt: string;
  logHistory: boolean;
}): Promise<void> {
  const { error } = await databaseClient
    .from('leads')
    .update({
      status: 'Perdido',
      proximo_retorno: null,
      ultimo_contato: params.changedAt,
    })
    .eq('id', params.leadId);
  if (error) {
    throw error;
  }

  if (params.logHistory && params.responsible) {
    await databaseClient.from('interactions').insert([
      {
        lead_id: params.leadId,
        tipo: 'Observacao',
        descricao: `Status alterado de "${params.previousStatus}" para "Perdido"`,
        responsavel: params.responsible,
      },
    ]);
    await databaseClient.from('lead_status_history').insert([
      {
        lead_id: params.leadId,
        status_anterior: params.previousStatus,
        status_novo: 'Perdido',
        responsavel: params.responsible,
      },
    ]);
  }

  await deleteRemindersForLead(params.leadId);
}

export function subscribeToReminderChanges(
  onChange: (change: ReminderRealtimeChange) => void,
): () => void {
  const channel = databaseClient
    .channel(`agenda-reminders-changes-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reminders' },
      (payload: RealtimePostgresChangesPayload<Reminder>) => {
        onChange({
          eventType: payload.eventType,
          current: payload.eventType === 'DELETE' ? null : payload.new,
          previous:
            payload.eventType === 'DELETE' ? payload.old as Reminder : null,
        });
      },
    )
    .subscribe();

  return () => {
    void databaseClient.removeChannel(channel);
  };
}
