import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Square,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import ReactFlow, { Background, Controls, MarkerType, MiniMap, Position, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import ModalShell from '../ui/ModalShell';
import VariableAutocompleteTextarea from '../ui/VariableAutocompleteTextarea';
import { fetchAllPages, supabase } from '../../lib/supabase';
import {
  buildWhatsAppCampaignConditionFieldDefinitions,
  createWhatsAppCampaignCondition,
  formatWhatsAppCampaignStepDelay,
  getWhatsAppCampaignConditionFieldDefinitionMap,
  normalizeWhatsAppCampaignFlowSteps,
  type WhatsAppCampaignConditionFieldDefinition,
  WHATSAPP_CAMPAIGN_CONDITION_OPERATOR_LABELS,
  WHATSAPP_CAMPAIGN_DELAY_UNIT_LABELS,
} from '../../lib/whatsappCampaignFlow';
import {
  cancelWhatsAppCampaignAtomic,
  createWhatsAppCampaignAtomic,
  createWhatsAppCampaignCsvImport,
  listWhatsAppCampaignCanais,
  previewWhatsAppCampaignAudience,
  recomputeWhatsAppCampaignCounters,
} from '../../lib/whatsappCampaignAdminService';
import {
  deleteWhatsAppCampaignImportFile,
  uploadWhatsAppCampaignImportFile,
} from '../../lib/whatsappCampaignImportService';
import { getAcceptedFileTypesByStepType, uploadWhatsAppCampaignMedia } from '../../lib/whatsappCampaignMediaService';
import {
  analyzeCsvAudience,
  buildCampaignVariableSuggestions,
  canRequeueCampaignTarget,
  collectUnknownCampaignFlowVariableKeys,
  formatCsvSummaryLabel,
  normalizeCampaignAudienceSource,
  normalizeCampaignSourcePayload,
  normalizeWhatsAppCampaignImportStatus,
  normalizeWhatsAppCampaignPacingSettings,
  normalizeCsvHeader,
  normalizePhoneForCampaign,
  parseCampaignCsvText,
  resolveCampaignTemplateText,
  splitIntoBatches,
  isWhatsAppCampaignImportPending,
  isWhatsAppCampaignImportReady,
  type CsvAudienceAnalysis,
  type ExistingCampaignLeadMatch,
  type ParsedCampaignCsv,
  type WhatsAppCampaignPacingSettings,
} from '../../lib/whatsappCampaignUtils';
import { useConfig } from '../../contexts/ConfigContext';
import type {
  WhatsAppCampaignCondition,
  WhatsAppCampaignConditionLogic,
  WhatsAppCampaignConditionOperator,
  WhatsAppCampaignAudienceSource,
  WhatsAppCampaign,
  WhatsAppCampaignFlowStep,
  WhatsAppCampaignFlowStepDelayUnit,
  WhatsAppCampaignFlowStepType,
  WhatsAppCampaignImportStatus,
  WhatsAppCampaignStatus,
  WhatsAppCampaignTarget,
  WhatsAppCampaignTargetStatus,
} from '../../types/whatsappCampaigns';

type CampaignFilters = {
  statusId: string;
  responsavelId: string;
  origemId: string;
  canal: string;
};

type LeadPreviewRow = {
  id: string;
  nome_completo: string;
  telefone: string;
  status_id: string | null;
  responsavel_id: string | null;
  origem_id: string | null;
  canal?: string | null;
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

type FlowNodeData = {
  label: string;
  description: string;
};

type CsvImportState = {
  fileName: string;
  rawText: string;
  parsed: ParsedCampaignCsv | null;
  phoneColumnKey: string;
  nameColumnKey: string;
};

type CsvCrmDefaultsState = {
  origemId: string;
  statusId: string;
  tipoContratacaoId: string;
  responsavelId: string;
  confirmNewLeadDefaults: boolean;
};

type CampaignTargetsFilters = {
  status: string;
  sentState: 'all' | 'sent' | 'not_sent';
  attemptState: 'all' | 'attempted' | 'not_attempted';
  errorSearch: string;
};

type CampaignTargetHistoryRow = WhatsAppCampaignTarget & {
  lead: Pick<LeadPreviewRow, 'nome_completo' | 'telefone'> | null;
};

type SelectOption = {
  id: string;
  label: string;
};

type ConditionGroupOption = {
  value: string;
  label: string;
};

const DEFAULT_FILTERS: CampaignFilters = {
  statusId: '',
  responsavelId: '',
  origemId: '',
  canal: '',
};

const DEFAULT_CSV_IMPORT_STATE: CsvImportState = {
  fileName: '',
  rawText: '',
  parsed: null,
  phoneColumnKey: '',
  nameColumnKey: '',
};

const DEFAULT_CSV_CRM_DEFAULTS: CsvCrmDefaultsState = {
  origemId: '',
  statusId: '',
  tipoContratacaoId: '',
  responsavelId: '',
  confirmNewLeadDefaults: false,
};

const DEFAULT_CAMPAIGN_PACING: WhatsAppCampaignPacingSettings = {
  dailySendLimit: null,
  sendIntervalMinutes: null,
};

const DEFAULT_TARGET_FILTERS: CampaignTargetsFilters = {
  status: '',
  sentState: 'all',
  attemptState: 'all',
  errorSearch: '',
};

const TARGETS_PAGE_SIZE = 25;
const CSV_PHONE_KEY_CANDIDATES = ['telefone', 'phone', 'celular', 'whatsapp', 'numero', 'numero_telefone'];
const CSV_NAME_KEY_CANDIDATES = ['nome', 'nome_completo', 'cliente', 'contato', 'name'];

const STATUS_LABELS: Record<WhatsAppCampaignStatus, string> = {
  draft: 'Rascunho',
  running: 'Em execucao',
  paused: 'Pausada',
  completed: 'Concluida',
  cancelled: 'Cancelada',
};

const STATUS_CLASSNAMES: Record<WhatsAppCampaignStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const IMPORT_STATUS_LABELS: Record<WhatsAppCampaignImportStatus, string> = {
  ready: 'Importacao pronta',
  queued: 'Na fila',
  processing: 'Importando',
  failed: 'Importacao falhou',
  cancelled: 'Importacao cancelada',
};

const IMPORT_STATUS_CLASSNAMES: Record<WhatsAppCampaignImportStatus, string> = {
  ready: 'bg-emerald-100 text-emerald-700',
  queued: 'bg-slate-100 text-slate-700',
  processing: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-700',
};

const FLOW_STEP_LABELS: Record<WhatsAppCampaignFlowStepType, string> = {
  text: 'Mensagem',
  image: 'Imagem',
  video: 'Video',
  audio: 'Áudio',
  document: 'PDF / Documento',
};

const FLOW_STEP_ICONS: Record<WhatsAppCampaignFlowStepType, typeof MessageCircle> = {
  text: MessageCircle,
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
};

const FLOW_STEP_NODE_COLORS: Record<WhatsAppCampaignFlowStepType, string> = {
  text: '#0f766e',
  image: '#0284c7',
  video: '#7c3aed',
  audio: '#4338ca',
  document: '#b45309',
};

const createUniqueStepId = (): string => `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createFlowStep = (type: WhatsAppCampaignFlowStepType = 'text'): WhatsAppCampaignFlowStep => ({
  id: createUniqueStepId(),
  type,
  text: type === 'text' ? '' : undefined,
  mediaUrl: type === 'text' ? undefined : '',
  caption: type === 'text' ? undefined : '',
  filename: type === 'document' ? '' : undefined,
  delayValue: 0,
  delayUnit: 'hours',
  conditions: [],
  conditionLogic: 'all',
});

const CONDITION_GROUP_LABELS: Record<ConditionGroupOption['value'], string> = {
  lead: 'Lead',
  conversation: 'Conversa',
  campaign: 'Campanha',
  payload: 'CSV',
};

const CONDITION_LOGIC_OPTIONS: Array<{ value: WhatsAppCampaignConditionLogic; label: string }> = [
  { value: 'all', label: 'Todas as condicoes' },
  { value: 'any', label: 'Qualquer condicao' },
];

const formatDateTime = (value: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR');
};

const summarizeStep = (step: WhatsAppCampaignFlowStep): string => {
  if (step.type === 'text') {
    const content = (step.text || '').trim();
    return content ? content.slice(0, 64) : 'Mensagem vazia';
  }

  const media = (step.mediaUrl || '').trim();
  if (!media) {
    return 'Arquivo pendente';
  }
  return media.length > 64 ? `${media.slice(0, 61)}...` : media;
};

const normalizeFlowStepType = (value: unknown): WhatsAppCampaignFlowStepType => {
  if (value === 'image' || value === 'video' || value === 'audio' || value === 'document') {
    return value;
  }
  return 'text';
};

const composeFallbackMessage = (steps: WhatsAppCampaignFlowStep[]): string => {
  const firstText = steps.find((step) => step.type === 'text' && step.text?.trim());
  if (firstText?.text?.trim()) {
    return firstText.text.trim();
  }

  const labels = steps.map((step) => FLOW_STEP_LABELS[step.type]);
  return labels.length > 0 ? `Fluxo: ${labels.join(' -> ')}` : 'Fluxo sem mensagem';
};

const buildFlowNodes = (steps: WhatsAppCampaignFlowStep[], selectedStepId: string | null): Node<FlowNodeData>[] => {
  return steps.map((step, index) => {
    const nodeColor = FLOW_STEP_NODE_COLORS[step.type];
    const selected = selectedStepId === step.id;
    const badges: string[] = [];

    if ((step.delayValue ?? 0) > 0) {
      badges.push(`+${formatWhatsAppCampaignStepDelay(step)}`);
    }

    if ((step.conditions?.length ?? 0) > 0) {
      badges.push(`${step.conditions?.length ?? 0} regra(s)`);
    }

    return {
      id: step.id,
      position: {
        x: 80 + index * 250,
        y: 90,
      },
      data: {
        label: badges.length > 0
          ? `${index + 1}. ${FLOW_STEP_LABELS[step.type]} • ${badges.join(' • ')}`
          : `${index + 1}. ${FLOW_STEP_LABELS[step.type]}`,
        description: summarizeStep(step),
      },
      draggable: false,
      selectable: true,
      style: {
        width: 220,
        borderRadius: 14,
        border: `2px solid ${selected ? nodeColor : '#d1d5db'}`,
        background: selected ? `${nodeColor}14` : '#ffffff',
        color: '#0f172a',
        boxShadow: selected ? '0 0 0 3px rgba(13, 148, 136, 0.15)' : '0 1px 2px rgba(15, 23, 42, 0.06)',
        padding: 8,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
};

const buildFlowEdges = (steps: WhatsAppCampaignFlowStep[]): Edge[] => {
  if (steps.length <= 1) {
    return [];
  }

  return steps.slice(0, -1).map((step, index) => ({
    id: `edge-${step.id}-${steps[index + 1].id}`,
    source: step.id,
    target: steps[index + 1].id,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: false,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));
};

const toSortedOptions = (input: Set<string>): string[] =>
  Array.from(input)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));

const isMissingLeadsCanalColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';

  return code === '42703' && message.includes('leads.canal');
};

const isLegacyLeadLabelColumnMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('leads.origem')
    || normalized.includes('leads.responsavel')
    || normalized.includes('leads.status')
    || normalized.includes('leads.tipo_contratacao')
    || normalized.includes('column "origem" of relation "leads"')
    || normalized.includes('column "responsavel" of relation "leads"')
    || normalized.includes('column "status" of relation "leads"')
    || normalized.includes('column "tipo_contratacao" of relation "leads"')
  );
};

const isMissingLegacyLeadLabelColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';

  return code === '42703' && isLegacyLeadLabelColumnMessage(message);
};

const inferCsvColumnKey = (headers: string[], candidates: string[]): string => {
  const normalizedCandidates = candidates.map((candidate) => normalizeCsvHeader(candidate));
  return headers.find((header) => normalizedCandidates.includes(header)) ?? '';
};

const formatAudienceSourceLabel = (value: WhatsAppCampaignAudienceSource): string =>
  value === 'csv' ? 'CSV importado' : 'Leads filtrados';

const formatImportProgressLabel = (campaign: WhatsAppCampaign): string | null => {
  if (campaign.audience_source !== 'csv') {
    return null;
  }

  const totalRows = Math.max(Number(campaign.import_total_rows ?? 0) || 0, 0);
  const processedRows = Math.max(Number(campaign.import_processed_rows ?? 0) || 0, 0);
  const failedRows = Math.max(Number(campaign.import_failed_rows ?? 0) || 0, 0);

  if (totalRows <= 0) {
    return null;
  }

  return `${processedRows}/${totalRows} linhas processadas${failedRows > 0 ? ` - ${failedRows} ignoradas` : ''}`;
};

const formatTargetSourceKindLabel = (value: WhatsAppCampaignTarget['source_kind']): string =>
  value === 'csv_import' ? 'CSV' : 'Lead';

const toIsoFromDateTimeInput = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const slugifyFileName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'campanha';

const escapeCsvCell = (value: unknown): string => {
  const stringValue = String(value ?? '');
  if (/[",;\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const mapCampaignFunctionBackendErrorMessage = (message: string): string | null => {
  const normalized = message.toLowerCase();

  if (normalized.includes('next_step_due_at')) {
    return 'O banco Supabase deste ambiente ainda nao recebeu a migration de agendamento por etapa (`next_step_due_at`). Aplique as migrations mais recentes das campanhas WhatsApp e tente novamente.';
  }

  if (isLegacyLeadLabelColumnMessage(normalized)) {
    return 'O banco Supabase deste ambiente ainda nao recebeu a migration mais recente de compatibilidade das campanhas WhatsApp. Aplique as migrations e tente novamente.';
  }

  if (normalized.includes('leads.canal')) {
    return 'O banco Supabase deste ambiente ainda nao possui a coluna `leads.canal`, exigida por esta campanha. Alinhe as migrations do ambiente e tente novamente.';
  }

  if (normalized.includes('statement timeout') || normalized.includes('canceling statement due to statement timeout')) {
    return 'A criacao da campanha excedeu o tempo limite do banco. Aplique as migrations mais recentes de performance das campanhas WhatsApp e tente novamente.';
  }

  return null;
};

const extractEdgeFunctionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const record = error as {
    message?: unknown;
    context?: {
      clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };
  };

  const response = record.context;
  if (response && typeof response === 'object') {
    const cloned = typeof response.clone === 'function' ? response.clone() : response;

    if (cloned && typeof cloned === 'object' && typeof cloned.json === 'function') {
      try {
        const payload = await cloned.json();
        if (payload && typeof payload === 'object') {
          const payloadRecord = payload as Record<string, unknown>;
          const rawMessage = typeof payloadRecord.error === 'string'
            ? payloadRecord.error
            : typeof payloadRecord.message === 'string'
              ? payloadRecord.message
              : '';

          if (rawMessage.trim()) {
            return mapCampaignFunctionBackendErrorMessage(rawMessage) ?? rawMessage;
          }
        }
      } catch {
        // ignore json parsing error and fall back to text
      }
    }

    if (cloned && typeof cloned === 'object' && typeof cloned.text === 'function') {
      try {
        const rawText = await cloned.text();
        if (rawText.trim()) {
          return mapCampaignFunctionBackendErrorMessage(rawText) ?? rawText.trim();
        }
      } catch {
        // ignore text parsing error and fall back to generic message
      }
    }
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return mapCampaignFunctionBackendErrorMessage(record.message) ?? record.message;
  }

  return fallback;
};

const downloadTextFile = (fileName: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
};

export default function WhatsAppCampaignSettings() {
  const { leadStatuses, leadOrigins, options } = useConfig();

  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);

  const [campaignName, setCampaignName] = useState('');
  const [audienceSource, setAudienceSource] = useState<WhatsAppCampaignAudienceSource>('filters');
  const [scheduledAtInput, setScheduledAtInput] = useState('');
  const [campaignPacing, setCampaignPacing] = useState<WhatsAppCampaignPacingSettings>(DEFAULT_CAMPAIGN_PACING);
  const [filters, setFilters] = useState<CampaignFilters>(DEFAULT_FILTERS);
  const [canalOptions, setCanalOptions] = useState<string[]>([]);
  const [hasCanalColumn, setHasCanalColumn] = useState(true);
  const [csvImport, setCsvImport] = useState<CsvImportState>(DEFAULT_CSV_IMPORT_STATE);
  const [csvAnalysis, setCsvAnalysis] = useState<CsvAudienceAnalysis | null>(null);
  const [csvCrmDefaults, setCsvCrmDefaults] = useState<CsvCrmDefaultsState>(DEFAULT_CSV_CRM_DEFAULTS);

  const [flowSteps, setFlowSteps] = useState<WhatsAppCampaignFlowStep[]>(() => [createFlowStep('text')]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const [previewLeads, setPreviewLeads] = useState<LeadPreviewRow[]>([]);
  const [previewLeadsTotal, setPreviewLeadsTotal] = useState(0);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
  const [processingCampaignId, setProcessingCampaignId] = useState<string | null>(null);
  const [actionCampaignId, setActionCampaignId] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [campaignTargets, setCampaignTargets] = useState<CampaignTargetHistoryRow[]>([]);
  const [campaignTargetsTotalCount, setCampaignTargetsTotalCount] = useState(0);
  const [campaignTargetsPage, setCampaignTargetsPage] = useState(0);
  const [campaignTargetsFilters, setCampaignTargetsFilters] = useState<CampaignTargetsFilters>(DEFAULT_TARGET_FILTERS);
  const [requeueingTargetId, setRequeueingTargetId] = useState<string | null>(null);
  const [requeueingFailures, setRequeueingFailures] = useState(false);
  const [exportingFailures, setExportingFailures] = useState(false);
  const [messageState, setMessageState] = useState<MessageState>(null);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const selectedCampaignPacing = useMemo(
    () => normalizeWhatsAppCampaignPacingSettings(selectedCampaign?.audience_config ?? null),
    [selectedCampaign],
  );

  const selectedStep = useMemo(
    () => flowSteps.find((step) => step.id === selectedStepId) ?? flowSteps[0] ?? null,
    [flowSteps, selectedStepId],
  );

  const hasRunningCampaign = useMemo(
    () => campaigns.some((campaign) => campaign.status === 'running'),
    [campaigns],
  );

  const hasPendingCampaignImports = useMemo(
    () => campaigns.some((campaign) => isWhatsAppCampaignImportPending(campaign.import_status)),
    [campaigns],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () =>
      leadStatuses
        .filter((status) => status.ativo)
        .map((status) => ({ id: status.id, label: status.nome }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [leadStatuses],
  );

  const responsavelOptions = useMemo<SelectOption[]>(
    () =>
      options.lead_responsavel
        .filter((option) => option.ativo)
        .map((option) => ({ id: option.id, label: option.label }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [options.lead_responsavel],
  );

  const origemOptions = useMemo<SelectOption[]>(
    () =>
      leadOrigins
        .filter((origin) => origin.ativo)
        .map((origin) => ({ id: origin.id, label: origin.nome }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [leadOrigins],
  );

  const tipoContratacaoOptions = useMemo<SelectOption[]>(
    () =>
      options.lead_tipo_contratacao
        .filter((option) => option.ativo)
        .map((option) => ({ id: option.id, label: option.label }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [options.lead_tipo_contratacao],
  );

  const statusNameById = useMemo(() => {
    return new Map(statusOptions.map((option) => [option.id, option.label]));
  }, [statusOptions]);

  const responsavelNameById = useMemo(() => {
    return new Map(responsavelOptions.map((option) => [option.id, option.label]));
  }, [responsavelOptions]);

  const origemNameById = useMemo(() => {
    return new Map(origemOptions.map((option) => [option.id, option.label]));
  }, [origemOptions]);

  const tipoContratacaoNameById = useMemo(() => {
    return new Map(tipoContratacaoOptions.map((option) => [option.id, option.label]));
  }, [tipoContratacaoOptions]);

  const defaultStatusOption = useMemo(() => {
    const byPadrao = leadStatuses.find((status) => status.ativo && status.padrao);
    if (byPadrao) {
      return { id: byPadrao.id, label: byPadrao.nome };
    }

    const novoStatus = leadStatuses.find((status) => status.ativo && status.nome.toLowerCase() === 'novo');
    if (novoStatus) {
      return { id: novoStatus.id, label: novoStatus.nome };
    }

    return statusOptions[0] ?? null;
  }, [leadStatuses, statusOptions]);

  const defaultOriginOption = useMemo(() => {
    const massOrigin = origemOptions.find((option) => option.label.toLowerCase() === 'disparo em massa');
    return massOrigin ?? origemOptions[0] ?? null;
  }, [origemOptions]);

  const campaignVariableSuggestions = useMemo(
    () => buildCampaignVariableSuggestions(audienceSource === 'csv' ? csvImport.parsed?.normalizedHeaders ?? [] : []),
    [audienceSource, csvImport.parsed],
  );

  const campaignConditionFieldDefinitions = useMemo<WhatsAppCampaignConditionFieldDefinition[]>(
    () =>
      buildWhatsAppCampaignConditionFieldDefinitions({
        statusOptions: statusOptions.map((option) => ({ value: option.label, label: option.label })),
        origemOptions: origemOptions.map((option) => ({ value: option.label, label: option.label })),
        responsavelOptions: responsavelOptions.map((option) => ({ value: option.label, label: option.label })),
        canalOptions,
        payloadKeys: audienceSource === 'csv' ? csvImport.parsed?.normalizedHeaders ?? [] : [],
      }),
    [audienceSource, canalOptions, csvImport.parsed, origemOptions, responsavelOptions, statusOptions],
  );

  const campaignConditionFieldDefinitionMap = useMemo(
    () => getWhatsAppCampaignConditionFieldDefinitionMap(campaignConditionFieldDefinitions),
    [campaignConditionFieldDefinitions],
  );

  const allowedVariableKeys = useMemo(
    () => campaignVariableSuggestions.map((suggestion) => suggestion.key),
    [campaignVariableSuggestions],
  );

  const unknownFlowVariables = useMemo(
    () => collectUnknownCampaignFlowVariableKeys(flowSteps, allowedVariableKeys),
    [allowedVariableKeys, flowSteps],
  );

  const flowNodes = useMemo<Node<FlowNodeData>[]>(() => buildFlowNodes(flowSteps, selectedStep?.id ?? null), [flowSteps, selectedStep?.id]);
  const flowEdges = useMemo<Edge[]>(() => buildFlowEdges(flowSteps), [flowSteps]);

  const loadCampaigns = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingCampaigns(true);
    }

    try {
      const rows = await fetchAllPages<WhatsAppCampaign>(async (from, to) => {
        const response = await supabase
          .from('whatsapp_campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        return { data: response.data as WhatsAppCampaign[] | null, error: response.error };
      }, 200);

      const nextCampaigns = rows.map((campaign) => ({
        ...campaign,
        import_status: normalizeWhatsAppCampaignImportStatus((campaign as WhatsAppCampaign & { import_status?: unknown }).import_status),
        audience_source: normalizeCampaignAudienceSource((campaign as WhatsAppCampaign & { audience_source?: unknown }).audience_source),
        audience_config:
          (campaign as WhatsAppCampaign & { audience_config?: Record<string, unknown> | null }).audience_config ?? {},
        flow_steps: normalizeWhatsAppCampaignFlowSteps(
          (campaign as WhatsAppCampaign & { flow_steps?: unknown }).flow_steps,
          campaign.message,
        ),
      }));

      setCampaigns(nextCampaigns);
      setSelectedCampaignId((current) => {
        if (current && nextCampaigns.some((campaign) => campaign.id === current)) {
          return current;
        }
        return nextCampaigns[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Erro ao carregar campanhas do WhatsApp:', error);
      setMessageState({ type: 'error', text: 'Não foi possível carregar as campanhas.' });
    } finally {
      if (!silent) {
        setLoadingCampaigns(false);
      }
    }
  }, []);

  const loadCanalOptions = useCallback(async () => {
    setLoadingFilters(true);
    try {
      setHasCanalColumn(true);
      setCanalOptions(toSortedOptions(new Set(await listWhatsAppCampaignCanais())));
    } catch (error) {
      if (isMissingLeadsCanalColumnError(error)) {
        setHasCanalColumn(false);
        setCanalOptions([]);
        setFilters((current) => ({ ...current, canal: '' }));
        return;
      }

      console.error('Erro ao carregar canais para filtro de campanha:', error);
      setMessageState({ type: 'error', text: 'Não foi possível carregar os canais de leads.' });
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  const recomputeCampaignCounters = useCallback(async (campaignId: string) => {
    await recomputeWhatsAppCampaignCounters(campaignId);
  }, []);

  useEffect(() => {
    void loadCampaigns();
    void loadCanalOptions();
  }, [loadCampaigns, loadCanalOptions]);

  useEffect(() => {
    if (!selectedStepId && flowSteps[0]) {
      setSelectedStepId(flowSteps[0].id);
    }
  }, [flowSteps, selectedStepId]);

  useEffect(() => {
    if (!hasRunningCampaign && !hasPendingCampaignImports) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadCampaigns(true);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasPendingCampaignImports, hasRunningCampaign, loadCampaigns]);

  useEffect(() => {
    setCsvCrmDefaults((current) => ({
      ...current,
      origemId: current.origemId || defaultOriginOption?.id || '',
      statusId: current.statusId || defaultStatusOption?.id || '',
    }));
  }, [defaultOriginOption, defaultStatusOption]);

  useEffect(() => {
    setCampaignTargetsPage(0);
  }, [selectedCampaignId, campaignTargetsFilters.status, campaignTargetsFilters.sentState, campaignTargetsFilters.attemptState, campaignTargetsFilters.errorSearch]);

  useEffect(() => {
    setPreviewLeads([]);
    setPreviewLeadsTotal(0);
    setCsvAnalysis(null);
  }, [
    audienceSource,
    filters.statusId,
    filters.responsavelId,
    filters.origemId,
    filters.canal,
    csvImport.rawText,
    csvImport.phoneColumnKey,
    csvImport.nameColumnKey,
  ]);

  const addFlowStep = (type: WhatsAppCampaignFlowStepType) => {
    const newStep = createFlowStep(type);
    setFlowSteps((current) => [...current, { ...newStep, order: current.length }]);
    setSelectedStepId(newStep.id);
  };

  const addConditionToSelectedStep = (preferredField?: string) => {
    if (!selectedStep) {
      return;
    }

    const nextCondition = createWhatsAppCampaignCondition(campaignConditionFieldDefinitions, preferredField);
    updateSelectedStep({
      conditions: [...(selectedStep.conditions ?? []), nextCondition],
      conditionLogic: selectedStep.conditionLogic ?? 'all',
    });
  };

  const updateSelectedStepCondition = (conditionId: string, updates: Partial<WhatsAppCampaignCondition>) => {
    if (!selectedStep) {
      return;
    }

    updateSelectedStep({
      conditions: (selectedStep.conditions ?? []).map((condition) =>
        condition.id === conditionId
          ? {
              ...condition,
              ...updates,
            }
          : condition,
      ),
    });
  };

  const removeSelectedStepCondition = (conditionId: string) => {
    if (!selectedStep) {
      return;
    }

    updateSelectedStep({
      conditions: (selectedStep.conditions ?? []).filter((condition) => condition.id !== conditionId),
    });
  };

  const updateSelectedStep = (updates: Partial<WhatsAppCampaignFlowStep>) => {
    if (!selectedStep) {
      return;
    }

    setFlowSteps((current) =>
      current.map((step) => {
        if (step.id !== selectedStep.id) {
          return step;
        }

        const nextType = normalizeFlowStepType(updates.type ?? step.type);
        const nextStep: WhatsAppCampaignFlowStep = {
          ...step,
          ...updates,
          type: nextType,
        };

        if (nextType === 'text') {
          nextStep.mediaUrl = undefined;
          nextStep.caption = undefined;
          nextStep.filename = undefined;
        } else {
          if (typeof nextStep.mediaUrl !== 'string') {
            nextStep.mediaUrl = '';
          }
          if (typeof nextStep.caption !== 'string') {
            nextStep.caption = '';
          }
          if (nextType === 'document') {
            if (typeof nextStep.filename !== 'string') {
              nextStep.filename = '';
            }
          } else {
            nextStep.filename = undefined;
          }

          nextStep.text = undefined;
        }

        return nextStep;
      }),
    );
  };

  const removeSelectedStep = () => {
    if (!selectedStep) {
      return;
    }

    setFlowSteps((current) => {
      if (current.length <= 1) {
        const replacement = createFlowStep('text');
        setSelectedStepId(replacement.id);
        return [replacement];
      }

      const remaining = current.filter((step) => step.id !== selectedStep.id).map((step, index) => ({ ...step, order: index }));
      setSelectedStepId(remaining[0]?.id ?? null);
      return remaining;
    });
  };

  const handleUploadFileToSelectedStep = async (file: File) => {
    if (!selectedStep || selectedStep.type === 'text') {
      return;
    }

    setUploadingStepId(selectedStep.id);
    setMessageState(null);

    try {
      const result = await uploadWhatsAppCampaignMedia(selectedStep.type, file);

      if (!result.success || !result.url) {
        setMessageState({
          type: 'error',
          text: result.error || 'Não foi possível enviar o arquivo da etapa.',
        });
        return;
      }

      updateSelectedStep({
        mediaUrl: result.url,
        filename: selectedStep.type === 'document' ? result.filename || selectedStep.filename || '' : undefined,
      });

      setMessageState({ type: 'success', text: 'Arquivo enviado com sucesso para a etapa.' });
    } catch (error) {
      console.error('Erro ao enviar arquivo da etapa da campanha:', error);
      setMessageState({
        type: 'error',
        text: error instanceof Error && error.message.trim()
          ? error.message
          : 'Não foi possível enviar o arquivo da etapa.',
      });
    } finally {
      setUploadingStepId(null);
    }
  };

  const validateFlowSteps = (steps: WhatsAppCampaignFlowStep[]): string | null => {
    if (steps.length === 0) {
      return 'Adicione ao menos uma etapa no fluxo da campanha.';
    }

    for (const step of steps) {
      const delayValue = Number(step.delayValue ?? 0);
      if (!Number.isFinite(delayValue) || delayValue < 0) {
        return 'Toda etapa precisa ter um intervalo valido maior ou igual a zero.';
      }

      if (step.type === 'text') {
        if (!(step.text || '').trim()) {
          return 'Toda etapa de mensagem precisa ter texto preenchido.';
        }
      } else if (!(step.mediaUrl || '').trim()) {
        return `A etapa ${FLOW_STEP_LABELS[step.type]} precisa de arquivo enviado.`;
      }

      for (const condition of step.conditions ?? []) {
        const definition = campaignConditionFieldDefinitionMap.get(condition.field);
        if (!definition) {
          return 'Existe uma condicao com campo nao suportado nesta etapa.';
        }

        if (!definition.operators?.includes(condition.operator)) {
          return `A condicao "${definition.label}" usa um operador nao suportado.`;
        }

        if (!condition.value.trim()) {
          return `Preencha o valor da condicao "${definition.label}".`;
        }
      }
    }

    return null;
  };

  const buildAudienceFilterSnapshot = useCallback(
    () => ({
      status_id: filters.statusId || null,
      status_label: statusNameById.get(filters.statusId) ?? null,
      responsavel_id: filters.responsavelId || null,
      responsavel_label: responsavelNameById.get(filters.responsavelId) ?? null,
      origem_id: filters.origemId || null,
      origem_label: origemNameById.get(filters.origemId) ?? null,
      canal: hasCanalColumn ? filters.canal || null : null,
    }),
    [filters, hasCanalColumn, origemNameById, responsavelNameById, statusNameById],
  );

  const fetchExistingLeadsByPhones = useCallback(async (normalizedPhones: string[]): Promise<ExistingCampaignLeadMatch[]> => {
    const candidatePhones = new Set<string>();

    normalizedPhones.forEach((phone) => {
      if (!phone) {
        return;
      }

      candidatePhones.add(phone);

      if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
        candidatePhones.add(phone.slice(2));
      }
    });

    const batches = splitIntoBatches(Array.from(candidatePhones), 200);

    const responses = await Promise.all(
      batches
        .filter((batch) => batch.length > 0)
        .map(async (batch) => {
          const { data, error } = await supabase
            .from('leads')
            .select('id, nome_completo, telefone, email, status_id, origem_id, cidade, responsavel_id, canal')
            .in('telefone', batch);

          if (error) {
            throw error;
          }

          return (data ?? []) as ExistingCampaignLeadMatch[];
        }),
    );

    return responses.flat();
  }, []);

  const resetBuilderState = useCallback(() => {
    const firstStep = createFlowStep('text');
    setCampaignName('');
    setAudienceSource('filters');
    setScheduledAtInput('');
    setCampaignPacing(DEFAULT_CAMPAIGN_PACING);
    setFilters(DEFAULT_FILTERS);
    setCsvImport(DEFAULT_CSV_IMPORT_STATE);
    setCsvAnalysis(null);
    setCsvCrmDefaults((current) => ({
      ...DEFAULT_CSV_CRM_DEFAULTS,
      origemId: current.origemId,
      statusId: current.statusId,
    }));
    setPreviewLeads([]);
    setPreviewLeadsTotal(0);
    setFlowSteps([firstStep]);
    setSelectedStepId(firstStep.id);
  }, []);

  const handleCsvFileUpload = useCallback(async (file: File) => {
    setMessageState(null);

    try {
      const rawText = await file.text();
      const parsed = parseCampaignCsvText(rawText);

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setMessageState({ type: 'error', text: 'O CSV precisa ter cabecalho e ao menos uma linha de dados.' });
        return;
      }

      const inferredPhoneColumnKey = inferCsvColumnKey(parsed.normalizedHeaders, CSV_PHONE_KEY_CANDIDATES);
      const inferredNameColumnKey = inferCsvColumnKey(parsed.normalizedHeaders, CSV_NAME_KEY_CANDIDATES);

      setCsvImport({
        fileName: file.name,
        rawText,
        parsed,
        phoneColumnKey: inferredPhoneColumnKey,
        nameColumnKey: inferredNameColumnKey,
      });

      setMessageState({
        type: 'success',
        text: `CSV carregado: ${file.name} com ${parsed.rows.length} linha(s) e delimitador "${parsed.delimiter}".`,
      });
    } catch (error) {
      console.error('Erro ao carregar CSV da campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel ler o arquivo CSV.' });
    }
  }, []);

  const handlePreviewAudience = async () => {
    setLoadingPreview(true);
    setMessageState(null);

    try {
      if (audienceSource === 'csv') {
        if (!csvImport.parsed || csvImport.parsed.rows.length === 0) {
          setMessageState({ type: 'error', text: 'Importe um CSV antes de gerar o preview.' });
          return;
        }

        if (!csvImport.phoneColumnKey) {
          setMessageState({ type: 'error', text: 'Mapeie a coluna de telefone para continuar.' });
          return;
        }

        const normalizedPhones = csvImport.parsed.rows
          .map((row) => normalizePhoneForCampaign(row.values[csvImport.phoneColumnKey]))
          .filter(Boolean);

        const existingLeads = await fetchExistingLeadsByPhones(normalizedPhones);
        const analysis = analyzeCsvAudience({
          rows: csvImport.parsed.rows,
          phoneColumnKey: csvImport.phoneColumnKey,
          nameColumnKey: csvImport.nameColumnKey || null,
          existingLeads,
        });

        setCsvAnalysis(analysis);
        setPreviewLeads([]);
        setPreviewLeadsTotal(0);
        return;
      }

      const preview = await previewWhatsAppCampaignAudience(buildAudienceFilterSnapshot(), 80);
      setPreviewLeads(preview.sampleTargets as LeadPreviewRow[]);
      setPreviewLeadsTotal(preview.totalTargets);
      setCsvAnalysis(null);
    } catch (error) {
      console.error('Erro ao gerar preview de publico da campanha:', error);
      if (audienceSource === 'filters') {
        setPreviewLeads([]);
        setPreviewLeadsTotal(0);
      }
      setMessageState({
        type: 'error',
        text: isMissingLegacyLeadLabelColumnError(error)
          ? 'O banco Supabase deste ambiente ainda nao recebeu a migration mais recente das campanhas WhatsApp. Aplique as migrations e tente novamente.'
          : 'Não foi possível gerar o preview do público.',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreateCampaign = async () => {
    const validationError = validateFlowSteps(flowSteps);
    if (validationError) {
      setMessageState({ type: 'error', text: validationError });
      return;
    }

    if (unknownFlowVariables.length > 0) {
      setMessageState({
        type: 'error',
        text: `Existem variaveis desconhecidas no fluxo: ${unknownFlowVariables.map((value) => `{{${value}}}`).join(', ')}`,
      });
      return;
    }

    if (audienceSource === 'csv') {
      if (!csvImport.parsed || !csvAnalysis) {
        setMessageState({ type: 'error', text: 'Gere o preview do CSV antes de criar a campanha.' });
        return;
      }

      if (csvAnalysis.validItems.length === 0) {
        setMessageState({ type: 'error', text: 'Nenhuma linha valida encontrada no CSV.' });
        return;
      }

      if (csvAnalysis.summary.newLeadRows > 0) {
        const missingDefaults = [
          { value: csvCrmDefaults.origemId, label: 'origem' },
          { value: csvCrmDefaults.statusId, label: 'status' },
          { value: csvCrmDefaults.tipoContratacaoId, label: 'tipo de contratacao' },
          { value: csvCrmDefaults.responsavelId, label: 'responsavel' },
        ].find((item) => !item.value);

        if (missingDefaults) {
          setMessageState({
            type: 'error',
            text: `Defina o default de ${missingDefaults.label} para criar novos leads a partir do CSV.`,
          });
          return;
        }

        if (!csvCrmDefaults.confirmNewLeadDefaults) {
          setMessageState({
            type: 'error',
            text: 'Confirme os defaults do CRM antes de criar novos leads pelo CSV.',
          });
          return;
        }
      }
    }

    if (audienceSource === 'filters' && previewLeadsTotal === 0) {
      setMessageState({ type: 'error', text: 'Gere o preview de publico antes de criar a campanha.' });
      return;
    }

    setCreatingCampaign(true);
    setMessageState(null);

    try {
      const campaignTitle = campaignName.trim() || `Campanha ${new Date().toLocaleDateString('pt-BR')}`;
      const normalizedSteps = flowSteps.map((step, index) => ({ ...step, order: index }));
      const scheduledAtIso = toIsoFromDateTimeInput(scheduledAtInput);
      const audienceFilterSnapshot = buildAudienceFilterSnapshot();
      const pacingConfig = {
        daily_send_limit: campaignPacing.dailySendLimit,
        send_interval_minutes: campaignPacing.sendIntervalMinutes,
      };

      if (audienceSource === 'csv' && csvImport.parsed && csvAnalysis) {
        const origemLabel = origemNameById.get(csvCrmDefaults.origemId) ?? '';
        const statusLabel = statusNameById.get(csvCrmDefaults.statusId) ?? '';
        const tipoContratacaoLabel = tipoContratacaoNameById.get(csvCrmDefaults.tipoContratacaoId) ?? '';
        const responsavelLabel = responsavelNameById.get(csvCrmDefaults.responsavelId) ?? '';
        let uploadedImportPath: string | null = null;
        let createdCampaign: WhatsAppCampaign;

        try {
          const uploadedImport = await uploadWhatsAppCampaignImportFile(
            csvImport.fileName || `${slugifyFileName(campaignTitle)}.csv`,
            csvImport.rawText,
          );
          uploadedImportPath = uploadedImport.path;

          createdCampaign = await createWhatsAppCampaignCsvImport({
            name: campaignTitle,
            message: composeFallbackMessage(normalizedSteps),
            flowSteps: normalizedSteps,
            audienceConfig: {
              csv_file_name: csvImport.fileName,
              csv_delimiter: csvImport.parsed.delimiter,
              csv_headers: csvImport.parsed.headers,
              csv_normalized_headers: csvImport.parsed.normalizedHeaders,
              preview_valid_target_count: csvAnalysis.validItems.length,
              mapping: {
                phone_column_key: csvImport.phoneColumnKey,
                name_column_key: csvImport.nameColumnKey || null,
              },
              crm_defaults: {
                origem_id: csvCrmDefaults.origemId || null,
                origem_label: origemLabel || null,
                status_id: csvCrmDefaults.statusId || null,
                status_label: statusLabel || null,
                tipo_contratacao_id: csvCrmDefaults.tipoContratacaoId || null,
                tipo_contratacao_label: tipoContratacaoLabel || null,
                responsavel_id: csvCrmDefaults.responsavelId || null,
                responsavel_label: responsavelLabel || null,
              },
              pacing: pacingConfig,
              summary: csvAnalysis.summary,
            },
            scheduledAt: scheduledAtIso,
            storageBucket: uploadedImport.bucket,
            storagePath: uploadedImport.path,
            fileName: csvImport.fileName,
            delimiter: csvImport.parsed.delimiter,
            mapping: {
              phoneColumnKey: csvImport.phoneColumnKey,
              nameColumnKey: csvImport.nameColumnKey || null,
            },
            crmDefaults: {
              origem_id: csvCrmDefaults.origemId || null,
              origem_label: origemLabel || null,
              status_id: csvCrmDefaults.statusId || null,
              status_label: statusLabel || null,
              tipo_contratacao_id: csvCrmDefaults.tipoContratacaoId || null,
              tipo_contratacao_label: tipoContratacaoLabel || null,
              responsavel_id: csvCrmDefaults.responsavelId || null,
              responsavel_label: responsavelLabel || null,
            },
            totalRows: csvImport.parsed.rows.length,
          });
        } catch (error) {
          if (uploadedImportPath) {
            try {
              await deleteWhatsAppCampaignImportFile(uploadedImportPath);
            } catch (cleanupError) {
              console.warn('Falha ao limpar CSV de campanha apos erro na criacao:', cleanupError);
            }
          }

          throw error;
        }

        await loadCampaigns();
        setSelectedCampaignId(createdCampaign.id);
        resetBuilderState();
        setShowCreateCampaignModal(false);
        setMessageState({
          type: 'success',
          text: 'Campanha CSV criada com sucesso. A importacao foi enfileirada e os alvos serao materializados em lotes.',
        });
        return;
      }

      const createdCampaign = await createWhatsAppCampaignAtomic({
        name: campaignTitle,
        message: composeFallbackMessage(normalizedSteps),
        flowSteps: normalizedSteps,
        audienceSource: 'filters',
        audienceFilter: audienceFilterSnapshot,
        audienceConfig: {
          source: 'filters',
          preview_count: previewLeadsTotal,
          filters: audienceFilterSnapshot,
          pacing: pacingConfig,
        },
        scheduledAt: scheduledAtIso,
      });

      await loadCampaigns();

      setSelectedCampaignId(createdCampaign.id);
      resetBuilderState();
      setShowCreateCampaignModal(false);
      setMessageState({
        type: 'success',
        text: `Campanha criada com sucesso com ${createdCampaign.total_targets} alvo(s).`,
      });
    } catch (error) {
      console.error('Erro ao criar campanha do WhatsApp:', error);
      setMessageState({
        type: 'error',
        text: isMissingLegacyLeadLabelColumnError(error)
          ? 'O banco Supabase deste ambiente ainda nao recebeu a migration mais recente das campanhas WhatsApp. Aplique as migrations e tente novamente.'
          : getErrorMessage(error, 'Nao foi possivel criar a campanha.'),
      });
    } finally {
      setCreatingCampaign(false);
    }
  };

  const updateCampaignStatus = async (
    campaign: WhatsAppCampaign,
    status: WhatsAppCampaignStatus,
    options?: { clearCompletedAt?: boolean; setCompletedAt?: boolean },
  ) => {
    if (status === 'running' && !isWhatsAppCampaignImportReady(campaign)) {
      setMessageState({
        type: 'error',
        text: 'A campanha ainda esta importando o CSV. Aguarde a importacao terminar antes de iniciar os envios.',
      });
      return;
    }

    setActionCampaignId(campaign.id);
    setMessageState(null);

    try {
      const nowIso = new Date().toISOString();
      const payload: Record<string, unknown> = { status };

      if (status === 'running') {
        payload.started_at = campaign.started_at ?? nowIso;
        payload.last_error = null;
        payload.scheduled_at = campaign.scheduled_at;
      }

      if (options?.clearCompletedAt) {
        payload.completed_at = null;
      }

      if (options?.setCompletedAt) {
        payload.completed_at = nowIso;
      }

      const { error } = await supabase
        .from('whatsapp_campaigns')
        .update(payload)
        .eq('id', campaign.id);

      if (error) {
        throw error;
      }

      await loadCampaigns();
      if (selectedCampaignId === campaign.id) {
        await loadCampaignTargets();
      }
    } catch (error) {
      console.error('Erro ao atualizar status da campanha:', error);
      setMessageState({ type: 'error', text: 'Não foi possível atualizar o status da campanha.' });
    } finally {
      setActionCampaignId(null);
    }
  };

  const handleCancelCampaign = async (campaign: WhatsAppCampaign) => {
    setActionCampaignId(campaign.id);
    setMessageState(null);

    try {
      await cancelWhatsAppCampaignAtomic(campaign.id, 'Campanha cancelada manualmente.');
      await loadCampaigns();
      if (selectedCampaignId === campaign.id) {
        await loadCampaignTargets();
      }

      setMessageState({ type: 'success', text: 'Campanha cancelada com sucesso.' });
    } catch (error) {
      console.error('Erro ao cancelar campanha:', error);
      setMessageState({ type: 'error', text: getErrorMessage(error, 'Nao foi possivel cancelar a campanha.') });
    } finally {
      setActionCampaignId(null);
    }
  };

  const handleProcessNow = async (campaignId?: string) => {
    setProcessingCampaignId(campaignId || 'all');
    setMessageState(null);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-broadcast', {
        body: {
          action: 'process',
          campaignId: campaignId || null,
          limit: 50,
          source: 'manual-ui',
        },
      });

      if (error) {
        throw error;
      }

      const responseData = (data ?? null) as { error?: string; processed?: number } | null;
      if (responseData?.error) {
        throw new Error(responseData.error);
      }

      await loadCampaigns();
      if (selectedCampaignId) {
        await loadCampaignTargets();
      }

      const processedCount = typeof responseData?.processed === 'number' ? responseData.processed : 0;
      setMessageState({
        type: 'success',
        text:
          processedCount > 0
            ? `Processamento concluido: ${processedCount} alvo(s) processado(s).`
            : 'Processamento concluido sem novos envios.',
      });
    } catch (error) {
      console.error('Erro ao processar campanhas manualmente:', error);
      setMessageState({
        type: 'error',
        text: await extractEdgeFunctionErrorMessage(error, 'Não foi possível processar os envios agora.'),
      });
    } finally {
      setProcessingCampaignId(null);
    }
  };

  const loadCampaignTargets = useCallback(async () => {
    if (!selectedCampaignId) {
      setCampaignTargets([]);
      setCampaignTargetsTotalCount(0);
      return;
    }

    setLoadingTargets(true);

      try {
        let query = supabase
          .from('whatsapp_campaign_targets')
          .select(
          'id, campaign_id, lead_id, phone, raw_phone, display_name, chat_id, source_kind, source_payload, status, attempts, error_message, sent_at, last_attempt_at, processing_started_at, processing_expires_at, last_completed_step_index, last_completed_step_id, last_sent_step_at, next_step_due_at, created_at, updated_at, lead:leads(nome_completo, telefone)',
           { count: 'exact' },
          )
          .eq('campaign_id', selectedCampaignId)
        .order('created_at', { ascending: false });

      if (campaignTargetsFilters.status) {
        query = query.eq('status', campaignTargetsFilters.status as WhatsAppCampaignTargetStatus);
      }

      if (campaignTargetsFilters.sentState === 'sent') {
        query = query.not('sent_at', 'is', null);
      } else if (campaignTargetsFilters.sentState === 'not_sent') {
        query = query.is('sent_at', null);
      }

      if (campaignTargetsFilters.attemptState === 'attempted') {
        query = query.not('last_attempt_at', 'is', null);
      } else if (campaignTargetsFilters.attemptState === 'not_attempted') {
        query = query.is('last_attempt_at', null);
      }

      if (campaignTargetsFilters.errorSearch.trim()) {
        query = query.ilike('error_message', `%${campaignTargetsFilters.errorSearch.trim()}%`);
      }

      const from = campaignTargetsPage * TARGETS_PAGE_SIZE;
      const to = from + TARGETS_PAGE_SIZE - 1;
      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw error;
      }

      const rows = ((data ?? []) as unknown as Array<
        Omit<CampaignTargetHistoryRow, 'lead'> & {
          lead?: Array<Pick<LeadPreviewRow, 'nome_completo' | 'telefone'>> | Pick<LeadPreviewRow, 'nome_completo' | 'telefone'> | null;
        }
      >).map((item) => ({
        ...item,
        source_payload: normalizeCampaignSourcePayload(item.source_payload),
        lead: Array.isArray(item.lead) ? item.lead[0] ?? null : item.lead ?? null,
      }));

      setCampaignTargets(rows);
      setCampaignTargetsTotalCount(count ?? 0);
    } catch (error) {
      console.error('Erro ao carregar alvos da campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel carregar o historico de alvos.' });
    } finally {
      setLoadingTargets(false);
    }
  }, [campaignTargetsFilters, campaignTargetsPage, selectedCampaignId]);

  useEffect(() => {
    void loadCampaignTargets();
  }, [loadCampaignTargets]);

  const ensureCampaignRunningForRetry = useCallback(async (campaign: WhatsAppCampaign) => {
    if (campaign.status === 'cancelled' || campaign.status === 'running') {
      return;
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('whatsapp_campaigns')
      .update({
        status: 'running',
        started_at: campaign.started_at ?? nowIso,
        completed_at: null,
        last_error: null,
      })
      .eq('id', campaign.id);

    if (error) {
      throw error;
    }
  }, []);

  const handleRequeueFailedTargets = async () => {
    if (!selectedCampaign) {
      return;
    }

    if (selectedCampaign.status === 'cancelled') {
      setMessageState({ type: 'error', text: 'Campanhas canceladas nao podem ser reenfileiradas.' });
      return;
    }

    setRequeueingFailures(true);
    setMessageState(null);

    try {
      await ensureCampaignRunningForRetry(selectedCampaign);

      const { error } = await supabase
        .from('whatsapp_campaign_targets')
        .update({
          status: 'pending',
          error_message: null,
          next_step_due_at: null,
          processing_started_at: null,
          processing_expires_at: null,
        })
        .eq('campaign_id', selectedCampaign.id)
        .eq('status', 'failed');

      if (error) {
        throw error;
      }

      await recomputeCampaignCounters(selectedCampaign.id);
      await loadCampaigns(true);
      await loadCampaignTargets();
      setMessageState({ type: 'success', text: 'Falhas reenfileiradas com sucesso.' });
    } catch (error) {
      console.error('Erro ao reenfileirar falhas da campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel reenfileirar as falhas.' });
    } finally {
      setRequeueingFailures(false);
    }
  };

  const handleRequeueSingleTarget = async (target: CampaignTargetHistoryRow) => {
    if (!selectedCampaign) {
      return;
    }

    if (selectedCampaign.status === 'cancelled') {
      setMessageState({ type: 'error', text: 'Campanhas canceladas nao podem ser reenfileiradas.' });
      return;
    }

    setRequeueingTargetId(target.id);
    setMessageState(null);

    try {
      await ensureCampaignRunningForRetry(selectedCampaign);

      const { error } = await supabase
        .from('whatsapp_campaign_targets')
        .update({
          status: 'pending',
          error_message: null,
          next_step_due_at: null,
          processing_started_at: null,
          processing_expires_at: null,
        })
        .eq('id', target.id);

      if (error) {
        throw error;
      }

      await recomputeCampaignCounters(selectedCampaign.id);
      await loadCampaigns(true);
      await loadCampaignTargets();
      setMessageState({ type: 'success', text: 'Alvo reenfileirado com sucesso.' });
    } catch (error) {
      console.error('Erro ao reenfileirar alvo:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel reenfileirar este alvo.' });
    } finally {
      setRequeueingTargetId(null);
    }
  };

  const handleExportFailedTargets = async () => {
    if (!selectedCampaign) {
      return;
    }

    setExportingFailures(true);
    setMessageState(null);

    try {
      const { data, error } = await supabase
        .from('whatsapp_campaign_targets')
        .select('display_name, raw_phone, phone, source_kind, source_payload, status, error_message, last_attempt_at, sent_at')
        .eq('campaign_id', selectedCampaign.id)
        .eq('status', 'failed')
        .order('last_attempt_at', { ascending: false });

      if (error) {
        throw error;
      }

      const rows = ((data ?? []) as Array<Pick<
        CampaignTargetHistoryRow,
        'display_name' | 'raw_phone' | 'phone' | 'source_kind' | 'source_payload' | 'status' | 'error_message' | 'last_attempt_at' | 'sent_at'
      >>).map((item) => ({
        ...item,
        source_payload: normalizeCampaignSourcePayload(item.source_payload),
      }));

      if (rows.length === 0) {
        setMessageState({ type: 'error', text: 'Nao ha falhas para exportar nesta campanha.' });
        return;
      }

      const payloadKeys = Array.from(
        new Set(rows.flatMap((row) => Object.keys(row.source_payload ?? {}))),
      ).sort((left, right) => left.localeCompare(right, 'pt-BR'));

      const headers = ['display_name', 'raw_phone', 'phone', ...payloadKeys, 'erro', 'status', 'ultima_tentativa', 'enviado_em', 'origem_alvo'];
      const lines = rows.map((row) =>
        [
          row.display_name ?? '',
          row.raw_phone ?? '',
          row.phone,
          ...payloadKeys.map((key) => row.source_payload?.[key] ?? ''),
          row.error_message ?? '',
          row.status,
          row.last_attempt_at ?? '',
          row.sent_at ?? '',
          formatTargetSourceKindLabel(row.source_kind),
        ]
          .map(escapeCsvCell)
          .join(';'),
      );

      downloadTextFile(
        `${slugifyFileName(selectedCampaign.name)}-falhas.csv`,
        `\uFEFF${headers.map(escapeCsvCell).join(';')}\n${lines.join('\n')}`,
        'text/csv;charset=utf-8;',
      );
      setMessageState({ type: 'success', text: 'CSV de falhas exportado com sucesso.' });
    } catch (error) {
      console.error('Erro ao exportar falhas da campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel exportar as falhas.' });
    } finally {
      setExportingFailures(false);
    }
  };

  const firstRenderableTemplate = useMemo(
    () =>
      flowSteps.find((step) => step.type === 'text' && step.text?.trim())?.text ??
      flowSteps.find((step) => step.caption?.trim())?.caption ??
      '',
    [flowSteps],
  );

  const previewSampleMessage = useMemo(() => {
    if (!firstRenderableTemplate) {
      return '';
    }

    if (audienceSource === 'csv') {
      const sampleItem = csvAnalysis?.validItems[0];
      if (!sampleItem) {
        return '';
      }

      return resolveCampaignTemplateText(firstRenderableTemplate, {
        lead: sampleItem.existingLead ?? null,
        payload: sampleItem.payload,
      });
    }

    const sampleLead = previewLeads[0];
    if (!sampleLead) {
      return '';
    }

    return resolveCampaignTemplateText(firstRenderableTemplate, {
      payload: {
        nome: sampleLead.nome_completo,
        telefone: sampleLead.telefone,
        status: statusNameById.get(sampleLead.status_id || '') ?? '',
        origem: origemNameById.get(sampleLead.origem_id || '') ?? '',
        responsavel: responsavelNameById.get(sampleLead.responsavel_id || '') ?? '',
      },
    });
  }, [audienceSource, csvAnalysis, firstRenderableTemplate, origemNameById, previewLeads, responsavelNameById, statusNameById]);

  const campaignTargetsPageCount = Math.max(1, Math.ceil(campaignTargetsTotalCount / TARGETS_PAGE_SIZE));

  return (
    <div className="space-y-5">
      {!showCreateCampaignModal && messageState && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            messageState.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{messageState.text}</span>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Campanhas do WhatsApp</h3>
            <p className="text-xs text-slate-500">
              Crie campanhas em uma janela dedicada e acompanhe a fila sem poluir a tela principal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                resetBuilderState();
                setMessageState(null);
                setShowCreateCampaignModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova campanha
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleProcessNow();
              }}
              loading={processingCampaignId === 'all'}
            >
              <RefreshCw className="h-4 w-4" />
              Processar fila agora
            </Button>
          </div>
        </div>
      </section>

      {showCreateCampaignModal && (
        <ModalShell
          isOpen
          onClose={() => setShowCreateCampaignModal(false)}
          title="Nova campanha"
          description="Monte o fluxo de mensagens, escolha a fonte do publico e agende o disparo quando fizer sentido."
          size="xl"
          bodyClassName="space-y-5"
          footer={(
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">
                Preview:{' '}
                <strong>
                  {audienceSource === 'csv'
                    ? csvAnalysis
                      ? formatCsvSummaryLabel(csvAnalysis.summary)
                      : 'CSV ainda nao validado'
                    : `${previewLeadsTotal} lead(s)`}
                </strong>
              </span>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="ghost"
                  onClick={() => setShowCreateCampaignModal(false)}
                  disabled={creatingCampaign || loadingPreview}
                >
                  Cancelar
                </Button>
                <Button variant="secondary" onClick={() => void handlePreviewAudience()} loading={loadingPreview}>
                  <Send className="h-4 w-4" />
                  Gerar preview
                </Button>
                <Button onClick={() => void handleCreateCampaign()} loading={creatingCampaign}>
                  Criar campanha
                </Button>
              </div>
            </div>
          )}
        >
          <>
            {messageState && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  messageState.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{messageState.text}</span>
                </div>
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            Nome da campanha
            <input
              type="text"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Ex: Reengajamento de cotação"
            />
          </label>

          <label className="text-xs font-medium text-slate-600">
            Agendamento unico (opcional)
            <input
              type="datetime-local"
              value={scheduledAtInput}
              onChange={(event) => setScheduledAtInput(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>

          <label className="text-xs font-medium text-slate-600">
            Limite diario de envios
            <input
              type="number"
              min={1}
              value={campaignPacing.dailySendLimit ?? ''}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                setCampaignPacing((current) => ({
                  ...current,
                  dailySendLimit: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null,
                }));
              }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Sem limite"
            />
          </label>

          <label className="text-xs font-medium text-slate-600">
            Intervalo entre envios (min)
            <input
              type="number"
              min={1}
              value={campaignPacing.sendIntervalMinutes ?? ''}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                setCampaignPacing((current) => ({
                  ...current,
                  sendIntervalMinutes: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null,
                }));
              }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Sem intervalo"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          O limite diario conta os envios desta campanha por dia. O intervalo define quantos minutos o worker espera entre um envio e outro.
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fonte do publico</p>
              <p className="text-xs text-slate-500">Uma campanha pode usar leads filtrados ou um CSV importado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['filters', 'csv'] as WhatsAppCampaignAudienceSource[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setAudienceSource(source)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    audienceSource === source
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {formatAudienceSourceLabel(source)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {audienceSource === 'filters' && (
          <div className={`mt-4 grid gap-3 md:grid-cols-2 ${hasCanalColumn ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          <label className="text-xs font-medium text-slate-600">
            Status
            <select
              value={filters.statusId}
              onChange={(event) => setFilters((current) => ({ ...current, statusId: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Responsavel
            <select
              value={filters.responsavelId}
              onChange={(event) => setFilters((current) => ({ ...current, responsavelId: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todos</option>
              {responsavelOptions.map((responsavel) => (
                <option key={responsavel.id} value={responsavel.id}>
                  {responsavel.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Origem
            <select
              value={filters.origemId}
              onChange={(event) => setFilters((current) => ({ ...current, origemId: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todas</option>
              {origemOptions.map((origem) => (
                <option key={origem.id} value={origem.id}>
                  {origem.label}
                </option>
              ))}
            </select>
          </label>

          {hasCanalColumn && (
            <label className="text-xs font-medium text-slate-600">
              Canal
              <select
                value={filters.canal}
                onChange={(event) => setFilters((current) => ({ ...current, canal: event.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={loadingFilters}
              >
                <option value="">Todos</option>
                {canalOptions.map((canal) => (
                  <option key={canal} value={canal}>
                    {canal}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        )}

        {audienceSource === 'csv' && (
          <div className="mt-4 space-y-4 rounded-xl border border-amber-900/40 bg-stone-950/40 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-200">Arquivo CSV</p>
                    <p className="text-xs text-stone-400">Selecione um arquivo com cabecalho e ao menos uma linha valida.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => csvFileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {csvImport.parsed ? 'Trocar arquivo' : 'Selecionar CSV'}
                  </Button>
                </div>

                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = '';
                    if (!file) {
                      return;
                    }

                    void handleCsvFileUpload(file);
                  }}
                  className="sr-only"
                />

                <label
                  className={`group block cursor-pointer rounded-xl border px-4 py-4 transition ${
                    csvImport.parsed
                      ? 'border-amber-500/35 bg-stone-900/95 hover:border-amber-400 hover:bg-stone-900'
                      : 'border-dashed border-stone-700 bg-stone-950/80 hover:border-amber-500/40 hover:bg-stone-900'
                  }`}
                  onClick={() => csvFileInputRef.current?.click()}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl border px-3 py-3 ${
                        csvImport.parsed
                          ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
                          : 'border-stone-700 bg-stone-900 text-stone-400 group-hover:border-amber-500/30 group-hover:bg-amber-500/10 group-hover:text-amber-300'
                      }`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-100">
                          {csvImport.fileName || 'Nenhum CSV selecionado'}
                        </p>
                        <p className="mt-1 text-xs text-stone-400">
                          {csvImport.parsed
                            ? `${csvImport.parsed.rows.length} linha(s) encontradas com delimitador "${csvImport.parsed.delimiter}".`
                            : 'Clique para selecionar um CSV do seu computador.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-stone-300">
                      <span className="rounded-full border border-stone-700 bg-stone-950 px-2.5 py-1 text-stone-200">.csv</span>
                      {csvImport.parsed && (
                        <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                          {csvImport.parsed.normalizedHeaders.length} coluna(s)
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              </div>

              <div className="rounded-lg border border-stone-700 bg-stone-950/80 px-3 py-2 text-xs text-stone-300">
                {csvImport.parsed ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-stone-100">{csvImport.fileName}</p>
                    <p>{csvImport.parsed.rows.length} linha(s) com delimitador "{csvImport.parsed.delimiter}".</p>
                    <p>Variaveis: {csvImport.parsed.normalizedHeaders.map((header) => `{{${header}}}`).join(', ')}</p>
                  </div>
                ) : (
                  <p>Importe um CSV com colunas como nome, plano e telefone.</p>
                )}
              </div>
            </div>

            {csvImport.parsed && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-slate-600">
                    Coluna do telefone
                    <select
                      value={csvImport.phoneColumnKey}
                      onChange={(event) =>
                        setCsvImport((current) => ({
                          ...current,
                          phoneColumnKey: event.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Selecione a coluna obrigatoria</option>
                      {csvImport.parsed.normalizedHeaders.map((header, index) => (
                        <option key={header} value={header}>
                          {(csvImport.parsed?.headers[index] || header).trim() || header} ({`{{${header}}}`})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-medium text-slate-600">
                    Coluna do nome (opcional)
                    <select
                      value={csvImport.nameColumnKey}
                      onChange={(event) =>
                        setCsvImport((current) => ({
                          ...current,
                          nameColumnKey: event.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Usar nome do lead existente</option>
                      {csvImport.parsed.normalizedHeaders.map((header, index) => (
                        <option key={header} value={header}>
                          {(csvImport.parsed?.headers[index] || header).trim() || header} ({`{{${header}}}`})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Defaults do CRM</p>
                      <p className="text-xs text-slate-500">Aplicados apenas nas linhas do CSV que virarem novos leads.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      Novos leads no preview: {csvAnalysis?.summary.newLeadRows ?? 0}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-600">
                      Origem
                      <select
                        value={csvCrmDefaults.origemId}
                        onChange={(event) =>
                          setCsvCrmDefaults((current) => ({
                            ...current,
                            origemId: event.target.value,
                            confirmNewLeadDefaults: false,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Selecione</option>
                        {origemOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-slate-600">
                      Status
                      <select
                        value={csvCrmDefaults.statusId}
                        onChange={(event) =>
                          setCsvCrmDefaults((current) => ({
                            ...current,
                            statusId: event.target.value,
                            confirmNewLeadDefaults: false,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Selecione</option>
                        {statusOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-slate-600">
                      Tipo de contratacao
                      <select
                        value={csvCrmDefaults.tipoContratacaoId}
                        onChange={(event) =>
                          setCsvCrmDefaults((current) => ({
                            ...current,
                            tipoContratacaoId: event.target.value,
                            confirmNewLeadDefaults: false,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Selecione</option>
                        {tipoContratacaoOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-slate-600">
                      Responsavel
                      <select
                        value={csvCrmDefaults.responsavelId}
                        onChange={(event) =>
                          setCsvCrmDefaults((current) => ({
                            ...current,
                            responsavelId: event.target.value,
                            confirmNewLeadDefaults: false,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">Selecione</option>
                        {responsavelOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                    <Checkbox
                      checked={csvCrmDefaults.confirmNewLeadDefaults}
                      onChange={(event) =>
                        setCsvCrmDefaults((current) => ({
                          ...current,
                          confirmNewLeadDefaults: event.target.checked,
                        }))
                      }
                    />
                    <span>Confirmo os defaults acima para os leads novos criados pelo CSV.</span>
                  </label>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fluxo da campanha</p>
              <p className="text-xs text-slate-500">
                Variaveis disponiveis: {campaignVariableSuggestions.map((item) => `{{${item.key}}}`).join(', ')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['text', 'image', 'document', 'video', 'audio'] as WhatsAppCampaignFlowStepType[]).map((type) => {
                const Icon = FLOW_STEP_ICONS[type];
                return (
                  <Button key={type} size="sm" variant="ghost" onClick={() => addFlowStep(type)}>
                    <Plus className="h-3.5 w-3.5" />
                    <Icon className="h-3.5 w-3.5" />
                    {FLOW_STEP_LABELS[type]}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                onNodeClick={(_, node) => setSelectedStepId(node.id)}
                proOptions={{ hideAttribution: true }}
              >
                <MiniMap pannable zoomable nodeStrokeWidth={3} />
                <Controls showInteractive={false} />
                <Background gap={18} size={1} color="#e2e8f0" />
              </ReactFlow>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              {selectedStep ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Etapa selecionada</p>
                    <Button size="sm" variant="danger" onClick={removeSelectedStep}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>

                  <label className="text-xs font-medium text-slate-600">
                    Tipo de envio
                    <select
                      value={selectedStep.type}
                      onChange={(event) => updateSelectedStep({ type: event.target.value as WhatsAppCampaignFlowStepType })}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {Object.entries(FLOW_STEP_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedStep.type === 'text' ? (
                    <label className="text-xs font-medium text-slate-600">
                      Texto da mensagem
                      <VariableAutocompleteTextarea
                        value={selectedStep.text ?? ''}
                        onChange={(value) => updateSelectedStep({ text: value })}
                        rows={6}
                        className="mt-1 text-sm"
                        suggestions={campaignVariableSuggestions}
                        placeholder="Digite a mensagem desta etapa"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="text-xs font-medium text-slate-600">
                        Arquivo da etapa
                        <input
                          type="file"
                          accept={getAcceptedFileTypesByStepType(selectedStep.type)}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = '';
                            if (!file) {
                              return;
                            }

                            void handleUploadFileToSelectedStep(file);
                          }}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                          disabled={uploadingStepId === selectedStep.id}
                        />
                      </label>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {selectedStep.mediaUrl ? (
                          <span>
                            Arquivo pronto para envio: <strong>{selectedStep.filename || selectedStep.mediaUrl.split('/').pop() || 'arquivo'}</strong>
                          </span>
                        ) : (
                          <span>Nenhum arquivo enviado nesta etapa.</span>
                        )}
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">
                        <Upload className={`h-3.5 w-3.5 ${uploadingStepId === selectedStep.id ? 'animate-pulse' : ''}`} />
                        {uploadingStepId === selectedStep.id ? 'Enviando arquivo...' : 'Selecione um arquivo para upload'}
                      </div>

                      <label className="text-xs font-medium text-slate-600">
                        Legenda (opcional)
                        <VariableAutocompleteTextarea
                          value={selectedStep.caption ?? ''}
                          onChange={(value) => updateSelectedStep({ caption: value })}
                          rows={3}
                          className="mt-1 text-sm"
                          suggestions={campaignVariableSuggestions}
                          placeholder="Legenda para acompanhar a midia"
                        />
                      </label>

                      {selectedStep.type === 'document' && (
                        <label className="text-xs font-medium text-slate-600">
                          Nome do arquivo (opcional)
                          <input
                            type="text"
                            value={selectedStep.filename ?? ''}
                            onChange={(event) => updateSelectedStep({ filename: event.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="proposta.pdf"
                          />
                        </label>
                      )}
                    </>
                  )}

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Intervalo antes desta etapa</p>
                        <p className="text-xs text-slate-500">Use 0 para enviar logo apos a etapa anterior ou o inicio da campanha.</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {formatWhatsAppCampaignStepDelay(selectedStep)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                      <label className="text-xs font-medium text-slate-600">
                        Valor
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={selectedStep.delayValue ?? 0}
                          onChange={(event) =>
                            updateSelectedStep({
                              delayValue: Math.max(0, Number.parseInt(event.target.value || '0', 10) || 0),
                            })
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </label>

                      <label className="text-xs font-medium text-slate-600">
                        Unidade
                        <select
                          value={selectedStep.delayUnit ?? 'hours'}
                          onChange={(event) => updateSelectedStep({ delayUnit: event.target.value as WhatsAppCampaignFlowStepDelayUnit })}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {Object.entries(WHATSAPP_CAMPAIGN_DELAY_UNIT_LABELS).map(([value, labels]) => (
                            <option key={value} value={value}>
                              {labels.plural}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Condicoes dinamicas</p>
                        <p className="text-xs text-slate-500">Cada etapa pode decidir se envia ou nao com base no lead, conversa ou colunas do CSV.</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => addConditionToSelectedStep('conversation.has_inbound_since_last_step')}>
                          Parar se respondeu
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => addConditionToSelectedStep()}>
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar condicao
                        </Button>
                      </div>
                    </div>

                    {(selectedStep.conditions?.length ?? 0) > 0 ? (
                      <div className="mt-3 space-y-3">
                        <label className="text-xs font-medium text-slate-600">
                          Aplicar quando
                          <select
                            value={selectedStep.conditionLogic ?? 'all'}
                            onChange={(event) => updateSelectedStep({ conditionLogic: event.target.value as WhatsAppCampaignConditionLogic })}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            {CONDITION_LOGIC_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        {(selectedStep.conditions ?? []).map((condition, index) => {
                          const definition = campaignConditionFieldDefinitionMap.get(condition.field) ?? campaignConditionFieldDefinitions[0];
                          const operators = definition?.operators ?? ['equals'];

                          return (
                            <div key={condition.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="grid gap-2">
                                <label className="text-xs font-medium text-slate-600">
                                  Campo
                                  <select
                                    value={condition.field}
                                    onChange={(event) => {
                                      const nextField = event.target.value;
                                      const nextDefinition = campaignConditionFieldDefinitionMap.get(nextField) ?? campaignConditionFieldDefinitions[0];
                                      updateSelectedStepCondition(condition.id, {
                                        field: nextField,
                                        operator: nextDefinition?.operators?.[0] ?? 'equals',
                                        value: nextDefinition?.options?.[0]?.value ?? (nextDefinition?.type === 'boolean' ? 'false' : ''),
                                      });
                                    }}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  >
                                    {Object.entries(CONDITION_GROUP_LABELS).map(([groupKey, groupLabel]) => {
                                      const groupDefinitions = campaignConditionFieldDefinitions.filter((item) => item.group === groupKey);
                                      if (groupDefinitions.length === 0) {
                                        return null;
                                      }

                                      return (
                                        <optgroup key={groupKey} label={groupLabel}>
                                          {groupDefinitions.map((item) => (
                                            <option key={item.key} value={item.key}>
                                              {item.label}
                                            </option>
                                          ))}
                                        </optgroup>
                                      );
                                    })}
                                  </select>
                                </label>

                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                  <label className="text-xs font-medium text-slate-600">
                                    Operador
                                    <select
                                      value={condition.operator}
                                      onChange={(event) =>
                                        updateSelectedStepCondition(condition.id, {
                                          operator: event.target.value as WhatsAppCampaignConditionOperator,
                                        })
                                      }
                                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                      {operators.map((operator) => (
                                        <option key={operator} value={operator}>
                                          {WHATSAPP_CAMPAIGN_CONDITION_OPERATOR_LABELS[operator]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="text-xs font-medium text-slate-600">
                                    Valor
                                    {definition?.options && definition.options.length > 0 ? (
                                      <select
                                        value={condition.value}
                                        onChange={(event) => updateSelectedStepCondition(condition.id, { value: event.target.value })}
                                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                                      >
                                        {definition.options.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={condition.value}
                                        onChange={(event) => updateSelectedStepCondition(condition.id, { value: event.target.value })}
                                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        placeholder={definition?.type === 'datetime' ? '2026-03-21T09:30:00-03:00' : 'Digite o valor'}
                                      />
                                    )}
                                  </label>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                  <span>
                                    Condicao {index + 1}
                                    {definition?.description ? ` • ${definition.description}` : ''}
                                  </span>
                                  <Button size="sm" variant="danger" onClick={() => removeSelectedStepCondition(condition.id)}>
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                        Sem condicoes nesta etapa. Se todas as regras forem atendidas, a etapa e enviada normalmente.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Selecione uma etapa no fluxo para editar.</p>
              )}
            </div>
          </div>
        </div>

        {unknownFlowVariables.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Variaveis desconhecidas detectadas: {unknownFlowVariables.map((value) => `{{${value}}}`).join(', ')}.
          </div>
        )}

        {previewSampleMessage && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sample resolvido</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{previewSampleMessage}</p>
          </div>
        )}

        {audienceSource === 'csv' && csvAnalysis && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">Validos: {csvAnalysis.summary.validRows}</div>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">Sem telefone: {csvAnalysis.summary.missingPhoneRows}</div>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">Duplicados: {csvAnalysis.summary.duplicateRows}</div>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">Existentes: {csvAnalysis.summary.existingLeadRows}</div>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">Novos: {csvAnalysis.summary.newLeadRows}</div>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">Sem nome: {csvAnalysis.summary.missingNameRows}</div>
            </div>

            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-xs text-slate-700">
              {csvAnalysis.items.slice(0, 80).map((item) => (
                <li
                  key={`${item.rowNumber}-${item.normalizedPhone || item.rawPhone}`}
                  className={`rounded-md border px-2 py-2 ${
                    item.invalidReason ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Linha {item.rowNumber}: {item.displayName || 'Sem nome'} - {item.rawPhone || 'Sem telefone'}
                    </span>
                    <span className="text-slate-500">
                      {item.invalidReason === 'missing_phone' && 'Sem telefone'}
                      {item.invalidReason === 'duplicate_phone' && `Duplicado da linha ${item.duplicateOfRowNumber}`}
                      {item.invalidReason === 'missing_name' && 'Nome obrigatorio para novo lead'}
                      {!item.invalidReason && (item.existingLead ? 'Lead existente' : 'Novo lead')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {audienceSource === 'filters' && previewLeads.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amostra do preview ({previewLeads.length} de {previewLeadsTotal} lead(s) deduplicado(s))
            </p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-xs text-slate-700">
              {previewLeads.slice(0, 80).map((lead) => (
                <li key={lead.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  {lead.nome_completo} - {lead.telefone}
                  <span className="ml-1 text-slate-500">
                    ({statusNameById.get(lead.status_id || '') || 'Sem status'} / {responsavelNameById.get(lead.responsavel_id || '') || 'Sem responsavel'} /{' '}
                    {origemNameById.get(lead.origem_id || '') || 'Sem origem'})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
          </>
        </ModalShell>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Campanhas criadas</h3>
          <Button variant="ghost" size="sm" onClick={() => void loadCampaigns()} loading={loadingCampaigns}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {loadingCampaigns ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando campanhas...
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma campanha cadastrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const isSelected = campaign.id === selectedCampaignId;
              const isActionLoading = actionCampaignId === campaign.id;
              const isProcessing = processingCampaignId === campaign.id;
              const importStatus = normalizeWhatsAppCampaignImportStatus(campaign.import_status);
              const importProgressLabel = formatImportProgressLabel(campaign);
              const canStart = (campaign.status === 'draft' || campaign.status === 'paused') && isWhatsAppCampaignImportReady(campaign);
              const canPause = campaign.status === 'running';
              const canCancel = campaign.status === 'draft' || campaign.status === 'running' || campaign.status === 'paused';

              return (
                <article
                  key={campaign.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isSelected ? 'border-teal-300 bg-teal-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{campaign.name}</p>
                        <p className="text-xs text-slate-500">
                          Criada em {formatDateTime(campaign.created_at)} - {formatAudienceSourceLabel(campaign.audience_source)}
                        </p>
                        {campaign.scheduled_at && (
                          <p className="text-xs text-slate-500">Agendada para {formatDateTime(campaign.scheduled_at)}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            STATUS_CLASSNAMES[campaign.status]
                          }`}
                        >
                          {STATUS_LABELS[campaign.status]}
                        </span>
                        {campaign.audience_source === 'csv' && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              IMPORT_STATUS_CLASSNAMES[importStatus]
                            }`}
                          >
                            {IMPORT_STATUS_LABELS[importStatus]}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {campaign.audience_source === 'csv' && importProgressLabel && (
                    <p className="mt-2 text-xs text-slate-600">{importProgressLabel}</p>
                  )}

                  <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-5">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Total: {campaign.total_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Pendentes: {campaign.pending_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Enviadas: {campaign.sent_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Falhas: {campaign.failed_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Invalidos: {campaign.invalid_targets}</div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600">Etapas do fluxo: {campaign.flow_steps.length}</p>

                  {campaign.last_error && (
                    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                      Ultimo erro: {campaign.last_error}
                    </p>
                  )}

                  {campaign.import_error && (
                    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                      Erro da importacao: {campaign.import_error}
                    </p>
                  )}

                  {campaign.audience_source === 'csv' && !isWhatsAppCampaignImportReady(campaign) && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      A importacao do CSV ainda esta em andamento. A campanha so pode iniciar quando todos os lotes forem processados.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() =>
                        void updateCampaignStatus(campaign, 'running', {
                          clearCompletedAt: true,
                        })
                      }
                      disabled={!canStart || isActionLoading || isProcessing}
                    >
                      <Play className="h-4 w-4" />
                      Iniciar
                    </Button>

                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => void updateCampaignStatus(campaign, 'paused')}
                      disabled={!canPause || isActionLoading || isProcessing}
                    >
                      <Pause className="h-4 w-4" />
                      Pausar
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void handleProcessNow(campaign.id);
                      }}
                      loading={isProcessing}
                      disabled={campaign.status !== 'running' || isActionLoading}
                    >
                      <Send className="h-4 w-4" />
                      Processar agora
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        void handleCancelCampaign(campaign);
                      }}
                      disabled={!canCancel || isActionLoading || isProcessing}
                    >
                      <Square className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {selectedCampaign && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Selecionada: {selectedCampaign.name}</span>
              <span>Fonte: {formatAudienceSourceLabel(selectedCampaign.audience_source)}</span>
              <span>Agendada: {formatDateTime(selectedCampaign.scheduled_at)}</span>
              <span>Inicio: {formatDateTime(selectedCampaign.started_at)}</span>
              <span>Fim: {formatDateTime(selectedCampaign.completed_at)}</span>
              <span>Etapas: {selectedCampaign.flow_steps.length}</span>
              <span>Limite diario: {selectedCampaignPacing.dailySendLimit ?? 'Sem limite'}</span>
              <span>Intervalo: {selectedCampaignPacing.sendIntervalMinutes ? `${selectedCampaignPacing.sendIntervalMinutes} min` : 'Sem intervalo'}</span>
            </div>
          </div>
        )}

        {selectedCampaign && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Historico de alvos</h4>
                <p className="text-xs text-slate-500">Filtros, reenfileiramento de falhas e exportacao de erros por campanha.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => void loadCampaignTargets()} loading={loadingTargets}>
                  <RefreshCw className="h-4 w-4" />
                  Atualizar alvos
                </Button>
                <Button size="sm" variant="warning" onClick={() => void handleRequeueFailedTargets()} loading={requeueingFailures}>
                  <RotateCcw className="h-4 w-4" />
                  Reenfileirar falhas
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleExportFailedTargets()} loading={exportingFailures}>
                  <Download className="h-4 w-4" />
                  Exportar falhas
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-medium text-slate-600">
                Status
                <select
                  value={campaignTargetsFilters.status}
                  onChange={(event) =>
                    setCampaignTargetsFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Todos</option>
                  {(['pending', 'processing', 'sent', 'failed', 'invalid', 'cancelled'] as WhatsAppCampaignTargetStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-slate-600">
                Sent at
                <select
                  value={campaignTargetsFilters.sentState}
                  onChange={(event) =>
                    setCampaignTargetsFilters((current) => ({
                      ...current,
                      sentState: event.target.value as CampaignTargetsFilters['sentState'],
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">Todos</option>
                  <option value="sent">Enviados</option>
                  <option value="not_sent">Nao enviados</option>
                </select>
              </label>

              <label className="text-xs font-medium text-slate-600">
                Last attempt
                <select
                  value={campaignTargetsFilters.attemptState}
                  onChange={(event) =>
                    setCampaignTargetsFilters((current) => ({
                      ...current,
                      attemptState: event.target.value as CampaignTargetsFilters['attemptState'],
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">Todos</option>
                  <option value="attempted">Tentados</option>
                  <option value="not_attempted">Sem tentativa</option>
                </select>
              </label>

              <label className="text-xs font-medium text-slate-600">
                Buscar erro
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={campaignTargetsFilters.errorSearch}
                    onChange={(event) =>
                      setCampaignTargetsFilters((current) => ({
                        ...current,
                        errorSearch: event.target.value,
                      }))
                    }
                    className="h-10 w-full border-0 bg-transparent text-sm focus:outline-none"
                    placeholder="Ex: numero invalido"
                  />
                </div>
              </label>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Alvo</th>
                    <th className="px-3 py-2 text-left font-semibold">Fonte</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Sent at</th>
                    <th className="px-3 py-2 text-left font-semibold">Last attempt</th>
                    <th className="px-3 py-2 text-left font-semibold">Proxima etapa</th>
                    <th className="px-3 py-2 text-left font-semibold">Erro</th>
                    <th className="px-3 py-2 text-left font-semibold">Acao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingTargets ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                        Carregando alvos...
                      </td>
                    </tr>
                  ) : campaignTargets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                        Nenhum alvo encontrado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    campaignTargets.map((target) => (
                      <tr key={target.id}>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-800">
                            {target.display_name || target.lead?.nome_completo || 'Sem nome'}
                          </div>
                          <div className="text-slate-500">{target.raw_phone || target.phone || target.lead?.telefone || '-'}</div>
                        </td>
                        <td className="px-3 py-2 align-top">{formatTargetSourceKindLabel(target.source_kind)}</td>
                        <td className="px-3 py-2 align-top">{target.status}</td>
                        <td className="px-3 py-2 align-top">{formatDateTime(target.sent_at)}</td>
                        <td className="px-3 py-2 align-top">{formatDateTime(target.last_attempt_at)}</td>
                        <td className="px-3 py-2 align-top">{formatDateTime(target.next_step_due_at)}</td>
                        <td className="px-3 py-2 align-top text-slate-500">{target.error_message || '-'}</td>
                        <td className="px-3 py-2 align-top">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleRequeueSingleTarget(target)}
                            disabled={!canRequeueCampaignTarget(target.status) || requeueingTargetId === target.id}
                            loading={requeueingTargetId === target.id}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reenfileirar
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Pagina {campaignTargetsPage + 1} de {campaignTargetsPageCount} • {campaignTargetsTotalCount} alvo(s)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCampaignTargetsPage((current) => Math.max(0, current - 1))}
                  disabled={campaignTargetsPage === 0}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setCampaignTargetsPage((current) => Math.min(campaignTargetsPageCount - 1, current + 1))
                  }
                  disabled={campaignTargetsPage + 1 >= campaignTargetsPageCount}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
