import { useCallback, useEffect, useMemo, useState } from 'react';
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
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { RefreshCcw } from 'lucide-react';

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
import { buildFlowGraphFromFlow } from '../../lib/autoContactFlowGraph';

type FlowBuilderProps = {
  flow: AutoContactFlow;
  messageTemplates: AutoContactTemplate[];
  conditionFieldOptions: [string, string][];
  conditionOperatorLabels: Record<AutoContactFlowConditionOperator, string>;
  getConditionOptionLabel: (field: AutoContactFlowCondition['field'], value: string) => string;
  delayUnitLabels: Record<AutoContactDelayUnit, { singular: string; plural: string }>;
  flowActionLabels: Record<AutoContactFlowActionType, string>;
  getConditionValueOptions: (field: AutoContactFlowCondition['field']) => string[] | null;
  onChangeGraph: (graph: AutoContactFlowGraph) => void;
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

const TriggerNode = ({ data }: { data: AutoContactFlowGraphNodeData }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="text-xs font-semibold uppercase text-slate-400">Gatilho</div>
    <div className="text-sm font-semibold text-slate-800">{data.label || 'Lead criado'}</div>
    <div className="text-xs text-slate-500 mt-1">Dispara quando um lead entra no fluxo.</div>
    <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-400" />
  </div>
);

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
  onChangeGraph,
}: FlowBuilderProps) {
  const baseGraph = useMemo(() => buildFlowGraphFromFlow(flow), [flow.id, flow.flowGraph]);
  const [nodes, setNodes, onNodesChange] = useNodesState(baseGraph.nodes.map(toReactFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseGraph.edges.map(toReactFlowEdge));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [initializedFlowId, setInitializedFlowId] = useState<string | null>(null);

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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 h-[560px]">
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onEdgeClick={handleEdgeClick}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-50"
        >
          <MiniMap nodeColor="#e2e8f0" maskColor="rgba(15,23,42,0.1)" />
          <Controls />
          <Background gap={18} size={1} color="#e2e8f0" />
        </ReactFlow>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 h-[560px] overflow-y-auto">
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

            {selectedNode.type === 'condition' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Aplicar quando</span>
                  <select
                    value={selectedNode.data.conditionLogic ?? 'all'}
                    onChange={(event) =>
                      updateSelectedNode({ conditionLogic: event.target.value === 'any' ? 'any' : 'all' })
                    }
                    className="px-2 py-1 text-xs border border-slate-200 rounded-md"
                  >
                    <option value="all">todas as condicoes</option>
                    <option value="any">qualquer condicao</option>
                  </select>
                </div>
                {(selectedNode.data.conditions ?? []).map((condition, index) => {
                  const valueOptions = getConditionValueOptions(condition.field);
                  return (
                    <div key={condition.id} className="space-y-2 border border-slate-200 rounded-lg p-3">
                      <select
                        value={condition.field}
                        onChange={(event) => {
                          const nextField = event.target.value as AutoContactFlowCondition['field'];
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
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      >
                        {conditionFieldOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(event) => {
                          const nextConditions = [...(selectedNode.data.conditions ?? [])];
                          nextConditions[index] = {
                            ...condition,
                            operator: event.target.value as AutoContactFlowConditionOperator,
                          };
                          updateSelectedNode({ conditions: nextConditions });
                        }}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      >
                        {Object.entries(conditionOperatorLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {valueOptions ? (
                        <select
                          value={condition.value}
                          onChange={(event) => {
                            const nextConditions = [...(selectedNode.data.conditions ?? [])];
                            nextConditions[index] = { ...condition, value: event.target.value };
                            updateSelectedNode({ conditions: nextConditions });
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                        >
                          <option value="">Selecione</option>
                          {valueOptions.map((option) => (
                            <option key={option} value={option}>
                              {getConditionOptionLabel(condition.field, option)}
                            </option>
                          ))}
                        </select>
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
                    <select
                      value={selectedNode.data.step?.delayUnit ?? 'hours'}
                      onChange={(event) =>
                        updateSelectedStep({ delayUnit: event.target.value as AutoContactDelayUnit })
                      }
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                    >
                      {Object.entries(delayUnitLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label.plural}
                        </option>
                      ))}
                    </select>
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
                  <select
                    value={selectedNode.data.step?.actionType ?? 'send_message'}
                    onChange={(event) =>
                      updateSelectedStep({ actionType: event.target.value as AutoContactFlowActionType })
                    }
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                  >
                    {Object.entries(flowActionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedNode.data.step?.actionType === 'send_message' && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-500">
                      Canal ativo: WhatsApp (configurado em Integracoes).
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Origem da mensagem</label>
                      <select
                        value={selectedNode.data.step?.messageSource ?? 'template'}
                        onChange={(event) =>
                          updateSelectedStep({ messageSource: event.target.value as AutoContactFlowMessageSource })
                        }
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      >
                        <option value="template">Template</option>
                        <option value="custom">Mensagem custom</option>
                      </select>
                    </div>
                    {selectedNode.data.step?.messageSource === 'template' ? (
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Template</label>
                        <select
                          value={selectedNode.data.step?.templateId ?? ''}
                          onChange={(event) => updateSelectedStep({ templateId: event.target.value })}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                        >
                          {messageTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
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
                    <input
                      type="text"
                      value={selectedNode.data.step?.statusToSet ?? ''}
                      onChange={(event) => updateSelectedStep({ statusToSet: event.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                      placeholder="Ex.: Contato Inicial"
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
                        <select
                          value={selectedNode.data.step?.taskPriority ?? 'normal'}
                          onChange={(event) =>
                            updateSelectedStep({ taskPriority: event.target.value as AutoContactFlowStep['taskPriority'] })
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                        >
                          <option value="baixa">Baixa</option>
                          <option value="normal">Normal</option>
                          <option value="alta">Alta</option>
                        </select>
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
                        <select
                          value={selectedNode.data.step?.webhookMethod ?? 'POST'}
                          onChange={(event) =>
                            updateSelectedStep({
                              webhookMethod: event.target.value as AutoContactFlowStep['webhookMethod'],
                            })
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                        >
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="GET">GET</option>
                        </select>
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
