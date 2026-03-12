import type {
  IndexedQuickReplyItem,
  LinkPreviewRetryPayload,
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
