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
  let conditionNodeId: string | null = null;

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
    conditionNodeId = conditionId;
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
        label:
          step.actionType === 'update_status'
            ? 'Atualizar status'
            : step.actionType === 'create_task'
              ? 'Criar tarefa'
              : step.actionType === 'send_email'
                ? 'Enviar e-mail'
                : step.actionType === 'webhook'
                  ? 'Disparar webhook'
                  : 'Enviar mensagem',
        step,
      },
    });
    edges.push({
      id: createNodeId('edge'),
      source: lastNodeId,
      target: actionId,
      label: lastNodeId === conditionNodeId ? 'Sim' : undefined,
      sourceHandle: lastNodeId === conditionNodeId ? 'yes' : undefined,
    });
    lastNodeId = actionId;
  });

  return { nodes, edges };
};

const getNodeById = (nodes: AutoContactFlowGraphNode[], id: string) => nodes.find((node) => node.id === id) ?? null;

const getBranchConditionNode = (graph: AutoContactFlowGraph): AutoContactFlowGraphNode | null => {
  const conditionNodes = graph.nodes.filter((node) => node.type === 'condition');
  if (conditionNodes.length === 0) return null;
  for (const node of conditionNodes) {
    const edges = getOutgoingEdges(graph, node.id);
    const hasBranch = edges.length > 1 || edges.some((edge) => ['sim', 'nao'].includes((edge.label ?? '').toLowerCase()));
    if (hasBranch) return node;
  }
  return conditionNodes[0];
};

const getEdgesBySource = (graph: AutoContactFlowGraph): Map<string, AutoContactFlowGraphEdge[]> => {
  const map = new Map<string, AutoContactFlowGraphEdge[]>();
  graph.edges.forEach((edge) => {
    const list = map.get(edge.source) ?? [];
    list.push(edge);
    map.set(edge.source, list);
  });
  return map;
};

const mergeConditionLogic = (
  current: AutoContactFlow['conditionLogic'],
  next: AutoContactFlow['conditionLogic'],
): AutoContactFlow['conditionLogic'] => {
  if (!current) return next ?? 'all';
  if (!next) return current;
  if (current === next) return current;
  return 'all';
};

const collectLinearPath = (
  graph: AutoContactFlowGraph,
): { steps: AutoContactFlowStep[]; conditions: AutoContactFlowCondition[]; conditionLogic: AutoContactFlow['conditionLogic'] } => {
  const trigger = graph.nodes.find((node) => node.type === 'trigger');
  if (!trigger) return { steps: [], conditions: [], conditionLogic: 'all' as AutoContactFlow['conditionLogic'] };

  const edgesBySource = getEdgesBySource(graph);
  const visited = new Set<string>();
  const conditions: AutoContactFlowCondition[] = [];
  let conditionLogic: AutoContactFlow['conditionLogic'] = 'all';
  const steps: AutoContactFlowStep[] = [];
  let currentId: string | null = trigger.id;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const edges = edgesBySource.get(currentId) ?? [];
    const nextEdge = edges[0];
    if (!nextEdge) break;
    const nextNode = getNodeById(graph.nodes, nextEdge.target);
    if (!nextNode) break;
    if (nextNode.type === 'condition') {
      const nodeConditions = Array.isArray(nextNode.data.conditions)
        ? (nextNode.data.conditions as AutoContactFlowCondition[])
        : [];
      conditions.push(...nodeConditions);
      conditionLogic = mergeConditionLogic(conditionLogic, nextNode.data.conditionLogic ?? 'all');
    }
    if (nextNode.type === 'action' && nextNode.data.step) {
      steps.push(nextNode.data.step);
    }
    currentId = nextNode.id;
  }

  return { steps, conditions, conditionLogic };
};

export const applyFlowGraphToFlow = (flow: AutoContactFlow, graph: AutoContactFlowGraph): AutoContactFlow => {
  const collected = collectLinearPath(graph);
  const steps = collected.steps.map((step, index) => ({
    ...step,
    id: step.id?.trim() ? step.id : `${flow.id}-step-${index}`,
  }));
  const conditions = collected.conditions.length ? collected.conditions : flow.conditions ?? [];
  const conditionLogic = collected.conditions.length
    ? collected.conditionLogic
    : flow.conditionLogic ?? 'all';

  return {
    ...flow,
    steps: steps.length ? steps : flow.steps,
    conditions,
    conditionLogic,
    flowGraph: graph,
  };
};

const invertOperator = (operator: AutoContactFlowCondition['operator']): AutoContactFlowCondition['operator'] => {
  switch (operator) {
    case 'equals':
      return 'not_equals';
    case 'not_equals':
      return 'equals';
    case 'contains':
      return 'not_contains';
    case 'not_contains':
      return 'contains';
    case 'starts_with':
      return 'not_contains';
    case 'ends_with':
      return 'not_contains';
    case 'in_list':
      return 'not_in_list';
    case 'not_in_list':
      return 'in_list';
    case 'greater_than':
      return 'less_or_equal';
    case 'greater_or_equal':
      return 'less_than';
    case 'less_than':
      return 'greater_or_equal';
    case 'less_or_equal':
      return 'greater_than';
    default:
      return 'not_equals';
  }
};

