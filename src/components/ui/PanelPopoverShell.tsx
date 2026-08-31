import { forwardRef, useEffect, type AriaRole, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../../lib/cx';

type PanelPopoverPosition = {
  top: number;
  left: number;
  width?: number;
  maxHeight?: number;
};

type PanelPopoverShellProps = {
  isOpen: boolean;
  position: PanelPopoverPosition | null;
  children: ReactNode;
  onClose?: () => void;
  ariaLabel?: string;
  role?: AriaRole;
  className?: string;
  style?: CSSProperties;
};

const PanelPopoverShell = forwardRef<HTMLDivElement, PanelPopoverShellProps>(function PanelPopoverShell(
  { isOpen, position, children, onClose, ariaLabel, role = 'dialog', className, style },
  ref,
) {
  const portalTarget = typeof document === 'undefined' ? null : document.body;
  const themedAncestor = typeof document === 'undefined' ? null : document.querySelector('.painel-theme');
  const themeScopeClassName = cx(
    'modal-theme-host painel-theme kifer-ds',
    themedAncestor?.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light',
  );

  useEffect(() => {
    if (!isOpen || !onClose) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position || !portalTarget) {
    return null;
  }

  return createPortal(
    <div className={themeScopeClassName}>
      <div
        ref={ref}
        role={role}
        aria-label={ariaLabel}
        className={cx(
          'kds-popover panel-glass-panel fixed z-[120] flex flex-col overflow-hidden',
          className,
        )}
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          maxHeight: position.maxHeight,
          ...style,
        }}
      >
        {children}
      </div>
    </div>,
    portalTarget,
  );
});

export default PanelPopoverShell;
