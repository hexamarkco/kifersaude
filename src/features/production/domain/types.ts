import type { Database } from '../../../infrastructure/supabase';

export type ProductionOperator = Database['public']['Tables']['production_operators']['Row'];
export type ProductionSummary = {
  user_id: string | null; display_name: string; clients: number; messages: number;
  scheduled_messages: number; schedules: number; reminders: number; advances: number;
  regressions: number; losses: number; sales: number; cancellations: number;
};
export type ProductionEvent = Database['public']['Tables']['production_activities']['Row'];
export type ProductionReport = {
  started_at: string | null; operators: ProductionOperator[]; summary: ProductionSummary[];
  unattributed: { automation: number; external: number; unknown: number };
  total_events: number; events: ProductionEvent[];
};

export const productionDay = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export function productionRange(days: number, now = new Date()) {
  const end = productionDay(now);
  const start = new Date(`${end}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: start.toISOString().slice(0, 10), end };
}

export const productionActionLabels: Record<string, string> = {
  message_sent: 'Mensagem enviada', interaction_created: 'Interação registrada', schedule_created: 'Agendamento criado',
  schedule_updated: 'Agendamento alterado', reminder_completed: 'Retorno concluído', stage_advanced: 'Avanço no funil',
  stage_regressed: 'Regressão no funil', stage_lost: 'Perda', stage_changed: 'Etapa alterada', sale_closed: 'Venda fechada', sale_cancelled: 'Venda cancelada',
};
