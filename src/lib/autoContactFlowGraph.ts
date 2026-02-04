import type {
  AutoContactFlow,
  AutoContactFlowCondition,
  AutoContactFlowGraph,
  AutoContactFlowGraphEdge,
  AutoContactFlowGraphNode,
  AutoContactFlowStep,
} from './autoContactService';

const ACTION_NODE_WIDTH = 240;
const ACTION_NODE_GAP = 140;

const createNodeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const buildFlowGraphFromFlow = (flow: AutoContactFlow): AutoContactFlowGraph => {
  if (flow.flowGraph?.nodes?.length) return flow.flowGraph;

  const nodes: AutoContactFlowGraphNode[] = [];
  const edges: AutoContactFlowGraphEdge[] = [];

  const triggerId = createNodeId('trigger');
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: { label: 'Lead criado' },
  });

  let lastNodeId = triggerId;
  if ((flow.conditions ?? []).length > 0) {
    const conditionId = createNodeId('condition');
    nodes.push({
      id: conditionId,
      type: 'condition',
      position: { x: ACTION_NODE_WIDTH + 40, y: 0 },
      data: {
        label: 'Condição',
        conditions: flow.conditions,
        conditionLogic: flow.conditionLogic ?? 'all',
      },
    });
    edges.push({
      id: createNodeId('edge'),
      source: lastNodeId,
      target: conditionId,
    });
    lastNodeId = conditionId;
  }

  flow.steps.forEach((step, index) => {
    const actionId = createNodeId('action');
    nodes.push({
      id: actionId,
      type: 'action',
      position: { x: (index + 1) * ACTION_NODE_WIDTH + (index + 1) * 40, y: index * ACTION_NODE_GAP },
      data: {
        label: step.actionType === 'update_status' ? 'Atualizar status' : 'Enviar mensagem',
        step,
      },
    });
    edges.push({
      id: createNodeId('edge'),
      source: lastNodeId,
      target: actionId,
    });
    lastNodeId = actionId;
  });

  return { nodes, edges };
};

const getNodeById = (nodes: AutoContactFlowGraphNode[], id: string) => nodes.find((node) => node.id === id) ?? null;

const getOrderedActionNodes = (graph: AutoContactFlowGraph): AutoContactFlowGraphNode[] => {
  const trigger = graph.nodes.find((node) => node.type === 'trigger');
  if (!trigger) return [];

  const edgesBySource = new Map<string, AutoContactFlowGraphEdge[]>();
  graph.edges.forEach((edge) => {
    const list = edgesBySource.get(edge.source) ?? [];
    list.push(edge);
    edgesBySource.set(edge.source, list);
  });

  const visited = new Set<string>();
  const ordered: AutoContactFlowGraphNode[] = [];
  let currentId: string | null = trigger.id;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const edges = edgesBySource.get(currentId) ?? [];
    const nextEdge = edges[0];
    if (!nextEdge) break;
    const nextNode = getNodeById(graph.nodes, nextEdge.target);
    if (!nextNode) break;
    if (nextNode.type === 'action') {
      ordered.push(nextNode);
    }
    currentId = nextNode.id;
  }

  return ordered;
};

const getConditionNode = (graph: AutoContactFlowGraph): AutoContactFlowGraphNode | null =>
  graph.nodes.find((node) => node.type === 'condition') ?? null;

export const applyFlowGraphToFlow = (flow: AutoContactFlow, graph: AutoContactFlowGraph): AutoContactFlow => {
  const actionNodes = getOrderedActionNodes(graph);
  const steps: AutoContactFlowStep[] = actionNodes
    .map((node, index) => {
      const step = node.data.step;
      if (!step) return null;
      return {
        ...step,
        id: step.id?.trim() ? step.id : `${flow.id}-step-${index}`,
      };
    })
    .filter(Boolean) as AutoContactFlowStep[];

  const conditionNode = getConditionNode(graph);
  const conditions = Array.isArray(conditionNode?.data.conditions)
    ? (conditionNode?.data.conditions as AutoContactFlowCondition[])
    : flow.conditions ?? [];
  const conditionLogic = conditionNode?.data.conditionLogic ?? flow.conditionLogic ?? 'all';

  return {
    ...flow,
    steps: steps.length ? steps : flow.steps,
    conditions,
    conditionLogic,
    flowGraph: graph,
  };
};
