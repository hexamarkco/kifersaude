import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mockClear(): MockFunction<Args, Result>;
  mockResolvedValue(value: Awaited<Result>): MockFunction<Args, Result>;
  mockReturnValue(value: Result): MockFunction<Args, Result>;
};

type QueryResult = {
  data: Record<string, unknown> | null;
  error: unknown;
};

type SettingsQuery = {
  select: MockFunction<[string], SettingsQuery>;
  limit: MockFunction<[number], SettingsQuery>;
  maybeSingle: MockFunction<[], Promise<QueryResult>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const settingsQuery = {} as SettingsQuery;
  settingsQuery.select = createMock<[string], SettingsQuery>();
  settingsQuery.limit = createMock<[number], SettingsQuery>();
  settingsQuery.maybeSingle = createMock<[], Promise<QueryResult>>();
  settingsQuery.select.mockReturnValue(settingsQuery);
  settingsQuery.limit.mockReturnValue(settingsQuery);
  settingsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

  return {
    from: createMock<[string], SettingsQuery>(),
    settingsQuery,
  };
});

mocks.from.mockReturnValue(mocks.settingsQuery);

vi.mock('../../../../infrastructure/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { configService } from '../configService';

const resetQuery = () => {
  mocks.from.mockClear();
  mocks.settingsQuery.maybeSingle.mockClear();
  mocks.settingsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
};

test('mantém o fallback nulo quando o chamador não exige erro', async () => {
  resetQuery();
  const error = new Error('configurações indisponíveis');
  mocks.settingsQuery.maybeSingle.mockResolvedValue({ data: null, error });

  assert.equal(await configService.getSystemSettings(), null);
});

test('propaga falha quando a tela de configurações exige carregamento confirmado', async () => {
  resetQuery();
  const error = new Error('configurações indisponíveis');
  mocks.settingsQuery.maybeSingle.mockResolvedValue({ data: null, error });

  await assert.rejects(configService.getSystemSettings(true), error);
});
