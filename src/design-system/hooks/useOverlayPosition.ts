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
  minimumPreferredSpace = 0,
) {
  const inset = 8;
  const minLeft = (viewport.left ?? 0) + inset;
  const minTop = (viewport.top ?? 0) + inset;
  const right = Math.max(minLeft, (viewport.left ?? 0) + viewport.width - inset);
  const bottom = Math.max(minTop, (viewport.top ?? 0) + viewport.height - inset);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  // A fixed portal is anchored to the trigger on its main axis. Only the
  // cross axis may slide; shrink the menu instead of detaching from its anchor.
  const anchor = {
    top: clamp(trigger.top, minTop, bottom),
    bottom: clamp(trigger.bottom, minTop, bottom),
    left: clamp(trigger.left, minLeft, right),
    right: clamp(trigger.right, minLeft, right),
  };
  const room = {
    top: Math.max(0, anchor.top - minTop - offset),
    bottom: Math.max(0, bottom - anchor.bottom - offset),
    left: Math.max(0, anchor.left - minLeft - offset),
    right: Math.max(0, right - anchor.right - offset),
  };
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
  const vertical = side === 'top' || side === 'bottom';
  const needed = vertical ? content.height : content.width;
  const usablePreferred = minimumPreferredSpace > 0 && room[side] >= Math.min(needed, minimumPreferredSpace);
  const resolvedSide = room[side] >= needed || usablePreferred || room[opposite[side]] <= room[side]
    ? side
    : opposite[side];
  const maxHeight = vertical ? room[resolvedSide] : bottom - minTop;
  const maxWidth = vertical ? right - minLeft : room[resolvedSide];
  const width = Math.min(content.width, maxWidth);
  const height = Math.min(content.height, maxHeight);
  const cross = align === 'start' ? 0 : align === 'end' ? 1 : 0.5;

  return {
    left: vertical
      ? clamp(trigger.left + (trigger.width - width) * cross, minLeft, right - width)
      : resolvedSide === 'left' ? anchor.left - offset - width : anchor.right + offset,
    top: vertical
      ? resolvedSide === 'top' ? anchor.top - offset - height : anchor.bottom + offset
      : clamp(trigger.top + (trigger.height - height) * cross, minTop, bottom - height),
    side: resolvedSide,
    maxHeight,
    maxWidth,
  };
}

function getVisibleViewport(): Viewport {
  const viewport = window.visualViewport;
  return {
    width: viewport && Number.isFinite(viewport.width) ? viewport.width : window.innerWidth,
    height: viewport && Number.isFinite(viewport.height) ? viewport.height : window.innerHeight,
    left: viewport && Number.isFinite(viewport.offsetLeft) ? viewport.offsetLeft : 0,
    top: viewport && Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0,
  };
}

function intersectBoundary(rect: Rect, viewport: Viewport): Viewport {
  const left = Math.max(rect.left, viewport.left ?? 0);
  const top = Math.max(rect.top, viewport.top ?? 0);
  const right = Math.min(rect.right, (viewport.left ?? 0) + viewport.width);
  const bottom = Math.min(rect.bottom, (viewport.top ?? 0) + viewport.height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function isOutside(rect: Rect, viewport: Viewport) {
  const left = viewport.left ?? 0;
  const top = viewport.top ?? 0;
  return rect.bottom <= top || rect.top >= top + viewport.height ||
    rect.right <= left || rect.left >= left + viewport.width;
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
    hidden: boolean;
  }>({ top: -10000, left: -10000, side, hidden: true });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;

      // The wrapper may stretch across a field or toolbar while its actual
      // button is smaller. Anchor to the control when it has a rendered box.
      const child = trigger.firstElementChild;
      const childRect = child instanceof HTMLElement && child.matches('button, input, [role="button"], a')
        ? child.getBoundingClientRect()
        : null;
      const triggerRect = childRect && childRect.width > 0 && childRect.height > 0
        ? childRect
        : trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      if (!hasFiniteRect(triggerRect) || !hasFiniteRect(contentRect)) return;

      const viewport = getVisibleViewport();
      const role = content.getAttribute('role');
      const isMenu = role === 'listbox' || role === 'menu' || content.classList.contains('kds-dropdown-menu');
      const minPreferredSpace = isMenu ? 80 : 0;
      // Preserve the unscrolled content height even when the previous placement
      // imposed a smaller maxHeight. Otherwise resize callbacks can cause flips.
      const contentForPosition: Rect = {
        ...contentRect,
        width: contentRect.width,
        height: Math.max(contentRect.height, content.scrollHeight + Math.max(0, content.offsetHeight - content.clientHeight)),
        top: contentRect.top,
        left: contentRect.left,
        right: contentRect.right,
        bottom: contentRect.bottom,
      };
      let overlayViewport = viewport;
      const dialogBody = boundary === 'dialog-body'
        ? trigger.closest<HTMLElement>('.kds-dialog-body')
        : null;
      const bodyRect = dialogBody?.getBoundingClientRect();

      // A portal isn't clipped by the dialog body. Keep a list within the
      // body when there is usable room below (so the footer remains visible),
      // but use the visible screen for calendars and space-constrained fields.
      if (isMenu && side === 'bottom' && bodyRect && hasFiniteRect(bodyRect)) {
        const bodyViewport = intersectBoundary(bodyRect, viewport);
        const bodyBottom = (bodyViewport.top ?? 0) + bodyViewport.height;
        const spaceBelow = bodyBottom - 8 - triggerRect.bottom - offset;
        if (!isOutside(triggerRect, bodyViewport) && spaceBelow >= Math.min(contentForPosition.height, minPreferredSpace)) {
          overlayViewport = bodyViewport;
        }
      }

      let hidden = isOutside(triggerRect, viewport);
      // Hide overlays when their trigger is scrolled out of a clipping ancestor;
      // don't leave a detached floating menu above the dialog or table.
      for (let ancestor = trigger.parentElement; ancestor && !hidden; ancestor = ancestor.parentElement) {
        const style = window.getComputedStyle(ancestor);
        const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
        const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        if (!clipsX && !clipsY) continue;
        const rect = ancestor.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        hidden = (clipsX && (triggerRect.right <= rect.left || triggerRect.left >= rect.right)) ||
          (clipsY && (triggerRect.bottom <= rect.top || triggerRect.top >= rect.bottom));
      }
      const next = {
        ...getOverlayPosition(triggerRect, contentForPosition, side, align, offset, overlayViewport, minPreferredSpace),
        hidden,
      };
      setPosition((current) =>
        current.left === next.left &&
        current.top === next.top &&
        current.side === next.side &&
        current.maxHeight === next.maxHeight &&
        current.maxWidth === next.maxWidth &&
        current.hidden === next.hidden
          ? current
          : next,
      );
    };

    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (contentRef.current) observer?.observe(contentRef.current);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    if (boundary === 'dialog-body') {
      const dialogBody = triggerRef.current?.closest<HTMLElement>('.kds-dialog-body');
      if (dialogBody) observer?.observe(dialogBody);
    }
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(update);
    if (contentRef.current) mutationObserver?.observe(contentRef.current, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [open, triggerRef, contentRef, side, align, offset, boundary]);
  return position;
}
