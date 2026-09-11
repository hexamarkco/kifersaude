import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import { Dialog, DialogHeader, type DialogHeaderProps, type DialogProps } from './Dialog';

export type DrawerSide = 'left' | 'right' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg';

export type DrawerProps = Omit<DialogProps, 'size'> & {
  side?: DrawerSide;
  size?: DrawerSize;
  children: ReactNode;
};

/** A Dialog presentation anchored to a viewport edge. */
export function Drawer({ side = 'right', size = 'md', className, children, ...props }: DrawerProps) {
  return (
    <Dialog
      size="full"
      className={cx('kds-drawer', `kds-drawer-${side}`, `kds-drawer-${size}`, className)}
      {...props}
    >
      {children}
    </Dialog>
  );
}

export type DrawerHeaderProps = DialogHeaderProps;

export function DrawerHeader({ className, ...props }: DrawerHeaderProps) {
  return <DialogHeader className={cx('kds-drawer-header', className)} {...props} />;
}

export type DrawerBodyProps = HTMLAttributes<HTMLDivElement>;

export function DrawerBody({ className, ...props }: DrawerBodyProps) {
  return <div className={cx('kds-drawer-body', className)} {...props} />;
}

export type DrawerFooterProps = HTMLAttributes<HTMLDivElement>;

export function DrawerFooter({ className, ...props }: DrawerFooterProps) {
  return <div className={cx('kds-drawer-footer', className)} {...props} />;
}
