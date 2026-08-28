import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Activity, AlertCircle, ArrowLeft, ArrowRight, Bot, BookmarkPlus, CalendarClock, ChevronDown, ChevronUp, Eye, FileSpreadsheet, Filter, FlaskConical, FolderOpen, ImageIcon, Info, MessageCircle, PauseCircle, Pencil, PlayCircle, Plus, Repeat2, RefreshCw, Send, ShieldCheck, TestTube2, Trash2, Upload, UserCircle, Users, X, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import '../communicationTerracotta.css';
import { ActionSurface, Badge, Button, Card, Checkbox, DateTimePicker, Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, OperationalMetricChip, PageHeader, Select, Stepper, Surface, Textarea, Tooltip } from '../../../design-system';
import FilterMultiSelect from '../../../components/FilterMultiSelect';
import { useConfig } from '../../../contexts/ConfigContext';
import { toast } from '../../../lib/toast';
import {
  commWhatsAppCampaignService,
  computeAdmissionIntervalMinutes,
  formatAdmissionInterval,
  type CampaignStats,
  type CommWhatsAppAiIntentSuggestion,
  type CommWhatsAppCampaign,
  type CommWhatsAppCampaignAudienceSource,
  type CommWhatsAppCampaignActivationPreview,
  type CommWhatsAppCampaignDelayUnit,
  type CommWhatsAppCampaignMediaType,
  type CommWhatsAppCampaignMessageDraft,
  type CommWhatsAppCampaignRecurrenceRule,
  type CommWhatsAppCampaignStageDraft,
  type CommWhatsAppCampaignStepKind,
  type CommWhatsAppCampaignTemplate,
  type CommWhatsAppCampaignWorkerHealth,
  type CommWhatsAppCampaignWorkerRun,
  type CommWhatsAppCsvTargetDraft,
} from './commWhatsAppCampaignService';

const recurrenceRuleLabels: Record<CommWhatsAppCampaignRecurrenceRule, string> = {
  none: 'Nao repetir',
  daily: 'Repetir diariamente',
  weekly: 'Repetir semanalmente',
  monthly: 'Repetir mensalmente',
};

const mediaTypeLabels: Record<CommWhatsAppCampaignMediaType, string> = {
  image: 'Imagem',
  document: 'Documento',
  video: 'Video',
};

const stepKindLabels: Record<CommWhatsAppCampaignStepKind, string> = {
  message: 'Enviar mensagens',
  status_change: 'Mudar status do lead',
};

/** Rotulo de campo com um icone de ajuda: hover/foco mostra a explicacao do campo. */
function FieldLabel({ text, hint }: { text: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      <Tooltip content={hint} size="sm">
        <Info className="h-3.5 w-3.5 cursor-help text-[color:var(--panel-text-muted)]" aria-label={`Sobre: ${text}`} tabIndex={0} />
      </Tooltip>
    </span>
  );
}

const campaignWizardSteps = [
  { label: 'Informacoes', description: 'Nome e objetivo' },
  { label: 'Publico', description: 'CRM ou CSV' },
  { label: 'Mensagens', description: 'Sequencia e status' },
  { label: 'Agendamento', description: 'Quando e como enviar' },
];

const defaultMessageDraft = (): CommWhatsAppCampaignMessageDraft => ({ messageText: '' });

const defaultStage = (delayAmount = 0, delayUnit: CommWhatsAppCampaignStageDraft['delayUnit'] = 'minutes'): CommWhatsAppCampaignStageDraft => ({
  kind: 'message',
  delayAmount,
  delayUnit,
  messages: [defaultMessageDraft()],
});

type AudienceMode = 'crm' | 'csv';

type VariableAutocompleteState = {
  stageIndex: number;
  messageIndex: number;
  query: string;
  replaceStart: number;
  replaceEnd: number;
};

const campaignVariableSuggestions = [
  { key: 'nome', label: 'Nome completo', description: 'Nome do lead ou contato.' },
  { key: 'primeiro_nome', label: 'Primeiro nome', description: 'Primeiro nome do lead ou contato, sempre com só a inicial maiúscula (ex: "Maria").' },
  { key: 'telefone', label: 'Telefone', description: 'Telefone normalizado do contato.' },
  { key: 'status', label: 'Status', description: 'Status atual do lead no CRM.' },
  { key: 'responsavel', label: 'Responsavel', description: 'Responsavel atual pelo lead.' },
  { key: 'saudacao', label: 'Saudacao', description: 'Saudacao atual em minusculo, como "bom dia".' },
  { key: 'saudacao_titulo', label: 'Saudacao em titulo', description: 'Saudacao atual capitalizada, como "Bom dia".' },
  { key: 'saudacao_capitalizada', label: 'Saudacao capitalizada', description: 'Alias de saudacao capitalizada, como "Bom dia".' },
];

