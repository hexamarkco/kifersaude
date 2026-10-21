import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const GLOBAL_KEYS = ['global_instructions', 'global_style'] as const;
const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const RETIRED_FEATURE_KEYS = ['sandbox.chat'] as const;
const AI_ROUTE_KEYS = ['rewrite_message', 'follow_up_generation', 'follow_up_agenda_organization', 'whatsapp_audio_transcription', 'attendance_critique', 'autonomous_attendance'] as const;
const AI_ROUTE_PROPERTIES = Object.fromEntries(AI_ROUTE_KEYS.map((key) => [key, {
  type: 'object', required: ['provider', 'model'], additionalProperties: false,
  properties: { provider: { type: 'string', enum: ['openai'] }, model: { type: 'string', minLength: 1, maxLength: 255 } },
}]));
const FEATURE_FIELDS = 'id,key,name,description,category,enabled,task_type,available_variables,default_feature_prompt,default_output_instructions,default_temperature,default_max_output_tokens';
const CONFIG_FIELDS = 'id,feature_id,version,is_active,provider,model,model_override_enabled,reasoning_effort,temperature,max_output_tokens,feature_prompt,output_instructions,created_by,created_at,activated_at,deactivated_at';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asRows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(isRecord) : [];
const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });

const featureIdSchema = { type: 'string', format: 'uuid' } as const;
const configPayloadProperties = {
  feature_prompt: { type: 'string', minLength: 1, maxLength: 100000 },
  output_instructions: { type: 'string', maxLength: 50000 },
  temperature: { type: 'number', minimum: 0, maximum: 1 },
  max_output_tokens: { type: 'integer', minimum: 100, maximum: 8000 },
  model_override_enabled: { type: 'boolean' },
  provider: { type: ['string', 'null'], enum: ['openai', null] },
  model: { type: ['string', 'null'], maxLength: 255 },
  reasoning_effort: { type: ['string', 'null'], enum: [...REASONING_EFFORTS, null] },
} as const;

