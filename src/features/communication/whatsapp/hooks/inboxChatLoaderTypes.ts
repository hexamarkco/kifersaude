import type { ChatSection } from '../domain/chatLoadState';

export type InboxChatLoadOptions = {
  sections?: ChatSection[];
  partialArchived?: boolean;
  preferredSection?: ChatSection;
};
