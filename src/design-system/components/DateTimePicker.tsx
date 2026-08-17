import { forwardRef, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import { cx } from '../../lib/cx';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { panelInputBaseClass, panelInputSizeClasses, type PanelInputSize } from '../tokens';
import {
  buildMonthMatrix,
  compareDateParts,
  formatDateDisplay,
  formatDateValue,
  formatTimeValue,
  HOURS,
  MINUTES,
  MONTH_LABELS_PT,
  WEEKDAY_LABELS_PT,
  isSameDate,
  parseDateParts,
  parseTimeParts,
  splitDateAndTime,
  todayParts,
  type DateParts,
} from './dateTimePickerCalendar';

export type DateTimePickerType = 'date' | 'datetime-local' | 'time';

export type DateTimePickerProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  type?: DateTimePickerType;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  size?: PanelInputSize;
  className?: string;
};

export const DateTimePicker = forwardRef<HTMLButtonElement, DateTimePickerProps>(function DateTimePicker(
  {
    value,
    defaultValue,
    onChange,
    type = 'datetime-local',
    placeholder,
    disabled,
    required,
    min,
    max,
    id,
    name,
    size = 'default',
    className,
  },
  ref,
) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? '');
  const currentValue = isControlled ? value ?? '' : internalValue;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => todayParts().year);
  const [viewMonth, setViewMonth] = useState(() => todayParts().month);

  const { datePart, timePart } = type === 'time'
    ? { datePart: '', timePart: currentValue }
    : splitDateAndTime(currentValue);

  const selectedDate = type === 'time' ? null : parseDateParts(datePart);
  const selectedTime = type === 'date' ? null : parseTimeParts(timePart);

  const minParts = min ? splitDateAndTime(min) : null;
  const maxParts = max ? splitDateAndTime(max) : null;
  const minDate = minParts ? parseDateParts(minParts.datePart) : null;
  const maxDate = maxParts ? parseDateParts(maxParts.datePart) : null;
  const minTime = minParts ? parseTimeParts(minParts.timePart) : null;
  const maxTime = maxParts ? parseTimeParts(maxParts.timePart) : null;

  const isDateDisabled = (parts: DateParts) => {
    if (minDate && compareDateParts(parts, minDate) < 0) return true;
    if (maxDate && compareDateParts(parts, maxDate) > 0) return true;
    return false;
  };

  const activeDay = selectedDate ?? todayParts();
  const isHourDisabled = (hour: number) => {
    if (minDate && minTime && isSameDate(activeDay, minDate) && hour < minTime.hour) return true;
    if (maxDate && maxTime && isSameDate(activeDay, maxDate) && hour > maxTime.hour) return true;
    return false;
  };
  const isMinuteDisabled = (hour: number | undefined, minute: number) => {
    if (hour === undefined) return false;
    if (minDate && minTime && isSameDate(activeDay, minDate) && hour === minTime.hour && minute < minTime.minute) return true;
    if (maxDate && maxTime && isSameDate(activeDay, maxDate) && hour === maxTime.hour && minute > maxTime.minute) return true;
    return false;
  };

  useEffect(() => {
    if (!open) return;
    const base = selectedDate ?? todayParts();
    setViewYear(base.year);
    setViewMonth(base.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.({ target: { value: nextValue, name } });
  };

  const commitDate = (parts: DateParts, closeAfter: boolean) => {
    const datePartValue = formatDateValue(parts);
    if (type === 'date') {
      commit(datePartValue);
    } else {
      const timeValue = selectedTime ? formatTimeValue(selectedTime) : '00:00';
      commit(`${datePartValue}T${timeValue}`);
    }
    if (closeAfter) setOpen(false);
  };

  const commitTime = (hour: number, minute: number) => {
    if (type === 'time') {
      commit(formatTimeValue({ hour, minute }));
    } else {
      const dateValue = selectedDate ?? todayParts();
      commit(`${formatDateValue(dateValue)}T${formatTimeValue({ hour, minute })}`);
    }
  };

  const handleClear = () => {
    commit('');
    setOpen(false);
  };

  const handleToday = () => {
    commitDate(todayParts(), type === 'date');
  };

  const goToPrevMonth = () => {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  };

  const goToNextMonth = () => {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  };

  let displayLabel = '';
  if (type === 'date' && selectedDate) displayLabel = formatDateDisplay(selectedDate);
  if (type === 'time' && selectedTime) displayLabel = formatTimeValue(selectedTime);
  if (type === 'datetime-local' && selectedDate && selectedTime) {
    displayLabel = `${formatDateDisplay(selectedDate)} ${formatTimeValue(selectedTime)}`;
  }

  const showCalendar = type === 'date' || type === 'datetime-local';
  const showTime = type === 'time' || type === 'datetime-local';
  const TriggerIcon = type === 'time' ? Clock : Calendar;
  const monthMatrix = buildMonthMatrix(viewYear, viewMonth);
  const today = todayParts();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="kds-dp-trigger-wrap block w-full">
        <button
          ref={ref}
          type="button"
          id={id}
          disabled={disabled}
          aria-required={required || undefined}
          className={cx(
            panelInputBaseClass,
            panelInputSizeClasses[size],
            'kds-dp-trigger flex items-center gap-2 text-left',
            className,
          )}
        >
          <TriggerIcon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className={cx('min-w-0 flex-1 truncate', !displayLabel && 'text-[var(--text-muted)]')}>
            {displayLabel || placeholder || 'Selecionar'}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="kds-dp-popover" aria-label="Selecionar data">
        {showCalendar && (
          <div className="kds-dp-calendar">
            <div className="kds-dp-calendar-header">
              <button type="button" onClick={goToPrevMonth} className="kds-dp-nav-button" aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="kds-dp-calendar-title">
                {MONTH_LABELS_PT[viewMonth - 1]} de {viewYear}
              </span>
              <button type="button" onClick={goToNextMonth} className="kds-dp-nav-button" aria-label="Proximo mes">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="kds-dp-weekdays">
              {WEEKDAY_LABELS_PT.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>

            <div className="kds-dp-days">
              {monthMatrix.map((cell) => {
                const cellParts: DateParts = { year: cell.year, month: cell.month, day: cell.day };
                const isSelected = isSameDate(selectedDate, cellParts);
                const isToday = isSameDate(today, cellParts);
                const isDisabled = isDateDisabled(cellParts);

                return (
                  <button
                    key={`${cell.year}-${cell.month}-${cell.day}-${cell.inCurrentMonth}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => commitDate(cellParts, type === 'date')}
                    className={cx(
                      'kds-dp-day',
                      !cell.inCurrentMonth && 'kds-dp-day-outside',
                      isSelected && 'kds-dp-day-selected',
                      isToday && !isSelected && 'kds-dp-day-today',
                      isDisabled && 'kds-dp-day-disabled',
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showTime && (
          <div className={cx('kds-dp-time', showCalendar && 'kds-dp-time-divider')}>
            <TimeColumn
              values={HOURS}
              selected={selectedTime?.hour}
              isDisabled={isHourDisabled}
              onSelect={(hour) => commitTime(hour, selectedTime?.minute ?? 0)}
            />
            <span className="kds-dp-time-sep">:</span>
            <TimeColumn
              values={MINUTES}
              selected={selectedTime?.minute}
              isDisabled={(minute) => isMinuteDisabled(selectedTime?.hour ?? 0, minute)}
              onSelect={(minute) => {
                commitTime(selectedTime?.hour ?? 0, minute);
                if (type === 'time') setOpen(false);
              }}
            />
          </div>
        )}

        <div className="kds-dp-footer">
          <button type="button" onClick={handleClear} className="kds-dp-footer-button">
            Limpar
          </button>
          <button type="button" onClick={handleToday} className="kds-dp-footer-button kds-dp-footer-button-accent">
            {type === 'time' ? 'Agora' : 'Hoje'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
});

function TimeColumn({
  values,
  selected,
  isDisabled,
  onSelect,
}: {
  values: number[];
  selected: number | undefined;
  isDisabled?: (value: number) => boolean;
  onSelect: (value: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div ref={listRef} className="kds-dp-time-column">
      {values.map((value) => {
        const isSelected = value === selected;
        const disabled = isDisabled?.(value) ?? false;
        return (
          <button
            key={value}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(value)}
            className={cx(
              'kds-dp-time-option',
              isSelected && 'kds-dp-time-option-selected',
              disabled && 'kds-dp-time-option-disabled',
            )}
          >
            {String(value).padStart(2, '0')}
          </button>
        );
      })}
    </div>
  );
}

export default DateTimePicker;
