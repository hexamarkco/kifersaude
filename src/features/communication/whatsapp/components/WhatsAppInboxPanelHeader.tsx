import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { DialogTitle, IconButton, Text } from '../../../../design-system';
import { cx } from '../../../../lib/cx';

type InboxPanelHeaderProps = {
  icon: LucideIcon;
  title: ReactNode;
  description?: string;
  context?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  className?: string;
};

/** Shared hierarchy for Inbox workspaces, drawers and the inline contact panel. */
export function WhatsAppInboxPanelHeader({
  icon: Icon, title, description, context, actions, children, onClose, showCloseButton = true, className,
}: InboxPanelHeaderProps) {
  return (
    <header className={cx('whatsapp-inbox-panel-header', className)}>
      <div className="whatsapp-inbox-panel-heading">
        <span className="whatsapp-inbox-panel-icon" aria-hidden="true"><Icon className="kds-control-icon" /></span>
        <div className="whatsapp-inbox-panel-heading-copy">
          <Text className="whatsapp-inbox-panel-context">{context || 'WhatsApp Inbox'}</Text>
          <DialogTitle>{title}</DialogTitle>
        </div>
        {showCloseButton ? <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Fechar" className="whatsapp-inbox-panel-close">
          <X className="kds-control-icon" />
        </IconButton> : null}
      </div>
      {description ? <Text className="whatsapp-inbox-panel-description">{description}</Text> : null}
      {children ? <div className="whatsapp-inbox-panel-identity">{children}</div> : null}
      {actions ? <div className="whatsapp-inbox-panel-actions">{actions}</div> : null}
    </header>
  );
}
