import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  aggregateDashboardMonthlyTotals,
  formatDashboardDateInput,
  formatDashboardLastUpdated,
  formatDashboardMetricValue,
  parseDashboardDateString,
  parseDashboardDateValue,
  validateDashboardDate,
} from '../dashboardUtils';

test('validates dashboard dates in DD/MM/YYYY format', () => {
  assert.equal(validateDashboardDate('12/03/2026'), true);
  assert.equal(validateDashboardDate('31/02/2026'), false);
  assert.equal(validateDashboardDate('2026-03-12'), false);
});

test('formats partial date input as the user types', () => {
  assert.equal(formatDashboardDateInput('1203'), '12/03');
  assert.equal(formatDashboardDateInput('12032026'), '12/03/2026');
});

test('parses dashboard dates from both BR and ISO-like inputs', () => {
  assert.equal(parseDashboardDateString('12/03/2026').toISOString().startsWith('2026-03-12'), true);
  assert.equal(parseDashboardDateValue('2026-03-12')?.toISOString().startsWith('2026-03-12'), true);
  assert.equal(parseDashboardDateValue('invalido'), null);
});

test('aggregates monthly totals and formats metric values', () => {
  const series = aggregateDashboardMonthlyTotals(
    [
      { when: '2026-01-10', amount: 10 },
      { when: '2026-01-25', amount: 20 },
      { when: '2026-02-01', amount: 5 },
    ],
    (item) => parseDashboardDateValue(item.when),
    (item) => item.amount,
  );

  assert.deepEqual(
    series.map((item) => ({ label: item.label, value: item.value })),
    [
      { label: 'jan. de 26', value: 30 },
      { label: 'fev. de 26', value: 5 },
    ],
  );
  assert.equal(formatDashboardMetricValue(1234.5, 'comissoes'), 'R$ 1.234,50');
  assert.equal(formatDashboardMetricValue(12, 'leads'), '12');
});

test('formats last updated timestamps for dashboard labels', () => {
  const formatted = formatDashboardLastUpdated(new Date('2026-03-12T15:45:00.000Z'));
  assert.ok(formatted.includes('12/03/2026'));
});
