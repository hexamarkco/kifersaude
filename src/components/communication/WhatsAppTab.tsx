import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, fetchAllPages } from '../../lib/supabase';
import { Search, MessageCircle, Phone, MoreVertical, ArrowLeft, Users, Info, History, Plus, Bell, BellOff, SkipForward, Settings } from 'lucide-react';
import { MessageInput, type SentMessagePayload } from './MessageInput';
import { useAuth } from '../../contexts/AuthContext';
import type { LeadStatusConfig } from '../../lib/supabase';
import StatusDropdown from '../StatusDropdown';
import ModalShell from '../ui/ModalShell';
import { WhatsAppPageSkeleton } from '../ui/panelSkeletons';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';
import { getBadgeStyle } from '../../lib/colorUtils';
import { MessageBubble } from './MessageBubble';
import { MessageHistoryPanel } from './MessageHistoryPanel';
import { GroupInfoPanel } from './GroupInfoPanel';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import {
  buildChatIdFromPhone,
  getWhatsAppChatKind,
  getWhatsAppChats,
  getWhatsAppContacts,
  getWhatsAppGroups,
  getWhatsAppNewsletters,
  normalizeChatId,
  reactToMessage,
  removeReactionFromMessage,
  type WhapiChat,
  type WhapiGroup,
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

const MESSAGES_PAGE_SIZE = 120;

type ChatFilterMode = 'all' | 'unread' | 'groups' | 'direct';

type FirstResponseSLA =
  | { kind: 'no-inbound' }
  | { kind: 'waiting'; minutes: number }
  | { kind: 'replied'; minutes: number };


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
  const [chatFilterMode, setChatFilterMode] = useState<ChatFilterMode>('all');
  const [prioritizeUnread, setPrioritizeUnread] = useState(false);
  const [chatMenu, setChatMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [isListSettingsOpen, setIsListSettingsOpen] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatTab, setNewChatTab] = useState<'leads' | 'contacts' | 'manual'>('leads');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [syncingChatId, setSyncingChatId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadedMessagesCount, setLoadedMessagesCount] = useState(0);
  const [slaTick, setSlaTick] = useState(0);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [myReactionsByMessage, setMyReactionsByMessage] = useState<Map<string, string>>(new Map());
  const [groupNamesById, setGroupNamesById] = useState<Map<string, string>>(new Map());
  const [newsletterNamesById, setNewsletterNamesById] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const chatsRef = useRef<WhatsAppChat[]>([]);
  const selectedChatRef = useRef<WhatsAppChat | null>(null);
  const newsletterNamesByIdRef = useRef<Map<string, string>>(new Map());
  const newsletterNameLookupAttemptsRef = useRef<Set<string>>(new Set());
  const { user } = useAuth();
  const userRef = useRef(user);
  const isWindowFocusedRef = useRef(true);
  const desktopNotificationsEnabledRef = useRef(true);
  const notificationPermissionRef = useRef<NotificationPermission | 'unsupported'>('unsupported');
  const notificationAudioRef = useRef<AudioContext | null>(null);
  const activeDesktopNotificationRef = useRef<Notification | null>(null);
  const unreadCountsRefreshTimeoutRef = useRef<number | null>(null);
  const skipNextAutoScrollRef = useRef(false);
  const activeMessagesLoadIdRef = useRef(0);
  const activeChatsLoadIdRef = useRef(0);
  const lastGroupNamesSyncAtRef = useRef(0);
  const messagesCacheRef = useRef<Map<string, { messages: WhatsAppMessage[]; loadedCount: number; hasOlder: boolean }>>(
    new Map(),
  );
  const loadingUi = useAdaptiveLoading(loading);

  function normalizePhoneNumber(phone: string | null | undefined) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('55') && digits.length >= 12) {
      return digits.slice(-11);
    }

    return digits;
  }

  const getMessageTimeValue = (message: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>) => {
    const primary = message.timestamp ? new Date(message.timestamp).getTime() : Number.NaN;
    if (!Number.isNaN(primary)) return primary;
    const fallback = new Date(message.created_at).getTime();
    return Number.isNaN(fallback) ? 0 : fallback;
  };

  const sortMessagesChronologically = (
    left: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>,
    right: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>,
  ) => getMessageTimeValue(left) - getMessageTimeValue(right);

  const getChatTimeValue = (chat: Pick<WhatsAppChat, 'last_message_at' | 'created_at'>) => {
    const primary = chat.last_message_at ? new Date(chat.last_message_at).getTime() : Number.NaN;
    if (!Number.isNaN(primary)) return primary;
    const fallback = new Date(chat.created_at).getTime();
    return Number.isNaN(fallback) ? 0 : fallback;
  };

  const sortChatsByLatest = (
    left: Pick<WhatsAppChat, 'last_message_at' | 'created_at'>,
    right: Pick<WhatsAppChat, 'last_message_at' | 'created_at'>,
  ) => getChatTimeValue(right) - getChatTimeValue(left);

  const openNextUnreadChat = () => {
    const unreadChats = chatsRef.current
      .filter((chat) => !chat.archived && (chat.unread_count ?? 0) > 0)
      .sort(sortChatsByLatest);

    if (unreadChats.length === 0) return;

    const currentChat = selectedChatRef.current;
    const currentIndex = currentChat ? unreadChats.findIndex((chat) => chat.id === currentChat.id) : -1;
    const nextChat = currentIndex >= 0 ? unreadChats[(currentIndex + 1) % unreadChats.length] : unreadChats[0];

    setSelectedChat(nextChat);
  };

  const getChatKind = (chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => {
    if (chat.is_group) return 'group' as const;
    return getWhatsAppChatKind(chat.id);
  };

  const isDirectChat = (chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => getChatKind(chat) === 'direct';

  const getChatTypeLabel = (chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => {
    const kind = getChatKind(chat);
    if (kind === 'group') return 'Grupo';
    if (kind === 'newsletter') return 'Canal';
    if (kind === 'status') return 'Status';
    if (kind === 'broadcast') return 'Transmissao';
    return null;
  };

  const getNonDirectFallbackName = (chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => {
    const kind = getChatKind(chat);
    if (kind === 'newsletter') return 'Canal sem nome';
    if (kind === 'status') return 'Status';
    if (kind === 'broadcast') return 'Transmissao sem nome';
    return chat.id;
  };

  const isPhoneLikeLabel = (value: string | null | undefined) => {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (!/^[+\d\s().-]+$/.test(trimmed)) return false;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 10;
  };

  const extractPhoneFromChatId = (chatId: string) => {
    if (getWhatsAppChatKind(chatId) !== 'direct') return '';
    return normalizePhoneNumber(chatId);
  };

  const getChatIdVariants = (chat: WhatsAppChat) => {
    const variants = new Set<string>();
    if (chat.id) variants.add(chat.id);
    if (isDirectChat(chat)) {
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
      if (chat.lid) variants.add(chat.lid);
    }
    return Array.from(variants);
  };

  const shouldFetchNewsletterName = (chat: WhatsAppChat) => {
    const kind = getChatKind(chat);
    if (kind !== 'newsletter') return false;
    const currentName = chat.name?.trim();
    if (currentName && currentName !== chat.id && !isPhoneLikeLabel(currentName)) return false;
    if (newsletterNamesByIdRef.current.has(chat.id)) return false;
    if (newsletterNameLookupAttemptsRef.current.has(chat.id)) return false;
    return true;
  };

  const loadGroupNames = async (currentChats: WhatsAppChat[]) => {
    const now = Date.now();
    const syncIntervalMs = 10 * 60 * 1000;
    const shouldRunFullSync = now - lastGroupNamesSyncAtRef.current > syncIntervalMs;

    const groupIds = new Set(
      currentChats
        .filter((chat) => getChatKind(chat) === 'group')
        .filter((chat) => {
          if (shouldRunFullSync) return true;
          const knownName = groupNamesById.get(chat.id) || chat.name;
          const trimmed = knownName?.trim();
          return !trimmed || trimmed === chat.id || isPhoneLikeLabel(trimmed);
        })
        .map((chat) => chat.id),
    );

    if (groupIds.size === 0) return;

    if (shouldRunFullSync) {
      lastGroupNamesSyncAtRef.current = now;
    }

    try {
      const namesById = new Map<string, string>();
      const pageSize = 100;
      let offset = 0;

      for (let page = 0; page < 20; page += 1) {
        const response = await getWhatsAppGroups(pageSize, offset, false);
        const groups = response.groups || [];

        groups.forEach((group: WhapiGroup) => {
          if (!groupIds.has(group.id)) return;
          const name = group.name?.trim();
          if (!name || name === group.id) return;
          namesById.set(group.id, name);
        });

        const resolvedAllCandidates = Array.from(groupIds).every((chatId) => namesById.has(chatId));
        if (resolvedAllCandidates || groups.length < pageSize) {
          break;
        }

        offset += groups.length;
        if (groups.length === 0) {
          break;
        }
      }

      const validUpdates = Array.from(namesById.entries()).map(([id, name]) => ({ id, name }));
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

      const now = new Date().toISOString();
      await Promise.all(
        validUpdates.map(async (item) => {
          const { error: persistError } = await supabase
            .from('whatsapp_chats')
            .update({ name: item.name, updated_at: now })
            .eq('id', item.id)
            .select('id')
            .maybeSingle();

          if (persistError) {
            console.warn('Error persisting group name:', { chatId: item.id, error: persistError });
          }
        }),
      );
    } catch (error) {
      console.warn('Error loading group names:', error);
    }
  };

  const loadNewsletterNames = async (currentChats: WhatsAppChat[]) => {
    const candidateIds = new Set(currentChats.filter(shouldFetchNewsletterName).map((chat) => chat.id));
    if (candidateIds.size === 0) return;

    try {
      const namesById = new Map<string, string>();
      const pageSize = 100;
      let offset = 0;

      for (let page = 0; page < 10; page += 1) {
        const response = await getWhatsAppNewsletters(pageSize, offset);
        const newsletters = response.newsletters || [];

        newsletters.forEach((newsletter) => {
          if (!candidateIds.has(newsletter.id)) return;
          const name = newsletter.name?.trim();
          if (!name) return;
          namesById.set(newsletter.id, name);
        });

        const resolvedAllCandidates = Array.from(candidateIds).every((chatId) => namesById.has(chatId));
        if (resolvedAllCandidates || newsletters.length < pageSize) {
          break;
        }

        offset += newsletters.length;
        if (newsletters.length === 0) {
          break;
        }
      }

      candidateIds.forEach((chatId) => newsletterNameLookupAttemptsRef.current.add(chatId));

      const validUpdates = Array.from(namesById.entries()).map(([id, name]) => ({ id, name }));
      if (validUpdates.length === 0) return;

      setNewsletterNamesById((prev) => {
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

      const now = new Date().toISOString();
      await Promise.all(
        validUpdates.map(async (item) => {
          const { error: persistError } = await supabase
            .from('whatsapp_chats')
            .update({ name: item.name, updated_at: now })
            .eq('id', item.id)
            .select('id')
            .maybeSingle();

          if (persistError) {
            console.warn('Error persisting newsletter name:', { chatId: item.id, error: persistError });
          }
        }),
      );
    } catch (error) {
      console.warn('Error loading newsletter names:', error);
    }
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
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    newsletterNamesByIdRef.current = newsletterNamesById;
  }, [newsletterNamesById]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    desktopNotificationsEnabledRef.current = desktopNotificationsEnabled;
  }, [desktopNotificationsEnabled]);

  useEffect(() => {
    notificationPermissionRef.current = notificationPermission;
  }, [notificationPermission]);

  useEffect(
    () => () => {
      if (unreadCountsRefreshTimeoutRef.current !== null) {
        window.clearTimeout(unreadCountsRefreshTimeoutRef.current);
        unreadCountsRefreshTimeoutRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const syncFocusState = () => {
      if (typeof document === 'undefined') {
        isWindowFocusedRef.current = true;
        return;
      }

      isWindowFocusedRef.current = document.visibilityState === 'visible' && document.hasFocus();
    };

    syncFocusState();
    window.addEventListener('focus', syncFocusState);
    window.addEventListener('blur', syncFocusState);
    document.addEventListener('visibilitychange', syncFocusState);

    return () => {
      window.removeEventListener('focus', syncFocusState);
      window.removeEventListener('blur', syncFocusState);
      document.removeEventListener('visibilitychange', syncFocusState);
    };
  }, []);

  useEffect(() => {
    return () => {
      activeDesktopNotificationRef.current?.close();
      if (notificationAudioRef.current) {
        void notificationAudioRef.current.close();
        notificationAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'n') {
        event.preventDefault();
        setShowNewChatModal(true);
        setNewChatTab('leads');
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'j') {
        event.preventDefault();
        openNextUnreadChat();
        return;
      }

      if (event.key !== 'Escape') return;

      if (isListSettingsOpen) {
        setIsListSettingsOpen(false);
        return;
      }

      if (chatMenu) {
        setChatMenu(null);
        return;
      }

      if (showNewChatModal) {
        setShowNewChatModal(false);
        return;
      }

      if (showGroupInfo) {
        setShowGroupInfo(false);
        return;
      }

      if (isMobileView && selectedChat) {
        setSelectedChat(null);
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [chatMenu, isListSettingsOpen, isMobileView, selectedChat, showGroupInfo, showNewChatModal]);

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
    void loadChats();

    const chatsSubscription = supabase
      .channel('whatsapp_chats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedChatId = (payload.old as { id?: string } | null)?.id;
          if (!deletedChatId) return;

          setChats((prev) => prev.filter((chat) => chat.id !== deletedChatId));
          setSelectedChat((current) => (current?.id === deletedChatId ? null : current));
          return;
        }

        const row = payload.new as Partial<WhatsAppChat> | null;
        if (!row?.id) return;

        const incomingChat: WhatsAppChat = {
          id: row.id,
          name: row.name ?? null,
          is_group: row.is_group ?? getWhatsAppChatKind(row.id) === 'group',
          phone_number: row.phone_number ?? null,
          lid: row.lid ?? null,
          last_message_at: row.last_message_at ?? null,
          created_at: row.created_at ?? new Date().toISOString(),
          updated_at: row.updated_at ?? new Date().toISOString(),
          last_message: row.last_message,
          unread_count: typeof row.unread_count === 'number' ? row.unread_count : undefined,
          archived: row.archived ?? false,
          mute_until: row.mute_until ?? null,
        };

        setChats((prev) => {
          const existingIndex = prev.findIndex((chat) => chat.id === incomingChat.id);
          if (existingIndex === -1) {
            const next = [
              {
                ...incomingChat,
                last_message: incomingChat.last_message ?? '',
                unread_count: incomingChat.unread_count ?? 0,
              },
              ...prev,
            ];
            return next.sort(sortChatsByLatest);
          }

          const existingChat = prev[existingIndex];
          const mergedChat: WhatsAppChat = {
            ...existingChat,
            ...incomingChat,
            last_message: incomingChat.last_message ?? existingChat.last_message,
            unread_count:
              typeof incomingChat.unread_count === 'number'
                ? incomingChat.unread_count
                : existingChat.unread_count,
            archived: incomingChat.archived ?? existingChat.archived,
            mute_until: incomingChat.mute_until ?? existingChat.mute_until,
          };

          const next = [...prev];
          next[existingIndex] = mergedChat;
          return next.sort(sortChatsByLatest);
        });
      })
      .subscribe();

    const messagesGlobalSubscription = supabase
      .channel('whatsapp_messages_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const eventType = payload.eventType;
        const message = (eventType === 'DELETE' ? payload.old : payload.new) as WhatsAppMessage | null;
        if (!message?.id || !message.chat_id) return;

        scheduleUnreadCountsRefresh();

        if (eventType === 'INSERT') {
          const hasChatInMemory = chatsRef.current.some((chat) => getChatIdVariants(chat).includes(message.chat_id));
          if (!hasChatInMemory) {
            void loadChats();
          }
        }

        const chatToAutoUnarchive = chatsRef.current.find((chat) => {
          const variantsForChat = getChatIdVariants(chat);
          return variantsForChat.includes(message.chat_id);
        });

        if (eventType === 'INSERT') {
          maybeNotifyInboundMessage(message, chatToAutoUnarchive);
        }

        if (eventType === 'INSERT' && chatToAutoUnarchive?.archived && !isChatMuted(chatToAutoUnarchive)) {
          updateChatArchive(chatToAutoUnarchive.id, false);
        }

        const currentChat = selectedChatRef.current;
        if (currentChat) {
          const variants = getChatIdVariants(currentChat);
          if (variants.includes(message.chat_id)) {
            if (eventType === 'UPDATE') {
              setMessages((prev) => {
                const targetIndex = prev.findIndex((item) => item.id === message.id);
                if (targetIndex === -1) return prev;
                const next = [...prev];
                next[targetIndex] = { ...next[targetIndex], ...message };
                return next.sort(sortMessagesChronologically);
              });
            }

            if (eventType === 'DELETE') {
              setMessages((prev) => prev.filter((item) => item.id !== message.id));
            }

            if (eventType === 'INSERT') {
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
                return merged.sort(sortMessagesChronologically);
              });

              if (didAppend) {
                const chatToUpdate = chatsRef.current.find((chat) => chat.id === currentChat.id);
                if (chatToUpdate?.archived && !isChatMuted(chatToUpdate)) {
                  updateChatArchive(chatToUpdate.id, false);
                }
                scrollToBottom();
                if (message.direction === 'inbound' && userRef.current) {
                  void markMessagesRead([message]);
                }
              }
            }
          }
        }

        if (eventType === 'DELETE') {
          void loadChats();
          return;
        }

        setChats((prev) => {
          const updated = prev.map((chat) => {
            const variantsForChat = getChatIdVariants(chat);
            if (!variantsForChat.includes(message.chat_id)) return chat;
            const messageTimestamp = message.timestamp || message.created_at || null;
            const messageTime = messageTimestamp ? new Date(messageTimestamp).getTime() : 0;
            const currentTime = chat.last_message_at ? new Date(chat.last_message_at).getTime() : 0;
            if (messageTime && currentTime && messageTime < currentTime) return chat;
            const shouldUnarchive = eventType === 'INSERT' && chat.archived && !isChatMuted(chat);
            const preview = getMessagePreview(message);
            return {
              ...chat,
              last_message: preview ?? chat.last_message,
              last_message_at: messageTimestamp || chat.last_message_at,
              archived: shouldUnarchive ? false : chat.archived,
            };
          });

          return updated.sort(sortChatsByLatest);
        });
      })
      .subscribe();

    return () => {
      chatsSubscription.unsubscribe();
      messagesGlobalSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      setCopiedPhone(null);
      setShowGroupInfo(false);
      setReplyToMessage(null);
      setEditMessage(null);

      const cachedState = messagesCacheRef.current.get(selectedChat.id);
      if (cachedState) {
        setMessages(cachedState.messages);
        setLoadedMessagesCount(cachedState.loadedCount);
        setHasOlderMessages(cachedState.hasOlder);
      } else {
        setMessages([]);
        setHasOlderMessages(false);
        setLoadedMessagesCount(0);
      }

      void loadMessages(selectedChat, { silent: Boolean(cachedState) });
      return;
    }

    setIsLoadingMessages(false);
    setMessages([]);
    setHasOlderMessages(false);
    setLoadedMessagesCount(0);
    setReplyToMessage(null);
    setEditMessage(null);
  }, [selectedChat]);

  useEffect(() => {
    if (!user) return;
    void loadUnreadCounts();
  }, [user]);

  useEffect(() => {
    if (!selectedChat) return;

    const intervalId = window.setInterval(() => {
      setSlaTick((current) => current + 1);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [selectedChat]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scheduleUnreadCountsRefresh = (delayMs: number = 250) => {
    if (unreadCountsRefreshTimeoutRef.current !== null) {
      window.clearTimeout(unreadCountsRefreshTimeoutRef.current);
    }

    unreadCountsRefreshTimeoutRef.current = window.setTimeout(() => {
      unreadCountsRefreshTimeoutRef.current = null;
      void loadUnreadCounts();
    }, delayMs);
  };

  const mergeChatsWithCurrentState = (incomingChats: WhatsAppChat[]) => {
    const previousById = new Map(chatsRef.current.map((chat) => [chat.id, chat]));

    return incomingChats
      .map((incoming) => {
        const previous = previousById.get(incoming.id);
        return {
          ...incoming,
          last_message: incoming.last_message ?? previous?.last_message ?? '',
          unread_count:
            typeof incoming.unread_count === 'number'
              ? incoming.unread_count
              : typeof previous?.unread_count === 'number'
                ? previous.unread_count
                : 0,
          archived: incoming.archived ?? previous?.archived ?? false,
          mute_until: incoming.mute_until ?? previous?.mute_until ?? null,
        };
      })
      .sort(sortChatsByLatest);
  };

  const hydrateMissingChatPreviews = async (snapshot: WhatsAppChat[], loadId: number) => {
    const chatsToHydrate = snapshot.filter((chat) => Boolean(chat.last_message_at) && !chat.last_message).slice(0, 120);
    if (chatsToHydrate.length === 0) return;

    const previewsById = new Map<string, string>();
    const chunkSize = 20;

    for (let index = 0; index < chatsToHydrate.length; index += chunkSize) {
      const chunk = chatsToHydrate.slice(index, index + chunkSize);

      const chunkResults = await Promise.all(
        chunk.map(async (chat) => {
          const variants = getChatIdVariants(chat);
          const { data: lastMessages, error } = await supabase
            .from('whatsapp_messages')
            .select('body, type, has_media, payload, timestamp, created_at, is_deleted')
            .in('chat_id', variants)
            .order('timestamp', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(5);

          if (error || !lastMessages || lastMessages.length === 0) {
            return null;
          }

          const preview = lastMessages
            .map((message) => getMessagePreview(message as WhatsAppMessage))
            .find((value): value is string => Boolean(value));

          if (!preview) return null;
          return { chatId: chat.id, preview };
        }),
      );

      if (activeChatsLoadIdRef.current !== loadId) {
        return;
      }

      chunkResults.forEach((result) => {
        if (!result) return;
        previewsById.set(result.chatId, result.preview);
      });
    }

    if (activeChatsLoadIdRef.current !== loadId || previewsById.size === 0) {
      return;
    }

    setChats((prev) =>
      prev.map((chat) => {
        const preview = previewsById.get(chat.id);
        if (!preview || chat.last_message) return chat;
        return { ...chat, last_message: preview };
      }),
    );
  };

  const loadChats = async () => {
    activeChatsLoadIdRef.current += 1;
    const currentLoadId = activeChatsLoadIdRef.current;

    try {
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      let incomingChats: WhatsAppChat[] = [];

      if (!data || data.length === 0) {
        const response = await getWhatsAppChats(200, 0);
        incomingChats = response.chats.map((chat: WhapiChat) => {
          const isGroup = getWhatsAppChatKind(chat.id) === 'group';
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
            last_message: '',
            unread_count: chat.unread_count ?? 0,
            archived: chat.archived ?? false,
            mute_until: muteUntil,
          };
        });
      } else {
        incomingChats = data as WhatsAppChat[];
      }

      if (activeChatsLoadIdRef.current !== currentLoadId) {
        return;
      }

      const mergedChats = mergeChatsWithCurrentState(incomingChats);
      setChats(mergedChats);

      void loadUnreadCounts();
      void loadGroupNames(mergedChats);
      void loadNewsletterNames(mergedChats);
      void hydrateMissingChatPreviews(mergedChats, currentLoadId);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      if (activeChatsLoadIdRef.current === currentLoadId) {
        setLoading(false);
      }
    }
  };

  const loadMessages = async (chat: WhatsAppChat, options?: { silent?: boolean }) => {
    activeMessagesLoadIdRef.current += 1;
    const currentLoadId = activeMessagesLoadIdRef.current;
    const silent = options?.silent ?? false;

    if (!silent) {
      setIsLoadingMessages(true);
    }

    try {
      const variants = getChatIdVariants(chat);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('chat_id', variants)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (error) throw error;

      const stillActiveLoad =
        activeMessagesLoadIdRef.current === currentLoadId && selectedChatRef.current?.id === chat.id;
      if (!stillActiveLoad) {
        return;
      }

      const baseMessages = [...(data || [])].sort(sortMessagesChronologically);
      setMessages(baseMessages);
      setLoadedMessagesCount(baseMessages.length);
      setHasOlderMessages((data || []).length === MESSAGES_PAGE_SIZE);

      messagesCacheRef.current.set(chat.id, {
        messages: baseMessages,
        loadedCount: baseMessages.length,
        hasOlder: (data || []).length === MESSAGES_PAGE_SIZE,
      });

      if (userRef.current) {
        void markChatAsRead(chat, baseMessages).then(() => {
          scheduleUnreadCountsRefresh(50);
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      const stillActiveLoad =
        activeMessagesLoadIdRef.current === currentLoadId && selectedChatRef.current?.id === chat.id;
      if (stillActiveLoad) {
        setIsLoadingMessages(false);
      }
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedChat || !hasOlderMessages || isLoadingOlderMessages) return;

    setIsLoadingOlderMessages(true);
    const currentChatId = selectedChat.id;
    const currentLoadId = activeMessagesLoadIdRef.current;
    try {
      const variants = getChatIdVariants(selectedChat);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('chat_id', variants)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(loadedMessagesCount, loadedMessagesCount + MESSAGES_PAGE_SIZE - 1);

      if (error) throw error;

      const stillActiveLoad =
        activeMessagesLoadIdRef.current === currentLoadId && selectedChatRef.current?.id === currentChatId;
      if (!stillActiveLoad) {
        return;
      }

      const olderMessages = [...(data || [])].sort(sortMessagesChronologically);
      if (olderMessages.length === 0) {
        setHasOlderMessages(false);
        return;
      }

      skipNextAutoScrollRef.current = true;
      const nextHasOlder = (data || []).length === MESSAGES_PAGE_SIZE;
      const nextLoadedCount = loadedMessagesCount + (data || []).length;

      setMessages((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const deduped = olderMessages.filter((item) => !existingIds.has(item.id));
        if (deduped.length === 0) return prev;

        const nextMessages = [...deduped, ...prev];
        messagesCacheRef.current.set(currentChatId, {
          messages: nextMessages,
          loadedCount: nextLoadedCount,
          hasOlder: nextHasOlder,
        });
        return nextMessages;
      });

      setLoadedMessagesCount(nextLoadedCount);
      setHasOlderMessages(nextHasOlder);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

  const loadUnreadCounts = async () => {
    const activeUser = userRef.current;
    if (!activeUser) return;

    let unreadCountsResponse = await supabase.rpc('get_whatsapp_unread_counts', {
      current_user_id: activeUser.id,
    });

    if (unreadCountsResponse.error?.code === 'PGRST202') {
      unreadCountsResponse = await supabase.rpc('get_whatsapp_unread_counts', {
        current_user: activeUser.id,
      });
    }

    const { data, error } = unreadCountsResponse;

    if (error) {
      console.error('Error loading unread counts:', error);
      return;
    }

    const countsMap = new Map<string, number>();
    (data || []).forEach((row: { chat_id: string; unread_count: number }) => {
      countsMap.set(row.chat_id, row.unread_count);
    });

    setChats((prev) =>
      prev.map((chat) => {
        const unreadCount = getChatIdVariants(chat).reduce((total, variant) => total + (countsMap.get(variant) ?? 0), 0);
        return {
          ...chat,
          unread_count: unreadCount,
        };
      }),
    );
  };

  const markChatAsRead = async (chat: WhatsAppChat, fallbackMessages: WhatsAppMessage[] = []) => {
    const activeUser = userRef.current;
    if (!activeUser) return;

    const chatIds = getChatIdVariants(chat);
    if (chatIds.length === 0) return;

    let response = await supabase.rpc('mark_whatsapp_chat_read', {
      current_user_id: activeUser.id,
      chat_ids: chatIds,
    });

    if (response.error?.code === 'PGRST202') {
      response = await supabase.rpc('mark_whatsapp_chat_read', {
        current_user: activeUser.id,
        chat_ids: chatIds,
      });
    }

    if (response.error) {
      console.error('Error marking chat as read:', response.error);
      if (fallbackMessages.length > 0) {
        await markMessagesRead(fallbackMessages);
      }
      return;
    }

    setChats((prev) =>
      prev.map((existing) =>
        chatIds.includes(existing.id)
          ? {
              ...existing,
              unread_count: 0,
            }
          : existing,
      ),
    );
  };

  const markMessagesRead = async (messagesToMark: WhatsAppMessage[]) => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    const unreadInbound = messagesToMark.filter((message) => message.direction === 'inbound');
    if (unreadInbound.length === 0) return;
    const rows = unreadInbound.map((message) => ({
      message_id: message.id,
      user_id: activeUser.id,
      read_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('whatsapp_message_reads').upsert(rows, { onConflict: 'message_id,user_id' });
    if (error) {
      console.error('Error marking messages as read:', error);
      return;
    }

    scheduleUnreadCountsRefresh();

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
        return merged.sort(sortMessagesChronologically);
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

        return updated.sort(sortChatsByLatest);
      });

      const chatToUpdate = chatsRef.current.find((chat) => chat.id === selectedChat.id);
      if (chatToUpdate?.archived && !isChatMuted(chatToUpdate)) {
        updateChatArchive(chatToUpdate.id, false);
      }

      scrollToBottom();
      scheduleUnreadCountsRefresh();
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
    if (!selectedChat || syncingChatId === selectedChat.id) return;

    setSyncingChatId(selectedChat.id);
    try {
      await supabase.functions.invoke('whatsapp-sync', {
        body: { chatId: selectedChat.id, count: 200 },
      });
      await loadMessages(selectedChat);
      scheduleUnreadCountsRefresh();
    } catch (error) {
      console.error('Error syncing from Whapi:', error);
    } finally {
      setSyncingChatId(null);
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

    if (cleaned.startsWith('54') && cleaned.length >= 11) {
      const rest = cleaned.slice(2);
      const isMobile = rest.startsWith('9');
      const restDigits = isMobile ? rest.slice(1) : rest;
      let area = restDigits.slice(0, 3);
      let local = restDigits.slice(3);
      if (restDigits.length === 10) {
        area = restDigits.slice(0, 4);
        local = restDigits.slice(4);
      }
      const localLeft = local.slice(0, 2);
      const localRight = local.slice(2);
      return `+54 ${isMobile ? '9 ' : ''}${area} ${localLeft}-${localRight}`.trim();
    }

    if (cleaned.length > 11) {
      const cc = cleaned.slice(0, 2);
      const rest = cleaned.slice(2);
      const left = rest.slice(0, Math.max(0, rest.length - 4));
      const right = rest.slice(-4);
      return `+${cc} ${left} ${right}`.trim();
    }

    return cleaned || phone;
  };

  const getMessagePreview = (
    message: Pick<WhatsAppMessage, 'body' | 'type' | 'has_media' | 'payload' | 'is_deleted'>,
  ) => {
    if (message.is_deleted) return 'Mensagem apagada';

    const body = message.body?.trim();
    if (body) return body;

    const payloadData = message.payload as any;
    if (payloadData?.action?.type === 'reaction') return null;

    const type = (message.type || '').toLowerCase();
    if (type === 'image') return '[Imagem]';
    if (type === 'video') return '[Vídeo]';
    if (['audio', 'voice', 'ptt'].includes(type)) return '[Áudio]';
    if (type === 'document') return '[Documento]';
    if (type === 'contact') return '[Contato]';
    if (type === 'location') return '[Localização]';
    if (message.has_media) return '[Anexo]';
    return 'Mensagem';
  };

  const playNotificationTone = () => {
    if (!desktopNotificationsEnabledRef.current || typeof window === 'undefined') return;

    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const context = notificationAudioRef.current ?? new AudioContextCtor();
      notificationAudioRef.current = context;

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      const now = context.currentTime;
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      oscillator.start(now);
      oscillator.stop(now + 0.25);
    } catch (error) {
      console.warn('Erro ao reproduzir alerta sonoro:', error);
    }
  };

  const formatMinutesDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getChatDisplayNameFromId = (chatId: string) => {
    const chatKind = getWhatsAppChatKind(chatId);
    if (chatKind === 'direct') {
      const phone = extractPhoneFromChatId(chatId);
      return phone ? formatPhone(phone) : 'Nova conversa';
    }

    return getNonDirectFallbackName({ id: chatId, is_group: chatKind === 'group' });
  };

  const maybeNotifyInboundMessage = (message: WhatsAppMessage, matchedChat?: WhatsAppChat) => {
    if (message.direction !== 'inbound') return;

    const activeChat = selectedChatRef.current;
    const messageBelongsToActiveChat = activeChat
      ? getChatIdVariants(activeChat).includes(message.chat_id)
      : false;
    const shouldAlert = !messageBelongsToActiveChat || !isWindowFocusedRef.current;

    if (!shouldAlert || !desktopNotificationsEnabledRef.current) return;

    const preview = getMessagePreview(message);
    if (!preview) return;

    playNotificationTone();

    if (notificationPermissionRef.current !== 'granted' || typeof window === 'undefined') return;

    const resolvedChat = matchedChat ?? chatsRef.current.find((chat) => getChatIdVariants(chat).includes(message.chat_id));

    const title = resolvedChat ? getChatDisplayName(resolvedChat) : getChatDisplayNameFromId(message.chat_id);

    activeDesktopNotificationRef.current?.close();
    const desktopNotification = new Notification(title, {
      body: preview,
      tag: `whatsapp-${resolvedChat?.id || message.chat_id}`,
    });
    activeDesktopNotificationRef.current = desktopNotification;

    desktopNotification.onclick = () => {
      window.focus();
      if (resolvedChat) {
        setSelectedChat(resolvedChat);
      }
      desktopNotification.close();
    };
  };

  const handleToggleDesktopNotifications = async () => {
    if (notificationPermission === 'unsupported' || typeof window === 'undefined') return;

    if (notificationPermission === 'denied') {
      alert('Permissao de notificacao negada no navegador. Libere para receber alertas desktop.');
      return;
    }

    if (notificationPermission === 'default') {
      const nextPermission = await Notification.requestPermission();
      setNotificationPermission(nextPermission);
      if (nextPermission !== 'granted') return;
      setDesktopNotificationsEnabled(true);
      return;
    }

    setDesktopNotificationsEnabled((prev) => !prev);
  };

  function getChatDisplayName(chat: WhatsAppChat) {
    const chatKind = getChatKind(chat);
    if (chatKind === 'group') {
      return groupNamesById.get(chat.id) || chat.name || chat.id;
    }

    if (chatKind !== 'direct') {
      const resolvedName = newsletterNamesById.get(chat.id) || chat.name;
      if (resolvedName?.trim() && resolvedName !== chat.id && !isPhoneLikeLabel(resolvedName)) {
        return resolvedName;
      }
      return getNonDirectFallbackName(chat);
    }

    const phone = normalizePhoneNumber(chat.phone_number || chat.id);

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

    if (chat.name?.trim() && chat.name !== chat.id) {
      return chat.name;
    }

    if (phone) {
      return formatPhone(phone);
    }

    return chat.id;
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const chatsMatchingSearch = chats.filter((chat) => {
    if (!normalizedSearchQuery) return true;

    const displayName = getChatDisplayName(chat).toLowerCase();
    const preview = (chat.last_message || '').toLowerCase();
    return (
      displayName.includes(normalizedSearchQuery) ||
      chat.id.toLowerCase().includes(normalizedSearchQuery) ||
      preview.includes(normalizedSearchQuery)
    );
  });

  const archivedCount = chatsMatchingSearch.filter((chat) => chat.archived).length;
  const inboxChats = showArchived ? chatsMatchingSearch : chatsMatchingSearch.filter((chat) => !chat.archived);
  const unreadInboxCount = inboxChats.filter((chat) => (chat.unread_count ?? 0) > 0).length;
  const groupInboxCount = inboxChats.filter((chat) => getChatKind(chat) === 'group').length;
  const directInboxCount = inboxChats.filter((chat) => isDirectChat(chat)).length;

  const filteredVisibleChats = inboxChats.filter((chat) => {
    if (chatFilterMode === 'unread') return (chat.unread_count ?? 0) > 0;
    if (chatFilterMode === 'groups') return getChatKind(chat) === 'group';
    if (chatFilterMode === 'direct') return isDirectChat(chat);
    return true;
  });

  const sortedVisibleChats = [...filteredVisibleChats].sort((left, right) => {
    if (prioritizeUnread) {
      const leftUnread = left.unread_count ?? 0;
      const rightUnread = right.unread_count ?? 0;
      if (leftUnread !== rightUnread) {
        return rightUnread - leftUnread;
      }
    }

    return sortChatsByLatest(left, right);
  });

  const visibleChats = (() => {
    if (!selectedChat || chatFilterMode === 'unread') {
      return sortedVisibleChats;
    }

    const selectedIndex = sortedVisibleChats.findIndex((chat) => chat.id === selectedChat.id);
    if (selectedIndex < 0) {
      return sortedVisibleChats;
    }

    if (selectedIndex === 0) {
      return sortedVisibleChats;
    }

    const selectedItem = sortedVisibleChats[selectedIndex];
    const withoutSelected = sortedVisibleChats.filter((chat) => chat.id !== selectedChat.id);
    return [selectedItem, ...withoutSelected];
  })();
  const unreadQueue = visibleChats.filter((chat) => (chat.unread_count ?? 0) > 0);
  const nextUnreadChat = unreadQueue.find((chat) => chat.id !== selectedChat?.id) ?? unreadQueue[0] ?? null;
  const notificationsActive = notificationPermission === 'granted' && desktopNotificationsEnabled;
  const notificationsLabel =
    notificationPermission === 'unsupported'
      ? 'Sem suporte'
      : notificationPermission === 'denied'
        ? 'Permissao bloqueada'
        : notificationsActive
          ? 'Notificacoes ligadas'
          : 'Notificacoes desligadas';

  const reactionsByTargetId = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    messages.forEach((message) => {
      const payloadData = message.payload as any;
      const baseReactions = Array.isArray(payloadData?.reactions) ? payloadData.reactions : [];

      baseReactions.forEach((reaction: { emoji?: string; count?: number }) => {
        if (!reaction?.emoji) return;
        const targetMap = map.get(message.id) ?? new Map<string, number>();
        const increment = typeof reaction.count === 'number' ? reaction.count : 1;
        targetMap.set(reaction.emoji, increment);
        map.set(message.id, targetMap);
      });
    });

    messages.forEach((message) => {
      const payloadData = message.payload as any;
      const action = payloadData?.action;
      if (action?.type === 'reaction' && action?.target && action?.emoji) {
        const existingTarget = map.get(action.target);
        if (existingTarget?.has(action.emoji)) return;
        const targetMap = existingTarget ?? new Map<string, number>();
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
    if (!selectedChat || !isDirectChat(selectedChat)) return null;
    const phone = normalizePhoneNumber(selectedChat.phone_number || selectedChat.id);
    if (!phone) return null;
    return leadsList.find((lead) => lead.phone === phone) ?? null;
  }, [leadsList, selectedChat]);
  const firstResponseSla = useMemo<FirstResponseSLA>(() => {
    const timeline = [...messages]
      .filter((message) => {
        if (!message.direction) return false;
        const payloadData = message.payload as any;
        return !(payloadData?.action?.type === 'reaction' && payloadData?.action?.target);
      })
      .sort(sortMessagesChronologically);

    let lastInboundAt: number | null = null;
    let firstOutboundAfterInboundAt: number | null = null;

    timeline.forEach((message) => {
      const timeValue = getMessageTimeValue(message);
      if (!timeValue) return;

      if (message.direction === 'inbound') {
        lastInboundAt = timeValue;
        firstOutboundAfterInboundAt = null;
        return;
      }

      if (message.direction === 'outbound' && lastInboundAt !== null && firstOutboundAfterInboundAt === null) {
        firstOutboundAfterInboundAt = timeValue;
      }
    });

    if (lastInboundAt === null) {
      return { kind: 'no-inbound' };
    }

    if (firstOutboundAfterInboundAt !== null && firstOutboundAfterInboundAt >= lastInboundAt) {
      const responseMinutes = Math.max(1, Math.round((firstOutboundAfterInboundAt - lastInboundAt) / 60000));
      return { kind: 'replied', minutes: responseMinutes };
    }

    const waitingMinutes = Math.max(1, Math.round((Date.now() - lastInboundAt) / 60000));
    return { kind: 'waiting', minutes: waitingMinutes };
  }, [messages, slaTick]);
  const firstResponseSlaBadge = useMemo(() => {
    if (firstResponseSla.kind === 'no-inbound') {
      return {
        label: 'SLA 1a resposta: sem pendencia',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
      };
    }

    if (firstResponseSla.kind === 'replied') {
      if (firstResponseSla.minutes <= 5) {
        return {
          label: `SLA 1a resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        };
      }
      if (firstResponseSla.minutes <= 15) {
        return {
          label: `SLA 1a resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
          className: 'border-amber-200 bg-amber-50 text-amber-700',
        };
      }
      return {
        label: `SLA 1a resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
        className: 'border-slate-200 bg-slate-100 text-slate-700',
      };
    }

    if (firstResponseSla.minutes <= 5) {
      return {
        label: `Aguardando resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    }
    if (firstResponseSla.minutes <= 15) {
      return {
        label: `Aguardando resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    }
    return {
      label: `Aguardando resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }, [firstResponseSla]);
  const leadByPhone = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; status?: string | null }>();
    leadsList.forEach((lead) => map.set(lead.phone, lead));
    return map;
  }, [leadsList]);
  const statusByName = useMemo(() => {
    const map = new Map<string, LeadStatusConfig>();
    leadStatuses.forEach((status) => map.set(status.nome, status));
    return map;
  }, [leadStatuses]);
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

  const templateVariablesForInput = useMemo(() => {
    const fullName = (selectedLead?.name || selectedChatDisplayName || '').trim();
    const firstName = fullName.split(/\s+/).filter(Boolean)[0] || '';
    const rawPhone = selectedChat && isDirectChat(selectedChat)
      ? normalizePhoneNumber(selectedChat.phone_number || selectedChat.id)
      : '';

    return {
      nome: fullName,
      primeiro_nome: firstName,
      telefone: rawPhone ? formatPhone(rawPhone) : '',
      telefone_digits: rawPhone,
      status: selectedLead?.status ?? 'Sem status',
      atendente: user?.email ? user.email.split('@')[0] : '',
      chat_nome: selectedChatDisplayName || selectedChat?.id || '',
    };
  }, [selectedChat, selectedChatDisplayName, selectedLead, user]);

  const templateVariableShortcuts = [
    { key: 'nome', label: 'Nome' },
    { key: 'primeiro_nome', label: 'Primeiro nome' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'status', label: 'Status' },
    { key: 'atendente', label: 'Atendente' },
    { key: 'data_hoje', label: 'Data de hoje' },
    { key: 'hora_agora', label: 'Hora atual' },
  ];

  const getUnreadWaitingLabel = (chat: WhatsAppChat) => {
    if ((chat.unread_count ?? 0) <= 0 || !chat.last_message_at) return null;
    const messageTime = new Date(chat.last_message_at).getTime();
    if (!Number.isFinite(messageTime) || Number.isNaN(messageTime)) return null;
    const waitingMinutes = Math.max(1, Math.round((Date.now() - messageTime) / 60000));
    return formatMinutesDuration(waitingMinutes);
  };

  const openChatContextMenu = (chatId: string, x: number, y: number) => {
    const menuWidth = 224;
    const menuHeight = 260;
    const safeX = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - menuWidth - 8));
    const safeY = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - menuHeight - 8));

    setChatMenu({ chatId, x: safeX, y: safeY });
  };

  const selectedChatKind = selectedChat ? getChatKind(selectedChat) : null;
  const selectedChatTypeLabel = selectedChat ? getChatTypeLabel(selectedChat) : null;
  const selectedChatTypeBadgeClass =
    selectedChatKind === 'group'
      ? 'bg-blue-100 text-blue-700'
      : selectedChatKind === 'newsletter'
        ? 'bg-indigo-100 text-indigo-700'
        : selectedChatKind === 'status'
          ? 'bg-amber-100 text-amber-700'
          : selectedChatKind === 'broadcast'
            ? 'bg-orange-100 text-orange-700'
            : 'bg-slate-100 text-slate-700';
  const selectedChatIsDirect = selectedChat ? isDirectChat(selectedChat) : false;
  const selectedChatPhone = selectedChat && selectedChatIsDirect
    ? normalizePhoneNumber(selectedChat.phone_number || selectedChat.id)
    : '';
  const selectedChatPhoneFormatted = selectedChatPhone ? formatPhone(selectedChatPhone) : '';
  const effectiveFirstResponseSlaBadge =
    selectedChatIsDirect && isLoadingMessages && messages.length === 0
      ? {
          label: 'SLA 1a resposta: carregando...',
          className: 'border-slate-200 bg-slate-100 text-slate-600',
        }
      : firstResponseSlaBadge;

  const handleCopySelectedChatPhone = async () => {
    if (!selectedChatPhone) return;

    try {
      await navigator.clipboard.writeText(selectedChatPhone);
      setCopiedPhone(selectedChatPhone);
      window.setTimeout(() => {
        setCopiedPhone((current) => (current === selectedChatPhone ? null : current));
      }, 1800);
    } catch (error) {
      console.error('Erro ao copiar telefone:', error);
    }
  };

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
    setChatFilterMode('all');
    setShowNewChatModal(false);
    setNewChatSearch('');
    setNewChatPhone('');
  };

  const isChatMuted = (chat: WhatsAppChat) =>
    chat.mute_until ? new Date(chat.mute_until).getTime() > Date.now() : false;

  const patchSelectedChat = (chatId: string, patch: Partial<WhatsAppChat>) => {
    setSelectedChat((current) => (current && current.id === chatId ? { ...current, ...patch } : current));
  };

  const updateChatArchive = async (chatId: string, archived: boolean) => {
    const previousArchived = chatsRef.current.find((chat) => chat.id === chatId)?.archived ?? false;

    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, archived } : chat)));
    patchSelectedChat(chatId, { archived });

    const { data, error } = await supabase
      .from('whatsapp_chats')
      .update({ archived, updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, archived: previousArchived } : chat)));
      patchSelectedChat(chatId, { archived: previousArchived });
      console.error('Erro ao atualizar arquivamento do chat:', error ?? 'Nenhuma linha atualizada (RLS/permissao).');
    }
  };

  const updateChatMute = async (chatId: string, muteUntil: string | null) => {
    const previousMuteUntil = chatsRef.current.find((chat) => chat.id === chatId)?.mute_until ?? null;

    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, mute_until: muteUntil } : chat)));
    patchSelectedChat(chatId, { mute_until: muteUntil });

    const { data, error } = await supabase
      .from('whatsapp_chats')
      .update({ mute_until: muteUntil, updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, mute_until: previousMuteUntil } : chat)));
      patchSelectedChat(chatId, { mute_until: previousMuteUntil });
      console.error('Erro ao atualizar mute do chat:', error ?? 'Nenhuma linha atualizada (RLS/permissao).');
    }
  };

  const handleUpdateLeadStatus = async (statusName: string, leadId?: string) => {
    const lead = leadId ? leadsList.find((item) => item.id === leadId) : selectedLead;
    if (!lead) return;
    const previousStatus = lead.status ?? '';
    if (!statusName || statusName === previousStatus) return;
    try {
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: statusName, ultimo_contato: nowIso })
        .eq('id', lead.id);

      if (updateError) throw updateError;

      await supabase.from('lead_status_history').insert([
        {
          lead_id: lead.id,
          status_anterior: previousStatus,
          status_novo: statusName,
          responsavel: user?.email ?? 'WhatsApp',
        },
      ]);

      setLeadsList((prev) => prev.map((item) => (item.id === lead.id ? { ...item, status: statusName } : item)));
    } catch (error) {
      console.error('Erro ao atualizar status do lead:', error);
      alert('Erro ao atualizar status do lead');
    }
  };

  const showChatList = !isMobileView || !selectedChat;
  const showMessageArea = !isMobileView || selectedChat;

  const hasChatSnapshot = chats.length > 0;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasChatSnapshot}
      skeleton={<WhatsAppPageSkeleton />}
      stageLabel="Conectando WhatsApp..."
      overlayLabel="Sincronizando conversas..."
      stageClassName="min-h-[560px]"
    >
      <div
        className="flex h-full min-h-0 bg-slate-50"
        onClick={() => {
          setChatMenu(null);
          setIsListSettingsOpen(false);
        }}
      >
      {showNewChatModal && (
        <ModalShell
          isOpen
          onClose={() => setShowNewChatModal(false)}
          title="Novo chat"
          size="md"
          panelClassName="max-w-lg"
        >
            <div className="flex gap-2">
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
            <div className="pt-3">
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
        </ModalShell>
      )}
      {showChatList && (
        <div className={`${isMobileView ? 'w-full' : 'w-96'} bg-white border-r border-slate-200 flex flex-col min-h-0`}>
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-teal-600 text-white"
                  onClick={() => {
                    setShowNewChatModal(true);
                    setNewChatTab('leads');
                    setIsListSettingsOpen(false);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Novo chat
                </button>
                <button
                  type="button"
                  title="Configuracoes da lista"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    isListSettingsOpen
                      ? 'border-teal-300 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsListSettingsOpen((prev) => !prev);
                  }}
                >
                  <Settings className="h-4 w-4" />
                </button>

                {isListSettingsOpen && (
                  <div
                    className="absolute right-0 top-11 z-20 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Configuracoes da lista
                    </p>

                    <div className="mt-3 space-y-2 text-xs">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2 text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowArchived((prev) => !prev)}
                      >
                        <span>{showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados'}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{archivedCount}</span>
                      </button>

                      <label className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2 text-slate-700">
                        <span>Priorizar nao lidas</span>
                        <input
                          type="checkbox"
                          checked={prioritizeUnread}
                          onChange={(event) => setPrioritizeUnread(event.target.checked)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </label>

                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleToggleDesktopNotifications}
                        disabled={notificationPermission === 'unsupported'}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {notificationsActive ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                          Notificacoes desktop
                        </span>
                        <span className="text-[11px] text-slate-500">{notificationsLabel}</span>
                      </button>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <p className="text-[11px] font-medium text-slate-600">Atalhos</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Ctrl/Cmd + K busca • Ctrl/Cmd + N novo chat • Ctrl/Cmd + Shift + J proxima nao lida
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Pesquisar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  chatFilterMode === 'all'
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setChatFilterMode('all')}
              >
                Todas ({inboxChats.length})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  chatFilterMode === 'unread'
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setChatFilterMode('unread')}
              >
                Nao lidas ({unreadInboxCount})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  chatFilterMode === 'direct'
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setChatFilterMode('direct')}
              >
                Diretas ({directInboxCount})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  chatFilterMode === 'groups'
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setChatFilterMode('groups')}
              >
                Grupos ({groupInboxCount})
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (nextUnreadChat) {
                    setSelectedChat(nextUnreadChat);
                    return;
                  }
                  openNextUnreadChat();
                }}
                disabled={!nextUnreadChat}
              >
                <SkipForward className="h-3.5 w-3.5" />
                {nextUnreadChat ? `Proxima nao lida (${unreadQueue.length})` : 'Fila zerada'}
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
                const chatKind = getChatKind(chat);
                const chatTypeLabel = getChatTypeLabel(chat);
                const chatPhone = isDirectChat(chat) ? normalizePhoneNumber(chat.phone_number || chat.id) : null;
                const leadForChat = chatPhone ? leadByPhone.get(chatPhone) : null;
                const leadStatus = leadForChat?.status ?? null;
                const statusConfig = leadStatus ? statusByName.get(leadStatus) : null;
                const badgeStyles = statusConfig ? getBadgeStyle(statusConfig.cor || '#94a3b8', 0.3) : null;
                const chatTypeBadgeClass =
                  chatKind === 'group'
                    ? 'bg-blue-100 text-blue-700'
                    : chatKind === 'newsletter'
                      ? 'bg-indigo-100 text-indigo-700'
                      : chatKind === 'status'
                        ? 'bg-amber-100 text-amber-700'
                        : chatKind === 'broadcast'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-700';

                const chatPhoto = (() => {
                  const variants = getChatIdVariants(chat);
                  for (const variant of variants) {
                    const photo = contactPhotosById.get(variant);
                    if (photo) return photo;
                  }
                  return null;
                })();

                const muted = isChatMuted(chat);
                const unreadWaitingLabel = getUnreadWaitingLabel(chat);

                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openChatContextMenu(chat.id, event.clientX, event.clientY);
                    }}
                    className={`w-full p-4 flex items-start gap-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      selectedChat?.id === chat.id ? 'bg-teal-50' : ''
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {chatPhoto && isDirectChat(chat) ? (
                        <img src={chatPhoto} alt={chatDisplayName} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                          chatKind === 'group'
                            ? 'bg-blue-500'
                            : chatKind === 'newsletter'
                              ? 'bg-indigo-500'
                              : chatKind === 'status' || chatKind === 'broadcast'
                                ? 'bg-amber-500'
                                : 'bg-teal-100 text-teal-700'
                        }`}>
                          {chatKind === 'group' ? (
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
                          {leadStatus && badgeStyles && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap"
                              style={badgeStyles}
                            >
                              {leadStatus}
                            </span>
                          )}
                          {chatTypeLabel && (
                            <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${chatTypeBadgeClass}`}>
                              {chatTypeLabel}
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
                        {unreadWaitingLabel && (
                          <span className="text-[10px] text-rose-600 whitespace-nowrap">Aguardando {unreadWaitingLabel}</span>
                        )}
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
                  selectedChatKind === 'group'
                    ? 'bg-blue-500'
                    : selectedChatKind === 'newsletter'
                      ? 'bg-indigo-500'
                      : selectedChatKind === 'status' || selectedChatKind === 'broadcast'
                        ? 'bg-amber-500'
                        : 'bg-teal-100 text-teal-700'
                }`}>
                  {selectedChatKind === 'group' ? (
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
                    {selectedChatTypeLabel && (
                      <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${selectedChatTypeBadgeClass}`}>
                        {selectedChatTypeLabel}
                      </span>
                    )}
                    {selectedLead && (
                      <StatusDropdown
                        currentStatus={selectedLead.status ?? 'Sem status'}
                        leadId={selectedLead.id}
                        onStatusChange={async (_leadId, newStatus) => handleUpdateLeadStatus(newStatus, selectedLead.id)}
                        statusOptions={leadStatuses}
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedChatKind === 'group'
                      ? 'Toque para ver info do grupo'
                      : selectedChatIsDirect
                        ? selectedChatPhoneFormatted
                          ? `${selectedChatPhoneFormatted}${copiedPhone === selectedChatPhone ? ' • copiado' : ''}`
                          : 'Conversa individual'
                        : selectedChatKind === 'newsletter'
                          ? 'Canal informativo'
                          : selectedChatKind === 'status'
                            ? 'Atualizacoes de status'
                            : selectedChatKind === 'broadcast'
                              ? 'Lista de transmissao'
                              : 'Conversa'}
                  </p>
                  {selectedChatIsDirect && (
                    <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${effectiveFirstResponseSlaBadge.className}`}>
                      {effectiveFirstResponseSlaBadge.label}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedChatKind === 'group' ? (
                    <button
                      type="button"
                      onClick={() => setShowGroupInfo(!showGroupInfo)}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      title="Informações do grupo"
                    >
                      <Info className="w-5 h-5 text-slate-600" />
                    </button>
                  ) : selectedChatIsDirect ? (
                    <button
                      type="button"
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      title={copiedPhone === selectedChatPhone ? 'Telefone copiado' : 'Copiar telefone'}
                      onClick={handleCopySelectedChatPhone}
                    >
                      <Phone className="w-5 h-5 text-slate-600" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sincronizar mensagens"
                    onClick={handleSyncFromWhapi}
                    disabled={syncingChatId === selectedChat.id}
                  >
                    <History className={`w-5 h-5 text-slate-600 ${syncingChatId === selectedChat.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    title="Ações da conversa"
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      openChatContextMenu(selectedChat.id, rect.left, rect.bottom + 6);
                    }}
                  >
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {hasOlderMessages && (
                  <div className="mb-4 flex justify-center">
                    <button
                      type="button"
                      onClick={loadOlderMessages}
                      disabled={isLoadingOlderMessages}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoadingOlderMessages ? 'Carregando mensagens antigas...' : 'Carregar mensagens antigas'}
                    </button>
                  </div>
                )}
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <p>{isLoadingMessages ? 'Carregando mensagens...' : 'Nenhuma mensagem ainda'}</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const payloadData = message.payload as any;
                    const isReactionOnly = payloadData?.action?.type === 'reaction' && payloadData?.action?.target;
                    if (isReactionOnly) return null;
                    const showAuthor = selectedChatKind === 'group' && message.direction === 'inbound' && message.author;
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
                templateVariables={templateVariablesForInput}
                templateVariableShortcuts={templateVariableShortcuts}
                onMessageSent={handleMessageSent}
                replyToMessage={replyToMessage}
                onCancelReply={handleCancelReply}
                editMessage={editMessage}
                onCancelEdit={handleCancelEdit}
              />

              {showGroupInfo && selectedChatKind === 'group' && (
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
    </PanelAdaptiveLoadingFrame>
  );
}
