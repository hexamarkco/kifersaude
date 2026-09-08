import { databaseClient } from '../../../infrastructure/supabase';
import type { Interaction } from '../../activity';
import type { Reminder } from '../../reminders';
import type { LeadStatusHistory } from '../domain/types';

export type LeadTimelineSnapshot = {
  interactions: Interaction[];
  statusHistory: LeadStatusHistory[];
  reminders: Reminder[];
};

export type LeadInteractionInput = Pick<
  Interaction,
  'tipo' | 'descricao' | 'responsavel'
>;

export async function getLeadTimeline(
  leadId: string,
): Promise<LeadTimelineSnapshot> {
  const [interactionsResult, statusResult, remindersResult] = await Promise.all([
    databaseClient
      .from('interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('data_interacao', { ascending: false })
      .overrideTypes<Interaction[], { merge: false }>(),
    databaseClient
      .from('lead_status_history')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .overrideTypes<LeadStatusHistory[], { merge: false }>(),
    databaseClient
      .from('reminders')
      .select('*')
      .eq('lead_id', leadId)
      .order('data_lembrete', { ascending: false })
      .overrideTypes<Reminder[], { merge: false }>(),
  ]);

  if (interactionsResult.error) throw interactionsResult.error;
  if (statusResult.error) throw statusResult.error;
  if (remindersResult.error) throw remindersResult.error;

  return {
    interactions: interactionsResult.data ?? [],
    statusHistory: statusResult.data ?? [],
    reminders: remindersResult.data ?? [],
  };
}

export async function addLeadInteraction(
  leadId: string,
  input: LeadInteractionInput,
  occurredAt = new Date().toISOString(),
): Promise<void> {
  const { error } = await databaseClient
    .from('interactions')
    .insert({ lead_id: leadId, ...input });
  if (error) throw error;

  // The interaction is authoritative. Keep the legacy best-effort contact touch.
  await databaseClient
    .from('leads')
    .update({ ultimo_contato: occurredAt })
    .eq('id', leadId);
}
