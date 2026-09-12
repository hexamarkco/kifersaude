import {
  databaseClient,
  fetchAllPages,
  type Database,
} from '../../../infrastructure/supabase';
import type { Contract } from '../../contracts';
import type { Interaction } from '../../activity';
import type { Lead, LeadStatusHistory } from '../../leads';
import type { Reminder } from '../../reminders';
import type { Dependent, Holder } from '../shared/dashboardTypes';

export type DashboardSnapshot = {
  leads: Lead[];
  contracts: Contract[];
  holders: Holder[];
  dependents: Dependent[];
  reminders: Reminder[];
  interactions: Interaction[];
  statusHistory: LeadStatusHistory[];
};

export type DashboardRealtimePayload<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
};

export type DashboardContractRealtimeRecord = Contract & {
  holders?: Holder[];
  dependents?: Dependent[];
};

export type DashboardReminderInsert = Database['public']['Tables']['reminders']['Insert'];

export type DashboardReminderSummary = Pick<
  Database['public']['Tables']['reminders']['Row'],
  'id' | 'contract_id' | 'lead_id' | 'titulo' | 'tipo' | 'data_lembrete'
>;

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [leads, contracts, holders, dependents, reminders, interactions, statusHistory] = await Promise.all([
    fetchAllPages<Lead>(async (from, to) => databaseClient
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)
      .overrideTypes<Lead[], { merge: false }>()),
    fetchAllPages<Contract>(async (from, to) => databaseClient
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)
      .overrideTypes<Contract[], { merge: false }>()),
    fetchAllPages<Holder>(async (from, to) => databaseClient
      .from('contract_holders')
      .select('*')
      .range(from, to)
      .overrideTypes<Holder[], { merge: false }>()),
    fetchAllPages<Dependent>(async (from, to) => databaseClient
      .from('dependents')
      .select('*')
      .range(from, to)
      .overrideTypes<Dependent[], { merge: false }>()),
    fetchAllPages<Reminder>(async (from, to) => databaseClient
      .from('reminders')
      .select('*')
      .order('data_lembrete', { ascending: false })
      .range(from, to)
      .overrideTypes<Reminder[], { merge: false }>()),
    fetchAllPages<Interaction>(async (from, to) => databaseClient
      .from('interactions')
      .select('*')
      .order('data_interacao', { ascending: false })
      .range(from, to)
      .overrideTypes<Interaction[], { merge: false }>()),
    fetchAllPages<LeadStatusHistory>(async (from, to) => databaseClient
      .from('lead_status_history')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)
      .overrideTypes<LeadStatusHistory[], { merge: false }>()),
  ]);

  return { leads, contracts, holders, dependents, reminders, interactions, statusHistory };
}

export function subscribeToDashboardLeads(
  onChange: (payload: DashboardRealtimePayload<Lead>) => void,
): () => void {
  const channel = databaseClient
    .channel('dashboard-leads-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leads' },
      (payload) => onChange({
        eventType: payload.eventType,
        new: payload.eventType === 'DELETE' ? null : payload.new as unknown as Lead,
        old: payload.eventType === 'INSERT' ? null : payload.old as unknown as Lead,
      }),
    )
    .subscribe();
  return () => { void databaseClient.removeChannel(channel); };
}

export function subscribeToDashboardContracts(
  onChange: (payload: DashboardRealtimePayload<DashboardContractRealtimeRecord>) => void,
): () => void {
  const channel = databaseClient
    .channel('dashboard-contracts-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contracts' },
      (payload) => onChange({
        eventType: payload.eventType,
        new: payload.eventType === 'DELETE'
          ? null
          : payload.new as unknown as DashboardContractRealtimeRecord,
        old: payload.eventType === 'INSERT'
          ? null
          : payload.old as unknown as DashboardContractRealtimeRecord,
      }),
    )
    .subscribe();
  return () => { void databaseClient.removeChannel(channel); };
}

export async function listDashboardRemindersInRange(
  type: string,
  startAt: string,
  endAt: string,
): Promise<DashboardReminderSummary[]> {
  const { data, error } = await databaseClient
    .from('reminders')
    .select('id, contract_id, lead_id, titulo, tipo, data_lembrete')
    .eq('tipo', type)
    .gte('data_lembrete', startAt)
    .lte('data_lembrete', endAt);
  if (error) throw error;
  return data;
}

export async function listDashboardReminderContractIds(
  type: string,
  contractIds: string[],
): Promise<Set<string>> {
  if (contractIds.length === 0) return new Set();
  const { data, error } = await databaseClient
    .from('reminders')
    .select('contract_id')
    .eq('tipo', type)
    .in('contract_id', contractIds);
  if (error) throw error;
  return new Set(data.map((reminder) => reminder.contract_id).filter((id): id is string => Boolean(id)));
}

export async function insertDashboardReminders(
  reminders: DashboardReminderInsert[],
): Promise<void> {
  if (reminders.length === 0) return;
  const { error } = await databaseClient.from('reminders').insert(reminders);
  if (error) throw error;
}

export async function upsertDashboardBirthdayReminders(
  reminders: DashboardReminderInsert[],
): Promise<void> {
  if (reminders.length === 0) return;
  const { error } = await databaseClient.from('reminders').upsert(reminders, {
    onConflict: 'contract_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}
