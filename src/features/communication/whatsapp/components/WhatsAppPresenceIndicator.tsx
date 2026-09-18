import { useEffect, useState } from 'react';

import type { CommWhatsAppChat } from '../domain/types';
import {
  COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS,
  getCommWhatsAppPresencePresentation,
} from '../domain/presence';

export default function WhatsAppPresenceIndicator({
  chat,
  compact = false,
}: {
  chat: Pick<CommWhatsAppChat, 'presence_status' | 'presence_last_seen_at' | 'presence_updated_at'>;
  compact?: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const presentation = getCommWhatsAppPresencePresentation(chat, nowMs);

  useEffect(() => {
    if (!presentation?.isTransient) return undefined;

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [presentation?.isTransient]);

  useEffect(() => {
    if (!chat.presence_updated_at) return undefined;
    const timeoutId = window.setTimeout(() => setNowMs(Date.now()), COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS + 250);
    return () => window.clearTimeout(timeoutId);
  }, [chat.presence_updated_at]);

  if (!presentation) return null;

  return (
    <span
      className={`whatsapp-inbox-presence is-${presentation.status}${compact ? ' is-compact' : ''}`}
      title={presentation.title}
      aria-label={presentation.title}
    >
      <span className="whatsapp-inbox-presence-dot" aria-hidden="true" />
      {!compact || presentation.isTransient ? <span>{presentation.label}</span> : null}
    </span>
  );
}
