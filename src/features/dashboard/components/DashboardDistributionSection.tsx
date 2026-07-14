import DonutChart from '../../../components/charts/DonutChart';
import { ActionSurface, Badge, SectionHeader, Surface } from '../../../design-system';
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
  const renderDistributionCard = ({
    title,
    description,
    emptyLabel,
    data,
    total,
    onSegmentClick,
  }: {
    title: string;
    description: string;
    emptyLabel: string;
    data: DashboardChartDatum[];
    total: number;
    onSegmentClick: (label: string) => void;
  }) => {
    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const leader = sortedData[0];

    return (
      <Surface padding="sm" className="flex min-h-[27rem] flex-col">
        <div className="flex h-full flex-col">
          <SectionHeader title={title} description={description} as="h3" />

          {data.length > 0 ? (
            <div className="mt-5 grid flex-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-center">
              <Surface variant="muted" padding="sm" className="flex flex-col">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">Rosca</p>
                  <Badge tone="neutral">Total {total.toLocaleString('pt-BR')}</Badge>
                </div>
                <DonutChart data={data} size={210} strokeWidth={30} onSegmentClick={onSegmentClick} compact />
              </Surface>

              <div className="min-w-0 space-y-3">
                <Surface variant="muted" padding="sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Maior concentração</p>
                  <p className="mt-2 truncate text-lg font-semibold leading-tight text-[var(--text-primary)]">
                    {leader?.label}
                  </p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="font-[var(--font-sans)] text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                      {leader?.value.toLocaleString('pt-BR')}
                    </span>
                    <span className="pb-0.5 text-sm font-semibold text-[var(--text-muted)]">
                      de {total.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </Surface>

                <div className="space-y-3">
                  {sortedData.slice(0, 5).map((item) => {
                    const percentage = total > 0 ? (item.value / total) * 100 : 0;

                    return (
                      <ActionSurface
                        key={item.label}
                        onClick={() => onSegmentClick(item.label)}
                        variant="muted"
                        padding="sm"
                        className="group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ background: item.color }}
                            />
                            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.label}</span>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-[var(--text-secondary)]">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                      </ActionSurface>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex min-h-72 flex-1 items-center justify-center rounded-[var(--kds-radius-lg)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-sm text-[var(--text-muted)]">
              {emptyLabel}
            </div>
          )}
        </div>
      </Surface>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-panel-animate>
      {renderDistributionCard({
        title: 'Distribuicao de Leads por Status',
        description: 'Mapa de concentração por etapa do funil ativo.',
        emptyLabel: 'Nenhum lead ativo',
        data: donutChartData,
        total: leadStatusData.reduce((sum, item) => sum + item.count, 0),
        onSegmentClick: onLeadStatusSegmentClick,
      })}

      {renderDistributionCard({
        title: 'Contratos por Operadora',
        description: 'Participação das operadoras na carteira vigente.',
        emptyLabel: 'Nenhum contrato ativo',
        data: operadoraChartData,
        total: operadoraChartData.reduce((sum, item) => sum + item.value, 0),
        onSegmentClick: onOperadoraSegmentClick,
      })}
    </div>
  );
}
