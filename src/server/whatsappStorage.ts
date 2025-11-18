import { supabaseAdmin } from '../lib/supabaseAdmin';
import type { WhatsappChat, WhatsappMessage } from '../types/whatsapp';

export type ChatUpsertInput = {
  phone: string;
  chatName?: string | null;
  isGroup?: boolean;
  lastMessageAt?: Date | string | null;
  lastMessagePreview?: string | null;
};

export type MessageInsertInput = {
  chatId: string;
  messageId?: string | null;
  fromMe: boolean;
  status?: string | null;
  text?: string | null;
  moment?: Date | string | null;
  rawPayload?: Record<string, any> | null;
};

const toIsoStringOrNull = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const upsertChatRecord = async (input: ChatUpsertInput): Promise<WhatsappChat> => {
  const {
    phone,
    chatName,
    isGroup,
    lastMessageAt,
    lastMessagePreview,
  } = input;

  if (!phone) {
    throw new Error('Phone number is required to upsert a WhatsApp chat');
  }

  const { data: existingChat, error: fetchError } = await supabaseAdmin
    .from('whatsapp_chats')
    .select('*')
    .eq('phone', phone)
    .maybeSingle<WhatsappChat>();

  if (fetchError) {
    throw fetchError;
  }

  const normalizedLastMessageAt = toIsoStringOrNull(lastMessageAt);
  const updatePayload: Record<string, any> = {
    last_message_at: normalizedLastMessageAt,
    last_message_preview: lastMessagePreview ?? null,
  };

  if (typeof isGroup === 'boolean') {
    updatePayload.is_group = isGroup;
  }

  if (chatName !== undefined) {
    updatePayload.chat_name = chatName;
  }

  if (existingChat) {
    const { error: updateError } = await supabaseAdmin
      .from('whatsapp_chats')
      .update(updatePayload)
      .eq('id', existingChat.id);

    if (updateError) {
      throw updateError;
    }

    return {
      ...existingChat,
      chat_name: updatePayload.chat_name ?? existingChat.chat_name,
      is_group: typeof updatePayload.is_group === 'boolean' ? updatePayload.is_group : existingChat.is_group,
      last_message_at: normalizedLastMessageAt,
      last_message_preview: updatePayload.last_message_preview ?? existingChat.last_message_preview,
    };
  }

  const { data: insertedChat, error: insertError } = await supabaseAdmin
    .from('whatsapp_chats')
    .insert({
      phone,
      chat_name: chatName ?? null,
      last_message_at: normalizedLastMessageAt,
      last_message_preview: lastMessagePreview ?? null,
      is_group: Boolean(isGroup),
      is_archived: false,
      is_pinned: false,
    })
    .select('*')
    .single<WhatsappChat>();

  if (insertError) {
    throw insertError;
  }

  if (!insertedChat) {
    throw new Error('Failed to insert WhatsApp chat');
  }

  return insertedChat;
};

const normalizeMessageStatus = (status: string | null | undefined, fromMe: boolean): string | null => {
  if (!status) {
    return null;
  }

  const normalized = status.trim().toUpperCase();

  if (fromMe) {
    if (normalized === 'DELIVERED') {
      return 'RECEIVED';
    }

    if (normalized === 'READ_BY_ME') {
      return 'READ_BY_ME';
    }
  }

  return normalized;
};

const MESSAGE_STATUS_PRIORITY: Record<string, number> = {
  SENDING: 0,
  PENDING: 0,
  FAILED: 0,
  ERROR: 0,
  SENT: 1,
  RECEIVED: 2,
  DELIVERED: 2,
  READ: 3,
  READ_BY_ME: 3,
  PLAYED: 4,
};

const resolveStatusPriority = (status: string | null): number => {
  if (!status) {
    return -1;
  }

  return MESSAGE_STATUS_PRIORITY[status] ?? -1;
};

export const insertWhatsappMessage = async (input: MessageInsertInput): Promise<WhatsappMessage> => {
  const { chatId, messageId, fromMe, status, text, moment, rawPayload } = input;

  if (!chatId) {
    throw new Error('chatId is required to insert a WhatsApp message');
  }

  const normalizedMoment = toIsoStringOrNull(moment);
  const normalizedStatus = normalizeMessageStatus(status, fromMe);

  const { data: insertedMessage, error: insertError } = await supabaseAdmin
    .from('whatsapp_messages')
    .insert({
      chat_id: chatId,
      message_id: messageId ?? null,
      from_me: fromMe,
      status: normalizedStatus,
      text: text ?? null,
      moment: normalizedMoment,
      raw_payload: rawPayload ?? null,
    })
    .select('*')
    .single<WhatsappMessage>();

  if (insertError) {
    throw insertError;
  }

  if (!insertedMessage) {
    throw new Error('Failed to insert WhatsApp message');
  }

  return insertedMessage;
};

export const updateWhatsappMessageStatuses = async (
  messageIds: string[],
  status: string,
): Promise<{ updated: number; missingIds: string[] }> => {
  const targetStatus = status?.trim();
  const normalizedIds = (messageIds ?? []).map((id) => id?.toString().trim()).filter(Boolean) as string[];

  if (!targetStatus) {
    throw new Error('status is required to update WhatsApp messages');
  }

  if (normalizedIds.length === 0) {
    throw new Error('messageIds are required to update WhatsApp messages');
  }

  const { data: messages, error: fetchError } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id, message_id, from_me, status')
    .in('message_id', normalizedIds)
    .returns<Pick<WhatsappMessage, 'id' | 'message_id' | 'from_me' | 'status'>[]>();

  if (fetchError) {
    throw fetchError;
  }

  const foundIds = new Set<string>();
  const updatesByStatus = new Map<string, string[]>();

  for (const message of messages ?? []) {
    if (message.message_id) {
      foundIds.add(message.message_id);
    }

    const normalizedStatus = normalizeMessageStatus(targetStatus, message.from_me);
    const currentStatus = normalizeMessageStatus(message.status, message.from_me);

    if (!normalizedStatus) {
      continue;
    }

    const nextPriority = resolveStatusPriority(normalizedStatus);
    const currentPriority = resolveStatusPriority(currentStatus);

    if (currentPriority > nextPriority) {
      continue;
    }

    if (currentPriority === nextPriority && currentStatus === normalizedStatus) {
      continue;
    }

    const rows = updatesByStatus.get(normalizedStatus) ?? [];
    rows.push(message.id);
    updatesByStatus.set(normalizedStatus, rows);
  }

  let updated = 0;

  for (const [nextStatus, rowIds] of updatesByStatus.entries()) {
    if (rowIds.length === 0) {
      continue;
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('whatsapp_messages')
      .update({ status: nextStatus })
      .in('id', rowIds)
      .select('id');

    if (updateError) {
      throw updateError;
    }

    updated += data?.length ?? 0;
  }

  const missingIds = normalizedIds.filter((id) => !foundIds.has(id));

  return { updated, missingIds };
};
