import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSupabaseErrorMessage: vi.fn(),
}));

vi.mock('../client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('../errors', () => ({
  getSupabaseErrorMessage: mocks.getSupabaseErrorMessage,
}));

import { waitForSupabaseSession } from '../session';

type TestMock = {
  mock: { calls: unknown[][] };
  mockReset: () => void;
  mockReturnValue: (value: unknown) => TestMock;
  mockRejectedValueOnce: (value: unknown) => TestMock;
  mockResolvedValueOnce: (value: unknown) => TestMock;
};

const getSessionMock = () => mocks.getSession as unknown as TestMock;
const getErrorMessageMock = () => mocks.getSupabaseErrorMessage as unknown as TestMock;

const resetMocks = () => {
  getSessionMock().mockReset();
  getErrorMessageMock().mockReset();
};

test('compartilha uma única leitura de sessão quando chamadas acontecem em paralelo', async () => {
  resetMocks();
  let resolveSession!: (value: { data: { session: object }; error: null }) => void;
  const sessionRequest = new Promise<{ data: { session: object }; error: null }>((resolve) => {
    resolveSession = resolve;
  });
  getSessionMock().mockReturnValue(sessionRequest);

  const firstRequest = waitForSupabaseSession();
  const secondRequest = waitForSupabaseSession();

  assert.equal(getSessionMock().mock.calls.length, 1);
  resolveSession({ data: { session: { access_token: 'token-1' } }, error: null });

  const [firstSession, secondSession] = await Promise.all([firstRequest, secondRequest]);
  assert.equal(firstSession.access_token, 'token-1');
  assert.equal(secondSession.access_token, 'token-1');
});

test('libera a leitura compartilhada depois de uma falha para permitir nova tentativa', async () => {
  resetMocks();
  getSessionMock()
    .mockRejectedValueOnce(new Error('falha temporária'))
    .mockResolvedValueOnce({ data: { session: { access_token: 'token-2' } }, error: null });

  await assert.rejects(() => waitForSupabaseSession({ timeoutMs: 0 }), /falha temporária/);
  const session = await waitForSupabaseSession();

  assert.equal(session.access_token, 'token-2');
  assert.equal(getSessionMock().mock.calls.length, 2);
});
