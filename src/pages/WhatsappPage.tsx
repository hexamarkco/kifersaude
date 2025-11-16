import {
  ChangeEvent,
  FormEvent,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock,
  FileText,
  Image as ImageIcon,
  MessageSquareText,
  Plus,
  MapPin,
  Mic,
  Pin,
  PinOff,
  Paperclip,
  Search,
  Send,
  Settings,
  MoreVertical,
  User,
  UserPlus,
  Video as VideoIcon,
  X,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AudioMessageBubble } from '../components/AudioMessageBubble';
import { LiveAudioVisualizer } from '../components/LiveAudioVisualizer';
import StatusDropdown from '../components/StatusDropdown';
import ChatLeadDetailsDrawer from '../components/ChatLeadDetailsDrawer';
import WhatsappCampaignDrawer from '../components/WhatsappCampaignDrawer';
import WhatsappSettingsPanel from '../components/WhatsappSettingsPanel';
import { useConfig } from '../contexts/ConfigContext';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import QuickRepliesMenu from '../components/QuickRepliesMenu';
import { convertLocalToUTC, formatDateTimeForInput } from '../lib/dateUtils';
import { supabase } from '../lib/supabase';
import type { QuickReply } from '../lib/supabase';
import { fetchWhatsappJson, getWhatsappFunctionUrl } from '../lib/whatsappApi';
import type {
  WhatsappChat,
  WhatsappChatInsight,
  WhatsappChatInsightSentiment,
  WhatsappChatInsightStatus,
  WhatsappMessage,
  WhatsappScheduledMessage,
  WhatsappScheduledMessagePriority,
  WhatsappScheduledMessageStatus,
  WhatsappScheduledMessagesPeriodSummary,
} from '../types/whatsapp';

const WAVEFORM_BAR_COUNT = 64;
const WAVEFORM_SENSITIVITY = 1.8;

const REQUIRED_WHATSAPP_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_FUNCTIONS_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

