import {
  composeTemplateMessage,
  getAutoContactStepDelayMs,
  getTemplateMessages,
  type AutoContactDelayUnit,
  type AutoContactFlow,
  type AutoContactFlowActionType,
  type AutoContactFlowCondition,
  type AutoContactFlowConditionOperator,
  type AutoContactFlowGraph,
  type AutoContactFlowGraphEdge,
  type AutoContactFlowGraphNode,
  type AutoContactFlowStep,
  type AutoContactTemplate,
} from './autoContactService';
import { expandFlowGraphToFlows } from './autoContactFlowGraph';

type FlowTextExportOptions = {
  flow: AutoContactFlow;
  graph: AutoContactFlowGraph;
  messageTemplates: AutoContactTemplate[];
  conditionFieldOptions: [string, string][];
  conditionOperatorLabels: Record<AutoContactFlowConditionOperator, string>;
  flowActionLabels: Record<AutoContactFlowActionType, string>;
  getConditionOptionLabel: (field: AutoContactFlowCondition['field'], value: string) => string;
  exportedAt?: Date;
};

type GraphPath = {
  id: string;
  nodeIds: string[];
  branchLabels: string[];
  cycleDetected: boolean;
};

type ConditionGroup = {
  nodeId: string;
  logic: 'all' | 'any';
  conditions: AutoContactFlowCondition[];
};

const LINE = '='.repeat(88);
const SECTION = '-'.repeat(88);
const MUTABLE_CONDITION_FIELDS = new Set([
  'origem',
  'cidade',
  'responsavel',
  'status',
  'canal',
  'estado',
  'regiao',
  'tipo_contratacao',
  'operadora_atual',
  'email',
  'telefone',
  'whatsapp_valid',
]);
const TERMINAL_ACTIONS = new Set<AutoContactFlowActionType>(['update_status', 'archive_lead', 'delete_lead']);

const normalizeLabel = (value: string | undefined): string => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'sim') return 'SIM';
  if (normalized === 'nao') return 'NAO';
  return normalized.toUpperCase();
};

const formatDelayUnit = (unit: AutoContactDelayUnit, value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (unit === 'seconds') return `${safeValue}s`;
  if (unit === 'minutes') return `${safeValue}min`;
  if (unit === 'days') return `${safeValue}d`;
  return `${safeValue}h`;
};

const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalSeconds = Math.round(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes ? `${minutes}m` : '',
    seconds && partsLength(days, hours, minutes) === 0 ? `${seconds}s` : '',
  ].filter(Boolean);
  return parts.join(' ');
};

const partsLength = (...values: number[]): number => values.filter((value) => value > 0).length;

