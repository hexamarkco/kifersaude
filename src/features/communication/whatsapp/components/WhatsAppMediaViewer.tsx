import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, Loader2, Play, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';

import type { CommWhatsAppMessage } from '../domain/types';
import { formatMessageDaySeparatorLabel, formatMessageTime } from '../domain/messageTimeline';
import { isVideoLikeMessageType } from '../domain/messagePresentation';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';
import { useMediaViewerImageControls } from '../hooks/useMediaViewerImageControls';

function WhatsAppMediaViewerThumb({
  message,
  active,
  onSelect,
}: {
  message: CommWhatsAppMessage;
  active: boolean;
  onSelect: (messageId: string) => void;
}) {
  const { mediaUrl, loading } = useResolvedMediaUrl(message);
  const isVideo = isVideoLikeMessageType(message.message_type);

  return (
    <button
      type="button"
      onClick={() => onSelect(message.id)}
      className={`whatsapp-inbox-media-viewer-thumb relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-all duration-200 ${active ? 'is-active scale-110 ring-2 ring-[var(--success)] ring-offset-2 ring-offset-[var(--bg-canvas)]' : 'opacity-60 hover:opacity-90'}`}
      aria-label="Abrir mídia"
      aria-current={active ? 'true' : undefined}
    >
      {mediaUrl ? (
        isVideo ? (
          <video muted playsInline preload="metadata" className="h-full w-full object-cover">
            <source src={mediaUrl} type={message.media_mime_type || undefined} />
          </video>
        ) : (
          <img src={mediaUrl} alt={message.media_file_name || 'Imagem'} className="h-full w-full object-cover" loading="lazy" />
        )
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[var(--bg-elevated)] text-[10px] text-[var(--text-muted)]">
          {loading ? '...' : 'Mídia'}
        </span>
      )}
      {isVideo ? (
        <span className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg-canvas)_20%,transparent)] text-[var(--text-primary)]">
          <Play className="h-4 w-4 fill-current" />
        </span>
      ) : null}
    </button>
  );
}
export function WhatsAppMediaViewer({
  messages,
  selectedMessageId,
  contactName,
  onSelect,
  onClose,
}: {
  messages: CommWhatsAppMessage[];
  selectedMessageId: string;
  contactName: string;
  onSelect: (messageId: string) => void;
  onClose: () => void;
}) {
  const selectedIndex = Math.max(0, messages.findIndex((message) => message.id === selectedMessageId));
  const selectedMessage = messages[selectedIndex] ?? messages[0];
  const { mediaUrl, loading, error } = useResolvedMediaUrl(selectedMessage);
  const isVideo = selectedMessage ? isVideoLikeMessageType(selectedMessage.message_type) : false;
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < messages.length - 1;
  const selectedName = selectedMessage?.media_file_name || (isVideo ? 'Vídeo' : 'Imagem');
  const selectedAuthor = selectedMessage?.direction === 'outbound' ? 'Você' : contactName;
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null);
  const imageControls = useMediaViewerImageControls(selectedMessageId);
  const { zoom, rotation, offset, changeZoom, rotate } = imageControls;

  const goToIndex = useCallback((nextIndex: number) => {
    const nextMessage = messages[nextIndex];
    if (nextMessage) {
      onSelect(nextMessage.id);
    }
  }, [messages, onSelect]);

  const scrollThumbnails = useCallback((direction: 'previous' | 'next') => {
    const target = thumbnailStripRef.current;
    if (!target) {
      return;
    }

    const amount = Math.max(260, target.clientWidth * 0.72);
    target.scrollBy({ left: direction === 'previous' ? -amount : amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault();
        goToIndex(selectedIndex - 1);
      }

      if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        goToIndex(selectedIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrevious, goToIndex, onClose, selectedIndex]);

  if (!selectedMessage) {
    return null;
  }

  const isDarkThemeActive = typeof document !== 'undefined'
    && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  const viewer = (
    <div className={`whatsapp-inbox-media-viewer comm-whatsapp-media-viewer modal-theme-host painel-theme kifer-ds ${isDarkThemeActive ? 'theme-dark' : 'theme-light'} fixed inset-0 z-[2147483000] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]`} role="dialog" aria-modal="true">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{selectedAuthor}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{formatMessageDaySeparatorLabel(selectedMessage.message_at)} às {formatMessageTime(selectedMessage.message_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {mediaUrl && !isVideo ? (
            <>
              <button
                type="button"
                onClick={() => changeZoom(zoom - 0.5)}
                disabled={zoom === 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Reduzir zoom"
                title="Reduzir zoom"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1)}
                className="inline-flex h-10 min-w-12 items-center justify-center rounded-lg px-1 text-xs font-semibold tabular-nums text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                aria-label="Ajustar imagem à tela"
                title="Ajustar à tela"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => changeZoom(zoom + 0.5)}
                disabled={zoom === 4}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Ampliar imagem"
                title="Ampliar imagem"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={rotate}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                aria-label="Rotacionar imagem"
                title={`Rotacionar (${rotation * 90}°)`}
              >
                <RotateCw className="h-5 w-5" />
              </button>
            </>
          ) : null}
          {mediaUrl ? (
            <a
              href={mediaUrl}
              download={selectedName}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Baixar mídia"
              title="Baixar"
            >
              <Download className="h-5 w-5" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-5">
        {canGoPrevious ? (
          <button
            type="button"
            onClick={() => goToIndex(selectedIndex - 1)}
            className="whatsapp-inbox-media-viewer-nav left-4"
            aria-label="Mídia anterior"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        ) : null}

        <div className="flex h-full w-full items-center justify-center">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando mídia...
            </div>
          ) : mediaUrl ? (
            isVideo ? (
              <video controls autoPlay className="max-h-full max-w-full bg-[var(--overlay)] object-contain">
                <source src={mediaUrl} type={selectedMessage.media_mime_type || undefined} />
              </video>
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center overflow-hidden ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ touchAction: zoom > 1 ? 'none' : 'auto' }}
                onPointerDown={imageControls.onPointerDown}
                onPointerMove={imageControls.onPointerMove}
                onPointerUp={imageControls.onPointerEnd}
                onPointerCancel={imageControls.onPointerEnd}
                onLostPointerCapture={imageControls.onPointerEnd}
              >
                <img
                  src={mediaUrl}
                  alt={selectedName}
                  draggable={false}
                  onDoubleClick={() => changeZoom(zoom === 1 ? 2 : 1)}
                  className={`max-h-full max-w-full select-none object-contain ${zoom === 1 ? 'cursor-zoom-in' : ''}`}
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation * 90}deg)` }}
                />
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-5 py-4 text-sm text-[var(--text-secondary)]">
              {error || 'Mídia indisponível no momento.'}
            </div>
          )}
        </div>

        {canGoNext ? (
          <button
            type="button"
            onClick={() => goToIndex(selectedIndex + 1)}
            className="whatsapp-inbox-media-viewer-nav right-4"
            aria-label="Próxima mídia"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        ) : null}
      </main>

      {messages.length > 1 ? (
        <footer className="whatsapp-inbox-media-viewer-strip relative shrink-0 border-t border-[var(--border-subtle)] px-16 py-2">
          <button
            type="button"
            onClick={() => scrollThumbnails('previous')}
            className="whatsapp-inbox-media-viewer-strip-nav left-4"
            aria-label="Rolar miniaturas para trás"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div ref={thumbnailStripRef} className="flex gap-3 overflow-x-auto p-3">
            {messages.map((message) => (
              <WhatsAppMediaViewerThumb
                key={message.id}
                message={message}
                active={message.id === selectedMessage.id}
                onSelect={onSelect}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollThumbnails('next')}
            className="whatsapp-inbox-media-viewer-strip-nav right-4"
            aria-label="Rolar miniaturas para frente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </footer>
      ) : null}
    </div>
  );

  return typeof document === 'undefined' ? viewer : createPortal(viewer, document.body);
}
