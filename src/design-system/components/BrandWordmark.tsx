import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type BrandWordmarkProps = HTMLAttributes<HTMLDivElement> & { caption?: string };

/** Shared typographic identity for workspace and public entry points. */
export function BrandWordmark({ caption, className, ...props }: BrandWordmarkProps) {
  return (
    <div className={cx('kds-workspace-brand', className)} role="img" aria-label={caption ? `Kifer Saúde ${caption}` : 'Kifer Saúde'} {...props}>
      <span>kifer<span>saúde</span></span>
      {caption && <small>{caption}</small>}
    </div>
  );
}
