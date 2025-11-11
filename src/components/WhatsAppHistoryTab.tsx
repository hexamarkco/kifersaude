import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  supabase,
  AIGeneratedMessage,
  WhatsAppConversation,
  WhatsAppMessageDeliveryStatus,
  Lead,
  Contract,
  WhatsAppChatPreference,
} from '../lib/supabase';
import { gptService } from '../lib/gptService';
import { type WhatsAppChatRequestDetail } from '../lib/whatsappService';
import {
  listWhatsAppQuickReplies,
  createWhatsAppQuickReply,
  updateWhatsAppQuickReply,
  deleteWhatsAppQuickReply,
  type WhatsAppQuickReply,
} from '../lib/whatsappQuickRepliesService';
import StatusDropdown from './StatusDropdown';
import LeadDetails from './LeadDetails';
import LeadForm from './LeadForm';
import LeadDetailsPanel from './LeadDetailsPanel';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { createAutomaticFollowUps, cancelFollowUps } from '../lib/followUpService';
import {
  MessageCircle,
  Calendar,
  Search,
  Sparkles,
  MessageSquare,
  Check,
  CheckCircle,
  CheckCheck,
  XCircle,
  Clock,
  Loader,
  Phone,
  RefreshCcw,
  FileText,
  Paperclip,
  Mic,
  Trash2,
  Send,
  FileImage,
  FileVideo,
  FileAudio,
  Square,
  CornerUpRight,
  SmilePlus,
  Share2,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Plus,
  Star,
  StarOff,
  X,
  MapPin,
  Navigation,
  Edit,
} from 'lucide-react';
import type { PostgrestError } from '@supabase/supabase-js';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import {
  zapiService,
  type ZAPIMediaType,
  type ZAPILocationPayload,
  type ZAPIGroupMetadata,
  type ZAPIChatMetadata,
  type ZAPIContact,
  type ZAPITypingPresenceEvent,
} from '../lib/zapiService';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    lamejs?: {
      Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
        encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array;
        flush(): Uint8Array;
      };
    };
  }
}

const MP3_MIME_TYPES = ['audio/mpeg', 'audio/mp3'];
const FALLBACK_AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
];
const DEFAULT_MP3_BITRATE = 128;
const MP3_ENCODER_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
const RECORDING_WAVEFORM_BARS = 12;
const DEFAULT_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const TYPING_INACTIVITY_TIMEOUT_MS = 15000;
const TYPING_PRESENCE_SWEEP_INTERVAL_MS = 5000;

let lameJsLoadPromise: Promise<typeof window.lamejs> | null = null;

const OUTGOING_STATUS_VISUALS: Record<
  WhatsAppMessageDeliveryStatus,
  { icon: typeof Check; className: string; label: string }
> = {
  pending: { icon: Clock, className: 'text-white/70', label: 'Enviando' },
  sent: { icon: Check, className: 'text-white/80', label: 'Enviado' },
  received: { icon: CheckCheck, className: 'text-white/80', label: 'Recebido' },
  read: { icon: CheckCheck, className: 'text-cyan-100', label: 'Lido' },
  played: { icon: CheckCheck, className: 'text-cyan-100', label: 'Reproduzido' },
  read_by_me: { icon: Check, className: 'text-white/80', label: 'Lido por você' },
  failed: { icon: XCircle, className: 'text-red-200', label: 'Falha no envio' },
};

const getOutgoingDeliveryStatusVisual = (
  status?: WhatsAppMessageDeliveryStatus | null,
) => {
  if (!status) {
    return null;
  }

  return OUTGOING_STATUS_VISUALS[status] ?? null;
};

type MessageReactionDetail = {
  name: string;
  timestamp: string;
};

type MessageReactionSummary = {
  emoji: string;
  reactors: MessageReactionDetail[];
};

type MessageWithReactions = WhatsAppConversation & {
  reactionSummaries?: MessageReactionSummary[];
};

type ReactionModalState = {
  message: MessageWithReactions;
  summary: MessageReactionSummary;
};

type ChatTypingPresenceState = {
  isTyping: boolean;
  lastTypingAt: number | null;
  presenceStatus: 'online' | 'offline' | null;
  lastPresenceAt: number | null;
  lastSeenAt: number | null;
  contactName: string | null;
  updatedAt: number;
};

const isMimeTypeSupported = (mimeType: string): boolean => {
  if (typeof MediaRecorder === 'undefined') {
    return false;
  }

  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    // If the method is unavailable, optimistically assume the browser can record.
    return true;
  }

  try {
    return MediaRecorder.isTypeSupported(mimeType);
  } catch (error) {
    console.warn('Falha ao verificar suporte a tipo de mídia:', error);
    return false;
  }
};

const getPreferredMimeType = (preferredTypes: string[]): string | null => {
  for (const type of preferredTypes) {
    if (isMimeTypeSupported(type)) {
      return type;
    }
  }
  return null;
};

const isMp3MimeType = (mimeType: string | undefined | null): boolean => {
  if (!mimeType) {
    return false;
  }
  const normalized = mimeType.toLowerCase();
  return MP3_MIME_TYPES.some((type) => normalized.includes(type.split('/')[1]!));
};

const isOggMimeType = (mimeType: string | undefined | null): boolean => {
  if (!mimeType) {
    return false;
  }
  return mimeType.toLowerCase().includes('ogg');
};

const loadLameJs = async (): Promise<typeof window.lamejs> => {
  if (window.lamejs) {
    return window.lamejs;
  }

  if (typeof document === 'undefined') {
    throw new Error('Documento indisponível para carregar a biblioteca de conversão.');
  }

  if (!lameJsLoadPromise) {
    lameJsLoadPromise = new Promise((resolve, reject) => {
      if (window.lamejs) {
        resolve(window.lamejs);
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>('script[data-lamejs]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.lamejs) {
            resolve(window.lamejs);
          } else {
            lameJsLoadPromise = null;
            reject(new Error('Biblioteca lamejs carregada, mas não disponível.'));
          }
        });
        existingScript.addEventListener('error', () => {
          lameJsLoadPromise = null;
          reject(new Error('Falha ao carregar a biblioteca de conversão para MP3.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = MP3_ENCODER_SCRIPT_URL;
      script.async = true;
      script.dataset.lamejs = 'true';
      script.onload = () => {
        if (window.lamejs) {
          resolve(window.lamejs);
        } else {
          lameJsLoadPromise = null;
          reject(new Error('Biblioteca lamejs carregada, mas não disponível.'));
        }
      };
      script.onerror = () => {
        lameJsLoadPromise = null;
        reject(new Error('Falha ao carregar a biblioteca de conversão para MP3.'));
      };
      document.head.appendChild(script);
    });
  }

  return lameJsLoadPromise;
};

const floatTo16BitPCM = (input: Float32Array): Int16Array => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

const convertBlobToMp3 = async (blob: Blob): Promise<Blob> => {
  if (typeof window === 'undefined') {
    throw new Error('Ambiente sem suporte para conversão de áudio.');
  }

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Este navegador não suporta conversão de áudio para MP3.');
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextClass();

  try {
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      const handleSuccess = (buffer: AudioBuffer) => resolve(buffer);
      const handleError = (error?: DOMException | null) => {
        reject(error ?? new Error('Falha ao decodificar áudio gravado.'));
      };

      const decodeResult = audioContext.decodeAudioData(
        arrayBuffer.slice(0),
        handleSuccess,
        handleError
      );

      if (decodeResult instanceof Promise) {
        decodeResult.then(resolve).catch(reject);
      }
    });
    const channelCount = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
    const lamejs = await loadLameJs();
    if (!lamejs) {
      throw new Error('Biblioteca de conversão de áudio indisponível.');
    }
    const mp3Encoder = new lamejs.Mp3Encoder(channelCount, audioBuffer.sampleRate, DEFAULT_MP3_BITRATE);
    const blockSize = 1152;
    const mp3Chunks: Uint8Array[] = [];
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = channelCount > 1 ? audioBuffer.getChannelData(1) : null;

    for (let i = 0; i < audioBuffer.length; i += blockSize) {
      const leftChunk = leftChannel.subarray(i, Math.min(i + blockSize, leftChannel.length));
      const leftBuffer = floatTo16BitPCM(leftChunk);
      let mp3buf: Uint8Array;

      if (rightChannel) {
        const rightChunk = rightChannel.subarray(i, Math.min(i + blockSize, rightChannel.length));
        const rightBuffer = floatTo16BitPCM(rightChunk);
        mp3buf = mp3Encoder.encodeBuffer(leftBuffer, rightBuffer);
      } else {
        mp3buf = mp3Encoder.encodeBuffer(leftBuffer);
      }

      if (mp3buf.length > 0) {
        mp3Chunks.push(mp3buf);
      }
    }

    const flushChunk = mp3Encoder.flush();
    if (flushChunk.length > 0) {
      mp3Chunks.push(flushChunk);
    }

    return new Blob(mp3Chunks, { type: 'audio/mpeg' });
  } finally {
    await audioContext.close().catch(() => {
      // Ignora erros ao fechar o contexto de áudio
    });
  }
};

const isChatPreferencesTableMissingError = (error: PostgrestError | null | undefined) => {
  if (!error) return false;

  const normalizedCode = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  if (['PGRST302', 'PGRST301', '42P01', 'PGRST404'].includes(normalizedCode)) {
    return true;
  }

  const tableLower = 'whatsapp_chat_preferences';
  const normalize = (value?: string | null) => (typeof value === 'string' ? value.toLowerCase() : '');

  const message = normalize(error.message);
  const details = normalize(error.details);
  const hint = normalize(error.hint);

  return (
    message.includes(tableLower) ||
    message.includes('does not exist') ||
    details.includes(tableLower) ||
    hint.includes(tableLower)
  );
};

const sanitizePhoneDigits = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
};

