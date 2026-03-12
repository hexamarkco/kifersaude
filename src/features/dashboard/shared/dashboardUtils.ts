import type { DashboardMetric, DashboardMonthlyPoint } from './dashboardTypes';

export const formatDashboardLastUpdated = (value: Date | null) => {
  if (!value) return '';

  const date = value.toLocaleDateString('pt-BR');
  const time = value.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${date} as ${time}`;
};

export const parseDashboardDateString = (dateStr: string): Date => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

export const parseDashboardDateValue = (value?: string | null): Date | null => {
  if (!value) return null;

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyPattern.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDashboardMonthLabel = (date: Date) =>
  date.toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });

export const aggregateDashboardMonthlyTotals = <T,>(
  items: T[],
  getDate: (item: T) => Date | null,
  getValue: (item: T) => number = () => 1,
): DashboardMonthlyPoint[] => {
  const totals = new Map<
    string,
    {
      date: Date;
      total: number;
    }
  >();

  items.forEach((item) => {
    const date = getDate(item);
    if (!date) return;

    const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const key = monthDate.toISOString();
    const current = totals.get(key) || { date: monthDate, total: 0 };

    totals.set(key, {
      date: monthDate,
      total: current.total + getValue(item),
    });
  });

  return Array.from(totals.values())
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map((item) => ({
      label: formatDashboardMonthLabel(item.date),
      value: item.total,
      date: item.date,
    }));
};

export const validateDashboardDate = (dateStr: string): boolean => {
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(dateRegex);

  if (!match) return false;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
};

export const formatDashboardDateInput = (value: string): string => {
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }

  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

export const formatDashboardMetricValue = (value: number, metric: DashboardMetric) => {
  if (metric === 'comissoes') {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString('pt-BR');
};

export const resolveDashboardVariationTone = (variation?: number | null) => {
  if ((variation || 0) > 0) {
    return { color: 'var(--panel-accent-green-text,#275c39)' };
  }

  if ((variation || 0) < 0) {
    return { color: 'var(--panel-accent-red-text,#8a3128)' };
  }

  return { color: 'var(--panel-text-soft,#5b4635)' };
};