export const MCP_AI_CONFIG_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_list_ai_features', description: 'Lista configurações das funcionalidades de IA, incluindo versão ativa e mais recente. Prompts são conteúdo operacional e retornados apenas para administradores.', inputSchema: { type: 'object', additionalProperties: false, properties: { include_disabled: { type: 'boolean', default: true } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_get_ai_feature_history', description: 'Lista até 100 versões de uma funcionalidade de IA, incluindo prompts e estado de ativação.', inputSchema: { type: 'object', required: ['feature_id'], additionalProperties: false, properties: { feature_id: featureIdSchema, limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_list_ai_global_configs', description: 'Lê somente as duas instruções globais editáveis pela tela de IA: global_instructions e global_style.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_list_ai_model_catalog', description: 'Lista catálogo e preços ativos de modelos de IA. A resposta não consulta credenciais ou configurações de integração.', inputSchema: { type: 'object', additionalProperties: false, properties: { page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, include_inactive: { type: 'boolean', default: false } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_get_ai_routing_settings', description: 'Lê os modelos OpenAI escolhidos por tarefa. Retorna somente tarefas e campos allowlisted mais updated_at; configurações de integração não são expostas.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_get_ai_provider_status', description: 'Consulta somente se o provider OpenAI está habilitado; não revela chaves, tokens ou outras configurações.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_export_ai_configuration', description: 'Gera um snapshot JSON v3 compatível com o importador da tela de IA, com prompts ativos, configurações globais e catálogo. Roteamento bruto de integration_settings é omitido.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_save_ai_feature_config', description: 'Cria e ativa uma nova versão de prompt/parâmetros de IA. Informe expected_latest_version retornado na leitura; um override de modelo é validado contra capacidade e estado do catálogo.', inputSchema: { type: 'object', required: ['feature_id', 'expected_latest_version', 'feature_prompt', 'output_instructions', 'temperature', 'max_output_tokens', 'model_override_enabled'], additionalProperties: false, properties: { feature_id: featureIdSchema, expected_latest_version: { type: 'integer', minimum: 0 }, ...configPayloadProperties } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_set_ai_feature_config_active', description: 'Ativa uma versão existente ou desativa a versão ativa. Ao ativar, desativa as demais versões da mesma funcionalidade.', inputSchema: { type: 'object', required: ['config_id', 'active'], additionalProperties: false, properties: { config_id: featureIdSchema, active: { type: 'boolean' } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_delete_ai_feature_config', description: 'Exclui uma versão inativa do histórico de configuração de IA. A versão ativa deve ser desativada antes.', inputSchema: { type: 'object', required: ['config_id'], additionalProperties: false, properties: { config_id: featureIdSchema } }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'kifer_update_ai_global_config', description: 'Atualiza uma instrução global permitida com controle de versão. O texto altera o comportamento de todas as funcionalidades que usam essa instrução.', inputSchema: { type: 'object', required: ['key', 'value', 'expected_updated_at'], additionalProperties: false, properties: { key: { type: 'string', enum: [...GLOBAL_KEYS] }, value: { type: 'string', maxLength: 100000 }, expected_updated_at: { type: ['string', 'null'], format: 'date-time', description: 'updated_at da leitura, ou null se a chave ainda não existir.' } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_update_ai_routing_settings', description: 'Atualiza apenas rotas tarefa-modelo allowlisted com controle de versão. Preserva campos de integration_settings sem expô-los na resposta ou auditoria.', inputSchema: { type: 'object', required: ['expected_updated_at', 'changes'], additionalProperties: false, properties: { expected_updated_at: { type: 'string', format: 'date-time' }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: AI_ROUTE_PROPERTIES } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_set_ai_provider_enabled', description: 'Ativa ou desativa o provider OpenAI sem expor ou substituir credenciais. A ativação pode permitir novas chamadas de IA e custos do provider.', inputSchema: { type: 'object', required: ['enabled', 'expected_updated_at'], additionalProperties: false, properties: { enabled: { type: 'boolean' }, expected_updated_at: { type: 'string', format: 'date-time' } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_import_ai_configuration', description: 'Importa até 50 configurações de funcionalidades e as duas instruções globais de um snapshot v3. Todos os itens são validados antes de gravar; o resultado informa itens aplicados ou falhas parciais.', inputSchema: { type: 'object', required: ['configuration'], additionalProperties: false, properties: { configuration: { type: 'object', required: ['version', 'format', 'features', 'global_configs'], additionalProperties: true, properties: { version: { type: 'integer', const: 3 }, format: { type: 'string', const: 'kifer-saude-ai-config' }, features: { type: 'array', maxItems: 50, items: { type: 'object', required: ['key', 'active_config'], additionalProperties: true, properties: { key: { type: 'string', minLength: 1, maxLength: 120 }, active_config: { type: ['object', 'null'], additionalProperties: true } } } }, global_configs: { type: 'array', maxItems: 2, items: { type: 'object', required: ['key', 'value'], additionalProperties: false, properties: { key: { type: 'string', enum: [...GLOBAL_KEYS] }, value: { type: 'string', maxLength: 100000 } } } } } } } }, annotations: { readOnlyHint: false } },
] as const;

export const MCP_AI_CONFIG_READ_TOOL_NAMES = MCP_AI_CONFIG_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name);
export const MCP_AI_CONFIG_WRITE_TOOL_NAMES = MCP_AI_CONFIG_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === false).map((tool) => tool.name);

const paginate = (args: Record<string, unknown>, maxSize = 100) => {
  const page = Number(args.page ?? 1);
  const pageSize = Number(args.page_size ?? 50);
  return Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= maxSize
    ? { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 } : null;
};

async function loadFeatureSnapshot(supabase: SupabaseClient, includeDisabled: boolean) {
  let featureQuery = supabase.from('ai_features').select(FEATURE_FIELDS).not('key', 'in', `(${RETIRED_FEATURE_KEYS.join(',')})`).order('category').order('name');
  if (!includeDisabled) featureQuery = featureQuery.eq('enabled', true);
  const [{ data: featureData, error: featureError }, { data: configData, error: configError }] = await Promise.all([
    featureQuery,
    supabase.from('ai_feature_configs').select(CONFIG_FIELDS).order('version', { ascending: false }),
  ]);
  if (featureError || configError) return { error: true as const };
  const configs = asRows(configData);
  const features = asRows(featureData).map((feature) => {
    const matching = configs.filter((config) => config.feature_id === feature.id);
    return {
      ...feature,
      active_config: matching.find((config) => config.is_active === true) ?? null,
      latest_config: matching[0] ?? null,
      config_count: matching.length,
    };
  });
  return { error: false as const, features, configs };
}

const globalConfigRead = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase.from('ai_global_configs').select('id,key,value,description,updated_by,updated_at').in('key', [...GLOBAL_KEYS]).order('key');
  return error ? null : asRows(data);
};

const safeRouteProjection = (settingsValue: unknown) => {
  const settings = isRecord(settingsValue) ? settingsValue : {};
  const routesValue = settings.tasks;
  const routes = isRecord(routesValue) ? routesValue : {};
  return Object.fromEntries(AI_ROUTE_KEYS.flatMap((key) => {
    const route = routes[key];
    if (!isRecord(route) || route.provider !== 'openai' || typeof route.model !== 'string' || !route.model.trim()) return [];
    return [[key, { provider: 'openai', model: route.model.trim() }]];
  }));
};

const auditWrite = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, result: McpWriteResult, summary: Record<string, unknown>) => {
  const { error } = await supabase.from('mcp_action_audit_log').insert({
    tool_name: toolName,
    action_type: toolName.replace(/^kifer_/, '').replaceAll('_', '-'),
    actor: actor.actor,
    actor_id: actor.actorId,
    request_payload: summary,
    result_payload: { success: result.success, error_code: result.error_code ?? null },
    success: result.success,
    error_message: result.success ? null : text(result.message) || null,
    source: 'chatgpt_mcp',
  });
  if (error) console.error('[chatgpt-mcp] falha ao auditar configuração de IA:', error.message);
};

export async function executeMcpAiConfigReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown> }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args } = params;
  if (toolName === 'kifer_list_ai_features') {
    const snapshot = await loadFeatureSnapshot(supabase, args.include_disabled !== false);
    return snapshot.error ? fail('DATABASE_ERROR', 'Não foi possível consultar as funcionalidades de IA.') : { success: true, features: snapshot.features };
  }
  if (toolName === 'kifer_get_ai_feature_history') {
    const featureId = text(args.feature_id);
    const limit = Number(args.limit ?? 50);
    if (!UUID.test(featureId) || !Number.isInteger(limit) || limit < 1 || limit > 100) return fail('INVALID_INPUT', 'feature_id ou limit inválido.');
    const { data, error } = await supabase.from('ai_feature_configs').select(CONFIG_FIELDS).eq('feature_id', featureId).order('version', { ascending: false }).limit(limit);
    return error ? fail('DATABASE_ERROR', 'Não foi possível consultar o histórico.') : { success: true, configs: data ?? [] };
  }
  if (toolName === 'kifer_list_ai_global_configs') {
    const configs = await globalConfigRead(supabase);
    return configs === null ? fail('DATABASE_ERROR', 'Não foi possível consultar as instruções globais.') : { success: true, configs };
  }
  if (toolName === 'kifer_list_ai_model_catalog') {
    const bounds = paginate(args);
    if (!bounds) return fail('INVALID_INPUT', 'Paginação inválida.');
    let modelQuery = supabase.from('ai_models').select('id,provider,model,display_name,capabilities,active,deprecated_at,created_at,updated_at', { count: 'exact' }).order('provider').order('display_name').range(bounds.from, bounds.to);
    if (args.include_inactive !== true) modelQuery = modelQuery.eq('active', true);
    const { data, error, count } = await modelQuery;
    if (error) return fail('DATABASE_ERROR', 'Não foi possível consultar o catálogo de modelos.');
    const models = asRows(data);
    const modelKeys = models.map((model) => `${text(model.provider)}:${text(model.model)}`);
    const { data: pricingData, error: pricingError } = await supabase.from('ai_model_pricing').select('provider,model,input_per_million,cached_input_per_million,output_per_million,is_transcription,transcription_per_minute,active,effective_from,effective_to').eq('active', true).order('effective_from', { ascending: false }).limit(500);
    if (pricingError) return fail('DATABASE_ERROR', 'Não foi possível consultar os preços de modelos.');
    const now = Date.now();
    const pricing = asRows(pricingData).filter((row) => modelKeys.includes(`${text(row.provider)}:${text(row.model)}`) && Date.parse(text(row.effective_from)) <= now && (!row.effective_to || Date.parse(text(row.effective_to)) > now));
    return { success: true, models, active_pricing: pricing, page: bounds.page, page_size: bounds.pageSize, total: count ?? 0 };
  }
  if (toolName === 'kifer_get_ai_routing_settings' || toolName === 'kifer_get_ai_provider_status') {
    const slug = toolName === 'kifer_get_ai_routing_settings' ? 'ai_routing' : 'ai_provider_openai';
    const { data, error } = await supabase.from('integration_settings').select('settings,updated_at').eq('slug', slug).maybeSingle();
    if (error || !data) return fail('NOT_FOUND', 'A configuração permitida do provider não foi encontrada.');
    const settings = isRecord(data.settings) ? data.settings : {};
    return toolName === 'kifer_get_ai_routing_settings'
      ? { success: true, updated_at: data.updated_at, tasks: safeRouteProjection(settings) }
      : { success: true, updated_at: data.updated_at, enabled: settings.enabled === true };
  }
  if (toolName === 'kifer_export_ai_configuration') {
    const snapshot = await loadFeatureSnapshot(supabase, false);
    const globals = await globalConfigRead(supabase);
    const { data: models, error: modelError } = await supabase.from('ai_models').select('provider,model,display_name,capabilities,active,deprecated_at').order('provider').order('display_name');
    if (snapshot.error || globals === null || modelError) return fail('DATABASE_ERROR', 'Não foi possível gerar o snapshot de IA.');
    const features = snapshot.features.map((feature) => {
      const active = isRecord(feature.active_config) ? feature.active_config : null;
      const overrideEnabled = active?.model_override_enabled === true;
      const provider = overrideEnabled ? active?.provider ?? null : null;
      const model = overrideEnabled ? active?.model ?? null : null;
      return {
        key: text(feature.key),
        name: text(feature.name),
        active_config: active ? {
          feature_prompt: active.feature_prompt ?? '',
          output_instructions: active.output_instructions ?? '',
          temperature: active.temperature ?? 0.4,
          max_output_tokens: active.max_output_tokens ?? 500,
          reasoning_effort: active.reasoning_effort ?? null,
          model_config: {
            mode: overrideEnabled ? 'custom' : 'default',
            model_override_enabled: overrideEnabled,
            provider,
            model,
            effective_provider: provider,
            effective_model: model,
            resolution_source: overrideEnabled ? 'feature' : null,
          },
        } : null,
      };
    });
    return { success: true, configuration: {
      format: 'kifer-saude-ai-config', version: 3, exported_at: new Date().toISOString(),
      documentation: { description: 'Snapshot MCP das configurações editáveis de IA.', import_behavior: ['Somente funcionalidades e instruções globais são importáveis.', 'Catálogo de modelos é apenas informativo.'], field_notes: {} },
      features,
      global_configs: globals.map((row) => ({ key: row.key, value: row.value ?? '' })),
      model_catalog_snapshot: { generated_at: new Date().toISOString(), providers: { openai: asRows(models).filter((row) => row.provider === 'openai').map((row) => ({ model: row.model, display_name: row.display_name, capabilities: row.capabilities ?? [], active: row.active, deprecated: row.deprecated_at !== null, pricing_available: false, reasoning_efforts: [] })) } },
      routing_snapshot: {}, configuration_examples: [],
    } };
  }
  return null;
}

