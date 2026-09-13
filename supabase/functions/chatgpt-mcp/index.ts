import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authenticateOAuthAccessToken, getMcpOAuthChallenge, handleOAuthRoute } from './oauth.ts';
import { executeMcpCommercialReadAction, executeMcpWriteAction } from './write-actions.ts';

/**
 * Endpoint MCP remoto para consultas no Kifer Saude.
 *
 * Nao aceita SQL, RPC arbitraria ou escrita generica. As poucas acoes de
 * escrita sao ferramentas comerciais fechadas, auditadas e explicitamente
 * declaradas abaixo.
 */

const MCP_PROTOCOL_VERSION = '2025-03-26';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_TEXT_RESPONSE_LENGTH = 40_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Protocol-Version',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json; charset=utf-8',
  'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION,
  'Cache-Control': 'no-store',
};

// Dados operacionais e historicos. Credenciais, configuracoes de integracao,
// payloads brutos de webhook e artefatos internos ficam deliberadamente fora.
const READABLE_TABLES = [
  'leads',
  'contracts',
  'contract_holders',
  'dependents',
  'interactions',
  'documents',
  'reminders',
  'lead_origens',
  'lead_responsaveis',
  'lead_status_config',
  'lead_status_history',
  'lead_tipos_contratacao',
  'operadoras',
  'produtos_planos',
  'contract_abrangencias',
  'contract_acomodacoes',
  'contract_carencias',
  'contract_modalidades',
  'contract_status_config',
  'contract_value_adjustments',
  'auto_contact_flow_jobs',
  'auto_contact_flow_executions',
  'automation_run_log',
  'comm_follow_up_audit_log',
  'comm_whatsapp_chats',
  'comm_whatsapp_messages',
  'comm_whatsapp_campaigns',
  'comm_whatsapp_campaign_steps',
  'comm_whatsapp_campaign_targets',
  'comm_whatsapp_campaign_events',
  'comm_whatsapp_campaign_templates',
  'comm_whatsapp_campaign_worker_runs',
  'comm_whatsapp_attendance_critiques',
  'comm_whatsapp_ai_intent_suggestions',
  'comm_whatsapp_phone_contacts_cache',
  'comm_whatsapp_identity_conflicts',
  'public_forms',
  'public_form_steps',
  'public_form_submissions',
  'blog_posts',
  'public_link_page_settings',
  'public_link_items',
  'config_options',
  'user_profiles',
] as const;

const READABLE_TABLE_SET = new Set<string>(READABLE_TABLES);
const FILTER_OPERATORS = new Set(['eq', 'neq', 'ilike', 'like', 'gt', 'gte', 'lt', 'lte', 'is', 'in']);
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const SENSITIVE_KEY = /(?:^|_)(?:access_?token|api_?key|secret|password|credential|authorization|bearer|webhook_?secret|service_?role|private_?key|refresh_?token)(?:$|_)/i;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type RecordFilter = {
  field?: unknown;
  operator?: unknown;
  value?: unknown;
};

const errorResponse = (id: JsonRpcRequest['id'], code: number, message: string, data?: unknown) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }), {
    status: 200,
    headers: jsonHeaders,
  });

const resultResponse = (id: JsonRpcRequest['id'], result: unknown) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result }), { status: 200, headers: jsonHeaders });

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const positiveInt = (value: unknown, fallback: number, maximum: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(parsed)));
};

const isSafeIdentifier = (value: string): boolean => SAFE_IDENTIFIER.test(value);

const getBearerToken = (request: Request): string => {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const equalTokens = (received: string, expected: string): boolean => {
  if (!received || !expected || received.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < received.length; index += 1) {
    result |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return result === 0;
};

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize(child),
    ]),
  );
};

const toToolResult = (value: unknown) => {
  let output = JSON.stringify(sanitize(value), null, 2);
  if (output.length > MAX_TEXT_RESPONSE_LENGTH) {
    output = `${output.slice(0, MAX_TEXT_RESPONSE_LENGTH)}\n\n[Resposta truncada. Use page/page_size ou filtros mais especificos.]`;
  }
  return { content: [{ type: 'text', text: output }] };
};

