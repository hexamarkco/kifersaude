import type { ReminderQuickOpenItem, ReminderQuickOpenPeriod } from './inboxTypes';

export const formatReminderDueAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponivel';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const extractLeadNameFromReminderTitle = (title?: string | null) => {
  const trimmed = title?.trim();
  if (!trimmed) return null;

  const explicitName = trimmed.match(/^(?:follow\s*-?\s*up|retorno|lembrete)\s*[:-]\s*(.+)$/i)?.[1]?.trim();
  if (explicitName) {
    return explicitName;
  }

  const genericName = trimmed.match(/[:-]\s*(.+)$/)?.[1]?.trim();
  return genericName || null;
};

export const resolveReminderLeadName = (leadName?: string | null, reminderTitle?: string | null) => {
  const normalizedLeadName = leadName?.trim();
  if (normalizedLeadName) {
    return normalizedLeadName;
  }

  return extractLeadNameFromReminderTitle(reminderTitle) || 'Lead sem nome';
};

export const getReminderPriorityMeta = (priority?: string | null) => {
  const normalized = (priority || 'normal').trim().toLowerCase();

  if (normalized === 'alta' || normalized === 'high') {
    return { label: 'Alta', className: 'comm-badge-danger' };
  }

  if (normalized === 'baixa' || normalized === 'low') {
    return { label: 'Baixa', className: 'comm-badge-success' };
  }

  return { label: 'Normal', className: 'comm-badge-info' };
};

export const getReminderTypeMeta = (type?: string | null) => {
  const normalized = (type || '').trim().toLowerCase();

  if (normalized === 'retorno') {
    return { label: 'Retorno', className: 'comm-badge-warning' };
  }

  if (normalized === 'follow-up' || normalized === 'follow up' || normalized === 'followup') {
    return { label: 'Follow-up', className: 'comm-badge-info' };
  }

  return {
    label: type?.trim() || 'Outro',
    className: 'comm-badge-neutral',
  };
};

export const mapReminderTypeToSchedulerType = (type?: string | null): 'Retorno' | 'Follow-up' | 'Outro' => {
  const normalized = (type || '').trim().toLowerCase();
  if (normalized === 'retorno') return 'Retorno';
  if (normalized === 'follow-up' || normalized === 'follow up' || normalized === 'followup') return 'Follow-up';
  return 'Outro';
};

export const mapReminderPriorityToSchedulerPriority = (priority?: string | null): 'normal' | 'alta' | 'baixa' => {
  const normalized = (priority || 'normal').trim().toLowerCase();
  if (normalized === 'alta' || normalized === 'high') return 'alta';
  if (normalized === 'baixa' || normalized === 'low') return 'baixa';
  return 'normal';
};

const reminderQuickOpenNameCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  usage: 'sort',
});

export const compareReminderQuickOpenItems = (left: ReminderQuickOpenItem, right: ReminderQuickOpenItem) => {
  const leftDueAt = new Date(left.dueAt).getTime();
  const rightDueAt = new Date(right.dueAt).getTime();
  const leftHasValidDate = Number.isFinite(leftDueAt);
  const rightHasValidDate = Number.isFinite(rightDueAt);

  if (leftHasValidDate && rightHasValidDate && leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  if (leftHasValidDate !== rightHasValidDate) {
    return leftHasValidDate ? -1 : 1;
  }

  const leftLabel = (left.leadName || left.title || '').trim();
  const rightLabel = (right.leadName || right.title || '').trim();
  const labelComparison = reminderQuickOpenNameCollator.compare(leftLabel, rightLabel);

  if (labelComparison !== 0) {
    return labelComparison;
  }

  return reminderQuickOpenNameCollator.compare(left.id, right.id);
};

export const groupReminderQuickOpenItems = (items: ReminderQuickOpenItem[]) => {
  const referenceDate = new Date();
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0, 23, 59, 59, 999);

  const grouped: Record<ReminderQuickOpenPeriod, ReminderQuickOpenItem[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
  };

  items.forEach((item) => {
    const dueDate = new Date(item.dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      grouped.later.push(item);
      return;
    }

    if (dueDate.getTime() < startOfToday.getTime()) {
      grouped.overdue.push(item);
      return;
    }

    if (dueDate >= startOfToday && dueDate < endOfToday) {
      grouped.today.push(item);
      return;
    }

    if (dueDate <= endOfWeek) {
      grouped.thisWeek.push(item);
      return;
    }

    if (dueDate <= endOfMonth) {
      grouped.thisMonth.push(item);
      return;
    }

    grouped.later.push(item);
  });

  (Object.keys(grouped) as ReminderQuickOpenPeriod[]).forEach((period) => {
    grouped[period].sort(compareReminderQuickOpenItems);
  });

  return grouped;
};
