import { useMemo, useState } from 'react';
import { Calendar, Clock, Tag, AlertCircle } from 'lucide-react';
import type { Lead } from '../features/leads';
import { touchLeadContact } from '../features/leads';
import {
  createReminder,
  FOLLOW_UP_REMINDER_TYPE,
  MANUAL_REMINDER_TYPES,
  type ManualReminderType,
} from '../features/reminders';
import { convertLocalToUTC } from '../lib/dateUtils';
import { syncLeadNextReturnFromUpcomingReminder } from '../lib/leadReminderUtils';
import { LeadFavoriteBadge } from './LeadFavoriteStar';
import {
  Alert,
  Button,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  FilterSelect,
} from '../design-system';
import { toast } from '../lib/toast';

const TYPE_OPTIONS = MANUAL_REMINDER_TYPES;
const PRIORITY_OPTIONS = ['alta', 'normal', 'baixa'] as const;

type ReminderSchedulerModalProps = {
  lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel' | 'favorito'>;
  onClose: () => void;
  onScheduled?: (details: {
    reminderDate: string;
    type: string;
    title: string;
    description: string | null;
    priority: string;
  }) => void;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultType?: (typeof TYPE_OPTIONS)[number];
  defaultPriority?: (typeof PRIORITY_OPTIONS)[number];
  promptMessage?: string;
};

const formatDateTimeLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const moveToNextBusinessDay = (date: Date) => {
  const adjusted = new Date(date);

  while (isWeekend(adjusted)) {
    adjusted.setDate(adjusted.getDate() + 1);
  }

  return adjusted;
};

const getDefaultDateTime = () => {
  const suggested = new Date();
  suggested.setDate(suggested.getDate() + 1);
  suggested.setHours(10, 0, 0, 0);
  return formatDateTimeLocal(moveToNextBusinessDay(suggested));
};

export default function ReminderSchedulerModal({
  lead,
  onClose,
  onScheduled,
  defaultTitle,
  defaultDescription,
  defaultType = FOLLOW_UP_REMINDER_TYPE,
  defaultPriority = 'normal',
  promptMessage,
}: ReminderSchedulerModalProps) {
  const [scheduledFor, setScheduledFor] = useState(getDefaultDateTime);
  const [title, setTitle] = useState(() => defaultTitle ?? `Follow-up: ${lead.nome_completo}`);
  const [description, setDescription] = useState(() => defaultDescription ?? '');
  const [type, setType] = useState<ManualReminderType>(defaultType);
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>(defaultPriority);
  const [saving, setSaving] = useState(false);

  const formattedLeadPhone = useMemo(() => {
    if (!lead.telefone) return null;
    const digits = lead.telefone.replace(/\D/g, '');
    if (digits.length < 10) return lead.telefone;
    const ddd = digits.slice(0, 2);
    const prefix = digits.slice(2, digits.length === 10 ? 6 : 7);
    const suffix = digits.slice(digits.length === 10 ? 6 : 7);
    return `(${ddd}) ${prefix}-${suffix}`;
  }, [lead.telefone]);

  const handleSchedule = async () => {
    if (!scheduledFor) {
      toast.warning('Por favor, informe a data e hora do lembrete.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.warning('Informe um título para o lembrete.');
      return;
    }

    setSaving(true);

    try {
      const reminderDateUTC = convertLocalToUTC(scheduledFor);

      if (!reminderDateUTC) {
      toast.warning('Data do lembrete inválida. Verifique e tente novamente.');
        return;
      }

      const trimmedDescription = description.trim();
      const finalDescription = trimmedDescription ? trimmedDescription : null;

      await createReminder({
        lead_id: lead.id,
        tipo: type,
        titulo: trimmedTitle,
        descricao: finalDescription,
        data_lembrete: reminderDateUTC,
        lido: false,
        prioridade: priority,
      });

      const nextReturnDate = await syncLeadNextReturnFromUpcomingReminder(lead.id);

      await touchLeadContact(lead.id);

      onScheduled?.({
        reminderDate: nextReturnDate || reminderDateUTC,
        type,
        title: trimmedTitle,
        description: finalDescription,
        priority,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao criar lembrete manual:', error);
      toast.error('Erro ao criar lembrete. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} size="sm">
      <DialogHeader onClose={onClose}>
        <div><DialogTitle>Agendar novo lembrete</DialogTitle><DialogDescription className="flex items-center gap-1.5"><LeadFavoriteBadge favorito={lead.favorito} />{formattedLeadPhone ? `${lead.nome_completo} • ${formattedLeadPhone}` : lead.nome_completo}</DialogDescription></div>
      </DialogHeader>
      <DialogBody className="space-y-5">
      <div className="space-y-6">
        <Alert tone="accent">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">
                {promptMessage ?? 'Defina o proximo lembrete para continuar o acompanhamento manual do lead.'}
              </p>
              <p className="mt-1 text-xs">
                Escolha o melhor momento e personalize as informacoes conforme necessario.
              </p>
            </div>
          </div>
        </Alert>

        <div className="grid grid-cols-1 gap-4">
          <Field label="Titulo *">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Follow-up com o cliente"
              required
              leftIcon={Calendar}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo do lembrete">
              <FilterSelect
                icon={Tag}
                value={type}
                onChange={(value) => setType(value as (typeof TYPE_OPTIONS)[number])}
                placeholder="Tipo do lembrete"
                includePlaceholderOption={false}
                options={TYPE_OPTIONS.map((option) => ({
                  value: option,
                  label: option,
                }))}
              />
            </Field>
            <Field label="Prioridade">
              <FilterSelect
                icon={AlertCircle}
                value={priority}
                onChange={(value) => setPriority(value as (typeof PRIORITY_OPTIONS)[number])}
                placeholder="Prioridade"
                includePlaceholderOption={false}
                options={PRIORITY_OPTIONS.map((option) => ({
                  value: option,
                  label: option.charAt(0).toUpperCase() + option.slice(1),
                }))}
              />
            </Field>
          </div>

          <Field label="Data e hora *">
            <DateTimePicker
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              placeholder="Selecionar data e hora"
            />
          </Field>

          <Field label="Observacoes">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Anote detalhes importantes para o proximo contato"
            />
          </Field>
        </div>
      </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Agora nao</Button>
        <Button variant="primary" onClick={handleSchedule} disabled={saving} loading={saving}>{saving ? 'Salvando...' : 'Agendar lembrete'}</Button>
      </DialogFooter>
    </Dialog>
  );
}
