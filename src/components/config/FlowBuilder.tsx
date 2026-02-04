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
  eventValueLabels: Record<string, string>;
  delayUnitLabels: Record<AutoContactDelayUnit, { singular: string; plural: string }>;
  flowActionLabels: Record<AutoContactFlowActionType, string>;
  getConditionValueOptions: (field: AutoContactFlowCondition['field']) => string[] | null;
  onChangeGraph: (graph: AutoContactFlowGraph) => void;
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
    <Handle type="target" position={Position.Left} className="w-2 h-2 bg-amber-500" />
    <Handle type="source" position={Position.Right} className="w-2 h-2 bg-amber-500" />
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
  eventValueLabels,
  delayUnitLabels,
  flowActionLabels,
  getConditionValueOptions,
  onChangeGraph,
}: FlowBuilderProps) {
  const baseGraph = useMemo(() => buildFlowGraphFromFlow(flow), [flow.id, flow.flowGraph]);
  const [nodes, setNodes, onNodesChange] = useNodesState(baseGraph.nodes.map(toReactFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseGraph.edges as Edge[]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [initializedFlowId, setInitializedFlowId] = useState<string | null>(null);

  useEffect(() => {
    if (initializedFlowId !== flow.id) {
      setNodes(baseGraph.nodes.map(toReactFlowNode));
      setEdges(baseGraph.edges as Edge[]);
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
      })),
    };
    onChangeGraph(graph);
  }, [nodes, edges, onChangeGraph]);

  const handleConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: false }, eds)),
    [setEdges],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

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
        },
      ]);
    }
  };

  const addConditionNode = () => {
    if (nodes.some((node) => node.type === 'condition')) return;
    const trigger = nodes.find((node) => node.type === 'trigger');
    if (!trigger) return;
    const newId = createId('condition');
    setNodes((current) => [
      ...current,
      {
        id: newId,
        type: 'condition',
        position: { x: trigger.position.x + 260, y: trigger.position.y },
        data: {
          label: 'Condição',
          conditions: flow.conditions ?? [],
          conditionLogic: flow.conditionLogic ?? 'all',
        },
      },
    ]);
    setEdges((current) => [
      ...current,
      {
        id: createId('edge'),
        source: trigger.id,
        target: newId,
      },
    ]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 h-[560px]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 rounded-t-2xl">
          <div>
            <div className="text-xs uppercase text-slate-400 font-semibold">Builder avancado</div>
            <div className="text-sm text-slate-700">Arraste e conecte as etapas do seu fluxo.</div>
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
          </div>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
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
                              {condition.field === 'event' ? eventValueLabels[option] ?? option : option}
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
