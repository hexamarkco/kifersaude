import { memo, startTransition, useCallback, useState, useEffect, useLayoutEffect, useRef, useMemo, useDeferredValue } from 'react';
import { supabase, type Lead } from '../../../lib/supabase';
import {
  Search,
  MessageCircle,
  Check,
  X,
  Phone,
  MoreVertical,
  ArrowLeft,
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
  ChevronRight,
  ChevronLeft,
  CalendarPlus,
  Loader2,
  Pin,
  Circle,
  ExternalLink,
  BellOff,
  Clock3,
} from 'lucide-react';
import { MessageInput } from '../composer/WhatsAppComposer';
import type { SentMessagePayload } from '../composer/types';
import { useAuth } from '../../../contexts/AuthContext';
import type { LeadStatusConfig } from '../../../lib/supabase';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import StatusDropdown from '../../../components/StatusDropdown';
import LeadForm from '../../../components/LeadForm';
import ModalShell from '../../../components/ui/ModalShell';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { WhatsAppPageSkeleton } from '../../../components/ui/panelSkeletons';
import { PanelAdaptiveLoadingFrame } from '../../../components/ui/panelLoading';
import { toast } from '../../../lib/toast';
import { getBadgeStyle, getContrastTextColor, hexToRgba } from '../../../lib/colorUtils';
import { MessageBubble, type MediaGalleryItem as MessageBubbleMediaGalleryItem, type MessagePayload as MessageBubblePayload } from './components/MessageBubble';
import { DirectChatInfoPanel } from './components/DirectChatInfoPanel';
import { GroupInfoPanel } from './components/GroupInfoPanel';
import ReminderSchedulerModal from '../../../components/ReminderSchedulerModal';
import { useAdaptiveLoading } from '../../../hooks/useAdaptiveLoading';
import { useConfirmationModal } from '../../../hooks/useConfirmationModal';
import { useWhatsAppInboxPreferences } from '../../../hooks/useWhatsAppInboxPreferences';
import { searchWhatsAppInboxLeads } from '../../../lib/whatsappInboxLeadService';
import { shouldPromptFirstReminderAfterQuote, syncLeadNextReturnFromUpcomingReminder } from '../../../lib/leadReminderUtils';
import { addBusinessDaysSkippingWeekends } from '../../../lib/reminderUtils';
import { isHiddenTechnicalActionMessage, resolveWhatsAppMessageBody } from '../../../lib/whatsappMessageBody';
import { formatWhatsAppAudioTranscriptionLabel, getWhatsAppAudioTranscription } from '../../../lib/whatsappAudioTranscription';
import { SAO_PAULO_TIMEZONE, getDateKey } from '../../../lib/dateUtils';
import {
  CHAT_SEARCH_MESSAGE_INDEX_LIMIT,
  DAY_SEPARATOR_LABEL_FORMATTER,
  EMPTY_FILTER_VALUE,
  getChatTypeBadgeClass,
  MESSAGES_PAGE_SIZE,
  PERSON_FALLBACK_NOTIFICATION_ICON,
  REMINDER_QUICK_OPEN_AUTO_REFRESH_MS,
  REMINDER_QUICK_OPEN_PERIODS,
  REMINDER_QUICK_OPEN_STALE_MS,
  TEMPLATE_VARIABLE_SHORTCUTS,
} from '../shared/inboxConstants';
import { getPinnedSortValue, sortChatsByLatest } from '../shared/chatSort';
import {
  buildContactPhotoMap,
  buildContactProfilePhotoMap,
  buildGroupPhotoMap,
  buildLegacyContactPhotoMap,
  extractPhoneFromChatId,
  getChatIdVariants,
  getDirectIdVariantsFromDigits,
  getPhoneDigits,
  resolveChatAvatarSources,
} from '../shared/avatarResolution';
import { areEquivalentDirectChats, choosePreferredDirectChatId, isDirectChatIdentityTarget } from '../shared/directChatIdentity';
import { WhatsAppChatAvatar } from '../shared/components/WhatsAppChatAvatar';
import {
  compareReminderQuickOpenItems,
  formatReminderDueAt,
  getReminderPriorityMeta,
  getReminderTypeMeta,
  groupReminderQuickOpenItems,
  mapReminderPriorityToSchedulerPriority,
  mapReminderTypeToSchedulerType,
  resolveReminderLeadName,
} from '../shared/reminderQuickOpen';
import { mergeChatPreview, sanitizeTechnicalCiphertextPreview } from '../shared/chatPreview';
import { dataUrlToFile } from '../shared/stickerLibrary';
import { buildOutboundSentMessagePayload, persistOutboundMessage } from '../shared/outboundMessagePersistence';
import { formatWhatsAppPhoneDisplay, isLikelyBrazilLocalNumber, normalizePhoneNumber } from '../shared/phoneUtils';
import { normalizeTitleCase } from '../../../lib/textNormalization';
import type {
  ChatKindFilter,
  ChatLeadPresenceFilter,
  ChatMenuState,
  ChatMenuSource,
  ReminderQuickOpenItem,
  ReminderQuickOpenPeriod,
  ReminderQuickOpenSchedulerDefaults,
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppMessagePayload,
  WhatsAppMessageReaction,
} from '../shared/inboxTypes';
import {
  addWhatsAppContact,
  buildChatIdFromPhone,
  deleteWhatsAppContact,
  getWhatsAppChat,
  getWhatsAppChatKind,
  getWhatsAppChats,
  getWhatsAppContactProfile,
  getWhatsAppContacts,
  getWhatsAppMedia,
  getWhatsAppGroups,
  getWhatsAppNewsletters,
  normalizeChatId,
  reactToMessage,
  removeReactionFromMessage,
  sendMediaMessage,
  sendWhatsAppMessage,
  updateWhatsAppContact,
  type WhapiChat,
  type WhapiContact,
  type WhapiGroup,
} from '../../../lib/whatsappApiService';
import { getWhatsAppChatIdType } from '../../../lib/whatsappChatIdentity';
import { isWhatsAppPayloadForwarded, markWhatsAppPayloadAsForwarded } from '../shared/messageForwarding';

type FirstResponseSLA =
  | { kind: 'no-inbound' }
  | { kind: 'waiting'; minutes: number }
  | { kind: 'replied'; minutes: number };

type MessagesCacheState = {
  messages: WhatsAppMessage[];
  loadedCount: number;
  queryOffset: number;
  hasOlder: boolean;
  searchIndex: string;
};

type VisibleChatRowItem = {
  chat: WhatsAppChat;
  displayName: string;
  kind: string;
  typeLabel: string | null;
  typeBadgeClass: string;
  leadStatus: string | null;
  leadStatusStyles: ReturnType<typeof getBadgeStyle> | null;
  photoSources: string[];
  muted: boolean;
  unreadWaitingLabel: string | null;
  formattedTime: string;
  previewText: string;
};

type RenderedMessageItem = {
  message: WhatsAppMessage;
  timestamp: string | null;
  shouldShowDaySeparator: boolean;
  daySeparatorLabel: string;
  authorName?: string;
  reactions?: Array<{ emoji: string; count: number }>;
  forwardPlan: ForwardMessagePlan | null;
};

type InboxLeadSummary = {
  id: string;
  name: string;
  phone: string;
  status?: string | null;
  responsavel?: string | null;
};

type ForwardMessagePlan =
  | {
      kind: 'text';
      type: 'text';
      body: string;
      hasMedia: false;
    }
  | {
      kind: 'link_preview';
      type: 'link_preview';
      body: string;
      hasMedia: true;
      title: string;
      description?: string;
      canonical?: string;
      preview?: string;
    }
  | {
      kind: 'contact';
      type: 'contact';
      body: string;
      hasMedia: false;
      name: string;
      vcard: string;
    }
  | {
      kind: 'location';
      type: 'location';
      body: string;
      hasMedia: true;
      latitude: number;
      longitude: number;
      description?: string;
    }
  | {
      kind: 'media';
      type: 'image' | 'video' | 'sticker' | 'document' | 'audio' | 'voice';
      body: string;
      hasMedia: true;
      caption?: string;
      mediaId?: string;
      url?: string;
      fileName: string;
      mimeType?: string;
      seconds?: number;
      recordingTime?: number;
      asVoice?: boolean;
    };

type InboxLeadInfo = InboxLeadSummary & {
  email?: string | null;
  cidade?: string | null;
  observacoes?: string | null;
};

type InboxContactInfo = {
  id: string;
  name: string;
  saved: boolean;
  savedName?: string;
  pushname?: string;
  isBusiness?: boolean;
};

type InboxContactDirectoryEntry = Omit<InboxContactInfo, 'id'>;

type ContactPhotoSyncTarget = {
  lookupId: string;
  aliases?: string[];
};

type ContactPhotoSyncResponse = {
  success: boolean;
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  photos?: Array<{
    contact_id: string;
    public_url: string | null;
  }>;
};

const CHAT_ROW_HEIGHT = 96;
const CHAT_LIST_OVERSCAN = 8;
const MESSAGE_ROW_BASE_ESTIMATED_HEIGHT = 88;
const MESSAGE_ROW_VISUAL_MEDIA_ESTIMATED_HEIGHT = 320;
const MESSAGE_LIST_OVERSCAN_PX = 720;
const MESSAGE_LIST_VIRTUALIZATION_THRESHOLD = 60;
const MESSAGES_VIEWPORT_NEAR_BOTTOM_PX = 40;

const OFFSCREEN_CHAT_ROW_STYLE = {
  contentVisibility: 'auto' as const,
  containIntrinsicSize: `${CHAT_ROW_HEIGHT}px`,
  minHeight: CHAT_ROW_HEIGHT,
};

const OFFSCREEN_MESSAGE_STYLE = {
  contentVisibility: 'auto' as const,
  containIntrinsicSize: '280px',
};

const UNREAD_COUNTS_REFRESH_DELAY_MS = 1000;
const SELECTED_CHAT_AUTO_SYNC_INTERVAL_MS = 2 * 60_000;
const SELECTED_CHAT_AUTO_SYNC_FRESHNESS_MS = 3 * 60_000;
const CONTACT_PHOTO_FALLBACK_BATCH_SIZE = 80;
const WHATSAPP_CHAT_SELECT_FIELDS = [
  'id',
  'name',
  'is_group',
  'phone_number',
  'lid',
  'last_message_at',
  'created_at',
  'updated_at',
  'last_message',
  'last_message_direction',
  'unread_count',
  'archived',
  'pinned',
  'mute_until',
].join(',');

function isWhatsAppChatsSchemaMismatchError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
  const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
  const combined = `${message} ${details} ${hint}`.toLowerCase();

  return code === '42703'
    || code === 'PGRST204'
    || (status === 400 && combined.includes('whatsapp_chats') && (
      combined.includes('last_message_direction')
      || combined.includes('last_message')
      || combined.includes('phone_number')
      || combined.includes('lid')
      || combined.includes('archived')
      || combined.includes('pinned')
      || combined.includes('mute_until')
      || combined.includes('unread_count')
    ));
}

function isWhapiChatNotFoundError(error: unknown) {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('specified chat not found');
}

const UNRESOLVED_DIRECT_CHAT_LABEL = 'Contato WhatsApp';

function extractPhoneMatchSource(value: string | null | undefined) {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  if (!trimmed.includes('@')) return trimmed;

  const chatIdType = getWhatsAppChatIdType(trimmed);
  if (chatIdType === 'phone') {
    return extractPhoneFromChatId(trimmed) || trimmed;
  }

  return '';
}

type InboxChatRowProps = {
  item: VisibleChatRowItem;
  isSelected: boolean;
  onSelectChat: (chat: WhatsAppChat | null) => void;
  onOpenChatContextMenu: (chatId: string, anchorRect: DOMRect, source: ChatMenuSource) => void;
};

function areStringArraysEqual(left: string[], right: string[]) {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areBadgeStylesEqual(
  left: ReturnType<typeof getBadgeStyle> | null,
  right: ReturnType<typeof getBadgeStyle> | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.backgroundColor === right.backgroundColor &&
    left.color === right.color &&
    left.borderColor === right.borderColor
  );
}

function areVisibleChatRowItemsEqual(left: VisibleChatRowItem, right: VisibleChatRowItem) {
  return (
    left.chat === right.chat &&
    left.displayName === right.displayName &&
    left.kind === right.kind &&
    left.typeLabel === right.typeLabel &&
    left.typeBadgeClass === right.typeBadgeClass &&
    left.leadStatus === right.leadStatus &&
    areBadgeStylesEqual(left.leadStatusStyles, right.leadStatusStyles) &&
    areStringArraysEqual(left.photoSources, right.photoSources) &&
    left.muted === right.muted &&
    left.unreadWaitingLabel === right.unreadWaitingLabel &&
    left.formattedTime === right.formattedTime &&
    left.previewText === right.previewText
  );
}

const InboxChatRow = memo(function InboxChatRow({
  item,
  isSelected,
  onSelectChat,
  onOpenChatContextMenu,
}: InboxChatRowProps) {
  const handleClick = useCallback(() => {
    onSelectChat(item.chat);
  }, [item.chat, onSelectChat]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onOpenChatContextMenu(item.chat.id, event.currentTarget.getBoundingClientRect(), 'row');
    },
    [item.chat.id, onOpenChatContextMenu],
  );

  return (
    <div style={OFFSCREEN_CHAT_ROW_STYLE}>
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`h-auto justify-start rounded-none border-b border-[var(--panel-border-subtle,#e7dac8)] p-4 text-left font-normal shadow-none transition-colors hover:bg-[var(--panel-surface-soft,#f4ede3)] hover:text-[var(--panel-text,#1a120d)] ${
          isSelected ? 'bg-[var(--panel-surface-muted,#f7f0e7)]' : ''
        }`}
      >
        <div className="relative flex-shrink-0">
          <WhatsAppChatAvatar
            kind={item.kind}
            alt={item.displayName}
            photoSources={item.photoSources}
            shellClassName="h-12 w-12"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h3 className="truncate font-medium text-slate-900">{item.displayName}</h3>
              {item.leadStatus && item.leadStatusStyles && (
                <span className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px]" style={item.leadStatusStyles}>
                  {item.leadStatus}
                </span>
              )}
              {item.typeLabel && (
                <span className={`comm-badge flex-shrink-0 text-xs ${item.typeBadgeClass}`}>
                  {item.typeLabel}
                </span>
              )}
            </div>
            <span className="ml-2 flex-shrink-0 text-xs text-slate-500">{item.formattedTime}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm text-slate-600">{item.previewText}</p>
            {(item.chat.pinned ?? 0) > 0 && (
              <span className="whitespace-nowrap text-[10px] text-amber-700">Fixado</span>
            )}
            {item.unreadWaitingLabel && (
              <span className="whitespace-nowrap text-[10px] text-rose-600">Aguardando {item.unreadWaitingLabel}</span>
            )}
            {item.muted && <span className="text-[10px] text-slate-400">Silenciado</span>}
            {(item.chat.unread_count ?? 0) > 0 && (
              <span className="flex-shrink-0 rounded-full bg-amber-600 px-2 py-0.5 text-[11px] text-white">
                {item.chat.unread_count}
              </span>
            )}
          </div>
        </div>
      </Button>
    </div>
  );
}, (prev, next) => prev.item === next.item && prev.isSelected === next.isSelected);

