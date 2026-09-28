import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  whatsappMediaRepository,
  whatsappMessagesRepository,
  type CommWhatsAppLeadContractSummary,
  type CommWhatsAppLeadPanel,
  type CommWhatsAppOperationalState,
} from './data';
import { configService } from '../../config';
import type { Lead } from '../../leads';
import { formatDateTimeFullBR, isOverdue } from '../../../lib/dateUtils';
import { toast } from '../../../lib/toast';
import type { CommWhatsAppChat, CommWhatsAppMessage } from './domain/types';
import {
  canReplyOrForwardMessage,
  getMessageSearchPreviewText,
  getQuotePayloadFromMessage,
} from './domain/messagePresentation';
import {
  dedupeObviousDuplicateMessages,
  formatMessageTime,
  mergeMessages,
} from './domain/messageTimeline';
import {
  getSafeChatDisplayName,
  sortChatsByInboxOrder,
} from './domain/chatPresentation';
import {
  buildTranscriptLine,
  normalizeSystemTimeZone,
} from './domain/messageTranscript';
import { shouldHideTechnicalMessage } from './domain/messageVisibility';
import {
  buildQuickReplyShortcut,
  getActiveQuickReplyMatch,
  normalizeQuickReplyLookup,
  summarizeQuickReplyPreview,
} from './domain/quickReplies';
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
import type { InboxMessageScrollMode } from './domain/inboxMessageScroll';
import { KeyedActionLock } from './components/keyedActionLock';
import {
  InboxFilterGroup,
  InboxMultiFilterGroup,
} from './components/WhatsAppInboxList';
import { ComposerSendLock } from './components/composerSendLock';
import { WhatsAppInboxSelectionProvider, type WhatsAppInboxSelectionContextValue } from './WhatsAppInboxSelectionContext';
import { useWhatsAppInboxDeepLink } from './hooks/useWhatsAppInboxDeepLink';
import { useWindowPollingState } from './hooks/useWindowPollingState';
import { useComposerDraft } from './hooks/useComposerDraft';
import { useChatSearch } from './hooks/useChatSearch';
import { useInboxChatMessageSearch } from './hooks/useInboxChatMessageSearch';
import { useClickOutside } from './hooks/useClickOutside';
import {
  mergeCommWhatsAppMessage,
  getMessageDisplayMetadataSignature,
} from './messageStatus';
import {
  type PendingChatInboxStatePatch,
} from './pendingChatInboxState';
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
import { useInboxMediaUploadController } from './hooks/useInboxMediaUploadController';
import type { InboxMessageLoadReason } from './hooks/useInboxMessageLoader';
import { useInboxConversationDataLoader } from './hooks/useInboxConversationDataLoader';
import { useInboxLeadPanel } from './hooks/useInboxLeadPanel';
import { useInboxChatMutations } from './hooks/useInboxChatMutations';
import { useInboxOperationalState } from './hooks/useInboxOperationalState';
import { useInboxOptimisticOutgoingMessages } from './hooks/useInboxOptimisticOutgoingMessages';
import { useInboxMessageStatusRefresh } from './hooks/useInboxMessageStatusRefresh';
import { useInboxSelectedChatPreviewRefresh } from './hooks/useInboxSelectedChatPreviewRefresh';
import { useInboxSelectedLeadRealtime } from './hooks/useInboxSelectedLeadRealtime';
import { useInboxMessageReactionActions } from './hooks/useInboxMessageReactionActions';
import { useInboxMessageMutations } from './hooks/useInboxMessageMutations';
import { useInboxBatchFollowUpSender } from './hooks/useInboxBatchFollowUpSender';
import { useInboxComposerAi } from './hooks/useInboxComposerAi';
import { useInboxMarkChatRead } from './hooks/useInboxMarkChatRead';
import { useInboxFollowUpComposer } from './hooks/useInboxFollowUpComposer';
import { useInboxChatListModel } from './hooks/useInboxChatListModel';
import { useInboxContactIdentity } from './hooks/useInboxContactIdentity';
import { useInboxComposerTextActions } from './hooks/useInboxComposerTextActions';
import { useInboxQuickReplies } from './hooks/useInboxQuickReplies';
import { useInboxMessageForwarding } from './hooks/useInboxMessageForwarding';
import { useInboxHistoryRecovery } from './hooks/useInboxHistoryRecovery';
import { useInboxContactActions } from './hooks/useInboxContactActions';
import { useInboxChatAgendaSummary } from './hooks/useInboxChatAgendaSummary';
import { useInboxArchivedChatCount } from './hooks/useInboxArchivedChatCount';
import { useInboxSelectedChatPresence } from './hooks/useInboxSelectedChatPresence';
import { useInboxRealtimeController } from './hooks/useInboxRealtimeController';
import { useInboxBootstrap } from './hooks/useInboxBootstrap';
import { useInboxMessageThreadController } from './hooks/useInboxMessageThreadController';
import { useInboxChatCollection } from './hooks/useInboxChatCollection';
import { useInboxOptimisticChatState } from './hooks/useInboxOptimisticChatState';
import { useInboxMessageViewport } from './hooks/useInboxMessageViewport';
import { useInboxComposerSubmission, type InboxQuickReplyOption as QuickReplyOption } from './hooks/useInboxComposerSubmission';
import {
  useInboxSelectedChatLifecycle,
  type InboxCreateLeadDraft,
  type InboxStatusReminderLead,
} from './hooks/useInboxSelectedChatLifecycle';
import {
  useInboxOverlayPositions,
  type InboxOverlayPosition,
  type InboxPointerAnchor,
} from './hooks/useInboxOverlayPositions';
import type { ChatActivityFilter } from './domain/chatFilters';

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
const STALE_WEBHOOK_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REFRESHABLE_OUTBOUND_STATUSES = new Set(['pending', 'queued', 'sending', 'sent', 'delivered']);

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
  const [advancedFiltersPosition, setAdvancedFiltersPosition] = useState<InboxOverlayPosition | null>(null);
  const [chatActivityFilter, setChatActivityFilter] = useState<ChatActivityFilter>('all');
  const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>([]);
  const [leadResponsavelFilters, setLeadResponsavelFilters] = useState<string[]>([]);
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState<string | null>(null);
  const [threadReconcileChatId, setThreadReconcileChatId] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);
  const [archivedChatsLoading, setArchivedChatsLoading] = useState(false);
  const [archivedChatsLoadingMore, setArchivedChatsLoadingMore] = useState(false);
  const [archivedChatsHasMore, setArchivedChatsHasMore] = useState(false);
  const [archivedChatsPage, setArchivedChatsPage] = useState(0);
  const [updatingChatStateId, setUpdatingChatStateId] = useState<string | null>(null);
  const [assumingControlChatId, setAssumingControlChatId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [chatPendingDeletion, setChatPendingDeletion] = useState<CommWhatsAppChat | null>(null);
  const [messagePendingDeletion, setMessagePendingDeletion] = useState<CommWhatsAppMessage | null>(null);
  const [saveContactDialogOpen, setSaveContactDialogOpen] = useState(false);
  const [saveContactName, setSaveContactName] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [whatsAppAgendaOpen, setWhatsAppAgendaOpen] = useState(false);
  const [whatsAppDashboardOpen, setWhatsAppDashboardOpen] = useState(false);
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [copyingTranscript, setCopyingTranscript] = useState(false);
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);
  const [mediaDrawerPosition, setMediaDrawerPosition] = useState<InboxOverlayPosition | null>(null);
  const [sendingDrawerMediaByChatId, setSendingDrawerMediaByChatId] = useState<Record<string, boolean>>({});
  const [quickReplyActiveIndex, setQuickReplyActiveIndex] = useState(0);
  const [dismissedQuickReplyKey, setDismissedQuickReplyKey] = useState<string | null>(null);
  const {
    quickReplies,
    loadError: quickRepliesLoadError,
    retryLoad: retryQuickRepliesLoad,
    settingsOpen: quickRepliesModalOpen,
    saving: savingQuickReplies,
    openSettings: handleOpenQuickReplySettings,
    closeSettings: handleCloseQuickReplySettings,
    saveQuickReplies: handleSaveQuickReplies,
  } = useInboxQuickReplies({ setDismissedQuickReplyKey });
  const [sendingByChatId, setSendingByChatId] = useState<Record<string, boolean>>({});
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [retryPendingMessage, setRetryPendingMessage] = useState<CommWhatsAppMessage | null>(null);
  const [replyTargetMessage, setReplyTargetMessage] = useState<CommWhatsAppMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<InboxOverlayPosition | null>(null);
  const [openMessageActionMenuMessageId, setOpenMessageActionMenuMessageId] = useState<string | null>(null);
  const [messageActionMenuPosition, setMessageActionMenuPosition] = useState<InboxOverlayPosition | null>(null);
  const [messageActionMenuPointerAnchor, setMessageActionMenuPointerAnchor] = useState<InboxPointerAnchor | null>(null);
  const [messageDetailsMessageId, setMessageDetailsMessageId] = useState<string | null>(null);
  const [openChatMenuChatId, setOpenChatMenuChatId] = useState<string | null>(null);
  const [chatMenuPosition, setChatMenuPosition] = useState<InboxOverlayPosition | null>(null);
  const [chatMenuPointerAnchor, setChatMenuPointerAnchor] = useState<InboxPointerAnchor | null>(null);
  const [threadActionsMenuOpen, setThreadActionsMenuOpen] = useState(false);
  const [threadActionsMenuPosition, setThreadActionsMenuPosition] = useState<InboxOverlayPosition | null>(null);
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
  const [statusReminderLead, setStatusReminderLead] = useState<InboxStatusReminderLead | null>(null);
  const [statusReminderPromptMessage, setStatusReminderPromptMessage] = useState<string | null>(null);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [linkLoadingLeadId, setLinkLoadingLeadId] = useState<string | null>(null);
  const [leadMutationLoadingChatId, setLeadMutationLoadingChatId] = useState<string | null>(null);
  const [createLeadDraft, setCreateLeadDraft] = useState<InboxCreateLeadDraft | null>(null);
  const [startChatModalOpen, setStartChatModalOpen] = useState(false);
  const [scheduleMessageModalOpen, setScheduleMessageModalOpen] = useState(false);
  const [scheduledMessagesPanelOpen, setScheduledMessagesPanelOpen] = useState(false);
  const [allScheduledMessagesPanelOpen, setAllScheduledMessagesPanelOpen] = useState(false);
  const [startChatQuery, setStartChatQuery] = useState('');
  const [manualStartPhone, setManualStartPhone] = useState('');
  const [startingChatKey, setStartingChatKey] = useState<string | null>(null);
  const [sharedContactActionKey, setSharedContactActionKey] = useState<string | null>(null);
  const { pollingEnabled } = useWindowPollingState();
  const { archivedChatsCount, refreshArchivedChatsCount } = useInboxArchivedChatCount();
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
  const lastSelectedChatPreviewRefreshKeyRef = useRef('');
  const composerSendLockRef = useRef(new ComposerSendLock());
  const pendingChatInboxStateRef = useRef<Map<string, PendingChatInboxStatePatch>>(new Map());
  const manualUnreadSkipReadChatIdRef = useRef<string | null>(null);
  const chatReadMutationVersionByChatIdRef = useRef<Map<string, number>>(new Map());
  const optimisticMessageTimestampByChatIdRef = useRef<Map<string, number>>(new Map());
  const latestChatsRef = useRef<CommWhatsAppChat[]>([]);
  const loadChatsRef = useRef<() => Promise<unknown> | void>(() => {});
  const loadMessagesRef = useRef<(chat: CommWhatsAppChat | null, reason?: InboxMessageLoadReason) => Promise<unknown> | void>(() => {});
  const archivedSectionOpenRef = useRef<boolean>(false);
  const archivedChatsPageRef = useRef<number>(0);
  const latestChatsLoadedAtRef = useRef<number>(0);
  const latestMessagesRef = useRef<CommWhatsAppMessage[]>([]);
  const chatsSignatureRef = useRef('');
  const messagesSignatureRef = useRef('');
  const messagesCacheByChatIdRef = useRef<Map<string, { messages: CommWhatsAppMessage[]; signature: string; hasOlderMessages: boolean }>>(new Map());
  const pendingScrollModeRef = useRef<InboxMessageScrollMode>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const selectedChatIdRef = useRef<string | null>(null);
  const suppressAutoChatSelectionRef = useRef(false);

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
  const messageDraftRef = useRef('');
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

  const archivedChatsCountValue = archivedChatsCount ?? 0;

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );
  const {
    savedContactNameRevision,
    prefetchedLeadNameByPhoneRef,
    savedContactNameByPhoneRef,
    savedContactNameOverrideByPhoneRef,
    applyPrefetchedLeadNames,
    applyFrontendSavedContactNames,
    rememberManualSavedContactName,
    synchronizeSavedContacts,
  } = useInboxContactIdentity({ chats, selectedChat, setChats });
  const {
    mediaUploadProgress,
    mediaUploadAbortControllersRef,
    clearMediaUploadProgress,
    setMediaUploadProgress: setMediaUploadProgressForSelectedChat,
    updateMediaUploadProgress,
    cancelSelectedMediaUpload: handleCancelMediaUpload,
  } = useInboxMediaUploadController({ selectedChatId, selectedChatIdRef });
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

  const {
    open: chatMessageSearchOpen,
    draft: chatMessageSearchDraft,
    query: chatMessageSearch,
    inputRef: chatMessageSearchInputRef,
    results: chatMessageSearchResults,
    searching: searchingChatMessages,
    error: chatMessageSearchError,
    setDraft: setChatMessageSearchDraft,
    retry: retryChatMessageSearch,
    toggle: handleToggleChatMessageSearch,
    close: closeChatMessageSearch,
  } = useInboxChatMessageSearch({
    chatId: selectedChat?.id ?? null,
    selectedChatId,
    selectedChatIdRef,
  });

  const {
    chatMatchesActiveFilters,
    savedContactsForPresentation,
    filteredMessageSearchResults,
    sidebarChats,
    selectedChatForPresentation,
    forwardTargetChats,
    selectedChatTranscriptLabel,
  } = useInboxChatListModel({
    chats,
    selectedChatId,
    selectedChat,
    archivedSectionOpen,
    activityFilter: chatActivityFilter,
    leadStatusFilters,
    leadResponsavelFilters,
    search,
    chatSearchResults,
    messageSearchResults,
    connectedUserName: operationalState?.channel?.connected_user_name ?? null,
    savedContacts,
    savedContactNameRevision,
    savedContactNameOverrides: savedContactNameOverrideByPhoneRef.current,
    synchronizedContactNames: savedContactNameByPhoneRef.current,
    forwardSearch,
  });

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

  const { upsertChatLocally } = useInboxChatCollection({
    setChats,
    chatsSignatureRef,
    savedContactNameOverrideByPhoneRef,
    savedContactNameByPhoneRef,
    buildChatsSignature,
  });
  const { applyOptimisticChatSummary, updateOptimisticChatPreviewStatus } = useInboxOptimisticChatState({
    refs: { pendingChatInboxStateRef, chatReadMutationVersionByChatIdRef, chatsSignatureRef },
    setChats,
    upsertChatLocally,
    buildChatsSignature,
  });

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

  const handleOpenChatMenuFromContext = useCallback((chatId: string, anchor: InboxPointerAnchor) => {
    setChatMenuPointerAnchor(anchor);
    setOpenChatMenuChatId(chatId);
  }, []);

  const handleOpenMessageActionMenuFromContext = useCallback((messageId: string, anchor: InboxPointerAnchor) => {
    setOpenReactionPickerMessageId(null);
    setMessageActionMenuPointerAnchor(anchor);
    setOpenMessageActionMenuMessageId(messageId);
  }, []);

  const handleOpenMessageDetails = useCallback((message: CommWhatsAppMessage) => {
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
    setMessageDetailsMessageId(message.id);
  }, []);

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

  const closeMessageActionMenu = useCallback(() => {
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
  }, []);

  const {
    editingMessage,
    editingMessageDraft,
    setEditingMessageDraft,
    savingMessageEdit,
    deletingMessageId,
    transcribingMessageId,
    handleOpenEditMessageModal,
    handleCloseEditMessageModal,
    handleSaveEditedMessage,
    handleDeleteMessage,
    handleTranscribeMessage,
  } = useInboxMessageMutations({
    selectedChatId,
    patchMessageLocally,
    setChats,
    closeMessageActionMenu,
  });

  const { handleBatchSendFollowUp } = useInboxBatchFollowUpSender({
    refs: { latestChatsRef, loadChatsRef, loadMessagesRef },
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
  const followUpGenerationBaseDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para gerar o follow-up.';
    }

    if (selectedChat.is_group) {
      return 'Grupos são conversas manuais e não participam de follow-ups ou IA autônoma.';
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
  }, [pendingAttachments.length, selectedChat, sending, voiceRecordingState]);
  const composerRewriteBaseDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para reescrever a mensagem.';
    }

    if (!messageDraft.trim()) {
      return 'Digite uma mensagem no composer para usar a IA.';
    }

    if (voiceRecordingState !== 'idle') {
      return 'Finalize a gravação de áudio antes de reescrever a mensagem.';
    }

    return null;
  }, [messageDraft, selectedChat, voiceRecordingState]);
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
  const {
    composerAiMenuOpen,
    setComposerAiMenuOpen,
    composerRewriteModalOpen,
    composerRewriteSource,
    setComposerRewriteSource,
    composerRewriteDraft,
    setComposerRewriteDraft,
    composerRewriteCustomInstructions,
    setComposerRewriteCustomInstructions,
    composerRewriteTone,
    setComposerRewriteTone,
    rewritingComposer,
    replySuggestionText,
    replySuggestionLoading,
    replySuggestionError,
    handleCloseComposerRewriteModal,
    handleQuickRewriteComposerText,
    handleOpenComposerRewriteModal,
    handleRegenerateComposerRewrite,
    handleApplyComposerRewrite,
    handleGenerateReplySuggestion,
    handleApplyReplySuggestion,
    handleDismissReplySuggestion,
  } = useInboxComposerAi({
    selectedChatId,
    selectedChatIdRef,
    replySuggestionKey,
    replySuggestionDisabledReason,
    composerRewriteDisabledReason: composerRewriteBaseDisabledReason,
    messageDraft,
    messageDraftRef,
    setMessageDraft,
    setComposerSelection,
    setComposerFocused,
    composerTextareaRef,
  });
  const composerRewriteDisabledReason = composerRewriteBaseDisabledReason
    ?? (rewritingComposer ? 'Reescrevendo mensagem com IA...' : null);
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

  useInboxSelectedChatLifecycle({
    selectedChatId,
    leadDrawerOpen,
    refs: {
      selectedChatIdRef,
      suppressAutoChatSelectionRef,
      leadMutationRequestIdRef,
    },
    state: {
      setLinkLoadingLeadId,
      setThreadActionsMenuOpen,
      setSaveContactDialogOpen,
      setSaveContactName,
      setCreateLeadDraft,
      setMessagePendingDeletion,
      setRetryPendingMessage,
      setStatusReminderLead,
      setStatusReminderPromptMessage,
      setScheduleMessageModalOpen,
      setScheduledMessagesPanelOpen,
      setChatFilesOpen,
      setMediaDrawerOpen,
      setLeadSearchQuery,
    },
  });

  useClickOutside(
    advancedFiltersOpen,
    () => [advancedFiltersRef.current, advancedFiltersTriggerRef.current],
    () => setAdvancedFiltersOpen(false),
  );

  useInboxOverlayPositions({
    openReactionPickerMessageId,
    openMessageActionMenuMessageId,
    messageActionMenuPointerAnchor,
    openChatMenuChatId,
    chatMenuPointerAnchor,
    advancedFiltersOpen,
    threadActionsMenuOpen,
    mediaDrawerOpen,
    refs: {
      messagesContainerRef,
      reactionAnchorRefs,
      messageActionTriggerRefs,
      messageActionMenuRef,
      chatMenuTriggerRefs,
      chatMenuRef,
      advancedFiltersTriggerRef,
      threadActionsMenuTriggerRef,
      mediaDrawerTriggerRef,
    },
    setReactionPickerPosition,
    setMessageActionMenuPosition,
    setChatMenuPosition,
    setAdvancedFiltersPosition,
    setThreadActionsMenuPosition,
    setMediaDrawerPosition,
  });

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

  const { loadOperationalState } = useInboxOperationalState({
    setOperationalState,
    setOperationalStateError,
    setOperationalStateLoaded,
  });

  useEffect(() => {
    if (!selectedChat?.lead_id) {
      leadPanelRequestIdRef.current += 1;
      leadContractsRequestIdRef.current += 1;
      setLeadPanel(null);
      setLeadPanelError(null);
      setLeadPanelLoading(false);
      setLeadContracts([]);
      setLeadContractsLoading(false);
      setLeadContractsError(null);
      return;
    }

    if (leadPanel?.id !== selectedChat.lead_id) {
      setLeadPanel(null);
      setLeadPanelError(null);
      setLeadContracts([]);
      setLeadContractsError(null);
    }
  }, [leadPanel?.id, selectedChat?.id, selectedChat?.lead_id]);

  useEffect(() => {
    if (!selectedChat?.lead_id) {
      setLeadPanel(null);
      setLeadPanelError(null);
      return;
    }

    const currentSelectedChat = selectedChatId
      ? latestChatsRef.current.find((chat) => chat.id === selectedChatId) ?? null
      : null;
    void loadLeadPanel(currentSelectedChat);
  }, [loadLeadPanel, selectedChat?.lead_id, selectedChatId]);

  const {
    chatAgendaSummary,
    chatAgendaSummaryLoading,
    chatAgendaSummaryError,
    setChatAgendaSummary,
    loadChatAgendaSummary,
  } = useInboxChatAgendaSummary({
    selectedChatLeadId: selectedChat?.lead_id ?? null,
    leadPanelId: leadPanel?.id ?? null,
    leadContracts,
  });

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
    synchronizeSavedContacts(savedContacts);
  }, [savedContacts, synchronizeSavedContacts]);

  const {
    loadChats,
    handleLoadMoreArchivedChats,
    handleSwitchArchivedSection,
    loadMessages,
  } = useInboxConversationDataLoader({
    chatLoader: {
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
    },
    messageLoader: {
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
    },
    refs: { loadChatsRef, loadMessagesRef },
  });

  const {
    markSelectedChatReadIfEligible,
    clearManualUnreadSkipReadForOtherChats,
  } = useInboxMarkChatRead({
    refs: {
      selectedChatIdRef,
      latestChatsRef,
      latestMessagesRef,
      isNearBottomRef,
      pendingChatInboxStateRef,
      manualUnreadSkipReadChatIdRef,
      chatReadMutationVersionByChatIdRef,
    },
    upsertChatLocally,
    loadChats,
  });

  const { handleMessagesScroll } = useInboxMessageViewport({
    refs: {
      messagesContainerRef,
      messageBubbleRefs,
      pendingScrollModeRef,
      pendingScrollTopRef,
      pendingScrollHeightRef,
      isNearBottomRef,
    },
    messages,
    localOutgoingMessages,
    selectedChatId,
    highlightedMessageId,
    setHighlightedMessageId,
    markSelectedChatReadIfEligible,
  });

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

  const {
    syncingChatId: syncingHistoryChatId,
    disabledReason: historyRecoveryDisabledReason,
    handleRecoverHistory: handleRecoverChatHistory,
  } = useInboxHistoryRecovery({ selectedChat, sendDisabledReason, loadChats, loadMessages });

  useInboxBootstrap({
    loadChats,
    loadOperationalState,
    refreshArchivedChatsCount,
    setLoading,
  });

  const { isChannelConnectedRef, isMessageRealtimeHealthyRef } = useInboxRealtimeController({
    channelId: channelState?.id ?? null,
    selectedChatId,
    channelConnected: isChannelConnected,
    updates: {
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
    },
  });

  useInboxSelectedChatPresence({ selectedChatId, setChats });

  const {
    messageLoadRetrying,
    handleRetryMessageLoad,
    handleSelectMessageSearchResult,
    handleOpenQuotedMessage,
    handleSelectChatMessageSearchResult,
    handleLoadOlderMessages,
  } = useInboxMessageThreadController({
    selectedChatId,
    selectedChat,
    getSelectedChatSnapshot,
    loadMessages,
    refs: {
      selectedChatIdRef,
      latestMessagesRef,
      messagesRequestIdRef,
      messagesSignatureRef,
      messagesCacheByChatIdRef,
      pendingScrollModeRef,
      pendingScrollTopRef,
      pendingScrollHeightRef,
      isNearBottomRef,
      messagesContainerRef,
      messageSearchSelectionRequestIdRef,
      pendingMessageSearchChatIdRef,
      quotedMessageNavigationRequestIdRef,
      composerTextareaRef,
      lastSelectedChatPreviewRefreshKeyRef,
      cancelVoiceRecordingRef,
    },
    state: {
      loadingOlderMessages,
      hasOlderMessages,
      setMessages,
      setMessageLoadError,
      setLoadingMessages,
      setThreadReconcileChatId,
      setHasOlderMessages,
      setLoadingOlderMessages,
      setReplyTargetMessage,
      setSelectedChatId,
      setHighlightedMessageId,
      setChatMenuPointerAnchor,
      setOpenChatMenuChatId,
    },
    buildMessagesSignature,
    upsertChatLocally,
  });

  useEffect(
    () => () => {
      cancelVoiceRecordingRef.current();
      chatsRequestIdRef.current += 1;
      messagesRequestIdRef.current += 1;
      leadPanelRequestIdRef.current += 1;
      leadContractsRequestIdRef.current += 1;

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

  useEffect(() => {
    markSelectedChatReadIfEligible('auto');
  }, [markSelectedChatReadIfEligible, selectedChat, visibleMessages]);

  useEffect(() => {
    clearManualUnreadSkipReadForOtherChats(selectedChatId);
  }, [clearManualUnreadSkipReadForOtherChats, selectedChatId]);

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
  const {
    followUpModalOpen,
    followUpDraft,
    setFollowUpDraft,
    followUpCustomInstructions,
    setFollowUpCustomInstructions,
    followUpVariations,
    followUpAiContextRationale,
    followUpEmotionalContext,
    followUpCurrentAction,
    followUpCurrentActionReason,
    followUpOpportunityRecommendation,
    followUpNextAction,
    schedulingFollowUpNextAction,
    followUpGenerationDisabledReason,
    handleCloseFollowUpModal,
    handleOpenFollowUpModal,
    handleRegenerateFollowUp,
    handleScheduleFollowUpNextAction,
    handleSendFollowUpDraft,
  } = useInboxFollowUpComposer({
    selectedChat,
    selectedChatIdRef,
    selectedChatDisplayName,
    generatingFollowUp,
    setGeneratingFollowUp,
    leadPanelId: leadPanel?.id ?? null,
    leadContracts,
    canEditAgenda,
    followUpGenerationBaseDisabledReason,
    sendDisabledReason,
    loadChatAgendaSummary,
    sendTextSegments,
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

  const {
    forwardingMessage,
    forwardingTargetIds,
    forwardingInProgress,
    handleOpenForwardMessageModal,
    handleCloseForwardMessageModal,
    handleToggleForwardTarget,
    handleForwardToSelectedChats,
  } = useInboxMessageForwarding({
    forwardTargetChats,
    selectedChatIdRef,
    latestChatsRef,
    loadChats,
    loadMessages,
    closeMessageActionMenu,
    setForwardSearch,
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

  const { handleSaveSharedContact, handleSaveContactToPhonebook } = useInboxContactActions({
    selectedChat,
    selectedChatForPresentation,
    saveContactName,
    setSavingContact,
    setSaveContactDialogOpen,
    setSharedContactActionKey,
    startChatQuery,
    refreshStartChatSources,
    rememberManualSavedContactName,
    loadChats,
  });

  const {
    syncComposerSelection,
    handleComposerChange,
    handleInsertQuickReply,
    handleInsertEmoji,
    handleApplyComposerTextFormat,
  } = useInboxComposerTextActions({
    textareaRef: composerTextareaRef,
    messageDraft,
    setMessageDraft,
    composerSelection,
    setComposerSelection,
    setComposerFocused,
    activeQuickReplyMatch,
    setDismissedQuickReplyKey,
    setQuickReplyActiveIndex,
    resizeComposerTextarea,
  });

  const {
    handleSendCurrentVoiceRecording,
    handleComposerSubmit,
    handleComposerKeyDown,
  } = useInboxComposerSubmission({
    generatingFollowUp,
    voiceRecordingState,
    voiceAttachment,
    hasSendPayload,
    quickReplyMenuOpen,
    quickReplyMenuHasResults,
    filteredQuickReplyOptions,
    quickReplyActiveIndex,
    activeQuickReplyKey,
    replySuggestionText,
    replySuggestionLoading,
    autoSendVoiceRef,
    setQuickReplyActiveIndex,
    setDismissedQuickReplyKey,
    handleInsertQuickReply,
    handleApplyReplySuggestion,
    handleSendMessage,
    handleStartVoiceRecording,
    handleStopVoiceRecording,
  });

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
  }, [setAttachmentMenuOpen, setComposerAiMenuOpen]);

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
                  onClose={closeChatMessageSearch}
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
                onRetryQuickRepliesLoad={retryQuickRepliesLoad}
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
