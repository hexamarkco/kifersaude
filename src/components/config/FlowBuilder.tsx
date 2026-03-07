import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  type Connection,
  type Edge,
  type Node,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { RefreshCcw, Download } from 'lucide-react';
import { toPng } from 'html-to-image';

import {
  type AutoContactDelayUnit,
  type AutoContactFlow,
  type AutoContactFlowActionType,
  type AutoContactFlowCondition,
  type AutoContactFlowConditionOperator,
  type AutoContactFlowGraph,
  type AutoContactFlowGraphNode,
  type AutoContactFlowGraphNodeData,
  type AutoContactFlowMessageSource,
  type AutoContactFlowStep,
  type AutoContactTemplate,
} from '../../lib/autoContactService';
import { type LeadStatusConfig } from '../../lib/supabase';
import { buildFlowGraphFromFlow } from '../../lib/autoContactFlowGraph';
import MultiSelectDropdown from './MultiSelectDropdown';
import FilterSingleSelect from '../FilterSingleSelect';

type FlowBuilderProps = {
  flow: AutoContactFlow;
  messageTemplates: AutoContactTemplate[];
  conditionFieldOptions: [string, string][];
  conditionOperatorLabels: Record<AutoContactFlowConditionOperator, string>;
  getConditionOptionLabel: (field: AutoContactFlowCondition['field'], value: string) => string;
  delayUnitLabels: Record<AutoContactDelayUnit, { singular: string; plural: string }>;
  flowActionLabels: Record<AutoContactFlowActionType, string>;
  getConditionValueOptions: (field: AutoContactFlowCondition['field']) => string[] | null;
  leadStatuses: LeadStatusConfig[];
  onChangeGraph: (graph: AutoContactFlowGraph) => void;
  onTriggerChange?: (triggerType: 'lead_created' | 'status_changed' | 'status_duration', triggerStatuses: string[], triggerDurationHours: number) => void;
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildPreviewContext = () => {
  const lead = {
    nome_completo: 'Lead Exemplo',
    telefone: '11999999999',
    email: 'lead@exemplo.com',
    status: 'Novo',
    origem: 'Manual',
    cidade: 'São Paulo',
    responsavel: 'Luiza',
  };
  const firstName = lead.nome_completo.split(/\s+/)[0];
  return {
    lead,
    now: new Date(),
    nome: lead.nome_completo,
    primeiro_nome: firstName,
    telefone: lead.telefone,
    email: lead.email,
    status: lead.status,
    origem: lead.origem,
    cidade: lead.cidade,
    responsavel: lead.responsavel,
  };
};

const formulaUtils = {
  if: (condition: boolean, truthy: unknown, falsy: unknown) => (condition ? truthy : falsy),
  concat: (...args: unknown[]) => args.map((item) => String(item ?? '')).join(''),
  lower: (value: unknown) => String(value ?? '').toLowerCase(),
  upper: (value: unknown) => String(value ?? '').toUpperCase(),
  len: (value: unknown) => String(value ?? '').length,
  number: (value: unknown) => Number(value),
  now: () => new Date(),
  dateAdd: (date: unknown, amount: number, unit: 'minutes' | 'hours' | 'days') => {
    const base = date instanceof Date ? date : new Date(String(date));
    const delta = unit === 'days' ? 86400000 : unit === 'hours' ? 3600000 : 60000;
    return new Date(base.getTime() + amount * delta);
  },
  formatDate: (date: unknown) => {
    const parsed = date instanceof Date ? date : new Date(String(date));
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('pt-BR');
  },
};

const evaluateExpression = (expression: string, context: Record<string, unknown>): unknown => {
  const trimmed = expression.trim().replace(/^=+\s*/, '');
  if (!trimmed) return null;
  try {
    const fn = new Function('ctx', 'utils', `with(ctx){with(utils){return (${trimmed});}}`);
    return fn(context, formulaUtils);
  } catch {
    return null;
  }
};

const applyFormulaTokens = (value: string, context: Record<string, unknown>): string =>
  value.replace(/{{=\s*([^}]+)\s*}}/g, (_match, expr) => {
    const result = evaluateExpression(expr, context);
    return result == null ? '' : String(result);
  });

const applyPreviewVariables = (template: string, context: ReturnType<typeof buildPreviewContext>) => {
  const firstName = context.primeiro_nome || '';
  return applyFormulaTokens(
    template
      .replace(/{{\s*nome\s*}}/gi, context.nome)
      .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
      .replace(/{{\s*saudacao\s*}}/gi, 'bom dia')
      .replace(/{{\s*saudacao_(?:capitalizada|titulo)\s*}}/gi, 'Bom dia')
      .replace(/{{\s*origem\s*}}/gi, context.origem)
      .replace(/{{\s*cidade\s*}}/gi, context.cidade)
      .replace(/{{\s*responsavel\s*}}/gi, context.responsavel),
    context,
  );
};

const createDefaultStep = (templateId?: string): AutoContactFlowStep => ({
  id: createId('step'),
  delayValue: 0,
  delayUnit: 'hours',
  actionType: 'send_message',
  messageSource: 'template',
  templateId: templateId ?? '',
  customMessage: { type: 'text', text: '' },
});

const toReactFlowNode = (node: AutoContactFlowGraphNode): Node<AutoContactFlowGraphNodeData> => ({
  id: node.id,
  type: node.type,
  position: node.position,
  data: node.data,
});

