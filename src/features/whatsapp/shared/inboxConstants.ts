import { SAO_PAULO_TIMEZONE } from '../../../lib/dateUtils';
import type { ReminderQuickOpenPeriod } from './inboxTypes';

export const getChatTypeBadgeClass = (kind?: string | null) => {
  const normalized = (kind || 'direct').trim().toLowerCase();

  if (normalized === 'group') return 'comm-badge-info';
  if (normalized === 'newsletter') return 'comm-badge-channel';
  if (normalized === 'status') return 'comm-badge-warning';
  if (normalized === 'broadcast') return 'comm-badge-channel';
  return 'comm-badge-neutral';
};

export const getChatAvatarClass = (kind?: string | null) => {
  const normalized = (kind || 'direct').trim().toLowerCase();

  if (normalized === 'group') return 'comm-icon-chip-info';
  if (normalized === 'newsletter') return 'comm-icon-chip-brand';
  if (normalized === 'status' || normalized === 'broadcast') return 'comm-icon-chip-warning';
  return 'comm-icon-chip-brand';
};

export const MESSAGES_PAGE_SIZE = 120;

export const DAY_SEPARATOR_LABEL_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIMEZONE,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const EMPTY_FILTER_VALUE = '__empty__';
export const CHAT_PREVIEW_VARIANTS_BATCH_SIZE = 40;

export const REMINDER_QUICK_OPEN_PERIODS: Array<{
  id: ReminderQuickOpenPeriod;
  label: string;
  emptyLabel: string;
  accentClassName: string;
}> = [
  {
    id: 'overdue',
    label: 'Atrasados',
    emptyLabel: 'Sem lembretes atrasados.',
    accentClassName: 'comm-badge comm-badge-danger',
  },
  {
    id: 'today',
    label: 'Hoje',
    emptyLabel: 'Sem lembretes para hoje.',
    accentClassName: 'comm-badge comm-badge-success',
  },
  {
    id: 'thisWeek',
    label: 'Esta semana',
    emptyLabel: 'Sem lembretes para esta semana.',
    accentClassName: 'comm-badge comm-badge-info',
  },
  {
    id: 'thisMonth',
    label: 'Este mÃªs',
    emptyLabel: 'Sem lembretes para este mÃªs.',
    accentClassName: 'comm-badge comm-badge-warning',
  },
  {
    id: 'later',
    label: 'Mais adiante',
    emptyLabel: 'Sem lembretes futuros.',
    accentClassName: 'comm-badge comm-badge-neutral',
  },
];

export const REMINDER_QUICK_OPEN_AUTO_REFRESH_MS = 60_000;
export const REMINDER_QUICK_OPEN_STALE_MS = 45_000;

export const TEMPLATE_VARIABLE_SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: 'nome', label: 'Nome' },
  { key: 'primeiro_nome', label: 'Primeiro nome' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'status', label: 'Status' },
  { key: 'atendente', label: 'Atendente' },
  { key: 'data_hoje', label: 'Data de hoje' },
  { key: 'hora_agora', label: 'Hora atual' },
];

export const PERSON_FALLBACK_NOTIFICATION_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='#d1fae5'/><circle cx='32' cy='24' r='10' fill='#0f766e'/><path d='M14 50c3-9 12-14 18-14s15 5 18 14' fill='none' stroke='#0f766e' stroke-width='6' stroke-linecap='round'/></svg>",
  );
