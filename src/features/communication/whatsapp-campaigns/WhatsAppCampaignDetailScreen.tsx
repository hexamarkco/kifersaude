import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Ban, PauseCircle, PlayCircle, RefreshCw, Send, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Badge, Button, Card, EmptyState, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../design-system';
import { toast } from '../../../lib/toast';
import {
  commWhatsAppCampaignService,
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

const formatWindow = (campaign: CommWhatsAppCampaign) => {
  if (!campaign.send_window_start || !campaign.send_window_end) return 'Sem janela definida';
  return `${campaign.send_window_start.slice(0, 5)} - ${campaign.send_window_end.slice(0, 5)}`;
};

export default function WhatsAppCampaignDetailScreen() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CommWhatsAppCampaign | null>(null);
  const [targets, setTargets] = useState<CommWhatsAppCampaignTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [nextCampaign, nextTargets] = await Promise.all([
        commWhatsAppCampaignService.getCampaign(campaignId),
        commWhatsAppCampaignService.listCampaignTargets(campaignId),
      ]);
      setCampaign(nextCampaign);
      setTargets(nextTargets);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar o detalhe do disparo.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

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
    for (const target of targets) counts[target.status] += 1;
    return counts;
  }, [targets]);

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
    return <div className="panel-page-shell text-sm text-[var(--text-secondary)]">Disparo nao informado.</div>;
  }

  return (
    <div className="panel-page-shell space-y-6">
      <PageHeader
        title={campaign?.name ?? 'Detalhe do disparo'}
        description="Acompanhe contatos, status da fila, proximos envios e acoes operacionais da campanha."
        actions={(
          <div className="flex flex-wrap gap-2">
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
          <Card className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{campaignStatusLabels[campaign.status]}</Badge>
                  <Badge tone="neutral">{campaign.audience_source.toUpperCase()}</Badge>
                  <Badge tone="neutral">{campaign.pacing_per_minute}/min</Badge>
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
            <Metric label="Total" value={campaign.total_targets || targets.length} />
            <Metric label="Pendentes" value={targetCounts.pending + targetCounts.scheduled + targetCounts.sending} />
            <Metric label="Enviados" value={targetCounts.sent} />
            <Metric label="Responderam" value={targetCounts.responded} />
            <Metric label="Falhas" value={targetCounts.failed + targetCounts.invalid} />
          </div>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Contatos da campanha</h2>
                <p className="text-sm text-[color:var(--panel-text-soft)]">Mostrando ate 500 contatos por enquanto.</p>
              </div>
              <Users className="h-5 w-5 text-[color:var(--panel-accent)]" />
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--panel-text)]">{value}</p>
    </Card>
  );
}
