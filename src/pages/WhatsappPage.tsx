import { useCallback, useEffect, useMemo, useState } from 'react';
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

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Falha na requisição');
  }
  return response.json() as Promise<T>;
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

  const selectedChat = useMemo(
    () => chats.find(chat => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchJson<{ chats: WhatsappChat[] }>('/api/chats');
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
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setMessagesLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchJson<{ messages: WhatsappMessage[] }>(`/api/chats/${selectedChatId}/messages`);
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
  };

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
      const response = await fetchJson<SendMessageResponse>('/api/zapi/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedChat.phone, message: trimmedMessage }),
      });

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

  return (
    <div className="flex h-full min-h-[600px] bg-white rounded-lg border border-slate-200 overflow-hidden">
      <aside className="w-72 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Conversas</h2>
          {errorMessage && (
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {chatsLoading && chats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Carregando conversas...</p>
          ) : chats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma conversa encontrada.</p>
          ) : (
            chats.map(chat => {
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

      <section className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <header className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                {selectedChat.sender_photo ? (
                  <img
                    src={selectedChat.sender_photo}
                    alt={selectedChat.chat_name || selectedChat.phone}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-semibold">
                    {(selectedChat.chat_name || selectedChat.phone).charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-800">
                    {selectedChat.chat_name || selectedChat.phone}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedChat.is_group ? 'Grupo' : 'Contato'} • {selectedChat.phone}
                  </p>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3">
              {messagesLoading && messages.length === 0 ? (
                <p className="text-sm text-slate-500">Carregando mensagens...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma mensagem neste chat.</p>
              ) : (
                messages.map(message => {
                  const isFromMe = message.from_me;
                  const alignment = isFromMe ? 'items-end text-right' : 'items-start text-left';
                  const bubbleClasses = isFromMe
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-800';

                  return (
                    <div key={message.id} className={`flex flex-col ${alignment}`}>
                      <div
                        className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${
                          isFromMe ? 'rounded-br-none' : 'rounded-bl-none'
                        } ${bubbleClasses}`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm">{message.text || ''}</p>
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

            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-white">
              <div className="flex items-end gap-3">
                <textarea
                  className="flex-1 resize-none rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                  value={messageInput}
                  onChange={event => setMessageInput(event.target.value)}
                  placeholder="Digite sua mensagem"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition disabled:opacity-60"
                  disabled={sendingMessage}
                >
                  Enviar
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
