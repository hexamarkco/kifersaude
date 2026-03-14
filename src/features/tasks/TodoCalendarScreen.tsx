import { useEffect, useMemo, useState } from "react";
import { supabase, Reminder } from "../../lib/supabase";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Circle,
  CheckCircle2,
  Plus,
  Trash2,
  Clock3,
} from "lucide-react";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ModalShell from "../../components/ui/ModalShell";
import {
  PANEL_INSET_STYLE,
  PANEL_MUTED_INSET_STYLE,
  PANEL_PILL_STYLE,
  PANEL_SECTION_STYLE,
  getPanelToneStyle,
} from "../../components/ui/panelStyles";
import Textarea from "../../components/ui/Textarea";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { TodoCalendarSkeleton } from "../../components/ui/panelSkeletons";
import {
  getTaskDateKey as getDateKey,
  isTaskSameDay as isSameDay,
  isTaskSameMonth as isSameMonth,
  parseTaskDate as toDate,
} from "./shared/todoCalendarUtils";

export default function TodoCalendarScreen() {
  const [tasks, setTasks] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(
    null,
  );
  const loadingUi = useAdaptiveLoading(loading);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("reminders")
        .select("*")
        .eq("tipo", "Tarefa")
        .order("data_lembrete", { ascending: true });

      if (fetchError) throw fetchError;
      setTasks(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Erro ao carregar tarefas:", err);
      setError("Não foi possível carregar suas tarefas. Tente novamente.");
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
      const { error: insertError } = await supabase.from("reminders").insert([
        {
          tipo: "Tarefa",
          titulo: newTaskTitle.trim(),
          descricao: newTaskDescription.trim() || null,
          data_lembrete: dueDate.toISOString(),
          lido: false,
          prioridade: "normal",
        },
      ]);

      if (insertError) throw insertError;

      setNewTaskTitle("");
      setNewTaskDescription("");
      setIsAddModalOpen(false);
      await loadTasks();
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
      setError("Não foi possível criar a tarefa.");
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
        .from("reminders")
        .update({
          lido: done,
          concluido_em: done ? new Date().toISOString() : null,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;
      await loadTasks();
    } catch (err) {
      console.error("Erro ao atualizar tarefa:", err);
      setError("Não foi possível atualizar a tarefa.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("reminders")
        .delete()
        .eq("id", taskId);

      if (deleteError) throw deleteError;
      await loadTasks();
    } catch (err) {
      console.error("Erro ao remover tarefa:", err);
      setError("Não foi possível remover a tarefa.");
    }
  };

  const handleRescheduleTask = async (taskId: string, newDate: Date) => {
    try {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;

      const taskDateTime = toDate(task.data_lembrete);
      const newDateTime = new Date(newDate);

      if (taskDateTime) {
        newDateTime.setHours(
          taskDateTime.getHours(),
          taskDateTime.getMinutes(),
          0,
          0,
        );
      } else {
        newDateTime.setHours(12, 0, 0, 0);
      }

      const { error: updateError } = await supabase
        .from("reminders")
        .update({ data_lembrete: newDateTime.toISOString() })
        .eq("id", taskId);

      if (updateError) throw updateError;

      setReschedulingTaskId(null);
      await loadTasks();
    } catch (err) {
      console.error("Erro ao reagendar tarefa:", err);
      setError("Não foi possível reagendar a tarefa.");
    }
  };

  const goToPreviousMonth = () => {
    const previous = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1,
    );
    setCurrentMonth(previous);
  };

  const goToNextMonth = () => {
    const next = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1,
    );
    setCurrentMonth(next);
  };

  const getDaysInMonth = () =>
    new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
    ).getDate();

  const getFirstWeekday = () =>
    new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

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
        items.sort(
          (a, b) =>
            new Date(a.data_lembrete).getTime() -
            new Date(b.data_lembrete).getTime(),
        ),
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
      .sort(
        (a, b) =>
          new Date(a.data_lembrete).getTime() -
          new Date(b.data_lembrete).getTime(),
      );
  }, [tasks, selectedDate]);

  const pendingTasks = selectedDateTasks.filter((task) => !task.lido);
  const completedTasks = selectedDateTasks.filter((task) => task.lido);
  const pendingTaskCount = tasks.filter((task) => !task.lido).length;
  const completedTaskCount = tasks.filter((task) => task.lido).length;
  const lastUpdatedLabel = lastUpdated
    ? `Atualizado em ${lastUpdated.toLocaleDateString("pt-BR")} às ${lastUpdated.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Aguardando atualização...";

  const getCalendarCellStyle = ({
    isSelected,
    isToday,
    hasTasks,
    isRescheduling,
  }: {
    isSelected: boolean;
    isToday: boolean;
    hasTasks: boolean;
    isRescheduling: boolean;
  }) => {
    const baseCellStyle = {
      ...PANEL_INSET_STYLE,
      color: "var(--panel-text,#1c1917)",
    };

    if (isSelected) {
      return {
        ...baseCellStyle,
        borderColor: "var(--panel-accent-strong,#b85c1f)",
        background: "var(--panel-accent-soft,#f6e4c7)",
        color: "var(--panel-accent-ink-strong,#4a2411)",
        boxShadow: "0 18px 34px -26px rgba(26,18,13,0.34)",
      };
    }

    if (isToday) {
      return {
        ...getPanelToneStyle("accent"),
        boxShadow: "0 14px 28px -24px rgba(26,18,13,0.18)",
      };
    }

    if (hasTasks) {
      return {
        ...baseCellStyle,
        borderColor: "var(--panel-accent-border,#d5a25c)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--panel-accent-soft,#f6e4c7) 52%, transparent) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)",
      };
    }

    if (isRescheduling) {
      return {
        ...baseCellStyle,
        borderColor: "var(--panel-accent-border,#d5a25c)",
      };
    }

    return baseCellStyle;
  };

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
    setNewTaskTitle("");
    setNewTaskDescription("");
    setReschedulingTaskId(null);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setNewTaskTitle("");
    setNewTaskDescription("");
  };

  const renderCalendar = () => {
    const cells = [];
    const firstWeekday = getFirstWeekday();
    const totalDays = getDaysInMonth();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day,
      );
      const dateKey = getDateKey(cellDate);
      const dayTasks = tasksByDay.get(dateKey) || [];
      const pendingCount = dayTasks.filter((task) => !task.lido).length;
      const doneCount = dayTasks.filter((task) => task.lido).length;
      const totalCount = dayTasks.length;
      const isToday = isSameDay(cellDate, new Date());
      const isSelected = isSameDay(cellDate, selectedDate);

      const baseClasses =
        "aspect-square rounded-[1.1rem] border p-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 flex flex-col justify-between";
      const stateStyle = getCalendarCellStyle({
        isSelected,
        isToday,
        hasTasks: dayTasks.length > 0,
        isRescheduling: Boolean(reschedulingTaskId),
      });

      cells.push(
        <button
          key={day}
          onClick={() => handleDayClick(cellDate)}
          className={baseClasses}
          style={{
            ...stateStyle,
            outlineColor: "var(--panel-focus,#c86f1d)",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold">{day}</span>
            {totalCount > 0 && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={
                  isSelected
                    ? getPanelToneStyle("neutral")
                    : getPanelToneStyle("accent")
                }
              >
                {totalCount} tarefa(s)
              </span>
            )}
          </div>
          <div className="mt-auto text-[10px] font-semibold space-y-1">
            {pendingCount > 0 && (
              <div
                className="flex items-center space-x-1"
                style={{ color: "var(--panel-accent-ink,#6f3f16)" }}
              >
                <Circle className="h-3 w-3" />
                <span>{pendingCount} aberto(s)</span>
              </div>
            )}
            {doneCount > 0 && (
              <div
                className="flex items-center space-x-1"
                style={{ color: "var(--panel-accent-green-text,#275c39)" }}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>{doneCount} concluído(s)</span>
              </div>
            )}
          </div>
        </button>,
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--panel-text-muted,#876f5c)" }}
          >
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
      <section
        className="panel-glass-panel space-y-6 rounded-[2rem] border p-6"
        style={PANEL_SECTION_STYLE}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.24em]"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                Rotina operacional
              </p>
              <h2
                className="mt-3 text-2xl font-bold sm:text-3xl"
                style={{ color: "var(--panel-text,#1c1917)" }}
              >
                Agenda de Tarefas
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                {reschedulingTaskId
                  ? "Selecione um dia no calendário para reagendar a tarefa."
                  : "Clique em um dia para abrir, reagendar e concluir tarefas com mais contexto."}
              </p>
              {reschedulingTaskId && (
                <Button
                  onClick={() => setReschedulingTaskId(null)}
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-0 hover:bg-transparent"
                  style={{ color: "var(--panel-accent-red-text,#8a3128)" }}
                >
                  Cancelar reagendamento
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {tasksByMonth.length}
                </span>
                <span>tarefas no mês</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {pendingTaskCount}
                </span>
                <span>pendentes</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {completedTaskCount}
                </span>
                <span>concluídas</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div
              className="flex h-11 items-center gap-2 rounded-xl border px-3 text-sm"
              style={{
                ...PANEL_PILL_STYLE,
                color: "var(--panel-text-soft,#5b4635)",
              }}
            >
              <Clock3
                className="h-4 w-4"
                style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
              />
              <span>{lastUpdatedLabel}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                style={getPanelToneStyle("accent")}
              >
                <Circle className="h-3 w-3" />
                <span>Tarefas pendentes</span>
              </div>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                style={getPanelToneStyle("success")}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Tarefas concluídas</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-[1.7rem] border"
          style={PANEL_INSET_STYLE}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={PANEL_MUTED_INSET_STYLE}
          >
            <Button
              onClick={goToPreviousMonth}
              variant="icon"
              size="icon"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h3
              className="text-lg font-semibold capitalize"
              style={{ color: "var(--panel-text,#1c1917)" }}
            >
              {currentMonth.toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <Button
              onClick={goToNextMonth}
              variant="icon"
              size="icon"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="p-4">{renderCalendar()}</div>
        </div>

        {error && !isDayModalOpen && (
          <div
            className="mt-4 flex items-center space-x-2 rounded-[1.1rem] border p-3 text-sm"
            style={getPanelToneStyle("danger")}
          >
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {isDayModalOpen && (
          <ModalShell
            isOpen
            onClose={closeDayModal}
            title={`Tarefas de ${selectedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`}
            description={
              pendingTasks.length + completedTasks.length > 0
                ? `${pendingTasks.length + completedTasks.length} tarefa(s) ao todo · ${pendingTasks.length} pendente(s) · ${completedTasks.length} concluída(s)`
                : "Nenhuma tarefa cadastrada para este dia."
            }
            size="lg"
            panelClassName="max-w-3xl"
            bodyClassName="p-6"
          >
            {reschedulingTaskId && (
              <p
                className="mb-4 text-sm"
                style={{ color: "var(--panel-accent-ink,#6f3f16)" }}
              >
                Selecione um dia para reagendar a tarefa
              </p>
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
              <div
                className="rounded-[1.3rem] border p-4"
                style={PANEL_INSET_STYLE}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: "var(--panel-text-soft,#5b4635)" }}
                  >
                    A fazer
                  </h4>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--panel-accent-ink,#6f3f16)" }}
                  >
                    {pendingTasks.length}
                  </span>
                </div>
                {pendingTasks.length > 0 ? (
                  <div className="space-y-3">
                    {pendingTasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-[1rem] border p-3 shadow-sm transition-all"
                        style={{
                          ...PANEL_INSET_STYLE,
                          ...(reschedulingTaskId === task.id
                            ? getPanelToneStyle("accent")
                            : null),
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className="text-sm font-semibold"
                              style={{ color: "var(--panel-text,#1c1917)" }}
                            >
                              {task.titulo}
                            </p>
                            {task.descricao && (
                              <p
                                className="mt-1 text-xs"
                                style={{ color: "var(--panel-text-muted,#876f5c)" }}
                              >
                                {task.descricao}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleDeleteTask(task.id)}
                            variant="icon"
                            size="icon"
                            className="h-7 w-7"
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
                              variant="soft"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => updateTaskStatus(task.id, true)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2"
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
                  <div
                    className="py-8 text-center text-sm"
                    style={{ color: "var(--panel-text-muted,#876f5c)" }}
                  >
                    Nenhuma tarefa pendente para este dia.
                  </div>
                )}
              </div>

              <div
                className="rounded-[1.3rem] border p-4"
                style={PANEL_INSET_STYLE}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: "var(--panel-text-soft,#5b4635)" }}
                  >
                    Feito
                  </h4>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--panel-accent-green-text,#275c39)" }}
                  >
                    {completedTasks.length}
                  </span>
                </div>
                {completedTasks.length > 0 ? (
                  <div className="space-y-3">
                    {completedTasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-[1rem] border p-3 shadow-sm"
                        style={{
                          ...PANEL_INSET_STYLE,
                          ...getPanelToneStyle("success"),
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className="text-sm font-semibold line-through"
                              style={{ color: "var(--panel-text,#1c1917)" }}
                            >
                              {task.titulo}
                            </p>
                            {task.descricao && (
                              <p
                                className="mt-1 text-xs"
                                style={{ color: "var(--panel-text-muted,#876f5c)" }}
                              >
                                {task.descricao}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleDeleteTask(task.id)}
                            variant="icon"
                            size="icon"
                            className="h-7 w-7"
                            title="Remover tarefa"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div
                          className="mt-3 flex items-center justify-between text-xs"
                          style={{ color: "var(--panel-text-muted,#876f5c)" }}
                        >
                          <span>
                            {task.concluido_em
                              ? `Concluída em ${new Date(task.concluido_em).toLocaleDateString("pt-BR")}`
                              : "Concluída"}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => updateTaskStatus(task.id, false)}
                          >
                            <Circle className="w-4 h-4 mr-1" /> Reabrir
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div
                    className="py-8 text-center text-sm"
                    style={{ color: "var(--panel-text-muted,#876f5c)" }}
                  >
                    Nenhuma tarefa concluída neste dia.
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div
                className="mt-4 flex items-center space-x-2 rounded-[1.1rem] border p-3 text-sm"
                style={getPanelToneStyle("danger")}
              >
                <AlertCircle className="h-4 w-4" />
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
            description={selectedDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            size="sm"
            panelClassName="max-w-md"
          >
            <form onSubmit={handleAddTask} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="task-title"
                  className="text-sm font-medium"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
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
                <label
                  htmlFor="task-description"
                  className="text-sm font-medium"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  Descrição (opcional)
                </label>
                <Textarea
                  id="task-description"
                  value={newTaskDescription}
                  onChange={(event) =>
                    setNewTaskDescription(event.target.value)
                  }
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
