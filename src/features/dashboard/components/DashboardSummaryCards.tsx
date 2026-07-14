import { Activity, DollarSign, FileText, Target, Users } from 'lucide-react';

import { KpiCard } from '../../../design-system';

type DashboardSummaryCardsProps = {
  isObserver: boolean;
  leadsAtivos: number;
  totalLeads: number;
  contratosAtivosCount: number;
  comissaoTotal: number;
  conversionRate: number;
  ticketMedio: number;
};

export function DashboardSummaryCards({
  isObserver,
  leadsAtivos,
  totalLeads,
  contratosAtivosCount,
  comissaoTotal,
  conversionRate,
  ticketMedio,
}: DashboardSummaryCardsProps) {
  const gridClassName = isObserver
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
    : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5';

  return (
    <div data-panel-animate className={gridClassName}>
      <KpiCard
        padding="sm"
        title="Leads em negociação"
        subtitle="Base de leads"
        value={<span className="tabular-nums">{leadsAtivos} / {totalLeads}</span>}
        trend={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]"><Users className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />Pipeline ativo</span>}
        className="h-full space-y-3"
      />

      {!isObserver && (
        <KpiCard
          padding="sm"
          title="Contratos ativos"
          subtitle="Vigentes"
          value={<span className="tabular-nums">{contratosAtivosCount.toLocaleString('pt-BR')}</span>}
          trend={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]"><FileText className="h-3.5 w-3.5 text-[var(--accent-copper)]" aria-hidden="true" />Carteira atual</span>}
          className="h-full space-y-3"
        />
      )}

      {!isObserver && (
        <KpiCard
          padding="sm"
          title="Comissão"
          subtitle="Mensal"
          value={<span className="tabular-nums">R$ {comissaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
          trend={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]"><DollarSign className="h-3.5 w-3.5 text-[var(--accent-gold-hover)]" aria-hidden="true" />Previsão de receita</span>}
          className="h-full space-y-3"
        />
      )}

      <KpiCard
        padding="sm"
        title="Taxa de eficiência"
        subtitle="Leads convertidos"
        value={<span className="tabular-nums">{conversionRate.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>}
        trend={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]"><Target className="h-3.5 w-3.5 text-[var(--accent-copper)]" aria-hidden="true" />Conversão atual</span>}
        className="h-full space-y-3"
      />

      {!isObserver && (
        <KpiCard
          padding="sm"
          title="Ticket médio"
          subtitle="Por contrato"
          value={<span className="tabular-nums">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
          trend={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]"><Activity className="h-3.5 w-3.5 text-[var(--accent-gold-hover)]" aria-hidden="true" />Valor da carteira</span>}
          className="h-full space-y-3"
        />
      )}
    </div>
  );
}
