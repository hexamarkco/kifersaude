import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../../lib/cx';

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type PopoverAlign = 'start' | 'center' | 'end';

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLSpanElement>;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = useContext(PopoverContext);
  if (!context) throw new Error('Popover components must be used within Popover.');
  return context;
}

export type PopoverProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function Popover({ open: controlledOpen, defaultOpen = false, onOpenChange, children }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerRef = useRef<HTMLSpanElement>(null);
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>{children}</PopoverContext.Provider>;
}

export type PopoverTriggerProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

export function PopoverTrigger({ children, onClick, className, ...props }: PopoverTriggerProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();

  return (
    <span
      ref={triggerRef}
      className={cx('kds-popover-trigger', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      {...props}
    >
      {children}
    </span>
  );
}

export type PopoverContentProps = HTMLAttributes<HTMLDivElement> & {
  side?: PopoverSide;
  align?: PopoverAlign;
  sideOffset?: number;
  onEscapeKeyDown?: () => void;
  onInteractOutside?: () => void;
};

type Position = { top: number; left: number };

function getPosition(trigger: DOMRect, content: DOMRect, side: PopoverSide, align: PopoverAlign, offset: number): Position {
  const crossAxis = align === 'start' ? 0 : align === 'end' ? 1 : 0.5;
  if (side === 'top' || side === 'bottom') {
    return {
      top: side === 'top' ? trigger.top - content.height - offset : trigger.bottom + offset,
      left: trigger.left + trigger.width * crossAxis - content.width * crossAxis,
    };
  }
  return {
    top: trigger.top + trigger.height * crossAxis - content.height * crossAxis,
    left: side === 'left' ? trigger.left - content.width - offset : trigger.right + offset,
  };
}

export function PopoverContent({
  side = 'bottom',
  align = 'start',
  sideOffset = 8,
  onEscapeKeyDown,
  onInteractOutside,
  className,
  children,
  ...props
}: PopoverContentProps) {
  const { open, setOpen, triggerRef } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ top: -10000, left: -10000 });
  const [theme, setTheme] = useState('theme-light');

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !contentRef.current) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;
      const next = getPosition(trigger.getBoundingClientRect(), content.getBoundingClientRect(), side, align, sideOffset);
      setPosition({
        top: Math.max(8, Math.min(next.top, window.innerHeight - content.offsetHeight - 8)),
        left: Math.max(8, Math.min(next.left, window.innerWidth - content.offsetWidth - 8)),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, open, side, sideOffset, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const host = triggerRef.current?.closest('.painel-theme');
    setTheme(host?.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light');
    const handlePointerDown = (event: PointerEvent) => {
      if (!contentRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        onInteractOutside?.();
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscapeKeyDown?.();
        setOpen(false);
        triggerRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscapeKeyDown, onInteractOutside, open, setOpen, triggerRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={contentRef}
      role="dialog"
      aria-label={props['aria-label'] ?? 'Conteudo adicional'}
      className={cx('kds-popover modal-theme-host painel-theme kifer-ds', theme, className)}
      style={{ position: 'fixed', top: position.top, left: position.left, ...props.style }}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}
