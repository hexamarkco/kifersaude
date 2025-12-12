import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, MessageCircle, Phone, Video, MoreVertical, ArrowLeft, Users, Info } from 'lucide-react';
import { MessageInput } from './MessageInput';
import { MessageBubble } from './MessageBubble';
import { MessageHistoryPanel } from './MessageHistoryPanel';
import { GroupInfoPanel } from './GroupInfoPanel';
import { getWhatsAppContacts } from '../../lib/whatsappApiService';

type WhatsAppChat = {
  id: string;
  name: string | null;
  is_group: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
};

type WhatsAppMessage = {
  id: string;
  chat_id: string;
  from_number: string | null;
  to_number: string | null;
  type: string | null;
  body: string | null;
  has_media: boolean;
  timestamp: string | null;
  direction: 'inbound' | 'outbound' | null;
  ack_status: number | null;
  created_at: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  edit_count?: number;
  edited_at?: string | null;
  original_body?: string | null;
  author?: string | null;
};

export default function WhatsAppTab() {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: string;
    body: string;
    from: string;
  } | null>(null);
  const [editMessage, setEditMessage] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const [leadNamesByPhone, setLeadNamesByPhone] = useState<Map<string, string>>(new Map());
  const [contactsById, setContactsById] = useState<Map<string, { name: string; saved: boolean }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function normalizePhoneNumber(phone: string | null | undefined) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');

    if (digits.length > 11) {
      const trimmed = digits.replace(/^55/, '');
      return trimmed.slice(-11);
    }

    return digits;
  }

  const extractPhoneFromChatId = (chatId: string) => normalizePhoneNumber(chatId);

  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  useEffect(() => {
    const loadLeadNames = async () => {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('telefone, nome_completo');

        if (error) throw error;

        const phoneMap = new Map<string, string>();
        (data || []).forEach((lead) => {
          const normalizedPhone = normalizePhoneNumber(lead.telefone);
          if (normalizedPhone && !phoneMap.has(normalizedPhone)) {
            phoneMap.set(normalizedPhone, lead.nome_completo);
          }
        });

        setLeadNamesByPhone(phoneMap);
      } catch (err) {
        console.error('Error loading lead names:', err);
      }
    };

    const loadSavedContacts = async () => {
      try {
        const response = await getWhatsAppContacts();
        const contactMap = new Map<string, { name: string; saved: boolean }>();

        response.contacts.forEach((contact) => {
          contactMap.set(contact.id, { name: contact.name, saved: contact.saved });
        });

        setContactsById(contactMap);
      } catch (err) {
        console.error('Error loading WhatsApp contacts:', err);
      }
    };

    loadLeadNames();
    loadSavedContacts();
  }, []);

  useEffect(() => {
    loadChats();

    const chatsSubscription = supabase
      .channel('whatsapp_chats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, () => {
        loadChats();
      })
      .subscribe();

    const messagesGlobalSubscription = supabase
      .channel('whatsapp_messages_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => {
        loadChats();
      })
      .subscribe();

    return () => {
      chatsSubscription.unsubscribe();
      messagesGlobalSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);

      const messagesSubscription = supabase
        .channel(`messages_${selectedChat.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${selectedChat.id}` },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as WhatsAppMessage]);
            scrollToBottom();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${selectedChat.id}` },
          (payload) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? (payload.new as WhatsAppMessage) : msg
              )
            );
          }
        )
        .subscribe();

      return () => {
        messagesSubscription.unsubscribe();
      };
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatsWithLastMessage = await Promise.all(
        (data || []).map(async (chat) => {
          const { data: lastMsg } = await supabase
            .from('whatsapp_messages')
            .select('body')
            .eq('chat_id', chat.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...chat,
            last_message: lastMsg?.body || null,
          };
        })
      );

      setChats(chatsWithLastMessage);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleReply = (messageId: string, body: string, from: string) => {
    setEditMessage(null);
    setReplyToMessage({ id: messageId, body, from });
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleEdit = (messageId: string, body: string) => {
    setReplyToMessage(null);
    setEditMessage({ id: messageId, body });
  };

  const handleCancelEdit = () => {
    setEditMessage(null);
  };

  const handleMessageSent = () => {
    loadMessages(selectedChat!.id);
    scrollToBottom();
  };

  const filteredChats = chats.filter((chat) => {
    const displayName = getChatDisplayName(chat).toLowerCase();
    return displayName.includes(searchQuery.toLowerCase()) || chat.id.includes(searchQuery);
  });

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    const words = name.split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }

    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }

    return cleaned || phone;
  };

  const getChatDisplayName = (chat: WhatsAppChat) => {
    if (chat.is_group) return chat.name || chat.id;

    const phone = extractPhoneFromChatId(chat.id);

    if (phone && leadNamesByPhone.has(phone)) {
      return leadNamesByPhone.get(phone)!;
    }

    const contact = contactsById.get(chat.id);
    if (contact?.saved && contact.name) {
      return contact.name;
    }

    if (phone) {
      return formatPhone(phone);
    }

    return chat.id;
  };

  const selectedChatDisplayName = selectedChat ? getChatDisplayName(selectedChat) : '';

  const showChatList = !isMobileView || !selectedChat;
  const showMessageArea = !isMobileView || selectedChat;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50">
      {showChatList && (
        <div className={`${isMobileView ? 'w-full' : 'w-96'} bg-white border-r border-slate-200 flex flex-col`}>
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <MessageCircle className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium">Nenhuma conversa</p>
                <p className="text-sm">As mensagens do WhatsApp aparecerão aqui</p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const chatDisplayName = getChatDisplayName(chat);

                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 flex items-start gap-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      selectedChat?.id === chat.id ? 'bg-teal-50' : ''
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                        chat.is_group ? 'bg-blue-500' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {chat.is_group ? (
                          <Users className="w-6 h-6" />
                        ) : (
                          getInitials(chatDisplayName)
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <h3 className="font-medium text-slate-900 truncate">
                            {chatDisplayName}
                          </h3>
                          {chat.is_group && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                              Grupo
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                          {formatTime(chat.last_message_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 truncate">
                        {chat.last_message || 'Sem mensagens'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {showMessageArea && (
        <div className={`${isMobileView ? 'w-full' : 'flex-1'} flex flex-col bg-slate-100 relative`}>
          {selectedChat ? (
            <>
              <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-3">
                {isMobileView && (
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                )}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                  selectedChat.is_group ? 'bg-blue-500' : 'bg-teal-100 text-teal-700'
                }`}>
                  {selectedChat.is_group ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    getInitials(selectedChatDisplayName)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900 truncate">
                      {selectedChatDisplayName || selectedChat.id}
                    </h2>
                    {selectedChat.is_group && (
                      <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Grupo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedChat.is_group ? 'Toque para ver info do grupo' : 'Online'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedChat.is_group ? (
                    <button
                      onClick={() => setShowGroupInfo(!showGroupInfo)}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      title="Informações do grupo"
                    >
                      <Info className="w-5 h-5 text-slate-600" />
                    </button>
                  ) : (
                    <>
                      <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <Phone className="w-5 h-5 text-slate-600" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <Video className="w-5 h-5 text-slate-600" />
                      </button>
                    </>
                  )}
                  <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <p>Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const showAuthor = selectedChat.is_group && message.direction === 'inbound' && message.author;
                    const authorName = showAuthor ? formatPhone(message.author!) : undefined;

                    return (
                      <div key={message.id}>
                        {showAuthor && (
                          <div className="text-xs text-slate-500 mb-1 ml-2">
                            {authorName}
                          </div>
                        )}
                        <MessageBubble
                          id={message.id}
                          chatId={selectedChat.id}
                          body={message.body}
                          type={message.type}
                          direction={message.direction || 'inbound'}
                          timestamp={message.timestamp}
                          ackStatus={message.ack_status}
                          hasMedia={message.has_media}
                          fromName={authorName}
                          isDeleted={message.is_deleted}
                          deletedAt={message.deleted_at}
                          editCount={message.edit_count}
                          editedAt={message.edited_at}
                          originalBody={message.original_body}
                          onReply={handleReply}
                          onEdit={handleEdit}
                        />
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <MessageHistoryPanel chatId={selectedChat.id} chatName={selectedChatDisplayName || selectedChat.id} />

              <MessageInput
                chatId={selectedChat.id}
                onMessageSent={handleMessageSent}
                replyToMessage={replyToMessage}
                onCancelReply={handleCancelReply}
                editMessage={editMessage}
                onCancelEdit={handleCancelEdit}
              />

              {showGroupInfo && selectedChat.is_group && (
                <GroupInfoPanel
                  groupId={selectedChat.id}
                  onClose={() => setShowGroupInfo(false)}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <MessageCircle className="w-24 h-24 mb-4 text-slate-300" />
              <h2 className="text-2xl font-semibold mb-2">WhatsApp Web</h2>
              <p className="text-center max-w-md">
                Selecione uma conversa para começar a enviar e receber mensagens
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
