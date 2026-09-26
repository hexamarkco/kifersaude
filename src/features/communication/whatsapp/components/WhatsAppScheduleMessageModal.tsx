import { useState, useMemo, useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import { Calendar, Clock, MessageSquare, Plus, Repeat, Trash2, Upload, X } from 'lucide-react';

import {
  Button,
  Checkbox,
  DateTimePicker,
  IconButton,
  Input,
  SegmentedControl,
  Select,
  Textarea,
  WorkspaceDialog,
} from '../../../../design-system';
import { toast } from '../../../../lib/toast';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { useConfig } from '../../../../contexts/ConfigContext';
import { listPendingRemindersForLead, type Reminder } from '../../../reminders';
import { commWhatsAppService } from '../data';
import type {
  CommWhatsAppScheduledMessage,
  CommWhatsAppScheduledMessageRecurrence,
  CommWhatsAppScheduledMessageType,
  CommWhatsAppScheduledSequence,
  CommWhatsAppScheduledSequenceActionType,
  CommWhatsAppScheduledSequenceStep,
} from '../domain/types';

type WhatsAppScheduleMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  chatId?: string | null;
  phoneDigits: string;
  leadId?: string | null;
  contractId?: string | null;
  initialText?: string;
  initialMediaUrl?: string | null;
  initialMediaMimeType?: string | null;
  initialMediaFileName?: string | null;
  initialMessageType?: CommWhatsAppScheduledMessageType;
  scheduledMessage?: CommWhatsAppScheduledMessage;
  scheduledSequence?: CommWhatsAppScheduledSequence;
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

type SequenceActionDraft = {
  id: string;
  type: CommWhatsAppScheduledSequenceActionType;
  statusId: string;
  reminderId: string;
  statusName: string;
  title: string;
  description: string;
  dueHours: number;
  priority: 'baixa' | 'normal' | 'alta';
};

type SequenceStepDraft = {
  id: string;
  delayHours: number;
  text: string;
  attachment: ScheduledAttachment | null;
  reminderId: string;
  actions: SequenceActionDraft[];
};

const createSequenceAction = (type: CommWhatsAppScheduledSequenceActionType = 'update_status'): SequenceActionDraft => ({
  id: crypto.randomUUID(),
  type,
  statusId: '',
  reminderId: '',
  statusName: '',
  title: 'Próximo follow-up',
  description: '',
  dueHours: 24,
  priority: 'normal',
});

function readConfigString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value : '';
}

function readConfigNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function createSequenceStepDraft(step: CommWhatsAppScheduledSequenceStep): SequenceStepDraft {
  return {
    id: step.id ?? crypto.randomUUID(),
    delayHours: step.delaySeconds / 3600,
    text: step.textContent ?? '',
    attachment: step.mediaUrl
      ? {
          url: step.mediaUrl,
          mimeType: step.mediaMimeType ?? 'application/octet-stream',
          filename: step.mediaFileName ?? 'Anexo',
          type: step.messageType ?? 'document',
        }
      : null,
    reminderId: step.reminderId ?? '',
    actions: step.actions.map((action) => {
      const config = action.config;
      return {
        id: action.id ?? crypto.randomUUID(),
        type: action.actionType,
        statusId: readConfigString(config, 'status_id'),
        reminderId: readConfigString(config, 'reminder_id'),
        statusName: readConfigString(config, 'status_name'),
        title: readConfigString(config, 'title') || 'Próximo follow-up',
        description: readConfigString(config, 'description'),
        dueHours: Math.max(0, readConfigNumber(config, 'due_seconds', 86400) / 3600),
        priority: ['baixa', 'normal', 'alta'].includes(readConfigString(config, 'priority'))
          ? readConfigString(config, 'priority') as SequenceActionDraft['priority']
          : 'normal',
      };
    }),
  };
}

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
  chatId,
  phoneDigits,
  leadId,
  contractId,
  initialText,
  initialMediaUrl,
  initialMediaMimeType,
  initialMediaFileName,
  initialMessageType,
  scheduledMessage,
  scheduledSequence,
  onScheduled,
}: WhatsAppScheduleMessageModalProps) {
  const { leadStatuses } = useConfig();
  const [mode, setMode] = useState<'single' | 'sequence'>(scheduledSequence ? 'sequence' : 'single');
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
    scheduledMessage
      ? formatDateTimeLocal(new Date(scheduledMessage.next_run_at ?? scheduledMessage.scheduled_at))
      : scheduledSequence
        ? formatDateTimeLocal(new Date(scheduledSequence.scheduled_at))
        : getDefaultScheduledAt,
  );
  const [recurrence, setRecurrence] = useState<CommWhatsAppScheduledMessageRecurrence>(scheduledMessage?.recurrence ?? 'none');
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState(
    scheduledMessage?.recurrence_ends_at ? formatDateTimeLocal(new Date(scheduledMessage.recurrence_ends_at)) : '',
  );
  const [label, setLabel] = useState(scheduledMessage?.label ?? scheduledSequence?.label ?? '');
  const [cancelOnInboundMessage, setCancelOnInboundMessage] = useState(
    scheduledMessage?.cancel_on_inbound_message ?? scheduledSequence?.cancel_on_inbound_message ?? false,
  );
  const [pendingReminders, setPendingReminders] = useState<Reminder[]>([]);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStepDraft[]>(() => scheduledSequence?.steps?.length
    ? scheduledSequence.steps.map(createSequenceStepDraft)
    : [{
        id: crypto.randomUUID(),
        delayHours: 0,
        text: initialText ?? '',
        attachment: initialAttachment,
        reminderId: '',
        actions: [],
      }]);
  const [submitting, setSubmitting] = useState(false);
  const sequenceAttachmentRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingSequenceStepIds, setUploadingSequenceStepIds] = useState<Record<string, boolean>>({});
  const attachmentUploadRequestIdRef = useRef(0);
  const sequenceAttachmentUploadRequestIdsRef = useRef<Record<string, number>>({});
  const uploadSessionRef = useRef(0);
  const hasUploadingSequenceAttachment = Object.values(uploadingSequenceStepIds).some(Boolean);
  const hasUploadingAttachment = uploadingAttachment || hasUploadingSequenceAttachment;

  useEffect(() => {
    if (!leadId || mode !== 'sequence') {
      setPendingReminders([]);
      return;
    }
    let active = true;
    void listPendingRemindersForLead(leadId)
      .then((items) => {
        if (active) setPendingReminders(items);
      })
      .catch(() => {
        if (active) setPendingReminders([]);
      });
    return () => {
      active = false;
    };
  }, [leadId, mode]);

  useEffect(() => {
    if (!isOpen) {
      uploadSessionRef.current += 1;
    }
  }, [isOpen]);

  useEffect(() => {
    const sequenceAttachmentUploadRequestIds = sequenceAttachmentUploadRequestIdsRef.current;
    return () => {
      uploadSessionRef.current += 1;
      attachmentUploadRequestIdRef.current += 1;
      for (const stepId of Object.keys(sequenceAttachmentUploadRequestIds)) {
        sequenceAttachmentUploadRequestIds[stepId] += 1;
      }
    };
  }, []);

  const hasContent = useMemo(() => {
    return text.trim().length > 0 || Boolean(mediaUrl);
  }, [text, mediaUrl]);

  const messageSegments = useMemo(() => {
    if (!text.trim()) return [];
    return splitWhatsAppMessageSegments(text);
  }, [text]);

  const segmentCount = messageSegments.length;

  const sequenceIsValid = useMemo(() => {
    if (sequenceSteps.length === 0) return false;
    return sequenceSteps.every((step) => {
      const hasMessage = step.text.trim().length > 0 || Boolean(step.attachment?.url);
      if (!hasMessage && step.actions.length === 0) return false;
      return step.actions.every((action) => {
        if (action.type === 'update_status') return Boolean(action.statusId);
        if (action.type === 'complete_reminder') return Boolean(action.reminderId || step.reminderId);
        if (action.type === 'create_reminder') return Boolean(action.title.trim());
        return true;
      });
    });
  }, [sequenceSteps]);

  const scheduledAtIso = useMemo(() => {
    if (!scheduledAt) return null;
    return new Date(scheduledAt).toISOString();
  }, [scheduledAt]);

  const recurrenceEndsAtIso = useMemo(() => {
    if (!recurrenceEndsAt || recurrence === 'none') return null;
    return new Date(recurrenceEndsAt).toISOString();
  }, [recurrenceEndsAt, recurrence]);

  const isValid = useMemo(() => {
    if (mode === 'sequence') {
      return sequenceIsValid && Boolean(scheduledAtIso) && new Date(scheduledAtIso ?? 0) > new Date();
    }
    if (!hasContent) return false;
    if (!scheduledAtIso) return false;
    if (new Date(scheduledAtIso) <= new Date()) return false;
    if (recurrence !== 'none' && !recurrenceEndsAtIso) return false;
    return true;
  }, [hasContent, mode, scheduledAtIso, recurrence, recurrenceEndsAtIso, sequenceIsValid]);

  const handleSchedule = useCallback(async () => {
    if (!isValid || submitting || hasUploadingAttachment) return;

    setSubmitting(true);
    try {
      if (mode === 'sequence') {
        const sequenceInput = {
          channelId,
          chatId,
          phoneDigits,
          scheduledAt: scheduledAtIso!,
          leadId,
          contractId,
          label: label.trim() || null,
          cancelOnInboundMessage,
          steps: sequenceSteps.map((step) => ({
            delaySeconds: Math.max(0, Math.round(step.delayHours * 3600)),
            reminderId: step.reminderId || null,
            message: step.text.trim() || step.attachment?.url
              ? {
                  messageType: step.attachment?.type ?? 'text',
                  textContent: step.text.trim() || null,
                  mediaUrl: step.attachment?.url ?? null,
                  mediaMimeType: step.attachment?.mimeType ?? null,
                  mediaFileName: step.attachment?.filename ?? null,
                }
              : null,
            actions: step.actions.map((action) => ({
              actionType: action.type,
              config: action.type === 'update_status'
                ? { status_id: action.statusId, status_name: action.statusName.trim() }
                : action.type === 'complete_reminder'
                  ? { reminder_id: action.reminderId || step.reminderId || null }
                  : action.type === 'create_reminder'
                    ? {
                        title: action.title.trim(),
                        description: action.description.trim(),
                        due_seconds: Math.max(0, Math.round(action.dueHours * 3600)),
                        priority: action.priority,
                        type: 'Follow-up',
                      }
                    : {},
            })),
          })),
        };
        if (scheduledSequence) {
          const updated = await commWhatsAppService.updateScheduledSequence(scheduledSequence.id, sequenceInput);
          if (!updated) throw new Error('A sequência não está mais disponível para edição. Atualize a lista e tente novamente.');
          toast.success('Sequência atualizada!');
        } else {
          await commWhatsAppService.scheduleSequence(sequenceInput);
          toast.success('Sequência de mensagens agendada com sucesso!');
        }
        onScheduled?.();
        onClose();
        return;
      }

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
          chatId,
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
    mode,
    submitting,
    channelId,
    chatId,
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
    scheduledSequence,
    sequenceSteps,
    onScheduled,
    onClose,
    hasUploadingAttachment,
  ]);

  const handleClose = useCallback(() => {
    if (submitting || hasUploadingAttachment) return;
    uploadSessionRef.current += 1;
    onClose();
  }, [hasUploadingAttachment, onClose, submitting]);

  const handleAttachmentChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file || uploadingAttachment || submitting) return;
    const requestId = attachmentUploadRequestIdRef.current + 1;
    attachmentUploadRequestIdRef.current = requestId;
    const sessionId = uploadSessionRef.current;
    setUploadingAttachment(true);
    try {
      const uploaded = await commWhatsAppService.uploadScheduledMessageMedia(file);
      if (requestId !== attachmentUploadRequestIdRef.current || sessionId !== uploadSessionRef.current) return;
      setAttachment({
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        filename: uploaded.filename,
        type: uploaded.type,
      });
      toast.success('Anexo adicionado ao agendamento.');
    } catch (error) {
      if (requestId !== attachmentUploadRequestIdRef.current || sessionId !== uploadSessionRef.current) return;
      toast.error(error instanceof Error ? error.message : 'Não foi possível anexar o arquivo.');
    } finally {
      if (requestId === attachmentUploadRequestIdRef.current) {
        setUploadingAttachment(false);
      }
    }
  }, [submitting, uploadingAttachment]);

  const updateSequenceStep = useCallback((stepId: string, patch: Partial<SequenceStepDraft>) => {
    setSequenceSteps((current) => current.map((step) => step.id === stepId ? { ...step, ...patch } : step));
  }, []);

  const updateSequenceAction = useCallback((stepId: string, actionId: string, patch: Partial<SequenceActionDraft>) => {
    setSequenceSteps((current) => current.map((step) => step.id === stepId
      ? { ...step, actions: step.actions.map((action) => action.id === actionId ? { ...action, ...patch } : action) }
      : step));
  }, []);

  const addSequenceStep = useCallback(() => {
    setSequenceSteps((current) => [...current, {
      id: crypto.randomUUID(),
      delayHours: 24,
      text: '',
      attachment: null,
      reminderId: '',
      actions: [],
    }]);
  }, []);

  const uploadSequenceAttachment = useCallback(async (stepId: string, event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file || submitting || uploadingSequenceStepIds[stepId]) return;
    const requestId = (sequenceAttachmentUploadRequestIdsRef.current[stepId] ?? 0) + 1;
    sequenceAttachmentUploadRequestIdsRef.current[stepId] = requestId;
    const sessionId = uploadSessionRef.current;
    setUploadingSequenceStepIds((current) => ({ ...current, [stepId]: true }));
    try {
      const uploaded = await commWhatsAppService.uploadScheduledMessageMedia(file);
      if (requestId !== sequenceAttachmentUploadRequestIdsRef.current[stepId] || sessionId !== uploadSessionRef.current) return;
      updateSequenceStep(stepId, {
        attachment: {
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          filename: uploaded.filename,
          type: uploaded.type,
        },
      });
      toast.success('Anexo adicionado à etapa.');
    } catch (error) {
      if (requestId !== sequenceAttachmentUploadRequestIdsRef.current[stepId] || sessionId !== uploadSessionRef.current) return;
      toast.error(error instanceof Error ? error.message : 'Não foi possível anexar a mídia.');
    } finally {
      if (requestId === sequenceAttachmentUploadRequestIdsRef.current[stepId]) {
        setUploadingSequenceStepIds((current) => ({ ...current, [stepId]: false }));
      }
    }
  }, [submitting, updateSequenceStep, uploadingSequenceStepIds]);

  return (
    <WorkspaceDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={scheduledSequence ? 'Editar sequência agendada' : scheduledMessage ? 'Editar mensagem agendada' : 'Agendar mensagem'}
      description={scheduledSequence
        ? 'Atualize as etapas, ações ou a programação da sequência.'
        : scheduledMessage
          ? 'Atualize o conteúdo ou a programação do envio automático.'
          : 'Configure quando a mensagem deve ser enviada automaticamente.'}
      size="md"
    >
      <div className="space-y-4">
        <input
          ref={attachmentInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          disabled={submitting || uploadingAttachment}
          onChange={(event) => void handleAttachmentChange(event)}
        />
        {!scheduledMessage && !scheduledSequence && (
          <SegmentedControl
            items={[
              { id: 'single', label: 'Mensagem única' },
              { id: 'sequence', label: 'Criar sequência' },
            ]}
            value={mode}
            onChange={(nextMode) => {
              setMode(nextMode);
              if (nextMode === 'sequence') {
                setCancelOnInboundMessage(true);
                setSequenceSteps((current) => current.map((step, index) => index === 0 && !step.text.trim() && !step.attachment
                  ? { ...step, text, attachment }
                  : step));
              }
            }}
            size="sm"
            className="w-full"
            listClassName="grid w-full grid-cols-2"
            triggerClassName="w-full"
            ariaLabel="Tipo de agendamento"
          />
        )}

        {mode === 'single' ? <div>
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
            disabled={submitting || uploadingAttachment}
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
        </div> : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Etapas da sequência</p>
                <p className="text-xs text-[var(--text-muted)]">Cada etapa pode enviar uma mensagem, executar ações ou fazer os dois.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addSequenceStep}>
                <Plus className="kds-control-icon" /> Adicionar etapa
              </Button>
            </div>

            {sequenceSteps.map((step, stepIndex) => (
              <div key={step.id} className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-xs font-semibold text-[var(--brand-primary)]">{stepIndex + 1}</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Etapa {stepIndex + 1}</span>
                  </div>
                  {sequenceSteps.length > 1 && (
                    <IconButton
                      type="button"
                      variant="danger"
                      aria-label={`Remover etapa ${stepIndex + 1}`}
                      onClick={() => setSequenceSteps((current) => current.filter((candidate) => candidate.id !== step.id))}
                    >
                      <Trash2 className="kds-control-icon" />
                    </IconButton>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{stepIndex === 0 ? 'Primeira etapa' : 'Aguardar após etapa anterior (horas)'}</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.25}
                        value={stepIndex === 0 ? 0 : step.delayHours}
                        disabled={stepIndex === 0}
                        onChange={(event) => updateSequenceStep(step.id, { delayHours: Number(event.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Lembrete relacionado</label>
                      <Select
                        size="sm"
                        value={step.reminderId}
                        placeholder="Nenhum lembrete"
                        onChange={(event) => updateSequenceStep(step.id, { reminderId: event.target.value })}
                        options={[
                          { value: '', label: 'Nenhum lembrete' },
                          ...pendingReminders.map((reminder) => ({ value: reminder.id, label: reminder.titulo })),
                        ]}
                      />
                    </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Mensagem (opcional)</label>
                  <Textarea value={step.text} onChange={(event) => updateSequenceStep(step.id, { text: event.target.value })} rows={3} placeholder="Deixe vazio se esta etapa for somente operacional." />
                  <input
                    ref={(element) => { sequenceAttachmentRefs.current[step.id] = element; }}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    disabled={submitting || Boolean(uploadingSequenceStepIds[step.id])}
                    onChange={(event) => void uploadSequenceAttachment(step.id, event)}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" loading={Boolean(uploadingSequenceStepIds[step.id])} disabled={submitting || Boolean(uploadingSequenceStepIds[step.id])} onClick={() => sequenceAttachmentRefs.current[step.id]?.click()}>
                      {!uploadingSequenceStepIds[step.id] && <Upload className="kds-control-icon" />} {step.attachment ? 'Substituir mídia' : 'Anexar mídia'}
                    </Button>
                    {step.attachment && <span className="flex min-w-0 items-center gap-1 text-xs text-[var(--text-muted)]"><span className="truncate">{step.attachment.filename}</span><IconButton type="button" aria-label="Remover mídia" disabled={submitting || Boolean(uploadingSequenceStepIds[step.id])} onClick={() => updateSequenceStep(step.id, { attachment: null })}><X className="kds-control-icon" /></IconButton></span>}
                  </div>
                </div>

                <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ações da etapa</span>
                    <Select
                      size="sm"
                      value=""
                      placeholder="Adicionar ação..."
                      onChange={(event) => {
                        const type = event.target.value as CommWhatsAppScheduledSequenceActionType;
                        if (!type) return;
                        setSequenceSteps((current) => current.map((candidate) => candidate.id === step.id
                          ? { ...candidate, actions: [...candidate.actions, createSequenceAction(type)] }
                          : candidate));
                      }}
                      options={[
                        { value: '', label: 'Adicionar ação...' },
                        { value: 'update_status', label: 'Alterar status do lead' },
                        { value: 'complete_reminder', label: 'Concluir lembrete' },
                        { value: 'create_reminder', label: 'Criar próximo lembrete' },
                        { value: 'cancel_sequence', label: 'Cancelar sequência' },
                      ]}
                    />
                  </div>
                  {step.actions.map((action, actionIndex) => (
                    <div key={action.id} className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">{actionIndex + 1}. {action.type === 'update_status' ? 'Alterar status' : action.type === 'complete_reminder' ? 'Concluir lembrete' : action.type === 'create_reminder' ? 'Criar próximo lembrete' : 'Cancelar sequência'}</span>
                        <IconButton type="button" variant="danger" aria-label="Remover ação" onClick={() => setSequenceSteps((current) => current.map((candidate) => candidate.id === step.id ? { ...candidate, actions: candidate.actions.filter((item) => item.id !== action.id) } : candidate))}><Trash2 className="kds-control-icon" /></IconButton>
                      </div>
                      {action.type === 'update_status' && (
                        <Select
                          size="sm"
                          value={action.statusId}
                          placeholder="Selecione o status"
                          options={[
                            { value: '', label: 'Selecione o status' },
                            ...leadStatuses.filter((status) => status.ativo !== false).map((status) => ({ value: status.id, label: status.nome })),
                          ]}
                          onChange={(event) => {
                          const status = leadStatuses.find((candidate) => candidate.id === event.target.value);
                          updateSequenceAction(step.id, action.id, { statusId: event.target.value, statusName: status?.nome ?? '' });
                          }}
                        />
                      )}
                      {action.type === 'complete_reminder' && (
                        <Select
                          size="sm"
                          value={action.reminderId || step.reminderId}
                          placeholder="Selecione o lembrete"
                          onChange={(event) => updateSequenceAction(step.id, action.id, { reminderId: event.target.value })}
                          options={[
                            { value: '', label: 'Selecione o lembrete' },
                            ...pendingReminders.map((reminder) => ({ value: reminder.id, label: reminder.titulo })),
                          ]}
                        />
                      )}
                      {action.type === 'create_reminder' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input value={action.title} placeholder="Título do próximo lembrete" onChange={(event) => updateSequenceAction(step.id, action.id, { title: event.target.value })} />
                          <Input type="number" min={0} step={0.5} value={action.dueHours} placeholder="Horas até o lembrete" onChange={(event) => updateSequenceAction(step.id, action.id, { dueHours: Number(event.target.value) || 0 })} />
                          <Textarea className="sm:col-span-2" rows={2} value={action.description} placeholder="Descrição opcional" onChange={(event) => updateSequenceAction(step.id, action.id, { description: event.target.value })} />
                        </div>
                      )}
                      {action.type === 'cancel_sequence' && <p className="text-xs text-[var(--text-muted)]">As etapas futuras serão canceladas depois que esta ação for executada.</p>}
                    </div>
                  ))}
                  {step.actions.length === 0 && <p className="text-xs text-[var(--text-muted)]">Nenhuma ação configurada.</p>}
                </div>
              </div>
            ))}
          </div>
        )}

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

        {mode === 'single' && <div>
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
        </div>}

        {recurrence !== 'none' && mode === 'single' && (
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
            disabled={submitting || hasUploadingAttachment}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!isValid || submitting || hasUploadingAttachment}
          >
            {submitting
              ? (scheduledMessage || scheduledSequence ? 'Salvando...' : 'Agendando...')
              : (scheduledMessage || scheduledSequence ? 'Salvar alterações' : 'Agendar mensagem')}
          </Button>
        </div>
      </div>
    </WorkspaceDialog>
  );
}
