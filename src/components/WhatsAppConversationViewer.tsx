import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronDown, Clock, MessageCircle, XCircle } from 'lucide-react';
import { WhatsAppMessageDeliveryStatus } from '../lib/supabase';
import { ZAPIMessage, ZAPIMediaType } from '../lib/zapiService';

interface WhatsAppConversationViewerProps {
  messages: ZAPIMessage[];
  leadName: string;
  isLoading?: boolean;
}

const DELIVERY_STATUS_VISUALS: Record<
  WhatsAppMessageDeliveryStatus,
  { icon: typeof Check; className: string; label: string }
> = {
  pending: { icon: Clock, className: 'text-white/70', label: 'Enviando' },
  sent: { icon: Check, className: 'text-white/80', label: 'Enviado' },
  received: { icon: CheckCheck, className: 'text-white/80', label: 'Recebido' },
  read: { icon: CheckCheck, className: 'text-sky-100', label: 'Lido' },
  played: { icon: CheckCheck, className: 'text-sky-100', label: 'Reproduzido' },
  read_by_me: { icon: Check, className: 'text-white/80', label: 'Lido por você' },
  failed: { icon: XCircle, className: 'text-red-200', label: 'Falha no envio' },
};

const getDeliveryStatusVisual = (
  status?: WhatsAppMessageDeliveryStatus | null,
) => {
  if (!status) {
    return null;
  }

  return DELIVERY_STATUS_VISUALS[status] ?? null;
};

