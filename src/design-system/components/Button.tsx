import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

import { cx } from '../../lib/cx';
import {
  getPanelButtonClass,
  panelButtonSpinnerSizeClasses,
  type PanelButtonSize,
  type PanelButtonVariant,
} from '../tokens';

export type ButtonVariant = PanelButtonVariant;
export type ButtonSize = PanelButtonSize;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
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
      aria-busy={loading || undefined}
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

export type ButtonGroupProps = HTMLAttributes<HTMLDivElement>;

export function ButtonGroup({ className, children, ...props }: ButtonGroupProps) {
  return (
    <div className={cx('kds-button-group', className)} {...props}>
      {children}
    </div>
  );
}

export const LoadingButton = Button;

export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'size'>>(function IconButton(
  { variant = 'icon', children, ...props },
  ref,
) {
  return (
    <Button ref={ref} variant={variant} size="icon" {...props}>
      {children}
    </Button>
  );
});

export default Button;
