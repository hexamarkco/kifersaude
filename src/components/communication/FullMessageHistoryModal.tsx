import { useState, useEffect } from 'react';
import { X, Clock, User, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import { getWhatsAppMessageHistory, buildChatIdFromPhone, normalizeChatId, type WhapiMessage } from '../../lib/whatsappApiService';
import FilterSingleSelect from '../FilterSingleSelect';
import DateTimePicker from '../ui/DateTimePicker';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';

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
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (resolvedChatId) {
      loadMessages();
    }
  }, [resolvedChatId, currentOffset, pageSize, filterFromMe, filterAuthor, filterDateFrom, filterDateTo, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveChatId = async () => {
    console.log('[FullMessageHistoryModal] resolveChatId iniciado');
    console.log('[FullMessageHistoryModal] chatId recebido:', chatId);

    setResolvingChatId(true);
    setError(null);

    try {
      const finalChatId = chatId.includes('@') ? normalizeChatId(chatId) : buildChatIdFromPhone(chatId);

      if (!chatId.includes('@')) {
        console.log('[FullMessageHistoryModal] chatId não contém @, construindo...');
        console.log('[FullMessageHistoryModal] Chat ID construído:', finalChatId);
      } else {
        console.log('[FullMessageHistoryModal] chatId já está no formato correto');
      }

      console.log('[FullMessageHistoryModal] Testando chat ID com 1 mensagem...');
      await getWhatsAppMessageHistory({
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
    <ModalShell
      isOpen
      onClose={onClose}
      title="Historico Completo"
      description={chatName}
      size="xl"
      panelClassName="max-w-4xl"
      bodyClassName="p-0"
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Mostrar</span>
            <div className="w-24">
              <FilterSingleSelect
                icon={Filter}
                value={String(pageSize)}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentOffset(0);
                }}
                placeholder="50"
                includePlaceholderOption={false}
                options={[
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                ]}
              />
            </div>
            <span className="text-sm text-slate-600">por pagina</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="icon" size="icon" onClick={prevPage} disabled={currentOffset === 0}>
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <span className="text-sm text-slate-600">
              Pagina {currentPage} de {Math.max(1, totalPages)}
            </span>

            <Button
              variant="icon"
              size="icon"
              onClick={nextPage}
              disabled={currentOffset + pageSize >= totalMessages}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700">Ativos</span>
            )}
          </Button>

          <span className="text-sm text-slate-600">
            {totalMessages} mensagem{totalMessages !== 1 ? 's' : ''}
          </span>
        </div>

        {showFilters && (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Periodo</label>
                <div className="flex items-center gap-2">
                  <DateTimePicker
                    type="date"
                    value={filterDateFrom}
                    onChange={setFilterDateFrom}
                    placeholder="Data inicial"
                  />
                  <span className="text-slate-500">ate</span>
                  <DateTimePicker
                    type="date"
                    value={filterDateTo}
                    onChange={setFilterDateTo}
                    placeholder="Data final"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Enviado por</label>
                <FilterSingleSelect
                  icon={User}
                  value={filterFromMe === undefined ? 'all' : filterFromMe ? 'me' : 'others'}
                  onChange={(value) => {
                    setFilterFromMe(value === 'all' ? undefined : value === 'me');
                  }}
                  placeholder="Enviado por"
                  includePlaceholderOption={false}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'me', label: 'Minhas mensagens' },
                    { value: 'others', label: 'Outros' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-56">
                <FilterSingleSelect
                  icon={Clock}
                  value={sortOrder}
                  onChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                  placeholder="Ordenacao"
                  includePlaceholderOption={false}
                  options={[
                    { value: 'desc', label: 'Mais recentes primeiro' },
                    { value: 'asc', label: 'Mais antigas primeiro' },
                  ]}
                />
              </div>

              <div className="w-full max-w-sm">
                <Input
                  value={filterAuthor}
                  onChange={(event) => setFilterAuthor(event.target.value)}
                  placeholder="Filtrar por autor"
                  leftIcon={Search}
                />
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-h-[65vh] overflow-y-auto p-6">
        {resolvingChatId ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-teal-600"></div>
            <p className="text-slate-600">Buscando chat...</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-600"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 text-red-500">
              <X className="h-12 w-12" />
            </div>
            <p className="mb-2 font-medium text-red-600">Erro ao carregar historico</p>
            <p className="mb-4 text-sm text-slate-600">{error}</p>
            <Button
              variant="primary"
              onClick={() => {
                if (!resolvedChatId) {
                  resolveChatId();
                } else {
                  loadMessages();
                }
              }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Search className="mb-4 h-16 w-16 text-slate-300" />
            <p className="text-lg font-medium">Nenhuma mensagem encontrada</p>
            <p className="text-sm">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border p-4 ${
                  message.from_me ? 'ml-8 border-teal-200 bg-teal-50' : 'mr-8 border-slate-200 bg-slate-50'
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <User className={`h-4 w-4 ${message.from_me ? 'text-teal-600' : 'text-slate-600'}`} />
                    <span className={`text-sm font-medium ${message.from_me ? 'text-teal-900' : 'text-slate-900'}`}>
                      {message.from_me ? 'Voce' : message.from_name || message.from || 'Desconhecido'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        message.from_me ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {getMessageTypeLabel(message)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimestamp(message.timestamp)}</span>
                  </div>
                </div>

                <div className={`text-sm ${message.from_me ? 'text-teal-900' : 'text-slate-700'}`}>
                  {getMessageBody(message)}
                </div>

                {message.context?.quoted_id && (
                  <div className="mt-2 border-l-2 border-slate-300 pl-3 text-xs italic text-slate-500">
                    Em resposta a uma mensagem
                  </div>
                )}

                {message.status && <div className="mt-2 text-xs text-slate-500">Status: {message.status}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
