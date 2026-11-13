import assert from 'node:assert/strict';
import { act } from 'react';
import { test } from 'vitest';
import { render } from '@testing-library/react';
import { MetaCommercialReview } from '../MetaCommercialReview';
import { getMetaReviewContracts, getMetaReviewProgress, type MetaAttribution, type MetaReviewInput } from '../../domain/metaAds';

const attribution = (): MetaAttribution => ({
  id: 'attribution-1', lead_id: 'contact-father', lead_name: 'Claudio', leadgen_id: '999999999999',
  campaign_id: null,campaign_name: null,adset_id: null,adset_name: null,ad_id: null,ad_name: null,
  form_id: '888888888888',meta_created_at: '2026-11-12T12:00:00Z',received_at: '2026-11-12T12:00:00Z',matched_existing: true,
  commercial_answer: null,traffic_type: 'paid',latest_review: null,
  opportunities: [{ id: 'group-1',label: 'Plano da filha',status: 'won' }],
  contracts: [{ id: 'own-contract',label: 'PRÓPRIO',lead_id: 'contact-father',lead_name: 'Claudio',opportunity_ids: [] },
    { id: 'daughter-contract',label: 'ADESÃO',lead_id: 'contact-daughter',lead_name: 'Filha',opportunity_ids: ['group-1'] }],
});
const labeled = <T extends Element>(root: ParentNode, label: string, tag: string): T => {
  const container = Array.from(root.querySelectorAll('label')).find((element) => element.textContent?.includes(label));
  assert.ok(container, label);
  const id = container.getAttribute('for');
  const field = id ? root.querySelector(`[id="${id}"]`) : container.querySelector(tag);
  assert.ok(field, label);
  return field as T;
};
const changeSelect = (root: ParentNode, index: number, value: string) => {
  const element = root.querySelectorAll('select')[index];
  act(() => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })); });
};
const numberInput = (root: ParentNode, value: string) => {
  const element = root.querySelector('input[type="number"]');
  assert.ok(element);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set?.call(element,value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const check = (root: ParentNode, label: string) => act(() => labeled<HTMLInputElement>(root,label,'input').click());
const submit = (root: ParentNode) => act(async () => root.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

test('registra adesão para uma pessoa com venda fechada e contrato pendente', async () => {
  const saved: MetaReviewInput[] = [];
  const view = render(<MetaCommercialReview attribution={attribution()} saving={false} save={async (input) => { saved.push(input); }} />);
  try {
    changeSelect(view.container,0,'collective_membership');
    numberInput(view.container,'1');
    check(view.container,'Elegibilidade e vínculo de adesão');
    check(view.container,'Atendimento na região necessária');
    check(view.container,'Interesse em contratar');
    check(view.container,'Venda fechada com o cliente');
    assert.match(view.container.textContent ?? '', /Critérios de qualificação atendidos/);
    assert.match(view.container.textContent ?? '', /Venda fechada — contrato pendente/);
    assert.equal(labeled<HTMLInputElement>(view.container,'Conferi o contrato','input').disabled,true);
    await submit(view.container);
    assert.equal(saved.length,1);
    assert.equal(saved[0].contractingModality,'collective_membership');
    assert.equal(saved[0].lives,1);
    assert.equal(saved[0].saleClosed,true);
    assert.equal(saved[0].contractCompleted,false);
    assert.equal(saved[0].contractId,null);
  } finally { view.unmount(); }
});

test('ao trocar a modalidade, pede nova confirmação de elegibilidade e atendimento', () => {
  const view = render(<MetaCommercialReview attribution={attribution()} saving={false} save={async () => undefined} />);
  try {
    changeSelect(view.container,0,'business');
    check(view.container,'Elegibilidade da empresa');
    check(view.container,'Atendimento na região necessária');
    changeSelect(view.container,0,'individual');
    assert.equal(labeled<HTMLInputElement>(view.container,'Elegibilidade dos beneficiários','input').checked,false);
    assert.equal(labeled<HTMLInputElement>(view.container,'Atendimento na região necessária','input').checked,false);
    assert.ok(!view.container.textContent?.includes('Empresário ou MEI com elegibilidade confirmada'));
  } finally { view.unmount(); }
});

test('oferece o contrato da filha somente na negociação escolhida e limpa a confirmação ao retirar o vínculo', async () => {
  const saved: MetaReviewInput[] = [];
  const view = render(<MetaCommercialReview attribution={attribution()} saving={false} save={async (input) => { saved.push(input); }} />);
  try {
    changeSelect(view.container,0,'collective_membership'); numberInput(view.container,'1');
    const contracts = () => Array.from(view.container.querySelectorAll('select')[2].options).map((item) => item.value);
    assert.deepEqual(contracts(),['','own-contract']);
    changeSelect(view.container,1,'group-1');
    assert.deepEqual(contracts(),['','own-contract','daughter-contract']);
    check(view.container,'Venda fechada com o cliente');
    changeSelect(view.container,2,'daughter-contract');
    check(view.container,'Conferi o contrato');
    await submit(view.container);
    assert.equal(saved[0].contractId,'daughter-contract');
    assert.equal(saved[0].opportunityId,'group-1');
    assert.equal(saved[0].contractCompleted,true);
    changeSelect(view.container,1,'');
    assert.equal(view.container.querySelectorAll('select')[2].value,'');
    assert.equal(labeled<HTMLInputElement>(view.container,'Conferi o contrato','input').checked,false);
  } finally { view.unmount(); }
});

test('preserva avaliações anteriores e distingue fechamento pendente de contrato confirmado', () => {
  const old = attribution();
  old.latest_review = { qualified: true,eligible_business: true,lives: 2,region_served: true,interest_confirmed: true,
    contract_completed: false,reviewed_at: '2026-11-12T14:00:00Z',contract_id: null,opportunity_id: null };
  const view = render(<MetaCommercialReview attribution={old} saving={false} save={async () => undefined} />);
  try {
    assert.equal(view.container.querySelector('select')?.value,'');
    assert.match(view.container.textContent ?? '', /avaliação anterior usou critérios de PME\/MEI/);
    assert.equal(getMetaReviewProgress({ contract_completed: false,sale_closed: true }),'Venda fechada — contrato pendente');
    assert.equal(getMetaReviewProgress({ contract_completed: true }),'Contrato cadastrado e contratação confirmada');
    assert.equal(getMetaReviewContracts(old,'').length,1);
  } finally { view.unmount(); }
});
