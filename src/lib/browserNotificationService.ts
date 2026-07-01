export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

type ShowBrowserNotificationOptions = {
  title: string;
  body: string;
  icon?: string;
  onClick?: () => void;
};

class BrowserNotificationService {
  isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermission(): BrowserNotificationPermission {
    if (!this.isSupported()) {
      return 'unsupported';
    }

    return window.Notification.permission;
  }

  async requestPermission(): Promise<BrowserNotificationPermission> {
    if (!this.isSupported()) {
      return 'unsupported';
    }

    return window.Notification.requestPermission();
  }

  show({ title, body, icon = '/image.png', onClick }: ShowBrowserNotificationOptions) {
    if (this.getPermission() !== 'granted') {
      return null;
    }

    try {
      const notification = new window.Notification(title, {
        body,
        icon,
      });

      notification.onclick = () => {
        window.focus();
        onClick?.();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.warn('[Notifications] nao foi possivel exibir notificacao nativa do navegador.', error);
      return null;
    }
  }
}

export const browserNotificationService = new BrowserNotificationService();
