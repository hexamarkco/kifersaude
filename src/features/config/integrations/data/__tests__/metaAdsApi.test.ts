import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { saveMetaReview } from '../metaAdsApi';
import type { MetaReviewInput } from '../../domain/metaAds';

const state = vi.hoisted(() => ({ result: null as unknown,error: null as unknown,calls: [] as unknown[] }));
vi.mock('../../../../../infrastructure/supabase', () => ({
  databaseClient: { functions: { invoke: async (name: string, options: unknown) => { state.calls.push({ name, options }); return { data: state.result,error: state.error }; } } },
  getSupabaseErrorMessage: async () => 'Selecione um contrato da negociação escolhida.',
}));
const input: MetaReviewInput = { attributionId: 'attribution-1',contractingModality: 'collective_membership',eligibilityConfirmed: true,
  lives: 1,regionServed: true,interestConfirmed: true,saleClosed: true,contractCompleted: false,contractId: null,opportunityId: null };

test('salva modalidade, fechamento e contrato pendente pela função autenticada', async () => {
  state.calls = []; state.error = null; state.result = { reviewId: 'confirmed-review' };
  await saveMetaReview(input);
  assert.deepEqual(state.calls,[{ name: 'meta-ads-admin',options: { body: { action: 'review',...input } } }]);
});

test('não apresenta resposta ausente ou incompleta como avaliação salva', async () => {
  state.error = null;
  for (const result of [null,{}, { reviewId: '' },{ reviewId: 123 }]) {
    state.result = result;
    await assert.rejects(() => saveMetaReview(input),/avaliação não foi confirmada/);
  }
});

test('explica erros de vínculo do servidor e mantém falhas de rede em português', async () => {
  state.result = null;
  const serverError = Object.assign(new Error('HTTP non-2xx'),{ context: new Response('{}',{ status: 409 }) });
  state.error = serverError;
  await assert.rejects(() => saveMetaReview(input),/Selecione um contrato da negociação escolhida/);
  state.error = new Error('Failed to send request');
  await assert.rejects(() => saveMetaReview(input),/Não foi possível salvar/);
  state.error = null;
});
