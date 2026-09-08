import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { databaseClient, fetchAllPages } from '../../../infrastructure/supabase';
import type { Contract } from '../domain/types';
import type {
  ContractDependentSearch,
  ContractHolder,
} from '../shared/contractsManagerTypes';

export type ContractsSearchSnapshot = {
  contracts: Contract[];
  holdersByContractId: Record<string, ContractHolder[]>;
  dependentsByContractId: Record<string, ContractDependentSearch[]>;
};

export type ContractRealtimeChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  current: Contract | null;
  previous: Contract | null;
};

const groupByContractId = <T extends { contract_id: string }>(items: T[]) =>
  items.reduce<Record<string, T[]>>((groups, item) => {
    (groups[item.contract_id] ??= []).push(item);
    return groups;
  }, {});

export async function listContractsSearchSnapshot(): Promise<ContractsSearchSnapshot> {
  const [contracts, holders, dependents] = await Promise.all([
    fetchAllPages<Contract>(async (from, to) => {
      const result = await databaseClient
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)
        .overrideTypes<Contract[], { merge: false }>();
      return result;
    }),
    fetchAllPages<ContractHolder>(async (from, to) => {
      const result = await databaseClient
        .from('contract_holders')
        .select(
          'id, contract_id, nome_completo, razao_social, nome_fantasia, cnpj, data_nascimento',
        )
        .range(from, to)
        .overrideTypes<ContractHolder[], { merge: false }>();
      return result;
    }),
    fetchAllPages<ContractDependentSearch>(async (from, to) => {
      const result = await databaseClient
        .from('dependents')
        .select('id, contract_id, nome_completo, data_nascimento')
        .range(from, to)
        .overrideTypes<ContractDependentSearch[], { merge: false }>();
      return result;
    }),
  ]);

  return {
    contracts,
    holdersByContractId: groupByContractId(holders),
    dependentsByContractId: groupByContractId(dependents),
  };
}

export async function deleteContract(contractId: string): Promise<void> {
  const { error } = await databaseClient
    .from('contracts')
    .delete()
    .eq('id', contractId);
  if (error) {
    throw error;
  }
}

export function subscribeToContractChanges(
  onChange: (change: ContractRealtimeChange) => void,
): () => void {
  const channel = databaseClient
    .channel('contracts-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contracts' },
      (payload: RealtimePostgresChangesPayload<Contract>) => {
        onChange({
          eventType: payload.eventType,
          current: payload.eventType === 'DELETE' ? null : payload.new,
          previous:
            payload.eventType === 'DELETE' ? payload.old as Contract : null,
        });
      },
    )
    .subscribe();

  return () => {
    void databaseClient.removeChannel(channel);
  };
}
