import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isDuplicateLead } from '../leads';

type Call = { column: string; op: 'eq' | 'ilike'; value: string };

const makeSupabaseStub = (
  calls: Call[],
  responses: { data: { id: string }[] | null; error: unknown }[],
) => {
  let callIndex = -1;

  return {
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (column: string, value: string) => {
          calls.push({ column, op: 'eq', value });
          callIndex += 1;
          const response = responses[callIndex];
          return { limit: async (_n: number) => response };
        },
        ilike: (column: string, value: string) => {
          calls.push({ column, op: 'ilike', value });
          callIndex += 1;
          const response = responses[callIndex];
          return { limit: async (_n: number) => response };
        },
      }),
    }),
  } as any;
};

test('e-mail com sintaxe de filtro PostgREST (vírgula/parênteses) nunca é interpolado numa string de filtro', async () => {
  const calls: Call[] = [];
  const maliciousEmail = 'a@b.com),status_id.neq.null,and(email.ilike.a@b.com';
  const supabase = makeSupabaseStub(calls, [
    { data: [], error: null }, // telefone
    { data: [], error: null }, // email
  ]);

  await isDuplicateLead(supabase, '11999999999', maliciousEmail);

  // A condição de e-mail deve chegar como valor de parâmetro isolado do .ilike(),
  // nunca como fragmento concatenado dentro de uma string de filtro .or().
  const emailCall = calls.find((call) => call.op === 'ilike');
  assert.ok(emailCall, 'esperava uma chamada .ilike() para o e-mail');
  assert.equal(emailCall!.value, maliciousEmail.toLowerCase());
  assert.equal(emailCall!.column, 'email');
});

test('retorna true quando telefone bate', async () => {
  const calls: Call[] = [];
  const supabase = makeSupabaseStub(calls, [{ data: [{ id: 'lead-1' }], error: null }]);

  const result = await isDuplicateLead(supabase, '11999999999', null);

  assert.equal(result, true);
});

test('retorna true quando e-mail bate mesmo sem telefone', async () => {
  const calls: Call[] = [];
  const supabase = makeSupabaseStub(calls, [{ data: [{ id: 'lead-1' }], error: null }]);

  const result = await isDuplicateLead(supabase, '', 'lead@example.com');

  assert.equal(result, true);
});

test('retorna false quando nenhuma condição bate', async () => {
  const calls: Call[] = [];
  const supabase = makeSupabaseStub(calls, [
    { data: [], error: null },
    { data: [], error: null },
  ]);

  const result = await isDuplicateLead(supabase, '11999999999', 'lead@example.com');

  assert.equal(result, false);
});

test('retorna false quando telefone e e-mail estão ausentes', async () => {
  const calls: Call[] = [];
  const supabase = makeSupabaseStub(calls, []);

  const result = await isDuplicateLead(supabase, '', null);

  assert.equal(result, false);
  assert.equal(calls.length, 0);
});

test('ignora erro numa condição e ainda verifica a outra', async () => {
  const calls: Call[] = [];
  const supabase = makeSupabaseStub(calls, [
    { data: null, error: new Error('boom') }, // telefone falha
    { data: [{ id: 'lead-1' }], error: null }, // email bate
  ]);

  const result = await isDuplicateLead(supabase, '11999999999', 'lead@example.com');

  assert.equal(result, true);
});
