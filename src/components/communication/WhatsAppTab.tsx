import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, fetchAllPages } from '../../lib/supabase';
import { Search, MessageCircle, Phone, Video, MoreVertical, ArrowLeft, Users, Info, History, Plus } from 'lucide-react';
import { MessageInput, type SentMessagePayload } from './MessageInput';
import { useAuth } from '../../contexts/AuthContext';
import type { LeadStatusConfig } from '../../lib/supabase';
import { MessageBubble } from './MessageBubble';
import { MessageHistoryPanel } from './MessageHistoryPanel';
import { GroupInfoPanel } from './GroupInfoPanel';
import {
  buildChatIdFromPhone,
  getWhatsAppChat,
  getWhatsAppChats,
  getWhatsAppContacts,
  normalizeChatId,
  reactToMessage,
  removeReactionFromMessage,
  type WhapiChat,
  type WhapiChatMetadata,
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
  archived?: boolean | null;
  mute_until?: string | null;
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
  const [leadsList, setLeadsList] = useState<Array<{ id: string; name: string; phone: string; status?: string | null }>>(
    [],
  );
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusConfig[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [chatMenu, setChatMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatTab, setNewChatTab] = useState<'leads' | 'contacts' | 'manual'>('leads');
  const [newChatPhone, setNewChatPhone] = useState('');
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
        const data = await fetchAllPages<{ id: string; telefone: string; nome_completo: string; status?: string | null }>(async (from, to) => {
          const response = await supabase.from('leads').select('id, telefone, nome_completo, status').range(from, to);
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
        setLeadsList(
          (data || [])
            .map((lead) => ({
              id: lead.id,
              name: lead.nome_completo,
              phone: normalizePhoneNumber(lead.telefone),
              status: lead.status ?? null,
            }))
            .filter((lead) => Boolean(lead.phone)),
        );
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
    const loadLeadStatuses = async () => {
      const { data, error } = await supabase
        .from('lead_status_config')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (error) {
        console.error('Erro ao carregar status de lead:', error);
        return;
      }

      setLeadStatuses(data || []);
    };

    loadLeadStatuses();
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
        let didAppend = false;
        setMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          const messageTime = message.timestamp ? new Date(message.timestamp).getTime() : 0;
          const now = Date.now();
          if (messageTime && now - messageTime > 5 * 60 * 1000) {
            return prev;
          }
          const latestTime = prev.reduce((max, item) => {
            const time = item.timestamp ? new Date(item.timestamp).getTime() : 0;
            return Math.max(max, time);
          }, 0);

          if (messageTime && latestTime && messageTime < latestTime) {
            return prev;
          }

          didAppend = true;
          const merged = [...prev, message];
          return merged.sort((a, b) => {
            const left = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const right = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return left - right;
          });
        });
        if (didAppend) {
          const chatToUpdate = chats.find((chat) => chat.id === currentChat.id);
          if (chatToUpdate?.archived && !isChatMuted(chatToUpdate)) {
            updateChatArchive(chatToUpdate.id, false);
          }
          scrollToBottom();
          if (message.direction === 'inbound' && user) {
            markMessagesRead([message]);
          }
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
          const muteUntil = chat.mute_until ? new Date(chat.mute_until * 1000).toISOString() : null;
          return {
            id: chat.id,
            name: chat.name ?? null,
            is_group: isGroup,
            last_message_at: lastMessageAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message: undefined,
            unread_count: chat.unread_count ?? 0,
            archived: chat.archived ?? false,
            mute_until: muteUntil,
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

      const chatToUpdate = chats.find((chat) => chat.id === selectedChat.id);
      if (chatToUpdate?.archived && !isChatMuted(chatToUpdate)) {
        updateChatArchive(chatToUpdate.id, false);
      }

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
  const visibleChats = showArchived ? filteredChats : filteredChats.filter((chat) => !chat.archived);
  const archivedCount = filteredChats.filter((chat) => chat.archived).length;

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
  const selectedLead = useMemo(() => {
    if (!selectedChat || selectedChat.is_group) return null;
    const phone = normalizePhoneNumber(selectedChat.phone_number || selectedChat.id);
    if (!phone) return null;
    return leadsList.find((lead) => lead.phone === phone) ?? null;
  }, [leadsList, selectedChat]);
  const filteredLeads = useMemo(() => {
    const query = newChatSearch.trim().toLowerCase();
    if (!query) return leadsList;
    return leadsList.filter((lead) => lead.name.toLowerCase().includes(query) || lead.phone.includes(query));
  }, [leadsList, newChatSearch]);

  const filteredContacts = useMemo(() => {
    const query = newChatSearch.trim().toLowerCase();
    const source = contactsList.filter((contact) => contact.saved);
    if (!query) return source;
    return source.filter((contact) => (contact.name || contact.id).toLowerCase().includes(query));
  }, [contactsList, newChatSearch]);

  const openChatFromPhone = (phone: string, name?: string) => {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) return;
    const chatId = buildChatIdFromPhone(normalizedPhone);
    const now = new Date().toISOString();
    setChats((prev) => {
      if (prev.some((chat) => chat.id === chatId)) return prev;
      return [
        {
          id: chatId,
          name: name ?? null,
          is_group: false,
          phone_number: normalizedPhone,
          last_message_at: null,
          created_at: now,
          updated_at: now,
          last_message: '',
          unread_count: 0,
        },
        ...prev,
      ];
    });
    setSelectedChat({
      id: chatId,
      name: name ?? null,
      is_group: false,
      phone_number: normalizedPhone,
      last_message_at: null,
      created_at: now,
      updated_at: now,
      last_message: '',
      unread_count: 0,
    });
    setShowNewChatModal(false);
    setNewChatSearch('');
    setNewChatPhone('');
  };

  const isChatMuted = (chat: WhatsAppChat) =>
    chat.mute_until ? new Date(chat.mute_until).getTime() > Date.now() : false;

  const updateChatArchive = async (chatId: string, archived: boolean) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, archived } : chat)));
    const { error } = await supabase
      .from('whatsapp_chats')
      .update({ archived, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) {
      console.error('Erro ao atualizar arquivamento do chat:', error);
    }
  };

  const updateChatMute = async (chatId: string, muteUntil: string | null) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, mute_until: muteUntil } : chat)));
    const { error } = await supabase
      .from('whatsapp_chats')
      .update({ mute_until: muteUntil, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) {
      console.error('Erro ao atualizar mute do chat:', error);
    }
  };

  const handleUpdateLeadStatus = async (statusName: string) => {
    if (!selectedLead) return;
    const previousStatus = selectedLead.status ?? '';
    if (!statusName || statusName === previousStatus) return;
    try {
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: statusName, ultimo_contato: nowIso })
        .eq('id', selectedLead.id);

      if (updateError) throw updateError;

      await supabase.from('lead_status_history').insert([
        {
          lead_id: selectedLead.id,
          status_anterior: previousStatus,
          status_novo: statusName,
          responsavel: user?.email ?? 'WhatsApp',
        },
      ]);

      setLeadsList((prev) => prev.map((lead) => (lead.id === selectedLead.id ? { ...lead, status: statusName } : lead)));
    } catch (error) {
      console.error('Erro ao atualizar status do lead:', error);
      alert('Erro ao atualizar status do lead');
    }
  };

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
    <div className="flex h-full min-h-0 bg-slate-50" onClick={() => setChatMenu(null)}>
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-base font-semibold">Novo chat</h3>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setShowNewChatModal(false)}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 pt-3 flex gap-2">
              <button
                type="button"
                className={`px-3 py-1 rounded-full text-xs ${newChatTab === 'leads' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => setNewChatTab('leads')}
              >
                Leads
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full text-xs ${newChatTab === 'contacts' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => setNewChatTab('contacts')}
              >
                Contatos
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full text-xs ${newChatTab === 'manual' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => setNewChatTab('manual')}
              >
                Numero
              </button>
            </div>
            <div className="px-4 py-3">
              {(newChatTab === 'leads' || newChatTab === 'contacts') && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={newChatTab === 'leads' ? 'Buscar lead...' : 'Buscar contato...'}
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              )}

              {newChatTab === 'leads' && (
                <div className="max-h-72 overflow-y-auto border rounded-lg">
                  {filteredLeads.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">Nenhum lead encontrado.</div>
                  ) : (
                    filteredLeads.map((lead, index) => (
                      <button
                        key={`${lead.phone}-${index}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
                        onClick={() => openChatFromPhone(lead.phone, lead.name)}
                      >
                        <div className="text-sm font-medium text-slate-800">{lead.name}</div>
                        <div className="text-xs text-slate-500">{formatPhone(lead.phone)}</div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {newChatTab === 'contacts' && (
                <div className="max-h-72 overflow-y-auto border rounded-lg">
                  {filteredContacts.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">Nenhum contato encontrado.</div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
                        onClick={() => openChatFromPhone(contact.id, contact.name || contact.id)}
                      >
                        <div className="text-sm font-medium text-slate-800">{contact.name || contact.id}</div>
                        <div className="text-xs text-slate-500">{formatPhone(contact.id)}</div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {newChatTab === 'manual' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="DDD + telefone"
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    className="w-full px-3 py-2 rounded-lg bg-teal-600 text-white text-sm"
                    onClick={() => openChatFromPhone(newChatPhone)}
                  >
                    Iniciar conversa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showChatList && (
        <div className={`${isMobileView ? 'w-full' : 'w-96'} bg-white border-r border-slate-200 flex flex-col min-h-0`}>
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-teal-600 text-white"
                onClick={() => {
                  setShowNewChatModal(true);
                  setNewChatTab('leads');
                }}
              >
                <Plus className="w-4 h-4" />
                Novo chat
              </button>
            </div>
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
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                className={`px-2 py-1 rounded-full border ${showArchived ? 'bg-slate-200 border-slate-300 text-slate-700' : 'border-slate-200'}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setShowArchived((prev) => !prev);
                }}
              >
                {showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados'} ({archivedCount})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {visibleChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <MessageCircle className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium">Nenhuma conversa</p>
                <p className="text-sm">As mensagens do WhatsApp aparecerão aqui</p>
              </div>
            ) : (
              visibleChats.map((chat) => {
                const chatDisplayName = getChatDisplayName(chat);

                const chatPhoto = (() => {
                  const variants = getChatIdVariants(chat);
                  for (const variant of variants) {
                    const photo = contactPhotosById.get(variant);
                    if (photo) return photo;
                  }
                  return null;
                })();

                const muted = isChatMuted(chat);

                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setChatMenu({ chatId: chat.id, x: event.clientX, y: event.clientY });
                    }}
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
                        {muted && (
                          <span className="text-[10px] text-slate-400">Silenciado</span>
                        )}
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
          {chatMenu && (
            <div
              className="fixed z-50 w-52 rounded-lg border border-slate-200 bg-white shadow-lg text-sm"
              style={{ left: chatMenu.x, top: chatMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  const target = chats.find((item) => item.id === chatMenu.chatId);
                  if (target) {
                    updateChatArchive(target.id, !target.archived);
                  }
                  setChatMenu(null);
                }}
              >
                {chats.find((item) => item.id === chatMenu.chatId)?.archived ? 'Desarquivar' : 'Arquivar'}
              </button>
              <div className="border-t border-slate-100" />
              {(() => {
                const target = chats.find((item) => item.id === chatMenu.chatId);
                const muted = target ? isChatMuted(target) : false;
                const muteOptions = [
                  { label: '1 hora', ms: 60 * 60 * 1000 },
                  { label: '1 dia', ms: 24 * 60 * 60 * 1000 },
                  { label: '1 semana', ms: 7 * 24 * 60 * 60 * 1000 },
                  { label: '1 mês', ms: 30 * 24 * 60 * 60 * 1000 },
                  { label: 'Definitivo', ms: 365 * 24 * 60 * 60 * 1000 },
                ];
                return (
                  <div className="py-1">
                    {muted ? (
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          if (target) updateChatMute(target.id, null);
                          setChatMenu(null);
                        }}
                      >
                        Desmutar
                      </button>
                    ) : (
                      <div className="relative group">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                        >
                          <span>Mutar</span>
                          <span className="text-xs text-slate-400">›</span>
                        </button>
                        <div className="absolute left-full top-0 ml-2 hidden min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-lg group-hover:block">
                          {muteOptions.map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-slate-50"
                              onClick={() => {
                                if (target) {
                                  const until = new Date(Date.now() + option.ms).toISOString();
                                  updateChatMute(target.id, until);
                                }
                                setChatMenu(null);
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {showMessageArea && (
        <div className={`${isMobileView ? 'w-full' : 'flex-1'} flex flex-col bg-slate-100 relative min-h-0`}>
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
                    {selectedLead && (
                      <select
                        value={selectedLead.status ?? ''}
                        onChange={(event) => handleUpdateLeadStatus(event.target.value)}
                        className="ml-2 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                      >
                        <option value="">Status</option>
                        {leadStatuses.map((status) => (
                          <option key={status.id} value={status.nome}>
                            {status.nome}
                          </option>
                        ))}
                      </select>
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

              <div className="flex-1 overflow-y-auto p-4 min-h-0">
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
