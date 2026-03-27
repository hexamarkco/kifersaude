import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AlertCircle, AlertTriangle, Check, CheckCheck, ChevronUp, Clock3, Download, FileAudio, FileImage, FileText, Loader2, MessageCircle, Mic, Plus, Search, SendHorizontal, Smile, Square, Volume2, WifiOff, X } from 'lucide-react';

import Checkbox from '../../../components/ui/Checkbox';
import Input from '../../../components/ui/Input';
import {
  commWhatsAppService,
  formatCommWhatsAppPhoneLabel,
  type CommWhatsAppMediaSendKind,
  type CommWhatsAppOperationalState,
} from '../../../lib/commWhatsAppService';
import { toast } from '../../../lib/toast';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../../lib/supabase';

const CHAT_POLL_INTERVAL_MS = 8000;
const MESSAGE_POLL_INTERVAL_MS = 5000;
const OPERATIONAL_STATE_POLL_INTERVAL_MS = 30000;
const MESSAGE_PAGE_SIZE = 50;
const SCROLL_BOTTOM_THRESHOLD_PX = 96;
const STALE_WEBHOOK_THRESHOLD_MS = 6 * 60 * 60 * 1000;

type MessageLoadReason = 'initial' | 'poll' | 'send';
type ScrollMode = 'bottom' | 'preserve' | 'prepend' | null;
type VoiceRecordingState = 'idle' | 'requesting' | 'recording';
type PendingAttachment = {
  file: File;
  kind: CommWhatsAppMediaSendKind;
  durationSeconds?: number;
  previewUrl?: string | null;
  waveform?: number[];
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

const compareMessageChronology = (a: CommWhatsAppMessage, b: CommWhatsAppMessage) => {
  const timeDiff = new Date(a.message_at).getTime() - new Date(b.message_at).getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return a.id.localeCompare(b.id);
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

const isMediaPlaceholder = (message: CommWhatsAppMessage) => {
  const content = String(message.text_content ?? '').trim();
  if (!content) return true;

  const placeholders = new Set(['[Imagem]', '[Documento]', '[Audio]', '[Mensagem]']);
  return placeholders.has(content);
};

const inferAttachmentKind = (file: File): CommWhatsAppMediaSendKind => {
  if (file.type.startsWith('image/')) {
    return 'image';
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

  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];
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
  const [mediaUrl, setMediaUrl] = useState<string | null>(message.media_url ?? null);
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
        setError(resolveError instanceof Error ? resolveError.message : 'Nao foi possivel carregar a midia.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [message.media_id, message.media_url]);

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

function WhatsAppMessageBody({
  message,
  onOpenImage,
}: {
  message: CommWhatsAppMessage;
  onOpenImage: (payload: { src: string; name: string }) => void;
}) {
  const { mediaUrl, loading, error } = useResolvedMediaUrl(message);
  const kind = message.message_type;
  const caption = isMediaPlaceholder(message) ? message.media_caption?.trim() || '' : message.text_content?.trim() || '';

  if (kind === 'image') {
    return (
      <div className="space-y-3">
        {mediaUrl ? (
          <button
            type="button"
            onClick={() => onOpenImage({ src: mediaUrl, name: message.media_file_name || 'Imagem enviada' })}
            className="block w-full overflow-hidden rounded-2xl border border-black/5 text-left"
          >
            <img src={mediaUrl} alt={message.media_file_name || 'Imagem enviada'} className="max-h-[280px] w-full object-cover" loading="lazy" />
          </button>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-black/5 text-sm opacity-80">
            {loading ? 'Carregando imagem...' : error || 'Imagem indisponivel'}
          </div>
        )}
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
      </div>
    );
  }

  if (kind === 'document') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-current/10 bg-black/5 px-3 py-3">
          <FileText className="h-5 w-5 shrink-0 opacity-80" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{message.media_file_name || 'Documento'}</p>
            <p className="text-xs opacity-75">{formatFileSize(message.media_size_bytes)}</p>
          </div>
          <div className="flex items-center gap-2">
            {mediaUrl ? (
              <>
                <a href={mediaUrl} target="_blank" rel="noreferrer" className="rounded-full border border-current/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-black/5">
                  Abrir
                </a>
                <a
                  href={mediaUrl}
                  download={message.media_file_name || 'documento'}
                  className="inline-flex items-center gap-1.5 rounded-full border border-current/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-black/5"
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
      </div>
    );
  }

  if (kind === 'audio' || kind === 'voice') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-current/10 bg-black/5 px-3 py-3">
          <FileAudio className="h-5 w-5 shrink-0 opacity-80" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{message.media_file_name || (kind === 'voice' ? 'Nota de voz' : 'Audio')}</p>
              <span className="text-xs opacity-75">
                {message.media_duration_seconds ? `${message.media_duration_seconds}s` : formatFileSize(message.media_size_bytes)}
              </span>
            </div>
            {mediaUrl ? (
              <audio controls preload="none" className="w-full max-w-[320px]">
                <source src={mediaUrl} type={message.media_mime_type || undefined} />
              </audio>
            ) : (
              <p className="text-xs opacity-75">{loading ? 'Carregando audio...' : error || 'Audio indisponivel'}</p>
            )}
          </div>
        </div>
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text_content || '[Mensagem sem texto]'}</p>;
}

export default function WhatsAppInboxScreen() {
  const [loading, setLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [voiceRecordingState, setVoiceRecordingState] = useState<VoiceRecordingState>('idle');
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [voiceRecordingWaveform, setVoiceRecordingWaveform] = useState<number[]>(DEFAULT_WAVEFORM);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<number | null>(null);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [operationalState, setOperationalState] = useState<CommWhatsAppOperationalState | null>(null);
  const [operationalStateLoaded, setOperationalStateLoaded] = useState(false);
  const [operationalStateError, setOperationalStateError] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ src: string; name: string } | null>(null);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
  const [isWindowFocused, setIsWindowFocused] = useState(() => (typeof document === 'undefined' ? true : document.hasFocus()));
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const mediaUploadAbortControllerRef = useRef<AbortController | null>(null);
  const hydratedChatsRef = useRef<Set<string>>(new Set());
  const latestChatsRef = useRef<CommWhatsAppChat[]>([]);
  const latestMessagesRef = useRef<CommWhatsAppMessage[]>([]);
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
  const hasTypedMessage = messageDraft.trim().length > 0;
  const hasSendPayload = hasTypedMessage || pendingAttachment !== null;
  const pollingEnabled = isDocumentVisible && isWindowFocused;

  const buildChatsSignature = useCallback(
    (items: CommWhatsAppChat[]) =>
      items
        .map(
          (chat) =>
            `${chat.id}:${chat.updated_at}:${chat.unread_count}:${chat.last_message_at ?? ''}:${chat.last_message_text ?? ''}:${chat.display_name}`,
        )
        .join('|'),
    [],
  );

  const buildMessagesSignature = useCallback(
    (items: CommWhatsAppMessage[]) =>
      items
        .map(
          (message) =>
            `${message.id}:${message.external_message_id ?? ''}:${message.delivery_status}:${message.message_at}:${message.text_content ?? ''}:${message.message_type}:${message.media_id ?? ''}:${message.media_url ?? ''}:${message.media_file_name ?? ''}:${message.media_caption ?? ''}`,
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

  const channelState = operationalState?.channel ?? null;
  const connectionStatus = String(channelState?.connection_status ?? '').trim().toUpperCase();
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
      return 'Nao foi possivel verificar o canal do WhatsApp agora.';
    }

    if (!operationalState?.tokenConfigured) {
      return 'Token da Whapi nao configurado em /painel/config.';
    }

    if (!operationalState.configEnabled) {
      return 'Envio do WhatsApp esta desabilitado em /painel/config.';
    }

    if (!isChannelConnected) {
      return `Canal WhatsApp ${formatConnectionStatusLabel(connectionStatus).toLowerCase()}.`;
    }

    return null;
  }, [connectionStatus, isChannelConnected, operationalState, operationalStateError, operationalStateLoaded]);

  const operationalBanner = useMemo(() => {
    if (operationalStateError && !operationalState) {
      return {
        tone: 'danger' as const,
        icon: AlertTriangle,
        title: 'Nao foi possivel verificar o canal do WhatsApp',
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
        description: 'O canal esta configurado, mas o envio foi desativado em /painel/config.',
      };
    }

    if (!isChannelConnected) {
      return {
        tone: 'danger' as const,
        icon: WifiOff,
        title: `WhatsApp ${formatConnectionStatusLabel(connectionStatus)}`,
        description: 'Reconecte o canal na Whapi ou valide a sessao antes de atender por aqui.',
      };
    }

    if (channelState.last_error) {
      return {
        tone: 'warning' as const,
        icon: AlertTriangle,
        title: 'Ultimo erro do canal',
        description: channelState.last_error,
      };
    }

    if (!hasWebhookEver) {
      return {
        tone: 'info' as const,
        icon: Clock3,
        title: 'Webhook ainda sem eventos',
        description: 'O canal esta conectado, mas ainda nao recebemos nenhum evento do webhook neste inbox.',
      };
    }

    if (isWebhookStale) {
      return {
        tone: 'info' as const,
        icon: Clock3,
        title: 'Webhook sem eventos recentes',
        description: `Ultimo evento recebido em ${formatMessageTime(channelState.last_webhook_received_at)}. Se isso nao for esperado, valide o webhook na Whapi.`,
      };
    }

    return null;
  }, [channelState, connectionStatus, hasWebhookEver, isChannelConnected, isWebhookStale, operationalState, operationalStateError, operationalStateLoaded]);

  useEffect(() => {
    latestChatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const previewUrl = pendingAttachment?.previewUrl;
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [pendingAttachment?.previewUrl]);

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
        error instanceof Error ? error.message : 'Nao foi possivel carregar o estado operacional do WhatsApp.',
      );
      setOperationalStateLoaded(true);
    }
  }, []);

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
        onlyUnread,
      });

      if (requestId !== chatsRequestIdRef.current) {
        return;
      }

      const nextSignature = buildChatsSignature(data);

      if (nextSignature !== chatsSignatureRef.current) {
        chatsSignatureRef.current = nextSignature;
        setChats(data);
      }

      setSelectedChatId((current) => {
        if (current && data.some((chat) => chat.id === current)) {
          return current;
        }

        return data[0]?.id ?? null;
      });
    } catch (error) {
      if (requestId !== chatsRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao carregar chats', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as conversas do WhatsApp.');
    }
  }, [buildChatsSignature, onlyUnread, search]);

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
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as mensagens da conversa.');
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
      setPendingAttachment(null);
      cancelVoiceRecordingRef.current();
      messagesSignatureRef.current = '';
      return;
    }

    messagesSignatureRef.current = '';
    pendingScrollModeRef.current = 'bottom';
    pendingScrollTopRef.current = null;
    pendingScrollHeightRef.current = null;
    isNearBottomRef.current = true;
    setPendingAttachment(null);
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
    if (!selectedChat || selectedChat.unread_count <= 0) {
      return;
    }

    setChats((current) =>
      current.map((chat) => (chat.id === selectedChat.id ? { ...chat, unread_count: 0, last_read_at: new Date().toISOString() } : chat)),
    );

    void commWhatsAppService.markChatRead(selectedChat.id).catch((error) => {
      console.error('[WhatsAppInbox] erro ao marcar chat como lido', error);
    });
  }, [selectedChat]);

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
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar mensagens mais antigas.');
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
  }, [messageDraft, pendingAttachment, selectedChatId]);

  const handleOpenAttachmentPicker = () => {
    if (voiceRecordingState !== 'idle') {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleAttachmentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (voiceRecordingState !== 'idle') {
      event.target.value = '';
      return;
    }

    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    setPendingAttachment({
      file: nextFile,
      kind: inferAttachmentKind(nextFile),
      previewUrl: nextFile.type.startsWith('image/') ? URL.createObjectURL(nextFile) : null,
    });

    event.target.value = '';
  };

  const handleClearAttachment = () => {
    setPendingAttachment(null);
    setMediaUploadProgress(null);
  };

  const finalizeVoiceRecording = useCallback(() => {
    const chunks = [...voiceChunksRef.current];
    voiceChunksRef.current = [];

    if (discardVoiceRecordingRef.current) {
      discardVoiceRecordingRef.current = false;
      setPendingAttachment(null);
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      return;
    }

    if (chunks.length === 0) {
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      return;
    }

    const mimeType = voiceMimeTypeRef.current || 'audio/webm';
    const blob = new Blob(chunks, { type: mimeType });
    const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `nota-voz-${Date.now()}.${extension}`, { type: mimeType });
    const durationSeconds = voiceRecordingSecondsRef.current;
    const previewUrl = URL.createObjectURL(blob);

    setPendingAttachment({
      file,
      kind: 'voice',
      durationSeconds,
      previewUrl,
      waveform: voiceWaveformSnapshotRef.current,
    });
    setVoiceRecordingSeconds(0);
    voiceRecordingSecondsRef.current = 0;
    setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
  }, []);

  const handleStopVoiceRecording = useCallback(() => {
    if (voiceRecordingState !== 'recording') {
      return;
    }

    setVoiceRecordingState('idle');
    clearVoiceTimer();
    voiceRecorderRef.current?.stop();
  }, [clearVoiceTimer, voiceRecordingState]);

  const handleCancelVoiceRecording = useCallback(() => {
    if (voiceRecordingState === 'idle' && !voiceRecorderRef.current) {
      return;
    }

    discardVoiceRecordingRef.current = true;
    setVoiceRecordingState('idle');
    setVoiceRecordingSeconds(0);
    voiceRecordingSecondsRef.current = 0;
    setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
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
      toast.error('Seu navegador nao suporta gravacao de audio neste inbox.');
      return;
    }

    try {
      setVoiceRecordingState('requesting');
      setPendingAttachment(null);
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
      setMediaUploadProgress(null);
      discardVoiceRecordingRef.current = false;

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
          voiceWaveformSnapshotRef.current = nextBars;
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
        toast.error('Nao foi possivel continuar a gravacao de audio.');
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

      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Permita o microfone no navegador para gravar nota de voz.'
          : 'Nao foi possivel iniciar a gravacao de audio.';
      toast.error(message);
    }
  }, [clearVoiceTimer, finalizeVoiceRecording, sendDisabledReason, stopVoiceStream, voiceRecordingState]);

  cancelVoiceRecordingRef.current = handleCancelVoiceRecording;

  const handleSendMessage = async () => {
    if (!selectedChat) return;

    const text = messageDraft.trim();
    if (!text && !pendingAttachment) return;

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    setSending(true);

    try {
      if (pendingAttachment) {
        const caption = pendingAttachment.kind === 'voice' ? undefined : text;

        setMediaUploadProgress(0);
        mediaUploadAbortControllerRef.current = new AbortController();

        await commWhatsAppService.sendMediaMessage({
          chatId: selectedChat.external_chat_id,
          kind: pendingAttachment.kind,
          file: pendingAttachment.file,
          caption,
          durationSeconds: pendingAttachment.durationSeconds,
          onUploadProgress: setMediaUploadProgress,
          signal: mediaUploadAbortControllerRef.current.signal,
        });
        setPendingAttachment(null);
      } else {
        await commWhatsAppService.sendTextMessage(selectedChat.external_chat_id, text);
      }

      setMessageDraft('');
      hydratedChatsRef.current.add(selectedChat.external_chat_id);
      await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar mensagem', error);
      const message = error instanceof Error ? error.message : 'Nao foi possivel enviar a mensagem.';
      if (message === 'Envio de midia cancelado.') {
        toast.info('Upload do anexo cancelado.');
      } else {
        toast.error(message);
      }
    } finally {
      setSending(false);
      setMediaUploadProgress(null);
      mediaUploadAbortControllerRef.current = null;
    }
  };

  const handleCancelMediaUpload = () => {
    mediaUploadAbortControllerRef.current?.abort();
  };

  const handleComposerSubmit = () => {
    if (sending) return;

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

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    if (!hasSendPayload || pendingAttachment?.kind === 'voice' || voiceRecordingState === 'recording') {
      return;
    }

    event.preventDefault();
    void handleSendMessage();
  };

  return (
    <div className="whatsapp-inbox-shell panel-page-shell h-full overflow-hidden p-3 sm:p-4 lg:p-5">
      <div className="flex h-full min-h-0 flex-col gap-4">
        {operationalBanner && (
          <section className={`whatsapp-inbox-status-banner whatsapp-inbox-status-banner-${operationalBanner.tone} flex items-start gap-3 rounded-3xl border px-4 py-3.5`}>
            <operationalBanner.icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">{operationalBanner.title}</p>
              <p className="text-sm leading-6 opacity-90">{operationalBanner.description}</p>
            </div>
          </section>
        )}

        <section className="grid h-full min-h-0 flex-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="whatsapp-inbox-panel whatsapp-inbox-sidebar flex h-full min-h-0 flex-col rounded-[28px] border shadow-sm">
          <div className="whatsapp-inbox-sidebar-header border-b p-4">
            <div className="flex flex-col gap-3">
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                leftIcon={Search}
                className="whatsapp-inbox-search-input"
              />
              <label className="inline-flex items-center gap-2 text-sm text-[var(--panel-text-muted,#6b7280)]">
                <Checkbox checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />
                Mostrar apenas nao lidas
              </label>
            </div>
          </div>

          <div className="whatsapp-inbox-sidebar-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : chats.length === 0 ? (
              <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center">
                <MessageCircle className="h-8 w-8 whatsapp-inbox-empty-icon" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--panel-text,#1f2937)]">Nenhuma conversa ainda</p>
                  <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Assim que o webhook da Whapi receber mensagens, elas aparecerao aqui.</p>
                </div>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`whatsapp-inbox-chat-card mb-2 flex w-full flex-col rounded-3xl border px-4 py-3 text-left transition ${chat.id === selectedChatId ? 'is-active' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--panel-text,#1f2937)]">{chat.display_name}</p>
                      <p className="truncate text-xs text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(chat.phone_number)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="whatsapp-inbox-chat-meta text-[11px] uppercase tracking-[0.12em]">{formatMessageTime(chat.last_message_at)}</span>
                      {chat.unread_count > 0 && (
                        <span className="whatsapp-inbox-unread-badge inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 truncate text-sm text-[var(--panel-text-muted,#6b7280)]">{chat.last_message_text || 'Sem mensagens ainda'}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="whatsapp-inbox-panel whatsapp-inbox-thread flex h-full min-h-0 flex-col rounded-[28px] border shadow-sm">
          {!selectedChat ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <MessageCircle className="h-10 w-10 whatsapp-inbox-empty-icon" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--panel-text,#1f2937)]">Selecione uma conversa</p>
                <p className="text-sm text-[var(--panel-text-muted,#6b7280)]">Abra um chat na coluna da esquerda para acompanhar o historico e responder.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="whatsapp-inbox-thread-header flex items-start justify-between gap-4 border-b p-5">
                <div>
                  <p className="text-lg font-semibold text-[var(--panel-text,#1f2937)]">{selectedChat.display_name}</p>
                  <p className="mt-1 text-sm text-[var(--panel-text-muted,#6b7280)]">{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className={`whatsapp-inbox-status-pill whatsapp-inbox-status-pill-${isChannelConnected ? 'success' : 'warning'}`}>
                    {formatConnectionStatusLabel(connectionStatus)}
                  </span>
                  {channelState?.last_webhook_received_at && (
                    <span className="text-xs text-[var(--panel-text-muted,#6b7280)]">
                      Webhook: {formatMessageTime(channelState.last_webhook_received_at)}
                    </span>
                  )}
                </div>
              </div>

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="whatsapp-inbox-messages min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5"
              >
                {(hasOlderMessages || loadingOlderMessages) && (
                  <div className="sticky top-0 z-[1] flex justify-center pb-3">
                    <button
                      type="button"
                      onClick={() => void handleLoadOlderMessages()}
                      disabled={loadingOlderMessages}
                      className="whatsapp-inbox-load-older inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition"
                    >
                      {loadingOlderMessages ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5" />
                      )}
                      {loadingOlderMessages ? 'Carregando...' : 'Carregar mais'}
                    </button>
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
                  messages.map((message) => (
                    <div key={message.id} className={`message-bubble-row flex w-full ${message.direction === 'outbound' ? 'justify-end' : message.direction === 'system' ? 'justify-center' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${getMessageBubbleClasses(message.direction)}`}>
                        <WhatsAppMessageBody message={message} onOpenImage={setLightboxMedia} />
                        <div className="whatsapp-inbox-message-meta mt-2 flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.08em]">
                          <span>{formatMessageTime(message.message_at)}</span>
                          {message.direction === 'outbound' && <DeliveryStatusIndicator message={message} />}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="whatsapp-inbox-composer-area border-t p-4 sm:p-5">
                <div className={`whatsapp-inbox-composer rounded-[30px] border px-3 ${isComposerExpanded ? 'py-2.5' : 'py-1.5'}`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    className="hidden"
                    onChange={handleAttachmentInputChange}
                  />

                  {voiceRecordingState === 'recording' && (
                    <div className="whatsapp-inbox-recorder-card mb-3 rounded-2xl border px-3 py-3">
                      <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--panel-text,#1f2937)]">Gravando nota de voz</p>
                        <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">{formatDurationLabel(voiceRecordingSeconds)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelVoiceRecording}
                        className="whatsapp-inbox-composer-icon inline-flex h-8 w-8 items-center justify-center rounded-full transition"
                        aria-label="Cancelar gravacao"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      </div>
                      <div className="mt-3">
                        <WaveformBars bars={voiceRecordingWaveform} active />
                      </div>
                    </div>
                  )}

                  {pendingAttachment && (
                    <div className="whatsapp-inbox-attachment-card mb-3 rounded-2xl border px-3 py-3">
                      <div className="flex items-start gap-3">
                        {pendingAttachment.kind === 'image' ? (
                          <FileImage className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        ) : pendingAttachment.kind === 'audio' || pendingAttachment.kind === 'voice' ? (
                          <FileAudio className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        )}
                        <div className="min-w-0 flex-1 space-y-3">
                          <div>
                            <p className="truncate text-sm font-medium">{pendingAttachment.kind === 'voice' ? 'Nota de voz pronta para envio' : pendingAttachment.file.name}</p>
                            <p className="text-xs opacity-75">
                              {pendingAttachment.kind === 'voice' && pendingAttachment.durationSeconds != null
                                ? `${formatDurationLabel(pendingAttachment.durationSeconds)} • ${formatFileSize(pendingAttachment.file.size)}`
                                : formatFileSize(pendingAttachment.file.size)}
                            </p>
                          </div>

                          {pendingAttachment.kind === 'voice' && pendingAttachment.waveform ? (
                            <WaveformBars bars={pendingAttachment.waveform} />
                          ) : null}

                          {pendingAttachment.kind === 'voice' && pendingAttachment.previewUrl ? (
                            <audio controls preload="metadata" className="w-full max-w-[320px]">
                              <source src={pendingAttachment.previewUrl} type={pendingAttachment.file.type || undefined} />
                            </audio>
                          ) : pendingAttachment.kind === 'image' && pendingAttachment.previewUrl ? (
                            <img src={pendingAttachment.previewUrl} alt={pendingAttachment.file.name} className="max-h-[180px] rounded-2xl object-cover" />
                          ) : null}

                          {typeof mediaUploadProgress === 'number' && sending ? (
                            <div className="space-y-1.5">
                              <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                                <div className="whatsapp-inbox-upload-progress h-full rounded-full" style={{ width: `${mediaUploadProgress}%` }} />
                              </div>
                              <p className="text-xs opacity-75">Enviando anexo... {mediaUploadProgress}%</p>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2">
                            {sending ? (
                              <button
                                type="button"
                                onClick={handleCancelMediaUpload}
                                className="whatsapp-inbox-attachment-action inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition"
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancelar upload
                              </button>
                            ) : null}
                            {pendingAttachment.kind === 'voice' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  handleClearAttachment();
                                  void handleStartVoiceRecording();
                                }}
                                disabled={sending}
                                className="whatsapp-inbox-attachment-action inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition"
                              >
                                <Mic className="h-3.5 w-3.5" />
                                Regravar
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={handleClearAttachment}
                              disabled={sending}
                              className="whatsapp-inbox-attachment-action inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition"
                              aria-label="Remover anexo"
                            >
                              <X className="h-3.5 w-3.5" />
                              Remover
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`flex gap-1.5 sm:gap-2 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                    <div className={`flex shrink-0 gap-0.5 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                      <button
                        type="button"
                        onClick={handleOpenAttachmentPicker}
                        disabled={voiceRecordingState !== 'idle'}
                        className="whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-full transition"
                        aria-label="Anexar"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        disabled
                        className="whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-full transition"
                        aria-label="Emojis"
                      >
                        <Smile className="h-5 w-5" />
                      </button>
                    </div>

                    <div className={`min-w-0 flex-1 ${isComposerExpanded ? 'py-1.5' : 'py-0.5'}`}>
                      <textarea
                        ref={composerTextareaRef}
                        rows={1}
                        value={messageDraft}
                        onChange={(event) => setMessageDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder={voiceRecordingState === 'recording' ? 'Gravando nota de voz...' : pendingAttachment?.kind === 'voice' ? 'Nota de voz pronta para enviar' : 'Digite uma mensagem'}
                        disabled={sending || voiceRecordingState === 'recording' || pendingAttachment?.kind === 'voice'}
                        className="whatsapp-inbox-composer-input block w-full resize-none border-none bg-transparent px-0 py-0 text-[15px] leading-6 focus:outline-none"
                      />
                    </div>

                    <div className={`flex shrink-0 ${isComposerExpanded ? 'items-end pb-0.5' : 'items-center'}`}>
                      <button
                        type="button"
                        onClick={handleComposerSubmit}
                        disabled={sending || Boolean(sendDisabledReason) || voiceRecordingState === 'requesting'}
                        className={`whatsapp-inbox-composer-action inline-flex h-11 w-11 items-center justify-center rounded-full transition ${hasSendPayload || voiceRecordingState === 'recording' ? 'is-active' : ''} ${sending || voiceRecordingState === 'requesting' ? 'cursor-wait opacity-70' : ''}`}
                        aria-label={voiceRecordingState === 'requesting' ? 'Solicitando microfone' : voiceRecordingState === 'recording' ? 'Parar gravacao' : hasSendPayload ? 'Enviar mensagem' : 'Gravar audio'}
                        title={sendDisabledReason ?? undefined}
                      >
                        {sending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : voiceRecordingState === 'requesting' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : voiceRecordingState === 'recording' ? (
                          <Square className="h-5 w-5" />
                        ) : hasSendPayload ? (
                          <SendHorizontal className="h-5 w-5" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
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
              aria-label="Fechar visualizacao"
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
      </div>
    </div>
  );
}
