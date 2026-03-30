import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cx } from '../../lib/cx';
import { calculateFloatingPanelPosition, type FloatingPanelPosition } from '../../lib/floatingPosition';
import Button from './Button';
import Input from './Input';
import { panelInputBaseClass, panelInputSizeClasses, panelInputStateClasses } from './standards';

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
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const pad = (value: number) => String(value).padStart(2, '0');
const onlyDigits = (value: string) => value.replace(/\D/g, '');
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

const formatDateDisplay = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

const formatDateTimeDisplay = (date: Date) => `${formatDateDisplay(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatDateDraftInput = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

const formatMonthDraftInput = (value: string) => {
  const digits = onlyDigits(value).slice(0, 6);
  const normalizedValue = value.trim();

  if (!digits) return '';

  const slashParts = normalizedValue.split('/');
  const prefersYearFirst =
    normalizedValue.includes('-') ||
    (normalizedValue.includes('/') && slashParts[0]?.length > (slashParts[1]?.length ?? 0)) ||
    (!normalizedValue.includes('/') && digits.length >= 3 && Number(digits.slice(0, 2)) > 12);

  if (prefersYearFirst) {
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 6)}`;
};

const formatDateTimeDraftInput = (value: string) => {
  const digits = onlyDigits(value).slice(0, 12);
  const datePart = formatDateDraftInput(digits.slice(0, 8));
  const timeDigits = digits.slice(8, 12);

  if (!timeDigits) return datePart;
  if (timeDigits.length <= 2) return `${datePart} ${timeDigits}`;
  return `${datePart} ${timeDigits.slice(0, 2)}:${timeDigits.slice(2, 4)}`;
};

const formatPickerDraftInput = (value: string, type: PickerType) => {
  if (type === 'month') return formatMonthDraftInput(value);
  if (type === 'datetime-local') return formatDateTimeDraftInput(value);
  return formatDateDraftInput(value);
};

