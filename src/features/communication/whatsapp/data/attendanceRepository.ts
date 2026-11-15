import { databaseClient } from '../../../../infrastructure/supabase';
import { presentAttendanceBriefing } from '../domain/attendanceBriefing';

export async function loadAttendanceBriefing(chatId: string, leadId: string) {
  const { data, error } = await databaseClient.from('ai_autonomous_qualification_states').select('state, updated_at')
    .eq('chat_id', chatId).eq('lead_id', leadId).maybeSingle();
  if (error) throw new Error('Não foi possível carregar o resumo do atendimento.');
  return data ? presentAttendanceBriefing(data.state, data.updated_at) : null;
}
