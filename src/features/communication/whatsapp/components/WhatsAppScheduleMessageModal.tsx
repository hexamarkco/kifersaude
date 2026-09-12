import { useState, useMemo, useCallback } from 'react';
import { Calendar, Clock, Repeat } from 'lucide-react';

import {
  Button,
  Input,
  Textarea,
  WorkspaceDialog,
} from '../../../../design-system';
import { toast } from '../../../../lib/toast';
import { commWhatsAppService } from '../data';
import type { CommWhatsAppScheduledMessageRecurrence, CommWhatsAppScheduledMessageType } from '../domain/types';

type WhatsAppScheduleMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  phoneDigits: string;
  leadId?: string | null;
  contractId?: string | null;
  initialText?: string;
  initialMediaUrl?: string | null;
  initialMediaMimeType?: string | null;
  initialMediaFileName?: string | null;
  initialMessageType?: CommWhatsAppScheduledMessageType;
  onScheduled?: () => void;
};

type RecurrenceOption = {
  value: CommWhatsAppScheduledMessageRecurrence;
  label: string;
  description: string;
};

const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  { value: 'none', label: 'Sem recorrência', description: 'Enviar apenas uma vez' },
  { value: 'daily', label: 'Diário', description: 'Repetir todos os dias' },
  { value: 'weekly', label: 'Semanal', description: 'Repetir toda semana' },
  { value: 'monthly', label: 'Mensal', description: 'Repetir todo mês' },
];

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultScheduledAt(): string {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  now.setMinutes(0, 0, 0);
  return formatDateTimeLocal(now);
}

export default function WhatsAppScheduleMessageModal({
  isOpen,
  onClose,
  channelId,
  phoneDigits,
  leadId,
  contractId,
  initialText,
  initialMediaUrl,
  initialMediaMimeType,
  initialMediaFileName,
  initialMessageType,
  onScheduled,
}: WhatsAppScheduleMessageModalProps) {
  const [text, setText] = useState(initialText ?? '');
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduledAt);
  const [recurrence, setRecurrence] = useState<CommWhatsAppScheduledMessageRecurrence>('none');
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const messageType: CommWhatsAppScheduledMessageType = useMemo(() => {
    if (initialMessageType) return initialMessageType;
    if (initialMediaUrl) {
      if (initialMediaMimeType?.startsWith('image/')) return 'image';
      if (initialMediaMimeType?.startsWith('video/')) return 'video';
      if (initialMediaMimeType?.startsWith('audio/')) return 'audio';
      return 'document';
    }
    return 'text';
  }, [initialMessageType, initialMediaUrl, initialMediaMimeType]);

  const hasContent = useMemo(() => {
    return text.trim().length > 0 || Boolean(initialMediaUrl);
  }, [text, initialMediaUrl]);

  const scheduledAtIso = useMemo(() => {
    if (!scheduledAt) return null;
    return new Date(scheduledAt).toISOString();
  }, [scheduledAt]);

  const recurrenceEndsAtIso = useMemo(() => {
    if (!recurrenceEndsAt || recurrence === 'none') return null;
    return new Date(recurrenceEndsAt).toISOString();
  }, [recurrenceEndsAt, recurrence]);

  const isValid = useMemo(() => {
    if (!hasContent) return false;
    if (!scheduledAtIso) return false;
    if (new Date(scheduledAtIso) <= new Date()) return false;
    if (recurrence !== 'none' && !recurrenceEndsAtIso) return false;
    return true;
  }, [hasContent, scheduledAtIso, recurrence, recurrenceEndsAtIso]);

  const handleSchedule = useCallback(async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    try {
      await commWhatsAppService.scheduleMessage({
        channelId,
        phoneDigits,
        scheduledAt: scheduledAtIso!,
        messageType,
        textContent: text.trim() || null,
        mediaUrl: initialMediaUrl ?? null,
        mediaMimeType: initialMediaMimeType ?? null,
        mediaFileName: initialMediaFileName ?? null,
        recurrence,
        recurrenceEndsAt: recurrenceEndsAtIso,
        leadId,
        contractId,
        label: label.trim() || null,
      });

      toast.success('Mensagem agendada com sucesso!');
      onScheduled?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao agendar mensagem';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    isValid,
    submitting,
    channelId,
    phoneDigits,
    scheduledAtIso,
    messageType,
    text,
    initialMediaUrl,
    initialMediaMimeType,
    initialMediaFileName,
    recurrence,
    recurrenceEndsAtIso,
    leadId,
    contractId,
    label,
    onScheduled,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  return (
    <WorkspaceDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Agendar mensagem"
      description="Configure quando a mensagem deve ser enviada automaticamente."
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Mensagem
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite a mensagem..."
            rows={3}
            className="w-full"
          />
          {initialMediaUrl && (
            <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
              <span className="inline-block px-2 py-1 bg-neutral-100 rounded text-xs">
                {initialMediaMimeType ?? 'Mídia anexada'}
              </span>
              {initialMediaFileName && (
                <span className="truncate">{initialMediaFileName}</span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            <Calendar className="inline-block w-4 h-4 mr-1" />
            Data e hora do envio
          </label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={formatDateTimeLocal(new Date())}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            <Repeat className="inline-block w-4 h-4 mr-1" />
            Recorrência
          </label>
          <div className="grid grid-cols-2 gap-2">
            {RECURRENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRecurrence(option.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  recurrence === option.value
                    ? 'border-terracota-500 bg-terracota-50 text-terracota-700'
                    : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                }`}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {recurrence !== 'none' && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              <Clock className="inline-block w-4 h-4 mr-1" />
              Repetir até
            </label>
            <Input
              type="datetime-local"
              value={recurrenceEndsAt}
              onChange={(e) => setRecurrenceEndsAt(e.target.value)}
              min={scheduledAt}
              className="w-full"
              placeholder="Data limite da recorrência"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Etiqueta (opcional)
          </label>
          <Input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Lembrete de aniversário"
            className="w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!isValid || submitting}
            className="bg-terracota-500 hover:bg-terracota-600 text-white"
          >
            {submitting ? 'Agendando...' : 'Agendar mensagem'}
          </Button>
        </div>
      </div>
    </WorkspaceDialog>
  );
}