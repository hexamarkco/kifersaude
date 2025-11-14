import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, MapPin, Paperclip, Send, UserPlus } from 'lucide-react';
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
  [key: string]: unknown;
};

const UNSUPPORTED_MESSAGE_PLACEHOLDER = '[tipo de mensagem não suportado ainda]';

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

export default function WhatsappPage() {
  const [chats, setChats] = useState<WhatsappChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
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

  const filteredChats = useMemo(() => {
    if (!chatSearchTerm.trim()) {
      return chats;
    }

    const normalizedTerm = chatSearchTerm.trim().toLowerCase();
    return chats.filter(chat => {
      const name = chat.chat_name?.toLowerCase() ?? '';
      const phone = chat.phone?.toLowerCase() ?? '';
      const preview = chat.last_message_preview?.toLowerCase() ?? '';

      return (
        name.includes(normalizedTerm) ||
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
            const deletedMessage = payload.old;
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

          const incomingMessage = payload.new;
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

            const existingIndex = previousMessages.findIndex(
              message => message.id === normalizedMessage.id,
            );

            if (existingIndex !== -1) {
              const updatedMessages = [...previousMessages];
              updatedMessages[existingIndex] = normalizedMessage;
              return sortMessagesByMoment(updatedMessages);
            }

            return sortMessagesByMoment([...previousMessages, normalizedMessage]);
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
        setMessages(data.messages.map(message => ({ ...message, isOptimistic: false })));
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

        setMessages(previous =>
          sortMessagesByMoment(
            previous.map(message => (message.id === optimisticId ? serverMessage : message)),
          ),
        );

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
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        setMessages(previous => previous.filter(message => message.id !== optimisticId));
        setErrorMessage(errorFallback ?? 'Não foi possível enviar a mensagem.');
      } finally {
        setSendingMessage(false);
      }
    },
    [setChats],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChat || sendingMessage) {
      return;
    }

    const trimmedMessage = messageInput.trim();
    if (trimmedMessage.length === 0) {
      return;
    }

    const optimisticMessage = createOptimisticMessage({ text: trimmedMessage });
    setMessageInput('');

    await sendWhatsappMessage({
      endpoint: '/whatsapp-webhook/send-message',
      body: { phone: selectedChat.phone, message: trimmedMessage },
      optimisticMessage,
      errorFallback: 'Não foi possível enviar a mensagem.',
    });
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

    if (!file || !selectedChat || sendingMessage) {
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileName = file.name || null;
      const extension =
        extractFileExtension(fileName) ?? extractExtensionFromMime(file.type) ?? null;

      if (!extension) {
        setErrorMessage('Não foi possível identificar a extensão do documento selecionado.');
        return;
      }

      const optimisticMessage = createOptimisticMessage({
        text: fileName ? `📄 ${fileName}` : '📄 Documento enviado',
        raw_payload: {
          document: {
            documentUrl: dataUrl,
            fileName,
            title: fileName,
            caption: null,
          },
        },
      });

      await sendWhatsappMessage({
        endpoint: '/whatsapp-webhook/send-document',
        body: {
          phone: selectedChat.phone,
          document: dataUrl,
          fileName: fileName ?? undefined,
          extension,
        },
        optimisticMessage,
        errorFallback: 'Não foi possível enviar o documento.',
      });
    } catch (error) {
      console.error('Erro ao preparar documento para envio:', error);
      setErrorMessage('Não foi possível preparar o documento para envio.');
    }
  };

  const handleMediaChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file || !selectedChat || sendingMessage) {
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

      if (isImage) {
        const optimisticMessage = createOptimisticMessage({
          text: file.name ? `🖼️ ${file.name}` : '🖼️ Imagem enviada',
          raw_payload: {
            image: {
              imageUrl: dataUrl,
              caption: null,
            },
          },
        });

        await sendWhatsappMessage({
          endpoint: '/whatsapp-webhook/send-image',
          body: { phone: selectedChat.phone, image: dataUrl },
          optimisticMessage,
          errorFallback: 'Não foi possível enviar a imagem.',
        });
        return;
      }

      const optimisticMessage = createOptimisticMessage({
        text: file.name ? `🎬 ${file.name}` : '🎬 Vídeo enviado',
        raw_payload: {
          video: {
            videoUrl: dataUrl,
            caption: null,
          },
        },
      });

      await sendWhatsappMessage({
        endpoint: '/whatsapp-webhook/send-video',
        body: { phone: selectedChat.phone, video: dataUrl },
        optimisticMessage,
        errorFallback: 'Não foi possível enviar o vídeo.',
      });
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

  const renderMessageContent = useCallback((message: OptimisticMessage) => {
    const payload =
      message.raw_payload && typeof message.raw_payload === 'object'
        ? (message.raw_payload as WhatsappMessageRawPayload)
        : null;
    const isFromMe = message.from_me;

    const attachmentCardBaseClass = `flex flex-col gap-2 rounded-lg ${
      isFromMe ? 'bg-white text-slate-800' : 'bg-transparent text-slate-800'
    } p-3`;

    const attachments: JSX.Element[] = [];

    const imageUrl = payload ? toNonEmptyString(payload?.image?.imageUrl) : null;
    if (imageUrl) {
      const caption = toNonEmptyString(payload?.image?.caption);
      attachments.push(
        <div key="image" className={`${attachmentCardBaseClass} overflow-hidden`}>
          <img
            src={imageUrl}
            alt={caption ?? 'Imagem recebida'}
            className="max-h-80 w-full rounded-md object-contain bg-slate-200/40"
          />
          {caption ? (
            <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{caption}</p>
          ) : null}
        </div>,
      );
    }

    const audioUrl = payload ? toNonEmptyString(payload?.audio?.audioUrl) : null;
    if (audioUrl) {
      attachments.push(
        <div key="audio" className={attachmentCardBaseClass}>
          <AudioMessageBubble src={audioUrl} seconds={payload?.audio?.seconds ?? null} />
        </div>,
      );
    }

    const videoUrl = payload ? toNonEmptyString(payload?.video?.videoUrl) : null;
    if (videoUrl) {
      const caption = toNonEmptyString(payload?.video?.caption);
      attachments.push(
        <div key="video" className={`${attachmentCardBaseClass} overflow-hidden`}>
          <video
            controls
            preload="metadata"
            src={videoUrl}
            className="max-h-80 w-full rounded-md bg-black"
          />
          {caption ? (
            <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{caption}</p>
          ) : null}
        </div>,
      );
    }

    const documentUrl = payload ? toNonEmptyString(payload?.document?.documentUrl) : null;
    if (documentUrl) {
      const fileName =
        toNonEmptyString(payload?.document?.fileName) ??
        toNonEmptyString(payload?.document?.title) ??
        'Documento';
      const caption = toNonEmptyString(payload?.document?.caption);
      attachments.push(
        <div key="document" className={attachmentCardBaseClass}>
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 underline"
          >
            📄 {fileName}
          </a>
          {caption ? (
            <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{caption}</p>
          ) : null}
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
        <p key="text" className="whitespace-pre-wrap break-words text-sm">
          {fallbackText}
        </p>,
      );
    }

    if (attachments.length > 0) {
      return <div className="flex flex-col gap-2">{attachments}</div>;
    }

    return (
      <p className="whitespace-pre-wrap break-words text-sm">
        {fallbackText || UNSUPPORTED_MESSAGE_PLACEHOLDER}
      </p>
    );
  }, []);

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
                      {chat.chat_name || chat.phone}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(chat.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 truncate">
                    {chat.last_message_preview || 'Sem mensagens recentes'}
                  </p>
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
                    alt={selectedChat.chat_name || selectedChat.phone}
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-semibold text-emerald-600">
                    {(selectedChat.chat_name || selectedChat.phone).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">
                    {selectedChat.chat_name || selectedChat.phone}
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
                  const alignment = isFromMe ? 'items-end text-right' : 'items-start text-left';
                  const bubbleClasses = isFromMe
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-800';

                  return (
                    <div key={message.id} className={`flex flex-col ${alignment}`}>
                      <div
                        className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${
                          isFromMe ? 'rounded-br-none' : 'rounded-bl-none'
                        } ${bubbleClasses}`}
                      >
                        {renderMessageContent(message)}
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
                className="relative flex w-full items-center gap-3 rounded border border-slate-200 bg-slate-50/60 px-3 py-2"
              >
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
                  placeholder="Digite sua mensagem"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={sendingMessage}
                  aria-label="Enviar mensagem"
                >
                  <Send className="h-4 w-4" />
                </button>

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
