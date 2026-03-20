export type SentMessagePayload = {
  id: string;
  local_ref?: string | null;
  chat_id: string;
  body: string | null;
  type: string | null;
  has_media: boolean;
  timestamp: string;
  direction: 'outbound';
  created_at: string;
  ack_status?: number | null;
  send_state?: 'pending' | 'failed' | null;
  error_message?: string | null;
  retry_payload?: OutboundRetryPayload | null;
  payload?: Record<string, unknown> | null;
};

export type OutboundRetryPayload =
  | {
      kind: 'text';
      content: string;
      quotedMessageId?: string | null;
    }
  | {
      kind: 'link_preview';
      body: string;
      title: string;
      description?: string;
      canonical?: string;
      preview?: string;
      quotedMessageId?: string | null;
    }
  | {
      kind: 'gif';
      url: string;
      preview?: string;
      caption?: string;
      quotedMessageId?: string | null;
    }
  | {
      kind: 'media';
      mediaType: 'image' | 'sticker' | 'video' | 'audio' | 'document' | 'voice';
      fileName: string;
      mimeType: string;
      dataUrl: string;
      caption?: string;
      quotedMessageId?: string | null;
      asVoice?: boolean;
      seconds?: number | null;
      recordingTime?: number | null;
    }
  | {
      kind: 'location';
      latitude: number;
      longitude: number;
      description?: string;
    }
  | {
      kind: 'contact';
      name: string;
      phone: string;
      quotedMessageId?: string | null;
    };

export type TextRetryPayload = Extract<OutboundRetryPayload, { kind: 'text' }>;
export type LinkPreviewRetryPayload = Extract<OutboundRetryPayload, { kind: 'link_preview' }>;
export type GifRetryPayload = Extract<OutboundRetryPayload, { kind: 'gif' }>;
export type MediaRetryPayload = Extract<OutboundRetryPayload, { kind: 'media' }>;
export type LocationRetryPayload = Extract<OutboundRetryPayload, { kind: 'location' }>;
export type ContactRetryPayload = Extract<OutboundRetryPayload, { kind: 'contact' }>;

export type FollowUpGenerationContext = {
  leadName?: string;
  conversationHistory?: string;
  leadContext?: Record<string, unknown> | string | null;
};

export interface MessageInputProps {
  chatId: string;
  onMessageSent?: (message?: SentMessagePayload) => void;
  contacts?: Array<{ id: string; name: string; saved: boolean; pushname?: string }>;
  templateVariables?: Record<string, string>;
  templateVariableShortcuts?: Array<{ key: string; label: string }>;
  replyToMessage?: {
    id: string;
    body: string;
    from: string;
  } | null;
  onCancelReply?: () => void;
  editMessage?: {
    id: string;
    body: string;
  } | null;
  onCancelEdit?: () => void;
  followUpContext?: FollowUpGenerationContext | null;
  onPrepareFollowUpContext?: () => Promise<FollowUpGenerationContext | null>;
}

export type QuickReplyItem = {
  id: string;
  title: string;
  message: string;
};

export type IndexedQuickReplyItem = QuickReplyItem & {
  normalizedTitle: string;
  normalizedMessage: string;
};

export type EmojiEntry = {
  value: string;
  keywords: string[];
};

export type EmojiCategoryId =
  | 'recent'
  | 'smileys'
  | 'people'
  | 'animals'
  | 'food'
  | 'activities'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags';

export type GiphyGifItem = {
  id: string;
  title: string;
  pageUrl: string;
  gifUrl: string;
  previewUrl: string;
  stillUrl: string;
  mp4Url: string;
};

export type MediaPickerTabId = 'emoji' | 'gif' | 'sticker';

export type StickerLibraryItem = {
  id: string;
  name: string;
  mimeType: string;
  previewUrl: string;
  dataUrl: string;
  lastUsedAt: number;
};

export type RecentStickerItem = StickerLibraryItem;
export type SavedStickerItem = StickerLibraryItem;
