import { memo, useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  MapPin,
  Smile,
  X,
  Image as ImageIcon,
  File as FileIcon,
  StopCircle,
  Sparkles,
  Scissors,
  MessageSquare,
} from 'lucide-react';
import {
  sendWhatsAppMessage,
  sendMediaMessage,
  sendTypingState,
  sendRecordingState,
  normalizeChatId,
  getWhatsAppChatKind,
} from '../../lib/whatsappApiService';
import { supabase } from '../../lib/supabase';
import FilterSingleSelect from '../FilterSingleSelect';

export type SentMessagePayload = {
  id: string;
  chat_id: string;
  body: string | null;
  type: string | null;
  has_media: boolean;
  timestamp: string;
  direction: 'outbound';
  created_at: string;
  payload?: Record<string, unknown> | null;
};

type FollowUpGenerationContext = {
  leadName?: string;
  conversationHistory?: string;
  leadContext?: Record<string, unknown> | string | null;
};

interface MessageInputProps {
  chatId: string;
  onMessageSent?: (message?: SentMessagePayload) => void;
  contacts?: Array<{ id: string; name: string; saved: boolean; pushname?: string }>;
  templateVariables?: Record<string, string>;
  templateVariableShortcuts?: Array<{ key: string; label: string }>;
  replyToMessage?: {
    id: string;
    body: string;
    from: string;
  } | null;
  onCancelReply?: () => void;
  editMessage?: {
    id: string;
    body: string;
  } | null;
  onCancelEdit?: () => void;
  followUpContext?: FollowUpGenerationContext | null;
}

type QuickReplyItem = {
  id: string;
  title: string;
  message: string;
};

