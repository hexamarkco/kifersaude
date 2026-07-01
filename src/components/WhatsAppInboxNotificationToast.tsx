import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

import Button from './ui/Button';
import type { InboxMessageNotification } from '../lib/notificationService';

type WhatsAppInboxNotificationToastProps = {
  notification: InboxMessageNotification;
  onClose: () => void;
  onViewChat: () => void;
};

const truncatePreview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117).trimEnd()}...`;
};

export default function WhatsAppInboxNotificationToast({
  notification,
  onClose,
  onViewChat,
}: WhatsAppInboxNotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isDarkThemeActive =
    typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(autoCloseTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleViewChat = () => {
    handleClose();
    onViewChat();
  };

  return (
    <div
      className={`painel-theme kifer-ds fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isDarkThemeActive ? 'theme-dark' : 'theme-light'
      } ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-amber-300/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-3">
          <div className="flex items-center space-x-2 text-white">
            <MessageCircle className="h-5 w-5 animate-bounce" />
            <h3 className="text-base font-bold">Nova mensagem no WhatsApp</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-white transition-colors hover:bg-white/20"
            aria-label="Fechar notificacao do WhatsApp"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <p className="truncate text-base font-bold text-slate-900">{notification.displayName}</p>
            <p className="text-xs text-slate-500">{notification.phoneNumber}</p>
          </div>

          <p className="text-sm leading-5 text-slate-700">{truncatePreview(notification.messagePreview)}</p>

          <Button onClick={handleViewChat} fullWidth>
            Abrir conversa
          </Button>
        </div>
      </div>
    </div>
  );
}
