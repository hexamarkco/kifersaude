import type { WhatsappChatInsight, WhatsappChatInsightSentiment, WhatsappMessage } from '../types/whatsapp';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const getNlpProviderConfig = () => {
  const runtime = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const url = runtime?.env?.NLP_PROVIDER_URL;
  const apiKey = runtime?.env?.NLP_PROVIDER_API_KEY;

  if (!url) {
    throw new Error('NLP_PROVIDER_URL environment variable is not configured');
  }

  if (!apiKey) {
    throw new Error('NLP_PROVIDER_API_KEY environment variable is not configured');
  }

  return { url, apiKey };
};

const normalizeSentiment = (value: string | null | undefined): WhatsappChatInsightSentiment => {
  if (!value) {
    return 'neutral';
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('posit')) {
    return 'positive';
  }

  if (normalized.includes('negat')) {
    return 'negative';
  }

  return 'neutral';
};

const sortMessagesChronologically = (messages: WhatsappMessage[]): WhatsappMessage[] =>
  [...messages].sort((a, b) => {
    const dateA = a.moment ? new Date(a.moment).getTime() : 0;
    const dateB = b.moment ? new Date(b.moment).getTime() : 0;
    return dateA - dateB;
  });

const buildConversationPayload = (messages: WhatsappMessage[]): string => {
  if (messages.length === 0) {
    return 'Nenhuma mensagem recente encontrada.';
  }

  const sortedMessages = sortMessagesChronologically(messages);
  return sortedMessages
    .map(message => {
      const direction = message.from_me ? 'Agente' : 'Cliente';
      const timestamp = message.moment ?? 'sem data';
      const content = message.text ?? '[sem texto]';
      return `[${timestamp}] ${direction}: ${content}`;
    })
    .join('\n');
};

const fetchRecentMessages = async (chatId: string, limit = 30): Promise<WhatsappMessage[]> => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('moment', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
};

type NlpProviderPayload = {
  summary?: string;
  sentiment?: string;
};

const requestInsightFromProvider = async (conversation: string): Promise<NlpProviderPayload> => {
  const { url, apiKey } = getNlpProviderConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ conversation }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate insight: ${response.status} ${errorText}`);
  }

  return (await response.json()) as NlpProviderPayload;
};

export const generateWhatsappChatInsight = async (chatId: string): Promise<WhatsappChatInsight> => {
  if (!chatId) {
    throw new Error('chatId is required to generate WhatsApp insight');
  }

  const recentMessages = await fetchRecentMessages(chatId);
  const conversationPayload = buildConversationPayload(recentMessages);
  const providerResult = await requestInsightFromProvider(conversationPayload);

  const summary = providerResult.summary?.trim() || null;
  const sentiment = normalizeSentiment(providerResult.sentiment ?? null);

  const { data, error } = await supabaseAdmin
    .from('whatsapp_chat_insights')
    .insert({
      chat_id: chatId,
      summary,
      sentiment,
    })
    .select('*')
    .single<WhatsappChatInsight>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Failed to persist WhatsApp chat insight');
  }

  return data;
};