const toReactFlowEdge = (edge: AutoContactFlowGraph['edges'][number]): Edge => {
  const label = typeof edge.label === 'string' ? edge.label : undefined;
  const normalizedLabel = label?.toLowerCase();
  const sourceHandle = edge.sourceHandle
    ?? (normalizedLabel === 'sim' ? 'yes' : normalizedLabel === 'nao' ? 'no' : undefined);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label,
    sourceHandle,
    targetHandle: edge.targetHandle,
  };
};

const toGraphNode = (node: Node<AutoContactFlowGraphNodeData>): AutoContactFlowGraphNode => ({
  id: node.id,
  type: node.type as AutoContactFlowGraphNode['type'],
  position: node.position,
  data: node.data,
});

const TriggerNode = ({ data }: { data: AutoContactFlowGraphNodeData }) => {
  const getTriggerDescription = () => {
    switch (data.triggerType) {
      case 'status_changed':
        return data.triggerStatuses?.length 
          ? `Dispara ao mudar para: ${data.triggerStatuses.join(', ')}`
          : 'Dispara ao mudar de status';
      case 'status_duration':
        return data.triggerStatuses?.length
          ? `Dispara após ${data.triggerDurationHours ?? 24}h em: ${data.triggerStatuses.join(', ')}`
          : `Dispara após ${data.triggerDurationHours ?? 24}h em status específico`;
      default:
        return 'Dispara quando um lead é criado';
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-400">Gatilho</div>
      <div className="text-sm font-semibold text-slate-800">{data.label || 'Lead criado'}</div>
      <div className="text-xs text-slate-500 mt-1">{getTriggerDescription()}</div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-400" />
    </div>
  );
};

const BOOLEAN_FIELDS = ['whatsapp_valid', 'event', 'lead_created'];

const ConditionNode = ({ data }: { data: AutoContactFlowGraphNodeData }) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
    <div className="text-xs font-semibold uppercase text-amber-600">Condição</div>
    <div className="text-sm font-semibold text-amber-900">{data.label || 'Condições'}</div>
    <div className="text-xs text-amber-700 mt-1">
      {data.conditions?.length ? `${data.conditions.length} condição(ões)` : 'Sem condições'}
    </div>
    <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-700">
      <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5">Sim</span>
      <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5">Nao</span>
    </div>
    <Handle type="target" position={Position.Left} className="w-2 h-2 bg-amber-500" />
    <Handle
      id="yes"
      type="source"
      position={Position.Right}
      className="w-2 h-2 bg-amber-500"
      style={{ top: '35%' }}
    />
    <Handle
      id="no"
      type="source"
      position={Position.Right}
      className="w-2 h-2 bg-amber-500"
      style={{ top: '70%' }}
    />
  </div>
);

const ActionNode = ({ data }: { data: AutoContactFlowGraphNodeData }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="text-xs font-semibold uppercase text-slate-400">Ação</div>
    <div className="text-sm font-semibold text-slate-800">{data.label || 'Ação'}</div>
    {data.step && (
      <div className="text-xs text-slate-500 mt-1">
        Esperar {data.step.delayValue} {data.step.delayUnit}
      </div>
    )}
    <Handle type="target" position={Position.Left} className="w-2 h-2 bg-slate-400" />
    <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-400" />
  </div>
);

const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};

