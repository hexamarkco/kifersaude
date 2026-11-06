import type { AutoContactFlow, AutoContactFlowGraph } from '../../../../lib/autoContactService';

// Persisted linear steps take precedence when reopening a graph. An explicit edit
// must therefore update both representations before save expands its branches.
export function applyFlowGraphEdits(flow: AutoContactFlow, flowGraph: AutoContactFlowGraph): AutoContactFlow {
  const editedSteps = new Map(flowGraph.nodes.flatMap((node) =>
    node.type === 'action' && node.data.step ? [[node.data.step.id, node.data.step] as const] : []));
  return {
    ...flow,
    flowGraph,
    steps: flow.steps.map((step) => editedSteps.get(step.id) ?? step),
  };
}
