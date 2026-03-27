import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Loader2, MessageCircle, Mic, Plus, Search, SendHorizontal, Smile } from 'lucide-react';

import Checkbox from '../../../components/ui/Checkbox';
import Input from '../../../components/ui/Input';
import { commWhatsAppService, formatCommWhatsAppPhoneLabel } from '../../../lib/commWhatsAppService';
import { toast } from '../../../lib/toast';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../../lib/supabase';

const CHAT_POLL_INTERVAL_MS = 8000;
const MESSAGE_POLL_INTERVAL_MS = 5000;
const SCROLL_BOTTOM_THRESHOLD_PX = 96;

type MessageLoadReason = 'initial' | 'poll' | 'send';

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
    return 'message-bubble message-bubble-outbound ml-auto';
  }

  if (direction === 'system') {
    return 'message-bubble message-bubble-system mx-auto';
  }

  return 'message-bubble message-bubble-inbound mr-auto';
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
  const latestChatsRef = useRef<CommWhatsAppChat[]>([]);
  const chatsSignatureRef = useRef('');
  const messagesSignatureRef = useRef('');
  const pendingScrollModeRef = useRef<'bottom' | null>(null);
  const isNearBottomRef = useRef(true);
  const hasTypedMessage = messageDraft.trim().length > 0;

  const buildChatsSignature = useCallback(
    (items: CommWhatsAppChat[]) =>
      items
        .map(
          (chat) =>
            `${chat.id}:${chat.updated_at}:${chat.unread_count}:${chat.last_message_at ?? ''}:${chat.last_message_text ?? ''}:${chat.display_name}`,
        )
        .join('|'),
    [],
  );

  const buildMessagesSignature = useCallback(
    (items: CommWhatsAppMessage[]) =>
      items
        .map(
          (message) =>
            `${message.id}:${message.external_message_id ?? ''}:${message.delivery_status}:${message.message_at}:${message.text_content ?? ''}`,
        )
        .join('|'),
    [],
  );

  const getSelectedChatSnapshot = useCallback((chatId: string | null) => {
    if (!chatId) return null;
    return latestChatsRef.current.find((chat) => chat.id === chatId) ?? null;
  }, []);

  const isScrolledNearBottom = useCallback((element: HTMLDivElement) => {
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    return remaining <= SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

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

  useEffect(() => {
    latestChatsRef.current = chats;
  }, [chats]);

  const loadChats = useCallback(async () => {
    try {
      const data = await commWhatsAppService.listChats({
        search,
        onlyUnread,
      });

      const nextSignature = buildChatsSignature(data);

      if (nextSignature !== chatsSignatureRef.current) {
        chatsSignatureRef.current = nextSignature;
        setChats(data);
      }

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
  }, [buildChatsSignature, onlyUnread, search]);

  const loadMessages = useCallback(async (chat: CommWhatsAppChat | null, reason: MessageLoadReason = 'poll') => {
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

      const nextSignature = buildMessagesSignature(data);
      if (nextSignature === messagesSignatureRef.current) {
        return;
      }

      messagesSignatureRef.current = nextSignature;
      if (reason === 'initial' || reason === 'send' || isNearBottomRef.current) {
        pendingScrollModeRef.current = 'bottom';
      }

      setMessages(data);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar mensagens', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as mensagens da conversa.');
    } finally {
      setLoadingMessages(false);
    }
  }, [buildMessagesSignature, loadChats]);

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
    if (!selectedChatId) {
      setMessages([]);
      messagesSignatureRef.current = '';
      return;
    }

    messagesSignatureRef.current = '';
    pendingScrollModeRef.current = 'bottom';
    isNearBottomRef.current = true;
    setMessages([]);

    void loadMessages(getSelectedChatSnapshot(selectedChatId), 'initial');
  }, [getSelectedChatSnapshot, loadMessages, selectedChatId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadChats();
    }, CHAT_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChat) return;

    const intervalId = window.setInterval(() => {
      void loadMessages(getSelectedChatSnapshot(selectedChat.id), 'poll');
    }, MESSAGE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [getSelectedChatSnapshot, loadMessages, selectedChat]);

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

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (pendingScrollModeRef.current === 'bottom') {
      container.scrollTop = container.scrollHeight;
      isNearBottomRef.current = true;
    }

    pendingScrollModeRef.current = null;
  }, [messages, selectedChatId]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    isNearBottomRef.current = isScrolledNearBottom(container);
  }, [isScrolledNearBottom]);

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
      await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
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
    <div className="whatsapp-inbox-shell panel-page-shell h-full overflow-hidden p-3 sm:p-4 lg:p-5">
      <section className="grid h-full min-h-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="whatsapp-inbox-panel whatsapp-inbox-sidebar flex h-full min-h-0 flex-col rounded-[28px] border shadow-sm">
          <div className="whatsapp-inbox-sidebar-header border-b p-4">
            <div className="flex flex-col gap-3">
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                leftIcon={Search}
                className="whatsapp-inbox-search-input"
              />
              <label className="inline-flex items-center gap-2 text-sm text-[var(--panel-text-muted,#6b7280)]">
                <Checkbox checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />
                Mostrar apenas nao lidas
              </label>
            </div>
          </div>

          <div className="whatsapp-inbox-sidebar-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : chats.length === 0 ? (
              <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center">
                <MessageCircle className="h-8 w-8 whatsapp-inbox-empty-icon" />
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
                  className={`whatsapp-inbox-chat-card mb-2 flex w-full flex-col rounded-3xl border px-4 py-3 text-left transition ${chat.id === selectedChatId ? 'is-active' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--panel-text,#1f2937)]">{chat.display_name}</p>
                      <p className="truncate text-xs text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(chat.phone_number)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="whatsapp-inbox-chat-meta text-[11px] uppercase tracking-[0.12em]">{formatMessageTime(chat.last_message_at)}</span>
                      {chat.unread_count > 0 && (
                        <span className="whatsapp-inbox-unread-badge inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
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

        <div className="whatsapp-inbox-panel whatsapp-inbox-thread flex h-full min-h-0 flex-col rounded-[28px] border shadow-sm">
          {!selectedChat ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <MessageCircle className="h-10 w-10 whatsapp-inbox-empty-icon" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--panel-text,#1f2937)]">Selecione uma conversa</p>
                <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Abra um chat na coluna da esquerda para acompanhar o historico e responder.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="whatsapp-inbox-thread-header border-b p-5">
                <p className="text-lg font-semibold text-[var(--panel-text,#1f2937)]">{selectedChat.display_name}</p>
                <p className="mt-1 text-sm text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</p>
              </div>

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="whatsapp-inbox-messages min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5"
              >
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
                    <div key={message.id} className={`message-bubble-row flex w-full ${message.direction === 'outbound' ? 'justify-end' : message.direction === 'system' ? 'justify-center' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${getMessageBubbleClasses(message.direction)}`}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text_content || '[Mensagem sem texto]'}</p>
                        <div className="whatsapp-inbox-message-meta mt-2 flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.08em]">
                          <span>{formatMessageTime(message.message_at)}</span>
                          {message.direction === 'outbound' && <span>{message.delivery_status}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="whatsapp-inbox-composer-area border-t p-4 sm:p-5">
                <div className="whatsapp-inbox-composer rounded-[30px] border px-3 py-2.5">
                  <div className="flex items-end gap-1.5 sm:gap-2">
                    <div className="flex shrink-0 items-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleComposerAuxClick('attach')}
                        className="whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-full transition"
                        aria-label="Anexar"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleComposerAuxClick('emoji')}
                        className="whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-full transition"
                        aria-label="Emojis"
                      >
                        <Smile className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 self-stretch py-2">
                      <textarea
                        ref={composerTextareaRef}
                        rows={1}
                        value={messageDraft}
                        onChange={(event) => setMessageDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder="Digite uma mensagem"
                        disabled={sending}
                        className="whatsapp-inbox-composer-input block w-full resize-none border-none bg-transparent px-0 py-0 text-[15px] leading-6 focus:outline-none"
                      />
                    </div>

                    <div className="flex shrink-0 items-end pb-0.5">
                      <button
                        type="button"
                        onClick={handleComposerSubmit}
                        disabled={sending}
                        className={`whatsapp-inbox-composer-action inline-flex h-11 w-11 items-center justify-center rounded-full transition ${hasTypedMessage ? 'is-active' : ''} ${sending ? 'cursor-wait opacity-70' : ''}`}
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
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
