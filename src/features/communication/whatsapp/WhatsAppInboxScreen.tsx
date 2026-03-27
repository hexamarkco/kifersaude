import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Loader2, MessageCircle, Mic, Plus, Search, SendHorizontal, Smile } from 'lucide-react';

import Checkbox from '../../../components/ui/Checkbox';
import Input from '../../../components/ui/Input';
import { commWhatsAppService, formatCommWhatsAppPhoneLabel } from '../../../lib/commWhatsAppService';
import { toast } from '../../../lib/toast';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../../lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hydratedChatsRef = useRef<Set<string>>(new Set());
  const hasTypedMessage = messageDraft.trim().length > 0;

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

  const loadMessages = useCallback(async (chat: CommWhatsAppChat | null) => {
    if (!chat) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);

    try {
      let data = await commWhatsAppService.listMessages(chat.id);

      if (data.length === 0 && !hydratedChatsRef.current.has(chat.external_chat_id)) {
        hydratedChatsRef.current.add(chat.external_chat_id);
        await commWhatsAppService.syncChatHistory(chat.external_chat_id);
        data = await commWhatsAppService.listMessages(chat.id);
        await loadChats();
      }

      setMessages(data);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar mensagens', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as mensagens da conversa.');
    } finally {
      setLoadingMessages(false);
    }
  }, [loadChats]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      await loadChats();
      if (active) {
        setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedChat);
  }, [loadMessages, selectedChat]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadChats();
    }, CHAT_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChat) return;

    const intervalId = window.setInterval(() => {
      void loadMessages(selectedChat);
    }, MESSAGE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadMessages, selectedChat]);

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

  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';

    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;

    const minHeight = lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = lineHeight * 5 + paddingTop + paddingBottom + borderTop + borderBottom;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [messageDraft, selectedChatId]);

  const handleComposerAuxClick = (feature: 'attach' | 'emoji' | 'audio') => {
    if (feature === 'audio') {
      toast.info('Gravacao de audio entra na proxima etapa.');
      return;
    }

    if (feature === 'attach') {
      toast.info('Anexos entram na proxima etapa do inbox.');
      return;
    }

    toast.info('Emoji picker entra na proxima etapa do inbox.');
  };

  const handleSendMessage = async () => {
    if (!selectedChat) return;

    const text = messageDraft.trim();
    if (!text) return;

    setSending(true);

    try {
      await commWhatsAppService.sendTextMessage(selectedChat.external_chat_id, text);
      setMessageDraft('');
      hydratedChatsRef.current.add(selectedChat.external_chat_id);
      await Promise.all([loadMessages(selectedChat), loadChats()]);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleComposerSubmit = () => {
    if (sending) return;

    if (hasTypedMessage) {
      void handleSendMessage();
      return;
    }

    handleComposerAuxClick('audio');
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    if (!hasTypedMessage) {
      return;
    }

    event.preventDefault();
    void handleSendMessage();
  };

  return (
    <div className="panel-page-shell pb-6">
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

          <div className="max-h-[76vh] overflow-y-auto p-2">
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
                  <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Assim que o webhook da Whapi receber mensagens, elas aparecerao aqui.</p>
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
            <div className="flex min-h-[76vh] flex-col items-center justify-center gap-4 p-8 text-center">
              <MessageCircle className="h-10 w-10 text-stone-400" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--panel-text,#1f2937)]">Selecione uma conversa</p>
                <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Abra um chat na coluna da esquerda para acompanhar o historico e responder.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-stone-200 p-5">
                <p className="text-lg font-semibold text-[var(--panel-text,#1f2937)]">{selectedChat.display_name}</p>
                <p className="mt-1 text-sm text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</p>
              </div>

              <div ref={messagesContainerRef} className="max-h-[62vh] space-y-3 overflow-y-auto bg-[#fffdf9] px-5 py-5">
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
                <div className="rounded-[30px] border border-stone-200 bg-stone-50/90 px-4 py-3 shadow-sm">
                  <textarea
                    ref={composerTextareaRef}
                    rows={1}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Digite uma mensagem"
                    disabled={sending}
                    className="block w-full resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 text-[var(--panel-text,#1f2937)] placeholder:text-stone-400 focus:outline-none"
                  />
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="flex items-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleComposerAuxClick('attach')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-200 hover:text-stone-700"
                        aria-label="Anexar"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleComposerAuxClick('emoji')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-200 hover:text-stone-700"
                        aria-label="Emojis"
                      >
                        <Smile className="h-5 w-5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleComposerSubmit}
                      disabled={sending}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${
                        hasTypedMessage
                          ? 'bg-stone-900 text-white shadow-sm hover:bg-stone-800'
                          : 'bg-transparent text-stone-500 hover:bg-stone-200 hover:text-stone-700'
                      } ${sending ? 'cursor-wait opacity-70' : ''}`}
                      aria-label={hasTypedMessage ? 'Enviar mensagem' : 'Gravar audio'}
                    >
                      {sending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : hasTypedMessage ? (
                        <SendHorizontal className="h-5 w-5" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </button>
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
