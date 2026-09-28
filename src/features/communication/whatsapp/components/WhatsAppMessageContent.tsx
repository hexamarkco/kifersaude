import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileText, Headphones, Link2, Loader2, Mic, Pause, Play, Radio, Reply, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Button } from '../../../../design-system';
import { getPanelButtonClass } from '../../../../components/ui/standards';
import { cx } from '../../../../lib/cx';
import type { CommWhatsAppMessage } from '../domain/types';
import {
  formatDurationLabel,
  formatFileSize,
  getVisualMediaBubbleWidth,
  isPdfDocumentMessage,
} from '../domain/messageMediaPresentation';
import { formatCommWhatsAppPhoneLabel } from '../domain/phonePresentation';
import {
  getDeletedMessageInfo,
  getEditedMessageInfo,
  getMessageContactCardInfo,
  getMessageInteractiveInfo,
  getMessageInviteInfo,
  getMessageLinkPreview,
  getMessageQuoteInfo,
} from '../domain/messageMetadata';
import {
  getMessageVisibleCaption,
  getVisiblePreviewText,
  isVideoLikeMessageType,
} from '../domain/messagePresentation';
import LinkifiedText from './WhatsAppFormattedText';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';

const DEFAULT_WAVEFORM = [0.24, 0.36, 0.52, 0.72, 0.46, 0.62, 0.28, 0.54, 0.4, 0.66, 0.32, 0.58, 0.42, 0.74, 0.38, 0.5, 0.3, 0.64, 0.44, 0.56];
const AUDIO_PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

const inboxInlineActionClassName = getPanelButtonClass({
  variant: 'soft',
  size: 'sm',
  className: 'h-8 px-3 text-[11px] font-semibold',
});

