import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMMISSION_COLUMNS = [
  'id', 'codigo_contrato', 'operadora', 'previsao_recebimento_comissao', 'comissao_prevista',
  'comissao_recebimento_adiantado', 'comissao_parcelas', 'mensalidade_total',
  'previsao_pagamento_bonificacao', 'bonus_por_vida_aplicado', 'bonus_por_vida_configuracoes',
  'bonus_por_vida_valor', 'vidas', 'vidas_elegiveis_bonus',
].join(',');

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const errorResult = (errorCode: string, message: string): McpWriteResult => ({ success: false, error_code: errorCode, message });

export const MCP_ANALYTICS_TOOLS: readonly McpToolDescriptor[] = [
  {
    name: 'kifer_get_team_production_report',
    description: 'Consulta métricas e eventos da produção individual/equipe no horário de Brasília. Limita o intervalo a 366 dias; não expõe mensagens nem conteúdo de conversas.',
    inputSchema: {
      type: 'object', required: ['start_date', 'end_date'], additionalProperties: false,
      properties: {
        start_date: { type: 'string', format: 'date' }, end_date: { type: 'string', format: 'date' },
        operator_user_id: { type: 'string', format: 'uuid' }, offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'kifer_get_commission_calendar',
    description: 'Calcula a agenda de comissão e bonificação para contratos ativos, aplicando parcelas, previsões e regras do calendário do CRM. É somente leitura.',
    inputSchema: {
      type: 'object', required: ['start_date', 'end_date'], additionalProperties: false,
      properties: { start_date: { type: 'string', format: 'date' }, end_date: { type: 'string', format: 'date' } },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'kifer_list_commission_contracts',
    description: 'Lista a projeção financeira da agenda de comissões para contratos ativos, com filtros por previsão e paginação. Não registra pagamentos nem altera contratos.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        start_date: { type: 'string', format: 'date' }, end_date: { type: 'string', format: 'date' },
        page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'kifer_activate_team_production',
    description: 'Inicia uma única vez a medição de produção a partir de agora. Não reatribui atividade histórica. Ação administrativa explícita e auditada.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: false },
  },
] as const;

export const MCP_ANALYTICS_READ_TOOL_NAMES = MCP_ANALYTICS_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name);
export const MCP_ANALYTICS_WRITE_TOOL_NAMES = MCP_ANALYTICS_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === false).map((tool) => tool.name);

const parseDate = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const match = value.match(DATE);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? { year, month, day, timestamp: parsed.getTime(), value }
    : null;
};

const money = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const dateKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

const parseCommissionDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = parseDate(value.slice(0, 10));
  if (!parsed) return null;
  return new Date(parsed.timestamp);
};

const commissionInstallments = (contract: Record<string, unknown>, baseDate: Date, commission: number) => {
  const raw = contract.comissao_parcelas;
  const installments = Array.isArray(raw) ? raw.filter(isRecord).map((item) => ({
    date: parseCommissionDate(item.data_pagamento) ?? baseDate,
    value: money(item.valor),
    percentage: money(item.percentual),
  })).filter((item) => item.value > 0 || item.percentage > 0) : [];
  const usesValue = installments.some((item) => item.value > 0);
  const totalPercentage = installments.reduce((total, item) => total + item.percentage, 0);
  if (installments.length) return installments.map((item, index) => ({
    date: item.date,
    value: roundMoney(usesValue ? item.value : totalPercentage > 0 ? commission * item.percentage / totalPercentage : 0),
    installment_index: index + 1,
    installment_count: installments.length,
  }));

  const monthlyCap = money(contract.mensalidade_total);
  if (monthlyCap <= 0) return [{ date: baseDate, value: commission, installment_index: undefined, installment_count: undefined }];
  const results: Array<{ date: Date; value: number; installment_index: number; installment_count?: number }> = [];
  let remaining = roundMoney(commission);
  let index = 0;
  while (remaining > 0.009 && index < 60) {
    const date = new Date(baseDate);
    date.setUTCMonth(date.getUTCMonth() + index);
    const value = roundMoney(Math.min(monthlyCap, remaining));
    results.push({ date, value, installment_index: index + 1 });
    remaining = roundMoney(remaining - value);
    index += 1;
  }
  return results.length ? results.map((item) => ({ ...item, installment_count: results.length }))
    : [{ date: baseDate, value: commission, installment_index: undefined, installment_count: undefined }];
};

