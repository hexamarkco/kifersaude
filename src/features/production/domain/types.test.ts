import assert from 'node:assert/strict';
import { test } from 'vitest';
import { productionDay, productionRange, productionSalesTrend, type ProductionEvent, type ProductionReport } from './types';

test('daily range uses Sao Paulo rather than browser timezone and spans month boundaries', () => {
  const now = new Date('2026-10-14T01:30:00Z');
  assert.equal(productionDay(now),'2026-10-13');
  assert.deepEqual(productionRange(1,now),{start:'2026-10-13',end:'2026-10-13'});
  assert.deepEqual(productionRange(30,now),{start:'2026-09-14',end:'2026-10-13'});
});

test('sales trend counts attributed sales in São Paulo and requires the complete report', () => {
  const sale: ProductionEvent = {
    id: 1, action: 'sale_closed', active: false, authorizer_user_id: null,
    entity_id: 'contract-1', entity_table: 'contracts', event_key: 'sale-1',
    identity_kind: 'authenticated', lead_id: null, occurred_at: '2026-11-23T01:30:00Z',
    operator_user_id: 'operator-1', origin: 'crm', scheduled: false, state: null,
  };
  const report: ProductionReport = {
    started_at: '2026-11-01T12:00:00Z',
    operators: [], summary: [], unattributed: { automation: 0, external: 0, unknown: 0 },
    events: [sale, { ...sale, id: 2, operator_user_id: null }, { ...sale, id: 3, action: 'sale_cancelled' }],
    total_events: 3,
  };
  const range = { start: '2026-11-22', end: '2026-11-23' };
  assert.deepEqual(productionSalesTrend(report, range), [{ label: '22/11', value: 1 }, { label: '23/11', value: 0 }]);
  assert.deepEqual(productionSalesTrend({ ...report, total_events: 4 }, range), []);
});
