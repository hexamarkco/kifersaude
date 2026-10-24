import { databaseClient } from '../../../../infrastructure/supabase';
import type { MetaReviewInput, MetaSnapshot } from '../domain/metaAds';

export async function loadMetaAds(search = ''): Promise<MetaSnapshot> {
  const { data, error } = await databaseClient.functions.invoke<MetaSnapshot>('meta-ads-admin', { body: { action: 'snapshot',search } });
  if (error || !data) throw new Error('Não foi possível consultar a integração. Verifique seu acesso de administrador e a configuração do servidor.');
  return data;
}
export async function loadMetaHistory(before: string): Promise<MetaSnapshot['history']> {
  const { data, error } = await databaseClient.functions.invoke<MetaSnapshot['history']>('meta-ads-admin', { body: { action: 'history',before } });
  if (error || !data) throw new Error('Não foi possível consultar o histórico anterior.');
  return data;
}
export async function saveMetaReview(input: MetaReviewInput): Promise<void> {
  const { error } = await databaseClient.functions.invoke('meta-ads-admin', { body: { action: 'review', ...input } });
  if (error) throw new Error('Não foi possível salvar. Atualize a tela e confira os vínculos da oportunidade e do contrato.');
}
export async function requeueMetaReceipt(leadgenId: string): Promise<void> {
  const { error } = await databaseClient.functions.invoke('meta-ads-admin', { body: { action: 'requeue', leadgenId } });
  if (error) throw new Error('Não foi possível recolocar este recebimento na fila.');
}
export async function requeueMetaEvent(eventId: string): Promise<void> {
  const { error } = await databaseClient.functions.invoke('meta-ads-admin', { body: { action: 'requeueEvent', eventId } });
  if (error) throw new Error('Não foi possível revisar este sinal. Confira a avaliação comercial e o prazo de envio.');
}
