import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  formatWhatsAppPhoneDisplay,
  normalizePhoneNumber,
  resolveInternationalPhoneParts,
} from '../phoneUtils';

test('normalizes brazilian numbers with and without country code', () => {
  assert.equal(normalizePhoneNumber('+55 (11) 99876-5432'), '11998765432');
  assert.equal(normalizePhoneNumber('011998765432'), '11998765432');
});

test('formats brazilian and international phone numbers for display', () => {
  assert.equal(formatWhatsAppPhoneDisplay('5511998765432'), '+55 (11) 99876-5432');
  assert.equal(formatWhatsAppPhoneDisplay('14155552671'), '+1 (415) 555-2671');
});

test('resolves international phone parts when country code is present', () => {
  assert.deepEqual(resolveInternationalPhoneParts('8613812345678'), {
    countryCode: '86',
    national: '13812345678',
  });
});
