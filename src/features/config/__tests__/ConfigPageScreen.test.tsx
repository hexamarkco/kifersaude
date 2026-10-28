import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ modules: new Set<string>() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ role: 'custom' }) }));
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => ({ getRoleModulePermission: (_role: string, module: string) => ({ can_view: mocks.modules.has(module), can_edit: false }) }) }));
vi.mock('../ai/AiConfigScreen', () => ({ default: () => <p>Área de IA</p> }));
vi.mock('../automation/AutomationSettingsScreen', () => ({ default: () => <p>Área de automações</p> }));
vi.mock('../integrations/IntegrationsScreen', () => ({ default: () => <p>Área de integrações</p> }));
vi.mock('../general/SystemSettingsScreen', () => ({ default: () => <p>Área geral</p> }));
vi.mock('../users/UsersScreen', () => ({ default: () => <p>Área de usuários</p> }));
vi.mock('../links/LinksScreen', () => ({ default: () => <p>Área de links</p> }));
vi.mock('../forms/FormsScreen', () => ({ default: () => <p>Área de formulários</p> }));

import ConfigPageScreen from '../ConfigPageScreen';

function LocationProbe() {
  const location = useLocation();
  return <output data-location>{location.pathname}{location.search}</output>;
}

const renderAt = (path: string, modules: string[]) => {
  mocks.modules = new Set(modules);
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

test('configuração de leads mostra o título da seção ativa sem repetir o cabeçalho interno', () => {
  const view = renderAt('/painel/config?tab=system&section=leads', ['config-system']);
  try {
    assert.equal(view.container.querySelector('h1')?.textContent, 'Etapas do funil');
    assert.ok(view.container.textContent?.includes('Organize as etapas e os cadastros usados no acompanhamento de leads.'));
  } finally { view.unmount(); }
});

test('configuração de origens explica o uso da lista na descrição da página', () => {
  const view = renderAt('/painel/config?tab=system&section=leads&leadTab=origins', ['config-system']);
  try {
    assert.equal(view.container.querySelector('h1')?.textContent, 'Origens dos leads');
    assert.ok(view.container.textContent?.includes('Defina os canais de entrada e a visibilidade das origens para observadores.'));
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
