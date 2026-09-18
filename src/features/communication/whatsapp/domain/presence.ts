import type { CommWhatsAppChat, CommWhatsAppPresenceStatus } from './types';

export type CommWhatsAppPresencePresentation = {
  status: CommWhatsAppPresenceStatus;
  label: string;
  title: string;
  isTransient: boolean;
} | null;

export const COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS = 20_000;

const isPresenceStatus = (value: unknown): value is CommWhatsAppPresenceStatus => (
  value === 'online'
  || value === 'offline'
  || value === 'typing'
  || value === 'recording'
  || value === 'pending'
  || value === 'unknown'
);

const formatLastSeen = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const getCommWhatsAppPresencePresentation = (
  chat: Pick<CommWhatsAppChat, 'presence_status' | 'presence_last_seen_at' | 'presence_updated_at'>,
  nowMs = Date.now(),
): CommWhatsAppPresencePresentation => {
  const status = isPresenceStatus(chat.presence_status) ? chat.presence_status : null;
  const updatedAtMs = chat.presence_updated_at ? Date.parse(chat.presence_updated_at) : NaN;
  const isTransient = status === 'typing' || status === 'recording';
  const transientIsStale = isTransient
    && Number.isFinite(updatedAtMs)
    && nowMs - updatedAtMs > COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS;

  if (!status || status === 'unknown') {
    const lastSeen = formatLastSeen(chat.presence_last_seen_at);
    return lastSeen
      ? { status: 'offline', label: `visto por último ${lastSeen}`, title: `Visto por último em ${lastSeen}`, isTransient: false }
      : null;
  }

  if (transientIsStale) {
    const lastSeen = formatLastSeen(chat.presence_last_seen_at);
    return lastSeen
      ? { status: 'offline', label: `visto por último ${lastSeen}`, title: `Visto por último em ${lastSeen}`, isTransient: false }
      : { status: 'offline', label: 'offline', title: 'Offline', isTransient: false };
  }

  if (status === 'typing') return { status, label: 'digitando…', title: 'Está digitando', isTransient: true };
  if (status === 'recording') return { status, label: 'gravando áudio…', title: 'Está gravando áudio', isTransient: true };
  if (status === 'online') return { status, label: 'online', title: 'Online', isTransient: false };
  if (status === 'pending') return { status, label: 'verificando presença…', title: 'Verificando presença', isTransient: false };

  const lastSeen = formatLastSeen(chat.presence_last_seen_at);
  return lastSeen
    ? { status, label: `visto por último ${lastSeen}`, title: `Visto por último em ${lastSeen}`, isTransient: false }
    : { status, label: 'offline', title: 'Offline', isTransient: false };
};
