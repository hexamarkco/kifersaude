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
      <Surface className="flex flex-col">
        <div className="mb-5">
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            Distribuicao de Leads por Status
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Concentracao por etapa do funil
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          {leadStatusData.length > 0 ? (
            <DonutChart
              data={donutChartData}
              size={240}
              strokeWidth={35}
              onSegmentClick={onLeadStatusSegmentClick}
            />
          ) : (
            <Surface variant="muted" className="flex h-64 w-full items-center justify-center border-dashed text-sm text-[var(--text-muted)]">
              Nenhum lead ativo
            </Surface>
          )}
        </div>
      </Surface>

      <Surface className="flex flex-col">
        <div className="mb-5">
          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
            Contratos por Operadora
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Distribuicao por operadora
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          {operadoraChartData.length > 0 ? (
            <DonutChart
              data={operadoraChartData}
              size={240}
              strokeWidth={35}
              onSegmentClick={onOperadoraSegmentClick}
            />
          ) : (
            <Surface variant="muted" className="flex h-64 w-full items-center justify-center border-dashed text-sm text-[var(--text-muted)]">
              Nenhum contrato ativo
            </Surface>
          )}
        </div>
      </Surface>
    </div>
  );
}
