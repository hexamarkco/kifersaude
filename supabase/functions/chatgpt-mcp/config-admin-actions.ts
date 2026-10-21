import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

export const CONFIGURATION_CATEGORIES = [
  'lead_origins', 'lead_statuses', 'lead_contract_types', 'lead_responsibles',
  'contract_statuses', 'contract_modalities', 'contract_coverages',
  'contract_accommodations', 'contract_waiting_periods', 'carriers', 'plans',
] as const;
type ConfigurationCategory = (typeof CONFIGURATION_CATEGORIES)[number];

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TABLES: Record<ConfigurationCategory, { table: string; fields: string[]; writableFields: string[] }> = {
  lead_origins: { table: 'lead_origens', fields: ['id', 'nome', 'ativo', 'visivel_para_observadores', 'created_at'], writableFields: ['nome', 'ativo', 'visivel_para_observadores'] },
  lead_statuses: { table: 'lead_status_config', fields: ['id', 'nome', 'cor', 'ordem', 'ativo', 'padrao', 'created_at', 'updated_at'], writableFields: ['nome', 'cor', 'ordem', 'ativo', 'padrao'] },
  lead_contract_types: { table: 'lead_tipos_contratacao', fields: ['id', 'label', 'value', 'description', 'ordem', 'ativo', 'created_at', 'updated_at'], writableFields: ['label', 'value', 'description', 'ordem', 'ativo'] },
  lead_responsibles: { table: 'lead_responsaveis', fields: ['id', 'label', 'value', 'description', 'ordem', 'ativo', 'created_at', 'updated_at'], writableFields: ['label', 'value', 'description', 'ordem', 'ativo'] },
  contract_statuses: { table: 'contract_status_config', fields: ['id', 'label', 'value', 'description', 'ordem', 'ativo', 'created_at', 'updated_at'], writableFields: ['label', 'value', 'description', 'ordem', 'ativo'] },
  contract_modalities: { table: 'contract_modalidades', fields: ['id', 'label', 'value', 'description', 'ordem', 'ativo', 'created_at', 'updated_at'], writableFields: ['label', 'value', 'description', 'ordem', 'ativo'] },
  contract_coverages: { table: 'contract_abrangencias', fields: ['id', 'label', 'value', 'description', 'ordem', 'ativo', 'created_at', 'updated_at'], writableFields: ['label', 'value', 'description', 'ordem', 'ativo'] },
  contract_accommodations: { table: 'contract_acomodacoes', fields: ['id', 'label', 'value', 'description', 'ordem', 'ativo', 'created_at', 'updated_at'], writableFields: ['label', 'value', 'description', 'ordem', 'ativo'] },
  contract_waiting_periods: { table: 'contract_carencias', fields: ['id', 'label', 'value', 'description', 'ordem', 'ativo', 'created_at', 'updated_at'], writableFields: ['label', 'value', 'description', 'ordem', 'ativo'] },
  carriers: { table: 'operadoras', fields: ['id', 'nome', 'comissao_padrao', 'prazo_recebimento_dias', 'bonus_por_vida', 'bonus_padrao', 'ativo', 'observacoes', 'created_at', 'updated_at'], writableFields: ['nome', 'comissao_padrao', 'prazo_recebimento_dias', 'bonus_por_vida', 'bonus_padrao', 'ativo', 'observacoes'] },
  plans: { table: 'produtos_planos', fields: ['id', 'operadora_id', 'nome', 'modalidade', 'abrangencia', 'acomodacao', 'comissao_sugerida', 'bonus_por_vida_valor', 'ativo', 'created_at', 'updated_at'], writableFields: ['operadora_id', 'nome', 'modalidade', 'abrangencia', 'acomodacao', 'comissao_sugerida', 'bonus_por_vida_valor', 'ativo'] },
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string, message: string): McpWriteResult => ({ success: false, error_code: code, message });
const pageBounds = (args: Record<string, unknown>) => {
  const page = Number(args.page ?? 1); const pageSize = Number(args.page_size ?? 50);
  return Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100
    ? { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 } : null;
};

