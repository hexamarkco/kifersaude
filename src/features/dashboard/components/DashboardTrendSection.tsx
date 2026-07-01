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

  return (
    <Surface data-panel-animate>
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

      <div className="mt-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Surface variant="muted" padding="sm" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" />
                <span className="text-[var(--text-secondary)]">Ultimo mes</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {latestMonthlyPoint?.label || 'Sem dados'}
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {latestMonthlyPoint ? formatSelectedMetricValue(latestMonthlyPoint.value) : 'Sem dados'}
            </p>
            <p className={`mt-1 text-xs font-semibold ${monthlyVariationTone}`}>
              {latestMonthlyPoint?.variation !== null && latestMonthlyPoint?.variation !== undefined
                ? `${latestMonthlyPoint.variation > 0 ? '+' : ''}${latestMonthlyPoint.variation.toFixed(1)}% ${
                    previousMonthlyPoint ? `vs ${previousMonthlyPoint.label}` : 'vs mes anterior'
                  }`
                : 'Primeiro mes exibido no recorte'}
            </p>
          </Surface>

          <Surface variant="muted" padding="sm" className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BadgePercent className="h-4 w-4 text-[var(--accent-gold)]" />
              <span className="text-[var(--text-secondary)]">Media do periodo</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {displayedMonthlySeries.length > 0 ? formatSelectedMetricValue(averageMonthlyValue) : 'Sem dados'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Baseado nos ultimos {displayedMonthlySeries.length} meses exibidos
            </p>
          </Surface>

          <Surface variant="muted" padding="sm" className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4 text-[var(--brand-primary)]" />
              <span className="text-[var(--text-secondary)]">Pico do periodo</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {highestMonthlyPoint ? formatSelectedMetricValue(highestMonthlyPoint.value) : 'Sem dados'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {highestMonthlyPoint ? `${highestMonthlyPoint.label} foi o melhor mes do recorte` : 'Aguardando historico suficiente'}
            </p>
          </Surface>
        </div>

        <MonthlyTrendChart
          data={displayedMonthlySeries.map((point) => ({
            label: point.label,
            value: point.value,
          }))}
          color={DASHBOARD_METRIC_COLORS[selectedMetric]}
          formatValue={formatSelectedMetricValue}
          height={210}
        />
      </div>
    </Surface>
  );
}
