import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

/** Keep the API's date input backed by an agenda item, like the lead form. */
export async function persistRequestedLeadFollowUp(
  supabase: SupabaseClient,
  lead: { id: string; nome_completo: string; proximo_retorno?: string | null },
  requestedDate: string | null | undefined,
): Promise<string | null> {
  if (!requestedDate) return lead.proximo_retorno ?? null;
  if (requestedDate) {
    const { data: existing, error: lookupError } = await supabase
      .from('reminders')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('lido', false)
      .is('cancelled_at', null)
      .in('tipo', ['Follow-up', 'Retorno'])
      .order('data_lembrete', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const values = { tipo: 'Follow-up', titulo: `Follow-up: ${lead.nome_completo}`, data_lembrete: requestedDate };
    const { error } = existing
      ? await supabase.from('reminders').update(values).eq('id', existing.id)
      : await supabase.from('reminders').insert({ ...values, lead_id: lead.id, lido: false, prioridade: 'normal' });
    if (error) throw new Error(error.message);
  }
  const { data, error } = await supabase.rpc('get_lead_pending_reminder_date', { p_lead_id: lead.id });
  if (error) throw new Error(error.message);
  return data ?? null;
}
