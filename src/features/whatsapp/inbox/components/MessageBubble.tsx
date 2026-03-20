import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCheck, Clock, AlertCircle, Edit3, Trash2, History, Smile, ExternalLink, X, ChevronDown, ChevronLeft, ChevronRight, CornerUpLeft, CornerUpRight, Loader2, UserPlus, MessageCircle, Download, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react';
import { MessageHistoryModal } from './MessageHistoryModal';
import { WhatsAppFormattedText } from '../../shared/components/WhatsAppFormattedText';
import ModalShell from '../../../../components/ui/ModalShell';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import { getWhatsAppMedia } from '../../../../lib/whatsappApiService';
import { formatPhoneDisplay } from '../../../../lib/phoneFormatting';
import { resolveWhatsAppMessageBody } from '../../../../lib/whatsappMessageBody';
import { getWhatsAppAudioTranscription } from '../../../../lib/whatsappAudioTranscription';
import { SAO_PAULO_TIMEZONE, getDateKey } from '../../../../lib/dateUtils';
import { supabase } from '../../../../lib/supabase';
import { toast } from '../../../../lib/toast';
import { saveStickerToLibrary } from '../../shared/stickerLibrary';

type SaveSharedContactResult = {
  alreadySaved?: boolean;
};

type MediaPreviewState = {
  messageId: string;
  kind: 'image' | 'video' | 'sticker';
  src: string | null;
  caption: string;
  title: string;
  fileName: string;
  poster?: string;
  isLoading: boolean;
  timestamp: string | null;
  fromName?: string;
  galleryItems: MediaGalleryItem[];
  galleryIndex: number;
};

export type MediaGalleryItem = {
  messageId: string;
  body: string | null;
  type: string | null;
  hasMedia: boolean;
  payload?: MessagePayload | null;
  timestamp: string | null;
  fromName?: string;
  isDeleted?: boolean;
};

type VisualMediaDescriptor = {
  kind: 'image' | 'video' | 'sticker';
  mediaId: string | null;
  directSrc: string;
  previewSrc: string;
  displayUrl: string | null;
  needsUpgrade: boolean;
  caption: string;
  title: string;
  fileName: string;
  poster?: string;
};

