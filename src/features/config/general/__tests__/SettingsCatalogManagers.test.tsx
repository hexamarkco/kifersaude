import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import type { ConfigOption } from '../../domain/types';
import { CONTRACT_CONFIG_MANAGERS, LEAD_CONFIG_MANAGERS } from '../shared/systemSettingsConfig';

const mocks = await vi.hoisted(async () => {
  const { KIFER_THEME_COLORS } = await import('../../../../design-system/tokens');
  return {
    calls: [] as unknown[][],
    errors: [] as string[],
    confirm: true,
    options: {} as Record<string, ConfigOption[]>,
    statuses: [
      { id: 'initial', nome: 'Contato inicial', cor: KIFER_THEME_COLORS.darkCanvas, ordem: 1, ativo: true, padrao: true, created_at: '', updated_at: '' },
      { id: 'proposal', nome: 'Proposta enviada', cor: KIFER_THEME_COLORS.lightCanvas, ordem: 2, ativo: true, padrao: false, created_at: '', updated_at: '' },
    ],
    origins: [{ id: 'origin', nome: 'Indicação', ativo: true, visivel_para_observadores: false, created_at: '' }],
  };
});

vi.mock('../../../../contexts/ConfigContext', () => ({
  useConfig: () => ({
    options: mocks.options, leadStatuses: mocks.statuses, leadOrigins: mocks.origins,
    refreshCategory: async () => {}, refreshLeadStatuses: async () => {}, refreshLeadOrigins: async () => {},
  }),
}));
vi.mock('../../data/configService', () => ({
  configService: Object.fromEntries(['updateConfigOption', 'deleteConfigOption', 'updateLeadStatus', 'deleteLeadStatus', 'updateLeadOrigem', 'deleteLeadOrigem'].map((method) => [method, async (...args: unknown[]) => { mocks.calls.push([method, ...args]); return { error: null }; }])),
}));
vi.mock('../../../../hooks/useConfirmationModal', () => ({
  useConfirmationModal: () => ({ requestConfirmation: async () => mocks.confirm, ConfirmationDialog: null }),
}));
vi.mock('../../../../lib/toast', () => ({ toast: { error: (message: string) => mocks.errors.push(message), success: () => {} } }));

import ConfigOptionManager from '../components/ConfigOptionManager';
import LeadOriginsManager from '../components/LeadOriginsManager';
import LeadStatusManager from '../components/LeadStatusManager';

const reset = () => { mocks.calls = []; mocks.errors = []; mocks.confirm = true; };
const changeInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const blur = async (input: HTMLInputElement) => { await act(async () => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }); };
const button = (container: HTMLElement, label: string) => {
  const element = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  assert.ok(element, label);
  return element;
};

test('salva nome, ordem e disponibilidade na categoria correta em todos os cadastros auxiliares', async () => {
  for (const manager of [...LEAD_CONFIG_MANAGERS, ...CONTRACT_CONFIG_MANAGERS]) {
    reset();
    mocks.options = { [manager.category]: [{ id: 'option', category: manager.category, label: 'Opção original', value: 'original', ordem: 1, ativo: true, created_at: '', updated_at: '' }] };
    const view = render(<ConfigOptionManager category={manager.category} title={manager.title} />);
    try {
      const name = view.container.querySelector<HTMLInputElement>('input[value="Opção original"]');
      const order = view.container.querySelector<HTMLInputElement>('input[type="number"]');
      const active = view.container.querySelector<HTMLInputElement>('input[role="switch"]');
      assert.ok(name); assert.ok(order); assert.ok(active);
      await changeInput(name, 'Nome revisado'); await blur(name);
      await changeInput(order, '4'); await blur(order);
      await act(async () => active.click());
      assert.deepEqual(mocks.calls, [
        ['updateConfigOption', manager.category, 'option', { label: 'Nome revisado' }],
        ['updateConfigOption', manager.category, 'option', { ordem: 4 }],
        ['updateConfigOption', manager.category, 'option', { ativo: false }],
      ]);
    } finally { view.unmount(); }
  }
});

