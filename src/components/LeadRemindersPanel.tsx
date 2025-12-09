import { useMemo, useState } from 'react';
import { ArrowUpRight, Bell, Check, Clock, RefreshCw } from 'lucide-react';
import type { Reminder } from '../lib/supabase';
import { formatDateTimeForInput, formatDateTimeFullBR } from '../lib/dateUtils';

const EMPTY_STATE_COPY = {
  title: 'Nenhum lembrete para este lead',
  subtitle: 'Crie ou reagende um lembrete para acompanhar este contato direto pelo chat.',
};

type LeadRemindersPanelProps = {
  leadName?: string | null;
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onToggleRead: (reminderId: string, currentStatus: boolean) => Promise<void>;
  onReschedule: (reminderId: string, newDate: string) => Promise<void>;
};

export default function LeadRemindersPanel({
  leadName,
  reminders,
  loading,
  error,
  onReload,
  onToggleRead,
  onReschedule,
}: LeadRemindersPanelProps) {
  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [rescheduleLoading, setRescheduleLoading] = useState<Record<string, boolean>>({});

  const sortedReminders = useMemo(() => {
    return [...reminders].sort(
      (a, b) => new Date(a.data_lembrete).getTime() - new Date(b.data_lembrete).getTime(),
    );
  }, [reminders]);

  const openRescheduleForm = (reminder: Reminder) => {
    setRescheduleTargetId(reminder.id);
    setRescheduleValue(formatDateTimeForInput(reminder.data_lembrete));
  };

  const handleToggleRead = async (reminder: Reminder) => {
    setActionLoading(prev => ({ ...prev, [reminder.id]: true }));

    try {
      await onToggleRead(reminder.id, reminder.lido);
    } catch (toggleError) {
      console.error('Erro ao atualizar lembrete:', toggleError);
      alert('Não foi possível atualizar o status do lembrete. Tente novamente.');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[reminder.id];
        return next;
      });
    }
  };

  const handleRescheduleSubmit = async (reminder: Reminder) => {
    if (!rescheduleValue) {
      alert('Informe a nova data e hora do lembrete.');
      return;
    }

    setRescheduleLoading(prev => ({ ...prev, [reminder.id]: true }));

    try {
      await onReschedule(reminder.id, rescheduleValue);
      setRescheduleTargetId(null);
      setRescheduleValue('');
    } catch (rescheduleError) {
      console.error('Erro ao reagendar lembrete:', rescheduleError);
      alert('Não foi possível reagendar o lembrete. Tente novamente.');
    } finally {
      setRescheduleLoading(prev => {
        const next = { ...prev };
        delete next[reminder.id];
        return next;
      });
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map(item => (
            <div key={item} className="animate-pulse rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-4 w-20 rounded bg-slate-200" />
              </div>
              <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon />
            <span>{error}</span>
            <button
              type="button"
              onClick={onReload}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    if (sortedReminders.length === 0) {
      return (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
          <Bell className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-800">{EMPTY_STATE_COPY.title}</p>
          <p className="mt-1 text-xs text-slate-500">{EMPTY_STATE_COPY.subtitle}</p>
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-2">
        <div className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
          {sortedReminders.map(reminder => {
            const isRescheduling = rescheduleLoading[reminder.id];
            const isToggling = actionLoading[reminder.id];
            const isOpen = rescheduleTargetId === reminder.id;

            return (
              <div
                key={reminder.id}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{reminder.titulo}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {reminder.tipo || 'Sem tipo'}
                      </span>
                      {reminder.lido ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Concluído
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Previsto para {formatDateTimeFullBR(reminder.data_lembrete)}
                    </p>
                    {reminder.descricao ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{reminder.descricao}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleRead(reminder)}
                      disabled={isToggling}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {reminder.lido ? 'Marcar como não lido' : 'Marcar como lido'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openRescheduleForm(reminder)}
                      disabled={isRescheduling}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      Reagendar
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label className="block text-xs font-semibold text-slate-700">Nova data e hora</label>
                    <input
                      type="datetime-local"
                      value={rescheduleValue}
                      onChange={event => setRescheduleValue(event.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRescheduleTargetId(null);
                          setRescheduleValue('');
                        }}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRescheduleSubmit(reminder)}
                        disabled={isRescheduling}
                        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRescheduling ? 'Salvando...' : 'Salvar novo horário'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Lembretes do lead</p>
          <p className="text-xs text-slate-600">
            {leadName ? `Atividades vinculadas a ${leadName}` : 'Veja e atualize os lembretes deste contato.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Atualizar
        </button>
      </div>
      {renderContent()}
    </section>
  );
}

function AlertTriangleIcon() {
  return <span className="text-amber-500">⚠️</span>;
}
