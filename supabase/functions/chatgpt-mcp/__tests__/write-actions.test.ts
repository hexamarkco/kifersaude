import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

import { executeMcpWriteAction } from '../write-actions';

const actor = { actor: 'chatgpt:admin@kifer.test', actorId: '11111111-1111-1111-1111-111111111111' };

type Result = { data?: unknown; error?: unknown };

const query = (result: Result = {}) => {
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    ilike: () => builder,
    gte: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }),
  };
  return builder;
};

const client = (handlers: Record<string, Result | Result[]>) => {
  const calls: string[] = [];
  const counts = new Map<string, number>();
  return {
    calls,
    from: (table: string) => {
      calls.push(table);
      const index = counts.get(table) ?? 0;
      counts.set(table, index + 1);
      const configured = handlers[table];
      const result = Array.isArray(configured) ? configured[index] : configured;
      return query(result);
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('rejeita mensagem vazia sem tentar enviar ao provider', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: '11111111-1111-1111-1111-111111111111', message: '', client_request_id: 'request-1' }, actor });

  assert.deepEqual(result, { success: false, error_code: 'MESSAGE_EMPTY', message: 'A mensagem não pode estar vazia.' });
  assert.deepEqual(supabase.calls, ['mcp_action_audit_log']);
});

test('rejeita data inválida ao criar lembrete', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_create_reminder', arguments: { lead_id: '11111111-1111-1111-1111-111111111111', tipo: 'Retorno', titulo: 'Ligar', data_lembrete: 'amanhã', prioridade: 'normal' }, actor });

  assert.equal(result?.success, false);
  assert.equal(result?.error_code, 'INVALID_INPUT');
});

test('rejeita interação vazia antes de tocar o CRM', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_create_interaction', arguments: { lead_id: '11111111-1111-1111-1111-111111111111', tipo: 'Observação', descricao: ' ' }, actor });

  assert.equal(result?.error_code, 'INVALID_INPUT');
  assert.deepEqual(supabase.calls, ['mcp_action_audit_log']);
});

test('retorna INVALID_STATUS quando o status não está ativo no CRM', async () => {
  const supabase = client({ leads: { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel: 'Admin' } }, lead_status_config: { data: null }, mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_lead_status', arguments: { lead_id: actor.actorId, status: 'Inexistente' }, actor });

  assert.equal(result?.error_code, 'INVALID_STATUS');
});

test('cria lembrete válido e sincroniza o próximo retorno do lead', async () => {
  const supabase = client({
    leads: [{ data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel: 'Admin' } }, {}],
    reminders: [{ data: { id: 'reminder-1', lead_id: actor.actorId, titulo: 'Ligar', data_lembrete: '2026-10-01T13:00:00.000Z', prioridade: 'alta' } }, { data: { data_lembrete: '2026-10-01T13:00:00.000Z' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_create_reminder', arguments: { lead_id: actor.actorId, tipo: 'Retorno', titulo: 'Ligar', data_lembrete: '2026-10-01T13:00:00.000Z', prioridade: 'alta' }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.proximo_retorno, '2026-10-01T13:00:00.000Z');
});

test('altera status válido e cria o histórico comercial', async () => {
  const supabase = client({
    leads: [{ data: { id: actor.actorId, status: 'Novo', status_id: 'old-status', responsavel: 'Admin' } }, {}],
    lead_status_config: { data: { id: 'new-status', nome: 'Proposta Enviada', ativo: true } },
    interactions: {},
    lead_status_history: { data: { id: 'history-1' } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_lead_status', arguments: { lead_id: actor.actorId, status: 'Proposta Enviada' }, actor });

  assert.deepEqual(result, { success: true, lead_id: actor.actorId, status_anterior: 'Novo', status_novo: 'Proposta Enviada', history_id: 'history-1' });
});

test('registra interação válida e rejeita contrato que não pertence ao lead', async () => {
  const successClient = client({ leads: { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel: 'Admin' } }, interactions: { data: { id: 'interaction-1', descricao: 'Recusou por preço' } }, mcp_action_audit_log: {} });
  const success = await executeMcpWriteAction({ supabase: successClient as never, toolName: 'kifer_create_interaction', arguments: { lead_id: actor.actorId, tipo: 'Objeção', descricao: 'Recusou por preço' }, actor });
  assert.equal(success?.success, true);

  const wrongContractClient = client({ leads: { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel: 'Admin' } }, contracts: { data: { id: '22222222-2222-2222-2222-222222222222', lead_id: '33333333-3333-3333-3333-333333333333' } }, mcp_action_audit_log: {} });
  const wrongContract = await executeMcpWriteAction({ supabase: wrongContractClient as never, toolName: 'kifer_create_interaction', arguments: { lead_id: actor.actorId, contract_id: '22222222-2222-2222-2222-222222222222', tipo: 'Objeção', descricao: 'Recusou por preço' }, actor });
  assert.equal(wrongContract?.error_code, 'CONTRACT_NOT_FOUND');
});

test('não permite enviar para conversa removida', async () => {
  const supabase = client({ comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: '2026-01-01T00:00:00Z' } }, mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: actor.actorId, message: 'Olá', client_request_id: 'request-2' }, actor });

  assert.equal(result?.error_code, 'CHAT_NOT_FOUND');
});

const stubMcpSendEnvironment = () => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://project.supabase.co' : key === 'KIFER_MCP_WHATSAPP_INTERNAL_SECRET' ? 'internal-secret' : '' } });
};

test('expõe falha segura quando o provider rejeita o envio', async () => {
  stubMcpSendEnvironment();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Canal desconectado' }), { status: 502 })));
  const supabase = client({ comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: null } }, mcp_action_audit_log: {} });

  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: actor.actorId, message: 'Olá', client_request_id: 'request-3' }, actor });

  assert.equal(result?.error_code, 'PROVIDER_ERROR');
});

test('propaga o limite de taxa do fluxo normal de WhatsApp', async () => {
  stubMcpSendEnvironment();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Muitas requisições' }), { status: 429 })));
  const supabase = client({ comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: null } }, mcp_action_audit_log: {} });

  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: actor.actorId, message: 'Olá', client_request_id: 'request-4' }, actor });

  assert.equal(result?.error_code, 'RATE_LIMITED');
});

test('retorna o resultado original quando o fluxo normal informa duplicidade', async () => {
  stubMcpSendEnvironment();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, duplicate: true, messageId: 'provider-message-1', status: 'sent' }), { status: 202 })));
  const supabase = client({
    comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: null } },
    comm_whatsapp_messages: { data: { id: 'message-1', message_at: '2026-09-12T12:00:00.000Z', delivery_status: 'sent' } },
    mcp_action_audit_log: {},
  });

  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: actor.actorId, message: 'Olá', client_request_id: 'request-5' }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.duplicate, true);
  assert.equal(result?.message_id, 'message-1');
  assert.equal(result?.external_message_id, 'provider-message-1');
});
