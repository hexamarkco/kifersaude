import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const MAX_TEXT = 160;
const MAX_NOTES = 4_000;

export const MCP_LEAD_ADMIN_TOOL_NAMES = [
  'kifer_create_lead',
  'kifer_archive_lead',
  'kifer_unarchive_lead',
  'kifer_set_lead_favorite',
  'kifer_update_lead_administration',
] as const;

type Actor = { actor: string; actorId: string };
type Result = { success: boolean; [key: string]: unknown };
type ActionResult = { actionType: string; result: Result };

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const safeUuid = (value: unknown): boolean => UUID.test(text(value));
const errorResult = (errorCode: string, message: string): Result => ({ success: false, error_code: errorCode, message });

const setLeadBoolean = async (
  supabase: SupabaseClient,
  leadIdValue: unknown,
  field: 'arquivado' | 'favorito',
  value: boolean,
): Promise<Result> => {
  const leadId = text(leadIdValue);
  if (!safeUuid(leadId)) return errorResult('INVALID_INPUT', 'lead_id inválido.');
  const { data: current, error: lookupError } = await supabase.from('leads').select(`id,${field}`).eq('id', leadId).maybeSingle();
  if (lookupError) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar o lead.');
  if (!current) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  if (current[field] === value) return { success: true, lead_id: leadId, [field]: value, unchanged: true };

  const { data, error } = await supabase.from('leads')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select(`id,${field},updated_at`)
    .maybeSingle();
  if (error || !data) return errorResult('INTERNAL_ERROR', 'Não foi possível atualizar o lead.');
  return { success: true, lead_id: leadId, [field]: data[field], updated_at: data.updated_at };
};

const validCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

async function updateLeadAdministration(supabase: SupabaseClient, params: Record<string, unknown>): Promise<Result> {
  const leadId = text(params.lead_id);
  const changes = isRecord(params.changes) ? params.changes : null;
  const allowed = new Set(['reativacao_habilitada', 'skip_automation', 'daily_send_limit', 'blackout_dates']);
  if (!safeUuid(leadId) || !changes || Object.keys(changes).length === 0) {
    return errorResult('INVALID_INPUT', 'Informe lead_id e pelo menos um campo administrativo permitido.');
  }
  if (Object.keys(changes).some((key) => !allowed.has(key))) {
    return errorResult('NOT_ALLOWED', 'changes contém campo fora da lista de administração comercial permitida.');
  }

  const update: Record<string, unknown> = {};
  for (const field of ['reativacao_habilitada', 'skip_automation'] as const) {
    if (field in changes) {
      if (typeof changes[field] !== 'boolean') return errorResult('INVALID_INPUT', `${field} deve ser booleano.`);
      update[field] = changes[field];
    }
  }
  if ('daily_send_limit' in changes) {
    const limit = changes.daily_send_limit;
    if (limit !== null && (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 1_000)) {
      return errorResult('INVALID_INPUT', 'daily_send_limit deve ser nulo ou um inteiro entre 1 e 1000.');
    }
    update.daily_send_limit = limit;
  }
  if ('blackout_dates' in changes) {
    const dates = changes.blackout_dates;
    if (dates !== null && (!Array.isArray(dates) || dates.length > 100 || dates.some((date) => typeof date !== 'string' || !validCalendarDate(date)))) {
      return errorResult('INVALID_INPUT', 'blackout_dates deve ser nulo ou conter até 100 datas reais no formato AAAA-MM-DD.');
    }
    update.blackout_dates = dates === null ? null : [...new Set(dates as string[])];
  }

  const { data: current, error: lookupError } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
  if (lookupError) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar o lead.');
  if (!current) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  const { data, error } = await supabase.from('leads')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select('id,reativacao_habilitada,skip_automation,daily_send_limit,blackout_dates,updated_at')
    .maybeSingle();
  if (error || !data) return errorResult('INTERNAL_ERROR', 'Não foi possível atualizar as configurações comerciais do lead.');
  return { success: true, lead: data, changed_fields: Object.keys(update) };
}

const textValue = (input: Record<string, unknown>, field: string, maxLength = MAX_TEXT): { value?: string | null; error?: string } => {
  if (!(field in input)) return {};
  if (input[field] !== null && typeof input[field] !== 'string') return { error: `${field} deve ser texto ou nulo.` };
  const value = text(input[field]);
  if (value.length > maxLength) return { error: `${field} excede o limite de ${maxLength} caracteres.` };
  return { value: value || null };
};

async function optionById(
  supabase: SupabaseClient,
  table: 'lead_origens' | 'lead_responsaveis' | 'lead_tipos_contratacao' | 'lead_status_config',
  id: unknown,
  select: string,
): Promise<{ data: Record<string, unknown> | null; error: boolean }> {
  const value = text(id);
  if (!safeUuid(value)) return { data: null, error: false };
  const { data, error } = await supabase.from(table).select(select).eq('id', value).maybeSingle();
  return { data: data as Record<string, unknown> | null, error: Boolean(error) };
}

