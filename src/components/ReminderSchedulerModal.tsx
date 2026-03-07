import { useMemo, useState } from 'react';
import { Calendar, Clock, Tag, AlertCircle } from 'lucide-react';
import { supabase, Lead } from '../lib/supabase';
import { convertLocalToUTC } from '../lib/dateUtils';
import { syncLeadNextReturnFromUpcomingReminder } from '../lib/leadReminderUtils';
import FilterSingleSelect from './FilterSingleSelect';
import Button from './ui/Button';
import DateTimePicker from './ui/DateTimePicker';
import Field from './ui/Field';
import Input from './ui/Input';
import ModalShell from './ui/ModalShell';
import Textarea from './ui/Textarea';

const TYPE_OPTIONS = ['Retorno', 'Follow-up', 'Outro'] as const;
const PRIORITY_OPTIONS = ['alta', 'normal', 'baixa'] as const;

type ReminderSchedulerModalProps = {
  lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;
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
  defaultType = 'Retorno',
  defaultPriority = 'normal',
  promptMessage,
}: ReminderSchedulerModalProps) {
  const [scheduledFor, setScheduledFor] = useState(getDefaultDateTime);
  const [title, setTitle] = useState(() => defaultTitle ?? `Follow-up: ${lead.nome_completo}`);
  const [description, setDescription] = useState(() => defaultDescription ?? '');
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>(defaultType);
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
      alert('Por favor, informe a data e hora do lembrete.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      alert('Informe um título para o lembrete.');
      return;
    }

    setSaving(true);

    try {
      const reminderDateUTC = convertLocalToUTC(scheduledFor);

      if (!reminderDateUTC) {
        alert('Data do lembrete inválida. Verifique e tente novamente.');
        return;
      }

      const trimmedDescription = description.trim();
      const finalDescription = trimmedDescription ? trimmedDescription : null;

      const { error: insertError } = await supabase.from('reminders').insert([
        {
          lead_id: lead.id,
          tipo: type,
          titulo: trimmedTitle,
          descricao: finalDescription,
          data_lembrete: reminderDateUTC,
          lido: false,
          prioridade: priority,
        },
      ]);

      if (insertError) throw insertError;

      const nextReturnDate = await syncLeadNextReturnFromUpcomingReminder(lead.id);

      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({
          ultimo_contato: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (leadUpdateError) throw leadUpdateError;

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
      alert('Erro ao criar lembrete. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title="Agendar novo lembrete"
      description={formattedLeadPhone ? `${lead.nome_completo} • ${formattedLeadPhone}` : lead.nome_completo}
      size="md"
      panelClassName="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Agora nao
          </Button>
          <Button variant="primary" onClick={handleSchedule} disabled={saving} loading={saving}>
            {saving ? 'Salvando...' : 'Agendar lembrete'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 flex-shrink-0 text-teal-600" />
            <div className="text-sm text-teal-800">
              <p className="font-medium">
                {promptMessage ?? 'Defina o proximo lembrete para continuar o acompanhamento manual do lead.'}
              </p>
              <p className="mt-1 text-xs text-teal-700">
                Escolha o melhor momento e personalize as informacoes conforme necessario.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field label="Titulo" required>
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
              <FilterSingleSelect
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
              <FilterSingleSelect
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

          <Field label="Data e hora" required>
            <DateTimePicker
              type="datetime-local"
              value={scheduledFor}
              onChange={setScheduledFor}
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
    </ModalShell>
  );
}
