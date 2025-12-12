import { useState, useEffect } from 'react';
import { X, Clock, User, ChevronLeft, ChevronRight, Filter, Calendar, Search } from 'lucide-react';
import { getWhatsAppMessageHistory, buildChatIdFromPhone, normalizeChatId, type WhapiMessage } from '../../lib/whatsappApiService';

interface FullMessageHistoryModalProps {
  chatId: string;
  chatName: string;
  onClose: () => void;
}

export function FullMessageHistoryModal({ chatId, chatName, onClose }: FullMessageHistoryModalProps) {
  const [messages, setMessages] = useState<WhapiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [filterFromMe, setFilterFromMe] = useState<boolean | undefined>(undefined);
  const [filterAuthor, setFilterAuthor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [resolvedChatId, setResolvedChatId] = useState<string | null>(null);
  const [resolvingChatId, setResolvingChatId] = useState(true);

  useEffect(() => {
    resolveChatId();
  }, [chatId]);

  useEffect(() => {
    if (resolvedChatId) {
      loadMessages();
    }
  }, [resolvedChatId, currentOffset, pageSize, filterFromMe, filterAuthor, filterDateFrom, filterDateTo, sortOrder]);

  const resolveChatId = async () => {
    console.log('[FullMessageHistoryModal] resolveChatId iniciado');
    console.log('[FullMessageHistoryModal] chatId recebido:', chatId);

    setResolvingChatId(true);
    setError(null);

    try {
      let finalChatId = chatId.includes('@') ? normalizeChatId(chatId) : buildChatIdFromPhone(chatId);

      if (!chatId.includes('@')) {
        console.log('[FullMessageHistoryModal] chatId não contém @, construindo...');
        console.log('[FullMessageHistoryModal] Chat ID construído:', finalChatId);
      } else {
        console.log('[FullMessageHistoryModal] chatId já está no formato correto');
      }

      console.log('[FullMessageHistoryModal] Testando chat ID com 1 mensagem...');
      const testResponse = await getWhatsAppMessageHistory({
        chatId: finalChatId,
        count: 1,
        offset: 0,
      });

      console.log('[FullMessageHistoryModal] Teste bem-sucedido, setando resolved chat ID');
      setResolvedChatId(finalChatId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar chat';
      setError(`Erro ao buscar histórico: ${errorMessage}`);
      console.error('[FullMessageHistoryModal] Erro ao buscar chat ID:', err);
    } finally {
      setResolvingChatId(false);
    }
  };

  const loadMessages = async () => {
    if (!resolvedChatId) {
      console.log('[FullMessageHistoryModal] loadMessages: resolvedChatId não definido');
      return;
    }

    console.log('[FullMessageHistoryModal] loadMessages iniciado');
    console.log('[FullMessageHistoryModal] resolvedChatId:', resolvedChatId);
    console.log('[FullMessageHistoryModal] pageSize:', pageSize);
    console.log('[FullMessageHistoryModal] currentOffset:', currentOffset);
    console.log('[FullMessageHistoryModal] filterFromMe:', filterFromMe);
    console.log('[FullMessageHistoryModal] filterAuthor:', filterAuthor);
    console.log('[FullMessageHistoryModal] filterDateFrom:', filterDateFrom);
    console.log('[FullMessageHistoryModal] filterDateTo:', filterDateTo);
    console.log('[FullMessageHistoryModal] sortOrder:', sortOrder);

    setLoading(true);
    setError(null);

    try {
      const timeFrom = filterDateFrom ? new Date(filterDateFrom).getTime() / 1000 : undefined;
      const timeTo = filterDateTo ? new Date(filterDateTo).getTime() / 1000 : undefined;

      console.log('[FullMessageHistoryModal] timeFrom:', timeFrom);
      console.log('[FullMessageHistoryModal] timeTo:', timeTo);

      const params = {
        chatId: resolvedChatId,
        count: pageSize,
        offset: currentOffset,
        timeFrom,
        timeTo,
        fromMe: filterFromMe,
        author: filterAuthor || undefined,
        sort: sortOrder,
      };

      console.log('[FullMessageHistoryModal] Chamando getWhatsAppMessageHistory com params:', params);

      const response = await getWhatsAppMessageHistory(params);

      console.log('[FullMessageHistoryModal] Response recebida:', {
        messageCount: response.messages.length,
        total: response.total,
      });

      setMessages(response.messages);
      setTotalMessages(response.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar histórico';
      setError(errorMessage);
      console.error('[FullMessageHistoryModal] Erro ao carregar histórico:', err);
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

  const getMessageTypeLabel = (message: WhapiMessage): string => {
    const typeLabels: Record<string, string> = {
      text: 'Texto',
      image: 'Imagem',
      video: 'Vídeo',
      audio: 'Áudio',
      voice: 'Voz',
      document: 'Documento',
      location: 'Localização',
      link_preview: 'Link',
      sticker: 'Sticker',
      contact: 'Contato',
      system: 'Sistema',
    };
    return typeLabels[message.type] || message.type;
  };

  const totalPages = Math.ceil(totalMessages / pageSize);
  const currentPage = Math.floor(currentOffset / pageSize) + 1;

  const goToPage = (page: number) => {
    const newOffset = (page - 1) * pageSize;
    setCurrentOffset(newOffset);
  };

  const nextPage = () => {
    if (currentOffset + pageSize < totalMessages) {
      setCurrentOffset(currentOffset + pageSize);
    }
  };

  const prevPage = () => {
    if (currentOffset > 0) {
      setCurrentOffset(Math.max(0, currentOffset - pageSize));
    }
  };

  const clearFilters = () => {
    setFilterFromMe(undefined);
    setFilterAuthor('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSortOrder('desc');
    setCurrentOffset(0);
  };

  const hasActiveFilters = filterFromMe !== undefined || filterAuthor || filterDateFrom || filterDateTo;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Histórico Completo</h2>
            <p className="text-sm text-slate-500 mt-1">{chatName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtros</span>
              {hasActiveFilters && (
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Ativos
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
                {totalMessages} mensagem{totalMessages !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {showFilters && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Período
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-slate-500">até</span>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Enviado por
                  </label>
                  <select
                    value={filterFromMe === undefined ? 'all' : filterFromMe ? 'me' : 'others'}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilterFromMe(value === 'all' ? undefined : value === 'me');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="me">Minhas mensagens</option>
                    <option value="others">Outros</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="desc">Mais recentes primeiro</option>
                  <option value="asc">Mais antigas primeiro</option>
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {resolvingChatId ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-slate-600">Buscando chat...</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-500 mb-4">
                <X className="w-12 h-12" />
              </div>
              <p className="text-red-600 font-medium mb-2">Erro ao carregar histórico</p>
              <p className="text-slate-600 text-sm mb-4">{error}</p>
              <button
                onClick={() => {
                  if (!resolvedChatId) {
                    resolveChatId();
                  } else {
                    loadMessages();
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Search className="w-16 h-16 mb-4 text-slate-300" />
              <p className="text-lg font-medium">Nenhuma mensagem encontrada</p>
              <p className="text-sm">Tente ajustar os filtros</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg border ${
                    message.from_me
                      ? 'bg-teal-50 border-teal-200 ml-8'
                      : 'bg-slate-50 border-slate-200 mr-8'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className={`w-4 h-4 ${message.from_me ? 'text-teal-600' : 'text-slate-600'}`} />
                      <span className={`text-sm font-medium ${message.from_me ? 'text-teal-900' : 'text-slate-900'}`}>
                        {message.from_me ? 'Você' : message.from_name || message.from || 'Desconhecido'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        message.from_me ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {getMessageTypeLabel(message)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(message.timestamp)}</span>
                    </div>
                  </div>

                  <div className={`text-sm ${message.from_me ? 'text-teal-900' : 'text-slate-700'}`}>
                    {getMessageBody(message)}
                  </div>

                  {message.context?.quoted_id && (
                    <div className="mt-2 pl-3 border-l-2 border-slate-300 text-xs text-slate-500 italic">
                      Em resposta a uma mensagem
                    </div>
                  )}

                  {message.status && (
                    <div className="mt-2 text-xs text-slate-500">
                      Status: {message.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentOffset(0);
                }}
                className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-slate-600">por página</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={currentOffset === 0}
                className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-sm text-slate-600">
                Página {currentPage} de {totalPages}
              </span>

              <button
                onClick={nextPage}
                disabled={currentOffset + pageSize >= totalMessages}
                className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
