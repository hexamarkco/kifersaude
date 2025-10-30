import { supabase, Reminder, Lead } from './supabase';
import { isReminderDue } from './dateUtils';

export type NotificationCallback = (reminder: Reminder) => void;
export type LeadNotificationCallback = (lead: Lead) => void;

class NotificationService {
  private callbacks: NotificationCallback[] = [];
  private leadCallbacks: LeadNotificationCallback[] = [];
  private notifiedReminders: Set<string> = new Set();
  private notifiedLeads: Set<string> = new Set();
  private intervalId: number | null = null;
  private isChecking = false;
  private leadChannelSubscription: any = null;

  start(intervalMs: number = 30000) {
    if (this.intervalId !== null) {
      return;
    }

    this.check();
    this.intervalId = window.setInterval(() => this.check(), intervalMs);
    this.startLeadNotifications();
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.stopLeadNotifications();
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

  private async check() {
    if (this.isChecking) return;

    this.isChecking = true;

    try {
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('lido', false)
        .order('data_lembrete', { ascending: true });

      if (error) throw error;

      if (reminders) {
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

  markAsNotified(reminderId: string) {
    this.notifiedReminders.add(reminderId);
  }

  markLeadAsNotified(leadId: string) {
    this.notifiedLeads.add(leadId);
  }
}

export const notificationService = new NotificationService();
