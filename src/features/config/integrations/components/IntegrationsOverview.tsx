import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Facebook, MessageCircle, ScanLine } from 'lucide-react';

import {
  ActionSurface,
  Alert,
  Badge,
  Button,
  Card,
  Heading,
  LoadingState,
  SectionHeader,
  Text,
} from '../../../../design-system';
import { formatConnectionStatusLabel } from '../../../communication/whatsapp';
import { loadMetaAds } from '../data/metaAdsApi';
import { loadWhatsAppChannelState, type ChannelAdminState } from '../data/integrationsApi';
import { metaConnectionLabel, type MetaConnectionState } from '../domain/metaAds';

type IntegrationSection = 'ai' | 'whatsapp' | 'meta' | 'tracking';
type MetaOverview = MetaConnectionState & {
  pending: number;
  eventsPending: number;
  eventsFailed: number;
};

type OverviewState = {
  loading: boolean;
  whatsapp: ChannelAdminState | null;
  meta: MetaOverview | null;
  whatsappError: boolean;
  metaError: boolean;
};

type IntegrationsOverviewProps = {
  onOpen: (section: IntegrationSection) => void;
  trackingLoading: boolean;
  trackingError: boolean;
  pixelConfigured: boolean;
  gtmConfigured: boolean;
};

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Ainda não registrada';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}

function getWhatsAppStatus(channel: ChannelAdminState | null, failed: boolean): { label: string; description: string; tone: StatusTone } {
  if (failed) return { label: 'Não verificado', description: 'Não foi possível consultar a conexão agora.', tone: 'warning' };
  if (!channel) return { label: 'Verificando', description: 'Consultando a conexão do canal.', tone: 'neutral' };

  const status = channel.channel?.connection_status?.trim().toUpperCase();
  const label = formatConnectionStatusLabel(status, 'Indisponível');
  const tone: StatusTone = status === 'AUTH'
    ? 'success'
    : status === 'ERROR' || status === 'SYNC_ERROR' || status === 'STOP' || status === 'DISCONNECTED'
      ? 'danger'
      : 'warning';

  return {
    label: channel.config?.tokenConfigured === false ? 'Acesso pendente' : label,
    description: channel.config?.tokenConfigured === false
      ? 'A chave de acesso ainda precisa ser configurada pelo responsável do sistema.'
      : 'Conexão, autenticação e estabilidade do canal.',
    tone: channel.config?.tokenConfigured === false ? 'warning' : tone,
  };
}

function getMetaStatus(meta: MetaOverview | null, failed: boolean): { label: string; description: string; tone: StatusTone } {
  if (failed) return { label: 'Não verificado', description: 'Não foi possível consultar o recebimento agora.', tone: 'warning' };
  if (!meta) return { label: 'Verificando', description: 'Consultando o recebimento de formulários.', tone: 'neutral' };
  const connectionLabel = metaConnectionLabel(meta);
  if (connectionLabel === 'Configuração do servidor pendente') return { label: 'Configuração pendente', description: connectionLabel, tone: 'warning' };
  if (connectionLabel === 'Recebimento pausado') return { label: 'Pausado', description: connectionLabel, tone: 'neutral' };
  if (connectionLabel === 'Recebimento precisa de atenção') return { label: 'Precisa de atenção', description: connectionLabel, tone: 'danger' };
  if (connectionLabel === 'Aguardando primeiro lead importado') return { label: 'Aguardando dados', description: connectionLabel, tone: 'warning' };
  return { label: 'Ativo', description: connectionLabel, tone: 'success' };
}

function OverviewAction({
  title,
  description,
  label,
  tone,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  label: string;
  tone: StatusTone;
  icon: typeof MessageCircle;
  onClick: () => void;
}) {
  return (
    <ActionSurface
      variant="plain"
      padding="sm"
      className="kds-integration-overview-action flex w-full items-center justify-between gap-4 text-left"
      aria-label={`Abrir configuração: ${title}`}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-start gap-3">
        <Icon className="kds-control-icon mt-0.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{description}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Badge tone={tone} size="sm">{label}</Badge>
        <ArrowRight className="kds-control-icon text-[var(--text-secondary)]" aria-hidden="true" />
      </span>
    </ActionSurface>
  );
}

function StatusRow({ title, detail, label, tone }: { title: string; detail: string; label: string; tone: StatusTone }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Text className="text-sm font-medium text-[var(--text-primary)]">{title}</Text>
        <Text className="mt-0.5 text-xs text-[var(--text-secondary)]">{detail}</Text>
      </div>
      <Badge tone={tone} size="sm" className="w-fit shrink-0">{label}</Badge>
    </div>
  );
}

