import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { DashboardTrendSection } from './DashboardTrendSection';

test('dashboard trend keeps metric tabs readable and gives the chart a desktop layout hook', () => {
  const firstMonth = { label: 'Mai de 26', value: 251, date: new Date('2026-05-01T12:00:00'), variation: null };
  const lastMonth = { label: 'Out de 26', value: 81, date: new Date('2026-10-01T12:00:00'), variation: -41.7 };
  const view = render(
    <DashboardTrendSection
      selectedMetric="leads"
      chartRangeInMonths={6}
      displayedMonthlySeries={[
        firstMonth,
        { ...firstMonth, label: 'Jun de 26', value: 142 },
        { ...firstMonth, label: 'Jul de 26', value: 178 },
        { ...firstMonth, label: 'Ago de 26', value: 166 },
        { ...firstMonth, label: 'Set de 26', value: 137 },
        lastMonth,
      ]}
      latestMonthlyPoint={lastMonth}
      previousMonthlyPoint={{ ...lastMonth, label: 'Set de 26', value: 139, variation: null }}
      highestMonthlyPoint={firstMonth}
      averageMonthlyValue={159}
      onSelectedMetricChange={() => undefined}
      onChartRangeChange={() => undefined}
    />,
  );

  const metricSelector = view.container.querySelector('.kds-dashboard-trend-metrics');
  const metricLabels = Array.from(metricSelector?.querySelectorAll('[role="tab"]') ?? []).map((tab) => tab.textContent?.trim());
  assert.deepEqual(metricLabels, ['Leads', 'Contratos', 'Comissões']);
  assert.ok(view.container.querySelector('.kds-dashboard-monthly-trend-chart'));
});
