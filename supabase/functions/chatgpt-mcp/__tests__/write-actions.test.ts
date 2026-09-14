import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

import { executeMcpCommercialReadAction, executeMcpWriteAction } from '../write-actions';

const actor = { actor: 'chatgpt:admin@kifer.test', actorId: '11111111-1111-1111-1111-111111111111' };

type Result = { data?: unknown; error?: unknown };
type Write = { table: string; operation: 'insert' | 'update'; value: unknown };

const query = (table: string, result: Result = {}, selections?: string[], writes?: Write[]) => {
  const builder = {
    select: (columns?: string) => {
      if (columns) selections?.push(columns);
      return builder;
    },
    insert: (value: unknown) => { writes?.push({ table, operation: 'insert', value }); return builder; },
    update: (value: unknown) => { writes?.push({ table, operation: 'update', value }); return builder; },
    eq: () => builder,
    ilike: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    not: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    range: async () => ({ data: result.data ?? [], error: result.error ?? null, count: Array.isArray(result.data) ? result.data.length : null }),
    maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }),
  };
  return builder;
};

const client = (handlers: Record<string, Result | Result[]>) => {
  const calls: string[] = [];
  const selections: string[] = [];
  const writes: Write[] = [];
  const counts = new Map<string, number>();
  return {
    calls,
    selections,
    writes,
    from: (table: string) => {
      calls.push(table);
      const index = counts.get(table) ?? 0;
      counts.set(table, index + 1);
      const configured = handlers[table];
      const result = Array.isArray(configured) ? configured[index] : configured;
      return query(table, result, selections, writes);
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
  const supabase = client({ leads: { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel_id: actor.actorId } }, lead_status_config: { data: null }, mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_lead_status', arguments: { lead_id: actor.actorId, status: 'Inexistente' }, actor });

  assert.equal(result?.error_code, 'INVALID_STATUS');
});

test('cria lembrete válido e sincroniza o próximo retorno do lead', async () => {
  const supabase = client({
    leads: [{ data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel_id: actor.actorId } }, {}],
    reminders: [{ data: { id: 'reminder-1', lead_id: actor.actorId, titulo: 'Ligar', data_lembrete: '2026-10-01T13:00:00.000Z', prioridade: 'alta' } }, { data: { data_lembrete: '2026-10-01T13:00:00.000Z' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_create_reminder', arguments: { lead_id: actor.actorId, tipo: 'Retorno', titulo: 'Ligar', data_lembrete: '2026-10-01T13:00:00.000Z', prioridade: 'alta' }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.proximo_retorno, '2026-10-01T13:00:00.000Z');
});

test('altera status válido e cria o histórico comercial', async () => {
  const supabase = client({
    leads: [{ data: { id: actor.actorId, status: 'Novo', status_id: 'old-status', responsavel_id: actor.actorId } }, {}],
    lead_status_config: { data: { id: 'new-status', nome: 'Proposta Enviada', ativo: true } },
    interactions: {},
    lead_status_history: { data: { id: 'history-1' } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_lead_status', arguments: { lead_id: actor.actorId, status: 'Proposta Enviada' }, actor });

  assert.deepEqual(result, { success: true, lead_id: actor.actorId, status_anterior: 'Novo', status_novo: 'Proposta Enviada', history_id: 'history-1' });
  assert.ok(supabase.selections.includes('id,status,status_id,responsavel_id'));
});

test('consulta próximo follow-up validando o lead pela chave responsavel_id', async () => {
  const supabase = client({
    leads: { data: { id: actor.actorId, status: 'Novo', status_id: 'status-1', responsavel_id: actor.actorId } },
    reminders: { data: { id: 'reminder-1', lead_id: actor.actorId, titulo: 'Retorno', data_lembrete: '2026-10-01T13:00:00.000Z', prioridade: 'normal' } },
  });
  const result = await executeMcpCommercialReadAction({
    supabase: supabase as never,
    toolName: 'kifer_get_next_follow_up',
    arguments: { lead_id: actor.actorId },
  });

  assert.equal(result?.success, true);
  assert.ok(supabase.selections.includes('id,status,status_id,responsavel_id'));
});

test('registra interação válida e rejeita contrato que não pertence ao lead', async () => {
  const successClient = client({ leads: { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel_id: actor.actorId } }, interactions: { data: { id: 'interaction-1', descricao: 'Recusou por preço' } }, mcp_action_audit_log: {} });
  const success = await executeMcpWriteAction({ supabase: successClient as never, toolName: 'kifer_create_interaction', arguments: { lead_id: actor.actorId, tipo: 'Objeção', descricao: 'Recusou por preço' }, actor });
  assert.equal(success?.success, true);

  const wrongContractClient = client({ leads: { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel_id: actor.actorId } }, contracts: { data: { id: '22222222-2222-2222-2222-222222222222', lead_id: '33333333-3333-3333-3333-333333333333' } }, mcp_action_audit_log: {} });
  const wrongContract = await executeMcpWriteAction({ supabase: wrongContractClient as never, toolName: 'kifer_create_interaction', arguments: { lead_id: actor.actorId, contract_id: '22222222-2222-2222-2222-222222222222', tipo: 'Objeção', descricao: 'Recusou por preço' }, actor });
  assert.equal(wrongContract?.error_code, 'CONTRACT_NOT_FOUND');
});

test('não permite enviar para conversa removida', async () => {
  const supabase = client({ comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: '2026-01-01T00:00:00Z' } }, mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: actor.actorId, message: 'Olá', client_request_id: 'request-2' }, actor });

  assert.equal(result?.error_code, 'CHAT_NOT_FOUND');
});

test('agenda uma mensagem de texto na fila nativa a partir de uma conversa existente', async () => {
  const supabase = client({
    comm_whatsapp_chats: { data: { id: actor.actorId, channel_id: '22222222-2222-2222-2222-222222222222', phone_digits: '5511999999999', phone_number: '+55 11 99999-9999', display_name: 'Larissa', lead_id: '33333333-3333-3333-3333-333333333333', deleted_at: null } },
    comm_whatsapp_scheduled_messages: [
      { data: null },
      { data: { id: 'scheduled-1', chat_id: actor.actorId, lead_id: '33333333-3333-3333-3333-333333333333', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' } },
    ],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: 'Olá, Larissa!', scheduled_at: '2026-10-01T13:00:00.000Z', client_request_id: 'schedule-1' },
    actor,
  });

  assert.deepEqual(result, {
    success: true,
    duplicate: false,
    scheduled_message_id: 'scheduled-1',
    chat_id: actor.actorId,
    lead_id: '33333333-3333-3333-3333-333333333333',
    scheduled_at: '2026-10-01T13:00:00.000Z',
    status: 'scheduled',
    client_request_id: 'schedule-1',
  });
});

test('retorna o agendamento anterior para a mesma chave idempotente', async () => {
  const supabase = client({
    comm_whatsapp_chats: { data: { id: actor.actorId, channel_id: '22222222-2222-2222-2222-222222222222', phone_digits: '5511999999999', deleted_at: null } },
    comm_whatsapp_scheduled_messages: { data: { id: 'scheduled-1', chat_id: actor.actorId, lead_id: null, scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: 'Olá, Larissa!', scheduled_at: '2026-10-01T13:00:00.000Z', client_request_id: 'schedule-1' },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal(result?.duplicate, true);
  assert.equal(result?.scheduled_message_id, 'scheduled-1');
  assert.deepEqual(supabase.calls, ['comm_whatsapp_chats', 'comm_whatsapp_scheduled_messages', 'mcp_action_audit_log']);
});

test('recusa agendamento muito próximo para evitar disparo imediato acidental', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: 'Olá', scheduled_at: new Date().toISOString(), client_request_id: 'schedule-now' },
    actor,
  });

  assert.equal(result?.error_code, 'INVALID_SCHEDULE_TIME');
  assert.deepEqual(supabase.calls, ['mcp_action_audit_log']);
});

test('preserva literalmente delimitadores, acentos, emoji e offset no agendamento', async () => {
  const message = 'Oi, Rafaella! 😊\n\n---\n\nConseguiu analisar a proposta?';
  const supabase = client({
    comm_whatsapp_chats: { data: { id: actor.actorId, channel_id: '22222222-2222-2222-2222-222222222222', phone_digits: '5511999999999', deleted_at: null } },
    comm_whatsapp_scheduled_messages: [{ data: null }, { data: { id: 'scheduled-raw', chat_id: actor.actorId, lead_id: null, scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message, scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'raw-message-1' },
    actor,
  });

  assert.equal(result?.success, true);
  const inserted = supabase.writes.find((write) => write.operation === 'insert' && write.table === 'comm_whatsapp_scheduled_messages');
  assert.equal((inserted?.value as { text_content?: string }).text_content, message);
  assert.equal((inserted?.value as { scheduled_at?: string }).scheduled_at, '2026-10-01T13:00:00.000Z');
});

test('lista agendamentos por lead e período mantendo o texto e a contagem de partes', async () => {
  const supabase = client({
    comm_whatsapp_scheduled_messages: { data: [{ id: 'scheduled-1', chat_id: actor.actorId, lead_id: '33333333-3333-3333-3333-333333333333', text_content: 'Olá\n---\nTudo bem?', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled', mcp_client_request_id: 'request-1', created_at: '2026-09-30T13:00:00.000Z', updated_at: '2026-09-30T13:00:00.000Z', sent_at: null, cancelled_at: null, error_message: null, cancelled_reason: null, delivery_status: null }] },
    leads: { data: [{ id: '33333333-3333-3333-3333-333333333333', nome_completo: 'Larissa' }] },
  });
  const result = await executeMcpCommercialReadAction({
    supabase: supabase as never,
    toolName: 'kifer_list_scheduled_whatsapp_messages',
    arguments: { lead_id: '33333333-3333-3333-3333-333333333333', data_inicial: '2026-10-01T00:00:00-03:00', data_final: '2026-10-01T23:59:59-03:00' },
  });

  assert.equal(result?.success, true);
  assert.deepEqual(result?.scheduled_messages, [{ scheduled_message_id: 'scheduled-1', chat_id: actor.actorId, lead_id: '33333333-3333-3333-3333-333333333333', lead_name: 'Larissa', message: 'Olá\n---\nTudo bem?', message_parts_count: 2, scheduled_at: '2026-10-01T13:00:00.000Z', scheduled_at_utc: '2026-10-01T13:00:00.000Z', timezone: 'America/Sao_Paulo', status: 'scheduled', client_request_id: 'request-1', created_at: '2026-09-30T13:00:00.000Z', updated_at: '2026-09-30T13:00:00.000Z', sent_at: null, cancelled_at: null, last_error: null, cancellation_reason: null, delivery_status: null }]);
});

test('consulta um agendamento específico pelo id', async () => {
  const supabase = client({
    comm_whatsapp_scheduled_messages: { data: { id: 'scheduled-1', chat_id: actor.actorId, lead_id: null, text_content: 'Olá 😊', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled', mcp_client_request_id: 'request-1', created_at: '2026-09-30T13:00:00.000Z', updated_at: '2026-09-30T13:00:00.000Z' } },
  });
  const result = await executeMcpCommercialReadAction({ supabase: supabase as never, toolName: 'kifer_get_scheduled_whatsapp_message', arguments: { scheduled_message_id: actor.actorId } });

  assert.equal(result?.success, true);
  assert.equal((result?.scheduled_message as { message?: string }).message, 'Olá 😊');
});

test('audita follow-ups comerciais duplicados e sem mensagem agendada sem alterar dados', async () => {
  const supabase = client({
    reminders: { data: [
      { id: 'reminder-1', lead_id: actor.actorId, tipo: 'Follow-up', titulo: 'Ligar', data_lembrete: '2026-10-01T13:00:00.000Z', lido: false, cancelled_at: null },
      { id: 'reminder-2', lead_id: actor.actorId, tipo: 'Retorno', titulo: 'Retornar', data_lembrete: '2026-10-02T13:00:00.000Z', lido: false, cancelled_at: null },
    ] },
    comm_whatsapp_scheduled_messages: { data: [] },
    leads: { data: [{ id: actor.actorId, nome_completo: 'Larissa', status: 'Proposta Enviada', arquivado: false }] },
  });
  const result = await executeMcpCommercialReadAction({ supabase: supabase as never, toolName: 'kifer_get_commercial_followup_audit', arguments: { lead_id: actor.actorId } });

  assert.equal(result?.success, true);
  assert.deepEqual((result?.issues as Array<{ code: string }>).map((issue) => issue.code), ['MULTIPLE_COMMERCIAL_FOLLOW_UPS', 'FOLLOW_UP_WITHOUT_SCHEDULED_MESSAGE']);
  assert.deepEqual(supabase.writes, []);
});

test('edita texto e horário somente em agendamento pendente sem criar outro registro', async () => {
  const current = { id: actor.actorId, chat_id: '22222222-2222-2222-2222-222222222222', lead_id: null, text_content: 'Texto antigo', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled', created_at: '2026-09-30T13:00:00.000Z', updated_at: '2026-09-30T13:00:00.000Z' };
  const updated = { ...current, text_content: 'Novo\n---\nTexto', scheduled_at: '2026-10-02T13:00:00.000Z', updated_at: '2026-09-30T14:00:00.000Z' };
  const supabase = client({ comm_whatsapp_scheduled_messages: [{ data: current }, { data: updated }], mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_update_scheduled_whatsapp_message',
    arguments: { scheduled_message_id: actor.actorId, changes: { message: 'Novo\n---\nTexto', scheduled_at: '2026-10-02T10:00:00-03:00' } },
    actor,
  });

  assert.equal(result?.success, true);
  assert.deepEqual(supabase.writes.filter((write) => write.table === 'comm_whatsapp_scheduled_messages').map((write) => write.operation), ['update']);
  assert.deepEqual(supabase.writes[0]?.value, { text_content: 'Novo\n---\nTexto', scheduled_at: '2026-10-02T13:00:00.000Z' });
});

test('recusa edição e cancelamento de uma mensagem já enviada', async () => {
  const sent = { id: actor.actorId, chat_id: null, lead_id: null, text_content: 'Já enviada', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'sent' };
  const updateClient = client({ comm_whatsapp_scheduled_messages: { data: sent }, mcp_action_audit_log: {} });
  const update = await executeMcpWriteAction({ supabase: updateClient as never, toolName: 'kifer_update_scheduled_whatsapp_message', arguments: { scheduled_message_id: actor.actorId, changes: { message: 'Novo texto' } }, actor });
  const cancelClient = client({ comm_whatsapp_scheduled_messages: { data: sent }, mcp_action_audit_log: {} });
  const cancel = await executeMcpWriteAction({ supabase: cancelClient as never, toolName: 'kifer_cancel_scheduled_whatsapp_message', arguments: { scheduled_message_id: actor.actorId }, actor });

  assert.equal(update?.error_code, 'MESSAGE_ALREADY_SENT');
  assert.equal(cancel?.error_code, 'MESSAGE_ALREADY_SENT');
});

test('cancela logicamente e torna retry de cancelamento idempotente', async () => {
  const current = { id: actor.actorId, chat_id: '22222222-2222-2222-2222-222222222222', lead_id: null, text_content: 'Pendente', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' };
  const cancelled = { ...current, status: 'cancelled', cancelled_at: '2026-09-30T14:00:00.000Z', cancelled_reason: 'Sem necessidade' };
  const cancelClient = client({ comm_whatsapp_scheduled_messages: [{ data: current }, { data: cancelled }], mcp_action_audit_log: {} });
  const cancel = await executeMcpWriteAction({ supabase: cancelClient as never, toolName: 'kifer_cancel_scheduled_whatsapp_message', arguments: { scheduled_message_id: actor.actorId, observacao: 'Sem necessidade' }, actor });
  const retryClient = client({ comm_whatsapp_scheduled_messages: { data: cancelled }, mcp_action_audit_log: {} });
  const retry = await executeMcpWriteAction({ supabase: retryClient as never, toolName: 'kifer_cancel_scheduled_whatsapp_message', arguments: { scheduled_message_id: actor.actorId }, actor });

  assert.equal(cancel?.success, true);
  assert.equal(cancel?.duplicate, false);
  assert.equal(retry?.success, true);
  assert.equal(retry?.duplicate, true);
});

test('processa lote parcialmente bem-sucedido sem impedir os demais itens', async () => {
  const supabase = client({
    comm_whatsapp_chats: [{ data: { id: actor.actorId, channel_id: '22222222-2222-2222-2222-222222222222', phone_digits: '5511999999999', deleted_at: null } }, { data: null }],
    comm_whatsapp_scheduled_messages: [{ data: null }, { data: { id: 'scheduled-1', chat_id: actor.actorId, lead_id: null, scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_bulk_schedule_whatsapp_messages',
    arguments: { items: [
      { chat_id: actor.actorId, message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'bulk-1' },
      { chat_id: '22222222-2222-2222-2222-222222222222', message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'bulk-2' },
    ] },
    actor,
  });

  assert.deepEqual({ scheduled: result?.scheduled, duplicates: result?.duplicates, failed: result?.failed }, { scheduled: 1, duplicates: 0, failed: 1 });
});

test('recusa chat inexistente, texto vazio, texto longo e horário passado ao agendar', async () => {
  const past = await executeMcpWriteAction({
    supabase: client({ mcp_action_audit_log: {} }) as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: 'Olá', scheduled_at: '2020-01-01T10:00:00-03:00', client_request_id: 'past-1' },
    actor,
  });
  const empty = await executeMcpWriteAction({
    supabase: client({ mcp_action_audit_log: {} }) as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: '   ', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'empty-1' },
    actor,
  });
  const long = await executeMcpWriteAction({
    supabase: client({ mcp_action_audit_log: {} }) as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: 'a'.repeat(4097), scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'long-1' },
    actor,
  });
  const missingChat = await executeMcpWriteAction({
    supabase: client({ comm_whatsapp_chats: { data: null }, mcp_action_audit_log: {} }) as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'chat-1' },
    actor,
  });

  assert.equal(past?.error_code, 'INVALID_SCHEDULE_TIME');
  assert.equal(empty?.error_code, 'MESSAGE_EMPTY');
  assert.equal(long?.error_code, 'MESSAGE_TOO_LONG');
  assert.equal(missingChat?.error_code, 'CHAT_NOT_FOUND');
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

const mcpInboxChannel = { id: '22222222-2222-2222-2222-222222222222' };
const mcpInboxChat = {
  id: '33333333-3333-3333-3333-333333333333',
  channel_id: mcpInboxChannel.id,
  external_chat_id: '5521979949423@s.whatsapp.net',
  phone_number: '5521979949423',
  phone_digits: '5521979949423',
  display_name: 'Aline',
  lead_id: null,
  deleted_at: null,
  merged_into_chat_id: null,
};

test('cria conversa no Inbox quando o telefone ainda não possui chat', async () => {
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel },
    leads: { data: [] },
    comm_whatsapp_chats: [{ data: null }, { data: mcpInboxChat }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_get_or_create_whatsapp_chat',
    arguments: { phone: '21979949423' },
    actor,
  });

  assert.deepEqual(result, {
    success: true,
    created: true,
    chat_id: mcpInboxChat.id,
    lead_id: null,
    lead_match: 'not_found',
    chat: { id: mcpInboxChat.id, phone: '5521979949423', lead_id: null },
  });
  const created = supabase.writes.find((write) => write.table === 'comm_whatsapp_chats' && write.operation === 'insert');
  assert.equal((created?.value as { external_chat_id?: string }).external_chat_id, '5521979949423@s.whatsapp.net');
  assert.ok(!supabase.calls.includes('comm_whatsapp_messages'));
});

test('retorna a conversa existente sem criar outra', async () => {
  const existing = { ...mcpInboxChat, lead_id: actor.actorId };
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel },
    leads: { data: [] },
    comm_whatsapp_chats: { data: existing },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_get_or_create_whatsapp_chat',
    arguments: { phone: '5521979949423' },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal(result?.created, false);
  assert.equal(result?.chat_id, existing.id);
  assert.equal(supabase.writes.filter((write) => write.table === 'comm_whatsapp_chats' && write.operation === 'insert').length, 0);
});

test('duas chamadas consecutivas devolvem o mesmo chat e não duplicam a criação', async () => {
  const supabase = client({
    comm_whatsapp_channels: [{ data: mcpInboxChannel }, { data: mcpInboxChannel }],
    leads: [{ data: [] }, { data: [] }],
    comm_whatsapp_chats: [{ data: null }, { data: mcpInboxChat }, { data: mcpInboxChat }],
    mcp_action_audit_log: {},
  });
  const first = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '21979949423' }, actor });
  const second = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '21979949423' }, actor });

  assert.equal(first?.chat_id, mcpInboxChat.id);
  assert.equal(second?.chat_id, mcpInboxChat.id);
  assert.equal(second?.created, false);
  assert.equal(supabase.writes.filter((write) => write.table === 'comm_whatsapp_chats' && write.operation === 'insert').length, 1);
});

test('normaliza telefone mascarado para a identidade canônica do Inbox', async () => {
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel }, leads: { data: [] },
    comm_whatsapp_chats: [{ data: null }, { data: mcpInboxChat }], mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '(21) 97994-9423' }, actor });

  assert.equal((result?.chat as { phone?: string }).phone, '5521979949423');
});

test('normaliza telefone fornecido com +55', async () => {
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel }, leads: { data: [] },
    comm_whatsapp_chats: [{ data: null }, { data: mcpInboxChat }], mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '+5521979949423' }, actor });

  assert.equal((result?.chat as { phone?: string }).phone, '5521979949423');
});

