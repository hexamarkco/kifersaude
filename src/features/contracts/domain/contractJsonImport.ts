const CONTRACT_TEXT_FIELDS = [
  'codigo_contrato',
  'status',
  'modalidade',
  'operadora',
  'produto_plano',
  'abrangencia',
  'acomodacao',
  'data_inicio',
  'data_renovacao',
  'carencia',
  'taxa_adesao_tipo',
  'previsao_recebimento_comissao',
  'previsao_pagamento_bonificacao',
  'responsavel',
  'observacoes_internas',
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'endereco_empresa',
] as const;

const CONTRACT_NUMBER_FIELDS = [
  'mes_reajuste',
  'mensalidade_total',
  'comissao_prevista',
  'comissao_multiplicador',
  'taxa_adesao_percentual',
  'taxa_adesao_valor',
  'vidas',
] as const;

const HOLDER_TEXT_FIELDS = [
  'nome_completo',
  'cpf',
  'rg',
  'data_nascimento',
  'sexo',
  'estado_civil',
  'telefone',
  'email',
  'cep',
  'endereco',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'cns',
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'data_abertura_cnpj',
] as const;

const HOLDER_NUMBER_FIELDS = ['percentual_societario'] as const;

export type ContractJsonContractField =
  | typeof CONTRACT_TEXT_FIELDS[number]
  | typeof CONTRACT_NUMBER_FIELDS[number];

export type ContractJsonHolderField =
  | typeof HOLDER_TEXT_FIELDS[number]
  | typeof HOLDER_NUMBER_FIELDS[number];

export type ContractJsonImportPayload = {
  contract: Partial<Record<ContractJsonContractField, string | number>>;
  holder: Partial<Record<ContractJsonHolderField, string | number>> | null;
};

export type ContractJsonBulkImportPayload = {
  contracts: Array<Partial<Record<ContractJsonContractField, string | number>>>;
};

export const MAX_CONTRACTS_PER_JSON_IMPORT = 200;

export const CONTRACT_JSON_IMPORT_TEMPLATE = {
  contrato: {
    codigo_contrato: '',
    status: '',
    modalidade: '',
    operadora: '',
    produto_plano: '',
    abrangencia: '',
    acomodacao: '',
    data_inicio: '',
    data_renovacao: '',
    mes_reajuste: '',
    carencia: '',
    mensalidade_total: '',
    comissao_prevista: '',
    comissao_multiplicador: '',
    taxa_adesao_tipo: '',
    taxa_adesao_percentual: '',
    taxa_adesao_valor: '',
    previsao_recebimento_comissao: '',
    previsao_pagamento_bonificacao: '',
    vidas: '',
    responsavel: '',
    observacoes_internas: '',
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    endereco_empresa: '',
  },
  titular: {
    nome_completo: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    sexo: '',
    estado_civil: '',
    telefone: '',
    email: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cns: '',
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    percentual_societario: '',
    data_abertura_cnpj: '',
  },
} as const;

export const CONTRACT_JSON_BULK_IMPORT_TEMPLATE = {
  contratos: [
    {
      codigo_contrato: '',
      status: '',
      modalidade: '',
      operadora: '',
      produto_plano: '',
      abrangencia: '',
      acomodacao: '',
      data_inicio: '',
      data_renovacao: '',
      mes_reajuste: '',
      carencia: '',
      mensalidade_total: '',
      comissao_prevista: '',
      comissao_multiplicador: '',
      taxa_adesao_tipo: '',
      taxa_adesao_percentual: '',
      taxa_adesao_valor: '',
      previsao_recebimento_comissao: '',
      previsao_pagamento_bonificacao: '',
      vidas: '',
      responsavel: '',
      observacoes_internas: '',
      cnpj: '',
      razao_social: '',
      nome_fantasia: '',
      endereco_empresa: '',
    },
  ],
} as const;

const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const isEmptyValue = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
) => {
  const unknownKey = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknownKey) {
    throw new Error(`Campo não reconhecido em ${path}: "${unknownKey}".`);
  }
};

