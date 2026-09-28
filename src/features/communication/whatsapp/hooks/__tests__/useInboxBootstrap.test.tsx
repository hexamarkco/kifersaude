import assert from 'node:assert/strict';
import { act } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxBootstrap } from '../useInboxBootstrap';

type BootstrapOptions = Parameters<typeof useInboxBootstrap>[0];

const Harness = ({ options }: { options: BootstrapOptions }) => {
  useInboxBootstrap(options);
  return null;
};

test('inicia os três carregamentos do inbox e encerra o estado de bootstrap', async () => {
  const calls: string[] = [];
  const loadingStates: boolean[] = [];
  const pending: Array<() => void> = [];
  const options: BootstrapOptions = {
    loadChats: () => { calls.push('chats'); return new Promise<void>((resolve) => pending.push(resolve)); },
    loadOperationalState: () => { calls.push('operational'); return new Promise<void>((resolve) => pending.push(resolve)); },
    refreshArchivedChatsCount: () => { calls.push('archived-count'); return new Promise<void>((resolve) => pending.push(resolve)); },
    setLoading: (loading) => { loadingStates.push(typeof loading === 'function' ? loading(false) : loading); },
  };
  const view = render(<Harness options={options} />);

  try {
    assert.deepEqual(calls, ['chats', 'operational', 'archived-count']);
    assert.deepEqual(loadingStates, [true]);

    await act(async () => {
      pending.forEach((resolve) => resolve());
      await Promise.resolve();
    });

    assert.deepEqual(loadingStates, [true, false]);
  } finally {
    view.unmount();
  }
});

test('não altera o estado de loading quando o bootstrap termina após unmount', async () => {
  const loadingStates: boolean[] = [];
  const pending: Array<() => void> = [];
  const options: BootstrapOptions = {
    loadChats: () => new Promise<void>((resolve) => pending.push(resolve)),
    loadOperationalState: () => new Promise<void>((resolve) => pending.push(resolve)),
    refreshArchivedChatsCount: () => new Promise<void>((resolve) => pending.push(resolve)),
    setLoading: (loading) => { loadingStates.push(typeof loading === 'function' ? loading(false) : loading); },
  };
  const view = render(<Harness options={options} />);
  assert.deepEqual(loadingStates, [true]);

  view.unmount();
  pending.forEach((resolve) => resolve());
  await act(async () => { await Promise.resolve(); });

  assert.deepEqual(loadingStates, [true]);
});
