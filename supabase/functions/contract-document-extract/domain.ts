export const CONTRACT_DOCUMENT_PROFILES = [
  'auto',
  'supermed',
  'hcommerce',
  'planium',
  'qualicorp',
  'medsenior',
] as const;

export type ContractDocumentProfile = typeof CONTRACT_DOCUMENT_PROFILES[number];

export const CONTRACT_IMPORT_FIELD_KEYS = [
  'codigo_contrato',
  'modalidade',
  'operadora',
  'produto_plano',
  'abrangencia',
  'acomodacao',
  'data_inicio',
  'mes_reajuste',
  'carencia',
  'mensalidade_total',
  'vidas',
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'endereco_empresa',
] as const;

export type ContractImportFieldKey = typeof CONTRACT_IMPORT_FIELD_KEYS[number];
export type ContractImportFields = Partial<Record<ContractImportFieldKey, string>>;

export const CONTRACT_HOLDER_IMPORT_FIELD_KEYS = [
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
] as const;

export type ContractHolderImportFieldKey = typeof CONTRACT_HOLDER_IMPORT_FIELD_KEYS[number];
export type ContractHolderImportFields = Partial<Record<ContractHolderImportFieldKey, string>>;

export type ContractDocumentExtraction = {
  profile: ContractDocumentProfile;
  fields: ContractImportFields;
  fieldSources: Partial<Record<ContractImportFieldKey, string>>;
  holder: ContractHolderImportFields | null;
  holderCount: number;
  dependentCount: number;
  warnings: string[];
};

const profileSet = new Set<string>(CONTRACT_DOCUMENT_PROFILES);
const fieldSet = new Set<string>(CONTRACT_IMPORT_FIELD_KEYS);
const holderFieldSet = new Set<string>(CONTRACT_HOLDER_IMPORT_FIELD_KEYS);

const asNonEmptyString = (value: unknown, maxLength = 500) =>
  typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;

const asCount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(99, Math.trunc(value)));
};

const normalizeDate = (value: string) => {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;

  const brazilian = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!brazilian) return value;
  return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
};

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, ' ')
  .trim()
  .toUpperCase();

const normalizeModalidade = (value: string) => {
  const normalized = normalizeText(value);

  if (['PF', 'PESSOA FISICA', 'INDIVIDUAL', 'FAMILIAR', 'INDIVIDUAL FAMILIAR'].includes(normalized)) {
    return 'Pessoa física';
  }
  if (['ADESAO', 'COLETIVO POR ADESAO', 'COLETIVO ADESAO'].includes(normalized)) {
    return 'Adesão';
  }
  if (['PME', 'PEQUENA E MEDIA EMPRESA', 'PEQUENAS E MEDIAS EMPRESAS'].includes(normalized)) {
    return 'PME';
  }
  if (['EMPRESARIAL', 'COLETIVO EMPRESARIAL', 'EMPRESA', 'PJ', 'CNPJ'].includes(normalized)) {
    return 'Empresarial';
  }

  return value;
};

const normalizeAbrangencia = (value: string) => {
  const normalized = normalizeText(value);

  if (['NACIONAL', 'NACIONAL COM REEMBOLSO'].includes(normalized)) return 'Nacional';
  if (['ESTADUAL', 'GRUPO DE ESTADOS', 'ESTADUAL E MUNICIPAL'].includes(normalized)) return 'Estadual';
  if ([
    'REGIONAL',
    'GRUPO DE MUNICIPIOS',
    'MUNICIPAL',
    'GRUPO DE MUNICIPIOS E ESTADOS',
  ].includes(normalized)) return 'Regional';

  return value;
};

const normalizeAcomodacao = (value: string) => {
  const normalized = normalizeText(value);
  if (normalized.startsWith('ENFERMARIA')) return 'Enfermaria';
  if (normalized.startsWith('APARTAMENTO')) return 'Apartamento';
  if (normalized === 'COLETIVA') return 'Enfermaria';
  if (['PARTICULAR', 'INDIVIDUAL'].includes(normalized)) return 'Apartamento';
  return value;
};

const normalizeCarencia = (value: string) => {
  const normalized = normalizeText(value);
  if (normalized.includes('ZERADA') && normalized.includes('REDUZIDA')) return 'Zerada/Reduzida (montado)';
  if (normalized.includes('ZERADA')) return 'Zerada';
  if (normalized.includes('REDUZIDA')) return 'Reduzida';
  if (normalized.includes('PADRAO')) return 'Padrão';
  return value;
};

