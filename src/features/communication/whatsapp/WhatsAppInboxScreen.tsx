import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AlertTriangle, Archive, ArchiveRestore, Bell, BellOff, Bot, CalendarClock, Clock3, Copy, Download, FolderOpen, Info, Loader2, MessageCircle, Pin, Search, Sparkles, Trash2, WifiOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import '../communicationTerracotta.css';
import {
  Alert,
  Button,
  LoadingState,
} from '../../../design-system';
import { useFavoritedLeadIds } from '../../../lib/leadFavoriteService';
import PanelPopoverShell from '../../../components/ui/PanelPopoverShell';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { applyTemplateVariables } from '../../../lib/autoContactService';
import {
  whatsappContactsRepository,
  whatsappConversationsRepository,
  whatsappFollowUpService,
  whatsappMediaRepository,
  whatsappMessagesRepository,
  commWhatsAppService,
  approveInboxFollowUpSchedule,
  clearInboxLeadAgenda,
  insertInboxLegacyFollowUpAudits,
  listInboxAgendaReminders,
  markInboxRemindersRead,
  scheduleInboxFollowUp,
  subscribeToInboxReminders,
  updateInboxFollowUpSentAudit,
  updateInboxFollowUpSentAudits,
  type CommWhatsAppLeadContractSummary,
  type CommWhatsAppLeadPanel,
  type CommWhatsAppOperationalState,
  type CommWhatsAppFollowUpEmotionalContext,
  type CommWhatsAppFollowUpNextAction,
  type CommWhatsAppFollowUpVariation,
  type CommWhatsAppRewriteTone,
  type InboxAgendaSummaryReminder,
} from './data';
import { configService, type IntegrationSetting } from '../../config';
import type { Lead } from '../../leads';
import { formatDateTimeFullBR, isOverdue } from '../../../lib/dateUtils';
import { toast } from '../../../lib/toast';
import { splitWhatsAppMessageSegments } from '../../../lib/whatsAppMessageSegments';
import { isSupabaseConnectivityError } from '../../../infrastructure/supabase';
import type { CommWhatsAppChat, CommWhatsAppMessage } from './domain/types';
import {
  canDeleteOutboundMessage,
  canEditOutboundMessage,
  canReplyOrForwardMessage,
  getMessageEditableText,
  getMessageSearchPreviewText,
  getQuotePayloadFromMessage,
  normalizeInboxSearch,
} from './domain/messagePresentation';
import {
  buildDeletedMessageSummary,
  getDeletedMessageMarker,
} from './domain/messageMetadata';
import {
  compareMessageChronology,
  dedupeObviousDuplicateMessages,
  formatMessageTime,
  getMessageTimestampMs,
  mergeMessages,
} from './domain/messageTimeline';
import {
  applyChatPresenceUpdate,
  applySavedContactName,
  getSafeChatDisplayName,
  mergeUniqueChats,
  preserveUsefulChatPreview,
  rankChatsBySearch,
  resolveStableDeliveryStatus,
  sortChatsByInboxOrder,
  stabilizeChatIdentityForLocalMerge,
} from './domain/chatPresentation';
import { addSavedContactsToNameMap, applyManualSavedContactNameToMaps, applySavedContactNameFromLookup, applySavedContactNameToContact, collectPhoneLookupKeys, getSavedContactNameForPhone, resolveSavedContactName } from './domain/contactLookup';
import {
  buildTranscriptLine,
  normalizeSystemTimeZone,
} from './domain/messageTranscript';
import { shouldHideTechnicalMessage } from './domain/messageVisibility';
import {
  WHATSAPP_QUICK_REPLIES_INTEGRATION_DESCRIPTION,
  WHATSAPP_QUICK_REPLIES_INTEGRATION_NAME,
  WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG,
  buildQuickReplyShortcut,
  buildWhatsAppQuickRepliesSettings,
  getActiveQuickReplyMatch,
  normalizeQuickReplyLookup,
  normalizeWhatsAppQuickRepliesSettings,
  summarizeQuickReplyPreview,
  type WhatsAppQuickReply,
} from './domain/quickReplies';
import { type WhatsAppTextFormat } from './components/WhatsAppFormattedText';
import { WhatsAppMediaViewer } from './components/WhatsAppMediaViewer';
import { WhatsAppMessageThread } from './components/WhatsAppMessageThread';
import { WhatsAppComposer } from './components/WhatsAppComposer';
import { WhatsAppInboxSidebar } from './components/WhatsAppInboxSidebar';
import { WhatsAppThreadHeader } from './components/WhatsAppThreadHeader';
import { WhatsAppMessagePopovers } from './components/WhatsAppMessagePopovers';
import { WhatsAppChatMessageSearch } from './components/WhatsAppChatMessageSearch';
import { WhatsAppInboxDialogs } from './components/WhatsAppInboxDialogs';
import { isChatMediaViewerMessage } from './domain/mediaViewerPresentation';
import { buildInboxMessageTimeline } from './domain/inboxMessageTimeline';
import { formatConnectionStatusLabel } from './domain/inboxPresentation';
import { KeyedActionLock } from './components/keyedActionLock';
import {
  InboxFilterGroup,
  InboxMultiFilterGroup,
} from './components/WhatsAppInboxList';
import type { WhatsAppBatchFollowUpSendProgress } from './components/WhatsAppBatchFollowUpModal';
import { ComposerSendLock } from './components/composerSendLock';
import { WhatsAppInboxSelectionProvider, type WhatsAppInboxSelectionContextValue } from './WhatsAppInboxSelectionContext';
import { useCommWhatsAppMessageRealtime } from './hooks/useCommWhatsAppMessageRealtime';
import { useInboxChannelSubscriptions } from './hooks/useInboxChannelSubscriptions';
import { useWhatsAppInboxDeepLink } from './hooks/useWhatsAppInboxDeepLink';
import { useWindowPollingState } from './hooks/useWindowPollingState';
import { useComposerDraft } from './hooks/useComposerDraft';
import { useChatSearch } from './hooks/useChatSearch';
import { useChatMessageSearch } from './hooks/useChatMessageSearch';
import { useClickOutside } from './hooks/useClickOutside';
import {
  mergeCommWhatsAppMessage,
  getMessageDisplayMetadataSignature,
} from './messageStatus';
import {
  clearPendingChatReadState,
  mergePendingChatInboxState,
  type PendingChatInboxStatePatch,
} from './pendingChatInboxState';
import { normalizeWhapiDirectChatId } from './whatsAppChatId';
import { lazyWithChunkRecovery } from '../../../routes/lazyImport';
import { useInboxPolling } from './hooks/useInboxPolling';
import { useInboxStartChatSources } from './hooks/useInboxStartChatSources';
import { useInboxLeadSearch } from './hooks/useInboxLeadSearch';
import { useInboxMessageSending } from './hooks/useInboxMessageSending';
import { useInboxMessageRetry } from './hooks/useInboxMessageRetry';
import { useInboxSendQueue } from './hooks/useInboxSendQueue';
import { useInboxChatCreation } from './hooks/useInboxChatCreation';
import { useInboxLeadMutations } from './hooks/useInboxLeadMutations';
import { useInboxComposerAttachments } from './hooks/useInboxComposerAttachments';
import { useInboxMessageLoader, type InboxMessageLoadReason } from './hooks/useInboxMessageLoader';
import { useInboxMessageNavigation } from './hooks/useInboxMessageNavigation';
import { useInboxLeadPanel } from './hooks/useInboxLeadPanel';
import { useInboxChatMutations } from './hooks/useInboxChatMutations';
import { useInboxChatLoader } from './hooks/useInboxChatLoader';
import { useInboxOperationalState } from './hooks/useInboxOperationalState';
import { useInboxRealtimeUpdates } from './hooks/useInboxRealtimeUpdates';
import { useInboxOptimisticOutgoingMessages } from './hooks/useInboxOptimisticOutgoingMessages';
import { useInboxOlderMessages } from './hooks/useInboxOlderMessages';
import { useInboxMessageSelection } from './hooks/useInboxMessageSelection';
import { useInboxMessageStatusRefresh } from './hooks/useInboxMessageStatusRefresh';
import { useInboxSelectedChatPreviewRefresh } from './hooks/useInboxSelectedChatPreviewRefresh';
import { useInboxSelectedLeadRealtime } from './hooks/useInboxSelectedLeadRealtime';
import { useInboxMessageReactionActions } from './hooks/useInboxMessageReactionActions';
import { resolveBatchFollowUpFinalStatus, type BatchFollowUpFinalStatus } from './domain/batchFollowUpOutcome';
import { createChatFilterMatcher, type ChatActivityFilter } from './domain/chatFilters';
import {
  clearMediaUploadProgressForChat,
  setMediaUploadProgressForChat,
  updateMediaUploadProgressForChat,
  type MediaUploadProgress,
} from './domain/mediaUploadState';

const LeadForm = lazyWithChunkRecovery(() => import('../../../components/LeadForm'));
const ReminderSchedulerModal = lazyWithChunkRecovery(() => import('../../../components/ReminderSchedulerModal'));
const WhatsAppAgendaModal = lazyWithChunkRecovery(() => import('./components/WhatsAppAgendaModal'));
const WhatsAppComposerRewriteModal = lazyWithChunkRecovery(() => import('./components/WhatsAppComposerRewriteModal'));
const WhatsAppDashboardModal = lazyWithChunkRecovery(() => import('./components/WhatsAppDashboardModal'));
const WhatsAppEditMessageModal = lazyWithChunkRecovery(() => import('./components/WhatsAppEditMessageModal'));
const WhatsAppFollowUpModal = lazyWithChunkRecovery(() => import('./components/WhatsAppFollowUpModal'));
const WhatsAppMessageDetailsModal = lazyWithChunkRecovery(() => import('./components/WhatsAppMessageDetailsModal'));
const WhatsAppMediaDrawer = lazyWithChunkRecovery(() => import('./components/WhatsAppMediaDrawer'));
const WhatsAppLeadDrawer = lazyWithChunkRecovery(() => import('./components/WhatsAppLeadDrawer'));
const WhatsAppChatFilesDrawer = lazyWithChunkRecovery(() => import('./components/WhatsAppChatFilesDrawer'));
const WhatsAppQuickRepliesModal = lazyWithChunkRecovery(() => import('./components/WhatsAppQuickRepliesModal'));
const WhatsAppStartChatModal = lazyWithChunkRecovery(() => import('./components/WhatsAppStartChatModal'));
const WhatsAppScheduleMessageModal = lazyWithChunkRecovery(() => import('./components/WhatsAppScheduleMessageModal'));
const WhatsAppScheduledMessagesPanel = lazyWithChunkRecovery(() => import('./components/WhatsAppScheduledMessagesPanel'));

function InboxLazyLoadingFallback() {
  return (
    <div
      className="kds-dialog-overlay modal-theme-host painel-theme kifer-ds"
      role="status"
      aria-live="polite"
      aria-label="Abrindo janela"
    >
      <div className="kds-dialog-backdrop" aria-hidden="true" />
      <div className="kds-dialog-container pointer-events-none">
        <div className="kds-dialog max-w-sm p-6" aria-hidden="true">
          <LoadingState
            compact
            label="Abrindo janela"
            description="Só um instante."
          />
        </div>
      </div>
    </div>
  );
}

const CHAT_PAGE_SIZE = 250;
const SCROLL_BOTTOM_THRESHOLD_PX = 96;
const STALE_WEBHOOK_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const CHAT_IDENTITY_LOOKUP_MAX_CHATS_PER_CYCLE = 30;
const CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const SAVED_CONTACT_FORCE_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REACTION_PICKER_WIDTH_PX = 252;
const REACTION_PICKER_HEIGHT_PX = 52;
const REFRESHABLE_OUTBOUND_STATUSES = new Set(['pending', 'queued', 'sending', 'sent', 'delivered']);
const CHAT_READ_RETRY_COOLDOWN_MS = 30_000;

type ScrollMode = 'bottom' | 'preserve' | 'prepend' | null;
type QuickReplyOption = {
  id: string;
  name: string;
  shortcut: string;
  text: string;
  preview: string;
  searchValue: string;
};
type ChatAgendaSummary = {
  pendingCount: number;
  nextReminder: InboxAgendaSummaryReminder | null;
};
type CreateLeadDraft = {
  chatId: string;
  initialValues: Partial<Lead>;
};
type PointerAnchor = {
  x: number;
  y: number;
};

const createVirtualAnchorRect = (anchor: PointerAnchor) => ({
  left: anchor.x,
  right: anchor.x,
  top: anchor.y,
  bottom: anchor.y,
  width: 0,
  height: 0,
});

const DEFAULT_QUICK_REPLIES = normalizeWhatsAppQuickRepliesSettings(null).quickReplies;