const normalizeChatMetadataKey = (value?: string | null): string | null => {
  const digits = sanitizePhoneDigits(value);
  if (!digits) {
    return null;
  }

  if (digits.startsWith('55') || digits.length > 11) {
    return digits;
  }

  if (digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
};

type AttachmentType = ZAPIMediaType | 'location';

type FileAttachmentType = ZAPIMediaType;

type LocationAttachmentPayload = ZAPILocationPayload;

type FileAttachmentItem = {
  file: File;
  type: FileAttachmentType;
  previewUrl?: string | null;
};

type LocationAttachmentItem = {
  type: 'location';
  location: LocationAttachmentPayload;
};

type AttachmentItem = FileAttachmentItem | LocationAttachmentItem;

const isFileAttachment = (attachment: AttachmentItem): attachment is FileAttachmentItem =>
  attachment.type !== 'location';

const DEFAULT_ATTACHMENT_ACCEPT = 'application/pdf,image/*,video/*,audio/*';

const createEmptyLocationForm = (): LocationAttachmentPayload => ({
  title: '',
  address: '',
  latitude: '',
  longitude: '',
});

const buildPhoneLookupKeys = (value?: string | null): string[] => {
  const digits = sanitizePhoneDigits(value);
  if (!digits) return [];

  const keys = new Set<string>();
  keys.add(digits);

  if (digits.startsWith('55') && digits.length > 2) {
    keys.add(digits.slice(2));
    keys.add(`+${digits}`);
  } else if (digits.length === 11) {
    keys.add(`55${digits}`);
    keys.add(`+55${digits}`);
  }

  return Array.from(keys);
};

const buildPresenceKeyCandidates = (
  phone?: string | null,
  chatId?: string | null
): string[] => {
  const candidates = new Set<string>();

  const pushValue = (value?: string | null) => {
    if (!value || typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    candidates.add(trimmed);

    const digits = sanitizePhoneDigits(trimmed);
    if (digits) {
      candidates.add(digits);

      if (digits.startsWith('55') && digits.length > 2) {
        candidates.add(digits.slice(2));
        candidates.add(`+${digits}`);
      } else if (digits.length === 11) {
        candidates.add(`55${digits}`);
        candidates.add(`+55${digits}`);
      }
    }

    if (trimmed.includes('@')) {
      const withoutDomain = trimmed.split('@')[0] ?? '';
      if (withoutDomain) {
        candidates.add(withoutDomain);
        const domainDigits = sanitizePhoneDigits(withoutDomain);
        if (domainDigits) {
          candidates.add(domainDigits);
          if (domainDigits.startsWith('55') && domainDigits.length > 2) {
            candidates.add(domainDigits.slice(2));
            candidates.add(`+${domainDigits}`);
          } else if (domainDigits.length === 11) {
            candidates.add(`55${domainDigits}`);
            candidates.add(`+55${domainDigits}`);
          }
        }
      }
    }
  };

  pushValue(phone);
  pushValue(chatId);

  return Array.from(candidates).filter(Boolean);
};

const isGroupWhatsAppJid = (phone?: string | null): boolean => {
  if (!phone) return false;

  const normalized = phone.toLowerCase();
  if (normalized.includes('@g.us') || normalized.includes('-group')) {
    return true;
  }

  const digits = sanitizePhoneDigits(phone);
  return digits.length >= 20;
};

type LeadPreview = Pick<
  Lead,
  'id' | 'nome_completo' | 'telefone' | 'status' | 'responsavel' | 'observacoes'
>;

const toLeadPreview = (lead: Lead): LeadPreview => ({
  id: lead.id,
  nome_completo: lead.nome_completo,
  telefone: lead.telefone,
  status: lead.status,
  responsavel: lead.responsavel,
  observacoes: lead.observacoes ?? null,
});

type ChatGroupBase = {
  phone: string;
  messages: WhatsAppConversation[];
  leadId?: string | null;
  contractId?: string | null;
  lastMessage?: WhatsAppConversation;
  displayName?: string | null;
  photoUrl?: string | null;
  isGroup: boolean;
  unreadCount: number;
};

type ChatGroup = ChatGroupBase & {
  archived: boolean;
  pinned: boolean;
};

type ManualChatPlaceholder = {
  phone: string;
  displayName?: string | null;
};

const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return '';
  const withoutSuffix = phone.includes('@') ? phone.split('@')[0] : phone;
  const withoutGroupSuffix = withoutSuffix.replace(/-group$/i, '');
  return withoutGroupSuffix;
};

const normalizePhoneForChat = (phone: string): string => {
  const digits = sanitizePhoneDigits(phone);
  if (!digits) {
    return '';
  }

  if (digits.startsWith('55')) {
    return digits;
  }

  if (digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
};

type WhatsAppHistoryTabProps = {
  externalChatRequest?: (WhatsAppChatRequestDetail & { requestId?: number }) | null;
  onConsumeExternalChatRequest?: () => void;
};

export default function WhatsAppHistoryTab({
  externalChatRequest,
  onConsumeExternalChatRequest,
}: WhatsAppHistoryTabProps) {
  const [aiMessages, setAIMessages] = useState<AIGeneratedMessage[]>([]);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'chat' | 'ai-messages'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chatPreferences, setChatPreferences] = useState<Map<string, WhatsAppChatPreference>>(new Map());
  const [chatListFilter, setChatListFilter] = useState<'active' | 'archived'>('active');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>('all');

  const { leadStatuses, options } = useConfig();
  const { isObserver } = useAuth();
  const activeLeadStatuses = useMemo(
    () => leadStatuses.filter((status) => status.ativo),
    [leadStatuses]
  );
  const responsavelOptions = useMemo(
    () => (options.lead_responsavel ?? []).filter((option) => option.ativo),
    [options.lead_responsavel]
  );
  const responsavelLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    responsavelOptions.forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, [responsavelOptions]);

  const [leadsMap, setLeadsMap] = useState<Map<string, LeadPreview>>(new Map());
  const [leadsByPhoneMap, setLeadsByPhoneMap] = useState<Map<string, LeadPreview>>(new Map());
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [selectionActionState, setSelectionActionState] = useState<SelectionActionState>({
    status: 'idle',
  });
  const [externalSelectionContext, setExternalSelectionContext] = useState<WhatsAppChatRequestDetail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStartConversationModalOpen, setIsStartConversationModalOpen] = useState(false);
  const [startConversationContacts, setStartConversationContacts] = useState<ZAPIContact[]>([]);
  const [startConversationLoading, setStartConversationLoading] = useState(false);
  const [startConversationError, setStartConversationError] = useState<string | null>(null);
  const [startConversationPage, setStartConversationPage] = useState(1);
  const [startConversationHasMore, setStartConversationHasMore] = useState(true);
  const [startConversationSearch, setStartConversationSearch] = useState('');
  const [startConversationPhone, setStartConversationPhone] = useState('');
  const [startConversationSelectedContact, setStartConversationSelectedContact] = useState<string | null>(null);
  const [startConversationSelectedName, setStartConversationSelectedName] = useState<string | null>(null);
  const [manualChatPlaceholders, setManualChatPlaceholders] = useState<
    Map<string, ManualChatPlaceholder>
  >(new Map());
  const [typingPresenceMap, setTypingPresenceMap] = useState<
    Map<string, ChatTypingPresenceState>
  >(() => new Map());
  const loadedPhoneLeadsRef = useRef<Set<string>>(new Set());
  const [fullscreenMedia, setFullscreenMedia] = useState<
    | {
        url: string;
        type: 'image' | 'video' | 'gif';
        caption?: string | null;
        mimeType?: string | null;
        thumbnailUrl?: string | null;
      }
    | null
  >(null);
  const [composerText, setComposerText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isFetchingCurrentLocation, setIsFetchingCurrentLocation] = useState(false);
  const [locationForm, setLocationForm] = useState<LocationAttachmentPayload>(() =>
    createEmptyLocationForm()
  );
  const [locationFormError, setLocationFormError] = useState<string | null>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [nextAttachmentType, setNextAttachmentType] = useState<AttachmentType | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerSuccess, setComposerSuccess] = useState<string | null>(null);
  const [isAIAssistantMenuOpen, setIsAIAssistantMenuOpen] = useState(false);
  const [isGeneratingAISuggestions, setIsGeneratingAISuggestions] = useState(false);
  const [isRewritingMessage, setIsRewritingMessage] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<string[]>([]);
  const [aiAssistantError, setAIAssistantError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<WhatsAppQuickReply[]>([]);
  const [isQuickRepliesLoading, setIsQuickRepliesLoading] = useState(false);
  const [quickRepliesError, setQuickRepliesError] = useState<string | null>(null);
  const [isQuickRepliesMenuOpen, setIsQuickRepliesMenuOpen] = useState(false);
  const [quickRepliesView, setQuickRepliesView] = useState<'all' | 'favorites'>('all');
  const [quickReplySearchTerm, setQuickReplySearchTerm] = useState('');
  const [isQuickReplyModalOpen, setIsQuickReplyModalOpen] = useState(false);
  const [quickReplyModalError, setQuickReplyModalError] = useState<string | null>(null);
  const [isSavingQuickReply, setIsSavingQuickReply] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<WhatsAppQuickReply | null>(null);
  const [quickReplyForm, setQuickReplyForm] = useState<{
    title: string;
    content: string;
    category: string;
    is_favorite: boolean;
  }>(() => ({
    title: '',
    content: '',
    category: '',
    is_favorite: false,
  }));
  const [composerReplyMessage, setComposerReplyMessage] = useState<MessageWithReactions | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [manualScrollTargetId, setManualScrollTargetId] = useState<string | null>(null);
  const [manualScrollAlternateId, setManualScrollAlternateId] = useState<string | null>(null);
  const [activeReactionDetails, setActiveReactionDetails] =
    useState<ReactionModalState | null>(null);
  const [activeReactionMenuMessageId, setActiveReactionMenuMessageId] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [sendingReactionMessageId, setSendingReactionMessageId] = useState<string | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardingMessageIds, setForwardingMessageIds] = useState<string[]>([]);
  const [forwardSelectedTargetPhones, setForwardSelectedTargetPhones] = useState<string[]>([]);
  const [forwardSourcePhone, setForwardSourcePhone] = useState<string | null>(null);
  const [forwardChatSearchTerm, setForwardChatSearchTerm] = useState('');
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [forwardSuccess, setForwardSuccess] = useState<string | null>(null);
  const [isForwardingMessage, setIsForwardingMessage] = useState(false);
  const [forwardStep, setForwardStep] = useState<'messages' | 'targets'>('messages');
  const skipAutoSelectRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<AttachmentItem[]>([]);
  const attachmentButtonRef = useRef<HTMLButtonElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const quickRepliesButtonRef = useRef<HTMLButtonElement | null>(null);
  const quickRepliesMenuRef = useRef<HTMLDivElement | null>(null);
  const aiAssistantButtonRef = useRef<HTMLButtonElement | null>(null);
  const aiAssistantMenuRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string | null>(null);
  const recordingFinalizedRef = useRef(false);
  const [recordedAudio, setRecordedAudio] =
    useState<{ blob: Blob; url: string; file: File; base64: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingSupported, setIsRecordingSupported] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [recordingLevels, setRecordingLevels] = useState<number[]>(
    () => Array(RECORDING_WAVEFORM_BARS).fill(0)
  );
  const [leadContractsMap, setLeadContractsMap] = useState<Map<string, Contract[]>>(new Map());
  const leadContractsMapRef = useRef<Map<string, Contract[]>>(leadContractsMap);
  const [loadingContractsLeadId, setLoadingContractsLeadId] = useState<string | null>(null);
  const [leadContractsError, setLeadContractsError] = useState<string | null>(null);
  const [activeLeadDetails, setActiveLeadDetails] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [isLeadDetailsPanelOpen, setIsLeadDetailsPanelOpen] = useState(false);
  const [chatMetadataMap, setChatMetadataMap] = useState<Map<string, ZAPIChatMetadata>>(new Map());
  const chatMetadataPendingRef = useRef<Set<string>>(new Set());
  const [groupMetadataMap, setGroupMetadataMap] = useState<Map<string, ZAPIGroupMetadata>>(new Map());
  const groupMetadataPendingRef = useRef<Set<string>>(new Set());
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTargetMessageRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledChatRef = useRef<string | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const reactionMenuRef = useRef<HTMLDivElement | null>(null);
  const selectionFeedbackTimeoutRef = useRef<number | null>(null);

  const selectedPhone = activePhone;
  const hasSelectedPhones = selectedPhones.size > 0;

  const clearSelectionFeedbackTimeout = useCallback(() => {
    if (selectionFeedbackTimeoutRef.current !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(selectionFeedbackTimeoutRef.current);
      }
      selectionFeedbackTimeoutRef.current = null;
    }
  }, []);

  const dismissSelectionFeedback = useCallback(() => {
    clearSelectionFeedbackTimeout();
    setSelectionActionState({ status: 'idle' });
  }, [clearSelectionFeedbackTimeout]);

  const updateSelectionFeedback = useCallback(
    (state: SelectionActionState) => {
      clearSelectionFeedbackTimeout();
      setSelectionActionState(state);

      if ((state.status === 'success' || state.status === 'error') && state.message) {
        if (typeof window !== 'undefined') {
          selectionFeedbackTimeoutRef.current = window.setTimeout(() => {
            setSelectionActionState({ status: 'idle' });
            selectionFeedbackTimeoutRef.current = null;
          }, 4000);
        }
      }
    },
    [clearSelectionFeedbackTimeout]
  );

  const selectPrimaryPhone = useCallback((phone: string) => {
    setActivePhone(phone);
  }, []);

  const togglePhoneSelection = useCallback((phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  }, []);

  const clearSelectedPhones = useCallback(() => {
    setSelectedPhones(() => new Set());
  }, []);

  useEffect(() => {
    return () => {
      clearSelectionFeedbackTimeout();
    };
  }, [clearSelectionFeedbackTimeout]);
  const reactionButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const sortQuickReplies = useCallback(
    (items: WhatsAppQuickReply[]) =>
      [...items].sort((a, b) =>
        a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' })
      ),
    []
  );
  const filteredQuickReplies = useMemo(() => {
    const term = quickReplySearchTerm.trim().toLowerCase();
    const baseList = quickReplies.filter((reply) =>
      quickRepliesView === 'favorites' ? reply.is_favorite : true
    );

    if (!term) {
      return sortQuickReplies(baseList);
    }

    return sortQuickReplies(
      baseList.filter((reply) => {
        const title = reply.title?.toLowerCase() ?? '';
        const content = reply.content?.toLowerCase() ?? '';
        const category = reply.category?.toLowerCase() ?? '';
        return (
          title.includes(term) ||
          content.includes(term) ||
          category.includes(term)
        );
      })
    );
  }, [quickReplies, quickRepliesView, quickReplySearchTerm, sortQuickReplies]);

  const groupedQuickReplies = useMemo(() => {
    if (filteredQuickReplies.length === 0) {
      return [] as Array<{ category: string; replies: WhatsAppQuickReply[] }>;
    }

    const groups = new Map<string, WhatsAppQuickReply[]>();

    for (const reply of filteredQuickReplies) {
      const category = reply.category?.trim() || 'Sem categoria';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(reply);
    }

    return Array.from(groups.entries())
      .sort((a, b) => {
        const aIsUncategorized = a[0] === 'Sem categoria';
        const bIsUncategorized = b[0] === 'Sem categoria';

        if (aIsUncategorized && !bIsUncategorized) {
          return 1;
        }
        if (!aIsUncategorized && bIsUncategorized) {
          return -1;
        }

        return a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' });
      })
      .map(([category, replies]) => ({
        category,
        replies: sortQuickReplies(replies),
      }));
  }, [filteredQuickReplies, sortQuickReplies]);

  const emptyQuickRepliesMessage = useMemo(() => {
    const baseList =
      quickRepliesView === 'favorites'
        ? quickReplies.filter((reply) => reply.is_favorite)
        : quickReplies;

    if (baseList.length === 0) {
      return quickRepliesView === 'favorites'
        ? 'Nenhuma resposta rápida favoritada.'
        : 'Nenhuma resposta rápida cadastrada.';
    }

    if (quickReplySearchTerm.trim()) {
      return 'Nenhuma resposta encontrada para a pesquisa atual.';
    }

    return 'Nenhuma resposta disponível neste agrupamento.';
  }, [quickReplies, quickRepliesView, quickReplySearchTerm]);

  useEffect(() => {
    let isMounted = true;

    const loadQuickReplies = async () => {
      setIsQuickRepliesLoading(true);
      try {
        const replies = await listWhatsAppQuickReplies();
        if (!isMounted) {
          return;
        }
        setQuickReplies(sortQuickReplies(replies));
        setQuickRepliesError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as respostas rápidas.';
        setQuickRepliesError(message);
      } finally {
        if (isMounted) {
          setIsQuickRepliesLoading(false);
        }
      }
    };

    void loadQuickReplies();

    return () => {
      isMounted = false;
    };
  }, [sortQuickReplies]);

  useEffect(() => {
    if (isSendingMessage) {
      setIsQuickRepliesMenuOpen(false);
    }
  }, [isSendingMessage]);

  useEffect(() => {
    if (!isQuickRepliesMenuOpen) {
      setQuickReplySearchTerm('');
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        quickRepliesMenuRef.current?.contains(target) ||
        quickRepliesButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsQuickRepliesMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsQuickRepliesMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isQuickRepliesMenuOpen]);

  useEffect(() => {
    if (!isAIAssistantMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        aiAssistantMenuRef.current?.contains(target) ||
        aiAssistantButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsAIAssistantMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAIAssistantMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAIAssistantMenuOpen]);

  useEffect(() => {
    leadContractsMapRef.current = leadContractsMap;
  }, [leadContractsMap]);

  useEffect(() => {
    if (!activeReactionMenuMessageId) {
      reactionMenuRef.current = null;
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const menuElement = reactionMenuRef.current;
      if (menuElement && menuElement.contains(event.target as Node)) {
        return;
      }

      const buttonElement = reactionButtonRefs.current.get(activeReactionMenuMessageId);
      if (buttonElement && buttonElement.contains(event.target as Node)) {
        return;
      }

      setActiveReactionMenuMessageId(null);
      setReactionError(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveReactionMenuMessageId(null);
        setReactionError(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeReactionMenuMessageId]);

  useEffect(() => {
    if (!activeReactionMenuMessageId) {
      setReactionError(null);
    }
  }, [activeReactionMenuMessageId]);

  useEffect(() => {
    setActiveReactionMenuMessageId(null);
    setReactionError(null);
  }, [selectedPhone]);

  useEffect(() => {
    if (isSendingMessage) {
      setIsAIAssistantMenuOpen(false);
    }
  }, [isSendingMessage]);

  useEffect(() => {
    setIsAIAssistantMenuOpen(false);
    setAISuggestions([]);
    setAIAssistantError(null);
    setIsGeneratingAISuggestions(false);
    setIsRewritingMessage(false);
  }, [selectedPhone]);

  const handleToggleQuickRepliesMenu = useCallback(() => {
    setIsQuickRepliesMenuOpen((previous) => !previous);
  }, []);

  const handleInsertQuickReply = useCallback(
    (reply: WhatsAppQuickReply) => {
      const textarea = composerTextareaRef.current;

      if (textarea) {
        const { selectionStart, selectionEnd, value } = textarea;
        const newValue =
          value.slice(0, selectionStart) + reply.content + value.slice(selectionEnd);
        setComposerText(newValue);
        setTimeout(() => {
          textarea.focus();
          const cursorPosition = selectionStart + reply.content.length;
          textarea.setSelectionRange(cursorPosition, cursorPosition);
        }, 0);
      } else {
        setComposerText((previous) => {
          if (!previous) {
            return reply.content;
          }
          if (previous.endsWith(' ') || previous.endsWith('\n')) {
            return `${previous}${reply.content}`;
          }
          return `${previous} ${reply.content}`;
        });
      }

      setIsQuickRepliesMenuOpen(false);
    },
    [composerTextareaRef]
  );

  const handleToggleQuickReplyFavorite = useCallback(
    async (reply: WhatsAppQuickReply) => {
      try {
        const updated = await updateWhatsAppQuickReply(reply.id, {
          is_favorite: !reply.is_favorite,
        });

        setQuickReplies((previous) =>
          sortQuickReplies(
            previous.map((item) => (item.id === updated.id ? updated : item))
          )
        );
        setQuickRepliesError(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar o favorito da resposta rápida.';
        setQuickRepliesError(message);
      }
    },
    [sortQuickReplies]
  );

  const handleOpenCreateQuickReplyModal = useCallback(() => {
    setEditingQuickReply(null);
    setQuickReplyForm({ title: '', content: '', category: '', is_favorite: false });
    setQuickReplyModalError(null);
    setIsQuickReplyModalOpen(true);
    setIsQuickRepliesMenuOpen(false);
  }, []);

  const handleOpenEditQuickReplyModal = useCallback((reply: WhatsAppQuickReply) => {
    setEditingQuickReply(reply);
    setQuickReplyForm({
      title: reply.title ?? '',
      content: reply.content ?? '',
      category: reply.category ?? '',
      is_favorite: reply.is_favorite ?? false,
    });
    setQuickReplyModalError(null);
    setIsQuickReplyModalOpen(true);
    setIsQuickRepliesMenuOpen(false);
  }, []);

  const handleCloseQuickReplyModal = useCallback(() => {
    setIsQuickReplyModalOpen(false);
    setQuickReplyModalError(null);
    setEditingQuickReply(null);
  }, []);

  const handleQuickReplyFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = quickReplyForm.title.trim();
    const content = quickReplyForm.content.trim();
    const categoryValue = quickReplyForm.category.trim();

    if (!title || !content) {
      setQuickReplyModalError('Preencha o título e o conteúdo da resposta rápida.');
      return;
    }

    setIsSavingQuickReply(true);

    try {
      const payload = {
        title,
        content,
        category: categoryValue ? categoryValue : null,
        is_favorite: quickReplyForm.is_favorite,
      };

      if (editingQuickReply) {
        const updated = await updateWhatsAppQuickReply(editingQuickReply.id, payload);
        setQuickReplies((previous) =>
          sortQuickReplies(
            previous.map((item) => (item.id === updated.id ? updated : item))
          )
        );
      } else {
        const created = await createWhatsAppQuickReply(payload);
        setQuickReplies((previous) => sortQuickReplies([...previous, created]));
      }

      setQuickReplyModalError(null);
      setQuickRepliesError(null);
      setIsQuickReplyModalOpen(false);
      setEditingQuickReply(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a resposta rápida.';
      setQuickReplyModalError(message);
    } finally {
      setIsSavingQuickReply(false);
    }
  };

  const handleDeleteQuickReply = async (reply: WhatsAppQuickReply) => {
    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir a resposta rápida "${reply.title}"?`
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteWhatsAppQuickReply(reply.id);
      setQuickReplies((previous) => previous.filter((item) => item.id !== reply.id));
      setQuickRepliesError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir a resposta rápida.';
      setQuickRepliesError(message);
    }
  };

  const handleToggleAIAssistantMenu = useCallback(() => {
    setIsAIAssistantMenuOpen((previous) => !previous);
    setAIAssistantError(null);
  }, []);

  const handleApplyAISuggestion = useCallback(
    (suggestion: string) => {
      setComposerText(suggestion);
      setComposerError(null);
      setComposerSuccess('Sugestão da IA aplicada. Revise e envie quando estiver pronta.');
      setIsAIAssistantMenuOpen(false);
      setAISuggestions([]);

      setTimeout(() => {
        composerTextareaRef.current?.focus();
      }, 0);
    },
    [composerTextareaRef]
  );

  const buildGroupMetadataKeys = useCallback((value?: string | null): string[] => {
    if (!value) {
      return [];
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    const keys = new Set<string>();
    keys.add(trimmed);

    const withoutDomain = trimmed.includes('@') ? trimmed.split('@')[0] ?? '' : trimmed;
    if (withoutDomain) {
      keys.add(withoutDomain);
    }

    const digitsOnly = sanitizePhoneDigits(withoutDomain);
    if (digitsOnly) {
      keys.add(digitsOnly);
    }

    const ensureGroupSuffix = (candidate: string) => {
      if (candidate && !candidate.toLowerCase().endsWith('-group')) {
        keys.add(`${candidate}-group`);
      }
    };

    ensureGroupSuffix(withoutDomain);
    ensureGroupSuffix(digitsOnly);

    return Array.from(keys).filter(Boolean);
  }, []);

  const getChatMetadataForPhone = useCallback(
    (phone?: string | null): ZAPIChatMetadata | undefined => {
      const normalizedKey = normalizeChatMetadataKey(phone);
      if (!normalizedKey) {
        return undefined;
      }

      const direct = chatMetadataMap.get(normalizedKey);
      if (direct) {
        return direct;
      }

      if (normalizedKey.startsWith('55') && normalizedKey.length > 2) {
        return chatMetadataMap.get(normalizedKey.slice(2));
      }

      return undefined;
    },
    [chatMetadataMap]
  );

  const getGroupMetadataForPhone = useCallback(
    (phone?: string | null): ZAPIGroupMetadata | undefined => {
      if (!phone) {
        return undefined;
      }

      const candidates = buildGroupMetadataKeys(phone);
      for (const candidate of candidates) {
        const metadata = groupMetadataMap.get(candidate);
        if (metadata) {
          return metadata;
        }
      }

      return undefined;
    },
    [buildGroupMetadataKeys, groupMetadataMap]
  );

  const getChatDisplayName = useCallback(
    (chat: ChatGroup): string => {
      if (chat.isGroup) {
        const groupMetadata = getGroupMetadataForPhone(chat.phone);
        return groupMetadata?.subject || chat.displayName || formatPhoneForDisplay(chat.phone);
      }

      const lead =
        (chat.leadId ? leadsMap.get(chat.leadId) : undefined) ??
        leadsByPhoneMap.get(sanitizePhoneDigits(chat.phone)) ??
        leadsByPhoneMap.get(chat.phone.trim());
      const chatMetadata = getChatMetadataForPhone(chat.phone);

      return (
        lead?.nome_completo ||
        chatMetadata?.displayName ||
        chat.displayName ||
        formatPhoneForDisplay(chat.phone)
      );
    },
    [getChatMetadataForPhone, getGroupMetadataForPhone, leadsByPhoneMap, leadsMap]
  );

  const releaseAttachmentPreview = useCallback((attachment: AttachmentItem) => {
    if (isFileAttachment(attachment) && attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }, []);

  const resetLocationForm = useCallback(() => {
    setLocationForm(createEmptyLocationForm());
    setLocationFormError(null);
    setIsFetchingCurrentLocation(false);
  }, []);

  const handleCloseLocationModal = useCallback(() => {
    setIsLocationModalOpen(false);
    resetLocationForm();
  }, [resetLocationForm]);

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationFormError('Geolocalização não suportada neste navegador.');
      return;
    }

    setIsFetchingCurrentLocation(true);
    setLocationFormError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationForm((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          title: prev.title || 'Minha localização',
          address: prev.address || 'Localização atual',
        }));
        setIsFetchingCurrentLocation(false);
      },
      (error) => {
        console.error('Erro ao obter localização atual:', error);
        setIsFetchingCurrentLocation(false);
        setLocationFormError(
          'Não foi possível obter a localização atual. Verifique as permissões do navegador.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleConfirmLocation = useCallback(() => {
    const title = locationForm.title.trim();
    const address = locationForm.address.trim();
    const latitude = locationForm.latitude.trim();
    const longitude = locationForm.longitude.trim();

    if (!title || !address || !latitude || !longitude) {
      setLocationFormError('Preencha todos os campos obrigatórios para enviar a localização.');
      return;
    }

    const payload: LocationAttachmentPayload = {
      title,
      address,
      latitude,
      longitude,
    };

    if (typeof locationForm.delayMessage === 'number') {
      payload.delayMessage = locationForm.delayMessage;
    }

    setAttachments((prev) => [...prev, { type: 'location', location: payload }]);
    setComposerError(null);
    setComposerSuccess(null);
    handleCloseLocationModal();
  }, [handleCloseLocationModal, locationForm, setAttachments]);

  const stopAudioVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    analyserDataRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    setRecordingLevels(Array(RECORDING_WAVEFORM_BARS).fill(0));
  }, []);

  const startAudioVisualization = useCallback(
    (stream: MediaStream) => {
      if (typeof window === 'undefined') {
        return;
      }

      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      stopAudioVisualization();

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserDataRef.current = dataArray;

      setRecordingLevels(Array(RECORDING_WAVEFORM_BARS).fill(0));

      const updateLevels = () => {
        const analyserNode = analyserRef.current;
        const data = analyserDataRef.current;
        if (!analyserNode || !data) {
          return;
        }

        analyserNode.getByteTimeDomainData(data);
        const sliceSize = Math.max(1, Math.floor(data.length / RECORDING_WAVEFORM_BARS));
        const levels: number[] = [];

        for (let index = 0; index < RECORDING_WAVEFORM_BARS; index += 1) {
          let sum = 0;
          for (let sliceIndex = 0; sliceIndex < sliceSize; sliceIndex += 1) {
            const sample = data[index * sliceSize + sliceIndex];
            if (typeof sample === 'number') {
              sum += Math.abs(sample - 128);
            }
          }
          const average = sum / sliceSize;
          const normalized = Math.min(1, average / 60);
          levels.push(normalized);
        }

        setRecordingLevels((previous) => {
          if (previous.length === levels.length) {
            let hasMeaningfulChange = false;
            for (let i = 0; i < levels.length; i += 1) {
              if (Math.abs(previous[i]! - levels[i]!) > 0.05) {
                hasMeaningfulChange = true;
                break;
              }
            }
            if (!hasMeaningfulChange) {
              return previous;
            }
          }
          return levels;
        });

        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };

      updateLevels();
    },
    [stopAudioVisualization]
  );

  const upsertLeadsIntoMaps = useCallback((leads: LeadPreview[]) => {
    if (!leads || leads.length === 0) return;

    setLeadsMap((prev) => {
      const next = new Map(prev);
      leads.forEach((lead) => {
        next.set(lead.id, lead);
      });
      return next;
    });

    setLeadsByPhoneMap((prev) => {
      const next = new Map(prev);
      leads.forEach((lead) => {
        if (lead.telefone) {
          const trimmed = lead.telefone.trim();
          if (trimmed) {
            next.set(trimmed, lead);
          }

          buildPhoneLookupKeys(trimmed).forEach((key) => {
            next.set(key, lead);
          });
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices);
    const hasMediaRecorder = 'MediaRecorder' in window;
    const hasSupportedMimeType = Boolean(
      getPreferredMimeType([...MP3_MIME_TYPES, ...FALLBACK_AUDIO_MIME_TYPES])
    );

    setIsRecordingSupported(hasDevices && hasMediaRecorder && hasSupportedMimeType);
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(releaseAttachmentPreview);
    };
  }, [releaseAttachmentPreview]);

  useEffect(() => {
    if (isSendingMessage) {
      setIsAttachmentMenuOpen(false);
    }
  }, [isSendingMessage]);

  useEffect(() => {
    if (!isAttachmentMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        attachmentMenuRef.current?.contains(target) ||
        attachmentButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsAttachmentMenuOpen(false);
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAttachmentMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isAttachmentMenuOpen]);

  const loadLeads = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;

    const { data } = await supabase
      .from('leads')
      .select('id, nome_completo, telefone, status, responsavel, observacoes')
      .in('id', leadIds);

    if (data) {
      upsertLeadsIntoMaps(data as LeadPreview[]);
    }
  }, [upsertLeadsIntoMaps]);

  const loadLeadsByPhones = useCallback(async (phones: string[]) => {
    if (phones.length === 0) return;

    const sanitized = phones
      .map((phone) => sanitizePhoneDigits(phone))
      .filter((value) => Boolean(value));

    const toFetch = sanitized.filter((digits) => !loadedPhoneLeadsRef.current.has(digits));
    if (toFetch.length === 0) return;

    const variants = Array.from(
      new Set(
        toFetch.flatMap((digits) => {
          const keys = new Set<string>([digits]);

          if (digits.startsWith('55') && digits.length > 2) {
            keys.add(digits.slice(2));
            keys.add(`+${digits}`);
          } else if (digits.length === 11) {
            keys.add(`55${digits}`);
            keys.add(`+55${digits}`);
          }

          return Array.from(keys);
        })
      )
    );

    if (variants.length === 0) return;

    const { data, error } = await supabase
      .from('leads')
      .select('id, nome_completo, telefone, status, responsavel, observacoes')
      .in('telefone', variants);

    if (error) {
      console.error('Erro ao carregar leads por telefone:', error);
      return;
    }

    toFetch.forEach((digits) => loadedPhoneLeadsRef.current.add(digits));

    if (data) {
      upsertLeadsIntoMaps(data as LeadPreview[]);
    }
  }, [upsertLeadsIntoMaps]);

  const loadLeadById = useCallback(
    async (leadId: string) => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) {
        throw error;
      }

      const lead = data as Lead;
      upsertLeadsIntoMaps([toLeadPreview(lead)]);
      return lead;
    },
    [upsertLeadsIntoMaps]
  );

  const loadContractsForLead = useCallback(
    async (leadId: string, force = false) => {
      if (!leadId) {
        return;
      }

      if (!force && leadContractsMapRef.current.has(leadId)) {
        return;
      }

      setLoadingContractsLeadId(leadId);
      setLeadContractsError(null);

      try {
        const { data, error } = await supabase
          .from('contracts')
          .select(
            'id, codigo_contrato, status, modalidade, operadora, produto_plano, mensalidade_total, created_at'
          )
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setLeadContractsMap((current) => {
          const next = new Map(current);
          next.set(leadId, (data as Contract[] | null) ?? []);
          return next;
        });
      } catch (error) {
        console.error('Erro ao carregar contratos do lead:', error);
        setLeadContractsError('Erro ao carregar contratos do lead');
      } finally {
        setLoadingContractsLeadId((current) => (current === leadId ? null : current));
      }
    },
    []
  );

  const handleLeadDataUpdated = useCallback(
    async (leadId: string) => {
      try {
        const updatedLead = await loadLeadById(leadId);
        setActiveLeadDetails((current) =>
          current && current.id === leadId ? updatedLead : current
        );
        setEditingLead((current) => (current && current.id === leadId ? updatedLead : current));
      } catch (error) {
        console.error('Erro ao atualizar dados do lead:', error);
      }
    },
    [loadLeadById]
  );

  const handleOpenLeadDetails = useCallback(
    async (leadId: string) => {
      try {
        const lead = await loadLeadById(leadId);
        setActiveLeadDetails(lead);
      } catch (error) {
        console.error('Erro ao carregar detalhes do lead:', error);
        alert('Erro ao carregar detalhes do lead');
      }
    },
    [loadLeadById]
  );

  const handleEditLead = useCallback(
    async (leadId: string) => {
      if (isObserver) {
        return;
      }

      try {
        const lead = await loadLeadById(leadId);
        setEditingLead(lead);
        setIsLeadFormOpen(true);
      } catch (error) {
        console.error('Erro ao carregar lead para edição:', error);
        alert('Erro ao carregar lead para edição');
      }
    },
    [isObserver, loadLeadById]
  );

  const loadChatPreferences = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_chat_preferences')
        .select('*');

      if (error) {
        if (isChatPreferencesTableMissingError(error)) {
          setChatPreferences(new Map());
          return;
        }
        throw error;
      }

      const next = new Map<string, WhatsAppChatPreference>();
      (data as WhatsAppChatPreference[] | null)?.forEach((preference) => {
        next.set(preference.phone_number, preference);
      });
      setChatPreferences(next);
    } catch (error) {
      console.error('Erro ao carregar preferências de chat:', error);
    }
  }, []);

  const loadAIMessages = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('ai_generated_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAIMessages(data || []);

      const leadIds = [...new Set((data || []).map(m => m.lead_id))];
      await loadLeads(leadIds);
    } catch (error) {
      console.error('Erro ao carregar mensagens IA:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [loadLeads]);

  const loadConversations = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      setConversations(data || []);

      const leadIds = [...new Set((data || []).map(c => c.lead_id).filter(Boolean) as string[])];
      await loadLeads(leadIds);
      const phoneNumbers = [...new Set((data || []).map((c) => c.phone_number).filter(Boolean))];
      await loadLeadsByPhones(phoneNumbers);
      await loadChatPreferences();
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
      setIsRefreshing(false);
    }
  }, [loadChatPreferences, loadLeads, loadLeadsByPhones]);

  const loadStartConversationContacts = useCallback(
    async (pageToLoad = 1, replace = false) => {
      setStartConversationLoading(true);
      setStartConversationError(null);

      try {
        const result = await zapiService.fetchContacts(pageToLoad, 50);
        if (!result.success) {
          throw new Error(result.error || 'Falha ao carregar contatos.');
        }

        const contacts = result.data ?? [];

        setStartConversationContacts((prev) => {
          const existing = new Map<string, ZAPIContact>();
          const base = replace ? [] : prev;

          base.forEach((contact) => {
            const key = sanitizePhoneDigits(contact.phone);
            if (key) {
              existing.set(key, contact);
            }
          });

          contacts.forEach((contact) => {
            const key = sanitizePhoneDigits(contact.phone);
            if (!key || existing.has(key)) {
              return;
            }
            existing.set(key, contact);
          });

          return Array.from(existing.values());
        });

        setStartConversationPage(pageToLoad);
        setStartConversationHasMore(Boolean(result.hasMore));
      } catch (error) {
        setStartConversationError(
          error instanceof Error ? error.message : 'Erro ao carregar contatos.'
        );
      } finally {
        setStartConversationLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeView === 'ai-messages') {
      loadAIMessages();
    } else {
      loadConversations();
    }
  }, [activeView, loadAIMessages, loadConversations]);

  const handleOpenStartConversationModal = useCallback(() => {
    setStartConversationError(null);
    setStartConversationSearch('');
    setStartConversationSelectedContact(null);
    setStartConversationSelectedName(null);
    setStartConversationPhone('');
    setIsStartConversationModalOpen(true);

    if (startConversationContacts.length === 0) {
      void loadStartConversationContacts(1, true);
    }
  }, [loadStartConversationContacts, startConversationContacts.length]);

  const handleCloseStartConversationModal = useCallback(() => {
    setIsStartConversationModalOpen(false);
    setStartConversationError(null);
  }, []);

  const handleLoadMoreStartConversationContacts = useCallback(() => {
    if (startConversationLoading || !startConversationHasMore) {
      return;
    }

    void loadStartConversationContacts(startConversationPage + 1);
  }, [
    loadStartConversationContacts,
    startConversationHasMore,
    startConversationLoading,
    startConversationPage,
  ]);

  const handleSelectStartConversationContact = useCallback((contact: ZAPIContact) => {
    const normalized = normalizePhoneForChat(contact.phone);
    if (!normalized) {
      return;
    }

    setStartConversationSelectedContact(normalized);
    const displayName =
      contact.name ||
      contact.short ||
      contact.vname ||
      contact.notify ||
      formatPhoneForDisplay(contact.phone);
    setStartConversationSelectedName(displayName);
    setStartConversationPhone(normalized);
    setStartConversationError(null);
  }, []);

  const handleStartConversationPhoneChange = useCallback((value: string) => {
    const digits = sanitizePhoneDigits(value);
    setStartConversationPhone(digits);
    setStartConversationSelectedContact(null);
    setStartConversationSelectedName(null);
    setStartConversationError(null);
  }, []);

  const filteredStartConversationContacts = useMemo(() => {
    if (!startConversationSearch.trim()) {
      return startConversationContacts;
    }

    const query = startConversationSearch.trim().toLowerCase();
    const numericQuery = sanitizePhoneDigits(startConversationSearch);

    return startConversationContacts.filter((contact) => {
      const candidateNames = [contact.name, contact.short, contact.vname, contact.notify]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());

      if (candidateNames.some((value) => value.includes(query))) {
        return true;
      }

      const phoneNormalized = sanitizePhoneDigits(contact.phone);
      if (numericQuery && phoneNormalized.includes(numericQuery)) {
        return true;
      }

      return contact.phone.toLowerCase().includes(query);
    });
  }, [startConversationContacts, startConversationSearch]);

  const startConversationSelectedDisplayName = useMemo(() => {
    if (startConversationSelectedName) {
      return startConversationSelectedName;
    }

    const normalized = normalizePhoneForChat(startConversationPhone);
    if (!normalized) {
      return '';
    }

    const matchedContact = startConversationContacts.find(
      (contact) => normalizePhoneForChat(contact.phone) === normalized
    );

    if (matchedContact) {
      return (
        matchedContact.name ||
        matchedContact.short ||
        matchedContact.vname ||
        matchedContact.notify ||
        formatPhoneForDisplay(matchedContact.phone)
      );
    }

    const lookupKeys = [normalized, ...buildPhoneLookupKeys(normalized)];
    for (const key of lookupKeys) {
      if (!key) continue;
      const lead = leadsByPhoneMap.get(key);
      if (lead) {
        return lead.nome_completo;
      }
    }

    return formatPhoneForDisplay(normalized);
  }, [
    leadsByPhoneMap,
    startConversationContacts,
    startConversationPhone,
    startConversationSelectedName,
  ]);

  const handleConfirmStartConversation = useCallback(() => {
    const normalized = normalizePhoneForChat(startConversationPhone);
    if (!normalized) {
      setStartConversationError('Informe um número de telefone válido.');
      return;
    }

    const lookupKeys = [normalized, ...buildPhoneLookupKeys(normalized)];
    let matchedLead: LeadPreview | undefined;
    for (const key of lookupKeys) {
      if (!key) continue;
      const lead = leadsByPhoneMap.get(key);
      if (lead) {
        matchedLead = lead;
        break;
      }
    }

    const matchedContact = startConversationContacts.find(
      (contact) => normalizePhoneForChat(contact.phone) === normalized
    );

    const displayName =
      startConversationSelectedName ||
      matchedContact?.name ||
      matchedContact?.short ||
      matchedContact?.vname ||
      matchedContact?.notify ||
      matchedLead?.nome_completo ||
      formatPhoneForDisplay(normalized);

    setManualChatPlaceholders((prev) => {
      const next = new Map(prev);
      next.set(normalized, { phone: normalized, displayName });
      return next;
    });

    skipAutoSelectRef.current = true;
    setSelectedPhone(normalized);

    setExternalSelectionContext({
      phone: normalized,
      leadName: matchedLead?.nome_completo || displayName,
      leadId: matchedLead?.id ?? null,
    });

    if (chatListFilter !== 'active') {
      setChatListFilter('active');
    }

    setIsStartConversationModalOpen(false);
    setStartConversationError(null);
    setStartConversationSearch('');
    setStartConversationSelectedContact(null);
    setStartConversationSelectedName(null);
    setStartConversationPhone('');
  }, [
    chatListFilter,
    leadsByPhoneMap,
    setChatListFilter,
    startConversationContacts,
    startConversationPhone,
    startConversationSelectedName,
  ]);

  const updateTypingPresenceFromEvent = useCallback(
    (event: ZAPITypingPresenceEvent | null | undefined) => {
      if (!event || typeof event !== 'object') {
        return;
      }

      const candidateKeys = buildPresenceKeyCandidates(event.phone, event.chatId);
      if (candidateKeys.length === 0) {
        return;
      }

      const now = Date.now();
      const eventTimestamp =
        typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
          ? event.timestamp
          : now;
      const typingUpdate =
        typeof event.isTyping === 'boolean'
          ? event.isTyping
          : event.kind === 'typing-start'
            ? true
            : event.kind === 'typing-stop'
              ? false
              : undefined;
      const hasTypingUpdate = typingUpdate !== undefined;
      const presenceUpdate =
        event.presence === 'online' || event.presence === 'offline'
          ? event.presence
          : undefined;
      const lastSeenUpdate =
        typeof event.lastSeenAt === 'number' && Number.isFinite(event.lastSeenAt)
          ? event.lastSeenAt
          : null;
      const contactNameUpdate =
        typeof event.contactName === 'string' && event.contactName.trim()
          ? event.contactName.trim()
          : null;

      setTypingPresenceMap((previous) => {
        let nextMap: Map<string, ChatTypingPresenceState> | null = null;

        candidateKeys.forEach((key) => {
          const previousValue = previous.get(key);

          const isTyping =
            typingUpdate !== undefined ? typingUpdate : previousValue?.isTyping ?? false;
          const lastTypingAt = hasTypingUpdate
            ? eventTimestamp
            : previousValue?.lastTypingAt ?? null;
          const presenceStatus =
            presenceUpdate !== undefined
              ? presenceUpdate
              : previousValue?.presenceStatus ?? null;
          const lastPresenceAt =
            presenceUpdate !== undefined
              ? eventTimestamp
              : previousValue?.lastPresenceAt ?? null;
          const lastSeenAt =
            lastSeenUpdate !== null
              ? lastSeenUpdate
              : previousValue?.lastSeenAt ?? null;
          const contactName =
            contactNameUpdate ?? previousValue?.contactName ?? null;

          const nextValue: ChatTypingPresenceState = {
            isTyping,
            lastTypingAt,
            presenceStatus,
            lastPresenceAt,
            lastSeenAt,
            contactName,
            updatedAt: now,
          };

          const shouldUpdate =
            !previousValue ||
            previousValue.isTyping !== nextValue.isTyping ||
            previousValue.lastTypingAt !== nextValue.lastTypingAt ||
            previousValue.presenceStatus !== nextValue.presenceStatus ||
            previousValue.lastPresenceAt !== nextValue.lastPresenceAt ||
            previousValue.lastSeenAt !== nextValue.lastSeenAt ||
            previousValue.contactName !== nextValue.contactName;

          if (shouldUpdate) {
            if (!nextMap) {
              nextMap = new Map(previous);
            }
            nextMap.set(key, nextValue);
          }
        });

        return nextMap ?? previous;
      });
    },
    [setTypingPresenceMap],
  );

  useEffect(() => {
    const conversationsChannel = supabase
      .channel('whatsapp-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          // Atualiza silenciosamente as conversas quando um novo evento chega.
          loadConversations(false);
        },
      );

    const aiMessagesChannel = supabase
      .channel('ai-generated-messages-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_generated_messages' },
        () => {
          loadAIMessages(false);
        },
      );

    void conversationsChannel.subscribe();
    void aiMessagesChannel.subscribe();

    return () => {
      void conversationsChannel.unsubscribe();
      void aiMessagesChannel.unsubscribe();
    };
  }, [loadConversations, loadAIMessages]);

  useEffect(() => {
    const unsubscribe = zapiService.subscribeToTypingPresence({
      onTypingStart: updateTypingPresenceFromEvent,
      onTypingStop: updateTypingPresenceFromEvent,
      onPresence: updateTypingPresenceFromEvent,
      onEvent: updateTypingPresenceFromEvent,
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [updateTypingPresenceFromEvent]);

  useEffect(() => {
    if (!selectedPhone) {
      return;
    }

    let isActive = true;

    const loadPresence = async () => {
      const result = await zapiService.getChatPresence(selectedPhone);
      if (!isActive) {
        return;
      }

      if (result.success && result.data) {
        const payload = result.data as ZAPITypingPresenceEvent;
        if (
          payload &&
          typeof payload === 'object' &&
          'kind' in payload &&
          typeof (payload as { kind: unknown }).kind === 'string'
        ) {
          updateTypingPresenceFromEvent(payload);
        }
      }
    };

    void loadPresence();

    return () => {
      isActive = false;
    };
  }, [selectedPhone, updateTypingPresenceFromEvent]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const sweepInterval = window.setInterval(() => {
      setTypingPresenceMap((previous) => {
        if (previous.size === 0) {
          return previous;
        }

        const now = Date.now();
        let nextMap: Map<string, ChatTypingPresenceState> | null = null;

        previous.forEach((value, key) => {
          if (value.isTyping && value.lastTypingAt && now - value.lastTypingAt > TYPING_INACTIVITY_TIMEOUT_MS) {
            if (!nextMap) {
              nextMap = new Map(previous);
            }
            nextMap.set(key, { ...value, isTyping: false, updatedAt: now });
          }
        });

        return nextMap ?? previous;
      });
    }, TYPING_PRESENCE_SWEEP_INTERVAL_MS);

    return () => {
      window.clearInterval(sweepInterval);
    };
  }, []);

  const closeFullscreen = useCallback(() => setFullscreenMedia(null), []);

  useEffect(() => {
    if (!fullscreenMedia) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fullscreenMedia, closeFullscreen]);

  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!composerSuccess) return;
    if (typeof window === 'undefined') return;

    const timeout = window.setTimeout(() => setComposerSuccess(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [composerSuccess]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'draft':
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Rascunho',
      approved: 'Aprovada',
      sent: 'Enviada',
      failed: 'Falhou',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-orange-100 text-orange-700',
      approved: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const filteredAIMessages = aiMessages.filter(msg => {
    if (statusFilter !== 'all' && msg.status !== statusFilter) return false;
    if (searchQuery) {
      const lead = leadsMap.get(msg.lead_id);
      const query = searchQuery.toLowerCase();
      return (
        msg.message_generated.toLowerCase().includes(query) ||
        (lead?.nome_completo.toLowerCase().includes(query)) ||
        (lead?.telefone.includes(query))
      );
    }
    return true;
  });

  const chatGroups = useMemo<ChatGroupBase[]>(() => {
    const groups = new Map<
    string,
    {
      phone: string;
      messages: WhatsAppConversation[];
      leadId?: string | null;
      contractId?: string | null;
      lastMessage?: WhatsAppConversation;
      displayName?: string | null;
      photoUrl?: string | null;
      isGroup: boolean;
      unreadCount: number;
    }
    >();

    conversations.forEach((conv) => {
      const normalizedChatName = conv.chat_name?.trim() || null;
      const normalizedSenderName = conv.sender_name?.trim() || null;
      const isGroupChat = isGroupWhatsAppJid(conv.phone_number);
      const existing = groups.get(conv.phone_number);

      if (!existing) {
        groups.set(conv.phone_number, {
          phone: conv.phone_number,
          messages: [conv],
          leadId: conv.lead_id,
          contractId: conv.contract_id || null,
          lastMessage: conv,
          displayName: isGroupChat
            ? normalizedChatName || null
            : normalizedSenderName || normalizedChatName || null,
          photoUrl: conv.sender_photo || null,
          isGroup: isGroupChat,
          unreadCount:
            conv.message_type === 'received' && !conv.read_status ? 1 : 0,
        });
      } else {
        existing.messages.push(conv);
        if (!existing.leadId && conv.lead_id) {
          existing.leadId = conv.lead_id;
        }
        if (!existing.contractId && conv.contract_id) {
          existing.contractId = conv.contract_id;
        }
        if (!existing.photoUrl && conv.sender_photo) {
          existing.photoUrl = conv.sender_photo;
        }
        if (!existing.isGroup && isGroupChat) {
          existing.isGroup = true;
        }

        if (isGroupChat) {
          if (normalizedChatName) {
            existing.displayName = normalizedChatName;
          }
        } else if (!existing.displayName && (normalizedSenderName || normalizedChatName)) {
          existing.displayName = normalizedSenderName || normalizedChatName;
        }

        if (
          !existing.lastMessage ||
          new Date(conv.timestamp).getTime() > new Date(existing.lastMessage.timestamp).getTime()
        ) {
          existing.lastMessage = conv;
        }

        if (conv.message_type === 'received' && !conv.read_status) {
          existing.unreadCount += 1;
        }
      }
    });

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        messages: group.messages.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
      }))
      .sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return bTime - aTime;
      });
  }, [conversations]);

  useEffect(() => {
    setManualChatPlaceholders((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const existingDigits = new Set(
        conversations
          .map((conversation) => sanitizePhoneDigits(conversation.phone_number))
          .filter((value) => value.length > 0)
      );

      if (existingDigits.size === 0) {
        return prev;
      }

      let changed = false;
      const next = new Map(prev);

      prev.forEach((placeholder, key) => {
        const normalizedPlaceholder = sanitizePhoneDigits(placeholder.phone);
        if (normalizedPlaceholder && existingDigits.has(normalizedPlaceholder)) {
          next.delete(key);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [conversations]);

  const chatsWithPreferences = useMemo<ChatGroup[]>(() => {
    const baseChats = chatGroups.map((group) => {
      const preference = chatPreferences.get(group.phone);
      return {
        ...group,
        archived: preference?.archived ?? false,
        pinned: preference?.pinned ?? false,
      };
    });

    if (manualChatPlaceholders.size === 0) {
      return baseChats;
    }

    const normalizedExisting = new Set(
      baseChats
        .map((chat) => sanitizePhoneDigits(chat.phone))
        .filter((value) => value.length > 0)
    );

    const mergedChats = [...baseChats];

    manualChatPlaceholders.forEach((placeholder) => {
      const normalizedPlaceholder = sanitizePhoneDigits(placeholder.phone);
      if (normalizedPlaceholder && normalizedExisting.has(normalizedPlaceholder)) {
        return;
      }

      if (normalizedPlaceholder) {
        normalizedExisting.add(normalizedPlaceholder);
      }

      let placeholderLead: LeadPreview | undefined;
      if (placeholder.phone) {
        const lookupKeys = [placeholder.phone, ...buildPhoneLookupKeys(placeholder.phone)];
        for (const key of lookupKeys) {
          if (!key) continue;
          const candidate = leadsByPhoneMap.get(key);
          if (candidate) {
            placeholderLead = candidate;
            break;
          }
        }
      }

      mergedChats.push({
        phone: placeholder.phone,
        messages: [],
        leadId: placeholderLead?.id ?? null,
        lastMessage: undefined,
        displayName:
          placeholder.displayName ||
          placeholderLead?.nome_completo ||
          formatPhoneForDisplay(placeholder.phone),
        photoUrl: null,
        isGroup: false,
        unreadCount: 0,
        archived: false,
        pinned: false,
      });
    });

    return mergedChats;
  }, [chatGroups, chatPreferences, leadsByPhoneMap, manualChatPlaceholders]);

  const filteredChats = useMemo(() => {
    const resolveLeadForChat = (chat: ChatGroup) => {
      if (chat.isGroup) {
        return undefined;
      }

      const leadFromId = chat.leadId ? leadsMap.get(chat.leadId) : undefined;
      if (leadFromId) {
        return leadFromId;
      }

      const sanitizedPhone = sanitizePhoneDigits(chat.phone);
      return (
        leadsByPhoneMap.get(sanitizedPhone) ??
        leadsByPhoneMap.get(chat.phone.trim())
      );
    };

    const relevantChats = chatsWithPreferences.filter((chat) =>
      chatListFilter === 'archived' ? chat.archived : !chat.archived
    );

    const filteredByLeadAttributes = relevantChats.filter((chat) => {
      const lead = resolveLeadForChat(chat);

      if (selectedStatus !== 'all') {
        if (!lead || lead.status !== selectedStatus) {
          return false;
        }
      }

      if (selectedResponsavel !== 'all') {
        if (!lead || lead.responsavel !== selectedResponsavel) {
          return false;
        }
      }

      return true;
    });

    const query = searchQuery.toLowerCase();
    const numericQuery = searchQuery.replace(/\D/g, '');

    const matchesSearch = (chat: ChatGroup) => {
      if (!searchQuery) return true;

      const lead = resolveLeadForChat(chat);
      const groupMetadata = chat.isGroup ? getGroupMetadataForPhone(chat.phone) : undefined;
      const chatMetadata = chat.isGroup ? undefined : getChatMetadataForPhone(chat.phone);
      const sanitizedPhone = sanitizePhoneDigits(chat.phone);
      const leadResponsavelValue = lead?.responsavel?.toLowerCase() ?? '';
      const leadResponsavelLabel = lead?.responsavel
        ? responsavelLabelMap.get(lead.responsavel)?.toLowerCase() ?? ''
        : '';
      return (
        chat.phone.toLowerCase().includes(query) ||
        (numericQuery ? sanitizedPhone.includes(numericQuery) : false) ||
        chat.messages.some((message) => (message.message_text || '').toLowerCase().includes(query)) ||
        (chat.displayName?.toLowerCase().includes(query) ?? false) ||
        (chatMetadata?.displayName ? chatMetadata.displayName.toLowerCase().includes(query) : false) ||
        (groupMetadata?.subject ? groupMetadata.subject.toLowerCase().includes(query) : false) ||
        (lead?.nome_completo?.toLowerCase().includes(query) ?? false) ||
        (lead?.telefone?.toLowerCase().includes(query) ?? false) ||
        leadResponsavelValue.includes(query) ||
        leadResponsavelLabel.includes(query)
      );
    };

    const searchedChats = searchQuery
      ? filteredByLeadAttributes.filter(matchesSearch)
      : filteredByLeadAttributes;

    return [...searchedChats].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [
    chatsWithPreferences,
    chatListFilter,
    getChatMetadataForPhone,
    getGroupMetadataForPhone,
    leadsByPhoneMap,
    leadsMap,
    selectedResponsavel,
    selectedStatus,
    searchQuery,
  ]);

  useEffect(() => {
    if (skipAutoSelectRef.current) {
      skipAutoSelectRef.current = false;
      return;
    }

    if (filteredChats.length === 0) {
      return;
    }

    if (!selectedPhone) {
      selectPrimaryPhone(filteredChats[0].phone);
      return;
    }

    const selectedDigits = sanitizePhoneDigits(selectedPhone);
    const exists = filteredChats.some((chat) => {
      if (chat.phone === selectedPhone) {
        return true;
      }

      if (!selectedDigits) {
        return false;
      }

      return sanitizePhoneDigits(chat.phone) === selectedDigits;
    });

    if (!exists) {
      const isExternalSelection = externalSelectionContext?.phone
        ? sanitizePhoneDigits(externalSelectionContext.phone) === selectedDigits && !!selectedDigits
        : false;

      if (isExternalSelection) {
        return;
      }

      selectPrimaryPhone(filteredChats[0].phone);
    }
  }, [externalSelectionContext, filteredChats, selectedPhone, selectPrimaryPhone]);

  useEffect(() => {
    if (selectedPhones.size === 0) {
      return;
    }

    const availablePhones = new Set(chatsWithPreferences.map((chat) => chat.phone));

    setSelectedPhones((prev) => {
      let changed = false;
      const next = new Set<string>();

      prev.forEach((phone) => {
        if (availablePhones.has(phone)) {
          next.add(phone);
        } else {
          changed = true;
        }
      });

      if (!changed) {
        return prev;
      }

      return next;
    });
  }, [chatsWithPreferences, selectedPhones.size]);

  const selectedChat = useMemo(() => {
    if (!selectedPhone) return undefined;
    return chatsWithPreferences.find(group => group.phone === selectedPhone);
  }, [chatsWithPreferences, selectedPhone]);

  const selectedChatMetadata = useMemo(() => {
    if (!selectedChat) {
      return undefined;
    }
    return getChatMetadataForPhone(selectedChat.phone);
  }, [getChatMetadataForPhone, selectedChat]);

  const selectedChatPreference = useMemo(() => {
    if (!selectedPhone) return undefined;
    return chatPreferences.get(selectedPhone);
  }, [chatPreferences, selectedPhone]);

  const selectedChatMessages = useMemo(() => {
    return selectedChat?.messages ?? ([] as WhatsAppConversation[]);
  }, [selectedChat]);

  const selectedChatLead = useMemo(() => {
    if (!selectedPhone) {
      return undefined;
    }

    const normalizedSelected = sanitizePhoneDigits(selectedPhone);
    const trimmedSelected = selectedPhone.trim();

    if (selectedChat && !selectedChat.isGroup) {
      const leadFromChat =
        (selectedChat.leadId ? leadsMap.get(selectedChat.leadId) : undefined) ??
        leadsByPhoneMap.get(sanitizePhoneDigits(selectedChat.phone)) ??
        leadsByPhoneMap.get(selectedChat.phone.trim());

      if (leadFromChat) {
        return leadFromChat;
      }
    }

    if (externalSelectionContext?.leadId) {
      const contextPhone = sanitizePhoneDigits(externalSelectionContext.phone ?? '');
      if (contextPhone && normalizedSelected && contextPhone === normalizedSelected) {
        const lead = leadsMap.get(externalSelectionContext.leadId);
        if (lead) {
          return lead;
        }
      }
    }

    if (normalizedSelected) {
      const fallbackLead =
        leadsByPhoneMap.get(normalizedSelected) ||
        leadsByPhoneMap.get(trimmedSelected);
      if (fallbackLead) {
        return fallbackLead;
      }
    }

    return undefined;
  }, [
    externalSelectionContext,
    leadsByPhoneMap,
    leadsMap,
    selectedChat,
    selectedPhone,
  ]);

  const selectedLeadId = selectedChatLead?.id ?? null;

  const selectedLeadContracts = useMemo(() => {
    if (!selectedLeadId) {
      return undefined;
    }

    return leadContractsMap.get(selectedLeadId);
  }, [leadContractsMap, selectedLeadId]);

  const isLoadingLeadContracts = Boolean(
    selectedLeadId && loadingContractsLeadId === selectedLeadId
  );

  const handleGenerateAISuggestions = useCallback(async () => {
    setAIAssistantError(null);
    setAISuggestions([]);
    setIsGeneratingAISuggestions(true);

    try {
      const result = await gptService.generateChatReplySuggestions({
        lead: selectedChatLead ?? undefined,
        conversationHistory: selectedChatMessages,
      });

      if (!result.success || !result.suggestions || result.suggestions.length === 0) {
        setAIAssistantError(result.error || 'Não foi possível gerar sugestões no momento.');
        return;
      }

      setAISuggestions(result.suggestions);
      setComposerSuccess('Sugestões geradas pela IA. Clique para inserir no campo de mensagem.');
    } catch (error) {
      setAIAssistantError(
        error instanceof Error
          ? error.message
          : 'Falha ao gerar sugestões com a IA. Tente novamente em instantes.'
      );
    } finally {
      setIsGeneratingAISuggestions(false);
    }
  }, [selectedChatLead, selectedChatMessages]);

  const handleRewriteComposerMessage = useCallback(async () => {
    const trimmedMessage = composerText.trim();

    if (!trimmedMessage) {
      setAIAssistantError('Digite uma mensagem para que a IA possa reescrever.');
      setIsAIAssistantMenuOpen(true);
      return;
    }

    setAIAssistantError(null);
    setIsRewritingMessage(true);

    try {
      const result = await gptService.rewriteMessage({
        message: trimmedMessage,
        lead: selectedChatLead ?? undefined,
        conversationHistory: selectedChatMessages,
      });

      if (!result.success || !result.rewrittenMessage) {
        setAIAssistantError(result.error || 'Não foi possível reescrever a mensagem agora.');
        return;
      }

      setComposerText(result.rewrittenMessage);
      setComposerError(null);
      setComposerSuccess('Mensagem reescrita com ajuda da IA. Revise antes de enviar.');
      setIsAIAssistantMenuOpen(false);
      setAISuggestions([]);

      setTimeout(() => {
        composerTextareaRef.current?.focus();
      }, 0);
    } catch (error) {
      setAIAssistantError(
        error instanceof Error
          ? error.message
          : 'Falha ao reescrever a mensagem com a IA. Tente novamente.'
      );
    } finally {
      setIsRewritingMessage(false);
    }
  }, [composerText, selectedChatLead, selectedChatMessages, composerTextareaRef]);

  useEffect(() => {
    setIsLeadDetailsPanelOpen(false);
  }, [selectedPhone]);

  const handleToggleLeadDetailsPanel = useCallback(() => {
    if (!selectedPhone) {
      return;
    }

    setIsLeadDetailsPanelOpen((prev) => !prev);
  }, [selectedPhone]);

  const handleRefreshContracts = useCallback(() => {
    if (!selectedLeadId) {
      return;
    }

    void loadContractsForLead(selectedLeadId, true);
  }, [loadContractsForLead, selectedLeadId]);

  useEffect(() => {
    if (!selectedLeadId) {
      return;
    }

    void loadContractsForLead(selectedLeadId);
  }, [loadContractsForLead, selectedLeadId]);

  const selectedChatPresenceState = useMemo(() => {
    if (!selectedPhone) {
      return undefined;
    }

    const candidates = buildPresenceKeyCandidates(selectedPhone, selectedPhone);
    for (const key of candidates) {
      const value = typingPresenceMap.get(key);
      if (value) {
        return value;
      }
    }

    return undefined;
  }, [selectedPhone, typingPresenceMap]);

  const formatLastSeenStatus = useCallback((timestamp?: number | null) => {
    if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
      return null;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isYesterday =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();

    const timePart = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (sameDay) {
      return `Visto por último hoje às ${timePart}`;
    }

    if (isYesterday) {
      return `Visto por último ontem às ${timePart}`;
    }

    const datePart = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return `Visto por último em ${datePart} às ${timePart}`;
  }, []);

  useEffect(() => {
    if (!externalChatRequest) {
      return;
    }

    const { phone, leadId, prefillMessage } = externalChatRequest;
    const normalizedTarget = sanitizePhoneDigits(phone ?? '');

    let matchedChat: ChatGroup | undefined;

    if (leadId) {
      matchedChat = chatsWithPreferences.find(chat => chat.leadId === leadId);
    }

    if (!matchedChat && normalizedTarget) {
      matchedChat = chatsWithPreferences.find((chat) => {
        const chatDigits = sanitizePhoneDigits(chat.phone);
        if (chatDigits && chatDigits === normalizedTarget) {
          return true;
        }

        const lookupKeys = buildPhoneLookupKeys(chat.phone);
        return lookupKeys.includes(normalizedTarget);
      });
    }

    if (matchedChat) {
      const desiredFilter = matchedChat.archived ? 'archived' : 'active';
      if (chatListFilter !== desiredFilter) {
        setChatListFilter(desiredFilter);
      }

      skipAutoSelectRef.current = true;
      selectPrimaryPhone(matchedChat.phone);
    } else if (phone) {
      if (chatListFilter !== 'active') {
        setChatListFilter('active');
      }

      skipAutoSelectRef.current = true;
      selectPrimaryPhone(phone);
    }

    if (prefillMessage && !composerText.trim()) {
      setComposerText(prefillMessage);
    }

    setExternalSelectionContext(externalChatRequest);
    onConsumeExternalChatRequest?.();
  }, [
    chatListFilter,
    chatsWithPreferences,
    composerText,
    externalChatRequest,
    onConsumeExternalChatRequest,
    selectPrimaryPhone,
  ]);

  useEffect(() => {
    if (!externalSelectionContext?.phone) {
      return;
    }

    if (!selectedPhone) {
      setExternalSelectionContext(null);
      return;
    }

    const contextDigits = sanitizePhoneDigits(externalSelectionContext.phone);
    const selectedDigits = sanitizePhoneDigits(selectedPhone);

    if (contextDigits && selectedDigits && contextDigits !== selectedDigits) {
      setExternalSelectionContext(null);
    }
  }, [externalSelectionContext, selectedPhone]);

  useEffect(() => {
    if (chatsWithPreferences.length === 0) {
      return;
    }

    const phonesToFetch: string[] = [];

    chatsWithPreferences.forEach((chat) => {
      if (chat.isGroup) {
        return;
      }

      const normalizedKey = normalizeChatMetadataKey(chat.phone);
      if (!normalizedKey) {
        return;
      }

      if (chatMetadataMap.has(normalizedKey)) {
        return;
      }

      if (chatMetadataPendingRef.current.has(normalizedKey)) {
        return;
      }

      phonesToFetch.push(normalizedKey);
      chatMetadataPendingRef.current.add(normalizedKey);
    });

    if (phonesToFetch.length === 0) {
      return;
    }

    void (async () => {
      for (const normalizedPhone of phonesToFetch) {
        let metadataKey: string | null = null;
        try {
          const result = await zapiService.getChatMetadata(normalizedPhone);
          if (result.success && result.data) {
            const metadata = result.data as ZAPIChatMetadata;
            metadataKey = normalizeChatMetadataKey(metadata.phone);
            setChatMetadataMap((prev) => {
              const next = new Map(prev);
              const keysToStore = new Set<string>();
              keysToStore.add(normalizedPhone);
              if (normalizedPhone.startsWith('55') && normalizedPhone.length > 2) {
                keysToStore.add(normalizedPhone.slice(2));
              }
              if (metadataKey) {
                keysToStore.add(metadataKey);
                if (metadataKey.startsWith('55') && metadataKey.length > 2) {
                  keysToStore.add(metadataKey.slice(2));
                }
              }
              keysToStore.forEach((candidate) => {
                if (candidate) {
                  next.set(candidate, metadata);
                }
              });
              return next;
            });
          } else if (result.error) {
            console.warn('Não foi possível carregar metadata do chat', normalizedPhone, result.error);
          }
        } catch (error) {
          console.error('Erro ao buscar metadata do chat', normalizedPhone, error);
        } finally {
          const cleanupKeys = new Set<string>();
          cleanupKeys.add(normalizedPhone);
          if (normalizedPhone.startsWith('55') && normalizedPhone.length > 2) {
            cleanupKeys.add(normalizedPhone.slice(2));
          }
          if (metadataKey) {
            cleanupKeys.add(metadataKey);
            if (metadataKey.startsWith('55') && metadataKey.length > 2) {
              cleanupKeys.add(metadataKey.slice(2));
            }
          }
          cleanupKeys.forEach((candidate) => {
            if (candidate) {
              chatMetadataPendingRef.current.delete(candidate);
            }
          });
        }
      }
    })();
  }, [chatMetadataMap, chatsWithPreferences]);

  useEffect(() => {
    if (chatsWithPreferences.length === 0) {
      return;
    }

    const phonesToFetch: string[] = [];

    chatsWithPreferences.forEach((chat) => {
      if (!chat.isGroup) {
        return;
      }

      const keys = buildGroupMetadataKeys(chat.phone);
      const alreadyLoaded = keys.some((key) => groupMetadataMap.has(key));
      const isPending = keys.some((key) => groupMetadataPendingRef.current.has(key));

      if (!alreadyLoaded && !isPending) {
        phonesToFetch.push(chat.phone);
        keys.forEach((key) => groupMetadataPendingRef.current.add(key));
      }
    });

    if (phonesToFetch.length === 0) {
      return;
    }

    void (async () => {
      for (const phone of phonesToFetch) {
        try {
          const result = await zapiService.getGroupMetadata(phone);
          if (result.success && result.data) {
            const metadata = result.data as ZAPIGroupMetadata;
            setGroupMetadataMap((prev) => {
              const next = new Map(prev);
              const metadataKeys = new Set<string>([
                ...buildGroupMetadataKeys(phone),
                ...buildGroupMetadataKeys(metadata.phone),
              ]);
              metadataKeys.forEach((key) => {
                if (key) {
                  next.set(key, metadata);
                }
              });
              return next;
            });
          } else if (result.error) {
            console.warn('Não foi possível carregar metadata do grupo', phone, result.error);
          }
        } catch (error) {
          console.error('Erro ao buscar metadata do grupo', phone, error);
        } finally {
          const keys = buildGroupMetadataKeys(phone);
          keys.forEach((key) => groupMetadataPendingRef.current.delete(key));
        }
      }
    })();
  }, [buildGroupMetadataKeys, chatsWithPreferences, groupMetadataMap]);

  const selectedGroupMetadata = useMemo(() => {
    if (!selectedChat?.isGroup) {
      return undefined;
    }
    return getGroupMetadataForPhone(selectedChat.phone);
  }, [getGroupMetadataForPhone, selectedChat]);

  const selectedChatPhotoUrl = useMemo(() => {
    if (!selectedChat) {
      return null;
    }
    return selectedChat.photoUrl || selectedChatMetadata?.profileThumbnail || null;
  }, [selectedChat, selectedChatMetadata]);

  const selectedChatDisplayName = useMemo(() => {
    if (!selectedPhone) {
      return '';
    }

    if (!selectedChat) {
      if (selectedChatLead?.nome_completo) {
        return selectedChatLead.nome_completo;
      }

      if (externalSelectionContext?.phone) {
        const contextDigits = sanitizePhoneDigits(externalSelectionContext.phone);
        const selectedDigits = sanitizePhoneDigits(selectedPhone);
        if (contextDigits && selectedDigits && contextDigits === selectedDigits) {
          return (
            externalSelectionContext.leadName ||
            formatPhoneForDisplay(selectedPhone)
          );
        }
      }

      return formatPhoneForDisplay(selectedPhone);
    }

    if (selectedChat.isGroup) {
      return (
        selectedGroupMetadata?.subject ||
        selectedChat.displayName ||
        formatPhoneForDisplay(selectedChat.phone)
      );
    }

    return (
      selectedChatLead?.nome_completo ||
      selectedChatMetadata?.displayName ||
      selectedChat.displayName ||
      formatPhoneForDisplay(selectedChat.phone)
    );
  }, [
    externalSelectionContext,
    selectedChatMetadata,
    selectedChat,
    selectedChatLead,
    selectedGroupMetadata,
    selectedPhone,
  ]);

  const selectedChatPresenceLabel = useMemo(() => {
    if (!selectedChatPresenceState) {
      return null;
    }

    if (selectedChatPresenceState.isTyping) {
      return 'Contato digitando...';
    }

    if (selectedChatPresenceState.presenceStatus === 'online') {
      return 'Online agora';
    }

    const lastSeenLabel = formatLastSeenStatus(selectedChatPresenceState.lastSeenAt);
    if (lastSeenLabel) {
      return lastSeenLabel;
    }

    if (selectedChatPresenceState.presenceStatus === 'offline') {
      return 'Offline';
    }

    return null;
  }, [formatLastSeenStatus, selectedChatPresenceState]);

  const processedSelectedMessages = useMemo(() => {
    const processed: MessageWithReactions[] = [];
    let lastMessage: MessageWithReactions | null = null;

    const normalizeText = (value: string) =>
      value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

    selectedChatMessages.forEach((message) => {
      const rawText = message.message_text ?? '';
      const trimmedText = rawText.trim();
      const normalizedText = trimmedText ? normalizeText(trimmedText) : '';
      const notificationType = message.notification_type?.toLowerCase();
      const isReactionNotification =
        (notificationType === 'reaction' && Boolean(trimmedText)) ||
        (!!trimmedText && !message.media_url && normalizedText.startsWith('reacao:'));

      if (isReactionNotification) {
        if (!lastMessage) {
          return;
        }

        const colonIndex = trimmedText.indexOf(':');
        const emojiPart = colonIndex >= 0 ? trimmedText.slice(colonIndex + 1).trim() : '';

        if (!emojiPart) {
          return;
        }

        const reactionEmoji = emojiPart;
        const reactorName =
          message.sender_name?.trim() ||
          (message.message_type === 'sent' ? 'Você' : selectedChatDisplayName || 'Contato');

        if (!reactorName) {
          return;
        }

        const reactionSummaries = lastMessage.reactionSummaries ?? (lastMessage.reactionSummaries = []);
        let summary = reactionSummaries.find((item) => item.emoji === reactionEmoji);
        if (!summary) {
          summary = { emoji: reactionEmoji, reactors: [] };
          reactionSummaries.push(summary);
        }

        const newEntry = { name: reactorName, timestamp: message.timestamp };
        const existingIndex = summary.reactors.findIndex((reactor) => reactor.name === reactorName);
        if (existingIndex >= 0) {
          summary.reactors[existingIndex] = newEntry;
        } else {
          summary.reactors.push(newEntry);
        }

        summary.reactors.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        return;
      }

      const cloned: MessageWithReactions = { ...message };
      processed.push(cloned);
      lastMessage = cloned;
    });

    return processed;
  }, [selectedChatDisplayName, selectedChatMessages]);

  const messageIdToInternalId = useMemo(() => {
    const map = new Map<string, string>();
    processedSelectedMessages.forEach((message) => {
      if (message.message_id) {
        map.set(message.message_id, message.id);
      }
    });
    return map;
  }, [processedSelectedMessages]);

  useEffect(() => {
    if (!activeReactionMenuMessageId) {
      return;
    }

    const exists = processedSelectedMessages.some(
      (message) => message.message_id === activeReactionMenuMessageId
    );

    if (!exists) {
      setActiveReactionMenuMessageId(null);
      setReactionError(null);
    }
  }, [activeReactionMenuMessageId, processedSelectedMessages]);

  const scrollTargetMessageId = useMemo(() => {
    if (processedSelectedMessages.length === 0) {
      return null;
    }

    const firstUnread = processedSelectedMessages.find(
      (message) => message.message_type === 'received' && !message.read_status
    );

    if (firstUnread) {
      return firstUnread.id;
    }

    return processedSelectedMessages[processedSelectedMessages.length - 1]?.id ?? null;
  }, [processedSelectedMessages]);

  const handleLeadStatusChange = useCallback(
    async (leadId: string, newStatus: string) => {
      const lead = leadsMap.get(leadId);
      if (!lead) return;

      const oldStatus = lead.status;
      const optimisticLead = { ...lead, status: newStatus };
      upsertLeadsIntoMaps([optimisticLead]);
      setActiveLeadDetails((current) =>
        current && current.id === leadId ? { ...current, status: newStatus } : current
      );
      setEditingLead((current) =>
        current && current.id === leadId ? { ...current, status: newStatus } : current
      );

      try {
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('leads')
          .update({ status: newStatus, ultimo_contato: now })
          .eq('id', leadId);

        if (updateError) throw updateError;

        await supabase.from('interactions').insert([
          {
            lead_id: leadId,
            tipo: 'Observação',
            descricao: `Status alterado de "${oldStatus}" para "${newStatus}"`,
            responsavel: lead.responsavel,
          },
        ]);

        await supabase.from('lead_status_history').insert([
          {
            lead_id: leadId,
            status_anterior: oldStatus,
            status_novo: newStatus,
            responsavel: lead.responsavel,
          },
        ]);

        if (['Fechado', 'Perdido'].includes(newStatus)) {
          await cancelFollowUps(leadId);
        } else {
          await createAutomaticFollowUps(leadId, newStatus, lead.responsavel);
        }
      } catch (error) {
        console.error('Erro ao atualizar status do lead:', error);
        alert('Erro ao atualizar status do lead');
        upsertLeadsIntoMaps([{ ...lead, status: oldStatus }]);
        setActiveLeadDetails((current) =>
          current && current.id === leadId ? { ...current, status: oldStatus } : current
        );
        setEditingLead((current) =>
          current && current.id === leadId ? { ...current, status: oldStatus } : current
        );
        throw error;
      }
    },
    [leadsMap, upsertLeadsIntoMaps]
  );

  const handleLeadResponsavelChange = useCallback(
    async (leadId: string, newResponsavel: string) => {
      const lead = leadsMap.get(leadId);
      if (!lead) {
        return;
      }

      const oldResponsavel = lead.responsavel;
      const optimisticLead = { ...lead, responsavel: newResponsavel };
      upsertLeadsIntoMaps([optimisticLead]);
      setActiveLeadDetails((current) =>
        current && current.id === leadId ? { ...current, responsavel: newResponsavel } : current
      );
      setEditingLead((current) =>
        current && current.id === leadId ? { ...current, responsavel: newResponsavel } : current
      );

      try {
        const { error } = await supabase
          .from('leads')
          .update({ responsavel: newResponsavel })
          .eq('id', leadId);

        if (error) {
          throw error;
        }

        await supabase.from('interactions').insert([
          {
            lead_id: leadId,
            tipo: 'Observação',
            descricao: `Responsável alterado de "${oldResponsavel || 'Não definido'}" para "${newResponsavel}"`,
            responsavel: newResponsavel,
          },
        ]);
      } catch (error) {
        console.error('Erro ao atualizar responsável do lead:', error);
        alert('Erro ao atualizar responsável do lead');
        upsertLeadsIntoMaps([{ ...lead, responsavel: oldResponsavel }]);
        setActiveLeadDetails((current) =>
          current && current.id === leadId ? { ...current, responsavel: oldResponsavel } : current
        );
        setEditingLead((current) =>
          current && current.id === leadId ? { ...current, responsavel: oldResponsavel } : current
        );
        throw error;
      }
    },
    [leadsMap, upsertLeadsIntoMaps]
  );

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (isSameDay(date, today)) {
      return 'Hoje';
    }
    if (isSameDay(date, yesterday)) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds?: number | null) => {
    if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
      return null;
    }

    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    return `0:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const attachmentTypeLabels: Record<AttachmentType, string> = {
    image: 'Foto / Imagem',
    video: 'Vídeo',
    audio: 'Áudio',
    document: 'Documento',
    location: 'Localização',
  };

  const attachmentTypes: AttachmentType[] = ['image', 'video', 'audio', 'document', 'location'];

  const inferAttachmentType = (file: File): FileAttachmentType => {
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    if (file.type.startsWith('video/')) {
      return 'video';
    }
    if (file.type.startsWith('audio/')) {
      return 'audio';
    }

    const lowerName = file.name.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    if (imageExtensions.some((ext) => lowerName.endsWith(ext))) {
      return 'image';
    }

    const videoExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.wmv'];
    if (videoExtensions.some((ext) => lowerName.endsWith(ext))) {
      return 'video';
    }

    const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];
    if (audioExtensions.some((ext) => lowerName.endsWith(ext))) {
      return 'audio';
    }

    return 'document';
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${Math.round(size / 1024)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getAttachmentIcon = (type: AttachmentType) => {
    switch (type) {
      case 'image':
        return <FileImage className="w-4 h-4 text-teal-600" />;
      case 'video':
        return <FileVideo className="w-4 h-4 text-purple-600" />;
      case 'audio':
        return <FileAudio className="w-4 h-4 text-orange-600" />;
      case 'location':
        return <MapPin className="w-4 h-4 text-emerald-600" />;
      case 'document':
      default:
        return <FileText className="w-4 h-4 text-rose-600" />;
    }
  };

  const renderAttachmentPreview = (attachment: AttachmentItem) => {
    if (attachment.type === 'location') {
      const { title, address, latitude, longitude } = attachment.location;
      return (
        <div className="space-y-1 text-sm text-slate-600">
          <p className="font-semibold text-slate-700">{title}</p>
          <p className="break-words text-slate-500">{address}</p>
          <p className="text-xs text-slate-400">Lat: {latitude} · Long: {longitude}</p>
        </div>
      );
    }

    if (attachment.type === 'image' && attachment.previewUrl) {
      return (
        <img
          src={attachment.previewUrl}
          alt={attachment.file.name}
          className="max-h-48 w-full rounded-lg object-cover"
        />
      );
    }

    if (attachment.type === 'video' && attachment.previewUrl) {
      return (
        <video
          controls
          className="w-full rounded-lg border border-slate-200"
          src={attachment.previewUrl}
        />
      );
    }

    if (attachment.type === 'audio' && attachment.previewUrl) {
      return (
        <div className="w-full min-w-[264px] sm:min-w-[344px]">
          <audio controls className="w-full">
            <source src={attachment.previewUrl} />
            Seu navegador não suporta a reprodução de áudio.
          </audio>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <FileText className="h-5 w-5 text-rose-600" />
        <span>Pré-visualização indisponível para este arquivo.</span>
      </div>
    );
  };

  const getAcceptForAttachmentType = (type: AttachmentType) => {
    switch (type) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'audio':
        return 'audio/*';
      case 'location':
        return DEFAULT_ATTACHMENT_ACCEPT;
      case 'document':
      default:
        return 'application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
    }
  };

  const createPreviewUrl = (file: File, type: AttachmentType) => {
    if (type === 'document') {
      return null;
    }
    return URL.createObjectURL(file);
  };

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach(releaseAttachmentPreview);
      return [];
    });
    setRecordedAudio(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.accept = DEFAULT_ATTACHMENT_ACCEPT;
    }
  }, [releaseAttachmentPreview]);

  const removeRecordedAudioAttachment = useCallback(() => {
    if (!recordedAudio) {
      return;
    }
    setAttachments((prev) => {
      const index = prev.findIndex(
        (attachment) => isFileAttachment(attachment) && attachment.file === recordedAudio.file
      );
      if (index === -1) {
        return prev;
      }
      const target = prev[index];
      releaseAttachmentPreview(target);
      return prev.filter((_, idx) => idx !== index);
    });
    if (recordedAudio.url) {
      URL.revokeObjectURL(recordedAudio.url);
    }
    setRecordedAudio(null);
  }, [recordedAudio, releaseAttachmentPreview]);

  const handleAttachmentButtonClick = () => {
    if (isSendingMessage) {
      return;
    }
    setIsAttachmentMenuOpen((prev) => !prev);
  };

  const handleAttachmentTypeSelectForUpload = (type: AttachmentType) => {
    setIsAttachmentMenuOpen(false);

    if (type === 'location') {
      setNextAttachmentType(null);
      resetLocationForm();
      setComposerError(null);
      setComposerSuccess(null);
      setIsLocationModalOpen(true);
      return;
    }

    setNextAttachmentType(type);
    const input = fileInputRef.current;
    if (input) {
      input.accept = getAcceptForAttachmentType(type);
      input.click();
    }
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const selectedType = nextAttachmentType;
    if (!files || files.length === 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.accept = DEFAULT_ATTACHMENT_ACCEPT;
      }
      setNextAttachmentType(null);
      return;
    }

    const filesArray = Array.from(files);
    setAttachments((prev) => {
      const existingKeys = new Set(
        prev
          .filter((attachment): attachment is FileAttachmentItem => isFileAttachment(attachment))
          .map((attachment) => `${attachment.file.name}-${attachment.file.size}`)
      );
      const uniqueFiles = filesArray.filter(
        (file) => !existingKeys.has(`${file.name}-${file.size}`)
      );
      const newAttachments = uniqueFiles.map((file) => {
        const resolvedType: FileAttachmentType =
          selectedType && selectedType !== 'location' ? selectedType : inferAttachmentType(file);
        return {
          file,
          type: resolvedType,
          previewUrl: createPreviewUrl(file, resolvedType),
        };
      });
      return [...prev, ...newAttachments];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.accept = DEFAULT_ATTACHMENT_ACCEPT;
    }

    setNextAttachmentType(null);

    setComposerError(null);
    setComposerSuccess(null);
  };

  const handleRemoveAttachment = (index: number) => {
    let shouldClearRecordedAudio = false;
    setAttachments((prev) => {
      const target = prev[index];
      if (target) {
        releaseAttachmentPreview(target);
        if (recordedAudio && isFileAttachment(target) && target.file === recordedAudio.file) {
          shouldClearRecordedAudio = true;
        }
      }
      return prev.filter((_, idx) => idx !== index);
    });
    if (shouldClearRecordedAudio) {
      setRecordedAudio(null);
    }
    setComposerError(null);
    setComposerSuccess(null);
  };

  const startRecording = useCallback(async () => {
    if (!isRecordingSupported) {
      setRecordingError('Gravação de áudio não suportada neste navegador.');
      return;
    }

    let cleanupStream: MediaStream | null = null;
    try {
      removeRecordedAudioAttachment();
      setComposerSuccess(null);
      setComposerError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      cleanupStream = stream;

      const preferredMp3MimeType = getPreferredMimeType(MP3_MIME_TYPES);
      const fallbackMimeType = getPreferredMimeType(FALLBACK_AUDIO_MIME_TYPES);
      const initialMimeType = preferredMp3MimeType ?? fallbackMimeType;

      if (!initialMimeType) {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingError(
          'Não foi possível encontrar um formato de gravação compatível neste navegador. Atualize o navegador ou tente utilizar outro dispositivo.'
        );
        return;
      }

      let selectedMimeType = initialMimeType;
      let mediaRecorder: MediaRecorder;

      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      } catch (error) {
        if (selectedMimeType !== fallbackMimeType && fallbackMimeType) {
          selectedMimeType = fallbackMimeType;
          mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
        } else {
          stream.getTracks().forEach((track) => track.stop());
          throw error;
        }
      }

      recordingStreamRef.current = stream;
      startAudioVisualization(stream);
      recordingMimeTypeRef.current = mediaRecorder.mimeType || selectedMimeType;
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingFinalizedRef.current = false;

      const finalizeRecording = async () => {
        if (recordingFinalizedRef.current) {
          return;
        }

        if (!audioChunksRef.current.length) {
          return;
        }

        recordingFinalizedRef.current = true;

        try {
          const recordedMimeType =
            recordingMimeTypeRef.current || mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
          let finalBlob = audioBlob;
          let finalMimeType = recordedMimeType;
          let fileExtension = 'mp3';

          if (!isMp3MimeType(finalMimeType) && !isOggMimeType(finalMimeType)) {
            try {
              finalBlob = await convertBlobToMp3(audioBlob);
              finalMimeType = 'audio/mpeg';
            } catch (conversionError) {
              console.error('Erro ao converter gravação de áudio para MP3:', conversionError);
              throw new Error(
                'Não foi possível converter a gravação de áudio para um formato compatível. Tente novamente.'
              );
            }
          }

          if (isOggMimeType(finalMimeType)) {
            fileExtension = 'ogg';
          } else {
            finalMimeType = 'audio/mpeg';
            fileExtension = 'mp3';
          }

          const audioUrl = URL.createObjectURL(finalBlob);

          const convertBlobToDataUrl = (blob: Blob): Promise<string> =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result);
                } else {
                  reject(new Error('Falha ao converter áudio para Base64.'));
                }
              };
              reader.onerror = () =>
                reject(reader.error ?? new Error('Falha ao ler áudio para conversão em Base64.'));
              reader.readAsDataURL(blob);
            });

          const audioFile = new File([finalBlob], `gravacao-${Date.now()}.${fileExtension}`, {
            type: finalMimeType,
          });
          const audioBase64 = await convertBlobToDataUrl(finalBlob);
          console.log('Áudio gravado convertido para Base64:', audioBase64);

          setRecordedAudio({ blob: finalBlob, url: audioUrl, file: audioFile, base64: audioBase64 });
          setAttachments((prev) => [
            ...prev,
            {
              file: audioFile,
              type: 'audio',
              previewUrl: audioUrl,
            },
          ]);
          audioChunksRef.current = [];
          recordingMimeTypeRef.current = null;
        } catch (error) {
          recordingFinalizedRef.current = false;
          audioChunksRef.current = [];
          recordingMimeTypeRef.current = null;
          console.error('Erro ao finalizar gravação de áudio:', error);
          setRecordingError(
            error instanceof Error
              ? error.message
              : 'Não foi possível processar a gravação de áudio. Tente novamente.'
          );
          return;
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          if (mediaRecorder.state === 'inactive') {
            void finalizeRecording();
          }
        }
      };

      mediaRecorder.onstop = () => {
        void finalizeRecording();
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        stopAudioVisualization();
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingError(null);
    } catch (error) {
      console.error('Erro ao iniciar gravação de áudio:', error);
      setRecordingError('Não foi possível iniciar a gravação. Verifique as permissões do microfone.');
      cleanupStream?.getTracks().forEach((track) => track.stop());
      stopAudioVisualization();
    }
  }, [isRecordingSupported, removeRecordedAudioAttachment, startAudioVisualization, stopAudioVisualization]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
    stopAudioVisualization();
  }, [stopAudioVisualization]);

  const discardRecording = useCallback(() => {
    removeRecordedAudioAttachment();
    setRecordingError(null);
  }, [removeRecordedAudioAttachment]);

  const attachmentsWithoutRecordedAudio = useMemo(() => {
    if (!recordedAudio) {
      return attachments;
    }
    return attachments.filter(
      (attachment) => !(isFileAttachment(attachment) && attachment.file === recordedAudio.file)
    );
  }, [attachments, recordedAudio]);

  const composerTextHasContent = composerText.trim().length > 0;

  const hasContentToSend = useMemo(() => {
    return composerTextHasContent || attachments.length > 0;
  }, [attachments.length, composerTextHasContent]);

  const isAIProcessing = isGeneratingAISuggestions || isRewritingMessage;

  const handleSendMessage = useCallback(async () => {
    if (!selectedPhone) {
      setComposerError('Selecione uma conversa para enviar mensagens.');
      return;
    }

    if (!hasContentToSend) {
      setComposerError('Adicione uma mensagem, anexo ou áudio antes de enviar.');
      return;
    }

    setIsSendingMessage(true);
    setComposerError(null);
    setComposerSuccess(null);

    try {
      const textToSend = composerText.trim();
      const replyMessageId = composerReplyMessage?.message_id ?? undefined;
      let replyConsumed = false;

      if (textToSend) {
        const textResult = await zapiService.sendTextMessage(
          selectedPhone,
          textToSend,
          replyMessageId
        );
        if (!textResult.success) {
          throw new Error(textResult.error || 'Falha ao enviar mensagem de texto.');
        }
        replyConsumed = Boolean(replyMessageId);
      }

      for (const attachment of attachments) {
        const shouldIncludeReply = Boolean(replyMessageId && !replyConsumed);

        if (attachment.type === 'location') {
          const locationResult = await zapiService.sendLocationMessage(
            selectedPhone,
            attachment.location,
            shouldIncludeReply ? replyMessageId : undefined
          );
          if (!locationResult.success) {
            throw new Error(locationResult.error || 'Falha ao enviar localização.');
          }
          if (shouldIncludeReply) {
            replyConsumed = true;
          }
          continue;
        }

        const base64Override =
          recordedAudio && attachment.file === recordedAudio.file ? recordedAudio.base64 : undefined;
        const mediaResult = await zapiService.sendMediaMessage(
          selectedPhone,
          attachment.file,
          attachment.file.name,
          attachment.type,
          undefined,
          base64Override,
          shouldIncludeReply ? replyMessageId : undefined
        );
        if (!mediaResult.success) {
          throw new Error(mediaResult.error || 'Falha ao enviar anexo.');
        }
        if (shouldIncludeReply) {
          replyConsumed = true;
        }
      }

      if (selectedChatLead?.id) {
        const refreshResult = await zapiService.fetchAndSaveHistory(
          selectedChatLead.id,
          selectedPhone,
          selectedChat?.contractId ?? undefined
        );
        if (!refreshResult.success) {
          console.error('Erro ao atualizar histórico após envio:', refreshResult.error);
        }
      }

      await loadConversations(false);

      setComposerSuccess('Mensagem enviada com sucesso!');
      setComposerText('');
      clearAttachments();
      setComposerReplyMessage(null);
    } catch (error) {
      setComposerError(
        error instanceof Error
          ? error.message
          : 'Falha ao enviar mensagem. Tente novamente mais tarde.'
      );
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    attachments,
    clearAttachments,
    composerText,
    hasContentToSend,
    loadConversations,
    recordedAudio,
    selectedChat?.contractId,
    selectedChatLead?.id,
    selectedPhone,
    composerReplyMessage,
  ]);

  useEffect(() => {
    return () => {
      stopAudioVisualization();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    };
  }, [stopAudioVisualization]);

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const isMediaFallbackText = (message: WhatsAppConversation, text?: string | null) => {
    if (!text) {
      return false;
    }

    const normalizedText = text.trim();
    if (!normalizedText) {
      return false;
    }

    const genericFallbacks = new Set([
      'Mensagem recebida',
      'Mensagem enviada',
      'Mídia recebida',
      'Mídia enviada',
    ]);

    if (genericFallbacks.has(normalizedText)) {
      return true;
    }

    const mediaType = message.media_type?.toLowerCase();
    const fallbackPrefixes: Partial<Record<string, string[]>> = {
      audio: ['Áudio recebido', 'Áudio enviado'],
      video: ['Vídeo recebido', 'Vídeo enviado'],
      image: ['Imagem recebida', 'Imagem enviada'],
      gif: ['GIF recebido', 'GIF enviado', 'Imagem recebida', 'Imagem enviada'],
      sticker: ['Sticker recebido', 'Sticker enviado', 'Imagem recebida', 'Imagem enviada'],
      document: ['Documento recebido', 'Documento enviado'],
    };

    if (mediaType) {
      const prefixes = fallbackPrefixes[mediaType];
      if (prefixes?.some((prefix) => normalizedText.startsWith(prefix))) {
        return true;
      }
    }

    return false;
  };

const getMediaTypeLabel = (mediaType?: string | null) => {
  const normalized = mediaType?.toLowerCase();
  switch (normalized) {
    case 'audio':
      return 'Mensagem de áudio';
      case 'video':
        return 'Vídeo';
      case 'image':
        return 'Imagem';
      case 'gif':
        return 'GIF';
      case 'sticker':
        return 'Sticker';
      case 'document':
        return 'Documento';
      default:
        return 'Mensagem';
  }
};

const getOutgoingMessageStatus = (
  message: WhatsAppConversation,
): WhatsAppMessageDeliveryStatus | null => {
  if (message.message_type !== 'sent') {
    return null;
  }

  if (message.delivery_status) {
    return message.delivery_status;
  }

  return 'sent';
};

  const getDisplayTextForMessage = (message: WhatsAppConversation) => {
    const caption = message.media_caption?.trim();
    const text = message.message_text?.trim();

    if (caption && caption !== text) {
      return caption;
    }

    if (message.media_url && isMediaFallbackText(message, text)) {
      return '';
    }

    return text || '';
  };

  const getMessageSenderLabel = (message: WhatsAppConversation) => {
    if (message.message_type === 'sent') {
      return 'Você';
    }

    return message.sender_name?.trim() || selectedChatDisplayName || 'Contato';
  };

  const getQuotedSenderLabelForMessage = (message: WhatsAppConversation) => {
    const trimmed = message.quoted_message_sender?.trim();
    if (trimmed) {
      return trimmed;
    }

    if (typeof message.quoted_message_from_me === 'boolean') {
      return message.quoted_message_from_me ? 'Você' : 'Contato';
    }

    return 'Contato';
  };

  const getQuotedPreviewTextForMessage = (message: WhatsAppConversation) => {
    const text = message.quoted_message_text?.trim();
    if (text) {
      return text;
    }

    if (message.quoted_message_type) {
      return getMediaTypeLabel(message.quoted_message_type);
    }

    return 'Mensagem';
  };

  const getComposerReplyPreviewText = (message: WhatsAppConversation) => {
    const text = getDisplayTextForMessage(message).trim();
    if (text) {
      return text;
    }

    if (message.media_caption?.trim()) {
      return message.media_caption.trim();
    }

    if (message.media_url) {
      return getMediaTypeLabel(message.media_type);
    }

    return 'Mensagem';
  };

  const renderMediaContent = (message: WhatsAppConversation): JSX.Element | null => {
    if (!message.media_url) {
      return null;
    }

    const mediaType = message.media_type?.toLowerCase();
    const accentColor = message.message_type === 'sent' ? 'text-teal-100' : 'text-slate-500';
    const fallbackText = message.media_caption || message.message_text || 'Mídia recebida';

    switch (mediaType) {
      case 'image':
      case 'sticker':
      case 'gif': {
        const normalizedType = mediaType === 'gif' ? 'gif' : 'image';
        return (
          <button
            type="button"
            onClick={() =>
              setFullscreenMedia({
                url: message.media_url!,
                type: normalizedType,
                caption: message.media_caption,
                mimeType: message.media_mime_type,
                thumbnailUrl: message.media_thumbnail_url,
              })
            }
            className="group block w-full cursor-zoom-in focus:outline-none"
          >
            <img
              src={message.media_url}
              alt={fallbackText}
              className="w-full max-h-64 rounded-lg object-cover transition-transform duration-200 group-hover:scale-[1.01]"
              loading="lazy"
            />
          </button>
        );
      }
      case 'video':
        return (
          <button
            type="button"
            onClick={() =>
              setFullscreenMedia({
                url: message.media_url!,
                type: 'video',
                caption: message.media_caption,
                mimeType: message.media_mime_type,
                thumbnailUrl: message.media_thumbnail_url,
              })
            }
            className="group block w-full cursor-zoom-in focus:outline-none"
          >
            <video
              key={`${message.id}-video`}
              poster={message.media_thumbnail_url || undefined}
              className="w-full max-h-72 rounded-lg pointer-events-none"
            >
              <source src={message.media_url} type={message.media_mime_type || undefined} />
              Seu navegador não suporta a reprodução de vídeos.
            </video>
          </button>
        );
      case 'audio': {
        const duration = formatDuration(message.media_duration_seconds);
        return (
          <div className="space-y-1">
            <div className="w-full min-w-[264px] sm:min-w-[344px]">
              <audio
                key={`${message.id}-audio`}
                controls
                src={message.media_url}
                className="w-full"
              >
                <source src={message.media_url} type={message.media_mime_type || undefined} />
                Seu navegador não suporta a reprodução de áudio.
              </audio>
            </div>
            {duration && <span className={`text-[11px] ${accentColor}`}>Duração: {duration}</span>}
          </div>
        );
      }
      case 'document':
        return (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-medium underline ${
              message.message_type === 'sent' ? 'text-white' : 'text-teal-600'
            }`}
          >
            Abrir documento
          </a>
        );
      default:
        return (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-medium underline ${
              message.message_type === 'sent' ? 'text-white' : 'text-teal-600'
            }`}
          >
            Abrir mídia
          </a>
        );
    }
  };

  const groupedSelectedMessages = useMemo(() => {
    const groups: { date: string; messages: MessageWithReactions[] }[] = [];
    let currentDate: string | null = null;

    processedSelectedMessages.forEach((message) => {
      const dateLabel = formatDateLabel(message.timestamp);
      if (dateLabel !== currentDate) {
        currentDate = dateLabel;
        groups.push({ date: dateLabel, messages: [] });
      }
      groups[groups.length - 1].messages.push(message);
    });

    return groups;
  }, [processedSelectedMessages]);

  const handleOpenReactionDetails = useCallback(
    (message: MessageWithReactions, summary: MessageReactionSummary) => {
      setActiveReactionDetails({ message, summary });
    },
    []
  );

  const handleCloseReactionDetails = useCallback(() => {
    setActiveReactionDetails(null);
  }, []);

  const handleSendReaction = useCallback(
    async (message: MessageWithReactions, emoji: string) => {
      if (isObserver) {
        return;
      }

      const messageId = message.message_id?.trim();
      if (!messageId) {
        setReactionError('Não foi possível identificar a mensagem para reagir.');
        return;
      }

      const chatIdentifier = (message.phone_number || selectedPhone || '').trim();
      if (!chatIdentifier) {
        setReactionError('Não foi possível identificar o chat da mensagem.');
        return;
      }

      setSendingReactionMessageId(messageId);
      setReactionError(null);

      try {
        const result = await zapiService.sendReaction(chatIdentifier, messageId, emoji);
        if (!result.success) {
          setReactionError(result.error || 'Erro ao enviar reação.');
          return;
        }

        setActiveReactionMenuMessageId(null);
      } catch (error) {
        console.error('Erro ao enviar reação:', error);
        setReactionError(
          error instanceof Error ? error.message : 'Erro desconhecido ao enviar a reação.'
        );
      } finally {
        setSendingReactionMessageId(null);
      }
    },
    [isObserver, selectedPhone]
  );

  const handleReplyToMessage = useCallback(
    (message: MessageWithReactions) => {
      if (isObserver) {
        return;
      }
      setComposerReplyMessage(message);
      setComposerError(null);
      setTimeout(() => {
        composerTextareaRef.current?.focus();
      }, 0);
    },
    [isObserver]
  );

  const handleOpenForwardModal = useCallback(
    (message: MessageWithReactions) => {
      if (isObserver) {
        return;
      }

      const messageKey = message.id || message.message_id || null;

      setIsForwardModalOpen(true);
      setForwardingMessageIds(messageKey ? [messageKey] : []);
      setForwardSelectedTargetPhones([]);
      setForwardSourcePhone(message.phone_number || selectedPhone || null);
      setForwardChatSearchTerm('');
      setForwardError(null);
      setForwardSuccess(null);
      setForwardStep('messages');
    },
    [isObserver, selectedPhone]
  );

  const handleCloseForwardModal = useCallback(() => {
    setIsForwardModalOpen(false);
    setForwardingMessageIds([]);
    setForwardSelectedTargetPhones([]);
    setForwardSourcePhone(null);
    setForwardChatSearchTerm('');
    setForwardError(null);
    setForwardSuccess(null);
    setIsForwardingMessage(false);
    setForwardStep('messages');
  }, []);

  const selectedMessagesMap = useMemo(() => {
    const map = new Map<string, MessageWithReactions>();
    processedSelectedMessages.forEach((message) => {
      if (message.id) {
        map.set(message.id, message);
      }
      if (message.message_id) {
        map.set(message.message_id, message);
      }
    });
    return map;
  }, [processedSelectedMessages]);

  const messagesSelectedForForward = useMemo(
    () =>
      forwardingMessageIds
        .map((messageId) => selectedMessagesMap.get(messageId))
        .filter((message): message is MessageWithReactions => Boolean(message)),
    [forwardingMessageIds, selectedMessagesMap]
  );

  const handleForwardAdvanceToTargets = useCallback(() => {
    if (forwardingMessageIds.length === 0) {
      setForwardError('Selecione ao menos uma mensagem para encaminhar.');
      return;
    }

    setForwardError(null);
    setForwardStep('targets');
  }, [forwardingMessageIds]);

  const handleForwardBackToMessages = useCallback(() => {
    setForwardStep('messages');
    setForwardError(null);
    setForwardSuccess(null);
  }, []);

  const handleConfirmForwardMessage = useCallback(async () => {
    if (!isForwardModalOpen || isObserver) {
      return;
    }

    if (forwardStep !== 'targets') {
      setForwardError('Selecione primeiro os chats de destino.');
      return;
    }

    if (messagesSelectedForForward.length === 0) {
      setForwardError('Selecione ao menos uma mensagem para encaminhar.');
      return;
    }

    const messagesToForward = messagesSelectedForForward;

    if (messagesToForward.length === 0) {
      setForwardError('Selecione ao menos uma mensagem para encaminhar.');
      return;
    }

    const uniqueTargets = Array.from(
      new Set(
        forwardSelectedTargetPhones
          .map((phone) => sanitizePhoneDigits(phone))
          .filter((phone) => phone.length > 0)
      )
    );

    if (uniqueTargets.length === 0) {
      setForwardError('Selecione ao menos um chat de destino.');
      return;
    }

    const sourcePhoneDigits = sanitizePhoneDigits(
      forwardSourcePhone || messagesToForward[0]?.phone_number || selectedPhone || ''
    );

    if (!sourcePhoneDigits) {
      setForwardError('Não foi possível identificar o chat de origem das mensagens.');
      return;
    }

    const messageIds = messagesToForward
      .map((message) => message.message_id || message.id || null)
      .filter((messageId): messageId is string => Boolean(messageId));

    if (messageIds.length !== messagesToForward.length) {
      setForwardError('Não foi possível identificar todas as mensagens selecionadas.');
      return;
    }

    setIsForwardingMessage(true);
    setForwardError(null);
    setForwardSuccess(null);

    try {
      for (const target of uniqueTargets) {
        for (const messageId of messageIds) {
          const result = await zapiService.forwardMessage(target, messageId, sourcePhoneDigits, 1);
          if (!result.success) {
            throw new Error(result.error || 'Falha ao encaminhar a mensagem.');
          }
        }
      }

      setForwardSuccess('Mensagens encaminhadas com sucesso!');
      setTimeout(() => {
        handleCloseForwardModal();
      }, 1500);
    } catch (error) {
      console.error('Erro ao encaminhar mensagem:', error);
      setForwardError(
        error instanceof Error ? error.message : 'Erro ao encaminhar as mensagens.'
      );
    } finally {
      setIsForwardingMessage(false);
    }
  }, [
    forwardSelectedTargetPhones,
    forwardSourcePhone,
    forwardStep,
    handleCloseForwardModal,
    isForwardModalOpen,
    isObserver,
    messagesSelectedForForward,
    selectedPhone,
  ]);

  const handleToggleForwardMessageSelection = useCallback(
    (messageId: string, isChecked: boolean) => {
      setForwardingMessageIds((prev) => {
        let next: string[] = prev;

        if (isChecked) {
          if (prev.includes(messageId)) {
            next = prev;
          } else {
            const orderMap = new Map<string, number>();
            processedSelectedMessages.forEach((message, index) => {
              if (message.id) {
                orderMap.set(message.id, index);
              }
              if (message.message_id) {
                orderMap.set(message.message_id, index);
              }
            });

            next = [...prev, messageId];
            next.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));
          }
        } else {
          next = prev.filter((id) => id !== messageId);
        }

        if (forwardStep === 'messages' && next.length > 0) {
          setForwardError(null);
        }

        return next;
      });
    },
    [forwardStep, processedSelectedMessages]
  );

  const handleToggleForwardTarget = useCallback((phone: string, isChecked: boolean) => {
    setForwardSelectedTargetPhones((prev) => {
      if (isChecked) {
        if (prev.includes(phone)) {
          return prev;
        }
        return [...prev, phone];
      }

      return prev.filter((value) => value !== phone);
    });
  }, []);

  const forwardChatOptions = useMemo(() => {
    const search = forwardChatSearchTerm.trim().toLowerCase();

    return chatsWithPreferences
      .map((chat) => {
        const displayName = getChatDisplayName(chat);
        const chatMetadata = chat.isGroup ? undefined : getChatMetadataForPhone(chat.phone);
        const photoUrl = chat.photoUrl || chatMetadata?.profileThumbnail || null;
        const phoneDisplay = formatPhoneForDisplay(chat.phone);

        return { chat, displayName, photoUrl, phoneDisplay };
      })
      .filter((option) => {
        if (!search) {
          return true;
        }

        const normalizedDisplay = option.displayName.toLowerCase();
        const normalizedPhone = option.phoneDisplay.toLowerCase();
        return normalizedDisplay.includes(search) || normalizedPhone.includes(search);
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [
    chatsWithPreferences,
    forwardChatSearchTerm,
    getChatDisplayName,
    getChatMetadataForPhone,
  ]);

  const handleCancelReply = useCallback(() => {
    setComposerReplyMessage(null);
  }, []);

  const handleJumpToMessage = useCallback(
    (messageId?: string | null) => {
      if (!messageId) {
        return;
      }

      const alternateId = messageIdToInternalId.get(messageId) ?? null;
      setManualScrollTargetId(messageId);
      setManualScrollAlternateId(alternateId);
    },
    [messageIdToInternalId]
  );

  const handleRefreshChats = async () => {
    setIsRefreshing(true);
    await loadConversations(false);
  };

  const applyArchiveState = useCallback(
    async (
      phone: string,
      desiredState: boolean | ((current?: WhatsAppChatPreference) => boolean)
    ) => {
      let previousPref: WhatsAppChatPreference | undefined;
      let nextPref: WhatsAppChatPreference | undefined;
      let shouldArchive = false;
      let remoteUpdated = false;

      setChatPreferences((prev) => {
        const next = new Map(prev);
        const current = prev.get(phone);
        previousPref = current;
        const now = new Date().toISOString();
        shouldArchive =
          typeof desiredState === 'function' ? desiredState(current) : desiredState;
        nextPref = {
          phone_number: phone,
          archived: shouldArchive,
          pinned: current?.pinned ?? false,
          created_at: current?.created_at ?? now,
          updated_at: now,
        };
        next.set(phone, nextPref);
        return next;
      });

      if (!nextPref) {
        return;
      }

      try {
        const remoteResult = await zapiService.setChatArchiveStatus(phone, shouldArchive);
        if (!remoteResult.success) {
          throw new Error(remoteResult.error || 'Falha ao atualizar arquivamento no WhatsApp.');
        }
        remoteUpdated = true;

        const { error } = await supabase
          .from('whatsapp_chat_preferences')
          .upsert({
            phone_number: phone,
            archived: nextPref.archived,
            pinned: nextPref.pinned,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          throw error;
        }
      } catch (error) {
        setChatPreferences((prev) => {
          const next = new Map(prev);
          if (previousPref) {
            next.set(phone, previousPref);
          } else {
            next.delete(phone);
          }
          return next;
        });

        if (remoteUpdated) {
          const revertResult = await zapiService.setChatArchiveStatus(
            phone,
            previousPref?.archived ?? false
          );
          if (!revertResult.success) {
            console.error('Falha ao reverter arquivamento no WhatsApp:', revertResult.error);
          }
        }

        throw error;
      }
    },
    []
  );

  const applyPinState = useCallback(
    async (
      phone: string,
      desiredState: boolean | ((current?: WhatsAppChatPreference) => boolean)
    ) => {
      let previousPref: WhatsAppChatPreference | undefined;
      let nextPref: WhatsAppChatPreference | undefined;
      let shouldPin = false;

      setChatPreferences((prev) => {
        const next = new Map(prev);
        const current = prev.get(phone);
        previousPref = current;
        const now = new Date().toISOString();
        shouldPin = typeof desiredState === 'function' ? desiredState(current) : desiredState;
        nextPref = {
          phone_number: phone,
          archived: current?.archived ?? false,
          pinned: shouldPin,
          created_at: current?.created_at ?? now,
          updated_at: now,
        };
        next.set(phone, nextPref);
        return next;
      });

      if (!nextPref) {
        return;
      }

      try {
        const { error } = await supabase
          .from('whatsapp_chat_preferences')
          .upsert({
            phone_number: phone,
            archived: nextPref.archived,
            pinned: nextPref.pinned,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          throw error;
        }
      } catch (error) {
        setChatPreferences((prev) => {
          const next = new Map(prev);
          if (previousPref) {
            next.set(phone, previousPref);
          } else {
            next.delete(phone);
          }
          return next;
        });

        throw error;
      }
    },
    []
  );

  const handleToggleArchive = useCallback(
    async (phone: string) => {
      try {
        await applyArchiveState(phone, (current) => !(current?.archived ?? false));
      } catch (error) {
        console.error('Erro ao atualizar arquivamento do chat:', error);
      }
    },
    [applyArchiveState]
  );

  const handleTogglePin = useCallback(
    async (phone: string) => {
      try {
        await applyPinState(phone, (current) => !(current?.pinned ?? false));
      } catch (error) {
        console.error('Erro ao atualizar fixação do chat:', error);
      }
    },
    [applyPinState]
  );

  const markChatMessagesAsRead = useCallback(
    async (phone: string, messagesOverride?: WhatsAppConversation[]) => {
      const relevantMessages =
        messagesOverride ??
        conversations.filter((message) => message.phone_number === phone);

      const unreadMessages = relevantMessages.filter(
        (message) => message.message_type === 'received' && !message.read_status
      );

      if (unreadMessages.length === 0) {
        return;
      }

      const messageIdsToMark = Array.from(
        new Set(
          unreadMessages
            .map((message) => message.message_id?.trim())
            .filter((id): id is string => Boolean(id))
        )
      );

      try {
        const chatStatusResult = await zapiService.modifyChatStatus(phone, 'read');
        if (!chatStatusResult.success) {
          throw new Error(
            chatStatusResult.error || `Falha ao marcar chat ${phone} como lido no Z-API.`
          );
        }

        if (messageIdsToMark.length > 0) {
          await Promise.allSettled(
            messageIdsToMark.map(async (messageId) => {
              const result = await zapiService.markMessageAsRead(phone, messageId);
              if (!result.success) {
                console.error(
                  `Erro ao marcar mensagem ${messageId} como lida no Z-API:`,
                  result.error
                );
              }
            })
          );
        }

        const { error } = await supabase
          .from('whatsapp_conversations')
          .update({ read_status: true })
          .eq('phone_number', phone)
          .eq('message_type', 'received')
          .or('read_status.is.false,read_status.is.null');

        if (error) {
          throw error;
        }

        setConversations((prev) =>
          prev.map((message) =>
            message.phone_number === phone && message.message_type === 'received'
              ? { ...message, read_status: true }
              : message
          )
        );
      } catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
        throw error;
      }
    },
    [conversations]
  );

  const markChatMessagesAsUnread = useCallback(async (phone: string) => {
    try {
      const chatStatusResult = await zapiService.modifyChatStatus(phone, 'unread');
      if (!chatStatusResult.success) {
        throw new Error(
          chatStatusResult.error || `Falha ao marcar chat ${phone} como não lido no Z-API.`
        );
      }

      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ read_status: false })
        .eq('phone_number', phone)
        .eq('message_type', 'received');

      if (error) {
        throw error;
      }

      setConversations((prev) =>
        prev.map((message) =>
          message.phone_number === phone && message.message_type === 'received'
            ? { ...message, read_status: false }
            : message
        )
      );
    } catch (error) {
      console.error('Erro ao marcar chat como não lido:', error);
      throw error;
    }
  }, []);

  const executeSelectionAction = useCallback(
    async ({
      loadingMessage,
      successMessage,
      errorMessage,
      action,
    }: {
      loadingMessage: string;
      successMessage: string;
      errorMessage: (failedCount: number) => string;
      action: (phone: string) => Promise<void>;
    }) => {
      const phones = Array.from(selectedPhones);
      if (phones.length === 0) {
        return;
      }

      updateSelectionFeedback({ status: 'loading', message: loadingMessage });

      const results = await Promise.allSettled(phones.map((phone) => action(phone)));
      let failedCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          failedCount += 1;
          console.error(`Falha ao executar ação em ${phones[index]}:`, result.reason);
        }
      });

      if (failedCount === 0) {
        updateSelectionFeedback({ status: 'success', message: successMessage });
        clearSelectedPhones();
      } else {
        updateSelectionFeedback({ status: 'error', message: errorMessage(failedCount) });
      }
    },
    [clearSelectedPhones, selectedPhones, updateSelectionFeedback]
  );

  const handleBulkMarkAsRead = useCallback(async () => {
    await executeSelectionAction({
      loadingMessage: 'Marcando conversas selecionadas como lidas...',
      successMessage: 'Conversas marcadas como lidas.',
      errorMessage: (failed) =>
        failed === 1
          ? 'Falha ao marcar uma conversa como lida.'
          : `Falha ao marcar ${failed} conversas como lidas.`,
      action: async (phone) => {
        await markChatMessagesAsRead(phone);
      },
    });
  }, [executeSelectionAction, markChatMessagesAsRead]);

  const handleBulkMarkAsUnread = useCallback(async () => {
    await executeSelectionAction({
      loadingMessage: 'Marcando conversas selecionadas como não lidas...',
      successMessage: 'Conversas marcadas como não lidas.',
      errorMessage: (failed) =>
        failed === 1
          ? 'Falha ao marcar uma conversa como não lida.'
          : `Falha ao marcar ${failed} conversas como não lidas.`,
      action: async (phone) => {
        await markChatMessagesAsUnread(phone);
      },
    });
  }, [executeSelectionAction, markChatMessagesAsUnread]);

  const handleBulkArchive = useCallback(async () => {
    await executeSelectionAction({
      loadingMessage: 'Arquivando conversas selecionadas...',
      successMessage: 'Conversas arquivadas com sucesso.',
      errorMessage: (failed) =>
        failed === 1
          ? 'Falha ao arquivar uma das conversas selecionadas.'
          : `Falha ao arquivar ${failed} conversas selecionadas.`,
      action: async (phone) => {
        await applyArchiveState(phone, true);
      },
    });
  }, [applyArchiveState, executeSelectionAction]);

  const handleBulkUnarchive = useCallback(async () => {
    await executeSelectionAction({
      loadingMessage: 'Desarquivando conversas selecionadas...',
      successMessage: 'Conversas desarquivadas com sucesso.',
      errorMessage: (failed) =>
        failed === 1
          ? 'Falha ao desarquivar uma das conversas selecionadas.'
          : `Falha ao desarquivar ${failed} conversas selecionadas.`,
      action: async (phone) => {
        await applyArchiveState(phone, false);
      },
    });
  }, [applyArchiveState, executeSelectionAction]);

  const selectedChatUnreadCount = useMemo(() => {
    return selectedChat?.unreadCount ?? 0;
  }, [selectedChat]);

  const selectionCount = selectedPhones.size;
  const isProcessingSelection = selectionActionState.status === 'loading';

  useEffect(() => {
    if (!selectedPhone || !scrollTargetMessageId) {
      return;
    }

    const isNewChat = lastScrolledChatRef.current !== selectedPhone;
    if (!isNewChat) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) {
      lastScrolledChatRef.current = selectedPhone;
      return;
    }

    const frame = requestAnimationFrame(() => {
      const target = scrollTargetMessageRef.current;
      if (target && container.contains(target)) {
        target.scrollIntoView({ block: 'center', behavior: 'auto' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    });

    lastScrolledChatRef.current = selectedPhone;

    return () => cancelAnimationFrame(frame);
  }, [scrollTargetMessageId, selectedPhone]);

  useEffect(() => {
    if (!selectedPhone || !manualScrollTargetId) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const findElementById = (id: string) => {
      if (!id) {
        return null;
      }

      const elements = container.querySelectorAll<HTMLElement>('[data-message-id],[data-internal-id]');
      for (const element of elements) {
        const { messageId, internalId } = element.dataset;
        if (messageId === id || internalId === id) {
          return element;
        }
      }
      return null;
    };

    let target = findElementById(manualScrollTargetId);
    let highlightId = manualScrollTargetId;

    if (!target && manualScrollAlternateId) {
      target = findElementById(manualScrollAlternateId);
      if (target) {
        highlightId = manualScrollAlternateId;
      }
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(highlightId);
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId((current) => (current === highlightId ? null : current));
        highlightTimeoutRef.current = null;
      }, 3000);
    }

    setManualScrollTargetId(null);
    setManualScrollAlternateId(null);
  }, [manualScrollAlternateId, manualScrollTargetId, selectedPhone]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setComposerReplyMessage(null);
    setHighlightedMessageId(null);
    setManualScrollTargetId(null);
    setManualScrollAlternateId(null);
  }, [selectedPhone]);

  useEffect(() => {
    if (!selectedPhone || selectedChatUnreadCount === 0) return;

    void markChatMessagesAsRead(selectedPhone, selectedChatMessages).catch((error) => {
      console.error('Erro ao marcar mensagens como lidas:', error);
    });
  }, [
    markChatMessagesAsRead,
    selectedChatMessages,
    selectedChatUnreadCount,
    selectedPhone,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-6 h-6 text-teal-600" />
            <h2 className="text-2xl font-bold text-slate-900">Histórico WhatsApp</h2>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleOpenStartConversationModal}
              className="inline-flex items-center space-x-2 rounded-lg border border-teal-500 px-4 py-2 text-sm font-medium text-teal-600 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <Plus className="w-4 h-4" />
              <span>Iniciar conversa</span>
            </button>
            <button
              onClick={() => setActiveView('ai-messages')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'ai-messages'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4" />
                <span>Mensagens IA</span>
              </div>
            </button>
            <button
              onClick={() => setActiveView('chat')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'chat'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-4 h-4" />
                <span>Conversas</span>
              </div>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeView === 'ai-messages' ? 'Buscar em mensagens...' : 'Buscar por nome, telefone ou mensagem...'}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {activeView === 'chat' && (
            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
              <button
                type="button"
                onClick={() => setChatListFilter('active')}
                className={`px-3 py-2 transition-colors ${
                  chatListFilter === 'active'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Ativos
              </button>
              <button
                type="button"
                onClick={() => setChatListFilter('archived')}
                className={`px-3 py-2 transition-colors border-l border-slate-200 ${
                  chatListFilter === 'archived'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Arquivados
              </button>
            </div>
          )}

          {activeView === 'chat' && (
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">Todos os status</option>
              {activeLeadStatuses.map((status) => (
                <option key={status.id} value={status.nome}>
                  {status.nome}
                </option>
              ))}
            </select>
          )}

          {activeView === 'chat' && (
            <select
              value={selectedResponsavel}
              onChange={(event) => setSelectedResponsavel(event.target.value)}
              className="min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">Todos os responsáveis</option>
              {responsavelOptions.map((option) => (
                <option key={option.id} value={option.value}>
                  {option.label || option.value}
                </option>
              ))}
            </select>
          )}

          {activeView === 'chat' && (
            <button
              onClick={handleRefreshChats}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium transition-colors ${
                isRefreshing ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-100 text-slate-700'
              }`}
              disabled={isRefreshing}
            >
              <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          )}

          {activeView === 'ai-messages' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="approved">Aprovada</option>
              <option value="sent">Enviada</option>
              <option value="failed">Falhou</option>
            </select>
          )}
        </div>

        {activeView === 'ai-messages' ? (
          <div className="space-y-4">
            {filteredAIMessages.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <Sparkles className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">Nenhuma mensagem gerada por IA encontrada</p>
              </div>
            ) : (
              filteredAIMessages.map((msg) => {
                const lead = leadsMap.get(msg.lead_id);
                return (
                  <div key={msg.id} className="bg-gradient-to-r from-purple-50 to-white border border-purple-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(msg.status)}
                        <div>
                          <h3 className="font-semibold text-slate-900">{lead?.nome_completo || 'Lead não encontrado'}</h3>
                          <p className="text-sm text-slate-600">{lead?.telefone}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(msg.status)}`}>
                        {getStatusLabel(msg.status)}
                      </span>
                    </div>

                    <div className="bg-white rounded-lg p-4 mb-3 border border-slate-200">
                      <p className="text-slate-900 whitespace-pre-wrap">
                        {msg.message_edited || msg.message_generated}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateTimeFullBR(msg.created_at)}</span>
                        </span>
                        <span>Tom: {msg.tone}</span>
                        <span>{msg.tokens_used} tokens</span>
                        {msg.cost_estimate > 0 && <span>~${msg.cost_estimate.toFixed(4)}</span>}
                      </div>
                      {msg.generated_by && <span>Por: {msg.generated_by}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[320px,minmax(0,1fr)] gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden h-[600px] flex flex-col">
              <div className="px-4 py-3 bg-white border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Conversas</h3>
                <p className="text-xs text-slate-500">Contatos com mensagens registradas</p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {hasSelectedPhones && (
                  <div className="px-4 py-2 bg-teal-50 border-b border-teal-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-teal-700">
                      {isProcessingSelection ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">
                        {selectionCount}{' '}
                        {selectionCount === 1 ? 'conversa selecionada' : 'conversas selecionadas'}
                      </span>
                      {selectionActionState.status === 'loading' && selectionActionState.message && (
                        <span className="text-xs text-teal-600">{selectionActionState.message}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          void handleBulkMarkAsRead();
                        }}
                        disabled={isProcessingSelection}
                        className="inline-flex items-center gap-1 rounded-lg border border-teal-500 px-3 py-1.5 text-sm font-medium text-teal-600 transition-colors hover:bg-teal-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marcar como lido
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleBulkMarkAsUnread();
                        }}
                        disabled={isProcessingSelection}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Clock className="w-4 h-4" />
                        Marcar como não lido
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleBulkArchive();
                        }}
                        disabled={isProcessingSelection}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Archive className="w-4 h-4" />
                        Arquivar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleBulkUnarchive();
                        }}
                        disabled={isProcessingSelection}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                        Desarquivar
                      </button>
                      <button
                        type="button"
                        onClick={() => clearSelectedPhones()}
                        disabled={isProcessingSelection}
                        className="inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="w-4 h-4" />
                        Limpar seleção
                      </button>
                    </div>
                  </div>
                )}
                {filteredChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6 text-slate-500">
                    <MessageCircle className="w-10 h-10 mb-3" />
                    <p className="font-medium">Nenhuma conversa encontrada</p>
                    <p className="text-sm">Aguarde o recebimento de novas mensagens via webhook.</p>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const lead = chat.isGroup
                      ? undefined
                      : (chat.leadId ? leadsMap.get(chat.leadId) : undefined) ??
                        leadsByPhoneMap.get(sanitizePhoneDigits(chat.phone)) ??
                        leadsByPhoneMap.get(chat.phone.trim());
                    const lastMessage = chat.lastMessage;
                    const isActive = chat.phone === selectedPhone;
                    const isSelected = selectedPhones.has(chat.phone);
                    const groupMetadata = chat.isGroup ? getGroupMetadataForPhone(chat.phone) : undefined;
                    const chatMetadata = chat.isGroup ? undefined : getChatMetadataForPhone(chat.phone);
                    const displayName = chat.isGroup
                      ? groupMetadata?.subject || chat.displayName || formatPhoneForDisplay(chat.phone)
                      : lead?.nome_completo || chatMetadata?.displayName || chat.displayName || formatPhoneForDisplay(chat.phone);
                    const chatPhotoUrl = chat.photoUrl || chatMetadata?.profileThumbnail || null;
                    const leadResponsavelValue = lead?.responsavel ?? '';
                    const leadResponsavelLabel = leadResponsavelValue
                      ? responsavelLabelMap.get(leadResponsavelValue) ?? leadResponsavelValue
                      : null;

                    return (
                      <div
                        key={chat.phone}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectPrimaryPhone(chat.phone)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectPrimaryPhone(chat.phone);
                          }
                        }}
                        className={`w-full px-4 py-3 border-b border-slate-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 ${
                          isActive
                            ? 'bg-teal-50 ring-1 ring-teal-400'
                            : isSelected
                            ? 'bg-teal-100/60 ring-1 ring-teal-300'
                            : 'hover:bg-teal-50 bg-transparent'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-teal-500 text-teal-600 focus:ring-teal-500"
                              checked={isSelected}
                              disabled={isProcessingSelection}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation();
                                togglePhoneSelection(chat.phone);
                              }}
                              aria-label={
                                isSelected ? 'Remover conversa da seleção' : 'Selecionar conversa'
                              }
                            />
                          </div>
                          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden">
                            {chatPhotoUrl ? (
                              <img
                                src={chatPhotoUrl}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Phone className="w-5 h-5 text-teal-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between space-x-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-semibold text-slate-900 truncate">
                                    {displayName}
                                  </h4>
                                  {chat.pinned && <Pin className="w-3 h-3 text-teal-600" />}
                                  {leadResponsavelLabel && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                                      {leadResponsavelLabel}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 truncate">
                                  {lastMessage?.message_text || 'Sem mensagens registradas'}
                                </p>
                                {(chat.pinned || chat.archived) && (
                                  <div className="flex items-center space-x-2 mt-1">
                                    {chat.pinned && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-700 uppercase tracking-wide">
                                        Fixado
                                      </span>
                                    )}
                                    {chat.archived && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700 uppercase tracking-wide">
                                        Arquivado
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-start space-x-2 ml-3">
                                <div className="flex flex-col items-end space-y-1">
                                  {lastMessage && (
                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                      {formatTime(lastMessage.timestamp)}
                                    </span>
                                  )}
                                  {chat.unreadCount > 0 && (
                                    <span className="inline-flex min-w-[24px] justify-center rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-start space-x-1">
                                  {lead && responsavelOptions.length > 0 && (
                                    <div>
                                      <select
                                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        value={leadResponsavelValue}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => {
                                          event.stopPropagation();
                                          const nextResponsavel = event.target.value;
                                          if (!nextResponsavel || nextResponsavel === lead.responsavel) {
                                            return;
                                          }
                                          void handleLeadResponsavelChange(lead.id, nextResponsavel);
                                        }}
                                        disabled={isObserver}
                                        aria-label="Alterar responsável"
                                        title={
                                          isObserver
                                            ? 'Visualização do responsável'
                                            : 'Alterar responsável do lead'
                                        }
                                      >
                                        {leadResponsavelValue === '' && (
                                          <option value="" disabled>
                                            {isObserver ? 'Responsável' : 'Definir responsável'}
                                          </option>
                                        )}
                                        {responsavelOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleTogglePin(chat.phone);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                    title={chat.pinned ? 'Desfixar conversa' : 'Fixar conversa'}
                                    aria-label={chat.pinned ? 'Desfixar conversa' : 'Fixar conversa'}
                                  >
                                    {chat.pinned ? (
                                      <PinOff className="w-4 h-4" />
                                    ) : (
                                      <Pin className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleToggleArchive(chat.phone);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                    title={chat.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
                                    aria-label={chat.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
                                  >
                                    {chat.archived ? (
                                      <ArchiveRestore className="w-4 h-4" />
                                    ) : (
                                      <Archive className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-6 xl:space-y-0 xl:flex xl:items-start xl:gap-6">
              <div className="bg-white border border-slate-200 rounded-xl h-[600px] flex flex-col flex-1">
              {!selectedPhone ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <MessageCircle className="w-12 h-12 mb-4" />
                  <p className="font-medium">Selecione uma conversa</p>
                  <p className="text-sm">Escolha um contato para visualizar o histórico.</p>
                </div>
              ) : (
                <>
                  <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-teal-500 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={handleToggleLeadDetailsPanel}
                        className="group flex items-center space-x-3 rounded-lg px-1 -mx-1 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:bg-white/10"
                        aria-expanded={isLeadDetailsPanelOpen}
                        title={
                          isLeadDetailsPanelOpen
                            ? 'Ocultar detalhes do lead'
                            : 'Mostrar detalhes do lead'
                        }
                      >
                        <div className="w-11 h-11 rounded-full bg-teal-500 flex items-center justify-center overflow-hidden border border-teal-300/40">
                          {selectedChatPhotoUrl ? (
                            <img
                              src={selectedChatPhotoUrl}
                              alt={selectedChatDisplayName || selectedPhone || 'Contato'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Phone className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="font-semibold text-lg group-hover:underline">
                              {selectedChatDisplayName}
                            </h3>
                            {selectedChatPreference?.pinned && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white uppercase tracking-wide">
                                Fixado
                              </span>
                            )}
                            {selectedChatPreference?.archived && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white uppercase tracking-wide">
                                Arquivado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-teal-100">{selectedPhone ? formatPhoneForDisplay(selectedPhone) : ''}</p>
                          {selectedChatPresenceLabel && (
                            <p className="text-xs text-teal-100 mt-0.5">
                              {selectedChatPresenceLabel}
                            </p>
                          )}
                        </div>
                      </button>
                      <div className="flex flex-col items-end space-y-2 text-xs text-teal-100">
                        {selectedChatLead?.telefone &&
                          sanitizePhoneDigits(selectedChatLead.telefone) !==
                            sanitizePhoneDigits(selectedPhone ?? '') && (
                            <span>Lead: {selectedChatLead.telefone}</span>
                          )}
                        {selectedChatLead && activeLeadStatuses.length > 0 && (
                          <StatusDropdown
                            currentStatus={selectedChatLead.status}
                            leadId={selectedChatLead.id}
                            statusOptions={activeLeadStatuses}
                            onStatusChange={handleLeadStatusChange}
                            disabled={isObserver}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-6 py-4 space-y-6"
                  >
                    {groupedSelectedMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                        <MessageCircle className="w-12 h-12 mb-4" />
                        <p className="font-medium">Nenhuma mensagem registrada</p>
                        <p className="text-sm">
                          As mensagens serão exibidas aqui assim que forem recebidas pelo webhook.
                        </p>
                      </div>
                    ) : (
                      groupedSelectedMessages.map((group) => (
                        <div key={group.date}>
                          <div className="flex justify-center mb-4">
                            <span className="text-xs bg-white text-slate-500 px-3 py-1 rounded-full shadow border border-slate-200">
                              {group.date}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {group.messages.map((message) => {
                              const displayText = getDisplayTextForMessage(message);
                              const showEmptyFallback = !displayText && !message.media_url;
                              const bubbleText = displayText || (showEmptyFallback ? 'Mensagem sem conteúdo' : '');
                              const timestampColor =
                                message.message_type === 'sent' ? 'text-teal-100' : 'text-slate-500';
                              const mediaContent = renderMediaContent(message);
                              const isGroupChat = selectedChat?.isGroup ?? false;
                              const trimmedSenderName = message.sender_name?.trim();
                              const senderLabel = isGroupChat
                                ? message.message_type === 'sent'
                                  ? 'Você'
                                  : trimmedSenderName || 'Participante'
                                : null;
                              const senderLabelClass = message.message_type === 'sent'
                                ? 'text-xs font-semibold text-teal-100 self-end'
                                : 'text-xs font-semibold text-slate-500';
                              const reactionSummaries = message.reactionSummaries ?? [];
                              const reactionAlignment =
                                message.message_type === 'sent'
                                  ? 'self-end justify-end'
                                  : 'self-start justify-start';
                              const reactionButtonClasses =
                                message.message_type === 'sent'
                                  ? 'border-white/30 bg-white/20 text-white hover:bg-white/30'
                                  : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200';
                              const quotedSenderLabel = getQuotedSenderLabelForMessage(message);
                              const quotedPreviewText = getQuotedPreviewTextForMessage(message);
                              const hasQuotedMessage = Boolean(
                                message.quoted_message_id ||
                                  message.quoted_message_text ||
                                  message.quoted_message_type
                              );
                              const messageDomId = message.message_id ?? message.id;
                              const isHighlighted = highlightedMessageId === messageDomId;
                              const bubbleHighlightClasses = isHighlighted
                                ? 'outline outline-2 outline-teal-400'
                                : '';
                              const reactionMenuMessageId = message.message_id?.trim() || null;
                              const canReactToMessage = Boolean(reactionMenuMessageId);
                              const isReactionMenuOpen =
                                !!reactionMenuMessageId &&
                                activeReactionMenuMessageId === reactionMenuMessageId;
                              const isSendingReaction =
                                !!reactionMenuMessageId &&
                                sendingReactionMessageId === reactionMenuMessageId;
                              const outgoingStatus = getOutgoingMessageStatus(message);
                              const outgoingStatusVisual = getOutgoingDeliveryStatusVisual(outgoingStatus);
                              const OutgoingStatusIcon = outgoingStatusVisual?.icon;

                              return (
                                <div
                                  key={message.id}
                                  data-message-id={message.message_id ?? undefined}
                                  data-internal-id={message.id}
                                  ref={
                                    message.id === scrollTargetMessageId
                                      ? (element) => {
                                          if (element) {
                                            scrollTargetMessageRef.current = element;
                                          }
                                        }
                                      : undefined
                                  }
                                  className={`flex w-full ${
                                    message.message_type === 'sent' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div className="relative group/message">
                                    <div
                                      className={`max-w-[100%] rounded-2xl px-4 py-3 shadow-sm flex flex-col space-y-2 items-start ${
                                        message.message_type === 'sent'
                                          ? 'bg-teal-500 text-white rounded-br-sm ml-auto min-w-[10rem]'
                                          : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm min-w-[9rem]'
                                      } ${bubbleHighlightClasses}`}
                                    >
                                      {senderLabel && (
                                        <span className={senderLabelClass}>{senderLabel}</span>
                                      )}
                                      {hasQuotedMessage && (
                                        <button
                                          type="button"
                                          onClick={() => handleJumpToMessage(message.quoted_message_id)}
                                          className={`text-left rounded-lg border-l-4 px-3 py-2 text-xs transition-colors ${
                                            message.message_type === 'sent'
                                              ? 'bg-white/10 border-white/50 text-teal-50 hover:bg-white/20'
                                              : 'bg-teal-50 border-teal-400 text-teal-800 hover:bg-teal-100'
                                          }`}
                                        >
                                          <p className="font-semibold tracking-wide text-[11px] uppercase opacity-80">
                                            ~ {quotedSenderLabel}
                                          </p>
                                          <p className="mt-1 text-[13px] whitespace-pre-wrap break-words">
                                            {quotedPreviewText}
                                          </p>
                                        </button>
                                      )}
                                    {bubbleText && (
                                      <p className="text-sm whitespace-pre-wrap break-words">{bubbleText}</p>
                                    )}
                                    {mediaContent}
                                    <div
                                      className={`flex items-center justify-end space-x-2 text-[11px] ${timestampColor}`}
                                    >
                                      {message.media_view_once && (
                                        <span className="uppercase tracking-wide font-semibold">Visualização única</span>
                                      )}
                                      <span>{formatTime(message.timestamp)}</span>
                                      {OutgoingStatusIcon && outgoingStatusVisual && (
                                        <span
                                          className="flex items-center"
                                          title={outgoingStatusVisual.label}
                                        >
                                          <OutgoingStatusIcon
                                            className={`h-4 w-4 ${outgoingStatusVisual.className}`}
                                            aria-hidden="true"
                                          />
                                          <span className="sr-only">{outgoingStatusVisual.label}</span>
                                        </span>
                                      )}
                                    </div>
                                    {reactionSummaries.length > 0 && (
                                      <div
                                        className={`flex flex-wrap gap-1 text-xs font-semibold ${reactionAlignment}`}
                                      >
                                        {reactionSummaries.map((summary) => (
                                          <button
                                            key={`${message.id}-${summary.emoji}`}
                                            type="button"
                                            onClick={() => handleOpenReactionDetails(message, summary)}
                                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 shadow-sm transition-colors ${reactionButtonClasses}`}
                                            aria-label={`Ver reações ${summary.emoji}`}
                                          >
                                            <span className="text-base leading-none">{summary.emoji}</span>
                                            <span>{summary.reactors.length}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    </div>
                                    {!isObserver && (
                                      <div
                                        className={`absolute top-1/2 right-0 flex -translate-y-1/2 translate-x-full flex-col gap-2 transition-opacity ${
                                          isObserver
                                            ? 'hidden'
                                            : 'opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100 pointer-events-none group-hover/message:pointer-events-auto group-focus-within/message:pointer-events-auto'
                                        }`}
                                      >
                                        {canReactToMessage && (
                                          <div className="relative pointer-events-auto">
                                            <button
                                              ref={(element) => {
                                                if (!reactionMenuMessageId) {
                                                  return;
                                                }
                                                if (element) {
                                                  reactionButtonRefs.current.set(
                                                    reactionMenuMessageId,
                                                    element
                                                  );
                                                } else {
                                                  reactionButtonRefs.current.delete(reactionMenuMessageId);
                                                }
                                              }}
                                              type="button"
                                              onClick={() => {
                                                if (!reactionMenuMessageId || isSendingReaction) {
                                                  return;
                                                }
                                                setReactionError(null);
                                                setActiveReactionMenuMessageId((previous) =>
                                                  previous === reactionMenuMessageId
                                                    ? null
                                                    : reactionMenuMessageId
                                                );
                                              }}
                                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-teal-600 shadow-sm transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                                              aria-label="Reagir à mensagem"
                                              disabled={isSendingReaction}
                                            >
                                              {isSendingReaction ? (
                                                <Loader className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <SmilePlus className="h-4 w-4" />
                                              )}
                                            </button>
                                            {isReactionMenuOpen && (
                                              <div
                                                ref={(element) => {
                                                  if (isReactionMenuOpen) {
                                                    reactionMenuRef.current = element;
                                                  }
                                                }}
                                                className="pointer-events-auto absolute right-full top-1/2 mr-2 flex w-48 -translate-y-1/2 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-slate-600 shadow-lg"
                                              >
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                  Escolha uma reação
                                                </p>
                                                <div className="grid grid-cols-3 gap-1">
                                                  {DEFAULT_REACTION_EMOJIS.map((emoji) => (
                                                    <button
                                                      key={`${reactionMenuMessageId}-${emoji}`}
                                                      type="button"
                                                      onClick={() =>
                                                        reactionMenuMessageId
                                                          ? void handleSendReaction(message, emoji)
                                                          : undefined
                                                      }
                                                      disabled={isSendingReaction}
                                                      className="flex h-10 items-center justify-center rounded-md text-2xl transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                      aria-label={`Reagir com ${emoji}`}
                                                    >
                                                      <span>{emoji}</span>
                                                    </button>
                                                  ))}
                                                </div>
                                                {isSendingReaction && (
                                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Loader className="h-3 w-3 animate-spin" />
                                                    Enviando reação...
                                                  </div>
                                                )}
                                                {reactionError && (
                                                  <p className="text-xs text-red-500">{reactionError}</p>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleReplyToMessage(message)}
                                          className="pointer-events-auto rounded-full bg-white p-1 text-teal-600 shadow-sm transition-colors hover:bg-teal-50"
                                          aria-label="Responder mensagem"
                                        >
                                          <CornerUpRight className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenForwardModal(message)}
                                          className="pointer-events-auto rounded-full bg-white p-1 text-teal-600 shadow-sm transition-colors hover:bg-teal-50"
                                          aria-label="Encaminhar mensagem"
                                        >
                                          <Share2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-3">
                    {composerReplyMessage && (
                      <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2">
                        <div className="border-l-4 border-teal-400 pl-3 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                            Respondendo a {getMessageSenderLabel(composerReplyMessage)}
                          </p>
                          <p className="mt-1 text-sm text-teal-800 whitespace-pre-wrap break-words">
                            {getComposerReplyPreviewText(composerReplyMessage)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelReply}
                          className="ml-2 text-teal-700 transition-colors hover:text-teal-900"
                          aria-label="Cancelar resposta"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={DEFAULT_ATTACHMENT_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={handleAttachmentChange}
                    />
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className="group relative flex min-h-[3.75rem] items-stretch rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-transparent focus-within:ring-2 focus-within:ring-teal-500">
                          <div className="flex items-center gap-2 border-r border-slate-200/70 px-2">
                            <div className="relative">
                              <button
                                ref={aiAssistantButtonRef}
                                type="button"
                                onClick={handleToggleAIAssistantMenu}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSendingMessage}
                                aria-haspopup="menu"
                                aria-expanded={isAIAssistantMenuOpen}
                                aria-label="Assistente de mensagens com IA"
                              >
                                <Sparkles className="h-5 w-5 text-teal-600" />
                              </button>
                              {isAIAssistantMenuOpen && (
                                <div
                                  ref={aiAssistantMenuRef}
                                  className="absolute left-0 z-30 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
                                  role="menu"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase text-slate-500">
                                      Assistente IA
                                    </p>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-600">
                                    Gere sugestões com base na conversa ou melhore a mensagem atual.
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleGenerateAISuggestions()}
                                      disabled={isAIProcessing}
                                      className="inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isGeneratingAISuggestions ? (
                                        <Loader className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-4 w-4" />
                                      )}
                                      <span>Sugerir respostas</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleRewriteComposerMessage()}
                                      disabled={isAIProcessing || !composerTextHasContent}
                                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isRewritingMessage ? (
                                        <Loader className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RefreshCcw className="h-4 w-4" />
                                      )}
                                      <span>Reescrever texto</span>
                                    </button>
                                  </div>
                                  {aiAssistantError && (
                                    <p className="mt-3 text-xs text-red-500">{aiAssistantError}</p>
                                  )}
                                  {isGeneratingAISuggestions && !aiAssistantError && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                      <Loader className="h-3 w-3 animate-spin" />
                                      Gerando sugestões...
                                    </div>
                                  )}
                                  {isRewritingMessage && !aiAssistantError && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                      <Loader className="h-3 w-3 animate-spin" />
                                      Reescrevendo mensagem...
                                    </div>
                                  )}
                                  {aiSuggestions.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      <p className="text-[11px] font-semibold uppercase text-slate-500">
                                        Sugestões
                                      </p>
                                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                        {aiSuggestions.map((suggestion, index) => (
                                          <button
                                            key={`ai-suggestion-${index}`}
                                            type="button"
                                            onClick={() => handleApplyAISuggestion(suggestion)}
                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-teal-300 hover:bg-white"
                                          >
                                            <span className="block whitespace-pre-wrap leading-relaxed">
                                              {suggestion}
                                            </span>
                                            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-teal-600">
                                              <CheckCircle className="h-3 w-3" />
                                              Usar esta sugestão
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="relative">
                              <button
                                ref={quickRepliesButtonRef}
                                type="button"
                                onClick={handleToggleQuickRepliesMenu}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSendingMessage}
                                aria-haspopup="menu"
                                aria-expanded={isQuickRepliesMenuOpen}
                                aria-label="Inserir resposta rápida"
                              >
                                <MessageSquare className="h-5 w-5" />
                              </button>
                              {isQuickRepliesMenuOpen && (
                                <div
                                  ref={quickRepliesMenuRef}
                                  className="absolute left-0 z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
                                  role="menu"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase text-slate-500">
                                      Respostas rápidas
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handleOpenCreateQuickReplyModal}
                                      className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Nova
                                    </button>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <div className="inline-flex items-center rounded-md bg-slate-100 p-1">
                                      <button
                                        type="button"
                                        onClick={() => setQuickRepliesView('all')}
                                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                          quickRepliesView === 'all'
                                            ? 'bg-white text-teal-700 shadow-sm'
                                            : 'text-slate-600 hover:text-teal-600'
                                        }`}
                                        aria-pressed={quickRepliesView === 'all'}
                                      >
                                        Todas
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setQuickRepliesView('favorites')}
                                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                          quickRepliesView === 'favorites'
                                            ? 'bg-white text-teal-700 shadow-sm'
                                            : 'text-slate-600 hover:text-teal-600'
                                        }`}
                                        aria-pressed={quickRepliesView === 'favorites'}
                                      >
                                        Favoritas
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-3 space-y-3">
                                    <input
                                      type="text"
                                      value={quickReplySearchTerm}
                                      onChange={(event) => setQuickReplySearchTerm(event.target.value)}
                                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                      placeholder="Pesquisar por título, conteúdo ou categoria"
                                    />
                                    {quickRepliesError && (
                                      <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-600">
                                        {quickRepliesError}
                                      </div>
                                    )}
                                    {isQuickRepliesLoading ? (
                                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                                        <Loader className="h-4 w-4 animate-spin" />
                                        Carregando...
                                      </div>
                                    ) : groupedQuickReplies.length === 0 ? (
                                      <p className="py-4 text-center text-sm text-slate-500">
                                        {emptyQuickRepliesMessage}
                                      </p>
                                    ) : (
                                      <div className="max-h-60 space-y-4 overflow-y-auto pr-1">
                                        {groupedQuickReplies.map(({ category, replies }) => (
                                          <div key={category} className="space-y-2">
                                            <p className="px-1 text-xs font-semibold uppercase text-slate-500">
                                              {category}
                                            </p>
                                            <div className="space-y-2">
                                              {replies.map((reply) => (
                                                <div
                                                  key={reply.id}
                                                  className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() => handleInsertQuickReply(reply)}
                                                    className="block w-full px-3 py-2 pr-10 text-left text-sm text-slate-700 transition-colors hover:bg-teal-50"
                                                  >
                                                    <p className="font-semibold text-slate-800">{reply.title}</p>
                                                    <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">
                                                      {reply.content}
                                                    </p>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => void handleToggleQuickReplyFavorite(reply)}
                                                    className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                                                      reply.is_favorite
                                                        ? 'text-amber-500 hover:text-amber-600'
                                                        : 'text-slate-400 hover:text-amber-500'
                                                    }`}
                                                    aria-label={
                                                      reply.is_favorite
                                                        ? 'Remover dos favoritos'
                                                        : 'Adicionar aos favoritos'
                                                    }
                                                    aria-pressed={reply.is_favorite}
                                                  >
                                                    {reply.is_favorite ? (
                                                      <Star className="h-4 w-4" fill="currentColor" />
                                                    ) : (
                                                      <StarOff className="h-4 w-4" />
                                                    )}
                                                  </button>
                                                  <div className="flex items-center justify-end gap-1 border-t border-slate-200 bg-slate-50 px-2 py-1.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenEditQuickReplyModal(reply)}
                                                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                    >
                                                      <Edit className="h-3.5 w-3.5" />
                                                      Editar
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteQuickReply(reply)}
                                                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                      Excluir
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="relative">
                              <button
                                ref={attachmentButtonRef}
                                type="button"
                                onClick={handleAttachmentButtonClick}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSendingMessage}
                                aria-haspopup="menu"
                                aria-expanded={isAttachmentMenuOpen}
                                aria-label="Anexar arquivo"
                              >
                                <Paperclip className="h-5 w-5" />
                              </button>
                              {isAttachmentMenuOpen && (
                                <div
                                  ref={attachmentMenuRef}
                                  className="absolute left-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
                                  role="menu"
                                >
                                  <p className="px-1 pb-2 text-xs font-semibold uppercase text-slate-500">
                                    Tipo do envio
                                  </p>
                                  <div className="space-y-1">
                                    {attachmentTypes.map((value) => (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => handleAttachmentTypeSelectForUpload(value)}
                                        className="flex w-full items-center space-x-3 rounded-md px-2 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100"
                                        role="menuitem"
                                      >
                                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
                                          {getAttachmentIcon(value)}
                                        </span>
                                        <span>{attachmentTypeLabels[value]}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {isRecordingSupported && (
                              <button
                                type="button"
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                                  isRecording
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'text-slate-500 hover:bg-slate-100'
                                }`}
                                disabled={isSendingMessage}
                                aria-label={isRecording ? 'Parar gravação' : 'Gravar áudio'}
                              >
                                {isRecording ? (
                                  <>
                                    <span className="absolute inline-flex h-11 w-11 rounded-full bg-red-400/40 opacity-75 animate-ping" />
                                    <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
                                      <Square className="h-4 w-4" />
                                    </span>
                                  </>
                                ) : (
                                  <Mic className="h-5 w-5" />
                                )}
                              </button>
                            )}
                            {isRecording && (
                              <div className="flex h-9 w-24 items-center justify-center gap-[3px] px-1">
                                {recordingLevels.map((level, index) => (
                                  <span
                                    key={`wave-${index}`}
                                    className="w-[3px] rounded-full bg-red-500 transition-[height] duration-100 ease-linear"
                                    style={{ height: `${Math.max(6, level * 32)}px` }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <textarea
                            ref={composerTextareaRef}
                            value={composerText}
                            onChange={(event) => {
                              setComposerText(event.target.value);
                              if (composerError) {
                                setComposerError(null);
                              }
                            }}
                            onKeyDown={handleComposerKeyDown}
                            rows={3}
                            placeholder="Escreva uma mensagem..."
                            className="flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                          />
                          <div className="flex items-center px-2">
                            <button
                              type="button"
                              onClick={() => void handleSendMessage()}
                              disabled={!hasContentToSend || isSendingMessage}
                              className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow transition-colors ${
                                !hasContentToSend || isSendingMessage
                                  ? 'bg-teal-300'
                                  : 'bg-teal-600 hover:bg-teal-700'
                              } disabled:cursor-not-allowed`}
                              aria-label={isSendingMessage ? 'Enviando mensagem' : 'Enviar mensagem'}
                            >
                              {isSendingMessage ? (
                                <Loader className="h-5 w-5 animate-spin" />
                              ) : (
                                <Send className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </div>
                        {!isRecordingSupported && (
                          <div className="mt-2 flex justify-end px-1">
                            <span className="max-w-[220px] text-right text-[11px] text-slate-500">
                              Gravação de áudio não suportada neste navegador.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {attachmentsWithoutRecordedAudio.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">Anexos</p>
                        <p className="text-[11px] text-slate-500">
                          Os envios (arquivos ou localizações) serão enviados com o tipo selecionado no
                          menu de anexos.
                        </p>
                        <div className="space-y-3">
                          {attachmentsWithoutRecordedAudio.map((attachment, index) => {
                            const key = isFileAttachment(attachment)
                              ? `${attachment.file.name}-${attachment.file.size}-${index}`
                              : `location-${attachment.location.latitude}-${attachment.location.longitude}-${index}`;

                            return (
                              <div
                                key={key}
                                className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center space-x-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                                      {getAttachmentIcon(attachment.type)}
                                    </span>
                                    {isFileAttachment(attachment) ? (
                                      <div>
                                        <p className="max-w-[200px] truncate text-sm font-medium text-slate-700">
                                          {attachment.file.name}
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                          {formatFileSize(attachment.file.size)}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium text-slate-700">
                                          {attachment.location.title}
                                        </p>
                                        <p className="text-[11px] text-slate-500 break-words">
                                          {attachment.location.address}
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                          {attachment.location.latitude}, {attachment.location.longitude}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAttachment(index)}
                                    className="text-slate-400 transition-colors hover:text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                                  {renderAttachmentPreview(attachment)}
                                </div>
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs font-semibold uppercase text-slate-500">
                                    Tipo do envio
                                  </span>
                                  <span className="inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 sm:w-auto">
                                    {attachmentTypeLabels[attachment.type]}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {recordedAudio && (
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase text-slate-500">Áudio gravado</p>
                          <button
                            type="button"
                            onClick={discardRecording}
                            className="text-slate-400 transition-colors hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="w-full min-w-[264px] sm:min-w-[344px]">
                          <audio controls src={recordedAudio.url} className="w-full">
                            Seu navegador não suporta reprodução de áudio.
                          </audio>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Ouça o áudio antes de enviar para garantir a qualidade.
                        </p>
                      </div>
                    )}

                    {recordingError && <p className="text-sm text-red-600">{recordingError}</p>}
                    {composerError && <p className="text-sm text-red-600">{composerError}</p>}
                    {composerSuccess && <p className="text-sm text-teal-600">{composerSuccess}</p>}
                  </div>
                </>
              )}
            </div>
            {selectedPhone && isLeadDetailsPanelOpen && (
              <LeadDetailsPanel
                className="bg-white border border-slate-200 rounded-xl h-[600px] w-full xl:w-[340px] xl:flex-none"
                lead={selectedChatLead ?? null}
                statusOptions={activeLeadStatuses}
                responsavelOptions={responsavelOptions}
                onStatusChange={handleLeadStatusChange}
                onResponsavelChange={handleLeadResponsavelChange}
                contracts={selectedLeadContracts}
                contractsLoading={isLoadingLeadContracts}
                contractsError={leadContractsError}
                onRefreshContracts={selectedChatLead ? handleRefreshContracts : undefined}
                disabled={isObserver}
                onViewLead={
                  selectedChatLead
                    ? () => {
                        void handleOpenLeadDetails(selectedChatLead.id);
                      }
                    : undefined
                }
                onEditLead={
                  !isObserver && selectedChatLead
                    ? () => {
                        void handleEditLead(selectedChatLead.id);
                      }
                    : undefined
                }
              />
            )}
            </div>
          </div>
        )}
      </div>
      </div>

      {isStartConversationModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm px-4 py-6">
          <div
            className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={handleCloseStartConversationModal}
              className="absolute right-4 top-4 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar modal de início de conversa"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900">Iniciar conversa</h3>
                <p className="text-sm text-slate-500">
                  Selecione um contato existente ou informe um número de telefone para iniciar uma nova conversa.
                </p>
              </div>

              {startConversationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {startConversationError}
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="start-conversation-search">
                      Buscar contato
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="start-conversation-search"
                        type="text"
                        value={startConversationSearch}
                        onChange={(event) => setStartConversationSearch(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pl-10 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        placeholder="Digite o nome ou número"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50">
                    <div className="max-h-64 overflow-y-auto">
                      {startConversationLoading && startConversationContacts.length === 0 ? (
                        <div className="flex h-40 items-center justify-center text-slate-500">
                          <div className="flex items-center space-x-2 text-sm">
                            <Loader className="h-4 w-4 animate-spin" />
                            <span>Carregando contatos...</span>
                          </div>
                        </div>
                      ) : filteredStartConversationContacts.length === 0 ? (
                        <div className="flex h-40 items-center justify-center px-4 text-center text-slate-500">
                          <p className="text-sm">
                            Nenhum contato encontrado para os filtros informados.
                          </p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-200">
                          {filteredStartConversationContacts.map((contact) => {
                            const normalized = normalizePhoneForChat(contact.phone);
                            const isSelected =
                              startConversationSelectedContact === normalized;
                            const contactName =
                              contact.name ||
                              contact.short ||
                              contact.notify ||
                              contact.vname ||
                              formatPhoneForDisplay(contact.phone);

                            return (
                              <li key={`${contact.phone}-${contactName}`}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectStartConversationContact(contact)}
                                  className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 ${
                                    isSelected ? 'bg-teal-100/60' : 'hover:bg-teal-50'
                                  }`}
                                >
                                  <span className="text-sm font-medium text-slate-800">
                                    {contactName}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatPhoneForDisplay(contact.phone)}
                                  </span>
                                  {contact.notify && (
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-teal-600">
                                      WhatsApp: {contact.notify}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  {startConversationHasMore && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleLoadMoreStartConversationContacts}
                        disabled={startConversationLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {startConversationLoading ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin" />
                            Carregando...
                          </>
                        ) : (
                          'Carregar mais contatos'
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="start-conversation-phone">
                      Número de telefone
                    </label>
                    <input
                      id="start-conversation-phone"
                      type="tel"
                      inputMode="numeric"
                      value={startConversationPhone}
                      onChange={(event) => handleStartConversationPhoneChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleConfirmStartConversation();
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      placeholder="Ex.: 559999999999"
                    />
                  </div>

                  {startConversationSelectedDisplayName && (
                    <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                      Conversa com{' '}
                      <span className="font-semibold">
                        {startConversationSelectedDisplayName}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    Utilize apenas números, incluindo DDD e código do país quando necessário. Exemplo: 559999999999.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseStartConversationModal}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStartConversation}
                  disabled={!normalizePhoneForChat(startConversationPhone)}
                  className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
                >
                  Iniciar conversa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fullscreenMedia && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4 py-6"
          onClick={closeFullscreen}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative bg-black/60 rounded-lg p-4 shadow-xl border border-white/10">
              <button
                type="button"
                onClick={closeFullscreen}
                className="absolute top-3 right-3 text-slate-100 hover:text-white"
                aria-label="Fechar visualização em tela cheia"
              >
                <XCircle className="w-7 h-7" />
              </button>
              {fullscreenMedia.type === 'image' && (
                <img
                  src={fullscreenMedia.url}
                  alt={fullscreenMedia.caption ?? 'Mídia em tela cheia'}
                  className="max-h-[80vh] w-full object-contain rounded-md"
                />
              )}
              {fullscreenMedia.type === 'video' && (
                <video
                  className="w-full max-h-[80vh] rounded-md"
                  controls
                  autoPlay
                  poster={fullscreenMedia.thumbnailUrl ?? undefined}
                >
                  <source src={fullscreenMedia.url} type={fullscreenMedia.mimeType ?? undefined} />
                  Seu navegador não suporta a reprodução de vídeos.
                </video>
              )}
              {fullscreenMedia.type === 'gif' && (
                <video
                  className="w-full max-h-[80vh] rounded-md"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src={fullscreenMedia.url} type={fullscreenMedia.mimeType ?? undefined} />
                  Seu navegador não suporta a reprodução deste GIF.
                </video>
              )}
              {fullscreenMedia.caption && (
                <p className="mt-4 text-sm text-slate-100 text-center whitespace-pre-wrap break-words">
                  {fullscreenMedia.caption}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isQuickReplyModalOpen && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/70 px-4 py-6"
          onClick={handleCloseQuickReplyModal}
        >
          <div
            className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseQuickReplyModal}
              className="absolute top-3 right-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar modal de resposta rápida"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 space-y-2">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingQuickReply ? 'Editar resposta rápida' : 'Nova resposta rápida'}
              </h3>
              <p className="text-sm text-slate-500">
                Defina um título e o conteúdo que será inserido automaticamente no compositor.
              </p>
            </div>
            {quickReplyModalError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {quickReplyModalError}
              </div>
            )}
            <form onSubmit={handleQuickReplyFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="quick-reply-title">
                  Título
                </label>
                <input
                  id="quick-reply-title"
                  type="text"
                  value={quickReplyForm.title}
                  onChange={(event) =>
                    setQuickReplyForm((previous) => ({ ...previous, title: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="Ex.: Boas-vindas"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="quick-reply-content">
                  Conteúdo
                </label>
                <textarea
                  id="quick-reply-content"
                  rows={4}
                  value={quickReplyForm.content}
                  onChange={(event) =>
                    setQuickReplyForm((previous) => ({ ...previous, content: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="Digite a mensagem que será inserida no campo de texto"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="quick-reply-category">
                  Categoria (opcional)
                </label>
                <input
                  id="quick-reply-category"
                  type="text"
                  value={quickReplyForm.category}
                  onChange={(event) =>
                    setQuickReplyForm((previous) => ({
                      ...previous,
                      category: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="Ex.: Follow-up, Boas-vindas"
                  maxLength={80}
                />
                <p className="text-xs text-slate-500">
                  Utilize categorias para organizar e facilitar a busca pelas respostas.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">Favoritar</p>
                  <p className="text-xs text-slate-500">Exibir na aba de favoritas do menu.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600" htmlFor="quick-reply-favorite">
                  <input
                    id="quick-reply-favorite"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    checked={quickReplyForm.is_favorite}
                    onChange={(event) =>
                      setQuickReplyForm((previous) => ({
                        ...previous,
                        is_favorite: event.target.checked,
                      }))
                    }
                  />
                  <span>Marcar como favorita</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseQuickReplyModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickReply}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingQuickReply ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : editingQuickReply ? (
                    'Salvar alterações'
                  ) : (
                    'Criar resposta'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLocationModalOpen && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/70 px-4 py-6"
          onClick={handleCloseLocationModal}
        >
          <div
            className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseLocationModal}
              className="absolute top-3 right-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar modal de localização"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 space-y-2">
              <h3 className="text-lg font-semibold text-slate-800">Enviar localização</h3>
              <p className="text-sm text-slate-500">
                Preencha os dados abaixo para compartilhar a localização atual ou um endereço específico.
              </p>
            </div>
            {locationFormError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {locationFormError}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="location-title">
                  Título
                </label>
                <input
                  id="location-title"
                  type="text"
                  value={locationForm.title}
                  onChange={(event) =>
                    setLocationForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="Ex.: Minha localização"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="location-address">
                  Endereço
                </label>
                <textarea
                  id="location-address"
                  rows={2}
                  value={locationForm.address}
                  onChange={(event) =>
                    setLocationForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="Logradouro, número, bairro, cidade, UF, CEP"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-latitude">
                    Latitude
                  </label>
                  <input
                    id="location-latitude"
                    type="text"
                    value={locationForm.latitude}
                    onChange={(event) =>
                      setLocationForm((prev) => ({ ...prev, latitude: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                    placeholder="Ex.: -23.550520"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="location-longitude">
                    Longitude
                  </label>
                  <input
                    id="location-longitude"
                    type="text"
                    value={locationForm.longitude}
                    onChange={(event) =>
                      setLocationForm((prev) => ({ ...prev, longitude: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                    placeholder="Ex.: -46.633308"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Localização atual</p>
                  <p className="text-xs text-slate-500">
                    Utilize o GPS do navegador para preencher automaticamente latitude e longitude.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isFetchingCurrentLocation}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-500 px-3 py-2 text-sm font-medium text-teal-600 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingCurrentLocation ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Obtendo...
                    </>
                  ) : (
                    <>
                      <Navigation className="h-4 w-4" />
                      Usar localização atual
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseLocationModal}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
              >
                Adicionar à mensagem
              </button>
            </div>
          </div>
        </div>
      )}

      {isForwardModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 px-4 py-6"
          onClick={handleCloseForwardModal}
        >
          <div
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseForwardModal}
              className="absolute top-3 right-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar modal de encaminhamento"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 space-y-1">
              <p className="text-xs font-semibold uppercase text-teal-600">
                Etapa {forwardStep === 'messages' ? '1' : '2'} de 2
              </p>
              <h3 className="text-lg font-semibold text-slate-800">Encaminhar mensagens</h3>
              <p className="text-sm text-slate-500">
                {forwardStep === 'messages'
                  ? 'Selecione as mensagens da conversa que deseja encaminhar.'
                  : 'Escolha os chats de destino para encaminhar as mensagens selecionadas. O envio utilizará um delay padrão de 1 segundo.'}
              </p>
            </div>
            <div className="space-y-5">
              {forwardStep === 'messages' ? (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      Mensagens da conversa
                    </span>
                    <span className="text-xs text-slate-400">
                      {forwardingMessageIds.length > 0
                        ? `${forwardingMessageIds.length} selecionada${
                            forwardingMessageIds.length > 1 ? 's' : ''
                          }`
                        : 'Nenhuma selecionada'}
                    </span>
                  </div>
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {processedSelectedMessages.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Nenhuma mensagem disponível para encaminhamento.
                      </p>
                    ) : (
                      processedSelectedMessages.map((message) => {
                        const messageKey = message.id || message.message_id;
                        if (!messageKey) {
                          return null;
                        }

                        const isChecked = forwardingMessageIds.includes(messageKey);
                        const preview = getComposerReplyPreviewText(message);

                        return (
                          <label
                            key={message.id || message.message_id || message.timestamp}
                            className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                              isChecked
                                ? 'border-teal-500 bg-teal-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-teal-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              checked={isChecked}
                              onChange={(event) =>
                                handleToggleForwardMessageSelection(messageKey, event.target.checked)
                              }
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase text-slate-400">
                                {getMessageSenderLabel(message)}
                              </p>
                              <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                                {preview}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {formatDateLabel(message.timestamp)} às {formatTime(message.timestamp)}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-slate-500">
                        Mensagens selecionadas
                      </span>
                      <button
                        type="button"
                        onClick={handleForwardBackToMessages}
                        className="text-xs font-semibold text-teal-600 transition-colors hover:text-teal-700"
                      >
                        Alterar seleção
                      </button>
                    </div>
                    <div className="mt-2 max-h-36 space-y-2 overflow-y-auto pr-1">
                      {messagesSelectedForForward.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Nenhuma mensagem selecionada.
                        </p>
                      ) : (
                        messagesSelectedForForward.map((message) => {
                          const preview = getComposerReplyPreviewText(message);

                          return (
                            <div
                              key={message.id || message.message_id || message.timestamp}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <p className="text-xs font-semibold uppercase text-slate-400">
                                {getMessageSenderLabel(message)}
                              </p>
                              <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                                {preview}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {formatDateLabel(message.timestamp)} às {formatTime(message.timestamp)}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      Chats de destino
                    </span>
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={forwardChatSearchTerm}
                        onChange={(event) => setForwardChatSearchTerm(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                        placeholder="Pesquisar nome ou número"
                      />
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {forwardChatOptions.length === 0 ? (
                          <p className="py-4 text-center text-sm text-slate-500">
                            Nenhum chat encontrado.
                          </p>
                        ) : (
                          forwardChatOptions.map(({ chat, displayName, photoUrl, phoneDisplay }) => {
                            const isChecked = forwardSelectedTargetPhones.includes(chat.phone);

                            return (
                              <label
                                key={chat.phone}
                                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                  isChecked
                                    ? 'border-teal-500 bg-teal-50 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-teal-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  checked={isChecked}
                                  onChange={(event) =>
                                    handleToggleForwardTarget(chat.phone, event.target.checked)
                                  }
                                />
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-teal-100">
                                    {photoUrl ? (
                                      <img
                                        src={photoUrl}
                                        alt={displayName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Phone className="h-4 w-4 text-teal-600" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                      {displayName}
                                    </p>
                                    <p className="text-xs text-slate-500">{phoneDisplay}</p>
                                  </div>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            {forwardError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {forwardError}
              </div>
            )}
            {forwardStep === 'targets' && forwardSuccess && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {forwardSuccess}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseForwardModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancelar
              </button>
              {forwardStep === 'messages' ? (
                <button
                  type="button"
                  onClick={handleForwardAdvanceToTargets}
                  disabled={forwardingMessageIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Continuar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleForwardBackToMessages}
                    disabled={isForwardingMessage}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmForwardMessage()}
                    disabled={isForwardingMessage}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isForwardingMessage ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Encaminhando...
                      </>
                    ) : (
                      'Encaminhar'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {activeReactionDetails && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/70 px-4 py-6"
          onClick={handleCloseReactionDetails}
        >
          <div
            className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleCloseReactionDetails}
              className="absolute top-3 right-3 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Fechar detalhes das reações"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl leading-none">{activeReactionDetails.summary.emoji}</span>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Reações</h3>
                <p className="text-xs text-slate-500">
                  {activeReactionDetails.summary.reactors.length}{' '}
                  {activeReactionDetails.summary.reactors.length === 1 ? 'pessoa reagiu' : 'pessoas reagiram'}
                </p>
              </div>
            </div>
            <div className="mb-4 rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Mensagem</p>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                {getDisplayTextForMessage(activeReactionDetails.message) || 'Mensagem sem conteúdo'}
              </p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeReactionDetails.summary.reactors.length === 0 ? (
                <p className="text-sm text-slate-500 text-center">Nenhuma reação registrada.</p>
              ) : (
                activeReactionDetails.summary.reactors.map((reactor) => (
                  <div
                    key={`${reactor.name}-${reactor.timestamp}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <span className="text-sm font-medium text-slate-700">{reactor.name}</span>
                    <span className="text-xs text-slate-500">{formatDateTimeFullBR(reactor.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isLeadFormOpen && editingLead && (
        <LeadForm
          lead={editingLead}
          onClose={() => {
            setIsLeadFormOpen(false);
            setEditingLead(null);
          }}
          onSave={() => {
            const leadId = editingLead?.id;
            setIsLeadFormOpen(false);
            setEditingLead(null);
            if (leadId) {
              void handleLeadDataUpdated(leadId);
            }
          }}
        />
      )}

      {activeLeadDetails && (
        <LeadDetails
          lead={activeLeadDetails}
          onClose={() => setActiveLeadDetails(null)}
          onUpdate={() => {
            void handleLeadDataUpdated(activeLeadDetails.id);
          }}
        />
      )}
    </>
  );
}
