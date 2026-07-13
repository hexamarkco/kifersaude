import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import { Dialog, type DialogProps } from './Dialog';

export type DrawerSide = 'left' | 'right' | 'bottom';

export type DrawerProps = Omit<DialogProps, 'size'> & {
  side?: DrawerSide;
  children: ReactNode;
};

/** A Dialog presentation anchored to a viewport edge. */
export function Drawer({ side = 'right', className, children, ...props }: DrawerProps) {
  return (
    <Dialog
      size="full"
      className={cx('kds-drawer', `kds-drawer-${side}`, className)}
      {...props}
    >
      {children}
    </Dialog>
  );
}

export type DrawerHeaderProps = HTMLAttributes<HTMLDivElement>;

export function DrawerHeader({ className, ...props }: DrawerHeaderProps) {
  return <div className={cx('kds-drawer-header', className)} {...props} />;
}

export type DrawerBodyProps = HTMLAttributes<HTMLDivElement>;

export function DrawerBody({ className, ...props }: DrawerBodyProps) {
  return <div className={cx('kds-drawer-body', className)} {...props} />;
}

export type DrawerFooterProps = HTMLAttributes<HTMLDivElement>;

export function DrawerFooter({ className, ...props }: DrawerFooterProps) {
  return <div className={cx('kds-drawer-footer', className)} {...props} />;
}
