import { Heading, Text, FieldLabel as DsFieldLabel } from '../../../design-system';
import { FileInput } from '../../../design-system';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, Bot, BookmarkPlus, CalendarClock, ChevronDown, ChevronUp, Eye, FileSpreadsheet, Filter, FlaskConical, FolderOpen, ImageIcon, Info, MessageCircle, PauseCircle, Pencil, PlayCircle, Plus, Repeat2, Send, ShieldCheck, TestTube2, Trash2, Upload, UserCircle, Users, X, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  ActionSurface,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  IconButton,
  OperationalMetricChip,
  PageHeader,
  Select,
  Stepper,
  Surface,
  Textarea,
  Tooltip,
  FilterMultiSelect,
} from '../../../design-system';
import { useConfig } from '../../../contexts/ConfigContext';
import { toast } from '../../../lib/toast';
import { getSafeChatDisplayName } from '../whatsapp';
import { subscribeToCampaignListChanges } from './campaignRealtime';
import {
  commWhatsAppCampaignService,
  computeContactIntervalMinutes,
  formatContactInterval,
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
  type CommWhatsAppCsvTargetDraft,
} from './commWhatsAppCampaignService';
import {
  getCampaignActivationBlocker,
  getCampaignMediaReadinessBlocker,
} from './domain/campaignReadiness';
import { CampaignDeliveryStatusCard } from './components/CampaignDeliveryStatusCard';
import { CampaignSequenceFlow } from './components/CampaignSequenceFlow';

const recurrenceRuleLabels: Record<CommWhatsAppCampaignRecurrenceRule, string> = {
  none: 'Não repetir',
  daily: 'Repetir diariamente',
  weekly: 'Repetir semanalmente',
  monthly: 'Repetir mensalmente',
};

const mediaTypeLabels: Record<CommWhatsAppCampaignMediaType, string> = {
  image: 'Imagem',
  document: 'Documento',
  video: 'Vídeo',
};

const stepKindLabels: Record<CommWhatsAppCampaignStepKind, string> = {
  message: 'Enviar mensagens',
  status_change: 'Mudar status do lead',
};

