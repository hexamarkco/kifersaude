import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlarmClock,
  AlertCircle,
  BarChart3,
  ClipboardList,
  Edit3,
  File,
  Film,
  Globe2,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Tag,
  Timer,
  Trash2,
} from "lucide-react";

import { configService } from "../../../lib/configService";
import { useConfig } from "../../../contexts/ConfigContext";
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  composeTemplateMessage,
  buildAutoContactScheduleTimeline,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_AUTO_CONTACT_FLOWS,
  getTemplateMessages,
  normalizeAutoContactSettings,
  type AutoContactDelayUnit,
  type AutoContactScheduleAdjustmentReason,
  type AutoContactFlow,
  type AutoContactFlowActionType,
  type AutoContactFlowCondition,
  type AutoContactFlowGraph,
  type AutoContactFlowMessageSource,
  type AutoContactFlowStep,
  type AutoContactFlowCustomMessage,
  type AutoContactLoggingSettings,
  type AutoContactMonitoringSettings,
  type AutoContactSchedulingSettings,
  type AutoContactSettings,
  type AutoContactTemplate,
  type TemplateMessage,
  type TemplateMessageType,
} from "../../../lib/autoContactService";
import { AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS } from "../../../lib/templateVariableSuggestions";
import {
  applyFlowGraphToFlow,
  buildFlowGraphFromFlow,
  expandFlowGraphToFlows,
} from "../../../lib/autoContactFlowGraph";
import { supabase } from "../../../lib/supabase";
import type {
  IntegrationSetting,
  LeadStatusConfig,
  Lead,
} from "../../../lib/supabase";
import FlowBuilder from "./components/FlowBuilder";
import FilterSingleSelect from "../../../components/FilterSingleSelect";
import DateTimePicker from "../../../components/ui/DateTimePicker";
import ModalShell from "../../../components/ui/ModalShell";
import Button from "../../../components/ui/Button";
import Checkbox from "../../../components/ui/Checkbox";
import Input from "../../../components/ui/Input";
import VariableAutocompleteTextarea from "../../../components/ui/VariableAutocompleteTextarea";
import { AutomationFlowsSkeleton } from "../../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";

type MessageState = {
  type: "success" | "error" | "warning";
  text: string;
} | null;
type TemplateDraft = {
  id: string;
  name: string;
  messages: TemplateMessage[];
};

