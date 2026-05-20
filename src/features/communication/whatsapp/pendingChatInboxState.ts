import type { CommWhatsAppChat } from '../../../lib/supabase';

export type PendingChatInboxStateFields = Partial<Pick<CommWhatsAppChat,
  'is_archived'
  | 'archived_at'
  | 'is_muted'
  | 'muted_at'
  | 'is_pinned'
  | 'pinned_at'
  | 'manual_unread'
  | 'manual_unread_at'
  | 'unread_count'
  | 'last_read_at'
  | 'last_message_text'
  | 'last_message_direction'
  | 'last_message_at'
  | 'last_message_delivery_status'
>>;

type PendingChatInboxStateMetadata = {
  __issuedAt?: number;
  __actions?: Partial<Record<'isArchived' | 'isMuted' | 'isPinned' | 'markAsUnread', number>>;
};

export type PendingChatInboxStatePatch = PendingChatInboxStateFields & PendingChatInboxStateMetadata;

const PENDING_CHAT_INBOX_STATE_TTL_MS = 30_000;
const PENDING_CHAT_ARCHIVE_PATCH_PROTECT_MS = 20_000;
const PENDING_CHAT_INBOX_META_KEYS: ReadonlyArray<keyof PendingChatInboxStateMetadata> = ['__issuedAt', '__actions'];

const getMessageTimestampMs = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const stripPendingChatInboxMetadata = (patch: PendingChatInboxStatePatch): PendingChatInboxStateFields => {
  const next: Record<string, unknown> = { ...patch };
  for (const key of PENDING_CHAT_INBOX_META_KEYS) {
    delete next[key as string];
  }
  return next as PendingChatInboxStateFields;
};

const isPendingPatchExpired = (patch: PendingChatInboxStatePatch | undefined): boolean => {
  if (!patch?.__issuedAt) {
    return false;
  }
  return Date.now() - patch.__issuedAt > PENDING_CHAT_INBOX_STATE_TTL_MS;
};

export const applyPendingChatInboxState = (
  items: CommWhatsAppChat[],
  pendingStateByChatId: Map<string, PendingChatInboxStatePatch>,
) => items.map((chat) => {
  const pendingState = pendingStateByChatId.get(chat.id);
  if (!pendingState) {
    return chat;
  }

  if (isPendingPatchExpired(pendingState)) {
    pendingStateByChatId.delete(chat.id);
    return chat;
  }

  if (pendingState.last_read_at) {
    const pendingReadAt = getMessageTimestampMs(pendingState.last_read_at);
    const serverReadAt = getMessageTimestampMs(chat.last_read_at);
    const lastMessageAt = getMessageTimestampMs(chat.last_message_at);

    const pendingLastMessageAt = getMessageTimestampMs(pendingState.last_message_at);
    const serverCaughtUpWithPendingMessage = pendingLastMessageAt === null || (lastMessageAt !== null && lastMessageAt >= pendingLastMessageAt);
    const serverDeliveryStatus = String(chat.last_message_delivery_status ?? '').trim().toLowerCase();
    const pendingDeliveryStatus = String(pendingState.last_message_delivery_status ?? '').trim().toLowerCase();

    if (
      pendingState.last_message_at
      && serverCaughtUpWithPendingMessage
      && pendingState.last_message_direction === chat.last_message_direction
      && serverDeliveryStatus
      && serverDeliveryStatus !== pendingDeliveryStatus
    ) {
      pendingStateByChatId.delete(chat.id);
      return chat;
    }

    if (serverReadAt !== null && pendingReadAt !== null && serverReadAt >= pendingReadAt && chat.unread_count <= 0 && !chat.manual_unread && serverCaughtUpWithPendingMessage) {
      pendingStateByChatId.delete(chat.id);
      return chat;
    }

    const pendingReadWasInvalidatedByInbound = chat.last_message_direction === 'inbound'
      && lastMessageAt !== null
      && pendingReadAt !== null
      && lastMessageAt > pendingReadAt
      && (chat.unread_count > 0 || chat.manual_unread);

    if (pendingReadWasInvalidatedByInbound) {
      pendingStateByChatId.delete(chat.id);
      return chat;
    }
  }

  const issuedAt = pendingState.__issuedAt ?? 0;
  const ageMs = issuedAt > 0 ? Date.now() - issuedAt : 0;
  const withinProtection = issuedAt > 0 && ageMs <= PENDING_CHAT_ARCHIVE_PATCH_PROTECT_MS;

  const fieldsPatch = stripPendingChatInboxMetadata(pendingState);
  const remaining: PendingChatInboxStateFields = { ...fieldsPatch };

  if (typeof remaining.is_archived === 'boolean') {
    if (chat.is_archived === remaining.is_archived) {
      delete remaining.is_archived;
      delete remaining.archived_at;
    } else if (!withinProtection) {
      delete remaining.is_archived;
      delete remaining.archived_at;
    }
  }

  if (typeof remaining.is_muted === 'boolean') {
    if (chat.is_muted === remaining.is_muted) {
      delete remaining.is_muted;
      delete remaining.muted_at;
    } else if (!withinProtection) {
      delete remaining.is_muted;
      delete remaining.muted_at;
    }
  }

  if (typeof remaining.is_pinned === 'boolean') {
    if (chat.is_pinned === remaining.is_pinned) {
      delete remaining.is_pinned;
      delete remaining.pinned_at;
    } else if (!withinProtection) {
      delete remaining.is_pinned;
      delete remaining.pinned_at;
    }
  }

  if (typeof remaining.manual_unread === 'boolean') {
    if (chat.manual_unread === remaining.manual_unread) {
      delete remaining.manual_unread;
      delete remaining.manual_unread_at;
    } else if (!withinProtection) {
      delete remaining.manual_unread;
      delete remaining.manual_unread_at;
    }
  }

  if (Object.keys(remaining).length === 0) {
    pendingStateByChatId.delete(chat.id);
    return chat;
  }

  if (Object.keys(remaining).length !== Object.keys(fieldsPatch).length) {
    pendingStateByChatId.set(chat.id, {
      ...remaining,
      __issuedAt: pendingState.__issuedAt,
      __actions: pendingState.__actions,
    });
  }

  return { ...chat, ...remaining };
});

