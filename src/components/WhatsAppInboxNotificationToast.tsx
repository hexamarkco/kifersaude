import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

import { Toast } from '../design-system';
import type { BrowserNotificationPermission } from '../lib/browserNotificationService';
import type { InboxMessageNotification } from '../lib/notificationService';

type WhatsAppInboxNotificationToastProps = {
  notification: InboxMessageNotification;
  browserNotificationPermission?: BrowserNotificationPermission;
  onClose: () => void;
  onViewChat: () => void;
  onEnableBrowserNotifications?: () => void;
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
  browserNotificationPermission,
  onClose,
  onViewChat,
  onEnableBrowserNotifications,
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

  const canRequestBrowserNotifications =
    browserNotificationPermission === 'default' && Boolean(onEnableBrowserNotifications);

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
      <Toast
        className="w-[min(24rem,calc(100vw-2rem))]"
        title="Nova mensagem no WhatsApp"
        variant="warning"
        icon={MessageCircle}
        onDismiss={handleClose}
        actions={[
          { label: 'Abrir conversa', onClick: handleViewChat, fullWidth: true },
          ...(canRequestBrowserNotifications
            ? [
                {
                  label: 'Ativar notificacoes do navegador',
                  onClick: onEnableBrowserNotifications!,
                  variant: 'secondary' as const,
                  size: 'sm' as const,
                  fullWidth: true,
                },
              ]
            : []),
        ]}
      >
        <div className="mt-3 space-y-3">
          <div>
            <p className="truncate text-base font-bold text-[var(--text-primary)]">{notification.displayName}</p>
            <p className="text-xs text-[var(--text-muted)]">{notification.phoneNumber}</p>
          </div>

          <p className="text-sm leading-5 text-[var(--text-secondary)]">
            {truncatePreview(notification.messagePreview)}
          </p>
        </div>
      </Toast>
    </div>
  );
}
