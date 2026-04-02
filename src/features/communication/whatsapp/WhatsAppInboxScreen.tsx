import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AlertCircle, AlertTriangle, Archive, ArchiveRestore, Bell, BellOff, CalendarDays, Check, CheckCheck, ChevronDown, ChevronUp, Clock3, Cog, Copy, Download, FileAudio, FileImage, FileText, Headphones, Images, Info, Loader2, MessageCircle, Mic, Pause, Pin, Play, Plus, Search, SendHorizontal, SlidersHorizontal, Smile, Sparkles, Trash2, UserRound, Volume2, WifiOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import PanelPopoverShell from '../../../components/ui/PanelPopoverShell';
import { getPanelButtonClass } from '../../../components/ui/standards';
import ReminderSchedulerModal from '../../../components/ReminderSchedulerModal';
import StatusDropdown from '../../../components/StatusDropdown';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { applyTemplateVariables } from '../../../lib/autoContactService';
import {
  commWhatsAppService,
  formatCommWhatsAppPhoneLabel,
  type CommWhatsAppLeadContractSummary,
  type CommWhatsAppLeadPanel,
  type CommWhatsAppLeadSearchResult,
  type CommWhatsAppMediaSendKind,
  type CommWhatsAppOperationalState,
  type CommWhatsAppRewriteTone,
} from '../../../lib/commWhatsAppService';
import { configService } from '../../../lib/configService';
import { formatDateTimeFullBR, isOverdue } from '../../../lib/dateUtils';
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
import { fetchAllPages, supabase, type CommWhatsAppChat, type CommWhatsAppMessage, type CommWhatsAppPhoneContact, type IntegrationSetting, type Lead, type Reminder } from '../../../lib/supabase';
import WhatsAppAgendaModal from './components/WhatsAppAgendaModal';
import WhatsAppComposerRewriteModal from './components/WhatsAppComposerRewriteModal';
import WhatsAppDashboardModal from './components/WhatsAppDashboardModal';
import WhatsAppFollowUpModal from './components/WhatsAppFollowUpModal';
import WhatsAppMediaDrawer from './components/WhatsAppMediaDrawer';
import WhatsAppLeadDrawer from './components/WhatsAppLeadDrawer';
import WhatsAppQuickRepliesModal from './components/WhatsAppQuickRepliesModal';
import WhatsAppStartChatModal from './components/WhatsAppStartChatModal';

const CHAT_POLL_INTERVAL_MS = 8000;
const MESSAGE_POLL_INTERVAL_MS = 5000;
const OPERATIONAL_STATE_POLL_INTERVAL_MS = 30000;
const MESSAGE_PAGE_SIZE = 50;
const SCROLL_BOTTOM_THRESHOLD_PX = 96;
const STALE_WEBHOOK_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const CHAT_IDENTITY_LOOKUP_BATCH_SIZE = 25;
const DEFAULT_TRANSCRIPT_TIME_ZONE = 'America/Sao_Paulo';
const AUDIO_WITHOUT_TRANSCRIPTION_MARKER = '[Áudio sem transcrição]';
const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REACTION_PICKER_WIDTH_PX = 252;
const REACTION_PICKER_HEIGHT_PX = 52;

type MessageLoadReason = 'initial' | 'poll' | 'send';
type ScrollMode = 'bottom' | 'preserve' | 'prepend' | null;
type VoiceRecordingState = 'idle' | 'requesting' | 'recording';
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
type ComposerSelection = { start: number; end: number };
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
type LocalOutgoingRetryPayload =
  | { kind: 'text'; text: string }
  | {
      kind: 'media';
      mediaKind: CommWhatsAppMediaSendKind;
      file: File;
      caption?: string;
      durationSeconds?: number;
      waveform?: string;
      fileName?: string;
      previewUrl?: string | null;
    }
  | {
      kind: 'remote_media';
      mediaKind: 'image' | 'video' | 'document';
      remoteUrl: string;
      mimeType?: string;
      fileName?: string;
      caption?: string;
      previewUrl?: string | null;
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
const createLocalOutgoingMessageId = () => `local-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const VIDEO_LIKE_MESSAGE_TYPES = new Set(['video', 'gif', 'short']);
const GALLERY_MESSAGE_TYPES = new Set(['image', 'video', 'gif', 'short']);
const GALLERY_GROUP_MAX_GAP_MS = 2 * 60 * 1000;
const EMPTY_COMPOSER_SELECTION: ComposerSelection = { start: 0, end: 0 };

const buildMediaSummaryText = (kind: CommWhatsAppMediaSendKind | 'document', caption?: string) => {
  const normalizedCaption = String(caption ?? '').trim();
  if (normalizedCaption) {
    return normalizedCaption;
  }

  if (kind === 'image') return '[Imagem]';
  if (kind === 'video') return '[Video]';
  if (kind === 'audio' || kind === 'voice') return '[Audio]';
  return '[Documento]';
};

const getMessageSummaryMarker = (messageType: string) => {
  const normalized = messageType.trim().toLowerCase();

  if (normalized === 'image') return '[Imagem]';
  if (VIDEO_LIKE_MESSAGE_TYPES.has(normalized)) return '[Video]';
  if (normalized === 'audio' || normalized === 'voice') return '[Audio]';
  if (normalized === 'document') return '[Documento]';
  if (normalized === 'sticker') return '[Sticker]';
  if (normalized === 'contact' || normalized === 'contact_list') return '[Contato]';
  if (normalized === 'poll') return '[Enquete]';
  return getUnknownMessageMarker(normalized);
};

const isMessageSummaryMarker = (value?: string | null, messageType?: string) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return false;
  }

  const markers = new Set([
    '[Imagem]',
    '[Video]',
    '[Documento]',
    '[Audio]',
    '[Sticker]',
    '[Contato]',
    '[Enquete]',
    '[Mensagem]',
  ]);

  if (messageType?.trim()) {
    markers.add(getMessageSummaryMarker(messageType));
  }

  return markers.has(normalized);
};

const isVideoLikeMessageType = (messageType: string) => VIDEO_LIKE_MESSAGE_TYPES.has(messageType.trim().toLowerCase());

const isGalleryMediaMessage = (message: CommWhatsAppMessage) => GALLERY_MESSAGE_TYPES.has(message.message_type.trim().toLowerCase());

const getMessageVisibleCaption = (message: CommWhatsAppMessage) => {
  const directCaption = String(message.media_caption ?? '').trim();
  if (directCaption && !isMessageSummaryMarker(directCaption, message.message_type)) {
    return directCaption;
  }

  const fallbackText = String(message.text_content ?? '').trim();
  if (!fallbackText || isMessageSummaryMarker(fallbackText, message.message_type)) {
    return '';
  }

  return fallbackText;
};

const getMessageTimestampMs = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
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
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

const buildTranscriptContent = (message: CommWhatsAppMessage) => {
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

  const withDeletedFlag = (content: string) => {
    if (!isDeleted) {
      return content;
    }

    return content ? `[Mensagem apagada] ${content}` : getDeletedMessageMarker(kind);
  };

  if (kind === 'text') {
    return withDeletedFlag(text);
  }

  if (kind === 'image') {
    return withDeletedFlag(caption ? `[Imagem] ${caption}` : '[Imagem]');
  }

  if (kind === 'video' || kind === 'gif' || kind === 'short') {
    return withDeletedFlag(caption ? `[Video] ${caption}` : '[Video]');
  }

  if (kind === 'document') {
    return withDeletedFlag(caption ? `[Documento] ${caption}` : '[Documento]');
  }

  if (kind === 'audio' || kind === 'voice') {
    return withDeletedFlag(transcription || AUDIO_WITHOUT_TRANSCRIPTION_MARKER);
  }

  if (caption) {
    return withDeletedFlag(caption);
  }

  if (text) {
    return withDeletedFlag(text);
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatMessageDaySeparatorLabel = (value?: string | null) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayStart.getTime() - targetDay.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return 'Hoje';
  }

  if (diffDays === 1) {
    return 'Ontem';
  }

  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatConnectionStatusLabel = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toUpperCase();

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
      return normalized || 'Desconhecido';
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
  const timeDiff = new Date(a.message_at).getTime() - new Date(b.message_at).getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return a.id.localeCompare(b.id);
};

const getChatPreviewPrefix = (direction: CommWhatsAppChat['last_message_direction']) => {
  switch (direction) {
    case 'outbound':
      return 'Você:';
    case 'inbound':
      return 'Contato:';
    case 'system':
      return 'Sistema:';
    default:
      return '';
  }
};

const getChatPreviewPrefixClassName = (direction: CommWhatsAppChat['last_message_direction']) => {
  switch (direction) {
    case 'outbound':
      return 'text-[var(--panel-accent-ink,#8b4d12)]';
    case 'system':
      return 'text-[var(--panel-text-subtle,#9a8573)]';
    default:
      return 'text-[var(--panel-text-soft,#5b4635)]';
  }
};

const mergeMessages = (existing: CommWhatsAppMessage[], incoming: CommWhatsAppMessage[]) => {
  const map = new Map<string, CommWhatsAppMessage>();

  for (const message of existing) {
    map.set(message.id, message);
  }

  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(compareMessageChronology);
};

const sortChatsByInboxOrder = (items: CommWhatsAppChat[]) => {
  return [...items].sort((a, b) => {
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

    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });
};

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
      editedAt: null,
    };
  }

  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
    ? message.metadata as Record<string, unknown>
    : {};
  const currentText = String(message.text_content ?? message.media_caption ?? '').trim();
  const originalText = String(metadata.original_text_content ?? '').trim();
  const editedAt = String(metadata.edited_at ?? '').trim() || null;
  const edited = metadata.edited === true || Boolean(originalText && originalText !== currentText);

  return {
    edited,
    originalText: originalText && originalText !== currentText ? originalText : null,
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

const getSafeChatDisplayName = (chat: CommWhatsAppChat | null, connectedUserName?: string | null) => {
  if (!chat) {
    return 'Conversa';
  }

  const displayName = String(chat.display_name ?? '').trim();
  const ownName = String(connectedUserName ?? '').trim().toLowerCase();
  const isOwnNameLeak = !chat.saved_contact_name && !chat.lead_id && displayName && ownName && displayName.toLowerCase() === ownName;

  if (isOwnNameLeak) {
    return formatCommWhatsAppPhoneLabel(chat.phone_number);
  }

  return displayName || formatCommWhatsAppPhoneLabel(chat.phone_number);
};

const getDeliveryStatusMeta = (message: CommWhatsAppMessage) => {
  const status = String(message.delivery_status ?? '').trim().toLowerCase();

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
        label: message.message_type === 'voice' ? 'Ouvida' : 'Reproduzida',
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

const formatDurationLabel = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${mins}:${secs}`;
};

const getSupportedVoiceMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = ['audio/ogg;codecs=opus', 'audio/ogg', 'audio/webm;codecs=opus', 'audio/webm'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const buildWaveformBars = (input: Uint8Array, barCount: number = 28) => {
  if (!input.length) return DEFAULT_WAVEFORM;

  const chunkSize = Math.max(1, Math.floor(input.length / barCount));
  const bars: number[] = [];

  for (let index = 0; index < barCount; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(input.length, start + chunkSize);
    let peak = 0;

    for (let offset = start; offset < end; offset += 1) {
      const amplitude = Math.abs(input[offset] - 128) / 128;
      if (amplitude > peak) {
        peak = amplitude;
      }
    }

    bars.push(Math.max(0.14, Math.min(1, peak * 1.8 + 0.12)));
  }

  return bars;
};

const buildVoiceWaveformPayload = (input: Uint8Array, barCount: number = 64) => {
  if (!input.length) {
    return '';
  }

  const chunkSize = Math.max(1, Math.floor(input.length / barCount));
  const samples = new Uint8Array(barCount);

  for (let index = 0; index < barCount; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(input.length, start + chunkSize);
    let total = 0;
    let count = 0;

    for (let offset = start; offset < end; offset += 1) {
      total += Math.abs(input[offset] - 128) / 128;
      count += 1;
    }

    const average = count > 0 ? total / count : 0;
    samples[index] = Math.max(0, Math.min(127, Math.round(average * 127)));
  }

  let binary = '';
  samples.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary);
};

