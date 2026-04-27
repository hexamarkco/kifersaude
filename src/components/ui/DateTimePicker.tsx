import { useRef, type InputHTMLAttributes } from 'react';
import { CalendarDays, ChevronDown, Clock } from 'lucide-react';

import { cx } from '../../lib/cx';
import { panelInputBaseClass, panelInputSizeClasses, panelInputStateClasses } from './standards';

type PickerType = 'date' | 'datetime-local' | 'month';

type NativeDateTimePickerProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type' | 'value' | 'onChange'
>;

type DateTimePickerProps = NativeDateTimePickerProps & {
  value: string;
  onChange: (nextValue: string) => void;
  type?: PickerType;
  className?: string;
  triggerClassName?: string;
};

const getPickerAriaLabel = (type: PickerType, placeholder?: string) => {
  if (placeholder) return placeholder;
  if (type === 'month') return 'Selecionar mês';
  if (type === 'datetime-local') return 'Selecionar data e hora';
  return 'Selecionar data';
};

const canShowPicker = (
  input: HTMLInputElement | null,
): input is HTMLInputElement & { showPicker: () => void } => typeof input?.showPicker === 'function';

export default function DateTimePicker({
  value,
  onChange,
  type = 'date',
  placeholder,
  disabled = false,
  className,
  triggerClassName,
  onClick,
  ...rest
}: DateTimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openNativePicker = () => {
    const input = inputRef.current;
    if (!input || disabled) {
      return;
    }

    input.focus();

    if (canShowPicker(input)) {
      try {
        input.showPicker();
      } catch {
        // Some browsers restrict showPicker outside trusted interactions.
      }
    }
  };

  return (
    <div className={cx('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--panel-text-subtle,#ab927b)]">
        {type === 'datetime-local' ? (
          <Clock className="h-[18px] w-[18px]" />
        ) : (
          <CalendarDays className="h-[18px] w-[18px]" />
        )}
      </span>

      <input
        {...rest}
        ref={inputRef}
        type={type}
        lang="pt-BR"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => {
          onClick?.(event);
        }}
        placeholder={placeholder}
        aria-label={getPickerAriaLabel(type, placeholder)}
        className={cx(
          panelInputBaseClass,
          panelInputSizeClasses.default,
          panelInputStateClasses.valid,
          'panel-interactive-glass pl-10 pr-11',
          triggerClassName,
        )}
      />

      <button
        type="button"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={openNativePicker}
        className="absolute bottom-0.5 right-0.5 top-0.5 inline-flex w-10 items-center justify-center rounded-r-[calc(0.75rem-2px)] rounded-l-none border-l border-[var(--panel-border-subtle,#e4d5c0)] bg-transparent text-[var(--panel-text-subtle,#ab927b)] transition hover:bg-[color:var(--panel-surface-soft,#efe6d8)] hover:text-[var(--panel-text,#1c1917)] focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Abrir seletor nativo de data"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
