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

export type ContractDocumentExtraction = {
  profile: ContractDocumentProfile;
  fields: ContractImportFields;
  fieldSources: Partial<Record<ContractImportFieldKey, string>>;
  holderCount: number;
  dependentCount: number;
  warnings: string[];
};

const profileSet = new Set<string>(CONTRACT_DOCUMENT_PROFILES);
const fieldSet = new Set<string>(CONTRACT_IMPORT_FIELD_KEYS);

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

const normalizeField = (key: ContractImportFieldKey, value: string) => {
  if (key === 'data_inicio') return normalizeDate(value);
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

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const applyMedSeniorRules = (
  fields: ContractImportFields,
  fieldSources: ContractDocumentExtraction['fieldSources'],
  warnings: string[],
) => {
  fields.operadora = 'MedSênior';

  const product = fields.produto_plano;
  const rjPlan = product?.match(/\bRJ\s*(\d+)\b/i);
  if (rjPlan) fields.produto_plano = `RJ${rjPlan[1]}`;

  const accommodation = fields.acomodacao;
  if (accommodation) {
    const normalizedAccommodation = normalizeText(accommodation);
    if (normalizedAccommodation.startsWith('ENFERMARIA')) fields.acomodacao = 'Enfermaria';
    if (normalizedAccommodation.startsWith('APARTAMENTO')) fields.acomodacao = 'Apartamento';
  }

  if (normalizeText(fields.modalidade ?? '') !== 'INDIVIDUAL') return;

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
    warnings.push('Os dados cadastrais da operadora foram ignorados: este é um contrato individual e não possui dados empresariais do cliente.');
  }
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
  const fields: ContractImportFields = {};
  const fieldSources: ContractDocumentExtraction['fieldSources'] = {};

  for (const [key, rawValue] of Object.entries(rawFields)) {
    if (!fieldSet.has(key)) continue;
    const normalizedKey = key as ContractImportFieldKey;
    const normalizedValue = asNonEmptyString(rawValue);
    if (!normalizedValue) continue;
    fields[normalizedKey] = normalizeField(normalizedKey, normalizedValue);

    const source = asNonEmptyString(rawSources[key], 180);
    if (source) fieldSources[normalizedKey] = source;
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

  return {
    profile,
    fields,
    fieldSources,
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
  'Se o perfil for auto, detecte o perfil somente se houver evidência no documento. Ao receber dois arquivos HCommerce, consolide empresa e beneficiários.',
  'Campos cnpj, razao_social, nome_fantasia e endereco_empresa são exclusivamente da empresa cliente/contratante. Nunca preencha esses campos com dados da operadora, administradora ou seguradora. Em contratos de modalidade Individual, omita todos esses campos.',
  'Regra MedSênior: use operadora como "MedSênior", nunca a razão social "SAMEDIL - SERVIÇOS DE ATENDIMENTO MÉDICO S.A.". Para o produto "MEDSÊNIOR RJ 1", retorne somente "RJ1". Para acomodação, retorne somente "Enfermaria" ou "Apartamento", sem a descrição do quarto.',
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
    holder_count: 0,
    dependent_count: 0,
    warnings: ['qualquer ambiguidade, conflito entre PDFs ou campo importante não identificado'],
  }),
].join('\n');
