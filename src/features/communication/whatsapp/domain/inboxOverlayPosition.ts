export type InboxPointerAnchor = { x: number; y: number };

export type InboxOverlayPosition = {
  top: number;
  left: number;
  width?: number;
  maxHeight?: number;
};

export type InboxOverlayRect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>;
export type InboxOverlayViewport = { width: number; height: number };

type MenuPositionOptions = {
  anchor: InboxOverlayRect;
  viewport: InboxOverlayViewport;
  menuWidth: number;
  estimatedHeight: number;
  minimumMaxHeight: number;
  measuredHeight: number;
};

const POINTER_MENU_GAP_PX = 6;
const POINTER_MENU_VIEWPORT_PADDING_PX = 12;

export const createVirtualOverlayAnchorRect = (anchor: InboxPointerAnchor): InboxOverlayRect => ({
  left: anchor.x,
  right: anchor.x,
  top: anchor.y,
  bottom: anchor.y,
  width: 0,
  height: 0,
});

export const getReactionPickerPosition = (
  anchor: InboxOverlayRect,
  container: InboxOverlayRect | null,
  viewport: InboxOverlayViewport,
): InboxOverlayPosition => {
  const width = 252;
  const height = 52;
  const viewportPadding = 12;
  const containerPadding = 12;
  const boundsLeft = container
    ? Math.max(viewportPadding, container.left + containerPadding)
    : viewportPadding;
  const boundsRight = container
    ? Math.min(viewport.width - viewportPadding, container.right - containerPadding)
    : viewport.width - viewportPadding;
  const maxLeft = Math.max(boundsLeft, boundsRight - width);
  const preferredLeft = anchor.left + (anchor.width - width) / 2;
  const left = Math.min(Math.max(boundsLeft, preferredLeft), maxLeft);
  const maxTop = Math.max(viewportPadding, viewport.height - height - viewportPadding);
  const top = Math.min(Math.max(viewportPadding, anchor.top - height - 8), maxTop);

  return { top, left };
};

export const getPointerMenuPosition = ({
  anchor,
  viewport,
  menuWidth,
  estimatedHeight,
  minimumMaxHeight,
  measuredHeight,
}: MenuPositionOptions): InboxOverlayPosition => {
  const availableBelow = viewport.height - anchor.bottom - POINTER_MENU_VIEWPORT_PADDING_PX;
  const availableAbove = anchor.top - POINTER_MENU_VIEWPORT_PADDING_PX;
  const openUpward = availableBelow < Math.min(estimatedHeight, 180) && availableAbove > availableBelow;
  const maxAvailableHeight = Math.max(
    minimumMaxHeight,
    (openUpward ? availableAbove : availableBelow) - POINTER_MENU_GAP_PX,
  );
  const maxHeight = Math.min(estimatedHeight, maxAvailableHeight);
  const effectiveMenuHeight = Math.min(maxHeight, measuredHeight || estimatedHeight);
  const left = Math.max(
    POINTER_MENU_VIEWPORT_PADDING_PX,
    Math.min(anchor.right - menuWidth, viewport.width - menuWidth - POINTER_MENU_VIEWPORT_PADDING_PX),
  );
  const top = openUpward
    ? Math.max(POINTER_MENU_VIEWPORT_PADDING_PX, anchor.top - effectiveMenuHeight - POINTER_MENU_GAP_PX)
    : Math.min(
        viewport.height - maxHeight - POINTER_MENU_VIEWPORT_PADDING_PX,
        anchor.bottom + POINTER_MENU_GAP_PX,
      );

  return { top, left, width: menuWidth, maxHeight };
};

export const getAdvancedFiltersPosition = (
  trigger: InboxOverlayRect,
  viewport: InboxOverlayViewport,
): InboxOverlayPosition => {
  const viewportPadding = 16;
  const panelWidth = Math.min(292, viewport.width - viewportPadding * 2);
  const left = Math.min(
    Math.max(viewportPadding, trigger.left),
    viewport.width - panelWidth - viewportPadding,
  );

  return { top: trigger.bottom + 8, left };
};

export const getThreadActionsMenuPosition = (
  trigger: InboxOverlayRect,
  viewport: InboxOverlayViewport,
): InboxOverlayPosition => {
  const viewportPadding = 12;
  const width = Math.min(288, viewport.width - viewportPadding * 2);
  const maxHeight = Math.min(420, viewport.height - viewportPadding * 2);
  const left = Math.min(
    Math.max(viewportPadding, trigger.right - width),
    viewport.width - width - viewportPadding,
  );
  const top = Math.min(
    trigger.bottom + 8,
    viewport.height - maxHeight - viewportPadding,
  );

  return { top, left, width, maxHeight };
};

export const getMediaDrawerPosition = (
  trigger: InboxOverlayRect,
  viewport: InboxOverlayViewport,
): InboxOverlayPosition => {
  const viewportPadding = 12;
  const width = Math.min(360, viewport.width - viewportPadding * 2);
  const maxHeight = Math.min(400, viewport.height - viewportPadding * 2);
  const left = Math.min(
    Math.max(viewportPadding, trigger.left),
    viewport.width - width - viewportPadding,
  );
  const top = Math.max(viewportPadding, trigger.top - maxHeight - 8);

  return { top, left, width, maxHeight };
};
