import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';
import { render } from '../../../../testing-library/react';
import type { ChangeLeadOpportunity, CreateLeadOpportunity, LeadOpportunitiesSnapshot, RelatedLead } from '../../domain/leadOpportunities';
import { LeadRelationshipsPanel } from '../LeadRelationshipsPanel';

type Mock<Args extends unknown[], Result> = ((...args: Args) => Result) & {
  mockReset: () => Mock<Args, Result>;
  mockResolvedValue: (value: Awaited<Result>) => Mock<Args, Result>;
  mockRejectedValueOnce: (value: unknown) => Mock<Args, Result>;
  mock: { calls: Args[] };
};
const mocks = vi.hoisted(() => {
  const fn = <Args extends unknown[], Result>() => vi.fn() as unknown as Mock<Args, Result>;
  return { role: 'admin', list: fn<[string], Promise<LeadOpportunitiesSnapshot>>(), search: fn<[string], Promise<RelatedLead[]>>(), create: fn<[CreateLeadOpportunity], Promise<void>>(), change: fn<[ChangeLeadOpportunity], Promise<void>>(), success: fn<[string], void>(), error: fn<[string], void>() };
});
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ role: mocks.role }) }));
vi.mock('../../data/leadOpportunitiesRepository', () => ({ leadOpportunitiesRepository: mocks }));
vi.mock('../../../../lib/toast', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('../../../../design-system/useMinimumLoading', () => ({ LOADING_CYCLE_MS: 2400, useMinimumLoading: (value: boolean) => value }));

const shared: LeadOpportunitiesSnapshot = { truncated: false, opportunities: [{ id: 'group-1', name: 'Plano da Lorrayne', status: 'won', archived: false, updated_at: '2026-11-12T15:00:00Z', primary_contact_lead_id: 'lead-2', members: [{ lead_id: 'lead-1', name: 'Claudio', status: 'Atendimento', is_primary_contact: false }, { lead_id: 'lead-2', name: 'Lorrayne', status: 'Convertido', is_primary_contact: true }], member_lead_ids: ['lead-1', 'lead-2'], member_count: 2, members_truncated: false }] };
const lead = { id: 'lead-1', nome_completo: 'Claudio' };
const flush = () => act(async () => { await Promise.resolve(); });
const button = (root: ParentNode, label: string) => {
  const match = Array.from(root.querySelectorAll('button')).find((item) => item.textContent === label || item.getAttribute('aria-label') === label);
  assert.ok(match, label);
  return match;
};
const input = (element: HTMLInputElement, value: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const resetMocks = () => {
  mocks.role = 'admin';
  mocks.list.mockReset().mockResolvedValue({ opportunities: [], truncated: false });
  mocks.search.mockReset().mockResolvedValue([{ id: 'lead-2', name: 'Lorrayne', phone: '5511999999999', status: 'Convertido' }]);
  mocks.create.mockReset().mockResolvedValue(undefined);
  mocks.change.mockReset().mockResolvedValue(undefined);
  mocks.success.mockReset(); mocks.error.mockReset();
};

test('cria um vínculo com outro contato e permite escolher Lorrayne como principal', async () => {
  resetMocks();
  const view = render(<LeadRelationshipsPanel lead={lead} />);
  try {
    await flush();
    act(() => button(view.container, 'Vincular contato').click());
    input(view.container.querySelector('input[type="search"]') as HTMLInputElement, 'Lorrayne');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    const candidate = Array.from(view.container.querySelectorAll('button')).find((item) => item.textContent?.includes('Lorrayne'));
    assert.ok(candidate);
    act(() => candidate.click());
    const primary = view.container.querySelector('select');
    assert.ok(primary);
    act(() => { primary.value = 'lead-2'; primary.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { button(view.container, 'Salvar vínculo').click(); button(view.container, 'Salvar vínculo').click(); });
    assert.equal(mocks.create.mock.calls.length, 1);
    assert.deepEqual(mocks.create.mock.calls[0][0].memberLeadIds, ['lead-1', 'lead-2']);
    assert.equal(mocks.create.mock.calls[0][0].primaryContactLeadId, 'lead-2');
    assert.ok(mocks.create.mock.calls[0][0].clientRequestId);
    assert.equal(mocks.list.mock.calls.length, 2);
  } finally { view.unmount(); }
});

test('exibe os dois contatos, protege o principal e envia a versão lida ao trocar o principal', async () => {
  resetMocks();
  mocks.list.mockResolvedValue(shared);
  const view = render(<LeadRelationshipsPanel lead={lead} />);
  try {
    await flush();
    assert.match(view.container.textContent ?? '', /Claudio.*Lorrayne/s);
    assert.equal(view.container.querySelector('[aria-label="Retirar vínculo de Lorrayne"]'), null);
    await act(async () => button(view.container, 'Definir Claudio como contato principal').click());
    assert.deepEqual(mocks.change.mock.calls[0][0], { action: 'primary', opportunityId: 'group-1', expectedUpdatedAt: shared.opportunities[0].updated_at, leadId: 'lead-1' });
  } finally { view.unmount(); }
});

test('não apresenta falha de leitura como ausência de vínculos', async () => {
  resetMocks();
  mocks.list.mockRejectedValueOnce(new Error('Não foi possível consultar os vínculos.'));
  const view = render(<LeadRelationshipsPanel lead={lead} />);
  try {
    await flush();
    assert.match(view.container.textContent ?? '', /Não foi possível consultar os vínculos/);
    assert.ok(!view.container.textContent?.includes('ainda não participa'));
    assert.equal(button(view.container, 'Vincular contato').disabled, true);
    await act(async () => button(view.container, 'Atualizar vínculos').click());
    assert.equal(button(view.container, 'Vincular contato').disabled, false);
  } finally { view.unmount(); }
});

test('bloqueia alterações após falha concorrente até atualizar os vínculos', async () => {
  resetMocks();
  mocks.list.mockResolvedValue(shared);
  mocks.change.mockRejectedValueOnce(new Error('A negociação foi alterada. Atualize os vínculos.'));
  const view = render(<LeadRelationshipsPanel lead={lead} />);
  try {
    await flush();
    await act(async () => button(view.container, 'Definir Claudio como contato principal').click());
    assert.equal(button(view.container, 'Definir Claudio como contato principal').disabled, true);
    assert.equal(mocks.success.mock.calls.length, 0);
    await act(async () => button(view.container, 'Atualizar vínculos').click());
    assert.equal(button(view.container, 'Definir Claudio como contato principal').disabled, false);
  } finally { view.unmount(); }
});

test('perfis sem permissão não consultam dados administrativos', () => {
  resetMocks();
  mocks.role = 'observer';
  const view = render(<LeadRelationshipsPanel lead={lead} />);
  assert.equal(view.container.textContent, '');
  assert.equal(mocks.list.mock.calls.length, 0);
  view.unmount();
});

test('ao atualizar após concorrência, a inclusão usa a nova versão da negociação', async () => {
  resetMocks();
  mocks.list.mockResolvedValue(shared);
  mocks.search.mockResolvedValue([{ id: 'lead-3', name: 'Maria', phone: null, status: 'Atendimento' }]);
  mocks.change.mockRejectedValueOnce(new Error('Atualize os vínculos.'));
  const view = render(<LeadRelationshipsPanel lead={lead} />);
  try {
    await flush();
    act(() => button(view.container, 'Adicionar pessoa').click());
    input(view.container.querySelector('input[type="search"]') as HTMLInputElement, 'Maria');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    act(() => button(view.container, 'MariaTelefone não informado').click());
    const save = () => Array.from(view.container.querySelectorAll<HTMLButtonElement>('[aria-label="Vincular pessoas à negociação"] button')).find((item) => item.textContent === 'Adicionar pessoa');
    await act(async () => save()?.click());
    assert.equal(mocks.change.mock.calls.length, 1);
    const nextVersion = '2026-11-12T16:00:00Z';
    mocks.list.mockResolvedValue({ ...shared, opportunities: [{ ...shared.opportunities[0], updated_at: nextVersion }] });
    await act(async () => button(view.container, 'Atualizar vínculos').click());
    await act(async () => save()?.click());
    assert.equal(mocks.change.mock.calls.length, 2);
    assert.equal(mocks.change.mock.calls[1][0].expectedUpdatedAt, nextVersion);
  } finally { view.unmount(); }
});
