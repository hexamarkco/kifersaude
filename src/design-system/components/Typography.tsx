import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type TextTone = 'primary' | 'secondary' | 'muted' | 'subtle' | 'inverse' | 'brand' | 'danger' | 'success' | 'warning';
export type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const toneClass = (tone: TextTone) => `kds-text-tone-${tone}`;

export type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: 'display' | 'xl' | 'lg' | 'md' | 'sm';
  tone?: TextTone;
  children: ReactNode;
};

export function Heading({
  level = 2,
  size,
  tone = 'primary',
  className,
  children,
  ...props
}: HeadingProps) {
  const Component: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const resolvedSize = size ?? (level === 1 ? 'display' : level === 2 ? 'xl' : level === 3 ? 'lg' : 'md');

  return (
    <Component
      className={cx('kds-heading', `kds-heading-${resolvedSize}`, toneClass(tone), className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export type TextProps = HTMLAttributes<HTMLElement> & {
  as?: 'p' | 'span' | 'div' | 'label' | 'small';
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  children: ReactNode;
};

export function Text({
  as: Component = 'p',
  size = 'md',
  tone = 'secondary',
  weight = 'regular',
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Component
      className={cx(
        'kds-text',
        `kds-text-${size}`,
        `kds-text-weight-${weight}`,
        toneClass(tone),
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