test('associa o chat ao lead quando o telefone informado é compatível', async () => {
  const lead = { id: actor.actorId, nome_completo: 'Aline', telefone: '+55 (21) 97994-9423' };
  const createdChat = { ...mcpInboxChat, lead_id: lead.id };
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel }, leads: { data: lead },
    comm_whatsapp_chats: [{ data: null }, { data: createdChat }], mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '21979949423', lead_id: lead.id }, actor });

  assert.equal(result?.lead_id, lead.id);
  const created = supabase.writes.find((write) => write.table === 'comm_whatsapp_chats' && write.operation === 'insert');
  assert.equal((created?.value as { lead_id?: string }).lead_id, lead.id);
});

test('bloqueia vínculo quando o telefone informado diverge do telefone do lead', async () => {
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel },
    leads: { data: { id: actor.actorId, nome_completo: 'Aline', telefone: '21988887777' } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '21979949423', lead_id: actor.actorId }, actor });

  assert.equal(result?.error_code, 'PHONE_LEAD_MISMATCH');
  assert.ok(!supabase.calls.includes('comm_whatsapp_chats'));
});

test('cria somente a conversa quando não há lead correspondente', async () => {
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel }, leads: { data: [] },
    comm_whatsapp_chats: [{ data: null }, { data: mcpInboxChat }], mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '21979949423' }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.lead_id, null);
  assert.equal(result?.lead_match, 'not_found');
});

