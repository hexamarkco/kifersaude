import { databaseClient } from '../../../infrastructure/supabase';
import type {
  ContractDocumentExtraction,
  ContractDocumentProfile,
} from '../domain/contractDocumentImport';

const MAX_DOCUMENTS = 4;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 28 * 1024 * 1024;

export const validateContractImportFiles = (files: File[]) => {
  if (files.length === 0) return 'Selecione ao menos um PDF.';
  if (files.length > MAX_DOCUMENTS) return `Selecione no máximo ${MAX_DOCUMENTS} PDFs.`;
  if (files.some((file) => file.size > MAX_FILE_BYTES)) {
    return 'Cada PDF pode ter no máximo 16 MB.';
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
    return 'Os PDFs podem somar no máximo 28 MB.';
  }
  if (files.some((file) => !file.name.toLowerCase().endsWith('.pdf'))) {
    return 'Selecione apenas arquivos PDF.';
  }
  return null;
};

export async function extractContractDocumentData(input: {
  files: File[];
  profile: ContractDocumentProfile;
}): Promise<ContractDocumentExtraction> {
  const validationError = validateContractImportFiles(input.files);
  if (validationError) throw new Error(validationError);

  const body = new FormData();
  body.append('profile', input.profile);
  input.files.forEach((file) => body.append('documents', file, file.name));

  const { data, error } = await databaseClient.functions.invoke<{
    extraction?: ContractDocumentExtraction;
    error?: string;
  }>('contract-document-extract', { body });

  if (error) throw error;
  if (!data?.extraction) {
    throw new Error(data?.error || 'A IA não retornou dados para preencher o contrato.');
  }
  return data.extraction;
}
