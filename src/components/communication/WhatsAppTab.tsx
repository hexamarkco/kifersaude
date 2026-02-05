import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, fetchAllPages } from '../../lib/supabase';
import { Search, MessageCircle, Phone, Video, MoreVertical, ArrowLeft, Users, Info, History } from 'lucide-react';
import { MessageInput, type SentMessagePayload } from './MessageInput';
import { useAuth } from '../../contexts/AuthContext';
import { MessageBubble } from './MessageBubble';
import { MessageHistoryPanel } from './MessageHistoryPanel';
import { GroupInfoPanel } from './GroupInfoPanel';
import {
  buildChatIdFromPhone,
  getWhatsAppChat,
  getWhatsAppChats,
  getWhatsAppContacts,
  getWhatsAppMessageHistory,
  normalizeChatId,
  reactToMessage,
  removeReactionFromMessage,
  type WhapiChat,
  type WhapiChatMetadata,
  type WhapiMessage,
} from '../../lib/whatsappApiService';

type WhatsAppChat = {
  id: string;
  name: string | null;
  is_group: boolean;
  phone_number?: string | null;
  lid?: string | null;
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
  payload?: any;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  edit_count?: number;
  edited_at?: string | null;
  original_body?: string | null;
  author?: string | null;
};

const normalizeWhapiBody = (message: WhapiMessage): { body: string; hasMedia: boolean } => {
  const raw = message as WhapiMessage & Record<string, any>;
  if (raw.text?.body) return { body: raw.text.body, hasMedia: false };
  if (raw.image) return { body: raw.image.caption || '[Imagem]', hasMedia: true };
  if (raw.video) return { body: raw.video.caption || '[Vídeo]', hasMedia: true };
  if (raw.audio) return { body: '[Áudio]', hasMedia: true };
  if (raw.voice) return { body: '[Mensagem de voz]', hasMedia: true };
  if (raw.document) {
    const fileName = raw.document.filename || '';
    const caption = raw.document.caption;
    return {
      body: caption ? `${caption} [Documento: ${fileName}]` : `[Documento${fileName ? `: ${fileName}` : ''}]`,
      hasMedia: true,
    };
  }
  if (raw.location) return { body: '[Localização]', hasMedia: true };
  if (raw.live_location) return { body: '[Localização ao vivo]', hasMedia: true };
  if (raw.contact) return { body: `[Contato: ${raw.contact.name}]`, hasMedia: false };
  if (raw.contact_list) return { body: `[${raw.contact_list.list.length} contato(s)]`, hasMedia: false };
  if (raw.sticker) return { body: '[Sticker]', hasMedia: true };
  if (raw.action?.type === 'reaction') return { body: `Reagiu com ${raw.action.emoji || ''}`, hasMedia: false };
  if (raw.action?.type === 'delete') return { body: '[Mensagem apagada]', hasMedia: false };
  if (raw.action?.type === 'edit') return { body: raw.text?.body || '', hasMedia: false };
  if (raw.reply?.buttons_reply) return { body: `Resposta: ${raw.reply.buttons_reply.title}`, hasMedia: false };
  if (raw.group_invite) return { body: '[Convite para grupo]', hasMedia: false };
  if (raw.poll) return { body: `[Enquete: ${raw.poll.title}]`, hasMedia: false };
  if (raw.product) return { body: '[Produto do catálogo]', hasMedia: false };
  if (raw.order) return { body: `[Pedido #${raw.order.order_id}]`, hasMedia: false };
  return { body: `[${raw.type}]`, hasMedia: false };
};