const optionProperties = {
  label: { type: 'string', minLength: 1, maxLength: 160 }, value: { type: 'string', minLength: 1, maxLength: 160 },
  description: { type: ['string', 'null'], maxLength: 1000 }, order: { type: 'integer', minimum: 0, maximum: 10000 },
  active: { type: 'boolean' }, name: { type: 'string', minLength: 1, maxLength: 160 }, color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  is_default: { type: 'boolean' }, visible_to_observers: { type: 'boolean' }, carrier_id: { type: 'string', format: 'uuid' },
  default_commission: { type: 'number', minimum: 0, maximum: 100 }, receipt_days: { type: 'integer', minimum: 0, maximum: 3650 },
  bonus_per_life: { type: 'boolean' }, bonus_default: { type: 'number', minimum: 0, maximum: 1000000 },
  observations: { type: 'string', maxLength: 2000 }, modality: { type: ['string', 'null'], maxLength: 160 },
  coverage: { type: ['string', 'null'], maxLength: 160 }, accommodation: { type: ['string', 'null'], maxLength: 160 },
  suggested_commission: { type: 'number', minimum: 0, maximum: 1000000 }, bonus_per_life_value: { type: 'number', minimum: 0, maximum: 1000000 },
} as const;

const categorySchema = { type: 'string', enum: [...CONFIGURATION_CATEGORIES] } as const;
const versionSchema = { type: 'string', minLength: 1, maxLength: 128, description: 'mcp_version retornada na leitura do catálogo.' } as const;
const idSchema = { type: 'string', format: 'uuid' } as const;

export const MCP_CONFIG_ADMIN_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_get_system_preferences', description: 'Consulta preferências gerais seguras do sistema: nome da empresa, formato de data, fuso horário, notificações e tempo limite da sessão. Não retorna credenciais.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  {
    name: 'kifer_update_system_preferences',
    description: 'Atualiza preferências gerais permitidas com controle de versão. session_timeout_minutes afeta as sessões de todos os usuários.',
    inputSchema: {
      type: 'object', required: ['expected_updated_at', 'changes'], additionalProperties: false,
      properties: {
        expected_updated_at: { type: 'string', format: 'date-time' },
        changes: {
          type: 'object', minProperties: 1, additionalProperties: false,
          properties: {
            company_name: { type: 'string', minLength: 1, maxLength: 160 }, notification_sound_enabled: { type: 'boolean' },
            notification_volume: { type: 'number', minimum: 0, maximum: 1 }, notification_interval_seconds: { type: 'integer', minimum: 10, maximum: 300 },
            session_timeout_minutes: { type: 'integer', minimum: 30, maximum: 1440 }, date_format: { type: 'string', enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
            timezone: { type: 'string', enum: ['America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Rio_Branco', 'UTC'] },
          },
        },
      },
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'kifer_list_configuration_catalog',
    description: 'Lista catálogo comercial permitido com projeções específicas e mcp_version para alterações concorrentes. Não consulta a tabela genérica system_configurations.',
    inputSchema: { type: 'object', required: ['category'], additionalProperties: false, properties: { category: categorySchema, page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 100, default: 50 } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'kifer_create_configuration_option',
    description: 'Adiciona opção a um catálogo comercial allowlist. Os campos aceitos dependem da categoria e são revalidados no servidor.',
    inputSchema: { type: 'object', required: ['category', 'option'], additionalProperties: false, properties: { category: categorySchema, option: { type: 'object', minProperties: 1, additionalProperties: false, properties: optionProperties } } },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'kifer_update_configuration_option',
    description: 'Atualiza uma opção de catálogo usando o mcp_version retornado pela leitura. Não altera metadata interna nem configurações arbitrárias.',
    inputSchema: { type: 'object', required: ['category', 'record_id', 'expected_version', 'changes'], additionalProperties: false, properties: { category: categorySchema, record_id: idSchema, expected_version: versionSchema, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: optionProperties } } },
    annotations: { readOnlyHint: false },
  },
  { name: 'kifer_delete_configuration_option', description: 'Exclui opção de catálogo usando mcp_version. Vínculos existentes podem bloquear a operação; prefira desativar quando houver histórico.', inputSchema: { type: 'object', required: ['category', 'record_id', 'expected_version'], additionalProperties: false, properties: { category: categorySchema, record_id: idSchema, expected_version: versionSchema } }, annotations: { readOnlyHint: false, destructiveHint: true } },
] as const;

export const MCP_CONFIG_ADMIN_READ_TOOL_NAMES = MCP_CONFIG_ADMIN_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name);
export const MCP_CONFIG_ADMIN_WRITE_TOOL_NAMES = MCP_CONFIG_ADMIN_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === false).map((tool) => tool.name);

