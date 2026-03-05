import { useEffect, useMemo, useState } from 'react';
import { supabase, Reminder } from '../../lib/supabase';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Circle,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';
import Textarea from '../ui/Textarea';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';
import { TodoCalendarSkeleton } from '../ui/panelSkeletons';

const getDateKey = (date: Date) => date.toISOString().split('T')[0];

const toDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonth = (date: Date, other: Date) =>
  date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth();

const isSameDay = (date: Date, other: Date) =>
  isSameMonth(date, other) && date.getDate() === other.getDate();

export default function TodoCalendar() {
  const [tasks, setTasks] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null);
  const loadingUi = useAdaptiveLoading(loading);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('reminders')
        .select('*')
        .eq('tipo', 'Tarefa')
        .order('data_lembrete', { ascending: true });

      if (fetchError) throw fetchError;
      setTasks(data || []);
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
      setError('Não foi possível carregar suas tarefas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleAddTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTaskTitle.trim() || !selectedDate) return;

    setSavingTask(true);
    setError(null);

    const dueDate = new Date(selectedDate);
    dueDate.setHours(12, 0, 0, 0);

    try {
      const { error: insertError } = await supabase.from('reminders').insert([
        {
          tipo: 'Tarefa',
          titulo: newTaskTitle.trim(),
          descricao: newTaskDescription.trim() || null,
          data_lembrete: dueDate.toISOString(),
          lido: false,
          prioridade: 'normal',
        },
      ]);

      if (insertError) throw insertError;

      setNewTaskTitle('');
      setNewTaskDescription('');
      setIsAddModalOpen(false);
      await loadTasks();
    } catch (err) {
      console.error('Erro ao criar tarefa:', err);
      setError('Não foi possível criar a tarefa.');
    } finally {
      setSavingTask(false);
    }
  };

  const updateTaskStatus = async (taskId: string, done: boolean) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if ((done && task.lido) || (!done && !task.lido)) return;

    try {
      const { error: updateError } = await supabase
        .from('reminders')
        .update({
          lido: done,
          concluido_em: done ? new Date().toISOString() : null,
        })
        .eq('id', taskId);

      if (updateError) throw updateError;
      await loadTasks();
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
      setError('Não foi possível atualizar a tarefa.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('reminders')
        .delete()
        .eq('id', taskId);

      if (deleteError) throw deleteError;
      await loadTasks();
    } catch (err) {
      console.error('Erro ao remover tarefa:', err);
      setError('Não foi possível remover a tarefa.');
    }
  };

  const handleRescheduleTask = async (taskId: string, newDate: Date) => {
    try {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;

      const taskDateTime = toDate(task.data_lembrete);
      const newDateTime = new Date(newDate);

      if (taskDateTime) {
        newDateTime.setHours(taskDateTime.getHours(), taskDateTime.getMinutes(), 0, 0);
      } else {
        newDateTime.setHours(12, 0, 0, 0);
      }

      const { error: updateError } = await supabase
        .from('reminders')
        .update({ data_lembrete: newDateTime.toISOString() })
        .eq('id', taskId);

      if (updateError) throw updateError;

      setReschedulingTaskId(null);
      await loadTasks();
    } catch (err) {
      console.error('Erro ao reagendar tarefa:', err);
      setError('Não foi possível reagendar a tarefa.');
    }
  };

  const goToPreviousMonth = () => {
    const previous = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(previous);
  };

  const goToNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(next);
  };

  const getDaysInMonth = () =>
    new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const getFirstWeekday = () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const tasksByMonth = useMemo(() => {
    return tasks.filter((task) => {
      const date = toDate(task.data_lembrete);
      return date ? isSameMonth(date, currentMonth) : false;
    });
  }, [tasks, currentMonth]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    tasksByMonth.forEach((task) => {
      const date = toDate(task.data_lembrete);
      if (!date) return;
      const key = getDateKey(date);
      const items = map.get(key) || [];
      items.push(task);
      map.set(
        key,
        items.sort((a, b) => new Date(a.data_lembrete).getTime() - new Date(b.data_lembrete).getTime())
      );
    });
    return map;
  }, [tasksByMonth]);

  const selectedDateTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const date = toDate(task.data_lembrete);
        return date ? isSameDay(date, selectedDate) : false;
      })
      .sort((a, b) => new Date(a.data_lembrete).getTime() - new Date(b.data_lembrete).getTime());
  }, [tasks, selectedDate]);

  const pendingTasks = selectedDateTasks.filter((task) => !task.lido);
  const completedTasks = selectedDateTasks.filter((task) => task.lido);

  const handleDayClick = async (date: Date) => {
    if (reschedulingTaskId) {
      await handleRescheduleTask(reschedulingTaskId, date);
      return;
    }

    setSelectedDate(date);
    setIsDayModalOpen(true);
    setError(null);
  };

  const closeDayModal = () => {
    setIsDayModalOpen(false);
    setIsAddModalOpen(false);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setReschedulingTaskId(null);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setNewTaskTitle('');
    setNewTaskDescription('');
  };

  const renderCalendar = () => {
    const cells = [];
    const firstWeekday = getFirstWeekday();
    const totalDays = getDaysInMonth();
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateKey = getDateKey(cellDate);
      const dayTasks = tasksByDay.get(dateKey) || [];
      const pendingCount = dayTasks.filter((task) => !task.lido).length;
      const doneCount = dayTasks.filter((task) => task.lido).length;
      const totalCount = dayTasks.length;
      const isToday = isSameDay(cellDate, new Date());
      const isSelected = isSameDay(cellDate, selectedDate);

      const baseClasses =
        'aspect-square p-2 rounded-lg border transition-all text-left flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500';

      const stateClasses = isSelected
        ? 'bg-sky-600 text-white border-sky-600 shadow-lg'
        : isToday
        ? 'bg-sky-50 text-sky-700 border-sky-300'
        : dayTasks.length > 0
        ? 'border-sky-200 bg-sky-50/70 hover:bg-sky-100'
        : reschedulingTaskId
        ? 'border-sky-300 hover:bg-sky-50'
        : 'border-slate-200 hover:bg-slate-50';

      cells.push(
        <button key={day} onClick={() => handleDayClick(cellDate)} className={`${baseClasses} ${stateClasses}`}>
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold">{day}</span>
            {totalCount > 0 && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-sky-600/10 text-sky-700'
                }`}
              >
                {totalCount} tarefa(s)
              </span>
            )}
          </div>
          <div className="mt-auto text-[10px] font-semibold space-y-1">
            {pendingCount > 0 && (
              <div className="flex items-center space-x-1 text-sky-800">
                <Circle className="w-3 h-3" />
                <span>{pendingCount} aberto(s)</span>
              </div>
            )}
            {doneCount > 0 && (
              <div className="flex items-center space-x-1 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                <span>{doneCount} concluído(s)</span>
              </div>
            )}
          </div>
        </button>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {day}
          </div>
        ))}
        {cells}
      </div>
    );
  };

  const hasTasksSnapshot = tasks.length > 0;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasTasksSnapshot}
      skeleton={<TodoCalendarSkeleton />}
      stageLabel="Carregando agenda de tarefas..."
      overlayLabel="Atualizando tarefas..."
      stageClassName="min-h-[560px]"
    >
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Agenda de Tarefas</h2>
          <p className="text-sm text-slate-500">
            {reschedulingTaskId
              ? 'Selecione um dia no calendário para reagendar a tarefa'
              : 'Clique em um dia para ver e gerenciar suas tarefas.'}
          </p>
          {reschedulingTaskId && (
            <Button
              onClick={() => setReschedulingTaskId(null)}
              variant="ghost"
              size="sm"
              className="mt-1 h-auto px-0 text-red-600 hover:bg-transparent hover:text-red-700"
            >
              Cancelar reagendamento
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-4 text-sm text-slate-500">
          <div className="flex items-center space-x-2">
            <Circle className="w-3 h-3 text-sky-500" />
            <span>Tarefas pendentes</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Tarefas concluídas</span>
          </div>
        </div>
      </div>

        <div className="mt-6 border rounded-xl border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
            <Button
              onClick={goToPreviousMonth}
              variant="icon"
              size="icon"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </Button>
          <h3 className="text-lg font-semibold text-slate-900 capitalize">
            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
            <Button
              onClick={goToNextMonth}
              variant="icon"
              size="icon"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </Button>
        </div>
        <div className="p-4">{renderCalendar()}</div>
      </div>

      {error && !isDayModalOpen && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {isDayModalOpen && (
        <ModalShell
          isOpen
          onClose={closeDayModal}
          title={`Tarefas de ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
          description={
            pendingTasks.length + completedTasks.length > 0
              ? `${pendingTasks.length + completedTasks.length} tarefa(s) ao todo · ${pendingTasks.length} pendente(s) · ${completedTasks.length} concluída(s)`
              : 'Nenhuma tarefa cadastrada para este dia.'
          }
          size="lg"
          panelClassName="max-w-3xl"
          bodyClassName="p-6"
        >
          {reschedulingTaskId && (
            <p className="mb-4 text-sm text-sky-600">Selecione um dia para reagendar a tarefa</p>
          )}

          <div className="mb-4 flex items-center justify-end">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              variant="primary"
              size="md"
              type="button"
            >
              <Plus className="w-4 h-4" />
              Adicionar tarefa
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">A fazer</h4>
                <span className="text-xs font-semibold text-sky-600">{pendingTasks.length}</span>
              </div>
              {pendingTasks.length > 0 ? (
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <article
                      key={task.id}
                      className={`border rounded-lg p-3 shadow-sm transition-all ${
                        reschedulingTaskId === task.id
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-sky-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{task.titulo}</p>
                          {task.descricao && <p className="text-xs text-slate-500 mt-1">{task.descricao}</p>}
                        </div>
                        <Button
                          onClick={() => handleDeleteTask(task.id)}
                          variant="icon"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          title="Remover tarefa"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                            onClick={() => updateTaskStatus(task.id, true)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                            onClick={() => setReschedulingTaskId(task.id)}
                            title="Reagendar tarefa"
                          >
                            <Calendar className="w-4 h-4 mr-1" /> Reagendar
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 py-8 text-center">Nenhuma tarefa pendente para este dia.</div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Feito</h4>
                <span className="text-xs font-semibold text-emerald-600">{completedTasks.length}</span>
              </div>
              {completedTasks.length > 0 ? (
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <article key={task.id} className="border border-emerald-200 bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 line-through">{task.titulo}</p>
                          {task.descricao && <p className="text-xs text-slate-500 mt-1">{task.descricao}</p>}
                        </div>
                        <Button
                          onClick={() => handleDeleteTask(task.id)}
                          variant="icon"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          title="Remover tarefa"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {task.concluido_em
                            ? `Concluída em ${new Date(task.concluido_em).toLocaleDateString('pt-BR')}`
                            : 'Concluída'}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => updateTaskStatus(task.id, false)}
                        >
                          <Circle className="w-4 h-4 mr-1" /> Reabrir
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 py-8 text-center">Nenhuma tarefa concluída neste dia.</div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 text-sm text-red-700 mt-4">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </ModalShell>
      )}

      {isDayModalOpen && isAddModalOpen && (
        <ModalShell
          isOpen
          onClose={closeAddModal}
          title="Nova tarefa"
          description={selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          size="sm"
          panelClassName="max-w-md"
        >
              <form onSubmit={handleAddTask} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="task-title" className="text-sm font-medium text-slate-700">
                    Tarefa
                  </label>
                  <Input
                    id="task-title"
                    type="text"
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="Digite o título da tarefa"
                    required
                    disabled={savingTask}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="task-description" className="text-sm font-medium text-slate-700">
                    Descrição (opcional)
                  </label>
                  <Textarea
                    id="task-description"
                    value={newTaskDescription}
                    onChange={(event) => setNewTaskDescription(event.target.value)}
                    placeholder="Adicione detalhes da tarefa"
                    className="min-h-[96px]"
                    disabled={savingTask}
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    onClick={closeAddModal}
                    variant="secondary"
                    size="md"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={savingTask}
                    loading={savingTask}
                  >
                    {!savingTask && <Plus className="w-4 h-4" />}
                    Adicionar
                  </Button>
                </div>
              </form>
        </ModalShell>
      )}
    </section>
    </PanelAdaptiveLoadingFrame>
  );
}
