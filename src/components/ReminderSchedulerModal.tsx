import { useMemo, useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { supabase, Lead } from '../lib/supabase';
import { convertLocalToUTC } from '../lib/dateUtils';

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

const getDefaultDateTime = () => {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  now.setHours(10, 0, 0, 0);
  return formatDateTimeLocal(now);
};

export default function ReminderSchedulerModal({
  lead,
  onClose,
  onScheduled,
  defaultTitle,
  defaultDescription,
  defaultType = 'Retorno',
  promptMessage,
}: ReminderSchedulerModalProps) {
  const [scheduledFor, setScheduledFor] = useState(getDefaultDateTime);
  const [title, setTitle] = useState(() => defaultTitle ?? `Follow-up: ${lead.nome_completo}`);
  const [description, setDescription] = useState(() => defaultDescription ?? '');
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>(defaultType);
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>('alta');
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

      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({
          proximo_retorno: reminderDateUTC,
          ultimo_contato: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (leadUpdateError) throw leadUpdateError;

      onScheduled?.({
        reminderDate: reminderDateUTC,
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
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="modal-panel w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-white/20 p-2">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Agendar novo lembrete</h3>
              <p className="text-xs text-teal-100">{lead.nome_completo}</p>
              {formattedLeadPhone && (
                <p className="text-[11px] text-teal-100/80">{formattedLeadPhone}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-panel-content space-y-6 px-6 py-6">
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 flex-shrink-0 text-teal-600" />
              <div className="text-sm text-teal-800">
                <p className="font-medium">
                  {promptMessage ?? 'Defina o próximo lembrete para continuar o acompanhamento manual do lead.'}
                </p>
                <p className="mt-1 text-xs text-teal-700">
                  Escolha o melhor momento e personalize as informações conforme necessário.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Título *</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                placeholder="Ex: Follow-up com o cliente"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo do lembrete</label>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as (typeof TYPE_OPTIONS)[number])}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Prioridade</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as (typeof PRIORITY_OPTIONS)[number])}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Data e hora *</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Anote detalhes importantes para o próximo contato"
                className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            type="button"
          >
            Agora não
          </button>
          <button
            onClick={handleSchedule}
            disabled={saving}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            {saving ? 'Salvando...' : 'Agendar lembrete'}
          </button>
        </div>
      </div>
    </div>
  );
}
