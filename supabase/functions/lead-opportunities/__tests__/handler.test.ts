import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createLeadOpportunitiesHandler } from '../handler';

const actorId = '00000000-0000-4000-8000-000000000001';
const leadId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const opportunityId = '00000000-0000-4000-8000-000000000004';
const request = (body: unknown) => new Request('https://local.test/lead-opportunities', { method: 'POST', body: JSON.stringify(body) });
const setup = (status?: number) => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const handler = createLeadOpportunitiesHandler({
    authorize: async () => status ? { status } : { actorId },
    rpc: async (name, args) => { calls.push({ name, args }); return { success: true, opportunity: { id: opportunityId } }; },
  });
  return { calls, handler };
};

test('bloqueia sessões ausentes e perfis sem autorização antes de consultar dados', async () => {
  for (const status of [401, 403]) {
    const { handler, calls } = setup(status);
    assert.equal((await handler(request({ action: 'list', leadId }))).status, status);
    assert.equal(calls.length, 0);
  }
});

test('cria uma negociação atomicamente e usa exclusivamente o ator da sessão verificada', async () => {
  const { handler, calls } = setup();
  const response = await handler(request({ action: 'create', actorId: otherId, name: ' Plano da Lorrayne ', clientRequestId: 'draft-1', memberLeadIds: [leadId, otherId], primaryContactLeadId: otherId }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: 'mcp_create_opportunity', args: { p_actor_user_id: actorId, p_client_request_id: 'draft-1', p_name: 'Plano da Lorrayne', p_member_lead_ids: [leadId, otherId], p_primary_contact_lead_id: otherId } }]);
});

test('rejeita contatos duplicados, principal fora do grupo e criação sem outra pessoa', async () => {
  const { handler, calls } = setup();
  for (const memberLeadIds of [[leadId, leadId], [leadId], [leadId, actorId]]) {
    const response = await handler(request({ action: 'create', name: 'Plano', clientRequestId: 'draft-1', memberLeadIds, primaryContactLeadId: otherId }));
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, 0);
});

test('preserva a versão lida nas alterações e não aceita versão ausente', async () => {
  const { handler, calls } = setup();
  const version = '2026-11-12T15:00:00Z';
  for (const action of ['add', 'remove', 'primary', 'status']) {
    assert.equal((await handler(request({ action, opportunityId, leadId: otherId, status: 'won' }))).status, 400);
    assert.equal((await handler(request({ action, opportunityId, leadId: otherId, status: 'won', expectedUpdatedAt: version }))).status, 200);
  }
  assert.deepEqual(calls.map((call) => call.name), ['mcp_add_lead_to_opportunity', 'mcp_remove_lead_from_opportunity', 'mcp_set_opportunity_primary_contact', 'mcp_update_opportunity']);
  assert.ok(calls.every((call) => call.args.p_actor_user_id === actorId && call.args.p_expected_updated_at === version));
  assert.deepEqual(calls[3].args.p_patch, { status: 'won' });
});

test('expande os membros quando o resumo está truncado e preserva o aviso de negociações truncadas', async () => {
  const calls: string[] = [];
  const handler = createLeadOpportunitiesHandler({
    authorize: async () => ({ actorId }),
    rpc: async (name) => {
      calls.push(name);
      return name === 'mcp_get_opportunities_for_leads'
        ? { success: true, opportunities: [{ id: opportunityId, members_truncated: true, member_lead_ids: [leadId, otherId] }], opportunities_truncated: true }
        : { success: true, opportunity: { id: opportunityId, members: [{ lead_id: leadId }, { lead_id: otherId }], members_truncated: false } };
    },
  });
  const response = await handler(request({ action: 'list', leadId }));
  const body = await response.json();
  assert.deepEqual(calls, ['mcp_get_opportunities_for_leads', 'mcp_get_opportunity_360']);
  assert.equal(body.opportunities[0].members.length, 2);
  assert.equal(body.opportunities[0].members_truncated, false);
  assert.equal(body.opportunities_truncated, true);
});

test('repassa rejeições de concorrência e não expõe exceções de infraestrutura', async () => {
  const stale = { success: false, error: { code: 'STALE_WRITE', message: 'Atualize a negociação.' } };
  const handler = createLeadOpportunitiesHandler({ authorize: async () => ({ actorId }), rpc: async () => stale });
  assert.deepEqual(await (await handler(request({ action: 'remove', leadId, opportunityId, expectedUpdatedAt: '2026-11-12' }))).json(), stale);
  const broken = createLeadOpportunitiesHandler({ authorize: async () => ({ actorId }), rpc: async () => { throw new Error('sensitive database detail'); } });
  const response = await broken(request({ action: 'list', leadId }));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('sensitive'));
});

test('trata preflight, métodos e JSON inválido sem executar comandos', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(new Request('https://local.test', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handler(new Request('https://local.test'))).status, 405);
  assert.equal((await handler(new Request('https://local.test', { method: 'POST', body: '{' }))).status, 400);
  assert.equal(calls.length, 0);
});
