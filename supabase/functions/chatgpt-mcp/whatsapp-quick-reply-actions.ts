import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

type QuickReply = { id: string; name: string; shortcut: string; text: string; created_at: string | null; updated_at: string | null };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });

export const MCP_WHATSAPP_QUICK_REPLY_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_get_whatsapp_quick_replies', description: 'Consulta as respostas rápidas e atalhos configurados na Inbox WhatsApp. OAuth admin obrigatório.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_update_whatsapp_quick_replies', description: 'Substitui a lista ordenada de respostas rápidas usada na Inbox. Envie a lista completa e expected_updated_at da leitura; use null somente para criar a configuração ausente. A auditoria registra IDs e contagem, sem armazenar o texto das mensagens.', inputSchema: { type: 'object', required: ['quick_replies', 'expected_updated_at'], additionalProperties: false, properties: { expected_updated_at: { type: ['string', 'null'], format: 'date-time' }, quick_replies: { type: 'array', maxItems: 100, items: { type: 'object', required: ['name', 'shortcut', 'text'], additionalProperties: false, properties: { id: { type: 'string', maxLength: 120, pattern: '^[A-Za-z0-9:_-]{1,120}$' }, name: { type: 'string', minLength: 1, maxLength: 120 }, shortcut: { type: 'string', maxLength: 120 }, text: { type: 'string', minLength: 1, maxLength: 4000 } } } } } }, annotations: { readOnlyHint: false } },
];

export const MCP_WHATSAPP_QUICK_REPLY_READ_TOOL_NAMES = ['kifer_get_whatsapp_quick_replies'] as const;
export const MCP_WHATSAPP_QUICK_REPLY_WRITE_TOOL_NAMES = ['kifer_update_whatsapp_quick_replies'] as const;
const SLUG = 'whatsapp_quick_replies';
const normalizeShortcut = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const readCurrent = async (supabase: SupabaseClient) => supabase.from('integration_settings').select('id,slug,name,description,settings,updated_at').eq('slug', SLUG).maybeSingle();

const normalizeQuickReplies = (value: unknown, previous: QuickReply[], now: string | null, strict = true): QuickReply[] | null => {
  if (!Array.isArray(value) || value.length > 100) return null;
  const used = new Set<string>();
  const usedIds = new Set<string>();
  const result: QuickReply[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!isRecord(raw)) return null;
    if (strict && Object.keys(raw).some((key) => !['id', 'name', 'shortcut', 'text', 'created_at', 'updated_at'].includes(key))) return null;
    if (raw.id !== undefined && typeof raw.id !== 'string') return null;
    const name = text(raw.name);
    const body = typeof raw.text === 'string' ? raw.text.replace(/\r\n/g, '\n').trim() : '';
    if (!name || name.length > 120 || !body || body.length > 4000 || (raw.shortcut !== undefined && (typeof raw.shortcut !== 'string' || raw.shortcut.length > 120))) return null;
    const id = text(raw.id) || `quick-reply-${normalizeShortcut(name) || `msg-${index + 1}`}-${index + 1}`;
    if (id.length > 120 || !/^[A-Za-z0-9:_-]{1,120}$/.test(id) || usedIds.has(id)) return null;
    usedIds.add(id);
    const baseShortcut = normalizeShortcut(text(raw.shortcut) || name) || `msg-${index + 1}`;
    let shortcut = baseShortcut;
    let suffix = 2;
    while (used.has(shortcut)) { shortcut = `${baseShortcut}-${suffix}`; suffix += 1; }
    used.add(shortcut);
    const prior = previous.find((entry) => entry.id === id);
    result.push({
      id,
      name,
      shortcut,
      text: body,
      created_at: prior?.created_at ?? (text(raw.created_at) || now),
      updated_at: now ?? (text(raw.updated_at) || null),
    });
  }
  return result;
};

