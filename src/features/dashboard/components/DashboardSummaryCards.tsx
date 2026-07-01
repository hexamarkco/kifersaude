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
  onOpenLeads?: () => void;
  onOpenContracts?: () => void;
  onOpenCommissions?: () => void;
};

export function DashboardSummaryCards({
  isObserver,
  leadsAtivos,
  totalLeads,
  contratosAtivosCount,
  comissaoTotal,
  conversionRate,
  ticketMedio,
  onOpenLeads,
  onOpenContracts,
  onOpenCommissions,
}: DashboardSummaryCardsProps) {
  const gridClassName = isObserver
    ? 'grid grid-cols-1 gap-5 sm:grid-cols-2'
    : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

  return (
    <div data-panel-animate className={gridClassName}>
      <AnimatedStatCard
        label="Leads Ativos"
        value={`${leadsAtivos} / ${totalLeads}`}
        icon={Users}
        tone="brand"
        subtitle="Em negociacao / Total"
        contextLabel="Base"
        contextValue={`${totalLeads} leads`}
        footerLabel="Abrir carteira de leads"
        onClick={onOpenLeads}
      />

      {!isObserver && (
        <AnimatedStatCard
          label="Contratos Ativos"
          value={contratosAtivosCount}
          icon={FileText}
          tone="earth"
          subtitle="Vigentes"
          contextLabel="Status"
          contextValue="Em operacao"
          footerLabel="Abrir contratos ativos"
          onClick={onOpenContracts}
        />
      )}

      {!isObserver && (
        <AnimatedStatCard
          label="Comissao Prevista"
          value={comissaoTotal}
          icon={DollarSign}
          tone="forest"
          prefix="R$"
          subtitle="Mensal"
          contextLabel="Recorte"
          contextValue="Previsao"
          footerLabel="Abrir painel de comissoes"
          onClick={onOpenCommissions}
        />
      )}

      <AnimatedStatCard
        label="Taxa de Conversao"
        value={conversionRate}
        icon={Target}
        tone="plum"
        suffix="%"
        subtitle="Leads com status Convertido"
        contextLabel="Leitura"
        contextValue="Eficiencia"
        footerLabel="Acompanhe a performance comercial"
      />

      {!isObserver && (
        <AnimatedStatCard
          label="Ticket Medio"
          value={ticketMedio}
          icon={Activity}
          tone="copper"
          prefix="R$"
          subtitle="Por contrato"
          contextLabel="Base"
          contextValue={`${contratosAtivosCount} ativos`}
          footerLabel="Valor medio por contrato vigente"
        />
      )}
    </div>
  );
}
