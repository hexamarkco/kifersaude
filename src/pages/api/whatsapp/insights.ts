import type { ApiRequest, ApiResponse } from '../types';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import type { WhatsappChatInsight } from '../../../types/whatsapp';
import { generateWhatsappChatInsight } from '../../../server/whatsappInsights';

const INSIGHT_COOLDOWN_MINUTES = 5;

const parseChatId = (req: ApiRequest): string | null => {
  const bodyChatId =
    req.body && typeof req.body === 'object' && 'chatId' in req.body
      ? (req.body as { chatId?: unknown }).chatId
      : null;

  if (typeof bodyChatId === 'string' && bodyChatId.trim()) {
    return bodyChatId.trim();
  }

  const queryChatId = req.query?.chatId;
  if (typeof queryChatId === 'string' && queryChatId.trim()) {
    return queryChatId.trim();
  }

  if (Array.isArray(queryChatId) && queryChatId[0] && queryChatId[0].trim()) {
    return queryChatId[0].trim();
  }

  return null;
};

const assertMethodAllowed = (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return false;
  }

  return true;
};

const hasRecentInsight = async (chatId: string) => {
  const cooldownStart = new Date(Date.now() - INSIGHT_COOLDOWN_MINUTES * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('whatsapp_chat_insights')
    .select('id, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<Pick<WhatsappChatInsight, 'id' | 'created_at'>>();

  if (error) {
    throw error;
  }

  if (!data?.created_at) {
    return { recent: false, retryAfterMinutes: 0 } as const;
  }

  const createdAt = new Date(data.created_at);
  const diffMs = Date.now() - createdAt.getTime();
  const remainingMs = INSIGHT_COOLDOWN_MINUTES * 60 * 1000 - diffMs;
  const retryAfterMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

  return { recent: createdAt >= cooldownStart, retryAfterMinutes } as const;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!assertMethodAllowed(req, res)) {
    return;
  }

  const chatId = parseChatId(req);
  if (!chatId) {
    return res.status(400).json({ error: 'chatId é obrigatório' });
  }

  try {
    const cooldown = await hasRecentInsight(chatId);
    if (cooldown.recent) {
      return res.status(429).json({
        error: `Aguarde alguns minutos antes de gerar um novo insight para este chat.`,
        retryAfterMinutes: cooldown.retryAfterMinutes,
      });
    }

    const insight = await generateWhatsappChatInsight(chatId);
    return res.status(200).json({ insight });
  } catch (error: any) {
    console.error('Erro ao gerar insight do WhatsApp:', error);
    return res.status(500).json({ error: 'Falha ao gerar insight para o chat.' });
  }
}
