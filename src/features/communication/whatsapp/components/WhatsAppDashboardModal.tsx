import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Archive, BarChart3, CheckCircle2, Clock3, Inbox, Link2, Loader2, MessageCircle, RefreshCw, SendHorizontal, WifiOff } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import {
  commWhatsAppService,
  formatCommWhatsAppPhoneLabel,
  type CommWhatsAppDashboardMetrics,
  type CommWhatsAppDashboardRecentChat,
} from '../../../../lib/commWhatsAppService';

type WhatsAppDashboardModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type PriorityItem = {
  tone: 'danger' | 'warning' | 'neutral' | 'success';
  title: string;
  description: string;
};

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

const isConnectedStatus = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['connected', 'open', 'online', 'active', 'ready'].includes(normalized);
};

const normalizeStatusLabel = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'desconhecido';
  return normalized.replace(/_/g, ' ');
};

const getChannelHealth = (metrics: CommWhatsAppDashboardMetrics | null): PriorityItem => {
  const channel = metrics?.channel;
  if (!channel) {
    return {
      tone: 'danger',
      title: 'Canal não encontrado',
      description: 'O canal primário do WhatsApp ainda não foi inicializado no banco.',
    };
  }

  if (!channel.enabled) {
    return {
      tone: 'warning',
      title: 'Canal desabilitado',
      description: 'O canal existe, mas está marcado como desabilitado para operação.',
    };
  }

  if (!isConnectedStatus(channel.connection_status)) {
    return {
      tone: 'danger',
      title: `Canal ${normalizeStatusLabel(channel.connection_status)}`,
      description: channel.last_error || 'Verifique conexão da Whapi antes de priorizar novos atendimentos.',
    };
  }

  return {
    tone: 'success',
    title: 'Canal conectado',
    description: `Webhook: ${formatDateTime(channel.last_webhook_received_at)}. Saúde: ${normalizeStatusLabel(channel.health_status)}.`,
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

const toneClasses: Record<PriorityItem['tone'], string> = {
  danger: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  neutral: 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] text-[var(--panel-text-soft,#5b4635)]',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
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

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await commWhatsAppService.getDashboardMetrics();
      setMetrics(data);
    } catch (loadError) {
      console.error('[WhatsAppDashboardModal] erro ao carregar métricas', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o Painel WhatsApp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadMetrics();
  }, [isOpen, loadMetrics]);

  const channelHealth = getChannelHealth(metrics);
  const priorities = metrics ? buildPriorityItems(metrics) : [];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Painel WhatsApp"
      description="Dashboard operacional para decidir onde olhar agora no inbox."
      size="xl"
      panelClassName="config-transparent-buttons"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--panel-text-muted,#876f5c)]">
            Atualizado: {formatDateTime(metrics?.generatedAt)}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void loadMetrics()} loading={loading}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      )}
    >
      {loading && !metrics ? (
        <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--panel-text-muted,#876f5c)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--panel-accent-strong,#c86f1d)]" />
          Carregando métricas do WhatsApp...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Não foi possível carregar o dashboard</p>
              <p className="mt-1 text-sm leading-6">{error}</p>
            </div>
          </div>
        </div>
      ) : metrics ? (
        <div className="space-y-5">
          <section className={`rounded-3xl border p-4 ${toneClasses[channelHealth.tone]}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/65">
                  {channelHealth.tone === 'danger' ? <WifiOff className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">Saúde do canal</p>
                  <h3 className="mt-1 text-base font-semibold">{channelHealth.title}</h3>
                  <p className="mt-1 text-sm leading-6 opacity-90">{channelHealth.description}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/60 px-3 py-2 text-right text-xs font-medium">
                <p>{metrics.channel?.connected_user_name || metrics.channel?.name || 'WhatsApp principal'}</p>
                <p className="mt-1 opacity-75">{metrics.channel?.phone_number ? formatCommWhatsAppPhoneLabel(metrics.channel.phone_number) : 'Número não informado'}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Inbox} label="Fila ativa" value={metrics.chatMetrics.activeChats} hint={`${formatNumber(metrics.chatMetrics.archivedChats)} arquivadas`} />
            <MetricCard icon={MessageCircle} label="Não lidas" value={metrics.chatMetrics.unreadChats} hint={`${formatNumber(metrics.chatMetrics.unreadMessages)} mensagens`} />
            <MetricCard icon={BarChart3} label="Volume 24h" value={metrics.messageMetrics.messages24h} hint={`${formatNumber(metrics.messageMetrics.inbound24h)} recebidas · ${formatNumber(metrics.messageMetrics.outbound24h)} enviadas`} />
            <MetricCard icon={Clock3} label="Agenda" value={metrics.reminderMetrics.upcomingReminders24h} hint={`${formatNumber(metrics.reminderMetrics.overdueReminders)} vencidas`} />
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-3 rounded-3xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">Onde olhar agora</p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--panel-text,#1a120d)]">Prioridades operacionais</h3>
                </div>
                <Activity className="h-5 w-5 text-[var(--panel-accent-strong,#c86f1d)]" />
              </div>

              <div className="space-y-2">
                {priorities.map((item) => (
                  <div key={`${item.title}:${item.description}`} className={`rounded-2xl border px-3 py-3 ${toneClasses[item.tone]}`}>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 opacity-90">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-3xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">Conversas recentes</p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--panel-text,#1a120d)]">Últimos pontos de atenção</h3>
                </div>
                <MessageCircle className="h-5 w-5 text-[var(--panel-accent-strong,#c86f1d)]" />
              </div>

              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {metrics.recentChats.length > 0 ? metrics.recentChats.map((chat) => (
                  <div key={chat.id} className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--panel-text,#1a120d)]">{chat.displayName || formatCommWhatsAppPhoneLabel(chat.phoneNumber)}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--panel-text-muted,#876f5c)]">{formatCommWhatsAppPhoneLabel(chat.phoneNumber)} · {formatDateTime(chat.lastMessageAt)}</p>
                      </div>
                      {chat.unreadCount > 0 || chat.manualUnread ? (
                        <span className="shrink-0 rounded-full bg-[var(--panel-accent-strong,#c86f1d)] px-2 py-0.5 text-[11px] font-semibold text-white">
                          {chat.unreadCount > 99 ? '99+' : Math.max(chat.unreadCount, 1)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--panel-text-soft,#5b4635)]">{getChatPreview(chat)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[var(--panel-text-muted,#876f5c)]">
                      {chat.leadId ? <span className="rounded-full bg-white/70 px-2 py-0.5"><Link2 className="mr-1 inline h-3 w-3" />Lead vinculado</span> : <span className="rounded-full bg-white/70 px-2 py-0.5">Sem lead</span>}
                      {chat.isPinned ? <span className="rounded-full bg-white/70 px-2 py-0.5">Fixado</span> : null}
                      {chat.isMuted ? <span className="rounded-full bg-white/70 px-2 py-0.5">Silenciado</span> : null}
                      {chat.lastMessageStatus ? <span className="rounded-full bg-white/70 px-2 py-0.5"><SendHorizontal className="mr-1 inline h-3 w-3" />{normalizeStatusLabel(chat.lastMessageStatus)}</span> : null}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] p-5 text-center text-sm text-[var(--panel-text-muted,#876f5c)]">
                    Nenhuma conversa recente encontrada.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <MetricCard icon={Link2} label="Chats com lead" value={metrics.chatMetrics.linkedLeadChats} hint={`${formatNumber(metrics.chatMetrics.activeUnlinkedChats)} ativos sem lead`} compact />
            <MetricCard icon={Archive} label="Arquivadas" value={metrics.chatMetrics.archivedChats} hint={`${formatNumber(metrics.chatMetrics.mutedChats)} silenciadas`} compact />
            <MetricCard icon={AlertTriangle} label="Falhas 24h" value={metrics.messageMetrics.failedOutbound24h} hint={`${formatNumber(metrics.messageMetrics.pendingOutbound)} pendentes`} compact />
          </section>
        </div>
      ) : null}
    </ModalShell>
  );
}

type MetricCardProps = {
  icon: typeof Inbox;
  label: string;
  value: number;
  hint: string;
  compact?: boolean;
};

function MetricCard({ icon: Icon, label, value, hint, compact = false }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">{label}</p>
          <p className={`${compact ? 'mt-2 text-2xl' : 'mt-3 text-3xl'} font-semibold tabular-nums text-[var(--panel-text,#1a120d)]`}>{formatNumber(value)}</p>
          <p className="mt-1 text-xs text-[var(--panel-text-muted,#876f5c)]">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--panel-accent-soft,#f4e2cc)] text-[var(--panel-accent-ink,#8b4d12)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
