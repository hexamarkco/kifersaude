export type AutoContactSchedulingSettings = {
  timezone: string;
  startHour: string;
  endHour: string;
  allowedWeekdays: number[];
  skipHolidays: boolean;
  dailySendLimit: number | null;
};

export const DEFAULT_SCHEDULING: AutoContactSchedulingSettings = {
  timezone: 'America/Sao_Paulo',
  startHour: '08:00',
  endHour: '19:00',
  allowedWeekdays: [1, 2, 3, 4, 5],
  skipHolidays: true,
  dailySendLimit: null,
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export const parseHourMinute = (value: string): { hour: number; minute: number } => {
  if (!value) return { hour: 0, minute: 0 };
  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  return {
    hour: Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 23) : 0,
    minute: Number.isFinite(minute) ? Math.min(Math.max(minute, 0), 59) : 0,
  };
};

const getTimeZoneOffset = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const lookup: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second),
  );
  return asUtc - date.getTime();
};

export const toZonedDate = (date: Date, timeZone: string): Date =>
  new Date(date.getTime() + getTimeZoneOffset(date, timeZone));

export const buildDateInTimeZone = (
  { year, month, day, hour, minute }: DateParts,
  timeZone: string,
): Date => {
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
  return new Date(utcDate.getTime() - getTimeZoneOffset(utcDate, timeZone));
};

const addDaysToZoned = (zoned: Date, days: number): Date =>
  new Date(zoned.getTime() + days * 86400000);

const getWeekdayNumber = (zoned: Date): number => {
  const day = zoned.getUTCDay();
  return day === 0 ? 7 : day;
};

export const getNextAllowedSendAt = (
  reference: Date,
  scheduling: AutoContactSchedulingSettings,
): Date => {
  const allowedWeekdays = scheduling.allowedWeekdays.length
    ? scheduling.allowedWeekdays
    : [1, 2, 3, 4, 5, 6, 7];
  const start = parseHourMinute(scheduling.startHour);
  const end = parseHourMinute(scheduling.endHour);
  let candidate = new Date(reference.getTime());

  for (let attempt = 0; attempt < 370; attempt += 1) {
    const zoned = toZonedDate(candidate, scheduling.timezone);
    const isAllowedWeekday = allowedWeekdays.includes(getWeekdayNumber(zoned));
    if (!isAllowedWeekday) {
      const nextDay = addDaysToZoned(zoned, 1);
      candidate = buildDateInTimeZone({
        year: nextDay.getUTCFullYear(),
        month: nextDay.getUTCMonth(),
        day: nextDay.getUTCDate(),
        hour: start.hour,
        minute: start.minute,
      }, scheduling.timezone);
      continue;
    }

    const currentMinutes = zoned.getUTCHours() * 60 + zoned.getUTCMinutes();
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;
    if (currentMinutes < startMinutes) {
      return buildDateInTimeZone({
        year: zoned.getUTCFullYear(),
        month: zoned.getUTCMonth(),
        day: zoned.getUTCDate(),
        hour: start.hour,
        minute: start.minute,
      }, scheduling.timezone);
    }
    if (currentMinutes > endMinutes) {
      const nextDay = addDaysToZoned(zoned, 1);
      candidate = buildDateInTimeZone({
        year: nextDay.getUTCFullYear(),
        month: nextDay.getUTCMonth(),
        day: nextDay.getUTCDate(),
        hour: start.hour,
        minute: start.minute,
      }, scheduling.timezone);
      continue;
    }
    return candidate;
  }
  return candidate;
};

export const buildTimeZoneDayWindow = (
  reference: Date,
  timeZone: string,
): { dayKey: string; start: Date; end: Date } => {
  const zoned = toZonedDate(reference, timeZone);
  const year = zoned.getUTCFullYear();
  const month = zoned.getUTCMonth();
  const day = zoned.getUTCDate();
  const nextDayUtc = new Date(Date.UTC(year, month, day + 1, 0, 0, 0));
  const start = buildDateInTimeZone({ year, month, day, hour: 0, minute: 0 }, timeZone);
  const end = buildDateInTimeZone({
    year: nextDayUtc.getUTCFullYear(),
    month: nextDayUtc.getUTCMonth(),
    day: nextDayUtc.getUTCDate(),
    hour: 0,
    minute: 0,
  }, timeZone);
  const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dayKey, start, end };
};
