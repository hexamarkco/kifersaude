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
  Archive,
  Inbox,
  Copy,
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  CalendarPlus,
  Loader2,
} from 'lucide-react';
import { MessageInput, type SentMessagePayload } from './MessageInput';
import { useAuth } from '../../contexts/AuthContext';
import type { LeadStatusConfig } from '../../lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusDropdown from '../StatusDropdown';
import ModalShell from '../ui/ModalShell';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { WhatsAppPageSkeleton } from '../ui/panelSkeletons';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';
import { getBadgeStyle, getContrastTextColor, hexToRgba } from '../../lib/colorUtils';
import { MessageBubble } from './MessageBubble';
import { MessageHistoryPanel } from './MessageHistoryPanel';
import { GroupInfoPanel } from './GroupInfoPanel';
import ReminderSchedulerModal from '../ReminderSchedulerModal';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { useWhatsAppInboxPreferences } from '../../hooks/useWhatsAppInboxPreferences';
import { shouldPromptFirstReminderAfterQuote, syncLeadNextReturnFromUpcomingReminder } from '../../lib/leadReminderUtils';
import { addBusinessDaysSkippingWeekends } from '../../lib/reminderUtils';
import { resolveWhatsAppMessageBody } from '../../lib/whatsappMessageBody';
import { formatWhatsAppAudioTranscriptionLabel } from '../../lib/whatsappAudioTranscription';
import { SAO_PAULO_TIMEZONE, getDateKey } from '../../lib/dateUtils';
import {
  buildChatIdFromPhone,
  getWhatsAppChat,
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

const getChatTypeBadgeClass = (kind?: string | null) => {
  const normalized = (kind || 'direct').trim().toLowerCase();

  if (normalized === 'group') return 'comm-badge-info';
  if (normalized === 'newsletter') return 'comm-badge-brand';
  if (normalized === 'status') return 'comm-badge-warning';
  if (normalized === 'broadcast') return 'comm-badge-brand';
  return 'comm-badge-neutral';
};

type WhatsAppChat = {
  id: string;
  name: string | null;
  is_group: boolean;
  phone_number?: string | null;
  lid?: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_direction?: 'inbound' | 'outbound' | null;
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

type ChatKindFilter = 'groups' | 'direct' | 'channels' | 'broadcasts';

type FirstResponseSLA =
  | { kind: 'no-inbound' }
  | { kind: 'waiting'; minutes: number }
  | { kind: 'replied'; minutes: number };

type ReminderQuickOpenItem = {
  id: string;
  title: string;
  type: string;
  priority: string;
  contractId?: string | null;
  description?: string | null;
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

type ChatLeadPresenceFilter = 'all' | 'withLead' | 'withoutLead';

const EMPTY_FILTER_VALUE = '__empty__';

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
    accentClassName: 'comm-badge comm-badge-danger',
  },
  {
    id: 'today',
    label: 'Hoje',
    emptyLabel: 'Sem lembretes para hoje.',
    accentClassName: 'comm-badge comm-badge-success',
  },
  {
    id: 'thisWeek',
    label: 'Esta semana',
    emptyLabel: 'Sem lembretes para esta semana.',
    accentClassName: 'comm-badge comm-badge-info',
  },
  {
    id: 'thisMonth',
    label: 'Este mês',
    emptyLabel: 'Sem lembretes para este mês.',
    accentClassName: 'comm-badge comm-badge-warning',
  },
  {
    id: 'later',
    label: 'Mais adiante',
    emptyLabel: 'Sem lembretes futuros.',
    accentClassName: 'comm-badge comm-badge-neutral',
  },
];

const REMINDER_QUICK_OPEN_AUTO_REFRESH_MS = 60_000;
const REMINDER_QUICK_OPEN_STALE_MS = 45_000;

const TEMPLATE_VARIABLE_SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: 'nome', label: 'Nome' },
  { key: 'primeiro_nome', label: 'Primeiro nome' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'status', label: 'Status' },
  { key: 'atendente', label: 'Atendente' },
  { key: 'data_hoje', label: 'Data de hoje' },
  { key: 'hora_agora', label: 'Hora atual' },
];

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
  const [showChatSegmentsMenu, setShowChatSegmentsMenu] = useState(false);
  const [chatOnlyUnread, setChatOnlyUnread] = useState(false);
  const [chatKindFilters, setChatKindFilters] = useState<ChatKindFilter[]>([]);
  const [showAdvancedChatFilters, setShowAdvancedChatFilters] = useState(false);
  const [chatLeadStatusFilter, setChatLeadStatusFilter] = useState('all');
  const [chatLeadOwnerFilter, setChatLeadOwnerFilter] = useState('all');
  const [chatLeadPresenceFilter, setChatLeadPresenceFilter] = useState<ChatLeadPresenceFilter>('all');
  const {
    prioritizeUnread,
    desktopNotificationsEnabled,
    notificationPermission,
  } = useWhatsAppInboxPreferences();
  const [chatMenu, setChatMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [chatMenuMuteOpen, setChatMenuMuteOpen] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatTab, setNewChatTab] = useState<'leads' | 'contacts' | 'manual'>('leads');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [syncingChatId, setSyncingChatId] = useState<string | null>(null);
  const [isSyncingAllChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadedMessagesCount, setLoadedMessagesCount] = useState(0);
  const [slaTick, setSlaTick] = useState(0);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [chatCopiedAt, setChatCopiedAt] = useState<number | null>(null);
  const [isCopyingChat, setIsCopyingChat] = useState(false);
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
  const [quickSchedulingReminderAction, setQuickSchedulingReminderAction] = useState<{
    reminderId: string;
    daysAhead: 1 | 2 | 3;
  } | null>(null);
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(null);
  const [reminderSchedulerRequest, setReminderSchedulerRequest] = useState<{
    lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;
    promptMessage?: string;
    defaults?: ReminderQuickOpenSchedulerDefaults;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const chatSegmentsMenuRef = useRef<HTMLDivElement | null>(null);
  const advancedChatFiltersRef = useRef<HTMLDivElement | null>(null);
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
  const autoSyncSelectedChatInFlightRef = useRef(false);
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
      setSelectedChat(chat && getWhatsAppChatKind(chat.id) === 'status' ? null : chat);
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

  const parseIsoTimestampMillis = (value: string | null | undefined) => {
    if (!value) return Number.NaN;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  };

  const getMessageTimeValue = (message: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>) => {
    const eventMillis = parseIsoTimestampMillis(message.timestamp);
    const createdMillis = parseIsoTimestampMillis(message.created_at);

    if (!Number.isNaN(eventMillis) && !Number.isNaN(createdMillis)) {
      return Math.min(eventMillis, createdMillis);
    }

    if (!Number.isNaN(eventMillis)) return eventMillis;
    if (!Number.isNaN(createdMillis)) return createdMillis;
    return 0;
  };

  const getMessageCreatedAtValue = (message: Pick<WhatsAppMessage, 'created_at'>) => {
    const parsed = parseIsoTimestampMillis(message.created_at);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getMessageDisplayTimestamp = (message: Pick<WhatsAppMessage, 'timestamp' | 'created_at'>): string | null => {
    const eventMillis = parseIsoTimestampMillis(message.timestamp);
    const createdMillis = parseIsoTimestampMillis(message.created_at);

    if (!Number.isNaN(eventMillis) && !Number.isNaN(createdMillis)) {
      if (eventMillis - createdMillis > 20 * 60 * 1000) {
        return message.created_at;
      }
      return message.timestamp || message.created_at || null;
    }

    return message.timestamp || message.created_at || null;
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

  const mergeAckStatusForDisplay = (
    currentAck: number | null | undefined,
    incomingAck: number | null | undefined,
  ): number | null => {
    const current = typeof currentAck === 'number' ? currentAck : null;
    const incoming = typeof incomingAck === 'number' ? incomingAck : null;

    if (incoming === null) return current;
    if (current === null) return incoming;

    if (incoming === 0 && current > 1) {
      return current;
    }

    if (current === 0 && incoming > 0) {
      return incoming;
    }

    return Math.max(current, incoming);
  };

  const mergeMessagePayloadForDisplay = (
    currentPayload: WhatsAppMessagePayload | null | undefined,
    incomingPayload: WhatsAppMessagePayload | null | undefined,
  ): WhatsAppMessagePayload | undefined => {
    const current =
      currentPayload && typeof currentPayload === 'object' ? currentPayload : undefined;
    const incoming =
      incomingPayload && typeof incomingPayload === 'object' ? incomingPayload : undefined;

    if (!current) return incoming;
    if (!incoming) return current;

    return {
      ...current,
      ...incoming,
      audio:
        current.audio && incoming.audio
          ? { ...current.audio, ...incoming.audio }
          : incoming.audio ?? current.audio,
      voice:
        current.voice && incoming.voice
          ? { ...current.voice, ...incoming.voice }
          : incoming.voice ?? current.voice,
      media:
        current.media && incoming.media
          ? { ...current.media, ...incoming.media }
          : incoming.media ?? current.media,
      image:
        current.image && incoming.image
          ? { ...current.image, ...incoming.image }
          : incoming.image ?? current.image,
      video:
        current.video && incoming.video
          ? { ...current.video, ...incoming.video }
          : incoming.video ?? current.video,
      document:
        current.document && incoming.document
          ? { ...current.document, ...incoming.document }
          : incoming.document ?? current.document,
      contact:
        current.contact && incoming.contact
          ? { ...current.contact, ...incoming.contact }
          : incoming.contact ?? current.contact,
      contact_list:
        current.contact_list && incoming.contact_list
          ? { ...current.contact_list, ...incoming.contact_list }
          : incoming.contact_list ?? current.contact_list,
      link_preview:
        current.link_preview && incoming.link_preview
          ? { ...current.link_preview, ...incoming.link_preview }
          : incoming.link_preview ?? current.link_preview,
    };
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
      ack_status: mergeAckStatusForDisplay(fallback.ack_status, preferred.ack_status),
      body: preferred.body ?? fallback.body,
      timestamp: preferred.timestamp ?? fallback.timestamp,
      payload: mergeMessagePayloadForDisplay(fallback.payload, preferred.payload),
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

  const isTechnicalCiphertextMessage = (
    message: Pick<WhatsAppMessage, 'type' | 'body' | 'payload'>,
  ) => {
    const type = (message.type || '').trim().toLowerCase();
    if (type !== 'system') return false;

    const payloadData = asMessagePayload(message.payload);
    const subtype = String(payloadData?.subtype || '').trim().toLowerCase();
    const body = (message.body || '').trim().toLowerCase();
    const payloadSystem = payloadData?.system && typeof payloadData.system === 'object'
      ? (payloadData.system as { body?: unknown })
      : null;
    const payloadSystemBody = typeof payloadSystem?.body === 'string' ? payloadSystem.body.trim().toLowerCase() : '';

    if (subtype === 'ciphertext') return true;
    if (body === '[mensagem criptografada]') return true;
    if (body.includes('aguardando esta mensagem') || body.includes('waiting for this message')) return true;
    if (payloadSystemBody.includes('aguardando esta mensagem') || payloadSystemBody.includes('waiting for this message')) {
      return true;
    }

    return false;
  };

  const sanitizeTechnicalCiphertextPreview = (value: string | null | undefined) => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return '';

    if (normalized === '[mensagem criptografada]') return '';
    if (normalized.includes('aguardando esta mensagem')) return '';
    if (normalized.includes('waiting for this message')) return '';

    return value?.trim() || '';
  };

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

  const isStatusChat = (chat: Pick<WhatsAppChat, 'id' | 'is_group'> | null | undefined) => {
    if (!chat) return false;
    return getChatKind(chat) === 'status';
  };

  const isStatusMessage = (message: Pick<WhatsAppMessage, 'chat_id' | 'type'> | null | undefined) => {
    if (!message) return false;
    if (String(message.type || '').trim().toLowerCase() === 'story') return true;
    return getWhatsAppChatKind(message.chat_id || '') === 'status';
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
    const trimmed = chatId.trim();
    if (!trimmed) return '';
    if (getWhatsAppChatKind(trimmed) !== 'direct') return '';
    if (/@lid$/i.test(trimmed)) return '';
    if (!/@(?:s\.whatsapp\.net|c\.us)$/i.test(trimmed)) return '';
    return normalizePhoneNumber(trimmed);
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
      try {
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
      } catch (error) {
        console.warn('Error loading group names from /groups:', error);
      }

      const unresolvedGroupIds = Array.from(groupIds).filter((chatId) => !namesById.has(chatId));
      if (unresolvedGroupIds.length > 0) {
        const fallbackResults = await Promise.allSettled(
          unresolvedGroupIds.map(async (chatId) => {
            const metadata = await getWhatsAppChat(chatId);
            const name = metadata.name?.trim();
            return name && name !== chatId ? { id: chatId, name } : null;
          }),
        );

        fallbackResults.forEach((result) => {
          if (result.status !== 'fulfilled' || !result.value) return;
          namesById.set(result.value.id, result.value.name);
        });
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
  }, [chatMenu, isMobileView, selectedChat, showGroupInfo, showNewChatModal, leadsList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showAdvancedChatFilters) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!advancedChatFiltersRef.current?.contains(event.target as Node)) {
        setShowAdvancedChatFilters(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showAdvancedChatFilters]);

  useEffect(() => {
    if (!showChatSegmentsMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!chatSegmentsMenuRef.current?.contains(event.target as Node)) {
        setShowChatSegmentsMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showChatSegmentsMenu]);

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
          last_message: sanitizeTechnicalCiphertextPreview(row.last_message) || null,
          last_message_direction: null,
          unread_count: typeof row.unread_count === 'number' ? row.unread_count : undefined,
          archived: row.archived ?? false,
          mute_until: row.mute_until ?? null,
        };
        if (isStatusChat(incomingChat)) {
          setChats((prev) => prev.filter((chat) => chat.id !== incomingChat.id));
          setSelectedChat((current) => (current?.id === incomingChat.id ? null : current));
          return;
        }

        setChats((prev) => {
          const existingIndex = prev.findIndex((chat) => chat.id === incomingChat.id);
          if (existingIndex === -1) {
            const next = [
              {
                ...incomingChat,
                last_message: incomingChat.last_message ?? null,
                last_message_direction: incomingChat.last_message_direction ?? null,
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
            last_message_direction: existingChat.last_message_direction ?? incomingChat.last_message_direction ?? null,
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

        if (isStatusMessage(message)) {
          return;
        }

        if (eventType !== 'DELETE' && isTechnicalCiphertextMessage(message)) {
          const currentChat = selectedChatRef.current;
          if (currentChat && getChatIdVariants(currentChat).includes(message.chat_id)) {
            setMessages((prev) => prev.filter((item) => item.id !== message.id));
          }
          return;
        }

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
                next[targetIndex] = mergeMessageForDisplay(next[targetIndex], message);
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
              last_message_direction: preview ? message.direction ?? chat.last_message_direction ?? null : chat.last_message_direction ?? null,
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
    if (!selectedChat) {
      autoSyncSelectedChatInFlightRef.current = false;
      return;
    }

    const runAutoSync = async () => {
      const activeChat = selectedChatRef.current;
      if (!activeChat) return;
      if (getChatKind(activeChat) !== 'direct') return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (autoSyncSelectedChatInFlightRef.current || syncingChatId || isSyncingAllChats) return;

      autoSyncSelectedChatInFlightRef.current = true;
      try {
        const { error } = await supabase.functions.invoke('whatsapp-sync', {
          body: { chatId: activeChat.id, count: 120 },
        });

        if (error) {
          throw error;
        }

        if (selectedChatRef.current?.id === activeChat.id) {
          await loadMessages(activeChat, { silent: true });
          scheduleUnreadCountsRefresh(50);
        }
      } catch (error) {
        console.error('Error auto-syncing selected chat:', error);
      } finally {
        autoSyncSelectedChatInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void runAutoSync();
    }, 25000);

    return () => {
      window.clearInterval(intervalId);
      autoSyncSelectedChatInFlightRef.current = false;
    };
  }, [selectedChat?.id, syncingChatId, isSyncingAllChats]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .filter((incoming) => !isStatusChat(incoming))
      .map((incoming) => {
        const previous = previousById.get(incoming.id);
        return {
          ...incoming,
          last_message: sanitizeTechnicalCiphertextPreview(incoming.last_message ?? previous?.last_message ?? null) || null,
          last_message_direction: previous?.last_message_direction ?? null,
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
            last_message: null,
            last_message_direction: null,
            unread_count: chat.unread_count ?? 0,
            archived: chat.archived ?? false,
            mute_until: muteUntil,
          };
        });
      } else {
        incomingChats = (data as WhatsAppChat[]).map((chat) => ({
          ...chat,
          last_message: sanitizeTechnicalCiphertextPreview(chat.last_message) || null,
          last_message_direction: chat.last_message_direction ?? null,
        }));
      }

      incomingChats = incomingChats.filter((chat) => !isStatusChat(chat));

      if (activeChatsLoadIdRef.current !== currentLoadId) {
        return;
      }

      const mergedChats = mergeChatsWithCurrentState(incomingChats);
      setChats(mergedChats);
      setSelectedChat((current) => (isStatusChat(current) ? null : current));

      void refreshChatPreviewsFromMessages(mergedChats, currentLoadId);
      void loadUnreadCounts();
      void loadGroupNames(mergedChats);
      void loadNewsletterNames(mergedChats);
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

      const fetchedMessages = (data || []).filter(
        (item) => !isTechnicalCiphertextMessage(item as WhatsAppMessage),
      );
      const fetchedCount = fetchedMessages.length;
      const baseMessages = dedupeMessagesForDisplay(fetchedMessages as WhatsAppMessage[]);
      const latestPreview = getLatestMeaningfulPreview(baseMessages);
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

      if (latestPreview) {
        setChats((prev) => {
          const updated = prev.map((item) => {
            const variants = getChatIdVariants(item);
            if (!variants.includes(chat.id)) return item;

            const currentTime = item.last_message_at ? new Date(item.last_message_at).getTime() : 0;
            const incomingTime = latestPreview.timestamp ? new Date(latestPreview.timestamp).getTime() : 0;
            const shouldUpdateTime = incomingTime > 0 && (!currentTime || incomingTime >= currentTime);

            return {
              ...item,
              last_message: latestPreview.preview,
              last_message_direction: latestPreview.direction,
              last_message_at: shouldUpdateTime ? latestPreview.timestamp : item.last_message_at,
            };
          });

          return updated.sort(sortChatsByLatest);
        });
      }

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

      const olderMessages = dedupeMessagesForDisplay(
        ((data || []).filter((item) => !isTechnicalCiphertextMessage(item as WhatsAppMessage)) as WhatsAppMessage[]),
      );
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
        const preview = getMessagePreview(nextMessage);
        const updated = prev.map((chat) => {
          const variants = getChatIdVariants(chat);
          if (!variants.includes(message.chat_id)) return chat;
          return {
            ...chat,
            last_message: preview || chat.last_message,
            last_message_direction: preview ? nextMessage.direction ?? chat.last_message_direction ?? null : chat.last_message_direction ?? null,
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
    if (isTechnicalCiphertextMessage(message)) return null;

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

  const getLatestMeaningfulPreview = (items: WhatsAppMessage[]) => {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const candidate = items[index];
      const preview = getMessagePreview(candidate);
      if (!preview) continue;

      return {
        preview,
        timestamp: getMessageDisplayTimestamp(candidate),
        direction: candidate.direction ?? null,
      };
    }

    return null;
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

  const formatChatListPreview = (chat: Pick<WhatsAppChat, 'last_message' | 'last_message_direction' | 'is_group'>) => {
    const preview = sanitizeTechnicalCiphertextPreview(chat.last_message);
    if (!preview) return 'Sem mensagens';

    if (chat.last_message_direction === 'outbound') {
      return `Você: ${preview}`;
    }

    if (chat.last_message_direction === 'inbound') {
      return `${chat.is_group ? 'Pessoa' : 'Contato'}: ${preview}`;
    }

    return preview;
  };

  const refreshChatPreviewsFromMessages = async (sourceChats: WhatsAppChat[], currentLoadId?: number) => {
    const variantToBaseChatIds = new Map<string, string[]>();

    sourceChats.forEach((chat) => {
      getChatIdVariants(chat).forEach((variant) => {
        if (!variantToBaseChatIds.has(variant)) {
          variantToBaseChatIds.set(variant, []);
        }

        const matches = variantToBaseChatIds.get(variant);
        if (matches && !matches.includes(chat.id)) {
          matches.push(chat.id);
        }
      });
    });

    const variants = Array.from(variantToBaseChatIds.keys());
    if (variants.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, chat_id, body, type, has_media, payload, is_deleted, direction, timestamp, created_at')
        .in('chat_id', variants)
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(variants.length * 6, 300), 4000));

      if (error) throw error;
      if (currentLoadId && activeChatsLoadIdRef.current !== currentLoadId) return;

      const previewByChatId = new Map<
        string,
        { preview: string; direction: 'inbound' | 'outbound' | null; timestamp: string | null }
      >();

      ((data || []) as WhatsAppMessage[]).forEach((message) => {
        const preview = getMessagePreview(message);
        if (!preview) return;

        const matchingChatIds = variantToBaseChatIds.get(message.chat_id) || [];
        matchingChatIds.forEach((chatId) => {
          if (!previewByChatId.has(chatId)) {
            previewByChatId.set(chatId, {
              preview,
              direction: message.direction ?? null,
              timestamp: getMessageDisplayTimestamp(message),
            });
          }
        });
      });

      if (previewByChatId.size === 0) return;

      setChats((prev) => {
        const updated = prev.map((chat) => {
          const nextPreview = previewByChatId.get(chat.id);
          if (!nextPreview) return chat;

          const currentTime = chat.last_message_at ? new Date(chat.last_message_at).getTime() : 0;
          const incomingTime = nextPreview.timestamp ? new Date(nextPreview.timestamp).getTime() : 0;
          const shouldUpdateTime = incomingTime > 0 && (!currentTime || incomingTime >= currentTime);

          return {
            ...chat,
            last_message: nextPreview.preview,
            last_message_direction: nextPreview.direction,
            last_message_at: shouldUpdateTime ? nextPreview.timestamp : chat.last_message_at,
          };
        });

        return updated.sort(sortChatsByLatest);
      });
    } catch (error) {
      console.error('Erro ao recalcular previews dos chats:', error);
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

    const phone = normalizePhoneNumber(chat.phone_number || extractPhoneFromChatId(chat.id));
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

  const chatListPresentationById = useMemo(() => {
    const map = new Map<
      string,
      {
        displayName: string;
        kind: ReturnType<typeof getChatKind>;
        typeLabel: string | null;
        typeBadgeClass: string;
        leadStatus: string | null;
        leadResponsible: string | null;
        hasLeadMatch: boolean;
        photo: string | null;
      }
    >();

    chats.forEach((chat) => {
      const chatDisplayName = getChatDisplayName(chat);
      const chatKind = getChatKind(chat);
      const chatTypeLabel = getChatTypeLabel(chat);
      const matchedLead = getLeadMatchKeysForChat(chat)
        .map((key) => leadByPhoneMatchKey.get(key))
        .find(Boolean);
      const leadStatus = matchedLead?.status ?? null;
      const leadResponsible = matchedLead?.responsavel ?? null;

      const chatTypeBadgeClass = getChatTypeBadgeClass(chatKind);

      const chatPhoto = (() => {
        const variants = getChatIdVariants(chat);
        for (const variant of variants) {
          const photo = contactPhotosById.get(variant);
          if (photo) return photo;
        }
        return null;
      })();

      map.set(chat.id, {
        displayName: chatDisplayName,
        kind: chatKind,
        typeLabel: chatTypeLabel,
        typeBadgeClass: chatTypeBadgeClass,
        leadStatus,
        leadResponsible,
        hasLeadMatch: Boolean(matchedLead),
        photo: chatPhoto,
      });
    });

    return map;
  }, [chats, contactPhotosById, contactsById, groupNamesById, leadByPhoneMatchKey, leadNamesByPhone, newsletterNamesById]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatLeadStatusOptions = useMemo(() => {
    const options = new Set<string>();
    leadStatuses.forEach((status) => {
      if (status.nome?.trim()) {
        options.add(status.nome.trim());
      }
    });
    leadsList.forEach((lead) => {
      if (lead.status?.trim()) {
        options.add(lead.status.trim());
      }
    });
    return Array.from(options).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [leadStatuses, leadsList]);

  const chatLeadOwnerOptions = useMemo(() => {
    const options = new Set<string>();
    leadsList.forEach((lead) => {
      if (lead.responsavel?.trim()) {
        options.add(lead.responsavel.trim());
      }
    });
    return Array.from(options).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [leadsList]);

  const hasAdvancedChatFilters =
    chatLeadStatusFilter !== 'all' || chatLeadOwnerFilter !== 'all' || chatLeadPresenceFilter !== 'all';
  const hasSegmentFilters = chatOnlyUnread || chatKindFilters.length > 0;
  const activeSegmentFiltersLabel = [
    chatOnlyUnread ? 'Nao lidas' : null,
    ...chatKindFilters.map((filter) => {
      if (filter === 'direct') return 'Diretas';
      if (filter === 'groups') return 'Grupos';
      if (filter === 'channels') return 'Canais';
      return 'Transmissoes';
    }),
  ]
    .filter(Boolean)
    .join(' • ');
  const activeAdvancedChatFiltersCount = [
    chatLeadStatusFilter !== 'all',
    chatLeadOwnerFilter !== 'all',
    chatLeadPresenceFilter !== 'all',
  ].filter(Boolean).length;
  const activeAdvancedChatFiltersLabel = [
    chatLeadStatusFilter !== 'all'
      ? `Status: ${chatLeadStatusFilter === EMPTY_FILTER_VALUE ? 'Sem status' : chatLeadStatusFilter}`
      : null,
    chatLeadOwnerFilter !== 'all'
      ? `Responsavel: ${chatLeadOwnerFilter === EMPTY_FILTER_VALUE ? 'Sem responsavel' : chatLeadOwnerFilter}`
      : null,
    chatLeadPresenceFilter !== 'all'
      ? `CRM: ${chatLeadPresenceFilter === 'withLead' ? 'Com lead' : 'Sem lead'}`
      : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const {
    archivedCount,
    inboxCount,
    unreadInboxCount,
    groupInboxCount,
    directInboxCount,
    channelInboxCount,
    broadcastInboxCount,
    visibleChats,
    unreadQueue,
  } = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const workspaceChats = chats.filter((chat) => !isStatusChat(chat));
    const chatsMatchingSearch = workspaceChats.filter((chat) => {
      if (!normalizedSearchQuery) return true;

      const displayName = (chatListPresentationById.get(chat.id)?.displayName || chat.id).toLowerCase();
      const preview = sanitizeTechnicalCiphertextPreview(chat.last_message).toLowerCase();
      return (
        displayName.includes(normalizedSearchQuery) ||
        chat.id.toLowerCase().includes(normalizedSearchQuery) ||
        preview.includes(normalizedSearchQuery)
      );
    });

    const activeChats = chatsMatchingSearch.filter((chat) => !chat.archived);
    const archivedChats = chatsMatchingSearch.filter((chat) => chat.archived);
    const archivedCount = archivedChats.length;
    const baseChats = showArchived ? archivedChats : activeChats;

    let unreadInboxCount = 0;
    let groupInboxCount = 0;
    let directInboxCount = 0;
    let channelInboxCount = 0;
    let broadcastInboxCount = 0;

    baseChats.forEach((chat) => {
      const chatKind = chatListPresentationById.get(chat.id)?.kind ?? getChatKind(chat);

      if ((chat.unread_count ?? 0) > 0) unreadInboxCount += 1;
      if (chatKind === 'group') groupInboxCount += 1;
      if (chatKind === 'direct') directInboxCount += 1;
      if (chatKind === 'newsletter') channelInboxCount += 1;
      if (chatKind === 'broadcast') broadcastInboxCount += 1;
    });

    const filteredVisibleChats = baseChats.filter((chat) => {
      const chatPresentation = chatListPresentationById.get(chat.id);
      const chatKind = chatPresentation?.kind ?? getChatKind(chat);
      const chatLeadStatus = chatPresentation?.leadStatus ?? null;
      const chatLeadResponsible = chatPresentation?.leadResponsible ?? null;
      const hasLeadMatch = chatPresentation?.hasLeadMatch ?? false;

      if (chatOnlyUnread && (chat.unread_count ?? 0) <= 0) return false;

      if (chatKindFilters.length > 0) {
        const matchesKind =
          (chatKindFilters.includes('groups') && chatKind === 'group') ||
          (chatKindFilters.includes('direct') && chatKind === 'direct') ||
          (chatKindFilters.includes('channels') && chatKind === 'newsletter') ||
          (chatKindFilters.includes('broadcasts') && chatKind === 'broadcast');

        if (!matchesKind) return false;
      }

      if (chatLeadPresenceFilter === 'withLead' && !hasLeadMatch) return false;
      if (chatLeadPresenceFilter === 'withoutLead' && hasLeadMatch) return false;

      if (chatLeadStatusFilter !== 'all') {
        if (chatLeadStatusFilter === EMPTY_FILTER_VALUE) {
          if (chatLeadStatus) return false;
        } else if (chatLeadStatus !== chatLeadStatusFilter) {
          return false;
        }
      }

      if (chatLeadOwnerFilter !== 'all') {
        if (chatLeadOwnerFilter === EMPTY_FILTER_VALUE) {
          if (chatLeadResponsible) return false;
        } else if (chatLeadResponsible !== chatLeadOwnerFilter) {
          return false;
        }
      }

      return true;
    });

    const visibleChats = [...filteredVisibleChats].sort((left, right) => {
      if (prioritizeUnread) {
        const leftUnread = left.unread_count ?? 0;
        const rightUnread = right.unread_count ?? 0;
        if (leftUnread !== rightUnread) {
          return rightUnread - leftUnread;
        }
      }

      return sortChatsByLatest(left, right);
    });

    const unreadQueue = visibleChats.filter((chat) => (chat.unread_count ?? 0) > 0);

    return {
      archivedCount,
      inboxCount: baseChats.length,
      unreadInboxCount,
      groupInboxCount,
      directInboxCount,
      channelInboxCount,
      broadcastInboxCount,
      visibleChats,
      unreadQueue,
    };
  }, [
    chatKindFilters,
    chatLeadOwnerFilter,
    chatLeadPresenceFilter,
    chatLeadStatusFilter,
    chatOnlyUnread,
    chatListPresentationById,
    chats,
    prioritizeUnread,
    searchQuery,
    showArchived,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextUnreadChat = useMemo(
    () => unreadQueue.find((chat) => chat.id !== selectedChat?.id) ?? unreadQueue[0] ?? null,
    [unreadQueue, selectedChat?.id],
  );
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
    () =>
      messages.filter(
        (message) =>
          !isReactionOnlyMessage(message) &&
          !isEditActionMessage(message) &&
          !isTechnicalCiphertextMessage(message),
      ),
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
        if (isTechnicalCiphertextMessage(message)) return false;
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
        className: 'comm-badge-neutral',
      };
    }

    if (firstResponseSla.kind === 'replied') {
      if (firstResponseSla.minutes <= 5) {
        return {
          label: `SLA 1a resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
          className: 'comm-badge-success',
        };
      }
      if (firstResponseSla.minutes <= 15) {
        return {
          label: `SLA 1a resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
          className: 'comm-badge-warning',
        };
      }
      return {
        label: `SLA 1a resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
        className: 'comm-badge-neutral',
      };
    }

    if (firstResponseSla.minutes <= 5) {
      return {
        label: `Aguardando resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
        className: 'comm-badge-success',
      };
    }
    if (firstResponseSla.minutes <= 15) {
      return {
        label: `Aguardando resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
        className: 'comm-badge-warning',
      };
    }
    return {
      label: `Aguardando resposta: ${formatMinutesDuration(firstResponseSla.minutes)}`,
      className: 'comm-badge-danger',
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
    const queryDigits = query.replace(/\D/g, '');

    const source = contactsList
      .filter((contact) => {
        const normalizedId = normalizeChatId(contact.id || '');
        return getWhatsAppChatKind(normalizedId || contact.id || '') === 'direct';
      })
      .sort((left, right) => {
        if (left.saved !== right.saved) {
          return left.saved ? -1 : 1;
        }

        return (left.name || left.id).localeCompare(right.name || right.id, 'pt-BR', { sensitivity: 'base' });
      });

    if (!query) return source;

    return source.filter((contact) => {
      const searchable = `${contact.name || ''} ${contact.pushname || ''} ${contact.id || ''}`.toLowerCase();
      if (searchable.includes(query)) return true;

      if (queryDigits.length >= 3) {
        return getPhoneDigits(contact.id).includes(queryDigits);
      }

      return false;
    });
  }, [contactsList, newChatSearch]);

  const templateVariablesForInput = useMemo(() => {
    const fullName = (selectedLead?.name || selectedChatDisplayName || '').trim();
    const firstName = fullName.split(/\s+/).filter(Boolean)[0] || '';
    const rawPhone = selectedChat && isDirectChat(selectedChat)
      ? normalizePhoneNumber(selectedLead?.phone || selectedChat.phone_number || extractPhoneFromChatId(selectedChat.id))
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
  const isSelectedStatusChat = selectedChatKind === 'status';
  const selectedChatTypeLabel = selectedChat ? getChatTypeLabel(selectedChat) : null;
  const selectedChatTypeBadgeClass = getChatTypeBadgeClass(selectedChatKind);
  const selectedChatIsDirect = selectedChat ? isDirectChat(selectedChat) : false;
  const selectedChatPeerPhoneFromMessages = useMemo(() => {
    if (!selectedChat || !selectedChatIsDirect) return '';

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      const peerRaw =
        message.direction === 'inbound'
          ? message.from_number
          : message.direction === 'outbound'
            ? message.to_number
            : null;
      if (!peerRaw || /@lid$/i.test(peerRaw)) continue;

      const normalized = normalizePhoneNumber(peerRaw);
      if (normalized) return normalized;
    }

    return '';
  }, [messages, selectedChat, selectedChatIsDirect]);
  const selectedChatPhone = (() => {
    if (!selectedChat || !selectedChatIsDirect) return '';

    const candidates = [
      selectedLead?.phone || '',
      selectedChatPeerPhoneFromMessages,
      /@lid$/i.test(selectedChat.id) ? '' : selectedChat.phone_number || '',
      extractPhoneFromChatId(selectedChat.id),
    ];

    for (const candidate of candidates) {
      const normalized = normalizePhoneNumber(candidate);
      if (normalized) return normalized;
    }

    return '';
  })();
  const selectedChatPhoneFormatted = selectedChatPhone ? formatPhone(selectedChatPhone) : '';
  const buildConversationHistoryForCopy = (items: WhatsAppMessage[]) => {
    if (!selectedChat || items.length === 0) return '';

    const exportedLines = [...items]
      .sort(sortMessagesChronologically)
      .map((message) => {
        const preview = formatWhatsAppAudioTranscriptionLabel(message.payload) || getMessagePreview(message);
        if (!preview) return null;

        const eventTime = getMessageDisplayTimestamp(message);
        const parsed = new Date(eventTime || '');
        if (!eventTime) return null;
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

    return exportedLines.join('\n');
  };
  const selectedChatConversationHistory = useMemo(() => {
    return buildConversationHistoryForCopy(messages);
  }, [messages, selectedChat, selectedChatDisplayName, selectedChatKind]); // eslint-disable-line react-hooks/exhaustive-deps
  const followUpContextForInput = useMemo(() => {
    if (!selectedChat || !selectedChatIsDirect) return null;

    const leadName =
      (selectedLead?.name || selectedChatDisplayName || selectedChatPhoneFormatted || selectedChat.id || '').trim();

    return {
      leadName,
      conversationHistory: selectedChatConversationHistory,
      leadContext: {
        leadId: selectedLead?.id ?? null,
        leadStatus: selectedLead?.status ?? null,
        responsavel: selectedLead?.responsavel ?? null,
        phone: selectedChatPhone || selectedLead?.phone || null,
        chatId: selectedChat.id,
        chatName: selectedChatDisplayName || null,
      },
    };
  }, [
    selectedChat,
    selectedChatConversationHistory,
    selectedChatDisplayName,
    selectedChatIsDirect,
    selectedChatPhone,
    selectedChatPhoneFormatted,
    selectedLead,
  ]);
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
          className: 'comm-badge-neutral',
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

  const handleAudioTranscriptionSaved = (messageId: string, nextPayload: WhatsAppMessagePayload) => {
    setMessages((prev) => {
      const nextMessages = prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              payload: nextPayload,
            }
          : message,
      );

      if (selectedChat) {
        const cachedState = messagesCacheRef.current.get(selectedChat.id);
        if (cachedState) {
          messagesCacheRef.current.set(selectedChat.id, {
            ...cachedState,
            messages: nextMessages,
          });
        }
      }

      return nextMessages;
    });
  };

  const handleCopyFullChat = async () => {
    if (!selectedChat || messages.length === 0 || isCopyingChat) return;

    try {
      setIsCopyingChat(true);

      const audioMessagesWithoutTranscription = messages.filter((message) => {
        const normalizedType = (message.type || '').toLowerCase();
        if (!['audio', 'voice', 'ptt'].includes(normalizedType)) return false;
        return !formatWhatsAppAudioTranscriptionLabel(message.payload);
      });

      let messagesForCopy = messages;

      if (audioMessagesWithoutTranscription.length > 0) {
        const payloadsByMessageId = new Map<string, WhatsAppMessagePayload>();

        for (const message of audioMessagesWithoutTranscription) {
          try {
            const { data, error } = await supabase.functions.invoke('transcribe-whatsapp-audio', {
              body: { messageId: message.id },
            });

            if (error) {
              throw error;
            }

            if (data?.payload && typeof data.payload === 'object') {
              payloadsByMessageId.set(message.id, data.payload as WhatsAppMessagePayload);
            }
          } catch (error) {
            console.error(`Erro ao transcrever audio ${message.id} para copia do chat:`, error);
          }
        }

        if (payloadsByMessageId.size > 0) {
          messagesForCopy = messages.map((message) =>
            payloadsByMessageId.has(message.id)
              ? {
                  ...message,
                  payload: payloadsByMessageId.get(message.id) ?? message.payload,
                }
              : message,
          );

          setMessages((prev) => {
            const nextMessages = prev.map((message) =>
              payloadsByMessageId.has(message.id)
                ? {
                    ...message,
                    payload: payloadsByMessageId.get(message.id) ?? message.payload,
                  }
                : message,
            );

            const cachedState = messagesCacheRef.current.get(selectedChat.id);
            if (cachedState) {
              messagesCacheRef.current.set(selectedChat.id, {
                ...cachedState,
                messages: nextMessages,
              });
            }

            return nextMessages;
          });
        }
      }

      const conversationHistory = buildConversationHistoryForCopy(messagesForCopy);
      if (!conversationHistory) return;

      await navigator.clipboard.writeText(conversationHistory);
      setChatCopiedAt(Date.now());
      window.setTimeout(() => {
        setChatCopiedAt(null);
      }, 1600);
    } catch (error) {
      console.error('Erro ao copiar chat:', error);
    } finally {
      setIsCopyingChat(false);
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
      last_message: null,
      unread_count: 0,
    };

    startTransition(() => {
      setChats((prev) => {
        if (prev.some((chat) => chat.id === chatId)) return prev;
        return [nextChat, ...prev];
      });
      setSelectedChat(nextChat);
      setChatOnlyUnread(false);
      setChatKindFilters([]);
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
    return { label: 'Alta', className: 'comm-badge-danger' };
  }

  if (normalized === 'baixa' || normalized === 'low') {
    return { label: 'Baixa', className: 'comm-badge-success' };
  }

  return { label: 'Normal', className: 'comm-badge-info' };
};

const getReminderTypeMeta = (type?: string | null) => {
  const normalized = (type || '').trim().toLowerCase();

  if (normalized === 'retorno') {
    return { label: 'Retorno', className: 'comm-badge-warning' };
  }

  if (normalized === 'follow-up' || normalized === 'follow up' || normalized === 'followup') {
    return { label: 'Follow-up', className: 'comm-badge-info' };
  }

  return {
    label: type?.trim() || 'Outro',
    className: 'comm-badge-neutral',
  };
};

const getChatAvatarClass = (kind?: string | null) => {
  const normalized = (kind || 'direct').trim().toLowerCase();

  if (normalized === 'group') return 'comm-icon-chip-info';
  if (normalized === 'newsletter') return 'comm-icon-chip-brand';
  if (normalized === 'status' || normalized === 'broadcast') return 'comm-icon-chip-warning';
  return 'comm-icon-chip-brand';
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
        .select('id, lead_id, contract_id, titulo, tipo, prioridade, descricao, data_lembrete, lido')
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
          descricao?: string | null;
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
            contractId: reminder.contract_id ?? null,
            description: reminder.descricao ?? null,
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

  const markReminderQuickOpenItemAsRead = async (
    item: ReminderQuickOpenItem,
    options?: { syncLeadNextReturn?: boolean },
  ) => {
    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('reminders')
      .update({ lido: true, concluido_em: completedAt })
      .eq('id', item.id);

    if (updateError) throw updateError;

    if (options?.syncLeadNextReturn !== false) {
      await syncLeadNextReturnFromUpcomingReminder(item.leadId);
    }

    setReminderQuickOpenItems((current) =>
      current.filter((reminderItem) => reminderItem.id !== item.id),
    );
  };

  const handleMarkReminderAsRead = async (item: ReminderQuickOpenItem) => {
    if (markingReminderReadId === item.id) return;

    setMarkingReminderReadId(item.id);

    try {
      await markReminderQuickOpenItemAsRead(item);
    } catch (error) {
      console.error('Erro ao marcar lembrete como lido no WhatsApp:', error);
      alert('NÃ£o foi possÃ­vel marcar este lembrete como lido.');
    } finally {
      setMarkingReminderReadId((current) => (current === item.id ? null : current));
    }
  };

  const handleQuickScheduleReminder = async (item: ReminderQuickOpenItem, daysAhead: 1 | 2 | 3) => {
    if (quickSchedulingReminderAction?.reminderId === item.id) return;

    setQuickSchedulingReminderAction({ reminderId: item.id, daysAhead });

    try {
      await markReminderQuickOpenItemAsRead(item, { syncLeadNextReturn: false });

      const nextReminderDateISO = addBusinessDaysSkippingWeekends(item.dueAt, daysAhead).toISOString();
      const { data: createdReminder, error: insertError } = await supabase
        .from('reminders')
        .insert([
          {
            lead_id: item.leadId,
            contract_id: item.contractId ?? undefined,
            titulo: item.title,
            descricao: item.description ?? null,
            tipo: item.type,
            prioridade: item.priority,
            data_lembrete: nextReminderDateISO,
            lido: false,
          },
        ])
        .select('id, contract_id, titulo, descricao, tipo, prioridade, data_lembrete')
        .maybeSingle();

      if (insertError) throw insertError;

      await syncLeadNextReturnFromUpcomingReminder(item.leadId);

      if (createdReminder?.id) {
        const nextItem: ReminderQuickOpenItem = {
          id: createdReminder.id,
          title: createdReminder.titulo?.trim() || item.title,
          type: createdReminder.tipo?.trim() || item.type,
          priority: createdReminder.prioridade?.trim() || item.priority,
          contractId: createdReminder.contract_id ?? item.contractId ?? null,
          description: createdReminder.descricao ?? item.description ?? null,
          dueAt: createdReminder.data_lembrete,
          leadId: item.leadId,
          leadName: item.leadName,
          leadPhone: item.leadPhone,
          leadStatus: item.leadStatus ?? null,
        };

        setReminderQuickOpenItems((current) =>
          [...current, nextItem].sort(compareReminderQuickOpenItems),
        );
      }
    } catch (error) {
      console.error('Erro ao criar lembrete rÃ¡pido no WhatsApp:', error);
      alert('NÃ£o foi possÃ­vel criar o novo lembrete rÃ¡pido.');
      void loadReminderQuickOpen({ preserveExistingItems: true });
    } finally {
      setQuickSchedulingReminderAction((current) => (current?.reminderId === item.id ? null : current));
    }
  };

  const handleMarkReminderAsReadAndSchedule = async (item: ReminderQuickOpenItem) => {
    if (markingReminderReadId === item.id) return;

    setMarkingReminderReadId(item.id);

    try {
      await markReminderQuickOpenItemAsRead(item);

      const leadForScheduler = await resolveReminderLeadForScheduling(item);
      if (!leadForScheduler) {
        alert('Lembrete marcado como lido, mas não foi possível abrir o agendamento do próximo contato.');
        return;
      }

      openReminderScheduler(
        leadForScheduler,
        'Lembrete marcado como lido. Deseja agendar o próximo contato?',
        {
          defaultTitle: item.title,
          defaultDescription: item.description ?? undefined,
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
  void handleMarkReminderAsReadAndSchedule;

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
  const groupedReminderQuickOpenItems = useMemo(
    () => groupReminderQuickOpenItems(reminderQuickOpenItems),
    [reminderQuickOpenItems],
  );
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
        className="panel-page-shell flex h-full min-h-0 overflow-hidden bg-slate-50"
        onClick={() => {
          closeMuteSubmenuNow();
          setChatMenu(null);
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
              <Button
                onClick={() => setNewChatTab('leads')}
                variant={newChatTab === 'leads' ? 'warning' : 'secondary'}
                size="sm"
                className="h-auto rounded-full px-3 py-1 text-xs"
              >
                Leads
              </Button>
              <Button
                onClick={() => setNewChatTab('contacts')}
                variant={newChatTab === 'contacts' ? 'warning' : 'secondary'}
                size="sm"
                className="h-auto rounded-full px-3 py-1 text-xs"
              >
                Contatos
              </Button>
              <Button
                onClick={() => setNewChatTab('manual')}
                variant={newChatTab === 'manual' ? 'warning' : 'secondary'}
                size="sm"
                className="h-auto rounded-full px-3 py-1 text-xs"
              >
                Numero
              </Button>
            </div>
            <div className="pt-3">
              {(newChatTab === 'leads' || newChatTab === 'contacts') && (
                <div className="mb-3">
                  <Input
                    type="text"
                    leftIcon={Search}
                    placeholder={newChatTab === 'leads' ? 'Buscar lead...' : 'Buscar contato...'}
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                  />
                </div>
              )}

              {newChatTab === 'leads' && (
                <div className="max-h-72 overflow-y-auto border rounded-lg">
                  {filteredLeads.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">Nenhum lead encontrado.</div>
                  ) : (
                    filteredLeads.map((lead, index) => (
                      <Button
                        key={`${lead.phone}-${index}`}
                        variant="ghost"
                        size="sm"
                        fullWidth
                        className="h-auto justify-start rounded-none border-b border-slate-200 px-3 py-2 text-left font-normal shadow-none hover:bg-slate-50 hover:text-slate-900 last:border-b-0"
                        onClick={() => openChatFromPhone(lead.phone, lead.name)}
                      >
                        <div className="flex flex-col items-start text-left">
                          <div className="text-sm font-medium text-slate-800">{lead.name}</div>
                          <div className="text-xs text-slate-500">{formatPhone(lead.phone)}</div>
                        </div>
                      </Button>
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
                      <Button
                        key={contact.id}
                        variant="ghost"
                        size="sm"
                        fullWidth
                        className="h-auto justify-start rounded-none border-b border-slate-200 px-3 py-2 text-left font-normal shadow-none hover:bg-slate-50 hover:text-slate-900 last:border-b-0"
                        onClick={() => openChatFromPhone(contact.id, contact.name || contact.id)}
                      >
                        <div className="flex flex-col items-start text-left">
                          <div className="text-sm font-medium text-slate-800">{contact.name || contact.id}</div>
                          <div className="text-xs text-slate-500">{formatPhone(contact.id)}</div>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              )}

              {newChatTab === 'manual' && (
                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="DDD + telefone"
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                  />
                  <Button
                    fullWidth
                    onClick={() => openChatFromPhone(newChatPhone)}
                  >
                    Iniciar conversa
                  </Button>
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
            <div className="comm-card comm-card-brand p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="comm-title text-sm font-semibold">Abertura rapida de conversas</p>
                  <p className="comm-text mt-1 text-xs">
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
                <span className="comm-badge comm-badge-neutral">
                  {reminderQuickOpenItems.length} pendente(s)
                </span>
                <span className="comm-badge comm-badge-danger">
                  {overdueReminderQuickOpenCount} atrasado(s)
                </span>
              </div>
            </div>

            {(isLoadingReminderQuickOpen || !hasLoadedReminderQuickOpen) &&
            reminderQuickOpenItems.length === 0 &&
            !reminderQuickOpenError ? (
              <div className="comm-card px-3 py-4 text-sm comm-text">
                Carregando lembretes...
              </div>
            ) : reminderQuickOpenError ? (
              <div className="comm-card comm-card-danger px-3 py-4 text-sm">
                {reminderQuickOpenError}
              </div>
            ) : reminderQuickOpenItems.length === 0 ? (
              <div className="comm-card px-3 py-4 text-sm comm-text">
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
                      <div className="comm-accordion-header sticky top-0 z-[1] flex items-center justify-between px-3 py-2">
                        <p className={`text-xs font-semibold uppercase tracking-wide ${period.accentClassName}`}>
                          {period.label}
                        </p>
                        <Button
                          onClick={() => toggleReminderQuickOpenPeriod(period.id)}
                          variant="secondary"
                          size="sm"
                          className="comm-accordion-toggle h-auto px-2 py-0.5 text-[11px] shadow-none"
                          title={isCollapsed ? 'Expandir seção' : 'Minimizar seção'}
                          aria-label={isCollapsed ? `Expandir ${period.label}` : `Minimizar ${period.label}`}
                        >
                          <span>{periodItems.length}</span>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        </Button>
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
                          const isQuickSchedulingCurrentReminder = quickSchedulingReminderAction?.reminderId === item.id;
                          const isBusyWithAnotherReminder = Boolean(
                            (markingReminderReadId && markingReminderReadId !== item.id) ||
                            (quickSchedulingReminderAction && quickSchedulingReminderAction.reminderId !== item.id) ||
                            markingLostLeadId,
                          );

                          return (
                            <div key={item.id} className="panel-interactive-glass rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="comm-title truncate text-sm font-semibold">{item.leadName}</p>
                                    {leadStatusStyles && item.leadStatus && (
                                      <span className="rounded-full border px-2 py-0.5 text-[10px]" style={leadStatusStyles}>
                                        {item.leadStatus}
                                      </span>
                                    )}
                                    <span className={`comm-badge text-[10px] ${typeMeta.className}`}>
                                      {typeMeta.label}
                                    </span>
                                    <span className={`comm-badge text-[10px] ${priorityMeta.className}`}>
                                      {priorityMeta.label}
                                    </span>
                                    {isOverdue && (
                                      <span className="comm-badge comm-badge-danger text-[10px]">
                                        Atrasado
                                      </span>
                                    )}
                                  </div>
                                  <p className="comm-text mt-1 truncate text-xs">{item.title}</p>
                                  <p className="comm-muted mt-2 text-[11px]">
                                    {item.leadPhone ? `${formatPhone(item.leadPhone)} • ` : ''}
                                    {formatReminderDueAt(item.dueAt)}
                                  </p>
                                </div>

                                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      void handleMarkReminderAsRead(item);
                                    }}
                                    loading={markingReminderReadId === item.id}
                                    disabled={isBusyWithAnotherReminder || isQuickSchedulingCurrentReminder}
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
                                    onClick={() => {
                                      void handleQuickScheduleReminder(item, 1);
                                    }}
                                    disabled={isBusyWithAnotherReminder || Boolean(markingReminderReadId) || isQuickSchedulingCurrentReminder}
                                    variant="secondary"
                                    size="icon"
                                    className="relative h-9 w-9 border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700"
                                    title="Marcar como lido e reagendar para 1 dia util"
                                    aria-label="Marcar como lido e reagendar para 1 dia util"
                                  >
                                    {isQuickSchedulingCurrentReminder && quickSchedulingReminderAction?.daysAhead === 1 ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CalendarPlus className="h-4 w-4" />
                                        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-emerald-700 ring-1 ring-emerald-200">
                                          1
                                        </span>
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      void handleQuickScheduleReminder(item, 2);
                                    }}
                                    disabled={isBusyWithAnotherReminder || Boolean(markingReminderReadId) || isQuickSchedulingCurrentReminder}
                                    variant="secondary"
                                    size="icon"
                                    className="relative h-9 w-9 border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700"
                                    title="Marcar como lido e reagendar para 2 dias uteis"
                                    aria-label="Marcar como lido e reagendar para 2 dias uteis"
                                  >
                                    {isQuickSchedulingCurrentReminder && quickSchedulingReminderAction?.daysAhead === 2 ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CalendarPlus className="h-4 w-4" />
                                        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-emerald-700 ring-1 ring-emerald-200">
                                          2
                                        </span>
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      void handleQuickScheduleReminder(item, 3);
                                    }}
                                    disabled={isBusyWithAnotherReminder || Boolean(markingReminderReadId) || isQuickSchedulingCurrentReminder}
                                    variant="secondary"
                                    size="icon"
                                    className="relative h-9 w-9 border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700"
                                    title="Marcar como lido e reagendar para 3 dias uteis"
                                    aria-label="Marcar como lido e reagendar para 3 dias uteis"
                                  >
                                    {isQuickSchedulingCurrentReminder && quickSchedulingReminderAction?.daysAhead === 3 ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CalendarPlus className="h-4 w-4" />
                                        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-emerald-700 ring-1 ring-emerald-200">
                                          3
                                        </span>
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => openReminderLeadInWhatsApp(item)}
                                    disabled={!item.leadPhone || Boolean(markingReminderReadId || quickSchedulingReminderAction || markingLostLeadId)}
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
                                    disabled={Boolean(
                                      (markingLostLeadId && markingLostLeadId !== item.leadId) ||
                                      markingReminderReadId ||
                                      quickSchedulingReminderAction,
                                    )}
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
                {showArchived && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    Arquivados
                  </span>
                )}
              </div>
              <div className="relative flex items-center gap-2">
                <Button
                  variant="primary"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    setShowNewChatModal(true);
                    setNewChatTab('leads');
                    if (leadsList.length === 0) {
                      void loadLeadNames();
                    }
                  }}
                  title="Novo chat"
                  aria-label="Novo chat"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="relative h-9 w-9"
                  onClick={handleOpenRemindersModal}
                  title="Lembretes"
                  aria-label="Lembretes"
                >
                  <Bell className="h-4 w-4" />
                  {reminderQuickOpenItems.length > 0 && (
                    <span className="comm-badge comm-badge-warning absolute -right-1 -top-1 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                      {reminderQuickOpenItems.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant={showArchived ? 'warning' : 'secondary'}
                  size="icon"
                  className="relative h-9 w-9"
                  onClick={() => setShowArchived((prev) => !prev)}
                  title={showArchived ? 'Ver conversas ativas' : 'Ver conversas arquivadas'}
                  aria-label={showArchived ? 'Ver conversas ativas' : 'Ver conversas arquivadas'}
                >
                  {showArchived ? <Inbox className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {!showArchived && archivedCount > 0 && (
                    <span className="comm-badge comm-badge-warning absolute -right-1 -top-1 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                      {archivedCount}
                    </span>
                  )}
                </Button>
                <Button
                  title="Configuracoes do WhatsApp"
                  aria-label="Configuracoes do WhatsApp"
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/painel/whatsapp/config');
                  }}
                >
                  <Settings className={`h-4 w-4 ${isSyncingAllChats ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <Input
              ref={searchInputRef}
              type="text"
              leftIcon={Search}
              placeholder="Pesquisar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div ref={chatSegmentsMenuRef} className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={showChatSegmentsMenu || hasSegmentFilters ? 'warning' : 'secondary'}
                  size="sm"
                  className="h-auto rounded-full px-3 py-1.5 text-xs"
                  onClick={() => setShowChatSegmentsMenu((current) => !current)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Segmentos
                  {hasSegmentFilters && (
                    <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] leading-none">
                      {(chatOnlyUnread ? 1 : 0) + chatKindFilters.length}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showChatSegmentsMenu ? 'rotate-180' : ''}`} />
                </Button>
                <span className="text-[11px] text-slate-500">
                  {hasSegmentFilters ? activeSegmentFiltersLabel : `Todas (${inboxCount})`}
                </span>
              </div>
              {showChatSegmentsMenu && (
                <div className="absolute left-0 top-full z-20 mt-2 w-full max-w-sm rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      !hasSegmentFilters
                        ? 'bg-[var(--panel-surface-soft,#f8f2ea)] text-slate-900'
                        : 'text-slate-700 hover:bg-[var(--panel-surface-soft,#f8f2ea)]'
                    }`}
                    onClick={() => {
                      setChatOnlyUnread(false);
                      setChatKindFilters([]);
                      setShowChatSegmentsMenu(false);
                    }}
                  >
                    <span>Todas</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {inboxCount}
                      {!hasSegmentFilters && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                  {[
                    { id: 'unread', label: 'Nao lidas', count: unreadInboxCount },
                    { id: 'direct', label: 'Diretas', count: directInboxCount },
                    { id: 'groups', label: 'Grupos', count: groupInboxCount },
                    { id: 'channels', label: 'Canais', count: channelInboxCount },
                    { id: 'broadcasts', label: 'Transmissoes', count: broadcastInboxCount },
                  ].map((item) => {
                    const checked = item.id === 'unread' ? chatOnlyUnread : chatKindFilters.includes(item.id as ChatKindFilter);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                          checked
                            ? 'bg-[var(--panel-surface-soft,#f8f2ea)] text-slate-900'
                            : 'text-slate-700 hover:bg-[var(--panel-surface-soft,#f8f2ea)]'
                        }`}
                        onClick={() => {
                          if (item.id === 'unread') {
                            setChatOnlyUnread((current) => !current);
                            return;
                          }

                          const nextId = item.id as ChatKindFilter;
                          setChatKindFilters((current) =>
                            current.includes(nextId) ? current.filter((value) => value !== nextId) : [...current, nextId],
                          );
                        }}
                      >
                        <span>{item.label}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {item.count}
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              checked
                                ? 'border-amber-500 bg-amber-100 text-amber-700'
                                : 'border-[var(--panel-border-subtle,#d8c5ae)] bg-white text-transparent'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div ref={advancedChatFiltersRef} className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={showAdvancedChatFilters || hasAdvancedChatFilters ? 'warning' : 'secondary'}
                  size="sm"
                  className="h-auto rounded-full px-3 py-1.5 text-xs"
                  onClick={() => setShowAdvancedChatFilters((current: boolean) => !current)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros CRM
                  {hasAdvancedChatFilters && (
                    <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] leading-none">
                      {activeAdvancedChatFiltersCount}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvancedChatFilters ? 'rotate-180' : ''}`} />
                </Button>
                <span className="text-[11px] text-slate-500">
                  {hasAdvancedChatFilters ? activeAdvancedChatFiltersLabel : `${visibleChats.length} resultado(s)`}
                </span>
                {hasAdvancedChatFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto rounded-full px-2.5 py-1 text-xs"
                    onClick={() => {
                      setChatLeadStatusFilter('all');
                      setChatLeadOwnerFilter('all');
                      setChatLeadPresenceFilter('all');
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                )}
              </div>
              {showAdvancedChatFilters && (
                <div className="absolute left-0 top-full z-20 mt-2 w-full max-w-2xl rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-3 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Segmentacao CRM</p>
                      <p className="text-[11px] text-slate-500">Combine status, responsavel e vinculo sem poluir a inbox.</p>
                    </div>
                    {hasAdvancedChatFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto rounded-full px-2.5 py-1 text-xs"
                        onClick={() => {
                          setChatLeadStatusFilter('all');
                          setChatLeadOwnerFilter('all');
                          setChatLeadPresenceFilter('all');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status CRM</span>
                      <select
                        value={chatLeadStatusFilter}
                        onChange={(event) => setChatLeadStatusFilter(event.target.value)}
                        className="h-10 rounded-xl border border-[var(--panel-border-subtle,#d8c5ae)] bg-white/90 px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="all">Todos os status</option>
                        <option value={EMPTY_FILTER_VALUE}>Sem status</option>
                        {chatLeadStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Responsavel</span>
                      <select
                        value={chatLeadOwnerFilter}
                        onChange={(event) => setChatLeadOwnerFilter(event.target.value)}
                        className="h-10 rounded-xl border border-[var(--panel-border-subtle,#d8c5ae)] bg-white/90 px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="all">Todos os responsaveis</option>
                        <option value={EMPTY_FILTER_VALUE}>Sem responsavel</option>
                        {chatLeadOwnerOptions.map((owner) => (
                          <option key={owner} value={owner}>
                            {owner}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Vinculo CRM</span>
                      <select
                        value={chatLeadPresenceFilter}
                        onChange={(event) => setChatLeadPresenceFilter(event.target.value as ChatLeadPresenceFilter)}
                        className="h-10 rounded-xl border border-[var(--panel-border-subtle,#d8c5ae)] bg-white/90 px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="all">Todos</option>
                        <option value="withLead">Com lead vinculado</option>
                        <option value="withoutLead">Sem lead vinculado</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <Button
                variant="secondary"
                size="sm"
                className="h-auto rounded-full px-2.5 py-1 text-xs"
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
              </Button>
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
                const chatPresentation = chatListPresentationById.get(chat.id);
                const chatDisplayName = chatPresentation?.displayName || getChatDisplayName(chat);
                const chatKind = chatPresentation?.kind ?? getChatKind(chat);
                const chatTypeLabel = chatPresentation?.typeLabel ?? getChatTypeLabel(chat);
                const leadStatus = chatPresentation?.leadStatus ?? null;
                const statusConfig = leadStatus ? statusByName.get(leadStatus) : null;
                const badgeStyles = statusConfig ? getLeadStatusBadgeStyle(statusConfig.cor || '#94a3b8') : null;
                const chatTypeBadgeClass = chatPresentation?.typeBadgeClass ?? getChatTypeBadgeClass(chatKind);
                const chatPhoto = chatPresentation?.photo ?? null;

                const muted = isChatMuted(chat);
                const unreadWaitingLabel = getUnreadWaitingLabel(chat);

                return (
                  <Button
                    key={chat.id}
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => selectChat(chat)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openChatContextMenu(chat.id, event.clientX, event.clientY);
                    }}
                    className={`h-auto justify-start rounded-none border-b border-[var(--panel-border-subtle,#e7dac8)] p-4 text-left font-normal shadow-none transition-colors hover:bg-[var(--panel-surface-soft,#f4ede3)] hover:text-[var(--panel-text,#1a120d)] ${
                      selectedChat?.id === chat.id ? 'bg-[var(--panel-surface-muted,#f7f0e7)]' : ''
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {chatPhoto && isDirectChat(chat) ? (
                        <div className="comm-avatar-shell h-12 w-12">
                          <img
                            src={chatPhoto}
                            alt={chatDisplayName}
                            className="comm-avatar-image"
                          />
                        </div>
                      ) : (
                        <div className={`comm-avatar-shell comm-icon-chip flex h-12 w-12 items-center justify-center font-semibold ${
                          getChatAvatarClass(chatKind)
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
                            <span className={`comm-badge flex-shrink-0 text-xs ${chatTypeBadgeClass}`}>
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
                          {formatChatListPreview(chat)}
                        </p>
                        {unreadWaitingLabel && (
                          <span className="text-[10px] text-rose-600 whitespace-nowrap">Aguardando {unreadWaitingLabel}</span>
                        )}
                        {muted && (
                          <span className="text-[10px] text-slate-400">Silenciado</span>
                        )}
                        {(chat.unread_count ?? 0) > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-amber-600 text-white text-[11px] px-2 py-0.5">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Button>
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
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                className="h-auto justify-start rounded-none border-0 px-3 py-2 text-left text-slate-100 shadow-none hover:bg-slate-800 hover:text-white"
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
              </Button>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        className="h-auto justify-start rounded-none border-0 px-3 py-2 text-left text-slate-100 shadow-none hover:bg-slate-800 hover:text-white"
                        onClick={() => {
                          if (target) updateChatMute(target.id, null);
                          closeMuteSubmenuNow();
                          setChatMenu(null);
                        }}
                      >
                        Desmutar
                      </Button>
                    ) : (
                      <div
                        className="relative"
                        onMouseEnter={openMuteSubmenu}
                        onMouseLeave={closeMuteSubmenuSoon}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          fullWidth
                          className="h-auto justify-between rounded-none border-0 px-3 py-2 text-left text-slate-100 shadow-none hover:bg-slate-800 hover:text-white"
                          onClick={openMuteSubmenu}
                        >
                          <span>Mutar</span>
                          <span className="text-xs text-slate-500">›</span>
                        </Button>
                        {chatMenuMuteOpen && (
                          <div className="absolute left-full top-0 z-10 pl-1">
                            <div className="min-w-[160px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
                              {muteOptions.map((option) => (
                                <Button
                                  key={option.label}
                                  variant="ghost"
                                  size="sm"
                                  fullWidth
                                  className="h-auto justify-start rounded-none border-0 px-3 py-2 text-left text-slate-100 shadow-none hover:bg-slate-800 hover:text-white"
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
                                </Button>
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
        <div className={`${isMobileView ? 'w-full' : 'flex-1'} relative flex min-w-0 min-h-0 flex-col bg-[var(--panel-surface-muted,#f7f0e7)]`}>
          {selectedChat ? (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] p-4">
                {isMobileView && (
                  <Button
                    variant="icon"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={() => selectChat(null)}
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </Button>
                )}
                {selectedChatPhoto ? (
                  <div className="comm-avatar-shell h-10 w-10 flex-shrink-0">
                    <img
                      src={selectedChatPhoto}
                      alt={selectedChatDisplayName || selectedChat.id}
                      className="comm-avatar-image"
                    />
                  </div>
                ) : (
                  <div className={`comm-avatar-shell comm-icon-chip flex h-10 w-10 flex-shrink-0 items-center justify-center font-semibold ${
                    getChatAvatarClass(selectedChatKind)
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
                      <span className={`comm-badge flex-shrink-0 text-xs ${selectedChatTypeBadgeClass}`}>
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
                            ? 'Feed de atualizacoes de status'
                            : selectedChatKind === 'broadcast'
                              ? 'Lista de transmissao'
                              : 'Conversa'}
                  </p>
                  {selectedChatIsDirect && (
                    <div className={`comm-badge mt-1 inline-flex text-[11px] font-medium ${effectiveFirstResponseSlaBadge.className}`}>
                      {effectiveFirstResponseSlaBadge.label}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedChatKind === 'group' ? (
                    <Button
                      variant="icon"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => setShowGroupInfo(!showGroupInfo)}
                      title="Informações do grupo"
                    >
                      <Info className="w-5 h-5 text-slate-600" />
                    </Button>
                  ) : selectedChatIsDirect ? (
                    <Button
                      variant="icon"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      title={copiedPhone === selectedChatPhone ? 'Telefone copiado' : 'Copiar telefone'}
                      onClick={handleCopySelectedChatPhone}
                    >
                      <Phone className="w-5 h-5 text-slate-600" />
                    </Button>
                  ) : null}
                  <Button
                    variant="icon"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    title="Sincronizar mensagens"
                    onClick={handleSyncFromWhapi}
                    disabled={isSyncingAllChats || syncingChatId === selectedChat.id}
                  >
                    <History
                      className={`w-5 h-5 text-slate-600 ${isSyncingAllChats || syncingChatId === selectedChat.id ? 'animate-spin' : ''}`}
                    />
                  </Button>
                  <Button
                    variant="icon"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    title={isCopyingChat ? 'Transcrevendo e copiando chat' : chatCopiedAt ? 'Chat copiado' : 'Copiar chat'}
                    onClick={handleCopyFullChat}
                    disabled={messages.length === 0 || isCopyingChat}
                  >
                    {isCopyingChat ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                    ) : (
                      <Copy className={`w-5 h-5 ${chatCopiedAt ? 'text-emerald-600' : 'text-slate-600'}`} />
                    )}
                  </Button>
                  <Button
                    variant="icon"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    title="Ações da conversa"
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      openChatContextMenu(selectedChat.id, rect.left, rect.bottom + 6);
                    }}
                  >
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
                {hasOlderMessages && (
                  <div className="mb-4 flex justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={loadOlderMessages}
                      disabled={isLoadingOlderMessages}
                      className="h-auto rounded-full px-3 py-1.5 text-xs"
                    >
                      {isLoadingOlderMessages ? 'Carregando mensagens antigas...' : 'Carregar mensagens antigas'}
                    </Button>
                  </div>
                )}
                {renderedMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <p>{isLoadingMessages ? 'Carregando atualizacoes...' : isSelectedStatusChat ? 'Nenhuma atualizacao de status ainda' : 'Nenhuma mensagem ainda'}</p>
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
                          timestamp={getMessageDisplayTimestamp(message)}
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
                          onReact={isSelectedStatusChat ? undefined : handleReact}
                          onReply={isSelectedStatusChat ? undefined : handleReply}
                          onEdit={isSelectedStatusChat ? undefined : handleEdit}
                          onTranscriptionSaved={isSelectedStatusChat ? undefined : handleAudioTranscriptionSaved}
                        />
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {!isSelectedStatusChat ? (
                <>
                  <MessageHistoryPanel chatId={selectedChat.id} chatName={selectedChatDisplayName || selectedChat.id} />

                  <MessageInput
                    chatId={selectedChat.id}
                    contacts={contactsList}
                    templateVariables={templateVariablesForInput}
                    templateVariableShortcuts={TEMPLATE_VARIABLE_SHORTCUTS}
                    followUpContext={followUpContextForInput}
                    onMessageSent={handleMessageSent}
                    replyToMessage={replyToMessage}
                    onCancelReply={handleCancelReply}
                    editMessage={editMessage}
                    onCancelEdit={handleCancelEdit}
                  />
                </>
              ) : (
                <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  Este painel mostra somente atualizacoes de status recebidas. O composer de conversa fica disponivel apenas em chats e grupos.
                </div>
              )}

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