export interface MessageBubbleProps {
  id: string;
  chatId: string;
  body: string | null;
  type: string | null;
  direction: 'inbound' | 'outbound';
  timestamp: string | null;
  ackStatus: number | null;
  sendState?: 'pending' | 'failed' | null;
  errorMessage?: string | null;
  hasMedia: boolean;
  payload?: MessagePayload | null;
  reactions?: Array<{ emoji: string; count: number }>;
  fromName?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editCount?: number;
  editedAt?: string | null;
  originalBody?: string | null;
  onReply?: (messageId: string, body: string, from: string) => void;
  onForward?: () => void;
  onEdit?: (messageId: string, body: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRetryFailed?: () => void;
  onDismissFailed?: () => void;
  onTranscriptionSaved?: (messageId: string, payload: MessagePayload) => void;
  onSaveSharedContact?: (contact: { name: string; phone: string }) => Promise<SaveSharedContactResult | void> | SaveSharedContactResult | void;
  onOpenSharedContactChat?: (contact: { name: string; phone: string }) => void;
  isForwarded?: boolean;
  mediaGalleryItems?: MediaGalleryItem[];
}

type MediaPayload = {
  id?: string;
  media_id?: string;
  mediaId?: string;
  link?: string;
  url?: string;
  file?: string;
  path?: string;
  preview?: string;
  filename?: string;
  name?: string;
  mime_type?: string;
  mimetype?: string;
  seconds?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};

export type MessagePayload = MediaPayload & {
  audio?: MediaPayload;
  voice?: MediaPayload;
  media?: MediaPayload;
  image?: MediaPayload;
  gif?: MediaPayload;
  sticker?: MediaPayload;
  video?: MediaPayload;
  document?: MediaPayload;
  contact?: {
    name?: string;
    vcard?: string;
    phone?: string;
    [key: string]: unknown;
  };
  contact_list?: {
    list?: Array<{
      name?: string;
      vcard?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  link_preview?: {
    url?: string;
    canonical?: string;
    link?: string;
    title?: string;
    description?: string;
    preview?: string;
    image?: string;
    thumbnail?: string;
    [key: string]: unknown;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function areReactionsEqual(
  left?: Array<{ emoji: string; count: number }>,
  right?: Array<{ emoji: string; count: number }>,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every(
    (reaction, index) =>
      reaction.emoji === right[index]?.emoji &&
      reaction.count === right[index]?.count,
  );
}

function areMessageBubblePropsEqual(
  prev: MessageBubbleProps,
  next: MessageBubbleProps,
) {
  return (
    prev.id === next.id &&
    prev.chatId === next.chatId &&
    prev.body === next.body &&
    prev.type === next.type &&
    prev.direction === next.direction &&
    prev.timestamp === next.timestamp &&
    prev.ackStatus === next.ackStatus &&
    prev.sendState === next.sendState &&
    prev.errorMessage === next.errorMessage &&
    prev.hasMedia === next.hasMedia &&
    prev.payload === next.payload &&
    areReactionsEqual(prev.reactions, next.reactions) &&
    prev.fromName === next.fromName &&
    prev.isDeleted === next.isDeleted &&
    prev.deletedAt === next.deletedAt &&
    prev.editCount === next.editCount &&
    prev.editedAt === next.editedAt &&
    prev.originalBody === next.originalBody &&
    Boolean(prev.onReply) === Boolean(next.onReply) &&
    Boolean(prev.onForward) === Boolean(next.onForward) &&
    Boolean(prev.onEdit) === Boolean(next.onEdit) &&
    Boolean(prev.onReact) === Boolean(next.onReact) &&
    Boolean(prev.onRetryFailed) === Boolean(next.onRetryFailed) &&
    Boolean(prev.onDismissFailed) === Boolean(next.onDismissFailed) &&
    Boolean(prev.onTranscriptionSaved) === Boolean(next.onTranscriptionSaved) &&
    Boolean(prev.onSaveSharedContact) === Boolean(next.onSaveSharedContact) &&
    Boolean(prev.onOpenSharedContactChat) === Boolean(next.onOpenSharedContactChat) &&
    prev.isForwarded === next.isForwarded &&
    prev.mediaGalleryItems === next.mediaGalleryItems
  );
}

const MESSAGE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const MESSAGE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DEFAULT_IMAGE_ASPECT_RATIO = 4 / 5;
const DEFAULT_VIDEO_ASPECT_RATIO = 9 / 16;
const VIEWPORT_PRELOAD_ROOT_MARGIN = '240px';

const isMp4Asset = (value: string | null | undefined) => Boolean(value && /\.mp4(?:[?#].*)?$/i.test(value));

function readPositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function resolveAspectRatio(primary?: MediaPayload | null, fallback?: MediaPayload | null, defaultRatio: number = 1) {
  const width = readPositiveNumber(primary?.width) ?? readPositiveNumber(fallback?.width);
  const height = readPositiveNumber(primary?.height) ?? readPositiveNumber(fallback?.height);

  if (!width || !height) {
    return defaultRatio;
  }

  return width / height;
}

function resolveVisualMediaDescriptor(params: {
  body: string | null;
  type: string | null;
  hasMedia: boolean;
  payload?: MessagePayload | null;
  isDeleted?: boolean;
}): VisualMediaDescriptor | null {
  const { body, type, hasMedia, payload, isDeleted = false } = params;
  if (isDeleted || !hasMedia) {
    return null;
  }

  const payloadData: MessagePayload = payload && typeof payload === 'object' ? payload : {};
  const resolvedBody = resolveWhatsAppMessageBody({ body, type, payload });
  const normalizedType = (type || '').toLowerCase();

  const imageDirectSrc =
    payloadData?.image?.url ||
    payloadData?.image?.file ||
    payloadData?.image?.path ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.image?.link ||
    '';
  const imagePreviewSrc = payloadData?.image?.preview || payloadData?.media?.preview || '';
  const stickerDirectSrc =
    payloadData?.sticker?.url ||
    payloadData?.sticker?.file ||
    payloadData?.sticker?.path ||
    payloadData?.sticker?.link ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    '';
  const stickerPreviewSrc =
    payloadData?.sticker?.preview ||
    payloadData?.image?.preview ||
    payloadData?.media?.preview ||
    '';
  const gifDirectSrc =
    payloadData?.gif?.url ||
    payloadData?.image?.url ||
    payloadData?.gif?.file ||
    payloadData?.gif?.path ||
    payloadData?.image?.file ||
    payloadData?.image?.path ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.gif?.link ||
    payloadData?.video?.link ||
    payloadData?.media?.link ||
    payloadData?.image?.link ||
    '';
  const gifPreviewSrc =
    payloadData?.gif?.preview ||
    payloadData?.image?.preview ||
    payloadData?.video?.preview ||
    payloadData?.media?.preview ||
    '';
  const videoDirectSrc =
    payloadData?.video?.url ||
    payloadData?.video?.file ||
    payloadData?.video?.path ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.video?.link ||
    '';
  const videoPreviewSrc = payloadData?.video?.preview || payloadData?.image?.preview || payloadData?.media?.preview || '';
  const visualMediaId =
    payloadData?.sticker?.id ||
    payloadData?.sticker?.media_id ||
    payloadData?.sticker?.mediaId ||
    payloadData?.gif?.id ||
    payloadData?.gif?.media_id ||
    payloadData?.gif?.mediaId ||
    payloadData?.image?.id ||
    payloadData?.image?.media_id ||
    payloadData?.image?.mediaId ||
    payloadData?.video?.id ||
    payloadData?.video?.media_id ||
    payloadData?.video?.mediaId ||
    payloadData?.media?.id ||
    payloadData?.media_id ||
    payloadData?.mediaId ||
    null;
  const isStickerMessage = normalizedType === 'sticker' || Boolean(payloadData?.sticker);
  const isGifMessage = !isStickerMessage && (normalizedType === 'gif' || Boolean(payloadData?.gif));
  const isImageMessage = !isStickerMessage && !isGifMessage && (normalizedType.startsWith('image') || Boolean(payloadData?.image));
  const isVideoMessage = !isGifMessage && (normalizedType.startsWith('video') || Boolean(payloadData?.video));

  if (!isStickerMessage && !isGifMessage && !isImageMessage && !isVideoMessage) {
    return null;
  }

  const visualDirectSrc = isVideoMessage ? videoDirectSrc : isGifMessage ? gifDirectSrc : isStickerMessage ? stickerDirectSrc : imageDirectSrc;
  const visualPreviewSrc = isVideoMessage ? videoPreviewSrc : isGifMessage ? gifPreviewSrc : isStickerMessage ? stickerPreviewSrc : imagePreviewSrc;
  const displayUrl = visualDirectSrc || visualPreviewSrc || null;
  const resolvedKind = isVideoMessage
    ? 'video'
    : isStickerMessage
      ? 'sticker'
      : isGifMessage && isMp4Asset(displayUrl)
        ? 'video'
        : 'image';
  const videoPoster = payloadData?.video?.preview || payloadData?.image?.preview || payloadData?.media?.preview || undefined;

  return {
    kind: resolvedKind,
    mediaId: visualMediaId,
    directSrc: visualDirectSrc,
    previewSrc: visualPreviewSrc,
    displayUrl,
    needsUpgrade: Boolean(visualMediaId && !visualDirectSrc),
    caption: isVideoMessage ? resolvedBody && resolvedBody !== '[Vídeo]' && resolvedBody !== '[Video]' && resolvedBody !== '[Vídeo de status]' ? resolvedBody : '' : isGifMessage ? resolvedBody && resolvedBody !== '[GIF]' ? resolvedBody : '' : isStickerMessage ? resolvedBody && resolvedBody !== '[Sticker]' && resolvedBody !== '[Figurinha]' ? resolvedBody : '' : resolvedBody && resolvedBody !== '[Imagem]' && resolvedBody !== '[Imagem de status]' ? resolvedBody : '',
    title: isGifMessage ? 'GIF' : resolvedKind === 'video' ? 'Vídeo' : resolvedKind === 'sticker' ? 'Sticker' : 'Foto',
    fileName: isVideoMessage
      ? payloadData?.video?.filename || payloadData?.video?.name || 'video'
      : isGifMessage
        ? payloadData?.gif?.filename || payloadData?.gif?.name || 'gif'
        : isStickerMessage
          ? payloadData?.sticker?.filename || payloadData?.sticker?.name || 'sticker'
          : payloadData?.image?.filename || payloadData?.image?.name || 'imagem',
    poster: resolvedKind === 'video' ? (isGifMessage ? gifPreviewSrc || videoPoster : videoPoster) : undefined,
  };
}

function MessageBubbleComponent({
  id,
  chatId,
  body,
  type,
  direction,
  timestamp,
  ackStatus,
  sendState,
  errorMessage,
  hasMedia,
  payload,
  reactions,
  fromName,
  isDeleted = false,
  deletedAt,
  editCount = 0,
  onReply,
  onForward,
  onEdit,
  onReact,
  onRetryFailed,
  onDismissFailed,
  onTranscriptionSaved,
  onSaveSharedContact,
  onOpenSharedContactChat,
  isForwarded = false,
  mediaGalleryItems,
}: MessageBubbleProps) {
  const isOutbound = direction === 'outbound';
  const [showHistory, setShowHistory] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewState | null>(null);
  const [audioMediaUrl, setAudioMediaUrl] = useState<string | null>(null);
  const [audioMediaLoading, setAudioMediaLoading] = useState(false);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioRateIndex, setAudioRateIndex] = useState(0);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuOpenUpward, setActionMenuOpenUpward] = useState(false);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [visualMediaUrl, setVisualMediaUrl] = useState<string | null>(null);
  const [visualMediaLoading, setVisualMediaLoading] = useState(false);
  const [mediaZoom, setMediaZoom] = useState(1);
  const [mediaOffset, setMediaOffset] = useState({ x: 0, y: 0 });
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [localPayload, setLocalPayload] = useState<MessagePayload | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [sharedContactLoading, setSharedContactLoading] = useState(false);
  const [sharedContactSaved, setSharedContactSaved] = useState(false);
  const [savingStickerToLibrary, setSavingStickerToLibrary] = useState(false);
  const [saveContactModalState, setSaveContactModalState] = useState<{ name: string; phone: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const mediaViewportRef = useRef<HTMLDivElement | null>(null);
  const saveContactNameInputRef = useRef<HTMLInputElement | null>(null);
  const mediaDragStateRef = useRef<{ pointerId: number | null; startX: number; startY: number; originX: number; originY: number }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const audioAutoplayRequestedRef = useRef(false);
  const hasHistory = editCount > 0 || isDeleted;
  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const closeActionMenu = useCallback(() => {
    setShowActionMenu(false);
    setShowReactionPicker(false);
    setActionMenuPosition(null);
  }, []);

  const clampMediaOffset = useCallback((offset: { x: number; y: number }, zoom: number) => {
    if (zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const viewport = mediaViewportRef.current?.getBoundingClientRect();
    if (!viewport) {
      return offset;
    }

    const maxX = Math.max(0, ((viewport.width * zoom) - viewport.width) / 2);
    const maxY = Math.max(0, ((viewport.height * zoom) - viewport.height) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, offset.x)),
      y: Math.min(maxY, Math.max(-maxY, offset.y)),
    };
  }, []);

  const resetMediaTransform = useCallback(() => {
    setMediaZoom(1);
    setMediaOffset({ x: 0, y: 0 });
    mediaDragStateRef.current.pointerId = null;
  }, []);

  const updateMediaZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = Math.min(4, Math.max(1, Number(nextZoom.toFixed(2))));
      setMediaZoom(clampedZoom);
      setMediaOffset((current) => clampMediaOffset(current, clampedZoom));
      if (clampedZoom <= 1) {
        mediaDragStateRef.current.pointerId = null;
      }
    },
    [clampMediaOffset],
  );

  const showFailedActions = isOutbound && sendState === 'failed' && (onRetryFailed || onDismissFailed);

  const repositionActionMenu = useCallback(() => {
    const menu = actionMenuRef.current;
    const trigger = actionMenuButtonRef.current;
    if (!menu || !trigger) return;

    const spacing = 8;
    const viewportPadding = 12;
    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const shouldOpenUpward = spaceBelow < menuHeight + spacing && spaceAbove > spaceBelow;
    const unclampedLeft = triggerRect.right - menuWidth;
    const left = Math.min(
      Math.max(unclampedLeft, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
    );
    const top = shouldOpenUpward
      ? Math.max(viewportPadding, triggerRect.top - menuHeight - spacing)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, triggerRect.bottom + spacing);

    setActionMenuOpenUpward((previous) => (previous === shouldOpenUpward ? previous : shouldOpenUpward));
    setActionMenuPosition((previous) => {
      if (previous && previous.top === top && previous.left === left) {
        return previous;
      }
      return { top, left };
    });
  }, []);

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return '';

    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '';

    const currentDayKey = getDateKey(date, SAO_PAULO_TIMEZONE);
    const todayKey = getDateKey(new Date(), SAO_PAULO_TIMEZONE);
    const timeLabel = MESSAGE_TIME_FORMATTER.format(date);

    if (currentDayKey === todayKey) {
      return timeLabel;
    }

    const yesterdayKey = getDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000), SAO_PAULO_TIMEZONE);
    if (currentDayKey === yesterdayKey) {
      return `Ontem ${timeLabel}`;
    }

    return MESSAGE_DATE_TIME_FORMATTER.format(date).replace(',', '');
  };

  const formatDateTimeInSaoPaulo = (value: string | null | undefined) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return MESSAGE_DATE_TIME_FORMATTER.format(parsed).replace(',', '');
  };

  const getAckIcon = () => {
    if (ackStatus === null || !isOutbound) return null;

    switch (ackStatus) {
      case 0:
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 1:
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 2:
        return <Check className="w-3 h-3 text-gray-400" />;
      case 3:
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 4:
        return <CheckCheck className="w-3 h-3 text-amber-600" />;
      default:
        return <Check className="w-3 h-3 text-gray-400" />;
    }
  };

  const getAckLabel = () => {
    if (ackStatus === null) return '';

    switch (ackStatus) {
      case 0:
        return 'Falhou';
      case 1:
        return 'Pendente';
      case 2:
        return 'Enviado';
      case 3:
        return 'Entregue';
      case 4:
        return 'Lido';
      default:
        return '';
    }
  };

  const parseVcard = (vcard?: string | null) => {
    if (!vcard) return { name: '', phone: '' };
    const nameMatch = vcard.match(/^FN:(.*)$/m) || vcard.match(/^FN;.*:(.*)$/m);
    const phoneMatch = vcard.match(/^TEL.*:(.*)$/m);
    return {
      name: nameMatch?.[1]?.trim() || '',
      phone: phoneMatch?.[1]?.replace(/\D/g, '') || '',
    };
  };

