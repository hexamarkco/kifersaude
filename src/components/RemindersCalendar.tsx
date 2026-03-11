import { useState } from 'react';
import { AlertCircle, Bell, Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import { cx } from '../lib/cx';
import { Reminder } from '../lib/supabase';
import { formatDateTimeFullBR, getDateKey, SAO_PAULO_TIMEZONE } from '../lib/dateUtils';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';

type RemindersCalendarProps = {
  reminders: Reminder[];
  onClose: () => void;
  onReminderClick?: (reminder: Reminder) => void;
  onRescheduleReminder?: (reminderId: string, newDate: Date) => Promise<void>;
};

const calendarPanelClass =
  'panel-glass-panel rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] p-4';
const calendarSectionTitleClass = 'text-lg font-semibold text-[var(--panel-text,#1c1917)]';
const calendarMutedClass = 'text-[var(--panel-text-muted,#876f5c)]';
const calendarBodyClass = 'text-[var(--panel-text-soft,#5b4635)]';
const calendarTypeBadgeClass =
  'inline-flex items-center rounded-full border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-muted,#f8f2e8)] px-2 py-1 text-xs text-[var(--panel-text-soft,#5b4635)]';
const reminderCardDefaultClass =
  'rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm';
const reminderCardActiveClass =
  'rounded-xl border border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] p-4 transition-all';

const getPriorityTone = (priority: string) => {
  const normalized = (priority || '').trim().toLowerCase();

  if (normalized === 'baixa') {
    return 'border border-[var(--panel-accent-blue-border,#a8c0d8)] bg-[color:var(--panel-accent-blue-bg,#edf3fb)] text-[var(--panel-accent-blue-text,#31577a)]';
  }

  if (normalized === 'alta') {
    return 'border border-[var(--panel-accent-red-border,#d79a8f)] bg-[color:var(--panel-accent-red-bg,#faecea)] text-[var(--panel-accent-red-text,#8a3128)]';
  }

  return 'border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-muted,#f8f2e8)] text-[var(--panel-text-soft,#5b4635)]';
};

export default function RemindersCalendar({
  reminders,
  onClose,
  onReminderClick,
  onRescheduleReminder,
}: RemindersCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reschedulingReminder, setReschedulingReminder] = useState<string | null>(null);

  const getMonthYear = () =>
    currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const getDaysInMonth = () =>
    new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  const getFirstDayOfMonth = () =>
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const getRemindersForDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = getDateKey(date, SAO_PAULO_TIMEZONE);

    return reminders.filter(
      (reminder) => getDateKey(reminder.data_lembrete, SAO_PAULO_TIMEZONE) === dateKey,
    );
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handleDateClick = async (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

    if (reschedulingReminder && onRescheduleReminder) {
      await onRescheduleReminder(reschedulingReminder, date);
      setReschedulingReminder(null);
      return;
    }

    setSelectedDate(date);
  };

  const handleRescheduleClick = (reminderId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setReschedulingReminder(reminderId);
  };

  const getDayReminders = () => {
    if (!selectedDate) return [];

    const dateKey = getDateKey(selectedDate, SAO_PAULO_TIMEZONE);

    return reminders
      .filter((reminder) => getDateKey(reminder.data_lembrete, SAO_PAULO_TIMEZONE) === dateKey)
      .sort(
        (left, right) =>
          new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime(),
      );
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

    for (let emptyIndex = 0; emptyIndex < firstDay; emptyIndex += 1) {
      days.push(<div key={`empty-${emptyIndex}`} className="aspect-square" />);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayReminders = getRemindersForDate(day);
      const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const todayKey = getDateKey(new Date(), SAO_PAULO_TIMEZONE);
      const cellKey = getDateKey(cellDate, SAO_PAULO_TIMEZONE);
      const selectedKey = selectedDate ? getDateKey(selectedDate, SAO_PAULO_TIMEZONE) : null;
      const isToday = cellKey === todayKey;
      const isSelected = selectedKey === cellKey;

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(day)}
          className={cx(
            'calendar-day relative aspect-square rounded-xl border p-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel-surface,#fffdfa)]',
            isSelected
              ? 'calendar-day-selected'
              : isToday
                ? 'calendar-day-today'
                : dayReminders.length > 0
                  ? 'calendar-day-has-events'
                  : 'calendar-day-default',
          )}
        >
          <div className="calendar-day-number text-sm font-semibold">{day}</div>
          {dayReminders.length > 0 && (
            <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 space-x-0.5">
              {dayReminders.slice(0, 3).map((_, index) => (
                <div
                  key={`marker-${day}-${index}`}
                  className={cx(
                    'h-1.5 w-1.5 rounded-full',
                    isSelected
                      ? 'bg-current'
                      : 'bg-[color:var(--panel-accent-strong,#b85c1f)]',
                  )}
                />
              ))}
            </div>
          )}
        </button>,
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="calendar-weekday py-2 text-center text-sm font-semibold"
          >
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const dayReminders = getDayReminders();

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title="Calendario de Lembretes"
      description={
        reschedulingReminder ? 'Selecione um dia para reagendar a tarefa.' : undefined
      }
      size="xl"
      panelClassName="reminders-calendar-modal max-w-4xl"
      bodyClassName="p-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={calendarPanelClass}>
          <div className="mb-4 flex items-center justify-between">
            <Button onClick={previousMonth} variant="icon" size="icon" className="h-9 w-9">
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <h3 className={cx(calendarSectionTitleClass, 'capitalize')}>{getMonthYear()}</h3>

            <Button onClick={nextMonth} variant="icon" size="icon" className="h-9 w-9">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {renderCalendar()}
        </div>

        <div
          className={cx(calendarPanelClass, 'flex flex-col')}
        >
          <h3 className={cx(calendarSectionTitleClass, 'mb-4')}>
            {selectedDate ? (
              <>
                Lembretes de {selectedDate.toLocaleDateString('pt-BR')}
                <span className={cx('ml-2 text-sm font-normal', calendarMutedClass)}>
                  ({dayReminders.length})
                </span>
              </>
            ) : (
              'Selecione um dia'
            )}
          </h3>

          {selectedDate ? (
            dayReminders.length > 0 ? (
              <div className="panel-dropdown-scrollbar flex-1 space-y-3 overflow-y-auto pr-2 lg:max-h-[calc(100dvh-17rem)]">
                {dayReminders.map((reminder) => {
                  const isRescheduling = reschedulingReminder === reminder.id;

                  return (
                    <div
                      key={reminder.id}
                      className={isRescheduling ? reminderCardActiveClass : reminderCardDefaultClass}
                    >
                      <div
                        onClick={() => onReminderClick?.(reminder)}
                        className="cursor-pointer"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h4 className="truncate font-semibold text-[var(--panel-text,#1c1917)]">
                                {reminder.titulo}
                              </h4>
                              {!reminder.lido && (
                                <Bell className="h-4 w-4 text-[var(--panel-accent-strong,#b85c1f)]" />
                              )}
                            </div>

                            <div className={cx('flex items-center gap-2 text-sm', calendarBodyClass)}>
                              <Clock className="h-4 w-4" />
                              <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                            </div>
                          </div>

                          <span className={cx('rounded-full px-2 py-1 text-xs font-medium', getPriorityTone(reminder.prioridade))}>
                            {reminder.prioridade}
                          </span>
                        </div>

                        {reminder.descricao && (
                          <p className={cx('mt-2 text-sm', calendarBodyClass)}>{reminder.descricao}</p>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={calendarTypeBadgeClass}>{reminder.tipo}</span>
                            {reminder.tags &&
                              reminder.tags.length > 0 &&
                              reminder.tags.slice(0, 2).map((tag, index) => (
                                <span key={`${tag}-${index}`} className="comm-badge comm-badge-brand text-[11px]">
                                  {tag}
                                </span>
                              ))}
                          </div>

                          {onRescheduleReminder && !reminder.lido && (
                            <Button
                              onClick={(event) => handleRescheduleClick(reminder.id, event)}
                              variant="soft"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              title="Reagendar tarefa"
                            >
                              <Calendar className="h-3 w-3" />
                              <span>Reagendar</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Bell className="mx-auto mb-3 h-12 w-12 text-[var(--panel-text-subtle,#ab927b)]" />
                <p className={calendarBodyClass}>Nenhum lembrete neste dia.</p>
              </div>
            )
          ) : (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-[var(--panel-text-subtle,#ab927b)]" />
              <p className={calendarBodyClass}>
                Clique em um dia do calendario para ver os lembretes.
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
