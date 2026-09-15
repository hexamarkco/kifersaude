import { useState, useMemo, useCallback, useRef, type ChangeEvent } from 'react';
import { Calendar, Clock, MessageSquare, Repeat, Upload, X } from 'lucide-react';

import {
  Button,
  Checkbox,
  DateTimePicker,
  IconButton,
  Input,
  Textarea,
  WorkspaceDialog,
} from '../../../../design-system';
import { toast } from '../../../../lib/toast';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService } from '../data';
import type {
  CommWhatsAppScheduledMessage,
  CommWhatsAppScheduledMessageRecurrence,
  CommWhatsAppScheduledMessageType,
} from '../domain/types';

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
  scheduledMessage?: CommWhatsAppScheduledMessage;
  onScheduled?: () => void;
};

type RecurrenceOption = {
  value: CommWhatsAppScheduledMessageRecurrence;
  label: string;
  description: string;
};

type ScheduledAttachment = {
  url: string;
  mimeType: string;
  filename: string;
  type: CommWhatsAppScheduledMessageType;
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
  scheduledMessage,
  onScheduled,
}: WhatsAppScheduleMessageModalProps) {
  const initialAttachment: ScheduledAttachment | null = (scheduledMessage?.media_url ?? initialMediaUrl)
    ? {
      url: scheduledMessage?.media_url ?? initialMediaUrl ?? '',
      mimeType: scheduledMessage?.media_mime_type ?? initialMediaMimeType ?? 'application/octet-stream',
      filename: scheduledMessage?.media_file_name ?? initialMediaFileName ?? 'Anexo',
      type: scheduledMessage?.message_type ?? initialMessageType ?? 'document',
    }
    : null;
  const [text, setText] = useState(scheduledMessage?.text_content ?? initialText ?? '');
  const [attachment, setAttachment] = useState<ScheduledAttachment | null>(initialAttachment);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const mediaUrl = attachment?.url ?? null;
  const mediaMimeType = attachment?.mimeType ?? null;
  const mediaFileName = attachment?.filename ?? null;
  const messageType: CommWhatsAppScheduledMessageType = attachment?.type ?? 'text';
  const [scheduledAt, setScheduledAt] = useState(
    scheduledMessage ? formatDateTimeLocal(new Date(scheduledMessage.next_run_at ?? scheduledMessage.scheduled_at)) : getDefaultScheduledAt,
  );
  const [recurrence, setRecurrence] = useState<CommWhatsAppScheduledMessageRecurrence>(scheduledMessage?.recurrence ?? 'none');
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState(
    scheduledMessage?.recurrence_ends_at ? formatDateTimeLocal(new Date(scheduledMessage.recurrence_ends_at)) : '',
  );
  const [label, setLabel] = useState(scheduledMessage?.label ?? '');
  const [cancelOnInboundMessage, setCancelOnInboundMessage] = useState(scheduledMessage?.cancel_on_inbound_message ?? false);
  const [submitting, setSubmitting] = useState(false);

  const hasContent = useMemo(() => {
    return text.trim().length > 0 || Boolean(mediaUrl);
  }, [text, mediaUrl]);

  const messageSegments = useMemo(() => {
    if (!text.trim()) return [];
    return splitWhatsAppMessageSegments(text);
  }, [text]);

  const segmentCount = messageSegments.length;

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
      if (scheduledMessage) {
        await commWhatsAppService.updateScheduledMessage(scheduledMessage.id, {
          scheduledAt: scheduledAtIso!,
          messageType,
          textContent: text.trim() || null,
          mediaUrl,
          mediaMimeType,
          mediaFileName,
          recurrence,
          recurrenceConfig: recurrence === 'none' ? {} : scheduledMessage.recurrence_config,
          recurrenceEndsAt: recurrenceEndsAtIso,
          label: label.trim() || null,
          cancelOnInboundMessage,
        });
        toast.success('Mensagem agendada atualizada!');
      } else {
        await commWhatsAppService.scheduleMessage({
          channelId,
          phoneDigits,
          scheduledAt: scheduledAtIso!,
          messageType,
          textContent: text.trim() || null,
          mediaUrl,
          mediaMimeType,
          mediaFileName,
          recurrence,
          recurrenceEndsAt: recurrenceEndsAtIso,
          leadId,
          contractId,
          label: label.trim() || null,
          cancelOnInboundMessage,
        });
        toast.success('Mensagem agendada com sucesso!');
      }

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
    mediaUrl,
    mediaMimeType,
    mediaFileName,
    recurrence,
    recurrenceEndsAtIso,
    leadId,
    contractId,
    label,
    cancelOnInboundMessage,
    scheduledMessage,
    onScheduled,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  const handleAttachmentChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file || uploadingAttachment || submitting) return;
    setUploadingAttachment(true);
    try {
      const uploaded = await commWhatsAppService.uploadScheduledMessageMedia(file);
      setAttachment({
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        filename: uploaded.filename,
        type: uploaded.type,
      });
      toast.success('Anexo adicionado ao agendamento.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível anexar o arquivo.');
    } finally {
      setUploadingAttachment(false);
    }
  }, [submitting, uploadingAttachment]);

  return (
    <WorkspaceDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={scheduledMessage ? 'Editar mensagem agendada' : 'Agendar mensagem'}
      description={scheduledMessage ? 'Atualize o conteúdo ou a programação do envio automático.' : 'Configure quando a mensagem deve ser enviada automaticamente.'}
      size="md"
    >
      <div className="space-y-4">
        <input
          ref={attachmentInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={(event) => void handleAttachmentChange(event)}
        />
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Mensagem
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite a mensagem..."
            rows={3}
            className="w-full"
          />
          {mediaUrl && (
            <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span className="inline-block px-2 py-1 bg-[var(--bg-inset)] rounded text-xs">
                {mediaMimeType ?? 'Mídia anexada'}
              </span>
              {mediaFileName && (
                <span className="truncate">{mediaFileName}</span>
              )}
              <IconButton
                type="button"
                aria-label="Remover anexo"
                disabled={submitting || uploadingAttachment}
                onClick={() => setAttachment(null)}
              >
                <X className="kds-control-icon" />
              </IconButton>
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={uploadingAttachment}
            disabled={submitting}
            onClick={() => attachmentInputRef.current?.click()}
          >
            {!uploadingAttachment && <Upload className="kds-control-icon" />}
            {attachment ? 'Substituir anexo' : 'Anexar mídia ou documento'}
          </Button>
          {segmentCount > 1 && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-3 py-2">
              <MessageSquare className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
              <span className="text-sm text-[var(--brand-primary)]">
                <strong>{segmentCount} mensagens</strong> serão enviadas em sequência
              </span>
            </div>
          )}
          {segmentCount > 1 && (
            <div className="mt-2 space-y-1.5">
              {messageSegments.map((segment, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[10px] font-bold text-[var(--text-muted)]">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-xs leading-5 text-[var(--text-secondary)] line-clamp-2">
                    {segment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            <Calendar className="inline-block w-4 h-4 mr-1" />
            Data e hora do envio
          </label>
          <DateTimePicker
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={formatDateTimeLocal(new Date())}
            className="w-full"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <Checkbox
            checked={cancelOnInboundMessage}
            onChange={(event) => setCancelOnInboundMessage(event.target.checked)}
            className="mt-0.5"
            aria-label="Cancelar se o contato responder antes do envio"
          />
          <span>
            <span className="block text-sm font-medium text-[var(--text-primary)]">
              Cancelar se o contato responder antes do envio
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
              A mensagem não será enviada caso o contato responda enquanto ela estiver aguardando.
            </span>
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
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
                    ? 'border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {recurrence !== 'none' && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              <Clock className="inline-block w-4 h-4 mr-1" />
              Repetir até
            </label>
            <DateTimePicker
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
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
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

        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-subtle)]">
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
          >
            {submitting ? (scheduledMessage ? 'Salvando...' : 'Agendando...') : (scheduledMessage ? 'Salvar alterações' : 'Agendar mensagem')}
          </Button>
        </div>
      </div>
    </WorkspaceDialog>
  );
}
