import { HTMLAttributes } from 'react';

type SkeletonVariant = 'block' | 'line' | 'avatar';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
};

const baseStyles = 'panel-skeleton relative overflow-hidden';
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
