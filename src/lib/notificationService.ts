import { supabase, Reminder, Lead, type CommWhatsAppChat } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isReminderDue } from './dateUtils';
import { commWhatsAppService } from './commWhatsAppService';

export type NotificationCallback = (reminder: Reminder) => void;
export type LeadNotificationCallback = (lead: Lead) => void;
export type UnreadCountCallback = (count: number) => void;
export type InboxUnreadCountCallback = (count: number) => void;
export type InboxMessageNotification = {
  chatId: string;
  displayName: string;
  phoneNumber: string;
  messagePreview: string;
  messageAt: string | null;
};
export type InboxMessageNotificationCallback = (notification: InboxMessageNotification) => void;

const RECENT_INBOX_MESSAGE_THRESHOLD_MS = 5 * 60 * 1000;

class NotificationService {
  private callbacks: NotificationCallback[] = [];
  private leadCallbacks: LeadNotificationCallback[] = [];
  private unreadCountCallbacks: UnreadCountCallback[] = [];
  private inboxUnreadCountCallbacks: InboxUnreadCountCallback[] = [];
  private inboxMessageCallbacks: InboxMessageNotificationCallback[] = [];
  private notifiedReminders: Set<string> = new Set();
  private notifiedLeads: Set<string> = new Set();
  private notifiedInboxMessages: Set<string> = new Set();
  private intervalId: number | null = null;
  private isChecking = false;
  private leadChannelSubscription: RealtimeChannel | null = null;
  private inboxChannelSubscription: RealtimeChannel | null = null;
  private lastUnreadCount = 0;
  private lastInboxUnreadCount = 0;

  start(intervalMs: number = 30000) {
    if (this.intervalId !== null) {
      return;
    }

    this.check();
    this.intervalId = window.setInterval(() => this.check(), intervalMs);
    this.startLeadNotifications();
    this.startInboxMessageNotifications();
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.stopLeadNotifications();
    this.stopInboxMessageNotifications();
  }

