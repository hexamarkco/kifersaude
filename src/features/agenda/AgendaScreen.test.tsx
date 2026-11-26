import { act } from 'react';
import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { render } from '../../testing-library/react';
import type { ReminderListItem } from '../reminders';

type Mock = ((...args: unknown[]) => Promise<unknown>) & { mock: { calls: unknown[][] } };
const mocks = vi.hoisted(() => ({
  reminders: [] as ReminderListItem[],
  update: vi.fn(async () => undefined) as Mock,
  updateBatch: vi.fn(async () => undefined) as Mock,
  create: vi.fn(async () => ({ id: 'next-reminder' })) as Mock,
  sync: vi.fn(async () => null) as Mock,
  touch: vi.fn(async () => undefined) as Mock,
}));
vi.mock('../reminders', async () => {
  const actual = await (vi as typeof vi & { importActual: <T>(path: string) => Promise<T> })
    .importActual<typeof import('../reminders')>('../reminders');
  return {
  ...actual,
  listReminders: async () => mocks.reminders,
  listReminderContracts: async () => [],
  listReminderLeads: async () => [{ id: 'lead-1', nome_completo: 'Cliente', telefone: '11999999999' }],
  subscribeToReminderChanges: () => () => undefined,
  updateReminder: mocks.update,
  updateReminders: mocks.updateBatch,
  createReminder: mocks.create,
  };
});
vi.mock('../leads', () => ({ touchLeadContact: mocks.touch }));
vi.mock('../../lib/leadReminderUtils', () => ({ syncLeadNextReturnFromUpcomingReminder: mocks.sync }));
vi.mock('../../components/LeadForm', () => ({ default: () => null }));
vi.mock('./components/FollowUpAgendaOrganizerModal', () => ({ default: () => null }));
vi.mock('../../hooks/useConfirmationModal', () => ({ useConfirmationModal: () => ({ requestConfirmation: async () => true, ConfirmationDialog: null }) }));

import AgendaScreen from './AgendaScreen';

const resetMocks = () => {
  for (const mock of [mocks.update, mocks.updateBatch, mocks.create, mocks.sync, mocks.touch]) mock.mock.calls.length = 0;
};

const pendingReminder = (id = 'reminder-1'): ReminderListItem => ({
  id, lead_id: 'lead-1', tipo: 'Follow-up', titulo: 'Retornar contato',
  data_lembrete: new Date().toISOString(), lido: false, prioridade: 'normal',
});

const button = (label: string) => {
  const element = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  assert.ok(element);
  return element!;
};

const checkbox = () => document.querySelector<HTMLInputElement>('.kds-agenda-task-row input[type="checkbox"]');

const waitForAgenda = async (ready: () => boolean) => {
  const start = Date.now();
  while (!ready()) {
    if (Date.now() - start > 3000) throw new Error('Agenda não carregou os controles esperados.');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 16)); });
  }
};

test('concluir na Agenda abre o modal real e permite agendar um próximo lembrete pendente', async () => {
  resetMocks();
  mocks.reminders = [pendingReminder()];
  const view = render(<AgendaScreen />);
  try {
    await waitForAgenda(() => Boolean(checkbox()));
    await act(async () => { checkbox()?.click(); });
    assert.equal(mocks.update.mock.calls[0]?.[0], 'reminder-1');
    const patch = mocks.update.mock.calls[0]?.[1] as { lido: boolean; concluido_em: string };
    assert.equal(patch.lido, true);
    assert.ok(Number.isFinite(Date.parse(patch.concluido_em)));
    assert.ok(document.body.textContent?.includes('Deseja marcar um próximo lembrete para este lead?'));
    const scheduleButton = Array.from(document.querySelectorAll('button')).find((item) => item.textContent === 'Agendar lembrete');
    assert.ok(scheduleButton);
    await act(async () => { scheduleButton!.click(); });
    const created = mocks.create.mock.calls[0]?.[0] as Record<string, unknown>;
    assert.equal(created.lead_id, 'lead-1');
    assert.equal(created.lido, false);
    assert.equal(created.tipo, 'Follow-up');
    assert.deepEqual(mocks.touch.mock.calls, [['lead-1']]);
    assert.ok(!document.body.textContent?.includes('Deseja marcar um próximo lembrete para este lead?'));
  } finally { view.unmount(); }
});

