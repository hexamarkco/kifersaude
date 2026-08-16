import { BadgePercent, Calendar, Clock, Filter, TrendingUp } from 'lucide-react';

import FilterSingleSelect from '../../../components/FilterSingleSelect';
import MonthlyTrendChart from '../../../components/charts/MonthlyTrendChart';
import { SectionHeader, Surface } from '../../../design-system';
import {
  DASHBOARD_CHART_RANGE_OPTIONS,
  DASHBOARD_METRIC_COLORS,
  DASHBOARD_METRIC_TABS,
  DASHBOARD_PERIOD_OPTIONS,
} from '../shared/dashboardConstants';
import { formatDashboardMetricValue, resolveDashboardVariationTone } from '../shared/dashboardUtils';
import type {
  DashboardChartRange,
  DashboardMetric,
  DashboardMonthlyPoint,
  DashboardPeriodFilter,
} from '../shared/dashboardTypes';

type DashboardTrendSectionProps = {
  periodFilter: DashboardPeriodFilter;
  selectedMetric: DashboardMetric;
  chartRangeInMonths: DashboardChartRange;
  displayedMonthlySeries: DashboardMonthlyPoint[];
  latestMonthlyPoint?: DashboardMonthlyPoint;
  previousMonthlyPoint?: DashboardMonthlyPoint;
  highestMonthlyPoint?: DashboardMonthlyPoint;
  averageMonthlyValue: number;
  onPeriodFilterChange: (value: DashboardPeriodFilter) => void;
  onSelectedMetricChange: (value: DashboardMetric) => void;
  onChartRangeChange: (value: DashboardChartRange) => void;
};

export function DashboardTrendSection({
  periodFilter,
  selectedMetric,
  chartRangeInMonths,
  displayedMonthlySeries,
  latestMonthlyPoint,
  previousMonthlyPoint,
  highestMonthlyPoint,
  averageMonthlyValue,
  onPeriodFilterChange,
  onSelectedMetricChange,
  onChartRangeChange,
}: DashboardTrendSectionProps) {
  const monthlyVariationTone = resolveDashboardVariationTone(latestMonthlyPoint?.variation);
  const formatSelectedMetricValue = (value: number) => formatDashboardMetricValue(value, selectedMetric);

  const insightCards = [
    {
      label: 'Ultimo mes',
      icon: TrendingUp,
      iconColor: 'var(--brand-primary)',
      value: latestMonthlyPoint ? formatSelectedMetricValue(latestMonthlyPoint.value) : 'Sem dados',
      caption:
        latestMonthlyPoint?.variation !== null && latestMonthlyPoint?.variation !== undefined
          ? `${latestMonthlyPoint.variation > 0 ? '+' : ''}${latestMonthlyPoint.variation.toFixed(1)}% ${
              previousMonthlyPoint ? `vs ${previousMonthlyPoint.label}` : 'vs mes anterior'
            }`
          : 'Primeiro mes exibido no recorte',
      captionClassName: monthlyVariationTone,
      meta: latestMonthlyPoint?.label || 'Sem dados',
    },
    {
      label: 'Media do periodo',
      icon: BadgePercent,
      iconColor: 'var(--accent-gold)',
      value: displayedMonthlySeries.length > 0 ? formatSelectedMetricValue(averageMonthlyValue) : 'Sem dados',
      caption: `Baseado nos ultimos ${displayedMonthlySeries.length} meses exibidos`,
      captionClassName: 'text-[var(--text-muted)]',
      meta: 'Media',
    },
    {
      label: 'Pico do periodo',
      icon: Calendar,
      iconColor: 'var(--accent-copper)',
      value: highestMonthlyPoint ? formatSelectedMetricValue(highestMonthlyPoint.value) : 'Sem dados',
      caption: highestMonthlyPoint ? `${highestMonthlyPoint.label} foi o melhor mes` : 'Aguardando historico suficiente',
      captionClassName: 'text-[var(--text-muted)]',
      meta: highestMonthlyPoint?.label || 'Sem dados',
    },
  ];

  return (
    <Surface padding="sm" data-panel-animate>
      <SectionHeader
        eyebrow="Analytics"
        title="Evolucao mensal"
        description="Tendencia por mes considerando o periodo selecionado e os filtros atuais."
        action={(
          <div className="grid w-full gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:items-center">
            <div className="min-w-0 xl:w-40">
              <FilterSingleSelect
                icon={Filter}
                value={periodFilter}
                onChange={(value) => onPeriodFilterChange(value as DashboardPeriodFilter)}
                placeholder="Mes atual"
                includePlaceholderOption={false}
                options={DASHBOARD_PERIOD_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>

            <div className="flex items-center gap-1 rounded-full bg-[var(--bg-hover)] p-1">
              {DASHBOARD_METRIC_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectedMetricChange(item.id)}
                  className={
                    item.id === selectedMetric
                      ? 'flex-1 rounded-full bg-[var(--text-primary)] px-4 py-2 text-xs font-medium text-[var(--text-inverse)] transition xl:flex-none'
                      : 'flex-1 rounded-full px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition xl:flex-none'
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="min-w-0 xl:w-48">
              <FilterSingleSelect
                icon={Clock}
                value={String(chartRangeInMonths)}
                onChange={(value) => onChartRangeChange(Number(value) as DashboardChartRange)}
                placeholder="Ultimos 6 meses"
                includePlaceholderOption={false}
                options={DASHBOARD_CHART_RANGE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>
          </div>
        )}
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.82fr_1.6fr] xl:items-stretch">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
          {insightCards.map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.label} className="rounded-2xl bg-[var(--bg-hover)] p-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)]">
                    <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: card.iconColor }} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">{card.label}</span>
                </div>
                <p className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{card.value}</p>
                <p className={`mt-1 text-xs font-medium ${card.captionClassName}`}>{card.caption}</p>
              </div>
            );
          })}
        </div>

        <MonthlyTrendChart
          data={displayedMonthlySeries.map((point) => ({
            label: point.label,
            value: point.value,
          }))}
          color={DASHBOARD_METRIC_COLORS[selectedMetric]}
          formatValue={formatSelectedMetricValue}
          height={280}
        />
      </div>
    </Surface>
  );
}