type AiConfigPayload = {
  feature_prompt: string;
  output_instructions: string;
  temperature: number;
  max_output_tokens: number;
  model_override_enabled: boolean;
  provider?: string | null;
  model?: string | null;
  reasoning_effort?: string | null;
};

const parseConfigPayload = (value: unknown): AiConfigPayload | null => {
  if (!isRecord(value)) return null;
  const { feature_prompt, output_instructions, temperature, max_output_tokens, model_override_enabled } = value;
  const provider = value.provider;
  const model = value.model;
  const reasoningEffort = value.reasoning_effort;
  if (typeof feature_prompt !== 'string' || !feature_prompt.trim() || feature_prompt.length > 100_000) return null;
  if (typeof output_instructions !== 'string' || output_instructions.length > 50_000) return null;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 1) return null;
  if (!Number.isInteger(max_output_tokens) || Number(max_output_tokens) < 100 || Number(max_output_tokens) > 8000) return null;
  if (typeof model_override_enabled !== 'boolean') return null;
  if (provider !== undefined && provider !== null && provider !== 'openai') return null;
  if (model !== undefined && model !== null && (typeof model !== 'string' || model.length > 255)) return null;
  if (reasoningEffort !== undefined && reasoningEffort !== null && !REASONING_EFFORTS.includes(reasoningEffort as (typeof REASONING_EFFORTS)[number])) return null;
  return {
    feature_prompt, output_instructions, temperature, max_output_tokens: Number(max_output_tokens), model_override_enabled,
    provider: typeof provider === 'string' ? provider : null,
    model: typeof model === 'string' ? model.trim() : null,
    reasoning_effort: typeof reasoningEffort === 'string' ? reasoningEffort : null,
  };
};

