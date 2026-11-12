import { databaseClient, supabase } from '../../../infrastructure/supabase';
import {
  isRecord, parseLeadOpportunities, type ChangeLeadOpportunity, type CreateLeadOpportunity, type RelatedLead,
} from '../domain/leadOpportunities';

async function invoke(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('lead-opportunities', { body });
  if (error) throw new Error('Não foi possível consultar ou salvar os vínculos. Tente novamente.');
  if (!isRecord(data) || data.success !== true) {
    const detail = isRecord(data) && isRecord(data.error) ? data.error : null;
    if (detail?.code === 'STALE_WRITE') throw new Error('Esta negociação foi alterada por outra pessoa. Atualize os vínculos antes de tentar novamente.');
    throw new Error(detail && typeof detail.message === 'string' ? detail.message : 'Não foi possível confirmar a alteração dos vínculos. Atualize a consulta.');
  }
  return data;
}

export const leadOpportunitiesRepository = {
  async list(leadId: string) {
    return parseLeadOpportunities(await invoke({ action: 'list', leadId }));
  },
  async create(input: CreateLeadOpportunity): Promise<void> {
    const result = await invoke({ action: 'create', ...input });
    if (!isRecord(result) || !isRecord(result.opportunity) || typeof result.opportunity.id !== 'string') {
      throw new Error('Não foi possível confirmar o vínculo. Atualize a consulta antes de tentar novamente.');
    }
  },
  async change(input: ChangeLeadOpportunity): Promise<void> {
    const result = await invoke(input);
    if (!isRecord(result) || !isRecord(result.opportunity) || result.opportunity.id !== input.opportunityId) {
      throw new Error('Não foi possível confirmar a alteração. Atualize a consulta antes de tentar novamente.');
    }
  },
  async search(search: string): Promise<RelatedLead[]> {
    // Keep the PostgREST filter grammar and wildcard characters out of user input.
    const query = search.replace(/[,().%_*\\"]/g, ' ').trim().slice(0, 100);
    if (query.length < 2) return [];
    const { data, error } = await databaseClient.from('leads')
      .select('id, nome_completo, telefone, status').eq('arquivado', false)
      .or(`nome_completo.ilike.%${query}%,telefone.ilike.%${query}%`)
      .order('nome_completo').limit(20);
    if (error) throw new Error('Não foi possível buscar os contatos. Tente novamente.');
    return (data ?? []).map((lead) => ({ id: lead.id, name: lead.nome_completo, phone: lead.telefone, status: lead.status }));
  },
};
