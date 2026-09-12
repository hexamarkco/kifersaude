import { BadgePercent, Calendar, Clock, TrendingUp } from 'lucide-react';

import MonthlyTrendChart from '../../../components/charts/MonthlyTrendChart';
import {
  SectionHeader,
  Surface,
  FilterSelect,
  SegmentedControl,
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

  const insightCards = [
    {
      label: 'Último mês',
      icon: TrendingUp,
      iconColor: 'var(--brand-primary)',
      value: latestMonthlyPoint ? formatSelectedMetricValue(latestMonthlyPoint.value) : 'Sem dados',
      caption:
        latestMonthlyPoint?.variation !== null && latestMonthlyPoint?.variation !== undefined
          ? `${latestMonthlyPoint.variation > 0 ? '+' : ''}${latestMonthlyPoint.variation.toFixed(1)}% ${
              previousMonthlyPoint ? `vs ${previousMonthlyPoint.label}` : 'vs. mês anterior'
            }`
          : 'Primeiro mês exibido no recorte',
      captionClassName: monthlyVariationTone,
      meta: latestMonthlyPoint?.label || 'Sem dados',
    },
    {
      label: 'Média do período',
      icon: BadgePercent,
      iconColor: 'var(--accent-gold)',
      value: displayedMonthlySeries.length > 0 ? formatSelectedMetricValue(averageMonthlyValue) : 'Sem dados',
      caption: `Baseado nos últimos ${displayedMonthlySeries.length} meses exibidos`,
      captionClassName: 'text-[var(--text-muted)]',
      meta: 'Média',
    },
    {
      label: 'Pico do período',
      icon: Calendar,
      iconColor: 'var(--accent-copper)',
      value: highestMonthlyPoint ? formatSelectedMetricValue(highestMonthlyPoint.value) : 'Sem dados',
      caption: highestMonthlyPoint ? `${highestMonthlyPoint.label} foi o melhor mês` : 'Aguardando histórico suficiente',
      captionClassName: 'text-[var(--text-muted)]',
      meta: highestMonthlyPoint?.label || 'Sem dados',
    },
  ];

  return (
    <Surface padding="sm" className="flex h-full flex-col">
      <SectionHeader
        eyebrow="Analytics"
        title="Evolução mensal"
        description="Histórico mensal respeitando origem e responsável selecionados."
      />

      <div className="mt-4 flex justify-end">
        <FilterSelect
          icon={Clock}
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

      <SegmentedControl
        className="mt-2 w-fit max-w-full"
        aria-label="Métrica da evolução mensal"
        items={DASHBOARD_METRIC_TABS}
        value={selectedMetric}
        onChange={onSelectedMetricChange}
      />

      <div className="mt-4">
        <MonthlyTrendChart
          data={displayedMonthlySeries.map((point) => ({
            label: point.label,
            value: point.value,
          }))}
          color={DASHBOARD_METRIC_COLORS[selectedMetric]}
          formatValue={formatSelectedMetricValue}
          height={220}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {insightCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className="min-w-0 rounded-2xl bg-[var(--bg-hover)] p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: card.iconColor }} aria-hidden="true" />
              </span>
              <p className="mt-2 truncate text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {card.label}
              </p>
              <p className="mt-1 truncate text-base font-semibold text-[var(--text-primary)]">{card.value}</p>
              <p className={`mt-0.5 truncate text-[0.6875rem] font-medium ${card.captionClassName}`}>{card.caption}</p>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
