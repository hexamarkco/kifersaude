import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock, Loader2, Pencil, Plus, Repeat, RotateCcw, Search, Trash2, X } from 'lucide-react';

import { Button, DateTimePicker, Dialog, DialogBody, IconButton, Input, Tabs, type TabItem } from '../../../../design-system';
import { toast } from '../../../../lib/toast';
import { formatDateTimeFullBR } from '../../../../lib/dateUtils';
import { commWhatsAppService, formatCommWhatsAppPhoneLabel } from '../data';
import type {
  CommWhatsAppScheduledMessage,
  CommWhatsAppScheduledMessageStatus,
  CommWhatsAppScheduledSequence,
  CommWhatsAppScheduledSequenceStatus,
} from '../domain/types';
import WhatsAppScheduleMessageModal from './WhatsAppScheduleMessageModal';

type WhatsAppScheduledMessagesPanelProps = {
  channelId?: string;
  chatId?: string;
  phoneDigits?: string;
  isOpen: boolean;
  onClose: () => void;
  onScheduleNew?: () => void;
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
  scheduled: 'bg-[var(--info-soft)] text-[var(--info-text)]',
  sending: 'bg-[var(--warning-soft)] text-[var(--warning-text)]',
  sent: 'bg-[var(--success-soft)] text-[var(--success-text)]',
  failed: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
  cancelled: 'bg-[var(--bg-inset)] text-[var(--text-muted)]',
  expired: 'bg-[var(--bg-inset)] text-[var(--text-muted)]',
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: '',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

const SCHEDULED_MESSAGES_PAGE_SIZE = 100;

type ScheduledMessagesView = 'upcoming' | 'attention' | 'history' | 'all';

const VIEW_STATUSES: Record<ScheduledMessagesView, readonly CommWhatsAppScheduledMessageStatus[]> = {
  upcoming: ['scheduled', 'sending'],
  attention: ['failed'],
  history: ['sent', 'cancelled', 'expired'],
  all: ['scheduled', 'sending', 'sent', 'failed', 'cancelled', 'expired'],
};

const SEQUENCE_STATUS_LABELS: Record<CommWhatsAppScheduledSequenceStatus, string> = {
  scheduled: 'Agendada',
  running: 'Executando',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const SEQUENCE_STATUS_COLORS: Record<CommWhatsAppScheduledSequenceStatus, string> = {
  scheduled: 'bg-[var(--info-soft)] text-[var(--info-text)]',
  running: 'bg-[var(--warning-soft)] text-[var(--warning-text)]',
  paused: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
  completed: 'bg-[var(--success-soft)] text-[var(--success-text)]',
  cancelled: 'bg-[var(--bg-inset)] text-[var(--text-muted)]',
};

const VIEW_SEQUENCE_STATUSES: Record<ScheduledMessagesView, readonly CommWhatsAppScheduledSequenceStatus[]> = {
  upcoming: ['scheduled', 'running'],
  attention: ['paused'],
  history: ['completed', 'cancelled'],
  all: ['scheduled', 'running', 'paused', 'completed', 'cancelled'],
};

function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function getDateRangeBoundary(value: string, boundary: 'start' | 'end'): number {
  const time = new Date(`${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`).getTime();
  return Number.isNaN(time) ? Number.NaN : time;
}

function getScheduleTimingLabel(value: string): string {
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) return 'Data indisponível';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduledDay = new Date(scheduledAt);
  scheduledDay.setHours(0, 0, 0, 0);
  const differenceInDays = Math.round((scheduledDay.getTime() - today.getTime()) / 86_400_000);
  const time = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (differenceInDays === 0) return `Hoje às ${time}`;
  if (differenceInDays === 1) return `Amanhã às ${time}`;
  if (differenceInDays === -1) return `Ontem às ${time}`;
  if (differenceInDays > 1) return `Em ${differenceInDays} dias, às ${time}`;
  return `Há ${Math.abs(differenceInDays)} dias, às ${time}`;
}

export default function WhatsAppScheduledMessagesPanel({
  channelId,
  chatId,
  phoneDigits,
  isOpen,
  onClose,
  onScheduleNew,
}: WhatsAppScheduledMessagesPanelProps) {
  const [messages, setMessages] = useState<CommWhatsAppScheduledMessage[]>([]);
  const [sequences, setSequences] = useState<CommWhatsAppScheduledSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<CommWhatsAppScheduledMessage | null>(null);
  const [editingSequence, setEditingSequence] = useState<CommWhatsAppScheduledSequence | null>(null);
  const [activeView, setActiveView] = useState<ScheduledMessagesView>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isFiltered = Boolean(chatId || phoneDigits);

  const loadMessages = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const allMessages: CommWhatsAppScheduledMessage[] = [];
      let offset = 0;

      while (true) {
        const data = await commWhatsAppService.listScheduledMessages({
          ...(channelId ? { channelId } : {}),
          ...(chatId ? { chatId } : {}),
          limit: SCHEDULED_MESSAGES_PAGE_SIZE,
          offset,
        });
        const page = data as unknown as CommWhatsAppScheduledMessage[];
        allMessages.push(...page);

        if (page.length < SCHEDULED_MESSAGES_PAGE_SIZE) break;
        offset += page.length;
      }

      setMessages(
        chatId
          ? allMessages
          : phoneDigits
          ? allMessages.filter((m) => m.phone_digits === phoneDigits)
          : allMessages,
      );

      const sequenceData = await commWhatsAppService.listScheduledSequences({
        ...(channelId ? { channelId } : {}),
        ...(chatId ? { chatId } : {}),
        ...(phoneDigits && !chatId ? { phoneDigits } : {}),
        limit: SCHEDULED_MESSAGES_PAGE_SIZE,
      });
      setSequences(sequenceData);
    } catch (error) {
      console.error('[ScheduledMessagesPanel] error loading', error);
    } finally {
      setLoading(false);
    }
  }, [channelId, chatId, phoneDigits, isOpen]);

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

  const handleCancelSequence = useCallback(async (id: string) => {
    setCancellingId(id);
    try {
      await commWhatsAppService.cancelScheduledSequence(id, 'Cancelada pelo usuário');
      toast.success('Sequência cancelada');
      await loadMessages();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao cancelar sequência';
      toast.error(message);
    } finally {
      setCancellingId(null);
    }
  }, [loadMessages]);

  const handleRetrySequence = useCallback(async (id: string) => {
    setCancellingId(id);
    try {
      await commWhatsAppService.retryScheduledSequence(id);
      toast.success('Sequência retomada');
      await loadMessages();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao retomar sequência';
      toast.error(message);
    } finally {
      setCancellingId(null);
    }
  }, [loadMessages]);

  const viewCounts = useMemo(() => {
    const counts: Record<ScheduledMessagesView, number> = {
      upcoming: 0,
      attention: 0,
      history: 0,
      all: messages.length,
    };

    for (const message of messages) {
      if (VIEW_STATUSES.upcoming.includes(message.status)) counts.upcoming += 1;
      if (VIEW_STATUSES.attention.includes(message.status)) counts.attention += 1;
      if (VIEW_STATUSES.history.includes(message.status)) counts.history += 1;
    }

    return counts;
  }, [messages]);

  const sequenceViewCounts = useMemo(() => {
    const counts: Record<ScheduledMessagesView, number> = {
      upcoming: 0,
      attention: 0,
      history: 0,
      all: sequences.length,
    };

    for (const sequence of sequences) {
      if (VIEW_SEQUENCE_STATUSES.upcoming.includes(sequence.status)) counts.upcoming += 1;
      if (VIEW_SEQUENCE_STATUSES.attention.includes(sequence.status)) counts.attention += 1;
      if (VIEW_SEQUENCE_STATUSES.history.includes(sequence.status)) counts.history += 1;
    }

    return counts;
  }, [sequences]);

  const viewTabs: TabItem<ScheduledMessagesView>[] = useMemo(() => [
    { id: 'upcoming', label: 'Próximas', badge: viewCounts.upcoming + sequenceViewCounts.upcoming },
    { id: 'attention', label: 'Atenção', badge: viewCounts.attention + sequenceViewCounts.attention },
    { id: 'history', label: 'Histórico', badge: viewCounts.history + sequenceViewCounts.history },
    { id: 'all', label: 'Todas', badge: viewCounts.all + sequenceViewCounts.all },
  ], [sequenceViewCounts, viewCounts]);

  const visibleMessages = useMemo(() => {
    const normalizedQuery = normalizeSearchTerm(searchQuery.trim());
    const allowedStatuses = VIEW_STATUSES[activeView];
    const startDateTime = startDate ? getDateRangeBoundary(startDate, 'start') : null;
    const endDateTime = endDate ? getDateRangeBoundary(endDate, 'end') : null;

    return messages
      .filter((message) => {
        if (!allowedStatuses.includes(message.status)) return false;
        const scheduleTime = new Date(message.next_run_at ?? message.scheduled_at).getTime();
        if (startDateTime !== null && scheduleTime < startDateTime) return false;
        if (endDateTime !== null && scheduleTime > endDateTime) return false;
        if (!normalizedQuery) return true;

        return normalizeSearchTerm([
          message.text_content,
          message.display_name,
          message.phone_number,
          message.phone_digits,
          message.label,
          STATUS_LABELS[message.status],
        ].filter(Boolean).join(' ')).includes(normalizedQuery);
      })
      .sort((first, second) => {
        const firstDate = new Date(first.next_run_at ?? first.scheduled_at).getTime();
        const secondDate = new Date(second.next_run_at ?? second.scheduled_at).getTime();
        return activeView === 'upcoming' ? firstDate - secondDate : secondDate - firstDate;
      });
  }, [activeView, endDate, messages, searchQuery, startDate]);

  const visibleSequences = useMemo(() => {
    const normalizedQuery = normalizeSearchTerm(searchQuery.trim());
    const allowedStatuses = VIEW_SEQUENCE_STATUSES[activeView];
    const startDateTime = startDate ? getDateRangeBoundary(startDate, 'start') : null;
    const endDateTime = endDate ? getDateRangeBoundary(endDate, 'end') : null;

    return sequences
      .filter((sequence) => {
        if (!allowedStatuses.includes(sequence.status)) return false;
        const scheduleTime = new Date(sequence.scheduled_at).getTime();
        if (startDateTime !== null && scheduleTime < startDateTime) return false;
        if (endDateTime !== null && scheduleTime > endDateTime) return false;
        if (!normalizedQuery) return true;

        return normalizeSearchTerm([
          sequence.label,
          sequence.display_name,
          sequence.phone_number,
          sequence.phone_digits,
          SEQUENCE_STATUS_LABELS[sequence.status],
        ].filter(Boolean).join(' ')).includes(normalizedQuery);
      })
      .sort((first, second) => {
        const firstDate = new Date(first.scheduled_at).getTime();
        const secondDate = new Date(second.scheduled_at).getTime();
        return activeView === 'upcoming' ? firstDate - secondDate : secondDate - firstDate;
      });
  }, [activeView, endDate, searchQuery, sequences, startDate]);

  const hasListFilters = Boolean(searchQuery || startDate || endDate);

  if (!isOpen) return null;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        size="wide"
        className="kds-dialog-fixed-height"
      >
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="kds-control-icon text-[var(--brand-primary)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {isFiltered ? 'Agendamentos do Contato' : 'Mensagens Agendadas'}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">{messages.length} mensagem(ns) e {sequences.length} sequência(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onScheduleNew && (
              <Button onClick={onScheduleNew} size="sm">
                <Plus className="kds-control-icon" />
                Agendar nova
              </Button>
            )}
            <IconButton onClick={onClose} aria-label="Fechar">
              <X className="kds-control-icon" />
            </IconButton>
          </div>
        </div>

      <DialogBody className="space-y-4 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="kds-control-icon animate-spin text-[var(--brand-primary)]" />
            </div>
          ) : messages.length === 0 && sequences.length === 0 ? (
            <div className="text-center py-12">
              <CalendarClock className="kds-control-icon text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)]">Nenhum agendamento encontrado</p>
              <p className="text-sm text-[var(--text-subtle)] mt-1 mb-4">
                Agende mensagens únicas ou sequências para envio automático
              </p>
              {onScheduleNew && (
                <Button onClick={onScheduleNew} size="sm">
                  <Plus className="kds-control-icon" />
                  Agendar nova mensagem
                </Button>
              )}
            </div>
          ) : (
            <>
              <Tabs
                items={viewTabs}
                value={activeView}
                onChange={setActiveView}
                variant="pill"
                size="sm"
                ariaLabel="Filtrar mensagens agendadas por situação"
                listClassName="overflow-x-auto"
              />

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
                <div className="space-y-1">
                  <label htmlFor="scheduled-messages-search" className="text-xs font-medium text-[var(--text-muted)]">
                    Buscar
                  </label>
                  <Input
                    id="scheduled-messages-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    leftIcon={Search}
                    placeholder="Mensagem, contato ou etiqueta..."
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="scheduled-messages-start-date" className="text-xs font-medium text-[var(--text-muted)]">
                    A partir de
                  </label>
                  <DateTimePicker
                    id="scheduled-messages-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    max={endDate || undefined}
                    placeholder="Qualquer data"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="scheduled-messages-end-date" className="text-xs font-medium text-[var(--text-muted)]">
                    Até
                  </label>
                  <DateTimePicker
                    id="scheduled-messages-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    min={startDate || undefined}
                    placeholder="Qualquer data"
                  />
                </div>
                {hasListFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-end"
                    onClick={() => {
                      setSearchQuery('');
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    Limpar
                  </Button>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                <span>{visibleMessages.length} mensagem(ns) e {visibleSequences.length} sequência(s) nesta visão</span>
                {hasListFilters ? <span>Filtro aplicado</span> : null}
              </div>

              {visibleSequences.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <Repeat className="kds-control-icon text-[var(--brand-primary)]" />
                    Sequências
                  </div>
                  {visibleSequences.map((sequence) => (
                    <ScheduledSequenceItem
                      key={sequence.id}
                      sequence={sequence}
                      cancelling={cancellingId === sequence.id}
                      onEdit={() => setEditingSequence(sequence)}
                      onCancel={() => void handleCancelSequence(sequence.id)}
                      onRetry={() => void handleRetrySequence(sequence.id)}
                    />
                  ))}
                </div>
              )}

              {visibleMessages.length === 0 && visibleSequences.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center">
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Nenhuma mensagem nesta visão
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {hasListFilters
                      ? 'Tente outro termo de busca ou consulte outra aba.'
                      : 'Quando houver mensagens nesta situação, elas aparecerão aqui.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleMessages.map((message) => (
                    <ScheduledMessageItem
                      key={message.id}
                      message={message}
                      cancelling={cancellingId === message.id}
                      onEdit={() => setEditingMessage(message)}
                      onCancel={() => void handleCancel(message.id)}
                      onDelete={() => void handleDelete(message.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
      </DialogBody>
      </Dialog>

      {editingMessage ? (
        <WhatsAppScheduleMessageModal
          key={editingMessage.id}
          isOpen
          onClose={() => setEditingMessage(null)}
          channelId={editingMessage.channel_id}
          chatId={editingMessage.chat_id}
          phoneDigits={editingMessage.phone_digits}
          leadId={editingMessage.lead_id}
          contractId={editingMessage.contract_id}
          scheduledMessage={editingMessage}
          onScheduled={() => {
            setEditingMessage(null);
            void loadMessages();
          }}
        />
      ) : null}

      {editingSequence ? (
        <WhatsAppScheduleMessageModal
          key={editingSequence.id}
          isOpen
          onClose={() => setEditingSequence(null)}
          channelId={editingSequence.channel_id}
          chatId={editingSequence.chat_id}
          phoneDigits={editingSequence.phone_digits}
          leadId={editingSequence.lead_id}
          contractId={editingSequence.contract_id}
          scheduledSequence={editingSequence}
          onScheduled={() => {
            setEditingSequence(null);
            void loadMessages();
          }}
        />
      ) : null}
    </>
  );
}

type ScheduledMessageItemProps = {
  message: CommWhatsAppScheduledMessage;
  cancelling: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

function ScheduledMessageItem({ message, cancelling, onEdit, onCancel, onDelete }: ScheduledMessageItemProps) {
  const isActive = message.status === 'scheduled' || message.status === 'failed';
  const scheduledAt = message.next_run_at ?? message.scheduled_at;

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] p-3 hover:border-[var(--border-default)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[message.status] ?? 'bg-[var(--bg-inset)] text-[var(--text-muted)]'}`}>
              {STATUS_LABELS[message.status] ?? message.status}
            </span>
            {message.recurrence !== 'none' && (
              <span className="inline-flex items-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] px-2 py-0.5 text-xs font-medium">
                {RECURRENCE_LABELS[message.recurrence]}
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--text-primary)] truncate">
            {message.text_content ?? '(Mídia)'}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1 font-medium text-[var(--text-secondary)]">
              <Clock className="kds-control-icon" />
              {getScheduleTimingLabel(scheduledAt)}
            </span>
            <span>{formatDateTimeFullBR(scheduledAt)}</span>
            <span>{formatCommWhatsAppPhoneLabel(message.phone_digits)}</span>
            {message.display_name && message.display_name !== message.phone_number && (
              <span className="truncate">{message.display_name}</span>
            )}
          </div>

          {message.label && (
            <p className="text-xs text-[var(--text-subtle)] mt-1">{message.label}</p>
          )}

          {message.error_message && (
            <p className="text-xs text-[var(--danger-text)] mt-1 truncate">{message.error_message}</p>
          )}
        </div>

        {isActive && (
          <div className="flex items-center gap-1 shrink-0">
            {message.status === 'scheduled' && (
              <IconButton
                onClick={onEdit}
                disabled={cancelling}
                aria-label="Editar mensagem agendada"
                title="Editar mensagem agendada"
              >
                <Pencil className="kds-control-icon" />
              </IconButton>
            )}
            {message.status === 'scheduled' && (
              <IconButton
                onClick={onCancel}
                disabled={cancelling}
                aria-label="Cancelar agendamento"
              >
                {cancelling ? <Loader2 className="kds-control-icon animate-spin" /> : <X className="kds-control-icon" />}
              </IconButton>
            )}
            {message.status === 'failed' && (
              <IconButton
                onClick={onDelete}
                disabled={cancelling}
                aria-label="Excluir mensagem"
              >
                {cancelling ? <Loader2 className="kds-control-icon animate-spin" /> : <Trash2 className="kds-control-icon" />}
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type ScheduledSequenceItemProps = {
  sequence: CommWhatsAppScheduledSequence;
  cancelling: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

function ScheduledSequenceItem({ sequence, cancelling, onEdit, onCancel, onRetry }: ScheduledSequenceItemProps) {
  const canCancel = sequence.status === 'scheduled' || sequence.status === 'running' || sequence.status === 'paused';
  const canRetry = sequence.status === 'paused';
  const stepCount = sequence.steps?.length;
  const canEdit = sequence.status === 'scheduled'
    && sequence.current_step_index === 0
    && Boolean(stepCount)
    && sequence.steps?.every((step) => step.status === 'pending' && step.actions.every((action) => action.status === 'pending'));

  return (
    <div className="rounded-lg border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEQUENCE_STATUS_COLORS[sequence.status]}`}>
              {SEQUENCE_STATUS_LABELS[sequence.status]}
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              Etapa {sequence.current_step_index + 1}{stepCount ? ` de ${stepCount}` : ''}
            </span>
          </div>
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
            {sequence.label || 'Sequência de mensagens'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1 font-medium text-[var(--text-secondary)]">
              <Clock className="kds-control-icon" />
              {getScheduleTimingLabel(sequence.scheduled_at)}
            </span>
            <span>{formatDateTimeFullBR(sequence.scheduled_at)}</span>
            <span>{formatCommWhatsAppPhoneLabel(sequence.phone_digits)}</span>
            {sequence.display_name && sequence.display_name !== sequence.phone_number && (
              <span className="truncate">{sequence.display_name}</span>
            )}
          </div>
          {sequence.last_error && (
            <p className="mt-1 truncate text-xs text-[var(--danger-text)]">{sequence.last_error}</p>
          )}
        </div>

        {(canCancel || canRetry) && (
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <IconButton onClick={onEdit} disabled={cancelling} aria-label="Editar sequência agendada" title="Editar sequência agendada">
                <Pencil className="kds-control-icon" />
              </IconButton>
            )}
            {canRetry && (
              <IconButton onClick={onRetry} disabled={cancelling} aria-label="Retomar sequência" title="Retomar sequência">
                {cancelling ? <Loader2 className="kds-control-icon animate-spin" /> : <RotateCcw className="kds-control-icon" />}
              </IconButton>
            )}
            {canCancel && (
              <IconButton onClick={onCancel} disabled={cancelling} aria-label="Cancelar sequência" title="Cancelar sequência">
                {cancelling ? <Loader2 className="kds-control-icon animate-spin" /> : <X className="kds-control-icon" />}
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