const whapiToUiMessage = (message: WhapiMessage): WhatsAppMessage => {
  const raw = message as WhapiMessage & Record<string, any>;
  const direction = message.from_me ? 'outbound' : 'inbound';
  const timestamp = message.timestamp ? new Date(message.timestamp * 1000).toISOString() : null;
  const { body, hasMedia } = normalizeWhapiBody(message);

  return {
    id: message.id,
    chat_id: message.chat_id,
    from_number: direction === 'inbound' ? message.from || message.chat_id : null,
    to_number: direction === 'outbound' ? message.chat_id : null,
    type: message.type || null,
    body,
    has_media: hasMedia,
    timestamp,
    direction,
    ack_status: null,
    created_at: timestamp || new Date().toISOString(),
    payload: raw,
    is_deleted: raw.action?.type === 'delete' || message.type === 'revoked',
    edit_count: raw.edit_history?.length ?? 0,
    edited_at: raw.edited_at ? new Date(raw.edited_at * 1000).toISOString() : null,
    original_body: raw.text?.body ?? body,
    author: raw.from_name ?? null,
  };
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
  const [contactsList, setContactsList] = useState<Array<{ id: string; name: string; saved: boolean; pushname?: string }>>(
    [],
  );
  const [contactPhotosById, setContactPhotosById] = useState<Map<string, string>>(new Map());
  const [myReactionsByMessage, setMyReactionsByMessage] = useState<Map<string, string>>(new Map());
  const [groupNamesById, setGroupNamesById] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRef = useRef<WhatsAppChat | null>(null);
  const { user } = useAuth();

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

  const getChatIdVariants = (chat: WhatsAppChat) => {
    const variants = new Set<string>();
    if (chat.id) variants.add(chat.id);
    if (!chat.id.endsWith('@g.us')) {
      const normalized = normalizeChatId(chat.id);
      if (normalized) variants.add(normalized);
      if (normalized?.endsWith('@s.whatsapp.net')) {
        variants.add(normalized.replace(/@s\.whatsapp\.net$/i, '@c.us'));
      }
      if (chat.id.endsWith('@c.us')) {
        variants.add(chat.id.replace(/@c\.us$/i, '@s.whatsapp.net'));
      }
      if (chat.phone_number) {
        variants.add(buildChatIdFromPhone(chat.phone_number));
      }
    }
    if (chat.lid) variants.add(chat.lid);
    return Array.from(variants);
  };

  const shouldFetchGroupName = (chat: WhatsAppChat) => {
    if (!chat.is_group) return false;
    if (chat.name && chat.name.trim() && chat.name !== chat.id) return false;
    if (groupNamesById.has(chat.id)) return false;
    return true;
  };

  const loadGroupNames = async (currentChats: WhatsAppChat[]) => {
    const candidates = currentChats.filter(shouldFetchGroupName);
    if (candidates.length === 0) return;

    const updates = await Promise.all(
      candidates.map(async (chat) => {
        try {
          const metadata: WhapiChatMetadata = await getWhatsAppChat(chat.id);
          const name = metadata.name?.trim();
          return name ? { id: chat.id, name } : null;
        } catch (error) {
          console.warn('Error loading group name:', { chatId: chat.id, error });
          return null;
        }
      }),
    );

    const validUpdates = updates.filter((item): item is { id: string; name: string } => Boolean(item));
    if (validUpdates.length === 0) return;

    setGroupNamesById((prev) => {
      const next = new Map(prev);
      validUpdates.forEach((item) => next.set(item.id, item.name));
      return next;
    });

    setChats((prev) =>
      prev.map((chat) => {
        const match = validUpdates.find((item) => item.id === chat.id);
        return match ? { ...chat, name: match.name } : chat;
      }),
    );
  };

  const fetchWhapiMessages = async (chat: WhatsAppChat) => {
    const variants = getChatIdVariants(chat);
    for (const candidate of variants) {
      try {
        const response = await getWhatsAppMessageHistory({ chatId: candidate, count: 200, offset: 0 });
        if (response.messages?.length) {
          return response.messages;
        }
      } catch (error) {
        console.warn('[WhatsApp] Falha ao buscar mensagens do Whapi', { candidate, error });
      }
    }
    return [] as WhapiMessage[];
  };

  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    const loadLeadNames = async () => {
      try {
        const data = await fetchAllPages<{ telefone: string; nome_completo: string }>(async (from, to) => {
          const response = await supabase.from('leads').select('telefone, nome_completo').range(from, to);
          return { data: response.data, error: response.error };
        });

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

        setContactsList(
          response.contacts.map((contact) => ({
            id: contact.id,
            name: contact.name || contact.pushname || contact.id,
            saved: contact.saved,
            pushname: contact.pushname,
          })),
        );

        response.contacts.forEach((contact) => {
          const normalized = normalizeChatId(contact.id);
          if (normalized) {
            contactMap.set(normalized, { name: contact.name, saved: contact.saved });
            if (normalized.endsWith('@s.whatsapp.net')) {
              contactMap.set(
                normalized.replace(/@s\.whatsapp\.net$/i, '@c.us'),
                { name: contact.name, saved: contact.saved },
              );
            }
          }
          contactMap.set(contact.id, { name: contact.name, saved: contact.saved });
        });

        setContactsById(contactMap);
      } catch (err) {
        console.error('Error loading WhatsApp contacts:', err);
      }
    };

    const loadContactPhotos = async () => {
      const { data, error } = await supabase
        .from('whatsapp_contact_photos')
        .select('contact_id, public_url');

      if (error) {
        console.error('Error loading contact photos:', error);
        return;
      }

      const map = new Map<string, string>();
      (data || []).forEach((row) => {
        if (row.public_url) {
          map.set(row.contact_id, row.public_url);
        }
      });

      setContactPhotosById(map);
    };

    loadLeadNames();
    loadSavedContacts();
    loadContactPhotos();
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        loadChats();
        const currentChat = selectedChatRef.current;
        if (!currentChat) return;
        const message = payload.new as WhatsAppMessage;
        const variants = getChatIdVariants(currentChat);
        if (!variants.includes(message.chat_id)) return;
        setMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          const merged = [...prev, message];
          return merged.sort((a, b) => {
            const left = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const right = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return left - right;
          });
        });
        scrollToBottom();
        if (message.direction === 'inbound' && user) {
          markMessagesRead([message]);
        }
      })
      .subscribe();

    return () => {
      chatsSubscription.unsubscribe();
      messagesGlobalSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
      const variants = getChatIdVariants(selectedChat);

      const messagesSubscription = supabase
        .channel(`messages_${selectedChat.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
          const message = payload.new as WhatsAppMessage;
          if (!variants.includes(message.chat_id)) return;
          setMessages((prev) => [...prev, message]);
          scrollToBottom();
          if (message.direction === 'inbound' && user) {
            markMessagesRead([message]);
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
          const message = payload.new as WhatsAppMessage;
          if (!variants.includes(message.chat_id)) return;
          setMessages((prev) => prev.map((msg) => (msg.id === message.id ? message : msg)));
        })
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

      if (!data || data.length === 0) {
        const response = await getWhatsAppChats(200, 0);
        const mappedChats: WhatsAppChat[] = response.chats.map((chat: WhapiChat) => {
          const isGroup = chat.id.endsWith('@g.us');
          const lastMessageAt = chat.last_message?.timestamp
            ? new Date(chat.last_message.timestamp * 1000).toISOString()
            : null;
          return {
            id: chat.id,
            name: chat.name ?? null,
            is_group: isGroup,
            last_message_at: lastMessageAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message: undefined,
            unread_count: chat.unread_count ?? 0,
          };
        });

        setChats(mappedChats);
        await loadUnreadCounts();
        await loadGroupNames(mappedChats);
        return;
      }

      const chatsWithLastMessage = await Promise.all(
        (data || []).map(async (chat) => {
          const variants = getChatIdVariants(chat as WhatsAppChat);
          const { data: lastMsg } = await supabase
            .from('whatsapp_messages')
            .select('body')
            .in('chat_id', variants)
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
      await loadUnreadCounts();
      await loadGroupNames(chatsWithLastMessage);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chat: WhatsAppChat) => {
    try {
      const variants = getChatIdVariants(chat);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('chat_id', variants)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      const baseMessages = data || [];
      setMessages(baseMessages);

      if (user) {
        await markMessagesRead(baseMessages);
      }

      const whapiRaw = await fetchWhapiMessages(chat);
      const whapiMessages = whapiRaw.map(whapiToUiMessage);

      const merged = new Map<string, WhatsAppMessage>();
      baseMessages.forEach((message) => merged.set(message.id, message));
      whapiMessages.forEach((message) => merged.set(message.id, message));

      const mergedList = Array.from(merged.values()).sort((a, b) => {
        const left = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const right = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return left - right;
      });

      setMessages(mergedList);
      if (user) {
        await markMessagesRead(mergedList);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadUnreadCounts = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('get_whatsapp_unread_counts', { current_user: user.id });
    if (error) {
      console.error('Error loading unread counts:', error);
      return;
    }

    const countsMap = new Map<string, number>();
    (data || []).forEach((row: { chat_id: string; unread_count: number }) => {
      countsMap.set(row.chat_id, row.unread_count);
    });

    setChats((prev) =>
      prev.map((chat) => ({
        ...chat,
        unread_count: countsMap.get(chat.id) ?? 0,
      })),
    );
  };

  const markMessagesRead = async (messagesToMark: WhatsAppMessage[]) => {
    if (!user) return;
    const unreadInbound = messagesToMark.filter((message) => message.direction === 'inbound');
    if (unreadInbound.length === 0) return;
    const rows = unreadInbound.map((message) => ({
      message_id: message.id,
      user_id: user.id,
      read_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('whatsapp_message_reads').upsert(rows, { onConflict: 'message_id,user_id' });
    if (error) {
      console.error('Error marking messages as read:', error);
    }

    setChats((prev) =>
      prev.map((chat) => {
        const variants = getChatIdVariants(chat);
        const matches = unreadInbound.filter((message) => variants.includes(message.chat_id)).length;
        if (!matches) return chat;
        const current = chat.unread_count ?? 0;
        return { ...chat, unread_count: Math.max(0, current - matches) };
      }),
    );
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

  const handleMessageSent = (message?: SentMessagePayload) => {
    if (message && selectedChat) {
      const timestamp = message.timestamp || new Date().toISOString();
      const nextMessage: WhatsAppMessage = {
        id: message.id,
        chat_id: message.chat_id,
        from_number: null,
        to_number: message.chat_id,
        type: message.type,
        body: message.body,
        has_media: message.has_media,
        timestamp,
        direction: message.direction,
        ack_status: null,
        created_at: message.created_at || timestamp,
        payload: message.payload,
      };

      setMessages((prev) => {
        if (prev.some((item) => item.id === nextMessage.id)) {
          return prev;
        }
        const merged = [...prev, nextMessage];
        return merged.sort((a, b) => {
          const left = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const right = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return left - right;
        });
      });

      setChats((prev) => {
        const updated = prev.map((chat) => {
          const variants = getChatIdVariants(chat);
          if (!variants.includes(message.chat_id)) return chat;
          return {
            ...chat,
            last_message: message.body || chat.last_message,
            last_message_at: timestamp,
          };
        });

        return updated.sort((a, b) => {
          const left = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const right = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return right - left;
        });
      });

      scrollToBottom();
      return;
    }

    if (selectedChat) {
      loadMessages(selectedChat);
      scrollToBottom();
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      const existingEmoji = myReactionsByMessage.get(messageId);
      if (existingEmoji === emoji) {
        await removeReactionFromMessage(messageId);
        setMyReactionsByMessage((prev) => {
          const next = new Map(prev);
          next.delete(messageId);
          return next;
        });
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id !== messageId) return message;
            const payloadData = message.payload && typeof message.payload === 'object' ? message.payload : {};
            const reactions = Array.isArray((payloadData as any).reactions) ? (payloadData as any).reactions : [];
            const nextReactions = reactions
              .map((item: { emoji: string; count?: number }) =>
                item.emoji === emoji ? { ...item, count: Math.max(0, (item.count ?? 1) - 1) } : item,
              )
              .filter((item: { count?: number }) => (item.count ?? 0) > 0);
            return {
              ...message,
              payload: { ...payloadData, reactions: nextReactions },
            };
          }),
        );
        return;
      }

      await reactToMessage(messageId, emoji);
      setMyReactionsByMessage((prev) => new Map(prev).set(messageId, emoji));
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) return message;
          const payloadData = message.payload && typeof message.payload === 'object' ? message.payload : {};
          const reactions = Array.isArray((payloadData as any).reactions) ? (payloadData as any).reactions : [];
          const existing = reactions.find((item: { emoji: string }) => item.emoji === emoji);
          const nextReactions = existing
            ? reactions.map((item: { emoji: string; count?: number }) =>
                item.emoji === emoji ? { ...item, count: (item.count ?? 1) + 1 } : item,
              )
            : [...reactions, { emoji, count: 1 }];

          return {
            ...message,
            payload: { ...payloadData, reactions: nextReactions },
          };
        }),
      );
    } catch (error) {
      console.error('Erro ao reagir mensagem:', error);
    }
  };

  const handleSyncFromWhapi = async () => {
    if (!selectedChat) return;
    try {
      await supabase.functions.invoke('whatsapp-sync', {
        body: { chatId: selectedChat.id, count: 200 },
      });
      await loadMessages(selectedChat);
    } catch (error) {
      console.error('Error syncing from Whapi:', error);
    }
  };

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

  function getChatDisplayName(chat: WhatsAppChat) {
    if (chat.is_group) return groupNamesById.get(chat.id) || chat.name || chat.id;

    const phone = extractPhoneFromChatId(chat.id);

    if (phone && leadNamesByPhone.has(phone)) {
      return leadNamesByPhone.get(phone)!;
    }

    const contactCandidates = [
      normalizeChatId(chat.id) || chat.id,
      chat.id,
      chat.id.endsWith('@s.whatsapp.net') ? chat.id.replace(/@s\.whatsapp\.net$/i, '@c.us') : null,
      chat.id.endsWith('@c.us') ? chat.id.replace(/@c\.us$/i, '@s.whatsapp.net') : null,
      chat.phone_number ? buildChatIdFromPhone(chat.phone_number) : null,
      chat.lid ?? null,
    ].filter((value): value is string => Boolean(value));

    for (const candidate of contactCandidates) {
      const contact = contactsById.get(candidate);
      if (contact?.saved && contact.name) {
        return contact.name;
      }
    }

    if (phone) {
      return formatPhone(phone);
    }

    return chat.id;
  }

  const filteredChats = chats.filter((chat) => {
    const displayName = getChatDisplayName(chat).toLowerCase();
    return displayName.includes(searchQuery.toLowerCase()) || chat.id.includes(searchQuery);
  });

  const reactionsByTargetId = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    messages.forEach((message) => {
      const payloadData = message.payload as any;
      const baseReactions = Array.isArray(payloadData?.reactions) ? payloadData.reactions : [];

      baseReactions.forEach((reaction: { emoji?: string; count?: number }) => {
        if (!reaction?.emoji) return;
        const targetMap = map.get(message.id) ?? new Map<string, number>();
        const current = targetMap.get(reaction.emoji) ?? 0;
        const increment = typeof reaction.count === 'number' ? reaction.count : 1;
        targetMap.set(reaction.emoji, current + increment);
        map.set(message.id, targetMap);
      });

      const action = payloadData?.action;
      if (action?.type === 'reaction' && action?.target && action?.emoji) {
        const targetMap = map.get(action.target) ?? new Map<string, number>();
        const current = targetMap.get(action.emoji) ?? 0;
        targetMap.set(action.emoji, current + 1);
        map.set(action.target, targetMap);
      }
    });

    return new Map(
      Array.from(map.entries()).map(([messageId, emojiMap]) => [
        messageId,
        Array.from(emojiMap.entries()).map(([emoji, count]) => ({ emoji, count })),
      ]),
    );
  }, [messages]);

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

                const chatPhoto = (() => {
                  const variants = getChatIdVariants(chat);
                  for (const variant of variants) {
                    const photo = contactPhotosById.get(variant);
                    if (photo) return photo;
                  }
                  return null;
                })();

                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 flex items-start gap-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      selectedChat?.id === chat.id ? 'bg-teal-50' : ''
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {chatPhoto && !chat.is_group ? (
                        <img src={chatPhoto} alt={chatDisplayName} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                          chat.is_group ? 'bg-blue-500' : 'bg-teal-100 text-teal-700'
                        }`}>
                          {chat.is_group ? (
                            <Users className="w-6 h-6" />
                          ) : (
                            getInitials(chatDisplayName)
                          )}
                        </div>
                      )}
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
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-600 truncate">
                          {chat.last_message || 'Sem mensagens'}
                        </p>
                        {(chat.unread_count ?? 0) > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-teal-600 text-white text-[11px] px-2 py-0.5">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
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
                  <button
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    title="Sincronizar mensagens"
                    onClick={handleSyncFromWhapi}
                  >
                    <History className="w-5 h-5 text-slate-600" />
                  </button>
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
                    const payloadData = message.payload as any;
                    const isReactionOnly = payloadData?.action?.type === 'reaction' && payloadData?.action?.target;
                    if (isReactionOnly) return null;
                    const showAuthor = selectedChat.is_group && message.direction === 'inbound' && message.author;
                    const authorName = showAuthor ? formatPhone(message.author!) : undefined;
                    const reactions = reactionsByTargetId.get(message.id);

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
                          payload={message.payload}
                          reactions={reactions}
                          fromName={authorName}
                          isDeleted={message.is_deleted}
                          deletedAt={message.deleted_at}
                          editCount={message.edit_count}
                          editedAt={message.edited_at}
                          originalBody={message.original_body}
                          onReact={handleReact}
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
                contacts={contactsList}
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
