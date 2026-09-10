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
