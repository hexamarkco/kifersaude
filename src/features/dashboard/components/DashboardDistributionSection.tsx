import DonutChart from '../../../components/charts/DonutChart';
import { Surface } from '../../../design-system';
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
      <Surface >
        <h3 className="mb-5 text-xl font-semibold text-[var(--text-primary)]">
          Distribuicao de Leads por Status
        </h3>
        {leadStatusData.length > 0 ? (
          <DonutChart
            data={donutChartData}
            size={240}
            strokeWidth={35}
            onSegmentClick={onLeadStatusSegmentClick}
          />
        ) : (
          <Surface variant="muted" className="flex h-64 items-center justify-center border-dashed text-sm">
            Nenhum lead ativo
          </Surface>
        )}
      </Surface>

      <Surface >
        <h3 className="mb-5 text-xl font-semibold text-[var(--text-primary)]">
          Contratos por Operadora
        </h3>
        {operadoraChartData.length > 0 ? (
          <DonutChart
            data={operadoraChartData}
            size={240}
            strokeWidth={35}
            onSegmentClick={onOperadoraSegmentClick}
          />
        ) : (
          <Surface variant="muted" className="flex h-64 items-center justify-center border-dashed text-sm">
            Nenhum contrato ativo
          </Surface>
        )}
      </Surface>
    </div>
  );
}
