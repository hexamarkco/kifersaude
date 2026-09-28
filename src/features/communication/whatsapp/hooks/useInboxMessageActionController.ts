import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { mergeCommWhatsAppMessage } from '../messageStatus';
import type { InboxPointerAnchor } from '../domain/inboxOverlayPosition';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import { useInboxMessageMutations } from './useInboxMessageMutations';
import { useInboxMessageReactionActions } from './useInboxMessageReactionActions';

type InboxMessageActionControllerOptions = {
  selectedChatId: string | null;
  selectedChatExternalId: string | null | undefined;
  setMessages: Dispatch<SetStateAction<CommWhatsAppMessage[]>>;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  uiState: {
    setOpenReactionPickerMessageId: Dispatch<SetStateAction<string | null>>;
    setOpenMessageActionMenuMessageId: Dispatch<SetStateAction<string | null>>;
    setMessageActionMenuPointerAnchor: Dispatch<SetStateAction<InboxPointerAnchor | null>>;
    setMessageDetailsMessageId: Dispatch<SetStateAction<string | null>>;
  };
};

export const useInboxMessageActionController = ({
  selectedChatId,
  selectedChatExternalId,
  setMessages,
  setChats,
  uiState,
}: InboxMessageActionControllerOptions) => {
  const {
    setOpenReactionPickerMessageId,
    setOpenMessageActionMenuMessageId,
    setMessageActionMenuPointerAnchor,
    setMessageDetailsMessageId,
  } = uiState;

  const patchMessageLocally = useCallback((messageId: string, patch: Partial<CommWhatsAppMessage>) => {
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      return mergeCommWhatsAppMessage(message, {
        ...message,
        ...patch,
        metadata: {
          ...message.metadata,
          ...(patch.metadata ?? {}),
        },
      });
    }));
  }, [setMessages]);

  const closeMessageActionMenu = useCallback(() => {
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId(null);
  }, [setMessageActionMenuPointerAnchor, setOpenMessageActionMenuMessageId]);
  const closeReactionPicker = useCallback(() => {
    setOpenReactionPickerMessageId(null);
  }, [setOpenReactionPickerMessageId]);
  const closeMessageDetails = useCallback(() => {
    setMessageDetailsMessageId(null);
  }, [setMessageDetailsMessageId]);

  const handleToggleMessageActionMenu = useCallback((messageId: string) => {
    setOpenReactionPickerMessageId(null);
    setMessageActionMenuPointerAnchor(null);
    setOpenMessageActionMenuMessageId((current) => (current === messageId ? null : messageId));
  }, [setMessageActionMenuPointerAnchor, setOpenMessageActionMenuMessageId, setOpenReactionPickerMessageId]);

  const handleOpenMessageActionMenuFromContext = useCallback((messageId: string, anchor: InboxPointerAnchor) => {
    setOpenReactionPickerMessageId(null);
    setMessageActionMenuPointerAnchor(anchor);
    setOpenMessageActionMenuMessageId(messageId);
  }, [setMessageActionMenuPointerAnchor, setOpenMessageActionMenuMessageId, setOpenReactionPickerMessageId]);

  const handleOpenMessageDetails = useCallback((message: CommWhatsAppMessage) => {
    closeMessageActionMenu();
    setMessageDetailsMessageId(message.id);
  }, [closeMessageActionMenu, setMessageDetailsMessageId]);

  const reactions = useInboxMessageReactionActions({
    selectedChatExternalId,
    patchMessageLocally,
    setOpenReactionPickerMessageId,
    setOpenMessageActionMenuMessageId,
  });
  const mutations = useInboxMessageMutations({
    selectedChatId,
    patchMessageLocally,
    setChats,
    closeMessageActionMenu,
  });

  return {
    patchMessageLocally,
    closeMessageActionMenu,
    closeReactionPicker,
    closeMessageDetails,
    handleToggleMessageActionMenu,
    handleOpenMessageActionMenuFromContext,
    handleOpenMessageDetails,
    ...reactions,
    ...mutations,
  };
};
