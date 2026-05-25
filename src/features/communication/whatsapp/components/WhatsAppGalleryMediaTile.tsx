import { memo } from 'react';
import { Play } from 'lucide-react';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';
import { useResolvedMediaUrl } from './useResolvedMediaUrl';
import { formatDurationLabel, formatFileSize, isVideoLikeMessageType } from './InboxComponentsShared';

function WhatsAppGalleryMediaTileBase({ message, onOpenImage, className, overlayLabel }: {
  message: CommWhatsAppMessage; onOpenImage: (messageId: string) => void; className?: string; overlayLabel?: string;
}) {
  const { mediaUrl, loading, error } = useResolvedMediaUrl(message);
  const normalizedKind = isVideoLikeMessageType(message.message_type) ? 'video' : 'image';
  const baseClassName = `relative block overflow-hidden rounded-[1.15rem] bg-[rgba(26,18,13,0.08)] ${className ?? ''}`.trim();

  if (normalizedKind === 'image') {
    return mediaUrl ? (
      <button type="button" onClick={() => onOpenImage(message.id)} className={baseClassName}>
        <img src={mediaUrl} alt={message.media_file_name || 'Imagem enviada'} className="h-full w-full object-cover" loading="lazy" />
        {overlayLabel ? <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-base font-semibold text-white">{overlayLabel}</span> : null}
      </button>
    ) : (
      <div className={`${baseClassName} flex items-center justify-center text-sm text-[var(--panel-text-muted,#8a735f)]`}>
        {loading ? 'Carregando imagem...' : error || 'Imagem indisponivel'}
      </div>
    );
  }

  const secondaryLabel = message.media_duration_seconds && message.media_duration_seconds > 0
    ? formatDurationLabel(Math.round(message.media_duration_seconds)) : formatFileSize(message.media_size_bytes) || 'Video';

  return mediaUrl ? (
    <button type="button" onClick={() => onOpenImage(message.id)} className={baseClassName}>
      <video muted playsInline preload="metadata" className="h-full w-full object-cover">
        <source src={mediaUrl} type={message.media_mime_type || undefined} />
      </video>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-3 py-2 text-xs font-medium text-white">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Play className="h-3.5 w-3.5 fill-current" />
          <span className="truncate">{secondaryLabel}</span>
        </span>
        {overlayLabel ? <span className="text-sm font-semibold">{overlayLabel}</span> : null}
      </div>
    </button>
  ) : (
    <div className={`${baseClassName} flex items-center justify-center text-sm text-[var(--panel-text-muted,#8a735f)]`}>
      {loading ? 'Carregando video...' : error || 'Video indisponivel'}
    </div>
  );
}

export const WhatsAppGalleryMediaTile = memo(WhatsAppGalleryMediaTileBase);
