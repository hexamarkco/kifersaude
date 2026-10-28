import { useLayoutEffect, useState, type RefObject } from 'react';

export type OverlaySide = 'top' | 'right' | 'bottom' | 'left';
export type OverlayAlign = 'start' | 'center' | 'end';
type Rect = Pick<
  DOMRect,
  'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'
>;
type Viewport = { width: number; height: number; top?: number; left?: number };
type OverlayBoundary = 'viewport' | 'dialog-body';

function hasFiniteRect(rect: DOMRect) {
  return [rect.top, rect.left, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite);
}

export function getOverlayPosition(
  trigger: Rect,
  content: Rect,
  side: OverlaySide,
  align: OverlayAlign,
  offset: number,
  viewport: Viewport,
) {
  const inset = 8;
  const minLeft = (viewport.left ?? 0) + inset;
  const minTop = (viewport.top ?? 0) + inset;
  const right = (viewport.left ?? 0) + viewport.width - inset;
  const bottom = (viewport.top ?? 0) + viewport.height - inset;
  const room = {
    top: trigger.top - minTop,
    bottom: bottom - trigger.bottom,
    left: trigger.left - minLeft,
    right: right - trigger.right,
  };
  const opposite = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  } as const;
  const needed =
    (side === 'top' || side === 'bottom' ? content.height : content.width) +
    offset;
  const resolvedSide =
    room[side] < needed && room[opposite[side]] > room[side]
      ? opposite[side]
      : side;
  const cross = align === 'start' ? 0 : align === 'end' ? 1 : 0.5;
  const horizontal = resolvedSide === 'top' || resolvedSide === 'bottom';
  const left = horizontal
    ? trigger.left + (trigger.width - content.width) * cross
    : resolvedSide === 'left'
      ? trigger.left - content.width - offset
      : trigger.right + offset;
  const top = horizontal
    ? resolvedSide === 'top'
      ? trigger.top - content.height - offset
      : trigger.bottom + offset
    : trigger.top + (trigger.height - content.height) * cross;
  return {
    left: Math.max(minLeft, Math.min(left, right - content.width)),
    top: Math.max(minTop, Math.min(top, bottom - content.height)),
    side: resolvedSide,
  };
}

export function useOverlayPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement>,
  contentRef: RefObject<HTMLElement>,
  side: OverlaySide,
  align: OverlayAlign = 'start',
  offset = 8,
  boundary: OverlayBoundary = 'viewport',
) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    side: OverlaySide;
    maxHeight?: number;
    maxWidth?: number;
  }>({ top: -10000, left: -10000, side });
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!triggerRef.current || !contentRef.current) return;
      const dialogBody = boundary === 'dialog-body'
        ? triggerRef.current.closest<HTMLElement>('.kds-dialog-body')
        : null;
      const measuredBoundary = dialogBody?.getBoundingClientRect();
      const boundaryRect = measuredBoundary && hasFiniteRect(measuredBoundary)
        ? measuredBoundary
        : null;
      const viewport = window.visualViewport;
      const overlayViewport = boundaryRect
        ? {
            width: boundaryRect.width,
            height: boundaryRect.height,
            left: boundaryRect.left,
            top: boundaryRect.top,
          }
        : {
            width: viewport && Number.isFinite(viewport.width) ? viewport.width : window.innerWidth,
            height: viewport && Number.isFinite(viewport.height) ? viewport.height : window.innerHeight,
            left: viewport && Number.isFinite(viewport.offsetLeft) ? viewport.offsetLeft : 0,
            top: viewport && Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0,
          };
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      if (!hasFiniteRect(triggerRect) || !hasFiniteRect(contentRect)) return;
      let contentForPosition: Rect = contentRect;
      let maxHeight = Math.max(0, overlayViewport.height - 16);
      if (boundaryRect && contentRef.current.getAttribute('role') === 'listbox' && side === 'bottom') {
        const spaceBelow = boundaryRect.bottom - 8 - triggerRect.bottom - offset;
        if (spaceBelow >= 80) {
          maxHeight = Math.min(maxHeight, spaceBelow);
          contentForPosition = {
            top: contentRect.top,
            left: contentRect.left,
            right: contentRect.right,
            bottom: contentRect.bottom,
            width: contentRect.width,
            height: Math.min(contentRect.height, spaceBelow),
          };
        }
      }
      const next = getOverlayPosition(
        triggerRect,
        contentForPosition,
        side,
        align,
        offset,
        overlayViewport,
      );
      const available = {
        maxHeight,
        maxWidth: Math.max(0, overlayViewport.width - 16),
      };
      setPosition((current) =>
        current.left === next.left &&
        current.top === next.top &&
        current.side === next.side &&
        current.maxHeight === available.maxHeight &&
        current.maxWidth === available.maxWidth
          ? current
          : { ...next, ...available },
      );
    };
    update();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (contentRef.current) observer?.observe(contentRef.current);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    if (boundary === 'dialog-body') {
      const dialogBody = triggerRef.current?.closest<HTMLElement>('.kds-dialog-body');
      if (dialogBody) observer?.observe(dialogBody);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [open, triggerRef, contentRef, side, align, offset, boundary]);
  return position;
}
