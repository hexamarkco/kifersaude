import { databaseClient, type Database } from '../../../infrastructure/supabase';
import type { Interaction } from '../../activity';
import type {
  ContractHolder,
  ContractValueAdjustment,
  Dependent,
} from '../domain/types';

export type ContractDocument = Database['public']['Tables']['documents']['Row'];

export type ContractDetailsSnapshot = {
  holders: ContractHolder[];
  dependents: Dependent[];
  interactions: Interaction[];
  adjustments: ContractValueAdjustment[];
  documents: ContractDocument[];
  documentsError: unknown | null;
};

export type ContractInteractionInput = Pick<
  Interaction,
  'tipo' | 'descricao' | 'responsavel'
>;

export async function getContractDetailsSnapshot(
  contractId: string,
): Promise<ContractDetailsSnapshot> {
  const [holdersResult, dependentsResult, interactionsResult, adjustmentsResult] =
    await Promise.all([
      databaseClient
        .from('contract_holders')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at')
        .overrideTypes<ContractHolder[], { merge: false }>(),
      databaseClient
        .from('dependents')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at')
        .overrideTypes<Dependent[], { merge: false }>(),
      databaseClient
        .from('interactions')
        .select('*')
        .eq('contract_id', contractId)
        .order('data_interacao', { ascending: false })
        .overrideTypes<Interaction[], { merge: false }>(),
      databaseClient
        .from('contract_value_adjustments')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at')
        .overrideTypes<ContractValueAdjustment[], { merge: false }>(),
    ]);

  const holders = holdersResult.data ?? [];
  const dependents = dependentsResult.data ?? [];
  const entityIds = [
    ...holders.map((holder) => holder.id),
    ...dependents.map((dependent) => dependent.id),
  ];

  if (entityIds.length === 0) {
    return {
      holders,
      dependents,
      interactions: interactionsResult.data ?? [],
      adjustments: adjustmentsResult.data ?? [],
      documents: [],
      documentsError: null,
    };
  }

  const documentsResult = await databaseClient
    .from('documents')
    .select('*')
    .in('entity_id', entityIds);

  return {
    holders,
    dependents,
    interactions: interactionsResult.data ?? [],
    adjustments: adjustmentsResult.data ?? [],
    documents: documentsResult.data ?? [],
    documentsError: documentsResult.error,
  };
}

export async function updateContractEligibleLives(
  contractId: string,
  eligibleLives: number,
): Promise<void> {
  const { error } = await databaseClient
    .from('contracts')
    .update({ vidas_elegiveis_bonus: eligibleLives })
    .eq('id', contractId);
  if (error) throw error;
}

export async function deleteContractDependent(
  dependentId: string,
): Promise<void> {
  const { error } = await databaseClient
    .from('dependents')
    .delete()
    .eq('id', dependentId);
  if (error) throw error;
}

export async function deleteContractHolder(
  holderId: string,
  relatedEntityIds: string[],
): Promise<void> {
  if (relatedEntityIds.length > 0) {
    const { error } = await databaseClient
      .from('documents')
      .delete()
      .in('entity_id', relatedEntityIds);
    if (error) throw error;
  }

  const { error } = await databaseClient
    .from('contract_holders')
    .delete()
    .eq('id', holderId);
  if (error) throw error;
}

export async function saveContractInteraction(
  contractId: string,
  input: ContractInteractionInput,
  interactionId?: string,
): Promise<void> {
  const { error } = interactionId
    ? await databaseClient
        .from('interactions')
        .update(input)
        .eq('id', interactionId)
    : await databaseClient
        .from('interactions')
        .insert({ contract_id: contractId, ...input });
  if (error) throw error;
}

export async function deleteContractInteraction(
  interactionId: string,
): Promise<void> {
  const { error } = await databaseClient
    .from('interactions')
    .delete()
    .eq('id', interactionId);
  if (error) throw error;
}