async function validateFeatureConfig(supabase: SupabaseClient, featureId: string, payload: AiConfigPayload) {
  const { data: feature, error } = await supabase.from('ai_features').select('id,key,task_type,enabled').eq('id', featureId).maybeSingle();
  if (error || !feature || feature.key === 'sandbox.chat' || feature.enabled === false) return { error: fail('FEATURE_NOT_AVAILABLE', 'Funcionalidade de IA não disponível para configuração.') };
  if (payload.model_override_enabled) {
    if (payload.provider !== 'openai' || !payload.model) return { error: fail('INVALID_INPUT', 'Override requer provider OpenAI e model.')} ;
    const { data: model, error: modelError } = await supabase.from('ai_models').select('capabilities,active,deprecated_at').eq('provider', 'openai').eq('model', payload.model).maybeSingle();
    if (modelError || !model || model.active !== true || model.deprecated_at) return { error: fail('INVALID_MODEL', 'Modelo não encontrado, desativado ou descontinuado.') };
    const capabilities = Array.isArray(model.capabilities) ? model.capabilities : [];
    const required = feature.task_type === 'transcription' ? ['transcription'] : feature.task_type === 'structured_output' ? ['text', 'structured_output'] : ['text'];
    if (required.some((capability) => !capabilities.includes(capability))) return { error: fail('INVALID_MODEL', 'Modelo incompatível com a funcionalidade.') };
    if (payload.reasoning_effort && payload.reasoning_effort !== 'none' && !capabilities.includes('reasoning')) return { error: fail('INVALID_MODEL', 'O modelo não aceita esforço de raciocínio.') };
  }
  return { feature };
}

