import { createContext, useContext, type ReactNode } from 'react';

import type { CommWhatsAppChat } from '../../../lib/supabase';

export type WhatsAppInboxSelectionContextValue = {
  selectedChatId: string | null;
  selectedChat: CommWhatsAppChat | null;
  archivedSectionOpen: boolean;
};

const WhatsAppInboxSelectionContext = createContext<WhatsAppInboxSelectionContextValue | null>(null);

export const WhatsAppInboxSelectionProvider = ({
  value,
  children,
}: {
  value: WhatsAppInboxSelectionContextValue;
  children: ReactNode;
}) => (
  <WhatsAppInboxSelectionContext.Provider value={value}>
    {children}
  </WhatsAppInboxSelectionContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const useWhatsAppInboxSelection = () => {
  const value = useContext(WhatsAppInboxSelectionContext);
  if (!value) {
    throw new Error('useWhatsAppInboxSelection must be used inside WhatsAppInboxSelectionProvider.');
  }
  return value;
};
