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

export type ReminderContextItem = Pick<
  Reminder,
  'id' | 'tipo' | 'titulo' | 'descricao' | 'data_lembrete' | 'lido'
>;

export type ReminderPendingItem = Pick<Reminder, 'id' | 'titulo'>;

export type ReminderListItem = Pick<
  Reminder,
  | 'id'
  | 'contract_id'
  | 'lead_id'
  | 'tipo'
  | 'titulo'
  | 'descricao'
  | 'data_lembrete'
  | 'lido'
  | 'prioridade'
  | 'tags'
  | 'tempo_estimado_minutos'
>;

export type ReminderContractContext = Pick<
  Contract,
  'id' | 'lead_id' | 'codigo_contrato'
>;

export type ReminderLeadContext = Pick<
  Lead,
  | 'id'
  | 'nome_completo'
  | 'telefone'
  | 'status'
  | 'responsavel'
  | 'responsavel_id'
  | 'favorito'
  | 'proximo_retorno'
  | 'ultimo_contato'
>;

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

const normalizeReminderListItem = (reminder: ReminderListItem): ReminderListItem => ({
  ...reminder,
  tipo: normalizeReminderType(reminder.tipo),
  titulo: normalizeReminderTitle(reminder.titulo),
});

const normalizeReminderContext = (reminder: ReminderContextItem): ReminderContextItem => ({
  ...reminder,
  tipo: normalizeReminderType(reminder.tipo),
  titulo: normalizeReminderTitle(reminder.titulo),
});

const normalizeReminderPending = (reminder: ReminderPendingItem): ReminderPendingItem => ({
  ...reminder,
  titulo: normalizeReminderTitle(reminder.titulo),
});

const normalizeReminderPatch = (patch: ReminderPatch) => ({
  ...patch,
  ...(typeof patch.tipo === 'string' ? { tipo: normalizeReminderType(patch.tipo) } : {}),
  ...(typeof patch.titulo === 'string' ? { titulo: normalizeReminderTitle(patch.titulo) } : {}),
});

const batchesOf = <T>(items: T[], size = 100): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

export async function listReminders(): Promise<ReminderListItem[]> {
  const reminders = await fetchAllPages<ReminderListItem>(async (from, to) => {
    const result = await databaseClient
      .from('reminders')
      .select(
        'id, contract_id, lead_id, tipo, titulo, descricao, data_lembrete, lido, prioridade, tags, tempo_estimado_minutos',
      )
      .order('data_lembrete', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
      .overrideTypes<ReminderListItem[], { merge: false }>();
    return result;
  });
  return reminders.map(normalizeReminderListItem);
}

const listRemindersByRelation = (
  relation: 'lead_id' | 'contract_id',
  ids: string[],
): Promise<ReminderContextItem[]> => {
  if (ids.length === 0) return Promise.resolve([]);
  return fetchAllPages<ReminderContextItem>(async (from, to) => {
    const result = await databaseClient
      .from('reminders')
      .select('id, tipo, titulo, descricao, data_lembrete, lido')
      .in(relation, ids)
      .eq('lido', false)
      .order('data_lembrete', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
      .overrideTypes<ReminderContextItem[], { merge: false }>();
    return result;
  }).then((reminders) => reminders.map(normalizeReminderContext));
};

export async function listRemindersForLeadContext(
  leadId: string,
  contractIds: string[],
): Promise<{ leadReminders: ReminderContextItem[]; contractReminders: ReminderContextItem[] }> {
  const [leadReminders, contractReminders] = await Promise.all([
    listRemindersByRelation('lead_id', [leadId]),
    listRemindersByRelation('contract_id', contractIds),
  ]);
  return { leadReminders, contractReminders };
}

export async function listPendingRemindersForLead(leadId: string): Promise<ReminderPendingItem[]> {
  const { data, error } = await databaseClient
    .from('reminders')
    .select('id, titulo')
    .eq('lead_id', leadId)
    .eq('lido', false)
    .order('data_lembrete', { ascending: true })
    .order('id', { ascending: true })
    .overrideTypes<ReminderPendingItem[], { merge: false }>();
  if (error) throw error;
  return (data ?? []).map(normalizeReminderPending);
}

async function listByIds<T>(params: {
  table: 'contracts' | 'leads';
  ids: string[];
  select: string;
}): Promise<T[]> {
  const ids = [...new Set(params.ids.filter(Boolean))];
  if (ids.length === 0) {
    return [];
  }

  const pages = await Promise.all(
    batchesOf(ids).map(async (batch) => {
      const result = await databaseClient
        .from(params.table)
        .select(params.select)
        .in('id', batch)
        .overrideTypes<T[], { merge: false }>();
      if (result.error) {
        throw result.error;
      }
      return result.data ?? [];
    }),
  );
  return pages.flat();
}

export const listReminderContracts = (ids: string[]) =>
  listByIds<ReminderContractContext>({
    table: 'contracts',
    ids,
    select: 'id, lead_id, codigo_contrato',
  });

export const listReminderLeads = (ids: string[]) =>
  listByIds<ReminderLeadContext>({
    table: 'leads',
    ids,
    select: 'id, nome_completo, telefone, status, responsavel_id, favorito, proximo_retorno, ultimo_contato',
  });

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
  const normalizedPatch = normalizeReminderPatch(patch);
  const { error } = await databaseClient
    .from('reminders')
    .update(normalizedPatch)
    .eq('id', reminderId);
  if (error) {
    throw error;
  }
}

export async function updateReminders(
  reminderIds: string[],
  patch: ReminderPatch,
): Promise<void> {
  const normalizedPatch = normalizeReminderPatch(patch);
  const { error } = await databaseClient
    .from('reminders')
    .update(normalizedPatch)
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
  let active = true;
  const channel = databaseClient
    .channel(`agenda-reminders-changes-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reminders' },
      (payload: RealtimePostgresChangesPayload<Reminder>) => {
        if (!active) {
          return;
        }

        onChange({
          eventType: payload.eventType,
          current: payload.eventType === 'DELETE' ? null : normalizeReminder(payload.new),
          previous:
            payload.eventType === 'DELETE' ? normalizeReminder(payload.old as Reminder) : null,
        });
      },
    )
    .subscribe();

  return () => {
    active = false;
    void databaseClient.removeChannel(channel);
  };
}
