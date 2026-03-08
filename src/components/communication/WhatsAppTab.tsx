import { startTransition, useState, useEffect, useRef, useMemo } from 'react';
import { supabase, fetchAllPages, type Lead } from '../../lib/supabase';
import {
  Search,
  MessageCircle,
  Check,
  X,
  Phone,
  MoreVertical,
  ArrowLeft,
  Users,
  UserCircle,
  Info,
  History,
  Plus,
  Bell,
  SkipForward,
  Settings,
  Copy,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { MessageInput, type SentMessagePayload } from './MessageInput';
import { useAuth } from '../../contexts/AuthContext';
import type { LeadStatusConfig } from '../../lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusDropdown from '../StatusDropdown';
import ModalShell from '../ui/ModalShell';
import Button from '../ui/Button';
import { WhatsAppPageSkeleton } from '../ui/panelSkeletons';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';
import { getBadgeStyle, getContrastTextColor, hexToRgba } from '../../lib/colorUtils';
import { MessageBubble } from './MessageBubble';
import { MessageHistoryPanel } from './MessageHistoryPanel';
import { GroupInfoPanel } from './GroupInfoPanel';
import WhatsAppSettingsModal from './WhatsAppSettingsModal';
import ReminderSchedulerModal from '../ReminderSchedulerModal';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { shouldPromptFirstReminderAfterQuote, syncLeadNextReturnFromUpcomingReminder } from '../../lib/leadReminderUtils';
import { resolveWhatsAppMessageBody } from '../../lib/whatsappMessageBody';
import { SAO_PAULO_TIMEZONE, getDateKey } from '../../lib/dateUtils';
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
  payload?: WhatsAppMessagePayload | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  edit_count?: number;
  edited_at?: string | null;
  original_body?: string | null;
  author?: string | null;
};

type WhatsAppMessageAction = {
  type?: string;
  target?: string;
  emoji?: string;
  [key: string]: unknown;
};

type WhatsAppMessageReaction = {
  emoji?: string;
  count?: number;
};

type WhatsAppMessagePayload = {
  action?: WhatsAppMessageAction;
  reactions?: WhatsAppMessageReaction[];
  [key: string]: unknown;
};

const MESSAGES_PAGE_SIZE = 120;

const DAY_SEPARATOR_LABEL_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIMEZONE,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

type ChatFilterMode = 'all' | 'unread' | 'groups' | 'direct' | 'channels' | 'broadcasts';

type FirstResponseSLA =
  | { kind: 'no-inbound' }
  | { kind: 'waiting'; minutes: number }
  | { kind: 'replied'; minutes: number };

type ReminderQuickOpenItem = {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueAt: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadStatus?: string | null;
};

type ReminderQuickOpenPeriod = 'overdue' | 'today' | 'thisWeek' | 'thisMonth' | 'later';

type ReminderQuickOpenSchedulerDefaults = {
  defaultTitle?: string;
  defaultDescription?: string;
  defaultType?: 'Retorno' | 'Follow-up' | 'Outro';
  defaultPriority?: 'normal' | 'alta' | 'baixa';
};

type SyncAllChatsProgress = {
  total: number;
  completed: number;
  failed: number;
};

const REMINDER_QUICK_OPEN_PERIODS: Array<{
  id: ReminderQuickOpenPeriod;
  label: string;
  emptyLabel: string;
  accentClassName: string;
}> = [
  {
    id: 'overdue',
    label: 'Atrasados',
    emptyLabel: 'Sem lembretes atrasados.',
    accentClassName: 'border-red-200 bg-red-50 text-red-700',
  },
  {
    id: 'today',
    label: 'Hoje',
    emptyLabel: 'Sem lembretes para hoje.',
    accentClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    id: 'thisWeek',
    label: 'Esta semana',
    emptyLabel: 'Sem lembretes para esta semana.',
    accentClassName: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  {
    id: 'thisMonth',
    label: 'Este mês',
    emptyLabel: 'Sem lembretes para este mês.',
    accentClassName: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    id: 'later',
    label: 'Mais adiante',
    emptyLabel: 'Sem lembretes futuros.',
    accentClassName: 'border-slate-300 bg-slate-100 text-slate-700',
  },
];

const REMINDER_QUICK_OPEN_AUTO_REFRESH_MS = 60_000;
const REMINDER_QUICK_OPEN_STALE_MS = 45_000;

const PERSON_FALLBACK_NOTIFICATION_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='#d1fae5'/><circle cx='32' cy='24' r='10' fill='#0f766e'/><path d='M14 50c3-9 12-14 18-14s15 5 18 14' fill='none' stroke='#0f766e' stroke-width='6' stroke-linecap='round'/></svg>",
  );

const COUNTRY_CALLING_CODES = new Set<string>([
  '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90',
  '91', '92', '93', '94', '95', '98', '211', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226',
  '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243',
  '244', '245', '246', '247', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '260', '261',
  '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298', '299', '350', '351', '352', '353',
  '354', '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375', '376', '377', '378', '380', '381',
  '382', '383', '385', '386', '387', '389', '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507',
  '508', '509', '590', '591', '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675',
  '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690', '691', '692', '850',
  '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964', '965', '966', '967', '968', '970', '971',
  '972', '973', '974', '975', '976', '977', '992', '993', '994', '995', '996', '998',
]);

