import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Download,
  ExternalLink,
  FileAudio,
  FileText,
  Files,
  Image,
  Images,
  Pause,
  Play,
  Video,
  type LucideIcon,
} from 'lucide-react';

import {
  Badge,
  Button,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerHeader,
  EmptyState,
  IconButton,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  Surface,
} from '../../../../design-system';
import { whatsappMediaRepository, type CommWhatsAppMediaType } from '../data';
import type { CommWhatsAppMessage } from '../domain/types';

type ChatFilesDrawerProps = {
  chatId: string | null;
  chatDisplayName: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenMedia: (message: CommWhatsAppMessage) => void;
};

type MediaTab = {
  id: CommWhatsAppMediaType;
  label: string;
  icon: LucideIcon;
};

type MediaGroup = {
  id: string;
  label: string;
  messages: CommWhatsAppMessage[];
};

const mediaTabs: readonly MediaTab[] = [
  { id: 'all', label: 'Todos', icon: Files },
  { id: 'image', label: 'Fotos', icon: Images },
  { id: 'video', label: 'Vídeos', icon: Video },
  { id: 'document', label: 'Documentos', icon: FileText },
  { id: 'audio', label: 'Áudios', icon: FileAudio },
];

const mediaDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const mediaTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

const normalizeMediaType = (message: CommWhatsAppMessage) => message.message_type.trim().toLowerCase();

const isVisualMessage = (message: CommWhatsAppMessage) => {
  const type = normalizeMediaType(message);
  return type === 'image' || type === 'video';
};

const isAudioMessage = (message: CommWhatsAppMessage) => {
  const type = normalizeMediaType(message);
  return type === 'audio' || type === 'voice';
};

