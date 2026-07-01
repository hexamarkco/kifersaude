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
      <Surface className="flex min-h-[30rem] flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--brand-primary) 10%, transparent) 0%, transparent 34%), radial-gradient(circle at 90% 18%, color-mix(in srgb, var(--accent-gold) 9%, transparent) 0%, transparent 30%)',
          }}
        />

        <div className="relative flex h-full flex-col">
          <SectionHeader title={title} description={description} as="h3" />

          {data.length > 0 ? (
            <div className="mt-6 grid flex-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-center">
              <div className="flex flex-col items-center justify-center rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4">
                <DonutChart data={data} size={210} strokeWidth={30} onSegmentClick={onSegmentClick} compact />
              </div>

              <div className="min-w-0 space-y-4">
                <div className="rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4">
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
                </div>

                <div className="space-y-3">
                  {sortedData.slice(0, 5).map((item) => {
                    const percentage = total > 0 ? (item.value / total) * 100 : 0;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => onSegmentClick(item.label)}
                        className="group w-full rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-strong)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{
                                background: item.color,
                                boxShadow: `0 0 0 6px color-mix(in srgb, ${item.color} 13%, transparent)`,
                              }}
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
                              background: `linear-gradient(90deg, ${item.color} 0%, color-mix(in srgb, ${item.color} 76%, var(--accent-gold)) 100%)`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex min-h-80 flex-1 items-center justify-center rounded-[var(--radius-2xl)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-sm text-[var(--text-muted)]">
              {emptyLabel}
            </div>
          )}
        </div>
      </Surface>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-panel-animate>
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