function getWebhookStatus(channel: ChannelAdminState | null): { label: string; detail: string; tone: StatusTone } {
  const diagnostics = channel?.config?.webhookDiagnostics;
  switch (diagnostics?.status) {
    case 'receiving_messages':
      return { label: 'Recebendo mensagens', detail: `Última mensagem: ${formatDate(diagnostics.lastInboundMessageAt)}`, tone: 'success' };
    case 'error':
      return { label: 'Com falha', detail: 'A última atualização do canal encontrou um erro.', tone: 'danger' };
    case 'message_event_missing':
      return { label: 'Evento ausente', detail: 'Ainda não foi confirmado evento de mensagem.', tone: 'warning' };
    case 'waiting_first_event':
      return { label: 'Aguardando evento', detail: 'O canal ainda não recebeu uma mensagem para diagnóstico.', tone: 'warning' };
    default:
      return { label: 'Não verificado', detail: 'Atualize a conexão para consultar o webhook.', tone: 'neutral' };
  }
}

function getQueueStatus(meta: MetaOverview | null, failed: boolean): { label: string; detail: string; tone: StatusTone } {
  if (failed || !meta) return { label: 'Não verificada', detail: 'A situação da fila ainda não está disponível.', tone: 'neutral' };
  const errors = meta.failed + meta.eventsFailed;
  const pending = meta.pending + meta.eventsPending;
  if (errors > 0) return { label: `${errors} com falha`, detail: 'Confira os detalhes na integração Meta Ads.', tone: 'danger' };
  if (pending > 0) return { label: `${pending} pendente(s)`, detail: 'Itens aguardando processamento.', tone: 'warning' };
  return { label: 'Sem pendências', detail: 'Não há registros aguardando processamento.', tone: 'success' };
}

