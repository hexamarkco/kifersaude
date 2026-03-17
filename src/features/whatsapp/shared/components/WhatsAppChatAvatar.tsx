import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, UserCircle, Users } from 'lucide-react';
import { getChatAvatarClass } from '../inboxConstants';

type WhatsAppChatAvatarProps = {
  kind: string;
  alt: string;
  photoSources?: string[];
  shellClassName: string;
  iconClassName?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'auto' | 'sync';
};

const DEFAULT_ICON_CLASS_NAME = 'h-5 w-5';

export function WhatsAppChatAvatar({
  kind,
  alt,
  photoSources = [],
  shellClassName,
  iconClassName = DEFAULT_ICON_CLASS_NAME,
  loading = 'lazy',
  decoding = 'async',
}: WhatsAppChatAvatarProps) {
  const sanitizedPhotoSources = useMemo(
    () => photoSources.map((source) => source?.trim()).filter((source): source is string => Boolean(source)),
    [photoSources],
  );
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sanitizedPhotoSources.join('|')]);

  const activeSource = sanitizedPhotoSources[sourceIndex] ?? null;
  const containerClassName = `comm-avatar-shell ${shellClassName}`.trim();

  if (activeSource) {
    return (
      <div className={containerClassName}>
        <img
          src={activeSource}
          alt={alt}
          className="comm-avatar-image"
          loading={loading}
          decoding={decoding}
          onError={() => setSourceIndex((currentIndex) => currentIndex + 1)}
        />
      </div>
    );
  }

  return (
    <div className={`${containerClassName} comm-icon-chip flex items-center justify-center font-semibold ${getChatAvatarClass(kind)}`}>
      {kind === 'group' ? (
        <Users className={iconClassName} />
      ) : kind === 'direct' ? (
        <UserCircle className={iconClassName} />
      ) : (
        <MessageCircle className={iconClassName} />
      )}
    </div>
  );
}
