import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';

import { executeMcpCommercialReadAction, executeMcpWriteAction } from '../write-actions';
import { mcpAdminAuthorizationError, mcpWriteAuthorizationError } from '../authorization';

const actor = { actor: 'chatgpt:admin@kifer.test', actorId: '11111111-1111-1111-1111-111111111111' };

type Result = { data?: unknown; error?: unknown; count?: number | null };
type Write = { table: string; operation: 'insert' | 'update'; value: unknown };
type Filter = { table: string; operator: string; column?: string; value?: unknown };

const query = (table: string, result: Result = {}, selections?: string[], writes?: Write[], filters?: Filter[]) => {
  const builder = {
    select: (columns?: string) => {
      if (columns) selections?.push(columns);
      return builder;
    },
    insert: (value: unknown) => { writes?.push({ table, operation: 'insert', value }); return builder; },
    update: (value: unknown) => { writes?.push({ table, operation: 'update', value }); return builder; },
    eq: (column: string, value: unknown) => { filters?.push({ table, operator: 'eq', column, value }); return builder; },
    neq: (column: string, value: unknown) => { filters?.push({ table, operator: 'neq', column, value }); return builder; },
    ilike: (column: string, value: unknown) => { filters?.push({ table, operator: 'ilike', column, value }); return builder; },
    gte: (column: string, value: unknown) => { filters?.push({ table, operator: 'gte', column, value }); return builder; },
    lte: (column: string, value: unknown) => { filters?.push({ table, operator: 'lte', column, value }); return builder; },
    in: (column: string, value: unknown) => { filters?.push({ table, operator: 'in', column, value }); return builder; },
    not: (column: string, operator: string, value: unknown) => { filters?.push({ table, operator: `not.${operator}`, column, value }); return builder; },
    is: (column: string, value: unknown) => { filters?.push({ table, operator: 'is', column, value }); return builder; },
    or: (value: string) => { filters?.push({ table, operator: 'or', value }); return builder; },
    order: () => builder,
    limit: () => builder,
    range: async () => ({ data: result.data ?? [], error: result.error ?? null, count: result.count ?? (Array.isArray(result.data) ? result.data.length : null) }),
    maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }),
    then: (resolve: (value: { data: unknown; error: unknown; count: number | null }) => unknown) => Promise.resolve({ data: result.data ?? null, error: result.error ?? null, count: result.count ?? (Array.isArray(result.data) ? result.data.length : null) }).then(resolve),
  };
  return builder;
};

const client = (handlers: Record<string, Result | Result[]>) => {
  const calls: string[] = [];
  const selections: string[] = [];
  const writes: Write[] = [];
  const filters: Filter[] = [];
  const counts = new Map<string, number>();
  return {
    calls,
    selections,
    writes,
    filters,
    from: (table: string) => {
      calls.push(table);
      const index = counts.get(table) ?? 0;
      counts.set(table, index + 1);
      const configured = handlers[table];
      const result = Array.isArray(configured) ? configured[index] : configured;
      return query(table, result, selections, writes, filters);
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: 'https://storage.test/signed-media' }, error: null }),
        upload: async () => ({ data: { path: 'mcp/test/anexo.pdf' }, error: null }),
      }),
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('ações de escrita negam token legado ou principal sem usuário OAuth', () => {
  assert.deepEqual(mcpWriteAuthorizationError(null), {
    success: false,
    error_code: 'UNAUTHORIZED',
    message: 'Ações de escrita exigem uma conexão OAuth de administrador.',
  });
  assert.equal(mcpWriteAuthorizationError(actor.actorId), null);
  assert.deepEqual(mcpAdminAuthorizationError(null), {
    success: false,
    error_code: 'UNAUTHORIZED',
    message: 'Esta consulta exige uma conexão OAuth de administrador.',
  });
  assert.equal(mcpAdminAuthorizationError(actor.actorId), null);
});

test('consultas de conflito de identidade retornam somente metadados autorizados', async () => {
  const supabase = client({
    comm_whatsapp_identity_conflicts: { data: [{ id: 'conflict-1', channel_id: 'channel-1', chat_id: actor.actorId, conflict_type: 'reverse_mapping_conflict', status: 'open', created_at: '2026-09-15T10:00:00.000Z', updated_at: '2026-09-15T10:00:00.000Z', resolved_at: null, resolved_by: null }] },
  });
  const result = await executeMcpCommercialReadAction({ supabase: supabase as never, toolName: 'kifer_list_identity_conflicts', arguments: { status: 'open' } });

  assert.equal(result?.success, true);
  assert.deepEqual(supabase.selections, ['id,channel_id,chat_id,conflict_type,status,created_at,updated_at,resolved_at,resolved_by']);
  assert.equal(JSON.stringify(result).includes('private-id'), false);
});

test('rejeita filtro inválido ao listar conflitos de identidade', async () => {
  const supabase = client({});
  const result = await executeMcpCommercialReadAction({ supabase: supabase as never, toolName: 'kifer_list_identity_conflicts', arguments: { status: 'pending' } });

  assert.equal(result?.error_code, 'INVALID_INPUT');
  assert.deepEqual(supabase.calls, []);
});

test('não retorna nem audita detalhes internos de uma exceção inesperada', async () => {
  const base = client({ mcp_action_audit_log: {} });
  const supabase = {
    ...base,
    from: (table: string) => {
      if (table === 'leads') throw new Error('service_role_secret=internal-value');
      return base.from(table);
    },
  };
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_lead', arguments: { lead_id: actor.actorId, changes: { cidade: 'Campinas' } }, actor });

  assert.deepEqual(result, { success: false, error_code: 'INTERNAL_ERROR', message: 'Falha inesperada ao executar a ação. Detalhes internos não foram expostos.' });
  const auditWrite = base.writes.find((write) => write.table === 'mcp_action_audit_log');
  assert.equal(JSON.stringify(auditWrite).includes('internal-value'), false);
});

