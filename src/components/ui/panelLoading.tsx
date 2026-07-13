import type { ReactNode } from 'react';
import { LoadingState } from '../../design-system';
import { cx } from '../../lib/cx';
import type { AdaptiveLoadingPhase } from '../../hooks/useAdaptiveLoading';

type PanelTopLoadingBarProps = {
  active: boolean;
  label?: string;
  className?: string;
  fixed?: boolean;
};

type PanelSoftRefreshOverlayProps = {
  active: boolean;
  label?: string;
  className?: string;
};

type PanelLoadingStageProps = {
  phase: AdaptiveLoadingPhase;
  label: string;
  className?: string;
};

type PanelAdaptiveLoadingFrameProps = {
  loading: boolean;
  phase: AdaptiveLoadingPhase;
  hasContent: boolean;
  skeleton: ReactNode;
  stageLabel: string;
  overlayLabel?: string;
  stageClassName?: string;
  children: ReactNode;
};

function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <LoadingState label={label} className={cx('min-h-[48vh] px-4', className)} />
  );
}

export function PanelTopLoadingBar({ active }: PanelTopLoadingBarProps) {
  if (!active) {
    return null;
  }

  return null;
}

export function PanelSoftRefreshOverlay({ active }: PanelSoftRefreshOverlayProps) {
  if (!active) {
    return null;
  }

  return null;
}

export function PanelLoadingStage({ phase, label, className }: PanelLoadingStageProps) {
  if (phase === 'hidden') {
    return <div className={cx('min-h-[48vh]', className)} />;
  }

  return <Spinner label={label} className={className} />;
}

export function PanelAdaptiveLoadingFrame({
  loading,
  stageLabel,
  stageClassName,
  children,
}: PanelAdaptiveLoadingFrameProps) {
  if (loading) {
    return <Spinner label={stageLabel} className={stageClassName} />;
  }

  return <>{children}</>;
}
