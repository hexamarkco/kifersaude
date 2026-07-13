import { useRef, type InputHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

import { DateTimePicker as DesignSystemDateTimePicker } from '../../design-system';

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

/** Preserves the legacy string callback while delegating control rendering to the DS. */
export default function DateTimePicker({
  value,
  onChange,
  type = 'date',
  className,
  triggerClassName,
  ...props
}: DateTimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openNativePicker = () => {
    const input = inputRef.current;
    if (!input || input.disabled) return;

    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Browsers can restrict native pickers to direct user interactions.
      }
    }
  };

  return (
    <DesignSystemDateTimePicker
      {...props}
      ref={inputRef}
      type={type as 'date' | 'datetime-local'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={[className, triggerClassName].filter(Boolean).join(' ')}
      action={
        <button
          type="button"
          disabled={props.disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openNativePicker}
          className="kds-date-picker-button"
          aria-label="Abrir seletor nativo de data"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      }
    />
  );
}
