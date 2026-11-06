import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { AutoContactFlow, AutoContactFlowStep } from '../../../../lib/autoContactService';
import { buildFlowGraphFromFlow, expandFlowGraphToFlows } from '../../../../lib/autoContactFlowGraph';
import { applyFlowGraphEdits } from './flowGraphEdits';

test('mantém a variação editada no desenho ao expandir, salvar e reabrir o fluxo', () => {
  const step: AutoContactFlowStep = {
    id: 'step', actionType: 'send_message', delayValue: 0, delayUnit: 'minutes',
    messages: [{ custom: { type: 'text', text: 'Original' } }],
  };
  const flow: AutoContactFlow = {
    id: 'flow', name: 'Abordagem', triggerType: 'lead_created', triggerStatus: '',
    triggerStatuses: [], triggerDurationHours: 0, steps: [step],
  };
  const graph = buildFlowGraphFromFlow(flow);
  const editedStep: AutoContactFlowStep = { ...step, messageVariations: [{
    id: 'v2', messages: [{ custom: { type: 'text', text: 'Alternativa' } }],
  }] };
  const editedGraph = { ...graph, nodes: graph.nodes.map((node) => node.type === 'action'
    ? { ...node, data: { ...node.data, step: editedStep } } : node) };
  const updated = applyFlowGraphEdits(flow, editedGraph);
  const [saved] = expandFlowGraphToFlows(updated);
  const reopened = buildFlowGraphFromFlow(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(updated.steps[0].messageVariations, editedStep.messageVariations);
  assert.deepEqual(saved.steps[0].messageVariations, editedStep.messageVariations);
  assert.deepEqual(reopened.nodes.find((node) => node.type === 'action')?.data.step?.messageVariations, editedStep.messageVariations);
  assert.equal(flow.steps[0].messageVariations, undefined);
});