export async function executeMcpWhatsAppQuickReplyReadAction(params: { supabase: SupabaseClient; toolName: string; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, actor } = params;
  if (!(MCP_WHATSAPP_QUICK_REPLY_READ_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  const { data, error } = await readCurrent(supabase);
  if (error) return fail('DATABASE_ERROR', 'Não foi possível consultar as respostas rápidas.');
  const settings = isRecord(data?.settings) ? data.settings : {};
  const quickReplies = normalizeQuickReplies(settings.quickReplies ?? settings.quick_replies ?? [], [], null, false) ?? [];
  const { error: auditError } = await supabase.from('chatgpt_mcp_audit_log').insert({ tool_name: toolName, actor: actor.actor, resource_name: 'integration_settings', request_summary: { slug: SLUG, quick_reply_count: quickReplies.length } });
  if (auditError) console.error('[chatgpt-mcp] falha ao auditar leitura de respostas rápidas:', auditError.message);
  return { success: true, quick_replies: quickReplies, updated_at: text(data?.updated_at) || null };
}

export async function executeMcpWhatsAppQuickReplyWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_WHATSAPP_QUICK_REPLY_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (Object.keys(args).some((key) => !['quick_replies', 'expected_updated_at'].includes(key))) return fail('INVALID_INPUT', 'A ação contém campos não permitidos.');
  const expected = args.expected_updated_at;
  if (expected !== null && (typeof expected !== 'string' || !Number.isFinite(Date.parse(expected)))) return fail('INVALID_INPUT', 'expected_updated_at deve ser a versão atual ou null.');
  const current = await readCurrent(supabase);
  if (current.error) return fail('DATABASE_ERROR', 'Não foi possível consultar a configuração atual.');
  if (expected === null && current.data) return fail('CONFLICT', 'A configuração já existe; consulte novamente.');
  if (typeof expected === 'string' && (!isRecord(current.data) || current.data.updated_at !== expected)) return fail('CONFLICT', 'A configuração mudou desde a leitura; consulte novamente.');
  const oldSettings = isRecord(current.data?.settings) ? current.data.settings : {};
  const previous = normalizeQuickReplies(oldSettings.quickReplies ?? oldSettings.quick_replies ?? [], [], text(current.data?.updated_at)) ?? [];
  const now = new Date().toISOString();
  const quickReplies = normalizeQuickReplies(args.quick_replies, previous, now);
  if (!quickReplies) return fail('INVALID_INPUT', 'quick_replies precisa conter até 100 respostas com nome e texto válidos.');
  const settings = { ...oldSettings, quickReplies };
  let result: McpWriteResult;
  if (expected === null) {
    const { data, error } = await supabase.from('integration_settings').insert({ slug: SLUG, name: 'Mensagens rápidas do WhatsApp', description: 'Atalhos das mensagens rápidas usadas no inbox do WhatsApp.', settings }).select('id,updated_at').maybeSingle();
    result = error ? fail(error.code === '23505' ? 'CONFLICT' : 'DATABASE_ERROR', error.code === '23505' ? 'A configuração já existe; consulte novamente.' : 'Não foi possível criar as respostas rápidas.') : data ? { success: true, quick_replies: quickReplies, updated_at: data.updated_at } : fail('DATABASE_ERROR', 'A configuração criada não foi retornada.');
  } else {
    const { data, error } = await supabase.from('integration_settings').update({ settings, updated_at: now }).eq('id', current.data?.id).eq('updated_at', expected).select('id,updated_at').maybeSingle();
    result = error ? fail('DATABASE_ERROR', 'Não foi possível atualizar as respostas rápidas.') : data ? { success: true, quick_replies: quickReplies, updated_at: data.updated_at } : fail('CONFLICT', 'A configuração mudou durante a atualização; consulte novamente.');
  }
  const { error: auditError } = await supabase.from('mcp_action_audit_log').insert({ tool_name: toolName, action_type: 'whatsapp-quick-replies-update', actor: actor.actor, actor_id: actor.actorId, request_payload: { expected_updated_at: expected, quick_reply_count: quickReplies.length, quick_reply_ids: quickReplies.map(({ id }) => id) }, result_payload: { success: result.success, error_code: result.error_code ?? null }, success: result.success, error_message: result.success ? null : text(result.message) || null, source: 'chatgpt_mcp' });
  if (auditError) console.error('[chatgpt-mcp] falha ao auditar atualização de respostas rápidas:', auditError.message);
  return result;
}