async function saveFeatureConfig(supabase: SupabaseClient, actor: McpWriteActor, featureId: string, expectedVersion: number, payload: AiConfigPayload, toolName = 'kifer_save_ai_feature_config') {
  const validation = await validateFeatureConfig(supabase, featureId, payload);
  if ('error' in validation) return validation.error;
  const { data, error } = await supabase.rpc('mcp_mutate_ai_configuration' as never, {
    p_actor_user_id: actor.actorId,
    p_action: 'save_feature_config',
    p_payload: { feature_id: featureId, expected_latest_version: expectedVersion, ...payload },
  } as never);
  if (error) {
    const errorCode = error.code === '40001' ? 'CONFLICT' : error.code === '42501' ? 'UNAUTHORIZED' : error.code === '22023' ? 'INVALID_INPUT' : 'DATABASE_ERROR';
    const message = errorCode === 'CONFLICT' ? 'A configuração mudou desde a última leitura. Consulte as funcionalidades novamente.' : errorCode === 'UNAUTHORIZED' ? 'Apenas um administrador ativo pode alterar configurações de IA.' : 'Não foi possível criar a nova versão.';
    return fail(errorCode, message);
  }
  const config = isRecord(data) && isRecord(data.config) ? data.config : data;
  const latestVersion = isRecord(config) && typeof config.version === 'number' ? config.version : expectedVersion + 1;
  const result: McpWriteResult = { success: true, config };
  await auditWrite(supabase, actor, toolName, result, { feature_id: featureId, version: latestVersion, changed_fields: Object.keys(payload).filter((key) => key !== 'feature_prompt' && key !== 'output_instructions').sort(), prompt_length: payload.feature_prompt.length, output_instructions_length: payload.output_instructions.length });
  return result;
}

async function updateGlobalConfig(supabase: SupabaseClient, actor: McpWriteActor, key: string, value: string, expectedUpdatedAt: string | null, toolName = 'kifer_update_ai_global_config') {
  if (!(GLOBAL_KEYS as readonly string[]).includes(key) || value.length > 100_000 || (expectedUpdatedAt !== null && !Number.isFinite(Date.parse(expectedUpdatedAt)))) return fail('INVALID_INPUT', 'Chave, valor ou versão da configuração global inválidos.');
  const { data, error } = await supabase.rpc('mcp_mutate_ai_configuration' as never, {
    p_actor_user_id: actor.actorId,
    p_action: 'update_global_config',
    p_payload: { key, value, expected_updated_at: expectedUpdatedAt },
  } as never);
  const config = isRecord(data) && isRecord(data.config) ? data.config : data;
  const errorCode = error?.code === '40001' ? 'CONFLICT' : error?.code === '42501' ? 'UNAUTHORIZED' : error?.code === '22023' ? 'INVALID_INPUT' : 'DATABASE_ERROR';
  const result: McpWriteResult = error ? fail(errorCode, errorCode === 'CONFLICT' ? 'A instrução global mudou desde a última leitura.' : 'Não foi possível atualizar a instrução global.') : { success: true, config };
  await auditWrite(supabase, actor, toolName, result, { key, value_length: value.length });
  return result;
}

