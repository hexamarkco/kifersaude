import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import type { AdaptiveLoadingPhase } from '../../hooks/useAdaptiveLoading';

type PanelTopLoadingBarProps = {
  active: boolean;
  label?: string;
  className?: string;
  fixed?: boolean;
};

export function PanelTopLoadingBar({
  active,
  label,
  className,
  fixed = false,
}: PanelTopLoadingBarProps) {
  if (!active) {
    return null;
  }

  return (
    <div
      className={cx(
        fixed ? 'fixed inset-x-0 top-0 z-[120]' : 'absolute inset-x-0 top-0 z-30',
        className,
      )}
      aria-live="polite"
    >
      <div className="panel-top-loader-track">
        <div className="panel-top-loader-bar" />
      </div>
      {label ? (
        <div className="pointer-events-none px-3 pt-2 text-[11px] font-medium tracking-wide text-slate-500">
          {label}
        </div>
      ) : null}
    </div>
  );
}

type PanelSoftRefreshOverlayProps = {
  active: boolean;
  label?: string;
  className?: string;
};

export function PanelSoftRefreshOverlay({
  active,
  label = 'Atualizando dados...',
  className,
}: PanelSoftRefreshOverlayProps) {
  if (!active) {
    return null;
  }

  return (
    <div className={cx('pointer-events-none absolute inset-0 z-20 rounded-[inherit]', className)}>
      <div className="absolute inset-0 rounded-[inherit] bg-white/52 backdrop-blur-[1.5px]" />
      <div className="absolute inset-x-0 top-4 flex justify-center px-4">
        <div className="panel-loading-pill inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm">
          <span className="panel-loading-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="text-xs font-medium text-slate-600">{label}</span>
        </div>
      </div>
    </div>
  );
}

type PanelLoadingStageProps = {
  phase: AdaptiveLoadingPhase;
  label: string;
  className?: string;
};

export function PanelLoadingStage({
  phase,
  label,
  className,
}: PanelLoadingStageProps) {
  if (phase === 'hidden') {
    return <div className={cx('min-h-[48vh]', className)} />;
  }

  return (
    <div className={cx('relative min-h-[48vh] overflow-hidden rounded-2xl border border-slate-200 bg-white/90', className)}>
      <PanelTopLoadingBar active label={label} className="z-20" />
      <div className="flex min-h-[48vh] items-center justify-center px-4">
        <div className="panel-loading-pill inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <span className="panel-loading-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="text-sm font-medium text-slate-600">{label}</span>
        </div>
      </div>
    </div>
  );
}

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

export function PanelAdaptiveLoadingFrame({
  loading,
  phase,
  hasContent,
  skeleton,
  stageLabel,
  overlayLabel,
  stageClassName,
  children,
}: PanelAdaptiveLoadingFrameProps) {
  if (loading && !hasContent) {
    if (phase === 'skeleton') {
      return <>{skeleton}</>;
    }

    return <PanelLoadingStage phase={phase} label={stageLabel} className={stageClassName} />;
  }

  const showLoadingChrome = loading && phase !== 'hidden';
  const shouldShowOverlay = showLoadingChrome && hasContent;

  return (
    <div className="relative">
      <PanelTopLoadingBar
        active={showLoadingChrome}
        label={overlayLabel || stageLabel}
      />
      <div
        className={cx(
          shouldShowOverlay && 'pointer-events-none select-none opacity-90',
        )}
      >
        {children}
      </div>
      <PanelSoftRefreshOverlay
        active={shouldShowOverlay}
        label={overlayLabel || stageLabel}
      />
    </div>
  );
}
