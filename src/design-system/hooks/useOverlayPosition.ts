import { useLayoutEffect, useState, type RefObject } from 'react';

export type OverlaySide = 'top' | 'right' | 'bottom' | 'left';
export type OverlayAlign = 'start' | 'center' | 'end';
type Rect = Pick<
  DOMRect,
  'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'
>;
type Viewport = { width: number; height: number; top?: number; left?: number };

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
      const viewport = window.visualViewport;
      const next = getOverlayPosition(
        triggerRef.current.getBoundingClientRect(),
        contentRef.current.getBoundingClientRect(),
        side,
        align,
        offset,
        {
          width: viewport?.width ?? window.innerWidth,
          height: viewport?.height ?? window.innerHeight,
          left: viewport?.offsetLeft,
          top: viewport?.offsetTop,
        },
      );
      const available = {
        maxHeight: Math.max(0, (viewport?.height ?? window.innerHeight) - 16),
        maxWidth: Math.max(0, (viewport?.width ?? window.innerWidth) - 16),
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
  }, [open, triggerRef, contentRef, side, align, offset]);
  return position;
}