test('conclusão em lote usa uma única data e não agenda outro lembrete automaticamente', async () => {
  resetMocks();
  mocks.reminders = [pendingReminder('r1'), pendingReminder('r2'), { ...pendingReminder('legacy'), lido: true }];
  const view = render(<AgendaScreen />);
  try {
    await waitForAgenda(() => Boolean(checkbox()));
    await act(async () => { button('Mais ações da página').click(); });
    const completeAll = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')).find((item) => item.textContent === 'Marcar itens filtrados como lidos');
    assert.ok(completeAll);
    await act(async () => { completeAll.click(); });
    assert.deepEqual(mocks.updateBatch.mock.calls[0]?.[0], ['r1', 'r2']);
    const patch = mocks.updateBatch.mock.calls[0]?.[1] as { lido: boolean; concluido_em: string };
    assert.equal(patch.lido, true);
    assert.ok(Number.isFinite(Date.parse(patch.concluido_em)));
    assert.equal(mocks.create.mock.calls.length, 0);
  } finally { view.unmount(); }
});

test('reabrir um encerrado histórico limpa a conclusão sem abrir o modal de próximo lembrete', async () => {
  resetMocks();
  mocks.reminders = [{ ...pendingReminder('legacy'), lido: true }];
  const view = render(<AgendaScreen />);
  try {
    await waitForAgenda(() => Array.from(document.querySelectorAll('button')).some((item) => item.textContent?.includes('Concluídos')));
    const completedTab = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.includes('Concluídos'));
    assert.ok(completedTab);
    await act(async () => { completedTab!.click(); });
    await waitForAgenda(() => Boolean(checkbox()?.checked));
    await act(async () => { checkbox()?.click(); });
    assert.deepEqual(mocks.update.mock.calls, [['legacy', { lido: false, concluido_em: null }]]);
    assert.ok(!document.body.textContent?.includes('Deseja marcar um próximo lembrete para este lead?'));
    assert.equal(mocks.create.mock.calls.length, 0);
  } finally { view.unmount(); }
});

test('não renderiza um badge de prioridade vazio em lembretes sem prioridade cadastrada', async () => {
  resetMocks();
  mocks.reminders = [{ ...pendingReminder(), prioridade: '', tipo: 'follow_up' }];
  const view = render(<AgendaScreen />);
  try {
    await waitForAgenda(() => Boolean(document.body.textContent?.includes('Follow-up')));
    const emptyBadges = Array.from(document.querySelectorAll('.kds-badge-sm'))
      .filter((badge) => !badge.textContent?.trim());
    assert.deepEqual(emptyBadges, []);
    assert.ok(document.body.textContent?.includes('Follow-up'));
    assert.ok(!document.body.textContent?.includes('follow_up'));
  } finally { view.unmount(); }
});

test('aplica prazo e busca juntos ao confirmar os filtros da agenda', async () => {
  resetMocks();
  mocks.reminders = [pendingReminder()];
  const view = render(<AgendaScreen />);
  try {
    await waitForAgenda(() => Boolean(checkbox()));
    const pending = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((item) => item.textContent === 'Pendentes');
    assert.ok(pending);
    await act(async () => { pending.click(); });
    const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent === 'Filtros');
    assert.ok(filters);
    await act(async () => { filters.click(); });
    const search = document.querySelector<HTMLInputElement>('#agenda-filter-search');
    const deadline = document.querySelector<HTMLButtonElement>('#agenda-filter-time');
    assert.ok(search && deadline);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'inexistente');
      search.dispatchEvent(new Event('input', { bubbles: true }));
      deadline.click();
    });
    const today = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((item) => item.textContent === 'Hoje');
    assert.ok(today);
    await act(async () => { today.click(); });
    const apply = document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]');
    assert.ok(apply);
    await act(async () => { apply.click(); });
    assert.ok(document.body.textContent?.includes('Nenhuma tarefa com esses filtros.'));
    assert.equal(checkbox(), null);
  } finally { view.unmount(); }
});

test('cancelar o filtro mantém os itens e não modifica lembretes', async () => {
  resetMocks();
  mocks.reminders = [pendingReminder()];
  const view = render(<AgendaScreen />);
  try {
    await waitForAgenda(() => Boolean(checkbox()));
    const pending = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(item => item.textContent === 'Pendentes');
    assert.ok(pending);
    await act(async () => pending.click());
    const filters = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Filtros');
    assert.ok(filters);
    await act(async () => filters.click());
    const dialog = document.querySelector('.kds-agenda-filter-dialog');
    assert.ok(dialog);
    const search = dialog.querySelector<HTMLInputElement>('#agenda-filter-search');
    assert.ok(search);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'inexistente');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal(search.value, 'inexistente');
    const cancel = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Cancelar');
    assert.ok(cancel);
    await act(async () => cancel.click());
    assert.equal(document.querySelector('.kds-agenda-filter-dialog'), null);
    assert.ok(checkbox());
    assert.equal(mocks.update.mock.calls.length, 0);
    assert.equal(mocks.create.mock.calls.length, 0);
  } finally { view.unmount(); }
});
