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
    title: 'Follow-up de decisão 1',
    description: 'Verificar se tem dúvidas e qual a previsão de decisão',
    priority: 'alta',
  },
  {
    status: 'Proposta enviada',
    daysAfter: 5,
    title: 'Follow-up de decisão 2',
    description: 'Reforçar benefícios da proposta e esclarecer dúvidas',
    priority: 'alta',
  },
  {
    status: 'Proposta enviada',
    daysAfter: 7,
    title: 'Follow-up de decisão 3',
    description: 'Verificar objeções e reforçar urgência da decisão',
    priority: 'media',
  },
  {
    status: 'Proposta enviada',
    daysAfter: 10,
    title: 'Último acompanhamento',
    description: 'Criar senso de urgência final e perguntar sobre objeções restantes',
    priority: 'media',
  },
];

export const createAutomaticFollowUps = async (
  leadId: string,
  status: string,
  responsavel: string
): Promise<void> => {
  const { data: customRules } = await supabase
    .from('follow_up_custom_rules')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', status)
    .eq('active', true);

  const rules = customRules && customRules.length > 0
    ? customRules.map(rule => ({
        status: rule.status,
        daysAfter: rule.days_after,
        title: rule.title,
        description: rule.description,
        priority: rule.priority,
      }))
    : FOLLOW_UP_RULES.filter((rule) => rule.status === status);

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
          tipo: customRules && customRules.length > 0 ? 'Follow-up Personalizado' : 'Follow-up',
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
    .in('tipo', ['Follow-up', 'Follow-up Personalizado'])
    .eq('lido', false);
};

export const createAdditionalFollowUps = async (
  leadId: string,
  count: number,
  intervalDays: number,
  startFromDays: number = 1
): Promise<void> => {
  const lead = await supabase
    .from('leads')
    .select('nome_completo, status')
    .eq('id', leadId)
    .single();

  if (!lead.data) return;

  for (let i = 0; i < count; i++) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + startFromDays + (i * intervalDays));
    followUpDate.setHours(9, 0, 0, 0);

    await supabase.from('reminders').insert([
      {
        lead_id: leadId,
        tipo: 'Follow-up Adicional',
        titulo: `Follow-up adicional ${i + 1} - ${lead.data.nome_completo}`,
        descricao: `Follow-up adicional após resposta do lead. Verificar andamento da decisão.`,
        data_lembrete: followUpDate.toISOString(),
        lido: false,
        prioridade: 'alta',
      },
    ]);
  }
};
