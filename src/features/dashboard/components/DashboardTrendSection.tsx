import { BadgePercent, Calendar, Clock, Filter, TrendingUp } from 'lucide-react';

import FilterSingleSelect from '../../../components/FilterSingleSelect';
import MonthlyTrendChart from '../../../components/charts/MonthlyTrendChart';
import { Surface, Tabs } from '../../../design-system';
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
    <Surface className="panel-glass-panel" data-panel-animate>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
            Evolucao mensal
          </h3>
          <p className="text-sm" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
            Tendencia por mes considerando o periodo selecionado e os filtros atuais.
          </p>
        </div>

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
      </div>

      <div className="mt-4 space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Surface variant="muted" padding="sm" className="rounded-[1.6rem]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--panel-text-soft)' }}>
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--panel-accent-strong,#b85c1f)' }} />
                <span>Ultimo mes</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                {latestMonthlyPoint?.label || 'Sem dados'}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold" style={{ color: 'var(--panel-text)' }}>
              {latestMonthlyPoint ? formatSelectedMetricValue(latestMonthlyPoint.value) : 'Sem dados'}
            </p>
            <p className="mt-1 text-xs font-semibold" style={monthlyVariationTone}>
              {latestMonthlyPoint?.variation !== null && latestMonthlyPoint?.variation !== undefined
                ? `${latestMonthlyPoint.variation > 0 ? '+' : ''}${latestMonthlyPoint.variation.toFixed(1)}% ${
                    previousMonthlyPoint ? `vs ${previousMonthlyPoint.label}` : 'vs mes anterior'
                  }`
                : 'Primeiro mes exibido no recorte'}
            </p>
          </Surface>

          <Surface variant="muted" padding="sm" className="rounded-[1.6rem]">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--panel-text-soft)' }}>
              <BadgePercent className="h-4 w-4" style={{ color: 'var(--panel-border-strong,#9d7f5a)' }} />
              <span>Media do periodo</span>
            </div>
            <p className="mt-3 text-2xl font-bold" style={{ color: 'var(--panel-text)' }}>
              {displayedMonthlySeries.length > 0 ? formatSelectedMetricValue(averageMonthlyValue) : 'Sem dados'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
              Baseado nos ultimos {displayedMonthlySeries.length} meses exibidos
            </p>
          </Surface>

          <Surface variant="muted" padding="sm" className="rounded-[1.6rem]">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--panel-text-soft)' }}>
              <Calendar className="h-4 w-4" style={{ color: 'var(--panel-border-strong,#9d7f5a)' }} />
              <span>Pico do periodo</span>
            </div>
            <p className="mt-3 text-2xl font-bold" style={{ color: 'var(--panel-text)' }}>
              {highestMonthlyPoint ? formatSelectedMetricValue(highestMonthlyPoint.value) : 'Sem dados'}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
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
