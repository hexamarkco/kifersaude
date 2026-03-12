import assert from 'node:assert/strict';
import { test } from 'vitest';

import LegacyDashboard from '../Dashboard';
import FeatureDashboard from '../../features/dashboard/DashboardScreen';

test('legacy dashboard adapter forwards the feature screen export', () => {
  assert.equal(LegacyDashboard, FeatureDashboard);
});
