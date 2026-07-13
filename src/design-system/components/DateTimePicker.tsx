import { forwardRef, type InputHTMLAttributes } from 'react';

import Input, { type InputProps } from './Input';

export type DateTimePickerProps = Omit<InputProps, 'type'> & {
  /** Uses the browser's native date and time control. */
  type?: Extract<InputHTMLAttributes<HTMLInputElement>['type'], 'date' | 'datetime-local' | 'time'>;
};

export const DateTimePicker = forwardRef<HTMLInputElement, DateTimePickerProps>(function DateTimePicker(
  { type = 'datetime-local', ...props },
  ref,
) {
  return <Input ref={ref} type={type} {...props} />;
});

export default DateTimePicker;