async function readIntegrationSetting(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase.from('integration_settings').select('settings,updated_at').eq('slug', slug).maybeSingle();
  return error || !data ? null : data;
}

async function updateAiRouting(supabase: SupabaseClient, actor: McpWriteActor, args: Record<string, unknown>) {
  const expected = text(args.expected_updated_at);
  const changes = args.changes;
  if (!Number.isFinite(Date.parse(expected)) || !isRecord(changes) || Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !(AI_ROUTE_KEYS as readonly string[]).includes(key))) return fail('INVALID_INPUT', 'expected_updated_at ou changes inválidos.');
  const normalized: Record<string, { provider: 'openai'; model: string }> = {};
  for (const [key, route] of Object.entries(changes)) {
    if (!isRecord(route) || route.provider !== 'openai' || typeof route.model !== 'string' || !route.model.trim() || route.model.length > 255 || Object.keys(route).some((field) => !['provider', 'model'].includes(field))) return fail('INVALID_INPUT', `Rota ${key} inválida.`);
    normalized[key] = { provider: 'openai', model: route.model.trim() };
  }
  const modelNames = [...new Set(Object.values(normalized).map((route) => route.model))];
  const { data: modelRows, error: modelError } = await supabase.from('ai_models').select('model,capabilities,active,deprecated_at').eq('provider', 'openai').in('model', modelNames);
  if (modelError) return fail('DATABASE_ERROR', 'Não foi possível validar os modelos de roteamento.');
  const models = new Map(asRows(modelRows).map((model) => [text(model.model), model]));
  for (const [key, route] of Object.entries(normalized)) {
    const model = models.get(route.model);
    const capabilities = Array.isArray(model?.capabilities) ? model.capabilities : [];
    const required = (AI_TRANSCRIPTION_ROUTE_KEYS as readonly string[]).includes(key) ? ['transcription'] : ['text'];
    if (!model || model.active !== true || model.deprecated_at || required.some((capability) => !capabilities.includes(capability))) return fail('INVALID_MODEL', `O modelo escolhido para ${key} não está ativo ou não é compatível.`);
  }
  const current = await readIntegrationSetting(supabase, 'ai_routing');
  if (!current) return fail('NOT_FOUND', 'Configuração de roteamento de IA não encontrada.');
  if (current.updated_at !== expected) return fail('CONFLICT', 'As rotas de IA mudaram desde a última leitura. Consulte-as novamente.');
  const currentSettings = isRecord(current.settings) ? current.settings : {};
  const currentTasks = isRecord(currentSettings.tasks) ? currentSettings.tasks : {};
  const nextSettings = { ...currentSettings, tasks: { ...currentTasks, ...normalized } };
  const { data, error } = await supabase.from('integration_settings').update({ settings: nextSettings, updated_at: new Date().toISOString() } as never).eq('slug', 'ai_routing').eq('updated_at', expected).select('updated_at').maybeSingle();
  const result: McpWriteResult = error ? fail('DATABASE_ERROR', 'Não foi possível atualizar o roteamento de IA.') : data ? { success: true, updated_at: data.updated_at, tasks: safeRouteProjection(nextSettings) } : fail('CONFLICT', 'As rotas de IA mudaram durante a atualização.');
  await auditWrite(supabase, actor, 'kifer_update_ai_routing_settings', result, { changed_tasks: Object.keys(normalized).sort(), models: Object.fromEntries(Object.entries(normalized).map(([key, route]) => [key, route.model])) });
  return result;
}