const removeCompanyFieldsWithoutCorporateClient = (
  fields: ContractImportFields,
  fieldSources: ContractDocumentExtraction['fieldSources'],
  warnings: string[],
) => {
  if (['Empresarial', 'PME'].includes(fields.modalidade ?? '')) return;

  const companyFieldKeys: ContractImportFieldKey[] = [
    'cnpj',
    'razao_social',
    'nome_fantasia',
    'endereco_empresa',
  ];
  const removedCompanyData = companyFieldKeys.some((key) => fields[key]);
  for (const key of companyFieldKeys) {
    delete fields[key];
    delete fieldSources[key];
  }
  if (removedCompanyData) {
    warnings.push('Os dados cadastrais da operadora ou administradora foram ignorados: este contrato não possui empresa cliente.');
  }
};

const normalizeField = (key: ContractImportFieldKey, value: string) => {
  if (key === 'data_inicio') return normalizeDate(value);
  if (key === 'modalidade') return normalizeModalidade(value);
  if (key === 'abrangencia') return normalizeAbrangencia(value);
  if (key === 'acomodacao') return normalizeAcomodacao(value);
  if (key === 'carencia') return normalizeCarencia(value);
  if (key === 'mes_reajuste') {
    const numeric = Number(value.replace(/\D/g, ''));
    return Number.isInteger(numeric) && numeric >= 1 && numeric <= 12
      ? String(numeric).padStart(2, '0')
      : value;
  }
  if (key === 'vidas') {
    const numeric = Number(value.replace(/\D/g, ''));
    return Number.isInteger(numeric) && numeric > 0 ? String(numeric) : value;
  }
  return value;
};

const applyMedSeniorRules = (
  fields: ContractImportFields,
  fieldSources: ContractDocumentExtraction['fieldSources'],
  warnings: string[],
) => {
  fields.operadora = 'MedSênior';

  const product = fields.produto_plano;
  const rjPlan = product?.match(/\bRJ\s*(\d+)\b/i);
  if (rjPlan) fields.produto_plano = `RJ${rjPlan[1]}`;

};

const parseJsonObject = (value: string): Record<string, unknown> => {
  const withoutFence = value.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed: unknown = JSON.parse(withoutFence);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('A IA não retornou um objeto JSON válido.');
  }
  return parsed as Record<string, unknown>;
};

export const parseContractDocumentExtraction = (value: string): ContractDocumentExtraction => {
  const parsed = parseJsonObject(value);
  const requestedProfile = asNonEmptyString(parsed.profile, 40)?.toLowerCase() ?? 'auto';
  const profile = profileSet.has(requestedProfile)
    ? requestedProfile as ContractDocumentProfile
    : 'auto';
  const rawFields = parsed.fields && typeof parsed.fields === 'object' && !Array.isArray(parsed.fields)
    ? parsed.fields as Record<string, unknown>
    : {};
  const rawSources = parsed.field_sources && typeof parsed.field_sources === 'object' && !Array.isArray(parsed.field_sources)
    ? parsed.field_sources as Record<string, unknown>
    : {};
  const rawHolder = parsed.holder && typeof parsed.holder === 'object' && !Array.isArray(parsed.holder)
    ? parsed.holder as Record<string, unknown>
    : {};
  const fields: ContractImportFields = {};
  const fieldSources: ContractDocumentExtraction['fieldSources'] = {};
  const holder: ContractHolderImportFields = {};

  for (const [key, rawValue] of Object.entries(rawFields)) {
    if (!fieldSet.has(key)) continue;
    const normalizedKey = key as ContractImportFieldKey;
    const normalizedValue = asNonEmptyString(rawValue);
    if (!normalizedValue) continue;
    fields[normalizedKey] = normalizeField(normalizedKey, normalizedValue);

    const source = asNonEmptyString(rawSources[key], 180);
    if (source) fieldSources[normalizedKey] = source;
  }

  for (const [key, rawValue] of Object.entries(rawHolder)) {
    if (!holderFieldSet.has(key)) continue;
    const normalizedKey = key as ContractHolderImportFieldKey;
    const normalizedValue = asNonEmptyString(rawValue);
    if (!normalizedValue) continue;
    holder[normalizedKey] = normalizedKey === 'data_nascimento'
      ? normalizeDate(normalizedValue)
      : normalizedValue;
  }

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings
      .map((warning) => asNonEmptyString(warning, 280))
      .filter((warning): warning is string => Boolean(warning))
      .slice(0, 10)
    : [];

  if (profile === 'medsenior') {
    applyMedSeniorRules(fields, fieldSources, warnings);
  }
  removeCompanyFieldsWithoutCorporateClient(fields, fieldSources, warnings);

  return {
    profile,
    fields,
    fieldSources,
    holder: Object.keys(holder).length > 0 ? holder : null,
    holderCount: asCount(parsed.holder_count),
    dependentCount: asCount(parsed.dependent_count),
    warnings,
  };
};

