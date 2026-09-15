import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type OpportunityActor = { actorId: string };
type ActionResult = { success: boolean; [key: string]: unknown };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const invalid = (message: string): ActionResult => ({ success: false, error_code: 'INVALID_INPUT', message });
const internal = (): ActionResult => ({ success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível executar a ação de oportunidade.' });

export const MCP_OPPORTUNITY_WRITE_TOOL_NAMES = [
  'kifer_create_opportunity',
  'kifer_update_opportunity',
  'kifer_archive_opportunity',
  'kifer_add_lead_to_opportunity',
  'kifer_remove_lead_from_opportunity',
  'kifer_set_opportunity_primary_contact',
] as const;

export const MCP_OPPORTUNITY_TOOLS = [
  {
    name: 'kifer_create_opportunity',
    description: 'Cria uma oportunidade comercial e associa leads opcionalmente. client_request_id torna repetições idempotentes; a criação é auditada e exige OAuth admin.',
    inputSchema: {
      type: 'object', required: ['client_request_id', 'name'], additionalProperties: false,
      properties: {
        client_request_id: { type: 'string', minLength: 1, maxLength: 128 },
        name: { type: 'string', minLength: 1, maxLength: 160 },
        status: { type: 'string', enum: ['open', 'qualified', 'proposal', 'won', 'lost'], default: 'open' },
        responsavel: { type: ['string', 'null'], maxLength: 160 },
        origem: { type: ['string', 'null'], maxLength: 160 },
        notes: { type: ['string', 'null'], maxLength: 8000 },
        member_lead_ids: { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string', format: 'uuid' } },
        primary_contact_lead_id: { type: ['string', 'null'], format: 'uuid' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_opportunity',
    description: 'Consulta uma oportunidade comercial, incluindo até 50 membros ativos e contagem de histórico. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['opportunity_id'], additionalProperties: false, properties: { opportunity_id: { type: 'string', format: 'uuid' } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_opportunity_360',
    description: 'Consulta a oportunidade com resumo dos membros ativos, contato principal e histórico de associação. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['opportunity_id'], additionalProperties: false, properties: { opportunity_id: { type: 'string', format: 'uuid' } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_update_opportunity',
    description: 'Atualiza apenas os campos comerciais permitidos e exige expected_updated_at; envie somente alterações intencionais. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object', required: ['opportunity_id', 'expected_updated_at', 'changes'], additionalProperties: false,
      properties: {
        opportunity_id: { type: 'string', format: 'uuid' },
        expected_updated_at: { type: 'string', format: 'date-time' },
        changes: {
          type: 'object', minProperties: 1, additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 160 },
            status: { type: 'string', enum: ['open', 'qualified', 'proposal', 'won', 'lost'] },
            responsavel: { type: ['string', 'null'], maxLength: 160 },
            origem: { type: ['string', 'null'], maxLength: 160 },
            notes: { type: ['string', 'null'], maxLength: 8000 },
          },
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_archive_opportunity',
    description: 'Arquiva uma oportunidade sem apagar membros nem histórico. Exige expected_updated_at. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['opportunity_id', 'expected_updated_at'], additionalProperties: false, properties: { opportunity_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_add_lead_to_opportunity',
    description: 'Associa um lead ativo à oportunidade sem remover associações com outros ciclos. Exige expected_updated_at. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['opportunity_id', 'lead_id', 'expected_updated_at'], additionalProperties: false, properties: { opportunity_id: { type: 'string', format: 'uuid' }, lead_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, member_role: { type: 'string', minLength: 1, maxLength: 64, default: 'member' } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_remove_lead_from_opportunity',
    description: 'Remove logicamente um lead da oportunidade, preservando histórico. O contato principal precisa ser alterado antes. Exige expected_updated_at. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['opportunity_id', 'lead_id', 'expected_updated_at'], additionalProperties: false, properties: { opportunity_id: { type: 'string', format: 'uuid' }, lead_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_set_opportunity_primary_contact',
    description: 'Define ou limpa o contato principal; o lead informado deve ser membro ativo da oportunidade. Exige expected_updated_at. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['opportunity_id', 'expected_updated_at'], additionalProperties: false, properties: { opportunity_id: { type: 'string', format: 'uuid' }, primary_contact_lead_id: { type: ['string', 'null'], format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
] as const;

async function callOpportunityRpc(
  supabase: SupabaseClient,
  functionName: string,
  parameters: Record<string, unknown>,
): Promise<ActionResult> {
  const { data, error } = await supabase.rpc(functionName, parameters);
  if (error || !isRecord(data) || typeof data.success !== 'boolean') return internal();
  return data as ActionResult;
}

export async function executeMcpOpportunityReadAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actorId: string;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actorId } = params;
  if (toolName !== 'kifer_get_opportunity' && toolName !== 'kifer_get_opportunity_360') return null;
  const opportunityId = text(args.opportunity_id);
  if (!UUID.test(opportunityId) || !UUID.test(actorId)) return invalid('Informe opportunity_id válido.');
  return callOpportunityRpc(
    supabase,
    toolName === 'kifer_get_opportunity_360' ? 'mcp_get_opportunity_360' : 'mcp_get_opportunity',
    { p_actor_user_id: actorId, p_opportunity_id: opportunityId },
  );
}

export async function executeMcpOpportunityWriteAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: OpportunityActor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_OPPORTUNITY_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (!UUID.test(actor.actorId)) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };

  if (toolName === 'kifer_create_opportunity') {
    const memberLeadIds = args.member_lead_ids === undefined ? [] : args.member_lead_ids;
    if (!Array.isArray(memberLeadIds) || memberLeadIds.some((id) => typeof id !== 'string' || !UUID.test(id))) return invalid('member_lead_ids deve conter UUIDs válidos.');
    const primaryContact = args.primary_contact_lead_id;
    if (primaryContact !== undefined && primaryContact !== null && (typeof primaryContact !== 'string' || !UUID.test(primaryContact))) return invalid('primary_contact_lead_id deve ser um UUID ou nulo.');
    return callOpportunityRpc(supabase, 'mcp_create_opportunity', {
      p_actor_user_id: actor.actorId,
      p_client_request_id: text(args.client_request_id),
      p_name: text(args.name),
      p_status: text(args.status) || 'open',
      p_responsavel: args.responsavel ?? null,
      p_origem: args.origem ?? null,
      p_notes: args.notes ?? null,
      p_member_lead_ids: memberLeadIds,
      p_primary_contact_lead_id: primaryContact ?? null,
    });
  }

  const opportunityId = text(args.opportunity_id);
  if (!UUID.test(opportunityId)) return invalid('opportunity_id deve ser um UUID válido.');
  const expectedUpdatedAt = text(args.expected_updated_at);
  if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) return invalid('expected_updated_at deve ser uma data válida.');

  if (toolName === 'kifer_update_opportunity') {
    if (!isRecord(args.changes) || Object.keys(args.changes).length === 0) return invalid('changes deve conter ao menos um campo permitido.');
    const allowed = new Set(['name', 'status', 'responsavel', 'origem', 'notes']);
    if (Object.keys(args.changes).some((key) => !allowed.has(key))) return invalid('changes contém campos não permitidos.');
    return callOpportunityRpc(supabase, 'mcp_update_opportunity', {
      p_actor_user_id: actor.actorId,
      p_opportunity_id: opportunityId,
      p_expected_updated_at: expectedUpdatedAt,
      p_patch: args.changes,
    });
  }
  if (toolName === 'kifer_archive_opportunity') {
    return callOpportunityRpc(supabase, 'mcp_archive_opportunity', {
      p_actor_user_id: actor.actorId,
      p_opportunity_id: opportunityId,
      p_expected_updated_at: expectedUpdatedAt,
    });
  }

  const leadId = text(args.lead_id);
  if (toolName === 'kifer_add_lead_to_opportunity' || toolName === 'kifer_remove_lead_from_opportunity') {
    if (!UUID.test(leadId)) return invalid('lead_id deve ser um UUID válido.');
    return callOpportunityRpc(
      supabase,
      toolName === 'kifer_add_lead_to_opportunity' ? 'mcp_add_lead_to_opportunity' : 'mcp_remove_lead_from_opportunity',
      {
        p_actor_user_id: actor.actorId,
        p_opportunity_id: opportunityId,
        p_lead_id: leadId,
        p_expected_updated_at: expectedUpdatedAt,
        ...(toolName === 'kifer_add_lead_to_opportunity' ? { p_member_role: text(args.member_role) || 'member' } : {}),
      },
    );
  }

  const primaryContact = args.primary_contact_lead_id;
  if (primaryContact !== undefined && primaryContact !== null && (typeof primaryContact !== 'string' || !UUID.test(primaryContact))) return invalid('primary_contact_lead_id deve ser um UUID ou nulo.');
  return callOpportunityRpc(supabase, 'mcp_set_opportunity_primary_contact', {
    p_actor_user_id: actor.actorId,
    p_opportunity_id: opportunityId,
    p_primary_contact_lead_id: primaryContact ?? null,
    p_expected_updated_at: expectedUpdatedAt,
  });
}
