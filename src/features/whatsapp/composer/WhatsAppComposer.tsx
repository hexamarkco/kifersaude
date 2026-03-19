import { memo, startTransition, useDeferredValue, useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  MapPin,
  Smile,
  Search,
  MoreVertical,
  X,
  Image as ImageIcon,
  File as FileIcon,
  StopCircle,
  Sparkles,
  Scissors,
  MessageSquare,
  Clock3,
  Hand,
  Leaf,
  UtensilsCrossed,
  PartyPopper,
  Plane,
  Lightbulb,
  Heart,
  Flag,
  type LucideIcon,
} from 'lucide-react';
import {
  sendWhatsAppMessage,
  sendMediaMessage,
  sendTypingState,
  sendRecordingState,
  normalizeChatId,
  getWhatsAppChatKind,
} from '../../../lib/whatsappApiService';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import ModalShell from '../../../components/ui/ModalShell';
import VariableAutocompleteTextarea from '../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS, type TemplateVariableSuggestion } from '../../../lib/templateVariableSuggestions';
import { ComposerContextBanner } from './components/ComposerContextBanner';
import { GiphyPickerModal } from './components/GiphyPickerModal';
import { InlineLinkPreviewCard } from './components/InlineLinkPreviewCard';
import { searchGiphyLibrary } from './giphy';
import type {
  EmojiCategoryId,
  EmojiEntry,
  GiphyGifItem,
  IndexedQuickReplyItem,
  MessageInputProps,
  QuickReplyItem,
  SentMessagePayload,
} from './types';
import { EMOJI_CATEGORIES_DATA } from './emojiData';
import {
  buildIndexedQuickReplies,
  buildLinkPreviewRetryPayload,
  buildQuickReplyPreviewItems,
  buildSlashCommandState,
  buildTextRetryPayload,
  filterQuickReplies,
  splitFollowUpLines,
  splitRewriteChunks,
} from './utils';

const EMOJI_RECENTS_STORAGE_KEY = 'whatsapp.composer.recent-emojis';
const MAX_RECENT_EMOJIS = 24;
type EmojiCategoryConfig = {
  id: Exclude<EmojiCategoryId, 'recent'>;
  label: string;
  nativeLabel: string;
  icon: LucideIcon;
  emojis: EmojiEntry[];
};

const normalizeEmojiSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

const EMOJI_CATEGORY_ICONS: Record<Exclude<EmojiCategoryId, 'recent'>, LucideIcon> = {
  smileys: Smile,
  people: Hand,
  animals: Leaf,
  food: UtensilsCrossed,
  activities: PartyPopper,
  travel: Plane,
  objects: Lightbulb,
  symbols: Heart,
  flags: Flag,
};

const EMOJI_CATEGORIES: EmojiCategoryConfig[] = EMOJI_CATEGORIES_DATA.map((category) => ({
  ...category,
  icon: EMOJI_CATEGORY_ICONS[category.id],
}));

