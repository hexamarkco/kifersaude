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
  data: unknown[] | null;
  error: unknown;
};

type ListQuery = {
  select: MockFunction<[string], ListQuery>;
  eq: MockFunction<[string, string], ListQuery>;
  order: MockFunction<[string, { ascending: boolean }], Promise<QueryResult>>;
  maybeSingle: MockFunction<[], Promise<QueryResult>>;
};

type SubmissionQuery = {
  select: MockFunction<[string], SubmissionQuery>;
  eq: MockFunction<[string, string], SubmissionQuery>;
  order: MockFunction<[string, { ascending: boolean }], SubmissionQuery>;
  limit: MockFunction<[number], Promise<QueryResult>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const formsQuery = {} as ListQuery;
  formsQuery.select = createMock<[string], ListQuery>();
  formsQuery.eq = createMock<[string, string], ListQuery>();
  formsQuery.order = createMock<[string, { ascending: boolean }], Promise<QueryResult>>();
  formsQuery.maybeSingle = createMock<[], Promise<QueryResult>>();
  formsQuery.select.mockReturnValue(formsQuery);
  formsQuery.eq.mockReturnValue(formsQuery);

  const stepsQuery = {} as ListQuery;
  stepsQuery.select = createMock<[string], ListQuery>();
  stepsQuery.eq = createMock<[string, string], ListQuery>();
  stepsQuery.order = createMock<[string, { ascending: boolean }], Promise<QueryResult>>();
  stepsQuery.maybeSingle = createMock<[], Promise<QueryResult>>();
  stepsQuery.select.mockReturnValue(stepsQuery);
  stepsQuery.eq.mockReturnValue(stepsQuery);

  const submissionsQuery = {} as SubmissionQuery;
  submissionsQuery.select = createMock<[string], SubmissionQuery>();
  submissionsQuery.eq = createMock<[string, string], SubmissionQuery>();
  submissionsQuery.order = createMock<[string, { ascending: boolean }], SubmissionQuery>();
  submissionsQuery.limit = createMock<[number], Promise<QueryResult>>();
  submissionsQuery.select.mockReturnValue(submissionsQuery);
  submissionsQuery.eq.mockReturnValue(submissionsQuery);
  submissionsQuery.order.mockReturnValue(submissionsQuery);

  return {
    from: createMock<[string], ListQuery | SubmissionQuery>(),
    formsQuery,
    stepsQuery,
    submissionsQuery,
  };
});

mocks.from.mockImplementation((table) => table === 'public_form_submissions' ? mocks.submissionsQuery : table === 'public_forms' ? mocks.formsQuery : mocks.stepsQuery);

vi.mock('../../infrastructure/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { formsService } from '../formsService';

const resetQuery = () => {
  mocks.from.mockClear();
  mocks.formsQuery.order.mockClear();
  mocks.formsQuery.maybeSingle.mockClear();
  mocks.stepsQuery.order.mockClear();
  mocks.submissionsQuery.order.mockClear();
  mocks.submissionsQuery.limit.mockClear();
};

test('propaga falha ao carregar a lista de formulários', async () => {
  resetQuery();
  const error = new Error('falha de conexão');
  mocks.formsQuery.order.mockResolvedValue({ data: null, error });

  await assert.rejects(formsService.getForms(), error);
});

test('propaga falha ao carregar as perguntas do formulário', async () => {
  resetQuery();
  const error = new Error('perguntas indisponíveis');
  mocks.stepsQuery.order.mockResolvedValue({ data: null, error });

  await assert.rejects(formsService.getFormSteps('form-1'), error);
});

test('propaga falha ao carregar as respostas do formulário', async () => {
  resetQuery();
  const error = new Error('respostas indisponíveis');
  mocks.submissionsQuery.limit.mockResolvedValue({ data: null, error });

  await assert.rejects(formsService.getFormSubmissions('form-1'), error);
});

test('propaga falha ao carregar um formulário público', async () => {
  resetQuery();
  const error = new Error('formulário indisponível');
  mocks.formsQuery.maybeSingle.mockResolvedValue({ data: null, error });

  await assert.rejects(formsService.getPublicForm('formulario'), error);
});