async function setAiProviderEnabled(supabase: SupabaseClient, actor: McpWriteActor, args: Record<string, unknown>) {
  const expected = text(args.expected_updated_at);
  if (typeof args.enabled !== 'boolean' || !Number.isFinite(Date.parse(expected))) return fail('INVALID_INPUT', 'enabled ou expected_updated_at inválido.');
  const current = await readIntegrationSetting(supabase, 'ai_provider_openai');
  if (!current) return fail('NOT_FOUND', 'Configuração do provider OpenAI não encontrada.');
  if (current.updated_at !== expected) return fail('CONFLICT', 'O estado do provider mudou desde a última leitura.');
  const currentSettings = isRecord(current.settings) ? current.settings : {};
  const nextSettings = { ...currentSettings, enabled: args.enabled };
  const { data, error } = await supabase.from('integration_settings').update({ settings: nextSettings, updated_at: new Date().toISOString() } as never).eq('slug', 'ai_provider_openai').eq('updated_at', expected).select('updated_at').maybeSingle();
  const result: McpWriteResult = error ? fail('DATABASE_ERROR', 'Não foi possível atualizar o provider OpenAI.') : data ? { success: true, updated_at: data.updated_at, enabled: args.enabled } : fail('CONFLICT', 'O estado do provider mudou durante a atualização.');
  await auditWrite(supabase, actor, 'kifer_set_ai_provider_enabled', result, { enabled: args.enabled });
  return result;
}

