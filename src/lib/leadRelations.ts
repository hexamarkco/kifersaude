import { ConfigOption, Lead, LeadOrigem, LeadStatusConfig } from './supabase';

type LeadRelationLookups = {
  origins: LeadOrigem[];
  statuses: LeadStatusConfig[];
  tipoContratacao: ConfigOption[];
  responsaveis: ConfigOption[];
};

const findLabelById = (collection: { id: string; label?: string; nome?: string }[], id?: string | null) => {
  if (!id) return null;
  const match = collection.find((item) => item.id === id);
  if (!match) return null;

  if ('nome' in match && typeof match.nome === 'string') {
    return match.nome;
  }

  if ('label' in match && typeof match.label === 'string') {
    return match.label;
  }

  return null;
};

export const mapLeadRelations = (
  lead: Lead,
  lookups: LeadRelationLookups,
): Lead => {
  return {
    ...lead,
    origem: lead.origem ?? findLabelById(lookups.origins, lead.origem_id),
    tipo_contratacao:
      lead.tipo_contratacao ?? findLabelById(lookups.tipoContratacao, lead.tipo_contratacao_id),
    status: lead.status ?? findLabelById(lookups.statuses, lead.status_id),
    responsavel: lead.responsavel ?? findLabelById(lookups.responsaveis, lead.responsavel_id),
  };
};

export const resolveStatusIdByName = (statuses: LeadStatusConfig[], name: string | null | undefined) => {
  if (!name) return null;
  const match = statuses.find((status) => status.nome === name);
  return match?.id ?? null;
};

export const resolveResponsavelIdByLabel = (options: ConfigOption[], label: string | null | undefined) => {
  if (!label) return null;
  const match = options.find((option) => option.label === label);
  return match?.id ?? null;
};

