import { useEffect, useMemo, useRef } from 'react';
import { MessageCircle, CheckCheck } from 'lucide-react';
import { ZAPIMessage, ZAPIMediaType } from '../lib/zapiService';

interface WhatsAppConversationViewerProps {
  messages: ZAPIMessage[];
  leadName: string;
  isLoading?: boolean;
}

export default function WhatsAppConversationViewer({
  messages,
  leadName,
  isLoading = false,
}: WhatsAppConversationViewerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const groupMessagesByDate = () => {
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
  };

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

  const groupedMessages = groupMessagesByDate();

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
        <div className="mb-2 w-full">
          <audio
            controls
            className="w-full min-w-[240px] sm:min-w-[320px]"
            src={message.mediaUrl}
          >
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

              const paddingClasses = isAudioMessage ? 'px-3 py-3' : 'px-4 py-2';

              return (
                <div
                  key={index}
                  className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-3`}
                >
                  <div
                    className={`${
                      isAudioMessage
                        ? 'w-full sm:max-w-xl'
                        : 'max-w-[75%]'
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
                    {renderMediaContent(message, mediaType)}
                    {message.text && (
                      <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
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
                      {message.fromMe && (
                        <CheckCheck className="w-4 h-4" />
                      )}
                    </div>
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
