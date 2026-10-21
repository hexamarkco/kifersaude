import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const confirm = (description: string) => ({ type: 'boolean', const: true, description });

export const MCP_WHATSAPP_CONTACT_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_list_whatsapp_saved_contacts', description: 'Lista contatos salvos do canal WhatsApp conectado, com telefone e nome. A busca usa o cache sincronizado do provedor e pode atualizar esse cache quando estiver vencido; OAuth admin obrigatório.', inputSchema: { type: 'object', additionalProperties: false, properties: { query: { type: 'string', maxLength: 160 }, page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 100, default: 50 } } }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: 'kifer_save_whatsapp_contact', description: 'Salva um contato no catálogo da conta Whapi conectada. Faz alteração externa real e grava o cache do Inbox; exige confirm_save=true.', inputSchema: { type: 'object', required: ['phone_number', 'display_name', 'confirm_save'], additionalProperties: false, properties: { phone_number: { type: 'string', minLength: 10, maxLength: 32 }, display_name: { type: 'string', minLength: 1, maxLength: 160 }, confirm_save: confirm('Confirma o envio do novo contato ao provedor WhatsApp.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
  { name: 'kifer_rename_whatsapp_contact', description: 'Atualiza o nome de um contato salvo no catálogo da conta Whapi conectada e no cache do Inbox. A alteração é externa; exige confirm_rename=true.', inputSchema: { type: 'object', required: ['phone_number', 'display_name', 'confirm_rename'], additionalProperties: false, properties: { phone_number: { type: 'string', minLength: 10, maxLength: 32 }, display_name: { type: 'string', minLength: 1, maxLength: 160 }, confirm_rename: confirm('Confirma a alteração do contato real no provedor WhatsApp.') } }, annotations: { readOnlyHint: false, openWorldHint: true } },
];

export const MCP_WHATSAPP_CONTACT_READ_TOOL_NAMES = ['kifer_list_whatsapp_saved_contacts'] as const;
export const MCP_WHATSAPP_CONTACT_WRITE_TOOL_NAMES = ['kifer_save_whatsapp_contact', 'kifer_rename_whatsapp_contact'] as const;

const auditWrite = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, result: McpWriteResult, request: Record<string, unknown>) => {
  const { error } = await supabase.from('mcp_action_audit_log').insert({
    tool_name: toolName,
    action_type: toolName.replace(/^kifer_/, '').replaceAll('_', '-'),
    actor: actor.actor,
    actor_id: actor.actorId,
    request_payload: request,
    result_payload: { success: result.success, error_code: result.error_code ?? null },
    success: result.success,
    error_message: result.success ? null : text(result.message) || null,
    source: 'chatgpt_mcp',
  });
  if (error) console.error('[chatgpt-mcp] falha ao auditar contato WhatsApp:', error.message);
};

async function invoke(supabase: SupabaseClient, body: Record<string, unknown>, actor: McpWriteActor) {
  const { data, error } = await supabase.functions.invoke('comm-whatsapp-contacts', { body, headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId } });
  if (error || !isRecord(data) || data.error || data.success === false) return null;
  return data;
}

export async function executeMcpWhatsAppContactReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_WHATSAPP_CONTACT_READ_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (Object.keys(args).some((key) => !['query', 'page', 'page_size'].includes(key))) return fail('INVALID_INPUT', 'A consulta contém campos não permitidos.');
  const query = text(args.query);
  const page = Number(args.page ?? 1);
  const pageSize = Number(args.page_size ?? 50);
  if (query.length > 160 || !Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return fail('INVALID_INPUT', 'Busca ou paginação inválida.');
  const data = await invoke(supabase, { action: 'listContacts', query, page, pageSize }, actor);
  if (!data) return fail('CONTACTS_UNAVAILABLE', 'Não foi possível consultar os contatos WhatsApp.');
  const contacts = Array.isArray(data.contacts) ? data.contacts.filter(isRecord).map((contact) => ({
    id: text(contact.id),
    phone_number: text(contact.phone_number) || null,
    display_name: text(contact.display_name),
    short_name: text(contact.short_name) || null,
    saved: contact.saved === true,
    manual_override: contact.manual_override === true,
    last_synced_at: text(contact.last_synced_at) || null,
  })) : [];
  const { error } = await supabase.from('chatgpt_mcp_audit_log').insert({ tool_name: toolName, actor: actor.actor, resource_name: 'comm_whatsapp_phone_contacts_cache', request_summary: { query_length: query.length, page, page_size: pageSize } });
  if (error) console.error('[chatgpt-mcp] falha ao auditar consulta de contatos WhatsApp:', error.message);
  return { success: true, contacts, total: Number(data.total ?? contacts.length), has_more: data.hasMore === true };
}

export async function executeMcpWhatsAppContactWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_WHATSAPP_CONTACT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (Object.keys(args).some((key) => !['phone_number', 'display_name', 'confirm_save', 'confirm_rename'].includes(key))) return fail('INVALID_INPUT', 'A ação contém campos não permitidos.');
  const phone = text(args.phone_number);
  const displayName = text(args.display_name);
  const request = { phone_suffix: phone.replace(/\D/g, '').slice(-4) || undefined, display_name_length: displayName.length };
  let result: McpWriteResult;
  const confirmationName = toolName === 'kifer_save_whatsapp_contact' ? 'confirm_save' : 'confirm_rename';
  if (!/^\+?[0-9 ()-]{10,32}$/.test(phone) || phone.replace(/\D/g, '').length < 10 || !displayName || displayName.length > 160) result = fail('INVALID_INPUT', 'phone_number e display_name válidos são obrigatórios.');
  else if (args[confirmationName] !== true) result = fail('CONFIRMATION_REQUIRED', `${confirmationName}=true é obrigatório.`);
  else {
    const action = toolName === 'kifer_save_whatsapp_contact' ? 'saveContact' : 'renameContact';
    const data = await invoke(supabase, { action, phoneNumber: phone, displayName }, actor);
    const contact = isRecord(data?.contact) ? data.contact : null;
    result = contact ? { success: true, contact: { phone_number: text(contact.phone_number), display_name: text(contact.display_name), saved: contact.saved === true, updated_at: text(contact.updated_at) || null } } : fail('CONTACT_UPDATE_FAILED', 'Não foi possível confirmar a alteração do contato. Verifique o catálogo antes de repetir.');
  }
  await auditWrite(supabase, actor, toolName, result, request);
  return result;
}
