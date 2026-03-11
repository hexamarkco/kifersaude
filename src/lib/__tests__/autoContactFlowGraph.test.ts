import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { AutoContactFlow } from '../autoContactService';
import { expandFlowGraphToFlows } from '../autoContactFlowGraph';

const buildBaseFlow = (): AutoContactFlow => ({
  id: 'flow-branch',
  name: 'Fluxo com bifurcacao',
  triggerStatus: '',
  triggerType: 'lead_created',
  triggerStatuses: [],
  triggerDurationHours: 24,
  steps: [],
  finalStatus: '',
  invalidNumberAction: 'none',
  invalidNumberStatus: '',
  conditionLogic: 'all',
  conditions: [],
  exitConditionLogic: 'any',
  exitConditions: [],
  tags: [],
  scheduling: {
    startHour: '08:00',
    endHour: '19:00',
    allowedWeekdays: [1, 2, 3, 4, 5],
    dailySendLimit: null,
  },
  flowGraph: {
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
          label: 'Lead criado',
          triggerType: 'lead_created',
          triggerStatuses: [],
          triggerDurationHours: 24,
        },
      },
      {
        id: 'condition-status',
        type: 'condition',
        position: { x: 200, y: 0 },
        data: {
          label: 'Status e novo',
          conditionLogic: 'all',
          conditions: [
            {
              id: 'condition-status-rule',
              field: 'status',
              operator: 'equals',
              value: 'Novo',
            },
          ],
        },
      },
      {
        id: 'action-intro',
        type: 'action',
        position: { x: 400, y: 0 },
        data: {
          label: 'Mensagem inicial',
          step: {
            id: 'step-intro',
            delayValue: 0,
            delayUnit: 'hours',
            actionType: 'send_message',
            messageSource: 'custom',
            customMessage: {
              type: 'text',
              text: 'Oi {{primeiro_nome}}',
            },
          },
        },
      },
      {
        id: 'condition-whatsapp',
        type: 'condition',
        position: { x: 600, y: 0 },
        data: {
          label: 'WhatsApp valido',
          conditionLogic: 'all',
          conditions: [
            {
              id: 'condition-whatsapp-rule',
              field: 'whatsapp_valid',
              operator: 'equals',
              value: 'true',
            },
          ],
        },
      },
      {
        id: 'action-yes',
        type: 'action',
        position: { x: 840, y: -80 },
        data: {
          label: 'Atualizar para contato inicial',
          step: {
            id: 'step-yes',
            delayValue: 0,
            delayUnit: 'hours',
            actionType: 'update_status',
            statusToSet: 'Contato Inicial',
          },
        },
      },
      {
        id: 'action-no',
        type: 'action',
        position: { x: 840, y: 80 },
        data: {
          label: 'Atualizar para perdido',
          step: {
            id: 'step-no',
            delayValue: 0,
            delayUnit: 'hours',
            actionType: 'update_status',
            statusToSet: 'Perdido',
          },
        },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'condition-status' },
      { id: 'edge-2', source: 'condition-status', target: 'action-intro', sourceHandle: 'yes', label: 'Sim' },
      { id: 'edge-3', source: 'action-intro', target: 'condition-whatsapp' },
      { id: 'edge-4', source: 'condition-whatsapp', target: 'action-yes', sourceHandle: 'yes', label: 'Sim' },
      { id: 'edge-5', source: 'condition-whatsapp', target: 'action-no', sourceHandle: 'no', label: 'Nao' },
    ],
  },
});

test('expandFlowGraphToFlows preserves prefix conditions and steps for every branch', () => {
  const expanded = expandFlowGraphToFlows(buildBaseFlow());

  assert.equal(expanded.length, 2);

  const yesFlow = expanded.find((flow) => flow.id === 'flow-branch');
  const noFlow = expanded.find((flow) => flow.id === 'flow-branch-nao');

  assert.ok(yesFlow);
  assert.ok(noFlow);
  if (!yesFlow || !noFlow) {
    return;
  }

  assert.deepEqual(
    yesFlow.steps.map((step) => step.id),
    ['step-intro', 'step-yes'],
  );
  assert.deepEqual(
    noFlow.steps.map((step) => step.id),
    ['step-intro', 'step-no'],
  );

  assert.deepEqual(
    (yesFlow.conditions ?? []).map((condition) => [condition.field, condition.operator, condition.value]),
    [
      ['status', 'equals', 'Novo'],
      ['whatsapp_valid', 'equals', 'true'],
    ],
  );
  assert.deepEqual(
    (noFlow.conditions ?? []).map((condition) => [condition.field, condition.operator, condition.value]),
    [
      ['status', 'equals', 'Novo'],
      ['whatsapp_valid', 'not_equals', 'true'],
    ],
  );
});
