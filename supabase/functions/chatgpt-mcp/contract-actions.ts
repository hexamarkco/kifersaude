import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type Actor = { actorId: string };
type ActionError = { success: false; error_code: string; message: string };
type ActionResult = { success: true; [key: string]: unknown } | ActionError;

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const contractFields = [
  'codigo_contrato', 'lead_id', 'status', 'modalidade', 'operadora', 'produto_plano', 'abrangencia', 'acomodacao',
  'data_inicio', 'data_renovacao', 'mes_reajuste', 'carencia', 'mensalidade_total', 'comissao_prevista',
  'comissao_multiplicador', 'taxa_adesao_tipo', 'taxa_adesao_percentual', 'taxa_adesao_valor',
  'comissao_recebimento_adiantado', 'comissao_parcelas', 'previsao_recebimento_comissao',
  'previsao_pagamento_bonificacao', 'vidas', 'vidas_elegiveis_bonus', 'bonus_por_vida_configuracoes',
  'bonus_por_vida_valor', 'bonus_por_vida_aplicado', 'responsavel', 'observacoes_internas', 'cnpj',
  'razao_social', 'nome_fantasia', 'endereco_empresa',
] as const;
const contractFieldSet = new Set<string>(contractFields);
const commissionFields = [
  'comissao_prevista', 'comissao_multiplicador', 'comissao_recebimento_adiantado', 'comissao_parcelas',
  'previsao_recebimento_comissao', 'previsao_pagamento_bonificacao', 'vidas_elegiveis_bonus',
  'bonus_por_vida_configuracoes', 'bonus_por_vida_valor', 'bonus_por_vida_aplicado',
] as const;
const commissionFieldSet = new Set<string>(commissionFields);
const staleWriteRpcNames = new Set([
  'mcp_update_contract',
  'mcp_update_contract_holder',
  'mcp_update_contract_dependent',
  'mcp_remove_contract_holder',
  'mcp_remove_contract_dependent',
]);
const holderFields = [
  'nome_completo', 'cpf', 'rg', 'data_nascimento', 'sexo', 'estado_civil', 'telefone', 'email', 'cep', 'endereco',
  'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cns', 'cnpj', 'razao_social', 'nome_fantasia',
  'percentual_societario', 'data_abertura_cnpj', 'bonus_por_vida_aplicado',
] as const;
const holderFieldSet = new Set<string>(holderFields);
const dependentFields = [
  'nome_completo', 'cpf', 'data_nascimento', 'relacao', 'elegibilidade', 'valor_individual',
  'carencia_individual', 'bonus_por_vida_aplicado',
] as const;
const dependentFieldSet = new Set<string>(dependentFields);

const stringField = (maxLength = 500) => ({ type: 'string', maxLength });
const nullableStringField = (maxLength = 500) => ({ type: ['string', 'null'], maxLength });
const numberField = (minimum = 0, maximum = 1_000_000_000) => ({ type: 'number', minimum, maximum });
const nullableNumberField = (minimum = 0, maximum = 1_000_000_000) => ({ type: ['number', 'null'], minimum, maximum });

