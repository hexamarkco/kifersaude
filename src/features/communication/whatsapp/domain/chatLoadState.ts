import type { CommWhatsAppChat } from './types';

export type ChatSection = 'active' | 'archived';

type ShouldPreserveSelectedChatParams = {
  selectedChat: CommWhatsAppChat | null;
  refreshedChatIds: ReadonlySet<string>;
  requestedSections: readonly ChatSection[];
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
  requestedSections,
  unexpectedlyEmptySections,
}: ShouldPreserveSelectedChatParams) => {
  if (!selectedChat || refreshedChatIds.has(selectedChat.id)) {
    return false;
  }

  const selectedSection: ChatSection = selectedChat.is_archived ? 'archived' : 'active';
  if (!requestedSections.includes(selectedSection)) {
    return true;
  }

  return unexpectedlyEmptySections.has(selectedSection);
};
