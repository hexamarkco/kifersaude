import { useState, type ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type AvatarProps = {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
  fallback?: ReactNode;
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'var(--brand-primary)',
    'var(--accent-gold)',
    'var(--accent-copper)',
    'var(--success)',
    'var(--info)',
    'var(--purple)',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({
  src,
  alt,
  name,
  size = 'md',
  className,
  fallback,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;

  return (
    <div
      className={cx('kds-avatar', `kds-avatar-${size}`, className)}
      style={!showImage && name ? { backgroundColor: hashColor(name) } : undefined}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? name ?? ''}
          className="kds-avatar-image"
          onError={() => setImgError(true)}
        />
      ) : fallback ? (
        <span className="kds-avatar-fallback">{fallback}</span>
      ) : name ? (
        <span className="kds-avatar-initials">{getInitials(name)}</span>
      ) : null}
    </div>
  );
}

export type AvatarGroupProps = {
  children: ReactNode;
  max?: number;
  size?: AvatarSize;
  className?: string;
};

export function AvatarGroup({ children, max = 3, size = 'md', className }: AvatarGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const visible = childArray.slice(0, max);
  const remaining = childArray.length - max;

  return (
    <div className={cx('kds-avatar-group', className)}>
      {visible.map((child, index) => (
        <div key={index} className="kds-avatar-group-item">
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="kds-avatar-group-item">
          <div className={cx('kds-avatar kds-avatar-overflow', `kds-avatar-${size}`)}>
            <span className="kds-avatar-initials">+{remaining}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export type AvatarBadgeProps = {
  children: ReactNode;
  position?: 'top-right' | 'bottom-right';
  className?: string;
};

export function AvatarBadge({ children, position = 'bottom-right', className }: AvatarBadgeProps) {
  return (
    <span
      className={cx(
        'kds-avatar-badge',
        position === 'top-right' && 'kds-avatar-badge-top',
        className,
      )}
    >
      {children}
    </span>
  );
}