/** 0 = domingo .. 6 = sabado, mesma convencao usada pelo worker (Date.getDay()). */
const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
];

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
  { label: 'Mensagens', description: 'Sequência e status' },
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
type CampaignLoadError = 'all' | 'partial' | false;

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
  { key: 'saudacao', label: 'Saudação', description: 'Saudação atual em minúsculo, como "bom dia".' },
  { key: 'saudacao_titulo', label: 'Saudação em título', description: 'Saudação atual capitalizada, como "Bom dia".' },
  { key: 'saudacao_capitalizada', label: 'Saudação capitalizada', description: 'Alias de saudação capitalizada, como "Bom dia".' },
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
  running: 'Em andamento',
  paused: 'Pausado',
  completed: 'Concluído',
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
  const [workerHealthAvailable, setWorkerHealthAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<CampaignLoadError>(false);
  const [saving, setSaving] = useState(false);
  const [csvSaveProgress, setCsvSaveProgress] = useState<{ saved: number; total: number } | null>(null);
  const [campaignActionId, setCampaignActionId] = useState<string | null>(null);
  const [campaignPendingDelete, setCampaignPendingDelete] = useState<CommWhatsAppCampaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);
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
  const [validateWhatsappNumbers, setValidateWhatsappNumbers] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendWindowStart, setSendWindowStart] = useState('');
  const [sendWindowEnd, setSendWindowEnd] = useState('');
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dailySendLimit, setDailySendLimit] = useState<number | null>(null);
  const [contactIntervalMinutes, setContactIntervalMinutes] = useState<number | null>(null);
  const [interMessageIntervalSeconds, setInterMessageIntervalSeconds] = useState(0);
  const [pacingPerMinute, setPacingPerMinute] = useState(12);
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
  const campaignListRequestIdRef = useRef(0);
  const campaignEditRequestIdRef = useRef(0);
  const activationPreviewRequestIdRef = useRef(0);
  const campaignMutationLockRef = useRef(false);
  const testMessageLockRef = useRef(false);

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
  const estimatedEditorAudience = audienceMode === 'csv'
    ? csvValidTargets.length
    : editingCampaign?.total_targets ?? null;
  const admissionIntervalMinutes = useMemo(
    () => computeContactIntervalMinutes(contactIntervalMinutes, dailySendLimit, sendWindowStart, sendWindowEnd, estimatedEditorAudience),
    [contactIntervalMinutes, dailySendLimit, sendWindowStart, sendWindowEnd, estimatedEditorAudience],
  );

  const loadCampaigns = useCallback(async () => {
    const requestId = campaignListRequestIdRef.current + 1;
    campaignListRequestIdRef.current = requestId;
    setLoading(true);
    setLoadError(false);
    try {
      const results = await Promise.allSettled([
        commWhatsAppCampaignService.listCampaigns(),
        commWhatsAppCampaignService.getStats(),
        commWhatsAppCampaignService.listPendingAiSuggestions(),
        commWhatsAppCampaignService.getWorkerHealth(),
        commWhatsAppCampaignService.listTemplates(),
      ]);
      if (requestId !== campaignListRequestIdRef.current) return;

      const [campaignsResult, statsResult, suggestionsResult, workerHealthResult, templatesResult] = results;
      if (campaignsResult.status === 'fulfilled') setCampaigns(campaignsResult.value);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (suggestionsResult.status === 'fulfilled') setAiSuggestions(suggestionsResult.value);
      if (workerHealthResult.status === 'fulfilled') setWorkerHealth(workerHealthResult.value);
      setWorkerHealthAvailable(workerHealthResult.status === 'fulfilled');
      if (templatesResult.status === 'fulfilled') setTemplates(templatesResult.value);

      const failedResults = results.filter((result) => result.status === 'rejected');
      if (failedResults.length > 0) {
        setLoadError(failedResults.length === results.length ? 'all' : 'partial');
        console.warn('[WhatsAppCampaigns] alguns dados não puderam ser carregados', results);
      }
    } catch (error) {
      if (requestId !== campaignListRequestIdRef.current) return;
      console.error('[WhatsAppCampaigns] erro ao carregar os disparos', error);
      setLoadError('all');
    } finally {
      if (requestId === campaignListRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      campaignListRequestIdRef.current += 1;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadCampaigns(), 350);
    };

    const unsubscribe = subscribeToCampaignListChanges(scheduleRefresh);
    void loadCampaigns();

    return () => {
      campaignListRequestIdRef.current += 1;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [loadCampaigns]);

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Permite selecionar o mesmo arquivo novamente depois de corrigir ou
    // tentar importar de novo. Sem limpar o input, o navegador não dispara
    // outro `change` quando o arquivo escolhido é exatamente o mesmo.
    event.target.value = '';

    try {
      setCsvText(await file.text());
    } catch (error) {
      console.error('[WhatsAppCampaigns] erro ao ler arquivo CSV', error);
      toast.error('Não foi possível ler este arquivo CSV. Tente selecionar o arquivo novamente.');
    }
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
    setValidateWhatsappNumbers(true);
    setScheduledAt('');
    setSendWindowStart('');
    setSendWindowEnd('');
    setActiveWeekdays([1, 2, 3, 4, 5]);
    setDailySendLimit(null);
    setContactIntervalMinutes(null);
    setInterMessageIntervalSeconds(0);
    setPacingPerMinute(12);
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
    campaignEditRequestIdRef.current += 1;
    resetCampaignForm();
    setCampaignModalOpen(true);
  };

  const closeCampaignModal = () => {
    campaignEditRequestIdRef.current += 1;
    setCampaignActionId(null);
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
    const requestId = ++campaignEditRequestIdRef.current;
    setLoadingCampaignEdit(true);
    try {
      const campaignSteps = await commWhatsAppCampaignService.listCampaignSteps(campaign.id);
      if (requestId !== campaignEditRequestIdRef.current) {
        return;
      }
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
      setValidateWhatsappNumbers(campaign.validate_whatsapp_numbers);
      setScheduledAt(campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '');
      setSendWindowStart(campaign.send_window_start ? campaign.send_window_start.slice(0, 5) : '');
      setSendWindowEnd(campaign.send_window_end ? campaign.send_window_end.slice(0, 5) : '');
      setActiveWeekdays(campaign.active_weekdays?.length ? campaign.active_weekdays : [0, 1, 2, 3, 4, 5, 6]);
      setDailySendLimit(campaign.daily_send_limit ?? null);
      setContactIntervalMinutes(campaign.contact_interval_minutes ?? null);
      setInterMessageIntervalSeconds(Math.round((campaign.inter_message_interval_minutes ?? 0) * 60));
      setPacingPerMinute(campaign.pacing_per_minute || 12);
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
      if (requestId === campaignEditRequestIdRef.current) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível carregar este disparo para edição.');
      }
    } finally {
      if (requestId === campaignEditRequestIdRef.current) {
        setLoadingCampaignEdit(false);
        setCampaignActionId(null);
      }
    }
  };

  const handleCreateDraft = async () => {
    if (saving || campaignMutationLockRef.current) return;
    if (!name.trim()) {
      toast.warning('Informe um nome para o disparo.');
      return;
    }

    if (!firstMessageText && !flatMessages.some((item) => item.mediaUrl)) {
      toast.warning('Escreva pelo menos uma mensagem ou anexe uma mídia no disparo.');
      return;
    }

    const emptyStatusStage = stages.find((stage) => stage.kind === 'status_change' && !stage.statusToSet?.trim());
    if (emptyStatusStage) {
      toast.warning('Selecione o status a aplicar em cada etapa de "Mudar status do lead".');
      return;
    }

    if (!editingCampaign && audienceMode === 'csv' && csvValidTargets.length === 0) {
      toast.warning('Cole ou importe um CSV com pelo menos um telefone válido.');
      return;
    }

    campaignMutationLockRef.current = true;
    setSaving(true);
    setCsvSaveProgress(null);
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
        // calculado no banco pela configuracao, publico elegivel e janela.
        pacingPerMinute,
        dailySendLimit,
        contactIntervalMinutes,
        interMessageIntervalSeconds,
        sendWindowStart: sendWindowStart || null,
        sendWindowEnd: sendWindowEnd || null,
        activeWeekdays: activeWeekdays.length > 0 ? activeWeekdays : [0, 1, 2, 3, 4, 5, 6],
        stopOnReply: true,
        createLeadsFromCsv,
        validateWhatsappNumbers: audienceMode === 'csv' && validateWhatsappNumbers,
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
        await commWhatsAppCampaignService.createDraft(payload, (saved, total) => {
          setCsvSaveProgress({ saved, total });
        });
      }

      toast.success(editingCampaign ? 'Disparo atualizado.' : 'Disparo salvo.');
      closeCampaignModal();
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o disparo.');
    } finally {
      campaignMutationLockRef.current = false;
      setSaving(false);
      setCsvSaveProgress(null);
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

  const addStage = (kind: CommWhatsAppCampaignStepKind) => {
    setStages((current) => [...current, { ...defaultStage(1, 'days'), kind }]);
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
      toast.success('Mídia anexada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a mídia.');
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
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.');
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
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o modelo.');
    }
  };

  const handleSendTest = async () => {
    if (!editingCampaign) return;
    if (testMessageLockRef.current) return;
    if (!testPhoneNumber.trim()) {
      toast.warning('Informe um telefone para o envio de teste.');
      return;
    }

    testMessageLockRef.current = true;
    setSendingTest(true);
    try {
      await commWhatsAppCampaignService.sendTestMessage(editingCampaign.id, testPhoneNumber, 0, 'A');
      toast.success('Mensagem de teste enviada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem de teste.');
    } finally {
      testMessageLockRef.current = false;
      setSendingTest(false);
    }
  };

  const openActivationPreview = async (campaign: CommWhatsAppCampaign) => {
    const requestId = ++activationPreviewRequestIdRef.current;
    setCampaignActionId(campaign.id);
    setLoadingActivationPreview(true);
    try {
      const preview = await commWhatsAppCampaignService.getActivationPreview(campaign.id);
      if (requestId !== activationPreviewRequestIdRef.current) {
        return;
      }
      setActivationPreview(preview);
    } catch (error) {
      if (requestId === activationPreviewRequestIdRef.current) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível montar a revisão do disparo.');
      }
    } finally {
      if (requestId === activationPreviewRequestIdRef.current) {
        setCampaignActionId(null);
        setLoadingActivationPreview(false);
      }
    }
  };

  const closeActivationPreview = () => {
    activationPreviewRequestIdRef.current += 1;
    setActivationPreview(null);
    setCampaignActionId(null);
    setLoadingActivationPreview(false);
  };

  const handleConfirmActivateCampaign = async () => {
    if (!activationPreview) return;
    if (campaignMutationLockRef.current) return;
    campaignMutationLockRef.current = true;
    setCampaignActionId(activationPreview.campaign.id);
    try {
      const result = await commWhatsAppCampaignService.activateCampaign(activationPreview.campaign.id);
      toast.success(result.status === 'scheduled' ? 'Disparo agendado e pronto para a fila.' : 'Disparo ativado e colocado na fila.');
      closeActivationPreview();
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ativar o disparo.');
    } finally {
      campaignMutationLockRef.current = false;
      setCampaignActionId(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignPendingDelete) return;
    if (campaignMutationLockRef.current) return;
    campaignMutationLockRef.current = true;
    setDeletingCampaign(true);
    try {
      await commWhatsAppCampaignService.deleteCampaign(campaignPendingDelete.id);
      toast.success('Disparo excluído.');
      setCampaignPendingDelete(null);
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o disparo.');
    } finally {
      campaignMutationLockRef.current = false;
      setDeletingCampaign(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: CommWhatsAppAiIntentSuggestion) => {
    if (campaignMutationLockRef.current) return;
    campaignMutationLockRef.current = true;
    setSuggestionActionId(suggestion.id);
    try {
      await commWhatsAppCampaignService.acceptAiSuggestion(suggestion);
      toast.success('Pedido registrado: este contato deixará de receber campanhas e mensagens de acompanhamento.');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível bloquear este contato.');
    } finally {
      campaignMutationLockRef.current = false;
      setSuggestionActionId(null);
    }
  };

  const handleDismissSuggestion = async (suggestion: CommWhatsAppAiIntentSuggestion) => {
    if (campaignMutationLockRef.current) return;
    campaignMutationLockRef.current = true;
    setSuggestionActionId(suggestion.id);
    try {
      await commWhatsAppCampaignService.dismissAiSuggestion(suggestion.id);
      toast.success('Sugestão dispensada.');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível dispensar a sugestão.');
    } finally {
      campaignMutationLockRef.current = false;
      setSuggestionActionId(null);
    }
  };

  return (
    <div className="comm-terracotta comm-terracotta-campaigns panel-page-shell space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        title="Disparos WhatsApp"
        description="Crie campanhas para seus contatos, defina as mensagens e acompanhe os envios. Você também pode importar uma lista de uma planilha CSV."
        actions={(
          <div className="comm-campaign-header-actions flex flex-wrap items-center gap-2 lg:justify-end">
            <OperationalMetricChip className="kds-mobile-compact-metric" icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />} label="campanhas" value={stats.total} />
            <OperationalMetricChip className="kds-mobile-compact-metric" icon={<PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />} label="rascunhos" value={stats.drafts} />
            <OperationalMetricChip className="kds-mobile-compact-metric" icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />} label="agendadas" value={stats.scheduled} tone="accent" />
            <OperationalMetricChip className="kds-mobile-compact-metric" icon={<PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />} label="ativas" value={stats.active} tone="success" active={stats.active > 0} />
            <OperationalMetricChip className="kds-mobile-compact-metric" icon={<Bot className="h-3.5 w-3.5" aria-hidden="true" />} label="sugestoes IA" value={stats.aiSuggestionsPending} tone="warning" active={stats.aiSuggestionsPending > 0} />
            <Button variant="primary" className="whitespace-nowrap" onClick={openNewCampaignModal}>
              <Plus className="kds-control-icon" />
              Novo disparo
            </Button>
          </div>
        )}
      />

      <CampaignDeliveryStatusCard health={workerHealth} available={workerHealthAvailable} loading={loading} />

      {aiSuggestions.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Heading level={2} className="text-lg font-semibold text-[color:var(--panel-text)]">Sinais de IA para revisar</Heading>
              <Text className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Confira respostas que podem indicar um pedido para parar as mensagens, número errado ou reclamação. A IA sugere a revisão; você confirma a decisão.</Text>
            </div>
            <Badge tone="warning">{aiSuggestions.length} pendente(s)</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {aiSuggestions.map((suggestion) => {
              const cp = suggestion.contact_permission;
              const isHighRisk = cp === 'OPT_OUT_EXPLICITO' || cp === 'NUMERO_ERRADO' || cp === 'DESTINATARIO_INCORRETO' || cp === 'RECLAMACAO_CONTATO';
              return (
                <Surface key={suggestion.id} variant="muted" padding="sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isHighRisk
                            ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                            : 'bg-[var(--warning-soft)] text-[var(--warning-text)]'
                        }`}
                      >
                        <Bot className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <Heading level={3} className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{getSafeChatDisplayName({ ...suggestion.chat, phone_digits: suggestion.phone_digits })}</Heading>
                        <Text className="text-xs text-[color:var(--panel-text-muted)]">{suggestion.campaign?.name || 'Campanha sem nome'}</Text>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={isHighRisk ? 'danger' : 'warning'} size="sm" className="shrink-0">
                        {formatContactPermissionLabel(cp)} · {Math.round((suggestion.confidence ?? 0) * 100)}%
                      </Badge>
                      {suggestion.commercial_intent && suggestion.commercial_intent !== 'OUTRO' && (
                        <Badge tone="info" size="sm" className="shrink-0">
                          {formatCommercialIntentLabel(suggestion.commercial_intent)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Text className="mt-3 text-sm text-[color:var(--panel-text-soft)]">{suggestion.reason || 'A IA recomendou revisar esta resposta antes de novos disparos.'}</Text>
                  {suggestion.evidence && (
                    <blockquote className="mt-3 rounded-[var(--kds-radius-md)] border-l-4 border-[color:var(--panel-accent-strong)] bg-[color:var(--panel-surface)] px-3 py-2 text-xs text-[color:var(--panel-text-soft)]">
                      {suggestion.evidence}
                    </blockquote>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestion.intent === 'opt_out' && suggestion.recommended_action === 'suggest_block_whatsapp_campaigns' ? (
                      <Button size="sm" variant="danger" loading={suggestionActionId === suggestion.id} onClick={() => void handleAcceptSuggestion(suggestion)}>
                        Parar mensagens comerciais
                      </Button>
                    ) : suggestion.intent === 'wrong_number' ? (
                      <Text className="self-center text-xs text-[color:var(--panel-text-muted)]">
                        Se o número ou a pessoa estiver incorreta, confira os dados do contato antes de registrar um pedido para parar as mensagens.
                      </Text>
                    ) : null}
                    <Button size="sm" variant="secondary" loading={suggestionActionId === suggestion.id} onClick={() => void handleDismissSuggestion(suggestion)}>
                      Dispensar
                    </Button>
                  </div>
                </Surface>
              );
            })}
          </div>
        </Card>
      )}

      {campaignModalOpen && (
        <Dialog open={campaignModalOpen} onOpenChange={(open) => !open && !saving && closeCampaignModal()} size="xl" className="comm-whatsapp-overlay">
            <DialogHeader onClose={saving ? undefined : closeCampaignModal}>
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
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Reativação PME maio" />
            </Field>
            <Field label={<FieldLabel text="Objetivo" hint="Anotação livre sobre o propósito da campanha, só para referência interna da equipe." />}>
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
              <Field label={<FieldLabel text="Status do lead" hint="Filtra o público pelos status atuais no CRM. Deixe vazio para incluir todos os status." />}>
                <FilterMultiSelect icon={Filter} options={leadStatusOptions} placeholder="Todos os status" values={leadStatusFilters} onChange={setLeadStatusFilters} />
              </Field>
              <Field label={<FieldLabel text="Responsável" hint="Filtra o público pelo responsável atribuído ao lead no CRM." />}>
                <FilterMultiSelect icon={UserCircle} options={leadOwnerOptions} placeholder="Todos os responsaveis" values={leadOwnerFilters} onChange={setLeadOwnerFilters} />
              </Field>
              <DsFieldLabel className="md:col-span-2 flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
                <Checkbox checked={reactivationMode} onChange={(event) => setReactivationMode(event.target.checked)} />
                <span><span className="font-medium text-[color:var(--panel-text)]">Modo reativação segura</span><br />Exige último contato antigo e suprime quem recebeu outra campanha recentemente.</span>
              </DsFieldLabel>
              {reactivationMode && (
                <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
                  <Field label={<FieldLabel text="Sem contato há pelo menos (dias)" hint="Só inclui leads cujo último contato registrado foi há pelo menos esse número de dias." />}>
                    <Input type="number" min={1} value={inactiveDays} onChange={(event) => setInactiveDays(Math.max(1, Number(event.target.value) || 1))} />
                  </Field>
                  <Field label={<FieldLabel text="Suprimir campanha recente (dias)" hint="Exclui quem já recebeu qualquer outra campanha dentro desse número de dias, para não repetir contato." />}>
                    <Input type="number" min={0} value={recentCampaignDays} onChange={(event) => setRecentCampaignDays(Math.max(0, Number(event.target.value) || 0))} />
                  </Field>
                </div>
              )}
              <Text className="md:col-span-2 text-xs text-[color:var(--panel-text-muted)]">O sistema vai processar os alvos no momento de ativar a campanha, removendo contatos arquivados, duplicados, números inválidos e pessoas que pediram para não receber mensagens.</Text>
            </Surface>
          ) : (
            <Surface variant="muted" padding="sm" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Text className="text-sm font-semibold text-[color:var(--panel-text)]">CSV com nome e telefone</Text>
                  <Text className="text-xs text-[color:var(--panel-text-muted)]">Aceita cabecalhos como nome, telefone, phone, celular ou whatsapp.</Text>
                </div>
                <DsFieldLabel className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] px-3 py-2 text-sm font-medium text-[color:var(--panel-text)] transition hover:border-[color:var(--panel-accent-strong)]">
                  <FileSpreadsheet className="h-4 w-4" />
                  Escolher arquivo
                  <FileInput  accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleCsvFile(event)} />
                </DsFieldLabel>
              </div>
              <Textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={'nome;telefone\nMaria Silva;(11) 99999-9999'} />
              <DsFieldLabel className="flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
                <Checkbox className="mt-1" checked={createLeadsFromCsv} onChange={(event) => setCreateLeadsFromCsv(event.target.checked)} />
                Criar leads no CRM para os contatos do CSV (origem "Disparo"); contatos cujo telefone já existir no CRM são vinculados ao lead existente em vez de duplicados.
              </DsFieldLabel>
              <DsFieldLabel className="flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
                <Checkbox className="mt-1" checked={validateWhatsappNumbers} onChange={(event) => setValidateWhatsappNumbers(event.target.checked)} />
                Validar no WhatsApp antes de enviar: após salvar, cada número é checado em segundo plano (pode levar horas em listas grandes) e números sem WhatsApp são excluídos do envio automaticamente, sem precisar revisar a lista manualmente.
              </DsFieldLabel>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="neutral">{csvTargets.length} linha(s)</Badge>
                <Badge tone={csvValidTargets.length > 0 ? 'success' : 'warning'}>{csvValidTargets.length} telefone(s) válidos</Badge>
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
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">Sequência do disparo</span>
                <Text className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Monte o caminho de cada contato: envie mensagens, aguarde e mude o status. Selecione uma etapa no mapa para editar os detalhes.</Text>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">{stages.length} etapa(s)</Badge>
                  <Badge tone="neutral">{flatMessages.length} mensagem(ns)</Badge>
                  {stages.some((stage) => stage.kind === 'status_change') && (
                    <Badge tone="accent">{stages.filter((stage) => stage.kind === 'status_change').length} mudança(s) de status</Badge>
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
                <Button variant="secondary" size="sm" onClick={() => void handleSaveTemplate()}>
                  <BookmarkPlus className="kds-control-icon" />
                  Salvar modelo
                </Button>
              </div>
            </div>

            <Field label={<FieldLabel text="Intervalo entre balões (segundos)" hint="Informe a espera mínima entre as mensagens, em segundos. Exemplo: 10 espera pelo menos 10 segundos. Use 0 para manter o padrão de cerca de 3 segundos. Uma resposta pode interromper a sequência. Em sequências longas ou esperas de 60 segundos ou mais, a retomada pode levar até 1 minuto adicional." />}>
              <Input type="number" min={0} max={86400} step={1} value={interMessageIntervalSeconds} onChange={(event) => setInterMessageIntervalSeconds(Math.min(86400, Math.max(0, Math.floor(Number(event.target.value) || 0))))} />
            </Field>

            {templates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <span key={template.id} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--panel-surface-soft)] py-1 pl-3 pr-1 text-xs text-[color:var(--panel-text-muted)]">
                    <FolderOpen className="h-3 w-3" />
                    {template.name}
                    <IconButton variant="ghost" size="sm" aria-label="Remover modelo"
                      type="button"
                      className="ml-1"
                      onClick={() => void handleDeleteTemplate(template.id)}
                      title="Remover modelo"
                    >
                      <Trash2 className="" />
                    </IconButton>
                  </span>
                ))}
              </div>
            )}

            <DsFieldLabel className="flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
              <Checkbox checked={abTestEnabled} onChange={(event) => setAbTestEnabled(event.target.checked)} />
              <span>
                <span className="inline-flex items-center gap-1.5 font-medium text-[color:var(--panel-text)]">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Teste A/B na mensagem inicial
                </span>
                <br />
                Sorteia entre duas versões da primeira mensagem (primeira etapa) e permite comparar a taxa de resposta de cada uma.
              </span>
            </DsFieldLabel>
            {abTestEnabled && (
              <Field label={<FieldLabel text={`Percentual para a variante B (${abSplitPercent}%)`} hint="Chance de um contato receber a variante B em vez da A. Ex: 50% divide igualmente entre as duas versões." />}>
                <Input
                  type="range"
                  min={1}
                  max={99}
                  value={abSplitPercent}
                  onChange={(event) => setAbSplitPercent(Number(event.target.value) || 50)}
                />
              </Field>
            )}

            <CampaignSequenceFlow
              stages={stages}
              statusOptions={leadStatusOptions}
              interMessageIntervalSeconds={interMessageIntervalSeconds}
              abTestEnabled={abTestEnabled}
              onAddStage={addStage}
              renderStageEditor={(stage, stageIndex) => {
                const isFirstStage = stageIndex === 0;
                return (
                  <div key={stageIndex} className="p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--panel-accent-soft)] px-2 text-xs font-semibold text-[color:var(--panel-accent-strong)]">{stageIndex + 1}</span>
                        <div>
                          <Text className="text-sm font-semibold text-[color:var(--panel-text)]">{isFirstStage ? 'Etapa inicial' : `Etapa ${stageIndex + 1}`}</Text>
                          <Text className="text-xs text-[color:var(--panel-text-muted)]">{isFirstStage ? 'Dispara ao ativar ou no horário agendado.' : 'Dispara após o intervalo abaixo, se não houver resposta.'}</Text>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          aria-label="Ação desta etapa"
                          className="min-w-[11rem]"
                          value={stage.kind}
                          onChange={(event) => updateStage(stageIndex, { kind: event.target.value as CommWhatsAppCampaignStepKind })}
                        >
                          {(Object.keys(stepKindLabels) as CommWhatsAppCampaignStepKind[]).map((kind) => (
                            <option key={kind} value={kind}>{stepKindLabels[kind]}</option>
                          ))}
                        </Select>
                        {stages.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeStage(stageIndex)}>Remover etapa</Button>
                        )}
                      </div>
                    </div>

                    {!isFirstStage && (
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <Field label={<FieldLabel text="Aguardar desde a etapa anterior" hint="Quanto tempo esperar depois que a etapa anterior terminar antes de disparar este." />}>
                          <Input type="number" min={0} step={1} value={stage.delayAmount} onChange={(event) => updateStage(stageIndex, { delayAmount: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} />
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
                      <Field label={<FieldLabel text="Novo status do lead" hint="Status que será aplicado ao lead quando esta etapa rodar. Vale para contatos vindos do CRM e para contatos de CSV com 'Criar leads no CRM' habilitado." />}>
                        <Select
                          value={stage.statusToSet ?? ''}
                          onChange={(event) => updateStage(stageIndex, { statusToSet: event.target.value })}
                        >
                          <option value="">Selecione um status</option>
                          {leadStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                        <Text className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Alvos de CSV sem lead vinculado (checkbox "Criar leads no CRM" desmarcado, ou falha ao criar) pulam esta etapa.</Text>
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
                                    <IconButton type="button" size="sm" variant="ghost" disabled={messageIndex === 0} onClick={() => moveMessageInStage(stageIndex, messageIndex, -1)} aria-label="Mover para cima">
                                      <ChevronUp />
                                    </IconButton>
                                    <IconButton type="button" size="sm" variant="ghost" disabled={messageIndex === stage.messages.length - 1} onClick={() => moveMessageInStage(stageIndex, messageIndex, 1)} aria-label="Mover para baixo">
                                      <ChevronDown />
                                    </IconButton>
                                    <IconButton type="button" size="sm" variant="danger" onClick={() => removeMessageFromStage(stageIndex, messageIndex)} aria-label="Remover mensagem">
                                      <Trash2 />
                                    </IconButton>
                                  </div>
                                )}
                              </div>
                              <div className="relative">
                                <Textarea
                                  ref={(element) => { stepTextareaRefs.current[refKey] = element; }}
                                  size="sm"
                                  value={message.messageText}
                                  onChange={(event) => {
                                    updateMessage(stageIndex, messageIndex, { messageText: event.target.value });
                                    if (isVeryFirstMessage) setMessageText(event.target.value);
                                    updateVariableAutocomplete(stageIndex, messageIndex, event.target.value, event.target.selectionStart);
                                  }}
                                  onClick={(event) => updateVariableAutocomplete(stageIndex, messageIndex, event.currentTarget.value, event.currentTarget.selectionStart)}
                                  onKeyUp={(event) => updateVariableAutocomplete(stageIndex, messageIndex, event.currentTarget.value, event.currentTarget.selectionStart)}
                                  onBlur={() => window.setTimeout(() => setVariableAutocomplete(null), 120)}
                                  placeholder={isVeryFirstMessage ? 'Oi {{nome}}, tudo bem? Vi que sua cotação ficou pendente.' : 'Passando novamente por aqui para saber se posso te ajudar.'}
                                />
                                {variableAutocomplete?.stageIndex === stageIndex && variableAutocomplete.messageIndex === messageIndex && visibleVariableSuggestions.length > 0 && (
                                  <div className="mt-2 overflow-hidden rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] shadow-xl">
                                    <div className="border-b border-[color:var(--panel-border-subtle)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">
                                      Variáveis disponíveis
                                    </div>
                                    <div className="max-h-56 overflow-y-auto py-1">
                                      {visibleVariableSuggestions.map((suggestion) => (
                                        <ActionSurface variant="plain" padding="none"
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
                                        </ActionSurface>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <FileInput
                                    ref={(element) => { mediaFileInputRefs.current[refKey] = element; }}

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
                                        <X className="kds-control-icon" />
                                        Remover mídia
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      loading={uploadingKey === refKey}
                                      onClick={() => mediaFileInputRefs.current[refKey]?.click()}
                                    >
                                      {uploadingKey !== refKey && <Upload className="kds-control-icon" />}
                                      Anexar mídia
                                    </Button>
                                  )}
                                </div>

                                {isVeryFirstMessage && abTestEnabled && (
                                  <div className="mt-3">
                                    <Field label={<FieldLabel text="Variante B (texto alternativo)" hint="Versão alternativa da mensagem inicial, sorteada para uma fração dos contatos, para comparar qual converte mais." />}>
                                      <Textarea
                                        size="sm"
                                        value={message.variantBMessageText ?? ''}
                                        onChange={(event) => updateMessage(stageIndex, messageIndex, { variantBMessageText: event.target.value })}
                                        placeholder="Ex: Oi {{primeiro_nome}}, ainda temos a sua cotação em aberto - posso te ajudar?"
                                      />
                                    </Field>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <Button
                          type="button"
                          size="sm"
                          variant="text"
                          onClick={() => addMessageToStage(stageIndex)}
                        >
                          <Plus /> Adicionar mensagem nesta etapa
                        </Button>
                        <Text className="text-xs text-[color:var(--panel-text-muted)]">Cada mensagem aparece em um balão separado no WhatsApp.</Text>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </Surface>
          </>
          )}

          {wizardStep === 3 && (
          <>
          {audienceMode === 'crm' && (
            <Surface variant="muted" padding="sm" className="space-y-3">
              <div className="flex items-center gap-2">
                <Repeat2 className="h-4 w-4 text-[color:var(--panel-accent-strong)]" />
                <span className="text-sm font-semibold text-[color:var(--panel-text)]">Recorrência</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={<FieldLabel text="Repetir" hint="Define se e com que frequência esta campanha volta a rodar automaticamente para o mesmo público de CRM." />}>
                  <Select value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value as CommWhatsAppCampaignRecurrenceRule)}>
                    {(Object.keys(recurrenceRuleLabels) as CommWhatsAppCampaignRecurrenceRule[]).map((rule) => (
                      <option key={rule} value={rule}>{recurrenceRuleLabels[rule]}</option>
                    ))}
                  </Select>
                </Field>
                {recurrenceRule !== 'none' && (
                  <>
                    <Field label={<FieldLabel text="A cada" hint="Múltiplo do intervalo escolhido acima. Ex: 'semanalmente' + '2' repete a cada 2 semanas." />}>
                      <Input type="number" min={1} max={90} value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(Math.max(1, Number(event.target.value) || 1))} />
                    </Field>
                    <Field label={<FieldLabel text="Repetir até (opcional)" hint="Data limite para as repetições automáticas. Deixe vazio para repetir indefinidamente." />}>
                      <DateTimePicker type="datetime-local" value={recurrenceEndAt} onChange={(event) => setRecurrenceEndAt(event.target.value)} />
                    </Field>
                  </>
                )}
              </div>
              {recurrenceRule !== 'none' && (
                <Text className="text-xs text-[color:var(--panel-text-muted)]">
                  Quando esta campanha terminar, o sistema prepara novamente a lista de contatos do CRM e inicia outra rodada. Pessoas que pediram para não receber mensagens continuam excluídas; as regras de reativação também são respeitadas.
                </Text>
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
                <Field label={<FieldLabel text="Telefone (com DDD)" hint="Número que vai receber a mensagem de teste. Use o seu próprio WhatsApp." />} className="min-w-[12rem] flex-1">
                  <Input value={testPhoneNumber} onChange={(event) => setTestPhoneNumber(event.target.value)} placeholder="(11) 99999-9999" />
                </Field>
                <Button variant="secondary" loading={sendingTest} onClick={() => void handleSendTest()}>
                  {!sendingTest && <Send className="kds-control-icon" />}
                  Enviar mensagem inicial de teste
                </Button>
              </div>
              <Text className="text-xs text-[color:var(--panel-text-muted)]">Envia a mensagem inicial (variante A) com variáveis preenchidas por dados de exemplo, sem afetar contatos reais nem contadores da campanha.</Text>
            </Surface>
          )}

          <div className="grid gap-4 md:grid-cols-5">
            <Field label={<FieldLabel text="Agendar para" hint="A data só entra em vigor depois da ativação explícita da campanha." />}>
              <DateTimePicker type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </Field>
            <Field label={<FieldLabel text="Intervalo entre contatos (minutos)" hint="Deixe vazio para distribuir automaticamente os contatos elegíveis pela janela do dia. Um valor definido vira o intervalo mínimo entre novos contatos; o limite diário continua valendo." />}>
              <Input type="number" min={1} max={1440} value={contactIntervalMinutes ?? ''} placeholder="Automático pela janela" onChange={(event) => { const value = Number(event.target.value); setContactIntervalMinutes(event.target.value.trim() && Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 1440) : null); }} />
              <Text className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Cadência prevista: {formatContactInterval(admissionIntervalMinutes)}</Text>
            </Field>
            <Field label={<FieldLabel text="Novos contatos por 24h" hint="Teto móvel de pessoas que iniciam a campanha em qualquer período de 24 horas. Cada pessoa conta uma vez; as mensagens seguintes do mesmo contato não consomem novas vagas." />}>
              <Input type="number" min={1} max={120} value={dailySendLimit ?? ''} placeholder="Sem limite" onChange={(event) => { const value = Number(event.target.value); setDailySendLimit(Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 120) : null); }} />
            </Field>
            <Field label={<FieldLabel text="Janela início" hint="Horário a partir do qual o disparo pode enviar mensagens." />}>
              <DateTimePicker type="time" value={sendWindowStart} onChange={(event) => setSendWindowStart(event.target.value)} />
            </Field>
            <Field label={<FieldLabel text="Janela fim" hint="Horário limite para o envio. Fora da janela, o disparo fica pausado até o próximo horário permitido." />}>
              <DateTimePicker type="time" value={sendWindowEnd} onChange={(event) => setSendWindowEnd(event.target.value)} />
            </Field>
          </div>
          <Field label={<FieldLabel text="Dias de envio" hint="Dias da semana em que o disparo pode enviar mensagens. Nos dias desmarcados, o disparo fica pausado (igual a fora da janela de horário) e retoma sozinho no próximo dia permitido." />}>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_OPTIONS.map((day) => {
                const isActive = activeWeekdays.includes(day.value);
                return (
                  <Button
                    key={day.value}
                    type="button"
                    variant={isActive ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveWeekdays((current) => {
                      const next = current.includes(day.value)
                        ? current.filter((value) => value !== day.value)
                        : [...current, day.value];
                      return next.length > 0 ? next : current;
                    })}
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </Field>
          </>
          )}
            </DialogBody>

          <DialogFooter className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[color:var(--panel-text-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--panel-accent-strong)]" />
              {csvSaveProgress
                ? `Salvando contatos do CSV: ${csvSaveProgress.saved.toLocaleString('pt-BR')} de ${csvSaveProgress.total.toLocaleString('pt-BR')}. Não feche esta janela.`
                : 'Respostas interrompem novos envios para aquele contato. Quem pediu para não receber mensagens fica fora da fila.'}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {wizardStep > 0 && (
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => goToWizardStep(wizardStep - 1)} disabled={saving}>
                  <ArrowLeft className="kds-control-icon" />
                  Voltar
                </Button>
              )}
              {wizardStep < campaignWizardSteps.length - 1 ? (
                <Button className="w-full sm:w-auto" onClick={handleWizardNext}>
                  Próximo
                  <ArrowRight className="kds-control-icon" />
                </Button>
              ) : (
                <Button className="w-full sm:w-auto" onClick={() => void handleCreateDraft()} loading={saving}>
                  {!saving && <Send className="kds-control-icon" />}
                  {csvSaveProgress ? `Salvando ${csvSaveProgress.saved.toLocaleString('pt-BR')}/${csvSaveProgress.total.toLocaleString('pt-BR')}` : 'Salvar'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </Dialog>
      )}

      {activationPreview && (
        <Dialog open={Boolean(activationPreview)} onOpenChange={(open) => !open && closeActivationPreview()} size="lg" className="comm-whatsapp-overlay">
            <DialogHeader onClose={closeActivationPreview}>
              <div>
                <DialogTitle>Revisar antes de ativar</DialogTitle>
                <DialogDescription>Confirme público, ritmo, janela e mensagens antes de colocar o disparo na fila.</DialogDescription>
              </div>
            </DialogHeader>

            <DialogBody className="min-h-0 flex-1 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PreviewMetric label="Contatos estimados" value={activationPreview.estimatedTargets} />
                <PreviewMetric label="Etapas da sequência" value={activationPreview.steps.filter((step) => step.variant_label !== 'B').length} />
                <PreviewMetric label="Intervalo entre contatos" value={formatContactInterval(computeContactIntervalMinutes(activationPreview.campaign.contact_interval_minutes, activationPreview.campaign.daily_send_limit, activationPreview.campaign.send_window_start, activationPreview.campaign.send_window_end, activationPreview.estimatedTargets))} />
                <PreviewMetric label="Duração estimada" value={formatEstimatedDuration(activationPreview.estimatedMinutes)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                  <Heading level={3} className="text-sm font-semibold text-[color:var(--panel-text)]">Configuração operacional</Heading>
                  <div className="space-y-2 text-sm text-[color:var(--panel-text-soft)]">
                    <PreviewRow label="Campanha" value={activationPreview.campaign.name} />
                    <PreviewRow label="Agendamento" value={formatDateTime(activationPreview.campaign.scheduled_at)} />
                    <PreviewRow label="Janela" value={formatSendWindow(activationPreview.campaign)} />
                    <PreviewRow label="Intervalo entre balões" value={activationPreview.campaign.inter_message_interval_minutes > 0 ? `Pelo menos ${Math.round(activationPreview.campaign.inter_message_interval_minutes * 60)} segundos` : 'Padrão (cerca de 3 segundos)'} />
                    <PreviewRow label="Novos contatos por 24h" value={activationPreview.campaign.daily_send_limit ? String(activationPreview.campaign.daily_send_limit) : 'Sem limite'} />
                    <PreviewRow label="Origem" value={activationPreview.campaign.audience_source.toUpperCase()} />
                    <PreviewRow label="Contatos processados" value={String(activationPreview.materializedTargets)} />
                  </div>
                </Card>

                <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                  <Heading level={3} className="text-sm font-semibold text-[color:var(--panel-text)]">Regras de envio</Heading>
                  <Text className="text-sm text-[color:var(--panel-text-soft)]">A lista importada pode seguir para a fila sem autorização comercial cadastrada. Ficam de fora os telefones inválidos, quem pediu para não receber mensagens e os contatos que já receberam outra campanha nas últimas 24 horas.</Text>
                  {getCampaignMediaReadinessBlocker(activationPreview.campaign.id, activationPreview.steps, activationPreview.campaign.ab_test_enabled) && (
                    <Text className="text-sm text-[color:var(--danger-text)]">{getCampaignMediaReadinessBlocker(activationPreview.campaign.id, activationPreview.steps, activationPreview.campaign.ab_test_enabled)}</Text>
                  )}
                </Card>

                <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                  <Heading level={3} className="text-sm font-semibold text-[color:var(--panel-text)]">Variáveis detectadas</Heading>
                  {activationPreview.variables.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activationPreview.variables.map((variable) => (
                        <Badge key={variable} tone={activationPreview.unknownVariables.includes(variable) ? 'danger' : 'neutral'}>{`{{${variable}}}`}</Badge>
                      ))}
                    </div>
                  ) : (
                    <Text className="text-sm text-[color:var(--panel-text-muted)]">Nenhuma variável foi usada nas mensagens.</Text>
                  )}
                  {activationPreview.unknownVariables.length > 0 && (
                    <Text className="text-xs text-[color:var(--danger-text)]">Há variáveis não reconhecidas. Elas podem ser enviadas vazias ou sem substituição.</Text>
                  )}
                </Card>
              </div>

              <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                <Heading level={3} className="text-sm font-semibold text-[color:var(--panel-text)]">Sequência da campanha</Heading>
                <div className="space-y-2">
                  {activationPreview.steps.map((step, index) => (
                    <div key={step.id} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone={step.step_kind === 'status_change' ? 'accent' : 'neutral'}>
                          {step.step_kind === 'status_change' ? 'Mudar status' : `Mensagem ${index + 1}`}
                        </Badge>
                        {step.variant_label !== 'ANY' && <Badge tone="warning" size="sm">Variante {step.variant_label}</Badge>}
                        {step.delay_amount > 0 && <span className="text-xs text-[color:var(--panel-text-muted)]">Após {step.delay_amount} {step.delay_unit}</span>}
                      </div>
                      {step.step_kind === 'status_change' ? (
                        <Text className="text-sm text-[color:var(--panel-text-soft)]">Status do lead passa a ser: <strong>{step.status_to_set}</strong></Text>
                      ) : (
                        <Text className="whitespace-pre-wrap text-sm text-[color:var(--panel-text-soft)]">{step.message_text || '(mensagem só com mídia)'}</Text>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                <Heading level={3} className="text-sm font-semibold text-[color:var(--panel-text)]">Amostra do público (com a mensagem já resolvida por lead)</Heading>
                {activationPreview.sample.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {activationPreview.sample.map((sample, index) => (
                      <div key={`${sample.phone}-${index}`} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3">
                        <Text className="text-sm font-medium text-[color:var(--panel-text)]">{sample.name}</Text>
                        <Text className="text-xs text-[color:var(--panel-text-muted)]">{sample.phone}</Text>
                        {(sample.status || sample.responsavel) && <Text className="mt-1 text-xs text-[color:var(--panel-text-muted)]">{[sample.status, sample.responsavel].filter(Boolean).join(' · ')}</Text>}
                        {sample.resolvedMessage && (
                          <Text className="mt-2 whitespace-pre-wrap rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] p-2 text-xs text-[color:var(--panel-text-soft)]">{sample.resolvedMessage}</Text>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text className="text-sm text-[color:var(--panel-text-muted)]">Nenhum contato encontrado para esta configuração.</Text>
                )}
              </Card>
            </DialogBody>

            <DialogFooter className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Text className="text-xs text-[color:var(--panel-text-muted)]">Ao confirmar, a campanha será processada automaticamente, mesmo com o navegador fechado.</Text>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={closeActivationPreview}>Cancelar</Button>
                <Button className="w-full sm:w-auto" disabled={activationPreview.estimatedTargets <= 0 || Boolean(getCampaignActivationBlocker(activationPreview.campaign, activationPreview.steps))} loading={campaignActionId === activationPreview.campaign.id} onClick={() => void handleConfirmActivateCampaign()}>
                  {campaignActionId !== activationPreview.campaign.id && <PlayCircle className="kds-control-icon" />}
                  Confirmar ativação
                </Button>
              </div>
            </DialogFooter>
        </Dialog>
      )}

      <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Heading level={2} className="text-lg font-semibold text-[color:var(--panel-text)]">Campanhas recentes</Heading>
              <Text className="text-sm text-[color:var(--panel-text-soft)]">Base criada para processamento automático.</Text>
            </div>
            <MessageCircle className="h-5 w-5 text-[color:var(--panel-accent-strong)]" />
          </div>

          {loadError ? (
            <Alert
              tone="warning"
              title={loadError === 'all' ? 'Não foi possível carregar as campanhas.' : 'Alguns dados das campanhas não foram atualizados.'}
              action={(
                <Button type="button" variant="secondary" size="sm" onClick={() => void loadCampaigns()} loading={loading}>
                  Tentar novamente
                </Button>
              )}
            >
              Os dados que carregaram continuam disponíveis. Nenhuma campanha foi excluída.
            </Alert>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-surface-soft)]" />)}
            </div>
          ) : loadError === 'all' && campaigns.length === 0 ? (
            <div className="rounded-[var(--kds-radius-xl)] border border-dashed border-[color:var(--panel-border)] p-6 text-center">
              <Text className="text-sm font-medium text-[color:var(--panel-text)]">Não foi possível carregar as campanhas.</Text>
              <Text className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Tente atualizar novamente. Nenhuma campanha foi excluída.</Text>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-[var(--kds-radius-xl)] border border-dashed border-[color:var(--panel-border)] p-6 text-center">
              <Text className="text-sm font-medium text-[color:var(--panel-text)]">Nenhum disparo criado ainda.</Text>
              <Text className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Crie o primeiro rascunho para validar público e mensagem.</Text>
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
                        <Heading level={3} className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{campaign.name}</Heading>
                        <Text className="mt-1 line-clamp-2 text-xs text-[color:var(--panel-text-soft)]">{campaign.message_text || 'Sem mensagem definida.'}</Text>
                      </div>
                    </div>
                    <Badge tone={statusTones[campaign.status]} size="sm" className="shrink-0">{statusLabels[campaign.status]}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniStat label="Alvos" value={campaign.total_targets} />
                    <MiniStat label="Enviados" value={campaign.sent_targets} />
                    <MiniStat label="Resp." value={campaign.responded_targets} />
                  </div>
                  <div className="kds-campaign-card-actions mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/painel/disparos/${campaign.id}`)}>
                      <Eye className="kds-control-icon" />
                      Detalhe
                    </Button>
                    <Button size="sm" variant="ghost" loading={loadingCampaignEdit && campaignActionId === campaign.id} onClick={() => {
                      setCampaignActionId(campaign.id);
                      void openEditCampaignModal(campaign);
                    }}>
                      {!(loadingCampaignEdit && campaignActionId === campaign.id) && <Pencil className="kds-control-icon" />}
                      Editar
                    </Button>
                    {['draft', 'scheduled', 'paused'].includes(campaign.status) && (
                      <Button size="sm" variant="secondary" loading={campaignActionId === campaign.id && loadingActivationPreview} onClick={() => void openActivationPreview(campaign)}>
                        {!(campaignActionId === campaign.id && loadingActivationPreview) && <PlayCircle className="kds-control-icon" />}
                        Ativar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setCampaignPendingDelete(campaign)}>
                      <Trash2 className="kds-control-icon" />
                      Excluir
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
      </Card>

      <ConfirmDialog
        open={Boolean(campaignPendingDelete)}
        onOpenChange={(open) => !open && !deletingCampaign && setCampaignPendingDelete(null)}
        onConfirm={() => void handleDeleteCampaign()}
        title="Excluir disparo?"
        description={
          campaignPendingDelete
            ? `"${campaignPendingDelete.name}" será excluído junto com todos os alvos, mensagens e eventos registrados. Essa ação não pode ser desfeita.${['queued', 'running'].includes(campaignPendingDelete.status) ? ' Essa campanha está ativa - excluir agora pode interromper envios em andamento.' : ''}`
            : undefined
        }
        confirmLabel="Excluir"
        destructive
        loading={deletingCampaign}
      />
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
      <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</Text>
      <Text className="mt-2 text-xl font-semibold text-[color:var(--panel-text)]">{value}</Text>
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

function formatContactPermissionLabel(cp: string | null) {
  const labels: Record<string, string> = {
    OPT_OUT_EXPLICITO: 'Opt-out explícito',
    NUMERO_ERRADO: 'Número errado',
    DESTINATARIO_INCORRETO: 'Destinatário incorreto',
    RECLAMACAO_CONTATO: 'Reclamação',
    AMBIGUO: 'Ambíguo',
    NENHUM_SINAL: 'Sem sinal',
  };
  return labels[cp ?? ''] ?? 'Revisar';
}

function formatCommercialIntentLabel(ci: string | null) {
  const labels: Record<string, string> = {
    JA_POSSUI_PLANO: 'Já possui plano',
    INTERESSADO: 'Interessado',
    SEM_INTERESSE: 'Sem interesse',
    QUER_SABER_MAIS: 'Quer saber mais',
    ADIAR_CONTATO: 'Adiar contato',
    OUTRO: 'Outro',
  };
  return labels[ci ?? ''] ?? '';
}
