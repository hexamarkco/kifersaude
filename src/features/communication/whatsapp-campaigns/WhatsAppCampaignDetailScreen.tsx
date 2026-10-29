import { ButtonGroup } from '../../../design-system';
import { Text, Heading } from '../../../design-system';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, Filter, PauseCircle, Pencil, PlayCircle, RefreshCw, Search, Send, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  KpiCard,
  PageHeader,
  PageActions,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
  FilterMultiSelect,
  Pagination,
  useTableSorting,
} from '../../../design-system';
import { toast } from '../../../lib/toast';
import { subscribeToCampaignChanges } from './campaignRealtime';
import { getCampaignTargetDisplayName } from './domain/campaignTargetPresentation';
import { CampaignIssueNotice } from './components/CampaignIssueNotice';
import { groupCampaignIssues } from './domain/campaignIssuePresentation';
import {
  commWhatsAppCampaignService,
  computeContactIntervalMinutes,
  formatContactInterval,
  type CommWhatsAppCampaign,
  type CommWhatsAppCampaignTargetListItem,
  type CommWhatsAppCampaignTargetStatus,
} from './commWhatsAppCampaignService';

const campaignStatusLabels: Record<CommWhatsAppCampaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  queued: 'Na fila',
  running: 'Em andamento',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const campaignStatusTones: Record<CommWhatsAppCampaign['status'], 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  scheduled: 'accent',
  queued: 'warning',
  running: 'success',
  paused: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const audienceSourceLabels: Record<CommWhatsAppCampaign['audience_source'], string> = {
  crm: 'Base do CRM',
  csv: 'Planilha CSV',
  manual: 'Lista manual',
  mixed: 'CRM e lista manual',
};

const targetStatusLabels: Record<CommWhatsAppCampaignTargetStatus, string> = {
  pending: 'Pendente',
  scheduled: 'Agendado',
  sending: 'Enviando',
  sent: 'Enviado',
  responded: 'Respondeu',
  stopped: 'Bloqueado',
  failed: 'Precisa de atenção',
  invalid: 'Inválido',
  cancelled: 'Cancelado',
};

const targetStatusTones: Record<CommWhatsAppCampaignTargetStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  pending: 'neutral',
  scheduled: 'accent',
  sending: 'warning',
  sent: 'success',
  responded: 'success',
  stopped: 'danger',
  failed: 'danger',
  invalid: 'danger',
  cancelled: 'neutral',
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const WEEKDAY_SHORT_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const formatActiveWeekdays = (activeWeekdays: number[] | null | undefined) => {
  if (!activeWeekdays || activeWeekdays.length === 0 || activeWeekdays.length === 7) return null;
  return [...activeWeekdays].sort((a, b) => a - b).map((day) => WEEKDAY_SHORT_LABELS[day]).join(', ');
};

const formatWindow = (campaign: CommWhatsAppCampaign) => {
  const weekdaysLabel = formatActiveWeekdays(campaign.active_weekdays);
  const timeLabel = campaign.send_window_start && campaign.send_window_end
    ? `${campaign.send_window_start.slice(0, 5)} - ${campaign.send_window_end.slice(0, 5)}`
    : null;

  if (!timeLabel && !weekdaysLabel) return 'Sem janela definida';
  if (timeLabel && weekdaysLabel) return `${timeLabel} (${weekdaysLabel})`;
  return timeLabel ?? weekdaysLabel ?? 'Sem janela definida';
};

const DEFAULT_TARGETS_PAGE_SIZE = 10;

const targetStatusFilterOptions = (Object.keys(targetStatusLabels) as CommWhatsAppCampaignTargetStatus[]).map((status) => ({
  value: status,
  label: targetStatusLabels[status],
}));

