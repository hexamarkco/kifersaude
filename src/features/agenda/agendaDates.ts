import { getDateKey, parseDateWithoutTimezoneAsDate } from '../../lib/dateUtils';

// Calendar cells are civil dates. Reminder timestamps are grouped in São Paulo time.
export const agendaDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const todayForAgenda = () => parseDateWithoutTimezoneAsDate(getDateKey(new Date())) ?? new Date();

export const dateInAgendaMonth = (date: Date, day: number) => new Date(date.getFullYear(), date.getMonth(), day);

export const mondayOffset = (date: Date) => (date.getDay() + 6) % 7;
