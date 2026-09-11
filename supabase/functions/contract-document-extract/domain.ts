export const CONTRACT_DOCUMENT_PROFILES = [
  'auto',
  'supermed',
  'hcommerce',
  'planium',
  'qualicorp',
  'medsenior',
  'porto',
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

export const CONTRACT_DOCUMENT_FAMILIES = [
  'hcommerce',
  'planium',
  'qualicorp',
  'supermed',
  'porto',
  'medsenior',
  'generic',
] as const;

export type ContractDocumentFamily = typeof CONTRACT_DOCUMENT_FAMILIES[number];
export type ContractDocumentSupportStatus = 'SUPPORTED_PROFILE' | 'GENERIC_FALLBACK' | 'UNKNOWN';
export type ContractDocumentRole = 'company' | 'beneficiaries' | 'proposal' | 'contract' | 'quote' | 'unknown';
export type ContractFieldState = 'resolved' | 'missing' | 'ambiguous' | 'conflicting';
export type ContractExtractionMethod = 'deterministic' | 'text_parser' | 'llm_text' | 'llm_vision';

export type ContractFieldProvenance = {
  fileId: string;
  page: number | null;
  section: string;
  method: ContractExtractionMethod;
};

export type ContractExtractionMetadata = {
  documentFamily: ContractDocumentFamily;
  documentType: string;
  documentRoles: ContractDocumentRole[];
  operator: string | null;
  administrator: string | null;
  supportStatus: ContractDocumentSupportStatus;
  bundleComplete: boolean | null;
  usedLlm: boolean;
  usedVision: boolean;
  cacheHit: boolean;
  sourceDocumentNumbers: {
    contractNumber: string | null;
    proposalNumber: string | null;
    quoteNumber: string | null;
    studyNumber: string | null;
  };
};

export type ContractDocumentExtraction = {
  profile: ContractDocumentProfile;
  fields: ContractImportFields;
  fieldSources: Partial<Record<ContractImportFieldKey, string>>;
  holder: ContractHolderImportFields | null;
  holderCount: number;
  dependentCount: number;
  warnings: string[];
  fieldProvenance: Record<string, ContractFieldProvenance>;
  fieldStates: Record<string, ContractFieldState>;
  metadata: ContractExtractionMetadata;
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

export const normalizeContractFieldValue = normalizeField;
export const normalizeContractDate = normalizeDate;
