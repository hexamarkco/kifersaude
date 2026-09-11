import {
  CONTRACT_HOLDER_IMPORT_FIELD_KEYS,
  CONTRACT_IMPORT_FIELD_KEYS,
  normalizeContractDate,
  normalizeContractFieldValue,
  type ContractExtractionMethod,
  type ContractFieldProvenance,
  type ContractHolderImportFieldKey,
  type ContractImportFieldKey,
} from '../domain.ts';
import type { DeterministicExtraction } from './deterministic.ts';
import { isValidCnpj, isValidCpf } from './deterministic.ts';
import type { CandidateKey, DocumentClassification, LlmEvidenceValue } from '../engine/types.ts';

const FAMILY_FIELDS: Record<DocumentClassification['family'], ContractImportFieldKey[]> = {
  hcommerce: [...CONTRACT_IMPORT_FIELD_KEYS],
  planium: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'abrangencia', 'acomodacao', 'data_inicio', 'carencia', 'mensalidade_total', 'vidas'],
  qualicorp: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'abrangencia', 'acomodacao', 'data_inicio', 'carencia', 'mensalidade_total', 'vidas'],
  supermed: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'abrangencia', 'acomodacao', 'data_inicio', 'carencia', 'mensalidade_total', 'vidas'],
  porto: ['modalidade', 'operadora', 'produto_plano', 'abrangencia', 'acomodacao', 'data_inicio', 'mensalidade_total', 'vidas', 'cnpj', 'razao_social'],
  medsenior: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'abrangencia', 'acomodacao', 'data_inicio', 'carencia', 'mensalidade_total', 'vidas'],
  generic: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'abrangencia', 'acomodacao', 'data_inicio', 'carencia', 'mensalidade_total', 'vidas', 'cnpj', 'razao_social'],
};

const CRITICAL_FIELDS: Record<DocumentClassification['family'], ContractImportFieldKey[]> = {
  hcommerce: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'mensalidade_total', 'vidas'],
  planium: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'data_inicio', 'mensalidade_total', 'vidas'],
  qualicorp: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'data_inicio', 'mensalidade_total', 'vidas'],
  supermed: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano', 'data_inicio'],
  porto: ['modalidade', 'operadora', 'produto_plano', 'data_inicio', 'mensalidade_total', 'vidas', 'cnpj', 'razao_social'],
  medsenior: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano'],
  generic: ['codigo_contrato', 'modalidade', 'operadora', 'produto_plano'],
};

const hasResolved = (extraction: DeterministicExtraction, key: CandidateKey) => (
  Boolean(extraction.values[key]) && extraction.states[key] === 'resolved'
);

const familyOf = (classifications: DocumentClassification[]) => classifications.find((item) => item.family !== 'generic')?.family
  ?? classifications[0]?.family
  ?? 'generic';

export const getLlmFallbackScope = (
  classifications: DocumentClassification[],
  extraction: DeterministicExtraction,
) => {
  const family = familyOf(classifications);
  const roles = new Set(classifications.map((item) => item.role));
  const critical = [...CRITICAL_FIELDS[family]];
  if (family === 'hcommerce' && roles.has('company')) critical.push('cnpj', 'razao_social');
  const holderExpected = family !== 'porto' && (roles.has('beneficiaries') || ['planium', 'qualicorp', 'supermed', 'medsenior', 'generic'].includes(family));
  const criticalHolder: ContractHolderImportFieldKey[] = holderExpected ? ['nome_completo', 'cpf'] : [];
  const missingCritical = [
    ...critical.filter((key) => !hasResolved(extraction, key)),
    ...criticalHolder.filter((key) => !hasResolved(extraction, `holder.${key}`)),
  ];

  return {
    family,
    shouldUseLlm: missingCritical.length > 0,
    fallbackReason: missingCritical.length > 0 ? 'CRITICAL_FIELDS_MISSING' : null,
    fields: FAMILY_FIELDS[family].filter((key) => !hasResolved(extraction, key)),
    holderFields: holderExpected
      ? CONTRACT_HOLDER_IMPORT_FIELD_KEYS.filter((key) => !hasResolved(extraction, `holder.${key}`))
      : [],
  };
};

