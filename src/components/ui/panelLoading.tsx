import type { ReactNode } from 'react';
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
  void label;

  return (
    <div className={cx('flex min-h-[48vh] items-center justify-center px-4', className)}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
    </div>
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
