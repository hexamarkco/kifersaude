import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { useDesignSystemAppearance } from '../appearanceContext';
import { useOverlayPosition } from '../hooks/useOverlayPosition';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export type TooltipSize = 'sm' | 'md';
export type TooltipProps = {
  content: ReactNode;
  side?: TooltipSide;
  size?: TooltipSize;
  delayMs?: number;
  children: ReactNode;
  className?: string;
};

export default function Tooltip({
  content,
  side = 'top',
  size = 'md',
  delayMs = 300,
  children,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const id = useId();
  const appearance = useDesignSystemAppearance();
  const position = useOverlayPosition(
    visible,
    triggerRef,
    contentRef,
    side,
    'center',
  );
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }, []);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(true), delayMs);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!visible) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hide();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [visible, hide]);
  const child = isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, {
        'aria-describedby':
          [children.props['aria-describedby'], visible ? id : null]
            .filter(Boolean)
            .join(' ') || undefined,
      })
    : children;
  const host = triggerRef.current?.closest('.painel-theme');
  const theme =
    appearance?.theme ??
    (host?.classList.contains('theme-dark') ? 'dark' : 'light');
  return (
    <div
      ref={triggerRef}
      className={cx('kds-tooltip-anchor', className)}
      onMouseEnter={() => {
        hovered.current = true;
        show();
      }}
      onMouseLeave={() => {
        hovered.current = false;
        if (!focused.current) hide();
      }}
      onFocus={() => {
        focused.current = true;
        show();
      }}
      onBlur={() => {
        focused.current = false;
        if (!hovered.current) hide();
      }}
    >
      {child}
      {visible &&
        content &&
        createPortal(
          <div
            ref={contentRef}
            id={id}
            role="tooltip"
            className={cx(
              'kds-floating-tooltip modal-theme-host painel-theme kifer-ds',
              `theme-${theme}`,
              appearance && 'kds-operational',
              size === 'sm' && 'kds-floating-tooltip-sm',
            )}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              maxHeight: position.maxHeight,
              maxWidth: position.maxWidth,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
