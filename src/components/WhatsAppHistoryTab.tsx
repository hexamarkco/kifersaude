import {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase, AIGeneratedMessage, WhatsAppConversation, Lead } from '../lib/supabase';
import { type WhatsAppChatRequestDetail } from '../lib/whatsappService';
import StatusDropdown from './StatusDropdown';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { createAutomaticFollowUps, cancelFollowUps } from '../lib/followUpService';
import {
  MessageCircle,
  Calendar,
  Search,
  Sparkles,
  CheckCircle,
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
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  X,
} from 'lucide-react';
import type { PostgrestError } from '@supabase/supabase-js';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { zapiService, type ZAPIMediaType, type ZAPIGroupMetadata } from '../lib/zapiService';

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

let lameJsLoadPromise: Promise<typeof window.lamejs> | null = null;

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

type AttachmentType = ZAPIMediaType;

interface AttachmentItem {
  file: File;
  type: AttachmentType;
  previewUrl?: string | null;
}

const DEFAULT_ATTACHMENT_ACCEPT = 'application/pdf,image/*,video/*,audio/*';

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

const isGroupWhatsAppJid = (phone?: string | null): boolean => {
  if (!phone) return false;

  const normalized = phone.toLowerCase();
  if (normalized.includes('@g.us') || normalized.includes('-group')) {
    return true;
  }

  const digits = sanitizePhoneDigits(phone);
  return digits.length >= 20;
};

type LeadPreview = Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'status' | 'responsavel'>;

