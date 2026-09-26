import assert from 'node:assert/strict';
import { test } from 'vitest';

import { createChatFilterMatcher } from '../chatFilters';

const chat = (overrides: Record<string, unknown> = {}) => ({
  unread_count: 1,
  manual_unread: false,
  lead_status: 'Em andamento',
  lead_responsavel_id: 'responsavel-1',
  ...overrides,
});

test('aplica os filtros pré-calculados de atividade, status e responsável', () => {
  const matches = createChatFilterMatcher({
    activityFilter: 'unread',
    leadStatusFilters: ['  EM ANDAMENTO  '],
    leadResponsavelFilters: [' responsavel-1 '],
  });

  assert.equal(matches(chat()), true);
  assert.equal(matches(chat({ unread_count: 0 })), false);
  assert.equal(matches(chat({ lead_status: 'Perdido' })), false);
  assert.equal(matches(chat({ lead_responsavel_id: 'responsavel-2' })), false);
});

test('mantém o comportamento de filtros vazios e de conversa marcada manualmente', () => {
  const matches = createChatFilterMatcher({
    activityFilter: 'unread',
    leadStatusFilters: [],
    leadResponsavelFilters: [],
  });

  assert.equal(matches(chat({ unread_count: 0, manual_unread: true })), true);
  assert.equal(matches(chat({ unread_count: 0, manual_unread: false })), false);
});

test('mantém a semântica de lista de filtro preenchida somente com espaços', () => {
  const matches = createChatFilterMatcher({
    activityFilter: 'all',
    leadStatusFilters: ['   '],
    leadResponsavelFilters: [],
  });

  assert.equal(matches(chat()), false);
});
