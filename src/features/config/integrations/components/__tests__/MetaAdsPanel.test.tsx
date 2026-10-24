import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import type { MetaSnapshot } from '../../domain/metaAds';
import { isMetaQualified, metaConnectionLabel } from '../../domain/metaAds';

const mocks = vi.hoisted(() => ({
  snapshot: null as MetaSnapshot | null,
  error: null as string | null,
  refresh: async () => {}, review: async () => {}, requeue: async () => {}, requeueEvent: async () => {},search: () => {},loadHistory: async () => {},historyEnd: false,historyLoading: false,
}));
vi.mock('../../hooks/useMetaAds', () => ({ useMetaAds: () => ({ ...mocks,loading: false,saving: false,message: null }) }));
import MetaAdsPanel from '../MetaAdsPanel';
const emptySnapshot = (): MetaSnapshot => ({
  settings: { enabled: true,pageId: '111111111111111',formId: '222222222222222',adAccountId: 'act_333333333333333',commercialField: '' },
  serverConfigured: true,capiEnabled: false,webhookUrl: 'https://local.invalid/meta-lead-webhook',
  received: 0,imported: 0,pending: 0,failed: 0,eventsHeld: 0,eventsPending: 0,eventsFailed: 0,
  lastReceivedAt: null,lastImportedAt: null,history: [],attributions: [],receipts: [],events: [],
});
test('não apresenta ausência de recebimentos como conexão confirmada e mantém envio bloqueado', async () => {
  mocks.snapshot=emptySnapshot(); mocks.error=null;
  const view=render(<MetaAdsPanel />);
  try {
    assert.ok(document.body.textContent?.includes('Aguardando primeiro lead importado'));
    assert.ok(document.body.textContent?.includes('Nenhum lead da Meta foi importado'));
    assert.ok(document.body.textContent?.includes('Envio à Meta desabilitado'));
    assert.ok(!document.body.textContent?.includes('Conexão confirmada'));
    await act(async () => {
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Atualizar recebimentos'))?.click();
    });
  } finally { view.unmount(); }
});
test('explica falhas sem exibir credenciais ou supor sucesso de importação', () => {
  mocks.snapshot=null; mocks.error='Acesso exclusivo de administradores.';
  const view=render(<MetaAdsPanel />);
  try { assert.ok(document.body.textContent?.includes(mocks.error)); assert.ok(!document.body.textContent?.includes('Leads recebidos pelo CRM')); }
  finally { view.unmount(); }
});
test('qualificação exige os quatro critérios e status de conexão depende de evidência de importação', () => {
  const input={ attributionId: 'synthetic',eligibleBusiness: true,lives: 2,regionServed: true,interestConfirmed: true,opportunityId: null,contractId: null,contractCompleted: false };
  assert.equal(isMetaQualified(input),true);
  for (const partial of [{ eligibleBusiness: false },{ lives: 1 },{ regionServed: false },{ interestConfirmed: false }]) {
    assert.equal(isMetaQualified({ ...input,...partial }),false);
  }
  const snapshot=emptySnapshot();
  assert.equal(metaConnectionLabel(snapshot),'Aguardando primeiro lead importado');
  assert.equal(metaConnectionLabel({ ...snapshot,serverConfigured: false }),'Configuração do servidor pendente');
  assert.equal(metaConnectionLabel({ ...snapshot,settings: { ...snapshot.settings,enabled: false } }),'Recebimento pausado');
});
