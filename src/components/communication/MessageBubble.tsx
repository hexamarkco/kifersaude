import { useEffect, useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Edit3, Trash2, History } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageHistoryModal } from './MessageHistoryModal';
import { getWhatsAppMedia } from '../../lib/whatsappApiService';

interface MessageBubbleProps {
  id: string;
  chatId: string;
  body: string | null;
  type: string | null;
  direction: 'inbound' | 'outbound';
  timestamp: string | null;
  ackStatus: number | null;
  hasMedia: boolean;
  payload?: any;
  reactions?: Array<{ emoji: string; count: number }>;
  fromName?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editCount?: number;
  editedAt?: string | null;
  originalBody?: string | null;
  onReply?: (messageId: string, body: string, from: string) => void;
  onEdit?: (messageId: string, body: string) => void;
}

export function MessageBubble({
  id,
  chatId,
  body,
  type,
  direction,
  timestamp,
  ackStatus,
  hasMedia,
  payload,
  reactions,
  fromName,
  isDeleted = false,
  deletedAt,
  editCount = 0,
  onReply,
  onEdit,
}: MessageBubbleProps) {
  const isOutbound = direction === 'outbound';
  const [showHistory, setShowHistory] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [audioMediaUrl, setAudioMediaUrl] = useState<string | null>(null);
  const [audioMediaLoading, setAudioMediaLoading] = useState(false);
  const hasHistory = editCount > 0 || isDeleted;

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return '';

    const date = new Date(ts);

    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: ptBR });
    } else if (isYesterday(date)) {
      return `Ontem ${format(date, 'HH:mm', { locale: ptBR })}`;
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    }
  };

  const getAckIcon = () => {
    if (ackStatus === null || !isOutbound) return null;

    switch (ackStatus) {
      case 0:
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 1:
        return <Check className="w-3 h-3 text-gray-400" />;
      case 2:
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 3:
      case 4:
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
  };

  const getAckLabel = () => {
    if (ackStatus === null) return '';

    switch (ackStatus) {
      case 0:
        return 'Enviando';
      case 1:
        return 'Enviado';
      case 2:
        return 'Entregue';
      case 3:
        return 'Lido';
      case 4:
        return 'Ouvido';
      default:
        return '';
    }
  };

  const parseVcard = (vcard?: string | null) => {
    if (!vcard) return { name: '', phone: '' };
    const nameMatch = vcard.match(/^FN:(.*)$/m) || vcard.match(/^FN;.*:(.*)$/m);
    const phoneMatch = vcard.match(/^TEL.*:(.*)$/m);
    return {
      name: nameMatch?.[1]?.trim() || '',
      phone: phoneMatch?.[1]?.replace(/\D/g, '') || '',
    };
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return cleaned || phone;
  };

  const payloadData = payload as any;
  const audioPayload = payloadData?.audio || payloadData?.voice || payloadData?.media;
  const audioUrl = audioMediaUrl || audioPayload?.link || audioPayload?.url || audioPayload?.file || audioPayload?.path;
  const imageFullSrc =
    payloadData?.image?.link ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.image?.preview ||
    '';

  useEffect(() => {
    return () => {
      if (audioMediaUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(audioMediaUrl);
      }
    };
  }, [audioMediaUrl]);

  const loadAudioMedia = async () => {
    const mediaId = audioPayload?.id;
    if (!mediaId || audioMediaLoading) return;
    setAudioMediaLoading(true);
    try {
      const response = await getWhatsAppMedia(mediaId);
      if (response.url) {
        setAudioMediaUrl(response.url);
      } else if (response.data) {
        const objectUrl = URL.createObjectURL(response.data);
        setAudioMediaUrl(objectUrl);
      }
    } catch (error) {
      console.error('Erro ao carregar audio:', error);
    } finally {
      setAudioMediaLoading(false);
    }
  };

  const renderContent = () => {

    if (isDeleted) {
      return (
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div className="text-sm italic text-gray-600">
            <span className="line-through">Mensagem apagada</span>
            {deletedAt && (
              <span className="block text-xs mt-1">
                em {format(new Date(deletedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (type === 'contact' || payloadData?.contact) {
      const contactPayload = payloadData?.contact;
      const parsed = parseVcard(contactPayload?.vcard);
      const contactName = parsed.name || contactPayload?.name || body || 'Contato';
      const contactPhone = parsed.phone || contactPayload?.phone || '';
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                👤
              </div>
              <div>
                <div className="font-medium">{contactName}</div>
                {contactPhone && <div className="text-xs">{formatPhone(contactPhone)}</div>}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (payloadData?.contact_list?.list?.length) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="font-medium">Contatos</div>
            <div className="mt-1 space-y-1">
              {payloadData.contact_list.list.slice(0, 5).map((contact: { name?: string; vcard?: string }, index: number) => {
                const parsed = parseVcard(contact?.vcard);
                const contactName = parsed.name || contact?.name || `Contato ${index + 1}`;
                const contactPhone = parsed.phone || '';
                return (
                  <div key={`${id}-contact-${index}`} className="text-xs text-gray-700">
                    {contactName}
                    {contactPhone ? ` · ${formatPhone(contactPhone)}` : ''}
                  </div>
                );
              })}
              {payloadData.contact_list.list.length > 5 && (
                <div className="text-xs text-gray-500">+{payloadData.contact_list.list.length - 5} contato(s)</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (type === 'location') {
      return (
        <div className="flex items-center gap-2">
          <div className="text-sm">
            <div className="font-medium">Localização compartilhada</div>
            <a
              href={`https://maps.google.com/?q=${body}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline text-xs"
            >
              Ver no mapa
            </a>
          </div>
        </div>
      );
    }

    if (hasMedia && type?.startsWith('image')) {
      const imageUrl = payloadData?.image?.link || payloadData?.media?.link || payloadData?.media?.url;
      const imagePreview = payloadData?.image?.preview;
      const displayUrl = imageUrl || imagePreview;
      const shouldShowCaption = body && body !== '[Imagem]';
      return (
        <div className="space-y-2">
          {displayUrl ? (
            <button type="button" onClick={() => setShowImagePreview(true)} className="block">
              <img
                src={displayUrl}
                alt="Imagem"
                className="rounded max-w-[360px] w-auto h-auto"
                loading="lazy"
              />
            </button>
          ) : (
            <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">📷</div>
                <div>
                  <div className="font-medium">Imagem</div>
                  <div className="text-xs">Clique para visualizar</div>
                </div>
              </div>
            </div>
          )}
          {shouldShowCaption && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    if (hasMedia && (type?.startsWith('audio') || type === 'ptt' || type === 'voice')) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600 w-[320px] max-w-full">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg"
                onClick={() => {
                  if (!audioUrl) {
                    loadAudioMedia();
                  }
                }}
                disabled={audioMediaLoading}
              >
                ▶
              </button>
              <div className="flex-1">
                {audioUrl ? (
                  <audio className="w-full h-8" controls preload="none" src={audioUrl} />
                ) : (
                  <div className="text-xs">
                    {audioMediaLoading ? 'Carregando audio...' : 'Clique para carregar'}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {audioPayload?.seconds ? `${audioPayload.seconds}s` : ''}
              </div>
            </div>
          </div>
          {body && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    if (hasMedia && type === 'document') {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📄
              </div>
              <div>
                <div className="font-medium">Documento</div>
                <div className="text-xs">Clique para baixar</div>
              </div>
            </div>
          </div>
          {body && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    if (hasMedia) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📎
              </div>
              <div>
                <div className="font-medium">Anexo</div>
                <div className="text-xs">{type || 'Arquivo'}</div>
              </div>
            </div>
          </div>
          {body && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    return <div className="text-sm whitespace-pre-wrap break-words">{body || '(mensagem vazia)'}</div>;
  };

  return (
    <div
      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2 group`}
    >
      <div className={`max-w-[70%] ${isOutbound ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-lg px-3 py-2 ${
            isOutbound
              ? 'bg-green-100 text-gray-900'
              : 'bg-white text-gray-900 border border-gray-200'
          }`}
        >
          {!isOutbound && fromName && (
            <div className="text-xs font-semibold text-green-600 mb-1">
              {fromName}
            </div>
          )}

          {renderContent()}

          {reactions && reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {reactions.map((reaction) => (
                <span
                  key={`${id}-${reaction.emoji}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 border border-gray-200 px-2 py-0.5 text-xs"
                >
                  <span>{reaction.emoji}</span>
                  {reaction.count > 1 && <span className="text-gray-600">{reaction.count}</span>}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-2">
              {editCount > 0 && !isDeleted && (
                <div
                  className="flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:text-blue-700"
                  title={`Editada ${editCount} vez${editCount > 1 ? 'es' : ''}`}
                  onClick={() => setShowHistory(true)}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editada</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">
                {formatTimestamp(timestamp)}
              </span>
              {isOutbound && (
                <span title={getAckLabel()}>
                  {getAckIcon()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {onReply && !isDeleted && (
            <button
              onClick={() => onReply(id, body || '', fromName || 'Contato')}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Responder
            </button>
          )}

          {onEdit && isOutbound && !isDeleted && !hasMedia && (
            <button
              onClick={() => onEdit(id, body || '')}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700 px-2 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>Editar</span>
            </button>
          )}

          {hasHistory && (
            <button
              onClick={() => setShowHistory(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 hover:text-blue-700 px-2 flex items-center gap-1"
            >
              <History className="w-3 h-3" />
              <span>Ver histórico</span>
            </button>
          )}
        </div>
      </div>

      <MessageHistoryModal
        messageId={id}
        chatId={chatId}
        messageTimestamp={timestamp ? new Date(timestamp).getTime() : Date.now()}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {showImagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setShowImagePreview(false)}>
          <div className="max-w-[90vw] max-h-[90vh]" onClick={(event) => event.stopPropagation()}>
            <img src={imageFullSrc} alt="Imagem" className="max-w-[90vw] max-h-[90vh] rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
