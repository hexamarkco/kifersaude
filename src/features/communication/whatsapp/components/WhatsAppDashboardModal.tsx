import { WhatsAppInboxDialog } from './WhatsAppInboxDialog';
import { LoadingState, Skeleton, Text } from '../../../../design-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, Download, Inbox, Link2, MessageCircle, RefreshCw, RotateCw, SendHorizontal, WifiOff } from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Alert,
  CrmCard,
  KpiCard,
  Progress,
  RecordActions,
  type TabItem,
  Tabs,
} from '../../../../design-system';
import {
  whatsappConversationsRepository,
  whatsappDashboardService,
  formatCommWhatsAppPhoneLabel,
  type CommWhatsAppDashboardMetrics,
  type CommWhatsAppDashboardRecentChat,
} from '../data';
import { toast } from '../../../../lib/toast';
import { KeyedActionLock } from './keyedActionLock';
import { formatDashboardRecentChatMeta } from '../domain/dashboardPresentation';

type WhatsAppDashboardModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type DashboardTone = 'danger' | 'warning' | 'neutral' | 'success';

type PriorityItem = {
  tone: DashboardTone;
  title: string;
  description: string;
};

type ChannelStatusInfo = {
  tone: DashboardTone;
  title: string;
  description: string;
  connected: boolean;
};

type DashboardView = 'priorities' | 'recent';

const DASHBOARD_VIEW_TABS: TabItem<DashboardView>[] = [
  { id: 'priorities', label: 'Prioridades' },
  { id: 'recent', label: 'Conversas recentes' },
];

const numberFormatter = new Intl.NumberFormat('pt-BR');

const formatNumber = (value: number) => numberFormatter.format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeWhapiChannelStatus = (value?: string | null) => String(value ?? '').trim().toUpperCase();

