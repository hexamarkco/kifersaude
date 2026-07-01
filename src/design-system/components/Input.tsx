import { forwardRef, type ChangeEvent, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Search, type LucideIcon } from 'lucide-react';

import { cx } from '../../lib/cx';
import { formatInputValue, type InputAutoFormat } from '../../lib/inputFormatters';
import {
  panelInputBaseClass,
  panelInputIconSizeClasses,
  panelInputSizeClasses,
  panelInputStateClasses,
  type PanelInputState,
  type PanelInputSize,
} from '../tokens';

export type InputSize = PanelInputSize;
export type InputState = PanelInputState;

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: InputSize;
  invalid?: boolean;
  state?: InputState;
  leftIcon?: LucideIcon;
  prefix?: ReactNode;
  suffix?: ReactNode;
  rightSlot?: ReactNode;
  action?: ReactNode;
  autoFormat?: InputAutoFormat;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'default',
    invalid = false,
    state = 'default',
    leftIcon: LeftIcon,
    prefix,
    suffix,
    rightSlot,
    action,
    autoFormat,
    className,
    disabled,
    onChange,
    ...props
  },
  ref,
) {
  const hasLeftAdornment = Boolean(LeftIcon || prefix);
  const hasRightAdornment = Boolean(suffix || rightSlot || action);
  const resolvedState: PanelInputState = invalid ? 'error' : state;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!autoFormat) {
      onChange?.(event);
      return;
    }

    const formattedValue = formatInputValue(event.target.value, autoFormat);
    const formattedEvent = {
      ...event,
      target: { ...event.target, value: formattedValue },
      currentTarget: { ...event.currentTarget, value: formattedValue },
    } as ChangeEvent<HTMLInputElement>;

    onChange?.(formattedEvent);
  };

  return (
    <div className="kds-input-shell">
      {LeftIcon && (
        <LeftIcon
          className={cx(
            'kds-input-icon kds-input-icon-left',
            panelInputIconSizeClasses[size],
          )}
          aria-hidden="true"
        />
      )}
      {!LeftIcon && prefix && <span className="kds-input-slot kds-input-prefix">{prefix}</span>}
      <input
        ref={ref}
        disabled={disabled}
        onChange={handleChange}
        className={cx(
          panelInputBaseClass,
          panelInputSizeClasses[size],
          hasLeftAdornment && (size === 'compact' ? 'pl-8' : 'pl-10'),
          hasRightAdornment && (size === 'compact' ? 'pr-8' : 'pr-10'),
          panelInputStateClasses[resolvedState],
          className,
        )}
        {...props}
      />
      {(suffix || rightSlot || action) && (
        <span
          className={cx('kds-input-slot kds-input-suffix', Boolean(action) && 'pointer-events-auto')}
          aria-hidden={action ? undefined : 'true'}
        >
          {action ?? suffix ?? rightSlot}
        </span>
      )}
    </div>
  );
});

export type InputGroupProps = HTMLAttributes<HTMLDivElement>;

export function InputGroup({ className, children, ...props }: InputGroupProps) {
  return (
    <div className={cx('kds-input-group', className)} {...props}>
      {children}
    </div>
  );
}

export type InputAddonProps = HTMLAttributes<HTMLDivElement>;

export function InputAddon({ className, children, ...props }: InputAddonProps) {
  return (
    <div className={cx('kds-input-addon px-3', className)} {...props}>
      {children}
    </div>
  );
}

export const SearchInput = forwardRef<HTMLInputElement, Omit<InputProps, 'leftIcon' | 'type'>>(function SearchInput(
  props,
  ref,
) {
  return <Input ref={ref} type="search" leftIcon={Search} {...props} />;
});

export default Input;
