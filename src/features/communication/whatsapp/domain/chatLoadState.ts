import type { CommWhatsAppChat } from './types';

export type ChatSection = 'active' | 'archived';

export const selectInitialChatId = (
  chats: readonly CommWhatsAppChat[],
  preferredSection: ChatSection,
) => chats.find((chat) => Boolean(chat.is_archived) === (preferredSection === 'archived'))?.id
  ?? chats[0]?.id
  ?? null;

export const resolveSelectedChatIdAfterLoad = ({
  currentSelectedChatId,
  requestedChatId,
  isMobileInboxLayout,
  chats,
  preferredSection,
}: {
  currentSelectedChatId: string | null;
  requestedChatId: string | null;
  isMobileInboxLayout: boolean;
  chats: readonly CommWhatsAppChat[];
  preferredSection: ChatSection;
}) => {
  if (!currentSelectedChatId && isMobileInboxLayout && !requestedChatId) {
    return null;
  }

  if (requestedChatId && currentSelectedChatId === requestedChatId) {
    return currentSelectedChatId;
  }

  if (currentSelectedChatId && chats.some((chat) => chat.id === currentSelectedChatId)) {
    return currentSelectedChatId;
  }

  return selectInitialChatId(chats, preferredSection);
};

export const selectReplacementChatId = ({
  chats,
  removedChatId,
  preferredSection,
}: {
  chats: readonly CommWhatsAppChat[];
  removedChatId: string;
  preferredSection: ChatSection;
}) => selectInitialChatId(
  chats.filter((chat) => chat.id !== removedChatId),
  preferredSection,
);

type ShouldPreserveSelectedChatParams = {
  selectedChat: CommWhatsAppChat | null;
  refreshedChatIds: ReadonlySet<string>;
  loadedSections: readonly ChatSection[];
  unexpectedlyEmptySections: ReadonlySet<ChatSection>;
  preserveMissingSelection?: boolean;
};

/**
 * A paged, filtered or older response cannot prove that the open chat was
 * removed. Complete current responses and explicit deletion/merge events
 * can still remove the selection.
 */
export const shouldPreserveSelectedChatAfterLoad = ({
  selectedChat,
  refreshedChatIds,
  loadedSections,
  unexpectedlyEmptySections,
  preserveMissingSelection = false,
}: ShouldPreserveSelectedChatParams) => {
  if (!selectedChat || selectedChat.deleted_at || selectedChat.merged_into_chat_id
    || refreshedChatIds.has(selectedChat.id)) {
    return false;
  }

  const selectedSection: ChatSection = selectedChat.is_archived ? 'archived' : 'active';
  if (!loadedSections.includes(selectedSection)) {
    return true;
  }

  return preserveMissingSelection || unexpectedlyEmptySections.has(selectedSection);
};

type PreserveChatsFromPartialLoadParams = {
  previousChats: readonly CommWhatsAppChat[];
  refreshedChatIds: ReadonlySet<string>;
  loadedSections: ReadonlySet<ChatSection>;
  unexpectedlyEmptySections: ReadonlySet<ChatSection>;
};

/**
 * Keeps cached chats from sections whose request failed, while allowing a
 * successful response to remove chats that no longer belong to that section.
 */
export const preserveChatsFromPartialLoad = ({
  previousChats,
  refreshedChatIds,
  loadedSections,
  unexpectedlyEmptySections,
}: PreserveChatsFromPartialLoadParams) => previousChats.filter((chat) => {
  if (chat.deleted_at || refreshedChatIds.has(chat.id)) {
    return false;
  }

  const section: ChatSection = chat.is_archived ? 'archived' : 'active';
  if (!loadedSections.has(section)) {
    return true;
  }

  return unexpectedlyEmptySections.has(section);
});
