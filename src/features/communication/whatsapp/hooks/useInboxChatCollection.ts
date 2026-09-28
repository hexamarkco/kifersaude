import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { upsertInboxChatCollection } from '../domain/inboxChatCollection';
import type { CommWhatsAppChat } from '../domain/types';

type CurrentValue<Value> = { current: Value };

type UseInboxChatCollectionOptions = {
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  chatsSignatureRef: CurrentValue<string>;
  savedContactNameOverrideByPhoneRef: CurrentValue<ReadonlyMap<string, string>>;
  savedContactNameByPhoneRef: CurrentValue<ReadonlyMap<string, string>>;
  buildChatsSignature: (chats: CommWhatsAppChat[]) => string;
};

export const useInboxChatCollection = ({
  setChats,
  chatsSignatureRef,
  savedContactNameOverrideByPhoneRef,
  savedContactNameByPhoneRef,
  buildChatsSignature,
}: UseInboxChatCollectionOptions) => {
  const upsertChatLocally = useCallback((nextChat: CommWhatsAppChat) => {
    setChats((current) => {
      const result = upsertInboxChatCollection(current, nextChat, {
        savedContactNameOverrideByPhone: savedContactNameOverrideByPhoneRef.current,
        savedContactNameByPhone: savedContactNameByPhoneRef.current,
        previousSignature: chatsSignatureRef.current,
        buildSignature: buildChatsSignature,
      });

      if (result.chats !== current) {
        chatsSignatureRef.current = result.signature;
      }

      return result.chats;
    });
  }, [buildChatsSignature, chatsSignatureRef, savedContactNameByPhoneRef, savedContactNameOverrideByPhoneRef, setChats]);

  return { upsertChatLocally };
};
