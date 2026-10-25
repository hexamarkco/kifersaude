import { Heading, Text } from '../../../../design-system';
import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Send } from 'lucide-react';
import { Badge, Card, OperationalMetricChip, Surface } from '../../../../design-system';
import type { CommWhatsAppCampaignWorkerHealth, CommWhatsAppCampaignWorkerRun } from '../commWhatsAppCampaignService';

type Props = {
  health: CommWhatsAppCampaignWorkerHealth;
  available: boolean;
  loading: boolean;
};

const sourceLabels: Record<CommWhatsAppCampaignWorkerRun['source'], string> = {
  cron: 'Verificação automática',
  manual: 'Solicitação manual',
  dashboard: 'Ação pelo painel',
  api: 'Integração com outro sistema',
};

const statusLabels: Record<CommWhatsAppCampaignWorkerRun['status'], string> = {
  running: 'Em andamento',
  success: 'Concluída',
  failed: 'Com problema',
};

const formatCheckTime = (value: string | null | undefined, now: number) => {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return 'Sem registro de horário';
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return `há ${Math.floor(minutes / 1440)} dia(s)`;
};

const getStatus = ({ health, available, loading }: Props, now: number) => {
  const run = health.latestRun;
  if (loading && !run) return { tone: 'neutral' as const, label: 'Consultando', description: 'Buscando a última atualização dos envios automáticos.' };
  if (!available) return { tone: 'warning' as const, label: 'Consulta indisponível', description: 'Não foi possível consultar o andamento. Atualize a página; se o problema continuar, avise o responsável pelo sistema.' };
  if (!run) return { tone: 'neutral' as const, label: 'Aguardando atualização', description: 'Ainda não há verificações registradas. O andamento aparecerá aqui após a primeira verificação automática.' };
  if (run.status === 'failed' || run.failed > 0) return { tone: 'danger' as const, label: 'Precisa de atenção', description: 'A última verificação encontrou um problema. Confira as campanhas e os contatos com falha antes de tentar um novo envio.' };
  const checkedAt = Date.parse(run.finished_at || run.started_at);
  if (!Number.isFinite(checkedAt) || now - checkedAt > 10 * 60_000) return { tone: 'warning' as const, label: 'Atualização atrasada', description: 'Não há uma verificação recente confirmada. Atualize a página; se continuar assim, avise o responsável pelo sistema.' };
  if (run.status === 'running') return { tone: 'accent' as const, label: 'Verificando campanhas', description: 'O sistema está conferindo quais contatos podem receber as próximas mensagens.' };
  if (run.status !== 'success') return { tone: 'neutral' as const, label: 'Situação não confirmada', description: 'Não foi possível interpretar a última verificação. Peça ajuda ao responsável pelo sistema.' };
  return { tone: 'success' as const, label: 'Verificação concluída', description: 'Os envios seguem os horários e limites de cada campanha. O sistema verifica automaticamente quando pode continuar.' };
};

export function CampaignDeliveryStatusCard(props: Props) {
  const { health, available } = props;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const status = getStatus(props, now);
  return (
    <Card className="comm-campaign-toolbar space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-5 w-5 text-[color:var(--panel-accent-strong)]" aria-hidden="true" />
            <Heading level={2} className="text-lg font-semibold text-[color:var(--panel-text)]">Envios automáticos</Heading>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <Text className="max-w-2xl text-sm text-[color:var(--panel-text-soft)]">{status.description}</Text>
          {health.latestRun && available && (
            <Text className="text-xs text-[color:var(--panel-text-muted)]">Última verificação: {formatCheckTime(health.latestRun.finished_at || health.latestRun.started_at, now)}.</Text>
          )}
        </div>
        {health.latestRun && available && (
          <div className="grid shrink-0 gap-2 sm:grid-cols-3" aria-label="Resultado da última verificação">
            <OperationalMetricChip icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />} label="contatos analisados" value={health.latestRun.processed} />
            <OperationalMetricChip icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />} label="com envio concluído" value={health.latestRun.sent} tone="success" />
            <OperationalMetricChip icon={<AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />} label="com falha" value={health.latestRun.failed} tone={health.latestRun.failed > 0 ? 'danger' : 'neutral'} />
          </div>
        )}
      </div>
      {available && (health.recentRuns.length > 0 || health.latestFailure) && (
        <details className="border-t border-[color:var(--panel-border-subtle)] pt-3">
          <summary className="cursor-pointer text-sm font-medium text-[color:var(--panel-text)]">Ver histórico de verificações</summary>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {health.recentRuns.slice(0, 3).map((run) => (
              <Surface key={run.id} variant="muted" padding="sm" className="min-w-0 space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{sourceLabels[run.source] || 'Verificação registrada'}</span>
                  <Badge tone={run.status === 'failed' || run.failed > 0 ? 'danger' : run.status === 'running' ? 'accent' : 'neutral'} size="sm">{statusLabels[run.status] || 'Situação não confirmada'}</Badge>
                </div>
                <Text className="text-xs text-[color:var(--panel-text-muted)]">{run.action === 'activate' ? 'Início de campanha' : 'Verificação de envios'} · {formatCheckTime(run.finished_at || run.started_at, now)}</Text>
                <Text className="text-xs text-[color:var(--panel-text-soft)]">{run.processed} contato(s) analisado(s) · {run.sent} com envio concluído · {run.failed} com falha</Text>
              </Surface>
            ))}
          </div>
          {health.latestFailure && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-[color:var(--panel-text-soft)]">Informações do último problema para o suporte</summary>
              <Text className="mt-2 break-words text-xs text-[color:var(--panel-text-muted)]">Registrado {formatCheckTime(health.latestFailure.finished_at || health.latestFailure.started_at, now)}. {health.latestFailure.error_message || 'Nenhum detalhe adicional foi registrado.'}</Text>
            </details>
          )}
        </details>
      )}
    </Card>
  );
}