const evidenceSchema = (fileIds: string[], maxPage: number) => ({
  anyOf: [
    {
      type: 'object',
      properties: {
        value: { type: 'string', maxLength: 500 },
        file_id: { type: 'string', enum: fileIds },
        page: { type: 'integer', minimum: 1, maximum: Math.max(1, maxPage) },
        section: { type: 'string', maxLength: 100 },
      },
      required: ['value', 'file_id', 'page', 'section'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
});

export const buildLlmFallbackSchema = (
  fields: ContractImportFieldKey[],
  holderFields: ContractHolderImportFieldKey[],
  classifications: DocumentClassification[],
) => {
  const fileIds = classifications.map((item) => item.document.fileId);
  const maxPage = Math.max(1, ...classifications.map((item) => item.document.pages.length));
  return {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        properties: Object.fromEntries(fields.map((key) => [key, evidenceSchema(fileIds, maxPage)])),
        required: fields,
        additionalProperties: false,
      },
      holder: {
        type: 'object',
        properties: Object.fromEntries(holderFields.map((key) => [key, evidenceSchema(fileIds, maxPage)])),
        required: holderFields,
        additionalProperties: false,
      },
      warnings: {
        type: 'array',
        items: { type: 'string', maxLength: 240 },
        maxItems: 6,
      },
    },
    required: ['fields', 'holder', 'warnings'],
    additionalProperties: false,
  };
};

export const buildLlmFallbackPrompt = (params: {
  family: string;
  fields: ContractImportFieldKey[];
  holderFields: ContractHolderImportFieldKey[];
  context: string;
  vision: boolean;
  visionPageMap?: string;
}) => [
  `Família documental detectada: ${params.family}.`,
  `Resolva somente estes campos de contrato: ${params.fields.join(', ') || 'nenhum'}.`,
  `Resolva somente estes campos do titular: ${params.holderFields.join(', ') || 'nenhum'}.`,
  'Use null quando não houver evidência explícita. Não deduza, não complete e não copie dados de corretor, supervisor, operadora ou administradora para o titular/empresa.',
  'Qualicorp e Supermed são administradoras; operadora é a entidade de assistência indicada separadamente.',
  'Em Porto, número de orçamento/estudo não é número de contrato. O valor do CRM é o Valor total mensal, não subtotal, taxa ou IOF.',
  'Retorne file_id, página e seção reais de cada valor. O schema da API define a resposta.',
  params.vision
    ? `Consulte apenas as páginas dos PDFs reduzidos anexados. Ao informar a página, converta para o número original usando este mapa:\n${params.visionPageMap ?? ''}`
    : `Trechos candidatos:\n${params.context}`,
].join('\n\n');

const parseObject = (value: string) => {
  const parsed: unknown = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Saída LLM inválida.');
  return parsed as Record<string, unknown>;
};

const readEvidence = (value: unknown): LlmEvidenceValue | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.value !== 'string'
    || typeof record.file_id !== 'string'
    || typeof record.page !== 'number'
    || typeof record.section !== 'string'
  ) return null;
  return {
    value: record.value.trim(),
    file_id: record.file_id,
    page: Math.trunc(record.page),
    section: record.section.trim().slice(0, 100),
  };
};

export const parseLlmFallback = (params: {
  text: string;
  fields: ContractImportFieldKey[];
  holderFields: ContractHolderImportFieldKey[];
  classifications: DocumentClassification[];
  method: Extract<ContractExtractionMethod, 'llm_text' | 'llm_vision'>;
}) => {
  const parsed = parseObject(params.text);
  const rawFields = parsed.fields && typeof parsed.fields === 'object' && !Array.isArray(parsed.fields)
    ? parsed.fields as Record<string, unknown>
    : {};
  const rawHolder = parsed.holder && typeof parsed.holder === 'object' && !Array.isArray(parsed.holder)
    ? parsed.holder as Record<string, unknown>
    : {};
  const filePages = new Map(params.classifications.map((item) => [item.document.fileId, item.document.pages.length]));
  const values: Partial<Record<CandidateKey, string>> = {};
  const provenance: Partial<Record<CandidateKey, ContractFieldProvenance>> = {};

  const accept = (key: CandidateKey, evidence: LlmEvidenceValue | null) => {
    if (!evidence?.value || !filePages.has(evidence.file_id)) return;
    const maxPage = filePages.get(evidence.file_id) ?? 0;
    if (evidence.page < 1 || evidence.page > Math.max(1, maxPage)) return;
    if (key === 'cnpj' && !isValidCnpj(evidence.value)) return;
    if (key === 'holder.cpf' && !isValidCpf(evidence.value)) return;
    values[key] = key.startsWith('holder.')
      ? key === 'holder.data_nascimento' ? normalizeContractDate(evidence.value) : evidence.value
      : normalizeContractFieldValue(key as ContractImportFieldKey, evidence.value);
    provenance[key] = {
      fileId: evidence.file_id,
      page: evidence.page,
      section: evidence.section || 'LLM FALLBACK',
      method: params.method,
    };
  };

  params.fields.forEach((key) => accept(key, readEvidence(rawFields[key])));
  params.holderFields.forEach((key) => accept(`holder.${key}`, readEvidence(rawHolder[key])));
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 240)).filter(Boolean)
    : [];
  return { values, provenance, warnings };
};