test('origens mantêm disponibilidade e visibilidade para observadores independentes', async () => {
  reset();
  const view = render(<LeadOriginsManager />);
  try {
    const active = view.container.querySelector<HTMLInputElement>('input[aria-label="Desativar origem Indicação"]');
    const visible = view.container.querySelector<HTMLInputElement>('input[aria-label="Exibir Indicação para observadores"]');
    assert.ok(active); assert.ok(visible);
    await act(async () => active.click());
    await act(async () => visible.click());
    assert.deepEqual(mocks.calls, [
      ['updateLeadOrigem', 'origin', { ativo: false }],
      ['updateLeadOrigem', 'origin', { visivel_para_observadores: true }],
    ]);
  } finally { view.unmount(); }
});

test('trocar etapa padrão atualiza a anterior e a nova; a etapa padrão não pode ser excluída', async () => {
  reset();
  const view = render(<LeadStatusManager />);
  try {
    await act(async () => button(view.container, 'Excluir status Contato inicial').click());
    assert.deepEqual(mocks.calls, []);
    assert.ok(mocks.errors[0]?.includes('padrão'));
    await act(async () => button(view.container, 'Definir Proposta enviada como padrão').click());
    assert.deepEqual(mocks.calls, [
      ['updateLeadStatus', 'initial', { padrao: false }],
      ['updateLeadStatus', 'proposal', { padrao: true }],
    ]);
  } finally { view.unmount(); }
});

test('não salva nomes vazios nem ordens inválidas', async () => {
  reset();
  const view = render(<LeadStatusManager />);
  try {
    const name = view.container.querySelector<HTMLInputElement>('input[value="Proposta enviada"]');
    const order = view.container.querySelector<HTMLInputElement>('input[type="number"]');
    assert.ok(name); assert.ok(order);
    await changeInput(name, '  '); await blur(name);
    await changeInput(order, '-1'); await blur(order);
    assert.deepEqual(mocks.calls, []);
    assert.equal(mocks.errors.length, 2);
  } finally { view.unmount(); }
});

test('cancelar a confirmação não exclui a origem', async () => {
  reset(); mocks.confirm = false;
  const view = render(<LeadOriginsManager />);
  try {
    await act(async () => button(view.container, 'Excluir origem Indicação').click());
    assert.deepEqual(mocks.calls, []);
  } finally { view.unmount(); }
});

test('listas de cadastro filtram por nome sem acentos e ordenam sem gravar a ordem de negócio', async () => {
  reset();
  mocks.options = { contract_modalidade: [
    { id: 'z', category: 'contract_modalidade', label: 'Zeta', value: 'z', ordem: 1, ativo: true, created_at: '', updated_at: '' },
    { id: 'a', category: 'contract_modalidade', label: 'Álfa', value: 'a', ordem: 2, ativo: true, created_at: '', updated_at: '' },
  ] };
  const view = render(<ConfigOptionManager category="contract_modalidade" title="Modalidades" />);
  try {
    const rowNames = () => Array.from(view.container.querySelectorAll<HTMLInputElement>('ul li input[id^="config-option-label"]')).map((input) => input.value);
    assert.deepEqual(rowNames(), ['Zeta', 'Álfa']);
    await act(async () => button(view.container, 'Ordenar por Nome da opção').click());
    assert.deepEqual(rowNames(), ['Álfa', 'Zeta']);
    const search = view.container.querySelector<HTMLInputElement>('input[aria-label="Buscar em Modalidades"]');
    assert.ok(search);
    await changeInput(search, 'alfa');
    assert.deepEqual(rowNames(), ['Álfa']);
    assert.deepEqual(mocks.calls, []);
    assert.equal(view.container.querySelector('.kds-card'), null);
    await changeInput(search, 'inexistente');
    assert.ok(view.container.textContent?.includes('Nenhum item encontrado'));
  } finally { view.unmount(); }
});

test('listas embutidas mantêm a ação e a superfície sem repetir o título da página', () => {
  reset();
  mocks.options = { contract_modalidade: [{ id: 'option', category: 'contract_modalidade', label: 'Modalidade', value: 'modalidade', ordem: 1, ativo: true, created_at: '', updated_at: '' }] };
  const view = render(<ConfigOptionManager category="contract_modalidade" title="Modalidades" />);
  try {
    assert.ok(Array.from(view.container.querySelectorAll('button')).some((item) => item.textContent?.includes('Adicionar opção')));
    assert.equal(view.container.querySelector('h3'), null);
    assert.ok(view.container.querySelector('.kds-surface'));
  } finally { view.unmount(); }
});
