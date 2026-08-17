const pad2 = (value: number) => String(value).padStart(2, '0');

export const MONTH_LABELS_PT = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const WEEKDAY_LABELS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export type DateParts = { year: number; month: number; day: number };
export type TimeParts = { hour: number; minute: number };

export function splitDateAndTime(value: string | undefined | null): { datePart: string; timePart: string } {
  if (!value) return { datePart: '', timePart: '' };
  const [datePart = '', timePart = ''] = value.split('T');
  return { datePart, timePart };
}

export function parseDateParts(datePart: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function parseTimeParts(timePart: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})/.exec(timePart);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function formatDateValue(parts: DateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatTimeValue(parts: TimeParts): string {
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatDateDisplay(parts: DateParts): string {
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export type CalendarCell = {
  year: number;
  month: number;
  day: number;
  inCurrentMonth: boolean;
};

export function buildMonthMatrix(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthDays = daysInMonth(prevYear, prevMonth);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const cells: CalendarCell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ year: prevYear, month: prevMonth, day: prevMonthDays - i, inCurrentMonth: false });
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ year, month, day, inCurrentMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const lastCell = cells[cells.length - 1];
    const nextDay = lastCell.month === nextMonth && lastCell.year === nextYear ? lastCell.day + 1 : 1;
    cells.push({ year: nextYear, month: nextMonth, day: nextDay, inCurrentMonth: false });
    if (cells.length >= 42) break;
  }

  return cells;
}

export function isSameDate(a: DateParts | null, b: DateParts | null): boolean {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b. */
export function compareDateParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return 0;
}

export function compareTimeParts(a: TimeParts, b: TimeParts): number {
  if (a.hour !== b.hour) return a.hour < b.hour ? -1 : 1;
  if (a.minute !== b.minute) return a.minute < b.minute ? -1 : 1;
  return 0;
}

export function todayParts(): DateParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES = Array.from({ length: 60 }, (_, i) => i);