test('não associa automaticamente quando existem vários leads para o mesmo telefone', async () => {
  const leads = [
    { id: actor.actorId, nome_completo: 'Aline 1', telefone: '5521979949423' },
    { id: '44444444-4444-4444-4444-444444444444', nome_completo: 'Aline 2', telefone: '5521979949423' },
  ];
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel }, leads: { data: leads },
    comm_whatsapp_chats: [{ data: null }, { data: mcpInboxChat }], mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '21979949423' }, actor });

  assert.equal(result?.lead_id, null);
  assert.equal(result?.lead_match, 'ambiguous');
  const created = supabase.writes.find((write) => write.table === 'comm_whatsapp_chats' && write.operation === 'insert');
  assert.equal((created?.value as { lead_id?: string | null }).lead_id, null);
});

test('a criação de chat não chama o fluxo de envio de WhatsApp', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const supabase = client({
    comm_whatsapp_channels: { data: mcpInboxChannel }, leads: { data: [] },
    comm_whatsapp_chats: [{ data: null }, { data: mcpInboxChat }], mcp_action_audit_log: {},
  });
  await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_get_or_create_whatsapp_chat', arguments: { phone: '21979949423' }, actor });

  assert.equal(fetchMock.mock.calls.length, 0);
  assert.ok(!supabase.calls.includes('comm_whatsapp_messages'));
});

