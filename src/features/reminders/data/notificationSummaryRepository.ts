import { databaseClient } from '../../../infrastructure/supabase';
import type { Contract } from '../../contracts';
import type { Reminder } from '../domain/types';

export type NotificationHolder = {
  id: string;
  cpf: string;
  created_at: string | null;
  contract_id: string;
  nome_completo: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  data_nascimento: string;
};

export type NotificationDependent = {
  id: string;
  cpf: string | null;
  created_at: string | null;
  contract_id: string;
  nome_completo: string;
  data_nascimento: string;
};

export type NotificationSummarySource = {
  reminders: Reminder[];
  contracts: Contract[];
  holders: NotificationHolder[];
  dependents: NotificationDependent[];
};

const batchesOf = <T>(items: T[], size = 100): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

export async function loadNotificationSummarySource(
  startAt: string,
  endAt: string,
): Promise<NotificationSummarySource> {
  const [remindersResult, contractsResult] = await Promise.all([
    databaseClient
      .from('reminders')
      .select('*')
      .gte('data_lembrete', startAt)
      .lte('data_lembrete', endAt)
      .eq('lido', false)
      .order('data_lembrete', { ascending: true })
      .overrideTypes<Reminder[], { merge: false }>(),
    databaseClient
      .from('contracts')
      .select('*')
      .eq('status', 'Ativo')
      .overrideTypes<Contract[], { merge: false }>(),
  ]);

  const error = remindersResult.error
    ?? contractsResult.error;
  if (error) throw error;

  const reminders = remindersResult.data ?? [];
  const contracts = contractsResult.data ?? [];
  const activeContractIds = [...new Set(contracts.map((contract) => contract.id).filter(Boolean))];

  if (activeContractIds.length === 0) {
    return {
      reminders,
      contracts,
      holders: [],
      dependents: [],
    };
  }

  const [holderPages, dependentPages] = await Promise.all([
    Promise.all(
      batchesOf(activeContractIds).map((contractIdBatch) =>
        databaseClient
          .from('contract_holders')
          .select('id, contract_id, cpf, created_at, nome_completo, razao_social, nome_fantasia, data_nascimento')
          .in('contract_id', contractIdBatch)
          .overrideTypes<NotificationHolder[], { merge: false }>(),
      ),
    ),
    Promise.all(
      batchesOf(activeContractIds).map((contractIdBatch) =>
        databaseClient
          .from('dependents')
          .select('id, contract_id, cpf, created_at, nome_completo, data_nascimento')
          .in('contract_id', contractIdBatch)
          .overrideTypes<NotificationDependent[], { merge: false }>(),
      ),
    ),
  ]);

  const peopleError = holderPages.find((page) => page.error)?.error
    ?? dependentPages.find((page) => page.error)?.error;
  if (peopleError) throw peopleError;

  return {
    reminders,
    contracts,
    holders: holderPages.flatMap((page) => page.data ?? []),
    dependents: dependentPages.flatMap((page) => page.data ?? []),
  };
}
