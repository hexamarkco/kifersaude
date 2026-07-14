import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Activity, Bot, CalendarClock, Eye, FileSpreadsheet, Filter, MessageCircle, PauseCircle, Pencil, PlayCircle, Plus, RefreshCw, Send, ShieldCheck, UserCircle, Users, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import '../communicationTerracotta.css';
import { ActionSurface, Badge, Button, Card, Checkbox, Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, PageHeader, Select, Surface, Textarea } from '../../../design-system';
import FilterMultiSelect from '../../../components/FilterMultiSelect';
import { useConfig } from '../../../contexts/ConfigContext';
import { toast } from '../../../lib/toast';
import {
  commWhatsAppCampaignService,
  type CampaignStats,
  type CommWhatsAppAiIntentSuggestion,
  type CommWhatsAppCampaign,
  type CommWhatsAppCampaignAudienceSource,
  type CommWhatsAppCampaignActivationPreview,
  type CommWhatsAppCampaignStepDraft,
  type CommWhatsAppCampaignWorkerHealth,
  type CommWhatsAppCampaignWorkerRun,
  type CommWhatsAppCsvTargetDraft,
} from './commWhatsAppCampaignService';

type AudienceMode = 'crm' | 'csv';

type VariableAutocompleteState = {
  stepIndex: number;
  query: string;
  replaceStart: number;
  replaceEnd: number;
};

