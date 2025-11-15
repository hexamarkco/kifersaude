import type { ApiRequest, ApiResponse } from '../types';
import { processScheduledMessages } from '../../../server/whatsappScheduler';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const results = await processScheduledMessages();
    return res.status(200).json({ processed: results.length, results });
  } catch (error: any) {
    console.error('Erro ao processar mensagens agendadas:', error);
    return res.status(500).json({ error: 'Falha ao processar agendamentos' });
  }
}
