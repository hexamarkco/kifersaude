import { memo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';
import { useResolvedMediaUrl } from './useResolvedMediaUrl';
import { formatFileSize, formatMessageTime, isVideoLikeMessageType } from './InboxComponentsShared';
import { WhatsAppMediaViewerThumb } from './WhatsAppMediaViewerThumb';

function WhatsAppMediaViewerBase({ messages, selectedMessageId, contactName, onSelect, onClose }: {
  messages: CommWhatsAppMessage[]; selectedMessageId: string; contactName: string; onSelect: (messageId: string) => void; onClose: () => void;
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

  const goToIndex = useCallback((nextIndex: number) => { const nextMessage = messages[nextIndex]; if (nextMessage) onSelect(nextMessage.id); }, [messages, onSelect]);
  const scrollThumbnails = useCallback((direction: 'previous' | 'next') => {
    const target = thumbnailStripRef.current;
    if (!target) return;
    const scrollAmount = target.clientWidth * 0.6;
    target.scrollBy({ left: direction === 'previous' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'ArrowLeft' && canGoPrevious) goToIndex(selectedIndex - 1);
    if (event.key === 'ArrowRight' && canGoNext) goToIndex(selectedIndex + 1);
  }, [canGoNext, canGoPrevious, goToIndex, onClose, selectedIndex]);

  const viewer = (
    <div className="fixed inset-0 z-[140] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Visualizador de mídia" onKeyDown={handleKeyDown} tabIndex={-1}>
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{selectedName}</p>
          <p className="truncate text-sm opacity-75">
            {selectedAuthor} &middot; {formatMessageTime(selectedMessage?.message_at)}
            {selectedMessage?.media_size_bytes && !isVideo ? <> &middot; {formatFileSize(selectedMessage.media_size_bytes)}</> : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => goToIndex(selectedIndex - 1)} disabled={!canGoPrevious} className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-30" aria-label="Mídia anterior"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => goToIndex(selectedIndex + 1)} disabled={!canGoNext} className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-30" aria-label="Próxima mídia"><ChevronRight className="h-5 w-5" /></button>
          {mediaUrl && !isVideo ? (
            <a href={mediaUrl} download={selectedMessage?.media_file_name || 'midia'} className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10" aria-label="Baixar mídia"><Download className="h-5 w-5" /></a>
          ) : null}
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10" aria-label="Fechar visualizador"><X className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-16 py-4">
        {mediaUrl ? (
          isVideo ? (
            <video controls preload="metadata" className="max-h-full max-w-full rounded-2xl"><source src={mediaUrl} type={selectedMessage?.media_mime_type || undefined} /></video>
          ) : (
            <img src={mediaUrl} alt={selectedName} className="max-h-full max-w-full rounded-2xl object-contain" />
          )
        ) : (
          <div className="flex items-center gap-2 text-lg opacity-60">
            {loading ? <span className="animate-pulse">Carregando...</span> : <span>{error || 'Mídia indisponivel'}</span>}
          </div>
        )}
      </main>

      {messages.length > 1 ? (
        <footer className="whatsapp-inbox-media-viewer-strip relative shrink-0 border-t border-white/10 px-16 py-4">
          <button type="button" onClick={() => scrollThumbnails('previous')} className="whatsapp-inbox-media-viewer-strip-nav left-4" aria-label="Rolar miniaturas para trás"><ChevronLeft className="h-5 w-5" /></button>
          <div ref={thumbnailStripRef} className="flex gap-3 overflow-x-auto py-1">
            {messages.map((message) => (
              <WhatsAppMediaViewerThumb key={message.id} message={message} active={message.id === selectedMessage.id} onSelect={onSelect} />
            ))}
          </div>
          <button type="button" onClick={() => scrollThumbnails('next')} className="whatsapp-inbox-media-viewer-strip-nav right-4" aria-label="Rolar miniaturas para frente"><ChevronRight className="h-5 w-5" /></button>
        </footer>
      ) : null}
    </div>
  );

  return typeof document === 'undefined' ? viewer : createPortal(viewer, document.body);
}

export const WhatsAppMediaViewer = memo(WhatsAppMediaViewerBase);