export default function WhatsAppConversationViewer({
  messages,
  leadName,
  isLoading = false,
}: WhatsAppConversationViewerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-message-menu]')) {
        setActiveMessageMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  };

  const groupedMessages = useMemo(() => {
    if (messages.length === 0) {
      return [] as { date: string; messages: ZAPIMessage[] }[];
    }

    const groups: { date: string; messages: ZAPIMessage[] }[] = [];
    let currentDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = formatDate(message.timestamp);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(message);
    });

    return groups;
  }, [messages]);

  const isGroupChat = useMemo(() => {
    if (messages.length === 0) {
      return false;
    }

    return messages.some((message) => {
      const phone = typeof message.phone === 'string' ? message.phone : '';
      const normalized = phone.toLowerCase();
      if (normalized.includes('@g.us') || normalized.includes('-group')) {
        return true;
      }
      const digits = phone.replace(/\D/g, '');
      return digits.length >= 20;
    });
  }, [messages]);

  const conversationName = useMemo(() => {
    if (!isGroupChat) {
      return leadName;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const chatName = messages[index]?.chatName;
      if (typeof chatName === 'string' && chatName.trim()) {
        return chatName.trim();
      }
    }

    return leadName;
  }, [isGroupChat, leadName, messages]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-b from-teal-50 to-white rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent mb-4"></div>
        <p className="text-slate-600">Carregando histórico de conversas...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-b from-slate-50 to-white rounded-lg border-2 border-dashed border-slate-300">
        <MessageCircle className="w-16 h-16 text-slate-400 mb-4" />
        <p className="text-lg font-medium text-slate-700 mb-2">Nenhuma conversa encontrada</p>
        <p className="text-sm text-slate-500">Não há histórico de mensagens com {leadName}</p>
      </div>
    );
  }

  const deriveMediaTypeFromUrl = (url?: string, mimeType?: string): ZAPIMediaType | undefined => {
    if (!url && !mimeType) return undefined;

    const normalizedMime = mimeType?.toLowerCase();
    const extension = url?.split('?')[0]?.split('.').pop()?.toLowerCase();

    const includesType = (value: string | undefined, candidates: string[]) =>
      value ? candidates.some((candidate) => value.includes(candidate)) : false;

    if (includesType(normalizedMime, ['audio/']) || includesType(extension, ['mp3', 'ogg', 'wav', 'm4a', 'aac'])) {
      return 'audio';
    }

    if (includesType(normalizedMime, ['video/']) || includesType(extension, ['mp4', 'mov', 'mkv', 'avi', '3gp', 'webm'])) {
      return 'video';
    }

    if (includesType(normalizedMime, ['image/']) || includesType(extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
      return 'image';
    }

    if (url) {
      return 'document';
    }

    return undefined;
  };

  const getMediaType = (message: ZAPIMessage): ZAPIMediaType | undefined => {
    return message.mediaType || deriveMediaTypeFromUrl(message.mediaUrl, message.mediaMimeType);
  };

  const getQuotedSenderLabel = (message: ZAPIMessage) => {
    if (message.quotedSenderName?.trim()) {
      return message.quotedSenderName.trim();
    }

    if (typeof message.quotedFromMe === 'boolean') {
      return message.quotedFromMe ? 'Você' : 'Contato';
    }

    return 'Contato';
  };

  const getQuotedPreviewText = (message: ZAPIMessage) => {
    const text = message.quotedText?.trim();
    if (text) {
      return text;
    }

    if (message.quotedMediaType) {
      switch (message.quotedMediaType) {
        case 'audio':
          return 'Mensagem de áudio';
        case 'video':
          return 'Vídeo';
        case 'image':
          return 'Imagem';
        case 'document':
          return 'Documento';
        default:
          return 'Mensagem';
      }
    }

    return 'Mensagem';
  };

  const renderMediaContent = (
    message: ZAPIMessage,
    mediaTypeOverride?: ZAPIMediaType,
  ) => {
    if (!message.mediaUrl) {
      return null;
    }

    const mediaType = mediaTypeOverride ?? getMediaType(message);

    if (mediaType === 'audio') {
      return (
        <div className="mb-2 w-full min-w-[264px] sm:min-w-[344px]">
          <audio controls className="w-full" src={message.mediaUrl}>
            Seu navegador não suporta reprodução de áudio.
          </audio>
        </div>
      );
    }

    if (mediaType === 'video') {
      return (
        <div className="mb-2">
          <video
            controls
            className="rounded-lg max-w-full h-auto"
            src={message.mediaUrl}
          >
            Seu navegador não suporta reprodução de vídeo.
          </video>
        </div>
      );
    }

    if (mediaType === 'image' || !mediaType) {
      return (
        <div className="mb-2">
          <img
            src={message.mediaUrl}
            alt="Mídia da conversa"
            className="rounded-lg max-w-full h-auto"
          />
        </div>
      );
    }

    return (
      <div className="mb-2">
        <a
          href={message.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Abrir mídia compartilhada
        </a>
      </div>
    );
  };

  const handleCopyMessage = async (message: ZAPIMessage) => {
    const textToCopy = message.text?.trim() || message.mediaUrl || '';
    if (!textToCopy) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      console.warn('Clipboard API não disponível.');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (error) {
      console.error('Erro ao copiar mensagem:', error);
    }
  };

  return (
    <div className="flex flex-col h-96 bg-gradient-to-b from-teal-50 to-white rounded-lg overflow-hidden border border-slate-200">
      <div className="bg-teal-600 text-white px-4 py-3 flex items-center space-x-3">
        <MessageCircle className="w-5 h-5" />
        <div>
          <p className="font-medium">{conversationName}</p>
          <p className="text-xs text-teal-100">{messages.length} mensagens</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex}>
            <div className="flex justify-center mb-4">
              <span className="text-xs bg-white text-slate-600 px-3 py-1 rounded-full shadow-sm border border-slate-200">
                {group.date}
              </span>
            </div>

            {group.messages.map((message, index) => {
              const mediaType = getMediaType(message);
              const isAudioMessage = mediaType === 'audio';

              const isMenuOpen = activeMessageMenu === message.messageId;
              const dropdownHorizontalPosition = message.fromMe ? 'right-0' : 'left-0';
              const arrowHorizontalPosition = message.fromMe ? 'right-[-36px]' : 'left-[-36px]';

              const paddingClasses = isAudioMessage ? 'px-3 py-3' : 'px-4 py-2';
              const quotedSenderLabel = getQuotedSenderLabel(message);
              const quotedPreviewText = getQuotedPreviewText(message);
              const hasQuotedMessage = Boolean(
                message.quotedMessageId || message.quotedText || message.quotedMediaType
              );

              const isDownloadAvailable =
                Boolean(message.mediaUrl) && ['audio', 'video', 'image'].includes(mediaType ?? '');

              const deliveryStatus = message.fromMe ? message.deliveryStatus ?? 'sent' : null;
              const statusVisual = deliveryStatus ? getDeliveryStatusVisual(deliveryStatus) : null;
              const StatusIcon = statusVisual?.icon;

              return (
                <div
                  key={index}
                  className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-3`}
                >
                  <div className="relative group" data-message-menu>
                    <div
                      className={`${
                        isAudioMessage
                          ? 'w-full max-w-[95%] sm:max-w-[85%]'
                          : 'max-w-[95%] sm:max-w-[85%]'
                      } rounded-lg ${paddingClasses} shadow-sm flex flex-col space-y-2 ${
                        message.fromMe
                          ? 'bg-teal-500 text-white rounded-br-none'
                          : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {isGroupChat && (
                        <span
                          className={`text-xs font-semibold ${
                            message.fromMe ? 'text-teal-100 self-end' : 'text-teal-600'
                          }`}
                      >
                        {message.fromMe ? 'Você' : message.senderName?.trim() || 'Participante'}
                      </span>
                    )}
                    {hasQuotedMessage && (
                      <div
                        className={`rounded-lg border-l-4 px-3 py-2 text-xs ${
                          message.fromMe
                            ? 'bg-white/10 border-white/50 text-teal-50'
                            : 'bg-teal-50 border-teal-400 text-teal-800'
                        }`}
                      >
                        <p className="font-semibold tracking-wide text-[11px] uppercase opacity-90">
                          ~ {quotedSenderLabel}
                        </p>
                        <p className="mt-1 text-[13px] whitespace-pre-wrap break-normal">
                          {quotedPreviewText}
                        </p>
                      </div>
                    )}
                    {renderMediaContent(message, mediaType)}
                    {message.text && (
                      <p className="text-sm whitespace-pre-wrap break-normal">{message.text}</p>
                    )}
                    {!message.text && message.mediaUrl && mediaType === 'audio' && (
                      <p className="text-xs mt-2 opacity-80">
                        Mensagem de áudio
                      </p>
                    )}
                    <div
                      className={`flex items-center justify-end space-x-1 mt-1 text-xs ${
                        message.fromMe ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      <span>{formatTime(message.timestamp)}</span>
                      {StatusIcon && statusVisual && (
                        <span className="flex items-center" title={statusVisual.label}>
                          <StatusIcon
                            className={`w-4 h-4 ${statusVisual.className}`}
                            aria-hidden="true"
                          />
                          <span className="sr-only">{statusVisual.label}</span>
                        </span>
                      )}
                    </div>
                  </div>
                    <button
                      type="button"
                      aria-label="Abrir opções da mensagem"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveMessageMenu((current) =>
                          current === message.messageId ? null : message.messageId
                        );
                      }}
                      className={`absolute top-2 ${arrowHorizontalPosition} w-8 h-8 rounded-full bg-white text-slate-500 shadow-sm border border-slate-200 flex items-center justify-center transition-opacity duration-150 ${
                        isMenuOpen
                          ? 'opacity-100'
                          : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                      }`}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-150 ${
                          isMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isMenuOpen && (
                      <div
                        className={`absolute z-30 mt-2 w-56 bg-white text-slate-700 rounded-lg shadow-xl border border-slate-200 overflow-hidden ${dropdownHorizontalPosition}`}
                      >
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 text-xl">
                          <button type="button" className="hover:scale-110 transition-transform" aria-label="Reagir com gostei">
                            👍
                          </button>
                          <button type="button" className="hover:scale-110 transition-transform" aria-label="Reagir com coração">
                            ❤️
                          </button>
                          <button type="button" className="hover:scale-110 transition-transform" aria-label="Reagir com risada">
                            😂
                          </button>
                          <button type="button" className="hover:scale-110 transition-transform" aria-label="Reagir com surpresa">
                            😮
                          </button>
                          <button type="button" className="hover:scale-110 transition-transform" aria-label="Reagir com tristeza">
                            😢
                          </button>
                          <button type="button" className="hover:scale-110 transition-transform" aria-label="Reagir com gratidão">
                            🙏
                          </button>
                          <button type="button" className="hover:scale-110 transition-transform" aria-label="Adicionar nova reação">
                            +
                          </button>
                        </div>
                        <div className="py-2 text-sm">
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Responder mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Responder
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Reagir à mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Reagir
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              handleCopyMessage(message);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Copiar
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Encaminhar mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Encaminhar
                          </button>
                          {isDownloadAvailable && message.mediaUrl && (
                            <a
                              className="block px-4 py-2 hover:bg-slate-100 transition-colors"
                              href={message.mediaUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                setActiveMessageMenu(null);
                              }}
                            >
                              Baixar mídia
                            </a>
                          )}
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Fixar mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Fixar
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Favoritar mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Favoritar
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Adicionar texto às notas', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Adicionar texto às notas
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Selecionar mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Selecionar
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              console.info('Denunciar mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Denunciar
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors text-red-600"
                            onClick={() => {
                              console.info('Apagar mensagem', message.messageId);
                              setActiveMessageMenu(null);
                            }}
                          >
                            Apagar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