export async function executeMcpAiConfigWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (toolName === 'kifer_save_ai_feature_config') {
    const featureId = text(args.feature_id);
    const expectedVersion = Number(args.expected_latest_version);
    const payload = parseConfigPayload(args);
    if (!UUID.test(featureId) || !Number.isInteger(expectedVersion) || expectedVersion < 0 || !payload) return fail('INVALID_INPUT', 'feature_id, versão ou conteúdo da configuração inválido.');
    return saveFeatureConfig(supabase, actor, featureId, expectedVersion, payload);
  }
  if (toolName === 'kifer_set_ai_feature_config_active') {
    const configId = text(args.config_id);
    if (!UUID.test(configId) || typeof args.active !== 'boolean') return fail('INVALID_INPUT', 'config_id ou active inválido.');
    const { data, error } = await supabase.rpc('mcp_mutate_ai_configuration' as never, {
      p_actor_user_id: actor.actorId,
      p_action: 'set_feature_config_active',
      p_payload: { config_id: configId, active: args.active },
    } as never);
    const config = isRecord(data) && isRecord(data.config) ? data.config : data;
    const errorCode = error?.code === '40001' ? 'CONFLICT' : error?.code === '42501' ? 'UNAUTHORIZED' : error?.code === 'P0002' ? 'NOT_FOUND' : 'DATABASE_ERROR';
    const result: McpWriteResult = error ? fail(errorCode, errorCode === 'NOT_FOUND' ? 'Versão de configuração ou funcionalidade não encontrada.' : 'Não foi possível alterar a ativação da versão.') : { success: true, config };
    await auditWrite(supabase, actor, toolName, result, { config_id: configId, active: args.active });
    return result;
  }
  if (toolName === 'kifer_delete_ai_feature_config') {
    const configId = text(args.config_id);
    if (!UUID.test(configId)) return fail('INVALID_INPUT', 'config_id inválido.');
    const { data, error } = await supabase.from('ai_feature_configs').delete().eq('id', configId).eq('is_active', false).select('id,feature_id,version').maybeSingle();
    const result: McpWriteResult = error ? fail('DATABASE_ERROR', 'Não foi possível excluir a versão.') : data ? { success: true, deleted_config_id: data.id } : fail('NOT_FOUND_OR_ACTIVE', 'Versão inativa não encontrada; desative a versão antes de excluir.');
    await auditWrite(supabase, actor, toolName, result, { config_id: configId });
    return result;
  }
  if (toolName === 'kifer_update_ai_global_config') {
    if (typeof args.value !== 'string' || (args.expected_updated_at !== null && typeof args.expected_updated_at !== 'string')) return fail('INVALID_INPUT', 'value ou expected_updated_at inválido.');
    return updateGlobalConfig(supabase, actor, text(args.key), args.value, args.expected_updated_at as string | null);
  }
  if (toolName === 'kifer_update_ai_routing_settings') return updateAiRouting(supabase, actor, args);
  if (toolName === 'kifer_set_ai_provider_enabled') return setAiProviderEnabled(supabase, actor, args);
  if (toolName === 'kifer_import_ai_configuration') {
    const configuration = args.configuration;
    if (!isRecord(configuration) || configuration.version !== 3 || configuration.format !== 'kifer-saude-ai-config' || !Array.isArray(configuration.features) || !Array.isArray(configuration.global_configs) || configuration.features.length > 50 || configuration.global_configs.length > 2) return fail('INVALID_INPUT', 'Snapshot v3 inválido ou acima dos limites MCP.');
    const features = configuration.features.filter(isRecord);
    const globals = configuration.global_configs.filter(isRecord);
    if (features.length !== configuration.features.length || globals.length !== configuration.global_configs.length) return fail('INVALID_INPUT', 'Itens do snapshot devem ser objetos.');
    const seen = new Set<string>();
    const prepared: Array<{ featureId: string; payload: AiConfigPayload; expectedVersion: number }> = [];
    let skippedCount = 0;
    for (const item of features) {
      const key = text(item.key);
      if (!key || seen.has(key)) return fail('INVALID_INPUT', 'Chaves de funcionalidades vazias ou duplicadas no snapshot.');
      seen.add(key);
      if (item.active_config === null) {
        skippedCount += 1;
        continue;
      }
      if (!isRecord(item.active_config)) return fail('INVALID_INPUT', 'active_config inválido.');
      const raw = item.active_config;
      const modelConfig = raw.model_config;
      if (!isRecord(modelConfig) || typeof modelConfig.model_override_enabled !== 'boolean') return fail('INVALID_INPUT', 'model_config v3 inválido.');
      if (modelConfig.mode !== (modelConfig.model_override_enabled ? 'custom' : 'default')) return fail('INVALID_INPUT', 'mode e model_override_enabled inconsistentes.');
      const payload = parseConfigPayload({ ...raw, model_override_enabled: modelConfig.model_override_enabled, provider: modelConfig.provider, model: modelConfig.model });
      if (!payload) return fail('INVALID_INPUT', `Configuração inválida para ${key}.`);
      const { data: feature, error } = await supabase.from('ai_features').select('id,key,enabled').eq('key', key).maybeSingle();
      if (error) return fail('DATABASE_ERROR', `Não foi possível validar ${key}.`);
      if (!feature || feature.enabled === false || feature.key === 'sandbox.chat') {
        skippedCount += 1;
        continue;
      }
      const validation = await validateFeatureConfig(supabase, feature.id, payload);
      if ('error' in validation) return validation.error;
      const { data: latest, error: latestError } = await supabase.from('ai_feature_configs').select('version').eq('feature_id', feature.id).order('version', { ascending: false }).limit(1);
      if (latestError) return fail('DATABASE_ERROR', 'Não foi possível validar versões existentes.');
      prepared.push({ featureId: feature.id, payload, expectedVersion: Number(asRows(latest)[0]?.version ?? 0) });
    }
    const preparedGlobals: Array<{ key: string; value: string; expectedUpdatedAt: string | null }> = [];
    const seenGlobals = new Set<string>();
    for (const item of globals) {
      const key = text(item.key);
      if (!(GLOBAL_KEYS as readonly string[]).includes(key) || seenGlobals.has(key) || typeof item.value !== 'string' || item.value.length > 100_000) return fail('INVALID_INPUT', 'Instrução global inválida ou duplicada.');
      seenGlobals.add(key);
      const { data: current, error } = await supabase.from('ai_global_configs').select('updated_at').eq('key', key).maybeSingle();
      if (error) return fail('DATABASE_ERROR', 'Não foi possível validar instruções globais.');
      preparedGlobals.push({ key, value: item.value, expectedUpdatedAt: current?.updated_at ?? null });
    }
    const results: Array<{ key: string; success: boolean; error_code?: string }> = [];
    for (const item of prepared) {
      const result = await saveFeatureConfig(supabase, actor, item.featureId, item.expectedVersion, item.payload, toolName);
      results.push({ key: item.featureId, success: result.success, ...(result.success ? {} : { error_code: text(result.error_code) }) });
    }
    for (const item of preparedGlobals) {
      const result = await updateGlobalConfig(supabase, actor, item.key, item.value, item.expectedUpdatedAt, toolName);
      results.push({ key: item.key, success: result.success, ...(result.success ? {} : { error_code: text(result.error_code) }) });
    }
    const failureCount = results.filter((item) => !item.success).length;
    return { success: failureCount === 0, applied_count: results.length - failureCount, skipped_count: skippedCount, failed_count: failureCount, results };
  }
  return null;
}
