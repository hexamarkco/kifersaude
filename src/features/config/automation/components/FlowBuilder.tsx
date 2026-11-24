import { FieldLabel, Text } from '../../../../design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkflowCanvas as ReactFlow, WorkflowBackground as Background, WorkflowControls as Controls, WorkflowHandle as Handle, WorkflowMiniMap as MiniMap } from '../../../../design-system';
import { addEdge, Position, type Connection, type Edge, type Node, getNodesBounds, getViewportForBounds, useEdgesState, useNodesState } from 'reactflow';
import { Clock3, Download, FileText, GitBranch, MessageCircle, Plus, RefreshCcw, UserRoundCheck, UserRoundPlus } from "lucide-react";
import { toPng } from "html-to-image";

import {
  type AutoContactDelayUnit,
  type AutoContactFlow,
  type AutoContactFlowActionType,
  type AutoContactFlowCondition,
  type AutoContactFlowConditionOperator,
  type AutoContactFlowGraph,
  type AutoContactFlowGraphNode,
  type AutoContactFlowGraphNodeData,
  type AutoContactFlowStep,
  type AutoContactTemplate,
} from "../../../../lib/autoContactService";
import { AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS } from "../../../../lib/templateVariableSuggestions";
import type { LeadStatusConfig } from "../../../leads";
import { buildFlowGraphFromFlow } from "../../../../lib/autoContactFlowGraph";
import { buildAutoContactFlowTextExport } from "../../../../lib/autoContactFlowExport";
import { evaluateSafeFormula } from "../../../../lib/safeFormula";
import { VariableAutocompleteTextarea } from '../../../../design-system';
import { MessageVariationsEditor } from "./MessageVariationsEditor";
import {
  Button,
  Field,
  Input,
  DialogDescription,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  RecordActions,
  Surface,
  FilterSelect,
  MultiSelect,
} from "../../../../design-system";

