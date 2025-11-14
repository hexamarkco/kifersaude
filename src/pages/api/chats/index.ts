import type { ApiRequest, ApiResponse } from '../types';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import type { WhatsappChat } from '../../../types/whatsapp';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_chats')
      .select('*')
      .order('is_archived', { ascending: true })
      .order('is_pinned', { ascending: false })
      .order('last_message_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({ chats: (data ?? []) as WhatsappChat[] });
  } catch (error: any) {
    console.error('Erro ao carregar chats do WhatsApp:', error);
    return res.status(500).json({ error: 'Falha ao carregar chats' });
  }
}
