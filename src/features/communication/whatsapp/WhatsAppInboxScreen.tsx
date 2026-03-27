import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
} from 'lucide-react';

import Button from '../../../components/ui/Button';
import Checkbox from '../../../components/ui/Checkbox';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfig } from '../../../contexts/ConfigContext';
import {
  commWhatsAppService,
  formatCommWhatsAppPhoneLabel,
  type CommWhatsAppAdminState,
} from '../../../lib/commWhatsAppService';
import { toast } from '../../../lib/toast';
import type { CommWhatsAppChannel, CommWhatsAppChat, CommWhatsAppMessage } from '../../../lib/supabase';

const CHAT_POLL_INTERVAL_MS = 8000;
const MESSAGE_POLL_INTERVAL_MS = 5000;

const formatMessageTime = (value?: string | null) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatChannelStatus = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return 'Desconhecido';
  if (normalized === 'AUTH') return 'Conectado';
  if (normalized === 'QR') return 'Aguardando QR';
  if (normalized === 'LAUNCH') return 'Conectando';
  if (normalized === 'INIT') return 'Inicializando';
  if (normalized === 'STOP') return 'Parado';
  if (normalized === 'DISCONNECTED') return 'Desconectado';
  return normalized;
};

const getChannelToneClasses = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (normalized === 'AUTH') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (normalized === 'QR' || normalized === 'LAUNCH' || normalized === 'INIT') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const getMessageBubbleClasses = (direction: CommWhatsAppMessage['direction']) => {
  if (direction === 'outbound') {
    return 'ml-auto border border-orange-200 bg-orange-50 text-slate-900';
  }

  if (direction === 'system') {
    return 'mx-auto border border-slate-200 bg-slate-100 text-slate-700';
  }

  return 'mr-auto border border-stone-200 bg-white text-slate-900';
};

