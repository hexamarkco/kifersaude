import { isInboxWhapiChatId, normalizeWhapiChatId } from '../_shared/comm-whatsapp/identity.ts';

type ProviderChat = Record<string, unknown>;

/** Minimal provider inventory for recovery; never returns message content. */
export function projectRecoveryChats(chats: ProviderChat[], groups: ProviderChat[]) {
  const projected = new Map<string, { externalChatId: string; lastMessageAt: number | null }>();
  for (const chat of [...chats, ...groups]) {
    const externalChatId = normalizeWhapiChatId(chat.id ?? chat.chat_id ?? chat.group_id);
    if (!isInboxWhapiChatId(externalChatId)) continue;
    const message = chat.last_message ?? chat.lastMessage;
    const timestamp = message && typeof message === 'object'
      ? Number((message as Record<string, unknown>).timestamp)
      : NaN;
    const lastMessageAt = Number.isFinite(timestamp) && timestamp > 0
      ? Math.floor(timestamp > 1e12 ? timestamp / 1000 : timestamp)
      : null;
    const previous = projected.get(externalChatId);
    // Missing metadata must remain eligible for a history check.
    projected.set(externalChatId, {
      externalChatId,
      lastMessageAt: previous
        ? previous.lastMessageAt === null || lastMessageAt === null
          ? null
          : Math.max(previous.lastMessageAt, lastMessageAt)
        : lastMessageAt,
    });
  }
  return [...projected.values()];
}
