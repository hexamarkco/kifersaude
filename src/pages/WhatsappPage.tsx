import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { AudioMessageBubble } from '../components/AudioMessageBubble';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { WhatsappChat, WhatsappMessage } from '../types/whatsapp';

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type OptimisticMessage = WhatsappMessage & { isOptimistic?: boolean };

type SendMessageResponse =
  | {
      success: true;
      message: WhatsappMessage;
      chat: WhatsappChat;
    }
  | {
      success: false;
      error?: string;
    };

type WhatsappMessageRawPayload = {
  image?: {
    imageUrl?: string | null;
    caption?: string | null;
  } | null;
  audio?: {
    audioUrl?: string | null;
    seconds?: number | null;
  } | null;
  video?: {
    videoUrl?: string | null;
    caption?: string | null;
  } | null;
  document?: {
    documentUrl?: string | null;
    fileName?: string | null;
    title?: string | null;
    caption?: string | null;
  } | null;
  [key: string]: unknown;
};

const UNSUPPORTED_MESSAGE_PLACEHOLDER = '[tipo de mensagem não suportado ainda]';

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getWhatsappFunctionUrl = (path: string) => {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();

  if (!functionsUrl && !supabaseUrl) {
    throw new Error(
      'Variáveis VITE_SUPABASE_FUNCTIONS_URL ou VITE_SUPABASE_URL não configuradas.',
    );
  }

  const normalizedBase = (() => {
    if (functionsUrl) {
      return functionsUrl.replace(/\/+$/, '');
    }

    // supabaseUrl is guaranteed to exist here because of the guard above
    const trimmedSupabase = supabaseUrl!.replace(/\/+$/, '');
    return `${trimmedSupabase}/functions/v1`;
  })();

  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
};

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Falha na requisição');
  }
  return response.json() as Promise<T>;
};

const sortMessagesByMoment = (messageList: OptimisticMessage[]) => {
  return [...messageList].sort((first, second) => {
    const firstMoment = first.moment ? new Date(first.moment).getTime() : 0;
    const secondMoment = second.moment ? new Date(second.moment).getTime() : 0;

    const safeFirstMoment = Number.isNaN(firstMoment) ? 0 : firstMoment;
    const safeSecondMoment = Number.isNaN(secondMoment) ? 0 : secondMoment;

    return safeFirstMoment - safeSecondMoment;
  });
};