export default function IntegrationsOverview({
  onOpen,
  trackingLoading,
  trackingError,
  pixelConfigured,
  gtmConfigured,
}: IntegrationsOverviewProps) {
  const requestId = useRef(0);
  const [state, setState] = useState<OverviewState>({
    loading: true,
    whatsapp: null,
    meta: null,
    whatsappError: false,
    metaError: false,
  });

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setState((current) => ({ ...current, loading: true }));
    const [whatsappResult, metaResult] = await Promise.allSettled([
      loadWhatsAppChannelState('getConfig'),
      loadMetaAds(),
    ]);
    if (currentRequest !== requestId.current) return;

    const metaSnapshot = metaResult.status === 'fulfilled' ? metaResult.value : null;
    setState({
      loading: false,
      whatsapp: whatsappResult.status === 'fulfilled' ? whatsappResult.value : null,
      whatsappError: whatsappResult.status === 'rejected',
      meta: metaSnapshot ? {
        serverConfigured: metaSnapshot.serverConfigured,
        settings: { enabled: metaSnapshot.settings.enabled },
        pending: metaSnapshot.pending,
        failed: metaSnapshot.failed,
        eventsPending: metaSnapshot.eventsPending,
        eventsFailed: metaSnapshot.eventsFailed,
        lastImportedAt: metaSnapshot.lastImportedAt,
      } : null,
      metaError: metaResult.status === 'rejected',
    });
  }, []);

  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  const whatsappStatus = getWhatsAppStatus(state.whatsapp, state.whatsappError);
  const metaStatus = getMetaStatus(state.meta, state.metaError);
  const trackingCount = Number(pixelConfigured) + Number(gtmConfigured);
  const trackingStatus: { label: string; description: string; tone: StatusTone } = trackingLoading
    ? { label: 'Verificando', description: 'Consultando os identificadores de rastreamento.', tone: 'neutral' }
    : trackingError
      ? { label: 'Verificação parcial', description: 'Não foi possível consultar todos os identificadores.', tone: 'warning' }
      : trackingCount === 2
        ? { label: 'Configurado', description: 'Meta Pixel e Google Tag Manager estão preenchidos.', tone: 'success' }
        : trackingCount === 1
          ? { label: 'Parcial', description: 'Um dos dois identificadores está preenchido.', tone: 'warning' }
          : { label: 'Pendente', description: 'Meta Pixel e Google Tag Manager ainda não estão preenchidos.', tone: 'neutral' };
  const webhookStatus = getWebhookStatus(state.whatsapp);
  const queueStatus = getQueueStatus(state.meta, state.metaError);
  const anyError = state.whatsappError || state.metaError;
  const lastSync = state.whatsapp?.channel?.last_health_check_at;
  const lastImport = state.meta?.lastImportedAt;

  return (
    <div className="space-y-4">
      {anyError && (
        <Alert
          tone="danger"
          title="Não foi possível consultar todas as integrações."
          action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>Tentar novamente</Button>}
        >
          Os dados que carregaram continuam disponíveis. Tente atualizar para consultar os demais canais.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-3">
          <SectionHeader
            title="Integrações conectadas"
            description="Acompanhe o estado dos canais usados pela operação."
            descriptionPlacement="visible"
          />
          {state.loading && !state.whatsapp && !state.meta ? (
            <LoadingState compact label="Consultando conexões" className="mt-4" />
          ) : (
            <div className="mt-3">
              <div className="border-b border-[var(--border-subtle)] last:border-b-0">
                <OverviewAction
                  title="WhatsApp"
                  description={whatsappStatus.description}
                  label={whatsappStatus.label}
                  tone={whatsappStatus.tone}
                  icon={MessageCircle}
                  onClick={() => onOpen('whatsapp')}
                />
              </div>
              <div className="border-b border-[var(--border-subtle)] last:border-b-0">
                <OverviewAction
                  title="Meta Ads"
                  description={metaStatus.description}
                  label={metaStatus.label}
                  tone={metaStatus.tone}
                  icon={Facebook}
                  onClick={() => onOpen('meta')}
                />
              </div>
              <div className="border-b border-[var(--border-subtle)] last:border-b-0">
                <OverviewAction
                  title="Rastreamento"
                  description={trackingStatus.description}
                  label={trackingStatus.label}
                  tone={trackingStatus.tone}
                  icon={ScanLine}
                  onClick={() => onOpen('tracking')}
                />
              </div>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <Heading level={3} className="text-base font-semibold text-[var(--text-primary)]">Conexão e credenciais</Heading>
          <Alert tone="warning" className="mt-3">
            Tokens e chaves privadas ficam protegidos no servidor e não são exibidos no CRM.
          </Alert>
          <div className="mt-2">
            <StatusRow
              title="Acesso ao WhatsApp"
              detail={state.loading && !state.whatsapp ? 'Consultando credenciais do canal.' : 'Chave usada para consultar o canal.'}
              label={state.loading && !state.whatsapp ? 'Verificando' : state.whatsapp?.config?.tokenConfigured ? 'Protegido' : state.whatsappError ? 'Não verificado' : 'Pendente'}
              tone={state.loading && !state.whatsapp ? 'neutral' : state.whatsapp?.config?.tokenConfigured ? 'success' : state.whatsappError ? 'neutral' : 'warning'}
            />
            <StatusRow
              title="Servidor Meta Ads"
              detail={state.loading && !state.meta ? 'Consultando configuração do recebimento.' : 'Recebimento e processamento de formulários.'}
              label={state.loading && !state.meta ? 'Verificando' : state.meta?.serverConfigured ? 'Configurado' : state.metaError ? 'Não verificado' : 'Pendente'}
              tone={state.loading && !state.meta ? 'neutral' : state.meta?.serverConfigured ? 'success' : state.metaError ? 'neutral' : 'warning'}
            />
            <StatusRow
              title="Última verificação do canal"
              detail={lastSync ? formatDate(lastSync) : 'Ainda não registrada.'}
              label={lastSync ? 'Verificado' : 'Sem registro'}
              tone={lastSync ? 'success' : 'neutral'}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Diagnóstico do canal"
            description="Confira a chegada de mensagens e a fila de processamento."
            descriptionPlacement="visible"
          />
          <div className="mt-2">
            <StatusRow title="Webhook WhatsApp" detail={webhookStatus.detail} label={webhookStatus.label} tone={webhookStatus.tone} />
            <StatusRow title="Fila Meta Ads" detail={queueStatus.detail} label={queueStatus.label} tone={queueStatus.tone} />
            <StatusRow
              title="Última importação"
              detail={lastImport ? formatDate(lastImport) : state.metaError ? 'Não foi possível consultar o histórico.' : 'Nenhuma importação registrada.'}
              label={lastImport ? 'Concluída' : state.metaError ? 'Indisponível' : 'Sem registro'}
              tone={lastImport ? 'success' : state.metaError ? 'neutral' : 'neutral'}
            />
          </div>
          {(state.loading || (state.whatsappError && state.metaError)) && (
            <Text className="mt-3 text-xs text-[var(--text-secondary)]">{state.loading ? 'Os indicadores podem levar alguns segundos para atualizar.' : 'Tente novamente ou abra o canal para consultar os detalhes.'}</Text>
          )}
        </Card>
      </div>
    </div>
  );
}
