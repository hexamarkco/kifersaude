import { memo } from 'react';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';
import { WhatsAppGalleryMediaTile } from './WhatsAppGalleryMediaTile';

function WhatsAppMediaGroupBodyBase({ messages, onOpenImage }: { messages: CommWhatsAppMessage[]; onOpenImage: (messageId: string) => void }) {
  const visibleMessages = messages.slice(0, 4);
  const hiddenCount = Math.max(0, messages.length - visibleMessages.length);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {visibleMessages.map((message, index) => {
        const isWideHero = messages.length === 3 && index === 0;
        const overlayLabel = hiddenCount > 0 && index === visibleMessages.length - 1 ? `+${hiddenCount}` : undefined;
        return (
          <WhatsAppGalleryMediaTile key={message.id} message={message} onOpenImage={onOpenImage} className={isWideHero ? 'col-span-2 aspect-[16/9]' : 'aspect-square'} overlayLabel={overlayLabel} />
        );
      })}
    </div>
  );
}

export const WhatsAppMediaGroupBody = memo(WhatsAppMediaGroupBodyBase);
