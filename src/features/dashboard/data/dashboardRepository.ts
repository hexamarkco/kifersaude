import {
  databaseClient,
  fetchAllPages,
  type Database,
} from '../../../infrastructure/supabase';
import type { Contract } from '../../contracts';
import type { Lead } from '../../leads';
import type {
  DashboardInteraction,
  DashboardReminder,
  DashboardStatusHistory,
  Dependent,
  Holder,
} from '../shared/dashboardTypes';

export type DashboardSnapshot = {
  leads: Lead[];
  contracts: Contract[];
};

export type DashboardDecisionSnapshot = {
  reminders: DashboardReminder[];
  interactions: DashboardInteraction[];
  statusHistory: DashboardStatusHistory[];
};

export type DashboardCalendarSnapshot = {
  holders: Holder[];
  dependents: Dependent[];
};

const DASHBOARD_LEAD_SELECT =
  'id, nome_completo, telefone, email, cep, endereco, cidade, regiao, estado, origem_id, tipo_contratacao_id, status_id, responsavel_id, operadora_atual, status, data_criacao, ultimo_contato, proximo_retorno, observacoes, blackout_dates, daily_send_limit, skip_automation, arquivado, favorito, created_at, updated_at, canal';

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

type DashboardCalendarHolder = Pick<
  Holder,
  'id' | 'contract_id' | 'nome_completo' | 'data_nascimento' | 'cnpj' | 'razao_social' | 'nome_fantasia'
>;

type DashboardCalendarDependent = Pick<
  Dependent,
  'id' | 'contract_id' | 'nome_completo' | 'data_nascimento'
>;

const chunk = <T>(items: T[], size = 100): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [leads, contracts] = await Promise.all([
    fetchAllPages<Lead>(async (from, to) => databaseClient
      .from('leads')
      .select(DASHBOARD_LEAD_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)
      .overrideTypes<Lead[], { merge: false }>()),
    fetchAllPages<Contract>(async (from, to) => databaseClient
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)
      .overrideTypes<Contract[], { merge: false }>()),
  ]);

  return { leads, contracts };
}

export async function loadDashboardDecisionSnapshot(): Promise<DashboardDecisionSnapshot> {
  const [reminders, interactions, statusHistory] = await Promise.all([
    fetchAllPages<DashboardReminder>(async (from, to) => databaseClient
      .from('reminders')
      .select('id,lead_id,contract_id,tipo,titulo,data_lembrete,lido,concluido_em')
      .order('data_lembrete', { ascending: false })
      .range(from, to)
      .overrideTypes<DashboardReminder[], { merge: false }>()),
    fetchAllPages<DashboardInteraction>(async (from, to) => databaseClient
      .from('interactions')
      .select('lead_id,data_interacao')
      .order('data_interacao', { ascending: false })
      .range(from, to)
      .overrideTypes<DashboardInteraction[], { merge: false }>()),
    fetchAllPages<DashboardStatusHistory>(async (from, to) => databaseClient
      .from('lead_status_history')
      .select('id,lead_id,status_anterior,status_novo,responsavel,created_at')
      .order('created_at', { ascending: false })
      .range(from, to)
      .overrideTypes<DashboardStatusHistory[], { merge: false }>()),
  ]);

  return { reminders, interactions, statusHistory };
}

export async function loadDashboardCalendarSnapshot(
  contractIds: string[],
): Promise<DashboardCalendarSnapshot> {
  const uniqueContractIds = [...new Set(contractIds)].filter(Boolean);
  if (uniqueContractIds.length === 0) {
    return { holders: [], dependents: [] };
  }

  const [holderPages, dependentPages] = await Promise.all([
    Promise.all(
      chunk(uniqueContractIds).map((contractIdChunk) =>
        fetchAllPages<DashboardCalendarHolder>(async (from, to) => databaseClient
          .from('contract_holders')
          .select('id, contract_id, nome_completo, data_nascimento, cnpj, razao_social, nome_fantasia')
          .in('contract_id', contractIdChunk)
          .range(from, to)
          .overrideTypes<DashboardCalendarHolder[], { merge: false }>()),
      ),
    ),
    Promise.all(
      chunk(uniqueContractIds).map((contractIdChunk) =>
        fetchAllPages<DashboardCalendarDependent>(async (from, to) => databaseClient
          .from('dependents')
          .select('id, contract_id, nome_completo, data_nascimento')
          .in('contract_id', contractIdChunk)
          .range(from, to)
          .overrideTypes<DashboardCalendarDependent[], { merge: false }>()),
      ),
    ),
  ]);

  return {
    holders: holderPages.flat(),
    dependents: dependentPages.flat(),
  };
}

export function subscribeToDashboardLeads(
  onChange: (payload: DashboardRealtimePayload<Lead>) => void,
): () => void {
  let active = true;
  const channel = databaseClient
    .channel('dashboard-leads-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leads' },
      (payload) => {
        if (!active) return;

        onChange({
          eventType: payload.eventType,
          new: payload.eventType === 'DELETE' ? null : payload.new as unknown as Lead,
          old: payload.eventType === 'INSERT' ? null : payload.old as unknown as Lead,
        });
      },
    )
    .subscribe();
  return () => {
    active = false;
    void databaseClient.removeChannel(channel);
  };
}

export function subscribeToDashboardContracts(
  onChange: (payload: DashboardRealtimePayload<DashboardContractRealtimeRecord>) => void,
): () => void {
  let active = true;
  const channel = databaseClient
    .channel('dashboard-contracts-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contracts' },
      (payload) => {
        if (!active) return;

        onChange({
          eventType: payload.eventType,
          new: payload.eventType === 'DELETE'
            ? null
            : payload.new as unknown as DashboardContractRealtimeRecord,
          old: payload.eventType === 'INSERT'
            ? null
            : payload.old as unknown as DashboardContractRealtimeRecord,
        });
      },
    )
    .subscribe();
  return () => {
    active = false;
    void databaseClient.removeChannel(channel);
  };
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
