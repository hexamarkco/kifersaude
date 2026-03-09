import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Edit3, Trash2, History, Smile, ExternalLink, X, ChevronDown, CornerUpLeft } from 'lucide-react';
import { MessageHistoryModal } from './MessageHistoryModal';
import { WhatsAppFormattedText } from './WhatsAppFormattedText';
import ModalShell from '../ui/ModalShell';
import Button from '../ui/Button';
import { getWhatsAppMedia } from '../../lib/whatsappApiService';
import { formatPhoneDisplay } from '../../lib/phoneFormatting';
import { resolveWhatsAppMessageBody } from '../../lib/whatsappMessageBody';
import { SAO_PAULO_TIMEZONE, getDateKey } from '../../lib/dateUtils';

interface MessageBubbleProps {
  id: string;
  chatId: string;
  body: string | null;
  type: string | null;
  direction: 'inbound' | 'outbound';
  timestamp: string | null;
  ackStatus: number | null;
  hasMedia: boolean;
  payload?: MessagePayload | null;
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

type MediaPayload = {
  id?: string;
  media_id?: string;
  mediaId?: string;
  link?: string;
  url?: string;
  file?: string;
  path?: string;
  preview?: string;
  filename?: string;
  name?: string;
  mime_type?: string;
  mimetype?: string;
  seconds?: number;
  [key: string]: unknown;
};

type MessagePayload = MediaPayload & {
  audio?: MediaPayload;
  voice?: MediaPayload;
  media?: MediaPayload;
  image?: MediaPayload;
  video?: MediaPayload;
  document?: MediaPayload;
  contact?: {
    name?: string;
    vcard?: string;
    phone?: string;
    [key: string]: unknown;
  };
  contact_list?: {
    list?: Array<{
      name?: string;
      vcard?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  link_preview?: {
    url?: string;
    canonical?: string;
    link?: string;
    title?: string;
    description?: string;
    preview?: string;
    image?: string;
    thumbnail?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const MESSAGE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const MESSAGE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

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
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuOpenUpward, setActionMenuOpenUpward] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [visualMediaUrl, setVisualMediaUrl] = useState<string | null>(null);
  const [visualMediaLoading, setVisualMediaLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const audioAutoLoadTriggeredRef = useRef(false);
  const hasHistory = editCount > 0 || isDeleted;
  const canReact = Boolean(onReact && !isDeleted);
  const canReply = Boolean(onReply && !isDeleted);
  const canEditMessage = Boolean(onEdit && isOutbound && !isDeleted && !hasMedia);
  const canViewHistory = hasHistory;
  const hasActionMenu = canReact || canReply || canEditMessage || canViewHistory;
  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const closeActionMenu = useCallback(() => {
    setShowActionMenu(false);
    setShowReactionPicker(false);
  }, []);

  const repositionActionMenu = useCallback(() => {
    const menu = actionMenuRef.current;
    const trigger = actionMenuButtonRef.current;
    if (!menu || !trigger) return;

    const spacing = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const shouldOpenUpward = spaceBelow < menuHeight + spacing && spaceAbove > spaceBelow;

    setActionMenuOpenUpward((previous) => (previous === shouldOpenUpward ? previous : shouldOpenUpward));
  }, []);

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return '';

    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '';

    const currentDayKey = getDateKey(date, SAO_PAULO_TIMEZONE);
    const todayKey = getDateKey(new Date(), SAO_PAULO_TIMEZONE);
    const timeLabel = MESSAGE_TIME_FORMATTER.format(date);

    if (currentDayKey === todayKey) {
      return timeLabel;
    }

    const yesterdayKey = getDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000), SAO_PAULO_TIMEZONE);
    if (currentDayKey === yesterdayKey) {
      return `Ontem ${timeLabel}`;
    }

    return MESSAGE_DATE_TIME_FORMATTER.format(date).replace(',', '');
  };

  const formatDateTimeInSaoPaulo = (value: string | null | undefined) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return MESSAGE_DATE_TIME_FORMATTER.format(parsed).replace(',', '');
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
        return <CheckCheck className="w-3 h-3 text-amber-600" />;
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
    return formatPhoneDisplay(phone);
  };

