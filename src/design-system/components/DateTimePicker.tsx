import { forwardRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import Button from './Button';
import Input from './Input';
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
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
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
    size = 'md',
    className,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
    'aria-invalid': ariaInvalid,
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

  const [step, setStep] = useState<'date' | 'hour' | 'minute'>('date');
  const [draftDate, setDraftDate] = useState<DateParts>(todayParts);
  const [draftHour, setDraftHour] = useState(0);
  const [draftMinute, setDraftMinute] = useState('00');
  const activeDay = draftDate;
  const timeBoundary = (boundary: string | undefined) => type === 'time'
    ? parseTimeParts(boundary ?? '') : null;
  const lowerTime = type === 'time' ? timeBoundary(min) : minDate && isSameDate(activeDay, minDate) ? minTime : null;
  const upperTime = type === 'time' ? timeBoundary(max) : maxDate && isSameDate(activeDay, maxDate) ? maxTime : null;
  const isHourDisabled = (hour: number) => Boolean(
    (lowerTime && hour < lowerTime.hour) || (upperTime && hour > upperTime.hour),
  );
  const isMinuteDisabled = (hour: number, minute: number) => Boolean(
    (lowerTime && hour === lowerTime.hour && minute < lowerTime.minute)
    || (upperTime && hour === upperTime.hour && minute > upperTime.minute),
  );
  const minute = Number(draftMinute);
  const validTime = (type === 'time' || !isDateDisabled(draftDate)) && draftMinute !== '' && Number.isInteger(minute) && minute >= 0 && minute <= 59
    && !isHourDisabled(draftHour) && !isMinuteDisabled(draftHour, minute);

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      const base = selectedDate ?? todayParts();
      setDraftDate(base);
      setViewYear(base.year);
      setViewMonth(base.month);
      setDraftHour(selectedTime?.hour ?? 0);
      setDraftMinute(String(selectedTime?.minute ?? 0).padStart(2, '0'));
      setStep(type === 'time' ? 'hour' : 'date');
    }
    setOpen(nextOpen);
  };
  const commit = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.({ target: { value: nextValue, name } });
  };
  const commitDate = (parts: DateParts) => {
    if (type === 'date') {
      commit(formatDateValue(parts));
      setOpen(false);
    } else {
      setDraftDate(parts);
      setStep('hour');
    }
  };
  const confirmTime = () => {
    if (!validTime) return;
    const time = formatTimeValue({ hour: draftHour, minute });
    commit(type === 'time' ? time : `${formatDateValue(draftDate)}T${time}`);
    setOpen(false);
  };
  const handleClear = () => { commit(''); setOpen(false); };
  const handleToday = () => {
    if (type !== 'time') { commitDate(todayParts()); return; }
    const now = new Date();
    setDraftHour(now.getHours());
    setDraftMinute(String(now.getMinutes()).padStart(2, '0'));
    setStep('minute');
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

  const showCalendar = step === 'date';
  const showTime = step !== 'date';
  const TriggerIcon = type === 'time' ? Clock : Calendar;
  const monthMatrix = buildMonthMatrix(viewYear, viewMonth);
  const today = todayParts();

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger className="kds-dp-trigger-wrap block w-full">
        <button
          ref={ref}
          type="button"
          id={id}
          disabled={disabled}
          aria-required={required || undefined}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={ariaInvalid}
          className={cx(
            panelInputBaseClass,
            panelInputSizeClasses[size],
            'kds-dp-trigger flex items-center text-left',
            className,
          )}
        >
          <TriggerIcon className="kds-control-icon shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className={cx('min-w-0 flex-1 truncate', !displayLabel && 'text-[var(--text-muted)]')}>
            {displayLabel || placeholder || 'Selecionar'}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="kds-dp-popover" aria-label={type === 'time' ? 'Selecionar horário' : 'Selecionar data'}>
        {type !== 'date' && (
          <div className="kds-dp-steps" aria-label="Etapas da seleção">
            {type !== 'time' && <button type="button" aria-current={step === 'date' ? 'step' : undefined} onClick={() => setStep('date')}>Data</button>}
            <button type="button" aria-current={step === 'hour' ? 'step' : undefined} onClick={() => setStep('hour')}>Hora</button>
            <button type="button" aria-current={step === 'minute' ? 'step' : undefined} onClick={() => setStep('minute')}>Minutos</button>
          </div>
        )}
        {showCalendar && (
          <div className="kds-dp-calendar">
            <div className="kds-dp-calendar-header">
              <button type="button" onClick={goToPrevMonth} className="kds-dp-nav-button" aria-label="Mês anterior">
                <ChevronLeft aria-hidden="true" />
              </button>
              <span className="kds-dp-calendar-title">
                {MONTH_LABELS_PT[viewMonth - 1]} de {viewYear}
              </span>
              <button type="button" onClick={goToNextMonth} className="kds-dp-nav-button" aria-label="Próximo mês">
                <ChevronRight aria-hidden="true" />
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
                const isSelected = isSameDate(type === 'date' ? selectedDate : draftDate, cellParts);
                const isToday = isSameDate(today, cellParts);
                const isDisabled = isDateDisabled(cellParts);

                return (
                  <button
                    key={`${cell.year}-${cell.month}-${cell.day}-${cell.inCurrentMonth}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => commitDate(cellParts)}
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
          <div className="kds-dp-time-step">
            <p className="kds-dp-step-title" aria-live="polite">
              {step === 'hour' ? 'Escolha a hora' : `Minutos para ${String(draftHour).padStart(2, '0')}h`}
              {type !== 'time' && <span>{formatDateDisplay(draftDate)}</span>}
            </p>
            {step === 'hour' ? (
              <div className="kds-dp-time-grid" aria-label="Horas">
                {HOURS.map((hour) => <button key={hour} type="button" disabled={isHourDisabled(hour)}
                  aria-label={`${String(hour).padStart(2, '0')} horas`} aria-pressed={draftHour === hour}
                  className={cx('kds-dp-time-option', draftHour === hour && 'kds-dp-time-option-selected')}
                  onClick={() => { setDraftHour(hour); setStep('minute'); }}>
                  {String(hour).padStart(2, '0')}
                </button>)}
              </div>
            ) : (
              <>
                <Input type="number" aria-label="Minuto exato" min={0} max={59} step={1}
                  value={draftMinute} onChange={(event) => setDraftMinute(event.target.value)}
                  aria-invalid={!validTime} />
                <div className="kds-dp-time-grid" aria-label="Sugestões de minutos">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((value) => (
                    <button key={value} type="button" disabled={isMinuteDisabled(draftHour, value)}
                      aria-label={`${String(value).padStart(2, '0')} minutos`} aria-pressed={minute === value}
                      className={cx('kds-dp-time-option', minute === value && 'kds-dp-time-option-selected')}
                      onClick={() => setDraftMinute(String(value).padStart(2, '0'))}>
                      {String(value).padStart(2, '0')}
                    </button>
                  ))}
                </div>
                {!validTime && <p role="alert">Informe um minuto permitido, de 00 a 59.</p>}
                <div className="kds-dp-step-actions">
                  <Button variant="tertiary" size="sm" onClick={() => setStep('hour')}>Voltar</Button>
                  <Button size="sm" disabled={!validTime} onClick={confirmTime}>Confirmar horário</Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="kds-dp-footer">
          <button type="button" onClick={handleClear} className="kds-dp-footer-button">
            Limpar
          </button>
          <button type="button" disabled={type !== 'time' && isDateDisabled(today)} onClick={handleToday} className="kds-dp-footer-button kds-dp-footer-button-accent">
            {type === 'time' ? 'Agora' : 'Hoje'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default DateTimePicker;
