import {
  normalizeContractFieldValue,
  type ContractExtractionMethod,
  type ContractHolderImportFieldKey,
  type ContractImportFieldKey,
} from '../domain.ts';
import type {
  CandidateKey,
  DocumentClassification,
  FieldCandidate,
  ParsedPdfDocument,
  ResolvedCandidates,
} from '../engine/types.ts';
import { normalizedDocumentText, selectCandidatePages } from '../engine/analyze-documents.ts';
import { provenance } from '../engine/types.ts';

export type DeterministicExtraction = ResolvedCandidates & {
  holderCount: number;
  dependentCount: number;
  warnings: string[];
};

const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
const comparable = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '')
  .toUpperCase();

const searchable = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, ' ')
  .trim()
  .toUpperCase();

const qualicorpProductName = (value: string) => compact(value)
  .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, '')
  .replace(/\s+(?:QC|QP|ADES[ÃA]O|REFER[ÊE]NCIA)\b[\s\S]*$/i, '')
  .trim();

const pageWith = (document: ParsedPdfDocument, pattern: RegExp) => document.pages.find((page) => pattern.test(page.text));

const firstMatch = (value: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = compact(value).match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && candidate !== '-' && candidate.toLowerCase() !== 'undefined') return candidate;
  }
  return null;
};

const digits = (value: string) => value.replace(/\D/g, '');

