import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxArchivedChatCount } from '../useInboxArchivedChatCount';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  getArchivedCount: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { getArchivedCount: mocks.getArchivedCount },
}));

type ArchivedCount = ReturnType<typeof useInboxArchivedChatCount>;

const Harness = ({ capture }: { capture: (state: ArchivedCount) => void }) => {
  capture(useInboxArchivedChatCount());
  return null;
};

const resetMocks = () => mocks.getArchivedCount.mockReset();

test('deduplica consultas concorrentes e permite atualizar após concluir', async () => {
  resetMocks();
  let resolveCount!: (count: number) => void;
  mocks.getArchivedCount.mockReturnValue(new Promise<number>((resolve) => { resolveCount = resolve; }));
  let archivedCount!: ArchivedCount;
  const view = render(<Harness capture={(state) => { archivedCount = state; }} />);

  try {
    await act(async () => {
      const first = archivedCount.refreshArchivedChatsCount();
      await archivedCount.refreshArchivedChatsCount();
      assert.equal(mocks.getArchivedCount.mock.calls.length, 1);
      resolveCount(7);
      await first;
    });

    assert.equal(archivedCount.archivedChatsCount, 7);
    await act(async () => { await archivedCount.refreshArchivedChatsCount(); });
    assert.equal(mocks.getArchivedCount.mock.calls.length, 2);
  } finally {
    view.unmount();
  }
});

test('registra erro inesperado, libera o lock e permite nova tentativa', async () => {
  resetMocks();
  mocks.getArchivedCount
    .mockRejectedValueOnce(new Error('falha no contador'))
    .mockResolvedValue(4);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  let archivedCount!: ArchivedCount;
  const view = render(<Harness capture={(state) => { archivedCount = state; }} />);

  try {
    await act(async () => { await archivedCount.refreshArchivedChatsCount(); });
    await act(async () => { await archivedCount.refreshArchivedChatsCount(); });

    assert.equal(mocks.getArchivedCount.mock.calls.length, 2);
    assert.equal(archivedCount.archivedChatsCount, 4);
    assert.equal(warn.mock.calls.length, 1);
  } finally {
    vi.restoreAllMocks();
    view.unmount();
  }
});

test('ignora falha de conectividade e resultado pendente após unmount', async () => {
  resetMocks();
  let rejectCount!: (error: Error) => void;
  mocks.getArchivedCount.mockReturnValue(new Promise<number>((_resolve, reject) => { rejectCount = reject; }));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  let archivedCount!: ArchivedCount;
  const view = render(<Harness capture={(state) => { archivedCount = state; }} />);
  let pendingRefresh!: Promise<void>;

  await act(async () => {
    pendingRefresh = archivedCount.refreshArchivedChatsCount();
    await Promise.resolve();
  });
  try {
    view.unmount();
    rejectCount(new Error('Falha de rede ao conectar com o Supabase'));
    await pendingRefresh;

    assert.equal(warn.mock.calls.length, 0);
  } finally {
    vi.restoreAllMocks();
  }
});