export default function WhatsAppCampaignDetailScreen() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CommWhatsAppCampaign | null>(null);
  const [targets, setTargets] = useState<CommWhatsAppCampaignTargetListItem[]>([]);
  const [targetsTotal, setTargetsTotal] = useState(0);
  const [targetsPage, setTargetsPage] = useState(1);
  const [targetsPageSize, setTargetsPageSize] = useState(DEFAULT_TARGETS_PAGE_SIZE);
  const [targetsSearch, setTargetsSearch] = useState('');
  const deferredTargetsSearch = useDeferredValue(targetsSearch);
  const [targetsStatusFilter, setTargetsStatusFilter] = useState<CommWhatsAppCampaignTargetStatus[]>([]);
  const { sorting: targetSorting, sortBy: sortTargetsBy } = useTableSorting<"contact" | "status" | "step" | "next" | "last" | "error">();
  const [loadingTargetsPage, setLoadingTargetsPage] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Array<{ status: string; ab_variant: 'A' | 'B' | null; total_count: number; responded_count: number }>>([]);
  const [failureReasons, setFailureReasons] = useState<Array<{ error_message: string; total_count: number }>>([]);
  const [pendingWhatsAppValidation, setPendingWhatsAppValidation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<'all' | 'partial' | false>(false);
  const [liveRefreshError, setLiveRefreshError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const targetsPageRef = useRef(0);
  const targetsFiltersRef = useRef<{ pageSize: number; status: CommWhatsAppCampaignTargetStatus[]; search: string; sortField: 'created_at' | 'display_name' | 'status' | 'current_step_index' | 'next_send_at' | 'last_attempt_at' | 'error_message'; sortAscending: boolean }>({
    pageSize: DEFAULT_TARGETS_PAGE_SIZE,
    status: [],
    search: '',
    sortField: 'created_at',
    sortAscending: true,
  });
  const refreshLiveDataInFlightRef = useRef<number | null>(null);
  const loadDetailInFlightRef = useRef<number | null>(null);
  const pendingDetailReloadRef = useRef(false);
  const pendingLiveRefreshRef = useRef(false);
  const loadDetailRef = useRef<(() => Promise<void>) | null>(null);
  const refreshLiveDataRef = useRef<(() => Promise<void>) | null>(null);
  const detailRequestIdRef = useRef(0);
  const targetListRequestIdRef = useRef(0);
  const liveMetricsRequestIdRef = useRef(0);
  const screenGenerationRef = useRef(0);
  const activeCampaignIdRef = useRef<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!campaignId || activeCampaignIdRef.current !== campaignId) return;
    if (loadDetailInFlightRef.current !== null || refreshLiveDataInFlightRef.current !== null) {
      pendingDetailReloadRef.current = true;
      setLoading(true);
      return;
    }
    const screenGeneration = screenGenerationRef.current;
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    const targetRequestId = targetListRequestIdRef.current + 1;
    targetListRequestIdRef.current = targetRequestId;
    const metricsRequestId = liveMetricsRequestIdRef.current + 1;
    liveMetricsRequestIdRef.current = metricsRequestId;
    setLoading(true);
    setLoadError(false);
    loadDetailInFlightRef.current = requestId;
    try {
      const targetsFilters = targetsFiltersRef.current;
      const results = await Promise.allSettled([
        commWhatsAppCampaignService.getCampaign(campaignId),
        commWhatsAppCampaignService.listCampaignTargets(campaignId, {
          page: 0,
          pageSize: targetsFilters.pageSize,
          status: targetsFilters.status.length > 0 ? targetsFilters.status : undefined,
          search: targetsFilters.search || undefined,
          sortField: targetsFilters.sortField,
          sortAscending: targetsFilters.sortAscending,
        }),
        commWhatsAppCampaignService.getCampaignTargetStatusCounts(campaignId),
        commWhatsAppCampaignService.getCampaignFailureReasons(campaignId),
        commWhatsAppCampaignService.getPendingWhatsAppValidationCount(campaignId),
      ]);
      if (screenGeneration !== screenGenerationRef.current || requestId !== detailRequestIdRef.current) return;
      const [campaignResult, targetsResult, statusCountsResult, failureReasonsResult, pendingValidationResult] = results;

      if (campaignResult.status === 'fulfilled') {
        setCampaign(campaignResult.value);
      }
      if (targetsResult.status === 'fulfilled' && screenGeneration === screenGenerationRef.current && targetRequestId === targetListRequestIdRef.current) {
        setTargets(targetsResult.value.targets);
        setTargetsTotal(targetsResult.value.total);
        setTargetsPage(1);
        targetsPageRef.current = 0;
      }
      if (screenGeneration === screenGenerationRef.current && metricsRequestId === liveMetricsRequestIdRef.current) {
        if (statusCountsResult.status === 'fulfilled') setStatusCounts(statusCountsResult.value);
        if (failureReasonsResult.status === 'fulfilled') setFailureReasons(failureReasonsResult.value);
        if (pendingValidationResult.status === 'fulfilled') setPendingWhatsAppValidation(pendingValidationResult.value);
      }

      const failedResults = results.filter((result) => result.status === 'rejected');
      setLoadError(failedResults.length === 0 ? false : failedResults.length === results.length ? 'all' : 'partial');
      if (failedResults.length === 0) {
        setLiveRefreshError(null);
      }
      if (failedResults.length > 0) {
        console.warn('[WhatsAppCampaignDetailScreen] alguns dados não puderam ser carregados', results);
      }
    } catch (error) {
      if (screenGeneration === screenGenerationRef.current && requestId === detailRequestIdRef.current) {
        console.error('[WhatsAppCampaignDetailScreen] erro ao carregar detalhe', error);
        setLoadError('all');
      }
    } finally {
      if (loadDetailInFlightRef.current === requestId) {
        loadDetailInFlightRef.current = null;
        if (screenGeneration === screenGenerationRef.current && requestId === detailRequestIdRef.current) {
          setLoading(false);
        }
        if (screenGeneration === screenGenerationRef.current && activeCampaignIdRef.current === campaignId) {
          if (pendingDetailReloadRef.current) {
            pendingDetailReloadRef.current = false;
            pendingLiveRefreshRef.current = false;
            window.setTimeout(() => { void loadDetailRef.current?.(); }, 0);
          } else if (pendingLiveRefreshRef.current) {
            pendingLiveRefreshRef.current = false;
            window.setTimeout(() => { void refreshLiveDataRef.current?.(); }, 0);
          }
        }
      }
    }
  }, [campaignId]);

  loadDetailRef.current = loadDetail;

  const goToTargetsPage = useCallback(async (page: number) => {
    if (!campaignId || activeCampaignIdRef.current !== campaignId || page < 1) return;
    const screenGeneration = screenGenerationRef.current;
    const requestId = targetListRequestIdRef.current + 1;
    targetListRequestIdRef.current = requestId;
    setLoadingTargetsPage(true);
    try {
      const targetsFilters = {
        pageSize: targetsFiltersRef.current.pageSize,
        status: [...targetsFiltersRef.current.status],
        search: targetsFiltersRef.current.search,
        sortField: targetsFiltersRef.current.sortField,
        sortAscending: targetsFiltersRef.current.sortAscending,
      };
      const result = await commWhatsAppCampaignService.listCampaignTargets(campaignId, {
        page: page - 1,
        pageSize: targetsFilters.pageSize,
        status: targetsFilters.status.length > 0 ? targetsFilters.status : undefined,
        search: targetsFilters.search || undefined,
        sortField: targetsFilters.sortField,
        sortAscending: targetsFilters.sortAscending,
      });
      if (screenGeneration !== screenGenerationRef.current || requestId !== targetListRequestIdRef.current) return;
      setTargets(result.targets);
      setTargetsTotal(result.total);
      setTargetsPage(page);
      targetsPageRef.current = page - 1;
    } catch (error) {
      if (screenGeneration === screenGenerationRef.current && requestId === targetListRequestIdRef.current) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível carregar esta página de contatos.');
      }
    } finally {
      if (screenGeneration === screenGenerationRef.current && requestId === targetListRequestIdRef.current) {
        setLoadingTargetsPage(false);
      }
    }
  }, [campaignId]);

  // Mantem a ref de filtros sempre atualizada (para loadDetail/refreshLiveData,
  // que leem via ref para nao precisar recriar esses callbacks a cada
  // mudanca de filtro) e refaz a busca a partir da pagina 1 sempre que
  // busca, status ou itens por pagina mudam - exceto na montagem inicial,
  // ja coberta pelo loadDetail.
  const didMountTargetsFiltersRef = useRef(false);
  useEffect(() => {
    targetsFiltersRef.current = {
      pageSize: targetsPageSize,
      status: targetsStatusFilter,
      search: deferredTargetsSearch.trim(),
      sortField: targetSorting.key === 'contact' ? 'display_name'
        : targetSorting.key === 'status' ? 'status'
          : targetSorting.key === 'step' ? 'current_step_index'
            : targetSorting.key === 'next' ? 'next_send_at'
              : targetSorting.key === 'last' ? 'last_attempt_at'
                : targetSorting.key === 'error' ? 'error_message' : 'created_at',
      sortAscending: targetSorting.direction === 'asc',
    };

    if (!didMountTargetsFiltersRef.current) {
      didMountTargetsFiltersRef.current = true;
      return;
    }

    void goToTargetsPage(1);
  }, [targetsPageSize, targetsStatusFilter, deferredTargetsSearch, targetSorting, goToTargetsPage]);

  // Atualizacao leve chamada quando a linha da campanha muda (worker roda um
  // tick por minuto): re-busca so os agregados baratos (contadores via RPC,
  // amostra de falhas, contagem de validacao pendente) e a pagina de
  // contatos que o usuario esta vendo agora - sem mexer no estado de
  // "loading" da tela nem resetar a paginacao, e sem toast em erro (e uma
  // atualizacao em segundo plano, nao uma acao do usuario).
  const refreshLiveData = useCallback(async () => {
    if (!campaignId || activeCampaignIdRef.current !== campaignId) return;
    const screenGeneration = screenGenerationRef.current;
    if (screenGeneration === 0) return;
    // O worker pode atualizar a linha da campanha mais de uma vez num unico
    // ciclo (ex.: status "running" no inicio e contadores no fim do lote),
    // cada atualizacao dispara este callback via Realtime. Sem essas travas,
    // as chamadas se sobrepoem (entre si e com loadDetail, disparado apos
    // acoes como "Processar lote") e multiplicam as requisicoes exatamente
    // quando o banco esta mais ocupado gravando o lote, aumentando a chance
    // de estourar o timeout de 8s do cliente Supabase.
    if (loadDetailInFlightRef.current !== null || refreshLiveDataInFlightRef.current !== null) {
      pendingLiveRefreshRef.current = true;
      return;
    }
    if (pendingDetailReloadRef.current) return;
    const targetRequestId = targetListRequestIdRef.current + 1;
    targetListRequestIdRef.current = targetRequestId;
    const metricsRequestId = liveMetricsRequestIdRef.current + 1;
    liveMetricsRequestIdRef.current = metricsRequestId;
    refreshLiveDataInFlightRef.current = metricsRequestId;
    pendingLiveRefreshRef.current = false;
    try {
      const targetsFilters = targetsFiltersRef.current;
      const results = await Promise.allSettled([
        commWhatsAppCampaignService.listCampaignTargets(campaignId, {
          page: targetsPageRef.current,
          pageSize: targetsFilters.pageSize,
          status: targetsFilters.status.length > 0 ? targetsFilters.status : undefined,
          search: targetsFilters.search || undefined,
          sortField: targetsFilters.sortField,
          sortAscending: targetsFilters.sortAscending,
        }),
        commWhatsAppCampaignService.getCampaignTargetStatusCounts(campaignId),
        commWhatsAppCampaignService.getCampaignFailureReasons(campaignId),
        commWhatsAppCampaignService.getPendingWhatsAppValidationCount(campaignId),
      ]);
      if (screenGeneration !== screenGenerationRef.current) return;
      const [targetsResult, statusCountsResult, failureReasonsResult, pendingValidationResult] = results;
      if (targetsResult.status === 'fulfilled' && targetRequestId === targetListRequestIdRef.current) {
        setTargets(targetsResult.value.targets);
        setTargetsTotal(targetsResult.value.total);
      }
      if (metricsRequestId === liveMetricsRequestIdRef.current) {
        if (statusCountsResult.status === 'fulfilled') setStatusCounts(statusCountsResult.value);
        if (failureReasonsResult.status === 'fulfilled') setFailureReasons(failureReasonsResult.value);
        if (pendingValidationResult.status === 'fulfilled') setPendingWhatsAppValidation(pendingValidationResult.value);
      }

      const failedResults = results.filter((result) => result.status === 'rejected');
      if (failedResults.length === 0) {
        setLiveRefreshError(null);
      } else {
        setLiveRefreshError('Alguns dados da atualização automática falharam; os demais continuam disponíveis.');
        console.warn('[WhatsAppCampaignDetailScreen] atualização parcial em segundo plano', results);
      }
    } catch (error) {
      if (
        screenGeneration === screenGenerationRef.current
        && activeCampaignIdRef.current === campaignId
        && metricsRequestId === liveMetricsRequestIdRef.current
      ) {
        console.error('[WhatsAppCampaignDetailScreen] falha na atualizacao em tempo real', error);
        setLiveRefreshError('A atualização automática falhou. Os dados exibidos podem estar desatualizados.');
      }
    } finally {
      if (refreshLiveDataInFlightRef.current === metricsRequestId) {
        refreshLiveDataInFlightRef.current = null;
        if (screenGeneration === screenGenerationRef.current && activeCampaignIdRef.current === campaignId) {
          if (pendingDetailReloadRef.current) {
            pendingDetailReloadRef.current = false;
            pendingLiveRefreshRef.current = false;
            setLoading(true);
            window.setTimeout(() => { void loadDetailRef.current?.(); }, 0);
          } else if (pendingLiveRefreshRef.current) {
            pendingLiveRefreshRef.current = false;
            window.setTimeout(() => { void refreshLiveDataRef.current?.(); }, 0);
          }
        }
      }
    }
  }, [campaignId]);

  refreshLiveDataRef.current = refreshLiveData;

  // A linha de comm_whatsapp_campaigns e atualizada pelo worker uma vez por
  // tick (a cada minuto) enquanto a campanha esta ativa - poucas escritas,
  // da pra assinar via Realtime sem risco de inundar o navegador. De
  // proposito NAO assina comm_whatsapp_campaign_targets: numa campanha
  // grande isso pode ter centenas/milhares de updates por minuto durante
  // envio ativo. Se o Realtime nao conectar (rede bloqueando websocket,
  // etc.), cai num polling de 20s como reserva.
  useEffect(() => {
    const screenGeneration = ++screenGenerationRef.current;
    activeCampaignIdRef.current = campaignId ?? null;

    if (!campaignId) {
      setIsLive(false);
      return;
    }

    let active = true;
    let pollIntervalId: number | null = null;

    const startPollingFallback = () => {
      if (pollIntervalId !== null) return;
      pollIntervalId = window.setInterval(() => { void refreshLiveData(); }, 20_000);
    };

    const fallbackTimeoutId = window.setTimeout(() => {
      if (active) startPollingFallback();
    }, 4_000);

    const unsubscribe = subscribeToCampaignChanges(campaignId, {
      onCampaign: (nextCampaign) => {
        if (!active) return;
        const hadLoadInFlight = loadDetailInFlightRef.current !== null;
        const hadRefreshInFlight = refreshLiveDataInFlightRef.current !== null;
        detailRequestIdRef.current += 1;
        targetListRequestIdRef.current += 1;
        liveMetricsRequestIdRef.current += 1;
        if (hadLoadInFlight || hadRefreshInFlight) pendingLiveRefreshRef.current = true;
        if (hadLoadInFlight) setLoading(false);
        setCampaign(nextCampaign);
        if (!hadLoadInFlight && !hadRefreshInFlight) void refreshLiveData();
      },
      onStatus: (status) => {
        if (!active) return;

        if (status === 'connected') {
          window.clearTimeout(fallbackTimeoutId);
          if (pollIntervalId !== null) {
            window.clearInterval(pollIntervalId);
            pollIntervalId = null;
          }
          setIsLive(true);
        }

        if (status === 'disconnected') {
          window.clearTimeout(fallbackTimeoutId);
          startPollingFallback();
          setIsLive(false);
        }
      },
    });
    void loadDetail();

    return () => {
      active = false;
      if (activeCampaignIdRef.current === campaignId) {
        activeCampaignIdRef.current = null;
      }
      if (screenGenerationRef.current === screenGeneration) {
        screenGenerationRef.current += 1;
      }
      detailRequestIdRef.current += 1;
      targetListRequestIdRef.current += 1;
      liveMetricsRequestIdRef.current += 1;
      loadDetailInFlightRef.current = null;
      refreshLiveDataInFlightRef.current = null;
      pendingDetailReloadRef.current = false;
      pendingLiveRefreshRef.current = false;
      window.clearTimeout(fallbackTimeoutId);
      if (pollIntervalId !== null) window.clearInterval(pollIntervalId);
      unsubscribe();
    };
  }, [campaignId, loadDetail, refreshLiveData]);

  const targetCounts = useMemo(() => {
    const counts: Record<CommWhatsAppCampaignTargetStatus, number> = {
      pending: 0,
      scheduled: 0,
      sending: 0,
      sent: 0,
      responded: 0,
      stopped: 0,
      failed: 0,
      invalid: 0,
      cancelled: 0,
    };
    for (const row of statusCounts) {
      if (row.status in counts) counts[row.status as CommWhatsAppCampaignTargetStatus] += row.total_count;
    }
    return counts;
  }, [statusCounts]);

  const respondedCount = useMemo(
    () => statusCounts.reduce((sum, row) => sum + (row.status === 'responded' ? row.total_count : row.responded_count), 0),
    [statusCounts],
  );

  const contactedCount = targetCounts.sent + respondedCount + targetCounts.failed + targetCounts.invalid + targetCounts.stopped;
  const conversionRate = contactedCount > 0 ? Math.round((respondedCount / contactedCount) * 1000) / 10 : 0;
  const failureRate = contactedCount > 0 ? Math.round(((targetCounts.failed + targetCounts.invalid) / contactedCount) * 1000) / 10 : 0;

  const groupedFailureReasons = useMemo(
    () => groupCampaignIssues(failureReasons),
    [failureReasons],
  );
  const topFailureReasons = groupedFailureReasons.slice(0, 5);

  const variantBreakdown = useMemo(() => {
    if (!campaign?.ab_test_enabled) return [];
    const byVariant: Record<'A' | 'B', { sent: number; responded: number }> = {
      A: { sent: 0, responded: 0 },
      B: { sent: 0, responded: 0 },
    };
    for (const row of statusCounts) {
      if (row.ab_variant !== 'A' && row.ab_variant !== 'B') continue;
      if (['sent', 'responded', 'failed', 'invalid', 'stopped'].includes(row.status)) byVariant[row.ab_variant].sent += row.total_count;
      if (row.status === 'responded') byVariant[row.ab_variant].responded += row.total_count;
    }
    return (['A', 'B'] as const).map((variant) => ({
      variant,
      sent: byVariant[variant].sent,
      responded: byVariant[variant].responded,
      rate: byVariant[variant].sent > 0 ? Math.round((byVariant[variant].responded / byVariant[variant].sent) * 1000) / 10 : 0,
    }));
  }, [statusCounts, campaign?.ab_test_enabled]);

  const runAction = async (action: 'pause' | 'resume' | 'cancel' | 'process') => {
    if (!campaign) return;
    const screenGeneration = screenGenerationRef.current;
    const campaignIdAtStart = campaign.id;
    setActionLoading(action);
    try {
      if (action === 'pause') {
        await commWhatsAppCampaignService.pauseCampaign(campaign.id);
        if (screenGeneration !== screenGenerationRef.current || activeCampaignIdRef.current !== campaignIdAtStart) return;
        toast.success('Disparo pausado.');
      } else if (action === 'resume') {
        await commWhatsAppCampaignService.resumeCampaign(campaign);
        if (screenGeneration !== screenGenerationRef.current || activeCampaignIdRef.current !== campaignIdAtStart) return;
        toast.success('Disparo retomado.');
      } else if (action === 'cancel') {
        await commWhatsAppCampaignService.cancelCampaign(campaign.id);
        if (screenGeneration !== screenGenerationRef.current || activeCampaignIdRef.current !== campaignIdAtStart) return;
        toast.success('Disparo cancelado.');
      } else {
        const result = await commWhatsAppCampaignService.processCampaign(campaign.id);
        if (screenGeneration !== screenGenerationRef.current || activeCampaignIdRef.current !== campaignIdAtStart) return;
        toast.success(`Lote processado: ${result.processed ?? 0} contato(s).`);
      }
      if (screenGeneration !== screenGenerationRef.current || activeCampaignIdRef.current !== campaignIdAtStart) return;
      await loadDetail();
    } catch (error) {
      if (screenGeneration === screenGenerationRef.current && activeCampaignIdRef.current === campaignIdAtStart) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível executar a ação.');
      }
    } finally {
      if (screenGeneration === screenGenerationRef.current && activeCampaignIdRef.current === campaignIdAtStart) {
        setActionLoading(null);
      }
    }
  };

  const campaignActions = campaign ? {
    secondary: [
      ...(['queued', 'running', 'scheduled'].includes(campaign.status)
        ? [{ label: 'Pausar', icon: PauseCircle, onClick: () => void runAction('pause'), loading: actionLoading === 'pause' }]
        : []),
      ...(['queued', 'running', 'scheduled', 'paused'].includes(campaign.status)
        ? [{ label: 'Processar lote', icon: Send, onClick: () => void runAction('process'), loading: actionLoading === 'process' }]
        : []),
    ],
    primary: campaign.status === 'paused'
      ? { label: 'Retomar', icon: PlayCircle, onClick: () => void runAction('resume'), loading: actionLoading === 'resume' }
      : undefined,
    destructive: ['draft', 'scheduled', 'queued', 'running', 'paused'].includes(campaign.status)
      ? { label: 'Cancelar', icon: Ban, onClick: () => void runAction('cancel'), loading: actionLoading === 'cancel' }
      : undefined,
  } : null;

  if (!campaignId) {
    return <div className="comm-terracotta comm-terracotta-campaigns panel-page-shell text-sm text-[var(--text-secondary)]">Disparo não informado.</div>;
  }

  return (
    <div className="comm-terracotta comm-terracotta-campaigns panel-page-shell space-y-5">
      <PageHeader
        eyebrow="Kifer Saúde / Campanhas"
        title={campaign?.name ?? 'Detalhe do disparo'}
        description="Resultados, público e envio de mensagens para esta campanha."
        descriptionPlacement="visible"
        actions={(
          <div className="comm-campaign-detail-header-actions flex flex-wrap items-center gap-2">
            <Button
              className="order-first whitespace-nowrap lg:order-last"
              disabled={!campaign}
              onClick={() => {
                if (campaign) navigate('/painel/disparos', { state: { campaignToEdit: campaign } });
              }}
            >
              <Pencil className="kds-control-icon" />
              Editar campanha
            </Button>
            <div className="flex items-center gap-2">
              {campaign && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--panel-text-muted)]">
                  <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[color:var(--success)] animate-pulse' : 'bg-[color:var(--panel-text-muted)]'}`} />
                  {isLive ? 'Atualizando automaticamente' : 'Atualizando a cada 20s'}
                </span>
              )}
              <ButtonGroup aria-label="Ações do disparo">
                <IconButton title="Voltar" aria-label="Voltar" onClick={() => navigate('/painel/disparos')}>
                  <ArrowLeft className="kds-control-icon" />
                </IconButton>
                <IconButton title="Atualizar" aria-label="Atualizar" loading={loading} onClick={() => void loadDetail()}>
                  <RefreshCw className="kds-control-icon" />
                </IconButton>
              </ButtonGroup>
            </div>
          </div>
        )}
      />

      {liveRefreshError && (
        <Alert
          tone="warning"
          title="Atualização automática indisponível"
          action={(
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void loadDetail()}
              loading={loading}
            >
              Atualizar agora
            </Button>
          )}
        >
          {liveRefreshError}
        </Alert>
      )}

      {loadError && (
        <Alert
          tone={loadError === 'all' ? 'danger' : 'warning'}
          title={loadError === 'all' ? 'Não foi possível carregar o detalhe completo.' : 'Alguns dados do disparo não foram carregados.'}
          action={(
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void loadDetail()}
              loading={loading}
            >
              Tentar novamente
            </Button>
          )}
        >
          Os dados disponíveis continuam visíveis. Nenhum contato ou campanha foi excluído.
        </Alert>
      )}

      {loading && !campaign ? (
        <Card className="h-48 animate-pulse" />
      ) : campaign ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard padding="sm" title="Destinatários" value={campaign.total_targets || targetsTotal} />
            <KpiCard padding="sm" title="Pendentes" value={targetCounts.pending + targetCounts.scheduled + targetCounts.sending} />
            <KpiCard padding="sm" title="Enviadas" value={targetCounts.sent} />
            <KpiCard padding="sm" title="Responderam" value={respondedCount} />
          </div>

          <div className="grid gap-3 xl:grid-cols-5">
            <Card className="comm-campaign-toolbar space-y-3 xl:col-span-3">
                <SectionHeader
                  title="Status do disparo"
                  description="Etapa atual e andamento das mensagens."
                  action={<Badge tone={campaignStatusTones[campaign.status]}>{campaignStatusLabels[campaign.status]}</Badge>}
                />
                <dl className="divide-y divide-[color:var(--panel-border-subtle)]">
                  <CampaignFact label="Programação" value={campaign.scheduled_at ? formatDateTime(campaign.scheduled_at) : 'Sem agendamento definido'} />
                  <CampaignFact
                    label="Enviados"
                    value={`${targetCounts.sent.toLocaleString('pt-BR')} contato(s)`}
                    detail={`${(targetCounts.pending + targetCounts.scheduled + targetCounts.sending).toLocaleString('pt-BR')} ainda na fila`}
                  />
                  <CampaignFact
                    label="Respostas"
                    value={`${respondedCount.toLocaleString('pt-BR')} contato(s)`}
                    detail={`${conversionRate}% dos contatos com tentativa`}
                  />
                </dl>
                {campaignActions && (
                  <PageActions
                    secondary={campaignActions.secondary}
                    primary={campaignActions.primary}
                    destructive={campaignActions.destructive}
                    busy={Boolean(actionLoading)}
                  />
                )}
            </Card>

            <Card className="comm-campaign-toolbar space-y-3 xl:col-span-2">
                <SectionHeader
                  title="Público selecionado"
                  description="Origem e condições de envio desta campanha."
                  action={<Badge tone="neutral">{audienceSourceLabels[campaign.audience_source]}</Badge>}
                />
                <dl className="divide-y divide-[color:var(--panel-border-subtle)]">
                  <CampaignFact label="Contatos selecionados" value={`${(campaign.total_targets || targetsTotal).toLocaleString('pt-BR')} contato(s)`} />
                  <CampaignFact label="Janela de envio" value={formatWindow(campaign)} />
                  <CampaignFact
                    label="Intervalo por contato"
                    value={formatContactInterval(computeContactIntervalMinutes(campaign.contact_interval_minutes, campaign.daily_send_limit, campaign.send_window_start, campaign.send_window_end, campaign.total_targets))}
                  />
                </dl>
            </Card>
          </div>

          {pendingWhatsAppValidation > 0 && (
            <Card className="flex items-center gap-3 border border-[color:var(--panel-border)] bg-[color:var(--panel-surface-muted)] px-4 py-3">
              <Badge tone="info">Validando</Badge>
              <Text className="text-sm text-[color:var(--panel-text-soft)]">
                {pendingWhatsAppValidation.toLocaleString('pt-BR')} contato(s) aguardando confirmação de que o número tem WhatsApp antes de entrar na fila de envio. Isso roda em segundo plano; números sem WhatsApp são marcados como inválidos automaticamente.
              </Text>
            </Card>
          )}

          <Card className="space-y-4">
            <SectionHeader
              title="Relatório"
              description="Veja os resultados e o que precisa ser conferido antes de continuar os envios."
              action={(
                <Badge tone={targetCounts.failed + targetCounts.invalid > 0 ? 'danger' : 'neutral'}>
                  {(targetCounts.failed + targetCounts.invalid).toLocaleString('pt-BR')} com atenção
                </Badge>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Taxa de resposta" value={`${conversionRate}%`} />
              <Metric label="Taxa de falha" value={`${failureRate}%`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Heading level={3} className="text-sm font-semibold text-[color:var(--panel-text)]">O que precisa de atenção</Heading>
                {groupedFailureReasons.length > 5 && (
                  <Text className="text-xs text-[color:var(--panel-text-muted)]">Mostrando os 5 mais comuns de {groupedFailureReasons.length} motivo(s) distintos.</Text>
                )}
                {topFailureReasons.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {topFailureReasons.map(({ reason, count, details }) => (
                      <li key={reason} className="flex items-start justify-between gap-3 rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] p-2 text-sm">
                        <CampaignIssueNotice reason={reason} details={details} />
                        <Badge tone="danger" size="sm">{count}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text className="mt-2 text-sm text-[color:var(--panel-text-muted)]">Nenhuma falha registrada.</Text>
                )}
              </div>
              {campaign.ab_test_enabled && (
                <div>
                  <Heading level={3} className="text-sm font-semibold text-[color:var(--panel-text)]">Teste A/B - resposta por variante</Heading>
                  <div className="mt-2 space-y-2">
                    {variantBreakdown.map((row) => (
                      <div key={row.variant} className="flex items-center justify-between gap-3 rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] p-2 text-sm">
                        <span className="text-[color:var(--panel-text-soft)]">Variante {row.variant}</span>
                        <span className="text-[color:var(--panel-text-muted)]">{row.responded}/{row.sent} respostas</span>
                        <Badge tone="accent" size="sm">{row.rate}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Heading level={2} className="text-lg font-semibold text-[color:var(--panel-text)]">Contatos da campanha</Heading>
                <Text className="text-sm text-[color:var(--panel-text-soft)]">
                  {targetsTotal > 0
                    ? `Mostrando ${(targetsPage - 1) * targetsPageSize + 1}-${Math.min(targetsPage * targetsPageSize, targetsTotal)} de ${targetsTotal.toLocaleString('pt-BR')} contato(s).`
                    : 'Nenhum contato nesta lista.'}
                </Text>
              </div>
              <Users className="h-5 w-5 text-[color:var(--panel-accent-strong)]" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="sm:max-w-xs sm:flex-1">
                <Input
                  type="text"
                  leftIcon={Search}
                  placeholder="Buscar por nome ou telefone..."
                  value={targetsSearch}
                  onChange={(event) => setTargetsSearch(event.target.value)}
                />
              </div>
              <div className="sm:w-64">
                <FilterMultiSelect
                  icon={Filter}
                  options={targetStatusFilterOptions}
                  placeholder="Todos os status"
                  dialogTitle="Filtrar alvos por status"
                  values={targetsStatusFilter}
                  onChange={(values) => setTargetsStatusFilter(values as CommWhatsAppCampaignTargetStatus[])}
                />
              </div>
            </div>
            <div className="grid gap-3 lg:hidden">
                {targets.map((target) => (
                <Card key={target.id} className="space-y-3 bg-[color:var(--panel-surface-soft)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Text className="font-medium text-[var(--text-primary)]">{getCampaignTargetDisplayName(target)}</Text>
                      <Text className="text-xs text-[var(--text-muted)]">{target.phone_number || target.phone_digits}</Text>
                    </div>
                    <Badge tone={targetStatusTones[target.status]}>{targetStatusLabels[target.status]}</Badge>
                  </div>
                  <div className="grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                    <Info label="Etapa" value={String(target.current_step_index + 1)} />
                    <Info label="Próximo envio" value={formatDateTime(target.next_send_at)} />
                    <Info label="Última tentativa" value={formatDateTime(target.last_attempt_at)} />
                  </div>
                  {target.error_message && <CampaignIssueNotice reason={target.error_message} />}
                </Card>
              ))}
              {targets.length === 0 && <EmptyState title="Nenhum contato nesta lista." />}
            </div>
            <div className="hidden lg:block">
              <Table size="sm" columnWidths={['24%', '12%', '7%', '16%', '16%', '25%']} className={`min-w-[70rem] transition-opacity ${loadingTargetsPage ? 'opacity-60' : ''}`}>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Contato" sortDirection={targetSorting.key === "contact" ? targetSorting.direction : null} onSort={() => sortTargetsBy("contact")} />
                    <SortableTableHead label="Status" sortDirection={targetSorting.key === "status" ? targetSorting.direction : null} onSort={() => sortTargetsBy("status")} />
                    <SortableTableHead label="Etapa" sortDirection={targetSorting.key === "step" ? targetSorting.direction : null} onSort={() => sortTargetsBy("step")} />
                    <SortableTableHead label="Próximo envio" sortDirection={targetSorting.key === "next" ? targetSorting.direction : null} onSort={() => sortTargetsBy("next")} />
                    <SortableTableHead label="Última tentativa" sortDirection={targetSorting.key === "last" ? targetSorting.direction : null} onSort={() => sortTargetsBy("last")} />
                    <SortableTableHead label="O que fazer" sortDirection={targetSorting.key === "error" ? targetSorting.direction : null} onSort={() => sortTargetsBy("error")} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((target) => (
                    <TableRow key={target.id} className="align-top">
                      <TableCell>
                        <Text className="font-medium text-[var(--text-primary)]">{getCampaignTargetDisplayName(target)}</Text>
                        <Text className="text-xs text-[var(--text-muted)]">{target.phone_number || target.phone_digits}</Text>
                      </TableCell>
                      <TableCell><Badge tone={targetStatusTones[target.status]}>{targetStatusLabels[target.status]}</Badge></TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{target.current_step_index + 1}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{formatDateTime(target.next_send_at)}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{formatDateTime(target.last_attempt_at)}</TableCell>
                      <TableCell className="max-w-xs text-xs text-[var(--text-muted)]"><CampaignIssueNotice reason={target.error_message} /></TableCell>
                    </TableRow>
                  ))}
                  {targets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}><EmptyState title="Nenhum contato nesta lista." /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {targetsTotal > 0 && (
              <Pagination
                currentPage={targetsPage}
                totalPages={Math.max(Math.ceil(targetsTotal / targetsPageSize), 1)}
                itemsPerPage={targetsPageSize}
                totalItems={targetsTotal}
                onPageChange={(page) => void goToTargetsPage(page)}
                onItemsPerPageChange={(pageSize) => setTargetsPageSize(pageSize)}
              />
            )}
          </Card>
        </>
      ) : (
        <Card className="p-6 text-sm text-[color:var(--panel-text-soft)]">Disparo não encontrado.</Card>
      )}
    </div>
  );
}

function CampaignFact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium text-[color:var(--panel-text-muted)]">{label}</dt>
      <dd className="min-w-0 sm:text-right">
        <Text className="text-sm font-medium text-[color:var(--panel-text)]">{value}</Text>
        {detail && <Text className="text-xs text-[color:var(--panel-text-muted)]">{detail}</Text>}
      </dd>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</Text>
      <Text className="mt-1 text-sm text-[color:var(--panel-text)]">{value}</Text>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</Text>
      <Text className="mt-2 text-2xl font-semibold text-[color:var(--panel-text)]">{value}</Text>
    </Card>
  );
}
