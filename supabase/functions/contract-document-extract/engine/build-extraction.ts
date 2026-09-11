import {
  CONTRACT_HOLDER_IMPORT_FIELD_KEYS,
  CONTRACT_IMPORT_FIELD_KEYS,
  type ContractDocumentExtraction,
  type ContractDocumentFamily,
  type ContractDocumentProfile,
  type ContractFieldProvenance,
  type ContractFieldState,
  type ContractHolderImportFields,
  type ContractImportFields,
} from '../domain.ts';
import type { DeterministicExtraction } from '../extraction/deterministic.ts';
import type { CandidateKey, DocumentClassification } from './types.ts';

type LlmPatch = {
  values: Partial<Record<CandidateKey, string>>;
  provenance: Partial<Record<CandidateKey, ContractFieldProvenance>>;
  warnings: string[];
};

const familyFrom = (classifications: DocumentClassification[]): ContractDocumentFamily => (
  classifications.find((item) => item.family !== 'generic')?.family
  ?? classifications[0]?.family
  ?? 'generic'
);

const uniqueNonEmpty = (values: Array<string | null>) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const readSourceNumbers = (classifications: DocumentClassification[], fields: ContractImportFields) => {
  const family = familyFrom(classifications);
  const allText = classifications.flatMap((item) => item.document.pages.map((page) => page.text)).join('\n').replace(/\s+/g, ' ');
  const quoteNumber = family === 'porto'
    ? allText.match(/Or.amento\s*:?\s*(\d{5,})/i)?.[1] ?? null
    : null;
  const studyNumber = family === 'porto'
    ? allText.match(/N.mero e validade do estudo\s+(\d{5,})/i)?.[1] ?? null
    : null;
  return {
    contractNumber: family === 'medsenior' ? fields.codigo_contrato ?? null : null,
    proposalNumber: ['hcommerce', 'planium', 'qualicorp', 'supermed'].includes(family)
      ? fields.codigo_contrato ?? null
      : null,
    quoteNumber,
    studyNumber,
  };
};

const profileFromFamily = (family: ContractDocumentFamily): ContractDocumentProfile => family === 'generic'
  ? 'auto'
  : family;

