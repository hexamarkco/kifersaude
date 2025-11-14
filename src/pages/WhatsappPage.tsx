import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  MapPin,
  Mic,
  Paperclip,
  Send,
  User,
  UserPlus,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AudioMessageBubble } from '../components/AudioMessageBubble';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { WhatsappChat, WhatsappMessage } from '../types/whatsapp';

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

const CHAT_PREVIEW_FALLBACK_TEXT = 'Sem mensagens recentes';

type ChatPreviewInfo = {
  icon: LucideIcon | null;
  text: string;
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

type WhatsappMessageRawPayload = {
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

type PendingAttachment = PendingMediaAttachment | PendingDocumentAttachment;

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getWhatsappFunctionUrl = (path: string) => {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();

  if (!functionsUrl && !supabaseUrl) {
    throw new Error(
      'Variáveis VITE_SUPABASE_FUNCTIONS_URL ou VITE_SUPABASE_URL não configuradas.',
    );
  }

  const normalizedBase = (() => {
    if (functionsUrl) {
      return functionsUrl.replace(/\/+$/, '');
    }

    // supabaseUrl is guaranteed to exist here because of the guard above
    const trimmedSupabase = supabaseUrl!.replace(/\/+$/, '');
    return `${trimmedSupabase}/functions/v1`;
  })();

  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
};

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Falha na requisição');
  }
  return response.json() as Promise<T>;
};

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

