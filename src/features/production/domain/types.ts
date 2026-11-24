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

export function productionSalesTrend(report: ProductionReport, range: { start: string; end: string }) {
  if (!report.started_at || report.events.length !== report.total_events) return [];

  const startedOn = productionDay(new Date(report.started_at));
  const first = new Date(`${range.start > startedOn ? range.start : startedOn}T12:00:00Z`).getTime();
  const last = new Date(`${range.end}T12:00:00Z`).getTime();
  const dayMs = 86_400_000;
  const days = (last - first) / dayMs + 1;
  if (!Number.isFinite(days) || days < 1 || days > 92) return [];

  const sales = new Map<string, number>();
  for (const event of report.events) {
    if (event.action !== 'sale_closed' || !event.operator_user_id) continue;
    const date = productionDay(new Date(event.occurred_at));
    sales.set(date, (sales.get(date) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(first + index * dayMs).toISOString().slice(0, 10);
    return { label: `${date.slice(8)}/${date.slice(5, 7)}`, value: sales.get(date) ?? 0 };
  });
}

export const productionActionLabels: Record<string, string> = {
  message_sent: 'Mensagem enviada', interaction_created: 'Interação registrada', schedule_created: 'Agendamento criado',
  schedule_updated: 'Agendamento alterado', reminder_completed: 'Retorno concluído', stage_advanced: 'Avanço no funil',
  stage_regressed: 'Regressão no funil', stage_lost: 'Perda', stage_changed: 'Etapa alterada', sale_closed: 'Venda fechada', sale_cancelled: 'Venda cancelada',
};
