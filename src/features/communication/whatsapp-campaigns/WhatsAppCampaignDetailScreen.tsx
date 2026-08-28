import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, BarChart3, PauseCircle, PlayCircle, RefreshCw, Send, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import '../communicationTerracotta.css';
import { Badge, Button, Card, EmptyState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../design-system';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';
import {
  commWhatsAppCampaignService,
  computeAdmissionIntervalMinutes,
  formatAdmissionInterval,
  type CommWhatsAppCampaign,
  type CommWhatsAppCampaignTarget,
  type CommWhatsAppCampaignTargetStatus,
} from './commWhatsAppCampaignService';

const campaignStatusLabels: Record<CommWhatsAppCampaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  queued: 'Na fila',
  running: 'Rodando',
  paused: 'Pausado',
  completed: 'Concluido',
  cancelled: 'Cancelado',
};

const targetStatusLabels: Record<CommWhatsAppCampaignTargetStatus, string> = {
  pending: 'Pendente',
  scheduled: 'Agendado',
  sending: 'Enviando',
  sent: 'Enviado',
  responded: 'Respondeu',
  stopped: 'Bloqueado',
  failed: 'Falhou',
  invalid: 'Invalido',
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

const TARGETS_PAGE_SIZE = 50;

export default function WhatsAppCampaignDetailScreen() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CommWhatsAppCampaign | null>(null);
  const [targets, setTargets] = useState<CommWhatsAppCampaignTarget[]>([]);
  const [targetsTotal, setTargetsTotal] = useState(0);
  const [targetsPage, setTargetsPage] = useState(0);
  const [loadingTargetsPage, setLoadingTargetsPage] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Array<{ status: string; ab_variant: 'A' | 'B' | null; total_count: number; responded_count: number }>>([]);
  const [failureSample, setFailureSample] = useState<Array<{ error_message: string | null }>>([]);
  const [pendingWhatsAppValidation, setPendingWhatsAppValidation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const targetsPageRef = useRef(0);

  const loadDetail = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [nextCampaign, nextTargets, nextStatusCounts, nextFailureSample, nextPendingValidation] = await Promise.all([
        commWhatsAppCampaignService.getCampaign(campaignId),
        commWhatsAppCampaignService.listCampaignTargets(campaignId, { page: 0, pageSize: TARGETS_PAGE_SIZE }),
        commWhatsAppCampaignService.getCampaignTargetStatusCounts(campaignId),
        commWhatsAppCampaignService.getCampaignFailureSample(campaignId),
        commWhatsAppCampaignService.getPendingWhatsAppValidationCount(campaignId),
      ]);
      setCampaign(nextCampaign);
      setTargets(nextTargets.targets);
      setTargetsTotal(nextTargets.total);
      setTargetsPage(0);
      targetsPageRef.current = 0;
      setStatusCounts(nextStatusCounts);
      setFailureSample(nextFailureSample);
      setPendingWhatsAppValidation(nextPendingValidation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar o detalhe do disparo.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const goToTargetsPage = useCallback(async (page: number) => {
    if (!campaignId || page < 0) return;
    setLoadingTargetsPage(true);
    try {
      const result = await commWhatsAppCampaignService.listCampaignTargets(campaignId, { page, pageSize: TARGETS_PAGE_SIZE });
      setTargets(result.targets);
      setTargetsTotal(result.total);
      setTargetsPage(page);
      targetsPageRef.current = page;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar esta pagina de contatos.');
    } finally {
      setLoadingTargetsPage(false);
    }
  }, [campaignId]);

  // Atualizacao leve chamada quando a linha da campanha muda (worker roda um
  // tick por minuto): re-busca so os agregados baratos (contadores via RPC,
  // amostra de falhas, contagem de validacao pendente) e a pagina de
  // contatos que o usuario esta vendo agora - sem mexer no estado de
  // "loading" da tela nem resetar a paginacao, e sem toast em erro (e uma
  // atualizacao em segundo plano, nao uma acao do usuario).
  const refreshLiveData = useCallback(async () => {
    if (!campaignId) return;
    try {
      const [nextTargets, nextStatusCounts, nextFailureSample, nextPendingValidation] = await Promise.all([
        commWhatsAppCampaignService.listCampaignTargets(campaignId, { page: targetsPageRef.current, pageSize: TARGETS_PAGE_SIZE }),
        commWhatsAppCampaignService.getCampaignTargetStatusCounts(campaignId),
        commWhatsAppCampaignService.getCampaignFailureSample(campaignId),
        commWhatsAppCampaignService.getPendingWhatsAppValidationCount(campaignId),
      ]);
      setTargets(nextTargets.targets);
      setTargetsTotal(nextTargets.total);
      setStatusCounts(nextStatusCounts);
      setFailureSample(nextFailureSample);
      setPendingWhatsAppValidation(nextPendingValidation);
    } catch (error) {
      console.error('[WhatsAppCampaignDetailScreen] falha na atualizacao em tempo real', error);
    }
  }, [campaignId]);

  // A linha de comm_whatsapp_campaigns e atualizada pelo worker uma vez por
  // tick (a cada minuto) enquanto a campanha esta ativa - poucas escritas,
  // da pra assinar via Realtime sem risco de inundar o navegador. De
  // proposito NAO assina comm_whatsapp_campaign_targets: numa campanha
  // grande isso pode ter centenas/milhares de updates por minuto durante
  // envio ativo. Se o Realtime nao conectar (rede bloqueando websocket,
  // etc.), cai num polling de 20s como reserva.
  useEffect(() => {
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

    const channel = supabase
      .channel(`comm-whatsapp-campaign-${campaignId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comm_whatsapp_campaigns', filter: `id=eq.${campaignId}` },
        (payload) => {
          if (!active) return;
          setCampaign(payload.new as CommWhatsAppCampaign);
          void refreshLiveData();
        },
      )
      .subscribe((status) => {
        if (!active) return;

        if (status === 'SUBSCRIBED') {
          window.clearTimeout(fallbackTimeoutId);
          if (pollIntervalId !== null) {
            window.clearInterval(pollIntervalId);
            pollIntervalId = null;
          }
          setIsLive(true);
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          window.clearTimeout(fallbackTimeoutId);
          startPollingFallback();
          setIsLive(false);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(fallbackTimeoutId);
      if (pollIntervalId !== null) window.clearInterval(pollIntervalId);
      void supabase.removeChannel(channel);
    };
  }, [campaignId, refreshLiveData]);

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

  const topFailureReasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of failureSample) {
      const reason = row.error_message?.trim() || 'Sem motivo registrado';
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [failureSample]);

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
    setActionLoading(action);
    try {
      if (action === 'pause') {
        await commWhatsAppCampaignService.pauseCampaign(campaign.id);
        toast.success('Disparo pausado.');
      } else if (action === 'resume') {
        await commWhatsAppCampaignService.resumeCampaign(campaign);
        toast.success('Disparo retomado.');
      } else if (action === 'cancel') {
        await commWhatsAppCampaignService.cancelCampaign(campaign.id);
        toast.success('Disparo cancelado.');
      } else {
        const result = await commWhatsAppCampaignService.processCampaign(campaign.id);
        toast.success(`Lote processado: ${result.processed ?? 0} contato(s).`);
      }
      await loadDetail();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel executar a acao.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!campaignId) {
    return <div className="comm-terracotta comm-terracotta-campaigns panel-page-shell text-sm text-[var(--text-secondary)]">Disparo nao informado.</div>;
  }

  return (
    <div className="comm-terracotta comm-terracotta-campaigns panel-page-shell space-y-5">
      <PageHeader
        title={campaign?.name ?? 'Detalhe do disparo'}
        description="Acompanhe contatos, status da fila, proximos envios e acoes operacionais da campanha."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {campaign && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--panel-text-muted)]">
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-[color:var(--panel-text-muted)]'}`} />
                {isLive ? 'Atualizando automaticamente' : 'Atualizando a cada 20s'}
              </span>
            )}
            <Button variant="secondary" className="whitespace-nowrap" onClick={() => navigate('/painel/disparos')}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button variant="secondary" className="whitespace-nowrap" loading={loading} onClick={() => void loadDetail()}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        )}
      />

      {loading && !campaign ? (
        <Card className="h-48 animate-pulse" />
      ) : campaign ? (
        <>
          <Card className="comm-campaign-toolbar space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{campaignStatusLabels[campaign.status]}</Badge>
                  <Badge tone="neutral">{campaign.audience_source.toUpperCase()}</Badge>
                  <Badge tone="neutral">{formatAdmissionInterval(computeAdmissionIntervalMinutes(campaign.daily_send_limit, campaign.send_window_start, campaign.send_window_end))}</Badge>
                </div>
                <div className="grid gap-3 text-sm text-[color:var(--panel-text-soft)] sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Agendado" value={formatDateTime(campaign.scheduled_at)} />
                  <Info label="Janela" value={formatWindow(campaign)} />
                  <Info label="Criado" value={formatDateTime(campaign.created_at)} />
                  <Info label="Atualizado" value={formatDateTime(campaign.updated_at)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['queued', 'running', 'scheduled'].includes(campaign.status) && (
                  <Button variant="secondary" className="whitespace-nowrap" loading={actionLoading === 'pause'} onClick={() => void runAction('pause')}>
                    <PauseCircle className="h-4 w-4" />
                    Pausar
                  </Button>
                )}
                {campaign.status === 'paused' && (
                  <Button variant="primary" className="whitespace-nowrap" loading={actionLoading === 'resume'} onClick={() => void runAction('resume')}>
                    <PlayCircle className="h-4 w-4" />
                    Retomar
                  </Button>
                )}
                {['queued', 'running', 'scheduled', 'paused'].includes(campaign.status) && (
                  <Button variant="secondary" className="whitespace-nowrap" loading={actionLoading === 'process'} onClick={() => void runAction('process')}>
                    <Send className="h-4 w-4" />
                    Processar lote
                  </Button>
                )}
                {['draft', 'scheduled', 'queued', 'running', 'paused'].includes(campaign.status) && (
                  <Button variant="danger" className="whitespace-nowrap" loading={actionLoading === 'cancel'} onClick={() => void runAction('cancel')}>
                    <Ban className="h-4 w-4" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Total" value={campaign.total_targets || targetsTotal} />
            <Metric label="Pendentes" value={targetCounts.pending + targetCounts.scheduled + targetCounts.sending} />
            <Metric label="Enviados" value={targetCounts.sent} />
            <Metric label="Responderam" value={respondedCount} />
            <Metric label="Falhas" value={targetCounts.failed + targetCounts.invalid} />
          </div>

          {pendingWhatsAppValidation > 0 && (
            <Card className="flex items-center gap-3 border border-[color:var(--panel-border)] bg-[color:var(--panel-surface-muted)] px-4 py-3">
              <Badge tone="info">Validando</Badge>
              <p className="text-sm text-[color:var(--panel-text-soft)]">
                {pendingWhatsAppValidation.toLocaleString('pt-BR')} contato(s) aguardando confirmacao de que o numero tem WhatsApp antes de entrar na fila de envio. Isso roda em segundo plano; numeros sem WhatsApp sao marcados como invalidos automaticamente.
              </p>
            </Card>
          )}

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Relatorio</h2>
                <p className="text-sm text-[color:var(--panel-text-soft)]">Taxas e principais motivos de falha entre os contatos ja processados.</p>
              </div>
              <BarChart3 className="h-5 w-5 text-[color:var(--panel-accent-strong)]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Taxa de resposta" value={`${conversionRate}%`} />
              <Metric label="Taxa de falha" value={`${failureRate}%`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Principais motivos de falha</h3>
                {failureSample.length >= 500 && (targetCounts.failed + targetCounts.invalid) > failureSample.length && (
                  <p className="text-xs text-[color:var(--panel-text-muted)]">Baseado nas 500 falhas mais recentes.</p>
                )}
                {topFailureReasons.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {topFailureReasons.map(([reason, count]) => (
                      <li key={reason} className="flex items-start justify-between gap-3 rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] p-2 text-sm">
                        <span className="text-[color:var(--panel-text-soft)]">{reason}</span>
                        <Badge tone="danger" size="sm">{count}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--panel-text-muted)]">Nenhuma falha registrada.</p>
                )}
              </div>
              {campaign.ab_test_enabled && (
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--panel-text)]">Teste A/B - resposta por variante</h3>
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
                <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Contatos da campanha</h2>
                <p className="text-sm text-[color:var(--panel-text-soft)]">
                  {targetsTotal > 0
                    ? `Mostrando ${targetsPage * TARGETS_PAGE_SIZE + 1}-${Math.min((targetsPage + 1) * TARGETS_PAGE_SIZE, targetsTotal)} de ${targetsTotal.toLocaleString('pt-BR')} contato(s).`
                    : 'Nenhum contato materializado ainda.'}
                </p>
              </div>
              <Users className="h-5 w-5 text-[color:var(--panel-accent-strong)]" />
            </div>
            <Table size="sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Proximo envio</TableHead>
                    <TableHead>Ultima tentativa</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((target) => (
                    <TableRow key={target.id} className="align-top">
                      <TableCell>
                        <p className="font-medium text-[var(--text-primary)]">{target.display_name || target.phone_number}</p>
                        <p className="text-xs text-[var(--text-muted)]">{target.phone_number || target.phone_digits}</p>
                      </TableCell>
                      <TableCell><Badge tone={targetStatusTones[target.status]}>{targetStatusLabels[target.status]}</Badge></TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{target.current_step_index + 1}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{formatDateTime(target.next_send_at)}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{formatDateTime(target.last_attempt_at)}</TableCell>
                      <TableCell className="max-w-xs text-xs text-[var(--text-muted)]">{target.error_message || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {targets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}><EmptyState title="Nenhum contato materializado ainda." /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
            </Table>
            {targetsTotal > TARGETS_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[color:var(--panel-text-muted)]">
                  Pagina {targetsPage + 1} de {Math.max(Math.ceil(targetsTotal / TARGETS_PAGE_SIZE), 1)}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={targetsPage === 0 || loadingTargetsPage}
                    onClick={() => void goToTargetsPage(targetsPage - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={loadingTargetsPage}
                    disabled={(targetsPage + 1) * TARGETS_PAGE_SIZE >= targetsTotal}
                    onClick={() => void goToTargetsPage(targetsPage + 1)}
                  >
                    Proxima
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card className="p-6 text-sm text-[color:var(--panel-text-soft)]">Disparo nao encontrado.</Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[color:var(--panel-text)]">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--panel-text)]">{value}</p>
    </Card>
  );
}