const campaignVariableSuggestions = [
  { key: 'nome', label: 'Nome completo', description: 'Nome do lead ou contato.' },
  { key: 'primeiro_nome', label: 'Primeiro nome', description: 'Primeiro nome do lead ou contato.' },
  { key: 'telefone', label: 'Telefone', description: 'Telefone normalizado do contato.' },
  { key: 'status', label: 'Status', description: 'Status atual do lead no CRM.' },
  { key: 'responsavel', label: 'Responsavel', description: 'Responsavel atual pelo lead.' },
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

const getVariableAutocompleteState = (value: string, cursorPosition: number, stepIndex: number): VariableAutocompleteState | null => {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/{{\s*([a-zA-Z0-9_]*)$/);
  if (!match || match.index === undefined) return null;
  return {
    stepIndex,
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
  const [editingCampaign, setEditingCampaign] = useState<CommWhatsAppCampaign | null>(null);
  const [loadingCampaignEdit, setLoadingCampaignEdit] = useState(false);
  const [activationPreview, setActivationPreview] = useState<CommWhatsAppCampaignActivationPreview | null>(null);
  const [loadingActivationPreview, setLoadingActivationPreview] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('crm');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [messageText, setMessageText] = useState('');
  const [steps, setSteps] = useState<CommWhatsAppCampaignStepDraft[]>([
    { messageText: '', delayAmount: 0, delayUnit: 'minutes' },
  ]);
  const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>([]);
  const [leadOwnerFilters, setLeadOwnerFilters] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [createLeadsFromCsv, setCreateLeadsFromCsv] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendWindowStart, setSendWindowStart] = useState('');
  const [sendWindowEnd, setSendWindowEnd] = useState('');
  const [pacingPerMinute, setPacingPerMinute] = useState(12);
  const [variableAutocomplete, setVariableAutocomplete] = useState<VariableAutocompleteState | null>(null);
  const stepTextareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  const csvTargets = useMemo(() => parseCsvTargets(csvText), [csvText]);
  const leadStatusOptions = useMemo(
    () => leadStatuses.filter((status) => status.ativo).map((status) => ({ value: status.nome, label: status.nome })),
    [leadStatuses],
  );
  const leadOwnerOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo).map((option) => ({ value: option.value, label: option.label })),
    [options.lead_responsavel],
  );
  const firstMessageText = steps.find((step) => step.messageText.trim())?.messageText.trim() || messageText.trim();
  const visibleVariableSuggestions = useMemo(() => {
    if (!variableAutocomplete) return [];
    return campaignVariableSuggestions.filter((suggestion) => (
      suggestion.key.includes(variableAutocomplete.query)
      || suggestion.label.toLowerCase().includes(variableAutocomplete.query)
    ));
  }, [variableAutocomplete]);
  const csvValidTargets = useMemo(
    () => csvTargets.filter((target) => commWhatsAppCampaignService.normalizePhoneDigits(target.phoneNumber).length > 0),
    [csvTargets],
  );

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCampaigns, nextStats, nextSuggestions, nextWorkerHealth] = await Promise.all([
        commWhatsAppCampaignService.listCampaigns(),
        commWhatsAppCampaignService.getStats(),
        commWhatsAppCampaignService.listPendingAiSuggestions(),
        commWhatsAppCampaignService.getWorkerHealth(),
      ]);
      setCampaigns(nextCampaigns);
      setStats(nextStats);
      setAiSuggestions(nextSuggestions);
      setWorkerHealth(nextWorkerHealth);
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
    setSteps([{ messageText: '', delayAmount: 0, delayUnit: 'minutes' }]);
    setLeadStatusFilters([]);
    setLeadOwnerFilters([]);
    setCsvText('');
    setCreateLeadsFromCsv(false);
    setScheduledAt('');
    setSendWindowStart('');
    setSendWindowEnd('');
    setPacingPerMinute(12);
    setVariableAutocomplete(null);
  };

  const openNewCampaignModal = () => {
    resetCampaignForm();
    setCampaignModalOpen(true);
  };

  const closeCampaignModal = () => {
    setCampaignModalOpen(false);
    resetCampaignForm();
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
      setSteps(campaignSteps.length > 0
        ? campaignSteps.map((step) => ({
            messageText: step.message_text,
            delayAmount: step.delay_amount,
            delayUnit: step.delay_unit,
          }))
        : [{ messageText: campaign.message_text ?? '', delayAmount: 0, delayUnit: 'minutes' }]);
      setLeadStatusFilters(readStringArrayFilter(filters, 'statuses', 'status'));
      setLeadOwnerFilters(readStringArrayFilter(filters, 'responsaveis', 'responsavel'));
      setCsvText('');
      setCreateLeadsFromCsv(campaign.create_leads_from_csv);
      setScheduledAt(campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '');
      setSendWindowStart(campaign.send_window_start ? campaign.send_window_start.slice(0, 5) : '');
      setSendWindowEnd(campaign.send_window_end ? campaign.send_window_end.slice(0, 5) : '');
      setPacingPerMinute(campaign.pacing_per_minute || 12);
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

    if (!firstMessageText) {
      toast.warning('Escreva pelo menos uma mensagem do disparo.');
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
              only_active: true,
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

      const normalizedSteps = steps
        .map((step, index) => ({
          messageText: step.messageText.trim(),
          delayAmount: index === 0 ? 0 : Math.max(Math.floor(step.delayAmount || 0), 0),
          delayUnit: step.delayUnit,
        }))
        .filter((step) => step.messageText.length > 0);

      const payload = {
        name,
        objective,
        audienceSource,
        audienceConfig,
        messageText: firstMessageText,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        pacingPerMinute,
        sendWindowStart: sendWindowStart || null,
        sendWindowEnd: sendWindowEnd || null,
        stopOnReply: true,
        createLeadsFromCsv,
        steps: normalizedSteps,
        csvTargets: !editingCampaign && audienceMode === 'csv' ? csvValidTargets : [],
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

  const updateVariableAutocomplete = (stepIndex: number, value: string, cursorPosition: number | null) => {
    if (cursorPosition === null) {
      setVariableAutocomplete(null);
      return;
    }

    setVariableAutocomplete(getVariableAutocompleteState(value, cursorPosition, stepIndex));
  };

  const insertVariableSuggestion = (suggestionKey: string) => {
    if (!variableAutocomplete) return;
    const stepIndex = variableAutocomplete.stepIndex;
    const currentStep = steps[stepIndex];
    if (!currentStep) return;

    const nextText = `${currentStep.messageText.slice(0, variableAutocomplete.replaceStart)}{{${suggestionKey}}}${currentStep.messageText.slice(variableAutocomplete.replaceEnd)}`;
    const nextCursorPosition = variableAutocomplete.replaceStart + suggestionKey.length + 4;
    updateStep(stepIndex, { messageText: nextText });
    if (stepIndex === 0) setMessageText(nextText);
    setVariableAutocomplete(null);

    window.setTimeout(() => {
      const textarea = stepTextareaRefs.current[stepIndex];
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    }, 0);
  };

  const updateStep = (index: number, patch: Partial<CommWhatsAppCampaignStepDraft>) => {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  };

  const addStep = () => {
    setSteps((current) => [...current, { messageText: '', delayAmount: 1, delayUnit: 'days' }]);
  };

  const removeStep = (index: number) => {
    setSteps((current) => current.length <= 1 ? current : current.filter((_, stepIndex) => stepIndex !== index));
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
          <div className="flex flex-wrap gap-2">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Send} label="Campanhas" value={stats.total} />
        <MetricCard icon={PauseCircle} label="Rascunhos" value={stats.drafts} />
        <MetricCard icon={CalendarClock} label="Agendadas" value={stats.scheduled} />
        <MetricCard icon={PlayCircle} label="Ativas" value={stats.active} />
        <MetricCard icon={Bot} label="Sugestoes IA" value={stats.aiSuggestionsPending} />
      </div>

      <Card className="comm-campaign-toolbar space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="h-5 w-5 text-[color:var(--panel-accent)]" />
              <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Saude do worker</h2>
              <Badge tone={getWorkerRunTone(workerHealth.latestRun)}>
                {workerHealth.latestRun ? workerHealth.latestRun.status : 'sem execucao'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">
              Ultima execucao {formatRelativeRunTime(workerHealth.latestRun?.finished_at ?? workerHealth.latestRun?.started_at)}.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
            <WorkerHealthStat label="Processados" value={workerHealth.latestRun?.processed ?? 0} />
            <WorkerHealthStat label="Enviados" value={workerHealth.latestRun?.sent ?? 0} />
            <WorkerHealthStat label="Falhas" value={workerHealth.latestRun?.failed ?? 0} />
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
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{suggestion.chat?.display_name || suggestion.chat?.phone_number || suggestion.phone_digits || 'Contato sem nome'}</h3>
                    <p className="text-xs text-[color:var(--panel-text-muted)]">{suggestion.campaign?.name || 'Campanha sem nome'}</p>
                  </div>
                  <Badge tone={suggestion.intent === 'opt_out' || suggestion.intent === 'wrong_number' ? 'danger' : 'warning'} size="sm">
                    {formatIntentLabel(suggestion.intent)} · {Math.round((suggestion.confidence ?? 0) * 100)}%
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[color:var(--panel-text-soft)]">{suggestion.reason || 'A IA recomendou revisar esta resposta antes de novos disparos.'}</p>
                {suggestion.evidence && (
                  <blockquote className="mt-3 rounded-[var(--kds-radius-md)] border-l-4 border-[color:var(--panel-accent)] bg-[color:var(--panel-surface)] px-3 py-2 text-xs text-[color:var(--panel-text-soft)]">
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
                <DialogDescription>Configure publico, pacote de mensagens, agendamento e ritmo de envio.</DialogDescription>
              </div>
            </DialogHeader>

            <DialogBody className="min-h-0 flex-1 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome da campanha">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Reativacao PME maio" />
            </Field>
            <Field label="Objetivo">
              <Input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Ex: retomar cotacoes paradas" />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <AudienceButton active={audienceMode === 'crm'} icon={Users} label="Leads do CRM" onClick={() => setAudienceMode('crm')} />
            <AudienceButton active={audienceMode === 'csv'} icon={FileSpreadsheet} label="Importar CSV" onClick={() => setAudienceMode('csv')} />
          </div>

          {audienceMode === 'crm' ? (
            <Surface variant="muted" padding="sm" className="grid gap-4 md:grid-cols-2">
              <Field label="Status do lead">
                <FilterMultiSelect icon={Filter} options={leadStatusOptions} placeholder="Todos os status" values={leadStatusFilters} onChange={setLeadStatusFilters} />
              </Field>
              <Field label="Responsavel">
                <FilterMultiSelect icon={UserCircle} options={leadOwnerOptions} placeholder="Todos os responsaveis" values={leadOwnerFilters} onChange={setLeadOwnerFilters} />
              </Field>
              <p className="md:col-span-2 text-xs text-[color:var(--panel-text-muted)]">O worker vai materializar os alvos no momento de ativar a campanha, removendo arquivados, duplicados, numeros invalidos e opt-outs.</p>
            </Surface>
          ) : (
            <Surface variant="muted" padding="sm" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text)]">CSV com nome e telefone</p>
                  <p className="text-xs text-[color:var(--panel-text-muted)]">Aceita cabecalhos como nome, telefone, phone, celular ou whatsapp.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] px-3 py-2 text-sm font-medium text-[color:var(--panel-text)] transition hover:border-[color:var(--panel-accent)]">
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
              </div>
            </Surface>
          )}

          <Surface variant="muted" padding="sm" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">Pacote de mensagens</span>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Configure a sequencia em blocos compactos. A lista abaixo rola separadamente quando houver muitas mensagens.</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">{steps.length} mensagem(ns)</Badge>
                  <Badge tone="neutral">1 inicial</Badge>
                  {steps.length > 1 && <Badge tone="neutral">{steps.length - 1} follow-up(s)</Badge>}
                </div>
              </div>
              <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={addStep}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {steps.map((step, index) => (
                <div key={index} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--panel-accent-soft)] px-2 text-xs font-semibold text-[color:var(--panel-accent)]">{index + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--panel-text)]">{index === 0 ? 'Mensagem inicial' : 'Follow-up'}</p>
                        <p className="text-xs text-[color:var(--panel-text-muted)]">{index === 0 ? 'Enviada ao ativar ou no horario agendado.' : 'Enviado depois do intervalo abaixo, se nao houver resposta.'}</p>
                      </div>
                    </div>
                    {steps.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeStep(index)}>Remover</Button>
                    )}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="relative">
                      <Textarea
                        ref={(element) => {
                          stepTextareaRefs.current[index] = element;
                        }}
                        size="compact"
                        value={step.messageText}
                        onChange={(event) => {
                          updateStep(index, { messageText: event.target.value });
                          if (index === 0) setMessageText(event.target.value);
                          updateVariableAutocomplete(index, event.target.value, event.target.selectionStart);
                        }}
                        onClick={(event) => updateVariableAutocomplete(index, event.currentTarget.value, event.currentTarget.selectionStart)}
                        onKeyUp={(event) => updateVariableAutocomplete(index, event.currentTarget.value, event.currentTarget.selectionStart)}
                        onBlur={() => window.setTimeout(() => setVariableAutocomplete(null), 120)}
                        placeholder={index === 0 ? 'Oi {{nome}}, tudo bem? Vi que sua cotacao ficou pendente.' : 'Passando novamente por aqui para saber se posso te ajudar.'}
                      />
                      {variableAutocomplete?.stepIndex === index && visibleVariableSuggestions.length > 0 && (
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
                    </div>
                    <Surface variant="muted" padding="sm" className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-1 ${index === 0 ? 'items-center' : ''}`}>
                      {index === 0 ? (
                        <p className="text-xs text-[color:var(--panel-text-muted)]">Sem atraso nesta etapa.</p>
                      ) : (
                        <>
                          <Field label="Aguardar">
                            <Input type="number" min={0} value={step.delayAmount} onChange={(event) => updateStep(index, { delayAmount: Number(event.target.value) || 0 })} />
                          </Field>
                          <Field label="Unidade">
                            <Select
                              value={step.delayUnit}
                              onChange={(event) => updateStep(index, { delayUnit: event.target.value as CommWhatsAppCampaignStepDraft['delayUnit'] })}
                            >
                              <option value="seconds">segundos</option>
                              <option value="minutes">minutos</option>
                              <option value="hours">horas</option>
                              <option value="days">dias</option>
                            </Select>
                          </Field>
                        </>
                      )}
                    </Surface>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Agendar para">
              <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </Field>
            <Field label="Ritmo por minuto">
              <Input type="number" min={1} max={120} value={pacingPerMinute} onChange={(event) => setPacingPerMinute(Number(event.target.value) || 1)} />
            </Field>
            <Field label="Janela inicio">
              <Input type="time" value={sendWindowStart} onChange={(event) => setSendWindowStart(event.target.value)} />
            </Field>
            <Field label="Janela fim">
              <Input type="time" value={sendWindowEnd} onChange={(event) => setSendWindowEnd(event.target.value)} />
            </Field>
          </div>
            </DialogBody>

          <DialogFooter className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[color:var(--panel-text-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--panel-accent)]" />
              Respostas inbound param novos envios para aquele contato; opt-outs bloqueados serao excluidos da fila.
            </div>
            <Button className="whitespace-nowrap" onClick={() => void handleCreateDraft()} loading={saving}>
              <Send className="h-4 w-4" />
              Salvar
            </Button>
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
                <PreviewMetric label="Mensagens por contato" value={activationPreview.steps.length} />
                <PreviewMetric label="Ritmo" value={`${activationPreview.campaign.pacing_per_minute}/min`} />
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
                    <p className="text-xs text-[color:var(--panel-danger)]">Ha variaveis nao reconhecidas. Elas podem ser enviadas vazias ou sem substituicao.</p>
                  )}
                </Card>
              </div>

              <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Sequencia de mensagens</h3>
                <div className="space-y-2">
                  {activationPreview.steps.map((step, index) => (
                    <div key={step.id} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">Mensagem {index + 1}</Badge>
                        {index > 0 && <span className="text-xs text-[color:var(--panel-text-muted)]">Apos {step.delay_amount} {step.delay_unit}</span>}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-[color:var(--panel-text-soft)]">{step.message_text}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3 bg-[color:var(--panel-surface-soft)]">
                <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Amostra do publico</h3>
                {activationPreview.sample.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {activationPreview.sample.map((sample, index) => (
                      <div key={`${sample.phone}-${index}`} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3">
                        <p className="text-sm font-medium text-[color:var(--panel-text)]">{sample.name}</p>
                        <p className="text-xs text-[color:var(--panel-text-muted)]">{sample.phone}</p>
                        {(sample.status || sample.responsavel) && <p className="mt-1 text-xs text-[color:var(--panel-text-muted)]">{[sample.status, sample.responsavel].filter(Boolean).join(' · ')}</p>}
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
            <MessageCircle className="h-5 w-5 text-[color:var(--panel-accent)]" />
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
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="comm-campaign-list-item rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{campaign.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[color:var(--panel-text-soft)]">{campaign.message_text || 'Sem mensagem definida.'}</p>
                    </div>
                    <Badge tone={statusTones[campaign.status]} size="sm">{statusLabels[campaign.status]}</Badge>
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

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card padding="sm" className="comm-campaign-metric flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-accent-soft)] text-[color:var(--panel-accent-strong)]">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-lg font-semibold text-[color:var(--panel-text)]">{value}</span>
        <span className="block text-xs text-[color:var(--panel-text-muted)]">{label}</span>
      </span>
    </Card>
  );
}

function WorkerHealthStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-surface-soft)] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text)]">{value}</p>
    </div>
  );
}

function AudienceButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <ActionSurface
      padding="sm"
      variant={active ? 'warning' : 'default'}
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
