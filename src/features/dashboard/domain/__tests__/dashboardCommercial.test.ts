import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { Contract } from '../../../contracts';
import type { Lead } from '../../../leads';
import type { Reminder } from '../../../reminders';
import type { DashboardCommercialInput } from '../../shared/dashboardTypes';
import { buildDashboardCommercialAnalysis } from '../dashboardCommercial';

const lead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-1',
  nome_completo: 'Ana Silva',
  telefone: '11999999999',
  data_criacao: '2026-09-01',
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
  arquivado: false,
  status: 'Proposta enviada',
  ...overrides,
});

const contract = (overrides: Partial<Contract>): Contract => ({
  id: 'contract-1',
  codigo_contrato: 'C-1',
  status: 'Ativo',
  modalidade: 'PF',
  operadora: 'Kifer',
  produto_plano: 'Plano',
  responsavel: 'Ana',
  created_at: '2026-09-10T10:00:00.000Z',
  updated_at: '2026-09-10T10:00:00.000Z',
  ...overrides,
});

const input = (overrides: Partial<DashboardCommercialInput> = {}): DashboardCommercialInput => ({
  leads: [lead({ proximo_retorno: null }), lead({ id: 'lead-2', nome_completo: 'Bruno', status: 'Qualificação', data_criacao: '2026-09-10', created_at: '2026-09-10T10:00:00.000Z', updated_at: '2026-09-10T10:00:00.000Z', proximo_retorno: '2026-09-25' })],
  contracts: [contract({ lead_id: 'lead-1', data_inicio: '2026-09-10', mensalidade_total: 1500, comissao_prevista: 300, comissao_parcelas: [{ valor: 300, data_pagamento: '2026-09-15' }] })],
  reminders: [],
  interactions: [],
  statusHistory: [],
  leadStatuses: [
    { id: 's1', nome: 'Qualificação', cor: 'var(--brand-primary)', ordem: 1, ativo: true, padrao: false, created_at: '', updated_at: '' },
    { id: 's2', nome: 'Proposta enviada', cor: 'var(--brand-primary)', ordem: 2, ativo: true, padrao: false, created_at: '', updated_at: '' },
  ],
  periodFilter: '30d',
  customStartDate: '',
  customEndDate: '',
  now: new Date('2026-09-21T12:00:00.000Z'),
  ...overrides,
});

test('derives commercial KPIs and received commission from persisted contract data', () => {
  const analysis = buildDashboardCommercialAnalysis(input());

  assert.equal(analysis.salesCount, 1);
  assert.equal(analysis.monthlyRevenue, 1500);
  assert.equal(analysis.commissionExpected, 300);
  assert.equal(analysis.commissionReceived, 300);
  assert.equal(analysis.averageTicket, 1500);
  assert.equal(analysis.conversion, 50);
});

test('derives next-step coverage and does not fabricate opportunity value', () => {
  const analysis = buildDashboardCommercialAnalysis(input({ contracts: [] }));

  assert.equal(analysis.followUp.withNextStep, 1);
  assert.equal(analysis.followUp.withoutNextStep, 1);
  assert.equal(analysis.followUp.coverage, 50);
  assert.equal(analysis.pipelineValueAvailable, false);
  assert.equal(analysis.pipelineValue, 0);
});

test('flags advanced stale opportunities and uses linked monthly value when available', () => {
  const analysis = buildDashboardCommercialAnalysis(input());

  assert.equal(analysis.stuck.count, 1);
  assert.equal(analysis.stuck.amount, 1500);
  assert.equal(analysis.stuck.valueAvailable, true);
  assert.equal(analysis.opportunities[0]?.signal, 'Etapa avançada');
});

test('only labels a lead with overdue follow-up when Agenda has an unread overdue reminder', () => {
  const leadWithOldReturn = lead({ id: 'lead-overdue', nome_completo: 'Sem lembrete', status: 'Qualificação', proximo_retorno: '2026-09-10' });
  const reminder: Reminder = {
    id: 'reminder-1',
    lead_id: 'lead-overdue',
    tipo: 'Follow-up',
    titulo: 'Retornar contato',
    data_lembrete: '2026-09-10T12:00:00.000Z',
    lido: false,
    prioridade: 'normal',
    created_at: '2026-09-10T10:00:00.000Z',
  };

  const withoutReminder = buildDashboardCommercialAnalysis(input({ leads: [leadWithOldReturn], reminders: [] }));
  assert.notEqual(withoutReminder.opportunities[0]?.signal, 'Follow-up vencido');

  const withReminder = buildDashboardCommercialAnalysis(input({ leads: [leadWithOldReturn], reminders: [reminder] }));
  assert.equal(withReminder.opportunities[0]?.signal, 'Follow-up vencido');
  assert.equal(withReminder.agenda.overdue, 1);
});
