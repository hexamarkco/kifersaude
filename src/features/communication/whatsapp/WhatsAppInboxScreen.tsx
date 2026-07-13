import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { AlertCircle, AlertTriangle, Archive, ArchiveRestore, Bell, BellOff, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Cog, Copy, Download, FileAudio, FileImage, FileText, Forward, Headphones, Images, Info, Link2, Loader2, MapPin, MessageCircle, Mic, Pause, Pencil, Pin, Play, Plus, Reply, RotateCw, Search, SendHorizontal, SlidersHorizontal, Smile, Sparkles, Sticker, Trash2, UserRound, Volume2, Vote, WifiOff, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Input from '../../../components/ui/Input';
import { Button, Dialog, DialogBody, DialogHeader, DialogTitle } from '../../../design-system';
import LeadForm from '../../../components/LeadForm';
import PanelPopoverShell from '../../../components/ui/PanelPopoverShell';
import { getPanelButtonClass } from '../../../components/ui/standards';
import ReminderSchedulerModal from '../../../components/ReminderSchedulerModal';
import StatusDropdown from '../../../components/StatusDropdown';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { applyTemplateVariables } from '../../../lib/autoContactService';
import { cx } from '../../../lib/cx';
import {
  CommWhatsAppMediaSendTimeoutError,
  commWhatsAppService,
  formatCommWhatsAppPhoneLabel,
  type CommWhatsAppLeadContractSummary,
  type CommWhatsAppLeadPanel,
  type CommWhatsAppLeadSearchResult,
  type CommWhatsAppMessageSearchResult,
  type CommWhatsAppMediaSendKind,
  type CommWhatsAppOperationalState,
  type CommWhatsAppFollowUpNextAction,
  type CommWhatsAppFollowUpTone,
  type CommWhatsAppFollowUpVariation,
  type CommWhatsAppRewriteTone,
} from '../../../lib/commWhatsAppService';
import { configService } from '../../../lib/configService';
import { formatDateTimeFullBR, getDateKey, isOverdue, SAO_PAULO_TIMEZONE } from '../../../lib/dateUtils';
import { normalizeLeadStatusLabel, shouldPromptFirstReminderAfterQuote } from '../../../lib/leadReminderUtils';
import { toast } from '../../../lib/toast';
import { splitWhatsAppMessageSegments } from '../../../lib/whatsAppMessageSegments';
import {
  WHATSAPP_QUICK_REPLIES_INTEGRATION_DESCRIPTION,
  WHATSAPP_QUICK_REPLIES_INTEGRATION_NAME,
  WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG,
  buildWhatsAppQuickRepliesSettings,
  normalizeWhatsAppQuickRepliesSettings,
  sanitizeWhatsAppQuickReplyShortcut,
  type WhatsAppQuickReply,
} from '../../../lib/whatsAppQuickReplies';
import { fetchAllPages, isSupabaseConnectivityError, supabase, type CommWhatsAppChat, type CommWhatsAppMessage, type CommWhatsAppPhoneContact, type IntegrationSetting, type Lead, type Reminder } from '../../../lib/supabase';
import WhatsAppAgendaModal from './components/WhatsAppAgendaModal';
import type { WhatsAppBatchFollowUpSendProgress } from './components/WhatsAppBatchFollowUpModal';
import WhatsAppComposerRewriteModal from './components/WhatsAppComposerRewriteModal';
import WhatsAppDashboardModal from './components/WhatsAppDashboardModal';
import WhatsAppEditMessageModal from './components/WhatsAppEditMessageModal';
import WhatsAppFollowUpModal from './components/WhatsAppFollowUpModal';
import { followUpSalesTechniqueOptions } from './components/followUpSalesTechniques';
import { CONVERSATION_SITUATION_PRESETS } from './components/followUpSituationPresets';
import WhatsAppMediaDrawer from './components/WhatsAppMediaDrawer';
import WhatsAppLeadDrawer from './components/WhatsAppLeadDrawer';
import WhatsAppQuickRepliesModal from './components/WhatsAppQuickRepliesModal';
import WhatsAppStartChatModal from './components/WhatsAppStartChatModal';
import { WhatsAppInboxSelectionProvider, type WhatsAppInboxSelectionContextValue } from './WhatsAppInboxSelectionContext';
import { useCommWhatsAppMessageRealtime } from './hooks/useCommWhatsAppMessageRealtime';
import { useWhatsAppInboxDeepLink } from './hooks/useWhatsAppInboxDeepLink';
import { useWindowPollingState } from './hooks/useWindowPollingState';
import { useComposerDraft, type ComposerSelection } from './hooks/useComposerDraft';
import { useVoiceRecording } from './hooks/useVoiceRecording';
import { useChatSearch } from './hooks/useChatSearch';
import {
  mergeCommWhatsAppMessage,
  mergeCommWhatsAppMessages,
  messagesReferToSameDelivery,
  normalizeDeliveryStatus,
  resolveDeliveryStatus,
} from './messageStatus';
import {
  applyPendingChatInboxState,
  buildPendingChatInboxStatePatch,
  clearPendingChatReadState,
  mergePendingChatInboxState,
  stripPendingChatInboxMetadata,
  type PendingChatInboxStatePatch,
} from './pendingChatInboxState';
import { normalizeWhapiDirectChatId } from './whatsAppChatId';

const CHAT_POLL_INTERVAL_MS = 8000;
const MAX_CHAT_POLL_BACKOFF_MS = 60000;
const MESSAGE_POLL_INTERVAL_MS = 5000;
const OPERATIONAL_STATE_POLL_INTERVAL_MS = 30000;
const MESSAGE_PAGE_SIZE = 50;
const CHAT_PAGE_SIZE = 250;
const SCROLL_BOTTOM_THRESHOLD_PX = 96;
const STALE_WEBHOOK_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const CHAT_IDENTITY_LOOKUP_BATCH_SIZE = 10;
const CHAT_IDENTITY_LOOKUP_MAX_CHATS_PER_CYCLE = 30;
const CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const SAVED_CONTACT_FORCE_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_TRANSCRIPT_TIME_ZONE = 'America/Sao_Paulo';
const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Áudio sem transcrição]';
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REACTION_PICKER_WIDTH_PX = 252;
const REACTION_PICKER_HEIGHT_PX = 52;
const MESSAGE_STATUS_REFRESH_DELAYS_MS = [1000, 3000, 7000, 15000, 30000, 60000, 120000, 300000];
const REFRESHABLE_OUTBOUND_STATUSES = new Set(['pending', 'queued', 'sending', 'sent']);
const EMPTY_CHAT_LIST_RETRY_DELAYS_MS = [700, 1500];
const CHAT_READ_RETRY_COOLDOWN_MS = 30_000;

type MessageLoadReason = 'initial' | 'poll' | 'send';
type ScrollMode = 'bottom' | 'preserve' | 'prepend' | null;
type WhatsAppFormatMatch = { start: number; end: number; marker: string; format: WhatsAppTextFormat };
type PendingAttachment = {
  id: string;
  file: File;
  kind: CommWhatsAppMediaSendKind;
  durationSeconds?: number;
  previewUrl?: string | null;
  waveform?: number[];
  waveformPayload?: string | null;
};
type MediaUploadProgress = {
  attachmentId: string;
  currentIndex: number;
  total: number;
  progress: number | null;
  fileName: string;
};
type AttachmentMenuAction = 'document' | 'media' | 'audio' | 'contact';
type ChatActivityFilter = 'all' | 'unread';
type QuickReplyCommandMatch = { query: string; start: number; end: number };
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
  nextReminder: Reminder | null;
};
type CreateLeadDraft = {
  chatId: string;
  initialValues: Partial<Lead>;
};
type LocalOutgoingRetryPayload =
  | { kind: 'text'; text: string; clientRequestId?: string }
  | {
      kind: 'media';
      mediaKind: CommWhatsAppMediaSendKind;
      file: File;
      caption?: string;
      durationSeconds?: number;
      waveform?: string;
      fileName?: string;
      previewUrl?: string | null;
      clientRequestId?: string;
    }
  | {
      kind: 'remote_media';
      mediaKind: 'image' | 'video' | 'document';
      remoteUrl: string;
      mimeType?: string;
      fileName?: string;
      caption?: string;
      previewUrl?: string | null;
      clientRequestId?: string;
    };

type QueuedTextMessage = {
  segment: string;
  optimisticMessage: CommWhatsAppMessage;
  clientRequestId: string;
};

type OutgoingQuotePayload = ReturnType<typeof getQuotePayloadFromMessage>;

type MessageQuoteInfo = {
  externalMessageId: string | null;
  authorPhone: string | null;
  quotedType: string | null;
  previewText: string;
};

type MessageContactCardInfo = {
  kind: 'contact' | 'contact_list';
  count: number;
  items: Array<{
    name: string | null;
    phoneNumber: string | null;
  }>;
};

const DEFAULT_QUICK_REPLIES = normalizeWhatsAppQuickRepliesSettings(null).quickReplies;

const normalizeQuickReplyLookup = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const buildQuickReplyShortcut = (value: string, index: number) => {
  const normalized = sanitizeWhatsAppQuickReplyShortcut(value);

  return normalized || `msg-${index + 1}`;
};

const summarizeQuickReplyPreview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117).trimEnd()}...`;
};

const createPendingAttachmentId = () => `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MEDIA_ATTACHMENT_ACCEPT = 'image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.heic,.heif,video/*,.mp4,.mov,.avi,.mkv,.webm';
const DOCUMENT_ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const AUDIO_ATTACHMENT_ACCEPT = 'audio/*,.mp3,.wav,.ogg,.m4a,.aac';
const DEFAULT_ATTACHMENT_ACCEPT = `${MEDIA_ATTACHMENT_ACCEPT},${DOCUMENT_ATTACHMENT_ACCEPT},${AUDIO_ATTACHMENT_ACCEPT}`;
const createLocalOutgoingMessageId = () => `local-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createClientRequestId = () => `client-request-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const VIDEO_LIKE_MESSAGE_TYPES = new Set(['video', 'gif', 'short']);
const GALLERY_MESSAGE_TYPES = new Set(['image', 'video', 'gif', 'short']);
const GALLERY_GROUP_MAX_GAP_MS = 2 * 60 * 1000;
const EDITABLE_OUTBOUND_MESSAGE_TYPES = new Set(['text', 'image', 'video', 'gif', 'short', 'document']);

const buildMediaSummaryText = (kind: CommWhatsAppMediaSendKind | 'document') => {
  if (kind === 'image') return '[Imagem]';
  if (kind === 'video') return '[Video]';
  if (kind === 'audio' || kind === 'voice') return '[Audio]';
  return '[Documento]';
};

const buildComposerQueueSnapshotKey = (chatId: string, text: string, attachments: PendingAttachment[]) => {
  const attachmentKey = attachments
    .map((attachment) => `${attachment.id}:${attachment.file.name}:${attachment.file.size}:${attachment.kind}`)
    .join('|');

  return `${chatId}:${text}:${attachmentKey}`;
};

const getMessageSummaryMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();

  if (normalized === 'text') return '[Mensagem]';
  if (normalized === 'image') return '[Imagem]';
  if (VIDEO_LIKE_MESSAGE_TYPES.has(normalized)) return '[Video]';
  if (normalized === 'audio' || normalized === 'voice') return '[Audio]';
  if (normalized === 'document') return '[Documento]';
  if (normalized === 'link_preview') return '[Link]';
  if (normalized === 'location' || normalized === 'live_location') return '[Localizacao]';
  if (normalized === 'sticker') return '[Sticker]';
  if (normalized === 'contact' || normalized === 'contact_list') return '[Contato]';
  if (normalized === 'poll') return '[Enquete]';
  if (normalized === 'reply') return '[Resposta]';
  if (normalized === 'interactive' || normalized === 'hsm' || normalized === 'carousel') return '[Mensagem interativa]';
  return getUnknownMessageMarker(normalized);
};

const normalizeTechnicalMarker = (value?: string | null) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ');

const VISIBLE_SUMMARY_MARKERS = new Set([
  '[imagem]',
  '[video]',
  '[documento]',
  '[audio]',
  '[link]',
  '[localizacao]',
  '[sticker]',
  '[contato]',
  '[enquete]',
  '[resposta]',
  '[mensagem interativa]',
]);

const HIDDEN_TECHNICAL_MESSAGE_MARKERS = new Set([
  '[mensagem]',
  '[mensagem sem texto]',
  '[mensagem sem conteudo]',
  '[payload invalido]',
  '[acao]',
  '[action]',
  '[reacao]',
  '[reaction]',
  '[atualizacao de midia]',
  '[media update]',
  '[voto em enquete]',
]);

const isBracketOnlyMarker = (value?: string | null) => /^\[[^\]]+\]$/.test(String(value ?? '').trim());

const isHiddenTechnicalMessageMarker = (value?: string | null, messageType?: string) => {
  const normalized = normalizeTechnicalMarker(value);
  if (!normalized) {
    return false;
  }

  if (HIDDEN_TECHNICAL_MESSAGE_MARKERS.has(normalized)) {
    return true;
  }

  if (messageType?.trim() && normalized === normalizeTechnicalMarker(getMessageSummaryMarker(messageType))) {
    return !VISIBLE_SUMMARY_MARKERS.has(normalized);
  }

  return isBracketOnlyMarker(value) && !VISIBLE_SUMMARY_MARKERS.has(normalized);
};

const isMessageSummaryMarker = (value?: string | null, messageType?: string) => {
  const normalized = normalizeTechnicalMarker(value);
  if (!normalized) {
    return false;
  }

  if (VISIBLE_SUMMARY_MARKERS.has(normalized) || HIDDEN_TECHNICAL_MESSAGE_MARKERS.has(normalized)) {
    return true;
  }

  if (messageType?.trim()) {
    return normalized === normalizeTechnicalMarker(getMessageSummaryMarker(messageType));
  }

  return false;
};

const getVisiblePreviewText = (value?: string | null, messageType?: string) => (
  isHiddenTechnicalMessageMarker(value, messageType) ? '' : String(value ?? '').trim()
);

const resolveStableDeliveryStatus = (incoming?: string | null, previous?: string | null) => {
  return resolveDeliveryStatus(previous, incoming);
};

const preserveUsefulChatPreview = (incoming: CommWhatsAppChat, previous?: CommWhatsAppChat | null): CommWhatsAppChat => {
  if (!previous) {
    return incoming;
  }

  const incomingPreview = getVisiblePreviewText(incoming.last_message_text);
  const previousPreview = getVisiblePreviewText(previous.last_message_text);
  const incomingAt = getMessageTimestampMs(incoming.last_message_at);
  const previousAt = getMessageTimestampMs(previous.last_message_at);
  const incomingIsOlder = incomingAt !== null && previousAt !== null && incomingAt < previousAt;
  const incomingIsNotNewer = incomingAt === null || previousAt === null || incomingAt <= previousAt;
  const stableDeliveryStatus = incomingIsNotNewer
    ? resolveStableDeliveryStatus(incoming.last_message_delivery_status, previous.last_message_delivery_status)
    : incoming.last_message_delivery_status;

  if (incomingIsOlder && previousPreview) {
    return {
      ...incoming,
      last_message_text: previous.last_message_text,
      last_message_direction: previous.last_message_direction || incoming.last_message_direction,
      last_message_delivery_status: stableDeliveryStatus ?? previous.last_message_delivery_status,
      last_message_at: previous.last_message_at,
    };
  }

  if (incomingPreview || !previousPreview) {
    return {
      ...incoming,
      last_message_delivery_status: stableDeliveryStatus,
    };
  }

  if (!incomingIsNotNewer && String(incoming.last_message_text ?? '').trim()) {
    return incoming;
  }

  return {
    ...incoming,
    last_message_text: previous.last_message_text,
    last_message_direction: incoming.last_message_direction || previous.last_message_direction,
    last_message_delivery_status: stableDeliveryStatus ?? previous.last_message_delivery_status,
    last_message_at: incoming.last_message_at ?? previous.last_message_at,
  };
};

type ChatPreviewIconType = 'image' | 'video' | 'audio' | 'document' | 'link' | 'location' | 'sticker' | 'contact' | 'poll' | 'interactive';

const getChatPreviewIconType = (value: string | null | undefined): ChatPreviewIconType | null => {
  const normalized = normalizeTechnicalMarker(value);

  if (normalized === '[imagem]' || normalized.startsWith('[imagem] ')) return 'image';
  if (normalized === '[video]' || normalized.startsWith('[video] ')) return 'video';
  if (normalized === '[audio]' || normalized.startsWith('[audio] ')) return 'audio';
  if (normalized === '[documento]' || normalized.startsWith('[documento] ')) return 'document';
  if (normalized === '[link]' || normalized.startsWith('[link] ')) return 'link';
  if (normalized === '[localizacao]' || normalized.startsWith('[localizacao] ')) return 'location';
  if (normalized === '[sticker]' || normalized.startsWith('[sticker] ')) return 'sticker';
  if (normalized === '[contato]' || normalized.startsWith('[contato] ')) return 'contact';
  if (normalized === '[enquete]' || normalized.startsWith('[enquete] ')) return 'poll';
  if (normalized === '[resposta]' || normalized.startsWith('[resposta] ')) return 'interactive';
  if (normalized === '[mensagem interativa]' || normalized.startsWith('[mensagem interativa] ')) return 'interactive';
  return null;
};

const CHAT_PREVIEW_ICON_CONFIG: Record<ChatPreviewIconType, { label: string; Icon: typeof FileImage }> = {
  image: { label: 'foto', Icon: FileImage },
  video: { label: 'vídeo', Icon: Images },
  audio: { label: 'áudio', Icon: FileAudio },
  document: { label: 'documento', Icon: FileText },
  link: { label: 'link', Icon: Link2 },
  location: { label: 'localização', Icon: MapPin },
  sticker: { label: 'figurinha', Icon: Sticker },
  contact: { label: 'contato', Icon: UserRound },
  poll: { label: 'enquete', Icon: Vote },
  interactive: { label: 'mensagem', Icon: MessageCircle },
};

function ChatPreviewIcon({ type }: { type: ChatPreviewIconType }) {
  const { label, Icon } = CHAT_PREVIEW_ICON_CONFIG[type];

  return (
    <span
      aria-label={label}
      className="inline-flex items-center gap-1 align-middle text-[var(--text-muted)]"
      role="img"
      title={label}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span>{label}</span>
    </span>
  );
}

const isVideoLikeMessageType = (messageType: string) => VIDEO_LIKE_MESSAGE_TYPES.has(messageType.trim().toLowerCase());

const isGalleryMediaMessage = (message: CommWhatsAppMessage) => GALLERY_MESSAGE_TYPES.has(message.message_type.trim().toLowerCase());

const getMessageVisibleCaption = (message: CommWhatsAppMessage) => {
  const directCaption = String(message.media_caption ?? '').trim();
  if (directCaption && !isMessageSummaryMarker(directCaption, message.message_type) && !isHiddenTechnicalMessageMarker(directCaption, message.message_type)) {
    return directCaption;
  }

  const fallbackText = String(message.text_content ?? '').trim();
  if (!fallbackText || isMessageSummaryMarker(fallbackText, message.message_type) || isHiddenTechnicalMessageMarker(fallbackText, message.message_type)) {
    return '';
  }

  const marker = getMessageSummaryMarker(message.message_type);
  if (message.message_type.trim().toLowerCase() !== 'text' && marker && fallbackText.startsWith(`${marker} `)) {
    return fallbackText.slice(marker.length).trim();
  }

  return fallbackText;
};

const getMessageEditableText = (message: CommWhatsAppMessage) => {
  const messageType = message.message_type.trim().toLowerCase();

  if (messageType === 'text') {
    return String(message.text_content ?? '').trim();
  }

  return getMessageVisibleCaption(message);
};

const normalizeComparableMessageText = (messageType: string, value: unknown) => {
  const text = String(value ?? '').trim();
  if (!text) return '';

  if (messageType.trim().toLowerCase() === 'text') {
    return text;
  }

  const marker = getMessageSummaryMarker(messageType);
  if (!marker) {
    return text;
  }

  if (text === marker) {
    return '';
  }

  if (text.startsWith(`${marker} `)) {
    return text.slice(marker.length).trim();
  }

  return text;
};

const getMessageSearchPreviewText = (message: CommWhatsAppMessage) => {
  const text = getVisiblePreviewText(getMessageEditableText(message), message.message_type);
  const marker = getVisiblePreviewText(getMessageSummaryMarker(message.message_type), message.message_type);
  return text || marker;
};

const canEditOutboundMessage = (message: CommWhatsAppMessage) => {
  if (message.direction !== 'outbound') {
    return false;
  }

  if (!message.external_message_id?.trim()) {
    return false;
  }

  if (message.delivery_status.trim().toLowerCase() === 'deleted') {
    return false;
  }

  return EDITABLE_OUTBOUND_MESSAGE_TYPES.has(message.message_type.trim().toLowerCase());
};

const canDeleteOutboundMessage = (message: CommWhatsAppMessage) => {
  return message.direction === 'outbound'
    && Boolean(message.external_message_id?.trim())
    && message.delivery_status.trim().toLowerCase() !== 'deleted';
};

const canReplyOrForwardMessage = (message: CommWhatsAppMessage) => {
  return message.direction !== 'system'
    && Boolean(message.external_message_id?.trim())
    && message.delivery_status.trim().toLowerCase() !== 'deleted';
};

const getQuotePayloadFromMessage = (message: CommWhatsAppMessage) => ({
  quotedMessageId: message.external_message_id?.trim() || '',
  quotedPreviewText: getMessageSearchPreviewText(message),
  quotedType: message.message_type.trim().toLowerCase(),
  quotedAuthorPhone: message.sender_phone?.trim() || '',
});

const getMessageTimestampMs = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const timestamp = parseCommMessageDate(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const splitIntoBatches = <T,>(items: T[], batchSize: number): T[][] => {
  if (items.length === 0 || batchSize <= 0) {
    return [];
  }

  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
};

const normalizeChatDraftPreview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= 100) {
    return normalized;
  }

  return `${normalized.slice(0, 97).trimEnd()}...`;
};

const normalizeInboxSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

const normalizeRenderableUrl = (value: string) => value.replace(/[),.;!?]+$/g, '');

const extractRenderableUrls = (value: string) => {
  return Array.from(value.matchAll(URL_PATTERN))
    .map((match) => {
      const raw = match[0] ?? '';
      const url = normalizeRenderableUrl(raw);
      const index = match.index ?? 0;
      if (!url) {
        return null;
      }

      return {
        index,
        raw,
        url,
      };
    })
    .filter((item): item is { index: number; raw: string; url: string } => Boolean(item));
};

type LinkifiedTextProps = {
  text: string;
  className?: string;
  linkClassName?: string;
};

type WhatsAppTextFormat = 'bold' | 'italic' | 'strike';

const WHATSAPP_TEXT_FORMAT_MARKERS: Array<{ marker: string; format: WhatsAppTextFormat }> = [
  { marker: '**', format: 'bold' },
  { marker: '__', format: 'italic' },
  { marker: '*', format: 'bold' },
  { marker: '_', format: 'italic' },
  { marker: '~', format: 'strike' },
];

const isWhitespace = (value: string | undefined) => !value || /\s/.test(value);

const findWhatsAppFormatMatch = (text: string, startIndex: number = 0): WhatsAppFormatMatch | null => {
  let bestMatch: WhatsAppFormatMatch | null = null;

  for (let index = startIndex; index < text.length; index += 1) {
    for (const candidate of WHATSAPP_TEXT_FORMAT_MARKERS) {
      const { marker, format } = candidate;
      if (!text.startsWith(marker, index) || isWhitespace(text[index + marker.length])) {
        continue;
      }

      let closingIndex = text.indexOf(marker, index + marker.length);
      while (closingIndex !== -1) {
        const content = text.slice(index + marker.length, closingIndex);
        if (content.trim() && !isWhitespace(text[closingIndex - 1])) {
          const match = { start: index, end: closingIndex, marker, format };
          if (!bestMatch || match.start < bestMatch.start || (match.start === bestMatch.start && marker.length > bestMatch.marker.length)) {
            bestMatch = match;
          }
          break;
        }

        closingIndex = text.indexOf(marker, closingIndex + marker.length);
      }
    }

    if (bestMatch?.start === index) {
      return bestMatch;
    }
  }

  return bestMatch;
};

const renderWhatsAppFormattedText = (text: string, keyPrefix: string, depth: number = 0): ReactNode[] => {
  if (!text || depth > 8) {
    return text ? [text] : [];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;

  while (cursor < text.length) {
    const match = findWhatsAppFormatMatch(text, cursor);
    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (match.start > cursor) {
      nodes.push(text.slice(cursor, match.start));
    }

    const contentStart = match.start + match.marker.length;
    const content = text.slice(contentStart, match.end);
    const children = renderWhatsAppFormattedText(content, `${keyPrefix}-${matchIndex}`, depth + 1);
    const key = `${keyPrefix}-${match.format}-${match.start}-${matchIndex}`;

    if (match.format === 'bold') {
      nodes.push(<strong key={key}>{children}</strong>);
    } else if (match.format === 'italic') {
      nodes.push(<em key={key}>{children}</em>);
    } else {
      nodes.push(<s key={key}>{children}</s>);
    }

    cursor = match.end + match.marker.length;
    matchIndex += 1;
  }

  return nodes;
};

type PointerAnchor = {
  x: number;
  y: number;
};

function LinkifiedText({ text, className, linkClassName }: LinkifiedTextProps) {
  const matches = extractRenderableUrls(text);

  if (matches.length === 0) {
    return <p className={className}>{renderWhatsAppFormattedText(text, 'text')}</p>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.index > cursor) {
      parts.push(...renderWhatsAppFormattedText(text.slice(cursor, match.index), `text-${index}`));
    }

    parts.push(
      <a
        key={`${match.url}-${index}`}
        href={match.url}
        target="_blank"
        rel="noreferrer"
        className={cx('underline underline-offset-2 decoration-current/40 hover:decoration-current break-all', linkClassName)}
      >
        {match.url}
      </a>,
    );

    cursor = match.index + match.raw.length;
  });

  if (cursor < text.length) {
    parts.push(...renderWhatsAppFormattedText(text.slice(cursor), 'text-tail'));
  }

  return <p className={className}>{parts}</p>;
}

const readRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const getMessageMetadataRecord = (message?: CommWhatsAppMessage | null) => readRecord(message?.metadata) ?? {};

const getMessageClientRequestId = (message?: CommWhatsAppMessage | null) => {
  const metadata = getMessageMetadataRecord(message);
  return String(metadata.client_request_id ?? metadata.clientRequestId ?? '').trim();
};

const getMessageClientOrderAt = (message?: CommWhatsAppMessage | null) => {
  const metadata = getMessageMetadataRecord(message);
  return String(metadata.client_order_at ?? metadata.clientOrderAt ?? '').trim();
};

const messagesReferToSameOutgoing = (left: CommWhatsAppMessage, right: CommWhatsAppMessage) => {
  if (messagesReferToSameDelivery(left, right)) return true;
  if (left.id === right.id) return true;
  return false;
};

const getMessageQuoteInfo = (message?: CommWhatsAppMessage | null): MessageQuoteInfo | null => {
  if (!message) {
    return null;
  }

  const quote = readRecord(getMessageMetadataRecord(message).quote);
  if (!quote) {
    return null;
  }

  const quotedType = String(quote.quoted_type ?? '').trim().toLowerCase() || null;
  const previewText = String(quote.preview_text ?? '').trim() || getMessageSummaryMarker(quotedType || 'text');
  const externalMessageId = String(quote.external_message_id ?? '').trim() || null;
  const authorPhone = String(quote.author_phone ?? '').trim() || null;

  if (!externalMessageId && !previewText && !authorPhone && !quotedType) {
    return null;
  }

  return {
    externalMessageId,
    authorPhone,
    quotedType,
    previewText,
  };
};

const hasMessageQuote = (message?: CommWhatsAppMessage | null) => Boolean(getMessageQuoteInfo(message));

const getMessageContactCardInfo = (message?: CommWhatsAppMessage | null): MessageContactCardInfo | null => {
  if (!message) {
    return null;
  }

  const messageType = message.message_type.trim().toLowerCase();
  const contactCard = readRecord(getMessageMetadataRecord(message).contact_card);
  const kind = String(contactCard?.kind ?? '').trim().toLowerCase();

  if (kind !== 'contact' && kind !== 'contact_list') {
    if (messageType !== 'contact' && messageType !== 'contact_list') {
      return null;
    }

    const fallbackText = String(message.text_content ?? '').trim();
    return {
      kind: messageType as 'contact' | 'contact_list',
      count: messageType === 'contact' ? 1 : 0,
      items: fallbackText && !isMessageSummaryMarker(fallbackText, message.message_type)
        ? [{ name: fallbackText, phoneNumber: null }]
        : [],
    };
  }

  const items = Array.isArray(contactCard?.items)
    ? contactCard.items
        .map((item) => {
          const record = readRecord(item);
          if (!record) return null;

          const name = String(record.name ?? '').trim() || null;
          const phoneNumber = String(record.phone_number ?? '').trim() || null;
          if (!name && !phoneNumber) return null;

          return { name, phoneNumber };
        })
        .filter((item): item is { name: string | null; phoneNumber: string | null } => Boolean(item))
    : [];

  const rawCount = Number(contactCard?.count ?? items.length);
  const count = Number.isFinite(rawCount)
    ? Math.max(items.length, Math.max(0, Math.round(rawCount)))
    : items.length;

  return {
    kind: kind as 'contact' | 'contact_list',
    count: count || (kind === 'contact' ? 1 : 0),
    items,
  };
};

const getMessageMetadataSignature = (message: CommWhatsAppMessage) => {
  const metadata = getMessageMetadataRecord(message);
  return JSON.stringify({
    quote: readRecord(metadata.quote),
    contact_card: readRecord(metadata.contact_card),
  });
};

const createVirtualAnchorRect = (anchor: PointerAnchor) => ({
  left: anchor.x,
  right: anchor.x,
  top: anchor.y,
  bottom: anchor.y,
  width: 0,
  height: 0,
});

const getMessageLinkPreview = (message: CommWhatsAppMessage) => {
  const metadata = getMessageMetadataRecord(message);
  const preview = metadata.link_preview;
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
    return null;
  }

  const record = preview as Record<string, unknown>;
  const url = String(record.url ?? record.link ?? record.canonical ?? '').trim();
  const title = String(record.title ?? '').trim();
  const description = String(record.description ?? '').trim();
  const canonical = String(record.canonical ?? '').trim();
  const body = String(record.body ?? '').trim();
  const previewImage = String(record.preview ?? '').trim();

  if (!url && !title && !description && !previewImage && !body) {
    return null;
  }

  let domain = '';
  try {
    const parsed = new URL(canonical || url);
    domain = parsed.hostname.replace(/^www\./i, '');
  } catch {
    domain = '';
  }

  return {
    url: url || canonical || null,
    title: title || null,
    description: description || null,
    body: body || null,
    previewImage: previewImage || null,
    domain: domain || null,
  };
};

const collectPhoneLookupKeys = (value?: string | null) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) {
    return [] as string[];
  }

  const keys = new Set<string>();

  const appendKey = (candidate?: string | null) => {
    const normalized = String(candidate ?? '').replace(/\D/g, '');
    if (!normalized) {
      return;
    }

    keys.add(normalized);
  };

  const appendBrazilMobileVariants = (candidate: string) => {
    if (candidate.length === 10) {
      const mobilePrefix = candidate[2] ?? '';
      if (/[6-9]/.test(mobilePrefix)) {
        appendKey(`${candidate.slice(0, 2)}9${candidate.slice(2)}`);
      }
      return;
    }

    if (candidate.length === 11) {
      const ninthDigit = candidate[2] ?? '';
      const mobilePrefix = candidate[3] ?? '';
      if (ninthDigit === '9' && /[6-9]/.test(mobilePrefix)) {
        appendKey(`${candidate.slice(0, 2)}${candidate.slice(3)}`);
      }
    }
  };

  appendKey(digits);

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const nationalDigits = digits.slice(2);
    appendKey(nationalDigits);
    appendBrazilMobileVariants(nationalDigits);
    for (const variant of Array.from(keys)) {
      if (!variant.startsWith('55') && (variant.length === 10 || variant.length === 11)) {
        appendKey(`55${variant}`);
      }
    }
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    appendKey(`55${digits}`);
    appendBrazilMobileVariants(digits);
    for (const variant of Array.from(keys)) {
      if (!variant.startsWith('55') && (variant.length === 10 || variant.length === 11)) {
        appendKey(`55${variant}`);
      }
    }
  }

  return Array.from(keys);
};

const addSavedContactsToNameMap = (target: Map<string, string>, contacts: CommWhatsAppPhoneContact[]) => {
  for (const contact of contacts) {
    const name = contact.display_name?.trim();
    if (!name) {
      continue;
    }

    for (const key of collectPhoneLookupKeys(contact.phone_digits || contact.phone_number)) {
      target.set(key, name);
    }
  }
};

const getActiveQuickReplyMatch = (value: string, selection: ComposerSelection): QuickReplyCommandMatch | null => {
  if (selection.start !== selection.end) {
    return null;
  }

  const cursor = Math.max(0, Math.min(selection.start, value.length));
  const textBeforeCursor = value.slice(0, cursor);
  const slashIndex = textBeforeCursor.lastIndexOf('/');

  if (slashIndex < 0) {
    return null;
  }

  const query = textBeforeCursor.slice(slashIndex + 1);
  if (/\s/.test(query)) {
    return null;
  }

  if (slashIndex > 0) {
    const previousCharacter = textBeforeCursor[slashIndex - 1] ?? '';
    if (!/\s/.test(previousCharacter)) {
      return null;
    }
  }

  return {
    query,
    start: slashIndex,
    end: cursor,
  };
};

const formatMessageTime = (value?: string | null) => {
  const date = parseCommMessageDate(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const parseCommMessageDate = (value?: string | null) => {
  if (!value) return new Date(Number.NaN);

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = String(value).trim();
  const withoutTimezone = normalized.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/);
  if (withoutTimezone) {
    const fallback = new Date(`${normalized.replace(' ', 'T')}Z`);
    if (!Number.isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  return new Date(Number.NaN);
};

const getComparableMessageTimestampMs = (message: Pick<CommWhatsAppMessage, 'message_at' | 'created_at' | 'metadata'>) => {
  const clientOrderTimestamp = getMessageTimestampMs(getMessageClientOrderAt(message as CommWhatsAppMessage));
  if (clientOrderTimestamp !== null) {
    return clientOrderTimestamp;
  }

  const messageTimestamp = getMessageTimestampMs(message.message_at);
  if (messageTimestamp !== null) {
    return messageTimestamp;
  }

  return getMessageTimestampMs(message.created_at);
};

const normalizeSystemTimeZone = (value: unknown) => {
  const candidate = String(value ?? '').trim();
  if (!candidate) {
    return DEFAULT_TRANSCRIPT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TRANSCRIPT_TIME_ZONE;
  }
};

const getTranscriptDateTimeParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
    hour: read('hour'),
    minute: read('minute'),
  };
};

const formatTranscriptTimestamp = (value: string, timeZone: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '[--:--, --/--/----]';
  }

  const parts = getTranscriptDateTimeParts(date, timeZone);
  return `[${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}]`;
};

const normalizeTranscriptText = (value?: string | null) => String(value ?? '').replace(/\s+/g, ' ').trim();

const getUnknownMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();
  if (!normalized) {
    return '[Mensagem sem conteudo]';
  }

  return `[${normalized}]`;
};

const getDeletedMessageMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();

  switch (normalized) {
    case 'image':
      return '[Imagem apagada]';
    case 'video':
    case 'gif':
    case 'short':
      return '[Video apagado]';
    case 'audio':
    case 'voice':
      return '[Audio apagado]';
    case 'document':
      return '[Documento apagado]';
    case 'sticker':
      return '[Sticker apagado]';
    case 'contact':
    case 'contact_list':
      return '[Contato apagado]';
    case 'poll':
      return '[Enquete apagada]';
    default:
      return '[Mensagem apagada]';
  }
};

const buildDeletedMessageSummary = (messageType: string, preservedText?: string | null) => {
  const normalizedText = String(preservedText ?? '').trim();
  if (normalizedText) {
    return `[Apagada] ${normalizedText}`;
  }

  return getDeletedMessageMarker(messageType);
};

