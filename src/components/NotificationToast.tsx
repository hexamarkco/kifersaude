import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Reminder } from '../lib/supabase';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { Toast } from '../design-system';

type NotificationToastProps = {
  reminder: Reminder;
  onClose: () => void;
  onViewReminders: () => void;
};

export default function NotificationToast({ reminder, onClose, onViewReminders }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isDarkThemeActive =
    typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    const timer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      className={`painel-theme kifer-ds fixed right-4 top-20 z-50 transition-all duration-300 ${
        isDarkThemeActive ? 'theme-dark' : 'theme-light'
      } ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <Toast
        className="w-[min(24rem,calc(100vw-2rem))]"
        title="Lembrete!"
        variant="warning"
        icon={Bell}
        onDismiss={handleClose}
        actions={[{ label: 'Ver Lembretes', onClick: handleViewReminders, fullWidth: true }]}
      >
        <div className="mt-3">
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{reminder.titulo}</h3>
          {reminder.descricao && (
            <p className="mb-3 text-sm text-[var(--text-secondary)]">{reminder.descricao}</p>
          )}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--text-muted)]">{formatDateTimeFullBR(reminder.data_lembrete)}</span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                reminder.prioridade === 'alta'
                  ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                  : reminder.prioridade === 'normal'
                    ? 'bg-[var(--bg-inset)] text-[var(--text-secondary)]'
                    : 'bg-[var(--info-soft)] text-[var(--info-text)]'
              }`}
            >
              {reminder.prioridade}
            </span>
          </div>
        </div>
      </Toast>
    </div>
  );
}
