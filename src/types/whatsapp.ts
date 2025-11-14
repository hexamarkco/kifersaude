export type WhatsappChat = {
  id: string;
  phone: string;
  chat_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  is_group: boolean;
  sender_photo: string | null;
  display_name?: string | null;
};

export type WhatsappMessage = {
  id: string;
  chat_id: string;
  message_id: string | null;
  from_me: boolean;
  status: string | null;
  text: string | null;
  moment: string | null;
  raw_payload: Record<string, any> | null;
};

export type WhatsappChatMetadataNote = {
  id: string | null;
  content: string | null;
  createdAt: number | null;
  createdAtIso: string | null;
  lastUpdateAt: number | null;
  lastUpdateAtIso: string | null;
};

export type WhatsappChatMetadata = {
  phone: string | null;
  unread: number | null;
  lastMessageTime: string | number | null;
  lastMessageTimestamp: number | null;
  lastMessageAt: string | null;
  isMuted: boolean | null;
  isMarkedSpam: boolean | null;
  profileThumbnail: string | null;
  isGroupAnnouncement: boolean | null;
  isGroup: boolean | null;
  about: string | null;
  notes: WhatsappChatMetadataNote | null;
  raw: Record<string, unknown> | null;
};