export default function AutoContactFlowSettingsScreen() {
  const { leadOrigins, options } = useConfig();
  const [autoContactIntegration, setAutoContactIntegration] =
    useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] =
    useState<AutoContactSettings | null>(null);
  const [messageTemplatesDraft, setMessageTemplatesDraft] = useState<
    AutoContactTemplate[]
  >(DEFAULT_MESSAGE_TEMPLATES);
  const [flowDrafts, setFlowDrafts] = useState<AutoContactFlow[]>(
    DEFAULT_AUTO_CONTACT_FLOWS,
  );
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const defaultSettings = useMemo(() => normalizeAutoContactSettings(null), []);
  const [autoSendEnabled, setAutoSendEnabled] = useState(
    defaultSettings.autoSend,
  );
  const [schedulingDraft, setSchedulingDraft] =
    useState<AutoContactSchedulingSettings>(defaultSettings.scheduling);
  const [monitoringDraft, setMonitoringDraft] =
    useState<AutoContactMonitoringSettings>(defaultSettings.monitoring);
  const [loggingDraft, setLoggingDraft] = useState<AutoContactLoggingSettings>(
    defaultSettings.logging,
  );
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusConfig[]>([]);
  const [loadingFlow, setLoadingFlow] = useState(true);
  const loadingUi = useAdaptiveLoading(loadingFlow);
  const [savingFlow, setSavingFlow] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [statusMessage, setStatusMessage] = useState<MessageState>(null);
  const [autoSaveState, setAutoSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(
    null,
  );
  const [flowSearch, setFlowSearch] = useState("");
  const [flowTagFilter, setFlowTagFilter] = useState("all");
  const [tagDraft, setTagDraft] = useState("");
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationStart, setSimulationStart] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState(() => new Date());
  const [dailyAutomationCount, setDailyAutomationCount] = useState<
    number | null
  >(null);
  const [dailyAutomationLoading, setDailyAutomationLoading] = useState(false);
  const [dailyAutomationError, setDailyAutomationError] = useState<
    string | null
  >(null);
  const [flowEditorMode] = useState<"basic" | "advanced">("advanced");
  const autoSaveReadyRef = useRef(false);
  const autoSaveSkipRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const timezoneOptions = useMemo(
    () => [
      { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
      { value: "America/Manaus", label: "Manaus (UTC-4)" },
      { value: "America/Cuiaba", label: "Cuiabá (UTC-4)" },
      { value: "America/Rio_Branco", label: "Rio Branco (UTC-5)" },
      { value: "UTC", label: "UTC (padrão global)" },
    ],
    [],
  );

  useEffect(() => {
    void loadAutoContactSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAutoContactSettings = async () => {
    setLoadingFlow(true);
    setStatusMessage(null);

    const [integration, statusConfig] = await Promise.all([
      configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG),
      configService.getLeadStatusConfig(),
    ]);
    const normalized = normalizeAutoContactSettings(integration?.settings);

    setAutoContactIntegration(integration);
    setAutoContactSettings(normalized);
    setAutoSendEnabled(normalized.autoSend);
    setMessageTemplatesDraft(normalized.messageTemplates ?? []);
    const normalizedFlows = normalized.flows ?? [];
    setFlowDrafts(filterDerivedFlows(normalizedFlows));
    setSchedulingDraft(normalized.scheduling);
    setMonitoringDraft(normalized.monitoring);
    setLoggingDraft(normalized.logging);
    setLeadStatuses(statusConfig);

    setLoadingFlow(false);
  };

  const loadDailyAutomationCount = useCallback(async () => {
    setDailyAutomationLoading(true);
    setDailyAutomationError(null);

    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const startOfNextDay = new Date(startOfDay);
      startOfNextDay.setDate(startOfNextDay.getDate() + 1);

      const { count, error } = await supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "Mensagem Automática")
        .gte("data_interacao", startOfDay.toISOString())
        .lt("data_interacao", startOfNextDay.toISOString());

      if (error) {
        throw error;
      }

      setDailyAutomationCount(count ?? 0);
    } catch (error) {
      console.error("Erro ao carregar contador diário de automações:", error);
      setDailyAutomationError("Não foi possível carregar o contador diário.");
    } finally {
      setDailyAutomationLoading(false);
    }
  }, []);

  const createMessageDraft = (
    type: TemplateMessageType = "text",
  ): TemplateMessage => ({
    id: `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    text: "",
    mediaUrl: "",
    caption: "",
  });

  const openTemplateModal = (
    mode: "create" | "edit",
    template?: AutoContactTemplate | null,
  ) => {
    const draftMessages = template ? getTemplateMessages(template) : [];
    const normalizedMessages =
      draftMessages.length > 0 ? draftMessages : [createMessageDraft()];
    setTemplateDraft({
      id: template?.id ?? `template-${Date.now()}`,
      name: template?.name ?? "",
      messages: normalizedMessages,
    });
    setTemplateModalMode(mode);
    setIsTemplateModalOpen(true);
  };

  const handleAddTemplate = () => {
    openTemplateModal("create");
  };

  const handleEditTemplate = (templateId: string) => {
    const template = messageTemplatesDraft.find(
      (item) => item.id === templateId,
    );
    if (!template) return;
    openTemplateModal("edit", template);
  };

  const handleUpdateTemplateDraft = (updates: Partial<TemplateDraft>) => {
    setTemplateDraft((previous) =>
      previous ? { ...previous, ...updates } : previous,
    );
  };

  const handleUpdateDraftMessage = (
    messageId: string,
    updates: Partial<TemplateMessage>,
  ) => {
    setTemplateDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        messages: previous.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...updates,
              }
            : message,
        ),
      };
    });
  };

  const handleAddDraftMessage = (type: TemplateMessageType = "text") => {
    setTemplateDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        messages: [...previous.messages, createMessageDraft(type)],
      };
    });
  };

  const handleRemoveDraftMessage = (messageId: string) => {
    setTemplateDraft((previous) => {
      if (!previous) return previous;
      const nextMessages = previous.messages.filter(
        (message) => message.id !== messageId,
      );
      return {
        ...previous,
        messages: nextMessages.length ? nextMessages : [createMessageDraft()],
      };
    });
  };

  const normalizeTemplatesForSettings = (
    templates: AutoContactTemplate[],
    filterEmpty = false,
  ) => {
    const normalizedTemplates = templates.map((template, index) => {
      const templateId = template.id || `template-${index}`;
      const normalizedMessages = getTemplateMessages({
        ...template,
        id: templateId,
      }).map((message, messageIndex) => ({
        id: message.id?.trim()
          ? message.id
          : `message-${templateId}-${messageIndex}`,
        type: message.type,
        text: message.text ?? "",
        mediaUrl: message.mediaUrl ?? "",
        caption: message.caption ?? "",
      }));
      const composedMessage = composeTemplateMessage(normalizedMessages);
      const hasContent = normalizedMessages.some(
        (message) =>
          message.text?.trim() ||
          message.caption?.trim() ||
          message.mediaUrl?.trim(),
      );

      return {
        id: templateId,
        name: template.name?.trim() || `Modelo ${index + 1}`,
        messages: normalizedMessages,
        message: composedMessage,
        hasContent,
      };
    });

    const filteredTemplates = filterEmpty
      ? normalizedTemplates.filter(
          (template) => template.message.trim() || template.hasContent,
        )
      : normalizedTemplates;

    return filteredTemplates.map(
      ({ hasContent: _hasContent, ...template }) => template,
    );
  };

  const handleSaveTemplateDraft = async () => {
    if (!templateDraft) return;
    const normalizedMessages = templateDraft.messages.map((message, index) => ({
      id: message.id?.trim()
        ? message.id
        : `message-${templateDraft.id}-${index}`,
      type: message.type,
      text: message.text ?? "",
      mediaUrl: message.mediaUrl ?? "",
      caption: message.caption ?? "",
    }));
    const composedMessage = composeTemplateMessage(normalizedMessages);
    const newTemplate: AutoContactTemplate = {
      id: templateDraft.id,
      name: templateDraft.name,
      messages: normalizedMessages,
      message: composedMessage,
    };

    const rawTemplates =
      templateModalMode === "edit"
        ? messageTemplatesDraft.map((template) =>
            template.id === newTemplate.id ? newTemplate : template,
          )
        : [...messageTemplatesDraft, newTemplate];
    const normalizedTemplates = normalizeTemplatesForSettings(rawTemplates);
    setMessageTemplatesDraft(normalizedTemplates);
    setIsTemplateModalOpen(false);
    setTemplateDraft(null);

    if (!autoContactIntegration) {
      setStatusMessage({
        type: "error",
        text: "Integração de automação não configurada.",
      });
      return;
    }

    setSavingTemplate(true);
    setStatusMessage(null);

    const currentSettings =
      autoContactSettings || normalizeAutoContactSettings(null);
    const newSettings = {
      ...currentSettings,
      autoSend: autoSendEnabled,
      messageTemplates: normalizedTemplates,
    };

    const { data, error } = await configService.updateIntegrationSetting(
      autoContactIntegration.id,
      {
        settings: newSettings,
      },
    );

    if (error) {
      setStatusMessage({
        type: "error",
        text: "Erro ao salvar o template. Tente novamente.",
      });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(
        updatedIntegration.settings,
      );

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      autoSaveSkipRef.current = true;
      setAutoSendEnabled(normalized.autoSend);
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      setStatusMessage({
        type: "success",
        text: "Template salvo no banco de dados.",
      });
    }

    setSavingTemplate(false);
  };

  const handleCloseTemplateModal = () => {
    setIsTemplateModalOpen(false);
    setTemplateDraft(null);
  };

  const handleRemoveTemplate = (templateId: string) => {
    setMessageTemplatesDraft((previous) => {
      return previous.filter((template) => template.id !== templateId);
    });
  };

  const filterDerivedFlows = useCallback((flows: AutoContactFlow[]) => {
    const ids = new Set(flows.map((flow) => flow.id));
    return flows.filter((flow) => {
      if (flow.id.endsWith("-nao")) {
        const baseId = flow.id.replace(/-nao$/, "");
        return !ids.has(baseId);
      }
      if (flow.name?.includes("(Nao)")) {
        const baseId = flow.id.replace(/-nao$/, "");
        return !ids.has(baseId);
      }
      return true;
    });
  }, []);

  const handleSaveFlow = async () => {
    if (!autoContactIntegration) {
      setStatusMessage({
        type: "error",
        text: "Integração de automação não configurada.",
      });
      return;
    }

    setSavingFlow(true);
    setStatusMessage(null);

    const sanitizedTemplates = normalizeTemplatesForSettings(
      messageTemplatesDraft,
      true,
    );
    const fallbackTemplateId = sanitizedTemplates[0]?.id ?? "";
    const sanitizedFlows = flowDrafts
      .flatMap((flow, flowIndex) => {
        const expandedFlows = flow.flowGraph
          ? expandFlowGraphToFlows(flow)
          : [flow];

        return expandedFlows.map((expandedFlow, expandedIndex) => {
          const flowKey =
            expandedIndex > 0
              ? `${flowIndex}-${expandedIndex}`
              : `${flowIndex}`;
          const effectiveFlow = expandedFlow;
          const steps = effectiveFlow.steps
            .map((step, stepIndex) => {
              const stepWithLegacyDelay = step as AutoContactFlowStep & {
                delayHours?: number;
              };
              const rawDelay = Number(
                stepWithLegacyDelay.delayValue ??
                  stepWithLegacyDelay.delayHours,
              );
              const delayValue =
                Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay : 0;
              const delayUnit: AutoContactDelayUnit = step.delayUnit ?? "hours";
              const actionType = (step.actionType ??
                "send_message") as AutoContactFlowActionType;
              const messageSource = (step.messageSource ??
                "template") as AutoContactFlowMessageSource;
              const templateId =
                sanitizedTemplates.find(
                  (template) => template.id === step.templateId,
                )?.id ?? fallbackTemplateId;
              const customMessage: AutoContactFlowCustomMessage = {
                type: step.customMessage?.type ?? "text",
                text: step.customMessage?.text ?? "",
                mediaUrl: step.customMessage?.mediaUrl ?? "",
                caption: step.customMessage?.caption ?? "",
                filename: step.customMessage?.filename ?? "",
              };

              return {
                id: step.id?.trim()
                  ? step.id
                  : `flow-${flow.id}-step-${stepIndex}`,
                delayValue,
                delayUnit,
                delayExpression: step.delayExpression?.trim() || undefined,
                actionType,
                messageSource,
                templateId,
                customMessage,
                statusToSet: step.statusToSet?.trim() || "",
                webhookUrl: step.webhookUrl?.trim() || "",
                webhookMethod: step.webhookMethod ?? "POST",
                webhookHeaders: step.webhookHeaders?.trim() || "",
                webhookBody: step.webhookBody?.trim() || "",
                taskTitle: step.taskTitle?.trim() || "",
                taskDescription: step.taskDescription?.trim() || "",
                taskDueHours: Number.isFinite(Number(step.taskDueHours))
                  ? Number(step.taskDueHours)
                  : undefined,
                taskPriority: step.taskPriority ?? "normal",
                emailTo: step.emailTo?.trim() || "",
                emailCc: step.emailCc?.trim() || "",
                emailBcc: step.emailBcc?.trim() || "",
                emailSubject: step.emailSubject?.trim() || "",
                emailBody: step.emailBody?.trim() || "",
              };
            })
            .filter((step) => step.delayValue >= 0);
          const conditions = (effectiveFlow.conditions ?? [])
            .map((condition, conditionIndex) => ({
              id: condition.id?.trim()
                ? condition.id
                : `flow-${flow.id}-condition-${conditionIndex}`,
              field: condition.field,
              operator: condition.operator,
              value: condition.value?.trim() || "",
            }))
            .filter((condition) => condition.value);
          const exitConditions = (effectiveFlow.exitConditions ?? [])
            .map((condition, conditionIndex) => ({
              id: condition.id?.trim()
                ? condition.id
                : `flow-${flow.id}-exit-condition-${conditionIndex}`,
              field: condition.field,
              operator: condition.operator,
              value: condition.value?.trim() || "",
            }))
            .filter((condition) => condition.value);
          const tags = (effectiveFlow.tags ?? [])
            .map((tag) => tag.trim())
            .filter(Boolean);
          const fallbackScheduling = {
            startHour: schedulingDraft.startHour,
            endHour: schedulingDraft.endHour,
            allowedWeekdays: schedulingDraft.allowedWeekdays,
            dailySendLimit: null,
          };
          const flowScheduling = effectiveFlow.scheduling ?? fallbackScheduling;
          const allowedWeekdays = Array.isArray(flowScheduling.allowedWeekdays)
            ? flowScheduling.allowedWeekdays
                .map((value) => Number(value))
                .filter(
                  (value) => Number.isFinite(value) && value >= 1 && value <= 7,
                )
            : fallbackScheduling.allowedWeekdays;
          const rawFlowDailySendLimit = Number(flowScheduling.dailySendLimit);
          const flowDailySendLimit =
            Number.isFinite(rawFlowDailySendLimit) && rawFlowDailySendLimit > 0
              ? Math.floor(rawFlowDailySendLimit)
              : null;

          return {
            id: effectiveFlow.id?.trim() ? effectiveFlow.id : `flow-${flowKey}`,
            name: effectiveFlow.name?.trim() || `Fluxo ${flowIndex + 1}`,
            triggerStatus: effectiveFlow.triggerStatus?.trim() || "",
            triggerType: effectiveFlow.triggerType ?? "lead_created",
            triggerStatuses: Array.isArray(effectiveFlow.triggerStatuses)
              ? effectiveFlow.triggerStatuses.filter(
                  (status) => typeof status === "string" && status.trim(),
                )
              : [],
            triggerDurationHours: Number.isFinite(
              Number(effectiveFlow.triggerDurationHours),
            )
              ? Number(effectiveFlow.triggerDurationHours)
              : 24,
            steps,
            finalStatus: effectiveFlow.finalStatus?.trim() || "",
            invalidNumberAction: effectiveFlow.invalidNumberAction ?? "none",
            invalidNumberStatus:
              effectiveFlow.invalidNumberStatus?.trim() || "",
            conditionLogic:
              effectiveFlow.conditionLogic === "any" ? "any" : "all",
            conditions,
            exitConditionLogic:
              effectiveFlow.exitConditionLogic === "all" ? "all" : "any",
            exitConditions,
            tags,
            scheduling: {
              startHour:
                flowScheduling.startHour || fallbackScheduling.startHour,
              endHour: flowScheduling.endHour || fallbackScheduling.endHour,
              allowedWeekdays,
              dailySendLimit: flowDailySendLimit,
            },
            flowGraph: effectiveFlow.flowGraph,
          };
        });
      })
      .filter((flow) => flow.steps.length);

    const currentSettings =
      autoContactSettings || normalizeAutoContactSettings(null);
    const newSettings = {
      ...currentSettings,
      autoSend: autoSendEnabled,
      messageTemplates: sanitizedTemplates,
      flows: sanitizedFlows,
      scheduling: schedulingDraft,
      monitoring: monitoringDraft,
      logging: loggingDraft,
    };

    const { data, error } = await configService.updateIntegrationSetting(
      autoContactIntegration.id,
      {
        settings: newSettings,
      },
    );

    if (error) {
      setStatusMessage({
        type: "error",
        text: "Erro ao salvar a configuração. Tente novamente.",
      });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(
        updatedIntegration.settings,
      );

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      autoSaveSkipRef.current = true;
      setAutoSendEnabled(normalized.autoSend);
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      setFlowDrafts(filterDerivedFlows(normalized.flows ?? []));
      setSchedulingDraft(normalized.scheduling);
      setMonitoringDraft(normalized.monitoring);
      setLoggingDraft(normalized.logging);
      setStatusMessage({
        type: "success",
        text: "Fluxos e templates de automação salvos com sucesso.",
      });
    }

    setSavingFlow(false);
  };

  const conditionFieldLabels: Record<
    AutoContactFlowCondition["field"],
    string
  > = {
    origem: "Origem do lead",
    cidade: "Cidade",
    responsavel: "Responsável",
    status: "Status atual",
    tag: "Tag do lead",
    canal: "Canal de aquisição",
    whatsapp_valid: "WhatsApp válido?",
    event: "Evento",
    estado: "Estado (UF)",
    regiao: "Região",
    tipo_contratacao: "Tipo de contratação",
    operadora_atual: "Operadora atual",
    email: "E-mail",
    telefone: "Telefone",
    data_criacao: "Data de criação",
    lead_criado: "Lead criado",
    ultimo_contato: "Último contato",
    proximo_retorno: "Próximo retorno",
    lead_created: "Evento",
  };
  const conditionFieldOptions = Object.entries(conditionFieldLabels).filter(
    ([value]) => value !== "lead_created",
  );
  const eventValueLabels: Record<string, string> = {
    lead_created: "Lead criado",
  };
  const booleanValueLabels: Record<string, string> = {
    true: "Sim",
    false: "Não",
  };
  const conditionOperatorLabels: Record<
    AutoContactFlowCondition["operator"],
    string
  > = {
    equals: "É igual a",
    contains: "Contém",
    not_equals: "Não é igual",
    not_contains: "Não contém",
    starts_with: "Começa com",
    ends_with: "Termina com",
    in_list: "Está em",
    not_in_list: "Não está em",
    greater_than: "Maior que",
    greater_or_equal: "Maior ou igual",
    less_than: "Menor que",
    less_or_equal: "Menor ou igual",
  };
  const isEventLeadCreated = (condition: AutoContactFlowCondition) =>
    condition.field === "lead_created" ||
    (condition.field === "event" && condition.value === "lead_created");
  const getConditionValueLabel = (condition: AutoContactFlowCondition) => {
    if (condition.field === "event") {
      return eventValueLabels[condition.value] ?? condition.value;
    }
    if (condition.field === "whatsapp_valid") {
      return booleanValueLabels[condition.value] ?? condition.value;
    }
    return condition.value;
  };
  const getConditionOptionLabel = (
    field: AutoContactFlowCondition["field"],
    value: string,
  ) => {
    if (field === "event") {
      return eventValueLabels[value] ?? value;
    }
    if (field === "whatsapp_valid") {
      return booleanValueLabels[value] ?? value;
    }
    return value;
  };
  const getFlowConditionPreview = (flow: AutoContactFlow) => {
    const conditions = flow.conditions ?? [];
    if (conditions.length === 0) {
      return flow.triggerStatus
        ? `Status: ${flow.triggerStatus}`
        : "Sem condições";
    }

    const preview = conditions
      .slice(0, 2)
      .map((condition) => {
        const fieldLabel =
          conditionFieldLabels[condition.field] ?? condition.field;
        const operatorLabel = isEventLeadCreated(condition)
          ? ""
          : (conditionOperatorLabels[condition.operator] ?? condition.operator);
        const valueText = isEventLeadCreated(condition)
          ? ""
          : getConditionValueLabel(condition);
        return `${fieldLabel} ${operatorLabel} ${valueText}`.trim();
      })
      .join(" • ");
    const extraCount = conditions.length - 2;
    return extraCount > 0 ? `${preview} (+${extraCount})` : preview;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getFlowSearchText = (flow: AutoContactFlow) => {
    const conditionsText = (flow.conditions ?? [])
      .map((condition) => {
        const fieldLabel =
          conditionFieldLabels[condition.field] ?? condition.field;
        const operatorLabel = isEventLeadCreated(condition)
          ? ""
          : (conditionOperatorLabels[condition.operator] ?? condition.operator);
        const valueText = isEventLeadCreated(condition)
          ? ""
          : getConditionValueLabel(condition);
        return `${fieldLabel} ${operatorLabel} ${valueText}`.trim();
      })
      .join(" ");
    return `${flow.name} ${conditionsText} ${flow.triggerStatus ?? ""} ${(flow.tags ?? []).join(" ")}`.toLowerCase();
  };

  const activeFlow = useMemo(
    () => flowDrafts.find((flow) => flow.id === activeFlowId) ?? null,
    [flowDrafts, activeFlowId],
  );
  const activeFlowIndex = useMemo(
    () =>
      activeFlow
        ? flowDrafts.findIndex((flow) => flow.id === activeFlow.id)
        : -1,
    [activeFlow, flowDrafts],
  );
  useEffect(() => {
    if (activeFlow && !activeFlow.flowGraph) {
      handleUpdateFlowGraph(activeFlow.id, buildFlowGraphFromFlow(activeFlow));
    }
  }, [activeFlow]); // eslint-disable-line react-hooks/exhaustive-deps
  const availableTags = useMemo(() => {
    const tags = flowDrafts.flatMap((flow) => flow.tags ?? []).filter(Boolean);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [flowDrafts]);
  const filteredFlows = useMemo(() => {
    const search = flowSearch.trim().toLowerCase();
    return flowDrafts.filter((flow) => {
      const tags = flow.tags ?? [];
      if (flowTagFilter !== "all" && !tags.includes(flowTagFilter)) {
        return false;
      }
      if (!search) return true;
      return getFlowSearchText(flow).includes(search);
    });
  }, [flowDrafts, flowSearch, flowTagFilter, getFlowSearchText]);
  const metrics = useMemo(() => {
    const totalSteps = flowDrafts.reduce(
      (total, flow) => total + flow.steps.length,
      0,
    );
    const flowsWithConditions = flowDrafts.filter(
      (flow) => (flow.conditions ?? []).length > 0,
    ).length;
    const taggedFlows = flowDrafts.filter(
      (flow) => (flow.tags ?? []).length > 0,
    ).length;
    return {
      totalFlows: flowDrafts.length,
      totalSteps,
      totalTemplates: messageTemplatesDraft.length,
      flowsWithConditions,
      taggedFlows,
    };
  }, [flowDrafts, messageTemplatesDraft]);
  const messageTypeLabels: Record<TemplateMessageType, string> = {
    text: "Texto",
    image: "Imagem",
    video: "Vídeo",
    audio: "Áudio",
    document: "Documento",
  };
  const flowActionLabels: Record<AutoContactFlowActionType, string> = {
    send_message: "Enviar mensagem (canal)",
    update_status: "Atualizar status do lead",
    create_task: "Criar tarefa",
    send_email: "Enviar e-mail",
    webhook: "Disparar webhook",
    archive_lead: "Arquivar lead",
    delete_lead: "Excluir lead",
  };
  const messageSourceLabels: Record<AutoContactFlowMessageSource, string> = {
    template: "Template",
    custom: "Personalizado",
  };
  const delayUnitLabels: Record<
    AutoContactDelayUnit,
    { singular: string; plural: string }
  > = {
    seconds: { singular: "segundo", plural: "segundos" },
    minutes: { singular: "minuto", plural: "minutos" },
    hours: { singular: "hora", plural: "horas" },
    days: { singular: "dia", plural: "dias" },
  };

  const messageTypeIcons: Record<TemplateMessageType, typeof MessageCircle> = {
    text: MessageCircle,
    image: ImageIcon,
    video: Film,
    audio: Mic,
    document: File,
  };
  const createFlowStep = (
    templateId = messageTemplatesDraft[0]?.id,
  ): AutoContactFlowStep => ({
    id: `flow-step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    delayValue: 2,
    delayUnit: "hours",
    actionType: "send_message",
    messageSource: "template",
    templateId: templateId || messageTemplatesDraft[0]?.id || "",
    customMessage: {
      type: "text",
      text: "",
      mediaUrl: "",
      caption: "",
      filename: "",
    },
  });
  const createFlowExitCondition = (): AutoContactFlowCondition => ({
    id: `flow-exit-condition-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    field: "status",
    operator: "equals",
    value: "",
  });
  const createFlowDraft = (): AutoContactFlow => ({
    id: `flow-${Date.now()}`,
    name: "",
    triggerStatus: "",
    triggerType: "lead_created",
    triggerStatuses: [],
    triggerDurationHours: 24,
    steps: [createFlowStep()],
    finalStatus: "",
    scheduling: {
      startHour: schedulingDraft.startHour,
      endHour: schedulingDraft.endHour,
      allowedWeekdays: schedulingDraft.allowedWeekdays,
      dailySendLimit: null,
    },
    invalidNumberAction: "none",
    invalidNumberStatus: "",
    conditionLogic: "all",
    conditions: [],
    exitConditionLogic: "any",
    exitConditions: [],
    tags: [],
  });
  const handleAddFlow = () => {
    const newFlow = createFlowDraft();
    setFlowDrafts((previous) => [...previous, newFlow]);
    setActiveFlowId(newFlow.id);
  };
  const handleUpdateFlow = (
    flowId: string,
    updates: Partial<AutoContactFlow>,
  ) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId ? { ...flow, ...updates } : flow,
      ),
    );
  };
  const handleUpdateFlowGraph = (
    flowId: string,
    flowGraph: AutoContactFlowGraph,
  ) => {
    handleUpdateFlow(flowId, { flowGraph });
  };
  const handleUpdateFlowScheduling = (
    flowId: string,
    updates: Partial<NonNullable<AutoContactFlow["scheduling"]>>,
  ) => {
    setFlowDrafts((previous) =>
      previous.map((flow) => {
        if (flow.id !== flowId) return flow;
        const currentScheduling = flow.scheduling ?? {
          startHour: schedulingDraft.startHour,
          endHour: schedulingDraft.endHour,
          allowedWeekdays: schedulingDraft.allowedWeekdays,
          dailySendLimit: null,
        };
        return {
          ...flow,
          scheduling: {
            ...currentScheduling,
            ...updates,
          },
        };
      }),
    );
  };
  const handleRemoveFlow = (flowId: string) => {
    const baseId = flowId.endsWith("-nao")
      ? flowId.replace(/-nao$/, "")
      : flowId;
    setFlowDrafts((previous) =>
      previous.filter(
        (flow) => flow.id !== baseId && flow.id !== `${baseId}-nao`,
      ),
    );
    if (activeFlowId === flowId) {
      setActiveFlowId(null);
    }
  };
  const handleAddFlowStep = (flowId: string) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? { ...flow, steps: [...flow.steps, createFlowStep()] }
          : flow,
      ),
    );
  };
  const handleUpdateFlowStep = (
    flowId: string,
    stepId: string,
    updates: Partial<AutoContactFlowStep>,
  ) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              steps: flow.steps.map((step) =>
                step.id === stepId ? { ...step, ...updates } : step,
              ),
            }
          : flow,
      ),
    );
  };
  const handleAddFlowExitCondition = (flowId: string) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              exitConditions: [
                ...(flow.exitConditions ?? []),
                createFlowExitCondition(),
              ],
            }
          : flow,
      ),
    );
  };
  const handleUpdateFlowExitCondition = (
    flowId: string,
    conditionId: string,
    updates: Partial<AutoContactFlowCondition>,
  ) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              exitConditions: (flow.exitConditions ?? []).map((condition) =>
                condition.id === conditionId
                  ? { ...condition, ...updates }
                  : condition,
              ),
            }
          : flow,
      ),
    );
  };
  const handleRemoveFlowExitCondition = (
    flowId: string,
    conditionId: string,
  ) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              exitConditions: (flow.exitConditions ?? []).filter(
                (condition) => condition.id !== conditionId,
              ),
            }
          : flow,
      ),
    );
  };
  const handleRemoveFlowStep = (flowId: string, stepId: string) => {
    setFlowDrafts((previous) =>
      previous.map((flow) => {
        if (flow.id !== flowId) return flow;
        const nextSteps = flow.steps.filter((step) => step.id !== stepId);
        return {
          ...flow,
          steps: nextSteps.length ? nextSteps : [createFlowStep()],
        };
      }),
    );
  };
  const handleAddFlowTag = (flowId: string) => {
    const trimmed = tagDraft.trim();
    if (!trimmed) return;
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              tags: flow.tags?.includes(trimmed)
                ? flow.tags
                : [...(flow.tags ?? []), trimmed],
            }
          : flow,
      ),
    );
    setTagDraft("");
  };
  const handleRemoveFlowTag = (flowId: string, tag: string) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              tags: (flow.tags ?? []).filter((item) => item !== tag),
            }
          : flow,
      ),
    );
  };
  const statusOptions = leadStatuses.filter((status) => status.ativo !== false);
  const showStatusSelect = statusOptions.length > 0;
  const originOptions = useMemo(
    () => leadOrigins.map((origin) => origin.nome),
    [leadOrigins],
  );
  const tipoContratacaoOptions = useMemo(
    () =>
      (options.lead_tipo_contratacao || []).filter((option) => option.ativo),
    [options.lead_tipo_contratacao],
  );
  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo),
    [options.lead_responsavel],
  );
  const conditionValueOptions = useMemo<
    Partial<Record<AutoContactFlowCondition["field"], string[]>>
  >(
    () => ({
      status: statusOptions.map((status) => status.nome),
      origem: originOptions,
      tipo_contratacao: tipoContratacaoOptions.map((option) => option.label),
      responsavel: responsavelOptions.map((option) => option.label),
      tag: availableTags,
      whatsapp_valid: ["true", "false"],
      event: ["lead_created"],
    }),
    [
      availableTags,
      originOptions,
      responsavelOptions,
      statusOptions,
      tipoContratacaoOptions,
    ],
  );
  const getConditionValueOptions = (
    field: AutoContactFlowCondition["field"],
  ) => {
    const values = conditionValueOptions[field];
    if (!values || values.length === 0) return null;
    return Array.from(new Set(values))
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b));
  };
  const weekdayLabels = [
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sáb" },
    { value: 7, label: "Dom" },
  ];
  const getFlowScheduling = useCallback(
    (flow?: AutoContactFlow | null): AutoContactSchedulingSettings => ({
      ...schedulingDraft,
      startHour: flow?.scheduling?.startHour ?? schedulingDraft.startHour,
      endHour: flow?.scheduling?.endHour ?? schedulingDraft.endHour,
      allowedWeekdays: flow?.scheduling?.allowedWeekdays?.length
        ? flow.scheduling.allowedWeekdays
        : schedulingDraft.allowedWeekdays,
      dailySendLimit: flow?.scheduling?.dailySendLimit ?? null,
    }),
    [schedulingDraft],
  );
  const adjustmentReasonLabels: Record<
    AutoContactScheduleAdjustmentReason,
    string
  > = {
    outside_window: "fora da janela",
    weekend: "fim de semana",
    holiday: "feriado",
  };
  const formatDelayLabel = (
    delayValue: number,
    delayUnit: AutoContactDelayUnit,
  ) => {
    const labels = delayUnitLabels[delayUnit] ?? delayUnitLabels.hours;
    const label = delayValue === 1 ? labels.singular : labels.plural;
    return `${delayValue} ${label}`;
  };
  const getLocalDateTimeValue = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };
  const formatSimulationDateTime = (date: Date, timezone: string) =>
    date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    });
  const getSimulationStepLabel = (step: AutoContactFlowStep) => {
    switch (step.actionType) {
      case "send_message": {
        if (step.messageSource === "custom") {
          const messageType =
            messageTypeLabels[step.customMessage?.type ?? "text"] ?? "Mensagem";
          const preview = step.customMessage?.text?.trim();
          return preview
            ? `${messageType}: ${preview.slice(0, 72)}`
            : `${messageType} personalizada`;
        }
        const template = messageTemplatesDraft.find(
          (item) => item.id === step.templateId,
        );
        return template?.name?.trim()
          ? `Template: ${template.name}`
          : "Enviar mensagem via template";
      }
      case "update_status":
        return step.statusToSet?.trim()
          ? `Atualizar status para ${step.statusToSet}`
          : "Atualizar status";
      case "create_task":
        return step.taskTitle?.trim()
          ? `Criar tarefa: ${step.taskTitle}`
          : "Criar tarefa";
      case "send_email":
        return step.emailSubject?.trim()
          ? `Enviar e-mail: ${step.emailSubject}`
          : "Enviar e-mail";
      case "webhook":
        return step.webhookUrl?.trim()
          ? `Webhook ${step.webhookMethod ?? "POST"}`
          : "Disparar webhook";
      case "archive_lead":
        return "Arquivar lead";
      case "delete_lead":
        return "Excluir lead";
      default:
        return flowActionLabels[step.actionType] ?? "Ação";
    }
  };
  const simulationLead = useMemo<Lead>(
    () => ({
      id: "preview-lead",
      nome_completo: "Lead Exemplo",
      telefone: "11999999999",
      email: "lead@exemplo.com",
      cidade: "São Paulo",
      regiao: "Sudeste",
      estado: "SP",
      origem: "Manual",
      status: activeFlow?.triggerStatus || "Novo",
      data_criacao: new Date().toISOString(),
      arquivado: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    [activeFlow?.triggerStatus],
  );
  const simulationFlow = useMemo(() => {
    if (!activeFlow) return null;
    return activeFlow.flowGraph
      ? applyFlowGraphToFlow(activeFlow, activeFlow.flowGraph)
      : activeFlow;
  }, [activeFlow]);
  const simulationInputValue = simulationStart || getLocalDateTimeValue();
  const simulationBaseDate = useMemo(() => {
    const parsed = new Date(simulationInputValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [simulationInputValue]);
  const simulationTimeline = useMemo(() => {
    if (!simulationFlow || !showSimulation || !simulationBaseDate) return [];
    try {
      return buildAutoContactScheduleTimeline({
        startAt: simulationBaseDate,
        steps: simulationFlow.steps,
        scheduling: getFlowScheduling(simulationFlow),
        lead: simulationLead,
      }).map((item, index) => ({
        index: index + 1,
        step: item.step,
        scheduledAt: item.scheduledAt,
        delayValue: item.step.delayValue,
        delayUnit: item.step.delayUnit,
        adjustmentReasons: item.adjustmentReasons,
      }));
    } catch (error) {
      console.error("Erro ao montar simulação do fluxo:", error);
      return [];
    }
  }, [
    getFlowScheduling,
    showSimulation,
    simulationBaseDate,
    simulationFlow,
    simulationLead,
  ]);
  const simulationIssues = useMemo(() => {
    if (!simulationFlow || !showSimulation) return [];
    const issues: string[] = [];
    const scheduling = getFlowScheduling(simulationFlow);
    if (!simulationBaseDate) {
      issues.push("Defina uma data inicial válida para a simulação.");
    }
    if (!simulationFlow.steps.length) {
      issues.push("Adicione ao menos uma etapa para gerar a linha do tempo.");
    }
    if (!scheduling.allowedWeekdays.length) {
      issues.push("Selecione ao menos um dia permitido no agendamento.");
    }
    if (scheduling.startHour === scheduling.endHour) {
      issues.push(
        "A janela diaria esta com inicio e fim iguais; revise o horario.",
      );
    }
    simulationFlow.steps.forEach((step, index) => {
      if (
        step.actionType === "send_message" &&
        step.messageSource !== "custom"
      ) {
        const templateExists = messageTemplatesDraft.some(
          (template) => template.id === step.templateId,
        );
        if (!templateExists) {
          issues.push(
            `Etapa ${index + 1}: selecione um template valido para a mensagem.`,
          );
        }
      }
      if (
        step.actionType === "send_message" &&
        step.messageSource === "custom" &&
        !step.customMessage?.text?.trim()
      ) {
        issues.push(`Etapa ${index + 1}: a mensagem personalizada esta vazia.`);
      }
      if (step.actionType === "update_status" && !step.statusToSet?.trim()) {
        issues.push(`Etapa ${index + 1}: informe o status de destino.`);
      }
      if (step.actionType === "create_task" && !step.taskTitle?.trim()) {
        issues.push(`Etapa ${index + 1}: informe o título da tarefa.`);
      }
      if (step.actionType === "send_email" && !step.emailSubject?.trim()) {
        issues.push(`Etapa ${index + 1}: informe o assunto do e-mail.`);
      }
      if (step.actionType === "webhook" && !step.webhookUrl?.trim()) {
        issues.push(`Etapa ${index + 1}: informe a URL do webhook.`);
      }
    });
    return issues;
  }, [
    getFlowScheduling,
    messageTemplatesDraft,
    showSimulation,
    simulationBaseDate,
    simulationFlow,
  ]);
  const simulationSummary = useMemo(() => {
    if (!simulationFlow || !showSimulation) return null;
    const firstItem = simulationTimeline[0] ?? null;
    const lastItem = simulationTimeline[simulationTimeline.length - 1] ?? null;
    const adjustedSteps = simulationTimeline.filter(
      (item) => item.adjustmentReasons.length > 0,
    ).length;
    const actionCounts = simulationFlow.steps.reduce<Record<string, number>>(
      (accumulator, step) => {
        accumulator[step.actionType] = (accumulator[step.actionType] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    return {
      totalSteps: simulationFlow.steps.length,
      adjustedSteps,
      firstAt: firstItem?.scheduledAt ?? null,
      lastAt: lastItem?.scheduledAt ?? null,
      actionCounts,
      hasIssues: simulationIssues.length > 0,
    };
  }, [
    showSimulation,
    simulationFlow,
    simulationIssues.length,
    simulationTimeline,
  ]);

  const activeFlowScheduling = useMemo(
    () => (activeFlow ? getFlowScheduling(activeFlow) : schedulingDraft),
    [activeFlow, getFlowScheduling, schedulingDraft],
  );

  useEffect(() => {
    if (!activeFlowId) {
      setShowSimulation(false);
      setSimulationStart("");
      setTagDraft("");
      return;
    }
    setShowSimulation(false);
    setSimulationStart("");
    setTagDraft("");
  }, [activeFlowId]);

  useEffect(() => {
    if (!monitoringDraft.realtimeEnabled) return;
    setLastRefreshAt(new Date());
    const intervalId = window.setInterval(() => {
      setLastRefreshAt(new Date());
    }, monitoringDraft.refreshSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [monitoringDraft.realtimeEnabled, monitoringDraft.refreshSeconds]);

  useEffect(() => {
    void loadDailyAutomationCount();
  }, [loadDailyAutomationCount, lastRefreshAt]);

  useEffect(() => {
    if (!loadingFlow) {
      autoSaveReadyRef.current = true;
      autoSaveSkipRef.current = true;
    }
  }, [loadingFlow]);

  const handleAutoSaveSettings = useCallback(
    async (skipStateUpdates = false) => {
      if (!autoContactIntegration || !autoSaveReadyRef.current) return;
      if (autoSaveInFlightRef.current) return;

      autoSaveInFlightRef.current = true;
      if (!skipStateUpdates) {
        setAutoSaveState("saving");
      }

      const currentSettings =
        autoContactSettings || normalizeAutoContactSettings(null);
      const newSettings = {
        ...currentSettings,
        autoSend: autoSendEnabled,
        scheduling: schedulingDraft,
        monitoring: monitoringDraft,
        logging: loggingDraft,
      };

      const { data, error } = await configService.updateIntegrationSetting(
        autoContactIntegration.id,
        {
          settings: newSettings,
        },
      );

      if (error) {
        if (!skipStateUpdates) {
          setAutoSaveState("error");
        }
      } else if (!skipStateUpdates) {
        const updatedIntegration = data ?? autoContactIntegration;
        const normalized = normalizeAutoContactSettings(
          updatedIntegration.settings,
        );

        setAutoContactIntegration(updatedIntegration);
        setAutoContactSettings(normalized);
        autoSaveSkipRef.current = true;
        setAutoSendEnabled(normalized.autoSend);
        setSchedulingDraft(normalized.scheduling);
        setMonitoringDraft(normalized.monitoring);
        setLoggingDraft(normalized.logging);
        setAutoSaveState("saved");
      }

      autoSaveInFlightRef.current = false;
    },
    [
      autoContactIntegration,
      autoContactSettings,
      autoSendEnabled,
      loggingDraft,
      monitoringDraft,
      schedulingDraft,
    ],
  );

  useEffect(() => {
    if (!autoContactIntegration || !autoSaveReadyRef.current) return;
    if (autoSaveSkipRef.current) {
      autoSaveSkipRef.current = false;
      return;
    }

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      void handleAutoSaveSettings();
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    autoContactIntegration,
    autoSendEnabled,
    handleAutoSaveSettings,
    loggingDraft,
    monitoringDraft,
    schedulingDraft,
  ]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        void handleAutoSaveSettings(true);
      }
    };
  }, [handleAutoSaveSettings]);

  const hasFlowSnapshot = autoContactIntegration !== null;

  if (!autoContactIntegration && !loadingFlow) {
    return (
      <div className="bg-[color:var(--panel-accent-soft)] border border-[var(--panel-accent-border)] rounded-xl p-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-[var(--panel-accent-ink)] mt-1" />
        <div className="space-y-1 text-sm text-[var(--panel-accent-ink-strong)]">
          <p className="font-semibold">
            Integração de automação não encontrada.
          </p>
          <p>
            Execute as migrações mais recentes e configure o serviço antes de
            definir os templates de automação.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PanelAdaptiveLoadingFrame
      loading={loadingFlow}
      phase={loadingUi.phase}
      hasContent={hasFlowSnapshot}
      skeleton={<AutomationFlowsSkeleton />}
      stageLabel="Carregando fluxos de automação..."
      overlayLabel="Atualizando fluxos de automação..."
      stageClassName="min-h-[520px]"
    >
      <div className="panel-page-shell bg-[color:var(--panel-surface)] rounded-xl shadow-sm border border-[var(--panel-border-subtle)] p-6">
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--panel-text)]">
                  Visão geral
                </h3>
                <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                  Acompanhe o volume de fluxos, etapas e envios automáticos.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase text-[var(--panel-text-muted)]">
                    Fluxos ativos
                  </div>
                  <BarChart3 className="w-4 h-4 text-[var(--panel-text-subtle)]" />
                </div>
                <div className="text-2xl font-semibold text-[var(--panel-text)] mt-2">
                  {metrics.totalFlows}
                </div>
                <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                  Modelos: {metrics.totalTemplates}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase text-[var(--panel-text-muted)]">
                    Etapas totais
                  </div>
                  <Timer className="w-4 h-4 text-[var(--panel-text-subtle)]" />
                </div>
                <div className="text-2xl font-semibold text-[var(--panel-text)] mt-2">
                  {metrics.totalSteps}
                </div>
                <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                  Condições: {metrics.flowsWithConditions}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase text-[var(--panel-text-muted)]">
                    Fluxos tagueados
                  </div>
                  <Tag className="w-4 h-4 text-[var(--panel-text-subtle)]" />
                </div>
                <div className="text-2xl font-semibold text-[var(--panel-text)] mt-2">
                  {metrics.taggedFlows}
                </div>
                <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                  Tags ativas: {availableTags.length}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase text-[var(--panel-text-muted)]">
                    Última atualização
                  </div>
                  <Activity className="w-4 h-4 text-[var(--panel-text-subtle)]" />
                </div>
                <div className="text-2xl font-semibold text-[var(--panel-text)] mt-2">
                  {lastRefreshAt.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                  Monitoramento em tempo real
                </p>
              </div>
              <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase text-[var(--panel-text-muted)]">
                    Envios hoje
                  </div>
                  <AlarmClock className="w-4 h-4 text-[var(--panel-text-subtle)]" />
                </div>
                <div className="text-2xl font-semibold text-[var(--panel-text)] mt-2">
                  {dailyAutomationLoading ? "..." : (dailyAutomationCount ?? 0)}
                </div>
                <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                  {dailyAutomationError
                    ? dailyAutomationError
                    : "Limites são definidos por fluxo no agendamento."}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--panel-text)]">
                    Configurações globais
                  </h3>
                  <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                    Controle o envio automático, o fuso horário e a
                    observabilidade do sistema.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs text-[var(--panel-text-muted)]">
                  {autoSaveState === "saving" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        autoSaveState === "error"
                          ? "bg-[color:var(--panel-accent-red-border)]"
                          : autoSaveState === "saved"
                            ? "bg-[color:var(--panel-accent-strong)]"
                            : "bg-[color:var(--panel-border)]"
                      }`}
                    />
                  )}
                  <span>
                    {autoSaveState === "saving"
                      ? "Salvando..."
                      : autoSaveState === "saved"
                        ? "Salvo automaticamente"
                        : autoSaveState === "error"
                          ? "Erro ao salvar"
                          : "Autosave ativo"}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4 space-y-4">
                  <div className="flex items-center gap-2 text-[var(--panel-text)] font-medium">
                    <ShieldCheck className="w-5 h-5" />
                    Automação
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--panel-text-soft)]">
                        Ativar automação
                      </p>
                      <p className="text-xs text-[var(--panel-text-muted)]">
                        Controla o envio automático dos fluxos configurados.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--panel-text-soft)]">
                      <Checkbox
                        checked={autoSendEnabled}
                        onChange={(event) =>
                          setAutoSendEnabled(event.target.checked)
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4 space-y-4">
                  <div className="flex items-center gap-2 text-[var(--panel-text)] font-medium">
                    <AlarmClock className="w-5 h-5" />
                    Agendamento avançado
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                        Fuso horário
                      </label>
                      <FilterSingleSelect
                        icon={Globe2}
                        value={schedulingDraft.timezone}
                        onChange={(value) =>
                          setSchedulingDraft((previous) => ({
                            ...previous,
                            timezone: value,
                          }))
                        }
                        placeholder="Selecione um fuso"
                        includePlaceholderOption={false}
                        options={timezoneOptions}
                        size="compact"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--panel-text-subtle)]">
                    A janela diária, os dias permitidos e o limite diário são
                    definidos em cada fluxo.
                  </p>
                  <div className="space-y-1">
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--panel-text-soft)]">
                      <Checkbox
                        checked={schedulingDraft.skipHolidays}
                        onChange={(event) =>
                          setSchedulingDraft((previous) => ({
                            ...previous,
                            skipHolidays: event.target.checked,
                          }))
                        }
                      />
                      Pausar envios em feriados nacionais e estaduais
                    </label>
                    <p className="text-[11px] text-[var(--panel-text-subtle)]">
                      O sistema considera automaticamente os feriados oficiais e
                      respeita datas extras configuradas manualmente.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4 space-y-4 lg:col-span-2">
                  <div className="flex items-center gap-2 text-[var(--panel-text)] font-medium">
                    <ClipboardList className="w-5 h-5" />
                    Observabilidade e auditoria
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[var(--panel-text)]">
                          Monitoramento em tempo real
                        </div>
                        <p className="text-xs text-[var(--panel-text-muted)]">
                          Atualiza o painel automaticamente com status das
                          execuções.
                        </p>
                      </div>
                      <Checkbox
                        checked={monitoringDraft.realtimeEnabled}
                        onChange={(event) =>
                          setMonitoringDraft((previous) => ({
                            ...previous,
                            realtimeEnabled: event.target.checked,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                          Atualização (segundos)
                        </label>
                        <Input
                          type="number"
                          min={5}
                          value={monitoringDraft.refreshSeconds}
                          onChange={(event) =>
                            setMonitoringDraft((previous) => ({
                              ...previous,
                              refreshSeconds: Number(event.target.value),
                            }))
                          }
                          size="compact"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                          Última atualização
                        </label>
                        <div className="px-3 py-2 border border-[var(--panel-border-subtle)] rounded-lg text-sm text-[var(--panel-text-soft)] bg-[color:var(--panel-surface-soft)]">
                          {lastRefreshAt.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[var(--panel-border-subtle)] pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[var(--panel-text)]">
                          Logs estruturados e auditoria
                        </div>
                        <p className="text-xs text-[var(--panel-text-muted)]">
                          Registre eventos, payloads e ações por usuário.
                        </p>
                      </div>
                      <Checkbox
                        checked={loggingDraft.enabled}
                        onChange={(event) =>
                          setLoggingDraft((previous) => ({
                            ...previous,
                            enabled: event.target.checked,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                          Retenção (dias)
                        </label>
                        <Input
                          type="number"
                          min={7}
                          value={loggingDraft.retentionDays}
                          onChange={(event) =>
                            setLoggingDraft((previous) => ({
                              ...previous,
                              retentionDays: Number(event.target.value),
                            }))
                          }
                          size="compact"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-[var(--panel-text-soft)] mt-6">
                        <Checkbox
                          checked={loggingDraft.includePayloads}
                          onChange={(event) =>
                            setLoggingDraft((previous) => ({
                              ...previous,
                              includePayloads: event.target.checked,
                            }))
                          }
                        />
                        Salvar payloads completos
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-1">
              <h3 className="text-sm font-semibold text-[var(--panel-text)]">
                Fluxos e templates
              </h3>
              <p className="text-xs text-[var(--panel-text-muted)]">
                Crie, organize e acompanhe os fluxos e templates usados na
                automação.
              </p>
            </div>
            {statusMessage && (
              <div
                className={`mt-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${
                  statusMessage.type === "success"
                    ? "bg-[color:var(--panel-accent-green-bg)] border-[var(--panel-accent-green-border)] text-[var(--panel-accent-green-text)]"
                    : statusMessage.type === "warning"
                      ? "bg-[color:var(--panel-accent-soft)] border-[var(--panel-accent-border)] text-[var(--panel-accent-ink-strong)]"
                      : "bg-[color:var(--panel-accent-red-bg)] border-[var(--panel-accent-red-border)] text-[var(--panel-accent-red-text)]"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <Info className="w-4 h-4" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="border border-[var(--panel-border-subtle)] rounded-lg p-4 bg-[color:var(--panel-surface-soft)] space-y-4 mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--panel-text)]">
                    Fluxos de automação
                  </h3>
                  <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                    Monte sequências com espera configurável (segundos, minutos,
                    horas ou dias), envio de templates e condição de
                    encerramento.
                  </p>
                </div>
                <Button onClick={handleAddFlow} variant="secondary" size="sm">
                  <Plus className="w-4 h-4" />
                  Novo fluxo
                </Button>
              </div>

              {flowDrafts.length === 0 ? (
                <div className="text-sm text-[var(--panel-text-muted)] bg-[color:var(--panel-surface)] border border-[var(--panel-border-subtle)] rounded-lg p-4">
                  Nenhum fluxo configurado. Clique em "Novo fluxo" para começar.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
                    <Input
                      type="text"
                      value={flowSearch}
                      onChange={(event) => setFlowSearch(event.target.value)}
                      leftIcon={Search}
                      className="bg-[color:var(--panel-surface)]"
                      placeholder="Buscar fluxo por nome, condição ou tag"
                    />
                    <div>
                      <FilterSingleSelect
                        icon={Tag}
                        value={flowTagFilter}
                        onChange={(value) => setFlowTagFilter(value)}
                        placeholder="Todas as tags"
                        includePlaceholderOption={false}
                        options={[
                          { value: "all", label: "Todas as tags" },
                          ...availableTags.map((tagItem) => ({
                            value: tagItem,
                            label: tagItem,
                          })),
                        ]}
                      />
                    </div>
                    <div className="text-xs text-[var(--panel-text-muted)] flex items-center justify-end">
                      {filteredFlows.length} fluxo
                      {filteredFlows.length === 1 ? "" : "s"} encontrado
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredFlows.map((flow, index) => (
                      <button
                        type="button"
                        key={flow.id}
                        onClick={() => setActiveFlowId(flow.id)}
                        className="text-left rounded-xl border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4 shadow-sm transition hover:border-[var(--panel-accent-border)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus)] focus-visible:ring-offset-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-[var(--panel-text-subtle)] uppercase">
                              Fluxo {index + 1}
                            </div>
                            <div className="text-sm font-semibold text-[var(--panel-text)] mt-1">
                              {flow.name || "Fluxo sem nome"}
                            </div>
                            <div className="text-xs text-[var(--panel-text-muted)] mt-1">
                              Condições:{" "}
                              <span className="font-medium text-[var(--panel-text-soft)]">
                                {getFlowConditionPreview(flow)}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-[color:var(--panel-surface-muted)] text-[var(--panel-text-muted)]">
                            {flow.steps.length} etapa
                            {flow.steps.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--panel-text-muted)]">
                          <span className="rounded-full border border-[var(--panel-border-subtle)] px-2 py-0.5">
                            Saída: {(flow.exitConditions ?? []).length || 0}{" "}
                            condição
                            {(flow.exitConditions ?? []).length === 1
                              ? ""
                              : "s"}
                          </span>
                          <span className="rounded-full border border-[var(--panel-border-subtle)] px-2 py-0.5">
                            {flow.finalStatus
                              ? `Finaliza em ${flow.finalStatus}`
                              : "Sem status final"}
                          </span>
                          <span className="rounded-full border border-[var(--panel-border-subtle)] px-2 py-0.5">
                            {(flow.conditions ?? []).length} condição
                            {(flow.conditions ?? []).length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {(flow.tags ?? []).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--panel-text-muted)]">
                            {(flow.tags ?? []).map((tagItem) => (
                              <span
                                key={tagItem}
                                className="rounded-full border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] px-2 py-0.5"
                              >
                                #{tagItem}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeFlow && (
                <ModalShell
                  isOpen
                  onClose={() => setActiveFlowId(null)}
                  size="xl"
                  panelClassName="config-transparent-buttons max-w-6xl 2xl:max-w-7xl"
                  bodyClassName="p-6"
                  showCloseButton={false}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--panel-border-subtle)] pb-4">
                    <div>
                      <div className="text-xs font-semibold text-[var(--panel-text-subtle)] uppercase">
                        Fluxo {activeFlowIndex + 1}
                      </div>
                      <h4 className="text-lg font-semibold text-[var(--panel-text)]">
                        Detalhes do fluxo
                      </h4>
                      <p className="text-sm text-[var(--panel-text-muted)] mt-1">
                        Ajuste regras, sequência de ações e status final do
                        fluxo selecionado.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => {
                          setShowSimulation((previous) => !previous);
                          if (!simulationStart) {
                            setSimulationStart(getLocalDateTimeValue());
                          }
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        <Timer className="w-4 h-4" />
                        {showSimulation ? "Ocultar simulação" : "Simular fluxo"}
                      </Button>
                      <Button
                        onClick={handleSaveFlow}
                        loading={savingFlow}
                        size="sm"
                      >
                        {!savingFlow && <Save className="w-4 h-4" />}
                        {savingFlow ? "Salvando..." : "Salvar fluxo"}
                      </Button>
                      <Button
                        onClick={() => handleRemoveFlow(activeFlow.id)}
                        variant="danger"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover fluxo
                      </Button>
                      <Button
                        onClick={() => setActiveFlowId(null)}
                        variant="secondary"
                        size="sm"
                      >
                        Fechar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-6 pt-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-[var(--panel-text-muted)] uppercase tracking-wide">
                            Nome do fluxo
                          </label>
                          <Input
                            type="text"
                            value={activeFlow.name}
                            onChange={(event) =>
                              handleUpdateFlow(activeFlow.id, {
                                name: event.target.value,
                              })
                            }
                            placeholder="Ex.: Follow-up de contato inicial"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-3">
                        <div className="text-xs font-semibold text-[var(--panel-text-muted)] uppercase">
                          Resumo do fluxo
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--panel-text-soft)]">
                          <span className="rounded-full border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] px-2 py-0.5">
                            {activeFlow.triggerStatus
                              ? `Status: ${activeFlow.triggerStatus}`
                              : "Disparo por condições"}
                          </span>
                          <span className="rounded-full border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] px-2 py-0.5">
                            Janela {activeFlowScheduling.startHour} -{" "}
                            {activeFlowScheduling.endHour}
                          </span>
                          <span className="rounded-full border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] px-2 py-0.5">
                            {activeFlow.steps.length} etapa
                            {activeFlow.steps.length === 1 ? "" : "s"}
                          </span>
                          <span className="rounded-full border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] px-2 py-0.5">
                            {getFlowConditionPreview(activeFlow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--panel-text)]">
                          Agendamento do fluxo
                        </h4>
                        <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                          Defina a janela diária, os dias permitidos e o limite
                          de envios deste fluxo.
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                            Janela diária
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={activeFlowScheduling.startHour}
                              onChange={(event) =>
                                handleUpdateFlowScheduling(activeFlow.id, {
                                  startHour: event.target.value,
                                })
                              }
                              size="compact"
                            />
                            <span className="text-xs text-[var(--panel-text-subtle)]">
                              até
                            </span>
                            <Input
                              type="time"
                              value={activeFlowScheduling.endHour}
                              onChange={(event) =>
                                handleUpdateFlowScheduling(activeFlow.id, {
                                  endHour: event.target.value,
                                })
                              }
                              size="compact"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-2">
                            Dias permitidos
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {weekdayLabels.map((day) => {
                              const isActive =
                                activeFlowScheduling.allowedWeekdays.includes(
                                  day.value,
                                );
                              return (
                                <Button
                                  key={day.value}
                                  onClick={() =>
                                    handleUpdateFlowScheduling(activeFlow.id, {
                                      allowedWeekdays: isActive
                                        ? activeFlowScheduling.allowedWeekdays.filter(
                                            (value) => value !== day.value,
                                          )
                                        : [
                                            ...activeFlowScheduling.allowedWeekdays,
                                            day.value,
                                          ].sort((a, b) => a - b),
                                    })
                                  }
                                  variant={isActive ? "warning" : "secondary"}
                                  size="sm"
                                  className="h-auto rounded-full px-3 py-1 text-xs"
                                >
                                  {day.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                            Limite diário deste fluxo
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={activeFlowScheduling.dailySendLimit ?? ""}
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              handleUpdateFlowScheduling(activeFlow.id, {
                                dailySendLimit:
                                  Number.isFinite(parsed) && parsed > 0
                                    ? Math.floor(parsed)
                                    : null,
                              });
                            }}
                            placeholder="Sem limite"
                          />
                          <p className="text-[11px] text-[var(--panel-text-subtle)] mt-1">
                            Conta apenas os envios automáticos deste fluxo por
                            dia.
                          </p>
                        </div>
                      </div>
                    </div>

                    <FlowBuilder
                      flow={activeFlow}
                      messageTemplates={messageTemplatesDraft}
                      conditionFieldOptions={conditionFieldOptions}
                      conditionOperatorLabels={conditionOperatorLabels}
                      getConditionOptionLabel={getConditionOptionLabel}
                      delayUnitLabels={delayUnitLabels}
                      flowActionLabels={flowActionLabels}
                      getConditionValueOptions={getConditionValueOptions}
                      leadStatuses={leadStatuses}
                      onChangeGraph={(graph) =>
                        handleUpdateFlowGraph(activeFlow.id, graph)
                      }
                      onTriggerChange={(
                        triggerType,
                        triggerStatuses,
                        triggerDurationHours,
                      ) => {
                        handleUpdateFlow(activeFlow.id, {
                          triggerType,
                          triggerStatuses,
                          triggerDurationHours,
                        });
                      }}
                    />

                    <div className="space-y-3 rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--panel-text)]">
                            Condições de saída
                          </h4>
                          <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                            Defina quando este fluxo deve ser encerrado
                            automaticamente.
                          </p>
                        </div>
                        <Button
                          onClick={() =>
                            handleAddFlowExitCondition(activeFlow.id)
                          }
                          variant="secondary"
                          size="sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Nova condição
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--panel-text-muted)]">
                        <span>Encerrar quando</span>
                        <div className="w-52">
                          <FilterSingleSelect
                            icon={AlertCircle}
                            size="compact"
                            value={activeFlow.exitConditionLogic ?? "any"}
                            onChange={(value) =>
                              handleUpdateFlow(activeFlow.id, {
                                exitConditionLogic:
                                  value as AutoContactFlow["exitConditionLogic"],
                              })
                            }
                            placeholder="Lógica"
                            includePlaceholderOption={false}
                            options={[
                              { value: "any", label: "qualquer condição" },
                              { value: "all", label: "todas as condições" },
                            ]}
                          />
                        </div>
                        <span>forem atendidas</span>
                      </div>

                      {(activeFlow.exitConditions ?? []).length === 0 ? (
                        <div className="text-xs text-[var(--panel-text-muted)] bg-[color:var(--panel-surface)] border border-dashed border-[var(--panel-border-subtle)] rounded-lg p-3">
                          Nenhuma condição de saída configurada. O fluxo seguirá
                          até a última ação.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(activeFlow.exitConditions ?? []).map(
                            (condition) => (
                              <div
                                key={condition.id}
                                className="grid gap-2 rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3 md:grid-cols-[160px_160px_1fr_auto]"
                              >
                                {(() => {
                                  const valueOptions = getConditionValueOptions(
                                    condition.field,
                                  );
                                  return (
                                    <>
                                      <FilterSingleSelect
                                        icon={AlertCircle}
                                        size="compact"
                                        value={condition.field}
                                        onChange={(value) => {
                                          const nextField =
                                            value as AutoContactFlowCondition["field"];
                                          const nextUpdates =
                                            nextField === "event"
                                              ? {
                                                  field: nextField,
                                                  operator:
                                                    "equals" as AutoContactFlowCondition["operator"],
                                                  value: "lead_created",
                                                }
                                              : nextField === "whatsapp_valid"
                                                ? {
                                                    field: nextField,
                                                    operator:
                                                      "equals" as AutoContactFlowCondition["operator"],
                                                    value: "true",
                                                  }
                                                : {
                                                    field: nextField,
                                                    value: "",
                                                  };
                                          handleUpdateFlowExitCondition(
                                            activeFlow.id,
                                            condition.id,
                                            nextUpdates,
                                          );
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
                                      {!isEventLeadCreated(condition) && (
                                        <FilterSingleSelect
                                          icon={AlertCircle}
                                          size="compact"
                                          value={condition.operator}
                                          onChange={(value) =>
                                            handleUpdateFlowExitCondition(
                                              activeFlow.id,
                                              condition.id,
                                              {
                                                operator:
                                                  value as AutoContactFlowCondition["operator"],
                                              },
                                            )
                                          }
                                          placeholder="Operador"
                                          includePlaceholderOption={false}
                                          options={Object.entries(
                                            conditionOperatorLabels,
                                          ).map(([value, label]) => ({
                                            value,
                                            label,
                                          }))}
                                        />
                                      )}
                                      {!isEventLeadCreated(condition) &&
                                        (valueOptions ? (
                                          <FilterSingleSelect
                                            icon={AlertCircle}
                                            size="compact"
                                            value={condition.value}
                                            onChange={(value) =>
                                              handleUpdateFlowExitCondition(
                                                activeFlow.id,
                                                condition.id,
                                                {
                                                  value,
                                                },
                                              )
                                            }
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
                                            onChange={(event) =>
                                              handleUpdateFlowExitCondition(
                                                activeFlow.id,
                                                condition.id,
                                                {
                                                  value: event.target.value,
                                                },
                                              )
                                            }
                                            size="compact"
                                            placeholder="Digite o valor"
                                          />
                                        ))}
                                      <Button
                                        onClick={() =>
                                          handleRemoveFlowExitCondition(
                                            activeFlow.id,
                                            condition.id,
                                          )
                                        }
                                        variant="danger"
                                        size="sm"
                                      >
                                        Remover
                                      </Button>
                                    </>
                                  );
                                })()}
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--panel-text)]">
                          Tags e categorização
                        </h4>
                        <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                          Organize e encontre fluxos rapidamente com etiquetas
                          personalizadas.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(activeFlow.tags ?? []).length > 0 ? (
                          (activeFlow.tags ?? []).map((tagItem) => (
                            <span
                              key={tagItem}
                              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--panel-surface)] border border-[var(--panel-border-subtle)] px-2 py-1 text-xs text-[var(--panel-text-soft)]"
                            >
                              #{tagItem}
                              <Button
                                onClick={() =>
                                  handleRemoveFlowTag(activeFlow.id, tagItem)
                                }
                                variant="icon"
                                size="icon"
                                className="h-5 w-5 text-[var(--panel-text-subtle)] hover:bg-[color:var(--panel-surface-muted)] hover:text-[var(--panel-text-soft)]"
                              >
                                ×
                              </Button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--panel-text-muted)]">
                            Nenhuma tag adicionada.
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex-1">
                          <Input
                            type="text"
                            value={tagDraft}
                            onChange={(event) =>
                              setTagDraft(event.target.value)
                            }
                            placeholder="Adicionar tag (ex.: premium, inbound)"
                          />
                        </div>
                        <Button
                          onClick={() => handleAddFlowTag(activeFlow.id)}
                          variant="secondary"
                          size="sm"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-[var(--panel-text-muted)]">
                        Status final se não houver resposta
                      </label>
                      {showStatusSelect ? (
                        <FilterSingleSelect
                          icon={Tag}
                          value={activeFlow.finalStatus ?? ""}
                          onChange={(value) =>
                            handleUpdateFlow(activeFlow.id, {
                              finalStatus: value,
                            })
                          }
                          placeholder="Não alterar status"
                          includePlaceholderOption={false}
                          options={[
                            { value: "", label: "Não alterar status" },
                            ...statusOptions.map((status) => ({
                              value: status.nome,
                              label: status.nome,
                            })),
                          ]}
                        />
                      ) : (
                        <Input
                          type="text"
                          value={activeFlow.finalStatus ?? ""}
                          onChange={(event) =>
                            handleUpdateFlow(activeFlow.id, {
                              finalStatus: event.target.value,
                            })
                          }
                          placeholder="Ex.: Sem retorno"
                        />
                      )}
                    </div>

                    {flowEditorMode === "basic" && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--panel-text)]">
                              Sequência de ações
                            </h4>
                            <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                              Cada etapa representa uma ação. Configure o
                              intervalo, o tipo de ação e, se necessário, o
                              conteúdo da mensagem.
                            </p>
                          </div>
                          <Button
                            onClick={() => handleAddFlowStep(activeFlow.id)}
                            variant="secondary"
                            size="sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Nova etapa
                          </Button>
                        </div>

                        {activeFlow.steps.map((step, stepIndex) => (
                          <div
                            key={step.id}
                            className="grid gap-3 rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-3"
                          >
                            <div className="grid gap-3 md:grid-cols-[160px_160px_1fr_auto]">
                              <div>
                                <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                  Esperar
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={step.delayValue}
                                  onChange={(event) =>
                                    handleUpdateFlowStep(
                                      activeFlow.id,
                                      step.id,
                                      {
                                        delayValue: Number(event.target.value),
                                      },
                                    )
                                  }
                                  size="compact"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                  Unidade
                                </label>
                                <FilterSingleSelect
                                  icon={Timer}
                                  value={step.delayUnit ?? "hours"}
                                  onChange={(value) =>
                                    handleUpdateFlowStep(
                                      activeFlow.id,
                                      step.id,
                                      {
                                        delayUnit:
                                          value as AutoContactDelayUnit,
                                      },
                                    )
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
                              <div>
                                <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                  Tipo de ação
                                </label>
                                <FilterSingleSelect
                                  icon={Activity}
                                  value={step.actionType ?? "send_message"}
                                  onChange={(value) =>
                                    handleUpdateFlowStep(
                                      activeFlow.id,
                                      step.id,
                                      {
                                        actionType:
                                          value as AutoContactFlowActionType,
                                      },
                                    )
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
                              <div className="flex items-end">
                                <Button
                                  onClick={() =>
                                    handleRemoveFlowStep(activeFlow.id, step.id)
                                  }
                                  variant="danger"
                                  size="sm"
                                >
                                  Remover
                                </Button>
                              </div>
                            </div>

                            {step.actionType === "send_message" && (
                              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                                <div className="md:col-span-2 text-xs text-[var(--panel-text-muted)]">
                                  Canal ativo: WhatsApp (configurado em
                                  Integrações).
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Origem da mensagem
                                  </label>
                                  <FilterSingleSelect
                                    icon={MessageCircle}
                                    value={step.messageSource ?? "template"}
                                    onChange={(value) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        {
                                          messageSource:
                                            value as AutoContactFlowMessageSource,
                                        },
                                      )
                                    }
                                    placeholder="Origem"
                                    includePlaceholderOption={false}
                                    options={Object.entries(
                                      messageSourceLabels,
                                    ).map(([value, label]) => ({
                                      value,
                                      label,
                                    }))}
                                  />
                                </div>
                                {step.messageSource !== "custom" ? (
                                  <div>
                                    <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                      Template da mensagem
                                    </label>
                                    <FilterSingleSelect
                                      icon={MessageCircle}
                                      value={step.templateId ?? ""}
                                      onChange={(value) =>
                                        handleUpdateFlowStep(
                                          activeFlow.id,
                                          step.id,
                                          { templateId: value },
                                        )
                                      }
                                      placeholder="Template"
                                      includePlaceholderOption={false}
                                      options={[
                                        {
                                          value: "",
                                          label: "Selecione um template",
                                        },
                                        ...messageTemplatesDraft.map(
                                          (template) => ({
                                            value: template.id,
                                            label:
                                              template.name ||
                                              "Modelo sem nome",
                                          }),
                                        ),
                                      ]}
                                    />
                                  </div>
                                ) : (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                        Tipo de mensagem
                                      </label>
                                      <FilterSingleSelect
                                        icon={MessageCircle}
                                        value={
                                          step.customMessage?.type ?? "text"
                                        }
                                        onChange={(value) =>
                                          handleUpdateFlowStep(
                                            activeFlow.id,
                                            step.id,
                                            {
                                              customMessage: {
                                                ...(step.customMessage ?? {}),
                                                type: value as TemplateMessageType,
                                              } as AutoContactFlowCustomMessage,
                                            },
                                          )
                                        }
                                        placeholder="Tipo"
                                        includePlaceholderOption={false}
                                        options={Object.entries(
                                          messageTypeLabels,
                                        ).map(([value, label]) => ({
                                          value,
                                          label,
                                        }))}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                        URL da mídia (opcional)
                                      </label>
                                      <Input
                                        type="text"
                                        value={
                                          step.customMessage?.mediaUrl ?? ""
                                        }
                                        onChange={(event) =>
                                          handleUpdateFlowStep(
                                            activeFlow.id,
                                            step.id,
                                            {
                                              customMessage: {
                                                ...(step.customMessage ?? {}),
                                                mediaUrl: event.target.value,
                                              } as AutoContactFlowCustomMessage,
                                            },
                                          )
                                        }
                                        size="compact"
                                        placeholder="https://..."
                                      />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                        Texto/legenda
                                      </label>
                                      <VariableAutocompleteTextarea
                                        value={step.customMessage?.text ?? ""}
                                        onChange={(value) =>
                                          handleUpdateFlowStep(
                                            activeFlow.id,
                                            step.id,
                                            {
                                              customMessage: {
                                                ...(step.customMessage ?? {}),
                                                text: value,
                                              } as AutoContactFlowCustomMessage,
                                            },
                                          )
                                        }
                                        rows={2}
                                        size="compact"
                                        suggestions={
                                          AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                                        }
                                        placeholder="Digite a mensagem"
                                      />
                                    </div>
                                    {step.customMessage?.type ===
                                      "document" && (
                                      <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                          Nome do arquivo (opcional)
                                        </label>
                                        <Input
                                          type="text"
                                          value={
                                            step.customMessage?.filename ?? ""
                                          }
                                          onChange={(event) =>
                                            handleUpdateFlowStep(
                                              activeFlow.id,
                                              step.id,
                                              {
                                                customMessage: {
                                                  ...(step.customMessage ?? {}),
                                                  filename: event.target.value,
                                                } as AutoContactFlowCustomMessage,
                                              },
                                            )
                                          }
                                          size="compact"
                                          placeholder="Proposta-plano.pdf"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {step.actionType === "create_task" && (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Título da tarefa
                                  </label>
                                  <Input
                                    type="text"
                                    value={step.taskTitle ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { taskTitle: event.target.value },
                                      )
                                    }
                                    placeholder="Ex.: Retornar contato"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Descrição
                                  </label>
                                  <VariableAutocompleteTextarea
                                    value={step.taskDescription ?? ""}
                                    onChange={(value) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { taskDescription: value },
                                      )
                                    }
                                    rows={3}
                                    size="compact"
                                    suggestions={
                                      AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                                    }
                                    placeholder="Detalhes da tarefa"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Vencimento (horas)
                                  </label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={step.taskDueHours ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        {
                                          taskDueHours: Number(
                                            event.target.value,
                                          ),
                                        },
                                      )
                                    }
                                    placeholder="24"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Prioridade
                                  </label>
                                  <FilterSingleSelect
                                    icon={AlertCircle}
                                    value={step.taskPriority ?? "normal"}
                                    onChange={(value) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        {
                                          taskPriority:
                                            value as AutoContactFlowStep["taskPriority"],
                                        },
                                      )
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
                            )}

                            {step.actionType === "send_email" && (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="md:col-span-2 text-xs text-[var(--panel-text-muted)]">
                                  Envio depende de conta configurada em
                                  Integrações de e-mail.
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Para
                                  </label>
                                  <Input
                                    type="text"
                                    value={step.emailTo ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { emailTo: event.target.value },
                                      )
                                    }
                                    placeholder="email@exemplo.com"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    CC
                                  </label>
                                  <Input
                                    type="text"
                                    value={step.emailCc ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { emailCc: event.target.value },
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    BCC
                                  </label>
                                  <Input
                                    type="text"
                                    value={step.emailBcc ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { emailBcc: event.target.value },
                                      )
                                    }
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Assunto
                                  </label>
                                  <Input
                                    type="text"
                                    value={step.emailSubject ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { emailSubject: event.target.value },
                                      )
                                    }
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Corpo do e-mail
                                  </label>
                                  <VariableAutocompleteTextarea
                                    value={step.emailBody ?? ""}
                                    onChange={(value) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { emailBody: value },
                                      )
                                    }
                                    rows={4}
                                    size="compact"
                                    suggestions={
                                      AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                                    }
                                  />
                                  <p className="text-[11px] text-[var(--panel-text-subtle)] mt-1">
                                    Use variaveis como {"{{primeiro_nome}}"} ou{" "}
                                    {"{{= ... }}"} para formulas.
                                  </p>
                                </div>
                              </div>
                            )}

                            {step.actionType === "webhook" && (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    URL
                                  </label>
                                  <Input
                                    type="text"
                                    value={step.webhookUrl ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { webhookUrl: event.target.value },
                                      )
                                    }
                                    placeholder="https://api.exemplo.com/webhook"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Metodo
                                  </label>
                                  <FilterSingleSelect
                                    icon={Activity}
                                    value={step.webhookMethod ?? "POST"}
                                    onChange={(value) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        {
                                          webhookMethod:
                                            value as AutoContactFlowStep["webhookMethod"],
                                        },
                                      )
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
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Headers (JSON)
                                  </label>
                                  <Input
                                    type="text"
                                    value={step.webhookHeaders ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { webhookHeaders: event.target.value },
                                      )
                                    }
                                    placeholder='{"Authorization":"Bearer ..."}'
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                    Body
                                  </label>
                                  <VariableAutocompleteTextarea
                                    value={step.webhookBody ?? ""}
                                    onChange={(value) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { webhookBody: value },
                                      )
                                    }
                                    rows={4}
                                    size="compact"
                                    suggestions={
                                      AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                                    }
                                    placeholder='{"lead_id":"{{= lead.id }}"}'
                                  />
                                  <p className="text-[11px] text-[var(--panel-text-subtle)] mt-1">
                                    Se vazio, envia JSON padrão com dados do
                                    lead.
                                  </p>
                                </div>
                              </div>
                            )}

                            {step.actionType === "update_status" && (
                              <div>
                                <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                  Novo status do lead
                                </label>
                                {showStatusSelect ? (
                                  <FilterSingleSelect
                                    icon={Tag}
                                    value={step.statusToSet ?? ""}
                                    onChange={(value) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { statusToSet: value },
                                      )
                                    }
                                    placeholder="Selecione um status"
                                    includePlaceholderOption={false}
                                    options={[
                                      {
                                        value: "",
                                        label: "Selecione um status",
                                      },
                                      ...statusOptions.map((status) => ({
                                        value: status.nome,
                                        label: status.nome,
                                      })),
                                    ]}
                                  />
                                ) : (
                                  <Input
                                    type="text"
                                    value={step.statusToSet ?? ""}
                                    onChange={(event) =>
                                      handleUpdateFlowStep(
                                        activeFlow.id,
                                        step.id,
                                        { statusToSet: event.target.value },
                                      )
                                    }
                                    placeholder="Ex.: Em negociação"
                                  />
                                )}
                              </div>
                            )}

                            {(step.actionType === "archive_lead" ||
                              step.actionType === "delete_lead") && (
                              <div className="rounded-lg border border-[var(--panel-accent-border)] bg-[color:var(--panel-accent-soft)] px-3 py-2 text-xs text-[var(--panel-accent-ink)]">
                                Esta ação será aplicada automaticamente ao lead
                                ao chegar nesta etapa.
                              </div>
                            )}

                            <div className="text-[11px] text-[var(--panel-text-muted)]">
                              Etapa {stepIndex + 1} da sequência.
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {showSimulation && (
                      <div className="space-y-4 rounded-2xl border border-[var(--panel-accent-border)] bg-gradient-to-br from-[color:var(--panel-accent-soft)] via-[color:var(--panel-surface)] to-[color:var(--panel-accent-warm)] p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--panel-accent-ink-strong)]">
                              <Timer className="w-4 h-4" />
                              Simulação operacional
                            </div>
                            <p className="text-xs text-[var(--panel-accent-ink-strong)]">
                              Dry run do fluxo. Nenhuma mensagem é enviada;
                              mostramos somente a previsão de execução.
                            </p>
                          </div>
                          <div className="rounded-full border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] px-3 py-1 text-[11px] font-medium text-[var(--panel-accent-ink)]">
                            Lead de exemplo + agenda do fluxo
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                          <div className="rounded-xl border border-[var(--panel-accent-border)] bg-[color:color-mix(in_srgb,var(--panel-surface)_90%,transparent)] p-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-semibold text-[var(--panel-accent-ink)]">
                                  Início da simulação
                                </label>
                                <DateTimePicker
                                  type="datetime-local"
                                  value={simulationInputValue}
                                  onChange={setSimulationStart}
                                  triggerClassName="border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)]"
                                  placeholder="Selecionar inicio"
                                />
                              </div>
                              <div className="grid gap-2 text-xs text-[var(--panel-accent-ink-strong)]">
                                <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--panel-accent-border)_55%,transparent)] bg-[color:var(--panel-accent-soft)] px-3 py-2">
                                  <span className="font-semibold">Janela:</span>{" "}
                                  {activeFlowScheduling.startHour} ate{" "}
                                  {activeFlowScheduling.endHour}
                                </div>
                                <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--panel-accent-border)_55%,transparent)] bg-[color:var(--panel-accent-soft)] px-3 py-2">
                                  <span className="font-semibold">Fuso:</span>{" "}
                                  {activeFlowScheduling.timezone}
                                </div>
                                <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--panel-accent-border)_55%,transparent)] bg-[color:var(--panel-accent-soft)] px-3 py-2">
                                  <span className="font-semibold">Dias:</span>{" "}
                                  {activeFlowScheduling.allowedWeekdays.length
                                    ? weekdayLabels
                                        .filter((day) =>
                                          activeFlowScheduling.allowedWeekdays.includes(
                                            day.value,
                                          ),
                                        )
                                        .map((day) => day.label)
                                        .join(", ")
                                    : "nenhum selecionado"}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] p-4">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-accent-ink)]">
                                <ClipboardList className="h-3.5 w-3.5" />
                                Etapas
                              </div>
                              <div className="mt-2 text-2xl font-semibold text-[var(--panel-text)]">
                                {simulationSummary?.totalSteps ?? 0}
                              </div>
                              <div className="text-xs text-[var(--panel-text-muted)]">
                                Acoes previstas no fluxo atual.
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] p-4">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-accent-ink)]">
                                <AlarmClock className="h-3.5 w-3.5" />
                                Ajustes
                              </div>
                              <div className="mt-2 text-2xl font-semibold text-[var(--panel-text)]">
                                {simulationSummary?.adjustedSteps ?? 0}
                              </div>
                              <div className="text-xs text-[var(--panel-text-muted)]">
                                Etapas movidas por regras de agenda.
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] p-4 sm:col-span-2">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-accent-ink)]">
                                <Activity className="h-3.5 w-3.5" />
                                Janela estimada
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-[var(--panel-text-soft)]">
                                <div>
                                  Primeiro disparo:{" "}
                                  <span className="font-medium text-[var(--panel-text)]">
                                    {simulationSummary?.firstAt
                                      ? formatSimulationDateTime(
                                          simulationSummary.firstAt,
                                          activeFlowScheduling.timezone,
                                        )
                                      : "aguardando dados"}
                                  </span>
                                </div>
                                <div>
                                  Ultima execucao:{" "}
                                  <span className="font-medium text-[var(--panel-text)]">
                                    {simulationSummary?.lastAt
                                      ? formatSimulationDateTime(
                                          simulationSummary.lastAt,
                                          activeFlowScheduling.timezone,
                                        )
                                      : "aguardando dados"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {simulationSummary &&
                          Object.keys(simulationSummary.actionCounts).length >
                            0 && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(
                                simulationSummary.actionCounts,
                              ).map(([actionType, count]) => (
                                <span
                                  key={actionType}
                                  className="rounded-full border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] px-3 py-1 text-[11px] text-[var(--panel-accent-ink-strong)]"
                                >
                                  {count}x{" "}
                                  {flowActionLabels[
                                    actionType as AutoContactFlowActionType
                                  ] ?? actionType}
                                </span>
                              ))}
                            </div>
                          )}

                        {simulationIssues.length > 0 && (
                          <div className="rounded-xl border border-[var(--panel-accent-strong)] bg-[color:color-mix(in_srgb,var(--panel-accent-warm)_70%,transparent)] p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--panel-accent-ink-strong)]">
                              <AlertCircle className="h-4 w-4" />
                              Pontos para revisar antes de confiar na simulação
                            </div>
                            <div className="mt-3 grid gap-2">
                              {simulationIssues.map((issue) => (
                                <div
                                  key={issue}
                                  className="rounded-lg border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] px-3 py-2 text-xs text-[var(--panel-accent-ink-strong)]"
                                >
                                  {issue}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--panel-text)]">
                              <Timer className="h-4 w-4 text-[var(--panel-accent-ink)]" />
                              Linha do tempo prevista
                            </div>

                            {simulationTimeline.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[var(--panel-accent-strong)] bg-[color:color-mix(in_srgb,var(--panel-surface)_80%,transparent)] p-5 text-sm text-[var(--panel-text-soft)]">
                                {simulationIssues.length > 0
                                  ? "A simulação ficou incompleta porque ainda existem configurações pendentes."
                                  : "Adicione etapas para visualizar a linha do tempo."}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {simulationTimeline.map((item) => (
                                  <div
                                    key={item.step.id}
                                    className="rounded-xl border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] p-4 shadow-sm"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-accent-ink)]">
                                          Etapa {item.index}
                                        </div>
                                        <div className="text-sm font-semibold text-[var(--panel-text)]">
                                          {getSimulationStepLabel(item.step)}
                                        </div>
                                        <div className="text-xs text-[var(--panel-text-muted)]">
                                          {formatDelayLabel(
                                            item.delayValue,
                                            item.delayUnit,
                                          )}{" "}
                                          apos o marco anterior
                                        </div>
                                      </div>
                                      <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--panel-accent-border)_55%,transparent)] bg-[color:var(--panel-accent-soft)] px-3 py-2 text-right text-xs text-[var(--panel-accent-ink-strong)]">
                                        {formatSimulationDateTime(
                                          item.scheduledAt,
                                          activeFlowScheduling.timezone,
                                        )}
                                      </div>
                                    </div>
                                    {item.adjustmentReasons.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {item.adjustmentReasons.map(
                                          (reason) => (
                                            <span
                                              key={item.step.id + "-" + reason}
                                              className="rounded-full border border-[var(--panel-accent-border)] bg-[color:var(--panel-accent-soft)] px-2.5 py-1 text-[11px] text-[var(--panel-accent-ink-strong)]"
                                            >
                                              Ajustado por{" "}
                                              {adjustmentReasonLabels[reason]}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--panel-text)]">
                              <Info className="h-4 w-4 text-[var(--panel-accent-ink)]" />
                              Contexto da simulação
                            </div>
                            <div className="rounded-xl border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-text-muted)]">
                                Lead de exemplo
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-[var(--panel-text-soft)]">
                                <div>
                                  <span className="font-semibold text-[var(--panel-text)]">
                                    Nome:
                                  </span>{" "}
                                  {simulationLead.nome_completo}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--panel-text)]">
                                    Status inicial:
                                  </span>{" "}
                                  {simulationLead.status}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--panel-text)]">
                                    Origem:
                                  </span>{" "}
                                  {simulationLead.origem}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--panel-text)]">
                                    Cidade:
                                  </span>{" "}
                                  {simulationLead.cidade}
                                </div>
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--panel-accent-border)] bg-[color:var(--panel-surface)] p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-text-muted)]">
                                Como ler
                              </div>
                              <div className="mt-3 space-y-2 text-xs text-[var(--panel-text-soft)]">
                                <p>
                                  Os horarios ja consideram a janela do fluxo,
                                  os dias permitidos e pulos automaticos da
                                  agenda.
                                </p>
                                <p>
                                  Quando uma etapa não pode rodar no horário
                                  original, ela aparece com o motivo do ajuste.
                                </p>
                                <p>
                                  Se houver pendências de configuração, a
                                  simulação mostra os alertas antes da timeline.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ModalShell>
              )}
            </div>

            <div className="bg-[color:var(--panel-accent-blue-bg)] border border-[var(--panel-accent-blue-border)] rounded-lg p-3 text-sm text-[var(--panel-accent-blue-text)] mt-8">
              <div className="font-semibold mb-2">Variáveis disponíveis:</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span>
                  <code className="bg-[color:var(--panel-accent-blue-bg-strong)] px-1.5 py-0.5 rounded">
                    {"{{nome}}"}
                  </code>{" "}
                  nome completo
                </span>
                <span>
                  <code className="bg-[color:var(--panel-accent-blue-bg-strong)] px-1.5 py-0.5 rounded">
                    {"{{primeiro_nome}}"}
                  </code>{" "}
                  primeiro nome
                </span>
                <span>
                  <code className="bg-[color:var(--panel-accent-blue-bg-strong)] px-1.5 py-0.5 rounded">
                    {"{{origem}}"}
                  </code>{" "}
                  origem do lead
                </span>
                <span>
                  <code className="bg-[color:var(--panel-accent-blue-bg-strong)] px-1.5 py-0.5 rounded">
                    {"{{cidade}}"}
                  </code>{" "}
                  cidade
                </span>
                <span>
                  <code className="bg-[color:var(--panel-accent-blue-bg-strong)] px-1.5 py-0.5 rounded">
                    {"{{responsavel}}"}
                  </code>{" "}
                  responsável
                </span>
              </div>
            </div>

            <div className="border-t border-[var(--panel-border-subtle)] pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--panel-text)]">
                    Biblioteca de templates
                  </h3>
                  <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                    Crie e edite templates pré-fabricados para usar na automação
                    ou em disparos manuais.
                  </p>
                </div>
                <Button
                  onClick={handleAddTemplate}
                  variant="secondary"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  Novo modelo
                </Button>
              </div>

              {messageTemplatesDraft.length === 0 ? (
                <div className="text-sm text-[var(--panel-text-muted)] bg-[color:var(--panel-surface-soft)] border border-[var(--panel-border-subtle)] rounded-lg p-4">
                  Nenhum modelo cadastrado. Clique em "Novo modelo" para
                  adicionar mensagens rápidas.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {messageTemplatesDraft.map((template, index) => {
                    const previewMessages = getTemplateMessages(template).slice(
                      0,
                      2,
                    );
                    return (
                      <div
                        key={template.id}
                        className="rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold text-[var(--panel-text)]">
                                {template.name?.trim() || `Modelo ${index + 1}`}
                              </h4>
                            </div>
                            <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                              {getTemplateMessages(template).length} mensagens
                              configuradas
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleEditTemplate(template.id)}
                              variant="secondary"
                              size="sm"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </Button>
                            <Button
                              onClick={() => handleRemoveTemplate(template.id)}
                              variant="danger"
                              size="icon"
                              className="h-8 w-8"
                              title="Remover modelo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {previewMessages.length > 0 ? (
                            previewMessages.map((message, messageIndex) => {
                              const Icon = messageTypeIcons[message.type];
                              const content =
                                message.type === "text"
                                  ? message.text?.trim()
                                  : message.caption?.trim() ||
                                    message.mediaUrl?.trim() ||
                                    "Conteúdo pendente";
                              return (
                                <div
                                  key={message.id}
                                  className="flex gap-2 rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] px-3 py-2"
                                >
                                  <Icon className="w-4 h-4 text-[var(--panel-text-subtle)] mt-0.5" />
                                  <div>
                                    <div className="text-[11px] uppercase font-semibold text-[var(--panel-text-muted)]">
                                      {messageTypeLabels[message.type]}{" "}
                                      {messageIndex + 1}
                                    </div>
                                    <p className="text-xs text-[var(--panel-text-soft)] whitespace-pre-wrap">
                                      {content || "Sem conteúdo"}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-[var(--panel-text-muted)]">
                              Nenhuma mensagem configurada ainda. Abra para
                              editar.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {isTemplateModalOpen && templateDraft && (
            <ModalShell
              isOpen
              onClose={handleCloseTemplateModal}
              title={
                templateModalMode === "create"
                  ? "Novo template"
                  : "Editar template"
              }
              size="lg"
              panelClassName="config-transparent-buttons max-w-3xl"
            >
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--panel-text-soft)] mb-2">
                    Nome do template
                  </label>
                  <Input
                    type="text"
                    value={templateDraft.name}
                    onChange={(event) =>
                      handleUpdateTemplateDraft({ name: event.target.value })
                    }
                    placeholder="Ex.: Boas-vindas VIP"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--panel-text)]">
                        Mensagens do template
                      </h4>
                      <p className="text-xs text-[var(--panel-text-muted)] mt-1">
                        Combine textos, mídias, áudios e documentos em uma
                        sequência completa.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleAddDraftMessage("text")}
                        variant="secondary"
                        size="sm"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Texto
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("image")}
                        variant="secondary"
                        size="sm"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Imagem
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("video")}
                        variant="secondary"
                        size="sm"
                      >
                        <Film className="w-3.5 h-3.5" />
                        Vídeo
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("audio")}
                        variant="secondary"
                        size="sm"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        Áudio
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("document")}
                        variant="secondary"
                        size="sm"
                      >
                        <File className="w-3.5 h-3.5" />
                        Documento
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {templateDraft.messages.map((message, index) => {
                      const Icon = messageTypeIcons[message.type];
                      const mediaLabel =
                        message.type === "image"
                          ? "URL da imagem"
                          : message.type === "video"
                            ? "URL do vídeo"
                            : message.type === "audio"
                              ? "URL do áudio"
                              : message.type === "document"
                                ? "URL do documento"
                                : "URL da mídia";
                      return (
                        <div
                          key={message.id}
                          className="rounded-lg border border-[var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-[var(--panel-text-subtle)]" />
                              <span className="text-xs font-semibold text-[var(--panel-text-muted)] uppercase">
                                Mensagem {index + 1}
                              </span>
                              <div className="w-44">
                                <FilterSingleSelect
                                  icon={MessageCircle}
                                  size="compact"
                                  value={message.type}
                                  onChange={(value) =>
                                    handleUpdateDraftMessage(message.id, {
                                      type: value as TemplateMessageType,
                                    })
                                  }
                                  placeholder="Tipo"
                                  includePlaceholderOption={false}
                                  options={Object.entries(
                                    messageTypeLabels,
                                  ).map(([value, label]) => ({
                                    value,
                                    label,
                                  }))}
                                />
                              </div>
                            </div>
                            <Button
                              onClick={() =>
                                handleRemoveDraftMessage(message.id)
                              }
                              variant="danger"
                              size="sm"
                            >
                              Remover
                            </Button>
                          </div>

                          {message.type === "text" ? (
                            <VariableAutocompleteTextarea
                              value={message.text ?? ""}
                              onChange={(value) =>
                                handleUpdateDraftMessage(message.id, {
                                  text: value,
                                })
                              }
                              rows={3}
                              size="compact"
                              suggestions={
                                AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                              }
                              placeholder="Digite a mensagem..."
                            />
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                  {mediaLabel}
                                </label>
                                <Input
                                  type="text"
                                  value={message.mediaUrl ?? ""}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, {
                                      mediaUrl: event.target.value,
                                    })
                                  }
                                  size="compact"
                                  placeholder="https://..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-[var(--panel-text-muted)] mb-1">
                                  Legenda ou descrição
                                </label>
                                <Input
                                  type="text"
                                  value={message.caption ?? ""}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, {
                                      caption: event.target.value,
                                    })
                                  }
                                  size="compact"
                                  placeholder="Ex.: Guia em PDF, áudio de explicação..."
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="text-xs text-[var(--panel-text-muted)]">
                Este botão salva o template na biblioteca e no banco de dados.
                Para aplicar mudanças nos fluxos, finalize com "Salvar
                automação".
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  onClick={handleCloseTemplateModal}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveTemplateDraft}
                  loading={savingTemplate}
                  className="w-full sm:w-auto"
                >
                  {!savingTemplate && "Salvar template"}
                  {savingTemplate && "Salvando..."}
                </Button>
              </div>
            </ModalShell>
          )}
        </div>
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
