import { useEffect, useMemo, useState } from 'react';
import { supabase, Reminder } from '../../lib/supabase';
import {
  AlertCircle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

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
  const [activeDropZone, setActiveDropZone] = useState<'todo' | 'done' | null>(null);

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
      setError('Não foi possível mover a tarefa.');
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
      const isToday = isSameDay(cellDate, new Date());
      const isSelected = isSameDay(cellDate, selectedDate);

      cells.push(
        <button
          key={day}
          onClick={() => setSelectedDate(cellDate)}
          className={`aspect-square p-2 rounded-lg border transition-all text-left flex flex-col justify-between ${
            isSelected
              ? 'bg-sky-600 text-white border-sky-600 shadow-lg'
              : isToday
              ? 'bg-sky-50 text-sky-700 border-sky-300'
              : dayTasks.length > 0
              ? 'border-sky-200 bg-sky-50/70 hover:bg-sky-100'
              : 'border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-sm font-semibold">{day}</span>
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

  const handleDragOver = (zone: 'todo' | 'done') => (event: React.DragEvent) => {
    event.preventDefault();
    setActiveDropZone(zone);
  };

  const handleDrop = (zone: 'todo' | 'done') => async (event: React.DragEvent) => {
    event.preventDefault();
    setActiveDropZone(null);
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    await updateTaskStatus(taskId, zone === 'done');
  };

  const handleDragLeave = () => {
    setActiveDropZone(null);
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <CalendarCheck className="w-6 h-6 text-sky-600" />
            <span>Agenda diária de tarefas</span>
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Organize suas atividades por dia, marque como concluídas e arraste os cards entre colunas.
          </p>
        </div>
        <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="flex-1 flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Nova tarefa para o dia selecionado"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              required
              disabled={savingTask}
            />
            <input
              type="text"
              value={newTaskDescription}
              onChange={(event) => setNewTaskDescription(event.target.value)}
              placeholder="Descrição (opcional)"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              disabled={savingTask}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 text-white rounded-lg shadow-sm hover:bg-sky-700 transition-colors disabled:opacity-60"
            disabled={savingTask}
          >
            {savingTask ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </>
            )}
          </button>
        </form>
      </div>

      <div className="mt-6 border rounded-xl border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
          <button onClick={goToPreviousMonth} className="p-2 rounded-lg hover:bg-white transition-colors" aria-label="Mês anterior">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h3 className="text-lg font-semibold text-slate-900 capitalize">
            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={goToNextMonth} className="p-2 rounded-lg hover:bg-white transition-colors" aria-label="Próximo mês">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Carregando tarefas...
            </div>
          ) : (
            renderCalendar()
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          onDragOver={handleDragOver('todo')}
          onDrop={handleDrop('todo')}
          onDragLeave={handleDragLeave}
          className={`border rounded-xl p-4 transition-colors ${
            activeDropZone === 'todo' ? 'border-sky-400 bg-sky-50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">A fazer</h4>
            <span className="text-xs font-semibold text-sky-600">{pendingTasks.length}</span>
          </div>
          {pendingTasks.length > 0 ? (
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', task.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={handleDragLeave}
                  className="border border-sky-200 bg-white rounded-lg p-3 shadow-sm cursor-grab hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{task.titulo}</p>
                      {task.descricao && <p className="text-xs text-slate-500 mt-1">{task.descricao}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Remover tarefa"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>Arraste para "Feito" para concluir</span>
                    <button
                      type="button"
                      className="inline-flex items-center text-sky-600 hover:text-sky-700"
                      onClick={() => updateTaskStatus(task.id, true)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-8 text-center">
              Nenhuma tarefa pendente para {selectedDate.toLocaleDateString('pt-BR')}.
            </div>
          )}
        </div>

        <div
          onDragOver={handleDragOver('done')}
          onDrop={handleDrop('done')}
          onDragLeave={handleDragLeave}
          className={`border rounded-xl p-4 transition-colors ${
            activeDropZone === 'done' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Feito</h4>
            <span className="text-xs font-semibold text-emerald-600">{completedTasks.length}</span>
          </div>
          {completedTasks.length > 0 ? (
            <div className="space-y-3">
              {completedTasks.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', task.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={handleDragLeave}
                  className="border border-emerald-200 bg-white rounded-lg p-3 shadow-sm cursor-grab hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 line-through">{task.titulo}</p>
                      {task.descricao && <p className="text-xs text-slate-500 mt-1">{task.descricao}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Remover tarefa"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {task.concluido_em
                        ? `Concluída em ${new Date(task.concluido_em).toLocaleDateString('pt-BR')}`
                        : 'Concluída'}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center text-emerald-600 hover:text-emerald-700"
                      onClick={() => updateTaskStatus(task.id, false)}
                    >
                      <Circle className="w-4 h-4 mr-1" /> Reabrir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-8 text-center">
              Arraste uma tarefa para cá para marcá-la como concluída.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