export default function WhatsAppInboxScreen() {
  const { handleTabChange } = useOutletContext<{ handleTabChange: (tab: string, options?: { leadIdFilter?: string }) => void }>();
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesChatId, setMessagesChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: string;
    body: string;
    from: string;
  } | null>(null);
  const [editMessage, setEditMessage] = useState<{
    id: string;
    body: string;
    chatId?: string;
  } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<WhatsAppMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardTargetChatIds, setForwardTargetChatIds] = useState<string[]>([]);
  const [isForwardingMessage, setIsForwardingMessage] = useState(false);
  const [contactsById, setContactsById] = useState<Map<string, InboxContactDirectoryEntry>>(new Map());
  const [contactsList, setContactsList] = useState<InboxContactInfo[]>([]);
  const [liveContactPhotosById, setLiveContactPhotosById] = useState<Map<string, string>>(new Map());
  const [legacyContactPhotosById, setLegacyContactPhotosById] = useState<Map<string, string>>(new Map());
  const [groupPhotosById, setGroupPhotosById] = useState<Map<string, string>>(new Map());
  const [leadsList, setLeadsList] = useState<InboxLeadSummary[]>([]);
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
  const [chatMenu, setChatMenu] = useState<ChatMenuState | null>(null);
  const [chatMenuMuteOpen, setChatMenuMuteOpen] = useState(false);
  const [chatMenuStatusOpen, setChatMenuStatusOpen] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatTab, setNewChatTab] = useState<'leads' | 'contacts' | 'manual'>('leads');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [leadDirectoryResults, setLeadDirectoryResults] = useState<InboxLeadSummary[]>([]);
  const [isLoadingLeadDirectory, setIsLoadingLeadDirectory] = useState(false);
  const [syncingChatId, setSyncingChatId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadedMessagesCount, setLoadedMessagesCount] = useState(0);
  const [loadedMessagesQueryOffset, setLoadedMessagesQueryOffset] = useState(0);
  const [windowFocusVersion, setWindowFocusVersion] = useState(0);
  const [slaTick, setSlaTick] = useState(0);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [chatCopiedAt, setChatCopiedAt] = useState<number | null>(null);
  const [isCopyingChat, setIsCopyingChat] = useState(false);
  const [selectedLeadInfo, setSelectedLeadInfo] = useState<InboxLeadInfo | null>(null);
  const [isLoadingSelectedLeadInfo, setIsLoadingSelectedLeadInfo] = useState(false);
  const [isSavingSelectedContact, setIsSavingSelectedContact] = useState(false);
  const [isDeletingSelectedContact, setIsDeletingSelectedContact] = useState(false);
  const [isSavingSelectedLeadInfo, setIsSavingSelectedLeadInfo] = useState(false);
  const [isDeletingSelectedLeadInfo, setIsDeletingSelectedLeadInfo] = useState(false);
  const [leadCreationInitialValues, setLeadCreationInitialValues] = useState<Partial<Lead> | null>(null);
  const [pendingMessagesBelow, setPendingMessagesBelow] = useState(0);
  const [composerHeight, setComposerHeight] = useState(96);
  const [myReactionsByMessage, setMyReactionsByMessage] = useState<Map<string, string>>(new Map());
  const [groupNamesById, setGroupNamesById] = useState<Map<string, string>>(new Map());
  const [newsletterNamesById, setNewsletterNamesById] = useState<Map<string, string>>(new Map());
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [renderRemindersModalContent, setRenderRemindersModalContent] = useState(false);
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
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const chatListViewportRef = useRef<HTMLDivElement | null>(null);
  const composerContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const chatSegmentsMenuRef = useRef<HTMLDivElement | null>(null);
  const advancedChatFiltersRef = useRef<HTMLDivElement | null>(null);
  const chatMenuRef = useRef<HTMLDivElement | null>(null);
  const chatsRef = useRef<WhatsAppChat[]>([]);
  const selectedChatRef = useRef<WhatsAppChat | null>(null);
  const newsletterNamesByIdRef = useRef<Map<string, string>>(new Map());
  const newsletterNameLookupAttemptsRef = useRef<Set<string>>(new Set());
  const loadedLeadMatchKeysRef = useRef<Set<string>>(new Set());
  const leadDirectoryRequestIdRef = useRef(0);
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
  const lastSelectedChatAutoSyncAtRef = useRef<Map<string, number>>(new Map());
  const muteMenuCloseTimeoutRef = useRef<number | null>(null);
  const statusMenuCloseTimeoutRef = useRef<number | null>(null);
  const shouldScrollOnChatChangeRef = useRef(false);
  const shouldRevealSelectedChatInListRef = useRef(false);
  const previousSelectedChatRef = useRef<WhatsAppChat | null>(null);
  const pendingInitialScrollMessageIdRef = useRef<string | null>(null);
  const lastRenderedMessageIdRef = useRef<string | null>(null);
  const pendingMessageIdsBelowRef = useRef<Set<string>>(new Set());
  const messagesViewportNearBottomRef = useRef(true);
  const pendingPrependScrollRestoreRef = useRef<{
    chatId: string;
    previousScrollHeight: number;
    previousScrollTop: number;
  } | null>(null);
  const activeMessagesLoadIdRef = useRef(0);
  const activeChatsLoadIdRef = useRef(0);
  const chatSelectionFrameRef = useRef<number | null>(null);
  const chatListScrollFrameRef = useRef<number | null>(null);
  const messagesViewportScrollFrameRef = useRef<number | null>(null);
  const messageRowHeightsFrameRef = useRef<number | null>(null);
  const composerResizeFrameRef = useRef<number | null>(null);
  const lastGroupNamesSyncAtRef = useRef(0);
  const directNameHydrationAttemptsRef = useRef<Set<string>>(new Set());
  const avatarProfileHydrationAttemptsRef = useRef<Set<string>>(new Set());
  const requestedLegacyContactPhotoIdsRef = useRef<Set<string>>(new Set());
  const handledReminderQueryRef = useRef<string | null>(null);
  const reminderQuickOpenLoadingRef = useRef(false);
  const reminderQuickOpenLastLoadedAtRef = useRef(0);
  const messagesCacheRef = useRef<Map<string, MessagesCacheState>>(new Map());
  const messageByIdRef = useRef<Map<string, WhatsAppMessage>>(new Map());
  const messageRowElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const messageRowHeightsRef = useRef<Map<string, number>>(new Map());
  const messageRowsResizeObserverRef = useRef<ResizeObserver | null>(null);
  const mediaGalleryItemsRef = useRef<MessageBubbleMediaGalleryItem[]>([]);
  const visibleChatItemsCacheRef = useRef<Map<string, VisibleChatRowItem>>(new Map());
  const [chatListScrollTop, setChatListScrollTop] = useState(0);
  const [chatListViewportHeight, setChatListViewportHeight] = useState(0);
  const [messagesViewportScrollTop, setMessagesViewportScrollTop] = useState(0);
  const [messagesViewportHeight, setMessagesViewportHeight] = useState(0);
  const [messageRowHeightsVersion, setMessageRowHeightsVersion] = useState(0);
  const loadingUi = useAdaptiveLoading(loading);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const selectChat = useCallback((chat: WhatsAppChat | null) => {
    if (chatSelectionFrameRef.current !== null) {
      cancelAnimationFrame(chatSelectionFrameRef.current);
    }

    chatSelectionFrameRef.current = requestAnimationFrame(() => {
      chatSelectionFrameRef.current = null;
      startTransition(() => {
        setSelectedChat(chat && getWhatsAppChatKind(chat.id) === 'status' ? null : chat);
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (chatSelectionFrameRef.current !== null) {
        cancelAnimationFrame(chatSelectionFrameRef.current);
      }
      if (chatListScrollFrameRef.current !== null) {
        cancelAnimationFrame(chatListScrollFrameRef.current);
      }
      if (messagesViewportScrollFrameRef.current !== null) {
        cancelAnimationFrame(messagesViewportScrollFrameRef.current);
      }
      if (messageRowHeightsFrameRef.current !== null) {
        cancelAnimationFrame(messageRowHeightsFrameRef.current);
      }
      if (composerResizeFrameRef.current !== null) {
        cancelAnimationFrame(composerResizeFrameRef.current);
      }
      if (messageRowsResizeObserverRef.current) {
        messageRowsResizeObserverRef.current.disconnect();
      }
    };
  }, []);

  const scheduleMessageRowHeightsRefresh = useCallback(() => {
    if (messageRowHeightsFrameRef.current !== null) {
      return;
    }

    messageRowHeightsFrameRef.current = requestAnimationFrame(() => {
      messageRowHeightsFrameRef.current = null;
      setMessageRowHeightsVersion((current) => current + 1);
    });
  }, []);

  const syncMeasuredMessageRowHeight = useCallback(
    (messageId: string, nextHeight: number) => {
      const roundedHeight = Math.ceil(nextHeight);
      if (!Number.isFinite(roundedHeight) || roundedHeight <= 0) {
        return;
      }

      const currentHeight = messageRowHeightsRef.current.get(messageId);
      if (currentHeight === roundedHeight) {
        return;
      }

      messageRowHeightsRef.current.set(messageId, roundedHeight);
      scheduleMessageRowHeightsRefresh();
    },
    [scheduleMessageRowHeightsRefresh],
  );

  const setMessageRowElement = useCallback(
    (messageId: string, node: HTMLDivElement | null) => {
      const elementMap = messageRowElementsRef.current;
      const previousNode = elementMap.get(messageId);
      const observer = messageRowsResizeObserverRef.current;

      if (previousNode && previousNode !== node && observer) {
        observer.unobserve(previousNode);
      }

      if (!node) {
        elementMap.delete(messageId);
        return;
      }

      elementMap.set(messageId, node);

      if (observer) {
        observer.observe(node);
      }

      syncMeasuredMessageRowHeight(messageId, node.getBoundingClientRect().height);
    },
    [syncMeasuredMessageRowHeight],
  );

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const target = entry.target as HTMLDivElement;
        const messageId = target.dataset.messageId;
        if (!messageId) {
          return;
        }

        syncMeasuredMessageRowHeight(messageId, entry.contentRect.height);
      });
    });

    messageRowsResizeObserverRef.current = observer;
    messageRowElementsRef.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      if (messageRowsResizeObserverRef.current === observer) {
        messageRowsResizeObserverRef.current = null;
      }
    };
  }, [syncMeasuredMessageRowHeight]);

  const handleChatListScroll = useCallback(() => {
    const viewport = chatListViewportRef.current;
    if (!viewport || chatListScrollFrameRef.current !== null) {
      return;
    }

    chatListScrollFrameRef.current = requestAnimationFrame(() => {
      chatListScrollFrameRef.current = null;
      const nextScrollTop = viewport.scrollTop;
      setChatListScrollTop((current) => (current === nextScrollTop ? current : nextScrollTop));
    });
  }, []);

  useEffect(() => {
    shouldRevealSelectedChatInListRef.current = Boolean(selectedChat);
  }, [selectedChat?.id, isMobileView]);

  useLayoutEffect(() => {
    const viewport = chatListViewportRef.current;
    if (!viewport) {
      setChatListViewportHeight(0);
      setChatListScrollTop(0);
      return;
    }

    const syncChatListMetrics = () => {
      const nextHeight = viewport.clientHeight || 0;
      const nextScrollTop = viewport.scrollTop || 0;

      setChatListViewportHeight((current) => (current === nextHeight ? current : nextHeight));
      setChatListScrollTop((current) => (current === nextScrollTop ? current : nextScrollTop));
    };

    syncChatListMetrics();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncChatListMetrics);
      return () => {
        window.removeEventListener('resize', syncChatListMetrics);
      };
    }

    const observer = new ResizeObserver(() => {
      syncChatListMetrics();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [isMobileView, selectedChat?.id]);

  useLayoutEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      setMessagesViewportHeight(0);
      setMessagesViewportScrollTop(0);
      return;
    }

    const syncMessagesViewportMetrics = () => {
      const nextHeight = viewport.clientHeight || 0;
      const nextScrollTop = viewport.scrollTop || 0;

      setMessagesViewportHeight((current) => (current === nextHeight ? current : nextHeight));
      setMessagesViewportScrollTop((current) => (current === nextScrollTop ? current : nextScrollTop));
    };

    syncMessagesViewportMetrics();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncMessagesViewportMetrics);
      return () => {
        window.removeEventListener('resize', syncMessagesViewportMetrics);
      };
    }

    const observer = new ResizeObserver(() => {
      syncMessagesViewportMetrics();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [selectedChat?.id]);

  const normalizeSearchText = (value: string | null | undefined) =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const getPayloadSearchTerms = (payload: WhatsAppMessagePayload | null | undefined): string[] => {
    if (!payload || typeof payload !== 'object') return [];

    const payloadCandidates = [
      payload,
      payload.media,
      payload.audio,
      payload.voice,
      payload.image,
      payload.video,
      payload.document,
      payload.link_preview,
      payload.contact,
      payload.contact_list,
    ].filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));

    return payloadCandidates.flatMap((item) => {
      const filename = typeof item.filename === 'string' ? item.filename : '';
      const name = typeof item.name === 'string' ? item.name : '';
      const title = typeof item.title === 'string' ? item.title : '';
      const description = typeof item.description === 'string' ? item.description : '';
      const caption = typeof item.caption === 'string' ? item.caption : '';
      const body = typeof item.body === 'string' ? item.body : '';
      const url = typeof item.url === 'string' ? item.url : '';
      const link = typeof item.link === 'string' ? item.link : '';
      const canonical = typeof item.canonical === 'string' ? item.canonical : '';

      return [filename, name, title, description, caption, body, url, link, canonical].filter(Boolean);
    });
  };

  const getMessageSearchHaystack = useCallback((message: WhatsAppMessage) =>
    normalizeSearchText(
      [
        resolveWhatsAppMessageBody({
          body: message.body,
          type: message.type,
          payload: message.payload,
        }),
        message.body,
        message.type,
        ...getPayloadSearchTerms(message.payload),
      ]
        .filter(Boolean)
        .join(' '),
    ), []);

  const buildMessagesSearchIndex = useCallback((messages: WhatsAppMessage[]) =>
    messages
      .slice(-CHAT_SEARCH_MESSAGE_INDEX_LIMIT)
      .map((message) => getMessageSearchHaystack(message))
      .filter(Boolean)
      .join(' '), [getMessageSearchHaystack]);

  const createMessagesCacheState = useCallback((params: {
    messages: WhatsAppMessage[];
    loadedCount: number;
    queryOffset: number;
    hasOlder: boolean;
  }): MessagesCacheState => ({
    ...params,
    searchIndex: buildMessagesSearchIndex(params.messages),
  }), [buildMessagesSearchIndex]);

  const collectPhoneMatchKeys = (value: string | null | undefined): string[] => {
    const digitsOnly = extractPhoneMatchSource(value).replace(/\D/g, '');
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

  const getLeadMatchKeysForChat = useCallback((chat: Pick<WhatsAppChat, 'id' | 'name' | 'phone_number' | 'lid' | 'is_group'> | null): string[] => {
    if (!chat || !isDirectChat(chat)) {
      return [];
    }

    const keys = new Set<string>();
    [chat.id, chat.name, normalizeChatId(chat.id), chat.phone_number].forEach((value) => {
      collectPhoneMatchKeys(value).forEach((key) => keys.add(key));
    });

    const digitCandidates = [
      extractPhoneFromChatId(chat.id),
      normalizePhoneNumber(chat.phone_number),
      getPhoneDigits(chat.phone_number),
    ].filter(Boolean);
    digitCandidates.forEach((digits) => {
      collectPhoneMatchKeys(digits).forEach((key) => keys.add(key));
      getDirectIdVariantsFromDigits(digits).forEach((variant) => {
        collectPhoneMatchKeys(variant).forEach((key) => keys.add(key));
      });
    });

    return Array.from(keys);
  }, []);

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

  const isClientGeneratedMessageId = (id: string) => id.startsWith('local-') || id.startsWith('msg-');

  const normalizeMessageBodyForMatch = (value: string | null | undefined) =>
    (value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const isLikelyOutboundDuplicateMessage = (
    left: Pick<WhatsAppMessage, 'id' | 'local_ref' | 'direction' | 'body' | 'type' | 'has_media' | 'timestamp' | 'created_at'>,
    right: Pick<WhatsAppMessage, 'id' | 'local_ref' | 'direction' | 'body' | 'type' | 'has_media' | 'timestamp' | 'created_at'>,
  ) => {
    if (left.id === right.id) return true;
    if (left.local_ref && right.local_ref && left.local_ref === right.local_ref) return true;
    if (left.local_ref && left.local_ref === right.id) return true;
    if (right.local_ref && right.local_ref === left.id) return true;
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
    message: Pick<WhatsAppMessage, 'id' | 'ack_status' | 'timestamp' | 'payload' | 'created_at' | 'send_state'>,
  ) => {
    let score = 0;
    if (!isClientGeneratedMessageId(message.id)) score += 4;
    if (typeof message.ack_status === 'number') score += 2;
    if (message.send_state === 'failed') score -= 1;
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

  const applyPersistedAudioTranscription = (
    payload: WhatsAppMessagePayload | null | undefined,
    transcriptionText: string | null | undefined,
  ): WhatsAppMessagePayload | undefined => {
    const text = typeof transcriptionText === 'string' ? transcriptionText.trim() : '';
    const current = payload && typeof payload === 'object' ? payload : undefined;

    if (!text || getWhatsAppAudioTranscription(current)?.text) {
      return current;
    }

    return {
      ...(current || {}),
      transcription: {
        text,
      },
    };
  };

  const hydrateMessageAudioTranscription = (message: WhatsAppMessage): WhatsAppMessage => {
    const nextPayload = applyPersistedAudioTranscription(message.payload, message.transcription_text);
    if (nextPayload === message.payload) {
      return message;
    }

    return {
      ...message,
      payload: nextPayload,
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
      local_ref: preferred.local_ref ?? fallback.local_ref ?? null,
      ack_status: mergeAckStatusForDisplay(fallback.ack_status, preferred.ack_status),
      body: preferred.body ?? fallback.body,
      timestamp: preferred.timestamp ?? fallback.timestamp,
      payload: mergeMessagePayloadForDisplay(fallback.payload, preferred.payload),
      transcription_text: preferred.transcription_text ?? fallback.transcription_text ?? null,
      send_state: preferred.send_state !== undefined ? preferred.send_state : fallback.send_state ?? null,
      error_message: preferred.error_message !== undefined ? preferred.error_message : fallback.error_message ?? null,
      retry_payload: preferred.retry_payload !== undefined ? preferred.retry_payload : fallback.retry_payload ?? null,
      created_at: preferred.created_at || fallback.created_at,
    };
  };

  const appendMessageToSortedList = (currentMessages: WhatsAppMessage[], nextMessage: WhatsAppMessage) => {
    if (currentMessages.length === 0) {
      return [nextMessage];
    }

    const lastMessage = currentMessages[currentMessages.length - 1];
    if (sortMessagesChronologically(lastMessage, nextMessage) <= 0) {
      return [...currentMessages, nextMessage];
    }

    const next = [...currentMessages];
    let insertAt = next.length;
    while (insertAt > 0 && sortMessagesChronologically(next[insertAt - 1], nextMessage) > 0) {
      insertAt -= 1;
    }
    next.splice(insertAt, 0, nextMessage);
    return next;
  };

  const mergeSentMessageIntoList = (currentMessages: WhatsAppMessage[], nextMessage: WhatsAppMessage) => {
    const sameIdIndex = currentMessages.findIndex((item) => item.id === nextMessage.id);
    if (sameIdIndex >= 0) {
      const mergedMessage = mergeMessageForDisplay(currentMessages[sameIdIndex], nextMessage);
      if (mergedMessage === currentMessages[sameIdIndex]) {
        return currentMessages;
      }

      const next = [...currentMessages];
      next[sameIdIndex] = mergedMessage;
      return next;
    }

    const lastMessageIndex = currentMessages.length - 1;
    const lastMessage = lastMessageIndex >= 0 ? currentMessages[lastMessageIndex] : null;
    if (lastMessage && isLikelyOutboundDuplicateMessage(lastMessage, nextMessage)) {
      const mergedMessage = mergeMessageForDisplay(lastMessage, nextMessage);
      const next = [...currentMessages];
      next[lastMessageIndex] = mergedMessage;
      return next;
    }

    const likelyDuplicateIndex = currentMessages.findIndex((item) => isLikelyOutboundDuplicateMessage(item, nextMessage));
    if (likelyDuplicateIndex >= 0) {
      const mergedMessage = mergeMessageForDisplay(currentMessages[likelyDuplicateIndex], nextMessage);
      const previousMessage = currentMessages[likelyDuplicateIndex - 1];
      const followingMessage = currentMessages[likelyDuplicateIndex + 1];
      const orderChanged =
        (previousMessage && sortMessagesChronologically(previousMessage, mergedMessage) > 0) ||
        (followingMessage && sortMessagesChronologically(mergedMessage, followingMessage) > 0);

      const next = [...currentMessages];
      next[likelyDuplicateIndex] = mergedMessage;
      return orderChanged ? next.sort(sortMessagesChronologically) : next;
    }

    return appendMessageToSortedList(currentMessages, nextMessage);
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

  const asPayloadRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

  const getFirstTrimmedString = (...values: unknown[]): string | null => {
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    return null;
  };

  const getFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const buildContactVcard = (name: string, phone: string) =>
    `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${phone}:${phone}\nEND:VCARD`;

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

  const getChatKind = useCallback((chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => {
    if (chat.is_group) return 'group' as const;

    const kind = getWhatsAppChatKind(chat.id);
    if (kind !== 'unknown') return kind;

    const digits = chat.id.replace(/\D/g, '');
    if (!chat.id.includes('@') && digits.length >= 10) {
      return 'direct' as const;
    }

    return kind;
  }, []);

  const isStatusChat = useCallback((chat: Pick<WhatsAppChat, 'id' | 'is_group'> | null | undefined) => {
    if (!chat) return false;
    return getChatKind(chat) === 'status';
  }, [getChatKind]);

  const isStatusMessage = (message: Pick<WhatsAppMessage, 'chat_id' | 'type'> | null | undefined) => {
    if (!message) return false;
    if (String(message.type || '').trim().toLowerCase() === 'story') return true;
    return getWhatsAppChatKind(message.chat_id || '') === 'status';
  };

  const isDirectChat = (chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => isDirectChatIdentityTarget(chat);

  const isSameConversation = (
    left: Pick<WhatsAppChat, 'id' | 'is_group'> | null | undefined,
    right: Pick<WhatsAppChat, 'id' | 'is_group'> | null | undefined,
  ) => {
    if (!left || !right) return left === right;
    if (left.id === right.id) return true;
    return areEquivalentDirectChats(left, right);
  };

  const doesMessagesStateMatchChat = (
    chatId: string | null,
    chat: Pick<WhatsAppChat, 'id' | 'is_group'> | null | undefined,
  ) => {
    if (!chatId || !chat) return false;
    if (chatId === chat.id) return true;
    return areEquivalentDirectChats({ id: chatId, is_group: chat.is_group }, chat);
  };

  const getChatTypeLabel = useCallback((chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => {
    const kind = getChatKind(chat);
    if (kind === 'group') return 'Grupo';
    if (kind === 'newsletter') return 'Canal';
    if (kind === 'status') return 'Status';
    if (kind === 'broadcast') return 'Transmissao';
    return null;
  }, [getChatKind]);

  const getNonDirectFallbackName = useCallback((chat: Pick<WhatsAppChat, 'id' | 'is_group'>) => {
    const kind = getChatKind(chat);
    if (kind === 'newsletter') return 'Canal sem nome';
    if (kind === 'status') return 'Status';
    if (kind === 'broadcast') return 'Transmissao sem nome';
    return chat.id;
  }, [getChatKind]);

  const isPhoneLikeLabel = useCallback((value: string | null | undefined) => {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (!/^[+\d\s().-]+$/.test(trimmed)) return false;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 10;
  }, []);

  const getMeaningfulContactLabel = useCallback((value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || isPhoneLikeLabel(trimmed)) {
      return null;
    }

    return trimmed;
  }, [isPhoneLikeLabel]);

  const buildContactDirectoryEntry = (
    contact: Pick<WhapiContact, 'name' | 'pushname' | 'saved' | 'is_business'>,
  ): InboxContactDirectoryEntry => {
    const savedName = getMeaningfulContactLabel(contact.name);
    const pushname = getMeaningfulContactLabel(contact.pushname);
    const saved = Boolean(contact.saved || savedName);

    return {
      name: savedName || pushname || contact.name || contact.pushname || '',
      saved,
      savedName: savedName || undefined,
      pushname: pushname || undefined,
      isBusiness: contact.is_business === true,
    };
  };

  const mergeContactDirectoryEntry = (
    current: InboxContactDirectoryEntry | undefined,
    next: InboxContactDirectoryEntry,
  ): InboxContactDirectoryEntry => {
    const savedName = getMeaningfulContactLabel(current?.savedName) || getMeaningfulContactLabel(next.savedName);
    const pushname = getMeaningfulContactLabel(current?.pushname) || getMeaningfulContactLabel(next.pushname);

    return {
      name: savedName || pushname || current?.name || next.name,
      saved: Boolean(current?.saved || next.saved || savedName),
      savedName: savedName || undefined,
      pushname: pushname || undefined,
      isBusiness: current?.isBusiness === true || next.isBusiness === true,
    };
  };

  const getPreferredContactName = (contact: Partial<InboxContactDirectoryEntry> | null | undefined) => {
    return (
      getMeaningfulContactLabel(contact?.savedName) ||
      getMeaningfulContactLabel(contact?.pushname) ||
      getMeaningfulContactLabel(contact?.name) ||
      null
    );
  };

  const getSavedContactNameFromCandidates = useCallback((candidates: Iterable<string>) => {
    for (const candidate of candidates) {
      const savedName = getMeaningfulContactLabel(contactsById.get(candidate)?.savedName);
      if (savedName) {
        return savedName;
      }
    }

    return null;
  }, [contactsById, getMeaningfulContactLabel]);

  const getPushnameFromCandidates = useCallback((candidates: Iterable<string>) => {
    for (const candidate of candidates) {
      const pushname = getMeaningfulContactLabel(contactsById.get(candidate)?.pushname);
      if (pushname) {
        return pushname;
      }
    }

    return null;
  }, [contactsById, getMeaningfulContactLabel]);

  const getMeaningfulDirectChatNameCandidate = useCallback((
    chat: Pick<WhatsAppChat, 'id' | 'phone_number'>,
    value: string | null | undefined,
  ) => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === chat.id) return null;
    if (isPhoneLikeLabel(trimmed)) return null;
    return trimmed;
  }, [isPhoneLikeLabel]);

  const getDirectChatAvatarLookupTarget = (chat: Pick<WhatsAppChat, 'id' | 'is_group' | 'phone_number' | 'lid'>) => {
    const aliases = new Set<string>(getChatIdVariants(chat));
    const lookupIds = new Set<string>();

    const addPhone = (value: string | null | undefined) => {
      const normalized = normalizePhoneNumber(value);
      if (!normalized) return;
      aliases.add(normalized);
      getDirectIdVariantsFromDigits(normalized).forEach((variant) => aliases.add(variant));
      lookupIds.add(normalized);
    };

    addPhone(chat.phone_number);
    addPhone(extractPhoneFromChatId(chat.id));

    const normalizedChatId = normalizeChatId(chat.id);
    if (lookupIds.size === 0 && normalizedChatId && !normalizedChatId.endsWith('@lid')) {
      lookupIds.add(normalizedChatId);
    }

    return {
      lookupIds: Array.from(lookupIds),
      aliases: Array.from(aliases).filter(Boolean),
    };
  };

  const chooseEarlierIsoTimestamp = (primary: string | null | undefined, secondary: string | null | undefined) => {
    const primaryMillis = parseIsoTimestampMillis(primary);
    const secondaryMillis = parseIsoTimestampMillis(secondary);

    if (Number.isNaN(primaryMillis)) return secondary ?? primary ?? new Date().toISOString();
    if (Number.isNaN(secondaryMillis)) return primary ?? secondary ?? new Date().toISOString();
    return primaryMillis <= secondaryMillis ? (primary ?? secondary ?? new Date().toISOString()) : (secondary ?? primary ?? new Date().toISOString());
  };

  const chooseLaterIsoTimestamp = (primary: string | null | undefined, secondary: string | null | undefined) => {
    const primaryMillis = parseIsoTimestampMillis(primary);
    const secondaryMillis = parseIsoTimestampMillis(secondary);

    if (Number.isNaN(primaryMillis)) return secondary ?? primary ?? new Date().toISOString();
    if (Number.isNaN(secondaryMillis)) return primary ?? secondary ?? new Date().toISOString();
    return primaryMillis >= secondaryMillis ? (primary ?? secondary ?? new Date().toISOString()) : (secondary ?? primary ?? new Date().toISOString());
  };

  const mergeRealtimeChatRows = (primaryChat: WhatsAppChat, secondaryChat: WhatsAppChat): WhatsAppChat => {
    const preferredId =
      areEquivalentDirectChats(primaryChat, secondaryChat)
        ? choosePreferredDirectChatId(primaryChat, secondaryChat)
        : primaryChat.id;
    const preferredChat = preferredId === primaryChat.id ? primaryChat : secondaryChat;
    const otherChat = preferredId === primaryChat.id ? secondaryChat : primaryChat;
    const nextPreview = mergeChatPreview(
      preferredChat,
      {
        preview: otherChat.last_message,
        timestamp: otherChat.last_message_at,
        direction: otherChat.last_message_direction ?? null,
      },
      'chat-row',
    );

    return {
      ...otherChat,
      ...preferredChat,
      ...nextPreview,
      id: preferredId,
      name: preferredChat.name ?? otherChat.name ?? null,
      phone_number: preferredChat.phone_number ?? otherChat.phone_number ?? null,
      lid: preferredChat.lid ?? otherChat.lid ?? null,
      created_at: chooseEarlierIsoTimestamp(preferredChat.created_at, otherChat.created_at),
      updated_at: chooseLaterIsoTimestamp(preferredChat.updated_at, otherChat.updated_at),
      unread_count:
        typeof preferredChat.unread_count === 'number'
          ? preferredChat.unread_count
          : typeof otherChat.unread_count === 'number'
            ? otherChat.unread_count
            : 0,
      archived: preferredChat.archived ?? otherChat.archived ?? false,
      pinned: preferredChat.pinned ?? otherChat.pinned ?? null,
      mute_until: preferredChat.mute_until ?? otherChat.mute_until ?? null,
    };
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
    const currentGroupIds = new Set(currentChats.filter((chat) => getChatKind(chat) === 'group').map((chat) => chat.id));

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

    if (currentGroupIds.size === 0) return;

    try {
      const { data: storedGroups, error: storedGroupsError } = await supabase
        .from('whatsapp_groups')
        .select('id, chat_pic, chat_pic_full')
        .in('id', Array.from(currentGroupIds));

      if (storedGroupsError) {
        console.warn('Error loading stored group photos:', storedGroupsError);
      } else if (storedGroups?.length) {
        const storedGroupPhotos = buildGroupPhotoMap(storedGroups);
        if (storedGroupPhotos.size > 0) {
          setGroupPhotosById((prev) => {
            const next = new Map(prev);
            storedGroupPhotos.forEach((url, chatId) => next.set(chatId, url));
            return next;
          });
        }
      }
    } catch (error) {
      console.warn('Error loading stored group photos:', error);
    }

    if (groupIds.size === 0 && !shouldRunFullSync) {
      return;
    }

    if (shouldRunFullSync) {
      lastGroupNamesSyncAtRef.current = now;
    }

    try {
      const namesById = new Map<string, string>();
      const photoUpdates = new Map<string, string>();
      try {
        const pageSize = 100;
        let offset = 0;

        for (let page = 0; page < 20; page += 1) {
          const response = await getWhatsAppGroups(pageSize, offset, false);
          const groups = response.groups || [];

          groups.forEach((group: WhapiGroup) => {
            if (!currentGroupIds.has(group.id)) return;

            const photo = (group.chat_pic_full || group.chat_pic || '').trim();
            if (photo) {
              photoUpdates.set(group.id, photo);
            }

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

      if (photoUpdates.size > 0) {
        setGroupPhotosById((prev) => {
          const next = new Map(prev);
          photoUpdates.forEach((url, chatId) => next.set(chatId, url));
          return next;
        });
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
    const composerElement = composerContainerRef.current;
    if (!composerElement) return;

    const syncComposerHeight = () => {
      const wasNearBottom = getMessagesViewportDistanceFromBottom() <= 40;
      setComposerHeight(composerElement.getBoundingClientRect().height || 96);

      if (composerResizeFrameRef.current !== null) {
        cancelAnimationFrame(composerResizeFrameRef.current);
      }

      composerResizeFrameRef.current = requestAnimationFrame(() => {
        composerResizeFrameRef.current = null;
        if (!wasNearBottom) {
          syncMessagesViewportBottomState();
          syncPendingMessagesBelowCount();
          return;
        }

        scrollToBottom('auto');
        requestAnimationFrame(() => {
          syncMessagesViewportBottomState();
          clearPendingMessagesBelow();
        });
      });
    };

    syncComposerHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncComposerHeight);
      return () => {
        window.removeEventListener('resize', syncComposerHeight);
        if (composerResizeFrameRef.current !== null) {
          cancelAnimationFrame(composerResizeFrameRef.current);
          composerResizeFrameRef.current = null;
        }
      };
    }

    const observer = new ResizeObserver(() => {
      syncComposerHeight();
    });

    observer.observe(composerElement);
    return () => {
      observer.disconnect();
      if (composerResizeFrameRef.current !== null) {
        cancelAnimationFrame(composerResizeFrameRef.current);
        composerResizeFrameRef.current = null;
      }
    };
  }, [selectedChat?.id, replyToMessage, editMessage]);

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
      const previousFocused = isWindowFocusedRef.current;
      if (typeof document === 'undefined') {
        isWindowFocusedRef.current = true;
        if (!previousFocused) {
          setWindowFocusVersion((current) => current + 1);
        }
        return;
      }

      const nextFocused = document.visibilityState === 'visible' && document.hasFocus();
      isWindowFocusedRef.current = nextFocused;

      if (nextFocused && !previousFocused) {
        setWindowFocusVersion((current) => current + 1);
      }
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

  const canAutoMarkSelectedChatRead = useCallback((chat?: WhatsAppChat | null) => {
    if (!userRef.current) return false;
    const activeChat = chat ?? selectedChatRef.current;
    if (!activeChat) return false;

    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return false;
    }

    return isWindowFocusedRef.current;
  }, []);

  const mergeLeadSummaries = useCallback((incomingLeads: InboxLeadSummary[]) => {
    setLeadsList((prev) => {
      const nextById = new Map(prev.map((lead) => [lead.id, lead]));
      incomingLeads.forEach((lead) => {
        if (lead.id) {
          nextById.set(lead.id, lead);
        }
      });
      return Array.from(nextById.values());
    });
  }, []);

  const loadLeadMatchesForChats = useCallback(async (sourceChats: WhatsAppChat[]) => {
    const directChatKeys = Array.from(
      new Set(
        sourceChats.flatMap((chat) => getLeadMatchKeysForChat(chat)).filter(Boolean),
      ),
    );
    const missingKeys = directChatKeys.filter((key) => !loadedLeadMatchKeysRef.current.has(key));
    if (missingKeys.length === 0) {
      return;
    }

    const batchSize = 100;
    const mergedResults: InboxLeadSummary[] = [];

    try {
      for (let index = 0; index < missingKeys.length; index += batchSize) {
        const batch = missingKeys.slice(index, index + batchSize);
        const rows = await searchWhatsAppInboxLeads({ phoneNumbers: batch, limit: 250 });
        mergedResults.push(
          ...rows
            .map((lead) => ({
              id: lead.id,
              name: lead.nome_completo?.trim() || normalizePhoneNumber(lead.telefone) || '',
              phone: normalizePhoneNumber(lead.telefone),
              status: lead.status ?? null,
              responsavel: lead.responsavel_id ?? null,
            }))
            .filter((lead) => Boolean(lead.phone)),
        );
        batch.forEach((key) => loadedLeadMatchKeysRef.current.add(key));
      }

      if (mergedResults.length > 0) {
        mergeLeadSummaries(mergedResults);
      }
    } catch (err) {
      console.error('Error loading lead matches for chats:', err);
    }
  }, [getLeadMatchKeysForChat, mergeLeadSummaries]);

  const loadLeadDirectorySearch = useCallback(async (query: string) => {
    leadDirectoryRequestIdRef.current += 1;
    const requestId = leadDirectoryRequestIdRef.current;

    setIsLoadingLeadDirectory(true);
    try {
      const rows = await searchWhatsAppInboxLeads({ query, limit: query ? 120 : 80 });
      if (leadDirectoryRequestIdRef.current !== requestId) {
        return;
      }

      const nextResults = rows
        .map((lead) => ({
          id: lead.id,
          name: lead.nome_completo?.trim() || normalizePhoneNumber(lead.telefone) || '',
          phone: normalizePhoneNumber(lead.telefone),
          status: lead.status ?? null,
          responsavel: lead.responsavel_id ?? null,
        }))
        .filter((lead) => Boolean(lead.phone));

      setLeadDirectoryResults(nextResults);
      mergeLeadSummaries(nextResults);
    } catch (err) {
      if (leadDirectoryRequestIdRef.current === requestId) {
        console.error('Error loading lead directory search:', err);
      }
    } finally {
      if (leadDirectoryRequestIdRef.current === requestId) {
        setIsLoadingLeadDirectory(false);
      }
    }
  }, [mergeLeadSummaries]);

  useEffect(() => {
    return () => {
      activeDesktopNotificationRef.current?.close();
      if (notificationAudioRef.current) {
        void notificationAudioRef.current.close();
        notificationAudioRef.current = null;
      }
    };
  }, []);

  const loadSavedContacts = useCallback(async () => {
    try {
      const pageSize = 500;
      let offset = 0;
      const loadedContacts: Array<
        Pick<WhapiContact, 'id' | 'name' | 'pushname' | 'saved' | 'is_business' | 'profile_pic' | 'profile_pic_full'>
      > = [];

      while (true) {
        const response = await getWhatsAppContacts(pageSize, offset);
        const batch = Array.isArray(response.contacts) ? response.contacts : [];
        if (batch.length === 0) break;

        loadedContacts.push(...batch);
        offset += batch.length;

        if (batch.length < pageSize) break;
        if (typeof response.total === 'number' && loadedContacts.length >= response.total) break;
      }

      const contactMap = new Map<string, InboxContactDirectoryEntry>();
      const normalizedContacts = loadedContacts.map((contact) => {
        const entry = buildContactDirectoryEntry(contact);
        return {
          id: contact.id,
          ...entry,
          name: entry.name || contact.id,
        };
      });

      setContactsList(normalizedContacts);

      normalizedContacts.forEach((contact) => {
        const displayName = getPreferredContactName(contact) || contact.name || contact.id;
        if (!displayName) return;

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
          contactMap.set(
            variant,
            mergeContactDirectoryEntry(contactMap.get(variant), {
              name: displayName,
              saved: contact.saved,
              savedName: contact.savedName,
              pushname: contact.pushname,
              isBusiness: contact.isBusiness,
            }),
          );
        });
      });

      setContactsById(contactMap);
      setLiveContactPhotosById(buildContactPhotoMap(loadedContacts));
    } catch (err) {
      console.error('Error loading WhatsApp contacts:', err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      if (chatMenu) {
        setChatMenu(null);
        return;
      }

      if (showNewChatModal) {
        setShowNewChatModal(false);
        return;
      }

      if (showConversationInfo) {
        setShowConversationInfo(false);
        return;
      }

      if (isMobileView && selectedChat) {
        setSelectedChat(null);
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [chatMenu, isMobileView, selectedChat, showConversationInfo, showNewChatModal, leadsList.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!chatMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!chatMenuRef.current?.contains(event.target as Node)) {
        closeMuteSubmenuNow();
        closeStatusSubmenuNow();
        setChatMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [chatMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadSavedContacts();
  }, [loadSavedContacts]);

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
    if (chats.length === 0) {
      return;
    }

    void loadLeadMatchesForChats(chats);
  }, [chats, loadLeadMatchesForChats]);

  const deferredLeadDirectorySearch = useDeferredValue(newChatSearch.trim());

  useEffect(() => {
    if (!showNewChatModal || newChatTab !== 'leads') {
      return;
    }

    void loadLeadDirectorySearch(deferredLeadDirectorySearch);
  }, [deferredLeadDirectorySearch, loadLeadDirectorySearch, newChatTab, showNewChatModal]);

  useEffect(() => {
    void loadChats();

    const chatsSubscription = supabase
      .channel('whatsapp_chats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedChatId = (payload.old as { id?: string } | null)?.id;
          if (!deletedChatId) return;
          const deletedChatSnapshot = chatsRef.current.find((chat) => chat.id === deletedChatId) ?? null;
          const replacementChat =
            deletedChatSnapshot && isDirectChat(deletedChatSnapshot)
              ? chatsRef.current.find(
                (chat) => chat.id !== deletedChatId && areEquivalentDirectChats(chat, deletedChatSnapshot),
              ) ?? null
              : null;

          setChats((prev) => prev.filter((chat) => chat.id !== deletedChatId));
          setSelectedChat((current) => {
            if (current?.id !== deletedChatId) {
              return current;
            }

            return replacementChat;
          });
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
          last_message_direction: row.last_message_direction ?? null,
          unread_count: typeof row.unread_count === 'number' ? row.unread_count : undefined,
          archived: row.archived ?? false,
          pinned: typeof row.pinned === 'number' ? row.pinned : 0,
          mute_until: row.mute_until ?? null,
        };
        if (isStatusChat(incomingChat)) {
          setChats((prev) => prev.filter((chat) => chat.id !== incomingChat.id));
          setSelectedChat((current) => (current?.id === incomingChat.id ? null : current));
          return;
        }

        setChats((prev) => {
          const matchingChats = prev.filter((chat) =>
            chat.id === incomingChat.id || areEquivalentDirectChats(chat, incomingChat),
          );
          if (matchingChats.length === 0) {
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

          const mergedChat = matchingChats.reduce(
            (accumulator, chat) => mergeRealtimeChatRows(accumulator, chat),
            incomingChat,
          );
          const matchedIds = new Set(matchingChats.map((chat) => chat.id));
          const next = prev.filter((chat) => !matchedIds.has(chat.id));
          next.unshift({
            ...mergedChat,
            last_message: mergedChat.last_message ?? null,
            last_message_direction: mergedChat.last_message_direction ?? null,
            unread_count: mergedChat.unread_count ?? 0,
          });
          return next.sort(sortChatsByLatest);
        });

        setSelectedChat((current) => {
          if (!current) return current;
          if (current.id !== incomingChat.id && !areEquivalentDirectChats(current, incomingChat)) {
            return current;
          }

          return mergeRealtimeChatRows(current, incomingChat);
        });
      })
      .subscribe();

    const messagesGlobalSubscription = supabase
      .channel('whatsapp_messages_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const eventType = payload.eventType;
        const incomingMessageRaw = (eventType === 'DELETE' ? payload.old : payload.new) as WhatsAppMessage | null;
        const incomingMessage = incomingMessageRaw ? hydrateMessageAudioTranscription(incomingMessageRaw) : null;
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
              if (message.direction === 'inbound' && canAutoMarkSelectedChatRead(currentChat)) {
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

            const messageTimestamp = getMessageDisplayTimestamp(message);
            const nextPreview = preview
              ? mergeChatPreview(
                  chat,
                  {
                    preview,
                    timestamp: messageTimestamp,
                    direction: message.direction ?? null,
                  },
                  'message-event',
                )
              : {
                  last_message: chat.last_message,
                  last_message_direction: chat.last_message_direction ?? null,
                  last_message_at: chat.last_message_at,
                };
            const shouldUnarchive = eventType === 'INSERT' && chat.archived && !isChatMuted(chat);
            return {
              ...chat,
              ...nextPreview,
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
    const previousSelectedChat = previousSelectedChatRef.current;
    previousSelectedChatRef.current = selectedChat;

    if (selectedChat) {
      if (previousSelectedChat && isSameConversation(previousSelectedChat, selectedChat)) {
        setMessagesChatId((currentChatId) => {
          if (!doesMessagesStateMatchChat(currentChatId, selectedChat)) {
            return currentChatId;
          }

          return currentChatId === selectedChat.id ? currentChatId : selectedChat.id;
        });
        return;
      }

      setCopiedPhone(null);
      setShowConversationInfo(false);
      setSelectedLeadInfo(null);
      setReplyToMessage(null);
      setEditMessage(null);
      clearPendingMessagesBelow();
      pendingInitialScrollMessageIdRef.current = null;
      pendingPrependScrollRestoreRef.current = null;
      messagesViewportNearBottomRef.current = true;
      shouldScrollOnChatChangeRef.current = true;
      lastRenderedMessageIdRef.current = null;

      const cachedState = messagesCacheRef.current.get(selectedChat.id);
      setMessagesChatId(selectedChat.id);
      if (cachedState) {
        setMessages(cachedState.messages);
        setLoadedMessagesCount(cachedState.loadedCount);
        setLoadedMessagesQueryOffset(cachedState.queryOffset);
        setHasOlderMessages(cachedState.hasOlder);
      } else {
        setMessages([]);
        setHasOlderMessages(false);
        setLoadedMessagesCount(0);
        setLoadedMessagesQueryOffset(0);
      }

      void loadMessages(selectedChat, { silent: Boolean(cachedState) });
      return;
    }

    setIsLoadingMessages(false);
    setMessagesChatId(null);
    setMessages([]);
    setHasOlderMessages(false);
    setLoadedMessagesCount(0);
    setLoadedMessagesQueryOffset(0);
    clearPendingMessagesBelow();
    pendingPrependScrollRestoreRef.current = null;
    messagesViewportNearBottomRef.current = true;
    lastRenderedMessageIdRef.current = null;
    setReplyToMessage(null);
    setEditMessage(null);
  }, [selectedChat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (windowFocusVersion === 0 || !selectedChat || !doesMessagesStateMatchChat(messagesChatId, selectedChat) || messages.length === 0) {
      return;
    }

    if (!canAutoMarkSelectedChatRead(selectedChat)) {
      return;
    }

    void markChatAsRead(selectedChat, messages).then(() => {
      scheduleUnreadCountsRefresh(50);
    });
  }, [canAutoMarkSelectedChatRead, messages, messagesChatId, selectedChat, windowFocusVersion]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!selectedChat) {
      autoSyncSelectedChatInFlightRef.current = false;
      return;
    }

    const runAutoSync = async () => {
      const activeChat = selectedChatRef.current;
      if (!activeChat) return;
      if (getChatKind(activeChat) !== 'direct') return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (autoSyncSelectedChatInFlightRef.current || syncingChatId) return;

      const lastAutoSyncAt = lastSelectedChatAutoSyncAtRef.current.get(activeChat.id) ?? 0;
      const lastChatActivityAt = Date.parse(activeChat.updated_at ?? activeChat.last_message_at ?? '');
      const freshnessReference = Math.max(
        lastAutoSyncAt,
        Number.isFinite(lastChatActivityAt) ? lastChatActivityAt : 0,
      );

      if (freshnessReference > 0 && Date.now() - freshnessReference < SELECTED_CHAT_AUTO_SYNC_FRESHNESS_MS) {
        return;
      }

      autoSyncSelectedChatInFlightRef.current = true;
      try {
        const { error } = await supabase.functions.invoke('whatsapp-sync', {
          body: { chatId: activeChat.id, count: 120 },
        });

        if (error) {
          throw error;
        }

        lastSelectedChatAutoSyncAtRef.current.set(activeChat.id, Date.now());

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
    }, SELECTED_CHAT_AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      autoSyncSelectedChatInFlightRef.current = false;
    };
  }, [selectedChat?.id, syncingChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const visibleMessages = messages.filter((message) => isDisplayableInboxMessage(message));
    const lastRenderedMessageId = visibleMessages[visibleMessages.length - 1]?.id ?? null;

    if (shouldScrollOnChatChangeRef.current) {
      if (selectedChat && !doesMessagesStateMatchChat(messagesChatId, selectedChat)) {
        return;
      }

      if (selectedChat && visibleMessages.length === 0 && isLoadingMessages) {
        return;
      }

      shouldScrollOnChatChangeRef.current = false;
      clearPendingMessagesBelow();
      lastRenderedMessageIdRef.current = lastRenderedMessageId;
      requestAnimationFrame(() => {
        const targetMessageId =
          pendingInitialScrollMessageIdRef.current ?? getInitialScrollTargetMessageId(selectedChat, messages);
        pendingInitialScrollMessageIdRef.current = null;
        if (targetMessageId && scrollMessageIntoView(targetMessageId, 'auto')) {
          requestAnimationFrame(() => {
            syncMessagesViewportBottomState();
            clearPendingMessagesBelow();
          });
          return;
        }
        scrollToBottom('auto');
      });
      return;
    }

    if (!selectedChat) {
      lastRenderedMessageIdRef.current = null;
      messagesViewportNearBottomRef.current = true;
      clearPendingMessagesBelow();
      return;
    }

    const previousLastRenderedMessageId = lastRenderedMessageIdRef.current;
    const previousLastRenderedMessageIndex = previousLastRenderedMessageId
      ? visibleMessages.findIndex((message) => message.id === previousLastRenderedMessageId)
      : -1;
    const appendedMessages =
      previousLastRenderedMessageIndex >= 0 ? visibleMessages.slice(previousLastRenderedMessageIndex + 1) : [];
    const appendedInboundMessages = appendedMessages.filter((message) => message.direction === 'inbound');
    const isNearBottom = syncMessagesViewportBottomState();

    if (appendedMessages.length > 0 && isNearBottom) {
      clearPendingMessagesBelow();
      requestAnimationFrame(() => {
        scrollToBottom('auto');
        requestAnimationFrame(() => {
          syncMessagesViewportBottomState();
          clearPendingMessagesBelow();
        });
      });
    } else if (appendedInboundMessages.length > 0) {
      appendedInboundMessages.forEach((message) => {
        pendingMessageIdsBelowRef.current.add(message.id);
      });
      syncPendingMessagesBelowCount();
    }

    lastRenderedMessageIdRef.current = lastRenderedMessageId;
  }, [messages, messagesChatId, selectedChat, isLoadingMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const indexedMessages = new Map<string, WhatsAppMessage>();
    messages.forEach((message) => {
      indexedMessages.set(message.id, message);
    });
    messageByIdRef.current = indexedMessages;

    const currentChat = selectedChatRef.current;
    if (!currentChat) return;

    messagesCacheRef.current.set(currentChat.id, createMessagesCacheState({
      messages,
      loadedCount: loadedMessagesCount,
      queryOffset: loadedMessagesQueryOffset,
      hasOlder: hasOlderMessages,
    }));
  }, [createMessagesCacheState, hasOlderMessages, loadedMessagesCount, loadedMessagesQueryOffset, messages]);

  const syncPendingMessagesBelowCount = useCallback(() => {
    const nextSize = pendingMessageIdsBelowRef.current.size;
    setPendingMessagesBelow((current) => (current === nextSize ? current : nextSize));
    return nextSize;
  }, []);

  const clearPendingMessagesBelow = useCallback(() => {
    if (pendingMessageIdsBelowRef.current.size > 0) {
      pendingMessageIdsBelowRef.current.clear();
    }

    setPendingMessagesBelow((current) => (current === 0 ? current : 0));
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    messagesViewportNearBottomRef.current = true;
    const nextScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    viewport.scrollTo({ top: nextScrollTop, behavior });
    setMessagesViewportScrollTop((current) => (current === nextScrollTop ? current : nextScrollTop));
  }, []);

  const getMessagesViewportDistanceFromBottom = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return 0;
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
  }, []);

  const syncMessagesViewportBottomState = useCallback(() => {
    const nearBottom = getMessagesViewportDistanceFromBottom() <= MESSAGES_VIEWPORT_NEAR_BOTTOM_PX;
    messagesViewportNearBottomRef.current = nearBottom;
    return nearBottom;
  }, [getMessagesViewportDistanceFromBottom]);

  useLayoutEffect(() => {
    const pendingRestore = pendingPrependScrollRestoreRef.current;
    const viewport = messagesViewportRef.current;

    if (!pendingRestore || !viewport || messagesChatId !== pendingRestore.chatId) {
      return;
    }

    const nextScrollTop = pendingRestore.previousScrollTop + (viewport.scrollHeight - pendingRestore.previousScrollHeight);
    viewport.scrollTop = Math.max(0, nextScrollTop);
    setMessagesViewportScrollTop((current) => (current === viewport.scrollTop ? current : viewport.scrollTop));
    pendingPrependScrollRestoreRef.current = null;
    if (syncMessagesViewportBottomState()) {
      clearPendingMessagesBelow();
      return;
    }

    syncPendingMessagesBelowCount();
  }, [clearPendingMessagesBelow, messages, messagesChatId, syncMessagesViewportBottomState, syncPendingMessagesBelowCount]);

  useLayoutEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || !messagesViewportNearBottomRef.current) {
      return;
    }

    const nextScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (Math.abs(viewport.scrollTop - nextScrollTop) <= 1) {
      return;
    }

    viewport.scrollTop = nextScrollTop;
    setMessagesViewportScrollTop((current) => (current === nextScrollTop ? current : nextScrollTop));
  }, [messageRowHeightsVersion, selectedChat?.id]);

  const handleMessagesViewportScroll = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport || messagesViewportScrollFrameRef.current !== null) {
      return;
    }

    messagesViewportScrollFrameRef.current = requestAnimationFrame(() => {
      messagesViewportScrollFrameRef.current = null;
      const nextScrollTop = viewport.scrollTop;
      setMessagesViewportScrollTop((current) => (current === nextScrollTop ? current : nextScrollTop));
      if (syncMessagesViewportBottomState()) {
        clearPendingMessagesBelow();
      }
    });
  }, [clearPendingMessagesBelow, syncMessagesViewportBottomState]);

  const scheduleUnreadCountsRefresh = (delayMs: number = UNREAD_COUNTS_REFRESH_DELAY_MS) => {
    if (unreadCountsRefreshTimeoutRef.current !== null) {
      window.clearTimeout(unreadCountsRefreshTimeoutRef.current);
    }

    unreadCountsRefreshTimeoutRef.current = window.setTimeout(() => {
      unreadCountsRefreshTimeoutRef.current = null;
      void loadUnreadCounts();
    }, delayMs);
  };

  const scrollMessageIntoView = (messageId: string, behavior: ScrollBehavior = 'auto') => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return false;

    const targetEntry = messageLayout.byId.get(messageId);
    if (!targetEntry) return false;

    const offsetTop = targetEntry.offsetTop;
    const targetScrollTop = Math.max(0, offsetTop - Math.max(24, viewport.clientHeight * 0.18));
    viewport.scrollTo({ top: targetScrollTop, behavior });
    setMessagesViewportScrollTop((current) => (current === targetScrollTop ? current : targetScrollTop));
    return true;
  };

  const mergeChatsWithCurrentState = (incomingChats: WhatsAppChat[]) => {
    const normalizeChatForDisplay = (chat: WhatsAppChat): WhatsAppChat => ({
      ...chat,
      last_message: sanitizeTechnicalCiphertextPreview(chat.last_message) || null,
      last_message_direction: chat.last_message_direction ?? null,
      unread_count: typeof chat.unread_count === 'number' ? chat.unread_count : 0,
      archived: chat.archived ?? false,
      pinned: chat.pinned ?? 0,
      mute_until: chat.mute_until ?? null,
    });

    const consolidateChatsForDisplay = (items: WhatsAppChat[]) => {
      const consolidated: WhatsAppChat[] = [];

      items.forEach((item) => {
        const chat = normalizeChatForDisplay(item);
        if (isStatusChat(chat)) {
          return;
        }

        const matchingIndex = consolidated.findIndex(
          (existing) => existing.id === chat.id || areEquivalentDirectChats(existing, chat),
        );

        if (matchingIndex === -1) {
          consolidated.push(chat);
          return;
        }

        consolidated[matchingIndex] = normalizeChatForDisplay(mergeRealtimeChatRows(chat, consolidated[matchingIndex]));
      });

      return consolidated.sort(sortChatsByLatest);
    };

    const previousChats = consolidateChatsForDisplay(chatsRef.current);
    const mergedIncoming = incomingChats
      .filter((incoming) => !isStatusChat(incoming))
      .map((incoming) => {
        const normalizedIncoming = normalizeChatForDisplay(incoming);
        const matchingPreviousChats = previousChats.filter(
          (chat) => chat.id === normalizedIncoming.id || areEquivalentDirectChats(chat, normalizedIncoming),
        );

        if (matchingPreviousChats.length === 0) {
          return normalizedIncoming;
        }

        return matchingPreviousChats.reduce(
          (accumulator, previousChat) => normalizeChatForDisplay(mergeRealtimeChatRows(accumulator, previousChat)),
          normalizedIncoming,
        );
      });

    return consolidateChatsForDisplay(mergedIncoming);
  };

  const loadChats = async () => {
    activeChatsLoadIdRef.current += 1;
    const currentLoadId = activeChatsLoadIdRef.current;

    try {
      const loadChatsFromSupabase = async (selectClause: string): Promise<{
        data: WhatsAppChat[] | null;
        error: unknown;
      }> => (supabase
        .from('whatsapp_chats')
        .select(selectClause)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }) as unknown as Promise<{
          data: WhatsAppChat[] | null;
          error: unknown;
        }>);

      let { data, error } = await loadChatsFromSupabase(WHATSAPP_CHAT_SELECT_FIELDS);

      if (isWhatsAppChatsSchemaMismatchError(error)) {
        console.warn('WhatsApp inbox: fallback para select(*) em whatsapp_chats por schema desatualizado.', error);
        ({ data, error } = await loadChatsFromSupabase('*'));
      }

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
            pinned: chat.pinned ?? 0,
            mute_until: muteUntil,
          };
        });
      } else {
        incomingChats = data;
      }

      incomingChats = incomingChats.filter((chat) => !isStatusChat(chat));

      if (activeChatsLoadIdRef.current !== currentLoadId) {
        return;
      }

      const mergedChats = mergeChatsWithCurrentState(incomingChats);
      setChats(mergedChats);
      setSelectedChat((current) => {
        if (!current || isStatusChat(current)) {
          return null;
        }

        return mergedChats.find((chat) => chat.id === current.id || areEquivalentDirectChats(chat, current)) ?? current;
      });

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
    const cachedState = messagesCacheRef.current.get(chat.id);
    const previousLoadedCount = cachedState?.loadedCount ?? 0;
    const previousQueryOffset = cachedState?.queryOffset ?? 0;
    const previousHasOlder = cachedState?.hasOlder ?? false;

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

      const fetchedMessages = ((data || []) as WhatsAppMessage[])
        .map(hydrateMessageAudioTranscription)
        .filter((item) => !isTechnicalCiphertextMessage(item));
      const fetchedRowCount = (data || []).length;
      const baseMessages = dedupeMessagesForDisplay(fetchedMessages as WhatsAppMessage[]);
      const nextLoadedCount = silent ? Math.max(previousLoadedCount, baseMessages.length) : baseMessages.length;
      const nextQueryOffset = silent ? Math.max(previousQueryOffset, fetchedRowCount) : fetchedRowCount;
      const nextHasOlder = silent ? previousHasOlder || fetchedRowCount === MESSAGES_PAGE_SIZE : fetchedRowCount === MESSAGES_PAGE_SIZE;
      setMessages((prev) => {
        const mergedMessages = dedupeMessagesForDisplay([...prev, ...baseMessages]);
        messagesCacheRef.current.set(chat.id, createMessagesCacheState({
          messages: mergedMessages,
          loadedCount: nextLoadedCount,
          queryOffset: nextQueryOffset,
          hasOlder: nextHasOlder,
        }));
        return mergedMessages;
      });
      setLoadedMessagesCount(nextLoadedCount);
      setLoadedMessagesQueryOffset(nextQueryOffset);
      setHasOlderMessages(nextHasOlder);
      pendingInitialScrollMessageIdRef.current = null;

      if (canAutoMarkSelectedChatRead(chat)) {
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
        .range(loadedMessagesQueryOffset, loadedMessagesQueryOffset + MESSAGES_PAGE_SIZE - 1);

      if (error) throw error;

      const stillActiveLoad =
        activeMessagesLoadIdRef.current === currentLoadId && selectedChatRef.current?.id === currentChatId;
      if (!stillActiveLoad) {
        return;
      }

      const fetchedRowCount = (data || []).length;
      const olderMessages = dedupeMessagesForDisplay(
        ((data || []) as WhatsAppMessage[])
          .map(hydrateMessageAudioTranscription)
          .filter((item) => !isTechnicalCiphertextMessage(item)),
      );
      const nextHasOlder = fetchedRowCount === MESSAGES_PAGE_SIZE;
      const nextQueryOffset = loadedMessagesQueryOffset + fetchedRowCount;
      const existingIds = new Set(messages.map((item) => item.id));
      const dedupedOlderMessages = olderMessages.filter((item) => !existingIds.has(item.id));
      const nextLoadedCount = loadedMessagesCount + dedupedOlderMessages.length;
      const viewport = messagesViewportRef.current;
      const previousScrollMetrics = viewport
        ? {
            chatId: currentChatId,
            previousScrollHeight: viewport.scrollHeight,
            previousScrollTop: viewport.scrollTop,
          }
        : null;

      setMessages((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const deduped = olderMessages.filter((item) => !existingIds.has(item.id));
        if (deduped.length === 0) {
          messagesCacheRef.current.set(currentChatId, createMessagesCacheState({
            messages: prev,
            loadedCount: loadedMessagesCount,
            queryOffset: nextQueryOffset,
            hasOlder: nextHasOlder,
          }));
          return prev;
        }

        pendingPrependScrollRestoreRef.current = previousScrollMetrics;

        const nextMessages = dedupeMessagesForDisplay([...deduped, ...prev]);
        messagesCacheRef.current.set(currentChatId, createMessagesCacheState({
          messages: nextMessages,
          loadedCount: nextMessages.length,
          queryOffset: nextQueryOffset,
          hasOlder: nextHasOlder,
        }));
        return nextMessages;
      });

      setLoadedMessagesCount(nextLoadedCount);
      setLoadedMessagesQueryOffset(nextQueryOffset);
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

    setSelectedChat((current) => {
      if (!current) return current;
      const unreadCount = getChatIdVariants(current).reduce((total, variant) => total + (countsMap.get(variant) ?? 0), 0);
      return (current.unread_count ?? 0) === unreadCount
        ? current
        : {
            ...current,
            unread_count: unreadCount,
          };
    });
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

    setSelectedChat((current) => {
      if (!current) return current;
      const currentVariants = getChatIdVariants(current);
      return currentVariants.some((variant) => chatIds.includes(variant))
        ? {
            ...current,
            unread_count: 0,
          }
        : current;
    });
  };

  const markMessagesRead = async (messagesToMark: WhatsAppMessage[]) => {
    const activeUser = userRef.current;
    if (!activeUser) return;
    const unreadInbound = messagesToMark.filter((message) => message.direction === 'inbound');
    if (unreadInbound.length === 0) return;

    const latestCursorByChat = new Map<string, {
      chat_id: string;
      last_read_at: string;
      last_read_message_id: string;
    }>();

    unreadInbound.forEach((message) => {
      const chatId = message.chat_id?.trim();
      if (!chatId) return;

      const lastReadAt = getMessageDisplayTimestamp(message) ?? new Date().toISOString();
      const existing = latestCursorByChat.get(chatId);
      const existingTime = existing ? Date.parse(existing.last_read_at) : Number.NEGATIVE_INFINITY;
      const nextTime = Date.parse(lastReadAt);

      if (!existing || nextTime >= existingTime) {
        latestCursorByChat.set(chatId, {
          chat_id: chatId,
          last_read_at: lastReadAt,
          last_read_message_id: message.id,
        });
      }
    });

    let usedLegacyFallback = latestCursorByChat.size === 0;

    if (!usedLegacyFallback) {
      const cursorResponse = await supabase.rpc('advance_whatsapp_chat_read_cursor', {
        current_user_id: activeUser.id,
        chat_reads: Array.from(latestCursorByChat.values()),
      });

      if (cursorResponse.error) {
        if (cursorResponse.error.code !== 'PGRST202') {
          console.error('Error advancing chat read cursor:', cursorResponse.error);
        }
        usedLegacyFallback = true;
      }
    }

    if (usedLegacyFallback) {
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

    setSelectedChat((current) => {
      if (!current) return current;
      const variants = getChatIdVariants(current);
      const matches = unreadInbound.filter((message) => variants.includes(message.chat_id)).length;
      if (!matches) return current;
      return {
        ...current,
        unread_count: Math.max(0, (current.unread_count ?? 0) - matches),
      };
    });
  };

  const handleReply = (messageId: string, body: string, from: string) => {
    setEditMessage(null);
    setReplyToMessage({ id: messageId, body, from });
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleEdit = (messageId: string, body: string) => {
    const targetMessage = messageByIdRef.current.get(messageId);
    if (!targetMessage) {
      toast.error('Não foi possível localizar a mensagem para editar.');
      return;
    }

    if (targetMessage.send_state === 'pending' || targetMessage.send_state === 'failed' || targetMessage.id.startsWith('local-')) {
      toast.warning('Aguarde a mensagem ser confirmada antes de editar.');
      return;
    }

    setReplyToMessage(null);
    setEditMessage({ id: messageId, body, chatId: targetMessage.chat_id });
  };

  const handleCancelEdit = () => {
    setEditMessage(null);
  };

  const handleMessageEdited = ({
    messageId,
    chatId,
    body,
    editedAt,
  }: {
    messageId: string;
    chatId: string;
    body: string;
    editedAt: string;
  }) => {
    patchMessageById(chatId, messageId, (current) => {
      const payloadData = asMessagePayload(current.payload);
      const nextText = payloadData?.text && typeof payloadData.text === 'object'
        ? { ...(payloadData.text as Record<string, unknown>), body }
        : { body };

      return {
        ...current,
        body,
        edit_count: Math.max((current.edit_count ?? 0) + 1, 1),
        edited_at: editedAt,
        original_body: current.original_body ?? current.body ?? null,
        payload: {
          ...payloadData,
          text: nextText,
          edited_at: editedAt,
        },
      };
    });

    const activeChat = selectedChatRef.current;
    if (activeChat && getChatIdVariants(activeChat).includes(chatId)) {
      const currentMessages = messages;
      const nextMessages = currentMessages.map((message) => {
        if (message.id !== messageId) return message;

        const payloadData = asMessagePayload(message.payload);
        const nextText = payloadData?.text && typeof payloadData.text === 'object'
          ? { ...(payloadData.text as Record<string, unknown>), body }
          : { body };

        return {
          ...message,
          body,
          edit_count: Math.max((message.edit_count ?? 0) + 1, 1),
          edited_at: editedAt,
          original_body: message.original_body ?? message.body ?? null,
          payload: {
            ...payloadData,
            text: nextText,
            edited_at: editedAt,
          },
        };
      });

      const latestDisplayable = [...nextMessages]
        .filter((message) => isDisplayableInboxMessage(message))
        .sort(sortMessagesChronologically)
        .slice(-1)[0];

      if (latestDisplayable?.id === messageId) {
        const preview = getMessagePreview(latestDisplayable);
        if (preview) {
          setChats((prev) =>
            prev.map((chat) =>
              getChatIdVariants(chat).includes(chatId)
                ? {
                    ...chat,
                    last_message: preview,
                    last_message_direction: latestDisplayable.direction ?? chat.last_message_direction ?? null,
                    last_message_at: latestDisplayable.timestamp ?? chat.last_message_at,
                  }
                : chat,
            ),
          );
        }
      }
    }
  };

  const resetForwardModalState = () => {
    setForwardMessage(null);
    setForwardSearch('');
    setForwardTargetChatIds([]);
  };

  const closeForwardModal = useCallback(() => {
    if (isForwardingMessage) return;
    resetForwardModalState();
  }, [isForwardingMessage]);

  const handleOpenForwardModal = (message: WhatsAppMessage) => {
    if (!buildForwardMessagePlan(message)) {
      toast.warning('Esse tipo de mensagem ainda não pode ser encaminhado.');
      return;
    }

    setForwardMessage(message);
    setForwardSearch('');
    setForwardTargetChatIds([]);
  };

  const toggleForwardTargetChat = (chatId: string) => {
    setForwardTargetChatIds((current) =>
      current.includes(chatId) ? current.filter((item) => item !== chatId) : [...current, chatId],
    );
  };

  const handleConfirmForwardMessage = async () => {
    if (!forwardMessage || forwardTargetChatIds.length === 0 || isForwardingMessage) return;

    setIsForwardingMessage(true);

    let successCount = 0;
    let failureCount = 0;
    let lastSuccessfulChatId: string | null = null;
    let lastErrorMessage = 'Não foi possível encaminhar a mensagem.';

    try {
      for (const targetChatId of Array.from(new Set(forwardTargetChatIds))) {
        try {
          lastSuccessfulChatId = await forwardMessageToChat(forwardMessage, targetChatId);
          successCount += 1;
        } catch (error) {
          failureCount += 1;
          lastErrorMessage = error instanceof Error ? error.message : lastErrorMessage;
          console.error('Erro ao encaminhar mensagem:', error);
        }
      }
    } finally {
      setIsForwardingMessage(false);
    }

    if (successCount === 0) {
      toast.error(lastErrorMessage);
      return;
    }

    resetForwardModalState();

    if (successCount === 1 && failureCount === 0) {
      toast.success('Mensagem encaminhada.');
    } else if (failureCount === 0) {
      toast.success(`Mensagem encaminhada para ${successCount} conversa(s).`);
    } else {
      toast.warning(`Encaminhada para ${successCount} conversa(s) e ${failureCount} falha(s).`);
    }

    if (successCount === 1 && failureCount === 0 && lastSuccessfulChatId) {
      const targetChat = chatsRef.current.find((chat) => getChatIdVariants(chat).includes(lastSuccessfulChatId));
      if (targetChat) {
        selectChat(targetChat);
      }
    }
  };

  const patchMessageById = (
    chatId: string,
    messageId: string,
    updater: (message: WhatsAppMessage) => WhatsAppMessage | null,
  ) => {
    const apply = (items: WhatsAppMessage[]) =>
      items
        .flatMap((message) => {
          if (message.id !== messageId) return [message];
          const next = updater(message);
          return next ? [next] : [];
        })
        .sort(sortMessagesChronologically);

    if (selectedChatRef.current && getChatIdVariants(selectedChatRef.current).includes(chatId)) {
      setMessages((prev) => apply(prev));
    }

    const targetChat = chatsRef.current.find((chat) => getChatIdVariants(chat).includes(chatId));
    const cacheKey = targetChat?.id || chatId;
    const cachedState = messagesCacheRef.current.get(cacheKey);
    if (cachedState) {
      messagesCacheRef.current.set(cacheKey, createMessagesCacheState({
        ...cachedState,
        messages: apply(cachedState.messages),
      }));
    }
  };

  const removeFailedMessage = (chatId: string, messageId: string) => {
    patchMessageById(chatId, messageId, () => null);
  };

  const retryFailedMessage = async (message: WhatsAppMessage) => {
    if (!message.retry_payload) return;

    patchMessageById(message.chat_id, message.id, (current) => ({
      ...current,
      ack_status: 1,
      send_state: 'pending',
      error_message: null,
    }));

    try {
      let response: unknown;
      let body = message.body || '';
      let type = message.type || 'text';
      let hasMedia = message.has_media;

      switch (message.retry_payload.kind) {
        case 'text':
          response = await sendWhatsAppMessage({
            chatId: message.chat_id,
            contentType: 'string',
            content: message.retry_payload.content,
            quotedMessageId: message.retry_payload.quotedMessageId || undefined,
          });
          body = message.retry_payload.content;
          type = 'text';
          hasMedia = false;
          break;
        case 'link_preview':
          response = await sendWhatsAppMessage({
            chatId: message.chat_id,
            contentType: 'LinkPreview',
            content: {
              body: message.retry_payload.body,
              title: message.retry_payload.title,
              description: message.retry_payload.description,
              canonical: message.retry_payload.canonical,
              preview: message.retry_payload.preview,
            },
            quotedMessageId: message.retry_payload.quotedMessageId || undefined,
          });
          body = message.retry_payload.body;
          type = 'link_preview';
          hasMedia = true;
          break;
        case 'gif':
          response = await sendWhatsAppMessage({
            chatId: message.chat_id,
            contentType: 'gif',
            content: {
              url: message.retry_payload.url,
              mimetype: 'video/mp4',
              preview: message.retry_payload.preview,
              caption: message.retry_payload.caption,
              autoplay: true,
            },
            quotedMessageId: message.retry_payload.quotedMessageId || undefined,
          });
          body = message.retry_payload.caption || message.body || '[GIF]';
          type = 'gif';
          hasMedia = true;
          break;
        case 'media': {
          const mediaFile = await dataUrlToFile(
            message.retry_payload.dataUrl,
            message.retry_payload.fileName,
            message.retry_payload.mimeType,
          );
          response = await sendMediaMessage(message.chat_id, mediaFile, {
            caption: message.retry_payload.caption,
            quotedMessageId: message.retry_payload.quotedMessageId || undefined,
            asVoice: message.retry_payload.asVoice,
            seconds: message.retry_payload.seconds || undefined,
            recordingTime: message.retry_payload.recordingTime || undefined,
          });
          body = message.retry_payload.caption || message.body || '[Arquivo]';
          type = message.retry_payload.mediaType;
          hasMedia = true;
          break;
        }
        case 'location':
          response = await sendWhatsAppMessage({
            chatId: message.chat_id,
            contentType: 'Location',
            content: {
              latitude: message.retry_payload.latitude,
              longitude: message.retry_payload.longitude,
              description: message.retry_payload.description,
            },
          });
          body = message.body || '[Localização]';
          type = 'location';
          hasMedia = true;
          break;
        case 'contact':
          response = await sendWhatsAppMessage({
            chatId: message.chat_id,
            contentType: 'Contact',
            content: {
              name: message.retry_payload.name,
              vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${message.retry_payload.name}\nTEL;type=CELL;type=VOICE;waid=${message.retry_payload.phone}:${message.retry_payload.phone}\nEND:VCARD`,
            },
            quotedMessageId: message.retry_payload.quotedMessageId || undefined,
          });
          body = message.body || `[Contato: ${message.retry_payload.name}]`;
          type = 'contact';
          hasMedia = false;
          break;
        default:
          return;
      }

      const sentAt = new Date().toISOString();
      const persisted = await persistOutboundMessage({
        response,
        chatId: message.chat_id,
        type,
        body,
        hasMedia,
        sentAt,
      });

      handleMessageSent(buildOutboundSentMessagePayload({
        id: persisted.messageId,
        localRef: message.local_ref || message.id,
        chatId: persisted.normalizedChatId,
        body,
        type,
        hasMedia,
        sentAt,
        payload: persisted.storedPayload,
        ackStatus: 2,
        sendState: null,
        errorMessage: null,
        retryPayload: null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao reenviar mensagem';
      patchMessageById(message.chat_id, message.id, (current) => ({
        ...current,
        ack_status: 0,
        send_state: 'failed',
        error_message: errorMessage,
      }));
    }
  };

  const handleMessageSent = (message?: SentMessagePayload) => {
    if (message) {
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
        local_ref: message.local_ref,
        send_state: message.send_state,
        error_message: message.error_message,
        retry_payload: message.retry_payload,
      };
      const targetChat = chatsRef.current.find((chat) => getChatIdVariants(chat).includes(message.chat_id)) ?? null;
      const targetChatId = targetChat?.id || message.chat_id;
      const selectedChatMatchesMessage = Boolean(
        selectedChatRef.current && getChatIdVariants(selectedChatRef.current).includes(message.chat_id),
      );

      const mergeIntoMessageList = (currentMessages: WhatsAppMessage[]) => mergeSentMessageIntoList(currentMessages, nextMessage);

      if (selectedChatMatchesMessage) {
        setMessages((prev) => mergeIntoMessageList(prev));
      }

      const cachedState = messagesCacheRef.current.get(targetChatId);
      const nextCachedMessages = mergeIntoMessageList(cachedState?.messages || []);
      messagesCacheRef.current.set(targetChatId, createMessagesCacheState({
        messages: nextCachedMessages,
        loadedCount:
          cachedState?.loadedCount ?? (selectedChatMatchesMessage ? loadedMessagesCount : nextCachedMessages.length),
        queryOffset: cachedState?.queryOffset ?? (selectedChatMatchesMessage ? loadedMessagesQueryOffset : 0),
        hasOlder: cachedState?.hasOlder ?? (selectedChatMatchesMessage ? hasOlderMessages : false),
      }));

      setChats((prev) => {
        const preview = getMessagePreview(nextMessage);
        const updated = prev.map((chat) => {
          const variants = getChatIdVariants(chat);
          if (!variants.includes(message.chat_id)) return chat;
          const nextPreview = preview
            ? mergeChatPreview(
                chat,
                {
                  preview,
                  timestamp,
                  direction: nextMessage.direction ?? null,
                },
                'local-message',
              )
            : {
                last_message: chat.last_message,
                last_message_direction: chat.last_message_direction ?? null,
                last_message_at: chat.last_message_at,
              };
          return {
            ...chat,
            ...nextPreview,
          };
        });

        return updated.sort(sortChatsByLatest);
      });

      const chatToUpdate = targetChat;
      if (chatToUpdate?.archived && !isChatMuted(chatToUpdate)) {
        updateChatArchive(chatToUpdate.id, false);
      }

      scheduleUnreadCountsRefresh();
      return;
    }

    if (selectedChatRef.current) {
      loadMessages(selectedChatRef.current);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      const targetMessage = messageByIdRef.current.get(messageId);
      const targetChatId = targetMessage?.chat_id ?? selectedChatRef.current?.id ?? '';
      const existingEmoji = myReactionsByMessage.get(messageId);
      if (existingEmoji === emoji) {
        await removeReactionFromMessage(messageId);
        setMyReactionsByMessage((prev) => {
          const next = new Map(prev);
          next.delete(messageId);
          return next;
        });
        if (targetChatId) {
          patchMessageById(targetChatId, messageId, (message) => {
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
          });
        }
        return;
      }

      await reactToMessage(messageId, emoji);
      setMyReactionsByMessage((prev) => new Map(prev).set(messageId, emoji));
      if (targetChatId) {
        patchMessageById(targetChatId, messageId, (message) => {
          const payloadData = asMessagePayload(message.payload);
          const reactions = Array.isArray(payloadData.reactions) ? payloadData.reactions : [];
          const reactionMap = new Map<string, number>();

          reactions.forEach((item: WhatsAppMessageReaction) => {
            const normalizedCount = Math.max(0, item.count ?? 0);
            const reactionEmoji = typeof item.emoji === 'string' ? item.emoji : '';
            if (normalizedCount > 0 && reactionEmoji) {
              reactionMap.set(reactionEmoji, normalizedCount);
            }
          });

          if (existingEmoji) {
            const previousCount = Math.max(0, reactionMap.get(existingEmoji) ?? 0);
            if (previousCount <= 1) {
              reactionMap.delete(existingEmoji);
            } else {
              reactionMap.set(existingEmoji, previousCount - 1);
            }
          }

          reactionMap.set(emoji, Math.max(0, reactionMap.get(emoji) ?? 0) + 1);

          const nextReactions = Array.from(reactionMap.entries()).map(([reactionEmoji, count]) => ({
            emoji: reactionEmoji,
            count,
          }));

          return {
            ...message,
            payload: { ...payloadData, reactions: nextReactions },
          };
        });
      }
    } catch (error) {
      console.error('Erro ao reagir mensagem:', error);
    }
  };

  const handleSyncFromWhapi = async () => {
    if (!selectedChat || syncingChatId === selectedChat.id) return;

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

  const formatTime = useCallback((timestamp: string | null) => {
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
  }, []);

  const formatPhone = formatWhatsAppPhoneDisplay;

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

  const isHiddenTechnicalAction = (message: Pick<WhatsAppMessage, 'payload' | 'type'>) =>
    isHiddenTechnicalActionMessage(message);

  const isDisplayableInboxMessage = (message: Pick<WhatsAppMessage, 'payload' | 'type' | 'body'>) => {
    if (isReactionOnlyMessage(message)) return false;
    if (isEditActionMessage(message)) return false;
    if (isHiddenTechnicalAction(message)) return false;
    if (isTechnicalCiphertextMessage(message)) return false;
    return true;
  };

  const getInitialScrollTargetMessageId = (
    chat: Pick<WhatsAppChat, 'unread_count'> | null,
    items: WhatsAppMessage[],
  ) => {
    const unreadCount = Math.max(0, chat?.unread_count ?? 0);
    if (unreadCount <= 0 || items.length === 0) return null;

    let remainingUnread = unreadCount;
    let firstUnreadIndex = -1;

    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (items[index].direction !== 'inbound') continue;

      remainingUnread -= 1;
      if (remainingUnread <= 0) {
        firstUnreadIndex = index;
        break;
      }
    }

    if (firstUnreadIndex < 0) {
      return items.find((message) => isDisplayableInboxMessage(message))?.id ?? null;
    }

    for (let index = firstUnreadIndex - 1; index >= 0; index -= 1) {
      if (isDisplayableInboxMessage(items[index])) {
        return items[index].id;
      }
    }

    for (let index = firstUnreadIndex; index < items.length; index += 1) {
      if (isDisplayableInboxMessage(items[index])) {
        return items[index].id;
      }
    }

    return null;
  };

  const getMessagePreview = (
    message: Pick<WhatsAppMessage, 'body' | 'type' | 'has_media' | 'payload' | 'is_deleted'>,
  ) => {
    if (message.is_deleted) return 'Mensagem apagada';
    if (isEditActionMessage(message)) return null;
    if (isReactionOnlyMessage(message)) return null;
    if (isHiddenTechnicalAction(message)) return null;
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
    if (type === 'sticker') return '[Sticker]';
    if (type === 'gif') return '[GIF]';
    if (type === 'image') return '[Imagem]';
    if (type === 'video') return '[Vídeo]';
    if (['audio', 'voice', 'ptt'].includes(type)) return '[Áudio]';
    if (type === 'document') return '[Documento]';
    if (type === 'contact') return '[Contato]';
    if (type === 'location') return '[Localização]';
    if (message.has_media) return '[Anexo]';
    return 'Mensagem';
  };

  const forwardCaptionPlaceholders = new Set([
    '[sticker]',
    '[imagem]',
    '[imagem de status]',
    '[video]',
    '[vídeo]',
    '[vídeo de status]',
    '[áudio]',
    '[audio]',
    '[mensagem de voz]',
    '[documento]',
    '[arquivo]',
    '[anexo]',
    '[contato]',
    '[localização]',
    '[localizacao]',
    '[link]',
  ]);

  const resolveForwardCaption = (
    message: Pick<WhatsAppMessage, 'body' | 'type' | 'has_media' | 'payload' | 'is_deleted'>,
  ) => {
    const preview = getMessagePreview(message);
    if (!preview) return null;

    return forwardCaptionPlaceholders.has(normalizeSearchText(preview)) ? null : preview;
  };

  const buildForwardMediaPlan = (
    message: Pick<WhatsAppMessage, 'body' | 'type' | 'has_media' | 'payload' | 'is_deleted'>,
    type: Extract<ForwardMessagePlan, { kind: 'media' }>['type'],
    primary: Record<string, unknown> | null,
    fallback: Record<string, unknown> | null,
    options?: {
      body?: string;
      caption?: string | null;
      asVoice?: boolean;
    },
  ): Extract<ForwardMessagePlan, { kind: 'media' }> | null => {
    const mediaId = getFirstTrimmedString(
      primary?.id,
      primary?.media_id,
      primary?.mediaId,
      fallback?.id,
      fallback?.media_id,
      fallback?.mediaId,
    );
    const url = getFirstTrimmedString(
      primary?.link,
      primary?.url,
      primary?.file,
      primary?.path,
      fallback?.link,
      fallback?.url,
      fallback?.file,
      fallback?.path,
    );

    if (!mediaId && !url) {
      return null;
    }

    const defaultFileNameByType: Record<Extract<ForwardMessagePlan, { kind: 'media' }>['type'], string> = {
      image: 'imagem.jpg',
      video: 'video.mp4',
      sticker: 'sticker.webp',
      document: 'documento',
      audio: 'audio.ogg',
      voice: 'voice.ogg',
    };

    const defaultMimeTypeByType: Record<Extract<ForwardMessagePlan, { kind: 'media' }>['type'], string> = {
      image: 'image/jpeg',
      video: 'video/mp4',
      sticker: 'image/webp',
      document: 'application/octet-stream',
      audio: 'audio/ogg',
      voice: 'audio/ogg',
    };

    return {
      kind: 'media',
      type,
      body: options?.body || getMessagePreview(message) || 'Mensagem',
      hasMedia: true,
      caption: options?.caption || undefined,
      mediaId: mediaId || undefined,
      url: url || undefined,
      fileName:
        getFirstTrimmedString(primary?.filename, primary?.name, fallback?.filename, fallback?.name) ||
        defaultFileNameByType[type],
      mimeType:
        getFirstTrimmedString(primary?.mime_type, primary?.mimetype, fallback?.mime_type, fallback?.mimetype) ||
        defaultMimeTypeByType[type],
      seconds: getFiniteNumber(primary?.seconds) ?? getFiniteNumber(fallback?.seconds) ?? undefined,
      recordingTime:
        getFiniteNumber(primary?.recording_time) ??
        getFiniteNumber(primary?.recordingTime) ??
        getFiniteNumber(fallback?.recording_time) ??
        getFiniteNumber(fallback?.recordingTime) ??
        undefined,
      asVoice: options?.asVoice,
    };
  };

  const buildForwardMessagePlan = (
    message: Pick<WhatsAppMessage, 'body' | 'type' | 'has_media' | 'payload' | 'is_deleted'>,
  ): ForwardMessagePlan | null => {
    if (message.is_deleted) return null;
    if (isEditActionMessage(message)) return null;
    if (isReactionOnlyMessage(message)) return null;
    if (isHiddenTechnicalAction(message)) return null;
    if (isTechnicalCiphertextMessage(message)) return null;

    const payloadData = asMessagePayload(message.payload);
    const normalizedType = String(message.type || '').trim().toLowerCase();
    const resolvedBody =
      resolveWhatsAppMessageBody({
        body: message.body,
        type: message.type,
        payload: message.payload,
      })?.trim() || '';
    const mediaPayload = asPayloadRecord(payloadData.media);

    const linkPreviewPayload = asPayloadRecord(payloadData.link_preview);
    if (normalizedType === 'link_preview' || linkPreviewPayload) {
      const canonical = getFirstTrimmedString(
        linkPreviewPayload?.url,
        linkPreviewPayload?.canonical,
        linkPreviewPayload?.link,
      );
      const title = getFirstTrimmedString(linkPreviewPayload?.title) || canonical;
      if (!canonical || !title) return null;

      return {
        kind: 'link_preview',
        type: 'link_preview',
        body: resolvedBody || canonical,
        hasMedia: true,
        title,
        description: getFirstTrimmedString(linkPreviewPayload?.description) || undefined,
        canonical,
        preview: getFirstTrimmedString(
          linkPreviewPayload?.preview,
          linkPreviewPayload?.image,
          linkPreviewPayload?.thumbnail,
        ) || undefined,
      };
    }

    const contactPayload = asPayloadRecord(payloadData.contact);
    if (normalizedType === 'contact' || contactPayload) {
      const contactName = getFirstTrimmedString(contactPayload?.name, message.body) || 'Contato';
      const phone = (getFirstTrimmedString(contactPayload?.phone) || '').replace(/\D/g, '');
      const vcard = getFirstTrimmedString(contactPayload?.vcard) || (phone ? buildContactVcard(contactName, phone) : null);
      if (!vcard) return null;

      return {
        kind: 'contact',
        type: 'contact',
        body: `[Contato: ${contactName}]`,
        hasMedia: false,
        name: contactName,
        vcard,
      };
    }

    const locationPayload = asPayloadRecord(payloadData.location);
    if (normalizedType === 'location' || locationPayload) {
      const latitude = getFiniteNumber(locationPayload?.latitude);
      const longitude = getFiniteNumber(locationPayload?.longitude);
      if (latitude === null || longitude === null) return null;

      return {
        kind: 'location',
        type: 'location',
        body: getMessagePreview(message) || '[Localização]',
        hasMedia: true,
        latitude,
        longitude,
        description: getFirstTrimmedString(locationPayload?.address, message.body) || undefined,
      };
    }

    const stickerPayload = asPayloadRecord(payloadData.sticker);
    if (normalizedType === 'sticker' || stickerPayload) {
      return buildForwardMediaPlan(message, 'sticker', stickerPayload, mediaPayload, {
        body: '[Sticker]',
      });
    }

    const imagePayload = asPayloadRecord(payloadData.image);
    if (normalizedType === 'image' || imagePayload) {
      return buildForwardMediaPlan(message, 'image', imagePayload, mediaPayload, {
        caption: resolveForwardCaption(message),
      });
    }

    const videoPayload = asPayloadRecord(payloadData.video);
    if (['video', 'short', 'gif'].includes(normalizedType) || videoPayload) {
      return buildForwardMediaPlan(message, 'video', videoPayload, mediaPayload, {
        caption: resolveForwardCaption(message),
      });
    }

    const voicePayload = asPayloadRecord(payloadData.voice);
    if (normalizedType === 'voice' || voicePayload) {
      return buildForwardMediaPlan(message, 'voice', voicePayload, mediaPayload, {
        body: '[Mensagem de voz]',
        asVoice: true,
      });
    }

    const audioPayload = asPayloadRecord(payloadData.audio);
    if (['audio', 'ptt'].includes(normalizedType) || audioPayload) {
      return buildForwardMediaPlan(message, 'audio', audioPayload, mediaPayload, {
        body: '[Áudio]',
      });
    }

    const documentPayload = asPayloadRecord(payloadData.document);
    if (normalizedType === 'document' || documentPayload || (message.has_media && mediaPayload)) {
      return buildForwardMediaPlan(message, 'document', documentPayload || mediaPayload, mediaPayload, {
        caption: resolveForwardCaption(message),
      });
    }

    const textBody = resolvedBody || getFirstTrimmedString(message.body);
    if (!textBody) return null;

    return {
      kind: 'text',
      type: 'text',
      body: textBody,
      hasMedia: false,
    };
  };

  const createForwardMediaFile = async (plan: Extract<ForwardMessagePlan, { kind: 'media' }>) => {
    let blob: Blob | null = null;
    let mimeType = plan.mimeType || 'application/octet-stream';
    let fileName = plan.fileName;

    if (plan.mediaId) {
      const mediaResponse = await getWhatsAppMedia(plan.mediaId);
      blob = mediaResponse.data || null;
      fileName = mediaResponse.fileName || fileName;
      mimeType = mediaResponse.mimeType || blob?.type || mimeType;

      const mediaUrl = mediaResponse.url || mediaResponse.objectUrl || plan.url || null;
      if (!blob && mediaUrl) {
        const response = await fetch(mediaUrl);
        if (!response.ok) {
          throw new Error('Não foi possível baixar a mídia para encaminhar.');
        }
        blob = await response.blob();
      }
    } else if (plan.url) {
      const response = await fetch(plan.url);
      if (!response.ok) {
        throw new Error('Não foi possível baixar a mídia para encaminhar.');
      }
      blob = await response.blob();
      mimeType = blob.type || mimeType;
    }

    if (!blob) {
      throw new Error('Não foi possível carregar a mídia para encaminhar.');
    }

    return new File([blob], fileName, {
      type: blob.type || mimeType,
      lastModified: Date.now(),
    });
  };

  const forwardMessageToChat = async (
    message: Pick<WhatsAppMessage, 'body' | 'type' | 'has_media' | 'payload' | 'is_deleted'>,
    targetChatId: string,
  ) => {
    const plan = buildForwardMessagePlan(message);
    if (!plan) {
      throw new Error('Este tipo de mensagem ainda não pode ser encaminhado.');
    }

    let response: unknown;
    switch (plan.kind) {
      case 'text':
        response = await sendWhatsAppMessage({
          chatId: targetChatId,
          contentType: 'string',
          content: plan.body,
        });
        break;
      case 'link_preview':
        response = await sendWhatsAppMessage({
          chatId: targetChatId,
          contentType: 'LinkPreview',
          content: {
            body: plan.body,
            title: plan.title,
            description: plan.description,
            canonical: plan.canonical,
            preview: plan.preview,
          },
        });
        break;
      case 'contact':
        response = await sendWhatsAppMessage({
          chatId: targetChatId,
          contentType: 'Contact',
          content: {
            name: plan.name,
            vcard: plan.vcard,
          },
        });
        break;
      case 'location':
        response = await sendWhatsAppMessage({
          chatId: targetChatId,
          contentType: 'Location',
          content: {
            latitude: plan.latitude,
            longitude: plan.longitude,
            description: plan.description,
          },
        });
        break;
      case 'media': {
        const file = await createForwardMediaFile(plan);
        response = await sendMediaMessage(targetChatId, file, {
          caption: plan.caption,
          asVoice: plan.asVoice,
          seconds: plan.seconds,
          recordingTime: plan.recordingTime,
        });
        break;
      }
    }

    const sentAt = new Date().toISOString();
    const responsePayload = response && typeof response === 'object' ? (response as Record<string, unknown>) : null;
    const persisted = await persistOutboundMessage({
      response,
      chatId: targetChatId,
      type: plan.type,
      body: plan.body,
      hasMedia: plan.hasMedia,
      sentAt,
      payloadOverride: markWhatsAppPayloadAsForwarded(responsePayload),
    });

    handleMessageSent(buildOutboundSentMessagePayload({
      id: persisted.messageId,
      chatId: persisted.normalizedChatId,
      body: plan.body,
      type: plan.type,
      hasMedia: plan.hasMedia,
      sentAt,
      payload: persisted.storedPayload,
    }));

    return persisted.normalizedChatId;
  };

  const playNotificationTone = () => {
    if (
      !desktopNotificationsEnabledRef.current ||
      notificationPermissionRef.current !== 'granted' ||
      typeof window === 'undefined'
    ) return;

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

  const formatChatListPreview = useCallback((chat: Pick<WhatsAppChat, 'last_message' | 'last_message_direction' | 'is_group'>) => {
    const preview = sanitizeTechnicalCiphertextPreview(chat.last_message);
    if (!preview) return 'Sem mensagens';

    if (chat.last_message_direction === 'outbound') {
      return `Você: ${preview}`;
    }

    if (chat.last_message_direction === 'inbound') {
      return `${chat.is_group ? 'Pessoa' : 'Contato'}: ${preview}`;
    }

    return preview;
  }, []);

  const formatMinutesDuration = useCallback((minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }, []);

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

    const resolvedChat = matchedChat ?? chatsRef.current.find((chat) => getChatIdVariants(chat).includes(message.chat_id));
    if (resolvedChat && isChatMuted(resolvedChat)) return;

    const activeChat = selectedChatRef.current;
    const messageBelongsToActiveChat = activeChat
      ? getChatIdVariants(activeChat).includes(message.chat_id)
      : false;
    const shouldAlert = !messageBelongsToActiveChat || !isWindowFocusedRef.current;

    if (!shouldAlert || !desktopNotificationsEnabledRef.current || notificationPermissionRef.current !== 'granted') return;

    const preview = getMessagePreview(message);
    if (!preview) return;

    playNotificationTone();

    if (typeof window === 'undefined') return;

    const title = (() => {
      const preferredName = resolvedChat ? getChatDisplayName(resolvedChat) : '';
      if (preferredName && !isPhoneLikeLabel(preferredName)) {
        return preferredName;
      }

      const candidateKeys = new Set<string>();
      [message.chat_id, message.from_number, resolvedChat?.phone_number].forEach((value) => {
        collectPhoneMatchKeys(value).forEach((key) => candidateKeys.add(key));
      });

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

      const savedContactName = getSavedContactNameFromCandidates(contactCandidates);
      if (savedContactName) {
        return savedContactName;
      }

      const crmName = getCrmNameFromLeadMatchKeys(candidateKeys);
      if (crmName) {
        return crmName;
      }

      const pushname = getPushnameFromCandidates(contactCandidates);
      if (pushname) {
        return pushname;
      }

      return preferredName || getChatDisplayNameFromId(message.chat_id);
    })();

    const notificationChat = resolvedChat ?? {
      id: message.chat_id,
      is_group: getWhatsAppChatKind(message.chat_id) === 'group',
      phone_number: message.from_number || null,
    };
    const icon =
      resolveChatAvatarSources(notificationChat, {
        directPrimary: liveContactPhotosById,
        directFallback: legacyContactPhotosById,
        group: groupPhotosById,
      })[0] ?? PERSON_FALLBACK_NOTIFICATION_ICON;

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
  }, [leadsList]);

  const leadNamesByPhone = useMemo(() => {
    const map = new Map<string, string>();

    leadByPhoneMatchKey.forEach((lead, key) => {
      if (!map.has(key)) {
        map.set(key, lead.name);
      }
    });

    return map;
  }, [leadByPhoneMatchKey]);

  const getCrmNameFromLeadMatchKeys = useCallback((matchKeys: Iterable<string>) => {
    for (const key of matchKeys) {
      const leadName = leadByPhoneMatchKey.get(key)?.name?.trim();
      if (leadName) {
        return leadName;
      }
    }

    return null;
  }, [leadByPhoneMatchKey]);

  const getChatDisplayName = useCallback((chat: WhatsAppChat) => {
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
    const contactCandidates = new Set<string>([
      normalizeChatId(chat.id) || chat.id,
      chat.id,
      chat.id.endsWith('@s.whatsapp.net') ? chat.id.replace(/@s\.whatsapp\.net$/i, '@c.us') : '',
      chat.id.endsWith('@c.us') ? chat.id.replace(/@c\.us$/i, '@s.whatsapp.net') : '',
      chat.phone_number ? buildChatIdFromPhone(chat.phone_number) : '',
      chat.lid ?? '',
    ].filter(Boolean));

    const candidateDigits = [getPhoneDigits(chat.phone_number), phone].filter(Boolean);
    candidateDigits.forEach((digits) => {
      getDirectIdVariantsFromDigits(digits).forEach((variant) => contactCandidates.add(variant));
    });

    const savedContactName = getSavedContactNameFromCandidates(contactCandidates);
    if (savedContactName) {
      return savedContactName;
    }

    const crmName = getCrmNameFromLeadMatchKeys(getLeadMatchKeysForChat(chat));
    if (crmName) {
      return crmName;
    }

    const pushname = getPushnameFromCandidates(contactCandidates);
    if (pushname) {
      return pushname;
    }

    const directChatName = getMeaningfulDirectChatNameCandidate(chat, chat.name);
    if (directChatName) {
      return directChatName;
    }

    if (phone) {
      return formatPhone(phone);
    }

    return normalizeChatId(chat.id).endsWith('@lid') ? UNRESOLVED_DIRECT_CHAT_LABEL : chat.id;
  }, [formatPhone, getChatKind, getCrmNameFromLeadMatchKeys, getLeadMatchKeysForChat, getMeaningfulDirectChatNameCandidate, getNonDirectFallbackName, getPushnameFromCandidates, getSavedContactNameFromCandidates, groupNamesById, isPhoneLikeLabel, newsletterNamesById]);

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
        photoSources: string[];
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

      const chatPhotoSources = resolveChatAvatarSources(chat, {
        directPrimary: liveContactPhotosById,
        directFallback: legacyContactPhotosById,
        group: groupPhotosById,
      });

      map.set(chat.id, {
        displayName: chatDisplayName,
        kind: chatKind,
        typeLabel: chatTypeLabel,
        typeBadgeClass: chatTypeBadgeClass,
        leadStatus,
        leadResponsible,
        hasLeadMatch: Boolean(matchedLead),
        photoSources: chatPhotoSources,
      });
    });

    return map;
  }, [chats, contactsById, groupNamesById, groupPhotosById, leadByPhoneMatchKey, legacyContactPhotosById, leadNamesByPhone, liveContactPhotosById, newsletterNamesById]); // eslint-disable-line react-hooks/exhaustive-deps

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
                  chatOnlyUnread ? 'Não lidas' : null,
    ...chatKindFilters.map((filter) => {
      if (filter === 'direct') return 'Diretas';
      if (filter === 'groups') return 'Grupos';
      if (filter === 'channels') return 'Canais';
        return 'Transmissões';
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
      ? `Responsável: ${chatLeadOwnerFilter === EMPTY_FILTER_VALUE ? 'Sem responsável' : chatLeadOwnerFilter}`
      : null,
    chatLeadPresenceFilter !== 'all'
      ? `CRM: ${chatLeadPresenceFilter === 'withLead' ? 'Com lead' : 'Sem lead'}`
      : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const chatSearchMetadataById = useMemo(() => {
    const map = new Map<string, { displayName: string; preview: string; chatId: string; phone: string }>();

    chats.forEach((chat) => {
      const leadName = getLeadMatchKeysForChat(chat)
        .map((key) => leadNamesByPhone.get(key))
        .find(Boolean) || '';

      map.set(chat.id, {
        displayName: normalizeSearchText(`${chatListPresentationById.get(chat.id)?.displayName || chat.id} ${leadName}`),
        preview: normalizeSearchText(sanitizeTechnicalCiphertextPreview(chat.last_message)),
        chatId: normalizeSearchText(chat.id),
        phone: normalizeSearchText(chat.phone_number || extractPhoneFromChatId(chat.id)),
      });
    });

    return map;
  }, [chatListPresentationById, chats, getLeadMatchKeysForChat, leadNamesByPhone]);

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
    const normalizedSearchQuery = normalizeSearchText(deferredSearchQuery);
    const workspaceChats = chats.filter((chat) => !isStatusChat(chat));
    const chatsMatchingSearch = workspaceChats.filter((chat) => {
      if (!normalizedSearchQuery) return true;

      const searchMetadata = chatSearchMetadataById.get(chat.id);
      if (
        searchMetadata && (
          searchMetadata.displayName.includes(normalizedSearchQuery) ||
          searchMetadata.chatId.includes(normalizedSearchQuery) ||
          searchMetadata.phone.includes(normalizedSearchQuery) ||
          searchMetadata.preview.includes(normalizedSearchQuery)
        )
      ) {
        return true;
      }

      if (normalizedSearchQuery.length < 3) {
        return false;
      }

      const cachedState = messagesCacheRef.current.get(chat.id);
      return Boolean(cachedState?.searchIndex?.includes(normalizedSearchQuery));
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
    chatSearchMetadataById,
    chats,
    deferredSearchQuery,
    isStatusChat,
    getChatKind,
    prioritizeUnread,
    showArchived,
  ]);

  const nextUnreadChat = useMemo(
    () => unreadQueue.find((chat) => chat.id !== selectedChat?.id) ?? unreadQueue[0] ?? null,
    [unreadQueue, selectedChat?.id],
  );
  const directChatsMissingName = useMemo(() => {
    const candidateChats = new Map<string, WhatsAppChat>();

    if (selectedChat && !selectedChat.is_group && getWhatsAppChatKind(selectedChat.id) === 'direct') {
      candidateChats.set(selectedChat.id, selectedChat);
    }

    visibleChats.slice(0, 40).forEach((chat) => {
      if (!chat.is_group && getWhatsAppChatKind(chat.id) === 'direct') {
        candidateChats.set(chat.id, chat);
      }
    });

    return Array.from(candidateChats.values()).filter((chat) => {
      if (getMeaningfulDirectChatNameCandidate(chat, chat.name)) {
        return false;
      }

      const displayName = chatListPresentationById.get(chat.id)?.displayName || chat.name || chat.id;
      return displayName === chat.id || isPhoneLikeLabel(displayName);
    });
  }, [chatListPresentationById, selectedChat, visibleChats]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const chatsToHydrate = directChatsMissingName
      .filter((chat) => !normalizeChatId(chat.id).endsWith('@lid'))
      .filter((chat) => !directNameHydrationAttemptsRef.current.has(chat.id))
      .slice(0, 8);

    if (chatsToHydrate.length === 0) {
      return;
    }

    chatsToHydrate.forEach((chat) => directNameHydrationAttemptsRef.current.add(chat.id));

    void Promise.allSettled(
      chatsToHydrate.map(async (chat) => {
        try {
          const metadata = await getWhatsAppChat(chat.id);
          const resolvedName = getMeaningfulDirectChatNameCandidate(chat, metadata.name);
          if (!resolvedName) {
            return;
          }

          setChats((prev) =>
            prev.map((item) => {
              if (item.id !== chat.id && !areEquivalentDirectChats(item, chat)) {
                return item;
              }

              if (getMeaningfulDirectChatNameCandidate(item, item.name)) {
                return item;
              }

              return {
                ...item,
                name: resolvedName,
              };
            }),
          );

          const equivalentChatIds = Array.from(
            new Set(
              chatsRef.current
                .filter((item) => item.id === chat.id || areEquivalentDirectChats(item, chat))
                .map((item) => item.id),
            ),
          );

          const { error } = await supabase
            .from('whatsapp_chats')
            .update({
              name: resolvedName,
              updated_at: new Date().toISOString(),
            })
            .in('id', equivalentChatIds.length > 0 ? equivalentChatIds : [chat.id]);

          if (error) {
            console.warn('Error persisting hydrated direct chat name:', { chatId: chat.id, error });
          }
        } catch (error) {
          if (isWhapiChatNotFoundError(error)) {
            return;
          }
          console.warn('Error hydrating direct chat name from chat metadata:', { chatId: chat.id, error });
        }
      }),
    );
  }, [directChatsMissingName]); // eslint-disable-line react-hooks/exhaustive-deps

  const directChatsNeedingPersistedAvatarLookup = useMemo(() => {
    const candidateChats = new Map<string, WhatsAppChat>();
    const lookupIds = new Set<string>();

    if (selectedChat && !selectedChat.is_group && getWhatsAppChatKind(selectedChat.id) === 'direct') {
      candidateChats.set(selectedChat.id, selectedChat);
    }

    visibleChats.slice(0, 40).forEach((chat) => {
      if (!chat.is_group && getWhatsAppChatKind(chat.id) === 'direct') {
        candidateChats.set(chat.id, chat);
      }
    });

    candidateChats.forEach((chat) => {
      const { lookupIds: nextLookupIds, aliases } = getDirectChatAvatarLookupTarget(chat);
      const alreadyResolved = aliases.some((alias) => liveContactPhotosById.has(alias) || legacyContactPhotosById.has(alias));
      if (alreadyResolved) {
        return;
      }

      nextLookupIds.forEach((lookupId) => {
        if (!requestedLegacyContactPhotoIdsRef.current.has(lookupId)) {
          lookupIds.add(lookupId);
        }
      });
    });

    return Array.from(lookupIds);
  }, [legacyContactPhotosById, liveContactPhotosById, selectedChat, visibleChats]);

  useEffect(() => {
    const pendingLookupIds = directChatsNeedingPersistedAvatarLookup.slice(0, CONTACT_PHOTO_FALLBACK_BATCH_SIZE);
    if (pendingLookupIds.length === 0) {
      return;
    }

    pendingLookupIds.forEach((lookupId) => requestedLegacyContactPhotoIdsRef.current.add(lookupId));

    let cancelled = false;

    void (async () => {
      try {
        const fetchedRows: Array<{ contact_id: string; public_url: string | null }> = [];

        for (let index = 0; index < pendingLookupIds.length; index += CONTACT_PHOTO_FALLBACK_BATCH_SIZE) {
          const lookupIdsChunk = pendingLookupIds.slice(index, index + CONTACT_PHOTO_FALLBACK_BATCH_SIZE);
          const { data, error } = await supabase
            .from('whatsapp_contact_photos')
            .select('contact_id, public_url')
            .in('contact_id', lookupIdsChunk);

          if (error) {
            throw error;
          }

          if (data?.length) {
            fetchedRows.push(...data);
          }
        }

        if (cancelled || fetchedRows.length === 0) {
          return;
        }

        const nextFallbackMap = buildLegacyContactPhotoMap(fetchedRows);
        if (nextFallbackMap.size === 0) {
          return;
        }

        setLegacyContactPhotosById((prev) => {
          const next = new Map(prev);
          nextFallbackMap.forEach((url, key) => next.set(key, url));
          return next;
        });
      } catch (error) {
        pendingLookupIds.forEach((lookupId) => requestedLegacyContactPhotoIdsRef.current.delete(lookupId));
        console.error('Error loading persisted contact photos:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [directChatsNeedingPersistedAvatarLookup]);

  const directChatsMissingAvatar = useMemo(() => {
    const candidateChats = new Map<string, WhatsAppChat>();

    if (selectedChat && !selectedChat.is_group && getWhatsAppChatKind(selectedChat.id) === 'direct') {
      candidateChats.set(selectedChat.id, selectedChat);
    }

    visibleChats.slice(0, 40).forEach((chat) => {
      if (!chat.is_group && getWhatsAppChatKind(chat.id) === 'direct') {
        candidateChats.set(chat.id, chat);
      }
    });

    return Array.from(candidateChats.values()).filter(
      (chat) =>
        resolveChatAvatarSources(chat, {
          directPrimary: liveContactPhotosById,
          directFallback: legacyContactPhotosById,
          group: groupPhotosById,
        }).length === 0,
    );
  }, [groupPhotosById, legacyContactPhotosById, liveContactPhotosById, selectedChat, visibleChats]);

  useEffect(() => {
    const chatsToHydrate = directChatsMissingAvatar
      .filter((chat) => !avatarProfileHydrationAttemptsRef.current.has(chat.id))
      .slice(0, 8);

    if (chatsToHydrate.length === 0) {
      return;
    }

    chatsToHydrate.forEach((chat) => avatarProfileHydrationAttemptsRef.current.add(chat.id));

    void (async () => {
      const persistedTargets: ContactPhotoSyncTarget[] = [];

      await Promise.allSettled(
        chatsToHydrate.map(async (chat) => {
          const { lookupIds, aliases } = getDirectChatAvatarLookupTarget(chat);
          if (lookupIds.length === 0 || aliases.length === 0) {
            return;
          }

          let resolvedLookupId = '';
          let resolvedProfile: Awaited<ReturnType<typeof getWhatsAppContactProfile>> | null = null;
          let lastError: unknown = null;

          for (const lookupId of lookupIds) {
            try {
              const candidateProfile = await getWhatsAppContactProfile(lookupId);
              if (!candidateProfile.icon && !candidateProfile.icon_full) {
                continue;
              }

              resolvedLookupId = lookupId;
              resolvedProfile = candidateProfile;
              break;
            } catch (error) {
              lastError = error;
            }
          }

          if (!resolvedProfile) {
            if (lastError) {
              console.warn('Error hydrating contact photo from profile endpoint:', { chatId: chat.id, error: lastError });
            }
            return;
          }

          const hydratedPhotoMap = buildContactProfilePhotoMap(aliases, {
            profile_pic: resolvedProfile.icon,
            profile_pic_full: resolvedProfile.icon_full,
          });

          if (hydratedPhotoMap.size === 0) {
            return;
          }

          setLiveContactPhotosById((prev) => {
            const next = new Map(prev);
            hydratedPhotoMap.forEach((url, key) => next.set(key, url));
            return next;
          });

          persistedTargets.push({
            lookupId: resolvedLookupId,
            aliases,
          });
        }),
      );

      if (persistedTargets.length === 0) {
        return;
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-sync-contact-photos', {
        body: {
          targets: persistedTargets,
        },
      });

      if (error) {
        console.warn('Error persisting hydrated contact photos:', error);
        return;
      }

      const syncedPhotos = Array.isArray((data as ContactPhotoSyncResponse | null)?.photos)
        ? ((data as ContactPhotoSyncResponse).photos ?? [])
        : [];

      if (syncedPhotos.length === 0) {
        return;
      }

      setLegacyContactPhotosById((prev) => {
        const next = new Map(prev);
        buildLegacyContactPhotoMap(syncedPhotos).forEach((url, key) => next.set(key, url));
        return next;
      });
    })();
  }, [directChatsMissingAvatar]);
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
    () => messages.filter((message) => isDisplayableInboxMessage(message)),
    [messages], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const selectedChatKind = selectedChat ? getChatKind(selectedChat) : null;
  const isSelectedStatusChat = selectedChatKind === 'status';
  const selectedChatTypeLabel = selectedChat ? getChatTypeLabel(selectedChat) : null;
  const selectedChatTypeBadgeClass = getChatTypeBadgeClass(selectedChatKind);
  const selectedChatIsDirect = selectedChat ? isDirectChat(selectedChat) : false;

  const renderedMessageItems = useMemo<RenderedMessageItem[]>(
    () =>
      renderedMessages.map((message, index) => {
        const previousMessage = index > 0 ? renderedMessages[index - 1] : null;
        const currentDayKey = getMessageDayKey(message);
        const previousDayKey = previousMessage ? getMessageDayKey(previousMessage) : '';
        const shouldShowDaySeparator = Boolean(currentDayKey) && currentDayKey !== previousDayKey;
        const showAuthor = selectedChatKind === 'group' && message.direction === 'inbound' && message.author;

        return {
          message,
          timestamp: getMessageDisplayTimestamp(message),
          shouldShowDaySeparator,
          daySeparatorLabel: shouldShowDaySeparator ? formatDaySeparatorLabel(message) : '',
          authorName: showAuthor ? formatPhone(message.author!) : undefined,
          reactions: reactionsByTargetId.get(message.id),
          forwardPlan: isSelectedStatusChat ? null : buildForwardMessagePlan(message),
        };
      }),
    [reactionsByTargetId, renderedMessages, selectedChatKind], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const estimateRenderedMessageRowHeight = useCallback((item: RenderedMessageItem) => {
    const normalizedType = (item.message.type || '').toLowerCase();
    let estimatedHeight = MESSAGE_ROW_BASE_ESTIMATED_HEIGHT;

    if (item.shouldShowDaySeparator) {
      estimatedHeight += 40;
    }

    if (item.authorName) {
      estimatedHeight += 20;
    }

    if (item.message.has_media) {
      if (
        normalizedType === 'sticker' ||
        normalizedType === 'gif' ||
        normalizedType.startsWith('image') ||
        normalizedType.startsWith('video')
      ) {
        estimatedHeight += MESSAGE_ROW_VISUAL_MEDIA_ESTIMATED_HEIGHT;
      } else if (normalizedType.startsWith('audio') || normalizedType === 'ptt' || normalizedType === 'voice') {
        estimatedHeight += 112;
      } else {
        estimatedHeight += 136;
      }
    } else {
      const bodyLength = item.message.body?.trim().length ?? 0;
      estimatedHeight += Math.min(180, Math.ceil(bodyLength / 88) * 24);
    }

    if (item.reactions?.length) {
      estimatedHeight += 26;
    }

    return estimatedHeight;
  }, []);

  const messageLayout = useMemo(() => {
    let offsetTop = 0;
    const entries = renderedMessageItems.map((item) => {
      const measuredHeight = messageRowHeightsRef.current.get(item.message.id);
      const height = measuredHeight ?? estimateRenderedMessageRowHeight(item);
      const entry = {
        item,
        offsetTop,
        offsetBottom: offsetTop + height,
        height,
      };

      offsetTop += height;
      return entry;
    });

    return {
      entries,
      byId: new Map(entries.map((entry) => [entry.item.message.id, entry])),
      totalHeight: offsetTop,
    };
  }, [estimateRenderedMessageRowHeight, messageRowHeightsVersion, renderedMessageItems]);

  const {
    visibleRenderedMessageItems,
    virtualMessagePaddingTop,
    virtualMessagePaddingBottom,
  } = useMemo(() => {
    if (!renderedMessageItems.length) {
      return {
        visibleRenderedMessageItems: [] as RenderedMessageItem[],
        virtualMessagePaddingTop: 0,
        virtualMessagePaddingBottom: 0,
      };
    }

    if (
      messagesViewportHeight <= 0 ||
      renderedMessageItems.length <= MESSAGE_LIST_VIRTUALIZATION_THRESHOLD
    ) {
      return {
        visibleRenderedMessageItems: renderedMessageItems,
        virtualMessagePaddingTop: 0,
        virtualMessagePaddingBottom: 0,
      };
    }

    const visibleTop = Math.max(0, messagesViewportScrollTop - MESSAGE_LIST_OVERSCAN_PX);
    const visibleBottom = messagesViewportScrollTop + messagesViewportHeight + MESSAGE_LIST_OVERSCAN_PX;
    let startIndex = 0;

    while (
      startIndex < messageLayout.entries.length &&
      messageLayout.entries[startIndex].offsetBottom < visibleTop
    ) {
      startIndex += 1;
    }

    let endIndex = startIndex;
    while (
      endIndex < messageLayout.entries.length &&
      messageLayout.entries[endIndex].offsetTop <= visibleBottom
    ) {
      endIndex += 1;
    }

    if (endIndex <= startIndex) {
      endIndex = Math.min(messageLayout.entries.length, startIndex + 1);
    }

    const visibleEntries = messageLayout.entries.slice(startIndex, endIndex);
    const lastVisibleEntry = visibleEntries[visibleEntries.length - 1] ?? null;

    return {
      visibleRenderedMessageItems: visibleEntries.map((entry) => entry.item),
      virtualMessagePaddingTop: visibleEntries[0]?.offsetTop ?? 0,
      virtualMessagePaddingBottom: lastVisibleEntry
        ? Math.max(0, messageLayout.totalHeight - lastVisibleEntry.offsetBottom)
        : 0,
    };
  }, [messageLayout, messagesViewportHeight, messagesViewportScrollTop, renderedMessageItems]);

  const isVisualMediaMessage = useCallback((message: Pick<WhatsAppMessage, 'type' | 'has_media' | 'is_deleted' | 'payload'>) => {
    const payload = message.payload && typeof message.payload === 'object' ? (message.payload as MessageBubblePayload) : null;
    const normalizedType = (message.type || '').toLowerCase();

    return Boolean(
      !message.is_deleted &&
      message.has_media &&
      (
        normalizedType === 'sticker' ||
        normalizedType === 'gif' ||
        normalizedType.startsWith('image') ||
        normalizedType.startsWith('video') ||
        payload?.sticker ||
        payload?.gif ||
        payload?.image ||
        payload?.video
      ),
    );
  }, []);

  const mediaGalleryItems = useMemo<MessageBubbleMediaGalleryItem[]>(
    () =>
      renderedMessageItems.flatMap(({ message, timestamp, authorName }) => {
        if (!isVisualMediaMessage(message)) {
          return [];
        }

        const payload = message.payload && typeof message.payload === 'object' ? (message.payload as MessageBubblePayload) : null;

        return [{
          messageId: message.id,
          body: message.body,
          type: message.type,
          hasMedia: message.has_media,
          payload,
          timestamp,
          fromName: authorName,
          isDeleted: message.is_deleted,
        }];
      }),
    [isVisualMediaMessage, renderedMessageItems],
  );

  useEffect(() => {
    mediaGalleryItemsRef.current = mediaGalleryItems;
  }, [mediaGalleryItems]);

  const getMediaGalleryItems = useCallback(() => mediaGalleryItemsRef.current, []);

  const selectedChatDisplayName = selectedChat
    ? chatListPresentationById.get(selectedChat.id)?.displayName || getChatDisplayName(selectedChat)
    : '';
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
  function resolveLeadForChat(chat: Pick<WhatsAppChat, 'id' | 'name' | 'phone_number' | 'lid' | 'is_group'> | null) {
    const matchKeys = getLeadMatchKeysForChat(chat);
    for (const key of matchKeys) {
      const matchedLead = leadByPhoneMatchKey.get(key);
      if (matchedLead) {
        return matchedLead;
      }
    }

    return null;
  }
  const firstResponseSla = useMemo<FirstResponseSLA>(() => {
    let lastInboundAt: number | null = null;
    let firstOutboundAfterInboundAt: number | null = null;

    messages.forEach((message) => {
      if (!message.direction) return;
      if (isReactionOnlyMessage(message)) return;
      if (isEditActionMessage(message)) return;
      if (isHiddenTechnicalAction(message)) return;
      if (isTechnicalCiphertextMessage(message)) return;

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
  }, [firstResponseSla, formatMinutesDuration]);
  const isDarkThemeActive =
    typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');
  const getLeadStatusBadgeStyle = useCallback((hexColor: string) => {
    if (!isDarkThemeActive) {
      return getBadgeStyle(hexColor, 0.34);
    }

    const preferredContrast = getContrastTextColor(hexColor);

    return {
      backgroundColor: hexToRgba(hexColor, 0.2),
      color: preferredContrast === '#ffffff' ? '#f8fafc' : hexToRgba(hexColor, 0.95),
      borderColor: hexToRgba(hexColor, 0.58),
    };
  }, [isDarkThemeActive]);
  const statusByName = useMemo(() => {
    const map = new Map<string, LeadStatusConfig>();
    leadStatuses.forEach((status) => map.set(status.nome, status));
    return map;
  }, [leadStatuses]);
  const filteredLeads = useMemo(() => leadDirectoryResults, [leadDirectoryResults]);

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

  const selectedForwardChatIds = useMemo(() => new Set(forwardTargetChatIds), [forwardTargetChatIds]);

  const filteredForwardChats = useMemo(() => {
    const normalizedQuery = normalizeSearchText(forwardSearch);
    const queryDigits = forwardSearch.replace(/\D/g, '');

    return chats
      .filter((chat) => {
        const chatKind = getWhatsAppChatKind(chat.id);
        if (chatKind === 'status' || chatKind === 'newsletter') {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const displayName = getChatDisplayName(chat);
        const previewText = formatChatListPreview(chat);
        const searchable = normalizeSearchText(`${displayName} ${chat.name || ''} ${chat.id} ${previewText}`);
        if (searchable.includes(normalizedQuery)) {
          return true;
        }

        if (queryDigits.length >= 3) {
          const phoneMatch = getPhoneDigits(chat.phone_number || '').includes(queryDigits);
          const chatIdMatch = getPhoneDigits(extractPhoneFromChatId(chat.id)).includes(queryDigits);
          return phoneMatch || chatIdMatch;
        }

        return false;
      })
      .map((chat) => ({
        chat,
        displayName: getChatDisplayName(chat),
        previewText: formatChatListPreview(chat),
        formattedTime: formatTime(chat.last_message_at),
      }))
      .sort((left, right) => {
        const leftSelected = selectedForwardChatIds.has(left.chat.id);
        const rightSelected = selectedForwardChatIds.has(right.chat.id);
        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1;
        }

        return 0;
      });
  }, [chats, formatChatListPreview, formatTime, forwardSearch, getChatDisplayName, selectedForwardChatIds]);

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

  const getUnreadWaitingLabel = useCallback((chat: WhatsAppChat) => {
    if ((chat.unread_count ?? 0) <= 0 || !chat.last_message_at) return null;
    const messageTime = new Date(chat.last_message_at).getTime();
    if (!Number.isFinite(messageTime) || Number.isNaN(messageTime)) return null;
    const waitingMinutes = Math.max(1, Math.round((Date.now() - messageTime) / 60000));
    return formatMinutesDuration(waitingMinutes);
  }, [formatMinutesDuration]);

  const isChatMuted = useCallback((chat: WhatsAppChat) => {
    return chat.mute_until ? new Date(chat.mute_until).getTime() > Date.now() : false;
  }, []);

  const visibleChatItems = useMemo(
    () => {
      const nextCache = new Map<string, VisibleChatRowItem>();

      const nextItems = visibleChats.map((chat) => {
        const chatPresentation = chatListPresentationById.get(chat.id);
        const resolvedKind = chatPresentation?.kind ?? getChatKind(chat);
        const leadStatus = chatPresentation?.leadStatus ?? null;
        const statusConfig = leadStatus ? statusByName.get(leadStatus) : null;

        const nextItem = {
          chat,
          displayName: chatPresentation?.displayName || getChatDisplayName(chat),
          kind: resolvedKind,
          typeLabel: chatPresentation?.typeLabel ?? getChatTypeLabel(chat),
          typeBadgeClass: chatPresentation?.typeBadgeClass ?? getChatTypeBadgeClass(resolvedKind),
          leadStatus,
          leadStatusStyles: statusConfig ? getLeadStatusBadgeStyle(statusConfig.cor || '#94a3b8') : null,
          photoSources: chatPresentation?.photoSources ?? [],
          muted: isChatMuted(chat),
          unreadWaitingLabel: getUnreadWaitingLabel(chat),
          formattedTime: formatTime(chat.last_message_at),
          previewText: formatChatListPreview(chat),
        } satisfies VisibleChatRowItem;

        const previousItem = visibleChatItemsCacheRef.current.get(chat.id);
        const resolvedItem = previousItem && areVisibleChatRowItemsEqual(previousItem, nextItem) ? previousItem : nextItem;

        nextCache.set(chat.id, resolvedItem);
        return resolvedItem;
      });

      visibleChatItemsCacheRef.current = nextCache;
      return nextItems;
    },
    [
      chatListPresentationById,
      getChatDisplayName,
      getChatTypeLabel,
      formatChatListPreview,
      formatTime,
      getChatKind,
      getLeadStatusBadgeStyle,
      getUnreadWaitingLabel,
      isChatMuted,
      statusByName,
      visibleChats,
    ],
  );

  const {
    virtualChatItems,
    virtualChatPaddingTop,
    virtualChatPaddingBottom,
  } = useMemo(() => {
    if (chatListViewportHeight <= 0 || visibleChatItems.length <= CHAT_LIST_OVERSCAN * 4) {
      return {
        virtualChatItems: visibleChatItems,
        virtualChatPaddingTop: 0,
        virtualChatPaddingBottom: 0,
      };
    }

    const startIndex = Math.max(0, Math.floor(chatListScrollTop / CHAT_ROW_HEIGHT) - CHAT_LIST_OVERSCAN);
    const visibleCount = Math.ceil(chatListViewportHeight / CHAT_ROW_HEIGHT) + (CHAT_LIST_OVERSCAN * 2);
    const endIndex = Math.min(visibleChatItems.length, startIndex + visibleCount);

    return {
      virtualChatItems: visibleChatItems.slice(startIndex, endIndex),
      virtualChatPaddingTop: startIndex * CHAT_ROW_HEIGHT,
      virtualChatPaddingBottom: Math.max(0, (visibleChatItems.length - endIndex) * CHAT_ROW_HEIGHT),
    };
  }, [chatListScrollTop, chatListViewportHeight, visibleChatItems]);

  useLayoutEffect(() => {
    const viewport = chatListViewportRef.current;
    const selectedChatId = selectedChat?.id;
    if (!shouldRevealSelectedChatInListRef.current || !viewport || !selectedChatId || visibleChatItems.length === 0) {
      return;
    }

    const selectedIndex = visibleChatItems.findIndex((item) => item.chat.id === selectedChatId);
    if (selectedIndex < 0) {
      return;
    }

    shouldRevealSelectedChatInListRef.current = false;

    const rowTop = selectedIndex * CHAT_ROW_HEIGHT;
    const rowBottom = rowTop + CHAT_ROW_HEIGHT;
    const viewportTop = viewport.scrollTop;
    const viewportBottom = viewportTop + viewport.clientHeight;

    if (rowTop < viewportTop) {
      viewport.scrollTo({ top: rowTop, behavior: 'auto' });
      setChatListScrollTop(rowTop);
      return;
    }

    if (rowBottom > viewportBottom) {
      const nextScrollTop = Math.max(0, rowBottom - viewport.clientHeight);
      viewport.scrollTo({ top: nextScrollTop, behavior: 'auto' });
      setChatListScrollTop(nextScrollTop);
    }
  }, [selectedChat?.id, visibleChatItems]);

  const clearMuteMenuCloseTimeout = useCallback(() => {
    if (muteMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(muteMenuCloseTimeoutRef.current);
      muteMenuCloseTimeoutRef.current = null;
    }
  }, []);

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

  const closeMuteSubmenuNow = useCallback(() => {
    clearMuteMenuCloseTimeout();
    setChatMenuMuteOpen(false);
  }, [clearMuteMenuCloseTimeout]);

  const clearStatusMenuCloseTimeout = useCallback(() => {
    if (statusMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(statusMenuCloseTimeoutRef.current);
      statusMenuCloseTimeoutRef.current = null;
    }
  }, []);

  const openStatusSubmenu = () => {
    clearStatusMenuCloseTimeout();
    setChatMenuStatusOpen(true);
  };

  const closeStatusSubmenuSoon = () => {
    clearStatusMenuCloseTimeout();
    statusMenuCloseTimeoutRef.current = window.setTimeout(() => {
      statusMenuCloseTimeoutRef.current = null;
      setChatMenuStatusOpen(false);
    }, 140);
  };

  const closeStatusSubmenuNow = useCallback(() => {
    clearStatusMenuCloseTimeout();
    setChatMenuStatusOpen(false);
  }, [clearStatusMenuCloseTimeout]);

  const runDeferredChatMenuAction = useCallback((action: () => void | Promise<void>) => {
    closeMuteSubmenuNow();
    closeStatusSubmenuNow();
    startTransition(() => {
      setChatMenu(null);
    });

    if (typeof window === 'undefined') {
      void action();
      return;
    }

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        void action();
      }, 0);
    });
  }, [closeMuteSubmenuNow, closeStatusSubmenuNow]);

  useEffect(() => {
    return () => {
      if (muteMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(muteMenuCloseTimeoutRef.current);
      }
      if (statusMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(statusMenuCloseTimeoutRef.current);
      }
    };
  }, []);

  const openChatContextMenu = (chatId: string, anchorRect: DOMRect, source: ChatMenuSource) => {
    closeMuteSubmenuNow();
    closeStatusSubmenuNow();
    setChatMenu({
      chatId,
      source,
      anchorRect: {
        left: anchorRect.left,
        right: anchorRect.right,
        top: anchorRect.top,
        bottom: anchorRect.bottom,
        width: anchorRect.width,
        height: anchorRect.height,
      },
    });
  };

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
  const selectedContact = useMemo<InboxContactInfo | null>(() => {
    if (!selectedChat || !selectedChatIsDirect) return null;

    const candidateKeys = new Set<string>();

    [selectedChat.id, normalizeChatId(selectedChat.id), selectedChat.phone_number || '', selectedChatPhone].forEach((value) => {
      if (!value) return;

      candidateKeys.add(value);

      const normalizedValue = normalizeChatId(value);
      if (normalizedValue) {
        candidateKeys.add(normalizedValue);
      }

      const digits = getPhoneDigits(value);
      if (!digits) return;

      candidateKeys.add(digits);
      getDirectIdVariantsFromDigits(digits).forEach((variant) => candidateKeys.add(variant));
    });

    const matchedContact = contactsList.find((contact) => {
      const normalizedContactId = normalizeChatId(contact.id);
      const contactDigits = getPhoneDigits(contact.id);

      return candidateKeys.has(contact.id) || candidateKeys.has(normalizedContactId) || candidateKeys.has(contactDigits);
    });

    return matchedContact
      ? {
          id: matchedContact.id,
          name: matchedContact.name,
          saved: matchedContact.saved,
          pushname: matchedContact.pushname,
        }
      : null;
  }, [contactsList, selectedChat, selectedChatIsDirect, selectedChatPhone]);
  const effectiveSelectedLeadInfo = useMemo<InboxLeadInfo | null>(() => {
    if (!selectedLead && !selectedLeadInfo) return null;

    const fallbackLead = selectedLead
      ? {
          ...selectedLead,
          email: null,
          cidade: null,
          observacoes: null,
        }
      : null;

    if (!selectedLeadInfo) return fallbackLead;

    return {
      id: selectedLeadInfo.id,
      name: selectedLeadInfo.name || fallbackLead?.name || '',
      phone: selectedLeadInfo.phone || fallbackLead?.phone || '',
      status: selectedLead?.status ?? selectedLeadInfo.status ?? null,
      responsavel: selectedLead?.responsavel ?? selectedLeadInfo.responsavel ?? null,
      email: selectedLeadInfo.email ?? null,
      cidade: selectedLeadInfo.cidade ?? null,
      observacoes: selectedLeadInfo.observacoes ?? null,
    };
  }, [selectedLead, selectedLeadInfo]);

  useEffect(() => {
    if (!showConversationInfo) {
      setIsLoadingSelectedLeadInfo(false);
      return;
    }

    if (!selectedLead?.id) {
      setSelectedLeadInfo(null);
      setIsLoadingSelectedLeadInfo(false);
      return;
    }

    let cancelled = false;
    const fallbackLeadInfo: InboxLeadInfo = {
      ...selectedLead,
      email: null,
      cidade: null,
      observacoes: null,
    };

    const loadSelectedLeadInfo = async () => {
      setIsLoadingSelectedLeadInfo(true);

      try {
        const { data, error } = await supabase
          .from('leads')
          .select('id, nome_completo, telefone, status, responsavel_id, email, cidade, observacoes')
          .eq('id', selectedLead.id)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        if (!data?.id) {
          setSelectedLeadInfo(fallbackLeadInfo);
          return;
        }

        setSelectedLeadInfo({
          id: data.id,
          name: data.nome_completo?.trim() || fallbackLeadInfo.name,
          phone: normalizePhoneNumber(data.telefone ?? '') || fallbackLeadInfo.phone,
          status: data.status ?? fallbackLeadInfo.status ?? null,
          responsavel: data.responsavel_id ?? fallbackLeadInfo.responsavel ?? null,
          email: data.email ?? null,
          cidade: data.cidade ?? null,
          observacoes: data.observacoes ?? null,
        });
      } catch (error) {
        console.error('Erro ao carregar dados completos do lead no WhatsApp:', error);
        if (!cancelled) {
          setSelectedLeadInfo(fallbackLeadInfo);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSelectedLeadInfo(false);
        }
      }
    };

    void loadSelectedLeadInfo();

    return () => {
      cancelled = true;
    };
  }, [showConversationInfo, selectedLead]);

  const handleSaveSelectedContactInfo = async ({ name }: { name: string }) => {
    if (!selectedChatIsDirect || !selectedChatPhone) {
      toast.warning('Não foi possível identificar o telefone deste chat.');
      return;
    }

    const resolvedName = name.trim();
    if (!resolvedName) {
      toast.warning('Informe um nome para salvar o contato.');
      return;
    }

    setIsSavingSelectedContact(true);

    try {
      if (selectedContact?.saved) {
        await updateWhatsAppContact(selectedContact.id, resolvedName);
      } else {
        await addWhatsAppContact(selectedChatPhone, resolvedName);
      }

      await loadSavedContacts();
      toast.success(selectedContact?.saved ? 'Contato atualizado com sucesso.' : 'Contato adicionado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar contato do WhatsApp:', error);
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o contato.';
      toast.error(message);
    } finally {
      setIsSavingSelectedContact(false);
    }
  };

  const handleDeleteSelectedContactInfo = async () => {
    if (!selectedContact?.saved) return;

    const confirmed = await requestConfirmation({
      title: 'Excluir contato',
      description: `Deseja excluir o contato ${selectedContact.name || selectedChatDisplayName || selectedChatPhoneFormatted}? Esta ação também remove o contato do WhatsApp conectado.`,
      confirmLabel: 'Excluir contato',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    setIsDeletingSelectedContact(true);

    try {
      await deleteWhatsAppContact(selectedContact.id);
      await loadSavedContacts();
      toast.success('Contato excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir contato do WhatsApp:', error);
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o contato.';
      toast.error(message);
    } finally {
      setIsDeletingSelectedContact(false);
    }
  };

  const handleSaveSelectedLeadInfo = async (payload: {
    name: string;
    email: string;
    cidade: string;
    observacoes: string;
  }) => {
    const currentLead = effectiveSelectedLeadInfo;
    if (!currentLead?.id) return;

    const normalizedName = normalizeTitleCase(payload.name)?.trim() || '';
    if (!normalizedName) {
      toast.warning('Informe o nome do lead.');
      return;
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.warning('Informe um e-mail válido.');
      return;
    }

    const normalizedCity = normalizeTitleCase(payload.cidade)?.trim() || null;
    const normalizedObservacoes = payload.observacoes.trim() || null;

    setIsSavingSelectedLeadInfo(true);

    try {
      const { data, error } = await supabase
        .from('leads')
        .update({
          nome_completo: normalizedName,
          email: normalizedEmail || null,
          cidade: normalizedCity,
          observacoes: normalizedObservacoes,
        })
        .eq('id', currentLead.id)
        .select('id, nome_completo, telefone, status, responsavel_id, email, cidade, observacoes')
        .maybeSingle();

      if (error) throw error;

      const nextLeadInfo: InboxLeadInfo = {
        id: currentLead.id,
        name: data?.nome_completo?.trim() || normalizedName,
        phone: normalizePhoneNumber(data?.telefone ?? '') || currentLead.phone,
        status: data?.status ?? currentLead.status ?? null,
        responsavel: data?.responsavel_id ?? currentLead.responsavel ?? null,
        email: data?.email ?? (normalizedEmail || null),
        cidade: data?.cidade ?? normalizedCity,
        observacoes: data?.observacoes ?? normalizedObservacoes,
      };

      setSelectedLeadInfo(nextLeadInfo);
      setLeadsList((prev) =>
        prev.map((lead) =>
          lead.id === currentLead.id
            ? {
                ...lead,
                name: nextLeadInfo.name,
                phone: nextLeadInfo.phone,
                status: nextLeadInfo.status ?? null,
                responsavel: nextLeadInfo.responsavel ?? null,
              }
            : lead,
        ),
      );
      toast.success('Lead atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao atualizar lead pelo WhatsApp:', error);
      const message = error instanceof Error ? error.message : 'Não foi possível salvar os dados do lead.';
      toast.error(message);
    } finally {
      setIsSavingSelectedLeadInfo(false);
    }
  };

  const handleDeleteSelectedLeadInfo = async () => {
    const currentLead = effectiveSelectedLeadInfo;
    if (!currentLead) return;

    const confirmed = await requestConfirmation({
      title: 'Excluir lead',
      description: `Deseja excluir o lead ${currentLead.name}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir lead',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    setIsDeletingSelectedLeadInfo(true);

    try {
      const { error } = await supabase.from('leads').delete().eq('id', currentLead.id);
      if (error) throw error;

      setLeadsList((prev) => prev.filter((lead) => lead.id !== currentLead.id));
      setSelectedLeadInfo(null);
      toast.success('Lead excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir lead pelo WhatsApp:', error);
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o lead.';
      toast.error(message);
    } finally {
      setIsDeletingSelectedLeadInfo(false);
    }
  };

  const handleCreateLeadFromSelectedChat = (payload: {
    name: string;
    phone: string;
  }) => {
    if (!selectedChatIsDirect) {
      toast.warning('Abra uma conversa individual para criar um lead por aqui.');
      return;
    }

    const initialPhone = payload.phone.trim() || selectedChatPhoneFormatted || selectedChatPhone || '';
    if (!initialPhone) {
      toast.warning('Não foi possível identificar o telefone deste chat.');
      return;
    }

    const initialName =
      normalizeTitleCase(payload.name)?.trim() ||
      normalizeTitleCase(selectedChatDisplayName)?.trim() ||
      selectedChatDisplayName ||
      initialPhone;

    setLeadCreationInitialValues({
      nome_completo: initialName,
      telefone: initialPhone,
    });
  };

  const handleLeadCreatedFromSelectedChat = (
    savedLead: Lead,
    _context?: { created: boolean },
  ) => {
    const normalizedPhone =
      normalizePhoneNumber(savedLead.telefone || '') || selectedChatPhone || '';
    const nextLeadSummary: InboxLeadSummary = {
      id: savedLead.id,
      name: savedLead.nome_completo?.trim() || normalizedPhone || selectedChatDisplayName || 'Lead',
      phone: normalizedPhone,
      status: savedLead.status ?? null,
      responsavel: savedLead.responsavel_id ?? savedLead.responsavel ?? null,
    };

    mergeLeadSummaries([nextLeadSummary]);
    setSelectedLeadInfo({
      id: savedLead.id,
      name: nextLeadSummary.name,
      phone: nextLeadSummary.phone,
      status: nextLeadSummary.status ?? null,
      responsavel: nextLeadSummary.responsavel ?? null,
      email: savedLead.email ?? null,
      cidade: savedLead.cidade ?? null,
      observacoes: savedLead.observacoes ?? null,
    });
    setLeadCreationInitialValues(null);
    toast.success('Lead criado e vinculado a esta conversa.');
  };

  const buildConversationHistoryForCopy = useCallback((items: WhatsAppMessage[]) => {
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
  }, [formatPhone, getMessageDisplayTimestamp, getMessagePreview, selectedChat, selectedChatDisplayName, selectedChatKind, sortMessagesChronologically]);
  const followUpContextForInput = useMemo(() => {
    if (!selectedChat || !selectedChatIsDirect) return null;

    const leadName =
      (selectedLead?.name || selectedChatDisplayName || selectedChatPhoneFormatted || selectedChat.id || '').trim();

    return {
      leadName,
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
    selectedChatDisplayName,
    selectedChatIsDirect,
    selectedChatPhone,
    selectedChatPhoneFormatted,
    selectedLead,
  ]);
  const selectedChatPhotoSources = useMemo(
    () =>
      resolveChatAvatarSources(selectedChat, {
        directPrimary: liveContactPhotosById,
        directFallback: legacyContactPhotosById,
        group: groupPhotosById,
      }),
    [groupPhotosById, legacyContactPhotosById, liveContactPhotosById, selectedChat],
  );
  function getResolvedDirectChatPhone(chat: WhatsAppChat | null) {
    if (!chat || !isDirectChat(chat)) return '';

    const matchedLead = resolveLeadForChat(chat);
    const candidates = [
      matchedLead?.phone || '',
      normalizePhoneNumber(chat.phone_number || ''),
      extractPhoneFromChatId(chat.id),
    ];

    for (const candidate of candidates) {
      const normalized = normalizePhoneNumber(candidate);
      if (normalized) return normalized;
    }

    return '';
  }
  const chatMenuTarget = useMemo(() => {
    if (!chatMenu) return null;
    const targetChat = chats.find((item) => item.id === chatMenu.chatId) ?? null;
    const targetLead = resolveLeadForChat(targetChat);
    const targetPhone = getResolvedDirectChatPhone(targetChat);
    return {
      chat: targetChat,
      lead: targetLead,
      phone: targetPhone,
      isMuted: targetChat ? isChatMuted(targetChat) : false,
      isPinned: Boolean(targetChat && getPinnedSortValue(targetChat) > 0),
      canOpenLead: Boolean(targetLead?.id),
      canUpdateStatus: Boolean(targetLead?.id && leadStatuses.length > 0),
    };
  }, [chatMenu, chats, leadStatuses, leadsList]); // eslint-disable-line react-hooks/exhaustive-deps
  const chatMenuLayout = useMemo(() => {
    if (!chatMenu) return null;

    const viewportPadding = 12;
    const menuWidth = 248;
    const menuHeight = 320;
    const submenuWidth = 196;
    const requestedLeft = chatMenu.anchorRect.left;
    const requestedTop = chatMenu.source === 'header-button' ? chatMenu.anchorRect.bottom + 6 : chatMenu.anchorRect.top + 6;
    const left = Math.min(
      Math.max(viewportPadding, requestedLeft),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
    );
    const top = Math.min(
      Math.max(viewportPadding, requestedTop),
      Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding),
    );
    const submenuOpensLeft = left + menuWidth + submenuWidth + viewportPadding > window.innerWidth;

    return { left, top, submenuOpensLeft };
  }, [chatMenu]);
  const effectiveFirstResponseSlaBadge =
    selectedChatIsDirect && isLoadingMessages && messages.length === 0
      ? {
          label: 'SLA 1ª resposta: carregando...',
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

  const handleCopyChatPhone = async (chat: WhatsAppChat | null, phone: string) => {
    if (!chat || !phone) return;

    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      window.setTimeout(() => {
        setCopiedPhone((current) => (current === phone ? null : current));
      }, 1800);
    } catch (error) {
      console.error('Erro ao copiar telefone do chat:', error);
    }
  };

  const handleOpenLeadFromChat = (leadId: string | null | undefined) => {
    if (!leadId) return;
    handleTabChange('leads', { leadIdFilter: leadId });
  };

  const handleAudioTranscriptionSaved = (messageId: string, nextPayload: WhatsAppMessagePayload) => {
    setMessages((prev) => {
      const nextMessages = prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              payload: nextPayload,
              transcription_text: getWhatsAppAudioTranscription(nextPayload)?.text ?? message.transcription_text ?? null,
            }
          : message,
      );

      if (selectedChat) {
        const cachedState = messagesCacheRef.current.get(selectedChat.id);
        if (cachedState) {
          messagesCacheRef.current.set(selectedChat.id, createMessagesCacheState({
            ...cachedState,
            messages: nextMessages,
          }));
        }
      }

      return nextMessages;
    });
  };

  const ensureAudioMessagesHaveTranscription = useCallback(async (items: WhatsAppMessage[]) => {
    const audioMessagesWithoutTranscription = items.filter((message) => {
      const normalizedType = (message.type || '').toLowerCase();
      if (!['audio', 'voice', 'ptt'].includes(normalizedType)) return false;
      return !formatWhatsAppAudioTranscriptionLabel(message.payload) && !(message.transcription_text || '').trim();
    });

    if (audioMessagesWithoutTranscription.length === 0) {
      return items;
    }

    const payloadsByMessageId = new Map<string, WhatsAppMessagePayload>();
    const concurrency = 4;

    for (let index = 0; index < audioMessagesWithoutTranscription.length; index += concurrency) {
      const chunk = audioMessagesWithoutTranscription.slice(index, index + concurrency);
      const settledResults = await Promise.allSettled(
        chunk.map(async (message) => {
          const { data, error } = await supabase.functions.invoke('transcribe-whatsapp-audio', {
            body: { messageId: message.id },
          });

          if (error) {
            throw error;
          }

          if (data?.payload && typeof data.payload === 'object') {
            return { messageId: message.id, payload: data.payload as WhatsAppMessagePayload };
          }

          return null;
        }),
      );

      settledResults.forEach((result, chunkIndex) => {
        if (result.status === 'fulfilled') {
          if (result.value?.payload) {
            payloadsByMessageId.set(result.value.messageId, result.value.payload);
          }
          return;
        }

        console.error(`Erro ao transcrever áudio ${chunk[chunkIndex]?.id}:`, result.reason);
      });
    }

    if (payloadsByMessageId.size === 0) {
      return items;
    }

    const applyPayloadUpdates = (source: WhatsAppMessage[]) =>
      source.map((message) =>
        payloadsByMessageId.has(message.id)
          ? {
              ...message,
              payload: payloadsByMessageId.get(message.id) ?? message.payload,
              transcription_text:
                getWhatsAppAudioTranscription(payloadsByMessageId.get(message.id))?.text ?? message.transcription_text ?? null,
            }
          : message,
      );

    const nextItems = applyPayloadUpdates(items);

    setMessages((prev) => {
      const nextMessages = applyPayloadUpdates(prev);

      if (selectedChat) {
        const cachedState = messagesCacheRef.current.get(selectedChat.id);
        if (cachedState) {
          messagesCacheRef.current.set(selectedChat.id, createMessagesCacheState({
            ...cachedState,
            messages: nextMessages,
          }));
        }
      }

      return nextMessages;
    });

    return nextItems;
  }, [createMessagesCacheState, selectedChat]);

  const prepareFollowUpContext = useCallback(async () => {
    if (!selectedChat || !selectedChatIsDirect) {
      return null;
    }

    const messagesWithTranscription = await ensureAudioMessagesHaveTranscription(messages);
    const leadName =
      (selectedLead?.name || selectedChatDisplayName || selectedChatPhoneFormatted || selectedChat.id || '').trim();

    return {
      leadName,
      conversationHistory: buildConversationHistoryForCopy(messagesWithTranscription),
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
    buildConversationHistoryForCopy,
    ensureAudioMessagesHaveTranscription,
    messages,
    selectedChat,
    selectedChatDisplayName,
    selectedChatIsDirect,
    selectedChatPhone,
    selectedChatPhoneFormatted,
    selectedLead,
  ]);

  const handleCopyFullChat = async () => {
    if (!selectedChat || messages.length === 0 || isCopyingChat) return;

    try {
      setIsCopyingChat(true);

      const messagesForCopy = await ensureAudioMessagesHaveTranscription(messages);

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
    const existingEquivalentChat = chatsRef.current.find((chat) => areEquivalentDirectChats(chat, nextChat));

    startTransition(() => {
      setChats((prev) => {
        if (existingEquivalentChat) {
          return prev.map((chat) => {
            if (chat.id !== existingEquivalentChat.id) return chat;
            return {
              ...chat,
              name: chat.name ?? nextChat.name,
              phone_number: chat.phone_number ?? nextChat.phone_number,
            };
          });
        }

        if (prev.some((chat) => chat.id === chatId)) return prev;
        return [nextChat, ...prev];
      });
      setSelectedChat(existingEquivalentChat ?? nextChat);
      setChatOnlyUnread(false);
      setChatKindFilters([]);
      setShowNewChatModal(false);
      setNewChatSearch('');
      setNewChatPhone('');
    });
  };

  const findSavedContactByPhone = (phone: string) => {
    const digits = getPhoneDigits(phone);
    if (!digits) return null;

    for (const variant of getDirectIdVariantsFromDigits(digits)) {
      const contact = contactsById.get(variant);
      if (contact) {
        return contact;
      }
    }

    return null;
  };

  const handleOpenSharedContactChat = (contact: { name: string; phone: string }) => {
    const digits = getPhoneDigits(contact.phone);
    if (!digits) {
      toast.warning('Esse contato não possui um telefone válido para abrir conversa.');
      return;
    }

    openChatFromPhone(digits, contact.name);
  };

  const handleSaveSharedContact = async (contact: { name: string; phone: string }) => {
    const digits = getPhoneDigits(contact.phone);
    if (!digits) {
      const message = 'Esse contato não possui um telefone válido para salvar.';
      toast.warning(message);
      throw new Error(message);
    }

    const existingContact = findSavedContactByPhone(digits);
    if (existingContact?.saved) {
      return { alreadySaved: true };
    }

    const resolvedName = (contact.name || existingContact?.name || formatWhatsAppPhoneDisplay(digits) || 'Contato WhatsApp').trim();

    try {
      await addWhatsAppContact(digits, resolvedName);
      await loadSavedContacts();
      return { alreadySaved: false };
    } catch (error) {
      console.error('Error saving WhatsApp contact:', error);
      const message = error instanceof Error ? error.message : 'Erro ao salvar contato.';
      toast.error(message);
      throw error instanceof Error ? error : new Error(message);
    }
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
                    title: reminder.titulo?.trim() || 'Lembrete sem título',
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
      setReminderQuickOpenError('Não foi possível carregar os lembretes agora.');
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
    startTransition(() => {
      setShowRemindersModal(true);
    });

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

  useEffect(() => {
    if (!showRemindersModal) {
      setRenderRemindersModalContent(false);
      return;
    }

    let cancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      if (!cancelled) {
        startTransition(() => {
          setRenderRemindersModalContent(true);
        });
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [showRemindersModal]);

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
      toast.error('Não foi possível marcar este lembrete como lido.');
    } finally {
      setMarkingReminderReadId((current) => (current === item.id ? null : current));
    }
  };

  const runQuickScheduleReminder = async (item: ReminderQuickOpenItem, daysAhead: 1 | 2 | 3) => {
    if (quickSchedulingReminderAction?.reminderId === item.id) return;

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

        startTransition(() => {
          setReminderQuickOpenItems((current) =>
            [...current, nextItem].sort(compareReminderQuickOpenItems),
          );
        });
      }
    } catch (error) {
      console.error('Erro ao criar lembrete rápido no WhatsApp:', error);
      toast.error('Não foi possível criar o novo lembrete rápido.');
      void loadReminderQuickOpen({ preserveExistingItems: true });
    } finally {
      startTransition(() => {
        setQuickSchedulingReminderAction((current) => (current?.reminderId === item.id ? null : current));
      });
    }
  };

  const handleQuickScheduleReminder = (item: ReminderQuickOpenItem, daysAhead: 1 | 2 | 3) => {
    if (quickSchedulingReminderAction?.reminderId === item.id) return;

    startTransition(() => {
      setQuickSchedulingReminderAction({ reminderId: item.id, daysAhead });
    });

    window.requestAnimationFrame(() => {
      void runQuickScheduleReminder(item, daysAhead);
    });
  };

  const handleMarkReminderAsReadAndSchedule = async (item: ReminderQuickOpenItem) => {
    if (markingReminderReadId === item.id) return;

    setMarkingReminderReadId(item.id);

    try {
      await markReminderQuickOpenItemAsRead(item);

      const leadForScheduler = await resolveReminderLeadForScheduling(item);
      if (!leadForScheduler) {
        toast.warning('Lembrete marcado como lido, mas não foi possível abrir o agendamento do próximo contato.');
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
      toast.error('Não foi possível marcar este lembrete como lido.');
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
    console.error('Erro ao registrar histórico de status do lead no WhatsApp:', statusHistoryError);
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
      toast.error('Não foi possível marcar este lead como perdido.');
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

  const patchSelectedChat = (chatId: string, patch: Partial<WhatsAppChat>) => {
    const targetChatIds = resolveEquivalentChatIds(chatId);
    setSelectedChat((current) => {
      if (!current || !targetChatIds.some((candidateId) => getChatIdVariants(current).includes(candidateId))) {
        return current;
      }

      return { ...current, ...patch };
    });
  };

  const resolveEquivalentChatIds = (chatId: string) => {
    const normalizedTargetId = normalizeChatId(chatId);
    const fallbackChat: WhatsAppChat = {
      id: normalizedTargetId,
      is_group: getWhatsAppChatKind(normalizedTargetId) === 'group',
      phone_number: extractPhoneFromChatId(normalizedTargetId),
      lid: normalizedTargetId.toLowerCase().endsWith('@lid') ? normalizedTargetId : null,
      name: null,
      last_message: null,
      last_message_direction: null,
      last_message_at: null,
      unread_count: 0,
      archived: false,
      pinned: 0,
      mute_until: null,
      created_at: '',
      updated_at: '',
    };
    const referenceChat = chatsRef.current.find(
      (chat) => chat.id === normalizedTargetId || areEquivalentDirectChats(chat, fallbackChat),
    ) ?? fallbackChat;

    return Array.from(new Set(getChatIdVariants(referenceChat)));
  };

  const patchChatsByIdentity = (
    chatId: string,
    apply: (chat: WhatsAppChat) => WhatsAppChat,
  ) => {
    const targetChatIds = resolveEquivalentChatIds(chatId);

    setChats((prev) => prev.map((chat) => (targetChatIds.some((candidateId) => getChatIdVariants(chat).includes(candidateId)) ? apply(chat) : chat)));
    return targetChatIds;
  };

  const updateChatArchive = async (chatId: string, archived: boolean) => {
    const targetChatIds = resolveEquivalentChatIds(chatId);
    const previousArchivedById = new Map(
      chatsRef.current
        .filter((chat) => targetChatIds.some((candidateId) => getChatIdVariants(chat).includes(candidateId)))
        .map((chat) => [chat.id, chat.archived ?? false]),
    );

    patchChatsByIdentity(chatId, (chat) => ({ ...chat, archived }));
    patchSelectedChat(chatId, { archived });

    const { data, error } = await supabase
      .from('whatsapp_chats')
      .update({ archived, updated_at: new Date().toISOString() })
      .in('id', targetChatIds)
      .select('id')
      ;

    if (error || !data?.length) {
      setChats((prev) => prev.map((chat) => (previousArchivedById.has(chat.id) ? { ...chat, archived: previousArchivedById.get(chat.id) ?? false } : chat)));
      patchSelectedChat(chatId, { archived: previousArchivedById.get(selectedChatRef.current?.id || '') ?? false });
      console.error('Erro ao atualizar arquivamento do chat:', error ?? 'Nenhuma linha atualizada (RLS/permissao).');
    }
  };

  const updateChatMute = async (chatId: string, muteUntil: string | null) => {
    const targetChatIds = resolveEquivalentChatIds(chatId);
    const previousMuteById = new Map(
      chatsRef.current
        .filter((chat) => targetChatIds.some((candidateId) => getChatIdVariants(chat).includes(candidateId)))
        .map((chat) => [chat.id, chat.mute_until ?? null]),
    );

    patchChatsByIdentity(chatId, (chat) => ({ ...chat, mute_until: muteUntil }));
    patchSelectedChat(chatId, { mute_until: muteUntil });

    const { data, error } = await supabase
      .from('whatsapp_chats')
      .update({ mute_until: muteUntil, updated_at: new Date().toISOString() })
      .in('id', targetChatIds)
      .select('id')
      ;

    if (error || !data?.length) {
      setChats((prev) => prev.map((chat) => (previousMuteById.has(chat.id) ? { ...chat, mute_until: previousMuteById.get(chat.id) ?? null } : chat)));
      patchSelectedChat(chatId, { mute_until: previousMuteById.get(selectedChatRef.current?.id || '') ?? null });
      console.error('Erro ao atualizar mute do chat:', error ?? 'Nenhuma linha atualizada (RLS/permissao).');
    }
  };

  const updateChatPinned = async (chatId: string, pinned: number) => {
    const targetChatIds = resolveEquivalentChatIds(chatId);
    const previousPinnedById = new Map(
      chatsRef.current
        .filter((chat) => targetChatIds.some((candidateId) => getChatIdVariants(chat).includes(candidateId)))
        .map((chat) => [chat.id, chat.pinned ?? 0]),
    );

    setChats((prev) =>
      prev
        .map((chat) => (targetChatIds.some((candidateId) => getChatIdVariants(chat).includes(candidateId)) ? { ...chat, pinned } : chat))
        .sort(sortChatsByLatest),
    );
    patchSelectedChat(chatId, { pinned });

    const { data, error } = await supabase
      .from('whatsapp_chats')
      .update({ pinned, updated_at: new Date().toISOString() })
      .in('id', targetChatIds)
      .select('id')
      ;

    if (error || !data?.length) {
      setChats((prev) => prev.map((chat) => (previousPinnedById.has(chat.id) ? { ...chat, pinned: previousPinnedById.get(chat.id) ?? 0 } : chat)).sort(sortChatsByLatest));
      patchSelectedChat(chatId, { pinned: previousPinnedById.get(selectedChatRef.current?.id || '') ?? 0 });
      console.error('Erro ao atualizar fixação do chat:', error ?? 'Nenhuma linha atualizada (RLS/permissão).');
    }
  };

  const markChatAsUnread = async (chat: WhatsAppChat) => {
    const activeUser = userRef.current;
    if (!activeUser) return;

    const chatIds = getChatIdVariants(chat);
    if (chatIds.length === 0) return;

    try {
      const cachedMessages = messagesCacheRef.current.get(chat.id)?.messages ?? [];
      let targetInbound: WhatsAppMessage | null = [...cachedMessages]
        .filter((message) => chatIds.includes(message.chat_id) && message.direction === 'inbound')
        .sort(sortMessagesChronologically)
        .slice(-1)[0] ?? null;

      if (!targetInbound) {
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('id, chat_id, direction, timestamp, created_at')
          .in('chat_id', chatIds)
          .eq('direction', 'inbound')
          .order('timestamp', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        targetInbound = (data as WhatsAppMessage | null) ?? null;
      }

      if (targetInbound) {
        const { error } = await supabase
          .from('whatsapp_message_reads')
          .delete()
          .eq('message_id', targetInbound.id)
          .eq('user_id', activeUser.id);

        if (error) throw error;
      }

      setChats((prev) =>
        prev.map((item) =>
          chatIds.some((candidateId) => getChatIdVariants(item).includes(candidateId))
            ? {
                ...item,
                unread_count: Math.max(1, item.unread_count ?? 0),
              }
            : item,
        ),
      );
      scheduleUnreadCountsRefresh(50);
    } catch (error) {
    console.error('Erro ao marcar chat como não lido:', error);
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
      toast.error('Erro ao atualizar status do lead.');
    }
  };

  const showChatList = !isMobileView || !selectedChat;
  const showMessageArea = !isMobileView || selectedChat;

  const hasChatSnapshot = chats.length > 0;
  const deferredReminderQuickOpenItems = useDeferredValue(reminderQuickOpenItems);
  const groupedReminderQuickOpenItems = useMemo(
    () => (renderRemindersModalContent ? groupReminderQuickOpenItems(deferredReminderQuickOpenItems) : {
      overdue: [],
      today: [],
      thisWeek: [],
      thisMonth: [],
      later: [],
    }),
    [deferredReminderQuickOpenItems, renderRemindersModalContent],
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
      {forwardMessage && (
        <ModalShell
          isOpen
          onClose={closeForwardModal}
          title="Encaminhar mensagem"
          size="md"
          panelClassName="max-w-lg"
        >
          <div className="space-y-4">
            <div className="comm-banner px-4 py-3">
              <div className="comm-accent-text text-xs font-medium">Mensagem selecionada</div>
              <div className="comm-text mt-1 text-sm">{getMessagePreview(forwardMessage) || 'Mensagem'}</div>
            </div>

            <Input
              type="text"
              leftIcon={Search}
              placeholder="Buscar conversa..."
              value={forwardSearch}
              onChange={(event) => setForwardSearch(event.target.value)}
            />

            <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]">
              {filteredForwardChats.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">Nenhuma conversa encontrada.</div>
              ) : (
                filteredForwardChats.map((item) => {
                  const isSelected = selectedForwardChatIds.has(item.chat.id);

                  return (
                    <button
                      key={item.chat.id}
                      type="button"
                      className={`flex w-full items-start gap-3 border-b border-[var(--panel-border-subtle,#e7dac8)] px-4 py-3 text-left transition-colors last:border-b-0 ${
                        isSelected
                          ? 'bg-[var(--panel-surface-muted,#f7f0e7)]'
                          : 'hover:bg-[var(--panel-surface-soft,#f4ede3)]'
                      }`}
                      onClick={() => toggleForwardTargetChat(item.chat.id)}
                      disabled={isForwardingMessage}
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                          isSelected
                            ? 'border-[var(--panel-accent-border,#a96428)] bg-[var(--panel-accent-strong,#8a4b16)] text-white'
                            : 'border-[var(--panel-border,#d4c0a7)] bg-white text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="comm-title truncate text-sm font-medium">{item.displayName}</span>
                          <span className="comm-muted shrink-0 text-[11px]">{item.formattedTime || '-'}</span>
                        </div>
                        <div className="comm-muted mt-1 truncate text-xs">{item.previewText}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="comm-muted text-xs">
                {forwardTargetChatIds.length === 0
                  ? 'Selecione pelo menos uma conversa.'
                  : `${forwardTargetChatIds.length} conversa(s) selecionada(s)`}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeForwardModal}
                  disabled={isForwardingMessage}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirmForwardMessage()}
                  loading={isForwardingMessage}
                  disabled={forwardTargetChatIds.length === 0}
                >
                  Encaminhar
                </Button>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
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
                Número
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
                  {isLoadingLeadDirectory ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando leads...
                    </div>
                  ) : filteredLeads.length === 0 ? (
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
            <div className="panel-glass-panel rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-soft,#f4ede3)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="comm-title text-sm font-semibold">Abertura rápida de conversas</p>
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

            {!renderRemindersModalContent ? (
              <div className="comm-card px-3 py-4 text-sm comm-text">
                Preparando lembretes...
              </div>
            ) : (isLoadingReminderQuickOpen || !hasLoadedReminderQuickOpen) &&
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
                      title="Marcar como lido e reagendar para 1 dia útil"
                      aria-label="Marcar como lido e reagendar para 1 dia útil"
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
                  title="Configurações do WhatsApp"
                  aria-label="Configurações do WhatsApp"
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/painel/whatsapp/config');
                  }}
                >
                  <Settings className="h-4 w-4" />
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
                        { id: 'unread', label: 'Não lidas', count: unreadInboxCount },
                    { id: 'direct', label: 'Diretas', count: directInboxCount },
                    { id: 'groups', label: 'Grupos', count: groupInboxCount },
                    { id: 'channels', label: 'Canais', count: channelInboxCount },
                    { id: 'broadcasts', label: 'Transmissões', count: broadcastInboxCount },
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
                              <p className="text-sm font-semibold text-slate-900">Segmentação CRM</p>
                      <p className="text-[11px] text-slate-500">Combine status, responsável e vínculo sem poluir a inbox.</p>
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
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Responsável</span>
                      <select
                        value={chatLeadOwnerFilter}
                        onChange={(event) => setChatLeadOwnerFilter(event.target.value)}
                        className="h-10 rounded-xl border border-[var(--panel-border-subtle,#d8c5ae)] bg-white/90 px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="all">Todos os responsáveis</option>
                        <option value={EMPTY_FILTER_VALUE}>Sem responsável</option>
                        {chatLeadOwnerOptions.map((owner) => (
                          <option key={owner} value={owner}>
                            {owner}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Vínculo CRM</span>
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
                            {nextUnreadChat ? `Próxima não lida (${unreadQueue.length})` : 'Fila zerada'}
              </Button>
            </div>
          </div>

          <div ref={chatListViewportRef} className="flex-1 overflow-y-auto" onScroll={handleChatListScroll}>
            {visibleChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <MessageCircle className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium">Nenhuma conversa</p>
                <p className="text-sm">As mensagens do WhatsApp aparecerão aqui</p>
              </div>
            ) : (
              <div style={{ paddingTop: virtualChatPaddingTop, paddingBottom: virtualChatPaddingBottom }}>
                {virtualChatItems.map((item) => (
                  <InboxChatRow
                    key={item.chat.id}
                    item={item}
                    isSelected={selectedChat?.id === item.chat.id}
                    onSelectChat={selectChat}
                    onOpenChatContextMenu={openChatContextMenu}
                  />
                ))}
              </div>
            )}
          </div>
          {chatMenu && chatMenuLayout && chatMenuTarget?.chat && (
            <div
              ref={chatMenuRef}
              className="comm-popover fixed z-50 w-64 overflow-hidden text-sm"
              style={{ left: chatMenuLayout.left, top: chatMenuLayout.top }}
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none"
                onClick={() => {
                  runDeferredChatMenuAction(() =>
                    updateChatArchive(chatMenuTarget.chat!.id, !chatMenuTarget.chat!.archived),
                  );
                }}
              >
                <Archive className="h-4 w-4" />
                <span>{chatMenuTarget.chat.archived ? 'Desarquivar' : 'Arquivar'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none"
                onClick={() => {
                  runDeferredChatMenuAction(() => markChatAsUnread(chatMenuTarget.chat!));
                }}
              >
                <Circle className="h-4 w-4" />
                <span>Marcar como não lida</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none"
                onClick={() => {
                  runDeferredChatMenuAction(() =>
                    updateChatPinned(chatMenuTarget.chat!.id, chatMenuTarget.isPinned ? 0 : Date.now()),
                  );
                }}
              >
                <Pin className="h-4 w-4" />
                <span>{chatMenuTarget.isPinned ? 'Desafixar' : 'Fixar'}</span>
              </Button>
              <div className="mx-3 border-t border-[var(--panel-border-subtle,#e7dac8)]" />
              {(() => {
                const muteOptions = [
                  { label: '1 hora', ms: 60 * 60 * 1000 },
                  { label: '1 dia', ms: 24 * 60 * 60 * 1000 },
                  { label: '1 semana', ms: 7 * 24 * 60 * 60 * 1000 },
                  { label: '1 mês', ms: 30 * 24 * 60 * 60 * 1000 },
                  { label: 'Definitivo', ms: 365 * 24 * 60 * 60 * 1000 },
                ];
                return (
                  <div className="py-1">
                    {chatMenuTarget.isMuted ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none"
                        onClick={() => {
                          runDeferredChatMenuAction(() => updateChatMute(chatMenuTarget.chat!.id, null));
                        }}
                      >
                        <BellOff className="h-4 w-4" />
                        <span>Desmutar</span>
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
                          className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none"
                          onClick={openMuteSubmenu}
                        >
                          <span className="flex items-center gap-3">
                            <Bell className="h-4 w-4" />
                            <span>Mutar</span>
                          </span>
                          {chatMenuLayout.submenuOpensLeft ? (
                            <ChevronLeft className="ml-auto h-4 w-4 comm-muted" />
                          ) : (
                            <ChevronRight className="ml-auto h-4 w-4 comm-muted" />
                          )}
                        </Button>
                        {chatMenuMuteOpen && (
                          <div className={`absolute top-0 z-10 ${chatMenuLayout.submenuOpensLeft ? 'right-full pr-1' : 'left-full pl-1'}`}>
                            <div className="comm-popover min-w-[180px] overflow-hidden">
                              <div className="comm-popover-header px-3 py-2">
                                <span className="comm-title text-xs font-semibold uppercase tracking-[0.08em]">Mutar</span>
                              </div>
                              {muteOptions.map((option) => (
                                <Button
                                  key={option.label}
                                  variant="ghost"
                                  size="sm"
                                  fullWidth
                                  className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none"
                                  onClick={() => {
                                    const until = new Date(Date.now() + option.ms).toISOString();
                                    runDeferredChatMenuAction(() => updateChatMute(chatMenuTarget.chat!.id, until));
                                  }}
                                >
                                  <Clock3 className="h-4 w-4" />
                                  <span>{option.label}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        runDeferredChatMenuAction(() => handleCopyChatPhone(chatMenuTarget.chat!, chatMenuTarget.phone));
                      }}
                      disabled={!chatMenuTarget.phone}
                    >
                      <Copy className="h-4 w-4" />
                        <span>Copiar número</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        runDeferredChatMenuAction(() => handleOpenLeadFromChat(chatMenuTarget.lead?.id));
                      }}
                      disabled={!chatMenuTarget.canOpenLead}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Abrir lead/CRM</span>
                    </Button>
                    <div className="relative" onMouseEnter={() => chatMenuTarget.canUpdateStatus && openStatusSubmenu()} onMouseLeave={closeStatusSubmenuSoon}>
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          if (chatMenuTarget.canUpdateStatus) {
                            openStatusSubmenu();
                          }
                        }}
                        disabled={!chatMenuTarget.canUpdateStatus}
                      >
                          <span className="flex items-center gap-3">
                            <SlidersHorizontal className="h-4 w-4" />
                            <span>Status</span>
                          </span>
                        {chatMenuLayout.submenuOpensLeft ? (
                          <ChevronLeft className="ml-auto h-4 w-4 comm-muted" />
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 comm-muted" />
                        )}
                      </Button>
                      {chatMenuStatusOpen && chatMenuTarget.lead && (
                        <div className={`absolute top-0 z-10 ${chatMenuLayout.submenuOpensLeft ? 'right-full pr-1' : 'left-full pl-1'}`}>
                          <div className="comm-popover min-w-[220px] overflow-hidden">
                            <div className="comm-popover-header px-3 py-2">
                              <span className="comm-title text-xs font-semibold uppercase tracking-[0.08em]">Atualizar status</span>
                            </div>
                            {leadStatuses.map((status) => (
                              <Button
                                key={status.id}
                                variant="ghost"
                                size="sm"
                                fullWidth
                                className="comm-menu-item h-auto justify-start rounded-none border-0 px-3 py-2 text-sm shadow-none"
                                onClick={() => {
                                  runDeferredChatMenuAction(() =>
                                    handleUpdateLeadStatus(status.nome, chatMenuTarget.lead?.id),
                                  );
                                }}
                              >
                                <Circle className="h-4 w-4" />
                                <span>{status.nome}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                <WhatsAppChatAvatar
                  kind={selectedChatKind ?? 'unknown'}
                  alt={selectedChatDisplayName || selectedChat.id}
                  photoSources={selectedChatPhotoSources}
                  shellClassName="h-10 w-10 flex-shrink-0"
                  loading="eager"
                  decoding="async"
                />
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
                                  ? 'Feed de atualizações de status'
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
                  {selectedChatKind === 'group' || selectedChatIsDirect ? (
                    <Button
                      variant="icon"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() => setShowConversationInfo(!showConversationInfo)}
                      title={selectedChatKind === 'group' ? 'Informações do grupo' : 'Informações do contato'}
                    >
                      <Info className="w-5 h-5 text-slate-600" />
                    </Button>
                  ) : null}
                  {selectedChatIsDirect ? (
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
                    disabled={syncingChatId === selectedChat.id}
                  >
                    <History
                      className={`w-5 h-5 text-slate-600 ${syncingChatId === selectedChat.id ? 'animate-spin' : ''}`}
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
                      openChatContextMenu(selectedChat.id, event.currentTarget.getBoundingClientRect(), 'header-button');
                    }}
                  >
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </Button>
                </div>
              </div>

              <div
                ref={messagesViewportRef}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-1"
                onScroll={handleMessagesViewportScroll}
              >
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
                                <p>{isLoadingMessages ? 'Carregando atualizações...' : isSelectedStatusChat ? 'Nenhuma atualização de status ainda' : 'Nenhuma mensagem ainda'}</p>
                  </div>
                ) : (
                  <div style={{ paddingTop: virtualMessagePaddingTop, paddingBottom: virtualMessagePaddingBottom }}>
                    {visibleRenderedMessageItems.map(({ message, timestamp, shouldShowDaySeparator, daySeparatorLabel, authorName, reactions, forwardPlan }) => {
                      return (
                        <div
                          key={message.id}
                          ref={(node) => setMessageRowElement(message.id, node)}
                          data-message-id={message.id}
                          style={OFFSCREEN_MESSAGE_STYLE}
                        >
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
                            timestamp={timestamp}
                            ackStatus={message.ack_status}
                            sendState={message.send_state}
                            errorMessage={message.error_message}
                            hasMedia={message.has_media}
                            payload={message.payload}
                            reactions={reactions}
                            fromName={authorName}
                            isDeleted={message.is_deleted}
                            deletedAt={message.deleted_at}
                            editCount={message.edit_count}
                            editedAt={message.edited_at}
                            originalBody={message.original_body}
                            isForwarded={isWhatsAppPayloadForwarded(message.payload)}
                            onReact={isSelectedStatusChat ? undefined : handleReact}
                            onReply={isSelectedStatusChat ? undefined : handleReply}
                            onForward={forwardPlan ? () => handleOpenForwardModal(message) : undefined}
                            onEdit={isSelectedStatusChat ? undefined : handleEdit}
                            onRetryFailed={message.send_state === 'failed' ? () => void retryFailedMessage(message) : undefined}
                            onDismissFailed={message.send_state === 'failed' ? () => removeFailedMessage(message.chat_id, message.id) : undefined}
                            onTranscriptionSaved={isSelectedStatusChat ? undefined : handleAudioTranscriptionSaved}
                            onSaveSharedContact={isSelectedStatusChat ? undefined : handleSaveSharedContact}
                            onOpenSharedContactChat={isSelectedStatusChat ? undefined : handleOpenSharedContactChat}
                            getMediaGalleryItems={isVisualMediaMessage(message) ? getMediaGalleryItems : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              {pendingMessagesBelow > 0 && (
                <div
                  className="pointer-events-none absolute right-6 z-20"
                  style={{ bottom: `${composerHeight + 16}px` }}
                >
                  <Button
                    variant="warning"
                    size="sm"
                    className="pointer-events-auto h-auto rounded-full px-3 py-1.5 text-xs shadow-lg"
                    onClick={() => {
                      scrollToBottom();
                      clearPendingMessagesBelow();
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {pendingMessagesBelow === 1 ? '1 nova mensagem' : `${pendingMessagesBelow} novas mensagens`}
                  </Button>
                </div>
              )}

              {!isSelectedStatusChat ? (
                <>
                  <div ref={composerContainerRef}>
                    <MessageInput
                      key={selectedChat.id}
                      chatId={selectedChat.id}
                      contacts={contactsList}
                      templateVariables={templateVariablesForInput}
                      templateVariableShortcuts={TEMPLATE_VARIABLE_SHORTCUTS}
                      followUpContext={followUpContextForInput}
                      onPrepareFollowUpContext={prepareFollowUpContext}
                      onMessageSent={handleMessageSent}
                      onMessageEdited={handleMessageEdited}
                      replyToMessage={replyToMessage}
                      onCancelReply={handleCancelReply}
                      editMessage={editMessage}
                      onCancelEdit={handleCancelEdit}
                    />
                  </div>
                </>
              ) : (
                <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                Este painel mostra somente atualizações de status recebidas. O composer de conversa fica disponível apenas em chats e grupos.
                </div>
              )}

              {showConversationInfo && selectedChatKind === 'group' && (
                <GroupInfoPanel
                  groupId={selectedChat.id}
                  onClose={() => setShowConversationInfo(false)}
                />
              )}
              {showConversationInfo && selectedChatIsDirect && (
                <DirectChatInfoPanel
                  displayName={selectedChatDisplayName || selectedChat.id}
                  phoneFormatted={selectedChatPhoneFormatted}
                  photoSources={selectedChatPhotoSources}
                  contact={selectedContact}
                  lead={effectiveSelectedLeadInfo}
                  isLoadingLead={isLoadingSelectedLeadInfo}
                  isSavingContact={isSavingSelectedContact}
                  isDeletingContact={isDeletingSelectedContact}
                  isSavingLead={isSavingSelectedLeadInfo}
                  isDeletingLead={isDeletingSelectedLeadInfo}
                  onClose={() => setShowConversationInfo(false)}
                  onOpenLead={selectedLead?.id ? () => handleOpenLeadFromChat(selectedLead.id) : undefined}
                  onCreateLead={handleCreateLeadFromSelectedChat}
                  onSaveContact={handleSaveSelectedContactInfo}
                  onDeleteContact={handleDeleteSelectedContactInfo}
                  onSaveLead={handleSaveSelectedLeadInfo}
                  onDeleteLead={handleDeleteSelectedLeadInfo}
                />
              )}

              {leadCreationInitialValues && (
                <LeadForm
                  lead={null}
                  initialValues={leadCreationInitialValues}
                  onClose={() => setLeadCreationInitialValues(null)}
                  onSave={handleLeadCreatedFromSelectedChat}
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



