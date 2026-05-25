import { memo } from 'react';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';
import { getDeliveryStatusMeta } from './InboxComponentsShared';

function DeliveryStatusIndicatorBase({ message }: { message: CommWhatsAppMessage }) {
  const meta = getDeliveryStatusMeta(message);
  const Icon = meta.icon;

  return (
    <span className={`whatsapp-inbox-status-meta whatsapp-inbox-status-meta-${meta.tone}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
    </span>
  );
}

export const DeliveryStatusIndicator = memo(DeliveryStatusIndicatorBase);
