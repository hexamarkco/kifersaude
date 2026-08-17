import { DateTimePicker as DesignSystemDateTimePicker } from '../../design-system';

type PickerType = 'date' | 'datetime-local' | 'time';

type DateTimePickerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  type?: PickerType;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
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
  return (
    <DesignSystemDateTimePicker
      {...props}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={[className, triggerClassName].filter(Boolean).join(' ')}
    />
  );
}
