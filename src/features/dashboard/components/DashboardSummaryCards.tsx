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
    : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6';

  return (
    <div data-panel-animate className={gridClassName}>
      <div className={!isObserver ? 'lg:col-span-2' : undefined}>
        <AnimatedStatCard
          label="Leads em negociação"
          value={`${leadsAtivos} / ${totalLeads}`}
          icon={Users}
          tone="brand"
          subtitle="Base de leads"
        />
      </div>

      {!isObserver && (
        <div className="lg:col-span-2">
          <AnimatedStatCard
            label="Contratos ativos"
            value={contratosAtivosCount}
            icon={FileText}
            tone="earth"
            subtitle="Vigentes"
          />
        </div>
      )}

      {!isObserver && (
        <div className="lg:col-span-2">
          <AnimatedStatCard
            label="Comissão"
            value={comissaoTotal}
            icon={DollarSign}
            tone="copper"
            prefix="R$"
            subtitle="Mensal"
          />
        </div>
      )}

      <div className={!isObserver ? 'lg:col-span-3' : undefined}>
        <AnimatedStatCard
          label="Taxa de eficiência"
          value={conversionRate}
          icon={Target}
          tone="earth"
          suffix="%"
          subtitle="Leads convertidos"
        />
      </div>

      {!isObserver && (
        <div className="lg:col-span-3">
          <AnimatedStatCard
            label="Ticket médio"
            value={ticketMedio}
            icon={Activity}
            tone="copper"
            prefix="R$"
            subtitle="Por contrato"
          />
        </div>
      )}
    </div>
  );
}
