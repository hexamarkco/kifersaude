export const DEFAULT_GREETING_TIMEZONE = 'America/Sao_Paulo';

const getHourInTimeZone = (
  date: Date,
  timeZone: string,
  fallbackTimeZone: string,
): number => {
  const readHour = (zone: string) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: '2-digit',
      hour12: false,
    });
    const hourPart = formatter.formatToParts(date).find((part) => part.type === 'hour');
    const hour = Number.parseInt(hourPart?.value ?? '', 10);
    return Number.isFinite(hour) ? hour : date.getUTCHours();
  };

  const normalizedTimeZone = timeZone.trim() || fallbackTimeZone;
  try {
    return readHour(normalizedTimeZone);
  } catch {
    try {
      return normalizedTimeZone === fallbackTimeZone
        ? date.getUTCHours()
        : readHour(fallbackTimeZone);
    } catch {
      return date.getUTCHours();
    }
  }
};

export const getGreetingForDate = (
  date: Date,
  timeZone: string = DEFAULT_GREETING_TIMEZONE,
): string => {
  const hour = getHourInTimeZone(date, timeZone, DEFAULT_GREETING_TIMEZONE);
  if (hour >= 5 && hour < 12) return 'bom dia';
  if (hour >= 12 && hour < 18) return 'boa tarde';
  return 'boa noite';
};

export const formatGreetingTitle = (greeting: string): string => {
  const trimmed = greeting.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : '';
};