const formatPickerInputValue = (date: Date, type: PickerType) => {
  if (type === 'month') return `${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  if (type === 'datetime-local') return formatDateTimeDisplay(date);
  return formatDateDisplay(date);
};

const getPickerInputPlaceholder = (type: PickerType) => {
  if (type === 'month') return 'MM/AAAA';
  if (type === 'datetime-local') return 'DD/MM/AAAA HH:MM';
  return 'DD/MM/AAAA';
};

const getPickerAriaLabel = (type: PickerType, placeholder?: string) => {
  if (placeholder) return placeholder;
  if (type === 'month') return 'Selecionar mês';
  if (type === 'datetime-local') return 'Selecionar data e hora';
  return 'Selecionar data';
};

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const normalizeYearInput = (value: string) => value.replace(/\D/g, '').slice(0, 4);

export const getDateTimePickerYearBounds = (minDate: Date | null, maxDate: Date | null) => {
  const minYear = Math.max(YEAR_MIN, minDate?.getFullYear() ?? YEAR_MIN);
  const maxYear = Math.max(minYear, Math.min(YEAR_MAX, maxDate?.getFullYear() ?? YEAR_MAX));

  return {
    min: minYear,
    max: maxYear,
  };
};

export const parseCommittedYearInput = (value: string, minYear = YEAR_MIN, maxYear = YEAR_MAX) => {
  const digits = normalizeYearInput(value);
  if (digits.length !== 4) return null;

  return clampNumber(Number(digits), minYear, Math.max(minYear, maxYear));
};

const addMonths = (date: Date, monthDelta: number) => new Date(date.getFullYear(), date.getMonth() + monthDelta, 1);

const addYears = (date: Date, yearDelta: number) => new Date(date.getFullYear() + yearDelta, date.getMonth(), 1);

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
  const [position, setPosition] = useState<FloatingPanelPosition | null>(null);
  const [manualInputValue, setManualInputValue] = useState('');
  const [isEditingInput, setIsEditingInput] = useState(false);
  const [yearInputValue, setYearInputValue] = useState('');
  const [isEditingYear, setIsEditingYear] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const triggerInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => parseValue(value, type), [type, value]);
  const minDate = useMemo(() => parseValue(min ?? '', type), [min, type]);
  const maxDate = useMemo(() => parseValue(max ?? '', type), [max, type]);
  const yearBounds = useMemo(() => getDateTimePickerYearBounds(minDate, maxDate), [maxDate, minDate]);

  const [viewDate, setViewDate] = useState<Date>(() => {
    const baseDate = selectedDate ?? new Date();
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!selectedDate) return;
    setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  useEffect(() => {
    if (isEditingInput) return;
    setManualInputValue(selectedDate ? formatPickerInputValue(selectedDate, type) : '');
  }, [isEditingInput, selectedDate, type]);

  useEffect(() => {
    if (isEditingYear) return;
    setYearInputValue(String(viewDate.getFullYear()));
  }, [isEditingYear, viewDate]);

  useEffect(() => {
    if (isOpen) return;
    setIsEditingYear(false);
    setYearInputValue(String(viewDate.getFullYear()));
  }, [isOpen, viewDate]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
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

  const updatePosition = () => {
    if (!triggerRef.current) return;

    setPosition(
      calculateFloatingPanelPosition({
        triggerRect: triggerRef.current.getBoundingClientRect(),
        panelWidth: type === 'month' ? 336 : 392,
        panelHeight: type === 'datetime-local' ? 540 : 420,
      }),
    );
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, type, viewDate]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(viewDate),
    [viewDate],
  );

  const calendarDays = useMemo(() => getMonthCalendarDays(viewDate), [viewDate]);

  const isDayDisabled = (day: Date) => {
    const dayStamp = toDateOnlyStamp(day);
    if (minDate && dayStamp < toDateOnlyStamp(minDate)) return true;
    if (maxDate && dayStamp > toDateOnlyStamp(maxDate)) return true;
    return false;
  };

  const isMonthDisabled = (monthIndex: number, year = viewDate.getFullYear()) => {
    const candidate = new Date(year, monthIndex, 1).getTime();
    if (minDate && candidate < new Date(minDate.getFullYear(), minDate.getMonth(), 1).getTime()) return true;
    if (maxDate && candidate > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1).getTime()) return true;
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

  const handleSelectMonth = (monthIndex: number) => {
    if (disabled || isMonthDisabled(monthIndex)) {
      return;
    }

    const nextDate = new Date(viewDate.getFullYear(), monthIndex, 1);
    applyDate(nextDate);
    setViewDate(nextDate);
    setIsOpen(false);
  };

  const applyViewYear = (nextYear: number) => {
    const safeYear = clampNumber(nextYear, yearBounds.min, yearBounds.max);
    setViewDate((current) => new Date(safeYear, current.getMonth(), 1));
    setYearInputValue(String(safeYear));
    return safeYear;
  };

  const handleViewYearChange = (rawValue: string) => {
    const nextValue = normalizeYearInput(rawValue);
    setYearInputValue(nextValue);

    if (nextValue.length !== 4) return;

    const parsedYear = parseCommittedYearInput(nextValue, yearBounds.min, yearBounds.max);
    if (parsedYear === null) return;

    applyViewYear(parsedYear);
  };

  const commitViewYearInput = () => {
    setIsEditingYear(false);

    const parsedYear = parseCommittedYearInput(yearInputValue, yearBounds.min, yearBounds.max);
    if (parsedYear === null) {
      setYearInputValue(String(viewDate.getFullYear()));
      return;
    }

    applyViewYear(parsedYear);
  };

  const resetViewYearInput = () => {
    setIsEditingYear(false);
    setYearInputValue(String(viewDate.getFullYear()));
  };

  const stepViewYear = (yearDelta: number) => {
    setIsEditingYear(false);
    applyViewYear(viewDate.getFullYear() + yearDelta);
  };

  const ensureDateForTime = () => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();

    if (!selectedDate) {
      baseDate.setSeconds(0, 0);
    }

    return baseDate;
  };

  const ensureDateForTypedDateTime = () => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();

    if (!selectedDate) {
      baseDate.setHours(9, 0, 0, 0);
      return baseDate;
    }

    baseDate.setSeconds(0, 0);
    return baseDate;
  };

  const handleTimeChange = (part: 'hours' | 'minutes', rawValue: string) => {
    if (rawValue.trim() === '') return;

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;

    const nextDate = ensureDateForTime();
    if (part === 'hours') {
      nextDate.setHours(clampNumber(parsed, 0, 23));
    } else {
      nextDate.setMinutes(clampNumber(parsed, 0, 59));
    }

    applyDate(nextDate);
  };

  const resetManualInputValue = () => {
    setIsEditingInput(false);
    setManualInputValue(selectedDate ? formatPickerInputValue(selectedDate, type) : '');
  };

  const commitManualInputValue = () => {
    const nextValue = manualInputValue.trim();
    setIsEditingInput(false);

    if (!nextValue) {
      applyDate(null);
      return;
    }

    if (type === 'month') {
      const monthYearMatch = nextValue.match(/^(\d{2})\/(\d{4})$/);
      const yearMonthMatch = nextValue.match(/^(\d{4})[-/](\d{2})$/);

      if (!monthYearMatch && !yearMonthMatch) {
        resetManualInputValue();
        return;
      }

      const monthText = monthYearMatch?.[1] ?? yearMonthMatch?.[2] ?? '';
      const yearText = monthYearMatch?.[2] ?? yearMonthMatch?.[1] ?? '';
      const year = Number(yearText);
      const month = Number(monthText);
      const nextDate = new Date(year, month - 1, 1);

      if (
        month < 1 ||
        month > 12 ||
        Number.isNaN(nextDate.getTime()) ||
        nextDate.getFullYear() !== year ||
        nextDate.getMonth() !== month - 1 ||
        isMonthDisabled(month - 1, year)
      ) {
        resetManualInputValue();
        return;
      }

      applyDate(nextDate);
      setViewDate(new Date(year, month - 1, 1));
      setManualInputValue(formatPickerInputValue(nextDate, type));
      return;
    }

    if (type === 'date') {
      const match = nextValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) {
        resetManualInputValue();
        return;
      }

      const [, dayText, monthText, yearText] = match;
      const day = Number(dayText);
      const month = Number(monthText);
      const year = Number(yearText);
      const nextDate = new Date(year, month - 1, day);

      if (
        Number.isNaN(nextDate.getTime()) ||
        nextDate.getFullYear() !== year ||
        nextDate.getMonth() !== month - 1 ||
        nextDate.getDate() !== day ||
        isDayDisabled(nextDate)
      ) {
        resetManualInputValue();
        return;
      }

      applyDate(nextDate);
      setViewDate(new Date(year, month - 1, 1));
      setManualInputValue(formatPickerInputValue(nextDate, type));
      return;
    }

    const match = nextValue.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
    if (!match) {
      resetManualInputValue();
      return;
    }

    const [, dayText, monthText, yearText, hoursText, minutesText] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const nextDate = ensureDateForTypedDateTime();

    nextDate.setFullYear(year, month - 1, day);

    if (hoursText && minutesText) {
      const hours = Number(hoursText);
      const minutes = Number(minutesText);

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        resetManualInputValue();
        return;
      }

      nextDate.setHours(hours, minutes, 0, 0);
    }

    if (
      Number.isNaN(nextDate.getTime()) ||
      nextDate.getFullYear() !== year ||
      nextDate.getMonth() !== month - 1 ||
      nextDate.getDate() !== day ||
      isDayDisabled(nextDate)
    ) {
      resetManualInputValue();
      return;
    }

    applyDate(nextDate);
    setViewDate(new Date(year, month - 1, 1));
    setManualInputValue(formatPickerInputValue(nextDate, type));
  };

  const selectedHours = selectedDate?.getHours() ?? 9;
  const selectedMinutes = selectedDate?.getMinutes() ?? 0;
  const selectedDayStamp = selectedDate ? toDateOnlyStamp(selectedDate) : null;
  const todayStamp = toDateOnlyStamp(new Date());
  const selectedMonthKey = selectedDate ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}` : null;
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  const themeScopeClassName = useMemo(() => {
    const themedAncestor = triggerRef.current?.closest('.painel-theme');

    if (!themedAncestor) {
      return 'painel-theme theme-light';
    }

    const classes = ['painel-theme'];

    if (themedAncestor.classList.contains('theme-dark')) {
      classes.push('theme-dark');
    } else {
      classes.push('theme-light');
    }

    if (themedAncestor.classList.contains('kifer-ds')) {
      classes.push('kifer-ds');
    }

    return classes.join(' ');
  }, [isOpen]);

  return (
    <div className={cx('relative', className)} ref={containerRef}>
      <div className="relative" ref={triggerRef}>
        <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--panel-text-subtle,#ab927b)]">
          {type === 'datetime-local' ? (
            <Clock className="h-[18px] w-[18px]" />
          ) : (
            <CalendarDays className="h-[18px] w-[18px]" />
          )}
        </span>

        <input
          ref={triggerInputRef}
          type="text"
          disabled={disabled}
          value={manualInputValue}
          onFocus={(event) => {
            setIsEditingInput(true);
            setIsOpen(true);

            if (type === 'month') {
              event.currentTarget.select();
            }
          }}
          onChange={(event) => {
            setIsEditingInput(true);
            setManualInputValue(formatPickerDraftInput(event.target.value, type));
          }}
          onBlur={() => commitManualInputValue()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitManualInputValue();
              if (type !== 'datetime-local') {
                setIsOpen(false);
              }
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              resetManualInputValue();
              setIsOpen(false);
              event.currentTarget.blur();
            }
          }}
          placeholder={getPickerInputPlaceholder(type)}
          aria-label={getPickerAriaLabel(type, placeholder)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={cx(
            panelInputBaseClass,
            panelInputSizeClasses.default,
            panelInputStateClasses.valid,
            'panel-interactive-glass pl-10 pr-11',
            manualInputValue && 'font-medium',
            triggerClassName,
          )}
        />

        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setIsOpen((current) => !current);
            triggerInputRef.current?.focus();
          }}
          className="absolute bottom-0.5 right-0.5 top-0.5 inline-flex w-10 items-center justify-center rounded-r-[calc(0.75rem-2px)] rounded-l-none border-l border-[var(--panel-border-subtle,#e4d5c0)] bg-transparent text-[var(--panel-text-subtle,#ab927b)] transition hover:bg-[color:var(--panel-surface-soft,#efe6d8)] hover:text-[var(--panel-text,#1c1917)] focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={isOpen ? 'Fechar seletor de data' : 'Abrir seletor de data'}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <ChevronDown className={cx('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>

      {isOpen && position && typeof document !== 'undefined'
        ? createPortal(
            <div className={themeScopeClassName}>
              <div
                ref={panelRef}
                className="panel-glass-panel fixed z-[130] flex flex-col overflow-hidden rounded-2xl border shadow-xl"
                style={{
                  top: position.top,
                  left: position.left,
                  width: position.width,
                  maxHeight: position.maxHeight,
                  borderColor: 'color-mix(in srgb, var(--panel-border,#d4c0a7) 92%, transparent)',
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 72%, var(--panel-surface,#fffdfa) 28%) 100%)',
                  boxShadow: '0 22px 52px -28px rgba(40, 20, 8, 0.45)',
                }}
                role="dialog"
                aria-label="Selecionar data"
              >
                <div className="flex min-h-0 flex-col p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-lg p-0"
                    onClick={() => setViewDate((current) => (type === 'month' ? addYears(current, -1) : addMonths(current, -1)))}
                    aria-label={type === 'month' ? 'Ano anterior' : 'Mês anterior'}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <p className="text-sm font-semibold capitalize text-[var(--panel-text,#1c1917)]">{monthLabel}</p>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-lg p-0"
                    onClick={() => setViewDate((current) => (type === 'month' ? addYears(current, 1) : addMonths(current, 1)))}
                    aria-label={type === 'month' ? 'Próximo ano' : 'Próximo mês'}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className={cx('mb-3 grid gap-2', type === 'month' ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_5.5rem]')}>
                  {type !== 'month' ? (
                    <select
                      value={viewDate.getMonth()}
                      onChange={(event) => setViewDate(new Date(viewDate.getFullYear(), Number(event.target.value), 1))}
                      className="panel-ui-input h-9 rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 text-sm text-[var(--panel-input-text,var(--panel-text-soft))] outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)]"
                    >
                      {MONTH_LABELS.map((label, index) => (
                        <option key={label} value={index}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="whitespace-nowrap rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--panel-text-muted,#876f5c)]">
                      Escolha o mês
                    </div>
                  )}

                  <Input
                    size="compact"
                    value={yearInputValue}
                    onChange={(event) => handleViewYearChange(event.target.value)}
                    onFocus={(event) => {
                      setIsEditingYear(true);
                      event.currentTarget.select();
                    }}
                    onBlur={() => commitViewYearInput()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitViewYearInput();
                        return;
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault();
                        resetViewYearInput();
                        event.currentTarget.blur();
                        return;
                      }

                      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
                        event.preventDefault();
                        stepViewYear(event.key === 'PageUp' ? 10 : 1);
                        return;
                      }

                      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
                        event.preventDefault();
                        stepViewYear(event.key === 'PageDown' ? -10 : -1);
                      }
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="Ano"
                    aria-label="Ano"
                    />
                </div>

                <div className="min-h-0 overflow-y-auto pr-1">

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
                            'focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)]',
                            isSelected && 'border-[color:var(--panel-accent-border,#d5a25c)] bg-[var(--panel-accent-hover,#e8c089)] text-[var(--panel-accent-ink-strong,#4a2411)] shadow-sm',
                            !isSelected && isCurrentMonth && 'border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)]/80 text-[var(--panel-accent-ink,#6f3f16)]',
                            !isSelected && !isCurrentMonth && 'border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent-border,#d5a25c)] hover:bg-[var(--panel-surface-soft,#efe6d8)]',
                            disabledMonth && 'cursor-not-allowed opacity-40 hover:border-[var(--panel-border,#d4c0a7)] hover:bg-[var(--panel-surface,#fffdfa)]',
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
                        <span key={label} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-text-muted,#876f5c)]">
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
                              'focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)]',
                              isSelected && 'bg-[var(--panel-accent-hover,#e8c089)] text-[var(--panel-accent-ink-strong,#4a2411)] hover:bg-[var(--panel-accent-hover,#e8c089)]',
                              !isSelected && isToday && 'bg-[var(--panel-surface-soft,#efe6d8)] text-[var(--panel-text,#1c1917)]',
                              !isSelected && !isToday && isSameMonth && 'text-[var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#efe6d8)]',
                              !isSelected && !isToday && !isSameMonth && 'text-[var(--panel-text-subtle,#ab927b)] hover:bg-[var(--panel-surface-soft,#efe6d8)]',
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

                {type === 'datetime-local' ? (
                  <div className="mt-3 border-t border-[var(--panel-border-subtle,#e4d5c0)] pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--panel-text-muted,#876f5c)]">Horário</p>
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
                ) : null}

                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-border-subtle,#e4d5c0)] pt-3">
                  <Button variant="ghost" size="sm" onClick={() => applyDate(null)} disabled={!value} className="px-2">
                    Limpar
                  </Button>

                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
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
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
