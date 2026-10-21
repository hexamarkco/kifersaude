import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

type TrackingSetting = { id: string; settings: Record<string, unknown>; updated_at: string | null };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });
const confirm = { type: 'boolean', const: true, description: 'Confirma a alteração de rastreamento salva nas configurações do CRM.' };
const expectedVersion = { type: ['string', 'null'], format: 'date-time', description: 'updated_at retornado na leitura; use null apenas se a configuração ainda não existir.' };

export const MCP_TRACKING_CONFIG_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_get_tracking_configuration', description: 'Consulta os IDs guardados pelo painel de rastreamento do Meta Pixel e Google Tag Manager e suas versões. Não retorna credenciais de integração.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_set_meta_pixel_id', description: 'Define ou remove o ID numérico guardado na configuração do Meta Pixel. Use expected_updated_at da leitura e confirm_tracking_change=true.', inputSchema: { type: 'object', required: ['pixel_id', 'expected_updated_at', 'confirm_tracking_change'], additionalProperties: false, properties: { pixel_id: { type: 'string', maxLength: 32, pattern: '^\\d*$' }, expected_updated_at: expectedVersion, confirm_tracking_change: confirm } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_set_google_tag_manager_id', description: 'Define ou remove o ID de container guardado na configuração do Google Tag Manager. Quando usado pelo site, o container pode alterar scripts executados; o MCP aceita só o ID, nunca código. Use expected_updated_at da leitura e confirm_tracking_change=true.', inputSchema: { type: 'object', required: ['gtm_id', 'expected_updated_at', 'confirm_tracking_change'], additionalProperties: false, properties: { gtm_id: { type: 'string', maxLength: 32, pattern: '^(|GTM-[A-Za-z0-9]{4,16})$' }, expected_updated_at: expectedVersion, confirm_tracking_change: confirm } }, annotations: { readOnlyHint: false, openWorldHint: true } },
];

export const MCP_TRACKING_CONFIG_READ_TOOL_NAMES = ['kifer_get_tracking_configuration'] as const;
export const MCP_TRACKING_CONFIG_WRITE_TOOL_NAMES = ['kifer_set_meta_pixel_id', 'kifer_set_google_tag_manager_id'] as const;

const SETTINGS = {
  meta: { slug: 'meta_pixel', key: 'pixelId', name: 'Meta Pixel', description: 'Código do Meta Pixel (Facebook) para rastreamento' },
  gtm: { slug: 'google_tag_manager', key: 'gtmId', name: 'Google Tag Manager', description: 'Código do GTM para rastreamento' },
} as const;

const readSetting = async (supabase: SupabaseClient, slug: string) => supabase.from('integration_settings').select('id,settings,updated_at').eq('slug', slug).maybeSingle();
const settingValue = (data: TrackingSetting | null, key: string) => text(data?.settings?.[key]);

