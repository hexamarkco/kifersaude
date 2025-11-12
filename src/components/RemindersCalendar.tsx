import { useState } from 'react';
import { Reminder } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X, Bell, Clock, AlertCircle } from 'lucide-react';
import { formatDateTimeFullBR, getDateKey, SAO_PAULO_TIMEZONE } from '../lib/dateUtils';

type RemindersCalendarProps = {
  reminders: Reminder[];
  onClose: () => void;
  onReminderClick?: (reminder: Reminder) => void;
};

export default function RemindersCalendar({ reminders, onClose, onReminderClick }: RemindersCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const handleDateClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
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
          className={`aspect-square p-2 rounded-lg border transition-all relative ${
            isSelected
              ? 'bg-teal-600 text-white border-teal-600'
              : isToday
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : dayReminders.length > 0
              ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
              : 'border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-sm font-medium">{day}</div>
          {dayReminders.length > 0 && (
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex space-x-0.5">
              {dayReminders.slice(0, 3).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-teal-600'
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
          <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Calendário de Lembretes</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={previousMonth}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <h3 className="text-lg font-semibold text-slate-900 capitalize">
                    {getMonthYear()}
                  </h3>
                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                {renderCalendar()}
              </div>
            </div>

            <div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
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
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {dayReminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          onClick={() => onReminderClick?.(reminder)}
                          className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
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
                          <div className="flex items-center space-x-2 mt-2">
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
