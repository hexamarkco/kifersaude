import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validDate = (value: unknown): value is string => typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });
const version = { type: ['string', 'null'], format: 'date-time', description: 'ultima_modificacao retornada por kifer_list_reminders ou kifer_get_reminder; use null apenas se o registro retornou null.' };
const itemProperties = { reminder_id: { type: 'string', format: 'uuid' }, expected_ultima_modificacao: version };
const reminderSelect = 'id,lead_id,contract_id,tipo,titulo,descricao,data_lembrete,prioridade,lido,concluido_em,cancelled_at,cancellation_reason,created_at,ultima_modificacao';

export const MCP_AGENDA_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_get_reminder', description: 'Consulta um lembrete ou tarefa da agenda pelo ID, incluindo estado e ultima_modificacao para reagendar, reabrir ou excluir.', inputSchema: { type: 'object', required: ['reminder_id'], additionalProperties: false, properties: { reminder_id: itemProperties.reminder_id } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_reschedule_reminders', description: 'Reagenda de 1 a 100 lembretes ou tarefas da agenda em uma transação. Informe uma data com fuso por item; para distribuir 20 a cada 3 minutos, envie as 20 datas calculadas. Use as versões da leitura. dry_run valida sem gravar; reopen=true também torna um item concluído/cancelado pendente. Lotes maiores podem ser divididos em chamadas.', inputSchema: { type: 'object', required: ['items'], additionalProperties: false, properties: { items: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', required: ['reminder_id', 'expected_ultima_modificacao', 'data_lembrete'], additionalProperties: false, properties: { ...itemProperties, data_lembrete: { type: 'string', format: 'date-time' }, reopen: { type: 'boolean', default: false } } } }, dry_run: { type: 'boolean', default: false } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_reopen_reminder', description: 'Torna um lembrete concluído ou cancelado novamente pendente, preservando sua data. Informe a versão atual; para também mover a data use kifer_reschedule_reminders com reopen=true.', inputSchema: { type: 'object', required: ['reminder_id', 'expected_ultima_modificacao'], additionalProperties: false, properties: itemProperties }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_delete_reminders', description: 'Exclui definitivamente de 1 a 100 lembretes/tarefas, como a exclusão na agenda do CRM. Use somente se o usuário pediu exclusão e confirm_deletion=true; cancelar preserva o registro. A transação valida todas as versões antes de excluir. dry_run valida sem excluir.', inputSchema: { type: 'object', required: ['items', 'confirm_deletion'], additionalProperties: false, properties: { items: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', required: ['reminder_id', 'expected_ultima_modificacao'], additionalProperties: false, properties: itemProperties } }, confirm_deletion: { type: 'boolean', const: true }, dry_run: { type: 'boolean', default: false } } }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } },
];
export const MCP_AGENDA_WRITE_TOOL_NAMES = ['kifer_reschedule_reminders', 'kifer_reopen_reminder', 'kifer_delete_reminders'] as const;

export async function executeMcpAgendaReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  if (params.toolName !== 'kifer_get_reminder') return null;
  const id = params.arguments.reminder_id;
  if (typeof id !== 'string' || !UUID.test(id) || Object.keys(params.arguments).some((key) => key !== 'reminder_id')) return fail('INVALID_INPUT', 'reminder_id válido é obrigatório.');
  const { data, error } = await params.supabase.from('reminders').select(reminderSelect).eq('id', id).maybeSingle();
  if (error) return fail('DATABASE_ERROR', 'Não foi possível consultar o lembrete.');
  if (!data) return fail('NOT_FOUND', 'Lembrete não encontrado.');
  const { error: auditError } = await params.supabase.from('chatgpt_mcp_audit_log').insert({ tool_name: params.toolName, actor: params.actor.actor, resource_name: 'reminders', request_summary: { reminder_id: id } });
  if (auditError) console.error('[chatgpt-mcp] falha ao auditar consulta da agenda:', auditError.message);
  return { success: true, reminder: data };
}

export async function executeMcpAgendaWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_AGENDA_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (!UUID.test(actor.actorId)) return fail('UNAUTHORIZED', 'OAuth de administrador obrigatório.');
  const operation = toolName === 'kifer_reschedule_reminders' ? 'reschedule' : toolName === 'kifer_reopen_reminder' ? 'reopen' : 'delete';
  const allowed = operation === 'reopen' ? ['reminder_id', 'expected_ultima_modificacao'] : operation === 'delete' ? ['items', 'confirm_deletion', 'dry_run'] : ['items', 'dry_run'];
  if (Object.keys(args).some((key) => !allowed.includes(key)) || (args.dry_run !== undefined && typeof args.dry_run !== 'boolean')) return fail('INVALID_INPUT', 'A ação contém campos inválidos.');
  if (operation === 'delete' && args.confirm_deletion !== true) return fail('CONFIRMATION_REQUIRED', 'confirm_deletion=true é obrigatório para excluir.');
  const rawItems = operation === 'reopen' ? [{ reminder_id: args.reminder_id, expected_ultima_modificacao: args.expected_ultima_modificacao }] : args.items;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) return fail('INVALID_INPUT', 'Informe de 1 a 100 lembretes por lote.');
  const ids = new Set<string>();
  const items: Record<string, unknown>[] = [];
  for (const item of rawItems) {
    const itemKeys = operation === 'reschedule' ? ['reminder_id', 'expected_ultima_modificacao', 'data_lembrete', 'reopen'] : ['reminder_id', 'expected_ultima_modificacao'];
    if (!isRecord(item) || Object.keys(item).some((key) => !itemKeys.includes(key)) || typeof item.reminder_id !== 'string' || !UUID.test(item.reminder_id) || ids.has(item.reminder_id.toLowerCase()) || !('expected_ultima_modificacao' in item) || (item.expected_ultima_modificacao !== null && !validDate(item.expected_ultima_modificacao))) return fail('INVALID_INPUT', 'Cada item precisa de ID único e versão atual válida.');
    if (operation === 'reschedule' && (!validDate(item.data_lembrete) || (item.reopen !== undefined && typeof item.reopen !== 'boolean'))) return fail('INVALID_INPUT', 'Informe data_lembrete com fuso horário e reopen booleano quando usado.');
    ids.add(item.reminder_id.toLowerCase());
    items.push({ ...item, ...(operation === 'reschedule' ? { data_lembrete: new Date(item.data_lembrete as string).toISOString() } : {}) });
  }
  const { data, error } = await supabase.rpc('mcp_mutate_agenda_reminders', { p_actor_user_id: actor.actorId, p_operation: operation, p_items: items, p_dry_run: args.dry_run === true });
  if (error || !isRecord(data) || typeof data.success !== 'boolean') return fail('DATABASE_ERROR', 'Não foi possível executar a ação na agenda; consulte o estado dos lembretes antes de repetir.');
  return data as McpWriteResult;
}
