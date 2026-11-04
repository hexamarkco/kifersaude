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
  children: ReactNode;
};

export function PanelAdaptiveLoadingFrame({
  loading,
  hasContent,
  label,
  overlayLabel,
  stageClassName,
  children,
}: PanelAdaptiveLoadingFrameProps) {
  const covered = useAppLoadingContinuation(loading);
  const visible = useMinimumLoading(loading, !covered);
  if (!visible) return loading ? null : <>{children}</>;

  return (
    <LoadingState
      indicator="brand"
      label={hasContent ? overlayLabel ?? label : label}
      className={cx('min-h-[48vh] px-4', stageClassName)}
    />
  );
}
