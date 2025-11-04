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

const toBusinessDayStart = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
};

const addBusinessDays = (date: Date, businessDays: number) => {
  const result = new Date(date);

  if (Number.isNaN(result.getTime())) {
    return result;
  }

  if (businessDays <= 0) {
    while (isWeekend(result)) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  let addedDays = 0;
  while (addedDays < businessDays) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      addedDays += 1;
    }
  }

  return result;
};

const calculateBusinessDayDelay = (originalDate: Date, completionDate: Date) => {
  const start = toBusinessDayStart(originalDate);
  const end = toBusinessDayStart(completionDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }

  let delay = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) {
      delay += 1;
    }
  }

  return delay;
};

export const reschedulePendingFollowUps = async (
  leadId: string,
  originalReminderDate: string | Date,
  completedAt: string | Date
): Promise<void> => {
  if (!leadId) return;

  const completionDate = new Date(completedAt);
  const originalDate = new Date(originalReminderDate);

  if (Number.isNaN(completionDate.getTime()) || Number.isNaN(originalDate.getTime())) {
    console.warn('Datas inválidas ao reagendar follow-ups automáticos.');
    return;
  }

  const delayInBusinessDays = calculateBusinessDayDelay(originalDate, completionDate);

  if (delayInBusinessDays <= 0) {
    return;
  }

  const { data: pendingReminders, error } = await supabase
    .from('reminders')
    .select('id, data_lembrete')
    .eq('lead_id', leadId)
    .in('tipo', [...AUTOMATIC_FOLLOW_UP_TYPES])
    .eq('lido', false)
    .order('data_lembrete', { ascending: true });

  if (error) {
    console.error('Erro ao buscar follow-ups pendentes para reagendamento:', error);
    return;
  }

  if (!pendingReminders || pendingReminders.length === 0) {
    return;
  }

  const originalDayStart = toBusinessDayStart(originalDate);

  for (const reminder of pendingReminders) {
    const currentDate = new Date(reminder.data_lembrete);

    if (Number.isNaN(currentDate.getTime())) {
      console.warn('Data de lembrete inválida ao reagendar follow-up pendente:', reminder);
      continue;
    }

    if (currentDate < originalDayStart) {
      continue;
    }

    const newDate = addBusinessDays(currentDate, delayInBusinessDays);

    while (isWeekend(newDate)) {
      newDate.setDate(newDate.getDate() + 1);
    }

    const { error: updateError } = await supabase
      .from('reminders')
      .update({ data_lembrete: newDate.toISOString() })
      .eq('id', reminder.id);

    if (updateError) {
      console.error('Erro ao reagendar follow-up pendente:', updateError);
    }
  }
};

export const reschedulePendingFollowUpsIfNeeded = async (
  reminder: Pick<Reminder, 'lead_id' | 'tipo' | 'data_lembrete'>,
  completedAt: string | Date
): Promise<void> => {
  if (!reminder?.lead_id) return;
  if (!AUTOMATIC_FOLLOW_UP_TYPES_SET.has(reminder.tipo)) {
    return;
  }

  await reschedulePendingFollowUps(reminder.lead_id, reminder.data_lembrete, completedAt);
};

export const rescheduleNextPendingFollowUp = reschedulePendingFollowUps;
export const rescheduleNextPendingFollowUpIfNeeded = reschedulePendingFollowUpsIfNeeded;

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
