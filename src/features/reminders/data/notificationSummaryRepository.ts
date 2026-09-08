import { databaseClient } from '../../../infrastructure/supabase';
import type { Contract } from '../../contracts';
import type { Reminder } from '../domain/types';

export type NotificationHolder = {
  id: string;
  contract_id: string;
  nome_completo: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  data_nascimento: string;
};

export type NotificationDependent = {
  id: string;
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

export async function loadNotificationSummarySource(
  startAt: string,
  endAt: string,
): Promise<NotificationSummarySource> {
  const [remindersResult, contractsResult, holdersResult, dependentsResult] = await Promise.all([
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
    databaseClient
      .from('contract_holders')
      .select('id, contract_id, nome_completo, razao_social, nome_fantasia, data_nascimento')
      .overrideTypes<NotificationHolder[], { merge: false }>(),
    databaseClient
      .from('dependents')
      .select('id, contract_id, nome_completo, data_nascimento')
      .overrideTypes<NotificationDependent[], { merge: false }>(),
  ]);

  const error = remindersResult.error
    ?? contractsResult.error
    ?? holdersResult.error
    ?? dependentsResult.error;
  if (error) throw error;

  return {
    reminders: remindersResult.data ?? [],
    contracts: contractsResult.data ?? [],
    holders: holdersResult.data ?? [],
    dependents: dependentsResult.data ?? [],
  };
}
