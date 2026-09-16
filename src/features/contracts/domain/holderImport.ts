import type { ContractHolder } from './types';

export type ContractHolderImportPayload = Pick<
  ContractHolder,
  'nome_completo' | 'cpf' | 'data_nascimento' | 'telefone'
> & Partial<Pick<
  ContractHolder,
  | 'rg'
  | 'sexo'
  | 'estado_civil'
  | 'email'
  | 'cep'
  | 'endereco'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'cidade'
  | 'estado'
  | 'cns'
  | 'cnpj'
  | 'razao_social'
  | 'nome_fantasia'
  | 'percentual_societario'
  | 'data_abertura_cnpj'
  | 'bonus_por_vida_aplicado'
>>;

export type CreateContractHolderImportInput = {
  contract_id: string;
  lead_id?: string | null;
  holder: ContractHolderImportPayload;
};

export type ContractHolderImportResult = {
  success: true;
  import_id: string;
  expires_at: string;
};
