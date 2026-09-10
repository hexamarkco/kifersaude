import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  FOLLOW_UP_REMINDER_TYPE,
  normalizeReminderTitle,
  normalizeReminderType,
} from '../reminderTypes';

test('normalizes legacy commercial reminder labels to Follow-up', () => {
  assert.equal(normalizeReminderType('Retorno'), FOLLOW_UP_REMINDER_TYPE);
  assert.equal(normalizeReminderType('follow up'), FOLLOW_UP_REMINDER_TYPE);
  assert.equal(normalizeReminderType('Outro'), 'Outro');
});

test('normalizes system-generated legacy follow-up titles', () => {
  assert.equal(normalizeReminderTitle('Retomar contato: Ana'), 'Follow-up: Ana');
  assert.equal(normalizeReminderTitle('Retorno agendado: Ana'), 'Follow-up agendado: Ana');
  assert.equal(normalizeReminderTitle('Retomar follow-up de WhatsApp'), 'Follow-up de WhatsApp');
});
