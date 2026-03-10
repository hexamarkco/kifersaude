import { Reminder } from './supabase';
import { isOverdue, getCurrentTimeBR } from './dateUtils';

export type ReminderPeriod = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'later';

export interface GroupedReminders {
  overdue: Reminder[];
  today: Reminder[];
  tomorrow: Reminder[];
  thisWeek: Reminder[];
  thisMonth: Reminder[];
  later: Reminder[];
}

export function groupRemindersByPeriod(reminders: Reminder[]): GroupedReminders {
  const now = getCurrentTimeBR();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const grouped: GroupedReminders = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    thisMonth: [],
    later: []
  };

  reminders.forEach(reminder => {
    const reminderDate = new Date(reminder.data_lembrete);
    const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());

    if (isOverdue(reminder.data_lembrete) && !reminder.lido) {
      grouped.overdue.push(reminder);
    } else if (reminderDay.getTime() === today.getTime()) {
      grouped.today.push(reminder);
    } else if (reminderDay.getTime() === tomorrow.getTime()) {
      grouped.tomorrow.push(reminder);
    } else if (reminderDate <= endOfWeek) {
      grouped.thisWeek.push(reminder);
    } else if (reminderDate <= endOfMonth) {
      grouped.thisMonth.push(reminder);
    } else {
      grouped.later.push(reminder);
    }
  });

  return grouped;
}

export function getPeriodLabel(period: ReminderPeriod): string {
  const labels: Record<ReminderPeriod, string> = {
    'overdue': 'Atrasados',
    'today': 'Hoje',
    'tomorrow': 'Amanhã',
    'thisWeek': 'Esta Semana',
    'thisMonth': 'Este Mês',
    'later': 'Mais Tarde'
  };
  return labels[period];
}

export function getPeriodColor(period: ReminderPeriod): string {
  const colors: Record<ReminderPeriod, string> = {
    'overdue': 'bg-red-50 border-red-200',
    'today': 'bg-orange-50 border-orange-200',
    'tomorrow': 'bg-blue-50 border-blue-200',
    'thisWeek': 'bg-teal-50 border-teal-200',
    'thisMonth': 'bg-slate-50 border-slate-200',
    'later': 'bg-slate-50 border-slate-200'
  };
  return colors[period];
}

export function calculateSnoozeTime(option: 'minutes-15' | 'minutes-30' | 'hour-1' | 'tomorrow' | 'next-week'): string {
  const now = new Date();

  switch (option) {
    case 'minutes-15':
      now.setMinutes(now.getMinutes() + 15);
      break;
    case 'minutes-30':
      now.setMinutes(now.getMinutes() + 30);
      break;
    case 'hour-1':
      now.setHours(now.getHours() + 1);
      break;
    case 'tomorrow':
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      break;
    case 'next-week':
      now.setDate(now.getDate() + 7);
      now.setHours(9, 0, 0, 0);
      break;
  }

  return now.toISOString();
}

export function addBusinessDaysSkippingWeekends(source: Date | string, businessDays: number): Date {
  const parsedSource = source instanceof Date ? new Date(source) : new Date(source);
  const nextDate = Number.isNaN(parsedSource.getTime()) ? new Date() : new Date(parsedSource);
  nextDate.setSeconds(0, 0);

  const totalBusinessDays = Number.isFinite(businessDays) ? Math.max(0, Math.floor(businessDays)) : 0;
  if (totalBusinessDays === 0) {
    return nextDate;
  }

  let remaining = totalBusinessDays;
  while (remaining > 0) {
    nextDate.setDate(nextDate.getDate() + 1);
    const weekday = nextDate.getDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }

  return nextDate;
}

export function getUrgencyLevel(reminder: Reminder): 'critical' | 'high' | 'medium' | 'low' {
  if (isOverdue(reminder.data_lembrete) && !reminder.lido) {
    return 'critical';
  }

  const now = getCurrentTimeBR();
  const reminderDate = new Date(reminder.data_lembrete);
  const hoursUntil = (reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (reminder.prioridade === 'alta') {
    return hoursUntil <= 24 ? 'critical' : 'high';
  }

  if (hoursUntil <= 2) return 'high';
  if (hoursUntil <= 24) return 'medium';
  return 'low';
}

export function getUrgencyStyles(urgency: 'critical' | 'high' | 'medium' | 'low'): string {
  const styles = {
    critical: 'ring-2 ring-red-400/80',
    high: 'ring-1 ring-orange-300/90',
    medium: 'ring-1 ring-amber-300/90',
    low: 'ring-1 ring-slate-300/80'
  };
  return styles[urgency];
}

export function formatEstimatedTime(minutes?: number): string {
  if (!minutes) return '';

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}min`;
}
