import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { Lead } from '../../../leads';
import type { Contract } from '../../../contracts';
import type { DashboardOperationsInput } from '../../shared/dashboardTypes';
import { buildDashboardOperationsAnalysis, resolveDashboardDateRange } from '../dashboardOperations';

const lead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-1',
  nome_completo: 'Ana Silva',
  telefone: '11999999999',
  data_criacao: '2026-09-09',
  created_at: '2026-09-09T10:00:00.000Z',
  updated_at: '2026-09-10T10:00:00.000Z',
  arquivado: false,
  status: 'Negociação',
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

const input = (overrides: Partial<DashboardOperationsInput> = {}): DashboardOperationsInput => ({
  leads: [lead({ proximo_retorno: '2026-09-10' }), lead({ id: 'lead-2', nome_completo: 'Bruno', status: 'Proposta', data_criacao: '2026-09-11', created_at: '2026-09-11T10:00:00.000Z', updated_at: '2026-09-11T10:00:00.000Z' })],
  contracts: [contract({ lead_id: 'lead-1', data_inicio: '2026-09-11' })],
  reminders: [],
  interactions: [],
  statusHistory: [
    { id: 'history-1', lead_id: 'lead-1', status_anterior: 'Proposta', status_novo: 'Negociação', responsavel: 'Ana', created_at: '2026-09-10T10:00:00.000Z' },
    { id: 'history-2', lead_id: 'lead-2', status_anterior: 'Negociação', status_novo: 'Fechado', responsavel: 'Ana', created_at: '2026-09-11T10:00:00.000Z' },
  ],
  leadStatuses: [
    { id: 's1', nome: 'Proposta', cor: 'var(--brand-primary)', ordem: 1, ativo: true, padrao: false, created_at: '', updated_at: '' },
    { id: 's2', nome: 'Negociação', cor: 'var(--brand-primary)', ordem: 2, ativo: true, padrao: false, created_at: '', updated_at: '' },
  ],
  periodFilter: '7d',
  customStartDate: '',
  customEndDate: '',
  now: new Date('2026-09-12T12:00:00.000Z'),
  ...overrides,
});

test('resolves the selected range including its first and last day', () => {
  const range = resolveDashboardDateRange('7d', '', '', new Date('2026-09-12T12:00:00.000Z'));
  assert.equal(range?.start.getDate(), 6);
  assert.equal(range?.end.getDate(), 12);
});

test('derives operational attention and stage health from persisted activity', () => {
  const analysis = buildDashboardOperationsAnalysis(input());
  assert.equal(analysis.leadsCreated, 2);
  assert.equal(analysis.contractsCreated, 1);
  assert.equal(analysis.won, 1);
  assert.equal(analysis.attention.some((item) => item.kind === 'overdue-follow-up'), true);
  assert.equal(analysis.attention.some((item) => item.kind === 'missing-next-step'), true);
  assert.equal(analysis.stageHealth.find((stage) => stage.status === 'Negociação')?.count, 1);
  assert.equal(analysis.sourcePerformance[0]?.origin, 'Não informado');
});

test('does not fabricate a conversion percentage with no decided outcomes', () => {
  const analysis = buildDashboardOperationsAnalysis(input({ statusHistory: [] }));
  assert.equal(analysis.conversion, null);
  assert.equal(analysis.conversionPrevious, null);
});
