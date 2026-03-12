import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cx } from '../../lib/cx';
import Button from './Button';
import Input from './Input';

type PickerType = 'date' | 'datetime-local' | 'month';

type DateTimePickerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  type?: PickerType;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  triggerClassName?: string;
};

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const pad = (value: number) => String(value).padStart(2, '0');

const toDateOnlyStamp = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const parseValue = (value: string, type: PickerType): Date | null => {
  if (!value) return null;

  const parsed =
    type === 'date'
      ? new Date(`${value}T00:00:00`)
      : type === 'month'
        ? new Date(`${value}-01T00:00:00`)
        : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatDateTimeLocalValue = (date: Date) => `${formatDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatMonthValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const addMonths = (date: Date, monthDelta: number) =>
  new Date(date.getFullYear(), date.getMonth() + monthDelta, 1);

const addYears = (date: Date, yearDelta: number) =>
  new Date(date.getFullYear() + yearDelta, date.getMonth(), 1);

const getMonthCalendarDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const weekdayOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const firstGridDate = new Date(year, month, 1 - weekdayOffset);

  return Array.from({ length: 42 }, (_, index) =>
    new Date(firstGridDate.getFullYear(), firstGridDate.getMonth(), firstGridDate.getDate() + index),
  );
};

export default function DateTimePicker({
  value,
  onChange,
  type = 'date',
  placeholder,
  disabled = false,
  min,
  max,
  className,
  triggerClassName,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => parseValue(value, type), [type, value]);
  const minDate = useMemo(() => parseValue(min ?? '', type), [min, type]);
  const maxDate = useMemo(() => parseValue(max ?? '', type), [max, type]);

  const [viewDate, setViewDate] = useState<Date>(() => {
    const baseDate = selectedDate ?? new Date();
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!selectedDate) return;
    setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(viewDate),
    [viewDate],
  );

  const displayValue = useMemo(() => {
    if (!selectedDate) {
      return placeholder ?? (type === 'datetime-local' ? 'Selecionar data e hora' : 'Selecionar data');
    }

    if (type === 'month') {
      return selectedDate.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });
    }

    const datePart = selectedDate.toLocaleDateString('pt-BR');
    if (type === 'date') {
      return datePart;
    }

    const timePart = selectedDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${datePart} ${timePart}`;
  }, [placeholder, selectedDate, type]);

  const calendarDays = useMemo(() => getMonthCalendarDays(viewDate), [viewDate]);

  const isDayDisabled = (day: Date) => {
    const dayStamp = toDateOnlyStamp(day);
    if (minDate && dayStamp < toDateOnlyStamp(minDate)) {
      return true;
    }
    if (maxDate && dayStamp > toDateOnlyStamp(maxDate)) {
      return true;
    }
    return false;
  };

  const applyDate = (nextDate: Date | null) => {
    if (!nextDate) {
      onChange('');
      return;
    }

    if (type === 'date') {
      onChange(formatDateValue(nextDate));
      return;
    }

    if (type === 'month') {
      onChange(formatMonthValue(nextDate));
      return;
    }

    onChange(formatDateTimeLocalValue(nextDate));
  };

  const handleSelectDay = (day: Date) => {
    if (isDayDisabled(day) || disabled) {
      return;
    }

    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    baseDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());

    if (!selectedDate && type === 'datetime-local') {
      baseDate.setHours(9, 0, 0, 0);
    }

    applyDate(baseDate);

    if (type !== 'datetime-local') {
      setIsOpen(false);
    }
  };

  const isMonthDisabled = (monthIndex: number) => {
    const candidate = new Date(viewDate.getFullYear(), monthIndex, 1).getTime();
    if (minDate && candidate < new Date(minDate.getFullYear(), minDate.getMonth(), 1).getTime()) {
      return true;
    }
    if (maxDate && candidate > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1).getTime()) {
      return true;
    }
    return false;
  };

  const handleSelectMonth = (monthIndex: number) => {
    if (disabled || isMonthDisabled(monthIndex)) {
      return;
    }

    const nextDate = new Date(viewDate.getFullYear(), monthIndex, 1);
    applyDate(nextDate);
    setViewDate(nextDate);
    setIsOpen(false);
  };

  const ensureDateForTime = () => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();

    if (!selectedDate) {
      baseDate.setSeconds(0, 0);
    }

    return baseDate;
  };

  const handleTimeChange = (part: 'hours' | 'minutes', rawValue: string) => {
    if (rawValue.trim() === '') {
      return;
    }

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) {
      return;
    }

    const nextDate = ensureDateForTime();
    if (part === 'hours') {
      nextDate.setHours(clampNumber(parsed, 0, 23));
    } else {
      nextDate.setMinutes(clampNumber(parsed, 0, 59));
    }

    applyDate(nextDate);
  };

  const selectedHours = selectedDate?.getHours() ?? 9;
  const selectedMinutes = selectedDate?.getMinutes() ?? 0;
  const selectedDayStamp = selectedDate ? toDateOnlyStamp(selectedDate) : null;
  const todayStamp = toDateOnlyStamp(new Date());
  const selectedMonthKey = selectedDate ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}` : null;
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;

  return (
    <div className={cx('relative', className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={cx(
          'panel-ui-input panel-interactive-glass relative flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left shadow-sm transition-all',
          'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500',
          'disabled:cursor-not-allowed disabled:opacity-60',
          type === 'date' ? 'h-11' : 'h-11',
          triggerClassName,
        )}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          {type === 'date' ? (
            <CalendarDays className="h-[18px] w-[18px] flex-shrink-0 text-slate-400" />
          ) : (
            <Clock className="h-[18px] w-[18px] flex-shrink-0 text-slate-400" />
          )}
          <span className={cx('truncate text-sm', selectedDate ? 'font-medium text-slate-700' : 'text-slate-500')}>
            {displayValue}
          </span>
        </span>
        <ChevronDown className={cx('h-4 w-4 flex-shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className={cx(
            'panel-glass-panel absolute left-0 z-40 mt-2 rounded-xl border border-[color:rgba(191,113,33,0.35)] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(255,247,237,0.98))] p-3 shadow-xl shadow-[rgba(56,28,12,0.18)]',
            'w-[min(24rem,calc(100vw-2rem))]',
            type === 'month' && 'w-[min(18rem,calc(100vw-2rem))]',
          )}
          role="dialog"
          aria-label="Selecionar data"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-lg p-0"
              onClick={() => setViewDate((current) => (type === 'month' ? addYears(current, -1) : addMonths(current, -1)))}
              aria-label={type === 'month' ? 'Ano anterior' : 'Mes anterior'}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <p className="text-sm font-semibold capitalize text-slate-700">{monthLabel}</p>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-lg p-0"
              onClick={() => setViewDate((current) => (type === 'month' ? addYears(current, 1) : addMonths(current, 1)))}
              aria-label={type === 'month' ? 'Proximo ano' : 'Proximo mes'}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {type === 'month' ? (
            <div className="grid grid-cols-3 gap-2">
              {MONTH_LABELS.map((label, monthIndex) => {
                const monthKey = `${viewDate.getFullYear()}-${monthIndex}`;
                const isSelected = selectedMonthKey === monthKey;
                const isCurrentMonth = currentMonthKey === monthKey;
                const disabledMonth = isMonthDisabled(monthIndex);

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelectMonth(monthIndex)}
                    disabled={disabledMonth}
                    className={cx(
                      'h-11 rounded-xl border text-sm font-semibold transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-amber-500',
                      isSelected && 'border-orange-500 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-900/20',
                      !isSelected && isCurrentMonth && 'border-amber-200 bg-amber-50 text-amber-900',
                      !isSelected && !isCurrentMonth && 'border-[color:rgba(191,113,33,0.18)] bg-white/90 text-slate-700 hover:border-amber-300 hover:bg-amber-50/80',
                      disabledMonth && 'cursor-not-allowed opacity-40 hover:border-[color:rgba(191,113,33,0.18)] hover:bg-white/90',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isSameMonth = day.getMonth() === viewDate.getMonth();
                  const dayStamp = toDateOnlyStamp(day);
                  const isSelected = selectedDayStamp === dayStamp;
                  const isToday = dayStamp === todayStamp;
                  const isDisabledDay = isDayDisabled(day);

                  return (
                    <button
                      key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      disabled={isDisabledDay}
                      className={cx(
                        'h-9 rounded-lg text-sm font-medium transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-amber-500',
                        isSelected && 'bg-amber-600 text-white hover:bg-amber-700',
                        !isSelected && isToday && 'bg-slate-100 text-slate-800',
                        !isSelected && !isToday && isSameMonth && 'text-slate-700 hover:bg-slate-100',
                        !isSelected && !isToday && !isSameMonth && 'text-slate-400 hover:bg-slate-100',
                        isDisabledDay && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {type === 'datetime-local' && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Horario</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  size="compact"
                  value={String(selectedHours)}
                  onChange={(event) => handleTimeChange('hours', event.target.value)}
                  inputMode="numeric"
                  placeholder="HH"
                  aria-label="Hora"
                />
                <Input
                  size="compact"
                  value={String(selectedMinutes)}
                  onChange={(event) => handleTimeChange('minutes', event.target.value)}
                  inputMode="numeric"
                  placeholder="MM"
                  aria-label="Minutos"
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyDate(null)}
              disabled={!value}
              className="px-2"
            >
              Limpar
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  applyDate(now);
                  setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  if (type !== 'datetime-local') {
                    setIsOpen(false);
                  }
                }}
              >
                {type === 'month' ? 'Este mês' : 'Hoje'}
              </Button>

              <Button variant="primary" size="sm" onClick={() => setIsOpen(false)}>
                Concluído
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