const contractProperties = {
  codigo_contrato: { type: 'string', minLength: 1, maxLength: 80 },
  lead_id: { type: ['string', 'null'], format: 'uuid' },
  status: { type: 'string', minLength: 1, maxLength: 80 },
  modalidade: { type: 'string', minLength: 1, maxLength: 120 },
  operadora: { type: 'string', minLength: 1, maxLength: 160 },
  produto_plano: { type: 'string', minLength: 1, maxLength: 200 },
  abrangencia: nullableStringField(200),
  acomodacao: nullableStringField(100),
  data_inicio: { type: ['string', 'null'], format: 'date' },
  data_renovacao: { type: ['string', 'null'], format: 'date' },
  mes_reajuste: { type: ['integer', 'null'], minimum: 0, maximum: 12 },
  carencia: nullableStringField(1000),
  mensalidade_total: nullableNumberField(),
  comissao_prevista: nullableNumberField(),
  comissao_multiplicador: { type: 'number', minimum: 0, maximum: 10 },
  taxa_adesao_tipo: { type: 'string', enum: ['nao_cobrar', 'percentual_mensalidade', 'valor_fixo'] },
  taxa_adesao_percentual: nullableNumberField(0, 100),
  taxa_adesao_valor: nullableNumberField(),
  comissao_recebimento_adiantado: { type: 'boolean' },
  comissao_parcelas: { type: 'array', maxItems: 60, items: { type: 'object', additionalProperties: false, required: ['data_pagamento'], properties: { valor: numberField(), percentual: numberField(0, 100), data_pagamento: { type: ['string', 'null'], format: 'date' } } } },
  previsao_recebimento_comissao: { type: ['string', 'null'], format: 'date' },
  previsao_pagamento_bonificacao: { type: ['string', 'null'], format: 'date' },
  vidas: { type: 'integer', minimum: 1, maximum: 10000 },
  vidas_elegiveis_bonus: { type: ['integer', 'null'], minimum: 0, maximum: 10000 },
  bonus_por_vida_configuracoes: { type: 'array', maxItems: 1000, items: { type: 'object', additionalProperties: false, required: ['quantidade', 'valor'], properties: { id: stringField(80), quantidade: { type: 'integer', minimum: 1, maximum: 10000 }, valor: numberField() } } },
  bonus_por_vida_valor: nullableNumberField(),
  bonus_por_vida_aplicado: { type: 'boolean' },
  responsavel: { type: 'string', minLength: 1, maxLength: 160 },
  observacoes_internas: nullableStringField(8000),
  cnpj: nullableStringField(32),
  razao_social: nullableStringField(240),
  nome_fantasia: nullableStringField(240),
  endereco_empresa: nullableStringField(1000),
} as const;

const holderProperties = {
  nome_completo: { type: 'string', minLength: 1, maxLength: 240 },
  cpf: { type: 'string', minLength: 1, maxLength: 32 },
  rg: nullableStringField(40),
  data_nascimento: { type: 'string', format: 'date' },
  sexo: nullableStringField(40),
  estado_civil: nullableStringField(80),
  telefone: { type: 'string', minLength: 1, maxLength: 40 },
  email: nullableStringField(320),
  cep: nullableStringField(20),
  endereco: nullableStringField(240),
  numero: nullableStringField(40),
  complemento: nullableStringField(120),
  bairro: nullableStringField(120),
  cidade: nullableStringField(120),
  estado: nullableStringField(80),
  cns: nullableStringField(40),
  cnpj: nullableStringField(32),
  razao_social: nullableStringField(240),
  nome_fantasia: nullableStringField(240),
  percentual_societario: nullableNumberField(0, 100),
  data_abertura_cnpj: { type: ['string', 'null'], format: 'date' },
  bonus_por_vida_aplicado: { type: 'boolean' },
} as const;

const dependentProperties = {
  nome_completo: { type: 'string', minLength: 1, maxLength: 240 },
  cpf: nullableStringField(32),
  data_nascimento: { type: 'string', format: 'date' },
  relacao: { type: 'string', minLength: 1, maxLength: 80 },
  elegibilidade: nullableStringField(120),
  valor_individual: nullableNumberField(),
  carencia_individual: nullableStringField(1000),
  bonus_por_vida_aplicado: { type: 'boolean' },
} as const;

export const MCP_CONTRACT_WRITE_TOOL_NAMES = [
  'kifer_create_contract', 'kifer_update_contract', 'kifer_update_contract_commission', 'kifer_create_contract_holder', 'kifer_update_contract_holder',
  'kifer_remove_contract_holder', 'kifer_create_dependent', 'kifer_update_dependent', 'kifer_remove_dependent',
  'kifer_create_contract_bundle', 'kifer_create_contract_value_adjustment',
] as const;

const writeAnnotation = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const changesSchema = (properties: Record<string, unknown>) => ({ type: 'object', minProperties: 1, additionalProperties: false, properties });
const removeWarningSchema = (key: 'holder_id' | 'dependent_id') => ({
  type: 'object', required: [key, 'expected_updated_at', 'client_request_id'], additionalProperties: false,
  properties: {
    [key]: { type: 'string', format: 'uuid' },
    expected_updated_at: { type: 'string', format: 'date-time' },
    client_request_id: { type: 'string', minLength: 1, maxLength: 128 },
  },
});

