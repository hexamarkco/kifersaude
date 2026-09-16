import { test, vi } from 'vitest';

interface MockFunction<TArgs extends unknown[], TResult> {
  (...args: TArgs): TResult;
  mock: { calls: TArgs[] };
  mockClear(): void;
  mockReturnValue(value: TResult): MockFunction<TArgs, TResult>;
  mockResolvedValue(value: Awaited<TResult>): MockFunction<TArgs, TResult>;
}

interface QueryChain {
  insert(input: unknown): QueryChain | Promise<{ error: null }>;
  update(input: unknown): QueryChain;
  select(columns: string): QueryChain;
  single(): Promise<{ data: { id: string }; error: null }>;
  eq(column: string, value: string): Promise<{ error: null }>;
}

const createMock = <TArgs extends unknown[], TResult>(): MockFunction<TArgs, TResult> =>
  vi.fn() as unknown as MockFunction<TArgs, TResult>;

const supabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: supabase,
  fetchAllPages: vi.fn(),
}));

import { saveContractDependent, saveContractHolder } from '../contractsRepository';

const database = supabase as unknown as {
  from: MockFunction<[string], QueryChain>;
  rpc: MockFunction<unknown[], unknown>;
};

const contractId = '42c47f2e-c306-493f-8d7d-c08495017974';
const holderId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const dependentId = 'f9e31ce8-5139-4fb3-8da0-d6605f4f98be';

const holder = {
  contract_id: contractId,
  nome_completo: 'Titular de teste',
  cpf: '000.000.000-00',
  data_nascimento: '1980-01-01',
  telefone: '0000000000',
};

const dependent = {
  contract_id: contractId,
  holder_id: holderId,
  nome_completo: 'Dependente de teste',
  cpf: null,
  data_nascimento: '2010-01-01',
  relacao: 'Filho(a)',
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const assertManualTableOnly = (table: string): void => {
  assert(database.from.mock.calls.some(([value]) => value === table), `expected write to ${table}`);
  assert(database.from.mock.calls.every(([value]) => value !== 'contract_holder_imports'), 'manual write used holder staging');
  assert(database.rpc.mock.calls.length === 0, 'manual write called an RPC');
};

test('manual holder creation keeps the existing direct insert path', async () => {
  database.from.mockClear();
  database.rpc.mockClear();

  const single = createMock<[], Promise<{ data: { id: string }; error: null }>>();
  single.mockResolvedValue({ data: { id: holderId }, error: null });
  const select = createMock<[string], QueryChain>();
  select.mockReturnValue({ single } as unknown as QueryChain);
  const insert = createMock<[unknown], QueryChain>();
  insert.mockReturnValue({ select } as unknown as QueryChain);
  database.from.mockReturnValue({ insert } as unknown as QueryChain);

  const result = await saveContractHolder(holder);

  assert(result === holderId, 'holder insert did not return its id');
  assert(insert.mock.calls[0]?.[0] === holder, 'holder insert payload changed');
  assert(select.mock.calls[0]?.[0] === 'id', 'holder insert no longer selects the id');
  assertManualTableOnly('contract_holders');
});

test('manual holder editing keeps the existing direct update path', async () => {
  database.from.mockClear();
  database.rpc.mockClear();

  const eq = createMock<[string, string], Promise<{ error: null }>>();
  eq.mockResolvedValue({ error: null });
  const update = createMock<[unknown], QueryChain>();
  update.mockReturnValue({ eq } as unknown as QueryChain);
  database.from.mockReturnValue({ update } as unknown as QueryChain);

  const result = await saveContractHolder(holder, holderId);

  assert(result === holderId, 'holder update changed its return id');
  assert(update.mock.calls[0]?.[0] === holder, 'holder update payload changed');
  assert(eq.mock.calls[0]?.[0] === 'id' && eq.mock.calls[0]?.[1] === holderId, 'holder update filter changed');
  assertManualTableOnly('contract_holders');
});

test('manual dependent creation keeps the existing direct insert path', async () => {
  database.from.mockClear();
  database.rpc.mockClear();

  const insert = createMock<[unknown], Promise<{ error: null }>>();
  insert.mockResolvedValue({ error: null });
  database.from.mockReturnValue({ insert } as unknown as QueryChain);

  await saveContractDependent(dependent);

  assert(insert.mock.calls[0]?.[0] === dependent, 'dependent insert payload changed');
  assertManualTableOnly('dependents');
});

test('manual dependent editing keeps the existing direct update path', async () => {
  database.from.mockClear();
  database.rpc.mockClear();

  const eq = createMock<[string, string], Promise<{ error: null }>>();
  eq.mockResolvedValue({ error: null });
  const update = createMock<[unknown], QueryChain>();
  update.mockReturnValue({ eq } as unknown as QueryChain);
  database.from.mockReturnValue({ update } as unknown as QueryChain);

  await saveContractDependent(dependent, dependentId);

  assert(update.mock.calls[0]?.[0] === dependent, 'dependent update payload changed');
  assert(eq.mock.calls[0]?.[0] === 'id' && eq.mock.calls[0]?.[1] === dependentId, 'dependent update filter changed');
  assertManualTableOnly('dependents');
});
