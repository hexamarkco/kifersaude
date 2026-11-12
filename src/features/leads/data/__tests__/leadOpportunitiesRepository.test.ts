import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { leadOpportunitiesRepository } from '../leadOpportunitiesRepository';

const state = vi.hoisted(() => ({ calls: [] as unknown[], result: null as unknown, error: null as unknown, filters: [] as string[] }));
vi.mock('../../../../infrastructure/supabase', () => ({
  supabase: { functions: { invoke: async (name: string, options: unknown) => { state.calls.push({ name, options }); return { data: state.result, error: state.error }; } } },
  databaseClient: { from: () => {
    const query = { select: () => query, eq: () => query, or: (filter: string) => { state.filters.push(filter); return query; }, order: () => query, limit: async () => ({ data: [], error: null }) };
    return query;
  } },
}));

test('consulta oportunidades pela função autenticada e valida a ausência confirmada', async () => {
  state.calls = []; state.error = null;
  state.result = { success: true, opportunities: [], opportunities_truncated: false };
  assert.deepEqual(await leadOpportunitiesRepository.list('lead-1'), { opportunities: [], truncated: false });
  assert.deepEqual(state.calls, [{ name: 'lead-opportunities', options: { body: { action: 'list', leadId: 'lead-1' } } }]);
});

test('não interpreta sucesso sem negociação como uma gravação confirmada', async () => {
  state.error = null; state.result = { success: true };
  await assert.rejects(() => leadOpportunitiesRepository.create({ name: 'Plano', memberLeadIds: ['lead-1', 'lead-2'], primaryContactLeadId: 'lead-2', clientRequestId: 'draft-1' }), /confirmar o vínculo/);
  state.result = { success: true, opportunity: { id: 'outro-grupo' } };
  await assert.rejects(() => leadOpportunitiesRepository.change({ action: 'primary', opportunityId: 'group-1', expectedUpdatedAt: '2026-11-12', leadId: 'lead-2' }), /confirmar a alteração/);
});

test('explica concorrência e propaga falhas sem indicar sucesso', async () => {
  state.error = null; state.result = { success: false, error: { code: 'STALE_WRITE' } };
  await assert.rejects(() => leadOpportunitiesRepository.list('lead-1'), /alterada por outra pessoa/);
  state.error = new Error('network');
  await assert.rejects(() => leadOpportunitiesRepository.list('lead-1'), /Não foi possível consultar ou salvar/);
  state.error = null;
});

test('limita buscas curtas e mantém caracteres de filtro fora do PostgREST', async () => {
  state.filters = [];
  await leadOpportunitiesRepository.search('A');
  assert.equal(state.filters.length, 0);
  await leadOpportunitiesRepository.search('Lorrayne,(teste)%');
  assert.equal(state.filters.length, 1);
  assert.equal(state.filters[0], 'nome_completo.ilike.%Lorrayne  teste%,telefone.ilike.%Lorrayne  teste%');
});
