import { databaseClient } from '../../../infrastructure/supabase';
import type {
  ContractHolderImportResult,
  CreateContractHolderImportInput,
} from '../domain/holderImport';

const SAFE_ERROR_MESSAGE = 'Não foi possível preparar o titular para importação.';
const PUBLIC_ERROR_MESSAGES = new Set([
  'Usuário sem permissão para preparar titulares.',
  'Contrato não encontrado.',
  'Este contrato já possui titular.',
  'O titular não corresponde ao contrato informado.',
  'Revise os dados informados para o titular.',
  'Preencha os campos obrigatórios do titular.',
  'Já existe um titular com esses dados.',
]);

export async function createContractHolderImport(
  input: CreateContractHolderImportInput,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<ContractHolderImportResult> {
  const { data, error } = await databaseClient.functions.invoke<ContractHolderImportResult & {
    message?: string;
    success?: boolean;
  }>('contract-holder-imports', {
    body: input,
    headers: { 'X-Idempotency-Key': idempotencyKey },
  });

  if (error || !data || data.success !== true || !data.import_id || !data.expires_at) {
    const publicMessage = typeof data?.message === 'string' && PUBLIC_ERROR_MESSAGES.has(data.message)
      ? data.message
      : SAFE_ERROR_MESSAGE;
    throw new Error(publicMessage);
  }

  return {
    success: true,
    import_id: data.import_id,
    expires_at: data.expires_at,
  };
}
