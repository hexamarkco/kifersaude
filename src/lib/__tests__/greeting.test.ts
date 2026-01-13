import { test } from 'vitest';
import assert from 'node:assert/strict';
import { getGreetingForDate, getGreetingTitleForDate } from '../greeting';
import { SAO_PAULO_TIMEZONE } from '../dateUtils';

test('returns correct greetings across morning, afternoon, and night transitions', () => {
  const morningUtc = new Date('2024-05-10T14:59:00Z');
  const afternoonUtc = new Date('2024-05-10T15:00:00Z');
  const nightUtc = new Date('2024-05-10T21:00:00Z');

  assert.equal(getGreetingForDate(morningUtc, SAO_PAULO_TIMEZONE), 'bom dia');
  assert.equal(getGreetingForDate(afternoonUtc, SAO_PAULO_TIMEZONE), 'boa tarde');
  assert.equal(getGreetingForDate(nightUtc, SAO_PAULO_TIMEZONE), 'boa noite');
});

test('capitalizes greeting title correctly', () => {
  const morningUtc = new Date('2024-05-10T14:00:00Z');

  assert.equal(getGreetingTitleForDate(morningUtc, SAO_PAULO_TIMEZONE), 'Bom dia');
});