  const payloadData: MessagePayload = payload && typeof payload === 'object' ? payload : {};
  const resolvedBody = resolveWhatsAppMessageBody({ body, type, payload });
  const normalizedType = (type || '').toLowerCase();
  const audioPayload: MediaPayload | null = payloadData.audio || payloadData.voice || payloadData.media || payloadData;
  const audioMediaId = audioPayload?.id || payloadData?.media?.id || payloadData?.voice?.id || payloadData?.audio?.id || null;
  const audioUrl = audioMediaUrl || audioPayload?.link || audioPayload?.url || audioPayload?.file || audioPayload?.path || null;
  const imageFullSrc =
    payloadData?.image?.url ||
    payloadData?.image?.file ||
    payloadData?.image?.path ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.image?.link ||
    payloadData?.image?.preview ||
    '';
  const videoFullSrc =
    payloadData?.video?.url ||
    payloadData?.video?.file ||
    payloadData?.video?.path ||
    payloadData?.media?.link ||
    payloadData?.media?.url ||
    payloadData?.media?.file ||
    payloadData?.media?.path ||
    payloadData?.video?.link ||
    '';
  const visualMediaId =
    payloadData?.image?.id ||
    payloadData?.image?.media_id ||
    payloadData?.image?.mediaId ||
    payloadData?.video?.id ||
    payloadData?.video?.media_id ||
    payloadData?.video?.mediaId ||
    payloadData?.media?.id ||
    payloadData?.media_id ||
    payloadData?.mediaId ||
    null;
  const visualDisplayUrl = visualMediaUrl || (normalizedType.startsWith('video') ? videoFullSrc : imageFullSrc);
  const isImageMessage = hasMedia && (normalizedType.startsWith('image') || Boolean(payloadData?.image));
  const isVideoMessage = hasMedia && (normalizedType.startsWith('video') || Boolean(payloadData?.video));
  const isVisualMediaMessage = !isDeleted && (isImageMessage || isVideoMessage);
  const isAudioMessage = hasMedia && (normalizedType.startsWith('audio') || normalizedType === 'ptt' || normalizedType === 'voice');
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

