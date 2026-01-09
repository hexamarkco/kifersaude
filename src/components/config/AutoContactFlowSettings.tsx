import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlarmClock,
  AlertCircle,
  BarChart3,
  ClipboardList,
  Edit3,
  File,
  Film,
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
  X,
} from 'lucide-react';

import { configService } from '../../lib/configService';
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  composeTemplateMessage,
  buildAutoContactScheduleTimeline,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_AUTO_CONTACT_FLOWS,
  getTemplateMessages,
  normalizeAutoContactSettings,
  type AutoContactScheduleAdjustmentReason,
  type AutoContactFlow,
  type AutoContactFlowCondition,
  type AutoContactFlowStep,
  type AutoContactLoggingSettings,
  type AutoContactMonitoringSettings,
  type AutoContactSchedulingSettings,
  type AutoContactSettings,
  type AutoContactTemplate,
  type TemplateMessage,
  type TemplateMessageType,
} from '../../lib/autoContactService';
import { supabase } from '../../lib/supabase';
import type { IntegrationSetting, LeadStatusConfig } from '../../lib/supabase';

type MessageState = { type: 'success' | 'error' | 'warning'; text: string } | null;
type TemplateDraft = {
  id: string;
  name: string;
  messages: TemplateMessage[];
};

export default function AutoContactFlowSettings() {
  const [autoContactIntegration, setAutoContactIntegration] = useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] = useState<AutoContactSettings | null>(null);
  const [messageTemplatesDraft, setMessageTemplatesDraft] = useState<AutoContactTemplate[]>(DEFAULT_MESSAGE_TEMPLATES);
  const [flowDrafts, setFlowDrafts] = useState<AutoContactFlow[]>(DEFAULT_AUTO_CONTACT_FLOWS);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const defaultSettings = useMemo(() => normalizeAutoContactSettings(null), []);
  const [schedulingDraft, setSchedulingDraft] = useState<AutoContactSchedulingSettings>(
    defaultSettings.scheduling,
  );
  const [monitoringDraft, setMonitoringDraft] = useState<AutoContactMonitoringSettings>(
    defaultSettings.monitoring,
  );
  const [loggingDraft, setLoggingDraft] = useState<AutoContactLoggingSettings>(defaultSettings.logging);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusConfig[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingFlow, setLoadingFlow] = useState(true);
  const [savingFlow, setSavingFlow] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [statusMessage, setStatusMessage] = useState<MessageState>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<'create' | 'edit'>('create');
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [flowSearch, setFlowSearch] = useState('');
  const [flowTagFilter, setFlowTagFilter] = useState('all');
  const [tagDraft, setTagDraft] = useState('');
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationStart, setSimulationStart] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(() => new Date());
  const [dailyAutomationCount, setDailyAutomationCount] = useState<number | null>(null);
  const [dailyAutomationLoading, setDailyAutomationLoading] = useState(false);
  const [dailyAutomationError, setDailyAutomationError] = useState<string | null>(null);

  useEffect(() => {
    void loadAutoContactSettings();
  }, []);

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
    setMessageTemplatesDraft(normalized.messageTemplates ?? []);
    setSelectedTemplateId(normalized.selectedTemplateId);
    setFlowDrafts(normalized.flows ?? []);
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
        .from('interactions')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'Mensagem Automática')
        .gte('data_interacao', startOfDay.toISOString())
        .lt('data_interacao', startOfNextDay.toISOString());

      if (error) {
        throw error;
      }

      setDailyAutomationCount(count ?? 0);
    } catch (error) {
      console.error('Erro ao carregar contador diário de automações:', error);
      setDailyAutomationError('Não foi possível carregar o contador diário.');
    } finally {
      setDailyAutomationLoading(false);
    }
  }, []);

  const createMessageDraft = (type: TemplateMessageType = 'text'): TemplateMessage => ({
    id: `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    text: '',
    mediaUrl: '',
    caption: '',
  });

  const openTemplateModal = (mode: 'create' | 'edit', template?: AutoContactTemplate | null) => {
    const draftMessages = template ? getTemplateMessages(template) : [];
    const normalizedMessages = draftMessages.length > 0 ? draftMessages : [createMessageDraft()];
    setTemplateDraft({
      id: template?.id ?? `template-${Date.now()}`,
      name: template?.name ?? '',
      messages: normalizedMessages,
    });
    setTemplateModalMode(mode);
    setIsTemplateModalOpen(true);
  };

  const handleAddTemplate = () => {
    openTemplateModal('create');
  };

  const handleEditTemplate = (templateId: string) => {
    const template = messageTemplatesDraft.find((item) => item.id === templateId);
    if (!template) return;
    openTemplateModal('edit', template);
  };

  const handleUpdateTemplateDraft = (updates: Partial<TemplateDraft>) => {
    setTemplateDraft((previous) => (previous ? { ...previous, ...updates } : previous));
  };

  const handleUpdateDraftMessage = (messageId: string, updates: Partial<TemplateMessage>) => {
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

  const handleAddDraftMessage = (type: TemplateMessageType = 'text') => {
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
      const nextMessages = previous.messages.filter((message) => message.id !== messageId);
      return {
        ...previous,
        messages: nextMessages.length ? nextMessages : [createMessageDraft()],
      };
    });
  };

  const normalizeTemplatesForSettings = (templates: AutoContactTemplate[], filterEmpty = false) => {
    const normalizedTemplates = templates.map((template, index) => {
      const templateId = template.id || `template-${index}`;
      const normalizedMessages = getTemplateMessages({ ...template, id: templateId }).map((message, messageIndex) => ({
        id: message.id?.trim() ? message.id : `message-${templateId}-${messageIndex}`,
        type: message.type,
        text: message.text ?? '',
        mediaUrl: message.mediaUrl ?? '',
        caption: message.caption ?? '',
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
      ? normalizedTemplates.filter((template) => template.message.trim() || template.hasContent)
      : normalizedTemplates;

    return filteredTemplates.map(({ hasContent: _hasContent, ...template }) => template);
  };

  const handleSaveTemplateDraft = async () => {
    if (!templateDraft) return;
    const normalizedMessages = templateDraft.messages.map((message, index) => ({
      id: message.id?.trim() ? message.id : `message-${templateDraft.id}-${index}`,
      type: message.type,
      text: message.text ?? '',
      mediaUrl: message.mediaUrl ?? '',
      caption: message.caption ?? '',
    }));
    const composedMessage = composeTemplateMessage(normalizedMessages);
    const newTemplate: AutoContactTemplate = {
      id: templateDraft.id,
      name: templateDraft.name,
      messages: normalizedMessages,
      message: composedMessage,
    };

    const rawTemplates =
      templateModalMode === 'edit'
        ? messageTemplatesDraft.map((template) => (template.id === newTemplate.id ? newTemplate : template))
        : [...messageTemplatesDraft, newTemplate];
    const normalizedTemplates = normalizeTemplatesForSettings(rawTemplates);
    const nextSelectedTemplateId = selectedTemplateId || newTemplate.id;
    const normalizedSelectedTemplateId =
      normalizedTemplates.find((template) => template.id === nextSelectedTemplateId)?.id ??
      normalizedTemplates[0]?.id ??
      '';

    setMessageTemplatesDraft(normalizedTemplates);
    setSelectedTemplateId(normalizedSelectedTemplateId);
    setIsTemplateModalOpen(false);
    setTemplateDraft(null);

    if (!autoContactIntegration) {
      setStatusMessage({ type: 'error', text: 'Integração de automação não configurada.' });
      return;
    }

    setSavingTemplate(true);
    setStatusMessage(null);

    const currentSettings = autoContactSettings || normalizeAutoContactSettings(null);
    const newSettings = {
      ...currentSettings,
      messageTemplates: normalizedTemplates,
      selectedTemplateId: normalizedSelectedTemplateId,
    };

    const { data, error } = await configService.updateIntegrationSetting(autoContactIntegration.id, {
      settings: newSettings,
    });

    if (error) {
      setStatusMessage({ type: 'error', text: 'Erro ao salvar o template. Tente novamente.' });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(updatedIntegration.settings);

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      setSelectedTemplateId(normalized.selectedTemplateId);
      setStatusMessage({ type: 'success', text: 'Template salvo no banco de dados.' });
    }

    setSavingTemplate(false);
  };

  const handleCloseTemplateModal = () => {
    setIsTemplateModalOpen(false);
    setTemplateDraft(null);
  };

  const handleRemoveTemplate = (templateId: string) => {
    setMessageTemplatesDraft((previous) => {
      const nextTemplates = previous.filter((template) => template.id !== templateId);
      const fallbackId = nextTemplates[0]?.id ?? '';
      setSelectedTemplateId((current) => (current === templateId ? fallbackId : current));
      return nextTemplates;
    });
  };

  const handleResetDraft = () => {
    const savedTemplates = autoContactSettings?.messageTemplates?.length
      ? autoContactSettings.messageTemplates
      : DEFAULT_MESSAGE_TEMPLATES;

    setMessageTemplatesDraft(savedTemplates);
    setSelectedTemplateId(autoContactSettings?.selectedTemplateId ?? savedTemplates[0]?.id ?? '');
    setFlowDrafts(autoContactSettings?.flows ?? DEFAULT_AUTO_CONTACT_FLOWS);
    setSchedulingDraft(autoContactSettings?.scheduling ?? defaultSettings.scheduling);
    setMonitoringDraft(autoContactSettings?.monitoring ?? defaultSettings.monitoring);
    setLoggingDraft(autoContactSettings?.logging ?? defaultSettings.logging);
    setStatusMessage(null);
  };

  const handleSaveFlow = async () => {
    if (!autoContactIntegration) {
      setStatusMessage({ type: 'error', text: 'Integração de automação não configurada.' });
      return;
    }

    setSavingFlow(true);
    setStatusMessage(null);

    const sanitizedTemplates = normalizeTemplatesForSettings(messageTemplatesDraft, true);
    const fallbackTemplateId = sanitizedTemplates[0]?.id ?? '';
    const sanitizedFlows = flowDrafts
      .map((flow, flowIndex) => {
        const steps = flow.steps
          .map((step, stepIndex) => {
            const rawDelay = Number(step.delayHours);
            const delayHours = Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay : 0;
            const templateId =
              sanitizedTemplates.find((template) => template.id === step.templateId)?.id ?? fallbackTemplateId;
            return {
              id: step.id?.trim() ? step.id : `flow-${flow.id}-step-${stepIndex}`,
              delayHours,
              templateId,
            };
          })
          .filter((step) => step.templateId);
        const conditions = (flow.conditions ?? [])
          .map((condition, conditionIndex) => ({
            id: condition.id?.trim() ? condition.id : `flow-${flow.id}-condition-${conditionIndex}`,
            field: condition.field,
            operator: condition.operator,
            value: condition.value?.trim() || '',
          }))
          .filter((condition) => condition.value);
        const tags = (flow.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

        return {
          id: flow.id?.trim() ? flow.id : `flow-${flowIndex}`,
          name: flow.name?.trim() || `Fluxo ${flowIndex + 1}`,
          triggerStatus: flow.triggerStatus?.trim() || '',
          steps,
          stopOnStatusChange: flow.stopOnStatusChange !== false,
          finalStatus: flow.finalStatus?.trim() || '',
          conditionLogic: flow.conditionLogic === 'any' ? 'any' : 'all',
          conditions,
          tags,
        };
      })
      .filter((flow) => flow.triggerStatus && flow.steps.length);
    const normalizedSelectedTemplateId =
      sanitizedTemplates.find((template) => template.id === selectedTemplateId)?.id ??
      sanitizedTemplates[0]?.id ??
      '';

    const currentSettings = autoContactSettings || normalizeAutoContactSettings(null);
    const newSettings = {
      ...currentSettings,
      messageTemplates: sanitizedTemplates,
      selectedTemplateId: normalizedSelectedTemplateId,
      flows: sanitizedFlows,
      scheduling: schedulingDraft,
      monitoring: monitoringDraft,
      logging: loggingDraft,
    };

    const { data, error } = await configService.updateIntegrationSetting(autoContactIntegration.id, {
      settings: newSettings,
    });

    if (error) {
      setStatusMessage({ type: 'error', text: 'Erro ao salvar a configuração. Tente novamente.' });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(updatedIntegration.settings);

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      setSelectedTemplateId(normalized.selectedTemplateId);
      setFlowDrafts(normalized.flows ?? []);
      setSchedulingDraft(normalized.scheduling);
      setMonitoringDraft(normalized.monitoring);
      setLoggingDraft(normalized.logging);
      setStatusMessage({ type: 'success', text: 'Fluxos e templates de automação salvos com sucesso.' });
    }

    setSavingFlow(false);
  };

  const selectedTemplate = useMemo(
    () => messageTemplatesDraft.find((template) => template.id === selectedTemplateId) ?? null,
    [messageTemplatesDraft, selectedTemplateId],
  );
  const selectedTemplateMessages = useMemo(
    () => getTemplateMessages(selectedTemplate),
    [selectedTemplate],
  );
  const activeFlow = useMemo(
    () => flowDrafts.find((flow) => flow.id === activeFlowId) ?? null,
    [flowDrafts, activeFlowId],
  );
  const activeFlowIndex = useMemo(
    () => (activeFlow ? flowDrafts.findIndex((flow) => flow.id === activeFlow.id) : -1),
    [activeFlow, flowDrafts],
  );
  const availableTags = useMemo(() => {
    const tags = flowDrafts.flatMap((flow) => flow.tags ?? []).filter(Boolean);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [flowDrafts]);
  const filteredFlows = useMemo(() => {
    const search = flowSearch.trim().toLowerCase();
    return flowDrafts.filter((flow) => {
      const tags = flow.tags ?? [];
      if (flowTagFilter !== 'all' && !tags.includes(flowTagFilter)) {
        return false;
      }
      if (!search) return true;
      const haystack = `${flow.name} ${flow.triggerStatus} ${tags.join(' ')}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [flowDrafts, flowSearch, flowTagFilter]);
  const metrics = useMemo(() => {
    const totalSteps = flowDrafts.reduce((total, flow) => total + flow.steps.length, 0);
    const flowsWithConditions = flowDrafts.filter((flow) => (flow.conditions ?? []).length > 0).length;
    const taggedFlows = flowDrafts.filter((flow) => (flow.tags ?? []).length > 0).length;
    return {
      totalFlows: flowDrafts.length,
      totalSteps,
      totalTemplates: messageTemplatesDraft.length,
      flowsWithConditions,
      taggedFlows,
    };
  }, [flowDrafts, messageTemplatesDraft]);
  const messageTypeLabels: Record<TemplateMessageType, string> = {
    text: 'Texto',
    image: 'Imagem',
    video: 'Vídeo',
    audio: 'Áudio',
    document: 'Documento',
  };

  const messageTypeIcons: Record<TemplateMessageType, typeof MessageCircle> = {
    text: MessageCircle,
    image: ImageIcon,
    video: Film,
    audio: Mic,
    document: File,
  };
  const createFlowStep = (templateId = selectedTemplateId): AutoContactFlowStep => ({
    id: `flow-step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    delayHours: 2,
    templateId: templateId || messageTemplatesDraft[0]?.id || '',
  });
  const createFlowCondition = (): AutoContactFlowCondition => ({
    id: `flow-condition-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    field: 'origem',
    operator: 'contains',
    value: '',
  });
  const createFlowDraft = (): AutoContactFlow => ({
    id: `flow-${Date.now()}`,
    name: '',
    triggerStatus: leadStatuses[0]?.nome ?? '',
    steps: [createFlowStep()],
    stopOnStatusChange: true,
    finalStatus: '',
    conditionLogic: 'all',
    conditions: [],
    tags: [],
  });
  const handleAddFlow = () => {
    const newFlow = createFlowDraft();
    setFlowDrafts((previous) => [...previous, newFlow]);
    setActiveFlowId(newFlow.id);
  };
  const handleUpdateFlow = (flowId: string, updates: Partial<AutoContactFlow>) => {
    setFlowDrafts((previous) => previous.map((flow) => (flow.id === flowId ? { ...flow, ...updates } : flow)));
  };
  const handleRemoveFlow = (flowId: string) => {
    setFlowDrafts((previous) => previous.filter((flow) => flow.id !== flowId));
    if (activeFlowId === flowId) {
      setActiveFlowId(null);
    }
  };
  const handleAddFlowStep = (flowId: string) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId ? { ...flow, steps: [...flow.steps, createFlowStep()] } : flow,
      ),
    );
  };
  const handleUpdateFlowStep = (flowId: string, stepId: string, updates: Partial<AutoContactFlowStep>) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              steps: flow.steps.map((step) => (step.id === stepId ? { ...step, ...updates } : step)),
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
  const handleAddFlowCondition = (flowId: string) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? { ...flow, conditions: [...(flow.conditions ?? []), createFlowCondition()] }
          : flow,
      ),
    );
  };
  const handleUpdateFlowCondition = (
    flowId: string,
    conditionId: string,
    updates: Partial<AutoContactFlowCondition>,
  ) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              conditions: (flow.conditions ?? []).map((condition) =>
                condition.id === conditionId ? { ...condition, ...updates } : condition,
              ),
            }
          : flow,
      ),
    );
  };
  const handleRemoveFlowCondition = (flowId: string, conditionId: string) => {
    setFlowDrafts((previous) =>
      previous.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              conditions: (flow.conditions ?? []).filter((condition) => condition.id !== conditionId),
            }
          : flow,
      ),
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
              tags: flow.tags?.includes(trimmed) ? flow.tags : [...(flow.tags ?? []), trimmed],
            }
          : flow,
      ),
    );
    setTagDraft('');
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
  const weekdayLabels = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sáb' },
    { value: 7, label: 'Dom' },
  ];
  const conditionFieldLabels: Record<AutoContactFlowCondition['field'], string> = {
    origem: 'Origem do lead',
    cidade: 'Cidade',
    responsavel: 'Responsável',
    status: 'Status atual',
    tag: 'Tag do lead',
  };
  const conditionOperatorLabels: Record<AutoContactFlowCondition['operator'], string> = {
    equals: 'É igual a',
    contains: 'Contém',
    not_equals: 'Não é igual',
    not_contains: 'Não contém',
  };
  const adjustmentReasonLabels: Record<AutoContactScheduleAdjustmentReason, string> = {
    outside_window: 'fora da janela',
    weekend: 'fim de semana',
    holiday: 'feriado',
  };
  const getLocalDateTimeValue = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };
  const simulationTimeline = useMemo(() => {
    if (!activeFlow || !showSimulation) return [];
    const baseDate = simulationStart ? new Date(simulationStart) : new Date();
    return buildAutoContactScheduleTimeline({
      startAt: baseDate,
      steps: activeFlow.steps,
      scheduling: schedulingDraft,
    }).map((item, index) => ({
      index: index + 1,
      step: item.step,
      scheduledAt: item.scheduledAt,
      delayHours: item.step.delayHours,
      adjustmentReasons: item.adjustmentReasons,
    }));
  }, [activeFlow, schedulingDraft, showSimulation, simulationStart]);

  useEffect(() => {
    if (!activeFlowId) {
      setShowSimulation(false);
      setSimulationStart('');
      setTagDraft('');
      return;
    }
    setShowSimulation(false);
    setSimulationStart('');
    setTagDraft('');
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

  if (loadingFlow) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-3 text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Carregando templates de automação...</span>
      </div>
    );
  }

  if (!autoContactIntegration) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-600 mt-1" />
        <div className="space-y-1 text-sm text-orange-800">
          <p className="font-semibold">Integração de automação não encontrada.</p>
          <p>Execute as migrações mais recentes e configure o serviço antes de definir os templates de automação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="space-y-6">
        {schedulingDraft.dailySendLimit && dailyAutomationCount !== null && dailyAutomationCount >= schedulingDraft.dailySendLimit ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 text-amber-700" />
            <div>
              <p className="font-semibold">Limite diário atingido</p>
              <p className="text-xs text-amber-800 mt-1">
                O limite de {schedulingDraft.dailySendLimit} envios automáticos foi alcançado hoje. Novos envios serão
                reagendados para o próximo dia disponível.
              </p>
            </div>
          </div>
        ) : null}

        <div>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-slate-500">Fluxos ativos</div>
                <BarChart3 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-800 mt-2">{metrics.totalFlows}</div>
              <p className="text-xs text-slate-500 mt-1">Modelos: {metrics.totalTemplates}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-slate-500">Etapas totais</div>
                <Timer className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-800 mt-2">{metrics.totalSteps}</div>
              <p className="text-xs text-slate-500 mt-1">Condições: {metrics.flowsWithConditions}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-slate-500">Fluxos tagueados</div>
                <Tag className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-800 mt-2">{metrics.taggedFlows}</div>
              <p className="text-xs text-slate-500 mt-1">Tags ativas: {availableTags.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-slate-500">Última atualização</div>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-2">
                {lastRefreshAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Monitoramento em tempo real</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-slate-500">Envios hoje</div>
                <AlarmClock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-800 mt-2">
                {dailyAutomationLoading ? '...' : (dailyAutomationCount ?? 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {dailyAutomationError
                  ? dailyAutomationError
                  : schedulingDraft.dailySendLimit
                    ? `Limite diário: ${schedulingDraft.dailySendLimit}`
                    : 'Sem limite diário configurado'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-medium">
                <AlarmClock className="w-5 h-5" />
                Agendamento avançado
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fuso horário</label>
                  <input
                    type="text"
                    value={schedulingDraft.timezone}
                    onChange={(event) =>
                      setSchedulingDraft((previous) => ({ ...previous, timezone: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="America/Sao_Paulo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Janela diária</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={schedulingDraft.startHour}
                      onChange={(event) =>
                        setSchedulingDraft((previous) => ({ ...previous, startHour: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <span className="text-xs text-slate-400">até</span>
                    <input
                      type="time"
                      value={schedulingDraft.endHour}
                      onChange={(event) =>
                        setSchedulingDraft((previous) => ({ ...previous, endHour: event.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Limite diário por tenant</label>
                  <input
                    type="number"
                    min={1}
                    value={schedulingDraft.dailySendLimit ?? ''}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setSchedulingDraft((previous) => ({
                        ...previous,
                        dailySendLimit: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Sem limite"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mantém a automação dentro do limite diário global.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Dias permitidos</label>
                <div className="flex flex-wrap gap-2">
                  {weekdayLabels.map((day) => {
                    const isActive = schedulingDraft.allowedWeekdays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() =>
                          setSchedulingDraft((previous) => ({
                            ...previous,
                            allowedWeekdays: isActive
                              ? previous.allowedWeekdays.filter((value) => value !== day.value)
                              : [...previous.allowedWeekdays, day.value].sort((a, b) => a - b),
                          }))
                        }
                        className={`px-3 py-1 text-xs rounded-full border ${
                          isActive
                            ? 'bg-teal-50 border-teal-200 text-teal-700'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={schedulingDraft.skipHolidays}
                  onChange={(event) =>
                    setSchedulingDraft((previous) => ({ ...previous, skipHolidays: event.target.checked }))
                  }
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Pausar envios em feriados configurados
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-medium">
                <ClipboardList className="w-5 h-5" />
                Observabilidade e auditoria
              </div>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Monitoramento em tempo real</div>
                    <p className="text-xs text-slate-500">
                      Atualiza o painel automaticamente com status das execuções.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={monitoringDraft.realtimeEnabled}
                    onChange={(event) =>
                      setMonitoringDraft((previous) => ({ ...previous, realtimeEnabled: event.target.checked }))
                    }
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 mt-1"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Atualização (segundos)</label>
                    <input
                      type="number"
                      min={5}
                      value={monitoringDraft.refreshSeconds}
                      onChange={(event) =>
                        setMonitoringDraft((previous) => ({
                          ...previous,
                          refreshSeconds: Number(event.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Última atualização</label>
                    <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-slate-50">
                      {lastRefreshAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Logs estruturados e auditoria</div>
                    <p className="text-xs text-slate-500">Registre eventos, payloads e ações por usuário.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={loggingDraft.enabled}
                    onChange={(event) =>
                      setLoggingDraft((previous) => ({ ...previous, enabled: event.target.checked }))
                    }
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 mt-1"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Retenção (dias)</label>
                    <input
                      type="number"
                      min={7}
                      value={loggingDraft.retentionDays}
                      onChange={(event) =>
                        setLoggingDraft((previous) => ({
                          ...previous,
                          retentionDays: Number(event.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600 mt-6">
                    <input
                      type="checkbox"
                      checked={loggingDraft.includePayloads}
                      onChange={(event) =>
                        setLoggingDraft((previous) => ({ ...previous, includePayloads: event.target.checked }))
                      }
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    Salvar payloads completos
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-900 font-medium mb-4">
            <MessageCircle className="w-5 h-5" />
            Templates da automação
          </div>
          {statusMessage && (
            <div
              className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : statusMessage.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <div className="font-semibold mb-2">Variáveis disponíveis:</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{nome}}'}</code> nome completo</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{primeiro_nome}}'}</code> primeiro nome</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{origem}}'}</code> origem do lead</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{cidade}}'}</code> cidade</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{responsavel}}'}</code> responsável</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Fluxos de automação</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Monte sequências com espera em horas, envio de templates e condição de encerramento.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddFlow}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Novo fluxo
              </button>
            </div>

            {flowDrafts.length === 0 ? (
              <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-4">
                Nenhum fluxo configurado. Clique em "Novo fluxo" para começar.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={flowSearch}
                      onChange={(event) => setFlowSearch(event.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                      placeholder="Buscar fluxo por nome, status ou tag"
                    />
                  </div>
                  <div>
                    <select
                      value={flowTagFilter}
                      onChange={(event) => setFlowTagFilter(event.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                    >
                      <option value="all">Todas as tags</option>
                      {availableTags.map((tagItem) => (
                        <option key={tagItem} value={tagItem}>
                          {tagItem}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-end">
                    {filteredFlows.length} fluxo{filteredFlows.length === 1 ? '' : 's'} encontrado
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {filteredFlows.map((flow, index) => (
                    <button
                      type="button"
                      key={flow.id}
                      onClick={() => setActiveFlowId(flow.id)}
                      className="text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-400 uppercase">Fluxo {index + 1}</div>
                          <div className="text-sm font-semibold text-slate-800 mt-1">
                            {flow.name || 'Fluxo sem nome'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Dispara em: <span className="font-medium text-slate-700">{flow.triggerStatus || '—'}</span>
                          </div>
                        </div>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                          {flow.steps.length} etapa{flow.steps.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 px-2 py-0.5">
                          {flow.stopOnStatusChange ? 'Interrompe ao mudar status' : 'Continua após status'}
                        </span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5">
                          {flow.finalStatus ? `Finaliza em ${flow.finalStatus}` : 'Sem status final'}
                        </span>
                        <span className="rounded-full border border-slate-200 px-2 py-0.5">
                          {(flow.conditions ?? []).length} condição{(flow.conditions ?? []).length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {(flow.tags ?? []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {(flow.tags ?? []).map((tagItem) => (
                            <span
                              key={tagItem}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5"
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
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase">
                        Fluxo {activeFlowIndex + 1}
                      </div>
                      <h4 className="text-lg font-semibold text-slate-800">Detalhes do fluxo</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        Ajuste regras, sequência de mensagens e status final do fluxo selecionado.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSimulation((previous) => !previous);
                          if (!simulationStart) {
                            setSimulationStart(getLocalDateTimeValue());
                          }
                        }}
                        className="inline-flex items-center gap-2 text-xs text-slate-600 hover:text-slate-700"
                      >
                        <Timer className="w-4 h-4" />
                        {showSimulation ? 'Ocultar simulação' : 'Simular fluxo'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveFlow}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60"
                        disabled={savingFlow}
                      >
                        {savingFlow ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {savingFlow ? 'Salvando...' : 'Salvar fluxo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFlow(activeFlow.id)}
                        className="inline-flex items-center gap-2 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover fluxo
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFlowId(null)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Nome do fluxo
                      </label>
                      <input
                        type="text"
                        value={activeFlow.name}
                        onChange={(event) => handleUpdateFlow(activeFlow.id, { name: event.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="Ex.: Follow-up de contato inicial"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2">
                          Disparar quando o status virar
                        </label>
                        {showStatusSelect ? (
                          <select
                            value={activeFlow.triggerStatus}
                            onChange={(event) => handleUpdateFlow(activeFlow.id, { triggerStatus: event.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                          >
                            {statusOptions.map((status) => (
                              <option key={status.id} value={status.nome}>
                                {status.nome}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={activeFlow.triggerStatus}
                            onChange={(event) => handleUpdateFlow(activeFlow.id, { triggerStatus: event.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="Ex.: Contato inicial"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-500">Encerrar se o status mudar</label>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={activeFlow.stopOnStatusChange}
                            onChange={(event) =>
                              handleUpdateFlow(activeFlow.id, { stopOnStatusChange: event.target.checked })
                            }
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          Se o lead evoluir, este fluxo é encerrado automaticamente
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800">Condições dinâmicas</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Defina regras para disparar o fluxo somente em determinados cenários.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddFlowCondition(activeFlow.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Nova condição
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Aplicar quando</span>
                        <select
                          value={activeFlow.conditionLogic ?? 'all'}
                          onChange={(event) =>
                            handleUpdateFlow(activeFlow.id, {
                              conditionLogic: event.target.value as AutoContactFlow['conditionLogic'],
                            })
                          }
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                        >
                          <option value="all">todas as condições</option>
                          <option value="any">qualquer condição</option>
                        </select>
                        <span>forem atendidas</span>
                      </div>

                      {(activeFlow.conditions ?? []).length === 0 ? (
                        <div className="text-xs text-slate-500 bg-white border border-dashed border-slate-200 rounded-lg p-3">
                          Nenhuma condição configurada. O fluxo será disparado para todos os leads no status escolhido.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(activeFlow.conditions ?? []).map((condition) => (
                            <div
                              key={condition.id}
                              className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[160px_160px_1fr_auto]"
                            >
                              <select
                                value={condition.field}
                                onChange={(event) =>
                                  handleUpdateFlowCondition(activeFlow.id, condition.id, {
                                    field: event.target.value as AutoContactFlowCondition['field'],
                                  })
                                }
                                className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                              >
                                {Object.entries(conditionFieldLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={condition.operator}
                                onChange={(event) =>
                                  handleUpdateFlowCondition(activeFlow.id, condition.id, {
                                    operator: event.target.value as AutoContactFlowCondition['operator'],
                                  })
                                }
                                className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                              >
                                {Object.entries(conditionOperatorLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={condition.value}
                                onChange={(event) =>
                                  handleUpdateFlowCondition(activeFlow.id, condition.id, {
                                    value: event.target.value,
                                  })
                                }
                                className="px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                placeholder="Digite o valor"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveFlowCondition(activeFlow.id, condition.id)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800">Tags e categorização</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Organize e encontre fluxos rapidamente com etiquetas personalizadas.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(activeFlow.tags ?? []).length > 0 ? (
                          (activeFlow.tags ?? []).map((tagItem) => (
                            <span
                              key={tagItem}
                              className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-1 text-xs text-slate-600"
                            >
                              #{tagItem}
                              <button
                                type="button"
                                onClick={() => handleRemoveFlowTag(activeFlow.id, tagItem)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">Nenhuma tag adicionada.</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={tagDraft}
                          onChange={(event) => setTagDraft(event.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Adicionar tag (ex.: premium, inbound)"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFlowTag(activeFlow.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Adicionar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-500">
                        Status final se não houver resposta
                      </label>
                      {showStatusSelect ? (
                        <select
                          value={activeFlow.finalStatus ?? ''}
                          onChange={(event) => handleUpdateFlow(activeFlow.id, { finalStatus: event.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                        >
                          <option value="">Não alterar status</option>
                          {statusOptions.map((status) => (
                            <option key={status.id} value={status.nome}>
                              {status.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={activeFlow.finalStatus ?? ''}
                          onChange={(event) => handleUpdateFlow(activeFlow.id, { finalStatus: event.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Ex.: Sem retorno"
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800">Sequência de mensagens</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Configure o intervalo em horas e o template que será enviado em cada etapa.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddFlowStep(activeFlow.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Nova etapa
                        </button>
                      </div>

                      {activeFlow.steps.map((step, stepIndex) => (
                        <div
                          key={step.id}
                          className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[140px_1fr_auto]"
                        >
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Esperar (horas)</label>
                            <input
                              type="number"
                              min={0}
                              value={step.delayHours}
                              onChange={(event) =>
                                handleUpdateFlowStep(activeFlow.id, step.id, {
                                  delayHours: Number(event.target.value),
                                })
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              Template da mensagem
                            </label>
                            <select
                              value={step.templateId}
                              onChange={(event) =>
                                handleUpdateFlowStep(activeFlow.id, step.id, { templateId: event.target.value })
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                            >
                              {messageTemplatesDraft.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name || 'Modelo sem nome'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveFlowStep(activeFlow.id, step.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remover
                            </button>
                          </div>
                          <div className="md:col-span-3 text-[11px] text-slate-500">
                            Etapa {stepIndex + 1} da sequência.
                          </div>
                        </div>
                      ))}
                    </div>

                    {showSimulation && (
                      <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
                        <div className="flex items-center gap-2 text-teal-800 font-semibold text-sm">
                          <Timer className="w-4 h-4" />
                          Simulação (dry run)
                        </div>
                        <p className="text-xs text-teal-700">
                          Esta simulação não envia mensagens. Ela apenas calcula os horários previstos para cada etapa.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold text-teal-700 mb-1">
                              Início da simulação
                            </label>
                            <input
                              type="datetime-local"
                              value={simulationStart || getLocalDateTimeValue()}
                              onChange={(event) => setSimulationStart(event.target.value)}
                              className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                            />
                          </div>
                          <div className="text-xs text-teal-700 flex items-end">
                            Janela ativa: {schedulingDraft.startHour} até {schedulingDraft.endHour} (
                            {schedulingDraft.timezone})
                          </div>
                        </div>
                        {simulationTimeline.length === 0 ? (
                          <div className="text-xs text-teal-700">Adicione etapas para visualizar a simulação.</div>
                        ) : (
                          <div className="space-y-2">
                            {simulationTimeline.map((item) => (
                              <div
                                key={item.step.id}
                                className="flex items-center justify-between rounded-lg bg-white border border-teal-100 px-3 py-2 text-xs text-teal-800"
                              >
                                <div>
                                  <div>
                                    Etapa {item.index}: {item.delayHours}h após início
                                  </div>
                                  {item.adjustmentReasons.length > 0 && (
                                    <div className="text-[11px] text-teal-600">
                                      Ajuste: {item.adjustmentReasons.map((reason) => adjustmentReasonLabels[reason]).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  {item.scheduledAt.toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                    timeZone: schedulingDraft.timezone,
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Template selecionado para a automação</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Este é o modelo que será enviado quando a automação for disparada automaticamente.
                </p>
              </div>
            </div>

            {messageTemplatesDraft.length === 0 ? (
              <div className="text-sm text-slate-500">
                Nenhum template cadastrado. Crie um novo modelo abaixo para ativar a automação.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Template de automação</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white"
                  >
                    {messageTemplatesDraft.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name || 'Modelo sem nome'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Prévia
                  </label>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
                    {selectedTemplateMessages.length > 0 ? (
                      <div className="space-y-3">
                        {selectedTemplateMessages.map((message, index) => {
                          const Icon = messageTypeIcons[message.type];
                          const content =
                            message.type === 'text'
                              ? message.text?.trim()
                              : message.caption?.trim() || message.mediaUrl?.trim() || 'Conteúdo pendente';
                          return (
                            <div key={message.id} className="flex gap-2">
                              <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
                              <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase">
                                  {messageTypeLabels[message.type]} {index + 1}
                                </div>
                                <p className="whitespace-pre-wrap text-sm text-slate-700">{content || 'Sem conteúdo'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p>Nenhuma mensagem definida neste template.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Biblioteca de templates</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Crie e edite templates pré-fabricados para usar na automação ou em disparos manuais.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTemplate}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Novo modelo
              </button>
            </div>

            {messageTemplatesDraft.length === 0 ? (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                Nenhum modelo cadastrado. Clique em "Novo modelo" para adicionar mensagens rápidas.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {messageTemplatesDraft.map((template, index) => {
                  const previewMessages = getTemplateMessages(template).slice(0, 2);
                  return (
                    <div
                      key={template.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-800">
                              {template.name?.trim() || `Modelo ${index + 1}`}
                            </h4>
                            {selectedTemplateId === template.id && (
                              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                                Em uso
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {getTemplateMessages(template).length} mensagens configuradas
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditTemplate(template.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTemplate(template.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover modelo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {previewMessages.length > 0 ? (
                          previewMessages.map((message, messageIndex) => {
                            const Icon = messageTypeIcons[message.type];
                            const content =
                              message.type === 'text'
                                ? message.text?.trim()
                                : message.caption?.trim() || message.mediaUrl?.trim() || 'Conteúdo pendente';
                            return (
                              <div
                                key={message.id}
                                className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
                                <div>
                                  <div className="text-[11px] uppercase font-semibold text-slate-500">
                                    {messageTypeLabels[message.type]} {messageIndex + 1}
                                  </div>
                                  <p className="text-xs text-slate-600 whitespace-pre-wrap">
                                    {content || 'Sem conteúdo'}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500">
                            Nenhuma mensagem configurada ainda. Abra para editar.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-200">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetDraft}
                className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSaveFlow}
                className="inline-flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm"
                disabled={savingFlow}
              >
                {savingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingFlow ? 'Salvando...' : 'Salvar automação'}
              </button>
            </div>
          </div>
        </div>
        {isTemplateModalOpen && templateDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60" onClick={handleCloseTemplateModal} />
            <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">
                    {templateModalMode === 'create' ? 'Novo template' : 'Editar template'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseTemplateModal}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nome do template</label>
                  <input
                    type="text"
                    value={templateDraft.name}
                    onChange={(event) => handleUpdateTemplateDraft({ name: event.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ex.: Boas-vindas VIP"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Mensagens do template</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Combine textos, mídias, áudios e documentos em uma sequência completa.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('text')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Texto
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('image')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Imagem
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('video')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <Film className="w-3.5 h-3.5" />
                        Vídeo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('audio')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        Áudio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('document')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <File className="w-3.5 h-3.5" />
                        Documento
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {templateDraft.messages.map((message, index) => {
                      const Icon = messageTypeIcons[message.type];
                      const mediaLabel =
                        message.type === 'image'
                          ? 'URL da imagem'
                          : message.type === 'video'
                          ? 'URL do vídeo'
                          : message.type === 'audio'
                          ? 'URL do áudio'
                          : message.type === 'document'
                          ? 'URL do documento'
                          : 'URL da mídia';
                      return (
                        <div key={message.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-semibold text-slate-500 uppercase">
                                Mensagem {index + 1}
                              </span>
                              <select
                                value={message.type}
                                onChange={(event) =>
                                  handleUpdateDraftMessage(message.id, {
                                    type: event.target.value as TemplateMessageType,
                                  })
                                }
                                className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              >
                                {Object.entries(messageTypeLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftMessage(message.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remover
                            </button>
                          </div>

                          {message.type === 'text' ? (
                            <textarea
                              value={message.text ?? ''}
                              onChange={(event) => handleUpdateDraftMessage(message.id, { text: event.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              rows={3}
                              placeholder="Digite a mensagem..."
                            />
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">
                                  {mediaLabel}
                                </label>
                                <input
                                  type="text"
                                  value={message.mediaUrl ?? ''}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, { mediaUrl: event.target.value })
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                  placeholder="https://..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">
                                  Legenda ou descrição
                                </label>
                                <input
                                  type="text"
                                  value={message.caption ?? ''}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, { caption: event.target.value })
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
              <div className="px-5 pb-2 text-xs text-slate-500">
                Este botão salva o template na biblioteca e no banco de dados. Para aplicar mudanças nos fluxos, finalize
                com "Salvar automação".
              </div>
              <div className="px-5 pb-5 flex flex-col sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseTemplateModal}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplateDraft}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-60"
                  disabled={savingTemplate}
                >
                  {savingTemplate ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    'Salvar template'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
