import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Loader2, Trash2, X } from 'lucide-react';

import { IconButton } from '../../../../design-system';
import { toast } from '../../../../lib/toast';
import { formatDateTimeFullBR } from '../../../../lib/dateUtils';
import { commWhatsAppService, formatCommWhatsAppPhoneLabel } from '../data';
import type { CommWhatsAppScheduledMessage } from '../domain/types';

type WhatsAppScheduledMessagesPanelProps = {
  channelId?: string;
  isOpen: boolean;
  onClose: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  sending: 'Enviando...',
  sent: 'Enviada',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-neutral-100 text-neutral-600',
  expired: 'bg-neutral-100 text-neutral-600',
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: '',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

export default function WhatsAppScheduledMessagesPanel({
  channelId,
  isOpen,
  onClose,
}: WhatsAppScheduledMessagesPanelProps) {
  const [messages, setMessages] = useState<CommWhatsAppScheduledMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!isOpen || !channelId) return;
    setLoading(true);
    try {
      const data = await commWhatsAppService.listScheduledMessages({
        channelId,
        limit: 50,
      });
      setMessages(data as unknown as CommWhatsAppScheduledMessage[]);
    } catch (error) {
      console.error('[ScheduledMessagesPanel] error loading', error);
    } finally {
      setLoading(false);
    }
  }, [channelId, isOpen]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const handleCancel = useCallback(async (id: string) => {
    setCancellingId(id);
    try {
      await commWhatsAppService.cancelScheduledMessage(id, 'Cancelado pelo usuário');
      toast.success('Mensagem agendada cancelada');
      await loadMessages();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao cancelar';
      toast.error(message);
    } finally {
      setCancellingId(null);
    }
  }, [loadMessages]);

  const handleDelete = useCallback(async (id: string) => {
    setCancellingId(id);
    try {
      await commWhatsAppService.deleteScheduledMessage(id);
      toast.success('Mensagem agendada excluída');
      await loadMessages();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir';
      toast.error(message);
    } finally {
      setCancellingId(null);
    }
  }, [loadMessages]);

  const groupedMessages = useMemo(() => {
    const now = new Date();
    const upcoming: CommWhatsAppScheduledMessage[] = [];
    const past: CommWhatsAppScheduledMessage[] = [];

    for (const msg of messages) {
      const scheduledDate = new Date(msg.scheduled_at);
      if (scheduledDate >= now || msg.status === 'scheduled' || msg.status === 'sending') {
        upcoming.push(msg);
      } else {
        past.push(msg);
      }
    }

    return { upcoming, past };
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-terracota-500" />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Mensagens Agendadas</h2>
              <p className="text-sm text-neutral-500">{messages.length} mensagem(ns) encontrada(s)</p>
            </div>
          </div>
          <IconButton onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-terracota-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">Nenhuma mensagem agendada</p>
              <p className="text-sm text-neutral-400 mt-1">
                Use o botão de agendamento no composer para criar uma
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedMessages.upcoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">Próximas</h3>
                  <div className="space-y-2">
                    {groupedMessages.upcoming.map((msg) => (
                      <ScheduledMessageItem
                        key={msg.id}
                        message={msg}
                        cancelling={cancellingId === msg.id}
                        onCancel={() => void handleCancel(msg.id)}
                        onDelete={() => void handleDelete(msg.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedMessages.past.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">Histórico</h3>
                  <div className="space-y-2">
                    {groupedMessages.past.map((msg) => (
                      <ScheduledMessageItem
                        key={msg.id}
                        message={msg}
                        cancelling={cancellingId === msg.id}
                        onCancel={() => void handleCancel(msg.id)}
                        onDelete={() => void handleDelete(msg.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ScheduledMessageItemProps = {
  message: CommWhatsAppScheduledMessage;
  cancelling: boolean;
  onCancel: () => void;
  onDelete: () => void;
};

function ScheduledMessageItem({ message, cancelling, onCancel, onDelete }: ScheduledMessageItemProps) {
  const isActive = message.status === 'scheduled' || message.status === 'failed';

  return (
    <div className="rounded-lg border border-neutral-200 p-3 hover:border-neutral-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[message.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
              {STATUS_LABELS[message.status] ?? message.status}
            </span>
            {message.recurrence !== 'none' && (
              <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">
                {RECURRENCE_LABELS[message.recurrence]}
              </span>
            )}
          </div>

          <p className="text-sm text-neutral-900 truncate">
            {message.text_content ?? '(Mídia)'}
          </p>

          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTimeFullBR(message.scheduled_at)}
            </span>
            <span>{formatCommWhatsAppPhoneLabel(message.phone_digits)}</span>
            {message.display_name && message.display_name !== message.phone_number && (
              <span className="truncate">{message.display_name}</span>
            )}
          </div>

          {message.label && (
            <p className="text-xs text-neutral-400 mt-1">{message.label}</p>
          )}

          {message.error_message && (
            <p className="text-xs text-red-500 mt-1 truncate">{message.error_message}</p>
          )}
        </div>

        {isActive && (
          <div className="flex items-center gap-1 shrink-0">
            {message.status === 'scheduled' && (
              <IconButton
                onClick={onCancel}
                disabled={cancelling}
                aria-label="Cancelar agendamento"
                className="text-neutral-400 hover:text-red-500"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </IconButton>
            )}
            {message.status === 'failed' && (
              <IconButton
                onClick={onDelete}
                disabled={cancelling}
                aria-label="Excluir mensagem"
                className="text-neutral-400 hover:text-red-500"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}