const formatSize = (value?: number | null) => {
  if (!value || !Number.isFinite(value) || value < 0) return null;

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const formattedValue = value / (1024 ** unitIndex);

  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: formattedValue >= 10 ? 0 : 1 }).format(formattedValue)} ${units[unitIndex]}`;
};

const getMediaTitle = (message: CommWhatsAppMessage) => {
  if (message.media_file_name?.trim()) return message.media_file_name;
  if (isAudioMessage(message)) return 'Mensagem de voz';
  if (normalizeMediaType(message) === 'video') return 'Vídeo';
  if (normalizeMediaType(message) === 'image') return 'Imagem';
  return 'Arquivo sem nome';
};

const getMediaDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getMediaDateLabel = (value: string) => {
  const date = getMediaDate(value);
  if (!date) return 'Sem data';

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const messageDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((dayStart - messageDayStart) / 86_400_000);

  if (dayDifference === 0) return 'Hoje';
  if (dayDifference === 1) return 'Ontem';
  return mediaDateFormatter.format(date);
};

const getMediaMeta = (message: CommWhatsAppMessage) => {
  const date = getMediaDate(message.message_at);
  const sender = message.direction === 'outbound' ? 'Enviado por você' : message.direction === 'inbound' ? 'Recebido' : 'Sistema';
  return [date ? `${getMediaDateLabel(message.message_at)} às ${mediaTimeFormatter.format(date)}` : null, formatSize(message.media_size_bytes), sender]
    .filter((item): item is string => Boolean(item))
    .join(' · ');
};

const groupMessagesByDay = (messages: CommWhatsAppMessage[]): MediaGroup[] => {
  const groups = new Map<string, MediaGroup>();

  messages.forEach((message) => {
    const date = getMediaDate(message.message_at);
    const id = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : 'without-date';
    const current = groups.get(id);

    if (current) {
      current.messages.push(message);
      return;
    }

    groups.set(id, { id, label: getMediaDateLabel(message.message_at), messages: [message] });
  });

  return [...groups.values()];
};

function MediaIcon({ children }: { children: ReactNode }) {
  return <span className="comm-whatsapp-chat-files-icon" aria-hidden="true">{children}</span>;
}

function FileThumbnail({ message, onOpen }: { message: CommWhatsAppMessage; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const messageType = normalizeMediaType(message);
  const isVideo = messageType === 'video';
  const Icon = isVideo ? Video : Image;

  useEffect(() => {
    let active = true;
    setUrl(null);

    void whatsappMediaRepository.resolveObjectUrl({ mediaId: message.media_id, mediaUrl: message.media_url })
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl(null);
      });

    return () => { active = false; };
  }, [message.media_id, message.media_url]);

  const downloadMedia = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      const resolvedUrl = url ?? await whatsappMediaRepository.resolveObjectUrl({ mediaId: message.media_id, mediaUrl: message.media_url });
      if (!resolvedUrl) return;
      const link = document.createElement('a');
      link.href = resolvedUrl;
      link.download = getMediaTitle(message);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="comm-whatsapp-chat-files-visual">
      <button
        type="button"
        onClick={onOpen}
        className="comm-whatsapp-chat-files-visual-preview"
        aria-label={`Abrir ${isVideo ? 'vídeo' : 'imagem'}: ${getMediaTitle(message)}`}
      >
        {url && !isVideo ? (
          <img src={url} alt={message.media_caption || getMediaTitle(message)} className="comm-whatsapp-chat-files-visual-image" loading="lazy" />
        ) : url && isVideo ? (
          <video src={url} className="comm-whatsapp-chat-files-visual-image" muted preload="metadata" />
        ) : (
          <span className="comm-whatsapp-chat-files-visual-placeholder"><Icon className="kds-control-icon" /></span>
        )}
        <span className="comm-whatsapp-chat-files-visual-type">
          <Icon className="kds-control-icon" />
          {isVideo ? 'Vídeo' : 'Imagem'}
        </span>
        {isVideo && <span className="comm-whatsapp-chat-files-play"><Play className="kds-control-icon fill-current" /></span>}
      </button>
      <div className="comm-whatsapp-chat-files-visual-footer">
        <span>{getMediaMeta(message)}</span>
        <IconButton
          variant="ghost"
          size="sm"
          title={`Baixar ${isVideo ? 'vídeo' : 'imagem'}`}
          aria-label={`Baixar ${isVideo ? 'vídeo' : 'imagem'}`}
          loading={downloading}
          onClick={() => void downloadMedia()}
        >
          {!downloading && <Download className="kds-control-icon" />}
        </IconButton>
      </div>
    </article>
  );
}

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

function AudioFileRow({ message, onOpen }: { message: CommWhatsAppMessage; onOpen: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    void whatsappMediaRepository.resolveObjectUrl({ mediaId: message.media_id, mediaUrl: message.media_url })
      .then((resolved) => { if (active) setUrl(resolved); })
      .catch(() => { if (active) setUrl(null); });

    return () => { active = false; };
  }, [message.media_id, message.media_url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => undefined);
      return;
    }

    audio.pause();
    setPlaying(false);
  };

  return (
    <Surface variant="muted" padding="sm" className="comm-whatsapp-chat-files-audio">
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      />
      <div className="comm-whatsapp-chat-files-audio-main">
        <MediaIcon><FileAudio className="kds-control-icon" /></MediaIcon>
        <div className="min-w-0 flex-1">
          <p className="comm-whatsapp-chat-files-item-title">{getMediaTitle(message)}</p>
          <p className="comm-whatsapp-chat-files-item-meta">{getMediaMeta(message)}</p>
        </div>
        <IconButton
          variant="secondary"
          size="sm"
          onClick={togglePlayback}
          disabled={!url}
          aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
          title={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {playing ? <Pause className="kds-control-icon" /> : <Play className="kds-control-icon fill-current" />}
        </IconButton>
      </div>
      <div className="comm-whatsapp-chat-files-audio-timeline">
        <span>{formatDuration(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          disabled={!url || !duration}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = next;
            setCurrentTime(next);
          }}
          aria-label="Posição do áudio"
        />
        <span>{formatDuration(duration)}</span>
      </div>
      <div className="comm-whatsapp-chat-files-audio-actions">
        <div className="comm-whatsapp-chat-files-speed" aria-label="Velocidade de reprodução">
          {[1, 1.5, 2].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={speed === value ? 'soft' : 'ghost'}
              onClick={() => setSpeed(value)}
              aria-pressed={speed === value}
            >
              {String(value).replace('.', ',')}x
            </Button>
          ))}
        </div>
        <div className="comm-whatsapp-chat-files-item-actions">
          <IconButton variant="ghost" size="sm" onClick={onOpen} title="Abrir em nova guia" aria-label="Abrir áudio em nova guia">
            <ExternalLink className="kds-control-icon" />
          </IconButton>
          {url && (
            <a href={url} download={getMediaTitle(message)} className="comm-whatsapp-chat-files-download-link">
              Baixar
            </a>
          )}
        </div>
      </div>
    </Surface>
  );
}

function DocumentFileRow({ message, onOpen }: { message: CommWhatsAppMessage; onOpen: () => void }) {
  return (
    <Surface variant="muted" padding="sm" className="comm-whatsapp-chat-files-document">
      <MediaIcon><FileText className="kds-control-icon" /></MediaIcon>
      <div className="min-w-0 flex-1">
        <p className="comm-whatsapp-chat-files-item-title">{getMediaTitle(message)}</p>
        <p className="comm-whatsapp-chat-files-item-meta">{getMediaMeta(message)}</p>
        {message.media_caption?.trim() && <p className="comm-whatsapp-chat-files-caption">{message.media_caption}</p>}
      </div>
      <IconButton
        variant="secondary"
        size="sm"
        title="Abrir arquivo"
        aria-label={`Abrir arquivo: ${getMediaTitle(message)}`}
        onClick={onOpen}
      >
        <ExternalLink className="kds-control-icon" />
      </IconButton>
    </Surface>
  );
}

function ChatFilesLoadingSkeleton() {
  return (
    <div className="comm-whatsapp-chat-files-loading" role="status" aria-live="polite">
      <span className="sr-only">Carregando arquivos da conversa</span>
      <div className="comm-whatsapp-chat-files-visual-grid" aria-hidden="true">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      <Skeleton variant="table-row" aria-hidden="true" />
      <Skeleton variant="table-row" aria-hidden="true" />
    </div>
  );
}

export default function WhatsAppChatFilesDrawer({ chatId, chatDisplayName, isOpen, onClose, onOpenMedia }: ChatFilesDrawerProps) {
  const [mediaType, setMediaType] = useState<CommWhatsAppMediaType>('all');
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (append = false) => {
    if (!chatId) return;
    const setter = append ? setLoadingMore : setLoading;
    setter(true);
    setError(null);

    try {
      const last = append ? messages[messages.length - 1] : null;
      const page = await whatsappMediaRepository.listPage(chatId, {
        mediaType,
        limit: 40,
        before: last ? { messageAt: last.message_at, id: last.id } : null,
      });
      setMessages((current) => append ? [...current, ...page.messages] : page.messages);
      setHasMore(page.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os arquivos.');
    } finally {
      setter(false);
    }
  };

  useEffect(() => {
    if (isOpen && chatId) void load(false);
  // The selected type and chat intentionally reset the gallery page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isOpen, mediaType]);

  const groups = groupMessagesByDay(messages);
  const filterLabel = mediaTabs.find((tab) => tab.id === mediaType)?.label.toLocaleLowerCase('pt-BR') ?? 'arquivos';

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} side="right" size="lg" className="comm-whatsapp-chat-files-drawer">
      <DrawerHeader onClose={onClose} className="comm-whatsapp-chat-files-header">
        <p className="comm-whatsapp-chat-files-eyebrow">Arquivos da conversa</p>
        <DialogTitle>{chatDisplayName}</DialogTitle>
        <p className="comm-whatsapp-chat-files-description">Fotos, vídeos, documentos e áudios compartilhados neste atendimento.</p>
      </DrawerHeader>
      <DrawerBody className="comm-whatsapp-chat-files-body">
        <Surface variant="muted" padding="sm" className="comm-whatsapp-chat-files-intro">
          <MediaIcon><Files className="kds-control-icon" /></MediaIcon>
          <div>
            <p className="comm-whatsapp-chat-files-intro-title">Biblioteca da conversa</p>
            <p className="comm-whatsapp-chat-files-intro-description">Abra, reproduza ou baixe os arquivos sem sair do atendimento.</p>
          </div>
        </Surface>

        <SegmentedControl
          items={mediaTabs}
          value={mediaType}
          onChange={setMediaType}
          size="sm"
          ariaLabel="Filtrar arquivos por tipo"
          className="comm-whatsapp-chat-files-tabs"
          listClassName="comm-whatsapp-chat-files-tabs-list"
        />

        {loading ? (
          <ChatFilesLoadingSkeleton />
        ) : error ? (
          <EmptyState
            icon={<Files className="kds-control-icon" />}
            title="Arquivos indisponíveis"
            description={error}
            action={<Button variant="secondary" size="sm" onClick={() => void load(false)}>Tentar novamente</Button>}
          />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<Files className="kds-control-icon" />}
            title="Nenhum arquivo encontrado"
            description={`Esta conversa ainda não possui ${filterLabel} neste filtro.`}
          />
        ) : (
          <div className="comm-whatsapp-chat-files-results">
            <SectionHeader
              as="h3"
              eyebrow="Mais recentes"
              title="Arquivos compartilhados"
              description={`Exibindo ${messages.length} ${messages.length === 1 ? 'item' : 'itens'}${hasMore ? ' mais recentes' : ''}.`}
              action={<Badge tone="neutral" size="sm">{messages.length}</Badge>}
            />

            {groups.map((group) => {
              const visuals = group.messages.filter(isVisualMessage);
              const files = group.messages.filter((message) => !isVisualMessage(message));

              return (
                <section key={group.id} className="comm-whatsapp-chat-files-day" aria-labelledby={`chat-files-day-${group.id}`}>
                  <div className="comm-whatsapp-chat-files-day-header">
                    <h4 id={`chat-files-day-${group.id}`}>{group.label}</h4>
                    <span>{group.messages.length} {group.messages.length === 1 ? 'arquivo' : 'arquivos'}</span>
                  </div>

                  {visuals.length > 0 && (
                    <div className="comm-whatsapp-chat-files-visual-grid">
                      {visuals.map((message) => <FileThumbnail key={message.id} message={message} onOpen={() => onOpenMedia(message)} />)}
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="comm-whatsapp-chat-files-file-list">
                      {files.map((message) => (
                        isAudioMessage(message)
                          ? <AudioFileRow key={message.id} message={message} onOpen={() => onOpenMedia(message)} />
                          : <DocumentFileRow key={message.id} message={message} onOpen={() => onOpenMedia(message)} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            {hasMore && (
              <Button variant="secondary" size="md" fullWidth loading={loadingMore} onClick={() => void load(true)}>
                Carregar arquivos anteriores
              </Button>
            )}
          </div>
        )}
      </DrawerBody>
    </Drawer>
  );
}
