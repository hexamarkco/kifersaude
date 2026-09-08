import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import {
  databaseClient,
  fetchAllPages,
  supabase,
} from '../../../infrastructure/supabase';
import type { Lead } from '../domain/types';

type LeadDetailsUpdate = Pick<Lead, 'responsavel' | 'proximo_retorno'>;

export type LeadRealtimeChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  current: Lead | null;
  previous: Lead | null;
};

const chunk = <T>(items: T[], size = 100): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export async function listLeads(): Promise<Lead[]> {
  return fetchAllPages<Lead>(async (from, to) => {
    const result = await databaseClient
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)
      .overrideTypes<Lead[], { merge: false }>();
    return result;
  });
}

export async function listContractLeadIds(leadIds: string[]): Promise<Set<string>> {
  if (leadIds.length === 0) {
    return new Set();
  }

  const results = await Promise.all(
    chunk([...new Set(leadIds)]).map(async (leadIdChunk) => {
      const { data, error } = await databaseClient
        .from('contracts')
        .select('lead_id')
        .in('lead_id', leadIdChunk);
      if (error) {
        throw error;
      }
      return data;
    }),
  );

  return new Set(
    results
      .flat()
      .map((contract) => contract.lead_id)
      .filter((leadId): leadId is string => Boolean(leadId)),
  );
}

export async function listNextReminderByLeadId(
  leadIds: string[],
  nowIso = new Date().toISOString(),
): Promise<Map<string, string>> {
  if (leadIds.length === 0) {
    return new Map();
  }

  const results = await Promise.all(
    chunk(leadIds).map(async (leadIdChunk) => {
      const { data, error } = await databaseClient
        .from('reminders')
        .select('lead_id, data_lembrete')
        .in('lead_id', leadIdChunk)
        .eq('lido', false)
        .gte('data_lembrete', nowIso)
        .order('data_lembrete', { ascending: true });
      if (error) {
        throw error;
      }
      return data;
    }),
  );

  const nextReminderByLeadId = new Map<string, string>();
  for (const reminder of results.flat()) {
    if (
      reminder.lead_id
      && reminder.data_lembrete
      && !nextReminderByLeadId.has(reminder.lead_id)
    ) {
      nextReminderByLeadId.set(reminder.lead_id, reminder.data_lembrete);
    }
  }
  return nextReminderByLeadId;
}

export async function updateLeadDetails(
  leadIds: string[],
  updates: Partial<LeadDetailsUpdate>,
): Promise<void> {
  const { error } = await supabase.from('leads').update(updates).in('id', leadIds);
  if (error) {
    throw error;
  }
}

export async function deleteLead(leadId: string): Promise<void> {
  const { error } = await databaseClient.from('leads').delete().eq('id', leadId);
  if (error) {
    throw error;
  }
}

export async function registerLeadContact(
  lead: Lead,
  type: 'Email' | 'Mensagem Automática',
  timestamp: string,
): Promise<void> {
  await supabase.from('interactions').insert([
    {
      lead_id: lead.id,
      tipo: type,
      descricao: `Contato via ${type}`,
      responsavel: lead.responsavel,
    },
  ]);

  const { error } = await supabase
    .from('leads')
    .update({ ultimo_contato: timestamp })
    .eq('id', lead.id);
  if (error) {
    throw error;
  }
}

export async function persistLeadStatusChange(params: {
  lead: Lead;
  newStatus: string;
  timestamp: string;
}): Promise<void> {
  const { lead, newStatus, timestamp } = params;
  const { error } = await supabase
    .from('leads')
    .update({ status: newStatus, ultimo_contato: timestamp })
    .eq('id', lead.id);
  if (error) {
    throw error;
  }

  await supabase.from('interactions').insert([
    {
      lead_id: lead.id,
      tipo: 'Observação',
      descricao: `Status alterado de "${lead.status}" para "${newStatus}"`,
      responsavel: lead.responsavel,
    },
  ]);
  await supabase.from('lead_status_history').insert([
    {
      lead_id: lead.id,
      status_anterior: lead.status,
      status_novo: newStatus,
      responsavel: lead.responsavel,
    },
  ]);
}

export async function clearLeadReminders(leadId: string): Promise<void> {
  const { error: reminderError } = await databaseClient
    .from('reminders')
    .delete()
    .eq('lead_id', leadId);
  if (reminderError) {
    throw reminderError;
  }

  const { error: leadError } = await databaseClient
    .from('leads')
    .update({ proximo_retorno: null })
    .eq('id', leadId);
  if (leadError) {
    throw leadError;
  }
}

export async function createLeadReminder(input: {
  leadId: string;
  type: string;
  title: string;
  description: string | null;
  remindAt: string;
  priority: string;
}): Promise<void> {
  const { error } = await databaseClient.from('reminders').insert({
    lead_id: input.leadId,
    tipo: input.type,
    titulo: input.title,
    descricao: input.description,
    data_lembrete: input.remindAt,
    lido: false,
    prioridade: input.priority,
  });
  if (error) {
    throw error;
  }
}

export function subscribeToLeadChanges(
  onChange: (change: LeadRealtimeChange) => void,
): () => void {
  const channel = supabase
    .channel('leads-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leads' },
      (payload: RealtimePostgresChangesPayload<Lead>) => {
        onChange({
          eventType: payload.eventType,
          current: payload.eventType === 'DELETE' ? null : payload.new,
          previous: payload.eventType === 'DELETE' ? payload.old as Lead : null,
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
