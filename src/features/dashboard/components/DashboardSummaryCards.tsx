import { Activity, DollarSign, FileText, Target, Users } from 'lucide-react';

import AnimatedStatCard from '../../../components/AnimatedStatCard';

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
    ? 'grid grid-cols-1 gap-5 sm:grid-cols-2'
    : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div data-panel-animate className={gridClassName}>
      <AnimatedStatCard
        label="Leads em negociação"
        value={`${leadsAtivos} / ${totalLeads}`}
        icon={Users}
        tone="brand"
        subtitle="Base de leads"
      />

      {!isObserver && (
        <AnimatedStatCard
          label="Contratos ativos"
          value={contratosAtivosCount}
          icon={FileText}
          tone="earth"
          subtitle="Vigentes"
        />
      )}

      {!isObserver && (
        <AnimatedStatCard
          label="Comissão"
          value={comissaoTotal}
          icon={DollarSign}
          tone="forest"
          prefix="R$"
          subtitle="Mensal"
        />
      )}

      <AnimatedStatCard
        label="Taxa de eficiência"
        value={conversionRate}
        icon={Target}
        tone="plum"
        suffix="%"
        subtitle="Leads convertidos"
      />

      {!isObserver && (
        <AnimatedStatCard
          label="Ticket médio"
          value={ticketMedio}
          icon={Activity}
          tone="copper"
          prefix="R$"
          subtitle="Por contrato"
        />
      )}
    </div>
  );
}