export async function executeMcpTrackingConfigReadAction(params: { supabase: SupabaseClient; toolName: string; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, actor } = params;
  if (!(MCP_TRACKING_CONFIG_READ_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  const [meta, gtm] = await Promise.all([readSetting(supabase, SETTINGS.meta.slug), readSetting(supabase, SETTINGS.gtm.slug)]);
  if (meta.error || gtm.error) return fail('DATABASE_ERROR', 'Não foi possível consultar as configurações de rastreamento.');
  const metaData = meta.data as TrackingSetting | null;
  const gtmData = gtm.data as TrackingSetting | null;
  const { error } = await supabase.from('chatgpt_mcp_audit_log').insert({
    tool_name: toolName,
    actor: actor.actor,
    resource_name: 'integration_settings',
    request_summary: { slugs: [SETTINGS.meta.slug, SETTINGS.gtm.slug], meta_pixel_configured: Boolean(settingValue(metaData, SETTINGS.meta.key)), google_tag_manager_configured: Boolean(settingValue(gtmData, SETTINGS.gtm.key)) },
  });
  if (error) console.error('[chatgpt-mcp] falha ao auditar leitura de rastreamento:', error.message);
  return {
    success: true,
    meta_pixel: { pixel_id: settingValue(metaData, SETTINGS.meta.key), updated_at: metaData?.updated_at ?? null },
    google_tag_manager: { gtm_id: settingValue(gtmData, SETTINGS.gtm.key), updated_at: gtmData?.updated_at ?? null },
  };
}

export async function executeMcpTrackingConfigWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_TRACKING_CONFIG_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  const meta = toolName === 'kifer_set_meta_pixel_id';
  const config = meta ? SETTINGS.meta : SETTINGS.gtm;
  const valueKey = meta ? 'pixel_id' : 'gtm_id';
  if (Object.keys(args).some((key) => ![valueKey, 'expected_updated_at', 'confirm_tracking_change'].includes(key))) return fail('INVALID_INPUT', 'A ação contém campos não permitidos.');
  const rawValue = args[valueKey];
  const value = text(rawValue);
  const expected = args.expected_updated_at;
  if (typeof rawValue !== 'string' || value.length > 32 || (expected !== null && (typeof expected !== 'string' || !Number.isFinite(Date.parse(expected))))) return fail('INVALID_INPUT', 'O identificador ou a versão da configuração é inválido.');
  if (meta ? !/^\d*$/.test(value) : !(value === '' || /^GTM-[A-Za-z0-9]{4,16}$/.test(value))) return fail('INVALID_INPUT', meta ? 'pixel_id deve conter somente números.' : 'gtm_id deve estar vazio ou usar o formato GTM- seguido de 4 a 16 caracteres alfanuméricos.');
  if (args.confirm_tracking_change !== true) return fail('CONFIRMATION_REQUIRED', 'confirm_tracking_change=true é obrigatório.');

  const current = await readSetting(supabase, config.slug);
  if (current.error) return fail('DATABASE_ERROR', 'Não foi possível consultar a configuração atual.');
  const currentData = current.data as TrackingSetting | null;
  if (expected === null && currentData) return fail('CONFLICT', 'A configuração já existe; consulte novamente.');
  if (typeof expected === 'string' && (!currentData || currentData.updated_at !== expected)) return fail('CONFLICT', 'A configuração mudou desde a leitura; consulte novamente.');
  const oldSettings = isRecord(currentData?.settings) ? currentData.settings : {};
  const settings = { ...oldSettings, [config.key]: value };
  const result = expected === null
    ? await supabase.from('integration_settings').insert({ slug: config.slug, name: config.name, description: config.description, settings }).select('id,updated_at').maybeSingle()
    : await supabase.from('integration_settings').update({ settings, updated_at: new Date().toISOString() }).eq('id', currentData?.id).eq('updated_at', expected).select('id,updated_at').maybeSingle();
  const saved = result.error ? null : result.data as { id: string; updated_at: string | null } | null;
  const output: McpWriteResult = result.error
    ? fail(result.error.code === '23505' ? 'CONFLICT' : 'DATABASE_ERROR', result.error.code === '23505' ? 'A configuração já existe; consulte novamente.' : 'Não foi possível atualizar a configuração de rastreamento.')
    : saved
      ? { success: true, [valueKey]: value, configured: Boolean(value), updated_at: saved.updated_at }
      : fail('CONFLICT', 'A configuração mudou durante a atualização; consulte novamente.');
  const { error: auditError } = await supabase.from('mcp_action_audit_log').insert({
    tool_name: toolName,
    action_type: meta ? 'meta-pixel-update' : 'google-tag-manager-update',
    actor: actor.actor,
    actor_id: actor.actorId,
    request_payload: { expected_updated_at: expected, value_length: value.length, configured: Boolean(value) },
    result_payload: { success: output.success, error_code: output.error_code ?? null },
    success: output.success,
    error_message: output.success ? null : text(output.message) || null,
    source: 'chatgpt_mcp',
  });
  if (auditError) console.error('[chatgpt-mcp] falha ao auditar atualização de rastreamento:', auditError.message);
  return output;
}
