import { supabaseAdmin } from '../lib/supabaseAdmin';
import type { WhatsappChat, WhatsappMessage } from '../types/whatsapp';

export type ChatUpsertInput = {
  phone: string;
  chatName?: string | null;
  isGroup?: boolean;
  senderPhoto?: string | null;
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
    senderPhoto,
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

  if (senderPhoto !== undefined) {
    updatePayload.sender_photo = senderPhoto;
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
      sender_photo: updatePayload.sender_photo ?? existingChat.sender_photo,
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
      sender_photo: senderPhoto ?? null,
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

  if (fromMe && status.toUpperCase() === 'RECEIVED') {
    return 'SENT';
  }

  return status;
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
