import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../infrastructure/supabase';
import type { Lead } from '../features/leads';
import type { Reminder } from '../features/reminders';
import {
  whatsappConversationsRepository,
  getSafeChatDisplayName,
  type CommWhatsAppChat,
} from '../features/communication/whatsapp';
import { isReminderDue } from './dateUtils';

export type NotificationReminder = Pick<
  Reminder,
  'id' | 'titulo' | 'descricao' | 'data_lembrete' | 'prioridade'
>;
export type NotificationCallback = (reminder: NotificationReminder) => void;
export type LeadNotificationCallback = (lead: Lead) => void;
export type UnreadCountCallback = (count: number) => void;
export type InboxUnreadCountCallback = (count: number) => void;
export type InboxMessageNotification = {
  chatId: string;
  displayName: string;
  phoneNumber: string | null;
  messagePreview: string;
  messageAt: string | null;
};
export type InboxMessageNotificationCallback = (notification: InboxMessageNotification) => void;

const RECENT_INBOX_MESSAGE_THRESHOLD_MS = 5 * 60 * 1000;
const INBOX_SUBSCRIPTION_RETRY_INTERVAL_MS = 30 * 1000;

export class NotificationService {
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
  private inboxSubscriptionPromise: Promise<void> | null = null;
  private inboxSubscriptionRequestId = 0;
  private inboxConnectedUserName: string | null = null;
  private inboxSubscriptionRetryAt = 0;
  private inboxRealtimeWarningShown = false;
  private lifecycleId = 0;
  private lastUnreadCount = 0;
  private lastInboxUnreadCount = 0;

  start(intervalMs: number = 30000) {
    if (this.intervalId !== null) {
      return;
    }

    const lifecycleId = ++this.lifecycleId;
    this.intervalId = window.setInterval(() => {
      void this.check(lifecycleId);
    }, intervalMs);
    void this.check(lifecycleId);
    this.startLeadNotifications(lifecycleId);
    this.startInboxMessageNotifications(lifecycleId);
  }

  stop() {
    this.lifecycleId += 1;
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

  private startLeadNotifications(lifecycleId: number) {
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
          if (lifecycleId !== this.lifecycleId || this.intervalId === null) {
            return;
          }

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

  private startInboxMessageNotifications(lifecycleId: number) {
    this.ensureInboxMessageSubscription(lifecycleId);
  }

  private ensureInboxMessageSubscription(lifecycleId: number) {
    if (
      lifecycleId !== this.lifecycleId
      || this.intervalId === null
      || this.inboxChannelSubscription !== null
      || this.inboxSubscriptionPromise !== null
      || Date.now() < this.inboxSubscriptionRetryAt
    ) {
      return;
    }

    const requestId = ++this.inboxSubscriptionRequestId;
    const subscriptionPromise = whatsappConversationsRepository.getOperationalState()
      .then((state) => {
        if (
          lifecycleId !== this.lifecycleId
          || requestId !== this.inboxSubscriptionRequestId
          || this.intervalId === null
          || this.inboxChannelSubscription !== null
        ) {
          return;
        }

        const channelId = state?.channel?.id;
        this.inboxConnectedUserName = state?.channel?.connected_user_name ?? null;
        if (!channelId) {
          this.inboxSubscriptionRetryAt = Date.now() + INBOX_SUBSCRIPTION_RETRY_INTERVAL_MS;
          return;
        }

        let realtimeWarningShown = false;
        const channel = supabase
          .channel('comm-whatsapp-inbox-notifications')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'comm_whatsapp_chats',
              filter: `channel_id=eq.${channelId}`,
            },
            (payload) => {
              if (lifecycleId !== this.lifecycleId || this.intervalId === null) {
                return;
              }

              const chat = payload.new as CommWhatsAppChat | null;
              const previousChat = payload.old as Partial<CommWhatsAppChat> | null;

              this.handleInboxChatChange(chat, previousChat, payload.eventType);
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              realtimeWarningShown = false;
              this.inboxRealtimeWarningShown = false;
              return;
            }

            if (
              lifecycleId === this.lifecycleId
              && requestId === this.inboxSubscriptionRequestId
              && this.intervalId !== null
              && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
              && !realtimeWarningShown
            ) {
              realtimeWarningShown = true;
              if (!this.inboxRealtimeWarningShown) {
                this.inboxRealtimeWarningShown = true;
                console.warn('[Notifications] realtime de mensagens do inbox indisponivel; polling do contador permanece ativo.');
              }

              if (this.inboxChannelSubscription === channel) {
                this.inboxChannelSubscription = null;
                this.inboxSubscriptionRetryAt = Date.now() + INBOX_SUBSCRIPTION_RETRY_INTERVAL_MS;
                void supabase.removeChannel(channel);
              }
            }
          });

        this.inboxChannelSubscription = channel;
      })
      .catch((error) => {
        if (lifecycleId !== this.lifecycleId) {
          return;
        }

        this.inboxSubscriptionRetryAt = Date.now() + INBOX_SUBSCRIPTION_RETRY_INTERVAL_MS;
        console.warn('[Notifications] nao foi possivel obter o canal para filtrar subscription realtime.', error);
      })
      .finally(() => {
        if (this.inboxSubscriptionPromise === subscriptionPromise) {
          this.inboxSubscriptionPromise = null;
        }
      });

    this.inboxSubscriptionPromise = subscriptionPromise;
  }

  private stopInboxMessageNotifications() {
    this.inboxSubscriptionRequestId += 1;
    this.inboxSubscriptionPromise = null;
    this.inboxConnectedUserName = null;
    this.inboxSubscriptionRetryAt = 0;
    this.inboxRealtimeWarningShown = false;
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

    if (chat.deleted_at || chat.merged_into_chat_id || chat.is_archived || chat.is_muted || chat.last_message_direction !== 'inbound') {
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

    void whatsappConversationsRepository.getUnreadCount()
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
      displayName: getSafeChatDisplayName(chat, this.inboxConnectedUserName),
      phoneNumber: chat.phone_number || null,
      messagePreview: messagePreview || 'Nova mensagem recebida.',
      messageAt: chat.last_message_at ?? null,
    }));
  }

  private async check(lifecycleId: number) {
    if (this.isChecking) return;

    this.isChecking = true;
    this.ensureInboxMessageSubscription(lifecycleId);

    try {
      const [remindersResult, inboxUnreadResult] = await Promise.allSettled([
        supabase
          .from('reminders')
          .select('id, titulo, descricao, data_lembrete, prioridade')
          .eq('lido', false)
          .order('data_lembrete', { ascending: true }),
        whatsappConversationsRepository.getUnreadCount(),
      ]);

      if (lifecycleId !== this.lifecycleId || this.intervalId === null) {
        return;
      }

      if (inboxUnreadResult.status === 'fulfilled') {
        this.lastInboxUnreadCount = inboxUnreadResult.value;
        this.inboxUnreadCountCallbacks.forEach(callback => callback(inboxUnreadResult.value));
      } else {
        console.warn('[Notifications] nao foi possivel atualizar o contador de nao lidas do inbox.', inboxUnreadResult.reason);
      }

      if (remindersResult.status === 'rejected') {
        throw remindersResult.reason;
      }

      const { data: reminders, error } = remindersResult.value;
      if (error) throw error;

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
      if (lifecycleId === this.lifecycleId && this.intervalId !== null) {
        console.error('Erro ao verificar lembretes:', error);
      }
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