const buildTranscriptContent = (message: CommWhatsAppMessage) => {
  if (shouldHideTechnicalMessage(message)) {
    return '';
  }

  if (message.direction === 'system') {
    return '';
  }

  if (message.direction === 'outbound' && message.delivery_status.trim().toLowerCase() === 'failed') {
    return '';
  }

  const text = normalizeTranscriptText(message.text_content);
  const caption = normalizeTranscriptText(message.media_caption);
  const transcription = normalizeTranscriptText(message.transcription_text);
  const kind = message.message_type.trim().toLowerCase();
  const isDeleted = message.delivery_status.trim().toLowerCase() === 'deleted';
  const visibleText = isHiddenTechnicalMessageMarker(text, message.message_type) ? '' : text;
  const visibleCaption = isHiddenTechnicalMessageMarker(caption, message.message_type) ? '' : caption;

  const withDeletedFlag = (content: string) => {
    if (!isDeleted) {
      return content;
    }

    return content ? `[Mensagem apagada] ${content}` : getDeletedMessageMarker(kind);
  };

  if (kind === 'text') {
    return withDeletedFlag(visibleText);
  }

  if (kind === 'image') {
    return withDeletedFlag(visibleCaption ? `[Imagem] ${visibleCaption}` : '[Imagem]');
  }

  if (kind === 'video' || kind === 'gif' || kind === 'short') {
    return withDeletedFlag(visibleCaption ? `[Video] ${visibleCaption}` : '[Video]');
  }

  if (kind === 'document') {
    return withDeletedFlag(visibleCaption ? `[Documento] ${visibleCaption}` : '[Documento]');
  }

  if (kind === 'audio' || kind === 'voice') {
    return withDeletedFlag(transcription || AUDIO_WITHOUT_TRANSCRIPTION_MARKER);
  }

  if (visibleCaption) {
    return withDeletedFlag(visibleCaption);
  }

  if (visibleText) {
    return withDeletedFlag(visibleText);
  }

  if (transcription) {
    return withDeletedFlag(transcription);
  }

  return withDeletedFlag(getUnknownMessageMarker(kind));
};

const buildTranscriptLine = (message: CommWhatsAppMessage, leadLabel: string, timeZone: string) => {
  const content = buildTranscriptContent(message);
  if (!content) {
    return null;
  }

  const author = message.direction === 'outbound' ? 'Eu' : leadLabel;
  return `${formatTranscriptTimestamp(message.message_at, timeZone)} ${author}: ${content}`;
};

const getMessageDayKey = (value?: string | null) => {
  if (!value) return '';

  const date = parseCommMessageDate(value);
  if (Number.isNaN(date.getTime())) return '';

  return getDateKey(date, SAO_PAULO_TIMEZONE);
};