async function getLeadDefaults(supabase: SupabaseClient) {
  const [statuses, origins, responsibles, contractTypes] = await Promise.all([
    supabase.from('lead_status_config').select('id,nome,padrao,ordem').eq('ativo', true).order('ordem', { ascending: true }),
    supabase.from('lead_origens').select('id,nome').eq('ativo', true).order('nome', { ascending: true }),
    supabase.from('lead_responsaveis').select('id,label,value,ordem').eq('ativo', true).order('ordem', { ascending: true }),
    supabase.from('lead_tipos_contratacao').select('id,label,value,ordem').eq('ativo', true).order('ordem', { ascending: true }),
  ]);
  if ([statuses, origins, responsibles, contractTypes].some((result) => result.error)) return null;
  const statusRows = (statuses.data ?? []) as Array<Record<string, unknown>>;
  return {
    statuses: statusRows,
    defaultStatus: statusRows.find((status) => status.padrao === true) ?? statusRows[0] ?? null,
    origins: origins.data ?? [],
    responsibles: responsibles.data ?? [],
    contractTypes: contractTypes.data ?? [],
  };
}

async function deterministicLeadId(actorId: string, clientRequestId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`kifer-mcp-lead:${actorId}:${clientRequestId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function createLead(supabase: SupabaseClient, params: Record<string, unknown>, actor: Actor): Promise<Result> {
  const lead = isRecord(params.lead) ? params.lead : null;
  const clientRequestId = text(params.client_request_id);
  const allowed = new Set([
    'nome_completo', 'telefone', 'email', 'cidade', 'cep', 'endereco', 'estado', 'regiao', 'canal',
    'operadora_atual', 'observacoes', 'origem_id', 'responsavel_id', 'tipo_contratacao_id', 'status_id', 'skip_automation',
  ]);
  if (!lead || !clientRequestId || !REQUEST_ID.test(clientRequestId)) {
    return errorResult('INVALID_INPUT', 'Informe lead e client_request_id (1–128 caracteres alfanuméricos, : _ ou -).');
  }
  if (Object.keys(lead).some((key) => !allowed.has(key))) return errorResult('NOT_ALLOWED', 'lead contém campos não permitidos para criação pelo MCP.');
  const name = text(lead.nome_completo);
  const phone = text(lead.telefone).replace(/\D/g, '');
  if (!name || name.length > MAX_TEXT) return errorResult('INVALID_INPUT', 'nome_completo é obrigatório e deve ter até 160 caracteres.');
  if (phone.length < 10 || phone.length > 13) return errorResult('INVALID_INPUT', 'telefone deve conter de 10 a 13 dígitos.');
  if (lead.skip_automation !== undefined && typeof lead.skip_automation !== 'boolean') return errorResult('INVALID_INPUT', 'skip_automation deve ser booleano.');

  const fields = ['email', 'cidade', 'cep', 'endereco', 'estado', 'regiao', 'canal', 'operadora_atual', 'observacoes'] as const;
  const payload: Record<string, unknown> = { nome_completo: name, telefone: phone };
  for (const field of fields) {
    const parsed = textValue(lead, field, field === 'observacoes' ? MAX_NOTES : MAX_TEXT);
    if (parsed.error) return errorResult('INVALID_INPUT', parsed.error);
    if (field in lead) payload[field] = parsed.value;
  }
  if ('email' in lead && payload.email !== null) {
    const email = text(payload.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResult('INVALID_INPUT', 'email inválido.');
    payload.email = email;
  }
  if ('cep' in lead && payload.cep !== null) {
    const cep = text(payload.cep).replace(/\D/g, '');
    if (cep.length !== 8) return errorResult('INVALID_INPUT', 'cep deve conter 8 dígitos.');
    payload.cep = cep;
  }
  if ('estado' in lead && payload.estado !== null) {
    const uf = text(payload.estado).toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) return errorResult('INVALID_INPUT', 'estado deve usar a UF com duas letras.');
    payload.estado = uf;
  }

  const defaults = await getLeadDefaults(supabase);
  if (!defaults) return errorResult('INTERNAL_ERROR', 'Não foi possível validar as opções comerciais do CRM.');
  const [statusLookup, originLookup, responsibleLookup, contractTypeLookup] = await Promise.all([
    lead.status_id === undefined ? Promise.resolve({ data: defaults.defaultStatus, error: false }) : optionById(supabase, 'lead_status_config', lead.status_id, 'id,nome,ativo'),
    lead.origem_id === undefined ? Promise.resolve({ data: defaults.origins[0] as Record<string, unknown> | undefined ?? null, error: false }) : optionById(supabase, 'lead_origens', lead.origem_id, 'id,nome,ativo'),
    lead.responsavel_id === undefined ? Promise.resolve({ data: defaults.responsibles[0] as Record<string, unknown> | undefined ?? null, error: false }) : optionById(supabase, 'lead_responsaveis', lead.responsavel_id, 'id,label,value,ativo'),
    lead.tipo_contratacao_id === undefined ? Promise.resolve({ data: defaults.contractTypes[0] as Record<string, unknown> | undefined ?? null, error: false }) : optionById(supabase, 'lead_tipos_contratacao', lead.tipo_contratacao_id, 'id,label,value,ativo'),
  ]);
  if ([statusLookup, originLookup, responsibleLookup, contractTypeLookup].some((lookup) => lookup.error)) {
    return errorResult('INTERNAL_ERROR', 'Não foi possível validar as opções comerciais do lead.');
  }
  const status = statusLookup.data;
  const origin = originLookup.data;
  const responsible = responsibleLookup.data;
  const contractType = contractTypeLookup.data;
  if (!status || status.ativo === false || !text(status.nome)) return errorResult('INVALID_STATUS', 'status_id não existe ou está inativo, e não há status padrão ativo.');
  if (!origin || origin.ativo === false) return errorResult('INVALID_INPUT', 'origem_id não existe ou está inativo, e não há origem ativa configurada.');
  if (!responsible || responsible.ativo === false) return errorResult('INVALID_ASSIGNEE', 'responsavel_id não existe ou está inativo, e não há responsável ativo configurado.');
  if (!contractType || contractType.ativo === false) return errorResult('INVALID_INPUT', 'tipo_contratacao_id não existe ou está inativo, e não há tipo ativo configurado.');

  const id = await deterministicLeadId(actor.actorId, clientRequestId);
  const { data: existingRequest, error: requestLookupError } = await supabase.from('leads').select('id,nome_completo,telefone,email').eq('id', id).maybeSingle();
  if (requestLookupError) return errorResult('INTERNAL_ERROR', 'Não foi possível verificar a idempotência da criação.');
  if (existingRequest) return { success: true, duplicate: true, client_request_id: clientRequestId, lead: existingRequest };

  const duplicateQueries = await Promise.all([
    supabase.from('leads').select('id,nome_completo,telefone,email').eq('telefone', phone).limit(5),
    payload.email ? supabase.from('leads').select('id,nome_completo,telefone,email').ilike('email', text(payload.email)).limit(5) : Promise.resolve({ data: [], error: null }),
  ]);
  if (duplicateQueries.some((result) => result.error)) return errorResult('INTERNAL_ERROR', 'Não foi possível verificar possíveis leads duplicados.');
  const duplicates = [...new Map(duplicateQueries.flatMap((result) => result.data ?? []).map((row) => [row.id, row])).values()];
  if (duplicates.length > 0) return { success: false, error_code: 'DUPLICATE_LEAD', message: 'Já existe lead com este telefone ou e-mail. Nenhum registro foi criado.', possible_duplicates: duplicates };

  const now = new Date().toISOString();
  const insertPayload = {
    ...payload,
    id,
    origem_id: origin.id,
    tipo_contratacao_id: contractType.id,
    responsavel_id: responsible.id,
    status_id: status.id,
    status: status.nome,
    skip_automation: lead.skip_automation === true,
    creation_source: 'chatgpt_mcp',
    arquivado: false,
    favorito: false,
    data_criacao: now,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase.from('leads').insert(insertPayload).select('id,nome_completo,telefone,email,status,status_id,origem_id,responsavel_id,tipo_contratacao_id,arquivado,favorito,created_at').maybeSingle();
  if (error || !data) {
    if ((error as { code?: string } | null)?.code === '23505') {
      const { data: concurrent } = await supabase.from('leads').select('id,nome_completo,telefone,email').eq('id', id).maybeSingle();
      if (concurrent) return { success: true, duplicate: true, client_request_id: clientRequestId, lead: concurrent };
    }
    return errorResult('INTERNAL_ERROR', 'Não foi possível criar o lead.');
  }
  return { success: true, duplicate: false, client_request_id: clientRequestId, lead: data, automation_skipped: lead.skip_automation === true };
}

export async function executeMcpLeadAdminAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Record<string, unknown>;
  actor: Actor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_LEAD_ADMIN_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (toolName === 'kifer_create_lead') return { actionType: 'lead_create', result: await createLead(supabase, args, actor) };
  if (toolName === 'kifer_archive_lead') return { actionType: 'lead_archive', result: await setLeadBoolean(supabase, args.lead_id, 'arquivado', true) };
  if (toolName === 'kifer_unarchive_lead') return { actionType: 'lead_unarchive', result: await setLeadBoolean(supabase, args.lead_id, 'arquivado', false) };
  if (toolName === 'kifer_set_lead_favorite') {
    if (typeof args.favorite !== 'boolean') return { actionType: 'lead_favorite_set', result: errorResult('INVALID_INPUT', 'favorite deve ser booleano.') };
    return { actionType: 'lead_favorite_set', result: await setLeadBoolean(supabase, args.lead_id, 'favorito', args.favorite) };
  }
  return { actionType: 'lead_administration_update', result: await updateLeadAdministration(supabase, args) };
}