type FlowBuilderProps = {
  flow: AutoContactFlow;
  messageTemplates: AutoContactTemplate[];
  conditionFieldOptions: [string, string][];
  conditionOperatorLabels: Record<AutoContactFlowConditionOperator, string>;
  getConditionOptionLabel: (
    field: AutoContactFlowCondition["field"],
    value: string,
  ) => string;
  delayUnitLabels: Record<
    AutoContactDelayUnit,
    { singular: string; plural: string }
  >;
  flowActionLabels: Record<AutoContactFlowActionType, string>;
  getConditionValueOptions: (
    field: AutoContactFlowCondition["field"],
  ) => string[] | null;
  leadStatuses: LeadStatusConfig[];
  onChangeGraph: (graph: AutoContactFlowGraph) => void;
  onOpenExitCondition?: () => void;
  onPreviewAiMessage?: (input: {
    stepId: string;
    itemIndex: number;
    instruction: string;
  }) => Promise<string>;
  onTriggerChange?: (
    triggerType: "lead_created" | "status_changed" | "status_duration" | "inactivity_duration",
    triggerStatuses: string[],
    triggerDurationHours: number,
  ) => void;
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildPreviewContext = () => {
  const lead = {
    nome_completo: "Lead Exemplo",
    telefone: "11999999999",
    email: "lead@exemplo.com",
    status: "Novo",
    origem: "Manual",
    cidade: "São Paulo",
    responsavel: "Luiza",
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

const evaluateExpression = (
  expression: string,
  context: Record<string, unknown>,
): unknown => evaluateSafeFormula(expression, context);

const createDefaultStep = (templateId?: string): AutoContactFlowStep => ({
  id: createId("step"),
  delayValue: 0,
  delayUnit: "hours",
  actionType: "send_message",
  messageSource: "template",
  templateId: templateId ?? "",
  customMessage: { type: "text", text: "" },
});

// Turn the saved left-to-right coordinates into a top-to-bottom canvas.
const toReactFlowNode = (
  node: AutoContactFlowGraphNode,
): Node<AutoContactFlowGraphNodeData> => ({
  id: node.id,
  type: node.type,
  position: { x: node.position.y, y: node.position.x },
  data: node.data,
});

const toReactFlowEdge = (edge: AutoContactFlowGraph["edges"][number]): Edge => {
  const label = typeof edge.label === "string" ? edge.label : undefined;
  const normalizedLabel = label?.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const sourceHandle =
    edge.sourceHandle ??
    (normalizedLabel === "sim"
      ? "yes"
      : normalizedLabel === "nao"
        ? "no"
        : undefined);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label,
    sourceHandle,
    targetHandle: edge.targetHandle,
  };
};

const toGraphNode = (
  node: Node<AutoContactFlowGraphNodeData>,
): AutoContactFlowGraphNode => ({
  id: node.id,
  type: node.type as AutoContactFlowGraphNode["type"],
  position: { x: node.position.y, y: node.position.x },
  data: node.data,
});

const TriggerNode = ({
  data,
  selected,
}: {
  data: AutoContactFlowGraphNodeData;
  selected?: boolean;
}) => {
  const getTriggerDescription = () => {
    switch (data.triggerType) {
      case "status_changed":
        return data.triggerStatuses?.length
          ? `Dispara ao mudar para: ${data.triggerStatuses.join(", ")}`
          : "Dispara ao mudar de status";
      case "status_duration":
        return data.triggerStatuses?.length
          ? `Dispara após ${data.triggerDurationHours ?? 24}h em: ${data.triggerStatuses.join(", ")}`
          : `Dispara após ${data.triggerDurationHours ?? 24}h em status específico`;
      case "inactivity_duration":
        return data.triggerStatuses?.length
          ? `Dispara após ${data.triggerDurationHours ?? 24}h sem interação em: ${data.triggerStatuses.join(", ")}`
          : `Dispara após ${data.triggerDurationHours ?? 24}h sem interação`;
      default:
        return "Dispara quando um lead é criado";
    }
  };

  return (
    <div className="kds-automation-node" data-kind="trigger" data-selected={selected}>
      <div className="kds-automation-node-heading">
        <span className="kds-automation-node-icon"><UserRoundPlus aria-hidden="true" /></span>
        <span><strong>{data.label || "Lead criado"}</strong><small>Gatilho de entrada</small></span>
      </div>
      <Text size="sm" tone="muted">{getTriggerDescription()}</Text>
      <Handle
        type="source"
        position={Position.Bottom}
        className="h-2 w-2 bg-[var(--border-strong)]"
      />
    </div>
  );
};

const BOOLEAN_FIELDS = ["whatsapp_valid", "event", "lead_created"];

const ConditionNode = ({
  data,
  selected,
}: {
  data: AutoContactFlowGraphNodeData;
  selected?: boolean;
}) => (
  <div className="kds-automation-node" data-kind="condition" data-selected={selected}>
    <div className="kds-automation-node-heading">
      <span className="kds-automation-node-icon"><GitBranch aria-hidden="true" /></span>
      <span><strong>{data.label || "Condições"}</strong><small>Decisão na jornada</small></span>
    </div>
    <Text size="sm" tone="muted">{data.conditions?.length ? `${data.conditions.length} condição(ões)` : "Configure as condições."}</Text>
    <div className="kds-automation-node-branches"><small>Sim</small><small>Não</small></div>
    <Handle
      type="target"
      position={Position.Top}
      className="h-2 w-2 bg-[var(--brand-primary)]"
    />
    <Handle
      id="yes"
      type="source"
      position={Position.Bottom}
      className="kds-flow-handle-yes h-2 w-2 bg-[var(--brand-primary)]"
    />
    <Handle
      id="no"
      type="source"
      position={Position.Bottom}
      className="kds-flow-handle-no h-2 w-2 bg-[var(--brand-primary)]"
    />
  </div>
);

const ActionNode = ({
  data,
  selected,
}: {
  data: AutoContactFlowGraphNodeData;
  selected?: boolean;
}) => (
  <div className="kds-automation-node" data-kind="action" data-selected={selected}>
    <div className="kds-automation-node-heading">
      <span className="kds-automation-node-icon"><MessageCircle aria-hidden="true" /></span>
      <span><strong>{data.label || "Ação"}</strong><small>Etapa da jornada</small></span>
    </div>
    {data.step && <Text size="sm" tone="muted">
      <Clock3 className="kds-control-icon" aria-hidden="true" />
      {data.step.delayValue > 0 ? ` Aguardar ${data.step.delayValue} ${data.step.delayUnit === "minutes" ? "min" : data.step.delayUnit === "hours" ? "h" : data.step.delayUnit === "days" ? "dias" : "s"}` : " Executar sem espera"}
    </Text>}
    <Handle
      type="target"
      position={Position.Top}
        className="h-2 w-2 bg-[var(--border-strong)]"
    />
    <Handle
      type="source"
      position={Position.Bottom}
        className="h-2 w-2 bg-[var(--border-strong)]"
    />
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
  onPreviewAiMessage,
  onTriggerChange,
  onOpenExitCondition,
}: FlowBuilderProps) {
  const baseGraph = useMemo(() => buildFlowGraphFromFlow(flow), [flow]);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    baseGraph.nodes.map(toReactFlowNode),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    baseGraph.edges.map(toReactFlowEdge),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [initializedFlowId, setInitializedFlowId] = useState<string | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [flowThemeColors, setFlowThemeColors] = useState({
    exportBackground: "",
    minimapNode: "",
    minimapMask: "",
    backgroundGrid: "",
  });
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null);
  const graphSyncTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const root = reactFlowWrapperRef.current?.closest(".painel-theme");
    if (!root) return;

    const syncTheme = () => {
      const styles = getComputedStyle(root);
      setFlowThemeColors({
        exportBackground: styles.getPropertyValue("--bg-canvas").trim(),
        minimapNode: styles.getPropertyValue("--border-strong").trim(),
        minimapMask: styles.getPropertyValue("--bg-inset").trim(),
        backgroundGrid: styles.getPropertyValue("--border-default").trim(),
      });
    };

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (initializedFlowId !== flow.id) {
      setNodes(baseGraph.nodes.map(toReactFlowNode));
      setEdges(baseGraph.edges.map(toReactFlowEdge));
      setInitializedFlowId(flow.id);
    }
  }, [baseGraph, flow.id, initializedFlowId, setNodes, setEdges]);

  const buildCurrentGraph = useCallback(
    (): AutoContactFlowGraph => ({
      nodes: nodes.map(toGraphNode),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: typeof edge.label === "string" ? edge.label : undefined,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
      })),
    }),
    [edges, nodes],
  );

  const finishEditingNode = () => {
    if (graphSyncTimeoutRef.current !== null) {
      window.clearTimeout(graphSyncTimeoutRef.current);
      graphSyncTimeoutRef.current = null;
    }
    onChangeGraph(buildCurrentGraph());
    setSelectedNodeId(null);
  };

  useEffect(() => {
    if (graphSyncTimeoutRef.current !== null) {
      window.clearTimeout(graphSyncTimeoutRef.current);
    }

    graphSyncTimeoutRef.current = window.setTimeout(() => {
      graphSyncTimeoutRef.current = null;
      onChangeGraph(buildCurrentGraph());
    }, 120);

    return () => {
      if (graphSyncTimeoutRef.current !== null) {
        window.clearTimeout(graphSyncTimeoutRef.current);
        graphSyncTimeoutRef.current = null;
      }
    };
  }, [buildCurrentGraph, onChangeGraph]);

  const handleConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const label =
          connection.sourceHandle === "no"
            ? "Não"
            : connection.sourceHandle === "yes"
              ? "Sim"
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
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
      setSelectedNodeId((current) => (current === nodeId ? null : current));
      setContextMenu(null);
    },
    [setEdges, setNodes],
  );

  const exportFlowAsImage = useCallback(async () => {
    if (isExporting) return;
    const viewport = reactFlowWrapperRef.current?.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    if (!viewport) return;
    setIsExporting(true);
    try {
      const imageWidth = 1600;
      const imageHeight = 900;
      const bounds = getNodesBounds(nodes);
      const transform = getViewportForBounds(
        bounds,
        imageWidth,
        imageHeight,
        0.1,
        2,
      );

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

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "fluxo-whatsapp.png";
      link.click();
    } finally {
      setIsExporting(false);
    }
  }, [flowThemeColors.exportBackground, isExporting, nodes]);

  const exportFlowAsTxt = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const triggerNode = nodes.find((n) => n.type === "trigger");
      const conditionNodes = nodes.filter((n) => n.type === "condition");
      const actionNodes = nodes.filter((n) => n.type === "action");

      const getNodeLabel = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        return node?.data.label || node?.type || nodeId;
      };

      const getOutgoingEdges = (nodeId: string) => {
        return edges.filter((e) => e.source === nodeId);
      };

      const formatDelay = (step: AutoContactFlowStep | undefined) => {
        if (!step?.delayValue) return "";
        const unit =
          step.delayUnit === "minutes"
            ? "minuto(s)"
            : step.delayUnit === "hours"
              ? "hora(s)"
              : "dia(s)";
        return `Aguardar ${step.delayValue} ${unit}`;
      };

      let txt = "";
      txt +=
        "═══════════════════════════════════════════════════════════════════════════════\n";
      txt += `FLUXO DE AUTOMACAO - ${flow.name || "Sem nome"}\n`;
      txt +=
        "═══════════════════════════════════════════════════════════════════════════════\n\n";

      if (triggerNode) {
        txt +=
          "┌──────────────────────────────────────────────────────────────────────────────┐\n";
        txt +=
          "│ GATILHO (INICIO)                                                             │\n";
        txt +=
          "└──────────────────────────────────────────────────────────────────────────────┘\n";
        const data = triggerNode.data;
        txt += `  ID: ${triggerNode.id}\n`;
        txt += `  Nome: ${data.label || "Gatilho"}\n`;

        const triggerType = data.triggerType || "lead_created";
        if (triggerType === "lead_created") {
          txt += `  Tipo: Dispara quando um lead é criado\n`;
        } else if (triggerType === "status_changed") {
          txt += `  Tipo: Dispara ao mudar de status\n`;
          txt += `  Status: ${data.triggerStatuses?.join(", ") || "Não definido"}\n`;
        } else if (triggerType === "status_duration") {
          txt += `  Tipo: Dispara após ${data.triggerDurationHours || 24}h no status\n`;
          txt += `  Status: ${data.triggerStatuses?.join(", ") || "Não definido"}\n`;
        } else if (triggerType === "inactivity_duration") {
          txt += `  Tipo: Dispara após ${data.triggerDurationHours || 24}h sem interação\n`;
          txt += `  Status: ${data.triggerStatuses?.join(", ") || "Não definido"}\n`;
        }
        txt += "\n";
      }

      let stepNumber = 1;
      const processNode = (nodeId: string, visited: Set<string>): string => {
        if (visited.has(nodeId)) return "";
        visited.add(nodeId);

        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return "";

        let result = "";
        const outEdges = getOutgoingEdges(nodeId);

        if (node.type === "condition") {
          txt +=
            "┌──────────────────────────────────────────────────────────────────────────────┐\n";
          txt += `│ CONDICAO #${stepNumber++}                                                              │\n`;
          txt +=
            "└──────────────────────────────────────────────────────────────────────────────┘\n";
          txt += `  ID: ${node.id}\n`;
          txt += `  Nome: ${node.data.label || "Condição"}\n`;
          txt += `  Logica: ${node.data.conditionLogic === "all" ? "TODAS as condições" : "QUALQUER condição"}\n`;

          if (node.data.conditions && node.data.conditions.length > 0) {
            txt += `  Condicoes (${node.data.conditions.length}):\n`;
            node.data.conditions.forEach(
              (cond: AutoContactFlowCondition, idx: number) => {
                const fieldLabel =
                  conditionFieldOptions.find(([v]) => v === cond.field)?.[1] ||
                  cond.field;
                const operatorLabel =
                  conditionOperatorLabels[cond.operator] || cond.operator;
                txt += `    ${idx + 1}. ${fieldLabel} ${operatorLabel} "${cond.value}"\n`;
              },
            );
          } else {
            txt += `  Condicoes: Nenhuma condição definida\n`;
          }

          const yesEdge = outEdges.find(
            (e) =>
              String(e.label ?? "").toLowerCase() === "sim" ||
              e.sourceHandle === "yes",
          );
          const noEdge = outEdges.find(
            (e) =>
              String(e.label ?? "").toLowerCase() === "nao" ||
              e.sourceHandle === "no",
          );

          txt += `  Conexoes:\n`;
          txt += `    → SIM: ${yesEdge ? getNodeLabel(yesEdge.target) : "Não conectado"}\n`;
          txt += `    → NAO: ${noEdge ? getNodeLabel(noEdge.target) : "Não conectado"}\n`;
          txt += "\n";

          if (yesEdge) result += processNode(yesEdge.target, visited);
          if (noEdge) result += processNode(noEdge.target, visited);
        } else if (node.type === "action") {
          const step = node.data.step;
          txt +=
            "┌──────────────────────────────────────────────────────────────────────────────┐\n";
          txt += `│ ACAO #${stepNumber++}                                                                       │\n`;
          txt +=
            "└──────────────────────────────────────────────────────────────────────────────┘\n";
          txt += `  ID: ${node.id}\n`;
          txt += `  Nome: ${node.data.label || "Ação"}\n`;

          if (step) {
            const delayInfo = formatDelay(step);
            if (delayInfo) {
              txt += `  ${delayInfo}\n`;
            }

            const actionType = step.actionType || "send_message";
            const actionLabel = flowActionLabels[actionType] || actionType;
            txt += `  Tipo: ${actionLabel}\n`;

            if (actionType === "send_message") {
              const msgSource =
                step.messageSource === "template"
                  ? "Template"
                  : "Mensagem customizada";
              txt += `  Origem da mensagem: ${msgSource}\n`;

              if (Array.isArray(step.messages) && step.messages.length > 0) {
                step.messages.forEach((item, index) => {
                  if ("ai" in item) {
                    txt += `  Mensagem ${index + 1} (IA): ${item.ai.instruction || "instrução não definida"}\n`;
                  } else if ("templateId" in item) {
                    const template = messageTemplates.find((t) => t.id === item.templateId);
                    txt += `  Mensagem ${index + 1} (Template): ${template?.name || item.templateId || "não definido"}\n`;
                  } else {
                    txt += `  Mensagem ${index + 1} (Custom): ${(item.custom.text || "não definida").substring(0, 100)}\n`;
                  }
                });
              }

              if (step.messageSource === "template" && step.templateId) {
                const template = messageTemplates.find(
                  (t) => t.id === step.templateId,
                );
                txt += `  Template: ${template?.name || step.templateId}\n`;
              } else if (
                step.messageSource === "custom" &&
                step.customMessage?.text
              ) {
                txt += `  Mensagem: "${step.customMessage.text.substring(0, 100)}${step.customMessage.text.length > 100 ? "..." : ""}"\n`;
              }
            } else if (actionType === "update_status") {
              txt += `  Novo status: ${step.statusToSet || "Não definido"}\n`;
            } else if (actionType === "create_task") {
              txt += `  Titulo: ${step.taskTitle || "Não definido"}\n`;
              txt += `  Descricao: ${step.taskDescription || "Não definida"}\n`;
              txt += `  Prioridade: ${step.taskPriority || "normal"}\n`;
              if (step.taskDueHours) {
                txt += `  Vencimento: ${step.taskDueHours}h\n`;
              }
            } else if (actionType === "send_email") {
              txt += `  E-mail: ${step.emailTo || "Não definido"}\n`;
              if (step.emailSubject) {
                txt += `  Assunto: ${step.emailSubject}\n`;
              }
              if (step.emailBody) {
                txt += `  Corpo: "${step.emailBody.substring(0, 100)}${step.emailBody.length > 100 ? "..." : ""}"\n`;
              }
            } else if (actionType === "webhook") {
              txt += `  URL: ${step.webhookUrl || "Não definida"}\n`;
              if (step.webhookMethod) {
                txt += `  Metodo: ${step.webhookMethod}\n`;
              }
            }
          }
          txt += "\n";

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

      txt +=
        "═══════════════════════════════════════════════════════════════════════════════\n";
      txt += "RESUMO DO FLUXO\n";
      txt +=
        "═══════════════════════════════════════════════════════════════════════════════\n";
      txt += `  Total de nos: ${nodes.length}\n`;
      txt += `  Condicoes: ${conditionNodes.length}\n`;
      txt += `  Acoes: ${actionNodes.length}\n`;
      txt += "\n";

      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${(flow.name || "fluxo").toLowerCase().replace(/\s+/g, "-")}-detalhes.txt`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    nodes,
    edges,
    flow,
    messageTemplates,
    conditionFieldOptions,
    conditionOperatorLabels,
    flowActionLabels,
  ]);

  const exportFlowAsTxtDiagnostic = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const graph = {
        nodes: nodes.map(toGraphNode),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: typeof edge.label === "string" ? edge.label : undefined,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
        })),
      };
      const txt = buildAutoContactFlowTextExport({
        flow: {
          ...flow,
          flowGraph: graph,
        },
        graph,
        messageTemplates,
        conditionFieldOptions,
        conditionOperatorLabels,
        flowActionLabels,
        getConditionOptionLabel,
      });

      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${(flow.name || "fluxo").toLowerCase().replace(/\s+/g, "-")}-detalhes.txt`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    nodes,
    edges,
    flow,
    messageTemplates,
    conditionFieldOptions,
    conditionOperatorLabels,
    flowActionLabels,
    getConditionOptionLabel,
  ]);
  void exportFlowAsTxt;

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const previewContext = useMemo(() => buildPreviewContext(), []);
  const delayPreview = useMemo(() => {
    if (!selectedNode?.data.step?.delayExpression) return null;
    const result = evaluateExpression(
      selectedNode.data.step.delayExpression,
      previewContext,
    );
    return result == null ? null : String(result);
  }, [previewContext, selectedNode?.data.step?.delayExpression]);

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

      if (node.type !== "trigger" && incoming.length === 0) {
        warnings.push("Sem entrada conectada");
      }

      if (node.type === "condition") {
        const hasYes = outgoing.some(
          (edge) => String(edge.label ?? "").toLowerCase() === "sim",
        );
        const hasNo = outgoing.some(
          (edge) => String(edge.label ?? "").toLowerCase() === "nao",
        );
        if (!hasYes) warnings.push("Sem caminho Sim");
        if (!hasNo) warnings.push("Sem caminho Não");
      } else if (node.type !== "action" && outgoing.length === 0) {
        warnings.push("Sem saida conectada");
      }

      if (warnings.length > 0) {
        issues.set(node.id, warnings);
      }
    });

    return issues;
  }, [edges, nodes]);

  const selectedNodeIssues = selectedNode
    ? (nodeIssues.get(selectedNode.id) ?? [])
    : [];
  const totalIssueCount = Array.from(nodeIssues.values()).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  const updateSelectedNode = (
    updates: Partial<AutoContactFlowGraphNodeData>,
  ) => {
    if (!selectedNode) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, ...updates } }
          : node,
      ),
    );
    if (selectedNode.type === "trigger" && onTriggerChange) {
      const triggerType =
        updates.triggerType ?? selectedNode.data.triggerType ?? "lead_created";
      const triggerStatuses =
        updates.triggerStatuses ?? selectedNode.data.triggerStatuses ?? [];
      const triggerDurationHours =
        updates.triggerDurationHours ??
        selectedNode.data.triggerDurationHours ??
        24;
      onTriggerChange(
        triggerType as "lead_created" | "status_changed" | "status_duration" | "inactivity_duration",
        triggerStatuses,
        triggerDurationHours,
      );
    }
  };

  const updateSelectedStep = (updates: Partial<AutoContactFlowStep>) => {
    if (!selectedNode) return;
    const currentStep =
      selectedNode.data.step ?? createDefaultStep(messageTemplates[0]?.id);
    const nextStep = { ...currentStep, ...updates };
    const label =
      nextStep.actionType === "update_status"
        ? "Atualizar status"
        : nextStep.actionType === "create_task"
          ? "Criar tarefa"
          : nextStep.actionType === "send_email"
            ? "Enviar e-mail"
            : nextStep.actionType === "webhook"
              ? "Chamar outro sistema"
              : nextStep.actionType === "archive_lead"
                ? "Arquivar lead"
                : nextStep.actionType === "delete_lead"
                  ? "Excluir lead"
                  : nextStep.actionType === "activate_autonomous_service"
                    ? "Ativar atendimento autônomo (IA)"
                    : nextStep.actionType === "send_message" &&
                        nextStep.messages?.some((item) => "ai" in item)
                      ? "Enviar mensagem (IA)"
                    : "Enviar mensagem";
    updateSelectedNode({ step: nextStep, label });
  };

  const addActionNode = (actionType: AutoContactFlowActionType) => {
    const newId = createId("action");
    const lastNode = nodes
      .filter((node) => !edges.some((edge) => edge.source === node.id))
      .sort((a, b) => b.position.y - a.position.y)[0];
    const position = lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + 184 }
      : { x: 0, y: 160 };
    const step = { ...createDefaultStep(messageTemplates[0]?.id), actionType };
    setSelectedNodeId(newId);
    setNodes((current) => [
      ...current,
      {
        id: newId,
        type: "action",
        position,
        data: {
          label: flowActionLabels[actionType],
          step,
        },
      },
    ]);
    if (lastNode) {
      setEdges((current) => [
        ...current,
        {
          id: createId("edge"),
          source: lastNode.id,
          target: newId,
          label: lastNode.type === "condition" ? "Sim" : undefined,
        },
      ]);
    }
  };

  const addConditionNode = () => {
    const lastNode = nodes
      .filter((node) => !edges.some((edge) => edge.source === node.id))
      .sort((a, b) => b.position.y - a.position.y)[0];
    const anchor = lastNode ?? nodes.find((node) => node.type === "trigger");
    if (!anchor) return;
    const newId = createId("condition");
    setSelectedNodeId(newId);
    const position = { x: anchor.position.x, y: anchor.position.y + 184 };
    setNodes((current) => [
      ...current,
      {
        id: newId,
        type: "condition",
        position,
        data: {
          label: "Condição",
          conditions: [],
          conditionLogic: "all",
        },
      },
    ]);
    setEdges((current) => [
      ...current,
      {
        id: createId("edge"),
        source: anchor.id,
        target: newId,
      },
    ]);
  };

  const addConditionAfterSelected = () => {
    if (!selectedNode) return;
    const newId = createId("condition");
    const position = {
      x: selectedNode.position.x + 20,
      y: selectedNode.position.y + 184,
    };
    setNodes((current) => [
      ...current,
      {
        id: newId,
        type: "condition",
        position,
        data: {
          label: "Condição",
          conditions: [],
          conditionLogic: "all",
        },
      },
    ]);
    setEdges((current) => [
      ...current,
      {
        id: createId("edge"),
        source: selectedNode.id,
        target: newId,
        label: selectedNode.type === "condition" ? "Sim" : undefined,
      },
    ]);
  };

  const reorganizeLayout = () => {
    const trigger = nodes.find((node) => node.type === "trigger");
    if (!trigger) return;
    const levels = new Map<string, number>();
    levels.set(trigger.id, 0);
    for (let i = 0; i < nodes.length; i += 1) {
      edges.forEach((edge) => {
        const sourceLevel = levels.get(edge.source);
        if (sourceLevel == null) return;
        const targetLevel = Math.max(
          levels.get(edge.target) ?? 0,
          sourceLevel + 1,
        );
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
        const x = 80 + index * 320;
        const y = 80 + level * 184;
        return {
          ...node,
          position: { x, y },
        };
      }),
    );
  };

  const paletteActions = [
    { title: "Mensagem", icon: MessageCircle, type: "send_message" },
    { title: "Atualização do lead", icon: FileText, type: "update_status" },
    { title: "Criar tarefa", icon: Clock3, type: "create_task" },
    { title: "Atendimento autônomo", icon: UserRoundCheck, type: "activate_autonomous_service" },
  ] as const;
  return (
    <div className="kds-automation-builder">
      <Surface padding="md" className="kds-automation-palette" aria-label="Etapas disponíveis">
        <div>
          <Text weight="semibold">Uma etapa de cada vez.</Text>
          <Text size="sm" tone="muted">Escolha o próximo passo ou arraste as etapas para organizar a jornada.</Text>
        </div>
        {paletteActions.map(({ title, icon: Icon, type }) => (
          <Button key={type} variant="secondary" size="sm" onClick={() => addActionNode(type)}>
            <Icon className="kds-control-icon" aria-hidden="true" /><span>{title}</span><Plus className="kds-control-icon" aria-hidden="true" />
          </Button>
        ))}
        <Button variant="secondary" size="sm" onClick={addConditionNode}>
          <GitBranch className="kds-control-icon" aria-hidden="true" /><span>Condição</span><Plus className="kds-control-icon" aria-hidden="true" />
        </Button>
        {onOpenExitCondition && <Button variant="text" size="sm" onClick={onOpenExitCondition}>Condições de saída</Button>}
      </Surface>
      <div ref={reactFlowWrapperRef} className="kds-automation-canvas">
        <div className="kds-automation-canvas-bar">
          <Text size="sm" tone="muted">Clique em uma etapa para editar.</Text>
          <RecordActions label="Ações da jornada" visibleCount={0} actions={[
            { label: "Reorganizar etapas", icon: RefreshCcw, onClick: reorganizeLayout },
            { label: "Exportar como imagem", icon: Download, onClick: () => void exportFlowAsImage(), disabled: isExporting },
            { label: "Exportar detalhes em TXT", icon: FileText, onClick: () => void exportFlowAsTxtDiagnostic(), disabled: isExporting },
          ]} />
        </div>
        {totalIssueCount > 0 && (
          <div className="border-b border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-xs text-[var(--warning-text)]">
            Existem {totalIssueCount} alerta(s) de conexão no fluxo.
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
              setContextMenu({
                nodeId: node.id,
                x: event.clientX,
                y: event.clientY,
              });
            }}
            onPaneClick={() => setContextMenu(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.14, minZoom: 0.72, maxZoom: 1 }}
            minZoom={0.25}
            className="h-full kds-automation-react-flow"
          >
            <MiniMap
              position="top-right"
              nodeColor={flowThemeColors.minimapNode}
              maskColor={flowThemeColors.minimapMask}
            />
            <Controls />
            <Background
              gap={18}
              size={1}
              color={flowThemeColors.backgroundGrid}
            />
          </ReactFlow>
        </div>
        {contextMenu && (
          <div
            className="fixed z-50 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm shadow-[var(--shadow-popover)]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <Button
              variant="danger"
              size="sm"
              fullWidth
              className="justify-start border-0 bg-transparent text-left shadow-none"
              onClick={() => handleDeleteNode(contextMenu.nodeId)}
            >
              Excluir bloco
            </Button>
          </div>
        )}
      </div>

      {selectedNode && (
        <Drawer open size="md" className="kds-automation-drawer" onOpenChange={(open) => !open && finishEditingNode()}>
          <DrawerHeader onClose={finishEditingNode}>
            <DialogTitle>Editar etapa da jornada</DialogTitle>
            <DialogDescription placement="visible">{selectedNode.data.label || "Etapa do fluxo"}</DialogDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            {selectedNodeIssues.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning-text)]">
                {selectedNodeIssues.join(" • ")}
              </div>
            )}

            {selectedNode.type === "trigger" && (
              <div className="space-y-3">
                <div>
                  <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                    Tipo de gatilho
                  </FieldLabel>
                  <FilterSelect
                    icon={RefreshCcw}
                    size="sm"
                    value={selectedNode.data.triggerType ?? "lead_created"}
                    onChange={(value) => {
                      const triggerType = value as
                        | "lead_created"
                        | "status_changed"
                        | "status_duration"
                        | "inactivity_duration";
                      const label =
                        triggerType === "lead_created"
                          ? "Lead criado"
                          : triggerType === "status_changed"
                            ? "Mudança de status"
                            : triggerType === "status_duration"
                              ? "Tempo em status"
                              : "Tempo sem interação";
                      updateSelectedNode({
                        triggerType,
                        label,
                        triggerStatuses:
                          triggerType !== "lead_created"
                            ? (selectedNode.data.triggerStatuses ?? [])
                            : [],
                        triggerDurationHours:
                          triggerType === "status_duration" || triggerType === "inactivity_duration"
                            ? (selectedNode.data.triggerDurationHours ?? 24)
                            : 24,
                      });
                    }}
                    placeholder="Tipo de gatilho"
                    includePlaceholderOption={false}
                    options={[
                      { value: "lead_created", label: "Lead criado" },
                      { value: "status_changed", label: "Mudança de status" },
                      { value: "status_duration", label: "Tempo em status" },
                      { value: "inactivity_duration", label: "Tempo sem interação" },
                    ]}
                  />
                </div>

                {(selectedNode.data.triggerType === "status_changed" ||
                  selectedNode.data.triggerType === "status_duration" ||
                  selectedNode.data.triggerType === "inactivity_duration") && (
                  <Field
                    label="Status do lead"
                    hint={selectedNode.data.triggerType === "inactivity_duration"
                      ? "Selecione os status monitorados pela régua"
                      : "Selecione um ou mais status"}
                  >
                    <MultiSelect
                      options={leadStatuses
                        .filter((s) => s.ativo !== false)
                        .map((status) => ({
                          value: status.nome,
                          label: status.nome,
                        }))}
                      values={selectedNode.data.triggerStatuses ?? []}
                      onChange={(selected) =>
                        updateSelectedNode({ triggerStatuses: selected })
                      }
                      placeholder="Selecione os status..."
                      aria-label="Status do lead"
                    />
                  </Field>
                )}

                {(selectedNode.data.triggerType === "status_duration" ||
                  selectedNode.data.triggerType === "inactivity_duration") && (
                  <div>
                    <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                      {selectedNode.data.triggerType === "inactivity_duration"
                        ? "Tempo sem interação (horas)"
                        : "Tempo no status (horas)"}
                    </FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      value={selectedNode.data.triggerDurationHours ?? 24}
                      onChange={(event) =>
                        updateSelectedNode({
                          triggerDurationHours: Number(event.target.value),
                        })
                      }
                      size="sm"
                    />
                    <div className="mt-1 text-xs text-[var(--text-subtle)]">
                      {selectedNode.data.triggerType === "inactivity_duration"
                        ? "Mínimo de 1 hora. Uma resposta do cliente cancela a régua."
                        : "O fluxo será executado quando o lead estiver há mais de X horas neste(s) status"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedNode.type === "condition" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>Aplicar quando</span>
                  <div className="w-40">
                    <FilterSelect
                      icon={RefreshCcw}
                      size="sm"
                      value={selectedNode.data.conditionLogic ?? "all"}
                      onChange={(value) =>
                        updateSelectedNode({
                          conditionLogic: value === "any" ? "any" : "all",
                        })
                      }
                      placeholder="Lógica"
                      includePlaceholderOption={false}
                      options={[
                        { value: "all", label: "todas as condições" },
                        { value: "any", label: "qualquer condicao" },
                      ]}
                    />
                  </div>
                </div>
                {(selectedNode.data.conditions ?? []).map(
                  (condition, index) => {
                    const valueOptions = getConditionValueOptions(
                      condition.field,
                    );
                    return (
                      <div
                        key={condition.id}
                          className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-3"
                      >
                        <FilterSelect
                          icon={RefreshCcw}
                          size="sm"
                          value={condition.field}
                          onChange={(value) => {
                            const nextField =
                              value as AutoContactFlowCondition["field"];
                            const next =
                              nextField === "event"
                                ? {
                                    field: nextField,
                                    operator:
                                      "equals" as AutoContactFlowConditionOperator,
                                    value: "lead_created",
                                  }
                                : nextField === "whatsapp_valid"
                                  ? {
                                      field: nextField,
                                      operator:
                                        "equals" as AutoContactFlowConditionOperator,
                                      value: "true",
                                    }
                                  : { field: nextField, value: "" };
                            const nextConditions = [
                              ...(selectedNode.data.conditions ?? []),
                            ];
                            nextConditions[index] = { ...condition, ...next };
                            updateSelectedNode({ conditions: nextConditions });
                          }}
                          placeholder="Campo"
                          includePlaceholderOption={false}
                          options={conditionFieldOptions.map(
                            ([value, label]) => ({
                              value,
                              label,
                            }),
                          )}
                        />
                        <FilterSelect
                          icon={RefreshCcw}
                          size="sm"
                          value={condition.operator}
                          onChange={(value) => {
                            const nextConditions = [
                              ...(selectedNode.data.conditions ?? []),
                            ];
                            nextConditions[index] = {
                              ...condition,
                              operator:
                                value as AutoContactFlowConditionOperator,
                            };
                            updateSelectedNode({ conditions: nextConditions });
                          }}
                          placeholder="Operador"
                          includePlaceholderOption={false}
                          options={Object.entries(conditionOperatorLabels).map(
                            ([value, label]) => ({
                              value,
                              label,
                            }),
                          )}
                        />
                        {BOOLEAN_FIELDS.includes(condition.field) ? (
                          <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-xs text-[var(--text-muted)]">
                            Use as conexões{" "}
                            <span className="font-semibold">Sim/Não</span> para
                            definir o fluxo quando a condição for verdadeira ou
                            falsa.
                          </div>
                        ) : (
                          <>
                            {valueOptions ? (
                              <FilterSelect
                                icon={RefreshCcw}
                                size="sm"
                                value={condition.value}
                                onChange={(value) => {
                                  const nextConditions = [
                                    ...(selectedNode.data.conditions ?? []),
                                  ];
                                  nextConditions[index] = {
                                    ...condition,
                                    value,
                                  };
                                  updateSelectedNode({
                                    conditions: nextConditions,
                                  });
                                }}
                                placeholder="Selecione"
                                includePlaceholderOption={false}
                                options={[
                                  { value: "", label: "Selecione" },
                                  ...valueOptions.map((option) => ({
                                    value: option,
                                    label: getConditionOptionLabel(
                                      condition.field,
                                      option,
                                    ),
                                  })),
                                ]}
                              />
                            ) : (
                              <Input
                                type="text"
                                value={condition.value}
                                onChange={(event) => {
                                  const nextConditions = [
                                    ...(selectedNode.data.conditions ?? []),
                                  ];
                                  nextConditions[index] = {
                                    ...condition,
                                    value: event.target.value,
                                  };
                                  updateSelectedNode({
                                    conditions: nextConditions,
                                  });
                                }}
                                size="sm"
                              />
                            )}
                          </>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[var(--text-subtle)]">
                            Condicao {index + 1}
                          </span>
                          <Button
                            onClick={() => {
                              const nextConditions = [
                                ...(selectedNode.data.conditions ?? []),
                              ];
                              nextConditions.splice(index, 1);
                              updateSelectedNode({
                                conditions: nextConditions,
                              });
                            }}
                            variant="danger"
                            size="sm"
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    );
                  },
                )}
                <Button
                  onClick={() => {
                    const nextConditions = [
                      ...(selectedNode.data.conditions ?? []),
                    ];
                    nextConditions.push({
                      id: createId("condition"),
                      field: "status",
                      operator: "equals",
                      value: "",
                    });
                    updateSelectedNode({ conditions: nextConditions });
                  }}
                  variant="secondary"
                  size="sm"
                  fullWidth
                >
                  + Adicionar condição
                </Button>
                <div className="text-xs text-[var(--text-subtle)]">
                  Use formulas iniciando com '=' (ex.:
                  =len(lead.telefone)&gt;10).
                </div>
                <Button
                  onClick={addConditionAfterSelected}
                  variant="secondary"
                  size="sm"
                  fullWidth
                >
                  + Condição abaixo
                </Button>
                <Button
                  onClick={() => {
                    setEdges((current) =>
                      current.filter(
                        (edge) =>
                          edge.source !== selectedNode.id &&
                          edge.target !== selectedNode.id,
                      ),
                    );
                    setNodes((current) =>
                      current.filter((node) => node.id !== selectedNode.id),
                    );
                    setSelectedNodeId(null);
                  }}
                  variant="danger"
                  size="sm"
                  fullWidth
                >
                  Remover bloco de condição
                </Button>
              </div>
            )}

            {selectedNode.type === "action" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                      Esperar
                    </FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={selectedNode.data.step?.delayValue ?? 0}
                      onChange={(event) =>
                        updateSelectedStep({
                          delayValue: Number(event.target.value),
                        })
                      }
                      size="sm"
                    />
                  </div>
                  <div>
                    <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                      Unidade
                    </FieldLabel>
                    <FilterSelect
                      icon={RefreshCcw}
                      size="sm"
                      value={selectedNode.data.step?.delayUnit ?? "hours"}
                      onChange={(value) =>
                        updateSelectedStep({
                          delayUnit: value as AutoContactDelayUnit,
                        })
                      }
                      placeholder="Unidade"
                      includePlaceholderOption={false}
                      options={Object.entries(delayUnitLabels).map(
                        ([value, label]) => ({
                          value,
                          label: label.plural,
                        }),
                      )}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <FieldLabel className="block text-xs text-[var(--text-muted)]">
                      Fórmula de espera (opcional)
                    </FieldLabel>
                    <Button
                      onClick={() =>
                        updateSelectedStep({
                          delayExpression: selectedNode.data.step
                            ?.delayExpression
                            ? ""
                            : "=1",
                        })
                      }
                      variant="ghost"
                      size="sm"
                    >
                      {selectedNode.data.step?.delayExpression
                        ? "Remover fórmula"
                        : "Usar fórmula"}
                    </Button>
                  </div>
                  {selectedNode.data.step?.delayExpression && (
                    <Input
                      type="text"
                      value={selectedNode.data.step.delayExpression}
                      onChange={(event) =>
                        updateSelectedStep({
                          delayExpression: event.target.value,
                        })
                      }
                      size="sm"
                      placeholder="=if(len(lead.telefone)>10, 2, 6)"
                    />
                  )}
                  <div className="mt-1 text-xs text-[var(--text-subtle)]">
                    Ex.: =if(len(lead.telefone)&gt;10, 2, 6)
                  </div>
                  {delayPreview && (
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Preview: {delayPreview}
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                    Tipo de ação
                  </FieldLabel>
                  <FilterSelect
                    icon={RefreshCcw}
                    size="sm"
                    value={selectedNode.data.step?.actionType ?? "send_message"}
                    onChange={(value) =>
                      updateSelectedStep({
                        actionType: value as AutoContactFlowActionType,
                      })
                    }
                    placeholder="Tipo de ação"
                    includePlaceholderOption={false}
                    options={Object.entries(flowActionLabels).map(
                      ([value, label]) => ({
                        value,
                        label,
                      }),
                    )}
                  />
                </div>

                {selectedNode.data.step?.actionType === "send_message" && (
                  <div className="space-y-3">
                    <div className="text-xs text-[var(--text-muted)]">
                      Canal ativo: WhatsApp (configurado em Integrações). Cada
                      item abaixo é enviado como uma mensagem própria, em
                      ordem.
                    </div>
                    <MessageVariationsEditor
                      step={selectedNode.data.step}
                      messageTemplates={messageTemplates}
                      onUpdate={updateSelectedStep}
                      onPreviewAiMessage={(instruction, itemIndex) =>
                        onPreviewAiMessage?.({
                          stepId: selectedNode.data.step?.id ?? "",
                          itemIndex,
                          instruction,
                        }) ?? Promise.reject(new Error("Prévia de IA indisponível."))
                      }
                    />
                  </div>
                )}

                {selectedNode.data.step?.actionType === "update_status" && (
                  <div>
                    <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                      Status do lead
                    </FieldLabel>
                    <FilterSelect
                      icon={RefreshCcw}
                      size="sm"
                      value={selectedNode.data.step?.statusToSet ?? ""}
                      onChange={(value) =>
                        updateSelectedStep({ statusToSet: value })
                      }
                      placeholder="Selecione um status"
                      includePlaceholderOption={false}
                      options={[
                        { value: "", label: "Selecione um status" },
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

                {selectedNode.data.step?.actionType === "create_task" && (
                  <div className="space-y-2">
                    <div>
                      <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                        Título
                      </FieldLabel>
                      <Input
                        type="text"
                        value={selectedNode.data.step?.taskTitle ?? ""}
                        onChange={(event) =>
                          updateSelectedStep({ taskTitle: event.target.value })
                        }
                        size="sm"
                      />
                    </div>
                    <div>
                      <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                        Descrição
                      </FieldLabel>
                      <VariableAutocompleteTextarea
                        value={selectedNode.data.step?.taskDescription ?? ""}
                        onChange={(value) =>
                          updateSelectedStep({ taskDescription: value })
                        }
                        rows={3}
                        size="sm"
                        suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                          Vencimento (h)
                        </FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          value={selectedNode.data.step?.taskDueHours ?? ""}
                          onChange={(event) =>
                            updateSelectedStep({
                              taskDueHours: Number(event.target.value),
                            })
                          }
                          size="sm"
                        />
                      </div>
                      <div>
                        <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                          Prioridade
                        </FieldLabel>
                        <FilterSelect
                          icon={RefreshCcw}
                          size="sm"
                          value={
                            selectedNode.data.step?.taskPriority ?? "normal"
                          }
                          onChange={(value) =>
                            updateSelectedStep({
                              taskPriority:
                                value as AutoContactFlowStep["taskPriority"],
                            })
                          }
                          placeholder="Prioridade"
                          includePlaceholderOption={false}
                          options={[
                            { value: "baixa", label: "Baixa" },
                            { value: "normal", label: "Normal" },
                            { value: "alta", label: "Alta" },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.data.step?.actionType === "send_email" && (
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--text-muted)]">
                      Envio depende de conta configurada em Integrações de
                      e-mail.
                    </div>
                    <div>
                      <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                        Para
                      </FieldLabel>
                      <Input
                        type="text"
                        value={selectedNode.data.step?.emailTo ?? ""}
                        onChange={(event) =>
                          updateSelectedStep({ emailTo: event.target.value })
                        }
                        size="sm"
                      />
                    </div>
                    <div>
                      <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                        Assunto
                      </FieldLabel>
                      <Input
                        type="text"
                        value={selectedNode.data.step?.emailSubject ?? ""}
                        onChange={(event) =>
                          updateSelectedStep({
                            emailSubject: event.target.value,
                          })
                        }
                        size="sm"
                      />
                    </div>
                    <div>
                      <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                        Corpo
                      </FieldLabel>
                      <VariableAutocompleteTextarea
                        value={selectedNode.data.step?.emailBody ?? ""}
                        onChange={(value) =>
                          updateSelectedStep({ emailBody: value })
                        }
                        rows={3}
                        size="sm"
                        suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.step?.actionType === "webhook" && (
                  <div className="space-y-2">
                    <Text className="text-xs text-[var(--text-muted)] md:col-span-2">Esta etapa conecta outro sistema. Peça ao responsável pela integração os dados abaixo.</Text>
                    <div>
                      <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                        Endereço do serviço
                      </FieldLabel>
                      <Input
                        type="text"
                        value={selectedNode.data.step?.webhookUrl ?? ""}
                        onChange={(event) =>
                          updateSelectedStep({ webhookUrl: event.target.value })
                        }
                        size="sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                          Método
                        </FieldLabel>
                        <FilterSelect
                          icon={RefreshCcw}
                          size="sm"
                          value={
                            selectedNode.data.step?.webhookMethod ?? "POST"
                          }
                          onChange={(value) =>
                            updateSelectedStep({
                              webhookMethod:
                                value as AutoContactFlowStep["webhookMethod"],
                            })
                          }
                          placeholder="Método"
                          includePlaceholderOption={false}
                          options={[
                            { value: "POST", label: "POST" },
                            { value: "PUT", label: "PUT" },
                            { value: "PATCH", label: "PATCH" },
                            { value: "GET", label: "GET" },
                          ]}
                        />
                      </div>
                      <div>
                        <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                          Cabeçalhos da conexão (JSON)
                        </FieldLabel>
                        <Input
                          type="text"
                          value={selectedNode.data.step?.webhookHeaders ?? ""}
                          onChange={(event) =>
                            updateSelectedStep({
                              webhookHeaders: event.target.value,
                            })
                          }
                          size="sm"
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel className="mb-1 block text-xs text-[var(--text-muted)]">
                        Dados enviados
                      </FieldLabel>
                      <VariableAutocompleteTextarea
                        value={selectedNode.data.step?.webhookBody ?? ""}
                        onChange={(value) =>
                          updateSelectedStep({ webhookBody: value })
                        }
                        rows={3}
                        size="sm"
                        suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.step?.actionType ===
                  "activate_autonomous_service" && (
                  <div className="rounded-lg border border-[var(--brand-primary-border)] bg-[color:var(--brand-primary-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                    A partir desta etapa, a IA (Luiza) passa a responder
                    sozinha nesse chat, fazendo a qualificação do lead — nunca
                    monta cotação. Ao final ela encerra o atendimento autônomo
                    e o status do lead é atualizado automaticamente. Nenhum
                    outro chat é afetado.
                  </div>
                )}
              </div>
            )}
          </DrawerBody>
          <DrawerFooter>
            {selectedNode.type !== "trigger" && <Button variant="danger" onClick={() => handleDeleteNode(selectedNode.id)}>Remover etapa</Button>}
            <Button onClick={finishEditingNode}>Concluir edição</Button>
          </DrawerFooter>
        </Drawer>
      )}
    </div>
  );
}
