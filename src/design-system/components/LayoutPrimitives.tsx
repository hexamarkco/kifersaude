import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type LayoutElement = 'div' | 'section' | 'article' | 'header' | 'footer' | 'main' | 'nav' | 'ul' | 'ol';
export type LayoutGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type LayoutAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type LayoutJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export type StackProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  as?: LayoutElement;
  gap?: LayoutGap;
  align?: LayoutAlign;
  justify?: LayoutJustify;
  children: ReactNode;
};

export function Stack({
  as: Component = 'div',
  gap = 'md',
  align,
  justify,
  className,
  children,
  ...props
}: StackProps) {
  return (
    <Component
      className={cx(
        'kds-stack',
        `kds-stack-gap-${gap}`,
        align && `kds-stack-align-${align}`,
        justify && `kds-stack-justify-${justify}`,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export type InlineProps = StackProps & {
  wrap?: boolean;
};

export function Inline({ wrap = true, className, ...props }: InlineProps) {
  return (
    <Stack
      {...props}
      className={cx('kds-inline', wrap && 'kds-inline-wrap', className)}
    />
  );
}
