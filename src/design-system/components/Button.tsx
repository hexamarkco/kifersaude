import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

import { cx } from '../../lib/cx';
import {
  getPanelButtonClass,
  panelIconButtonSizeClasses,
  panelButtonSpinnerSizeClasses,
  type ControlSize,
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
      data-loading={loading || undefined}
      className={getPanelButtonClass({
        variant,
        size,
        fullWidth,
        className,
      })}
      {...props}
    >
      {loading && <Loader2 className={cx('kds-button-spinner animate-spin', panelButtonSpinnerSizeClasses[size])} aria-hidden="true" />}
      <span className="kds-button-content">{children}</span>
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

export type IconButtonProps = Omit<ButtonProps, 'size'> & {
  size?: ControlSize;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'icon', size = 'md', children, className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cx('kds-icon-button shrink-0 p-0', panelIconButtonSizeClasses[size], className)}
      {...props}
    >
      {children}
    </Button>
  );
});

export default Button;
