import { HTMLAttributes } from 'react';

type SkeletonVariant = 'block' | 'line' | 'avatar';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
};

const baseStyles = 'relative overflow-hidden animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200';
const variantStyles: Record<SkeletonVariant, string> = {
  block: 'rounded-2xl',
  line: 'rounded-full',
  avatar: 'rounded-full'
};

export function Skeleton({ variant = 'block', className = '', ...props }: SkeletonProps) {
  const classes = [baseStyles, variantStyles[variant], className].filter(Boolean).join(' ');
  return <div className={classes} {...props} />;
}

export default Skeleton;
