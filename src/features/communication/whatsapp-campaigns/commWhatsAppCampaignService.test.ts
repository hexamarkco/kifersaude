import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type TestMock<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): TestMock<Args, Result>;
  mockResolvedValue(value: Awaited<Result>): TestMock<Args, Result>;
};

type Query = {
  select: TestMock<[string, ...unknown[]], Query>;
  eq: TestMock<[string, unknown], Query>;
  in: TestMock<[string, unknown[]], Query>;
  is: TestMock<[string, unknown], Query>;
  or: TestMock<[string], Query>;
  order: TestMock<[string, { ascending: boolean }], Query>;
  limit: TestMock<[number], Promise<{ data: unknown[]; error: unknown | null }>>;
  range: TestMock<[number, number], Promise<{ data: unknown[]; error: unknown | null; count: number }>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as TestMock<Args, Result>
  );
  const query = {} as Query;
  query.select = createMock<[string, ...unknown[]], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.in = createMock<[string, unknown[]], Query>();
  query.is = createMock<[string, unknown], Query>();
  query.or = createMock<[string], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.limit = createMock<[number], Promise<{ data: unknown[]; error: unknown | null }>>();
  query.range = createMock<[number, number], Promise<{ data: unknown[]; error: unknown | null; count: number }>>();

  const from = createMock<[string], Query>();
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: [], error: null });
  query.range.mockResolvedValue({ data: [], error: null, count: 0 });

  return { from, query };
});

vi.mock('../../../infrastructure/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
  getSupabaseErrorMessage: vi.fn(async (_error: unknown, fallback: unknown) => String(fallback)),
}));

import { commWhatsAppCampaignService } from './commWhatsAppCampaignService';

test('consultas de campanhas nao pedem lead_name removido dos chats remotos', async () => {
  const selectCallsBefore = mocks.query.select.mock.calls.length;

  await commWhatsAppCampaignService.listCampaignTargets('campaign-1');
  await commWhatsAppCampaignService.listPendingAiSuggestions();

  const campaignSelects = mocks.query.select.mock.calls
    .slice(selectCallsBefore)
    .map(([fields]) => fields);

  assert.equal(campaignSelects.length, 2);
  assert.equal(campaignSelects.every((fields) => !fields.includes('lead_name')), true);
  assert.equal(campaignSelects.every((fields) => fields.includes('lead_id')), true);
});
