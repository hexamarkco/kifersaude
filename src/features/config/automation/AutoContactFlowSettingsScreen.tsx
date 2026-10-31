import { ButtonGroup, Text, Heading, FieldLabel, InfoTooltip } from '../../../design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
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
  Save,
  ShieldCheck,
  Tag,
  Timer,
  Trash2,
} from "lucide-react";

import { configService } from "../data/configService";
import { useConfig } from "../../../contexts/ConfigContext";
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  composeTemplateMessage,
  buildAutoContactScheduleTimeline,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_AUTO_CONTACT_FLOWS,
  getTemplateMessages,
  getAutoContactFlowMessageItems,
  isAutoContactRuntimeEnabled,
  normalizeAutoContactSettings,
  type AutoContactDelayUnit,
  type AutoContactScheduleAdjustmentReason,
  type AutoContactFlow,
  type AutoContactFlowActionType,
  type AutoContactFlowCondition,
  type AutoContactFlowTriggerType,
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
import type { IntegrationSetting } from "../domain/types";
import type { Lead, LeadStatusConfig } from "../../leads";
import { toast } from "../../../lib/toast";
import FlowBuilder from "./components/FlowBuilder";
import AutomationFlowsWorkspace from "./components/AutomationFlowsWorkspace";
import { MessageListEditor } from "./components/MessageListEditor";
import { VariableAutocompleteTextarea } from '../../../design-system';
import { AutomationFlowsSkeleton } from '../../../design-system';
import { useAdaptiveLoading } from "../../../hooks/useAdaptiveLoading";
import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { PanelAdaptiveLoadingFrame } from '../../../design-system';
import {
  countDailyAutomationInteractions,
  previewAutomationFlowMessage,
  sendAutomationFlowTest,
} from "./data/automationApi";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardIcon,
  DateTimePicker as DesignSystemDateTimePicker,
  Input,
  OperationalMetricChip,
  Surface,
  Switch,
  FilterSelect,
  IconButton,
  DialogShell,
  PageHeader,
  SegmentedControl,
} from "../../../design-system";

type TemplateDraft = {
  id: string;
  name: string;
  messages: TemplateMessage[];
};