const groupInternationalNationalNumber = (digits: string) => {
  const length = digits.length;
  if (length <= 4) return digits;
  if (length <= 7) return `${digits.slice(0, length - 4)}-${digits.slice(-4)}`;
  if (length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (length === 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  if (length === 12) return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;

  const tail = digits.slice(-4);
  const head = digits.slice(0, -4);
  const chunks = head.match(/.{1,3}/g) || [head];
  return `${chunks.join(' ')} ${tail}`.trim();
};

const formatBrazilNationalNumber = (local: string) => {
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return groupInternationalNationalNumber(local);
};

const isLikelyBrazilLocalNumber = (digits: string) => {
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (!Number.isFinite(ddd) || ddd < 11 || ddd > 99) return false;
  if (digits.length === 11) return digits[2] === '9';
  return true;
};

const resolveInternationalPhoneParts = (digits: string): { countryCode: string; national: string } | null => {
  const normalized = digits.replace(/^00+/, '');
  if (!normalized) return null;

  for (let size = 3; size >= 1; size -= 1) {
    if (normalized.length <= size + 3) continue;
    const code = normalized.slice(0, size);
    if (!COUNTRY_CALLING_CODES.has(code)) continue;
    return { countryCode: code, national: normalized.slice(size) };
  }

  if (normalized.length > 10) {
    const inferredSize = Math.min(3, Math.max(1, normalized.length - 10));
    return {
      countryCode: normalized.slice(0, inferredSize),
      national: normalized.slice(inferredSize),
    };
  }

  return null;
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
  const [contactsById, setContactsById] = useState<Map<string, { name: string; saved: boolean }>>(new Map());
  const [contactsList, setContactsList] = useState<Array<{ id: string; name: string; saved: boolean; pushname?: string }>>(
    [],
  );
  const [contactPhotosById, setContactPhotosById] = useState<Map<string, string>>(new Map());
  const [leadsList, setLeadsList] = useState<Array<{ id: string; name: string; phone: string; status?: string | null; responsavel?: string | null }>>(
    [],
  );
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusConfig[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [chatFilterMode, setChatFilterMode] = useState<ChatFilterMode>('all');
  const [prioritizeUnread, setPrioritizeUnread] = useState(false);
  const [chatMenu, setChatMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [chatMenuMuteOpen, setChatMenuMuteOpen] = useState(false);
  const [isListSettingsOpen, setIsListSettingsOpen] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatTab, setNewChatTab] = useState<'leads' | 'contacts' | 'manual'>('leads');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [syncingChatId, setSyncingChatId] = useState<string | null>(null);
  const [isSyncingAllChats, setIsSyncingAllChats] = useState(false);
  const [syncAllChatsProgress, setSyncAllChatsProgress] = useState<SyncAllChatsProgress>({
    total: 0,
    completed: 0,
    failed: 0,
  });
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadedMessagesCount, setLoadedMessagesCount] = useState(0);
  const [slaTick, setSlaTick] = useState(0);
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [chatCopiedAt, setChatCopiedAt] = useState<number | null>(null);
  const [myReactionsByMessage, setMyReactionsByMessage] = useState<Map<string, string>>(new Map());
  const [groupNamesById, setGroupNamesById] = useState<Map<string, string>>(new Map());
  const [newsletterNamesById, setNewsletterNamesById] = useState<Map<string, string>>(new Map());
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [reminderQuickOpenItems, setReminderQuickOpenItems] = useState<ReminderQuickOpenItem[]>([]);
  const [isLoadingReminderQuickOpen, setIsLoadingReminderQuickOpen] = useState(false);
  const [hasLoadedReminderQuickOpen, setHasLoadedReminderQuickOpen] = useState(false);
  const [reminderQuickOpenError, setReminderQuickOpenError] = useState<string | null>(null);
  const [collapsedReminderQuickOpenPeriods, setCollapsedReminderQuickOpenPeriods] = useState<Set<ReminderQuickOpenPeriod>>(
    () => new Set(),
  );
  const [markingReminderReadId, setMarkingReminderReadId] = useState<string | null>(null);
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(null);
  const [reminderSchedulerRequest, setReminderSchedulerRequest] = useState<{
    lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;
    promptMessage?: string;
    defaults?: ReminderQuickOpenSchedulerDefaults;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const chatsRef = useRef<WhatsAppChat[]>([]);
  const selectedChatRef = useRef<WhatsAppChat | null>(null);
  const newsletterNamesByIdRef = useRef<Map<string, string>>(new Map());
  const newsletterNameLookupAttemptsRef = useRef<Set<string>>(new Set());
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const userRef = useRef(user);
  const isWindowFocusedRef = useRef(true);
  const desktopNotificationsEnabledRef = useRef(true);
  const notificationPermissionRef = useRef<NotificationPermission | 'unsupported'>('unsupported');
  const notificationAudioRef = useRef<AudioContext | null>(null);
  const activeDesktopNotificationRef = useRef<Notification | null>(null);
  const unreadCountsRefreshTimeoutRef = useRef<number | null>(null);
  const muteMenuCloseTimeoutRef = useRef<number | null>(null);
  const skipNextAutoScrollRef = useRef(false);
  const activeMessagesLoadIdRef = useRef(0);
  const activeChatsLoadIdRef = useRef(0);
  const lastGroupNamesSyncAtRef = useRef(0);
  const handledReminderQueryRef = useRef<string | null>(null);
  const reminderQuickOpenLoadingRef = useRef(false);
  const reminderQuickOpenLastLoadedAtRef = useRef(0);
  const messagesCacheRef = useRef<Map<string, { messages: WhatsAppMessage[]; loadedCount: number; hasOlder: boolean }>>(
    new Map(),
  );
  const messageByIdRef = useRef<Map<string, WhatsAppMessage>>(new Map());
  const loadingUi = useAdaptiveLoading(loading);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const selectChat = (chat: WhatsAppChat | null) => {
    startTransition(() => {
      setSelectedChat(chat);
    });
  };

  function normalizePhoneNumber(phone: string | null | undefined) {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (!digits) return '';

    digits = digits.replace(/^00+/, '');

    if (digits.startsWith('0') && digits.length > 11) {
      digits = digits.replace(/^0+/, '');
    }

    if (digits.startsWith('55')) {
      const local = digits.slice(2).replace(/^0+/, '');
      if (!local) return '';
      if (local.length === 10 || local.length === 11) {
        return local;
      }
      if (local.length > 11) {
        return local.slice(-11);
      }
      return local;
    }

    if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
      const stripped = digits.replace(/^0+/, '');
      if (stripped.length === 10 || stripped.length === 11) {
        return stripped;
      }
    }

    return digits;
  }

  const collectPhoneMatchKeys = (value: string | null | undefined): string[] => {
    const digitsOnly = (value || '').replace(/\D/g, '');
    if (!digitsOnly) {
      return [];
    }

    const keys = new Set<string>();
    const push = (digits: string) => {
      if (!digits) return;
      keys.add(digits);
      const normalized = normalizePhoneNumber(digits);
      if (normalized) {
        keys.add(normalized);
      }

      if (digits.startsWith('55') && digits.length > 11) {
        keys.add(digits.slice(2));
      }

      if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        keys.add(`55${digits}`);
      }
    };

    push(digitsOnly);

    const snapshot = Array.from(keys);
    snapshot.forEach((digits) => {
      const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;

      if (local.length === 11 && local[2] === '9') {
        const withoutNinthDigit = `${local.slice(0, 2)}${local.slice(3)}`;
        push(withoutNinthDigit);
      }

      if (local.length === 10) {
        const withNinthDigit = `${local.slice(0, 2)}9${local.slice(2)}`;
        push(withNinthDigit);
      }
    });

    return Array.from(keys)
      .map((digits) => normalizePhoneNumber(digits) || digits)
      .filter(Boolean);
  };

  const getLeadMatchKeysForChat = (chat: Pick<WhatsAppChat, 'id' | 'name' | 'phone_number' | 'lid' | 'is_group'> | null): string[] => {
    if (!chat || !isDirectChat(chat)) {
      return [];
    }

    const keys = new Set<string>();
    [chat.id, chat.name, normalizeChatId(chat.id), chat.phone_number, chat.lid].forEach((value) => {
      collectPhoneMatchKeys(value).forEach((key) => keys.add(key));
    });

    const digitCandidates = [getPhoneDigits(chat.id), getPhoneDigits(chat.phone_number), normalizePhoneNumber(chat.id)].filter(Boolean);
    digitCandidates.forEach((digits) => {
      collectPhoneMatchKeys(digits).forEach((key) => keys.add(key));
      getDirectIdVariantsFromDigits(digits).forEach((variant) => {
        collectPhoneMatchKeys(variant).forEach((key) => keys.add(key));
      });
    });

    return Array.from(keys);
  };

  const getMessageTimeValue = (message: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>) => {
    const primary = message.timestamp ? new Date(message.timestamp).getTime() : Number.NaN;
    if (!Number.isNaN(primary)) return primary;
    const fallback = new Date(message.created_at).getTime();
    return Number.isNaN(fallback) ? 0 : fallback;
  };

  const getMessageCreatedAtValue = (message: Pick<WhatsAppMessage, 'created_at'>) => {
    const parsed = new Date(message.created_at).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sortMessagesChronologically = (
    left: Pick<WhatsAppMessage, 'timestamp' | 'created_at'> & Partial<Pick<WhatsAppMessage, 'id'>>,
    right: Pick<WhatsAppMessage, 'timestamp' | 'created_at'> & Partial<Pick<WhatsAppMessage, 'id'>>,
  ) => {
    const timeDelta = getMessageTimeValue(left) - getMessageTimeValue(right);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    const createdAtDelta = getMessageCreatedAtValue(left) - getMessageCreatedAtValue(right);
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return (left.id || '').localeCompare(right.id || '');
  };

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

  const isClientGeneratedMessageId = (id: string) => id.startsWith('local-') || id.startsWith('msg-');

  const normalizeMessageBodyForMatch = (value: string | null | undefined) =>
    (value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const isLikelyOutboundDuplicateMessage = (
    left: Pick<WhatsAppMessage, 'id' | 'direction' | 'body' | 'type' | 'has_media' | 'timestamp' | 'created_at'>,
    right: Pick<WhatsAppMessage, 'id' | 'direction' | 'body' | 'type' | 'has_media' | 'timestamp' | 'created_at'>,
  ) => {
    if (left.id === right.id) return true;
    if (left.direction !== 'outbound' || right.direction !== 'outbound') return false;
    if (!isClientGeneratedMessageId(left.id) && !isClientGeneratedMessageId(right.id)) return false;

    const leftBody = normalizeMessageBodyForMatch(left.body);
    const rightBody = normalizeMessageBodyForMatch(right.body);
    if (!leftBody || !rightBody || leftBody !== rightBody) return false;

    const leftType = (left.type || '').toLowerCase();
    const rightType = (right.type || '').toLowerCase();
    if (leftType !== rightType) return false;
    if (Boolean(left.has_media) !== Boolean(right.has_media)) return false;

    const timeDelta = Math.abs(getMessageTimeValue(left) - getMessageTimeValue(right));
    return timeDelta <= 2 * 60 * 1000;
  };

  const getMessageMergeScore = (
    message: Pick<WhatsAppMessage, 'id' | 'ack_status' | 'timestamp' | 'payload' | 'created_at'>,
  ) => {
    let score = 0;
    if (!isClientGeneratedMessageId(message.id)) score += 4;
    if (typeof message.ack_status === 'number') score += 2;
    if (message.timestamp) score += 1;
    if (message.payload && typeof message.payload === 'object') score += 1;
    if (message.created_at) score += 1;
    return score;
  };

  const mergeMessageForDisplay = (left: WhatsAppMessage, right: WhatsAppMessage): WhatsAppMessage => {
    const leftScore = getMessageMergeScore(left);
    const rightScore = getMessageMergeScore(right);

    const preferred =
      rightScore > leftScore || (rightScore === leftScore && getMessageTimeValue(right) >= getMessageTimeValue(left))
        ? right
        : left;
    const fallback = preferred === left ? right : left;

    return {
      ...fallback,
      ...preferred,
      id: preferred.id,
      ack_status: preferred.ack_status ?? fallback.ack_status,
      body: preferred.body ?? fallback.body,
      timestamp: preferred.timestamp ?? fallback.timestamp,
      payload: preferred.payload ?? fallback.payload,
      created_at: preferred.created_at || fallback.created_at,
    };
  };

  const dedupeMessagesForDisplay = (items: WhatsAppMessage[]) => {
    const sorted = [...items].sort(sortMessagesChronologically);
    const deduped: WhatsAppMessage[] = [];

    sorted.forEach((message) => {
      const sameIdIndex = deduped.findIndex((item) => item.id === message.id);
      if (sameIdIndex >= 0) {
        deduped[sameIdIndex] = mergeMessageForDisplay(deduped[sameIdIndex], message);
        return;
      }

      const likelyDuplicateIndex = deduped.findIndex((item) => isLikelyOutboundDuplicateMessage(item, message));
      if (likelyDuplicateIndex >= 0) {
        deduped[likelyDuplicateIndex] = mergeMessageForDisplay(deduped[likelyDuplicateIndex], message);
        return;
      }

      deduped.push(message);
    });

    return deduped.sort(sortMessagesChronologically);
  };

  const asMessagePayload = (payload: unknown): WhatsAppMessagePayload =>
    payload && typeof payload === 'object' ? (payload as WhatsAppMessagePayload) : {};

  const resolveReactionTargetChatId = (message: WhatsAppMessage) => {
    const payloadData = asMessagePayload(message.payload);
    const action = payloadData?.action;
    if (action?.type !== 'reaction' || !action?.target) return null;

    const targetMessageId = String(action.target);
    if (!targetMessageId) return null;

    const targetInCurrentScope = messageByIdRef.current.get(targetMessageId);
    if (targetInCurrentScope?.chat_id) {
      return targetInCurrentScope.chat_id;
    }

    for (const cachedState of messagesCacheRef.current.values()) {
      const targetInCache = cachedState.messages.find((item) => item.id === targetMessageId);
      if (targetInCache?.chat_id) {
        return targetInCache.chat_id;
      }
    }

    return null;
  };

  const getMessageCalendarDate = (message: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>) => {
    const timeValue = getMessageTimeValue(message);
    if (!Number.isFinite(timeValue) || timeValue <= 0) return null;
    const date = new Date(timeValue);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getMessageDayKey = (message: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>) => {
    const date = getMessageCalendarDate(message);
    if (!date) return '';
    return getDateKey(date, SAO_PAULO_TIMEZONE);
  };

  const formatDaySeparatorLabel = (message: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>) => {
    const date = getMessageCalendarDate(message);
    if (!date) return '';

    const currentDayKey = getDateKey(date, SAO_PAULO_TIMEZONE);
    const todayKey = getDateKey(new Date(), SAO_PAULO_TIMEZONE);
    if (currentDayKey === todayKey) return 'Hoje';

    const yesterdayKey = getDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000), SAO_PAULO_TIMEZONE);
    if (currentDayKey === yesterdayKey) return 'Ontem';

    const formatted = DAY_SEPARATOR_LABEL_FORMATTER.format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const openNextUnreadChat = () => {
    const unreadChats = chatsRef.current
      .filter((chat) => !chat.archived && (chat.unread_count ?? 0) > 0)
      .sort(sortChatsByLatest);

    if (unreadChats.length === 0) return;

    const currentChat = selectedChatRef.current;
    const currentIndex = currentChat ? unreadChats.findIndex((chat) => chat.id === currentChat.id) : -1;
    const nextChat = currentIndex >= 0 ? unreadChats[(currentIndex + 1) % unreadChats.length] : unreadChats[0];

    selectChat(nextChat);
  };

  const getChatKind = (chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => {
    if (chat.is_group) return 'group' as const;

    const kind = getWhatsAppChatKind(chat.id);
    if (kind !== 'unknown') return kind;

    const digits = chat.id.replace(/\D/g, '');
    if (!chat.id.includes('@') && digits.length >= 10) {
      return 'direct' as const;
    }

    return kind;
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

  const getPhoneDigits = (value: string | null | undefined) => {
    if (!value) return '';
    return value.replace(/\D/g, '');
  };

  const getDirectIdVariantsFromDigits = (digits: string) => {
    if (!digits) return [];
    const phoneDigitsVariants = new Set<string>([digits]);

    const toggleBrazilNinthDigit = (value: string, withCountryCode: boolean) => {
      const base = withCountryCode ? value.slice(2) : value;
      if (base.length === 10) {
        const withNine = `${base.slice(0, 2)}9${base.slice(2)}`;
        phoneDigitsVariants.add(withCountryCode ? `55${withNine}` : withNine);
      }
      if (base.length === 11 && base[2] === '9') {
        const withoutNine = `${base.slice(0, 2)}${base.slice(3)}`;
        phoneDigitsVariants.add(withCountryCode ? `55${withoutNine}` : withoutNine);
      }
    };

    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      const local = digits.slice(2);
      if (local) {
        phoneDigitsVariants.add(local);
      }
      toggleBrazilNinthDigit(digits, true);
      if (local) {
        toggleBrazilNinthDigit(local, false);
      }
    }

    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
      phoneDigitsVariants.add(`55${digits}`);
      toggleBrazilNinthDigit(digits, false);
      toggleBrazilNinthDigit(`55${digits}`, true);
    }

    const snapshot = Array.from(phoneDigitsVariants);
    snapshot.forEach((value) => {
      if (value.startsWith('55') && (value.length === 12 || value.length === 13)) {
        phoneDigitsVariants.add(value.slice(2));
      }
      if (!value.startsWith('55') && (value.length === 10 || value.length === 11)) {
        phoneDigitsVariants.add(`55${value}`);
      }
    });

    const variants = new Set<string>();
    phoneDigitsVariants.forEach((value) => {
      variants.add(`${value}@s.whatsapp.net`);
      variants.add(`${value}@c.us`);
    });

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

  const loadLeadNames = async () => {
    try {
      const data = await fetchAllPages<{
        id: string;
        telefone: string;
        nome_completo: string;
        status?: string | null;
        responsavel_id?: string | null;
      }>(async (from, to) => {
        const response = await supabase
          .from('leads')
          .select('id, telefone, nome_completo, status, responsavel_id')
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: response.data, error: response.error };
      });

      setLeadsList(
        (data || [])
          .map((lead) => ({
            id: lead.id,
            name: lead.nome_completo,
            phone: normalizePhoneNumber(lead.telefone),
            status: lead.status ?? null,
            responsavel: lead.responsavel_id ?? null,
          }))
          .filter((lead) => Boolean(lead.phone)),
      );
    } catch (err) {
      console.error('Error loading lead names:', err);
    }
  };

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
        if (leadsList.length === 0) {
          void loadLeadNames();
        }
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
  }, [chatMenu, isListSettingsOpen, isMobileView, selectedChat, showGroupInfo, showNewChatModal, leadsList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadSavedContacts = async () => {
      try {
        const pageSize = 500;
        let offset = 0;
        const loadedContacts: Array<{ id: string; name: string; pushname: string; saved: boolean }> = [];

        while (true) {
          const response = await getWhatsAppContacts(pageSize, offset);
          const batch = Array.isArray(response.contacts) ? response.contacts : [];
          if (batch.length === 0) break;

          loadedContacts.push(...batch);
          offset += batch.length;

          if (batch.length < pageSize) break;
          if (typeof response.total === 'number' && loadedContacts.length >= response.total) break;
        }

        const contactMap = new Map<string, { name: string; saved: boolean }>();

        setContactsList(
          loadedContacts.map((contact) => ({
            id: contact.id,
            name: contact.name || contact.pushname || contact.id,
            saved: contact.saved,
            pushname: contact.pushname,
          })),
        );

        loadedContacts.forEach((contact) => {
          const displayName = (contact.name || contact.pushname || '').trim();
          if (!displayName) return;

          const isSavedContact = contact.saved || Boolean(contact.name?.trim());
          const variants = new Set<string>();
          variants.add(contact.id);

          const normalized = normalizeChatId(contact.id);
          if (normalized) {
            variants.add(normalized);
            if (normalized.endsWith('@s.whatsapp.net')) {
              variants.add(normalized.replace(/@s\.whatsapp\.net$/i, '@c.us'));
            }
            if (normalized.endsWith('@c.us')) {
              variants.add(normalized.replace(/@c\.us$/i, '@s.whatsapp.net'));
            }
          }

          const digits = getPhoneDigits(contact.id);
          getDirectIdVariantsFromDigits(digits).forEach((variant) => variants.add(variant));

          variants.forEach((variant) => {
            contactMap.set(variant, { name: displayName, saved: isSavedContact });
          });
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

    void loadLeadNames();
    void loadSavedContacts();
    void loadContactPhotos();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) return;
    if (leadsList.length > 0) return;
    void loadLeadNames();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const leadsSubscription = supabase
      .channel('whatsapp_leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedLeadId = (payload.old as { id?: string } | null)?.id;
          if (!deletedLeadId) return;
          setLeadsList((prev) => prev.filter((lead) => lead.id !== deletedLeadId));
          return;
        }

        const row = payload.new as
          | {
              id?: string;
              telefone?: string | null;
              nome_completo?: string | null;
              status?: string | null;
              responsavel_id?: string | null;
            }
          | null;
        if (!row?.id) return;

        const leadId = row.id as string;

        const normalizedPhone = normalizePhoneNumber(row.telefone ?? '');

        setLeadsList((prev) => {
          const existingIndex = prev.findIndex((lead) => lead.id === leadId);
          const existingLead = existingIndex >= 0 ? prev[existingIndex] : null;
          const resolvedPhone = normalizedPhone || existingLead?.phone || '';

          if (!resolvedPhone) {
            return prev;
          }

          const nextLead = {
            id: leadId,
            name: row.nome_completo?.trim() || existingLead?.name || resolvedPhone,
            phone: resolvedPhone,
            status: row.status ?? existingLead?.status ?? null,
            responsavel: row.responsavel_id ?? existingLead?.responsavel ?? null,
          };

          if (existingIndex === -1) {
            return [nextLead, ...prev];
          }

          const next = [...prev];
          next[existingIndex] = nextLead;
          return next;
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(leadsSubscription);
    };
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
        const incomingMessage = (eventType === 'DELETE' ? payload.old : payload.new) as WhatsAppMessage | null;
        if (!incomingMessage?.id || !incomingMessage.chat_id) return;

        const reactionTargetChatId = eventType === 'DELETE' ? null : resolveReactionTargetChatId(incomingMessage);
        const message =
          reactionTargetChatId && reactionTargetChatId !== incomingMessage.chat_id
            ? {
                ...incomingMessage,
                chat_id: reactionTargetChatId,
                from_number:
                  incomingMessage.direction === 'inbound' &&
                  (!incomingMessage.from_number || incomingMessage.from_number === incomingMessage.chat_id)
                    ? reactionTargetChatId
                    : incomingMessage.from_number,
                to_number:
                  incomingMessage.direction === 'outbound' ? reactionTargetChatId : incomingMessage.to_number,
              }
            : incomingMessage;

        if (eventType === 'INSERT' && isReactionOnlyMessage(message) && !reactionTargetChatId) {
          const hasChatInMemory = chatsRef.current.some((chat) => getChatIdVariants(chat).includes(message.chat_id));
          if (!hasChatInMemory) {
            return;
          }
        }

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
              setMessages((prev) => {
                const existingByIdIndex = prev.findIndex((item) => item.id === message.id);
                if (existingByIdIndex >= 0) {
                  const next = [...prev];
                  next[existingByIdIndex] = mergeMessageForDisplay(next[existingByIdIndex], message);
                  return next.sort(sortMessagesChronologically);
                }

                const likelyDuplicateIndex = prev.findIndex((item) => isLikelyOutboundDuplicateMessage(item, message));
                if (likelyDuplicateIndex >= 0) {
                  const next = [...prev];
                  next[likelyDuplicateIndex] = mergeMessageForDisplay(next[likelyDuplicateIndex], message);
                  return next.sort(sortMessagesChronologically);
                }

                const merged = [...prev, message];
                return dedupeMessagesForDisplay(merged);
              });

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

        if (eventType === 'DELETE') {
          void loadChats();
          return;
        }

        setChats((prev) => {
          const updated = prev.map((chat) => {
            const variantsForChat = getChatIdVariants(chat);
            if (!variantsForChat.includes(message.chat_id)) return chat;

            const preview = getMessagePreview(message);
            if (!preview && eventType === 'INSERT') {
              return chat;
            }

            const messageTimestamp = message.timestamp || message.created_at || null;
            const messageTime = messageTimestamp ? new Date(messageTimestamp).getTime() : 0;
            const currentTime = chat.last_message_at ? new Date(chat.last_message_at).getTime() : 0;
            if (messageTime && currentTime && messageTime < currentTime) return chat;
            const shouldUnarchive = eventType === 'INSERT' && chat.archived && !isChatMuted(chat);
            return {
              ...chat,
              last_message: preview || chat.last_message,
              last_message_at: preview ? messageTimestamp || chat.last_message_at : chat.last_message_at,
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [selectedChat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    void loadUnreadCounts();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const indexedMessages = new Map<string, WhatsAppMessage>();
    messages.forEach((message) => {
      indexedMessages.set(message.id, message);
    });
    messageByIdRef.current = indexedMessages;

    const currentChat = selectedChatRef.current;
    if (!currentChat) return;

    messagesCacheRef.current.set(currentChat.id, {
      messages,
      loadedCount: loadedMessagesCount,
      hasOlder: hasOlderMessages,
    });
  }, [messages, loadedMessagesCount, hasOlderMessages]);

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

      const fetchedCount = (data || []).length;
      const baseMessages = dedupeMessagesForDisplay(data || []);
      setMessages((prev) => {
        const mergedMessages = dedupeMessagesForDisplay([...prev, ...baseMessages]);
        messagesCacheRef.current.set(chat.id, {
          messages: mergedMessages,
          loadedCount: fetchedCount,
          hasOlder: fetchedCount === MESSAGES_PAGE_SIZE,
        });
        return mergedMessages;
      });
      setLoadedMessagesCount(fetchedCount);
      setHasOlderMessages(fetchedCount === MESSAGES_PAGE_SIZE);

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

      const olderMessages = dedupeMessagesForDisplay(data || []);
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

        const nextMessages = dedupeMessagesForDisplay([...deduped, ...prev]);
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

        const likelyDuplicateIndex = prev.findIndex((item) => isLikelyOutboundDuplicateMessage(item, nextMessage));
        if (likelyDuplicateIndex >= 0) {
          const next = [...prev];
          next[likelyDuplicateIndex] = mergeMessageForDisplay(next[likelyDuplicateIndex], nextMessage);
          return next.sort(sortMessagesChronologically);
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
            const payloadData = asMessagePayload(message.payload);
            const reactions = Array.isArray(payloadData.reactions) ? payloadData.reactions : [];
            const nextReactions = reactions
              .map((item: WhatsAppMessageReaction) =>
                item.emoji === emoji ? { ...item, count: Math.max(0, (item.count ?? 1) - 1) } : item,
              )
              .filter((item: WhatsAppMessageReaction) => (item.count ?? 0) > 0);
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
          const payloadData = asMessagePayload(message.payload);
          const reactions = Array.isArray(payloadData.reactions) ? payloadData.reactions : [];
          const existing = reactions.find((item: WhatsAppMessageReaction) => item.emoji === emoji);
          const nextReactions = existing
            ? reactions.map((item: WhatsAppMessageReaction) =>
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
    if (!selectedChat || syncingChatId === selectedChat.id || isSyncingAllChats) return;

    setSyncingChatId(selectedChat.id);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-sync', {
        body: { chatId: selectedChat.id, count: 200 },
      });

      if (error) {
        throw error;
      }

      await loadMessages(selectedChat);
      scheduleUnreadCountsRefresh();
    } catch (error) {
      console.error('Error syncing from Whapi:', error);
    } finally {
      setSyncingChatId(null);
    }
  };

  const handleSyncAllChatsFromListSettings = async () => {
    if (isSyncingAllChats || syncingChatId) return;

    const chatIds = Array.from(new Set(chatsRef.current.map((chat) => chat.id).filter(Boolean)));
    if (chatIds.length === 0) {
      return;
    }

    setIsSyncingAllChats(true);
    setSyncAllChatsProgress({ total: chatIds.length, completed: 0, failed: 0 });

    let failed = 0;

    try {
      for (let index = 0; index < chatIds.length; index += 1) {
        const chatId = chatIds[index];
        const { error } = await supabase.functions.invoke('whatsapp-sync', {
          body: { chatId, count: 200 },
        });

        if (error) {
          failed += 1;
          console.error('Erro ao sincronizar chat:', chatId, error);
        }

        setSyncAllChatsProgress({
          total: chatIds.length,
          completed: index + 1,
          failed,
        });
      }

      await loadChats();

      const currentSelectedChat = selectedChatRef.current;
      if (currentSelectedChat) {
        await loadMessages(currentSelectedChat, { silent: true });
      }

      scheduleUnreadCountsRefresh();
    } catch (error) {
      console.error('Erro ao sincronizar todos os chats:', error);
    } finally {
      setIsSyncingAllChats(false);
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

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return phone;

    if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
      return `+55 ${formatBrazilNationalNumber(cleaned.slice(2))}`;
    }

    if (isLikelyBrazilLocalNumber(cleaned)) {
      return formatBrazilNationalNumber(cleaned);
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

    const international = resolveInternationalPhoneParts(cleaned);
    if (international && international.national) {
      if (international.countryCode === '55') {
        return `+55 ${formatBrazilNationalNumber(international.national)}`;
      }
      if (international.countryCode === '86' && international.national.length === 11) {
        return `+86 ${international.national.slice(0, 3)} ${international.national.slice(3, 7)} ${international.national.slice(7)}`;
      }
      if (international.countryCode === '1' && international.national.length === 10) {
        return `+1 (${international.national.slice(0, 3)}) ${international.national.slice(3, 6)}-${international.national.slice(6)}`;
      }
      return `+${international.countryCode} ${groupInternationalNationalNumber(international.national)}`.trim();
    }

    return cleaned;
  };

  const isReactionOnlyMessage = (message: Pick<WhatsAppMessage, 'payload'>) => {
    const payloadData = asMessagePayload(message.payload);
    const actionType = String(payloadData?.action?.type || '').toLowerCase();
    return actionType === 'reaction' && payloadData?.action?.target;
  };

  const isEditActionMessage = (message: Pick<WhatsAppMessage, 'payload' | 'type'>) => {
    const type = (message.type || '').toLowerCase();
    if (type !== 'action') return false;

    const payloadData = asMessagePayload(message.payload);
    const actionType = String(payloadData?.action?.type || '').toLowerCase();
    return (actionType === 'edit' || actionType === 'edited') && Boolean(payloadData?.action?.target);
  };

  const getMessagePreview = (
    message: Pick<WhatsAppMessage, 'body' | 'type' | 'has_media' | 'payload' | 'is_deleted'>,
  ) => {
    if (message.is_deleted) return 'Mensagem apagada';
    if (isEditActionMessage(message)) return null;
    if (isReactionOnlyMessage(message)) return null;

    const resolvedBody = resolveWhatsAppMessageBody({
      body: message.body,
      type: message.type,
      payload: message.payload,
    });
    if (resolvedBody) {
      const normalizedResolved = resolvedBody.trim().toLowerCase();
      if (
        normalizedResolved === '[evento do whatsapp]' ||
        normalizedResolved === '[atualização do whatsapp]' ||
        normalizedResolved === '[mensagem não suportada]'
      ) {
        return null;
      }
      return resolvedBody;
    }

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
    const title = (() => {
      const preferredName = resolvedChat ? getChatDisplayName(resolvedChat) : '';
      if (preferredName && !isPhoneLikeLabel(preferredName)) {
        return preferredName;
      }

      const candidateKeys = new Set<string>();
      [message.chat_id, message.from_number, resolvedChat?.phone_number].forEach((value) => {
        collectPhoneMatchKeys(value).forEach((key) => candidateKeys.add(key));
      });

      for (const key of candidateKeys) {
        const lead = leadByPhoneMatchKey.get(key);
        if (lead?.name?.trim()) {
          return lead.name.trim();
        }
      }

      const contactCandidates = new Set<string>();
      [message.chat_id, message.from_number, resolvedChat?.phone_number].forEach((value) => {
        if (!value) return;
        if (value.includes('@')) {
          const normalized = normalizeChatId(value);
          if (normalized) {
            contactCandidates.add(normalized);
          }
        }

        const digits = getPhoneDigits(value);
        if (digits) {
          getDirectIdVariantsFromDigits(digits).forEach((variant) => contactCandidates.add(variant));
        }
      });

      for (const candidate of contactCandidates) {
        const contact = contactsById.get(candidate);
        if (contact?.name?.trim() && !isPhoneLikeLabel(contact.name)) {
          return contact.name.trim();
        }
      }

      return preferredName || getChatDisplayNameFromId(message.chat_id);
    })();

    const icon = (() => {
      const variants = new Set<string>();

      if (resolvedChat) {
        getChatIdVariants(resolvedChat).forEach((variant) => variants.add(variant));
      }

      [message.chat_id, message.from_number, resolvedChat?.phone_number].forEach((value) => {
        if (!value) return;

        if (value.includes('@')) {
          const normalized = normalizeChatId(value);
          if (normalized) {
            variants.add(normalized);
          }
        }

        const digits = getPhoneDigits(value);
        if (digits) {
          getDirectIdVariantsFromDigits(digits).forEach((variant) => variants.add(variant));
        }
      });

      for (const variant of variants) {
        const photo = contactPhotosById.get(variant);
        if (photo) {
          return photo;
        }
      }

      return PERSON_FALLBACK_NOTIFICATION_ICON;
    })();

    activeDesktopNotificationRef.current?.close();
    const desktopNotification = new Notification(title, {
      body: preview,
      tag: `whatsapp-${resolvedChat?.id || message.chat_id}`,
      icon,
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

  const leadByPhoneMatchKey = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; status?: string | null; responsavel?: string | null }>();

    leadsList.forEach((lead) => {
      collectPhoneMatchKeys(lead.phone).forEach((key) => {
        if (!map.has(key)) {
          map.set(key, lead);
        }
      });
    });

    return map;
  }, [leadsList]); // eslint-disable-line react-hooks/exhaustive-deps

  const leadNamesByPhone = useMemo(() => {
    const map = new Map<string, string>();

    leadByPhoneMatchKey.forEach((lead, key) => {
      if (!map.has(key)) {
        map.set(key, lead.name);
      }
    });

    return map;
  }, [leadByPhoneMatchKey]);

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
    const leadMatchKeys = getLeadMatchKeysForChat(chat);

    for (const key of leadMatchKeys) {
      const leadName = leadNamesByPhone.get(key);
      if (leadName) {
        return leadName;
      }
    }

    const contactCandidates = new Set<string>([
      normalizeChatId(chat.id) || chat.id,
      chat.id,
      chat.id.endsWith('@s.whatsapp.net') ? chat.id.replace(/@s\.whatsapp\.net$/i, '@c.us') : '',
      chat.id.endsWith('@c.us') ? chat.id.replace(/@c\.us$/i, '@s.whatsapp.net') : '',
      chat.phone_number ? buildChatIdFromPhone(chat.phone_number) : '',
      chat.lid ?? '',
    ].filter(Boolean));

    const candidateDigits = [getPhoneDigits(chat.id), getPhoneDigits(chat.phone_number), phone].filter(Boolean);
    candidateDigits.forEach((digits) => {
      getDirectIdVariantsFromDigits(digits).forEach((variant) => contactCandidates.add(variant));
    });

    for (const candidate of contactCandidates) {
      const contact = contactsById.get(candidate);
      if (contact?.name && (contact.saved || !isPhoneLikeLabel(contact.name))) {
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
  const channelInboxCount = inboxChats.filter((chat) => getChatKind(chat) === 'newsletter').length;
  const broadcastInboxCount = inboxChats.filter((chat) => getChatKind(chat) === 'broadcast').length;

  const filteredVisibleChats = inboxChats.filter((chat) => {
    if (chatFilterMode === 'unread') return (chat.unread_count ?? 0) > 0;
    if (chatFilterMode === 'groups') return getChatKind(chat) === 'group';
    if (chatFilterMode === 'direct') return isDirectChat(chat);
    if (chatFilterMode === 'channels') return getChatKind(chat) === 'newsletter';
    if (chatFilterMode === 'broadcasts') return getChatKind(chat) === 'broadcast';
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

  const visibleChats = sortedVisibleChats;
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
      const payloadData = asMessagePayload(message.payload);
      const baseReactions = Array.isArray(payloadData?.reactions) ? payloadData.reactions : [];

      baseReactions.forEach((reaction: WhatsAppMessageReaction) => {
        if (!reaction?.emoji) return;
        const targetMap = map.get(message.id) ?? new Map<string, number>();
        const increment = typeof reaction.count === 'number' ? reaction.count : 1;
        targetMap.set(reaction.emoji, increment);
        map.set(message.id, targetMap);
      });
    });

    messages.forEach((message) => {
      const payloadData = asMessagePayload(message.payload);
      const action = payloadData?.action;
      const actionType = String(action?.type || '').toLowerCase();
      if (actionType === 'reaction' && action?.target && action?.emoji) {
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

  const renderedMessages = useMemo(
    () => messages.filter((message) => !isReactionOnlyMessage(message) && !isEditActionMessage(message)),
    [messages], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const selectedChatDisplayName = selectedChat ? getChatDisplayName(selectedChat) : '';
  const selectedLead = useMemo(() => {
    const matchKeys = getLeadMatchKeysForChat(selectedChat);
    for (const key of matchKeys) {
      const matchedLead = leadByPhoneMatchKey.get(key);
      if (matchedLead) {
        return matchedLead;
      }
    }

    return null;
  }, [leadByPhoneMatchKey, selectedChat]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstResponseSla = useMemo<FirstResponseSLA>(() => {
    const timeline = [...messages]
      .filter((message) => {
        if (!message.direction) return false;
        const payloadData = asMessagePayload(message.payload);
        const actionType = String(payloadData?.action?.type || '').toLowerCase();
        if (actionType === 'reaction' && payloadData?.action?.target) return false;
        if ((actionType === 'edit' || actionType === 'edited') && payloadData?.action?.target) return false;
        return true;
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
  }, [messages, slaTick]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const isDarkThemeActive =
    typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');
  const getLeadStatusBadgeStyle = (hexColor: string) => {
    if (!isDarkThemeActive) {
      return getBadgeStyle(hexColor, 0.34);
    }

    const preferredContrast = getContrastTextColor(hexColor);

    return {
      backgroundColor: hexToRgba(hexColor, 0.2),
      color: preferredContrast === '#ffffff' ? '#f8fafc' : hexToRgba(hexColor, 0.95),
      borderColor: hexToRgba(hexColor, 0.58),
    };
  };
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
  }, [selectedChat, selectedChatDisplayName, selectedLead, user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const clearMuteMenuCloseTimeout = () => {
    if (muteMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(muteMenuCloseTimeoutRef.current);
      muteMenuCloseTimeoutRef.current = null;
    }
  };

  const openMuteSubmenu = () => {
    clearMuteMenuCloseTimeout();
    setChatMenuMuteOpen(true);
  };

  const closeMuteSubmenuSoon = () => {
    clearMuteMenuCloseTimeout();
    muteMenuCloseTimeoutRef.current = window.setTimeout(() => {
      muteMenuCloseTimeoutRef.current = null;
      setChatMenuMuteOpen(false);
    }, 140);
  };

  const closeMuteSubmenuNow = () => {
    clearMuteMenuCloseTimeout();
    setChatMenuMuteOpen(false);
  };

  useEffect(() => {
    return () => {
      if (muteMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(muteMenuCloseTimeoutRef.current);
      }
    };
  }, []);

  const openChatContextMenu = (chatId: string, x: number, y: number) => {
    const menuWidth = 224;
    const menuHeight = 260;
    const safeX = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - menuWidth - 8));
    const safeY = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - menuHeight - 8));

    closeMuteSubmenuNow();
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
  const selectedChatPhoto = (() => {
    if (!selectedChat || !selectedChatIsDirect) return null;
    const variants = getChatIdVariants(selectedChat);
    for (const variant of variants) {
      const photo = contactPhotosById.get(variant);
      if (photo) return photo;
    }
    return null;
  })();
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

  const handleCopyFullChat = async () => {
    if (!selectedChat || messages.length === 0) return;

    const exportedLines = [...messages]
      .sort(sortMessagesChronologically)
      .map((message) => {
        const preview = getMessagePreview(message);
        if (!preview) return null;

        const eventTime = message.timestamp || message.created_at;
        const parsed = new Date(eventTime);
        if (Number.isNaN(parsed.getTime())) return null;

        const time = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const date = parsed.toLocaleDateString('pt-BR');

        const author = (() => {
          if (message.direction === 'outbound') return 'EU';
          if (selectedChatKind === 'group') {
            if (message.author) return formatPhone(message.author);
            if (message.from_number) return formatPhone(message.from_number);
          }
          return selectedChatDisplayName || 'CONTATO';
        })();

        return `[${time}, ${date}] ${author}: ${preview}`;
      })
      .filter((line): line is string => Boolean(line));

    if (exportedLines.length === 0) return;

    try {
      await navigator.clipboard.writeText(exportedLines.join('\n'));
      setChatCopiedAt(Date.now());
      window.setTimeout(() => {
        setChatCopiedAt(null);
      }, 1600);
    } catch (error) {
      console.error('Erro ao copiar chat:', error);
    }
  };

  const resolveDirectChatTarget = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.includes('@')) {
      const normalizedId = normalizeChatId(trimmed);
      const digits = getPhoneDigits(normalizedId);
      const normalizedPhone = normalizePhoneNumber(digits);
      return {
        chatId: normalizedId,
        phoneNumber: normalizedPhone || digits || null,
      };
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;

    const withCountryCode =
      digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
        ? digits
        : isLikelyBrazilLocalNumber(digits)
          ? `55${digits}`
          : digits;

    return {
      chatId: `${withCountryCode}@s.whatsapp.net`,
      phoneNumber: normalizePhoneNumber(withCountryCode),
    };
  };

  const openChatFromPhone = (phone: string, name?: string) => {
    const target = resolveDirectChatTarget(phone);
    if (!target) return;

    const { chatId, phoneNumber } = target;
    const now = new Date().toISOString();
    const nextChat: WhatsAppChat = {
      id: chatId,
      name: name ?? null,
      is_group: false,
      phone_number: phoneNumber,
      last_message_at: null,
      created_at: now,
      updated_at: now,
      last_message: '',
      unread_count: 0,
    };

    startTransition(() => {
      setChats((prev) => {
        if (prev.some((chat) => chat.id === chatId)) return prev;
        return [nextChat, ...prev];
      });
      setSelectedChat(nextChat);
      setChatFilterMode('all');
      setShowNewChatModal(false);
      setNewChatSearch('');
      setNewChatPhone('');
    });
  };

const formatReminderDueAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponivel';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const extractLeadNameFromReminderTitle = (title?: string | null) => {
  const trimmed = title?.trim();
  if (!trimmed) return null;

  const explicitName = trimmed.match(/^(?:follow\s*-?\s*up|retorno|lembrete)\s*[:-]\s*(.+)$/i)?.[1]?.trim();
  if (explicitName) {
    return explicitName;
  }

  const genericName = trimmed.match(/[:-]\s*(.+)$/)?.[1]?.trim();
  return genericName || null;
};

const resolveReminderLeadName = (leadName?: string | null, reminderTitle?: string | null) => {
  const normalizedLeadName = leadName?.trim();
  if (normalizedLeadName) {
    return normalizedLeadName;
  }

  return extractLeadNameFromReminderTitle(reminderTitle) || 'Lead sem nome';
};

const getReminderPriorityMeta = (priority?: string | null) => {
  const normalized = (priority || 'normal').trim().toLowerCase();

  if (normalized === 'alta' || normalized === 'high') {
    return { label: 'Alta', className: 'border border-red-300 bg-red-100 text-red-700' };
  }

  if (normalized === 'baixa' || normalized === 'low') {
    return { label: 'Baixa', className: 'border border-emerald-300 bg-emerald-100 text-emerald-700' };
  }

  return { label: 'Normal', className: 'border border-blue-300 bg-blue-100 text-blue-700' };
};

const getReminderTypeMeta = (type?: string | null) => {
  const normalized = (type || '').trim().toLowerCase();

  if (normalized === 'retorno') {
    return { label: 'Retorno', className: 'border border-teal-300 bg-teal-100 text-teal-700' };
  }

  if (normalized === 'follow-up' || normalized === 'follow up' || normalized === 'followup') {
    return { label: 'Follow-up', className: 'border border-blue-300 bg-blue-100 text-blue-700' };
  }

  return {
    label: type?.trim() || 'Outro',
    className: 'border border-slate-300 bg-slate-100 text-slate-700',
  };
};

const mapReminderTypeToSchedulerType = (type?: string | null): 'Retorno' | 'Follow-up' | 'Outro' => {
  const normalized = (type || '').trim().toLowerCase();
  if (normalized === 'retorno') return 'Retorno';
  if (normalized === 'follow-up' || normalized === 'follow up' || normalized === 'followup') return 'Follow-up';
  return 'Outro';
};

const mapReminderPriorityToSchedulerPriority = (priority?: string | null): 'normal' | 'alta' | 'baixa' => {
  const normalized = (priority || 'normal').trim().toLowerCase();
  if (normalized === 'alta' || normalized === 'high') return 'alta';
  if (normalized === 'baixa' || normalized === 'low') return 'baixa';
  return 'normal';
};

const reminderQuickOpenNameCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  usage: 'sort',
});

const compareReminderQuickOpenItems = (left: ReminderQuickOpenItem, right: ReminderQuickOpenItem) => {
  const leftDueAt = new Date(left.dueAt).getTime();
  const rightDueAt = new Date(right.dueAt).getTime();
  const leftHasValidDate = Number.isFinite(leftDueAt);
  const rightHasValidDate = Number.isFinite(rightDueAt);

  if (leftHasValidDate && rightHasValidDate && leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  if (leftHasValidDate !== rightHasValidDate) {
    return leftHasValidDate ? -1 : 1;
  }

  const leftLabel = (left.leadName || left.title || '').trim();
  const rightLabel = (right.leadName || right.title || '').trim();
  const labelComparison = reminderQuickOpenNameCollator.compare(leftLabel, rightLabel);

  if (labelComparison !== 0) {
    return labelComparison;
  }

  return reminderQuickOpenNameCollator.compare(left.id, right.id);
};

const groupReminderQuickOpenItems = (items: ReminderQuickOpenItem[]) => {
  const referenceDate = new Date();
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0, 23, 59, 59, 999);

  const grouped: Record<ReminderQuickOpenPeriod, ReminderQuickOpenItem[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
  };

  items.forEach((item) => {
    const dueDate = new Date(item.dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      grouped.later.push(item);
      return;
    }

    if (dueDate.getTime() < startOfToday.getTime()) {
      grouped.overdue.push(item);
      return;
    }

    if (dueDate >= startOfToday && dueDate < endOfToday) {
      grouped.today.push(item);
      return;
    }

    if (dueDate <= endOfWeek) {
      grouped.thisWeek.push(item);
      return;
    }

    if (dueDate <= endOfMonth) {
      grouped.thisMonth.push(item);
      return;
    }

    grouped.later.push(item);
  });

  (Object.keys(grouped) as ReminderQuickOpenPeriod[]).forEach((period) => {
    grouped[period].sort(compareReminderQuickOpenItems);
  });

  return grouped;
};

  const loadReminderQuickOpen = async (options?: { preserveExistingItems?: boolean }) => {
    if (reminderQuickOpenLoadingRef.current) return;

    const preserveExistingItems = options?.preserveExistingItems ?? reminderQuickOpenItems.length > 0;

    reminderQuickOpenLoadingRef.current = true;
    setIsLoadingReminderQuickOpen(true);
    setReminderQuickOpenError(null);

    try {
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select('id, lead_id, contract_id, titulo, tipo, prioridade, data_lembrete, lido')
        .eq('lido', false)
        .order('data_lembrete', { ascending: true })
        .limit(300);

      if (remindersError) throw remindersError;

      const reminders =
        ((remindersData || []) as Array<{
          id: string;
          lead_id?: string | null;
          contract_id?: string | null;
          titulo?: string | null;
          tipo?: string | null;
          prioridade?: string | null;
          data_lembrete: string;
          lido?: boolean | null;
        }>) || [];

      const contractIds = Array.from(
        new Set(
          reminders
            .filter((reminder) => !reminder.lead_id && reminder.contract_id)
            .map((reminder) => reminder.contract_id as string),
        ),
      );

      const contractLeadMap = new Map<string, string>();
      if (contractIds.length > 0) {
        const { data: contractsData, error: contractsError } = await supabase
          .from('contracts')
          .select('id, lead_id')
          .in('id', contractIds);

        if (!contractsError) {
          ((contractsData || []) as Array<{ id: string; lead_id?: string | null }>).forEach((contract) => {
            if (contract.id && contract.lead_id) {
              contractLeadMap.set(contract.id, contract.lead_id);
            }
          });
        }
      }

      const leadById = new Map(leadsList.map((lead) => [lead.id, lead]));
      const reminderLeadCandidates = reminders
        .map((reminder) => reminder.lead_id || (reminder.contract_id ? contractLeadMap.get(reminder.contract_id) ?? null : null))
        .filter((leadId): leadId is string => typeof leadId === 'string' && leadId.length > 0);
      const leadIdsToRefresh = Array.from(
        new Set(
          reminderLeadCandidates.filter((leadId) => {
            const existingLead = leadById.get(leadId);
            return !existingLead || !existingLead.name?.trim() || !existingLead.phone;
          }),
        ),
      );

      if (leadIdsToRefresh.length > 0) {
        const { data: missingLeadsData, error: missingLeadsError } = await supabase
          .from('leads')
          .select('id, telefone, nome_completo, status, responsavel_id')
          .in('id', leadIdsToRefresh);

        if (!missingLeadsError) {
          const normalizedMissingLeads = ((missingLeadsData || []) as Array<{
            id: string;
            telefone: string;
            nome_completo: string;
            status?: string | null;
            responsavel_id?: string | null;
          }>)
            .map((lead) => ({
              id: lead.id,
              name: lead.nome_completo?.trim() || '',
              phone: normalizePhoneNumber(lead.telefone),
              status: lead.status ?? null,
              responsavel: lead.responsavel_id ?? null,
            }));

          if (normalizedMissingLeads.length > 0) {
            const leadsWithPhone = normalizedMissingLeads.filter((lead) => Boolean(lead.phone));

            if (leadsWithPhone.length > 0) {
              setLeadsList((prev) => {
                const next = [...prev];
                leadsWithPhone.forEach((lead) => {
                  const existingIndex = next.findIndex((item) => item.id === lead.id);
                  if (existingIndex === -1) {
                    next.push(lead);
                  } else {
                    next[existingIndex] = lead;
                  }
                });
                return next;
              });
            }

            normalizedMissingLeads.forEach((lead) => {
              leadById.set(lead.id, lead);
            });
          }
        }
      }

      const items = reminders
        .map((reminder) => {
          const resolvedLeadId = reminder.lead_id || (reminder.contract_id ? contractLeadMap.get(reminder.contract_id) : null);
          if (!resolvedLeadId) return null;

          const lead = leadById.get(resolvedLeadId);
          return {
            id: reminder.id,
            title: reminder.titulo?.trim() || 'Lembrete sem titulo',
            type: reminder.tipo?.trim() || 'Outro',
            priority: reminder.prioridade?.trim() || 'normal',
            dueAt: reminder.data_lembrete,
            leadId: resolvedLeadId,
            leadName: resolveReminderLeadName(lead?.name, reminder.titulo),
            leadPhone: lead?.phone || '',
            leadStatus: lead?.status ?? null,
          } as ReminderQuickOpenItem;
        })
        .filter((item): item is ReminderQuickOpenItem => Boolean(item))
        .sort(compareReminderQuickOpenItems);

      setReminderQuickOpenItems(items);
      reminderQuickOpenLastLoadedAtRef.current = Date.now();
    } catch (error) {
      console.error('Erro ao carregar lembretes para o WhatsApp:', error);
      setReminderQuickOpenError('Nao foi possivel carregar os lembretes agora.');
      if (!preserveExistingItems) {
        setReminderQuickOpenItems([]);
      }
    } finally {
      reminderQuickOpenLoadingRef.current = false;
      setHasLoadedReminderQuickOpen(true);
      setIsLoadingReminderQuickOpen(false);
    }
  };

  const handleOpenRemindersModal = () => {
    setShowRemindersModal(true);
    setIsListSettingsOpen(false);

    const hasFreshSnapshot =
      hasLoadedReminderQuickOpen &&
      Date.now() - reminderQuickOpenLastLoadedAtRef.current <= REMINDER_QUICK_OPEN_STALE_MS;

    if (!hasFreshSnapshot) {
      void loadReminderQuickOpen({ preserveExistingItems: true });
    }
  };

  useEffect(() => {
    void loadReminderQuickOpen({ preserveExistingItems: true });

    const refreshIntervalId = window.setInterval(() => {
      void loadReminderQuickOpen({ preserveExistingItems: true });
    }, REMINDER_QUICK_OPEN_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(refreshIntervalId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openReminderLeadInWhatsApp = (item: ReminderQuickOpenItem) => {
    if (!item.leadPhone) return;

    const params = new URLSearchParams();
    params.set('openPhone', item.leadPhone);
    params.set('leadName', item.leadName);
    params.set('leadId', item.leadId);

    startTransition(() => {
      setShowRemindersModal(false);
      navigate(`/painel/whatsapp?${params.toString()}`);
    });
  };

  const resolveReminderLeadForScheduling = async (item: ReminderQuickOpenItem) => {
    let leadMatch = leadsList.find((lead) => lead.id === item.leadId);

    const needsRefresh = !leadMatch || !leadMatch.name?.trim() || !leadMatch.phone;
    if (needsRefresh) {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('id, nome_completo, telefone, responsavel_id, status')
        .eq('id', item.leadId)
        .maybeSingle();

      if (!leadError && leadData?.id) {
        const refreshedLead = {
          id: leadData.id,
          name: leadData.nome_completo?.trim() || '',
          phone: normalizePhoneNumber(leadData.telefone),
          status: leadData.status ?? leadMatch?.status ?? null,
          responsavel: leadData.responsavel_id ?? leadMatch?.responsavel ?? null,
        };

        if (refreshedLead.phone) {
          setLeadsList((prev) => {
            const existingIndex = prev.findIndex((lead) => lead.id === refreshedLead.id);
            if (existingIndex === -1) {
              return [...prev, refreshedLead];
            }
            const next = [...prev];
            next[existingIndex] = refreshedLead;
            return next;
          });
        }

        leadMatch = refreshedLead;
      }
    }

    const phone = leadMatch?.phone || normalizePhoneNumber(item.leadPhone);
    if (!phone) return null;

    return {
      id: item.leadId,
      nome_completo: resolveReminderLeadName(leadMatch?.name, item.title),
      telefone: phone,
      responsavel: leadMatch?.responsavel ?? null,
    };
  };

  const handleMarkReminderAsReadAndSchedule = async (item: ReminderQuickOpenItem) => {
    if (markingReminderReadId === item.id) return;

    setMarkingReminderReadId(item.id);

    try {
      const completedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('reminders')
        .update({ lido: true, concluido_em: completedAt })
        .eq('id', item.id);

      if (updateError) throw updateError;

      await syncLeadNextReturnFromUpcomingReminder(item.leadId);

      setReminderQuickOpenItems((current) =>
        current.filter((reminderItem) => reminderItem.id !== item.id),
      );

      const leadForScheduler = await resolveReminderLeadForScheduling(item);
      if (!leadForScheduler) {
        alert('Lembrete marcado como lido, mas não foi possível abrir o agendamento do próximo contato.');
        return;
      }

      setShowRemindersModal(false);
      openReminderScheduler(
        leadForScheduler,
        'Lembrete marcado como lido. Deseja agendar o próximo contato?',
        {
          defaultTitle: item.title,
          defaultType: mapReminderTypeToSchedulerType(item.type),
          defaultPriority: mapReminderPriorityToSchedulerPriority(item.priority),
        },
      );
    } catch (error) {
      console.error('Erro ao marcar lembrete como lido no WhatsApp:', error);
      alert('Não foi possível marcar este lembrete como lido.');
    } finally {
      setMarkingReminderReadId((current) => (current === item.id ? null : current));
    }
  };

  const handleMarkLeadAsLostAndClearPendingReminders = async (item: ReminderQuickOpenItem) => {
    if (markingLostLeadId === item.leadId) return;

    const leadFromList = leadsList.find((lead) => lead.id === item.leadId);
    const leadName = resolveReminderLeadName(leadFromList?.name, item.title);
    const previousStatus = leadFromList?.status ?? 'Sem status';

    const confirmed = await requestConfirmation({
      title: 'Marcar lead como perdido',
      description: `Deseja marcar ${leadName} como perdido e limpar todos os lembretes pendentes?`,
      confirmLabel: 'Marcar como perdido',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    setMarkingLostLeadId(item.leadId);

    try {
      const nowIso = new Date().toISOString();

      const { error: updateLeadError } = await supabase
        .from('leads')
        .update({
          status: 'Perdido',
          proximo_retorno: null,
          ultimo_contato: nowIso,
        })
        .eq('id', item.leadId);

      if (updateLeadError) throw updateLeadError;

      const { error: statusHistoryError } = await supabase.from('lead_status_history').insert([
        {
          lead_id: item.leadId,
          status_anterior: previousStatus,
          status_novo: 'Perdido',
          responsavel: user?.email ?? 'WhatsApp',
        },
      ]);

      if (statusHistoryError) {
        console.error('Erro ao registrar historico de status do lead no WhatsApp:', statusHistoryError);
      }

      const reminderIdsToDelete = new Set<string>();

      const { data: leadRemindersData, error: leadRemindersError } = await supabase
        .from('reminders')
        .select('id')
        .eq('lido', false)
        .eq('lead_id', item.leadId)
        .limit(1000);

      if (leadRemindersError) throw leadRemindersError;

      ((leadRemindersData || []) as Array<{ id: string }>).forEach((reminder) => {
        if (reminder.id) reminderIdsToDelete.add(reminder.id);
      });

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('id')
        .eq('lead_id', item.leadId);

      if (contractsError) throw contractsError;

      const contractIds = ((contractsData || []) as Array<{ id: string }>)
        .map((contract) => contract.id)
        .filter((contractId): contractId is string => Boolean(contractId));

      if (contractIds.length > 0) {
        const contractChunkSize = 40;

        for (let index = 0; index < contractIds.length; index += contractChunkSize) {
          const contractChunk = contractIds.slice(index, index + contractChunkSize);
          const { data: contractRemindersData, error: contractRemindersError } = await supabase
            .from('reminders')
            .select('id')
            .eq('lido', false)
            .in('contract_id', contractChunk)
            .limit(1000);

          if (contractRemindersError) throw contractRemindersError;

          ((contractRemindersData || []) as Array<{ id: string }>).forEach((reminder) => {
            if (reminder.id) reminderIdsToDelete.add(reminder.id);
          });
        }
      }

      const reminderIdsList = Array.from(reminderIdsToDelete);

      if (reminderIdsList.length > 0) {
        const deleteChunkSize = 200;

        for (let index = 0; index < reminderIdsList.length; index += deleteChunkSize) {
          const deleteChunk = reminderIdsList.slice(index, index + deleteChunkSize);
          const { error: deleteError } = await supabase
            .from('reminders')
            .delete()
            .in('id', deleteChunk);

          if (deleteError) throw deleteError;
        }
      }

      await syncLeadNextReturnFromUpcomingReminder(item.leadId);

      setLeadsList((prev) => prev.map((lead) => (lead.id === item.leadId ? { ...lead, status: 'Perdido' } : lead)));
      setReminderQuickOpenItems((current) =>
        current
          .filter((reminder) => !reminderIdsToDelete.has(reminder.id))
          .map((reminder) =>
            reminder.leadId === item.leadId
              ? {
                  ...reminder,
                  leadStatus: 'Perdido',
                }
              : reminder,
          ),
      );
    } catch (error) {
      console.error('Erro ao marcar lead como perdido no WhatsApp:', error);
      alert('Nao foi possivel marcar este lead como perdido.');
    } finally {
      setMarkingLostLeadId((current) => (current === item.leadId ? null : current));
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const phoneParam = params.get('openPhone') || params.get('phone');
    if (!phoneParam) {
      return;
    }

    const digits = phoneParam.replace(/\D/g, '');
    if (!digits) {
      return;
    }

    if (handledReminderQueryRef.current === location.search) {
      return;
    }
    handledReminderQueryRef.current = location.search;

    const leadName = params.get('leadName') || undefined;
    openChatFromPhone(digits, leadName);
    setShowRemindersModal(false);

    params.delete('openPhone');
    params.delete('phone');
    params.delete('leadName');
    params.delete('leadId');

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const openReminderScheduler = (
    lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>,
    promptMessage?: string,
    defaults?: ReminderQuickOpenSchedulerDefaults,
  ) => {
    setReminderSchedulerRequest({ lead, promptMessage, defaults });
  };

  const closeReminderScheduler = () => {
    setReminderSchedulerRequest(null);
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

      if (shouldPromptFirstReminderAfterQuote(statusName)) {
        openReminderScheduler(
          {
            id: lead.id,
            nome_completo: lead.name,
            telefone: lead.phone,
            responsavel: lead.responsavel ?? (user?.email ?? null),
          },
          'Deseja agendar o primeiro lembrete após a proposta/cotação enviada?'
        );
      }
    } catch (error) {
      console.error('Erro ao atualizar status do lead:', error);
      alert('Erro ao atualizar status do lead');
    }
  };

  const showChatList = !isMobileView || !selectedChat;
  const showMessageArea = !isMobileView || selectedChat;

  const hasChatSnapshot = chats.length > 0;
  const groupedReminderQuickOpenItems = groupReminderQuickOpenItems(reminderQuickOpenItems);
  const overdueReminderQuickOpenCount = groupedReminderQuickOpenItems.overdue.length;
  const toggleReminderQuickOpenPeriod = (periodId: ReminderQuickOpenPeriod) => {
    setCollapsedReminderQuickOpenPeriods((current) => {
      const next = new Set(current);
      if (next.has(periodId)) {
        next.delete(periodId);
      } else {
        next.add(periodId);
      }
      return next;
    });
  };

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
        className="flex h-full min-h-0 overflow-hidden bg-slate-50"
        onClick={() => {
          closeMuteSubmenuNow();
          setChatMenu(null);
          setIsListSettingsOpen(false);
        }}
      >
      <WhatsAppSettingsModal
        isOpen={isListSettingsOpen}
        onClose={() => setIsListSettingsOpen(false)}
        isSyncingAllChats={isSyncingAllChats}
        syncingChatId={syncingChatId}
        chatsCount={chats.length}
        syncAllChatsProgress={syncAllChatsProgress}
        onSyncAllChats={() => {
          void handleSyncAllChatsFromListSettings();
        }}
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggleShowArchived={() => setShowArchived((prev) => !prev)}
        prioritizeUnread={prioritizeUnread}
        onTogglePrioritizeUnread={setPrioritizeUnread}
        notificationPermission={notificationPermission}
        notificationsActive={notificationsActive}
        notificationsLabel={notificationsLabel}
        onToggleDesktopNotifications={() => {
          void handleToggleDesktopNotifications();
        }}
      />
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
      {showRemindersModal && (
        <ModalShell
          isOpen
          onClose={() => setShowRemindersModal(false)}
          title="Lembretes pendentes"
          size="lg"
          panelClassName="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="panel-glass-panel rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Abertura rapida de conversas</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Abra em um clique os chats com lembretes pendentes vinculados aos leads.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => void loadReminderQuickOpen()}
                  disabled={isLoadingReminderQuickOpen}
                  variant="secondary"
                  size="sm"
                  className="h-8"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingReminderQuickOpen ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                  {reminderQuickOpenItems.length} pendente(s)
                </span>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                  {overdueReminderQuickOpenCount} atrasado(s)
                </span>
              </div>
            </div>

            {(isLoadingReminderQuickOpen || !hasLoadedReminderQuickOpen) &&
            reminderQuickOpenItems.length === 0 &&
            !reminderQuickOpenError ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Carregando lembretes...
              </div>
            ) : reminderQuickOpenError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-700">
                {reminderQuickOpenError}
              </div>
            ) : reminderQuickOpenItems.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Nenhum lembrete pendente com lead vinculado.
              </div>
            ) : (
              <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                {REMINDER_QUICK_OPEN_PERIODS.map((period) => {
                  const periodItems = groupedReminderQuickOpenItems[period.id];
                  if (periodItems.length === 0) return null;
                  const isCollapsed = collapsedReminderQuickOpenPeriods.has(period.id);

                  return (
                    <section key={period.id} className="space-y-2">
                      <div className="sticky top-0 z-[1] flex items-center justify-between rounded-lg border border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-sm">
                        <p className={`text-xs font-semibold uppercase tracking-wide ${period.accentClassName}`}>
                          {period.label}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleReminderQuickOpenPeriod(period.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 transition-colors hover:bg-slate-100"
                          title={isCollapsed ? 'Expandir seção' : 'Minimizar seção'}
                          aria-label={isCollapsed ? `Expandir ${period.label}` : `Minimizar ${period.label}`}
                        >
                          <span>{periodItems.length}</span>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                      </div>

                      {!isCollapsed && <div className="space-y-3">
                        {periodItems.map((item) => {
                          const dueDate = new Date(item.dueAt);
                          const startOfToday = new Date();
                          startOfToday.setHours(0, 0, 0, 0);
                          const isOverdue = !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < startOfToday.getTime();
                          const statusConfig = item.leadStatus ? statusByName.get(item.leadStatus) : null;
                          const leadStatusStyles = statusConfig ? getLeadStatusBadgeStyle(statusConfig.cor || '#94a3b8') : null;
                          const typeMeta = getReminderTypeMeta(item.type);
                          const priorityMeta = getReminderPriorityMeta(item.priority);

                          return (
                            <div key={item.id} className="panel-interactive-glass rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-slate-900">{item.leadName}</p>
                                    {leadStatusStyles && item.leadStatus && (
                                      <span className="rounded-full border px-2 py-0.5 text-[10px]" style={leadStatusStyles}>
                                        {item.leadStatus}
                                      </span>
                                    )}
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${typeMeta.className}`}>
                                      {typeMeta.label}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${priorityMeta.className}`}>
                                      {priorityMeta.label}
                                    </span>
                                    {isOverdue && (
                                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700">
                                        Atrasado
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 truncate text-xs text-slate-600">{item.title}</p>
                                  <p className="mt-2 text-[11px] text-slate-500">
                                    {item.leadPhone ? `${formatPhone(item.leadPhone)} • ` : ''}
                                    {formatReminderDueAt(item.dueAt)}
                                  </p>
                                </div>

                                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      void handleMarkReminderAsReadAndSchedule(item);
                                    }}
                                    loading={markingReminderReadId === item.id}
                                    disabled={Boolean((markingReminderReadId && markingReminderReadId !== item.id) || markingLostLeadId)}
                                    variant="info"
                                    size="icon"
                                    className="h-9 w-9"
                                    title="Marcar como lido"
                                    aria-label="Marcar como lido"
                                  >
                                    {markingReminderReadId !== item.id && <Check className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => openReminderLeadInWhatsApp(item)}
                                    disabled={!item.leadPhone || Boolean(markingReminderReadId || markingLostLeadId)}
                                    variant="success"
                                    size="icon"
                                    className="h-9 w-9"
                                    title="Abrir no WhatsApp"
                                    aria-label="Abrir no WhatsApp"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      void handleMarkLeadAsLostAndClearPendingReminders(item);
                                    }}
                                    loading={markingLostLeadId === item.leadId}
                                    disabled={Boolean((markingLostLeadId && markingLostLeadId !== item.leadId) || markingReminderReadId)}
                                    variant="danger"
                                    size="icon"
                                    className="h-9 w-9"
                                    title="Marcar como perdido e limpar lembretes pendentes"
                                    aria-label="Marcar como perdido e limpar lembretes pendentes"
                                  >
                                    {markingLostLeadId !== item.leadId && <X className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </ModalShell>
      )}
      {showChatList && (
        <div className={`${isMobileView ? 'w-full' : 'w-96 shrink-0'} bg-white border-r border-slate-200 flex flex-col min-h-0`}>
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white transition-colors hover:bg-teal-700"
                  onClick={() => {
                    setShowNewChatModal(true);
                    setNewChatTab('leads');
                    if (leadsList.length === 0) {
                      void loadLeadNames();
                    }
                    setIsListSettingsOpen(false);
                  }}
                  title="Novo chat"
                  aria-label="Novo chat"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100"
                  onClick={handleOpenRemindersModal}
                  title="Lembretes"
                  aria-label="Lembretes"
                >
                  <Bell className="h-4 w-4" />
                  {reminderQuickOpenItems.length > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {reminderQuickOpenItems.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  title="Configuracoes do WhatsApp"
                  aria-label="Configuracoes do WhatsApp"
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
                  <Settings className={`h-4 w-4 ${isSyncingAllChats ? 'animate-spin' : ''}`} />
                </button>
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
              <button
                type="button"
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  chatFilterMode === 'channels'
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setChatFilterMode('channels')}
              >
                Canais ({channelInboxCount})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  chatFilterMode === 'broadcasts'
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setChatFilterMode('broadcasts')}
              >
                Transmissoes ({broadcastInboxCount})
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (nextUnreadChat) {
                    selectChat(nextUnreadChat);
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
                const leadMatchKeys = getLeadMatchKeysForChat(chat);
                const leadForChat = leadMatchKeys
                  .map((key) => leadByPhoneMatchKey.get(key))
                  .find((lead): lead is { id: string; name: string; phone: string; status?: string | null; responsavel?: string | null } => Boolean(lead)) ?? null;
                const leadStatus = leadForChat?.status ?? null;
                const statusConfig = leadStatus ? statusByName.get(leadStatus) : null;
                const badgeStyles = statusConfig ? getLeadStatusBadgeStyle(statusConfig.cor || '#94a3b8') : null;
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
                    onClick={() => selectChat(chat)}
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
                            ? 'bg-blue-100 text-blue-700'
                            : chatKind === 'newsletter'
                              ? 'bg-indigo-500'
                              : chatKind === 'status' || chatKind === 'broadcast'
                                ? 'bg-amber-500'
                                : 'bg-teal-100 text-teal-700'
                        }`}>
                          {chatKind === 'group' ? (
                            <Users className="w-5 h-5" />
                          ) : isDirectChat(chat) ? (
                            <UserCircle className="w-5 h-5" />
                          ) : (
                            <MessageCircle className="w-5 h-5" />
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
              className="fixed z-50 w-52 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl text-sm"
              style={{ left: chatMenu.x, top: chatMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-slate-800"
                onClick={() => {
                  const target = chats.find((item) => item.id === chatMenu.chatId);
                  if (target) {
                    updateChatArchive(target.id, !target.archived);
                  }
                  closeMuteSubmenuNow();
                  setChatMenu(null);
                }}
              >
                {chats.find((item) => item.id === chatMenu.chatId)?.archived ? 'Desarquivar' : 'Arquivar'}
              </button>
              <div className="border-t border-slate-800" />
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
                        className="w-full px-3 py-2 text-left hover:bg-slate-800"
                        onClick={() => {
                          if (target) updateChatMute(target.id, null);
                          closeMuteSubmenuNow();
                          setChatMenu(null);
                        }}
                      >
                        Desmutar
                      </button>
                    ) : (
                      <div
                        className="relative"
                        onMouseEnter={openMuteSubmenu}
                        onMouseLeave={closeMuteSubmenuSoon}
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center justify-between"
                          onClick={openMuteSubmenu}
                        >
                          <span>Mutar</span>
                          <span className="text-xs text-slate-500">›</span>
                        </button>
                        {chatMenuMuteOpen && (
                          <div className="absolute left-full top-0 z-10 pl-1">
                            <div className="min-w-[160px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
                              {muteOptions.map((option) => (
                                <button
                                  key={option.label}
                                  type="button"
                                  className="w-full px-3 py-2 text-left hover:bg-slate-800"
                                  onClick={() => {
                                    if (target) {
                                      const until = new Date(Date.now() + option.ms).toISOString();
                                      updateChatMute(target.id, until);
                                    }
                                    closeMuteSubmenuNow();
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
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {showMessageArea && (
        <div className={`${isMobileView ? 'w-full' : 'flex-1'} flex min-w-0 flex-col bg-slate-100 relative min-h-0`}>
          {selectedChat ? (
            <>
              <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-3">
                {isMobileView && (
                  <button
                    onClick={() => selectChat(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                )}
                {selectedChatPhoto ? (
                  <img src={selectedChatPhoto} alt={selectedChatDisplayName || selectedChat.id} className="flex-shrink-0 w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                    selectedChatKind === 'group'
                      ? 'bg-blue-100 text-blue-700'
                      : selectedChatKind === 'newsletter'
                        ? 'bg-indigo-500'
                        : selectedChatKind === 'status' || selectedChatKind === 'broadcast'
                          ? 'bg-amber-500'
                          : 'bg-teal-100 text-teal-700'
                  }`}>
                    {selectedChatKind === 'group' ? (
                      <Users className="w-5 h-5" />
                    ) : selectedChatIsDirect ? (
                      <UserCircle className="w-5 h-5" />
                    ) : (
                      <MessageCircle className="w-5 h-5" />
                    )}
                  </div>
                )}
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
                    disabled={isSyncingAllChats || syncingChatId === selectedChat.id}
                  >
                    <History
                      className={`w-5 h-5 text-slate-600 ${isSyncingAllChats || syncingChatId === selectedChat.id ? 'animate-spin' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={chatCopiedAt ? 'Chat copiado' : 'Copiar chat'}
                    onClick={handleCopyFullChat}
                    disabled={messages.length === 0}
                  >
                    <Copy className={`w-5 h-5 ${chatCopiedAt ? 'text-emerald-600' : 'text-slate-600'}`} />
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

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
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
                {renderedMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <p>{isLoadingMessages ? 'Carregando mensagens...' : 'Nenhuma mensagem ainda'}</p>
                  </div>
                ) : (
                  renderedMessages.map((message, index) => {
                    const previousMessage = index > 0 ? renderedMessages[index - 1] : null;
                    const currentDayKey = getMessageDayKey(message);
                    const previousDayKey = previousMessage ? getMessageDayKey(previousMessage) : '';
                    const shouldShowDaySeparator = Boolean(currentDayKey) && currentDayKey !== previousDayKey;
                    const daySeparatorLabel = shouldShowDaySeparator ? formatDaySeparatorLabel(message) : '';

                    const showAuthor = selectedChatKind === 'group' && message.direction === 'inbound' && message.author;
                    const authorName = showAuthor ? formatPhone(message.author!) : undefined;
                    const reactions = reactionsByTargetId.get(message.id);

                    return (
                      <div key={message.id}>
                        {shouldShowDaySeparator && daySeparatorLabel && (
                          <div className="my-4 flex justify-center">
                            <span className="message-day-separator rounded-full border border-slate-300 bg-slate-200/80 px-3 py-1 text-[11px] font-medium text-slate-700">
                              {daySeparatorLabel}
                            </span>
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

      {reminderSchedulerRequest && (
        <ReminderSchedulerModal
          lead={reminderSchedulerRequest.lead}
          onClose={closeReminderScheduler}
          onScheduled={() => {
            closeReminderScheduler();
            void loadReminderQuickOpen();
          }}
          promptMessage={
            reminderSchedulerRequest.promptMessage ?? 'Deseja agendar o primeiro lembrete após a proposta/cotação enviada?'
          }
          defaultTitle={reminderSchedulerRequest.defaults?.defaultTitle}
          defaultDescription={reminderSchedulerRequest.defaults?.defaultDescription}
          defaultType={reminderSchedulerRequest.defaults?.defaultType ?? 'Follow-up'}
          defaultPriority={reminderSchedulerRequest.defaults?.defaultPriority}
        />
      )}
      {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
