import { useState, useEffect } from 'react';
import { X, Clock, User, AlertCircle, MessageSquare } from 'lucide-react';
import { getWhatsAppMessageHistory, type WhapiMessage } from '../../lib/whatsappApiService';

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

  useEffect(() => {
    if (isOpen && chatId) {
      loadHistory();
    }
  }, [isOpen, chatId, messageTimestamp]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const contextWindow = 10 * 60;
      const timeFrom = Math.floor(messageTimestamp / 1000) - contextWindow;
      const timeTo = Math.floor(messageTimestamp / 1000) + contextWindow;

      const response = await getWhatsAppMessageHistory({
        chatId,
        count: 50,
        timeFrom,
        timeTo,
        sort: 'asc',
      });

      setMessages(response.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contexto');
    } finally {
      setLoading(false);
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
    if (message.text?.body) return message.text.body;
    if (message.image) return message.image.caption || '[Imagem]';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Contexto da Mensagem</h2>
              <p className="text-sm text-gray-500 mt-1">Mensagens próximas (últimos 10 minutos)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erro ao carregar contexto</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nenhuma mensagem encontrada neste período</p>
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
                        ? 'bg-blue-100 border-2 border-blue-500 shadow-md scale-105'
                        : message.from_me
                        ? 'bg-teal-50 border border-teal-200 ml-8'
                        : 'bg-slate-50 border border-slate-200 mr-8'
                    }`}
                  >
                    {isTarget && (
                      <div className="mb-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        Esta mensagem
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className={`w-4 h-4 ${
                          isTarget ? 'text-blue-600' : message.from_me ? 'text-teal-600' : 'text-slate-600'
                        }`} />
                        <span className={`text-sm font-medium ${
                          isTarget ? 'text-blue-900' : message.from_me ? 'text-teal-900' : 'text-slate-900'
                        }`}>
                          {message.from_me ? 'Você' : message.from_name || message.from || 'Desconhecido'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(message.timestamp)}</span>
                      </div>
                    </div>

                    <div className={`text-sm ${
                      isTarget ? 'text-blue-900 font-medium' : message.from_me ? 'text-teal-900' : 'text-slate-700'
                    }`}>
                      {getMessageBody(message)}
                    </div>

                    {message.status && (
                      <div className="mt-2 text-xs text-slate-500">
                        Status: {message.status}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
