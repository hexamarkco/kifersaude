import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AlertCircle, AlertTriangle, Check, CheckCheck, ChevronUp, Clock3, Download, FileAudio, FileImage, FileText, Headphones, Images, Info, Loader2, MessageCircle, Mic, Pause, Play, Plus, Search, SendHorizontal, SlidersHorizontal, Smile, Trash2, UserRound, Volume2, WifiOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import StatusDropdown from '../../../components/StatusDropdown';
import { useConfig } from '../../../contexts/ConfigContext';
import {
  commWhatsAppService,
  formatCommWhatsAppPhoneLabel,
  type CommWhatsAppLeadContractSummary,
  type CommWhatsAppLeadPanel,
  type CommWhatsAppLeadSearchResult,
  type CommWhatsAppMediaSendKind,
  type CommWhatsAppOperationalState,
} from '../../../lib/commWhatsAppService';
import { toast } from '../../../lib/toast';
import type { CommWhatsAppChat, CommWhatsAppMessage, CommWhatsAppPhoneContact } from '../../../lib/supabase';
import WhatsAppLeadDrawer from './components/WhatsAppLeadDrawer';
import WhatsAppStartChatModal from './components/WhatsAppStartChatModal';

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
  waveformPayload?: string | null;
};
type AttachmentMenuAction = 'document' | 'media' | 'audio' | 'contact';
type ChatActivityFilter = 'all' | 'unread';
type ChatLeadFilter = 'all' | 'with_lead' | 'without_lead';
type ChatSavedFilter = 'all' | 'saved' | 'unsaved';
type ChatStatusFilter = 'all' | 'open' | 'pending' | 'closed';

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
        const resolvedMessage = resolveError instanceof Error ? resolveError.message : 'Nao foi possivel carregar a midia.';
        setError(resolvedMessage.includes('specified media not found') ? 'Arquivo indisponivel no momento.' : resolvedMessage);
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
          {kind !== 'voice' ? <p className="truncate text-sm font-semibold">{fileName || 'Arquivo de audio'}</p> : null}
          <p className="text-xs opacity-75">{loading ? 'Carregando audio...' : error || 'Audio indisponivel'}</p>
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
            aria-label={isPlaying ? 'Pausar audio' : 'Reproduzir audio'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          <div className={`min-w-0 flex-1 ${kind === 'voice' ? 'space-y-1.5' : 'space-y-2'}`}>
            {kind !== 'voice' ? (
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold">{fileName || 'Arquivo de audio'}</p>
                <span className="text-[11px] uppercase tracking-[0.08em] opacity-70">Audio enviado</span>
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
    <button
      type="button"
      onClick={onRetry}
      disabled={loading}
      className="whatsapp-inbox-retry-button inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
      Reenviar
    </button>
  );
}

function InboxFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${
        active
          ? 'border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/50 text-[var(--panel-accent-ink,#8b4d12)]'
          : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent-border,#d2ab85)] hover:text-[var(--panel-text,#1c1917)]'
      }`}
    >
      {label}
    </button>
  );
}

function InboxFilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <InboxFilterChip key={option.value} active={value === option.value} label={option.label} onClick={() => onChange(option.value)} />
        ))}
      </div>
    </div>
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
            {loading ? 'Carregando imagem...' : error || 'Imagem indisponivel'}
          </div>
        )}
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="space-y-3">
        <div className="whatsapp-inbox-image-card overflow-hidden rounded-2xl border">
          {mediaUrl ? (
            <video controls preload="metadata" className="max-h-[320px] w-full bg-black object-contain">
              <source src={mediaUrl} type={message.media_mime_type || undefined} />
            </video>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-black/5 text-sm opacity-80">
              {loading ? 'Carregando video...' : error || 'Video indisponivel'}
            </div>
          )}
          <div className="whatsapp-inbox-image-card-footer flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="truncate font-medium">{message.media_file_name || 'Video'}</span>
            <span className="shrink-0 opacity-80">{formatFileSize(message.media_size_bytes) || 'Midia'}</span>
          </div>
        </div>
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
      </div>
    );
  }

  if (kind === 'document') {
    const extension = message.media_file_name?.split('.').pop()?.toUpperCase() || 'DOC';

    return (
      <div className="space-y-3">
        <div className="whatsapp-inbox-document-card flex items-center gap-3 rounded-2xl border px-3 py-3">
          <div className="whatsapp-inbox-document-thumb flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xs font-black tracking-[0.08em]">
            {extension.slice(0, 4)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{message.media_file_name || 'Documento'}</p>
            <p className="text-xs opacity-75">{formatFileSize(message.media_size_bytes) || 'Documento anexo'}</p>
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
        <WhatsAppAudioPlayerCard
          kind={kind}
          mediaUrl={mediaUrl}
          mediaMimeType={message.media_mime_type}
          fileName={message.media_file_name}
          durationSeconds={message.media_duration_seconds}
          loading={loading}
          error={error}
        />
        {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{caption}</p> : null}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text_content || '[Mensagem sem texto]'}</p>;
}

export default function WhatsAppInboxScreen() {
  const navigate = useNavigate();
  const { leadStatuses, options } = useConfig();
  const responsavelOptions = options.lead_responsavel;
  const [loading, setLoading] = useState(true);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [chatActivityFilter, setChatActivityFilter] = useState<ChatActivityFilter>('all');
  const [chatLeadFilter, setChatLeadFilter] = useState<ChatLeadFilter>('all');
  const [chatSavedFilter, setChatSavedFilter] = useState<ChatSavedFilter>('all');
  const [chatStatusFilter, setChatStatusFilter] = useState<ChatStatusFilter>('all');
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentInputAccept, setAttachmentInputAccept] = useState('image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,audio/*');
  const [chats, setChats] = useState<CommWhatsAppChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [voiceRecordingState, setVoiceRecordingState] = useState<VoiceRecordingState>('idle');
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [voiceRecordingWaveform, setVoiceRecordingWaveform] = useState<number[]>(DEFAULT_WAVEFORM);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<number | null>(null);
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
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
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
  const autoSendVoiceRef = useRef(false);
  const autoLinkedLeadKeyRef = useRef<string | null>(null);
  const autoLinkSuppressedChatIdRef = useRef<string | null>(null);
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
  const hasTypedMessage = messageDraft.trim().length > 0;
  const hasSendPayload = hasTypedMessage || pendingAttachment !== null;
  const pollingEnabled = isDocumentVisible && isWindowFocused;
  const isVoiceComposerMode = voiceRecordingState === 'recording' || pendingAttachment?.kind === 'voice';

  const buildChatsSignature = useCallback(
    (items: CommWhatsAppChat[]) =>
      items
        .map(
          (chat) =>
            `${chat.id}:${chat.updated_at}:${chat.unread_count}:${chat.last_message_at ?? ''}:${chat.last_message_text ?? ''}:${chat.display_name}:${chat.saved_contact_name ?? ''}:${chat.lead_id ?? ''}`,
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
  const hasActiveChatFilters =
    chatActivityFilter !== 'all' || chatLeadFilter !== 'all' || chatSavedFilter !== 'all' || chatStatusFilter !== 'all';
  const activeChatFiltersCount =
    (chatActivityFilter !== 'all' ? 1 : 0) +
    (chatLeadFilter !== 'all' ? 1 : 0) +
    (chatSavedFilter !== 'all' ? 1 : 0) +
    (chatStatusFilter !== 'all' ? 1 : 0);

  const upsertChatLocally = useCallback((nextChat: CommWhatsAppChat) => {
    setChats((current) => {
      const exists = current.some((chat) => chat.id === nextChat.id);
      const updated = exists
        ? current.map((chat) => (chat.id === nextChat.id ? { ...chat, ...nextChat } : chat))
        : [nextChat, ...current];

      return updated.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
    });
  }, []);

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
      setLeadContractsError(error instanceof Error ? error.message : 'Nao foi possivel carregar os contratos do lead.');
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
      await loadLeadContracts(lead?.id ?? null);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao carregar painel do lead', error);
      setLeadPanel(null);
      setLeadContracts([]);
      setLeadContractsError(null);
    } finally {
      setLeadPanelLoading(false);
    }
  }, [loadLeadContracts]);

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
    latestCrmStartResultsRef.current = crmStartResults;
  }, [crmStartResults]);

  useEffect(() => {
    const previewUrl = pendingAttachment?.previewUrl;
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [pendingAttachment?.previewUrl]);

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
    if (!advancedFiltersOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (advancedFiltersRef.current && target && !advancedFiltersRef.current.contains(target)) {
        setAdvancedFiltersOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [advancedFiltersOpen]);

  useEffect(() => {
    const audio = voicePreviewAudioRef.current;
    if (!audio || pendingAttachment?.kind !== 'voice') {
      setVoicePreviewPlaying(false);
      setVoicePreviewCurrentTime(0);
      setVoicePreviewDuration(pendingAttachment?.durationSeconds ?? null);
      return;
    }

    const handleTimeUpdate = () => {
      setVoicePreviewCurrentTime(audio.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setVoicePreviewDuration(audio.duration);
      } else {
        setVoicePreviewDuration(pendingAttachment.durationSeconds ?? null);
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
  }, [pendingAttachment]);

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
    if (!leadDrawerOpen) {
      return;
    }

    setLeadSearchQuery('');
    void loadLeadPanel(selectedChat);
  }, [leadDrawerOpen, loadLeadPanel, selectedChat]);

  useEffect(() => {
    if (!selectedChat?.lead_id) {
      setLeadPanel(null);
      return;
    }

    void loadLeadPanel(selectedChat);
  }, [loadLeadPanel, selectedChat]);

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
        leadFilter: chatLeadFilter,
        savedFilter: chatSavedFilter,
        chatStatusFilter: chatStatusFilter,
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
  }, [buildChatsSignature, chatActivityFilter, chatLeadFilter, chatSavedFilter, chatStatusFilter, search]);

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

  const handleAttachmentMenuAction = (action: AttachmentMenuAction) => {
    if (voiceRecordingState !== 'idle') {
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
    if (voiceRecordingState !== 'idle') {
      event.target.value = '';
      return;
    }

    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    setPendingAttachment({
      file: nextFile,
      kind: inferAttachmentKind(nextFile),
      previewUrl: URL.createObjectURL(nextFile),
    });

    event.target.value = '';
  };

  const handleClearAttachment = () => {
    voicePreviewAudioRef.current?.pause();
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.currentTime = 0;
    }
    setVoicePreviewPlaying(false);
    setVoicePreviewCurrentTime(0);
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

    setPendingAttachment({
      file,
      kind: 'voice',
      durationSeconds,
      previewUrl,
      waveform: voiceWaveformSnapshotRef.current,
      waveformPayload: voiceWaveformPayloadRef.current || null,
    });
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
      toast.error('Seu navegador nao suporta gravacao de audio neste inbox.');
      return;
    }

    try {
      setVoiceRecordingState('requesting');
      setPendingAttachment(null);
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
      voiceWaveformPayloadRef.current = '';

      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Permita o microfone no navegador para gravar nota de voz.'
          : 'Nao foi possivel iniciar a gravacao de audio.';
      toast.error(message);
    }
  }, [clearVoiceTimer, finalizeVoiceRecording, sendDisabledReason, stopVoiceStream, voiceRecordingState]);

  cancelVoiceRecordingRef.current = handleCancelVoiceRecording;

  const handleToggleVoicePreviewPlayback = useCallback(() => {
    const audio = voicePreviewAudioRef.current;
    if (!audio || pendingAttachment?.kind !== 'voice') {
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
      toast.error('Nao foi possivel reproduzir a nota de voz agora.');
    });
  }, [pendingAttachment?.kind, voicePreviewPlaying]);

  const handleSendCurrentVoiceRecording = useCallback(() => {
    if (voiceRecordingState === 'recording') {
      handleStopVoiceRecording(true);
      return;
    }

    if (pendingAttachment?.kind === 'voice') {
      void handleSendMessage();
    }
  }, [handleStopVoiceRecording, pendingAttachment?.kind, voiceRecordingState]);

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
        const previewUrlForSentMessage = URL.createObjectURL(pendingAttachment.file);

        setMediaUploadProgress(0);
        mediaUploadAbortControllerRef.current = new AbortController();

        const sendResult = await commWhatsAppService.sendMediaMessage({
          chatId: selectedChat.external_chat_id,
          kind: pendingAttachment.kind,
          file: pendingAttachment.file,
          caption,
          durationSeconds: pendingAttachment.durationSeconds,
          waveform: pendingAttachment.kind === 'voice' ? pendingAttachment.waveformPayload || undefined : undefined,
          onUploadProgress: setMediaUploadProgress,
          signal: mediaUploadAbortControllerRef.current.signal,
        });

        if (sendResult.messageId && previewUrlForSentMessage) {
          commWhatsAppService.rememberLocalMediaPreview(sendResult.messageId, previewUrlForSentMessage);
        }

        await commWhatsAppService.syncChatHistory(selectedChat.external_chat_id).catch(() => undefined);
        voicePreviewAudioRef.current?.pause();
        if (voicePreviewAudioRef.current) {
          voicePreviewAudioRef.current.currentTime = 0;
        }
        setVoicePreviewPlaying(false);
        setVoicePreviewCurrentTime(0);
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

  useEffect(() => {
    if (!pendingAttachment || pendingAttachment.kind !== 'voice') {
      autoSendVoiceRef.current = false;
      return;
    }

    if (!autoSendVoiceRef.current) {
      return;
    }

    autoSendVoiceRef.current = false;
    void handleSendMessage();
  }, [handleSendMessage, pendingAttachment]);

  const handleCancelMediaUpload = () => {
    mediaUploadAbortControllerRef.current?.abort();
  };

  const handleRetryMediaMessage = async (message: CommWhatsAppMessage) => {
    setRetryingMessageId(message.id);

    try {
      await commWhatsAppService.retryMediaMessage(message.id);
      if (selectedChat) {
        await Promise.all([loadMessages(selectedChat, 'send'), loadChats()]);
      }
      toast.success('Midia reenviada com sucesso.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao reenviar midia', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel reenviar a midia.');
    } finally {
      setRetryingMessageId(null);
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
        toast.error(error instanceof Error ? error.message : 'Nao foi possivel vincular o lead ao chat.');
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
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel desvincular o lead do chat.');
    }
  };

  const handleLeadStatusChange = async (_leadId: string, newStatus: string) => {
    if (!selectedChat) {
      return;
    }

    await commWhatsAppService.updateLinkedLeadStatus(selectedChat.id, newStatus);
    await loadLeadPanel(selectedChat);
    await loadChats();
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
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel iniciar a conversa a partir do contato salvo.');
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
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel iniciar a conversa a partir do lead do CRM.');
    } finally {
      setStartingChatKey(null);
    }
  };

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
      toast.success('Conversa aberta pelo numero informado.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao iniciar chat manual', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel iniciar a conversa pelo numero informado.');
    } finally {
      setStartingChatKey(null);
    }
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
    <div className="whatsapp-inbox-shell panel-page-shell h-full overflow-hidden p-0">
      <div className="flex h-full min-h-0 flex-col gap-0">
        {operationalBanner && (
          <section className={`whatsapp-inbox-status-banner whatsapp-inbox-status-banner-${operationalBanner.tone} m-4 mb-0 flex items-start gap-3 rounded-3xl border px-4 py-3.5`}>
            <operationalBanner.icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">{operationalBanner.title}</p>
              <p className="text-sm leading-6 opacity-90">{operationalBanner.description}</p>
            </div>
          </section>
        )}

        <section className="grid h-full min-h-0 flex-1 gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="whatsapp-inbox-panel whatsapp-inbox-sidebar flex h-full min-h-0 flex-col border shadow-sm xl:rounded-r-none xl:border-r">
          <div className="whatsapp-inbox-sidebar-header border-b p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--panel-text-muted,#8a735f)]">Conversas</p>
                <Button
                  size="sm"
                  onClick={() => setStartChatModalOpen(true)}
                  className="h-9 w-9 px-0"
                  aria-label="Novo chat"
                  title="Novo chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar por nome ou telefone"
                leftIcon={Search}
                className="whatsapp-inbox-search-input"
              />

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <InboxFilterChip
                  active={!hasActiveChatFilters}
                  label="Todas"
                  onClick={() => {
                    setChatActivityFilter('all');
                    setChatLeadFilter('all');
                    setChatSavedFilter('all');
                    setChatStatusFilter('all');
                    setAdvancedFiltersOpen(false);
                  }}
                />

                <div ref={advancedFiltersRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setAdvancedFiltersOpen((current) => !current)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                      advancedFiltersOpen || activeChatFiltersCount > 0
                        ? 'border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/50 text-[var(--panel-accent-ink,#8b4d12)]'
                        : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent-border,#d2ab85)] hover:text-[var(--panel-text,#1c1917)]'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtros{activeChatFiltersCount > 0 ? ` (${activeChatFiltersCount})` : ''}
                  </button>

                  {advancedFiltersOpen && (
                    <div className="absolute right-0 top-full z-[30] mt-2 w-[300px] rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-3 shadow-2xl">
                      <div className="space-y-3">
                        <InboxFilterGroup
                          label="Atividade"
                          value={chatActivityFilter}
                          onChange={setChatActivityFilter}
                          options={[
                            { value: 'all', label: 'Todas' },
                            { value: 'unread', label: 'Nao lidas' },
                          ]}
                        />

                        <InboxFilterGroup
                          label="CRM"
                          value={chatLeadFilter}
                          onChange={setChatLeadFilter}
                          options={[
                            { value: 'all', label: 'Todos' },
                            { value: 'with_lead', label: 'Com lead' },
                            { value: 'without_lead', label: 'Sem lead' },
                          ]}
                        />

                        <InboxFilterGroup
                          label="Agenda"
                          value={chatSavedFilter}
                          onChange={setChatSavedFilter}
                          options={[
                            { value: 'all', label: 'Todos' },
                            { value: 'saved', label: 'Salvos' },
                            { value: 'unsaved', label: 'Nao salvos' },
                          ]}
                        />

                        <InboxFilterGroup
                          label="Status do chat"
                          value={chatStatusFilter}
                          onChange={setChatStatusFilter}
                          options={[
                            { value: 'all', label: 'Todos' },
                            { value: 'open', label: 'Abertas' },
                            { value: 'pending', label: 'Pendentes' },
                            { value: 'closed', label: 'Fechadas' },
                          ]}
                        />

                        {hasActiveChatFilters ? (
                          <button
                            type="button"
                            onClick={() => {
                              setChatActivityFilter('all');
                              setChatLeadFilter('all');
                              setChatSavedFilter('all');
                              setChatStatusFilter('all');
                              setAdvancedFiltersOpen(false);
                            }}
                            className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)] transition hover:opacity-80"
                          >
                            Limpar filtros
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
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
                  className={`whatsapp-inbox-chat-card flex w-full flex-col border-b px-4 py-3 text-left transition ${chat.id === selectedChatId ? 'is-active' : ''}`}
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

        <div className="whatsapp-inbox-panel whatsapp-inbox-thread flex h-full min-h-0 flex-col border shadow-sm xl:rounded-l-none xl:border-l-0">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-[var(--panel-text,#1f2937)]">{selectedChat.display_name}</p>
                    {selectedChat.lead_id && leadPanel?.id && leadPanel.status_nome ? (
                      <StatusDropdown
                        currentStatus={leadPanel.status_nome}
                        leadId={leadPanel.id}
                        onStatusChange={handleLeadStatusChange}
                        statusOptions={leadStatuses}
                        disabled={leadPanelLoading}
                      />
                    ) : null}
                    {selectedChatWasAutoLinked ? (
                      <span className="inline-flex items-center rounded-full border border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                        Auto
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--panel-text-muted,#6b7280)]">
                    <span>{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</span>
                    {leadPanel?.responsavel_label ? <span>Responsavel: {leadPanel.responsavel_label}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-3">
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
                  <button
                    type="button"
                    onClick={handleOpenLeadDrawer}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] text-[var(--panel-text-soft,#5b4635)] transition hover:border-[var(--panel-accent-border,#d2ab85)] hover:text-[var(--panel-text,#1c1917)]"
                    aria-label="Abrir informações do lead"
                    title={selectedChat.lead_id ? 'Abrir informações do lead' : 'Vincular lead do CRM'}
                  >
                    <Info className="h-4 w-4" />
                  </button>
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
                        <div className="whatsapp-inbox-message-meta mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px] uppercase tracking-[0.08em]">
                          <span>{formatMessageTime(message.message_at)}</span>
                          {message.direction === 'outbound' && <DeliveryStatusIndicator message={message} />}
                          {message.direction === 'outbound' && ['image', 'video', 'document', 'audio', 'voice'].includes(message.message_type) && message.delivery_status === 'failed' && message.media_id ? (
                            <RetryMediaButton loading={retryingMessageId === message.id} onRetry={() => void handleRetryMediaMessage(message)} />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="whatsapp-inbox-composer-area border-t p-4 sm:p-5">
                <div className={`whatsapp-inbox-composer rounded-[30px] border ${isVoiceComposerMode ? 'is-voice-mode px-0 py-0' : `px-3 ${isComposerExpanded ? 'py-2.5' : 'py-1.5'}`}`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={attachmentInputAccept}
                    className="hidden"
                    onChange={handleAttachmentInputChange}
                  />

                  {pendingAttachment?.kind === 'voice' ? (
                    <>
                      <audio ref={voicePreviewAudioRef} src={pendingAttachment.previewUrl ?? undefined} preload="metadata" className="hidden" />
                      <div className="whatsapp-inbox-voice-composer flex items-center gap-2.5 rounded-[24px] px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={handleClearAttachment}
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
                            <WaveformBars bars={pendingAttachment.waveform} active={voicePreviewPlaying} />
                          </div>
                          <span className="whatsapp-inbox-voice-time shrink-0 text-sm font-semibold tabular-nums">
                            {formatDurationLabel(
                              Math.max(
                                0,
                                Math.round(voicePreviewPlaying ? voicePreviewCurrentTime : (voicePreviewDuration ?? pendingAttachment.durationSeconds ?? 0)),
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
                    <div className="whatsapp-inbox-voice-composer is-recording flex items-center gap-2.5 rounded-[24px] px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={handleCancelVoiceRecording}
                        className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                        aria-label="Descartar gravacao"
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
                          aria-label="Parar gravacao"
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

                  {pendingAttachment && pendingAttachment.kind !== 'voice' && (
                    <div className="whatsapp-inbox-attachment-card mb-3 rounded-2xl border px-3 py-3">
                      <div className="flex items-start gap-3">
                        {pendingAttachment.kind === 'image' ? (
                          <FileImage className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        ) : pendingAttachment.kind === 'video' ? (
                          <Images className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        ) : pendingAttachment.kind === 'audio' ? (
                          <FileAudio className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        )}
                        <div className="min-w-0 flex-1 space-y-3">
                          <div>
                            <p className="truncate text-sm font-medium text-[var(--panel-text,#1f2937)]">{pendingAttachment.file.name}</p>
                            <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">{formatFileSize(pendingAttachment.file.size)}</p>
                          </div>

                          {pendingAttachment.kind === 'image' && pendingAttachment.previewUrl ? (
                            <img src={pendingAttachment.previewUrl} alt={pendingAttachment.file.name} className="max-h-[180px] rounded-2xl object-cover" />
                          ) : pendingAttachment.kind === 'video' && pendingAttachment.previewUrl ? (
                            <video controls preload="metadata" className="max-h-[220px] rounded-2xl bg-black">
                              <source src={pendingAttachment.previewUrl} type={pendingAttachment.file.type || undefined} />
                            </video>
                          ) : null}

                          {typeof mediaUploadProgress === 'number' && sending ? (
                            <div className="space-y-1.5">
                              <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                                <div className="whatsapp-inbox-upload-progress h-full rounded-full" style={{ width: `${mediaUploadProgress}%` }} />
                              </div>
                              <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">Enviando anexo... {mediaUploadProgress}%</p>
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

                  {voiceRecordingState === 'recording' || pendingAttachment?.kind === 'voice' ? null : (
                  <div className={`flex gap-1.5 sm:gap-2 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                    <div ref={attachmentMenuRef} className={`relative flex shrink-0 gap-0.5 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                      {attachmentMenuOpen && (
                        <div className="whatsapp-inbox-attach-menu absolute bottom-full left-0 z-[20] mb-3 min-w-[228px] overflow-hidden rounded-[22px] border p-2 shadow-2xl">
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('document')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-violet-500">
                              <FileText className="h-4.5 w-4.5" />
                            </span>
                            <span>Documento</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('media')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-sky-500">
                              <Images className="h-4.5 w-4.5" />
                            </span>
                            <span>Fotos e videos</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('audio')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-orange-500">
                              <FileAudio className="h-4.5 w-4.5" />
                            </span>
                            <span>Audio</span>
                          </button>
                          <button
                            type="button"
                            disabled
                            className="whatsapp-inbox-attach-menu-item is-disabled mt-1 flex w-full items-center gap-3 border-t border-[var(--panel-border-subtle,#e7dac8)]/60 px-3 pt-3 pb-2.5 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-cyan-500">
                              <UserRound className="h-4.5 w-4.5" />
                            </span>
                            <span>Contato</span>
                            <span className="whatsapp-inbox-attach-menu-badge ml-auto text-[10px] font-semibold uppercase tracking-[0.12em]">Em breve</span>
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setAttachmentMenuOpen((current) => !current)}
                        disabled={voiceRecordingState !== 'idle'}
                        className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 items-center justify-center rounded-full transition ${attachmentMenuOpen ? 'is-open' : ''}`}
                        aria-label="Anexar"
                        aria-expanded={attachmentMenuOpen}
                      >
                        <Plus className={`h-5 w-5 transition ${attachmentMenuOpen ? 'rotate-45' : ''}`} />
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
                        placeholder="Digite uma mensagem"
                        disabled={sending}
                        className="whatsapp-inbox-composer-input block w-full resize-none border-none bg-transparent px-0 py-0 text-[15px] leading-6 focus:outline-none"
                      />
                    </div>

                    <div className={`flex shrink-0 ${isComposerExpanded ? 'items-end pb-0.5' : 'items-center'}`}>
                      <button
                        type="button"
                        onClick={handleComposerSubmit}
                        disabled={sending || Boolean(sendDisabledReason) || voiceRecordingState === 'requesting'}
                        className={`whatsapp-inbox-composer-action inline-flex h-11 w-11 items-center justify-center rounded-full transition ${hasSendPayload ? 'is-active' : ''} ${sending || voiceRecordingState === 'requesting' ? 'cursor-wait opacity-70' : ''}`}
                        aria-label={voiceRecordingState === 'requesting' ? 'Solicitando microfone' : hasSendPayload ? 'Enviar mensagem' : 'Gravar audio'}
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

        <WhatsAppLeadDrawer
          isOpen={leadDrawerOpen}
          onClose={handleCloseLeadDrawer}
          chatDisplayName={selectedChat?.display_name || 'Conversa'}
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
      </div>
    </div>
  );
}
