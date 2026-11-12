type RpcResult = Record<string, unknown> & { success: boolean };
type Dependencies = {
  authorize: (req: Request) => Promise<{ actorId: string } | { status: number }>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const statuses = new Set(['open', 'qualified', 'proposal', 'won', 'lost']);

export function createLeadOpportunitiesHandler(deps: Dependencies) {
  const call = async (name: string, args: Record<string, unknown>): Promise<RpcResult> => {
    const data = await deps.rpc(name, args);
    if (!isRecord(data) || typeof data.success !== 'boolean') throw new Error('Invalid opportunity response');
    return data as RpcResult;
  };
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    try {
      const auth = await deps.authorize(req);
      if ('status' in auth) return json({ error: 'Entre com uma conta de administrador para consultar e vincular contatos.' }, auth.status);
      const raw = await req.text();
      if (raw.length > 16384) return json({ error: 'Solicitação muito grande.' }, 413);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return json({ error: 'Solicitação inválida.' }, 400); }
      if (!isRecord(body)) return json({ error: 'Solicitação inválida.' }, 400);
      // The actor always comes from the verified dashboard session.
      const actor = { p_actor_user_id: auth.actorId };
      let result: RpcResult;
      if (body.action === 'list' && isUuid(body.leadId)) {
        result = await call('mcp_get_opportunities_for_leads', { ...actor, p_lead_ids: [body.leadId] });
        // The summary contains only twelve members; expand larger groups explicitly.
        if (result.success && Array.isArray(result.opportunities)) {
          result.opportunities = await Promise.all(result.opportunities.map(async (opportunity: unknown) => {
            if (!isRecord(opportunity) || !opportunity.members_truncated) return opportunity;
            const details = await call('mcp_get_opportunity_360', { ...actor, p_opportunity_id: opportunity.id });
            if (!details.success || !isRecord(details.opportunity)) throw new Error('Incomplete opportunity members');
            return { ...opportunity, ...details.opportunity };
          }));
        }
      } else if (body.action === 'create' && typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 160
        && typeof body.clientRequestId === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(body.clientRequestId)
        && Array.isArray(body.memberLeadIds) && body.memberLeadIds.length >= 2 && body.memberLeadIds.length <= 50
        && body.memberLeadIds.every(isUuid) && new Set(body.memberLeadIds).size === body.memberLeadIds.length
        && isUuid(body.primaryContactLeadId) && body.memberLeadIds.includes(body.primaryContactLeadId)) {
        result = await call('mcp_create_opportunity', {
          ...actor, p_client_request_id: body.clientRequestId, p_name: body.name.trim(),
          p_member_lead_ids: body.memberLeadIds, p_primary_contact_lead_id: body.primaryContactLeadId,
        });
      } else if (isUuid(body.opportunityId) && typeof body.expectedUpdatedAt === 'string' && Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
        const args = { ...actor, p_opportunity_id: body.opportunityId, p_expected_updated_at: body.expectedUpdatedAt };
        if (body.action === 'add' && isUuid(body.leadId)) {
          result = await call('mcp_add_lead_to_opportunity', { ...args, p_lead_id: body.leadId });
        } else if (body.action === 'remove' && isUuid(body.leadId)) {
          result = await call('mcp_remove_lead_from_opportunity', { ...args, p_lead_id: body.leadId });
        } else if (body.action === 'primary' && isUuid(body.leadId)) {
          result = await call('mcp_set_opportunity_primary_contact', { ...args, p_primary_contact_lead_id: body.leadId });
        } else if (body.action === 'status' && typeof body.status === 'string' && statuses.has(body.status)) {
          result = await call('mcp_update_opportunity', { ...args, p_patch: { status: body.status } });
        } else return json({ error: 'Confira o contato e a negociação antes de salvar.' }, 400);
      } else return json({ error: 'Confira o nome, os contatos e a negociação antes de salvar.' }, 400);

      // Domain rejections remain explicit, including stale versions and primary membership.
      return json(result);
    } catch {
      return json({ error: 'Não foi possível consultar ou salvar os vínculos. Tente novamente.' }, 503);
    }
  };
}
