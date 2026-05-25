import { memo } from 'react';
import type { ChatPreviewIconType } from './InboxComponentsShared';
import { CHAT_PREVIEW_ICON_CONFIG } from './InboxComponentsShared';

function ChatPreviewIconBase({ type }: { type: ChatPreviewIconType }) {
  const { label, Icon } = CHAT_PREVIEW_ICON_CONFIG[type];

  return (
    <span aria-label={label} className="inline-flex items-center gap-1 align-middle text-[var(--panel-text-muted,#8a735f)]" role="img" title={label}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span>{label}</span>
    </span>
  );
}

export const ChatPreviewIcon = memo(ChatPreviewIconBase);