test('mascara dados pessoais no payload de auditoria de atualizações comerciais', async () => {
  const supabase = client({
    leads: [
      { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel_id: actor.actorId } },
      { data: { id: actor.actorId, email: 'paula@example.com', telefone: '+55 11 99999-9999' } },
    ],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_lead', arguments: { lead_id: actor.actorId, changes: { email: 'paula@example.com', telefone: '+55 11 99999-9999' } }, actor });
  const audit = supabase.writes.find((write) => write.table === 'mcp_action_audit_log');

  assert.equal(result?.success, true);
  assert.equal(JSON.stringify(audit).includes('paula@example.com'), false);
  assert.equal(JSON.stringify(audit).includes('+55 11 99999-9999'), false);
});

test('rejeita mensagem vazia sem tentar enviar ao provider', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_message', arguments: { chat_id: '11111111-1111-1111-1111-111111111111', message: '', client_request_id: 'request-1' }, actor });

  assert.deepEqual(result, { success: false, error_code: 'MESSAGE_EMPTY', message: 'A mensagem não pode estar vazia.' });
  assert.deepEqual(supabase.calls, ['mcp_action_audit_log']);
});

test('valida prévia de arquivamento em lote sem alterar leads', async () => {
  const secondLeadId = '22222222-2222-2222-2222-222222222222';
  const supabase = client({
    leads: [{ data: { id: actor.actorId, arquivado: false } }, { data: { id: secondLeadId, arquivado: true } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_bulk_archive_leads',
    arguments: { lead_ids: [actor.actorId, secondLeadId], dry_run: true },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal(result?.dry_run, true);
  assert.equal(result?.requested_count, 2);
  assert.equal(result?.succeeded_count, 2);
  assert.deepEqual(result?.results, [
    { lead_id: actor.actorId, success: true, would_archive: true },
    { lead_id: secondLeadId, success: true, unchanged: true },
  ]);
  assert.equal(supabase.writes.some((write) => write.table === 'leads'), false);
});

test('rejeita IDs duplicados ou acima do limite em ações de leads em lote', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const duplicate = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_bulk_archive_leads', arguments: { lead_ids: [actor.actorId, actor.actorId] }, actor });
  const tooMany = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_bulk_archive_leads', arguments: { lead_ids: Array.from({ length: 26 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`) }, actor });

  assert.equal(duplicate?.error_code, 'INVALID_INPUT');
  assert.equal(tooMany?.error_code, 'INVALID_INPUT');
  assert.equal(supabase.writes.some((write) => write.table === 'leads'), false);
});

test('altera status de contrato configurado com controle de concorrência', async () => {
  const contractId = '33333333-3333-3333-3333-333333333333';
  const updatedAt = '2026-09-15T10:00:00.000Z';
  const supabase = client({
    contracts: [
      { data: { id: contractId, codigo_contrato: 'KF-2026-001', status: 'Ativo', updated_at: updatedAt } },
      { data: { id: contractId, codigo_contrato: 'KF-2026-001', status: 'Suspenso', updated_at: '2026-09-15T11:00:00.000Z' } },
      { data: { id: contractId, codigo_contrato: 'KF-2026-001', status: 'Suspenso', updated_at: '2026-09-15T11:00:00.000Z' } },
    ],
    contract_status_config: { data: { value: 'Suspenso', ativo: true } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_contract_status', arguments: { contract_id: contractId, status: 'Suspenso', expected_updated_at: updatedAt }, actor });
  const repeatedWithOldVersion = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_contract_status', arguments: { contract_id: contractId, status: 'Suspenso', expected_updated_at: updatedAt }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.status_anterior, 'Ativo');
  assert.equal(result?.status_novo, 'Suspenso');
  assert.equal(repeatedWithOldVersion?.error_code, 'CONFLICT');
  const contractUpdate = supabase.writes.find((write) => write.table === 'contracts')?.value as { status?: string; updated_at?: string };
  assert.equal(contractUpdate.status, 'Suspenso');
  assert.ok(contractUpdate.updated_at);
  assert.ok(Date.parse(contractUpdate.updated_at) > Date.parse(updatedAt));
  assert.equal(supabase.writes.filter((write) => write.table === 'contracts').length, 1);
  assert.ok(supabase.filters.some((filter) => filter.table === 'contracts' && filter.column === 'updated_at' && filter.value === updatedAt));
});

test('não reabre contrato encerrado nem atualiza sobre versão desatualizada', async () => {
  const contractId = '33333333-3333-3333-3333-333333333333';
  const updatedAt = '2026-09-15T10:00:00.000Z';
  const closed = client({ contracts: { data: { id: contractId, codigo_contrato: 'KF-2026-001', status: 'Encerrado', updated_at: updatedAt } }, mcp_action_audit_log: {} });
  const stale = client({ contracts: { data: { id: contractId, codigo_contrato: 'KF-2026-001', status: 'Ativo', updated_at: '2026-09-15T11:00:00.000Z' } }, mcp_action_audit_log: {} });
  const closedResult = await executeMcpWriteAction({ supabase: closed as never, toolName: 'kifer_cancel_contract', arguments: { contract_id: contractId, expected_updated_at: updatedAt }, actor });
  const staleResult = await executeMcpWriteAction({ supabase: stale as never, toolName: 'kifer_cancel_contract', arguments: { contract_id: contractId, expected_updated_at: updatedAt }, actor });

  assert.equal(closedResult?.error_code, 'NOT_ALLOWED');
  assert.equal(staleResult?.error_code, 'CONFLICT');
  assert.equal(closed.writes.some((write) => write.table === 'contracts'), false);
  assert.equal(stale.writes.some((write) => write.table === 'contracts'), false);
});

test('enfileira follow-up em lote com chave estável e detecta reutilização divergente', async () => {
  const job = { id: '44444444-4444-4444-8444-444444444444', lead_id: actor.actorId, flow_id: 'flow-1', status: 'pending', scheduled_at: '2026-09-16T10:00:00.000Z', action_payload: { mcp_request_signature: JSON.stringify({ lead_id: actor.actorId, flow_id: 'flow-1', scheduled_at: null, observacao: '' }) } };
  const supabase = client({
    leads: { data: { id: actor.actorId, status: 'Novo', status_id: null, responsavel_id: actor.actorId } },
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Retorno', ativo: true, triggerType: 'lead_created', steps: [{ id: 'step-1', actionType: 'create_task', enabled: true, delayValue: 1, delayUnit: 'days' }] }] } } },
    auto_contact_flow_jobs: [{ data: null }, { data: null }, { data: job }, { data: job }, { data: job }],
    mcp_action_audit_log: {},
  });
  const first = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_bulk_enqueue_followup', arguments: { lead_ids: [actor.actorId], flow_id: 'flow-1', client_request_id: 'follow-up-1' }, actor });
  const repeated = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_bulk_enqueue_followup', arguments: { lead_ids: [actor.actorId], flow_id: 'flow-1', client_request_id: 'follow-up-1' }, actor });
  const repeatedWithDifferentSchedule = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_bulk_enqueue_followup', arguments: { lead_ids: [actor.actorId], flow_id: 'flow-1', scheduled_at: '2026-09-20T10:00:00.000Z', client_request_id: 'follow-up-1' }, actor });

  assert.equal(first?.success, true);
  assert.equal((repeated?.results as Array<{ duplicate?: boolean }>)[0]?.duplicate, true);
  assert.equal(repeatedWithDifferentSchedule?.success, false);
  assert.equal((repeatedWithDifferentSchedule?.results as Array<{ error_code?: string }>)[0]?.error_code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(supabase.writes.filter((write) => write.table === 'auto_contact_flow_jobs').length, 1);
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
      { data: { id: 'scheduled-1', chat_id: actor.actorId, lead_id: '33333333-3333-3333-3333-333333333333', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled', cancel_on_inbound_message: true } },
    ],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: 'Olá, Larissa!', scheduled_at: '2026-10-01T13:00:00.000Z', cancel_on_inbound_message: true, client_request_id: 'schedule-1' },
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
    cancel_on_inbound_message: true,
    client_request_id: 'schedule-1',
  });
  const inserted = supabase.writes.find((write) => write.operation === 'insert' && write.table === 'comm_whatsapp_scheduled_messages');
  assert.equal((inserted?.value as { cancel_on_inbound_message?: boolean }).cancel_on_inbound_message, true);
});

test('agenda um documento privado sem exigir texto e sem aceitar URL externa', async () => {
  const supabase = client({
    comm_whatsapp_chats: { data: { id: actor.actorId, channel_id: '22222222-2222-2222-2222-222222222222', phone_digits: '5511999999999', phone_number: '+55 11 99999-9999', display_name: 'Larissa', lead_id: null, deleted_at: null } },
    comm_whatsapp_scheduled_messages: [{ data: null }, { data: { id: 'scheduled-media-1', chat_id: actor.actorId, lead_id: null, scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' } }],
    mcp_action_audit_log: {},
  });
  const media = { storage_path: `mcp/${actor.actorId}/proposal-1-proposta.pdf`, message_type: 'document', mime_type: 'application/pdf', file_name: 'proposta.pdf' };
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { chat_id: actor.actorId, message: '', media, scheduled_at: '2026-10-01T13:00:00.000Z', client_request_id: 'schedule-media-1' },
    actor,
  });

  assert.equal(result?.success, true);
  const inserted = supabase.writes.find((write) => write.operation === 'insert' && write.table === 'comm_whatsapp_scheduled_messages');
  const insertedValue = inserted?.value as Record<string, unknown>;
  assert.equal(insertedValue.message_type, 'document');
  assert.equal(insertedValue.text_content, null);
  assert.equal(insertedValue.media_url, `storage://comm-whatsapp-scheduled-media/${media.storage_path}`);
  assert.equal(insertedValue.media_mime_type, 'application/pdf');
  assert.equal(insertedValue.media_file_name, 'proposta.pdf');
});

test('envia anexo MCP privado e não grava o base64 na auditoria', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_upload_scheduled_whatsapp_media',
    arguments: { file_name: 'proposta.pdf', mime_type: 'application/pdf', content_base64: 'AQID', client_request_id: 'upload-media-1' },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal((result?.media as { storage_path?: string }).storage_path, `mcp/${actor.actorId}/upload-media-1-proposta.pdf`);
  const audit = supabase.writes.find((write) => write.table === 'mcp_action_audit_log');
  assert.equal(((audit?.value as { request_payload?: { content_base64?: string } }).request_payload?.content_base64), '[REDACTED]');
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
  assert.deepEqual(result?.scheduled_messages, [{ scheduled_message_id: 'scheduled-1', chat_id: actor.actorId, lead_id: '33333333-3333-3333-3333-333333333333', lead_name: 'Larissa', message: 'Olá\n---\nTudo bem?', message_parts_count: 2, scheduled_at: '2026-10-01T13:00:00.000Z', scheduled_at_utc: '2026-10-01T13:00:00.000Z', timezone: 'America/Sao_Paulo', status: 'scheduled', cancel_on_inbound_message: false, client_request_id: 'request-1', created_at: '2026-09-30T13:00:00.000Z', updated_at: '2026-09-30T13:00:00.000Z', sent_at: null, cancelled_at: null, last_error: null, cancellation_reason: null, delivery_status: null }]);
});

test('lista leads sem chat por anti-join da FK e retorna o total real além da página', async () => {
  const supabase = client({
    leads: {
      data: [{ id: actor.actorId, nome_completo: 'Lead Perdido', telefone: '21979949423', email: 'lead@kifer.test', status: 'Perdido', cidade: 'Rio de Janeiro', estado: 'RJ', data_criacao: '2026-01-01T12:00:00.000Z', created_at: '2026-01-01T12:00:00.000Z', ultimo_contato: '2026-02-01T12:00:00.000Z', ultima_tentativa_reativacao: null, numero_tentativas_reativacao: 0, reativacao_habilitada: true, arquivado: false }],
      count: 1234,
    },
  });
  const result = await executeMcpCommercialReadAction({
    supabase: supabase as never,
    toolName: 'kifer_list_leads_without_whatsapp_chat',
    arguments: { status: 'Perdido', reativacao_habilitada: true, tem_telefone: true, page: 1, page_size: 100 },
  });

  assert.equal(result?.success, true);
  assert.equal(result?.total, 1234);
  assert.equal(result?.has_more, true);
  assert.equal((result?.leads as Array<{ id: string }>)[0]?.id, actor.actorId);
  assert.ok(supabase.selections.some((selection) => selection.includes('linked_chats:comm_whatsapp_chats!comm_whatsapp_chats_lead_id_fkey()')));
  assert.ok(supabase.filters.some((filter) => filter.table === 'leads' && filter.operator === 'is' && filter.column === 'linked_chats' && filter.value === null));
  assert.ok(supabase.filters.some((filter) => filter.operator === 'eq' && filter.column === 'status' && filter.value === 'Perdido'));
  assert.ok(supabase.filters.some((filter) => filter.operator === 'eq' && filter.column === 'reativacao_habilitada' && filter.value === true));
  assert.ok(supabase.filters.some((filter) => filter.operator === 'neq' && filter.column === 'telefone' && filter.value === ''));
  assert.deepEqual(supabase.writes, []);
});

test('conta leads sem chat com a mesma regra de FK sem carregar uma página de resultados', async () => {
  const supabase = client({ leads: { data: [], count: 87 } });
  const result = await executeMcpCommercialReadAction({
    supabase: supabase as never,
    toolName: 'kifer_count_leads_without_whatsapp_chat',
    arguments: { status: 'Perdido', reativacao_habilitada: true, tem_telefone: true },
  });

  assert.deepEqual(result, {
    success: true,
    total: 87,
    filters_applied: {
      status: 'Perdido', reativacao_habilitada: true, arquivado: null, tem_telefone: true,
      ultima_tentativa_reativacao_is_null: null, data_criacao_de: null, data_criacao_ate: null,
      ultimo_contato_de: null, ultimo_contato_ate: null,
    },
  });
  assert.ok(supabase.filters.some((filter) => filter.operator === 'is' && filter.column === 'linked_chats' && filter.value === null));
  assert.deepEqual(supabase.writes, []);
});

test('diagnostica chat não vinculado pelo telefone sem excluir nem vincular o lead', async () => {
  const supabase = client({
    leads: { data: [{ id: actor.actorId, nome_completo: 'Lead sem vínculo', telefone: '21979949423', email: null, status: 'Perdido', cidade: null, estado: null, data_criacao: null, created_at: '2026-01-01T12:00:00.000Z', ultimo_contato: null, ultima_tentativa_reativacao: null, numero_tentativas_reativacao: 0, reativacao_habilitada: true, arquivado: false }], count: 1 },
    comm_whatsapp_chats: { data: [{ id: '22222222-2222-2222-2222-222222222222', phone_digits: '5521979949423' }] },
  });
  const result = await executeMcpCommercialReadAction({
    supabase: supabase as never,
    toolName: 'kifer_list_leads_without_whatsapp_chat',
    arguments: { include_phone_chat_diagnostic: true },
  });
  const lead = (result?.leads as Array<Record<string, unknown>>)[0];

  assert.equal(lead.unlinked_chat_same_phone, true);
  assert.equal(lead.unlinked_chat_id, '22222222-2222-2222-2222-222222222222');
  assert.equal(lead.linked_chat_exists, false);
  assert.ok(supabase.filters.some((filter) => filter.table === 'comm_whatsapp_chats' && filter.operator === 'is' && filter.column === 'lead_id' && filter.value === null));
  assert.deepEqual(supabase.writes, []);
});

test('consulta um agendamento específico pelo id', async () => {
  const supabase = client({
    comm_whatsapp_scheduled_messages: { data: { id: 'scheduled-1', chat_id: actor.actorId, lead_id: null, text_content: 'Olá 😊', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled', mcp_client_request_id: 'request-1', created_at: '2026-09-30T13:00:00.000Z', updated_at: '2026-09-30T13:00:00.000Z' } },
  });
  const result = await executeMcpCommercialReadAction({ supabase: supabase as never, toolName: 'kifer_get_scheduled_whatsapp_message', arguments: { scheduled_message_id: actor.actorId } });

  assert.equal(result?.success, true);
  assert.equal((result?.scheduled_message as { message?: string }).message, 'Olá 😊');
  assert.equal((result?.scheduled_message as { cancel_on_inbound_message?: boolean }).cancel_on_inbound_message, false);
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

test('permite ativar a regra de cancelar se o contato responder em agendamento pendente', async () => {
  const current = { id: actor.actorId, chat_id: '22222222-2222-2222-2222-222222222222', lead_id: null, text_content: 'Pendente', scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled', cancel_on_inbound_message: false };
  const updated = { ...current, cancel_on_inbound_message: true };
  const supabase = client({ comm_whatsapp_scheduled_messages: [{ data: current }, { data: updated }], mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_update_scheduled_whatsapp_message',
    arguments: { scheduled_message_id: actor.actorId, changes: { cancel_on_inbound_message: true } },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal((result?.scheduled_message as { cancel_on_inbound_message?: boolean }).cancel_on_inbound_message, true);
  assert.deepEqual(supabase.writes[0]?.value, { cancel_on_inbound_message: true });
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
      { chat_id: actor.actorId, message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', cancel_on_inbound_message: true, client_request_id: 'bulk-1' },
      { chat_id: '22222222-2222-2222-2222-222222222222', message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'bulk-2' },
    ] },
    actor,
  });

  assert.deepEqual({ scheduled: result?.scheduled, duplicates: result?.duplicates, failed: result?.failed }, { scheduled: 1, duplicates: 0, failed: 1 });
  const inserted = supabase.writes.find((write) => write.operation === 'insert' && write.table === 'comm_whatsapp_scheduled_messages');
  assert.equal((inserted?.value as { cancel_on_inbound_message?: boolean }).cancel_on_inbound_message, true);
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

test('envia mídia pelo caminho interno existente e audita sem gravar o base64', async () => {
  stubMcpSendEnvironment();
  let receivedForm: FormData | null = null;
  let receivedHeaders: Headers | null = null;
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    receivedForm = init?.body as FormData;
    receivedHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ success: true, messageId: 'media-provider-1', status: 'sent' }), { status: 202 });
  }));
  const supabase = client({
    comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: null } },
    comm_whatsapp_messages: { data: { id: 'persisted-media-1', message_at: '2026-10-01T13:00:00.000Z', delivery_status: 'sent' } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_send_whatsapp_media',
    arguments: { chat_id: actor.actorId, file_name: 'proposta.pdf', mime_type: 'application/pdf', content_base64: 'AQID', caption: 'Segue a proposta', client_request_id: 'media-send-1' },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal(result?.media_kind, 'document');
  assert.equal(receivedForm?.get('type'), 'document');
  assert.equal(receivedForm?.get('chatId'), '5511999999999@s.whatsapp.net');
  assert.equal(receivedForm?.get('clientRequestId'), 'media-send-1');
  assert.equal(receivedHeaders?.get('X-Kifer-MCP-Actor-Id'), actor.actorId);
  const file = receivedForm?.get('file');
  assert.ok(file instanceof File);
  assert.equal((file as File).name, 'proposta.pdf');
  const audit = supabase.writes.find((write) => write.table === 'mcp_action_audit_log');
  assert.equal((audit?.value as { request_payload?: { content_base64?: string } }).request_payload?.content_base64, '[REDACTED]');
});

test('recusa tipo de mídia incompatível antes de contactar o provider', async () => {
  stubMcpSendEnvironment();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const supabase = client({ comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: null } }, mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_media', arguments: { chat_id: actor.actorId, file_name: 'proposta.pdf', mime_type: 'application/pdf', media_kind: 'image', content_base64: 'AQID', client_request_id: 'media-bad-type' }, actor });

  assert.equal(result?.error_code, 'INVALID_MEDIA');
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('preserva estado ambíguo do provider para impedir retry cego de mídia', async () => {
  stubMcpSendEnvironment();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'uncertain provider state', ambiguous: true }), { status: 500 })));
  const supabase = client({ comm_whatsapp_chats: { data: { id: actor.actorId, external_chat_id: '5511999999999@s.whatsapp.net', deleted_at: null } }, mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_send_whatsapp_media', arguments: { chat_id: actor.actorId, file_name: 'proposta.pdf', mime_type: 'application/pdf', content_base64: 'AQID', client_request_id: 'media-ambiguous-1' }, actor });

  assert.equal(result?.success, false);
  assert.equal(result?.ambiguous, true);
  assert.match(String(result?.message), /incerto/);
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

test('agenda por lead existente e cria o chat canônico do Inbox quando ele ainda não existe', async () => {
  const lead = { id: actor.actorId, nome_completo: 'Aline', telefone: '21979949423' };
  const createdChat = { ...mcpInboxChat, lead_id: lead.id };
  const supabase = client({
    leads: [{ data: lead }, { data: lead }],
    comm_whatsapp_channels: { data: mcpInboxChannel },
    comm_whatsapp_chats: [{ data: null }, { data: createdChat }, { data: createdChat }],
    comm_whatsapp_scheduled_messages: [{ data: null }, { data: { id: 'scheduled-by-lead', chat_id: createdChat.id, lead_id: lead.id, scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled', cancel_on_inbound_message: true } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { lead_id: lead.id, message: 'Olá, Aline!', scheduled_at: '2026-10-01T10:00:00-03:00', cancel_on_inbound_message: true, client_request_id: 'schedule-lead-new-chat-1' },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal(result?.chat_id, createdChat.id);
  assert.equal(result?.lead_id, lead.id);
  assert.equal(result?.cancel_on_inbound_message, true);
  const created = supabase.writes.find((write) => write.table === 'comm_whatsapp_chats' && write.operation === 'insert');
  assert.equal((created?.value as { lead_id?: string }).lead_id, lead.id);
  assert.equal((created?.value as { phone_digits?: string }).phone_digits, '5521979949423');
  assert.ok(supabase.writes.some((write) => write.table === 'comm_whatsapp_scheduled_messages' && write.operation === 'insert'));
});

test('reutiliza o chat já vinculado ao lead ao agendar por lead_id', async () => {
  const lead = { id: actor.actorId, nome_completo: 'Aline', telefone: '21979949423' };
  const existingChat = { ...mcpInboxChat, lead_id: lead.id };
  const supabase = client({
    leads: [{ data: lead }, { data: lead }],
    comm_whatsapp_channels: { data: mcpInboxChannel },
    comm_whatsapp_chats: [{ data: existingChat }, { data: existingChat }],
    comm_whatsapp_scheduled_messages: [{ data: null }, { data: { id: 'scheduled-by-lead-existing', chat_id: existingChat.id, lead_id: lead.id, scheduled_at: '2026-10-01T13:00:00.000Z', status: 'scheduled' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { lead_id: lead.id, message: 'Olá, Aline!', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'schedule-lead-existing-chat-1' },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal(result?.chat_id, existingChat.id);
  assert.ok(!supabase.writes.some((write) => write.table === 'comm_whatsapp_chats'));
});

test('recusa agendamento por lead sem telefone e a combinação ambígua de chat_id e lead_id', async () => {
  const noPhone = await executeMcpWriteAction({
    supabase: client({ leads: { data: { id: actor.actorId, telefone: null } }, mcp_action_audit_log: {} }) as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { lead_id: actor.actorId, message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'schedule-no-phone-1' },
    actor,
  });
  const ambiguousClient = client({ mcp_action_audit_log: {} });
  const ambiguous = await executeMcpWriteAction({
    supabase: ambiguousClient as never,
    toolName: 'kifer_schedule_whatsapp_message',
    arguments: { lead_id: actor.actorId, chat_id: mcpInboxChat.id, message: 'Olá', scheduled_at: '2026-10-01T10:00:00-03:00', client_request_id: 'schedule-ambiguous-1' },
    actor,
  });

  assert.equal(noPhone?.error_code, 'INVALID_INPUT');
  assert.equal(ambiguous?.error_code, 'INVALID_INPUT');
  assert.deepEqual(ambiguousClient.calls, ['mcp_action_audit_log']);
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

test('consulta fluxo de follow-up sem expor URLs, IDs de template ou payloads de mídia', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Boas-vindas', triggerType: 'lead_created', steps: [{ id: 'step-1', actionType: 'send_message', messageSource: 'template', templateId: 'provider-template-secret', messages: ['Olá!'], mediaUrl: 'https://internal.test/private.pdf', schedulingPayload: { token: 'never-return' } }] }] } } },
    auto_contact_flow_jobs: { data: [] },
  });
  const result = await executeMcpCommercialReadAction({ supabase: supabase as never, toolName: 'kifer_get_followup_flow', arguments: { flow_id: 'flow-1' } });

  assert.deepEqual(result?.flow?.steps, [{ id: 'step-1', ordem: 0, action_type: 'send_message', delay_value: null, delay_unit: '', enabled: true, message_source: 'template', message_texts: ['Olá!'] }]);
  assert.equal(JSON.stringify(result).includes('provider-template-secret'), false);
  assert.equal(JSON.stringify(result).includes('internal.test'), false);
  assert.equal(JSON.stringify(result).includes('never-return'), false);
});

test('bloqueia exclusão de etapa enquanto o fluxo ainda tem jobs ativos', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Retorno', triggerType: 'lead_created', steps: [{ id: 'step-1', actionType: 'create_task' }] }] } } },
    auto_contact_flow_jobs: { data: [{ id: 'job-1' }] },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_delete_followup_step', arguments: { flow_id: 'flow-1', step_id: 'step-1' }, actor });

  assert.equal(result?.error_code, 'CONFLICT');
  assert.equal(supabase.writes.some((write) => write.table === 'integration_settings'), false);
});

test('exclui etapa somente após confirmar que não há jobs ativos e preserva as demais', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Retorno', triggerType: 'lead_created', steps: [{ id: 'step-1', actionType: 'create_task' }, { id: 'step-2', actionType: 'update_status', statusToSet: 'Contato' }] }] } } },
    auto_contact_flow_jobs: { data: [] },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_delete_followup_step', arguments: { flow_id: 'flow-1', step_id: 'step-1' }, actor });

  assert.equal(result?.success, true);
  const update = supabase.writes.find((write) => write.table === 'integration_settings')?.value as { settings: { flows: Array<{ steps: Array<{ id: string }> }> } };
  assert.deepEqual(update.settings.flows[0].steps.map((step) => step.id), ['step-2']);
  assert.ok(supabase.writes.some((write) => write.table === 'mcp_action_audit_log'));
});

test('reordenar etapas exige uma permutação exata dos IDs existentes', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Retorno', triggerType: 'lead_created', steps: [{ id: 'step-1' }, { id: 'step-2' }] }] } } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_reorder_followup_steps', arguments: { flow_id: 'flow-1', step_ids: ['step-1', 'step-1'] }, actor });

  assert.equal(result?.error_code, 'INVALID_INPUT');
  assert.equal(supabase.calls.includes('auto_contact_flow_jobs'), false);
  assert.equal(supabase.writes.some((write) => write.table === 'integration_settings'), false);
});

test('reordena etapas com jobs ociosos sem descartar configuração de etapa', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Retorno', triggerType: 'lead_created', steps: [{ id: 'step-1', customMessage: { text: 'Oi' } }, { id: 'step-2', statusToSet: 'Contato' }] }] } } },
    auto_contact_flow_jobs: { data: [] },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_reorder_followup_steps', arguments: { flow_id: 'flow-1', step_ids: ['step-2', 'step-1'] }, actor });

  assert.equal(result?.success, true);
  const update = supabase.writes.find((write) => write.table === 'integration_settings')?.value as { settings: { flows: Array<{ steps: Array<{ id: string; statusToSet?: string; customMessage?: { text: string } }> }> } };
  assert.deepEqual(update.settings.flows[0].steps, [{ id: 'step-2', statusToSet: 'Contato' }, { id: 'step-1', customMessage: { text: 'Oi' } }]);
});

test('atualiza nome e tipo de gatilho do fluxo com validação fechada', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Antes', ativo: true, triggerType: 'lead_created', triggerStatuses: [], triggerDurationHours: 0, scheduling: { startHour: '08:00', endHour: '18:00', allowedWeekdays: [1, 2, 3, 4, 5], dailySendLimit: null }, steps: [] }] } } },
    lead_status_config: { data: [{ nome: 'Novo', ativo: true }] },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_update_followup_flow', arguments: { flow_id: 'flow-1', changes: { nome: 'Novo nome', trigger_type: 'status_changed', trigger_statuses: ['Novo'] } }, actor });

  assert.equal(result?.success, true);
  const update = supabase.writes.find((write) => write.table === 'integration_settings')?.value as { settings: { flows: Array<{ name: string; triggerType: string; triggerStatuses: string[] }> } };
  assert.deepEqual(update.settings.flows[0], { id: 'flow-1', name: 'Novo nome', ativo: true, triggerType: 'status_changed', triggerStatuses: ['Novo'], triggerStatus: 'Novo', triggerDurationHours: 0, scheduling: { startHour: '08:00', endHour: '18:00', allowedWeekdays: [1, 2, 3, 4, 5], dailySendLimit: null }, steps: [] });
});

test('rejeita propriedades desconhecidas ou IDs repetidos nos ajustes de etapas', async () => {
  const supabase = client({
    integration_settings: { data: { id: 'integration-1', settings: { flows: [{ id: 'flow-1', name: 'Fluxo', ativo: true, triggerType: 'lead_created', triggerStatuses: [], triggerDurationHours: 0, scheduling: { startHour: '08:00', endHour: '18:00', allowedWeekdays: [1, 2, 3, 4, 5], dailySendLimit: null }, steps: [{ id: 'step-1', delayValue: 1, delayUnit: 'days' }] }] } } },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_update_followup_flow',
    arguments: { flow_id: 'flow-1', changes: { step_delays: [{ step_id: 'step-1', delay_value: 2, delay_unit: 'hours', action_config: { actionType: 'delete_lead' } }] } },
    actor,
  });

  assert.equal(result?.error_code, 'INVALID_INPUT');
  assert.equal(supabase.writes.some((write) => write.table === 'integration_settings'), false);
});

test('arquiva lead logicamente e registra a mutação', async () => {
  const supabase = client({
    leads: [{ data: { id: actor.actorId, arquivado: false } }, { data: { id: actor.actorId, arquivado: true, updated_at: '2026-09-15T12:00:00.000Z' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_archive_lead', arguments: { lead_id: actor.actorId }, actor });

  assert.deepEqual(result, { success: true, lead_id: actor.actorId, arquivado: true, updated_at: '2026-09-15T12:00:00.000Z' });
  assert.ok(supabase.writes.some((write) => write.table === 'leads' && write.operation === 'update'));
  assert.ok(supabase.writes.some((write) => write.table === 'mcp_action_audit_log'));
});

test('desarquiva lead sem recriar nem apagar o histórico', async () => {
  const supabase = client({
    leads: [{ data: { id: actor.actorId, arquivado: true } }, { data: { id: actor.actorId, arquivado: false, updated_at: '2026-09-15T12:00:00.000Z' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_unarchive_lead', arguments: { lead_id: actor.actorId }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.arquivado, false);
  assert.equal(supabase.writes.filter((write) => write.table === 'leads').length, 1);
});

test('define favorito do lead e é idempotente para o estado atual', async () => {
  const supabase = client({
    leads: [{ data: { id: actor.actorId, favorito: false } }, { data: { id: actor.actorId, favorito: true, updated_at: '2026-09-15T12:00:00.000Z' } }],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_set_lead_favorite', arguments: { lead_id: actor.actorId, favorite: true }, actor });

  assert.equal(result?.success, true);
  assert.equal(result?.favorito, true);
});

test('favorito exige booleano e não escreve payload administrativo arbitrário', async () => {
  const supabase = client({ mcp_action_audit_log: {} });
  const result = await executeMcpWriteAction({ supabase: supabase as never, toolName: 'kifer_set_lead_favorite', arguments: { lead_id: actor.actorId, favorite: 'true' }, actor });

  assert.equal(result?.error_code, 'INVALID_INPUT');
  assert.deepEqual(supabase.calls, ['mcp_action_audit_log']);
});

test('administração de lead aceita somente controles comerciais e datas reais', async () => {
  const invalidDatesClient = client({ mcp_action_audit_log: {} });
  const invalidDates = await executeMcpWriteAction({
    supabase: invalidDatesClient as never,
    toolName: 'kifer_update_lead_administration',
    arguments: { lead_id: actor.actorId, changes: { blackout_dates: ['2026-02-30'] } },
    actor,
  });
  assert.equal(invalidDates?.error_code, 'INVALID_INPUT');
  assert.deepEqual(invalidDatesClient.calls, ['mcp_action_audit_log']);

  const massAssignmentClient = client({ mcp_action_audit_log: {} });
  const massAssignment = await executeMcpWriteAction({
    supabase: massAssignmentClient as never,
    toolName: 'kifer_update_lead_administration',
    arguments: { lead_id: actor.actorId, changes: { auto_message_attempts: 100 } },
    actor,
  });
  assert.equal(massAssignment?.error_code, 'NOT_ALLOWED');
  assert.deepEqual(massAssignmentClient.calls, ['mcp_action_audit_log']);
});

test('atualiza controles administrativos permitidos sem aceitar mass assignment', async () => {
  const supabase = client({
    leads: [
      { data: { id: actor.actorId } },
      { data: { id: actor.actorId, skip_automation: true, reativacao_habilitada: false, daily_send_limit: 5, blackout_dates: ['2026-12-25'], updated_at: '2026-09-15T12:00:00.000Z' } },
    ],
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_update_lead_administration',
    arguments: { lead_id: actor.actorId, changes: { skip_automation: true, reativacao_habilitada: false, daily_send_limit: 5, blackout_dates: ['2026-12-25', '2026-12-25'] } },
    actor,
  });

  assert.equal(result?.success, true);
  assert.deepEqual((result?.lead as { blackout_dates?: string[] })?.blackout_dates, ['2026-12-25']);
  const update = supabase.writes.find((write) => write.table === 'leads' && write.operation === 'update')?.value as Record<string, unknown>;
  assert.equal(update.skip_automation, true);
  assert.equal('auto_message_attempts' in update, false);
});

test('cria lead com opções ativas e repete a mesma requisição sem duplicar', async () => {
  const createdLead = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nome_completo: 'Pessoa Teste', telefone: '11999999999', status: 'Novo' };
  const handlers = {
    leads: [{ data: null }, { data: [] }, { data: createdLead }],
    lead_status_config: { data: [{ id: '22222222-2222-2222-2222-222222222222', nome: 'Novo', padrao: true, ordem: 1, ativo: true }] },
    lead_origens: { data: [{ id: '33333333-3333-3333-3333-333333333333', nome: 'Site', ativo: true }] },
    lead_responsaveis: { data: [{ id: '44444444-4444-4444-4444-444444444444', label: 'Equipe', value: 'Equipe', ordem: 1, ativo: true }] },
    lead_tipos_contratacao: { data: [{ id: '55555555-5555-5555-5555-555555555555', label: 'Individual', value: 'individual', ordem: 1, ativo: true }] },
    mcp_action_audit_log: {},
  };
  const supabase = client(handlers);
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_create_lead',
    arguments: { client_request_id: 'create-lead-1', lead: { nome_completo: 'Pessoa Teste', telefone: '(11) 99999-9999' } },
    actor,
  });

  assert.equal(result?.success, true);
  assert.equal(result?.duplicate, false);
  assert.equal((result?.lead as { telefone?: string })?.telefone, '11999999999');
  const inserted = supabase.writes.find((write) => write.table === 'leads' && write.operation === 'insert')?.value as Record<string, unknown>;
  assert.equal(inserted.skip_automation, false);
  assert.equal(inserted.creation_source, 'chatgpt_mcp');

  const repeatClient = client({
    ...handlers,
    leads: [{ data: createdLead }],
  });
  const repeated = await executeMcpWriteAction({
    supabase: repeatClient as never,
    toolName: 'kifer_create_lead',
    arguments: { client_request_id: 'create-lead-1', lead: { nome_completo: 'Pessoa Teste', telefone: '11999999999' } },
    actor,
  });
  assert.equal(repeated?.success, true);
  assert.equal(repeated?.duplicate, true);
  assert.equal(repeatClient.writes.filter((write) => write.table === 'leads' && write.operation === 'insert').length, 0);
});

test('não cria lead quando telefone ou e-mail já existe', async () => {
  const existing = { id: '66666666-6666-4666-8666-666666666666', nome_completo: 'Já cadastrado', telefone: '11999999999', email: null };
  const supabase = client({
    leads: [{ data: null }, { data: [existing] }],
    lead_status_config: { data: [{ id: '22222222-2222-2222-2222-222222222222', nome: 'Novo', padrao: true, ordem: 1, ativo: true }] },
    lead_origens: { data: [{ id: '33333333-3333-3333-3333-333333333333', nome: 'Site', ativo: true }] },
    lead_responsaveis: { data: [{ id: '44444444-4444-4444-4444-444444444444', label: 'Equipe', value: 'Equipe', ordem: 1, ativo: true }] },
    lead_tipos_contratacao: { data: [{ id: '55555555-5555-4555-8555-555555555555', label: 'Individual', value: 'individual', ordem: 1, ativo: true }] },
    mcp_action_audit_log: {},
  });
  const result = await executeMcpWriteAction({
    supabase: supabase as never,
    toolName: 'kifer_create_lead',
    arguments: { client_request_id: 'create-lead-2', lead: { nome_completo: 'Duplicado', telefone: '11999999999' } },
    actor,
  });

  assert.equal(result?.error_code, 'DUPLICATE_LEAD');
  assert.equal(supabase.writes.filter((write) => write.table === 'leads' && write.operation === 'insert').length, 0);
});
