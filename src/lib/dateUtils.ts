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

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const TIMEZONE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: SAO_PAULO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

const getFormatterPartValue = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
) => {
  const part = parts.find((item) => item.type === type);
  return part ? parseInt(part.value, 10) : 0;
};

export function convertLocalToUTC(
  localDateTimeString: string,
  timeZone: string = SAO_PAULO_TIMEZONE
): string {
  if (!localDateTimeString) {
    return '';
  }

  const [datePart, timePart] = localDateTimeString.split('T');
  if (!datePart || !timePart) {
    const parsed = new Date(localDateTimeString);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    const parsed = new Date(localDateTimeString);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }

  const baseUtcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = timeZone === SAO_PAULO_TIMEZONE
    ? TIMEZONE_FORMATTER
    : new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
  const parts = formatter.formatToParts(baseUtcDate);

  const tzRepresentation = Date.UTC(
    getFormatterPartValue(parts, 'year'),
    getFormatterPartValue(parts, 'month') - 1,
    getFormatterPartValue(parts, 'day'),
    getFormatterPartValue(parts, 'hour'),
    getFormatterPartValue(parts, 'minute'),
    getFormatterPartValue(parts, 'second')
  );

  const offset = tzRepresentation - baseUtcDate.getTime();
  return new Date(baseUtcDate.getTime() - offset).toISOString();
}

export function getDateKey(
  date: Date | string,
  timeZone: string = SAO_PAULO_TIMEZONE
): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date;

  if (Number.isNaN(targetDate.getTime())) {
    return '';
  }

  if (timeZone === SAO_PAULO_TIMEZONE) {
    return DATE_KEY_FORMATTER.format(targetDate);
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(targetDate);
}

export function formatDateTime(
  date: string | Date | null | undefined
): string {
  if (!date) {
    return '';
  }

  const targetDate = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(targetDate.getTime())) {
    return '';
  }

  return targetDate.toLocaleString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

  if (Number.isNaN(d.getTime())) {
    return '';
  }

  const parts = TIME_FORMATTER.formatToParts(d);
  const hour = parts.find(part => part.type === 'hour')?.value ?? '';
  const minute = parts.find(part => part.type === 'minute')?.value ?? '';

  if (!hour || !minute) {
    return '';
  }

  return `${hour}:${minute}`;
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
