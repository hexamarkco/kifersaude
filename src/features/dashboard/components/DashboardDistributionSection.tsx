import DonutChart from '../../../components/charts/DonutChart';
import {
  DASHBOARD_EMPTY_DONUT_STATE_STYLE,
  DASHBOARD_SECTION_STYLE,
} from '../shared/dashboardConstants';
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
      <div className="panel-glass-panel rounded-[2rem] border p-6 sm:p-7" style={DASHBOARD_SECTION_STYLE}>
        <h3 className="mb-5 text-xl font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
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
          <div
            className="flex h-64 items-center justify-center rounded-[1.6rem] border border-dashed text-sm"
            style={DASHBOARD_EMPTY_DONUT_STATE_STYLE}
          >
            Nenhum lead ativo
          </div>
        )}
      </div>

      <div className="panel-glass-panel rounded-[2rem] border p-6 sm:p-7" style={DASHBOARD_SECTION_STYLE}>
        <h3 className="mb-5 text-xl font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
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
          <div
            className="flex h-64 items-center justify-center rounded-[1.6rem] border border-dashed text-sm"
            style={DASHBOARD_EMPTY_DONUT_STATE_STYLE}
          >
            Nenhum contrato ativo
          </div>
        )}
      </div>
    </div>
  );
}
