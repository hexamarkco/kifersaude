import { supabase } from './supabase';

export type FollowUpRule = {
  status: string;
  daysAfter: number;
  title: string;
  description: string;
  priority: 'baixa' | 'media' | 'alta';
};

const FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    status: 'Novo',
    daysAfter: 1,
    title: 'Primeiro contato com novo lead',
    description: 'Fazer primeiro contato para se apresentar e entender necessidades',
    priority: 'alta',
  },
  {
    status: 'Em contato',
    daysAfter: 3,
    title: 'Acompanhamento de qualificação',
    description: 'Verificar se conseguiu coletar todas informações necessárias para cotação',
    priority: 'alta',
  },
  {
    status: 'Cotando',
    daysAfter: 2,
    title: 'Enviar proposta',
    description: 'Enviar proposta com comparativo de planos cotados',
    priority: 'alta',
  },
  {
    status: 'Proposta enviada',
    daysAfter: 1,
    title: 'Confirmar recebimento da proposta',
    description: 'Ligar para confirmar que recebeu e entendeu a proposta',
    priority: 'alta',
  },
  {
    status: 'Proposta enviada',
    daysAfter: 3,
    title: 'Follow-up de decisão',
    description: 'Verificar se tem dúvidas e qual a previsão de decisão',
    priority: 'alta',
  },
  {
    status: 'Proposta enviada',
    daysAfter: 7,
    title: 'Último acompanhamento',
    description: 'Criar senso de urgência e perguntar sobre objeções',
    priority: 'media',
  },
];

export const createAutomaticFollowUps = async (
  leadId: string,
  status: string,
  responsavel: string
): Promise<void> => {
  const rules = FOLLOW_UP_RULES.filter((rule) => rule.status === status);

  for (const rule of rules) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + rule.daysAfter);
    followUpDate.setHours(9, 0, 0, 0);

    const existingReminder = await supabase
      .from('reminders')
      .select('id')
      .eq('lead_id', leadId)
      .eq('titulo', rule.title)
      .eq('lido', false)
      .maybeSingle();

    if (!existingReminder.data) {
      await supabase.from('reminders').insert([
        {
          lead_id: leadId,
          tipo: 'Follow-up',
          titulo: rule.title,
          descricao: rule.description,
          data_lembrete: followUpDate.toISOString(),
          lido: false,
          prioridade: rule.priority,
        },
      ]);
    }
  }
};

export const cancelFollowUps = async (leadId: string): Promise<void> => {
  await supabase
    .from('reminders')
    .delete()
    .eq('lead_id', leadId)
    .eq('tipo', 'Follow-up')
    .eq('lido', false);
};
