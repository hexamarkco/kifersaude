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

export type ContractDocumentFamily =
  | 'hcommerce'
  | 'planium'
  | 'qualicorp'
  | 'supermed'
  | 'porto'
  | 'medsenior'
  | 'generic';
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
  metadata: {
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
};