export const buildContractDocumentExtraction = (params: {
  classifications: DocumentClassification[];
  deterministic: DeterministicExtraction;
  llmPatch?: LlmPatch | null;
  usedLlm: boolean;
  usedVision: boolean;
  cacheHit?: boolean;
}): ContractDocumentExtraction => {
  const family = familyFrom(params.classifications);
  const combinedValues = { ...params.deterministic.values };
  const combinedProvenance = { ...params.deterministic.provenance };
  for (const [key, value] of Object.entries(params.llmPatch?.values ?? {})) {
    if (!value || combinedValues[key as CandidateKey]) continue;
    combinedValues[key as CandidateKey] = value;
    const source = params.llmPatch?.provenance[key as CandidateKey];
    if (source) combinedProvenance[key as CandidateKey] = source;
  }

  const fields: ContractImportFields = {};
  const holder: ContractHolderImportFields = {};
  const fieldSources: ContractDocumentExtraction['fieldSources'] = {};
  const fieldProvenance: Record<string, ContractFieldProvenance> = {};
  const fieldStates: Record<string, ContractFieldState> = {};

  for (const key of CONTRACT_IMPORT_FIELD_KEYS) {
    const value = combinedValues[key];
    if (value) fields[key] = value;
    const source = combinedProvenance[key];
    if (source) {
      fieldProvenance[key] = source;
      fieldSources[key] = `${source.fileId}, página ${source.page ?? '?'} — ${source.section}`;
    }
    fieldStates[key] = value ? 'resolved' : params.deterministic.states[key] ?? 'missing';
  }
  for (const key of CONTRACT_HOLDER_IMPORT_FIELD_KEYS) {
    const candidateKey = `holder.${key}` as const;
    const value = combinedValues[candidateKey];
    if (value) holder[key] = value;
    const source = combinedProvenance[candidateKey];
    if (source) fieldProvenance[candidateKey] = source;
    fieldStates[candidateKey] = value ? 'resolved' : params.deterministic.states[candidateKey] ?? 'missing';
  }

  if (family === 'medsenior') {
    fields.operadora = 'MedSênior';
    const medSeniorPlan = fields.produto_plano?.match(/\bRJ\s*(\d+)\b/i);
    if (medSeniorPlan) fields.produto_plano = `RJ${medSeniorPlan[1]}`;
  }

  if (!['Empresarial', 'PME'].includes(fields.modalidade ?? '')) {
    for (const key of ['cnpj', 'razao_social', 'nome_fantasia', 'endereco_empresa'] as const) {
      delete fields[key];
      delete fieldSources[key];
      delete fieldProvenance[key];
      fieldStates[key] = 'missing';
    }
  }

  const roles = Array.from(new Set(params.classifications.map((item) => item.role)));
  const operators = uniqueNonEmpty(params.classifications.map((item) => item.operator));
  const administrators = uniqueNonEmpty(params.classifications.map((item) => item.administrator));
  const hcommerceDocuments = params.classifications.filter((item) => item.family === 'hcommerce');
  const hcommerceKeys = uniqueNonEmpty(hcommerceDocuments.map((item) => item.bundleKey));
  const bundleComplete = family === 'hcommerce'
    ? roles.includes('company')
      && roles.includes('beneficiaries')
      && hcommerceKeys.length === 1
      && hcommerceDocuments.every((item) => item.bundleKey === hcommerceKeys[0])
    : null;
  const supportStatus = params.classifications.some((item) => item.supportStatus === 'UNKNOWN')
    ? 'UNKNOWN'
    : params.classifications.some((item) => item.supportStatus === 'GENERIC_FALLBACK')
      ? 'GENERIC_FALLBACK'
      : 'SUPPORTED_PROFILE';
  const warnings = [
    ...params.deterministic.warnings,
    ...(params.llmPatch?.warnings ?? []),
  ];
  if (family === 'hcommerce' && !bundleComplete) {
    warnings.push('Bundle HCommerce incompleto: envie os PDFs de empresa e beneficiários da mesma proposta para preencher todos os campos.');
  }
  if (supportStatus === 'GENERIC_FALLBACK') {
    warnings.push('O operador foi reconhecido, mas o formato do documento não possui parser específico; revise todos os campos sugeridos.');
  }
  if (supportStatus === 'UNKNOWN') {
    warnings.push('O formato do documento não foi reconhecido; revise todos os campos sugeridos antes de aplicar.');
  }
  if (params.classifications.some((item) => item.document.extractionError)) {
    warnings.push('A camada textual de ao menos um PDF não pôde ser lida integralmente; a revisão manual é necessária.');
  }

  const resolvedHolder = Object.keys(holder).length > 0 ? holder : null;
  const holderCount = resolvedHolder ? Math.max(1, params.deterministic.holderCount) : 0;
  const lives = Number(fields.vidas);
  const dependentCount = params.deterministic.dependentCount > 0
    ? params.deterministic.dependentCount
    : holderCount > 0 && Number.isInteger(lives) ? Math.max(0, lives - holderCount) : 0;

  return {
    profile: profileFromFamily(family),
    fields,
    fieldSources,
    holder: resolvedHolder,
    holderCount,
    dependentCount,
    warnings: Array.from(new Set(warnings)).slice(0, 10),
    fieldProvenance,
    fieldStates,
    metadata: {
      documentFamily: family,
      documentType: params.classifications.find((item) => item.family === family)?.documentType ?? 'unknown',
      documentRoles: roles.length > 0 ? roles : ['unknown'],
      operator: fields.operadora ?? operators[0] ?? null,
      administrator: administrators[0] ?? null,
      supportStatus,
      bundleComplete,
      usedLlm: params.usedLlm,
      usedVision: params.usedVision,
      cacheHit: params.cacheHit ?? false,
      sourceDocumentNumbers: readSourceNumbers(params.classifications, fields),
    },
  };
};
