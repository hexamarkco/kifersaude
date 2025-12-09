import { supabase } from './supabase';

export const createAdditionalFollowUps = async (
  leadId: string,
  count: number,
  intervalDays: number,
  startFromDays: number = 1
): Promise<void> => {
  const { data: leadData, error } = await supabase
    .from('leads')
    .select('nome_completo')
    .eq('id', leadId)
    .single();

  if (error || !leadData) {
    console.error('Não foi possível localizar o lead para criar lembretes adicionais.', error);
    return;
  }

  for (let index = 0; index < count; index += 1) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + startFromDays + index * intervalDays);
    followUpDate.setHours(9, 0, 0, 0);

    await supabase.from('reminders').insert([
      {
        lead_id: leadId,
        tipo: 'Follow-up Adicional',
        titulo: `Follow-up adicional ${index + 1} - ${leadData.nome_completo}`,
        descricao: 'Follow-up manual adicional registrado pelo usuário.',
        data_lembrete: followUpDate.toISOString(),
        lido: false,
        prioridade: 'alta',
      },
    ]);
  }
};
