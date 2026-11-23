import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import PublicBrandMark from '../../components/public/PublicBrandMark';

export type BrandWordmarkProps = HTMLAttributes<HTMLDivElement> & { caption?: string; variant?: 'wordmark' | 'lockup' | 'symbol' };

/** Shared typographic identity for workspace and public entry points. */
export function BrandWordmark({ caption, className, variant = 'wordmark', ...props }: BrandWordmarkProps) {
  return (
    <div className={cx('kds-workspace-brand', className)} role="img" aria-label={caption ? `Kifer Saúde ${caption}` : 'Kifer Saúde'} {...props}>
      {variant === 'wordmark' ? <span>kifer<span>saúde</span></span> : (
        <span className="kds-brand-lockup">
          <PublicBrandMark className="kds-brand-lockup-symbol" />
          {variant === 'lockup' && <span className="kds-brand-lockup-name"><strong>Kifer</strong><span>Saúde</span></span>}
        </span>
      )}
      {caption && <small>{caption}</small>}
    </div>
  );
}