const formatMessageDaySeparatorLabel = (value?: string | null) => {
  if (!value) return '';

  const date = parseCommMessageDate(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const todayKey = getDateKey(today, SAO_PAULO_TIMEZONE);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday, SAO_PAULO_TIMEZONE);
  const targetKey = getDateKey(date, SAO_PAULO_TIMEZONE);

  if (targetKey === todayKey) {
    return 'Hoje';
  }

  if (targetKey === yesterdayKey) {
    return 'Ontem';
  }

  const diffDays = Math.round((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: SAO_PAULO_TIMEZONE }).format(date);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatConnectionStatusLabel = (value?: string | null, fallback = 'Indisponível') => {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (!normalized) {
    return fallback;
  }

  switch (normalized) {
    case 'AUTH':
      return 'Conectado';
    case 'QR':
      return 'Aguardando QR';
    case 'LAUNCH':
      return 'Conectando';
    case 'INIT':
      return 'Inicializando';
    case 'STOP':
      return 'Parado';
    case 'DISCONNECTED':
      return 'Desconectado';
    default:
      return normalized;
  }
};

const getMessageBubbleClasses = (direction: CommWhatsAppMessage['direction']) => {
  if (direction === 'outbound') {
    return 'message-bubble message-bubble-outbound ml-auto';
  }

  if (direction === 'system') {
    return 'message-bubble message-bubble-system mx-auto';
  }

  return 'message-bubble message-bubble-inbound mr-auto';
};

const DEFAULT_WAVEFORM = [0.24, 0.36, 0.52, 0.72, 0.46, 0.62, 0.28, 0.54, 0.4, 0.66, 0.32, 0.58, 0.42, 0.74, 0.38, 0.5, 0.3, 0.64, 0.44, 0.56];

const inboxInlineActionClassName = getPanelButtonClass({
  variant: 'soft',
  size: 'sm',
  className: 'h-8 rounded-xl px-3 text-[11px] font-semibold',
});

const compareMessageChronology = (a: CommWhatsAppMessage, b: CommWhatsAppMessage) => {
  const aTime = getComparableMessageTimestampMs(a) ?? 0;
  const bTime = getComparableMessageTimestampMs(b) ?? 0;
  const timeDiff = aTime - bTime;
  if (timeDiff !== 0) {
    return timeDiff;
  }

  const aCreatedTime = getMessageTimestampMs(a.created_at) ?? 0;
  const bCreatedTime = getMessageTimestampMs(b.created_at) ?? 0;
  const createdDiff = aCreatedTime - bCreatedTime;
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return a.id.localeCompare(b.id);
};

const mergeMessages = (existing: CommWhatsAppMessage[], incoming: CommWhatsAppMessage[]) => {
  return mergeCommWhatsAppMessages(existing, incoming).sort(compareMessageChronology);
};

const getObviousDuplicateMessageKey = (message: CommWhatsAppMessage) => {
  if (message.direction === 'system') {
    return '';
  }

  const messageAtMs = getMessageTimestampMs(message.message_at);
  if (messageAtMs === null) {
    return '';
  }

  const text = normalizeQuickReplyLookup(getMessageSearchPreviewText(message)).replace(/\s+/g, ' ').trim();
  if (text.length < 12) {
    return '';
  }

  const messageAtSecond = Math.floor(messageAtMs / 1000);
  const sender = normalizeQuickReplyLookup(String(message.sender_phone ?? message.sender_name ?? ''));
  return [message.chat_id, message.direction, message.message_type.trim().toLowerCase(), messageAtSecond, sender, text].join(':');
};

const pickMoreCompleteDuplicateMessage = (current: CommWhatsAppMessage, candidate: CommWhatsAppMessage) => {
  const currentExternalId = String(current.external_message_id ?? '').trim();
  const candidateExternalId = String(candidate.external_message_id ?? '').trim();

  if (!currentExternalId && candidateExternalId) {
    return candidate;
  }

  if (!current.media_id && candidate.media_id) {
    return candidate;
  }

  if (!current.transcription_text && candidate.transcription_text) {
    return candidate;
  }

  return current;
};

const dedupeObviousDuplicateMessages = (items: CommWhatsAppMessage[]) => {
  const bySemanticKey = new Map<string, CommWhatsAppMessage>();
  const passthrough: CommWhatsAppMessage[] = [];

  for (const message of items) {
    const key = getObviousDuplicateMessageKey(message);
    if (!key) {
      passthrough.push(message);
      continue;
    }

    const current = bySemanticKey.get(key);
    bySemanticKey.set(key, current ? pickMoreCompleteDuplicateMessage(current, message) : message);
  }

  return [...passthrough, ...bySemanticKey.values()].sort(compareMessageChronology);
};

const REDUNDANT_ACTION_MESSAGE_MARKERS = new Set([
  '[acao]',
  '[ação]',
  '[reacao]',
  '[reação]',
  '[mensagem apagada]',
  '[atualizacao de midia]',
  '[atualização de mídia]',
  '[voto em enquete]',
]);

const shouldHideTechnicalMessage = (message: CommWhatsAppMessage) => {
  const messageType = message.message_type.trim().toLowerCase();
  const textContent = String(message.text_content ?? '').trim();

  if (messageType === 'action') {
    const normalizedText = normalizeQuickReplyLookup(textContent).replace(/\s+/g, ' ').trim();
    return !normalizedText || REDUNDANT_ACTION_MESSAGE_MARKERS.has(normalizedText) || isHiddenTechnicalMessageMarker(textContent, message.message_type);
  }

  if (!isHiddenTechnicalMessageMarker(textContent, message.message_type)) {
    return false;
  }

  const hasRenderableMedia = Boolean(message.media_id || message.media_url);
  const hasVisibleCaption = Boolean(getMessageVisibleCaption(message));
  const hasStructuredPreview = Boolean(getMessageLinkPreview(message) || getMessageContactCardInfo(message) || hasMessageQuote(message));

  return !hasRenderableMedia && !hasVisibleCaption && !hasStructuredPreview;
};

const compareChatsByInboxOrder = (a: CommWhatsAppChat, b: CommWhatsAppChat) => {
  if (a.is_pinned !== b.is_pinned) {
    return a.is_pinned ? -1 : 1;
  }

  if (a.is_pinned && b.is_pinned) {
    const aPinnedAt = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
    const bPinnedAt = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
    if (aPinnedAt !== bPinnedAt) {
      return bPinnedAt - aPinnedAt;
    }
  }

  const aTime = getMessageTimestampMs(a.last_message_at) ?? 0;
  const bTime = getMessageTimestampMs(b.last_message_at) ?? 0;
  return bTime - aTime;
};

const sortChatsByInboxOrder = (items: CommWhatsAppChat[]) => [...items].sort(compareChatsByInboxOrder);

const waitForChatListRetry = (delayMs: number) => new Promise((resolve) => window.setTimeout(resolve, delayMs));

const inferAttachmentKind = (file: File): CommWhatsAppMediaSendKind => {
  if (file.type.startsWith('image/')) {
    return 'image';
  }

  if (file.type.startsWith('video/')) {
    return 'video';
  }

  if (file.type.startsWith('audio/')) {
    return 'audio';
  }

  return 'document';
};

const createPendingAttachmentFromFile = (file: File): PendingAttachment => {
  const kind = inferAttachmentKind(file);
  return {
    id: createPendingAttachmentId(),
    file,
    kind,
    previewUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null,
  };
};

const normalizePastedImageFile = (file: File, index: number) => {
  if (file.name.trim()) {
    return file;
  }

  const extension = file.type.split('/')[1]?.split(';')[0] || 'png';
  return new File([file], `imagem-colada-${Date.now()}-${index + 1}.${extension}`, { type: file.type || 'image/png' });
};

const formatFileSize = (value?: number | null) => {
  if (!value || value <= 0) return '';

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${value} B`;
};

const getEditedMessageInfo = (message?: CommWhatsAppMessage | null) => {
  if (!message) {
    return {
      edited: false,
      originalText: null,
      previousText: null,
      currentText: null,
      editedAt: null,
    };
  }

  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata as Record<string, unknown>
    : {};
  const messageType = message.message_type.trim().toLowerCase();
  const currentText = getMessageEditableText(message) || normalizeComparableMessageText(message.message_type, message.text_content);
  const originalText = normalizeComparableMessageText(message.message_type, metadata.original_text_content);
  const editHistory = Array.isArray(metadata.edit_history)
    ? metadata.edit_history.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    : [];
  const lastEdit = editHistory.length > 0 ? editHistory[editHistory.length - 1] : null;
  const previousText = normalizeComparableMessageText(message.message_type, lastEdit?.previous_text) || originalText || null;
  const visibleCurrentText = getMessageEditableText(message) || currentText || null;
  const editedAt = String(metadata.edited_at ?? '').trim() || null;
  const inferredTextEdit = messageType === 'text' && Boolean(originalText && originalText !== visibleCurrentText);
  const edited = metadata.edited === true || Boolean(editedAt) || editHistory.length > 0 || inferredTextEdit;

  return {
    edited,
    originalText: originalText && originalText !== currentText ? originalText : null,
    previousText: previousText && previousText !== visibleCurrentText ? previousText : null,
    currentText: visibleCurrentText,
    editedAt,
  };
};

const getDeletedMessageInfo = (message?: CommWhatsAppMessage | null) => {
  if (!message) {
    return {
      deleted: false,
      deletedAt: null,
      deletedBy: null,
      preservedText: '[Mensagem apagada]',
    };
  }

  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata as Record<string, unknown>
    : {};
  const currentText = String(message.text_content ?? message.media_caption ?? '').trim();
  const originalText = String(metadata.deleted_original_text_content ?? '').trim();
  const deletedAt = String(metadata.deleted_at ?? '').trim() || null;
  const deletedBy = String(metadata.deleted_by ?? '').trim() || null;
  const deleted = message.delivery_status.trim().toLowerCase() === 'deleted' || metadata.deleted === true;

  return {
    deleted,
    deletedAt,
    deletedBy,
    preservedText: originalText || currentText || getDeletedMessageMarker(message.message_type),
  };
};

const getMessageReactions = (message?: CommWhatsAppMessage | null) => {
  if (!message) {
    return [];
  }

  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata as Record<string, unknown>
    : {};
  const rawReactions = Array.isArray(metadata.reactions) ? metadata.reactions : [];

  const normalized = rawReactions
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => ({
      emoji: String(item.emoji ?? '').trim(),
      fromMe: item.from_me === true,
      reactedAt: String(item.reacted_at ?? '').trim(),
      actorLabel: item.from_me === true
        ? 'Você'
        : String(item.from_name ?? item.from ?? '').trim() || 'Contato',
    }))
    .filter((item) => Boolean(item.emoji));

  const grouped = new Map<string, { emoji: string; count: number; fromMe: boolean; actors: string[] }>();
  for (const reaction of normalized) {
    const current = grouped.get(reaction.emoji);
    if (current) {
      current.count += 1;
      current.fromMe = current.fromMe || reaction.fromMe;
      if (!current.actors.includes(reaction.actorLabel)) {
        current.actors.push(reaction.actorLabel);
      }
    } else {
      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        fromMe: reaction.fromMe,
        actors: [reaction.actorLabel],
      });
    }
  }

  return Array.from(grouped.values()).sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji, 'pt-BR'));
};

const getReactionTooltipText = (message?: CommWhatsAppMessage | null) => {
  if (!message) {
    return '';
  }

  const chatId = String(message.metadata?.chat_id ?? '').trim().toLowerCase();
  if (!chatId.endsWith('@g.us')) {
    return '';
  }

  const reactions = getMessageReactions(message);
  if (reactions.length === 0) {
    return '';
  }

  return reactions
    .map((reaction) => `${reaction.emoji} ${reaction.actors.join(', ')}`)
    .join('\n');
};

const getOwnReactionEmoji = (message?: CommWhatsAppMessage | null) => {
  if (!message) {
    return null;
  }

  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata as Record<string, unknown>
    : {};
  const rawReactions = Array.isArray(metadata.reactions) ? metadata.reactions : [];

  const ownReaction = rawReactions
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .find((item) => String(item.actor_key ?? '').trim() === 'self');

  return ownReaction ? String(ownReaction.emoji ?? '').trim() || null : null;
};

const getValidWhatsAppDisplayName = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }

  const withoutPhoneSymbols = normalized.replace(/[\s()+-]/g, '');
  if (/^\+?\d+$/.test(withoutPhoneSymbols)) {
    return '';
  }

  return /[\p{L}\p{N}]/u.test(normalized) ? normalized : '';
};

const getSafeChatDisplayName = (chat: CommWhatsAppChat | null, connectedUserName?: string | null, leadName?: string | null) => {
  if (!chat) {
    return 'Conversa';
  }

  const displayName = getValidWhatsAppDisplayName(chat.display_name);
  const pushName = getValidWhatsAppDisplayName(chat.push_name);
  const ownName = String(connectedUserName ?? '').trim().toLowerCase();
  const isOwnNameLeak = !chat.saved_contact_name && !chat.lead_id && displayName && ownName && displayName.toLowerCase() === ownName;

  if (displayName && !isOwnNameLeak) {
    return displayName;
  }

  const resolvedLeadName = getValidWhatsAppDisplayName(leadName) || getValidWhatsAppDisplayName(chat.lead_name);
  if (resolvedLeadName) {
    return resolvedLeadName;
  }

  return pushName || formatCommWhatsAppPhoneLabel(chat.phone_number);
};

const stabilizeChatIdentityForLocalMerge = (incoming: CommWhatsAppChat, previous?: CommWhatsAppChat | null): CommWhatsAppChat => {
  const savedContactName = getValidWhatsAppDisplayName(incoming.saved_contact_name) || getValidWhatsAppDisplayName(previous?.saved_contact_name);
  const leadName = getValidWhatsAppDisplayName(incoming.lead_name) || getValidWhatsAppDisplayName(previous?.lead_name);
  const pushName = getValidWhatsAppDisplayName(incoming.push_name) || getValidWhatsAppDisplayName(previous?.push_name);
  const displayName = getValidWhatsAppDisplayName(incoming.display_name);

  if (savedContactName) {
    return {
      ...incoming,
      saved_contact_name: savedContactName,
      display_name: displayName || savedContactName,
    };
  }

  if (leadName && (!displayName || displayName === pushName)) {
    return {
      ...incoming,
      lead_name: leadName,
      display_name: leadName,
    };
  }

  return incoming;
};

const getChatSearchCandidates = (chat: CommWhatsAppChat, connectedUserName?: string | null) => {
  const values = [
    getSafeChatDisplayName(chat, connectedUserName),
    chat.saved_contact_name,
    chat.lead_name,
    chat.display_name,
    chat.push_name,
  ];

  const uniqueValues = new Set<string>();
  values.forEach((value) => {
    const normalized = normalizeInboxSearch(String(value ?? ''));
    if (normalized) {
      uniqueValues.add(normalized);
    }
  });

  return Array.from(uniqueValues);
};

const getChatSearchRank = (chat: CommWhatsAppChat, query: string, connectedUserName?: string | null) => {
  const normalizedQuery = normalizeInboxSearch(query);
  const digitQuery = query.replace(/\D/g, '');

  if (!normalizedQuery && !digitQuery) {
    return 0;
  }

  const nameCandidates = getChatSearchCandidates(chat, connectedUserName);
  const phoneLabel = normalizeInboxSearch(formatCommWhatsAppPhoneLabel(chat.phone_number));
  const phoneDigits = String(chat.phone_digits || chat.phone_number || '').replace(/\D/g, '');

  if (normalizedQuery) {
    if (nameCandidates.some((candidate) => candidate.startsWith(normalizedQuery))) return 0;
    if (nameCandidates.some((candidate) => candidate.split(/\s+/).some((part) => part.startsWith(normalizedQuery)))) return 1;
    if (nameCandidates.some((candidate) => candidate.includes(normalizedQuery))) return 2;
    if (phoneLabel.includes(normalizedQuery)) return 5;
  }

  if (digitQuery) {
    if (phoneDigits.startsWith(digitQuery)) return 3;
    if (phoneDigits.includes(digitQuery)) return 4;
  }

  return null;
};

const rankChatsBySearch = (items: CommWhatsAppChat[], query: string, connectedUserName?: string | null) => items
  .map((chat) => ({
    chat,
    rank: getChatSearchRank(chat, query, connectedUserName),
  }))
  .filter((item): item is { chat: CommWhatsAppChat; rank: number } => item.rank !== null)
  .sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }

    return compareChatsByInboxOrder(a.chat, b.chat);
  })
  .map((item) => item.chat);

const mergeUniqueChats = (...collections: CommWhatsAppChat[][]) => {
  const chatsById = new Map<string, CommWhatsAppChat>();
  collections.forEach((items) => {
    items.forEach((chat) => {
      if (!chatsById.has(chat.id)) {
        chatsById.set(chat.id, chat);
      }
    });
  });

  return Array.from(chatsById.values());
};

const getDeliveryStatusMetaFromValues = (deliveryStatus?: string | null, messageType?: string | null) => {
  const status = String(deliveryStatus ?? '').trim().toLowerCase();

  switch (status) {
    case 'pending':
      return { icon: Clock3, label: 'Enviando', tone: 'pending' as const };
    case 'sent':
      return { icon: Check, label: 'Enviado', tone: 'sent' as const };
    case 'delivered':
      return { icon: CheckCheck, label: 'Entregue', tone: 'delivered' as const };
    case 'read':
      return { icon: CheckCheck, label: 'Vista', tone: 'read' as const };
    case 'played':
      return {
        icon: Volume2,
        label: messageType === 'voice' ? 'Ouvida' : 'Reproduzida',
        tone: 'played' as const,
      };
    case 'failed':
      return { icon: AlertCircle, label: 'Falhou', tone: 'failed' as const };
    case 'deleted':
      return { icon: AlertTriangle, label: 'Apagada', tone: 'deleted' as const };
    default:
      return { icon: Clock3, label: status || 'Pendente', tone: 'pending' as const };
  }
};

const getDeliveryStatusMeta = (message: CommWhatsAppMessage) => getDeliveryStatusMetaFromValues(message.delivery_status, message.message_type);

const formatDurationLabel = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${mins}:${secs}`;
};

function WaveformBars({ bars, active = false }: { bars?: number[]; active?: boolean }) {
  const resolvedBars = bars && bars.length > 0 ? bars : DEFAULT_WAVEFORM;

  return (
    <div className={`whatsapp-inbox-waveform ${active ? 'is-active' : ''}`} aria-hidden="true">
      {resolvedBars.map((bar, index) => (
        <span
          key={index}
          className="whatsapp-inbox-waveform-bar"
          style={{
            height: `${Math.max(16, Math.round(bar * 34))}px`,
            animationDelay: `${index * 24}ms`,
          }}
        />
      ))}
    </div>
  );
}

function useResolvedMediaUrl(message: CommWhatsAppMessage) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(commWhatsAppService.getRememberedLocalMediaPreview(message.external_message_id) ?? (!message.media_id ? message.media_url ?? null : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;

    const rememberedPreview = commWhatsAppService.getRememberedLocalMediaPreview(message.external_message_id);
    if (rememberedPreview) {
      setMediaUrl(rememberedPreview);
      setLoading(false);
      setError(null);

      if (!message.media_id || (message.external_message_id && message.media_id === message.external_message_id)) {
        return () => {
          active = false;
        };
      }
    }

    if (message.media_id && message.external_message_id && message.media_id === message.external_message_id) {
      setMediaUrl(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    if (!message.media_id) {
      setMediaUrl(message.media_url?.trim() || null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    void commWhatsAppService
      .resolveMediaObjectUrl({ mediaId: message.media_id, mediaUrl: message.media_url })
      .then((resolved) => {
        if (!active) return;
        setMediaUrl(resolved);
      })
      .catch((resolveError) => {
        if (!active) return;
        const resolvedMessage = resolveError instanceof Error ? resolveError.message : 'Não foi possível carregar a mídia.';
        setError(resolvedMessage.includes('specified media not found') ? 'Arquivo indisponível no momento.' : resolvedMessage);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [message.external_message_id, message.media_id, message.media_url, retryNonce]);

  const retry = useCallback(() => {
    setError(null);
    setRetryNonce((current) => current + 1);
  }, []);

  return { mediaUrl, loading, error, retry };
}

const isChatMediaViewerMessage = (message: CommWhatsAppMessage) => {
  const kind = message.message_type.trim().toLowerCase();
  return (kind === 'image' || isVideoLikeMessageType(kind)) && message.delivery_status.trim().toLowerCase() !== 'deleted';
};

function WhatsAppMediaViewerThumb({
  message,
  active,
  onSelect,
}: {
  message: CommWhatsAppMessage;
  active: boolean;
  onSelect: (messageId: string) => void;
}) {
  const { mediaUrl, loading } = useResolvedMediaUrl(message);
  const isVideo = isVideoLikeMessageType(message.message_type);

  return (
    <button
      type="button"
      onClick={() => onSelect(message.id)}
      className={`whatsapp-inbox-media-viewer-thumb relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-all duration-200 ${active ? 'is-active scale-110 ring-2 ring-[var(--success)] ring-offset-2 ring-offset-[var(--bg-canvas)]' : 'opacity-60 hover:opacity-90'}`}
      aria-label="Abrir mídia"
      aria-current={active ? 'true' : undefined}
    >
      {mediaUrl ? (
        isVideo ? (
          <video muted playsInline preload="metadata" className="h-full w-full object-cover">
            <source src={mediaUrl} type={message.media_mime_type || undefined} />
          </video>
        ) : (
          <img src={mediaUrl} alt={message.media_file_name || 'Imagem'} className="h-full w-full object-cover" loading="lazy" />
        )
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[var(--bg-elevated)] text-[10px] text-[var(--text-muted)]">
          {loading ? '...' : 'Mídia'}
        </span>
      )}
      {isVideo ? (
        <span className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg-canvas)_20%,transparent)] text-[var(--text-primary)]">
          <Play className="h-4 w-4 fill-current" />
        </span>
      ) : null}
    </button>
  );
}

function WhatsAppMediaViewer({
  messages,
  selectedMessageId,
  contactName,
  onSelect,
  onClose,
}: {
  messages: CommWhatsAppMessage[];
  selectedMessageId: string;
  contactName: string;
  onSelect: (messageId: string) => void;
  onClose: () => void;
}) {
  const selectedIndex = Math.max(0, messages.findIndex((message) => message.id === selectedMessageId));
  const selectedMessage = messages[selectedIndex] ?? messages[0];
  const { mediaUrl, loading, error } = useResolvedMediaUrl(selectedMessage);
  const isVideo = selectedMessage ? isVideoLikeMessageType(selectedMessage.message_type) : false;
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < messages.length - 1;
  const selectedName = selectedMessage?.media_file_name || (isVideo ? 'Vídeo' : 'Imagem');
  const selectedAuthor = selectedMessage?.direction === 'outbound' ? 'Você' : contactName;
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setRotation(0);
  }, [selectedMessageId]);

  const goToIndex = useCallback((nextIndex: number) => {
    const nextMessage = messages[nextIndex];
    if (nextMessage) {
      onSelect(nextMessage.id);
    }
  }, [messages, onSelect]);

  const scrollThumbnails = useCallback((direction: 'previous' | 'next') => {
    const target = thumbnailStripRef.current;
    if (!target) {
      return;
    }

    const amount = Math.max(260, target.clientWidth * 0.72);
    target.scrollBy({ left: direction === 'previous' ? -amount : amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault();
        goToIndex(selectedIndex - 1);
      }

      if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        goToIndex(selectedIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrevious, goToIndex, onClose, selectedIndex]);

  if (!selectedMessage) {
    return null;
  }

  const viewer = (
    <div className="whatsapp-inbox-media-viewer modal-theme-host painel-theme kifer-ds fixed inset-0 z-[2147483000] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]" role="dialog" aria-modal="true">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{selectedAuthor}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{formatMessageDaySeparatorLabel(selectedMessage.message_at)} às {formatMessageTime(selectedMessage.message_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {mediaUrl && !isVideo ? (
            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 1) % 4)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Rotacionar imagem"
              title={`Rotacionar (${rotation * 90}°)`}
            >
              <RotateCw className="h-5 w-5" />
            </button>
          ) : null}
          {mediaUrl ? (
            <a
              href={mediaUrl}
              download={selectedName}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Baixar mídia"
              title="Baixar"
            >
              <Download className="h-5 w-5" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-5">
        {canGoPrevious ? (
          <button
            type="button"
            onClick={() => goToIndex(selectedIndex - 1)}
            className="whatsapp-inbox-media-viewer-nav left-4"
            aria-label="Mídia anterior"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        ) : null}

        <div className="flex h-full w-full items-center justify-center">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando mídia...
            </div>
          ) : mediaUrl ? (
            isVideo ? (
              <video controls autoPlay className="max-h-full max-w-full bg-black object-contain">
                <source src={mediaUrl} type={selectedMessage.media_mime_type || undefined} />
              </video>
            ) : (
              <img
                src={mediaUrl}
                alt={selectedName}
                className="max-h-full max-w-full object-contain transition-transform duration-300"
                style={{ transform: `rotate(${rotation * 90}deg)` }}
              />
            )
          ) : (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-5 py-4 text-sm text-[var(--text-secondary)]">
              {error || 'Mídia indisponível no momento.'}
            </div>
          )}
        </div>

        {canGoNext ? (
          <button
            type="button"
            onClick={() => goToIndex(selectedIndex + 1)}
            className="whatsapp-inbox-media-viewer-nav right-4"
            aria-label="Próxima mídia"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        ) : null}
      </main>

      {messages.length > 1 ? (
        <footer className="whatsapp-inbox-media-viewer-strip relative shrink-0 border-t border-[var(--border-subtle)] px-16 py-4">
          <button
            type="button"
            onClick={() => scrollThumbnails('previous')}
            className="whatsapp-inbox-media-viewer-strip-nav left-4"
            aria-label="Rolar miniaturas para trás"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div ref={thumbnailStripRef} className="flex gap-3 overflow-x-auto py-1">
            {messages.map((message) => (
              <WhatsAppMediaViewerThumb
                key={message.id}
                message={message}
                active={message.id === selectedMessage.id}
                onSelect={onSelect}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollThumbnails('next')}
            className="whatsapp-inbox-media-viewer-strip-nav right-4"
            aria-label="Rolar miniaturas para frente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </footer>
      ) : null}
    </div>
  );

  return typeof document === 'undefined' ? viewer : createPortal(viewer, document.body);
}

function DeliveryStatusIndicator({ message }: { message: CommWhatsAppMessage }) {
  const meta = getDeliveryStatusMeta(message);
  const Icon = meta.icon;

  return (
    <span className={`whatsapp-inbox-status-meta whatsapp-inbox-status-meta-${meta.tone}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
    </span>
  );
}

function WhatsAppAudioPlayerCard({
  kind,
  mediaUrl,
  mediaMimeType,
  fileName,
  durationSeconds,
  loading,
  error,
}: {
  kind: 'audio' | 'voice';
  mediaUrl: string | null;
  mediaMimeType?: string | null;
  fileName?: string | null;
  durationSeconds?: number | null;
  loading: boolean;
  error: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(durationSeconds ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setResolvedDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
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
  }, [mediaUrl]);

  const handleTogglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !mediaUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    void audio.play().then(() => setIsPlaying(true)).catch(() => undefined);
  };

  const duration = Math.max(resolvedDuration || 0, durationSeconds || 0);
  const waveformBars =
    kind === 'voice'
      ? DEFAULT_WAVEFORM
      : DEFAULT_WAVEFORM.map((value, index) => (index % 3 === 0 ? value * 0.62 : value * 0.92));
  const playedBars = duration > 0 ? Math.min(waveformBars.length, Math.ceil((currentTime / duration) * waveformBars.length)) : 0;

  if (!mediaUrl) {
    return (
      <div className={`whatsapp-inbox-audio-native-card ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
        <div className={`whatsapp-inbox-audio-native-badge ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
          {kind === 'voice' ? <Mic className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {kind !== 'voice' ? <p className="truncate text-sm font-semibold">{fileName || 'Arquivo de áudio'}</p> : null}
          <p className="text-xs opacity-75">{loading ? 'Carregando áudio...' : error || 'Áudio indisponível'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`whatsapp-inbox-audio-native-card ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
      <audio ref={audioRef} preload="metadata">
        <source src={mediaUrl} type={mediaMimeType || undefined} />
      </audio>

      <div className={`whatsapp-inbox-audio-native-badge ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
        {kind === 'voice' ? <Mic className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTogglePlayback}
            className="whatsapp-inbox-audio-native-play"
            aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          <div className={`min-w-0 flex-1 ${kind === 'voice' ? 'space-y-1.5' : 'space-y-2'}`}>
            {kind !== 'voice' ? (
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold">{fileName || 'Arquivo de áudio'}</p>
                <span className="text-[11px] font-medium opacity-70">Áudio enviado</span>
              </div>
            ) : null}
            <div className="whatsapp-inbox-audio-native-waveform">
              {waveformBars.map((bar, index) => (
                <span
                  key={`${kind}-${index}-${bar}`}
                  className={`whatsapp-inbox-audio-native-waveform-bar ${index < playedBars ? 'is-played' : ''} ${isPlaying ? 'is-active' : ''}`}
                  style={{ height: `${Math.max(10, Math.round(bar * 22))}px` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs opacity-80">
              <span>{formatDurationLabel(Math.round(currentTime))}</span>
              <span>{formatDurationLabel(Math.round(duration))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RetryMediaButton({
  loading,
  onRetry,
}: {
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onRetry}
      disabled={loading}
      variant="soft"
      size="sm"
      className="whatsapp-inbox-retry-button h-8 rounded-xl px-3 text-[11px]"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
      Reenviar
    </Button>
  );
}

function InboxFilterChip({
  active,
  label,
  onClick,
  compact = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      variant={active ? 'soft' : 'secondary'}
      size="sm"
      className={compact ? 'h-8 rounded-xl px-3 text-[11px]' : 'h-9 rounded-xl px-3.5 text-xs'}
    >
      {label}
    </Button>
  );
}

function InboxFilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {options.map((option) => (
          <InboxFilterChip key={option.value} active={value === option.value} label={option.label} onClick={() => onChange(option.value)} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function InboxMultiFilterGroup({
  label,
  values,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (value: string[]) => void;
  compact?: boolean;
}) {
  const normalizedValues = values.map((value) => value.toLowerCase());

  const toggleValue = (value: string) => {
    const normalized = value.toLowerCase();
    const next = normalizedValues.includes(normalized)
      ? values.filter((item) => item.toLowerCase() !== normalized)
      : [...values, value];
    onChange(next);
  };

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        <InboxFilterChip active={values.length === 0} label="Todos" onClick={() => onChange([])} compact={compact} />
        {options.map((option) => (
          <InboxFilterChip
            key={option.value}
            active={normalizedValues.includes(option.value.toLowerCase())}
            label={option.label}
            onClick={() => toggleValue(option.value)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function WhatsAppGalleryMediaTile({
  message,
  onOpenImage,
  className,
  overlayLabel,
}: {
  message: CommWhatsAppMessage;
  onOpenImage: (messageId: string) => void;
  className?: string;
  overlayLabel?: string;
}) {
  const { mediaUrl, loading, error } = useResolvedMediaUrl(message);
  const normalizedKind = isVideoLikeMessageType(message.message_type) ? 'video' : 'image';
  const baseClassName = `relative block overflow-hidden rounded-[var(--kds-radius-lg)] bg-[var(--bg-inset)] ${className ?? ''}`.trim();

  if (normalizedKind === 'image') {
    return mediaUrl ? (
      <button
        type="button"
        onClick={() => onOpenImage(message.id)}
        className={baseClassName}
      >
        <img src={mediaUrl} alt={message.media_file_name || 'Imagem enviada'} className="h-full w-full object-cover" loading="lazy" />
        {overlayLabel ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-base font-semibold text-white">
            {overlayLabel}
          </span>
        ) : null}
      </button>
    ) : (
      <div className={`${baseClassName} flex items-center justify-center text-sm text-[var(--text-muted)]`}>
        {loading ? 'Carregando imagem...' : error || 'Imagem indisponivel'}
      </div>
    );
  }

  const secondaryLabel = message.media_duration_seconds && message.media_duration_seconds > 0
    ? formatDurationLabel(Math.round(message.media_duration_seconds))
    : formatFileSize(message.media_size_bytes) || 'Video';

  return mediaUrl ? (
    <button type="button" onClick={() => onOpenImage(message.id)} className={baseClassName}>
      <video muted playsInline preload="metadata" className="h-full w-full object-cover">
        <source src={mediaUrl} type={message.media_mime_type || undefined} />
      </video>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-3 py-2 text-xs font-medium text-white">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Play className="h-3.5 w-3.5 fill-current" />
          <span className="truncate">{secondaryLabel}</span>
        </span>
        {overlayLabel ? <span className="text-sm font-semibold">{overlayLabel}</span> : null}
      </div>
    </button>
  ) : (
    <div className={`${baseClassName} flex items-center justify-center text-sm text-[var(--text-muted)]`}>
      {loading ? 'Carregando video...' : error || 'Video indisponivel'}
    </div>
  );
}

function WhatsAppMediaGroupBody({
  messages,
  onOpenImage,
}: {
  messages: CommWhatsAppMessage[];
  onOpenImage: (messageId: string) => void;
}) {
  const visibleMessages = messages.slice(0, 4);
  const hiddenCount = Math.max(0, messages.length - visibleMessages.length);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {visibleMessages.map((message, index) => {
        const isWideHero = messages.length === 3 && index === 0;
        const overlayLabel = hiddenCount > 0 && index === visibleMessages.length - 1 ? `+${hiddenCount}` : undefined;

        return (
          <WhatsAppGalleryMediaTile
            key={message.id}
            message={message}
            onOpenImage={onOpenImage}
            className={isWideHero ? 'col-span-2 aspect-[16/9]' : 'aspect-square'}
            overlayLabel={overlayLabel}
          />
        );
      })}
    </div>
  );
}

function InboxChatListItem({
  chat,
  selected,
  connectedUserName,
  draftPreview,
  onSelect,
  menuOpen,
  menuBusy,
  onToggleMenu,
  onOpenContextMenu,
  menuTriggerRef,
}: {
  chat: CommWhatsAppChat;
  selected: boolean;
  connectedUserName: string | null;
  draftPreview: string;
  onSelect: (chatId: string) => void;
  menuOpen: boolean;
  menuBusy: boolean;
  onToggleMenu: (chatId: string) => void;
  onOpenContextMenu: (chatId: string, anchor: PointerAnchor) => void;
  menuTriggerRef: (node: HTMLButtonElement | null) => void;
}) {
  const rawLastMessageText = String(chat.last_message_text ?? '').trim();
  const visibleLastMessageText = getVisiblePreviewText(chat.last_message_text);
  const previewIconType = getChatPreviewIconType(visibleLastMessageText);
  const outboundPreviewStatusMeta = chat.last_message_direction === 'outbound'
    ? getDeliveryStatusMetaFromValues(chat.last_message_delivery_status)
    : null;
  const OutboundPreviewStatusIcon = outboundPreviewStatusMeta?.icon;
  const hasUnreadBadge = chat.unread_count > 0 || chat.manual_unread;

  return (
    <div
      className={`group/chat relative whatsapp-inbox-chat-card border-b transition ${selected ? 'is-active' : ''}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenContextMenu(chat.id, { x: event.clientX, y: event.clientY });
      }}
    >
      <div className="px-4 py-3">
        <button type="button" onClick={() => onSelect(chat.id)} className="min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--text-primary)]">
                  {getSafeChatDisplayName(chat, connectedUserName)}
                </p>
                {chat.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" /> : null}
                {chat.is_archived ? <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
                {chat.is_muted ? <BellOff className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start">
              <span className="whatsapp-inbox-chat-meta text-[11px] font-medium leading-none">{formatMessageTime(chat.last_message_at)}</span>
            </div>
          </div>
          <p className={`mt-px truncate text-sm text-[var(--text-secondary)] ${hasUnreadBadge ? 'pr-12' : ''}`}>
            {draftPreview ? (
              <>
                <span className="mr-1 font-semibold text-[var(--danger-text)]">Rascunho:</span>
                <span>{draftPreview}</span>
              </>
            ) : visibleLastMessageText ? (
              <>
                {OutboundPreviewStatusIcon && outboundPreviewStatusMeta ? (
                  <span className={`mr-1 inline-flex align-middle whatsapp-inbox-preview-status whatsapp-inbox-preview-status-${outboundPreviewStatusMeta.tone}`} title={outboundPreviewStatusMeta.label} aria-label={outboundPreviewStatusMeta.label}>
                    <OutboundPreviewStatusIcon className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                {previewIconType ? (
                  <ChatPreviewIcon type={previewIconType} />
                ) : (
                  <span>{visibleLastMessageText}</span>
                )}
              </>
            ) : rawLastMessageText ? 'Mensagem' : 'Sem mensagens ainda'}
          </p>
          {hasUnreadBadge ? (
            <span className="whatsapp-inbox-unread-badge absolute right-4 top-1/2 inline-flex min-h-5 min-w-6 -translate-y-1/2 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {chat.unread_count > 0 ? chat.unread_count : '•'}
            </span>
          ) : null}
        </button>
      </div>

      <button
        ref={menuTriggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu(chat.id);
        }}
        className={cx(
          'absolute right-3 top-2.5 z-[2] inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
          menuOpen ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] opacity-100' : 'opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100',
          selected ? 'opacity-100' : '',
        )}
        aria-label="Abrir menu da conversa"
        aria-expanded={menuOpen}
        disabled={menuBusy}
      >
        {menuBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className={`h-3.5 w-3.5 transition ${menuOpen ? 'rotate-180' : ''}`} />}
      </button>
    </div>
  );
}

function InboxMessageSearchListItem({
  result,
  selected,
  connectedUserName,
  onSelect,
}: {
  result: CommWhatsAppMessageSearchResult;
  selected: boolean;
  connectedUserName?: string | null;
  onSelect: (chatId: string) => void;
}) {
  const messagePreviewText = getMessageSearchPreviewText(result.message);
  const messagePreviewIconType = getChatPreviewIconType(messagePreviewText);

  if (!messagePreviewText) {
    return null;
  }

  return (
    <div className={`relative border-b transition ${selected ? 'is-active' : ''}`}>
      <div className="px-4 py-3">
        <button type="button" onClick={() => onSelect(result.chat.id)} className="min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--text-primary)]">
                {getSafeChatDisplayName(result.chat, connectedUserName)}
              </p>
              {messagePreviewText ? (
                <p className="mt-px truncate text-sm text-[var(--text-secondary)]">
                  {messagePreviewIconType ? (
                    <ChatPreviewIcon type={messagePreviewIconType} />
                  ) : (
                    messagePreviewText
                  )}
                </p>
              ) : null}
            </div>
            <span className="whatsapp-inbox-chat-meta shrink-0 pt-0.5 text-[11px] font-medium leading-none">
              {formatMessageTime(result.message.message_at)}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

function WhatsAppMessageBody({
  message,
  onOpenImage,
  onTranscribe,
  onOpenSharedContactChat,
  onSaveSharedContact,
  sharedContactActionKey,
  transcribing,
}: {
  message: CommWhatsAppMessage;
  onOpenImage: (messageId: string) => void;
  onTranscribe: (message: CommWhatsAppMessage) => void;
  onOpenSharedContactChat: (contact: { name: string | null; phoneNumber: string | null }) => void;
  onSaveSharedContact: (contact: { name: string | null; phoneNumber: string | null }) => void;
  sharedContactActionKey: string | null;
  transcribing: boolean;
}) {
  const { mediaUrl, loading, error, retry } = useResolvedMediaUrl(message);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const kind = message.message_type.trim().toLowerCase();
  const caption = getMessageVisibleCaption(message);
  const editInfo = useMemo(() => getEditedMessageInfo(message), [message]);
  const deletedInfo = useMemo(() => getDeletedMessageInfo(message), [message]);
  const linkPreview = useMemo(() => getMessageLinkPreview(message), [message]);
  const quoteInfo = useMemo(() => getMessageQuoteInfo(message), [message]);
  const contactCardInfo = useMemo(() => getMessageContactCardInfo(message), [message]);
  const visibleTextContent = getVisiblePreviewText(message.text_content, message.message_type);

  useEffect(() => {
    setShowOriginalText(false);
  }, [message.id, editInfo.originalText, message.text_content, message.media_caption]);

  const editInfoNode = editInfo.edited ? (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <span>Editada</span>
        {editInfo.previousText ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginalText((current) => !current)}
            className="h-7 rounded-xl px-2.5 text-[11px] normal-case tracking-normal"
          >
            {showOriginalText ? 'Ocultar alteracoes' : 'Ver antes e depois'}
          </Button>
        ) : null}
      </div>
      {showOriginalText && editInfo.previousText ? (
        <div className="mt-2 grid gap-2">
          <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Antes</p>
            <LinkifiedText className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-muted)] line-through opacity-85" text={editInfo.previousText} />
          </div>
          {editInfo.currentText ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Depois</p>
              <LinkifiedText className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]" text={editInfo.currentText} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;
  const linkPreviewContent = linkPreview ? (
    <>
      {linkPreview.previewImage ? (
        <div className="overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-inset)]">
          <img src={linkPreview.previewImage} alt={linkPreview.title || linkPreview.domain || 'Preview do link'} className="max-h-[220px] w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="space-y-1.5 px-3 py-3">
        {linkPreview.title ? <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-primary)]">{linkPreview.title}</p> : null}
        {linkPreview.description ? <p className="line-clamp-3 text-sm leading-5 text-[var(--text-secondary)]">{linkPreview.description}</p> : null}
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{linkPreview.domain || 'Link'}</p>
      </div>
    </>
  ) : null;
  const linkPreviewNode = linkPreviewContent
    ? linkPreview?.url
      ? (
        <a
          href={linkPreview.url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] transition hover:border-[var(--border-strong)]"
        >
          {linkPreviewContent}
        </a>
      )
      : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)]">
          {linkPreviewContent}
        </div>
      )
    : null;
  const quotePreviewNode = quoteInfo ? (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-current/50 opacity-70" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Resposta</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 opacity-85">{quoteInfo.previewText}</p>
        </div>
      </div>
    </div>
  ) : null;
  const visibleContactItems = contactCardInfo?.items.slice(0, 3) ?? [];
  const hiddenContactCount = contactCardInfo ? Math.max(0, contactCardInfo.count - visibleContactItems.length) : 0;
  const contactCardNode = contactCardInfo ? (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {contactCardInfo.kind === 'contact'
              ? 'Contato compartilhado'
              : contactCardInfo.count > 0
                ? `${contactCardInfo.count} contatos compartilhados`
                : 'Contatos compartilhados'}
          </p>
          {visibleContactItems.length > 0 ? (
            <div className="space-y-2">
              {visibleContactItems.map((item, index) => (
                <div key={`${item.name ?? 'contact'}:${item.phoneNumber ?? index}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.name || 'Contato sem nome'}</p>
                  {item.phoneNumber ? (
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatCommWhatsAppPhoneLabel(item.phoneNumber)}</p>
                  ) : null}
                  {item.phoneNumber ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSharedContactChat(item)}
                        disabled={sharedContactActionKey === `open:${item.phoneNumber}` || sharedContactActionKey === `save:${item.phoneNumber}`}
                        className={inboxInlineActionClassName}
                      >
                        {sharedContactActionKey === `open:${item.phoneNumber}` ? 'Abrindo...' : 'Abrir chat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSaveSharedContact(item)}
                        disabled={!item.name || sharedContactActionKey === `open:${item.phoneNumber}` || sharedContactActionKey === `save:${item.phoneNumber}`}
                        className={inboxInlineActionClassName}
                        title={item.name ? 'Salvar contato' : 'Contato sem nome para salvar'}
                      >
                        {sharedContactActionKey === `save:${item.phoneNumber}` ? 'Salvando...' : 'Salvar contato'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{message.text_content || '[Contato]'}</p>
          )}
          {hiddenContactCount > 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">+{hiddenContactCount} contato(s)</p>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  if (deletedInfo.deleted) {
    const deletedByLabel = deletedInfo.deletedBy === 'self'
      ? 'Você apagou esta mensagem no WhatsApp.'
      : deletedInfo.deletedBy === 'contact'
        ? 'O contato apagou esta mensagem no WhatsApp.'
        : 'Mensagem apagada no WhatsApp.';

    return (
      <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-3 text-[var(--danger-text)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Mensagem apagada</span>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{deletedByLabel}</p>
        <LinkifiedText className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)] line-through opacity-85" text={deletedInfo.preservedText} />
      </div>
    );
  }

  if (kind === 'image' || kind === 'sticker') {
    const isSticker = kind === 'sticker';
    const mediaLabel = isSticker ? 'Figurinha' : 'Imagem';
    const unavailableLabel = isSticker ? 'Figurinha indisponível' : 'Imagem indisponível';
    const loadingLabel = isSticker ? 'Carregando figurinha...' : 'Carregando imagem...';
    const altLabel = message.media_file_name || (isSticker ? 'Figurinha enviada' : 'Imagem enviada');

    return (
      <div className="space-y-3">
        {quotePreviewNode}
        {mediaUrl ? (
          <button
            type="button"
            onClick={() => onOpenImage(message.id)}
            className={isSticker
              ? 'block w-fit max-w-[180px] overflow-hidden rounded-2xl border border-transparent bg-transparent text-left transition hover:border-current/15'
              : 'whatsapp-inbox-image-card block w-full overflow-hidden rounded-2xl border text-left'}
          >
            <img
              src={mediaUrl}
              alt={altLabel}
              className={isSticker ? 'max-h-[180px] max-w-[180px] object-contain' : 'max-h-[280px] w-full object-cover'}
              loading="lazy"
            />
            {!isSticker ? (
              <div className="whatsapp-inbox-image-card-footer flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="truncate font-medium">{message.media_file_name || mediaLabel}</span>
                <span className="shrink-0 opacity-80">Toque para ampliar</span>
              </div>
            ) : null}
          </button>
        ) : (
          <div className={isSticker
            ? 'flex h-32 w-32 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-[var(--bg-inset)] px-3 text-center text-sm opacity-80'
            : 'flex h-40 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-[var(--bg-inset)] text-sm opacity-80'}
          >
            {loading ? loadingLabel : error || unavailableLabel}
          </div>
        )}
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (isVideoLikeMessageType(kind)) {
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        <div className="whatsapp-inbox-image-card overflow-hidden rounded-2xl border">
          {mediaUrl ? (
            <video controls preload="metadata" className="max-h-[320px] w-full bg-black object-contain">
              <source src={mediaUrl} type={message.media_mime_type || undefined} />
            </video>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-[var(--bg-inset)] text-sm opacity-80">
              {loading ? 'Carregando vídeo...' : error || 'Vídeo indisponível'}
            </div>
          )}
          <div className="whatsapp-inbox-image-card-footer flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span className="truncate font-medium">{message.media_file_name || 'Video'}</span>
              <span className="shrink-0 opacity-80">{formatFileSize(message.media_size_bytes) || 'Midia'}</span>
            </div>
          </div>
          {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
          {editInfoNode}
        </div>
    );
  }

  if (kind === 'document') {
    const extension = message.media_file_name?.split('.').pop()?.toUpperCase() || 'DOC';

    return (
      <div className="space-y-3">
        {quotePreviewNode}
        <div className="whatsapp-inbox-document-card flex items-center gap-3 rounded-2xl border px-3 py-3">
          <div className="whatsapp-inbox-document-thumb flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xs font-semibold tracking-[0.08em]">
            {extension.slice(0, 4)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{message.media_file_name || 'Documento'}</p>
            <p className="text-xs opacity-75">{formatFileSize(message.media_size_bytes) || 'Documento anexo'}</p>
          </div>
          <div className="flex items-center gap-2">
            {mediaUrl ? (
              <>
                <a href={mediaUrl} target="_blank" rel="noreferrer" className={inboxInlineActionClassName}>
                  Abrir
                </a>
                <a
                  href={mediaUrl}
                  download={message.media_file_name || 'documento'}
                  className={inboxInlineActionClassName}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-75">{loading ? 'Carregando...' : error || 'Sem arquivo'}</span>
                {error ? (
                  <button type="button" onClick={retry} disabled={loading} className={inboxInlineActionClassName}>
                    Tentar novamente
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'audio' || kind === 'voice') {
    const transcriptionStatus = message.transcription_status || 'idle';
    const canTranscribe = Boolean(message.media_id || message.media_url);

    return (
      <div className="space-y-3">
        {quotePreviewNode}
        <WhatsAppAudioPlayerCard
          kind={kind}
          mediaUrl={mediaUrl}
          mediaMimeType={message.media_mime_type}
          fileName={message.media_file_name}
          durationSeconds={message.media_duration_seconds}
          loading={loading}
          error={error}
        />
        <div className="space-y-2">
          {transcriptionStatus === 'completed' && message.transcription_text?.trim() ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Transcrição</p>
                {message.transcription_provider ? (
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    {message.transcription_provider}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]">
                {message.transcription_text}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {transcriptionStatus === 'processing' || transcribing ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Transcrevendo...
              </span>
            ) : canTranscribe ? (
              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() => onTranscribe(message)}
                className="h-8 rounded-xl px-3 text-[11px]"
              >
                {transcriptionStatus === 'failed' ? 'Tentar novamente' : message.transcription_text?.trim() ? 'Retranscrever' : 'Transcrever'}
              </Button>
            ) : null}

            {transcriptionStatus === 'failed' && message.transcription_error ? (
              <span className="text-xs text-[var(--danger-text)]">{message.transcription_error}</span>
            ) : null}
          </div>
        </div>
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'contact' || kind === 'contact_list') {
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        {contactCardNode || <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={message.text_content || '[Contato]'} />}
        {editInfoNode}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotePreviewNode}
      {linkPreviewNode}
      {visibleTextContent ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={visibleTextContent} /> : null}
      {editInfoNode}
    </div>
  );
}

export default function WhatsAppInboxScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const { leadStatuses, options, getRoleModulePermission } = useConfig();
  const responsavelOptions = options.lead_responsavel;
  const agendaPermission = getRoleModulePermission(role, 'agenda');
  const canViewAgenda = agendaPermission.can_view;
  const canEditAgenda = agendaPermission.can_edit;
  const [loading, setLoading] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFiltersPosition, setAdvancedFiltersPosition] = useState<{ top: number; left: number } | null>(null);
  const [chatActivityFilter, setChatActivityFilter] = useState<ChatActivityFilter>('all');
  const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentInputAccept, setAttachmentInputAccept] = useState(DEFAULT_ATTACHMENT_ACCEPT);
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatMessageSearchOpen, setChatMessageSearchOpen] = useState(false);
  const [chatMessageSearchDraft, setChatMessageSearchDraft] = useState('');
  const [chatMessageSearchResults, setChatMessageSearchResults] = useState<CommWhatsAppMessageSearchResult[]>([]);
  const [searchingChatMessages, setSearchingChatMessages] = useState(false);
  const [threadReconcileChatId, setThreadReconcileChatId] = useState<string | null>(null);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);
  const [updatingChatStateId, setUpdatingChatStateId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [quickReplyIntegration, setQuickReplyIntegration] = useState<IntegrationSetting | null>(null);
  const [quickReplies, setQuickReplies] = useState<WhatsAppQuickReply[]>(DEFAULT_QUICK_REPLIES);
  const [quickRepliesModalOpen, setQuickRepliesModalOpen] = useState(false);
  const [savingQuickReplies, setSavingQuickReplies] = useState(false);
  const [whatsAppAgendaOpen, setWhatsAppAgendaOpen] = useState(false);
  const [whatsAppDashboardOpen, setWhatsAppDashboardOpen] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpCustomInstructions, setFollowUpCustomInstructions] = useState('');
  const [followUpTone, setFollowUpTone] = useState<CommWhatsAppFollowUpTone>('consultivo');
  const [followUpVariations, setFollowUpVariations] = useState<CommWhatsAppFollowUpVariation[]>([]);
  const [followUpSelectedSalesTechniques, setFollowUpSelectedSalesTechniques] = useState<string[]>([]);
  const [followUpSelectedSituationPresetIds, setFollowUpSelectedSituationPresetIds] = useState<string[]>([]);
  const [followUpManualContext, setFollowUpManualContext] = useState({
    tone: false,
    situationPresetIds: false,
    salesTechniques: false,
  });
  const [followUpAiContextRationale, setFollowUpAiContextRationale] = useState<string | null>(null);
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
  const [sendingDrawerMedia, setSendingDrawerMedia] = useState(false);
  const [quickReplyActiveIndex, setQuickReplyActiveIndex] = useState(0);
  const [dismissedQuickReplyKey, setDismissedQuickReplyKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [transcribingMessageId, setTranscribingMessageId] = useState<string | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<CommWhatsAppMessage | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState('');
  const [savingMessageEdit, setSavingMessageEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyTargetMessage, setReplyTargetMessage] = useState<CommWhatsAppMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<CommWhatsAppMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardingChatId, setForwardingChatId] = useState<string | null>(null);
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [openMessageActionMenuMessageId, setOpenMessageActionMenuMessageId] = useState<string | null>(null);
  const [messageActionMenuPosition, setMessageActionMenuPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [messageActionMenuPointerAnchor, setMessageActionMenuPointerAnchor] = useState<PointerAnchor | null>(null);
  const [openChatMenuChatId, setOpenChatMenuChatId] = useState<string | null>(null);
  const [chatMenuPosition, setChatMenuPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [chatMenuPointerAnchor, setChatMenuPointerAnchor] = useState<PointerAnchor | null>(null);
  const [localOutgoingMessages, setLocalOutgoingMessages] = useState<CommWhatsAppMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [selectedMediaComposerAttachmentId, setSelectedMediaComposerAttachmentId] = useState<string | null>(null);
  const [selectedDocumentComposerAttachmentId, setSelectedDocumentComposerAttachmentId] = useState<string | null>(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<MediaUploadProgress | null>(null);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [operationalState, setOperationalState] = useState<CommWhatsAppOperationalState | null>(null);
  const [operationalStateLoaded, setOperationalStateLoaded] = useState(false);
  const [operationalStateError, setOperationalStateError] = useState<string | null>(null);
  const [lightboxMessageId, setLightboxMessageId] = useState<string | null>(null);
  const [autoLinkedChatIds, setAutoLinkedChatIds] = useState<Record<string, true>>({});
  const [leadDrawerOpen, setLeadDrawerOpen] = useState(false);
  const [leadPanel, setLeadPanel] = useState<CommWhatsAppLeadPanel | null>(null);
  const [leadPanelLoading, setLeadPanelLoading] = useState(false);
  const [leadContracts, setLeadContracts] = useState<CommWhatsAppLeadContractSummary[]>([]);
  const [leadContractsLoading, setLeadContractsLoading] = useState(false);
  const [leadContractsError, setLeadContractsError] = useState<string | null>(null);
  const [statusReminderLead, setStatusReminderLead] = useState<Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'> | null>(null);
  const [statusReminderPromptMessage, setStatusReminderPromptMessage] = useState<string | null>(null);
  const [chatAgendaSummaryLoading, setChatAgendaSummaryLoading] = useState(false);
  const [chatAgendaSummary, setChatAgendaSummary] = useState<ChatAgendaSummary>({ pendingCount: 0, nextReminder: null });
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState<CommWhatsAppLeadSearchResult[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [linkLoadingLeadId, setLinkLoadingLeadId] = useState<string | null>(null);
  const [createLeadDraft, setCreateLeadDraft] = useState<CreateLeadDraft | null>(null);
  const [startChatModalOpen, setStartChatModalOpen] = useState(false);
  const [startChatQuery, setStartChatQuery] = useState('');
  const [savedContacts, setSavedContacts] = useState<CommWhatsAppPhoneContact[]>([]);
  const [savedContactsLoading, setSavedContactsLoading] = useState(false);
  const [savedContactsLoadingMore, setSavedContactsLoadingMore] = useState(false);
  const [savedContactsTotal, setSavedContactsTotal] = useState(0);
  const [savedContactsHasMore, setSavedContactsHasMore] = useState(false);
  const [savedContactsPage, setSavedContactsPage] = useState(1);
  const [crmStartResults, setCrmStartResults] = useState<CommWhatsAppLeadSearchResult[]>([]);
  const [crmStartLoading, setCrmStartLoading] = useState(false);
  const [manualStartPhone, setManualStartPhone] = useState('');
  const [startingChatKey, setStartingChatKey] = useState<string | null>(null);
  const [sharedContactActionKey, setSharedContactActionKey] = useState<string | null>(null);
  const { pollingEnabled } = useWindowPollingState();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatMessageSearchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const advancedFiltersRef = useRef<HTMLDivElement | null>(null);
  const advancedFiltersTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mediaDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const composerAiMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const messageActionMenuRef = useRef<HTMLDivElement | null>(null);
  const chatMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reactionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const messageActionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const messageBubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chatMenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cancelVoiceRecordingRef = useRef<() => void>(() => undefined);
  const mediaUploadAbortControllerRef = useRef<AbortController | null>(null);
  const attachmentPreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const localOutgoingRetryPayloadRef = useRef<Map<string, LocalOutgoingRetryPayload>>(new Map());
  const localOutgoingMediaPreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const sendQueueByChatIdRef = useRef<Map<string, Promise<void>>>(new Map());
  const statusRefreshTimeoutsRef = useRef<number[]>([]);
  const lastPendingStatusRefreshKeyRef = useRef('');
  const lastSelectedChatPreviewRefreshKeyRef = useRef('');
  const activeSendOperationsRef = useRef(0);
  const composerQueueSnapshotKeysRef = useRef<Set<string>>(new Set());
  const retryingMessageIdsRef = useRef<Set<string>>(new Set());
  const autoLinkedLeadKeyRef = useRef<string | null>(null);
  const autoLinkSuppressedChatIdRef = useRef<string | null>(null);
  const pendingChatInboxStateRef = useRef<Map<string, PendingChatInboxStatePatch>>(new Map());
  const manualUnreadSkipReadChatIdRef = useRef<string | null>(null);
  const pendingChatReadKeysRef = useRef<Set<string>>(new Set());
  const attemptedChatReadAtByKeyRef = useRef<Map<string, number>>(new Map());
  const optimisticMessageTimestampByChatIdRef = useRef<Map<string, number>>(new Map());
  const prefetchedLeadNameByPhoneRef = useRef<Map<string, string>>(new Map());
  const savedContactNameByPhoneRef = useRef<Map<string, string>>(new Map());
  const resolvedIdentityPhoneKeysRef = useRef<Set<string>>(new Set());
  const latestChatsRef = useRef<CommWhatsAppChat[]>([]);
  const loadChatsRef = useRef<() => Promise<unknown> | void>(() => {});
  const loadMessagesRef = useRef<(chat: CommWhatsAppChat | null, reason?: MessageLoadReason) => Promise<unknown> | void>(() => {});
  const archivedSectionOpenRef = useRef<boolean>(false);
  const latestChatsLoadedAtRef = useRef<number>(0);
  const latestMessagesRef = useRef<CommWhatsAppMessage[]>([]);
  const latestCrmStartResultsRef = useRef<CommWhatsAppLeadSearchResult[]>([]);
  const outgoingMessageOrderAtByExternalIdRef = useRef<Map<string, string>>(new Map());
  const outgoingMessageOrderAtByClientRequestIdRef = useRef<Map<string, string>>(new Map());
  const chatIdentityLookupInFlightKeysRef = useRef<Set<string>>(new Set());
  const chatIdentityLookupFailedAtByKeyRef = useRef<Map<string, number>>(new Map());
  const savedContactLookupInFlightKeysRef = useRef<Set<string>>(new Set());
  const savedContactLookupFailedAtByKeyRef = useRef<Map<string, number>>(new Map());
  const resolvedSavedContactPhoneKeysRef = useRef<Set<string>>(new Set());
  const lastSavedContactForceSyncAtRef = useRef(0);
  const chatsSignatureRef = useRef('');
  const messagesSignatureRef = useRef('');
  const pendingScrollModeRef = useRef<ScrollMode>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const selectedChatIdRef = useRef<string | null>(null);
  const chatIdFromUrlRef = useRef<string | null>(null);
  const chatsRequestIdRef = useRef(0);
  const chatPollBackoffRef = useRef(0);
  const messageSearchSelectionRequestIdRef = useRef(0);
  const chatMessageSearchRequestIdRef = useRef(0);
  const pendingMessageSearchChatIdRef = useRef<string | null>(null);
  const messagesRequestIdRef = useRef(0);
  const chatsLoadPromiseRef = useRef<Promise<void> | null>(null);
  const chatsLoadKeyRef = useRef<string | null>(null);
  const pollingMessagesChatIdRef = useRef<string | null>(null);
  const olderMessagesRequestIdRef = useRef(0);
  const operationalStateRequestIdRef = useRef(0);
  const autoLinkLookupRequestIdRef = useRef(0);
  const chatIdentityLookupRequestIdRef = useRef(0);
  const leadPanelRequestIdRef = useRef(0);
  const leadContractsRequestIdRef = useRef(0);
  const chatAgendaSummaryRequestIdRef = useRef(0);
  const followUpGenerationRequestIdRef = useRef(0);
  const replySuggestionRequestIdRef = useRef(0);
  const replySuggestionKeyRef = useRef('');
  const leadSearchRequestIdRef = useRef(0);
  const startChatSourcesRequestIdRef = useRef(0);
  const chatAgendaSummaryLeadIdRef = useRef<string | null>(null);
  const {
    searchDraft,
    search,
    chatSearchResults,
    messageSearchResults,
    searchingChats,
    searchingMessages,
    setSearchDraft,
    setSearch,
  } = useChatSearch({
    activityFilter: chatActivityFilter,
    leadStatusFilters,
    pendingChatInboxStateRef,
    sortChats: sortChatsByInboxOrder,
  });
  const voiceAttachment = useMemo(
    () => pendingAttachments.find((attachment) => attachment.kind === 'voice') ?? null,
    [pendingAttachments],
  );
  const nonVoiceAttachments = useMemo(
    () => pendingAttachments.filter((attachment) => attachment.kind !== 'voice'),
    [pendingAttachments],
  );
  const visualComposerAttachments = useMemo(
    () => nonVoiceAttachments.filter((attachment) => attachment.kind === 'image' || attachment.kind === 'video'),
    [nonVoiceAttachments],
  );
  const documentComposerAttachments = useMemo(
    () => nonVoiceAttachments.filter((attachment) => attachment.kind !== 'image' && attachment.kind !== 'video'),
    [nonVoiceAttachments],
  );
  const selectedMediaComposerAttachment = useMemo(
    () => visualComposerAttachments.find((attachment) => attachment.id === selectedMediaComposerAttachmentId) ?? visualComposerAttachments[0] ?? null,
    [selectedMediaComposerAttachmentId, visualComposerAttachments],
  );
  const selectedDocumentComposerAttachment = useMemo(
    () => documentComposerAttachments.find((attachment) => attachment.id === selectedDocumentComposerAttachmentId) ?? documentComposerAttachments[0] ?? null,
    [documentComposerAttachments, selectedDocumentComposerAttachmentId],
  );
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
  const hasTypedMessage = messageDraft.trim().length > 0;
  const hasSendPayload = hasTypedMessage || pendingAttachments.length > 0;
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

    if (!operationalState?.tokenConfigured) {
      return 'Token da Whapi não configurado em /painel/config.';
    }

    if (!operationalState.configEnabled) {
      return 'Envio do WhatsApp está desabilitado em /painel/config.';
    }

    if (!isChannelConnected) {
      return `Canal WhatsApp ${connectionStatusLabel.toLowerCase()}.`;
    }

    return null;
  }, [connectionStatusLabel, isChannelConnected, operationalState, operationalStateError, operationalStateLoaded]);
  const {
    voiceRecordingState,
    voiceRecordingSeconds,
    voiceRecordingWaveform,
    voicePreviewPlaying,
    voicePreviewDuration,
    voicePreviewCurrentTime,
    voicePreviewAudioRef,
    autoSendVoiceRef,
    handleStartVoiceRecording,
    handleStopVoiceRecording,
    handleCancelVoiceRecording,
    handleToggleVoicePreviewPlayback,
    handleClearVoiceAttachment: handleClearVoiceAttachmentFromHook,
    setVoicePreviewPlaying,
    setVoicePreviewCurrentTime,
    setVoicePreviewDuration,
  } = useVoiceRecording({
    sendDisabledReason,
    onAttachmentChange: setPendingAttachments,
  });
  const isVoiceComposerMode = voiceRecordingState === 'recording' || voiceAttachment !== null;

  const beginSendOperation = useCallback(() => {
    activeSendOperationsRef.current += 1;
    setSending(true);

    let released = false;
    return () => {
      if (released) {
        return;
      }

      released = true;
      activeSendOperationsRef.current = Math.max(0, activeSendOperationsRef.current - 1);
      setSending(activeSendOperationsRef.current > 0);
    };
  }, []);

  const enqueueChatSend = useCallback((chatId: string, task: () => Promise<void>) => {
    const previous = sendQueueByChatIdRef.current.get(chatId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const release = beginSendOperation();
        try {
          await task();
        } finally {
          release();
        }
      });

    sendQueueByChatIdRef.current.set(chatId, next);
    void next
      .catch((error) => {
        console.error('[WhatsAppInbox] erro na fila de envio', error);
      })
      .finally(() => {
        if (sendQueueByChatIdRef.current.get(chatId) === next) {
          sendQueueByChatIdRef.current.delete(chatId);
        }
      });

    return next;
  }, [beginSendOperation]);

  const releaseComposerQueueSnapshotKeySoon = useCallback((key: string) => {
    window.setTimeout(() => {
      composerQueueSnapshotKeysRef.current.delete(key);
    }, 250);
  }, []);

  const buildChatsSignature = useCallback(
    (items: CommWhatsAppChat[]) =>
      items
        .map(
          (chat) =>
            `${chat.id}:${chat.updated_at}:${chat.unread_count}:${chat.last_message_at ?? ''}:${chat.last_message_text ?? ''}:${chat.last_message_delivery_status ?? ''}:${chat.display_name}:${chat.saved_contact_name ?? ''}:${chat.lead_id ?? ''}:${chat.lead_name ?? ''}:${chat.is_archived}:${chat.archived_at ?? ''}:${chat.is_muted}:${chat.muted_at ?? ''}:${chat.is_pinned}:${chat.pinned_at ?? ''}:${chat.manual_unread}:${chat.manual_unread_at ?? ''}`,
        )
        .join('|'),
    [],
  );

  const buildMessagesSignature = useCallback(
    (items: CommWhatsAppMessage[]) =>
      items
        .map(
          (message) =>
            `${message.id}:${message.external_message_id ?? ''}:${message.delivery_status}:${message.message_at}:${message.text_content ?? ''}:${message.message_type}:${message.media_id ?? ''}:${message.media_url ?? ''}:${message.media_file_name ?? ''}:${message.media_caption ?? ''}:${message.transcription_text ?? ''}:${message.transcription_status ?? ''}:${message.transcription_error ?? ''}:${getMessageMetadataSignature(message)}`,
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

  const archivedChatsCount = useMemo(() => chats.filter((chat) => chat.is_archived).length, [chats]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const chatMessageSearch = chatMessageSearchDraft.trim();

  const chatMatchesActiveFilters = useCallback((chat: CommWhatsAppChat) => {
    if (chatActivityFilter === 'unread' && chat.unread_count <= 0 && !chat.manual_unread) {
      return false;
    }

    if (leadStatusFilters.length > 0) {
      const chatLeadStatus = String(chat.lead_status ?? '').trim().toLowerCase();
      const acceptedStatuses = new Set(leadStatusFilters.map((status) => status.trim().toLowerCase()).filter(Boolean));
      if (!chatLeadStatus || !acceptedStatuses.has(chatLeadStatus)) {
        return false;
      }
    }

    return true;
  }, [chatActivityFilter, leadStatusFilters]);

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
  const remoteChatSearchResults = useMemo(
    () => (search ? rankChatsBySearch(chatSearchResults.filter(chatMatchesActiveFilters), search, operationalState?.channel?.connected_user_name ?? null) : []),
    [chatMatchesActiveFilters, chatSearchResults, operationalState?.channel?.connected_user_name, search],
  );
  const filteredMessageSearchResults = useMemo(
    () => messageSearchResults.filter((result) => chatMatchesActiveFilters(result.chat)),
    [chatMatchesActiveFilters, messageSearchResults],
  );
  const sidebarChats = useMemo(
    () => (search ? mergeUniqueChats(localChatSearchResults, remoteChatSearchResults) : scopedChats),
    [localChatSearchResults, remoteChatSearchResults, scopedChats, search],
  );
  const forwardTargetChats = useMemo(() => {
    const normalizedSearch = normalizeInboxSearch(forwardSearch);
    const candidates = chats.filter((chat) => chat.external_chat_id?.trim());
    const filtered = normalizedSearch
      ? candidates.filter((chat) => normalizeInboxSearch(`${chat.display_name} ${chat.saved_contact_name ?? ''} ${chat.phone_number}`).includes(normalizedSearch))
      : candidates;

    return sortChatsByInboxOrder(filtered).slice(0, 30);
  }, [chats, forwardSearch]);
  const selectedChatTranscriptLabel = useMemo(
    () => {
      if (!selectedChat) {
        return 'Contato';
      }

      return getSafeChatDisplayName(selectedChat, operationalState?.channel?.connected_user_name ?? null, leadPanel?.nome_completo) || selectedChat.phone_number?.trim() || 'Contato';
    },
    [leadPanel?.nome_completo, operationalState?.channel?.connected_user_name, selectedChat],
  );

  const quickReplyLead = useMemo<Lead | null>(() => {
    if (!selectedChat) {
      return null;
    }

    const timestamp = new Date().toISOString();
    return {
      id: leadPanel?.id ?? selectedChat.lead_id ?? selectedChat.id,
      nome_completo: getSafeChatDisplayName(selectedChat, operationalState?.channel?.connected_user_name ?? null, leadPanel?.nome_completo),
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
  }, [leadPanel, operationalState?.channel?.connected_user_name, selectedChat]);
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

        const baseShortcut = buildQuickReplyShortcut(name, index);
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
  const quickReplyEmptyStateMessage = quickReplyOptions.length === 0
    ? 'Nenhuma mensagem rapida cadastrada ainda.'
    : 'Nenhum atalho encontrado para esse termo.';
  const hasActiveChatFilters =
    chatActivityFilter !== 'all' || leadStatusFilters.length > 0;
  const activeChatFiltersCount = (chatActivityFilter !== 'all' ? 1 : 0) + leadStatusFilters.length;

  const upsertChatLocally = useCallback((nextChat: CommWhatsAppChat) => {
    setChats((current) => {
      const previousChat = current.find((chat) => chat.id === nextChat.id) ?? null;
      const stableNextChat = stabilizeChatIdentityForLocalMerge(nextChat, previousChat);
      const hydratedNextChat = preserveUsefulChatPreview(stableNextChat, previousChat);
      const exists = Boolean(previousChat);
      const updated = exists
        ? current.map((chat) => (chat.id === nextChat.id ? preserveUsefulChatPreview(stabilizeChatIdentityForLocalMerge({ ...chat, ...hydratedNextChat }, chat), chat) : chat))
        : [hydratedNextChat, ...current];

      const sorted = sortChatsByInboxOrder(updated);
      chatsSignatureRef.current = buildChatsSignature(sorted);
      return sorted;
    });
  }, [buildChatsSignature]);

  const rememberOutgoingMessageOrder = useCallback((message: CommWhatsAppMessage) => {
    const orderAt = getMessageClientOrderAt(message) || message.message_at;
    if (!orderAt) {
      return;
    }

    const externalMessageId = String(message.external_message_id ?? '').trim();
    if (externalMessageId) {
      outgoingMessageOrderAtByExternalIdRef.current.set(externalMessageId, orderAt);
    }

    const clientRequestId = getMessageClientRequestId(message);
    if (clientRequestId) {
      outgoingMessageOrderAtByClientRequestIdRef.current.set(clientRequestId, orderAt);
    }
  }, []);

  const applyOutgoingOrderToServerMessage = useCallback((message: CommWhatsAppMessage) => {
    if (message.direction !== 'outbound') {
      return message;
    }

    const existingOrderAt = getMessageClientOrderAt(message);
    if (existingOrderAt) {
      return message;
    }

    const externalMessageId = String(message.external_message_id ?? '').trim();
    const clientRequestId = getMessageClientRequestId(message);
    const orderAt = (externalMessageId ? outgoingMessageOrderAtByExternalIdRef.current.get(externalMessageId) : null)
      ?? (clientRequestId ? outgoingMessageOrderAtByClientRequestIdRef.current.get(clientRequestId) : null)
      ?? null;

    if (!orderAt) {
      return message;
    }

    return {
      ...message,
      metadata: {
        ...getMessageMetadataRecord(message),
        client_order_at: orderAt,
      },
    };
  }, []);

  const patchLocalOutgoingMessage = useCallback((messageId: string, patch: Partial<CommWhatsAppMessage>) => {
    setLocalOutgoingMessages((current) => current.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      const patchMessage = {
        ...message,
        ...patch,
        metadata: {
          ...message.metadata,
          ...(patch.metadata ?? {}),
        },
      };
      const nextMessage = mergeCommWhatsAppMessage(message, patchMessage);
      rememberOutgoingMessageOrder(nextMessage);
      return nextMessage;
    }));
  }, [rememberOutgoingMessageOrder]);

  const removeLocalOutgoingMessage = useCallback((messageId: string) => {
    setLocalOutgoingMessages((current) => {
      const removedMessage = current.find((message) => message.id === messageId) ?? null;
      const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(messageId);
      const externalMessageId = String(removedMessage?.external_message_id ?? '').trim();

      if (previewUrl?.startsWith('blob:') && !externalMessageId) {
        URL.revokeObjectURL(previewUrl);
      }

      localOutgoingMediaPreviewUrlsRef.current.delete(messageId);
      return current.filter((message) => message.id !== messageId);
    });
    localOutgoingRetryPayloadRef.current.delete(messageId);
  }, []);

  const appendLocalOutgoingMessage = useCallback((message: CommWhatsAppMessage, retryPayload?: LocalOutgoingRetryPayload) => {
    rememberOutgoingMessageOrder(message);
    if (selectedChatIdRef.current === message.chat_id) {
      pendingScrollModeRef.current = 'bottom';
      pendingScrollTopRef.current = null;
      pendingScrollHeightRef.current = null;
    }

    setLocalOutgoingMessages((current) => mergeMessages(current, [message]));
    if (retryPayload) {
      localOutgoingRetryPayloadRef.current.set(message.id, retryPayload);
    }

    if (message.media_url?.startsWith('blob:')) {
      localOutgoingMediaPreviewUrlsRef.current.set(message.id, message.media_url);
    }
  }, [rememberOutgoingMessageOrder]);

  const buildOptimisticOutgoingMessage = useCallback((params: {
    chat: CommWhatsAppChat;
    messageType: CommWhatsAppMediaSendKind | 'text' | 'document';
    textContent: string;
    clientRequestId?: string;
    messageAt?: string;
    mediaUrl?: string | null;
    mediaMimeType?: string | null;
    mediaFileName?: string | null;
    mediaSizeBytes?: number | null;
    mediaDurationSeconds?: number | null;
    mediaCaption?: string | null;
    metadata?: Record<string, unknown>;
  }): CommWhatsAppMessage => {
    const nowIso = params.messageAt ?? new Date().toISOString();

    return {
      id: createLocalOutgoingMessageId(),
      chat_id: params.chat.id,
      channel_id: params.chat.channel_id,
      external_message_id: null,
      direction: 'outbound',
      message_type: params.messageType,
      delivery_status: 'pending',
      text_content: params.textContent,
      message_at: nowIso,
      created_by: null,
      source: 'local',
      sender_name: null,
      sender_phone: null,
      status_updated_at: nowIso,
      error_message: null,
      media_id: null,
      media_url: params.mediaUrl ?? null,
      media_mime_type: params.mediaMimeType ?? null,
      media_file_name: params.mediaFileName ?? null,
      media_size_bytes: params.mediaSizeBytes ?? null,
      media_duration_seconds: params.mediaDurationSeconds ?? null,
      media_caption: params.mediaCaption ?? null,
      transcription_text: null,
      transcription_status: null,
      transcription_provider: null,
      transcription_model: null,
      transcription_error: null,
      transcription_updated_at: null,
      metadata: {
        local_outgoing: true,
        client_order_at: nowIso,
        ...(params.clientRequestId ? { client_request_id: params.clientRequestId } : {}),
        ...params.metadata,
      },
      created_at: nowIso,
    };
  }, []);

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

    void commWhatsAppService.markChatRead(chat.id, {
      messageAt,
    }).catch((error) => {
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

  const resetComposerAfterQueue = useCallback(() => {
    resetComposerDraft();
    setPendingAttachments([]);
    setReplyTargetMessage(null);
    setMediaUploadProgress(null);
    voicePreviewAudioRef.current?.pause();
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.currentTime = 0;
    }
    setVoicePreviewPlaying(false);
    setVoicePreviewCurrentTime(0);
    setVoicePreviewDuration(null);
  }, [resetComposerDraft, setVoicePreviewCurrentTime, setVoicePreviewDuration, setVoicePreviewPlaying, voicePreviewAudioRef]);

  const messageTimelineItems = useMemo(() => {
    const items: Array<
      | { type: 'day'; key: string; label: string }
      | { type: 'message'; key: string; message: CommWhatsAppMessage }
      | { type: 'media-group'; key: string; messages: CommWhatsAppMessage[] }
    > = [];
    let previousDayKey = '';

    const canGroupMediaMessages = (current: CommWhatsAppMessage, next: CommWhatsAppMessage) => {
      if (!isGalleryMediaMessage(current) || !isGalleryMediaMessage(next)) {
        return false;
      }

      if (current.direction !== next.direction || current.direction === 'system') {
        return false;
      }

      if (current.delivery_status === 'deleted' || next.delivery_status === 'deleted') {
        return false;
      }

      if (getMessageVisibleCaption(current) || getMessageVisibleCaption(next)) {
        return false;
      }

      if (hasMessageQuote(current) || hasMessageQuote(next)) {
        return false;
      }

      if (getMessageReactions(current).length > 0 || getMessageReactions(next).length > 0) {
        return false;
      }

      const currentTimestamp = getMessageTimestampMs(current.message_at);
      const nextTimestamp = getMessageTimestampMs(next.message_at);
      if (currentTimestamp === null || nextTimestamp === null || nextTimestamp < currentTimestamp) {
        return false;
      }

      return nextTimestamp - currentTimestamp <= GALLERY_GROUP_MAX_GAP_MS;
    };

    for (let index = 0; index < visibleMessages.length; index += 1) {
      const message = visibleMessages[index];
      if (!message) {
        continue;
      }

      const dayKey = getMessageDayKey(message.message_at);
      if (dayKey && dayKey !== previousDayKey) {
        items.push({
          type: 'day',
          key: `day:${dayKey}`,
          label: formatMessageDaySeparatorLabel(message.message_at),
        });
        previousDayKey = dayKey;
      }

      if (isGalleryMediaMessage(message) && !getMessageVisibleCaption(message)) {
        const groupedMessages = [message];

        while (index + 1 < visibleMessages.length && visibleMessages[index + 1] && canGroupMediaMessages(groupedMessages[groupedMessages.length - 1], visibleMessages[index + 1])) {
          groupedMessages.push(visibleMessages[index + 1] as CommWhatsAppMessage);
          index += 1;
        }

        if (groupedMessages.length > 1) {
          items.push({
            type: 'media-group',
            key: `media-group:${groupedMessages.map((item) => item.id).join(':')}`,
            messages: groupedMessages,
          });
          continue;
        }
      }

      items.push({
        type: 'message',
        key: `message:${message.id}`,
        message,
      });
    }

    return items;
  }, [visibleMessages]);

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

  const applyPrefetchedLeadNames = useCallback((items: CommWhatsAppChat[]) => {
    return items.map((chat) => {
      if (chat.saved_contact_name?.trim()) {
        return chat;
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
        display_name: matchedLeadName,
      };
    });
  }, []);

  const applyFrontendSavedContactNames = useCallback((items: CommWhatsAppChat[]) => {
    return items.map((chat) => {
      if (chat.saved_contact_name?.trim()) {
        return chat;
      }

      const savedName = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number)
        .map((key) => savedContactNameByPhoneRef.current.get(key) ?? null)
        .find((value): value is string => Boolean(value?.trim()));
      if (!savedName) {
        return chat;
      }

      return {
        ...chat,
        saved_contact_name: savedName,
      };
    });
  }, []);

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

    const selectedLookupKeys = selectedChat && !selectedChat.saved_contact_name?.trim()
      ? collectPhoneLookupKeys(selectedChat.phone_digits || selectedChat.phone_number)
      : [];
    const canForceSyncSelectedContact = selectedLookupKeys.length > 0
      && now - lastSavedContactForceSyncAtRef.current >= SAVED_CONTACT_FORCE_SYNC_COOLDOWN_MS;
    const forceSyncKeys = new Set(canForceSyncSelectedContact ? selectedLookupKeys : []);

    const targetChats = chats.filter((chat) => {
      if (chat.saved_contact_name?.trim()) {
        return false;
      }

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

    let cancelled = false;
    const forceSync = requestKeys.some((key) => forceSyncKeys.has(key));

    if (forceSync) {
      lastSavedContactForceSyncAtRef.current = now;
    }

    requestKeys.forEach((key) => savedContactLookupInFlightKeysRef.current.add(key));
    void commWhatsAppService.lookupSavedContactsByPhones({ phoneNumbers, forceSync }).then((contacts) => {
      if (cancelled) return;

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
        addSavedContactsToNameMap(map, contacts);
        savedContactNameByPhoneRef.current = map;
        setChats((current) => applyFrontendSavedContactNames(current));
      }
    }).catch((error) => {
      const failedAt = Date.now();
      requestKeys.forEach((key) => savedContactLookupFailedAtByKeyRef.current.set(key, failedAt));
      console.warn('[WhatsAppInbox] lookup de contatos salvos pausado temporariamente apos erro', error);
    }).finally(() => {
      requestKeys.forEach((key) => savedContactLookupInFlightKeysRef.current.delete(key));
    });

    return () => { cancelled = true; };
  }, [applyFrontendSavedContactNames, chats, selectedChat]);

  const applyRealtimeChatChange = useCallback((payload: RealtimePostgresChangesPayload<CommWhatsAppChat>) => {
    const incomingChat = payload.new as CommWhatsAppChat | null;
    const previousChat = payload.old as Partial<CommWhatsAppChat> | null;
    const changedChatId = incomingChat?.id ?? previousChat?.id ?? null;

    if (!changedChatId) {
      return;
    }

    setChats((current) => {
      let next = current.filter((chat) => chat.id !== changedChatId);

        if (payload.eventType !== 'DELETE' && incomingChat && !incomingChat.deleted_at) {
          const existingChat = current.find((chat) => chat.id === incomingChat.id) ?? null;
          const hydratedChat = applyPendingChatInboxState(
            applyFrontendSavedContactNames(applyPrefetchedLeadNames([preserveUsefulChatPreview(incomingChat, existingChat)])),
            pendingChatInboxStateRef.current,
          )[0];
        const shouldKeepSelectedChat = selectedChatIdRef.current === hydratedChat.id;

        if (chatMatchesActiveFilters(hydratedChat) || shouldKeepSelectedChat) {
          next = [...next, hydratedChat];
        }
      }

      next = sortChatsByInboxOrder(next);
      const nextSignature = buildChatsSignature(next);
      if (nextSignature === chatsSignatureRef.current) {
        return current;
      }

      chatsSignatureRef.current = nextSignature;
      return next;
    });
  }, [applyFrontendSavedContactNames, applyPrefetchedLeadNames, buildChatsSignature, chatMatchesActiveFilters]);

  const applyRealtimeMessageChange = useCallback((payload: RealtimePostgresChangesPayload<CommWhatsAppMessage>) => {
    const incomingMessage = payload.new as CommWhatsAppMessage | null;
    const previousMessage = payload.old as Partial<CommWhatsAppMessage> | null;
    const targetChatId = incomingMessage?.chat_id ?? previousMessage?.chat_id ?? null;
    const orderedIncomingMessage = incomingMessage ? applyOutgoingOrderToServerMessage(incomingMessage) : null;

    if (!targetChatId || selectedChatIdRef.current !== targetChatId) {
      return;
    }

    setMessages((current) => {
      const nextMessages = payload.eventType === 'DELETE'
        ? current.filter((message) => message.id !== previousMessage?.id)
        : orderedIncomingMessage
          ? mergeMessages(current, [orderedIncomingMessage])
          : current;
      const nextSignature = buildMessagesSignature(nextMessages);

      if (nextSignature === messagesSignatureRef.current) {
        return current;
      }

      messagesSignatureRef.current = nextSignature;

      if (payload.eventType === 'INSERT') {
        if (isNearBottomRef.current || incomingMessage?.direction === 'outbound') {
          pendingScrollModeRef.current = 'bottom';
          pendingScrollTopRef.current = null;
          pendingScrollHeightRef.current = null;
        } else {
          pendingScrollModeRef.current = 'preserve';
          pendingScrollTopRef.current = messagesContainerRef.current?.scrollTop ?? 0;
          pendingScrollHeightRef.current = null;
        }
      } else if (payload.eventType === 'UPDATE' && (isNearBottomRef.current || incomingMessage?.direction === 'outbound')) {
        pendingScrollModeRef.current = 'bottom';
        pendingScrollTopRef.current = null;
        pendingScrollHeightRef.current = null;
      } else {
        pendingScrollModeRef.current = null;
      }

      return nextMessages;
    });

    if (incomingMessage) {
      setLocalOutgoingMessages((current) => {
        let changed = false;
        const nextLocalMessages = current.filter((message) => {
          if (message.chat_id !== targetChatId) {
            return true;
          }

          if (!messagesReferToSameOutgoing(message, incomingMessage)) {
            return true;
          }

          changed = true;
          rememberOutgoingMessageOrder(message);
          localOutgoingRetryPayloadRef.current.delete(message.id);
          const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(message.id);
          const incomingExternalMessageId = String(incomingMessage.external_message_id ?? '').trim();
          if (previewUrl && incomingExternalMessageId) {
            commWhatsAppService.rememberLocalMediaPreview(incomingExternalMessageId, previewUrl);
          }
          localOutgoingMediaPreviewUrlsRef.current.delete(message.id);
          return false;
        });

        return changed ? nextLocalMessages : current;
      });
    }
  }, [applyOutgoingOrderToServerMessage, buildMessagesSignature, rememberOutgoingMessageOrder]);

  useCommWhatsAppMessageRealtime(selectedChatId, applyRealtimeMessageChange);

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

  const patchMessageReactionLocally = useCallback((message: CommWhatsAppMessage, emoji: string | null) => {
    const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? message.metadata as Record<string, unknown>
      : {};
    const reactions = Array.isArray(metadata.reactions)
      ? metadata.reactions.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
      : [];
    const withoutOwnReaction = reactions.filter((item) => String(item.actor_key ?? '').trim() !== 'self');
    const nextReactions = emoji
      ? [
          ...withoutOwnReaction,
          {
            actor_key: 'self',
            emoji,
            from_me: true,
            from: null,
            from_name: 'Você',
            reacted_at: new Date().toISOString(),
            target_external_message_id: message.external_message_id ?? null,
          },
        ]
      : withoutOwnReaction;

    patchMessageLocally(message.id, {
      metadata: {
        ...metadata,
        reactions: nextReactions,
        last_reaction_at: new Date().toISOString(),
      },
    });
  }, [patchMessageLocally]);

  const loadLeadContracts = useCallback(async (leadId: string | null) => {
    const requestId = ++leadContractsRequestIdRef.current;

    if (!leadId) {
      setLeadContracts([]);
      setLeadContractsError(null);
      setLeadContractsLoading(false);
      return;
    }

    setLeadContractsLoading(true);
    try {
      const contracts = await commWhatsAppService.listLeadContracts(leadId);
      if (requestId !== leadContractsRequestIdRef.current) {
        return;
      }
      setLeadContracts(contracts);
      setLeadContractsError(null);
    } catch (error) {
      if (requestId !== leadContractsRequestIdRef.current) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao carregar contratos do lead', error);
      setLeadContracts([]);
      setLeadContractsError(error instanceof Error ? error.message : 'Não foi possível carregar os contratos do lead.');
    } finally {
      if (requestId === leadContractsRequestIdRef.current) {
        setLeadContractsLoading(false);
      }
    }
  }, []);

  const loadLeadPanel = useCallback(async (chat: CommWhatsAppChat | null) => {
    const requestId = ++leadPanelRequestIdRef.current;
    const targetChatId = chat?.id ?? null;

    if (!chat?.lead_id) {
      setLeadPanel(null);
      setLeadPanelLoading(false);
      setLeadContracts([]);
      setLeadContractsLoading(false);
      setLeadContractsError(null);
      return;
    }

    setLeadPanelLoading(true);
    try {
      const lead = await commWhatsAppService.getChatLeadPanel(chat.id);
      if (requestId !== leadPanelRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      setLeadPanel(lead);
      const nextLeadStatus = lead?.status_value ?? lead?.status_nome ?? null;
      const shouldHydrateChatFromLead = Boolean(
        lead
          && ((!chat.saved_contact_name && lead.nome_completo && chat.display_name !== lead.nome_completo)
            || (nextLeadStatus && chat.lead_status !== nextLeadStatus)),
      );
      if (shouldHydrateChatFromLead && lead) {
        upsertChatLocally({
          ...chat,
          lead_name: lead.nome_completo || chat.lead_name,
          display_name: !chat.saved_contact_name && lead.nome_completo ? lead.nome_completo : chat.display_name,
          lead_status: nextLeadStatus,
        });
      }
      if (lead?.nome_completo) {
        const phoneKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
        for (const key of phoneKeys) {
          prefetchedLeadNameByPhoneRef.current.set(key, lead.nome_completo);
        }
        if (phoneKeys.length > 0) {
          setChats((current) => applyFrontendSavedContactNames(applyPrefetchedLeadNames(current)));
        }
      }
      await loadLeadContracts(lead?.id ?? null);
    } catch (error) {
      if (requestId !== leadPanelRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao carregar painel do lead', error);
      setLeadPanel(null);
      setLeadContracts([]);
      setLeadContractsLoading(false);
      setLeadContractsError(null);
    } finally {
      if (requestId === leadPanelRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setLeadPanelLoading(false);
      }
    }
  }, [applyFrontendSavedContactNames, applyPrefetchedLeadNames, loadLeadContracts, upsertChatLocally]);

  const loadChatAgendaSummary = useCallback(async (leadId: string | null, contractIds: string[] = []) => {
    const requestId = ++chatAgendaSummaryRequestIdRef.current;

    if (!leadId) {
      chatAgendaSummaryLeadIdRef.current = null;
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryLoading(false);
      return;
    }

    const shouldShowLoading = chatAgendaSummaryLeadIdRef.current !== leadId;
    chatAgendaSummaryLeadIdRef.current = leadId;

    if (shouldShowLoading) {
      setChatAgendaSummaryLoading(true);
    }

    try {
      const [leadReminders, contractReminders] = await Promise.all([
        fetchAllPages<Reminder>(
          (from, to) =>
            supabase
              .from('reminders')
              .select('*')
              .eq('lead_id', leadId)
              .order('data_lembrete', { ascending: true })
              .order('id', { ascending: true })
              .range(from, to) as unknown as Promise<{ data: Reminder[] | null; error: unknown }>,
        ),
        contractIds.length > 0
          ? fetchAllPages<Reminder>(
              (from, to) =>
                supabase
                  .from('reminders')
                  .select('*')
                  .in('contract_id', contractIds)
                  .order('data_lembrete', { ascending: true })
                  .order('id', { ascending: true })
                  .range(from, to) as unknown as Promise<{ data: Reminder[] | null; error: unknown }>,
            )
          : Promise.resolve([] as Reminder[]),
      ]);

      const merged = Array.from(new Map([...leadReminders, ...contractReminders].map((reminder) => [reminder.id, reminder])).values());
      const pendingReminders = merged
        .filter((reminder) => !reminder.lido)
        .sort((left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime());

      if (requestId !== chatAgendaSummaryRequestIdRef.current || chatAgendaSummaryLeadIdRef.current !== leadId) {
        return;
      }

      setChatAgendaSummary({
        pendingCount: pendingReminders.length,
        nextReminder: pendingReminders[0] ?? null,
      });
    } catch (error) {
      if (requestId !== chatAgendaSummaryRequestIdRef.current || chatAgendaSummaryLeadIdRef.current !== leadId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao carregar resumo da agenda do chat', error);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
    } finally {
      if (shouldShowLoading && requestId === chatAgendaSummaryRequestIdRef.current && chatAgendaSummaryLeadIdRef.current === leadId) {
        setChatAgendaSummaryLoading(false);
      }
    }
  }, []);

  const refreshDrawerSearch = useCallback(async (query: string, phoneNumber?: string | null) => {
    const requestId = ++leadSearchRequestIdRef.current;
    const normalizedQuery = query.trim();
    const normalizedPhone = phoneNumber?.trim() || null;

    setLeadSearchLoading(true);
    try {
      const results = await commWhatsAppService.searchCrmLeads({
        query: normalizedQuery,
        phoneNumbers: normalizedPhone ? [normalizedPhone] : undefined,
        limit: 20,
      });

      if (requestId !== leadSearchRequestIdRef.current) {
        return;
      }

      setLeadSearchResults(results);
    } catch (error) {
      if (requestId !== leadSearchRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao buscar leads para o drawer', error);
      setLeadSearchResults([]);
    } finally {
      if (requestId === leadSearchRequestIdRef.current) {
        setLeadSearchLoading(false);
      }
    }
  }, []);

  const refreshStartChatSources = useCallback(async (query: string, page: number = 1, appendSavedContacts: boolean = false) => {
    const requestId = ++startChatSourcesRequestIdRef.current;
    const normalizedQuery = query.trim();

    if (appendSavedContacts) {
      setSavedContactsLoadingMore(true);
    } else {
      setSavedContactsLoading(true);
      setCrmStartLoading(true);
    }

    try {
      const contactsPagePromise = commWhatsAppService.listSavedContacts({ query: normalizedQuery, page, pageSize: 50 });
      const leadsPromise = appendSavedContacts
        ? Promise.resolve(latestCrmStartResultsRef.current)
        : commWhatsAppService.searchCrmLeads({ query: normalizedQuery, limit: 20 });

      const [contactsPage, leads] = await Promise.all([contactsPagePromise, leadsPromise]);

      if (requestId !== startChatSourcesRequestIdRef.current) {
        return;
      }

      setSavedContacts((current) => (appendSavedContacts ? [...current, ...contactsPage.contacts] : contactsPage.contacts));
      setSavedContactsTotal(contactsPage.total);
      setSavedContactsHasMore(contactsPage.hasMore);
      setSavedContactsPage(page);
      setCrmStartResults(leads);
    } catch (error) {
      if (requestId !== startChatSourcesRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar fontes para novo chat', error);
      if (!appendSavedContacts) {
        setSavedContacts([]);
        setSavedContactsTotal(0);
        setSavedContactsHasMore(false);
        setCrmStartResults([]);
      }
    } finally {
      if (requestId === startChatSourcesRequestIdRef.current) {
        if (appendSavedContacts) {
          setSavedContactsLoadingMore(false);
        } else {
          setSavedContactsLoading(false);
          setCrmStartLoading(false);
        }
      }
    }
  }, []);

  const suggestedLead = useMemo(() => {
    if (!leadDrawerOpen || selectedChat?.lead_id || leadSearchQuery.trim() !== '') {
      return null;
    }

    return leadSearchResults.length === 1 ? leadSearchResults[0] : null;
  }, [leadDrawerOpen, leadSearchQuery, leadSearchResults, selectedChat?.lead_id]);
  const selectedChatWasAutoLinked = Boolean(selectedChat?.id && autoLinkedChatIds[selectedChat.id]);
  const selectedChatDisplayName = useMemo(
    () => getSafeChatDisplayName(selectedChat, channelState?.connected_user_name ?? null, leadPanel?.nome_completo),
    [channelState?.connected_user_name, selectedChat, leadPanel?.nome_completo],
  );
  const followUpGenerationDisabledReason = useMemo(() => {
    if (!selectedChat) {
      return 'Selecione uma conversa para gerar o follow-up.';
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
      return 'Finalize a gravacao de audio antes de reescrever a mensagem.';
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

    if (!state.tokenConfigured) {
      return {
        tone: 'danger' as const,
        icon: AlertTriangle,
        title: 'Token da Whapi ausente',
        description: 'Configure o token em /painel/config para liberar envios no inbox.',
      };
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

    if (!chatAgendaSummary.nextReminder) {
      return chatAgendaSummary.pendingCount > 0 ? `Agenda: ${chatAgendaSummary.pendingCount} pendente(s).` : 'Agenda em dia';
    }

    const reminder = chatAgendaSummary.nextReminder;
    const prefix = isOverdue(reminder.data_lembrete) ? 'Próximo lembrete atrasado' : 'Próximo lembrete';
    return `${prefix}: ${reminder.titulo} · ${formatDateTimeFullBR(reminder.data_lembrete)}`;
  }, [chatAgendaSummary, chatAgendaSummaryLoading, leadPanel?.id]);

  useEffect(() => {
    latestChatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    archivedSectionOpenRef.current = archivedSectionOpen;
  }, [archivedSectionOpen]);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    latestCrmStartResultsRef.current = crmStartResults;
  }, [crmStartResults]);

  useEffect(() => {
    let active = true;

    void configService
      .getIntegrationSetting(WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG)
      .then((integration) => {
        if (!active) {
          return;
        }

        const normalized = normalizeWhatsAppQuickRepliesSettings(integration?.settings);
        setQuickReplyIntegration(integration);
        setQuickReplies(normalized.quickReplies);
      })
      .catch((error) => {
        console.error('[WhatsAppInbox] erro ao carregar mensagens rápidas', error);
        if (active) {
          setQuickReplyIntegration(null);
          setQuickReplies(DEFAULT_QUICK_REPLIES);
        }
      });

    return () => {
      active = false;
    };
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

  useEffect(() => {
    const nextPreviewUrls = new Map<string, string>();

    for (const attachment of pendingAttachments) {
      if (attachment.previewUrl?.startsWith('blob:')) {
        nextPreviewUrls.set(attachment.id, attachment.previewUrl);
      }
    }

    for (const [attachmentId, previewUrl] of attachmentPreviewUrlsRef.current.entries()) {
      if (!nextPreviewUrls.has(attachmentId) && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    }

    attachmentPreviewUrlsRef.current = nextPreviewUrls;
  }, [pendingAttachments]);

  useEffect(() => () => {
    for (const previewUrl of attachmentPreviewUrlsRef.current.values()) {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    }
    attachmentPreviewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!attachmentMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (attachmentMenuRef.current && target && !attachmentMenuRef.current.contains(target)) {
        setAttachmentMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [attachmentMenuOpen]);

  useEffect(() => {
    if (!composerAiMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (composerAiMenuRef.current && target && !composerAiMenuRef.current.contains(target)) {
        setComposerAiMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [composerAiMenuOpen]);

  useEffect(() => {
    if (!openReactionPickerMessageId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const clickedInsidePicker = reactionPickerRef.current && target && reactionPickerRef.current.contains(target);
      const clickedCurrentTrigger = reactionTriggerRefs.current[openReactionPickerMessageId]?.contains(target) ?? false;

      if (!clickedInsidePicker && !clickedCurrentTrigger) {
        setOpenReactionPickerMessageId(null);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [openReactionPickerMessageId]);

  useEffect(() => {
    if (!openMessageActionMenuMessageId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const clickedInsideMenu = messageActionMenuRef.current && target && messageActionMenuRef.current.contains(target);
      const clickedCurrentTrigger = messageActionTriggerRefs.current[openMessageActionMenuMessageId]?.contains(target) ?? false;

      if (!clickedInsideMenu && !clickedCurrentTrigger) {
        setMessageActionMenuPointerAnchor(null);
        setOpenMessageActionMenuMessageId(null);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [openMessageActionMenuMessageId]);

  useEffect(() => {
    if (!openChatMenuChatId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const clickedInsideMenu = chatMenuRef.current && target && chatMenuRef.current.contains(target);
      const clickedCurrentTrigger = chatMenuTriggerRefs.current[openChatMenuChatId]?.contains(target) ?? false;

      if (!clickedInsideMenu && !clickedCurrentTrigger) {
        setChatMenuPointerAnchor(null);
        setOpenChatMenuChatId(null);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [openChatMenuChatId]);

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

  useEffect(() => {
    if (!advancedFiltersOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const clickedInsidePopover = advancedFiltersRef.current && target && advancedFiltersRef.current.contains(target);
      const clickedTrigger = advancedFiltersTriggerRef.current && target && advancedFiltersTriggerRef.current.contains(target);

      if (!clickedInsidePopover && !clickedTrigger) {
        setAdvancedFiltersOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [advancedFiltersOpen]);

  useLayoutEffect(() => {
    if (!advancedFiltersOpen || !advancedFiltersTriggerRef.current || typeof window === 'undefined') {
      return;
    }

    const syncPosition = () => {
      const triggerRect = advancedFiltersTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const panelWidth = 272;
      const viewportPadding = 16;
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
    if (!mediaDrawerOpen || !mediaDrawerTriggerRef.current || typeof window === 'undefined') {
      return;
    }

    const syncPosition = () => {
      const triggerRect = mediaDrawerTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportPadding = 12;
      const panelWidth = Math.min(496, window.innerWidth - viewportPadding * 2);
      const panelHeight = Math.min(620, window.innerHeight - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, triggerRect.right - panelWidth + 72),
        window.innerWidth - panelWidth - viewportPadding,
      );
      const top = Math.max(viewportPadding, triggerRect.top - panelHeight - 12);

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
  }, [selectedChatId]);

  const resetFollowUpComposer = useCallback(() => {
    setFollowUpDraft('');
    setFollowUpCustomInstructions('');
    setFollowUpVariations([]);
    setFollowUpSelectedSalesTechniques([]);
    setFollowUpSelectedSituationPresetIds([]);
    setFollowUpManualContext({ tone: false, situationPresetIds: false, salesTechniques: false });
    setFollowUpAiContextRationale(null);
    setFollowUpNextAction(null);
  }, []);

  const loadOperationalState = useCallback(async () => {
    const requestId = ++operationalStateRequestIdRef.current;

    try {
      const state = await commWhatsAppService.getOperationalState();
      if (requestId !== operationalStateRequestIdRef.current) {
        return;
      }

      setOperationalState((current) => state ?? current);
      setOperationalStateError(null);
      setOperationalStateLoaded(true);
    } catch (error) {
      if (requestId !== operationalStateRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar estado operacional', error);
      setOperationalStateError(
        error instanceof Error ? error.message : 'Não foi possível carregar o estado operacional do WhatsApp.',
      );
      setOperationalStateLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!leadDrawerOpen) {
      return;
    }

    setLeadSearchQuery('');
    const currentSelectedChat = selectedChatId
      ? latestChatsRef.current.find((chat) => chat.id === selectedChatId) ?? null
      : null;
    void loadLeadPanel(currentSelectedChat);
  }, [leadDrawerOpen, loadLeadPanel, selectedChat?.lead_id, selectedChatId]);

  useEffect(() => {
    followUpGenerationRequestIdRef.current += 1;
    setFollowUpModalOpen(false);
    setGeneratingFollowUp(false);
    resetFollowUpComposer();

    if (!selectedChat?.lead_id) {
      leadPanelRequestIdRef.current += 1;
      leadContractsRequestIdRef.current += 1;
      chatAgendaSummaryRequestIdRef.current += 1;
      chatAgendaSummaryLeadIdRef.current = null;
      setLeadPanel(null);
      setLeadPanelLoading(false);
      setLeadContracts([]);
      setLeadContractsLoading(false);
      setLeadContractsError(null);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryLoading(false);
      return;
    }

    if (leadPanel?.id !== selectedChat.lead_id) {
      chatAgendaSummaryLeadIdRef.current = null;
      setLeadPanel(null);
      setLeadContracts([]);
      setLeadContractsError(null);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      setChatAgendaSummaryLoading(true);
    }
  }, [leadPanel?.id, resetFollowUpComposer, selectedChat?.id, selectedChat?.lead_id]);

  useEffect(() => {
    if (!selectedChat?.lead_id) {
      setLeadPanel(null);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
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

    const channel = supabase
      .channel(`whatsapp-chat-agenda-summary-${leadPanel.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
        },
        () => {
          void loadChatAgendaSummary(
            leadPanel.id,
            leadContracts.map((contract) => contract.id),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadContracts, leadPanel?.id, loadChatAgendaSummary]);

  useEffect(() => {
    if (!leadDrawerOpen || !selectedChat || selectedChat.lead_id) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshDrawerSearch(leadSearchQuery, selectedChat.phone_number);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [leadDrawerOpen, leadSearchQuery, refreshDrawerSearch, selectedChat]);

  useEffect(() => {
    if (!startChatModalOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshStartChatSources(startChatQuery, 1, false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [refreshStartChatSources, startChatModalOpen, startChatQuery]);

  const handleLoadMoreSavedContacts = useCallback(() => {
    if (!savedContactsHasMore || savedContactsLoadingMore || savedContactsLoading) {
      return;
    }

    void refreshStartChatSources(startChatQuery, savedContactsPage + 1, true);
  }, [refreshStartChatSources, savedContactsHasMore, savedContactsLoading, savedContactsLoadingMore, savedContactsPage, startChatQuery]);

  useEffect(() => {
    const map = new Map(savedContactNameByPhoneRef.current);
    addSavedContactsToNameMap(map, savedContacts);
    savedContactNameByPhoneRef.current = map;
    setChats((current) => applyFrontendSavedContactNames(current));
  }, [applyFrontendSavedContactNames, savedContacts]);

  const loadChats = useCallback(async (loadOptions: { sections?: Array<'active' | 'archived'> } = {}) => {
    // BUG FIX (BUG #7): por default carregamos APENAS a secao que o usuario
    // esta visualizando. Os chats da outra secao continuam em memoria (e sao
    // recarregados sob demanda quando o usuario alterna). Isso reduz drasticamente
    // o trafego de polling (8s) em contas com muitos chats arquivados.
    const requestedSections = loadOptions.sections
      ?? (archivedSectionOpenRef.current ? (['archived'] as const) : (['active'] as const));

    const loadKey = JSON.stringify({
      activity: chatActivityFilter,
      statuses: leadStatusFilters.map((status) => status.trim()).filter(Boolean).sort(),
      sections: [...requestedSections].sort(),
    });

    if (chatsLoadPromiseRef.current && chatsLoadKeyRef.current === loadKey) {
      return chatsLoadPromiseRef.current;
    }

    chatsLoadKeyRef.current = loadKey;
    const requestId = ++chatsRequestIdRef.current;
    const loadPromise = (async () => {
      try {
        const hasLoadFilters = chatActivityFilter !== 'all' || leadStatusFilters.length > 0;
        const fetchChatSection = async (archivedFilter: 'active' | 'archived') => {
          const all: CommWhatsAppChat[] = [];
          let offset = 0;

          while (true) {
            let page: CommWhatsAppChat[] = [];
            for (let attempt = 0; attempt <= EMPTY_CHAT_LIST_RETRY_DELAYS_MS.length; attempt += 1) {
              page = await commWhatsAppService.listChats({
                activityFilter: chatActivityFilter,
                leadStatusFilters,
                archivedFilter,
                limit: CHAT_PAGE_SIZE,
                offset,
              });

              const shouldRetryEmptyFirstPage = page.length === 0
                && offset === 0
                && !hasLoadFilters
                && archivedFilter === 'active'
                && attempt < EMPTY_CHAT_LIST_RETRY_DELAYS_MS.length;

              if (!shouldRetryEmptyFirstPage) {
                break;
              }

              console.debug('[WhatsAppInbox] lista ativa veio vazia; tentando novamente antes de aceitar estado vazio', {
                attempt: attempt + 1,
                delayMs: EMPTY_CHAT_LIST_RETRY_DELAYS_MS[attempt],
              });
              await waitForChatListRetry(EMPTY_CHAT_LIST_RETRY_DELAYS_MS[attempt]);
            }

            all.push(...page);

            if (page.length < CHAT_PAGE_SIZE) {
              break;
            }

            offset += page.length;
          }

          return all;
        };

        const fetchedSections = await Promise.all(
          requestedSections.map(async (section) => ({ section, data: await fetchChatSection(section) })),
        );

        if (requestId !== chatsRequestIdRef.current) {
          return;
        }

        const fetchedSectionSet = new Set(requestedSections);
        const fetchedChatIds = new Set<string>();
        const fetchedFlat: CommWhatsAppChat[] = [];
        for (const bucket of fetchedSections) {
          for (const chat of bucket.data) {
            fetchedFlat.push(chat);
            fetchedChatIds.add(chat.id);
          }
        }

        const previousChats = latestChatsRef.current;
        const previousChatsById = new Map(previousChats.map((chat) => [chat.id, chat] as const));
        const unexpectedlyEmptySections = new Set(
          fetchedSections
            .filter(({ section, data }) => {
              if (data.length > 0 || hasLoadFilters) {
                return false;
              }

              return previousChats.some((chat) => (
                !chat.deleted_at
                && (chat.is_archived ? 'archived' : 'active') === section
              ));
            })
            .map(({ section }) => section),
        );

        if (unexpectedlyEmptySections.size > 0) {
          console.debug('[WhatsAppInbox] refetch de chats retornou secao vazia; preservando lista atual', {
            sections: Array.from(unexpectedlyEmptySections),
            requestedSections,
            previousChatsLen: previousChats.length,
          });
        }

        const preservedFromOtherSections = previousChats.filter((chat) => {
          if (chat.deleted_at) {
            return false;
          }

          const sectionOfChat = chat.is_archived ? 'archived' : 'active';
          if (fetchedSectionSet.has(sectionOfChat)) {
            // se a secao foi recarregada, removemos chats antigos que nao vieram
            // exceto quando a resposta veio vazia de forma transitória; nesse
            // caso manter o cache evita a sidebar colapsar para o chat aberto.
            return unexpectedlyEmptySections.has(sectionOfChat) && !fetchedChatIds.has(chat.id);
          }
          return !fetchedChatIds.has(chat.id);
        });

        const mergedData = [...fetchedFlat, ...preservedFromOtherSections];

        const refreshedChats = applyPendingChatInboxState(
          applyFrontendSavedContactNames(
            applyPrefetchedLeadNames(mergedData.map((chat) => preserveUsefulChatPreview(chat, previousChatsById.get(chat.id) ?? null))),
          ),
          pendingChatInboxStateRef.current,
        );
        const currentSelectedChatId = selectedChatIdRef.current;
        const preservedSelectedChat = currentSelectedChatId
          ? previousChats.find((chat) => chat.id === currentSelectedChatId) ?? null
          : null;
        const shouldPreserveSelectedChat = Boolean(
          preservedSelectedChat
            && !refreshedChats.some((chat) => chat.id === preservedSelectedChat.id),
        );
        const hydratedData = sortChatsByInboxOrder(
          shouldPreserveSelectedChat && preservedSelectedChat
            ? [...refreshedChats, preservedSelectedChat]
            : refreshedChats,
        );

        const nextSignature = buildChatsSignature(hydratedData);

        if (nextSignature !== chatsSignatureRef.current) {
          chatsSignatureRef.current = nextSignature;
          setChats(hydratedData);
        }

        const requestedChatId = chatIdFromUrlRef.current;
        const requestedChat = requestedChatId
          ? hydratedData.find((chat) => chat.id === requestedChatId) ?? null
          : null;
        if (requestedChat) {
          setArchivedSectionOpen(Boolean(requestedChat.is_archived));
        }

        setSelectedChatId((current) => {
          if (requestedChat) {
            return requestedChat.id;
          }

          if (requestedChatId && current === requestedChatId) {
            return current;
          }

          if (current && hydratedData.some((chat) => chat.id === current)) {
            return current;
          }

          return hydratedData.find((chat) => !chat.is_archived)?.id ?? hydratedData[0]?.id ?? null;
        });
        chatPollBackoffRef.current = 0;
      } catch (error) {
        if (requestId !== chatsRequestIdRef.current) {
          return;
        }

        console.error('[WhatsAppInbox] erro ao carregar chats', error);

        if (isSupabaseConnectivityError(error)) {
          chatPollBackoffRef.current = Math.min(chatPollBackoffRef.current + 1, 10);
          return;
        }

        toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as conversas do WhatsApp.');
      }
    })().finally(() => {
      latestChatsLoadedAtRef.current = Date.now();
      if (chatsLoadPromiseRef.current === loadPromise) {
        chatsLoadPromiseRef.current = null;
        chatsLoadKeyRef.current = null;
      }
    });

    chatsLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }, [applyFrontendSavedContactNames, applyPrefetchedLeadNames, buildChatsSignature, chatActivityFilter, leadStatusFilters]);

  loadChatsRef.current = loadChats;

  const handleSwitchArchivedSection = useCallback((nextArchivedSectionOpen: boolean) => {
    setArchivedSectionOpen(nextArchivedSectionOpen);

    const currentSelectedChat = selectedChatIdRef.current
      ? latestChatsRef.current.find((chat) => chat.id === selectedChatIdRef.current) ?? null
      : null;

    if (currentSelectedChat && Boolean(currentSelectedChat.is_archived) !== nextArchivedSectionOpen) {
      const nextChat = sortChatsByInboxOrder(latestChatsRef.current.filter((candidate) => (
        candidate.id !== currentSelectedChat.id
        && Boolean(candidate.is_archived) === nextArchivedSectionOpen
        && chatMatchesActiveFilters(candidate)
      )))[0] ?? null;
      chatIdFromUrlRef.current = nextChat?.id ?? null;
      setSelectedChatId(nextChat?.id ?? null);
    }

    void loadChats({ sections: nextArchivedSectionOpen ? ['archived', 'active'] : ['active'] });
  }, [chatMatchesActiveFilters, loadChats]);

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

  const loadMessages = useCallback(async (chat: CommWhatsAppChat | null, reason: MessageLoadReason = 'poll') => {
    const targetChatId = chat?.id ?? selectedChatIdRef.current;
    if (!targetChatId) {
      setMessages([]);
      return;
    }

    if (reason === 'poll' && pollingMessagesChatIdRef.current === targetChatId) {
      return;
    }

    if (reason === 'poll') {
      pollingMessagesChatIdRef.current = targetChatId;
    }

    const requestId = ++messagesRequestIdRef.current;

    const shouldShowBlockingLoader = reason === 'initial' && messagesSignatureRef.current === '';

    if (shouldShowBlockingLoader) {
      setLoadingMessages(true);
    }

    try {
      let data: CommWhatsAppMessage[] = [];
      let hasMore = false;
      let threadChat: CommWhatsAppChat | null = null;
      let threadLead: CommWhatsAppLeadPanel | null = null;

      if (reason === 'initial') {
        const thread = await commWhatsAppService.getChatThread(targetChatId, {
          limit: MESSAGE_PAGE_SIZE,
        });

        data = thread.messages;
        hasMore = thread.hasMore;
        threadChat = thread.chat;
        threadLead = thread.lead;

        if (data.length === 0 && Boolean(thread.chat.last_message_at || thread.chat.last_message_text?.trim())) {
          setThreadReconcileChatId(targetChatId);
          console.warn('[WhatsAppInbox] thread retornou vazio apesar de preview', {
            chatId: targetChatId,
          });
        }
      } else {
        const page = await commWhatsAppService.listMessagesPage(targetChatId, {
          limit: MESSAGE_PAGE_SIZE,
        });

        data = page.messages;
        hasMore = page.hasMore;
      }

      if (requestId !== messagesRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }

      if (threadChat) {
        upsertChatLocally(threadChat);
      }

      if (threadLead) {
        setLeadPanel(threadLead);
      }

      const stillEmptyDespitePreview = reason === 'initial'
        && data.length === 0
        && Boolean(threadChat?.last_message_at || threadChat?.last_message_text?.trim());
      setThreadReconcileChatId(stillEmptyDespitePreview ? targetChatId : null);

      const orderedData = data.map(applyOutgoingOrderToServerMessage);
      const nextMessages = reason === 'initial' ? orderedData : mergeMessages(latestMessagesRef.current, orderedData);
      const nextSignature = buildMessagesSignature(nextMessages);
      setLocalOutgoingMessages((current) => {
        const nextLocalMessages: CommWhatsAppMessage[] = [];

        for (const message of current) {
          if (message.chat_id !== targetChatId) {
            nextLocalMessages.push(message);
            continue;
          }

          const externalId = String(message.external_message_id ?? '').trim();
          const syncedServerMessage = nextMessages.find((serverMessage) => messagesReferToSameOutgoing(message, serverMessage)) ?? null;
          const alreadySynced = Boolean(syncedServerMessage);

          if (alreadySynced) {
            rememberOutgoingMessageOrder(message);
            localOutgoingRetryPayloadRef.current.delete(message.id);
            const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(message.id);
            const syncedExternalMessageId = String(syncedServerMessage?.external_message_id ?? externalId).trim();
            if (previewUrl && syncedExternalMessageId) {
              commWhatsAppService.rememberLocalMediaPreview(syncedExternalMessageId, previewUrl);
            }
            localOutgoingMediaPreviewUrlsRef.current.delete(message.id);
            continue;
          }

          nextLocalMessages.push(message);
        }

        return nextLocalMessages;
      });

      if (nextSignature === messagesSignatureRef.current) {
        if (reason === 'initial') {
          setHasOlderMessages(hasMore);
        }
        return;
      }

      messagesSignatureRef.current = nextSignature;
      if (reason === 'initial') {
        setHasOlderMessages(hasMore);
      }

      if (reason === 'initial' || reason === 'send' || isNearBottomRef.current) {
        pendingScrollModeRef.current = 'bottom';
        pendingScrollTopRef.current = null;
        pendingScrollHeightRef.current = null;
      } else {
        pendingScrollModeRef.current = 'preserve';
        pendingScrollTopRef.current = messagesContainerRef.current?.scrollTop ?? 0;
        pendingScrollHeightRef.current = null;
      }

      setMessages(nextMessages);
    } catch (error) {
      if (requestId !== messagesRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar mensagens', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as mensagens da conversa.');
    } finally {
      if (shouldShowBlockingLoader && requestId === messagesRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setLoadingMessages(false);
      }

      if (reason === 'poll' && pollingMessagesChatIdRef.current === targetChatId) {
        pollingMessagesChatIdRef.current = null;
      }
    }
  }, [applyOutgoingOrderToServerMessage, buildMessagesSignature, rememberOutgoingMessageOrder, upsertChatLocally]);

  loadMessagesRef.current = loadMessages;

  const handleSelectMessageSearchResult = useCallback((result: CommWhatsAppMessageSearchResult) => {
    const targetChat = result.chat;
    const targetMessageId = result.message.id;
    const requestId = ++messageSearchSelectionRequestIdRef.current;

    setChatMenuPointerAnchor(null);
    setOpenChatMenuChatId(null);
    upsertChatLocally(targetChat);

    if (selectedChatIdRef.current !== targetChat.id) {
      pendingMessageSearchChatIdRef.current = targetChat.id;
      selectedChatIdRef.current = targetChat.id;
      setSelectedChatId(targetChat.id);
    }

    if (latestMessagesRef.current.some((message) => message.id === targetMessageId)) {
      setHighlightedMessageId(targetMessageId);
      return;
    }

    setLoadingMessages(true);

    void commWhatsAppService.listMessageContext(targetChat.id, targetMessageId).then((contextMessages) => {
      if (requestId !== messageSearchSelectionRequestIdRef.current || selectedChatIdRef.current !== targetChat.id) {
        return;
      }

      const nextMessages = contextMessages.length > 0
        ? mergeMessages(contextMessages, [result.message])
        : [result.message];

      messagesSignatureRef.current = buildMessagesSignature(nextMessages);
      pendingScrollModeRef.current = null;
      pendingScrollTopRef.current = null;
      pendingScrollHeightRef.current = null;
      pendingMessageSearchChatIdRef.current = null;
      setHasOlderMessages(nextMessages.length > 0);
      setMessages(nextMessages);
      setHighlightedMessageId(targetMessageId);
    }).catch((error) => {
      if (requestId !== messageSearchSelectionRequestIdRef.current || selectedChatIdRef.current !== targetChat.id) {
        return;
      }

      pendingMessageSearchChatIdRef.current = null;
      console.error('[WhatsAppInbox] erro ao carregar contexto da mensagem buscada', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a mensagem encontrada.');
      void loadMessages(targetChat, 'initial');
    }).finally(() => {
      if (requestId === messageSearchSelectionRequestIdRef.current && selectedChatIdRef.current === targetChat.id) {
        setLoadingMessages(false);
      }
    });
  }, [buildMessagesSignature, loadMessages, upsertChatLocally]);

  const handleToggleChatMessageSearch = useCallback(() => {
    setChatMessageSearchOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        window.setTimeout(() => chatMessageSearchInputRef.current?.focus(), 0);
      }
      return nextOpen;
    });
  }, []);

  const handleSelectChatMessageSearchResult = useCallback((result: CommWhatsAppMessageSearchResult) => {
    handleSelectMessageSearchResult(result);
    window.setTimeout(() => composerTextareaRef.current?.focus(), 0);
  }, [handleSelectMessageSearchResult]);

  useEffect(() => {
    chatMessageSearchRequestIdRef.current += 1;
    setChatMessageSearchDraft('');
    setChatMessageSearchResults([]);
    setSearchingChatMessages(false);
    setChatMessageSearchOpen(false);
  }, [selectedChatId]);

  useEffect(() => {
    if (!chatMessageSearchOpen || !selectedChat?.id || !chatMessageSearch) {
      chatMessageSearchRequestIdRef.current += 1;
      setChatMessageSearchResults([]);
      setSearchingChatMessages(false);
      return;
    }

    const requestId = ++chatMessageSearchRequestIdRef.current;
    setSearchingChatMessages(true);

    const timeoutId = window.setTimeout(() => {
      void commWhatsAppService.searchMessages({
        search: chatMessageSearch,
        chatIds: [selectedChat.id],
        archivedFilter: 'all',
        limit: 50,
      }).then((results) => {
        if (requestId !== chatMessageSearchRequestIdRef.current || selectedChatIdRef.current !== selectedChat.id) {
          return;
        }

        const seen = new Set<string>();
        setChatMessageSearchResults(results.filter((result) => {
          if (seen.has(result.message.id)) {
            return false;
          }

          seen.add(result.message.id);
          return true;
        }));
      }).catch((error) => {
        if (requestId !== chatMessageSearchRequestIdRef.current || selectedChatIdRef.current !== selectedChat.id) {
          return;
        }

        console.error('[WhatsAppInbox] erro ao buscar mensagens no chat', error);
        setChatMessageSearchResults([]);
      }).finally(() => {
        if (requestId === chatMessageSearchRequestIdRef.current && selectedChatIdRef.current === selectedChat.id) {
          setSearchingChatMessages(false);
        }
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [chatMessageSearch, chatMessageSearchOpen, selectedChat?.id]);

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

  const scheduleMessageStatusRefresh = useCallback((params: {
    chat: CommWhatsAppChat;
    externalMessageIds: string[];
  }) => {
    const externalMessageIds = Array.from(new Set(params.externalMessageIds.map((id) => id.trim()).filter(Boolean))).slice(0, 20);
    if (externalMessageIds.length === 0) {
      return;
    }

    for (const delayMs of MESSAGE_STATUS_REFRESH_DELAYS_MS) {
      const timeoutId = window.setTimeout(() => {
        statusRefreshTimeoutsRef.current = statusRefreshTimeoutsRef.current.filter((id) => id !== timeoutId);

        void commWhatsAppService.refreshMessageStatuses({
          chatId: params.chat.external_chat_id,
          externalMessageIds,
          limit: externalMessageIds.length,
        }).then((result) => {
          if (result.refreshed.length === 0) {
            return;
          }

          const refreshedByExternalId = new Map(result.refreshed.map((item) => [item.external_message_id, item]));
          setLocalOutgoingMessages((current) => current.map((message) => {
            const externalMessageId = String(message.external_message_id ?? '').trim();
            const refreshed = externalMessageId ? refreshedByExternalId.get(externalMessageId) : null;
            if (!refreshed) {
              return message;
            }

            const resolvedStatus = resolveDeliveryStatus(message.delivery_status, refreshed.delivery_status) ?? message.delivery_status;
            if (message.delivery_status === resolvedStatus) {
              return message;
            }

            return {
              ...message,
              delivery_status: resolvedStatus,
              status_updated_at: new Date().toISOString(),
            };
          }));

          if (result.updated > 0 || result.refreshed.some((item) => !REFRESHABLE_OUTBOUND_STATUSES.has(normalizeDeliveryStatus(item.delivery_status)))) {
            void Promise.all([loadMessages(params.chat, 'send'), loadChats()]).catch((error) => {
              console.error('[WhatsAppInbox] erro ao recarregar apos atualizar status ativo', error);
            });
          }
        }).catch((error) => {
          console.error('[WhatsAppInbox] erro ao atualizar status ativo da mensagem', error);
        });
      }, delayMs);

      statusRefreshTimeoutsRef.current.push(timeoutId);
    }
  }, [loadChats, loadMessages]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      await Promise.all([loadChats({ sections: ['active'] }), loadOperationalState()]);
      if (active) {
        setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadChats, loadOperationalState]);

  useEffect(() => {
    const channel = supabase
      .channel(`comm-whatsapp-chats-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comm_whatsapp_chats',
        },
        applyRealtimeChatChange,
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[WhatsAppInbox] realtime de chats indisponivel; polling permanece ativo.');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyRealtimeChatChange]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      setLoadingMessages(false);
      setThreadReconcileChatId(null);
      lastSelectedChatPreviewRefreshKeyRef.current = '';
      setLoadingOlderMessages(false);
      setHasOlderMessages(false);
      setPendingAttachments([]);
      setReplyTargetMessage(null);
      cancelVoiceRecordingRef.current();
      messagesSignatureRef.current = '';
      pendingMessageSearchChatIdRef.current = null;
      return;
    }

    messagesSignatureRef.current = '';
    pendingScrollModeRef.current = 'bottom';
    pendingScrollTopRef.current = null;
    pendingScrollHeightRef.current = null;
    isNearBottomRef.current = true;
    setPendingAttachments([]);
    setReplyTargetMessage(null);
    cancelVoiceRecordingRef.current();
    setLoadingOlderMessages(false);
    setHasOlderMessages(false);
    setThreadReconcileChatId(null);
    lastSelectedChatPreviewRefreshKeyRef.current = '';
    setMessages([]);

    if (pendingMessageSearchChatIdRef.current === selectedChatId) {
      return;
    }

    void loadMessages(getSelectedChatSnapshot(selectedChatId), 'initial');
  }, [getSelectedChatSnapshot, loadMessages, selectedChatId]);

  useEffect(
    () => () => {
      mediaUploadAbortControllerRef.current?.abort();
      cancelVoiceRecordingRef.current();
      for (const timeoutId of statusRefreshTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      statusRefreshTimeoutsRef.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    let timeoutId: number;

    const scheduleNext = () => {
      const backoffLevel = chatPollBackoffRef.current;
      const delay = backoffLevel > 0
        ? Math.min(CHAT_POLL_INTERVAL_MS * Math.pow(2, backoffLevel), MAX_CHAT_POLL_BACKOFF_MS)
        : CHAT_POLL_INTERVAL_MS;

      timeoutId = window.setTimeout(() => {
        void loadChats();
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => window.clearTimeout(timeoutId);
  }, [loadChats, pollingEnabled]);

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadOperationalState();
    }, OPERATIONAL_STATE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadOperationalState, pollingEnabled]);

  useEffect(() => {
    if (!pollingEnabled || !selectedChat) return;

    // BUG FIX (BUG #16): nao pausamos mais o polling de mensagens enquanto
    // o "Carregar mais antigas" esta em andamento. O proprio loadMessages
    // ja respeita pollingMessagesChatIdRef para evitar requests concorrentes.
    const intervalId = window.setInterval(() => {
      if (loadingOlderMessages) {
        return;
      }
      void loadMessages(getSelectedChatSnapshot(selectedChat.id), 'poll');
    }, MESSAGE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [getSelectedChatSnapshot, loadMessages, loadingOlderMessages, pollingEnabled, selectedChat]);

  useEffect(() => {
    if (!selectedChat || loadingOlderMessages) {
      return;
    }

    const previewKey = [
      selectedChat.id,
      selectedChat.last_message_at ?? '',
      selectedChat.last_message_text ?? '',
      selectedChat.last_message_direction ?? '',
    ].join(':');

    if (!selectedChat.last_message_at || messagesSignatureRef.current === '' || previewKey === lastSelectedChatPreviewRefreshKeyRef.current) {
      return;
    }

    const selectedLastMessageAtMs = getMessageTimestampMs(selectedChat.last_message_at);
    const latestRenderedMessageAtMs = latestMessagesRef.current
      .filter((message) => message.chat_id === selectedChat.id)
      .reduce<number | null>((latest, message) => {
        const messageAt = getMessageTimestampMs(message.message_at);
        if (messageAt === null) {
          return latest;
        }
        return latest === null || messageAt > latest ? messageAt : latest;
      }, null);

    if (selectedLastMessageAtMs !== null && latestRenderedMessageAtMs !== null && latestRenderedMessageAtMs >= selectedLastMessageAtMs) {
      lastSelectedChatPreviewRefreshKeyRef.current = previewKey;
      return;
    }

    lastSelectedChatPreviewRefreshKeyRef.current = previewKey;
    void loadMessages(getSelectedChatSnapshot(selectedChat.id), 'poll');
  }, [getSelectedChatSnapshot, loadMessages, loadingOlderMessages, selectedChat]);

  useEffect(() => {
    if (!pollingEnabled || !selectedChat) {
      return;
    }

    const pendingExternalIds = visibleMessages
      .filter((message) => message.direction === 'outbound')
      .filter((message) => REFRESHABLE_OUTBOUND_STATUSES.has(String(message.delivery_status ?? '').trim().toLowerCase()))
      .map((message) => String(message.external_message_id ?? '').trim())
      .filter(Boolean)
      .slice(-10);

    if (pendingExternalIds.length === 0) {
      lastPendingStatusRefreshKeyRef.current = '';
      return;
    }

    const refreshKey = `${selectedChat.id}:${pendingExternalIds.join('|')}`;
    if (lastPendingStatusRefreshKeyRef.current === refreshKey) {
      return;
    }

    lastPendingStatusRefreshKeyRef.current = refreshKey;
    scheduleMessageStatusRefresh({
      chat: selectedChat,
      externalMessageIds: pendingExternalIds,
    });
  }, [pollingEnabled, scheduleMessageStatusRefresh, selectedChat, visibleMessages]);

  useEffect(() => {
    if (!pollingEnabled || loading) {
      return;
    }

    // BUG FIX (BUG #6): throttle do refocus refresh. Evita disparar
    // loadChats() em cima de uma mutation otimista recente. A janela de
    // 3s alinha com o objetivo do polling normal sem multiplicar fontes.
    const REFOCUS_THROTTLE_MS = 3_000;
    const elapsed = Date.now() - latestChatsLoadedAtRef.current;
    if (elapsed < REFOCUS_THROTTLE_MS) {
      return;
    }

    void loadChats();
    void loadOperationalState();

    if (selectedChatIdRef.current && !loadingOlderMessages) {
      void loadMessages(getSelectedChatSnapshot(selectedChatIdRef.current), 'poll');
    }
  }, [getSelectedChatSnapshot, loadChats, loadMessages, loadOperationalState, loading, loadingOlderMessages, pollingEnabled]);

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

    void commWhatsAppService.markChatRead(currentChat.id, {
      messageAt: readAt,
    }).then((result) => {
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
    }).catch((error) => {
      clearPendingChatReadState(pendingChatInboxStateRef.current, currentChat.id);
      console.error('[WhatsAppInbox][mark-read] request:error', {
        source,
        chatId: currentChat.id,
        readAt,
        readKey,
        error,
      });
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel marcar a conversa como lida.');
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

  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedChat || loadingOlderMessages || !hasOlderMessages || latestMessagesRef.current.length === 0) {
      return;
    }

    const targetChatId = selectedChat.id;
    const requestId = ++olderMessagesRequestIdRef.current;
    const oldestMessage = latestMessagesRef.current[0];
    const container = messagesContainerRef.current;

    setLoadingOlderMessages(true);

    try {
      const page = await commWhatsAppService.listMessagesPage(selectedChat.id, {
        limit: MESSAGE_PAGE_SIZE,
        before: {
          messageAt: oldestMessage.message_at,
          id: oldestMessage.id,
        },
      });

      if (requestId !== olderMessagesRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }

      const nextMessages = mergeMessages(page.messages, latestMessagesRef.current);
      const nextSignature = buildMessagesSignature(nextMessages);

      setHasOlderMessages(page.hasMore);

      if (nextSignature === messagesSignatureRef.current) {
        return;
      }

      messagesSignatureRef.current = nextSignature;
      pendingScrollModeRef.current = 'prepend';
      pendingScrollTopRef.current = container?.scrollTop ?? 0;
      pendingScrollHeightRef.current = container?.scrollHeight ?? 0;
      setMessages(nextMessages);
    } catch (error) {
      if (requestId !== olderMessagesRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar mensagens antigas', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar mensagens mais antigas.');
    } finally {
      if (requestId === olderMessagesRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setLoadingOlderMessages(false);
      }
    }
  }, [buildMessagesSignature, hasOlderMessages, loadingOlderMessages, selectedChat]);

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

  const handleAttachmentMenuAction = (action: AttachmentMenuAction) => {
    if (voiceRecordingState !== 'idle') {
      return;
    }

    if (action === 'contact') {
      setAttachmentMenuOpen(false);
      return;
    }

    const nextAccept = action === 'document'
      ? DOCUMENT_ATTACHMENT_ACCEPT
      : action === 'audio'
        ? AUDIO_ATTACHMENT_ACCEPT
        : MEDIA_ATTACHMENT_ACCEPT;

    setAttachmentInputAccept(nextAccept);

    setAttachmentMenuOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = nextAccept;
    }
    fileInputRef.current?.click();
  };

  const handleAttachmentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (voiceRecordingState !== 'idle') {
      event.target.value = '';
      return;
    }

    const nextFiles = Array.from(event.target.files ?? []);
    if (nextFiles.length === 0) {
      event.target.value = '';
      return;
    }

    const nextAttachments = nextFiles.map(createPendingAttachmentFromFile);

    setPendingAttachments((current) => {
      const preserved = current.filter((attachment) => attachment.kind !== 'voice');
      return [...preserved, ...nextAttachments];
    });

    event.target.value = '';
  };

  const handleComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (voiceRecordingState !== 'idle' || generatingFollowUp) {
      return;
    }

    const clipboardItems = Array.from(event.clipboardData.items ?? []);
    const imageFilesFromItems = clipboardItems
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const imageFiles = imageFilesFromItems.length > 0
      ? imageFilesFromItems
      : Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();

    const pastedAttachments = imageFiles
      .map(normalizePastedImageFile)
      .map(createPendingAttachmentFromFile);

    setPendingAttachments((current) => {
      const preserved = current.filter((attachment) => attachment.kind !== 'voice');
      return [...preserved, ...pastedAttachments];
    });
  };

  const handleClearAttachment = (attachmentId?: string) => {
    if (!attachmentId || pendingAttachments.find((a) => a.id === attachmentId)?.kind === 'voice') {
      handleClearVoiceAttachmentFromHook();
    }
    setPendingAttachments((current) => {
      if (!attachmentId) {
        return [];
      }
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
    setMediaUploadProgress(null);
  };

  const handleSendCurrentVoiceRecording = () => {
    if (voiceRecordingState === 'recording') {
      handleStopVoiceRecording(true);
      return;
    }

    if (voiceAttachment) {
      void handleSendMessage();
    }
  };

  const sendTextSegments = useCallback((chat: CommWhatsAppChat, textSegments: string[], quotePayload: OutgoingQuotePayload | null = null) => {
    if (textSegments.length === 0) {
      return;
    }

    const optimisticTimestamps = allocateOptimisticMessageTimestamps(chat.id, textSegments.length);
    const queuedMessages: QueuedTextMessage[] = textSegments.map((segment, index) => {
      const clientRequestId = createClientRequestId();
      const optimisticMessage = buildOptimisticOutgoingMessage({
        chat,
        messageType: 'text',
        textContent: segment,
        clientRequestId,
        messageAt: optimisticTimestamps[index],
        metadata: quotePayload && index === 0
          ? {
              quote: {
                external_message_id: quotePayload.quotedMessageId,
                author_phone: quotePayload.quotedAuthorPhone || null,
                quoted_type: quotePayload.quotedType || null,
                preview_text: quotePayload.quotedPreviewText || null,
              },
            }
          : undefined,
      });

      appendLocalOutgoingMessage(optimisticMessage, {
        kind: 'text',
        text: segment,
        clientRequestId,
      });
      applyOptimisticChatSummary(chat, segment, optimisticMessage.message_at);

      return { segment, optimisticMessage, clientRequestId };
    });

    enqueueChatSend(chat.id, async () => {
      let hadSuccessfulSend = false;

      for (const queued of queuedMessages) {
        try {
          const sendResult = await commWhatsAppService.sendTextMessage(chat.external_chat_id, queued.segment, {
            clientRequestId: queued.clientRequestId,
            ...(quotePayload && queued === queuedMessages[0] ? quotePayload : {}),
          });
          hadSuccessfulSend = true;
          patchLocalOutgoingMessage(queued.optimisticMessage.id, {
            external_message_id: sendResult.messageId,
            delivery_status: sendResult.status,
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });
          updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, sendResult.status);
          if (sendResult.messageId && REFRESHABLE_OUTBOUND_STATUSES.has(sendResult.status.trim().toLowerCase())) {
            scheduleMessageStatusRefresh({
              chat,
              externalMessageIds: [sendResult.messageId],
            });
          }
          localOutgoingRetryPayloadRef.current.delete(queued.optimisticMessage.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
          patchLocalOutgoingMessage(queued.optimisticMessage.id, {
            delivery_status: 'failed',
            status_updated_at: new Date().toISOString(),
            error_message: message,
          });
          updateOptimisticChatPreviewStatus(chat.id, queued.optimisticMessage.message_at, 'failed');
        }
      }

      if (hadSuccessfulSend) {
        // BUG FIX (BUG #13): erro de pós-envio agora avisa o usuário
        // de forma discreta (warning), em vez de falhar silenciosamente.
        void Promise.all([loadMessages(chat, 'send'), loadChats()]).catch((error) => {
          console.error('[WhatsAppInbox] erro ao atualizar conversa apos envio de texto', error);
          toast.warning('Mensagem enviada, mas houve um erro ao atualizar a lista. Atualize a pagina se necessario.');
        });
      }
    });
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, enqueueChatSend, loadChats, loadMessages, patchLocalOutgoingMessage, scheduleMessageStatusRefresh, updateOptimisticChatPreviewStatus]);

  const handleSendMessage = useCallback(() => {
    if (!selectedChat) return;

    const resolvedMessageDraft = resolveComposerVariables(messageDraft);
    const text = resolvedMessageDraft.trim();
    const textSegments = splitWhatsAppMessageSegments(resolvedMessageDraft);
    const attachmentsSnapshot = [...pendingAttachments];
    if (!text && attachmentsSnapshot.length === 0) return;

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    const snapshotKey = buildComposerQueueSnapshotKey(selectedChat.id, messageDraft, attachmentsSnapshot);
    if (composerQueueSnapshotKeysRef.current.has(snapshotKey)) {
      return;
    }

    composerQueueSnapshotKeysRef.current.add(snapshotKey);
    releaseComposerQueueSnapshotKeySoon(snapshotKey);

    resetComposerAfterQueue();

    try {
      const replyTargetSnapshot = replyTargetMessage;
      const quotePayload = replyTargetSnapshot ? getQuotePayloadFromMessage(replyTargetSnapshot) : null;
      if (attachmentsSnapshot.length > 0) {
        const optimisticTimestamps = allocateOptimisticMessageTimestamps(selectedChat.id, attachmentsSnapshot.length);
        const attachmentsToSend = attachmentsSnapshot.map((attachment, index) => {
          const caption = index === 0 && attachment.kind !== 'voice' ? text || undefined : undefined;
          const clientRequestId = createClientRequestId();
          const localPreviewUrl = attachment.previewUrl?.startsWith('blob:') ? URL.createObjectURL(attachment.file) : attachment.previewUrl ?? null;
          const optimisticMessage = buildOptimisticOutgoingMessage({
            chat: selectedChat,
            messageType: attachment.kind,
            textContent: buildMediaSummaryText(attachment.kind),
            clientRequestId,
            messageAt: optimisticTimestamps[index],
            mediaUrl: localPreviewUrl,
            mediaMimeType: attachment.file.type || null,
            mediaFileName: attachment.file.name,
            mediaSizeBytes: attachment.file.size,
            mediaDurationSeconds: attachment.durationSeconds ?? null,
            mediaCaption: attachment.kind === 'voice' ? null : caption ?? null,
            metadata: quotePayload && index === 0
              ? {
                  quote: {
                    external_message_id: quotePayload.quotedMessageId,
                    author_phone: quotePayload.quotedAuthorPhone || null,
                    quoted_type: quotePayload.quotedType || null,
                    preview_text: quotePayload.quotedPreviewText || null,
                  },
                }
              : undefined,
          });

          appendLocalOutgoingMessage(optimisticMessage, {
            kind: 'media',
            mediaKind: attachment.kind,
            file: attachment.file,
            caption,
            durationSeconds: attachment.durationSeconds,
            waveform: attachment.waveformPayload || undefined,
            fileName: attachment.file.name,
            previewUrl: localPreviewUrl,
            clientRequestId,
          });
          applyOptimisticChatSummary(selectedChat, optimisticMessage.text_content ?? '', optimisticMessage.message_at);

          return { attachment, caption, optimisticMessage, clientRequestId };
        });

        enqueueChatSend(selectedChat.id, async () => {
          let shouldStopQueue = false;
          let hadSuccessfulSend = false;
          let firstErrorMessage = '';
          let hadAmbiguousSend = false;

          try {
            for (let index = 0; index < attachmentsToSend.length; index += 1) {
              const queued = attachmentsToSend[index];

              if (shouldStopQueue) {
                patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                  delivery_status: 'failed',
                  status_updated_at: new Date().toISOString(),
                  error_message: 'Envio interrompido antes deste item. Toque em reenviar para tentar novamente.',
                });
                updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, 'failed');
                continue;
              }

              setMediaUploadProgress({
                attachmentId: queued.optimisticMessage.id,
                currentIndex: index + 1,
                total: attachmentsToSend.length,
                progress: 0,
                fileName: queued.attachment.file.name,
              });
              mediaUploadAbortControllerRef.current = new AbortController();

              try {
                const sendResult = await commWhatsAppService.sendMediaMessage({
                  chatId: selectedChat.external_chat_id,
                  kind: queued.attachment.kind,
                  file: queued.attachment.file,
                  caption: queued.caption,
                  durationSeconds: queued.attachment.durationSeconds,
                  waveform: queued.attachment.kind === 'voice' ? queued.attachment.waveformPayload || undefined : undefined,
                  clientRequestId: queued.clientRequestId,
                  ...(quotePayload && index === 0 ? quotePayload : {}),
                  onUploadProgress: (progress) => {
                    setMediaUploadProgress((current) => current?.attachmentId === queued.optimisticMessage.id
                      ? { ...current, progress }
                      : current);
                  },
                  signal: mediaUploadAbortControllerRef.current.signal,
                });

                if (queued.optimisticMessage.media_url && sendResult.messageId) {
                  commWhatsAppService.rememberLocalMediaPreview(sendResult.messageId, queued.optimisticMessage.media_url);
                }

                hadSuccessfulSend = true;
                patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                  external_message_id: sendResult.messageId,
                  delivery_status: sendResult.status,
                  status_updated_at: new Date().toISOString(),
                  error_message: null,
                });
                updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, sendResult.status);
                if (sendResult.messageId && REFRESHABLE_OUTBOUND_STATUSES.has(sendResult.status.trim().toLowerCase())) {
                  scheduleMessageStatusRefresh({
                    chat: selectedChat,
                    externalMessageIds: [sendResult.messageId],
                  });
                }
                if (sendResult.messageId || sendResult.status.trim().toLowerCase() !== 'sending') {
                  localOutgoingRetryPayloadRef.current.delete(queued.optimisticMessage.id);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Não foi possível enviar a mídia.';
                firstErrorMessage = firstErrorMessage || message;
                if (error instanceof CommWhatsAppMediaSendTimeoutError) {
                  hadAmbiguousSend = true;
                  patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                    delivery_status: 'sending',
                    status_updated_at: new Date().toISOString(),
                    error_message: 'Envio ainda em confirmação. Evite reenviar por enquanto.',
                  });
                  updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, 'sending');
                  continue;
                }

                patchLocalOutgoingMessage(queued.optimisticMessage.id, {
                  delivery_status: 'failed',
                  status_updated_at: new Date().toISOString(),
                  error_message: message,
                });
                updateOptimisticChatPreviewStatus(selectedChat.id, queued.optimisticMessage.message_at, 'failed');
                shouldStopQueue = true;
              }
            }
          } finally {
            setMediaUploadProgress(null);
            mediaUploadAbortControllerRef.current = null;
          }

          if (hadSuccessfulSend || hadAmbiguousSend) {
            void (async () => {
              await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
            })().catch((error) => {
              console.error('[WhatsAppInbox] erro ao atualizar conversa apos envio de midia', error);
            });
          }

          if (hadAmbiguousSend) {
            toast.info('Um ou mais arquivos ainda estão confirmando envio. Aguarde antes de reenviar.');
          } else if (firstErrorMessage) {
            if (firstErrorMessage === 'Envio de mídia cancelado.') {
              toast.info('Upload interrompido. As mensagens que falharam permaneceram no chat para reenvio.');
            } else {
              toast.error(firstErrorMessage);
            }
          }
        });
      } else {
        sendTextSegments(selectedChat, textSegments, quotePayload);
      }
      setReplyTargetMessage(null);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar mensagem', error);
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
      toast.error(message);
    }
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, enqueueChatSend, loadChats, loadMessages, messageDraft, patchLocalOutgoingMessage, pendingAttachments, releaseComposerQueueSnapshotKeySoon, replyTargetMessage, resetComposerAfterQueue, resolveComposerVariables, scheduleMessageStatusRefresh, selectedChat, sendDisabledReason, sendTextSegments, updateOptimisticChatPreviewStatus]);

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
    mediaUploadAbortControllerRef.current?.abort();
  };

  const handleRetryMediaMessage = async (message: CommWhatsAppMessage) => {
    if (retryingMessageIdsRef.current.has(message.id)) {
      return;
    }

    retryingMessageIdsRef.current.add(message.id);
    setRetryingMessageId(message.id);

    try {
      const localRetryPayload = localOutgoingRetryPayloadRef.current.get(message.id);

      if (localRetryPayload) {
        let keepRetryPayload = false;
        patchLocalOutgoingMessage(message.id, {
          delivery_status: 'pending',
          status_updated_at: new Date().toISOString(),
          error_message: null,
        });

        const retryClientRequestId = localRetryPayload.clientRequestId || createClientRequestId();
        if (!localRetryPayload.clientRequestId) {
          localOutgoingRetryPayloadRef.current.set(message.id, {
            ...localRetryPayload,
            clientRequestId: retryClientRequestId,
          } as LocalOutgoingRetryPayload);
        }

        if (localRetryPayload.kind === 'text') {
          const sendResult = await commWhatsAppService.sendTextMessage(selectedChat?.external_chat_id || '', localRetryPayload.text, {
            clientRequestId: retryClientRequestId,
          });
          patchLocalOutgoingMessage(message.id, {
            external_message_id: sendResult.messageId,
            delivery_status: sendResult.status,
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });
          if (selectedChat && sendResult.messageId && REFRESHABLE_OUTBOUND_STATUSES.has(sendResult.status.trim().toLowerCase())) {
            scheduleMessageStatusRefresh({
              chat: selectedChat,
              externalMessageIds: [sendResult.messageId],
            });
          }
          keepRetryPayload = !sendResult.messageId && sendResult.status.trim().toLowerCase() === 'sending';
        } else if (localRetryPayload.kind === 'media') {
          const sendResult = await commWhatsAppService.sendMediaMessage({
            chatId: selectedChat?.external_chat_id || '',
            kind: localRetryPayload.mediaKind,
            file: localRetryPayload.file,
            caption: localRetryPayload.caption,
            durationSeconds: localRetryPayload.durationSeconds,
            waveform: localRetryPayload.waveform,
            clientRequestId: retryClientRequestId,
          });
          if (message.media_url && sendResult.messageId) {
            commWhatsAppService.rememberLocalMediaPreview(sendResult.messageId, message.media_url);
          }
          patchLocalOutgoingMessage(message.id, {
            external_message_id: sendResult.messageId,
            delivery_status: sendResult.status,
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });
          if (selectedChat && sendResult.messageId && REFRESHABLE_OUTBOUND_STATUSES.has(sendResult.status.trim().toLowerCase())) {
            scheduleMessageStatusRefresh({
              chat: selectedChat,
              externalMessageIds: [sendResult.messageId],
            });
          }
          keepRetryPayload = !sendResult.messageId && sendResult.status.trim().toLowerCase() === 'sending';
        } else {
          const sendResult = await commWhatsAppService.sendRemoteMediaMessage({
            chatId: selectedChat?.external_chat_id || '',
            kind: localRetryPayload.mediaKind,
            remoteUrl: localRetryPayload.remoteUrl,
            fileName: localRetryPayload.fileName,
            mimeType: localRetryPayload.mimeType,
            caption: localRetryPayload.caption,
            clientRequestId: retryClientRequestId,
          });
          patchLocalOutgoingMessage(message.id, {
            external_message_id: sendResult.messageId,
            delivery_status: sendResult.status,
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });
          if (selectedChat && sendResult.messageId && REFRESHABLE_OUTBOUND_STATUSES.has(sendResult.status.trim().toLowerCase())) {
            scheduleMessageStatusRefresh({
              chat: selectedChat,
              externalMessageIds: [sendResult.messageId],
            });
          }
          keepRetryPayload = !sendResult.messageId && sendResult.status.trim().toLowerCase() === 'sending';
        }

        if (!keepRetryPayload) {
          localOutgoingRetryPayloadRef.current.delete(message.id);
        }
        if (selectedChat) {
          await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
        }
        return;
      }

      if (!message.media_id) {
        removeLocalOutgoingMessage(message.id);
        toast.error('Não foi possível reenviar esta mensagem local.');
        return;
      }

      await commWhatsAppService.retryMediaMessage(message.id, {
        clientRequestId: createClientRequestId(),
      });
      if (selectedChat) {
        await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao reenviar mensagem', error);
      const messageText = error instanceof Error ? error.message : 'Não foi possível reenviar a mensagem.';
      if (error instanceof CommWhatsAppMediaSendTimeoutError) {
        patchLocalOutgoingMessage(message.id, {
          delivery_status: 'sending',
          status_updated_at: new Date().toISOString(),
          error_message: 'Envio ainda em confirmação. Evite reenviar por enquanto.',
        });
        toast.info('Envio ainda em confirmação. Aguarde antes de reenviar.');
        if (selectedChat) {
          void Promise.all([loadMessages(selectedChat, 'send'), loadChats()]).catch((refreshError) => {
            console.error('[WhatsAppInbox] erro ao atualizar conversa apos timeout de reenvio', refreshError);
          });
        }
        return;
      }

      if (localOutgoingRetryPayloadRef.current.has(message.id)) {
        patchLocalOutgoingMessage(message.id, {
          delivery_status: 'failed',
          status_updated_at: new Date().toISOString(),
          error_message: messageText,
        });
      } else {
        toast.error(messageText);
      }
    } finally {
      retryingMessageIdsRef.current.delete(message.id);
      setRetryingMessageId((current) => (current === message.id ? null : current));
    }
  };

  const handleToggleReactionPicker = useCallback((messageId: string) => {
    setOpenMessageActionMenuMessageId(null);
    setOpenReactionPickerMessageId((current) => (current === messageId ? null : messageId));
  }, []);

  const handleReactToMessage = useCallback(async (message: CommWhatsAppMessage, emoji: string) => {
    if (!message.external_message_id) {
      return;
    }

    const chatId = String(message.metadata?.chat_id ?? selectedChat?.external_chat_id ?? '').trim();
    if (!chatId) {
      toast.error('Não foi possível identificar a conversa desta mensagem.');
      return;
    }

    const currentOwnReaction = getOwnReactionEmoji(message);
    const nextEmoji = currentOwnReaction === emoji ? null : emoji;

    setReactingMessageId(message.id);
    setOpenReactionPickerMessageId(null);
    patchMessageReactionLocally(message, nextEmoji);

    try {
      await commWhatsAppService.reactToMessage({
        chatId,
        messageId: message.external_message_id,
        emoji: nextEmoji,
      });
    } catch (error) {
      patchMessageReactionLocally(message, currentOwnReaction);
      console.error('[WhatsAppInbox] erro ao reagir à mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível reagir à mensagem.');
    } finally {
      setReactingMessageId(null);
    }
  }, [patchMessageReactionLocally, selectedChat?.external_chat_id]);

  const handleOpenEditMessageModal = useCallback((message: CommWhatsAppMessage) => {
    if (!canEditOutboundMessage(message)) {
      toast.error('Esta mensagem nao pode ser editada no momento.');
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
      toast.error('Esta mensagem nao pode ser respondida no momento.');
      return;
    }

    setReplyTargetMessage(message);
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
    window.setTimeout(() => composerTextareaRef.current?.focus(), 0);
  }, []);

  const handleOpenForwardMessageModal = useCallback((message: CommWhatsAppMessage) => {
    if (!canReplyOrForwardMessage(message)) {
      toast.error('Esta mensagem nao pode ser encaminhada no momento.');
      return;
    }

    setForwardingMessage(message);
    setForwardSearch('');
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
  }, []);

  const handleCloseForwardMessageModal = useCallback(() => {
    setForwardingMessage(null);
    setForwardSearch('');
    setForwardingChatId(null);
  }, []);

  const handleForwardMessage = useCallback(async (targetChat: CommWhatsAppChat) => {
    if (!forwardingMessage) {
      return;
    }

    setForwardingChatId(targetChat.id);

    try {
      await commWhatsAppService.forwardMessage(forwardingMessage.id, targetChat.external_chat_id);
      await Promise.all([loadChats(), targetChat.id === selectedChatIdRef.current ? loadMessages(targetChat, 'send') : Promise.resolve()]);
      toast.success('Mensagem encaminhada.');
      handleCloseForwardMessageModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao encaminhar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel encaminhar a mensagem.');
    } finally {
      setForwardingChatId(null);
    }
  }, [forwardingMessage, handleCloseForwardMessageModal, loadChats, loadMessages]);

  const handleSaveEditedMessage = useCallback(async () => {
    if (!editingMessage) {
      return;
    }

    const nextText = editingMessageDraft.trim();
    if (!nextText) {
      toast.error('Digite o novo texto da mensagem.');
      return;
    }

    const previousText = getMessageEditableText(editingMessage);
    if (previousText === nextText) {
      handleCloseEditMessageModal();
      return;
    }

    setSavingMessageEdit(true);

    try {
      const result = await commWhatsAppService.editMessage(editingMessage.id, nextText);
      const editedText = result.editedText || nextText;
      const editedAt = result.editedAt || new Date().toISOString();
      const metadata = editingMessage.metadata && typeof editingMessage.metadata === 'object' && !Array.isArray(editingMessage.metadata)
        ? editingMessage.metadata as Record<string, unknown>
        : {};
      const existingHistory = Array.isArray(metadata.edit_history) ? metadata.edit_history : [];
      const isMediaMessage = editingMessage.message_type.trim().toLowerCase() !== 'text';

      patchMessageLocally(editingMessage.id, {
        text_content: editedText,
        media_caption: isMediaMessage ? editedText : editingMessage.media_caption,
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

      if (selectedChat && selectedChat.id === editingMessage.chat_id && selectedChat.last_message_at === editingMessage.message_at) {
        upsertChatLocally({
          ...selectedChat,
          last_message_text: editedText,
          updated_at: editedAt,
        });
      } else {
        setChats((current) => current.map((chat) => chat.id === editingMessage.chat_id && chat.last_message_at === editingMessage.message_at
          ? { ...chat, last_message_text: editedText, updated_at: editedAt }
          : chat));
      }

      toast.success('Mensagem editada no WhatsApp.');
      handleCloseEditMessageModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao editar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel editar a mensagem no WhatsApp.');
    } finally {
      setSavingMessageEdit(false);
    }
  }, [editingMessage, editingMessageDraft, handleCloseEditMessageModal, patchMessageLocally, selectedChat, upsertChatLocally]);

  const handleDeleteMessage = useCallback(async (message: CommWhatsAppMessage) => {
    if (!canDeleteOutboundMessage(message)) {
      toast.error('Esta mensagem nao pode ser apagada no momento.');
      return;
    }

    const confirmed = window.confirm('Apagar esta mensagem no WhatsApp para todos?');
    if (!confirmed) {
      return;
    }

    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
    setDeletingMessageId(message.id);

    try {
      const result = await commWhatsAppService.deleteMessage(message.id);
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
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel apagar a mensagem no WhatsApp.');
    } finally {
      setDeletingMessageId(null);
    }
  }, [patchMessageLocally]);

  const handleTranscribeMessage = async (message: CommWhatsAppMessage) => {
    setTranscribingMessageId(message.id);
    patchMessageLocally(message.id, {
      transcription_status: 'processing',
      transcription_error: null,
    });

    try {
      const result = await commWhatsAppService.transcribeMessage(message.id, {
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
      setTranscribingMessageId(null);
    }
  };

  const handleRefreshLeadContracts = useCallback(() => {
    void loadLeadContracts(leadPanel?.id ?? null);
  }, [leadPanel?.id, loadLeadContracts]);

  const handleOpenLeadDrawer = () => {
    setLeadDrawerOpen(true);
  };

  const handleCloseLeadDrawer = () => {
    setLeadDrawerOpen(false);
  };

  const handleOpenCreateLeadFromChat = useCallback(() => {
    if (!selectedChat) {
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

  const handleCreateLeadFromChatSaved = useCallback(async (lead: Lead) => {
    const targetChatId = createLeadDraft?.chatId;
    setCreateLeadDraft(null);

    if (!targetChatId) {
      return;
    }

    try {
      const updatedChat = await commWhatsAppService.linkChatLead(targetChatId, lead.id);
      autoLinkSuppressedChatIdRef.current = null;
      autoLinkedLeadKeyRef.current = `${updatedChat.id}:${lead.id}`;
      setAutoLinkedChatIds((current) => {
        if (!current[updatedChat.id]) {
          return current;
        }

        const next = { ...current };
        delete next[updatedChat.id];
        return next;
      });
      upsertChatLocally(updatedChat);
      setSelectedChatId(updatedChat.id);
      await Promise.all([loadLeadPanel(updatedChat), loadChats()]);
      toast.success('Lead criado e vinculado a conversa.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao vincular lead criado no chat', error);
      toast.error('Lead criado, mas nao foi possivel vincula-lo ao chat.');
    }
  }, [createLeadDraft?.chatId, loadChats, loadLeadPanel, upsertChatLocally]);

  const handleLinkLead = useCallback(async (leadId: string, options: { silent?: boolean; autoLinked?: boolean } = {}) => {
    if (!selectedChat) {
      return;
    }

    setLinkLoadingLeadId(leadId);
    try {
      const updatedChat = await commWhatsAppService.linkChatLead(selectedChat.id, leadId);
      autoLinkSuppressedChatIdRef.current = null;
      autoLinkedLeadKeyRef.current = `${updatedChat.id}:${leadId}`;
      setAutoLinkedChatIds((current) => {
        if (options.autoLinked) {
          return { ...current, [updatedChat.id]: true };
        }

        if (!current[updatedChat.id]) {
          return current;
        }

        const next = { ...current };
        delete next[updatedChat.id];
        return next;
      });
      upsertChatLocally(updatedChat);
      setSelectedChatId(updatedChat.id);
      await Promise.all([loadLeadPanel(updatedChat), loadChats()]);
      if (!options.silent) {
        toast.success('Lead vinculado a conversa.');
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao vincular lead', error);
      autoLinkedLeadKeyRef.current = null;
      if (!options.silent) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o lead ao chat.');
      }
    } finally {
      setLinkLoadingLeadId(null);
    }
  }, [loadChats, loadLeadPanel, selectedChat, upsertChatLocally]);

  const handleUnlinkLead = async () => {
    if (!selectedChat) {
      return;
    }

    try {
      autoLinkSuppressedChatIdRef.current = selectedChat.id;
      const updatedChat = await commWhatsAppService.unlinkChatLead(selectedChat.id);
      setAutoLinkedChatIds((current) => {
        if (!current[selectedChat.id]) {
          return current;
        }

        const next = { ...current };
        delete next[selectedChat.id];
        return next;
      });
      upsertChatLocally(updatedChat);
      setLeadPanel(null);
      setLeadContracts([]);
      setLeadContractsError(null);
      setLeadSearchQuery('');
      toast.success('Lead desvinculado da conversa.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao desvincular lead', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível desvincular o lead do chat.');
    }
  };

  const handleLeadStatusChange = async (_leadId: string, newStatus: string) => {
    if (!selectedChat || !leadPanel) {
      return;
    }

    const normalizedStatus = normalizeLeadStatusLabel(newStatus);
    const statusReminderLeadSnapshot = {
      id: leadPanel.id,
      nome_completo: leadPanel.nome_completo,
      telefone: leadPanel.telefone,
      responsavel: leadPanel.responsavel_value ?? leadPanel.responsavel_label ?? '',
    } satisfies Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;

    try {
      await commWhatsAppService.updateLinkedLeadStatus(selectedChat.id, newStatus);

      if (shouldPromptFirstReminderAfterQuote(newStatus)) {
        setStatusReminderLead(statusReminderLeadSnapshot);
        setStatusReminderPromptMessage('Deseja agendar o primeiro lembrete após a proposta enviada?');
      } else if (normalizedStatus === 'perdido' || normalizedStatus === 'convertido') {
        const { error: deleteRemindersError } = await supabase
          .from('reminders')
          .delete()
          .eq('lead_id', leadPanel.id);

        if (deleteRemindersError) {
          throw deleteRemindersError;
        }

        const { error: clearNextReturnError } = await supabase
          .from('leads')
          .update({ proximo_retorno: null })
          .eq('id', leadPanel.id);

        if (clearNextReturnError) {
          throw clearNextReturnError;
        }

        setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
      }

      await Promise.all([
        loadLeadPanel(selectedChat),
        loadChats(),
        loadChatAgendaSummary(leadPanel.id, leadContracts.map((contract) => contract.id)),
      ]);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao atualizar status do lead', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status do lead.');
      throw error;
    }
  };

  const handleLeadResponsavelChange = async (_leadId: string, responsavelValue: string) => {
    if (!selectedChat) {
      return;
    }

    await commWhatsAppService.updateLinkedLeadResponsavel(selectedChat.id, responsavelValue);
    await loadLeadPanel(selectedChat);
  };

  const handleViewLeadInCrm = () => {
    navigate('/painel/leads');
  };

  useEffect(() => {
    if (!selectedChat || selectedChat.lead_id || autoLinkSuppressedChatIdRef.current === selectedChat.id) {
      return;
    }

    const requestId = ++autoLinkLookupRequestIdRef.current;

    void commWhatsAppService
      .searchCrmLeads({
        phoneNumbers: [selectedChat.phone_number, selectedChat.phone_digits],
        limit: 2,
      })
      .then((results) => {
        if (requestId !== autoLinkLookupRequestIdRef.current || selectedChatIdRef.current !== selectedChat.id) {
          return;
        }

        if (results.length !== 1) {
          return;
        }

        const onlyLead = results[0];
        const autoLinkKey = `${selectedChat.id}:${onlyLead.id}`;
        if (autoLinkedLeadKeyRef.current === autoLinkKey) {
          return;
        }

        autoLinkedLeadKeyRef.current = autoLinkKey;
        void handleLinkLead(onlyLead.id, { silent: true, autoLinked: true });
      })
      .catch((error) => {
        console.error('[WhatsAppInbox] erro ao sugerir vinculo automatico de lead', error);
      });
  }, [handleLinkLead, selectedChat]);

  useEffect(() => {
    const now = Date.now();
    for (const [key, failedAt] of chatIdentityLookupFailedAtByKeyRef.current.entries()) {
      if (now - failedAt >= CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS) {
        chatIdentityLookupFailedAtByKeyRef.current.delete(key);
      }
    }

    const shouldAttemptLookupKey = (key: string) => {
      if (resolvedIdentityPhoneKeysRef.current.has(key) || chatIdentityLookupInFlightKeysRef.current.has(key)) {
        return false;
      }

      const failedAt = chatIdentityLookupFailedAtByKeyRef.current.get(key);
      return !failedAt || now - failedAt >= CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS;
    };

    const unresolvedChats = chats.filter((chat) => {
      if (chat.saved_contact_name?.trim()) {
        return false;
      }

      const lookupKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
      if (lookupKeys.length === 0) {
        return false;
      }

      return lookupKeys.some(shouldAttemptLookupKey);
    }).slice(0, CHAT_IDENTITY_LOOKUP_MAX_CHATS_PER_CYCLE);

    if (unresolvedChats.length === 0) {
      return;
    }

    const requestId = ++chatIdentityLookupRequestIdRef.current;
    const batches = splitIntoBatches(unresolvedChats, CHAT_IDENTITY_LOOKUP_BATCH_SIZE);

    void (async () => {
      try {
        for (const batch of batches) {
          if (requestId !== chatIdentityLookupRequestIdRef.current) {
            return;
          }

          const batchPhoneNumbers = Array.from(
            new Set(batch.flatMap((chat) => [chat.phone_number, chat.phone_digits].filter(Boolean))),
          );

          if (batchPhoneNumbers.length === 0) {
            continue;
          }

          const batchLookupKeys = Array.from(
            new Set(batch.flatMap((chat) => collectPhoneLookupKeys(chat.phone_digits || chat.phone_number))),
          ).filter(shouldAttemptLookupKey);

          if (batchLookupKeys.length === 0) {
            continue;
          }

          batchLookupKeys.forEach((key) => chatIdentityLookupInFlightKeysRef.current.add(key));

          let results: CommWhatsAppLeadSearchResult[];
          try {
            results = await commWhatsAppService.searchCrmLeads({
              phoneNumbers: batchPhoneNumbers,
              limit: 50,
            });
          } catch (error) {
            const failedAt = Date.now();
            batchLookupKeys.forEach((key) => chatIdentityLookupFailedAtByKeyRef.current.set(key, failedAt));
            console.warn('[WhatsAppInbox] prefetch de nomes do CRM pausado temporariamente apos erro', error);
            continue;
          } finally {
            batchLookupKeys.forEach((key) => chatIdentityLookupInFlightKeysRef.current.delete(key));
          }

          if (requestId !== chatIdentityLookupRequestIdRef.current) {
            return;
          }

          const leadsByKey = new Map<string, CommWhatsAppLeadSearchResult[]>();
          for (const lead of results) {
            for (const key of collectPhoneLookupKeys(lead.telefone)) {
              const current = leadsByKey.get(key) ?? [];
              current.push(lead);
              leadsByKey.set(key, current);
            }
          }

          let changed = false;
          const requestedLookupKeys = new Set(batchLookupKeys);
          for (const chat of batch) {
            const lookupKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
            const matchedLeadMap = new Map<string, CommWhatsAppLeadSearchResult>();
            for (const key of lookupKeys) {
              for (const lead of leadsByKey.get(key) ?? []) {
                matchedLeadMap.set(lead.id, lead);
              }
            }

            lookupKeys.forEach((key) => {
              if (requestedLookupKeys.has(key)) {
                resolvedIdentityPhoneKeysRef.current.add(key);
                chatIdentityLookupFailedAtByKeyRef.current.delete(key);
              }
            });

            if (matchedLeadMap.size !== 1) {
              continue;
            }

            const matchedLeadName = Array.from(matchedLeadMap.values())[0]?.nome_completo ?? '';
            if (!matchedLeadName.trim()) {
              continue;
            }

            for (const key of lookupKeys) {
              prefetchedLeadNameByPhoneRef.current.set(key, matchedLeadName);
            }
            changed = true;
          }

          if (changed) {
            setChats((current) => applyFrontendSavedContactNames(applyPrefetchedLeadNames(current)));
          }
        }
      } catch (error) {
        console.error('[WhatsAppInbox] erro ao pré-carregar nomes do CRM para chats', error);
      }
    })();
  }, [applyFrontendSavedContactNames, applyPrefetchedLeadNames, chats]);

  const handleStartChatFromSavedContact = async (contact: CommWhatsAppPhoneContact) => {
    if (startingChatKey) {
      return;
    }

    const actionKey = `saved:${contact.phone_digits}`;
    setStartingChatKey(actionKey);
    try {
      const result = await commWhatsAppService.startChat({
        source: 'saved_contact',
        phoneNumber: contact.phone_number,
        displayName: contact.display_name,
        contactId: contact.contact_id,
      });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      setStartChatModalOpen(false);
      toast.success('Conversa pronta para atendimento.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao iniciar chat por contato salvo', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa a partir do contato salvo.');
    } finally {
      setStartingChatKey((current) => (current === actionKey ? null : current));
    }
  };

  const handleStartChatFromLead = async (lead: CommWhatsAppLeadSearchResult) => {
    if (startingChatKey) {
      return;
    }

    const actionKey = `crm:${lead.id}`;
    setStartingChatKey(actionKey);
    try {
      const result = await commWhatsAppService.startChat({
        source: 'crm',
        leadId: lead.id,
      });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      setStartChatModalOpen(false);
      toast.success('Conversa do lead aberta no inbox.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao iniciar chat por lead do CRM', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa a partir do lead do CRM.');
    } finally {
      setStartingChatKey((current) => (current === actionKey ? null : current));
    }
  };

  const handleOpenAgendaLeadChat = useCallback(async (lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone'>) => {
    if (startingChatKey) {
      return;
    }

    const phoneKeys = collectPhoneLookupKeys(lead.telefone);
    const localExistingChat = latestChatsRef.current.find((chat) => {
      if (lead.id && chat.lead_id === lead.id) {
        return true;
      }

      if (phoneKeys.length === 0) {
        return false;
      }

      const chatPhoneKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
      return chatPhoneKeys.some((key) => phoneKeys.includes(key));
    }) ?? null;

    if (localExistingChat) {
      setSelectedChatId(localExistingChat.id);
      return;
    }

    if (!lead.id && !lead.telefone?.trim()) {
      toast.error('Nao foi possivel abrir uma conversa para este lead.');
      return;
    }

    const openingKey = `agenda:${lead.id || lead.telefone || 'lead'}`;
    setStartingChatKey(openingKey);

    try {
      const persistedExistingChat = await commWhatsAppService.findExistingChat({
        leadId: lead.id,
        phoneDigits: phoneKeys,
      });

      if (persistedExistingChat) {
        upsertChatLocally(persistedExistingChat);
        setSelectedChatId(persistedExistingChat.id);
        return;
      }

      const result = lead.id
        ? await commWhatsAppService.startChat({
            source: 'crm',
            leadId: lead.id,
          })
        : await commWhatsAppService.startChat({
            source: 'manual',
            phoneNumber: lead.telefone ?? '',
          });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao abrir chat a partir da agenda', error);
      throw error;
    } finally {
      setStartingChatKey((current) => (current === openingKey ? null : current));
    }
  }, [setSearch, setSearchDraft, startingChatKey, upsertChatLocally]);

  const handleStartChatFromManual = async () => {
    if (startingChatKey) {
      return;
    }

    const actionKey = 'manual';
    setStartingChatKey(actionKey);
    try {
      const result = await commWhatsAppService.startChat({
        source: 'manual',
        phoneNumber: manualStartPhone,
      });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      setStartChatModalOpen(false);
      setManualStartPhone('');
      toast.success('Conversa aberta pelo número informado.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao iniciar chat manual', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa pelo número informado.');
    } finally {
      setStartingChatKey((current) => (current === actionKey ? null : current));
    }
  };

  const handleOpenSharedContactChat = useCallback(async (contact: { name: string | null; phoneNumber: string | null }) => {
    const phoneNumber = contact.phoneNumber?.trim() ?? '';
    if (!phoneNumber) {
      toast.error('Este contato compartilhado não possui telefone válido.');
      return;
    }

    const phoneKeys = collectPhoneLookupKeys(phoneNumber);
    if (phoneKeys.length === 0) {
      toast.error('Este contato compartilhado não possui telefone válido.');
      return;
    }

    const actionKey = `open:${phoneNumber}`;
    setSharedContactActionKey(actionKey);

    try {
      const localExistingChat = chats.find((chat) => {
        const chatPhoneKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
        return chatPhoneKeys.some((key) => phoneKeys.includes(key));
      }) ?? null;

      if (localExistingChat) {
        setSelectedChatId(localExistingChat.id);
        return;
      }

      const persistedExistingChat = await commWhatsAppService.findExistingChat({ phoneDigits: phoneKeys });
      if (persistedExistingChat) {
        upsertChatLocally(persistedExistingChat);
        setSelectedChatId(persistedExistingChat.id);
        return;
      }

      const result = await commWhatsAppService.startChat({
        source: 'manual',
        phoneNumber,
      });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      toast.success('Conversa aberta com o contato compartilhado.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao abrir contato compartilhado', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a conversa do contato compartilhado.');
    } finally {
      setSharedContactActionKey((current) => (current === actionKey ? null : current));
    }
  }, [chats, setSearch, setSearchDraft, upsertChatLocally]);

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
      await commWhatsAppService.saveContact({
        phoneNumber,
        displayName,
      });

      void refreshStartChatSources(startChatQuery, 1, false);
      void loadChats();
      toast.success('Contato salvo com sucesso.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao salvar contato compartilhado', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o contato compartilhado.');
    } finally {
      setSharedContactActionKey((current) => (current === actionKey ? null : current));
    }
  }, [loadChats, refreshStartChatSources, startChatQuery]);

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

  const handleSaveQuickReplies = useCallback(async (nextQuickReplies: WhatsAppQuickReply[]) => {
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

      const savedIntegration = result.data ?? quickReplyIntegration;
      const normalized = normalizeWhatsAppQuickRepliesSettings(savedIntegration?.settings ?? settingsPayload);

      setQuickReplyIntegration(savedIntegration);
      setQuickReplies(normalized.quickReplies);
      setQuickRepliesModalOpen(false);
      setDismissedQuickReplyKey(null);
      toast.success('Mensagens rápidas salvas com sucesso.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao salvar mensagens rápidas', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as mensagens rápidas.');
    } finally {
      setSavingQuickReplies(false);
    }
  }, [quickReplyIntegration]);

  const handleCloseFollowUpModal = useCallback(() => {
    setFollowUpModalOpen(false);
  }, []);

  const handleCloseComposerRewriteModal = useCallback(() => {
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

    setRewritingComposer(true);

    try {
      const result = await commWhatsAppService.rewriteMessage({
        message: sourceText,
        chatId: selectedChat?.id ?? null,
        tone,
        customInstructions,
      });
      const rewrittenText = result.text.trim();
      if (options.applyToComposer) {
        applyTextToComposer(rewrittenText);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
      } else {
        setComposerRewriteDraft(rewrittenText);
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao reescrever mensagem do composer', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel reescrever a mensagem com IA.');
    } finally {
      setRewritingComposer(false);
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
      const result = await commWhatsAppService.suggestReply({
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
      const message = error instanceof Error ? error.message : 'Nao foi possivel sugerir uma resposta com IA.';
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
    tone: CommWhatsAppFollowUpTone,
    options: { variantCount?: number; salesTechniques?: string[]; situationPresetIds?: string[]; manualContext?: { tone?: boolean; situationPresetIds?: boolean; salesTechniques?: boolean } } = {},
  ) => {
    if (!selectedChat) {
      return;
    }

    if (followUpGenerationDisabledReason) {
      return;
    }

    const validSalesTechniqueIds = new Set<string>(followUpSalesTechniqueOptions.map((technique) => technique.id));
    const normalizedSalesTechniques = (options.salesTechniques ?? followUpSelectedSalesTechniques)
      .filter((techniqueId) => validSalesTechniqueIds.has(techniqueId));
    const validSituationPresetIds = new Set<string>(CONVERSATION_SITUATION_PRESETS.map((preset) => preset.id));
    const normalizedSituationPresetIds = (options.situationPresetIds ?? followUpSelectedSituationPresetIds)
      .filter((presetId) => validSituationPresetIds.has(presetId));
    const manualContextSource = options.manualContext ?? followUpManualContext;
    const activeManualContext = {
      tone: manualContextSource.tone === true,
      situationPresetIds: manualContextSource.situationPresetIds === true,
      salesTechniques: manualContextSource.salesTechniques === true,
    };
    const requestId = ++followUpGenerationRequestIdRef.current;
    const targetChatId = selectedChat.id;
    const followUpRequestPayload = {
      chatId: selectedChat.id,
      customInstructions,
      tone,
      variantCount: options.variantCount,
      salesTechniques: normalizedSalesTechniques,
      situationPresetIds: normalizedSituationPresetIds,
      autoSelectContext: true,
      manualContext: activeManualContext,
      selectedChat,
    };
    console.debug('[FollowUpAI][inbox] request', followUpRequestPayload);
    setGeneratingFollowUp(true);

    try {
      const result = await commWhatsAppService.generateFollowUp(selectedChat.id, {
        customInstructions,
        tone,
        variantCount: options.variantCount,
        salesTechniques: normalizedSalesTechniques,
        situationPresetIds: normalizedSituationPresetIds,
        autoSelectContext: true,
        manualContext: activeManualContext,
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
      setFollowUpDraft(result.text.trim());
      setFollowUpVariations(result.variations ?? []);
      setFollowUpCustomInstructions(customInstructions);
      setFollowUpTone(result.aiContext?.tone ?? tone);
      setFollowUpSelectedSalesTechniques(result.aiContext?.salesTechniques ?? normalizedSalesTechniques);
      setFollowUpSelectedSituationPresetIds(result.aiContext?.situationPresetIds ?? normalizedSituationPresetIds);
      setFollowUpManualContext(activeManualContext);
      setFollowUpAiContextRationale(result.aiContext?.rationale ?? null);
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
  }, [followUpGenerationDisabledReason, followUpManualContext, followUpSelectedSalesTechniques, followUpSelectedSituationPresetIds, selectedChat]);

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
        commWhatsAppService.listAllMessages(selectedChat.id),
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
    setSyncingHistoryChatId(targetChat.id);

    try {
      const result = await commWhatsAppService.syncChatHistory(targetChat.external_chat_id);
      await Promise.all([loadMessages(targetChat, 'initial'), loadChats()]);

      if (result.imported > 0) {
        toast.success(`Historico consultado na Whapi (${result.imported} mensagens retornadas). Use "Carregar mais" para navegar nas mais antigas.`);
      } else {
        toast.info('A Whapi nao retornou mensagens adicionais para esta conversa agora.');
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao recuperar historico do chat', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel recuperar mais mensagens deste chat.');
    } finally {
      setSyncingHistoryChatId((current) => (current === targetChat.id ? null : current));
    }
  }, [historyRecoveryDisabledReason, loadChats, loadMessages, selectedChat]);

  const handleUpdateChatInboxState = useCallback(async (
    chat: CommWhatsAppChat,
    options: {
      isArchived?: boolean | null;
      isMuted?: boolean | null;
      isPinned?: boolean | null;
      markAsUnread?: boolean | null;
    },
  ) => {
    setUpdatingChatStateId(chat.id);

    const fieldsOnlyPatch = stripPendingChatInboxMetadata(buildPendingChatInboxStatePatch(chat, options));
    const pendingPatch = buildPendingChatInboxStatePatch(chat, options);
    const hasFieldsToApply = Object.keys(fieldsOnlyPatch).length > 0;
    if (hasFieldsToApply) {
      mergePendingChatInboxState(pendingChatInboxStateRef.current, chat.id, pendingPatch);
      upsertChatLocally({ ...chat, ...fieldsOnlyPatch });
    }

    if (options.markAsUnread === true && selectedChatIdRef.current === chat.id) {
      manualUnreadSkipReadChatIdRef.current = chat.id;
    }

    // Ao desarquivar a conversa aberta dentro de Arquivadas, levamos o usuario
    // de volta para Conversas mantendo o chat selecionado. Arquivar a conversa
    // aberta na Inbox continua selecionando o proximo chat ativo.
    const shouldMoveSelectedUnarchivedChatToActive = (
      options.isArchived === false
      && selectedChatIdRef.current === chat.id
      && archivedSectionOpenRef.current
    );
    const shouldRotateSelection = (
      typeof options.isArchived === 'boolean'
      && selectedChatIdRef.current === chat.id
      && !shouldMoveSelectedUnarchivedChatToActive
      // se o usuario esta na secao "Arquivadas" e desarquivou, idem
      && options.isArchived !== archivedSectionOpenRef.current
    );

    if (shouldMoveSelectedUnarchivedChatToActive) {
      setArchivedSectionOpen(false);
      void loadChats({ sections: ['active'] });
    } else if (shouldRotateSelection) {
      const nextChat = latestChatsRef.current.find((candidate) => (
        candidate.id !== chat.id
        && Boolean(candidate.is_archived) === archivedSectionOpenRef.current
      )) ?? null;
      setSelectedChatId(nextChat?.id ?? null);
    }

    try {
      const updatedChat = await commWhatsAppService.updateChatInboxState(chat.id, options);

      // Sanidade: confirma que o servidor refletiu o que pedimos. Caso
      // contrario, mantemos o patch otimista vivo dentro da janela de
      // protecao para evitar reversao temporaria pelo realtime/refetch.
      const archiveConfirmed = typeof options.isArchived !== 'boolean' || updatedChat.is_archived === options.isArchived;
      const muteConfirmed = typeof options.isMuted !== 'boolean' || updatedChat.is_muted === options.isMuted;
      const pinConfirmed = typeof options.isPinned !== 'boolean' || updatedChat.is_pinned === options.isPinned;

      if (archiveConfirmed && muteConfirmed && pinConfirmed && typeof options.isArchived !== 'boolean') {
        pendingChatInboxStateRef.current.delete(chat.id);
      }
      upsertChatLocally(updatedChat);

      if (typeof options.isArchived === 'boolean') {
        if (archiveConfirmed) {
          toast.success(options.isArchived ? 'Conversa arquivada.' : 'Conversa removida dos arquivados.');
        } else {
          toast.warning('Conversa atualizada, mas o servidor reverteu o arquivamento. Verifique se ha mensagens novas chegando.');
        }
      } else if (typeof options.isMuted === 'boolean') {
        toast.success(options.isMuted ? 'Conversa silenciada.' : 'Conversa com notificacao restaurada.');
      } else if (typeof options.isPinned === 'boolean') {
        toast.success(options.isPinned ? 'Conversa fixada.' : 'Conversa desafixada.');
      } else if (typeof options.markAsUnread === 'boolean') {
        toast.success(options.markAsUnread ? 'Conversa marcada como nao lida.' : 'Conversa marcada como lida.');
      }
    } catch (error) {
      pendingChatInboxStateRef.current.delete(chat.id);
      if (hasFieldsToApply) {
        upsertChatLocally(chat);
      }
      console.error('[WhatsAppInbox] erro ao atualizar estado do chat', error);
      if (options.markAsUnread === true && manualUnreadSkipReadChatIdRef.current === chat.id) {
        manualUnreadSkipReadChatIdRef.current = null;
      }
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar esta conversa.');
    } finally {
      setUpdatingChatStateId((current) => (current === chat.id ? null : current));
    }
  }, [loadChats, upsertChatLocally]);

  const handleDeleteChat = useCallback(async (chat: CommWhatsAppChat) => {
    if (deletingChatId) {
      return;
    }

    const confirmed = window.confirm('Excluir esta conversa da Inbox? Novas mensagens recebidas do contato podem reabrir a conversa.');
    if (!confirmed) {
      return;
    }

    setDeletingChatId(chat.id);
    try {
      await commWhatsAppService.deleteChat(chat.id);

      setChats((current) => {
        const next = current.filter((candidate) => candidate.id !== chat.id);
        chatsSignatureRef.current = buildChatsSignature(next);
        return next;
      });

      if (selectedChatIdRef.current === chat.id) {
        const nextChat = sortChatsByInboxOrder(latestChatsRef.current.filter((candidate) => (
          candidate.id !== chat.id
          && Boolean(candidate.is_archived) === archivedSectionOpenRef.current
        )))[0] ?? null;
        setSelectedChatId(nextChat?.id ?? null);
      }

      toast.success('Conversa excluida da Inbox.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao excluir conversa', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir esta conversa.');
    } finally {
      setDeletingChatId((current) => (current === chat.id ? null : current));
    }
  }, [buildChatsSignature, deletingChatId]);

  const handleToggleMediaDrawer = useCallback(() => {
    setAttachmentMenuOpen(false);
    setMediaDrawerOpen((current) => !current);
  }, []);

  const handleSendDrawerMedia = useCallback(async (item: {
    sendKind: 'image' | 'video';
    sendUrl: string;
    title: string;
    mimeType: string;
    previewUrl?: string;
  }) => {
    if (!selectedChat) {
      return;
    }

    if (mediaDrawerSendDisabledReason) {
      toast.error(mediaDrawerSendDisabledReason);
      throw new Error(mediaDrawerSendDisabledReason);
    }

    const clientRequestId = createClientRequestId();
    const [messageAt] = allocateOptimisticMessageTimestamps(selectedChat.id, 1);
    const optimisticMessage = buildOptimisticOutgoingMessage({
      chat: selectedChat,
      messageType: item.sendKind,
      textContent: buildMediaSummaryText(item.sendKind),
      clientRequestId,
      messageAt,
      mediaUrl: item.previewUrl ?? item.sendUrl,
      mediaMimeType: item.mimeType,
      mediaFileName: item.title,
      metadata: {
        local_media_source: 'drawer',
      },
    });

    appendLocalOutgoingMessage(optimisticMessage, {
      kind: 'remote_media',
      mediaKind: item.sendKind,
      remoteUrl: item.sendUrl,
      mimeType: item.mimeType,
      fileName: item.title,
      previewUrl: item.previewUrl ?? item.sendUrl,
      clientRequestId,
    });
    applyOptimisticChatSummary(selectedChat, optimisticMessage.text_content ?? '', optimisticMessage.message_at);

    return enqueueChatSend(selectedChat.id, async () => {
      setSendingDrawerMedia(true);

      try {
        const sendResult = await commWhatsAppService.sendRemoteMediaMessage({
          chatId: selectedChat.external_chat_id,
          kind: item.sendKind,
          remoteUrl: item.sendUrl,
          fileName: item.title,
          mimeType: item.mimeType,
          clientRequestId,
        });

        patchLocalOutgoingMessage(optimisticMessage.id, {
          external_message_id: sendResult.messageId,
          delivery_status: sendResult.status,
          status_updated_at: new Date().toISOString(),
          error_message: null,
        });
        updateOptimisticChatPreviewStatus(selectedChat.id, optimisticMessage.message_at, sendResult.status);
        if (sendResult.messageId && REFRESHABLE_OUTBOUND_STATUSES.has(sendResult.status.trim().toLowerCase())) {
          scheduleMessageStatusRefresh({
            chat: selectedChat,
            externalMessageIds: [sendResult.messageId],
          });
        }
        localOutgoingRetryPayloadRef.current.delete(optimisticMessage.id);

        void (async () => {
          await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
        })().catch((error) => {
          console.error('[WhatsAppInbox] erro ao atualizar conversa apos midia da gaveta', error);
        });
      } catch (error) {
        console.error('[WhatsAppInbox] erro ao enviar mídia da gaveta', error);
        const message = error instanceof Error ? error.message : 'Não foi possível enviar a mídia agora.';
        patchLocalOutgoingMessage(optimisticMessage.id, {
          delivery_status: 'failed',
          status_updated_at: new Date().toISOString(),
          error_message: message,
        });
        updateOptimisticChatPreviewStatus(selectedChat.id, optimisticMessage.message_at, 'failed');
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setSendingDrawerMedia(false);
      }
    });
  }, [allocateOptimisticMessageTimestamps, appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, enqueueChatSend, loadChats, loadMessages, mediaDrawerSendDisabledReason, patchLocalOutgoingMessage, scheduleMessageStatusRefresh, selectedChat, updateOptimisticChatPreviewStatus]);

  const handleToggleFollowUpSalesTechnique = useCallback((techniqueId: string) => {
    setFollowUpManualContext((current) => ({ ...current, salesTechniques: true }));
    setFollowUpSelectedSalesTechniques((current) => (
      current.includes(techniqueId)
        ? current.filter((selectedTechniqueId) => selectedTechniqueId !== techniqueId)
        : [...current, techniqueId]
    ));
  }, []);

  const handleToggleFollowUpSituationPreset = useCallback((presetId: string) => {
    setFollowUpManualContext((current) => ({ ...current, situationPresetIds: true }));
    setFollowUpSelectedSituationPresetIds((current) => (
      current.includes(presetId)
        ? current.filter((selectedPresetId) => selectedPresetId !== presetId)
        : [...current, presetId]
    ));
  }, []);

  const handleChangeFollowUpTone = useCallback((tone: CommWhatsAppFollowUpTone) => {
    setFollowUpTone(tone);
    setFollowUpManualContext((current) => ({ ...current, tone: true }));
  }, []);

  const handleRegenerateFollowUp = useCallback((options: { variantCount?: number; customInstructions?: string } = {}) => {
    void handleGenerateFollowUp(options.customInstructions ?? followUpCustomInstructions, followUpTone, {
      ...options,
      salesTechniques: followUpSelectedSalesTechniques,
      situationPresetIds: followUpSelectedSituationPresetIds,
      manualContext: followUpManualContext,
    });
  }, [followUpCustomInstructions, followUpManualContext, followUpSelectedSalesTechniques, followUpSelectedSituationPresetIds, followUpTone, handleGenerateFollowUp]);

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

    setSchedulingFollowUpNextAction(true);
    try {
      const description = [
        followUpNextAction.reason,
        followUpNextAction.giveUpRecommendation,
      ].filter(Boolean).join('\n\n');

      const { data, error } = await supabase.rpc('schedule_follow_up_reminder' as never, {
        p_lead_id: leadId,
        p_title: followUpNextAction.title || `Follow-up: ${getSafeChatDisplayName(selectedChat, channelState?.connected_user_name ?? null)}`,
        p_description: description || null,
        p_due_at: followUpNextAction.suggestedDateTime,
        p_priority: followUpNextAction.priority,
      } as never);

      if (error) throw error;

      await loadChatAgendaSummary(leadId, leadContracts.map((contract) => contract.id));
      const result = Array.isArray(data) ? data[0] as { inserted?: boolean } | undefined : undefined;
      toast.success(result?.inserted === false ? 'Este follow-up já estava agendado.' : 'Próximo follow-up agendado.');
      setFollowUpNextAction(null);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao agendar proxima acao do follow-up', error);
      toast.error('Não foi possível agendar a próxima ação.');
    } finally {
      setSchedulingFollowUpNextAction(false);
    }
  }, [canEditAgenda, channelState?.connected_user_name, followUpNextAction, leadContracts, leadPanel?.id, loadChatAgendaSummary, selectedChat]);

  const handleBatchSendFollowUp = useCallback(async (results: Array<{
    chatId: string;
    externalChatId: string | null;
    textSegments: string[];
    reminderId: string;
    leadId: string;
    phone: string | null;
    nextAction: {
      suggestedDateTime: string | null;
      priority: string;
      title: string;
      reason: string;
    } | null;
  }>, options?: {
    onProgress?: (progress: WhatsAppBatchFollowUpSendProgress) => void;
  }) => {
    const chats = latestChatsRef.current;
    const sentIds: string[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];
    const nextActions: Array<{ leadId: string; nextAction: NonNullable<typeof results[number]['nextAction']> }> = [];
    const auditEntries: Array<{
      lead_id: string;
      chat_id: string;
      text_content: string;
      next_action_title: string | null;
      next_action_due_at: string | null;
    }> = [];

    for (const [index, result] of results.entries()) {
      const totalSegments = result.textSegments.length;
      options?.onProgress?.({
        reminderId: result.reminderId,
        status: 'sending',
        sentSegments: 0,
        totalSegments,
      });

      const chat = chats.find((c) => c.id === result.chatId)
        ?? (result.externalChatId ? chats.find((c) => c.external_chat_id === result.externalChatId) : null)
        ?? chats.find((c) => c.lead_id === result.leadId);
      const phoneChatId = normalizeWhapiDirectChatId(result.phone);
      const externalChatId = phoneChatId
        || normalizeWhapiDirectChatId(result.externalChatId)
        || normalizeWhapiDirectChatId(chat?.external_chat_id);

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
          await commWhatsAppService.sendTextMessage(externalChatId, segment, {
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
        const message = error instanceof Error ? error.message : 'Nao foi possivel enviar o follow-up.';
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
      options?.onProgress?.({
        reminderId: result.reminderId,
        status: 'sent',
        sentSegments: totalSegments,
        totalSegments,
      });
      if (result.nextAction?.suggestedDateTime) {
        nextActions.push({ leadId: result.leadId, nextAction: result.nextAction });
      }
      auditEntries.push({
        lead_id: result.leadId,
        chat_id: result.chatId,
        text_content: result.textSegments.join('\n\n'),
        next_action_title: result.nextAction?.title ?? null,
        next_action_due_at: result.nextAction?.suggestedDateTime ?? null,
      });
      if (index < results.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (sentIds.length === 0) {
      throw new Error(failures[0] || 'Nenhum lead possui chat ou telefone valido para envio.');
    }

    const { error: remindersError } = await supabase.from('reminders').update({ lido: true }).in('id', sentIds);
    if (remindersError) {
      warnings.push(`Erro ao marcar lembretes como lidos: ${remindersError.message}`);
    }

    let scheduledCount = 0;
    for (const { leadId, nextAction } of nextActions) {
      const { error: scheduleError } = await supabase.rpc('schedule_follow_up_reminder', {
        p_lead_id: leadId,
        p_title: nextAction.title,
        p_description: nextAction.reason,
        p_due_at: nextAction.suggestedDateTime,
        p_priority: nextAction.priority,
      });
      if (scheduleError) {
        warnings.push(`Erro ao agendar proximo follow-up para lead ${leadId}: ${scheduleError.message}`);
      } else {
        scheduledCount += 1;
      }
    }

    if (auditEntries.length > 0) {
      try {
        await supabase.from('comm_follow_up_audit_log').insert(auditEntries);
      } catch (auditError) {
        console.error('[WhatsAppInbox] erro ao registrar auditoria', auditError);
        warnings.push('Follow-ups enviados, mas nao foi possivel registrar a auditoria.');
      }
    }

    void Promise.all([loadChatsRef.current(), loadMessagesRef.current(null, 'send')]).catch((refreshError) => {
      console.error('[WhatsAppInbox] erro ao atualizar conversas apos envio batch', refreshError);
      toast.warning('Follow-ups enviados, mas houve um erro ao atualizar a lista. Atualize a pagina se necessario.');
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
      sendTextSegments(selectedChat, textSegments);
      resetFollowUpComposer();
      handleCloseFollowUpModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar follow-up', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o follow-up.');
    }
  }, [followUpDraft, handleCloseFollowUpModal, resetFollowUpComposer, selectedChat, sendDisabledReason, sendTextSegments]);

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

  useEffect(() => {
    if (visualComposerAttachments.length === 0) {
      if (selectedMediaComposerAttachmentId !== null) {
        setSelectedMediaComposerAttachmentId(null);
      }
      return;
    }

    if (!selectedMediaComposerAttachmentId || !visualComposerAttachments.some((attachment) => attachment.id === selectedMediaComposerAttachmentId)) {
      setSelectedMediaComposerAttachmentId(visualComposerAttachments[0].id);
    }
  }, [selectedMediaComposerAttachmentId, visualComposerAttachments]);

  useEffect(() => {
    if (documentComposerAttachments.length === 0) {
      if (selectedDocumentComposerAttachmentId !== null) {
        setSelectedDocumentComposerAttachmentId(null);
      }
      return;
    }

    if (!selectedDocumentComposerAttachmentId || !documentComposerAttachments.some((attachment) => attachment.id === selectedDocumentComposerAttachmentId)) {
      setSelectedDocumentComposerAttachmentId(documentComposerAttachments[0].id);
    }
  }, [documentComposerAttachments, selectedDocumentComposerAttachmentId]);

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

  return (
    <WhatsAppInboxSelectionProvider value={selectionContextValue}>
    <div className="whatsapp-inbox-shell panel-page-shell h-full overflow-hidden p-0">
      <div className="flex h-full min-h-0 flex-col gap-0">
        {operationalBanner && (
          <section className={`whatsapp-inbox-status-banner whatsapp-inbox-status-banner-${operationalBanner.tone} m-4 mb-0 flex items-start gap-3 rounded-3xl border px-4 py-3.5`}>
            <operationalBanner.icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="whatsapp-inbox-heading text-sm font-semibold">{operationalBanner.title}</p>
              <p className="text-sm leading-6 opacity-90">{operationalBanner.description}</p>
            </div>
          </section>
        )}

        <section className="grid h-full min-h-0 flex-1 gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="whatsapp-inbox-panel whatsapp-inbox-sidebar flex h-full min-h-0 flex-col border shadow-sm xl:rounded-r-none xl:border-r">
          <div className="whatsapp-inbox-sidebar-header border-b p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {archivedSectionOpen ? 'Arquivadas' : 'Conversas'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant={archivedSectionOpen ? 'soft' : 'secondary'}
                    onClick={() => handleSwitchArchivedSection(!archivedSectionOpen)}
                    className="rounded-xl"
                    aria-label="Chats arquivados"
                    title={archivedChatsCount > 0 ? `Chats arquivados (${archivedChatsCount})` : 'Chats arquivados'}
                  >
                    <span className="relative inline-flex">
                      <Archive className="h-4 w-4" />
                      {archivedChatsCount > 0 ? (
                        <span className="absolute -right-2 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none" style={{
                          borderColor: 'var(--brand-primary-border)',
                          background: 'var(--brand-primary)',
                          color: 'var(--text-on-brand)',
                        }}>
                          {archivedChatsCount > 99 ? '99+' : archivedChatsCount}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setWhatsAppAgendaOpen(true)}
                    className="rounded-xl"
                    aria-label="Agenda do WhatsApp"
                    title={canViewAgenda ? 'Agenda do WhatsApp' : 'Sem permissao para acessar a agenda'}
                    disabled={!canViewAgenda}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setWhatsAppDashboardOpen(true)}
                    className="rounded-xl"
                    aria-label="Painel WhatsApp"
                    title="Painel WhatsApp"
                  >
                    <Cog className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => setStartChatModalOpen(true)}
                    className="rounded-xl"
                    aria-label="Novo chat"
                    title="Novo chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                leftIcon={Search}
                className="whatsapp-inbox-search-input"
              />

              <div className="flex items-center gap-2 overflow-visible pb-1">
                <InboxFilterChip
                  active={!hasActiveChatFilters}
                  label="Todas"
                  onClick={() => {
                    setChatActivityFilter('all');
                    setLeadStatusFilters([]);
                    setAdvancedFiltersOpen(false);
                  }}
                />

                <div className="relative shrink-0">
                  <Button
                    type="button"
                    ref={advancedFiltersTriggerRef}
                    onClick={() => setAdvancedFiltersOpen((current) => !current)}
                    variant={advancedFiltersOpen || activeChatFiltersCount > 0 ? 'soft' : 'secondary'}
                    size="sm"
                    className="h-9 rounded-xl px-3.5 text-xs"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtros{activeChatFiltersCount > 0 ? ` (${activeChatFiltersCount})` : ''}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="whatsapp-inbox-sidebar-scroll min-h-0 flex-1 overflow-y-auto p-0">
            {archivedSectionOpen ? (
              <div className="sticky top-0 z-[1] flex items-center gap-2 border-b bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                <Archive className="h-4 w-4 text-[var(--text-muted)]" />
                <span>Conversas arquivadas</span>
                <span className="ml-auto text-xs font-medium text-[var(--text-muted)]">
                  {archivedChatsCount > 0 ? `${archivedChatsCount} ${archivedChatsCount === 1 ? 'chat' : 'chats'}` : '0 chats'}
                </span>
              </div>
            ) : null}
            {loading ? (
                <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--text-secondary)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : search ? (sidebarChats.length === 0 && filteredMessageSearchResults.length === 0 && !searchingChats && !searchingMessages ? (
              <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center">
                <Search className="h-8 w-8 whatsapp-inbox-empty-icon" />
                <div className="space-y-1">
                  <p className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">
                    Nenhum resultado encontrado
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Busque pelo nome do contato, telefone ou trecho de mensagem.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {sidebarChats.length > 0 ? (
                  <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Conversas
                  </div>
                ) : null}
                {searchingChats && sidebarChats.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando conversas...
                  </div>
                ) : null}
                {sidebarChats.map((chat) => (
                  <InboxChatListItem
                    key={chat.id}
                    chat={chat}
                    selected={chat.id === selectedChatId}
                    connectedUserName={channelState?.connected_user_name ?? null}
                    draftPreview={normalizeChatDraftPreview(composerDraftsByChatId[chat.id] ?? '')}
                    onSelect={(chatId) => {
                      setChatMenuPointerAnchor(null);
                      setOpenChatMenuChatId(null);
                      upsertChatLocally(chat);
                      setSelectedChatId(chatId);
                    }}
                    menuOpen={openChatMenuChatId === chat.id}
                    menuBusy={updatingChatStateId === chat.id}
                    onToggleMenu={handleToggleChatMenu}
                    onOpenContextMenu={handleOpenChatMenuFromContext}
                    menuTriggerRef={(node) => {
                      if (node) {
                        chatMenuTriggerRefs.current[chat.id] = node;
                      } else {
                        delete chatMenuTriggerRefs.current[chat.id];
                      }
                    }}
                  />
                ))}
                {filteredMessageSearchResults.length > 0 || searchingMessages ? (
                  <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Mensagens
                  </div>
                ) : null}
                {searchingMessages ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando mensagens...
                  </div>
                ) : null}
                {filteredMessageSearchResults.map((result) => (
                  <InboxMessageSearchListItem
                    key={result.message.id}
                    result={result}
                    selected={result.chat.id === selectedChatId}
                    connectedUserName={channelState?.connected_user_name ?? null}
                    onSelect={() => handleSelectMessageSearchResult(result)}
                  />
                ))}
              </>
            )) : sidebarChats.length === 0 ? (
              <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center">
                {archivedSectionOpen ? <Archive className="h-8 w-8 whatsapp-inbox-empty-icon" /> : <MessageCircle className="h-8 w-8 whatsapp-inbox-empty-icon" />}
                <div className="space-y-1">
                  <p className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">
                    {archivedSectionOpen ? 'Nenhum chat arquivado' : 'Nenhuma conversa ainda'}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {archivedSectionOpen
                      ? 'Arquive uma conversa para ela aparecer nesta lista separada.'
                      : 'Assim que o webhook da Whapi receber mensagens, elas aparecerão aqui.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {sidebarChats.map((chat) => (
                  <InboxChatListItem
                    key={chat.id}
                    chat={chat}
                    selected={chat.id === selectedChatId}
                    connectedUserName={channelState?.connected_user_name ?? null}
                    draftPreview={normalizeChatDraftPreview(composerDraftsByChatId[chat.id] ?? '')}
                    onSelect={(chatId) => {
                      setChatMenuPointerAnchor(null);
                      setOpenChatMenuChatId(null);
                      setSelectedChatId(chatId);
                    }}
                    menuOpen={openChatMenuChatId === chat.id}
                    menuBusy={updatingChatStateId === chat.id}
                    onToggleMenu={handleToggleChatMenu}
                    onOpenContextMenu={handleOpenChatMenuFromContext}
                    menuTriggerRef={(node) => {
                      if (node) {
                        chatMenuTriggerRefs.current[chat.id] = node;
                      } else {
                        delete chatMenuTriggerRefs.current[chat.id];
                      }
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="whatsapp-inbox-panel whatsapp-inbox-thread flex h-full min-h-0 flex-col border shadow-sm xl:rounded-l-none xl:border-l-0">
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
              <div className="whatsapp-inbox-thread-header flex items-start justify-between gap-4 border-b p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="whatsapp-inbox-heading text-lg font-semibold text-[var(--text-primary)]">{selectedChatDisplayName}</p>
                    {selectedChat.lead_id && leadPanel?.id && leadPanel.status_nome ? (
                      <StatusDropdown
                        currentStatus={leadPanel.status_nome}
                        leadId={leadPanel.id}
                        onStatusChange={handleLeadStatusChange}
                        statusOptions={leadStatuses}
                      />
                    ) : null}
                    {selectedChatWasAutoLinked ? (
                      <span className="inline-flex items-center rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                        Auto
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
                    <span>{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</span>
                    {leadPanel?.responsavel_label ? <span>Responsável: {leadPanel.responsavel_label}</span> : null}
                  </div>
                  {nextChatReminderSummary ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1" style={chatAgendaSummary.nextReminder && isOverdue(chatAgendaSummary.nextReminder.data_lembrete)
                        ? {
                            borderColor: 'var(--danger-border)',
                            background: 'var(--danger-soft)',
                            color: 'var(--danger-text)',
                          }
                        : {
                            borderColor: 'var(--border-strong)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-muted)',
                          }}>
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="max-w-[34rem] truncate">{nextChatReminderSummary}</span>
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-start gap-3">
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className={`whatsapp-inbox-status-pill whatsapp-inbox-status-pill-${isChannelConnected ? 'success' : 'warning'}`}>
                      <span className="whatsapp-inbox-status-pill-dot" aria-hidden="true" />
                      {connectionStatusLabel}
                    </span>
                    {channelState?.last_webhook_received_at && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        Webhook: {formatMessageTime(channelState.last_webhook_received_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleToggleChatMessageSearch}
                      variant={chatMessageSearchOpen ? 'secondary' : 'soft'}
                      size="icon"
                      className="rounded-xl"
                      aria-label="Pesquisar mensagens neste chat"
                      title="Pesquisar neste chat"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleCopyChatTranscript()}
                      variant="soft"
                      size="icon"
                      className="rounded-xl"
                      aria-label="Copiar conversa formatada"
                      title="Copiar conversa formatada"
                      disabled={copyingTranscript}
                    >
                      {copyingTranscript ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleRecoverChatHistory()}
                      variant="soft"
                      size="icon"
                      className="rounded-xl"
                      aria-label="Recuperar mensagens antigas do chat"
                      title={historyRecoveryDisabledReason ?? 'Recuperar mensagens antigas pela Whapi'}
                      disabled={Boolean(historyRecoveryDisabledReason)}
                    >
                      {syncingHistoryChatId === selectedChat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleOpenFollowUpModal}
                      variant="soft"
                      size="icon"
                      className="rounded-xl"
                      aria-label="Gerar follow-up com IA"
                      title={followUpGenerationDisabledReason ?? 'Gerar follow-up com IA'}
                      disabled={Boolean(followUpGenerationDisabledReason)}
                    >
                      {generatingFollowUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleOpenLeadDrawer}
                      variant="soft"
                      size="icon"
                      className="rounded-xl"
                      aria-label="Abrir informações do lead"
                      title={selectedChat.lead_id ? 'Abrir informações do lead' : 'Vincular lead do CRM'}
                    >
                      <span className="relative inline-flex">
                        <Info className="h-4 w-4" />
                        {chatAgendaSummary.pendingCount > 0 ? (
                          <span className="absolute -right-2 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none" style={{
                            borderColor: 'var(--brand-primary-border)',
                            background: 'var(--brand-primary)',
                            color: 'var(--text-on-brand)',
                          }}>
                            {chatAgendaSummary.pendingCount > 99 ? '99+' : chatAgendaSummary.pendingCount}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>

              {chatMessageSearchOpen ? (
                <div className="border-b bg-[var(--bg-elevated)] px-5 py-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Input
                        ref={chatMessageSearchInputRef}
                        value={chatMessageSearchDraft}
                        onChange={(event) => setChatMessageSearchDraft(event.target.value)}
                        leftIcon={Search}
                        placeholder="Pesquisar mensagens neste chat"
                        size="compact"
                        autoComplete="off"
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setChatMessageSearchOpen(false);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          setChatMessageSearchDraft('');
                          setChatMessageSearchResults([]);
                          setChatMessageSearchOpen(false);
                        }}
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        aria-label="Fechar busca no chat"
                        title="Fechar busca"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {chatMessageSearch ? (
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                          <span>
                            {searchingChatMessages
                              ? 'Buscando neste chat...'
                              : `${chatMessageSearchResults.length} resultado${chatMessageSearchResults.length === 1 ? '' : 's'}`}
                          </span>
                          {searchingChatMessages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        </div>

                        {!searchingChatMessages && chatMessageSearchResults.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-[var(--text-secondary)]">
                            Nenhuma mensagem encontrada neste chat.
                          </div>
                        ) : (
                          <div className="max-h-52 overflow-y-auto py-1">
                            {chatMessageSearchResults.map((result) => {
                              const messagePreviewText = getMessageSearchPreviewText(result.message);
                              const messagePreviewIconType = getChatPreviewIconType(messagePreviewText);
                              if (!messagePreviewText) {
                                return null;
                              }

                              return (
                                <button
                                  key={result.message.id}
                                  type="button"
                                  onClick={() => handleSelectChatMessageSearchResult(result)}
                                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] focus:outline-none"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                                      {messagePreviewIconType ? <ChatPreviewIcon type={messagePreviewIconType} /> : messagePreviewText}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                                      {result.message.direction === 'outbound' ? 'Você' : 'Contato'}
                                    </span>
                                  </span>
                                  <span className="shrink-0 pt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                    {formatMessageTime(result.message.message_at)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">
                        Digite um trecho da mensagem, legenda ou transcrição para localizar no histórico deste chat.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="whatsapp-inbox-messages min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5"
              >
                {(hasOlderMessages || loadingOlderMessages) && (
                  <div className="sticky top-0 z-[1] flex justify-center pb-3">
                    <Button
                      type="button"
                      onClick={() => void handleLoadOlderMessages()}
                      disabled={loadingOlderMessages}
                      variant="secondary"
                      size="sm"
                      className="whatsapp-inbox-load-older h-8 rounded-xl px-3.5 text-[11px]"
                    >
                      {loadingOlderMessages ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5" />
                      )}
                      {loadingOlderMessages ? 'Carregando...' : 'Carregar mais'}
                    </Button>
                  </div>
                )}

                {loadingMessages && messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-secondary)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando mensagens...
                  </div>
                ) : threadReconcileChatId === selectedChat.id && messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-secondary)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando histórico desta conversa...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-secondary)]">
                    Nenhuma mensagem carregada para esta conversa.
                  </div>
                ) : (
                  messageTimelineItems.map((item) => {
                    if (item.type === 'day') {
                      return (
                        <div key={item.key} className="flex w-full justify-center py-1">
                          <div className="rounded-full border px-3 py-1 text-[12px] font-semibold shadow-sm" style={{
                            borderColor: 'var(--border-strong)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                          }}>
                            {item.label}
                          </div>
                        </div>
                      );
                    }

                    if (item.type === 'media-group') {
                      const groupMessages = item.messages.filter(Boolean);
                      if (groupMessages.length === 0) {
                        return null;
                      }

                      const lastMessage = groupMessages[groupMessages.length - 1];

                      const groupHighlighted = groupMessages.some((message) => message.id === highlightedMessageId);

                      return (
                        <div
                          key={item.key}
                          ref={(node) => {
                            for (const groupMessage of groupMessages) {
                              if (node) {
                                messageBubbleRefs.current[groupMessage.id] = node;
                              } else {
                                delete messageBubbleRefs.current[groupMessage.id];
                              }
                            }
                          }}
                          className={`message-bubble-row flex w-full ${lastMessage.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="relative max-w-[82%] pb-2">
                            <div className={`rounded-[2rem] px-2 py-2 shadow-sm ${getMessageBubbleClasses(lastMessage.direction)} ${groupHighlighted ? 'message-bubble-search-highlight' : ''}`}>
                              <WhatsAppMediaGroupBody messages={groupMessages} onOpenImage={setLightboxMessageId} />
                              <div className="whatsapp-inbox-message-meta mt-2 flex flex-wrap items-center justify-end gap-2 px-2 text-[11px] font-medium">
                                <span>{formatMessageTime(lastMessage.message_at)}</span>
                                {lastMessage.direction === 'outbound' && <DeliveryStatusIndicator message={lastMessage} />}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const { message } = item;
                    if (!message) {
                      return null;
                    }

                    const reactions = getMessageReactions(message);
                    const reactionTooltipText = getReactionTooltipText(message);
                    const showEditAction = canEditOutboundMessage(message);
                    const showDeleteAction = canDeleteOutboundMessage(message);
                    const showReplyForwardActions = canReplyOrForwardMessage(message);

                    return (
                      <div key={item.key} className={`message-bubble-row group/message flex w-full ${message.direction === 'outbound' ? 'justify-end' : message.direction === 'system' ? 'justify-center' : 'justify-start'}`}>
                        <div
                          ref={(node) => {
                            if (node) {
                              reactionAnchorRefs.current[message.id] = node;
                              messageBubbleRefs.current[message.id] = node;
                            } else {
                              delete reactionAnchorRefs.current[message.id];
                              delete messageBubbleRefs.current[message.id];
                            }
                          }}
                          className={`relative max-w-[80%] ${reactions.length > 0 ? 'pb-5' : ''}`}
                        >
                          {message.direction !== 'system' && message.external_message_id ? (
                            <>
                              <button
                                ref={(node) => {
                                  if (node) {
                                    reactionTriggerRefs.current[message.id] = node;
                                  } else {
                                    delete reactionTriggerRefs.current[message.id];
                                  }
                                }}
                                type="button"
                                onClick={() => handleToggleReactionPicker(message.id)}
                                className={`absolute top-1/2 z-[3] inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm transition ${message.direction === 'outbound' ? '-left-10' : '-right-10'} opacity-0 group-hover/message:opacity-100 hover:bg-[var(--bg-hover)] focus:opacity-100`}
                                aria-label="Reagir à mensagem"
                                title="Reagir"
                              >
                                <Smile className="h-4 w-4" />
                              </button>

                            </>
                          ) : null}

                          <div
                            className={`rounded-3xl px-4 py-3 shadow-sm ${getMessageBubbleClasses(message.direction)} ${highlightedMessageId === message.id ? 'message-bubble-search-highlight' : ''}`}
                            onContextMenu={(event) => {
                              if (!showEditAction && !showDeleteAction && !showReplyForwardActions) {
                                return;
                              }

                              event.preventDefault();
                              handleOpenMessageActionMenuFromContext(message.id, { x: event.clientX, y: event.clientY });
                            }}
                          >
                            <WhatsAppMessageBody
                              message={message}
                              onOpenImage={setLightboxMessageId}
                              onTranscribe={(target) => void handleTranscribeMessage(target)}
                              onOpenSharedContactChat={(contact) => void handleOpenSharedContactChat(contact)}
                              onSaveSharedContact={(contact) => void handleSaveSharedContact(contact)}
                              sharedContactActionKey={sharedContactActionKey}
                              transcribing={transcribingMessageId === message.id}
                            />
                            <div className="whatsapp-inbox-message-meta mt-2 flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-medium">
                              {showEditAction || showDeleteAction || showReplyForwardActions ? (
                                <button
                                  ref={(node) => {
                                    if (node) {
                                      messageActionTriggerRefs.current[message.id] = node;
                                    } else {
                                      delete messageActionTriggerRefs.current[message.id];
                                    }
                                  }}
                                  type="button"
                                  onClick={() => handleToggleMessageActionMenu(message.id)}
                                  className={cx(
                                    'inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)]',
                                    openMessageActionMenuMessageId === message.id
                                      ? 'bg-[var(--bg-hover)] opacity-100'
                                      : 'opacity-0 pointer-events-none group-hover/message:opacity-100 group-hover/message:pointer-events-auto group-focus-within/message:opacity-100 group-focus-within/message:pointer-events-auto',
                                  )}
                                  aria-label="Mais acoes da mensagem"
                                  aria-expanded={openMessageActionMenuMessageId === message.id}
                                  title="Mais acoes"
                                >
                                  <ChevronDown className={`h-3.5 w-3.5 transition ${openMessageActionMenuMessageId === message.id ? 'rotate-180' : ''}`} />
                                </button>
                              ) : null}
                              <span>{formatMessageTime(message.message_at)}</span>
                              {message.direction === 'outbound' && <DeliveryStatusIndicator message={message} />}
                              {message.direction === 'outbound' && mediaUploadProgress?.attachmentId === message.id ? (
                                <>
                                  <span className="whatsapp-inbox-status-meta whatsapp-inbox-status-meta-pending">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>{mediaUploadProgress.progress === null ? 'Enviando' : `${mediaUploadProgress.progress}%`}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleCancelMediaUpload}
                                    className="whatsapp-inbox-retry-button h-8 rounded-xl px-3 text-[11px]"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : null}
                              {message.direction === 'outbound' && message.delivery_status === 'failed' && (localOutgoingRetryPayloadRef.current.has(message.id) || Boolean(message.media_id)) ? (
                                <RetryMediaButton loading={retryingMessageId === message.id} onRetry={() => void handleRetryMediaMessage(message)} />
                              ) : null}
                            </div>
                          </div>

                          {reactions.length > 0 ? (
                            <div
                              className={`absolute -bottom-1 z-[2] flex max-w-[90%] flex-wrap gap-1 ${message.direction === 'outbound' ? 'right-3 justify-end' : 'left-3 justify-start'}`}
                              title={reactionTooltipText || undefined}
                            >
                              {reactions.map((reaction) => (
                                <span
                                  key={`${message.id}:${reaction.emoji}`}
                                  className={`inline-flex min-h-[28px] items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-md ${reaction.fromMe ? 'border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}
                                >
                                  <span className="text-sm leading-none">{reaction.emoji}</span>
                                  {reaction.count > 1 ? <span>{reaction.count}</span> : null}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="whatsapp-inbox-composer-area border-t p-4 sm:p-5">
                <div className={`whatsapp-inbox-composer rounded-xl border ${isVoiceComposerMode ? 'is-voice-mode px-0 py-0' : `px-3 ${isComposerExpanded ? 'py-2.5' : 'py-1.5'}`}`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={attachmentInputAccept}
                    className="hidden"
                    onChange={handleAttachmentInputChange}
                  />

                  {voiceAttachment ? (
                    <>
                      <audio ref={voicePreviewAudioRef} src={voiceAttachment.previewUrl ?? undefined} preload="metadata" className="hidden" />
                      <div className="whatsapp-inbox-voice-composer flex items-center gap-2.5 rounded-xl px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => handleClearAttachment()}
                          className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                          aria-label="Descartar nota de voz"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>

                          <button
                            type="button"
                            onClick={handleToggleVoicePreviewPlayback}
                            className="whatsapp-inbox-voice-play inline-flex items-center justify-center rounded-full transition"
                            aria-label={voicePreviewPlaying ? 'Pausar nota de voz' : 'Ouvir nota de voz'}
                          >
                            {voicePreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                          </button>

                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="h-3 w-3 shrink-0 rounded-full bg-[var(--success)] shadow-[0_0_0_4px_var(--success-soft)]" />
                          <div className="min-w-0 flex-1">
                            <WaveformBars bars={voiceAttachment.waveform} active={voicePreviewPlaying} />
                          </div>
                          <span className="whatsapp-inbox-voice-time shrink-0 text-sm font-semibold tabular-nums">
                            {formatDurationLabel(
                              Math.max(
                                0,
                                Math.round(voicePreviewPlaying ? voicePreviewCurrentTime : (voicePreviewDuration ?? voiceAttachment.durationSeconds ?? 0)),
                              ),
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleClearAttachment();
                              void handleStartVoiceRecording();
                            }}
                            className="whatsapp-inbox-voice-side-action is-accent inline-flex items-center justify-center rounded-full transition"
                            aria-label="Regravar nota de voz"
                          >
                            <Mic className="h-4 w-4" />
                          </button>
                        </div>

                          <button
                            type="button"
                            onClick={handleSendCurrentVoiceRecording}
                            disabled={Boolean(sendDisabledReason)}
                            className="whatsapp-inbox-voice-send inline-flex items-center justify-center rounded-full transition"
                            aria-label="Enviar nota de voz"
                          >
                            <SendHorizontal className="h-5 w-5" />
                          </button>
                      </div>
                    </>
                  ) : voiceRecordingState === 'recording' ? (
                    <div className="whatsapp-inbox-voice-composer is-recording flex items-center gap-2.5 rounded-xl px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={handleCancelVoiceRecording}
                        className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                        aria-label="Descartar gravação"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>

                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex shrink-0 items-center gap-2 text-[var(--danger-text)]">
                          <span className="h-3 w-3 rounded-full bg-current shadow-[0_0_0_4px_var(--danger-soft)]" />
                          <span className="whatsapp-inbox-voice-time text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                            {formatDurationLabel(voiceRecordingSeconds)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <WaveformBars bars={voiceRecordingWaveform} active />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStopVoiceRecording()}
                          className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                          aria-label="Parar gravação"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendCurrentVoiceRecording}
                        disabled={Boolean(sendDisabledReason)}
                        className="whatsapp-inbox-voice-send inline-flex items-center justify-center rounded-full transition"
                        aria-label="Parar e enviar nota de voz"
                      >
                        <SendHorizontal className="h-5 w-5" />
                      </button>
                    </div>
                  ) : null}

                  {replyTargetMessage ? (
                    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2.5">
                      <Reply className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Respondendo</p>
                        <p className="truncate text-sm text-[var(--text-secondary)]">{getMessageSearchPreviewText(replyTargetMessage)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTargetMessage(null)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)]"
                        aria-label="Cancelar resposta"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}

                  {documentComposerAttachments.length > 0 && selectedDocumentComposerAttachment ? (() => {
                    const selectedExtension = selectedDocumentComposerAttachment.file.name.split('.').pop()?.toUpperCase() || 'DOC';
                    const selectedIsPdf = selectedDocumentComposerAttachment.file.type === 'application/pdf' || selectedExtension === 'PDF';
                    const selectedUploading = sending && mediaUploadProgress?.attachmentId === selectedDocumentComposerAttachment.id;

                    return (
                      <div className="whatsapp-inbox-document-composer mb-3 overflow-hidden rounded-2xl border">
                        <div className="whatsapp-inbox-document-composer-header flex items-center justify-between gap-3 border-b px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{selectedDocumentComposerAttachment.file.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatFileSize(selectedDocumentComposerAttachment.file.size) || 'Documento'} · {selectedExtension}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleClearAttachment()}
                            className="whatsapp-inbox-media-composer-close inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
                            aria-label="Remover documentos"
                            title="Remover documentos"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="whatsapp-inbox-document-composer-stage relative flex min-h-[min(48vh,30rem)] items-center justify-center p-3 sm:p-4">
                          {selectedIsPdf && selectedDocumentComposerAttachment.previewUrl ? (
                            <iframe
                              src={`${selectedDocumentComposerAttachment.previewUrl}#toolbar=1&navpanes=0`}
                              title={selectedDocumentComposerAttachment.file.name}
                              className="whatsapp-inbox-document-composer-pdf h-[min(46vh,28rem)] w-full rounded-xl border"
                            />
                          ) : (
                            <div className="whatsapp-inbox-document-composer-fallback flex max-w-md flex-col items-center gap-3 rounded-2xl border px-6 py-8 text-center">
                              <div className="whatsapp-inbox-document-composer-extension flex h-16 min-w-16 items-center justify-center rounded-2xl border px-3 text-sm font-bold tracking-[0.08em]">
                                {selectedExtension.slice(0, 4)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">Preview indisponível para este formato</p>
                                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                  O arquivo será enviado normalmente. PDFs podem ser visualizados antes do envio.
                                </p>
                              </div>
                            </div>
                          )}

                          {selectedUploading ? (
                            <div className="absolute bottom-3 left-4 right-4 rounded-full bg-[color-mix(in_srgb,var(--bg-canvas)_60%,transparent)] p-1 backdrop-blur">
                              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                                <div className="whatsapp-inbox-upload-progress h-full rounded-full" style={{ width: `${mediaUploadProgress?.progress ?? 0}%` }} />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="whatsapp-inbox-document-composer-caption flex items-center gap-2 border-t px-3 py-2.5">
                          <button
                            type="button"
                            onClick={handleToggleMediaDrawer}
                            disabled={!selectedChat}
                            className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${mediaDrawerOpen ? 'is-open' : ''}`}
                            aria-label="Emojis"
                            aria-expanded={mediaDrawerOpen}
                            title="Emoji, GIF e figurinha"
                          >
                            <Smile className="h-5 w-5" />
                          </button>
                          <textarea
                            ref={composerTextareaRef}
                            rows={1}
                            value={messageDraft}
                            onChange={handleComposerChange}
                            onPaste={handleComposerPaste}
                            onKeyDown={handleComposerKeyDown}
                            onClick={(event) => syncComposerSelection(event.currentTarget)}
                            onKeyUp={(event) => syncComposerSelection(event.currentTarget)}
                            onSelect={(event) => syncComposerSelection(event.currentTarget)}
                            onFocus={(event) => {
                              setComposerFocused(true);
                              syncComposerSelection(event.currentTarget);
                            }}
                            onBlur={() => setComposerFocused(false)}
                            placeholder="Digite uma mensagem"
                            disabled={generatingFollowUp || sending}
                            className="whatsapp-inbox-composer-input min-h-10 flex-1 resize-none border-none bg-transparent px-0 py-2 text-sm leading-6 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleComposerSubmit}
                            disabled={generatingFollowUp || Boolean(sendDisabledReason) || sending}
                            className="whatsapp-inbox-composer-action is-active inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Enviar documento"
                            title={sendDisabledReason ?? undefined}
                          >
                            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                          </button>
                        </div>

                        <div className="whatsapp-inbox-document-composer-strip flex items-center justify-center gap-2 border-t px-3 py-3">
                          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                            {documentComposerAttachments.map((attachment) => {
                              const extension = attachment.file.name.split('.').pop()?.toUpperCase() || 'DOC';
                              const selected = attachment.id === selectedDocumentComposerAttachment.id;
                              return (
                                <div key={attachment.id} className={`whatsapp-inbox-document-composer-item relative flex h-14 min-w-[12rem] max-w-[16rem] shrink-0 items-center gap-2 overflow-hidden rounded-xl border px-2.5 transition ${selected ? 'is-selected' : ''}`}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDocumentComposerAttachmentId(attachment.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    aria-label="Selecionar documento"
                                  >
                                    <span className="whatsapp-inbox-document-composer-mini-extension flex h-9 min-w-9 items-center justify-center rounded-lg border px-1 text-[10px] font-bold tracking-[0.08em]">
                                      {extension.slice(0, 4)}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs font-semibold">{attachment.file.name}</span>
                                      <span className="block truncate text-[11px] opacity-70">{formatFileSize(attachment.file.size) || extension}</span>
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClearAttachment(attachment.id)}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-canvas)] text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
                                    aria-label="Remover documento"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => handleAttachmentMenuAction('document')}
                              disabled={voiceRecordingState !== 'idle' || generatingFollowUp || sending}
                              className="whatsapp-inbox-media-composer-add inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Adicionar documento"
                              title="Adicionar documento"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}

                  {visualComposerAttachments.length > 0 && selectedMediaComposerAttachment ? (
                    <div className="whatsapp-inbox-media-composer mb-3 overflow-hidden rounded-2xl border">
                      <div className="whatsapp-inbox-media-composer-stage relative flex min-h-[min(48vh,30rem)] items-center justify-center px-4 py-5 sm:px-8">
                        <button
                          type="button"
                          onClick={() => handleClearAttachment()}
                          className="whatsapp-inbox-media-composer-close absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full transition"
                          aria-label="Fechar preview de mídia"
                          title="Remover mídias"
                        >
                          <X className="h-5 w-5" />
                        </button>

                        {selectedMediaComposerAttachment.kind === 'image' && selectedMediaComposerAttachment.previewUrl ? (
                          <img
                            src={selectedMediaComposerAttachment.previewUrl}
                            alt={selectedMediaComposerAttachment.file.name}
                            className="whatsapp-inbox-media-composer-preview max-h-[min(44vh,28rem)] max-w-full object-contain"
                          />
                        ) : selectedMediaComposerAttachment.kind === 'video' && selectedMediaComposerAttachment.previewUrl ? (
                          <video
                            controls
                            preload="metadata"
                            className="whatsapp-inbox-media-composer-preview max-h-[min(44vh,28rem)] max-w-full object-contain"
                          >
                            <source src={selectedMediaComposerAttachment.previewUrl} type={selectedMediaComposerAttachment.file.type || undefined} />
                          </video>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                            <Images className="h-10 w-10" />
                            <span className="text-sm font-semibold">Preview indisponível</span>
                          </div>
                        )}

                        {sending && mediaUploadProgress ? (
                          <div className="absolute bottom-3 left-4 right-4 rounded-full bg-[color-mix(in_srgb,var(--bg-canvas)_60%,transparent)] p-1 backdrop-blur">
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                              <div className="whatsapp-inbox-upload-progress h-full rounded-full" style={{ width: `${mediaUploadProgress.progress ?? 0}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="whatsapp-inbox-media-composer-caption flex items-center gap-2 border-t px-3 py-2.5">
                        <button
                          type="button"
                          onClick={handleToggleMediaDrawer}
                          disabled={!selectedChat}
                          className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${mediaDrawerOpen ? 'is-open' : ''}`}
                          aria-label="Emojis"
                          aria-expanded={mediaDrawerOpen}
                          title="Emoji, GIF e figurinha"
                        >
                          <Smile className="h-5 w-5" />
                        </button>
                        <textarea
                          ref={composerTextareaRef}
                          rows={1}
                          value={messageDraft}
                          onChange={handleComposerChange}
                          onPaste={handleComposerPaste}
                          onKeyDown={handleComposerKeyDown}
                          onClick={(event) => syncComposerSelection(event.currentTarget)}
                          onKeyUp={(event) => syncComposerSelection(event.currentTarget)}
                          onSelect={(event) => syncComposerSelection(event.currentTarget)}
                          onFocus={(event) => {
                            setComposerFocused(true);
                            syncComposerSelection(event.currentTarget);
                          }}
                          onBlur={() => setComposerFocused(false)}
                          placeholder="Digite uma mensagem"
                          disabled={generatingFollowUp || sending}
                          className="whatsapp-inbox-composer-input min-h-10 flex-1 resize-none border-none bg-transparent px-0 py-2 text-sm leading-6 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleComposerSubmit}
                          disabled={generatingFollowUp || Boolean(sendDisabledReason) || sending}
                          className="whatsapp-inbox-composer-action is-active inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Enviar mídia"
                          title={sendDisabledReason ?? undefined}
                        >
                          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                        </button>
                      </div>

                      <div className="whatsapp-inbox-media-composer-strip flex items-center justify-center gap-2 border-t px-3 py-3">
                        <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                          {visualComposerAttachments.map((attachment) => {
                            const selected = attachment.id === selectedMediaComposerAttachment.id;
                            return (
                              <div
                                key={attachment.id}
                                className={`whatsapp-inbox-media-composer-thumb relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border transition ${selected ? 'is-selected' : ''}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedMediaComposerAttachmentId(attachment.id)}
                                  className="flex h-full w-full items-center justify-center overflow-hidden"
                                  aria-label={`Selecionar ${attachment.kind === 'image' ? 'imagem' : 'vídeo'}`}
                                >
                                  {attachment.kind === 'image' && attachment.previewUrl ? (
                                    <img src={attachment.previewUrl} alt="" className="h-full w-full object-cover" />
                                  ) : attachment.kind === 'video' && attachment.previewUrl ? (
                                    <video preload="metadata" className="h-full w-full object-cover">
                                      <source src={attachment.previewUrl} type={attachment.file.type || undefined} />
                                    </video>
                                  ) : (
                                    <Images className="h-5 w-5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearAttachment(attachment.id)}
                                  className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-canvas)] text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
                                  aria-label="Remover mídia"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('media')}
                            disabled={voiceRecordingState !== 'idle' || generatingFollowUp || sending}
                            className="whatsapp-inbox-media-composer-add inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Adicionar mídia"
                            title="Adicionar foto ou vídeo"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {voiceRecordingState === 'recording' || voiceAttachment || visualComposerAttachments.length > 0 ? null : (
                  <>
                  {(replySuggestionLoading || replySuggestionText || replySuggestionError) && !quickReplyMenuOpen ? (
                    <div className="mb-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-sm">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                          {replySuggestionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              Sugestão da IA
                            </p>
                            {replySuggestionText ? (
                              <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline">Tab para aplicar</span>
                            ) : null}
                          </div>
                          {replySuggestionText ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{replySuggestionText}</p>
                          ) : replySuggestionError ? (
                            <p className="mt-1 text-sm leading-6 text-[var(--danger-text)]">{replySuggestionError}</p>
                          ) : (
                            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Analisando histórico e padrão de atendimento...</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {replySuggestionText ? (
                              <Button type="button" size="sm" className="h-8 rounded-xl px-3 text-[11px]" onClick={handleApplyReplySuggestion}>
                                Aplicar
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 rounded-xl px-3 text-[11px]"
                              onClick={() => void handleGenerateReplySuggestion(true)}
                              disabled={replySuggestionLoading}
                            >
                              {replySuggestionText ? 'Gerar outra' : 'Gerar sugestão'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-xl px-3 text-[11px]"
                              onClick={handleDismissReplySuggestion}
                              disabled={replySuggestionLoading && !replySuggestionText}
                            >
                              Ignorar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className={`flex gap-1.5 sm:gap-2 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                    <div ref={attachmentMenuRef} className={`relative flex shrink-0 gap-0.5 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                      {attachmentMenuOpen && (
                        <div className="whatsapp-inbox-attach-menu absolute bottom-full left-0 z-[20] mb-3 min-w-[228px] overflow-hidden rounded-2xl border p-2 shadow-2xl">
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('document')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--text-secondary)]">
                              <FileText className="h-4 w-4" />
                            </span>
                            <span>Documento</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('media')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--brand-primary)]">
                              <Images className="h-4 w-4" />
                            </span>
                            <span>Fotos e vídeos</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('audio')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--accent-gold-hover)]">
                              <FileAudio className="h-4 w-4" />
                            </span>
                            <span>Áudio</span>
                          </button>
                          <button
                            type="button"
                            disabled
                            className="whatsapp-inbox-attach-menu-item is-disabled flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--text-muted)]">
                              <UserRound className="h-4 w-4" />
                            </span>
                            <span>Contato</span>
                            <span className="whatsapp-inbox-attach-menu-badge ml-auto text-[10px] font-medium">Em breve</span>
                          </button>
                        </div>
                      )}

                      <button
                          type="button"
                          onClick={() => setAttachmentMenuOpen((current) => !current)}
                          disabled={voiceRecordingState !== 'idle' || generatingFollowUp}
                          className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${attachmentMenuOpen ? 'is-open' : ''}`}
                          aria-label="Anexar"
                          aria-expanded={attachmentMenuOpen}
                      >
                        <Plus className={`h-5 w-5 transition ${attachmentMenuOpen ? 'rotate-45' : ''}`} />
                      </button>
                        <button
                          type="button"
                          ref={mediaDrawerTriggerRef}
                          onClick={handleToggleMediaDrawer}
                          disabled={!selectedChat}
                          className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${mediaDrawerOpen ? 'is-open' : ''}`}
                        aria-label="Emojis"
                          aria-expanded={mediaDrawerOpen}
                          title="Emoji, GIF e figurinha"
                      >
                        <Smile className="h-5 w-5" />
                      </button>
                    </div>

                    <div ref={composerAiMenuRef} className={`relative flex shrink-0 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                      {composerAiMenuOpen ? (
                        <div className="whatsapp-inbox-attach-menu absolute bottom-full left-0 z-[20] mb-3 min-w-[238px] overflow-hidden rounded-2xl border p-2 shadow-2xl">
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              handleQuickRewriteComposerText('grammar');
                            }}
                            disabled={Boolean(composerRewriteDisabledReason) || rewritingComposer}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={composerRewriteDisabledReason ?? 'Corrigir texto com IA'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--brand-primary)]">
                              {rewritingComposer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                            </span>
                            <span>Corrigir texto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              handleQuickRewriteComposerText('adapt_context');
                            }}
                            disabled={Boolean(composerRewriteDisabledReason) || rewritingComposer}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={composerRewriteDisabledReason ?? 'Adaptar texto ao contexto'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--brand-primary)]">
                              {rewritingComposer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </span>
                            <span>Adaptar ao contexto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              handleOpenComposerRewriteModal();
                            }}
                            disabled={Boolean(composerRewriteDisabledReason)}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={composerRewriteDisabledReason ?? 'Abrir opções de reescrita'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--accent-gold-hover)]">
                              <SlidersHorizontal className="h-4 w-4" />
                            </span>
                            <span>Mais opções</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              void handleGenerateReplySuggestion(true);
                            }}
                            disabled={Boolean(replySuggestionDisabledReason) || replySuggestionLoading}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={replySuggestionDisabledReason ?? 'Sugerir resposta com IA'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--accent-gold-hover)]">
                              {replySuggestionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                            </span>
                            <span>Sugerir resposta</span>
                          </button>
                          <div className="my-1 border-t border-[var(--border-subtle)]" />
                          <div className="grid grid-cols-3 gap-1 px-1 pb-1" aria-label="Formatacao do texto">
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setComposerAiMenuOpen(false);
                                handleApplyComposerTextFormat('bold');
                              }}
                              disabled={generatingFollowUp}
                              className="whatsapp-inbox-composer-icon inline-flex h-8 items-center justify-center rounded-xl text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Negrito"
                              title="Negrito"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setComposerAiMenuOpen(false);
                                handleApplyComposerTextFormat('italic');
                              }}
                              disabled={generatingFollowUp}
                              className="whatsapp-inbox-composer-icon inline-flex h-8 items-center justify-center rounded-xl text-sm italic transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Italico"
                              title="Italico"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setComposerAiMenuOpen(false);
                                handleApplyComposerTextFormat('strike');
                              }}
                              disabled={generatingFollowUp}
                              className="whatsapp-inbox-composer-icon inline-flex h-8 items-center justify-center rounded-xl text-sm line-through transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Riscado"
                              title="Riscado"
                            >
                              S
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setComposerAiMenuOpen((current) => !current)}
                        disabled={Boolean(composerRewriteDisabledReason) && Boolean(replySuggestionDisabledReason)}
                        className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${composerAiMenuOpen || composerRewriteModalOpen || replySuggestionLoading || replySuggestionText ? 'is-open' : ''}`}
                        aria-label="Ações com IA"
                        aria-expanded={composerAiMenuOpen}
                        title="Ações com IA"
                      >
                        {replySuggestionLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Sparkles className="h-4.5 w-4.5" />}
                      </button>
                    </div>

                    <div className={`relative min-w-0 flex-1 ${isComposerExpanded ? 'py-1.5' : 'py-0.5'}`}>
                      {quickReplyMenuOpen && (
                        <div className="absolute right-0 bottom-full left-0 z-[30] mb-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl">
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              Mensagens rápidas por atalho
                            </span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 rounded-xl px-3 text-[11px]"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handleOpenQuickReplySettings();
                              }}
                            >
                              Gerenciar
                            </Button>
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Mensagens rápidas">
                            {quickReplyMenuHasResults ? (
                              filteredQuickReplyOptions.map((option, index) => {
                                const isActive = index === quickReplyActiveIndex;

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition ${isActive ? 'bg-[var(--brand-primary-soft)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      handleInsertQuickReply(option);
                                    }}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold">{option.name}</span>
                                        <code className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-gold-hover)]">
                                          /{option.shortcut}
                                        </code>
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                                        {option.preview}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-4 py-4 text-sm text-[var(--text-secondary)]">
                                <p className="font-medium">{quickReplyEmptyStateMessage}</p>
                                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                  Use o botão <strong>Gerenciar</strong> para criar e editar suas mensagens rápidas sem sair do inbox.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <textarea
                        ref={composerTextareaRef}
                        rows={1}
                        value={messageDraft}
                        onChange={handleComposerChange}
                        onPaste={handleComposerPaste}
                        onKeyDown={handleComposerKeyDown}
                        onClick={(event) => syncComposerSelection(event.currentTarget)}
                        onKeyUp={(event) => syncComposerSelection(event.currentTarget)}
                        onSelect={(event) => syncComposerSelection(event.currentTarget)}
                        onFocus={(event) => {
                          setComposerFocused(true);
                          syncComposerSelection(event.currentTarget);
                        }}
                        onBlur={() => setComposerFocused(false)}
                        placeholder="Digite uma mensagem"
                        disabled={generatingFollowUp}
                        className="whatsapp-inbox-composer-input block w-full resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 focus:outline-none"
                      />
                    </div>

                    <div className={`flex shrink-0 ${isComposerExpanded ? 'items-end pb-0.5' : 'items-center'}`}>
                      <button
                        type="button"
                        onClick={handleComposerSubmit}
                        disabled={generatingFollowUp || Boolean(sendDisabledReason) || voiceRecordingState === 'requesting'}
                        className={`whatsapp-inbox-composer-action inline-flex h-11 w-11 items-center justify-center rounded-xl transition ${hasSendPayload ? 'is-active' : ''} ${generatingFollowUp || voiceRecordingState === 'requesting' ? 'cursor-wait opacity-70' : ''}`}
                        aria-label={voiceRecordingState === 'requesting' ? 'Solicitando microfone' : hasSendPayload ? 'Enviar mensagem' : 'Gravar áudio'}
                        title={sendDisabledReason ?? undefined}
                      >
                        {voiceRecordingState === 'requesting' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : hasSendPayload ? (
                          <SendHorizontal className="h-5 w-5" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              </div>
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

        <WhatsAppQuickRepliesModal
          isOpen={quickRepliesModalOpen}
          quickReplies={quickReplies}
          saving={savingQuickReplies}
          onClose={() => setQuickRepliesModalOpen(false)}
          onSave={handleSaveQuickReplies}
        />

        <WhatsAppEditMessageModal
          isOpen={Boolean(editingMessage)}
          loading={savingMessageEdit}
          value={editingMessageDraft}
          title={editingMessage?.message_type.trim().toLowerCase() === 'text' ? 'Editar mensagem' : 'Editar legenda da mensagem'}
          description={editingMessage?.message_type.trim().toLowerCase() === 'text'
            ? 'Atualize o texto da mensagem enviada. O WhatsApp so permite editar mensagens proprias dentro da janela suportada.'
            : 'Atualize o texto exibido nesta midia. O arquivo continua o mesmo; apenas a legenda sera alterada.'}
          onClose={handleCloseEditMessageModal}
          onChange={setEditingMessageDraft}
          onSubmit={() => void handleSaveEditedMessage()}
        />

        {forwardingMessage ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) handleCloseForwardMessageModal();
            }}
            size="md"
            closeOnEscape={false}
            closeOnOverlay={false}
            aria-label="Encaminhar mensagem"
            className="max-w-lg"
          >
              <DialogHeader onClose={handleCloseForwardMessageModal}>
                <div>
                  <DialogTitle>Encaminhar mensagem</DialogTitle>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{getMessageSearchPreviewText(forwardingMessage)}</p>
                </div>
              </DialogHeader>
              <DialogBody className="space-y-3">
                <Input
                  value={forwardSearch}
                  onChange={(event) => setForwardSearch(event.target.value)}
                  placeholder="Buscar conversa"
                />
                <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
                  {forwardTargetChats.length > 0 ? forwardTargetChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => void handleForwardMessage(chat)}
                      disabled={forwardingChatId === chat.id}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-[var(--bg-hover)] disabled:opacity-70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{getSafeChatDisplayName(chat, channelState?.connected_user_name ?? null)}</p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">{formatCommWhatsAppPhoneLabel(chat.phone_number)}</p>
                      </div>
                      {forwardingChatId === chat.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Forward className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />}
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-5 text-center text-sm text-[var(--text-secondary)]">
                      Nenhuma conversa encontrada.
                    </div>
                  )}
                </div>
              </DialogBody>
          </Dialog>
        ) : null}

        <WhatsAppComposerRewriteModal
          isOpen={composerRewriteModalOpen}
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

        <WhatsAppAgendaModal
          isOpen={whatsAppAgendaOpen}
          onClose={() => setWhatsAppAgendaOpen(false)}
          currentLead={leadPanel}
          currentLeadContracts={leadContracts}
          canEdit={canEditAgenda}
          onGenerateFollowUp={selectedChat ? handleOpenFollowUpModal : undefined}
          onOpenLeadChat={handleOpenAgendaLeadChat}
          onSendBatchFollowUps={handleBatchSendFollowUp}
        />

        <WhatsAppDashboardModal
          isOpen={whatsAppDashboardOpen}
          onClose={() => setWhatsAppDashboardOpen(false)}
        />

        <WhatsAppMediaDrawer
          isOpen={mediaDrawerOpen}
          position={mediaDrawerPosition}
          triggerRef={mediaDrawerTriggerRef}
          canSendMedia={!mediaDrawerSendDisabledReason}
          mediaDisabledReason={mediaDrawerSendDisabledReason}
          sendingMedia={sendingDrawerMedia}
          onClose={() => setMediaDrawerOpen(false)}
          onSelectEmoji={handleInsertEmoji}
          onSendMedia={handleSendDrawerMedia}
        />

        <WhatsAppFollowUpModal
          isOpen={followUpModalOpen}
          generating={generatingFollowUp}
          submitting={sending}
          chatId={selectedChat?.id ?? null}
          value={followUpDraft}
          customInstructions={followUpCustomInstructions}
          tone={followUpTone}
          variations={followUpVariations}
          selectedSalesTechniques={followUpSelectedSalesTechniques}
          selectedSituationPresetIds={followUpSelectedSituationPresetIds}
          aiContextRationale={followUpAiContextRationale}
          nextAction={followUpNextAction}
          schedulingNextAction={schedulingFollowUpNextAction}
          onClose={handleCloseFollowUpModal}
          onChangeValue={setFollowUpDraft}
          onChangeCustomInstructions={setFollowUpCustomInstructions}
          onChangeTone={handleChangeFollowUpTone}
          onToggleSituationPreset={handleToggleFollowUpSituationPreset}
          onToggleSalesTechnique={handleToggleFollowUpSalesTechnique}
          onGenerate={handleRegenerateFollowUp}
          onScheduleNextAction={handleScheduleFollowUpNextAction}
          onSend={handleSendFollowUpDraft}
        />

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

        <WhatsAppLeadDrawer
          isOpen={leadDrawerOpen}
          onClose={handleCloseLeadDrawer}
          chatDisplayName={selectedChatDisplayName}
          linkedLead={leadPanel}
          autoLinked={selectedChatWasAutoLinked}
          loading={leadPanelLoading}
          contracts={leadContracts}
          contractsLoading={leadContractsLoading}
          contractsError={leadContractsError}
          statusOptions={leadStatuses}
          responsavelOptions={responsavelOptions}
          onStatusChange={handleLeadStatusChange}
          onResponsavelChange={handleLeadResponsavelChange}
          onRefreshContracts={handleRefreshLeadContracts}
          onViewLead={leadPanel ? handleViewLeadInCrm : undefined}
          onUnlinkLead={selectedChat?.lead_id ? handleUnlinkLead : undefined}
          searchQuery={leadSearchQuery}
          onSearchQueryChange={setLeadSearchQuery}
          searchResults={leadSearchResults}
          suggestedLead={suggestedLead}
          searchLoading={leadSearchLoading}
          onCreateLead={selectedChat && !selectedChat.lead_id ? handleOpenCreateLeadFromChat : undefined}
          onLinkLead={(leadId) => void handleLinkLead(leadId)}
          linkLoadingLeadId={linkLoadingLeadId}
          canViewAgenda={canViewAgenda}
          canEditAgenda={canEditAgenda}
        />

        {createLeadDraft ? (
          <LeadForm
            lead={null}
            initialValues={createLeadDraft.initialValues}
            onClose={handleCloseCreateLeadFromChat}
            onSave={(lead) => void handleCreateLeadFromChatSaved(lead)}
          />
        ) : null}

        <WhatsAppStartChatModal
          isOpen={startChatModalOpen}
          onClose={() => setStartChatModalOpen(false)}
          query={startChatQuery}
          onQueryChange={setStartChatQuery}
          contacts={savedContacts}
          contactsTotal={savedContactsTotal}
          contactsHasMore={savedContactsHasMore}
          contactsLoading={savedContactsLoading}
          contactsLoadingMore={savedContactsLoadingMore}
          onLoadMoreContacts={handleLoadMoreSavedContacts}
          crmLeads={crmStartResults}
          crmLoading={crmStartLoading}
          onStartFromSavedContact={(contact) => void handleStartChatFromSavedContact(contact)}
          onStartFromLead={(lead) => void handleStartChatFromLead(lead)}
          manualPhone={manualStartPhone}
          onManualPhoneChange={setManualStartPhone}
          onStartFromManual={() => void handleStartChatFromManual()}
          startingKey={startingChatKey}
        />

        <PanelPopoverShell
          ref={reactionPickerRef}
          isOpen={Boolean(openReactionPickerMessage && reactionPickerPosition)}
          position={reactionPickerPosition}
          onClose={() => setOpenReactionPickerMessageId(null)}
          ariaLabel="Seletor de reacoes da mensagem"
          className="before:hidden border-none bg-transparent p-0 shadow-none"
          style={{
            width: REACTION_PICKER_WIDTH_PX,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            overflow: 'visible',
            borderRadius: 9999,
            padding: '6px 8px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          {openReactionPickerMessage
            ? REACTION_OPTIONS.map((emoji) => {
                const selected = getOwnReactionEmoji(openReactionPickerMessage) === emoji;
                return (
                  <button
                    key={`${openReactionPickerMessage.id}:${emoji}`}
                    type="button"
                    onClick={() => void handleReactToMessage(openReactionPickerMessage, emoji)}
                    disabled={reactingMessageId === openReactionPickerMessage.id}
                    className={`message-bubble-emoji-button inline-flex h-9 w-9 items-center justify-center rounded-full text-[1.45rem] leading-none transition ${selected ? 'bg-[var(--brand-primary-soft)] scale-105' : 'hover:bg-[var(--bg-hover)]'}`}
                    aria-label={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })
            : null}
        </PanelPopoverShell>

        <PanelPopoverShell
          ref={messageActionMenuRef}
          isOpen={Boolean(openMessageActionMenuMessage && messageActionMenuPosition)}
          position={messageActionMenuPosition}
          onClose={() => {
            setMessageActionMenuPointerAnchor(null);
            setOpenMessageActionMenuMessageId(null);
          }}
          ariaLabel="Menu da mensagem"
          className="before:hidden overflow-y-auto rounded-2xl border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-2xl"
          style={{ width: messageActionMenuPosition?.width ?? 268, maxHeight: messageActionMenuPosition?.maxHeight }}
        >
          {openMessageActionMenuMessage ? (
            <div className="flex flex-col gap-1">
              {canReplyOrForwardMessage(openMessageActionMenuMessage) ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleReplyToMessage(openMessageActionMenuMessage)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
                  >
                    <Reply className="h-4 w-4 shrink-0" />
                    <span>Responder mensagem</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenForwardMessageModal(openMessageActionMenuMessage)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
                  >
                    <Forward className="h-4 w-4 shrink-0" />
                    <span>Encaminhar mensagem</span>
                  </button>
                </>
              ) : null}
              {canEditOutboundMessage(openMessageActionMenuMessage) ? (
                <button
                  type="button"
                  onClick={() => handleOpenEditMessageModal(openMessageActionMenuMessage)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
                >
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span>{openMessageActionMenuMessage.message_type.trim().toLowerCase() === 'text' ? 'Editar mensagem' : 'Editar legenda'}</span>
                </button>
              ) : null}
              {canDeleteOutboundMessage(openMessageActionMenuMessage) ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteMessage(openMessageActionMenuMessage)}
                  disabled={deletingMessageId === openMessageActionMenuMessage.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--danger-text)] transition hover:bg-[var(--danger-soft)] disabled:opacity-60"
                >
                  {deletingMessageId === openMessageActionMenuMessage.id ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Trash2 className="h-4 w-4 shrink-0" />}
                  <span>Apagar mensagem</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </PanelPopoverShell>

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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
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
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>{openChatMenuChat.manual_unread || openChatMenuChat.unread_count > 0 ? 'Marcar como lida' : 'Marcar como nao lida'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatMenuPointerAnchor(null);
                  setOpenChatMenuChatId(null);
                  void handleDeleteChat(openChatMenuChat);
                }}
                disabled={deletingChatId === openChatMenuChat.id || updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--danger-text)] transition hover:bg-[var(--danger-soft)] disabled:opacity-60"
              >
                {deletingChatId === openChatMenuChat.id ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Trash2 className="h-4 w-4 shrink-0" />}
                <span>Excluir conversa</span>
              </button>
            </div>
          ) : null}
        </PanelPopoverShell>

        <PanelPopoverShell
          ref={advancedFiltersRef}
          isOpen={advancedFiltersOpen}
          position={advancedFiltersPosition}
          onClose={() => setAdvancedFiltersOpen(false)}
          ariaLabel="Filtros avançados do inbox"
          className="w-[272px] border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 shadow-2xl"
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
              options={leadStatuses.map((status) => ({
                value: status.nome,
                label: status.nome,
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
                  setAdvancedFiltersOpen(false);
                }}
                className="h-auto px-0 py-1 text-[11px] uppercase tracking-[0.12em] text-[var(--brand-primary)] hover:bg-transparent hover:text-[var(--brand-primary-hover)]"
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