export default function FlowBuilder({
  flow,
  messageTemplates,
  conditionFieldOptions,
  conditionOperatorLabels,
  getConditionOptionLabel,
  delayUnitLabels,
  flowActionLabels,
  getConditionValueOptions,
  leadStatuses,
  onChangeGraph,
  onTriggerChange,
}: FlowBuilderProps) {
  const baseGraph = useMemo(() => buildFlowGraphFromFlow(flow), [flow]);
  const [nodes, setNodes, onNodesChange] = useNodesState(baseGraph.nodes.map(toReactFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseGraph.edges.map(toReactFlowEdge));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [initializedFlowId, setInitializedFlowId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = reactFlowWrapperRef.current?.closest('.painel-theme');
    if (!root) return;

    const syncTheme = () => {
      setIsDarkTheme(root.classList.contains('theme-dark'));
    };

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  const flowThemeColors = useMemo(
    () => ({
      exportBackground: isDarkTheme ? '#0f172a' : '#f8fafc',
      minimapNode: isDarkTheme ? '#334155' : '#e2e8f0',
      minimapMask: isDarkTheme ? 'rgba(15, 23, 42, 0.6)' : 'rgba(15, 23, 42, 0.1)',
      backgroundGrid: isDarkTheme ? '#334155' : '#e2e8f0',
    }),
    [isDarkTheme],
  );

  useEffect(() => {
    if (initializedFlowId !== flow.id) {
      setNodes(baseGraph.nodes.map(toReactFlowNode));
      setEdges(baseGraph.edges.map(toReactFlowEdge));
      setInitializedFlowId(flow.id);
    }
  }, [baseGraph, flow.id, initializedFlowId, setNodes, setEdges]);

  useEffect(() => {
    const graph: AutoContactFlowGraph = {
      nodes: nodes.map(toGraphNode),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: typeof edge.label === 'string' ? edge.label : undefined,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
      })),
    };
    onChangeGraph(graph);
  }, [nodes, edges, onChangeGraph]);

  const handleConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const label =
          connection.sourceHandle === 'no'
            ? 'Nao'
            : connection.sourceHandle === 'yes'
              ? 'Sim'
              : undefined;
        return addEdge({ ...connection, animated: false, label }, eds);
      }),
    [setEdges],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setEdges((current) => current.filter((item) => item.id !== edge.id));
    },
    [setEdges],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId((current) => (current === nodeId ? null : current));
      setContextMenu(null);
    },
    [setEdges, setNodes],
  );

  const exportFlowAsImage = useCallback(async () => {
    if (isExporting) return;
    const viewport = reactFlowWrapperRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewport) return;
    setIsExporting(true);
    try {
      const imageWidth = 1600;
      const imageHeight = 900;
      const bounds = getNodesBounds(nodes);
      const transform = getViewportForBounds(bounds, imageWidth, imageHeight, 0.1, 2);

      const dataUrl = await toPng(viewport, {
        backgroundColor: flowThemeColors.exportBackground,
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        },
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'fluxo-whatsapp.png';
      link.click();
    } finally {
      setIsExporting(false);
    }
  }, [flowThemeColors.exportBackground, isExporting, nodes]);

  const exportFlowAsTxt = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const triggerNode = nodes.find((n) => n.type === 'trigger');
      const conditionNodes = nodes.filter((n) => n.type === 'condition');
      const actionNodes = nodes.filter((n) => n.type === 'action');

      const getNodeLabel = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        return node?.data.label || node?.type || nodeId;
      };

      const getOutgoingEdges = (nodeId: string) => {
        return edges.filter((e) => e.source === nodeId);
      };

      const formatDelay = (step: AutoContactFlowStep | undefined) => {
        if (!step?.delayValue) return '';
        const unit = step.delayUnit === 'minutes' ? 'minuto(s)' : step.delayUnit === 'hours' ? 'hora(s)' : 'dia(s)';
        return `Aguardar ${step.delayValue} ${unit}`;
      };

      let txt = '';
      txt += '═══════════════════════════════════════════════════════════════════════════════\n';
      txt += `FLUXO DE AUTOMACAO - ${flow.name || 'Sem nome'}\n`;
      txt += '═══════════════════════════════════════════════════════════════════════════════\n\n';

      if (triggerNode) {
        txt += '┌──────────────────────────────────────────────────────────────────────────────┐\n';
        txt += '│ GATILHO (INICIO)                                                             │\n';
        txt += '└──────────────────────────────────────────────────────────────────────────────┘\n';
        const data = triggerNode.data;
        txt += `  ID: ${triggerNode.id}\n`;
        txt += `  Nome: ${data.label || 'Gatilho'}\n`;
        
        const triggerType = data.triggerType || 'lead_created';
        if (triggerType === 'lead_created') {
          txt += `  Tipo: Dispara quando um lead é criado\n`;
        } else if (triggerType === 'status_changed') {
          txt += `  Tipo: Dispara ao mudar de status\n`;
          txt += `  Status: ${data.triggerStatuses?.join(', ') || 'Não definido'}\n`;
        } else if (triggerType === 'status_duration') {
          txt += `  Tipo: Dispara após ${data.triggerDurationHours || 24}h no status\n`;
          txt += `  Status: ${data.triggerStatuses?.join(', ') || 'Não definido'}\n`;
        }
        txt += '\n';
      }

      let stepNumber = 1;
      const processNode = (nodeId: string, visited: Set<string>): string => {
        if (visited.has(nodeId)) return '';
        visited.add(nodeId);

        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return '';

        let result = '';
        const outEdges = getOutgoingEdges(nodeId);

        if (node.type === 'condition') {
          txt += '┌──────────────────────────────────────────────────────────────────────────────┐\n';
          txt += `│ CONDICAO #${stepNumber++}                                                              │\n`;
          txt += '└──────────────────────────────────────────────────────────────────────────────┘\n';
          txt += `  ID: ${node.id}\n`;
          txt += `  Nome: ${node.data.label || 'Condição'}\n`;
          txt += `  Logica: ${node.data.conditionLogic === 'all' ? 'TODAS as condições' : 'QUALQUER condição'}\n`;
          
          if (node.data.conditions && node.data.conditions.length > 0) {
            txt += `  Condicoes (${node.data.conditions.length}):\n`;
            node.data.conditions.forEach((cond: AutoContactFlowCondition, idx: number) => {
              const fieldLabel = conditionFieldOptions.find(([v]) => v === cond.field)?.[1] || cond.field;
              const operatorLabel = conditionOperatorLabels[cond.operator] || cond.operator;
              txt += `    ${idx + 1}. ${fieldLabel} ${operatorLabel} "${cond.value}"\n`;
            });
          } else {
            txt += `  Condicoes: Nenhuma condição definida\n`;
          }

          const yesEdge = outEdges.find((e) => String(e.label ?? '').toLowerCase() === 'sim' || e.sourceHandle === 'yes');
          const noEdge = outEdges.find((e) => String(e.label ?? '').toLowerCase() === 'nao' || e.sourceHandle === 'no');

          txt += `  Conexoes:\n`;
          txt += `    → SIM: ${yesEdge ? getNodeLabel(yesEdge.target) : 'Não conectado'}\n`;
          txt += `    → NAO: ${noEdge ? getNodeLabel(noEdge.target) : 'Não conectado'}\n`;
          txt += '\n';

          if (yesEdge) result += processNode(yesEdge.target, visited);
          if (noEdge) result += processNode(noEdge.target, visited);

        } else if (node.type === 'action') {
          const step = node.data.step;
          txt += '┌──────────────────────────────────────────────────────────────────────────────┐\n';
          txt += `│ ACAO #${stepNumber++}                                                                       │\n`;
          txt += '└──────────────────────────────────────────────────────────────────────────────┘\n';
          txt += `  ID: ${node.id}\n`;
          txt += `  Nome: ${node.data.label || 'Ação'}\n`;
          
          if (step) {
            const delayInfo = formatDelay(step);
            if (delayInfo) {
              txt += `  ${delayInfo}\n`;
            }

            const actionType = step.actionType || 'send_message';
            const actionLabel = flowActionLabels[actionType] || actionType;
            txt += `  Tipo: ${actionLabel}\n`;

            if (actionType === 'send_message') {
              const msgSource = step.messageSource === 'template' ? 'Template' : 'Mensagem customizada';
              txt += `  Origem da mensagem: ${msgSource}\n`;
              
              if (step.messageSource === 'template' && step.templateId) {
                const template = messageTemplates.find((t) => t.id === step.templateId);
                txt += `  Template: ${template?.name || step.templateId}\n`;
              } else if (step.messageSource === 'custom' && step.customMessage?.text) {
                txt += `  Mensagem: "${step.customMessage.text.substring(0, 100)}${step.customMessage.text.length > 100 ? '...' : ''}"\n`;
              }
            } else if (actionType === 'update_status') {
              txt += `  Novo status: ${step.statusToSet || 'Não definido'}\n`;
            } else if (actionType === 'create_task') {
              txt += `  Titulo: ${step.taskTitle || 'Não definido'}\n`;
              txt += `  Descricao: ${step.taskDescription || 'Não definida'}\n`;
              txt += `  Prioridade: ${step.taskPriority || 'normal'}\n`;
              if (step.taskDueHours) {
                txt += `  Vencimento: ${step.taskDueHours}h\n`;
              }
            } else if (actionType === 'send_email') {
              txt += `  E-mail: ${step.emailTo || 'Não definido'}\n`;
              if (step.emailSubject) {
                txt += `  Assunto: ${step.emailSubject}\n`;
              }
              if (step.emailBody) {
                txt += `  Corpo: "${step.emailBody.substring(0, 100)}${step.emailBody.length > 100 ? '...' : ''}"\n`;
              }
            } else if (actionType === 'webhook') {
              txt += `  URL: ${step.webhookUrl || 'Não definida'}\n`;
              if (step.webhookMethod) {
                txt += `  Metodo: ${step.webhookMethod}\n`;
              }
            }
          }
          txt += '\n';

          for (const edge of outEdges) {
            result += processNode(edge.target, visited);
          }
        }

        return result;
      };

      const visited = new Set<string>();
      if (triggerNode) {
        const outEdges = getOutgoingEdges(triggerNode.id);
        for (const edge of outEdges) {
          processNode(edge.target, visited);
        }
      }

      txt += '═══════════════════════════════════════════════════════════════════════════════\n';
      txt += 'RESUMO DO FLUXO\n';
      txt += '═══════════════════════════════════════════════════════════════════════════════\n';
      txt += `  Total de nos: ${nodes.length}\n`;
      txt += `  Condicoes: ${conditionNodes.length}\n`;
      txt += `  Acoes: ${actionNodes.length}\n`;
      txt += '\n';

      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(flow.name || 'fluxo').toLowerCase().replace(/\s+/g, '-')}-detalhes.txt`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, nodes, edges, flow, messageTemplates, conditionFieldOptions, conditionOperatorLabels, flowActionLabels]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const previewContext = useMemo(() => buildPreviewContext(), []);
  const delayPreview = useMemo(() => {
    if (!selectedNode?.data.step?.delayExpression) return null;
    const result = evaluateExpression(selectedNode.data.step.delayExpression, previewContext);
    return result == null ? null : String(result);
  }, [previewContext, selectedNode?.data.step?.delayExpression]);
  const messagePreview = useMemo(() => {
    if (!selectedNode?.data.step?.customMessage?.text) return null;
    return applyPreviewVariables(selectedNode.data.step.customMessage.text, previewContext);
  }, [previewContext, selectedNode?.data.step?.customMessage?.text]);

  const nodeIssues = useMemo(() => {
    const bySource = new Map<string, Edge[]>();
    const byTarget = new Map<string, Edge[]>();
    edges.forEach((edge) => {
      const sourceList = bySource.get(edge.source) ?? [];
      sourceList.push(edge);
      bySource.set(edge.source, sourceList);
      const targetList = byTarget.get(edge.target) ?? [];
      targetList.push(edge);
      byTarget.set(edge.target, targetList);
    });

    const issues = new Map<string, string[]>();
    nodes.forEach((node) => {
      const warnings: string[] = [];
      const outgoing = bySource.get(node.id) ?? [];
      const incoming = byTarget.get(node.id) ?? [];

      if (node.type !== 'trigger' && incoming.length === 0) {
        warnings.push('Sem entrada conectada');
      }

      if (node.type === 'condition') {
        const hasYes = outgoing.some((edge) => String(edge.label ?? '').toLowerCase() === 'sim');
        const hasNo = outgoing.some((edge) => String(edge.label ?? '').toLowerCase() === 'nao');
        if (!hasYes) warnings.push('Sem caminho Sim');
        if (!hasNo) warnings.push('Sem caminho Nao');
      } else if (node.type !== 'action' && outgoing.length === 0) {
        warnings.push('Sem saida conectada');
      }

      if (warnings.length > 0) {
        issues.set(node.id, warnings);
      }
    });

    return issues;
  }, [edges, nodes]);

  const selectedNodeIssues = selectedNode ? nodeIssues.get(selectedNode.id) ?? [] : [];
  const totalIssueCount = Array.from(nodeIssues.values()).reduce((sum, list) => sum + list.length, 0);

  const updateSelectedNode = (updates: Partial<AutoContactFlowGraphNodeData>) => {
    if (!selectedNode) return;
    setNodes((current) =>
      current.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, ...updates } } : node)),
    );
    if (selectedNode.type === 'trigger' && onTriggerChange) {
      const triggerType = updates.triggerType ?? selectedNode.data.triggerType ?? 'lead_created';
      const triggerStatuses = updates.triggerStatuses ?? selectedNode.data.triggerStatuses ?? [];
      const triggerDurationHours = updates.triggerDurationHours ?? selectedNode.data.triggerDurationHours ?? 24;
      onTriggerChange(
        triggerType as 'lead_created' | 'status_changed' | 'status_duration',
        triggerStatuses,
        triggerDurationHours,
      );
    }
  };

  const updateSelectedStep = (updates: Partial<AutoContactFlowStep>) => {
    if (!selectedNode) return;
    const currentStep = selectedNode.data.step ?? createDefaultStep(messageTemplates[0]?.id);
    const nextStep = { ...currentStep, ...updates };
    const label =
      nextStep.actionType === 'update_status'
        ? 'Atualizar status'
        : nextStep.actionType === 'create_task'
          ? 'Criar tarefa'
          : nextStep.actionType === 'send_email'
            ? 'Enviar e-mail'
            : nextStep.actionType === 'webhook'
              ? 'Disparar webhook'
        : nextStep.actionType === 'archive_lead'
          ? 'Arquivar lead'
          : nextStep.actionType === 'delete_lead'
            ? 'Excluir lead'
            : 'Enviar mensagem';
    updateSelectedNode({ step: nextStep, label });
  };

  const addActionNode = () => {
    const newId = createId('action');
    const lastNode = nodes
      .filter((node) => !edges.some((edge) => edge.source === node.id))
      .sort((a, b) => b.position.y - a.position.y)[0];
    const position = lastNode ? { x: lastNode.position.x + 260, y: lastNode.position.y } : { x: 200, y: 120 };
    const step = createDefaultStep(messageTemplates[0]?.id);
    setNodes((current) => [
      ...current,
      {
        id: newId,
        type: 'action',
        position,
        data: {
          label: 'Nova ação',
          step,
        },
      },
    ]);
    if (lastNode) {
      setEdges((current) => [
        ...current,
        {
          id: createId('edge'),
          source: lastNode.id,
          target: newId,
          label: lastNode.type === 'condition' ? 'Sim' : undefined,
        },
      ]);
    }
  };

  const addConditionNode = () => {
    const lastNode = nodes
      .filter((node) => !edges.some((edge) => edge.source === node.id))
      .sort((a, b) => b.position.y - a.position.y)[0];
    const anchor = lastNode ?? nodes.find((node) => node.type === 'trigger');
    if (!anchor) return;
    const newId = createId('condition');
    const position = { x: anchor.position.x + 220, y: anchor.position.y + 20 };
    setNodes((current) => [
      ...current,
      {
        id: newId,
        type: 'condition',
        position,
        data: {
          label: 'Condição',
          conditions: [],
          conditionLogic: 'all',
        },
      },
    ]);
    setEdges((current) => [
      ...current,
      {
        id: createId('edge'),
        source: anchor.id,
        target: newId,
      },
    ]);
  };

  const addConditionAfterSelected = () => {
    if (!selectedNode) return;
    const newId = createId('condition');
    const position = { x: selectedNode.position.x + 220, y: selectedNode.position.y + 20 };
    setNodes((current) => [
      ...current,
      {
        id: newId,
        type: 'condition',
        position,
        data: {
          label: 'Condição',
          conditions: [],
          conditionLogic: 'all',
        },
      },
    ]);
    setEdges((current) => [
      ...current,
      {
        id: createId('edge'),
        source: selectedNode.id,
        target: newId,
        label: selectedNode.type === 'condition' ? 'Sim' : undefined,
      },
    ]);
  };

  const reorganizeLayout = () => {
    const trigger = nodes.find((node) => node.type === 'trigger');
    if (!trigger) return;
    const levels = new Map<string, number>();
    levels.set(trigger.id, 0);
    for (let i = 0; i < nodes.length; i += 1) {
      edges.forEach((edge) => {
        const sourceLevel = levels.get(edge.source);
        if (sourceLevel == null) return;
        const targetLevel = Math.max(levels.get(edge.target) ?? 0, sourceLevel + 1);
        levels.set(edge.target, targetLevel);
      });
    }

    const levelGroups = new Map<number, Node[]>();
    nodes
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((node) => {
        const level = levels.get(node.id) ?? 0;
        const list = levelGroups.get(level) ?? [];
        list.push(node);
        levelGroups.set(level, list);
      });

    setNodes((current) =>
      current.map((node) => {
        const level = levels.get(node.id) ?? 0;
        const group = levelGroups.get(level) ?? [node];
        const index = group.findIndex((item) => item.id === node.id);
        const x = 80 + level * 280;
        const y = 80 + index * 160;
        return {
          ...node,
          position: { x, y },
        };
      }),
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div
        ref={reactFlowWrapperRef}
        className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:h-[560px] lg:h-[680px]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 rounded-t-2xl">
          <div>
            <div className="text-xs uppercase text-slate-400 font-semibold">Builder avancado</div>
            <div className="text-sm text-slate-700">Arraste e conecte as etapas do seu fluxo.</div>
            <div className="text-[11px] text-slate-500 mt-1">Clique em uma linha para remover.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addConditionNode}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              + Condicao
            </button>
            <button
              type="button"
              onClick={addActionNode}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              + Acao
            </button>
            <button
              type="button"
              onClick={exportFlowAsImage}
              disabled={isExporting}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm hover:bg-slate-100 disabled:opacity-60"
              title="Exportar como imagem"
            >
              <Download className="h-4 w-4" />
              PNG
            </button>
            <button
              type="button"
              onClick={exportFlowAsTxt}
              disabled={isExporting}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm hover:bg-slate-100 disabled:opacity-60"
              title="Exportar detalhes do fluxo em TXT"
            >
              <Download className="h-4 w-4" />
              TXT
            </button>
            <button
              type="button"
              onClick={reorganizeLayout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100"
              title="Reorganizar"
              aria-label="Reorganizar"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
        {totalIssueCount > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
            Existem {totalIssueCount} alerta(s) de conexao no fluxo.
          </div>
        )}
        <div className="min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onEdgeClick={handleEdgeClick}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setContextMenu(null);
            }}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              setSelectedNodeId(node.id);
              setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
            }}
            onPaneClick={() => setContextMenu(null)}
            nodeTypes={nodeTypes}
            fitView
            className="h-full bg-slate-50"
          >
            <MiniMap nodeColor={flowThemeColors.minimapNode} maskColor={flowThemeColors.minimapMask} />
            <Controls />
            <Background gap={18} size={1} color={flowThemeColors.backgroundGrid} />
          </ReactFlow>
        </div>
        {contextMenu && (
          <div
            className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg text-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
              onClick={() => handleDeleteNode(contextMenu.nodeId)}
            >
              Excluir bloco
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 h-[520px] sm:h-[560px] lg:h-[680px] overflow-y-auto">
        <div className="text-xs uppercase text-slate-400 font-semibold">Inspector</div>
            {selectedNode ? (
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">{selectedNode.data.label || 'No'}</div>
              <div className="text-xs text-slate-500">Tipo: {selectedNode.type}</div>
            </div>

            {selectedNodeIssues.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {selectedNodeIssues.join(' • ')}
              </div>
            )}

            {selectedNode.type === 'trigger' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Tipo de gatilho</label>
                  <FilterSingleSelect
                    icon={RefreshCcw}
                    size="compact"
                    value={selectedNode.data.triggerType ?? 'lead_created'}
                    onChange={(value) => {
                      const triggerType = value as 'lead_created' | 'status_changed' | 'status_duration';
                      const label = triggerType === 'lead_created' 
                        ? 'Lead criado' 
                        : triggerType === 'status_changed' 
                          ? 'Mudança de status' 
                          : 'Tempo em status';
                      updateSelectedNode({ 
                        triggerType, 
                        label,
                        triggerStatuses: triggerType !== 'lead_created' ? (selectedNode.data.triggerStatuses ?? []) : [],
                        triggerDurationHours: triggerType === 'status_duration' ? (selectedNode.data.triggerDurationHours ?? 24) : 24,
                      });
                    }}
                    placeholder="Tipo de gatilho"
                    includePlaceholderOption={false}
                    options={[
                      { value: 'lead_created', label: 'Lead criado' },
                      { value: 'status_changed', label: 'Mudança de status' },
                      { value: 'status_duration', label: 'Tempo em status' },
                    ]}
                  />
                </div>

                {(selectedNode.data.triggerType === 'status_changed' || selectedNode.data.triggerType === 'status_duration') && (
                  <div>
                    <MultiSelectDropdown
                      options={leadStatuses.filter((s) => s.ativo !== false).map((status) => ({
                        value: status.nome,
                        label: status.nome,
                      }))}
                      values={selectedNode.data.triggerStatuses ?? []}
                      onChange={(selected) => updateSelectedNode({ triggerStatuses: selected })}
                      placeholder="Selecione os status..."
                      label="Status do lead"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Selecione um ou mais status</div>
                  </div>
                )}

                {selectedNode.data.triggerType === 'status_duration' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Tempo no status (horas)</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedNode.data.triggerDurationHours ?? 24}
                      onChange={(event) =>
                        updateSelectedNode({ triggerDurationHours: Number(event.target.value) })
                      }
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">
                      O fluxo será executado quando o lead estiver há mais de X horas neste(s) status
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedNode.type === 'condition' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Aplicar quando</span>
                  <div className="w-40">
                    <FilterSingleSelect
                      icon={RefreshCcw}
                      size="compact"
                    value={selectedNode.data.conditionLogic ?? 'all'}
                      onChange={(value) =>
                      updateSelectedNode({ conditionLogic: value === 'any' ? 'any' : 'all' })
                    }
                      placeholder="Lógica"
                      includePlaceholderOption={false}
                      options={[
                        { value: 'all', label: 'todas as condicoes' },
                        { value: 'any', label: 'qualquer condicao' },
                      ]}
                    />
                  </div>
                </div>
                {(selectedNode.data.conditions ?? []).map((condition, index) => {
                  const valueOptions = getConditionValueOptions(condition.field);
                  return (
                    <div key={condition.id} className="space-y-2 border border-slate-200 rounded-lg p-3">
                      <FilterSingleSelect
                        icon={RefreshCcw}
                        size="compact"
                        value={condition.field}
                        onChange={(value) => {
                          const nextField = value as AutoContactFlowCondition['field'];
                          const next = nextField === 'event'
                            ? { field: nextField, operator: 'equals' as AutoContactFlowConditionOperator, value: 'lead_created' }
                            : nextField === 'whatsapp_valid'
                              ? {
                                  field: nextField,
                                  operator: 'equals' as AutoContactFlowConditionOperator,
                                  value: 'true',
                                }
                            : { field: nextField, value: '' };
                          const nextConditions = [...(selectedNode.data.conditions ?? [])];
                          nextConditions[index] = { ...condition, ...next };
                          updateSelectedNode({ conditions: nextConditions });
                        }}
                        placeholder="Campo"
                        includePlaceholderOption={false}
                        options={conditionFieldOptions.map(([value, label]) => ({
                          value,
                          label,
                        }))}
                      />
                      <FilterSingleSelect
                        icon={RefreshCcw}
                        size="compact"
                        value={condition.operator}
                        onChange={(value) => {
                          const nextConditions = [...(selectedNode.data.conditions ?? [])];
                          nextConditions[index] = {
                            ...condition,
                            operator: value as AutoContactFlowConditionOperator,
                          };
                          updateSelectedNode({ conditions: nextConditions });
                        }}
                        placeholder="Operador"
                        includePlaceholderOption={false}
                        options={Object.entries(conditionOperatorLabels).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                      />
                      {BOOLEAN_FIELDS.includes(condition.field) ? (
                        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                          Use as conexões <span className="font-semibold">Sim/Não</span> para definir o fluxo quando a condição for verdadeira ou falsa.
                        </div>
                      ) : (
                        <>
                          {valueOptions ? (
                            <FilterSingleSelect
                              icon={RefreshCcw}
                              size="compact"
                              value={condition.value}
                              onChange={(value) => {
                                const nextConditions = [...(selectedNode.data.conditions ?? [])];
                                nextConditions[index] = { ...condition, value };
                                updateSelectedNode({ conditions: nextConditions });
                              }}
                              placeholder="Selecione"
                              includePlaceholderOption={false}
                              options={[
                                { value: '', label: 'Selecione' },
                                ...valueOptions.map((option) => ({
                                  value: option,
                                  label: getConditionOptionLabel(condition.field, option),
                                })),
                              ]}
                            />
                          ) : (
                            <input
                              type="text"
                              value={condition.value}
                              onChange={(event) => {
                                const nextConditions = [...(selectedNode.data.conditions ?? [])];
                                nextConditions[index] = { ...condition, value: event.target.value };
                                updateSelectedNode({ conditions: nextConditions });
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                            />
                          )}
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Condicao {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextConditions = [...(selectedNode.data.conditions ?? [])];
                            nextConditions.splice(index, 1);
                            updateSelectedNode({ conditions: nextConditions });
                          }}
                          className="text-[11px] text-red-500 hover:text-red-600"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const nextConditions = [...(selectedNode.data.conditions ?? [])];
                    nextConditions.push({
                      id: createId('condition'),
                      field: 'status',
                      operator: 'equals',
                      value: '',
                    });
                    updateSelectedNode({ conditions: nextConditions });
                  }}
                  className="w-full px-3 py-2 text-xs border border-dashed border-slate-200 rounded-lg text-slate-500"
                >
                  + Adicionar condicao
                </button>
                <div className="text-[11px] text-slate-400">
                  Use formulas iniciando com '=' (ex.: =len(lead.telefone)&gt;10).
                </div>
                <button
                  type="button"
                  onClick={addConditionAfterSelected}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-600"
                >
                  + Condicao abaixo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEdges((current) => current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
                    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
                    setSelectedNodeId(null);
                  }}
                  className="w-full px-3 py-2 text-xs border border-red-200 rounded-lg text-red-600"
                >
                  Remover bloco de condicao
                </button>
              </div>
            )}

            {selectedNode.type === 'action' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Esperar</label>
                    <input
                      type="number"
                      min={0}
                      value={selectedNode.data.step?.delayValue ?? 0}
                      onChange={(event) => updateSelectedStep({ delayValue: Number(event.target.value) })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Unidade</label>
                    <FilterSingleSelect
                      icon={RefreshCcw}
                      size="compact"
                      value={selectedNode.data.step?.delayUnit ?? 'hours'}
                      onChange={(value) =>
                        updateSelectedStep({ delayUnit: value as AutoContactDelayUnit })
                      }
                      placeholder="Unidade"
                      includePlaceholderOption={false}
                      options={Object.entries(delayUnitLabels).map(([value, label]) => ({
                        value,
                        label: label.plural,
                      }))}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] text-slate-500">Formula de delay (opcional)</label>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedStep({
                          delayExpression: selectedNode.data.step?.delayExpression ? '' : '=1',
                        })
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700"
                    >
                      {selectedNode.data.step?.delayExpression ? 'Remover formula' : 'Usar formula'}
                    </button>
                  </div>
                  {selectedNode.data.step?.delayExpression && (
                    <input
                      type="text"
                      value={selectedNode.data.step.delayExpression}
                      onChange={(event) => updateSelectedStep({ delayExpression: event.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      placeholder="=if(len(lead.telefone)>10, 2, 6)"
                    />
                  )}
                  <div className="text-[11px] text-slate-400 mt-1">
                    Ex.: =if(len(lead.telefone)&gt;10, 2, 6)
                  </div>
                  {delayPreview && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      Preview: {delayPreview}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Tipo de acao</label>
                  <FilterSingleSelect
                    icon={RefreshCcw}
                    size="compact"
                    value={selectedNode.data.step?.actionType ?? 'send_message'}
                    onChange={(value) =>
                      updateSelectedStep({ actionType: value as AutoContactFlowActionType })
                    }
                    placeholder="Tipo de acao"
                    includePlaceholderOption={false}
                    options={Object.entries(flowActionLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                </div>

                {selectedNode.data.step?.actionType === 'send_message' && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-500">
                      Canal ativo: WhatsApp (configurado em Integracoes).
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Origem da mensagem</label>
                      <FilterSingleSelect
                        icon={RefreshCcw}
                        size="compact"
                        value={selectedNode.data.step?.messageSource ?? 'template'}
                        onChange={(value) =>
                          updateSelectedStep({ messageSource: value as AutoContactFlowMessageSource })
                        }
                        placeholder="Origem"
                        includePlaceholderOption={false}
                        options={[
                          { value: 'template', label: 'Template' },
                          { value: 'custom', label: 'Mensagem custom' },
                        ]}
                      />
                    </div>
                    {selectedNode.data.step?.messageSource === 'template' ? (
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Template</label>
                        <FilterSingleSelect
                          icon={RefreshCcw}
                          size="compact"
                          value={selectedNode.data.step?.templateId ?? ''}
                          onChange={(value) => updateSelectedStep({ templateId: value })}
                          placeholder="Selecione"
                          includePlaceholderOption={false}
                          options={[
                            { value: '', label: 'Selecione' },
                            ...messageTemplates.map((template) => ({
                              value: template.id,
                              label: template.name,
                            })),
                          ]}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Mensagem</label>
                        <textarea
                          rows={4}
                          value={selectedNode.data.step?.customMessage?.text ?? ''}
                          onChange={(event) =>
                            updateSelectedStep({
                              customMessage: {
                                type: 'text',
                                text: event.target.value,
                              },
                            })
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                        />
                        <div className="text-[11px] text-slate-400 mt-1">
                          Use formulas com {'{{= ... }}'}.
                        </div>
                        {messagePreview && (
                          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                            Preview: {messagePreview}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedNode.data.step?.actionType === 'update_status' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Status do lead</label>
                    <FilterSingleSelect
                      icon={RefreshCcw}
                      size="compact"
                      value={selectedNode.data.step?.statusToSet ?? ''}
                      onChange={(value) => updateSelectedStep({ statusToSet: value })}
                      placeholder="Selecione um status"
                      includePlaceholderOption={false}
                      options={[
                        { value: '', label: 'Selecione um status' },
                        ...leadStatuses
                          .filter((status) => status.ativo !== false)
                          .map((status) => ({
                            value: status.nome,
                            label: status.nome,
                          })),
                      ]}
                    />
                  </div>
                )}

                {selectedNode.data.step?.actionType === 'create_task' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Título</label>
                      <input
                        type="text"
                        value={selectedNode.data.step?.taskTitle ?? ''}
                        onChange={(event) => updateSelectedStep({ taskTitle: event.target.value })}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Descrição</label>
                      <textarea
                        rows={3}
                        value={selectedNode.data.step?.taskDescription ?? ''}
                        onChange={(event) => updateSelectedStep({ taskDescription: event.target.value })}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Vencimento (h)</label>
                        <input
                          type="number"
                          min={0}
                          value={selectedNode.data.step?.taskDueHours ?? ''}
                          onChange={(event) => updateSelectedStep({ taskDueHours: Number(event.target.value) })}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Prioridade</label>
                        <FilterSingleSelect
                          icon={RefreshCcw}
                          size="compact"
                          value={selectedNode.data.step?.taskPriority ?? 'normal'}
                          onChange={(value) =>
                            updateSelectedStep({ taskPriority: value as AutoContactFlowStep['taskPriority'] })
                          }
                          placeholder="Prioridade"
                          includePlaceholderOption={false}
                          options={[
                            { value: 'baixa', label: 'Baixa' },
                            { value: 'normal', label: 'Normal' },
                            { value: 'alta', label: 'Alta' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.data.step?.actionType === 'send_email' && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-500">
                      Envio depende de conta configurada em Integracoes de e-mail.
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Para</label>
                      <input
                        type="text"
                        value={selectedNode.data.step?.emailTo ?? ''}
                        onChange={(event) => updateSelectedStep({ emailTo: event.target.value })}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Assunto</label>
                      <input
                        type="text"
                        value={selectedNode.data.step?.emailSubject ?? ''}
                        onChange={(event) => updateSelectedStep({ emailSubject: event.target.value })}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Corpo</label>
                      <textarea
                        rows={3}
                        value={selectedNode.data.step?.emailBody ?? ''}
                        onChange={(event) => updateSelectedStep({ emailBody: event.target.value })}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.step?.actionType === 'webhook' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">URL</label>
                      <input
                        type="text"
                        value={selectedNode.data.step?.webhookUrl ?? ''}
                        onChange={(event) => updateSelectedStep({ webhookUrl: event.target.value })}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Método</label>
                        <FilterSingleSelect
                          icon={RefreshCcw}
                          size="compact"
                          value={selectedNode.data.step?.webhookMethod ?? 'POST'}
                          onChange={(value) =>
                            updateSelectedStep({
                              webhookMethod: value as AutoContactFlowStep['webhookMethod'],
                            })
                          }
                          placeholder="Método"
                          includePlaceholderOption={false}
                          options={[
                            { value: 'POST', label: 'POST' },
                            { value: 'PUT', label: 'PUT' },
                            { value: 'PATCH', label: 'PATCH' },
                            { value: 'GET', label: 'GET' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Headers (JSON)</label>
                        <input
                          type="text"
                          value={selectedNode.data.step?.webhookHeaders ?? ''}
                          onChange={(event) => updateSelectedStep({ webhookHeaders: event.target.value })}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Body</label>
                      <textarea
                        rows={3}
                        value={selectedNode.data.step?.webhookBody ?? ''}
                        onChange={(event) => updateSelectedStep({ webhookBody: event.target.value })}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-500">Selecione um no para editar.</div>
        )}
      </div>
    </div>
  );
}