  const loadAudioMedia = useCallback(async () => {
    if (!audioMediaId || audioMediaLoading) return;
    setAudioMediaLoading(true);
    try {
      const response = await getWhatsAppMedia(audioMediaId);
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
  }, [audioMediaId, audioMediaLoading]);

  useEffect(() => {
    if (!isAudioMessage || audioUrl || audioMediaLoading || audioAutoLoadTriggeredRef.current) return;
    audioAutoLoadTriggeredRef.current = true;
    void loadAudioMedia();
  }, [audioMediaLoading, audioUrl, isAudioMessage, loadAudioMedia]);

  useEffect(() => {
    if (!showActionMenu) {
      setActionMenuOpenUpward(false);
      return;
    }

    const rafId = window.requestAnimationFrame(repositionActionMenu);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionMenuRef.current?.contains(target) || actionMenuButtonRef.current?.contains(target)) {
        return;
      }
      closeActionMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeActionMenu();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', repositionActionMenu);
    window.addEventListener('scroll', repositionActionMenu, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', repositionActionMenu);
      window.removeEventListener('scroll', repositionActionMenu, true);
    };
  }, [closeActionMenu, repositionActionMenu, showActionMenu, showReactionPicker]);

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
                em {formatDateTimeInSaoPaulo(deletedAt)}
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
              className="text-xs text-amber-700 hover:text-amber-800 hover:underline"
            >
              Ver no mapa
            </a>
          </div>
        </div>
      );
    }

    if (isImageMessage) {
      const imageUrl =
        payloadData?.image?.url ||
        payloadData?.image?.file ||
        payloadData?.image?.path ||
        payloadData?.media?.link ||
        payloadData?.media?.url ||
        payloadData?.media?.file ||
        payloadData?.media?.path ||
        payloadData?.image?.link;
      const imagePreview = payloadData?.image?.preview;
      const displayUrl = visualMediaUrl || imageUrl || imagePreview;
      const shouldShowCaption = Boolean(resolvedBody && resolvedBody !== '[Imagem]' && resolvedBody !== '[Imagem de status]');
      return (
        <div className="w-[min(420px,85vw)] max-w-full space-y-2">
          {displayUrl ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void openMediaPreview('image', displayUrl);
              }}
              className="h-auto w-full overflow-hidden rounded-xl border-0 p-0 shadow-none hover:bg-transparent"
            >
              <img
                src={displayUrl}
                alt="Imagem"
                className="block w-full h-auto max-h-[520px] object-cover"
                loading="lazy"
              />
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-auto w-full rounded p-2 text-sm text-gray-600"
              onClick={() => {
                void openMediaPreview('image');
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
            </Button>
          )}
          {shouldShowCaption && resolvedBody && (
            <WhatsAppFormattedText text={resolvedBody} className="block px-1 pb-1 text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (isVideoMessage) {
      const videoUrl = visualDisplayUrl;
      const shouldShowCaption = Boolean(
        resolvedBody &&
        resolvedBody !== '[Vídeo]' &&
        resolvedBody !== '[Video]' &&
        resolvedBody !== '[Vídeo de status]',
      );
      const poster = payloadData?.video?.preview || payloadData?.image?.preview || payloadData?.media?.preview || undefined;

      return (
        <div className="w-[min(420px,85vw)] max-w-full space-y-2">
          {videoUrl ? (
            <div className="w-full rounded-xl overflow-hidden bg-black">
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                poster={poster}
                className="block w-full h-auto max-h-[520px] bg-black"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full rounded-none border-0 bg-black/75 py-1.5 text-xs text-white/90 shadow-none hover:bg-black/85 hover:text-white"
                onClick={() => {
                  void openMediaPreview('video', videoUrl);
                }}
              >
                Abrir em tela cheia
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-auto w-full rounded p-2 text-sm text-gray-600"
              onClick={() => {
                void openMediaPreview('video');
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
            </Button>
          )}
          {shouldShowCaption && resolvedBody && (
            <WhatsAppFormattedText text={resolvedBody} className="block px-1 pb-1 text-sm whitespace-pre-wrap break-words" />
          )}
        </div>
      );
    }

    if (normalizedType === 'link_preview' || payloadData?.link_preview) {
      const linkData = (payloadData.link_preview || payloadData) as {
        url?: string;
        canonical?: string;
        link?: string;
        title?: string;
        description?: string;
        preview?: string;
        image?: string;
        thumbnail?: string;
      };
      const previewUrl = linkData.url || linkData.canonical || linkData.link || '';
      const previewTitle = linkData.title || (previewUrl ? previewUrl.replace(/^https?:\/\//i, '').split('/')[0] : 'Link');
      const previewDescription = linkData.description || '';
      const previewImage = linkData.preview || linkData.image || linkData.thumbnail || '';
      const textBody = resolvedBody && resolvedBody !== previewUrl && resolvedBody !== '[Link]' ? resolvedBody : '';

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
              <div className="pt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                <ExternalLink className="w-3 h-3" />
                <span>Abrir link</span>
              </div>
            </div>
          </a>
          {textBody && <WhatsAppFormattedText text={textBody} className="text-sm whitespace-pre-wrap break-words" />}
        </div>
      );
    }

    if (isAudioMessage) {
      return (
        <div className="space-y-2">
          <div className="rounded p-2 text-sm w-[360px] max-w-full">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full bg-gray-200 p-0 text-lg"
                onClick={toggleAudioPlayback}
                disabled={audioMediaLoading}
              >
                {audioIsPlaying ? '⏸' : '▶'}
              </Button>
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
                        className="h-full bg-amber-500"
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
              <Button
                variant="warning"
                size="sm"
                className="h-auto rounded-full px-2 py-1 text-xs"
                onClick={cycleAudioRate}
                disabled={!audioUrl}
              >
                {[1, 1.5, 2, 3][audioRateIndex]}x
              </Button>
            </div>
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="none" className="hidden" />}
          </div>
          {resolvedBody && resolvedBody !== '[Mensagem de voz]' && resolvedBody !== '[Áudio]' && (
            <WhatsAppFormattedText text={resolvedBody} className="text-sm whitespace-pre-wrap break-words" />
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
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
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
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
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
              </Button>
            </div>
          </div>
          {resolvedBody && <WhatsAppFormattedText text={resolvedBody} className="text-sm whitespace-pre-wrap break-words" />}
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
          {resolvedBody && <WhatsAppFormattedText text={resolvedBody} className="text-sm whitespace-pre-wrap break-words" />}
        </div>
      );
    }

    return <WhatsAppFormattedText text={resolvedBody || '(mensagem vazia)'} className="text-sm whitespace-pre-wrap break-words" />;
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

  async function openMediaPreview(previewType: 'image' | 'video', fallbackSrc?: string | null) {
    const initialSrc = fallbackSrc || visualMediaUrl || null;
    const shouldOpenAfterLoad = !initialSrc;

    if (initialSrc) {
      setMediaPreview({ type: previewType, src: initialSrc });
    }

    if (!visualMediaId || visualMediaUrl) {
      return;
    }

    const loadedUrl = await loadVisualMedia();
    if (!loadedUrl) {
      return;
    }

    setMediaPreview((current) => {
      if (!current) {
        return shouldOpenAfterLoad ? { type: previewType, src: loadedUrl } : current;
      }

      if (current.type !== previewType || current.src === loadedUrl) {
        return current;
      }

      return { ...current, src: loadedUrl };
    });
  }

  return (
    <div
      className={`message-bubble-row flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2 group`}
    >
      <div className={`relative ${isVisualMediaMessage ? 'max-w-[85%]' : 'max-w-[70%]'} min-w-0 ${isOutbound ? 'order-2' : 'order-1'}`}>
        <div
          className={`message-bubble break-words [overflow-wrap:anywhere] rounded-lg ${
            isVisualMediaMessage ? 'p-1.5' : 'px-3 py-2'
          } ${
            isOutbound
              ? 'message-bubble-outbound border border-amber-200 bg-amber-100 text-stone-900'
              : 'message-bubble-inbound border border-stone-200 bg-white text-stone-900'
          }`}
        >
          {!isOutbound && fromName && (
            <div className="mb-1 text-xs font-semibold text-amber-700">
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
                  className="flex cursor-pointer items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
                  title={`Editada ${editCount} vez${editCount > 1 ? 'es' : ''}`}
                  onClick={() => setShowHistory(true)}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editada</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">
                {formatTimestamp(timestamp)}
              </span>
              {isOutbound && (
                <span title={getAckLabel()}>
                  {getAckIcon()}
                </span>
              )}
              {hasActionMenu && (
                <Button
                  ref={actionMenuButtonRef}
                  variant="icon"
                  size="icon"
                  aria-label="Abrir menu da mensagem"
                  aria-expanded={showActionMenu}
                  onClick={() => {
                    setShowActionMenu((previous) => {
                      const next = !previous;
                      if (!next) {
                        setShowReactionPicker(false);
                      }
                      return next;
                    });
                  }}
                  className={`message-bubble-action-trigger h-4 w-4 rounded border-0 p-0 text-slate-500 shadow-none transition-colors transition-opacity ${
                    showActionMenu
                      ? 'opacity-100 pointer-events-auto bg-black/5'
                      : 'opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:bg-black/5'
                  }`}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showActionMenu ? 'rotate-180' : ''}`} />
                </Button>
              )}
            </div>
          </div>
        </div>

        {showActionMenu && hasActionMenu && (
          <div
            ref={actionMenuRef}
            className={`message-bubble-action-menu absolute right-0 z-20 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl ${
              actionMenuOpenUpward ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            {canReact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReactionPicker((previous) => !previous)}
                className="h-auto w-full items-center justify-start gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-normal text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-900"
              >
                <Smile className="h-4 w-4 text-slate-500" />
                <span>Reagir</span>
              </Button>
            )}

            {canReact && showReactionPicker && (
              <div className="mx-1 mb-1 mt-0.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1">
                <div className="flex items-center justify-between gap-0.5">
                  {quickReactions.map((emoji) => (
                    <Button
                      key={`${id}-${emoji}`}
                      variant="icon"
                      size="icon"
                      className="message-bubble-emoji-button h-7 w-7 rounded-full border-0 p-0 text-base shadow-none hover:bg-white"
                      onClick={() => {
                        onReact?.(id, emoji);
                        closeActionMenu();
                      }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {canReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onReply?.(id, body || '', fromName || 'Contato');
                  closeActionMenu();
                }}
                className="h-auto w-full items-center justify-start gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-normal text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-900"
              >
                <CornerUpLeft className="h-4 w-4 text-slate-500" />
                <span>Responder</span>
              </Button>
            )}

            {canEditMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onEdit?.(id, body || '');
                  closeActionMenu();
                }}
                className="h-auto w-full items-center justify-start gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-normal text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-900"
              >
                <Edit3 className="h-4 w-4 text-slate-500" />
                <span>Editar</span>
              </Button>
            )}

            {canViewHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowHistory(true);
                  closeActionMenu();
                }}
                className="h-auto w-full items-center justify-start gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-normal text-amber-700 shadow-none hover:bg-amber-50 hover:text-amber-800"
              >
                <History className="h-4 w-4 text-amber-700" />
                <span>Ver histórico</span>
              </Button>
            )}
          </div>
        )}
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
          <Button
            variant="icon"
            size="icon"
            className="absolute right-4 top-4 h-10 w-10 rounded-full border-0 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white"
            onClick={() => setMediaPreview(null)}
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="w-full h-full flex items-center justify-center">
            {mediaPreview.type === 'image' ? (
              <img src={mediaPreview.src} alt="Imagem" className="h-full w-full max-h-[92vh] max-w-[92vw] object-contain rounded-lg" />
            ) : (
              <video
                src={mediaPreview.src}
                controls
                autoPlay
                playsInline
                className="h-full w-full max-h-[92vh] max-w-[92vw] object-contain rounded-lg bg-black"
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