const getSupabaseAdmin = (): SupabaseClient => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuracao Supabase ausente.');
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
};

const assertReadableTable = (value: unknown): string => {
  const table = text(value);
  if (!READABLE_TABLE_SET.has(table)) {
    throw new Error('Recurso nao permitido para consulta. Use kifer_list_resources para ver os recursos disponiveis.');
  }
  return table;
};

async function writeAuditLog(params: {
  supabase: SupabaseClient;
  toolName: string;
  actor?: string;
  resourceName?: string | null;
  requestSummary?: Record<string, unknown>;
}) {
  const actor = params.actor || text(Deno.env.get('KIFER_MCP_ACTOR')) || 'chatgpt-mcp-admin';
  const { error } = await params.supabase.from('chatgpt_mcp_audit_log').insert({
    actor,
    tool_name: params.toolName,
    resource_name: params.resourceName || null,
    request_summary: params.requestSummary || {},
  });
  if (error) console.error('[chatgpt-mcp] falha ao registrar auditoria:', error.message);
}

async function listRecords(supabase: SupabaseClient, params: Record<string, unknown>) {
  const table = assertReadableTable(params.table);
  const page = positiveInt(params.page, 1, 10_000);
  const pageSize = positiveInt(params.page_size, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const orderBy = text(params.order_by) || 'created_at';
  const ascending = params.ascending === true;

  if (!isSafeIdentifier(orderBy)) throw new Error('Campo de ordenacao invalido.');

  let query: any = supabase.from(table).select('*', { count: 'exact' });
  const filters = Array.isArray(params.filters) ? (params.filters as RecordFilter[]).slice(0, 12) : [];

  for (const filter of filters) {
    const field = text(filter.field);
    const operator = text(filter.operator) || 'eq';
    if (!isSafeIdentifier(field) || !FILTER_OPERATORS.has(operator)) {
      throw new Error('Filtro invalido. Campos e operadores sao estritamente validados.');
    }

    if (operator === 'in') {
      const values = Array.isArray(filter.value) ? filter.value.map(String).slice(0, 100) : [];
      if (values.length === 0) throw new Error('O operador in requer uma lista de valores.');
      query = query.in(field, values);
    } else if (operator === 'is') {
      const value = filter.value === null || filter.value === 'null' ? null : Boolean(filter.value);
      query = query.is(field, value);
    } else {
      query = query[operator](field, filter.value);
    }
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order(orderBy, { ascending, nullsFirst: false }).range(from, from + pageSize - 1);
  if (error) throw new Error(`Falha ao consultar ${table}: ${error.message}`);

  return {
    table,
    page,
    page_size: pageSize,
    total: count ?? null,
    has_more: count === null ? data.length === pageSize : from + data.length < count,
    records: data,
  };
}

async function getRecord(supabase: SupabaseClient, params: Record<string, unknown>) {
  const table = assertReadableTable(params.table);
  const id = text(params.id);
  if (!id) throw new Error('Informe o id do registro.');
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Falha ao consultar ${table}: ${error.message}`);
  return { table, record: data };
}

async function searchOperationalData(supabase: SupabaseClient, params: Record<string, unknown>) {
  const query = text(params.query);
  if (query.length < 2) throw new Error('A busca deve ter pelo menos 2 caracteres.');
  const limit = positiveInt(params.limit, 20, 50);
  const pattern = `%${query.replace(/[%_]/g, '\\$&')}%`;

  const [leadByName, leadByPhone, leadByEmail, chatsByName, chatsByPhone] = await Promise.all([
    supabase.from('leads').select('id,nome_completo,telefone,email,status,cidade,responsavel,updated_at').ilike('nome_completo', pattern).limit(limit),
    supabase.from('leads').select('id,nome_completo,telefone,email,status,cidade,responsavel,updated_at').ilike('telefone', pattern).limit(limit),
    supabase.from('leads').select('id,nome_completo,telefone,email,status,cidade,responsavel,updated_at').ilike('email', pattern).limit(limit),
    supabase.from('comm_whatsapp_chats').select('id,lead_id,display_name,phone_number,last_message_text,last_message_at,unread_count,status').ilike('display_name', pattern).limit(limit),
    supabase.from('comm_whatsapp_chats').select('id,lead_id,display_name,phone_number,last_message_text,last_message_at,unread_count,status').ilike('phone_number', pattern).limit(limit),
  ]);

  const firstError = [leadByName, leadByPhone, leadByEmail, chatsByName, chatsByPhone].find((result) => result.error)?.error;
  if (firstError) throw new Error(`Falha na busca: ${firstError.message}`);

  const uniqueById = <T extends { id: string }>(rows: T[]) => Array.from(new Map(rows.map((row) => [row.id, row])).values());
  return {
    query,
    leads: uniqueById([...(leadByName.data || []), ...(leadByPhone.data || []), ...(leadByEmail.data || [])]).slice(0, limit),
    whatsapp_chats: uniqueById([...(chatsByName.data || []), ...(chatsByPhone.data || [])]).slice(0, limit),
  };
}

async function getLead360(supabase: SupabaseClient, params: Record<string, unknown>) {
  const leadId = text(params.lead_id);
  if (!leadId) throw new Error('Informe lead_id.');

  const [lead, contracts, interactions, reminders, chats, statusHistory, jobs] = await Promise.all([
    supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
    supabase.from('contracts').select('*').eq('lead_id', leadId).order('updated_at', { ascending: false }).limit(20),
    supabase.from('interactions').select('*').eq('lead_id', leadId).order('data_interacao', { ascending: false }).limit(30),
    supabase.from('reminders').select('*').eq('lead_id', leadId).order('data_lembrete', { ascending: true }).limit(30),
    supabase.from('comm_whatsapp_chats').select('*').eq('lead_id', leadId).order('last_message_at', { ascending: false }).limit(10),
    supabase.from('lead_status_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(30),
    supabase.from('auto_contact_flow_jobs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20),
  ]);

  const firstError = [lead, contracts, interactions, reminders, chats, statusHistory, jobs].find((result) => result.error)?.error;
  if (firstError) throw new Error(`Falha ao carregar contexto do lead: ${firstError.message}`);
  return {
    lead: lead.data,
    contracts: contracts.data || [],
    interactions: interactions.data || [],
    reminders: reminders.data || [],
    whatsapp_chats: chats.data || [],
    status_history: statusHistory.data || [],
    automation_jobs: jobs.data || [],
  };
}

async function getChatTranscript(supabase: SupabaseClient, params: Record<string, unknown>) {
  const chatId = text(params.chat_id);
  if (!chatId) throw new Error('Informe chat_id.');
  const page = positiveInt(params.page, 1, 10_000);
  const pageSize = positiveInt(params.page_size, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;

  const [chat, messages] = await Promise.all([
    supabase.from('comm_whatsapp_chats').select('*').eq('id', chatId).maybeSingle(),
    supabase
      .from('comm_whatsapp_messages')
      .select('*', { count: 'exact' })
      .eq('chat_id', chatId)
      .order('message_at', { ascending: true })
      .range(from, from + pageSize - 1),
  ]);
  if (chat.error || messages.error) throw new Error(`Falha ao carregar conversa: ${chat.error?.message || messages.error?.message}`);
  return {
    chat: chat.data,
    page,
    page_size: pageSize,
    total_messages: messages.count ?? null,
    messages: messages.data || [],
  };
}

async function getOperationalOverview(supabase: SupabaseClient) {
  const [leads, contracts, chats, unreadChats, pendingJobs, failedRuns, latestRuns] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).gt('unread_count', 0).is('deleted_at', null),
    supabase.from('auto_contact_flow_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('automation_run_log').select('*', { count: 'exact', head: true }).neq('status', 'ok'),
    supabase.from('automation_run_log').select('*').order('run_at', { ascending: false }).limit(10),
  ]);
  const firstError = [leads, contracts, chats, unreadChats, pendingJobs, failedRuns, latestRuns].find((result) => result.error)?.error;
  if (firstError) throw new Error(`Falha ao carregar resumo: ${firstError.message}`);
  return {
    counts: {
      leads: leads.count ?? 0,
      contracts: contracts.count ?? 0,
      whatsapp_chats: chats.count ?? 0,
      chats_with_unread: unreadChats.count ?? 0,
      pending_automation_jobs: pendingJobs.count ?? 0,
      non_ok_automation_runs: failedRuns.count ?? 0,
    },
    latest_automation_runs: latestRuns.data || [],
  };
}

const commercialTools = [
  { name: 'kifer_list_automation_jobs', description: 'Lista jobs de automação com filtros fechados, paginação e ordenação segura. É somente leitura.', inputSchema: { type: 'object', additionalProperties: false, properties: { status: { type: 'string' }, tipo: { type: 'string' }, lead_id: { type: 'string' }, flow_id: { type: 'string' }, data_inicial: { type: 'string', format: 'date-time' }, data_final: { type: 'string', format: 'date-time' }, erro: { type: 'boolean' }, page: { type: 'integer', minimum: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 50 }, order_by: { type: 'string', enum: ['scheduled_at', 'created_at', 'updated_at', 'attempts'] }, ascending: { type: 'boolean' } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_get_automation_job', description: 'Consulta um job de automação específico pelo id. É somente leitura.', inputSchema: { type: 'object', required: ['job_id'], additionalProperties: false, properties: { job_id: { type: 'string' } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_cancel_automation_job', description: 'Cancela um job de automação pendente, sem excluir histórico. Use somente mediante pedido explícito; altera dados reais.', inputSchema: { type: 'object', required: ['job_id'], additionalProperties: false, properties: { job_id: { type: 'string' }, observacao: { type: 'string', maxLength: 4000 } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_retry_automation_job', description: 'Reagenda um job falho ou ignorado. Nunca use para job concluído, pois isso pode duplicar uma ação externa. Altera dados reais.', inputSchema: { type: 'object', required: ['job_id'], additionalProperties: false, properties: { job_id: { type: 'string' }, scheduled_at: { type: 'string', format: 'date-time' } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_get_automation_settings', description: 'Consulta as configurações operacionais permitidas do motor de automação. Não retorna segredos nem credenciais.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_update_automation_settings', description: 'Altera configurações operacionais explicitamente permitidas da automação. Use somente mediante pedido explícito; altera dados reais.', inputSchema: { type: 'object', required: ['settings'], additionalProperties: false, properties: { settings: { type: 'object', minProperties: 1, additionalProperties: false, properties: { enabled: { type: 'boolean' }, auto_send: { type: 'boolean' }, timezone: { type: 'string' }, start_hour: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, end_hour: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, allowed_weekdays: { type: 'array', minItems: 1, maxItems: 7, items: { type: 'integer', minimum: 0, maximum: 6 } }, daily_send_limit: { type: ['integer', 'null'], minimum: 1, maximum: 1000 }, refresh_seconds: { type: 'integer', minimum: 5, maximum: 3600 } } } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_list_followup_flows', description: 'Lista os fluxos de follow-up configurados, sem expor templates, URLs ou credenciais internas. É somente leitura.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_get_followup_flow', description: 'Consulta detalhes operacionais de um fluxo de follow-up existente. É somente leitura.', inputSchema: { type: 'object', required: ['flow_id'], additionalProperties: false, properties: { flow_id: { type: 'string', minLength: 1, maxLength: 160 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_update_followup_flow', description: 'Altera somente limites, horários, status de gatilho e delays de etapas já existentes. Use somente mediante pedido explícito; altera dados reais.', inputSchema: { type: 'object', required: ['flow_id', 'changes'], additionalProperties: false, properties: { flow_id: { type: 'string' }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: { ativo: { type: 'boolean' }, daily_send_limit: { type: ['integer', 'null'], minimum: 1, maximum: 1000 }, start_hour: { type: 'string' }, end_hour: { type: 'string' }, allowed_weekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }, trigger_statuses: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 160 } }, enabled_step_ids: { type: 'array', items: { type: 'string' } }, step_delays: { type: 'array', items: { type: 'object', required: ['step_id', 'delay_value', 'delay_unit'], additionalProperties: false, properties: { step_id: { type: 'string' }, delay_value: { type: 'integer', minimum: 0, maximum: 3650 }, delay_unit: { type: 'string', enum: ['seconds', 'minutes', 'hours', 'days'] } } } } } } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_pause_followup_flow', description: 'Pausa um fluxo de follow-up existente. Use somente quando o usuário pedir explicitamente; altera dados reais.', inputSchema: { type: 'object', required: ['flow_id'], additionalProperties: false, properties: { flow_id: { type: 'string' } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_resume_followup_flow', description: 'Retoma um fluxo de follow-up existente. Use somente quando o usuário pedir explicitamente; altera dados reais.', inputSchema: { type: 'object', required: ['flow_id'], additionalProperties: false, properties: { flow_id: { type: 'string' } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_enqueue_lead_followup', description: 'Insere um lead em um fluxo de follow-up existente, uma vez por fluxo ativo. Use somente quando o usuário pedir explicitamente; altera dados reais.', inputSchema: { type: 'object', required: ['lead_id', 'flow_id'], additionalProperties: false, properties: { lead_id: { type: 'string' }, flow_id: { type: 'string' }, scheduled_at: { type: 'string', format: 'date-time' }, observacao: { type: 'string', maxLength: 4000 } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_remove_lead_from_followup', description: 'Cancela jobs futuros pendentes de um lead em um fluxo específico. Use somente quando o usuário pedir explicitamente; altera dados reais.', inputSchema: { type: 'object', required: ['lead_id', 'flow_id'], additionalProperties: false, properties: { lead_id: { type: 'string' }, flow_id: { type: 'string' }, observacao: { type: 'string', maxLength: 4000 } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_update_lead', description: 'Atualiza apenas dados comerciais permitidos de um lead. Use somente quando o usuário solicitar explicitamente; altera dados reais.', inputSchema: { type: 'object', required: ['lead_id', 'changes'], additionalProperties: false, properties: { lead_id: { type: 'string' }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: { nome_completo: { type: 'string', maxLength: 160 }, email: { type: 'string', maxLength: 160 }, telefone: { type: 'string', maxLength: 32 }, cidade: { type: 'string', maxLength: 160 }, cep: { type: 'string', maxLength: 16 }, endereco: { type: 'string', maxLength: 160 }, estado: { type: 'string', minLength: 2, maxLength: 2 }, regiao: { type: 'string', maxLength: 160 }, canal: { type: 'string', maxLength: 160 }, operadora_atual: { type: 'string', maxLength: 160 }, observacoes: { type: 'string', maxLength: 4000 }, origem_id: { type: 'string' }, responsavel_id: { type: 'string' } } } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_list_lead_statuses', description: 'Lista os status comerciais ativos e válidos para uso em atualizações de status. É somente leitura.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_list_reminders', description: 'Lista lembretes por lead, estado, período e prioridade. É somente leitura.', inputSchema: { type: 'object', additionalProperties: false, properties: { lead_id: { type: 'string' }, status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] }, data_inicial: { type: 'string', format: 'date-time' }, data_final: { type: 'string', format: 'date-time' }, prioridade: { type: 'string', enum: ['baixa', 'normal', 'alta'] }, page: { type: 'integer', minimum: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 50 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_update_reminder', description: 'Atualiza título, descrição, data ou prioridade de um lembrete. Use somente mediante pedido explícito; altera dados reais.', inputSchema: { type: 'object', required: ['reminder_id', 'changes'], additionalProperties: false, properties: { reminder_id: { type: 'string' }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: { titulo: { type: 'string', minLength: 1, maxLength: 160 }, descricao: { type: 'string', maxLength: 4000 }, data_lembrete: { type: 'string', format: 'date-time' }, prioridade: { type: 'string', enum: ['baixa', 'normal', 'alta'] } } } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_complete_reminder', description: 'Marca um lembrete como concluído. Use somente mediante pedido explícito; altera dados reais.', inputSchema: { type: 'object', required: ['reminder_id'], additionalProperties: false, properties: { reminder_id: { type: 'string' } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_cancel_reminder', description: 'Cancela um lembrete sem exclusão física. Use somente mediante pedido explícito; altera dados reais.', inputSchema: { type: 'object', required: ['reminder_id'], additionalProperties: false, properties: { reminder_id: { type: 'string' }, observacao: { type: 'string', maxLength: 4000 } } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'kifer_get_next_follow_up', description: 'Consulta o próximo lembrete de follow-up/retorno ainda pendente de um lead. É somente leitura.', inputSchema: { type: 'object', required: ['lead_id'], additionalProperties: false, properties: { lead_id: { type: 'string' } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
];

const tools = [
  ...commercialTools,
  {
    name: 'kifer_list_resources',
    description: 'Lista todas as tabelas operacionais que podem ser consultadas. Nunca inclui segredos, credenciais, payloads brutos de webhooks ou tabelas de autenticacao.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_list_records',
    description: 'Lista registros de uma tabela operacional permitida, com filtros seguros, ordenacao e paginacao. Nao aceita SQL, RPCs nem tabelas fora da lista.',
    inputSchema: {
      type: 'object',
      required: ['table'],
      properties: {
        table: { type: 'string', description: 'Tabela retornada por kifer_list_resources.' },
        page: { type: 'integer', minimum: 1, default: 1 },
        page_size: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
        order_by: { type: 'string', default: 'created_at' },
        ascending: { type: 'boolean', default: false },
        filters: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            required: ['field', 'operator', 'value'],
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'neq', 'ilike', 'like', 'gt', 'gte', 'lt', 'lte', 'is', 'in'] },
              value: {},
            },
          },
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_record',
    description: 'Retorna um registro pelo id em uma tabela operacional permitida.',
    inputSchema: {
      type: 'object',
      required: ['table', 'id'],
      properties: { table: { type: 'string' }, id: { type: 'string' } },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_search',
    description: 'Busca leads e conversas de WhatsApp por nome, telefone ou e-mail. Use antes de solicitar o contexto completo de um lead ou a transcricao de uma conversa.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', minLength: 2 }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_lead_360',
    description: 'Retorna o contexto completo de um lead: dados, contratos, interacoes, lembretes, chats, historico de status e jobs de automacao.',
    inputSchema: { type: 'object', required: ['lead_id'], properties: { lead_id: { type: 'string' } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_whatsapp_transcript',
    description: 'Retorna uma conversa de WhatsApp e suas mensagens, em ordem cronologica e com paginacao.',
    inputSchema: {
      type: 'object',
      required: ['chat_id'],
      properties: {
        chat_id: { type: 'string' },
        page: { type: 'integer', minimum: 1, default: 1 },
        page_size: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_operational_overview',
    description: 'Retorna os principais contadores operacionais e as ultimas execucoes de automacao.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_send_whatsapp_message',
    description: 'Envia uma mensagem de WhatsApp para uma conversa existente do CRM Kifer Saúde. Use somente quando o usuário solicitar explicitamente o envio. Esta ação tem efeito externo real e aceita apenas chat_id existente.',
    inputSchema: { type: 'object', required: ['chat_id', 'message', 'client_request_id'], additionalProperties: false, properties: { chat_id: { type: 'string' }, message: { type: 'string', minLength: 1, maxLength: 4096 }, client_request_id: { type: 'string', minLength: 1, maxLength: 128, description: 'Identificador estável para impedir duplicidade em tentativas repetidas.' } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_create_reminder',
    description: 'Cria um lembrete associado a um lead existente. Use quando o usuário pedir para lembrar, agendar retorno ou registrar uma próxima ação. Esta ação altera dados reais.',
    inputSchema: { type: 'object', required: ['lead_id', 'tipo', 'titulo', 'data_lembrete', 'prioridade'], additionalProperties: false, properties: { lead_id: { type: 'string' }, contract_id: { type: 'string' }, tipo: { type: 'string', minLength: 1, maxLength: 160 }, titulo: { type: 'string', minLength: 1, maxLength: 160 }, descricao: { type: 'string', maxLength: 4000 }, data_lembrete: { type: 'string', format: 'date-time' }, prioridade: { type: 'string', enum: ['baixa', 'normal', 'alta'] } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_update_lead_status',
    description: 'Atualiza o status comercial de um lead existente para um status ativo configurado no CRM. Use somente quando o usuário pedir explicitamente uma alteração de status. Esta ação altera dados reais.',
    inputSchema: { type: 'object', required: ['lead_id', 'status'], additionalProperties: false, properties: { lead_id: { type: 'string' }, status: { type: 'string', minLength: 1, maxLength: 160 }, observacao: { type: 'string', maxLength: 4000 } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_create_interaction',
    description: 'Registra uma interação ou observação no histórico comercial de um lead. Use somente quando o usuário pedir para registrar a informação. Esta ação altera dados reais.',
    inputSchema: { type: 'object', required: ['lead_id', 'tipo', 'descricao'], additionalProperties: false, properties: { lead_id: { type: 'string' }, contract_id: { type: 'string' }, tipo: { type: 'string', minLength: 1, maxLength: 160 }, descricao: { type: 'string', minLength: 1, maxLength: 4000 }, responsavel: { type: 'string', maxLength: 160 } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_set_next_follow_up',
    description: 'Agenda o próximo retorno de um lead criando um lembrete, que é a fonte de verdade de próximos retornos do CRM. Use somente quando o usuário pedir explicitamente para agendar retorno. Esta ação altera dados reais.',
    inputSchema: { type: 'object', required: ['lead_id', 'proximo_retorno'], additionalProperties: false, properties: { lead_id: { type: 'string' }, proximo_retorno: { type: 'string', format: 'date-time' }, observacao: { type: 'string', maxLength: 4000 } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
];

async function callTool(supabase: SupabaseClient, name: string, rawArguments: unknown, actor: string, actorId: string | null) {
  const args = rawArguments && typeof rawArguments === 'object' && !Array.isArray(rawArguments) ? (rawArguments as Record<string, unknown>) : {};
  const writeAction = new Set([
    'kifer_send_whatsapp_message', 'kifer_create_reminder', 'kifer_update_lead_status', 'kifer_create_interaction', 'kifer_set_next_follow_up',
    'kifer_update_automation_settings', 'kifer_update_followup_flow', 'kifer_pause_followup_flow', 'kifer_resume_followup_flow',
    'kifer_enqueue_lead_followup', 'kifer_remove_lead_from_followup', 'kifer_update_lead', 'kifer_update_reminder',
    'kifer_complete_reminder', 'kifer_cancel_reminder', 'kifer_cancel_automation_job', 'kifer_retry_automation_job',
  ]);
  if (writeAction.has(name)) {
    if (!actorId) return toToolResult({ success: false, error_code: 'UNAUTHORIZED', message: 'Ações de escrita exigem uma conexão OAuth de administrador.' });
    const result = await executeMcpWriteAction({ supabase, toolName: name, arguments: args, actor: { actor, actorId } });
    return toToolResult(result);
  }
  const commercialReadResult = await executeMcpCommercialReadAction({ supabase, toolName: name, arguments: args });
  if (commercialReadResult) return toToolResult(commercialReadResult);
  let output: unknown;
  let resourceName: string | null = null;

  switch (name) {
    case 'kifer_list_resources':
      output = { resources: READABLE_TABLES, read_only: true, excluded: ['secrets', 'system_configurations', 'integration_settings', 'raw webhook archives', 'authentication/session tables'] };
      break;
    case 'kifer_list_records':
      resourceName = assertReadableTable(args.table);
      output = await listRecords(supabase, args);
      break;
    case 'kifer_get_record':
      resourceName = assertReadableTable(args.table);
      output = await getRecord(supabase, args);
      break;
    case 'kifer_search':
      output = await searchOperationalData(supabase, args);
      break;
    case 'kifer_get_lead_360':
      resourceName = 'leads';
      output = await getLead360(supabase, args);
      break;
    case 'kifer_get_whatsapp_transcript':
      resourceName = 'comm_whatsapp_messages';
      output = await getChatTranscript(supabase, args);
      break;
    case 'kifer_get_operational_overview':
      output = await getOperationalOverview(supabase);
      break;
    default:
      throw new Error('Ferramenta MCP desconhecida.');
  }

  await writeAuditLog({
    supabase,
    toolName: name,
    actor,
    resourceName,
    requestSummary: { argument_keys: Object.keys(args).sort(), filter_count: Array.isArray(args.filters) ? args.filters.length : 0 },
  });
  return toToolResult(output);
}

Deno.serve(async (request: Request) => {
  const oauthResponse = await handleOAuthRoute(request);
  if (oauthResponse) return oauthResponse;
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response('Metodo nao permitido', { status: 405, headers: { ...jsonHeaders, Allow: 'POST, OPTIONS' } });

  const configuredToken = Deno.env.get('KIFER_MCP_ACCESS_TOKEN') || '';
  const legacyAuthenticated = Boolean(configuredToken) && equalTokens(getBearerToken(request), configuredToken);
  let actor = text(Deno.env.get('KIFER_MCP_ACTOR')) || 'chatgpt-mcp-admin';
  let actorId: string | null = null;
  if (!legacyAuthenticated) {
    try {
      const oauthPrincipal = await authenticateOAuthAccessToken(request);
      if (oauthPrincipal) {
        actor = oauthPrincipal.actor;
        actorId = oauthPrincipal.userId;
      }
      else {
        return new Response('Nao autenticado.', {
          status: 401,
          headers: { ...jsonHeaders, 'WWW-Authenticate': getMcpOAuthChallenge(request) },
        });
      }
    } catch (error) {
      console.error('[chatgpt-mcp] falha ao validar OAuth:', error instanceof Error ? error.message : error);
      return new Response('Servico MCP indisponivel.', { status: 503, headers: jsonHeaders });
    }
  }
  let rpc: JsonRpcRequest;
  try {
    rpc = (await request.json()) as JsonRpcRequest;
  } catch {
    return errorResponse(null, -32700, 'JSON invalido.');
  }
  if (rpc.jsonrpc !== '2.0' || !rpc.method) return errorResponse(rpc.id, -32600, 'Requisicao JSON-RPC invalida.');

  if (rpc.method === 'notifications/initialized') return new Response(null, { status: 202, headers: jsonHeaders });
  if (rpc.method === 'ping') return resultResponse(rpc.id, {});
  if (rpc.method === 'initialize') {
    return resultResponse(rpc.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'kifer-saude-crm', version: '1.1.0' },
      instructions: 'Servidor do Kifer Saude orientado a leitura, com poucas ações comerciais de escrita explicitamente declaradas. Nunca use nem sugira SQL, RPC ou requisições arbitrárias. Ferramentas de escrita alteram dados reais e só devem ser chamadas após solicitação explícita do usuário.',
    });
  }
  if (rpc.method === 'tools/list') return resultResponse(rpc.id, { tools });
  if (rpc.method !== 'tools/call') return errorResponse(rpc.id, -32601, 'Metodo MCP nao suportado.');

  const toolName = text(rpc.params?.name);
  try {
    const supabase = getSupabaseAdmin();
    const toolResult = await callTool(supabase, toolName, rpc.params?.arguments, actor, actorId);
    return resultResponse(rpc.id, toolResult);
  } catch (error) {
    console.error('[chatgpt-mcp] erro em tools/call', { toolName, error: error instanceof Error ? error.message : error });
    return resultResponse(rpc.id, {
      content: [{ type: 'text', text: error instanceof Error ? error.message : 'Erro interno ao executar a consulta.' }],
      isError: true,
    });
  }
});