export default function WhatsappPage() {
  const [chats, setChats] = useState<WhatsappChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showChatListMobile, setShowChatListMobile] = useState(true);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const selectedChatIdRef = useRef<string | null>(null);

  const selectedChat = useMemo(
    () => chats.find(chat => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const filteredChats = useMemo(() => {
    if (!chatSearchTerm.trim()) {
      return chats;
    }

    const normalizedTerm = chatSearchTerm.trim().toLowerCase();
    return chats.filter(chat => {
      const name = chat.chat_name?.toLowerCase() ?? '';
      const phone = chat.phone?.toLowerCase() ?? '';
      const preview = chat.last_message_preview?.toLowerCase() ?? '';

      return (
        name.includes(normalizedTerm) ||
        phone.includes(normalizedTerm) ||
        preview.includes(normalizedTerm)
      );
    });
  }, [chatSearchTerm, chats]);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchJson<{ chats: WhatsappChat[] }>(
        getWhatsappFunctionUrl('/whatsapp-webhook/chats'),
      );
      setChats(data.chats);
      if (!selectedChatId && data.chats.length > 0) {
        setSelectedChatId(data.chats[0].id);
      }
    } catch (error: any) {
      console.error('Erro ao carregar chats:', error);
      setErrorMessage('Não foi possível carregar as conversas.');
    } finally {
      setChatsLoading(false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-messages-listener')
      .on<RealtimePostgresChangesPayload<WhatsappMessage>>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deletedMessage = payload.old;
            if (!deletedMessage) {
              return;
            }

            setMessages(previousMessages => {
              const currentChatId = selectedChatIdRef.current;
              if (!currentChatId || deletedMessage.chat_id !== currentChatId) {
                return previousMessages;
              }

              return previousMessages.filter(message => message.id !== deletedMessage.id);
            });
            return;
          }

          const incomingMessage = payload.new;
          if (!incomingMessage) {
            return;
          }

          const normalizedMessage: OptimisticMessage = {
            ...incomingMessage,
            isOptimistic: false,
          };

          setMessages(previousMessages => {
            const currentChatId = selectedChatIdRef.current;
            if (currentChatId !== normalizedMessage.chat_id) {
              return previousMessages;
            }

            const existingIndex = previousMessages.findIndex(
              message => message.id === normalizedMessage.id,
            );

            if (existingIndex !== -1) {
              const updatedMessages = [...previousMessages];
              updatedMessages[existingIndex] = normalizedMessage;
              return sortMessagesByMoment(updatedMessages);
            }

            return sortMessagesByMoment([...previousMessages, normalizedMessage]);
          });

          let chatExists = true;
          setChats(previousChats => {
            const existingIndex = previousChats.findIndex(
              chat => chat.id === normalizedMessage.chat_id,
            );

            if (existingIndex === -1) {
              chatExists = false;
              return previousChats;
            }

            const existingChat = previousChats[existingIndex];
            const updatedChat: WhatsappChat = {
              ...existingChat,
              last_message_preview:
                normalizedMessage.text ?? existingChat.last_message_preview ?? null,
              last_message_at:
                normalizedMessage.moment ?? existingChat.last_message_at ?? null,
            };

            const otherChats = previousChats.filter(chat => chat.id !== normalizedMessage.chat_id);
            return [updatedChat, ...otherChats];
          });

          if (!chatExists) {
            void loadChats();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setMessagesLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchJson<{ messages: WhatsappMessage[] }>(
          getWhatsappFunctionUrl(
            `/whatsapp-webhook/chats/${encodeURIComponent(selectedChatId)}/messages`,
          ),
        );
        setMessages(data.messages.map(message => ({ ...message, isOptimistic: false })));
      } catch (error: any) {
        console.error('Erro ao carregar mensagens:', error);
        setErrorMessage('Não foi possível carregar as mensagens.');
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [selectedChatId]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowChatListMobile(false);
    }
  };

  const handleBackToChats = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowChatListMobile(true);
    }
  };

  useEffect(() => {
    if (!selectedChatId) {
      setShowChatListMobile(true);
    }
  }, [selectedChatId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChat || sendingMessage) {
      return;
    }

    const trimmedMessage = messageInput.trim();
    if (trimmedMessage.length === 0) {
      return;
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: OptimisticMessage = {
      id: optimisticId,
      chat_id: selectedChat.id,
      message_id: null,
      from_me: true,
      status: 'SENDING',
      text: trimmedMessage,
      moment: new Date().toISOString(),
      raw_payload: null,
      isOptimistic: true,
    };

    setMessages(previous => [...previous, optimisticMessage]);
    setMessageInput('');
    setSendingMessage(true);
    setErrorMessage(null);

    try {
      const response = await fetchJson<SendMessageResponse>(
        getWhatsappFunctionUrl('/whatsapp-webhook/send-message'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: selectedChat.phone, message: trimmedMessage }),
        },
      );

      if (!response.success) {
        throw new Error(response.error || 'Resposta inválida do servidor');
      }

      const serverMessage: OptimisticMessage = {
        ...response.message,
        isOptimistic: false,
      };

      setMessages(previous =>
        previous.map(message => (message.id === optimisticId ? serverMessage : message)),
      );

      setChats(previous => {
        const updatedChat: WhatsappChat = {
          ...response.chat,
          last_message_preview: response.message.text ?? response.chat.last_message_preview ?? null,
          last_message_at: response.message.moment ?? response.chat.last_message_at ?? null,
        };

        const otherChats = previous.filter(chat => chat.id !== updatedChat.id);
        return [updatedChat, ...otherChats];
      });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages(previous => previous.filter(message => message.id !== optimisticId));
      setErrorMessage('Não foi possível enviar a mensagem.');
    } finally {
      setSendingMessage(false);
    }
  };

  type MessageAttachmentInfo = {
    imageUrl: string | null;
    imageCaption: string | null;
    audioUrl: string | null;
    audioSeconds: number | null;
    videoUrl: string | null;
    videoCaption: string | null;
    documentUrl: string | null;
    documentFileName: string;
    documentCaption: string | null;
    hasMediaWithoutPadding: boolean;
  };

  const getMessageAttachmentInfo = (message: OptimisticMessage): MessageAttachmentInfo => {
    const payload =
      message.raw_payload && typeof message.raw_payload === 'object'
        ? (message.raw_payload as WhatsappMessageRawPayload)
        : null;

    const imageUrl = payload ? toNonEmptyString(payload?.image?.imageUrl) : null;
    const videoUrl = payload ? toNonEmptyString(payload?.video?.videoUrl) : null;
    const documentUrl = payload ? toNonEmptyString(payload?.document?.documentUrl) : null;
    const audioUrl = payload ? toNonEmptyString(payload?.audio?.audioUrl) : null;

    return {
      imageUrl,
      imageCaption: payload ? toNonEmptyString(payload?.image?.caption) : null,
      audioUrl,
      audioSeconds: payload?.audio?.seconds ?? null,
      videoUrl,
      videoCaption: payload ? toNonEmptyString(payload?.video?.caption) : null,
      documentUrl,
      documentFileName:
        toNonEmptyString(payload?.document?.fileName) ??
        toNonEmptyString(payload?.document?.title) ??
        'Documento',
      documentCaption: payload ? toNonEmptyString(payload?.document?.caption) : null,
      hasMediaWithoutPadding: Boolean(imageUrl || videoUrl),
    };
  };

  const renderMessageContent = (message: OptimisticMessage, attachmentInfo: MessageAttachmentInfo) => {
    const isFromMe = message.from_me;

    const attachments: JSX.Element[] = [];

    if (attachmentInfo.imageUrl) {
      attachments.push(
        <div key="image" className="flex flex-col">
          <img
            src={attachmentInfo.imageUrl}
            alt={attachmentInfo.imageCaption ?? 'Imagem recebida'}
            className="block max-h-80 w-full bg-slate-200/40 object-contain"
          />
          {attachmentInfo.imageCaption ? (
            <div className={`px-4 pb-4 pt-3 text-sm ${isFromMe ? 'text-white/90' : 'text-slate-700'}`}>
              <p className="whitespace-pre-wrap break-words">{attachmentInfo.imageCaption}</p>
            </div>
          ) : null}
        </div>,
      );
    }

    if (attachmentInfo.videoUrl) {
      attachments.push(
        <div key="video" className="flex flex-col">
          <video
            controls
            preload="metadata"
            src={attachmentInfo.videoUrl}
            className="block max-h-80 w-full bg-black"
          />
          {attachmentInfo.videoCaption ? (
            <div className={`px-4 pb-4 pt-3 text-sm ${isFromMe ? 'text-white/90' : 'text-slate-700'}`}>
              <p className="whitespace-pre-wrap break-words">{attachmentInfo.videoCaption}</p>
            </div>
          ) : null}
        </div>,
      );
    }

    if (attachmentInfo.audioUrl) {
      attachments.push(
        <div key="audio" className="flex flex-col gap-2 rounded-lg bg-white p-3 text-slate-800">
          <AudioMessageBubble src={attachmentInfo.audioUrl} seconds={attachmentInfo.audioSeconds} />
        </div>,
      );
    }

    if (attachmentInfo.documentUrl) {
      attachments.push(
        <div key="document" className="flex flex-col gap-3 rounded-lg bg-white p-3 text-slate-800">
          <div className="overflow-hidden rounded-md border border-slate-200">
            <iframe
              src={attachmentInfo.documentUrl}
              title={`Pré-visualização do documento ${attachmentInfo.documentFileName}`}
              className="h-64 w-full border-0"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{attachmentInfo.documentFileName}</p>
              {attachmentInfo.documentCaption ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {attachmentInfo.documentCaption}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={attachmentInfo.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
              >
                Abrir
              </a>
              <a
                href={attachmentInfo.documentUrl}
                download
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Baixar
              </a>
            </div>
          </div>
        </div>,
      );
    }

    const fallbackText = message.text?.trim() ?? '';
    const shouldRenderFallbackText =
      fallbackText &&
      fallbackText !== UNSUPPORTED_MESSAGE_PLACEHOLDER &&
      attachments.length === 0;

    if (shouldRenderFallbackText) {
      attachments.push(
        <p key="text" className={`whitespace-pre-wrap break-words text-sm ${isFromMe ? 'text-white' : ''}`}>
          {fallbackText}
        </p>,
      );
    }

    if (attachments.length === 1) {
      return attachments[0];
    }

    if (attachments.length > 1) {
      return <div className="flex flex-col gap-2">{attachments}</div>;
    }

    return (
      <p className="whitespace-pre-wrap break-words text-sm">
        {fallbackText || UNSUPPORTED_MESSAGE_PLACEHOLDER}
      </p>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:flex-row">
      <aside
        className={`${showChatListMobile ? 'flex' : 'hidden'} md:flex w-full flex-1 flex-col border-b border-slate-200 md:w-80 md:flex-none md:border-b-0 md:border-r min-h-0`}
      >
        <div className="flex-shrink-0 border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-800">Conversas</h2>
          {errorMessage && (
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          )}
          <div className="mt-3">
            <label className="sr-only" htmlFor="whatsapp-chat-search">
              Pesquisar conversas
            </label>
            <input
              id="whatsapp-chat-search"
              type="search"
              value={chatSearchTerm}
              onChange={event => setChatSearchTerm(event.target.value)}
              placeholder="Pesquisar conversas"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
          {chatsLoading && chats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Carregando conversas...</p>
          ) : chats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma conversa encontrada.</p>
          ) : filteredChats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma conversa encontrada para a pesquisa.</p>
          ) : (
            filteredChats.map(chat => {
              const isActive = chat.id === selectedChatId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => handleSelectChat(chat.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    isActive ? 'bg-emerald-50 border-l-4 border-emerald-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">
                      {chat.chat_name || chat.phone}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(chat.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 truncate">
                    {chat.last_message_preview || 'Sem mensagens recentes'}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`${showChatListMobile ? 'hidden' : 'flex'} md:flex flex-1 min-h-0 flex-col`}>
        {selectedChat ? (
          <>
            <header className="flex-shrink-0 border-b border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToChats}
                  className="md:hidden inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                  aria-label="Voltar para lista de conversas"
                >
                  ←
                </button>
                {selectedChat.sender_photo ? (
                  <img
                    src={selectedChat.sender_photo}
                    alt={selectedChat.chat_name || selectedChat.phone}
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-semibold text-emerald-600">
                    {(selectedChat.chat_name || selectedChat.phone).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">
                    {selectedChat.chat_name || selectedChat.phone}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {selectedChat.is_group ? 'Grupo' : 'Contato'} • {selectedChat.phone}
                  </p>
                </div>
              </div>
            </header>

            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {messagesLoading && messages.length === 0 ? (
                <p className="text-sm text-slate-500">Carregando mensagens...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma mensagem neste chat.</p>
              ) : (
                messages.map(message => {
                  const isFromMe = message.from_me;
                  const attachmentInfo = getMessageAttachmentInfo(message);
                  const alignment = isFromMe ? 'items-end text-right' : 'items-start text-left';
                  const hasMediaWithoutPadding = attachmentInfo.hasMediaWithoutPadding;
                  const hasOnlyMediaWithoutPadding =
                    hasMediaWithoutPadding && !attachmentInfo.audioUrl && !attachmentInfo.documentUrl;
                  const bubblePaddingClasses = hasMediaWithoutPadding ? 'p-0' : 'px-4 py-3';
                  const bubbleOverflowClass = hasOnlyMediaWithoutPadding ? 'overflow-hidden' : '';
                  const bubbleClasses = isFromMe
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-800';

                  return (
                    <div key={message.id} className={`flex flex-col ${alignment}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl shadow-sm ${
                          isFromMe ? 'rounded-br-none' : 'rounded-bl-none'
                        } ${bubblePaddingClasses} ${bubbleOverflowClass} ${bubbleClasses}`}
                      >
                        {renderMessageContent(message, attachmentInfo)}
                      </div>
                      <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                        {formatDateTime(message.moment)}{' '}
                        {message.isOptimistic ? '(enviando...)' : message.status || ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4"
            >
              <div className="flex w-full items-center gap-3 border border-slate-200 bg-slate-50/60 px-3 py-2 rounded">
                <textarea
                  className="flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-6 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  maxLength={1000}
                  rows={1}
                  value={messageInput}
                  onChange={event => setMessageInput(event.target.value)}
                  placeholder="Digite sua mensagem"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center bg-emerald-500 text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 rounded"
                  disabled={sendingMessage}
                  aria-label="Enviar mensagem"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-500">Selecione uma conversa para começar.</p>
          </div>
        )}
      </section>
    </div>
  );
}