const assertDate = (value: unknown, field: string, format: 'date' | 'month') => {
  if (isEmptyValue(value)) return;
  if (typeof value !== 'string') {
    throw new Error(`"${field}" deve ser uma string no formato ${format === 'date' ? 'AAAA-MM-DD' : 'AAAA-MM'}.`);
  }

  const expression = format === 'date'
    ? /^(\d{4})-(\d{2})-(\d{2})$/
    : /^(\d{4})-(\d{2})$/;
  const match = value.match(expression);
  if (!match) {
    throw new Error(`"${field}" deve usar o formato ${format === 'date' ? 'AAAA-MM-DD' : 'AAAA-MM'}.`);
  }

  const month = Number(match[2]);
  const day = format === 'date' ? Number(match[3]) : 1;
  const parsed = new Date(Date.UTC(Number(match[1]), month - 1, day));
  if (
    month < 1 || month > 12 ||
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`"${field}" contém uma data inválida.`);
  }
};

const parseNumberValue = (value: string | number, field: string) => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`"${field}" precisa ser um número válido.`);
    return value;
  }

  const trimmed = value.trim();
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`"${field}" precisa ser um número válido.`);
  }
  return parsed;
};

const parseFieldGroup = <T extends string>(
  source: Record<string, unknown>,
  fields: readonly T[],
  numberFields: readonly string[],
  path: string,
) => {
  assertAllowedKeys(source, fields, path);
  const parsed: Partial<Record<T, string | number>> = {};

  for (const key of fields) {
    const value = source[key];
    if (isEmptyValue(value)) continue;

    if (numberFields.includes(key)) {
      if (typeof value !== 'number' && typeof value !== 'string') {
        throw new Error(`"${path}.${key}" precisa ser texto ou número.`);
      }
      const parsedNumber = parseNumberValue(value, `${path}.${key}`);
      if (parsedNumber < 0) throw new Error(`"${path}.${key}" não pode ser negativo.`);
      parsed[key] = parsedNumber;
      continue;
    }

    if (typeof value !== 'string') {
      throw new Error(`"${path}.${key}" precisa ser texto.`);
    }
    parsed[key] = value.trim();
  }

  return parsed;
};

export function parseContractJsonImport(content: string): ContractJsonImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('O arquivo não contém um JSON válido.');
  }

  const root = asObject(parsed);
  if (!root) throw new Error('O JSON precisa conter um objeto na raiz.');
  assertAllowedKeys(root, ['contrato', 'titular'], 'raiz');

  const contractSource = asObject(root.contrato);
  if (!contractSource) throw new Error('Informe "contrato" como um objeto JSON.');
  const contract = parseFieldGroup(
    contractSource,
    [...CONTRACT_TEXT_FIELDS, ...CONTRACT_NUMBER_FIELDS],
    CONTRACT_NUMBER_FIELDS,
    'contrato',
  );

  const holderSource = root.titular === undefined || root.titular === null
    ? null
    : asObject(root.titular);
  if (root.titular !== undefined && root.titular !== null && !holderSource) {
    throw new Error('"titular" precisa ser um objeto JSON.');
  }
  const parsedHolder = holderSource
    ? parseFieldGroup(
        holderSource,
        [...HOLDER_TEXT_FIELDS, ...HOLDER_NUMBER_FIELDS],
        HOLDER_NUMBER_FIELDS,
        'titular',
      )
    : null;
  const holder = parsedHolder && Object.keys(parsedHolder).length > 0
    ? parsedHolder
    : null;

  if (Object.keys(contract).length === 0 && (!holder || Object.keys(holder).length === 0)) {
    throw new Error('Preencha pelo menos um campo em "contrato" ou "titular".');
  }

  assertDate(contract.data_inicio, 'contrato.data_inicio', 'date');
  assertDate(contract.data_renovacao, 'contrato.data_renovacao', 'month');
  assertDate(contract.previsao_recebimento_comissao, 'contrato.previsao_recebimento_comissao', 'date');
  assertDate(contract.previsao_pagamento_bonificacao, 'contrato.previsao_pagamento_bonificacao', 'date');
  assertDate(holder?.data_nascimento, 'titular.data_nascimento', 'date');
  assertDate(holder?.data_abertura_cnpj, 'titular.data_abertura_cnpj', 'date');

  if (
    contract.taxa_adesao_tipo !== undefined &&
    !['nao_cobrar', 'percentual_mensalidade', 'valor_fixo'].includes(String(contract.taxa_adesao_tipo))
  ) {
    throw new Error('"contrato.taxa_adesao_tipo" deve ser "nao_cobrar", "percentual_mensalidade" ou "valor_fixo".');
  }
  const reajusteMonth = Number(contract.mes_reajuste);
  if (contract.mes_reajuste !== undefined && (reajusteMonth < 1 || reajusteMonth > 12)) {
    throw new Error('"contrato.mes_reajuste" deve estar entre 1 e 12.');
  }
  const lives = Number(contract.vidas);
  if (contract.vidas !== undefined && (!Number.isInteger(lives) || lives < 1)) {
    throw new Error('"contrato.vidas" deve ser um número inteiro maior que zero.');
  }

  return { contract, holder };
}