export const buildContractExtractionPrompt = (profile: ContractDocumentProfile) => [
  'Leia TODOS os PDFs enviados e extraia somente dados explicitamente presentes neles.',
  'Os PDFs são exemplos de propostas/contratos de planos de saúde brasileiros; não crie dados, não complete lacunas e não deduza valores.',
  `Perfil selecionado pelo usuário: ${profile}.`,
  'Perfis conhecidos: supermed (um PDF de adesão com dados cadastrais), hcommerce (Assim Saúde, Klini e outras: pode vir em dois PDFs, empresa e titulares), planium (Hapvida, Leve e outras), qualicorp e medsenior.',
  'Normalize os campos de lista antes de retornar: modalidade deve ser exatamente Empresarial, PME, Adesão ou Pessoa física; abrangencia deve ser Regional, Estadual ou Nacional; acomodacao deve ser Enfermaria ou Apartamento; carencia deve ser Padrão, Reduzida, Zerada ou Zerada/Reduzida (montado). Por exemplo, Individual vira Pessoa física e Grupo de Municípios vira Regional.',
  'Regra Qualicorp: a tabela de plano pode continuar na página seguinte. Retorne produto_plano e acomodacao somente da linha marcada com X na coluna "Assinale abaixo o plano pretendido"; nunca escolha a primeira linha, uma linha sem marcação ou uma linha de página anterior. Na Qualicorp, acomodação Coletiva significa Enfermaria e Particular ou Individual significa Apartamento.',
  'Se o perfil for auto, detecte o perfil somente se houver evidência no documento. Ao receber dois arquivos HCommerce, consolide empresa e beneficiários.',
  'Campos cnpj, razao_social, nome_fantasia e endereco_empresa são exclusivamente da empresa cliente/contratante. Nunca preencha esses campos com dados da operadora, administradora ou seguradora. Em contratos de modalidade Individual, omita todos esses campos.',
  'Regra MedSênior: use operadora como "MedSênior", nunca a razão social "SAMEDIL - SERVIÇOS DE ATENDIMENTO MÉDICO S.A.". Para o produto "MEDSÊNIOR RJ 1", retorne somente "RJ1". Para acomodação, retorne somente "Enfermaria" ou "Apartamento", sem a descrição do quarto.',
  'Extraia em holder somente o titular principal/beneficiário contratante, nunca dados da operadora, de representantes ou de dependentes. Inclua todos os dados pessoais e de contato presentes; se um dado não aparecer com clareza, omita-o. A data de nascimento deve usar YYYY-MM-DD.',
  'Use data_inicio em YYYY-MM-DD; mes_reajuste entre 01 e 12; vidas como número inteiro; mensalidade_total no formato visual do documento.',
  'Retorne SOMENTE JSON válido, sem markdown, no formato:',
  JSON.stringify({
    profile: 'auto|supermed|hcommerce|planium|qualicorp|medsenior',
    fields: {
      codigo_contrato: 'string ou omitido', modalidade: 'string ou omitido', operadora: 'string ou omitido',
      produto_plano: 'string ou omitido', abrangencia: 'string ou omitido', acomodacao: 'string ou omitido',
      data_inicio: 'YYYY-MM-DD ou omitido', mes_reajuste: '01-12 ou omitido', carencia: 'string ou omitido',
      mensalidade_total: 'string ou omitido', vidas: 'string ou omitido', cnpj: 'string ou omitido',
      razao_social: 'string ou omitido', nome_fantasia: 'string ou omitido', endereco_empresa: 'string ou omitido',
    },
    field_sources: { codigo_contrato: 'nome do arquivo e página, para cada campo extraído' },
    holder: {
      nome_completo: 'string ou omitido', cpf: 'string ou omitido', rg: 'string ou omitido',
      data_nascimento: 'YYYY-MM-DD ou omitido', sexo: 'string ou omitido', estado_civil: 'string ou omitido',
      telefone: 'string ou omitido', email: 'string ou omitido', cep: 'string ou omitido',
      endereco: 'string ou omitido', numero: 'string ou omitido', complemento: 'string ou omitido',
      bairro: 'string ou omitido', cidade: 'string ou omitido', estado: 'UF ou omitido', cns: 'string ou omitido',
    },
    holder_count: 0,
    dependent_count: 0,
    warnings: ['qualquer ambiguidade, conflito entre PDFs ou campo importante não identificado'],
  }),
].join('\n');
