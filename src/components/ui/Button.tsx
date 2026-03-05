import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/cx';
import {
  getPanelButtonClass,
  panelButtonSpinnerSizeClasses,
  type PanelButtonSize,
  type PanelButtonVariant,
} from './standards';

export type ButtonVariant = PanelButtonVariant;
export type ButtonSize = PanelButtonSize;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    disabled,
    className,
    children,
    type,
    ...props
  },
  ref,
) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={isDisabled}
      className={getPanelButtonClass({
        variant,
        size,
        fullWidth,
        className,
      })}
      {...props}
    >
      {loading && <Loader2 className={cx('animate-spin', panelButtonSpinnerSizeClasses[size])} aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