test('o chat retornado pode ser usado pelo envio normal de WhatsApp', async () => {
  stubMcpSendEnvironment();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, messageId: 'provider-1', status: 'queued' }), { status: 202 })));
  const supabase = client({
    comm_whatsapp_chats: { data: { ...mcpInboxChat, deleted_at: null } },
    comm_whatsapp_messages: { data: { id: 'message-1', message_at: '2026-09-14T12:00:00.000Z', delivery_status: 'queued' } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: mcpInboxChat.id, message: 'Olá', client_request_id: 'chat-create-send-1' }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.chat_id, mcpInboxChat.id);
});

test('o chat retornado pode ser usado pelo agendamento normal de WhatsApp', async () => {
  const supabase = client({
    comm_whatsapp_chats: { data: { ...mcpInboxChat, deleted_at: null } },
    comm_whatsapp_scheduled_messages: [{ data: null }, { data: { id: 'scheduled-chat-create', chat_id: mcpInboxChat.id, lead_id: null, scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_schedule_whatsapp_message', arguments: { chat_id: mcpInboxChat.id, message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'chat-create-schedule-1' }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.chat_id, mcpInboxChat.id);
});

test('recusa alteração de automação com campo fora da allowlist', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { enabled: true, autoSend: true, scheduling: {} } } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_update_automation_settings',
    arguments: { settings: { webhook_url: 'https://invalid.example' } },
    actor,
  });

  assert.equal(result?.error_code, 'NOT_ALLOWED');
});

test('não permite reprocessar job de automação já concluído', async () => {
  const supabase = client({
    auto_contact_flow_jobs: { data: { id: actor.actorId, status: 'completed', attempts: 1, scheduled_at: '2026-09-12T12:00:00.000Z' } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_retry_automation_job',
    arguments: { job_id: actor.actorId },
    actor,
  });

  assert.equal(result?.error_code, 'JOB_ALREADY_EXECUTED');
});

test('recusa edição de lead com coluna fora do schema fechado', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_update_lead',
    arguments: { lead_id: actor.actorId, changes: { role: 'admin' } },
    actor,
  });

  assert.equal(result?.error_code, 'NOT_ALLOWED');
  assert.deepEqual(supabase.calls, ['mcp_action_audit_log']);
});

