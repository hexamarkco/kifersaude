import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import DonutChart from '../../../components/charts/DonutChart';
import { Badge, Popover, PopoverContent, PopoverTrigger, SectionHeader, Surface, Tabs } from '../../../design-system';
import type { DashboardChartDatum, DashboardStatusDistributionItem } from '../shared/dashboardTypes';

const VISIBLE_LEGEND_ITEMS = 3;

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
  const [mobileDistribution, setMobileDistribution] = useState<'leads' | 'operadoras'>('leads');
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
    const visibleData = sortedData.slice(0, VISIBLE_LEGEND_ITEMS);
    const hiddenData = sortedData.slice(VISIBLE_LEGEND_ITEMS);

    const renderRow = (item: DashboardChartDatum) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;

      return (
        <button
          key={item.label}
          type="button"
          onClick={() => onSegmentClick(item.label)}
          className="flex w-full items-center gap-2.5 rounded-full px-2 py-1.5 text-left transition hover:bg-[var(--bg-hover)]"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-secondary)]">{item.label}</span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--text-muted)]">
            {percentage.toFixed(0)}%
          </span>
        </button>
      );
    };

    return (
      <Surface padding="sm" className="flex min-h-[24rem] flex-col">
        <SectionHeader title={title} description={description} as="h3" />

        {data.length > 0 ? (
          <div className="mt-5 flex flex-1 flex-col items-center gap-5">
            <div className="shrink-0">
              <DonutChart data={data} size={168} strokeWidth={22} onSegmentClick={onSegmentClick} compact />
            </div>

            <div className="w-full min-w-0 space-y-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-[var(--text-muted)]">
                  Maior concentração: <span className="font-semibold text-[var(--text-primary)]">{leader?.label}</span>
                </span>
                <Badge tone="neutral">{total.toLocaleString('pt-BR')} total</Badge>
              </div>
              {visibleData.map(renderRow)}

              {hiddenData.length > 0 && (
                <Popover>
                  <PopoverTrigger className="block w-full">
                    <span className="flex w-full items-center gap-2.5 rounded-full px-2 py-1.5 text-left text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">Ver mais ({hiddenData.length})</span>
                    </span>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 space-y-1 p-2">
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {hiddenData.map(renderRow)}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 flex min-h-72 flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-hover)] text-sm text-[var(--text-muted)]">
            {emptyLabel}
          </div>
        )}
      </Surface>
    );
  };

  const leadsCard = renderDistributionCard({
        title: 'Distribuicao de Leads por Status',
        description: 'Mapa de concentração por etapa do funil ativo.',
        emptyLabel: 'Nenhum lead ativo',
        data: donutChartData,
        total: leadStatusData.reduce((sum, item) => sum + item.count, 0),
        onSegmentClick: onLeadStatusSegmentClick,
      });
  const operadorasCard = renderDistributionCard({
        title: 'Contratos por Operadora',
        description: 'Participação das operadoras na carteira vigente.',
        emptyLabel: 'Nenhum contrato ativo',
        data: operadoraChartData,
        total: operadoraChartData.reduce((sum, item) => sum + item.value, 0),
        onSegmentClick: onOperadoraSegmentClick,
      });

  return (
    <section data-panel-animate>
      <div className="mb-3 lg:hidden">
        <Tabs
          items={[{ id: 'leads', label: 'Leads por status' }, { id: 'operadoras', label: 'Por operadora' }]}
          value={mobileDistribution}
          onChange={(value) => setMobileDistribution(value as 'leads' | 'operadoras')}
          variant="pill"
          size="sm"
          listClassName="w-full"
          triggerClassName="flex-1 px-2"
        />
      </div>
      <div className="lg:hidden">{mobileDistribution === 'leads' ? leadsCard : operadorasCard}</div>
      <div className="hidden grid-cols-1 gap-4 lg:grid lg:grid-cols-2">
        {leadsCard}
        {operadorasCard}
      </div>
    </section>
  );
}
