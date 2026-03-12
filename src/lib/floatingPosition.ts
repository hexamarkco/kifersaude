export type FloatingPanelOptions = {
  triggerRect: DOMRect;
  panelWidth: number;
  panelHeight: number;
  gap?: number;
  viewportPadding?: number;
};

export type FloatingPanelPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
};

export const calculateFloatingPanelPosition = ({
  triggerRect,
  panelWidth,
  panelHeight,
  gap = 6,
  viewportPadding = 12,
}: FloatingPanelOptions): FloatingPanelPosition => {
  const width = Math.min(panelWidth, Math.max(180, window.innerWidth - viewportPadding * 2));
  const left = Math.max(
    viewportPadding,
    Math.min(triggerRect.left, window.innerWidth - width - viewportPadding),
  );

  const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
  const availableAbove = triggerRect.top - viewportPadding;
  const shouldOpenUpward = availableBelow < Math.min(panelHeight, 220) && availableAbove > availableBelow;
  const placement: FloatingPanelPosition['placement'] = shouldOpenUpward ? 'top' : 'bottom';
  const maxHeight = Math.max(
    160,
    Math.min(panelHeight, (shouldOpenUpward ? availableAbove : availableBelow) - gap),
  );
  const top = shouldOpenUpward
    ? Math.max(viewportPadding, triggerRect.top - maxHeight - gap)
    : Math.min(window.innerHeight - maxHeight - viewportPadding, triggerRect.bottom + gap);

  return {
    top,
    left,
    width,
    maxHeight,
    placement,
  };
};
