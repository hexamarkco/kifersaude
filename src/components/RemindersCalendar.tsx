import { useState } from 'react';
import { Reminder } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X, Bell, Clock, AlertCircle, Calendar } from 'lucide-react';
import { formatDateTimeFullBR, getDateKey, SAO_PAULO_TIMEZONE } from '../lib/dateUtils';

type RemindersCalendarProps = {
  reminders: Reminder[];
  onClose: () => void;
  onReminderClick?: (reminder: Reminder) => void;
  onRescheduleReminder?: (reminderId: string, newDate: Date) => Promise<void>;
};

export default function RemindersCalendar({ reminders, onClose, onReminderClick, onRescheduleReminder }: RemindersCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reschedulingReminder, setReschedulingReminder] = useState<string | null>(null);

  const getMonthYear = () => {
    return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const getRemindersForDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = getDateKey(date, SAO_PAULO_TIMEZONE);

    return reminders.filter(reminder => getDateKey(reminder.data_lembrete, SAO_PAULO_TIMEZONE) === dateKey);
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

  const handleRescheduleClick = (reminderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReschedulingReminder(reminderId);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getDayReminders = () => {
    if (!selectedDate) return [];

    const dateKey = getDateKey(selectedDate, SAO_PAULO_TIMEZONE);
    return reminders
      .filter(reminder => getDateKey(reminder.data_lembrete, SAO_PAULO_TIMEZONE) === dateKey)
      .sort((a, b) => new Date(a.data_lembrete).getTime() - new Date(b.data_lembrete).getTime());
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
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
          onClick={() => handleDateClick(day)}
          className={`calendar-day relative aspect-square rounded-xl border p-2 transition-all ${
            isSelected
              ? 'calendar-day-selected'
              : isToday
              ? 'calendar-day-today'
              : dayReminders.length > 0
              ? 'calendar-day-has-events'
              : 'calendar-day-default'
          }`}
        >
          <div className="calendar-day-number text-sm font-semibold">{day}</div>
          {dayReminders.length > 0 && (
            <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 space-x-0.5">
              {dayReminders.slice(0, 3).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-teal-500'
                  }`}
                />
              ))}
            </div>
          )}
        </button>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => (
          <div key={day} className="calendar-weekday py-2 text-center text-sm font-semibold text-slate-600">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const getPriorityColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      'baixa': 'bg-blue-100 text-blue-700',
      'normal': 'bg-slate-100 text-slate-700',
      'alta': 'bg-red-100 text-red-700',
    };
    return colors[prioridade] || 'bg-slate-100 text-slate-700';
  };

  const dayReminders = getDayReminders();

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="modal-panel reminders-calendar-modal flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Calendário de Lembretes</h2>
            {reschedulingReminder && (
              <p className="text-sm text-teal-600 mt-1">
                Selecione um dia para reagendar a tarefa
              </p>
            )}
          </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            >
              <X className="w-6 h-6 text-slate-600" />
            </button>
        </div>

        <div className="modal-panel-content flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={previousMonth}
                    className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <h3 className="text-lg font-semibold text-slate-900 capitalize">
                    {getMonthYear()}
                  </h3>
                  <button
                    onClick={nextMonth}
                    className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                {renderCalendar()}
              </div>
            </div>

            <div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  {selectedDate ? (
                    <>
                      Lembretes de {selectedDate.toLocaleDateString('pt-BR')}
                      <span className="ml-2 text-sm font-normal text-slate-600">
                        ({dayReminders.length})
                      </span>
                    </>
                  ) : (
                    'Selecione um dia'
                  )}
                </h3>

                {selectedDate ? (
                  dayReminders.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                      {dayReminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          className={`p-4 border rounded-lg transition-all ${
                            reschedulingReminder === reminder.id
                              ? 'border-teal-500 bg-teal-50'
                              : 'border-slate-200 hover:shadow-md'
                          }`}
                        >
                          <div
                            onClick={() => onReminderClick?.(reminder)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="font-semibold text-slate-900">{reminder.titulo}</h4>
                                  {!reminder.lido && (
                                    <Bell className="w-4 h-4 text-orange-500" />
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-slate-600">
                                  <Clock className="w-4 h-4" />
                                  <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(reminder.prioridade)}`}>
                                {reminder.prioridade}
                              </span>
                            </div>
                          {reminder.descricao && (
                            <p className="text-sm text-slate-600 mt-2">{reminder.descricao}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                                {reminder.tipo}
                              </span>
                              {reminder.tags && reminder.tags.length > 0 && (
                                <div className="flex space-x-1">
                                  {reminder.tags.slice(0, 2).map((tag, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {onRescheduleReminder && !reminder.lido && (
                              <button
                                onClick={(e) => handleRescheduleClick(reminder.id, e)}
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                title="Reagendar tarefa"
                              >
                                <Calendar className="w-3 h-3" />
                                <span>Reagendar</span>
                              </button>
                            )}
                          </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600">Nenhum lembrete neste dia</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600">Clique em um dia do calendário para ver os lembretes</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