const formatEstimatedDuration = (minutes: number) => {
  if (minutes <= 0) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Ao ativar';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ao ativar';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const formatSendWindow = (campaign: CommWhatsAppCampaign) => {
  if (!campaign.send_window_start || !campaign.send_window_end) return 'Sem janela definida';
  return `${campaign.send_window_start.slice(0, 5)} - ${campaign.send_window_end.slice(0, 5)}`;
};

const formatRelativeRunTime = (value: string | null | undefined) => {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'agora mesmo';
  if (diffMinutes < 60) return `ha ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `ha ${diffHours}h`;
  return `ha ${Math.floor(diffHours / 24)}d`;
};

const getWorkerRunTone = (run: CommWhatsAppCampaignWorkerRun | null): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' => {
  if (!run) return 'warning';
  if (run.status === 'failed') return 'danger';
  if (run.status === 'running') return 'warning';
  const finishedAt = run.finished_at ? new Date(run.finished_at).getTime() : new Date(run.started_at).getTime();
  if (!Number.isNaN(finishedAt) && Date.now() - finishedAt > 10 * 60 * 1000) return 'warning';
  return 'success';
};

const defaultWorkerHealth: CommWhatsAppCampaignWorkerHealth = {
  latestRun: null,
  latestSuccess: null,
  latestFailure: null,
  recentRuns: [],
};

const statusLabels: Record<CommWhatsAppCampaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  queued: 'Na fila',
  running: 'Rodando',
  paused: 'Pausado',
  completed: 'Concluido',
  cancelled: 'Cancelado',
};

const statusTones: Record<CommWhatsAppCampaign['status'], 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  scheduled: 'accent',
  queued: 'warning',
  running: 'success',
  paused: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const statusIconClasses: Record<CommWhatsAppCampaign['status'], string> = {
  draft: 'bg-[var(--bg-hover)] text-[var(--text-muted)]',
  scheduled: 'bg-[var(--info-soft)] text-[var(--info-text)]',
  queued: 'bg-[var(--warning-soft)] text-[var(--warning-text)]',
  running: 'bg-[var(--success-soft)] text-[var(--success-text)]',
  paused: 'bg-[var(--warning-soft)] text-[var(--warning-text)]',
  completed: 'bg-[var(--success-soft)] text-[var(--success-text)]',
  cancelled: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
};

const splitCsvLine = (line: string) => {
  const delimiter = line.includes(';') ? ';' : ',';
  return line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''));
};

const parseCsvTargets = (raw: string): CommWhatsAppCsvTargetDraft[] => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const hasHeader = headers.some((header) => ['nome', 'name', 'telefone', 'phone', 'celular'].includes(header));
  const startIndex = hasHeader ? 1 : 0;
  const nameIndex = hasHeader ? Math.max(headers.indexOf('nome'), headers.indexOf('name')) : 0;
  const phoneIndex = hasHeader
    ? ['telefone', 'phone', 'celular', 'whatsapp'].map((key) => headers.indexOf(key)).find((index) => index >= 0) ?? 1
    : 1;

  return lines.slice(startIndex).flatMap((line) => {
    const values = splitCsvLine(line);
    const phoneNumber = values[phoneIndex] ?? '';
    const displayName = values[nameIndex] ?? '';
    const payload = Object.fromEntries(values.map((value, index) => [hasHeader ? headers[index] || `coluna_${index + 1}` : `coluna_${index + 1}`, value]));

    if (!phoneNumber.trim()) return [];
    return [{ displayName, phoneNumber, payload }];
  });
};

const defaultStats: CampaignStats = {
  total: 0,
  drafts: 0,
  scheduled: 0,
  active: 0,
  aiSuggestionsPending: 0,
};

const readStringArrayFilter = (filters: Record<string, unknown>, pluralKey: string, legacyKey: string) => {
  const pluralValue = filters[pluralKey];
  if (Array.isArray(pluralValue)) return pluralValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const legacyValue = filters[legacyKey];
  return typeof legacyValue === 'string' && legacyValue.trim() ? [legacyValue.trim()] : [];
};

const getVariableAutocompleteState = (value: string, cursorPosition: number, stageIndex: number, messageIndex: number): VariableAutocompleteState | null => {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/{{\s*([a-zA-Z0-9_]*)$/);
  if (!match || match.index === undefined) return null;
  return {
    stageIndex,
    messageIndex,
    query: match[1].toLowerCase(),
    replaceStart: match.index,
    replaceEnd: cursorPosition,
  };
};

export default function WhatsAppCampaignsScreen() {
  const navigate = useNavigate();
  const { leadStatuses, options } = useConfig();
  const [campaigns, setCampaigns] = useState<CommWhatsAppCampaign[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<CommWhatsAppAiIntentSuggestion[]>([]);
  const [stats, setStats] = useState<CampaignStats>(defaultStats);
  const [workerHealth, setWorkerHealth] = useState<CommWhatsAppCampaignWorkerHealth>(defaultWorkerHealth);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaignActionId, setCampaignActionId] = useState<string | null>(null);
  const [suggestionActionId, setSuggestionActionId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [editingCampaign, setEditingCampaign] = useState<CommWhatsAppCampaign | null>(null);
  const [loadingCampaignEdit, setLoadingCampaignEdit] = useState(false);
  const [activationPreview, setActivationPreview] = useState<CommWhatsAppCampaignActivationPreview | null>(null);
  const [loadingActivationPreview, setLoadingActivationPreview] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('crm');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [messageText, setMessageText] = useState('');
  const [stages, setStages] = useState<CommWhatsAppCampaignStageDraft[]>([defaultStage()]);
  const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>([]);
  const [leadOwnerFilters, setLeadOwnerFilters] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [createLeadsFromCsv, setCreateLeadsFromCsv] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendWindowStart, setSendWindowStart] = useState('');
  const [sendWindowEnd, setSendWindowEnd] = useState('');
  const [dailySendLimit, setDailySendLimit] = useState<number | null>(null);
  const [reactivationMode, setReactivationMode] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(90);
  const [recentCampaignDays, setRecentCampaignDays] = useState(30);
  const [variableAutocomplete, setVariableAutocomplete] = useState<VariableAutocompleteState | null>(null);
  const stepTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [abSplitPercent, setAbSplitPercent] = useState(50);
  const [recurrenceRule, setRecurrenceRule] = useState<CommWhatsAppCampaignRecurrenceRule>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndAt, setRecurrenceEndAt] = useState('');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CommWhatsAppCampaignTemplate[]>([]);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const mediaFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const csvTargets = useMemo(() => parseCsvTargets(csvText), [csvText]);
  const leadStatusOptions = useMemo(
    () => leadStatuses.map((status) => ({ value: status.nome, label: status.nome })),
    [leadStatuses],
  );
  const leadOwnerOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo).map((option) => ({ value: option.value, label: option.label })),
    [options.lead_responsavel],
  );
  const flatMessages = useMemo(
    () => stages.flatMap((stage) => (stage.kind === 'message' ? stage.messages : [])),
    [stages],
  );

  const admissionIntervalMinutes = useMemo(
    () => computeAdmissionIntervalMinutes(dailySendLimit, sendWindowStart, sendWindowEnd),
    [dailySendLimit, sendWindowStart, sendWindowEnd],
  );
  const firstMessageText = flatMessages.find((item) => item.messageText.trim())?.messageText.trim() || messageText.trim();
  const visibleVariableSuggestions = useMemo(() => {
    if (!variableAutocomplete) return [];
    return campaignVariableSuggestions.filter((suggestion) => (
      suggestion.key.includes(variableAutocomplete.query)
      || suggestion.label.toLowerCase().includes(variableAutocomplete.query)
    ));
  }, [variableAutocomplete]);
  const csvValidTargets = useMemo(() => {
    const seenPhoneDigits = new Set<string>();
    return csvTargets.filter((target) => {
      const phoneDigits = commWhatsAppCampaignService.normalizePhoneDigits(target.phoneNumber);
      if (!phoneDigits || seenPhoneDigits.has(phoneDigits)) return false;
      seenPhoneDigits.add(phoneDigits);
      return true;
    });
  }, [csvTargets]);
  const csvDuplicatePhoneCount = useMemo(() => {
    const validPhoneCount = csvTargets.filter((target) => commWhatsAppCampaignService.normalizePhoneDigits(target.phoneNumber).length > 0).length;
    return validPhoneCount - csvValidTargets.length;
  }, [csvTargets, csvValidTargets]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCampaigns, nextStats, nextSuggestions, nextWorkerHealth, nextTemplates] = await Promise.all([
        commWhatsAppCampaignService.listCampaigns(),
        commWhatsAppCampaignService.getStats(),
        commWhatsAppCampaignService.listPendingAiSuggestions(),
        commWhatsAppCampaignService.getWorkerHealth(),
        commWhatsAppCampaignService.listTemplates(),
      ]);
      setCampaigns(nextCampaigns);
      setStats(nextStats);
      setAiSuggestions(nextSuggestions);
      setWorkerHealth(nextWorkerHealth);
      setTemplates(nextTemplates);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar os disparos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const resetCampaignForm = () => {
    setEditingCampaign(null);
    setAudienceMode('crm');
    setName('');
    setObjective('');
    setMessageText('');
    setStages([defaultStage()]);
    setLeadStatusFilters([]);
    setLeadOwnerFilters([]);
    setCsvText('');
    setCreateLeadsFromCsv(false);
    setScheduledAt('');
    setSendWindowStart('');
    setSendWindowEnd('');
    setDailySendLimit(null);
    setReactivationMode(false);
    setInactiveDays(90);
    setRecentCampaignDays(30);
    setVariableAutocomplete(null);
    setAbTestEnabled(false);
    setAbSplitPercent(50);
    setRecurrenceRule('none');
    setRecurrenceInterval(1);
    setRecurrenceEndAt('');
    setTestPhoneNumber('');
    setWizardStep(0);
  };

  const openNewCampaignModal = () => {
    resetCampaignForm();
    setCampaignModalOpen(true);
  };

  const closeCampaignModal = () => {
    setCampaignModalOpen(false);
    resetCampaignForm();
  };

  const goToWizardStep = (step: number) => {
    setWizardStep(Math.min(Math.max(step, 0), campaignWizardSteps.length - 1));
  };

  const handleWizardNext = () => {
    if (wizardStep === 0 && !name.trim()) {
      toast.warning('Informe um nome para o disparo antes de continuar.');
      return;
    }
    goToWizardStep(wizardStep + 1);
  };

  const openEditCampaignModal = async (campaign: CommWhatsAppCampaign) => {
    setLoadingCampaignEdit(true);
    try {
      const campaignSteps = await commWhatsAppCampaignService.listCampaignSteps(campaign.id);
      const filters = campaign.audience_config?.filters && typeof campaign.audience_config.filters === 'object'
        ? campaign.audience_config.filters as Record<string, unknown>
        : {};
      setEditingCampaign(campaign);
      setAudienceMode(campaign.audience_source === 'csv' ? 'csv' : 'crm');
      setName(campaign.name);
      setObjective(campaign.objective ?? '');
      setMessageText(campaign.message_text ?? '');
      // Passo 1: colapsa pares de variante A/B que compartilham o mesmo
      // step_index em uma unica mensagem com variantBMessageText anexado.
      const rowsByStepIndex = new Map<number, typeof campaignSteps>();
      for (const row of campaignSteps) {
        rowsByStepIndex.set(row.step_index, [...(rowsByStepIndex.get(row.step_index) ?? []), row]);
      }
      const collapsedRows = Array.from(rowsByStepIndex.entries())
        .sort(([a], [b]) => a - b)
        .map(([, group]) => {
          const primary = group.find((item) => item.variant_label !== 'B') ?? group[0];
          const variantB = group.find((item) => item.variant_label === 'B');
          return { ...primary, variantBMessageText: variantB?.message_text };
        });

      // Passo 2: agrupa as linhas fisicas (ja colapsadas) em estagios pelo
      // stage_index, preservando a ordem de step_index dentro do estagio.
      const rowsByStage = new Map<number, typeof collapsedRows>();
      for (const row of collapsedRows) {
        rowsByStage.set(row.stage_index, [...(rowsByStage.get(row.stage_index) ?? []), row]);
      }
      const loadedStages: CommWhatsAppCampaignStageDraft[] = Array.from(rowsByStage.entries())
        .sort(([a], [b]) => a - b)
        .map(([, group]) => {
          const first = group[0];
          if (first.step_kind === 'status_change') {
            return {
              kind: 'status_change',
              delayAmount: first.delay_amount,
              delayUnit: first.delay_unit,
              messages: [],
              statusToSet: first.status_to_set ?? '',
            };
          }
          return {
            kind: 'message',
            delayAmount: first.delay_amount,
            delayUnit: first.delay_unit,
            messages: group.map((row) => ({
              messageText: row.message_text,
              mediaUrl: row.media_url,
              mediaType: row.media_type,
              mediaFilename: row.media_filename,
              variantBMessageText: row.variantBMessageText,
            })),
          };
        });
      setStages(loadedStages.length > 0 ? loadedStages : [{ ...defaultStage(), messages: [{ messageText: campaign.message_text ?? '' }] }]);
      setAbTestEnabled(campaign.ab_test_enabled);
      setAbSplitPercent(campaign.ab_split_percent || 50);
      setRecurrenceRule(campaign.recurrence_rule || 'none');
      setRecurrenceInterval(campaign.recurrence_interval || 1);
      setRecurrenceEndAt(campaign.recurrence_end_at ? campaign.recurrence_end_at.slice(0, 16) : '');
      setLeadStatusFilters(readStringArrayFilter(filters, 'statuses', 'status'));
      setLeadOwnerFilters(readStringArrayFilter(filters, 'responsaveis', 'responsavel'));
      setCsvText('');
      setCreateLeadsFromCsv(campaign.create_leads_from_csv);
      setScheduledAt(campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '');
      setSendWindowStart(campaign.send_window_start ? campaign.send_window_start.slice(0, 5) : '');
      setSendWindowEnd(campaign.send_window_end ? campaign.send_window_end.slice(0, 5) : '');
      setDailySendLimit(campaign.daily_send_limit ?? null);
      const lastContactBefore = typeof filters.last_contact_before === 'string' ? filters.last_contact_before : '';
      setReactivationMode(Boolean(lastContactBefore));
      if (lastContactBefore) {
        const days = Math.floor((Date.now() - new Date(lastContactBefore).getTime()) / (24 * 60 * 60 * 1000));
        if (Number.isFinite(days) && days > 0) setInactiveDays(days);
      }
      const storedRecentDays = Number(filters.exclude_recent_campaign_days);
      if (Number.isFinite(storedRecentDays) && storedRecentDays >= 0) setRecentCampaignDays(storedRecentDays);
      setWizardStep(0);
      setCampaignModalOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar este disparo para edicao.');
    } finally {
      setLoadingCampaignEdit(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!name.trim()) {
      toast.warning('Informe um nome para o disparo.');
      return;
    }

    if (!firstMessageText && !flatMessages.some((item) => item.mediaUrl)) {
      toast.warning('Escreva pelo menos uma mensagem ou anexe uma midia no disparo.');
      return;
    }

    const emptyStatusStage = stages.find((stage) => stage.kind === 'status_change' && !stage.statusToSet?.trim());
    if (emptyStatusStage) {
      toast.warning('Selecione o status a aplicar em cada etapa de "Mudar status do lead".');
      return;
    }

    if (!editingCampaign && audienceMode === 'csv' && csvValidTargets.length === 0) {
      toast.warning('Cole ou importe um CSV com pelo menos um telefone valido.');
      return;
    }

    setSaving(true);
    try {
      const audienceSource: CommWhatsAppCampaignAudienceSource = audienceMode;
      const audienceConfig = audienceMode === 'crm'
        ? {
            filters: {
              statuses: leadStatusFilters,
              responsaveis: leadOwnerFilters,
              last_contact_before: reactivationMode
                ? new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000).toISOString()
                : null,
              exclude_recent_campaign_days: reactivationMode ? recentCampaignDays : 0,
              exclude_opt_out: true,
            },
          }
        : {
            csv: {
              parsed_rows: csvTargets.length,
              valid_rows: csvValidTargets.length,
              create_leads: createLeadsFromCsv,
              exclude_opt_out: true,
            },
          };

      const normalizedStages: CommWhatsAppCampaignStageDraft[] = stages.map((stage) => (
        stage.kind === 'status_change'
          ? {
              kind: 'status_change' as const,
              delayAmount: Math.max(Math.floor(stage.delayAmount || 0), 0),
              delayUnit: stage.delayUnit,
              messages: [],
              statusToSet: stage.statusToSet?.trim() || '',
            }
          : {
              kind: 'message' as const,
              delayAmount: Math.max(Math.floor(stage.delayAmount || 0), 0),
              delayUnit: stage.delayUnit,
              messages: stage.messages.map((message) => ({
                messageText: message.messageText.trim(),
                mediaUrl: message.mediaUrl || null,
                mediaType: message.mediaUrl ? message.mediaType : null,
                mediaFilename: message.mediaUrl ? message.mediaFilename : null,
                variantBMessageText: message.variantBMessageText?.trim(),
              })),
            }
      ));
      const firstStage = normalizedStages[0];
      const firstMessageHasVariantB = firstStage?.kind === 'message' && Boolean(firstStage.messages[0]?.variantBMessageText);

      const payload = {
        name,
        objective,
        audienceSource,
        audienceConfig,
        messageText: firstMessageText,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        // Coluna mantida por compatibilidade; o intervalo de admissao real e
        // calculado direto de dailySendLimit + janela na RPC de despacho.
        pacingPerMinute: 12,
        dailySendLimit,
        sendWindowStart: sendWindowStart || null,
        sendWindowEnd: sendWindowEnd || null,
        stopOnReply: true,
        createLeadsFromCsv,
        stages: normalizedStages,
        csvTargets: !editingCampaign && audienceMode === 'csv' ? csvValidTargets : [],
        abTestEnabled: abTestEnabled && firstMessageHasVariantB,
        abSplitPercent,
        recurrenceRule: audienceMode === 'crm' ? recurrenceRule : 'none' as CommWhatsAppCampaignRecurrenceRule,
        recurrenceInterval,
        recurrenceEndAt: recurrenceEndAt ? new Date(recurrenceEndAt).toISOString() : null,
      };

      if (editingCampaign) {
        await commWhatsAppCampaignService.updateCampaign(editingCampaign.id, payload);
      } else {
        await commWhatsAppCampaignService.createDraft(payload);
      }

      toast.success(editingCampaign ? 'Disparo atualizado.' : 'Disparo salvo.');
      closeCampaignModal();
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o disparo.');
    } finally {
      setSaving(false);
    }
  };

  const updateVariableAutocomplete = (stageIndex: number, messageIndex: number, value: string, cursorPosition: number | null) => {
    if (cursorPosition === null) {
      setVariableAutocomplete(null);
      return;
    }

    setVariableAutocomplete(getVariableAutocompleteState(value, cursorPosition, stageIndex, messageIndex));
  };

  const insertVariableSuggestion = (suggestionKey: string) => {
    if (!variableAutocomplete) return;
    const { stageIndex, messageIndex } = variableAutocomplete;
    const currentMessage = stages[stageIndex]?.messages[messageIndex];
    if (!currentMessage) return;

    const nextText = `${currentMessage.messageText.slice(0, variableAutocomplete.replaceStart)}{{${suggestionKey}}}${currentMessage.messageText.slice(variableAutocomplete.replaceEnd)}`;
    const nextCursorPosition = variableAutocomplete.replaceStart + suggestionKey.length + 4;
    updateMessage(stageIndex, messageIndex, { messageText: nextText });
    if (stageIndex === 0 && messageIndex === 0) setMessageText(nextText);
    setVariableAutocomplete(null);

    const refKey = `${stageIndex}-${messageIndex}`;
    window.setTimeout(() => {
      const textarea = stepTextareaRefs.current[refKey];
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    }, 0);
  };

  const updateStage = (stageIndex: number, patch: Partial<CommWhatsAppCampaignStageDraft>) => {
    setStages((current) => current.map((stage, index) => index === stageIndex ? { ...stage, ...patch } : stage));
  };

  const updateMessage = (stageIndex: number, messageIndex: number, patch: Partial<CommWhatsAppCampaignMessageDraft>) => {
    setStages((current) => current.map((stage, index) => {
      if (index !== stageIndex) return stage;
      return { ...stage, messages: stage.messages.map((message, mIndex) => mIndex === messageIndex ? { ...message, ...patch } : message) };
    }));
  };

  const addStage = () => {
    setStages((current) => [...current, defaultStage(1, 'days')]);
  };

  const removeStage = (stageIndex: number) => {
    setStages((current) => current.length <= 1 ? current : current.filter((_, index) => index !== stageIndex));
  };

  const addMessageToStage = (stageIndex: number) => {
    setStages((current) => current.map((stage, index) => (
      index === stageIndex ? { ...stage, messages: [...stage.messages, defaultMessageDraft()] } : stage
    )));
  };

  const removeMessageFromStage = (stageIndex: number, messageIndex: number) => {
    setStages((current) => current.map((stage, index) => {
      if (index !== stageIndex || stage.messages.length <= 1) return stage;
      return { ...stage, messages: stage.messages.filter((_, mIndex) => mIndex !== messageIndex) };
    }));
  };

  const moveMessageInStage = (stageIndex: number, messageIndex: number, direction: -1 | 1) => {
    setStages((current) => current.map((stage, index) => {
      if (index !== stageIndex) return stage;
      const target = messageIndex + direction;
      if (target < 0 || target >= stage.messages.length) return stage;
      const nextMessages = [...stage.messages];
      [nextMessages[messageIndex], nextMessages[target]] = [nextMessages[target], nextMessages[messageIndex]];
      return { ...stage, messages: nextMessages };
    }));
  };

  const handleStepMediaUpload = async (stageIndex: number, messageIndex: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const key = `${stageIndex}-${messageIndex}`;
    setUploadingKey(key);
    try {
      const uploaded = await commWhatsAppCampaignService.uploadCampaignMedia(file);
      updateMessage(stageIndex, messageIndex, { mediaUrl: uploaded.url, mediaType: uploaded.type, mediaFilename: uploaded.filename });
      toast.success('Midia anexada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel enviar a midia.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemoveStepMedia = (stageIndex: number, messageIndex: number) => {
    updateMessage(stageIndex, messageIndex, { mediaUrl: null, mediaType: null, mediaFilename: null });
  };

  const handleSaveTemplate = async () => {
    const templateName = window.prompt('Nome do modelo:', name || 'Modelo de disparo');
    if (!templateName || !templateName.trim()) return;

    try {
      const saved = await commWhatsAppCampaignService.saveTemplate(templateName, stages);
      setTemplates((current) => [saved, ...current]);
      toast.success('Modelo salvo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o modelo.');
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    if (!templateId) return;
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setStages(template.stages.length > 0 ? template.stages : [defaultStage()]);
    const firstStage = template.stages[0];
    setMessageText(firstStage?.kind === 'message' ? firstStage.messages[0]?.messageText ?? '' : '');
    toast.success(`Modelo "${template.name}" carregado.`);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await commWhatsAppCampaignService.deleteTemplate(templateId);
      setTemplates((current) => current.filter((item) => item.id !== templateId));
      toast.success('Modelo removido.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel remover o modelo.');
    }
  };

  const handleSendTest = async () => {
    if (!editingCampaign) return;
    if (!testPhoneNumber.trim()) {
      toast.warning('Informe um telefone para o envio de teste.');
      return;
    }

    setSendingTest(true);
    try {
      await commWhatsAppCampaignService.sendTestMessage(editingCampaign.id, testPhoneNumber, 0, 'A');
      toast.success('Mensagem de teste enviada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel enviar a mensagem de teste.');
    } finally {
      setSendingTest(false);
    }
  };

  const openActivationPreview = async (campaign: CommWhatsAppCampaign) => {
    setCampaignActionId(campaign.id);
    setLoadingActivationPreview(true);
    try {
      const preview = await commWhatsAppCampaignService.getActivationPreview(campaign.id);
      setActivationPreview(preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel montar a revisao do disparo.');
    } finally {
      setCampaignActionId(null);
      setLoadingActivationPreview(false);
    }
  };

  const closeActivationPreview = () => {
    setActivationPreview(null);
  };

  const handleConfirmActivateCampaign = async () => {
    if (!activationPreview) return;
    setCampaignActionId(activationPreview.campaign.id);
    try {
      const result = await commWhatsAppCampaignService.activateCampaign(activationPreview.campaign.id);
      toast.success(result.status === 'scheduled' ? 'Disparo agendado e pronto para a fila.' : 'Disparo ativado e colocado na fila.');
      closeActivationPreview();
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel ativar o disparo.');
    } finally {
      setCampaignActionId(null);
    }
  };

  const handleProcessCampaign = async (campaign: CommWhatsAppCampaign) => {
    setCampaignActionId(campaign.id);
    try {
      const result = await commWhatsAppCampaignService.processCampaign(campaign.id);
      toast.success(`Processamento concluido: ${result.sent ?? 0} enviado(s), ${result.failed ?? 0} falha(s).`);
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel processar o disparo.');
    } finally {
      setCampaignActionId(null);
    }
  };

  const handleAcceptSuggestion = async (suggestion: CommWhatsAppAiIntentSuggestion) => {
    setSuggestionActionId(suggestion.id);
    try {
      await commWhatsAppCampaignService.acceptAiSuggestion(suggestion);
      toast.success('Contato bloqueado para proximos disparos.');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel bloquear este contato.');
    } finally {
      setSuggestionActionId(null);
    }
  };

  const handleDismissSuggestion = async (suggestion: CommWhatsAppAiIntentSuggestion) => {
    setSuggestionActionId(suggestion.id);
    try {
      await commWhatsAppCampaignService.dismissAiSuggestion(suggestion.id);
      toast.success('Sugestao dispensada.');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel dispensar a sugestao.');
    } finally {
      setSuggestionActionId(null);
    }
  };

  return (
    <div className="comm-terracotta comm-terracotta-campaigns panel-page-shell space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        title="Disparos WhatsApp"
        description="Crie campanhas conversacionais para leads do CRM ou contatos importados por CSV, com base preparada para opt-out sinalizado por IA."
        actions={(
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <OperationalMetricChip icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />} label="campanhas" value={stats.total} />
            <OperationalMetricChip icon={<PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />} label="rascunhos" value={stats.drafts} />
            <OperationalMetricChip icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />} label="agendadas" value={stats.scheduled} tone="accent" />
            <OperationalMetricChip icon={<PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />} label="ativas" value={stats.active} tone="success" active={stats.active > 0} />
            <OperationalMetricChip icon={<Bot className="h-3.5 w-3.5" aria-hidden="true" />} label="sugestoes IA" value={stats.aiSuggestionsPending} tone="warning" active={stats.aiSuggestionsPending > 0} />
            <Button variant="primary" className="whitespace-nowrap" onClick={openNewCampaignModal}>
              <Plus className="h-4 w-4" />
              Novo disparo
            </Button>
            <Button variant="secondary" className="whitespace-nowrap" onClick={() => void loadCampaigns()} loading={loading}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        )}
      />

      <Card className="comm-campaign-toolbar space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="h-5 w-5 text-[color:var(--panel-accent-strong)]" />
              <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Saude do worker</h2>
              <Badge tone={getWorkerRunTone(workerHealth.latestRun)}>
                {workerHealth.latestRun ? workerHealth.latestRun.status : 'sem execucao'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">
              Ultima execucao {formatRelativeRunTime(workerHealth.latestRun?.finished_at ?? workerHealth.latestRun?.started_at)}.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            <OperationalMetricChip
              icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
              label="processados"
              value={workerHealth.latestRun?.processed ?? 0}
              className="justify-center"
            />
            <OperationalMetricChip
              icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
              label="enviados"
              value={workerHealth.latestRun?.sent ?? 0}
              tone="success"
              className="justify-center"
            />
            <OperationalMetricChip
              icon={<AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              label="falhas"
              value={workerHealth.latestRun?.failed ?? 0}
              tone="danger"
              active={(workerHealth.latestRun?.failed ?? 0) > 0}
              className="justify-center"
            />
          </div>
        </div>
        {workerHealth.latestFailure && (
          <Surface variant="danger" padding="sm" className="text-sm">
            Ultima falha {formatRelativeRunTime(workerHealth.latestFailure.finished_at ?? workerHealth.latestFailure.started_at)}: {workerHealth.latestFailure.error_message || 'Erro nao informado.'}
          </Surface>
        )}
        <div className="grid gap-2 lg:grid-cols-3">
          {workerHealth.recentRuns.slice(0, 3).map((run) => (
            <Surface key={run.id} variant="muted" padding="sm" className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={getWorkerRunTone(run)} size="sm">{run.status}</Badge>
                <span className="text-xs text-[color:var(--panel-text-muted)]">{run.source} · {run.action}</span>
              </div>
              <p className="mt-2 text-xs text-[color:var(--panel-text-muted)]">{formatRelativeRunTime(run.finished_at ?? run.started_at)}</p>
              <p className="mt-1 text-xs text-[color:var(--panel-text-soft)]">{run.processed} proc. · {run.sent} env. · {run.failed} falha(s)</p>
            </Surface>
          ))}
          {workerHealth.recentRuns.length === 0 && (
            <p className="text-sm text-[color:var(--panel-text-muted)]">Nenhuma execucao registrada ainda. O proximo cron deve aparecer aqui apos rodar.</p>
          )}
        </div>
      </Card>

      {aiSuggestions.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Sinais de IA para revisar</h2>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Respostas de campanhas que podem indicar opt-out, numero errado ou reclamacao. A IA apenas sinaliza; o bloqueio depende da sua confirmacao.</p>
            </div>
            <Badge tone="warning">{aiSuggestions.length} pendente(s)</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {aiSuggestions.map((suggestion) => (
              <Surface key={suggestion.id} variant="muted" padding="sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        suggestion.intent === 'opt_out' || suggestion.intent === 'wrong_number'
                          ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                          : 'bg-[var(--warning-soft)] text-[var(--warning-text)]'
                      }`}
                    >
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{suggestion.chat?.display_name || suggestion.chat?.phone_number || suggestion.phone_digits || 'Contato sem nome'}</h3>
                      <p className="text-xs text-[color:var(--panel-text-muted)]">{suggestion.campaign?.name || 'Campanha sem nome'}</p>
                    </div>
                  </div>
                  <Badge tone={suggestion.intent === 'opt_out' || suggestion.intent === 'wrong_number' ? 'danger' : 'warning'} size="sm" className="shrink-0">
                    {formatIntentLabel(suggestion.intent)} · {Math.round((suggestion.confidence ?? 0) * 100)}%
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[color:var(--panel-text-soft)]">{suggestion.reason || 'A IA recomendou revisar esta resposta antes de novos disparos.'}</p>
                {suggestion.evidence && (
                  <blockquote className="mt-3 rounded-[var(--kds-radius-md)] border-l-4 border-[color:var(--panel-accent-strong)] bg-[color:var(--panel-surface)] px-3 py-2 text-xs text-[color:var(--panel-text-soft)]">
                    {suggestion.evidence}
                  </blockquote>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="danger" loading={suggestionActionId === suggestion.id} onClick={() => void handleAcceptSuggestion(suggestion)}>
                    Bloquear disparos
                  </Button>
                  <Button size="sm" variant="secondary" loading={suggestionActionId === suggestion.id} onClick={() => void handleDismissSuggestion(suggestion)}>
                    Dispensar
                  </Button>
                </div>
              </Surface>
            ))}
          </div>
        </Card>
      )}

      {campaignModalOpen && (
        <Dialog open={campaignModalOpen} onOpenChange={(open) => !open && closeCampaignModal()} size="xl" className="comm-whatsapp-overlay flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden">
            <DialogHeader onClose={closeCampaignModal}>
              <div>
                <DialogTitle>{editingCampaign ? 'Editar disparo' : 'Novo disparo'}</DialogTitle>
                <DialogDescription>{campaignWizardSteps[wizardStep]?.description}</DialogDescription>
              </div>
            </DialogHeader>

            <div className="shrink-0 px-1 pb-1 pt-2">
              <Stepper currentStep={wizardStep} steps={campaignWizardSteps} />
            </div>

            <DialogBody className="min-h-0 flex-1 space-y-5">
          {wizardStep === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={<FieldLabel text="Nome da campanha" hint="Nome interno para voce identificar o disparo na lista. O lead nunca ve esse nome." />}>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Reativacao PME maio" />
            </Field>
            <Field label={<FieldLabel text="Objetivo" hint="Anotacao livre sobre o proposito da campanha, so para referencia interna da equipe." />}>
              <Input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Ex: retomar cotacoes paradas" />
            </Field>
          </div>
          )}

          {wizardStep === 1 && (
          <>
          <div className="flex flex-wrap gap-2">
            <AudienceButton active={audienceMode === 'crm'} icon={Users} label="Leads do CRM" onClick={() => setAudienceMode('crm')} />
            <AudienceButton active={audienceMode === 'csv'} icon={FileSpreadsheet} label="Importar CSV" onClick={() => setAudienceMode('csv')} />
          </div>

          {audienceMode === 'crm' ? (
            <Surface variant="muted" padding="sm" className="grid gap-4 md:grid-cols-2">
              <Field label={<FieldLabel text="Status do lead" hint="Filtra o publico pelos status atuais no CRM. Deixe vazio para incluir todos os status." />}>
                <FilterMultiSelect icon={Filter} options={leadStatusOptions} placeholder="Todos os status" values={leadStatusFilters} onChange={setLeadStatusFilters} />
              </Field>
              <Field label={<FieldLabel text="Responsavel" hint="Filtra o publico pelo responsavel atribuido ao lead no CRM." />}>
                <FilterMultiSelect icon={UserCircle} options={leadOwnerOptions} placeholder="Todos os responsaveis" values={leadOwnerFilters} onChange={setLeadOwnerFilters} />
              </Field>
              <label className="md:col-span-2 flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
                <Checkbox checked={reactivationMode} onChange={(event) => setReactivationMode(event.target.checked)} />
                <span><span className="font-medium text-[color:var(--panel-text)]">Modo reativação segura</span><br />Exige último contato antigo e suprime quem recebeu outra campanha recentemente.</span>
              </label>
              {reactivationMode && (
                <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
                  <Field label={<FieldLabel text="Sem contato ha pelo menos (dias)" hint="So inclui leads cujo ultimo contato registrado foi ha pelo menos esse numero de dias." />}>
                    <Input type="number" min={1} value={inactiveDays} onChange={(event) => setInactiveDays(Math.max(1, Number(event.target.value) || 1))} />
                  </Field>
                  <Field label={<FieldLabel text="Suprimir campanha recente (dias)" hint="Exclui quem ja recebeu qualquer outra campanha dentro desse numero de dias, para nao repetir contato." />}>
                    <Input type="number" min={0} value={recentCampaignDays} onChange={(event) => setRecentCampaignDays(Math.max(0, Number(event.target.value) || 0))} />
                  </Field>
                </div>
              )}
              <p className="md:col-span-2 text-xs text-[color:var(--panel-text-muted)]">O worker vai materializar os alvos no momento de ativar a campanha, removendo arquivados, duplicados, numeros invalidos e opt-outs.</p>
            </Surface>
          ) : (
            <Surface variant="muted" padding="sm" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text)]">CSV com nome e telefone</p>
                  <p className="text-xs text-[color:var(--panel-text-muted)]">Aceita cabecalhos como nome, telefone, phone, celular ou whatsapp.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] px-3 py-2 text-sm font-medium text-[color:var(--panel-text)] transition hover:border-[color:var(--panel-accent-strong)]">
                  <FileSpreadsheet className="h-4 w-4" />
                  Escolher arquivo
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleCsvFile(event)} />
                </label>
              </div>
              <Textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={'nome;telefone\nMaria Silva;(11) 99999-9999'} />
              <label className="flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
                <Checkbox className="mt-1" checked={createLeadsFromCsv} onChange={(event) => setCreateLeadsFromCsv(event.target.checked)} />
                Criar ou atualizar leads no CRM quando o CSV nao encontrar um lead existente.
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="neutral">{csvTargets.length} linha(s)</Badge>
                <Badge tone={csvValidTargets.length > 0 ? 'success' : 'warning'}>{csvValidTargets.length} telefone(s) validos</Badge>
                {csvDuplicatePhoneCount > 0 && (
                  <Badge tone="warning">{csvDuplicatePhoneCount} duplicado(s) removido(s)</Badge>
                )}
              </div>
            </Surface>
          )}
          </>
          )}

          {wizardStep === 2 && (
          <>

          <Surface variant="muted" padding="sm" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">Sequencia do disparo</span>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Como no construtor de fluxo: cada estagio dispara sob o mesmo intervalo (ex: 3 mensagens imediatas, depois 2 mensagens 24h depois) e pode mudar o status do lead entre os envios.</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">{stages.length} estagio(s)</Badge>
                  <Badge tone="neutral">{flatMessages.length} mensagem(ns)</Badge>
                  {stages.some((stage) => stage.kind === 'status_change') && (
                    <Badge tone="accent">{stages.filter((stage) => stage.kind === 'status_change').length} mudanca(s) de status</Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {templates.length > 0 && (
                  <Select value="" onChange={(event) => handleLoadTemplate(event.target.value)}>
                    <option value="">Carregar modelo...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </Select>
                )}
                <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => void handleSaveTemplate()}>
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Salvar modelo
                </Button>
                <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={addStage}>
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar estagio
                </Button>
              </div>
            </div>

            {templates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <span key={template.id} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--panel-surface-soft)] py-1 pl-3 pr-1 text-xs text-[color:var(--panel-text-muted)]">
                    <FolderOpen className="h-3 w-3" />
                    {template.name}
                    <button
                      type="button"
                      className="ml-1 rounded-full p-1 hover:bg-[color:var(--panel-surface-soft)]"
                      onClick={() => void handleDeleteTemplate(template.id)}
                      title="Remover modelo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <label className="flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
              <Checkbox checked={abTestEnabled} onChange={(event) => setAbTestEnabled(event.target.checked)} />
              <span>
                <span className="inline-flex items-center gap-1.5 font-medium text-[color:var(--panel-text)]">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Teste A/B na mensagem inicial
                </span>
                <br />
                Sorteia entre duas versoes da primeira mensagem (primeiro estagio) e permite comparar a taxa de resposta de cada uma.
              </span>
            </label>
            {abTestEnabled && (
              <Field label={<FieldLabel text={`Percentual para a variante B (${abSplitPercent}%)`} hint="Chance de um contato receber a variante B em vez da A. Ex: 50% divide igualmente entre as duas versoes." />}>
                <Input
                  type="range"
                  min={1}
                  max={99}
                  value={abSplitPercent}
                  onChange={(event) => setAbSplitPercent(Number(event.target.value) || 50)}
                />
              </Field>
            )}

            <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {stages.map((stage, stageIndex) => {
                const isFirstStage = stageIndex === 0;
                return (
                  <div key={stageIndex} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--panel-accent-soft)] px-2 text-xs font-semibold text-[color:var(--panel-accent-strong)]">{stageIndex + 1}</span>
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--panel-text)]">{isFirstStage ? 'Estagio inicial' : `Estagio ${stageIndex + 1}`}</p>
                          <p className="text-xs text-[color:var(--panel-text-muted)]">{isFirstStage ? 'Dispara ao ativar ou no horario agendado.' : 'Dispara apos o intervalo abaixo, se nao houver resposta.'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          className="min-w-[11rem]"
                          value={stage.kind}
                          onChange={(event) => updateStage(stageIndex, { kind: event.target.value as CommWhatsAppCampaignStepKind })}
                        >
                          {(Object.keys(stepKindLabels) as CommWhatsAppCampaignStepKind[]).map((kind) => (
                            <option key={kind} value={kind}>{stepKindLabels[kind]}</option>
                          ))}
                        </Select>
                        {stages.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeStage(stageIndex)}>Remover estagio</Button>
                        )}
                      </div>
                    </div>

                    {!isFirstStage && (
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <Field label={<FieldLabel text="Aguardar desde o estagio anterior" hint="Quanto tempo esperar depois que o estagio anterior terminar antes de disparar este." />}>
                          <Input type="number" min={0} value={stage.delayAmount} onChange={(event) => updateStage(stageIndex, { delayAmount: Number(event.target.value) || 0 })} />
                        </Field>
                        <Field label={<FieldLabel text="Unidade" hint="Unidade de tempo do intervalo de espera ao lado." />}>
                          <Select
                            value={stage.delayUnit}
                            onChange={(event) => updateStage(stageIndex, { delayUnit: event.target.value as CommWhatsAppCampaignDelayUnit })}
                          >
                            <option value="seconds">segundos</option>
                            <option value="minutes">minutos</option>
                            <option value="hours">horas</option>
                            <option value="days">dias</option>
                          </Select>
                        </Field>
                      </div>
                    )}

                    {stage.kind === 'status_change' ? (
                      <Field label={<FieldLabel text="Novo status do lead" hint="Status que sera aplicado ao lead quando este estagio rodar. So vale para contatos vindos do CRM." />}>
                        <Select
                          value={stage.statusToSet ?? ''}
                          onChange={(event) => updateStage(stageIndex, { statusToSet: event.target.value })}
                        >
                          <option value="">Selecione um status</option>
                          {leadStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                        <p className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Vale so para contatos vindos do CRM; alvos importados por CSV sem lead vinculado pulam esta etapa.</p>
                      </Field>
                    ) : (
                      <div className="space-y-2">
                        {stage.messages.map((message, messageIndex) => {
                          const refKey = `${stageIndex}-${messageIndex}`;
                          const isVeryFirstMessage = isFirstStage && messageIndex === 0;
                          return (
                            <div key={messageIndex} className="rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-2">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-medium text-[color:var(--panel-text-muted)]">Mensagem {messageIndex + 1}</span>
                                {stage.messages.length > 1 && (
                                  <div className="flex items-center gap-0.5">
                                    <button type="button" className="rounded-full p-1 text-[color:var(--panel-text-muted)] hover:bg-[color:var(--panel-surface)] disabled:opacity-30" disabled={messageIndex === 0} onClick={() => moveMessageInStage(stageIndex, messageIndex, -1)} aria-label="Mover para cima">
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                    <button type="button" className="rounded-full p-1 text-[color:var(--panel-text-muted)] hover:bg-[color:var(--panel-surface)] disabled:opacity-30" disabled={messageIndex === stage.messages.length - 1} onClick={() => moveMessageInStage(stageIndex, messageIndex, 1)} aria-label="Mover para baixo">
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                    <button type="button" className="rounded-full p-1 text-[color:var(--danger-text)] hover:bg-[color:var(--panel-surface)]" onClick={() => removeMessageFromStage(stageIndex, messageIndex)} aria-label="Remover mensagem">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="relative">
                                <Textarea
                                  ref={(element) => { stepTextareaRefs.current[refKey] = element; }}
                                  size="compact"
                                  value={message.messageText}
                                  onChange={(event) => {
                                    updateMessage(stageIndex, messageIndex, { messageText: event.target.value });
                                    if (isVeryFirstMessage) setMessageText(event.target.value);
                                    updateVariableAutocomplete(stageIndex, messageIndex, event.target.value, event.target.selectionStart);
                                  }}
                                  onClick={(event) => updateVariableAutocomplete(stageIndex, messageIndex, event.currentTarget.value, event.currentTarget.selectionStart)}
                                  onKeyUp={(event) => updateVariableAutocomplete(stageIndex, messageIndex, event.currentTarget.value, event.currentTarget.selectionStart)}
                                  onBlur={() => window.setTimeout(() => setVariableAutocomplete(null), 120)}
                                  placeholder={isVeryFirstMessage ? 'Oi {{nome}}, tudo bem? Vi que sua cotacao ficou pendente.' : 'Passando novamente por aqui para saber se posso te ajudar.'}
                                />
                                {variableAutocomplete?.stageIndex === stageIndex && variableAutocomplete.messageIndex === messageIndex && visibleVariableSuggestions.length > 0 && (
                                  <div className="mt-2 overflow-hidden rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] shadow-xl">
                                    <div className="border-b border-[color:var(--panel-border-subtle)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">
                                      Variaveis disponiveis
                                    </div>
                                    <div className="max-h-56 overflow-y-auto py-1">
                                      {visibleVariableSuggestions.map((suggestion) => (
                                        <button
                                          key={suggestion.key}
                                          type="button"
                                          className="flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-[color:var(--panel-surface-soft)]"
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            insertVariableSuggestion(suggestion.key);
                                          }}
                                        >
                                          <code className="mt-0.5 rounded-[var(--kds-radius-sm)] bg-[color:var(--panel-accent-soft)] px-2 py-1 text-xs font-semibold text-[color:var(--panel-accent-ink)]">{`{{${suggestion.key}}}`}</code>
                                          <span>
                                            <span className="block text-sm font-medium text-[color:var(--panel-text)]">{suggestion.label}</span>
                                            <span className="block text-xs text-[color:var(--panel-text-muted)]">{suggestion.description}</span>
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <input
                                    ref={(element) => { mediaFileInputRefs.current[refKey] = element; }}
                                    type="file"
                                    accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                                    className="sr-only"
                                    onChange={(event) => void handleStepMediaUpload(stageIndex, messageIndex, event)}
                                  />
                                  {message.mediaUrl ? (
                                    <>
                                      <Badge tone="accent" size="sm" icon={ImageIcon}>
                                        {mediaTypeLabels[message.mediaType || 'document']}: {message.mediaFilename || 'arquivo anexado'}
                                      </Badge>
                                      <Button variant="ghost" size="sm" onClick={() => handleRemoveStepMedia(stageIndex, messageIndex)}>
                                        <X className="h-3.5 w-3.5" />
                                        Remover midia
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      loading={uploadingKey === refKey}
                                      onClick={() => mediaFileInputRefs.current[refKey]?.click()}
                                    >
                                      <Upload className="h-3.5 w-3.5" />
                                      Anexar midia
                                    </Button>
                                  )}
                                </div>

                                {isVeryFirstMessage && abTestEnabled && (
                                  <div className="mt-3">
                                    <Field label={<FieldLabel text="Variante B (texto alternativo)" hint="Versao alternativa da mensagem inicial, sorteada para uma fracao dos contatos, para comparar qual converte mais." />}>
                                      <Textarea
                                        size="compact"
                                        value={message.variantBMessageText ?? ''}
                                        onChange={(event) => updateMessage(stageIndex, messageIndex, { variantBMessageText: event.target.value })}
                                        placeholder="Ex: Oi {{primeiro_nome}}, ainda temos a sua cotacao em aberto - posso te ajudar?"
                                      />
                                    </Field>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-[color:var(--panel-accent-strong)] hover:underline"
                          onClick={() => addMessageToStage(stageIndex)}
                        >
                          <Plus className="h-3 w-3" /> Adicionar mensagem neste estagio
                        </button>
                        <p className="text-[10px] text-[color:var(--panel-text-muted)]">As mensagens deste estagio saem em sequencia, sem intervalo entre elas.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Surface>
          </>
          )}

          {wizardStep === 3 && (
          <>
          {audienceMode === 'crm' && (
            <Surface variant="muted" padding="sm" className="space-y-3">
              <div className="flex items-center gap-2">
                <Repeat2 className="h-4 w-4 text-[color:var(--panel-accent-strong)]" />
                <span className="text-sm font-semibold text-[color:var(--panel-text)]">Recorrencia</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={<FieldLabel text="Repetir" hint="Define se e com que frequencia esta campanha volta a rodar automaticamente para o mesmo publico de CRM." />}>
                  <Select value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value as CommWhatsAppCampaignRecurrenceRule)}>
                    {(Object.keys(recurrenceRuleLabels) as CommWhatsAppCampaignRecurrenceRule[]).map((rule) => (
                      <option key={rule} value={rule}>{recurrenceRuleLabels[rule]}</option>
                    ))}
                  </Select>
                </Field>
                {recurrenceRule !== 'none' && (
                  <>
                    <Field label={<FieldLabel text="A cada" hint="Multiplo do intervalo escolhido acima. Ex: 'semanalmente' + '2' repete a cada 2 semanas." />}>
                      <Input type="number" min={1} max={90} value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(Math.max(1, Number(event.target.value) || 1))} />
                    </Field>
                    <Field label={<FieldLabel text="Repetir ate (opcional)" hint="Data limite para as repeticoes automaticas. Deixe vazio para repetir indefinidamente." />}>
                      <DateTimePicker type="datetime-local" value={recurrenceEndAt} onChange={(event) => setRecurrenceEndAt(event.target.value)} />
                    </Field>
                  </>
                )}
              </div>
              {recurrenceRule !== 'none' && (
                <p className="text-xs text-[color:var(--panel-text-muted)]">
                  Quando esta campanha for concluida, o worker rematerializa o mesmo publico de CRM (respeitando opt-outs e o modo de reativacao segura) e ativa uma nova rodada automaticamente.
                </p>
              )}
            </Surface>
          )}

          {editingCampaign && (
            <Surface variant="muted" padding="sm" className="space-y-3">
              <div className="flex items-center gap-2">
                <TestTube2 className="h-4 w-4 text-[color:var(--panel-accent-strong)]" />
                <span className="text-sm font-semibold text-[color:var(--panel-text)]">Enviar teste</span>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={<FieldLabel text="Telefone (com DDD)" hint="Numero que vai receber a mensagem de teste. Use o seu proprio WhatsApp." />} className="min-w-[12rem] flex-1">
                  <Input value={testPhoneNumber} onChange={(event) => setTestPhoneNumber(event.target.value)} placeholder="(11) 99999-9999" />
                </Field>
                <Button variant="secondary" loading={sendingTest} onClick={() => void handleSendTest()}>
                  <Send className="h-3.5 w-3.5" />
                  Enviar mensagem inicial de teste
                </Button>
              </div>
              <p className="text-xs text-[color:var(--panel-text-muted)]">Envia a mensagem inicial (variante A) com variaveis preenchidas por dados de exemplo, sem afetar contatos reais nem contadores da campanha.</p>
            </Surface>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <Field label={<FieldLabel text="Agendar para" hint="Data e hora para o disparo comecar sozinho. Deixe vazio para poder ativar manualmente a qualquer momento." />}>
              <DateTimePicker type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </Field>
            <Field label={<FieldLabel text="Intervalo entre contatos" hint="So informativo, nao da pra editar: e o resultado de 'novos contatos por dia' dividido pela janela de envio. Define de quanto em quanto tempo um contato novo e admitido - o resto da sequencia dele (resto do estagio 1 e os estagios seguintes) sai normalmente, sem esperar esse intervalo." />}>
              <Input value={formatAdmissionInterval(admissionIntervalMinutes)} disabled readOnly />
            </Field>
            <Field label={<FieldLabel text="Novos contatos por dia" hint="Teto de contatos NOVOS que comecam a receber a campanha a cada 24 horas (so conta a primeira mensagem de cada um, ate 120/dia). Depois de admitido, o contato recebe o resto da sequencia normalmente, sem contar de novo nesse limite. Deixe vazio para nao limitar (contatos entram sem espacamento minimo)." />}>
              <Input type="number" min={1} max={120} value={dailySendLimit ?? ''} placeholder="Sem limite" onChange={(event) => { const value = Number(event.target.value); setDailySendLimit(Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 120) : null); }} />
            </Field>
            <Field label={<FieldLabel text="Janela inicio" hint="Horario a partir do qual o disparo pode enviar mensagens." />}>
              <DateTimePicker type="time" value={sendWindowStart} onChange={(event) => setSendWindowStart(event.target.value)} />
            </Field>
            <Field label={<FieldLabel text="Janela fim" hint="Horario limite para o envio. Fora da janela, o disparo fica pausado ate o proximo horario permitido." />}>
              <DateTimePicker type="time" value={sendWindowEnd} onChange={(event) => setSendWindowEnd(event.target.value)} />
            </Field>
          </div>
          </>
          )}
            </DialogBody>

          <DialogFooter className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[color:var(--panel-text-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--panel-accent-strong)]" />
              Respostas inbound param novos envios para aquele contato; opt-outs bloqueados serao excluidos da fila.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {wizardStep > 0 && (
                <Button variant="secondary" className="whitespace-nowrap" onClick={() => goToWizardStep(wizardStep - 1)}>
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              )}
              {wizardStep < campaignWizardSteps.length - 1 ? (
                <Button className="whitespace-nowrap" onClick={handleWizardNext}>
                  Proximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="whitespace-nowrap" onClick={() => void handleCreateDraft()} loading={saving}>
                  <Send className="h-4 w-4" />
                  Salvar
                </Button>
              )}
            </div>
          </DialogFooter>
        </Dialog>
      )}

      {activationPreview && (
        <Dialog open={Boolean(activationPreview)} onOpenChange={(open) => !open && closeActivationPreview()} size="lg" className="comm-whatsapp-overlay flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden">
            <DialogHeader onClose={closeActivationPreview}>
              <div>
                <DialogTitle>Revisar antes de ativar</DialogTitle>
                <DialogDescription>Confirme publico, ritmo, janela e mensagens antes de colocar o disparo na fila.</DialogDescription>
              </div>
            </DialogHeader>

            <DialogBody className="min-h-0 flex-1 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PreviewMetric label="Contatos estimados" value={activationPreview.estimatedTargets} />
                <PreviewMetric label="Etapas da sequencia" value={activationPreview.steps.filter((step) => step.variant_label !== 'B').length} />
                <PreviewMetric label="Intervalo entre contatos" value={formatAdmissionInterval(computeAdmissionIntervalMinutes(activationPreview.campaign.daily_send_limit, activationPreview.campaign.send_window_start, activationPreview.campaign.send_window_end))} />
                <PreviewMetric label="Duracao estimada" value={formatEstimatedDuration(activationPreview.estimatedMinutes)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                  <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Configuracao operacional</h3>
                  <div className="space-y-2 text-sm text-[color:var(--panel-text-soft)]">
                    <PreviewRow label="Campanha" value={activationPreview.campaign.name} />
                    <PreviewRow label="Agendamento" value={formatDateTime(activationPreview.campaign.scheduled_at)} />
                    <PreviewRow label="Janela" value={formatSendWindow(activationPreview.campaign)} />
                    <PreviewRow label="Origem" value={activationPreview.campaign.audience_source.toUpperCase()} />
                    <PreviewRow label="Targets materializados" value={String(activationPreview.materializedTargets)} />
                  </div>
                </Card>

                <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                  <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Variaveis detectadas</h3>
                  {activationPreview.variables.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activationPreview.variables.map((variable) => (
                        <Badge key={variable} tone={activationPreview.unknownVariables.includes(variable) ? 'danger' : 'neutral'}>{`{{${variable}}}`}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[color:var(--panel-text-muted)]">Nenhuma variavel foi usada nas mensagens.</p>
                  )}
                  {activationPreview.unknownVariables.length > 0 && (
                    <p className="text-xs text-[color:var(--danger-text)]">Ha variaveis nao reconhecidas. Elas podem ser enviadas vazias ou sem substituicao.</p>
                  )}
                </Card>
              </div>

              <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Sequencia da campanha</h3>
                <div className="space-y-2">
                  {activationPreview.steps.map((step, index) => (
                    <div key={step.id} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone={step.step_kind === 'status_change' ? 'accent' : 'neutral'}>
                          {step.step_kind === 'status_change' ? 'Mudar status' : `Mensagem ${index + 1}`}
                        </Badge>
                        {step.variant_label !== 'ANY' && <Badge tone="warning" size="sm">Variante {step.variant_label}</Badge>}
                        {step.delay_amount > 0 && <span className="text-xs text-[color:var(--panel-text-muted)]">Apos {step.delay_amount} {step.delay_unit}</span>}
                      </div>
                      {step.step_kind === 'status_change' ? (
                        <p className="text-sm text-[color:var(--panel-text-soft)]">Status do lead passa a ser: <strong>{step.status_to_set}</strong></p>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-[color:var(--panel-text-soft)]">{step.message_text || '(mensagem so com midia)'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Amostra do publico (com a mensagem ja resolvida por lead)</h3>
                {activationPreview.sample.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {activationPreview.sample.map((sample, index) => (
                      <div key={`${sample.phone}-${index}`} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3">
                        <p className="text-sm font-medium text-[color:var(--panel-text)]">{sample.name}</p>
                        <p className="text-xs text-[color:var(--panel-text-muted)]">{sample.phone}</p>
                        {(sample.status || sample.responsavel) && <p className="mt-1 text-xs text-[color:var(--panel-text-muted)]">{[sample.status, sample.responsavel].filter(Boolean).join(' · ')}</p>}
                        {sample.resolvedMessage && (
                          <p className="mt-2 whitespace-pre-wrap rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] p-2 text-xs text-[color:var(--panel-text-soft)]">{sample.resolvedMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--panel-text-muted)]">Nenhum contato encontrado para esta configuracao.</p>
                )}
              </Card>
            </DialogBody>

            <DialogFooter className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[color:var(--panel-text-muted)]">Ao confirmar, a campanha sera materializada e processada pelo cron mesmo com o navegador fechado.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="whitespace-nowrap" onClick={closeActivationPreview}>Cancelar</Button>
                <Button className="whitespace-nowrap" disabled={activationPreview.estimatedTargets <= 0} loading={campaignActionId === activationPreview.campaign.id} onClick={() => void handleConfirmActivateCampaign()}>
                  <PlayCircle className="h-4 w-4" />
                  Confirmar ativacao
                </Button>
              </div>
            </DialogFooter>
        </Dialog>
      )}

      <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Campanhas recentes</h2>
              <p className="text-sm text-[color:var(--panel-text-soft)]">Base criada para ativacao por worker.</p>
            </div>
            <MessageCircle className="h-5 w-5 text-[color:var(--panel-accent-strong)]" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-surface-soft)]" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-[var(--kds-radius-xl)] border border-dashed border-[color:var(--panel-border)] p-6 text-center">
              <p className="text-sm font-medium text-[color:var(--panel-text)]">Nenhum disparo criado ainda.</p>
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Crie o primeiro rascunho para validar publico e mensagem.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="comm-campaign-list-item rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${statusIconClasses[campaign.status]}`}>
                        <Send className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{campaign.name}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-[color:var(--panel-text-soft)]">{campaign.message_text || 'Sem mensagem definida.'}</p>
                      </div>
                    </div>
                    <Badge tone={statusTones[campaign.status]} size="sm" className="shrink-0">{statusLabels[campaign.status]}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniStat label="Alvos" value={campaign.total_targets} />
                    <MiniStat label="Enviados" value={campaign.sent_targets} />
                    <MiniStat label="Resp." value={campaign.responded_targets} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/painel/disparos/${campaign.id}`)}>
                      <Eye className="h-3.5 w-3.5" />
                      Detalhe
                    </Button>
                    <Button size="sm" variant="ghost" loading={loadingCampaignEdit && campaignActionId === campaign.id} onClick={() => {
                      setCampaignActionId(campaign.id);
                      void openEditCampaignModal(campaign).finally(() => setCampaignActionId(null));
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    {['draft', 'scheduled', 'paused'].includes(campaign.status) && (
                      <Button size="sm" variant="secondary" loading={campaignActionId === campaign.id && loadingActivationPreview} onClick={() => void openActivationPreview(campaign)}>
                        <PlayCircle className="h-3.5 w-3.5" />
                        Ativar
                      </Button>
                    )}
                    {['queued', 'running', 'scheduled'].includes(campaign.status) && (
                      <Button size="sm" variant="primary" loading={campaignActionId === campaign.id} onClick={() => void handleProcessCampaign(campaign)}>
                        <Send className="h-3.5 w-3.5" />
                        Processar lote
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
}

function AudienceButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <ActionSurface
      padding="sm"
      selected={active}
      onClick={onClick}
      className="inline-flex items-center gap-2 text-sm font-medium"
    >
      <Icon className="h-4 w-4" />
      {label}
    </ActionSurface>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] px-2 py-2">
      <span className="block font-semibold text-[color:var(--panel-text)]">{value}</span>
      <span className="block text-[color:var(--panel-text-muted)]">{label}</span>
    </span>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[color:var(--panel-text)]">{value}</p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[color:var(--panel-border-subtle)] pb-2 last:border-b-0 last:pb-0">
      <span className="text-[color:var(--panel-text-muted)]">{label}</span>
      <span className="text-right font-medium text-[color:var(--panel-text)]">{value}</span>
    </div>
  );
}

function formatIntentLabel(intent: CommWhatsAppAiIntentSuggestion['intent']) {
  const labels: Record<CommWhatsAppAiIntentSuggestion['intent'], string> = {
    opt_out: 'Pedir parar',
    negative_interest: 'Sem interesse',
    angry_or_complaint: 'Reclamacao',
    wrong_number: 'Numero errado',
    continue_conversation: 'Continuar',
    unclear: 'Ambiguo',
  };

  return labels[intent] ?? 'Revisar';
}