export default function AutoContactFlowSettingsScreen() {
  const { leadOrigins, options } = useConfig();
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const activeFlowId = searchParams.get("flowId");
  const defaultSettings = useMemo(() => normalizeAutoContactSettings(null), []);
  const [autoSendEnabled, setAutoSendEnabled] = useState(
    isAutoContactRuntimeEnabled(defaultSettings),
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
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
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
  const [activeWorkspace, setActiveWorkspace] = useState<
    "flows" | "templates" | "operation"
  >("flows");
  const [tagDraft, setTagDraft] = useState("");
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationStart, setSimulationStart] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("Contato de teste");
  const [testStepId, setTestStepId] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(() => new Date());
  const [dailyAutomationCount, setDailyAutomationCount] = useState<
    number | null
  >(null);
  const [dailyAutomationLoading, setDailyAutomationLoading] = useState(false);
  const [dailyAutomationError, setDailyAutomationError] = useState<
    string | null
  >(null);
  const [flowEditorMode] = useState<"basic" | "advanced">("advanced");
  const [flowDetailTab, setFlowDetailTab] = useState<
    "journey" | "settings" | "test"
  >("journey");
  const autoSaveReadyRef = useRef(false);
  const autoSaveSkipRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const autoSaveQueuedRef = useRef(false);
  const autoSaveRunnerRef = useRef<((skipStateUpdates?: boolean) => void) | null>(null);
  const autoSaveUnmountedRef = useRef(false);
  const autoSaveDraftVersionRef = useRef(0);
  const settingsLoadRequestIdRef = useRef(0);
  const dailyAutomationRequestIdRef = useRef(0);
  const openFlowEditor = (flowId: string) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", "automation");
      next.set("flowId", flowId);
      return next;
    });
  };
  const closeFlowEditor = () => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", "automation");
      next.delete("flowId");
      return next;
    }, { replace: true });
  };
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
    return () => {
      settingsLoadRequestIdRef.current += 1;
      dailyAutomationRequestIdRef.current += 1;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAutoContactSettings = async () => {
    const requestId = ++settingsLoadRequestIdRef.current;
    setLoadingFlow(true);

    try {
      const [integration, statusConfig] = await Promise.all([
        configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG),
        configService.getLeadStatusConfig(),
      ]);
      if (requestId !== settingsLoadRequestIdRef.current) return;

      const normalized = normalizeAutoContactSettings(integration?.settings);

      setAutoContactIntegration(integration);
      setAutoContactSettings(normalized);
      setAutoSendEnabled(isAutoContactRuntimeEnabled(normalized));
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      const normalizedFlows = normalized.flows ?? [];
      setFlowDrafts(filterDerivedFlows(normalizedFlows));
      setSchedulingDraft(normalized.scheduling);
      setMonitoringDraft(normalized.monitoring);
      setLoggingDraft(normalized.logging);
      setLeadStatuses(statusConfig);
    } finally {
      if (requestId === settingsLoadRequestIdRef.current) {
        setLoadingFlow(false);
      }
    }
  };

  const buildAutomationSettingsPayload = useCallback(
    (
      currentSettings: AutoContactSettings,
      overrides: Partial<AutoContactSettings>,
    ): AutoContactSettings => ({
      ...currentSettings,
      ...overrides,
      enabled: autoSendEnabled ? true : currentSettings.enabled !== false,
      autoSend: autoSendEnabled,
    }),
    [autoSendEnabled],
  );

  const loadDailyAutomationCount = useCallback(async () => {
    const requestId = ++dailyAutomationRequestIdRef.current;
    setDailyAutomationLoading(true);
    setDailyAutomationError(null);

    try {
      const count = await countDailyAutomationInteractions();
      if (requestId !== dailyAutomationRequestIdRef.current) return;
      setDailyAutomationCount(count);
    } catch (error) {
      console.error("Erro ao carregar contador diário de automações:", error);
      if (requestId === dailyAutomationRequestIdRef.current) {
        setDailyAutomationError("Não foi possível carregar o contador diário.");
      }
    } finally {
      if (requestId === dailyAutomationRequestIdRef.current) {
        setDailyAutomationLoading(false);
      }
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

  const persistMessageTemplates = async (
    templates: AutoContactTemplate[],
    successMessage: string,
    errorMessage: string,
  ): Promise<boolean> => {
    if (!autoContactIntegration) {
      toast.error("Integração de automação não configurada.");
      return false;
    }

    setSavingTemplate(true);

    try {
      const currentSettings =
        autoContactSettings || normalizeAutoContactSettings(null);
      const newSettings = buildAutomationSettingsPayload(currentSettings, {
        messageTemplates: templates,
      });
      const { data, error } = await configService.updateIntegrationSetting(
        autoContactIntegration.id,
        { settings: newSettings },
      );

      if (error) {
        toast.error(errorMessage);
        return false;
      }

      const updatedIntegration = data ?? {
        ...autoContactIntegration,
        settings: newSettings,
      };
      const normalized = normalizeAutoContactSettings(
        updatedIntegration.settings,
      );

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      autoSaveSkipRef.current = true;
      setAutoSendEnabled(isAutoContactRuntimeEnabled(normalized));
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      toast.success(successMessage);
      return true;
    } catch {
      toast.error(errorMessage);
      return false;
    } finally {
      setSavingTemplate(false);
    }
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
    await persistMessageTemplates(
      normalizedTemplates,
      "Template salvo no banco de dados.",
      "Erro ao salvar o template. Tente novamente.",
    );
  };

  const handleCloseTemplateModal = () => {
    setIsTemplateModalOpen(false);
    setTemplateDraft(null);
  };

  const handleRemoveTemplate = async (templateId: string) => {
    const template = messageTemplatesDraft.find(
      (item) => item.id === templateId,
    );
    if (!template) return;

    const confirmed = await requestConfirmation({
      title: "Remover template?",
      description: `O modelo "${template.name || "sem nome"}" será removido da biblioteca e salvo imediatamente. Etapas que usam esse modelo poderão usar o primeiro modelo disponível.`,
      confirmLabel: "Remover template",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    const nextTemplates = messageTemplatesDraft.filter(
      (item) => item.id !== templateId,
    );
    setSavingTemplateId(templateId);
    try {
      await persistMessageTemplates(
        nextTemplates,
        "Template removido da automação.",
        "Erro ao remover o template. Tente novamente.",
      );
    } finally {
      setSavingTemplateId(null);
    }
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

  const handleSaveFlow = async (
    flowsToSave: AutoContactFlow[] = flowDrafts,
    successMessage = "Fluxos e templates de automação salvos com sucesso.",
  ): Promise<boolean> => {
    if (!autoContactIntegration) {
      toast.error("Integração de automação não configurada.");
      return false;
    }

    const emptyAiInstruction = flowsToSave.some((flow) =>
      flow.steps.some((step) =>
        step.actionType === "send_message" &&
        (step.messages ?? []).some((item) => "ai" in item && !item.ai.instruction.trim()),
      ),
    );
    if (emptyAiInstruction) {
      toast.error("Preencha a instrução de todas as mensagens IA antes de salvar.");
      return false;
    }

    setSavingFlow(true);

    const sanitizedTemplates = normalizeTemplatesForSettings(
      messageTemplatesDraft,
      true,
    );
    const fallbackTemplateId = sanitizedTemplates[0]?.id ?? "";
    const sanitizedFlows: AutoContactFlow[] = flowsToSave
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
                messages: (() => {
                  if (!Array.isArray(step.messages)) return undefined;
                  const items: NonNullable<AutoContactFlowStep["messages"]> = [];
                  for (const item of step.messages) {
                    if (!item || typeof item !== "object") continue;
                    if ("templateId" in item && item.templateId.trim()) {
                      items.push({
                        templateId: sanitizedTemplates.some(
                          (template) => template.id === item.templateId,
                        )
                          ? item.templateId
                          : fallbackTemplateId,
                      });
                    } else if ("custom" in item && item.custom && typeof item.custom === "object") {
                      items.push({
                        custom: {
                          type: item.custom.type ?? "text",
                          text: item.custom.text ?? "",
                          mediaUrl: item.custom.mediaUrl ?? "",
                          caption: item.custom.caption ?? "",
                          filename: item.custom.filename ?? "",
                        },
                      });
                    } else if ("ai" in item && item.ai && typeof item.ai === "object") {
                      items.push({
                        ai: { instruction: item.ai.instruction ?? "" },
                      });
                    }
                  }
                  return items;
                })(),
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
          const conditionLogic: AutoContactFlow["conditionLogic"] =
            effectiveFlow.conditionLogic === "any" ? "any" : "all";
          const exitConditionLogic: AutoContactFlow["exitConditionLogic"] =
            effectiveFlow.exitConditionLogic === "all" ? "all" : "any";

          const triggerType: AutoContactFlowTriggerType =
            effectiveFlow.triggerType ?? "lead_created";

          const triggerActivatedAt =
            effectiveFlow.triggerActivatedAt?.trim() ||
            (triggerType === "inactivity_duration"
              ? new Date().toISOString()
              : undefined);

          return {
            id: effectiveFlow.id?.trim() ? effectiveFlow.id : `flow-${flowKey}`,
            name: effectiveFlow.name?.trim() || `Fluxo ${flowIndex + 1}`,
            triggerStatus: effectiveFlow.triggerStatus?.trim() || "",
            triggerType,
            ativo: effectiveFlow.ativo !== false,
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
            triggerActivatedAt,
            steps,
            finalStatus: effectiveFlow.finalStatus?.trim() || "",
            invalidNumberAction: effectiveFlow.invalidNumberAction ?? "none",
            invalidNumberStatus:
              effectiveFlow.invalidNumberStatus?.trim() || "",
            conditionLogic,
            conditions,
            exitConditionLogic,
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
    const newSettings = buildAutomationSettingsPayload(currentSettings, {
      messageTemplates: sanitizedTemplates,
      flows: sanitizedFlows,
      scheduling: schedulingDraft,
      monitoring: monitoringDraft,
      logging: loggingDraft,
    });

    let result: { data: IntegrationSetting | null; error: unknown };
    try {
      result = await configService.updateIntegrationSetting(
        autoContactIntegration.id,
        { settings: newSettings },
      );
    } catch {
      toast.error("Erro ao salvar a configuração. Tente novamente.");
      setSavingFlow(false);
      return false;
    }

    if (result.error) {
      toast.error("Erro ao salvar a configuração. Tente novamente.");
      setSavingFlow(false);
      return false;
    } else {
      const updatedIntegration = result.data ?? {
        ...autoContactIntegration,
        settings: newSettings,
      };
      const normalized = normalizeAutoContactSettings(
        updatedIntegration.settings,
      );

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      autoSaveSkipRef.current = true;
      setAutoSendEnabled(isAutoContactRuntimeEnabled(normalized));
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      setFlowDrafts(filterDerivedFlows(normalized.flows ?? []));
      setSchedulingDraft(normalized.scheduling);
      setMonitoringDraft(normalized.monitoring);
      setLoggingDraft(normalized.logging);
      toast.success(successMessage);
    }

    setSavingFlow(false);
    return true;
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
    proximo_retorno: "Próximo follow-up",
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
  const activeFlowCount = useMemo(
    () => flowDrafts.filter((flow) => flow.ativo !== false).length,
    [flowDrafts],
  );
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
    webhook: "Chamar outro sistema",
    archive_lead: "Arquivar lead",
    delete_lead: "Excluir lead",
    activate_autonomous_service: "Ativar atendimento autônomo (IA)",
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
    openFlowEditor(newFlow.id);
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
  const handleRemoveFlow = async (flowId: string) => {
    const baseId = flowId.endsWith("-nao")
      ? flowId.replace(/-nao$/, "")
      : flowId;
    const flow = flowDrafts.find(
      (item) => item.id === flowId || item.id === baseId,
    );
    if (!flow) return;

    const confirmed = await requestConfirmation({
      title: "Remover fluxo?",
      description: `"${flow.name || "Fluxo sem nome"}" e sua variação vinculada, se houver, serão removidos da automação. A alteração será salva imediatamente.`,
      confirmLabel: "Remover fluxo",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    const nextFlows = flowDrafts.filter(
      (item) => item.id !== baseId && item.id !== `${baseId}-nao`,
    );
    const saved = await handleSaveFlow(nextFlows, "Fluxo removido da automação.");
    if (saved && activeFlowId === flowId) {
      closeFlowEditor();
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
        const messageItems = getAutoContactFlowMessageItems(step);
        const aiItem = messageItems.find((item) => "ai" in item);
        if (aiItem && "ai" in aiItem) {
          const instruction = aiItem.ai.instruction.trim();
          return instruction
            ? `IA: ${instruction.slice(0, 72)}`
            : "Mensagem gerada por IA";
        }
        if (messageItems.length > 1) {
          return `${messageItems.length} mensagens em ordem`;
        }
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
          : "Chamar outro sistema";
      case "archive_lead":
        return "Arquivar lead";
      case "delete_lead":
        return "Excluir lead";
      case "activate_autonomous_service":
        return "Ativar atendimento autônomo (IA)";
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
      ? applyFlowGraphToFlow(activeFlow, buildFlowGraphFromFlow(activeFlow))
      : activeFlow;
  }, [activeFlow]);
  const testableSteps = useMemo(
    () =>
      (simulationFlow?.steps ?? []).filter(
        (step) => step.actionType === "send_message",
      ),
    [simulationFlow],
  );
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
        "A janela diária está com início e fim iguais; revise o horário.",
      );
    }
    simulationFlow.steps.forEach((step, index) => {
      if (step.actionType === "send_message") {
        getAutoContactFlowMessageItems(step).forEach((item, itemIndex) => {
          if ("ai" in item && !item.ai.instruction.trim()) {
            issues.push(`Etapa ${index + 1}, mensagem ${itemIndex + 1}: informe a instrução da IA.`);
          } else if ("templateId" in item) {
            const templateExists = messageTemplatesDraft.some(
              (template) => template.id === item.templateId,
            );
            if (!templateExists) {
              issues.push(`Etapa ${index + 1}, mensagem ${itemIndex + 1}: selecione um template válido.`);
            }
          } else if ("custom" in item && !item.custom.text?.trim() && !item.custom.mediaUrl?.trim()) {
            issues.push(`Etapa ${index + 1}, mensagem ${itemIndex + 1}: a mensagem personalizada está vazia.`);
          }
        });
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
      setFlowDetailTab("journey");
      return;
    }
    setShowSimulation(false);
    setSimulationStart("");
    setTestStepId("");
    setTagDraft("");
    setFlowDetailTab("journey");
  }, [activeFlowId]);

  const handleSendFlowTest = async () => {
    if (!activeFlow) return;
    const stepId = testStepId || testableSteps[0]?.id;
    if (!stepId || !testPhone.trim()) {
      toast.warning("Informe um número de WhatsApp e selecione uma etapa para o teste.");
      return;
    }

    setSendingTest(true);
    try {
      await sendAutomationFlowTest({
        flowId: activeFlow.id,
        stepId,
        phone: testPhone.trim(),
        name: testName.trim() || "Contato de teste",
      });
      toast.success("Mensagem de teste enviada para o número informado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem de teste.");
    } finally {
      setSendingTest(false);
    }
  };

  const handlePreviewAiMessage = async (instruction: string): Promise<string> => {
    if (!activeFlow) throw new Error("Selecione um fluxo para gerar a prévia.");
    try {
      return await previewAutomationFlowMessage({
        flowName: activeFlow.name,
        instruction,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível gerar a prévia da mensagem.";
      toast.error(message);
      throw error;
    }
  };

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
      if (autoSaveInFlightRef.current) {
        autoSaveQueuedRef.current = true;
        return;
      }

      autoSaveInFlightRef.current = true;
      if (!skipStateUpdates) {
        setAutoSaveState("saving");
      }

      const saveVersion = autoSaveDraftVersionRef.current;

      const currentSettings =
        autoContactSettings || normalizeAutoContactSettings(null);
      const newSettings = buildAutomationSettingsPayload(currentSettings, {
        scheduling: schedulingDraft,
        monitoring: monitoringDraft,
        logging: loggingDraft,
      });

      try {
        const { data, error } = await configService.updateIntegrationSetting(
          autoContactIntegration.id,
          {
            settings: newSettings,
          },
        );
        const hasNewerDraft = saveVersion !== autoSaveDraftVersionRef.current;
        if (hasNewerDraft) {
          autoSaveQueuedRef.current = true;
        }
        const hasQueuedSave = autoSaveQueuedRef.current;

        if (error) {
          if (!skipStateUpdates && !hasQueuedSave) {
            setAutoSaveState("error");
          }
        } else if (!skipStateUpdates && !hasQueuedSave) {
          const updatedIntegration = data ?? autoContactIntegration;
          const normalized = normalizeAutoContactSettings(
            updatedIntegration.settings,
          );

          setAutoContactIntegration(updatedIntegration);
          setAutoContactSettings(normalized);
          autoSaveSkipRef.current = true;
          setAutoSendEnabled(isAutoContactRuntimeEnabled(normalized));
          setSchedulingDraft(normalized.scheduling);
          setMonitoringDraft(normalized.monitoring);
          setLoggingDraft(normalized.logging);
          setAutoSaveState("saved");
        }
      } catch (error) {
        console.error("Erro ao salvar configurações de automação:", error);
        if (!skipStateUpdates && !autoSaveQueuedRef.current) {
          setAutoSaveState("error");
        }
      } finally {
        autoSaveInFlightRef.current = false;

        if (autoSaveQueuedRef.current) {
          autoSaveQueuedRef.current = false;
          window.setTimeout(() => {
            autoSaveRunnerRef.current?.(autoSaveUnmountedRef.current);
          }, 0);
        }
      }
    },
    [
      autoContactIntegration,
      autoContactSettings,
      buildAutomationSettingsPayload,
      loggingDraft,
      monitoringDraft,
      schedulingDraft,
    ],
  );

  useEffect(() => {
    autoSaveDraftVersionRef.current += 1;
    autoSaveRunnerRef.current = handleAutoSaveSettings;
  }, [handleAutoSaveSettings]);

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
      autoSaveUnmountedRef.current = true;
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveRunnerRef.current?.(true);
    };
  }, []);

  const hasFlowSnapshot = autoContactIntegration !== null;

  if (!autoContactIntegration && !loadingFlow) {
    return (
      <Alert tone="warning" className="items-start">
        <Info className="w-5 h-5 text-[var(--text-secondary)] mt-1" />
        <div className="space-y-1 text-sm text-[var(--text-primary)]">
          <Text className="font-semibold">
            Integração de automação não encontrada.
          </Text>
          <Text>
            Execute as migrações mais recentes e configure o serviço antes de
            definir os templates de automação.
          </Text>
        </div>
      </Alert>
    );
  }

  return (
    <PanelAdaptiveLoadingFrame
      loading={loadingFlow}
      phase={loadingUi.phase}
      hasContent={hasFlowSnapshot}
      skeleton={<AutomationFlowsSkeleton />}
      overlayLabel="Atualizando fluxos de automação..."
      stageClassName="min-h-[520px]"
    >
      <div className="space-y-6">
        <div className="space-y-6">
          {!activeFlowId && (
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SegmentedControl
              items={[
                { id: "flows", label: "Fluxos" },
                { id: "templates", label: "Templates" },
                { id: "operation", label: "Operação" },
              ]}
              value={activeWorkspace}
              onChange={setActiveWorkspace}
              className="kds-automation-workspace-tabs w-full lg:w-auto"
              listClassName="w-full flex-nowrap overflow-x-auto lg:w-auto"
            />
            <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <span role="status" className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                {autoSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <span className={`h-2 w-2 rounded-full ${autoSaveState === "error" ? "bg-[var(--danger-border)]" : autoSaveState === "saved" ? "bg-[var(--brand-primary)]" : "bg-[var(--border-default)]"}`} aria-hidden="true" />}
                {autoSaveState === "saving" ? "Salvando" : autoSaveState === "saved" ? "Salvo automaticamente" : autoSaveState === "error" ? "Erro ao salvar" : "Autosave ativo"}
              </span>
              {activeWorkspace === "flows" && (
                <Button className="w-full sm:w-auto" onClick={handleAddFlow}>
                  <Plus className="kds-control-icon" aria-hidden="true" />
                  Novo fluxo
                </Button>
              )}
            </div>
            </div>
          )}

          {activeWorkspace === "operation" && (
            <section className="space-y-6" aria-labelledby="automation-operation-heading">
              <Card padding="md" className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <CardIcon>
                      <Activity className="h-5 w-5" aria-hidden="true" />
                    </CardIcon>
                    <div className="min-w-0">
                      <Text className="kds-card-subtitle uppercase tracking-[0.12em]">Resumo operacional</Text>
                      <div className="kds-card-title-row mt-1">
                        <Heading level={3} id="automation-operation-heading" className="kds-card-title">Visão geral da operação</Heading>
                        <InfoTooltip content="Volume dos fluxos e atividade recente das automações." label="Informações sobre o resumo operacional" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge tone={autoSendEnabled ? "success" : "neutral"} size="sm" icon={ShieldCheck}>
                      {autoSendEnabled ? "Envios automáticos ativos" : "Envios automáticos pausados"}
                    </Badge>
                    <Badge
                      tone={autoSaveState === "error" ? "danger" : autoSaveState === "saved" ? "success" : "neutral"}
                      size="sm"
                      icon={autoSaveState === "saving" ? <Loader2 className="kds-control-icon animate-spin" /> : autoSaveState === "error" ? AlertCircle : Save}
                    >
                      {autoSaveState === "saving" ? "Salvando" : autoSaveState === "saved" ? "Salvo automaticamente" : autoSaveState === "error" ? "Erro ao salvar" : "Autosave ativo"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  <OperationalMetricChip icon={<BarChart3 className="h-4 w-4" />} value={metrics.totalFlows} label="fluxos" className="w-full justify-start" />
                  <OperationalMetricChip icon={<Timer className="h-4 w-4" />} value={metrics.totalSteps} label="etapas" className="w-full justify-start" />
                  <OperationalMetricChip icon={<Tag className="h-4 w-4" />} value={metrics.taggedFlows} label="com tags" tone="accent" className="w-full justify-start" />
                  <OperationalMetricChip icon={<Activity className="h-4 w-4" />} value={lastRefreshAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} label="última atualização" tone="info" className="w-full justify-start" />
                  <OperationalMetricChip icon={<AlarmClock className="h-4 w-4" />} value={dailyAutomationLoading ? "..." : (dailyAutomationCount ?? 0)} label="envios hoje" tone={dailyAutomationError ? "warning" : "neutral"} className="w-full justify-start" />
                </div>
                {dailyAutomationError && (
                  <Alert tone="warning" className="items-center">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{dailyAutomationError}</span>
                  </Alert>
                )}
              </Card>

              <section className="space-y-4" aria-labelledby="automation-global-settings-heading">
                <div>
                  <Text className="kds-op-section-label">Preferências da operação</Text>
                  <div className="kds-section-title-row mt-1">
                    <Heading level={3} id="automation-global-settings-heading" className="kds-section-title kds-section-title-h3">Configurações globais</Heading>
                    <InfoTooltip content="Ajuste o envio automático, a agenda e a observabilidade sem alterar as regras individuais dos fluxos." label="Informações sobre as configurações globais" />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card padding="md" className="space-y-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <CardIcon>
                        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                      </CardIcon>
                      <Heading
                        level={4}
                        className="kds-card-title kds-heading-with-info min-w-0 flex flex-1 flex-nowrap items-start gap-2"
                      >
                        <span className="kds-heading-with-info-title min-w-0 flex-1">Envio automático</span>
                        <InfoTooltip
                          content="Pausa ou libera o processamento dos fluxos ativos."
                          label="Informações sobre o processamento dos fluxos"
                          className="shrink-0"
                        />
                      </Heading>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-[var(--kds-radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-3">
                      <div className="min-w-0">
                        <Text className="text-sm font-semibold text-[var(--text-primary)]">Ativar automação</Text>
                        <Text className="mt-1 text-xs text-[var(--text-muted)]">A alteração é salva automaticamente.</Text>
                      </div>
                      <Switch
                        checked={autoSendEnabled}
                        onChange={(event) => setAutoSendEnabled(event.target.checked)}
                        aria-label="Ativar envio automático dos fluxos"
                      />
                    </div>
                  </Card>

                  <Card padding="md" className="space-y-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <CardIcon tone="gold">
                        <AlarmClock className="h-5 w-5" aria-hidden="true" />
                      </CardIcon>
                      <Heading
                        level={4}
                        className="kds-card-title kds-heading-with-info min-w-0 flex flex-1 flex-nowrap items-start gap-2"
                      >
                        <span className="kds-heading-with-info-title min-w-0 flex-1">Agendamento avançado</span>
                        <InfoTooltip
                          content="Fuso horário e regras globais para dias não úteis."
                          label="Informações sobre o calendário operacional"
                          className="shrink-0"
                        />
                      </Heading>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <FieldLabel className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Fuso horário</FieldLabel>
                        <FilterSelect
                          icon={Globe2}
                          value={schedulingDraft.timezone}
                          onChange={(value) => setSchedulingDraft((previous) => ({ ...previous, timezone: value }))}
                          placeholder="Selecione um fuso"
                          includePlaceholderOption={false}
                          options={timezoneOptions}
                          size="md"
                        />
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--kds-radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2">
                        <div className="min-w-0">
                          <Text className="text-sm font-medium text-[var(--text-primary)]">Pausar em feriados</Text>
                          <Text className="mt-1 text-xs text-[var(--text-muted)]">Feriados oficiais e datas extras.</Text>
                        </div>
                        <Switch
                          checked={schedulingDraft.skipHolidays}
                          onChange={(event) => setSchedulingDraft((previous) => ({ ...previous, skipHolidays: event.target.checked }))}
                          aria-label="Pausar envios em feriados nacionais e estaduais"
                        />
                      </div>
                    </div>
                    <Text className="text-xs leading-5 text-[var(--text-muted)]">A janela diária, os dias permitidos e o limite diário são definidos em cada fluxo.</Text>
                  </Card>
                </div>
              </section>

              <Card padding="md" className="space-y-5">
                <div className="flex items-center gap-3">
                  <CardIcon>
                    <ClipboardList className="h-5 w-5" aria-hidden="true" />
                  </CardIcon>
                  <div className="kds-card-title-row">
                    <Heading level={4} className="kds-card-title">Observabilidade e auditoria</Heading>
                    <InfoTooltip content="Defina a frequência do monitoramento e a retenção dos registros." label="Informações sobre observabilidade e auditoria" />
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="space-y-4 xl:border-r xl:border-[var(--border-subtle)] xl:pr-6" aria-labelledby="automation-monitoring-heading">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                         <div className="kds-card-title-row"><Heading level={5} id="automation-monitoring-heading" className="text-sm font-semibold text-[var(--text-primary)]">Monitoramento em tempo real</Heading><InfoTooltip content="Atualiza o painel com o status das execuções." label="Informações sobre o monitoramento em tempo real" /></div>
                      </div>
                      <Switch
                        checked={monitoringDraft.realtimeEnabled}
                        onChange={(event) => setMonitoringDraft((previous) => ({ ...previous, realtimeEnabled: event.target.checked }))}
                        aria-label="Ativar monitoramento em tempo real"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <FieldLabel className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Atualização (segundos)</FieldLabel>
                        <Input
                          type="number"
                          min={5}
                          value={monitoringDraft.refreshSeconds}
                          onChange={(event) => setMonitoringDraft((previous) => ({ ...previous, refreshSeconds: Number(event.target.value) }))}
                          size="md"
                          aria-label="Intervalo de atualização em segundos"
                        />
                      </div>
                      <div className="min-w-0">
                        <FieldLabel className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Última atualização</FieldLabel>
                        <output className="flex min-h-[var(--control-height-md)] items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 text-sm text-[var(--text-secondary)]">
                          {lastRefreshAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </output>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4" aria-labelledby="automation-logging-heading">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                         <div className="kds-card-title-row"><Heading level={5} id="automation-logging-heading" className="text-sm font-semibold text-[var(--text-primary)]">Histórico de atividades</Heading><InfoTooltip content="Guarde as ações realizadas para consultar o que aconteceu." label="Informações sobre o histórico de atividades" /></div>
                      </div>
                      <Switch
                        checked={loggingDraft.enabled}
                        onChange={(event) => setLoggingDraft((previous) => ({ ...previous, enabled: event.target.checked }))}
                        aria-label="Ativar histórico de atividades"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <FieldLabel className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">Retenção (dias)</FieldLabel>
                        <Input
                          type="number"
                          min={7}
                          value={loggingDraft.retentionDays}
                          onChange={(event) => setLoggingDraft((previous) => ({ ...previous, retentionDays: Number(event.target.value) }))}
                          size="md"
                          aria-label="Dias para guardar o histórico"
                        />
                      </div>
                      <div className="flex min-w-0 items-center rounded-[var(--kds-radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2 sm:mt-6">
                        <div className="min-w-0">
                          <Switch
                            checked={loggingDraft.includePayloads}
                            onChange={(event) => setLoggingDraft((previous) => ({ ...previous, includePayloads: event.target.checked }))}
                            label="Salvar conteúdo completo"
                            aria-label="Salvar conteúdo completo no histórico"
                          />
                          <Text className="mt-1 text-xs text-[var(--text-muted)]">Inclui o conteúdo integral dos eventos.</Text>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </Card>
            </section>
          )}

          {activeWorkspace === "flows" && <>
            {autoContactSettings?.enabled === false && (
              <Alert tone="warning" className="mt-4 flex-row items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>
                  O canal do WhatsApp está desativado. Ao ligar "Ativar
                  automação", o envio volta a ser habilitado para os fluxos.
                </span>
              </Alert>
            )}
            {!activeFlowId && (
              <AutomationFlowsWorkspace
                flows={filteredFlows}
                totalFlows={metrics.totalFlows}
                activeFlows={activeFlowCount}
                totalSteps={metrics.totalSteps}
                totalTemplates={metrics.totalTemplates}
                dailyAutomationCount={dailyAutomationCount}
                dailyAutomationLoading={dailyAutomationLoading}
                dailyAutomationError={dailyAutomationError}
                search={flowSearch}
                onSearchChange={setFlowSearch}
                tagFilter={flowTagFilter}
                onTagFilterChange={setFlowTagFilter}
                availableTags={availableTags}
                getConditionPreview={getFlowConditionPreview}
                onEditFlow={openFlowEditor}
              />
            )}
            {activeFlowId && !activeFlow && !loadingFlow && (
                <section className="space-y-4" aria-label="Fluxo não encontrado">
                <PageHeader
                  title="Fluxo não encontrado"
                  description="Este fluxo não está mais disponível na configuração."
                  descriptionPlacement="visible"
                  breadcrumbs={(
                    <Button type="button" variant="ghost" size="sm" onClick={closeFlowEditor}>
                      <ArrowLeft className="kds-control-icon" aria-hidden="true" />
                      Voltar aos fluxos
                    </Button>
                  )}
                />
                <Alert tone="warning" title="Não encontramos este fluxo">
                  Volte à lista para selecionar outro fluxo disponível.
                </Alert>
              </section>
            )}
              {activeFlow && (
                <section className="min-w-0 space-y-5" aria-label="Editor do fluxo automático">
                  <PageHeader
                    className="kds-flow-editor-header sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-4 sm:px-6"
                    eyebrow={`Fluxo ${activeFlowIndex + 1}`}
                    title={activeFlow.name || "Novo fluxo"}
                    description="Organize a jornada, as regras operacionais e os testes em um só lugar."
                    descriptionPlacement="visible"
                    status={activeFlow.ativo === false ? <Badge tone="danger" size="sm">Desativado</Badge> : undefined}
                    breadcrumbs={(
                      <Button type="button" variant="ghost" size="sm" onClick={closeFlowEditor}>
                        <ArrowLeft className="kds-control-icon" aria-hidden="true" />
                        Voltar aos fluxos
                      </Button>
                    )}
                    actions={(
                      <>
                      <Button
                        onClick={() => handleRemoveFlow(activeFlow.id)}
                        variant="danger"
                        size="md"
                        disabled={savingFlow}
                      >
                        <Trash2 className="kds-control-icon" aria-hidden="true" />
                        Remover fluxo
                      </Button>
                      <Button
                        onClick={() => {
                          setFlowDetailTab("test");
                          setShowSimulation(true);
                          if (!simulationStart) {
                            setSimulationStart(getLocalDateTimeValue());
                          }
                        }}
                        variant="ghost"
                        size="md"
                      >
                        <Timer className="kds-control-icon" aria-hidden="true" />
                        Testar fluxo
                      </Button>
                      <Button
                        onClick={() => handleSaveFlow()}
                        loading={savingFlow}
                        size="md"
                      >
                        {!savingFlow && <Save className="kds-control-icon" aria-hidden="true" />}
                        {savingFlow ? "Salvando..." : "Salvar fluxo"}
                      </Button>
                      </>
                    )}
                  >
                    <SegmentedControl
                      className="kds-flow-detail-tabs mt-5"
                      value={flowDetailTab}
                      onChange={(next) => {
                        setFlowDetailTab(next);
                        if (next === "test") {
                          setShowSimulation(true);
                          if (!simulationStart) setSimulationStart(getLocalDateTimeValue());
                        }
                      }}
                      items={[
                        { id: "journey", label: "Jornada", icon: Activity },
                        { id: "settings", label: "Regras e agenda", icon: ShieldCheck },
                        { id: "test", label: "Simular e testar", icon: Timer },
                      ]}
                    />
                  </PageHeader>

                  <div className="space-y-5">
                    {flowDetailTab === "settings" && (
                      <>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                            Nome do fluxo
                          </FieldLabel>
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

                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:var(--bg-elevated)] p-3">
                        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                          Resumo do fluxo
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={activeFlow.ativo !== false}
                              onChange={(event) =>
                                handleUpdateFlow(activeFlow.id, {
                                  ativo: event.target.checked,
                                })
                              }
                              size="sm"
                            />
                            <div>
                              <div className="text-xs font-medium text-[var(--text-primary)]">
                                Fluxo ativo
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)]">
                                Desative para pausar este fluxo sem apagá-lo
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                          <span className="kds-config-token border border-[var(--border-subtle)] bg-[color:var(--bg-surface)] px-2 py-0.5">
                            {activeFlow.triggerStatus
                              ? `Status: ${activeFlow.triggerStatus}`
                              : "Disparo por condições"}
                          </span>
                          <span className="kds-config-token border border-[var(--border-subtle)] bg-[color:var(--bg-surface)] px-2 py-0.5">
                            Janela {activeFlowScheduling.startHour} -{" "}
                            {activeFlowScheduling.endHour}
                          </span>
                          <span className="kds-config-token border border-[var(--border-subtle)] bg-[color:var(--bg-surface)] px-2 py-0.5">
                            {activeFlow.steps.length} etapa
                            {activeFlow.steps.length === 1 ? "" : "s"}
                          </span>
                          <span className="kds-config-token border border-[var(--border-subtle)] bg-[color:var(--bg-surface)] px-2 py-0.5">
                            {getFlowConditionPreview(activeFlow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[color:var(--bg-elevated)] p-4">
                      <div>
                        <Heading level={4} className="text-sm font-semibold text-[var(--text-primary)]">
                          Agendamento do fluxo
                        </Heading>
                        <Text className="text-xs text-[var(--text-muted)] mt-1">
                          Defina a janela diária, os dias permitidos e o limite
                          de envios deste fluxo.
                        </Text>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                            Janela diária
                          </FieldLabel>
                          <div className="flex items-center gap-2">
                            <DesignSystemDateTimePicker
                              type="time"
                              value={activeFlowScheduling.startHour}
                              onChange={(event) =>
                                handleUpdateFlowScheduling(activeFlow.id, {
                                  startHour: event.target.value,
                                })
                              }
                              size="sm"
                            />
                            <span className="text-xs text-[var(--text-subtle)]">
                              até
                            </span>
                            <DesignSystemDateTimePicker
                              type="time"
                              value={activeFlowScheduling.endHour}
                              onChange={(event) =>
                                handleUpdateFlowScheduling(activeFlow.id, {
                                  endHour: event.target.value,
                                })
                              }
                              size="sm"
                            />
                          </div>
                        </div>
                        <div>
                          <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                            Dias permitidos
                          </FieldLabel>
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
                                  variant={isActive ? "primary" : "secondary"}
                                  size="sm"
                                  
                                >
                                  {day.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center gap-1.5">
                            <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)]">
                              Limite diário deste fluxo
                            </FieldLabel>
                            <InfoTooltip content="Conta apenas os envios automáticos deste fluxo por dia." label="Informações sobre o limite diário" />
                          </div>
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
                        </div>
                      </div>
                    </div>
                      </>
                    )}

                    {flowDetailTab === "journey" && <>
                    <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--kds-radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
                      <div>
                         <div className="kds-card-title-row"><Heading level={5} className="text-sm font-semibold text-[var(--text-primary)]">Jornada do lead</Heading><InfoTooltip content="Clique em um bloco para editar o gatilho, condições e ações. O canvas ocupa a área principal para facilitar a leitura da sequência." label="Informações sobre a jornada do lead" /></div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="kds-config-token border border-[var(--border-subtle)] px-2 py-1">{activeFlow.steps.length} etapas</span>
                        <span className="kds-config-token border border-[var(--border-subtle)] px-2 py-1">{getFlowConditionPreview(activeFlow)}</span>
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
                      onPreviewAiMessage={({ instruction }) =>
                        handlePreviewAiMessage(instruction)
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
                    </>}

                    {flowDetailTab === "settings" && <>
                    <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[color:var(--bg-elevated)] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Heading level={4} className="text-sm font-semibold text-[var(--text-primary)]">
                            Condições de saída
                          </Heading>
                          <Text className="text-xs text-[var(--text-muted)] mt-1">
                            Defina quando este fluxo deve ser encerrado
                            automaticamente.
                          </Text>
                        </div>
                        <Button
                          onClick={() =>
                            handleAddFlowExitCondition(activeFlow.id)
                          }
                          variant="secondary"
                          size="sm"
                        >
                          <Plus className="kds-control-icon" />
                          Nova condição
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span>Encerrar quando</span>
                        <div className="w-52">
                          <FilterSelect
                            icon={AlertCircle}
                            size="sm"
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
                        <div className="text-xs text-[var(--text-muted)] bg-[color:var(--bg-surface)] border border-dashed border-[var(--border-subtle)] rounded-lg p-3">
                          Nenhuma condição de saída configurada. O fluxo seguirá
                          até a última ação.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(activeFlow.exitConditions ?? []).map(
                            (condition) => (
                              <div
                                key={condition.id}
                                className="grid gap-2 rounded-lg border border-[var(--border-subtle)] bg-[color:var(--bg-surface)] p-3 md:grid-cols-[160px_160px_1fr_auto]"
                              >
                                {(() => {
                                  const valueOptions = getConditionValueOptions(
                                    condition.field,
                                  );
                                  return (
                                    <>
                                      <FilterSelect
                                        icon={AlertCircle}
                                        size="sm"
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
                                        <FilterSelect
                                          icon={AlertCircle}
                                          size="sm"
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
                                          <FilterSelect
                                            icon={AlertCircle}
                                            size="sm"
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
                                            size="sm"
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

                    <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[color:var(--bg-elevated)] p-4">
                      <div>
                        <Heading level={4} className="text-sm font-semibold text-[var(--text-primary)]">
                          Tags e categorização
                        </Heading>
                        <Text className="text-xs text-[var(--text-muted)] mt-1">
                          Organize e encontre fluxos rapidamente com etiquetas
                          personalizadas.
                        </Text>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(activeFlow.tags ?? []).length > 0 ? (
                          (activeFlow.tags ?? []).map((tagItem) => (
                            <span
                              key={tagItem}
                              className="kds-config-token inline-flex items-center gap-1 bg-[color:var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]"
                            >
                              #{tagItem}
                              <IconButton
                                onClick={() =>
                                  handleRemoveFlowTag(activeFlow.id, tagItem)
                                }
                                variant="icon"
                                className="hover:bg-[color:var(--bg-inset)] hover:text-[var(--text-secondary)]"
                                size="sm"
                                aria-label={`Remover tag ${tagItem}`}
                                title="Remover tag">
                                ×
                              </IconButton>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">
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
                          <Tag className="kds-control-icon" />
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)]">
                        Status final se não houver resposta
                      </FieldLabel>
                      {showStatusSelect ? (
                        <FilterSelect
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
                          placeholder="Ex.: Sem follow-up"
                        />
                      )}
                    </div>

                    {flowEditorMode === "basic" && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Heading level={4} className="text-sm font-semibold text-[var(--text-primary)]">
                              Sequência de ações
                            </Heading>
                            <Text className="text-xs text-[var(--text-muted)] mt-1">
                              Cada etapa representa uma ação. Configure o
                              intervalo, o tipo de ação e, se necessário, o
                              conteúdo da mensagem.
                            </Text>
                          </div>
                          <Button
                            onClick={() => handleAddFlowStep(activeFlow.id)}
                            variant="secondary"
                            size="sm"
                          >
                            <Plus className="kds-control-icon" />
                            Nova etapa
                          </Button>
                        </div>

                        {activeFlow.steps.map((step, stepIndex) => (
                          <div
                            key={step.id}
                            className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[color:var(--bg-elevated)] p-3"
                          >
                            <div className="grid gap-3 md:grid-cols-[160px_160px_1fr_auto]">
                              <div>
                                <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                  Esperar
                                </FieldLabel>
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
                                  size="sm"
                                />
                              </div>
                              <div>
                                <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                  Unidade
                                </FieldLabel>
                                <FilterSelect
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
                                <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                  Tipo de ação
                                </FieldLabel>
                                <FilterSelect
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
                              <div className="space-y-3">
                                <div className="text-xs text-[var(--text-muted)]">
                                  Canal ativo: WhatsApp (configurado em
                                  Integrações). Cada item abaixo é enviado
                                  como uma mensagem própria, em ordem.
                                </div>
                                <MessageListEditor
                                  step={step}
                                  messageTemplates={messageTemplatesDraft}
                                  onUpdate={(messages) =>
                                    handleUpdateFlowStep(
                                      activeFlow.id,
                                      step.id,
                                      { messages },
                                    )
                                  }
                                  onPreviewAiMessage={handlePreviewAiMessage}
                                />
                              </div>
                            )}

                            {step.actionType === "create_task" && (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="md:col-span-2">
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Título da tarefa
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Descrição
                                  </FieldLabel>
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
                                    size="sm"
                                    suggestions={
                                      AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                                    }
                                    placeholder="Detalhes da tarefa"
                                  />
                                </div>
                                <div>
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Vencimento (horas)
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Prioridade
                                  </FieldLabel>
                                  <FilterSelect
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
                                <div className="md:col-span-2 text-xs text-[var(--text-muted)]">
                                  Envio depende de conta configurada em
                                  Integrações de e-mail.
                                </div>
                                <div>
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Para
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    CC
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    BCC
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Assunto
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Corpo do e-mail
                                  </FieldLabel>
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
                                    size="sm"
                                    suggestions={
                                      AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                                    }
                                  />
                                  <Text className="text-[11px] text-[var(--text-subtle)] mt-1">
Use variáveis como {"{{primeiro_nome}}"} ou{" "}
                                     {"{{= ... }}"} para fórmulas.
                                  </Text>
                                </div>
                              </div>
                            )}

                            {step.actionType === "webhook" && (
                              <div className="grid gap-3 md:grid-cols-2">
                                <Text className="text-xs text-[var(--text-muted)] md:col-span-2">Esta etapa conecta outro sistema. Peça ao responsável pela integração os dados abaixo.</Text>
                                <div className="md:col-span-2">
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Endereço do serviço
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Método
                                  </FieldLabel>
                                  <FilterSelect
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Cabeçalhos da conexão (JSON)
                                  </FieldLabel>
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
                                  <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                    Dados enviados
                                  </FieldLabel>
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
                                    size="sm"
                                    suggestions={
                                      AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                                    }
                                    placeholder='{"lead_id":"{{= lead.id }}"}'
                                  />
                                  <Text className="text-[11px] text-[var(--text-subtle)] mt-1">
                                    Se vazio, envia JSON padrão com dados do
                                    lead.
                                  </Text>
                                </div>
                              </div>
                            )}

                            {step.actionType === "update_status" && (
                              <div>
                                <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                  Novo status do lead
                                </FieldLabel>
                                {showStatusSelect ? (
                                  <FilterSelect
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
                              <div className="rounded-lg border border-[var(--brand-primary-border)] bg-[color:var(--brand-primary-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                                Esta ação será aplicada automaticamente ao lead
                                ao chegar nesta etapa.
                              </div>
                            )}

                            {step.actionType === "activate_autonomous_service" && (
                              <div className="rounded-lg border border-[var(--brand-primary-border)] bg-[color:var(--brand-primary-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                                A partir desta etapa, a IA (Luiza) passa a
                                responder sozinha nesse chat específico do
                                WhatsApp, fazendo a qualificação do lead. Ela
                                nunca monta ou envia cotação — isso continua
                                manual. Quando a qualificação termina (ou a
                                IA identifica que precisa de um humano), o
                                atendimento autônomo é encerrado naquele chat
                                e o status do lead é atualizado automaticamente.
                                Nenhum outro chat é afetado.
                              </div>
                            )}

                            <div className="text-[11px] text-[var(--text-muted)]">
                              Etapa {stepIndex + 1} da sequência.
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    </>}

                    {flowDetailTab === "test" && showSimulation && (
                      <div className="space-y-4 rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                              <Timer className="w-4 h-4" />
                              Simulação operacional
                            </div>
                            <Text className="text-xs text-[var(--text-primary)]">
                              Dry run do fluxo. Nenhuma mensagem é enviada;
                              mostramos somente a previsão de execução.
                            </Text>
                          </div>
                          <div className="kds-config-token border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                            Lead de exemplo + agenda do fluxo
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                          <div className="rounded-xl border border-[var(--brand-primary-border)] bg-[color:color-mix(in_srgb,var(--bg-surface)_90%,transparent)] p-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <FieldLabel className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                                  Início da simulação
                                </FieldLabel>
                                <DesignSystemDateTimePicker
                                  type="datetime-local"
                                  value={simulationInputValue}
                                  onChange={(event) => setSimulationStart(event.target.value)}
                                  className="border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)]"
                                  placeholder="Selecionar início"
                                />
                              </div>
                              <div className="grid gap-2 text-xs text-[var(--text-primary)]">
                                <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--brand-primary-border)_55%,transparent)] bg-[color:var(--brand-primary-soft)] px-3 py-2">
                                  <span className="font-semibold">Janela:</span>{" "}
                                  {activeFlowScheduling.startHour} até{" "}
                                  {activeFlowScheduling.endHour}
                                </div>
                                <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--brand-primary-border)_55%,transparent)] bg-[color:var(--brand-primary-soft)] px-3 py-2">
                                  <span className="font-semibold">Fuso:</span>{" "}
                                  {activeFlowScheduling.timezone}
                                </div>
                                <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--brand-primary-border)_55%,transparent)] bg-[color:var(--brand-primary-soft)] px-3 py-2">
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
                            <div className="rounded-xl border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] p-4">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                <ClipboardList className="h-3.5 w-3.5" />
                                Etapas
                              </div>
                              <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                                {simulationSummary?.totalSteps ?? 0}
                              </div>
                              <div className="text-xs text-[var(--text-muted)]">
                                Ações previstas no fluxo atual.
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] p-4">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                <AlarmClock className="h-3.5 w-3.5" />
                                Ajustes
                              </div>
                              <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                                {simulationSummary?.adjustedSteps ?? 0}
                              </div>
                              <div className="text-xs text-[var(--text-muted)]">
                                Etapas movidas por regras de agenda.
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] p-4 sm:col-span-2">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                <Activity className="h-3.5 w-3.5" />
                                Janela estimada
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                                <div>
                                  Primeiro disparo:{" "}
                                  <span className="font-medium text-[var(--text-primary)]">
                                    {simulationSummary?.firstAt
                                      ? formatSimulationDateTime(
                                          simulationSummary.firstAt,
                                          activeFlowScheduling.timezone,
                                        )
                                      : "aguardando dados"}
                                  </span>
                                </div>
                                <div>
                                  Última execução:{" "}
                                  <span className="font-medium text-[var(--text-primary)]">
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

                        <div className="rounded-xl border border-[var(--brand-primary-border)] bg-[var(--bg-surface)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                                <MessageCircle className="h-4 w-4" />
                                Envio de teste
                              </div>
                              <Text className="mt-1 text-xs text-[var(--text-muted)]">
                                Envia somente as mensagens da etapa escolhida para o seu número. Não agenda novas ações nem altera os dados ou o status do contato.
                              </Text>
                            </div>
                            <span className="kds-config-token border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-3 py-1 text-[11px] text-[var(--text-primary)]">
                              Envio real pelo WhatsApp
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <FieldLabel className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                              Nome de teste
                              <Input
                                value={testName}
                                onChange={(event) => setTestName(event.target.value)}
                                size="sm"
                              />
                            </FieldLabel>
                            <FieldLabel className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                              WhatsApp de teste
                              <Input
                                type="tel"
                                placeholder="11999999999"
                                value={testPhone}
                                onChange={(event) => setTestPhone(event.target.value)}
                                size="sm"
                              />
                            </FieldLabel>
                            <FilterSelect
                              icon={MessageCircle}
                              size="sm"
                              value={testStepId || testableSteps[0]?.id || ""}
                              onChange={setTestStepId}
                              placeholder="Etapa para testar"
                              options={testableSteps.map((step, index) => ({
                                value: step.id,
                                label: `Etapa ${index + 1}: ${getSimulationStepLabel(step)}`,
                              }))}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <Text className="text-xs text-[var(--text-muted)]">
                              Salve o fluxo antes do teste para garantir que a etapa selecionada seja a versão publicada.
                            </Text>
                            <Button
                              size="sm"
                              onClick={() => void handleSendFlowTest()}
                              loading={sendingTest}
                              disabled={testableSteps.length === 0 || !testPhone.trim()}
                            >
                              {!sendingTest && <MessageCircle className="kds-control-icon" />}
                              Enviar teste
                            </Button>
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
                                  className="rounded-full border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] px-3 py-1 text-[11px] text-[var(--text-primary)]"
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
                          <div className="rounded-xl border border-[var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--accent-gold-soft)_70%,transparent)] p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                              <AlertCircle className="h-4 w-4" />
                              Pontos para revisar antes de confiar na simulação
                            </div>
                            <div className="mt-3 grid gap-2">
                              {simulationIssues.map((issue) => (
                                <div
                                  key={issue}
                                  className="rounded-lg border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                                >
                                  {issue}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                              <Timer className="h-4 w-4 text-[var(--text-secondary)]" />
                              Linha do tempo prevista
                            </div>

                            {simulationTimeline.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-5 text-sm text-[var(--text-secondary)]">
                                {simulationIssues.length > 0
                                  ? "A simulação ficou incompleta porque ainda existem configurações pendentes."
                                  : "Adicione etapas para visualizar a linha do tempo."}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {simulationTimeline.map((item) => (
                                  <div
                                    key={item.step.id}
                                    className="rounded-xl border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] p-4 shadow-sm"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                          Etapa {item.index}
                                        </div>
                                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                                          {getSimulationStepLabel(item.step)}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                          {formatDelayLabel(
                                            item.delayValue,
                                            item.delayUnit,
                                          )}{" "}
                                          após o marco anterior
                                        </div>
                                      </div>
                                      <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--brand-primary-border)_55%,transparent)] bg-[color:var(--brand-primary-soft)] px-3 py-2 text-right text-xs text-[var(--text-primary)]">
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
                                              className="kds-config-token border border-[var(--brand-primary-border)] bg-[color:var(--brand-primary-soft)] px-2.5 py-1 text-[11px] text-[var(--text-primary)]"
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
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                              <Info className="h-4 w-4 text-[var(--text-secondary)]" />
                              Contexto da simulação
                            </div>
                            <div className="rounded-xl border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                Lead de exemplo
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)]">
                                <div>
                                  <span className="font-semibold text-[var(--text-primary)]">
                                    Nome:
                                  </span>{" "}
                                  {simulationLead.nome_completo}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--text-primary)]">
                                    Status inicial:
                                  </span>{" "}
                                  {simulationLead.status}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--text-primary)]">
                                    Origem:
                                  </span>{" "}
                                  {simulationLead.origem}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--text-primary)]">
                                    Cidade:
                                  </span>{" "}
                                  {simulationLead.cidade}
                                </div>
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--brand-primary-border)] bg-[color:var(--bg-surface)] p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                Como ler
                              </div>
                              <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                                <Text>
Os horários já consideram a janela do fluxo,
                                   os dias permitidos e pulos automáticos da
                                  agenda.
                                </Text>
                                <Text>
                                  Quando uma etapa não pode rodar no horário
                                  original, ela aparece com o motivo do ajuste.
                                </Text>
                                <Text>
                                  Se houver pendências de configuração, a
                                  simulação mostra os alertas antes da timeline.
                                </Text>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

          </>}

          {activeWorkspace === "templates" && <div className="border-t border-[var(--border-subtle)] pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Heading level={3} className="text-sm font-semibold text-[var(--text-primary)]">
                    Biblioteca de templates
                  </Heading>
                  <Text className="text-xs text-[var(--text-muted)] mt-1">
                    Crie e edite templates pré-fabricados para usar na automação
                    ou em disparos manuais.
                  </Text>
                </div>
                <Button
                  onClick={handleAddTemplate}
                  variant="secondary"
                  size="sm"
                  disabled={savingTemplate}
                >
                  <Plus className="kds-control-icon" />
                  Novo modelo
                </Button>
              </div>

              {messageTemplatesDraft.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] bg-[color:var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-4">
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
                      <Card
                        key={template.id}
                        className="flex flex-col gap-3"
                        padding="sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Heading level={4} className="text-sm font-semibold text-[var(--text-primary)]">
                                {template.name?.trim() || `Modelo ${index + 1}`}
                              </Heading>
                            </div>
                            <Text className="text-xs text-[var(--text-muted)] mt-1">
                              {getTemplateMessages(template).length} mensagens
                              configuradas
                            </Text>
                          </div>
                          <ButtonGroup size="md" aria-label="Ações do modelo">
                            <Button
                              onClick={() => handleEditTemplate(template.id)}
                              variant="secondary"
                              size="sm"
                              disabled={savingTemplate}
                            >
                              <Edit3 className="kds-control-icon" />
                              Editar
                            </Button>
                            <IconButton
                              onClick={() => handleRemoveTemplate(template.id)}
                              variant="danger"
                              loading={savingTemplateId === template.id}
                              disabled={savingTemplate}
                              title="Remover modelo"
                              size="sm"
                              aria-label="Remover modelo"
                            >
                              <Trash2 aria-hidden="true" />
                            </IconButton>
                          </ButtonGroup>
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
                                  <Surface
                                    key={message.id}
                                    variant="muted"
                                    padding="sm"
                                    className="flex gap-2"
                                >
                                  <Icon className="w-4 h-4 text-[var(--text-subtle)] mt-0.5" />
                                  <div>
                                    <div className="text-[11px] uppercase font-semibold text-[var(--text-muted)]">
                                      {messageTypeLabels[message.type]}{" "}
                                      {messageIndex + 1}
                                    </div>
                                    <Text className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                                      {content || "Sem conteúdo"}
                                    </Text>
                                  </div>
                                </Surface>
                              );
                            })
                          ) : (
                            <Text className="text-xs text-[var(--text-muted)]">
                              Nenhuma mensagem configurada ainda. Abra para
                              editar.
                            </Text>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>}
          </div>
          {ConfirmationDialog}
          {isTemplateModalOpen && templateDraft && (
            <DialogShell
              isOpen
              onClose={handleCloseTemplateModal}
              title={
                templateModalMode === "create"
                  ? "Novo template"
                  : "Editar template"
              }
              description="Mudanças nos fluxos exigem salvar a automação."
              descriptionPlacement="tooltip"
              initialFocus="first-content"
              size="form"
              footer={
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
              }
            >
              <div className="space-y-6">
                <div>
                  <FieldLabel className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Nome do template
                  </FieldLabel>
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
                    <div className="flex min-w-0 items-center gap-2">
                      <Heading level={4} className="text-sm font-semibold text-[var(--text-primary)]">
                        Mensagens do template
                      </Heading>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => handleAddDraftMessage("text")}
                        variant="secondary"
                        size="sm"
                      >
                        <MessageCircle className="kds-control-icon" />
                        Texto
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("image")}
                        variant="secondary"
                        size="sm"
                      >
                        <ImageIcon className="kds-control-icon" />
                        Imagem
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("video")}
                        variant="secondary"
                        size="sm"
                      >
                        <Film className="kds-control-icon" />
                        Vídeo
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("audio")}
                        variant="secondary"
                        size="sm"
                      >
                        <Mic className="kds-control-icon" />
                        Áudio
                      </Button>
                      <Button
                        onClick={() => handleAddDraftMessage("document")}
                        variant="secondary"
                        size="sm"
                      >
                        <File className="kds-control-icon" />
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
                          className="rounded-lg border border-[var(--border-subtle)] bg-[color:var(--bg-surface)] p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <Icon className="w-4 h-4 text-[var(--text-subtle)]" />
                              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                                Mensagem {index + 1}
                              </span>
                              <div className="w-full sm:w-44">
                                <FilterSelect
                                  icon={MessageCircle}
                                  size="sm"
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
                              size="sm"
                              suggestions={
                                AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS
                              }
                              placeholder="Digite a mensagem..."
                            />
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                  {mediaLabel}
                                </FieldLabel>
                                <Input
                                  type="text"
                                  value={message.mediaUrl ?? ""}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, {
                                      mediaUrl: event.target.value,
                                    })
                                  }
                                  size="sm"
                                  placeholder="https://..."
                                />
                              </div>
                              <div>
                                <FieldLabel className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                                  Legenda ou descrição
                                </FieldLabel>
                                <Input
                                  type="text"
                                  value={message.caption ?? ""}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, {
                                      caption: event.target.value,
                                    })
                                  }
                                  size="sm"
                                  placeholder="Ex.: Guia do plano"
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
            </DialogShell>
          )}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