export function parseBulkContractJsonImport(content: string): ContractJsonBulkImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('O arquivo não contém um JSON válido.');
  }

  const root = asObject(parsed);
  if (!root) throw new Error('O JSON precisa conter um objeto na raiz.');
  assertAllowedKeys(root, ['contratos'], 'raiz');
  if (!Array.isArray(root.contratos) || root.contratos.length === 0) {
    throw new Error('Informe "contratos" como uma lista com pelo menos um contrato.');
  }
  if (root.contratos.length > MAX_CONTRACTS_PER_JSON_IMPORT) {
    throw new Error(`O arquivo pode conter no máximo ${MAX_CONTRACTS_PER_JSON_IMPORT} contratos por importação.`);
  }

  const contracts = root.contratos.map((value, index) => {
    const source = asObject(value);
    if (!source) throw new Error(`O item ${index + 1} de "contratos" precisa ser um objeto JSON.`);
    const contract = parseFieldGroup(
      source,
      [...CONTRACT_TEXT_FIELDS, ...CONTRACT_NUMBER_FIELDS],
      CONTRACT_NUMBER_FIELDS,
      `contratos[${index}]`,
    );

    for (const key of ['codigo_contrato', 'status', 'modalidade', 'operadora', 'produto_plano', 'responsavel'] as const) {
      if (typeof contract[key] !== 'string' || !contract[key]?.trim()) {
        throw new Error(`Preencha "${key}" no contrato ${index + 1}.`);
      }
    }

    assertDate(contract.data_inicio, `contratos[${index}].data_inicio`, 'date');
    assertDate(contract.data_renovacao, `contratos[${index}].data_renovacao`, 'month');
    assertDate(contract.previsao_recebimento_comissao, `contratos[${index}].previsao_recebimento_comissao`, 'date');
    assertDate(contract.previsao_pagamento_bonificacao, `contratos[${index}].previsao_pagamento_bonificacao`, 'date');

    if (
      contract.taxa_adesao_tipo !== undefined &&
      !['nao_cobrar', 'percentual_mensalidade', 'valor_fixo'].includes(String(contract.taxa_adesao_tipo))
    ) {
      throw new Error(`"contratos[${index}].taxa_adesao_tipo" tem um valor inválido.`);
    }
    const reajusteMonth = Number(contract.mes_reajuste);
    if (contract.mes_reajuste !== undefined && (reajusteMonth < 1 || reajusteMonth > 12)) {
      throw new Error(`"contratos[${index}].mes_reajuste" deve estar entre 1 e 12.`);
    }
    const lives = Number(contract.vidas);
    if (contract.vidas !== undefined && (!Number.isInteger(lives) || lives < 1)) {
      throw new Error(`"contratos[${index}].vidas" deve ser um número inteiro maior que zero.`);
    }
    return contract;
  });

  const contractCodes = contracts.map((contract) => String(contract.codigo_contrato).trim());
  const duplicateCodes = contractCodes.find((code, index) => contractCodes.indexOf(code) !== index);
  if (duplicateCodes) {
    throw new Error(`O código "${duplicateCodes}" aparece mais de uma vez no arquivo.`);
  }

  return { contracts };
}
