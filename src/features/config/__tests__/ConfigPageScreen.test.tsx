import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ modules: new Set<string>(), canEdit: false }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ role: 'custom' }) }));
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => ({ getRoleModulePermission: (_role: string, module: string) => ({ can_view: mocks.modules.has(module), can_edit: mocks.canEdit }) }) }));
vi.mock('../ai/AiConfigScreen', () => ({ default: () => <p>Área de IA</p> }));
vi.mock('../automation/AutomationSettingsScreen', () => ({ default: () => <p>Área de automações</p> }));
vi.mock('../integrations/IntegrationsScreen', () => ({ default: () => <p>Área de integrações</p> }));
vi.mock('../general/SystemSettingsScreen', () => ({ default: () => <p>Área geral</p> }));
vi.mock('../users/UsersScreen', () => ({ default: ({ createDialogOpen }: { createDialogOpen: boolean }) => <><p>Área de usuários</p>{createDialogOpen && <div role="dialog">Criar usuário</div>}</> }));
vi.mock('../links/LinksScreen', () => ({ default: ({ createDialogOpen, showPageHeader }: { createDialogOpen: boolean; showPageHeader: boolean }) => <>{showPageHeader !== false && <h1>Links públicos interno</h1>}<p>Área de links</p>{createDialogOpen && <div role="dialog">Criar link</div>}</> }));
vi.mock('../forms/FormsScreen', () => ({ default: ({
  showPageHeader,
  createDialogOpen,
  onCreateAvailabilityChange,
  onEditorOpenChange,
}: {
  showPageHeader?: boolean;
  createDialogOpen?: boolean;
  onCreateAvailabilityChange?: (available: boolean) => void;
  onEditorOpenChange?: (open: boolean) => void;
}) => <>
  {showPageHeader !== false && <h2>Formulários de captação interno</h2>}
  <p>Área de formulários</p>
  <button type="button" onClick={() => onCreateAvailabilityChange?.(true)}>Lista pronta</button>
  <button type="button" onClick={() => onEditorOpenChange?.(true)}>Abrir editor</button>
  {createDialogOpen && <div role="dialog">Criar formulário</div>}
</> }));

import ConfigPageScreen from '../ConfigPageScreen';

function LocationProbe() {
  const location = useLocation();
  return <output data-location>{location.pathname}{location.search}</output>;
}

const renderAt = (path: string, modules: string[], canEdit = false) => {
  mocks.modules = new Set(modules);
  mocks.canEdit = canEdit;
  return render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/painel/config" element={<ConfigPageScreen />} />
      <Route path="/painel/automacoes" element={<ConfigPageScreen area="automation" />} />
    </Routes>
    <LocationProbe />
  </MemoryRouter>);
};

test('abre a nova área apenas com as abas permitidas', () => {
  const view = renderAt('/painel/automacoes', ['config-automation', 'config-integrations', 'config-ai', 'config-users']);
  try {
    assert.deepEqual(Array.from(view.container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent), ['Automações', 'Integrações', 'IA']);
    assert.ok(view.container.textContent?.includes('Área de automações'));
    assert.equal(view.container.textContent?.includes('Área de usuários'), false);
  } finally { view.unmount(); }
});

test('link anterior de IA mantém a seleção e os parâmetros para perfil com acesso somente à IA', () => {
  const view = renderAt('/painel/config?tab=ai&feature=lead-summary', ['config-ai']);
  try {
    assert.equal(view.container.querySelector('[data-location]')?.textContent, '/painel/automacoes?tab=ai&feature=lead-summary');
    assert.ok(view.container.textContent?.includes('Área de IA'));
    assert.equal(view.container.querySelectorAll('[role="tab"]').length, 1);
  } finally { view.unmount(); }
});

test('link anterior de integrações continua funcionando', () => {
  const view = renderAt('/painel/config?tab=integrations', ['config-integrations']);
  try {
    assert.equal(view.container.querySelector('[data-location]')?.textContent, '/painel/automacoes?tab=integrations');
    assert.ok(view.container.textContent?.includes('Área de integrações'));
  } finally { view.unmount(); }
});

test('cadastros e usuários permanecem na área de configurações', () => {
  const view = renderAt('/painel/automacoes?tab=users', ['config-users']);
  try {
    assert.equal(view.container.querySelector('[data-location]')?.textContent, '/painel/config?tab=users');
    assert.ok(view.container.textContent?.includes('Área de usuários'));
  } finally { view.unmount(); }
});