const bonusTotal = (contract: Record<string, unknown>) => {
  const configurations = Array.isArray(contract.bonus_por_vida_configuracoes) ? contract.bonus_por_vida_configuracoes.filter(isRecord) : [];
  const valid = configurations.map((entry) => ({ quantity: Math.max(0, Math.trunc(money(entry.quantidade))), value: Math.max(0, money(entry.valor)) })).filter((entry) => entry.quantity > 0);
  if (valid.length) return valid.reduce((total, entry) => total + entry.quantity * entry.value, 0);
  const perLife = money(contract.bonus_por_vida_valor);
  if (perLife <= 0) return 0;
  const lives = money(contract.vidas_elegiveis_bonus) || money(contract.vidas) || 1;
  return contract.bonus_por_vida_aplicado === true ? perLife * lives : perLife;
};

const buildCommissionEvents = (contracts: Record<string, unknown>[]) => {
  const events: Array<Record<string, unknown>> = [];
  for (const contract of contracts) {
    const commissionDate = parseCommissionDate(contract.previsao_recebimento_comissao);
    const commission = money(contract.comissao_prevista);
    if (commissionDate && commission > 0) {
      const upfront = contract.comissao_recebimento_adiantado !== false;
      const custom = Array.isArray(contract.comissao_parcelas) && contract.comissao_parcelas.some((item) => isRecord(item) && (money(item.valor) > 0 || money(item.percentual) > 0));
      const installments = !upfront && custom ? commissionInstallments(contract, commissionDate, commission)
        : !upfront && money(contract.mensalidade_total) > 0 ? commissionInstallments({ ...contract, comissao_parcelas: [] }, commissionDate, commission)
          : [{ date: commissionDate, value: commission, installment_index: undefined, installment_count: undefined }];
      for (const installment of installments) events.push({
        id: installment.installment_index ? `${text(contract.id)}-comissao-${installment.installment_index}` : `${text(contract.id)}-comissao`,
        date: dateKey(installment.date), type: 'comissao', value: installment.value,
        contract_id: contract.id, codigo_contrato: contract.codigo_contrato, operadora: contract.operadora,
        installment_index: installment.installment_index, installment_count: installment.installment_count,
      });
    }
    const bonusDate = parseCommissionDate(contract.previsao_pagamento_bonificacao);
    const bonus = bonusTotal(contract);
    if (bonusDate && bonus > 0) events.push({ id: `${text(contract.id)}-bonus`, date: dateKey(bonusDate), type: 'bonificacao', value: bonus, contract_id: contract.id, codigo_contrato: contract.codigo_contrato, operadora: contract.operadora });
  }
  return events;
};