const sortMessagesByMoment = (messageList: OptimisticMessage[]) => {
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
  const [chats, setChats] = useState<WhatsappChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showChatListMobile, setShowChatListMobile] = useState(true);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const selectedChatIdRef = useRef<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  const selectedChat = useMemo(
    () => chats.find(chat => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const selectedChatDisplayName = useMemo(
    () => (selectedChat ? getChatDisplayName(selectedChat) : ''),
    [selectedChat],
  );

  const filteredChats = useMemo(() => {
    if (!chatSearchTerm.trim()) {
      return chats;
    }

    const normalizedTerm = chatSearchTerm.trim().toLowerCase();
    return chats.filter(chat => {
      const displayName = getChatDisplayName(chat).toLowerCase();
      const phone = chat.phone?.toLowerCase() ?? '';
      const preview = chat.last_message_preview?.toLowerCase() ?? '';

      return (
        displayName.includes(normalizedTerm) ||
        phone.includes(normalizedTerm) ||
        preview.includes(normalizedTerm)
      );
    });
  }, [chatSearchTerm, chats]);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchJson<{ chats: WhatsappChat[] }>(
        getWhatsappFunctionUrl('/whatsapp-webhook/chats'),
      );
      setChats(data.chats);
      if (!selectedChatId && data.chats.length > 0) {
        setSelectedChatId(data.chats[0].id);
      }
    } catch (error: any) {
      console.error('Erro ao carregar chats:', error);
      setErrorMessage('Não foi possível carregar as conversas.');
    } finally {
      setChatsLoading(false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

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

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowChatListMobile(false);
    }
  };

  const handleBackToChats = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowChatListMobile(true);
    }
  };

  useEffect(() => {
    if (!selectedChatId) {
      setShowChatListMobile(true);
    }
  }, [selectedChatId]);

  useEffect(() => {
    setShowAttachmentMenu(false);
    setPendingAttachment(null);
  }, [selectedChatId]);

  useEffect(() => {
    if (sendingMessage) {
      setShowAttachmentMenu(false);
    }
  }, [sendingMessage]);

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
        const response = await fetchJson<SendMessageResponse>(
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

  const sendPendingAttachment = async (
    attachment: PendingAttachment,
    caption: string,
  ): Promise<boolean> => {
    if (!selectedChat) {
      return false;
    }

    const normalizedCaption = caption.trim();
    const captionOrNull = normalizedCaption.length > 0 ? normalizedCaption : null;

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

      return sendWhatsappMessage({
        endpoint: '/whatsapp-webhook/send-document',
        body,
        optimisticMessage,
        errorFallback: 'Não foi possível enviar o documento.',
      });
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

      return sendWhatsappMessage({
        endpoint: '/whatsapp-webhook/send-image',
        body,
        optimisticMessage,
        errorFallback: 'Não foi possível enviar a imagem.',
      });
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

    return sendWhatsappMessage({
      endpoint: '/whatsapp-webhook/send-video',
      body,
      optimisticMessage,
      errorFallback: 'Não foi possível enviar o vídeo.',
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChat || sendingMessage) {
      return;
    }

    if (pendingAttachment) {
      const wasSent = await sendPendingAttachment(pendingAttachment, messageInput);
      if (wasSent) {
        setMessageInput('');
        setPendingAttachment(null);
      }
      return;
    }

    const trimmedMessage = messageInput.trim();
    if (trimmedMessage.length === 0) {
      return;
    }

    const optimisticMessage = createOptimisticMessage({ text: trimmedMessage });
    setMessageInput('');

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

  const toggleAttachmentMenu = () => {
    if (sendingMessage) {
      return;
    }

    setShowAttachmentMenu(previous => !previous);
  };

  const openDocumentPicker = () => {
    if (sendingMessage) {
      return;
    }

    setShowAttachmentMenu(false);
    documentInputRef.current?.click();
  };

  const openMediaPicker = () => {
    if (sendingMessage) {
      return;
    }

    setShowAttachmentMenu(false);
    mediaInputRef.current?.click();
  };

  const handleDocumentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file || sendingMessage) {
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

    if (!file || sendingMessage) {
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
    if (!selectedChat || sendingMessage) {
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
    if (!selectedChat || sendingMessage) {
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

  const handleStartAudioRecording = useCallback(() => {
    if (sendingMessage) {
      return;
    }

    if (!selectedChat) {
      setErrorMessage('Selecione uma conversa antes de gravar áudios.');
      return;
    }

    console.info('Iniciar gravação de áudio para', selectedChat.phone);
  }, [selectedChat, sendingMessage]);

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

  const getMessageAttachmentInfo = (message: OptimisticMessage): MessageAttachmentInfo => {
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

  const renderMessageContent = (message: OptimisticMessage, attachmentInfo: MessageAttachmentInfo) => {
    const isFromMe = message.from_me;

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
              <p className="whitespace-pre-wrap break-words">{attachmentInfo.imageCaption}</p>
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
              <p className="whitespace-pre-wrap break-words">{attachmentInfo.videoCaption}</p>
            </div>
          ) : null}
        </div>,
      );
    }

    if (attachmentInfo.audioUrl) {
      attachments.push(
        <div key="audio" className="flex flex-col gap-2 rounded-lg bg-white p-3 text-slate-800">
          <AudioMessageBubble src={attachmentInfo.audioUrl} seconds={attachmentInfo.audioSeconds} />
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
              <p className="text-sm font-medium text-slate-800">{attachmentInfo.documentFileName}</p>
              {attachmentInfo.documentCaption ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {attachmentInfo.documentCaption}
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
            <span>{title}</span>
          </div>
          {address ? <p className="text-sm text-slate-700">{address}</p> : null}
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
                <span>{contact.name ?? 'Contato'}</span>
              </div>
              {contact.businessDescription ? (
                <p className="text-xs text-slate-500">{contact.businessDescription}</p>
              ) : null}
              {contact.phones.length > 0 ? (
                <ul className="text-sm text-slate-700">
                  {contact.phones.map(phone => (
                    <li key={`${phone}-${index}`}>{phone}</li>
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
          {fallbackText}
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
        {fallbackText || UNSUPPORTED_MESSAGE_PLACEHOLDER}
      </p>
    );
  };

  const trimmedMessageInput = messageInput.trim();
  const shouldShowAudioAction = !pendingAttachment && trimmedMessageInput.length === 0;
  const isSendDisabled = sendingMessage || (!pendingAttachment && trimmedMessageInput.length === 0);
  const isActionButtonDisabled = shouldShowAudioAction ? sendingMessage : isSendDisabled;
  const messagePlaceholder = pendingAttachment
    ? 'Adicione uma legenda (opcional)'
    : 'Digite sua mensagem';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:flex-row">
      <aside
        className={`${showChatListMobile ? 'flex' : 'hidden'} md:flex w-full flex-1 flex-col border-b border-slate-200 md:w-80 md:flex-none md:border-b-0 md:border-r min-h-0`}
      >
        <div className="flex-shrink-0 border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-800">Conversas</h2>
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
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
          {chatsLoading && chats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Carregando conversas...</p>
          ) : chats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma conversa encontrada.</p>
          ) : filteredChats.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma conversa encontrada para a pesquisa.</p>
          ) : (
            filteredChats.map(chat => {
              const isActive = chat.id === selectedChatId;
              const previewInfo = getChatPreviewInfo(chat.last_message_preview);
              const PreviewIcon = previewInfo.icon;
              const avatarSeed = chat.chat_name || chat.phone || chat.id;
              const avatarColors = getAvatarColorStyles(avatarSeed);
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => handleSelectChat(chat.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    isActive ? 'bg-emerald-50 border-l-4 border-emerald-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">
                      {chatDisplayName}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                    {PreviewIcon ? (
                      <PreviewIcon
                        aria-hidden="true"
                        className="h-4 w-4 flex-shrink-0 text-slate-400"
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
                        <span className="truncate font-medium text-slate-800">
                          {chat.chat_name || chat.phone}
                        </span>
                        <span className="whitespace-nowrap text-xs text-slate-500">
                          {formatDateTime(chat.last_message_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                        {PreviewIcon ? (
                          <PreviewIcon
                            aria-hidden="true"
                            className="h-4 w-4 flex-shrink-0 text-slate-400"
                          />
                        ) : null}
                        <span className="block min-w-0 truncate">{previewInfo.text}</span>
                      </div>
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
                  <p className="truncate font-semibold text-slate-800">
                    {selectedChatDisplayName}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {selectedChat.is_group ? 'Grupo' : 'Contato'} • {selectedChat.phone}
                  </p>
                </div>
              </div>
            </header>

            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {messagesLoading && messages.length === 0 ? (
                <p className="text-sm text-slate-500">Carregando mensagens...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma mensagem neste chat.</p>
              ) : (
                messages.map(message => {
                  const isFromMe = message.from_me;
                  const attachmentInfo = getMessageAttachmentInfo(message);
                  const alignment = isFromMe ? 'items-end text-right' : 'items-start text-left';
                  const hasMediaWithoutPadding = attachmentInfo.hasMediaWithoutPadding;
                  const hasOnlyMediaWithoutPadding =
                    hasMediaWithoutPadding && !attachmentInfo.audioUrl && !attachmentInfo.documentUrl;
                  const bubblePaddingClasses = hasMediaWithoutPadding ? 'p-0' : 'px-4 py-3';
                  const bubbleOverflowClass = hasOnlyMediaWithoutPadding ? 'overflow-hidden' : '';
                  const bubbleClasses = isFromMe
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-800';

                  const shouldShowSenderName = selectedChat.is_group;
                  const senderDisplayName = shouldShowSenderName
                    ? getMessageSenderDisplayName(message)
                    : null;

                  return (
                    <div key={message.id} className={`flex flex-col ${alignment}`}>
                      {shouldShowSenderName ? (
                        <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                          {senderDisplayName ?? 'Participante'}
                        </span>
                      ) : null}
                      <div
                        className={`inline-flex max-w-[75%] flex-col rounded-2xl shadow-sm ${
                          isFromMe ? 'rounded-br-none' : 'rounded-bl-none'
                        } ${bubblePaddingClasses} ${bubbleOverflowClass} ${bubbleClasses}`}
                      >
                        {renderMessageContent(message, attachmentInfo)}
                      </div>
                      <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                        {formatDateTime(message.moment)}{' '}
                        {message.isOptimistic ? '(enviando...)' : message.status || ''}
                      </span>
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
                {pendingAttachment ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
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
                    ) : (
                      <div className="flex flex-col gap-2">
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
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      O texto digitado será enviado junto ao anexo como legenda.
                    </p>
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
                    disabled={sendingMessage}
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>

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

                  <textarea
                    className="flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-6 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                    maxLength={1000}
                    rows={1}
                    value={messageInput}
                    onChange={event => setMessageInput(event.target.value)}
                    placeholder={messagePlaceholder}
                    disabled={sendingMessage}
                  />
                  <button
                    type={shouldShowAudioAction ? 'button' : 'submit'}
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isActionButtonDisabled}
                    aria-label={shouldShowAudioAction ? 'Gravar áudio' : 'Enviar mensagem'}
                    onClick={shouldShowAudioAction ? handleStartAudioRecording : undefined}
                  >
                    {shouldShowAudioAction ? <Mic className="h-4 w-4" /> : <Send className="h-4 w-4" />}
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-500">Selecione uma conversa para começar.</p>
          </div>
        )}
      </section>
    </div>
  );
}
