import { memo } from 'react';
import { Play } from 'lucide-react';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';
import { useResolvedMediaUrl } from './useResolvedMediaUrl';
import { isVideoLikeMessageType } from './InboxComponentsShared';

function WhatsAppMediaViewerThumbBase({ message, active, onSelect }: { message: CommWhatsAppMessage; active: boolean; onSelect: (messageId: string) => void }) {
  const { mediaUrl, loading } = useResolvedMediaUrl(message);
  const isVideo = isVideoLikeMessageType(message.message_type);

  return (
    <button type="button" onClick={() => onSelect(message.id)} className={`whatsapp-inbox-media-viewer-thumb relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition ${active ? 'is-active' : ''}`} aria-label="Abrir mídia" aria-current={active ? 'true' : undefined}>
      {mediaUrl ? (
        isVideo ? (
          <video muted playsInline preload="metadata" className="h-full w-full object-cover"><source src={mediaUrl} type={message.media_mime_type || undefined} /></video>
        ) : (
          <img src={mediaUrl} alt={message.media_file_name || 'Imagem'} className="h-full w-full object-cover" loading="lazy" />
        )
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-white/5 text-[10px] text-white/60">{loading ? '...' : 'Mídia'}</span>
      )}
      {isVideo ? <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"><Play className="h-4 w-4 fill-current" /></span> : null}
    </button>
  );
}

export const WhatsAppMediaViewerThumb = memo(WhatsAppMediaViewerThumbBase);
