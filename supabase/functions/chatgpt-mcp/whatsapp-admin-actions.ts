import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });
const READ_NAMES = ['kifer_get_whatsapp_integration_status'] as const;
const WRITE_NAMES = ['kifer_set_whatsapp_integration_enabled', 'kifer_refresh_whatsapp_connection_health'] as const;
const confirmation = { type: 'boolean', const: true, description: 'Confirma explicitamente a alteração ou consulta externa.' } as const;

export const MCP_WHATSAPP_ADMIN_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_get_whatsapp_integration_status', description: 'Consulta estado seguro do canal WhatsApp, diagnóstico do webhook e se a credencial de servidor está configurada. Nunca retorna tokens, segredos ou URL de webhook.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_set_whatsapp_integration_enabled', description: 'Ativa ou desativa o canal principal do WhatsApp. A alteração afeta envios e automações reais. Leia o estado primeiro e envie os dois updated_at atuais com confirm_change=true.', inputSchema: { type: 'object', required: ['enabled', 'expected_channel_updated_at', 'expected_settings_updated_at', 'confirm_change'], additionalProperties: false, properties: { enabled: { type: 'boolean' }, expected_channel_updated_at: { type: 'string', format: 'date-time' }, expected_settings_updated_at: { type: 'string', format: 'date-time' }, confirm_change: confirmation } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_refresh_whatsapp_connection_health', description: 'Consulta saúde e limites atuais do provedor Whapi e atualiza o snapshot do canal. Faz chamadas externas ao provedor; requer confirm_refresh=true. Não envia mensagens.', inputSchema: { type: 'object', required: ['confirm_refresh'], additionalProperties: false, properties: { confirm_refresh: confirmation } }, annotations: { readOnlyHint: false, openWorldHint: true } },
] as const;

export const MCP_WHATSAPP_ADMIN_READ_TOOL_NAMES = READ_NAMES;
export const MCP_WHATSAPP_ADMIN_WRITE_TOOL_NAMES = WRITE_NAMES;

const audit = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, result: McpWriteResult, request: Record<string, unknown>) => {
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
  if (error) console.error('[chatgpt-mcp] falha ao auditar configuração WhatsApp:', error.message);
};

export async function executeMcpWhatsAppAdminReadAction(params: { supabase: SupabaseClient; toolName: string; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, actor } = params;
  if (!READ_NAMES.includes(toolName as (typeof READ_NAMES)[number])) return null;
  const { data, error } = await supabase.functions.invoke('comm-whatsapp-admin', {
    body: { action: 'getConfig' },
    headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId },
  });
  if (error || !isRecord(data)) return fail('INTEGRATION_UNAVAILABLE', 'Não foi possível consultar o estado do WhatsApp.');
  const { data: settings, error: settingsError } = await supabase.from('integration_settings').select('updated_at').eq('slug', 'whatsapp_auto_contact').maybeSingle();
  if (settingsError) return fail('INTEGRATION_UNAVAILABLE', 'Não foi possível consultar a versão da configuração WhatsApp.');
  const channel = isRecord(data.channel) ? data.channel : {};
  const config = isRecord(data.config) ? data.config : {};
  const diagnostics = isRecord(config.webhookDiagnostics) ? config.webhookDiagnostics : {};
  const state = {
    enabled: config.enabled === true,
    token_configured: config.tokenConfigured === true,
    connection_status: text(channel.connection_status) || null,
    health_status: text(channel.health_status) || null,
    phone_number: text(channel.phone_number) || null,
    last_health_check_at: text(channel.last_health_check_at) || null,
    webhook_diagnostics: {
      status: text(diagnostics.status) || null,
      last_webhook_at: text(diagnostics.lastWebhookAt) || null,
      last_message_webhook_at: text(diagnostics.lastMessageWebhookAt) || null,
      last_inbound_message_at: text(diagnostics.lastInboundMessageAt) || null,
    },
    channel_updated_at: text(channel.updated_at) || null,
    settings_updated_at: isRecord(settings) ? text(settings.updated_at) || null : null,
  };
  const { error: auditError } = await supabase.from('chatgpt_mcp_audit_log').insert({
    tool_name: toolName,
    actor: actor.actor,
    resource_name: 'comm_whatsapp_channels',
    request_summary: {},
  });
  if (auditError) console.error('[chatgpt-mcp] falha ao auditar estado WhatsApp:', auditError.message);
  return { success: true, status: state };
}

export async function executeMcpWhatsAppAdminWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!WRITE_NAMES.includes(toolName as (typeof WRITE_NAMES)[number])) return null;
  let result: McpWriteResult;
  const request: Record<string, unknown> = {};
  if (toolName === 'kifer_set_whatsapp_integration_enabled') {
    const expectedChannel = text(args.expected_channel_updated_at);
    const expectedSettings = text(args.expected_settings_updated_at);
    request.enabled = typeof args.enabled === 'boolean' ? args.enabled : undefined;
    if (typeof args.enabled !== 'boolean' || !Number.isFinite(Date.parse(expectedChannel)) || !Number.isFinite(Date.parse(expectedSettings)) || args.confirm_change !== true) result = fail('CONFIRMATION_REQUIRED', 'enabled, as versões atuais e confirm_change=true são obrigatórios.');
    else {
      const { data, error } = await supabase.rpc('mcp_set_whatsapp_integration_enabled', {
        p_actor_user_id: actor.actorId,
        p_expected_channel_updated_at: expectedChannel,
        p_expected_settings_updated_at: expectedSettings,
        p_enabled: args.enabled,
      });
      result = error ? fail(error.code === '40001' ? 'CONFLICT' : 'DATABASE_ERROR', error.code === '40001' ? 'A configuração mudou desde a leitura; consulte novamente.' : 'Não foi possível alterar o estado do WhatsApp.')
        : isRecord(data) && data.success === true ? { success: true, enabled: data.enabled, channel_updated_at: data.channel_updated_at, settings_updated_at: data.settings_updated_at }
          : isRecord(data) && data.success === false ? { success: false, error_code: 'CONFLICT', message: 'A configuração mudou desde a leitura; consulte novamente.' }
            : fail('DATABASE_ERROR', 'Não foi possível confirmar o novo estado do WhatsApp.');
    }
  } else if (args.confirm_refresh !== true) {
    result = fail('CONFIRMATION_REQUIRED', 'confirm_refresh=true é obrigatório.');
  } else {
    const { data, error } = await supabase.functions.invoke('comm-whatsapp-admin', {
      body: { action: 'refreshHealth' },
      headers: { 'X-Kifer-MCP-Actor-Id': actor.actorId },
    });
    if (error || !isRecord(data)) result = fail('HEALTH_CHECK_FAILED', 'Não foi possível consultar a saúde do canal WhatsApp.');
    else {
      const channel = isRecord(data.channel) ? data.channel : {};
      const config = isRecord(data.config) ? data.config : {};
      const diagnostics = isRecord(config.webhookDiagnostics) ? config.webhookDiagnostics : {};
      result = {
        success: true,
        status: {
          connection_status: text(channel.connection_status) || null,
          health_status: text(channel.health_status) || null,
          phone_number: text(channel.phone_number) || null,
          last_health_check_at: text(channel.last_health_check_at) || null,
          webhook_diagnostics: {
            status: text(diagnostics.status) || null,
            last_webhook_at: text(diagnostics.lastWebhookAt) || null,
            last_message_webhook_at: text(diagnostics.lastMessageWebhookAt) || null,
            last_inbound_message_at: text(diagnostics.lastInboundMessageAt) || null,
          },
        },
      };
    }
  }
  await audit(supabase, actor, toolName, result, request);
  return result;
}
