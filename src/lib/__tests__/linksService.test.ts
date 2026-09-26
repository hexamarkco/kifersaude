import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mockClear(): MockFunction<Args, Result>;
  mockImplementation(implementation: (...args: Args) => Result): MockFunction<Args, Result>;
  mockResolvedValue(value: Awaited<Result>): MockFunction<Args, Result>;
  mockReturnValue(value: Result): MockFunction<Args, Result>;
};

type QueryResult = {
  data: unknown[] | Record<string, unknown> | null;
  error: unknown;
};

type OrderOptions = { ascending: boolean };
type FilterValue = boolean | string;

type SettingsQuery = {
  select: MockFunction<[string], SettingsQuery>;
  eq: MockFunction<[string, FilterValue], SettingsQuery>;
  order: MockFunction<[string, OrderOptions], SettingsQuery>;
  limit: MockFunction<[number], SettingsQuery>;
  maybeSingle: MockFunction<[], Promise<QueryResult>>;
};

type ItemsQuery = {
  select: MockFunction<[string], ItemsQuery>;
  eq: MockFunction<[string, FilterValue], ItemsQuery>;
  order: MockFunction<[string, OrderOptions], ItemsQuery | Promise<QueryResult>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const settingsQuery = {} as SettingsQuery;
  settingsQuery.select = createMock<[string], SettingsQuery>();
  settingsQuery.eq = createMock<[string, FilterValue], SettingsQuery>();
  settingsQuery.order = createMock<[string, OrderOptions], SettingsQuery>();
  settingsQuery.limit = createMock<[number], SettingsQuery>();
  settingsQuery.maybeSingle = createMock<[], Promise<QueryResult>>();
  settingsQuery.select.mockReturnValue(settingsQuery);
  settingsQuery.eq.mockReturnValue(settingsQuery);
  settingsQuery.order.mockReturnValue(settingsQuery);
  settingsQuery.limit.mockReturnValue(settingsQuery);
  settingsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

  const itemsQuery = {} as ItemsQuery;
  itemsQuery.select = createMock<[string], ItemsQuery>();
  itemsQuery.eq = createMock<[string, FilterValue], ItemsQuery>();
  itemsQuery.order = createMock<[string, OrderOptions], ItemsQuery | Promise<QueryResult>>();
  itemsQuery.select.mockReturnValue(itemsQuery);
  itemsQuery.eq.mockReturnValue(itemsQuery);
  itemsQuery.order.mockImplementation((column) =>
    column === 'position'
      ? itemsQuery
      : Promise.resolve({ data: [], error: null }),
  );

  return {
    from: createMock<[string], SettingsQuery | ItemsQuery>(),
    settingsQuery,
    itemsQuery,
  };
});

mocks.from.mockImplementation((table) => table === 'public_link_page_settings' ? mocks.settingsQuery : mocks.itemsQuery);

vi.mock('../../infrastructure/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { linksService } from '../linksService';

const resetQueries = () => {
  mocks.from.mockClear();
  mocks.settingsQuery.maybeSingle.mockClear();
  mocks.itemsQuery.order.mockClear();
  mocks.settingsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.itemsQuery.order.mockImplementation((column) =>
    column === 'position'
      ? mocks.itemsQuery
      : Promise.resolve({ data: [], error: null }),
  );
};

test('propaga falha ao carregar as configurações da página de links', async () => {
  resetQueries();
  const error = new Error('configurações indisponíveis');
  mocks.settingsQuery.maybeSingle.mockResolvedValue({ data: null, error });

  await assert.rejects(linksService.getLinkPageSettings(), error);
});

test('propaga falha ao carregar os links', async () => {
  resetQueries();
  const error = new Error('links indisponíveis');
  mocks.itemsQuery.order.mockImplementation((column) =>
    column === 'position'
      ? mocks.itemsQuery
      : Promise.resolve({ data: null, error }),
  );

  await assert.rejects(linksService.getLinkItems(), error);
});

test('propaga falha das configurações ao carregar a página pública de links', async () => {
  resetQueries();
  const error = new Error('página indisponível');
  mocks.settingsQuery.maybeSingle.mockResolvedValue({ data: null, error });

  await assert.rejects(linksService.getPublicLinkPage(), error);
});

test('propaga falha dos links ao carregar a página pública de links', async () => {
  resetQueries();
  const error = new Error('itens indisponíveis');
  mocks.itemsQuery.order.mockImplementation((column) =>
    column === 'position'
      ? mocks.itemsQuery
      : Promise.resolve({ data: null, error }),
  );

  await assert.rejects(linksService.getPublicLinkPage(), error);
});
