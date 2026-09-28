import {
  applySavedContactName,
  preserveUsefulChatPreview,
  sortChatsByInboxOrder,
  stabilizeChatIdentityForLocalMerge,
} from './chatPresentation';
import { getSavedContactNameForPhone } from './contactLookup';
import type { CommWhatsAppChat } from './types';

type UpsertInboxChatOptions = {
  savedContactNameOverrideByPhone: ReadonlyMap<string, string>;
  savedContactNameByPhone: ReadonlyMap<string, string>;
  previousSignature: string;
  buildSignature: (chats: CommWhatsAppChat[]) => string;
};

export const upsertInboxChatCollection = (
  current: CommWhatsAppChat[],
  nextChat: CommWhatsAppChat,
  options: UpsertInboxChatOptions,
): { chats: CommWhatsAppChat[]; signature: string } => {
  const { buildSignature, previousSignature, savedContactNameByPhone, savedContactNameOverrideByPhone } = options;

  if (nextChat.deleted_at || nextChat.merged_into_chat_id) {
    const chats = current.filter((chat) => chat.id !== nextChat.id);
    return { chats, signature: buildSignature(chats) };
  }

  const previousChat = current.find((chat) => chat.id === nextChat.id) ?? null;
  const knownSavedContactName = getSavedContactNameForPhone(
    nextChat.phone_digits || nextChat.phone_number,
    savedContactNameOverrideByPhone,
    savedContactNameByPhone,
  );
  const stableNextChat = stabilizeChatIdentityForLocalMerge(
    applySavedContactName(nextChat, knownSavedContactName),
    previousChat,
    knownSavedContactName,
  );
  const hydratedNextChat = preserveUsefulChatPreview(stableNextChat, previousChat);
  const updated = previousChat
    ? current.map((chat) => (chat.id === nextChat.id
      ? preserveUsefulChatPreview(
          stabilizeChatIdentityForLocalMerge({ ...chat, ...hydratedNextChat }, chat, knownSavedContactName),
          chat,
        )
      : chat))
    : [hydratedNextChat, ...current];

  const chats = sortChatsByInboxOrder(updated);
  const signature = buildSignature(chats);
  return signature === previousSignature
    ? { chats: current, signature }
    : { chats, signature };
};
