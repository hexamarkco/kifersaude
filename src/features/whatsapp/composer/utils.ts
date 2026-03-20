import type {
  ContactRetryPayload,
  GifRetryPayload,
  IndexedQuickReplyItem,
  LocationRetryPayload,
  LinkPreviewRetryPayload,
  MediaRetryPayload,
  QuickReplyItem,
  TextRetryPayload,
} from './types';

export type QuickReplyPreviewItem = QuickReplyItem & {
  resolvedPreview: string;
  hasDynamicPreview: boolean;
};

export type SlashCommandState = {
  active: boolean;
  query: string;
  results: QuickReplyItem[];
};

export type ApplyLinePrefixResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export const normalizeQuickReplySearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const buildIndexedQuickReplies = (quickReplies: QuickReplyItem[]): IndexedQuickReplyItem[] =>
  quickReplies.map((reply) => ({
    ...reply,
    normalizedTitle: normalizeQuickReplySearch(reply.title),
    normalizedMessage: normalizeQuickReplySearch(reply.message),
  }));

export const filterQuickReplies = (
  indexedQuickReplies: IndexedQuickReplyItem[],
  rawQuery: string,
): QuickReplyItem[] => {
  const query = normalizeQuickReplySearch(rawQuery.trim());
  if (!query) {
    return indexedQuickReplies.map(({ normalizedTitle: _normalizedTitle, normalizedMessage: _normalizedMessage, ...reply }) => reply);
  }

  return indexedQuickReplies
    .filter((reply) => reply.normalizedTitle.includes(query) || reply.normalizedMessage.includes(query))
    .map(({ normalizedTitle: _normalizedTitle, normalizedMessage: _normalizedMessage, ...reply }) => reply);
};

export const buildQuickReplyPreviewItems = (
  quickReplies: QuickReplyItem[],
  applyTemplateVariables: (text: string) => string,
  enabled: boolean,
): QuickReplyPreviewItem[] => {
  if (!enabled) {
    return [];
  }

  return quickReplies.map((reply) => {
    const resolvedPreview = applyTemplateVariables(reply.message);
    return {
      ...reply,
      resolvedPreview,
      hasDynamicPreview: resolvedPreview !== reply.message,
    };
  });
};

export const buildSlashCommandState = (
  rawDraft: string,
  indexedQuickReplies: IndexedQuickReplyItem[],
): SlashCommandState => {
  const draft = rawDraft.trimStart();
  if (!draft.startsWith('/') || draft.includes('\n')) {
    return {
      active: false,
      query: '',
      results: [],
    };
  }

  const query = draft.slice(1).trim();
  const normalizedQuery = normalizeQuickReplySearch(query);
  const results = indexedQuickReplies
    .filter((reply) => !normalizedQuery || reply.normalizedTitle.includes(normalizedQuery))
    .map(({ normalizedTitle: _normalizedTitle, normalizedMessage: _normalizedMessage, ...reply }) => reply)
    .slice(0, 8);

  return {
    active: true,
    query,
    results,
  };
};

export const splitRewriteChunks = (text: string) =>
  text
    .split(/\n-{3,}\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

export const splitFollowUpLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const applyLinePrefix = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
): ApplyLinePrefixResult => {
  const lines = value.split('\n');
  const lineStarts: number[] = [];
  let offset = 0;

  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const findLineIndex = (position: number) => {
    for (let index = lineStarts.length - 1; index >= 0; index -= 1) {
      if (position >= lineStarts[index]) {
        return index;
      }
    }
    return 0;
  };

  const normalizedEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === '\n'
      ? selectionEnd - 1
      : selectionEnd;

  const startLineIndex = findLineIndex(selectionStart);
  const endLineIndex = findLineIndex(normalizedEnd);
  let insertedBeforeStart = 0;
  let insertedBeforeEnd = 0;

  const nextLines = lines.map((line, index) => {
    const shouldPrefix = index >= startLineIndex && index <= endLineIndex && line.trim().length > 0;
    if (!shouldPrefix) {
      return line;
    }

    if (index === startLineIndex) {
      insertedBeforeStart += prefix.length;
    }

    insertedBeforeEnd += prefix.length;
    return `${prefix}${line}`;
  });

  return {
    value: nextLines.join('\n'),
    selectionStart: selectionStart + insertedBeforeStart,
    selectionEnd: selectionEnd + insertedBeforeEnd,
  };
};

export const buildTextRetryPayload = (
  content: string,
  quotedMessageId?: string | null,
): TextRetryPayload => ({
  kind: 'text',
  content,
  quotedMessageId: quotedMessageId ?? null,
});

export const buildLinkPreviewRetryPayload = (
  body: string,
  preview: {
    title: string;
    description?: string;
    canonical?: string;
    image?: string;
  },
  quotedMessageId?: string | null,
): LinkPreviewRetryPayload => ({
  kind: 'link_preview',
  body,
  title: preview.title.trim(),
  description: preview.description?.trim() || undefined,
  canonical: preview.canonical?.trim() || undefined,
  preview: preview.image?.trim() || undefined,
  quotedMessageId: quotedMessageId ?? null,
});

export const buildGifRetryPayload = (
  url: string,
  options?: {
    preview?: string | null;
    caption?: string | null;
    quotedMessageId?: string | null;
  },
): GifRetryPayload => ({
  kind: 'gif',
  url: url.trim(),
  preview: options?.preview?.trim() || undefined,
  caption: options?.caption?.trim() || undefined,
  quotedMessageId: options?.quotedMessageId ?? null,
});

export const buildMediaRetryPayload = (
  mediaType: MediaRetryPayload['mediaType'],
  file: { name: string; type: string },
  dataUrl: string,
  options?: {
    caption?: string | null;
    quotedMessageId?: string | null;
    asVoice?: boolean;
    seconds?: number | null;
    recordingTime?: number | null;
  },
): MediaRetryPayload => ({
  kind: 'media',
  mediaType,
  fileName: file.name,
  mimeType: file.type,
  dataUrl,
  caption: options?.caption?.trim() || undefined,
  quotedMessageId: options?.quotedMessageId ?? null,
  asVoice: options?.asVoice === true,
  seconds: options?.seconds ?? null,
  recordingTime: options?.recordingTime ?? null,
});

export const buildLocationRetryPayload = (
  latitude: number,
  longitude: number,
  description?: string | null,
): LocationRetryPayload => ({
  kind: 'location',
  latitude,
  longitude,
  description: description?.trim() || undefined,
});

export const buildContactRetryPayload = (
  name: string,
  phone: string,
  quotedMessageId?: string | null,
): ContactRetryPayload => ({
  kind: 'contact',
  name: name.trim(),
  phone: phone.trim(),
  quotedMessageId: quotedMessageId ?? null,
});
