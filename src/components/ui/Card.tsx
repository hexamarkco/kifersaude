import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type CardVariant = 'default' | 'glass' | 'strong' | 'interactive';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
};

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white border border-slate-200 shadow-sm',
  glass: 'panel-glass-panel border border-slate-200 bg-white',
  strong: 'panel-glass-strong border border-slate-200 bg-white',
  interactive: 'panel-glass-panel panel-interactive-glass border border-slate-200 bg-white hover:-translate-y-0.5',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div className={cx('rounded-xl', variantClasses[variant], paddingClasses[padding], className)} {...props}>
      {children}
    </div>
  );
}