const normalizeStatusLabel = (value?: string | null) => {
  const labels: Record<string, string> = { pending: 'Aguardando envio', sending: 'Enviando', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', played: 'Reproduzida', failed: 'Falha no envio', received: 'Recebida', deleted: 'Excluída' };
  return labels[String(value ?? '').trim().toLowerCase()] || 'Situação não confirmada';
};

const getWhapiChannelStatusInfo = (value?: string | null): ChannelStatusInfo => {
  const status = normalizeWhapiChannelStatus(value);

  if (status === 'AUTH') {
    return {
      tone: 'success',
      title: 'WhatsApp conectado',
      description: 'A conexão foi confirmada pelo serviço de WhatsApp.',
      connected: true,
    };
  }

  if (status === 'QR') {
    return {
      tone: 'warning',
      title: 'Aguardando conexão pelo celular',
      description: 'Aguardando leitura do QR code ou pareamento do dispositivo.',
      connected: false,
    };
  }

  if (status === 'INIT') {
    return {
      tone: 'warning',
      title: 'Preparando conexão',
      description: 'Aguarde alguns instantes enquanto o WhatsApp prepara a conexão.',
      connected: false,
    };
  }

  if (status === 'LAUNCH') {
    return {
      tone: 'warning',
      title: 'Conectando WhatsApp',
      description: 'A conexão ainda não foi confirmada. Aguarde antes de iniciar novos envios.',
      connected: false,
    };
  }

  if (status === 'STOP') {
    return {
      tone: 'danger',
      title: 'Conexão interrompida',
      description: 'Confira a conexão em Automações e IA > Integrações antes de enviar novas mensagens.',
      connected: false,
    };
  }

  if (status === 'SYNC_ERROR') {
    return {
      tone: 'danger',
      title: 'Problema ao atualizar as conversas',
      description: 'Confira a conexão em Automações e IA > Integrações. Se continuar, peça ajuda ao responsável pelo sistema.',
      connected: false,
    };
  }

  if (status === 'ERROR') {
    return {
      tone: 'danger',
      title: 'Problema na conexão do WhatsApp',
      description: 'Não foi possível confirmar a conexão. Confira as configurações antes de iniciar novos envios.',
      connected: false,
    };
  }

  return {
    tone: 'neutral',
    title: 'Conexão ainda não confirmada',
    description: 'Atualize a conexão. Se o problema continuar, peça ajuda ao responsável pelo sistema.',
    connected: false,
  };
};

const getChannelHealth = (metrics: CommWhatsAppDashboardMetrics | null): PriorityItem & { connected: boolean } => {
  const channel = metrics?.channel;
  if (!channel) {
    return {
      tone: 'danger',
      title: 'Canal não encontrado',
      description: 'A conexão do WhatsApp ainda não foi configurada. Peça ajuda ao responsável pelo sistema.',
      connected: false,
    };
  }

  if (!channel.enabled) {
    return {
      tone: 'warning',
      title: 'Canal desabilitado',
      description: 'O canal existe, mas está marcado como desabilitado para operação.',
      connected: false,
    };
  }

  const statusInfo = getWhapiChannelStatusInfo(channel.connection_status);
  if (!statusInfo.connected) {
    return {
      ...statusInfo,
      description: statusInfo.description,
    };
  }

  return {
    ...statusInfo,
    description: `Conexão confirmada. Última atualização recebida: ${formatDateTime(channel.last_webhook_received_at)}.`,
  };
};

const buildPriorityItems = (metrics: CommWhatsAppDashboardMetrics): PriorityItem[] => {
  const items: PriorityItem[] = [];
  const { chatMetrics, messageMetrics, reminderMetrics } = metrics;

  if (chatMetrics.unreadChats > 0) {
    items.push({
      tone: chatMetrics.staleUnreadChats > 0 ? 'danger' : 'warning',
      title: `${formatNumber(chatMetrics.unreadChats)} conversa(s) não lida(s)`,
      description: chatMetrics.staleUnreadChats > 0
        ? `${formatNumber(chatMetrics.staleUnreadChats)} estão paradas há mais de 2 horas.`
        : 'Priorize a fila de não lidas antes de abrir novas conversas.',
    });
  }

  if (messageMetrics.failedOutbound24h > 0) {
    items.push({
      tone: 'danger',
      title: `${formatNumber(messageMetrics.failedOutbound24h)} envio(s) falharam em 24h`,
      description: 'Revise mensagens com erro para reenviar ou ajustar o atendimento.',
    });
  }

  if (messageMetrics.pendingOutbound > 0) {
    items.push({
      tone: 'warning',
      title: `${formatNumber(messageMetrics.pendingOutbound)} envio(s) aguardando confirmação`,
      description: 'Acompanhe status pendente/queued para evitar duplicidade de envio.',
    });
  }

  if (chatMetrics.activeUnlinkedChats > 0) {
    items.push({
      tone: 'neutral',
      title: `${formatNumber(chatMetrics.activeUnlinkedChats)} chat(s) ativo(s) sem lead`,
      description: 'Vincule manualmente apenas quando houver contexto comercial suficiente.',
    });
  }

  if (reminderMetrics.overdueReminders > 0) {
    items.push({
      tone: 'danger',
      title: `${formatNumber(reminderMetrics.overdueReminders)} lembrete(s) vencido(s)`,
      description: 'Concilie a agenda antes de criar novos follow-ups para o dia.',
    });
  }

  if (items.length === 0) {
    items.push({
      tone: 'success',
      title: 'Operação sem alerta crítico',
      description: 'Não há falhas, pendências críticas ou fila não lida relevante neste momento.',
    });
  }

  return items.slice(0, 5);
};

const priorityIcon: Record<DashboardTone, typeof AlertTriangle> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  neutral: Activity,
  success: CheckCircle2,
};

const getChatPreview = (chat: CommWhatsAppDashboardRecentChat) => {
  const preview = chat.lastMessageText?.trim();
  if (preview) return preview;
  if (chat.lastMessageDirection === 'outbound') return 'Última interação enviada';
  if (chat.lastMessageDirection === 'inbound') return 'Última interação recebida';
  return 'Sem prévia de mensagem';
};