export const mergePendingChatInboxState = (
  pendingStateByChatId: Map<string, PendingChatInboxStatePatch>,
  chatId: string,
  patch: PendingChatInboxStatePatch,
) => {
  const existing = pendingStateByChatId.get(chatId);
  const issuedAt = patch.__issuedAt ?? existing?.__issuedAt ?? Date.now();
  pendingStateByChatId.set(chatId, {
    ...existing,
    ...patch,
    __issuedAt: issuedAt,
    __actions: {
      ...existing?.__actions,
      ...patch.__actions,
    },
  });
};

export const clearPendingChatReadState = (
  pendingStateByChatId: Map<string, PendingChatInboxStatePatch>,
  chatId: string,
) => {
  const current = pendingStateByChatId.get(chatId);
  if (!current) {
    return;
  }

  const {
    unread_count: _unreadCount,
    manual_unread: _manualUnread,
    manual_unread_at: _manualUnreadAt,
    last_read_at: _lastReadAt,
    last_message_text: _lastMessageText,
    last_message_direction: _lastMessageDirection,
    last_message_at: _lastMessageAt,
    last_message_delivery_status: _lastMessageDeliveryStatus,
    ...rest
  } = current;

  const remainingKeys = Object.keys(rest).filter((key) => !PENDING_CHAT_INBOX_META_KEYS.includes(key as keyof PendingChatInboxStateMetadata));
  if (remainingKeys.length === 0) {
    pendingStateByChatId.delete(chatId);
    return;
  }

  pendingStateByChatId.set(chatId, rest as PendingChatInboxStatePatch);
};

export const buildPendingChatInboxStatePatch = (
  chat: CommWhatsAppChat,
  options: {
    isArchived?: boolean | null;
    isMuted?: boolean | null;
    isPinned?: boolean | null;
    markAsUnread?: boolean | null;
  },
): PendingChatInboxStatePatch => {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const patch: PendingChatInboxStatePatch = {
    __issuedAt: nowMs,
    __actions: {},
  };

  if (typeof options.isArchived === 'boolean') {
    patch.is_archived = options.isArchived;
    patch.archived_at = options.isArchived ? now : null;
    patch.__actions!.isArchived = nowMs;
  }

  if (typeof options.isMuted === 'boolean') {
    patch.is_muted = options.isMuted;
    patch.muted_at = options.isMuted ? (chat.muted_at ?? now) : null;
    patch.__actions!.isMuted = nowMs;
  }

  if (typeof options.isPinned === 'boolean') {
    patch.is_pinned = options.isPinned;
    patch.pinned_at = options.isPinned ? (chat.pinned_at ?? now) : null;
    patch.__actions!.isPinned = nowMs;
  }

  if (typeof options.markAsUnread === 'boolean') {
    patch.manual_unread = options.markAsUnread && chat.unread_count <= 0;
    patch.manual_unread_at = patch.manual_unread ? (chat.manual_unread_at ?? now) : null;
    if (options.markAsUnread === false) {
      patch.unread_count = 0;
    }
    patch.__actions!.markAsUnread = nowMs;
  }

  return patch;
};
