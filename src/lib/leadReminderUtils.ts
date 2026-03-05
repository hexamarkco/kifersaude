import { supabase } from './supabase';

const stripDiacritics = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const normalizeLeadStatusLabel = (status: string | null | undefined) => {
  if (!status) return '';
  return stripDiacritics(status).trim().toLowerCase();
};

export const shouldPromptFirstReminderAfterQuote = (status: string | null | undefined) => {
  const normalizedStatus = normalizeLeadStatusLabel(status);
  return normalizedStatus === 'proposta enviada' || normalizedStatus === 'cotacao enviada';
};

export const getNextUpcomingUnreadReminderDate = async (
  leadId: string,
  nowIso: string = new Date().toISOString(),
) => {
  if (!leadId) return null;

  const { data, error } = await supabase
    .from('reminders')
    .select('data_lembrete')
    .eq('lead_id', leadId)
    .eq('lido', false)
    .gte('data_lembrete', nowIso)
    .order('data_lembrete', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.data_lembrete ?? null;
};

export const syncLeadNextReturnFromUpcomingReminder = async (
  leadId: string,
  nowIso: string = new Date().toISOString(),
) => {
  if (!leadId) return null;

  const nextReturnDate = await getNextUpcomingUnreadReminderDate(leadId, nowIso);

  const { error } = await supabase
    .from('leads')
    .update({ proximo_retorno: nextReturnDate })
    .eq('id', leadId);

  if (error) throw error;
  return nextReturnDate;
};
