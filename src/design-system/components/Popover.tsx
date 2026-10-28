import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../../lib/cx';
import { useDesignSystemAppearance } from '../appearanceContext';
import { useOverlayPosition } from '../hooks/useOverlayPosition';

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type PopoverAlign = 'start' | 'center' | 'end';

type PopoverContextValue = {
  id: string;
  parentId?: string;
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
  const parent = useContext(PopoverContext);
  const id = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerRef = useRef<HTMLSpanElement>(null);
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return <PopoverContext.Provider value={{ open, setOpen, triggerRef, id, parentId: parent?.id }}>{children}</PopoverContext.Provider>;
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

export function PopoverContent({
  side = 'bottom',
  align = 'start',
  sideOffset = 8,
  onEscapeKeyDown,
  onInteractOutside,
  className,
  style,
  children,
  ...props
}: PopoverContentProps) {
  const appearance = useDesignSystemAppearance();
  const { open, setOpen, triggerRef, id, parentId } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const position = useOverlayPosition(open, triggerRef, contentRef, side, align, sideOffset, 'dialog-body');
  const [theme, setTheme] = useState('theme-light');

  useEffect(() => {
    if (!open) return;
    const host = triggerRef.current?.closest('.painel-theme');
    setTheme(host?.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light');
    const handlePointerDown = (event: PointerEvent) => {
      let owner = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-popover-id]') : null;
      const portals = Array.from(document.querySelectorAll<HTMLElement>('[data-popover-id]'));
      while (owner) {
        if (owner.dataset.popoverId === id) return;
        const parent = owner.dataset.popoverParent;
        owner = portals.find((portal) => portal.dataset.popoverId === parent) ?? null;
      }
      if (!contentRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        onInteractOutside?.();
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (document.querySelector('.kds-floating-tooltip')) return;
        if (Array.from(document.querySelectorAll<HTMLElement>('[data-popover-parent]')).some((portal) => portal.dataset.popoverParent === id)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        onEscapeKeyDown?.();
        setOpen(false);
        triggerRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onEscapeKeyDown, onInteractOutside, open, setOpen, triggerRef, id]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={contentRef}
      data-popover-id={id}
      data-popover-parent={parentId}
      role="dialog"
      aria-label={props['aria-label'] ?? 'Conteudo adicional'}
      className={cx('kds-popover modal-theme-host painel-theme kifer-ds', appearance ? `theme-${appearance.theme} kds-operational` : theme, className)}
      {...props}
      style={{ position: 'fixed', top: position.top, left: position.left, maxHeight: position.maxHeight, maxWidth: position.maxWidth, ...style }}
    >
      {children}
    </div>,
    document.body,
  );
}
