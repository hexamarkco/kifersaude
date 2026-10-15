import assert from 'node:assert/strict';
import { test } from 'vitest';
import { productionDay, productionRange } from './types';

test('daily range uses Sao Paulo rather than browser timezone and spans month boundaries', () => {
  const now = new Date('2026-10-14T01:30:00Z');
  assert.equal(productionDay(now),'2026-10-13');
  assert.deepEqual(productionRange(1,now),{start:'2026-10-13',end:'2026-10-13'});
  assert.deepEqual(productionRange(30,now),{start:'2026-09-14',end:'2026-10-13'});
});
