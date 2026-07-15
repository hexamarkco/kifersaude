import { BadgePercent, Calendar, Clock, Filter, TrendingUp } from 'lucide-react';

import FilterSingleSelect from '../../../components/FilterSingleSelect';
import MonthlyTrendChart from '../../../components/charts/MonthlyTrendChart';
import { Card, SectionHeader, Surface, Tabs } from '../../../design-system';
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

            <Tabs
              items={DASHBOARD_METRIC_TABS}
              value={selectedMetric}
              onChange={onSelectedMetricChange}
              variant="pill"
              listClassName="w-full xl:w-auto"
            />

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
              <Card key={card.label} variant="muted" kind="summary" padding="sm" className="space-y-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--kds-radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                    <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: card.iconColor }} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-[var(--text-primary)]">{card.label}</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">{card.meta}</p>
                  </div>
                </div>
                <p className="font-[var(--font-sans)] text-2xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                  {card.value}
                </p>
                <p className={`text-xs font-semibold leading-snug ${card.captionClassName}`}>{card.caption}</p>
              </Card>
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
    </Surface>
  );
}
