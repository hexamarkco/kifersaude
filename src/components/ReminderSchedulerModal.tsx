import { useMemo, useRef, useState } from 'react';
import { AlertCircle, Clock, Tag } from 'lucide-react';
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
  Text,
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
  const savingRef = useRef(false);

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
    if (savingRef.current) return;

    if (!scheduledFor) {
      toast.warning('Por favor, informe a data e hora do lembrete.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.warning('Informe um título para o lembrete.');
      return;
    }

    const reminderDateUTC = convertLocalToUTC(scheduledFor);
    if (!reminderDateUTC) {
      toast.warning('Data do lembrete inválida. Verifique e tente novamente.');
      return;
    }

    const trimmedDescription = description.trim();
    const finalDescription = trimmedDescription ? trimmedDescription : null;

    savingRef.current = true;
    setSaving(true);

    try {
      try {
        await createReminder({
          lead_id: lead.id,
          tipo: type,
          titulo: trimmedTitle,
          descricao: finalDescription,
          data_lembrete: reminderDateUTC,
          lido: false,
          prioridade: priority,
        });
      } catch (error) {
        console.error('Erro ao criar lembrete manual:', error);
        toast.error('Erro ao criar lembrete. Tente novamente.');
        return;
      }

      let nextReturnDate = reminderDateUTC;
      let synchronizationFailed = false;

      try {
        nextReturnDate = (await syncLeadNextReturnFromUpcomingReminder(lead.id)) || reminderDateUTC;
      } catch (error) {
        synchronizationFailed = true;
        console.error('Lembrete criado, mas nao foi possivel sincronizar a proxima data do lead:', error);
      }

      try {
        await touchLeadContact(lead.id);
      } catch (error) {
        synchronizationFailed = true;
        console.error('Lembrete criado, mas nao foi possivel atualizar o contato do lead:', error);
      }

      if (synchronizationFailed) {
        toast.warning('Lembrete criado, mas alguns dados do lead ainda não foram sincronizados.');
      }

      onScheduled?.({
        reminderDate: nextReturnDate,
        type,
        title: trimmedTitle,
        description: finalDescription,
        priority,
      });
      onClose();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()} size="form" className="kds-lead-reminder-dialog">
      <DialogHeader onClose={saving ? undefined : onClose}>
        <div>
          <DialogTitle>Agendar novo lembrete</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <LeadFavoriteBadge favorito={lead.favorito} />
            {formattedLeadPhone ? `${lead.nome_completo} • ${formattedLeadPhone}` : lead.nome_completo}
          </DialogDescription>
        </div>
      </DialogHeader>
      <DialogBody>
        <div className="space-y-4">
          <Text as="p" size="sm" tone="muted" className="kds-lead-reminder-intro">
            <Clock className="kds-lead-reminder-intro-icon h-4 w-4" aria-hidden="true" />
            {promptMessage ?? 'Defina o próximo lembrete para continuar o acompanhamento manual do lead.'}
          </Text>

          <div className="kds-lead-reminder-fields">
            <Field label="Título *" className="kds-lead-reminder-title">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Follow-up com o cliente"
                title={title}
                required
              />
            </Field>

            <Field label="Tipo do lembrete" className="kds-lead-reminder-type">
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
            <Field label="Prioridade" className="kds-lead-reminder-priority">
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

            <Field label="Data e hora *" className="kds-lead-reminder-datetime">
              <DateTimePicker
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                placeholder="Selecionar data e hora"
              />
            </Field>

            <Field label="Responsável" hint="Responsável atual pelo lead" className="kds-lead-reminder-owner">
              <Input value={lead.responsavel?.trim() || 'Não definido'} readOnly />
            </Field>

            <Field label="Observações" className="kds-lead-reminder-observations">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Anote detalhes importantes para o próximo contato"
              />
            </Field>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button className="kds-lead-reminder-submit" variant="primary" onClick={handleSchedule} disabled={saving} loading={saving}>{saving ? 'Agendando...' : 'Agendar lembrete'}</Button>
      </DialogFooter>
    </Dialog>
  );
}
