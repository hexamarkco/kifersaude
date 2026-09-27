import type { CommWhatsAppChat } from './types';

export type ChatSection = 'active' | 'archived';

export const selectInitialChatId = (
  chats: readonly CommWhatsAppChat[],
  preferredSection: ChatSection,
) => chats.find((chat) => Boolean(chat.is_archived) === (preferredSection === 'archived'))?.id
  ?? chats[0]?.id
  ?? null;

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
};

/**
 * Keeps the open thread alive only while its section was not loaded or a
 * transiently empty response was explicitly detected. If a loaded section
 * omits the chat, the server state must win (archive, delete, merge or filter
 * change), otherwise the Inbox shows a stale conversation indefinitely.
 */
export const shouldPreserveSelectedChatAfterLoad = ({
  selectedChat,
  refreshedChatIds,
  loadedSections,
  unexpectedlyEmptySections,
}: ShouldPreserveSelectedChatParams) => {
  if (!selectedChat || refreshedChatIds.has(selectedChat.id)) {
    return false;
  }

  const selectedSection: ChatSection = selectedChat.is_archived ? 'archived' : 'active';
  if (!loadedSections.includes(selectedSection)) {
    return true;
  }

  return unexpectedlyEmptySections.has(selectedSection);
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
