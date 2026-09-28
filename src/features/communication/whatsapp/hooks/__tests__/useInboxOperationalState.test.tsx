import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppOperationalState } from '../../data';
import { useInboxOperationalState } from '../useInboxOperationalState';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  getOperationalState: vi.fn() as unknown as MockFunction,
}));

const resetMocks = () => mocks.getOperationalState.mockReset();

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { getOperationalState: mocks.getOperationalState },
}));

type OperationalStateLoader = ReturnType<typeof useInboxOperationalState>;
type OperationalStateOptions = Parameters<typeof useInboxOperationalState>[0];

const Harness = ({ options, capture }: { options: OperationalStateOptions; capture: (loader: OperationalStateLoader) => void }) => {
  capture(useInboxOperationalState(options));
  return null;
};

const createOptions = (initialState: CommWhatsAppOperationalState | null = null) => {
  const state = {
    operationalState: initialState,
    error: 'erro anterior' as string | null,
    loaded: false,
  };
  const options: OperationalStateOptions = {
    setOperationalState: (next) => {
      state.operationalState = applyStateUpdate(next, state.operationalState);
    },
    setOperationalStateError: (next) => {
      state.error = applyStateUpdate(next, state.error);
    },
    setOperationalStateLoaded: (next) => {
      state.loaded = applyStateUpdate(next, state.loaded);
    },
  };
  return { options, state };
};

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

test('carrega estado operacional e limpa erro anterior', async () => {
  resetMocks();
  const { options, state } = createOptions();
  const operationalState: CommWhatsAppOperationalState = { channel: null, configEnabled: true };
  mocks.getOperationalState.mockResolvedValue(operationalState);
  let loader!: OperationalStateLoader;

  render(<Harness options={options} capture={(value) => { loader = value; }} />);
  await act(async () => loader.loadOperationalState());

  assert.deepEqual(state.operationalState, operationalState);
  assert.equal(state.error, null);
  assert.equal(state.loaded, true);
});

test('preserva estado anterior se a consulta retorna nulo e libera nova tentativa após falha', async () => {
  resetMocks();
  const previousState: CommWhatsAppOperationalState = { channel: null, configEnabled: false };
  const { options, state } = createOptions(previousState);
  mocks.getOperationalState.mockRejectedValueOnce(new Error('falha de rede')).mockResolvedValue(null);
  let loader!: OperationalStateLoader;

  render(<Harness options={options} capture={(value) => { loader = value; }} />);
  await act(async () => loader.loadOperationalState());
  assert.equal(state.error, 'falha de rede');
  await act(async () => loader.loadOperationalState());

  assert.deepEqual(state.operationalState, previousState);
  assert.equal(state.error, null);
  assert.equal(state.loaded, true);
  assert.equal(mocks.getOperationalState.mock.calls.length, 2);
});

test('não inicia consultas concorrentes para o mesmo estado operacional', async () => {
  resetMocks();
  const { options } = createOptions();
  let resolveState!: (state: CommWhatsAppOperationalState) => void;
  mocks.getOperationalState.mockReturnValue(new Promise<CommWhatsAppOperationalState>((resolve) => { resolveState = resolve; }));
  let loader!: OperationalStateLoader;

  render(<Harness options={options} capture={(value) => { loader = value; }} />);
  await act(async () => {
    const first = loader.loadOperationalState();
    await loader.loadOperationalState();
    assert.equal(mocks.getOperationalState.mock.calls.length, 1);
    resolveState({ channel: null, configEnabled: true });
    await first;
  });

  assert.equal(mocks.getOperationalState.mock.calls.length, 1);
});
