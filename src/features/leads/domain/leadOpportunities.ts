import type { Database } from '../../../infrastructure/supabase';

export const opportunityStatusLabels = {
  open: 'Em andamento', qualified: 'Necessidade definida', proposal: 'Proposta enviada', won: 'Contratação concluída', lost: 'Não avançou',
} as const;
export type OpportunityStatus = keyof typeof opportunityStatusLabels;
export type RelatedLead = { id: string; name: string; phone: string | null; status: string | null };
export type LeadOpportunityMember = { lead_id: string; name: string; status: string | null; is_primary_contact: boolean };
export type LeadOpportunity = Pick<Database['public']['Tables']['opportunities']['Row'],
  'id' | 'name' | 'archived' | 'primary_contact_lead_id' | 'updated_at'> & {
  status: OpportunityStatus;
  members: LeadOpportunityMember[];
  member_lead_ids: string[];
  member_count: number;
  members_truncated: boolean;
};
export type LeadOpportunitiesSnapshot = { opportunities: LeadOpportunity[]; truncated: boolean };
export type CreateLeadOpportunity = { name: string; memberLeadIds: string[]; primaryContactLeadId: string; clientRequestId: string };
export type ChangeLeadOpportunity = { opportunityId: string; expectedUpdatedAt: string } & (
  | { action: 'add' | 'remove' | 'primary'; leadId: string }
  | { action: 'status'; status: OpportunityStatus }
);

export const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isOpportunityStatus = (value: unknown): value is OpportunityStatus => typeof value === 'string' && Object.prototype.hasOwnProperty.call(opportunityStatusLabels, value);

export function parseLeadOpportunities(value: unknown): LeadOpportunitiesSnapshot {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.opportunities) || typeof value.opportunities_truncated !== 'boolean') {
    throw new Error('Não foi possível confirmar os vínculos desta pessoa. Tente novamente.');
  }
  const opportunities = value.opportunities.map((item): LeadOpportunity => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || !isOpportunityStatus(item.status)
      || typeof item.archived !== 'boolean' || typeof item.updated_at !== 'string' || !Array.isArray(item.members)
      || !Array.isArray(item.member_lead_ids) || !item.member_lead_ids.every((id) => typeof id === 'string')
      || typeof item.member_count !== 'number' || typeof item.members_truncated !== 'boolean'
      || (item.primary_contact_lead_id !== null && typeof item.primary_contact_lead_id !== 'string')) {
      throw new Error('Os vínculos vieram incompletos. Atualize a consulta antes de editar.');
    }
    const members = item.members.map((member): LeadOpportunityMember => {
      if (!isRecord(member) || typeof member.lead_id !== 'string' || typeof member.name !== 'string'
        || (member.status !== null && typeof member.status !== 'string')
        || (member.is_primary_contact !== null && typeof member.is_primary_contact !== 'boolean')) {
        throw new Error('Não foi possível identificar todos os contatos da negociação.');
      }
      return { lead_id: member.lead_id, name: member.name, status: member.status, is_primary_contact: member.is_primary_contact === true };
    });
    return { id: item.id, name: item.name, status: item.status, archived: item.archived,
      primary_contact_lead_id: item.primary_contact_lead_id, updated_at: item.updated_at, members,
      member_lead_ids: item.member_lead_ids as string[], member_count: item.member_count, members_truncated: item.members_truncated };
  });
  return { opportunities, truncated: value.opportunities_truncated };
}
