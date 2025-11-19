import { supabase } from './supabase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

class PushSubscriptionService {
  private cachedPermission: NotificationPermission | 'unsupported' | null = null;

  private isSubscribing = false;

  async ensureSubscription(): Promise<PushSubscription | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      this.cachedPermission = 'unsupported';
      return null;
    }

    if (this.isSubscribing) {
      return null;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
    if (!publicKey) {
      console.warn('VITE_WEB_PUSH_PUBLIC_KEY não configurada.');
      return null;
    }

    try {
      this.isSubscribing = true;
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        await this.syncSubscription(existingSubscription);
        return existingSubscription;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await this.syncSubscription(subscription);
      return subscription;
    } catch (error) {
      console.error('Não foi possível registrar o push:', error);
      return null;
    } finally {
      this.isSubscribing = false;
    }
  }

  private async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (this.cachedPermission) {
      return this.cachedPermission;
    }

    if (typeof Notification === 'undefined' || !Notification.requestPermission) {
      this.cachedPermission = 'unsupported';
      return 'unsupported';
    }

    if (Notification.permission === 'default') {
      this.cachedPermission = await Notification.requestPermission();
    } else {
      this.cachedPermission = Notification.permission;
    }

    return this.cachedPermission;
  }

  private async syncSubscription(subscription: PushSubscription) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('É necessário estar autenticado para registrar notificações push.');
    }

    const { error } = await supabase.functions.invoke('push-notifications', {
      body: {
        action: 'subscribe',
        subscription,
      },
    });

    if (error) {
      throw error;
    }
  }
}

export const pushSubscriptionService = new PushSubscriptionService();
