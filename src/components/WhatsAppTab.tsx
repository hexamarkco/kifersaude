import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, MessageSquare, Phone, RefreshCw, Send } from 'lucide-react';
import type { TabNavigationOptions } from '../types/navigation';
import type { WhatsAppMessage, WhatsAppWebhookEvent } from '../lib/supabase';
import {
  fetchChatSummaries,
  fetchMessagesByChat,
  fetchWebhookEvents,
  whatsappWebhookUrl,
  type WhatsAppChatSummary,
} from '../lib/whatsappService';

interface WhatsAppTabProps {
  onNavigateToTab?: (tab: string, options?: TabNavigationOptions) => void;
}

type ChatTimelineItem = {
  id: string;
  author: string;
  message: string;
  timestamp: string;
  type: 'incoming' | 'outgoing' | 'note';
};

const bubbleTone: Record<ChatTimelineItem['type'], string> = {
  incoming: 'bg-white text-slate-800 border border-slate-100',
  outgoing: 'bg-orange-50 text-slate-800 border border-orange-100',
  note: 'bg-slate-100 text-slate-700 border border-slate-200',
};

export default function WhatsAppTab({ onNavigateToTab }: WhatsAppTabProps) {
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [chats, setChats] = useState<WhatsAppChatSummary[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WhatsAppWebhookEvent[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? chats[0],
    [chats, selectedChatId],
  );

  const selectedTimeline: ChatTimelineItem[] = useMemo(
    () =>
      messages.map((message) => ({
        id: message.id,
        author: message.from_number || 'Equipe KS',
        message: message.body || 'Mensagem sem texto',
        timestamp: formatDateTime(message.timestamp || message.created_at),
        type: resolveMessageTone(message),
      })),
    [messages],
  );

  const handleNavigate = (tab: string, options?: TabNavigationOptions) => {
    onNavigateToTab?.(tab, options);
  };

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    setErrorMessage(null);
    try {
      const data = await fetchChatSummaries();
      setChats(data);
      if (!selectedChatId && data.length > 0) {
        setSelectedChatId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar chats do WhatsApp', error);
      setErrorMessage('Não foi possível carregar os chats do WhatsApp.');
    } finally {
      setLoadingChats(false);
    }
  }, [selectedChatId]);

  const loadMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    setErrorMessage(null);
    try {
      const data = await fetchMessagesByChat(chatId);
      setMessages(data);
    } catch (error) {
      console.error('Erro ao carregar mensagens do WhatsApp', error);
      setErrorMessage('Não foi possível carregar as mensagens do chat selecionado.');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadWebhookEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await fetchWebhookEvents();
      setWebhookEvents(data);
    } catch (error) {
      console.error('Erro ao carregar eventos do webhook', error);
      setErrorMessage('Não foi possível carregar os eventos recentes do webhook.');
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    void loadChats();
    void loadWebhookEvents();
  }, [loadChats, loadWebhookEvents]);

  useEffect(() => {
    if (!selectedChatId && chats.length > 0) {
      setSelectedChatId(chats[0].id);
      return;
    }

    if (selectedChatId) {
      void loadMessages(selectedChatId);
    } else {
      setMessages([]);
    }
  }, [selectedChatId, chats, loadMessages]);

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(whatsappWebhookUrl);
      setCopiedWebhookUrl(true);
      setTimeout(() => setCopiedWebhookUrl(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar URL do webhook', error);
      setErrorMessage('Não foi possível copiar a URL do webhook.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="h-[calc(100vh-8rem)] rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex h-full flex-col overflow-hidden lg:flex-row">
          <div className="w-full max-w-md border-b border-slate-200 bg-slate-50/80 p-4 lg:h-full lg:border-b-0 lg:border-r lg:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversas</p>
                <h2 className="text-lg font-bold text-slate-900">Inbox de WhatsApp</h2>
                <p className="text-xs text-slate-500">Mensagens reais do webhook e tabelas do Supabase</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNavigate('leads', { leadsStatusFilter: ['novo', 'contato'] })}
                  className="hidden items-center gap-2 rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 lg:inline-flex"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Vincular lead
                </button>
                <button
                  onClick={() => void loadChats()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-orange-300 hover:text-orange-700"
                  title="Atualizar inbox"
                >
                  {loadingChats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {loadingChats && (
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando chats...
                </div>
              )}

              {!loadingChats && chats.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                  Nenhum chat encontrado ainda. Quando o webhook receber mensagens, elas aparecerão aqui.
                </div>
              )}

              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`flex w-full flex-col gap-1 rounded-2xl border px-3 py-2 text-left transition ${
                    selectedChat?.id === chat.id
                      ? 'border-orange-200 bg-orange-50 shadow-sm'
                      : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{chat.name || 'Chat sem nome'}</p>
                        <p className="text-xs text-slate-500">{chat.id}</p>
                      </div>
                    </div>
                    {chat.is_group && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Grupo</span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-600">
                    {chat.latestMessage?.body || 'Sem mensagens ainda'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Última atividade: {formatDateTime(chat.last_message_at || chat.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-[320px] flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 lg:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversa selecionada</p>
                <h3 className="text-xl font-bold text-slate-900">{selectedChat?.name || 'Chat'}</h3>
                <p className="text-sm text-slate-500">ID: {selectedChat?.id || 'Selecione um chat'}</p>
              </div>
              <button
                onClick={() => handleNavigate('reminders')}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
              >
                Registrar follow-up
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 lg:p-6">
              {loadingMessages && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando mensagens...
                </div>
              )}

              {!loadingMessages && selectedTimeline.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                  Nenhuma mensagem registrada neste chat ainda.
                </div>
              )}

              {selectedTimeline.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${item.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xl rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      item.type === 'outgoing' ? 'rounded-br-sm' : item.type === 'incoming' ? 'rounded-bl-sm' : 'rounded-xl'
                    } ${bubbleTone[item.type]}`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{item.author}</span>
                      <span>{item.timestamp}</span>
                    </div>
                    <p className="mt-1 text-slate-800">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 bg-white p-4 lg:p-6">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Send className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Responder no WhatsApp conectado"
                  className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  disabled
                />
                <button className="cursor-not-allowed rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                  Em breve
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Envio direto será habilitado após estabilizarmos a integração.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Webhook</p>
              <h3 className="text-lg font-bold text-slate-900">Endpoint conectado</h3>
              <p className="text-xs text-slate-500">Configure esse URL no provedor de WhatsApp para popular as tabelas.</p>
            </div>
            <button
              onClick={handleCopyWebhookUrl}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
            >
              <Copy className="h-3.5 w-3.5" /> {copiedWebhookUrl ? 'Copiado!' : 'Copiar URL'}
            </button>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
            {whatsappWebhookUrl}
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>
              A tabela <code className="rounded bg-slate-100 px-1">whatsapp_webhook_events</code> armazena o payload bruto.
            </li>
            <li>
              As tabelas <code className="rounded bg-slate-100 px-1">whatsapp_chats</code> e{' '}
              <code className="rounded bg-slate-100 px-1">whatsapp_messages</code> já aparecem na inbox.
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos recentes</p>
              <h3 className="text-lg font-bold text-slate-900">Log do webhook</h3>
            </div>
            <button
              onClick={() => void loadWebhookEvents()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-orange-300 hover:text-orange-700"
              title="Atualizar log"
            >
              {loadingEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>

          {loadingEvents && (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando eventos...
            </div>
          )}

          {!loadingEvents && webhookEvents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              Sem eventos registrados ainda. Envie um teste para o endpoint para validar a conexão.
            </div>
          )}

          {!loadingEvents && webhookEvents.length > 0 && (
            <div className="space-y-2">
              {webhookEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">{event.event || 'unknown'}</span>
                    <span>{formatDateTime(event.created_at)}</span>
                  </div>
                  <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-white px-2 py-1 text-[11px] text-slate-700">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function resolveMessageTone(message: WhatsAppMessage): ChatTimelineItem['type'] {
  if (message.type === 'note') {
    return 'note';
  }

  if (message.from_number && !message.to_number) {
    return 'incoming';
  }

  return 'outgoing';
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
