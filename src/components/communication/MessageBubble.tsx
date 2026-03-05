import { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Edit3, Trash2, History, Smile, ExternalLink, X } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageHistoryModal } from './MessageHistoryModal';
import { WhatsAppFormattedText } from './WhatsAppFormattedText';
import ModalShell from '../ui/ModalShell';
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
  onReact?: (messageId: string, emoji: string) => void;
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
  onReact,
}: MessageBubbleProps) {
  const isOutbound = direction === 'outbound';
  const [showHistory, setShowHistory] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'video'; src: string } | null>(null);
  const [audioMediaUrl, setAudioMediaUrl] = useState<string | null>(null);
  const [audioMediaLoading, setAudioMediaLoading] = useState(false);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioRateIndex, setAudioRateIndex] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [visualMediaUrl, setVisualMediaUrl] = useState<string | null>(null);
  const [visualMediaLoading, setVisualMediaLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasHistory = editCount > 0 || isDeleted;
  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 1:
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 2:
        return <Check className="w-3 h-3 text-gray-400" />;
      case 3:
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 4:
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return <Check className="w-3 h-3 text-gray-400" />;
    }
  };

  const getAckLabel = () => {
    if (ackStatus === null) return '';

    switch (ackStatus) {
      case 0:
        return 'Falhou';
      case 1:
        return 'Pendente';
      case 2:
        return 'Enviado';
      case 3:
        return 'Entregue';
      case 4:
        return 'Lido';
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
  const normalizedType = (type || '').toLowerCase();
  const audioPayload = payloadData?.audio || payloadData?.voice || payloadData?.media || payloadData;
  const audioUrl = audioMediaUrl || audioPayload?.link || audioPayload?.url || audioPayload?.file || audioPayload?.path;
  const imageFullSrc =
    payloadData?.image?.link ||
    payloadData?.image?.url ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.image?.preview ||
    '';
  const videoFullSrc =
    payloadData?.video?.link ||
    payloadData?.video?.url ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    '';
  const visualMediaId = payloadData?.image?.id || payloadData?.video?.id || payloadData?.media?.id || null;
  const visualDisplayUrl = visualMediaUrl || (normalizedType.startsWith('video') ? videoFullSrc : imageFullSrc);
  const isImageMessage = hasMedia && (normalizedType.startsWith('image') || Boolean(payloadData?.image));
  const isVideoMessage = hasMedia && (normalizedType.startsWith('video') || Boolean(payloadData?.video));
  const isVisualMediaMessage = !isDeleted && (isImageMessage || isVideoMessage);
  const documentPayload = payloadData?.document || payloadData?.media;
  const documentLink = documentPayload?.link || documentPayload?.url || documentPayload?.file || documentPayload?.path;
  const documentName = documentPayload?.filename || documentPayload?.name || 'Documento';
  const documentMime = documentPayload?.mime_type || documentPayload?.mimetype || '';
  const isPdf = (documentMime || '').toLowerCase().includes('pdf') || documentName.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    return () => {
      if (audioMediaUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(audioMediaUrl);
      }
      if (documentUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(documentUrl);
      }
      if (visualMediaUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(visualMediaUrl);
      }
    };
  }, [audioMediaUrl, documentUrl, visualMediaUrl]);

  const loadAudioMedia = async () => {
    const mediaId = audioPayload?.id || payloadData?.media?.id || payloadData?.voice?.id || payloadData?.audio?.id;
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

  const loadDocumentMedia = async () => {
    const mediaId = documentPayload?.id || payloadData?.media?.id || payloadData?.document?.id;
    if (!mediaId || documentLoading) return;
    setDocumentLoading(true);
    try {
      const response = await getWhatsAppMedia(mediaId);
      if (response.url) {
        setDocumentUrl(response.url);
      } else if (response.data) {
        const objectUrl = URL.createObjectURL(response.data);
        setDocumentUrl(objectUrl);
      }
    } catch (error) {
      console.error('Erro ao carregar documento:', error);
    } finally {
      setDocumentLoading(false);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      setAudioDuration(audio.duration || 0);
    };

    const handleTime = () => {
      setAudioCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setAudioIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const formatAudioTime = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleAudioPlayback = async () => {
    if (!audioUrl) {
      await loadAudioMedia();
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (audioIsPlaying) {
      audio.pause();
      setAudioIsPlaying(false);
    } else {
      try {
        await audio.play();
        setAudioIsPlaying(true);
      } catch (error) {
        console.error('Erro ao reproduzir audio:', error);
      }
    }
  };

  const cycleAudioRate = () => {
    const rates = [1, 1.5, 2, 3];
    const nextIndex = (audioRateIndex + 1) % rates.length;
    setAudioRateIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = rates[nextIndex];
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

    if (isImageMessage) {
      const imageUrl = payloadData?.image?.link || payloadData?.media?.link || payloadData?.media?.url;
      const imagePreview = payloadData?.image?.preview;
      const displayUrl = visualMediaUrl || imageUrl || imagePreview;
      const shouldShowCaption = body && body !== '[Imagem]';
      return (
        <div className="space-y-2">
          {displayUrl ? (
            <button
              type="button"
              onClick={() => setMediaPreview({ type: 'image', src: displayUrl })}
              className="block rounded-xl overflow-hidden"
            >
              <img
                src={displayUrl}
                alt="Imagem"
                className="rounded-xl max-w-[360px] w-auto h-auto max-h-[420px] object-cover"
                loading="lazy"
              />
            </button>
          ) : (
            <button
              type="button"
              className="bg-gray-100 rounded p-2 text-sm text-gray-600"
              onClick={async () => {
                const loadedUrl = await loadVisualMedia();
                if (loadedUrl) {
                  setMediaPreview({ type: 'image', src: loadedUrl });
                }
              }}
              disabled={visualMediaLoading}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">📷</div>
                <div>
                  <div className="font-medium">Imagem</div>
                  <div className="text-xs">{visualMediaLoading ? 'Carregando...' : 'Clique para visualizar'}</div>
                </div>
              </div>
            </button>
          )}
          {shouldShowCaption && body && (
            <WhatsAppFormattedText text={body} className="text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (isVideoMessage) {
      const videoUrl = visualDisplayUrl;
      const shouldShowCaption = body && body !== '[Vídeo]' && body !== '[Video]';
      const poster = payloadData?.video?.preview || payloadData?.image?.preview || payloadData?.media?.preview || undefined;

      return (
        <div className="space-y-2">
          {videoUrl ? (
            <div className="rounded-xl overflow-hidden bg-black">
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                poster={poster}
                className="max-w-[360px] w-full max-h-[420px] bg-black"
              />
              <button
                type="button"
                className="w-full text-xs text-white/90 bg-black/75 py-1.5 hover:bg-black/85"
                onClick={() => setMediaPreview({ type: 'video', src: videoUrl })}
              >
                Abrir em tela cheia
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="bg-gray-100 rounded p-2 text-sm text-gray-600"
              onClick={async () => {
                const loadedUrl = await loadVisualMedia();
                if (loadedUrl) {
                  setMediaPreview({ type: 'video', src: loadedUrl });
                }
              }}
              disabled={visualMediaLoading}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">🎬</div>
                <div>
                  <div className="font-medium">Video</div>
                  <div className="text-xs">{visualMediaLoading ? 'Carregando...' : 'Clique para carregar'}</div>
                </div>
              </div>
            </button>
          )}
          {shouldShowCaption && body && (
            <WhatsAppFormattedText text={body} className="text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (normalizedType === 'link_preview' || payloadData?.link_preview) {
      const linkData = payloadData?.link_preview || payloadData;
      const previewUrl = linkData?.url || linkData?.canonical || linkData?.link || '';
      const previewTitle = linkData?.title || (previewUrl ? previewUrl.replace(/^https?:\/\//i, '').split('/')[0] : 'Link');
      const previewDescription = linkData?.description || '';
      const previewImage = linkData?.preview || linkData?.image || linkData?.thumbnail || '';
      const textBody = body && body !== previewUrl ? body : '';

      return (
        <div className="space-y-2">
          <a
            href={previewUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-slate-200 bg-white max-w-[360px] overflow-hidden hover:border-slate-300 transition-colors"
          >
            {previewImage && (
              <img
                src={previewImage}
                alt={previewTitle}
                className="w-full h-40 object-cover bg-slate-100"
                loading="lazy"
              />
            )}
            <div className="p-3 space-y-1">
              <div className="text-xs text-slate-500 truncate">{previewUrl || 'Link'}</div>
              <div className="text-sm font-medium text-slate-800 line-clamp-2">{previewTitle}</div>
              {previewDescription && <div className="text-xs text-slate-600 line-clamp-3">{previewDescription}</div>}
              <div className="pt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                <ExternalLink className="w-3 h-3" />
                <span>Abrir link</span>
              </div>
            </div>
          </a>
          {textBody && <WhatsAppFormattedText text={textBody} className="text-sm whitespace-pre-wrap break-words" />}
        </div>
      );
    }

    if (hasMedia && (type?.startsWith('audio') || type === 'ptt' || type === 'voice')) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600 w-[360px] max-w-full">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg"
                onClick={toggleAudioPlayback}
                disabled={audioMediaLoading}
              >
                {audioIsPlaying ? '⏸' : '▶'}
              </button>
              <div className="flex-1">
                {audioUrl ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
                      onClick={(event) => {
                        const target = event.currentTarget;
                        const rect = target.getBoundingClientRect();
                        const clickX = event.clientX - rect.left;
                        const percent = rect.width ? clickX / rect.width : 0;
                        const audio = audioRef.current;
                        if (audio && audioDuration) {
                          audio.currentTime = audioDuration * Math.min(Math.max(percent, 0), 1);
                        }
                      }}
                    >
                      <div
                        className="h-full bg-green-500"
                        style={{ width: audioDuration ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%' }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 min-w-[64px] text-right">
                      {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration || audioPayload?.seconds || 0)}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs">
                    {audioMediaLoading ? 'Carregando audio...' : 'Clique para carregar'}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-1"
                onClick={cycleAudioRate}
                disabled={!audioUrl}
              >
                {[1, 1.5, 2, 3][audioRateIndex]}x
              </button>
            </div>
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="none" className="hidden" />}
          </div>
          {body && body !== '[Mensagem de voz]' && body !== '[Áudio]' && (
            <WhatsAppFormattedText text={body} className="text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (hasMedia && type === 'document') {
      const resolvedDocumentUrl = documentUrl || documentLink || '';
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📄
              </div>
              <div>
                <div className="font-medium">{documentName}</div>
                <div className="text-xs text-slate-500">{isPdf ? 'PDF' : 'Documento'}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {isPdf && (
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => {
                    if (!resolvedDocumentUrl) {
                      loadDocumentMedia();
                      setShowPdfPreview(true);
                      return;
                    }
                    setShowPdfPreview(true);
                  }}
                  disabled={documentLoading}
                >
                  {documentLoading ? 'Carregando...' : 'Abrir'}
                </button>
              )}
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => {
                  if (!resolvedDocumentUrl) {
                    loadDocumentMedia();
                    return;
                  }
                  const link = document.createElement('a');
                  link.href = resolvedDocumentUrl;
                  link.download = documentName;
                  link.click();
                }}
                disabled={documentLoading}
              >
                {documentLoading ? 'Carregando...' : 'Baixar'}
              </button>
            </div>
          </div>
          {body && <WhatsAppFormattedText text={body} className="text-sm whitespace-pre-wrap break-words" />}
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
          {body && <WhatsAppFormattedText text={body} className="text-sm whitespace-pre-wrap break-words" />}
        </div>
      );
    }

    return <WhatsAppFormattedText text={body || '(mensagem vazia)'} className="text-sm whitespace-pre-wrap break-words" />;
  };

  async function loadVisualMedia() {
    if (!visualMediaId || visualMediaLoading) return null;
    setVisualMediaLoading(true);
    try {
      const response = await getWhatsAppMedia(visualMediaId);
      if (response.url) {
        setVisualMediaUrl(response.url);
        return response.url;
      }
      if (response.data) {
        const objectUrl = URL.createObjectURL(response.data);
        setVisualMediaUrl(objectUrl);
        return objectUrl;
      }
    } catch (error) {
      console.error('Erro ao carregar midia visual:', error);
    } finally {
      setVisualMediaLoading(false);
    }
    return null;
  }

  return (
    <div
      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2 group`}
    >
      <div className={`max-w-[70%] ${isOutbound ? 'order-2' : 'order-1'}`}>
        <div
          className={`message-bubble rounded-lg ${
            isVisualMediaMessage ? 'p-1.5' : 'px-3 py-2'
          } ${
            isOutbound
              ? 'message-bubble-outbound bg-green-100 text-gray-900'
              : 'message-bubble-inbound bg-white text-gray-900 border border-gray-200'
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
          {onReact && !isDeleted && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReactionPicker((prev) => !prev)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700 px-2 flex items-center gap-1"
              >
                <Smile className="w-3 h-3" />
                <span>Reagir</span>
              </button>
              {showReactionPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-full shadow px-2 py-1 flex gap-1 z-10">
                  {quickReactions.map((emoji) => (
                    <button
                      key={`${id}-${emoji}`}
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
                      onClick={() => {
                        onReact(id, emoji);
                        setShowReactionPicker(false);
                      }}
                    >
                      <span className="text-sm">{emoji}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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

      {mediaPreview && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setMediaPreview(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-full h-full flex items-center justify-center">
            {mediaPreview.type === 'image' ? (
              <img src={mediaPreview.src} alt="Imagem" className="max-h-full max-w-full object-contain rounded-lg" />
            ) : (
              <video
                src={mediaPreview.src}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full object-contain rounded-lg bg-black"
              />
            )}
          </div>
        </div>
      )}

      {showPdfPreview && (
        <ModalShell
          isOpen
          onClose={() => setShowPdfPreview(false)}
          title={documentName || 'Pre-visualizacao de PDF'}
          size="xl"
          panelClassName="max-w-6xl"
          bodyClassName="p-0"
        >
          <iframe
            title="PDF Preview"
            src={documentUrl || documentLink || ''}
            className="h-[84vh] w-full"
          />
        </ModalShell>
      )}
    </div>
  );
}
