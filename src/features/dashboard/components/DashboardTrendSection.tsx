import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CalendarRange,
  TrendingUp,
} from 'lucide-react';

import MonthlyTrendChart from '../../../components/charts/MonthlyTrendChart';
import {
  FilterSelect,
  SectionHeader,
  SegmentedControl,
  Surface,
} from '../../../design-system';
import {
  DASHBOARD_CHART_RANGE_OPTIONS,
  DASHBOARD_METRIC_COLORS,
  DASHBOARD_METRIC_TABS,
} from '../shared/dashboardConstants';
import { formatDashboardMetricValue, resolveDashboardVariationTone } from '../shared/dashboardUtils';
import type {
  DashboardChartRange,
  DashboardMetric,
  DashboardMonthlyPoint,
} from '../shared/dashboardTypes';

type DashboardTrendSectionProps = {
  selectedMetric: DashboardMetric;
  chartRangeInMonths: DashboardChartRange;
  displayedMonthlySeries: DashboardMonthlyPoint[];
  latestMonthlyPoint?: DashboardMonthlyPoint;
  previousMonthlyPoint?: DashboardMonthlyPoint;
  highestMonthlyPoint?: DashboardMonthlyPoint;
  averageMonthlyValue: number;
  onSelectedMetricChange: (value: DashboardMetric) => void;
  onChartRangeChange: (value: DashboardChartRange) => void;
};

const metricContent: Record<DashboardMetric, { label: string; description: string }> = {
  leads: {
    label: 'Leads recebidos',
    description: 'Novas oportunidades adicionadas ao CRM.',
  },
  contratos: {
    label: 'Contratos fechados',
    description: 'Contratos registrados no período de cada mês.',
  },
  comissoes: {
    label: 'Comissões previstas',
    description: 'Valor de comissão previsto para os contratos.',
  },
};

const formatVariation = (variation?: number | null, previousLabel?: string) => {
  if (variation === null || variation === undefined) return 'Sem comparação';
  return `${variation > 0 ? '+' : ''}${variation.toFixed(1)}% vs ${previousLabel || 'mês anterior'}`;
};

export function DashboardTrendSection({
  selectedMetric,
  chartRangeInMonths,
  displayedMonthlySeries,
  latestMonthlyPoint,
  previousMonthlyPoint,
  highestMonthlyPoint,
  averageMonthlyValue,
  onSelectedMetricChange,
  onChartRangeChange,
}: DashboardTrendSectionProps) {
  const monthlyVariationTone = resolveDashboardVariationTone(latestMonthlyPoint?.variation);
  const formatSelectedMetricValue = (value: number) => formatDashboardMetricValue(value, selectedMetric);
  const selectedMetricContent = metricContent[selectedMetric];
  const variationIcon = (latestMonthlyPoint?.variation ?? 0) < 0 ? ArrowDownRight : ArrowUpRight;
  const VariationIcon = variationIcon;

  const insightCards = [
    {
      label: 'Último mês',
      icon: TrendingUp,
      value: latestMonthlyPoint ? formatSelectedMetricValue(latestMonthlyPoint.value) : 'Sem dados',
      caption: formatVariation(latestMonthlyPoint?.variation, previousMonthlyPoint?.label),
      captionClassName: monthlyVariationTone,
      meta: latestMonthlyPoint?.label || 'Sem dados',
      actionIcon: latestMonthlyPoint?.variation === null || latestMonthlyPoint?.variation === undefined
        ? null
        : VariationIcon,
    },
    {
      label: 'Média do período',
      icon: BarChart3,
      value: displayedMonthlySeries.length > 0 ? formatSelectedMetricValue(averageMonthlyValue) : 'Sem dados',
      caption: displayedMonthlySeries.length > 0
        ? `Base dos últimos ${displayedMonthlySeries.length} meses`
        : 'Aguardando histórico',
      captionClassName: 'text-[var(--text-secondary)]',
      meta: 'Média mensal',
      actionIcon: null,
    },
    {
      label: 'Melhor mês',
      icon: Calendar,
      value: highestMonthlyPoint ? formatSelectedMetricValue(highestMonthlyPoint.value) : 'Sem dados',
      caption: highestMonthlyPoint ? `${highestMonthlyPoint.label} foi o pico` : 'Aguardando histórico',
      captionClassName: 'text-[var(--text-secondary)]',
      meta: highestMonthlyPoint?.label || 'Sem dados',
      actionIcon: null,
    },
  ];

  return (
    <Surface padding="md" className="overflow-hidden">
      <SectionHeader
        eyebrow="Performance comercial"
        title="Evolução mensal"
        description="Compare o ritmo de entrada, fechamento e comissão dentro dos filtros ativos."
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SegmentedControl
              className="max-w-full"
              aria-label="Métrica da evolução mensal"
              items={DASHBOARD_METRIC_TABS}
              value={selectedMetric}
              onChange={onSelectedMetricChange}
            />
            <FilterSelect
              icon={CalendarRange}
              value={String(chartRangeInMonths)}
              onChange={(value) => onChartRangeChange(Number(value) as DashboardChartRange)}
              placeholder="Últimos 6 meses"
              includePlaceholderOption={false}
              options={DASHBOARD_CHART_RANGE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>
        )}
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedMetricContent.label}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{selectedMetricContent.description}</p>
            </div>
            {latestMonthlyPoint && (
              <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-3 py-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: DASHBOARD_METRIC_COLORS[selectedMetric] }}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatSelectedMetricValue(latestMonthlyPoint.value)}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{latestMonthlyPoint.label}</span>
              </div>
            )}
          </div>

          <MonthlyTrendChart
            data={displayedMonthlySeries.map((point) => ({
              label: point.label,
              value: point.value,
            }))}
            color={DASHBOARD_METRIC_COLORS[selectedMetric]}
            formatValue={formatSelectedMetricValue}
            height={250}
          />
        </div>

        <aside className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1" aria-label="Resumo da evolução mensal">
          {insightCards.map((card) => {
            const Icon = card.icon;
            const ActionIcon = card.actionIcon;

            return (
              <div
                key={card.label}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-surface)]">
                    <Icon
                      className="h-4 w-4"
                      strokeWidth={1.75}
                      style={{ color: DASHBOARD_METRIC_COLORS[selectedMetric] }}
                      aria-hidden="true"
                    />
                  </span>
                  {ActionIcon && (
                    <ActionIcon className={`h-4 w-4 ${card.captionClassName}`} aria-hidden="true" />
                  )}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {card.label}
                </p>
                <p className="mt-1 truncate text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                  {card.value}
                </p>
                <p className={`mt-1 text-xs font-medium ${card.captionClassName}`}>{card.caption}</p>
                <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
                  {card.meta}
                </p>
              </div>
            );
          })}
        </aside>
      </div>
    </Surface>
  );
}
