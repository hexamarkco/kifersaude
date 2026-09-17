import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import type { TextTone } from './Typography';

export type TextLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  tone?: Extract<TextTone, 'primary' | 'secondary' | 'muted' | 'brand' | 'inverse' | 'danger'>;
  underline?: boolean;
  external?: boolean;
  children: ReactNode;
};

export function TextLink({
  tone = 'brand',
  underline = false,
  external = false,
  className,
  children,
  target,
  rel,
  ...props
}: TextLinkProps) {
  return (
    <a
      target={external ? '_blank' : target}
      rel={external ? rel ?? 'noopener noreferrer' : rel}
      className={cx('kds-text-link', `kds-text-link-${tone}`, underline && 'kds-text-link-underlined', className)}
      {...props}
    >
      {children}
    </a>
  );
}

export const ExternalLink = TextLink;
