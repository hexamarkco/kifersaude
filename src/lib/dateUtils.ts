export const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

export function formatDateForInput(date: string | null | undefined): string {
  if (!date) return '';

  const dateOnly = date.split('T')[0];
  return dateOnly;
}

export function parseDateForStorage(dateString: string): string {
  if (!dateString) return '';

  return dateString;
}

export function formatDateOnly(dateString: string | null | undefined): string {
  if (!dateString) return '';

  const dateOnly = dateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
}

export function parseDateWithoutTimezone(dateString: string): { year: number; month: number; day: number } {
  const dateOnly = dateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  return { year, month, day };
}

export function formatDateTimeForInput(date: string | null | undefined): string {
  if (!date) return '';

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function convertLocalToUTC(localDateTimeString: string): string {
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
}

export function formatDateTimeBR(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function formatTimeBR(date: string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateTimeFullBR(date: string): string {
  return `${formatDateTimeBR(date)} às ${formatTimeBR(date)}`;
}

export function getCurrentTimeBR(): Date {
  return new Date();
}

export function isReminderDue(reminderDate: string, minutesBefore: number = 1): boolean {
  const now = getCurrentTimeBR().getTime();
  const reminderTime = new Date(reminderDate).getTime();
  const triggerTime = reminderTime - (minutesBefore * 60 * 1000);

  return now >= triggerTime && now < reminderTime + (5 * 60 * 1000);
}

export function isOverdue(date: string): boolean {
  const reminderDate = new Date(date);
  const now = getCurrentTimeBR();

  const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return reminderDay.getTime() < today.getTime();
}