const catalogFields = (category: ConfigurationCategory) => TABLES[category].fields.join(',');
const versionFields = (category: ConfigurationCategory) => TABLES[category].fields.filter((field) => field !== 'updated_at' && field !== 'created_at');

const versionFor = async (row: Record<string, unknown>, category: ConfigurationCategory) => {
  const shape = Object.fromEntries([...versionFields(category), 'created_at', ...(row.updated_at !== undefined ? ['updated_at'] : [])].map((field) => [field, row[field] ?? null]));
  const bytes = new TextEncoder().encode(JSON.stringify(shape));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const normalizeOption = (category: ConfigurationCategory, option: Record<string, unknown>): Record<string, unknown> | null => {
  const result: Record<string, unknown> = {};
  const assign = (apiKey: string, dbKey: string, convert: (value: unknown) => unknown = (value) => value) => {
    if (option[apiKey] !== undefined) result[dbKey] = convert(option[apiKey]);
  };
  if (category === 'lead_origins') {
    if (Object.keys(option).some((key) => !['name', 'active', 'visible_to_observers'].includes(key))) return null;
    assign('name', 'nome', (value) => text(value)); assign('active', 'ativo'); assign('visible_to_observers', 'visivel_para_observadores');
  } else if (category === 'lead_statuses') {
    if (Object.keys(option).some((key) => !['name', 'color', 'order', 'active', 'is_default'].includes(key))) return null;
    assign('name', 'nome', (value) => text(value)); assign('color', 'cor'); assign('order', 'ordem'); assign('active', 'ativo'); assign('is_default', 'padrao');
  } else if (category === 'carriers') {
    if (Object.keys(option).some((key) => !['name', 'default_commission', 'receipt_days', 'bonus_per_life', 'bonus_default', 'active', 'observations'].includes(key))) return null;
    assign('name', 'nome', (value) => text(value)); assign('default_commission', 'comissao_padrao'); assign('receipt_days', 'prazo_recebimento_dias'); assign('bonus_per_life', 'bonus_por_vida'); assign('bonus_default', 'bonus_padrao'); assign('active', 'ativo'); assign('observations', 'observacoes', (value) => text(value) || null);
  } else if (category === 'plans') {
    if (Object.keys(option).some((key) => !['carrier_id', 'name', 'modality', 'coverage', 'accommodation', 'suggested_commission', 'bonus_per_life_value', 'active'].includes(key))) return null;
    assign('carrier_id', 'operadora_id'); assign('name', 'nome', (value) => text(value)); assign('modality', 'modalidade'); assign('coverage', 'abrangencia'); assign('accommodation', 'acomodacao'); assign('suggested_commission', 'comissao_sugerida'); assign('bonus_per_life_value', 'bonus_por_vida_valor'); assign('active', 'ativo');
  } else {
    if (Object.keys(option).some((key) => !['label', 'value', 'description', 'order', 'active'].includes(key))) return null;
    assign('label', 'label', (value) => text(value)); assign('value', 'value', (value) => text(value)); assign('description', 'description', (value) => text(value) || null); assign('order', 'ordem'); assign('active', 'ativo');
  }
  return result;
};

const validNormalizedOption = (category: ConfigurationCategory, payload: Record<string, unknown>, creation: boolean) => {
  if (Object.keys(payload).length === 0) return false;
  const hasString = (key: string) => typeof payload[key] === 'string' && text(payload[key]).length > 0;
  if (['lead_origins', 'lead_statuses', 'carriers'].includes(category) && ('nome' in payload || creation) && !hasString('nome')) return false;
  if (category === 'plans') {
    if (creation && (!UUID.test(text(payload.operadora_id)) || !hasString('nome'))) return false;
    if (payload.operadora_id !== undefined && !UUID.test(text(payload.operadora_id))) return false;
  }
  if (['lead_contract_types', 'lead_responsibles', 'contract_statuses', 'contract_modalities', 'contract_coverages', 'contract_accommodations', 'contract_waiting_periods'].includes(category)) {
    if (creation && (!hasString('label') || !hasString('value'))) return false;
    if (payload.label !== undefined && !hasString('label')) return false;
    if (payload.value !== undefined && !hasString('value')) return false;
  }
  if (payload.cor !== undefined && (typeof payload.cor !== 'string' || !/^#[0-9a-f]{6}$/i.test(payload.cor))) return false;
  if (payload.ordem !== undefined && (!Number.isInteger(payload.ordem) || Number(payload.ordem) < 0 || Number(payload.ordem) > 10000)) return false;
  if (payload.comissao_padrao !== undefined && (typeof payload.comissao_padrao !== 'number' || payload.comissao_padrao < 0 || payload.comissao_padrao > 100)) return false;
  if (payload.prazo_recebimento_dias !== undefined && (!Number.isInteger(payload.prazo_recebimento_dias) || Number(payload.prazo_recebimento_dias) < 0 || Number(payload.prazo_recebimento_dias) > 3650)) return false;
  for (const key of ['bonus_padrao', 'comissao_sugerida', 'bonus_por_vida_valor']) if (payload[key] !== undefined && (typeof payload[key] !== 'number' || payload[key] < 0 || payload[key] > 1_000_000)) return false;
  for (const key of ['ativo', 'padrao', 'visivel_para_observadores', 'bonus_por_vida']) if (payload[key] !== undefined && typeof payload[key] !== 'boolean') return false;
  return true;
};

const audit = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, result: McpWriteResult, request: Record<string, unknown>) => {
  const { error } = await supabase.from('mcp_action_audit_log').insert({ tool_name: toolName, action_type: toolName.replace(/^kifer_/, '').replaceAll('_', '-'), actor: actor.actor, actor_id: actor.actorId, request_payload: request, result_payload: { success: result.success, error_code: result.error_code ?? null }, success: result.success, error_message: result.success ? null : text(result.message) || null, source: 'chatgpt_mcp' });
  if (error) console.error('[chatgpt-mcp] falha ao auditar configuração do CRM:', error.message);
};

const catalogAction = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, args: Record<string, unknown>): Promise<McpWriteResult | null> => {
  if (!['kifer_list_configuration_catalog', 'kifer_create_configuration_option', 'kifer_update_configuration_option', 'kifer_delete_configuration_option'].includes(toolName)) return null;
  const category = text(args.category) as ConfigurationCategory;
  if (!CONFIGURATION_CATEGORIES.includes(category)) return fail('INVALID_INPUT', 'category não permitida.');
  const config = TABLES[category];
  let result: McpWriteResult;
  if (toolName === 'kifer_list_configuration_catalog') {
    const bounds = pageBounds(args);
    if (!bounds) return fail('INVALID_INPUT', 'Paginação inválida.');
    const { data, error, count } = await supabase.from(config.table).select(catalogFields(category), { count: 'exact' }).order('created_at', { ascending: true }).range(bounds.from, bounds.to);
    if (error) result = fail('DATABASE_ERROR', 'Não foi possível consultar o catálogo.');
    else {
      const records = Array.isArray(data) ? await Promise.all(data.filter(isRecord).map(async (row) => ({ ...row, mcp_version: await versionFor(row, category) }))) : [];
      result = { success: true, category, records, page: bounds.page, page_size: bounds.pageSize, total: count ?? 0 };
    }
  } else if (toolName === 'kifer_create_configuration_option') {
    if (!isRecord(args.option)) result = fail('INVALID_INPUT', 'option deve ser um objeto fechado.');
    else {
      const payload = normalizeOption(category, args.option);
      if (!payload || !validNormalizedOption(category, payload, true)) result = fail('INVALID_INPUT', 'Os campos da opção não correspondem à categoria ou possuem valores inválidos.');
      else {
        const { data, error } = await supabase.from(config.table).insert(payload).select(catalogFields(category)).single();
        if (error || !isRecord(data)) result = fail(error?.code === '23505' ? 'DUPLICATE' : 'DATABASE_ERROR', error?.code === '23505' ? 'A opção já existe.' : 'Não foi possível criar a opção.');
        else result = { success: true, category, record: { ...data, mcp_version: await versionFor(data, category) } };
      }
    }
  } else {
    const id = text(args.record_id);
    const expectedVersion = text(args.expected_version);
    if (!UUID.test(id) || !/^[a-f0-9]{64}$/.test(expectedVersion)) result = fail('INVALID_INPUT', 'record_id ou expected_version inválido.');
    else {
      const { data: current, error: readError } = await supabase.from(config.table).select(catalogFields(category)).eq('id', id).maybeSingle();
      if (readError) result = fail('DATABASE_ERROR', 'Não foi possível consultar a opção.');
      else if (!isRecord(current)) result = fail('NOT_FOUND', 'Opção não encontrada.');
      else if (await versionFor(current, category) !== expectedVersion) result = fail('CONFLICT', 'A opção mudou desde a última leitura. Consulte o catálogo novamente.');
      else if (toolName === 'kifer_delete_configuration_option') {
        let query = supabase.from(config.table).delete().eq('id', id);
        for (const key of versionFields(category)) query = current[key] === null || current[key] === undefined ? query.is(key, null) : query.eq(key, current[key]);
        if (typeof current.updated_at === 'string') query = query.eq('updated_at', current.updated_at);
        const { data, error } = await query.select('id').maybeSingle();
        result = error ? fail(error.code === '23503' ? 'IN_USE' : 'DATABASE_ERROR', error.code === '23503' ? 'A opção está vinculada a registros existentes.' : 'Não foi possível excluir a opção.')
          : data ? { success: true, category, record_id: id, deleted: true } : fail('CONFLICT', 'A opção mudou durante a exclusão.');
      } else if (!isRecord(args.changes)) result = fail('INVALID_INPUT', 'changes deve ser um objeto fechado.');
      else {
        const payload = normalizeOption(category, args.changes);
        if (!payload || !validNormalizedOption(category, payload, false)) result = fail('INVALID_INPUT', 'Os campos de alteração não correspondem à categoria ou possuem valores inválidos.');
        else {
          let query = supabase.from(config.table).update({ ...payload, ...(current.updated_at !== undefined ? { updated_at: new Date().toISOString() } : {}) }).eq('id', id);
          for (const key of versionFields(category)) query = current[key] === null || current[key] === undefined ? query.is(key, null) : query.eq(key, current[key]);
          if (typeof current.updated_at === 'string') query = query.eq('updated_at', current.updated_at);
          const { data, error } = await query.select(catalogFields(category)).maybeSingle();
          result = error ? fail(error.code === '23505' ? 'DUPLICATE' : 'DATABASE_ERROR', error.code === '23505' ? 'A opção já existe.' : 'Não foi possível atualizar a opção.')
            : isRecord(data) ? { success: true, category, record: { ...data, mcp_version: await versionFor(data, category) } } : fail('CONFLICT', 'A opção mudou durante a atualização.');
        }
      }
    }
  }
  if (toolName !== 'kifer_list_configuration_catalog') {
    await audit(supabase, actor, toolName, result, { category, record_id: UUID.test(text(args.record_id)) ? args.record_id : undefined, changed_fields: isRecord(args.changes) ? Object.keys(args.changes).sort() : isRecord(args.option) ? Object.keys(args.option).sort() : undefined });
  }
  return result;
};

const systemPreferencesAction = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, args: Record<string, unknown>): Promise<McpWriteResult | null> => {
  if (!['kifer_get_system_preferences', 'kifer_update_system_preferences'].includes(toolName)) return null;
  if (toolName === 'kifer_get_system_preferences') {
    const { data, error } = await supabase.from('system_settings').select('id,company_name,notification_sound_enabled,notification_volume,notification_interval_seconds,session_timeout_minutes,date_format,timezone,created_at,updated_at').limit(1).maybeSingle();
    return error ? fail('DATABASE_ERROR', 'Não foi possível consultar as preferências.') : { success: true, settings: data };
  }
  const expected = text(args.expected_updated_at);
  const changes = args.changes;
  if (!expected || !Number.isFinite(Date.parse(expected)) || !isRecord(changes) || Object.keys(changes).length === 0) return fail('INVALID_INPUT', 'expected_updated_at e changes são obrigatórios.');
  const allowed = new Set(['company_name', 'notification_sound_enabled', 'notification_volume', 'notification_interval_seconds', 'session_timeout_minutes', 'date_format', 'timezone']);
  if (Object.keys(changes).some((key) => !allowed.has(key))) return fail('NOT_ALLOWED', 'A ferramenta não permite alterar campos internos do sistema.');
  if (changes.company_name !== undefined && (typeof changes.company_name !== 'string' || !text(changes.company_name) || changes.company_name.length > 160)) return fail('INVALID_INPUT', 'company_name inválido.');
  if (changes.notification_sound_enabled !== undefined && typeof changes.notification_sound_enabled !== 'boolean') return fail('INVALID_INPUT', 'notification_sound_enabled deve ser booleano.');
  if (changes.notification_volume !== undefined && (typeof changes.notification_volume !== 'number' || changes.notification_volume < 0 || changes.notification_volume > 1)) return fail('INVALID_INPUT', 'notification_volume deve estar entre 0 e 1.');
  if (changes.notification_interval_seconds !== undefined && (!Number.isInteger(changes.notification_interval_seconds) || Number(changes.notification_interval_seconds) < 10 || Number(changes.notification_interval_seconds) > 300)) return fail('INVALID_INPUT', 'notification_interval_seconds deve estar entre 10 e 300.');
  if (changes.session_timeout_minutes !== undefined && (!Number.isInteger(changes.session_timeout_minutes) || Number(changes.session_timeout_minutes) < 30 || Number(changes.session_timeout_minutes) > 1440)) return fail('INVALID_INPUT', 'session_timeout_minutes deve estar entre 30 e 1440.');
  if (changes.date_format !== undefined && !['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(text(changes.date_format))) return fail('INVALID_INPUT', 'date_format não permitido.');
  if (changes.timezone !== undefined && !['America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Rio_Branco', 'UTC'].includes(text(changes.timezone))) return fail('INVALID_INPUT', 'timezone não permitido.');
  const { data, error } = await supabase.from('system_settings').update({ ...changes, updated_at: new Date().toISOString() }).eq('updated_at', expected).select('id,company_name,notification_sound_enabled,notification_volume,notification_interval_seconds,session_timeout_minutes,date_format,timezone,created_at,updated_at').maybeSingle();
  const result = error ? fail('DATABASE_ERROR', 'Não foi possível atualizar as preferências.') : data ? { success: true, settings: data } : fail('CONFLICT', 'As preferências mudaram desde a última leitura. Consulte-as novamente.');
  await audit(supabase, actor, toolName, result, { changed_fields: Object.keys(changes).sort(), session_timeout_changed: Object.prototype.hasOwnProperty.call(changes, 'session_timeout_minutes') });
  return result;
};

export async function executeMcpConfigAdminReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown> }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args } = params;
  if (toolName === 'kifer_get_system_preferences') return systemPreferencesAction(supabase, { actor: '', actorId: '' }, toolName, args);
  if (toolName === 'kifer_list_configuration_catalog') return catalogAction(supabase, { actor: '', actorId: '' }, toolName, args);
  return null;
}

export async function executeMcpConfigAdminWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  if (params.toolName === 'kifer_update_system_preferences') return systemPreferencesAction(params.supabase, params.actor, params.toolName, params.arguments);
  return catalogAction(params.supabase, params.actor, params.toolName, params.arguments);
}
