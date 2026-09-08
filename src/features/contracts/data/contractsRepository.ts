import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import {
  databaseClient,
  fetchAllPages,
  type Database,
} from '../../../infrastructure/supabase';
import type { Contract, ContractHolder } from '../domain/types';
import type {
  ContractDependentSearch,
  ContractHolder as ContractHolderSearch,
} from '../shared/contractsManagerTypes';

export type ContractsSearchSnapshot = {
  contracts: Contract[];
  holdersByContractId: Record<string, ContractHolderSearch[]>;
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
    fetchAllPages<ContractHolderSearch>(async (from, to) => {
      const result = await databaseClient
        .from('contract_holders')
        .select(
          'id, contract_id, nome_completo, razao_social, nome_fantasia, cnpj, data_nascimento',
        )
        .range(from, to)
        .overrideTypes<ContractHolderSearch[], { merge: false }>();
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

export async function saveContractDependent(
  values: Database['public']['Tables']['dependents']['Insert'],
  dependentId?: string,
): Promise<void> {
  const { error } = dependentId
    ? await databaseClient.from('dependents').update(values).eq('id', dependentId)
    : await databaseClient.from('dependents').insert(values);
  if (error) throw error;
}

export async function listContractHolders(
  contractId: string,
): Promise<ContractHolder[]> {
  const { data, error } = await databaseClient
    .from('contract_holders')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at')
    .overrideTypes<ContractHolder[], { merge: false }>();
  if (error) throw error;
  return data ?? [];
}

export async function saveContractHolder(
  input: Database['public']['Tables']['contract_holders']['Insert'],
  holderId?: string,
): Promise<string> {
  if (holderId) {
    const { error } = await databaseClient
      .from('contract_holders')
      .update(input)
      .eq('id', holderId);
    if (error) throw error;
    return holderId;
  }

  const { data, error } = await databaseClient
    .from('contract_holders')
    .insert(input)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
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
