import type { ApiRequest, ApiResponse } from '../../types';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import type { WhatsappMessage } from '../../../../types/whatsapp';

type QueryParams = {
  id?: string | string[];
};

const extractChatId = (query: QueryParams | undefined): string | null => {
  if (!query) {
    return null;
  }

  const { id } = query;

  if (Array.isArray(id)) {
    return typeof id[0] === 'string' ? id[0] : null;
  }

  return typeof id === 'string' ? id : null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const chatId = extractChatId(req.query as QueryParams | undefined);

  if (!chatId) {
    return res.status(400).json({ error: 'Parâmetro id é obrigatório' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('moment', { ascending: true });

    if (error) {
      throw error;
    }

    return res.status(200).json({ messages: (data ?? []) as WhatsappMessage[] });
  } catch (error: any) {
    console.error('Erro ao carregar mensagens do WhatsApp:', error);
    return res.status(500).json({ error: 'Falha ao carregar mensagens' });
  }
}
