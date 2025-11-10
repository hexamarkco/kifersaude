import { supabase } from './supabase';
import type { Reminder } from './supabase';

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
    status: 'Contato iniciado',
    daysAfter: 2,
    title: 'Aguardar retorno do lead',
    description: 'Verificar se o lead retornou o contato inicial',
    priority: 'alta',
  },
  {
    status: 'Contato iniciado',
    daysAfter: 5,
    title: 'Segundo contato de follow-up',
    description: 'Tentar novo contato caso não tenha obtido retorno',
    priority: 'media',
  },
  {
    status: 'Em atendimento',
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

export const AUTOMATIC_FOLLOW_UP_TYPES = ['Follow-up', 'Follow-up Personalizado'] as const;
const AUTOMATIC_FOLLOW_UP_TYPES_SET = new Set<string>(AUTOMATIC_FOLLOW_UP_TYPES);

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const addBusinessDays = (date: Date, days: number) => {
  const result = new Date(date);
  if (days === 0) {
    return result;
  }

  const direction = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);

  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }

  return result;
};

const normalizeToMorning = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(9, 0, 0, 0);
  return normalized;
};

const getNextBusinessMorning = (date: Date) => {
  let nextDate = normalizeToMorning(addBusinessDays(date, 1));

  while (isWeekend(nextDate)) {
    nextDate = normalizeToMorning(addBusinessDays(nextDate, 1));
  }

  return nextDate;
};

const calculateNextReminderDate = (completionDate: Date) => {
  let nextDate = getNextBusinessMorning(completionDate);
  const comparisonMoment = Math.max(completionDate.getTime(), Date.now());

  while (nextDate.getTime() <= comparisonMoment) {
    nextDate = getNextBusinessMorning(nextDate);
  }

  return nextDate;
};

export const rescheduleNextPendingFollowUp = async (
  leadId: string,
  completedAt: string | Date
): Promise<void> => {
  if (!leadId) return;

  const completionDate = new Date(completedAt);
  if (Number.isNaN(completionDate.getTime())) {
    console.warn('Data de conclusão inválida ao reagendar follow-up.');
    return;
  }

  const { data: nextReminder, error } = await supabase
    .from('reminders')
    .select('id')
    .eq('lead_id', leadId)
    .in('tipo', [...AUTOMATIC_FOLLOW_UP_TYPES])
    .eq('lido', false)
    .order('data_lembrete', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar próximo follow-up pendente:', error);
    return;
  }

  if (!nextReminder) {
    return;
  }

  const nextReminderDate = calculateNextReminderDate(completionDate).toISOString();

  const { error: updateError } = await supabase
    .from('reminders')
    .update({ data_lembrete: nextReminderDate })
    .eq('id', nextReminder.id);

  if (updateError) {
    console.error('Erro ao reagendar follow-up pendente:', updateError);
  }
};

export const rescheduleNextPendingFollowUpIfNeeded = async (
  reminder: Pick<Reminder, 'lead_id' | 'tipo'>,
  completedAt: string | Date
): Promise<void> => {
  if (!reminder?.lead_id) return;
  if (!AUTOMATIC_FOLLOW_UP_TYPES_SET.has(reminder.tipo)) {
    return;
  }

  await rescheduleNextPendingFollowUp(reminder.lead_id, completedAt);
};

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
          responsavel,
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
