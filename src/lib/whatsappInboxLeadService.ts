import { supabase } from './supabase';

export type WhatsAppInboxLeadSummary = {
  id: string;
  nome_completo: string;
  telefone: string;
  status?: string | null;
  responsavel_id?: string | null;
};

export async function searchWhatsAppInboxLeads(params?: {
  query?: string;
  phoneNumbers?: string[];
  limit?: number;
}): Promise<WhatsAppInboxLeadSummary[]> {
  const { data, error } = await supabase.rpc('search_whatsapp_inbox_leads', {
    p_query: params?.query?.trim() || null,
    p_phone_numbers: params?.phoneNumbers?.length ? params.phoneNumbers : null,
    p_limit: params?.limit ?? 200,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as WhatsAppInboxLeadSummary[]);
}