const validatesDocument = (value: string, expectedLength: 11 | 14) => {
  const normalized = digits(value);
  if (normalized.length !== expectedLength || /^(\d)\1+$/.test(normalized)) return false;
  const bodyLength = expectedLength - 2;
  const calculateDigit = (body: string) => {
    let factor = body.length === 9 ? 10 : body.length === 10 ? 11 : body.length === 12 ? 5 : 6;
    const sum = [...body].reduce((total, char) => {
      const subtotal = total + Number(char) * factor;
      factor -= 1;
      if (factor === 1) factor = 9;
      return subtotal;
    }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculateDigit(normalized.slice(0, bodyLength));
  const second = calculateDigit(normalized.slice(0, bodyLength + 1));
  return normalized.endsWith(`${first}${second}`);
};

export const isValidCpf = (value: string) => validatesDocument(value, 11);
export const isValidCnpj = (value: string) => validatesDocument(value, 14);

const addCandidate = (
  output: FieldCandidate[],
  key: CandidateKey,
  value: string | null,
  classification: DocumentClassification,
  page: number | null,
  section: string,
  priority = 80,
  method: ContractExtractionMethod = 'text_parser',
) => {
  if (!value?.trim()) return;
  const normalized = key.startsWith('holder.')
    ? value.trim()
    : normalizeContractFieldValue(key as ContractImportFieldKey, value.trim());
  output.push({
    key,
    value: normalized,
    priority,
    provenance: provenance(classification.document.fileId, page, section, method),
  });
};

const addFieldMatch = (
  output: FieldCandidate[],
  classification: DocumentClassification,
  key: ContractImportFieldKey,
  patterns: RegExp[],
  section: string,
  priority = 80,
) => {
  for (const page of classification.document.pages) {
    const match = firstMatch(page.text, patterns);
    if (!match) continue;
    addCandidate(output, key, match, classification, page.page, section, priority);
    return;
  }
};

const addHolderMatch = (
  output: FieldCandidate[],
  classification: DocumentClassification,
  key: ContractHolderImportFieldKey,
  text: string,
  page: number,
  patterns: RegExp[],
  validate?: (value: string) => boolean,
) => {
  const value = firstMatch(text, patterns);
  if (!value || (validate && !validate(value))) return;
  addCandidate(output, `holder.${key}`, value, classification, page, 'TITULAR', 90);
};

const holderPageFor = (classification: DocumentClassification) => {
  const patterns: Record<DocumentClassification['family'], RegExp> = {
    hcommerce: /DADOS DO BENEFICI.RIO TITULAR/i,
    planium: /Dados cadastrais do Contratante/i,
    qualicorp: /PROPONENTE TITULAR/i,
    supermed: /Benefici.rio Titular/i,
    medsenior: /PROPOSTA DE ADES.O|Contrato n[ºo]/i,
    porto: /(?!)/,
    generic: /BENEFICI.RIO TITULAR|PROPONENTE TITULAR|DADOS CADASTRAIS DO CONTRATANTE/i,
  };
  return pageWith(classification.document, patterns[classification.family]);
};

const extractHolder = (output: FieldCandidate[], classification: DocumentClassification) => {
  const page = holderPageFor(classification);
  if (!page || classification.family === 'porto') return;
  const text = compact(page.text);
  const stop = '(?=\\s+(?:CPF|RG|Data de Nascimento|Sexo|Estado Civil|Nome da Mãe|Telefone|Celular|E-mail|CEP|Endereço|Logradouro|$))';
  addHolderMatch(output, classification, 'nome_completo', text, page.page, [
    new RegExp(`(?:Nome Completo|Nome)\\s*:?\\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{4,100}?)${stop}`, 'i'),
  ]);
  addHolderMatch(output, classification, 'cpf', text, page.page, [
    /\bCPF\s*:?\s*([0-9./-]{11,18})/i,
  ], isValidCpf);
  addHolderMatch(output, classification, 'rg', text, page.page, [
    /\b(?:N[ºo]\s*do\s*)?RG(?:\/CNH)?\s*:?\s*([A-Za-z0-9./-]{4,24})/i,
  ]);
  addHolderMatch(output, classification, 'data_nascimento', text, page.page, [
    /Data de [Nn]ascimento\s*:?\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
  ]);
  addHolderMatch(output, classification, 'sexo', text, page.page, [
    /(?:Sexo(?: Biol.gico)?)\s*:?\s*(Feminino|Masculino|F|M)\b/i,
  ]);
  addHolderMatch(output, classification, 'estado_civil', text, page.page, [
    /Estado [Cc]ivil\s*:?\s*([A-Za-zÀ-ÿ()]{4,24})/i,
  ]);
  addHolderMatch(output, classification, 'telefone', text, page.page, [
    /(?:Telefone de Contato|DDD\s*\+\s*(?:Telefone|Whatsapp)|Celular)\s*:?\s*(\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}|\d{10,11})/i,
  ]);
  addHolderMatch(output, classification, 'email', text, page.page, [
    /E-?mail\s*:?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ]);
  addHolderMatch(output, classification, 'cep', text, page.page, [
    /\bCEP\s*:?\s*(\d{5}[-.]?\d{3})/i,
  ]);
  addHolderMatch(output, classification, 'cns', text, page.page, [
    /(?:Cart.o Nacional de Sa.de|CNS)\s*:?\s*(\d{15})/i,
  ]);
  addHolderMatch(output, classification, 'endereco', text, page.page, [
    /(?:Endere.o|Logradouro)\s*:?\s*([^\n]{4,120}?)(?=\s+(?:CEP|N.mero|Complemento|Bairro|Cidade|Munic.pio|UF|CPF|$))/i,
  ]);
  addHolderMatch(output, classification, 'numero', text, page.page, [
    /\bN.mero\s*:?\s*([A-Za-z0-9/-]{1,12})/i,
  ]);
  addHolderMatch(output, classification, 'complemento', text, page.page, [
    /Complemento\s*:?\s*([^\n]{1,40}?)(?=\s+(?:Bairro|Cidade|Munic.pio|Estado|UF|$))/i,
  ]);
  addHolderMatch(output, classification, 'bairro', text, page.page, [
    /Bairro\s*:?\s*([A-Za-zÀ-ÿ .'-]{2,50}?)(?=\s+(?:Cidade|Munic.pio|Estado|UF|$))/i,
  ]);
  addHolderMatch(output, classification, 'cidade', text, page.page, [
    /(?:Cidade|Munic.pio)\s*(?:\/\s*UF)?\s*:?\s*([A-Za-zÀ-ÿ .'-]{2,50}?)(?=\s*(?:\/|Estado|UF|$))/i,
  ]);
  addHolderMatch(output, classification, 'estado', text, page.page, [
    /(?:Estado|UF)\s*:?\s*([A-Z]{2})\b/i,
  ]);
};

const extractCompany = (output: FieldCandidate[], classification: DocumentClassification) => {
  if (!['hcommerce', 'porto'].includes(classification.family)) return;
  const page = classification.family === 'hcommerce'
    ? pageWith(classification.document, /EMPRESA CONTRATANTE/i)
    : pageWith(classification.document, /Estipulante|Dados da Empresa/i);
  if (!page) return;
  const text = compact(page.text);
  const cnpj = firstMatch(text, [/\bCNPJ\s*:?\s*([0-9./-]{14,20})/i]);
  if (cnpj && isValidCnpj(cnpj)) addCandidate(output, 'cnpj', cnpj, classification, page.page, 'EMPRESA', 100);
  addCandidate(output, 'razao_social', firstMatch(text, [
    /Raz.o [Ss]ocial\s*:?\s*(.{3,120}?)(?=\s+(?:Nome fantasia|CNAE|Tipo da empresa|Telefone|Inscri..o|$))/i,
    /Empresa\s+(.{3,120}?)\s+CNPJ\b/i,
  ]), classification, page.page, 'EMPRESA', 90);
  if (classification.family === 'hcommerce') {
    addCandidate(output, 'nome_fantasia', firstMatch(text, [
      /Nome fantasia\s*:?\s*(.{2,100}?)(?=\s+(?:CNAE|Telefone|Inscri..o|$))/i,
    ]), classification, page.page, 'EMPRESA', 80);
    const address = firstMatch(text, [
      /ENDERE.O DE FATURAMENTO\s+CEP\s*:?\s*[0-9.-]+\s+Endere.o\s*:?\s*(.{5,160}?)(?=\s+Cidade\s*\/\s*UF|ENDERE.O DE CORRESPOND.NCIA)/i,
    ]);
    addCandidate(output, 'endereco_empresa', address, classification, page.page, 'ENDEREÇO DE FATURAMENTO', 90);
  }
};

const extractQualicorpSelectedPlan = (
  output: FieldCandidate[],
  classification: DocumentClassification,
) => {
  if (classification.family !== 'qualicorp') return;
  for (const page of classification.document.pages) {
    if (!searchable(page.text).includes('PLANO PRETENDIDO')) continue;
    const items = page.items ?? [];
    const selectionMarks = items.filter((item) => searchable(item.text) === 'X' && item.x < 120);
    for (const mark of selectionMarks) {
      const rowItems = items.filter((item) => item !== mark && Math.abs(item.y - mark.y) <= 22);
      const columnValue = (minimumOffset: number, maximumOffset = Number.POSITIVE_INFINITY) => compact(rowItems
        .filter((item) => item.x >= mark.x + minimumOffset && item.x < mark.x + maximumOffset)
        .sort((left, right) => right.y - left.y || left.x - right.x)
        .map((item) => item.text)
        .join(' '));
      const product = qualicorpProductName(columnValue(80, 236));
      const accommodationText = searchable(columnValue(340, 440));
      const coverageText = searchable(columnValue(440));
      if (!product) continue;
      addCandidate(
        output,
        'produto_plano',
        product,
        classification,
        page.page,
        'PLANO PRETENDIDO — LINHA MARCADA',
        130,
      );
      if (accommodationText.includes('COLETIVA')) {
        addCandidate(output, 'acomodacao', 'Coletiva', classification, page.page, 'PLANO PRETENDIDO — LINHA MARCADA', 130);
      } else if (accommodationText.includes('INDIVIDUAL') || accommodationText.includes('PARTICULAR')) {
        addCandidate(output, 'acomodacao', 'Individual', classification, page.page, 'PLANO PRETENDIDO — LINHA MARCADA', 130);
      }
      if (/GRUPO\s+DE\s+MUNICIPIOS/.test(coverageText)) {
        addCandidate(output, 'abrangencia', 'Grupo de Municípios', classification, page.page, 'PLANO PRETENDIDO — LINHA MARCADA', 130);
      } else if (coverageText.includes('ESTADUAL')) {
        addCandidate(output, 'abrangencia', 'Estadual', classification, page.page, 'PLANO PRETENDIDO — LINHA MARCADA', 130);
      } else if (coverageText.includes('NACIONAL')) {
        addCandidate(output, 'abrangencia', 'Nacional', classification, page.page, 'PLANO PRETENDIDO — LINHA MARCADA', 130);
      }
      return;
    }
  }
};

const fixedFields = (output: FieldCandidate[], classification: DocumentClassification) => {
  if (classification.operator) {
    addCandidate(output, 'operadora', classification.operator, classification, null, 'DETECÇÃO DO DOCUMENTO', 100, 'deterministic');
  }
  const modality = ({
    hcommerce: 'Empresarial',
    planium: 'Pessoa física',
    qualicorp: 'Adesão',
    supermed: 'Adesão',
    porto: 'PME',
    medsenior: 'Pessoa física',
    generic: null,
  } as const)[classification.family];
  if (modality) addCandidate(output, 'modalidade', modality, classification, null, 'TIPO DOCUMENTAL', 100, 'deterministic');
  if (classification.family === 'medsenior') {
    addCandidate(output, 'operadora', 'MedSênior', classification, null, 'MARCA DO DOCUMENTO', 120, 'deterministic');
  }
};

const extractContractFields = (output: FieldCandidate[], classification: DocumentClassification) => {
  const text = normalizedDocumentText(classification.document);
  if (classification.family !== 'porto') {
    const codePatterns = classification.family === 'hcommerce'
      ? [/\b(PJ\s*\d{5,})\b/i]
      : classification.family === 'medsenior'
        ? [/(?:Contrato\s*n[ºo]?|N[ºo]\s*Contrato)\s*:?\s*(\d{5,})/i]
        : [/(?:Proposta\s*n[ºo]?|N[ºo]\s*da\s*Proposta)\s*:?\s*(\d{5,})/i];
    addFieldMatch(output, classification, 'codigo_contrato', codePatterns, 'IDENTIFICAÇÃO', 110);
  }

  const patternsByFamily: Partial<Record<DocumentClassification['family'], Partial<Record<ContractImportFieldKey, RegExp[]>>>> = {
    hcommerce: {
      produto_plano: [/Plano\s*:?\s*(.{2,120}?)(?=\s+(?:C.digo ANS|Cobertura|Fator moderador|Acomoda..o))/i],
      abrangencia: [/Abrang.ncia geogr.fica\s*:?\s*(.{3,70}?)(?=\s+(?:.rea de atua..o|Servi.os adicionais|Acomoda..o|$))/i],
      acomodacao: [/Acomoda..o\s*:?\s*(ENFERMARIA|APARTAMENTO|COLETIVA|INDIVIDUAL)/i],
      carencia: [/Condi..o de car.ncia\s*:?\s*(.{3,100}?)(?=\s+(?:Profiss.o|Total de dependentes|$))/i],
      mensalidade_total: [/Valor do (?:Plano|plano) [Cc]ontratado(?:\s+EMP\d+)?\s*:?\s*R?\$?\s*([\d.,]+)/i],
    },
    planium: {
      produto_plano: [/Resumo da contrata..o[\s\S]{0,1000}?Plano\s*:?\s*(.{2,130}?)(?=\s+(?:Registro ANS|Acomoda..o|Coparticipa..o|Abrang.ncia))/i],
      abrangencia: [/Abrang.ncia\s*:?\s*(.{3,60}?)(?=\s+(?:Coparticipa..o|Benefici.rios|Valor Total|$))/i],
      acomodacao: [/Acomoda..o\s*:?\s*(ENFERMARIA|APARTAMENTO|COLETIVA|INDIVIDUAL)/i],
      data_inicio: [/Data de Vig.ncia\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i],
      mensalidade_total: [/Valor Total\s*:?\s*R?\$?\s*([\d.,]+)/i],
      vidas: [/Benefici.rios\s*:?\s*(\d{1,2})\b/i],
    },
    qualicorp: {
      data_inicio: [/In.cio da vig.ncia do benef.cio\s*:?\s*(\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4})/i],
      mensalidade_total: [/Valor total em R\$\s*:?\s*([\d.,]+)/i],
    },
    supermed: {
      produto_plano: [/Nome do Plano de Sa.de escolhido[\s\S]{0,160}?([A-Z][A-Z0-9 ]{8,120}?)(?=\s+\d{6,}|\s+Parcial|\s+Total)/i],
      abrangencia: [/Nome do Plano de Sa.de escolhido[\s\S]{0,1200}?\b(Grupo de Munic.pios|Estadual|Nacional)\b/i],
      acomodacao: [/Nome do Plano de Sa.de escolhido[\s\S]{0,1200}?\b(Coletivo|Individual)\b/i],
      data_inicio: [/\bVig.ncia\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i],
    },
    porto: {
      produto_plano: [/Resumo\s+([A-Z][A-Z0-9 ]{3,80}?)(?=\s+R\$\s*[\d.,]+|\s+\d+\s+vidas)/i],
      abrangencia: [/\b(Regional|Estadual|Nacional)\b/i],
      acomodacao: [/\b(Enfermaria|Apartamento)\b/i],
      data_inicio: [/Data de vig.ncia\s+(\d{2}\/\d{2}\/\d{4})/i],
      mensalidade_total: [/Valor total mensal para\s+\d+\s+vidas\s*:?\s*R?\$?\s*([\d.,]+)/i],
      vidas: [/Valor total mensal para\s+(\d+)\s+vidas/i],
    },
    medsenior: {
      produto_plano: [/Nome do Plano\s*:?\s*(MEDS.NIOR\s+RJ\s*\d+)/i],
      abrangencia: [/AREA GEOGR.FICA DE ABRANG.NCIA DO PLANO DE SA.DE\s+(Grupo de Munic.pios|Estadual|Nacional)/i],
      acomodacao: [/PADR.O DE ACOMODA..O EM INTERNA..O[\s\S]{0,160}?\b(ENFERMARIA|APARTAMENTO|COLETIV[AO]|INDIVIDUAL)\b/i],
    },
  };

  for (const [key, patterns] of Object.entries(patternsByFamily[classification.family] ?? {})) {
    addFieldMatch(output, classification, key as ContractImportFieldKey, patterns!, key.replace(/_/g, ' ').toUpperCase(), 90);
  }

  if (classification.family === 'hcommerce') {
    const dependentMatch = compact(text).match(/Total de dependentes\s*:?\s*(\d{1,2})/i);
    if (dependentMatch) {
      addCandidate(output, 'vidas', String(Number(dependentMatch[1]) + 1), classification, null, 'BENEFICIÁRIOS', 100, 'deterministic');
    }
  }
  if (classification.family === 'medsenior') {
    addCandidate(output, 'vidas', '1', classification, null, 'CONTRATO INDIVIDUAL', 80, 'deterministic');
  }
};

export const resolveFieldCandidates = (candidates: FieldCandidate[]): ResolvedCandidates => {
  const values: ResolvedCandidates['values'] = {};
  const resolvedProvenance: ResolvedCandidates['provenance'] = {};
  const states: ResolvedCandidates['states'] = {};
  const conflicts: CandidateKey[] = [];
  const keys = new Set(candidates.map((candidate) => candidate.key));

  for (const key of keys) {
    const fieldCandidates = candidates.filter((candidate) => candidate.key === key)
      .sort((left, right) => right.priority - left.priority);
    const bestPriority = fieldCandidates[0].priority;
    const best = fieldCandidates.filter((candidate) => candidate.priority === bestPriority);
    const bestValues = new Set(best.map((candidate) => comparable(candidate.value)));
    const allValues = new Set(fieldCandidates.map((candidate) => comparable(candidate.value)));
    if (bestValues.size > 1) {
      states[key] = 'conflicting';
      conflicts.push(key);
      continue;
    }
    if (allValues.size > 1) {
      states[key] = 'ambiguous';
      continue;
    }
    values[key] = best[0].value;
    resolvedProvenance[key] = best[0].provenance;
    states[key] = 'resolved';
  }

  return { values, provenance: resolvedProvenance, states, conflicts };
};

export const extractDeterministically = (
  classifications: DocumentClassification[],
): DeterministicExtraction => {
  const candidates: FieldCandidate[] = [];
  for (const classification of classifications) {
    fixedFields(candidates, classification);
    extractContractFields(candidates, classification);
    extractQualicorpSelectedPlan(candidates, classification);
    extractCompany(candidates, classification);
    extractHolder(candidates, classification);
  }
  const resolved = resolveFieldCandidates(candidates);
  const dependentMatches = classifications.flatMap((classification) => {
    const match = compact(normalizedDocumentText(classification.document)).match(/Total de dependentes\s*:?\s*(\d{1,2})/i);
    return match ? [Number(match[1])] : [];
  });
  const dependentCount = dependentMatches.length > 0 ? Math.max(...dependentMatches) : 0;
  const holderCount = Object.keys(resolved.values).some((key) => key.startsWith('holder.')) ? 1 : 0;
  const warnings = resolved.conflicts.length > 0
    ? [`Foram encontrados conflitos em ${resolved.conflicts.length} campo(s); os valores conflitantes não foram aplicados.`]
    : [];

  return { ...resolved, holderCount, dependentCount, warnings };
};

export const buildSelectedTextContext = (classifications: DocumentClassification[]) => selectCandidatePages(classifications)
  .map((selected) => [
    `--- ${selected.document.fileId} | página ${selected.page.page} | ${selected.section} ---`,
    selected.page.text,
  ].join('\n'))
  .join('\n\n');