export const MCP_CONTRACT_TOOLS = [
  {
    name: 'kifer_create_contract',
    description: 'Cria contrato com validação de campos permitidos, catálogos ativos, regras de comissão e idempotência. Não converte nem altera o lead vinculado. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['client_request_id', 'contract'], additionalProperties: false, properties: { client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, contract: { type: 'object', required: ['codigo_contrato', 'status', 'modalidade', 'operadora', 'produto_plano', 'responsavel'], additionalProperties: false, properties: contractProperties } } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_update_contract',
    description: 'Atualiza apenas os campos permitidos do contrato. expected_updated_at obrigatório; o banco valida catálogos e regras comerciais. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['contract_id', 'expected_updated_at', 'changes'], additionalProperties: false, properties: { contract_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, changes: changesSchema(contractProperties) } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_update_contract_commission',
    description: 'Atualiza somente os campos de comissão e bonificação modelados no contrato, respeitando regras de parcelas, adiantamento e bônus por vida da tela de contratos. Exige expected_updated_at, auditoria e OAuth admin; não registra pagamentos ou estornos.',
    inputSchema: { type: 'object', required: ['contract_id', 'expected_updated_at', 'changes'], additionalProperties: false, properties: { contract_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, changes: changesSchema(Object.fromEntries(commissionFields.map((field) => [field, contractProperties[field]]))) } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_create_contract_holder',
    description: 'Cria titular em contrato existente com validação de campos e idempotência. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['contract_id', 'client_request_id', 'holder'], additionalProperties: false, properties: { contract_id: { type: 'string', format: 'uuid' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, holder: { type: 'object', required: ['nome_completo', 'cpf', 'data_nascimento', 'telefone'], additionalProperties: false, properties: holderProperties } } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_update_contract_holder',
    description: 'Atualiza os campos permitidos de um titular existente com expected_updated_at obrigatório. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['holder_id', 'expected_updated_at', 'changes'], additionalProperties: false, properties: { holder_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, changes: changesSchema(holderProperties) } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_remove_contract_holder',
    description: 'Remove fisicamente um titular somente se não houver dependentes ou documentos associados; caso contrário, a operação é recusada sem exclusão parcial. Exige concorrência e idempotência. OAuth admin obrigatório.',
    inputSchema: removeWarningSchema('holder_id'),
    annotations: { ...writeAnnotation, destructiveHint: true },
  },
  {
    name: 'kifer_create_dependent',
    description: 'Cria dependente vinculado ao contrato e titular indicados. A validação exige que o titular pertença ao mesmo contrato. client_request_id garante repetição segura. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['contract_id', 'holder_id', 'client_request_id', 'dependent'], additionalProperties: false, properties: { contract_id: { type: 'string', format: 'uuid' }, holder_id: { type: 'string', format: 'uuid' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, dependent: { type: 'object', required: ['nome_completo', 'data_nascimento', 'relacao'], additionalProperties: false, properties: dependentProperties } } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_update_dependent',
    description: 'Atualiza apenas campos permitidos de dependente. Se holder_id mudar, deve continuar no mesmo contrato. expected_updated_at obrigatório. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['dependent_id', 'expected_updated_at', 'changes'], additionalProperties: false, properties: { dependent_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, changes: changesSchema({ ...dependentProperties, holder_id: { type: 'string', format: 'uuid' } }) } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_remove_dependent',
    description: 'Remove fisicamente um dependente somente se não houver documentos associados; a remoção preserva o titular e não continua diante de referências. Exige concorrência e idempotência. OAuth admin obrigatório.',
    inputSchema: removeWarningSchema('dependent_id'),
    annotations: { ...writeAnnotation, destructiveHint: true },
  },
  {
    name: 'kifer_create_contract_bundle',
    description: 'Cria contrato, um titular e até 100 dependentes em uma transação. Qualquer validação falha sem gravar o conjunto. Idempotente por client_request_id; não converte o lead. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['client_request_id', 'contract', 'holder'], additionalProperties: false, properties: { client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, contract: { type: 'object', required: ['codigo_contrato', 'status', 'modalidade', 'operadora', 'produto_plano', 'responsavel'], additionalProperties: false, properties: contractProperties }, holder: { type: 'object', required: ['nome_completo', 'cpf', 'data_nascimento', 'telefone'], additionalProperties: false, properties: holderProperties }, dependents: { type: 'array', maxItems: 100, items: { type: 'object', required: ['nome_completo', 'data_nascimento', 'relacao'], additionalProperties: false, properties: dependentProperties } } } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_create_contract_value_adjustment',
    description: 'Registra acréscimo ou desconto na tabela financeira existente, com motivo obrigatório e idempotência. Não registra pagamento ou estorno. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['contract_id', 'client_request_id', 'tipo', 'valor', 'motivo'], additionalProperties: false, properties: { contract_id: { type: 'string', format: 'uuid' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, tipo: { type: 'string', enum: ['desconto', 'acrescimo'] }, valor: { type: 'number', exclusiveMinimum: 0, maximum: 1000000000 }, motivo: { type: 'string', minLength: 1, maxLength: 1000 } } },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_list_contract_value_adjustments',
    description: 'Lista ajustes de acréscimo/desconto da tabela financeira existente para um contrato, com paginação. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['contract_id'], additionalProperties: false, properties: { contract_id: { type: 'string', format: 'uuid' }, page: { type: 'integer', minimum: 1, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 50, default: 20 } } },
    annotations: { ...writeAnnotation, readOnlyHint: true },
  },
] as const;

const invalid = (message: string): ActionResult => ({ success: false, error_code: 'INVALID_INPUT', message });
const internal = (): ActionResult => ({ success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível executar a alteração do contrato.' });
const staleWrite = (): ActionResult => ({
  success: false,
  error_code: 'CONFLICT',
  message: 'O registro foi alterado desde a última leitura. Recarregue os dados e tente novamente.',
});
const validTimestamp = (value: unknown) => Boolean(text(value)) && Number.isFinite(Date.parse(text(value)));
const validRequestId = (value: unknown) => REQUEST_ID.test(text(value));

function allowedObject(value: unknown, allowed: Set<string>, label: string, allowEmpty = false): Record<string, unknown> | ActionError {
  if (!isRecord(value)) return invalid(`${label} deve ser um objeto.`);
  if ((!allowEmpty && Object.keys(value).length === 0) || Object.keys(value).some((key) => !allowed.has(key))) return invalid(`${label} está vazio ou contém campos não permitidos.`);
  return value;
}

async function callRpc(supabase: SupabaseClient, name: string, parameters: Record<string, unknown>): Promise<ActionResult> {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) return error.code === '40001' && staleWriteRpcNames.has(name) ? staleWrite() : internal();
  if (!isRecord(data)) return internal();
  if (data.success === false) return data as ActionResult;
  return { success: true, ...data };
}

export async function executeMcpContractWriteAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: Actor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_CONTRACT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (!UUID.test(actor.actorId)) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };

  const contractId = text(args.contract_id);
  if (toolName === 'kifer_create_contract' || toolName === 'kifer_create_contract_bundle') {
    if (!validRequestId(args.client_request_id)) return invalid('client_request_id inválido.');
    const contract = allowedObject(args.contract, contractFieldSet, 'contract');
    if (!isRecord(contract) || contract.success === false) return contract as ActionError;
    if (toolName === 'kifer_create_contract') {
      return callRpc(supabase, 'mcp_create_contract', { p_actor_user_id: actor.actorId, p_client_request_id: text(args.client_request_id), p_payload: contract });
    }
    const holder = allowedObject(args.holder, holderFieldSet, 'holder');
    if (!isRecord(holder) || holder.success === false) return holder as ActionError;
    if (!Array.isArray(args.dependents ?? [])) return invalid('dependents deve ser uma lista.');
    const dependents = (args.dependents ?? []) as unknown[];
    if (dependents.length > 100) return invalid('dependents aceita no máximo 100 itens.');
    const normalizedDependents: Record<string, unknown>[] = [];
    for (const dependent of dependents) {
      const parsed = allowedObject(dependent, dependentFieldSet, 'dependent');
      if (!isRecord(parsed) || parsed.success === false) return parsed as ActionError;
      normalizedDependents.push(parsed);
    }
    return callRpc(supabase, 'mcp_create_contract_bundle', {
      p_actor_user_id: actor.actorId,
      p_client_request_id: text(args.client_request_id),
      p_contract: contract,
      p_holder: holder,
      p_dependents: normalizedDependents,
    });
  }

  if (toolName === 'kifer_update_contract' || toolName === 'kifer_update_contract_commission') {
    if (!UUID.test(contractId) || !validTimestamp(args.expected_updated_at)) return invalid('contract_id e expected_updated_at válidos são obrigatórios.');
    const patch = allowedObject(args.changes, toolName === 'kifer_update_contract_commission' ? commissionFieldSet : contractFieldSet, 'changes');
    if (!isRecord(patch) || patch.success === false) return patch as ActionError;
    return callRpc(supabase, 'mcp_update_contract', { p_actor_user_id: actor.actorId, p_contract_id: contractId, p_expected_updated_at: text(args.expected_updated_at), p_patch: patch });
  }

  if (toolName === 'kifer_create_contract_holder') {
    const clientRequestId = text(args.client_request_id);
    if (!UUID.test(contractId) || !validRequestId(clientRequestId)) return invalid('contract_id e client_request_id válidos são obrigatórios.');
    const payload = allowedObject(args.holder, holderFieldSet, 'holder');
    if (!isRecord(payload) || payload.success === false) return payload as ActionError;
    return callRpc(supabase, 'mcp_create_contract_holder', { p_actor_user_id: actor.actorId, p_contract_id: contractId, p_client_request_id: clientRequestId, p_payload: payload });
  }

  if (toolName === 'kifer_update_contract_holder') {
    const holderId = text(args.holder_id);
    if (!UUID.test(holderId) || !validTimestamp(args.expected_updated_at)) return invalid('holder_id e expected_updated_at válidos são obrigatórios.');
    const patch = allowedObject(args.changes, holderFieldSet, 'changes');
    if (!isRecord(patch) || patch.success === false) return patch as ActionError;
    return callRpc(supabase, 'mcp_update_contract_holder', { p_actor_user_id: actor.actorId, p_holder_id: holderId, p_expected_updated_at: text(args.expected_updated_at), p_patch: patch });
  }

  if (toolName === 'kifer_create_dependent') {
    const holderId = text(args.holder_id);
    const clientRequestId = text(args.client_request_id);
    if (!UUID.test(contractId) || !UUID.test(holderId) || !validRequestId(clientRequestId)) return invalid('contract_id, holder_id e client_request_id válidos são obrigatórios.');
    const payload = allowedObject(args.dependent, dependentFieldSet, 'dependent');
    if (!isRecord(payload) || payload.success === false) return payload as ActionError;
    return callRpc(supabase, 'mcp_create_contract_dependent', { p_actor_user_id: actor.actorId, p_contract_id: contractId, p_holder_id: holderId, p_client_request_id: clientRequestId, p_payload: payload });
  }

  if (toolName === 'kifer_update_dependent') {
    const dependentId = text(args.dependent_id);
    if (!UUID.test(dependentId) || !validTimestamp(args.expected_updated_at)) return invalid('dependent_id e expected_updated_at válidos são obrigatórios.');
    const patch = allowedObject(args.changes, new Set([...dependentFields, 'holder_id']), 'changes');
    if (!isRecord(patch) || patch.success === false) return patch as ActionError;
    if ('holder_id' in patch && !UUID.test(text(patch.holder_id))) return invalid('holder_id deve ser um UUID válido.');
    return callRpc(supabase, 'mcp_update_contract_dependent', { p_actor_user_id: actor.actorId, p_dependent_id: dependentId, p_expected_updated_at: text(args.expected_updated_at), p_patch: patch });
  }

  if (toolName === 'kifer_remove_contract_holder' || toolName === 'kifer_remove_dependent') {
    const entityType = toolName === 'kifer_remove_contract_holder' ? 'holder' : 'dependent';
    const id = text(args[`${entityType}_id`]);
    if (!UUID.test(id) || !validTimestamp(args.expected_updated_at) || !validRequestId(args.client_request_id)) return invalid('ID, expected_updated_at e client_request_id válidos são obrigatórios.');
    return callRpc(supabase, `mcp_remove_contract_${entityType}`, {
      p_actor_user_id: actor.actorId,
      [`p_${entityType}_id`]: id,
      p_expected_updated_at: text(args.expected_updated_at),
      p_client_request_id: text(args.client_request_id),
    });
  }

  if (toolName === 'kifer_create_contract_value_adjustment') {
    if (!UUID.test(contractId) || !validRequestId(args.client_request_id)) return invalid('contract_id e client_request_id válidos são obrigatórios.');
    const amount = Number(args.valor);
    const type = text(args.tipo);
    const reason = text(args.motivo);
    if (!Number.isFinite(amount) || amount <= 0 || !['desconto', 'acrescimo'].includes(type) || !reason || reason.length > 1000) return invalid('Informe tipo, valor positivo e motivo válido para o ajuste.');
    return callRpc(supabase, 'mcp_create_contract_value_adjustment', {
      p_actor_user_id: actor.actorId,
      p_contract_id: contractId,
      p_client_request_id: text(args.client_request_id),
      p_tipo: type,
      p_valor: amount,
      p_motivo: reason,
    });
  }

  return null;
}