test('lista somente campos operacionais de jobs de automação', async () => {
  const supabase = client({
    auto_contact_flow_jobs: { data: [{ id: 'job-1', status: 'pending', flow_id: 'flow-1' }] },
  });
  const result = await executeMcpCommercialReadAction({
    supabase: supabase as never,
    toolName: 'kifer_list_automation_jobs',
    arguments: { status: 'pending' },
  });

  assert.equal(result?.success, true);
  assert.deepEqual(result?.jobs, [{ id: 'job-1', status: 'pending', flow_id: 'flow-1' }]);
});

test('exige filtro no cancelamento em lote para proteger a fila inteira', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_bulk_cancel_automation_jobs',
    arguments: {},
    actor,
  });

  assert.equal(result?.error_code, 'INVALID_INPUT');
});

test('rejeita criação de fluxo por duração sem status de gatilho', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [] } } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_create_followup_flow',
    arguments: {
      nome: 'Inatividade', ativo: true, trigger_type: 'inactivity_duration', trigger_statuses: [],
      trigger_duration_hours: 48, start_hour: '08:00', end_hour: '18:00', allowed_weekdays: [1, 2, 3, 4, 5], daily_send_limit: 20,
    },
    actor,
  });

  assert.equal(result?.error_code, 'INVALID_INPUT');
});

test('não permite criar etapa com ação destrutiva do motor', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_create_followup_step',
    arguments: { flow_id: 'flow-1', ordem: 0, action_type: 'delete_lead', delay_value: 1, delay_unit: 'days', enabled: true, action_config: {} },
    actor,
  });

  assert.equal(result?.error_code, 'INVALID_INPUT');
});

test('não atualiza mensagem de etapa quando o novo texto é vazio', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_update_followup_step_message',
    arguments: { flow_id: 'flow-1', step_id: 'step-1', message: ' ' },
    actor,
  });

  assert.equal(result?.error_code, 'INVALID_INPUT');
});

test('exige novo nome ao clonar fluxo', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_clone_followup_flow',
    arguments: { source_flow_id: 'flow-1', overrides: {} },
    actor,
  });

  assert.equal(result?.error_code, 'INVALID_INPUT');
});
