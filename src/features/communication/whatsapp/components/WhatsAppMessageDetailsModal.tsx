import { useMemo } from 'react';
import { AlertCircle, Check, CheckCheck, Clock3, Info, Volume2 } from 'lucide-react';

import { Dialog, DialogBody, DialogDescription, DialogHeader, DialogTitle } from '../../../../design-system';
import { formatDateTimeFullBR } from '../../../../lib/dateUtils';
import { cx } from '../../../../lib/cx';
import { getMessageDeliveryStatusHistory, type MessageDeliveryStatusEvent } from '../domain/messageMetadata';
import { formatMessageTime } from '../domain/messageTimeline';
import type { CommWhatsAppMessage } from '../domain/types';

type WhatsAppMessageDetailsModalProps = {
  message: CommWhatsAppMessage | null;
  onClose: () => void;
};

type TimelineEvent = MessageDeliveryStatusEvent & {
  label: string;
  tone: 'pending' | 'success' | 'error';
  icon: typeof Clock3;
};

const getStatusPresentation = (status: string, messageType: string): Pick<TimelineEvent, 'label' | 'tone' | 'icon'> => {
  switch (status) {
    case 'pending': return { label: 'Aguardando envio', tone: 'pending', icon: Clock3 };
    case 'queued': return { label: 'Na fila de envio', tone: 'pending', icon: Clock3 };
    case 'sending': return { label: 'Enviando', tone: 'pending', icon: Clock3 };
    case 'sent': return { label: 'Enviada', tone: 'success', icon: Check };
    case 'received': return { label: 'Recebida', tone: 'success', icon: CheckCheck };
    case 'delivered': return { label: 'Entregue', tone: 'success', icon: CheckCheck };
    case 'read':
    case 'seen':
    case 'viewed': return { label: 'Lida', tone: 'success', icon: CheckCheck };
    case 'played': return { label: messageType === 'voice' ? 'Ouvida' : 'Reproduzida', tone: 'success', icon: Volume2 };
    case 'failed':
    case 'error': return { label: 'Falhou', tone: 'error', icon: AlertCircle };
    case 'deleted': return { label: 'Apagada', tone: 'error', icon: AlertCircle };
    default: return { label: 'Status atualizado', tone: 'pending', icon: Info };
  }
};

const formatMessageType = (value: string) => {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    text: 'Texto',
    image: 'Imagem',
    video: 'Vídeo',
    audio: 'Áudio',
    voice: 'Nota de voz',
    document: 'Documento',
    sticker: 'Figurinha',
    contact: 'Contato',
    contact_list: 'Lista de contatos',
  };
  return labels[normalized] ?? (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Mensagem');
};

const buildTimeline = (message: CommWhatsAppMessage): TimelineEvent[] => {
  const history = getMessageDeliveryStatusHistory(message);
  const events = history.length > 0 ? [...history] : [];
  const currentStatus = message.delivery_status.trim().toLowerCase();
  const hasSentEvent = events.some((event) => event.status === 'sent');

  if (!hasSentEvent && message.message_at && !['pending', 'queued', 'sending'].includes(currentStatus)) {
    events.unshift({ status: 'sent', at: message.message_at, error: null });
  }

  const hasCurrentStatusEvent = events.some((event) => event.status === currentStatus);
  if (
    currentStatus
    && !hasCurrentStatusEvent
    && currentStatus !== 'sent'
    && message.status_updated_at
  ) {
    events.push({ status: currentStatus, at: message.status_updated_at, error: message.error_message ?? null });
  }

  return events
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
    .map((event) => ({
      ...event,
      ...getStatusPresentation(event.status, message.message_type.trim().toLowerCase()),
    }));
};

export default function WhatsAppMessageDetailsModal({ message, onClose }: WhatsAppMessageDetailsModalProps) {
  const timeline = useMemo(() => (message ? buildTimeline(message) : []), [message]);
  const preview = message?.text_content?.trim() || message?.media_caption?.trim() || 'Mensagem sem texto';

  return (
    <Dialog
      open={Boolean(message)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
      aria-label="Dados da mensagem"
      className="comm-whatsapp-overlay"
    >
      <DialogHeader onClose={onClose} showCloseButton>
        <div className="min-w-0">
          <DialogTitle>Dados da mensagem</DialogTitle>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{preview}</p>
        </div>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {message ? (
          <>
            <DialogDescription>
              Acompanhe quando a mensagem foi enviada e os retornos confirmados pelo WhatsApp.
            </DialogDescription>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Tipo</p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]">{formatMessageType(message.message_type)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Status atual</p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]">
                  {getStatusPresentation(message.delivery_status.trim().toLowerCase(), message.message_type.trim().toLowerCase()).label}
                </p>
              </div>
              {message.external_message_id ? (
                <div className="col-span-2 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">ID externo</p>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--text-secondary)]">{message.external_message_id}</p>
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Linha do tempo</p>
              <div className="space-y-1">
                {timeline.length > 0 ? timeline.map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div key={`${event.status}:${event.at}:${index}`} className="flex items-start gap-3 rounded-xl px-2 py-2.5">
                      <span className={cx(
                        'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        event.tone === 'error'
                          ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                          : event.tone === 'success'
                            ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{event.label}</p>
                          <time className="shrink-0 text-xs font-medium text-[var(--text-muted)]" dateTime={event.at} title={formatDateTimeFullBR(event.at)}>
                            {formatMessageTime(event.at)}
                          </time>
                        </div>
                        {event.error ? <p className="mt-0.5 text-xs text-[var(--danger-text)]">{event.error}</p> : null}
                      </div>
                    </div>
                  );
                }) : (
                  <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-sm text-[var(--text-secondary)]">
                    Ainda não há confirmações de entrega para esta mensagem.
                  </p>
                )}
              </div>
            </div>

            {message.error_message ? (
              <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2.5 text-sm text-[var(--danger-text)]">
                <p className="font-semibold">Detalhe do erro</p>
                <p className="mt-1">{message.error_message}</p>
              </div>
            ) : null}

            <p className="text-xs text-[var(--text-muted)]">Horários exibidos no fuso de São Paulo.</p>
          </>
        ) : null}
      </DialogBody>
    </Dialog>
  );
}
