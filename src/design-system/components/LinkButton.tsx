import { type AnchorHTMLAttributes } from 'react';

import { getPanelButtonClass, type PanelButtonSize, type PanelButtonVariant } from '../tokens';

export type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: PanelButtonVariant;
  size?: PanelButtonSize;
};

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <a
      className={getPanelButtonClass({ variant, size, className })}
      {...props}
    >
      {children}
    </a>
  );
}