export default function WhatsAppDashboardModal({ isOpen, onClose }: WhatsAppDashboardModalProps) {
  const [metrics, setMetrics] = useState<CommWhatsAppDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingInbox, setExportingInbox] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllProgress, setSyncAllProgress] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>('priorities');
  const loadMetricsRequestIdRef = useRef(0);
  const dashboardSessionIdRef = useRef(0);
  const dashboardActionLockRef = useRef(new KeyedActionLock());

  const loadMetrics = useCallback(async () => {
    const requestId = ++loadMetricsRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await whatsappDashboardService.getMetrics();
      if (requestId !== loadMetricsRequestIdRef.current) {
        return;
      }
      setMetrics(data);
    } catch (loadError) {
      if (requestId !== loadMetricsRequestIdRef.current) {
        return;
      }
      console.error('[WhatsAppDashboardModal] erro ao carregar métricas', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o Painel WhatsApp.');
    } finally {
      if (requestId === loadMetricsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      dashboardSessionIdRef.current += 1;
      loadMetricsRequestIdRef.current += 1;
      setExportingInbox(false);
      setExportProgress(null);
      setSyncingAll(false);
      setSyncAllProgress(null);
      return;
    }
    const sessionId = ++dashboardSessionIdRef.current;
    void loadMetrics();
    return () => {
      if (sessionId === dashboardSessionIdRef.current) {
        dashboardSessionIdRef.current += 1;
      }
    };
  }, [isOpen, loadMetrics]);

  const handleClose = useCallback(() => {
    dashboardSessionIdRef.current += 1;
    loadMetricsRequestIdRef.current += 1;
    setExportingInbox(false);
    setExportProgress(null);
    setSyncingAll(false);
    setSyncAllProgress(null);
    onClose();
  }, [onClose]);

  const channelHealth = getChannelHealth(metrics);
  const ChannelHealthIcon = channelHealth.connected ? CheckCircle2 : WifiOff;
  const priorities = metrics ? buildPriorityItems(metrics) : [];

  const handleExportInboxJson = useCallback(async () => {
    if (exportingInbox) {
      return;
    }
    if (!dashboardActionLockRef.current.tryAcquire('export')) {
      return;
    }

    const sessionId = dashboardSessionIdRef.current;
    setExportingInbox(true);
    setExportProgress('Preparando conversas...');

    try {
      const payload = await whatsappDashboardService.exportConversations({
        onProgress: (progress) => {
          if (sessionId !== dashboardSessionIdRef.current) return;
          if (progress.chatsExported > 0 || progress.messagesExported > 0) {
            setExportProgress(`Exportando ${progress.chatsExported}/${progress.chatsLoaded} conversas (${progress.messagesExported} mensagens)`);
            return;
          }

          setExportProgress(`${progress.chatsLoaded} conversas encontradas`);
        },
      });

      if (sessionId !== dashboardSessionIdRef.current) return;

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const fileDate = new Date().toISOString().slice(0, 10);
      anchor.href = objectUrl;
      anchor.download = `whatsapp-inbox-export-${fileDate}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      toast.success(`Exportação concluída: ${payload.summary.chats} conversas e ${payload.summary.messages} mensagens.`);
    } catch (exportError) {
      if (sessionId !== dashboardSessionIdRef.current) return;
      console.error('[WhatsAppDashboardModal] erro ao exportar inbox', exportError);
      toast.error(exportError instanceof Error ? exportError.message : 'Não foi possível exportar as conversas do inbox.');
    } finally {
      dashboardActionLockRef.current.release('export');
      if (sessionId === dashboardSessionIdRef.current) {
        setExportingInbox(false);
        setExportProgress(null);
      }
    }
  }, [exportingInbox]);

  const handleSyncAllChats = useCallback(async () => {
    if (syncingAll) {
      return;
    }
    if (!dashboardActionLockRef.current.tryAcquire('sync')) {
      return;
    }

    const sessionId = dashboardSessionIdRef.current;
    setSyncingAll(true);
    setSyncAllProgress('Preparando sincronização geral...');

    try {
      const result = await whatsappConversationsRepository.syncAll({
        onProgress: (progress) => {
          if (sessionId !== dashboardSessionIdRef.current) return;
          setSyncAllProgress(
            `${progress.chatsProcessed} conversa(s) verificadas · ${progress.importedMessages} mensagem(ns) recuperada(s)`
            + (progress.discoveredChats > 0 ? ` · ${progress.discoveredChats} conversa(s) nova(s) encontrada(s)` : ''),
          );
        },
      });

      if (sessionId !== dashboardSessionIdRef.current) return;
      await loadMetrics();

      if (sessionId !== dashboardSessionIdRef.current) return;

      if (result.importedMessages > 0 || result.discoveredChats > 0) {
        toast.success(
          `Sincronização concluída: ${result.importedMessages} mensagem(ns) recuperada(s) em ${result.chatsProcessed} conversa(s)`
          + (result.discoveredChats > 0 ? `, incluindo ${result.discoveredChats} conversa(s) nova(s).` : '.'),
        );
      } else {
        toast.info(`Sincronização concluída: nenhuma mensagem nova encontrada em ${result.chatsProcessed} conversa(s).`);
      }

      if (result.identityConflicts > 0) {
        toast.warning(`${result.identityConflicts} conflito(s) de identidade foram sinalizados durante a sincronização. Confira as conversas sinalizadas.`);
      }
    } catch (syncError) {
      if (sessionId !== dashboardSessionIdRef.current) return;
      console.error('[WhatsAppDashboardModal] erro ao forçar sincronização geral', syncError);
      toast.error(syncError instanceof Error ? syncError.message : 'Não foi possível sincronizar todas as conversas.');
    } finally {
      dashboardActionLockRef.current.release('sync');
      if (sessionId === dashboardSessionIdRef.current) {
        setSyncingAll(false);
        setSyncAllProgress(null);
      }
    }
  }, [loadMetrics, syncingAll]);

  return (
    <WhatsAppInboxDialog
      panelClassName="whatsapp-inbox-dashboard"
      icon={BarChart3}
      bodyClassName="whatsapp-inbox-dashboard-body"
      isOpen={isOpen}
      onClose={handleClose}
      title="Painel WhatsApp"
      description="Acompanhe o volume de conversas, a fila de atendimento e o que precisa de atenção."
      size="xl"
      footer={(
        <div className="whatsapp-inbox-report-footer">
          <Text size="sm" tone="muted" role="status">
            {syncAllProgress ?? exportProgress ?? (metrics ? `Atualizado em ${formatDateTime(metrics.generatedAt)}` : 'Aguardando dados do atendimento')}
          </Text>
          <div className="whatsapp-inbox-report-actions">
            <RecordActions label="Ações do painel WhatsApp" visibleCount={0} actions={[
              { label: 'Forçar sincronização geral', icon: RotateCw, loading: syncingAll, onClick: () => void handleSyncAllChats() },
              { label: 'Exportar conversas (.json)', icon: Download, loading: exportingInbox, onClick: () => void handleExportInboxJson() },
            ]} />
            <Button variant="secondary" onClick={() => void loadMetrics()} loading={loading}><RefreshCw className="kds-control-icon" aria-hidden="true" />Atualizar</Button>
            <Button variant="secondary" onClick={handleClose}>Fechar</Button>
          </div>
        </div>
      )}
    >
      <LoadingState active={loading && !metrics} label="Carregando métricas do WhatsApp" placeholder={
        <div className="whatsapp-inbox-report">
          <div className="kds-workspace-record-metrics">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="card" />)}
          </div>
          <div className="whatsapp-inbox-report-columns">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        </div>
      } fallback={() => error && !metrics ? (
        <EmptyState icon={<AlertTriangle aria-hidden="true" />} title="Não foi possível carregar o painel do WhatsApp"
          description={error} action={<Button variant="secondary" onClick={() => void loadMetrics()}>Tentar novamente</Button>} />
      ) : metrics ? (
        <div className="whatsapp-inbox-report">
          {error && <Alert tone="warning" title="Os indicadores não foram atualizados.">{error}</Alert>}
          <section className="kds-workspace-record-metrics kds-kpi-grid" aria-label="Indicadores do WhatsApp">
            <KpiCard title="Conversas na fila" value={formatNumber(metrics.chatMetrics.activeChats)} trend="Conversas ativas e não arquivadas" icon={<Inbox />} />
            <KpiCard title="Conversas não lidas" value={formatNumber(metrics.chatMetrics.unreadChats)}
              trend={`${formatNumber(metrics.chatMetrics.staleUnreadChats)} sem leitura há mais tempo`} icon={<MessageCircle />} data-tone="warning" />
            <KpiCard title="Mensagens nas últimas 24h" value={formatNumber(metrics.messageMetrics.messages24h)} trend="Recebidas e enviadas" icon={<BarChart3 />} data-tone="info" />
            <KpiCard title="Lembretes nas próximas 24h" value={formatNumber(metrics.reminderMetrics.upcomingReminders24h)}
              trend={`${formatNumber(metrics.reminderMetrics.overdueReminders)} atrasados`} icon={<Clock3 />} data-tone="cyan" />
          </section>

          <div className="whatsapp-inbox-report-columns">
            <CrmCard title="Ritmo das conversas" subtitle="Mensagens registradas nas últimas 24 horas." subtitlePlacement="visible">
              {[
                { label: 'Recebidas', value: metrics.messageMetrics.inbound24h },
                { label: 'Enviadas', value: metrics.messageMetrics.outbound24h },
              ].map(({ label, value }) => (
                <div className="whatsapp-inbox-report-bar" key={label}>
                  <Text>{label}</Text><Text weight="semibold">{formatNumber(value)}</Text>
                  <Progress size="sm" value={value} max={Math.max(1, metrics.messageMetrics.messages24h, value)} />
                </div>
              ))}
              <Text size="sm" tone="muted">{formatNumber(metrics.messageMetrics.pendingOutbound)} aguardando envio · {formatNumber(metrics.messageMetrics.failedOutbound24h)} com falha nas últimas 24 horas</Text>
            </CrmCard>
            <CrmCard title="Canal de atendimento" subtitle={channelHealth.description} subtitlePlacement="visible">
              <Badge tone={channelHealth.tone} icon={ChannelHealthIcon}>{channelHealth.title}</Badge>
              <Text weight="semibold">{metrics.channel?.connected_user_name || metrics.channel?.name || 'WhatsApp principal'}</Text>
              <Text size="sm" tone="muted">{metrics.channel?.phone_number ? formatCommWhatsAppPhoneLabel(metrics.channel.phone_number) : 'Número não informado'}</Text>
              <Text size="sm" tone="muted">{formatNumber(metrics.chatMetrics.linkedLeadChats)} com lead vinculado · {formatNumber(metrics.chatMetrics.archivedChats)} arquivadas</Text>
              {metrics.channel?.last_error && <details className="whatsapp-inbox-report-support">
                <summary>Informações para o suporte</summary>
                <Text size="sm">{metrics.channel.last_error}</Text>
              </details>}
            </CrmCard>
          </div>

          <CrmCard title="Acompanhamento das conversas">
            <Tabs items={DASHBOARD_VIEW_TABS} value={view} onChange={setView} ariaLabel="Visão do painel WhatsApp" />
            {view === 'priorities' ? (
              <ul className="whatsapp-inbox-report-list">
                {priorities.map((item) => {
                  const Icon = priorityIcon[item.tone];
                  return <li key={item.title}>
                    <span className="whatsapp-inbox-report-symbol" data-tone={item.tone}><Icon aria-hidden="true" /></span>
                    <div><Text weight="semibold">{item.title}</Text><Text size="sm" tone="muted">{item.description}</Text></div>
                  </li>;
                })}
              </ul>
            ) : metrics.recentChats.length > 0 ? (
              <ul className="whatsapp-inbox-report-list">
                {metrics.recentChats.map((chat) => (
                  <li key={chat.id}>
                    <div className="whatsapp-inbox-report-conversation">
                      <Text weight="semibold">{chat.displayName || formatCommWhatsAppPhoneLabel(chat.phoneNumber)}</Text>
                      <Text size="sm" tone="muted">{formatDashboardRecentChatMeta(formatCommWhatsAppPhoneLabel(chat.phoneNumber), formatDateTime(chat.lastMessageAt))}</Text>
                      <Text size="sm" className="line-clamp-2">{getChatPreview(chat)}</Text>
                      <div className="whatsapp-inbox-report-actions">
                        {chat.leadId ? <Badge tone="info" size="sm" icon={Link2}>Lead vinculado</Badge> : <Badge tone="neutral" size="sm">Sem lead</Badge>}
                        {chat.isPinned && <Badge tone="neutral" size="sm">Fixado</Badge>}
                        {chat.isMuted && <Badge tone="neutral" size="sm">Silenciado</Badge>}
                        {chat.lastMessageStatus && <Badge tone="neutral" size="sm" icon={SendHorizontal}>{normalizeStatusLabel(chat.lastMessageStatus)}</Badge>}
                      </div>
                    </div>
                    {(chat.unreadCount > 0 || chat.manualUnread) && <Badge tone="accent" size="sm">{chat.unreadCount > 99 ? '99+' : Math.max(chat.unreadCount, 1)}</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhuma conversa recente" description="As conversas aparecem aqui conforme o atendimento avança." />
            )}
          </CrmCard>
        </div>
      ) : null} />
    </WhatsAppInboxDialog>
  );
}