const getMissingWhatsappEnvVars = () => {
  const env = import.meta.env as Record<string, string | undefined>;
  return REQUIRED_WHATSAPP_ENV_VARS.filter(key => !env?.[key]);
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatChatListTimestamp = (value: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const oneDayInMs = 24 * 60 * 60 * 1000;
  const diffInDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / oneDayInMs);

  if (diffInDays === 0) {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (diffInDays === 1) {
    return 'Ontem';
  }

  if (diffInDays === 2) {
    return 'Anteontem';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatShortTime = (value: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPeriodRangeLabel = (start: string | null, end: string | null) => {
  if (!start || !end) {
    return '';
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '';
  }

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  const dateLabel = startDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return sameDay ? `${dateLabel} • ${startTime} - ${endTime}` : `${startTime} - ${endTime}`;
};

const formatWaitingLabel = (minutes: number | null, fallback: string) => {
  if (minutes === null || minutes < 0) {
    return fallback;
  }

  if (minutes === 0) {
    return 'há instantes';
  }

  if (minutes < 60) {
    return `há ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `há ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `há ${days}d`;
};

const truncateQuickReplyPreview = (text: string, limit = 80) => {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3)}...`;
};

const CHAT_PREVIEW_FALLBACK_TEXT = 'Sem mensagens recentes';

type ChatPreviewInfo = {
  icon: LucideIcon | null;
  text: string;
};

type WhatsappSectionId = 'painel' | 'configs';

const WHATSAPP_SECTIONS: { id: WhatsappSectionId; label: string; icon: LucideIcon }[] = [
  { id: 'painel', label: 'Chats', icon: MessageSquareText },
  { id: 'configs', label: 'Configurações', icon: Settings },
];

type AudioTranscriptionState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  text: string | null;
  error: string | null;
};

type TranscribeAudioResponse = {
  success: boolean;
  transcription?: string | null;
  error?: string | null;
};

const getAvatarColorStyles = (
  seed: string,
): {
  background: string;
  icon: string;
} => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 70;
  const lightnessBase = 60;

  return {
    background: `hsl(${hue} ${saturation}% ${lightnessBase + 20}%)`,
    icon: `hsl(${hue} ${saturation}% ${Math.max(0, lightnessBase - 25)}%)`,
  };
};

const removeDiacritics = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizePhoneForComparison = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  if (value.endsWith('-group')) {
    return value;
  }

  const withoutSuffix = value.includes('@') ? value.slice(0, value.indexOf('@')) : value;
  return withoutSuffix.replace(/\D+/g, '');
};

const LEADING_PREVIEW_EMOJI_MAP: Array<{ icon: LucideIcon; emojis: string[] }> = [
  { icon: ImageIcon, emojis: ['🖼️'] },
  { icon: VideoIcon, emojis: ['🎬'] },
  { icon: FileText, emojis: ['📄'] },
  { icon: MapPin, emojis: ['📍'] },
  { icon: Mic, emojis: ['🎙️', '🎙', '🎤', '🎧'] },
];

const MEDIA_PREVIEW_PATTERNS: Array<{ icon: LucideIcon; prefixes: string[] }> = [
  { icon: ImageIcon, prefixes: ['imagem recebida', 'imagem enviada'] },
  { icon: VideoIcon, prefixes: ['video recebido', 'video enviado'] },
  { icon: Mic, prefixes: ['audio recebido', 'audio enviado'] },
  { icon: FileText, prefixes: ['documento recebido', 'documento enviado'] },
  { icon: MapPin, prefixes: ['localizacao recebida', 'localizacao enviada'] },
  { icon: UserPlus, prefixes: ['contato recebido', 'contato enviado'] },
];

const CHAT_SKELETON_INDICES = Array.from({ length: 6 }, (_, index) => index);
const MESSAGE_SKELETON_INDICES = Array.from({ length: 5 }, (_, index) => index);

type LoadInsightOptions = { cancelled?: () => boolean };

const SENTIMENT_BADGE_STYLES: Record<WhatsappChatInsightSentiment, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-slate-200 bg-slate-100 text-slate-600',
  negative: 'border-rose-200 bg-rose-50 text-rose-700',
};

const SENTIMENT_BADGE_LABELS: Record<WhatsappChatInsightSentiment, string> = {
  positive: 'Positivo',
  neutral: 'Neutro',
  negative: 'Negativo',
};

const ChatListSkeleton = () => (
  <div className="animate-pulse" role="status">
    <span className="sr-only">Carregando conversas</span>
    <div className="divide-y divide-slate-100" aria-hidden="true">
      {CHAT_SKELETON_INDICES.map(index => (
        <div key={`chat-skeleton-${index}`} className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200" />
            <div className="flex-1">
              <div className="h-4 w-2/3 rounded-full bg-slate-200" />
              <div className="mt-2 h-3 w-3/4 rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const MessageSkeletonList = () => (
  <div className="space-y-3" role="status">
    <span className="sr-only">Carregando mensagens</span>
    {MESSAGE_SKELETON_INDICES.map(index => {
      const isFromMe = index % 2 === 1;
      const alignment = isFromMe ? 'justify-end' : 'justify-start';
      const bubbleColor = isFromMe ? 'bg-emerald-100' : 'bg-white';
      const bubbleCorner = isFromMe ? 'rounded-br-none' : 'rounded-bl-none';
      return (
        <div key={`message-skeleton-${index}`} className={`flex ${alignment}`} aria-hidden="true">
          <div
            className={`max-w-[75%] rounded-2xl ${bubbleCorner} ${bubbleColor} p-4 shadow-sm ring-1 ring-white/40`}
          >
            <div className="h-3 w-5/6 rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-2/3 rounded-full bg-slate-100" />
          </div>
        </div>
      );
    })}
  </div>
);

const stripLeadingPreviewEmoji = (
  value: string,
): { icon: LucideIcon | null; text: string } => {
  for (const { icon, emojis } of LEADING_PREVIEW_EMOJI_MAP) {
    for (const emoji of emojis) {
      if (value.startsWith(emoji)) {
        const stripped = value.slice(emoji.length).trimStart();
        return { icon, text: stripped };
      }
    }
  }

  return { icon: null, text: value };
};

const getChatPreviewInfo = (preview: string | null): ChatPreviewInfo => {
  if (!preview) {
    return { icon: null, text: CHAT_PREVIEW_FALLBACK_TEXT };
  }

  const trimmedPreview = preview.trim();
  if (!trimmedPreview) {
    return { icon: null, text: CHAT_PREVIEW_FALLBACK_TEXT };
  }

  const { icon: emojiIcon, text: withoutEmoji } = stripLeadingPreviewEmoji(trimmedPreview);
  const sanitizedPreview = withoutEmoji.trim();

  if (!sanitizedPreview) {
    return {
      icon: emojiIcon,
      text: CHAT_PREVIEW_FALLBACK_TEXT,
    };
  }

  const normalizedPreview = removeDiacritics(sanitizedPreview).toLowerCase();

  for (const { icon, prefixes } of MEDIA_PREVIEW_PATTERNS) {
    if (prefixes.some(prefix => normalizedPreview.startsWith(prefix))) {
      return {
        icon,
        text: sanitizedPreview,
      };
    }
  }

  if (emojiIcon) {
    return {
      icon: emojiIcon,
      text: sanitizedPreview,
    };
  }

  return {
    icon: null,
    text: sanitizedPreview,
  };
};

type OptimisticMessage = WhatsappMessage & { isOptimistic?: boolean };

type TimelineMessage = OptimisticMessage & {
  scheduleMetadata?: {
    scheduledMessageId: string;
    scheduledSendAt: string;
    status: WhatsappScheduledMessageStatus;
    lastError?: string | null;
    createdAt?: string | null;
  };
};

const SCHEDULE_STATUS_LABELS: Record<WhatsappScheduledMessageStatus, string> = {
  pending: 'Agendado',
  processing: 'Processando agendamento',
  sent: 'Enviado',
  failed: 'Falha no agendamento',
  cancelled: 'Agendamento cancelado',
};

const shouldDisplayScheduledMessage = (status: WhatsappScheduledMessageStatus) => {
  return status !== 'sent';
};

const sortSchedulesByMoment = (entries: WhatsappScheduledMessage[]) => {
  return [...entries].sort((a, b) => {
    const aTime = new Date(a.scheduled_send_at).getTime();
    const bTime = new Date(b.scheduled_send_at).getTime();
    const safeATime = Number.isNaN(aTime) ? 0 : aTime;
    const safeBTime = Number.isNaN(bTime) ? 0 : bTime;

    if (safeATime !== safeBTime) {
      return safeATime - safeBTime;
    }

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    const safeACreated = Number.isNaN(aCreated) ? 0 : aCreated;
    const safeBCreated = Number.isNaN(bCreated) ? 0 : bCreated;

    if (safeACreated !== safeBCreated) {
      return safeACreated - safeBCreated;
    }

    return a.id.localeCompare(b.id);
  });
};

const sortSchedulesByUrgency = (entries: WhatsappScheduledMessage[]) => {
  return [...entries].sort((a, b) => {
    const priorityA = PRIORITY_LEVEL_ORDER[a.priority_level ?? 'normal'] ?? 2;
    const priorityB = PRIORITY_LEVEL_ORDER[b.priority_level ?? 'normal'] ?? 2;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const orderA = Number.isFinite(a.priority_order ?? null)
      ? (a.priority_order ?? 0)
      : 0;
    const orderB = Number.isFinite(b.priority_order ?? null)
      ? (b.priority_order ?? 0)
      : 0;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const dateA = new Date(a.scheduled_send_at).getTime();
    const dateB = new Date(b.scheduled_send_at).getTime();

    if (!Number.isNaN(dateA) && !Number.isNaN(dateB) && dateA !== dateB) {
      return dateA - dateB;
    }

    return a.id.localeCompare(b.id);
  });
};

const SLA_STATUS_BADGE_CLASSES: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border border-amber-100',
  critical: 'bg-rose-50 text-rose-600 border border-rose-100',
};

const PRIORITY_LEVEL_LABELS: Record<WhatsappScheduledMessagePriority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

const PRIORITY_LEVEL_ORDER: Record<WhatsappScheduledMessagePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const SCHEDULE_STATUS_BADGE_CLASSES: Record<WhatsappScheduledMessageStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
  processing: 'bg-blue-50 text-blue-700 border border-blue-100',
  sent: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  failed: 'bg-rose-50 text-rose-600 border border-rose-100',
  cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const getPriorityLabel = (priority: WhatsappScheduledMessagePriority | undefined | null) => {
  if (!priority) {
    return PRIORITY_LEVEL_LABELS.normal;
  }

  return PRIORITY_LEVEL_LABELS[priority] ?? PRIORITY_LEVEL_LABELS.normal;
};

type SendMessageResponse =
  | {
      success: true;
      message: WhatsappMessage;
      chat: WhatsappChat;
    }
  | {
      success: false;
      error?: string;
    };

type UpdateChatFlagsPayload = {
  is_archived?: boolean;
  is_pinned?: boolean;
};

type UpdateChatFlagsResponse = {
  success: boolean;
  chat?: WhatsappChat | null;
  error?: string;
};

type WhatsappMessageRawPayload = {
  reaction?: {
    value?: string | null;
    time?: string | number | null;
    reactionBy?: string | null;
    referencedMessage?: {
      messageId?: string | null;
      fromMe?: boolean | null;
      phone?: string | null;
      participant?: string | null;
    } | null;
  } | null;
  image?: {
    imageUrl?: string | null;
    caption?: string | null;
  } | null;
  audio?: {
    audioUrl?: string | null;
    seconds?: number | null;
  } | null;
  video?: {
    videoUrl?: string | null;
    caption?: string | null;
  } | null;
  document?: {
    documentUrl?: string | null;
    fileName?: string | null;
    title?: string | null;
    caption?: string | null;
  } | null;
  location?: {
    title?: string | null;
    address?: string | null;
    latitude?: string | null;
    longitude?: string | null;
  } | null;
  contact?: {
    name?: string | null;
    phones?: string[] | null;
    businessDescription?: string | null;
  } | null;
  contacts?: Array<{
    name?: string | null;
    phones?: string[] | null;
    businessDescription?: string | null;
  }> | null;
  senderName?: string | null;
  pushName?: string | null;
  participant?: string | null;
  author?: string | null;
  phone?: string | null;
  key?: {
    participant?: string | null;
  } | null;
  [key: string]: unknown;
};

const UNSUPPORTED_MESSAGE_PLACEHOLDER = '[tipo de mensagem não suportado ainda]';

type PendingMediaAttachment = {
  kind: 'image' | 'video';
  dataUrl: string;
  fileName: string | null;
  mimeType: string;
};

type PendingDocumentAttachment = {
  kind: 'document';
  dataUrl: string;
  fileName: string | null;
  extension: string;
};

type PendingAudioAttachment = {
  kind: 'audio';
  dataUrl: string;
  durationSeconds: number | null;
  mimeType: string;
};

type WhatsappContactListEntry = {
  phone: string;
  name: string | null;
  isBusiness: boolean;
};

type LeadSummary = {
  id: string;
  nome_completo: string;
  telefone: string | null;
  status: string | null;
  responsavel: string | null;
};

type UpdateLeadStatusResponse = {
  success: boolean;
  lead?: {
    id: string;
    status: string | null;
    ultimo_contato: string | null;
    responsavel: string | null;
  };
  error?: string;
};

type PendingAttachment =
  | PendingMediaAttachment
  | PendingDocumentAttachment
  | PendingAudioAttachment;

type SendAttachmentResult = {
  wasSent: boolean;
  preserveCaption?: boolean;
  captionValue?: string;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseDateValue = (value: unknown): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value) : null;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return new Date(numeric);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const formatReactionTime = (date: Date | null): string => {
  if (!date) {
    return '';
  }

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatReactionPhoneNumber = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, '');

  if (!digits) {
    return value.trim() || null;
  }

  const countryCodeLength = digits.length > 11 ? digits.length - 11 : Math.max(digits.length - 9, 0);
  const countryCode = countryCodeLength > 0 ? digits.slice(0, countryCodeLength) : '';
  const remainingAfterCountry = digits.slice(countryCodeLength);

  const areaCodeLength = remainingAfterCountry.length > 9 ? 2 : 0;
  const areaCode = areaCodeLength ? remainingAfterCountry.slice(0, areaCodeLength) : '';
  const localNumber = remainingAfterCountry.slice(areaCodeLength);

  let formattedLocal = localNumber;
  if (localNumber.length === 9) {
    formattedLocal = `${localNumber.slice(0, 5)}-${localNumber.slice(5)}`;
  } else if (localNumber.length === 8) {
    formattedLocal = `${localNumber.slice(0, 4)}-${localNumber.slice(4)}`;
  }

  const pieces = [
    countryCode ? `+${countryCode}` : '',
    areaCode ? `(${areaCode})` : '',
    formattedLocal,
  ].filter(Boolean);

  return pieces.length > 0 ? pieces.join(' ') : value.trim();
};

type MessageReactionParticipant = {
  participantId: string;
  displayName: string | null;
  phone: string | null;
  isFromMe: boolean;
  reactedAt: Date | null;
};

type MessageReactionSummaryEntry = {
  emoji: string;
  count: number;
  participants: MessageReactionParticipant[];
};

type MessageReactionSummary = {
  totalCount: number;
  entries: MessageReactionSummaryEntry[];
};

const getMessageSenderDisplayName = (message: OptimisticMessage): string | null => {
  if (message.from_me) {
    return 'Você';
  }

  const payload =
    message.raw_payload && typeof message.raw_payload === 'object'
      ? (message.raw_payload as WhatsappMessageRawPayload)
      : null;

  if (!payload) {
    return null;
  }

  const directName =
    toNonEmptyString(payload.senderName) ??
    toNonEmptyString(payload.pushName) ??
    toNonEmptyString(payload.participant) ??
    toNonEmptyString(payload.author);

  if (directName) {
    return directName;
  }

  const keyParticipant = (() => {
    const key = payload.key;
    if (!key || typeof key !== 'object') {
      return null;
    }

    return toNonEmptyString((key as { participant?: unknown })?.participant);
  })();

  if (keyParticipant) {
    return keyParticipant;
  }

  const phone = toNonEmptyString(payload.phone);
  if (phone) {
    return phone;
  }

  return null;
};

const sanitizeChatPreviewText = (
  previewText: string,
  chat: WhatsappChat,
  displayName: string,
): string => {
  const trimmedPreview = previewText.trim();
  if (!trimmedPreview) {
    return CHAT_PREVIEW_FALLBACK_TEXT;
  }

  const formattedLastMessageMoment = formatDateTime(chat.last_message_at);
  let withoutRepeatedMoment = trimmedPreview;

  if (formattedLastMessageMoment) {
    const normalizedPreview = trimmedPreview.toLowerCase();
    const normalizedMoment = formattedLastMessageMoment.toLowerCase();

    if (normalizedPreview.endsWith(normalizedMoment)) {
      const baseLength = trimmedPreview.length - formattedLastMessageMoment.length;
      const truncated = trimmedPreview.slice(0, baseLength).trimEnd();
      withoutRepeatedMoment = truncated.replace(/(?:[•·:;,-]+\s*)+$/u, '').trimEnd();
    }
  }

  const normalizedPreviewWithoutMoment = withoutRepeatedMoment.trim();
  if (!normalizedPreviewWithoutMoment) {
    return CHAT_PREVIEW_FALLBACK_TEXT;
  }

  const normalizedDisplayName = toNonEmptyString(displayName)?.toLowerCase() ?? null;
  const normalizedPhone = toNonEmptyString(chat.phone)?.toLowerCase() ?? null;
  const normalizedPreviewLower = normalizedPreviewWithoutMoment.toLowerCase();

  if (
    (normalizedDisplayName && normalizedPreviewLower === normalizedDisplayName) ||
    (normalizedPhone && normalizedPreviewLower === normalizedPhone)
  ) {
    return CHAT_PREVIEW_FALLBACK_TEXT;
  }

  return withoutRepeatedMoment;
};

const getChatDisplayName = (chat: WhatsappChat): string => {
  const normalizedDisplayName = toNonEmptyString(chat.display_name);
  if (normalizedDisplayName) {
    return normalizedDisplayName;
  }

  const normalizedChatName = toNonEmptyString(chat.chat_name);
  if (normalizedChatName) {
    return normalizedChatName;
  }

  const normalizedPhone = toNonEmptyString(chat.phone);
  if (normalizedPhone) {
    return normalizedPhone;
  }

  return chat.phone;
};

const fetchJson: typeof fetchWhatsappJson = fetchWhatsappJson;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'text/plain': 'txt',
  'application/json': 'json',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

const extractFileExtension = (fileName: string | null | undefined): string | null => {
  if (!fileName) {
    return null;
  }

  const trimmed = fileName.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
};

const extractExtensionFromMime = (mime: string | null | undefined): string | null => {
  if (!mime) {
    return null;
  }

  const normalized = mime.toLowerCase();
  return MIME_EXTENSION_MAP[normalized] ?? null;
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Não foi possível ler o arquivo selecionado.'));
      }
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Erro ao ler o arquivo selecionado.'));
    };

    reader.readAsDataURL(file);
  });
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Não foi possível ler os dados do áudio.'));
      }
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Erro ao ler os dados do áudio.'));
    };

    reader.readAsDataURL(blob);
  });
};

const getAudioDurationFromBlob = (blob: Blob): Promise<number | null> => {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const audioElement = document.createElement('audio');
    audioElement.preload = 'metadata';
    audioElement.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    audioElement.onloadedmetadata = () => {
      const duration = Number.isFinite(audioElement.duration)
        ? Math.max(audioElement.duration, 0)
        : null;
      cleanup();
      resolve(duration);
    };

    audioElement.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
};

const getPreferredAudioMimeType = (): string | null => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const candidates = [
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mpeg',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];

  for (const candidate of candidates) {
    if ((MediaRecorder as typeof MediaRecorder).isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return null;
};

type AudioContextConstructor = typeof AudioContext;

const getAudioContextConstructor = (): AudioContextConstructor | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const ctor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

  return ctor ?? null;
};

const ensureAudioBlobPreferredFormat = async (
  blob: Blob,
): Promise<{ blob: Blob; mimeType: string }> => {
  const targetMimeType = 'audio/mpeg';
  const unsupportedMessage =
    'A conversão de áudio para MP3 não é suportada neste navegador.';

  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error(unsupportedMessage);
  }

  if (!(MediaRecorder as typeof MediaRecorder).isTypeSupported(targetMimeType)) {
    throw new Error(unsupportedMessage);
  }

  const AudioContextCtor = getAudioContextConstructor();

  if (!AudioContextCtor) {
    throw new Error(unsupportedMessage);
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextCtor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => undefined);
    }

    const destination = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);

    const recordedChunks: Blob[] = [];

    const convertedBlob = await new Promise<Blob>((resolve, reject) => {
      let recorder: MediaRecorder;

      try {
        recorder = new MediaRecorder(destination.stream, { mimeType: targetMimeType });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      const handleError = (event: Event & { error?: DOMException | null }) => {
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // Ignore additional stop errors.
          }
        }
        reject(event.error ?? new Error('Erro ao converter áudio.'));
      };

      recorder.addEventListener('dataavailable', event => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      });

      recorder.addEventListener('error', handleError);

      recorder.addEventListener('stop', () => {
        if (recordedChunks.length === 0) {
          reject(new Error('Nenhum áudio foi gerado durante a conversão.'));
          return;
        }
        resolve(new Blob(recordedChunks, { type: targetMimeType }));
      });

      recorder.start();
      source.start();

      source.addEventListener('ended', () => {
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // Ignore stop errors; conversion will fail gracefully.
          }
        }
      });
    });

    return { blob: convertedBlob, mimeType: targetMimeType };
  } catch (_error) {
    throw new Error('Não foi possível converter o áudio gravado para MP3.');
  } finally {
    audioContext.close().catch(() => undefined);
  }
};

const formatSecondsLabel = (value: number): string => {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const sortMessagesByMoment = <T extends { moment: string | null }>(messageList: T[]) => {
  return [...messageList].sort((first, second) => {
    const firstMoment = first.moment ? new Date(first.moment).getTime() : 0;
    const secondMoment = second.moment ? new Date(second.moment).getTime() : 0;

    const safeFirstMoment = Number.isNaN(firstMoment) ? 0 : firstMoment;
    const safeSecondMoment = Number.isNaN(secondMoment) ? 0 : secondMoment;

    return safeFirstMoment - safeSecondMoment;
  });
};

const mergeMessageRecords = (
  current: OptimisticMessage,
  incoming: OptimisticMessage,
): OptimisticMessage => {
  const resolvedRawPayload =
    incoming.raw_payload !== undefined && incoming.raw_payload !== null
      ? incoming.raw_payload
      : current.raw_payload ?? null;

  return {
    ...current,
    ...incoming,
    id: incoming.id,
    message_id: incoming.message_id ?? current.message_id ?? null,
    text: incoming.text ?? current.text ?? null,
    status: incoming.status ?? current.status ?? null,
    moment: incoming.moment ?? current.moment ?? null,
    raw_payload: resolvedRawPayload,
    isOptimistic: incoming.isOptimistic ?? current.isOptimistic ?? false,
  };
};

const mergeMessageIntoList = (
  messages: OptimisticMessage[],
  incoming: OptimisticMessage,
): OptimisticMessage[] => {
  const byIdIndex = messages.findIndex(message => message.id === incoming.id);
  if (byIdIndex !== -1) {
    const updated = [...messages];
    updated[byIdIndex] = mergeMessageRecords(messages[byIdIndex], incoming);
    return updated;
  }

  if (incoming.message_id) {
    const byMessageIdIndex = messages.findIndex(
      message => message.message_id && message.message_id === incoming.message_id,
    );

    if (byMessageIdIndex !== -1) {
      const updated = [...messages];
      updated[byMessageIdIndex] = mergeMessageRecords(messages[byMessageIdIndex], incoming);
      return updated;
    }
  }

  return [...messages, incoming];
};

const dedupeMessagesByMessageId = (messages: OptimisticMessage[]) => {
  return messages.reduce<OptimisticMessage[]>((accumulator, message) => {
    return mergeMessageIntoList(accumulator, message);
  }, []);
};

export default function WhatsappPage() {
  const missingEnvVars = getMissingWhatsappEnvVars();

  if (missingEnvVars.length > 0) {
    return (
      <div className="flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 text-yellow-600" />
            <div>
              <h1 className="text-lg font-semibold">Configuração necessária</h1>
              <p className="mt-2 text-sm">
                Para usar a aba de WhatsApp é preciso configurar as seguintes variáveis de ambiente no
                <code className="mx-1 rounded bg-yellow-100 px-1 py-0.5 text-xs">.env.local</code> (consulte o
                README):
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {missingEnvVars.map(variable => (
                  <li key={variable}>
                    <code className="rounded bg-yellow-100 px-1 py-0.5 text-xs">{variable}</code>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm">
                Copie <code className="rounded bg-yellow-100 px-1 py-0.5 text-xs">.env.example</code> para
                <code className="mx-1 rounded bg-yellow-100 px-1 py-0.5 text-xs">.env.local</code>, preencha os
                valores do seu projeto Supabase e reinicie o servidor de desenvolvimento.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [chats, setChats] = useState<WhatsappChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(false);
  const [quickRepliesError, setQuickRepliesError] = useState<string | null>(null);
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<WhatsappScheduledMessage[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<WhatsappScheduledMessage[]>([]);
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false);
  const [scheduledSendAt, setScheduledSendAt] = useState('');
  const [scheduleValidationError, setScheduleValidationError] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveformValues, setWaveformValues] = useState<number[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [schedulingMessage, setSchedulingMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chatActionLoading, setChatActionLoading] = useState<Record<string, boolean>>({});
  const [showChatListMobile, setShowChatListMobile] = useState(true);
  const [activeSection, setActiveSection] = useState<WhatsappSectionId>('painel');
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showChatActionsMenu, setShowChatActionsMenu] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const previousChatIdRef = useRef<string | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  const messageSearchInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messageElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [quickRepliesMenuOpen, setQuickRepliesMenuOpen] = useState(false);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTab, setNewChatTab] = useState<'contacts' | 'leads' | 'manual'>('contacts');
  const [contacts, setContacts] = useState<WhatsappContactListEntry[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [manualPhoneInput, setManualPhoneInput] = useState('');
  const [startingConversation, setStartingConversation] = useState(false);
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [showCampaignDrawer, setShowCampaignDrawer] = useState(false);
  const [updatingLeadStatus, setUpdatingLeadStatus] = useState(false);
  const [reactionDetailsMessageId, setReactionDetailsMessageId] = useState<string | null>(null);
  const [chatInsight, setChatInsight] = useState<WhatsappChatInsight | null>(null);
  const [chatInsightStatus, setChatInsightStatus] = useState<WhatsappChatInsightStatus>('idle');
  const [chatInsightError, setChatInsightError] = useState<string | null>(null);
  const [audioTranscriptions, setAudioTranscriptions] = useState<
    Record<string, AudioTranscriptionState>
  >({});
  const reactionDetailsPopoverRef = useRef<HTMLDivElement | null>(null);
  const [cancellingScheduleIds, setCancellingScheduleIds] = useState<Record<string, boolean>>({});
  const [reorderingScheduleIds, setReorderingScheduleIds] = useState<Record<string, boolean>>({});
  const [upcomingSchedulesLoading, setUpcomingSchedulesLoading] = useState(false);
  const [scheduleSummary, setScheduleSummary] = useState<WhatsappScheduledMessagesPeriodSummary[]>([]);
  const [scheduleSummaryLoading, setScheduleSummaryLoading] = useState(false);
  const [schedulePanelError, setSchedulePanelError] = useState<string | null>(null);
  const upcomingSchedulesRef = useRef<WhatsappScheduledMessage[]>([]);
  const [slashCommandState, setSlashCommandState] = useState<
    { query: string; start: number; end: number } | null
  >(null);
  const [slashSuggestionIndex, setSlashSuggestionIndex] = useState(0);

  const normalizeQuickReplySearchText = useCallback((value: string) => {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }, []);

  const slashCommandSuggestions = useMemo(() => {
    if (!slashCommandState) {
      return [] as QuickReply[];
    }

    const normalizedQuery = normalizeQuickReplySearchText(slashCommandState.query);
    const baseList =
      normalizedQuery === ''
        ? quickReplies
        : quickReplies.filter(reply => {
            const labelSource = reply.title?.trim() || reply.text;
            const normalizedLabel = normalizeQuickReplySearchText(labelSource);
            return normalizedLabel.startsWith(normalizedQuery);
          });

    return baseList.slice(0, 5);
  }, [normalizeQuickReplySearchText, quickReplies, slashCommandState]);

  useEffect(() => {
    if (!slashCommandState) {
      setSlashSuggestionIndex(0);
      return;
    }

    if (slashCommandSuggestions.length === 0) {
      setSlashSuggestionIndex(0);
      return;
    }

    if (slashSuggestionIndex >= slashCommandSuggestions.length) {
      setSlashSuggestionIndex(0);
    }
  }, [slashCommandState, slashCommandSuggestions, slashSuggestionIndex]);

  const { leadStatuses } = useConfig();
  const activeLeadStatuses = useMemo(
    () => leadStatuses.filter(status => status.ativo),
    [leadStatuses],
  );

  const selectedChat = useMemo(
    () => chats.find(chat => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const selectedChatLead = selectedChat?.crm_lead ?? null;
  const selectedChatContracts = selectedChat?.crm_contracts ?? [];
  const selectedChatFinancialSummary = selectedChat?.crm_financial_summary ?? null;

  const selectedChatDisplayName = useMemo(
    () => (selectedChat ? getChatDisplayName(selectedChat) : ''),
    [selectedChat],
  );

  const selectedChatIsArchived = selectedChat?.is_archived ?? false;
  const selectedChatIsPinned = selectedChat?.is_pinned ?? false;

  const fetchLatestInsight = useCallback(async (chatId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_chat_insights')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<WhatsappChatInsight>();

    if (error) {
      throw error;
    }

    return data ?? null;
  }, []);

  const loadInsightForChat = useCallback(
    async (chatId: string, options?: LoadInsightOptions) => {
      setChatInsightStatus('loading');
      setChatInsightError(null);

      try {
        const insight = await fetchLatestInsight(chatId);
        if (options?.cancelled?.()) {
          return;
        }
        setChatInsight(insight);
        setChatInsightStatus('success');
      } catch (error) {
        if (options?.cancelled?.()) {
          return;
        }
        setChatInsightStatus('error');
        setChatInsightError(
          error instanceof Error ? error.message : 'Erro ao carregar insight.',
        );
      }
    },
    [fetchLatestInsight],
  );

  const handleRetryLoadInsight = useCallback(() => {
    if (!selectedChatId) {
      return;
    }

    void loadInsightForChat(selectedChatId);
  }, [loadInsightForChat, selectedChatId]);

  const stopWaveformAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const resetAudioResources = useCallback(() => {
    stopWaveformAnimation();
    stopDurationTimer();

    audioChunksRef.current = [];
    recordingStartRef.current = null;

    if (analyserNodeRef.current) {
      analyserNodeRef.current.disconnect();
      analyserNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (error) {
        console.warn('Falha ao desconectar fonte de áudio:', error);
      }
      sourceNodeRef.current = null;
    }

    const stream = audioStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          console.warn('Falha ao encerrar trilha de áudio:', error);
        }
      });
      audioStreamRef.current = null;
    }

    const audioContext = audioContextRef.current;
    if (audioContext) {
      audioContext.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    mediaRecorderRef.current = null;
  }, [stopDurationTimer, stopWaveformAnimation]);

  const sortQuickReplies = useCallback((list: QuickReply[]) => {
    return [...list].sort((first, second) => {
      const firstLabel = (first.title?.trim() || first.text).toLocaleLowerCase('pt-BR');
      const secondLabel = (second.title?.trim() || second.text).toLocaleLowerCase('pt-BR');
      return firstLabel.localeCompare(secondLabel, 'pt-BR');
    });
  }, []);

  const loadQuickReplies = useCallback(async () => {
    setQuickRepliesLoading(true);
    setQuickRepliesError(null);

    try {
      const { data, error } = await supabase
        .from('whatsapp_quick_replies')
        .select('id, title, text, created_at, updated_at')
        .order('title', { ascending: true })
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      setQuickReplies(sortQuickReplies((data ?? []) as QuickReply[]));
    } catch (loadError) {
      console.error('Falha ao carregar respostas rápidas:', loadError);
      setQuickReplies([]);
      setQuickRepliesError('Não foi possível carregar as respostas rápidas.');
    } finally {
      setQuickRepliesLoading(false);
    }
  }, [sortQuickReplies]);

  useEffect(() => {
    void loadQuickReplies();
  }, [loadQuickReplies]);

  useEffect(() => {
    if (selectedQuickReplyId && !quickReplies.some(reply => reply.id === selectedQuickReplyId)) {
      setSelectedQuickReplyId(null);
    }
  }, [quickReplies, selectedQuickReplyId]);

  const handleCreateQuickReply = useCallback(
    async ({ title, text }: { title: string; text: string }) => {
      const trimmedTitle = title.trim();
      const payload = {
        title: trimmedTitle === '' ? null : trimmedTitle,
        text: text.trim(),
      };

      try {
        setQuickRepliesError(null);
        const { data, error } = await supabase
          .from('whatsapp_quick_replies')
          .insert(payload)
          .select('id, title, text, created_at, updated_at')
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const inserted = data as QuickReply;
          setQuickReplies(previous => sortQuickReplies([...previous, inserted]));
        }
      } catch (createError) {
        console.error('Falha ao criar resposta rápida:', createError);
        setQuickRepliesError('Não foi possível salvar a resposta rápida.');
        throw createError;
      }
    },
    [sortQuickReplies],
  );

  const handleUpdateQuickReply = useCallback(
    async (id: string, { title, text }: { title: string; text: string }) => {
      const trimmedTitle = title.trim();
      const payload = {
        title: trimmedTitle === '' ? null : trimmedTitle,
        text: text.trim(),
      };

      try {
        setQuickRepliesError(null);
        const { data, error } = await supabase
          .from('whatsapp_quick_replies')
          .update(payload)
          .eq('id', id)
          .select('id, title, text, created_at, updated_at')
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const updated = data as QuickReply;
          setQuickReplies(previous =>
            sortQuickReplies(previous.map(reply => (reply.id === id ? updated : reply))),
          );

          if (selectedQuickReplyId === id) {
            setMessageInput(updated.text);
          }
        }
      } catch (updateError) {
        console.error('Falha ao atualizar resposta rápida:', updateError);
        setQuickRepliesError('Não foi possível atualizar a resposta rápida.');
        throw updateError;
      }
    },
    [selectedQuickReplyId, sortQuickReplies],
  );

  const handleQuickReplySelect = useCallback((reply: QuickReply) => {
    setSelectedQuickReplyId(reply.id);
    setMessageInput(reply.text);
  }, []);

  const applySlashQuickReply = useCallback(
    (reply: QuickReply) => {
      if (!slashCommandState) {
        return;
      }

      setMessageInput(previous => {
        const before = previous.slice(0, slashCommandState.start);
        const after = previous.slice(slashCommandState.end);
        const inserted = reply.text;
        const nextValue = `${before}${inserted}${after}`;
        const caretPosition = before.length + inserted.length;

        const focusTextarea = () => {
          const textarea = messageInputRef.current;
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(caretPosition, caretPosition);
          }
        };

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(focusTextarea);
        } else {
          focusTextarea();
        }

        return nextValue;
      });

      setSlashCommandState(null);
      setSlashSuggestionIndex(0);
      setSelectedQuickReplyId(null);
    },
    [messageInputRef, slashCommandState],
  );

  const handleMessageInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!slashCommandState) {
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (slashCommandSuggestions.length === 0) {
          return;
        }

        event.preventDefault();
        const count = slashCommandSuggestions.length;
        setSlashSuggestionIndex(previous => {
          if (event.key === 'ArrowDown') {
            return (previous + 1) % count;
          }
          return (previous - 1 + count) % count;
        });
        return;
      }

      if (event.key === 'Enter') {
        const selectedSuggestion = slashCommandSuggestions[slashSuggestionIndex];
        if (selectedSuggestion) {
          event.preventDefault();
          applySlashQuickReply(selectedSuggestion);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setSlashCommandState(null);
        setSlashSuggestionIndex(0);
      }
    },
    [applySlashQuickReply, slashCommandState, slashCommandSuggestions, slashSuggestionIndex],
  );

  const handleMessageInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = event.target;
      setMessageInput(value);

      if (selectedQuickReplyId) {
        const selectedReply = quickReplies.find(reply => reply.id === selectedQuickReplyId);
        if (!selectedReply || selectedReply.text !== value) {
          setSelectedQuickReplyId(null);
        }
      }

      const caretIndex = event.target.selectionStart ?? value.length;
      const textUntilCaret = value.slice(0, caretIndex);
      const slashMatch = textUntilCaret.match(/(?:^|\s)\/([^\s/]*)$/);

      if (slashMatch) {
        const queryBeforeCaret = slashMatch[1] ?? '';
        const slashStartIndex = caretIndex - queryBeforeCaret.length - 1;
        const remainingText = value.slice(caretIndex);
        const trailingMatch = remainingText.match(/^([^\s/]*)/);
        const trailingText = trailingMatch?.[1] ?? '';
        const completeQuery = `${queryBeforeCaret}${trailingText}`;
        const endIndex = caretIndex + trailingText.length;

        setSlashCommandState({
          query: completeQuery,
          start: slashStartIndex,
          end: endIndex,
        });
        setSlashSuggestionIndex(0);
      } else if (slashCommandState) {
        setSlashCommandState(null);
        setSlashSuggestionIndex(0);
      }
    },
    [quickReplies, selectedQuickReplyId, slashCommandState],
  );

  const resetAudioUiState = useCallback(() => {
    setIsRecordingAudio(false);
    setRecordingDuration(0);
    setWaveformValues([]);
  }, []);

  const stopAudioRecording = useCallback(
    async ({ shouldSave }: { shouldSave: boolean }) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder) {
        resetAudioResources();
        resetAudioUiState();
        if (shouldSave) {
          setErrorMessage('Não foi possível finalizar a gravação de áudio.');
        }
        return;
      }

      await new Promise<void>(resolve => {
        const handleStop = async () => {
          recorder.removeEventListener('stop', handleStop);
          const recordedChunks = audioChunksRef.current.slice();
          const approximateDuration = recordingDuration;

          resetAudioResources();
          resetAudioUiState();

          if (shouldSave) {
            if (recordedChunks.length === 0) {
              setErrorMessage('Nenhum áudio foi capturado durante a gravação.');
              resolve();
              return;
            }

            const audioBlob = new Blob(recordedChunks, {
              type: recorder.mimeType || getPreferredAudioMimeType() || 'audio/webm',
            });

            try {
              const preferredAudio = await ensureAudioBlobPreferredFormat(audioBlob);
              const normalizedMimeType = 'audio/mpeg';

              if (!preferredAudio.mimeType.toLowerCase().startsWith(normalizedMimeType)) {
                throw new Error('O áudio gravado não pôde ser convertido para MP3.');
              }

              const normalizedBlob =
                preferredAudio.blob.type === normalizedMimeType
                  ? preferredAudio.blob
                  : new Blob([preferredAudio.blob], { type: normalizedMimeType });
              const [dataUrl, detectedDuration] = await Promise.all([
                readBlobAsDataUrl(normalizedBlob),
                getAudioDurationFromBlob(normalizedBlob),
              ]);

              const resolvedDuration =
                detectedDuration !== null
                  ? detectedDuration
                  : Number.isFinite(approximateDuration)
                    ? approximateDuration
                    : null;

              setPendingAttachment({
                kind: 'audio',
                dataUrl,
                durationSeconds: resolvedDuration,
                mimeType: normalizedMimeType,
              });
            } catch (error) {
              console.error('Erro ao preparar áudio gravado para envio:', error);
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : 'Não foi possível converter o áudio gravado para MP3.',
              );
            }
          }

          resolve();
        };

        recorder.addEventListener('stop', handleStop);

        try {
          recorder.stop();
        } catch (error) {
          recorder.removeEventListener('stop', handleStop);
          console.error('Erro ao finalizar a gravação de áudio:', error);
          resetAudioResources();
          resetAudioUiState();
          if (shouldSave) {
            setErrorMessage('Não foi possível finalizar a gravação de áudio.');
          }
          resolve();
        }
      });
    },
    [
      recordingDuration,
      resetAudioResources,
      resetAudioUiState,
      setErrorMessage,
      setPendingAttachment,
    ],
  );

  const handleStartAudioRecording = useCallback(async () => {
    if (sendingMessage || schedulingMessage || isRecordingAudio) {
      return;
    }

    if (!selectedChat) {
      setErrorMessage('Selecione uma conversa antes de gravar áudios.');
      return;
    }

    if (pendingAttachment) {
      setErrorMessage('Finalize ou remova o anexo atual antes de gravar um áudio.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Seu navegador não suporta captura de áudio.');
      return;
    }

    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      setErrorMessage('A gravação de áudio com conversão para MP3 não é suportada neste navegador.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const preferredMimeType = getPreferredAudioMimeType();
      const recorderOptions = preferredMimeType ? { mimeType: preferredMimeType } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      audioChunksRef.current = [];

      recorder.addEventListener('dataavailable', event => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('error', event => {
        console.error('Erro durante a gravação de áudio:', event);
        setErrorMessage('Ocorreu um erro durante a gravação de áudio.');
      });

      mediaRecorderRef.current = recorder;

      const AudioContextCtor =
        window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioContextCtor) {
        try {
          const audioContext = new AudioContextCtor();
          audioContextRef.current = audioContext;
          const sourceNode = audioContext.createMediaStreamSource(stream);
          sourceNodeRef.current = sourceNode;
          const analyserNode = audioContext.createAnalyser();
          analyserNode.fftSize = 512;
          analyserNodeRef.current = analyserNode;
          sourceNode.connect(analyserNode);

          const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
          const barCount = WAVEFORM_BAR_COUNT;

          setWaveformValues(new Array(barCount).fill(0));

          const updateWaveform = () => {
            if (!analyserNodeRef.current) {
              return;
            }

            analyserNodeRef.current.getByteTimeDomainData(dataArray);
            const chunkSize = Math.max(1, Math.floor(dataArray.length / barCount));
            const values: number[] = [];

            for (let index = 0; index < barCount; index += 1) {
              let sum = 0;
              for (let offset = 0; offset < chunkSize; offset += 1) {
                const sampleIndex = index * chunkSize + offset;
                if (sampleIndex >= dataArray.length) {
                  break;
                }
                sum += Math.abs(dataArray[sampleIndex] - 128);
              }
              const average = sum / chunkSize;
              const normalized = Math.min(average / 128, 1);
              const amplified = Math.min(normalized * WAVEFORM_SENSITIVITY, 1);
              values.push(amplified);
            }

            setWaveformValues(values);
            animationFrameRef.current = requestAnimationFrame(updateWaveform);
          };

          updateWaveform();
        } catch (error) {
          console.error('Não foi possível inicializar a visualização de áudio:', error);
          setWaveformValues([]);
        }
      }

      recordingStartRef.current = performance.now();
      stopDurationTimer();
      durationIntervalRef.current = window.setInterval(() => {
        if (recordingStartRef.current !== null) {
          const elapsedMs = performance.now() - recordingStartRef.current;
          setRecordingDuration(elapsedMs / 1000);
        }
      }, 200);

      setShowAttachmentMenu(false);
      setIsRecordingAudio(true);
      setErrorMessage(null);
      recorder.start();
    } catch (error) {
      console.error('Erro ao iniciar gravação de áudio:', error);
      resetAudioResources();
      resetAudioUiState();
      setErrorMessage('Não foi possível iniciar a gravação de áudio. Verifique as permissões do microfone.');
    }
  }, [
    isRecordingAudio,
    pendingAttachment,
    resetAudioResources,
    resetAudioUiState,
    selectedChat,
    sendingMessage,
    stopDurationTimer,
    setErrorMessage,
    setShowAttachmentMenu,
  ]);

  const handleCancelAudioRecording = useCallback(() => {
    if (!isRecordingAudio && !mediaRecorderRef.current) {
      return;
    }

    void stopAudioRecording({ shouldSave: false });
  }, [isRecordingAudio, stopAudioRecording]);

  const handleConcludeAudioRecording = useCallback(() => {
    if (!isRecordingAudio && !mediaRecorderRef.current) {
      return;
    }

    void stopAudioRecording({ shouldSave: true });
  }, [isRecordingAudio, stopAudioRecording]);

  useEffect(() => {
    return () => {
      resetAudioResources();
      resetAudioUiState();
    };
  }, [resetAudioResources, resetAudioUiState]);

  const getChatSortTimestamp = useCallback((chat: WhatsappChat) => {
    if (!chat.last_message_at) {
      return 0;
    }

    const date = new Date(chat.last_message_at);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }, []);

  const sortChatsForView = useCallback(
    (list: WhatsappChat[]): WhatsappChat[] => {
      const pinned = list.filter(chat => chat.is_pinned);
      const regular = list.filter(chat => !chat.is_pinned);
      const sorter = (a: WhatsappChat, b: WhatsappChat) =>
        getChatSortTimestamp(b) - getChatSortTimestamp(a);

      pinned.sort(sorter);
      regular.sort(sorter);

      return [...pinned, ...regular];
    },
    [getChatSortTimestamp],
  );

  const chatsByStatus = useMemo(() => {
    const active = sortChatsForView(chats.filter(chat => !chat.is_archived));
    const archived = sortChatsForView(chats.filter(chat => chat.is_archived));

    return { active, archived };
  }, [chats, sortChatsForView]);

  const archivedChatsCount = chatsByStatus.archived.length;
  const hasArchivedChats = archivedChatsCount > 0;
  const archivedToggleLabel = showArchivedChats
    ? 'Ver conversas ativas'
    : hasArchivedChats
    ? `Arquivados (${archivedChatsCount})`
    : 'Arquivados';
  const emptyChatsMessage = showArchivedChats
    ? 'Nenhuma conversa arquivada.'
    : 'Nenhuma conversa encontrada.';
  const emptySearchMessage = showArchivedChats
    ? 'Nenhuma conversa arquivada encontrada para a pesquisa.'
    : 'Nenhuma conversa encontrada para a pesquisa.';

  const filteredChats = useMemo(() => {
    const baseList = showArchivedChats ? chatsByStatus.archived : chatsByStatus.active;

    if (!chatSearchTerm.trim()) {
      return baseList;
    }

    const normalizedTerm = chatSearchTerm.trim().toLowerCase();
    return baseList.filter(chat => {
      const displayName = getChatDisplayName(chat).toLowerCase();
      const phone = chat.phone?.toLowerCase() ?? '';
      const preview = chat.last_message_preview?.toLowerCase() ?? '';

      return (
        displayName.includes(normalizedTerm) ||
        phone.includes(normalizedTerm) ||
        preview.includes(normalizedTerm)
      );
    });
  }, [chatSearchTerm, chatsByStatus, showArchivedChats]);

  const visibleChatsBase = showArchivedChats ? chatsByStatus.archived : chatsByStatus.active;

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError(null);

    try {
      const data = await fetchJson<{ contacts: WhatsappContactListEntry[] }>(
        getWhatsappFunctionUrl('/whatsapp-webhook/contacts'),
      );

      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (error) {
      console.error('Erro ao carregar contatos salvos:', error);
      setContacts([]);
      setContactsError('Não foi possível carregar os contatos salvos.');
    } finally {
      setContactsLoading(false);
      setContactsLoaded(true);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError(null);

    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, nome_completo, telefone, status, responsavel')
        .order('nome_completo', { ascending: true });

      if (error) {
        throw error;
      }

      setLeads((data as LeadSummary[] | null) ?? []);
    } catch (error) {
      console.error('Erro ao carregar leads do CRM:', error);
      setLeads([]);
      setLeadsError('Não foi possível carregar os leads do CRM.');
    } finally {
      setLeadsLoading(false);
      setLeadsLoaded(true);
    }
  }, []);

  const loadUpcomingSchedules = useCallback(async () => {
    setUpcomingSchedulesLoading(true);
    setSchedulePanelError(null);

    try {
      const { data, error } = await supabase
        .from('whatsapp_scheduled_messages')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('scheduled_send_at', { ascending: true })
        .limit(50);

      if (error) {
        throw error;
      }

      const normalized = ((data ?? []) as WhatsappScheduledMessage[]).map(entry => ({
        ...entry,
        priority_level: entry.priority_level ?? 'normal',
        priority_order: Number.isFinite(entry.priority_order ?? null)
          ? entry.priority_order ?? 0
          : 0,
      }));

      setUpcomingSchedules(sortSchedulesByUrgency(normalized));
    } catch (error) {
      console.error('Erro ao carregar próximos agendamentos do WhatsApp:', error);
      setSchedulePanelError('Não foi possível carregar os próximos agendamentos.');
    } finally {
      setUpcomingSchedulesLoading(false);
    }
  }, []);

  const loadScheduleSummary = useCallback(async () => {
    setScheduleSummaryLoading(true);
    setSchedulePanelError(null);

    try {
      const { data, error } = await supabase
        .from('whatsapp_scheduled_messages_period_summary')
        .select('*')
        .order('period_start', { ascending: true })
        .limit(24);

      if (error) {
        throw error;
      }

      setScheduleSummary((data ?? []) as WhatsappScheduledMessagesPeriodSummary[]);
    } catch (error) {
      console.error('Erro ao carregar o resumo de agendamentos do WhatsApp:', error);
      setSchedulePanelError('Não foi possível carregar o resumo dos agendamentos.');
    } finally {
      setScheduleSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showNewChatModal) {
      setNewChatError(null);
      setContactSearchTerm('');
      setLeadSearchTerm('');
      setManualPhoneInput('');
      setNewChatTab('contacts');
      return;
    }

    if (!contactsLoaded && !contactsLoading) {
      void loadContacts();
    }

    if (!leadsLoaded && !leadsLoading) {
      void loadLeads();
    }
  }, [
    showNewChatModal,
    contactsLoaded,
    contactsLoading,
    leadsLoaded,
    leadsLoading,
    loadContacts,
    loadLeads,
  ]);

  useEffect(() => {
    setShowLeadDetails(false);
  }, [selectedChatId]);

  useEffect(() => {
    setMessageSearchTerm('');
    setShowMessageSearch(false);
    setShowChatActionsMenu(false);
    messageElementsRef.current = {};
  }, [selectedChatId]);

  useEffect(() => {
    if (!showMessageSearch) {
      return;
    }

    const focusTarget = messageSearchInputRef.current;
    if (focusTarget) {
      focusTarget.focus();
      focusTarget.select();
    }
  }, [showMessageSearch]);


  useEffect(() => {
    if (!selectedChatLead) {
      setShowLeadDetails(false);
    }
  }, [selectedChatLead]);

  const filteredContactsList = useMemo(() => {
    if (!contactSearchTerm.trim()) {
      return contacts;
    }

    const normalizedTerm = removeDiacritics(contactSearchTerm.trim().toLowerCase());
    const digitsTerm = contactSearchTerm.replace(/\D+/g, '');

    return contacts.filter(contact => {
      const nameText = contact.name ? removeDiacritics(contact.name.toLowerCase()) : '';
      const rawPhone = contact.phone.toLowerCase();
      const normalizedPhone = normalizePhoneForComparison(contact.phone);

      return (
        (nameText && nameText.includes(normalizedTerm)) ||
        rawPhone.includes(contactSearchTerm.trim().toLowerCase()) ||
        (digitsTerm ? normalizedPhone.includes(digitsTerm) : false)
      );
    });
  }, [contacts, contactSearchTerm]);

  const filteredLeads = useMemo(() => {
    if (!leadSearchTerm.trim()) {
      return leads;
    }

    const normalizedTerm = removeDiacritics(leadSearchTerm.trim().toLowerCase());
    const digitsTerm = leadSearchTerm.replace(/\D+/g, '');
    const rawTermLower = leadSearchTerm.trim().toLowerCase();

    return leads.filter(lead => {
      const nameText = lead.nome_completo ? removeDiacritics(lead.nome_completo.toLowerCase()) : '';
      const statusText = lead.status ? removeDiacritics(lead.status.toLowerCase()) : '';
      const responsavelText = lead.responsavel
        ? removeDiacritics(lead.responsavel.toLowerCase())
        : '';
      const phone = lead.telefone ?? '';
      const normalizedPhone = normalizePhoneForComparison(phone);

      return (
        (nameText && nameText.includes(normalizedTerm)) ||
        (statusText && statusText.includes(normalizedTerm)) ||
        (responsavelText && responsavelText.includes(normalizedTerm)) ||
        phone.toLowerCase().includes(rawTermLower) ||
        (digitsTerm ? normalizedPhone.includes(digitsTerm) : false)
      );
    });
  }, [leads, leadSearchTerm]);

  const scheduleSummaryRows = useMemo(() => scheduleSummary.slice(0, 8), [scheduleSummary]);
  const agendaSummaryDisplayRows = useMemo(
    () =>
      scheduleSummaryRows.map(row => ({
        id: `${row.period_start}-${row.priority_level}-${row.status}`,
        periodLabel: formatPeriodRangeLabel(row.period_start, row.period_end),
        nextTimeLabel: row.next_scheduled_at ? formatShortTime(row.next_scheduled_at) : '--:--',
        priorityLabel: getPriorityLabel(row.priority_level),
        statusLabel: SCHEDULE_STATUS_LABELS[row.status],
        statusClass: SCHEDULE_STATUS_BADGE_CLASSES[row.status],
        itemCount: row.message_count,
      })),
    [scheduleSummaryRows],
  );

  const agendaUpcomingDisplay = useMemo(
    () =>
      upcomingSchedules.map((schedule, index) => ({
        id: schedule.id,
        message: schedule.message,
        scheduleTimeLabel: formatDateTime(schedule.scheduled_send_at) || 'Horário indefinido',
        statusLabel: SCHEDULE_STATUS_LABELS[schedule.status],
        statusClass: SCHEDULE_STATUS_BADGE_CLASSES[schedule.status],
        priorityLabel: getPriorityLabel(schedule.priority_level ?? 'normal'),
        lastError: schedule.last_error ?? null,
        disableUp: index === 0,
        disableDown: index === upcomingSchedules.length - 1,
        isCancelling: Boolean(cancellingScheduleIds[schedule.id]),
        isReordering: Boolean(reorderingScheduleIds[schedule.id]),
      })),
    [
      upcomingSchedules,
      cancellingScheduleIds,
      reorderingScheduleIds,
    ],
  );

  const getChatSlaBadge = useCallback((chat: WhatsappChat) => {
    const metrics: WhatsappChatSlaMetrics | null = chat.sla_metrics ?? null;
    if (!metrics) {
      return null;
    }

    const pendingCount = metrics.pending_inbound_count ?? 0;
    const status: WhatsappChatSlaMetrics['sla_status'] = metrics.sla_status ?? 'healthy';

    if (pendingCount > 0) {
      const waitingLabel = formatWaitingLabel(metrics.waiting_minutes ?? null, 'há alguns minutos');
      const label = pendingCount > 1
        ? `${pendingCount} aguardando ${waitingLabel}`
        : `Aguardando ${waitingLabel}`;

      return { status, text: label };
    }

    const lastInbound = metrics.last_inbound_at ?? metrics.last_message_at;
    const lastInboundDate = lastInbound ? new Date(lastInbound) : null;
    const minutesSinceLastInbound =
      lastInboundDate && !Number.isNaN(lastInboundDate.getTime())
        ? Math.max(0, Math.floor((Date.now() - lastInboundDate.getTime()) / 60000))
        : null;

    const healthyText = minutesSinceLastInbound !== null
      ? `Último contato ${formatWaitingLabel(minutesSinceLastInbound, 'há instantes')}`
      : 'SLA em dia';

    return { status: 'healthy' as const, text: healthyText };
  }, []);

  const selectedChatSlaBadge = useMemo(() => {
    if (!selectedChat) {
      return null;
    }

    const badge = getChatSlaBadge(selectedChat);
    if (!badge) {
      return null;
    }

    const className = SLA_STATUS_BADGE_CLASSES[badge.status] ?? SLA_STATUS_BADGE_CLASSES.healthy;
    return { ...badge, className };
  }, [getChatSlaBadge, selectedChat]);

  const insightSentimentDisplay = useMemo(() => {
    if (!chatInsight?.sentiment) {
      return null;
    }

    const key = chatInsight.sentiment as WhatsappChatInsightSentiment;
    return {
      label: SENTIMENT_BADGE_LABELS[key],
      className: SENTIMENT_BADGE_STYLES[key],
    };
  }, [chatInsight?.sentiment]);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchJson<{ chats: WhatsappChat[] }>(
        getWhatsappFunctionUrl('/whatsapp-webhook/chats'),
      );
      setChats(data.chats);
      if (!selectedChatId && data.chats.length > 0) {
        const firstActiveChat = data.chats.find(chat => !chat.is_archived) ?? data.chats[0];
        setSelectedChatId(firstActiveChat.id);
      }
    } catch (error: any) {
      console.error('Erro ao carregar chats:', error);
      setErrorMessage('Não foi possível carregar as conversas.');
    } finally {
      setChatsLoading(false);
    }
  }, [selectedChatId]);

  const updateChatFlags = useCallback(
    async (chatId: string, payload: UpdateChatFlagsPayload): Promise<WhatsappChat> => {
      const response = await fetchJson<UpdateChatFlagsResponse>(
        getWhatsappFunctionUrl(
          `/whatsapp-webhook/chats/${encodeURIComponent(chatId)}/flags`,
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!response.success || !response.chat) {
        throw new Error(response.error ?? 'Falha ao atualizar a conversa.');
      }

      return response.chat;
    },
    [],
  );

  const mergeUpdatedChat = useCallback(
    (chatId: string, updatedChat: WhatsappChat) => {
      setChats(previous =>
        previous.map(chat => {
          if (chat.id !== chatId) {
            return chat;
          }

          return {
            ...chat,
            ...updatedChat,
            display_name:
              updatedChat.display_name ?? chat.display_name ?? null,
          };
        }),
      );
    },
    [setChats],
  );

  const handleArchiveStatusChange = useCallback(
    async (chat: WhatsappChat, shouldArchive: boolean) => {
      if (chat.is_archived === shouldArchive) {
        return;
      }

      setChatActionLoading(previous => ({ ...previous, [chat.id]: true }));
      setErrorMessage(null);

      try {
        const updated = await updateChatFlags(chat.id, {
          is_archived: shouldArchive,
        });
        mergeUpdatedChat(chat.id, updated);
      } catch (error) {
        console.error('Erro ao atualizar arquivamento do chat:', error);
        setErrorMessage('Não foi possível atualizar o status da conversa.');
      } finally {
        setChatActionLoading(previous => {
          const { [chat.id]: _removed, ...rest } = previous;
          return rest;
        });
      }
    },
    [
      mergeUpdatedChat,
      setErrorMessage,
      updateChatFlags,
    ],
  );

  const handlePinStatusChange = useCallback(
    async (chat: WhatsappChat, shouldPin: boolean) => {
      if (chat.is_pinned === shouldPin) {
        return;
      }

      setChatActionLoading(previous => ({ ...previous, [chat.id]: true }));
      setErrorMessage(null);

      try {
        const updated = await updateChatFlags(chat.id, {
          is_pinned: shouldPin,
        });
        mergeUpdatedChat(chat.id, updated);
      } catch (error) {
        console.error('Erro ao atualizar fixação do chat:', error);
        setErrorMessage('Não foi possível atualizar o status da conversa.');
      } finally {
        setChatActionLoading(previous => {
          const { [chat.id]: _removed, ...rest } = previous;
          return rest;
        });
      }
    },
    [mergeUpdatedChat, setErrorMessage, updateChatFlags],
  );

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChatId) {
      setChatInsight(null);
      setChatInsightStatus('idle');
      setChatInsightError(null);
      return;
    }

    let cancelled = false;
    setChatInsight(null);
    void loadInsightForChat(selectedChatId, { cancelled: () => cancelled });

    return () => {
      cancelled = true;
    };
  }, [loadInsightForChat, selectedChatId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const previousChatId = previousChatIdRef.current;
    const chatChanged = selectedChatId !== previousChatId;

    previousChatIdRef.current = selectedChatId;

    if (!container) {
      return;
    }

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceToBottom <= 120;

    if (!chatChanged && !isNearBottom) {
      return;
    }

    requestAnimationFrame(() => {
      const target = messagesContainerRef.current;
      if (!target) {
        return;
      }

      target.scrollTop = target.scrollHeight;
    });
  }, [messages, selectedChatId]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    upcomingSchedulesRef.current = upcomingSchedules;
  }, [upcomingSchedules]);

  const ensureChat = useCallback(
    async (phone: string, chatName: string | null = null): Promise<WhatsappChat> => {
      const response = await fetchJson<{ success: boolean; chat: WhatsappChat }>(
        getWhatsappFunctionUrl('/whatsapp-webhook/ensure-chat'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, chatName }),
        },
      );

      if (!response.success || !response.chat) {
        throw new Error('Resposta inválida do servidor ao criar conversa.');
      }

      return response.chat;
    },
    [],
  );

  const handleChatLeadStatusChange = useCallback(
    async (leadId: string, newStatus: string) => {
      if (!selectedChatLead || selectedChatLead.id !== leadId) {
        return;
      }

      const normalizedNewStatus = newStatus.trim();
      const currentStatus = selectedChatLead.status ?? '';

      if (normalizedNewStatus === currentStatus.trim()) {
        return;
      }

      const previousUltimoContato = selectedChatLead.ultimo_contato ?? null;
      const nowIso = new Date().toISOString();
      const responsavel = selectedChatLead.responsavel ?? 'Sistema';

      setUpdatingLeadStatus(true);
      setChats(previousChats =>
        previousChats.map(chat => {
          if (chat.crm_lead?.id !== leadId) {
            return chat;
          }

          return {
            ...chat,
            crm_lead: {
              ...chat.crm_lead,
              status: normalizedNewStatus,
              ultimo_contato: nowIso,
            },
          };
        }),
      );

      try {
        const response = await fetchJson<UpdateLeadStatusResponse>(
          getWhatsappFunctionUrl('/whatsapp-webhook/leads/update-status'),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId,
              newStatus: normalizedNewStatus,
              responsavel,
            }),
          },
        );

        if (!response.success) {
          throw new Error(response.error ?? 'Falha ao atualizar status do lead.');
        }

        if (response.lead) {
          const { status, ultimo_contato: updatedUltimoContato, responsavel: updatedResponsavel } =
            response.lead;

          setChats(previousChats =>
            previousChats.map(chat => {
              if (chat.crm_lead?.id !== leadId) {
                return chat;
              }

              return {
                ...chat,
                crm_lead: {
                  ...chat.crm_lead,
                  status: status ?? normalizedNewStatus,
                  ultimo_contato: updatedUltimoContato ?? nowIso,
                  responsavel: updatedResponsavel ?? chat.crm_lead.responsavel ?? responsavel,
                },
              };
            }),
          );
        }
      } catch (error) {
        console.error('Erro ao atualizar status do lead via chat:', error);
        setChats(previousChats =>
          previousChats.map(chat => {
            if (chat.crm_lead?.id !== leadId) {
              return chat;
            }

            return {
              ...chat,
              crm_lead: {
                ...chat.crm_lead,
                status: currentStatus,
                ultimo_contato: previousUltimoContato,
              },
            };
          }),
        );
        throw error;
      } finally {
        setUpdatingLeadStatus(false);
      }
    },
    [selectedChatLead],
  );

  const handleChatHeaderClick = useCallback(() => {
    if (!selectedChatLead) {
      return;
    }

    setShowLeadDetails(true);
  }, [selectedChatLead]);

  const handleChatHeaderKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleChatHeaderClick();
      }
    },
    [handleChatHeaderClick],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!attachmentMenuRef.current) {
        return;
      }

      const target = event.target as Node | null;
      if (target && attachmentMenuRef.current.contains(target)) {
        return;
      }

      setShowAttachmentMenu(false);
    };

    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachmentMenu]);

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-messages-listener')
      .on<RealtimePostgresChangesPayload<WhatsappMessage>>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deletedMessage = (payload.old as WhatsappMessage | null) ?? null;
            if (!deletedMessage) {
              return;
            }

            setMessages(previousMessages => {
              const currentChatId = selectedChatIdRef.current;
              if (!currentChatId || deletedMessage.chat_id !== currentChatId) {
                return previousMessages;
              }

              return previousMessages.filter(message => message.id !== deletedMessage.id);
            });
            return;
          }

          const incomingMessage = payload.new
            ? ((payload.new as unknown) as WhatsappMessage)
            : null;
          if (!incomingMessage) {
            return;
          }

          const normalizedMessage: OptimisticMessage = {
            ...incomingMessage,
            isOptimistic: false,
          };

          setMessages(previousMessages => {
            const currentChatId = selectedChatIdRef.current;
            if (currentChatId !== normalizedMessage.chat_id) {
              return previousMessages;
            }

            const mergedMessages = mergeMessageIntoList(previousMessages, normalizedMessage);
            return sortMessagesByMoment(mergedMessages);
          });

          let chatExists = true;
          setChats(previousChats => {
            const existingIndex = previousChats.findIndex(
              chat => chat.id === normalizedMessage.chat_id,
            );

            if (existingIndex === -1) {
              chatExists = false;
              return previousChats;
            }

            const existingChat = previousChats[existingIndex];
            const updatedChat: WhatsappChat = {
              ...existingChat,
              last_message_preview:
                normalizedMessage.text ?? existingChat.last_message_preview ?? null,
              last_message_at:
                normalizedMessage.moment ?? existingChat.last_message_at ?? null,
            };

            const otherChats = previousChats.filter(chat => chat.id !== normalizedMessage.chat_id);
            return [updatedChat, ...otherChats];
          });

          if (!chatExists) {
            void loadChats();
          }
        },
      )
      .on<RealtimePostgresChangesPayload<WhatsappChatInsight>>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chat_insights' },
        payload => {
          const currentChatId = selectedChatIdRef.current;
          if (!currentChatId) {
            return;
          }

          if (payload.eventType === 'DELETE') {
            const removedInsight = (payload.old as WhatsappChatInsight | null) ?? null;
            if (removedInsight?.chat_id === currentChatId) {
              setChatInsight(null);
              setChatInsightStatus('idle');
            }
            return;
          }

          const incomingInsight = payload.new
            ? ((payload.new as unknown) as WhatsappChatInsight)
            : null;
          if (!incomingInsight || incomingInsight.chat_id !== currentChatId) {
            return;
          }

          setChatInsight(incomingInsight);
          setChatInsightStatus('success');
          setChatInsightError(null);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadChats]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setMessagesLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchJson<{ messages: WhatsappMessage[] }>(
          getWhatsappFunctionUrl(
            `/whatsapp-webhook/chats/${encodeURIComponent(selectedChatId)}/messages`,
          ),
        );
        const normalizedMessages = dedupeMessagesByMessageId(
          data.messages.map(message => ({ ...message, isOptimistic: false })),
        );
        setMessages(sortMessagesByMoment(normalizedMessages));
      } catch (error: any) {
        console.error('Erro ao carregar mensagens:', error);
        setErrorMessage('Não foi possível carregar as mensagens.');
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      setScheduledMessages([]);
      return;
    }

    let isMounted = true;

    const loadSchedules = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_scheduled_messages')
          .select('*')
          .eq('chat_id', selectedChatId)
          .order('scheduled_send_at', { ascending: true });

        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        const normalized = ((data ?? []) as WhatsappScheduledMessage[]).filter(schedule =>
          shouldDisplayScheduledMessage(schedule.status),
        );

        setScheduledMessages(sortSchedulesByMoment(normalized));
      } catch (scheduleError) {
        console.error('Erro ao carregar agendamentos do WhatsApp:', scheduleError);
      }
    };

    loadSchedules();

    return () => {
      isMounted = false;
    };
  }, [selectedChatId]);

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-schedules-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_scheduled_messages',
        },
        () => {
          void loadUpcomingSchedules();
          void loadScheduleSummary();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadScheduleSummary, loadUpcomingSchedules]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const channel = supabase
      .channel(`whatsapp-scheduled-${selectedChatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_scheduled_messages',
          filter: `chat_id=eq.${selectedChatId}`,
        },
        (payload: RealtimePostgresChangesPayload<WhatsappScheduledMessage>) => {
          const newRecord = (payload.new ?? null) as WhatsappScheduledMessage | null;
          const oldRecord = (payload.old ?? null) as WhatsappScheduledMessage | null;

          setScheduledMessages(previous => {
            let next = previous;

            if (oldRecord) {
              next = next.filter(entry => entry.id !== oldRecord.id);
            }

            if (newRecord && shouldDisplayScheduledMessage(newRecord.status)) {
              next = [...next.filter(entry => entry.id !== newRecord.id), newRecord];
            }

            return sortSchedulesByMoment(next);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChatId]);

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowChatListMobile(false);
    }
  }, []);

  const handleBackToChats = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowChatListMobile(true);
    }
  }, []);

  const handleStartConversation = useCallback(
    async (phoneInput: string, chatName?: string | null) => {
      const normalizedPhone = normalizePhoneForComparison(phoneInput);
      if (!normalizedPhone) {
        setNewChatError('Informe um telefone válido para iniciar a conversa.');
        return;
      }

      setStartingConversation(true);
      setNewChatError(null);

      try {
        const existingChat = chats.find(
          chat => normalizePhoneForComparison(chat.phone) === normalizedPhone,
        );

        let targetChat = existingChat ?? null;

        if (!targetChat) {
          const ensuredChat = await ensureChat(normalizedPhone, chatName ?? null);
          targetChat = ensuredChat;
          setChats(previous => {
            const others = previous.filter(chat => chat.id !== ensuredChat.id);
            return [ensuredChat, ...others];
          });
        } else if (chatName && chatName.trim() && chatName !== targetChat.chat_name) {
          try {
            const ensuredChat = await ensureChat(normalizedPhone, chatName);
            targetChat = ensuredChat;
            setChats(previous => {
              const others = previous.filter(chat => chat.id !== ensuredChat.id);
              return [ensuredChat, ...others];
            });
          } catch (updateError) {
            console.error('Não foi possível atualizar o nome do chat:', updateError);
          }
        }

        if (targetChat) {
          handleSelectChat(targetChat.id);
          setShowNewChatModal(false);
        }
      } catch (error) {
        console.error('Erro ao iniciar conversa:', error);
        setNewChatError('Não foi possível iniciar a conversa. Tente novamente.');
      } finally {
        setStartingConversation(false);
      }
    },
    [chats, ensureChat, handleSelectChat],
  );

  const handleManualChatSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (startingConversation) {
        return;
      }

      const normalizedManualPhone = manualPhoneInput.replace(/\D+/g, '').trim();
      if (normalizedManualPhone.length < 8) {
        setNewChatError('Informe um telefone com DDD e pelo menos 8 dígitos.');
        return;
      }

      await handleStartConversation(normalizedManualPhone);
    },
    [handleStartConversation, manualPhoneInput, startingConversation],
  );

  useEffect(() => {
    if (!selectedChatId) {
      setShowChatListMobile(true);
    }
  }, [selectedChatId]);

  useEffect(() => {
    setShowAttachmentMenu(false);
    setPendingAttachment(null);
    setReactionDetailsMessageId(null);
    setAudioTranscriptions({});
  }, [selectedChatId]);

  useEffect(() => {
    setIsScheduleEnabled(false);
    setScheduledSendAt('');
    setScheduleValidationError(null);
    setCancellingScheduleIds({});
  }, [selectedChatId]);

  useEffect(() => {
    if (sendingMessage) {
      setShowAttachmentMenu(false);
    }
  }, [sendingMessage]);

  useEffect(() => {
    if (!reactionDetailsMessageId) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        reactionDetailsPopoverRef.current &&
        !reactionDetailsPopoverRef.current.contains(target)
      ) {
        setReactionDetailsMessageId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReactionDetailsMessageId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [reactionDetailsMessageId]);

  const createOptimisticMessage = (overrides: Partial<OptimisticMessage>): OptimisticMessage => {
    if (!selectedChat) {
      throw new Error('Nenhum chat selecionado');
    }

    return {
      id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chat_id: selectedChat.id,
      message_id: null,
      from_me: true,
      status: 'SENDING',
      text: null,
      moment: new Date().toISOString(),
      raw_payload: null,
      isOptimistic: true,
      ...overrides,
    };
  };

  const sendWhatsappMessage = useCallback(
    async ({
      endpoint,
      body,
      optimisticMessage,
      errorFallback,
    }: {
      endpoint: string;
      body: Record<string, unknown>;
      optimisticMessage: OptimisticMessage;
      errorFallback?: string;
    }) => {
      const optimisticId = optimisticMessage.id;

      setMessages(previous => sortMessagesByMoment([...previous, optimisticMessage]));
      setSendingMessage(true);
      setErrorMessage(null);

      try {
        const response = await fetchJson<SendWhatsappMessageResponse>(
          getWhatsappFunctionUrl(endpoint),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );

        if (!response.success) {
          throw new Error(response.error || 'Resposta inválida do servidor');
        }

        const serverMessage: OptimisticMessage = {
          ...response.message,
          isOptimistic: false,
        };

        setMessages(previous => {
          const withoutOptimistic = previous.filter(message => message.id !== optimisticId);
          const mergedMessages = mergeMessageIntoList(withoutOptimistic, serverMessage);
          return sortMessagesByMoment(mergedMessages);
        });

        setChats(previous => {
          const updatedChat: WhatsappChat = {
            ...response.chat,
            last_message_preview:
              response.message.text ?? response.chat.last_message_preview ?? null,
            last_message_at: response.message.moment ?? response.chat.last_message_at ?? null,
          };

          const otherChats = previous.filter(chat => chat.id !== updatedChat.id);
          return [updatedChat, ...otherChats];
        });

        return true;
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        setMessages(previous => previous.filter(message => message.id !== optimisticId));
        setErrorMessage(errorFallback ?? 'Não foi possível enviar a mensagem.');
        return false;
      } finally {
        setSendingMessage(false);
      }
    },
    [setChats],
  );

  const requestAudioTranscription = useCallback(async (messageId: string, audioUrl: string) => {
    if (!messageId || !audioUrl) {
      return;
    }

    let shouldSkip = false;
    setAudioTranscriptions(previous => {
      const current = previous[messageId];
      if (current?.status === 'loading') {
        shouldSkip = true;
        return previous;
      }

      return {
        ...previous,
        [messageId]: {
          status: 'loading',
          text: current?.text ?? null,
          error: null,
        },
      };
    });

    if (shouldSkip) {
      return;
    }

    try {
      const response = await fetchJson<TranscribeAudioResponse>(
        getWhatsappFunctionUrl('/whatsapp-webhook/transcribe-audio'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl }),
        },
      );

      const transcription = response.transcription?.trim();
      if (!response.success || !transcription) {
        throw new Error(response.error || 'Não foi possível transcrever o áudio.');
      }

      setAudioTranscriptions(previous => ({
        ...previous,
        [messageId]: {
          status: 'success',
          text: transcription,
          error: null,
        },
      }));
    } catch (error) {
      const fallbackMessage =
        error instanceof Error ? error.message : 'Não foi possível transcrever o áudio.';
      setAudioTranscriptions(previous => ({
        ...previous,
        [messageId]: {
          status: 'error',
          text: null,
          error: fallbackMessage,
        },
      }));
    }
  }, []);

  const sendPendingAttachment = async (
    attachment: PendingAttachment,
    caption: string,
  ): Promise<SendAttachmentResult> => {
    if (!selectedChat) {
      return { wasSent: false };
    }

    const normalizedCaption = caption.trim();
    const captionOrNull = normalizedCaption.length > 0 ? normalizedCaption : null;

    if (attachment.kind === 'audio') {
      const previewText = captionOrNull ?? '🎤 Áudio enviado';
      const optimisticMessage = createOptimisticMessage({
        text: previewText,
        raw_payload: {
          audio: {
            audioUrl: attachment.dataUrl,
            seconds: attachment.durationSeconds ?? null,
            ptt: true,
          },
        },
      });

      const body: Record<string, unknown> = {
        phone: selectedChat.phone,
        audio: attachment.dataUrl,
        viewOnce: false,
        waveform: true,
      };

      const audioWasSent = await sendWhatsappMessage({
        endpoint: '/whatsapp-webhook/send-audio',
        body,
        optimisticMessage,
        errorFallback: 'Não foi possível enviar o áudio.',
      });

      if (!audioWasSent) {
        return { wasSent: false };
      }

      if (captionOrNull) {
        const textOptimisticMessage = createOptimisticMessage({ text: captionOrNull });
        const textWasSent = await sendWhatsappMessage({
          endpoint: '/whatsapp-webhook/send-message',
          body: { phone: selectedChat.phone, message: captionOrNull },
          optimisticMessage: textOptimisticMessage,
          errorFallback: 'Não foi possível enviar a mensagem.',
        });

        if (!textWasSent) {
          return { wasSent: true, preserveCaption: true, captionValue: captionOrNull };
        }
      }

      return { wasSent: true };
    }

    if (attachment.kind === 'document') {
      const fileName = attachment.fileName?.trim() || null;
      const previewText = captionOrNull ?? (fileName ? `📄 ${fileName}` : '📄 Documento enviado');
      const optimisticMessage = createOptimisticMessage({
        text: previewText,
        raw_payload: {
          document: {
            documentUrl: attachment.dataUrl,
            fileName,
            title: fileName,
            caption: captionOrNull,
          },
        },
      });

      const body: Record<string, unknown> = {
        phone: selectedChat.phone,
        document: attachment.dataUrl,
        extension: attachment.extension,
      };

      if (fileName) {
        body.fileName = fileName;
      }

      if (captionOrNull) {
        body.caption = captionOrNull;
      }

      const wasSent = await sendWhatsappMessage({
        endpoint: '/whatsapp-webhook/send-document',
        body,
        optimisticMessage,
        errorFallback: 'Não foi possível enviar o documento.',
      });

      return { wasSent };
    }

    if (attachment.kind === 'image') {
      const fileName = attachment.fileName?.trim() || null;
      const previewText = captionOrNull ?? (fileName ? `🖼️ ${fileName}` : '🖼️ Imagem enviada');
      const optimisticMessage = createOptimisticMessage({
        text: previewText,
        raw_payload: {
          image: {
            imageUrl: attachment.dataUrl,
            caption: captionOrNull,
          },
        },
      });

      const body: Record<string, unknown> = {
        phone: selectedChat.phone,
        image: attachment.dataUrl,
      };

      if (captionOrNull) {
        body.caption = captionOrNull;
      }

      const wasSent = await sendWhatsappMessage({
        endpoint: '/whatsapp-webhook/send-image',
        body,
        optimisticMessage,
        errorFallback: 'Não foi possível enviar a imagem.',
      });

      return { wasSent };
    }

    const fileName = attachment.fileName?.trim() || null;
    const previewText = captionOrNull ?? (fileName ? `🎬 ${fileName}` : '🎬 Vídeo enviado');
    const optimisticMessage = createOptimisticMessage({
      text: previewText,
      raw_payload: {
        video: {
          videoUrl: attachment.dataUrl,
          caption: captionOrNull,
        },
      },
    });

    const body: Record<string, unknown> = {
      phone: selectedChat.phone,
      video: attachment.dataUrl,
    };

    if (captionOrNull) {
      body.caption = captionOrNull;
    }

    const wasSent = await sendWhatsappMessage({
      endpoint: '/whatsapp-webhook/send-video',
      body,
      optimisticMessage,
      errorFallback: 'Não foi possível enviar o vídeo.',
    });

    return { wasSent };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChat || sendingMessage || schedulingMessage || isRecordingAudio) {
      return;
    }

    const shouldScheduleMessage = isScheduleEnabled && scheduledSendAt.trim().length > 0;

    if (pendingAttachment) {
      if (shouldScheduleMessage) {
        setErrorMessage('Não é possível agendar mensagens com anexos.');
        return;
      }

      const result = await sendPendingAttachment(pendingAttachment, messageInput);
      if (result.wasSent) {
        setPendingAttachment(null);
        if (result.preserveCaption) {
          setMessageInput(result.captionValue ?? '');
        } else {
          setMessageInput('');
        }
      }
      return;
    }

    const trimmedMessage = messageInput.trim();
    if (trimmedMessage.length === 0) {
      if (shouldScheduleMessage) {
        setScheduleValidationError('Informe uma mensagem para agendar.');
      }
      return;
    }

    if (shouldScheduleMessage) {
      setScheduleValidationError(null);

      const normalizedIso = convertLocalToUTC(scheduledSendAt);
      const scheduledDate = normalizedIso ? new Date(normalizedIso) : null;

      if (!normalizedIso || !scheduledDate || Number.isNaN(scheduledDate.getTime())) {
        setScheduleValidationError('Informe uma data e hora válidas.');
        return;
      }

      const now = Date.now();
      if (scheduledDate.getTime() <= now + 60 * 1000) {
        setScheduleValidationError('Escolha um horário pelo menos 1 minuto no futuro.');
        return;
      }

      setSchedulingMessage(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('whatsapp_scheduled_messages')
          .insert({
            chat_id: selectedChat.id,
            phone: selectedChat.phone,
            message: trimmedMessage,
            scheduled_send_at: normalizedIso,
            status: 'pending',
          })
          .select('*')
          .single<WhatsappScheduledMessage>();

        if (error) {
          throw error;
        }

        const inserted = data as WhatsappScheduledMessage | null;

        if (inserted && shouldDisplayScheduledMessage(inserted.status)) {
          setScheduledMessages(previous =>
            sortSchedulesByMoment([
              ...previous.filter(entry => entry.id !== inserted.id),
              inserted,
            ]),
          );
        }

        setMessageInput('');
        setScheduledSendAt('');
        setIsScheduleEnabled(false);
      } catch (scheduleError) {
        console.error('Erro ao agendar mensagem do WhatsApp:', scheduleError);
        setErrorMessage('Não foi possível agendar a mensagem.');
      } finally {
        setSchedulingMessage(false);
      }

      return;
    }

    setScheduleValidationError(null);
    const optimisticMessage = createOptimisticMessage({ text: trimmedMessage });
    setMessageInput('');

    setErrorMessage(null);
    const wasSent = await sendWhatsappMessage({
      endpoint: '/whatsapp-webhook/send-message',
      body: { phone: selectedChat.phone, message: trimmedMessage },
      optimisticMessage,
      errorFallback: 'Não foi possível enviar a mensagem.',
    });

    if (!wasSent) {
      setMessageInput(trimmedMessage);
    }
  };

  const handleCancelScheduledMessage = useCallback(async (scheduleId: string) => {
    if (!scheduleId) {
      return;
    }

    setCancellingScheduleIds(previous => ({ ...previous, [scheduleId]: true }));
    setErrorMessage(null);

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('whatsapp_scheduled_messages')
        .update({
          status: 'cancelled',
          cancelled_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', scheduleId)
        .in('status', ['pending', 'processing']);

      if (error) {
        throw error;
      }

      setUpcomingSchedules(previous => previous.filter(entry => entry.id !== scheduleId));
    } catch (cancelError) {
      console.error('Erro ao cancelar agendamento do WhatsApp:', cancelError);
      setErrorMessage('Não foi possível cancelar o agendamento.');
    } finally {
      setCancellingScheduleIds(previous => {
        const next = { ...previous };
        delete next[scheduleId];
        return next;
      });
    }
  }, []);

  const handleReorderUpcomingSchedule = useCallback(
    async (scheduleId: string, direction: 'up' | 'down') => {
      if (!scheduleId) {
        return;
      }

      setReorderingScheduleIds(previous => ({ ...previous, [scheduleId]: true }));
      setSchedulePanelError(null);

      const currentList = upcomingSchedulesRef.current;
      const currentIndex = currentList.findIndex(schedule => schedule.id === scheduleId);

      if (currentIndex === -1) {
        setReorderingScheduleIds(previous => {
          const next = { ...previous };
          delete next[scheduleId];
          return next;
        });
        return;
      }

      const targetIndex =
        direction === 'up'
          ? Math.max(0, currentIndex - 1)
          : Math.min(currentList.length - 1, currentIndex + 1);

      if (targetIndex === currentIndex) {
        setReorderingScheduleIds(previous => {
          const next = { ...previous };
          delete next[scheduleId];
          return next;
        });
        return;
      }

      const reordered = [...currentList];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const normalized = reordered.map((entry, index) => ({
        ...entry,
        priority_order: index,
      }));

      setUpcomingSchedules(normalized);

      try {
        const payload = normalized.map(entry => ({
          id: entry.id,
          priority_order: entry.priority_order ?? 0,
        }));

        const { error } = await supabase
          .from('whatsapp_scheduled_messages')
          .upsert(payload);

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error('Erro ao reordenar agendamentos do WhatsApp:', error);
        setSchedulePanelError('Não foi possível reordenar os agendamentos.');
        await loadUpcomingSchedules();
      } finally {
        setReorderingScheduleIds(previous => {
          const next = { ...previous };
          delete next[scheduleId];
          return next;
        });
      }
    },
    [loadUpcomingSchedules],
  );

  const toggleAttachmentMenu = () => {
    if (sendingMessage || schedulingMessage || isRecordingAudio) {
      return;
    }

    setShowChatActionsMenu(false);
    setQuickRepliesMenuOpen(false);
    setShowAttachmentMenu(previous => !previous);
  };

  const handleQuickRepliesMenuOpenChange = (nextOpen: boolean) => {
    setQuickRepliesMenuOpen(nextOpen);
    if (nextOpen) {
      setShowAttachmentMenu(false);
      setShowChatActionsMenu(false);
    }
  };

  const openDocumentPicker = () => {
    if (sendingMessage || schedulingMessage || isRecordingAudio) {
      return;
    }

    setShowAttachmentMenu(false);
    documentInputRef.current?.click();
  };

  const openMediaPicker = () => {
    if (sendingMessage || isRecordingAudio) {
      return;
    }

    setShowAttachmentMenu(false);
    mediaInputRef.current?.click();
  };

  const enableSchedule = () => {
    if (sendingMessage || schedulingMessage || isRecordingAudio) {
      return;
    }

    setIsScheduleEnabled(true);
    setScheduleValidationError(null);
    setScheduledSendAt(previousValue => {
      const trimmed = previousValue.trim();

      if (trimmed) {
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
          return trimmed;
        }
      }

      const defaultDate = new Date(Date.now() + 5 * 60 * 1000);
      return formatDateTimeForInput(defaultDate.toISOString());
    });

    setShowAttachmentMenu(false);
    setShowChatActionsMenu(false);
  };

  const disableSchedule = () => {
    setIsScheduleEnabled(false);
    setScheduledSendAt('');
    setScheduleValidationError(null);
    setShowAttachmentMenu(false);
    setShowChatActionsMenu(false);
  };

  const handleDocumentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file || sendingMessage || schedulingMessage || isRecordingAudio) {
      return;
    }

    if (!selectedChat) {
      setErrorMessage('Selecione uma conversa antes de enviar documentos.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileName = file.name?.trim() || null;
      const extension =
        extractFileExtension(fileName) ?? extractExtensionFromMime(file.type) ?? null;

      if (!extension) {
        setErrorMessage('Não foi possível identificar a extensão do documento selecionado.');
        return;
      }

      setPendingAttachment({
        kind: 'document',
        dataUrl,
        fileName,
        extension,
      });
      setShowAttachmentMenu(false);
    } catch (error) {
      console.error('Erro ao preparar documento para envio:', error);
      setErrorMessage('Não foi possível preparar o documento para envio.');
    }
  };

  const handleMediaChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file || sendingMessage || schedulingMessage || isRecordingAudio) {
      return;
    }

    if (!selectedChat) {
      setErrorMessage('Selecione uma conversa antes de enviar mídias.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        setErrorMessage('Selecione um arquivo de imagem ou vídeo válido.');
        return;
      }

      const fileName = file.name?.trim() || null;
      const nextAttachment: PendingAttachment = isImage
        ? {
            kind: 'image',
            dataUrl,
            fileName,
            mimeType: file.type,
          }
        : {
            kind: 'video',
            dataUrl,
            fileName,
            mimeType: file.type,
          };

      setPendingAttachment(nextAttachment);
      setShowAttachmentMenu(false);
    } catch (error) {
      console.error('Erro ao preparar mídia para envio:', error);
      setErrorMessage('Não foi possível preparar a mídia selecionada.');
    }
  };

  const handleSendContactPrompt = async () => {
    if (!selectedChat || sendingMessage || schedulingMessage) {
      return;
    }

    setShowAttachmentMenu(false);

    const contactName = window.prompt('Nome do contato')?.trim();
    if (!contactName) {
      return;
    }

    const contactPhoneRaw = window.prompt('Telefone do contato (apenas números)');
    if (contactPhoneRaw === null) {
      return;
    }

    const contactPhoneInput = contactPhoneRaw.replace(/\D/g, '').trim();

    if (!contactPhoneInput) {
      setErrorMessage('Informe um telefone válido para o contato.');
      return;
    }

    const optimisticMessage = createOptimisticMessage({
      text: `👤 ${contactName}`,
      raw_payload: {
        contacts: [
          {
            name: contactName,
            phones: [contactPhoneInput],
            businessDescription: null,
          },
        ],
      },
    });

    await sendWhatsappMessage({
      endpoint: '/whatsapp-webhook/send-contact',
      body: {
        phone: selectedChat.phone,
        contactName,
        contactPhone: contactPhoneInput,
      },
      optimisticMessage,
      errorFallback: 'Não foi possível enviar o contato.',
    });
  };

  const handleSendLocationPrompt = async () => {
    if (!selectedChat || sendingMessage || schedulingMessage) {
      return;
    }

    setShowAttachmentMenu(false);

    const title = window.prompt('Título da localização')?.trim();
    if (!title) {
      return;
    }

    const address = window.prompt('Endereço completo')?.trim();
    if (!address) {
      return;
    }

    const latitude = window.prompt('Latitude (ex: -23.000000)')?.trim();
    const longitude = window.prompt('Longitude (ex: -46.000000)')?.trim();

    if (!latitude || !longitude) {
      setErrorMessage('Informe latitude e longitude válidas.');
      return;
    }

    const optimisticMessage = createOptimisticMessage({
      text: `📍 ${title}`,
      raw_payload: {
        location: {
          title,
          address,
          latitude,
          longitude,
        },
      },
    });

    await sendWhatsappMessage({
      endpoint: '/whatsapp-webhook/send-location',
      body: {
        phone: selectedChat.phone,
        title,
        address,
        latitude,
        longitude,
      },
      optimisticMessage,
      errorFallback: 'Não foi possível enviar a localização.',
    });
  };

  type MessageAttachmentInfo = {
    imageUrl: string | null;
    imageCaption: string | null;
    audioUrl: string | null;
    audioSeconds: number | null;
    videoUrl: string | null;
    videoCaption: string | null;
    documentUrl: string | null;
    documentFileName: string;
    documentCaption: string | null;
    hasMediaWithoutPadding: boolean;
  };

  const getMessageAttachmentInfo = (message: TimelineMessage): MessageAttachmentInfo => {
    const payload =
      message.raw_payload && typeof message.raw_payload === 'object'
        ? (message.raw_payload as WhatsappMessageRawPayload)
        : null;

    const imageUrl = payload ? toNonEmptyString(payload?.image?.imageUrl) : null;
    const videoUrl = payload ? toNonEmptyString(payload?.video?.videoUrl) : null;
    const documentUrl = payload ? toNonEmptyString(payload?.document?.documentUrl) : null;
    const audioUrl = payload ? toNonEmptyString(payload?.audio?.audioUrl) : null;

    return {
      imageUrl,
      imageCaption: payload ? toNonEmptyString(payload?.image?.caption) : null,
      audioUrl,
      audioSeconds: payload?.audio?.seconds ?? null,
      videoUrl,
      videoCaption: payload ? toNonEmptyString(payload?.video?.caption) : null,
      documentUrl,
      documentFileName:
        toNonEmptyString(payload?.document?.fileName) ??
        toNonEmptyString(payload?.document?.title) ??
        'Documento',
      documentCaption: payload ? toNonEmptyString(payload?.document?.caption) : null,
      hasMediaWithoutPadding: Boolean(imageUrl || videoUrl),
    };
  };

  const { renderableMessages, reactionSummaries } = useMemo(() => {
    const baseMessages: TimelineMessage[] = [];
    const reactionAccumulator = new Map<string, Map<string, MessageReactionParticipant[]>>();

    for (const message of messages) {
      const timelineMessage: TimelineMessage = { ...message };
      const payload =
        message.raw_payload && typeof message.raw_payload === 'object'
          ? (message.raw_payload as WhatsappMessageRawPayload)
          : null;

      const reactionPayload = payload?.reaction ?? null;
      const referencedMessageId = reactionPayload
        ? toNonEmptyString(reactionPayload.referencedMessage?.messageId)
        : null;

      const participantId = reactionPayload
        ? toNonEmptyString(reactionPayload.reactionBy) ?? toNonEmptyString(payload?.phone)
        : null;

      const reactionValue = reactionPayload ? toNonEmptyString(reactionPayload.value) : null;

      if (referencedMessageId && participantId) {
        const participantsByEmoji =
          reactionAccumulator.get(referencedMessageId) ??
          new Map<string, MessageReactionParticipant[]>();

        // Remove any previous reaction by the same participant before applying the latest event
        for (const [emoji, participantList] of participantsByEmoji.entries()) {
          const index = participantList.findIndex(
            participant => participant.participantId === participantId,
          );

          if (index !== -1) {
            participantList.splice(index, 1);
            if (participantList.length === 0) {
              participantsByEmoji.delete(emoji);
            }
          }
        }

        if (reactionValue) {
          const reactionTime = parseDateValue(reactionPayload?.time ?? null);
          const displayName = getMessageSenderDisplayName(message);

          const reactionPhone = reactionPayload
            ? toNonEmptyString(reactionPayload.reactionBy)
            : null;

          const participantInfo: MessageReactionParticipant = {
            participantId,
            displayName: displayName ?? (message.from_me ? 'Você' : null),
            phone: reactionPhone ?? toNonEmptyString(payload?.phone),
            isFromMe: message.from_me,
            reactedAt: reactionTime,
          };

          const participantList = participantsByEmoji.get(reactionValue) ?? [];
          participantList.push(participantInfo);
          participantsByEmoji.set(reactionValue, participantList);
        }

        reactionAccumulator.set(referencedMessageId, participantsByEmoji);
        continue;
      }

      baseMessages.push(timelineMessage);
    }

    const summaries: Record<string, MessageReactionSummary> = {};

    reactionAccumulator.forEach((emojiMap, messageId) => {
      const entries: MessageReactionSummaryEntry[] = Array.from(emojiMap.entries())
        .map(([emoji, participants]) => {
          const sortedParticipants = [...participants].sort((first, second) => {
            const firstTime = first.reactedAt?.getTime() ?? 0;
            const secondTime = second.reactedAt?.getTime() ?? 0;
            return secondTime - firstTime;
          });

          return {
            emoji,
            count: sortedParticipants.length,
            participants: sortedParticipants,
          };
        })
        .filter(entry => entry.count > 0);

      entries.sort((first, second) => {
        const countDifference = second.count - first.count;
        if (countDifference !== 0) {
          return countDifference;
        }

        return first.emoji.localeCompare(second.emoji);
      });

      const totalCount = entries.reduce((accumulator, entry) => accumulator + entry.count, 0);

      if (totalCount > 0) {
        summaries[messageId] = {
          totalCount,
          entries,
        };
      }
    });

      for (const schedule of scheduledMessages) {
        if (!shouldDisplayScheduledMessage(schedule.status)) {
          continue;
        }

        const timelineMessage: TimelineMessage = {
          id: schedule.id,
          chat_id: schedule.chat_id,
          message_id: null,
          from_me: true,
          status: schedule.status,
          text: schedule.message,
          moment: schedule.scheduled_send_at,
          raw_payload: null,
          scheduleMetadata: {
            scheduledMessageId: schedule.id,
            scheduledSendAt: schedule.scheduled_send_at,
            status: schedule.status,
            lastError: schedule.last_error ?? null,
            createdAt: schedule.created_at ?? null,
          },
        };

        baseMessages.push(timelineMessage);
      }

      const sortedMessages = [...baseMessages].sort((first, second) => {
        const getMomentValue = (entry: TimelineMessage) => {
          const momentValue = entry.moment ?? entry.scheduleMetadata?.scheduledSendAt ?? null;
          if (!momentValue) {
            return 0;
          }

          const timestamp = new Date(momentValue).getTime();
          return Number.isNaN(timestamp) ? 0 : timestamp;
        };

        const firstMoment = getMomentValue(first);
        const secondMoment = getMomentValue(second);

        if (firstMoment !== secondMoment) {
          return firstMoment - secondMoment;
        }

        const getScheduleCreationValue = (entry: TimelineMessage) => {
          const createdAtValue = entry.scheduleMetadata?.createdAt ?? null;
          if (!createdAtValue) {
            return 0;
          }

          const timestamp = new Date(createdAtValue).getTime();
          return Number.isNaN(timestamp) ? 0 : timestamp;
        };

        const firstCreation = getScheduleCreationValue(first);
        const secondCreation = getScheduleCreationValue(second);

        if (firstCreation !== secondCreation) {
          return firstCreation - secondCreation;
        }

        const firstId = first.scheduleMetadata?.scheduledMessageId ?? first.id;
        const secondId = second.scheduleMetadata?.scheduledMessageId ?? second.id;
        return firstId.localeCompare(secondId);
      });

      return {
        renderableMessages: sortedMessages,
        reactionSummaries: summaries,
      };
    }, [messages, scheduledMessages]);

    const trimmedMessageSearchTerm = messageSearchTerm.trim();
  const normalizedMessageSearchTerm = trimmedMessageSearchTerm.toLowerCase();

  const messageSearchMatches = useMemo(() => {
    if (!normalizedMessageSearchTerm) {
      return [] as string[];
    }

    const collectSegments = (message: OptimisticMessage): string[] => {
      const segments: string[] = [];
      const fallbackText = message.text?.trim();
      if (fallbackText) {
        segments.push(fallbackText);
      }

      const attachmentInfo = getMessageAttachmentInfo(message);

      const attachmentSegments = [
        attachmentInfo.imageCaption,
        attachmentInfo.videoCaption,
        attachmentInfo.documentCaption,
        attachmentInfo.documentFileName,
      ];

      attachmentSegments.forEach(segment => {
        if (segment && segment.trim()) {
          segments.push(segment);
        }
      });

      const payload =
        message.raw_payload && typeof message.raw_payload === 'object'
          ? (message.raw_payload as WhatsappMessageRawPayload)
          : null;

      if (payload) {
        const locationPayload = payload.location;
        if (locationPayload && typeof locationPayload === 'object') {
          const title = toNonEmptyString((locationPayload as { title?: unknown }).title);
          const address = toNonEmptyString((locationPayload as { address?: unknown }).address);

          if (title) {
            segments.push(title);
          }

          if (address) {
            segments.push(address);
          }
        }

        const pushContactSegments = (value: unknown) => {
          if (!value || typeof value !== 'object') {
            return;
          }

          const entry = value as {
            name?: unknown;
            businessDescription?: unknown;
            phones?: unknown;
          };

          const name = toNonEmptyString(entry.name);
          if (name) {
            segments.push(name);
          }

          const businessDescription = toNonEmptyString(entry.businessDescription);
          if (businessDescription) {
            segments.push(businessDescription);
          }

          const phonesRaw = entry.phones;
          if (Array.isArray(phonesRaw)) {
            phonesRaw.forEach(phoneValue => {
              if (typeof phoneValue === 'string' && phoneValue.trim()) {
                segments.push(phoneValue);
              }
            });
          }
        };

        if (payload.contact) {
          pushContactSegments(payload.contact);
        }

        if (Array.isArray(payload.contacts)) {
          payload.contacts.forEach(pushContactSegments);
        }
      }

      return segments;
    };

    const matches: string[] = [];

    renderableMessages.forEach(message => {
      const segments = collectSegments(message);
      if (segments.some(segment => segment.toLowerCase().includes(normalizedMessageSearchTerm))) {
        matches.push(message.id);
      }
    });

    return matches;
  }, [getMessageAttachmentInfo, normalizedMessageSearchTerm, renderableMessages]);

  const messageSearchMatchesSet = useMemo(
    () => new Set(messageSearchMatches),
    [messageSearchMatches],
  );

  const renderHighlightedText = useCallback(
    (text: string) => {
      if (!trimmedMessageSearchTerm) {
        return text;
      }

      const normalizedText = text.toLowerCase();
      const term = normalizedMessageSearchTerm;
      if (!term) {
        return text;
      }

      const nodes: ReactNode[] = [];
      let searchStart = 0;

      while (true) {
        const matchIndex = normalizedText.indexOf(term, searchStart);
        if (matchIndex === -1) {
          break;
        }

        if (matchIndex > searchStart) {
          nodes.push(
            <Fragment key={`text-${searchStart}`}>
              {text.slice(searchStart, matchIndex)}
            </Fragment>,
          );
        }

        const matchText = text.slice(matchIndex, matchIndex + term.length);
        nodes.push(
          <mark
            key={`highlight-${matchIndex}`}
            className="rounded bg-yellow-200 px-0.5 text-inherit"
          >
            {matchText}
          </mark>,
        );

        searchStart = matchIndex + term.length;
      }

      if (nodes.length === 0) {
        return text;
      }

      if (searchStart < text.length) {
        nodes.push(
          <Fragment key={`text-${searchStart}`}>{text.slice(searchStart)}</Fragment>,
        );
      }

      return nodes;
    },
    [normalizedMessageSearchTerm, trimmedMessageSearchTerm],
  );

  const hasMessageSearch = normalizedMessageSearchTerm.length > 0;
  const visibleMessages = renderableMessages;
  const hasMessages = renderableMessages.length > 0;
  const hasVisibleMessages = visibleMessages.length > 0;
  const hasMessageSearchMatches = messageSearchMatches.length > 0;
  const primaryMessageSearchMatchId = messageSearchMatches[0] ?? null;

  useEffect(() => {
    if (!showMessageSearch || !normalizedMessageSearchTerm) {
      return;
    }

    const firstMatchId = messageSearchMatches[0];
    if (!firstMatchId) {
      return;
    }

    const target = messageElementsRef.current[firstMatchId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [messageSearchMatches, normalizedMessageSearchTerm, showMessageSearch]);

  const renderMessageContent = (message: OptimisticMessage, attachmentInfo: MessageAttachmentInfo) => {
    const isFromMe = message.from_me;
    const messageTranscriptionKey = message.id ?? message.message_id ?? null;

    const attachments: JSX.Element[] = [];
    const payload =
      message.raw_payload && typeof message.raw_payload === 'object'
        ? (message.raw_payload as WhatsappMessageRawPayload)
        : null;
    const attachmentCardBaseClass = 'flex flex-col gap-2 rounded-lg bg-white p-3 text-slate-800';

    if (attachmentInfo.imageUrl) {
      attachments.push(
        <div key="image" className="flex flex-col">
          <img
            src={attachmentInfo.imageUrl}
            alt={attachmentInfo.imageCaption ?? 'Imagem recebida'}
            className="block h-auto max-h-80 w-auto max-w-full object-contain"
          />
          {attachmentInfo.imageCaption ? (
            <div className={`self-stretch px-4 pb-4 pt-3 text-sm ${isFromMe ? 'text-white/90' : 'text-slate-700'}`}>
              <p className="whitespace-pre-wrap break-words">
                {renderHighlightedText(attachmentInfo.imageCaption)}
              </p>
            </div>
          ) : null}
        </div>,
      );
    }

    if (attachmentInfo.videoUrl) {
      attachments.push(
        <div key="video" className="flex flex-col">
          <video
            controls
            preload="metadata"
            src={attachmentInfo.videoUrl}
            className="block max-h-80 w-full bg-black"
          />
          {attachmentInfo.videoCaption ? (
            <div className={`px-4 pb-4 pt-3 text-sm ${isFromMe ? 'text-white/90' : 'text-slate-700'}`}>
              <p className="whitespace-pre-wrap break-words">
                {renderHighlightedText(attachmentInfo.videoCaption)}
              </p>
            </div>
          ) : null}
        </div>,
      );
    }

    if (attachmentInfo.audioUrl) {
      const audioUrl = attachmentInfo.audioUrl;
      const resolvedTranscriptionKey = messageTranscriptionKey ?? audioUrl ?? null;
      const transcriptionState = resolvedTranscriptionKey
        ? audioTranscriptions[resolvedTranscriptionKey] ?? null
        : null;
      const transcriptionStatus = transcriptionState?.status ?? 'idle';
      const canTranscribeAudio = Boolean(!isFromMe && resolvedTranscriptionKey);
      const handleTranscriptionClick = () => {
        if (!resolvedTranscriptionKey) {
          return;
        }

        void requestAudioTranscription(resolvedTranscriptionKey, audioUrl);
      };

      const transcriptionButtonLabel = (() => {
        if (transcriptionStatus === 'loading') {
          return 'Transcrevendo...';
        }

        if (transcriptionStatus === 'success') {
          return 'Atualizar transcrição';
        }

        return 'Transcrever áudio';
      })();

      attachments.push(
        <div key="audio" className="flex flex-col gap-2 rounded-lg bg-white p-3 text-slate-800">
          <AudioMessageBubble src={audioUrl} seconds={attachmentInfo.audioSeconds} />
          {canTranscribeAudio ? (
            <div className="flex flex-col gap-2 text-xs text-slate-600">
              {transcriptionState?.text && transcriptionState.status === 'success' ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700">
                  <p className="mb-1 text-[13px] font-semibold text-slate-800">Transcrição</p>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                    {renderHighlightedText(transcriptionState.text)}
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleTranscriptionClick}
                disabled={transcriptionStatus === 'loading'}
                className="inline-flex items-center justify-center rounded-md border border-emerald-500 px-3 py-1.5 text-[13px] font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {transcriptionButtonLabel}
              </button>
              {transcriptionStatus === 'loading' ? (
                <p className="text-[13px] text-slate-500">Transcrevendo áudio...</p>
              ) : null}
              {transcriptionStatus === 'error' && transcriptionState?.error ? (
                <p className="text-[13px] text-rose-600">{transcriptionState.error}</p>
              ) : null}
            </div>
          ) : null}
        </div>,
      );
    }

    if (attachmentInfo.documentUrl) {
      attachments.push(
        <div key="document" className="flex flex-col gap-3 rounded-lg bg-white p-3 text-slate-800">
          <div className="overflow-hidden rounded-md border border-slate-200">
            <iframe
              src={attachmentInfo.documentUrl}
              title={`Pré-visualização do documento ${attachmentInfo.documentFileName}`}
              className="h-64 w-full border-0"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {renderHighlightedText(attachmentInfo.documentFileName)}
              </p>
              {attachmentInfo.documentCaption ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {renderHighlightedText(attachmentInfo.documentCaption)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={attachmentInfo.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
              >
                Abrir
              </a>
              <a
                href={attachmentInfo.documentUrl}
                download
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Baixar
              </a>
            </div>
          </div>
        </div>,
      );
    }

    const locationPayload = payload?.location;
    if (locationPayload && typeof locationPayload === 'object') {
      const title = toNonEmptyString((locationPayload as { title?: unknown })?.title) ?? 'Localização';
      const address = toNonEmptyString((locationPayload as { address?: unknown })?.address);
      const latitude = toNonEmptyString((locationPayload as { latitude?: unknown })?.latitude);
      const longitude = toNonEmptyString((locationPayload as { longitude?: unknown })?.longitude);
      const mapsUrl = (() => {
        if (latitude && longitude) {
          return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`;
        }

        if (address) {
          return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        }

        return null;
      })();

      attachments.push(
        <div key="location" className={attachmentCardBaseClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <MapPin className="h-4 w-4" />
            <span>{renderHighlightedText(title)}</span>
          </div>
          {address ? (
            <p className="text-sm text-slate-700">{renderHighlightedText(address)}</p>
          ) : null}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-600 underline"
            >
              Ver no mapa
            </a>
          ) : null}
        </div>,
      );
    }

    const contactEntries: Array<{
      name: string | null;
      phones: string[];
      businessDescription: string | null;
    }> = [];

    const singleContact = payload?.contact;
    if (singleContact && typeof singleContact === 'object') {
      const name =
        toNonEmptyString((singleContact as { name?: unknown })?.name) ?? 'Contato';
      const phonesRaw = (singleContact as { phones?: unknown })?.phones;
      const phones = Array.isArray(phonesRaw)
        ? (phonesRaw as unknown[]).map(phone => (typeof phone === 'string' ? phone : '')).filter(Boolean)
        : [];
      const businessDescription = toNonEmptyString(
        (singleContact as { businessDescription?: unknown })?.businessDescription,
      );

      contactEntries.push({ name, phones, businessDescription });
    }

    const contactsList = payload?.contacts;
    if (Array.isArray(contactsList)) {
      contactsList.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }

        const name =
          toNonEmptyString((entry as { name?: unknown })?.name) ?? `Contato ${index + 1}`;
        const phonesRaw = (entry as { phones?: unknown })?.phones;
        const phones = Array.isArray(phonesRaw)
          ? (phonesRaw as unknown[]).map(phone => (typeof phone === 'string' ? phone : '')).filter(Boolean)
          : [];
        const businessDescription = toNonEmptyString(
          (entry as { businessDescription?: unknown })?.businessDescription,
        );

        contactEntries.push({ name, phones, businessDescription });
      });
    }

    if (contactEntries.length > 0) {
      attachments.push(
        <div key="contacts" className={attachmentCardBaseClass}>
          {contactEntries.map((contact, index) => (
            <div
              key={`${contact.name ?? 'Contato'}-${index}`}
              className="flex flex-col gap-1 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <UserPlus className="h-4 w-4" />
                <span>{renderHighlightedText(contact.name ?? 'Contato')}</span>
              </div>
              {contact.businessDescription ? (
                <p className="text-xs text-slate-500">
                  {renderHighlightedText(contact.businessDescription)}
                </p>
              ) : null}
              {contact.phones.length > 0 ? (
                <ul className="text-sm text-slate-700">
                  {contact.phones.map(phone => (
                    <li key={`${phone}-${index}`}>{renderHighlightedText(phone)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>,
      );
    }

    const fallbackText = message.text?.trim() ?? '';
    const shouldRenderFallbackText =
      fallbackText &&
      fallbackText !== UNSUPPORTED_MESSAGE_PLACEHOLDER &&
      attachments.length === 0;

    if (shouldRenderFallbackText) {
      attachments.push(
        <p key="text" className={`whitespace-pre-wrap break-words text-sm ${isFromMe ? 'text-white' : ''}`}>
          {renderHighlightedText(fallbackText)}
        </p>,
      );
    }

    if (attachments.length === 1) {
      return attachments[0];
    }

    if (attachments.length > 1) {
      return <div className="flex flex-col gap-2">{attachments}</div>;
    }

    return (
      <p className="whitespace-pre-wrap break-words text-sm">
        {fallbackText
          ? renderHighlightedText(fallbackText)
          : UNSUPPORTED_MESSAGE_PLACEHOLDER}
      </p>
    );
  };

  const openWhatsappSettings = () => {
    setActiveSection('configs');
  };

  const returnToWhatsappChats = () => {
    setActiveSection('painel');
  };

  const trimmedMessageInput = messageInput.trim();
  const shouldScheduleCurrentMessage = isScheduleEnabled && scheduledSendAt.trim().length > 0;
  const shouldShowAudioAction =
    !pendingAttachment && trimmedMessageInput.length === 0 && !shouldScheduleCurrentMessage;
  const isSendDisabled =
    sendingMessage ||
    schedulingMessage ||
    isRecordingAudio ||
    (!pendingAttachment && trimmedMessageInput.length === 0);
  const isActionButtonDisabled = shouldShowAudioAction
    ? sendingMessage || schedulingMessage || isRecordingAudio
    : isSendDisabled;
  const messagePlaceholder = pendingAttachment
    ? pendingAttachment.kind === 'audio'
      ? 'Adicione uma mensagem (opcional)'
      : 'Adicione uma legenda (opcional)'
    : 'Digite sua mensagem';

  const shouldHideMobileBottomMenu =
    activeSection === 'painel' && Boolean(selectedChat) && !showChatListMobile;

  const conversationWorkspace = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:flex-row">
      <aside
        className={`${showChatListMobile ? 'flex' : 'hidden'} md:flex w-full flex-1 flex-col border-b border-slate-200 md:w-80 md:flex-none md:border-b-0 md:border-r min-h-0`}
      >
        <div className="flex-shrink-0 border-b border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Conversas</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-2 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={sendingMessage}
                aria-label="Nova conversa"
                title="Nova conversa"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openWhatsappSettings}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                aria-label="Abrir configurações do WhatsApp"
                title="Configurações do WhatsApp"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
          {errorMessage && (
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          )}
          <div className="mt-3">
            <label className="sr-only" htmlFor="whatsapp-chat-search">
              Pesquisar conversas
            </label>
            <input
              id="whatsapp-chat-search"
              type="search"
              value={chatSearchTerm}
              onChange={event => setChatSearchTerm(event.target.value)}
              placeholder="Pesquisar conversas"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              autoComplete="off"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowArchivedChats(previous => !previous)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-500 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!hasArchivedChats && !showArchivedChats}
            >
              {showArchivedChats ? (
                <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{archivedToggleLabel}</span>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
          {chatsLoading && visibleChatsBase.length === 0 ? (
            <div className="p-4">
              <ChatListSkeleton />
            </div>
          ) : visibleChatsBase.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{emptyChatsMessage}</p>
          ) : filteredChats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{emptySearchMessage}</p>
          ) : (
            filteredChats.map(chat => {
              const isActive = chat.id === selectedChatId;
              const displayName = getChatDisplayName(chat);
              const previewInfo = getChatPreviewInfo(chat.last_message_preview);
              const previewText = sanitizeChatPreviewText(previewInfo.text, chat, displayName);
              const PreviewIcon = previewInfo.icon;
              const shouldShowPreviewIcon =
                PreviewIcon && previewText !== CHAT_PREVIEW_FALLBACK_TEXT;
              const avatarSeed = chat.sender_photo || chat.phone || chat.chat_name || 'default';
              const avatarColors = getAvatarColorStyles(avatarSeed);
              const isPinned = chat.is_pinned;
              const isArchived = chat.is_archived;
              const isChatActionLoading = Boolean(chatActionLoading[chat.id]);
              const pinLabel = isPinned ? 'Desafixar conversa' : 'Fixar conversa';
              const archiveLabel = isArchived
                ? 'Desarquivar conversa'
                : 'Arquivar conversa';
              const slaBadge = getChatSlaBadge(chat);

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => handleSelectChat(chat.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    isActive ? 'bg-emerald-50 border-l-4 border-emerald-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {chat.sender_photo ? (
                      <img
                        src={chat.sender_photo}
                        alt={displayName || chat.phone}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: avatarColors.background }}
                        aria-hidden="true"
                      >
                        <User className="h-5 w-5" style={{ color: avatarColors.icon }} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1 truncate font-medium text-slate-800">
                          {isPinned ? (
                            <Pin className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                          ) : null}
                          <span className="truncate">{displayName}</span>
                        </span>
                        <span className="whitespace-nowrap text-xs text-slate-500">
                          {formatChatListTimestamp(chat.last_message_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                        {shouldShowPreviewIcon ? (
                          <PreviewIcon
                            aria-hidden="true"
                            className="h-4 w-4 flex-shrink-0 text-slate-400"
                          />
                        ) : null}
                        <span className="block min-w-0 truncate">{previewText}</span>
                      </div>
                      {slaBadge ? (
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            SLA_STATUS_BADGE_CLASSES[slaBadge.status] ??
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {slaBadge.text}
                        </span>
                      ) : null}
                      {showArchivedChats ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Arquivado
                        </span>
                      ) : null}
                    </div>
                    <div className="ml-3 flex flex-col gap-1">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={event => {
                          event.stopPropagation();
                          handlePinStatusChange(chat, !isPinned);
                        }}
                        aria-label={pinLabel}
                        title={pinLabel}
                        disabled={isChatActionLoading}
                      >
                        {isPinned ? (
                          <PinOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Pin className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={event => {
                          event.stopPropagation();
                          handleArchiveStatusChange(chat, !isArchived);
                        }}
                        aria-label={archiveLabel}
                        title={archiveLabel}
                        disabled={isChatActionLoading}
                      >
                        {isArchived ? (
                          <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Archive className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`${showChatListMobile ? 'hidden' : 'flex'} md:flex flex-1 min-h-0 flex-col`}>
        {selectedChat ? (
          <>
            <header className="flex-shrink-0 border-b border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToChats}
                  className="md:hidden inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                  aria-label="Voltar para lista de conversas"
                >
                  ←
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex min-w-0 flex-1 items-center gap-3 ${
                      selectedChatLead
                        ? 'cursor-pointer rounded-lg px-2 py-1 transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40'
                        : ''
                    }`}
                    onClick={selectedChatLead ? handleChatHeaderClick : undefined}
                    onKeyDown={selectedChatLead ? handleChatHeaderKeyDown : undefined}
                    role={selectedChatLead ? 'button' : undefined}
                    tabIndex={selectedChatLead ? 0 : undefined}
                    aria-label={selectedChatLead ? 'Ver histórico do lead e informações do CRM' : undefined}
                    title={selectedChatLead ? 'Clique para visualizar o histórico do lead' : undefined}
                  >
                    {selectedChat.sender_photo ? (
                      <img
                        src={selectedChat.sender_photo}
                        alt={selectedChatDisplayName || selectedChat.phone}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-semibold text-emerald-600">
                        {(selectedChatDisplayName || selectedChat.phone).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">{selectedChatDisplayName}</p>
                      {(selectedChatIsPinned || selectedChatIsArchived) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                          {selectedChatIsPinned ? (
                            <span className="inline-flex items-center gap-1">
                              <Pin className="h-3.5 w-3.5" aria-hidden="true" /> Fixado
                            </span>
                          ) : null}
                          {selectedChatIsArchived ? (
                            <span className="inline-flex items-center gap-1">
                              <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Arquivado
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedChatLead ? (
                    <div className="hidden items-center gap-2 md:flex">
                      {activeLeadStatuses.length > 0 ? (
                        <StatusDropdown
                          currentStatus={selectedChatLead.status ?? 'Sem status'}
                          leadId={selectedChatLead.id}
                          onStatusChange={handleChatLeadStatusChange}
                          disabled={updatingLeadStatus}
                          statusOptions={activeLeadStatuses}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          Status: {selectedChatLead.status ?? 'Não informado'}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            {showMessageSearch ? (
              <div className="border-b border-slate-200 px-4 py-3">
                <label className="sr-only" htmlFor="whatsapp-message-search">
                  Pesquisar mensagens
                </label>
                <div className="relative">
                  <input
                    ref={messageSearchInputRef}
                    id="whatsapp-message-search"
                    type="search"
                    value={messageSearchTerm}
                    onChange={event => setMessageSearchTerm(event.target.value)}
                    placeholder="Pesquisar mensagens"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-20 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    autoComplete="off"
                  />
                  {messageSearchTerm ? (
                    <button
                      type="button"
                      onClick={() => setMessageSearchTerm('')}
                      className="absolute inset-y-1 right-10 inline-flex items-center justify-center rounded-md px-2 text-slate-400 transition hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      aria-label="Limpar busca de mensagens"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMessageSearch(false);
                      setMessageSearchTerm('');
                    }}
                    className="absolute inset-y-1 right-1 inline-flex items-center justify-center rounded-md px-2 text-slate-400 transition hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    aria-label="Fechar busca de mensagens"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {hasMessageSearch && !hasMessageSearchMatches ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Nenhuma mensagem encontrada para a busca.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              ref={messagesContainerRef}
              data-testid="whatsapp-messages"
              className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-slate-50 p-4"
            >
              {messagesLoading && !hasMessages ? (
                <MessageSkeletonList />
              ) : !hasMessages ? (
                <p className="text-sm text-slate-500">Nenhuma mensagem neste chat.</p>
              ) : !hasVisibleMessages ? (
                <p className="text-sm text-slate-500">
                  {hasMessageSearch
                    ? 'Nenhuma mensagem encontrada para a busca.'
                    : 'Nenhuma mensagem neste chat.'}
                </p>
              ) : (
                visibleMessages.map(message => {
                  const isFromMe = message.from_me;
                  const scheduleMetadata = message.scheduleMetadata ?? null;
                  const scheduleId = scheduleMetadata?.scheduledMessageId ?? null;
                  const scheduleStatusLabel = scheduleMetadata
                    ? SCHEDULE_STATUS_LABELS[scheduleMetadata.status] ?? scheduleMetadata.status
                    : null;
                  const scheduleTimestamp = scheduleMetadata
                    ? formatDateTime(scheduleMetadata.scheduledSendAt)
                    : null;
                  const canCancelSchedule = scheduleMetadata
                    ? ['pending', 'processing'].includes(scheduleMetadata.status)
                    : false;
                  const isCancellingSchedule = scheduleId
                    ? Boolean(cancellingScheduleIds[scheduleId])
                    : false;
                  const attachmentInfo = getMessageAttachmentInfo(message);
                  const alignment = isFromMe ? 'items-end text-right' : 'items-start text-left';
                  const hasMediaWithoutPadding = attachmentInfo.hasMediaWithoutPadding;
                  const hasOnlyMediaWithoutPadding =
                    hasMediaWithoutPadding && !attachmentInfo.audioUrl && !attachmentInfo.documentUrl;
                  const bubblePaddingClasses = hasMediaWithoutPadding ? 'p-0' : 'px-4 py-3';
                  const bubbleOverflowClass = hasOnlyMediaWithoutPadding ? 'overflow-hidden' : '';
                  const bubbleClasses = scheduleMetadata
                    ? isFromMe
                      ? 'bg-emerald-600/10 border border-emerald-200 text-emerald-900'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : isFromMe
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-800';

                  const shouldShowSenderName = selectedChat.is_group;
                  const senderDisplayName = shouldShowSenderName
                    ? getMessageSenderDisplayName(message)
                    : null;
                  const messageIdKey = message.message_id ?? null;
                  const reactionSummary =
                    messageIdKey && reactionSummaries[messageIdKey]
                      ? reactionSummaries[messageIdKey]
                      : null;
                  const hasReactions = Boolean(reactionSummary);
                  const isGroupChat = selectedChat.is_group;
                  const summaryInteractive = Boolean(isGroupChat && messageIdKey);
                  const isReactionDetailsOpen = Boolean(
                    summaryInteractive && reactionDetailsMessageId === messageIdKey,
                  );
                  const isSearchMatch = messageSearchMatchesSet.has(message.id);
                  const isPrimarySearchMatch = primaryMessageSearchMatchId === message.id;
                  const summaryWrapperClassName = hasOnlyMediaWithoutPadding
                    ? `relative absolute ${isFromMe ? 'right-2' : 'left-2'} bottom-2`
                    : `relative mt-2 flex w-full flex-wrap ${
                        isFromMe ? 'justify-end' : 'justify-start'
                      }`;
                  const summaryButtonClassName = [
                    'inline-flex flex-wrap items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold shadow-sm',
                    hasOnlyMediaWithoutPadding
                      ? 'bg-black/60 text-white backdrop-blur-sm'
                      : isFromMe
                      ? 'bg-emerald-600/20 text-white'
                      : 'bg-slate-100 text-slate-700',
                    summaryInteractive
                      ? 'cursor-pointer transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const summaryChipClassName =
                    hasOnlyMediaWithoutPadding || isFromMe
                      ? 'inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white'
                      : 'inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 shadow-sm';

                  const reactionSummaryContent = reactionSummary ? (
                    <>
                      {reactionSummary.entries.map(entry => (
                        <span
                          key={`summary-${message.id}-${entry.emoji}`}
                          className={summaryChipClassName}
                        >
                          <span className="text-base leading-none">{entry.emoji}</span>
                          <span>{entry.count}</span>
                        </span>
                      ))}
                      <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {reactionSummary.totalCount}
                      </span>
                    </>
                  ) : null;

                  return (
                    <div
                      key={message.id}
                      ref={element => {
                        if (element) {
                          messageElementsRef.current[message.id] = element;
                        } else {
                          delete messageElementsRef.current[message.id];
                        }
                      }}
                      data-testid="whatsapp-message"
                      className={`flex flex-col ${alignment}`}
                    >
                      {shouldShowSenderName ? (
                        <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                          {senderDisplayName ?? 'Participante'}
                        </span>
                      ) : null}
                      <div
                        className={`relative inline-flex max-w-[75%] flex-col rounded-2xl shadow-sm ${
                          isFromMe ? 'rounded-br-none' : 'rounded-bl-none'
                        } ${bubblePaddingClasses} ${bubbleOverflowClass} ${bubbleClasses} ${
                          isPrimarySearchMatch
                            ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-50'
                            : isSearchMatch
                            ? 'ring-1 ring-emerald-200 ring-offset-2 ring-offset-slate-50'
                            : ''
                        }`}
                      >
                        {renderMessageContent(message, attachmentInfo)}
                        {hasReactions && reactionSummary ? (
                          <div className={summaryWrapperClassName}>
                            {summaryInteractive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!messageIdKey) {
                                    return;
                                  }
                                  setReactionDetailsMessageId(previous =>
                                    previous === messageIdKey ? null : messageIdKey,
                                  );
                                }}
                                className={summaryButtonClassName}
                                aria-expanded={isReactionDetailsOpen}
                                aria-label="Ver detalhes das reações"
                              >
                                {reactionSummaryContent}
                              </button>
                            ) : (
                              <div className={summaryButtonClassName}>{reactionSummaryContent}</div>
                            )}
                            {summaryInteractive && isReactionDetailsOpen && messageIdKey ? (
                              <div
                                ref={reactionDetailsPopoverRef}
                                className={`absolute ${
                                  hasOnlyMediaWithoutPadding ? 'bottom-full mb-2' : 'top-full mt-2'
                                } ${
                                  isFromMe ? 'right-0' : 'left-0'
                                } z-50 w-72 max-w-[calc(100vw-4rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl`}
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Reações
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                      Total {reactionSummary.totalCount}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setReactionDetailsMessageId(null)}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                                      aria-label="Fechar detalhes das reações"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2">
                                  {reactionSummary.entries.map(entry => (
                                    <span
                                      key={`summary-chip-${message.id}-${entry.emoji}`}
                                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                                    >
                                      <span className="text-base leading-none">{entry.emoji}</span>
                                      <span>{entry.count}</span>
                                    </span>
                                  ))}
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  {reactionSummary.entries.map(entry => (
                                    <div
                                      key={`details-${message.id}-${entry.emoji}`}
                                      className="border-b border-slate-100 px-3 py-2 last:border-b-0"
                                    >
                                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <span className="text-lg leading-none">{entry.emoji}</span>
                                        <span className="text-xs font-medium text-slate-500">
                                          {entry.count} {entry.count === 1 ? 'reação' : 'reações'}
                                        </span>
                                      </div>
                                      <ul className="mt-2 space-y-2">
                                        {entry.participants.map(participant => {
                                          const phoneLabel = participant.phone
                                            ? formatReactionPhoneNumber(participant.phone)
                                            : null;
                                          return (
                                            <li
                                              key={`${participant.participantId}-${
                                                participant.reactedAt?.getTime() ?? 'sem-horario'
                                              }-${entry.emoji}`}
                                              className="flex items-center justify-between gap-3 text-sm text-slate-600"
                                            >
                                              <div className="min-w-0">
                                                <p className="truncate font-medium text-slate-700">
                                                  {participant.displayName ?? phoneLabel ?? 'Participante'}
                                                </p>
                                                {phoneLabel ? (
                                                  <p className="truncate text-xs text-slate-500">{phoneLabel}</p>
                                                ) : null}
                                              </div>
                                              {participant.reactedAt ? (
                                                <span className="whitespace-nowrap text-xs text-slate-400">
                                                  {formatReactionTime(participant.reactedAt)}
                                                </span>
                                              ) : null}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={`mt-1 flex flex-col gap-1 text-[10px] uppercase tracking-wide text-slate-400 ${
                          isFromMe ? 'items-end text-right' : 'items-start text-left'
                        }`}
                      >
                        {scheduleMetadata ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {scheduleStatusLabel ? <span>{scheduleStatusLabel}</span> : null}
                            {scheduleTimestamp ? (
                              <span className="normal-case text-[11px] text-slate-500">
                                {scheduleTimestamp}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{formatDateTime(message.moment)}</span>
                            <span>{message.isOptimistic ? '(enviando...)' : message.status || ''}</span>
                          </div>
                        )}
                        {scheduleMetadata?.lastError ? (
                          <div className="text-[11px] font-medium normal-case text-rose-500">
                            {scheduleMetadata.lastError}
                          </div>
                        ) : null}
                      </div>
                      {scheduleMetadata && canCancelSchedule && scheduleId ? (
                        <div
                          className={`mt-2 flex flex-wrap gap-2 ${
                            isFromMe ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleCancelScheduledMessage(scheduleId)}
                            disabled={isCancellingSchedule}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400 px-3 py-1 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isCancellingSchedule ? 'Cancelando...' : 'Cancelar agendamento'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4"
            >
              <div
                ref={attachmentMenuRef}
                className="relative flex w-full flex-col gap-3 rounded border border-slate-200 bg-slate-50/60 px-3 py-3"
              >
                {isRecordingAudio ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                        </span>
                        <span>Gravando áudio</span>
                        <span className="text-xs font-medium text-emerald-600">
                          {formatSecondsLabel(recordingDuration)}
                        </span>
                      </div>
                    </div>
                    <LiveAudioVisualizer values={waveformValues} />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelAudioRecording}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-rose-400 hover:text-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleConcludeAudioRecording}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                ) : null}

                {pendingAttachment ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Pré-visualização do anexo
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingAttachment(null)}
                        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        aria-label="Remover anexo pendente"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {pendingAttachment.kind === 'document' ? (
                      <>
                        <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2">
                          <FileText className="h-5 w-5 flex-shrink-0 text-slate-600" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-700">
                              {pendingAttachment.fileName ?? 'Documento selecionado'}
                            </p>
                            <p className="text-xs text-slate-500">
                              .{pendingAttachment.extension.toLowerCase()}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          O texto digitado será enviado junto ao anexo como legenda.
                        </p>
                      </>
                    ) : pendingAttachment.kind === 'audio' ? (
                      <>
                        <AudioMessageBubble
                          src={pendingAttachment.dataUrl}
                          seconds={pendingAttachment.durationSeconds}
                        />
                        <p className="text-xs text-slate-500">
                          Clique em enviar para mandar o áudio. Se adicionar uma mensagem, ela será enviada em seguida.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-black/5">
                          {pendingAttachment.kind === 'image' ? (
                            <img
                              src={pendingAttachment.dataUrl}
                              alt={pendingAttachment.fileName ?? 'Pré-visualização da imagem selecionada'}
                              className="max-h-64 w-full object-contain"
                            />
                          ) : (
                            <video
                              src={pendingAttachment.dataUrl}
                              controls
                              className="max-h-64 w-full bg-black"
                            />
                          )}
                        </div>
                        {pendingAttachment.fileName ? (
                          <p className="truncate text-xs text-slate-500">
                            {pendingAttachment.fileName}
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-500">
                          O texto digitado será enviado junto ao anexo como legenda.
                        </p>
                      </>
                    )}
                  </div>
                ) : null}

                {isScheduleEnabled ? (
                  <div className="rounded-lg border border-emerald-200 bg-white/80 p-3 text-xs text-slate-600 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          Agendamento de mensagem
                        </span>
                        <p className="mt-1 text-sm text-slate-600">
                          A mensagem será enviada automaticamente no horário selecionado.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={disableSchedule}
                        className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-600 transition hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        Remover
                      </button>
                    </div>
                    <div className="mt-3 space-y-1">
                      <label
                        className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                        htmlFor="scheduled-send-at-input"
                      >
                        Data e hora
                      </label>
                      <input
                        id="scheduled-send-at-input"
                        type="datetime-local"
                        value={scheduledSendAt}
                        min={formatDateTimeForInput(new Date(Date.now() + 60 * 1000).toISOString())}
                        onChange={event => {
                          setScheduledSendAt(event.target.value);
                          setScheduleValidationError(null);
                        }}
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                      {scheduleValidationError ? (
                        <p className="text-xs text-red-600">{scheduleValidationError}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleAttachmentMenu}
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Abrir opções de anexos"
                    aria-haspopup="menu"
                    aria-expanded={showAttachmentMenu}
                    disabled={sendingMessage || isRecordingAudio}
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>

                  <QuickRepliesMenu
                    quickReplies={quickReplies}
                    selectedReplyId={selectedQuickReplyId}
                    onSelect={handleQuickReplySelect}
                    onCreate={handleCreateQuickReply}
                    onUpdate={handleUpdateQuickReply}
                    isLoading={quickRepliesLoading}
                    error={quickRepliesError}
                    isOpen={quickRepliesMenuOpen}
                    onOpenChange={handleQuickRepliesMenuOpenChange}
                  />

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (sendingMessage || schedulingMessage || isRecordingAudio) {
                          return;
                        }
                        setShowChatActionsMenu(previous => !previous);
                        setShowAttachmentMenu(false);
                        setQuickRepliesMenuOpen(false);
                      }}
                      className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-haspopup="menu"
                      aria-expanded={showChatActionsMenu}
                      aria-label="Abrir menu de ações do chat"
                      disabled={sendingMessage || schedulingMessage || isRecordingAudio}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {showChatActionsMenu ? (
                      <div
                        className="absolute bottom-full right-0 mb-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                        role="menu"
                      >
                        <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Ações
                        </div>
                        <div className="pb-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowMessageSearch(true);
                              setShowChatActionsMenu(false);
                            }}
                            role="menuitem"
                            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:bg-slate-100"
                          >
                            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                              <Search className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block font-medium">Pesquisar no chat</span>
                              <span className="block text-xs text-slate-500">Encontre mensagens rapidamente</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={enableSchedule}
                            role="menuitem"
                            className="mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:bg-slate-100"
                            disabled={sendingMessage || schedulingMessage || isRecordingAudio}
                          >
                            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                              <Clock className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block font-medium">
                                {isScheduleEnabled ? 'Editar agendamento' : 'Agendar mensagem'}
                              </span>
                              <span className="block text-xs text-slate-500">
                                Defina um horário para enviar automaticamente
                              </span>
                            </span>
                          </button>
                          {isScheduleEnabled ? (
                            <button
                              type="button"
                              onClick={disableSchedule}
                              role="menuitem"
                              className="mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:bg-slate-100"
                              disabled={sendingMessage || schedulingMessage || isRecordingAudio}
                            >
                              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <XCircle className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block font-medium">Remover agendamento</span>
                                <span className="block text-xs text-slate-500">Voltar para envio imediato</span>
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {showAttachmentMenu ? (
                    <div
                      className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                      role="menu"
                    >
                      <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Enviar
                      </div>
                      <div className="pb-2">
                        <button
                          type="button"
                          onClick={openDocumentPicker}
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:bg-slate-100"
                        >
                          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-medium">Documentos</span>
                            <span className="block text-xs text-slate-500">PDF, planilhas e outros formatos</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={openMediaPicker}
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:bg-slate-100"
                        >
                          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                            <ImageIcon className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-medium">Fotos e vídeos</span>
                            <span className="block text-xs text-slate-500">Compartilhe mídias em segundos</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSendContactPrompt}
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:bg-slate-100"
                        >
                          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <UserPlus className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-medium">Contato</span>
                            <span className="block text-xs text-slate-500">Envie dados de um contato rapidamente</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSendLocationPrompt}
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:bg-slate-100"
                        >
                          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                            <MapPin className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-medium">Localização</span>
                            <span className="block text-xs text-slate-500">Compartilhe um endereço com poucos cliques</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="relative flex-1">
                    {slashCommandState ? (
                      <div className="absolute bottom-full left-0 z-10 mb-2 w-72 max-w-full rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
                        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <span>Respostas rápidas</span>
                          <span className="text-slate-400">/{slashCommandState.query || 'todas'}</span>
                        </div>
                        {slashCommandSuggestions.length > 0 ? (
                          <ul className="space-y-1" role="listbox">
                            {slashCommandSuggestions.map((reply, index) => {
                              const isActive = index === slashSuggestionIndex;
                              const label = reply.title?.trim() || reply.text;
                              return (
                                <li key={reply.id}>
                                  <button
                                    type="button"
                                    className={`w-full rounded-lg px-2 py-2 text-left text-sm transition focus:outline-none ${
                                      isActive
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => applySlashQuickReply(reply)}
                                  >
                                    <span className="block truncate font-medium">{label}</span>
                                    {reply.title ? (
                                      <span className="mt-0.5 block text-xs text-slate-500">
                                        {truncateQuickReplyPreview(reply.text)}
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="px-2 py-1 text-xs text-slate-500">Nenhuma resposta rápida encontrada.</p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">Pressione Enter para inserir • Esc para fechar</p>
                      </div>
                    ) : null}
                    <textarea
                      ref={messageInputRef}
                      className="h-full w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-6 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                      maxLength={1000}
                      rows={1}
                      value={messageInput}
                      onChange={handleMessageInputChange}
                      onKeyDown={handleMessageInputKeyDown}
                      placeholder={messagePlaceholder}
                      disabled={sendingMessage || schedulingMessage}
                    />
                  </div>
                  <button
                    type={shouldShowAudioAction ? 'button' : 'submit'}
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isActionButtonDisabled}
                    aria-label={
                      shouldShowAudioAction
                        ? isRecordingAudio
                          ? 'Gravando áudio'
                          : 'Gravar áudio'
                        : 'Enviar mensagem'
                    }
                    onClick={
                      shouldShowAudioAction && !isRecordingAudio
                        ? () => {
                            void handleStartAudioRecording();
                          }
                        : undefined
                    }
                  >
                    {shouldShowAudioAction ? (
                      <Mic className={`h-4 w-4 ${isRecordingAudio ? 'animate-pulse' : ''}`} />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <input
                  ref={documentInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleDocumentChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.json,.csv,.xml"
                />
                <input
                  ref={mediaInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleMediaChange}
                  accept="image/*,video/*"
                />
              </div>
            </form>

            {selectedChatLead ? (
              <ChatLeadDetailsDrawer
                isOpen={showLeadDetails}
                onClose={() => setShowLeadDetails(false)}
                leadId={selectedChatLead.id}
                leadSummary={selectedChatLead}
                contractsSummary={selectedChatContracts}
                financialSummary={selectedChatFinancialSummary}
                statusOptions={activeLeadStatuses}
                onStatusChange={handleChatLeadStatusChange}
                updatingStatus={updatingLeadStatus}
                insight={chatInsight}
                insightStatus={chatInsightStatus}
                insightError={chatInsightError}
                insightSentiment={insightSentimentDisplay}
                onRetryInsight={handleRetryLoadInsight}
                slaBadge={selectedChatSlaBadge}
                slaMetrics={selectedChat?.sla_metrics ?? null}
                agendaSummaryRows={agendaSummaryDisplayRows}
                agendaSummaryLoading={scheduleSummaryLoading}
                agendaUpcoming={agendaUpcomingDisplay}
                agendaUpcomingLoading={upcomingSchedulesLoading}
                agendaError={schedulePanelError}
                onCancelSchedule={handleCancelScheduledMessage}
                onReorderSchedule={handleReorderUpcomingSchedule}
              />
            ) : null}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-500">Selecione uma conversa para começar.</p>
          </div>
        )}
      </section>
      {showNewChatModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Iniciar conversa</h3>
                <p className="text-sm text-slate-500">Escolha o destino da nova conversa.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                aria-label="Fechar modal de nova conversa"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50 px-5">
              {([
                { id: 'contacts', label: 'Contatos salvos' },
                { id: 'leads', label: 'Leads do CRM' },
                { id: 'manual', label: 'Número manual' },
              ] as const).map(tab => {
                const isActive = newChatTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setNewChatTab(tab.id)}
                    className={`relative flex-1 px-4 py-3 text-sm font-medium transition focus:outline-none ${
                      isActive
                        ? 'text-emerald-600'
                        : 'text-slate-500 hover:text-emerald-500'
                    }`}
                  >
                    {tab.label}
                    {isActive ? (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-emerald-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[30rem] overflow-y-auto px-5 py-5">
              {startingConversation ? (
                <p className="mb-3 text-sm font-medium text-emerald-600">
                  Preparando conversa...
                </p>
              ) : null}
              {newChatError ? (
                <p className="mb-3 text-sm text-red-600">{newChatError}</p>
              ) : null}

              {newChatTab === 'contacts' ? (
                <div className="space-y-4">
                  {contactsError ? (
                    <p className="text-sm text-red-600">{contactsError}</p>
                  ) : null}
                  <div>
                    <label className="sr-only" htmlFor="new-chat-contact-search">
                      Pesquisar contatos salvos
                    </label>
                    <input
                      id="new-chat-contact-search"
                      type="search"
                      value={contactSearchTerm}
                      onChange={event => setContactSearchTerm(event.target.value)}
                      placeholder="Pesquisar por nome ou telefone"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      autoComplete="off"
                    />
                  </div>
                  {contactsLoading && contacts.length === 0 ? (
                    <p className="text-sm text-slate-500">Carregando contatos salvos...</p>
                  ) : contacts.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum contato salvo encontrado.</p>
                  ) : filteredContactsList.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Nenhum contato corresponde à sua pesquisa.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredContactsList.map(contact => {
                        const displayName = contact.name ?? contact.phone;
                        const initials = displayName.trim().charAt(0).toUpperCase();
                        return (
                          <button
                            key={contact.phone}
                            type="button"
                            disabled={startingConversation}
                            onClick={() => {
                              void handleStartConversation(contact.phone, contact.name);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-emerald-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-600">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
                              <p className="truncate text-xs text-slate-500">
                                {contact.phone}
                                {contact.isBusiness ? ' • Conta comercial' : ''}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : newChatTab === 'leads' ? (
                <div className="space-y-4">
                  {leadsError ? (
                    <p className="text-sm text-red-600">{leadsError}</p>
                  ) : null}
                  <div>
                    <label className="sr-only" htmlFor="new-chat-lead-search">
                      Pesquisar leads do CRM
                    </label>
                    <input
                      id="new-chat-lead-search"
                      type="search"
                      value={leadSearchTerm}
                      onChange={event => setLeadSearchTerm(event.target.value)}
                      placeholder="Pesquisar por nome, status ou telefone"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      autoComplete="off"
                    />
                  </div>
                  {leadsLoading && leads.length === 0 ? (
                    <p className="text-sm text-slate-500">Carregando leads do CRM...</p>
                  ) : leads.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum lead disponível para iniciar conversa.</p>
                  ) : filteredLeads.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Nenhum lead corresponde à sua pesquisa.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredLeads.map(lead => {
                        const hasPhone = Boolean(lead.telefone);
                        const leadName = lead.nome_completo?.trim() || 'Lead sem nome';
                        const leadInitial = leadName.charAt(0).toUpperCase();
                        return (
                          <button
                            key={lead.id}
                            type="button"
                            disabled={!hasPhone || startingConversation}
                            onClick={() => {
                              if (!lead.telefone) {
                                return;
                              }
                              void handleStartConversation(lead.telefone, leadName);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                              hasPhone
                                ? 'hover:border-emerald-500 hover:shadow-md'
                                : 'cursor-not-allowed opacity-50'
                            }`}
                          >
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                              {leadInitial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {leadName}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {lead.telefone ? lead.telefone : 'Sem telefone cadastrado'}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {lead.status ? `Status: ${lead.status}` : 'Status não informado'}
                                {lead.responsavel ? ` • Resp.: ${lead.responsavel}` : ''}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleManualChatSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="new-chat-manual-phone">
                      Número de telefone
                    </label>
                    <input
                      id="new-chat-manual-phone"
                      type="tel"
                      inputMode="numeric"
                      value={manualPhoneInput}
                      onChange={event => setManualPhoneInput(event.target.value.replace(/\D+/g, ''))}
                      placeholder="Ex.: 11999999999"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      autoComplete="off"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Informe apenas números com DDD. Caso seja número internacional, inclua o código do país.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={startingConversation || manualPhoneInput.trim().length < 8}
                  >
                    Iniciar conversa
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <WhatsappCampaignDrawer
        isOpen={showCampaignDrawer && Boolean(selectedChat)}
        onClose={() => setShowCampaignDrawer(false)}
        context={
          selectedChat
            ? {
                chatId: selectedChat.id,
                leadId: selectedChatLead?.id ?? null,
                phone: selectedChat.phone,
                displayName: selectedChatDisplayName,
              }
            : null
        }
      />
    </div>
  );

  return (
    <>
      <div
        className={`flex h-full min-h-0 flex-col gap-4 ${
          shouldHideMobileBottomMenu ? 'pb-4 md:pb-0' : 'pb-24 md:pb-0'
        }`}
      >
        <div className="flex-1 min-h-0">
          {activeSection === 'painel' ? (
            conversationWorkspace
          ) : (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-200 p-4">
                <button
                  type="button"
                  onClick={returnToWhatsappChats}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  aria-label="Voltar para as conversas do WhatsApp"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Voltar
                </button>
                <div>
                  <p className="text-lg font-semibold text-slate-800">Configurações do WhatsApp</p>
                  <p className="text-sm text-slate-500">Gerencie preferências e integrações</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <WhatsappSettingsPanel />
              </div>
            </div>
          )}
        </div>
      </div>
      {shouldHideMobileBottomMenu ? null : (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <nav className="grid grid-cols-2 divide-x divide-slate-200" aria-label="Menu inferior do WhatsApp">
            {WHATSAPP_SECTIONS.map(section => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={`mobile-${section.id}`}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full flex-col items-center gap-1 py-2 text-xs font-semibold transition ${
                    isActive ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