test('configuração de leads mostra o título da seção ativa sem repetir o cabeçalho interno', async () => {
  const view = renderAt('/painel/config?tab=system&section=leads', ['config-system']);
  try {
    assert.equal(view.container.querySelector('h1')?.textContent, 'Etapas do funil');
    const info = view.container.querySelector<HTMLButtonElement>('button[aria-label="Informações sobre Etapas do funil"]');
    assert.ok(info);
    await act(async () => { info.focus(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(document.body.querySelector('[role="tooltip"]')?.textContent, 'Organize as etapas e os cadastros usados no acompanhamento de leads.');
  } finally { view.unmount(); }
});

test('configuração de origens explica o uso da lista nas informações da página', async () => {
  const view = renderAt('/painel/config?tab=system&section=leads&leadTab=origins', ['config-system']);
  try {
    assert.equal(view.container.querySelector('h1')?.textContent, 'Origens dos leads');
    const info = view.container.querySelector<HTMLButtonElement>('button[aria-label="Informações sobre Origens dos leads"]');
    assert.ok(info);
    await act(async () => { info.focus(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(document.body.querySelector('[role="tooltip"]')?.textContent, 'Defina os canais de entrada e a visibilidade das origens para observadores.');
  } finally { view.unmount(); }
});

test('sem permissão não monta nenhuma tela de automação, integração ou IA', () => {
  const view = renderAt('/painel/automacoes?tab=ai', ['config-users']);
  try {
    assert.ok(view.container.textContent?.includes('Você não tem permissão'));
    assert.equal(view.container.textContent?.includes('Área de IA'), false);
    assert.equal(view.container.querySelectorAll('[role="tab"]').length, 0);
  } finally { view.unmount(); }
});

test('ação de criar usuário aparece somente com permissão de edição e fecha ao sair da aba', () => {
  const view = renderAt('/painel/config?tab=users', ['config-users', 'config-system'], true);
  try {
    const createButton = [...view.container.querySelectorAll('button')].find((button) => button.textContent?.includes('Novo usuário'));
    assert.ok(createButton);
    act(() => createButton.click());
    assert.ok(view.container.querySelector('[role="dialog"]'));

    const generalTab = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) => tab.textContent?.includes('Geral'));
    assert.ok(generalTab);
    act(() => generalTab.click());
    assert.equal(view.container.querySelector('[role="dialog"]'), null);
  } finally { view.unmount(); }

  const restrictedView = renderAt('/painel/config?tab=users', ['config-users']);
  try {
    assert.equal([...restrictedView.container.querySelectorAll('button')].some((button) => button.textContent?.includes('Novo usuário')), false);
  } finally { restrictedView.unmount(); }
});

test('Links públicos mantém um único cabeçalho e centraliza a criação na ação da página', () => {
  const view = renderAt('/painel/config?tab=links', ['config-links', 'config-system']);
  try {
    assert.equal(view.container.querySelectorAll('h1').length, 1);
    assert.equal(view.container.querySelector('h1')?.textContent, 'Links públicos');

    const createButton = [...view.container.querySelectorAll('button')].find((button) => button.textContent?.includes('Novo link'));
    assert.ok(createButton);
    act(() => createButton.click());
    assert.ok(view.container.querySelector('[role="dialog"]'));

    const generalTab = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) => tab.textContent?.includes('Geral'));
    assert.ok(generalTab);
    act(() => generalTab.click());
    assert.equal(view.container.querySelector('[role="dialog"]'), null);
  } finally { view.unmount(); }
});

test('Formulários centraliza o cabeçalho e a criação, sem duplicar a ação na lista', () => {
  const view = renderAt('/painel/config?tab=forms', ['config-forms', 'config-system']);
  try {
    assert.equal(view.container.querySelector('h1')?.textContent, 'Formulários de captação');
    assert.equal(view.container.querySelectorAll('h1').length, 1);
    assert.equal(view.container.textContent?.includes('Formulários de captação interno'), false);

    act(() => [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Lista pronta')!.click());
    const createButton = [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Novo formulário'));
    assert.ok(createButton);
    act(() => createButton.click());
    assert.equal(view.container.querySelector('[role="dialog"]')?.textContent, 'Criar formulário');

    const generalTab = [...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) => tab.textContent?.includes('Geral'));
    assert.ok(generalTab);
    act(() => generalTab.click());
    assert.equal(view.container.querySelector('[role="dialog"]'), null);
  } finally { view.unmount(); }
});

test('modo editor remove a ação de criação e atualiza o título da página', () => {
  const view = renderAt('/painel/config?tab=forms', ['config-forms', 'config-system']);
  try {
    act(() => [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Lista pronta')!.click());
    act(() => [...view.container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Abrir editor')!.click());
    assert.equal(view.container.querySelector('h1')?.textContent, 'Editor de formulários');
    assert.equal([...view.container.querySelectorAll('button')].some((button) => button.textContent?.includes('Novo formulário')), false);
  } finally { view.unmount(); }
});
