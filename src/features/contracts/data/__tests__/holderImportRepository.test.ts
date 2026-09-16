import { test, vi } from 'vitest';

interface MockFunction<TArgs extends unknown[], TResult> {
  (...args: TArgs): TResult;
  mock: { calls: TArgs[] };
  mockResolvedValue(value: Awaited<TResult>): MockFunction<TArgs, TResult>;
}

type FunctionInvokeArgs = [
  string,
  { body: unknown; headers: Record<string, string> },
];
type FunctionInvokeResult = Promise<{ data: unknown; error: unknown }>;

const supabase = vi.hoisted(() => ({ functions: { invoke: vi.fn() } }));

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: supabase,
}));

import { createContractHolderImport } from '../holderImportRepository';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const invoke = supabase.functions.invoke as unknown as MockFunction<FunctionInvokeArgs, FunctionInvokeResult>;

test('holder import repository calls the internal endpoint and returns only opaque metadata', async () => {
  const input = {
    contract_id: '42c47f2e-c306-493f-8d7d-c08495017974',
    lead_id: '52c47f2e-c306-493f-8d7d-c08495017975',
    holder: {
      nome_completo: 'Titular de teste',
      cpf: '000.000.000-00',
      data_nascimento: '1980-01-01',
      telefone: '11900000000',
    },
  };
  invoke.mockResolvedValue({
    data: {
      success: true,
      import_id: '2d566723-20bd-4b9e-bb0e-c8b6ecbaebd1',
      expires_at: '2026-09-16T12:00:00Z',
      nome_completo: 'Titular de teste',
    },
    error: null,
  });

  const result = await createContractHolderImport(input);
  const [functionName, options] = invoke.mock.calls[invoke.mock.calls.length - 1]
    ?? ['', { body: null, headers: {} }];

  assert(functionName === 'contract-holder-imports', 'holder staging did not call the internal endpoint');
  assert(JSON.stringify(options.body) === JSON.stringify(input), 'holder payload changed before it reached the endpoint');
  assert(/^[0-9a-f-]{36}$/i.test(options.headers['X-Idempotency-Key']), 'request did not use an opaque UUID idempotency key');
  assert(JSON.stringify(result) === JSON.stringify({
    success: true,
    import_id: '2d566723-20bd-4b9e-bb0e-c8b6ecbaebd1',
    expires_at: '2026-09-16T12:00:00Z',
  }), 'repository returned fields beyond the import identifier and expiry');
  assert(!JSON.stringify(result).includes('Titular de teste'), 'repository returned personal data');
});

test('holder import repository uses a fixed error message instead of untrusted function output', async () => {
  invoke.mockResolvedValue({
    data: { success: false, message: 'database detail with CPF 000.000.000-00' },
    error: new Error('private server detail'),
  });

  let errorMessage = '';
  try {
    await createContractHolderImport({
      contract_id: '42c47f2e-c306-493f-8d7d-c08495017974',
      holder: {
        nome_completo: 'Titular de teste',
        cpf: '000.000.000-00',
        data_nascimento: '1980-01-01',
        telefone: '11900000000',
      },
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : '';
  }

  assert(errorMessage === 'Não foi possível preparar o titular para importação.', 'repository exposed an untrusted error');
});
