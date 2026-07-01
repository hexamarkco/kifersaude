import DonutChart from '../../../components/charts/DonutChart';
import { SectionHeader, Surface } from '../../../design-system';
import type { DashboardChartDatum, DashboardStatusDistributionItem } from '../shared/dashboardTypes';

type DashboardDistributionSectionProps = {
  leadStatusData: DashboardStatusDistributionItem[];
  donutChartData: DashboardChartDatum[];
  operadoraChartData: DashboardChartDatum[];
  onLeadStatusSegmentClick: (label: string) => void;
  onOperadoraSegmentClick: (label: string) => void;
};

export function DashboardDistributionSection({
  leadStatusData,
  donutChartData,
  operadoraChartData,
  onLeadStatusSegmentClick,
  onOperadoraSegmentClick,
}: DashboardDistributionSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-panel-animate>
      <Surface className="flex flex-col">
        <SectionHeader
          title="Distribuicao de Leads por Status"
          description="Concentracao por etapa do funil"
          as="h3"
        />
        <div className="mt-6 flex flex-1 items-center justify-center">
          {leadStatusData.length > 0 ? (
            <DonutChart
              data={donutChartData}
              size={240}
              strokeWidth={35}
              onSegmentClick={onLeadStatusSegmentClick}
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-sm text-[var(--text-muted)]">
              Nenhum lead ativo
            </div>
          )}
        </div>
      </Surface>

      <Surface className="flex flex-col">
        <SectionHeader
          title="Contratos por Operadora"
          description="Distribuicao por operadora"
          as="h3"
        />
        <div className="mt-6 flex flex-1 items-center justify-center">
          {operadoraChartData.length > 0 ? (
            <DonutChart
              data={operadoraChartData}
              size={240}
              strokeWidth={35}
              onSegmentClick={onOperadoraSegmentClick}
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-sm text-[var(--text-muted)]">
              Nenhum contrato ativo
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
