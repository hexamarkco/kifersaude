import {
  databaseClient,
  fetchAllPages,
  type Database,
} from '../../../infrastructure/supabase';
import type { Lead } from '../../leads';
import type { ContractValueAdjustment } from '../domain/types';

export type ContractPersistenceInput =
  Database['public']['Tables']['contracts']['Insert'];

export async function listContractConversionLeads(
  statuses: string[],
): Promise<Lead[]> {
  return fetchAllPages<Lead>(async (from, to) => {
    let query = databaseClient
      .from('leads')
      .select('*')
      .eq('arquivado', false);

    if (statuses.length > 0) {
      query = query.in('status', statuses);
    }

    return query
      .order('nome_completo')
      .range(from, to)
      .overrideTypes<Lead[], { merge: false }>();
  });
}

export async function listContractValueAdjustments(
  contractId: string,
): Promise<ContractValueAdjustment[]> {
  const { data, error } = await databaseClient
    .from('contract_value_adjustments')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at')
    .overrideTypes<ContractValueAdjustment[], { merge: false }>();
  if (error) throw error;
  return data ?? [];
}

export async function deleteContractValueAdjustment(
  adjustmentId: string,
): Promise<void> {
  const { error } = await databaseClient
    .from('contract_value_adjustments')
    .delete()
    .eq('id', adjustmentId);
  if (error) throw error;
}

export async function saveContractValueAdjustment(
  input: Database['public']['Tables']['contract_value_adjustments']['Insert'],
  adjustmentId?: string,
): Promise<void> {
  const { error } = adjustmentId
    ? await databaseClient
        .from('contract_value_adjustments')
        .update(input)
        .eq('id', adjustmentId)
    : await databaseClient.from('contract_value_adjustments').insert(input);
  if (error) throw error;
}

export async function saveContractRecord(
  input: ContractPersistenceInput,
  contractId?: string,
): Promise<string> {
  if (contractId) {
    const { error } = await databaseClient
      .from('contracts')
      .update(input)
      .eq('id', contractId);
    if (error) throw error;
    return contractId;
  }

  const { data, error } = await databaseClient
    .from('contracts')
    .insert(input)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function convertLeadAfterContractCreation(params: {
  leadId: string;
  previousStatus: string;
  nextStatus: string;
  nextStatusId: string | null;
  responsible?: string | null;
  conversionTimestamp: string;
}): Promise<void> {
  const {
    leadId,
    previousStatus,
    nextStatus,
    nextStatusId,
    responsible,
    conversionTimestamp,
  } = params;
  const leadUpdate: Database['public']['Tables']['leads']['Update'] = {
    ultimo_contato: conversionTimestamp,
    proximo_retorno: null,
  };

  if (nextStatus) {
    if (!nextStatusId) {
      throw new Error(`Status de lead sem identificador: ${nextStatus}`);
    }
    leadUpdate.status = nextStatus;
    leadUpdate.status_id = nextStatusId;
  }

  const { error: leadError } = await databaseClient
    .from('leads')
    .update(leadUpdate)
    .eq('id', leadId);
  if (leadError) throw leadError;

  const { error: remindersError } = await databaseClient
    .from('reminders')
    .delete()
    .eq('lead_id', leadId);
  if (remindersError) throw remindersError;

  if (!nextStatus || nextStatus === previousStatus) return;
  if (!responsible) {
    throw new Error('Lead sem responsavel para registrar a conversao');
  }

  const { error: interactionError } = await databaseClient
    .from('interactions')
    .insert({
      lead_id: leadId,
      tipo: 'Observacao',
      descricao: `Status alterado de "${previousStatus}" para "${nextStatus}" (via conversao em contrato)`,
      responsavel: responsible,
    });
  if (interactionError) throw interactionError;

  const { error: historyError } = await databaseClient
    .from('lead_status_history')
    .insert({
      lead_id: leadId,
      status_anterior: previousStatus,
      status_novo: nextStatus,
      responsavel: responsible,
    });
  if (historyError) throw historyError;
}
