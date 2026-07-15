import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  formatPublicLeadAgeSummary,
  validatePublicLeadPayload,
} from '../../../supabase/functions/_shared/public-lead-validation';

const validPayload = {
  name: 'Ana Maria',
  phone: '21999999999',
  city: 'Rio de Janeiro',
  contractType: 'PF',
  totalLives: 2,
  ageSummary: {
    type: 'ranges',
    counts: {
      '00-18': 1,
      '19-23': 0,
      '24-28': 1,
      '29-33': 0,
      '34-38': 0,
      '39-43': 0,
      '44-48': 0,
      '49-53': 0,
      '54-58': 0,
      '59+': 0,
    },
  },
  website: '',
};

test('accepts a closed, internally consistent public lead payload', () => {
  const payload = validatePublicLeadPayload(validPayload);

  assert.ok(payload);
  assert.equal(payload.honeypotFilled, false);
  assert.equal(formatPublicLeadAgeSummary(payload.ageSummary), '00 - 18: 1, 24 - 28: 1');
});

test('rejects formatted phones, unexpected keys, and inconsistent age totals', () => {
  assert.equal(validatePublicLeadPayload({ ...validPayload, phone: '(21) 99999-9999' }), null);
  assert.equal(validatePublicLeadPayload({ ...validPayload, extra: 'unexpected' }), null);
  assert.equal(
    validatePublicLeadPayload({
      ...validPayload,
      totalLives: 3,
    }),
    null,
  );
});

test('marks a valid honeypot submission without admitting its value into the lead', () => {
  const payload = validatePublicLeadPayload({ ...validPayload, website: 'https://spam.example' });

  assert.ok(payload);
  assert.equal(payload.honeypotFilled, true);
});
