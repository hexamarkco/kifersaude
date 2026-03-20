import { useState, useEffect, useRef } from 'react';
import { Clock, User, AlertCircle, MessageSquare } from 'lucide-react';
import { getWhatsAppMessageHistory, buildChatIdFromPhone, normalizeChatId, type WhapiMessage } from '../../../../lib/whatsappApiService';
import { formatWhatsAppAudioTranscriptionLabel } from '../../../../lib/whatsappAudioTranscription';
import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';

interface MessageHistoryModalProps {
  messageId: string;
  chatId: string;
  messageTimestamp: number;
  isOpen: boolean;
  onClose: () => void;
}

export function MessageHistoryModal({ messageId, chatId, messageTimestamp, isOpen, onClose }: MessageHistoryModalProps) {
  const [messages, setMessages] = useState<WhapiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const resolvedChatId = chatId ? (chatId.includes('@') ? normalizeChatId(chatId) : buildChatIdFromPhone(chatId)) : null;

  useEffect(() => {
    if (!isOpen) {
      requestIdRef.current += 1;
      setMessages([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && resolvedChatId) {
      void loadHistory(resolvedChatId);
    }
  }, [isOpen, resolvedChatId, messageTimestamp]);

  const loadHistory = async (activeChatId: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);
    try {
      const contextWindow = 10 * 60;
      const timeFrom = Math.floor(messageTimestamp / 1000) - contextWindow;
      const timeTo = Math.floor(messageTimestamp / 1000) + contextWindow;

      const response = await getWhatsAppMessageHistory({
        chatId: activeChatId,
        count: 50,
        timeFrom,
        timeTo,
        sort: 'asc',
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      setMessages(response.messages);
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError(err instanceof Error ? err.message : 'Erro ao carregar contexto');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessageBody = (message: WhapiMessage): string => {
    const transcription = formatWhatsAppAudioTranscriptionLabel(message.audio || message.voice || message);
    if (transcription) return transcription;
    if (message.text?.body) return message.text.body;
    if (message.image) return message.image.caption || '[Imagem]';
    if (message.gif) return '[GIF]';
    if (message.video) return message.video.caption || '[Vídeo]';
    if (message.audio) return '[Áudio]';
    if (message.voice) return '[Mensagem de voz]';
    if (message.document) return `[Documento${message.document.filename ? ': ' + message.document.filename : ''}]`;
    if (message.location) return `[Localização${message.location.address ? ': ' + message.location.address : ''}]`;
    if (message.link_preview) return message.link_preview.body;
    if (message.sticker) return '[Sticker]';
    if (message.contact) return `[Contato: ${message.contact.name}]`;
    return `[${message.type}]`;
  };

  const isTargetMessage = (message: WhapiMessage) => {
    return message.id === messageId;
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Contexto da Mensagem"
      description="Mensagens próximas (últimos 10 minutos)"
      size="lg"
      panelClassName="max-w-3xl"
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!loading && !error && messages.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <MessageSquare className="h-4 w-4 text-amber-600" />
            <span>{messages.length} mensagens carregadas no contexto</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-600"></div>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Erro ao carregar contexto</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="py-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-slate-400" />
            <p className="text-slate-600">Nenhuma mensagem encontrada neste periodo</p>
          </div>
        )}

        {!loading && !error && messages.length > 0 && (
          <div className="space-y-3">
            {messages.map((message) => {
              const isTarget = isTargetMessage(message);
              return (
                <div
                  key={message.id}
                  className={`rounded-lg p-4 transition-all ${
                    isTarget
                      ? 'border-2 border-amber-500 bg-amber-100 shadow-md'
                      : message.from_me
                        ? 'ml-8 border border-amber-200 bg-amber-50'
                        : 'mr-8 border border-slate-200 bg-slate-50'
                  }`}
                >
                  {isTarget && (
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Esta mensagem
                    </div>
                  )}
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <User
                        className={`h-4 w-4 ${
                          isTarget ? 'text-amber-600' : message.from_me ? 'text-amber-600' : 'text-slate-600'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isTarget ? 'text-amber-900' : message.from_me ? 'text-amber-900' : 'text-slate-900'
                        }`}
                      >
                        {message.from_me ? 'Você' : message.from_name || message.from || 'Desconhecido'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimestamp(message.timestamp)}</span>
                    </div>
                  </div>

                  <div
                    className={`text-sm ${
                      isTarget ? 'font-medium text-amber-900' : message.from_me ? 'text-amber-900' : 'text-slate-700'
                    }`}
                  >
                    {getMessageBody(message)}
                  </div>

                  {message.status && <div className="mt-2 text-xs text-slate-500">Status: {message.status}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
