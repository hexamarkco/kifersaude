import { MessageSquare, type LucideIcon } from 'lucide-react';
import { Dialog, DialogBody, DialogFooter, type DialogShellProps } from '../../../../design-system';
import { cx } from '../../../../lib/cx';
import { WhatsAppInboxPanelHeader } from './WhatsAppInboxPanelHeader';

type InboxDialogProps = DialogShellProps & { icon?: LucideIcon; context?: string | null };

/** Inbox-only dialog composition; keeps the shared DS focus, dismissal and scroll behavior. */
export function WhatsAppInboxDialog({
  isOpen, onClose, title, description, children, footer, size = 'form',
  initialFocus = 'first-content', presentation = 'standard', closeOnOverlay = true,
  closeOnEscape = true, showCloseButton = true, panelClassName, bodyClassName,
  footerClassName, bodyScrollable = true, icon = MessageSquare, context,
}: InboxDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}
      size={size} initialFocus={initialFocus} presentation={presentation}
      closeOnOverlay={closeOnOverlay} closeOnEscape={closeOnEscape}
      className={cx('whatsapp-inbox-dialog comm-whatsapp-overlay', panelClassName)}>
      <WhatsAppInboxPanelHeader icon={icon} title={title} description={description}
        context={context} onClose={onClose} showCloseButton={showCloseButton} />
      <DialogBody scrollable={bodyScrollable} className={bodyClassName}>{children}</DialogBody>
      {footer ? <DialogFooter className={footerClassName}>{footer}</DialogFooter> : null}
    </Dialog>
  );
}