export default function WhatsAppInboxScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const { leadStatuses, options, getRoleModulePermission } = useConfig();
  const responsavelOptions = options.lead_responsavel;
  const agendaPermission = getRoleModulePermission(role, 'agenda');
  const canViewAgenda = agendaPermission.can_view;
  const canEditAgenda = agendaPermission.can_edit;
  const favoritedLeadIds = useFavoritedLeadIds();
  const [loading, setLoading] = useState(true);
  const [chatLoadError, setChatLoadError] = useState(false);
  const [chatRefreshError, setChatRefreshError] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFiltersPosition, setAdvancedFiltersPosition] = useState<{ top: number; left: number } | null>(null);
  const [chatActivityFilter, setChatActivityFilter] = useState<ChatActivityFilter>('all');
  const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>([]);
  const [leadResponsavelFilters, setLeadResponsavelFilters] = useState<string[]>([]);
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState<string | null>(null);
  const [messageLoadRetrying, setMessageLoadRetrying] = useState(false);
  const [chatMessageSearchOpen, setChatMessageSearchOpen] = useState(false);
  const [chatMessageSearchDraft, setChatMessageSearchDraft] = useState('');
  const [threadReconcileChatId, setThreadReconcileChatId] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);
  const [archivedChatsCount, setArchivedChatsCount] = useState<number | null>(null);
  const [archivedChatsLoading, setArchivedChatsLoading] = useState(false);
  const [archivedChatsLoadingMore, setArchivedChatsLoadingMore] = useState(false);
  const [archivedChatsHasMore, setArchivedChatsHasMore] = useState(false);
  const [archivedChatsPage, setArchivedChatsPage] = useState(0);
  const [updatingChatStateId, setUpdatingChatStateId] = useState<string | null>(null);
  const [assumingControlChatId, setAssumingControlChatId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [quickReplyIntegration, setQuickReplyIntegration] = useState<IntegrationSetting | null>(null);
  const [quickReplies, setQuickReplies] = useState<WhatsAppQuickReply[]>(DEFAULT_QUICK_REPLIES);
  const [quickRepliesLoadError, setQuickRepliesLoadError] = useState(false);
  const [quickRepliesLoadRetryToken, setQuickRepliesLoadRetryToken] = useState(0);
  const [quickRepliesModalOpen, setQuickRepliesModalOpen] = useState(false);
  const [savingQuickReplies, setSavingQuickReplies] = useState(false);
  const [chatPendingDeletion, setChatPendingDeletion] = useState<CommWhatsAppChat | null>(null);
  const [messagePendingDeletion, setMessagePendingDeletion] = useState<CommWhatsAppMessage | null>(null);
  const [saveContactDialogOpen, setSaveContactDialogOpen] = useState(false);
  const [saveContactName, setSaveContactName] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [whatsAppAgendaOpen, setWhatsAppAgendaOpen] = useState(false);
  const [whatsAppDashboardOpen, setWhatsAppDashboardOpen] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpCustomInstructions, setFollowUpCustomInstructions] = useState('');
  const [followUpVariations, setFollowUpVariations] = useState<CommWhatsAppFollowUpVariation[]>([]);
  const [followUpAiContextRationale, setFollowUpAiContextRationale] = useState<string | null>(null);
  const [followUpEmotionalContext, setFollowUpEmotionalContext] = useState<CommWhatsAppFollowUpEmotionalContext | null>(null);
  const [followUpCurrentAction, setFollowUpCurrentAction] = useState<'send' | 'wait'>('send');
  const [followUpCurrentActionReason, setFollowUpCurrentActionReason] = useState<string | null>(null);
  const [followUpOpportunityRecommendation, setFollowUpOpportunityRecommendation] = useState<'continue' | 'pause' | 'mark_lost_recommended'>('continue');
  const [followUpGenerationId, setFollowUpGenerationId] = useState<string | null>(null);
  const [followUpNextAction, setFollowUpNextAction] = useState<CommWhatsAppFollowUpNextAction | null>(null);
  const [schedulingFollowUpNextAction, setSchedulingFollowUpNextAction] = useState(false);
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [composerRewriteModalOpen, setComposerRewriteModalOpen] = useState(false);
  const [composerRewriteSource, setComposerRewriteSource] = useState('');
  const [composerRewriteDraft, setComposerRewriteDraft] = useState('');
  const [composerRewriteCustomInstructions, setComposerRewriteCustomInstructions] = useState('');
  const [composerRewriteTone, setComposerRewriteTone] = useState<CommWhatsAppRewriteTone>('grammar');
  const [composerAiMenuOpen, setComposerAiMenuOpen] = useState(false);
  const [rewritingComposer, setRewritingComposer] = useState(false);
  const [replySuggestionText, setReplySuggestionText] = useState('');
  const [replySuggestionLoading, setReplySuggestionLoading] = useState(false);
  const [replySuggestionError, setReplySuggestionError] = useState<string | null>(null);
  const [copyingTranscript, setCopyingTranscript] = useState(false);
  const [syncingHistoryChatId, setSyncingHistoryChatId] = useState<string | null>(null);
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);
  const [mediaDrawerPosition, setMediaDrawerPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [sendingDrawerMediaByChatId, setSendingDrawerMediaByChatId] = useState<Record<string, boolean>>({});
  const [quickReplyActiveIndex, setQuickReplyActiveIndex] = useState(0);
  const [dismissedQuickReplyKey, setDismissedQuickReplyKey] = useState<string | null>(null);
  const [sendingByChatId, setSendingByChatId] = useState<Record<string, boolean>>({});
  const [transcribingMessageId, setTranscribingMessageId] = useState<string | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [retryPendingMessage, setRetryPendingMessage] = useState<CommWhatsAppMessage | null>(null);
  const deletingMessageLockRef = useRef(new KeyedActionLock());
  const transcriptionMessageLockRef = useRef(new KeyedActionLock());
  const editingMessageLockRef = useRef(new KeyedActionLock());
  const [editingMessage, setEditingMessage] = useState<CommWhatsAppMessage | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState('');
  const [savingMessageEdit, setSavingMessageEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyTargetMessage, setReplyTargetMessage] = useState<CommWhatsAppMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<CommWhatsAppMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardingTargetIds, setForwardingTargetIds] = useState<string[]>([]);
  const [forwardingInProgress, setForwardingInProgress] = useState(false);
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [openMessageActionMenuMessageId, setOpenMessageActionMenuMessageId] = useState<string | null>(null);
  const [messageActionMenuPosition, setMessageActionMenuPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [messageActionMenuPointerAnchor, setMessageActionMenuPointerAnchor] = useState<PointerAnchor | null>(null);
  const [messageDetailsMessageId, setMessageDetailsMessageId] = useState<string | null>(null);
  const [openChatMenuChatId, setOpenChatMenuChatId] = useState<string | null>(null);
  const [chatMenuPosition, setChatMenuPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [chatMenuPointerAnchor, setChatMenuPointerAnchor] = useState<PointerAnchor | null>(null);
  const [threadActionsMenuOpen, setThreadActionsMenuOpen] = useState(false);
  const [threadActionsMenuPosition, setThreadActionsMenuPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [mediaUploadProgressByChatId, setMediaUploadProgressByChatId] = useState<Record<string, MediaUploadProgress>>({});
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [operationalState, setOperationalState] = useState<CommWhatsAppOperationalState | null>(null);
  const [operationalStateLoaded, setOperationalStateLoaded] = useState(false);
  const [operationalStateError, setOperationalStateError] = useState<string | null>(null);
  const [lightboxMessageId, setLightboxMessageId] = useState<string | null>(null);
  const [chatFilesOpen, setChatFilesOpen] = useState(false);
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [leadPanel, setLeadPanel] = useState<CommWhatsAppLeadPanel | null>(null);
  const [leadPanelLoading, setLeadPanelLoading] = useState(false);
  const [leadPanelError, setLeadPanelError] = useState<string | null>(null);
  const [leadContracts, setLeadContracts] = useState<CommWhatsAppLeadContractSummary[]>([]);
  const [leadContractsLoading, setLeadContractsLoading] = useState(false);
  const [leadContractsError, setLeadContractsError] = useState<string | null>(null);
  const [statusReminderLead, setStatusReminderLead] = useState<Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'> | null>(null);
  const [statusReminderPromptMessage, setStatusReminderPromptMessage] = useState<string | null>(null);
  const [chatAgendaSummaryLoading, setChatAgendaSummaryLoading] = useState(false);
  const [chatAgendaSummaryError, setChatAgendaSummaryError] = useState<string | null>(null);
  const [chatAgendaSummary, setChatAgendaSummary] = useState<ChatAgendaSummary>({ pendingCount: 0, nextReminder: null });
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [linkLoadingLeadId, setLinkLoadingLeadId] = useState<string | null>(null);
  const [leadMutationLoadingChatId, setLeadMutationLoadingChatId] = useState<string | null>(null);
  const [createLeadDraft, setCreateLeadDraft] = useState<CreateLeadDraft | null>(null);
  const [startChatModalOpen, setStartChatModalOpen] = useState(false);
  const [scheduleMessageModalOpen, setScheduleMessageModalOpen] = useState(false);
  const [scheduledMessagesPanelOpen, setScheduledMessagesPanelOpen] = useState(false);
  const [allScheduledMessagesPanelOpen, setAllScheduledMessagesPanelOpen] = useState(false);
  const [startChatQuery, setStartChatQuery] = useState('');
  const [savedContactNameRevision, setSavedContactNameRevision] = useState(0);
  const [manualStartPhone, setManualStartPhone] = useState('');
  const [startingChatKey, setStartingChatKey] = useState<string | null>(null);
  const [sharedContactActionKey, setSharedContactActionKey] = useState<string | null>(null);
  const { pollingEnabled } = useWindowPollingState();
  const {
    savedContacts,
    savedContactsLoading,
    savedContactsLoadingMore,
    savedContactsTotal,
    savedContactsHasMore,
    crmStartResults,
    crmStartLoading,
    startChatSourcesError,
    refreshStartChatSources,
    handleLoadMoreSavedContacts,
    handleRetryStartChatSources,
  } = useInboxStartChatSources({ isOpen: startChatModalOpen, query: startChatQuery });
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatMessageSearchInputRef = useRef<HTMLInputElement | null>(null);
  const advancedFiltersRef = useRef<HTMLDivElement | null>(null);
  const advancedFiltersTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mediaDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const messageActionMenuRef = useRef<HTMLDivElement | null>(null);
  const chatMenuRef = useRef<HTMLDivElement | null>(null);
  const threadActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const threadActionsMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reactionAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reactionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const messageActionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const messageBubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chatMenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cancelVoiceRecordingRef = useRef<() => void>(() => undefined);
  const mediaUploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const contactSaveLockRef = useRef(new KeyedActionLock());
  const lastSelectedChatPreviewRefreshKeyRef = useRef('');
  const composerSendLockRef = useRef(new ComposerSendLock());
  const pendingChatInboxStateRef = useRef<Map<string, PendingChatInboxStatePatch>>(new Map());
  const manualUnreadSkipReadChatIdRef = useRef<string | null>(null);
  const chatReadMutationVersionByChatIdRef = useRef<Map<string, number>>(new Map());
  const pendingChatReadKeysRef = useRef<Set<string>>(new Set());
  const attemptedChatReadAtByKeyRef = useRef<Map<string, number>>(new Map());
  const optimisticMessageTimestampByChatIdRef = useRef<Map<string, number>>(new Map());
  const prefetchedLeadNameByPhoneRef = useRef<Map<string, string>>(new Map());
  const savedContactNameByPhoneRef = useRef<Map<string, string>>(new Map());
  const savedContactNameOverrideByPhoneRef = useRef<Map<string, string>>(new Map());
  const latestChatsRef = useRef<CommWhatsAppChat[]>([]);
  const loadChatsRef = useRef<() => Promise<unknown> | void>(() => {});
  const loadMessagesRef = useRef<(chat: CommWhatsAppChat | null, reason?: InboxMessageLoadReason) => Promise<unknown> | void>(() => {});
  const archivedSectionOpenRef = useRef<boolean>(false);
  const archivedChatsPageRef = useRef<number>(0);
  const latestChatsLoadedAtRef = useRef<number>(0);
  const latestMessagesRef = useRef<CommWhatsAppMessage[]>([]);
  const savedContactLookupInFlightKeysRef = useRef<Set<string>>(new Set());
  const savedContactLookupFailedAtByKeyRef = useRef<Map<string, number>>(new Map());
  const resolvedSavedContactPhoneKeysRef = useRef<Set<string>>(new Set());
  const lastSavedContactForceSyncAtRef = useRef(0);
  const chatsSignatureRef = useRef('');
  const messagesSignatureRef = useRef('');
  const messagesCacheByChatIdRef = useRef<Map<string, { messages: CommWhatsAppMessage[]; signature: string; hasOlderMessages: boolean }>>(new Map());
  const pendingScrollModeRef = useRef<ScrollMode>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const selectedChatIdRef = useRef<string | null>(null);
  const suppressAutoChatSelectionRef = useRef(false);
  const historyRecoveryCursorByChatIdRef = useRef<Map<string, { nextOffset: number; timeTo: number }>>(new Map());

  const historyRecoveryLockRef = useRef(new KeyedActionLock());
  const chatIdFromUrlRef = useRef<string | null>(null);
  const chatsRequestIdRef = useRef(0);
  const chatPollBackoffRef = useRef(0);
  const chatPollIdleCyclesRef = useRef(0);
  const messageSearchSelectionRequestIdRef = useRef(0);
  const pendingMessageSearchChatIdRef = useRef<string | null>(null);
  const messagesRequestIdRef = useRef(0);
  const chatsLoadPromiseRef = useRef<Promise<void> | null>(null);
  const chatsLoadKeyRef = useRef<string | null>(null);
  const quotedMessageNavigationRequestIdRef = useRef(0);
  const leadPanelRequestIdRef = useRef(0);
  const leadContractsRequestIdRef = useRef(0);
  const leadMutationRequestIdRef = useRef(0);
  const leadMutationLockRef = useRef(new KeyedActionLock());
  const chatAgendaSummaryRequestIdRef = useRef(0);
  const archivedChatsCountRequestIdRef = useRef(0);
  const archivedChatsCountLoadLockRef = useRef(new KeyedActionLock());
  const followUpGenerationRequestIdRef = useRef(0);
  const followUpScheduleRequestIdRef = useRef(0);
  const composerRewriteRequestIdRef = useRef(0);
  const composerRewriteModalOpenRef = useRef(false);
  const composerRewriteSourceRef = useRef('');
  const messageDraftRef = useRef('');
  const replySuggestionRequestIdRef = useRef(0);
  const replySuggestionKeyRef = useRef('');
  const quickRepliesLoadRequestIdRef = useRef(0);
  const quickRepliesSaveRequestIdRef = useRef(0);
  const chatAgendaSummaryLeadIdRef = useRef<string | null>(null);
  const {
    localOutgoingMessages,
    setLocalOutgoingMessages,
    localOutgoingRetryPayloadRef,
    applyOutgoingOrderToServerMessage,
    patchLocalOutgoingMessage,
    removeLocalOutgoingMessage,
    appendLocalOutgoingMessage,
    buildOptimisticOutgoingMessage,
    reconcileLocalOutgoingMessages,
  } = useInboxOptimisticOutgoingMessages({
    selectedChatIdRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    pendingScrollHeightRef,
  });
  const {
    searchDraft,
    search,
    chatSearchResults,
    messageSearchResults,
    searchingChats,
    searchingMessages,
    chatSearchError,
    messageSearchError,
    setSearchDraft,
    setSearch,
    retrySearch,
  } = useChatSearch({
    activityFilter: chatActivityFilter,
    leadStatusFilters,
    leadResponsavelFilters,
    pendingChatInboxStateRef,
    sortChats: sortChatsByInboxOrder,
  });
  const {
    messageDraft,
    composerSelection,
    composerFocused,
    setMessageDraft,
    setComposerSelection,
    setComposerFocused,
    resetComposerDraft,
    composerDraftsByChatId,
  } = useComposerDraft(selectedChatId);
  const mobileViewportBaselineRef = useRef({ height: 0, width: 0 });

  useEffect(() => {
    messageDraftRef.current = messageDraft;
  }, [messageDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const syncViewportHeight = () => {
      const viewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
      const viewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth);
      const baseline = mobileViewportBaselineRef.current;

      if (!baseline.width || Math.abs(baseline.width - viewportWidth) > 80) {
        mobileViewportBaselineRef.current = { height: viewportHeight, width: viewportWidth };
      } else if (viewportHeight > baseline.height) {
        mobileViewportBaselineRef.current = { ...baseline, height: viewportHeight };
      }

      const keyboardOpen = Boolean(
        selectedChatId
        && composerFocused
        && mobileViewportBaselineRef.current.height - viewportHeight > 120,
      );
      root.style.setProperty('--comm-inbox-viewport-height', `${viewportHeight}px`);
      root.classList.toggle('comm-inbox-keyboard-open', keyboardOpen);
    };

    syncViewportHeight();
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('resize', syncViewportHeight);
      root.style.removeProperty('--comm-inbox-viewport-height');
      root.classList.remove('comm-inbox-keyboard-open');
    };
  }, [composerFocused, selectedChatId]);

  const hasTypedMessage = messageDraft.trim().length > 0;
  const channelState = operationalState?.channel ?? null;
  const connectionStatus = String(channelState?.connection_status ?? '').trim().toUpperCase();
  const connectionStatusLabel = useMemo(
    () => formatConnectionStatusLabel(connectionStatus, operationalStateLoaded ? 'Indisponível' : 'Verificando'),
    [connectionStatus, operationalStateLoaded],
  );
  const isChannelConnected = connectionStatus === 'AUTH';
  const hasWebhookEver = Boolean(channelState?.last_webhook_received_at);
  const webhookAgeMs = channelState?.last_webhook_received_at
    ? Date.now() - new Date(channelState.last_webhook_received_at).getTime()
    : null;
  const isWebhookStale = Boolean(webhookAgeMs && webhookAgeMs > STALE_WEBHOOK_THRESHOLD_MS);
  const sendDisabledReason = useMemo(() => {
    if (!operationalStateLoaded) {
      return null;
    }

    if (operationalStateError && !operationalState) {
      return 'Não foi possível verificar o canal do WhatsApp agora.';
    }

    if (!operationalState?.configEnabled) {
      return 'Envio do WhatsApp está desabilitado em /painel/config.';
    }

    if (!isChannelConnected) {
      return `Canal WhatsApp ${connectionStatusLabel.toLowerCase()}.`;
    }

    return null;
  }, [connectionStatusLabel, isChannelConnected, operationalState, operationalStateError, operationalStateLoaded]);
  const { enqueueChatSend } = useInboxSendQueue({ setSendingByChatId });

  const buildChatsSignature = useCallback(
    (items: CommWhatsAppChat[]) =>
      items
        .map(
          (chat) =>
            `${chat.id}:${chat.updated_at}:${chat.external_chat_id}:${chat.phone_number}:${chat.phone_digits}:${chat.unread_count}:${chat.last_message_at ?? ''}:${chat.last_message_text ?? ''}:${chat.last_message_delivery_status ?? ''}:${chat.display_name}:${chat.saved_contact_name ?? ''}:${chat.push_name ?? ''}:${chat.lead_id ?? ''}:${chat.lead_name ?? ''}:${chat.lead_status ?? ''}:${chat.autonomous_attendance_status}:${chat.presence_status ?? ''}:${chat.presence_last_seen_at ?? ''}:${chat.presence_updated_at ?? ''}:${chat.lead_link_source ?? ''}:${chat.merged_into_chat_id ?? ''}:${chat.auto_link_blocked}:${chat.identity_conflict}:${chat.deleted_at ?? ''}:${chat.is_archived}:${chat.archived_at ?? ''}:${chat.is_muted}:${chat.muted_at ?? ''}:${chat.is_pinned}:${chat.pinned_at ?? ''}:${chat.manual_unread}:${chat.manual_unread_at ?? ''}`,
        )
        .join('|'),
    [],
  );

  const buildMessagesSignature = useCallback(
    (items: CommWhatsAppMessage[]) =>
      items
        .map(
          (message) =>
            `${message.id}:${message.external_message_id ?? ''}:${message.delivery_status}:${message.status_updated_at ?? ''}:${message.message_at}:${message.text_content ?? ''}:${message.message_type}:${message.media_id ?? ''}:${message.media_url ?? ''}:${message.media_file_name ?? ''}:${message.media_caption ?? ''}:${message.transcription_text ?? ''}:${message.transcription_status ?? ''}:${message.transcription_error ?? ''}:${getMessageDisplayMetadataSignature(message)}`,
        )
        .join('|'),
    [],
  );

  const allocateOptimisticMessageTimestamps = useCallback((chatId: string, count: number) => {
    const safeCount = Math.max(0, count);
    const previousTimestamp = optimisticMessageTimestampByChatIdRef.current.get(chatId) ?? 0;
    const firstTimestamp = Math.max(Date.now(), previousTimestamp + 1);
    optimisticMessageTimestampByChatIdRef.current.set(chatId, firstTimestamp + safeCount - 1);

    return Array.from({ length: safeCount }, (_, index) => new Date(firstTimestamp + index).toISOString());
  }, []);

  const getSelectedChatSnapshot = useCallback((chatId: string | null) => {
    if (!chatId) return null;
    return latestChatsRef.current.find((chat) => chat.id === chatId) ?? null;
  }, []);

  const isScrolledNearBottom = useCallback((element: HTMLDivElement) => {
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    return remaining <= SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

  const archivedChatsCountValue = archivedChatsCount ?? 0;

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );
  const clearMediaUploadProgress = useCallback((chatId: string, attachmentId?: string) => {
    setMediaUploadProgressByChatId((current) => clearMediaUploadProgressForChat(current, chatId, attachmentId));
  }, []);
  const {
    pendingAttachments,
    clearPendingAttachments,
    removedAttachmentForUndo,
    attachmentInputAccept,
    attachmentMenuOpen,
    setAttachmentMenuOpen,
    isDraggingFilesOverThread,
    setSelectedMediaComposerAttachmentId,
    setSelectedDocumentComposerAttachmentId,
    fileInputRef,
    voiceAttachment,
    visualComposerAttachments,
    documentComposerAttachments,
    selectedMediaComposerAttachment,
    selectedDocumentComposerAttachment,
    isVoiceComposerMode,
    voiceRecordingState,
    voiceRecordingSeconds,
    voicePreviewPlaying,
    voicePreviewDuration,
    voicePreviewCurrentTime,
    voicePreviewAudioRef,
    autoSendVoiceRef,
    handleStartVoiceRecording,
    handleStopVoiceRecording,
    handleCancelVoiceRecording,
    handleToggleVoicePreviewPlayback,
    setVoicePreviewPlaying,
    setVoicePreviewCurrentTime,
    setVoicePreviewDuration,
    handleAttachmentMenuAction,
    handleAttachmentInputChange,
    handleComposerPaste,
    handleClearAttachment,
    handleUndoRemoveAttachment,
    handleThreadDragEnter,
    handleThreadDragOver,
    handleThreadDragLeave,
    handleThreadDrop,
  } = useInboxComposerAttachments({
    selectedChatId,
    selectedChat,
    generatingFollowUp,
    sendDisabledReason,
    clearMediaUploadProgress,
  });
  const hasSendPayload = hasTypedMessage || pendingAttachments.length > 0;
  const {
    results: leadSearchResults,
    loading: leadSearchLoading,
    error: leadSearchError,
    refreshDrawerSearch,
  } = useInboxLeadSearch({ isOpen: leadDrawerOpen, query: leadSearchQuery, selectedChat });
  const sending = selectedChatId ? Boolean(sendingByChatId[selectedChatId]) : false;
  const sendingDrawerMedia = selectedChatId ? Boolean(sendingDrawerMediaByChatId[selectedChatId]) : false;
  const mediaUploadProgress = selectedChatId ? mediaUploadProgressByChatId[selectedChatId] ?? null : null;

  const chatMessageSearch = chatMessageSearchDraft.trim();
  const {
    results: chatMessageSearchResults,
    searching: searchingChatMessages,
    error: chatMessageSearchError,
    retry: retryChatMessageSearch,
  } = useChatMessageSearch({
    chatId: selectedChat?.id ?? null,
    enabled: chatMessageSearchOpen,
    query: chatMessageSearch,
  });

  const chatMatchesActiveFilters = useMemo(
    () => createChatFilterMatcher({
      activityFilter: chatActivityFilter,
      leadStatusFilters,
      leadResponsavelFilters,
    }),
    [chatActivityFilter, leadStatusFilters, leadResponsavelFilters],
  );

  const scopedChats = useMemo(() => {
    const matchesCurrentSection = (chat: CommWhatsAppChat) => (archivedSectionOpen ? chat.is_archived : !chat.is_archived);
    const filtered = chats.filter((chat) => matchesCurrentSection(chat) && chatMatchesActiveFilters(chat));
    const selected = selectedChatId ? chats.find((chat) => chat.id === selectedChatId) ?? null : null;

    // BUG FIX (BUG #4): so reincluimos o chat selecionado se ele pertence
    // a secao atual. Se ele acabou de ser arquivado/desarquivado, deixar
    // ele sair da lista da secao corrente (e a logica de selecao em
    // handleUpdateChatInboxState ja escolheu o proximo chat valido).
    if (selected && matchesCurrentSection(selected) && !filtered.some((chat) => chat.id === selected.id)) {
      return sortChatsByInboxOrder([...filtered, selected]);
    }

    return sortChatsByInboxOrder(filtered);
  }, [archivedSectionOpen, chatMatchesActiveFilters, chats, selectedChatId]);
  const localChatSearchResults = useMemo(
    () => (search ? rankChatsBySearch(chats.filter(chatMatchesActiveFilters), search, operationalState?.channel?.connected_user_name ?? null) : []),
    [chatMatchesActiveFilters, chats, operationalState?.channel?.connected_user_name, search],
  );
  const savedContactLookupMaps = useMemo(
    () => ({
      localOverrides: savedContactNameOverrideByPhoneRef.current,
      synchronizedNames: savedContactNameByPhoneRef.current,
      revision: savedContactNameRevision,
    }),
    [savedContactNameRevision],
  );
  const savedContactsForPresentation = useMemo(
    () => savedContacts.map((contact) => applySavedContactNameToContact(
      contact,
      savedContactLookupMaps.localOverrides,
      savedContactLookupMaps.synchronizedNames,
    )),
    [savedContactLookupMaps, savedContacts],
  );
  const remoteChatSearchResults = useMemo(
    () => (search
      ? rankChatsBySearch(
          chatSearchResults
            .map((chat) => applySavedContactNameFromLookup(
              chat,
              savedContactLookupMaps.localOverrides,
              savedContactLookupMaps.synchronizedNames,
            ))
            .filter(chatMatchesActiveFilters),
          search,
          operationalState?.channel?.connected_user_name ?? null,
        )
      : []),
    [chatMatchesActiveFilters, chatSearchResults, operationalState?.channel?.connected_user_name, savedContactLookupMaps, search],
  );
  const filteredMessageSearchResults = useMemo(
    () => messageSearchResults
      .map((result) => ({
        ...result,
        chat: applySavedContactNameFromLookup(
          result.chat,
          savedContactLookupMaps.localOverrides,
          savedContactLookupMaps.synchronizedNames,
        ),
      }))
      .filter((result) => chatMatchesActiveFilters(result.chat)),
    [chatMatchesActiveFilters, messageSearchResults, savedContactLookupMaps],
  );
  const sidebarChats = useMemo(
    () => {
      const candidates = search ? mergeUniqueChats(localChatSearchResults, remoteChatSearchResults) : scopedChats;
      return candidates.map((chat) => applySavedContactNameFromLookup(
        chat,
        savedContactLookupMaps.localOverrides,
        savedContactLookupMaps.synchronizedNames,
      ));
    },
    [localChatSearchResults, remoteChatSearchResults, savedContactLookupMaps, scopedChats, search],
  );
  const selectedChatForPresentation = useMemo(
    () => selectedChat
      ? applySavedContactNameFromLookup(
          selectedChat,
          savedContactLookupMaps.localOverrides,
          savedContactLookupMaps.synchronizedNames,
        )
      : null,
    [savedContactLookupMaps, selectedChat],
  );
  const forwardTargetChats = useMemo(() => {
    const normalizedSearch = normalizeInboxSearch(forwardSearch);
    const candidates = chats
      .filter((chat) => chat.external_chat_id?.trim())
      .map((chat) => applySavedContactNameFromLookup(
        chat,
        savedContactLookupMaps.localOverrides,
        savedContactLookupMaps.synchronizedNames,
      ));
    const filtered = normalizedSearch
      ? candidates.filter((chat) => normalizeInboxSearch(`${chat.display_name} ${chat.saved_contact_name ?? ''} ${chat.phone_number}`).includes(normalizedSearch))
      : candidates;

    return sortChatsByInboxOrder(filtered).slice(0, 30);
  }, [chats, forwardSearch, savedContactLookupMaps]);
  const selectedChatTranscriptLabel = useMemo(
    () => {
      if (!selectedChatForPresentation) {
        return 'Contato';
      }

      // O painel do lead carrega em uma chamada separada e pode trazer um
      // nome diferente do contato salvo. O cabeçalho deve permanecer ligado
      // à identidade consolidada da conversa, sem piscar entre as duas fontes.
      return getSafeChatDisplayName(selectedChatForPresentation, operationalState?.channel?.connected_user_name ?? null) || selectedChatForPresentation.phone_number?.trim() || 'Contato';
    },
    [operationalState?.channel?.connected_user_name, selectedChatForPresentation],
  );

  const quickReplyLead = useMemo<Lead | null>(() => {
    if (!selectedChat) {
      return null;
    }

    const timestamp = new Date().toISOString();
    return {
      id: leadPanel?.id ?? selectedChat.lead_id ?? selectedChat.id,
      nome_completo: getSafeChatDisplayName(selectedChatForPresentation, operationalState?.channel?.connected_user_name ?? null),
      telefone: leadPanel?.telefone || selectedChat.phone_number || '',
      email: '',
      cidade: '',
      origem: null,
      status: leadPanel?.status_value ?? selectedChat.lead_status ?? null,
      responsavel: leadPanel?.responsavel_value ?? null,
      data_criacao: timestamp,
      arquivado: false,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }, [leadPanel, operationalState?.channel?.connected_user_name, selectedChat, selectedChatForPresentation]);
  const resolveComposerVariables = useCallback((value: string) => {
    return quickReplyLead ? applyTemplateVariables(value, quickReplyLead) : value;
  }, [quickReplyLead]);
  const quickReplyOptions = useMemo(() => {
    const usedShortcuts = new Set<string>();

    return quickReplies
      .map((quickReply, index) => {
        const name = quickReply.name?.trim() || `Mensagem rapida ${index + 1}`;
        const rawText = quickReply.text.trim();
        const resolvedText = quickReplyLead ? applyTemplateVariables(rawText, quickReplyLead) : rawText;
        const text = resolvedText.trim();

        if (!text) {
          return null;
        }

        const baseShortcut = buildQuickReplyShortcut(quickReply.shortcut || name, index);
        let shortcut = baseShortcut;
        let duplicateIndex = 2;

        while (usedShortcuts.has(shortcut)) {
          shortcut = `${baseShortcut}-${duplicateIndex}`;
          duplicateIndex += 1;
        }

        usedShortcuts.add(shortcut);

        return {
          id: quickReply.id,
          name,
          shortcut,
          text,
          preview: summarizeQuickReplyPreview(text),
          searchValue: normalizeQuickReplyLookup(`${shortcut} ${name} ${text}`),
        } as QuickReplyOption;
      })
      .filter((option): option is QuickReplyOption => option !== null);
  }, [quickReplies, quickReplyLead]);
  const activeQuickReplyMatch = useMemo(
    () => getActiveQuickReplyMatch(messageDraft, composerSelection),
    [composerSelection, messageDraft],
  );
  const activeQuickReplyKey = activeQuickReplyMatch
    ? `${activeQuickReplyMatch.start}:${activeQuickReplyMatch.query}`
    : null;
  const filteredQuickReplyOptions = useMemo(() => {
    if (!activeQuickReplyMatch) {
      return [];
    }

    const query = normalizeQuickReplyLookup(activeQuickReplyMatch.query);

    return quickReplyOptions
      .map((option, index) => {
        if (query && !option.searchValue.includes(query)) {
          return null;
        }

        const normalizedName = normalizeQuickReplyLookup(option.name);
        const rank = query.length === 0
          ? 0
          : option.shortcut.startsWith(query)
            ? 0
            : normalizedName.startsWith(query)
              ? 1
              : 2;

        return { option, rank, index };
      })
      .filter((item): item is { option: QuickReplyOption; rank: number; index: number } => item !== null)
      .sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }

        return a.index - b.index;
      })
      .map((item) => item.option);
  }, [activeQuickReplyMatch, quickReplyOptions]);
  const quickReplyMenuHasResults = filteredQuickReplyOptions.length > 0;
  const quickReplyMenuOpen =
    composerFocused
    && activeQuickReplyMatch !== null
    && activeQuickReplyKey !== dismissedQuickReplyKey;
  const quickReplyEmptyStateMessage = quickRepliesLoadError
    ? 'Não foi possível carregar as mensagens rápidas.'
    : quickReplyOptions.length === 0
      ? 'Nenhuma mensagem rapida cadastrada ainda.'
      : 'Nenhum atalho encontrado para esse termo.';
  const hasActiveChatFilters =
    chatActivityFilter !== 'all' || leadStatusFilters.length > 0 || leadResponsavelFilters.length > 0;
  const activeChatFiltersCount = (chatActivityFilter !== 'all' ? 1 : 0) + leadStatusFilters.length + leadResponsavelFilters.length;

  const upsertChatLocally = useCallback((nextChat: CommWhatsAppChat) => {
    setChats((current) => {
      if (nextChat.deleted_at || nextChat.merged_into_chat_id) {
        const filtered = current.filter((chat) => chat.id !== nextChat.id);
        chatsSignatureRef.current = buildChatsSignature(filtered);
        return filtered;
      }

      const previousChat = current.find((chat) => chat.id === nextChat.id) ?? null;
      const knownSavedContactName = getSavedContactNameForPhone(
        nextChat.phone_digits || nextChat.phone_number,
        savedContactNameOverrideByPhoneRef.current,
        savedContactNameByPhoneRef.current,
      );
      const stableNextChat = stabilizeChatIdentityForLocalMerge(
        applySavedContactName(nextChat, knownSavedContactName),
        previousChat,
        knownSavedContactName,
      );
      const hydratedNextChat = preserveUsefulChatPreview(stableNextChat, previousChat);
      const exists = Boolean(previousChat);
      const updated = exists
        ? current.map((chat) => (chat.id === nextChat.id
          ? preserveUsefulChatPreview(
              stabilizeChatIdentityForLocalMerge({ ...chat, ...hydratedNextChat }, chat, knownSavedContactName),
              chat,
            )
          : chat))
        : [hydratedNextChat, ...current];

      const sorted = sortChatsByInboxOrder(updated);
      const nextSignature = buildChatsSignature(sorted);
      if (nextSignature === chatsSignatureRef.current) {
        return current;
      }

      chatsSignatureRef.current = nextSignature;
      return sorted;
    });
  }, [buildChatsSignature]);

  const {
    handleStartChatFromSavedContact,
    handleStartChatFromLead,
    handleStartChatFromManual,
    handleOpenAgendaLeadChat,
    handleOpenSharedContactChat,
  } = useInboxChatCreation({
    chats,
    latestChatsRef,
    startingChatKey,
    manualStartPhone,
    setStartingChatKey,
    setSharedContactActionKey,
    setManualStartPhone,
    setSelectedChatId,
    setStartChatModalOpen,
    setSearchDraft,
    setSearch,
    upsertChatLocally,
  });

  const visibleMessages = useMemo(() => {
    const filteredMessages = messages
      .filter((message) => !shouldHideTechnicalMessage(message))
      .map(applyOutgoingOrderToServerMessage);

    if (!selectedChatId) {
      return filteredMessages;
    }

    const localForChat = localOutgoingMessages.filter((message) => message.chat_id === selectedChatId);
    if (localForChat.length === 0) {
      return dedupeObviousDuplicateMessages(filteredMessages);
    }

    return dedupeObviousDuplicateMessages(mergeMessages(filteredMessages, localForChat));
  }, [applyOutgoingOrderToServerMessage, localOutgoingMessages, messages, selectedChatId]);

  const mediaViewerMessages = useMemo(
    () => visibleMessages.filter(isChatMediaViewerMessage),
    [visibleMessages],
  );
  const lastUsefulVisibleMessage = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
      const message = visibleMessages[index];
      if (message && message.direction !== 'system' && getMessageSearchPreviewText(message).trim()) {
        return message;
      }
    }

    return null;
  }, [visibleMessages]);

  useEffect(() => {
    if (lightboxMessageId && !mediaViewerMessages.some((message) => message.id === lightboxMessageId)) {
      setLightboxMessageId(null);
    }
  }, [lightboxMessageId, mediaViewerMessages]);

  const applyOptimisticChatSummary = useCallback((chat: CommWhatsAppChat, summaryText: string, messageAt: string) => {
    const readMutationVersion = (chatReadMutationVersionByChatIdRef.current.get(chat.id) ?? 0) + 1;
    chatReadMutationVersionByChatIdRef.current.set(chat.id, readMutationVersion);
    const readPatch: PendingChatInboxStatePatch = {
      unread_count: 0,
      manual_unread: false,
      manual_unread_at: null,
      last_read_at: messageAt,
    };

    mergePendingChatInboxState(pendingChatInboxStateRef.current, chat.id, {
      ...readPatch,
      is_archived: chat.is_archived,
      archived_at: chat.archived_at,
      last_message_text: summaryText,
      last_message_direction: 'outbound',
      last_message_at: messageAt,
      last_message_delivery_status: 'pending',
    });

    upsertChatLocally({
      ...chat,
      ...readPatch,
      is_archived: chat.is_archived,
      archived_at: chat.archived_at,
      last_message_text: summaryText,
      last_message_direction: 'outbound',
      last_message_at: messageAt,
      last_message_delivery_status: 'pending',
      updated_at: messageAt,
    });

    void whatsappConversationsRepository.markRead(chat.id, {
      messageAt,
    }).then(() => {
      if (chatReadMutationVersionByChatIdRef.current.get(chat.id) !== readMutationVersion) {
        return;
      }
      chatReadMutationVersionByChatIdRef.current.delete(chat.id);
    }).catch((error) => {
      if (chatReadMutationVersionByChatIdRef.current.get(chat.id) !== readMutationVersion) {
        return;
      }
      chatReadMutationVersionByChatIdRef.current.delete(chat.id);
      console.error('[WhatsAppInbox] erro ao avancar leitura apos envio', error);
    });
  }, [upsertChatLocally]);

  const updateOptimisticChatPreviewStatus = useCallback((chatId: string, messageAt: string, deliveryStatus: string) => {
    const pendingState = pendingChatInboxStateRef.current.get(chatId);
    if (pendingState?.last_message_at === messageAt) {
      pendingChatInboxStateRef.current.set(chatId, {
        ...pendingState,
        last_message_delivery_status: resolveStableDeliveryStatus(deliveryStatus, pendingState.last_message_delivery_status),
      });
    }

    setChats((current) => {
      const next = current.map((chat) => (
        chat.id === chatId && chat.last_message_at === messageAt
          ? { ...chat, last_message_delivery_status: resolveStableDeliveryStatus(deliveryStatus, chat.last_message_delivery_status) }
          : chat
      ));
      chatsSignatureRef.current = buildChatsSignature(next);
      return next;
    });
  }, [buildChatsSignature]);

  const setMediaUploadProgressForSelectedChat = useCallback((progress: MediaUploadProgress) => {
    setMediaUploadProgressByChatId((current) => setMediaUploadProgressForChat(current, progress));
  }, []);

  const updateMediaUploadProgress = useCallback((chatId: string, attachmentId: string, progress: number | null) => {
    setMediaUploadProgressByChatId((current) => updateMediaUploadProgressForChat(current, chatId, attachmentId, progress));
  }, []);

  const resetComposerAfterQueue = useCallback(() => {
    resetComposerDraft();
    clearPendingAttachments();
    setReplyTargetMessage(null);
    if (selectedChatId) {
      clearMediaUploadProgress(selectedChatId);
    }
    voicePreviewAudioRef.current?.pause();
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.currentTime = 0;
    }
    setVoicePreviewPlaying(false);
    setVoicePreviewCurrentTime(0);
    setVoicePreviewDuration(null);
  }, [clearMediaUploadProgress, clearPendingAttachments, resetComposerDraft, selectedChatId, setVoicePreviewCurrentTime, setVoicePreviewDuration, setVoicePreviewPlaying, voicePreviewAudioRef]);

  const messageTimelineItems = useMemo(
    () => buildInboxMessageTimeline(visibleMessages),
    [visibleMessages],
  );

  const openReactionPickerMessage = useMemo(() => {
    if (!openReactionPickerMessageId) {
      return null;
    }

    return visibleMessages.find((message) => message.id === openReactionPickerMessageId) ?? null;
  }, [openReactionPickerMessageId, visibleMessages]);
  const openMessageActionMenuMessage = useMemo(() => {
    if (!openMessageActionMenuMessageId) {
      return null;
    }

    return visibleMessages.find((message) => message.id === openMessageActionMenuMessageId) ?? null;
  }, [openMessageActionMenuMessageId, visibleMessages]);
  const messageDetailsMessage = useMemo(() => {
    if (!messageDetailsMessageId) return null;
    return visibleMessages.find((message) => message.id === messageDetailsMessageId) ?? null;
  }, [messageDetailsMessageId, visibleMessages]);
  const openChatMenuChat = useMemo(() => {
    if (!openChatMenuChatId) {
      return null;
    }

    return chats.find((chat) => chat.id === openChatMenuChatId) ?? null;
  }, [chats, openChatMenuChatId]);

  const handleToggleChatMenu = useCallback((chatId: string) => {
    setChatMenuPointerAnchor(null);
    setOpenChatMenuChatId((current) => (current === chatId ? null : chatId));
  }, []);

  const handleToggleMessageActionMenu = useCallback((messageId: string) => {
    setOpenReactionPickerMessageId(null);
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId((current) => (current === messageId ? null : messageId));
  }, []);

  const handleOpenChatMenuFromContext = useCallback((chatId: string, anchor: PointerAnchor) => {
    setChatMenuPointerAnchor(anchor);
    setOpenChatMenuChatId(chatId);
  }, []);

  const handleOpenMessageActionMenuFromContext = useCallback((messageId: string, anchor: PointerAnchor) => {
    setOpenReactionPickerMessageId(null);
    setMessageActionMenuPointerAnchor(anchor);
    setOpenMessageActionMenuMessageId(messageId);
  }, []);

  const handleOpenMessageDetails = useCallback((message: CommWhatsAppMessage) => {
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
    setMessageDetailsMessageId(message.id);
  }, []);

  const applyPrefetchedLeadNames = useCallback((items: CommWhatsAppChat[]) => {
    return items.map((chat) => {
      const savedContactName = resolveSavedContactName(
        chat.phone_digits || chat.phone_number,
        chat.saved_contact_name,
        savedContactNameOverrideByPhoneRef.current,
        savedContactNameByPhoneRef.current,
      );
      if (savedContactName) {
        return applySavedContactNameFromLookup(
          chat,
          savedContactNameOverrideByPhoneRef.current,
          savedContactNameByPhoneRef.current,
        );
      }

      const matchedLeadName = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number)
        .map((key) => prefetchedLeadNameByPhoneRef.current.get(key) ?? null)
        .find((value): value is string => Boolean(value?.trim()));

      if (!matchedLeadName) {
        return chat;
      }

      return {
        ...chat,
        lead_name: chat.lead_name || matchedLeadName,
      };
    });
  }, []);

  const applyFrontendSavedContactNames = useCallback((items: CommWhatsAppChat[]) => {
    return items.map((chat) => applySavedContactNameFromLookup(
      chat,
      savedContactNameOverrideByPhoneRef.current,
      savedContactNameByPhoneRef.current,
    ));
  }, []);

  const rememberManualSavedContactName = useCallback((phone: string | null | undefined, displayName: string) => {
    const result = applyManualSavedContactNameToMaps(
      phone,
      displayName,
      savedContactNameByPhoneRef.current,
      savedContactNameOverrideByPhoneRef.current,
    );

    if (result.phoneKeys.length === 0 || !displayName.trim()) {
      return;
    }

    result.phoneKeys.forEach((key) => {
      resolvedSavedContactPhoneKeysRef.current.add(key);
    });
    savedContactNameByPhoneRef.current = result.synchronizedNames;
    savedContactNameOverrideByPhoneRef.current = result.manualNames;
    setSavedContactNameRevision((current) => current + 1);
    setChats((current) => applyFrontendSavedContactNames(current));
  }, [applyFrontendSavedContactNames]);

  useEffect(() => {
    const now = Date.now();
    for (const [key, failedAt] of savedContactLookupFailedAtByKeyRef.current.entries()) {
      if (now - failedAt >= CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS) {
        savedContactLookupFailedAtByKeyRef.current.delete(key);
      }
    }

    const shouldAttemptLookupKey = (key: string) => {
      if (resolvedSavedContactPhoneKeysRef.current.has(key) || savedContactLookupInFlightKeysRef.current.has(key)) {
        return false;
      }

      const failedAt = savedContactLookupFailedAtByKeyRef.current.get(key);
      return !failedAt || now - failedAt >= CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS;
    };

    const selectedLookupKeys = selectedChat
      ? collectPhoneLookupKeys(selectedChat.phone_digits || selectedChat.phone_number)
      : [];
    const canForceSyncSelectedContact = selectedLookupKeys.length > 0
      && now - lastSavedContactForceSyncAtRef.current >= SAVED_CONTACT_FORCE_SYNC_COOLDOWN_MS;
    const forceSyncKeys = new Set(canForceSyncSelectedContact ? selectedLookupKeys : []);

    const targetChats = chats.filter((chat) => {
      const lookupKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
      const isSelectedChat = Boolean(selectedChat?.id && chat.id === selectedChat.id);

      return lookupKeys.length > 0 && (lookupKeys.some(shouldAttemptLookupKey) || (isSelectedChat && canForceSyncSelectedContact));
    }).slice(0, CHAT_IDENTITY_LOOKUP_MAX_CHATS_PER_CYCLE);

    if (targetChats.length === 0) {
      return;
    }

    const requestKeys = Array.from(
      new Set(targetChats.flatMap((chat) => collectPhoneLookupKeys(chat.phone_digits || chat.phone_number))),
    ).filter((key) => shouldAttemptLookupKey(key) || forceSyncKeys.has(key));
    const phoneNumbers = Array.from(
      new Set(targetChats.flatMap((chat) => [chat.phone_number, chat.phone_digits].filter(Boolean))),
    );

    if (requestKeys.length === 0 || phoneNumbers.length === 0) {
      return;
    }

    const forceSync = requestKeys.some((key) => forceSyncKeys.has(key));

    if (forceSync) {
      lastSavedContactForceSyncAtRef.current = now;
    }

    requestKeys.forEach((key) => savedContactLookupInFlightKeysRef.current.add(key));
    // A lista pode mudar enquanto a consulta termina (polling, Realtime ou
    // carregamento do painel do lead). A resposta ainda e valida: o setter
    // funcional abaixo aplica o nome sobre o estado mais recente. Cancelar
    // por causa da troca de `chats` descartava justamente a identidade manual.
    void whatsappContactsRepository.lookupSavedByPhones({ phoneNumbers, forceSync }).then((contacts) => {
      const matchedKeys = new Set(contacts.flatMap((contact) => collectPhoneLookupKeys(contact.phone_digits || contact.phone_number)));
      const missedAt = Date.now();
      requestKeys.forEach((key) => {
        if (matchedKeys.has(key)) {
          resolvedSavedContactPhoneKeysRef.current.add(key);
          savedContactLookupFailedAtByKeyRef.current.delete(key);
        } else {
          savedContactLookupFailedAtByKeyRef.current.set(key, missedAt);
        }
      });

      if (contacts.length > 0) {
        const map = new Map(savedContactNameByPhoneRef.current);
        const manualOverrides = new Map(savedContactNameOverrideByPhoneRef.current);
        addSavedContactsToNameMap(map, contacts, manualOverrides);
        savedContactNameByPhoneRef.current = map;
        savedContactNameOverrideByPhoneRef.current = manualOverrides;
        setSavedContactNameRevision((current) => current + 1);
        setChats((current) => applyFrontendSavedContactNames(current));
      }
    }).catch((error) => {
      const failedAt = Date.now();
      requestKeys.forEach((key) => savedContactLookupFailedAtByKeyRef.current.set(key, failedAt));
      console.warn('[WhatsAppInbox] lookup de contatos salvos pausado temporariamente apos erro', error);
    }).finally(() => {
      requestKeys.forEach((key) => savedContactLookupInFlightKeysRef.current.delete(key));
    });
  }, [applyFrontendSavedContactNames, chats, selectedChat]);

  const {
    applyRealtimeChatChange,
    applyRealtimePresenceChange,
    applyRealtimeMessageChange,
  } = useInboxRealtimeUpdates({
    refs: {
      chatPollBackoffRef,
      chatPollIdleCyclesRef,
      selectedChatIdRef,
      archivedSectionOpenRef,
      latestChatsRef,
      chatIdFromUrlRef,
      savedContactNameOverrideByPhoneRef,
      savedContactNameByPhoneRef,
      pendingChatInboxStateRef,
      chatsSignatureRef,
      messagesSignatureRef,
      isNearBottomRef,
      pendingScrollModeRef,
      pendingScrollTopRef,
      pendingScrollHeightRef,
      messagesContainerRef,
      loadChatsRef,
    },
    setSelectedChatId,
    setChats,
    setMessages,
    buildChatsSignature,
    buildMessagesSignature,
    chatMatchesActiveFilters,
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    applyOutgoingOrderToServerMessage,
    reconcileLocalOutgoingMessages,
  });

  const { isRealtimeHealthy: isMessageRealtimeHealthy } = useCommWhatsAppMessageRealtime(selectedChatId, applyRealtimeMessageChange);

  // Lidos via ref (não via dependência de efeito) para que os loops de
  // polling abaixo recalculem o intervalo a cada agendamento sem reiniciar o
  // timer inteiro a cada flutuação de conexão/realtime.
  const isChannelConnectedRef = useRef(isChannelConnected);
  useEffect(() => {
    isChannelConnectedRef.current = isChannelConnected;
  }, [isChannelConnected]);

  const isMessageRealtimeHealthyRef = useRef(isMessageRealtimeHealthy);
  useEffect(() => {
    isMessageRealtimeHealthyRef.current = isMessageRealtimeHealthy;
  }, [isMessageRealtimeHealthy]);

  const patchMessageLocally = useCallback((messageId: string, patch: Partial<CommWhatsAppMessage>) => {
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      return mergeCommWhatsAppMessage(message, {
        ...message,
        ...patch,
        metadata: {
          ...message.metadata,
          ...(patch.metadata ?? {}),
        },
      });
    }));
  }, []);

  const {
    reactingMessageIds,
    starringMessageIds,
    handleToggleReactionPicker,
    handleReactToMessage,
    handleToggleStarMessage,
  } = useInboxMessageReactionActions({
    selectedChatExternalId: selectedChat?.external_chat_id,
    patchMessageLocally,
    setOpenReactionPickerMessageId,
    setOpenMessageActionMenuMessageId,
  });

  const { loadLeadContracts, loadLeadPanel } = useInboxLeadPanel({
    refs: {
      leadPanelRequestIdRef,
      leadContractsRequestIdRef,
      selectedChatIdRef,
      prefetchedLeadNameByPhoneRef,
    },
    setLeadPanel,
    setLeadPanelError,
    setLeadPanelLoading,
    setLeadContracts,
    setLeadContractsError,
    setLeadContractsLoading,
    setChats,
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    upsertChatLocally,
  });

  useInboxSelectedLeadRealtime({
    leadId: selectedChat?.lead_id,
    leadStatuses,
    latestChatsRef,
    loadLeadPanel,
    setLeadPanel,
    upsertChatLocally,
  });

  const loadChatAgendaSummary = useCallback(async (leadId: string | null, contractIds: string[] = []) => {
    const requestId = ++chatAgendaSummaryRequestIdRef.current;

    if (!leadId) {
      chatAgendaSummaryLeadIdRef.current = null;
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryError(null);
      setChatAgendaSummaryLoading(false);
      return;
    }

    const shouldShowLoading = chatAgendaSummaryLeadIdRef.current !== leadId;
    chatAgendaSummaryLeadIdRef.current = leadId;

    if (shouldShowLoading) {
      setChatAgendaSummaryLoading(true);
    }

    try {
      const reminders = await listInboxAgendaReminders(leadId, contractIds);
      const pendingReminders = reminders
        .filter((reminder) => !reminder.lido)
        .sort((left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime());

      if (requestId !== chatAgendaSummaryRequestIdRef.current || chatAgendaSummaryLeadIdRef.current !== leadId) {
        return;
      }

      setChatAgendaSummary({
        pendingCount: pendingReminders.length,
        nextReminder: pendingReminders[0] ?? null,
      });
      setChatAgendaSummaryError(null);
    } catch (error) {
      if (requestId !== chatAgendaSummaryRequestIdRef.current || chatAgendaSummaryLeadIdRef.current !== leadId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao carregar resumo da agenda do chat', error);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryError(
        error instanceof Error ? error.message : 'Não foi possível consultar os lembretes deste chat.',
      );
    } finally {
      if (requestId === chatAgendaSummaryRequestIdRef.current && chatAgendaSummaryLeadIdRef.current === leadId) {
        setChatAgendaSummaryLoading(false);
      }
    }
  }, []);

  const suggestedLead = useMemo(() => {
    if (!leadDrawerOpen || selectedChat?.lead_id || leadSearchQuery.trim() !== '') {
      return null;
    }

    return leadSearchResults.length === 1 ? leadSearchResults[0] : null;
  }, [leadDrawerOpen, leadSearchQuery, leadSearchResults, selectedChat?.lead_id]);
  const selectedChatWasAutoLinked = selectedChat?.lead_link_source === 'auto_phone';
  const selectedChatLeadMutationLoading = leadMutationLoadingChatId === selectedChat?.id;
  const selectedChatDisplayName = useMemo(
    () => getSafeChatDisplayName(selectedChatForPresentation, channelState?.connected_user_name ?? null),
    [channelState?.connected_user_name, selectedChatForPresentation],
  );
  const isSelectedChatWaitingForQuote = useMemo(() => {
    const normalizedStatus = String(leadPanel?.status_nome ?? selectedChat?.lead_status ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    return normalizedStatus === 'aguardando cotacao';
  }, [leadPanel?.status_nome, selectedChat?.lead_status]);
  const followUpGenerationDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para gerar o follow-up.';
    }

    if (selectedChat.is_group) {
      return 'Grupos são conversas manuais e não participam de follow-ups ou IA autônoma.';
    }

    if (generatingFollowUp) {
      return 'Gerando follow-up com IA...';
    }

    if (sending) {
      return 'Aguarde o envio atual terminar para gerar um follow-up.';
    }

    if (voiceRecordingState !== 'idle') {
      return 'Finalize a gravação de áudio antes de gerar um follow-up.';
    }

    if (pendingAttachments.length > 0) {
      return 'Remova o anexo atual antes de gerar um follow-up.';
    }

    return null;
  }, [generatingFollowUp, pendingAttachments.length, selectedChat, sending, voiceRecordingState]);
  const composerRewriteDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para reescrever a mensagem.';
    }

    if (!messageDraft.trim()) {
      return 'Digite uma mensagem no composer para usar a IA.';
    }

    if (voiceRecordingState !== 'idle') {
      return 'Finalize a gravação de áudio antes de reescrever a mensagem.';
    }

    if (rewritingComposer) {
      return 'Reescrevendo mensagem com IA...';
    }

    return null;
  }, [messageDraft, rewritingComposer, selectedChat, voiceRecordingState]);
  const replySuggestionDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para sugerir resposta.';
    }

    if (loadingMessages) {
      return 'Aguarde as mensagens carregarem para sugerir resposta.';
    }

    if (voiceRecordingState !== 'idle') {
      return 'Finalize a gravação de áudio antes de sugerir resposta.';
    }

    if (pendingAttachments.length > 0) {
      return 'Remova o anexo atual antes de sugerir resposta.';
    }

    if (sending) {
      return 'Aguarde o envio atual terminar para sugerir resposta.';
    }

    return null;
  }, [loadingMessages, pendingAttachments.length, selectedChat, sending, voiceRecordingState]);
  const replySuggestionKey = useMemo(() => {
    if (!selectedChatId) {
      return '';
    }

    const lastMessageSignature = lastUsefulVisibleMessage
      ? [
          lastUsefulVisibleMessage.id,
          lastUsefulVisibleMessage.direction,
          lastUsefulVisibleMessage.message_at,
          lastUsefulVisibleMessage.delivery_status,
          lastUsefulVisibleMessage.text_content ?? '',
          lastUsefulVisibleMessage.media_caption ?? '',
          lastUsefulVisibleMessage.transcription_text ?? '',
        ].join(':')
      : 'sem-mensagem';

    return `${selectedChatId}:${lastMessageSignature}:${messageDraft.trim()}`;
  }, [lastUsefulVisibleMessage, messageDraft, selectedChatId]);
  useEffect(() => {
    replySuggestionKeyRef.current = replySuggestionKey;
    replySuggestionRequestIdRef.current += 1;
    setReplySuggestionLoading(false);
    setReplySuggestionText('');
    setReplySuggestionError(null);
  }, [replySuggestionKey]);
  const historyRecoveryDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para recuperar mensagens antigas.';
    }

    if (!selectedChat.external_chat_id?.trim()) {
      return 'Conversa sem identificador externo para consultar na Whapi.';
    }

    if (syncingHistoryChatId === selectedChat.id) {
      return 'Recuperando mensagens antigas pela Whapi...';
    }

    return sendDisabledReason;
  }, [selectedChat, sendDisabledReason, syncingHistoryChatId]);
  const mediaDrawerSendDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para enviar GIFs e figurinhas.';
    }

    if (sending || sendingDrawerMedia) {
      return 'Aguarde o envio atual terminar.';
    }

    if (generatingFollowUp) {
      return 'Aguarde a geração do follow-up terminar.';
    }

    if (voiceRecordingState !== 'idle') {
      return 'Finalize a gravação de áudio antes de enviar mídia da gaveta.';
    }

    if (pendingAttachments.length > 0) {
      return 'Conclua ou remova os anexos atuais antes de usar GIFs e figurinhas.';
    }

    if (sendDisabledReason) {
      return sendDisabledReason;
    }

    return null;
  }, [generatingFollowUp, pendingAttachments.length, selectedChat, sendDisabledReason, sending, sendingDrawerMedia, voiceRecordingState]);

  const operationalBanner = useMemo(() => {
    if (operationalStateError && !operationalState) {
      return {
        tone: 'danger' as const,
        icon: AlertTriangle,
        title: 'Não foi possível verificar o canal do WhatsApp',
        description: operationalStateError,
      };
    }

    if (!operationalStateLoaded || !channelState) {
      return null;
    }

    const state = operationalState;
    if (!state) {
      return null;
    }

    if (!state.configEnabled) {
      return {
        tone: 'warning' as const,
        icon: AlertTriangle,
        title: 'Envio desabilitado',
        description: 'O canal está configurado, mas o envio foi desativado em /painel/config.',
      };
    }

    if (!isChannelConnected) {
      return {
        tone: 'danger' as const,
        icon: WifiOff,
        title: `WhatsApp ${connectionStatusLabel}`,
        description: 'Reconecte o canal na Whapi ou valide a sessão antes de atender por aqui.',
      };
    }

    if (!hasWebhookEver) {
      return {
        tone: 'info' as const,
        icon: Clock3,
        title: 'Webhook ainda sem eventos',
        description: 'O canal está conectado, mas ainda não recebemos nenhum evento do webhook neste inbox.',
      };
    }

    if (isWebhookStale) {
      return {
        tone: 'info' as const,
        icon: Clock3,
        title: 'Webhook sem eventos recentes',
        description: `Último evento recebido em ${formatMessageTime(channelState.last_webhook_received_at)}. Se isso não for esperado, valide o webhook na Whapi.`,
      };
    }

    return null;
  }, [channelState, connectionStatusLabel, hasWebhookEver, isChannelConnected, isWebhookStale, operationalState, operationalStateError, operationalStateLoaded]);
  const nextChatReminderSummary = useMemo(() => {
    if (chatAgendaSummaryLoading && chatAgendaSummary.pendingCount === 0 && !chatAgendaSummary.nextReminder) {
      return 'Agenda: carregando lembretes...';
    }

    if (!leadPanel?.id) {
      return null;
    }

    if (chatAgendaSummaryError) {
      return 'Agenda: não foi possível consultar';
    }

    if (!chatAgendaSummary.nextReminder) {
      return chatAgendaSummary.pendingCount > 0 ? `Agenda: ${chatAgendaSummary.pendingCount} pendente(s).` : 'Agenda em dia';
    }

    const reminder = chatAgendaSummary.nextReminder;
    const prefix = isOverdue(reminder.data_lembrete) ? 'Próximo lembrete atrasado' : 'Próximo lembrete';
    return `${prefix}: ${reminder.titulo} · ${formatDateTimeFullBR(reminder.data_lembrete)}`;
  }, [chatAgendaSummary, chatAgendaSummaryError, chatAgendaSummaryLoading, leadPanel?.id]);

  useEffect(() => {
    latestChatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    archivedSectionOpenRef.current = archivedSectionOpen;
  }, [archivedSectionOpen]);

  useEffect(() => {
    archivedChatsPageRef.current = archivedChatsPage;
  }, [archivedChatsPage]);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let active = true;
    const requestId = ++quickRepliesLoadRequestIdRef.current;
    setQuickRepliesLoadError(false);

    void configService
      .getIntegrationSetting(WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG)
      .then((integration) => {
        if (!active || requestId !== quickRepliesLoadRequestIdRef.current) {
          return;
        }

        const normalized = normalizeWhatsAppQuickRepliesSettings(integration?.settings);
        setQuickReplyIntegration(integration);
        setQuickReplies(normalized.quickReplies);
        setQuickRepliesLoadError(false);
      })
      .catch((error) => {
        console.error('[WhatsAppInbox] erro ao carregar mensagens rápidas', error);
        if (active && requestId === quickRepliesLoadRequestIdRef.current) {
          setQuickReplyIntegration(null);
          setQuickReplies([]);
          setQuickRepliesLoadError(true);
        }
      });

    return () => {
      active = false;
      quickRepliesLoadRequestIdRef.current += 1;
    };
  }, [quickRepliesLoadRetryToken]);

  useEffect(() => () => {
    quickRepliesSaveRequestIdRef.current += 1;
    quickRepliesLoadRequestIdRef.current += 1;
  }, []);

  useEffect(() => {
    if (!quickReplyMenuOpen || !quickReplyMenuHasResults) {
      setQuickReplyActiveIndex(0);
      return;
    }

    setQuickReplyActiveIndex((current) => Math.min(current, filteredQuickReplyOptions.length - 1));
  }, [filteredQuickReplyOptions.length, quickReplyMenuHasResults, quickReplyMenuOpen]);

  useEffect(() => {
    if (!activeQuickReplyKey) {
      setDismissedQuickReplyKey(null);
      return;
    }

    if (dismissedQuickReplyKey && dismissedQuickReplyKey !== activeQuickReplyKey) {
      setDismissedQuickReplyKey(null);
    }
  }, [activeQuickReplyKey, dismissedQuickReplyKey]);

  useClickOutside(
    Boolean(openReactionPickerMessageId),
    () => [
      reactionPickerRef.current,
      openReactionPickerMessageId ? reactionTriggerRefs.current[openReactionPickerMessageId] : null,
    ],
    () => setOpenReactionPickerMessageId(null),
    [openReactionPickerMessageId],
  );

  useClickOutside(
    Boolean(openMessageActionMenuMessageId),
    () => [
      messageActionMenuRef.current,
      openMessageActionMenuMessageId ? messageActionTriggerRefs.current[openMessageActionMenuMessageId] : null,
    ],
    () => {
      setMessageActionMenuPointerAnchor(null);
      setOpenMessageActionMenuMessageId(null);
    },
    [openMessageActionMenuMessageId],
  );

  useClickOutside(
    Boolean(openChatMenuChatId),
    () => [
      chatMenuRef.current,
      openChatMenuChatId ? chatMenuTriggerRefs.current[openChatMenuChatId] : null,
    ],
    () => {
      setChatMenuPointerAnchor(null);
      setOpenChatMenuChatId(null);
    },
    [openChatMenuChatId],
  );

  useClickOutside(
    threadActionsMenuOpen,
    () => [threadActionsMenuRef.current, threadActionsMenuTriggerRef.current],
    () => setThreadActionsMenuOpen(false),
    [threadActionsMenuOpen],
  );

  useEffect(() => {
    if (openReactionPickerMessageId && !openReactionPickerMessage) {
      setOpenReactionPickerMessageId(null);
    }
  }, [openReactionPickerMessage, openReactionPickerMessageId]);

  useEffect(() => {
    if (openMessageActionMenuMessageId && !openMessageActionMenuMessage) {
      setMessageActionMenuPointerAnchor(null);
      setOpenMessageActionMenuMessageId(null);
    }
  }, [openMessageActionMenuMessage, openMessageActionMenuMessageId]);

  useEffect(() => {
    if (openChatMenuChatId && !openChatMenuChat) {
      setChatMenuPointerAnchor(null);
      setOpenChatMenuChatId(null);
    }
  }, [openChatMenuChat, openChatMenuChatId]);

  useEffect(() => {
    leadMutationRequestIdRef.current += 1;
    setLinkLoadingLeadId(null);
    setThreadActionsMenuOpen(false);
  }, [selectedChatId]);

  useEffect(() => {
    // Modais que editam dados da conversa anterior não podem permanecer
    // ativos depois que o usuário troca de chat. Caso contrário, a ação
    // confirmada pode usar o selectedChat atual em vez do chat que abriu o
    // modal (especialmente ao salvar um contato).
    setSaveContactDialogOpen(false);
    setSaveContactName('');
    setCreateLeadDraft(null);
    setEditingMessage(null);
    setEditingMessageDraft('');
    setMessagePendingDeletion(null);
    setRetryPendingMessage(null);
    setStatusReminderLead(null);
    setStatusReminderPromptMessage(null);
    setScheduleMessageModalOpen(false);
    setScheduledMessagesPanelOpen(false);
    setChatFilesOpen(false);
    setMediaDrawerOpen(false);
    composerRewriteRequestIdRef.current += 1;
    composerRewriteModalOpenRef.current = false;
    composerRewriteSourceRef.current = '';
    setComposerRewriteModalOpen(false);
    setComposerRewriteSource('');
    setComposerRewriteDraft('');
    setComposerAiMenuOpen(false);
  }, [selectedChatId]);

  useLayoutEffect(() => {
    if (!openReactionPickerMessageId || typeof window === 'undefined') {
      setReactionPickerPosition((current) => (current === null ? current : null));
      return;
    }

    const syncPosition = () => {
      const anchor = reactionAnchorRefs.current[openReactionPickerMessageId];
      if (!anchor) {
        setReactionPickerPosition((current) => (current === null ? current : null));
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const containerRect = messagesContainerRef.current?.getBoundingClientRect() ?? null;
      const viewportPadding = 12;
      const containerPadding = 12;
      const boundsLeft = containerRect
        ? Math.max(viewportPadding, containerRect.left + containerPadding)
        : viewportPadding;
      const boundsRight = containerRect
        ? Math.min(window.innerWidth - viewportPadding, containerRect.right - containerPadding)
        : window.innerWidth - viewportPadding;
      const maxLeft = Math.max(boundsLeft, boundsRight - REACTION_PICKER_WIDTH_PX);
      const preferredLeft = anchorRect.left + (anchorRect.width - REACTION_PICKER_WIDTH_PX) / 2;
      const left = Math.min(Math.max(boundsLeft, preferredLeft), maxLeft);
      const maxTop = Math.max(viewportPadding, window.innerHeight - REACTION_PICKER_HEIGHT_PX - viewportPadding);
      const top = Math.min(
        Math.max(viewportPadding, anchorRect.top - REACTION_PICKER_HEIGHT_PX - 8),
        maxTop,
      );

      setReactionPickerPosition((current) => {
        if (current && current.top === top && current.left === left) {
          return current;
        }

        return { top, left };
      });
    };

    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [openReactionPickerMessageId]);

  useLayoutEffect(() => {
    if (!openMessageActionMenuMessageId || typeof window === 'undefined') {
      setMessageActionMenuPosition((current) => (current === null ? current : null));
      return;
    }

    const syncPosition = () => {
      const trigger = messageActionMenuPointerAnchor
        ? null
        : messageActionTriggerRefs.current[openMessageActionMenuMessageId];
      if (!trigger && !messageActionMenuPointerAnchor) {
        setMessageActionMenuPosition((current) => (current === null ? current : null));
        return;
      }

      const triggerRect = messageActionMenuPointerAnchor
        ? createVirtualAnchorRect(messageActionMenuPointerAnchor)
        : trigger!.getBoundingClientRect();
      const menuWidth = 268;
      const estimatedMenuHeight = 236;
      const viewportPadding = 12;
      const gap = 6;
      const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const availableAbove = triggerRect.top - viewportPadding;
      const openUpward = availableBelow < Math.min(estimatedMenuHeight, 180) && availableAbove > availableBelow;
      const maxAvailableHeight = Math.max(120, (openUpward ? availableAbove : availableBelow) - gap);
      const maxHeight = Math.min(estimatedMenuHeight, maxAvailableHeight);
      const measuredMenuHeight = Math.ceil(messageActionMenuRef.current?.getBoundingClientRect().height ?? 0);
      const effectiveMenuHeight = Math.min(maxHeight, measuredMenuHeight || estimatedMenuHeight);
      const left = Math.max(
        viewportPadding,
        Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding),
      );
      const top = openUpward
        ? Math.max(viewportPadding, triggerRect.top - effectiveMenuHeight - gap)
        : Math.min(window.innerHeight - maxHeight - viewportPadding, triggerRect.bottom + gap);

      setMessageActionMenuPosition((current) => {
        if (
          current
          && current.top === top
          && current.left === left
          && current.width === menuWidth
          && current.maxHeight === maxHeight
        ) {
          return current;
        }

        return {
          top,
          left,
          width: menuWidth,
          maxHeight,
        };
      });
    };

    syncPosition();
    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [messageActionMenuPointerAnchor, openMessageActionMenuMessageId]);

  useLayoutEffect(() => {
    if (!openChatMenuChatId || typeof window === 'undefined') {
      setChatMenuPosition((current) => (current === null ? current : null));
      return;
    }

    const syncPosition = () => {
      const trigger = chatMenuPointerAnchor
        ? null
        : chatMenuTriggerRefs.current[openChatMenuChatId];
      if (!trigger && !chatMenuPointerAnchor) {
        setChatMenuPosition((current) => (current === null ? current : null));
        return;
      }

      const triggerRect = chatMenuPointerAnchor
        ? createVirtualAnchorRect(chatMenuPointerAnchor)
        : trigger!.getBoundingClientRect();
      const menuWidth = 248;
      const menuHeight = 232;
      const viewportPadding = 12;
      const gap = 6;
      const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const availableAbove = triggerRect.top - viewportPadding;
      const openUpward = availableBelow < Math.min(menuHeight, 180) && availableAbove > availableBelow;
      const maxHeight = Math.max(160, Math.min(menuHeight, (openUpward ? availableAbove : availableBelow) - gap));
      const measuredMenuHeight = Math.ceil(chatMenuRef.current?.getBoundingClientRect().height ?? 0);
      const effectiveMenuHeight = Math.min(maxHeight, measuredMenuHeight || menuHeight);
      const left = Math.max(
        viewportPadding,
        Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding),
      );
      const top = openUpward
        ? Math.max(viewportPadding, triggerRect.top - effectiveMenuHeight - gap)
        : Math.min(window.innerHeight - maxHeight - viewportPadding, triggerRect.bottom + gap);

      setChatMenuPosition((current) => {
        if (
          current
          && current.top === top
          && current.left === left
          && current.width === menuWidth
          && current.maxHeight === maxHeight
        ) {
          return current;
        }

        return {
          top,
          left,
          width: menuWidth,
          maxHeight,
        };
      });
    };

    syncPosition();
    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [chatMenuPointerAnchor, openChatMenuChatId]);

  useClickOutside(
    advancedFiltersOpen,
    () => [advancedFiltersRef.current, advancedFiltersTriggerRef.current],
    () => setAdvancedFiltersOpen(false),
  );

  useLayoutEffect(() => {
    if (!advancedFiltersOpen || !advancedFiltersTriggerRef.current || typeof window === 'undefined') {
      return;
    }

    const syncPosition = () => {
      const triggerRect = advancedFiltersTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportPadding = 16;
      const panelWidth = Math.min(292, window.innerWidth - viewportPadding * 2);
      const nextLeft = Math.min(
        Math.max(viewportPadding, triggerRect.left),
        window.innerWidth - panelWidth - viewportPadding,
      );

      const nextTop = triggerRect.bottom + 8;
      setAdvancedFiltersPosition((current) => (
        current && current.top === nextTop && current.left === nextLeft
          ? current
          : { top: nextTop, left: nextLeft }
      ));
    };

    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [advancedFiltersOpen]);

  useLayoutEffect(() => {
    if (!threadActionsMenuOpen || !threadActionsMenuTriggerRef.current || typeof window === 'undefined') {
      setThreadActionsMenuPosition((current) => (current === null ? current : null));
      return;
    }

    const syncPosition = () => {
      const triggerRect = threadActionsMenuTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportPadding = 12;
      const width = Math.min(288, window.innerWidth - viewportPadding * 2);
      const maxHeight = Math.min(420, window.innerHeight - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, triggerRect.right - width),
        window.innerWidth - width - viewportPadding,
      );
      const top = Math.min(
        triggerRect.bottom + 8,
        window.innerHeight - maxHeight - viewportPadding,
      );

      setThreadActionsMenuPosition((current) => (
        current
        && current.top === top
        && current.left === left
        && current.width === width
        && current.maxHeight === maxHeight
          ? current
          : { top, left, width, maxHeight }
      ));
    };

    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [threadActionsMenuOpen]);

  useLayoutEffect(() => {
    if (!mediaDrawerOpen || !mediaDrawerTriggerRef.current || typeof window === 'undefined') {
      return;
    }

    const syncPosition = () => {
      const triggerRect = mediaDrawerTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportPadding = 12;
      const panelWidth = Math.min(360, window.innerWidth - viewportPadding * 2);
      const panelHeight = Math.min(400, window.innerHeight - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, triggerRect.left),
        window.innerWidth - panelWidth - viewportPadding,
      );
      const top = Math.max(viewportPadding, triggerRect.top - panelHeight - 8);

      setMediaDrawerPosition((current) => (
        current
        && current.top === top
        && current.left === left
        && current.width === panelWidth
        && current.maxHeight === panelHeight
          ? current
          : {
              top,
              left,
              width: panelWidth,
              maxHeight: panelHeight,
            }
      ));
    };

    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [mediaDrawerOpen]);

  useEffect(() => {
    const audio = voicePreviewAudioRef.current;
    if (!audio || !voiceAttachment) {
      setVoicePreviewPlaying(false);
      setVoicePreviewCurrentTime(0);
      setVoicePreviewDuration(voiceAttachment?.durationSeconds ?? null);
      return;
    }

    const handleTimeUpdate = () => {
      setVoicePreviewCurrentTime(audio.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setVoicePreviewDuration(audio.duration);
      } else {
        setVoicePreviewDuration(voiceAttachment.durationSeconds ?? null);
      }
    };

    const handleEnded = () => {
      setVoicePreviewPlaying(false);
      setVoicePreviewCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [voiceAttachment, voicePreviewAudioRef, setVoicePreviewCurrentTime, setVoicePreviewDuration, setVoicePreviewPlaying]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
    if (selectedChatId) {
      suppressAutoChatSelectionRef.current = false;
    }
  }, [selectedChatId]);

  const resetFollowUpComposer = useCallback(() => {
    setFollowUpDraft('');
    setFollowUpCustomInstructions('');
    setFollowUpVariations([]);
    setFollowUpAiContextRationale(null);
    setFollowUpEmotionalContext(null);
    setFollowUpCurrentAction('send');
    setFollowUpCurrentActionReason(null);
    setFollowUpOpportunityRecommendation('continue');
    setFollowUpGenerationId(null);
    setFollowUpNextAction(null);
  }, []);

  const { loadOperationalState } = useInboxOperationalState({
    setOperationalState,
    setOperationalStateError,
    setOperationalStateLoaded,
  });

  useEffect(() => {
    if (!leadDrawerOpen) {
      return;
    }

    setLeadSearchQuery('');
  }, [leadDrawerOpen, selectedChatId]);

  useEffect(() => {
    followUpGenerationRequestIdRef.current += 1;
    followUpScheduleRequestIdRef.current += 1;
    setFollowUpModalOpen(false);
    setGeneratingFollowUp(false);
    setSchedulingFollowUpNextAction(false);
    resetFollowUpComposer();

    if (!selectedChat?.lead_id) {
      leadPanelRequestIdRef.current += 1;
      leadContractsRequestIdRef.current += 1;
      chatAgendaSummaryRequestIdRef.current += 1;
      chatAgendaSummaryLeadIdRef.current = null;
      setLeadPanel(null);
      setLeadPanelError(null);
      setLeadPanelLoading(false);
      setLeadContracts([]);
      setLeadContractsLoading(false);
      setLeadContractsError(null);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryError(null);
      setChatAgendaSummaryLoading(false);
      return;
    }

    if (leadPanel?.id !== selectedChat.lead_id) {
      chatAgendaSummaryLeadIdRef.current = null;
      setLeadPanel(null);
      setLeadPanelError(null);
      setLeadContracts([]);
      setLeadContractsError(null);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryError(null);
      setChatAgendaSummaryLoading(true);
    }
  }, [leadPanel?.id, resetFollowUpComposer, selectedChat?.id, selectedChat?.lead_id]);

  useEffect(() => {
    if (!selectedChat?.lead_id) {
      setLeadPanel(null);
      setLeadPanelError(null);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryError(null);
      setChatAgendaSummaryLoading(false);
      return;
    }

    const currentSelectedChat = selectedChatId
      ? latestChatsRef.current.find((chat) => chat.id === selectedChatId) ?? null
      : null;
    void loadLeadPanel(currentSelectedChat);
  }, [loadLeadPanel, selectedChat?.lead_id, selectedChatId]);

  useEffect(() => {
    void loadChatAgendaSummary(
      leadPanel?.id ?? null,
      leadContracts.map((contract) => contract.id),
    );
  }, [leadContracts, leadPanel?.id, loadChatAgendaSummary]);

  useEffect(() => {
    if (!leadPanel?.id) {
      return;
    }

    const unsubscribe = subscribeToInboxReminders(leadPanel.id, leadContracts.map((contract) => contract.id), () => {
      void loadChatAgendaSummary(
        leadPanel.id,
        leadContracts.map((contract) => contract.id),
      );
    });

    return () => {
      unsubscribe();
    };
  }, [leadContracts, leadPanel?.id, loadChatAgendaSummary]);

  useEffect(() => {
    const map = new Map(savedContactNameByPhoneRef.current);
    const manualOverrides = new Map(savedContactNameOverrideByPhoneRef.current);
    addSavedContactsToNameMap(map, savedContacts, manualOverrides);
    savedContactNameByPhoneRef.current = map;
    savedContactNameOverrideByPhoneRef.current = manualOverrides;
    setSavedContactNameRevision((current) => current + 1);
    setChats((current) => applyFrontendSavedContactNames(current));
  }, [applyFrontendSavedContactNames, savedContacts]);

  const refreshArchivedChatsCount = useCallback(async () => {
    if (!archivedChatsCountLoadLockRef.current.tryAcquire('archived-count')) {
      return;
    }

    const requestId = ++archivedChatsCountRequestIdRef.current;

    try {
      const count = await whatsappConversationsRepository.getArchivedCount();
      if (requestId !== archivedChatsCountRequestIdRef.current) {
        return;
      }
      setArchivedChatsCount(count);
    } catch (error) {
      if (requestId !== archivedChatsCountRequestIdRef.current) {
        return;
      }
      if (!isSupabaseConnectivityError(error)) {
        console.warn('[WhatsAppInbox] erro ao carregar contagem de arquivados', error);
      }
    } finally {
      archivedChatsCountLoadLockRef.current.release('archived-count');
    }
  }, []);

  const { loadChats, handleLoadMoreArchivedChats, handleSwitchArchivedSection } = useInboxChatLoader({
    chatActivityFilter,
    leadStatusFilters,
    leadResponsavelFilters,
    pageSize: CHAT_PAGE_SIZE,
    archivedChatsLoading,
    archivedChatsLoadingMore,
    archivedChatsHasMore,
    archivedChatsPage,
    refs: {
      archivedSectionOpenRef,
      archivedChatsPageRef,
      chatsRequestIdRef,
      chatsLoadPromiseRef,
      chatsLoadKeyRef,
      latestChatsRef,
      selectedChatIdRef,
      chatIdFromUrlRef,
      suppressAutoChatSelectionRef,
      pendingChatInboxStateRef,
      savedContactNameByPhoneRef,
      savedContactNameOverrideByPhoneRef,
      chatsSignatureRef,
      chatPollIdleCyclesRef,
      chatPollBackoffRef,
      latestChatsLoadedAtRef,
    },
    setArchivedChatsLoading,
    setArchivedChatsLoadingMore,
    setArchivedChatsHasMore,
    setArchivedChatsPage,
    setChatLoadError,
    setChatRefreshError,
    setChats,
    setArchivedSectionOpen,
    setSelectedChatId,
    applyFrontendSavedContactNames,
    applyPrefetchedLeadNames,
    buildChatsSignature,
    chatMatchesActiveFilters,
    refreshArchivedChatsCount,
  });

  loadChatsRef.current = loadChats;

  const handleRetryChatLoad = useCallback(() => {
    setLoading(true);
    void loadChats().finally(() => setLoading(false));
  }, [loadChats]);

  useWhatsAppInboxDeepLink({
    searchParams,
    setSearchParams,
    selectedChatId,
    chatIdFromUrlRef,
    latestChatsRef,
    setArchivedSectionOpen,
    setSelectedChatId,
    loadChats,
  });

  const { loadMessages } = useInboxMessageLoader({
    selectedChatIdRef,
    messagesRequestIdRef,
    latestMessagesRef,
    messagesSignatureRef,
    messagesCacheByChatIdRef,
    pendingScrollModeRef,
    pendingScrollTopRef,
    pendingScrollHeightRef,
    isNearBottomRef,
    messagesContainerRef,
    setMessages,
    setMessageLoadError,
    setLoadingMessages,
    setThreadReconcileChatId,
    setHasOlderMessages,
    setLeadPanel,
    applyOutgoingOrderToServerMessage,
    buildMessagesSignature,
    reconcileLocalOutgoingMessages,
    upsertChatLocally,
  });

  loadMessagesRef.current = loadMessages;

  const handleRetryMessageLoad = useCallback(async () => {
    if (!selectedChat) {
      return;
    }

    setMessageLoadRetrying(true);
    try {
      await loadMessages(getSelectedChatSnapshot(selectedChat.id), 'initial');
    } finally {
      setMessageLoadRetrying(false);
    }
  }, [getSelectedChatSnapshot, loadMessages, selectedChat]);

  const {
    handleSelectMessageSearchResult,
    handleOpenQuotedMessage,
    handleSelectChatMessageSearchResult,
  } = useInboxMessageNavigation({
    selectedChat,
    refs: {
      selectedChatIdRef,
      latestMessagesRef,
      messagesRequestIdRef,
      messagesSignatureRef,
      messagesCacheByChatIdRef,
      pendingScrollModeRef,
      pendingScrollTopRef,
      pendingScrollHeightRef,
      messageSearchSelectionRequestIdRef,
      pendingMessageSearchChatIdRef,
      quotedMessageNavigationRequestIdRef,
      composerTextareaRef,
    },
    setChatMenuPointerAnchor,
    setOpenChatMenuChatId,
    setMessages,
    setMessageLoadError,
    setLoadingMessages,
    setHasOlderMessages,
    setThreadReconcileChatId,
    setSelectedChatId,
    setHighlightedMessageId,
    buildMessagesSignature,
    loadMessages,
    upsertChatLocally,
  });

  const handleToggleChatMessageSearch = useCallback(() => {
    setChatMessageSearchOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        window.setTimeout(() => chatMessageSearchInputRef.current?.focus(), 0);
      }
      return nextOpen;
    });
  }, []);

  useEffect(() => {
    setChatMessageSearchDraft('');
    setChatMessageSearchOpen(false);
  }, [selectedChatId]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!selectedChatIdRef.current || (!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== 'f') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const editableTarget = target?.closest('input, textarea, [contenteditable="true"]');
      if (editableTarget && editableTarget !== chatMessageSearchInputRef.current) {
        return;
      }

      event.preventDefault();
      setChatMessageSearchOpen(true);
      window.setTimeout(() => chatMessageSearchInputRef.current?.focus(), 0);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      // Recarrega a seção que está visível. Quando filtros mudam com
      // "Arquivadas" aberta, buscar apenas "Ativas" deixava a lista visível
      // com dados do filtro anterior até o usuário alternar de seção.
      await Promise.all([loadChats(), loadOperationalState(), refreshArchivedChatsCount()]);
      if (active) {
        setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadChats, loadOperationalState, refreshArchivedChatsCount]);

  useInboxChannelSubscriptions({
    channelId: channelState?.id ?? null,
    onChatChange: applyRealtimeChatChange,
    onPresenceChange: applyRealtimePresenceChange,
  });

  useEffect(() => {
    if (!selectedChat?.id) return undefined;
    let active = true;

    void commWhatsAppService.ensureChatPresence(selectedChat.id)
      .then((result) => {
        if (!active) return;
        setChats((current) => applyChatPresenceUpdate(current, {
          chatId: selectedChat.id,
          status: result.presence?.status ?? null,
          lastSeenAt: result.presence?.last_seen_at ?? null,
          updatedAt: result.presence?.observed_at ?? null,
        }));
      })
      .catch((error) => {
        if (!active || isSupabaseConnectivityError(error)) return;
        console.warn('[WhatsAppInbox] nao foi possivel ativar presenca da conversa', error);
      });

    return () => {
      active = false;
    };
  }, [selectedChat?.id]);

  useInboxMessageSelection({
    selectedChatId,
    refs: {
      pendingScrollModeRef,
      pendingScrollTopRef,
      pendingScrollHeightRef,
      isNearBottomRef,
      messagesSignatureRef,
      messagesCacheByChatIdRef,
      pendingMessageSearchChatIdRef,
      lastSelectedChatPreviewRefreshKeyRef,
      cancelVoiceRecordingRef,
    },
    getSelectedChatSnapshot,
    loadMessages,
    setMessages,
    setMessageLoadError,
    setLoadingMessages,
    setThreadReconcileChatId,
    setLoadingOlderMessages,
    setHasOlderMessages,
    setReplyTargetMessage,
  });

  useEffect(
    () => () => {
      for (const controller of mediaUploadAbortControllersRef.current.values()) {
        controller.abort();
      }
      mediaUploadAbortControllersRef.current.clear();
      cancelVoiceRecordingRef.current();
      chatsRequestIdRef.current += 1;
      messagesRequestIdRef.current += 1;
      leadPanelRequestIdRef.current += 1;
      leadContractsRequestIdRef.current += 1;
      chatAgendaSummaryRequestIdRef.current += 1;
      archivedChatsCountRequestIdRef.current += 1;
      followUpGenerationRequestIdRef.current += 1;
      followUpScheduleRequestIdRef.current += 1;
      composerRewriteRequestIdRef.current += 1;
      replySuggestionRequestIdRef.current += 1;
      quickRepliesLoadRequestIdRef.current += 1;
      quickRepliesSaveRequestIdRef.current += 1;

    },
    [],
  );

  useInboxPolling({
    pollingEnabled,
    loading,
    selectedChatId,
    loadingOlderMessages,
    chatPollBackoffRef,
    chatPollIdleCyclesRef,
    isChannelConnectedRef,
    isMessageRealtimeHealthyRef,
    latestChatsLoadedAtRef,
    selectedChatIdRef,
    loadChats,
    refreshArchivedChatsCount,
    loadOperationalState,
    getSelectedChatSnapshot,
    loadMessages,
  });

  useInboxSelectedChatPreviewRefresh({
    selectedChat,
    loadingOlderMessages,
    refs: {
      latestMessagesRef,
      messagesSignatureRef,
      lastSelectedChatPreviewRefreshKeyRef,
    },
    getSelectedChatSnapshot,
    loadMessages,
  });

  const { scheduleMessageStatusRefresh } = useInboxMessageStatusRefresh({
    refs: { latestMessagesRef, loadChatsRef, loadMessagesRef },
    pollingEnabled,
    selectedChatId,
    selectedChat,
    visibleMessages,
    refreshableOutboundStatuses: REFRESHABLE_OUTBOUND_STATUSES,
    setLocalOutgoingMessages,
  });

  const markSelectedChatReadIfEligible = useCallback((source: 'auto' | 'scroll') => {
    const currentChat = selectedChatIdRef.current
      ? latestChatsRef.current.find((chat) => chat.id === selectedChatIdRef.current) ?? null
      : null;

    if (!currentChat || !isNearBottomRef.current) {
      console.debug('[WhatsAppInbox][mark-read] skip:not-ready-or-not-bottom', {
        source,
        selectedChatId: selectedChatIdRef.current,
        hasCurrentChat: Boolean(currentChat),
        isNearBottom: isNearBottomRef.current,
      });
      return;
    }

    const skipManualUnreadRead = manualUnreadSkipReadChatIdRef.current === currentChat.id
      && currentChat.manual_unread
      && currentChat.unread_count <= 0;

    if (source !== 'scroll' && skipManualUnreadRead) {
      console.debug('[WhatsAppInbox][mark-read] skip:manual-unread-protection', {
        source,
        chatId: currentChat.id,
        unreadCount: currentChat.unread_count,
        manualUnread: currentChat.manual_unread,
      });
      return;
    }

    // Manual unread is an explicit reminder; selecting/opening the chat should
    // not clear it until the user reaches the end of the message timeline.
    if (source !== 'scroll' && currentChat.manual_unread && currentChat.unread_count <= 0) {
      console.debug('[WhatsAppInbox][mark-read] skip:manual-unread-await-scroll', {
        source,
        chatId: currentChat.id,
        unreadCount: currentChat.unread_count,
        manualUnread: currentChat.manual_unread,
      });
      return;
    }

    if (currentChat.unread_count <= 0 && !currentChat.manual_unread) {
      console.debug('[WhatsAppInbox][mark-read] skip:already-read', {
        source,
        chatId: currentChat.id,
        unreadCount: currentChat.unread_count,
        manualUnread: currentChat.manual_unread,
        lastReadAt: currentChat.last_read_at,
        lastMessageAt: currentChat.last_message_at,
      });
      return;
    }

    const renderedMessagesForChat = latestMessagesRef.current
      .filter((message) => message.chat_id === currentChat.id)
      .sort(compareMessageChronology);
    const latestRenderedMessage = renderedMessagesForChat[renderedMessagesForChat.length - 1];
    const latestRenderedMessageAtMs = getMessageTimestampMs(latestRenderedMessage?.message_at);
    const selectedChatLastMessageAtMs = getMessageTimestampMs(currentChat.last_message_at);

    if (selectedChatLastMessageAtMs !== null && (latestRenderedMessageAtMs === null || latestRenderedMessageAtMs < selectedChatLastMessageAtMs)) {
      console.debug('[WhatsAppInbox][mark-read] skip:last-message-not-rendered', {
        source,
        chatId: currentChat.id,
        selectedChatLastMessageAt: currentChat.last_message_at,
        selectedChatLastMessageAtMs,
        latestRenderedMessageAt: latestRenderedMessage?.message_at ?? null,
        latestRenderedMessageAtMs,
        renderedMessagesForChat: renderedMessagesForChat.length,
      });
      return;
    }

    const readAt = selectedChatLastMessageAtMs !== null && (latestRenderedMessageAtMs === null || selectedChatLastMessageAtMs >= latestRenderedMessageAtMs)
      ? currentChat.last_message_at
      : latestRenderedMessage?.message_at ?? new Date().toISOString();
    const readPatch: PendingChatInboxStatePatch = {
      unread_count: 0,
      manual_unread: false,
      manual_unread_at: null,
      last_read_at: readAt,
    };
    const readKey = `${currentChat.id}:${readAt ?? ''}`;
    const lastAttemptAt = attemptedChatReadAtByKeyRef.current.get(readKey) ?? 0;
    const retryCooldownActive = Date.now() - lastAttemptAt < CHAT_READ_RETRY_COOLDOWN_MS;

    if (pendingChatReadKeysRef.current.has(readKey) || retryCooldownActive) {
      console.debug('[WhatsAppInbox][mark-read] skip:in-flight-or-cooldown', {
        source,
        chatId: currentChat.id,
        readAt,
        readKey,
        inFlight: pendingChatReadKeysRef.current.has(readKey),
        retryCooldownActive,
        msSinceLastAttempt: lastAttemptAt > 0 ? Date.now() - lastAttemptAt : null,
      });
      return;
    }

    const readMutationVersion = (chatReadMutationVersionByChatIdRef.current.get(currentChat.id) ?? 0) + 1;
    chatReadMutationVersionByChatIdRef.current.set(currentChat.id, readMutationVersion);
    pendingChatReadKeysRef.current.add(readKey);
    attemptedChatReadAtByKeyRef.current.set(readKey, Date.now());

    console.debug('[WhatsAppInbox][mark-read] request:start', {
      source,
      chatId: currentChat.id,
      readAt,
      readKey,
      unreadCountBefore: currentChat.unread_count,
      manualUnreadBefore: currentChat.manual_unread,
      lastReadAtBefore: currentChat.last_read_at,
      lastMessageAt: currentChat.last_message_at,
      latestRenderedMessageAt: latestRenderedMessage?.message_at ?? null,
      isNearBottom: isNearBottomRef.current,
    });

    mergePendingChatInboxState(pendingChatInboxStateRef.current, currentChat.id, readPatch);
    upsertChatLocally({ ...currentChat, ...readPatch });

    if (manualUnreadSkipReadChatIdRef.current === currentChat.id) {
      manualUnreadSkipReadChatIdRef.current = null;
    }

    void whatsappConversationsRepository.markRead(currentChat.id, {
      messageAt: readAt,
    }).then((result) => {
      if (chatReadMutationVersionByChatIdRef.current.get(currentChat.id) !== readMutationVersion) {
        return;
      }

      const latestChat = latestChatsRef.current.find((chat) => chat.id === currentChat.id) ?? currentChat;

      console.debug('[WhatsAppInbox][mark-read] request:success', {
        source,
        chatId: currentChat.id,
        readAt,
        result,
        latestChatBeforePatch: {
          unreadCount: latestChat.unread_count,
          manualUnread: latestChat.manual_unread,
          manualUnreadAt: latestChat.manual_unread_at,
          lastReadAt: latestChat.last_read_at,
          lastMessageAt: latestChat.last_message_at,
        },
      });

      const confirmedPatch: PendingChatInboxStatePatch = {
        unread_count: result.unreadCount,
        manual_unread: result.unreadCount > 0 ? latestChat.manual_unread : false,
        manual_unread_at: result.unreadCount > 0 ? latestChat.manual_unread_at : null,
        last_read_at: result.lastReadAt ?? readAt,
      };

      clearPendingChatReadState(pendingChatInboxStateRef.current, currentChat.id);

      upsertChatLocally({
        ...latestChat,
        ...confirmedPatch,
      });

      console.debug('[WhatsAppInbox][mark-read] local:patched-from-confirmation', {
        source,
        chatId: currentChat.id,
        readAt,
        confirmedPatch,
      });

      if (result.unreadCount > 0) {
        console.warn('[WhatsAppInbox] leitura confirmada com nao lidas remanescentes', {
          chatId: currentChat.id,
          readAt,
          result,
        });
      } else {
        attemptedChatReadAtByKeyRef.current.delete(readKey);
      }
      chatReadMutationVersionByChatIdRef.current.delete(currentChat.id);
    }).catch((error) => {
      if (chatReadMutationVersionByChatIdRef.current.get(currentChat.id) !== readMutationVersion) {
        return;
      }

      clearPendingChatReadState(pendingChatInboxStateRef.current, currentChat.id);
      chatReadMutationVersionByChatIdRef.current.delete(currentChat.id);
      console.error('[WhatsAppInbox][mark-read] request:error', {
        source,
        chatId: currentChat.id,
        readAt,
        readKey,
        error,
      });
      toast.error(error instanceof Error ? error.message : 'Não foi possível marcar a conversa como lida.');
      void loadChats().catch((loadError) => {
        console.error('[WhatsAppInbox][mark-read] reload-after-error:error', loadError);
      });
    }).finally(() => {
      pendingChatReadKeysRef.current.delete(readKey);
      console.debug('[WhatsAppInbox][mark-read] request:finished', {
        source,
        chatId: currentChat.id,
        readAt,
        readKey,
      });
    });
  }, [loadChats, upsertChatLocally]);

  useEffect(() => {
    markSelectedChatReadIfEligible('auto');
  }, [markSelectedChatReadIfEligible, selectedChat, visibleMessages]);

  useEffect(() => {
    if (manualUnreadSkipReadChatIdRef.current && manualUnreadSkipReadChatIdRef.current !== selectedChatId) {
      manualUnreadSkipReadChatIdRef.current = null;
    }
  }, [selectedChatId]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (pendingScrollModeRef.current === 'bottom') {
      container.scrollTop = container.scrollHeight;
      isNearBottomRef.current = true;
    } else if (pendingScrollModeRef.current === 'preserve' && pendingScrollTopRef.current !== null) {
      container.scrollTop = pendingScrollTopRef.current;
    } else if (
      pendingScrollModeRef.current === 'prepend' &&
      pendingScrollTopRef.current !== null &&
      pendingScrollHeightRef.current !== null
    ) {
      const delta = container.scrollHeight - pendingScrollHeightRef.current;
      container.scrollTop = pendingScrollTopRef.current + Math.max(delta, 0);
    }

    pendingScrollModeRef.current = null;
    pendingScrollTopRef.current = null;
    pendingScrollHeightRef.current = null;
  }, [localOutgoingMessages, messages, selectedChatId]);

  useLayoutEffect(() => {
    if (!highlightedMessageId) {
      return;
    }

    const messageNode = messageBubbleRefs.current[highlightedMessageId];
    if (!messageNode) {
      return;
    }

    messageNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightedMessageId, messages]);

  useEffect(() => {
    if (!highlightedMessageId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === highlightedMessageId ? null : current));
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedMessageId]);

  const { handleLoadOlderMessages } = useInboxOlderMessages({
    selectedChat,
    loadingOlderMessages,
    hasOlderMessages,
    refs: {
      latestMessagesRef,
      selectedChatIdRef,
      messagesSignatureRef,
      messagesContainerRef,
      pendingScrollModeRef,
      pendingScrollTopRef,
      pendingScrollHeightRef,
    },
    setLoadingOlderMessages,
    setHasOlderMessages,
    setMessages,
    buildMessagesSignature,
  });

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    isNearBottomRef.current = isScrolledNearBottom(container);
    if (isNearBottomRef.current) {
      markSelectedChatReadIfEligible('scroll');
    }
  }, [isScrolledNearBottom, markSelectedChatReadIfEligible]);

  const resizeComposerTextarea = useCallback((target?: HTMLTextAreaElement | null) => {
    const textarea = target ?? composerTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';

    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;

    const minHeight = lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = lineHeight * 5 + paddingTop + paddingBottom + borderTop + borderBottom;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    const expanded = nextHeight > minHeight + 2;

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight + 1 ? 'auto' : 'hidden';
    setIsComposerExpanded(expanded);
  }, []);

  useLayoutEffect(() => {
    resizeComposerTextarea();
  }, [messageDraft, pendingAttachments.length, resizeComposerTextarea, selectedChatId, voiceAttachment?.id]);

  const handleSendCurrentVoiceRecording = () => {
    if (voiceRecordingState === 'recording') {
      handleStopVoiceRecording(true);
      return;
    }

    if (voiceAttachment) {
      void handleSendMessage();
    }
  };

  const { sendTextSegments, handleSendMessage, handleSendDrawerMedia } = useInboxMessageSending({
    selectedChat,
    mediaDrawerSendDisabledReason,
    messageDraft,
    pendingAttachments,
    replyTargetMessage,
    sendDisabledReason,
    composerSendLock: composerSendLockRef.current,
    mediaUploadAbortControllersRef,
    localOutgoingRetryPayloadRef,
    refreshableOutboundStatuses: REFRESHABLE_OUTBOUND_STATUSES,
    resolveComposerVariables,
    resetComposerAfterQueue,
    setReplyTargetMessage,
    setSendingDrawerMediaByChatId,
    enqueueChatSend,
    allocateOptimisticMessageTimestamps,
    appendLocalOutgoingMessage,
    applyOptimisticChatSummary,
    buildOptimisticOutgoingMessage,
    patchLocalOutgoingMessage,
    updateOptimisticChatPreviewStatus,
    setMediaUploadProgress: setMediaUploadProgressForSelectedChat,
    updateMediaUploadProgress,
    clearMediaUploadProgress,
    loadChats,
    loadMessages,
    scheduleMessageStatusRefresh,
  });
  const { handleRetryMediaMessage } = useInboxMessageRetry({
    selectedChat,
    localOutgoingRetryPayloadRef,
    setRetryingMessageId,
    refreshableOutboundStatuses: REFRESHABLE_OUTBOUND_STATUSES,
    enqueueChatSend,
    patchLocalOutgoingMessage,
    removeLocalOutgoingMessage,
    loadChats,
    loadMessages,
    scheduleMessageStatusRefresh,
  });

  const handleSelectInteractiveReply = useCallback((message: CommWhatsAppMessage, option: { id: string | null; title: string | null }) => {
    if (!selectedChat || message.direction !== 'inbound') return;

    const replyText = (option.title || option.id || '').trim();
    if (!replyText) return;

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    // A Whapi expoe a leitura e o envio de mensagens interativas, mas nao um
    // endpoint para sintetizar o evento nativo de "button reply" recebido de
    // uma mensagem de terceiros. Enviamos o titulo escolhido como texto,
    // citado na mensagem original — formato que os bots de atendimento usam
    // como fallback e que deixa a escolha visivel no historico.
    sendTextSegments(selectedChat, [replyText], getQuotePayloadFromMessage(message));
  }, [selectedChat, sendDisabledReason, sendTextSegments]);

  useEffect(() => {
    if (!voiceAttachment) {
      autoSendVoiceRef.current = false;
      return;
    }

    if (!autoSendVoiceRef.current) {
      return;
    }

    autoSendVoiceRef.current = false;
    void handleSendMessage();
  }, [handleSendMessage, voiceAttachment, autoSendVoiceRef]);

  const handleCancelMediaUpload = () => {
    const activeChatId = selectedChatIdRef.current;
    if (activeChatId) {
      mediaUploadAbortControllersRef.current.get(activeChatId)?.abort();
    }
  };

  const handleOpenEditMessageModal = useCallback((message: CommWhatsAppMessage) => {
    if (!canEditOutboundMessage(message)) {
      toast.error('Esta mensagem não pode ser editada no momento.');
      return;
    }

    setEditingMessage(message);
    setEditingMessageDraft(getMessageEditableText(message));
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
  }, []);

  const handleCloseEditMessageModal = useCallback(() => {
    setEditingMessage(null);
    setEditingMessageDraft('');
  }, []);

  const handleReplyToMessage = useCallback((message: CommWhatsAppMessage) => {
    if (!canReplyOrForwardMessage(message)) {
      toast.error('Esta mensagem não pode ser respondida no momento.');
      return;
    }

    setReplyTargetMessage(message);
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
    window.setTimeout(() => composerTextareaRef.current?.focus(), 0);
  }, []);

  const handleOpenForwardMessageModal = useCallback((message: CommWhatsAppMessage) => {
    if (!canReplyOrForwardMessage(message)) {
      toast.error('Esta mensagem não pode ser encaminhada no momento.');
      return;
    }

    setForwardingMessage(message);
    setForwardSearch('');
    setForwardingTargetIds([]);
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
  }, []);

  const handleCloseForwardMessageModal = useCallback(() => {
    setForwardingMessage(null);
    setForwardSearch('');
    setForwardingTargetIds([]);
    setForwardingInProgress(false);
  }, []);

  const handleToggleForwardTarget = useCallback((chatId: string) => {
    setForwardingTargetIds((current) => (
      current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId]
    ));
  }, []);

  const handleForwardToSelectedChats = useCallback(async () => {
    if (!forwardingMessage || forwardingInProgress) {
      return;
    }

    if (forwardingTargetIds.length === 0) {
      toast.error('Selecione pelo menos uma conversa para encaminhar.');
      return;
    }

    setForwardingInProgress(true);

    try {
      const targetChats = forwardTargetChats.filter((chat) => forwardingTargetIds.includes(chat.id));
      const forwardedCount = await whatsappMessagesRepository.forwardToChats(
        forwardingMessage.id,
        targetChats.map((chat) => chat.external_chat_id),
      );

      const affectedChatIds = targetChats.map((chat) => chat.id);
      const reloads: Array<Promise<unknown>> = [loadChats()];
      if (selectedChatIdRef.current && affectedChatIds.includes(selectedChatIdRef.current)) {
        const selectedChatSnapshot = latestChatsRef.current.find((chat) => chat.id === selectedChatIdRef.current) ?? null;
        if (selectedChatSnapshot) {
          reloads.push(loadMessages(selectedChatSnapshot, 'send'));
        }
      }

      await Promise.all(reloads);

      if (forwardedCount.length > 0) {
        toast.success(`Mensagem encaminhada para ${forwardedCount.length} ${forwardedCount.length === 1 ? 'conversa' : 'conversas'}.`);
      }
      handleCloseForwardMessageModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao encaminhar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível encaminhar a mensagem.');
      setForwardingInProgress(false);
    }
  }, [forwardingInProgress, forwardingMessage, forwardingTargetIds, forwardTargetChats, handleCloseForwardMessageModal, loadChats, loadMessages]);

  const handleSaveEditedMessage = useCallback(async () => {
    if (!editingMessage) {
      return;
    }

    const targetMessage = editingMessage;
    if (!editingMessageLockRef.current.tryAcquire(targetMessage.id)) {
      return;
    }

    const nextText = editingMessageDraft.trim();
    if (!nextText) {
      editingMessageLockRef.current.release(targetMessage.id);
      toast.error('Digite o novo texto da mensagem.');
      return;
    }

    const previousText = getMessageEditableText(targetMessage);
    if (previousText === nextText) {
      editingMessageLockRef.current.release(targetMessage.id);
      handleCloseEditMessageModal();
      return;
    }

    setSavingMessageEdit(true);

    try {
      const result = await whatsappMessagesRepository.edit(targetMessage.id, nextText);
      const editedText = result.editedText || nextText;
      const editedAt = result.editedAt || new Date().toISOString();
      const metadata = targetMessage.metadata && typeof targetMessage.metadata === 'object' && !Array.isArray(targetMessage.metadata)
        ? targetMessage.metadata as Record<string, unknown>
        : {};
      const existingHistory = Array.isArray(metadata.edit_history) ? metadata.edit_history : [];
      const isMediaMessage = targetMessage.message_type.trim().toLowerCase() !== 'text';

      patchMessageLocally(targetMessage.id, {
        text_content: editedText,
        media_caption: isMediaMessage ? editedText : targetMessage.media_caption,
        status_updated_at: editedAt,
        metadata: {
          ...metadata,
          edited: true,
          edited_at: editedAt,
          original_text_content: String(metadata.original_text_content ?? '').trim() || previousText || null,
          edit_action_type: 'manual_edit',
          edit_history: [
            ...existingHistory,
            {
              at: editedAt,
              previous_text: previousText || null,
              next_text: editedText,
              action_type: 'manual_edit',
            },
          ].slice(-10),
        },
      });

      const editedMessageAt = getMessageTimestampMs(targetMessage.message_at);
      setChats((current) => current.map((chat) => (
        chat.id === targetMessage.chat_id
        && editedMessageAt !== null
        && getMessageTimestampMs(chat.last_message_at) === editedMessageAt
          ? { ...chat, last_message_text: editedText, updated_at: editedAt }
          : chat
      )));

      toast.success('Mensagem editada no WhatsApp.');
      handleCloseEditMessageModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao editar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível editar a mensagem no WhatsApp.');
    } finally {
      editingMessageLockRef.current.release(targetMessage.id);
      setSavingMessageEdit(false);
    }
  }, [editingMessage, editingMessageDraft, handleCloseEditMessageModal, patchMessageLocally]);

  const handleDeleteMessage = useCallback(async (message: CommWhatsAppMessage) => {
    if (!canDeleteOutboundMessage(message)) {
      toast.error('Esta mensagem não pode ser apagada no momento.');
      return;
    }

    if (!deletingMessageLockRef.current.tryAcquire(message.id)) {
      return;
    }

    setDeletingMessageId(message.id);

    try {
      const result = await whatsappMessagesRepository.delete(message.id);
      const deletedAt = result.deletedAt || new Date().toISOString();
      const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
        ? message.metadata as Record<string, unknown>
        : {};
      const preservedText = getMessageEditableText(message) || String(message.text_content ?? message.media_caption ?? '').trim() || getDeletedMessageMarker(message.message_type);

      patchMessageLocally(message.id, {
        delivery_status: 'deleted',
        status_updated_at: deletedAt,
        metadata: {
          ...metadata,
          deleted: true,
          deleted_at: deletedAt,
          deleted_action_type: 'manual_delete',
          deleted_by: 'self',
          deleted_original_text_content: String(metadata.deleted_original_text_content ?? '').trim() || preservedText,
        },
      });

      setChats((current) => current.map((chat) => chat.id === message.chat_id && chat.last_message_at === message.message_at
        ? { ...chat, last_message_text: buildDeletedMessageSummary(message.message_type, preservedText), updated_at: deletedAt }
        : chat));

      toast.success('Mensagem apagada no WhatsApp.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao apagar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível apagar a mensagem no WhatsApp.');
    } finally {
      deletingMessageLockRef.current.release(message.id);
      setDeletingMessageId((current) => (current === message.id ? null : current));
    }
  }, [patchMessageLocally]);

  const handleTranscribeMessage = async (message: CommWhatsAppMessage) => {
    if (!transcriptionMessageLockRef.current.tryAcquire(message.id)) {
      return;
    }

    setTranscribingMessageId(message.id);
    patchMessageLocally(message.id, {
      transcription_status: 'processing',
      transcription_error: null,
    });

    try {
      const result = await whatsappMessagesRepository.transcribe(message.id, {
        force: message.transcription_status === 'failed' || Boolean(message.transcription_text?.trim()),
      });

      patchMessageLocally(message.id, {
        transcription_text: result.transcription_text,
        transcription_status: result.transcription_status,
        transcription_provider: result.transcription_provider ?? null,
        transcription_model: result.transcription_model ?? null,
        transcription_error: null,
        transcription_updated_at: new Date().toISOString(),
      });
      toast.success('Transcrição concluída.');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Não foi possível transcrever este áudio.';
      patchMessageLocally(message.id, {
        transcription_status: 'failed',
        transcription_error: messageText,
      });
      toast.error(messageText);
    } finally {
      transcriptionMessageLockRef.current.release(message.id);
      setTranscribingMessageId((current) => (current === message.id ? null : current));
    }
  };

  const handleRefreshLeadContracts = useCallback(() => {
    void loadLeadContracts(leadPanel?.id ?? null);
  }, [leadPanel?.id, loadLeadContracts]);

  const handleOpenLeadDrawer = () => {
    if (selectedChat?.is_group) {
      return;
    }
    setLeadDrawerOpen(true);
  };

  const handleCloseLeadDrawer = () => {
    setLeadDrawerOpen(false);
  };

  const handleOpenCreateLeadFromChat = useCallback(() => {
    if (!selectedChat || selectedChat.is_group) {
      return;
    }

    setCreateLeadDraft({
      chatId: selectedChat.id,
      initialValues: {
        nome_completo: selectedChatDisplayName,
        telefone: selectedChat.phone_number || selectedChat.phone_digits || '',
      },
    });
  }, [selectedChat, selectedChatDisplayName]);

  const handleCloseCreateLeadFromChat = useCallback(() => {
    setCreateLeadDraft(null);
  }, []);

  const {
    handleCreateLeadFromChatSaved,
    handleLinkLead,
    handleUnlinkLead,
    handleLeadStatusChange,
    handleLeadResponsavelChange,
  } = useInboxLeadMutations({
    selectedChat,
    selectedChatIdRef,
    leadPanel,
    leadContracts,
    createLeadChatId: createLeadDraft?.chatId ?? null,
    leadMutationLockRef,
    leadMutationRequestIdRef,
    setLeadMutationLoadingChatId,
    setLinkLoadingLeadId,
    closeCreateLeadDraft: handleCloseCreateLeadFromChat,
    setSelectedChatId,
    setLeadPanel,
    setLeadContracts,
    setLeadContractsError,
    setLeadSearchQuery,
    setStatusReminderLead,
    setStatusReminderPromptMessage,
    setChatAgendaSummary,
    upsertChatLocally,
    loadLeadPanel,
    loadChats,
    loadChatAgendaSummary,
  });

  const handleViewLeadInCrm = () => {
    navigate('/painel/leads');
  };

  const handleSaveSharedContact = useCallback(async (contact: { name: string | null; phoneNumber: string | null }) => {
    const displayName = contact.name?.trim() ?? '';
    const phoneNumber = contact.phoneNumber?.trim() ?? '';

    if (!displayName) {
      toast.error('O contato compartilhado precisa de um nome para ser salvo.');
      return;
    }

    if (!phoneNumber) {
      toast.error('Este contato compartilhado não possui telefone válido.');
      return;
    }

    const actionKey = `save:${phoneNumber}`;
    setSharedContactActionKey(actionKey);

    try {
      await whatsappContactsRepository.save({
        phoneNumber,
        displayName,
      });

      rememberManualSavedContactName(phoneNumber, displayName);
      void refreshStartChatSources(startChatQuery, 1, false);
      void loadChats();
      toast.success('Contato salvo com sucesso.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao salvar contato compartilhado', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o contato compartilhado.');
    } finally {
      setSharedContactActionKey((current) => (current === actionKey ? null : current));
    }
  }, [loadChats, refreshStartChatSources, rememberManualSavedContactName, startChatQuery]);

  const handleSaveContactToPhonebook = useCallback(async () => {
    const name = saveContactName.trim();
    if (!name) {
      toast.error('Informe um nome para salvar o contato.');
      return;
    }
    if (!selectedChat) return;

    const targetChat = selectedChatForPresentation ?? selectedChat;
    if (!contactSaveLockRef.current.tryAcquire(targetChat.id)) {
      return;
    }

    const isRenaming = Boolean(targetChat.saved_contact_name?.trim());

    setSavingContact(true);
    try {
      if (isRenaming) {
        await whatsappContactsRepository.rename({
          phoneNumber: targetChat.phone_number,
          displayName: name,
        });
        toast.success('Contato renomeado com sucesso.');
      } else {
        await whatsappContactsRepository.save({
          phoneNumber: targetChat.phone_number,
          displayName: name,
        });
        toast.success('Contato salvo com sucesso.');
      }
      rememberManualSavedContactName(targetChat.phone_digits || targetChat.phone_number, name);
      setSaveContactDialogOpen(false);
      void refreshStartChatSources(startChatQuery, 1, false);
      void loadChats();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao salvar contato', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o contato.');
    } finally {
      contactSaveLockRef.current.release(targetChat.id);
      setSavingContact(false);
    }
  }, [rememberManualSavedContactName, saveContactName, selectedChat, selectedChatForPresentation, loadChats, refreshStartChatSources, startChatQuery]);

  const syncComposerSelection = useCallback((target: HTMLTextAreaElement | null) => {
    if (!target) {
      return;
    }

    const nextSelection = {
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    };

    setComposerSelection((current) => {
      if (current.start === nextSelection.start && current.end === nextSelection.end) {
        return current;
      }

      return nextSelection;
    });
  }, [setComposerSelection]);

  const handleComposerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageDraft(event.target.value);
    syncComposerSelection(event.target);
    resizeComposerTextarea(event.target);
  };

  const handleInsertQuickReply = useCallback((option: QuickReplyOption) => {
    const textarea = composerTextareaRef.current;
    const nextSelection = textarea
      ? {
          start: textarea.selectionStart ?? composerSelection.start,
          end: textarea.selectionEnd ?? composerSelection.end,
        }
      : composerSelection;
    const match = getActiveQuickReplyMatch(messageDraft, nextSelection) ?? activeQuickReplyMatch;

    if (!match) {
      return;
    }

    const nextValue = `${messageDraft.slice(0, match.start)}${option.text}${messageDraft.slice(match.end)}`;
    const nextCursor = match.start + option.text.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setDismissedQuickReplyKey(null);
    setQuickReplyActiveIndex(0);

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [activeQuickReplyMatch, composerSelection, messageDraft, setComposerSelection, setMessageDraft]);

  const handleInsertEmoji = useCallback((emoji: string) => {
    const textarea = composerTextareaRef.current;
    const nextSelection = textarea
      ? {
          start: textarea.selectionStart ?? composerSelection.start,
          end: textarea.selectionEnd ?? composerSelection.end,
        }
      : composerSelection;

    const nextValue = `${messageDraft.slice(0, nextSelection.start)}${emoji}${messageDraft.slice(nextSelection.end)}`;
    const nextCursor = nextSelection.start + emoji.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [composerSelection, messageDraft, setComposerFocused, setComposerSelection, setMessageDraft]);

  const handleApplyComposerTextFormat = useCallback((format: WhatsAppTextFormat) => {
    const textarea = composerTextareaRef.current;
    const nextSelection = textarea
      ? {
          start: textarea.selectionStart ?? composerSelection.start,
          end: textarea.selectionEnd ?? composerSelection.end,
        }
      : composerSelection;
    const marker = format === 'strike' ? '~' : format === 'italic' ? '_' : '*';
    const selectedText = messageDraft.slice(nextSelection.start, nextSelection.end);
    const hasSelection = nextSelection.end > nextSelection.start;
    const insertion = hasSelection ? `${marker}${selectedText}${marker}` : `${marker}${marker}`;
    const nextValue = `${messageDraft.slice(0, nextSelection.start)}${insertion}${messageDraft.slice(nextSelection.end)}`;
    const nextCursor = hasSelection
      ? nextSelection.end + marker.length * 2
      : nextSelection.start + marker.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [composerSelection, messageDraft, setComposerFocused, setComposerSelection, setMessageDraft]);

  const handleOpenQuickReplySettings = useCallback(() => {
    setQuickRepliesModalOpen(true);
  }, []);

  const handleCloseQuickReplySettings = useCallback(() => {
    quickRepliesSaveRequestIdRef.current += 1;
    setSavingQuickReplies(false);
    setQuickRepliesModalOpen(false);
  }, []);

  const handleSaveQuickReplies = useCallback(async (nextQuickReplies: WhatsAppQuickReply[]) => {
    if (savingQuickReplies) {
      return;
    }

    quickRepliesLoadRequestIdRef.current += 1;
    const requestId = ++quickRepliesSaveRequestIdRef.current;
    setSavingQuickReplies(true);

    try {
      const settingsPayload = buildWhatsAppQuickRepliesSettings(nextQuickReplies);
      const result = quickReplyIntegration?.id
        ? await configService.updateIntegrationSetting(quickReplyIntegration.id, {
            settings: settingsPayload,
          })
        : await configService.createIntegrationSetting({
            slug: WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG,
            name: WHATSAPP_QUICK_REPLIES_INTEGRATION_NAME,
            description: WHATSAPP_QUICK_REPLIES_INTEGRATION_DESCRIPTION,
            settings: settingsPayload,
          });

      if (result.error) {
        throw result.error;
      }

      if (requestId !== quickRepliesSaveRequestIdRef.current) {
        return;
      }

      const savedIntegration = result.data ?? quickReplyIntegration;
      const normalized = normalizeWhatsAppQuickRepliesSettings(savedIntegration?.settings ?? settingsPayload);

      setQuickReplyIntegration(savedIntegration);
      setQuickReplies(normalized.quickReplies);
      setQuickRepliesModalOpen(false);
      setDismissedQuickReplyKey(null);
      toast.success('Mensagens rápidas salvas com sucesso.');
    } catch (error) {
      if (requestId !== quickRepliesSaveRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao salvar mensagens rápidas', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as mensagens rápidas.');
    } finally {
      if (requestId === quickRepliesSaveRequestIdRef.current) {
        setSavingQuickReplies(false);
      }
    }
  }, [quickReplyIntegration, savingQuickReplies]);

  const handleCloseFollowUpModal = useCallback(() => {
    followUpGenerationRequestIdRef.current += 1;
    followUpScheduleRequestIdRef.current += 1;
    setGeneratingFollowUp(false);
    setSchedulingFollowUpNextAction(false);
    setFollowUpModalOpen(false);
  }, []);

  const handleCloseComposerRewriteModal = useCallback(() => {
    composerRewriteRequestIdRef.current += 1;
    composerRewriteModalOpenRef.current = false;
    composerRewriteSourceRef.current = '';
    setComposerRewriteModalOpen(false);
    setComposerRewriteSource('');
    setComposerRewriteDraft('');
    setComposerRewriteCustomInstructions('');
    setComposerRewriteTone('grammar');
  }, []);

  const applyTextToComposer = useCallback((nextValue: string) => {
    const nextCursor = nextValue.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [setComposerFocused, setComposerSelection, setMessageDraft]);

  const rewriteComposerText = useCallback(async (
    sourceText: string,
    tone: CommWhatsAppRewriteTone,
    customInstructions: string,
    options: { applyToComposer?: boolean; successMessage?: string } = {},
  ) => {
    if (!sourceText.trim()) {
      toast.error('Digite uma mensagem para reescrever com IA.');
      return;
    }

    const requestId = ++composerRewriteRequestIdRef.current;
    const targetChatId = selectedChat?.id ?? null;
    const sourceSnapshot = sourceText;
    setRewritingComposer(true);

    try {
      const result = await whatsappFollowUpService.rewrite({
        message: sourceText,
        chatId: targetChatId,
        tone,
        customInstructions,
      });
      if (requestId !== composerRewriteRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      const rewrittenText = result.text.trim();
      if (options.applyToComposer) {
        if (messageDraftRef.current !== sourceSnapshot) {
          return;
        }
        applyTextToComposer(rewrittenText);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
      } else {
        if (!composerRewriteModalOpenRef.current || composerRewriteSourceRef.current !== sourceSnapshot) {
          return;
        }
        setComposerRewriteDraft(rewrittenText);
      }
    } catch (error) {
      if (requestId !== composerRewriteRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao reescrever mensagem do composer', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível reescrever a mensagem com IA.');
    } finally {
      if (requestId === composerRewriteRequestIdRef.current) {
        setRewritingComposer(false);
      }
    }
  }, [applyTextToComposer, selectedChat?.id]);

  const handleQuickRewriteComposerText = useCallback((tone: CommWhatsAppRewriteTone) => {
    if (composerRewriteDisabledReason) {
      toast.error(composerRewriteDisabledReason);
      return;
    }

    const successMessage = tone === 'adapt_context'
      ? 'Mensagem adaptada ao contexto.'
      : 'Mensagem corrigida.';
    void rewriteComposerText(messageDraft, tone, '', { applyToComposer: true, successMessage });
  }, [composerRewriteDisabledReason, messageDraft, rewriteComposerText]);

  const handleOpenComposerRewriteModal = useCallback(() => {
    if (composerRewriteDisabledReason) {
      toast.error(composerRewriteDisabledReason);
      return;
    }

    const sourceText = messageDraft;
    composerRewriteRequestIdRef.current += 1;
    composerRewriteModalOpenRef.current = true;
    composerRewriteSourceRef.current = sourceText;
    setComposerRewriteSource(sourceText);
    setComposerRewriteDraft('');
    setComposerRewriteCustomInstructions('');
    setComposerRewriteTone('grammar');
    setComposerRewriteModalOpen(true);
  }, [composerRewriteDisabledReason, messageDraft]);

  const handleRegenerateComposerRewrite = useCallback(() => {
    void rewriteComposerText(composerRewriteSource, composerRewriteTone, composerRewriteCustomInstructions);
  }, [composerRewriteCustomInstructions, composerRewriteSource, composerRewriteTone, rewriteComposerText]);

  const handleApplyComposerRewrite = useCallback(() => {
    if (!composerRewriteDraft.trim()) {
      return;
    }

    applyTextToComposer(composerRewriteDraft);
    handleCloseComposerRewriteModal();
  }, [applyTextToComposer, composerRewriteDraft, handleCloseComposerRewriteModal]);

  const handleGenerateReplySuggestion = useCallback(async (manual = false) => {
    if (!selectedChatId || replySuggestionDisabledReason) {
      if (manual && replySuggestionDisabledReason) {
        toast.error(replySuggestionDisabledReason);
      }
      return;
    }

    const requestId = ++replySuggestionRequestIdRef.current;
    const requestKey = replySuggestionKey;

    setReplySuggestionLoading(true);
    setReplySuggestionError(null);

    try {
      const result = await whatsappFollowUpService.suggestReply({
        chatId: selectedChatId,
        composerDraft: messageDraft,
        mode: messageDraft.trim() ? 'complete_draft' : 'suggest_reply',
      });

      if (requestId !== replySuggestionRequestIdRef.current || requestKey !== replySuggestionKeyRef.current) {
        return;
      }

      setReplySuggestionText(result.text.trim());
    } catch (error) {
      if (requestId !== replySuggestionRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao sugerir resposta com IA', error);
      const message = error instanceof Error ? error.message : 'Não foi possível sugerir uma resposta com IA.';
      setReplySuggestionError(message);
      setReplySuggestionText('');
      if (manual) {
        toast.error(message);
      }
    } finally {
      if (requestId === replySuggestionRequestIdRef.current) {
        setReplySuggestionLoading(false);
      }
    }
  }, [messageDraft, replySuggestionDisabledReason, replySuggestionKey, selectedChatId]);

  const handleApplyReplySuggestion = useCallback(() => {
    const nextValue = replySuggestionText.trim();
    if (!nextValue) {
      return;
    }

    const nextCursor = nextValue.length;
    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);
    setReplySuggestionText('');
    setReplySuggestionError(null);

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [replySuggestionText, setComposerFocused, setComposerSelection, setMessageDraft]);

  const handleDismissReplySuggestion = useCallback(() => {
    setReplySuggestionText('');
    setReplySuggestionError(null);
  }, []);

  const handleGenerateFollowUp = useCallback(async (
    customInstructions: string,
  ) => {
    if (!selectedChat) {
      return;
    }

    if (followUpGenerationDisabledReason) {
      return;
    }

    const requestId = ++followUpGenerationRequestIdRef.current;
    const targetChatId = selectedChat.id;
    console.debug('[FollowUpAI][inbox] request', {
      chatId: selectedChat.id,
      customInstructions,
      selectedChat,
    });
    setGeneratingFollowUp(true);

    try {
      const result = await whatsappFollowUpService.generate(selectedChat.id, {
        customInstructions,
        triggerSource: 'individual',
      });
      console.debug('[FollowUpAI][inbox] response', {
        requestId,
        chatId: selectedChat.id,
        result,
      });
      if (requestId !== followUpGenerationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        console.debug('[FollowUpAI][inbox] response ignored due to stale request', {
          requestId,
          activeRequestId: followUpGenerationRequestIdRef.current,
          targetChatId,
          selectedChatId: selectedChatIdRef.current,
        });
        return;
      }
      setFollowUpDraft(result.text ?? '');
      setFollowUpVariations(result.variations ?? []);
      setFollowUpCustomInstructions(customInstructions);
      setFollowUpAiContextRationale(result.aiContext?.rationale ?? null);
      setFollowUpEmotionalContext(result.aiContext?.emotionalContext ?? null);
      setFollowUpCurrentAction(result.currentAction ?? 'send');
      setFollowUpCurrentActionReason(result.currentActionReason ?? null);
      setFollowUpOpportunityRecommendation(result.opportunityRecommendation ?? 'continue');
      setFollowUpGenerationId(result.generationId ?? null);
      setFollowUpNextAction(result.nextAction ?? null);
    } catch (error) {
      if (requestId !== followUpGenerationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        console.debug('[FollowUpAI][inbox] error ignored due to stale request', {
          requestId,
          activeRequestId: followUpGenerationRequestIdRef.current,
          targetChatId,
          selectedChatId: selectedChatIdRef.current,
          error,
        });
        return;
      }
      console.error('[WhatsAppInbox] erro ao gerar follow-up', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o follow-up com IA.');
    } finally {
      if (requestId === followUpGenerationRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setGeneratingFollowUp(false);
      }
    }
  }, [followUpGenerationDisabledReason, selectedChat]);

  const handleOpenFollowUpModal = useCallback(() => {
    if (followUpGenerationDisabledReason) {
      toast.error(followUpGenerationDisabledReason);
      return;
    }

    setFollowUpModalOpen(true);
  }, [followUpGenerationDisabledReason]);

  const handleCopyChatTranscript = useCallback(async () => {
    if (!selectedChat || copyingTranscript) {
      return;
    }

    setCopyingTranscript(true);

    try {
      const [allMessages, systemSettings] = await Promise.all([
        whatsappMessagesRepository.listAll(selectedChat.id),
        configService.getSystemSettings(),
      ]);

      const timeZone = normalizeSystemTimeZone(systemSettings?.timezone);
      const transcript = allMessages
        .map((message) => buildTranscriptLine(message, selectedChatTranscriptLabel, timeZone))
        .filter((line): line is string => Boolean(line))
        .join('\n');

      if (!transcript) {
        toast.error('Não há histórico útil suficiente para copiar.');
        return;
      }

      await navigator.clipboard.writeText(transcript);
      toast.success('Conversa copiada no formato do follow-up.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao copiar conversa formatada', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível copiar a conversa.');
    } finally {
      setCopyingTranscript(false);
    }
  }, [copyingTranscript, selectedChat, selectedChatTranscriptLabel]);

  const handleRecoverChatHistory = useCallback(async () => {
    if (!selectedChat) {
      return;
    }

    if (historyRecoveryDisabledReason) {
      toast.error(historyRecoveryDisabledReason);
      return;
    }

    const targetChat = selectedChat;
    if (!historyRecoveryLockRef.current.tryAcquire(targetChat.id)) {
      return;
    }

    setSyncingHistoryChatId(targetChat.id);

    try {
      const savedCursor = historyRecoveryCursorByChatIdRef.current.get(targetChat.id);
      let timeTo = savedCursor?.timeTo ?? Math.floor(Date.now() / 1000);
      let offset = savedCursor?.nextOffset ?? 0;
      let pages = 0;
      let imported = 0;
      let hasMore = true;

      while (hasMore && pages < 10) {
        const result = await whatsappConversationsRepository.syncHistory(targetChat.external_chat_id, {
          offset,
          count: 100,
          timeTo,
        });
        imported += result.imported;
        hasMore = result.hasMore && result.nextOffset !== null;
        timeTo = result.timeTo ?? timeTo;
        offset = result.nextOffset ?? offset;
        if (hasMore) {
          historyRecoveryCursorByChatIdRef.current.set(targetChat.id, { nextOffset: offset, timeTo });
        } else {
          historyRecoveryCursorByChatIdRef.current.delete(targetChat.id);
        }
        pages += 1;
      }

      await Promise.all([loadMessages(targetChat, 'initial'), loadChats()]);

      if (imported > 0) {
        toast.success(
          hasMore
            ? `Histórico sincronizado (${imported} mensagens). Ainda há mais mensagens; execute a recuperação novamente para continuar.`
            : `Histórico sincronizado (${imported} mensagens). Use "Carregar mais" para navegar nas mais antigas.`,
        );
      } else {
        toast.info('A Whapi não retornou mensagens adicionais para esta conversa agora.');
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao recuperar historico do chat', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível recuperar mais mensagens deste chat.');
    } finally {
      historyRecoveryLockRef.current.release(targetChat.id);
      setSyncingHistoryChatId((current) => (current === targetChat.id ? null : current));
    }
  }, [historyRecoveryDisabledReason, loadChats, loadMessages, selectedChat]);

  const {
    handleUpdateChatInboxState,
    handleDeactivateAutonomousAttendance,
    handleActivateAutonomousAttendance,
    handleDeleteChat,
  } = useInboxChatMutations({
    assumingControlChatId,
    deletingChatId,
    refs: {
      pendingChatInboxStateRef,
      manualUnreadSkipReadChatIdRef,
      chatReadMutationVersionByChatIdRef,
      archivedSectionOpenRef,
      latestChatsRef,
      selectedChatIdRef,
      chatsSignatureRef,
    },
    setUpdatingChatStateId,
    setAssumingControlChatId,
    setDeletingChatId,
    setArchivedSectionOpen,
    setSelectedChatId,
    setChats,
    upsertChatLocally,
    loadChats,
    refreshArchivedChatsCount,
    buildChatsSignature,
  });

  const handleToggleMediaDrawer = useCallback(() => {
    setAttachmentMenuOpen(false);
    setComposerAiMenuOpen(false);
    setMediaDrawerOpen((current) => !current);
  }, [setAttachmentMenuOpen]);

  const handleOpenChatFile = useCallback(async (message: CommWhatsAppMessage) => {
    const mediaId = message.media_id?.trim() || null;
    try {
      const url = await whatsappMediaRepository.resolveObjectUrl({
        mediaId: message.media_id,
        mediaUrl: message.media_url,
      });
      if (!url) {
        if (mediaId) {
          whatsappMediaRepository.releaseObjectUrl(mediaId);
        }
        toast.error('Arquivo indisponível no momento.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');

      // A nova aba precisa de um tempo para iniciar o carregamento antes que
      // a URL temporária seja liberada do cache local.
      if (mediaId) {
        window.setTimeout(() => whatsappMediaRepository.releaseObjectUrl(mediaId), 60_000);
      }
    } catch (error) {
      if (mediaId) {
        whatsappMediaRepository.releaseObjectUrl(mediaId);
      }
      console.error('[WhatsAppInbox] erro ao abrir arquivo do chat', error);
      toast.error('Não foi possível abrir este arquivo.');
    }
  }, []);

  const handleRegenerateFollowUp = useCallback((options: { customInstructions?: string } = {}) => {
    void handleGenerateFollowUp(options.customInstructions ?? followUpCustomInstructions);
  }, [followUpCustomInstructions, handleGenerateFollowUp]);

  const handleScheduleFollowUpNextAction = useCallback(async () => {
    if (!selectedChat || !followUpNextAction?.suggestedDateTime) {
      return;
    }

    const leadId = selectedChat.lead_id ?? leadPanel?.id ?? null;
    if (!leadId) {
      toast.error('Vincule um lead antes de agendar a próxima ação.');
      return;
    }

    if (!canEditAgenda) {
      toast.error('Você não tem permissão para editar a agenda.');
      return;
    }

    const requestId = ++followUpScheduleRequestIdRef.current;
    const targetChatId = selectedChat.id;
    setSchedulingFollowUpNextAction(true);
    try {
      const description = [
        followUpNextAction.reason,
        followUpNextAction.giveUpRecommendation,
      ].filter(Boolean).join('\n\n');

      const result = await scheduleInboxFollowUp({
        leadId,
        title: followUpNextAction.title || `Follow-up: ${selectedChatDisplayName}`,
        description: description || null,
        dueAt: followUpNextAction.suggestedDateTime,
        priority: followUpNextAction.priority,
      });

      if (requestId !== followUpScheduleRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      await loadChatAgendaSummary(leadId, leadContracts.map((contract) => contract.id));
      if (requestId !== followUpScheduleRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      toast.success(result.inserted === false ? 'Este follow-up já estava agendado.' : 'Próximo follow-up agendado.');
      setFollowUpNextAction(null);
    } catch (error) {
      if (requestId !== followUpScheduleRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao agendar proxima acao do follow-up', error);
      toast.error('Não foi possível agendar a próxima ação.');
    } finally {
      if (requestId === followUpScheduleRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setSchedulingFollowUpNextAction(false);
      }
    }
  }, [canEditAgenda, followUpNextAction, leadContracts, leadPanel?.id, loadChatAgendaSummary, selectedChat, selectedChatDisplayName]);

  const handleBatchSendFollowUp = useCallback(async (results: Array<{
    chatId: string;
    externalChatId: string | null;
    textSegments: string[];
    reminderId: string;
    leadId: string;
    phone: string | null;
    currentAction: 'send' | 'wait';
    generationId: string | null;
    approvedScheduleAction: 'schedule' | 'no_schedule';
    approvedScheduleDate: string | null;
    scheduleReason: string | null;
    opportunityRecommendation: 'continue' | 'pause' | 'mark_lost_recommended';
  }>, options?: {
    onProgress?: (progress: WhatsAppBatchFollowUpSendProgress) => void;
  }) => {
    const chats = latestChatsRef.current;
    const sentIds: string[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];
    const approvedSchedules: Array<{ leadId: string; generationId: string | null; sourceReminderId: string; dueAt: string; reason: string | null }> = [];
    const statusUpdates = new Map<string, { chatId: string; leadId: string; status: BatchFollowUpFinalStatus; reminderId: string }>();
    const resolvedReminderIds = new Set<string>();
    let waitWithoutScheduleCount = 0;
    const legacyAuditEntries: Array<{
      lead_id: string;
      chat_id: string;
      text_content: string;
      next_action_title: string | null;
      next_action_due_at: string | null;
    }> = [];

    for (const [index, result] of results.entries()) {
      const totalSegments = result.textSegments.length;
      const chat = chats.find((c) => c.id === result.chatId)
        ?? (result.externalChatId ? chats.find((c) => c.external_chat_id === result.externalChatId) : null)
        ?? chats.find((c) => c.lead_id === result.leadId);
      const finalStatus = resolveBatchFollowUpFinalStatus({
        approvedScheduleAction: result.approvedScheduleAction,
        approvedScheduleDate: result.approvedScheduleDate,
        opportunityRecommendation: result.opportunityRecommendation,
        currentLeadStatus: chat?.lead_status,
      });

      if (result.currentAction === 'wait') {
        if (result.approvedScheduleAction === 'schedule' && result.approvedScheduleDate) {
          approvedSchedules.push({
            leadId: result.leadId,
            generationId: result.generationId,
            sourceReminderId: result.reminderId,
            dueAt: result.approvedScheduleDate,
            reason: result.scheduleReason,
          });
          options?.onProgress?.({
            reminderId: result.reminderId,
            status: 'sent',
            sentSegments: 0,
            totalSegments: 0,
          });
        } else {
          waitWithoutScheduleCount += 1;
          if (finalStatus) {
            statusUpdates.set(result.leadId, {
              chatId: result.chatId,
              leadId: result.leadId,
              status: finalStatus,
              reminderId: result.reminderId,
            });
          } else {
            resolvedReminderIds.add(result.reminderId);
          }
          options?.onProgress?.({
            reminderId: result.reminderId,
            status: 'sent',
            sentSegments: 0,
            totalSegments: 0,
          });
        }
        continue;
      }
      options?.onProgress?.({
        reminderId: result.reminderId,
        status: 'sending',
        sentSegments: 0,
        totalSegments,
      });

      const phoneChatId = normalizeWhapiDirectChatId(result.phone);
      const externalChatId = normalizeWhapiDirectChatId(chat?.external_chat_id)
        || normalizeWhapiDirectChatId(result.externalChatId)
        || phoneChatId;

      if (chat?.identity_conflict) {
        const errorMessage = 'Identidade WhatsApp pendente de revisão manual.';
        failures.push(`Lead ${result.leadId}: ${errorMessage}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage,
        });
        continue;
      }

      if (!externalChatId) {
        const errorMessage = 'Sem conversa externa ou telefone valido.';
        failures.push(`Lead ${result.leadId}: ${errorMessage}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage,
        });
        continue;
      }

      if (result.textSegments.length === 0) {
        const errorMessage = 'Mensagem vazia.';
        failures.push(`Lead ${result.leadId}: ${errorMessage}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage,
        });
        continue;
      }

      try {
        for (const [segmentIndex, segment] of result.textSegments.entries()) {
          await whatsappMessagesRepository.sendText(externalChatId, segment, {
            clientRequestId: `follow-up:${result.reminderId}:${segmentIndex}`,
          });
          options?.onProgress?.({
            reminderId: result.reminderId,
            status: 'sending',
            sentSegments: segmentIndex + 1,
            totalSegments,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível enviar o follow-up.';
        failures.push(`Lead ${result.leadId}: ${message}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage: message,
        });
        if (index < results.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        continue;
      }

      sentIds.push(result.reminderId);
      if (!finalStatus) {
        if (result.approvedScheduleAction !== 'schedule' || !result.approvedScheduleDate) {
          resolvedReminderIds.add(result.reminderId);
        }
      } else {
        statusUpdates.set(result.leadId, {
          chatId: result.chatId,
          leadId: result.leadId,
          status: finalStatus,
          reminderId: result.reminderId,
        });
      }
      options?.onProgress?.({
        reminderId: result.reminderId,
        status: 'sent',
        sentSegments: totalSegments,
        totalSegments,
      });
      if (result.approvedScheduleAction === 'schedule' && result.approvedScheduleDate) {
        approvedSchedules.push({
          leadId: result.leadId,
          generationId: result.generationId,
          sourceReminderId: result.reminderId,
          dueAt: result.approvedScheduleDate,
          reason: result.scheduleReason,
        });
      }
      if (!result.generationId) {
        legacyAuditEntries.push({
          lead_id: result.leadId,
          chat_id: result.chatId,
          text_content: result.textSegments.join('\n\n'),
          next_action_title: null,
          next_action_due_at: result.approvedScheduleDate,
        });
      }
      if (index < results.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (sentIds.length === 0 && approvedSchedules.length === 0 && waitWithoutScheduleCount === 0) {
      throw new Error(failures[0] || 'Nenhum follow-up selecionado possui mensagem para enviar ou agenda aprovada.');
    }

    let scheduledCount = 0;
    for (const schedule of approvedSchedules) {
      const title = 'Follow-up';
      const description = schedule.reason || 'Lembrete aprovado após revisão do follow-up gerado por IA.';
      try {
        const scheduledReminder = await scheduleInboxFollowUp({
          leadId: schedule.leadId,
          title,
          description,
          dueAt: schedule.dueAt,
          priority: 'normal',
          generationId: schedule.generationId,
          origin: 'follow_up_v2_batch',
        });
        scheduledCount += 1;
        resolvedReminderIds.add(schedule.sourceReminderId);
        if (schedule.generationId) {
          try {
            await approveInboxFollowUpSchedule({
              generationId: schedule.generationId,
              dueAt: schedule.dueAt,
              reminderId: scheduledReminder.reminderId,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'erro desconhecido';
            warnings.push(`Lembrete criado, mas a proveniência não foi atualizada: ${message}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        warnings.push(`Erro ao agendar proximo follow-up para lead ${schedule.leadId}: ${message}`);
      }
    }

    for (const statusUpdate of statusUpdates.values()) {
      try {
        await whatsappContactsRepository.updateLeadStatus(statusUpdate.chatId, statusUpdate.status);
        if (statusUpdate.status === 'Perdido') {
          await clearInboxLeadAgenda(statusUpdate.leadId);
        }
        resolvedReminderIds.add(statusUpdate.reminderId);
        options?.onProgress?.({
          reminderId: statusUpdate.reminderId,
          status: 'sent',
          sentSegments: 0,
          totalSegments: 0,
          finalStatus: statusUpdate.status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        warnings.push(`Follow-up concluído, mas não foi possível mover o lead ${statusUpdate.leadId} para ${statusUpdate.status}: ${message}`);
      }
    }

    try {
      await markInboxRemindersRead([...resolvedReminderIds]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      warnings.push(`Erro ao marcar lembretes como lidos: ${message}`);
    }

    const sentAtActual = new Date().toISOString();
    const generatedAuditUpdates = results
      .filter((result) => sentIds.includes(result.reminderId) && result.generationId)
      .map((result) => ({ id: result.generationId as string, sentText: result.textSegments.join('\n\n') }));
    if (generatedAuditUpdates.length > 0) {
      try {
        await updateInboxFollowUpSentAudits(generatedAuditUpdates, sentAtActual);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        warnings.push(`Follow-ups enviados, mas a auditoria V2 não foi atualizada: ${message}`);
      }
    }

    if (legacyAuditEntries.length > 0) {
      try {
        await insertInboxLegacyFollowUpAudits(legacyAuditEntries);
      } catch (auditError) {
        console.error('[WhatsAppInbox] erro ao registrar auditoria', auditError);
        warnings.push('Follow-ups enviados, mas não foi possível registrar a auditoria.');
      }
    }

    void Promise.all([loadChatsRef.current(), loadMessagesRef.current(null, 'send')]).catch((refreshError) => {
      console.error('[WhatsAppInbox] erro ao atualizar conversas apos envio batch', refreshError);
      toast.warning('Follow-ups enviados, mas houve um erro ao atualizar a lista. Atualize a página se necessário.');
    });

    const msg = `${sentIds.length} follow-up(s) enviado(s)${scheduledCount > 0 ? ` e ${scheduledCount} novo(s) agendado(s)` : ''}.`;
    if (failures.length > 0) {
      toast.warning(`${msg} ${failures.length} falharam.`);
    } else if (warnings.length > 0) {
      toast.warning(msg);
    } else {
      toast.success(msg);
    }

    return {
      sentCount: sentIds.length,
      scheduledCount,
      failedCount: failures.length,
      errorMessage: [...failures, ...warnings].slice(0, 3).join('\n') || undefined,
    };
  }, []);

  const handleSendFollowUpDraft = useCallback(async () => {
    if (!selectedChat) {
      return;
    }

    const textSegments = splitWhatsAppMessageSegments(followUpDraft);
    if (textSegments.length === 0) {
      return;
    }

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    try {
      const sentText = textSegments.join('\n\n');
      const generationId = followUpGenerationId;
      sendTextSegments(selectedChat, textSegments, null, generationId
        ? () => updateInboxFollowUpSentAudit(generationId, sentText)
        : undefined);
      resetFollowUpComposer();
      handleCloseFollowUpModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar follow-up', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o follow-up.');
    }
  }, [followUpDraft, followUpGenerationId, handleCloseFollowUpModal, resetFollowUpComposer, selectedChat, sendDisabledReason, sendTextSegments]);

  const handleComposerSubmit = () => {
    if (generatingFollowUp) return;

    if (voiceRecordingState === 'recording') {
      handleStopVoiceRecording();
      return;
    }

    if (hasSendPayload) {
      void handleSendMessage();
      return;
    }

    void handleStartVoiceRecording();
  };

  useEffect(() => {
    setMediaDrawerOpen(false);
  }, [selectedChatId]);

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (quickReplyMenuOpen && quickReplyMenuHasResults) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setQuickReplyActiveIndex((current) => (current + 1) % filteredQuickReplyOptions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setQuickReplyActiveIndex((current) => (current === 0 ? filteredQuickReplyOptions.length - 1 : current - 1));
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        const selectedQuickReply = filteredQuickReplyOptions[quickReplyActiveIndex];
        if (selectedQuickReply) {
          event.preventDefault();
          handleInsertQuickReply(selectedQuickReply);
          return;
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedQuickReplyKey(activeQuickReplyKey);
        setQuickReplyActiveIndex(0);
        return;
      }
    }

    if (event.key === 'Tab' && replySuggestionText.trim() && !replySuggestionLoading) {
      event.preventDefault();
      handleApplyReplySuggestion();
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    if (!hasSendPayload || voiceAttachment || voiceRecordingState === 'recording') {
      return;
    }

    event.preventDefault();
    void handleSendMessage();
  };

  const selectionContextValue = useMemo<WhatsAppInboxSelectionContextValue>(() => ({
    selectedChatId,
    selectedChat,
    archivedSectionOpen,
  }), [archivedSectionOpen, selectedChat, selectedChatId]);

  const messageLoadErrorNotice = messageLoadError ? (
    <Alert
      tone="danger"
      title="Não foi possível carregar as mensagens"
      action={(
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleRetryMessageLoad()}
          loading={messageLoadRetrying}
        >
          Tentar novamente
        </Button>
      )}
    >
      O histórico desta conversa não foi apagado. Tente novamente para atualizar a tela.
    </Alert>
  ) : null;

  return (
    <WhatsAppInboxSelectionProvider value={selectionContextValue}>
    <div className="comm-terracotta whatsapp-inbox-shell panel-page-shell h-full overflow-hidden p-0">
      <div className="flex h-full min-h-0 flex-col gap-0">
        {operationalBanner && (
          <section className={`whatsapp-inbox-status-banner whatsapp-inbox-status-banner-${operationalBanner.tone} m-4 mb-0 flex items-start gap-3 rounded-[var(--kds-radius-md)] border px-4 py-3.5`}>
            <operationalBanner.icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="whatsapp-inbox-heading text-sm font-semibold">{operationalBanner.title}</p>
              <p className="text-sm leading-6 opacity-90">{operationalBanner.description}</p>
            </div>
          </section>
        )}

        <section className="grid h-full min-h-0 flex-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <WhatsAppInboxSidebar
          archivedSectionOpen={archivedSectionOpen}
          archivedChatsCount={archivedChatsCountValue}
          archivedChatsLoading={archivedChatsLoading}
          archivedChatsLoadingMore={archivedChatsLoadingMore}
          archivedChatsHasMore={archivedChatsHasMore}
          onSwitchArchivedSection={handleSwitchArchivedSection}
          onLoadMoreArchivedChats={() => void handleLoadMoreArchivedChats()}
          onOpenAgenda={() => setWhatsAppAgendaOpen(true)}
          onOpenScheduledMessages={() => setAllScheduledMessagesPanelOpen(true)}
          onOpenDashboard={() => setWhatsAppDashboardOpen(true)}
          onStartChat={() => setStartChatModalOpen(true)}
          canViewAgenda={canViewAgenda}
          allScheduledMessagesPanelOpen={allScheduledMessagesPanelOpen}
          searchDraft={searchDraft}
          onSearchDraftChange={setSearchDraft}
          hasActiveChatFilters={hasActiveChatFilters}
          activeChatFiltersCount={activeChatFiltersCount}
          advancedFiltersOpen={advancedFiltersOpen}
          onToggleAdvancedFilters={() => setAdvancedFiltersOpen((current) => !current)}
          onClearFilters={() => {
            setChatActivityFilter('all');
            setLeadStatusFilters([]);
            setAdvancedFiltersOpen(false);
          }}
          chatRefreshError={chatRefreshError}
          chatLoadError={chatLoadError}
          loading={loading}
          onRetryChatLoad={handleRetryChatLoad}
          sidebarChats={sidebarChats}
          filteredMessageSearchResults={filteredMessageSearchResults}
          search={search}
          searchingChats={searchingChats}
          searchingMessages={searchingMessages}
          chatSearchError={chatSearchError}
          messageSearchError={messageSearchError}
          onRetrySearch={retrySearch}
          selectedChatId={selectedChatId}
          connectedUserName={channelState?.connected_user_name ?? null}
          composerDraftsByChatId={composerDraftsByChatId}
          favoritedLeadIds={favoritedLeadIds}
          onSelectChat={(chat) => {
            setChatMenuPointerAnchor(null);
            setOpenChatMenuChatId(null);
            if (search) {
              upsertChatLocally(chat);
            }
            setSelectedChatId(chat.id);
          }}
          onSelectMessageSearchResult={handleSelectMessageSearchResult}
          openChatMenuChatId={openChatMenuChatId}
          updatingChatStateId={updatingChatStateId}
          onToggleChatMenu={handleToggleChatMenu}
          onOpenChatMenuFromContext={handleOpenChatMenuFromContext}
          chatMenuTriggerRefs={chatMenuTriggerRefs}
        />

        <div
          className={`whatsapp-inbox-panel whatsapp-inbox-thread relative h-full min-h-0 flex-col border shadow-sm lg:flex lg:rounded-l-none lg:border-l-0 ${selectedChat ? 'flex' : 'hidden lg:flex'}`}
          onDragEnter={handleThreadDragEnter}
          onDragOver={handleThreadDragOver}
          onDragLeave={handleThreadDragLeave}
          onDrop={handleThreadDrop}
        >
          {isDraggingFilesOverThread ? (
            <div className="pointer-events-none absolute inset-2 z-[3] flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]/90">
              <p className="whatsapp-inbox-heading text-sm font-semibold text-[var(--brand-primary)]">Solte para anexar à conversa</p>
            </div>
          ) : null}
          {!selectedChat ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <MessageCircle className="h-10 w-10 whatsapp-inbox-empty-icon" />
                <div className="space-y-1">
                  <p className="whatsapp-inbox-heading text-base font-semibold text-[var(--text-primary)]">Selecione uma conversa</p>
                  <p className="text-sm text-[var(--text-secondary)]">Abra um chat na coluna da esquerda para acompanhar o histórico e responder.</p>
                </div>
              </div>
          ) : (
            <>
              <WhatsAppThreadHeader
                selectedChat={selectedChat}
                selectedChatForPresentation={selectedChatForPresentation}
                selectedChatDisplayName={selectedChatDisplayName}
                leadPanel={leadPanel}
                leadStatuses={leadStatuses}
                favoritedLeadIds={favoritedLeadIds}
                selectedChatLeadMutationLoading={selectedChatLeadMutationLoading}
                selectedChatWasAutoLinked={selectedChatWasAutoLinked}
                isSelectedChatWaitingForQuote={isSelectedChatWaitingForQuote}
                assumingControl={assumingControlChatId === selectedChat.id}
                chatFilesOpen={chatFilesOpen}
                chatMessageSearchOpen={chatMessageSearchOpen}
                scheduledMessagesPanelOpen={scheduledMessagesPanelOpen}
                copyingTranscript={copyingTranscript}
                syncingHistory={syncingHistoryChatId === selectedChat.id}
                historyRecoveryDisabledReason={historyRecoveryDisabledReason}
                followUpGenerationDisabledReason={followUpGenerationDisabledReason}
                generatingFollowUp={generatingFollowUp}
                threadActionsMenuOpen={threadActionsMenuOpen}
                threadActionsMenuTriggerRef={threadActionsMenuTriggerRef}
                chatAgendaSummary={chatAgendaSummary}
                nextChatReminderSummary={nextChatReminderSummary}
                chatAgendaSummaryError={chatAgendaSummaryError}
                onBack={() => {
                  suppressAutoChatSelectionRef.current = true;
                  selectedChatIdRef.current = null;
                  chatIdFromUrlRef.current = null;
                  setSelectedChatId(null);
                }}
                onLeadStatusChange={handleLeadStatusChange}
                onSaveContact={(name) => {
                  setSaveContactName(name);
                  setSaveContactDialogOpen(true);
                }}
                onToggleAutonomousAttendance={() => {
                  if (isSelectedChatWaitingForQuote) {
                    return;
                  }
                  if (selectedChat.autonomous_attendance_status === 'active') {
                    void handleDeactivateAutonomousAttendance(selectedChat);
                  } else {
                    void handleActivateAutonomousAttendance(selectedChat);
                  }
                }}
                onOpenChatFiles={() => setChatFilesOpen(true)}
                onToggleChatMessageSearch={handleToggleChatMessageSearch}
                onOpenScheduledMessages={() => setScheduledMessagesPanelOpen(true)}
                onCopyTranscript={() => void handleCopyChatTranscript()}
                onRecoverHistory={() => void handleRecoverChatHistory()}
                onOpenFollowUp={handleOpenFollowUpModal}
                onOpenLeadDrawer={handleOpenLeadDrawer}
                onToggleThreadActionsMenu={() => setThreadActionsMenuOpen((current) => !current)}
              />

              {chatMessageSearchOpen ? (
                <WhatsAppChatMessageSearch
                  inputRef={chatMessageSearchInputRef}
                  draft={chatMessageSearchDraft}
                  query={chatMessageSearch}
                  searching={searchingChatMessages}
                  error={chatMessageSearchError}
                  results={chatMessageSearchResults}
                  onDraftChange={setChatMessageSearchDraft}
                  onClose={() => {
                    setChatMessageSearchDraft('');
                    setChatMessageSearchOpen(false);
                  }}
                  onRetry={retryChatMessageSearch}
                  onSelect={handleSelectChatMessageSearchResult}
                />
              ) : null}

              <WhatsAppMessageThread
                messagesContainerRef={messagesContainerRef}
                messageBubbleRefs={messageBubbleRefs}
                reactionAnchorRefs={reactionAnchorRefs}
                reactionTriggerRefs={reactionTriggerRefs}
                messageActionTriggerRefs={messageActionTriggerRefs}
                handleMessagesScroll={handleMessagesScroll}
                messageLoadErrorNotice={messageLoadErrorNotice}
                hasOlderMessages={hasOlderMessages}
                loadingOlderMessages={loadingOlderMessages}
                handleLoadOlderMessages={handleLoadOlderMessages}
                loadingMessages={loadingMessages}
                messageLoadError={messageLoadError}
                threadReconcileChatId={threadReconcileChatId}
                selectedChat={selectedChat}
                messages={messages}
                messageTimelineItems={messageTimelineItems}
                highlightedMessageId={highlightedMessageId}
                mediaUploadProgress={mediaUploadProgress}
                retryingMessageId={retryingMessageId}
                localOutgoingRetryPayloadRef={localOutgoingRetryPayloadRef}
                setLightboxMessageId={setLightboxMessageId}
                handleCancelMediaUpload={handleCancelMediaUpload}
                openMessageActionMenuMessageId={openMessageActionMenuMessageId}
                handleToggleMessageActionMenu={handleToggleMessageActionMenu}
                starringMessageIds={starringMessageIds}
                handleToggleStarMessage={(message) => void handleToggleStarMessage(message)}
                setRetryPendingMessage={setRetryPendingMessage}
                handleToggleReactionPicker={handleToggleReactionPicker}
                handleOpenMessageActionMenuFromContext={handleOpenMessageActionMenuFromContext}
                handleOpenQuotedMessage={handleOpenQuotedMessage}
                handleTranscribeMessage={handleTranscribeMessage}
                handleSelectInteractiveReply={handleSelectInteractiveReply}
                handleOpenSharedContactChat={handleOpenSharedContactChat}
                handleSaveSharedContact={handleSaveSharedContact}
                sharedContactActionKey={sharedContactActionKey}
                transcribingMessageId={transcribingMessageId}
              />
              {removedAttachmentForUndo ? (
                <div className="mx-2.5 mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)] sm:mx-3">
                  <span className="truncate">Anexo removido: {removedAttachmentForUndo.file.name}</span>
                  <button
                    type="button"
                    onClick={handleUndoRemoveAttachment}
                    className="shrink-0 text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    Desfazer
                  </button>
                </div>
              ) : null}

              <WhatsAppComposer
                fileInputRef={fileInputRef}
                attachmentInputAccept={attachmentInputAccept}
                handleAttachmentInputChange={handleAttachmentInputChange}
                composerFocused={composerFocused}
                isVoiceComposerMode={isVoiceComposerMode}
                isComposerExpanded={isComposerExpanded}
                voiceAttachment={voiceAttachment}
                voiceRecordingState={voiceRecordingState}
                voiceRecordingSeconds={voiceRecordingSeconds}
                voicePreviewPlaying={voicePreviewPlaying}
                voicePreviewDuration={voicePreviewDuration}
                voicePreviewCurrentTime={voicePreviewCurrentTime}
                voicePreviewAudioRef={voicePreviewAudioRef}
                sendDisabledReason={sendDisabledReason}
                handleClearAttachment={handleClearAttachment}
                handleToggleVoicePreviewPlayback={handleToggleVoicePreviewPlayback}
                handleStartVoiceRecording={handleStartVoiceRecording}
                handleSendCurrentVoiceRecording={handleSendCurrentVoiceRecording}
                handleCancelVoiceRecording={handleCancelVoiceRecording}
                handleStopVoiceRecording={handleStopVoiceRecording}
                replyTargetMessage={replyTargetMessage}
                setReplyTargetMessage={setReplyTargetMessage}
                documentComposerAttachments={documentComposerAttachments}
                selectedDocumentComposerAttachment={selectedDocumentComposerAttachment}
                sending={sending}
                mediaUploadProgress={mediaUploadProgress}
                handleToggleMediaDrawer={handleToggleMediaDrawer}
                selectedChat={selectedChat}
                mediaDrawerOpen={mediaDrawerOpen}
                setMediaDrawerOpen={setMediaDrawerOpen}
                composerTextareaRef={composerTextareaRef}
                messageDraft={messageDraft}
                handleComposerChange={handleComposerChange}
                handleComposerPaste={handleComposerPaste}
                handleComposerKeyDown={handleComposerKeyDown}
                syncComposerSelection={syncComposerSelection}
                setComposerFocused={setComposerFocused}
                generatingFollowUp={generatingFollowUp}
                handleComposerSubmit={handleComposerSubmit}
                hasSendPayload={hasSendPayload}
                setSelectedDocumentComposerAttachmentId={setSelectedDocumentComposerAttachmentId}
                handleAttachmentMenuAction={handleAttachmentMenuAction}
                visualComposerAttachments={visualComposerAttachments}
                selectedMediaComposerAttachment={selectedMediaComposerAttachment}
                setSelectedMediaComposerAttachmentId={setSelectedMediaComposerAttachmentId}
                attachmentMenuOpen={attachmentMenuOpen}
                setAttachmentMenuOpen={setAttachmentMenuOpen}
                mediaDrawerTriggerRef={mediaDrawerTriggerRef}
                composerAiMenuOpen={composerAiMenuOpen}
                setComposerAiMenuOpen={setComposerAiMenuOpen}
                composerRewriteModalOpen={composerRewriteModalOpen}
                composerRewriteDisabledReason={composerRewriteDisabledReason}
                replySuggestionDisabledReason={replySuggestionDisabledReason}
                rewritingComposer={rewritingComposer}
                replySuggestionLoading={replySuggestionLoading}
                replySuggestionText={replySuggestionText}
                replySuggestionError={replySuggestionError}
                handleOpenComposerRewriteModal={handleOpenComposerRewriteModal}
                handleQuickRewriteComposerText={handleQuickRewriteComposerText}
                handleApplyReplySuggestion={handleApplyReplySuggestion}
                handleDismissReplySuggestion={handleDismissReplySuggestion}
                handleGenerateReplySuggestion={handleGenerateReplySuggestion}
                handleApplyComposerTextFormat={handleApplyComposerTextFormat}
                quickReplyMenuOpen={quickReplyMenuOpen}
                quickReplyMenuHasResults={quickReplyMenuHasResults}
                filteredQuickReplyOptions={filteredQuickReplyOptions}
                quickReplyActiveIndex={quickReplyActiveIndex}
                handleOpenQuickReplySettings={handleOpenQuickReplySettings}
                handleInsertQuickReply={handleInsertQuickReply}
                quickReplyEmptyStateMessage={quickReplyEmptyStateMessage}
                quickRepliesLoadError={quickRepliesLoadError}
                setQuickRepliesLoadRetryToken={setQuickRepliesLoadRetryToken}
              />
            </>
          )}
        </div>
        </section>

        {lightboxMessageId && mediaViewerMessages.length > 0 ? (
          <WhatsAppMediaViewer
            messages={mediaViewerMessages}
            selectedMessageId={lightboxMessageId}
            contactName={selectedChatDisplayName}
            onSelect={setLightboxMessageId}
            onClose={() => setLightboxMessageId(null)}
          />
        ) : null}

        <Suspense fallback={<InboxLazyLoadingFallback />}>
          {quickRepliesModalOpen ? (
            <WhatsAppQuickRepliesModal
              isOpen
              quickReplies={quickReplies}
              saving={savingQuickReplies}
              onClose={handleCloseQuickReplySettings}
              onSave={handleSaveQuickReplies}
            />
          ) : null}

          {editingMessage ? (
            <WhatsAppEditMessageModal
              isOpen
              loading={savingMessageEdit}
              value={editingMessageDraft}
              title={editingMessage.message_type.trim().toLowerCase() === 'text' ? 'Editar mensagem' : 'Editar legenda da mensagem'}
              description={editingMessage.message_type.trim().toLowerCase() === 'text'
                ? 'Atualize o texto da mensagem enviada. O WhatsApp so permite editar mensagens proprias dentro da janela suportada.'
                : 'Atualize o texto exibido nesta midia. O arquivo continua o mesmo; apenas a legenda sera alterada.'}
              onClose={handleCloseEditMessageModal}
              onChange={setEditingMessageDraft}
              onSubmit={() => void handleSaveEditedMessage()}
            />
          ) : null}

          {messageDetailsMessage ? (
            <WhatsAppMessageDetailsModal
              message={messageDetailsMessage}
              onClose={() => setMessageDetailsMessageId(null)}
            />
          ) : null}

        <WhatsAppInboxDialogs
          forwardingMessage={forwardingMessage}
          forwardSearch={forwardSearch}
          forwardTargetChats={forwardTargetChats}
          forwardingTargetIds={forwardingTargetIds}
          forwardingInProgress={forwardingInProgress}
          connectedUserName={channelState?.connected_user_name ?? null}
          favoritedLeadIds={favoritedLeadIds}
          onCloseForwardMessage={handleCloseForwardMessageModal}
          onForwardSearchChange={setForwardSearch}
          onToggleForwardTarget={handleToggleForwardTarget}
          onForwardToSelectedChats={() => void handleForwardToSelectedChats()}
          chatPendingDeletion={chatPendingDeletion}
          deletingChatId={deletingChatId}
          onCloseChatDeletion={() => setChatPendingDeletion(null)}
          onDeleteChat={handleDeleteChat}
          messagePendingDeletion={messagePendingDeletion}
          deletingMessageId={deletingMessageId}
          onCloseMessageDeletion={() => setMessagePendingDeletion(null)}
          onDeleteMessage={handleDeleteMessage}
          retryPendingMessage={retryPendingMessage}
          retryingMessageId={retryingMessageId}
          onCloseRetryMessage={() => setRetryPendingMessage(null)}
          onRetryMediaMessage={handleRetryMediaMessage}
          saveContactDialogOpen={saveContactDialogOpen}
          savedContactNameExists={Boolean(selectedChatForPresentation?.saved_contact_name)}
          saveContactName={saveContactName}
          savingContact={savingContact}
          onCloseSaveContact={() => setSaveContactDialogOpen(false)}
          onSaveContactNameChange={setSaveContactName}
          onSaveContact={() => void handleSaveContactToPhonebook()}
        />

        {composerRewriteModalOpen ? (
          <WhatsAppComposerRewriteModal
            isOpen
            generating={rewritingComposer}
            sourceValue={composerRewriteSource}
            value={composerRewriteDraft}
            tone={composerRewriteTone}
            customInstructions={composerRewriteCustomInstructions}
            onClose={handleCloseComposerRewriteModal}
            onChangeSourceValue={setComposerRewriteSource}
            onChangeValue={setComposerRewriteDraft}
            onChangeTone={setComposerRewriteTone}
            onChangeCustomInstructions={setComposerRewriteCustomInstructions}
            onGenerate={handleRegenerateComposerRewrite}
            onApply={handleApplyComposerRewrite}
          />
        ) : null}

        {whatsAppAgendaOpen ? (
          <WhatsAppAgendaModal
            isOpen
            onClose={() => setWhatsAppAgendaOpen(false)}
            currentLead={leadPanel}
            currentLeadContracts={leadContracts}
            canEdit={canEditAgenda}
            onGenerateFollowUp={selectedChat ? handleOpenFollowUpModal : undefined}
            onOpenLeadChat={handleOpenAgendaLeadChat}
            onSendBatchFollowUps={handleBatchSendFollowUp}
          />
        ) : null}

        {whatsAppDashboardOpen ? (
          <WhatsAppDashboardModal
            isOpen
            onClose={() => setWhatsAppDashboardOpen(false)}
          />
        ) : null}

        {mediaDrawerOpen ? (
          <WhatsAppMediaDrawer
            isOpen
            position={mediaDrawerPosition}
            triggerRef={mediaDrawerTriggerRef}
            canSendMedia={!mediaDrawerSendDisabledReason}
            mediaDisabledReason={mediaDrawerSendDisabledReason}
            sendingMedia={sendingDrawerMedia}
            onClose={() => setMediaDrawerOpen(false)}
            onSelectEmoji={handleInsertEmoji}
            onSendMedia={handleSendDrawerMedia}
          />
        ) : null}

        {chatFilesOpen ? (
          <WhatsAppChatFilesDrawer
            chatId={selectedChat?.id ?? null}
            chatDisplayName={selectedChatDisplayName}
            isOpen
            onClose={() => setChatFilesOpen(false)}
            onOpenMedia={handleOpenChatFile}
          />
        ) : null}

        {followUpModalOpen ? (
          <WhatsAppFollowUpModal
            isOpen
            generating={generatingFollowUp}
            submitting={sending}
            chatId={selectedChat?.id ?? null}
            leadName={selectedChatDisplayName}
            leadFavorito={leadPanel?.favorito}
            value={followUpDraft}
            customInstructions={followUpCustomInstructions}
            variations={followUpVariations}
            aiContextRationale={followUpAiContextRationale}
            emotionalContext={followUpEmotionalContext}
            currentAction={followUpCurrentAction}
            currentActionReason={followUpCurrentActionReason}
            opportunityRecommendation={followUpOpportunityRecommendation}
            nextAction={followUpNextAction}
            schedulingNextAction={schedulingFollowUpNextAction}
            onClose={handleCloseFollowUpModal}
            onChangeValue={setFollowUpDraft}
            onChangeCustomInstructions={setFollowUpCustomInstructions}
            onGenerate={handleRegenerateFollowUp}
            onScheduleNextAction={handleScheduleFollowUpNextAction}
            onSend={handleSendFollowUpDraft}
          />
        ) : null}

        {statusReminderLead ? (
          <ReminderSchedulerModal
            lead={statusReminderLead}
            onClose={() => {
              setStatusReminderLead(null);
              setStatusReminderPromptMessage(null);
            }}
            onScheduled={async () => {
              if (selectedChat && leadPanel?.id) {
                await Promise.all([
                  loadLeadPanel(selectedChat),
                  loadChatAgendaSummary(leadPanel.id, leadContracts.map((contract) => contract.id)),
                ]);
              }

              setStatusReminderLead(null);
              setStatusReminderPromptMessage(null);
            }}
            promptMessage={statusReminderPromptMessage ?? 'Deseja agendar o primeiro lembrete após a proposta enviada?'}
            defaultType="Follow-up"
          />
        ) : null}

        {leadDrawerOpen && !selectedChat?.is_group ? (
          <WhatsAppLeadDrawer
            isOpen
            onClose={handleCloseLeadDrawer}
            chatId={selectedChat?.id ?? null}
            chatDisplayName={selectedChatDisplayName}
            linkedLead={leadPanel}
            leadPanelError={leadPanelError}
            autoLinked={selectedChatWasAutoLinked}
            loading={leadPanelLoading}
            contracts={leadContracts}
            contractsLoading={leadContractsLoading}
            contractsError={leadContractsError}
            statusOptions={leadStatuses}
            responsavelOptions={responsavelOptions}
            leadMutationLoading={selectedChatLeadMutationLoading}
            onStatusChange={handleLeadStatusChange}
            onResponsavelChange={handleLeadResponsavelChange}
            onRefreshContracts={handleRefreshLeadContracts}
            onViewLead={leadPanel ? handleViewLeadInCrm : undefined}
            onUnlinkLead={selectedChat?.lead_id ? handleUnlinkLead : undefined}
            searchQuery={leadSearchQuery}
            onSearchQueryChange={setLeadSearchQuery}
            searchResults={leadSearchResults}
            searchError={leadSearchError}
            suggestedLead={suggestedLead}
            searchLoading={leadSearchLoading}
            onRetryLeadPanel={() => void loadLeadPanel(selectedChat)}
            onRetrySearch={() => void refreshDrawerSearch(leadSearchQuery, selectedChat?.phone_number)}
            onCreateLead={selectedChat && !selectedChat.is_group && !selectedChat.lead_id ? handleOpenCreateLeadFromChat : undefined}
            onLinkLead={(leadId) => void handleLinkLead(leadId)}
            linkLoadingLeadId={linkLoadingLeadId}
            canViewAgenda={canViewAgenda}
            canEditAgenda={canEditAgenda}
          />
        ) : null}

        {createLeadDraft ? (
          <LeadForm
            lead={null}
            initialValues={createLeadDraft.initialValues}
            onClose={handleCloseCreateLeadFromChat}
            onSave={(lead) => void handleCreateLeadFromChatSaved(lead)}
          />
        ) : null}

        {startChatModalOpen ? (
          <WhatsAppStartChatModal
            isOpen
            onClose={() => setStartChatModalOpen(false)}
            query={startChatQuery}
            onQueryChange={setStartChatQuery}
            contacts={savedContactsForPresentation}
            contactsTotal={savedContactsTotal}
            contactsHasMore={savedContactsHasMore}
            contactsLoading={savedContactsLoading}
            contactsLoadingMore={savedContactsLoadingMore}
            onLoadMoreContacts={handleLoadMoreSavedContacts}
            loadError={startChatSourcesError}
            onRetry={handleRetryStartChatSources}
            crmLeads={crmStartResults}
            crmLoading={crmStartLoading}
            statusOptions={leadStatuses}
            onStartFromSavedContact={(contact) => void handleStartChatFromSavedContact(contact)}
            onStartFromLead={(lead) => void handleStartChatFromLead(lead)}
            manualPhone={manualStartPhone}
            onManualPhoneChange={setManualStartPhone}
            onStartFromManual={() => void handleStartChatFromManual()}
            startingKey={startingChatKey}
          />
        ) : null}

        {selectedChat && scheduleMessageModalOpen ? (
          <WhatsAppScheduleMessageModal
            isOpen
            onClose={() => setScheduleMessageModalOpen(false)}
            channelId={selectedChat.channel_id}
            chatId={selectedChat.id}
            phoneDigits={selectedChat.phone_digits}
            leadId={selectedChat.lead_id}
            initialText={messageDraft}
            onScheduled={() => {
              setMessageDraft('');
              setScheduledMessagesPanelOpen(false);
            }}
          />
        ) : null}

        {selectedChat && scheduledMessagesPanelOpen ? (
          <WhatsAppScheduledMessagesPanel
            channelId={selectedChat.channel_id}
            chatId={selectedChat.id}
            phoneDigits={selectedChat.phone_digits}
            currentContactName={selectedChatDisplayName}
            isOpen
            onClose={() => setScheduledMessagesPanelOpen(false)}
            onScheduleNew={() => setScheduleMessageModalOpen(true)}
          />
        ) : null}

        {allScheduledMessagesPanelOpen ? (
          <WhatsAppScheduledMessagesPanel
            isOpen
            onClose={() => setAllScheduledMessagesPanelOpen(false)}
          />
        ) : null}

        </Suspense>

        <WhatsAppMessagePopovers
          reactionPickerRef={reactionPickerRef}
          reactionPickerPosition={reactionPickerPosition}
          openReactionPickerMessage={openReactionPickerMessage}
          reactionOptions={REACTION_OPTIONS}
          reactingMessageIds={reactingMessageIds}
          onCloseReactionPicker={() => setOpenReactionPickerMessageId(null)}
          onReactToMessage={(message, emoji) => void handleReactToMessage(message, emoji)}
          messageActionMenuRef={messageActionMenuRef}
          messageActionMenuPosition={messageActionMenuPosition}
          openMessageActionMenuMessage={openMessageActionMenuMessage}
          starringMessageIds={starringMessageIds}
          deletingMessageId={deletingMessageId}
          onCloseMessageActionMenu={() => {
            setMessageActionMenuPointerAnchor(null);
            setOpenMessageActionMenuMessageId(null);
          }}
          onOpenMessageDetails={handleOpenMessageDetails}
          onReplyToMessage={handleReplyToMessage}
          onOpenForwardMessageModal={handleOpenForwardMessageModal}
          onToggleStarMessage={(message) => {
            void handleToggleStarMessage(message);
            setOpenMessageActionMenuMessageId(null);
            setMessageActionMenuPointerAnchor(null);
          }}
          onOpenEditMessageModal={handleOpenEditMessageModal}
          onRequestDeleteMessage={(message) => {
            setMessageActionMenuPointerAnchor(null);
            setOpenMessageActionMenuMessageId(null);
            setMessagePendingDeletion(message);
          }}
        />

        <PanelPopoverShell
          ref={chatMenuRef}
          isOpen={Boolean(openChatMenuChat && chatMenuPosition)}
          position={chatMenuPosition}
          onClose={() => {
            setChatMenuPointerAnchor(null);
            setOpenChatMenuChatId(null);
          }}
          ariaLabel="Menu da conversa"
          className="before:hidden rounded-2xl border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-2xl"
          style={{ width: chatMenuPosition?.width ?? 248 }}
        >
          {openChatMenuChat ? (
            <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setChatMenuPointerAnchor(null);
                    setOpenChatMenuChatId(null);
                    void handleUpdateChatInboxState(openChatMenuChat, { isArchived: !openChatMenuChat.is_archived });
                  }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                {openChatMenuChat.is_archived ? <ArchiveRestore className="h-4 w-4 shrink-0" /> : <Archive className="h-4 w-4 shrink-0" />}
                <span>{openChatMenuChat.is_archived ? 'Remover dos arquivados' : 'Arquivar conversa'}</span>
              </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatMenuPointerAnchor(null);
                    setOpenChatMenuChatId(null);
                    void handleUpdateChatInboxState(openChatMenuChat, { isMuted: !openChatMenuChat.is_muted });
                  }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                {openChatMenuChat.is_muted ? <Bell className="h-4 w-4 shrink-0" /> : <BellOff className="h-4 w-4 shrink-0" />}
                <span>{openChatMenuChat.is_muted ? 'Ativar notificacoes' : 'Silenciar notificacoes'}</span>
              </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatMenuPointerAnchor(null);
                    setOpenChatMenuChatId(null);
                    void handleUpdateChatInboxState(openChatMenuChat, { isPinned: !openChatMenuChat.is_pinned });
                  }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                <Pin className="h-4 w-4 shrink-0" />
                <span>{openChatMenuChat.is_pinned ? 'Desafixar conversa' : 'Fixar conversa'}</span>
              </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatMenuPointerAnchor(null);
                    setOpenChatMenuChatId(null);
                    void handleUpdateChatInboxState(openChatMenuChat, { markAsUnread: !openChatMenuChat.manual_unread && openChatMenuChat.unread_count <= 0 });
                  }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>{openChatMenuChat.manual_unread || openChatMenuChat.unread_count > 0 ? 'Marcar como lida' : 'Marcar como não lida'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatMenuPointerAnchor(null);
                  setOpenChatMenuChatId(null);
                  setChatPendingDeletion(openChatMenuChat);
                }}
                disabled={deletingChatId === openChatMenuChat.id || updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm text-[var(--danger-text)] transition hover:bg-[var(--danger-soft)] disabled:opacity-60"
              >
                {deletingChatId === openChatMenuChat.id ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Trash2 className="h-4 w-4 shrink-0" />}
                <span>Excluir conversa</span>
              </button>
            </div>
          ) : null}
        </PanelPopoverShell>

        <PanelPopoverShell
          ref={threadActionsMenuRef}
          isOpen={Boolean(selectedChat && threadActionsMenuOpen && threadActionsMenuPosition)}
          position={threadActionsMenuPosition}
          onClose={() => setThreadActionsMenuOpen(false)}
          ariaLabel="Ações da conversa"
          role="menu"
          className="kds-dropdown-menu before:hidden overflow-y-auto p-1"
          style={{ width: threadActionsMenuPosition?.width ?? 288, maxHeight: threadActionsMenuPosition?.maxHeight }}
        >
          {selectedChat ? (
            <div className="flex flex-col gap-1">
              {!selectedChat.is_group && selectedChat.lead_id ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setThreadActionsMenuOpen(false);
                    if (isSelectedChatWaitingForQuote) {
                      return;
                    }
                    if (selectedChat.autonomous_attendance_status === 'active') {
                      void handleDeactivateAutonomousAttendance(selectedChat);
                    } else {
                      void handleActivateAutonomousAttendance(selectedChat);
                    }
                  }}
                  disabled={assumingControlChatId === selectedChat.id || isSelectedChatWaitingForQuote}
                  className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
                >
                  {assumingControlChatId === selectedChat.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Bot className="h-4 w-4 shrink-0" />}
                  <span>{isSelectedChatWaitingForQuote
                    ? 'IA encerrada enquanto aguarda cotação'
                    : selectedChat.autonomous_attendance_status === 'active' ? 'Desativar IA neste chat' : 'Ativar IA neste chat'}</span>
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setThreadActionsMenuOpen(false);
                  setChatFilesOpen(true);
                }}
                className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span>Arquivos da conversa</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setThreadActionsMenuOpen(false);
                  handleToggleChatMessageSearch();
                }}
                className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span>Pesquisar neste chat</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setThreadActionsMenuOpen(false);
                  setScheduledMessagesPanelOpen(true);
                }}
                className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
              >
                <CalendarClock className="h-4 w-4 shrink-0" />
                <span>Mensagens agendadas desta conversa</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setThreadActionsMenuOpen(false);
                  void handleCopyChatTranscript();
                }}
                disabled={copyingTranscript}
                className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
              >
                {copyingTranscript ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Copy className="h-4 w-4 shrink-0" />}
                <span>Copiar conversa formatada</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setThreadActionsMenuOpen(false);
                  void handleRecoverChatHistory();
                }}
                disabled={Boolean(historyRecoveryDisabledReason) || syncingHistoryChatId === selectedChat.id}
                className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
                title={historyRecoveryDisabledReason ?? undefined}
              >
                {syncingHistoryChatId === selectedChat.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
                <span>Recuperar histórico antigo</span>
              </button>
              {!selectedChat.is_group ? <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setThreadActionsMenuOpen(false);
                  handleOpenFollowUpModal();
                }}
                disabled={Boolean(followUpGenerationDisabledReason)}
                className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
                title={followUpGenerationDisabledReason ?? undefined}
              >
                {generatingFollowUp ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Sparkles className="h-4 w-4 shrink-0" />}
                <span>Gerar follow-up com IA</span>
              </button> : null}
              {!selectedChat.is_group ? <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setThreadActionsMenuOpen(false);
                  handleOpenLeadDrawer();
                }}
                className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
              >
                <Info className="h-4 w-4 shrink-0" />
                <span>{selectedChat.lead_id ? 'Informações do lead' : 'Vincular lead do CRM'}</span>
              </button> : null}
            </div>
          ) : null}
        </PanelPopoverShell>

        <PanelPopoverShell
          ref={advancedFiltersRef}
          isOpen={advancedFiltersOpen}
          position={advancedFiltersPosition}
          onClose={() => setAdvancedFiltersOpen(false)}
          ariaLabel="Filtros avançados do inbox"
          className="w-[292px] border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 shadow-2xl"
        >
          <div className="space-y-2.5">
            <InboxFilterGroup
              label="Atividade"
              value={chatActivityFilter}
              onChange={setChatActivityFilter}
              compact
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'unread', label: 'Não lidas' },
              ]}
            />

            <InboxMultiFilterGroup
              label="Status do lead"
              values={leadStatusFilters}
              onChange={setLeadStatusFilters}
              compact
              variant="list"
              options={leadStatuses.map((status) => ({
                value: status.nome,
                label: status.nome,
              }))}
            />

            <InboxMultiFilterGroup
              label="Agente responsável"
              values={leadResponsavelFilters}
              onChange={setLeadResponsavelFilters}
              compact
              options={responsavelOptions.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
            />

            {hasActiveChatFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChatActivityFilter('all');
                  setLeadStatusFilters([]);
                  setLeadResponsavelFilters([]);
                  setAdvancedFiltersOpen(false);
                }}
                className="uppercase tracking-[0.12em] hover:bg-transparent hover:text-[var(--brand-primary-hover)]"
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </PanelPopoverShell>
      </div>
    </div>
    </WhatsAppInboxSelectionProvider>
  );
}
