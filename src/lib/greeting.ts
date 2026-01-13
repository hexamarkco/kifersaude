import { SAO_PAULO_TIMEZONE } from './dateUtils';

export const DEFAULT_GREETING_TIMEZONE = SAO_PAULO_TIMEZONE;

const buildHourFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  });

const getHourFromFormatter = (formatter: Intl.DateTimeFormat, date: Date): number => {
  const hourPart = formatter.formatToParts(date).find((part) => part.type === 'hour');
  if (!hourPart) {
    return date.getUTCHours();
  }
  const hour = Number.parseInt(hourPart.value, 10);
  return Number.isFinite(hour) ? hour : date.getUTCHours();
};

const resolveHourInTimeZone = (date: Date, timeZone: string, fallbackTimeZone: string): number => {
  const normalizedTimeZone = timeZone?.trim() || fallbackTimeZone;

  try {
    return getHourFromFormatter(buildHourFormatter(normalizedTimeZone), date);
  } catch (error) {
    if (normalizedTimeZone !== fallbackTimeZone) {
      try {
        return getHourFromFormatter(buildHourFormatter(fallbackTimeZone), date);
      } catch {
        return date.getUTCHours();
      }
    }
    return date.getUTCHours();
  }
};

export const getGreetingForDate = (date: Date, timeZone: string = DEFAULT_GREETING_TIMEZONE): string => {
  const hour = resolveHourInTimeZone(date, timeZone, DEFAULT_GREETING_TIMEZONE);

  if (hour >= 5 && hour < 12) {
    return 'bom dia';
  }

  if (hour >= 12 && hour < 18) {
    return 'boa tarde';
  }

  return 'boa noite';
};

export const formatGreetingTitle = (greeting: string): string => {
  const trimmed = greeting.trim();
  if (!trimmed) return '';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

export const getGreetingTitleForDate = (date: Date, timeZone: string = DEFAULT_GREETING_TIMEZONE): string =>
  formatGreetingTitle(getGreetingForDate(date, timeZone));
