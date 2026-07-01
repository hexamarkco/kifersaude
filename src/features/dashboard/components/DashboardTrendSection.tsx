import { BadgePercent, Calendar, Clock, Filter, TrendingUp } from 'lucide-react';

import FilterSingleSelect from '../../../components/FilterSingleSelect';
import MonthlyTrendChart from '../../../components/charts/MonthlyTrendChart';
import { SectionHeader, Surface, Tabs } from '../../../design-system';
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
    <Surface data-panel-animate className="overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--brand-primary) 12%, transparent) 0%, transparent 34%), radial-gradient(circle at 92% 8%, color-mix(in srgb, var(--accent-gold) 10%, transparent) 0%, transparent 30%)',
        }}
      />

      <div className="relative">
        <SectionHeader
          eyebrow="Analytics"
          title="Evolucao mensal"
          description="Tendencia por mes considerando o periodo selecionado e os filtros atuais."
          action={(
            <div className="flex flex-wrap gap-2 sm:justify-end">
            <div className="w-full sm:w-44">
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

            <Tabs
              items={DASHBOARD_METRIC_TABS}
              value={selectedMetric}
              onChange={onSelectedMetricChange}
              variant="panel"
              listClassName="w-full sm:w-auto"
            />

            <div className="w-full sm:w-48">
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

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.92fr_1.6fr] xl:items-stretch">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            {insightCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                        <Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: card.iconColor }} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-[var(--text-primary)]">{card.label}</p>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{card.meta}</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 font-[var(--font-sans)] text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                    {card.value}
                  </p>
                  <p className={`mt-3 text-xs font-semibold leading-snug ${card.captionClassName}`}>{card.caption}</p>
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
            height={300}
          />
        </div>
      </div>
    </Surface>
  );
}