function WaveformBars({ bars, active = false }: { bars?: number[]; active?: boolean }) {
  const resolvedBars = bars && bars.length > 0 ? bars : DEFAULT_WAVEFORM;

  return (
    <div className={`whatsapp-inbox-waveform ${active ? 'is-active' : ''}`} aria-hidden="true">
      {resolvedBars.map((bar, index) => (
        <span
          key={`${index}-${bar}`}
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
  const [mediaUrl, setMediaUrl] = useState<string | null>(message.media_url ?? commWhatsAppService.getRememberedLocalMediaPreview(message.external_message_id) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (message.media_url?.trim()) {
      setMediaUrl(message.media_url.trim());
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    const rememberedPreview = commWhatsAppService.getRememberedLocalMediaPreview(message.external_message_id);
    if (rememberedPreview) {
      setMediaUrl(rememberedPreview);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
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
      setMediaUrl(null);
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
  }, [message.external_message_id, message.media_id, message.media_url]);

  return { mediaUrl, loading, error };
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">{label}</p>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">{label}</p>
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
  onOpenImage: (payload: { src: string; name: string }) => void;
  className?: string;
  overlayLabel?: string;
}) {
  const { mediaUrl, loading, error } = useResolvedMediaUrl(message);
  const normalizedKind = isVideoLikeMessageType(message.message_type) ? 'video' : 'image';
  const baseClassName = `relative block overflow-hidden rounded-[1.15rem] bg-[rgba(26,18,13,0.08)] ${className ?? ''}`.trim();

  if (normalizedKind === 'image') {
    return mediaUrl ? (
      <button
        type="button"
        onClick={() => onOpenImage({ src: mediaUrl, name: message.media_file_name || 'Imagem enviada' })}
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
      <div className={`${baseClassName} flex items-center justify-center text-sm text-[var(--panel-text-muted,#8a735f)]`}>
        {loading ? 'Carregando imagem...' : error || 'Imagem indisponivel'}
      </div>
    );
  }

  const secondaryLabel = message.media_duration_seconds && message.media_duration_seconds > 0
    ? formatDurationLabel(Math.round(message.media_duration_seconds))
    : formatFileSize(message.media_size_bytes) || 'Video';

  return mediaUrl ? (
    <a href={mediaUrl} target="_blank" rel="noreferrer" className={baseClassName}>
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
    </a>
  ) : (
    <div className={`${baseClassName} flex items-center justify-center text-sm text-[var(--panel-text-muted,#8a735f)]`}>
      {loading ? 'Carregando video...' : error || 'Video indisponivel'}
    </div>
  );
}

function WhatsAppMediaGroupBody({
  messages,
  onOpenImage,
}: {
  messages: CommWhatsAppMessage[];
  onOpenImage: (payload: { src: string; name: string }) => void;
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
  menuTriggerRef: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <div className={`group/chat whatsapp-inbox-chat-card border-b transition ${selected ? 'is-active' : ''}`}>
      <div className="flex items-start gap-2 px-4 py-3">
        <button type="button" onClick={() => onSelect(chat.id)} className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--panel-text,#1f2937)]">
                  {getSafeChatDisplayName(chat, connectedUserName)}
                </p>
                {chat.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--panel-accent-strong,#c86f1d)]" /> : null}
                {chat.is_archived ? <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--panel-text-muted,#8a735f)]" /> : null}
                {chat.is_muted ? <BellOff className="h-3.5 w-3.5 shrink-0 text-[var(--panel-text-muted,#8a735f)]" /> : null}
              </div>
              <p className="truncate text-xs text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(chat.phone_number)}</p>
            </div>
            <div className="flex h-10 shrink-0 flex-col items-end justify-between">
              <span className="whatsapp-inbox-chat-meta text-[11px] font-medium leading-none">{formatMessageTime(chat.last_message_at)}</span>
              <span className={`whatsapp-inbox-unread-badge inline-flex min-h-5 min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition-opacity ${(chat.unread_count > 0 || chat.manual_unread) ? 'opacity-100' : 'opacity-0'}`} aria-hidden={chat.unread_count > 0 || chat.manual_unread ? undefined : true}>
                {chat.unread_count > 0 ? chat.unread_count : chat.manual_unread ? '•' : ''}
              </span>
            </div>
          </div>
          <p className="mt-3 truncate text-sm text-[var(--panel-text-muted,#6b7280)]">
            {draftPreview ? (
              <>
                <span className="mr-1 font-semibold text-[var(--panel-accent-red-text,#d9776b)]">Rascunho:</span>
                <span>{draftPreview}</span>
              </>
            ) : chat.last_message_text ? (
              <>
                <span className={`mr-1 font-semibold ${getChatPreviewPrefixClassName(chat.last_message_direction)}`}>
                  {getChatPreviewPrefix(chat.last_message_direction)}
                </span>
                <span>{chat.last_message_text}</span>
              </>
            ) : (
              'Sem mensagens ainda'
            )}
          </p>
        </button>

        <button
          ref={menuTriggerRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu(chat.id);
          }}
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--panel-text-muted,#8a735f)] transition hover:bg-[rgba(255,248,240,0.08)] hover:text-[var(--panel-text,#f3e6d7)] ${menuOpen ? 'bg-[rgba(255,248,240,0.08)] text-[var(--panel-text,#f3e6d7)]' : 'opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100'} ${selected ? 'opacity-100' : ''}`}
          aria-label="Abrir menu da conversa"
          aria-expanded={menuOpen}
          disabled={menuBusy}
        >
          {menuBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className={`h-4 w-4 transition ${menuOpen ? 'rotate-180' : ''}`} />}
        </button>
      </div>
    </div>
  );
}

function WhatsAppMessageBody({
  message,
  onOpenImage,
  onTranscribe,
  transcribing,
}: {
  message: CommWhatsAppMessage;
  onOpenImage: (payload: { src: string; name: string }) => void;
  onTranscribe: (message: CommWhatsAppMessage) => void;
  transcribing: boolean;
}) {
  const { mediaUrl, loading, error } = useResolvedMediaUrl(message);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const kind = message.message_type.trim().toLowerCase();
  const caption = getMessageVisibleCaption(message);
  const editInfo = useMemo(() => getEditedMessageInfo(message), [message]);
  const deletedInfo = useMemo(() => getDeletedMessageInfo(message), [message]);

  useEffect(() => {
    setShowOriginalText(false);
  }, [message.id, editInfo.originalText, message.text_content, message.media_caption]);

  const editInfoNode = editInfo.edited ? (
    <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f7efe3)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">
        <span>Editada</span>
        {editInfo.originalText ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginalText((current) => !current)}
            className="h-7 rounded-xl px-2.5 text-[11px] normal-case tracking-normal"
          >
            {showOriginalText ? 'Ocultar original' : 'Ver original'}
          </Button>
        ) : null}
      </div>
      {showOriginalText && editInfo.originalText ? (
        <div className="mt-2 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">Original</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text,#1f2937)]">
            {editInfo.originalText}
          </p>
        </div>
      ) : null}
    </div>
  ) : null;

  if (deletedInfo.deleted) {
    const deletedByLabel = deletedInfo.deletedBy === 'self'
      ? 'Você apagou esta mensagem no WhatsApp.'
      : deletedInfo.deletedBy === 'contact'
        ? 'O contato apagou esta mensagem no WhatsApp.'
        : 'Mensagem apagada no WhatsApp.';

    return (
      <div className="rounded-2xl border border-[rgba(215,154,143,0.45)] bg-[rgba(122,33,24,0.08)] px-3 py-3 text-[var(--panel-accent-red-text,#b4534a)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Mensagem apagada</span>
        </div>
        <p className="mt-2 text-xs text-[var(--panel-text-muted,#876f5c)]">{deletedByLabel}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text-soft,#5b4635)] line-through opacity-85">
          {deletedInfo.preservedText}
        </p>
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className="space-y-3">
        {mediaUrl ? (
          <button
            type="button"
            onClick={() => onOpenImage({ src: mediaUrl, name: message.media_file_name || 'Imagem enviada' })}
            className="whatsapp-inbox-image-card block w-full overflow-hidden rounded-2xl border text-left"
          >
            <img src={mediaUrl} alt={message.media_file_name || 'Imagem enviada'} className="max-h-[280px] w-full object-cover" loading="lazy" />
            <div className="whatsapp-inbox-image-card-footer flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span className="truncate font-medium">{message.media_file_name || 'Imagem'}</span>
              <span className="shrink-0 opacity-80">Toque para ampliar</span>
            </div>
          </button>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-black/5 text-sm opacity-80">
            {loading ? 'Carregando imagem...' : error || 'Imagem indisponível'}
          </div>
        )}
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
        {editInfoNode}
      </div>
    );
  }

  if (isVideoLikeMessageType(kind)) {
    return (
      <div className="space-y-3">
        <div className="whatsapp-inbox-image-card overflow-hidden rounded-2xl border">
          {mediaUrl ? (
            <video controls preload="metadata" className="max-h-[320px] w-full bg-black object-contain">
              <source src={mediaUrl} type={message.media_mime_type || undefined} />
            </video>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-black/5 text-sm opacity-80">
              {loading ? 'Carregando vídeo...' : error || 'Vídeo indisponível'}
            </div>
          )}
          <div className="whatsapp-inbox-image-card-footer flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span className="truncate font-medium">{message.media_file_name || 'Video'}</span>
              <span className="shrink-0 opacity-80">{formatFileSize(message.media_size_bytes) || 'Midia'}</span>
            </div>
          </div>
          {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
          {editInfoNode}
        </div>
    );
  }

  if (kind === 'document') {
    const extension = message.media_file_name?.split('.').pop()?.toUpperCase() || 'DOC';

    return (
      <div className="space-y-3">
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
              <span className="text-xs opacity-75">{loading ? 'Carregando...' : error || 'Sem arquivo'}</span>
            )}
          </div>
        </div>
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'audio' || kind === 'voice') {
    const transcriptionStatus = message.transcription_status || 'idle';
    const canTranscribe = Boolean(message.media_id || message.media_url);

    return (
      <div className="space-y-3">
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
            <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f7efe3)] px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">Transcrição</p>
                {message.transcription_provider ? (
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--panel-text-subtle,#9a8573)]">
                    {message.transcription_provider}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text,#1f2937)]">
                {message.transcription_text}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {transcriptionStatus === 'processing' || transcribing ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-1.5 text-[11px] font-semibold text-[var(--panel-text-soft,#5b4635)]">
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
              <span className="text-xs text-[var(--panel-accent-red-text,#d9776b)]">{message.transcription_error}</span>
            ) : null}
          </div>
        </div>
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
        {editInfoNode}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text_content || '[Mensagem sem texto]'}</p>
      {editInfoNode}
    </div>
  );
}

export default function WhatsAppInboxScreen() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { leadStatuses, options, getRoleModulePermission } = useConfig();
  const responsavelOptions = options.lead_responsavel;
  const agendaPermission = getRoleModulePermission(role, 'agenda');
  const canViewAgenda = agendaPermission.can_view;
  const canEditAgenda = agendaPermission.can_edit;
  const [loading, setLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFiltersPosition, setAdvancedFiltersPosition] = useState<{ top: number; left: number } | null>(null);
  const [chatActivityFilter, setChatActivityFilter] = useState<ChatActivityFilter>('all');
  const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>([]);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentInputAccept, setAttachmentInputAccept] = useState('image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,audio/*');
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [composerDraftsByChatId, setComposerDraftsByChatId] = useState<Record<string, string>>({});
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);
  const [updatingChatStateId, setUpdatingChatStateId] = useState<string | null>(null);
  const [quickReplyIntegration, setQuickReplyIntegration] = useState<IntegrationSetting | null>(null);
  const [quickReplies, setQuickReplies] = useState<WhatsAppQuickReply[]>(DEFAULT_QUICK_REPLIES);
  const [quickRepliesModalOpen, setQuickRepliesModalOpen] = useState(false);
  const [savingQuickReplies, setSavingQuickReplies] = useState(false);
  const [whatsAppAgendaOpen, setWhatsAppAgendaOpen] = useState(false);
  const [whatsAppDashboardOpen, setWhatsAppDashboardOpen] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpCustomInstructions, setFollowUpCustomInstructions] = useState('');
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [composerRewriteModalOpen, setComposerRewriteModalOpen] = useState(false);
  const [composerRewriteSource, setComposerRewriteSource] = useState('');
  const [composerRewriteDraft, setComposerRewriteDraft] = useState('');
  const [composerRewriteCustomInstructions, setComposerRewriteCustomInstructions] = useState('');
  const [composerRewriteTone, setComposerRewriteTone] = useState<CommWhatsAppRewriteTone>('grammar');
  const [rewritingComposer, setRewritingComposer] = useState(false);
  const [copyingTranscript, setCopyingTranscript] = useState(false);
  const [syncingHistoryChatId, setSyncingHistoryChatId] = useState<string | null>(null);
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);
  const [mediaDrawerPosition, setMediaDrawerPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [sendingDrawerMedia, setSendingDrawerMedia] = useState(false);
  const [composerSelectionsByChatId, setComposerSelectionsByChatId] = useState<Record<string, ComposerSelection>>({});
  const [composerFocused, setComposerFocused] = useState(false);
  const [quickReplyActiveIndex, setQuickReplyActiveIndex] = useState(0);
  const [dismissedQuickReplyKey, setDismissedQuickReplyKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [transcribingMessageId, setTranscribingMessageId] = useState<string | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [openChatMenuChatId, setOpenChatMenuChatId] = useState<string | null>(null);
  const [chatMenuPosition, setChatMenuPosition] = useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const [localOutgoingMessages, setLocalOutgoingMessages] = useState<CommWhatsAppMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [voiceRecordingState, setVoiceRecordingState] = useState<VoiceRecordingState>('idle');
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [voiceRecordingWaveform, setVoiceRecordingWaveform] = useState<number[]>(DEFAULT_WAVEFORM);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<MediaUploadProgress | null>(null);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const [voicePreviewDuration, setVoicePreviewDuration] = useState<number | null>(null);
  const [voicePreviewCurrentTime, setVoicePreviewCurrentTime] = useState(0);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [operationalState, setOperationalState] = useState<CommWhatsAppOperationalState | null>(null);
  const [operationalStateLoaded, setOperationalStateLoaded] = useState(false);
  const [operationalStateError, setOperationalStateError] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ src: string; name: string } | null>(null);
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
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
  const [isWindowFocused, setIsWindowFocused] = useState(() => (typeof document === 'undefined' ? true : document.hasFocus()));
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const advancedFiltersRef = useRef<HTMLDivElement | null>(null);
  const advancedFiltersTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mediaDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const chatMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reactionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const chatMenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceWaveformTimerRef = useRef<number | null>(null);
  const voiceMimeTypeRef = useRef('');
  const discardVoiceRecordingRef = useRef(false);
  const cancelVoiceRecordingRef = useRef<() => void>(() => undefined);
  const voiceRecordingSecondsRef = useRef(0);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const voiceSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceWaveformDataRef = useRef<Uint8Array | null>(null);
  const voiceWaveformSnapshotRef = useRef<number[]>(DEFAULT_WAVEFORM);
  const voiceWaveformPayloadRef = useRef('');
  const mediaUploadAbortControllerRef = useRef<AbortController | null>(null);
  const attachmentPreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const localOutgoingRetryPayloadRef = useRef<Map<string, LocalOutgoingRetryPayload>>(new Map());
  const localOutgoingMediaPreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const autoSendVoiceRef = useRef(false);
  const autoLinkedLeadKeyRef = useRef<string | null>(null);
  const autoLinkSuppressedChatIdRef = useRef<string | null>(null);
  const restoringArchivedChatIdsRef = useRef<Set<string>>(new Set());
  const manualUnreadSkipReadChatIdRef = useRef<string | null>(null);
  const prefetchedLeadNameByPhoneRef = useRef<Map<string, string>>(new Map());
  const resolvedIdentityPhoneKeysRef = useRef<Set<string>>(new Set());
  const hydratedChatsRef = useRef<Set<string>>(new Set());
  const latestChatsRef = useRef<CommWhatsAppChat[]>([]);
  const latestMessagesRef = useRef<CommWhatsAppMessage[]>([]);
  const latestCrmStartResultsRef = useRef<CommWhatsAppLeadSearchResult[]>([]);
  const chatsSignatureRef = useRef('');
  const messagesSignatureRef = useRef('');
  const pendingScrollModeRef = useRef<ScrollMode>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const selectedChatIdRef = useRef<string | null>(null);
  const chatsRequestIdRef = useRef(0);
  const messagesRequestIdRef = useRef(0);
  const olderMessagesRequestIdRef = useRef(0);
  const operationalStateRequestIdRef = useRef(0);
  const autoLinkLookupRequestIdRef = useRef(0);
  const chatIdentityLookupRequestIdRef = useRef(0);
  const chatAgendaSummaryLeadIdRef = useRef<string | null>(null);
  const voiceAttachment = useMemo(
    () => pendingAttachments.find((attachment) => attachment.kind === 'voice') ?? null,
    [pendingAttachments],
  );
  const nonVoiceAttachments = useMemo(
    () => pendingAttachments.filter((attachment) => attachment.kind !== 'voice'),
    [pendingAttachments],
  );
  const messageDraft = selectedChatId ? composerDraftsByChatId[selectedChatId] ?? '' : '';
  const composerSelection = selectedChatId
    ? composerSelectionsByChatId[selectedChatId] ?? { start: messageDraft.length, end: messageDraft.length }
    : EMPTY_COMPOSER_SELECTION;
  const setMessageDraft = useCallback((value: string | ((current: string) => string)) => {
    if (!selectedChatId) {
      return;
    }

    setComposerDraftsByChatId((current) => {
      const currentValue = current[selectedChatId] ?? '';
      const nextValue = typeof value === 'function' ? value(currentValue) : value;
      const trimmedValue = nextValue;

      if (!trimmedValue) {
        if (!(selectedChatId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[selectedChatId];
        return next;
      }

      if (currentValue === trimmedValue) {
        return current;
      }

      return {
        ...current,
        [selectedChatId]: trimmedValue,
      };
    });
  }, [selectedChatId]);
  const setComposerSelection = useCallback((value: ComposerSelection | ((current: ComposerSelection) => ComposerSelection)) => {
    if (!selectedChatId) {
      return;
    }

    setComposerSelectionsByChatId((current) => {
      const currentValue = current[selectedChatId] ?? { start: messageDraft.length, end: messageDraft.length };
      const nextValue = typeof value === 'function' ? value(currentValue) : value;

      if (nextValue.start === 0 && nextValue.end === 0 && !(selectedChatId in current)) {
        return current;
      }

      if (nextValue.start === currentValue.start && nextValue.end === currentValue.end) {
        return current;
      }

      return {
        ...current,
        [selectedChatId]: nextValue,
      };
    });
  }, [messageDraft.length, selectedChatId]);
  const hasTypedMessage = messageDraft.trim().length > 0;
  const hasSendPayload = hasTypedMessage || pendingAttachments.length > 0;
  const pollingEnabled = isDocumentVisible && isWindowFocused;
  const isVoiceComposerMode = voiceRecordingState === 'recording' || voiceAttachment !== null;

  const buildChatsSignature = useCallback(
    (items: CommWhatsAppChat[]) =>
      items
        .map(
          (chat) =>
            `${chat.id}:${chat.updated_at}:${chat.unread_count}:${chat.last_message_at ?? ''}:${chat.last_message_text ?? ''}:${chat.display_name}:${chat.saved_contact_name ?? ''}:${chat.lead_id ?? ''}:${chat.is_archived}:${chat.archived_at ?? ''}:${chat.is_muted}:${chat.muted_at ?? ''}:${chat.is_pinned}:${chat.pinned_at ?? ''}:${chat.manual_unread}:${chat.manual_unread_at ?? ''}`,
        )
        .join('|'),
    [],
  );

  const buildMessagesSignature = useCallback(
    (items: CommWhatsAppMessage[]) =>
      items
        .map(
          (message) =>
            `${message.id}:${message.external_message_id ?? ''}:${message.delivery_status}:${message.message_at}:${message.text_content ?? ''}:${message.message_type}:${message.media_id ?? ''}:${message.media_url ?? ''}:${message.media_file_name ?? ''}:${message.media_caption ?? ''}:${message.transcription_text ?? ''}:${message.transcription_status ?? ''}:${message.transcription_error ?? ''}`,
        )
        .join('|'),
    [],
  );

  const getSelectedChatSnapshot = useCallback((chatId: string | null) => {
    if (!chatId) return null;
    return latestChatsRef.current.find((chat) => chat.id === chatId) ?? null;
  }, []);

  const isScrolledNearBottom = useCallback((element: HTMLDivElement) => {
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    return remaining <= SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchDraft.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchDraft]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );
  const activeChats = useMemo(() => chats.filter((chat) => !chat.is_archived), [chats]);
  const archivedChats = useMemo(() => chats.filter((chat) => chat.is_archived), [chats]);
  const sidebarChats = archivedSectionOpen ? archivedChats : activeChats;
  const selectedChatTranscriptLabel = useMemo(
    () => {
      if (!selectedChat) {
        return 'Contato';
      }

      if (selectedChat.lead_id) {
        return leadPanel?.nome_completo?.trim() || selectedChat.saved_contact_name?.trim() || selectedChat.display_name?.trim() || selectedChat.push_name?.trim() || selectedChat.phone_number?.trim() || 'Contato';
      }

      return selectedChat.saved_contact_name?.trim() || selectedChat.display_name?.trim() || selectedChat.push_name?.trim() || selectedChat.phone_number?.trim() || 'Contato';
    },
    [leadPanel?.nome_completo, selectedChat],
  );

  useEffect(() => {
    if (selectedChat?.is_archived) {
      setArchivedSectionOpen(true);
    }
  }, [selectedChat?.id, selectedChat?.is_archived]);

  const quickReplyLead = useMemo<Lead | null>(() => {
    if (!selectedChat) {
      return null;
    }

    const timestamp = new Date().toISOString();
    return {
      id: leadPanel?.id ?? selectedChat.lead_id ?? selectedChat.id,
      nome_completo: leadPanel?.nome_completo || selectedChat.saved_contact_name || selectedChat.display_name || '',
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
  }, [leadPanel, selectedChat]);
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
      const exists = current.some((chat) => chat.id === nextChat.id);
      const updated = exists
        ? current.map((chat) => (chat.id === nextChat.id ? { ...chat, ...nextChat } : chat))
        : [nextChat, ...current];

      return sortChatsByInboxOrder(updated);
    });
  }, []);

  const preserveSelectedChatInList = useCallback((items: CommWhatsAppChat[]) => {
    const selectedId = selectedChatIdRef.current;
    if (!selectedId) {
      return items;
    }

    const optimisticSelectedChat = latestChatsRef.current.find((chat) => chat.id === selectedId);
    if (!optimisticSelectedChat) {
      return items;
    }

    const existingIndex = items.findIndex((chat) => chat.id === selectedId);
    if (existingIndex >= 0) {
      const existingChat = items[existingIndex];
      if (!optimisticSelectedChat.is_archived || existingChat.is_archived) {
        return items;
      }

      const next = [...items];
      next[existingIndex] = {
        ...existingChat,
        is_archived: true,
        archived_at: optimisticSelectedChat.archived_at ?? existingChat.archived_at ?? new Date().toISOString(),
      };
      return next;
    }

    return sortChatsByInboxOrder([...items, optimisticSelectedChat]);
  }, []);

  const patchLocalOutgoingMessage = useCallback((messageId: string, patch: Partial<CommWhatsAppMessage>) => {
    setLocalOutgoingMessages((current) => current.map((message) => (
      message.id === messageId
        ? {
            ...message,
            ...patch,
            metadata: {
              ...message.metadata,
              ...(patch.metadata ?? {}),
            },
          }
        : message
    )));
  }, []);

  const removeLocalOutgoingMessage = useCallback((messageId: string) => {
    setLocalOutgoingMessages((current) => current.filter((message) => message.id !== messageId));
    localOutgoingRetryPayloadRef.current.delete(messageId);
    const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(messageId);
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    localOutgoingMediaPreviewUrlsRef.current.delete(messageId);
  }, []);

  const appendLocalOutgoingMessage = useCallback((message: CommWhatsAppMessage, retryPayload?: LocalOutgoingRetryPayload) => {
    setLocalOutgoingMessages((current) => mergeMessages(current, [message]));
    if (retryPayload) {
      localOutgoingRetryPayloadRef.current.set(message.id, retryPayload);
    }

    if (message.media_url?.startsWith('blob:')) {
      localOutgoingMediaPreviewUrlsRef.current.set(message.id, message.media_url);
    }
  }, []);

  const buildOptimisticOutgoingMessage = useCallback((params: {
    chat: CommWhatsAppChat;
    messageType: CommWhatsAppMediaSendKind | 'text' | 'document';
    textContent: string;
    mediaUrl?: string | null;
    mediaMimeType?: string | null;
    mediaFileName?: string | null;
    mediaSizeBytes?: number | null;
    mediaDurationSeconds?: number | null;
    mediaCaption?: string | null;
    metadata?: Record<string, unknown>;
  }): CommWhatsAppMessage => {
    const nowIso = new Date().toISOString();

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
        ...params.metadata,
      },
      created_at: nowIso,
    };
  }, []);

  const visibleMessages = useMemo(() => {
    if (!selectedChatId) {
      return messages;
    }

    const localForChat = localOutgoingMessages.filter((message) => message.chat_id === selectedChatId);
    if (localForChat.length === 0) {
      return messages;
    }

    const serverExternalIds = new Set(
      messages
        .map((message) => String(message.external_message_id ?? '').trim())
        .filter(Boolean),
    );
    const localVisible = localForChat.filter((message) => {
      const externalId = String(message.external_message_id ?? '').trim();
      return !externalId || !serverExternalIds.has(externalId);
    });

    return mergeMessages(messages, localVisible);
  }, [localOutgoingMessages, messages, selectedChatId]);

  const applyOptimisticChatSummary = useCallback((chat: CommWhatsAppChat, summaryText: string, messageAt: string) => {
    upsertChatLocally({
      ...chat,
      last_message_text: summaryText,
      last_message_direction: 'outbound',
      last_message_at: messageAt,
      updated_at: messageAt,
    });
  }, [upsertChatLocally]);

  const resetComposerAfterQueue = useCallback(() => {
    setMessageDraft('');
    if (selectedChatId) {
      setComposerSelectionsByChatId((current) => {
        if (!(selectedChatId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[selectedChatId];
        return next;
      });
    }
    setPendingAttachments([]);
    setMediaUploadProgress(null);
    voicePreviewAudioRef.current?.pause();
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.currentTime = 0;
    }
    setVoicePreviewPlaying(false);
    setVoicePreviewCurrentTime(0);
    setVoicePreviewDuration(null);
  }, [selectedChatId, setMessageDraft]);

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
  const openChatMenuChat = useMemo(() => {
    if (!openChatMenuChatId) {
      return null;
    }

    return chats.find((chat) => chat.id === openChatMenuChatId) ?? null;
  }, [chats, openChatMenuChatId]);

  const handleToggleChatMenu = useCallback((chatId: string) => {
    setOpenChatMenuChatId((current) => (current === chatId ? null : chatId));
  }, []);

  const applyPrefetchedLeadNames = useCallback((items: CommWhatsAppChat[]) => {
    return items.map((chat) => {
      if (chat.lead_id || chat.saved_contact_name?.trim()) {
        return chat;
      }

      const fallbackPhoneLabel = formatCommWhatsAppPhoneLabel(chat.phone_number);
      const currentLabel = chat.display_name?.trim() || '';
      const usingPhoneFallback = !currentLabel || currentLabel === fallbackPhoneLabel || currentLabel === chat.phone_number.trim();
      if (!usingPhoneFallback) {
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
        display_name: matchedLeadName,
      };
    });
  }, []);

  const patchMessageLocally = useCallback((messageId: string, patch: Partial<CommWhatsAppMessage>) => {
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, ...patch } : message)));
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
    if (!leadId) {
      setLeadContracts([]);
      setLeadContractsError(null);
      return;
    }

    setLeadContractsLoading(true);
    try {
      const contracts = await commWhatsAppService.listLeadContracts(leadId);
      setLeadContracts(contracts);
      setLeadContractsError(null);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar contratos do lead', error);
      setLeadContracts([]);
      setLeadContractsError(error instanceof Error ? error.message : 'Não foi possível carregar os contratos do lead.');
    } finally {
      setLeadContractsLoading(false);
    }
  }, []);

  const loadLeadPanel = useCallback(async (chat: CommWhatsAppChat | null) => {
    if (!chat?.lead_id) {
      setLeadPanel(null);
      setLeadPanelLoading(false);
      setLeadContracts([]);
      setLeadContractsError(null);
      return;
    }

    setLeadPanelLoading(true);
    try {
      const lead = await commWhatsAppService.getChatLeadPanel(chat.id);
      setLeadPanel(lead);
      if (lead?.nome_completo && !chat.saved_contact_name && chat.display_name !== lead.nome_completo) {
        upsertChatLocally({
          ...chat,
          display_name: lead.nome_completo,
        });
      }
      await loadLeadContracts(lead?.id ?? null);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar painel do lead', error);
      setLeadPanel(null);
      setLeadContracts([]);
      setLeadContractsError(null);
    } finally {
      setLeadPanelLoading(false);
    }
  }, [loadLeadContracts, upsertChatLocally]);

  const loadChatAgendaSummary = useCallback(async (leadId: string | null, contractIds: string[] = []) => {
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

      setChatAgendaSummary({
        pendingCount: pendingReminders.length,
        nextReminder: pendingReminders[0] ?? null,
      });
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar resumo da agenda do chat', error);
      setChatAgendaSummary({ pendingCount: 0, nextReminder: null });
    } finally {
      if (shouldShowLoading) {
        setChatAgendaSummaryLoading(false);
      }
    }
  }, []);

  const refreshDrawerSearch = useCallback(async (query: string, phoneNumber?: string | null) => {
    setLeadSearchLoading(true);
    try {
      const results = await commWhatsAppService.searchCrmLeads({
        query,
        phoneNumbers: phoneNumber ? [phoneNumber] : undefined,
        limit: 20,
      });
      setLeadSearchResults(results);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao buscar leads para o drawer', error);
      setLeadSearchResults([]);
    } finally {
      setLeadSearchLoading(false);
    }
  }, []);

  const refreshStartChatSources = useCallback(async (query: string, page: number = 1, appendSavedContacts: boolean = false) => {
    if (appendSavedContacts) {
      setSavedContactsLoadingMore(true);
    } else {
      setSavedContactsLoading(true);
      setCrmStartLoading(true);
    }

    try {
      const contactsPagePromise = commWhatsAppService.listSavedContacts({ query, page, pageSize: 50 });
      const leadsPromise = appendSavedContacts
        ? Promise.resolve(latestCrmStartResultsRef.current)
        : commWhatsAppService.searchCrmLeads({ query, limit: 20 });

      const [contactsPage, leads] = await Promise.all([contactsPagePromise, leadsPromise]);
      setSavedContacts((current) => (appendSavedContacts ? [...current, ...contactsPage.contacts] : contactsPage.contacts));
      setSavedContactsTotal(contactsPage.total);
      setSavedContactsHasMore(contactsPage.hasMore);
      setSavedContactsPage(page);
      setCrmStartResults(leads);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar fontes para novo chat', error);
      if (!appendSavedContacts) {
        setSavedContacts([]);
        setSavedContactsTotal(0);
        setSavedContactsHasMore(false);
        setCrmStartResults([]);
      }
    } finally {
      if (appendSavedContacts) {
        setSavedContactsLoadingMore(false);
      } else {
        setSavedContactsLoading(false);
        setCrmStartLoading(false);
      }
    }
  }, []);

  const channelState = operationalState?.channel ?? null;
  const connectionStatus = String(channelState?.connection_status ?? '').trim().toUpperCase();
  const suggestedLead = useMemo(() => {
    if (!leadDrawerOpen || selectedChat?.lead_id || leadSearchQuery.trim() !== '') {
      return null;
    }

    return leadSearchResults.length === 1 ? leadSearchResults[0] : null;
  }, [leadDrawerOpen, leadSearchQuery, leadSearchResults, selectedChat?.lead_id]);
  const selectedChatWasAutoLinked = Boolean(selectedChat?.id && autoLinkedChatIds[selectedChat.id]);
  const selectedChatDisplayName = useMemo(
    () => getSafeChatDisplayName(selectedChat, channelState?.connected_user_name ?? null),
    [channelState?.connected_user_name, selectedChat],
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
      return `Canal WhatsApp ${formatConnectionStatusLabel(connectionStatus).toLowerCase()}.`;
    }

    return null;
  }, [connectionStatus, isChannelConnected, operationalState, operationalStateError, operationalStateLoaded]);
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

    if (sending) {
      return 'Aguarde o envio atual terminar para reescrever a mensagem.';
    }

    if (voiceRecordingState !== 'idle') {
      return 'Finalize a gravacao de audio antes de reescrever a mensagem.';
    }

    if (rewritingComposer) {
      return 'Reescrevendo mensagem com IA...';
    }

    return null;
  }, [messageDraft, rewritingComposer, selectedChat, sending, voiceRecordingState]);
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
        title: `WhatsApp ${formatConnectionStatusLabel(connectionStatus)}`,
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
  }, [channelState, connectionStatus, hasWebhookEver, isChannelConnected, isWebhookStale, operationalState, operationalStateError, operationalStateLoaded]);
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
    if (!openChatMenuChatId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const clickedInsideMenu = chatMenuRef.current && target && chatMenuRef.current.contains(target);
      const clickedCurrentTrigger = chatMenuTriggerRefs.current[openChatMenuChatId]?.contains(target) ?? false;

      if (!clickedInsideMenu && !clickedCurrentTrigger) {
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
    if (openChatMenuChatId && !openChatMenuChat) {
      setOpenChatMenuChatId(null);
    }
  }, [openChatMenuChat, openChatMenuChatId]);

  useLayoutEffect(() => {
    if (!openReactionPickerMessageId || typeof window === 'undefined') {
      setReactionPickerPosition(null);
      return;
    }

    const syncPosition = () => {
      const anchor = reactionAnchorRefs.current[openReactionPickerMessageId];
      if (!anchor) {
        setReactionPickerPosition(null);
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
  }, [openReactionPickerMessageId, visibleMessages]);

  useLayoutEffect(() => {
    if (!openChatMenuChatId || typeof window === 'undefined') {
      setChatMenuPosition(null);
      return;
    }

    const syncPosition = () => {
      const trigger = chatMenuTriggerRefs.current[openChatMenuChatId];
      if (!trigger) {
        setChatMenuPosition(null);
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const menuWidth = 248;
      const menuHeight = 232;
      const viewportPadding = 12;
      const gap = 6;
      const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const availableAbove = triggerRect.top - viewportPadding;
      const openUpward = availableBelow < Math.min(menuHeight, 180) && availableAbove > availableBelow;
      const maxHeight = Math.max(160, Math.min(menuHeight, (openUpward ? availableAbove : availableBelow) - gap));
      const left = Math.max(
        viewportPadding,
        Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding),
      );
      const top = openUpward
        ? Math.max(viewportPadding, triggerRect.top - maxHeight - gap)
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
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [openChatMenuChatId]);

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

      setAdvancedFiltersPosition({
        top: triggerRect.bottom + 8,
        left: nextLeft,
      });
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

      setMediaDrawerPosition({
        top,
        left,
        width: panelWidth,
        maxHeight: panelHeight,
      });
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
  }, [voiceAttachment]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  const loadOperationalState = useCallback(async () => {
    const requestId = ++operationalStateRequestIdRef.current;

    try {
      const state = await commWhatsAppService.getOperationalState();
      if (requestId !== operationalStateRequestIdRef.current) {
        return;
      }

      setOperationalState(state);
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
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(!document.hidden);
      if (!document.hidden) {
        setIsWindowFocused(document.hasFocus());
      }
    };

    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const loadChats = useCallback(async () => {
    const requestId = ++chatsRequestIdRef.current;

    try {
      const data = await commWhatsAppService.listChats({
        search,
        activityFilter: chatActivityFilter,
        leadStatusFilters,
        archivedFilter: 'all',
        limit: 200,
      });

      if (requestId !== chatsRequestIdRef.current) {
        return;
      }

      let hydratedData = preserveSelectedChatInList(applyPrefetchedLeadNames(data));

      const selectedId = selectedChatIdRef.current;
      const optimisticSelectedChat = selectedId
        ? latestChatsRef.current.find((chat) => chat.id === selectedId) ?? null
        : null;
      const fetchedSelectedChat = selectedId
        ? hydratedData.find((chat) => chat.id === selectedId) ?? null
        : null;

      if (selectedId && optimisticSelectedChat?.is_archived && fetchedSelectedChat && !fetchedSelectedChat.is_archived) {
        hydratedData = hydratedData.map((chat) => chat.id === selectedId
          ? {
              ...chat,
              is_archived: true,
              archived_at: optimisticSelectedChat.archived_at ?? chat.archived_at ?? new Date().toISOString(),
            }
          : chat);

        if (!restoringArchivedChatIdsRef.current.has(selectedId)) {
          restoringArchivedChatIdsRef.current.add(selectedId);
          void commWhatsAppService.updateChatInboxState(selectedId, { isArchived: true }).catch((error) => {
            console.error('[WhatsAppInbox] erro ao preservar chat arquivado selecionado', error);
          }).finally(() => {
            restoringArchivedChatIdsRef.current.delete(selectedId);
          });
        }
      }

      const nextSignature = buildChatsSignature(hydratedData);

      if (nextSignature !== chatsSignatureRef.current) {
        chatsSignatureRef.current = nextSignature;
        setChats(hydratedData);
      }

      setSelectedChatId((current) => {
        if (current && hydratedData.some((chat) => chat.id === current)) {
          return current;
        }

        return hydratedData.find((chat) => !chat.is_archived)?.id ?? hydratedData[0]?.id ?? null;
      });
    } catch (error) {
      if (requestId !== chatsRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar chats', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as conversas do WhatsApp.');
    }
  }, [applyPrefetchedLeadNames, buildChatsSignature, chatActivityFilter, leadStatusFilters, preserveSelectedChatInList, search]);

  const loadMessages = useCallback(async (chat: CommWhatsAppChat | null, reason: MessageLoadReason = 'poll') => {
    if (!chat) {
      setMessages([]);
      return;
    }

    const targetChatId = chat.id;
    const requestId = ++messagesRequestIdRef.current;

    const shouldShowBlockingLoader = reason === 'initial' && messagesSignatureRef.current === '';

    if (shouldShowBlockingLoader) {
      setLoadingMessages(true);
    }

    try {
      let page = await commWhatsAppService.listMessagesPage(chat.id, {
        limit: MESSAGE_PAGE_SIZE,
      });

      let data = page.messages;
      let hasMore = page.hasMore;

      if (data.length === 0 && !hydratedChatsRef.current.has(chat.external_chat_id)) {
        hydratedChatsRef.current.add(chat.external_chat_id);
        await commWhatsAppService.syncChatHistory(chat.external_chat_id);
        page = await commWhatsAppService.listMessagesPage(chat.id, {
          limit: MESSAGE_PAGE_SIZE,
        });
        data = page.messages;
        hasMore = page.hasMore;
        await loadChats();
      }

      if (requestId !== messagesRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }

      const nextMessages = reason === 'initial' ? data : mergeMessages(latestMessagesRef.current, data);
      const nextSignature = buildMessagesSignature(nextMessages);
      setLocalOutgoingMessages((current) => {
        const nextLocalMessages: CommWhatsAppMessage[] = [];

        for (const message of current) {
          if (message.chat_id !== targetChatId) {
            nextLocalMessages.push(message);
            continue;
          }

          const externalId = String(message.external_message_id ?? '').trim();
          const alreadySynced = externalId && nextMessages.some((serverMessage) => String(serverMessage.external_message_id ?? '').trim() === externalId);

          if (alreadySynced) {
            localOutgoingRetryPayloadRef.current.delete(message.id);
            const previewUrl = localOutgoingMediaPreviewUrlsRef.current.get(message.id);
            if (previewUrl?.startsWith('blob:')) {
              URL.revokeObjectURL(previewUrl);
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
    }
  }, [buildMessagesSignature, loadChats]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      await Promise.all([loadChats(), loadOperationalState()]);
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
    if (!selectedChatId) {
      setMessages([]);
      setLoadingMessages(false);
      setLoadingOlderMessages(false);
      setHasOlderMessages(false);
      setPendingAttachments([]);
      cancelVoiceRecordingRef.current();
      messagesSignatureRef.current = '';
      return;
    }

    messagesSignatureRef.current = '';
    pendingScrollModeRef.current = 'bottom';
    pendingScrollTopRef.current = null;
    pendingScrollHeightRef.current = null;
    isNearBottomRef.current = true;
    setPendingAttachments([]);
    cancelVoiceRecordingRef.current();
    setLoadingOlderMessages(false);
    setHasOlderMessages(false);
    setMessages([]);

    void loadMessages(getSelectedChatSnapshot(selectedChatId), 'initial');
  }, [getSelectedChatSnapshot, loadMessages, selectedChatId]);

  useEffect(
    () => () => {
      mediaUploadAbortControllerRef.current?.abort();
      cancelVoiceRecordingRef.current();
    },
    [],
  );

  useEffect(() => {
    if (!lightboxMedia) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxMedia(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxMedia]);

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadChats();
    }, CHAT_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
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
    if (!pollingEnabled || !selectedChat || loadingOlderMessages) return;

    const intervalId = window.setInterval(() => {
      void loadMessages(getSelectedChatSnapshot(selectedChat.id), 'poll');
    }, MESSAGE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [getSelectedChatSnapshot, loadMessages, loadingOlderMessages, pollingEnabled, selectedChat]);

  useEffect(() => {
    if (!pollingEnabled || loading) {
      return;
    }

    void loadChats();
    void loadOperationalState();

    if (selectedChatIdRef.current && !loadingOlderMessages) {
      void loadMessages(getSelectedChatSnapshot(selectedChatIdRef.current), 'poll');
    }
  }, [getSelectedChatSnapshot, loadChats, loadMessages, loadOperationalState, loading, loadingOlderMessages, pollingEnabled]);

  useEffect(() => {
    if (!selectedChat) {
      return;
    }

    const skipManualUnreadRead = manualUnreadSkipReadChatIdRef.current === selectedChat.id
      && selectedChat.manual_unread
      && selectedChat.unread_count <= 0;

    if (skipManualUnreadRead) {
      return;
    }

    if (selectedChat.unread_count <= 0 && !selectedChat.manual_unread) {
      return;
    }

    setChats((current) =>
      current.map((chat) => (chat.id === selectedChat.id
        ? {
            ...chat,
            unread_count: 0,
            manual_unread: false,
            manual_unread_at: null,
            last_read_at: new Date().toISOString(),
          }
        : chat)),
    );

    if (manualUnreadSkipReadChatIdRef.current === selectedChat.id) {
      manualUnreadSkipReadChatIdRef.current = null;
    }

    void commWhatsAppService.markChatRead(selectedChat.id).catch((error) => {
      console.error('[WhatsAppInbox] erro ao marcar chat como lido', error);
    });
  }, [selectedChat]);

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
  }, [messages, selectedChatId]);

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
  }, [isScrolledNearBottom]);

  const clearVoiceTimer = useCallback(() => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }, []);

  const clearVoiceWaveformTimer = useCallback(() => {
    if (voiceWaveformTimerRef.current !== null) {
      window.clearInterval(voiceWaveformTimerRef.current);
      voiceWaveformTimerRef.current = null;
    }
  }, []);

  const teardownVoiceAnalyser = useCallback(() => {
    clearVoiceWaveformTimer();

    voiceSourceNodeRef.current?.disconnect();
    voiceSourceNodeRef.current = null;
    voiceAnalyserRef.current?.disconnect();
    voiceAnalyserRef.current = null;
    voiceWaveformDataRef.current = null;

    if (voiceAudioContextRef.current) {
      void voiceAudioContextRef.current.close().catch(() => undefined);
      voiceAudioContextRef.current = null;
    }
  }, [clearVoiceWaveformTimer]);

  const stopVoiceStream = useCallback(() => {
    if (voiceStreamRef.current) {
      for (const track of voiceStreamRef.current.getTracks()) {
        track.stop();
      }
      voiceStreamRef.current = null;
    }
    teardownVoiceAnalyser();
  }, [teardownVoiceAnalyser]);

  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';

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
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    setIsComposerExpanded(expanded);
  }, [messageDraft, pendingAttachments.length, voiceAttachment?.id, selectedChatId]);

  const handleAttachmentMenuAction = (action: AttachmentMenuAction) => {
    if (voiceRecordingState !== 'idle' || sending) {
      return;
    }

    if (action === 'contact') {
      setAttachmentMenuOpen(false);
      return;
    }

    if (action === 'document') {
      setAttachmentInputAccept('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv');
    } else if (action === 'audio') {
      setAttachmentInputAccept('audio/*');
    } else {
      setAttachmentInputAccept('image/*,video/*');
    }

    setAttachmentMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleAttachmentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (voiceRecordingState !== 'idle' || sending) {
      event.target.value = '';
      return;
    }

    const nextFiles = Array.from(event.target.files ?? []);
    if (nextFiles.length === 0) {
      event.target.value = '';
      return;
    }

    const nextAttachments = nextFiles.map((file) => {
      const kind = inferAttachmentKind(file);
      return {
        id: createPendingAttachmentId(),
        file,
        kind,
        previewUrl: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null,
      } satisfies PendingAttachment;
    });

    setPendingAttachments((current) => {
      const preserved = current.filter((attachment) => attachment.kind !== 'voice');
      return [...preserved, ...nextAttachments];
    });

    event.target.value = '';
  };

  const handleClearAttachment = (attachmentId?: string) => {
    voicePreviewAudioRef.current?.pause();
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.currentTime = 0;
    }
    setVoicePreviewPlaying(false);
    setVoicePreviewCurrentTime(0);
    setVoicePreviewDuration(null);
    setPendingAttachments((current) => {
      if (!attachmentId) {
        return [];
      }

      return current.filter((attachment) => attachment.id !== attachmentId);
    });
    setMediaUploadProgress(null);
  };

  const finalizeVoiceRecording = useCallback(() => {
    const chunks = [...voiceChunksRef.current];
    voiceChunksRef.current = [];

    if (discardVoiceRecordingRef.current) {
      discardVoiceRecordingRef.current = false;
      setPendingAttachments([]);
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      voiceWaveformPayloadRef.current = '';
      return;
    }

    if (chunks.length === 0) {
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      voiceWaveformPayloadRef.current = '';
      return;
    }

    const mimeType = voiceMimeTypeRef.current || 'audio/webm';
    const blob = new Blob(chunks, { type: mimeType });
    const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `nota-voz-${Date.now()}.${extension}`, { type: mimeType });
    const durationSeconds = voiceRecordingSecondsRef.current;
    const previewUrl = URL.createObjectURL(blob);

    setPendingAttachments([{
      id: createPendingAttachmentId(),
      file,
      kind: 'voice',
      durationSeconds,
      previewUrl,
      waveform: voiceWaveformSnapshotRef.current,
      waveformPayload: voiceWaveformPayloadRef.current || null,
    }]);
    setVoiceRecordingSeconds(0);
    voiceRecordingSecondsRef.current = 0;
    setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
    voiceWaveformPayloadRef.current = '';
  }, []);

  const handleStopVoiceRecording = useCallback((autoSend: boolean = false) => {
    if (voiceRecordingState !== 'recording') {
      return;
    }

    autoSendVoiceRef.current = autoSend;
    setVoiceRecordingState('idle');
    clearVoiceTimer();
    voiceRecorderRef.current?.stop();
  }, [clearVoiceTimer, voiceRecordingState]);

  const handleCancelVoiceRecording = useCallback(() => {
    if (voiceRecordingState === 'idle' && !voiceRecorderRef.current) {
      return;
    }

    discardVoiceRecordingRef.current = true;
    autoSendVoiceRef.current = false;
    setVoiceRecordingState('idle');
    setVoiceRecordingSeconds(0);
    voiceRecordingSecondsRef.current = 0;
    setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
    voiceWaveformPayloadRef.current = '';
    clearVoiceTimer();

    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.stop();
    } else {
      voiceChunksRef.current = [];
      stopVoiceStream();
    }
  }, [clearVoiceTimer, stopVoiceStream, voiceRecordingState]);

  const handleStartVoiceRecording = useCallback(async () => {
    if (voiceRecordingState !== 'idle') {
      return;
    }

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Seu navegador não suporta gravação de áudio neste inbox.');
      return;
    }

    try {
      setVoiceRecordingState('requesting');
      setPendingAttachments([]);
      setVoicePreviewPlaying(false);
      setVoicePreviewCurrentTime(0);
      setVoicePreviewDuration(null);
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
      setMediaUploadProgress(null);
      discardVoiceRecordingRef.current = false;
      voiceWaveformPayloadRef.current = '';

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (discardVoiceRecordingRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setVoiceRecordingState('idle');
        return;
      }

      const supportedMimeType = getSupportedVoiceMimeType();
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);

        voiceAudioContextRef.current = audioContext;
        voiceAnalyserRef.current = analyser;
        voiceSourceNodeRef.current = sourceNode;
        voiceWaveformDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
        voiceWaveformSnapshotRef.current = DEFAULT_WAVEFORM;

        voiceWaveformTimerRef.current = window.setInterval(() => {
          if (!voiceAnalyserRef.current || !voiceWaveformDataRef.current) {
            return;
          }

          voiceAnalyserRef.current.getByteTimeDomainData(voiceWaveformDataRef.current);
          const nextBars = buildWaveformBars(voiceWaveformDataRef.current);
          const nextWaveformPayload = buildVoiceWaveformPayload(voiceWaveformDataRef.current);
          voiceWaveformSnapshotRef.current = nextBars;
          voiceWaveformPayloadRef.current = nextWaveformPayload;
          setVoiceRecordingWaveform(nextBars);
        }, 120);
      }

      voiceMimeTypeRef.current = supportedMimeType || recorder.mimeType || 'audio/webm';
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopVoiceStream();
        voiceRecorderRef.current = null;
        clearVoiceTimer();
        finalizeVoiceRecording();
      };

      recorder.onerror = () => {
        stopVoiceStream();
        voiceRecorderRef.current = null;
        clearVoiceTimer();
        setVoiceRecordingState('idle');
        setVoiceRecordingSeconds(0);
        discardVoiceRecordingRef.current = true;
        voiceChunksRef.current = [];
        toast.error('Não foi possível continuar a gravação de áudio.');
      };

      recorder.start(250);
      setVoiceRecordingState('recording');
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceRecordingSeconds((current) => {
          const next = current + 1;
          voiceRecordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch (error) {
      stopVoiceStream();
      voiceRecorderRef.current = null;
      clearVoiceTimer();
      setVoiceRecordingState('idle');
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
      voiceWaveformPayloadRef.current = '';

      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Permita o microfone no navegador para gravar nota de voz.'
          : 'Não foi possível iniciar a gravação de áudio.';
      toast.error(message);
    }
  }, [clearVoiceTimer, finalizeVoiceRecording, sendDisabledReason, stopVoiceStream, voiceRecordingState]);

  cancelVoiceRecordingRef.current = handleCancelVoiceRecording;

  const handleToggleVoicePreviewPlayback = useCallback(() => {
    const audio = voicePreviewAudioRef.current;
    if (!audio || !voiceAttachment) {
      return;
    }

    if (voicePreviewPlaying) {
      audio.pause();
      setVoicePreviewPlaying(false);
      return;
    }

    void audio.play().then(() => {
      setVoicePreviewPlaying(true);
    }).catch(() => {
      toast.error('Não foi possível reproduzir a nota de voz agora.');
    });
  }, [voiceAttachment, voicePreviewPlaying]);

  const handleSendCurrentVoiceRecording = () => {
    if (voiceRecordingState === 'recording') {
      handleStopVoiceRecording(true);
      return;
    }

    if (voiceAttachment) {
      void handleSendMessage();
    }
  };

  const sendTextSegments = useCallback(async (chat: CommWhatsAppChat, textSegments: string[]) => {
    if (textSegments.length === 0) {
      return;
    }

    let hadSuccessfulSend = false;

    for (const segment of textSegments) {
      const optimisticMessage = buildOptimisticOutgoingMessage({
        chat,
        messageType: 'text',
        textContent: segment,
      });

      appendLocalOutgoingMessage(optimisticMessage, {
        kind: 'text',
        text: segment,
      });
      applyOptimisticChatSummary(chat, segment, optimisticMessage.message_at);

      try {
        const sendResult = await commWhatsAppService.sendTextMessage(chat.external_chat_id, segment);
        hadSuccessfulSend = true;
        patchLocalOutgoingMessage(optimisticMessage.id, {
          external_message_id: sendResult.messageId,
          delivery_status: sendResult.status,
          status_updated_at: new Date().toISOString(),
          error_message: null,
        });
        localOutgoingRetryPayloadRef.current.delete(optimisticMessage.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
        patchLocalOutgoingMessage(optimisticMessage.id, {
          delivery_status: 'failed',
          status_updated_at: new Date().toISOString(),
          error_message: message,
        });
      }
    }

    if (hadSuccessfulSend) {
      hydratedChatsRef.current.add(chat.external_chat_id);
      await Promise.all([loadMessages(chat, 'send'), loadChats()]);
    }
  }, [appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, loadChats, loadMessages, patchLocalOutgoingMessage]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedChat) return;

    const text = messageDraft.trim();
    const textSegments = splitWhatsAppMessageSegments(messageDraft);
    const attachmentsSnapshot = [...pendingAttachments];
    if (!text && attachmentsSnapshot.length === 0) return;

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    const shouldLockComposer = attachmentsSnapshot.length > 0;
    if (shouldLockComposer) {
      setSending(true);
    }

    resetComposerAfterQueue();

    try {
      if (attachmentsSnapshot.length > 0) {
        const attachmentsToSend = attachmentsSnapshot.map((attachment, index) => {
          const caption = index === 0 && attachment.kind !== 'voice' ? text || undefined : undefined;
          const localPreviewUrl = attachment.previewUrl?.startsWith('blob:') ? URL.createObjectURL(attachment.file) : attachment.previewUrl ?? null;
          const optimisticMessage = buildOptimisticOutgoingMessage({
            chat: selectedChat,
            messageType: attachment.kind,
            textContent: buildMediaSummaryText(attachment.kind, caption),
            mediaUrl: localPreviewUrl,
            mediaMimeType: attachment.file.type || null,
            mediaFileName: attachment.file.name,
            mediaSizeBytes: attachment.file.size,
            mediaDurationSeconds: attachment.durationSeconds ?? null,
            mediaCaption: attachment.kind === 'voice' ? null : caption ?? null,
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
          });
          applyOptimisticChatSummary(selectedChat, optimisticMessage.text_content ?? '', optimisticMessage.message_at);

          return { attachment, caption, optimisticMessage };
        });

        let shouldStopQueue = false;
        let hadSuccessfulSend = false;
        let firstErrorMessage = '';

        for (let index = 0; index < attachmentsToSend.length; index += 1) {
          const queued = attachmentsToSend[index];

          if (shouldStopQueue) {
            patchLocalOutgoingMessage(queued.optimisticMessage.id, {
              delivery_status: 'failed',
              status_updated_at: new Date().toISOString(),
              error_message: 'Envio interrompido antes deste item. Toque em reenviar para tentar novamente.',
            });
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
              onUploadProgress: (progress) => {
                setMediaUploadProgress((current) => current && current.currentIndex === index + 1
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
            localOutgoingRetryPayloadRef.current.delete(queued.optimisticMessage.id);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Não foi possível enviar a mídia.';
            firstErrorMessage = firstErrorMessage || message;
            patchLocalOutgoingMessage(queued.optimisticMessage.id, {
              delivery_status: 'failed',
              status_updated_at: new Date().toISOString(),
              error_message: message,
            });
            shouldStopQueue = true;
          }
        }

        if (hadSuccessfulSend) {
          await commWhatsAppService.syncChatHistory(selectedChat.external_chat_id).catch(() => undefined);
          hydratedChatsRef.current.add(selectedChat.external_chat_id);
          await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
        }

        if (firstErrorMessage) {
          if (firstErrorMessage === 'Envio de mídia cancelado.') {
            toast.info('Upload interrompido. As mensagens que falharam permaneceram no chat para reenvio.');
          } else {
            toast.error(firstErrorMessage);
          }
        }
      } else {
        await sendTextSegments(selectedChat, textSegments);
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar mensagem', error);
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
      toast.error(message);
    } finally {
      if (shouldLockComposer) {
        setSending(false);
      }
      setMediaUploadProgress(null);
      mediaUploadAbortControllerRef.current = null;
    }
  }, [appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, messageDraft, patchLocalOutgoingMessage, pendingAttachments, resetComposerAfterQueue, selectedChat, sendDisabledReason, sendTextSegments]);

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
  }, [handleSendMessage, voiceAttachment]);

  const handleCancelMediaUpload = () => {
    mediaUploadAbortControllerRef.current?.abort();
  };

  const handleRetryMediaMessage = async (message: CommWhatsAppMessage) => {
    setRetryingMessageId(message.id);

    try {
      const localRetryPayload = localOutgoingRetryPayloadRef.current.get(message.id);

      if (localRetryPayload) {
        patchLocalOutgoingMessage(message.id, {
          delivery_status: 'pending',
          status_updated_at: new Date().toISOString(),
          error_message: null,
        });

        if (localRetryPayload.kind === 'text') {
          const sendResult = await commWhatsAppService.sendTextMessage(selectedChat?.external_chat_id || '', localRetryPayload.text);
          patchLocalOutgoingMessage(message.id, {
            external_message_id: sendResult.messageId,
            delivery_status: sendResult.status,
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });
        } else if (localRetryPayload.kind === 'media') {
          const sendResult = await commWhatsAppService.sendMediaMessage({
            chatId: selectedChat?.external_chat_id || '',
            kind: localRetryPayload.mediaKind,
            file: localRetryPayload.file,
            caption: localRetryPayload.caption,
            durationSeconds: localRetryPayload.durationSeconds,
            waveform: localRetryPayload.waveform,
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
        } else {
          const sendResult = await commWhatsAppService.sendRemoteMediaMessage({
            chatId: selectedChat?.external_chat_id || '',
            kind: localRetryPayload.mediaKind,
            remoteUrl: localRetryPayload.remoteUrl,
            fileName: localRetryPayload.fileName,
            mimeType: localRetryPayload.mimeType,
            caption: localRetryPayload.caption,
          });
          patchLocalOutgoingMessage(message.id, {
            external_message_id: sendResult.messageId,
            delivery_status: sendResult.status,
            status_updated_at: new Date().toISOString(),
            error_message: null,
          });
        }

        localOutgoingRetryPayloadRef.current.delete(message.id);
        if (selectedChat) {
          hydratedChatsRef.current.add(selectedChat.external_chat_id);
          await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
        }
        return;
      }

      if (!message.media_id) {
        removeLocalOutgoingMessage(message.id);
        toast.error('Não foi possível reenviar esta mensagem local.');
        return;
      }

      await commWhatsAppService.retryMediaMessage(message.id);
      if (selectedChat) {
        await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao reenviar mídia', error);
      const messageText = error instanceof Error ? error.message : 'Não foi possível reenviar a mensagem.';
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
      setRetryingMessageId(null);
    }
  };

  const handleToggleReactionPicker = useCallback((messageId: string) => {
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
    const unresolvedChats = chats.filter((chat) => {
      if (chat.lead_id || chat.saved_contact_name?.trim()) {
        return false;
      }

      const fallbackPhoneLabel = formatCommWhatsAppPhoneLabel(chat.phone_number);
      const currentLabel = chat.display_name?.trim() || '';
      const usingPhoneFallback = !currentLabel || currentLabel === fallbackPhoneLabel || currentLabel === chat.phone_number.trim();
      if (!usingPhoneFallback) {
        return false;
      }

      const lookupKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
      if (lookupKeys.length === 0) {
        return false;
      }

      return !lookupKeys.every((key) => resolvedIdentityPhoneKeysRef.current.has(key));
    });

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

          const results = await commWhatsAppService.searchCrmLeads({
            phoneNumbers: batchPhoneNumbers,
            limit: 50,
          });

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
          for (const chat of batch) {
            const lookupKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
            const matchedLeadMap = new Map<string, CommWhatsAppLeadSearchResult>();
            for (const key of lookupKeys) {
              for (const lead of leadsByKey.get(key) ?? []) {
                matchedLeadMap.set(lead.id, lead);
              }
            }

            lookupKeys.forEach((key) => resolvedIdentityPhoneKeysRef.current.add(key));

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
            setChats((current) => applyPrefetchedLeadNames(current));
          }
        }
      } catch (error) {
        console.error('[WhatsAppInbox] erro ao pré-carregar nomes do CRM para chats', error);
      }
    })();
  }, [applyPrefetchedLeadNames, chats]);

  const handleStartChatFromSavedContact = async (contact: CommWhatsAppPhoneContact) => {
    setStartingChatKey(`saved:${contact.phone_digits}`);
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
      setStartingChatKey(null);
    }
  };

  const handleStartChatFromLead = async (lead: CommWhatsAppLeadSearchResult) => {
    setStartingChatKey(`crm:${lead.id}`);
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
      setStartingChatKey(null);
    }
  };

  const handleOpenAgendaLeadChat = useCallback(async (lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone'>) => {
    const phoneKeys = collectPhoneLookupKeys(lead.telefone);
    const existingChat = latestChatsRef.current.find((chat) => {
      if (lead.id && chat.lead_id === lead.id) {
        return true;
      }

      if (phoneKeys.length === 0) {
        return false;
      }

      const chatPhoneKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
      return chatPhoneKeys.some((key) => phoneKeys.includes(key));
    }) ?? null;

    if (existingChat) {
      setSelectedChatId(existingChat.id);
      return;
    }

    if (!lead.id && !lead.telefone?.trim()) {
      toast.error('Nao foi possivel abrir uma conversa para este lead.');
      return;
    }

    const openingKey = `agenda:${lead.id || lead.telefone || 'lead'}`;
    setStartingChatKey(openingKey);

    try {
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
  }, [upsertChatLocally]);

  const handleStartChatFromManual = async () => {
    setStartingChatKey('manual');
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
      setStartingChatKey(null);
    }
  };

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
  }, []);

  const handleComposerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageDraft(event.target.value);
    syncComposerSelection(event.target);
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
  }, [activeQuickReplyMatch, composerSelection, messageDraft]);

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
  }, [composerSelection, messageDraft]);

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
    setFollowUpDraft('');
    setFollowUpCustomInstructions('');
  }, []);

  const handleCloseComposerRewriteModal = useCallback(() => {
    setComposerRewriteModalOpen(false);
    setComposerRewriteSource('');
    setComposerRewriteDraft('');
    setComposerRewriteCustomInstructions('');
    setComposerRewriteTone('grammar');
  }, []);

  const rewriteComposerText = useCallback(async (
    sourceText: string,
    tone: CommWhatsAppRewriteTone,
    customInstructions: string,
  ) => {
    if (!sourceText.trim()) {
      toast.error('Digite uma mensagem para reescrever com IA.');
      return;
    }

    setRewritingComposer(true);

    try {
      const result = await commWhatsAppService.rewriteMessage({
        message: sourceText,
        tone,
        customInstructions,
      });
      setComposerRewriteDraft(result.text.trim());
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao reescrever mensagem do composer', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel reescrever a mensagem com IA.');
    } finally {
      setRewritingComposer(false);
    }
  }, []);

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
    void rewriteComposerText(sourceText, 'grammar', '');
  }, [composerRewriteDisabledReason, messageDraft, rewriteComposerText]);

  const handleRegenerateComposerRewrite = useCallback(() => {
    void rewriteComposerText(composerRewriteSource, composerRewriteTone, composerRewriteCustomInstructions);
  }, [composerRewriteCustomInstructions, composerRewriteSource, composerRewriteTone, rewriteComposerText]);

  const handleApplyComposerRewrite = useCallback(() => {
    if (!composerRewriteDraft.trim()) {
      return;
    }

    const nextValue = composerRewriteDraft;
    const nextCursor = nextValue.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);
    handleCloseComposerRewriteModal();

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [composerRewriteDraft, handleCloseComposerRewriteModal]);

  const handleGenerateFollowUp = useCallback(async (customInstructions: string) => {
    if (!selectedChat) {
      return;
    }

    if (followUpGenerationDisabledReason) {
      return;
    }

    setGeneratingFollowUp(true);

    try {
      const result = await commWhatsAppService.generateFollowUp(selectedChat.id, {
        customInstructions,
      });
      setFollowUpDraft(result.text.trim());
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao gerar follow-up', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o follow-up com IA.');
    } finally {
      setGeneratingFollowUp(false);
    }
  }, [followUpGenerationDisabledReason, selectedChat]);

  const handleOpenFollowUpModal = useCallback(() => {
    if (followUpGenerationDisabledReason) {
      toast.error(followUpGenerationDisabledReason);
      return;
    }

    setFollowUpCustomInstructions('');
    setFollowUpDraft('');
    setFollowUpModalOpen(true);
    void handleGenerateFollowUp('');
  }, [followUpGenerationDisabledReason, handleGenerateFollowUp]);

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
      hydratedChatsRef.current.add(targetChat.external_chat_id);
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

    if (options.markAsUnread === true && selectedChatIdRef.current === chat.id) {
      manualUnreadSkipReadChatIdRef.current = chat.id;
    }

    try {
      const updatedChat = await commWhatsAppService.updateChatInboxState(chat.id, options);
      upsertChatLocally(updatedChat);

      if (selectedChatIdRef.current === updatedChat.id) {
        setSelectedChatId(updatedChat.id);
      }

      if (typeof options.isArchived === 'boolean') {
        toast.success(options.isArchived ? 'Conversa arquivada.' : 'Conversa removida dos arquivados.');
      } else if (typeof options.isMuted === 'boolean') {
        toast.success(options.isMuted ? 'Conversa silenciada.' : 'Conversa com notificacao restaurada.');
      } else if (typeof options.isPinned === 'boolean') {
        toast.success(options.isPinned ? 'Conversa fixada.' : 'Conversa desafixada.');
      } else if (typeof options.markAsUnread === 'boolean') {
        toast.success(options.markAsUnread ? 'Conversa marcada como nao lida.' : 'Conversa marcada como lida.');
      }
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao atualizar estado do chat', error);
      if (options.markAsUnread === true && manualUnreadSkipReadChatIdRef.current === chat.id) {
        manualUnreadSkipReadChatIdRef.current = null;
      }
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar esta conversa.');
    } finally {
      setUpdatingChatStateId((current) => (current === chat.id ? null : current));
    }
  }, [upsertChatLocally]);

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

    const optimisticMessage = buildOptimisticOutgoingMessage({
      chat: selectedChat,
      messageType: item.sendKind,
      textContent: buildMediaSummaryText(item.sendKind),
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
    });
    applyOptimisticChatSummary(selectedChat, optimisticMessage.text_content ?? '', optimisticMessage.message_at);

    setSendingDrawerMedia(true);

    try {
      const sendResult = await commWhatsAppService.sendRemoteMediaMessage({
        chatId: selectedChat.external_chat_id,
        kind: item.sendKind,
        remoteUrl: item.sendUrl,
        fileName: item.title,
        mimeType: item.mimeType,
      });

      patchLocalOutgoingMessage(optimisticMessage.id, {
        external_message_id: sendResult.messageId,
        delivery_status: sendResult.status,
        status_updated_at: new Date().toISOString(),
        error_message: null,
      });
      localOutgoingRetryPayloadRef.current.delete(optimisticMessage.id);

      await commWhatsAppService.syncChatHistory(selectedChat.external_chat_id).catch(() => undefined);
      hydratedChatsRef.current.add(selectedChat.external_chat_id);
      await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar mídia da gaveta', error);
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mídia agora.';
      patchLocalOutgoingMessage(optimisticMessage.id, {
        delivery_status: 'failed',
        status_updated_at: new Date().toISOString(),
        error_message: message,
      });
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setSendingDrawerMedia(false);
    }
  }, [appendLocalOutgoingMessage, applyOptimisticChatSummary, buildOptimisticOutgoingMessage, loadChats, loadMessages, mediaDrawerSendDisabledReason, patchLocalOutgoingMessage, selectedChat]);

  const handleRegenerateFollowUp = useCallback(() => {
    void handleGenerateFollowUp(followUpCustomInstructions);
  }, [followUpCustomInstructions, handleGenerateFollowUp]);

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

    setSending(true);

    try {
      await sendTextSegments(selectedChat, textSegments);
      handleCloseFollowUpModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar follow-up', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o follow-up.');
    } finally {
      setSending(false);
    }
  }, [followUpDraft, handleCloseFollowUpModal, selectedChat, sendDisabledReason, sendTextSegments]);

  const handleComposerSubmit = () => {
    if (sending || generatingFollowUp) return;

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

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    if (!hasSendPayload || voiceAttachment || voiceRecordingState === 'recording') {
      return;
    }

    event.preventDefault();
    void handleSendMessage();
  };

  return (
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--panel-text-muted,#8a735f)]">
                  {archivedSectionOpen ? 'Arquivadas' : 'Conversas'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant={archivedSectionOpen ? 'soft' : 'secondary'}
                    onClick={() => setArchivedSectionOpen((current) => !current)}
                    className="rounded-xl"
                    aria-label="Chats arquivados"
                    title={archivedChats.length > 0 ? `Chats arquivados (${archivedChats.length})` : 'Chats arquivados'}
                  >
                    <span className="relative inline-flex">
                      <Archive className="h-4 w-4" />
                      {archivedChats.length > 0 ? (
                        <span className="absolute -right-2 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none" style={{
                          borderColor: 'rgba(212, 192, 167, 0.56)',
                          background: 'var(--panel-accent-strong,#c86f1d)',
                          color: '#fff8f0',
                        }}>
                          {archivedChats.length > 99 ? '99+' : archivedChats.length}
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
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : sidebarChats.length === 0 ? (
              <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center">
                {archivedSectionOpen ? <Archive className="h-8 w-8 whatsapp-inbox-empty-icon" /> : <MessageCircle className="h-8 w-8 whatsapp-inbox-empty-icon" />}
                <div className="space-y-1">
                  <p className="whatsapp-inbox-heading text-sm font-medium text-[var(--panel-text,#1f2937)]">
                    {archivedSectionOpen ? 'Nenhum chat arquivado' : 'Nenhuma conversa ainda'}
                  </p>
                  <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">
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
                      setOpenChatMenuChatId(null);
                      setSelectedChatId(chatId);
                    }}
                    menuOpen={openChatMenuChatId === chat.id}
                    menuBusy={updatingChatStateId === chat.id}
                    onToggleMenu={handleToggleChatMenu}
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
                  <p className="whatsapp-inbox-heading text-base font-semibold text-[var(--panel-text,#1f2937)]">Selecione uma conversa</p>
                  <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Abra um chat na coluna da esquerda para acompanhar o histórico e responder.</p>
                </div>
              </div>
          ) : (
            <>
              <div className="whatsapp-inbox-thread-header flex items-start justify-between gap-4 border-b p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="whatsapp-inbox-heading text-lg font-semibold text-[var(--panel-text,#1f2937)]">{selectedChatDisplayName}</p>
                    {selectedChat.lead_id && leadPanel?.id && leadPanel.status_nome ? (
                      <StatusDropdown
                        currentStatus={leadPanel.status_nome}
                        leadId={leadPanel.id}
                        onStatusChange={handleLeadStatusChange}
                        statusOptions={leadStatuses}
                      />
                    ) : null}
                    {selectedChatWasAutoLinked ? (
                      <span className="inline-flex items-center rounded-full border border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                        Auto
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--panel-text-muted,#6b7280)]">
                    <span>{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</span>
                    {leadPanel?.responsavel_label ? <span>Responsável: {leadPanel.responsavel_label}</span> : null}
                  </div>
                  {nextChatReminderSummary ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--panel-text-muted,#8a735f)]">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1" style={chatAgendaSummary.nextReminder && isOverdue(chatAgendaSummary.nextReminder.data_lembrete)
                        ? {
                            borderColor: 'rgba(215, 154, 143, 0.75)',
                            background: 'rgba(122, 33, 24, 0.08)',
                            color: 'var(--panel-accent-red-text,#b4534a)',
                          }
                        : {
                            borderColor: 'rgba(212, 192, 167, 0.56)',
                            background: 'rgba(255, 248, 240, 0.06)',
                            color: 'var(--panel-text-muted,#8a735f)',
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
                      {formatConnectionStatusLabel(connectionStatus)}
                    </span>
                    {channelState?.last_webhook_received_at && (
                      <span className="text-xs text-[var(--panel-text-muted,#6b7280)]">
                        Webhook: {formatMessageTime(channelState.last_webhook_received_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
                            borderColor: 'rgba(212, 192, 167, 0.56)',
                            background: 'var(--panel-accent-strong,#c86f1d)',
                            color: '#fff8f0',
                          }}>
                            {chatAgendaSummary.pendingCount > 99 ? '99+' : chatAgendaSummary.pendingCount}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>

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
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                    Nenhuma mensagem carregada para esta conversa.
                  </div>
                ) : (
                  messageTimelineItems.map((item) => {
                    if (item.type === 'day') {
                      return (
                        <div key={item.key} className="flex w-full justify-center py-1">
                          <div className="rounded-full border px-3 py-1 text-[12px] font-semibold shadow-sm" style={{
                            borderColor: 'rgba(212, 192, 167, 0.56)',
                            background: 'color-mix(in srgb, var(--panel-surface,#fffdfa) 82%, rgba(26,18,13,0.18) 18%)',
                            color: 'var(--panel-text-soft,#5b4635)',
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

                      return (
                        <div key={item.key} className={`message-bubble-row flex w-full ${lastMessage.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                          <div className="relative max-w-[82%] pb-2">
                            <div className={`rounded-[2rem] px-2 py-2 shadow-sm ${getMessageBubbleClasses(lastMessage.direction)}`}>
                              <WhatsAppMediaGroupBody messages={groupMessages} onOpenImage={setLightboxMedia} />
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

                    return (
                      <div key={item.key} className={`message-bubble-row group/message flex w-full ${message.direction === 'outbound' ? 'justify-end' : message.direction === 'system' ? 'justify-center' : 'justify-start'}`}>
                        <div
                          ref={(node) => {
                            if (node) {
                              reactionAnchorRefs.current[message.id] = node;
                            } else {
                              delete reactionAnchorRefs.current[message.id];
                            }
                          }}
                          className="relative max-w-[80%] pb-5"
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
                                className={`absolute top-2 z-[3] inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(212,192,167,0.56)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)] shadow-sm transition ${message.direction === 'outbound' ? '-left-10' : '-right-10'} opacity-0 group-hover/message:opacity-100 hover:bg-[var(--panel-surface-soft,#f8f2e9)] focus:opacity-100`}
                                aria-label="Reagir à mensagem"
                                title="Reagir"
                              >
                                <Smile className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}

                          <div className={`rounded-3xl px-4 py-3 shadow-sm ${getMessageBubbleClasses(message.direction)}`}>
                            <WhatsAppMessageBody
                              message={message}
                              onOpenImage={setLightboxMedia}
                              onTranscribe={(target) => void handleTranscribeMessage(target)}
                              transcribing={transcribingMessageId === message.id}
                            />
                            <div className="whatsapp-inbox-message-meta mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] font-medium">
                              <span>{formatMessageTime(message.message_at)}</span>
                              {message.direction === 'outbound' && <DeliveryStatusIndicator message={message} />}
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
                                  className={`inline-flex min-h-[28px] items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-md ${reaction.fromMe ? 'bg-[var(--panel-accent-soft,#f4e2cc)] text-[var(--panel-accent-ink,#8b4d12)]' : 'bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)]'}`}
                                  style={{ borderColor: 'rgba(212, 192, 167, 0.56)' }}
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
                          disabled={sending}
                          className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                          aria-label="Descartar nota de voz"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>

                          <button
                            type="button"
                            onClick={handleToggleVoicePreviewPlayback}
                            disabled={sending}
                            className="whatsapp-inbox-voice-play inline-flex items-center justify-center rounded-full transition"
                            aria-label={voicePreviewPlaying ? 'Pausar nota de voz' : 'Ouvir nota de voz'}
                          >
                            {voicePreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                          </button>

                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="h-3 w-3 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" />
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
                            disabled={sending}
                            className="whatsapp-inbox-voice-side-action is-accent inline-flex items-center justify-center rounded-full transition"
                            aria-label="Regravar nota de voz"
                          >
                            <Mic className="h-4 w-4" />
                          </button>
                        </div>

                          <button
                            type="button"
                            onClick={handleSendCurrentVoiceRecording}
                            disabled={sending || Boolean(sendDisabledReason)}
                            className={`whatsapp-inbox-voice-send inline-flex items-center justify-center rounded-full transition ${sending ? 'opacity-70' : ''}`}
                            aria-label="Enviar nota de voz"
                          >
                            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
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
                        <div className="flex shrink-0 items-center gap-2 text-rose-400">
                          <span className="h-3 w-3 rounded-full bg-current shadow-[0_0_0_4px_rgba(251,113,133,0.16)]" />
                          <span className="whatsapp-inbox-voice-time text-sm font-semibold tabular-nums text-[var(--panel-text,#1f2937)]">
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

                  {nonVoiceAttachments.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {nonVoiceAttachments.length > 1 ? (
                        <div className="flex items-center justify-between rounded-2xl border px-3 py-2 text-xs font-semibold text-[var(--panel-text-soft,#5b4635)]">
                          <span>{nonVoiceAttachments.length} anexos prontos para envio</span>
                          <span className="text-[var(--panel-text-muted,#6b7280)]">Serão enviados em sequência</span>
                        </div>
                      ) : null}
                      {nonVoiceAttachments.map((attachment) => {
                        const isUploadingThisAttachment = sending && mediaUploadProgress?.attachmentId === attachment.id;

                        return (
                          <div key={attachment.id} className="whatsapp-inbox-attachment-card rounded-2xl border px-3 py-3">
                            <div className="flex items-start gap-3">
                              {attachment.kind === 'image' ? (
                                <FileImage className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                              ) : attachment.kind === 'video' ? (
                                <Images className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                              ) : attachment.kind === 'audio' ? (
                                <FileAudio className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                              ) : (
                                <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                              )}
                              <div className="min-w-0 flex-1 space-y-3">
                                <div>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-[var(--panel-text,#1f2937)]">{attachment.file.name}</p>
                                      <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">{formatFileSize(attachment.file.size)}</p>
                                    </div>
                                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-soft,#5b4635)]">
                                      {attachment.kind === 'image' ? 'Imagem' : attachment.kind === 'video' ? 'Vídeo' : attachment.kind === 'audio' ? 'Áudio' : 'Documento'}
                                    </span>
                                  </div>
                                </div>

                                {attachment.kind === 'image' && attachment.previewUrl ? (
                                  <img src={attachment.previewUrl} alt={attachment.file.name} className="max-h-[180px] rounded-2xl object-cover" />
                                ) : attachment.kind === 'video' && attachment.previewUrl ? (
                                  <video controls preload="metadata" className="max-h-[220px] rounded-2xl bg-black">
                                    <source src={attachment.previewUrl} type={attachment.file.type || undefined} />
                                  </video>
                                ) : null}

                                {isUploadingThisAttachment ? (
                                  <div className="space-y-1.5">
                                    <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                                      <div className="whatsapp-inbox-upload-progress h-full rounded-full" style={{ width: `${mediaUploadProgress?.progress ?? 0}%` }} />
                                    </div>
                                    <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">
                                      Enviando anexo {mediaUploadProgress?.currentIndex} de {mediaUploadProgress?.total}... {mediaUploadProgress?.progress ?? 0}%
                                    </p>
                                  </div>
                                ) : null}

                                <div className="flex flex-wrap items-center gap-2">
                                  {isUploadingThisAttachment ? (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={handleCancelMediaUpload}
                                      className="whatsapp-inbox-attachment-action h-8 rounded-xl px-3 text-[11px]"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Cancelar upload
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleClearAttachment(attachment.id)}
                                    disabled={sending}
                                    className="whatsapp-inbox-attachment-action h-8 rounded-xl px-3 text-[11px]"
                                    aria-label="Remover anexo"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {voiceRecordingState === 'recording' || voiceAttachment ? null : (
                  <div className={`flex gap-1.5 sm:gap-2 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                    <div ref={attachmentMenuRef} className={`relative flex shrink-0 gap-0.5 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                      {attachmentMenuOpen && (
                        <div className="whatsapp-inbox-attach-menu absolute bottom-full left-0 z-[20] mb-3 min-w-[228px] overflow-hidden rounded-2xl border p-2 shadow-2xl">
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('document')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--panel-text-soft,#5b4635)]">
                              <FileText className="h-4 w-4" />
                            </span>
                            <span>Documento</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('media')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--panel-accent-strong,#c86f1d)]">
                              <Images className="h-4 w-4" />
                            </span>
                            <span>Fotos e vídeos</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('audio')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--panel-accent-ink,#8b4d12)]">
                              <FileAudio className="h-4 w-4" />
                            </span>
                            <span>Áudio</span>
                          </button>
                          <button
                            type="button"
                            disabled
                            className="whatsapp-inbox-attach-menu-item is-disabled flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--panel-text-muted,#8a735f)]">
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
                          disabled={voiceRecordingState !== 'idle' || generatingFollowUp || sending}
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
                        <button
                          type="button"
                          onClick={handleOpenComposerRewriteModal}
                          disabled={Boolean(composerRewriteDisabledReason)}
                          className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${composerRewriteModalOpen ? 'is-open' : ''}`}
                          aria-label="Reescrever mensagem com IA"
                          aria-expanded={composerRewriteModalOpen}
                          title={composerRewriteDisabledReason ?? 'Reescrever mensagem com IA'}
                        >
                          <Sparkles className="h-4.5 w-4.5" />
                        </button>
                    </div>

                    <div className={`relative min-w-0 flex-1 ${isComposerExpanded ? 'py-1.5' : 'py-0.5'}`}>
                      {quickReplyMenuOpen && (
                        <div className="absolute right-0 bottom-full left-0 z-[30] mb-2 overflow-hidden rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-2xl">
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">
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
                                    className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition ${isActive ? 'bg-[var(--panel-accent-soft,#f4e2cc)]/70 text-[var(--panel-text,#1f2937)]' : 'text-[var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f8f2e9)]'}`}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      handleInsertQuickReply(option);
                                    }}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold">{option.name}</span>
                                        <code className="shrink-0 rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-2 py-0.5 text-[11px] font-semibold text-[var(--panel-accent-ink,#8b4d12)]">
                                          /{option.shortcut}
                                        </code>
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--panel-text-muted,#8a735f)]">
                                        {option.preview}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-4 py-4 text-sm text-[var(--panel-text-soft,#5b4635)]">
                                <p className="font-medium">{quickReplyEmptyStateMessage}</p>
                                <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#8a735f)]">
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
                        disabled={sending || generatingFollowUp}
                        className="whatsapp-inbox-composer-input block w-full resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 focus:outline-none"
                      />
                    </div>

                    <div className={`flex shrink-0 ${isComposerExpanded ? 'items-end pb-0.5' : 'items-center'}`}>
                      <button
                        type="button"
                        onClick={handleComposerSubmit}
                        disabled={sending || generatingFollowUp || Boolean(sendDisabledReason) || voiceRecordingState === 'requesting'}
                        className={`whatsapp-inbox-composer-action inline-flex h-11 w-11 items-center justify-center rounded-xl transition ${hasSendPayload ? 'is-active' : ''} ${sending || generatingFollowUp || voiceRecordingState === 'requesting' ? 'cursor-wait opacity-70' : ''}`}
                        aria-label={voiceRecordingState === 'requesting' ? 'Solicitando microfone' : hasSendPayload ? 'Enviar mensagem' : 'Gravar áudio'}
                        title={sendDisabledReason ?? undefined}
                      >
                        {sending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : voiceRecordingState === 'requesting' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : hasSendPayload ? (
                          <SendHorizontal className="h-5 w-5" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        </section>

        {lightboxMedia && (
          <div className="whatsapp-inbox-lightbox fixed inset-0 z-[120] flex items-center justify-center p-6" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
              aria-label="Fechar visualização"
              onClick={() => setLightboxMedia(null)}
            />
            <div className="relative z-[1] flex max-h-full max-w-5xl flex-col gap-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/65 px-4 py-3 text-white">
                <p className="truncate text-sm font-medium">{lightboxMedia.name}</p>
                <div className="flex items-center gap-2">
                  <a
                    href={lightboxMedia.src}
                    download={lightboxMedia.name}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </a>
                  <button
                    type="button"
                    onClick={() => setLightboxMedia(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 hover:bg-white/10"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <img src={lightboxMedia.src} alt={lightboxMedia.name} className="max-h-[80vh] max-w-full rounded-3xl object-contain shadow-2xl" />
            </div>
          </div>
        )}

        <WhatsAppQuickRepliesModal
          isOpen={quickRepliesModalOpen}
          quickReplies={quickReplies}
          saving={savingQuickReplies}
          onClose={() => setQuickRepliesModalOpen(false)}
          onSave={handleSaveQuickReplies}
        />

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
          value={followUpDraft}
          customInstructions={followUpCustomInstructions}
          onClose={handleCloseFollowUpModal}
          onChangeValue={setFollowUpDraft}
          onChangeCustomInstructions={setFollowUpCustomInstructions}
          onGenerate={handleRegenerateFollowUp}
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
          onLinkLead={(leadId) => void handleLinkLead(leadId)}
          linkLoadingLeadId={linkLoadingLeadId}
          canViewAgenda={canViewAgenda}
          canEditAgenda={canEditAgenda}
        />

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
            border: '1px solid rgba(214, 170, 92, 0.22)',
            background: 'rgba(18, 12, 9, 0.96)',
            boxShadow: '0 18px 46px rgba(0, 0, 0, 0.34)',
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
                    className={`message-bubble-emoji-button inline-flex h-9 w-9 items-center justify-center rounded-full text-[1.45rem] leading-none transition ${selected ? 'bg-[rgba(255,255,255,0.12)] scale-105' : 'hover:bg-[rgba(255,255,255,0.08)]'}`}
                    aria-label={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })
            : null}
        </PanelPopoverShell>

        <PanelPopoverShell
          ref={chatMenuRef}
          isOpen={Boolean(openChatMenuChat && chatMenuPosition)}
          position={chatMenuPosition}
          onClose={() => setOpenChatMenuChatId(null)}
          ariaLabel="Menu da conversa"
          className="before:hidden rounded-2xl border-[rgba(212,192,167,0.18)] bg-[rgba(16,12,10,0.98)] p-1 shadow-2xl"
          style={{ width: chatMenuPosition?.width ?? 248 }}
        >
          {openChatMenuChat ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setOpenChatMenuChatId(null);
                  void handleUpdateChatInboxState(openChatMenuChat, { isArchived: !openChatMenuChat.is_archived });
                }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--panel-text,#f6eadf)] transition hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-60"
              >
                {openChatMenuChat.is_archived ? <ArchiveRestore className="h-4 w-4 shrink-0" /> : <Archive className="h-4 w-4 shrink-0" />}
                <span>{openChatMenuChat.is_archived ? 'Remover dos arquivados' : 'Arquivar conversa'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenChatMenuChatId(null);
                  void handleUpdateChatInboxState(openChatMenuChat, { isMuted: !openChatMenuChat.is_muted });
                }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--panel-text,#f6eadf)] transition hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-60"
              >
                {openChatMenuChat.is_muted ? <Bell className="h-4 w-4 shrink-0" /> : <BellOff className="h-4 w-4 shrink-0" />}
                <span>{openChatMenuChat.is_muted ? 'Ativar notificacoes' : 'Silenciar notificacoes'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenChatMenuChatId(null);
                  void handleUpdateChatInboxState(openChatMenuChat, { isPinned: !openChatMenuChat.is_pinned });
                }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--panel-text,#f6eadf)] transition hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-60"
              >
                <Pin className="h-4 w-4 shrink-0" />
                <span>{openChatMenuChat.is_pinned ? 'Desafixar conversa' : 'Fixar conversa'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenChatMenuChatId(null);
                  void handleUpdateChatInboxState(openChatMenuChat, { markAsUnread: !openChatMenuChat.manual_unread && openChatMenuChat.unread_count <= 0 });
                }}
                disabled={updatingChatStateId === openChatMenuChat.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--panel-text,#f6eadf)] transition hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>{openChatMenuChat.manual_unread || openChatMenuChat.unread_count > 0 ? 'Marcar como lida' : 'Marcar como nao lida'}</span>
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
          className="w-[272px] border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2.5 shadow-2xl"
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
                className="h-auto px-0 py-1 text-[11px] uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)] hover:bg-transparent hover:text-[var(--panel-accent-ink-strong,#6f3f16)]"
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </PanelPopoverShell>
      </div>
    </div>
  );
}
