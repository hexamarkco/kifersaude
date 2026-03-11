import { useCallback, useEffect, useMemo, useState } from 'react';

const PRIORITIZE_UNREAD_STORAGE_KEY = 'whatsapp.inbox.prioritize-unread';
const DESKTOP_NOTIFICATIONS_STORAGE_KEY = 'whatsapp.inbox.desktop-notifications';

const readStoredBoolean = (storageKey: string, fallbackValue: boolean) => {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (rawValue === null) {
    return fallbackValue;
  }

  return rawValue === 'true';
};

export function useWhatsAppInboxPreferences() {
  const [prioritizeUnread, setPrioritizeUnreadState] = useState(() =>
    readStoredBoolean(PRIORITIZE_UNREAD_STORAGE_KEY, false),
  );
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabledState] = useState(() =>
    readStoredBoolean(DESKTOP_NOTIFICATIONS_STORAGE_KEY, true),
  );
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PRIORITIZE_UNREAD_STORAGE_KEY, String(prioritizeUnread));
  }, [prioritizeUnread]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(DESKTOP_NOTIFICATIONS_STORAGE_KEY, String(desktopNotificationsEnabled));
  }, [desktopNotificationsEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    const syncNotificationPermission = () => {
      setNotificationPermission(Notification.permission);
    };

    syncNotificationPermission();
    window.addEventListener('focus', syncNotificationPermission);
    document.addEventListener('visibilitychange', syncNotificationPermission);

    return () => {
      window.removeEventListener('focus', syncNotificationPermission);
      document.removeEventListener('visibilitychange', syncNotificationPermission);
    };
  }, []);

  const setPrioritizeUnread = useCallback((nextValue: boolean) => {
    setPrioritizeUnreadState(nextValue);
  }, []);

  const setDesktopNotificationsEnabled = useCallback((nextValue: boolean) => {
    setDesktopNotificationsEnabledState(nextValue);
  }, []);

  const toggleDesktopNotifications = useCallback(async () => {
    if (notificationPermission === 'unsupported' || typeof window === 'undefined') return;

    if (notificationPermission === 'denied') {
      window.alert('Permissao de notificacao negada no navegador. Libere para receber alertas desktop.');
      return;
    }

    if (notificationPermission === 'default') {
      const nextPermission = await Notification.requestPermission();
      setNotificationPermission(nextPermission);
      if (nextPermission !== 'granted') return;
      setDesktopNotificationsEnabledState(true);
      return;
    }

    setDesktopNotificationsEnabledState((previousValue) => !previousValue);
  }, [notificationPermission]);

  const notificationsActive = notificationPermission === 'granted' && desktopNotificationsEnabled;
  const notificationsLabel = useMemo(() => {
    if (notificationPermission === 'unsupported') {
      return 'Sem suporte';
    }

    if (notificationPermission === 'denied') {
      return 'Permissao bloqueada';
    }

    return notificationsActive ? 'Notificacoes ligadas' : 'Notificacoes desligadas';
  }, [notificationPermission, notificationsActive]);

  return {
    prioritizeUnread,
    setPrioritizeUnread,
    desktopNotificationsEnabled,
    setDesktopNotificationsEnabled,
    notificationPermission,
    notificationsActive,
    notificationsLabel,
    toggleDesktopNotifications,
  };
}
