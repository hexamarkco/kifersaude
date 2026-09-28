import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { InboxAgendaSummaryReminder } from '../../data';
import { useInboxChatAgendaSummary } from '../useInboxChatAgendaSummary';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mockImplementationOnce: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockResolvedValueOnce: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  listInboxAgendaReminders: vi.fn() as unknown as MockFunction,
  subscribeToInboxReminders: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  listInboxAgendaReminders: mocks.listInboxAgendaReminders,
  subscribeToInboxReminders: mocks.subscribeToInboxReminders,
}));

type AgendaSummary = ReturnType<typeof useInboxChatAgendaSummary>;
type AgendaOptions = Parameters<typeof useInboxChatAgendaSummary>[0];

const refreshCallbacks: Array<() => void> = [];
const unsubscribeReminder = vi.fn() as unknown as MockFunction;

const Harness = ({ options, capture }: {
  options: AgendaOptions;
  capture: (summary: AgendaSummary) => void;
}) => {
  capture(useInboxChatAgendaSummary(options));
  return null;
};

type StatefulHarnessControl = { update: (options: AgendaOptions) => void };

const StatefulHarness = ({ initialOptions, capture, control }: {
  initialOptions: AgendaOptions;
  capture: (summary: AgendaSummary) => void;
  control: StatefulHarnessControl;
}) => {
  const [options, setOptions] = useState(initialOptions);
  control.update = setOptions;
  capture(useInboxChatAgendaSummary(options));
  return null;
};

const createReminder = (
  id: string,
  dataLembrete: string,
  lido = false,
): InboxAgendaSummaryReminder => ({
  id,
  tipo: 'lembrete',
  titulo: `Lembrete ${id}`,
  data_lembrete: dataLembrete,
  lido,
});

const createOptions = (): AgendaOptions => ({
  selectedChatLeadId: 'lead-1',
  leadPanelId: 'lead-1',
  leadContracts: [{ id: 'contract-1' } as AgendaOptions['leadContracts'][number]],
});

const resetMocks = () => {
  mocks.listInboxAgendaReminders.mockReset();
  mocks.subscribeToInboxReminders.mockReset();
  refreshCallbacks.length = 0;
  unsubscribeReminder.mockReset();
  mocks.subscribeToInboxReminders.mockImplementation((...args) => {
    refreshCallbacks.push(args[2] as () => void);
    return unsubscribeReminder;
  });
};

const flushEffects = async () => {
  await act(async () => { await Promise.resolve(); });
};

test('carrega lembretes do lead e dos contratos e resume o próximo lembrete pendente', async () => {
  resetMocks();
  mocks.listInboxAgendaReminders.mockResolvedValue([
    createReminder('later', '2026-09-30T12:00:00.000Z'),
    createReminder('read', '2026-09-28T12:00:00.000Z', true),
    createReminder('next', '2026-09-29T12:00:00.000Z'),
  ]);
  let agenda!: AgendaSummary;
  const view = render(<Harness options={createOptions()} capture={(value) => { agenda = value; }} />);

  try {
    await flushEffects();

    assert.deepEqual(mocks.listInboxAgendaReminders.mock.calls[0], ['lead-1', ['contract-1']]);
    assert.deepEqual(agenda.chatAgendaSummary, {
      pendingCount: 2,
      nextReminder: createReminder('next', '2026-09-29T12:00:00.000Z'),
    });
    assert.equal(agenda.chatAgendaSummaryLoading, false);
    assert.equal(agenda.chatAgendaSummaryError, null);
    assert.deepEqual(mocks.subscribeToInboxReminders.mock.calls[0]?.slice(0, 2), ['lead-1', ['contract-1']]);
  } finally {
    view.unmount();
  }

  assert.equal(unsubscribeReminder.mock.calls.length, 1);
});

test('Realtime atualiza o resumo e a assinatura é liberada ao trocar o lead', async () => {
  resetMocks();
  mocks.listInboxAgendaReminders
    .mockResolvedValueOnce([createReminder('first', '2026-09-29T12:00:00.000Z')])
    .mockResolvedValueOnce([createReminder('updated', '2026-09-30T12:00:00.000Z')])
    .mockResolvedValueOnce([createReminder('lead-2', '2026-10-01T12:00:00.000Z')]);
  let agenda!: AgendaSummary;
  const control: StatefulHarnessControl = { update: () => undefined };
  const view = render(<StatefulHarness
    initialOptions={createOptions()}
    control={control}
    capture={(value) => { agenda = value; }}
  />);

  try {
    await flushEffects();
    await act(async () => { refreshCallbacks[0]?.(); await Promise.resolve(); });

    assert.equal(mocks.listInboxAgendaReminders.mock.calls.length, 2);
    assert.equal(agenda.chatAgendaSummary.nextReminder?.id, 'updated');

    act(() => control.update({ ...createOptions(), selectedChatLeadId: 'lead-2', leadPanelId: 'lead-2' }));
    await flushEffects();

    assert.equal(unsubscribeReminder.mock.calls.length, 1);
    assert.equal(mocks.subscribeToInboxReminders.mock.calls.length, 2);
  } finally {
    view.unmount();
  }
});

test('ignora resultado atrasado do lead anterior após a troca de conversa', async () => {
  resetMocks();
  let resolveOldLead!: (reminders: InboxAgendaSummaryReminder[]) => void;
  mocks.listInboxAgendaReminders
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOldLead = resolve; }))
    .mockResolvedValueOnce([createReminder('current', '2026-09-30T12:00:00.000Z')]);
  let agenda!: AgendaSummary;
  const control: StatefulHarnessControl = { update: () => undefined };
  const view = render(<StatefulHarness
    initialOptions={createOptions()}
    control={control}
    capture={(value) => { agenda = value; }}
  />);

  try {
    await flushEffects();
    act(() => control.update({ ...createOptions(), selectedChatLeadId: 'lead-2', leadPanelId: 'lead-2' }));
    await flushEffects();

    resolveOldLead([createReminder('stale', '2026-09-28T12:00:00.000Z')]);
    await flushEffects();

    assert.equal(agenda.chatAgendaSummary.nextReminder?.id, 'current');
    assert.equal(agenda.chatAgendaSummaryLoading, false);
  } finally {
    view.unmount();
  }
});
