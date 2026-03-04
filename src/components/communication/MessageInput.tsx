import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Paperclip, Mic, MapPin, Smile, X, Image as ImageIcon, File as FileIcon, StopCircle, Sparkles, Scissors, MessageSquare } from 'lucide-react';
import { sendWhatsAppMessage, sendMediaMessage, sendTypingState, sendRecordingState, normalizeChatId } from '../../lib/whatsappApiService';
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
  payload?: any;
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
}

export function MessageInput({
  chatId,
  onMessageSent,
  contacts = [],
  templateVariables = {},
  templateVariableShortcuts = [],
  replyToMessage,
  onCancelReply,
  editMessage,
  onCancelEdit,
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
  const [quickReplies, setQuickReplies] = useState<Array<{ id: string; title: string; message: string }>>([]);
  const [slashQuickReplyIndex, setSlashQuickReplyIndex] = useState(0);
  const [showRewriteModal, setShowRewriteModal] = useState(false);
  const [rewriteTone, setRewriteTone] = useState('claro');
  const [rewriteOriginal, setRewriteOriginal] = useState('');
  const [rewriteResult, setRewriteResult] = useState('');
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [showLinkPreviewModal, setShowLinkPreviewModal] = useState(false);
  const [linkPreviewTitle, setLinkPreviewTitle] = useState('');
  const [linkPreviewDescription, setLinkPreviewDescription] = useState('');
  const [linkPreviewCanonical, setLinkPreviewCanonical] = useState('');
  const [pendingLinkMessage, setPendingLinkMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
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

  const insertTemplateTokenOnDraft = (key: string) => {
    const token = `{{${key}}}`;
    setMessage((prev) => `${prev}${token}`);
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
    const stored = localStorage.getItem('whatsapp_quick_replies');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Array<{ id: string; title: string; message: string }>;
      if (Array.isArray(parsed)) {
        setQuickReplies(parsed);
      }
    } catch {
      setQuickReplies([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('whatsapp_quick_replies', JSON.stringify(quickReplies));
  }, [quickReplies]);

  const splitRewriteChunks = (text: string) =>
    text
      .split(/\n-{3,}\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

  const rewriteChunks = useMemo(
    () => splitRewriteChunks(rewriteResult || rewriteOriginal),
    [rewriteResult, rewriteOriginal],
  );

  const sendPlainTextMessage = async (text: string) => {
    const resolvedText = applyTemplateVariables(text).trim() || text.trim();

    const response = await sendWhatsAppMessage({
      chatId,
      contentType: 'string',
      content: resolvedText,
      quotedMessageId: replyToMessage?.id,
    });

    const normalizedChatId = normalizeChatId(chatId);
    const { error: insertError } = await supabase.from('whatsapp_messages').upsert({
      id: response.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      chat_id: normalizedChatId,
      from_number: null,
      to_number: normalizedChatId,
      type: 'text',
      body: resolvedText,
      has_media: false,
      timestamp: new Date().toISOString(),
      direction: 'outbound',
      payload: response,
    });

    if (insertError) {
      console.warn('Erro ao salvar mensagem no banco:', insertError);
    }

    const sentAt = new Date().toISOString();
    const textPayload: SentMessagePayload = {
      id: response.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      chat_id: chatId,
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
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [previewUrl, audioPreviewUrl]);

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    sendTypingState(chatId).catch(console.error);

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 3000);
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
      const urlMatch = resolvedMessage.match(/https?:\/\/\S+/i);
      if (urlMatch && !showLinkPreviewModal) {
        const url = urlMatch[0];
        setPendingLinkMessage(resolvedMessage);
        setLinkPreviewCanonical(url);
        setLinkPreviewTitle(url.replace(/^https?:\/\//i, '').split('/')[0]);
        setShowLinkPreviewModal(true);
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
        const fallbackBody = selectedFile.type.startsWith('audio/')
          ? '[Áudio]'
          : selectedFile.type.startsWith('image/')
            ? '[Imagem]'
            : selectedFile.type.startsWith('video/')
              ? '[Vídeo]'
              : '[Arquivo]';
        const mediaPayload: SentMessagePayload = {
          id: response?.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          chat_id: chatId,
          body: caption || fallbackBody,
          type: selectedFile.type || 'document',
          has_media: true,
          timestamp: sentAt,
          direction: 'outbound',
          created_at: sentAt,
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
            },
            quotedMessageId: replyToMessage?.id,
          });

          const normalizedChatId = normalizeChatId(chatId);
          const bodyText = pendingLinkMessage;
          const { error: insertError } = await supabase.from('whatsapp_messages').upsert({
            id: response.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            chat_id: normalizedChatId,
            from_number: null,
            to_number: normalizedChatId,
            type: 'link_preview',
            body: bodyText,
            has_media: true,
            timestamp: new Date().toISOString(),
            direction: 'outbound',
            payload: response,
          });

          if (insertError) {
            console.warn('Erro ao salvar mensagem no banco:', insertError);
          }

          const sentAt = new Date().toISOString();
          const textPayload: SentMessagePayload = {
            id: response.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            chat_id: chatId,
            body: bodyText,
            type: 'link_preview',
            has_media: true,
            timestamp: sentAt,
            direction: 'outbound',
            created_at: sentAt,
            payload: response,
          };

          setMessage('');
          setPendingLinkMessage(null);
          setShowLinkPreviewModal(false);
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
      alert('Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      const audioPayload: SentMessagePayload = {
        id: response?.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        chat_id: chatId,
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

  const handleAddQuickReply = () => {
    const title = quickReplyTitle.trim();
    const content = quickReplyMessage.trim();
    if (!title || !content) {
      alert('Preencha titulo e mensagem.');
      return;
    }
    const newReply = {
      id: `qr-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      message: content,
    };
    setQuickReplies((prev) => [newReply, ...prev]);
    setQuickReplyTitle('');
    setQuickReplyMessage('');
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

  const handleRemoveQuickReply = (replyId: string) => {
    setQuickReplies((prev) => prev.filter((reply) => reply.id !== replyId));
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
          await sendWhatsAppMessage({
            chatId,
            contentType: 'Location',
            content: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              description: 'Minha localização',
            },
          });

          if (onMessageSent) onMessageSent();
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
      const contactPayload: SentMessagePayload = {
        id: response?.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        chat_id: chatId,
        body: `[Contato: ${contact.name}]`,
        type: 'contact',
        has_media: false,
        timestamp: sentAt,
        direction: 'outbound',
        created_at: sentAt,
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
              {filteredQuickReplies.length === 0 ? (
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
              >
                Salvar resposta rapida
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
      {showLinkPreviewModal && pendingLinkMessage && (
        <div className="absolute bottom-full left-4 mb-2 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <span className="text-sm font-medium text-slate-900">Enviar preview de link</span>
            <button
              type="button"
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setShowLinkPreviewModal(false);
                setPendingLinkMessage(null);
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3 space-y-2">
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
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setShowLinkPreviewModal(false);
                  setPendingLinkMessage(null);
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
        <div className="px-4 py-3 bg-gray-50 border-b">
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
              <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                <FileIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{selectedFile.name}</div>
              <div className="text-xs text-gray-500">
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
              className="p-1 hover:bg-gray-200 rounded"
              disabled={isSending}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {templateVariableShortcuts.length > 0 && (
        <div className="px-3 pt-2 flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50">
          <span className="text-[11px] text-slate-500">Variaveis:</span>
          {templateVariableShortcuts.map((shortcut) => (
            <button
              key={`draft-variable-${shortcut.key}`}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
              onClick={() => insertTemplateTokenOnDraft(shortcut.key)}
              disabled={isSending || isRecording}
            >
              {shortcut.label}
            </button>
          ))}
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
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-slate-200 p-2 min-w-[220px] z-20">
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

        <div className="flex-1 bg-white border rounded-lg flex items-end overflow-hidden">
          <div className="relative">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            disabled={isSending}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            type="button"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            disabled={isSending}
            onClick={() => setShowQuickReplies((prev) => !prev)}
            type="button"
            title="Respostas rapidas"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            disabled={isSending || isRecording || showLinkPreviewModal}
            onClick={handleOpenRewrite}
            type="button"
            title="Reescrever com GPT"
          >
            <Sparkles className="w-5 h-5" />
          </button>

            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border rounded-lg shadow-lg p-2 grid grid-cols-8 gap-1 z-10">
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
                setMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleTextareaKeyDown}
              placeholder={selectedFile ? "Digite uma legenda (opcional)" : "Digite uma mensagem (use / para atalhos)"}
              className="flex-1 px-2 py-2 resize-none focus:outline-none max-h-32 min-h-[40px]"
              rows={1}
              disabled={isSending || isRecording}
              style={{
                height: 'auto',
                minHeight: '40px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
          )}
        </div>

        {slashCommandState.active && (
          <div className="absolute bottom-full left-14 right-14 mb-2 rounded-lg border border-slate-200 bg-white shadow-xl z-20 overflow-hidden">
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
