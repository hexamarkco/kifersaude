import type { WhatsappChatInsight, WhatsappChatInsightSentiment, WhatsappMessage } from '../types/whatsapp';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const getOpenAiConfig = () => {
  const runtime = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;

  const apiKey = runtime?.env?.OPENAI_API_KEY;
  const apiUrl = runtime?.env?.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
  const model = runtime?.env?.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not configured');
  }

  return { apiKey, apiUrl, model };
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

type OpenAiChatCompletionMessage = {
  role?: string;
  content?: string | null;
};

type OpenAiChatCompletionResponse = {
  choices?: { message?: OpenAiChatCompletionMessage }[];
  error?: { message?: string };
};

const buildInsightPrompt = (conversation: string) => `Conversa recente com o cliente:\n\n${conversation}\n\nGere um resumo curto (máximo 400 caracteres) destacando o contexto e próximos passos sugeridos. Informe também o sentimento geral (positivo, neutro ou negativo). Retorne apenas um objeto JSON com as chaves \"summary\" e \"sentiment\".`;

const requestInsightFromProvider = async (conversation: string): Promise<NlpProviderPayload> => {
  const { apiKey, apiUrl, model } = getOpenAiConfig();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente que gera resumos de conversas do WhatsApp para equipes de vendas e atendimento. Seja conciso e não invente informações.',
        },
        {
          role: 'user',
          content: buildInsightPrompt(conversation),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'whatsapp_chat_insight',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string', description: 'Resumo curto da conversa' },
              sentiment: {
                type: 'string',
                description: 'Sentimento geral percebido na conversa',
                enum: ['positivo', 'positivo(a)', 'positiva', 'neutro', 'negativo', 'negativa', 'negativo(a)'],
              },
            },
            required: ['summary', 'sentiment'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate insight: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as OpenAiChatCompletionResponse;

  if (payload?.error?.message) {
    throw new Error(payload.error.message);
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI response did not include a message content.');
  }

  try {
    return JSON.parse(content) as NlpProviderPayload;
  } catch (error) {
    throw new Error('Failed to parse OpenAI insight response');
  }
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
