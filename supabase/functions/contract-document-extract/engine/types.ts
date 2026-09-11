import type {
  ContractDocumentFamily,
  ContractDocumentRole,
  ContractDocumentSupportStatus,
  ContractExtractionMethod,
  ContractFieldProvenance,
  ContractFieldState,
  ContractHolderImportFieldKey,
  ContractImportFieldKey,
} from '../domain.ts';

export type TextQuality = 'good' | 'partial' | 'poor' | 'none';

export type PdfPage = {
  page: number;
  text: string;
  characterCount: number;
};

export type ParsedPdfDocument = {
  fileId: string;
  fileName: string;
  hash: string;
  bytes: Uint8Array;
  pages: PdfPage[];
  textQuality: TextQuality;
  extractionError: string | null;
};

export type DocumentClassification = {
  document: ParsedPdfDocument;
  family: ContractDocumentFamily;
  documentType: string;
  role: ContractDocumentRole;
  operator: string | null;
  administrator: string | null;
  supportStatus: ContractDocumentSupportStatus;
  bundleKey: string | null;
};

export type SelectedPage = {
  document: ParsedPdfDocument;
  page: PdfPage;
  score: number;
  section: string;
};

export type CandidateKey = ContractImportFieldKey | `holder.${ContractHolderImportFieldKey}`;

export type FieldCandidate = {
  key: CandidateKey;
  value: string;
  priority: number;
  provenance: ContractFieldProvenance;
};

export type ResolvedCandidates = {
  values: Partial<Record<CandidateKey, string>>;
  provenance: Partial<Record<CandidateKey, ContractFieldProvenance>>;
  states: Partial<Record<CandidateKey, ContractFieldState>>;
  conflicts: CandidateKey[];
};

export type LlmEvidenceValue = {
  value: string;
  file_id: string;
  page: number;
  section: string;
};

export const provenance = (
  fileId: string,
  page: number | null,
  section: string,
  method: ContractExtractionMethod = 'text_parser',
): ContractFieldProvenance => ({ fileId, page, section, method });
