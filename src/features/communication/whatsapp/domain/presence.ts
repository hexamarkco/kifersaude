import type { CommWhatsAppChat, CommWhatsAppPresenceStatus } from './types';

export type CommWhatsAppPresencePresentation = {
  status: CommWhatsAppPresenceStatus;
  label: string;
  title: string;
  isTransient: boolean;
} | null;

export const COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS = 20_000;

const isPresenceStatus = (value: unknown): value is CommWhatsAppPresenceStatus => (
  value === 'typing' || value === 'recording' || value === 'unknown'
);

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

  if (!status || status === 'unknown') return null;

  if (transientIsStale) return null;

  if (status === 'typing') return { status, label: 'digitando…', title: 'Está digitando', isTransient: true };
  if (status === 'recording') return { status, label: 'gravando áudio…', title: 'Está gravando áudio', isTransient: true };
  return null;
};
