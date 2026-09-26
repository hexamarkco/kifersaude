import { databaseClient } from '../../../infrastructure/supabase';
import type { Interaction } from '../../activity';
import type { Reminder } from '../../reminders';
import type { LeadStatusHistory } from '../domain/types';

export type LeadTimelineInteraction = Pick<
  Interaction,
  'id' | 'tipo' | 'descricao' | 'responsavel' | 'data_interacao'
>;

export type LeadTimelineStatusHistory = Pick<
  LeadStatusHistory,
  'id' | 'status_anterior' | 'status_novo' | 'responsavel' | 'observacao' | 'created_at'
>;

export type LeadTimelineReminder = Pick<
  Reminder,
  'id' | 'titulo' | 'descricao' | 'data_lembrete' | 'lido'
>;

export type LeadTimelineSnapshot = {
  interactions: LeadTimelineInteraction[];
  statusHistory: LeadTimelineStatusHistory[];
  reminders: LeadTimelineReminder[];
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
      .select('id, tipo, descricao, responsavel, data_interacao')
      .eq('lead_id', leadId)
      .order('data_interacao', { ascending: false })
      .overrideTypes<LeadTimelineInteraction[], { merge: false }>(),
    databaseClient
      .from('lead_status_history')
      .select('id, status_anterior, status_novo, responsavel, observacao, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .overrideTypes<LeadTimelineStatusHistory[], { merge: false }>(),
    databaseClient
      .from('reminders')
      .select('id, titulo, descricao, data_lembrete, lido')
      .eq('lead_id', leadId)
      .order('data_lembrete', { ascending: false })
      .overrideTypes<LeadTimelineReminder[], { merge: false }>(),
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
