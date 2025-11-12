import { type WhatsAppConversation } from './supabase';
import { type WhatsAppQuickReply } from './whatsappQuickRepliesService';

export type QuickReplyRankingContext = {
  conversationHistory?: WhatsAppConversation[];
  searchTerm?: string;
  additionalKeywords?: string[];
};

const RECENCY_WINDOW_DAYS = 60;

const tokenize = (text: string | null | undefined): string[] => {
  if (!text) {
    return [];
  }

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
};

const computeRecencyBoost = (reply: WhatsAppQuickReply): number => {
  const referenceDate = reply.updated_at ?? reply.created_at;
  if (!referenceDate) {
    return 0;
  }

  const updatedAt = new Date(referenceDate).getTime();
  if (Number.isNaN(updatedAt)) {
    return 0;
  }

  const now = Date.now();
  const elapsedMs = now - updatedAt;
  const windowMs = RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  if (elapsedMs <= 0) {
    return 1;
  }

  if (elapsedMs >= windowMs) {
    return 0;
  }

  return 1 - elapsedMs / windowMs;
};

const collectContextKeywords = (
  context: QuickReplyRankingContext
): Set<string> => {
  const keywords = new Set<string>();

  if (context.additionalKeywords) {
    context.additionalKeywords
      .flatMap((keyword) => tokenize(keyword))
      .forEach((token) => keywords.add(token));
  }

  const history = context.conversationHistory;
  if (history && history.length > 0) {
    const lastIncoming = [...history]
      .reverse()
      .find((message) => message.message_type === 'received');

    if (lastIncoming) {
      tokenize(lastIncoming.message_text).forEach((token) => keywords.add(token));
      tokenize(lastIncoming.media_caption).forEach((token) => keywords.add(token));
    }
  }

  return keywords;
};

const scoreQuickReply = (
  reply: WhatsAppQuickReply,
  context: QuickReplyRankingContext,
  conversationKeywords: Set<string>
): number => {
  let score = 0;

  if (reply.is_favorite) {
    score += 3;
  }

  const replyTokens = new Set([
    ...tokenize(reply.title),
    ...tokenize(reply.content),
    ...tokenize(reply.category ?? undefined),
  ]);

  if (conversationKeywords.size > 0) {
    conversationKeywords.forEach((keyword) => {
      if (replyTokens.has(keyword)) {
        score += 2;
      }
    });
  }

  if (context.searchTerm) {
    const searchTokens = tokenize(context.searchTerm);
    const matches = searchTokens.filter((token) => replyTokens.has(token)).length;
    if (matches > 0) {
      score += matches * 1.5;
    }
  }

  score += computeRecencyBoost(reply);

  return score;
};

export const rankQuickRepliesForConversation = (
  replies: WhatsAppQuickReply[],
  context: QuickReplyRankingContext = {}
): WhatsAppQuickReply[] => {
  if (!replies.length) {
    return replies;
  }

  const conversationKeywords = collectContextKeywords(context);

  return [...replies].sort((a, b) => {
    const scoreA = scoreQuickReply(a, context, conversationKeywords);
    const scoreB = scoreQuickReply(b, context, conversationKeywords);

    if (scoreA === scoreB) {
      return a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
    }

    return scoreB - scoreA;
  });
};

export const findTopQuickReplies = (
  replies: WhatsAppQuickReply[],
  context: QuickReplyRankingContext,
  limit = 3
): WhatsAppQuickReply[] => {
  if (limit <= 0) {
    return [];
  }

  return rankQuickRepliesForConversation(replies, context).slice(0, limit);
};
