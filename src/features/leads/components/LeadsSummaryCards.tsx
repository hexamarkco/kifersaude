import { Bell, MessageCircle, Target, Users } from "lucide-react";

import AnimatedStatCard from "../../../components/AnimatedStatCard";

type LeadsSummaryCardsProps = {
  showArchived: boolean;
  filteredLeadCount: number;
  baseLeadCount: number;
  scheduledCount: number;
  recentContactCount: number;
  recentContactRate: number;
  ownerCount: number;
  originCount: number;
  viewModeLabel: string;
};

export function LeadsSummaryCards({
  showArchived,
  filteredLeadCount,
  baseLeadCount,
  scheduledCount,
  recentContactCount,
  recentContactRate,
  ownerCount,
  originCount,
  viewModeLabel,
}: LeadsSummaryCardsProps) {
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
      data-panel-animate
    >
      <AnimatedStatCard
        label="Leads no recorte"
        value={filteredLeadCount}
        icon={Users}
        tone="brand"
        subtitle={
          showArchived
            ? "Carteira arquivada com filtros atuais"
            : "Carteira ativa com filtros atuais"
        }
        contextLabel="Base"
        contextValue={`${baseLeadCount} leads`}
        footerLabel="Busca, filtros e modo atual"
      />

      <AnimatedStatCard
        label="Retornos mapeados"
        value={scheduledCount}
        icon={Bell}
        tone="copper"
        subtitle="Lembretes e proximos retornos futuros"
        contextLabel="Modo"
        contextValue={viewModeLabel}
        footerLabel="Follow-ups previstos no recorte"
      />

      <AnimatedStatCard
        label="Contato recente"
        value={recentContactCount}
        icon={MessageCircle}
        tone="earth"
        subtitle="Interacao registrada nos ultimos 7 dias"
        contextLabel="Cobertura"
        contextValue={`${recentContactRate}%`}
        footerLabel="Ritmo de contato da carteira"
      />

      <AnimatedStatCard
        label="Carteira distribuida"
        value={ownerCount}
        icon={Target}
        tone="brand"
        subtitle="Responsaveis com leads no recorte"
        contextLabel="Origens"
        contextValue={`${originCount} ativas`}
        footerLabel="Distribuicao comercial atual"
      />
    </div>
  );
}
