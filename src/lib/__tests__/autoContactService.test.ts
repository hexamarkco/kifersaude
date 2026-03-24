import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { Lead } from '../supabase';
import {
  getNextAllowedSendAt,
  type AutoContactSchedulingSettings,
} from '../autoContactService';

const baseScheduling: AutoContactSchedulingSettings = {
  timezone: 'America/Sao_Paulo',
  startHour: '08:00',
  endHour: '19:00',
  allowedWeekdays: [1, 2, 3, 4, 5],
  skipHolidays: true,
  dailySendLimit: null,
};

test('pula automaticamente feriados nacionais oficiais', () => {
  const scheduledAt = getNextAllowedSendAt(
    new Date('2025-04-21T15:00:00Z'),
    baseScheduling,
  );

  assert.equal(scheduledAt.toISOString(), '2025-04-22T11:00:00.000Z');
});

test('pula automaticamente feriados estaduais com base no estado do lead', () => {
  const lead = {
    id: 'lead-sp',
    nome_completo: 'Lead Sao Paulo',
    telefone: '11999999999',
    data_criacao: '2025-01-01T00:00:00.000Z',
    arquivado: false,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    estado: 'SP',
  } as Lead;

  const scheduledAt = getNextAllowedSendAt(
    new Date('2025-07-09T15:00:00Z'),
    baseScheduling,
    lead,
  );

  assert.equal(scheduledAt.toISOString(), '2025-07-10T11:00:00.000Z');
});
