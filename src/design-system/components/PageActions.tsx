import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Button, { type ButtonProps } from './Button';
import { cx } from '../../lib/cx';

export type PageAction = Pick<
  ButtonProps,
  'onClick' | 'disabled' | 'loading' | 'type' | 'form'
> & { label: string; icon?: LucideIcon };
export type PageActionsProps = {
  primary?: PageAction;
  secondary?: readonly PageAction[];
  destructive?: PageAction;
  message?: ReactNode;
  placement?: 'header' | 'form';
  sticky?: boolean;
  busy?: boolean;
};

/** One ordering rule for every page: destructive isolated, secondary before primary. */
export function PageActions({
  primary,
  secondary = [],
  destructive,
  message,
  placement = 'header',
  sticky = false,
  busy = false,
}: PageActionsProps) {
  const pending =
    busy ||
    Boolean(primary?.loading) ||
    Boolean(destructive?.loading) ||
    secondary.some((item) => item.loading);
  const action = (item: PageAction, variant: ButtonProps['variant']) => {
    const { label, icon: Icon, disabled, ...props } = item;
    return (
      <Button
        key={label}
        variant={variant}
        {...props}
        disabled={disabled || pending}
      >
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </Button>
    );
  };
  return (
    <div
      className={cx(
        'kds-page-action-bar',
        `kds-page-action-bar-${placement}`,
        sticky && 'kds-page-action-bar-sticky',
      )}
    >
      {message && <div className="kds-page-action-message">{message}</div>}
      {destructive && (
        <div className="kds-page-action-destructive">
          {action(destructive, 'destructive')}
        </div>
      )}
      <div
        className="kds-page-action-buttons"
        role="group"
        aria-label={
          placement === 'form' ? 'Ações do formulário' : 'Ações da página'
        }
      >
        {secondary.map((item) => action(item, 'secondary'))}
        {primary && action(primary, 'primary')}
      </div>
    </div>
  );
}
