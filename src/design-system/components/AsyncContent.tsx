import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';
import { useAppLoadingContinuation } from '../appLoadingContext';
import { useMinimumLoading } from '../useMinimumLoading';
import { LoadingState } from './LoadingState';

type PanelAdaptiveLoadingFrameProps = {
  loading: boolean;
  hasContent: boolean;
  label?: string;
  overlayLabel?: string;
  stageClassName?: string;
  placeholder?: ReactNode;
  children: ReactNode;
};

export function PanelAdaptiveLoadingFrame({
  loading,
  hasContent,
  label,
  overlayLabel,
  stageClassName,
  placeholder,
  children,
}: PanelAdaptiveLoadingFrameProps) {
  const showPlaceholder = !hasContent && placeholder != null;
  const covered = useAppLoadingContinuation(loading && !hasContent && !showPlaceholder);
  const visible = useMinimumLoading(loading, !covered && !showPlaceholder);

  if (hasContent) {
    return (
      <div className="kds-loading-refresh" data-refreshing={loading || undefined}>
        <div className="kds-loading-refresh-content" aria-busy={loading || undefined} ref={(content) => { if (content) content.inert = loading; }}>
          {children}
        </div>
        {loading && <LoadingState compact size="control" label={overlayLabel ?? label} className="kds-loading-refresh-indicator" />}
      </div>
    );
  }

  if (showPlaceholder && loading) {
    return <LoadingState label={label} placeholder={placeholder} className={stageClassName} />;
  }
  if (!visible) return loading ? null : <>{children}</>;

  return (
    <LoadingState
      label={label}
      className={cx('min-h-[48vh] px-4', stageClassName)}
    />
  );
}