const invertConditions = (conditions: AutoContactFlowCondition[]): AutoContactFlowCondition[] =>
  conditions.map((condition) => ({
    ...condition,
    operator: invertOperator(condition.operator),
  }));

const getOutgoingEdges = (graph: AutoContactFlowGraph, sourceId: string): AutoContactFlowGraphEdge[] =>
  graph.edges.filter((edge) => edge.source === sourceId);

const collectPathFromEdge = (
  graph: AutoContactFlowGraph,
  edge: AutoContactFlowGraphEdge,
  options?: { invertFirstCondition?: boolean },
): { steps: AutoContactFlowStep[]; conditions: AutoContactFlowCondition[]; conditionLogic: AutoContactFlow['conditionLogic'] } => {
  const visited = new Set<string>();
  let currentId: string | null = edge.target;
  const steps: AutoContactFlowStep[] = [];
  const conditions: AutoContactFlowCondition[] = [];
  let conditionLogic: AutoContactFlow['conditionLogic'] = 'all';
  let invertedApplied = false;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const node = getNodeById(graph.nodes, currentId);
    if (!node) break;
    if (node.type === 'condition') {
      const nodeConditions = Array.isArray(node.data.conditions)
        ? (node.data.conditions as AutoContactFlowCondition[])
        : [];
      if (options?.invertFirstCondition && !invertedApplied) {
        conditions.push(...invertConditions(nodeConditions));
        invertedApplied = true;
        conditionLogic = mergeConditionLogic(conditionLogic, node.data.conditionLogic ?? 'all');
      } else {
        conditions.push(...nodeConditions);
        conditionLogic = mergeConditionLogic(conditionLogic, node.data.conditionLogic ?? 'all');
      }
    }
    if (node.type === 'action' && node.data.step) {
      steps.push(node.data.step);
    }
    const nextEdge = getOutgoingEdges(graph, node.id)[0];
    currentId = nextEdge ? nextEdge.target : null;
  }

  return { steps, conditions, conditionLogic };
};

export const expandFlowGraphToFlows = (flow: AutoContactFlow): AutoContactFlow[] => {
  if (!flow.flowGraph) return [flow];

  const graph = flow.flowGraph;
  const conditionNode = getBranchConditionNode(graph);

  if (!conditionNode) {
    return [applyFlowGraphToFlow(flow, graph)];
  }

  const edges = getOutgoingEdges(graph, conditionNode.id);
  const yesEdge = edges.find((edge) => (edge.label ?? '').toLowerCase() === 'sim') ?? edges[0];
  const noEdge = edges.find((edge) => (edge.label ?? '').toLowerCase() === 'nao') ?? null;

  const yesPath = yesEdge ? collectPathFromEdge(graph, yesEdge) : { steps: [], conditions: [], conditionLogic: 'all' };
  const yesSteps = yesPath.steps.map((step, index) => ({
    ...step,
    id: step.id?.trim() ? step.id : `${flow.id}-step-${index}`,
  }));
  const yesConditions = yesPath.conditions.length
    ? yesPath.conditions
    : Array.isArray(conditionNode.data.conditions)
      ? (conditionNode.data.conditions as AutoContactFlowCondition[])
      : flow.conditions ?? [];
  const yesConditionLogic = (yesPath.conditions.length
    ? yesPath.conditionLogic
    : conditionNode.data.conditionLogic === 'any'
      ? 'any'
      : flow.conditionLogic ?? 'all') as AutoContactFlow['conditionLogic'];
  const yesFlow: AutoContactFlow = {
    ...flow,
    steps: yesSteps.length ? yesSteps : flow.steps,
    conditions: yesConditions,
    conditionLogic: yesConditionLogic,
    flowGraph: graph,
  };

  if (!noEdge || yesConditions.length === 0) {
    return [yesFlow];
  }

  const noPath = collectPathFromEdge(graph, noEdge, { invertFirstCondition: true });
  const noSteps = noPath.steps.map((step, index) => ({
    ...step,
    id: step.id?.trim() ? step.id : `${flow.id}-nao-step-${index}`,
  }));
  const noConditions = noPath.conditions.length ? noPath.conditions : invertConditions(yesConditions);
  const noConditionLogic: AutoContactFlow['conditionLogic'] =
    noPath.conditions.length > 1 ? 'all' : (yesConditionLogic === 'all' ? 'any' : 'all');
  const noFlow: AutoContactFlow = {
    ...flow,
    id: `${flow.id}-nao`,
    name: flow.name ? `${flow.name} (Nao)` : 'Fluxo (Nao)',
    steps: noSteps.length ? noSteps : flow.steps,
    conditions: noConditions,
    conditionLogic: noConditionLogic,
    flowGraph: graph,
  };

  return [yesFlow, noFlow];
};
