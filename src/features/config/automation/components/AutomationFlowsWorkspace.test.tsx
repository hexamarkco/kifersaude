import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import type { AutoContactFlow } from '../../../../lib/autoContactService';
import AutomationFlowsWorkspace from './AutomationFlowsWorkspace';

const createFlow = (id: string, overrides: Partial<AutoContactFlow> = {}): AutoContactFlow => ({
  id,
  name: `Fluxo ${id}`,
  triggerStatus: 'Novo',
  ativo: true,
  triggerType: 'lead_created',
  triggerStatuses: [],
  triggerDurationHours: 0,
  steps: [{ id: `${id}-step`, delayValue: 0, delayUnit: 'minutes', actionType: 'send_message' }],
  ...overrides,
});

const renderWorkspace = (flows: AutoContactFlow[], onEditFlow: (flowId: string) => void = () => {}) => render(
  <AutomationFlowsWorkspace
    flows={flows}
    totalFlows={flows.length}
    activeFlows={flows.filter((flow) => flow.ativo !== false).length}
    totalSteps={flows.reduce((total, flow) => total + flow.steps.length, 0)}
    totalTemplates={3}
    dailyAutomationCount={12}
    dailyAutomationLoading={false}
    dailyAutomationError={null}
    search=""
    onSearchChange={() => {}}
    tagFilter="all"
    onTagFilterChange={() => {}}
    availableTags={[]}
    getConditionPreview={() => 'Lead criado'}
    onEditFlow={onEditFlow}
  />,
);

test('mostra o resumo real e o estado de cada fluxo na tabela', () => {
  const activeFlow = createFlow('ativo', { name: 'Boas-vindas' });
  const pausedFlow = createFlow('pausado', { name: 'Reativação', ativo: false, triggerType: 'inactivity_duration' });
  const view = renderWorkspace([activeFlow, pausedFlow]);

  try {
    assert.ok(view.container.textContent?.includes('Fluxos ativos'));
    assert.ok(view.container.textContent?.includes('2 configurados'));
    assert.ok(view.container.textContent?.includes('Mensagens hoje'));
    assert.equal(view.container.querySelectorAll('tbody tr').length, 2);
    assert.ok(view.container.textContent?.includes('Novo lead'));
    assert.ok(view.container.textContent?.includes('Tempo sem contato'));
    assert.equal(view.container.querySelectorAll('.kds-badge-success').length, 1);
    assert.equal(view.container.querySelectorAll('.kds-badge-warning').length, 1);
  } finally {
    view.unmount();
  }
});

test('abre a edição do fluxo pela ação explícita da linha', () => {
  let editedFlow: string | null = null;
  const view = renderWorkspace(
    [createFlow('principal', { name: 'Atendimento inicial' })],
    (flowId) => { editedFlow = flowId; },
  );

  try {
    const editButton = view.container.querySelector<HTMLButtonElement>('button[aria-label="Editar fluxo Atendimento inicial"]');
    assert.ok(editButton);
    act(() => editButton.click());
    assert.equal(editedFlow, 'principal');
  } finally {
    view.unmount();
  }
});

test('pagina a lista sem perder os indicadores do conjunto completo', () => {
  const flows = Array.from({ length: 11 }, (_, index) => createFlow(`flow-${index + 1}`));
  const view = renderWorkspace(flows);

  try {
    assert.equal(view.container.querySelectorAll('tbody tr').length, 10);
    const nextPage = view.container.querySelector<HTMLButtonElement>('button[aria-label="Próxima página"]');
    assert.ok(nextPage);
    act(() => nextPage.click());
    assert.equal(view.container.querySelectorAll('tbody tr').length, 1);
    assert.ok(view.container.textContent?.includes('11 configurados'));
  } finally {
    view.unmount();
  }
});

test('mostra um estado vazio claro sem inventar registros', () => {
  const view = render(
    <AutomationFlowsWorkspace
      flows={[]}
      totalFlows={0}
      activeFlows={0}
      totalSteps={0}
      totalTemplates={0}
      dailyAutomationCount={0}
      dailyAutomationLoading={false}
      dailyAutomationError={null}
      search=""
      onSearchChange={() => {}}
      tagFilter="all"
      onTagFilterChange={() => {}}
      availableTags={[]}
      getConditionPreview={() => 'Sem condições'}
      onEditFlow={() => {}}
    />,
  );

  try {
    assert.ok(view.container.textContent?.includes('Nenhum fluxo configurado'));
    assert.ok(view.container.textContent?.includes('Crie o primeiro fluxo'));
    assert.equal(view.container.querySelector('table'), null);
  } finally {
    view.unmount();
  }
});