  subscribe(callback: NotificationCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToLeads(callback: LeadNotificationCallback) {
    this.leadCallbacks.push(callback);
    return () => {
      this.leadCallbacks = this.leadCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToUnreadCount(callback: UnreadCountCallback) {
    this.unreadCountCallbacks.push(callback);
    callback(this.lastUnreadCount);
    return () => {
      this.unreadCountCallbacks = this.unreadCountCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToInboxUnreadCount(callback: InboxUnreadCountCallback) {
    this.inboxUnreadCountCallbacks.push(callback);
    callback(this.lastInboxUnreadCount);
    return () => {
      this.inboxUnreadCountCallbacks = this.inboxUnreadCountCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToInboxMessages(callback: InboxMessageNotificationCallback) {
    this.inboxMessageCallbacks.push(callback);
    return () => {
      this.inboxMessageCallbacks = this.inboxMessageCallbacks.filter(cb => cb !== callback);
    };
  }

  private startLeadNotifications() {
    if (this.leadChannelSubscription !== null) {
      return;
    }

    this.leadChannelSubscription = supabase
      .channel('new-leads-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          const newLead = payload.new as Lead;
          if (!this.notifiedLeads.has(newLead.id)) {
            this.notifiedLeads.add(newLead.id);
            this.leadCallbacks.forEach(callback => callback(newLead));
          }
        }
      )
      .subscribe();
  }

  private stopLeadNotifications() {
    if (this.leadChannelSubscription !== null) {
      supabase.removeChannel(this.leadChannelSubscription);
      this.leadChannelSubscription = null;
    }
  }

  private startInboxMessageNotifications() {
    if (this.inboxChannelSubscription !== null) {
      return;
    }

    this.inboxChannelSubscription = supabase
      .channel('comm-whatsapp-inbox-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comm_whatsapp_chats',
        },
        (payload) => {
          const chat = payload.new as CommWhatsAppChat | null;
          const previousChat = payload.old as Partial<CommWhatsAppChat> | null;

          this.handleInboxChatChange(chat, previousChat, payload.eventType);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Notifications] realtime de mensagens do inbox indisponivel; polling do contador permanece ativo.');
        }
      });
  }

  private stopInboxMessageNotifications() {
    if (this.inboxChannelSubscription !== null) {
      supabase.removeChannel(this.inboxChannelSubscription);
      this.inboxChannelSubscription = null;
    }
  }

  private handleInboxChatChange(
    chat: CommWhatsAppChat | null,
    previousChat: Partial<CommWhatsAppChat> | null,
    eventType: string,
  ) {
    if (!chat || eventType === 'DELETE') {
      return;
    }

    if (chat.deleted_at || chat.is_archived || chat.is_muted || chat.last_message_direction !== 'inbound') {
      return;
    }

    if (chat.unread_count <= 0 && !chat.manual_unread) {
      return;
    }

    const lastMessageTime = chat.last_message_at ? new Date(chat.last_message_at).getTime() : 0;
    const isRecentMessage = Number.isFinite(lastMessageTime) && Date.now() - lastMessageTime <= RECENT_INBOX_MESSAGE_THRESHOLD_MS;

    if (!isRecentMessage) {
      return;
    }

    const previousUnreadCount = typeof previousChat?.unread_count === 'number' ? previousChat.unread_count : 0;
    const unreadCountIncreased = chat.unread_count > previousUnreadCount;
    const lastMessageChanged = chat.last_message_at !== previousChat?.last_message_at;

    if (eventType === 'UPDATE' && !unreadCountIncreased && !lastMessageChanged) {
      return;
    }

    const messageKey = `${chat.id}:${chat.last_message_at ?? ''}:${chat.last_message_text ?? ''}`;
    if (this.notifiedInboxMessages.has(messageKey)) {
      return;
    }

    this.notifiedInboxMessages.add(messageKey);
    if (this.notifiedInboxMessages.size > 500) {
      const [firstKey] = this.notifiedInboxMessages;
      if (firstKey) {
        this.notifiedInboxMessages.delete(firstKey);
      }
    }

    void commWhatsAppService.getUnreadChatsCount()
      .then((count) => {
        this.lastInboxUnreadCount = count;
        this.inboxUnreadCountCallbacks.forEach(callback => callback(count));
      })
      .catch((error) => {
        console.warn('[Notifications] nao foi possivel atualizar contador do inbox apos mensagem recebida.', error);
      });

    const messagePreview = (chat.last_message_text ?? '').replace(/\s+/g, ' ').trim();
    this.inboxMessageCallbacks.forEach(callback => callback({
      chatId: chat.id,
      displayName: chat.saved_contact_name || chat.push_name || chat.display_name || chat.phone_number,
      phoneNumber: chat.phone_number,
      messagePreview: messagePreview || 'Nova mensagem recebida.',
      messageAt: chat.last_message_at ?? null,
    }));
  }

  private async check() {
    if (this.isChecking) return;

    this.isChecking = true;

    try {
      const [
        { data: reminders, error },
        inboxUnreadCount,
      ] = await Promise.all([
        supabase
          .from('reminders')
          .select('*')
          .eq('lido', false)
          .order('data_lembrete', { ascending: true }),
        commWhatsAppService.getUnreadChatsCount(),
      ]);

      if (error) throw error;

      this.lastInboxUnreadCount = inboxUnreadCount;
      this.inboxUnreadCountCallbacks.forEach(callback => callback(inboxUnreadCount));

      if (reminders) {
        const unreadCount = reminders.length;
        this.lastUnreadCount = unreadCount;
        this.unreadCountCallbacks.forEach(callback => callback(unreadCount));

        for (const reminder of reminders) {
          if (
            !this.notifiedReminders.has(reminder.id) &&
            isReminderDue(reminder.data_lembrete, 1)
          ) {
            this.notifiedReminders.add(reminder.id);
            this.callbacks.forEach(callback => callback(reminder));
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar lembretes:', error);
    } finally {
      this.isChecking = false;
    }
  }

  clearNotified() {
    this.notifiedReminders.clear();
  }

  clearNotifiedLeads() {
    this.notifiedLeads.clear();
  }

  clearNotifiedInboxMessages() {
    this.notifiedInboxMessages.clear();
  }

  markAsNotified(reminderId: string) {
    this.notifiedReminders.add(reminderId);
  }

  markLeadAsNotified(leadId: string) {
    this.notifiedLeads.add(leadId);
  }
}

export const notificationService = new NotificationService();