export default function WhatsAppInboxScreen() {
  const { role } = useAuth();
  const { getRoleModulePermission, getAccessProfile } = useConfig();

  const canManageIntegration =
    getRoleModulePermission(role, 'config-integrations').can_edit ||
    getAccessProfile(role)?.is_admin === true ||
    role === 'admin';

  const [channel, setChannel] = useState<CommWhatsAppChannel | null>(null);
  const [adminState, setAdminState] = useState<CommWhatsAppAdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [enabledDraft, setEnabledDraft] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchDraft.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchDraft]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const syncAdminState = useCallback((state: CommWhatsAppAdminState) => {
    setAdminState(state);
    setChannel(state.channel);
    setTokenDraft(state.config.token || '');
    setEnabledDraft(state.config.enabled);
  }, []);

  const loadChannelState = useCallback(async () => {
    setChannelLoading(true);

    try {
      if (canManageIntegration) {
        const data = await commWhatsAppService.getAdminState();
        syncAdminState(data);
      } else {
        const data = await commWhatsAppService.getPrimaryChannel();
        setChannel(data);
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar canal', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar o canal do WhatsApp.');
    } finally {
      setChannelLoading(false);
    }
  }, [canManageIntegration, syncAdminState]);

  const loadChats = useCallback(async () => {
    try {
      const data = await commWhatsAppService.listChats({
        search,
        onlyUnread,
      });

      setChats(data);
      setSelectedChatId((current) => {
        if (current && data.some((chat) => chat.id === current)) {
          return current;
        }

        return data[0]?.id ?? null;
      });
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar chats', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as conversas do WhatsApp.');
    }
  }, [onlyUnread, search]);

  const loadMessages = useCallback(
    async (chatId: string | null) => {
      if (!chatId) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);

      try {
        const data = await commWhatsAppService.listMessages(chatId);
        setMessages(data);
      } catch (error) {
        console.error('[WhatsAppInbox] erro ao carregar mensagens', error);
        toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as mensagens da conversa.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      await Promise.all([loadChannelState(), loadChats()]);
      if (active) {
        setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadChannelState, loadChats]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedChatId);
  }, [loadMessages, selectedChatId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadChats();
    }, CHAT_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChatId) return;

    const intervalId = window.setInterval(() => {
      void loadMessages(selectedChatId);
    }, MESSAGE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadMessages, selectedChatId]);

  useEffect(() => {
    if (!selectedChat || selectedChat.unread_count <= 0) {
      return;
    }

    setChats((current) =>
      current.map((chat) => (chat.id === selectedChat.id ? { ...chat, unread_count: 0, last_read_at: new Date().toISOString() } : chat)),
    );

    void commWhatsAppService.markChatRead(selectedChat.id).catch((error) => {
      console.error('[WhatsAppInbox] erro ao marcar chat como lido', error);
    });
  }, [selectedChat]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [messages]);

  const handleCopyWebhook = async () => {
    if (!adminState?.config.webhookUrl) return;

    try {
      await navigator.clipboard.writeText(adminState.config.webhookUrl);
      toast.success('Webhook copiado para a area de transferencia.');
    } catch {
      toast.error('Nao foi possivel copiar o webhook agora.');
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);

    try {
      const data = await commWhatsAppService.saveAdminConfig({
        token: tokenDraft,
        enabled: enabledDraft,
      });
      syncAdminState(data);
      toast.success('Configuracao do canal salva com sucesso.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao salvar configuracao', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar a configuracao do WhatsApp.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRefreshHealth = async () => {
    setRefreshingHealth(true);

    try {
      const data = await commWhatsAppService.refreshHealth();
      syncAdminState(data);
      toast.success('Saude do canal atualizada.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao atualizar saude', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar a saude do canal.');
    } finally {
      setRefreshingHealth(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat) return;

    const text = messageDraft.trim();
    if (!text) return;

    setSending(true);

    try {
      await commWhatsAppService.sendTextMessage(selectedChat.external_chat_id, text);
      setMessageDraft('');
      await Promise.all([loadMessages(selectedChat.id), loadChats()]);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel-page-shell space-y-6 pb-6">
      <section className="rounded-[28px] border border-stone-200 bg-gradient-to-br from-[#fffaf3] via-white to-[#fff2e2] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
              <MessageCircle className="h-3.5 w-3.5" />
              Atendimento WhatsApp
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--panel-text,#1f2937)]">
                Inbox compartilhado
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--panel-text-muted,#6b7280)]">
                Fase 1 enxuta: receber mensagens, responder por texto e manter a operacao dos dois atendentes no mesmo numero.
              </p>
            </div>
          </div>

          <div className="flex min-w-[260px] flex-col gap-3 rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Canal principal</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getChannelToneClasses(channel?.connection_status)}`}>
                {channelLoading ? 'Atualizando...' : formatChannelStatus(channel?.connection_status)}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--panel-text,#1f2937)]">{channel?.name || 'WhatsApp principal'}</p>
              <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">
                {channel?.phone_number ? formatCommWhatsAppPhoneLabel(channel.phone_number) : 'Numero ainda nao identificado'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--panel-text-muted,#6b7280)]">
              <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
              Ultimo webhook: {channel?.last_webhook_received_at ? formatMessageTime(channel.last_webhook_received_at) : 'sem eventos ainda'}
            </div>
          </div>
        </div>
      </section>

      {canManageIntegration && (
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowConfig((current) => !current)}
                className="inline-flex items-center gap-2 text-left text-sm font-semibold text-[var(--panel-text,#1f2937)]"
              >
                <Settings2 className="h-4 w-4 text-orange-600" />
                Configuracao do canal Whapi
              </button>
              <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">
                Salve o token, copie o webhook e habilite apenas os eventos `messages`, `statuses` e `channel` em Body mode.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleRefreshHealth} loading={refreshingHealth}>
                {!refreshingHealth && <RefreshCcw className="h-4 w-4" />}
                Atualizar saude
              </Button>
              <Button onClick={handleSaveConfig} loading={savingConfig}>
                {!savingConfig && <CheckCircle2 className="h-4 w-4" />}
                Salvar canal
              </Button>
            </div>
          </div>

          {showConfig && (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4 rounded-3xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                  No painel da Whapi, configure o webhook em `Body mode`, ligue `callback_persist`, deixe `auto download` desligado e teste a URL antes de operar.
                </div>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--panel-text,#1f2937)]">Canal habilitado para envio</p>
                    <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">Recebimento depende do webhook configurado na Whapi.</p>
                  </div>
                  <Checkbox checked={enabledDraft} onChange={(event) => setEnabledDraft(event.target.checked)} />
                </label>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--panel-text,#1f2937)]">Token da Whapi</label>
                  <Input
                    type="password"
                    value={tokenDraft}
                    onChange={(event) => setTokenDraft(event.target.value)}
                    placeholder="Cole o token do canal Whapi"
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--panel-text,#1f2937)]">Webhook do inbox</label>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Input readOnly value={adminState?.config.webhookUrl || ''} className="font-mono text-xs" />
                    <Button variant="secondary" onClick={handleCopyWebhook} disabled={!adminState?.config.webhookUrl}>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-[var(--panel-text,#1f2937)]">Checklist rapido</p>
                <ol className="space-y-2 text-sm text-[var(--panel-text-muted,#6b7280)]">
                  <li>1. Salve o token do canal.</li>
                  <li>2. Cole o webhook acima na Whapi.</li>
                  <li>3. Ative `messages`, `statuses` e `channel`.</li>
                  <li>4. Execute o teste de webhook na Whapi.</li>
                  <li>5. Atualize a saude do canal aqui.</li>
                </ol>

                <div className={`rounded-2xl border px-4 py-3 text-sm ${getChannelToneClasses(channel?.connection_status)}`}>
                  <p className="font-medium">Status atual: {formatChannelStatus(channel?.connection_status)}</p>
                  <p className="mt-1 text-xs opacity-80">
                    Ultima checagem: {channel?.last_health_check_at ? formatMessageTime(channel.last_health_check_at) : 'ainda nao consultado'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 p-4">
            <div className="flex flex-col gap-3">
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                leftIcon={Search}
              />
              <label className="inline-flex items-center gap-2 text-sm text-[var(--panel-text-muted,#6b7280)]">
                <Checkbox checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />
                Mostrar apenas nao lidas
              </label>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-y-auto p-2">
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : chats.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center">
                <MessageCircle className="h-8 w-8 text-stone-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--panel-text,#1f2937)]">Nenhuma conversa ainda</p>
                  <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Assim que o webhook receber mensagens, elas aparecerao aqui.</p>
                </div>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`mb-2 flex w-full flex-col rounded-3xl border px-4 py-3 text-left transition ${
                    chat.id === selectedChatId
                      ? 'border-orange-300 bg-orange-50/80 shadow-sm'
                      : 'border-transparent bg-stone-50/70 hover:border-stone-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--panel-text,#1f2937)]">{chat.display_name}</p>
                      <p className="truncate text-xs text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(chat.phone_number)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-[11px] uppercase tracking-[0.12em] text-stone-400">{formatMessageTime(chat.last_message_at)}</span>
                      {chat.unread_count > 0 && (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-orange-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 truncate text-sm text-[var(--panel-text-muted,#6b7280)]">{chat.last_message_text || 'Sem mensagens ainda'}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white shadow-sm">
          {!selectedChat ? (
            <div className="flex min-h-[72vh] flex-col items-center justify-center gap-4 p-8 text-center">
              <MessageCircle className="h-10 w-10 text-stone-400" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--panel-text,#1f2937)]">Selecione uma conversa</p>
                <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Abra um chat na coluna da esquerda para acompanhar o historico e responder.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-stone-200 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-[var(--panel-text,#1f2937)]">{selectedChat.display_name}</p>
                  <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</p>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${getChannelToneClasses(channel?.connection_status)}`}>
                  {channel?.enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {channel?.enabled ? 'Envio habilitado' : 'Canal desabilitado'}
                </div>
              </div>

              <div ref={messagesContainerRef} className="max-h-[58vh] space-y-3 overflow-y-auto bg-[#fffdf9] px-5 py-5">
                {loadingMessages ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                    Nenhuma mensagem carregada para esta conversa.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`flex w-full ${message.direction === 'outbound' ? 'justify-end' : message.direction === 'system' ? 'justify-center' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${getMessageBubbleClasses(message.direction)}`}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text_content || '[Mensagem sem texto]'}</p>
                        <div className="mt-2 flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.08em] text-stone-400">
                          <span>{formatMessageTime(message.message_at)}</span>
                          {message.direction === 'outbound' && <span>{message.delivery_status}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-stone-200 p-5">
                <div className="space-y-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
                  <Textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Digite sua resposta..."
                    className="min-h-[120px] resize-none border-none bg-transparent px-0 shadow-none focus:border-none"
                    disabled={sending || !channel?.enabled}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">
                      Por enquanto o MVP envia apenas texto. Midias e atalhos entram na proxima etapa.
                    </p>
                    <Button onClick={handleSendMessage} loading={sending} disabled={!messageDraft.trim() || !channel?.enabled}>
                      {!sending && <Send className="h-4 w-4" />}
                      Enviar mensagem
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
