import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Reminder } from '../lib/supabase';
import { formatDateTimeFullBR } from '../lib/dateUtils';

type NotificationToastProps = {
  reminder: Reminder;
  onClose: () => void;
  onViewReminders: () => void;
};

export default function NotificationToast({ reminder, onClose, onViewReminders }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    const timer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleViewReminders = () => {
    handleClose();
    onViewReminders();
  };

  return (
    <div
      className={`fixed top-20 right-4 z-50 w-96 bg-white rounded-xl shadow-2xl border-2 border-teal-500 overflow-hidden transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <Bell className="w-5 h-5 animate-bounce" />
            <span className="font-semibold">Lembrete!</span>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-slate-900 mb-2">{reminder.titulo}</h3>
        {reminder.descricao && (
          <p className="text-sm text-slate-600 mb-3">{reminder.descricao}</p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {formatDateTimeFullBR(reminder.data_lembrete)}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            reminder.prioridade === 'alta'
              ? 'bg-red-100 text-red-700'
              : reminder.prioridade === 'normal'
              ? 'bg-slate-100 text-slate-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {reminder.prioridade}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={handleViewReminders}
          className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors font-medium"
        >
          Ver Lembretes
        </button>
      </div>
    </div>
  );
}