export function MediaSendingOverlay({
  progress,
  onCancel,
}: {
  progress: number | null;
  onCancel?: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-[var(--overlay)] p-3 backdrop-blur-[1px]">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--bg-surface)_90%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--brand-primary)]" />
        <span>{progress === null ? 'Enviando' : `${progress}%`}</span>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="ml-1 text-[var(--text-secondary)] underline decoration-current/40 underline-offset-2 transition hover:text-[var(--text-primary)]"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
export function WhatsAppAudioPlayerCard({
  kind,
  mediaUrl,
  mediaMimeType,
  fileName,
  durationSeconds,
  canTranscribe,
  hasTranscription,
  transcriptionStatus,
  transcribing,
  onTranscribe,
  loading,
  error,
  mediaSending,
  mediaSendingProgress,
  onCancelMediaUpload,
}: {
  kind: 'audio' | 'voice';
  mediaUrl: string | null;
  mediaMimeType?: string | null;
  fileName?: string | null;
  durationSeconds?: number | null;
  canTranscribe?: boolean;
  hasTranscription?: boolean;
  transcriptionStatus?: CommWhatsAppMessage['transcription_status'];
  transcribing?: boolean;
  onTranscribe?: () => void;
  loading: boolean;
  error: string | null;
  mediaSending: boolean;
  mediaSendingProgress: number | null;
  onCancelMediaUpload?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(durationSeconds ?? 0);
  const [playbackRate, setPlaybackRate] = useState<(typeof AUDIO_PLAYBACK_RATES)[number]>(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setResolvedDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [mediaUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
  }, [mediaUrl, playbackRate]);

  const handleTogglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !mediaUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    void audio.play().then(() => setIsPlaying(true)).catch(() => undefined);
  };

  const duration = Math.max(resolvedDuration || 0, durationSeconds || 0);
  const waveformBars =
    kind === 'voice'
      ? DEFAULT_WAVEFORM
      : DEFAULT_WAVEFORM.map((value, index) => (index % 3 === 0 ? value * 0.62 : value * 0.92));
  const playedBars = duration > 0 ? Math.min(waveformBars.length, Math.ceil((currentTime / duration) * waveformBars.length)) : 0;

  const handleSeek = (event: React.MouseEvent<HTMLButtonElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const mediaDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    if (mediaDuration <= 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const progress = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const nextTime = Math.min(progress * mediaDuration, Math.max(0, mediaDuration - 0.05));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);

    if (audio.paused) {
      void audio.play().then(() => setIsPlaying(true)).catch(() => undefined);
    }
  };

  const formatPlaybackRate = (rate: number) => `${rate.toString().replace('.', ',')}×`;
  const handleCyclePlaybackRate = () => {
    setPlaybackRate((currentRate) => {
      const currentIndex = AUDIO_PLAYBACK_RATES.indexOf(currentRate);
      return AUDIO_PLAYBACK_RATES[(currentIndex + 1) % AUDIO_PLAYBACK_RATES.length];
    });
  };

  const transcriptionAction = transcriptionStatus === 'processing' || transcribing ? (
    <span className="whatsapp-inbox-transcribe-button whatsapp-inbox-transcribe-status whatsapp-inbox-audio-transcribe-button" role="status" aria-live="polite">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      <span>Transcrevendo...</span>
    </span>
  ) : canTranscribe ? (
      <button
        type="button"
        onClick={onTranscribe}
        className="whatsapp-inbox-transcribe-button whatsapp-inbox-audio-transcribe-button"
        aria-label={transcriptionStatus === 'failed' ? 'Tentar transcrever novamente' : transcriptionStatus === 'completed' ? 'Retranscrever áudio' : 'Transcrever áudio'}
        title={transcriptionStatus === 'failed' ? 'Tentar transcrever novamente' : transcriptionStatus === 'completed' ? 'Retranscrever áudio' : 'Transcrever áudio'}
      >
        <FileText className="h-3 w-3" aria-hidden="true" />
        <span>{transcriptionStatus === 'failed' ? 'Tentar novamente' : hasTranscription ? 'Retranscrever' : 'Transcrever'}</span>
      </button>
  ) : null;

  if (!mediaUrl) {
    return (
      <div className={`whatsapp-inbox-audio-native-card relative ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
        <div className={`whatsapp-inbox-audio-native-badge ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
          {kind === 'voice' ? <Mic className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {kind !== 'voice' ? <p className="truncate text-sm font-semibold">{fileName || 'Arquivo de áudio'}</p> : null}
          <p className="text-xs opacity-75">{loading ? 'Carregando áudio...' : error || 'Áudio indisponível'}</p>
        </div>
        {transcriptionAction ? <div className="shrink-0 self-center">{transcriptionAction}</div> : null}
        {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
      </div>
    );
  }

  return (
    <div className={`whatsapp-inbox-audio-native-card relative ${kind === 'voice' ? 'is-voice' : 'is-audio'} ${isPlaying ? 'is-playing' : ''}`}>
      <audio ref={audioRef} preload="metadata">
        <source src={mediaUrl} type={mediaMimeType || undefined} />
      </audio>

      <div className="min-w-0 flex-1">
        <div className="whatsapp-inbox-audio-native-content">
          <button
            type="button"
            onClick={handleTogglePlayback}
            className="whatsapp-inbox-audio-native-play"
            aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                {kind === 'voice' ? 'Mensagem de voz' : fileName || 'Arquivo de áudio'}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {transcriptionAction}
                <button
                  type="button"
                  onClick={handleCyclePlaybackRate}
                  className="whatsapp-inbox-audio-speed-trigger"
                  aria-label={`Velocidade de reprodução: ${formatPlaybackRate(playbackRate)}. Clique para mudar`}
                  title="Clique para mudar a velocidade"
                >
                  {formatPlaybackRate(playbackRate)}
                </button>
                <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                  {formatDurationLabel(Math.round(duration))}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="whatsapp-inbox-audio-native-waveform"
              onClick={handleSeek}
              aria-label={`Reproduzir áudio a partir de uma posição. Posição atual: ${formatDurationLabel(Math.round(currentTime))} de ${formatDurationLabel(Math.round(duration))}`}
            >
              {waveformBars.map((bar, index) => (
                <span
                  key={`${kind}-${index}-${bar}`}
                  className={`whatsapp-inbox-audio-native-waveform-bar ${index < playedBars ? 'is-played' : ''} ${isPlaying ? 'is-active' : ''}`}
                  style={{ height: `${Math.max(9, Math.round(bar * 20))}px` }}
                />
              ))}
            </button>
            <p className="mt-1.5 text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
              {formatDurationLabel(Math.round(currentTime))} reproduzidos
            </p>
          </div>
        </div>
      </div>
      {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
    </div>
  );
}



export function WhatsAppMessageBody({
  message,
  onOpenImage,
  onOpenQuotedMessage,
  onTranscribe,
  onSelectInteractiveReply,
  onOpenSharedContactChat,
  onSaveSharedContact,
  sharedContactActionKey,
  transcribing,
  mediaSending,
  mediaSendingProgress,
  onCancelMediaUpload,
}: {
  message: CommWhatsAppMessage;
  onOpenImage: (messageId: string) => void;
  onOpenQuotedMessage: (externalMessageId: string) => void;
  onTranscribe: (message: CommWhatsAppMessage) => void;
  onSelectInteractiveReply: (message: CommWhatsAppMessage, option: { id: string | null; title: string | null }) => void;
  onOpenSharedContactChat: (contact: { name: string | null; phoneNumber: string | null }) => void;
  onSaveSharedContact: (contact: { name: string | null; phoneNumber: string | null }) => void;
  sharedContactActionKey: string | null;
  transcribing: boolean;
  mediaSending: boolean;
  mediaSendingProgress: number | null;
  onCancelMediaUpload?: () => void;
}) {
  const { mediaUrl, loading, error, retry } = useResolvedMediaUrl(message);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const kind = message.message_type.trim().toLowerCase();
  const caption = getMessageVisibleCaption(message);
  const editInfo = useMemo(() => getEditedMessageInfo(message), [message]);
  const deletedInfo = useMemo(() => getDeletedMessageInfo(message), [message]);
  const linkPreview = useMemo(() => getMessageLinkPreview(message), [message]);
  const quoteInfo = useMemo(() => getMessageQuoteInfo(message), [message]);
  const contactCardInfo = useMemo(() => getMessageContactCardInfo(message), [message]);
  const interactiveInfo = useMemo(() => getMessageInteractiveInfo(message), [message]);
  const inviteInfo = useMemo(() => getMessageInviteInfo(message), [message]);
  const visibleTextContent = getVisiblePreviewText(message.text_content, message.message_type);

  useEffect(() => {
    setShowOriginalText(false);
  }, [message.id, editInfo.originalText, message.text_content, message.media_caption]);

  const editInfoNode = editInfo.edited ? (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <span>Editada</span>
        {editInfo.previousText ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginalText((current) => !current)}
            className="normal-case tracking-normal"
          >
            {showOriginalText ? 'Ocultar alterações' : 'Ver antes e depois'}
          </Button>
        ) : null}
      </div>
      {showOriginalText && editInfo.previousText ? (
        <div className="mt-2 grid gap-2">
          <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Antes</p>
            <LinkifiedText className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-muted)] line-through opacity-85" text={editInfo.previousText} />
          </div>
          {editInfo.currentText ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Depois</p>
              <LinkifiedText className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]" text={editInfo.currentText} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;
  const linkPreviewContent = linkPreview ? (
    <>
      {linkPreview.previewImage ? (
        <div className="h-40 w-full overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-inset)]">
          <img src={linkPreview.previewImage} alt={linkPreview.title || linkPreview.domain || 'Preview do link'} className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="space-y-1.5 px-3 py-3">
        {linkPreview.title ? <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-primary)]">{linkPreview.title}</p> : null}
        {linkPreview.description ? <p className="line-clamp-3 text-sm leading-5 text-[var(--text-secondary)]">{linkPreview.description}</p> : null}
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{linkPreview.domain || 'Link'}</p>
      </div>
    </>
  ) : null;
  const linkPreviewNode = linkPreviewContent
    ? linkPreview?.url
      ? (
        <a
          href={linkPreview.url}
          target="_blank"
          rel="noreferrer"
          className="block w-[280px] max-w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] transition hover:border-[var(--border-strong)]"
        >
          {linkPreviewContent}
        </a>
      )
      : (
        <div className="w-[280px] max-w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)]">
          {linkPreviewContent}
        </div>
      )
    : null;
  const quotedExternalMessageId = quoteInfo?.externalMessageId;
  const quotePreviewContent = quoteInfo ? (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-current/50 opacity-70" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Resposta</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 opacity-85">{quoteInfo.previewText}</p>
      </div>
    </div>
  ) : null;
  const quotePreviewNode = quoteInfo ? quotedExternalMessageId ? (
    <button
      type="button"
      onClick={() => onOpenQuotedMessage(quotedExternalMessageId)}
      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2.5 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
      title="Ir para a mensagem respondida"
      aria-label={`Ir para a mensagem respondida: ${quoteInfo.previewText}`}
    >
      {quotePreviewContent}
    </button>
  ) : (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2.5">
      {quotePreviewContent}
    </div>
  ) : null;
  const visibleContactItems = contactCardInfo?.items.slice(0, 3) ?? [];
  const hiddenContactCount = contactCardInfo ? Math.max(0, contactCardInfo.count - visibleContactItems.length) : 0;
  const contactCardNode = contactCardInfo ? (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {contactCardInfo.kind === 'contact'
              ? 'Contato compartilhado'
              : contactCardInfo.count > 0
                ? `${contactCardInfo.count} contatos compartilhados`
                : 'Contatos compartilhados'}
          </p>
          {visibleContactItems.length > 0 ? (
            <div className="space-y-2">
              {visibleContactItems.map((item, index) => (
                <div key={`${item.name ?? 'contact'}:${item.phoneNumber ?? index}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.name || 'Contato sem nome'}</p>
                  {item.phoneNumber ? (
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatCommWhatsAppPhoneLabel(item.phoneNumber)}</p>
                  ) : null}
                  {item.phoneNumber ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSharedContactChat(item)}
                        disabled={sharedContactActionKey === `open:${item.phoneNumber}` || sharedContactActionKey === `save:${item.phoneNumber}`}
                        className={inboxInlineActionClassName}
                      >
                        {sharedContactActionKey === `open:${item.phoneNumber}` ? 'Abrindo...' : 'Abrir chat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSaveSharedContact(item)}
                        disabled={!item.name || sharedContactActionKey === `open:${item.phoneNumber}` || sharedContactActionKey === `save:${item.phoneNumber}`}
                        className={inboxInlineActionClassName}
                        title={item.name ? 'Salvar contato' : 'Contato sem nome para salvar'}
                      >
                        {sharedContactActionKey === `save:${item.phoneNumber}` ? 'Salvando...' : 'Salvar contato'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{message.text_content || '[Contato]'}</p>
          )}
          {hiddenContactCount > 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">+{hiddenContactCount} contato(s)</p>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const interactiveNode = interactiveInfo ? (
    interactiveInfo.kind === 'reply' ? (
      <div className="flex items-start gap-2">
        <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Opção selecionada</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
            {interactiveInfo.selectedReply?.title || interactiveInfo.selectedReply?.id || '[Resposta interativa]'}
          </p>
        </div>
      </div>
    ) : (
      <div className="w-[280px] max-w-full overflow-hidden">
        {interactiveInfo.header ? (
          <p className="border-b border-[var(--border-subtle)] py-2 text-sm font-semibold leading-5 text-[var(--text-primary)]">
            {interactiveInfo.header}
          </p>
        ) : null}
        <div className="space-y-1.5 py-1">
          {interactiveInfo.body ? (
            <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={interactiveInfo.body} />
          ) : null}
          {interactiveInfo.footer ? (
            <p className="text-xs text-[var(--text-muted)]">{interactiveInfo.footer}</p>
          ) : null}
        </div>
        {interactiveInfo.buttons.length > 0 ? (
          <div className="border-t border-[var(--border-subtle)]">
            {interactiveInfo.buttons.map((button, index) => (
              <button
                type="button"
                key={button.id ?? `${button.title}-${index}`}
                onClick={() => onSelectInteractiveReply(message, button)}
                disabled={message.direction !== 'inbound' || (!button.title && !button.id)}
                className={cx(
                  'w-full py-2.5 text-center text-sm font-medium text-[var(--accent-text,var(--text-primary))] transition hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)] disabled:cursor-default disabled:hover:bg-transparent',
                  index > 0 ? 'border-t border-[var(--border-subtle)]' : null,
                )}
              >
                {button.title || button.id}
              </button>
            ))}
          </div>
        ) : null}
        {interactiveInfo.sections.length > 0 ? (
          <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
            {interactiveInfo.sections.map((section, sectionIndex) => (
              <div key={section.title ?? `section-${sectionIndex}`} className="py-2.5">
                {section.title ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{section.title}</p>
                ) : null}
                <div className="mt-1.5 space-y-1.5">
                  {section.rows.map((row, rowIndex) => (
                    <button
                      type="button"
                      key={row.id ?? `${section.title}-row-${rowIndex}`}
                      onClick={() => onSelectInteractiveReply(message, row)}
                      disabled={message.direction !== 'inbound' || (!row.title && !row.id)}
                      className="w-full rounded-md py-1 text-left transition hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <p className="text-sm font-medium leading-5 text-[var(--text-primary)]">{row.title || row.id}</p>
                      {row.description ? (
                        <p className="text-xs leading-5 text-[var(--text-secondary)]">{row.description}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  ) : null;

  const inviteLabel = inviteInfo?.kind === 'group_invite'
    ? 'Convite para grupo'
    : inviteInfo?.kind === 'newsletter_invite'
      ? 'Convite para canal'
      : 'Convite de administrador';
  const inviteIcon = inviteInfo?.kind === 'group_invite'
    ? <Users className="h-5 w-5" />
    : inviteInfo?.kind === 'newsletter_invite'
      ? <Radio className="h-5 w-5" />
      : <ShieldCheck className="h-5 w-5" />;
  const inviteExpirationLabel = inviteInfo?.expiration
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(inviteInfo.expiration * 1000))
    : null;
  const inviteNode = inviteInfo ? (
    <div className="w-[320px] max-w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inset)]">
      {inviteInfo.preview ? (
        <div className="h-36 w-full overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <img src={inviteInfo.preview} alt="Prévia do convite" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
            {inviteIcon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{inviteLabel}</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-primary)]">{inviteInfo.title}</p>
            {inviteInfo.newsletterName ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{inviteInfo.newsletterName}</p> : null}
          </div>
        </div>
        {inviteInfo.description ? <p className="text-sm leading-6 text-[var(--text-secondary)]">{inviteInfo.description}</p> : null}
        {inviteInfo.body ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={inviteInfo.body} /> : null}
        {inviteExpirationLabel ? <p className="text-xs text-[var(--text-muted)]">Validade: {inviteExpirationLabel}</p> : null}
        {inviteInfo.url ? (
          <a
            href={inviteInfo.url}
            target="_blank"
            rel="noreferrer"
            className={cx(inboxInlineActionClassName, 'inline-flex items-center gap-1.5')}
          >
            <Link2 className="h-3.5 w-3.5" />
            Abrir convite
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-xs font-medium text-[var(--text-muted)]">Convite recebido sem link disponível.</p>
        )}
      </div>
    </div>
  ) : null;

  const hasPreservableDeletedMedia = deletedInfo.deleted
    && (kind === 'image' || kind === 'sticker' || isVideoLikeMessageType(kind) || kind === 'document' || kind === 'audio' || kind === 'voice')
    && Boolean(message.media_id || message.media_url);

  const deletedBannerNode = deletedInfo.deleted ? (
    <div className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-3 text-[var(--danger-text)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Mensagem apagada</span>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {deletedInfo.deletedBy === 'self'
          ? 'Você apagou esta mensagem no WhatsApp.'
          : deletedInfo.deletedBy === 'contact'
            ? 'O contato apagou esta mensagem no WhatsApp.'
            : 'Mensagem apagada no WhatsApp.'}
        {hasPreservableDeletedMedia ? ' O arquivo continua disponível abaixo.' : ''}
      </p>
      {!hasPreservableDeletedMedia ? (
        <LinkifiedText className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)] line-through opacity-85" text={deletedInfo.preservedText} />
      ) : null}
    </div>
  ) : null;

  if (deletedInfo.deleted && !hasPreservableDeletedMedia) {
    return deletedBannerNode;
  }

  if (kind === 'image' || kind === 'sticker') {
    const isSticker = kind === 'sticker';
    const unavailableLabel = isSticker ? 'Figurinha indisponível' : 'Imagem indisponível';
    const loadingLabel = isSticker ? 'Carregando figurinha...' : 'Carregando imagem...';
    const altLabel = message.media_file_name || (isSticker ? 'Figurinha enviada' : 'Imagem enviada');

    return (
      <div className="space-y-3">
        {deletedBannerNode}
        {quotePreviewNode}
        <div className={cx(
          'relative max-w-full',
          isSticker ? 'w-fit' : 'w-[13.75rem]',
          caption ? 'overflow-hidden rounded-[var(--kds-radius-lg)]' : null,
        )}>
          <div className="relative">
            {mediaUrl ? (
              <button
                type="button"
                onClick={() => onOpenImage(message.id)}
                className={isSticker
                  ? 'whatsapp-inbox-media-content block w-fit max-w-[180px] overflow-hidden rounded-2xl bg-transparent text-left transition'
                  : `whatsapp-inbox-media-content block w-[13.75rem] max-w-full overflow-hidden text-left ${caption ? 'rounded-t-[var(--kds-radius-lg)]' : 'rounded-[var(--kds-radius-lg)]'}`}
              >
                <img
                  src={mediaUrl}
                  alt={altLabel}
                  className={isSticker ? 'max-h-[180px] max-w-[180px] object-contain' : 'block h-[11rem] w-full object-cover'}
                  loading="lazy"
                />
              </button>
            ) : (
              <div className={isSticker
                ? 'flex h-32 w-32 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-[var(--bg-inset)] px-3 text-center text-sm opacity-80'
                : `flex h-40 w-[13.75rem] max-w-full items-center justify-center border border-dashed border-current/20 bg-[var(--bg-inset)] text-sm opacity-80 ${caption ? 'rounded-t-[var(--kds-radius-lg)]' : 'rounded-[var(--kds-radius-lg)]'}`}
              >
                {loading ? loadingLabel : error || unavailableLabel}
              </div>
            )}
            {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
          </div>
          {caption ? (
            <LinkifiedText className="whatsapp-inbox-media-caption whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-6" text={caption} />
          ) : null}
        </div>
        {editInfoNode}
      </div>
    );
  }

  if (isVideoLikeMessageType(kind)) {
    return (
      <div className="space-y-3">
        {deletedBannerNode}
        {quotePreviewNode}
        <div className={cx(
          'relative w-[13.75rem] max-w-full',
          caption ? 'overflow-hidden rounded-[var(--kds-radius-lg)]' : null,
        )}>
          <div className="relative">
            <button
              type="button"
              onClick={() => onOpenImage(message.id)}
              className={`whatsapp-inbox-media-content block w-[13.75rem] max-w-full overflow-hidden text-left ${caption ? 'rounded-t-[var(--kds-radius-lg)]' : 'rounded-[var(--kds-radius-lg)]'}`}
              aria-label={`Abrir ${message.media_file_name || 'vídeo'}`}
            >
              {mediaUrl ? (
                <video muted playsInline preload="metadata" className="block h-[11rem] w-full bg-[var(--overlay)] object-cover">
                  <source src={mediaUrl} type={message.media_mime_type || undefined} />
                </video>
              ) : (
                <div className={`flex h-[11rem] items-center justify-center bg-[var(--bg-inset)] text-sm opacity-80 ${caption ? 'rounded-t-[var(--kds-radius-lg)]' : 'rounded-[var(--kds-radius-lg)]'}`}>
                  {loading ? 'Carregando vídeo...' : error || 'Vídeo indisponível'}
                </div>
              )}
            </button>
            {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
          </div>
          {caption ? (
            <LinkifiedText className="whatsapp-inbox-media-caption whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-6" text={caption} />
          ) : null}
        </div>
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'document') {
    const extension = message.media_file_name?.split('.').pop()?.toUpperCase() || 'DOC';

    if (isPdfDocumentMessage(message)) {
      const pdfFileName = message.media_file_name || 'Documento PDF';
      const pdfBubbleWidth = getVisualMediaBubbleWidth(message);
      const pdfCard = (
        <div className={cx(
          'whatsapp-inbox-document-card overflow-hidden',
          pdfBubbleWidth,
          caption ? 'border-0 rounded-t-[var(--kds-radius-lg)]' : 'rounded-2xl border',
        )}>
          <div className="whatsapp-inbox-document-preview relative h-36 overflow-hidden bg-[var(--bg-inset)]">
            {mediaUrl ? (
              <iframe
                src={`${mediaUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                title={`Prévia de ${pdfFileName}`}
                className="pointer-events-none h-full w-full border-0 bg-[var(--bg-surface)]"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[var(--text-muted)]">
                <FileText className="h-8 w-8 text-[var(--danger-text)]" />
                <span>{loading ? 'Carregando prévia...' : error || 'Prévia indisponível'}</span>
              </div>
            )}
            <span className="absolute left-3 top-3 inline-flex items-center rounded-md bg-[var(--danger-text)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-on-brand)] shadow-sm">
              PDF
            </span>
            {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
          </div>
          <div className="border-t border-[var(--border-subtle)] px-3 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[10px] font-bold tracking-[0.08em] text-[var(--danger-text)]">
                PDF
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]" title={pdfFileName}>{pdfFileName}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatFileSize(message.media_size_bytes) || 'Documento'} · PDF
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mediaUrl ? (
                <>
                  <a href={mediaUrl} target="_blank" rel="noreferrer" className={inboxInlineActionClassName}>
                    Abrir
                  </a>
                  <a href={mediaUrl} download={pdfFileName} className={inboxInlineActionClassName}>
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </a>
                </>
              ) : (
                <>
                  <span className="text-xs text-[var(--text-muted)]">{loading ? 'Carregando arquivo...' : error || 'Arquivo indisponível'}</span>
                  {error ? (
                    <button type="button" onClick={retry} disabled={loading} className={inboxInlineActionClassName}>
                      Tentar novamente
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      );

      return (
        <div className="space-y-3">
          {deletedBannerNode}
          {quotePreviewNode}
          <div className={caption ? `${pdfBubbleWidth} max-w-full overflow-hidden rounded-[var(--kds-radius-lg)]` : undefined}>
            {pdfCard}
            {caption ? (
              <LinkifiedText className="whatsapp-inbox-media-caption whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-6" text={caption} />
            ) : null}
          </div>
          {editInfoNode}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {deletedBannerNode}
        {quotePreviewNode}
        <div className="whatsapp-inbox-document-card relative flex items-center gap-3 rounded-2xl border px-3 py-3">
          <div className="whatsapp-inbox-document-thumb flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tracking-[0.08em]">
            {extension.slice(0, 4)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{message.media_file_name || 'Documento'}</p>
            <p className="text-xs opacity-75">{formatFileSize(message.media_size_bytes) || 'Documento anexo'}</p>
          </div>
          <div className="flex items-center gap-2">
            {mediaUrl ? (
              <>
                <a href={mediaUrl} target="_blank" rel="noreferrer" className={inboxInlineActionClassName}>
                  Abrir
                </a>
                <a
                  href={mediaUrl}
                  download={message.media_file_name || 'documento'}
                  className={inboxInlineActionClassName}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-75">{loading ? 'Carregando...' : error || 'Sem arquivo'}</span>
                {error ? (
                  <button type="button" onClick={retry} disabled={loading} className={inboxInlineActionClassName}>
                    Tentar novamente
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
        </div>
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'audio' || kind === 'voice') {
    const transcriptionStatus = message.transcription_status || 'idle';
    const canTranscribe = Boolean(message.media_id || message.media_url);

    return (
      <div className="space-y-3">
        {deletedBannerNode}
        {quotePreviewNode}
        <WhatsAppAudioPlayerCard
          kind={kind}
          mediaUrl={mediaUrl}
          mediaMimeType={message.media_mime_type}
          fileName={message.media_file_name}
          durationSeconds={message.media_duration_seconds}
          canTranscribe={canTranscribe}
          hasTranscription={Boolean(message.transcription_text?.trim())}
          transcriptionStatus={transcriptionStatus}
          transcribing={transcribing}
          onTranscribe={() => onTranscribe(message)}
          loading={loading}
          error={error}
          mediaSending={mediaSending}
          mediaSendingProgress={mediaSendingProgress}
          onCancelMediaUpload={onCancelMediaUpload}
        />
        <div className="space-y-2">
          {transcriptionStatus === 'completed' && message.transcription_text?.trim() ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Transcrição</p>
                {message.transcription_provider ? (
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    {message.transcription_provider}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]">
                {message.transcription_text}
              </p>
            </div>
          ) : null}

          {transcriptionStatus === 'failed' && message.transcription_error ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--danger-text)]">{message.transcription_error}</span>
            </div>
          ) : null}
        </div>
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'contact' || kind === 'contact_list') {
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        {contactCardNode || <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={message.text_content || '[Contato]'} />}
        {editInfoNode}
      </div>
    );
  }

  if (interactiveInfo && (kind === 'interactive' || kind === 'hsm' || kind === 'carousel' || kind === 'reply')) {
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        {interactiveNode}
        {editInfoNode}
      </div>
    );
  }

  if (inviteInfo) {
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        {inviteNode}
        {editInfoNode}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotePreviewNode}
      {linkPreviewNode}
      {visibleTextContent ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={visibleTextContent} /> : null}
      {editInfoNode}
    </div>
  );
}
