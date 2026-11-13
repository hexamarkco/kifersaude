import { isRecord, metaId, MetaError } from '../_shared/meta-ads/domain.ts';

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
      if (body.action === 'review' && uuid(body.attributionId) &&
        typeof body.regionServed === 'boolean' && typeof body.interestConfirmed === 'boolean' &&
        typeof body.lives === 'number' && Number.isInteger(body.lives) && body.lives >= 1 && body.lives <= 100000 &&
        (body.opportunityId === null || uuid(body.opportunityId)) && (body.contractId === null || uuid(body.contractId)) &&
        typeof body.contractCompleted === 'boolean' && (!body.contractCompleted || uuid(body.contractId))) {
        const args = {
          p_actor: auth.actor,p_attribution: body.attributionId,p_lives: body.lives,
          p_region: body.regionServed,p_interest: body.interestConfirmed,p_opportunity: body.opportunityId,
          p_contract: body.contractId,p_completed: body.contractCompleted,
        };
        let reviewId: unknown;
        if ('contractingModality' in body || 'eligibilityConfirmed' in body || 'saleClosed' in body) {
          if (!['individual','business','collective_membership'].includes(String(body.contractingModality))
            || typeof body.eligibilityConfirmed !== 'boolean' || typeof body.saleClosed !== 'boolean'
            || (body.contractCompleted && !body.saleClosed)) {
            return json({ error: 'Selecione a modalidade e confira a elegibilidade e o fechamento.' }, 400);
          }
          reviewId = await deps.rpc('meta_ads_review_v2', {
            ...args,p_modality: body.contractingModality,p_eligibility: body.eligibilityConfirmed,p_sale_closed: body.saleClosed,
          });
        } else if (typeof body.eligibleBusiness === 'boolean') {
          // Preserve the HTTP contract and original PME rules for older clients.
          reviewId = await deps.rpc('meta_ads_review', { ...args,p_eligible: body.eligibleBusiness });
        } else return json({ error: 'Confirme a elegibilidade para a modalidade selecionada.' }, 400);
        if (!uuid(reviewId)) return json({ error: 'A avaliação não foi confirmada. Atualize a consulta antes de tentar novamente.' }, 503);
        return json({ reviewId });
      }
      return json({ error: 'Confira os critérios e vínculos antes de salvar.' }, 400);
    } catch (error) {
      if (error instanceof MetaError) {
        const messages: Record<string, string> = {
          FORBIDDEN: 'Acesso exclusivo de administradores.',
          INVALID_REVIEW: 'Confira a modalidade, a quantidade de pessoas e os critérios da avaliação.',
          OPPORTUNITY_MISMATCH: 'Esta negociação não está mais vinculada ao contato. Atualize os dados.',
          CONTRACT_MISMATCH: 'Selecione um contrato deste contato ou de uma pessoa vinculada à negociação escolhida.',
          CONTRACT_ALREADY_ATTRIBUTED: 'Este contrato já foi atribuído a outra entrada da Meta. Confira a origem da venda.',
          CONTRACT_CONFIRMATION_REQUIRED: 'Selecione um contrato e confirme o fechamento antes de registrar a contratação.',
        };
        if (messages[error.code]) return json({ error: messages[error.code] }, error.code === 'FORBIDDEN' ? 403 : 409);
      }
      return json({ error: 'Não foi possível concluir. Atualize os dados e confira os vínculos no CRM.' }, 503);
    }
  };
}
