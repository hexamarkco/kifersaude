export const getTaskDateKey = (date: Date) => date.toISOString().split("T")[0];

export const parseTaskDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isTaskSameMonth = (date: Date, other: Date) =>
  date.getFullYear() === other.getFullYear() &&
  date.getMonth() === other.getMonth();

export const isTaskSameDay = (date: Date, other: Date) =>
  isTaskSameMonth(date, other) && date.getDate() === other.getDate();