function MessageInputComponent({
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
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioPreviewBlob, setAudioPreviewBlob] = useState<Blob | null>(null);
  const [audioPreviewDuration, setAudioPreviewDuration] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpProvider, setFollowUpProvider] = useState('');
  const [followUpModel, setFollowUpModel] = useState('');
  const [showLinkPreviewModal, setShowLinkPreviewModal] = useState(false);
  const [linkPreviewTitle, setLinkPreviewTitle] = useState('');
  const [linkPreviewDescription, setLinkPreviewDescription] = useState('');
  const [linkPreviewCanonical, setLinkPreviewCanonical] = useState('');
  const [linkPreviewImage, setLinkPreviewImage] = useState('');
  const [linkPreviewSiteName, setLinkPreviewSiteName] = useState('');
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewError, setLinkPreviewError] = useState<string | null>(null);
  const [pendingLinkMessage, setPendingLinkMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSignalAtRef = useRef(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const textareaResizeFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const followUpRequestIdRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rewriteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiList = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤩', '🤔', '😴', '😅', '😭', '😡', '👍', '🙏', '👏', '🎉', '✅', '❤️'];
  const rewriteTones = [
    { value: 'claro', label: 'Claro e correto' },
    { value: 'formal', label: 'Formal' },
    { value: 'amigavel', label: 'Amigavel' },
    { value: 'curto', label: 'Curto e direto' },
    { value: 'persuasivo', label: 'Persuasivo' },
  ];

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
    setPendingLinkMessage(null);
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

    setLinkPreviewLoading(true);
    setLinkPreviewError(null);

    try {
      const { data, error } = await supabase.functions.invoke('link-preview-metadata', {
        body: { url: normalizedUrl },
      });

      if (error) {
        throw new Error(error.message || 'Nao foi possivel carregar metadados do link.');
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

      setLinkPreviewCanonical(resolvedUrl);
      setLinkPreviewTitle(resolvedTitle);
      setLinkPreviewDescription((metadata.description || '').trim());
      setLinkPreviewImage((metadata.image || '').trim());
      setLinkPreviewSiteName((metadata.siteName || '').trim());
    } catch (error) {
      console.error('Erro ao buscar metadados do link:', error);
      const normalizedUrlForFallback = normalizePreviewUrl(rawUrl);
      const hostname = getUrlHostname(normalizedUrlForFallback);
      setLinkPreviewCanonical(normalizedUrlForFallback);
      setLinkPreviewTitle((prev) => prev.trim() || hostname);
      setLinkPreviewError('Nao foi possivel carregar metadados automaticamente. Voce pode ajustar manualmente.');
    } finally {
      setLinkPreviewLoading(false);
    }
  };

  const openLinkPreviewComposer = async (rawMessage: string, rawUrl: string) => {
    const normalizedUrl = normalizePreviewUrl(rawUrl);
    setPendingLinkMessage(rawMessage);
    setLinkPreviewCanonical(normalizedUrl);
    setLinkPreviewTitle(getUrlHostname(normalizedUrl));
    setLinkPreviewDescription('');
    setLinkPreviewImage('');
    setLinkPreviewSiteName('');
    setShowLinkPreviewModal(true);
    await fetchLinkPreviewMetadata(normalizedUrl);
  };

  const applyInlineFormat = (opening: string, closing: string = opening) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((prev) => `${prev}${opening}${closing}`);
      return;
    }

    const start = textarea.selectionStart ?? message.length;
    const end = textarea.selectionEnd ?? message.length;
    const selectedText = message.slice(start, end);
    const hasSelection = start !== end;

    const replacement = `${opening}${selectedText}${closing}`;
    const nextMessage = `${message.slice(0, start)}${replacement}${message.slice(end)}`;
    setMessage(nextMessage);

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

  const normalizeQuickReplySearch = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filteredQuickReplies = useMemo(() => {
    const query = normalizeQuickReplySearch(quickReplySearch.trim());
    if (!query) return quickReplies;
    return quickReplies.filter(
      (reply) =>
        normalizeQuickReplySearch(reply.title).includes(query) ||
        normalizeQuickReplySearch(reply.message).includes(query),
    );
  }, [quickReplies, quickReplySearch]);

  const slashCommandState = useMemo(() => {
    const draft = message.trimStart();
    if (!draft.startsWith('/')) {
      return {
        active: false,
        query: '',
        results: [] as Array<{ id: string; title: string; message: string }>,
      };
    }

    if (draft.includes('\n')) {
      return {
        active: false,
        query: '',
        results: [] as Array<{ id: string; title: string; message: string }>,
      };
    }

    const query = draft.slice(1).trim();
    const normalizedQuery = normalizeQuickReplySearch(query);
    const results = quickReplies
      .filter((reply) => {
        if (!normalizedQuery) return true;
        return normalizeQuickReplySearch(reply.title).includes(normalizedQuery);
      })
      .slice(0, 8);

    return {
      active: true,
      query,
      results,
    };
  }, [message, quickReplies]);

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
        title: titleRaw || 'Resposta rapida',
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
        console.error('Erro ao carregar respostas rapidas globais:', error);

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

  const splitRewriteChunks = (text: string) =>
    text
      .split(/\n-{3,}\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

  const splitFollowUpLines = (text: string) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const rewriteChunks = useMemo(
    () => splitRewriteChunks(rewriteResult || rewriteOriginal),
    [rewriteResult, rewriteOriginal],
  );
  const followUpMessages = useMemo(
    () => splitFollowUpLines(followUpDraft),
    [followUpDraft],
  );

  const resolveOutgoingFileMessageType = (file: File): 'image' | 'video' | 'audio' | 'document' => {
    const mimeType = file.type.toLowerCase();
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
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

  const ensureOutboundChatExists = async (normalizedChatId: string, sentAt: string) => {
    const chatKind = getWhatsAppChatKind(normalizedChatId);
    const isGroup = chatKind === 'group';

    const { error } = await supabase.from('whatsapp_chats').upsert(
      {
        id: normalizedChatId,
        is_group: isGroup,
        phone_number: chatKind === 'direct' ? extractDirectPhoneNumber(normalizedChatId) : null,
        lid: chatKind === 'direct' ? extractChatLid(normalizedChatId) : null,
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
  }): Promise<{ normalizedChatId: string; messageId: string; persistedMessageId: string | null }> => {
    const { response, chatId: rawChatId, type, body, hasMedia, sentAt } = params;
    const normalizedChatId = normalizeChatId(rawChatId);
    await ensureOutboundChatExists(normalizedChatId, sentAt);

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
        payload: responsePayload,
      });

      if (insertError) {
        console.warn('Erro ao salvar mensagem no banco:', insertError);
      }
    } else {
      console.warn('Resposta sem ID da mensagem; salvando apenas no estado local até sincronizar.', response);
    }

    return { normalizedChatId, messageId, persistedMessageId };
  };

  const sendPlainTextMessage = async (text: string) => {
    const resolvedText = applyTemplateVariables(text).trim() || text.trim();

    const response = await sendWhatsAppMessage({
      chatId,
      contentType: 'string',
      content: resolvedText,
      quotedMessageId: replyToMessage?.id,
    });

    const sentAt = new Date().toISOString();
    const { normalizedChatId, messageId } = await persistOutboundMessage({
      response,
      chatId,
      type: 'text',
      body: resolvedText,
      hasMedia: false,
      sentAt,
    });

    const textPayload: SentMessagePayload = {
      id: messageId,
      chat_id: normalizedChatId,
      body: resolvedText,
      type: 'text',
      has_media: false,
      timestamp: sentAt,
      direction: 'outbound',
      created_at: sentAt,
      payload: response,
    };

    if (onMessageSent) onMessageSent(textPayload);
    return textPayload;
  };

  useEffect(() => {
    if (editMessage) {
      setMessage(editMessage.body);
    }
  }, [editMessage]);

  useEffect(() => {
    followUpRequestIdRef.current += 1;
    setShowFollowUpModal(false);
    setFollowUpDraft('');
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
  }, [message]);

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

  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
    setShowAttachMenu(false);
    setShowQuickReplies(false);
  };

  const handleSendMessage = async () => {
    const rawMessage = message.trim();
    const resolvedMessage = applyTemplateVariables(rawMessage);

    if ((!rawMessage && !selectedFile) || isSending) return;

    if (!editMessage && !selectedFile && slashCommandState.active && slashCommandState.results.length > 0) {
      handleUseSlashQuickReply(selectedSlashQuickReply || slashCommandState.results[0]);
      return;
    }

    if (!editMessage && !selectedFile) {
      const firstUrl = extractFirstUrl(resolvedMessage);
      if (firstUrl && !showLinkPreviewModal) {
        await openLinkPreviewComposer(resolvedMessage, firstUrl);
        return;
      }
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

        setMessage('');
        if (onCancelEdit) onCancelEdit();
        if (onMessageSent) onMessageSent();
      } else if (selectedFile) {
        const response = await sendMediaMessage(chatId, selectedFile, {
          caption: resolvedMessage || undefined,
          quotedMessageId: replyToMessage?.id,
        });

        const sentAt = new Date().toISOString();
        const caption = resolvedMessage;
        const mediaMessageType = resolveOutgoingFileMessageType(selectedFile);
        const fallbackBody = selectedFile.type.startsWith('audio/')
          ? '[Áudio]'
          : selectedFile.type.startsWith('image/')
            ? '[Imagem]'
            : selectedFile.type.startsWith('video/')
              ? '[Vídeo]'
              : '[Arquivo]';
        const resolvedBody = caption || fallbackBody;
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
        setMessage('');
        if (onCancelReply) onCancelReply();
        if (onMessageSent) onMessageSent(mediaPayload);
      } else if (rawMessage) {
        if (showLinkPreviewModal && pendingLinkMessage) {
          if (!linkPreviewTitle.trim()) {
            alert('Informe um titulo para o preview do link.');
            setIsSending(false);
            return;
          }
        }

        const isLinkPreview = showLinkPreviewModal && pendingLinkMessage;
        if (isLinkPreview) {
          const response = await sendWhatsAppMessage({
            chatId,
            contentType: 'LinkPreview',
            content: {
              body: pendingLinkMessage,
              title: linkPreviewTitle.trim(),
              description: linkPreviewDescription.trim() || undefined,
              canonical: linkPreviewCanonical.trim() || undefined,
              preview: linkPreviewImage.trim() || undefined,
            },
            quotedMessageId: replyToMessage?.id,
          });

          const bodyText = pendingLinkMessage;
          const sentAt = new Date().toISOString();
          const { normalizedChatId, messageId } = await persistOutboundMessage({
            response,
            chatId,
            type: 'link_preview',
            body: bodyText,
            hasMedia: true,
            sentAt,
          });

          const textPayload: SentMessagePayload = {
            id: messageId,
            chat_id: normalizedChatId,
            body: bodyText,
            type: 'link_preview',
            has_media: true,
            timestamp: sentAt,
            direction: 'outbound',
            created_at: sentAt,
            payload: response,
          };

          setMessage('');
          setShowLinkPreviewModal(false);
          clearLinkPreviewDraft();
          if (onCancelReply) onCancelReply();
          if (onMessageSent) onMessageSent(textPayload);
        } else {
          await sendPlainTextMessage(resolvedMessage || rawMessage);
          setMessage('');
          if (onCancelReply) onCancelReply();
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      alert(errorMessage || 'Erro ao enviar mensagem');
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
      handleSendMessage();
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((prev) => `${prev}${emoji}`);
      return;
    }

    const start = textarea.selectionStart ?? message.length;
    const end = textarea.selectionEnd ?? message.length;
    const nextMessage = `${message.slice(0, start)}${emoji}${message.slice(end)}`;
    setMessage(nextMessage);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }

      setShowAttachMenu(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
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
      alert('Erro ao acessar o microfone');
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
      if (onMessageSent) onMessageSent(audioPayload);
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      alert('Erro ao enviar mensagem de voz');
    } finally {
      setIsSending(false);
    }
  };

  const handleAddQuickReply = async () => {
    if (quickRepliesLoading) return;

    const title = quickReplyTitle.trim();
    const content = quickReplyMessage.trim();
    if (!title || !content) {
      alert('Preencha titulo e mensagem.');
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
            title: (data.title || '').trim() || 'Resposta rapida',
            message: (data.text || '').trim(),
          },
          ...prev,
        ]);
      }

      setQuickReplyTitle('');
      setQuickReplyMessage('');
    } catch (error) {
      console.error('Erro ao salvar resposta rapida global:', error);
      alert('Erro ao salvar resposta rapida.');
    } finally {
      setQuickRepliesLoading(false);
    }
  };

  const applyQuickReplyToDraft = (reply: { message: string }) => {
    const resolvedMessage = applyTemplateVariables(reply.message);
    setMessage(resolvedMessage);
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
      console.error('Erro ao remover resposta rapida global:', error);
      alert('Erro ao remover resposta rapida.');
    } finally {
      setQuickRepliesLoading(false);
    }
  };

  const handleOpenRewrite = () => {
    const draft = message.trim();
    if (!draft) {
      alert('Digite uma mensagem para reescrever.');
      return;
    }
    setRewriteOriginal(draft);
    setRewriteResult('');
    setRewriteError(null);
    setShowRewriteModal(true);
    handleRewrite(draft, rewriteTone);
  };

  const generateFollowUp = async () => {
    const requestId = followUpRequestIdRef.current + 1;
    followUpRequestIdRef.current = requestId;
    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-follow-up', {
        body: {
          leadName: followUpContext?.leadName || templateVariables.nome || '',
          conversationHistory: followUpContext?.conversationHistory || '',
          leadContext: followUpContext?.leadContext ?? null,
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
        setFollowUpError('A IA nao retornou um follow-up utilizavel.');
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
      if (requestId !== followUpRequestIdRef.current) return;
      setFollowUpLoading(false);
    }
  };

  const handleOpenFollowUp = () => {
    if (!isDirectChat) {
      alert('A geracao de follow-up esta disponivel apenas para conversas individuais.');
      return;
    }

    setShowFollowUpModal(true);
    setFollowUpDraft('');
    setFollowUpError(null);
    setFollowUpProvider('');
    setFollowUpModel('');
    void generateFollowUp();
  };

  const handleUseFollowUpInField = () => {
    if (!followUpDraft.trim()) {
      setFollowUpError('Nada para usar no campo.');
      return;
    }

    setMessage(followUpDraft);
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

      setMessage('');
      setShowFollowUpModal(false);
      setFollowUpDraft('');
      if (onCancelReply) onCancelReply();
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
      alert('Nada para enviar.');
      return;
    }
    setIsSending(true);
    try {
      for (const chunk of chunks) {
        await sendPlainTextMessage(chunk);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      setMessage('');
      setRewriteResult('');
      setRewriteOriginal('');
      setShowRewriteModal(false);
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
      alert('Geolocalização não é suportada pelo seu navegador');
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

          if (onMessageSent) {
            onMessageSent({
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
          }
        } catch (error) {
          console.error('Erro ao enviar localização:', error);
          alert('Erro ao enviar localização');
        } finally {
          setIsSending(false);
        }
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        alert('Erro ao obter localização');
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
      alert('Contato sem telefone válido.');
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
      if (onMessageSent) onMessageSent(contactPayload);
    } catch (error) {
      console.error('Erro ao enviar contato:', error);
      alert('Erro ao enviar contato');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border-t bg-white relative">
      {showQuickReplies && (
        <div className="absolute bottom-full left-4 mb-2 w-96 max-w-[90vw] bg-white border border-slate-200 rounded-lg shadow-xl z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <span className="text-sm font-medium text-slate-900">Respostas rapidas</span>
            <button
              type="button"
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {templateVariableShortcuts.length > 0 && (
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-2">
                <div className="text-[11px] font-semibold text-emerald-700">Variaveis de template</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {templateVariableShortcuts.map((shortcut) => (
                    <button
                      key={`qr-variable-${shortcut.key}`}
                      type="button"
                      className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-100"
                      onClick={() => insertTemplateTokenOnQuickReply(shortcut.key)}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="panel-dropdown-scrollbar max-h-40 overflow-y-auto border border-slate-200 rounded-md bg-white">
              {quickRepliesLoading ? (
                <div className="px-3 py-2 text-xs text-slate-500">Carregando respostas rapidas...</div>
              ) : filteredQuickReplies.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">Nenhuma resposta rapida encontrada.</div>
              ) : (
                filteredQuickReplies.map((reply) => {
                  const resolvedPreview = applyTemplateVariables(reply.message);
                  const hasDynamicPreview = resolvedPreview !== reply.message;

                  return (
                    <div key={reply.id} className="px-3 py-2 border-b last:border-b-0">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="text-sm font-medium text-slate-800 text-left"
                          onClick={() => handleUseQuickReply(reply)}
                        >
                          {reply.title}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-500 hover:text-red-600"
                          onClick={() => handleRemoveQuickReply(reply.id)}
                          disabled={quickRepliesLoading}
                        >
                          Remover
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{reply.message}</div>
                      {hasDynamicPreview && (
                        <div className="text-[11px] text-emerald-700 mt-1 whitespace-pre-wrap">Preview: {resolvedPreview}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Nova resposta</span>
                <button
                  type="button"
                  className="text-xs text-teal-700 hover:text-teal-800"
                  onClick={() => setQuickReplyMessage(message)}
                >
                  Usar texto atual
                </button>
              </div>
              <input
                type="text"
                value={quickReplyTitle}
                onChange={(e) => setQuickReplyTitle(e.target.value)}
                placeholder="Titulo"
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <textarea
                value={quickReplyMessage}
                onChange={(e) => setQuickReplyMessage(e.target.value)}
                placeholder="Mensagem (use {{nome}}, {{telefone}}, etc.)"
                className="w-full h-20 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                className="w-full px-3 py-2 text-sm rounded-md bg-teal-600 text-white hover:bg-teal-700"
                onClick={handleAddQuickReply}
                disabled={quickRepliesLoading}
              >
                {quickRepliesLoading ? 'Salvando...' : 'Salvar resposta rapida'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRewriteModal && (
        <div className="absolute bottom-full left-4 mb-2 w-[520px] max-w-[90vw] bg-white border border-slate-200 rounded-lg shadow-xl z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <span className="text-sm font-medium text-slate-900">Reescrever com GPT</span>
            <button
              type="button"
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => setShowRewriteModal(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-3">
            <div>
              <label className="text-xs text-slate-500">Texto original</label>
              <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                {rewriteOriginal}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs text-slate-500">Tom</label>
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
                className="self-end px-3 py-2 text-sm rounded-md bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => handleRewrite(rewriteOriginal, rewriteTone)}
                disabled={rewriteLoading}
              >
                {rewriteLoading ? 'Gerando...' : 'Gerar'}
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-500">Preview</label>
              <textarea
                ref={rewriteTextareaRef}
                value={rewriteResult}
                onChange={(event) => setRewriteResult(event.target.value)}
                placeholder="Resultado da reescrita"
                className="mt-1 w-full h-28 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">Use --- para dividir</span>
                <button
                  type="button"
                  className="text-xs text-teal-700 hover:text-teal-800 flex items-center gap-1"
                  onClick={handleInsertSplit}
                >
                  <Scissors className="w-3 h-3" />
                  Inserir divisao
                </button>
              </div>
            </div>
            {rewriteError && <div className="text-xs text-red-500">{rewriteError}</div>}
            <div>
              <div className="text-xs text-slate-500 mb-1">Partes ({rewriteChunks.length})</div>
              <div className="panel-dropdown-scrollbar max-h-32 overflow-y-auto border border-slate-200 bg-white rounded-md px-2 py-2 text-xs text-slate-700 space-y-2">
                {rewriteChunks.length === 0 ? (
                  <div className="text-slate-400">Nenhuma parte definida.</div>
                ) : (
                  rewriteChunks.map((chunk, index) => (
                    <div key={`chunk-${index}`} className="border-b border-slate-100 last:border-b-0 pb-2 last:pb-0">
                      <div className="text-slate-400">Parte {index + 1}</div>
                      <div className="whitespace-pre-wrap">{chunk}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setMessage(rewriteResult || rewriteOriginal);
                  setShowRewriteModal(false);
                }}
              >
                Usar no campo
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md bg-teal-600 text-white hover:bg-teal-700"
                onClick={handleSendRewriteChunks}
                disabled={rewriteLoading || isSending}
              >
                Enviar em partes
              </button>
            </div>
          </div>
        </div>
      )}
      {showFollowUpModal && (
        <div className="absolute bottom-full left-4 mb-2 w-[560px] max-w-[92vw] bg-white border border-slate-200 rounded-lg shadow-xl z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <div>
              <div className="text-sm font-medium text-slate-900">Gerar follow-up</div>
              <div className="text-[11px] text-slate-500">
                Baseado no historico carregado deste chat. Cada linha nao vazia vira uma mensagem.
              </div>
            </div>
            <button
              type="button"
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => setShowFollowUpModal(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {followUpProvider || followUpModel
                  ? `Gerado com ${followUpProvider || 'IA'}${followUpModel ? ` - ${followUpModel}` : ''}`
                  : 'A IA vai considerar o historico do chat e o contexto do lead.'}
              </div>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => void generateFollowUp()}
                disabled={followUpLoading || isSending}
              >
                {followUpLoading ? 'Gerando...' : 'Gerar novamente'}
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-500">Texto para aprovar</label>
              <textarea
                value={followUpDraft}
                onChange={(event) => setFollowUpDraft(event.target.value)}
                placeholder={followUpLoading ? 'Gerando follow-up...' : 'O texto gerado vai aparecer aqui.'}
                className="mt-1 w-full h-36 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="mt-2 text-xs text-slate-500">
                Dica: cada quebra de linha sera enviada como uma mensagem separada.
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Mensagens ({followUpMessages.length})</div>
              <div className="panel-dropdown-scrollbar max-h-36 overflow-y-auto border border-slate-200 bg-white rounded-md px-2 py-2 text-xs text-slate-700 space-y-2">
                {followUpLoading && followUpMessages.length === 0 ? (
                  <div className="text-slate-400">Gerando sugestao...</div>
                ) : followUpMessages.length === 0 ? (
                  <div className="text-slate-400">Nenhuma mensagem definida.</div>
                ) : (
                  followUpMessages.map((chunk, index) => (
                    <div key={`follow-up-chunk-${index}`} className="border-b border-slate-100 last:border-b-0 pb-2 last:pb-0">
                      <div className="text-slate-400">Mensagem {index + 1}</div>
                      <div className="whitespace-pre-wrap">{chunk}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {followUpError && <div className="text-xs text-red-500">{followUpError}</div>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => setShowFollowUpModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={handleUseFollowUpInField}
                disabled={followUpLoading || isSending || !followUpDraft.trim()}
              >
                Usar no campo
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleSendGeneratedFollowUp}
                disabled={followUpLoading || isSending || followUpMessages.length === 0}
              >
                {isSending ? 'Enviando...' : `Aprovar e enviar (${followUpMessages.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
      {showLinkPreviewModal && pendingLinkMessage && (
        <div className="absolute bottom-full left-4 mb-2 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <span className="text-sm font-medium text-slate-900">Enviar preview de link</span>
            <button
              type="button"
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setShowLinkPreviewModal(false);
                clearLinkPreviewDraft();
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
              <div className="text-[11px] text-slate-500">Mensagem</div>
              <div className="mt-0.5 text-xs text-slate-700 whitespace-pre-wrap break-words">{pendingLinkMessage}</div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Titulo (obrigatorio)</label>
              <input
                type="text"
                value={linkPreviewTitle}
                onChange={(e) => setLinkPreviewTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Descricao</label>
              <input
                type="text"
                value={linkPreviewDescription}
                onChange={(e) => setLinkPreviewDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">URL canonica</label>
              <input
                type="text"
                value={linkPreviewCanonical}
                onChange={(e) => setLinkPreviewCanonical(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Imagem (URL)</label>
              <input
                type="text"
                value={linkPreviewImage}
                onChange={(e) => setLinkPreviewImage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            {linkPreviewLoading && <div className="text-xs text-slate-500">Carregando metadados do link...</div>}
            {linkPreviewError && <div className="text-xs text-amber-700">{linkPreviewError}</div>}

            {(linkPreviewTitle || linkPreviewDescription || linkPreviewImage) && (
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                {linkPreviewImage && (
                  <img src={linkPreviewImage} alt={linkPreviewTitle || 'Link preview'} className="w-full h-28 object-cover bg-slate-100" />
                )}
                <div className="px-3 py-2 space-y-1">
                  <div className="text-[11px] text-slate-500 truncate">{linkPreviewSiteName || getUrlHostname(linkPreviewCanonical)}</div>
                  <div className="text-sm text-slate-800 line-clamp-2">{linkPreviewTitle || getUrlHostname(linkPreviewCanonical)}</div>
                  {linkPreviewDescription && <div className="text-xs text-slate-600 line-clamp-3">{linkPreviewDescription}</div>}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => fetchLinkPreviewMetadata(linkPreviewCanonical)}
                disabled={isSending || linkPreviewLoading || !linkPreviewCanonical.trim()}
              >
                {linkPreviewLoading ? 'Atualizando...' : 'Atualizar dados'}
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setShowLinkPreviewModal(false);
                  clearLinkPreviewDraft();
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md bg-teal-600 text-white hover:bg-teal-700"
                onClick={handleSendMessage}
                disabled={isSending}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
      {showContactPicker && (
        <div className="absolute bottom-full left-4 mb-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <span className="text-sm font-medium text-slate-900">Enviar contato</span>
            <button
              type="button"
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
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
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="panel-dropdown-scrollbar max-h-64 overflow-y-auto px-2 pb-2">
            {filteredContacts.length === 0 ? (
              <div className="text-sm text-slate-500 px-2 py-3">Nenhum contato encontrado.</div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-50 flex items-center justify-between"
                  onClick={() => handleSendContact(contact)}
                  disabled={isSending}
                >
                  <span className="text-sm text-slate-700 truncate">{contact.name || contact.id}</span>
                  <span className="text-xs text-teal-600">Enviar</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {editMessage && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-teal-700">Editando mensagem</div>
            <div className="text-sm text-slate-600 truncate">{editMessage.body}</div>
          </div>
          <button
            onClick={onCancelEdit}
            className="ml-2 p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {replyToMessage && !editMessage && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-teal-700">Respondendo a {replyToMessage.from}</div>
            <div className="text-sm text-slate-600 truncate">{replyToMessage.body}</div>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {selectedFile && (
        <div className="bg-gray-50 border-b border-slate-200 px-4 py-3">
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
              <div className="flex h-20 w-20 items-center justify-center rounded bg-gray-200">
                <FileIcon className="h-8 w-8 text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{selectedFile.name}</div>
              <div className="text-xs text-slate-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
              {(selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/')) && (
                <div className="text-xs text-blue-600 mt-1">
                  Digite uma legenda abaixo (opcional)
                </div>
              )}
            </div>
            <button
              onClick={clearFile}
              className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              disabled={isSending}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isDirectChat && (
        <div className="px-3 pt-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleOpenFollowUp}
            disabled={isSending || isRecording || followUpLoading || showLinkPreviewModal}
          >
            <Sparkles className="w-4 h-4" />
            <span>{followUpLoading ? 'Gerando follow-up...' : 'Gerar follow-up com IA'}</span>
          </button>
        </div>
      )}

      <div className="p-3 flex items-end gap-2 relative">
        <div className="relative">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSending}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {showAttachMenu && (
            <div className="absolute bottom-full left-0 z-[110] mb-2 min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              <button
                onClick={() => {
                  imageInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium">Imagem ou vídeo</span>
              </button>

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileIcon className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Documento</span>
              </button>

              <button
                onClick={handleSendLocation}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-medium">Localização</span>
              </button>

              <button
                onClick={() => {
                  setShowContactPicker(true);
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <Smile className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium">Contato</span>
              </button>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
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

        <div className="flex flex-1 items-end overflow-visible rounded-lg border border-slate-200 bg-white">
          <div className="relative z-[90]">
          <button
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-slate-100 hover:text-gray-700"
            disabled={isSending}
            onClick={toggleEmojiPicker}
            type="button"
            aria-label="Abrir emojis"
            aria-expanded={showEmojiPicker}
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-slate-100 hover:text-gray-700"
            disabled={isSending}
            onClick={() => setShowQuickReplies((prev) => !prev)}
            type="button"
            title="Respostas rapidas"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-slate-100 hover:text-gray-700"
            disabled={isSending || isRecording || showLinkPreviewModal}
            onClick={handleOpenRewrite}
            type="button"
            title="Reescrever com GPT"
          >
            <Sparkles className="w-5 h-5" />
          </button>

            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 z-[120] mb-2 grid w-56 grid-cols-8 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                {emojiList.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
                    onClick={() => {
                      insertEmoji(emoji);
                      setShowEmojiPicker(false);
                    }}
                  >
                    <span className="text-base">{emoji}</span>
                  </button>
                ))}
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
              value={message}
              onChange={(e) => {
                const nextValue = e.target.value;
                setMessage(nextValue);
                scheduleTextareaResize();
                if (nextValue.trim()) {
                  handleTyping();
                }
              }}
              onKeyDown={handleTextareaKeyDown}
              placeholder={selectedFile ? "Digite uma legenda (opcional)" : "Digite uma mensagem (use / para atalhos)"}
              className="flex-1 max-h-32 min-h-[40px] resize-none px-2 py-2 text-slate-900 placeholder:text-slate-500 focus:outline-none"
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
          <div className="absolute bottom-full left-14 right-14 z-[95] mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="px-3 py-2 text-[11px] text-slate-500 border-b border-slate-100 flex items-center justify-between gap-2">
              {slashCommandState.query
                ? `Atalho rapido: "${slashCommandState.query}"`
                : 'Digite / e o nome da resposta rapida'}
              <span className="text-[10px] text-slate-400">Enter/Tab aplica</span>
            </div>
            {slashCommandState.results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">Nenhuma resposta rapida encontrada.</div>
            ) : (
              <div className="panel-dropdown-scrollbar max-h-56 overflow-y-auto">
                {slashCommandState.results.map((reply, index) => {
                  const isActive = index === slashQuickReplyIndex;
                  const resolvedPreview = applyTemplateVariables(reply.message);
                  return (
                    <button
                      key={`slash-reply-${reply.id}`}
                      type="button"
                      className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-b-0 transition-colors ${
                        isActive ? 'bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                      onMouseEnter={() => setSlashQuickReplyIndex(index)}
                      onClick={() => handleUseSlashQuickReply(reply)}
                    >
                      <div className="text-xs font-semibold text-slate-800">/{reply.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{resolvedPreview}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-600">
                {formatTime(recordingTime)}
              </span>
            </div>
            <button
              onClick={cancelRecording}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              title="Cancelar"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Parar"
            >
              <StopCircle className="w-6 h-6" />
            </button>
          </div>
        ) : audioPreviewUrl ? (
          <div className="flex items-center gap-2">
            <button
              onClick={clearAudioPreview}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              title="Cancelar"
              disabled={isSending}
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={handleSendAudioPreview}
              disabled={isSending}
              className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Enviar audio"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        ) : message.trim() || selectedFile ? (
          <button
            onClick={handleSendMessage}
            disabled={isSending}
            className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={isSending}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
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
  prev.followUpContext === next.followUpContext
);

export const MessageInput = memo(MessageInputComponent, areMessageInputPropsEqual);
