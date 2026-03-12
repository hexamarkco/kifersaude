import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  compareReminderQuickOpenItems,
  groupReminderQuickOpenItems,
  resolveReminderLeadName,
} from '../reminderQuickOpen';

test('derives lead name from reminder title when lead is missing', () => {
  assert.equal(resolveReminderLeadName('', 'Follow-up: Maria Silva'), 'Maria Silva');
  assert.equal(resolveReminderLeadName(null, null), 'Lead sem nome');
});

test('sorts reminder quick-open items by due date then label', () => {
  const first = {
    id: 'b',
    title: 'Ligacao',
    type: 'Retorno',
    priority: 'normal',
    dueAt: '2026-03-12T12:00:00.000Z',
    leadId: '1',
    leadName: 'Bruno',
    leadPhone: '',
  };
  const second = {
    id: 'a',
    title: 'Ligacao',
    type: 'Retorno',
    priority: 'normal',
    dueAt: '2026-03-12T13:00:00.000Z',
    leadId: '2',
    leadName: 'Ana',
    leadPhone: '',
  };

  assert.ok(compareReminderQuickOpenItems(first, second) < 0);
});

test('groups reminders into overdue and future buckets', () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const grouped = groupReminderQuickOpenItems([
    {
      id: 'overdue',
      title: 'Atrasado',
      type: 'Retorno',
      priority: 'alta',
      dueAt: yesterday.toISOString(),
      leadId: '1',
      leadName: 'Ana',
      leadPhone: '',
    },
    {
      id: 'future',
      title: 'Futuro',
      type: 'Follow-up',
      priority: 'normal',
      dueAt: tomorrow.toISOString(),
      leadId: '2',
      leadName: 'Bruno',
      leadPhone: '',
    },
  ]);

  assert.equal(grouped.overdue.length, 1);
  assert.equal(grouped.today.length + grouped.thisWeek.length + grouped.thisMonth.length + grouped.later.length, 1);
});