const previewText = (value: string, maxLength = 160): string => {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  if (!singleLine) return '(vazio)';
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 3)}...`;
};

const getFieldLabel = (
  field: AutoContactFlowCondition['field'],
  conditionFieldOptions: [string, string][],
): string => conditionFieldOptions.find(([value]) => value === field)?.[1] ?? field;

const formatCondition = (
  condition: AutoContactFlowCondition,
  options: Pick<FlowTextExportOptions, 'conditionFieldOptions' | 'conditionOperatorLabels' | 'getConditionOptionLabel'>,
): string => {
  const fieldLabel = getFieldLabel(condition.field, options.conditionFieldOptions);
  const operatorLabel = options.conditionOperatorLabels[condition.operator] ?? condition.operator;
  const displayValue = options.getConditionOptionLabel(condition.field, condition.value) || condition.value;
  return `${fieldLabel} ${operatorLabel} "${displayValue || condition.value}"`;
};

const formatTrigger = (flow: AutoContactFlow, triggerNode?: AutoContactFlowGraphNode | null): string[] => {
  const triggerType = triggerNode?.data.triggerType ?? flow.triggerType ?? 'lead_created';
  const triggerStatuses = triggerNode?.data.triggerStatuses ?? flow.triggerStatuses ?? [];
  const triggerDurationHours = triggerNode?.data.triggerDurationHours ?? flow.triggerDurationHours ?? 24;
  const lines = [`Type: ${triggerType}`];

  if (triggerType === 'status_changed' || triggerType === 'status_duration') {
    lines.push(`Statuses: ${triggerStatuses.length ? triggerStatuses.join(', ') : '(any status)'}`);
  }

  if (triggerType === 'status_duration') {
    lines.push(`Duration in status: ${triggerDurationHours}h`);
  }

  if (flow.triggerStatus?.trim()) {
    lines.push(`Legacy trigger status: ${flow.triggerStatus.trim()}`);
  }

  return lines;
};

const describeStep = (
  step: AutoContactFlowStep,
  templates: AutoContactTemplate[],
  flowActionLabels: Record<AutoContactFlowActionType, string>,
): string[] => {
  const actionLabel = flowActionLabels[step.actionType] ?? step.actionType;
  const lines = [
    `Action: ${actionLabel}`,
    `Delay: ${formatDelayUnit(step.delayUnit, step.delayValue ?? 0)}${step.delayExpression?.trim() ? ` | expr=${step.delayExpression.trim()}` : ''}`,
  ];

  if (step.actionType === 'send_message') {
    if (step.messageSource === 'custom') {
      lines.push(`Source: custom`);
      lines.push(`Payload: ${step.customMessage?.type ?? 'text'} | ${previewText(step.customMessage?.text ?? step.customMessage?.caption ?? step.customMessage?.mediaUrl ?? '')}`);
    } else {
      const template = templates.find((item) => item.id === step.templateId) ?? null;
      const templatePreview = template ? composeTemplateMessage(getTemplateMessages(template)) : '';
      lines.push(`Source: template`);
      lines.push(`Template: ${template?.name ?? step.templateId ?? '(not selected)'}`);
      if (templatePreview) {
        lines.push(`Preview: ${previewText(templatePreview)}`);
      }
    }
  }

  if (step.actionType === 'update_status') {
    lines.push(`Target status: ${step.statusToSet?.trim() || '(not set)'}`);
  }

  if (step.actionType === 'create_task') {
    lines.push(`Task: ${step.taskTitle?.trim() || '(without title)'}`);
    if (step.taskDescription?.trim()) lines.push(`Description: ${previewText(step.taskDescription)}`);
    lines.push(`Priority: ${step.taskPriority ?? 'normal'}`);
    if (step.taskDueHours) lines.push(`Due in: ${step.taskDueHours}h`);
  }

  if (step.actionType === 'send_email') {
    lines.push(`To: ${step.emailTo?.trim() || '(not set)'}`);
    if (step.emailSubject?.trim()) lines.push(`Subject: ${previewText(step.emailSubject)}`);
    if (step.emailBody?.trim()) lines.push(`Body: ${previewText(step.emailBody)}`);
  }

  if (step.actionType === 'webhook') {
    lines.push(`Method: ${step.webhookMethod ?? 'POST'}`);
    lines.push(`URL: ${step.webhookUrl?.trim() || '(not set)'}`);
  }

  return lines;
};

const buildEdgeMaps = (graph: AutoContactFlowGraph) => {
  const outgoing = new Map<string, AutoContactFlowGraphEdge[]>();
  const incoming = new Map<string, AutoContactFlowGraphEdge[]>();

  graph.edges.forEach((edge) => {
    const sourceList = outgoing.get(edge.source) ?? [];
    sourceList.push(edge);
    outgoing.set(edge.source, sourceList);

    const targetList = incoming.get(edge.target) ?? [];
    targetList.push(edge);
    incoming.set(edge.target, targetList);
  });

  return { outgoing, incoming };
};

const sortEdges = (edges: AutoContactFlowGraphEdge[]): AutoContactFlowGraphEdge[] =>
  [...edges].sort((left, right) => {
    const leftRank = left.sourceHandle === 'yes' ? 0 : left.sourceHandle === 'no' ? 1 : 2;
    const rightRank = right.sourceHandle === 'yes' ? 0 : right.sourceHandle === 'no' ? 1 : 2;
    return leftRank - rightRank;
  });

const buildPaths = (graph: AutoContactFlowGraph): GraphPath[] => {
  const trigger = graph.nodes.find((node) => node.type === 'trigger');
  if (!trigger) return [];

  const { outgoing } = buildEdgeMaps(graph);
  const paths: GraphPath[] = [];

  const visit = (currentId: string, trail: string[], branchLabels: string[], visited: Set<string>, cycleDetected = false) => {
    const currentEdges = sortEdges(outgoing.get(currentId) ?? []);
    if (currentEdges.length === 0 || cycleDetected) {
      paths.push({
        id: `path-${paths.length + 1}`,
        nodeIds: trail,
        branchLabels,
        cycleDetected,
      });
      return;
    }

    currentEdges.forEach((edge) => {
      const nextTrail = [...trail, edge.target];
      const nextBranchLabels = edge.sourceHandle || edge.label ? [...branchLabels, normalizeLabel(edge.label ?? edge.sourceHandle)] : branchLabels;
      if (visited.has(edge.target)) {
        paths.push({
          id: `path-${paths.length + 1}`,
          nodeIds: nextTrail,
          branchLabels: nextBranchLabels,
          cycleDetected: true,
        });
        return;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(edge.target);
      visit(edge.target, nextTrail, nextBranchLabels, nextVisited);
    });
  };

  visit(trigger.id, [trigger.id], [], new Set([trigger.id]));
  return paths;
};

const getPathConditionGroups = (path: GraphPath, nodeById: Map<string, AutoContactFlowGraphNode>): ConditionGroup[] =>
  path.nodeIds.reduce<ConditionGroup[]>((groups, nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node || node.type !== 'condition') return groups;

    const conditions = Array.isArray(node.data.conditions) ? node.data.conditions : [];
    if (conditions.length === 0) return groups;

    groups.push({
      nodeId: node.id,
      logic: node.data.conditionLogic ?? 'all',
      conditions,
    });
    return groups;
  }, []);

const getPathSteps = (
  path: GraphPath,
  nodeById: Map<string, AutoContactFlowGraphNode>,
): Array<{ nodeId: string; step: AutoContactFlowStep }> =>
  path.nodeIds.reduce<Array<{ nodeId: string; step: AutoContactFlowStep }>>((steps, nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node || node.type !== 'action' || !node.data.step) return steps;

    steps.push({
      nodeId: node.id,
      step: node.data.step as AutoContactFlowStep,
    });
    return steps;
  }, []);

const formatPathName = (path: GraphPath, index: number): string => {
  if (path.branchLabels.length === 0) return `PATH ${index + 1} - PRINCIPAL`;
  return `PATH ${index + 1} - ${path.branchLabels.join(' > ')}`;
};

const collectReachableNodeIds = (graph: AutoContactFlowGraph): Set<string> => {
  const trigger = graph.nodes.find((node) => node.type === 'trigger');
  if (!trigger) return new Set();

  const { outgoing } = buildEdgeMaps(graph);
  const visited = new Set<string>();
  const stack = [trigger.id];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    const currentEdges = outgoing.get(currentId) ?? [];
    currentEdges.forEach((edge) => {
      if (!visited.has(edge.target)) stack.push(edge.target);
    });
  }

  return visited;
};

const describeInvalidNumberAction = (flow: AutoContactFlow): string => {
  const requested = flow.invalidNumberAction ?? 'none';
  if (requested === 'update_status') {
    return `update_status -> ${flow.invalidNumberStatus?.trim() || 'Perdido'}`;
  }
  if (requested === 'archive_lead') return 'archive_lead';
  if (requested === 'delete_lead') return 'delete_lead';
  return 'none (runtime fallback in backend currently moves to Perdido when send fails due to invalid number)';
};

const buildDiagnostics = (
  options: Omit<FlowTextExportOptions, 'exportedAt'>,
  graph: AutoContactFlowGraph,
  paths: GraphPath[],
  nodeById: Map<string, AutoContactFlowGraphNode>,
): string[] => {
  const diagnostics: string[] = [];
  const { incoming, outgoing } = buildEdgeMaps(graph);
  const reachableNodeIds = collectReachableNodeIds(graph);

  graph.nodes.forEach((node) => {
    const incomingEdges = incoming.get(node.id) ?? [];
    const outgoingEdges = outgoing.get(node.id) ?? [];

    if (node.type !== 'trigger' && incomingEdges.length === 0) {
      diagnostics.push(`Node ${node.id} (${node.data.label || node.type}) has no incoming connection.`);
    }

    if (!reachableNodeIds.has(node.id)) {
      diagnostics.push(`Node ${node.id} (${node.data.label || node.type}) is unreachable from the trigger.`);
    }

    if (node.type === 'condition') {
      const hasYes = outgoingEdges.some((edge) => edge.sourceHandle === 'yes' || normalizeLabel(edge.label) === 'SIM');
      const hasNo = outgoingEdges.some((edge) => edge.sourceHandle === 'no' || normalizeLabel(edge.label) === 'NAO');
      if (!hasYes) diagnostics.push(`Condition ${node.id} is missing the SIM branch connection.`);
      if (!hasNo) diagnostics.push(`Condition ${node.id} is missing the NAO branch connection.`);
    }

    if (node.type === 'action' && node.data.step?.actionType === 'send_message') {
      const step = node.data.step;
      if (step.messageSource === 'custom' && !step.customMessage?.text?.trim() && !step.customMessage?.mediaUrl?.trim()) {
        diagnostics.push(`Action ${node.id} has a custom message without text or media.`);
      }
      if (step.messageSource !== 'custom') {
        const template = options.messageTemplates.find((item) => item.id === step.templateId);
        if (!template) {
          diagnostics.push(`Action ${node.id} references a missing template (${step.templateId || 'empty'}).`);
        }
      }
    }
  });

  paths.forEach((path, index) => {
    const steps = getPathSteps(path, nodeById);
    const zeroDelayBurstCount = steps.filter(({ step }) => getAutoContactStepDelayMs(step) === 0).length;
    const terminalActionIndex = steps.findIndex(({ step }) => TERMINAL_ACTIONS.has(step.actionType));
    const conditionGroups = getPathConditionGroups(path, nodeById);
    const usesMutableEntryCondition = conditionGroups.some((group) =>
      group.conditions.some((condition) => MUTABLE_CONDITION_FIELDS.has(condition.field)),
    );

    if (path.cycleDetected) {
      diagnostics.push(`${formatPathName(path, index)} contains a cycle; export traversal stopped early.`);
    }

    if (zeroDelayBurstCount > 1) {
      diagnostics.push(`${formatPathName(path, index)} has ${zeroDelayBurstCount} zero-delay actions in sequence.`);
    }

    if (terminalActionIndex >= 0 && terminalActionIndex < steps.length - 1) {
      diagnostics.push(`${formatPathName(path, index)} has actions after a terminal state-changing action.`);
    }

    if (usesMutableEntryCondition && steps.length > 1) {
      diagnostics.push(
        `${formatPathName(path, index)} uses mutable entry conditions. Pending jobs are revalidated before each step.`,
      );
    }
  });

  if (paths.length === 0) {
    diagnostics.push('No executable path was found from the trigger.');
  }

  return Array.from(new Set(diagnostics));
};

export const buildAutoContactFlowTextExport = (options: FlowTextExportOptions): string => {
  const graph = options.graph;
  const exportedAt = options.exportedAt ?? new Date();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const triggerNode = graph.nodes.find((node) => node.type === 'trigger') ?? null;
  const paths = buildPaths(graph);
  const derivedFlows = options.flow.flowGraph ? expandFlowGraphToFlows(options.flow) : [options.flow];
  const diagnostics = buildDiagnostics(options, graph, paths, nodeById);
  const lines: string[] = [];

  lines.push(LINE);
  lines.push(`FLOW EXPORT - ${options.flow.name || 'Sem nome'}`);
  lines.push(LINE);
  lines.push(`Flow id: ${options.flow.id}`);
  lines.push(`Generated at: ${exportedAt.toISOString()}`);
  lines.push(`Graph: ${graph.nodes.length} nodes | ${graph.edges.length} edges`);
  lines.push(`Derived execution flows: ${derivedFlows.length}`);
  lines.push(`Invalid number handling: ${describeInvalidNumberAction(options.flow)}`);
  if (options.flow.tags?.length) {
    lines.push(`Tags: ${options.flow.tags.join(', ')}`);
  }

  if (options.flow.scheduling) {
    lines.push(
      `Flow scheduling override: ${options.flow.scheduling.startHour} -> ${options.flow.scheduling.endHour} | weekdays ${options.flow.scheduling.allowedWeekdays.join(', ') || '(global default)'}`,
    );
  }

  lines.push('');
  lines.push('TRIGGER');
  lines.push(SECTION);
  formatTrigger(options.flow, triggerNode).forEach((line) => lines.push(`- ${line}`));
  lines.push('- Runtime note: entry conditions are checked at enrollment and again before each queued job.');
  lines.push('- Runtime note: exit conditions stop the flow immediately when matched.');

  if ((options.flow.exitConditions ?? []).length > 0) {
    lines.push('');
    lines.push('EXIT CONDITIONS');
    lines.push(SECTION);
    lines.push(`Logic: ${options.flow.exitConditionLogic === 'all' ? 'ALL' : 'ANY'}`);
    options.flow.exitConditions?.forEach((condition, index) => {
      lines.push(`${index + 1}. ${formatCondition(condition, options)}`);
    });
  }

  lines.push('');
  lines.push('PATHS');
  lines.push(SECTION);
  if (paths.length === 0) {
    lines.push('No path available from the trigger.');
  }

  paths.forEach((path, pathIndex) => {
    const conditionGroups = getPathConditionGroups(path, nodeById);
    const steps = getPathSteps(path, nodeById);
    let cumulativeMs = 0;
    const terminalNode = nodeById.get(path.nodeIds[path.nodeIds.length - 1] ?? '') ?? null;

    lines.push(formatPathName(path, pathIndex));
    lines.push(`Nodes: ${path.nodeIds.join(' -> ')}`);

    if (conditionGroups.length > 0) {
      lines.push('Entry conditions:');
      conditionGroups.forEach((group) => {
        lines.push(`- ${group.nodeId} | logic ${group.logic === 'all' ? 'ALL' : 'ANY'}`);
        group.conditions.forEach((condition) => {
          lines.push(`  * ${formatCondition(condition, options)}`);
        });
      });
    } else {
      lines.push('Entry conditions: none');
    }

    if (steps.length > 0) {
      lines.push('Steps:');
      steps.forEach(({ nodeId, step }, stepIndex) => {
        const stepDelayMs = getAutoContactStepDelayMs(step);
        cumulativeMs += stepDelayMs;
        lines.push(
          `${stepIndex + 1}. ${nodeId} | after ${formatDelayUnit(step.delayUnit, step.delayValue ?? 0)} | cumulative ${formatDuration(cumulativeMs)}`,
        );
        describeStep(step, options.messageTemplates, options.flowActionLabels).forEach((detail) => {
          lines.push(`   - ${detail}`);
        });
      });
    } else {
      lines.push('Steps: none');
    }

    lines.push(`Terminal node: ${terminalNode?.id ?? '(unknown)'} | ${terminalNode?.data.label || terminalNode?.type || 'n/a'}`);
    lines.push('');
  });

  lines.push('DERIVED EXECUTION FLOWS');
  lines.push(SECTION);
  derivedFlows.forEach((flow, index) => {
    lines.push(`${index + 1}. ${flow.name || flow.id}`);
    lines.push(`   id: ${flow.id}`);
    lines.push(`   logic: ${(flow.conditionLogic ?? 'all').toUpperCase()}`);
    if ((flow.conditions ?? []).length === 0) {
      lines.push(`   conditions: none`);
    } else {
      flow.conditions?.forEach((condition) => {
        lines.push(`   - ${formatCondition(condition, options)}`);
      });
    }
    if ((flow.steps ?? []).length === 0) {
      lines.push(`   steps: none`);
    } else {
      flow.steps.forEach((step, stepIndex) => {
        lines.push(
          `   ${stepIndex + 1}. ${options.flowActionLabels[step.actionType] ?? step.actionType} | ${formatDelayUnit(step.delayUnit, step.delayValue ?? 0)}`,
        );
      });
    }
    lines.push('');
  });

  lines.push('DIAGNOSTICS');
  lines.push(SECTION);
  if (diagnostics.length === 0) {
    lines.push('No structural issue detected in the current graph.');
  } else {
    diagnostics.forEach((diagnostic, index) => {
      lines.push(`${index + 1}. ${diagnostic}`);
    });
  }

  lines.push('');
  lines.push('RAW GRAPH INVENTORY');
  lines.push(SECTION);
  graph.nodes.forEach((node) => {
    lines.push(`${node.id} | ${node.type} | ${node.data.label || '(no label)'}`);
  });
  graph.edges.forEach((edge) => {
    lines.push(
      `${edge.id} | ${edge.source}${edge.sourceHandle ? `:${edge.sourceHandle}` : ''} -> ${edge.target}${edge.label ? ` | ${edge.label}` : ''}`,
    );
  });

  lines.push('');
  return lines.join('\n');
};
