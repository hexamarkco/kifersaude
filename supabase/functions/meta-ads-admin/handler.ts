import { isRecord, metaId } from '../_shared/meta-ads/domain.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
type AdminDependencies = {
  authorize: (req: Request) => Promise<{ actor: string } | { status: number }>;
  snapshot: (actor: string, search: string) => Promise<unknown>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};
export function createAdminHandler(deps: AdminDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    const auth = await deps.authorize(req);
    if ('status' in auth) return json({ error: 'Acesso exclusivo de administradores.' }, auth.status);
    try {
      const text = await req.text();
      if (text.length > 8192) return json({ error: 'Solicitação muito grande.' }, 413);
      const body: unknown = JSON.parse(text);
      if (!isRecord(body)) return json({ error: 'Solicitação inválida.' }, 400);
      if (body.action === 'snapshot' && (body.search === undefined || (typeof body.search === 'string' && body.search.length<=100))) {
        return json(await deps.snapshot(auth.actor,typeof body.search === 'string' ? body.search.trim() : ''));
      }
      if (body.action === 'history' && typeof body.before === 'string' && /^\d{1,18}$/.test(body.before)) {
        return json(await deps.rpc('meta_ads_history',{ p_actor: auth.actor,p_before: body.before }));
      }
      if (body.action === 'requeue' && metaId(body.leadgenId)) {
        const changed = await deps.rpc('meta_ads_requeue', { p_actor: auth.actor,p_id: body.leadgenId });
        return changed === true ? json({ changed: true }) : json({ error: 'Este recebimento não está na lista de falhas.' }, 409);
      }
      if (body.action === 'requeueEvent' && uuid(body.eventId)) {
        const changed = await deps.rpc('meta_ads_requeue_event', { p_actor: auth.actor,p_id: body.eventId });
        return changed === true ? json({ changed: true }) : json({ error: 'Este sinal exige revisão comercial ou está fora do prazo de envio.' }, 409);
      }
      if (body.action === 'review' && uuid(body.attributionId) && typeof body.eligibleBusiness === 'boolean' &&
        typeof body.regionServed === 'boolean' && typeof body.interestConfirmed === 'boolean' &&
        typeof body.lives === 'number' && Number.isInteger(body.lives) && body.lives >= 1 && body.lives <= 100000 &&
        (body.opportunityId === null || uuid(body.opportunityId)) && (body.contractId === null || uuid(body.contractId)) &&
        typeof body.contractCompleted === 'boolean' && (!body.contractCompleted || uuid(body.contractId))) {
        const reviewId = await deps.rpc('meta_ads_review', {
          p_actor: auth.actor,p_attribution: body.attributionId,p_eligible: body.eligibleBusiness,p_lives: body.lives,
          p_region: body.regionServed,p_interest: body.interestConfirmed,p_opportunity: body.opportunityId,
          p_contract: body.contractId,p_completed: body.contractCompleted,
        });
        return json({ reviewId });
      }
      return json({ error: 'Confira os critérios e vínculos antes de salvar.' }, 400);
    } catch {
      return json({ error: 'Não foi possível concluir. Atualize os dados e confira os vínculos no CRM.' }, 503);
    }
  };
}
