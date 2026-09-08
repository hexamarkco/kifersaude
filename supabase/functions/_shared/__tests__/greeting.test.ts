import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  DEFAULT_GREETING_TIMEZONE,
  formatGreetingTitle,
  getGreetingForDate,
} from '../greeting';

test('keeps Edge Function greetings aligned with Sao Paulo business periods', () => {
  assert.equal(getGreetingForDate(new Date('2024-05-10T14:59:00Z'), DEFAULT_GREETING_TIMEZONE), 'bom dia');
  assert.equal(getGreetingForDate(new Date('2024-05-10T15:00:00Z'), DEFAULT_GREETING_TIMEZONE), 'boa tarde');
  assert.equal(getGreetingForDate(new Date('2024-05-10T21:00:00Z'), DEFAULT_GREETING_TIMEZONE), 'boa noite');
  assert.equal(formatGreetingTitle('bom dia'), 'Bom dia');
});

test('falls back safely when a configured timezone is invalid', () => {
  assert.equal(getGreetingForDate(new Date('2024-05-10T15:00:00Z'), 'invalid/timezone'), 'boa tarde');
});