type ChatGroupBase = {
  phone: string;
  messages: WhatsAppConversation[];
  leadId?: string | null;
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

const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return '';
  const withoutSuffix = phone.includes('@') ? phone.split('@')[0] : phone;
  const withoutGroupSuffix = withoutSuffix.replace(/-group$/i, '');
  return withoutGroupSuffix;
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

  const { leadStatuses } = useConfig();
  const { isObserver } = useAuth();
  const activeLeadStatuses = useMemo(
    () => leadStatuses.filter((status) => status.ativo),
    [leadStatuses]
  );

  const [leadsMap, setLeadsMap] = useState<Map<string, LeadPreview>>(new Map());
  const [leadsByPhoneMap, setLeadsByPhoneMap] = useState<Map<string, LeadPreview>>(new Map());
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [externalSelectionContext, setExternalSelectionContext] = useState<WhatsAppChatRequestDetail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [nextAttachmentType, setNextAttachmentType] = useState<AttachmentType | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerSuccess, setComposerSuccess] = useState<string | null>(null);
  const [activeReactionDetails, setActiveReactionDetails] =
    useState<ReactionModalState | null>(null);
  const skipAutoSelectRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<AttachmentItem[]>([]);
  const attachmentButtonRef = useRef<HTMLButtonElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
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
  const [groupMetadataMap, setGroupMetadataMap] = useState<Map<string, ZAPIGroupMetadata>>(new Map());
  const groupMetadataPendingRef = useRef<Set<string>>(new Set());
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTargetMessageRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledChatRef = useRef<string | null>(null);

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

  const releaseAttachmentPreview = useCallback((attachment: AttachmentItem) => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }, []);

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
      .select('id, nome_completo, telefone, status, responsavel')
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
      .select('id, nome_completo, telefone, status, responsavel')
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

  const loadAIMessages = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
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

  useEffect(() => {
    if (activeView === 'ai-messages') {
      loadAIMessages();
    } else {
      loadConversations();
    }
  }, [activeView, loadAIMessages, loadConversations]);

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

  const chatsWithPreferences = useMemo<ChatGroup[]>(() => {
    return chatGroups.map((group) => {
      const preference = chatPreferences.get(group.phone);
      return {
        ...group,
        archived: preference?.archived ?? false,
        pinned: preference?.pinned ?? false,
      };
    });
  }, [chatGroups, chatPreferences]);

  const filteredChats = useMemo(() => {
    const relevantChats = chatsWithPreferences.filter((chat) =>
      chatListFilter === 'archived' ? chat.archived : !chat.archived
    );

    const query = searchQuery.toLowerCase();
    const numericQuery = searchQuery.replace(/\D/g, '');

    const matchesSearch = (chat: ChatGroup) => {
      if (!searchQuery) return true;

      const lead = chat.isGroup
        ? undefined
        : (chat.leadId ? leadsMap.get(chat.leadId) : undefined) ??
          leadsByPhoneMap.get(sanitizePhoneDigits(chat.phone)) ??
          leadsByPhoneMap.get(chat.phone.trim());
      const groupMetadata = chat.isGroup ? getGroupMetadataForPhone(chat.phone) : undefined;
      const sanitizedPhone = sanitizePhoneDigits(chat.phone);
      return (
        chat.phone.toLowerCase().includes(query) ||
        (numericQuery ? sanitizedPhone.includes(numericQuery) : false) ||
        chat.messages.some(message => (message.message_text || '').toLowerCase().includes(query)) ||
        (chat.displayName?.toLowerCase().includes(query) ?? false) ||
        (groupMetadata?.subject ? groupMetadata.subject.toLowerCase().includes(query) : false) ||
        (lead?.nome_completo?.toLowerCase().includes(query) ?? false) ||
        (lead?.telefone?.toLowerCase().includes(query) ?? false)
      );
    };

    const searchedChats = searchQuery
      ? relevantChats.filter(matchesSearch)
      : relevantChats;

    return [...searchedChats].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [chatsWithPreferences, chatListFilter, leadsByPhoneMap, leadsMap, searchQuery]);

  useEffect(() => {
    if (skipAutoSelectRef.current) {
      skipAutoSelectRef.current = false;
      return;
    }

    if (filteredChats.length === 0) {
      return;
    }

    if (!selectedPhone) {
      setSelectedPhone(filteredChats[0].phone);
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

      setSelectedPhone(filteredChats[0].phone);
    }
  }, [externalSelectionContext, filteredChats, selectedPhone]);

  const selectedChat = useMemo(() => {
    if (!selectedPhone) return undefined;
    return chatsWithPreferences.find(group => group.phone === selectedPhone);
  }, [chatsWithPreferences, selectedPhone]);

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
      setSelectedPhone(matchedChat.phone);
    } else if (phone) {
      if (chatListFilter !== 'active') {
        setChatListFilter('active');
      }

      skipAutoSelectRef.current = true;
      setSelectedPhone(phone);
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
      selectedChat.displayName ||
      formatPhoneForDisplay(selectedChat.phone)
    );
  }, [
    externalSelectionContext,
    selectedChat,
    selectedChatLead,
    selectedGroupMetadata,
    selectedPhone,
  ]);

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
        throw error;
      }
    },
    [createAutomaticFollowUps, cancelFollowUps, leadsMap, upsertLeadsIntoMaps]
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
  };

  const attachmentTypes: AttachmentType[] = ['image', 'video', 'audio', 'document'];

  const inferAttachmentType = (file: File): AttachmentType => {
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
      case 'document':
      default:
        return <FileText className="w-4 h-4 text-rose-600" />;
    }
  };

  const renderAttachmentPreview = (attachment: AttachmentItem) => {
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
        <audio controls className="w-full min-w-[240px] sm:min-w-[320px]">
          <source src={attachment.previewUrl} />
          Seu navegador não suporta a reprodução de áudio.
        </audio>
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
      const index = prev.findIndex((attachment) => attachment.file === recordedAudio.file);
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
    setNextAttachmentType(type);
    setIsAttachmentMenuOpen(false);
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
        prev.map((attachment) => `${attachment.file.name}-${attachment.file.size}`)
      );
      const uniqueFiles = filesArray.filter(
        (file) => !existingKeys.has(`${file.name}-${file.size}`)
      );
      const newAttachments = uniqueFiles.map((file) => {
        const resolvedType = selectedType ?? inferAttachmentType(file);
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
        if (recordedAudio && target.file === recordedAudio.file) {
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

    try {
      removeRecordedAudioAttachment();
      setComposerSuccess(null);
      setComposerError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mp3MimeTypes = ['audio/mpeg', 'audio/mp3'];
      const supportedMp3MimeType = mp3MimeTypes.find((type) => {
        return (
          typeof MediaRecorder !== 'undefined' &&
          typeof MediaRecorder.isTypeSupported === 'function' &&
          MediaRecorder.isTypeSupported(type)
        );
      });

      if (!supportedMp3MimeType) {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingError(
          'Seu navegador não suporta gravação de áudio em MP3. Atualize o navegador ou tente utilizar outro dispositivo.'
        );
        return;
      }

      recordingStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMp3MimeType });
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
          const mimeType = supportedMp3MimeType ?? 'audio/mpeg';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const audioUrl = URL.createObjectURL(audioBlob);

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

          const audioFile = new File([audioBlob], `gravacao-${Date.now()}.mp3`, {
            type: mimeType,
          });
          const audioBase64 = await convertBlobToDataUrl(mp3Blob);
          console.log('Áudio gravado convertido para Base64:', audioBase64);

          setRecordedAudio({ blob: mp3Blob, url: audioUrl, file: audioFile, base64: audioBase64 });
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
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingError(null);
    } catch (error) {
      console.error('Erro ao iniciar gravação de áudio:', error);
      setRecordingError('Não foi possível iniciar a gravação. Verifique as permissões do microfone.');
    }
  }, [isRecordingSupported, removeRecordedAudioAttachment]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
  }, []);

  const discardRecording = useCallback(() => {
    removeRecordedAudioAttachment();
    setRecordingError(null);
  }, [removeRecordedAudioAttachment]);

  const attachmentsWithoutRecordedAudio = useMemo(() => {
    if (!recordedAudio) {
      return attachments;
    }
    return attachments.filter((attachment) => attachment.file !== recordedAudio.file);
  }, [attachments, recordedAudio]);

  const hasContentToSend = useMemo(() => {
    return composerText.trim().length > 0 || attachments.length > 0;
  }, [attachments.length, composerText]);

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

      if (textToSend) {
        const textResult = await zapiService.sendTextMessage(selectedPhone, textToSend);
        if (!textResult.success) {
          throw new Error(textResult.error || 'Falha ao enviar mensagem de texto.');
        }
      }

      for (const attachment of attachments) {
        const base64Override =
          recordedAudio && attachment.file === recordedAudio.file ? recordedAudio.base64 : undefined;
        const mediaResult = await zapiService.sendMediaMessage(
          selectedPhone,
          attachment.file,
          attachment.file.name,
          attachment.type,
          undefined,
          base64Override
        );
        if (!mediaResult.success) {
          throw new Error(mediaResult.error || 'Falha ao enviar anexo.');
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
  ]);

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
            <audio
              key={`${message.id}-audio`}
              controls
              src={message.media_url}
              className="w-full min-w-[240px] sm:min-w-[320px]"
            >
              <source src={message.media_url} type={message.media_mime_type || undefined} />
              Seu navegador não suporta a reprodução de áudio.
            </audio>
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

  const handleRefreshChats = async () => {
    setIsRefreshing(true);
    await loadConversations(false);
  };

  const handleToggleArchive = useCallback(async (phone: string) => {
    let previousPref: WhatsAppChatPreference | undefined;
    let nextPref: WhatsAppChatPreference | undefined;

    setChatPreferences((prev) => {
      const next = new Map(prev);
      const current = prev.get(phone);
      previousPref = current;
      const now = new Date().toISOString();
      nextPref = {
        phone_number: phone,
        archived: !(current?.archived ?? false),
        pinned: current?.pinned ?? false,
        created_at: current?.created_at ?? now,
        updated_at: now,
      };
      next.set(phone, nextPref);
      return next;
    });

    if (!nextPref) return;

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
      console.error('Erro ao atualizar arquivamento do chat:', error);
      setChatPreferences((prev) => {
        const next = new Map(prev);
        if (previousPref) {
          next.set(phone, previousPref);
        } else {
          next.delete(phone);
        }
        return next;
      });
    }
  }, []);

  const handleTogglePin = useCallback(async (phone: string) => {
    let previousPref: WhatsAppChatPreference | undefined;
    let nextPref: WhatsAppChatPreference | undefined;

    setChatPreferences((prev) => {
      const next = new Map(prev);
      const current = prev.get(phone);
      previousPref = current;
      const now = new Date().toISOString();
      nextPref = {
        phone_number: phone,
        archived: current?.archived ?? false,
        pinned: !(current?.pinned ?? false),
        created_at: current?.created_at ?? now,
        updated_at: now,
      };
      next.set(phone, nextPref);
      return next;
    });

    if (!nextPref) return;

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
      console.error('Erro ao atualizar fixação do chat:', error);
      setChatPreferences((prev) => {
        const next = new Map(prev);
        if (previousPref) {
          next.set(phone, previousPref);
        } else {
          next.delete(phone);
        }
        return next;
      });
    }
  }, []);

  const selectedChatUnreadCount = useMemo(() => {
    return selectedChat?.unreadCount ?? 0;
  }, [selectedChat]);

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
    if (!selectedPhone || selectedChatUnreadCount === 0) return;

    const markAsRead = async () => {
      try {
        await supabase
          .from('whatsapp_conversations')
          .update({ read_status: true })
          .eq('phone_number', selectedPhone)
          .eq('message_type', 'received')
          .eq('read_status', false);

        setConversations((prev) =>
          prev.map((message) =>
            message.phone_number === selectedPhone && message.message_type === 'received'
              ? { ...message, read_status: true }
              : message
          )
        );
      } catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
      }
    };

    void markAsRead();
  }, [selectedPhone, selectedChatUnreadCount]);

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

        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
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
          <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden h-[600px] flex flex-col">
              <div className="px-4 py-3 bg-white border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Conversas</h3>
                <p className="text-xs text-slate-500">Contatos com mensagens registradas</p>
              </div>

              <div className="flex-1 overflow-y-auto">
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
                    const groupMetadata = chat.isGroup ? getGroupMetadataForPhone(chat.phone) : undefined;
                    const displayName = chat.isGroup
                      ? groupMetadata?.subject || chat.displayName || formatPhoneForDisplay(chat.phone)
                      : lead?.nome_completo || chat.displayName || formatPhoneForDisplay(chat.phone);

                    return (
                      <div
                        key={chat.phone}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedPhone(chat.phone)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedPhone(chat.phone);
                          }
                        }}
                        className={`w-full px-4 py-3 border-b border-slate-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 ${
                          isActive ? 'bg-teal-50' : 'hover:bg-teal-50 bg-transparent'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden">
                            {chat.photoUrl ? (
                              <img
                                src={chat.photoUrl}
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
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-sm font-semibold text-slate-900 truncate">
                                    {displayName}
                                  </h4>
                                  {chat.pinned && <Pin className="w-3 h-3 text-teal-600" />}
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

            <div className="bg-white border border-slate-200 rounded-xl h-[600px] flex flex-col">
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
                      <div className="flex items-center space-x-3">
                        <div className="w-11 h-11 rounded-full bg-teal-500 flex items-center justify-center overflow-hidden border border-teal-300/40">
                          {selectedChat?.photoUrl ? (
                            <img
                              src={selectedChat.photoUrl}
                              alt={selectedChatDisplayName || selectedPhone || 'Contato'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Phone className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="font-semibold text-lg">{selectedChatDisplayName}</h3>
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
                        </div>
                      </div>
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

                              return (
                                <div
                                  key={message.id}
                                  ref={
                                    message.id === scrollTargetMessageId
                                      ? (element) => {
                                          if (element) {
                                            scrollTargetMessageRef.current = element;
                                          }
                                        }
                                      : undefined
                                  }
                                  className={`flex ${
                                    message.message_type === 'sent' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm flex flex-col space-y-2 ${
                                      message.message_type === 'sent'
                                        ? 'bg-teal-500 text-white rounded-br-sm'
                                        : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
                                    }`}
                                  >
                                    {senderLabel && (
                                      <span className={senderLabelClass}>{senderLabel}</span>
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
                                      {message.read_status && message.message_type === 'sent' && (
                                        <span className="font-semibold">Lida</span>
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
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={DEFAULT_ATTACHMENT_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={handleAttachmentChange}
                    />
                    <div className="flex items-start space-x-3">
                      <textarea
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
                        className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <div className="flex flex-col items-end space-y-2">
                        <div className="relative">
                          <button
                            ref={attachmentButtonRef}
                            type="button"
                            onClick={handleAttachmentButtonClick}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                              className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
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
                        {isRecordingSupported ? (
                          <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                              isRecording
                                ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                            disabled={isSendingMessage}
                            aria-label={isRecording ? 'Parar gravação' : 'Gravar áudio'}
                          >
                            {isRecording ? (
                              <>
                                <span className="absolute inline-flex h-12 w-12 rounded-full bg-red-400/40 opacity-75 animate-ping" />
                                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white">
                                  <Square className="h-4 w-4" />
                                </span>
                              </>
                            ) : (
                              <Mic className="h-5 w-5" />
                            )}
                          </button>
                        ) : (
                          <span className="max-w-[160px] text-right text-[11px] text-slate-500">
                            Gravação de áudio não suportada neste navegador.
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleSendMessage()}
                          disabled={!hasContentToSend || isSendingMessage}
                          className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition-colors ${
                            !hasContentToSend || isSendingMessage
                              ? 'bg-teal-300'
                              : 'bg-teal-600 hover:bg-teal-700'
                          }`}
                        >
                          <Send className="h-4 w-4" />
                          <span>{isSendingMessage ? 'Enviando...' : 'Enviar'}</span>
                        </button>
                      </div>
                    </div>

                    {attachmentsWithoutRecordedAudio.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Anexos
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Os arquivos serão enviados com o tipo selecionado no menu de anexos.
                        </p>
                        <div className="space-y-3">
                          {attachmentsWithoutRecordedAudio.map((attachment, index) => {
                            const { file, type } = attachment;
                            return (
                              <div
                                key={`${file.name}-${file.size}-${index}`}
                                className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center space-x-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                                      {getAttachmentIcon(type)}
                                    </span>
                                    <div>
                                      <p className="max-w-[200px] truncate text-sm font-medium text-slate-700">
                                        {file.name}
                                      </p>
                                      <p className="text-[11px] text-slate-500">{formatFileSize(file.size)}</p>
                                    </div>
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
                                    Tipo do arquivo
                                  </span>
                                  <span className="inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 sm:w-auto">
                                    {attachmentTypeLabels[type]}
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
                        <audio
                          controls
                          src={recordedAudio.url}
                          className="w-full min-w-[240px] sm:min-w-[320px]"
                        >
                          Seu navegador não suporta reprodução de áudio.
                        </audio>
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
          </div>
        )}
      </div>
      </div>

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
    </>
  );
}