  const formatPhone = (phone: string) => {
    return formatPhoneDisplay(phone);
  };

  const handleOpenSaveContactModal = (contact: { name: string; phone: string }) => {
    const suggestedName = contact.name.trim();
    setSaveContactModalState({
      name: suggestedName && suggestedName !== 'Contato' ? suggestedName : '',
      phone: contact.phone,
    });
  };

  const handleConfirmSaveContact = async () => {
    if (!saveContactModalState || !onSaveSharedContact || sharedContactLoading) return;

    const resolvedName = saveContactModalState.name.trim();
    if (!resolvedName) return;

    setSharedContactLoading(true);

    try {
      await onSaveSharedContact({
        name: resolvedName,
        phone: saveContactModalState.phone,
      });
      setSharedContactSaved(true);
      setSaveContactModalState(null);
    } catch {
      // Feedback is handled by the caller.
    } finally {
      setSharedContactLoading(false);
    }
  };

  const handleSaveContactNameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    if (sharedContactLoading || !saveContactModalState?.name.trim()) return;
    void handleConfirmSaveContact();
  };

  useEffect(() => {
    if (!saveContactModalState || sharedContactLoading) return;

    const frameId = requestAnimationFrame(() => {
      const input = saveContactNameInputRef.current;
      if (!input) return;

      input.focus();
      const caretPosition = input.value.length;
      input.setSelectionRange(caretPosition, caretPosition);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [saveContactModalState, sharedContactLoading]);

  useEffect(() => {
    setLocalPayload(payload && typeof payload === 'object' ? (payload as MessagePayload) : null);
  }, [payload]);

  const payloadData: MessagePayload = useMemo(
    () => localPayload || (payload && typeof payload === 'object' ? payload : {}),
    [localPayload, payload],
  );
  const resolvedBody = resolveWhatsAppMessageBody({ body, type, payload });
  const transcription = getWhatsAppAudioTranscription(payloadData);
  const normalizedType = (type || '').toLowerCase();
  const audioPayload: MediaPayload | null = payloadData.audio || payloadData.voice || payloadData.media || payloadData;
  const audioMediaId = audioPayload?.id || payloadData?.media?.id || payloadData?.voice?.id || payloadData?.audio?.id || null;
  const audioDirectSrc = audioPayload?.link || audioPayload?.url || audioPayload?.file || audioPayload?.path || null;
  const audioUrl = audioMediaUrl || audioDirectSrc;
  const imageDirectSrc =
    payloadData?.image?.url ||
    payloadData?.image?.file ||
    payloadData?.image?.path ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.image?.link ||
    '';
  const imagePreviewSrc = payloadData?.image?.preview || payloadData?.media?.preview || '';
  const stickerDirectSrc =
    payloadData?.sticker?.url ||
    payloadData?.sticker?.file ||
    payloadData?.sticker?.path ||
    payloadData?.sticker?.link ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    '';
  const stickerPreviewSrc =
    payloadData?.sticker?.preview ||
    payloadData?.image?.preview ||
    payloadData?.media?.preview ||
    '';
  const gifDirectSrc =
    payloadData?.gif?.url ||
    payloadData?.image?.url ||
    payloadData?.gif?.file ||
    payloadData?.gif?.path ||
    payloadData?.image?.file ||
    payloadData?.image?.path ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.gif?.link ||
    payloadData?.video?.link ||
    payloadData?.media?.link ||
    payloadData?.image?.link ||
    '';
  const gifPreviewSrc =
    payloadData?.gif?.preview ||
    payloadData?.image?.preview ||
    payloadData?.video?.preview ||
    payloadData?.media?.preview ||
    '';
  const videoDirectSrc =
    payloadData?.video?.url ||
    payloadData?.video?.file ||
    payloadData?.video?.path ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.video?.link ||
    '';
  const videoPreviewSrc = payloadData?.video?.preview || payloadData?.image?.preview || payloadData?.media?.preview || '';
  const visualMediaId =
    payloadData?.sticker?.id ||
    payloadData?.sticker?.media_id ||
    payloadData?.sticker?.mediaId ||
    payloadData?.gif?.id ||
    payloadData?.gif?.media_id ||
    payloadData?.gif?.mediaId ||
    payloadData?.image?.id ||
    payloadData?.image?.media_id ||
    payloadData?.image?.mediaId ||
    payloadData?.video?.id ||
    payloadData?.video?.media_id ||
    payloadData?.video?.mediaId ||
    payloadData?.media?.id ||
    payloadData?.media_id ||
    payloadData?.mediaId ||
    null;
  const isStickerMessage = hasMedia && (normalizedType === 'sticker' || Boolean(payloadData?.sticker));
  const isGifMessage = hasMedia && !isStickerMessage && (normalizedType === 'gif' || Boolean(payloadData?.gif));
  const isImageMessage = hasMedia && !isStickerMessage && !isGifMessage && (normalizedType.startsWith('image') || Boolean(payloadData?.image));
  const isVideoMessage = hasMedia && !isGifMessage && (normalizedType.startsWith('video') || Boolean(payloadData?.video));
  const isVisualMediaMessage = !isDeleted && (isStickerMessage || isGifMessage || isImageMessage || isVideoMessage);
  const isAudioMessage = hasMedia && (normalizedType.startsWith('audio') || normalizedType === 'ptt' || normalizedType === 'voice');
  const canReact = Boolean(onReact && !isDeleted);
  const canReply = Boolean(onReply && !isDeleted);
  const canForward = Boolean(onForward && !isDeleted);
  const canEditMessage = Boolean(onEdit && isOutbound && !isDeleted && !hasMedia);
  const canViewHistory = hasHistory;
  const canSaveSticker = Boolean(isStickerMessage && !isDeleted);
  const hasActionMenu = canReact || canReply || canForward || canEditMessage || canViewHistory || canSaveSticker;
  const visualDirectSrc = isVideoMessage ? videoDirectSrc : isGifMessage ? gifDirectSrc : isStickerMessage ? stickerDirectSrc : imageDirectSrc;
  const visualPreviewSrc = isVideoMessage ? videoPreviewSrc : isGifMessage ? gifPreviewSrc : isStickerMessage ? stickerPreviewSrc : imagePreviewSrc;
  const visualDisplayUrl = visualMediaUrl || visualDirectSrc || visualPreviewSrc || null;
  const visualNeedsUpgrade = Boolean(visualMediaId && !visualMediaUrl && !visualDirectSrc);
  const visualAspectRatio = isStickerMessage
    ? resolveAspectRatio(payloadData.sticker, payloadData.media, 1)
    : isGifMessage
    ? resolveAspectRatio(payloadData.gif, payloadData.video || payloadData.image || payloadData.media, 1)
    : isVideoMessage
    ? resolveAspectRatio(payloadData.video, payloadData.media, DEFAULT_VIDEO_ASPECT_RATIO)
    : resolveAspectRatio(payloadData.image, payloadData.media, DEFAULT_IMAGE_ASPECT_RATIO);
  const documentPayload = payloadData?.document || payloadData?.media;
  const documentLink = documentPayload?.link || documentPayload?.url || documentPayload?.file || documentPayload?.path;
  const documentName = documentPayload?.filename || documentPayload?.name || 'Documento';
  const documentMime = documentPayload?.mime_type || documentPayload?.mimetype || '';
  const isPdf = (documentMime || '').toLowerCase().includes('pdf') || documentName.toLowerCase().endsWith('.pdf');
  const imageCaption = resolvedBody && resolvedBody !== '[Imagem]' && resolvedBody !== '[Imagem de status]' ? resolvedBody : '';
  const videoCaption =
    resolvedBody &&
    resolvedBody !== '[Vídeo]' &&
    resolvedBody !== '[Video]' &&
    resolvedBody !== '[Vídeo de status]'
      ? resolvedBody
      : '';
  const gifCaption = resolvedBody && resolvedBody !== '[GIF]' ? resolvedBody : '';
  const videoPoster = payloadData?.video?.preview || payloadData?.image?.preview || payloadData?.media?.preview || undefined;
  const currentMediaGalleryItem = useMemo<MediaGalleryItem>(
    () => ({
      messageId: id,
      body,
      type,
      hasMedia,
      payload: payloadData,
      timestamp,
      fromName,
      isDeleted,
    }),
    [body, fromName, hasMedia, id, isDeleted, payloadData, timestamp, type],
  );
  const availableMediaGalleryItems = useMemo(
    () => (mediaGalleryItems && mediaGalleryItems.length > 0 ? mediaGalleryItems : isVisualMediaMessage ? [currentMediaGalleryItem] : []),
    [currentMediaGalleryItem, isVisualMediaMessage, mediaGalleryItems],
  );

  useEffect(() => {
    const element = bubbleRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: VIEWPORT_PRELOAD_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const loadAudioMedia = useCallback(async () => {
    if (audioUrl) return audioUrl;
    if (!audioMediaId || audioMediaLoading) return null;
    setAudioMediaLoading(true);
    try {
      const response = await getWhatsAppMedia(audioMediaId, { preferObjectUrl: true });
      const nextUrl = response.url || response.objectUrl || null;
      if (nextUrl) {
        setAudioMediaUrl(nextUrl);
        return nextUrl;
      }
    } catch (error) {
      console.error('Erro ao carregar áudio:', error);
    } finally {
      setAudioMediaLoading(false);
    }
    return null;
  }, [audioMediaId, audioMediaLoading, audioUrl]);

  useEffect(() => {
    if (!isAudioMessage || !isNearViewport || audioUrl || audioMediaLoading) return;
    void loadAudioMedia();
  }, [audioMediaLoading, audioUrl, isAudioMessage, isNearViewport, loadAudioMedia]);

  useEffect(() => {
    if (!showActionMenu) {
      setActionMenuOpenUpward(false);
      setActionMenuPosition(null);
      return;
    }

    const rafId = window.requestAnimationFrame(repositionActionMenu);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionMenuRef.current?.contains(target) || actionMenuButtonRef.current?.contains(target)) {
        return;
      }
      closeActionMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeActionMenu();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', repositionActionMenu);
    window.addEventListener('scroll', repositionActionMenu, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', repositionActionMenu);
      window.removeEventListener('scroll', repositionActionMenu, true);
    };
  }, [closeActionMenu, repositionActionMenu, showActionMenu, showReactionPicker]);

  const loadDocumentMedia = useCallback(async () => {
    const mediaId = documentPayload?.id || payloadData?.media?.id || payloadData?.document?.id;
    if (documentUrl) return documentUrl;
    if (!mediaId || documentLoading) return null;
    setDocumentLoading(true);
    try {
      const response = await getWhatsAppMedia(mediaId, { preferObjectUrl: true });
      const nextUrl = response.url || response.objectUrl || null;
      if (nextUrl) {
        setDocumentUrl(nextUrl);
        return nextUrl;
      }
    } catch (error) {
      console.error('Erro ao carregar documento:', error);
    } finally {
      setDocumentLoading(false);
    }
    return null;
  }, [documentLoading, documentPayload?.id, documentUrl, payloadData?.document?.id, payloadData?.media?.id]);

  const handleSaveStickerToLibrary = useCallback(async () => {
    if (!canSaveSticker || savingStickerToLibrary) return;

    setSavingStickerToLibrary(true);
    try {
      const stickerName = payloadData?.sticker?.filename || payloadData?.sticker?.name || `sticker-${id}.webp`;
      const stickerMime = payloadData?.sticker?.mime_type || payloadData?.sticker?.mimetype || 'image/webp';

      let stickerBlob: Blob | null = null;

      if (visualMediaId) {
        const mediaResponse = await getWhatsAppMedia(visualMediaId, { forceRefresh: true });
        if (mediaResponse.data instanceof Blob) {
          stickerBlob = mediaResponse.data;
        } else if (mediaResponse.url) {
          const fetched = await fetch(mediaResponse.url);
          if (!fetched.ok) {
            throw new Error('Nao foi possivel baixar a figurinha.');
          }
          stickerBlob = await fetched.blob();
        }
      }

      if (!stickerBlob && visualDisplayUrl) {
        const fetched = await fetch(visualDisplayUrl);
        if (!fetched.ok) {
          throw new Error('Nao foi possivel baixar a figurinha.');
        }
        stickerBlob = await fetched.blob();
      }

      if (!stickerBlob) {
        throw new Error('Figurinha indisponivel para salvar.');
      }

      const stickerFile = new File([stickerBlob], stickerName, {
        type: stickerBlob.type || stickerMime,
        lastModified: Date.now(),
      });

      const result = await saveStickerToLibrary(stickerFile, stickerName);
      toast.success(result.alreadySaved ? 'Figurinha atualizada na loja.' : 'Figurinha salva na loja.');
      closeActionMenu();
    } catch (error) {
      console.error('Erro ao salvar figurinha na loja:', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar a figurinha.');
    } finally {
      setSavingStickerToLibrary(false);
    }
  }, [canSaveSticker, closeActionMenu, id, payloadData?.sticker?.filename, payloadData?.sticker?.mime_type, payloadData?.sticker?.mimetype, payloadData?.sticker?.name, savingStickerToLibrary, visualDisplayUrl, visualMediaId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      setAudioDuration(audio.duration || 0);
    };

    const handleTime = () => {
      setAudioCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setAudioIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioUrl || !audioAutoplayRequestedRef.current) return;

    const audio = audioRef.current;
    if (!audio) return;

    audioAutoplayRequestedRef.current = false;
    void audio.play().then(() => {
      setAudioIsPlaying(true);
    }).catch((error) => {
      console.error('Erro ao reproduzir áudio:', error);
    });
  }, [audioUrl]);

  const formatAudioTime = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleAudioPlayback = async () => {
    if (!audioUrl) {
      audioAutoplayRequestedRef.current = true;
      await loadAudioMedia();
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (audioIsPlaying) {
      audio.pause();
      setAudioIsPlaying(false);
    } else {
      try {
        await audio.play();
        setAudioIsPlaying(true);
      } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      }
    }
  };

  const cycleAudioRate = () => {
    const rates = [1, 1.5, 2, 3];
    const nextIndex = (audioRateIndex + 1) % rates.length;
    setAudioRateIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = rates[nextIndex];
    }
  };

  const handleTranscribeAudio = async () => {
    if (!isAudioMessage || transcriptionLoading) return;

    setTranscriptionLoading(true);
    setTranscriptionError(null);

    try {
      const { data, error } = await supabase.functions.invoke('transcribe-whatsapp-audio', {
        body: {
          messageId: id,
          mediaId: audioMediaId,
        },
      });

      if (error) {
        throw error;
      }

      const nextPayload =
        data?.payload && typeof data.payload === 'object'
          ? (data.payload as MessagePayload)
          : ({
              ...payloadData,
              transcription: {
                text: typeof data?.transcript === 'string' ? data.transcript : '',
                provider: typeof data?.provider === 'string' ? data.provider : undefined,
                model: typeof data?.model === 'string' ? data.model : undefined,
              },
            } as MessagePayload);

      setLocalPayload(nextPayload);
      onTranscriptionSaved?.(id, nextPayload);
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : 'Não foi possível transcrever o áudio.');
    } finally {
      setTranscriptionLoading(false);
    }
  };

  const renderContent = () => {

    if (isDeleted) {
      return (
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div className="text-sm italic text-gray-600">
            <span className="line-through">Mensagem apagada</span>
            {deletedAt && (
              <span className="block text-xs mt-1">
                em {formatDateTimeInSaoPaulo(deletedAt)}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (type === 'contact' || payloadData?.contact) {
      const contactPayload = payloadData?.contact;
      const parsed = parseVcard(contactPayload?.vcard);
      const contactName = parsed.name || contactPayload?.name || body || 'Contato';
      const contactPhone = (parsed.phone || contactPayload?.phone || '').replace(/\D/g, '');
      const canSaveSharedContact = Boolean(onSaveSharedContact && contactPhone && !sharedContactSaved);
      const canOpenSharedContactChat = Boolean(onOpenSharedContactChat && contactPhone);
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                👤
              </div>
              <div>
                <div className="font-medium">{contactName}</div>
                {contactPhone && <div className="text-xs">{formatPhone(contactPhone)}</div>}
              </div>
            </div>
            {(canSaveSharedContact || canOpenSharedContactChat) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {canSaveSharedContact && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
                    disabled={sharedContactLoading}
                    onClick={() => handleOpenSaveContactModal({ name: contactName, phone: contactPhone })}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Salvar contato</span>
                  </Button>
                )}
                {canOpenSharedContactChat && (
                  <Button
                    variant="warning"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => {
                      onOpenSharedContactChat?.({ name: contactName, phone: contactPhone });
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Abrir chat</span>
                  </Button>
                )}
                {sharedContactSaved && (
                  <span className="inline-flex h-8 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700">
                    Contato salvo
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (payloadData?.contact_list?.list?.length) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="font-medium">Contatos</div>
            <div className="mt-1 space-y-1">
              {payloadData.contact_list.list.slice(0, 5).map((contact: { name?: string; vcard?: string }, index: number) => {
                const parsed = parseVcard(contact?.vcard);
                const contactName = parsed.name || contact?.name || `Contato ${index + 1}`;
                const contactPhone = parsed.phone || '';
                return (
                  <div key={`${id}-contact-${index}`} className="text-xs text-gray-700">
                    {contactName}
                    {contactPhone ? ` · ${formatPhone(contactPhone)}` : ''}
                  </div>
                );
              })}
              {payloadData.contact_list.list.length > 5 && (
                <div className="text-xs text-gray-500">+{payloadData.contact_list.list.length - 5} contato(s)</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    const locationPayload = payloadData?.location && typeof payloadData.location === 'object'
      ? (payloadData.location as { latitude?: unknown; longitude?: unknown; address?: unknown })
      : null;

    if (type === 'location' || locationPayload) {
      const latitude = typeof locationPayload?.latitude === 'number' ? locationPayload.latitude : null;
      const longitude = typeof locationPayload?.longitude === 'number' ? locationPayload.longitude : null;
      const locationQuery = latitude !== null && longitude !== null ? `${latitude},${longitude}` : body || '';
      const locationLabel =
        typeof locationPayload?.address === 'string' && locationPayload.address.trim()
          ? locationPayload.address.trim()
          : 'Localização compartilhada';

      return (
        <div className="flex items-center gap-2">
          <div className="text-sm">
            <div className="font-medium">{locationLabel}</div>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(locationQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-700 hover:text-amber-800 hover:underline"
            >
              Ver no mapa
            </a>
          </div>
        </div>
      );
    }

    if (isStickerMessage) {
      const displayUrl = visualDisplayUrl;
      return (
        <div className="flex w-[min(220px,60vw)] max-w-full flex-col gap-2">
          {displayUrl ? (
            <button
              type="button"
              onClick={() => {
                void openMediaPreview('sticker', displayUrl);
              }}
              className="mx-auto block overflow-hidden bg-transparent"
              style={{ aspectRatio: `${visualAspectRatio}` }}
            >
              <img
                src={displayUrl}
                alt="Sticker"
                className="block h-full w-full object-contain"
                loading={isNearViewport ? 'eager' : 'lazy'}
              />
            </button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-auto w-full max-w-full rounded p-2 text-sm text-gray-600"
              style={{ aspectRatio: `${visualAspectRatio}` }}
              onClick={() => {
                void openMediaPreview('sticker');
              }}
              disabled={visualMediaLoading}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">S</div>
                <div>
                  <div className="font-medium">Sticker</div>
                  <div className="text-xs">{visualMediaLoading ? 'Carregando...' : 'Clique para visualizar'}</div>
                </div>
              </div>
            </Button>
          )}
        </div>
      );
    }

    if (isImageMessage) {
      const displayUrl = visualDisplayUrl;
      const shouldShowCaption = Boolean(imageCaption);
      return (
        <div className="flex w-[min(420px,85vw)] max-w-full flex-col gap-2">
          {displayUrl ? (
            <button
              type="button"
              onClick={() => {
                void openMediaPreview('image', displayUrl);
              }}
              className="block w-full overflow-hidden rounded-xl bg-slate-100"
              style={{ aspectRatio: `${visualAspectRatio}` }}
            >
              <img
                src={displayUrl}
                alt="Imagem"
                className="block h-full w-full object-contain"
                loading={isNearViewport ? 'eager' : 'lazy'}
              />
            </button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-auto w-full max-w-full rounded p-2 text-sm text-gray-600"
              style={{ aspectRatio: `${visualAspectRatio}` }}
              onClick={() => {
                void openMediaPreview('image');
              }}
              disabled={visualMediaLoading}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">📷</div>
                <div>
                  <div className="font-medium">Imagem</div>
                  <div className="text-xs">{visualMediaLoading ? 'Carregando...' : 'Clique para visualizar'}</div>
                </div>
              </div>
            </Button>
          )}
          {shouldShowCaption && imageCaption && (
            <WhatsAppFormattedText text={imageCaption} className="block w-full px-1 pb-1 text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (isGifMessage) {
      const displayUrl = visualDisplayUrl;
      const shouldShowCaption = Boolean(gifCaption);
      const previewKind = isMp4Asset(displayUrl) ? 'video' : 'image';

      return (
        <div className="w-[min(380px,80vw)] max-w-full space-y-2">
          {displayUrl ? (
            <div className="w-full overflow-hidden rounded-xl bg-black">
              <button
                type="button"
                onClick={() => {
                  void openMediaPreview(previewKind, displayUrl);
                }}
                className="block w-full bg-black"
                style={{ aspectRatio: `${visualAspectRatio}` }}
              >
                {previewKind === 'video' ? (
                  <video
                    src={displayUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    poster={gifPreviewSrc || videoPoster}
                    className="block h-full w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    src={displayUrl}
                    alt="GIF"
                    className="block h-full w-full object-contain"
                    loading={isNearViewport ? 'eager' : 'lazy'}
                  />
                )}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full rounded-none border-0 bg-black/75 py-1.5 text-xs text-white/90 shadow-none hover:bg-black/85 hover:text-white"
                onClick={() => {
                  void openMediaPreview(previewKind, displayUrl);
                }}
              >
                Abrir GIF
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-auto w-full rounded p-2 text-sm text-gray-600"
              style={{ aspectRatio: `${visualAspectRatio}` }}
              onClick={() => {
                void openMediaPreview('image');
              }}
              disabled={visualMediaLoading}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200 text-xs font-semibold text-gray-600">GIF</div>
                <div>
                  <div className="font-medium">GIF</div>
                  <div className="text-xs">{visualMediaLoading ? 'Carregando...' : 'Clique para visualizar'}</div>
                </div>
              </div>
            </Button>
          )}
          {shouldShowCaption && gifCaption && (
            <WhatsAppFormattedText text={gifCaption} className="block px-1 pb-1 text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (isVideoMessage) {
      const videoUrl = visualDisplayUrl;
      const shouldShowCaption = Boolean(videoCaption);
      const poster = videoPoster;

      return (
        <div className="w-[min(420px,85vw)] max-w-full space-y-2">
          {videoUrl ? (
            <div className="w-full rounded-xl overflow-hidden bg-black">
              <div className="w-full bg-black" style={{ aspectRatio: `${visualAspectRatio}` }}>
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  poster={poster}
                  className="block h-full w-full bg-black object-contain"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full rounded-none border-0 bg-black/75 py-1.5 text-xs text-white/90 shadow-none hover:bg-black/85 hover:text-white"
                onClick={() => {
                  void openMediaPreview('video', videoUrl);
                }}
              >
                Abrir em tela cheia
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-auto w-full rounded p-2 text-sm text-gray-600"
              style={{ aspectRatio: `${visualAspectRatio}` }}
              onClick={() => {
                void openMediaPreview('video');
              }}
              disabled={visualMediaLoading}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">🎬</div>
                <div>
                  <div className="font-medium">Video</div>
                  <div className="text-xs">{visualMediaLoading ? 'Carregando...' : 'Clique para carregar'}</div>
                </div>
              </div>
            </Button>
          )}
          {shouldShowCaption && videoCaption && (
            <WhatsAppFormattedText text={videoCaption} className="block px-1 pb-1 text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (normalizedType === 'link_preview' || payloadData?.link_preview) {
      const linkData = (payloadData.link_preview || payloadData) as {
        url?: string;
        canonical?: string;
        link?: string;
        title?: string;
        description?: string;
        preview?: string;
        image?: string;
        thumbnail?: string;
      };
      const previewUrl = linkData.url || linkData.canonical || linkData.link || '';
      const previewTitle = linkData.title || (previewUrl ? previewUrl.replace(/^https?:\/\//i, '').split('/')[0] : 'Link');
      const previewDescription = linkData.description || '';
      const previewImage = linkData.preview || linkData.image || linkData.thumbnail || '';
      const textBody = resolvedBody && resolvedBody !== previewUrl && resolvedBody !== '[Link]' ? resolvedBody : '';

      return (
        <div className="space-y-2">
          <a
            href={previewUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-slate-200 bg-white max-w-[360px] overflow-hidden hover:border-slate-300 transition-colors"
          >
            {previewImage && (
              <img
                src={previewImage}
                alt={previewTitle}
                className="w-full h-40 object-cover bg-slate-100"
                loading="lazy"
              />
            )}
            <div className="p-3 space-y-1">
              <div className="text-xs text-slate-500 truncate">{previewUrl || 'Link'}</div>
              <div className="text-sm font-medium text-slate-800 line-clamp-2">{previewTitle}</div>
              {previewDescription && <div className="text-xs text-slate-600 line-clamp-3">{previewDescription}</div>}
              <div className="pt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                <ExternalLink className="w-3 h-3" />
                <span>Abrir link</span>
              </div>
            </div>
          </a>
          {textBody && <WhatsAppFormattedText text={textBody} className="text-sm whitespace-pre-wrap break-words" />}
        </div>
      );
    }

    if (isAudioMessage) {
      return (
        <div className="space-y-2">
          <div className="rounded p-2 text-sm w-[360px] max-w-full">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full bg-gray-200 p-0 text-lg"
                onClick={toggleAudioPlayback}
              >
                {audioMediaLoading && !audioUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : (audioIsPlaying ? '⏸' : '▶')}
              </Button>
              <div className="flex-1">
                {audioUrl ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
                      onClick={(event) => {
                        const target = event.currentTarget;
                        const rect = target.getBoundingClientRect();
                        const clickX = event.clientX - rect.left;
                        const percent = rect.width ? clickX / rect.width : 0;
                        const audio = audioRef.current;
                        if (audio && audioDuration) {
                          audio.currentTime = audioDuration * Math.min(Math.max(percent, 0), 1);
                        }
                      }}
                    >
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: audioDuration ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%' }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 min-w-[64px] text-right">
                      {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration || audioPayload?.seconds || 0)}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs">
                        {audioMediaLoading ? 'Preparando áudio...' : 'Clique para carregar'}
                  </div>
                )}
              </div>
              <Button
                variant="warning"
                size="sm"
                className="h-auto rounded-full px-2 py-1 text-xs"
                onClick={cycleAudioRate}
                disabled={!audioUrl}
              >
                {[1, 1.5, 2, 3][audioRateIndex]}x
              </Button>
            </div>
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={transcription ? 'secondary' : 'warning'}
              size="sm"
              className="h-auto rounded-full px-3 py-1 text-xs"
              onClick={handleTranscribeAudio}
              disabled={transcriptionLoading}
            >
              {transcriptionLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Transcrevendo...</span>
                </>
              ) : (
                <span>{transcription ? 'Atualizar transcrição' : 'Transcrever áudio'}</span>
              )}
            </Button>
            {transcription && (
              <span className="comm-badge comm-badge-brand px-2.5 py-1 text-[11px] font-medium">
                  Áudio transcrito
              </span>
            )}
          </div>
          {transcription && (
            <div className="comm-card comm-card-brand rounded-xl px-3 py-2">
              <div className="comm-accent-text mb-1 text-[11px] font-semibold uppercase tracking-wide">
                    Áudio transcrito
              </div>
              <WhatsAppFormattedText
                text={transcription.text}
                className="comm-text text-sm whitespace-pre-wrap break-words"
              />
            </div>
          )}
          {transcriptionError && <div className="text-xs text-red-600">{transcriptionError}</div>}
          {resolvedBody && resolvedBody !== '[Mensagem de voz]' && resolvedBody !== '[Áudio]' && (
            <WhatsAppFormattedText text={resolvedBody} className="text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (hasMedia && type === 'document') {
      const resolvedDocumentUrl = documentUrl || documentLink || '';
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📄
              </div>
              <div>
                <div className="font-medium">{documentName}</div>
                <div className="text-xs text-slate-500">{isPdf ? 'PDF' : 'Documento'}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={handleOpenDocumentPreview}
                disabled={documentLoading && !resolvedDocumentUrl}
              >
                {documentLoading && !resolvedDocumentUrl ? 'Carregando...' : isPdf ? 'Abrir' : 'Visualizar'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => {
                  void handleDownloadDocument();
                }}
                disabled={documentLoading}
              >
                {documentLoading ? 'Carregando...' : 'Baixar'}
              </Button>
            </div>
          </div>
          {resolvedBody && <WhatsAppFormattedText text={resolvedBody} className="text-sm whitespace-pre-wrap break-words" />}
        </div>
      );
    }

    if (hasMedia) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📎
              </div>
              <div>
                <div className="font-medium">Anexo</div>
                <div className="text-xs">{type || 'Arquivo'}</div>
              </div>
            </div>
          </div>
          {resolvedBody && <WhatsAppFormattedText text={resolvedBody} className="text-sm whitespace-pre-wrap break-words" />}
        </div>
      );
    }

    return <WhatsAppFormattedText text={resolvedBody || '(mensagem vazia)'} className="text-sm whitespace-pre-wrap break-words" />;
  };

  const loadVisualMedia = useCallback(async () => {
    if (visualMediaUrl) return visualMediaUrl;
    if (!visualMediaId || visualMediaLoading) return null;
    setVisualMediaLoading(true);
    try {
      const response = await getWhatsAppMedia(visualMediaId, { preferObjectUrl: true });
      const nextUrl = response.url || response.objectUrl || null;
      if (nextUrl) {
        setVisualMediaUrl(nextUrl);
        return nextUrl;
      }
    } catch (error) {
      console.error('Erro ao carregar midia visual:', error);
    } finally {
      setVisualMediaLoading(false);
    }
    return null;
  }, [visualMediaId, visualMediaLoading, visualMediaUrl]);

  useEffect(() => {
    if (!isNearViewport || !isVisualMediaMessage || !visualNeedsUpgrade || visualMediaLoading) return;
    void loadVisualMedia();
  }, [isNearViewport, isVisualMediaMessage, loadVisualMedia, visualMediaLoading, visualNeedsUpgrade]);

  useEffect(() => {
    if (!mediaPreview && !showPdfPreview) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mediaPreview) {
          setMediaPreview(null);
          return;
        }
        setShowPdfPreview(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mediaPreview, showPdfPreview]);

  useEffect(() => {
    resetMediaTransform();
  }, [mediaPreview?.src, mediaPreview?.kind, resetMediaTransform]);

  const loadMediaUrlById = useCallback(async (mediaId: string | null) => {
    if (!mediaId) return null;
    try {
      const response = await getWhatsAppMedia(mediaId, { preferObjectUrl: true });
      return response.url || response.objectUrl || null;
    } catch (error) {
      console.error('Erro ao carregar midia da galeria:', error);
      return null;
    }
  }, []);

  const buildMediaPreviewState = useCallback(
    (
      item: MediaGalleryItem,
      descriptor: VisualMediaDescriptor,
      src: string | null,
      isLoading: boolean,
      galleryItemsOverride?: MediaGalleryItem[],
      galleryIndexOverride?: number,
    ): MediaPreviewState => {
      const fallbackItems = galleryItemsOverride && galleryItemsOverride.length > 0 ? galleryItemsOverride : availableMediaGalleryItems;
      const galleryItems = fallbackItems.length > 0 ? fallbackItems : [item];
      const galleryIndex =
        typeof galleryIndexOverride === 'number'
          ? galleryIndexOverride
          : Math.max(0, galleryItems.findIndex((entry) => entry.messageId === item.messageId));

      return {
        messageId: item.messageId,
        kind: descriptor.kind,
        src,
        caption: descriptor.caption,
        title: descriptor.title,
        fileName: descriptor.fileName,
        poster: descriptor.poster,
        isLoading,
        timestamp: item.timestamp,
        fromName: item.fromName,
        galleryItems,
        galleryIndex,
      };
    },
    [availableMediaGalleryItems],
  );

  const handleDownloadMediaPreview = useCallback(() => {
    if (!mediaPreview?.src) return;
    const link = document.createElement('a');
    link.href = mediaPreview.src;
    link.download = mediaPreview.fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [mediaPreview]);

  const handleOpenMediaPreviewExternally = useCallback(() => {
    if (!mediaPreview?.src) return;
    window.open(mediaPreview.src, '_blank', 'noopener,noreferrer');
  }, [mediaPreview]);

  const handleOpenDocumentPreview = useCallback(() => {
    setShowPdfPreview(true);
    if (!documentUrl && !documentLink) {
      void loadDocumentMedia();
    }
  }, [documentLink, documentUrl, loadDocumentMedia]);

  const handleDownloadDocument = useCallback(async () => {
    const resolvedDocumentUrl = documentUrl || documentLink || (await loadDocumentMedia());
    if (!resolvedDocumentUrl) return;
    const link = document.createElement('a');
    link.href = resolvedDocumentUrl;
    link.download = documentName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [documentLink, documentName, documentUrl, loadDocumentMedia]);

  const handleOpenDocumentExternally = useCallback(async () => {
    const resolvedDocumentUrl = documentUrl || documentLink || (await loadDocumentMedia());
    if (!resolvedDocumentUrl) return;
    window.open(resolvedDocumentUrl, '_blank', 'noopener,noreferrer');
  }, [documentLink, documentUrl, loadDocumentMedia]);

  const openMediaPreviewForItem = useCallback(
    async (
      item: MediaGalleryItem,
      fallbackSrc?: string | null,
      galleryItemsOverride?: MediaGalleryItem[],
      galleryIndexOverride?: number,
    ) => {
      const descriptor = resolveVisualMediaDescriptor({
        body: item.body,
        type: item.type,
        hasMedia: item.hasMedia,
        payload: item.payload,
        isDeleted: item.isDeleted,
      });

      if (!descriptor) {
        return;
      }

      const galleryItems = galleryItemsOverride && galleryItemsOverride.length > 0 ? galleryItemsOverride : availableMediaGalleryItems;
      const galleryIndex =
        typeof galleryIndexOverride === 'number'
          ? galleryIndexOverride
          : Math.max(0, galleryItems.findIndex((entry) => entry.messageId === item.messageId));
      const initialSrc = fallbackSrc || descriptor.displayUrl || null;

      setMediaPreview(buildMediaPreviewState(item, descriptor, initialSrc, descriptor.needsUpgrade, galleryItems, galleryIndex));

      if (!descriptor.needsUpgrade || !descriptor.mediaId) {
        return;
      }

      const loadedUrl = item.messageId === id ? await loadVisualMedia() : await loadMediaUrlById(descriptor.mediaId);
      if (!loadedUrl) {
        setMediaPreview((current) => (current && current.messageId === item.messageId ? { ...current, isLoading: false } : current));
        return;
      }

      setMediaPreview((current) => {
        if (!current || current.messageId !== item.messageId) {
          return current;
        }

        if (current.src === loadedUrl && !current.isLoading) {
          return current;
        }

        return { ...current, src: loadedUrl, isLoading: false };
      });
    },
    [availableMediaGalleryItems, buildMediaPreviewState, id, loadMediaUrlById, loadVisualMedia],
  );

  async function openMediaPreview(_previewType: 'image' | 'video' | 'sticker', fallbackSrc?: string | null) {
    const baseGalleryItems = availableMediaGalleryItems.length > 0 ? availableMediaGalleryItems : [currentMediaGalleryItem];
    const currentIndex = baseGalleryItems.findIndex((entry) => entry.messageId === currentMediaGalleryItem.messageId);
    const galleryItems = currentIndex >= 0 ? baseGalleryItems : [currentMediaGalleryItem];
    const galleryIndex = currentIndex >= 0 ? currentIndex : 0;
    const currentItem = galleryItems[galleryIndex] || currentMediaGalleryItem;
    await openMediaPreviewForItem(currentItem, fallbackSrc, galleryItems, galleryIndex);
  }

  const hasPreviousMediaPreview = Boolean(mediaPreview && mediaPreview.galleryIndex > 0);
  const hasNextMediaPreview = Boolean(mediaPreview && mediaPreview.galleryIndex < mediaPreview.galleryItems.length - 1);

  const navigateMediaPreview = useCallback(
    (direction: -1 | 1) => {
      if (!mediaPreview) return;
      const nextIndex = mediaPreview.galleryIndex + direction;
      const nextItem = mediaPreview.galleryItems[nextIndex];
      if (!nextItem) return;
      void openMediaPreviewForItem(nextItem, undefined, mediaPreview.galleryItems, nextIndex);
    },
    [mediaPreview, openMediaPreviewForItem],
  );

  useEffect(() => {
    if (!mediaPreview) return;

    const adjacentItems = [mediaPreview.galleryItems[mediaPreview.galleryIndex - 1], mediaPreview.galleryItems[mediaPreview.galleryIndex + 1]].filter(
      (item): item is MediaGalleryItem => Boolean(item),
    );

    adjacentItems.forEach((item) => {
      const descriptor = resolveVisualMediaDescriptor({
        body: item.body,
        type: item.type,
        hasMedia: item.hasMedia,
        payload: item.payload,
        isDeleted: item.isDeleted,
      });

      if (!descriptor?.needsUpgrade || !descriptor.mediaId) {
        return;
      }

      void loadMediaUrlById(descriptor.mediaId);
    });
  }, [loadMediaUrlById, mediaPreview]);

  useEffect(() => {
    if (!mediaPreview || mediaPreview.galleryItems.length <= 1) return;

    const handleArrowNavigation = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateMediaPreview(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateMediaPreview(1);
      }
    };

    document.addEventListener('keydown', handleArrowNavigation);
    return () => {
      document.removeEventListener('keydown', handleArrowNavigation);
    };
  }, [mediaPreview, navigateMediaPreview]);

  const handleMediaWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!mediaPreview || mediaPreview.kind === 'video') return;
      event.preventDefault();
      const nextZoom = mediaZoom + (event.deltaY < 0 ? 0.18 : -0.18);
      updateMediaZoom(nextZoom);
    },
    [mediaPreview, mediaZoom, updateMediaZoom],
  );

  const handleMediaPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mediaPreview || mediaPreview.kind === 'video' || mediaZoom <= 1) return;
      mediaDragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: mediaOffset.x,
        originY: mediaOffset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [mediaOffset.x, mediaOffset.y, mediaPreview, mediaZoom],
  );

  const handleMediaPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (mediaDragStateRef.current.pointerId !== event.pointerId || mediaZoom <= 1) return;
      const deltaX = event.clientX - mediaDragStateRef.current.startX;
      const deltaY = event.clientY - mediaDragStateRef.current.startY;
      setMediaOffset(
        clampMediaOffset(
          {
            x: mediaDragStateRef.current.originX + deltaX,
            y: mediaDragStateRef.current.originY + deltaY,
          },
          mediaZoom,
        ),
      );
    },
    [clampMediaOffset, mediaZoom],
  );

  const handleMediaPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (mediaDragStateRef.current.pointerId !== event.pointerId) return;
    mediaDragStateRef.current.pointerId = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleMediaDoubleClick = useCallback(() => {
    if (!mediaPreview || mediaPreview.kind === 'video') return;
    if (mediaZoom > 1) {
      resetMediaTransform();
      return;
    }
    updateMediaZoom(2.2);
  }, [mediaPreview, mediaZoom, resetMediaTransform, updateMediaZoom]);

  return (
    <div
      ref={bubbleRef}
      className={`message-bubble-row flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2 group`}
    >
      <div className={`relative ${isVisualMediaMessage ? 'max-w-[85%]' : 'max-w-[70%]'} min-w-0 ${isOutbound ? 'order-2' : 'order-1'}`}>
        <div
          className={`message-bubble break-words [overflow-wrap:anywhere] rounded-lg ${
            isStickerMessage ? 'border-0 bg-transparent p-0 shadow-none' : isVisualMediaMessage ? 'p-1.5' : 'px-3 py-2'
          } ${
            isStickerMessage
              ? ''
              : isOutbound
              ? 'message-bubble-outbound border border-amber-200 bg-amber-100 text-slate-900'
              : 'message-bubble-inbound border border-slate-200 bg-white text-slate-900'
          }`}
        >
          {isForwarded && (
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <CornerUpRight className="h-3 w-3" />
              <span>Encaminhada</span>
            </div>
          )}

          {!isOutbound && fromName && (
            <div className="mb-1 text-xs font-semibold text-amber-700">
              {fromName}
            </div>
          )}

          {renderContent()}

          {reactions && reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {reactions.map((reaction) => (
                <span
                  key={`${id}-${reaction.emoji}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 border border-gray-200 px-2 py-0.5 text-xs"
                >
                  <span>{reaction.emoji}</span>
                  {reaction.count > 1 && <span className="text-gray-600">{reaction.count}</span>}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-2">
              {editCount > 0 && !isDeleted && (
                <div
                  className="flex cursor-pointer items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
                  title={`Editada ${editCount} vez${editCount > 1 ? 'es' : ''}`}
                  onClick={() => setShowHistory(true)}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editada</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">
                {formatTimestamp(timestamp)}
              </span>
              {isOutbound && (
                <span title={getAckLabel()}>
                  {getAckIcon()}
                </span>
              )}
              {hasActionMenu && (
                <Button
                  ref={actionMenuButtonRef}
                  variant="icon"
                  size="icon"
                  aria-label="Abrir menu da mensagem"
                  aria-expanded={showActionMenu}
                  onClick={() => {
                    setShowActionMenu((previous) => {
                      const next = !previous;
                      if (!next) {
                        setShowReactionPicker(false);
                      }
                      return next;
                    });
                  }}
                  className={`message-bubble-action-trigger h-4 w-4 rounded border-0 p-0 text-slate-500 shadow-none transition-colors transition-opacity ${
                    showActionMenu
                      ? 'opacity-100 pointer-events-auto bg-black/5'
                      : 'opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:bg-black/5'
                  }`}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showActionMenu ? 'rotate-180' : ''}`} />
                </Button>
              )}
            </div>
          </div>

          {showFailedActions && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-red-200/80 pt-2">
              <span className="text-xs text-red-700">
                {errorMessage?.trim() || 'Não foi possível enviar.'}
              </span>
              {onRetryFailed && (
                <button
                  type="button"
                  onClick={onRetryFailed}
                  className="text-xs font-medium text-red-700 underline-offset-2 hover:text-red-800 hover:underline"
                >
                  Tentar novamente
                </button>
              )}
              {onDismissFailed && (
                <button
                  type="button"
                  onClick={onDismissFailed}
                  className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                >
                  Ignorar
                </button>
              )}
            </div>
          )}
        </div>

        {hasActionMenu && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={actionMenuRef}
                className={`comm-popover message-bubble-action-menu panel-dropdown-scrollbar fixed z-30 w-44 overflow-hidden p-1 transition-[opacity,transform] duration-150 ease-out ${
                  actionMenuOpenUpward ? 'origin-bottom-right' : 'origin-top-right'
                } ${
                  showActionMenu
                    ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                    : actionMenuOpenUpward
                      ? 'pointer-events-none -translate-y-1 scale-95 opacity-0'
                      : 'pointer-events-none translate-y-1 scale-95 opacity-0'
                }`}
                style={
                  actionMenuPosition
                    ? {
                        top: actionMenuPosition.top,
                        left: actionMenuPosition.left,
                        visibility: 'visible',
                      }
                    : {
                        visibility: showActionMenu ? 'hidden' : 'visible',
                      }
                }
              >
            {canReact && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => setShowReactionPicker((previous) => !previous)}
                className="comm-menu-item comm-text h-auto rounded-md border-0 px-2.5 py-2 text-sm font-medium shadow-none"
              >
                <span className="flex w-full items-center gap-2 text-left">
                  <Smile className="comm-muted h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Reagir</span>
                </span>
              </Button>
            )}

            {canReact && showReactionPicker && (
              <div className="mx-1 mb-1 mt-0.5 rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-1.5 py-1">
                <div className="flex items-center justify-between gap-0.5">
                  {quickReactions.map((emoji) => (
                    <Button
                      key={`${id}-${emoji}`}
                      variant="icon"
                      size="icon"
                      className="message-bubble-emoji-button h-7 w-7 rounded-full border-0 p-0 text-base shadow-none hover:bg-[color:var(--panel-surface,#fffdfa)]"
                      onClick={() => {
                        onReact?.(id, emoji);
                        closeActionMenu();
                      }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {canReply && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  onReply?.(id, body || '', fromName || 'Contato');
                  closeActionMenu();
                }}
                className="comm-menu-item comm-text h-auto rounded-md border-0 px-2.5 py-2 text-sm font-medium shadow-none"
              >
                <span className="flex w-full items-center gap-2 text-left">
                  <CornerUpLeft className="comm-muted h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Responder</span>
                </span>
              </Button>
            )}

            {canForward && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  onForward?.();
                  closeActionMenu();
                }}
                className="comm-menu-item comm-text h-auto rounded-md border-0 px-2.5 py-2 text-sm font-medium shadow-none"
              >
                <span className="flex w-full items-center gap-2 text-left">
                  <CornerUpRight className="comm-muted h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Encaminhar</span>
                </span>
              </Button>
            )}

            {canEditMessage && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  onEdit?.(id, body || '');
                  closeActionMenu();
                }}
                className="comm-menu-item comm-text h-auto rounded-md border-0 px-2.5 py-2 text-sm font-medium shadow-none"
              >
                <span className="flex w-full items-center gap-2 text-left">
                  <Edit3 className="comm-muted h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Editar</span>
                </span>
              </Button>
            )}

            {canSaveSticker && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  void handleSaveStickerToLibrary();
                }}
                disabled={savingStickerToLibrary}
                className="comm-menu-item comm-text h-auto rounded-md border-0 px-2.5 py-2 text-sm font-medium shadow-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex w-full items-center gap-2 text-left">
                  {savingStickerToLibrary ? <Loader2 className="comm-muted h-4 w-4 animate-spin flex-shrink-0" /> : <Download className="comm-muted h-4 w-4 flex-shrink-0" />}
                  <span className="flex-1 text-left">{savingStickerToLibrary ? 'Salvando figurinha...' : 'Salvar na loja'}</span>
                </span>
              </Button>
            )}

            {canViewHistory && (
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  setShowHistory(true);
                  closeActionMenu();
                }}
                className="comm-menu-item h-auto rounded-md border-0 px-2.5 py-2 text-sm font-medium text-[color:var(--panel-accent-ink,#6f3f16)] shadow-none hover:text-[color:var(--panel-accent-ink-strong,#4a2411)]"
              >
                <History className="h-4 w-4 text-[color:var(--panel-accent-ink,#6f3f16)]" />
                <span>Ver histórico</span>
              </Button>
            )}
              </div>,
              document.body,
            )
          : null}
      </div>

      <MessageHistoryModal
        messageId={id}
        chatId={chatId}
        messageTimestamp={timestamp ? new Date(timestamp).getTime() : Date.now()}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {mediaPreview && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[95] bg-[#120c08] text-white"
              role="dialog"
              aria-modal="true"
              aria-label={`Visualizar ${mediaPreview.title.toLowerCase()}`}
              onClick={() => setMediaPreview(null)}
            >
              <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/45 to-transparent px-3 pb-8 pt-3 sm:px-5 sm:pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pt-1">
                    <div className="truncate text-sm font-semibold sm:text-base">{mediaPreview.title}</div>
                    <div className="truncate text-xs text-white/65">
                      {mediaPreview.galleryItems.length > 1 ? `${mediaPreview.galleryIndex + 1} de ${mediaPreview.galleryItems.length} · ` : ''}
                      {formatTimestamp(mediaPreview.timestamp) || mediaPreview.fileName}
                    </div>
                    {mediaPreview.fromName ? <div className="truncate text-[11px] text-white/45">{mediaPreview.fromName}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenMediaPreviewExternally();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Abrir em nova aba"
                      disabled={!mediaPreview.src}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDownloadMediaPreview();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Baixar mídia"
                      disabled={!mediaPreview.src}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMediaPreview(null);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                      aria-label="Fechar visualização"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`flex h-full w-full flex-col gap-4 px-3 pb-4 pt-20 sm:px-6 sm:pb-6 sm:pt-24 ${mediaPreview.caption ? 'lg:flex-row lg:items-stretch' : ''}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  ref={mediaViewportRef}
                  className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-black/20 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                  onWheel={handleMediaWheel}
                >
                  <div className="relative flex h-full min-h-[320px] w-full items-center justify-center overflow-hidden px-3 py-3 sm:min-h-[420px] sm:px-4 sm:py-4">
                    {mediaPreview.galleryItems.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => navigateMediaPreview(-1)}
                          className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white transition hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Ver mídia anterior"
                          disabled={!hasPreviousMediaPreview}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateMediaPreview(1)}
                          className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white transition hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Ver próxima mídia"
                          disabled={!hasNextMediaPreview}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    ) : null}

                    {mediaPreview.src ? (
                      mediaPreview.kind === 'video' ? (
                        <video
                          src={mediaPreview.src}
                          poster={mediaPreview.poster}
                          controls
                          autoPlay
                          playsInline
                          className="h-full w-full max-h-full max-w-full rounded-2xl bg-black object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                        />
                      ) : (
                        <div className="relative flex h-full w-full items-center justify-center">
                          <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-md sm:right-3 sm:top-3">
                            <button
                              type="button"
                              onClick={() => updateMediaZoom(mediaZoom - 0.4)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Diminuir zoom"
                              disabled={mediaZoom <= 1}
                            >
                              <ZoomOut className="h-4 w-4" />
                            </button>
                            <div className="min-w-[3.5rem] text-center text-xs font-medium text-white/80">{Math.round(mediaZoom * 100)}%</div>
                            <button
                              type="button"
                              onClick={() => updateMediaZoom(mediaZoom + 0.4)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Aumentar zoom"
                              disabled={mediaZoom >= 4}
                            >
                              <ZoomIn className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={resetMediaTransform}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Resetar zoom"
                              disabled={mediaZoom <= 1 && mediaOffset.x === 0 && mediaOffset.y === 0}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          </div>

                          <div
                            className={`flex h-full w-full items-center justify-center ${mediaZoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
                            onPointerDown={handleMediaPointerDown}
                            onPointerMove={handleMediaPointerMove}
                            onPointerUp={handleMediaPointerUp}
                            onPointerCancel={handleMediaPointerUp}
                            onDoubleClick={handleMediaDoubleClick}
                            style={{ touchAction: mediaZoom > 1 ? 'none' : 'manipulation' }}
                          >
                            <img
                              src={mediaPreview.src}
                              alt={mediaPreview.title}
                              className="h-full w-full max-h-full max-w-full rounded-2xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-transform duration-150 ease-out"
                              style={{ transform: `translate3d(${mediaOffset.x}px, ${mediaOffset.y}px, 0) scale(${mediaZoom})` }}
                            />
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-8 py-7 text-center text-white/80 backdrop-blur-md">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <div className="text-sm font-medium">Carregando mídia</div>
                        <div className="max-w-xs text-xs text-white/60">A visualização abre na hora e troca sozinha para a versão completa assim que o download terminar.</div>
                      </div>
                    )}

                    {(mediaPreview.isLoading && mediaPreview.src) || (mediaPreview.src && mediaPreview.kind !== 'video') ? (
                      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
                        {mediaPreview.isLoading && mediaPreview.src ? (
                          <div className="rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md">
                            Atualizando para a versão completa...
                          </div>
                        ) : null}
                        {mediaPreview.src && mediaPreview.kind !== 'video' ? (
                          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] text-white/75 backdrop-blur-md">
                            Use roda do mouse, duplo clique ou arraste com zoom.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {mediaPreview.caption ? (
                  <aside
                    className="min-h-0 max-h-[34vh] overflow-hidden rounded-[28px] border border-white/10 bg-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-md lg:max-h-none lg:w-[min(30rem,32vw)] lg:flex-shrink-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="border-b border-white/10 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Legenda</div>
                      <div className="mt-1 text-xs text-white/65">Texto da mídia separado para não cobrir a visualização.</div>
                    </div>
                    <div className="panel-dropdown-scrollbar max-h-[calc(34vh-4.5rem)] overflow-y-auto px-4 py-4 lg:max-h-[calc(100dvh-9rem)]">
                      <WhatsAppFormattedText text={mediaPreview.caption} className="text-sm leading-6 whitespace-pre-wrap break-words text-white" />
                    </div>
                  </aside>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

      {showPdfPreview && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[94] bg-[#17110c] text-white" role="dialog" aria-modal="true" aria-label={`Visualizar documento ${documentName}`}>
              <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/45 to-transparent px-3 pb-8 pt-3 sm:px-5 sm:pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pt-1">
                    <div className="truncate text-sm font-semibold sm:text-base">{documentName}</div>
                    <div className="truncate text-xs text-white/65">{isPdf ? 'PDF' : 'Documento'}{formatTimestamp(timestamp) ? ` · ${formatTimestamp(timestamp)}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenDocumentExternally();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Abrir documento em nova aba"
                      disabled={documentLoading && !documentUrl && !documentLink}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDownloadDocument();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Baixar documento"
                      disabled={documentLoading && !documentUrl && !documentLink}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPdfPreview(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                      aria-label="Fechar visualização do documento"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex h-full w-full flex-col px-3 pb-4 pt-20 sm:px-6 sm:pb-6 sm:pt-24">
                {documentUrl || documentLink ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                    <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 text-white/75">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{documentName}</div>
                        <div className="truncate text-xs text-white/60">Viewer interno com fallback para nova aba</div>
                      </div>
                    </div>
                    <iframe
                      title={`Preview de ${documentName}`}
                      src={documentUrl || documentLink || ''}
                      className="min-h-0 flex-1 bg-white"
                    />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] border border-white/10 bg-white/5 px-6 text-center text-white/80 backdrop-blur-sm">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <div className="text-sm font-medium">Preparando documento</div>
                    <div className="max-w-sm text-xs text-white/60">Assim que o arquivo terminar de carregar, a visualização interna abre aqui. Se o navegador não suportar o formato, use abrir em nova aba.</div>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {saveContactModalState && (
        <ModalShell
          isOpen
          onClose={() => {
            if (!sharedContactLoading) {
              setSaveContactModalState(null);
            }
          }}
          title="Salvar contato"
          description="Defina o nome que sera salvo e sincronizado no WhatsApp do celular conectado."
          size="sm"
          footer={(
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSaveContactModalState(null)}
                disabled={sharedContactLoading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirmSaveContact()}
                disabled={sharedContactLoading || !saveContactModalState.name.trim()}
              >
                {sharedContactLoading ? 'Salvando...' : 'Salvar contato'}
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nome do contato
              </label>
              <Input
                ref={saveContactNameInputRef}
                type="text"
                value={saveContactModalState.name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setSaveContactModalState((current) => (current ? { ...current, name: nextName } : current));
                }}
                onKeyDown={handleSaveContactNameKeyDown}
                placeholder="Ex.: Fernando - Gestor Qualicorp"
                autoFocus
              />
            </div>

            <div className="rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-3 py-2 text-sm text-[var(--panel-text-soft,#5b4635)]">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--panel-text-muted,#876f5c)]">
                Telefone
              </div>
              <div className="mt-1 font-medium text-[var(--panel-text,#1a120d)]">
                {formatPhone(saveContactModalState.phone)}
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

export const MessageBubble = memo(
  MessageBubbleComponent,
  areMessageBubblePropsEqual,
);