export async function executeMcpAnalyticsReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown> }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args } = params;
  if (toolName === 'kifer_get_team_production_report') {
    const start = parseDate(args.start_date);
    const end = parseDate(args.end_date);
    const offset = Number(args.offset ?? 0);
    const operatorId = args.operator_user_id === undefined ? null : text(args.operator_user_id);
    if (!start || !end || start.timestamp > end.timestamp || end.timestamp - start.timestamp > 366 * 86_400_000 || !Number.isInteger(offset) || offset < 0 || offset > 10000 || (operatorId !== null && !UUID.test(operatorId))) return errorResult('INVALID_INPUT', 'Intervalo, executor ou offset inválidos; o período máximo é 366 dias.');
    const { data, error } = await supabase.rpc('team_production_report', { p_start: start.value, p_end: end.value, p_operator: operatorId, p_offset: offset });
    if (error || !isRecord(data) || !Array.isArray(data.summary) || !Array.isArray(data.events)) return errorResult('REPORT_UNAVAILABLE', 'Não foi possível carregar o relatório de produção.');
    return { success: true, report: data };
  }
  if (toolName === 'kifer_list_commission_contracts') {
    const start = args.start_date === undefined ? null : parseDate(args.start_date);
    const end = args.end_date === undefined ? null : parseDate(args.end_date);
    const page = Number(args.page ?? 1); const pageSize = Number(args.page_size ?? 50);
    if ((args.start_date !== undefined && !start) || (args.end_date !== undefined && !end) || (start && end && start.timestamp > end.timestamp) || !Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return errorResult('INVALID_INPUT', 'Filtros ou paginação inválidos.');
    const from = (page - 1) * pageSize;
    let query = supabase.from('contracts').select(COMMISSION_COLUMNS, { count: 'exact' }).eq('status', 'Ativo');
    if (start) query = query.gte('previsao_recebimento_comissao', start.value);
    if (end) query = query.lte('previsao_recebimento_comissao', end.value);
    const { data, error, count } = await query.order('previsao_recebimento_comissao', { ascending: true }).range(from, from + pageSize - 1);
    if (error) return errorResult('REPORT_UNAVAILABLE', 'Não foi possível carregar os contratos de comissão.');
    return { success: true, contracts: data ?? [], page, page_size: pageSize, total: count ?? 0 };
  }
  if (toolName === 'kifer_get_commission_calendar') {
    const start = parseDate(args.start_date); const end = parseDate(args.end_date);
    if (!start || !end || start.timestamp > end.timestamp || end.timestamp - start.timestamp > 366 * 3 * 86_400_000) return errorResult('INVALID_INPUT', 'Informe datas válidas em um intervalo de até três anos.');
    const contracts: Record<string, unknown>[] = [];
    for (let offset = 0; offset <= 10000; offset += 500) {
      const { data, error } = await supabase.from('contracts').select(COMMISSION_COLUMNS).eq('status', 'Ativo').order('previsao_recebimento_comissao', { ascending: true }).range(offset, offset + 499);
      if (error) return errorResult('REPORT_UNAVAILABLE', 'Não foi possível carregar a agenda de comissões.');
      const rows = Array.isArray(data) ? data.filter(isRecord) : [];
      contracts.push(...rows);
      if (rows.length < 500) break;
      if (contracts.length > 10000) return errorResult('LIMIT_EXCEEDED', 'A carteira excede o limite de contratos desta consulta; use kifer_list_commission_contracts com paginação.');
    }
    const report = await buildMcpCommissionCalendar(contracts, start.value, end.value);
    return report ? { success: true, calendar: report } : errorResult('INVALID_INPUT', 'O intervalo informado é inválido.');
  }
  return null;
}

export async function executeMcpAnalyticsWriteAction(params: { supabase: SupabaseClient; toolName: string; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  if (params.toolName !== 'kifer_activate_team_production') return null;
  const { data, error } = await params.supabase.rpc('mcp_activate_team_production', { p_actor_user_id: params.actor.actorId });
  const result: McpWriteResult = error || typeof data !== 'string'
    ? errorResult('PRODUCTION_UNAVAILABLE', 'Não foi possível ativar a medição da equipe.')
    : { success: true, started_at: data };
  const { error: auditError } = await params.supabase.from('mcp_action_audit_log').insert({
    tool_name: params.toolName,
    action_type: 'team-production-activate',
    actor: params.actor.actor,
    actor_id: params.actor.actorId,
    request_payload: {},
    result_payload: { success: result.success, error_code: result.error_code ?? null, started_at: result.success ? result.started_at : undefined },
    success: result.success,
    error_message: result.success ? null : text(result.message) || null,
    source: 'chatgpt_mcp',
  });
  if (auditError) console.error('[chatgpt-mcp] falha ao auditar ativação de produção:', auditError.message);
  return result;
}

export async function buildMcpCommissionCalendar(contracts: Record<string, unknown>[], startDate: string, endDate: string) {
  const start = parseDate(startDate); const end = parseDate(endDate);
  if (!start || !end || start.timestamp > end.timestamp) return null;
  const events = buildCommissionEvents(contracts).filter((event) => typeof event.date === 'string' && event.date >= start.value && event.date <= end.value).sort((left, right) => text(left.date).localeCompare(text(right.date)) || money(left.value) - money(right.value));
  const totals = events.reduce((result, event) => {
    if (event.type === 'comissao') result.commission += money(event.value);
    else result.bonus += money(event.value);
    return result;
  }, { commission: 0, bonus: 0 });
  const byDay: Record<string, Array<Record<string, unknown>>> = {};
  for (const event of events) {
    const key = text(event.date);
    byDay[key] = [...(byDay[key] ?? []), event];
  }
  return { start_date: start.value, end_date: end.value, totals, event_count: events.length, events, by_day: byDay };
}