function WhatsAppComposerComponent({
  chatId,
  onMessageSent,
  contacts = [],
  templateVariables = {},
  templateVariableShortcuts = [],
  replyToMessage,
  onCancelReply,
  editMessage,
  onCancelEdit,
  followUpContext,
  onPrepareFollowUpContext,
}: MessageInputProps) {
  const createClientMessageId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const [messageDraftSnapshot, setMessageDraftSnapshot] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioPreviewBlob, setAudioPreviewBlob] = useState<Blob | null>(null);
  const [audioPreviewDuration, setAudioPreviewDuration] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedGif, setSelectedGif] = useState<GiphyGifItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<EmojiCategoryId>('recent');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [showComposerActionsMenu, setShowComposerActionsMenu] = useState(false);
  const [renderComposerActionsMenu, setRenderComposerActionsMenu] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [quickReplyTitle, setQuickReplyTitle] = useState('');
  const [quickReplyMessage, setQuickReplyMessage] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(false);
  const [slashQuickReplyIndex, setSlashQuickReplyIndex] = useState(0);
  const [showRewriteModal, setShowRewriteModal] = useState(false);
  const [rewriteTone, setRewriteTone] = useState('claro');
  const [rewriteOriginal, setRewriteOriginal] = useState('');
  const [rewriteResult, setRewriteResult] = useState('');
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpSuggestions, setFollowUpSuggestions] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpProvider, setFollowUpProvider] = useState('');
  const [followUpModel, setFollowUpModel] = useState('');
  const [linkPreviewUrl, setLinkPreviewUrl] = useState<string | null>(null);
  const [linkPreviewDismissedUrl, setLinkPreviewDismissedUrl] = useState<string | null>(null);
  const [linkPreviewTitle, setLinkPreviewTitle] = useState('');
  const [linkPreviewDescription, setLinkPreviewDescription] = useState('');
  const [linkPreviewCanonical, setLinkPreviewCanonical] = useState('');
  const [linkPreviewImage, setLinkPreviewImage] = useState('');
  const [linkPreviewSiteName, setLinkPreviewSiteName] = useState('');
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewError, setLinkPreviewError] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<GiphyGifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSignalAtRef = useRef(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sendMessageFrameRef = useRef<number | null>(null);
  const messageDraftSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessageDraftStateRef = useRef<string | null>(null);
  const textareaResizeFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const followUpRequestIdRef = useRef(0);
  const linkPreviewRequestIdRef = useRef(0);
  const gifSearchRequestIdRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageDraftRef = useRef('');
  const rewriteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const composerActionsMenuRef = useRef<HTMLDivElement>(null);
  const shouldRestoreComposerFocusRef = useRef(false);
  const rewriteTones = [
    { value: 'claro', label: 'Claro e correto' },
    { value: 'formal', label: 'Formal' },
    { value: 'amigavel', label: 'Amigavel' },
    { value: 'curto', label: 'Curto e direto' },
    { value: 'persuasivo', label: 'Persuasivo' },
  ];
  const normalizedEmojiSearch = useMemo(() => normalizeEmojiSearch(emojiSearch), [emojiSearch]);
  const emojiTabs = useMemo(
    () => [
      {
        id: 'recent' as const,
        label: 'Mais usados',
        nativeLabel: 'Recentes',
        icon: Clock3,
        emojis: recentEmojis.map((emoji) => ({ value: emoji, keywords: [emoji, 'recente', 'mais usado'] })),
      },
      ...EMOJI_CATEGORIES,
    ],
    [recentEmojis],
  );
  const activeEmojiTab = emojiTabs.find((tab) => tab.id === activeEmojiCategory) ?? emojiTabs[0];
  const emojiSearchResults = useMemo(() => {
    if (!normalizedEmojiSearch) return activeEmojiTab.emojis;

    const seen = new Set<string>();

    return emojiTabs.flatMap((tab) =>
      tab.emojis.filter((entry) => {
        if (seen.has(entry.value)) return false;
        const matches = entry.keywords.some((keyword) => normalizeEmojiSearch(keyword).includes(normalizedEmojiSearch));
        if (matches) {
          seen.add(entry.value);
        }
        return matches;
      }),
    );
  }, [activeEmojiTab.emojis, emojiTabs, normalizedEmojiSearch]);

  const normalizedTemplateVariables = useMemo(() => {
    const normalized = new Map<string, string>();
    Object.entries(templateVariables).forEach(([key, value]) => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      normalized.set(key.toLowerCase(), trimmed);
    });
    return normalized;
  }, [templateVariables]);

  const quickReplyVariableSuggestions = useMemo<TemplateVariableSuggestion[]>(() => {
    const suggestions = new Map<string, TemplateVariableSuggestion>();

    WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS.forEach((item) => {
      suggestions.set(item.key, item);
    });

    templateVariableShortcuts.forEach((shortcut) => {
      if (!suggestions.has(shortcut.key)) {
        suggestions.set(shortcut.key, {
          key: shortcut.key,
          label: shortcut.label,
          description: `Insere a variavel ${shortcut.label.toLowerCase()} no texto.`,
        });
      }
    });

    normalizedTemplateVariables.forEach((value, key) => {
      if (!suggestions.has(key)) {
        suggestions.set(key, {
          key,
          label: key.replace(/_/g, ' '),
          description: `Usa o valor atual de ${value}.`,
        });
      }
    });

    return Array.from(suggestions.values());
  }, [normalizedTemplateVariables, templateVariableShortcuts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(EMOJI_RECENTS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentEmojis(parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_EMOJIS));
      }
    } catch (error) {
      console.warn('Erro ao carregar emojis recentes:', error);
    }
  }, []);

  const getRuntimeTemplateVariable = (key: string) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedTemplateVariables.has(normalizedKey)) {
      return normalizedTemplateVariables.get(normalizedKey) || '';
    }

    const now = new Date();
    if (normalizedKey === 'data_hoje') {
      return now.toLocaleDateString('pt-BR');
    }

    if (normalizedKey === 'hora_agora') {
      return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    return '';
  };

  const applyTemplateVariables = (text: string) =>
    text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, token) => {
      const resolved = getRuntimeTemplateVariable(token);
      return resolved || full;
    });

  const extractFirstUrl = (text: string) => text.match(/https?:\/\/\S+/i)?.[0] || null;

  const normalizePreviewUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(candidate).toString();
    } catch {
      return candidate;
    }
  };

  const getUrlHostname = (value: string) => {
    try {
      return new URL(value).hostname.replace(/^www\./i, '');
    } catch {
      return value.replace(/^https?:\/\//i, '').split('/')[0] || value;
    }
  };

  const clearLinkPreviewDraft = () => {
    setLinkPreviewUrl(null);
    setLinkPreviewTitle('');
    setLinkPreviewDescription('');
    setLinkPreviewCanonical('');
    setLinkPreviewImage('');
    setLinkPreviewSiteName('');
    setLinkPreviewError(null);
    setLinkPreviewLoading(false);
  };

  const fetchLinkPreviewMetadata = async (rawUrl: string) => {
    const normalizedUrl = normalizePreviewUrl(rawUrl);
    if (!normalizedUrl) return;

    const requestId = Date.now();
    linkPreviewRequestIdRef.current = requestId;
    setLinkPreviewUrl(normalizedUrl);
    setLinkPreviewLoading(true);
    setLinkPreviewError(null);

    try {
      const { data, error } = await supabase.functions.invoke('link-preview-metadata', {
        body: { url: normalizedUrl },
      });

      if (error) {
        throw new Error(error.message || 'Não foi possível carregar metadados do link.');
      }

      const metadata = (data || {}) as {
        url?: string;
        title?: string;
        description?: string;
        canonical?: string;
        image?: string;
        siteName?: string;
      };

      const resolvedUrl = normalizePreviewUrl(metadata.canonical || metadata.url || normalizedUrl);
      const hostname = getUrlHostname(resolvedUrl);
      const resolvedTitle = (metadata.title || '').trim() || hostname;
      if (linkPreviewRequestIdRef.current !== requestId) return;

      setLinkPreviewUrl(normalizedUrl);
      setLinkPreviewCanonical(resolvedUrl);
      setLinkPreviewTitle(resolvedTitle);
      setLinkPreviewDescription((metadata.description || '').trim());
      setLinkPreviewImage((metadata.image || '').trim());
      setLinkPreviewSiteName((metadata.siteName || '').trim());
    } catch (error) {
      console.error('Erro ao buscar metadados do link:', error);
      const normalizedUrlForFallback = normalizePreviewUrl(rawUrl);
      const hostname = getUrlHostname(normalizedUrlForFallback);
      if (linkPreviewRequestIdRef.current !== requestId) return;

      setLinkPreviewUrl(normalizedUrlForFallback);
      setLinkPreviewCanonical(normalizedUrlForFallback);
      setLinkPreviewTitle((prev) => prev.trim() || hostname);
      setLinkPreviewError('Preview não disponível para este link.');
    } finally {
      if (linkPreviewRequestIdRef.current === requestId) {
        setLinkPreviewLoading(false);
      }
    }
  };

  const deferredMessage = useDeferredValue(messageDraftSnapshot);
  const deferredQuickReplySearch = useDeferredValue(quickReplySearch);
  const deferredRewriteResult = useDeferredValue(rewriteResult);
  const deferredFollowUpDraft = useDeferredValue(followUpDraft);

  const flushMessageDraftSnapshot = (nextValue: string) => {
    pendingMessageDraftStateRef.current = null;
    setMessageDraftSnapshot((currentValue) => (currentValue === nextValue ? currentValue : nextValue));
  };

  const syncComposerTextareaValue = (nextValue: string, options?: { deferSnapshot?: boolean }) => {
    messageDraftRef.current = nextValue;

    const textarea = textareaRef.current;
    if (textarea && textarea.value !== nextValue) {
      textarea.value = nextValue;
    }

    if (messageDraftSyncTimeoutRef.current) {
      clearTimeout(messageDraftSyncTimeoutRef.current);
      messageDraftSyncTimeoutRef.current = null;
    }

    if (options?.deferSnapshot) {
      pendingMessageDraftStateRef.current = nextValue;
      messageDraftSyncTimeoutRef.current = setTimeout(() => {
        messageDraftSyncTimeoutRef.current = null;
        const queuedValue = pendingMessageDraftStateRef.current;
        if (queuedValue === null) {
          return;
        }
        startTransition(() => {
          flushMessageDraftSnapshot(queuedValue);
        });
      }, 80);
      return;
    }

    startTransition(() => {
      flushMessageDraftSnapshot(nextValue);
    });
  };

  const updateComposerDraft = (nextValue: string, options?: { deferSnapshot?: boolean }) => {
    syncComposerTextareaValue(nextValue, options);
    scheduleTextareaResize();
  };

  const emitMessageSent = (message?: SentMessagePayload) => {
    if (!onMessageSent) return;

    startTransition(() => {
      onMessageSent(message);
    });
  };

  const detectedPreviewUrl = useMemo(() => {
    if (selectedFile || selectedGif) return null;
    const resolvedMessage = applyTemplateVariables(deferredMessage.trim());
    const firstUrl = extractFirstUrl(resolvedMessage);
    return firstUrl ? normalizePreviewUrl(firstUrl) : null;
  }, [deferredMessage, selectedFile, selectedGif, templateVariables]);

  const shouldShowInlineLinkPreview = Boolean(
    detectedPreviewUrl && linkPreviewDismissedUrl !== detectedPreviewUrl && (linkPreviewCanonical || linkPreviewLoading || linkPreviewError),
  );

  const applyInlineFormat = (opening: string, closing: string = opening) => {
    const currentMessage = messageDraftRef.current;
    const textarea = textareaRef.current;
    if (!textarea) {
      updateComposerDraft(`${currentMessage}${opening}${closing}`);
      return;
    }

    const start = textarea.selectionStart ?? currentMessage.length;
    const end = textarea.selectionEnd ?? currentMessage.length;
    const selectedText = currentMessage.slice(start, end);
    const hasSelection = start !== end;

    const replacement = `${opening}${selectedText}${closing}`;
    const nextMessage = `${currentMessage.slice(0, start)}${replacement}${currentMessage.slice(end)}`;
    updateComposerDraft(nextMessage);

    requestAnimationFrame(() => {
      textarea.focus();
      if (hasSelection) {
        const selectionStart = start + opening.length;
        const selectionEnd = selectionStart + selectedText.length;
        textarea.setSelectionRange(selectionStart, selectionEnd);
        return;
      }

      const cursorPosition = start + opening.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });

    handleTyping();
  };

  const insertTemplateTokenOnQuickReply = (key: string) => {
    const token = `{{${key}}}`;
    setQuickReplyMessage((prev) => `${prev}${token}`);
  };

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    const source = contacts.filter((contact) => contact.saved);
    if (!query) return source;
    return source.filter((contact) => (contact.name || contact.id).toLowerCase().includes(query));
  }, [contacts, contactSearch]);

  const indexedQuickReplies = useMemo<IndexedQuickReplyItem[]>(
    () => buildIndexedQuickReplies(quickReplies),
    [quickReplies],
  );

  const filteredQuickReplies = useMemo(() => {
    return filterQuickReplies(indexedQuickReplies, deferredQuickReplySearch);
  }, [deferredQuickReplySearch, indexedQuickReplies]);

  const quickReplyPreviewItems = useMemo(() => {
    return buildQuickReplyPreviewItems(filteredQuickReplies, applyTemplateVariables, showQuickReplies);
  }, [applyTemplateVariables, filteredQuickReplies, showQuickReplies]);

  const slashCommandState = useMemo(() => {
    return buildSlashCommandState(deferredMessage, indexedQuickReplies);
  }, [deferredMessage, indexedQuickReplies]);

  useEffect(() => {
    if (!detectedPreviewUrl) {
      linkPreviewRequestIdRef.current = 0;
      clearLinkPreviewDraft();
      setLinkPreviewDismissedUrl(null);
      return;
    }

    if (linkPreviewDismissedUrl === detectedPreviewUrl) {
      return;
    }

    if (linkPreviewUrl === detectedPreviewUrl) {
      return;
    }

    setLinkPreviewCanonical(detectedPreviewUrl);
    setLinkPreviewTitle(getUrlHostname(detectedPreviewUrl));
    setLinkPreviewDescription('');
    setLinkPreviewImage('');
    setLinkPreviewSiteName('');
    void fetchLinkPreviewMetadata(detectedPreviewUrl);
  }, [detectedPreviewUrl, linkPreviewDismissedUrl, linkPreviewUrl]);

  useEffect(() => {
    clearLinkPreviewDraft();
    setLinkPreviewDismissedUrl(null);
  }, [chatId]);

  useEffect(() => {
    if (!showGifPicker) return;

    const requestId = gifSearchRequestIdRef.current + 1;
    gifSearchRequestIdRef.current = requestId;
    const timeoutId = window.setTimeout(async () => {
      setGifLoading(true);
      setGifError(null);

      try {
        const nextResults = await searchGiphyLibrary(gifSearch, 24);
        if (gifSearchRequestIdRef.current !== requestId) return;
        setGifResults(nextResults);
      } catch (error) {
        if (gifSearchRequestIdRef.current !== requestId) return;
        console.error('Erro ao carregar GIFs do Giphy:', error);
        setGifResults([]);
        setGifError(error instanceof Error ? error.message : 'Nao foi possivel carregar GIFs do Giphy.');
      } finally {
        if (gifSearchRequestIdRef.current === requestId) {
          setGifLoading(false);
        }
      }
    }, gifSearch.trim() ? 260 : 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gifSearch, showGifPicker]);

  const selectedSlashQuickReply = slashCommandState.results[slashQuickReplyIndex] ?? null;
  const isDirectChat = getWhatsAppChatKind(chatId) === 'direct';

  useEffect(() => {
    if (!slashCommandState.active || slashCommandState.results.length === 0) {
      if (slashQuickReplyIndex !== 0) setSlashQuickReplyIndex(0);
      return;
    }

    if (slashQuickReplyIndex >= slashCommandState.results.length) {
      setSlashQuickReplyIndex(0);
    }
  }, [slashCommandState.active, slashCommandState.results.length, slashQuickReplyIndex]);

  useEffect(() => {
    let cancelled = false;

    const normalizeQuickReply = (value: unknown): QuickReplyItem | null => {
      const row = value as {
        id?: string;
        title?: string | null;
        text?: string | null;
        message?: string | null;
      };

      const id = typeof row.id === 'string' && row.id.trim() ? row.id : '';
      if (!id) return null;

      const message = typeof row.text === 'string'
        ? row.text.trim()
        : typeof row.message === 'string'
          ? row.message.trim()
          : '';
      if (!message) return null;

      const titleRaw = typeof row.title === 'string' ? row.title.trim() : '';
      return {
        id,
        title: titleRaw || 'Resposta rápida',
        message,
      };
    };

    const loadQuickReplies = async () => {
      setQuickRepliesLoading(true);

      try {
        const { data, error } = await supabase
          .from('whatsapp_quick_replies')
          .select('id, title, text, updated_at')
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }

        const fromDatabase = (Array.isArray(data) ? data : [])
          .map(normalizeQuickReply)
          .filter((reply): reply is QuickReplyItem => Boolean(reply));

        if (!cancelled) {
          setQuickReplies(fromDatabase);
        }

        const stored = localStorage.getItem('whatsapp_quick_replies');
        if (!stored) return;

        const parsed = JSON.parse(stored) as unknown;
        const legacyReplies = (Array.isArray(parsed) ? parsed : [])
          .map(normalizeQuickReply)
          .filter((reply): reply is QuickReplyItem => Boolean(reply));

        if (legacyReplies.length === 0) {
          localStorage.removeItem('whatsapp_quick_replies');
          return;
        }

        if (fromDatabase.length > 0) {
          localStorage.removeItem('whatsapp_quick_replies');
          return;
        }

        const payload = legacyReplies.map((reply) => ({
          title: reply.title,
          text: reply.message,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('whatsapp_quick_replies')
          .insert(payload)
          .select('id, title, text, updated_at')
          .order('updated_at', { ascending: false });

        if (insertError) {
          throw insertError;
        }

        const migrated = (Array.isArray(inserted) ? inserted : [])
          .map(normalizeQuickReply)
          .filter((reply): reply is QuickReplyItem => Boolean(reply));

        if (!cancelled && migrated.length > 0) {
          setQuickReplies(migrated);
        }

        localStorage.removeItem('whatsapp_quick_replies');
      } catch (error) {
        console.error('Erro ao carregar respostas rápidas globais:', error);

        const stored = localStorage.getItem('whatsapp_quick_replies');
        if (!stored || cancelled) return;

        try {
          const parsed = JSON.parse(stored) as unknown;
          const fallbackReplies = (Array.isArray(parsed) ? parsed : [])
            .map(normalizeQuickReply)
            .filter((reply): reply is QuickReplyItem => Boolean(reply));
          setQuickReplies(fallbackReplies);
        } catch {
          setQuickReplies([]);
        }
      } finally {
        if (!cancelled) {
          setQuickRepliesLoading(false);
        }
      }
    };

    loadQuickReplies();

    return () => {
      cancelled = true;
    };
  }, []);

  const rewriteChunks = useMemo(
    () => splitRewriteChunks(deferredRewriteResult || rewriteOriginal),
    [deferredRewriteResult, rewriteOriginal],
  );
  const followUpMessages = useMemo(
    () => splitFollowUpLines(deferredFollowUpDraft),
    [deferredFollowUpDraft],
  );

  const resolveOutgoingFileMessageType = (file: File): 'image' | 'sticker' | 'video' | 'audio' | 'document' => {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    if (mimeType === 'image/webp' || mimeType === 'application/webp' || fileName.endsWith('.webp')) return 'sticker';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const resolveSelectedGifPreviewUrl = (gif: GiphyGifItem | null) => {
    if (!gif) return '';
    return gif.previewUrl || gif.stillUrl || gif.gifUrl || gif.mp4Url || '';
  };

  const resolveSelectedGifSendUrl = (gif: GiphyGifItem | null) => {
    if (!gif) return '';
    return gif.mp4Url || '';
  };

  const buildGifPayloadOverride = (gif: GiphyGifItem, response: unknown) => {
    const preview = resolveSelectedGifPreviewUrl(gif);
    const sendUrl = resolveSelectedGifSendUrl(gif);
    const animationUrl = gif.gifUrl || preview || sendUrl;
    const fileNameBase = `giphy-${gif.id}`;
    const responsePayload = response && typeof response === 'object' ? (response as Record<string, unknown>) : {};

    return {
      ...responsePayload,
      gif: {
        url: animationUrl,
        link: sendUrl,
        preview,
        filename: `${fileNameBase}.gif`,
        name: gif.title || 'GIF',
        mime_type: 'image/gif',
      },
      media: {
        url: animationUrl,
        link: sendUrl,
        preview,
        filename: `${fileNameBase}.gif`,
        name: gif.title || 'GIF',
        mime_type: 'image/gif',
      },
      video: gif.mp4Url
        ? {
            link: gif.mp4Url,
            preview,
            filename: `${fileNameBase}.mp4`,
            name: gif.title || 'GIF',
            mime_type: 'video/mp4',
          }
        : undefined,
      source: 'giphy',
      source_url: gif.pageUrl,
    } as Record<string, unknown>;
  };

  const extractDirectPhoneNumber = (normalizedChatId: string): string | null => {
    const trimmed = normalizedChatId.trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase().endsWith('@lid')) return null;
    const withoutSuffix = trimmed.replace(/@c\.us$|@s\.whatsapp\.net$/i, '');
    const digits = withoutSuffix.replace(/\D/g, '');
    return digits || null;
  };

  const extractChatLid = (normalizedChatId: string): string | null => {
    const trimmed = normalizedChatId.trim();
    if (!trimmed) return null;
    return trimmed.toLowerCase().endsWith('@lid') ? trimmed : null;
  };

  const ensureOutboundChatExists = async (normalizedChatId: string, sentAt: string, lastMessage?: string | null) => {
    const chatKind = getWhatsAppChatKind(normalizedChatId);
    const isGroup = chatKind === 'group';
    const normalizedPreview = typeof lastMessage === 'string' && lastMessage.trim() ? lastMessage.trim() : null;

    const { error } = await supabase.from('whatsapp_chats').upsert(
      {
        id: normalizedChatId,
        is_group: isGroup,
        phone_number: chatKind === 'direct' ? extractDirectPhoneNumber(normalizedChatId) : null,
        lid: chatKind === 'direct' ? extractChatLid(normalizedChatId) : null,
        last_message: normalizedPreview,
        last_message_direction: normalizedPreview ? 'outbound' : null,
        last_message_at: sentAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (error) {
      console.warn('Erro ao garantir chat antes de salvar mensagem:', error);
    }
  };

  const persistOutboundMessage = async (params: {
    response: unknown;
    chatId: string;
    type: string;
    body: string;
    hasMedia: boolean;
    sentAt: string;
    payloadOverride?: Record<string, unknown> | null;
  }): Promise<{ normalizedChatId: string; messageId: string; persistedMessageId: string | null }> => {
    const { response, chatId: rawChatId, type, body, hasMedia, sentAt, payloadOverride } = params;
    const normalizedChatId = normalizeChatId(rawChatId);
    await ensureOutboundChatExists(normalizedChatId, sentAt, body);

    const responsePayload = response && typeof response === 'object'
      ? (response as Record<string, unknown>)
      : null;

    const extractResponseMessageId = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed || null;
    };

    const nestedMessageId =
      responsePayload?.message && typeof responsePayload.message === 'object'
        ? extractResponseMessageId((responsePayload.message as Record<string, unknown>).id)
        : null;

    const firstArrayMessageId =
      Array.isArray(responsePayload?.messages) &&
      responsePayload.messages.length > 0 &&
      responsePayload.messages[0] &&
      typeof responsePayload.messages[0] === 'object'
        ? extractResponseMessageId((responsePayload.messages[0] as Record<string, unknown>).id)
        : null;

    const persistedMessageId =
      extractResponseMessageId(responsePayload?.id) || nestedMessageId || firstArrayMessageId;
    const messageId = persistedMessageId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const payloadToPersist = payloadOverride ?? responsePayload;

    if (persistedMessageId) {
      const { error: insertError } = await supabase.from('whatsapp_messages').upsert({
        id: persistedMessageId,
        chat_id: normalizedChatId,
        from_number: null,
        to_number: normalizedChatId,
        type,
        body,
        has_media: hasMedia,
        timestamp: sentAt,
        direction: 'outbound',
        payload: payloadToPersist,
      });

      if (insertError) {
        console.warn('Erro ao salvar mensagem no banco:', insertError);
      }
    } else {
      console.warn('Resposta sem ID da mensagem; salvando apenas no estado local até sincronizar.', response);
    }

    return { normalizedChatId, messageId, persistedMessageId };
  };

  const sendPlainTextMessage = async (text: string, targetChatId: string = chatId) => {
    const resolvedText = applyTemplateVariables(text).trim() || text.trim();
    const localRef = createClientMessageId();
    const sentAt = new Date().toISOString();
    const normalizedChatId = normalizeChatId(targetChatId);
    const retryPayload = buildTextRetryPayload(resolvedText, replyToMessage?.id ?? null);

    emitMessageSent({
      id: localRef,
      local_ref: localRef,
      chat_id: normalizedChatId,
      body: resolvedText,
      type: 'text',
      has_media: false,
      timestamp: sentAt,
      direction: 'outbound',
      created_at: sentAt,
      ack_status: 1,
      send_state: 'pending',
      error_message: null,
      retry_payload: retryPayload,
    });

    try {
      const response = await sendWhatsAppMessage({
        chatId: targetChatId,
        contentType: 'string',
        content: resolvedText,
        quotedMessageId: replyToMessage?.id,
      });

      const { normalizedChatId: persistedChatId, messageId } = await persistOutboundMessage({
        response,
        chatId: targetChatId,
        type: 'text',
        body: resolvedText,
        hasMedia: false,
        sentAt,
      });

      const textPayload: SentMessagePayload = {
        id: messageId,
        local_ref: localRef,
        chat_id: persistedChatId,
        body: resolvedText,
        type: 'text',
        has_media: false,
        timestamp: sentAt,
        direction: 'outbound',
        created_at: sentAt,
        ack_status: 2,
        send_state: null,
        error_message: null,
        retry_payload: null,
        payload: response,
      };

      emitMessageSent(textPayload);
      return textPayload;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      emitMessageSent({
        id: localRef,
        local_ref: localRef,
        chat_id: normalizedChatId,
        body: resolvedText,
        type: 'text',
        has_media: false,
        timestamp: sentAt,
        direction: 'outbound',
        created_at: sentAt,
        ack_status: 0,
        send_state: 'failed',
        error_message: errorMessage,
        retry_payload: retryPayload,
      });
      throw error;
    }
  };

  useEffect(() => {
    if (editMessage) {
      updateComposerDraft(editMessage.body);
    }
  }, [editMessage]);

  useEffect(() => {
    followUpRequestIdRef.current += 1;
    shouldRestoreComposerFocusRef.current = false;
    setShowFollowUpModal(false);
    setFollowUpDraft('');
    setFollowUpSuggestions('');
    setFollowUpLoading(false);
    setFollowUpError(null);
    setFollowUpProvider('');
    setFollowUpModel('');
  }, [chatId]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sendMessageFrameRef.current) {
        cancelAnimationFrame(sendMessageFrameRef.current);
      }
      if (messageDraftSyncTimeoutRef.current) {
        clearTimeout(messageDraftSyncTimeoutRef.current);
      }
      if (textareaResizeFrameRef.current) {
        cancelAnimationFrame(textareaResizeFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [previewUrl, audioPreviewUrl]);

  useEffect(() => {
    lastTypingSignalAtRef.current = 0;
  }, [chatId]);

  const scheduleTextareaResize = () => {
    if (textareaResizeFrameRef.current !== null) return;

    textareaResizeFrameRef.current = requestAnimationFrame(() => {
      textareaResizeFrameRef.current = null;

      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = 'auto';
      const nextHeight = Math.min(textarea.scrollHeight, 128);
      textarea.style.height = `${nextHeight}px`;
    });
  };

  useEffect(() => {
    scheduleTextareaResize();
  }, [messageDraftSnapshot]);

  const queueComposerFocusRestore = () => {
    shouldRestoreComposerFocusRef.current = true;
  };

  const scheduleSendMessage = () => {
    if (typeof window === 'undefined') {
      void handleSendMessage();
      return;
    }

    if (sendMessageFrameRef.current !== null) return;

    sendMessageFrameRef.current = requestAnimationFrame(() => {
      sendMessageFrameRef.current = null;
      void handleSendMessage();
    });
  };

  const focusComposerTextarea = () => {
    if (typeof window === 'undefined') return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        if (isSending || isRecording || audioPreviewUrl || showFollowUpModal || showRewriteModal) return;

        scheduleTextareaResize();
        textarea.focus();
        const cursorPosition = textarea.value.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      });
    });
  };

  useEffect(() => {
    if (!shouldRestoreComposerFocusRef.current) return;
    if (isSending || isRecording || audioPreviewUrl || showFollowUpModal || showRewriteModal) return;

    shouldRestoreComposerFocusRef.current = false;
    focusComposerTextarea();
  }, [audioPreviewUrl, isRecording, isSending, messageDraftSnapshot, showFollowUpModal, showRewriteModal]);

  useEffect(() => {
    if (!showComposerActionsMenu) {
      setRenderComposerActionsMenu(false);
      return;
    }

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (!cancelled) {
        startTransition(() => {
          setRenderComposerActionsMenu(true);
        });
      }
    });

    const handlePointerDown = (event: MouseEvent) => {
      if (!composerActionsMenuRef.current?.contains(event.target as Node)) {
        setShowComposerActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [showComposerActionsMenu]);

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const now = Date.now();
    if (now - lastTypingSignalAtRef.current >= 2500) {
      lastTypingSignalAtRef.current = now;
      sendTypingState(chatId).catch(console.error);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 3000);
  };

  const rememberRecentEmoji = (emoji: string) => {
    setRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, MAX_RECENT_EMOJIS);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(EMOJI_RECENTS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => {
      const next = !prev;
      if (next) {
        setActiveEmojiCategory(recentEmojis.length > 0 ? 'recent' : 'smileys');
        setEmojiSearch('');
      }
      return next;
    });
    setShowAttachMenu(false);
    setShowComposerActionsMenu(false);
    setShowQuickReplies(false);
  };

  const toggleComposerActionsMenu = () => {
    startTransition(() => {
      setShowComposerActionsMenu((prev) => !prev);
    });
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const handleOpenQuickRepliesMenu = () => {
    startTransition(() => {
      setShowQuickReplies((prev) => !prev);
    });
    setShowComposerActionsMenu(false);
    setShowEmojiPicker(false);
  };

  const waitForLinkPreviewResolution = async (targetUrl: string, timeoutMs: number = 1200) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (!linkPreviewLoading || linkPreviewUrl !== targetUrl) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  };

  const sendLinkPreviewMessage = async (
    bodyText: string,
    submitChatId: string,
    draftReplyToMessage: { id: string; body: string; from: string } | null,
    draftLinkPreview: { title: string; description?: string; canonical?: string; image?: string },
  ) => {
    const sentAt = new Date().toISOString();
    const localRef = createClientMessageId();
    const normalizedChatId = normalizeChatId(submitChatId);
    const retryPayload = buildLinkPreviewRetryPayload(bodyText, draftLinkPreview, draftReplyToMessage?.id ?? null);

    emitMessageSent({
        id: localRef,
        local_ref: localRef,
        chat_id: normalizedChatId,
        body: bodyText,
        type: 'link_preview',
        has_media: true,
        timestamp: sentAt,
        direction: 'outbound',
        created_at: sentAt,
        ack_status: 1,
        send_state: 'pending',
        error_message: null,
        retry_payload: retryPayload,
        payload: {
          link_preview: {
            title: retryPayload.title,
            description: retryPayload.description,
            canonical: retryPayload.canonical,
            preview: retryPayload.preview,
          },
        },
      });

    try {
      const response = await sendWhatsAppMessage({
        chatId: submitChatId,
        contentType: 'LinkPreview',
        content: {
          body: bodyText,
          title: retryPayload.title,
          description: retryPayload.description,
          canonical: retryPayload.canonical,
          preview: retryPayload.preview,
        },
        quotedMessageId: draftReplyToMessage?.id,
      });

      const { normalizedChatId: persistedChatId, messageId } = await persistOutboundMessage({
        response,
        chatId: submitChatId,
        type: 'link_preview',
        body: bodyText,
        hasMedia: true,
        sentAt,
      });

      emitMessageSent({
          id: messageId,
          local_ref: localRef,
          chat_id: persistedChatId,
          body: bodyText,
          type: 'link_preview',
          has_media: true,
          timestamp: sentAt,
          direction: 'outbound',
          created_at: sentAt,
          ack_status: 2,
          send_state: null,
          error_message: null,
          retry_payload: null,
          payload: response,
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      emitMessageSent({
          id: localRef,
          local_ref: localRef,
          chat_id: normalizedChatId,
          body: bodyText,
          type: 'link_preview',
          has_media: true,
          timestamp: sentAt,
          direction: 'outbound',
          created_at: sentAt,
          ack_status: 0,
          send_state: 'failed',
          error_message: errorMessage,
          retry_payload: retryPayload,
          payload: {
            link_preview: {
              title: retryPayload.title,
              description: retryPayload.description,
              canonical: retryPayload.canonical,
              preview: retryPayload.preview,
            },
          },
        });
      throw error;
    }
  };

  const handleSendMessage = async () => {
    const rawMessage = messageDraftRef.current.trim();
    const resolvedMessage = applyTemplateVariables(rawMessage);
    const submitChatId = chatId;

    if ((!rawMessage && !selectedFile && !selectedGif) || isSending) return;

    if (!editMessage && !selectedFile && !selectedGif && slashCommandState.active && slashCommandState.results.length > 0) {
      handleUseSlashQuickReply(selectedSlashQuickReply || slashCommandState.results[0]);
      return;
    }

    setIsSending(true);

    try {
      if (editMessage) {
        await sendWhatsAppMessage({
          chatId,
          contentType: 'string',
          content: resolvedMessage,
          editMessageId: editMessage.id,
        });

        updateComposerDraft('');
        if (onCancelEdit) onCancelEdit();
        emitMessageSent();
        queueComposerFocusRestore();
      } else if (selectedGif) {
        const gifUrl = resolveSelectedGifSendUrl(selectedGif);
        const preview = resolveSelectedGifPreviewUrl(selectedGif);

        if (!gifUrl) {
          toast.error('Nao foi possivel preparar o GIF selecionado.');
          return;
        }

        const response = await sendWhatsAppMessage({
          chatId,
          contentType: 'gif',
          content: {
            url: gifUrl,
            mimetype: 'video/mp4',
            preview: preview || undefined,
            caption: resolvedMessage || undefined,
            autoplay: true,
          },
          quotedMessageId: replyToMessage?.id,
        });

        const sentAt = new Date().toISOString();
        const resolvedBody = resolvedMessage || '[GIF]';
        const payloadOverride = buildGifPayloadOverride(selectedGif, response);
        const { normalizedChatId, messageId } = await persistOutboundMessage({
          response,
          chatId,
          type: 'gif',
          body: resolvedBody,
          hasMedia: true,
          sentAt,
          payloadOverride,
        });

        const gifPayload: SentMessagePayload = {
          id: messageId,
          chat_id: normalizedChatId,
          body: resolvedBody,
          type: 'gif',
          has_media: true,
          timestamp: sentAt,
          direction: 'outbound',
          created_at: sentAt,
          payload: payloadOverride,
        };

        clearSelectedGif();
        updateComposerDraft('');
        if (onCancelReply) onCancelReply();
        emitMessageSent(gifPayload);
        queueComposerFocusRestore();
      } else if (selectedFile) {
        const mediaMessageType = resolveOutgoingFileMessageType(selectedFile);
        const caption = mediaMessageType === 'sticker' ? '' : resolvedMessage;
        const response = await sendMediaMessage(chatId, selectedFile, {
          caption: caption || undefined,
          quotedMessageId: replyToMessage?.id,
        });

        const sentAt = new Date().toISOString();
        const fallbackBody = mediaMessageType === 'sticker'
          ? '[Sticker]'
          : selectedFile.type.startsWith('audio/')
            ? '[Áudio]'
            : selectedFile.type.startsWith('image/')
              ? '[Imagem]'
              : selectedFile.type.startsWith('video/')
                ? '[Vídeo]'
                : '[Arquivo]';
        const resolvedBody = mediaMessageType === 'sticker' ? '[Sticker]' : caption || fallbackBody;
        const { normalizedChatId, messageId } = await persistOutboundMessage({
          response,
          chatId,
          type: mediaMessageType,
          body: resolvedBody,
          hasMedia: true,
          sentAt,
        });

        const mediaPayload: SentMessagePayload = {
          id: messageId,
          chat_id: normalizedChatId,
          body: resolvedBody,
          type: mediaMessageType,
          has_media: true,
          timestamp: sentAt,
          direction: 'outbound',
          created_at: sentAt,
          payload: response,
        };

        clearFile();
        updateComposerDraft('');
        if (onCancelReply) onCancelReply();
        emitMessageSent(mediaPayload);
        queueComposerFocusRestore();
      } else if (rawMessage) {
        const currentDetectedUrl = detectedPreviewUrl;

        if (currentDetectedUrl && linkPreviewDismissedUrl !== currentDetectedUrl) {
          if (linkPreviewLoading && linkPreviewUrl === currentDetectedUrl) {
            await waitForLinkPreviewResolution(currentDetectedUrl);
          }

          const previewTitle = linkPreviewTitle.trim();
          const previewCanonical = (linkPreviewCanonical || currentDetectedUrl).trim();
          const canSendPreview = linkPreviewUrl === currentDetectedUrl && !linkPreviewError && Boolean(previewTitle);

          if (canSendPreview) {
            updateComposerDraft('');
            clearLinkPreviewDraft();
            setLinkPreviewDismissedUrl(null);
            if (onCancelReply) onCancelReply();
            await sendLinkPreviewMessage(resolvedMessage || rawMessage, submitChatId, replyToMessage ?? null, {
              title: previewTitle,
              description: linkPreviewDescription,
              canonical: previewCanonical,
              image: linkPreviewImage,
            });
            queueComposerFocusRestore();
            return;
          }
        }

        updateComposerDraft('');
        clearLinkPreviewDraft();
        setLinkPreviewDismissedUrl(null);
        if (onCancelReply) onCancelReply();
        await sendPlainTextMessage(resolvedMessage || rawMessage, submitChatId);
        queueComposerFocusRestore();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isShortcut = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isShortcut && key === 'b') {
      event.preventDefault();
      applyInlineFormat('*');
      return;
    }

    if (isShortcut && key === 'i') {
      event.preventDefault();
      applyInlineFormat('_');
      return;
    }

    if (isShortcut && event.shiftKey && key === 'x') {
      event.preventDefault();
      applyInlineFormat('~');
      return;
    }

    if (isShortcut && event.shiftKey && key === 'm') {
      event.preventDefault();
      applyInlineFormat('`');
      return;
    }

    if (slashCommandState.active && slashCommandState.results.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashQuickReplyIndex((prev) => (prev + 1) % slashCommandState.results.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashQuickReplyIndex((prev) =>
          prev === 0 ? slashCommandState.results.length - 1 : prev - 1,
        );
        return;
      }

      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        handleUseSlashQuickReply(selectedSlashQuickReply || slashCommandState.results[0]);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      scheduleSendMessage();
    }
  };

  const insertEmoji = (emoji: string) => {
    rememberRecentEmoji(emoji);
    const currentMessage = messageDraftRef.current;
    const textarea = textareaRef.current;
    if (!textarea) {
      updateComposerDraft(`${currentMessage}${emoji}`);
      return;
    }

    const start = textarea.selectionStart ?? currentMessage.length;
    const end = textarea.selectionEnd ?? currentMessage.length;
    const nextMessage = `${currentMessage.slice(0, start)}${emoji}${currentMessage.slice(end)}`;
    updateComposerDraft(nextMessage);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const buildClipboardFileName = (file: File) => {
    if (file.name?.trim()) return file.name;

    const extensionFromType = file.type.split('/')[1]?.split(';')[0]?.trim() || 'bin';
    const prefix = file.type === 'image/webp' || file.type === 'application/webp'
      ? 'sticker'
      : file.type === 'image/gif'
      ? 'gif'
      : file.type.startsWith('image/')
      ? 'imagem'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'arquivo';

    return `${prefix}-${Date.now()}.${extensionFromType}`;
  };

  const attachFileToComposer = (incomingFile: File) => {
    const normalizedFile =
      incomingFile.name?.trim()
        ? incomingFile
        : new File([incomingFile], buildClipboardFileName(incomingFile), {
            type: incomingFile.type || 'application/octet-stream',
            lastModified: incomingFile.lastModified || Date.now(),
          });

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setSelectedFile(normalizedFile);
    setSelectedGif(null);

    const outgoingType = resolveOutgoingFileMessageType(normalizedFile);

    if (outgoingType === 'image' || outgoingType === 'sticker' || outgoingType === 'video') {
      const url = URL.createObjectURL(normalizedFile);
      setPreviewUrl(url);
    }

    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    setShowComposerActionsMenu(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      attachFileToComposer(file);
    }
  };

  const handleTextareaPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const fileItem = clipboardItems.find((item) => item.kind === 'file');
    const pastedFile = fileItem?.getAsFile();

    if (!pastedFile) {
      return;
    }

    event.preventDefault();
    attachFileToComposer(pastedFile);
  };

  const handleTextareaDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const droppedFile = event.dataTransfer?.files?.[0];
    if (!droppedFile) return;

    event.preventDefault();
    attachFileToComposer(droppedFile);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (stickerInputRef.current) stickerInputRef.current.value = '';
  };

  const clearSelectedGif = () => {
    setSelectedGif(null);
  };

  const handleOpenGifPicker = () => {
    setGifSearch('');
    setGifError(null);
    setShowGifPicker(true);
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    setShowComposerActionsMenu(false);
  };

  const handleSelectGif = (gif: GiphyGifItem) => {
    clearFile();
    setSelectedGif(gif);
    setShowGifPicker(false);
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    setShowComposerActionsMenu(false);
  };

  const startRecording = async () => {
    try {
      recordingCancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const durationSeconds = recordingTime;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });

        setIsRecording(false);
        setRecordingTime(0);

        stream.getTracks().forEach(track => track.stop());

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }

        if (recordingCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const objectUrl = URL.createObjectURL(audioBlob);
        setAudioPreviewBlob(audioBlob);
        setAudioPreviewUrl(objectUrl);
        setAudioPreviewDuration(durationSeconds);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      sendRecordingState(chatId).catch(console.error);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      mediaSourceRef.current = source;
      analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      const drawWave = () => {
        const canvas = canvasRef.current;
        const analyserNode = analyserRef.current;
        const dataArray = analyserDataRef.current;
        if (!canvas || !analyserNode || !dataArray) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        const { width, height } = canvas;
        analyserNode.getByteTimeDomainData(dataArray);
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#e2e8f0';
        context.fillRect(0, 0, width, height);
        context.lineWidth = 2;
        context.strokeStyle = '#22c55e';
        context.beginPath();
        const sliceWidth = width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
          x += sliceWidth;
        }
        context.lineTo(width, height / 2);
        context.stroke();
        animationFrameRef.current = requestAnimationFrame(drawWave);
      };

      drawWave();

    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast.error('Erro ao acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      recordingCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const clearAudioPreview = () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
    setAudioPreviewBlob(null);
    setAudioPreviewDuration(0);
  };

  const handleSendAudioPreview = async () => {
    if (!audioPreviewBlob || isSending) return;
    try {
      setIsSending(true);
      const audioFile = new File([audioPreviewBlob], 'voice.ogg', { type: 'audio/ogg' });
      const durationSeconds = audioPreviewDuration || recordingTime;
      const response = await sendMediaMessage(chatId, audioFile, {
        quotedMessageId: replyToMessage?.id,
        seconds: durationSeconds,
        recordingTime: durationSeconds,
        asVoice: true,
      });

      const sentAt = new Date().toISOString();
      const { normalizedChatId, messageId } = await persistOutboundMessage({
        response,
        chatId,
        type: 'voice',
        body: '[Mensagem de voz]',
        hasMedia: true,
        sentAt,
      });

      const audioPayload: SentMessagePayload = {
        id: messageId,
        chat_id: normalizedChatId,
        body: '[Mensagem de voz]',
        type: 'voice',
        has_media: true,
        timestamp: sentAt,
        direction: 'outbound',
        created_at: sentAt,
        payload: response,
      };

      clearAudioPreview();
      if (onCancelReply) onCancelReply();
      emitMessageSent(audioPayload);
      queueComposerFocusRestore();
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      toast.error('Erro ao enviar mensagem de voz.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddQuickReply = async () => {
    if (quickRepliesLoading) return;

    const title = quickReplyTitle.trim();
    const content = quickReplyMessage.trim();
    if (!title || !content) {
      toast.warning('Preencha título e mensagem.');
      return;
    }

    setQuickRepliesLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_quick_replies')
        .insert({ title, text: content })
        .select('id, title, text')
        .single();

      if (error) {
        throw error;
      }

      if (data?.id) {
        setQuickReplies((prev) => [
          {
            id: data.id,
            title: (data.title || '').trim() || 'Resposta rápida',
            message: (data.text || '').trim(),
          },
          ...prev,
        ]);
      }

      setQuickReplyTitle('');
      setQuickReplyMessage('');
    } catch (error) {
      console.error('Erro ao salvar resposta rápida global:', error);
      toast.error('Erro ao salvar resposta rápida.');
    } finally {
      setQuickRepliesLoading(false);
    }
  };

  const applyQuickReplyToDraft = (reply: { message: string }) => {
    const resolvedMessage = applyTemplateVariables(reply.message);
    updateComposerDraft(resolvedMessage);
    setShowQuickReplies(false);
    setQuickReplySearch('');

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const cursorPosition = resolvedMessage.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleUseQuickReply = (reply: { message: string }) => {
    applyQuickReplyToDraft(reply);
    setSlashQuickReplyIndex(0);
  };

  const handleUseSlashQuickReply = (reply: { message: string }) => {
    applyQuickReplyToDraft(reply);
    setSlashQuickReplyIndex(0);
  };

  const handleRemoveQuickReply = async (replyId: string) => {
    if (quickRepliesLoading) return;

    setQuickRepliesLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_quick_replies')
        .delete()
        .eq('id', replyId);

      if (error) {
        throw error;
      }

      setQuickReplies((prev) => prev.filter((reply) => reply.id !== replyId));
    } catch (error) {
      console.error('Erro ao remover resposta rápida global:', error);
      toast.error('Erro ao remover resposta rápida.');
    } finally {
      setQuickRepliesLoading(false);
    }
  };

  const handleOpenRewrite = () => {
    const draft = messageDraftRef.current.trim();
    if (!draft) {
      toast.warning('Digite uma mensagem para reescrever.');
      return;
    }
    setRewriteOriginal(draft);
    setRewriteResult('');
    setRewriteError(null);
    setShowRewriteModal(true);
    handleRewrite(draft, rewriteTone);
  };

  const generateFollowUp = async (extraInstructionsOverride?: string | null) => {
    const requestId = followUpRequestIdRef.current + 1;
    followUpRequestIdRef.current = requestId;
    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      const preparedFollowUpContext = onPrepareFollowUpContext
        ? await onPrepareFollowUpContext()
        : followUpContext;

      const { data, error } = await supabase.functions.invoke('generate-follow-up', {
        body: {
          leadName: preparedFollowUpContext?.leadName || followUpContext?.leadName || templateVariables.nome || '',
          conversationHistory: preparedFollowUpContext?.conversationHistory || followUpContext?.conversationHistory || '',
          leadContext: preparedFollowUpContext?.leadContext ?? followUpContext?.leadContext ?? null,
          extraInstructions:
            typeof extraInstructionsOverride === 'string'
              ? extraInstructionsOverride.trim() || null
              : followUpSuggestions.trim() || null,
        },
      });

      if (error) {
        if (requestId !== followUpRequestIdRef.current) return;
        setFollowUpError(error.message || 'Erro ao gerar follow-up.');
        return;
      }

      const payload = (data || {}) as {
        followUp?: string;
        messages?: string[];
        provider?: string;
        model?: string;
      };

      const fallbackText = Array.isArray(payload.messages) ? payload.messages.join('\n') : '';
      const resultText = (payload.followUp || fallbackText || '').trim();

      if (!resultText) {
        if (requestId !== followUpRequestIdRef.current) return;
        setFollowUpError('A IA não retornou um follow-up utilizável.');
        return;
      }

      if (requestId !== followUpRequestIdRef.current) return;
      setFollowUpDraft(resultText);
      setFollowUpProvider((payload.provider || '').trim());
      setFollowUpModel((payload.model || '').trim());
    } catch (error) {
      if (requestId !== followUpRequestIdRef.current) return;
      console.error('Erro ao gerar follow-up:', error);
      setFollowUpError('Erro ao gerar follow-up.');
    } finally {
      if (requestId === followUpRequestIdRef.current) {
        setFollowUpLoading(false);
      }
    }
  };

  const handleOpenFollowUp = () => {
    if (!isDirectChat) {
      toast.info('A geração de follow-up está disponível apenas para conversas individuais.');
      return;
    }

    setShowFollowUpModal(true);
    setFollowUpDraft('');
    setFollowUpSuggestions('');
    setFollowUpError(null);
    setFollowUpProvider('');
    setFollowUpModel('');
    void generateFollowUp('');
  };

  const handleUseFollowUpInField = () => {
    if (!followUpDraft.trim()) {
      setFollowUpError('Nada para usar no campo.');
      return;
    }

    updateComposerDraft(followUpDraft);
    setShowFollowUpModal(false);
    requestAnimationFrame(() => {
      scheduleTextareaResize();
      textareaRef.current?.focus();
    });
  };

  const handleSendGeneratedFollowUp = async () => {
    if (isSending || followUpLoading) return;

    const chunks = splitFollowUpLines(followUpDraft);
    if (chunks.length === 0) {
      setFollowUpError('Nada para enviar.');
      return;
    }

    setIsSending(true);
    setFollowUpError(null);

    try {
      for (const chunk of chunks) {
        await sendPlainTextMessage(chunk);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      updateComposerDraft('');
      setShowFollowUpModal(false);
      setFollowUpDraft('');
      if (onCancelReply) onCancelReply();
      queueComposerFocusRestore();
    } catch (error) {
      console.error('Erro ao enviar follow-up gerado:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar follow-up.';
      setFollowUpError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleRewrite = async (draft: string, tone: string) => {
    setRewriteLoading(true);
    setRewriteError(null);
    try {
      const { data, error } = await supabase.functions.invoke('rewrite-message', {
        body: { text: draft, tone },
      });
      if (error) {
        setRewriteError(error.message || 'Erro ao gerar reescrita.');
        return;
      }
      const resultText = (data as { rewrite?: string; text?: string })?.rewrite || (data as { text?: string })?.text;
      setRewriteResult(resultText?.trim() || '');
    } catch (err) {
      console.error('Erro ao reescrever com GPT:', err);
      setRewriteError('Erro ao gerar reescrita.');
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleInsertSplit = () => {
    const textarea = rewriteTextareaRef.current;
    if (!textarea) {
      setRewriteResult((prev) => `${prev}\n---\n`);
      return;
    }
    const start = textarea.selectionStart ?? rewriteResult.length;
    const end = textarea.selectionEnd ?? rewriteResult.length;
    const nextText = `${rewriteResult.slice(0, start)}\n---\n${rewriteResult.slice(end)}`;
    setRewriteResult(nextText);
    requestAnimationFrame(() => {
      const cursor = start + 5;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleSendRewriteChunks = async () => {
    if (isSending) return;
    const chunks = splitRewriteChunks(rewriteResult || rewriteOriginal);
    if (chunks.length === 0) {
      toast.warning('Nada para enviar.');
      return;
    }
    setIsSending(true);
    try {
      for (const chunk of chunks) {
        await sendPlainTextMessage(chunk);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      updateComposerDraft('');
      setRewriteResult('');
      setRewriteOriginal('');
      setShowRewriteModal(false);
      queueComposerFocusRestore();
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendLocation = async () => {
    if (!navigator.geolocation) {
      toast.warning('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    setShowAttachMenu(false);
    setIsSending(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await sendWhatsAppMessage({
            chatId,
            contentType: 'Location',
            content: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              description: 'Minha localização',
            },
          });

          const sentAt = new Date().toISOString();
          const { normalizedChatId, messageId } = await persistOutboundMessage({
            response,
            chatId,
            type: 'location',
            body: '[Localização]',
            hasMedia: true,
            sentAt,
          });

          emitMessageSent({
              id: messageId,
              chat_id: normalizedChatId,
              body: '[Localização]',
              type: 'location',
              has_media: true,
              timestamp: sentAt,
              direction: 'outbound',
              created_at: sentAt,
              payload: response,
            });
          queueComposerFocusRestore();
        } catch (error) {
          console.error('Erro ao enviar localização:', error);
          toast.error('Erro ao enviar localização.');
        } finally {
          setIsSending(false);
        }
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        toast.error('Erro ao obter localização.');
        setIsSending(false);
      }
    );
  };

  const extractPhoneFromContactId = (contactId: string) => contactId.replace(/\D/g, '');

  const buildVcard = (name: string, phone: string) =>
    `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${phone}:${phone}\nEND:VCARD`;

  const handleSendContact = async (contact: { id: string; name: string }) => {
    const phone = extractPhoneFromContactId(contact.id);
    if (!phone) {
      toast.warning('Contato sem telefone válido.');
      return;
    }

    setIsSending(true);
    try {
      const response = await sendWhatsAppMessage({
        chatId,
        contentType: 'Contact',
        content: {
          name: contact.name,
          vcard: buildVcard(contact.name, phone),
        },
        quotedMessageId: replyToMessage?.id,
      });

      const sentAt = new Date().toISOString();
      const body = `[Contato: ${contact.name}]`;
      const { normalizedChatId, messageId } = await persistOutboundMessage({
        response,
        chatId,
        type: 'contact',
        body,
        hasMedia: false,
        sentAt,
      });

      const contactPayload: SentMessagePayload = {
        id: messageId,
        chat_id: normalizedChatId,
        body,
        type: 'contact',
        has_media: false,
        timestamp: sentAt,
        direction: 'outbound',
        created_at: sentAt,
        payload: response,
      };

      setShowContactPicker(false);
      setContactSearch('');
      if (onCancelReply) onCancelReply();
      emitMessageSent(contactPayload);
      queueComposerFocusRestore();
    } catch (error) {
      console.error('Erro ao enviar contato:', error);
      toast.error('Erro ao enviar contato.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative border-t border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]">
      {showQuickReplies && (
        <div className="comm-popover absolute bottom-full left-4 z-20 mb-2 w-96 max-w-[90vw]">
          <div className="comm-popover-header">
            <span className="comm-title text-sm font-medium">Respostas rápidas</span>
            <button
              type="button"
              className="comm-icon-button p-1"
              onClick={() => setShowQuickReplies(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-3">
            <div className="relative">
              <input
                type="text"
                value={quickReplySearch}
                onChange={(e) => setQuickReplySearch(e.target.value)}
                placeholder="Buscar resposta..."
                className="comm-input px-3 py-2 text-sm"
              />
            </div>

            {templateVariableShortcuts.length > 0 && (
              <div className="comm-card border-[var(--panel-accent-border,#a96428)] bg-[var(--panel-surface-muted,#f7f0e7)] px-2 py-2">
                <div className="comm-accent-text text-[11px] font-semibold">Variaveis de template</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {templateVariableShortcuts.map((shortcut) => (
                    <button
                      key={`qr-variable-${shortcut.key}`}
                      type="button"
                      className="comm-chip-button rounded-full border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-2 py-0.5 text-[11px] text-[var(--panel-text-soft,#5b4635)]"
                      onClick={() => insertTemplateTokenOnQuickReply(shortcut.key)}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="comm-list panel-dropdown-scrollbar max-h-40 overflow-y-auto">
              {quickRepliesLoading ? (
                <div className="comm-muted px-3 py-2 text-xs">Carregando respostas rápidas...</div>
              ) : quickReplyPreviewItems.length === 0 ? (
                <div className="comm-muted px-3 py-2 text-xs">Nenhuma resposta rápida encontrada.</div>
              ) : (
                quickReplyPreviewItems.map((reply) => {
                  return (
                    <div key={reply.id} className="border-b border-[var(--panel-border-subtle,#e7dac8)] px-3 py-2 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="comm-title text-left text-sm font-medium"
                          onClick={() => handleUseQuickReply(reply)}
                        >
                          {reply.title}
                        </button>
                        <button
                          type="button"
                          className="comm-button-secondary rounded-full px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => handleRemoveQuickReply(reply.id)}
                          disabled={quickRepliesLoading}
                        >
                          Remover
                        </button>
                      </div>
                      <div className="comm-muted mt-1 whitespace-pre-wrap text-xs">{reply.message}</div>
                      {reply.hasDynamicPreview && (
                        <div className="comm-card mt-1 whitespace-pre-wrap px-2 py-1 text-[11px] text-[var(--panel-text-soft,#5b4635)]">
                          Preview: {reply.resolvedPreview}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="comm-muted text-xs font-semibold">Nova resposta</span>
                <button
                  type="button"
                  className="comm-button-link text-xs"
                  onClick={() => setQuickReplyMessage(messageDraftRef.current)}
                >
                  Usar texto atual
                </button>
              </div>
              <input
                type="text"
                value={quickReplyTitle}
                onChange={(e) => setQuickReplyTitle(e.target.value)}
                placeholder="Título"
                className="comm-input px-3 py-2 text-sm"
              />
              <VariableAutocompleteTextarea
                value={quickReplyMessage}
                onChange={setQuickReplyMessage}
                placeholder="Mensagem (use {{nome}}, {{telefone}}, etc.)"
                className="h-24 px-3 py-2 text-sm"
                rows={4}
                size="compact"
                suggestions={quickReplyVariableSuggestions}
              />
              <button
                type="button"
                className="comm-button-primary w-full rounded-md px-3 py-2 text-sm"
                onClick={handleAddQuickReply}
                disabled={quickRepliesLoading}
              >
                {quickRepliesLoading ? 'Salvando...' : 'Salvar resposta rápida'}
              </button>
            </div>
          </div>
        </div>
      )}
      <GiphyPickerModal
        isOpen={showGifPicker}
        search={gifSearch}
        onSearchChange={setGifSearch}
        results={gifResults}
        loading={gifLoading}
        error={gifError}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleSelectGif}
      />
      {showRewriteModal && (
        <ModalShell
          isOpen
          onClose={() => setShowRewriteModal(false)}
          title="Reescrever com GPT"
          size="md"
          bodyClassName="space-y-3"
        >
          <div>
            <label className="comm-muted text-xs">Texto original</label>
            <div className="comm-card comm-text mt-1 whitespace-pre-wrap break-words px-3 py-2 text-sm">
              {rewriteOriginal}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="comm-muted text-xs">Tom</label>
              <FilterSingleSelect
                icon={Sparkles}
                value={rewriteTone}
                onChange={(value) => setRewriteTone(value)}
                placeholder="Tom"
                includePlaceholderOption={false}
                options={rewriteTones.map((tone) => ({
                  value: tone.value,
                  label: tone.label,
                }))}
              />
            </div>
            <button
              type="button"
              className="comm-button-primary rounded-md px-3 py-2 text-sm"
              onClick={() => handleRewrite(rewriteOriginal, rewriteTone)}
              disabled={rewriteLoading}
            >
              {rewriteLoading ? 'Gerando...' : 'Gerar'}
            </button>
          </div>
          <div>
            <label className="comm-muted text-xs">Preview</label>
            <textarea
              ref={rewriteTextareaRef}
              value={rewriteResult}
              onChange={(event) => setRewriteResult(event.target.value)}
              placeholder="Resultado da reescrita"
              className="comm-textarea mt-1 min-h-[10rem] px-3 py-2 text-sm"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="comm-muted text-xs">Use --- para dividir</span>
              <button
                type="button"
                className="comm-button-link flex items-center gap-1 text-xs"
                onClick={handleInsertSplit}
              >
                <Scissors className="h-3 w-3" />
                Inserir divisão
              </button>
            </div>
          </div>
          {rewriteError && <div className="comm-card comm-card-danger px-3 py-2 text-xs">{rewriteError}</div>}
          <div>
            <div className="comm-muted mb-1 text-xs">Partes ({rewriteChunks.length})</div>
            <div className="comm-list comm-text panel-dropdown-scrollbar max-h-40 overflow-y-auto space-y-2 px-2 py-2 text-xs">
              {rewriteChunks.length === 0 ? (
                <div className="comm-subtle">Nenhuma parte definida.</div>
              ) : (
                rewriteChunks.map((chunk, index) => (
                  <div
                    key={`chunk-${index}`}
                    className="rounded-lg border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-2 py-2"
                  >
                    <div className="comm-muted">Parte {index + 1}</div>
                    <div className="comm-text whitespace-pre-wrap break-words">{chunk}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <button
              type="button"
              className="comm-button-secondary rounded-md px-3 py-2 text-sm"
              onClick={() => {
                updateComposerDraft(rewriteResult || rewriteOriginal);
                setShowRewriteModal(false);
              }}
            >
              Usar no campo
            </button>
            <button
              type="button"
              className="comm-button-primary rounded-md px-3 py-2 text-sm"
              onClick={handleSendRewriteChunks}
              disabled={rewriteLoading || isSending}
            >
              Enviar em partes
            </button>
          </div>
        </ModalShell>
      )}
      {showFollowUpModal && (
        <ModalShell
          isOpen
          onClose={() => setShowFollowUpModal(false)}
          title="Gerar follow-up"
          description="Baseado no histórico carregado deste chat. Cada linha não vazia vira uma mensagem."
          size="md"
          bodyClassName="space-y-3"
        >
          <div>
            <label className="comm-muted text-xs">Sugestoes extras para esta geracao</label>
            <textarea
              value={followUpSuggestions}
              onChange={(event) => setFollowUpSuggestions(event.target.value)}
              placeholder="Opcional. Ex.: estamos com promocao esta semana, destacar condicao especial, reforcar urgencia leve ou focar em um beneficio especifico."
              className="comm-textarea mt-1 min-h-[6rem] px-3 py-2 text-sm"
            />
            <div className="comm-muted mt-2 text-xs">
              Use este campo para passar contexto pontual, como promocao ativa, campanha, condicao comercial ou abordagem que queira priorizar. Depois clique em gerar novamente.
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="comm-muted text-xs">
              {followUpProvider || followUpModel
                ? `Gerado com ${followUpProvider || 'IA'}${followUpModel ? ` - ${followUpModel}` : ''}`
                : 'A IA vai considerar o histórico do chat e o contexto do lead.'}
            </div>
            <button
              type="button"
              className="comm-button-secondary rounded-md px-3 py-2 text-sm"
              onClick={() => void generateFollowUp()}
              disabled={followUpLoading || isSending}
            >
              {followUpLoading ? 'Gerando...' : 'Gerar novamente'}
            </button>
          </div>

          <div>
            <label className="comm-muted text-xs">Texto para aprovar</label>
            <textarea
              value={followUpDraft}
              onChange={(event) => setFollowUpDraft(event.target.value)}
              placeholder={followUpLoading ? 'Gerando follow-up...' : 'O texto gerado vai aparecer aqui.'}
              className="comm-textarea mt-1 min-h-[11rem] px-3 py-2 text-sm"
            />
            <div className="comm-muted mt-2 text-xs">
              Dica: cada quebra de linha sera enviada como uma mensagem separada.
            </div>
          </div>

          <div>
            <div className="comm-muted mb-1 text-xs">Mensagens ({followUpMessages.length})</div>
            <div className="comm-list comm-text panel-dropdown-scrollbar max-h-40 overflow-y-auto space-y-2 px-2 py-2 text-xs">
              {followUpLoading && followUpMessages.length === 0 ? (
                <div className="comm-subtle">Gerando sugestao...</div>
              ) : followUpMessages.length === 0 ? (
                <div className="comm-subtle">Nenhuma mensagem definida.</div>
              ) : (
                followUpMessages.map((chunk, index) => (
                  <div
                    key={`follow-up-chunk-${index}`}
                    className="rounded-lg border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-2 py-2"
                  >
                    <div className="comm-muted">Mensagem {index + 1}</div>
                    <div className="comm-text whitespace-pre-wrap break-words">{chunk}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {followUpError && <div className="comm-card comm-card-danger px-3 py-2 text-xs">{followUpError}</div>}

          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <button
              type="button"
              className="comm-button-secondary rounded-md px-3 py-2 text-sm"
              onClick={() => setShowFollowUpModal(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="comm-button-secondary rounded-md px-3 py-2 text-sm"
              onClick={handleUseFollowUpInField}
              disabled={followUpLoading || isSending || !followUpDraft.trim()}
            >
              Usar no campo
            </button>
            <button
              type="button"
              className="comm-button-primary rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSendGeneratedFollowUp}
              disabled={followUpLoading || isSending || followUpMessages.length === 0}
            >
              {isSending ? 'Enviando...' : `Aprovar e enviar (${followUpMessages.length})`}
            </button>
          </div>
        </ModalShell>
      )}
      {showContactPicker && (
        <div className="comm-popover absolute bottom-full left-4 z-20 mb-2 w-80 overflow-hidden">
          <div className="comm-popover-header">
            <span className="comm-title text-sm font-medium">Enviar contato</span>
            <button
              type="button"
              className="comm-icon-button p-1"
              onClick={() => setShowContactPicker(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2">
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Buscar contato..."
              className="comm-input px-3 py-2 text-sm"
            />
          </div>
          <div className="panel-dropdown-scrollbar max-h-64 overflow-y-auto px-2 pb-2">
            {filteredContacts.length === 0 ? (
              <div className="comm-muted px-2 py-3 text-sm">Nenhum contato encontrado.</div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className="comm-list-item flex w-full items-center justify-between rounded px-3 py-2 text-left"
                  onClick={() => handleSendContact(contact)}
                  disabled={isSending}
                >
                  <span className="comm-text truncate text-sm">{contact.name || contact.id}</span>
                  <span className="comm-accent-text text-xs font-medium">Enviar</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {editMessage && (
        <ComposerContextBanner
          title="Editando mensagem"
          body={editMessage.body}
          onClose={onCancelEdit}
        />
      )}

      {replyToMessage && !editMessage && (
        <ComposerContextBanner
          title={`Respondendo a ${replyToMessage.from}`}
          body={replyToMessage.body}
          onClose={onCancelReply}
        />
      )}

      {selectedGif && !selectedFile && (
        <div className="comm-banner px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="h-20 w-20 overflow-hidden rounded bg-[var(--panel-surface-soft,#f4ede3)]">
              {selectedGif.mp4Url ? (
                <video
                  src={selectedGif.mp4Url}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : resolveSelectedGifPreviewUrl(selectedGif) ? (
                <img
                  src={resolveSelectedGifPreviewUrl(selectedGif)}
                  alt={selectedGif.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--panel-accent-ink,#6f3f16)]">
                  GIF
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="comm-title truncate text-sm font-medium">{selectedGif.title || 'GIF do Giphy'}</div>
              <div className="comm-muted text-xs">Selecionado do Giphy e pronto para envio.</div>
              <div className="comm-badge comm-badge-brand mt-1">Digite uma legenda abaixo (opcional)</div>
            </div>
            <button
              onClick={clearSelectedGif}
              className="comm-icon-button rounded p-1"
              disabled={isSending}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="comm-banner px-4 py-3">
          <div className="flex items-start gap-3">
            {previewUrl ? (
              selectedFile.type.startsWith('video/') ? (
                <video
                  src={previewUrl}
                  className="w-20 h-20 object-cover rounded"
                  muted
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded"
                />
              )
            ) : (
              <div className="comm-media-placeholder flex h-20 w-20 items-center justify-center rounded">
                <FileIcon className="h-8 w-8" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="comm-title truncate text-sm font-medium">{selectedFile.name}</div>
              <div className="comm-muted text-xs">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
              {(['image', 'video'] as const).includes(resolveOutgoingFileMessageType(selectedFile) as 'image' | 'video') && (
                <div className="comm-badge comm-badge-info mt-1">
                  Digite uma legenda abaixo (opcional)
                </div>
              )}
              {resolveOutgoingFileMessageType(selectedFile) === 'sticker' && (
                <div className="comm-badge comm-badge-neutral mt-1">
                  Sticker sera enviado no formato nativo do WhatsApp
                </div>
              )}
              {!['image', 'video', 'sticker'].includes(resolveOutgoingFileMessageType(selectedFile)) && (
                <div className="comm-badge comm-badge-neutral mt-1">
                  Você também pode colar arquivos direto no composer
                </div>
              )}
            </div>
            <button
              onClick={clearFile}
              className="comm-icon-button rounded p-1"
              disabled={isSending}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {shouldShowInlineLinkPreview && (
        <InlineLinkPreviewCard
          image={linkPreviewImage}
          title={linkPreviewTitle}
          description={linkPreviewDescription}
          siteName={linkPreviewSiteName}
          hostname={getUrlHostname(linkPreviewCanonical || linkPreviewUrl || '')}
          loading={linkPreviewLoading}
          error={linkPreviewError}
          onDismiss={() => {
            setLinkPreviewDismissedUrl(linkPreviewUrl);
            clearLinkPreviewDraft();
          }}
        />
      )}

      <div className="relative flex items-center gap-2 p-3">
        <div className="relative self-center">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="comm-action-button p-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {showAttachMenu && (
            <div className="comm-popover absolute bottom-full left-0 z-[110] mb-2 min-w-[220px] p-2">
              <button
                onClick={() => {
                  imageInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="comm-attach-item"
              >
                <div className="comm-icon-chip comm-icon-chip-brand flex h-8 w-8 items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Imagem ou vídeo</span>
              </button>

              <button
                onClick={() => {
                  stickerInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="comm-attach-item"
              >
                <div className="comm-icon-chip comm-icon-chip-brand flex h-8 w-8 items-center justify-center">
                  <Smile className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Figurinha (.webp)</span>
              </button>

              <button
                onClick={handleOpenGifPicker}
                className="comm-attach-item"
              >
                <div className="comm-icon-chip comm-icon-chip-warning flex h-8 w-8 items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">GIF do Giphy</span>
              </button>

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="comm-attach-item"
              >
                <div className="comm-icon-chip comm-icon-chip-info flex h-8 w-8 items-center justify-center">
                  <FileIcon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Documento</span>
              </button>

              <button
                onClick={handleSendLocation}
                className="comm-attach-item"
              >
                <div className="comm-icon-chip comm-icon-chip-success flex h-8 w-8 items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Localização</span>
              </button>

              <button
                onClick={() => {
                  setShowContactPicker(true);
                  setShowAttachMenu(false);
                }}
                className="comm-attach-item"
              >
                <div className="comm-icon-chip comm-icon-chip-warning flex h-8 w-8 items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Contato</span>
              </button>
            </div>
          )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,.webp,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />

          <input
            ref={stickerInputRef}
            type="file"
            accept="image/webp,.webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <div className="comm-composer-shell flex flex-1 items-center overflow-visible">
          <div ref={composerActionsMenuRef} className="relative z-[90] flex items-center self-center">
            <button
              className="comm-action-button p-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSending}
              onClick={toggleEmojiPicker}
              type="button"
              aria-label="Abrir emojis"
              aria-expanded={showEmojiPicker}
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              className="comm-action-button p-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSending}
              onClick={toggleComposerActionsMenu}
              type="button"
              title="Mais acoes"
              aria-label="Mais acoes"
              aria-expanded={showComposerActionsMenu}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showEmojiPicker && (
              <div className="comm-popover comm-emoji-picker absolute bottom-full left-0 z-[120] mb-2 w-[28rem] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0">
                <div className="comm-emoji-picker-tabs">
                  {emojiTabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={`comm-emoji-picker-tab ${activeEmojiCategory === tab.id ? 'is-active' : ''}`}
                        onClick={() => setActiveEmojiCategory(tab.id)}
                        aria-label={tab.label}
                        title={tab.label}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
                <div className="px-3 pb-2 pt-2">
                  <label className="comm-emoji-search">
                    <Search className="comm-emoji-search-icon h-4 w-4" />
                    <input
                      type="text"
                      value={emojiSearch}
                      onChange={(event) => setEmojiSearch(event.target.value)}
                      placeholder="Pesquisar emoji"
                      aria-label="Pesquisar emoji"
                    />
                    {emojiSearch ? (
                      <button
                        type="button"
                        className="comm-emoji-search-clear"
                        aria-label="Limpar busca"
                        onClick={() => setEmojiSearch('')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </label>
                </div>
                <div className="flex items-center justify-between px-4 pb-2">
                  <div className="comm-emoji-picker-section-title">
                    {normalizedEmojiSearch ? 'Resultados' : activeEmojiTab.nativeLabel}
                  </div>
                  <div className="comm-emoji-picker-section-meta">
                    {normalizedEmojiSearch
                      ? `${emojiSearchResults.length} encontrados`
                      : activeEmojiCategory === 'recent'
                        ? `${recentEmojis.length} usados`
                        : `${activeEmojiTab.emojis.length} emojis`}
                  </div>
                </div>
                <div className="comm-emoji-picker-scroll panel-dropdown-scrollbar overflow-y-auto px-3 pb-4">
                  {emojiSearchResults.length === 0 ? (
                    <div className="comm-emoji-picker-empty comm-muted px-2 text-center text-xs">
                      {normalizedEmojiSearch
                        ? 'Nenhum emoji encontrado para essa busca.'
                        : 'Seus emojis mais usados vao aparecer aqui conforme voce enviar.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-8 gap-1.5">
                      {emojiSearchResults.map((entry) => (
                        <button
                          key={`${activeEmojiCategory}-${entry.value}`}
                          type="button"
                          className="comm-emoji-picker-item"
                          onClick={() => {
                            insertEmoji(entry.value);
                            setShowEmojiPicker(false);
                          }}
                          aria-label={`Inserir ${entry.value}`}
                        >
                          <span className="text-[1.65rem] leading-none">{entry.value}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showComposerActionsMenu && (
              <div className="comm-popover absolute bottom-full left-0 z-[120] mb-2 min-w-64 p-2">
                {renderComposerActionsMenu ? <div className="space-y-1">
                  {isDirectChat && (
                    <button
                      type="button"
                      className="comm-menu-item text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        setShowComposerActionsMenu(false);
                        handleOpenFollowUp();
                      }}
                      disabled={isSending || isRecording || followUpLoading}
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{followUpLoading ? 'Gerando follow-up...' : 'Gerar follow-up com IA'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="comm-menu-item text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      setShowComposerActionsMenu(false);
                      handleOpenRewrite();
                    }}
                    disabled={isSending || isRecording}
                  >
                    <Scissors className="h-4 w-4" />
                    <span>Reescrever mensagem</span>
                  </button>
                  <button
                    type="button"
                    className="comm-menu-item text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleOpenQuickRepliesMenu}
                    disabled={isSending}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Mensagens rápidas</span>
                  </button>
                </div> : <div className="comm-muted px-2 py-2 text-xs">Abrindo ações...</div>}
              </div>
            )}
          </div>

          {isRecording ? (
            <div className="flex-1 px-2 py-2">
              <canvas ref={canvasRef} width={220} height={32} className="w-full h-8 rounded" />
            </div>
          ) : audioPreviewUrl ? (
            <div className="flex-1 px-2 py-2">
              <audio
                src={audioPreviewUrl}
                controls
                preload="metadata"
                className="w-full h-8"
                onLoadedMetadata={(event) => {
                  const target = event.currentTarget;
                  setAudioPreviewDuration(target.duration || 0);
                }}
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              defaultValue={messageDraftSnapshot}
              onChange={(e) => {
                const nextValue = e.target.value;
                updateComposerDraft(nextValue, { deferSnapshot: true });
                if (nextValue.trim()) {
                  handleTyping();
                }
              }}
              onKeyDown={handleTextareaKeyDown}
              onPaste={handleTextareaPaste}
              onDrop={handleTextareaDrop}
              onDragOver={(event) => {
                if (event.dataTransfer?.types?.includes('Files')) {
                  event.preventDefault();
                }
              }}
              placeholder={selectedFile || selectedGif ? "Digite uma legenda (opcional)" : "Digite uma mensagem (use / para atalhos)"}
              className="comm-composer-textarea flex-1 max-h-32 min-h-[40px] resize-none bg-transparent px-2 py-2 focus:outline-none"
              rows={1}
              disabled={isSending || isRecording}
              style={{
                height: 'auto',
                minHeight: '40px',
              }}
            />
          )}
        </div>
        {slashCommandState.active && (
          <div className="comm-popover absolute bottom-full left-14 right-14 z-[95] mb-2 overflow-hidden">
            <div className="comm-muted flex items-center justify-between gap-2 border-b border-[var(--panel-border-subtle,#e7dac8)] px-3 py-2 text-[11px]">
              {slashCommandState.query
                ? `Atalho rapido: "${slashCommandState.query}"`
                : 'Digite / e o nome da resposta rápida'}
              <span className="comm-subtle text-[10px]">Enter/Tab aplica</span>
            </div>
            {slashCommandState.results.length === 0 ? (
              <div className="comm-muted px-3 py-2 text-xs">Nenhuma resposta rápida encontrada.</div>
            ) : (
              <div className="panel-dropdown-scrollbar max-h-56 overflow-y-auto">
                {slashCommandState.results.map((reply, index) => {
                  const isActive = index === slashQuickReplyIndex;
                  const resolvedPreview = applyTemplateVariables(reply.message);
                  return (
                    <button
                      key={`slash-reply-${reply.id}`}
                      type="button"
                      className={`comm-list-item w-full border-b border-[var(--panel-border-subtle,#e7dac8)] px-3 py-2 text-left last:border-b-0 ${
                        isActive ? 'comm-list-item-active' : ''
                      }`}
                      onMouseEnter={() => setSlashQuickReplyIndex(index)}
                      onClick={() => handleUseSlashQuickReply(reply)}
                    >
                      <div className="comm-title text-xs font-semibold">/{reply.title}</div>
                      <div className="comm-muted truncate text-[11px]">{resolvedPreview}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-2">
            <div className="comm-recording-pill flex items-center gap-2 px-3 py-2">
              <div className="comm-recording-dot h-2 w-2 rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                {formatTime(recordingTime)}
              </span>
            </div>
            <button
              onClick={cancelRecording}
              className="comm-fab-neutral h-10 w-10"
              title="Cancelar"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="comm-fab-danger h-10 w-10"
              title="Parar"
            >
              <StopCircle className="w-6 h-6" />
            </button>
          </div>
        ) : audioPreviewUrl ? (
          <div className="flex items-center gap-2">
            <button
              onClick={clearAudioPreview}
              className="comm-fab-neutral h-10 w-10 disabled:cursor-not-allowed disabled:opacity-60"
              title="Cancelar"
              disabled={isSending}
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={handleSendAudioPreview}
              disabled={isSending}
              className="comm-fab-primary h-10 w-10 disabled:cursor-not-allowed disabled:opacity-50"
                title="Enviar áudio"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        ) : messageDraftRef.current.trim() || selectedFile || selectedGif ? (
          <button
            onClick={scheduleSendMessage}
            disabled={isSending}
            className="comm-fab-primary h-10 w-10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={isSending}
            className="comm-fab-neutral h-10 w-10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

    </div>
  );
}

const areMessageInputPropsEqual = (prev: MessageInputProps, next: MessageInputProps) => (
  prev.chatId === next.chatId &&
  prev.contacts === next.contacts &&
  prev.templateVariables === next.templateVariables &&
  prev.templateVariableShortcuts === next.templateVariableShortcuts &&
  prev.replyToMessage === next.replyToMessage &&
  prev.editMessage === next.editMessage &&
  prev.followUpContext === next.followUpContext &&
  prev.onPrepareFollowUpContext === next.onPrepareFollowUpContext
);

export const MessageInput = memo(WhatsAppComposerComponent, areMessageInputPropsEqual);
