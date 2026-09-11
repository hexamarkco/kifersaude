import type { ContractDocumentProfile } from '../domain.ts';
import type {
  DocumentClassification,
  ParsedPdfDocument,
  SelectedPage,
} from './types.ts';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, ' ')
  .trim()
  .toUpperCase();

const documentText = (document: ParsedPdfDocument) => document.pages
  .map((page) => page.text)
  .join('\n');

const detectOperator = (document: ParsedPdfDocument, family: DocumentClassification['family']) => {
  const text = documentText(document);
  const normalized = normalize(text);
  if (family === 'hcommerce') {
    if (/\bKLini\b/i.test(text) || normalized.includes('KLini'.toUpperCase())) return 'Klini Saúde';
    if (normalized.includes('ASSIM SAUDE')) return 'Assim Saúde';
  }
  if (family === 'planium' && normalized.includes('LEVE SAUDE')) return 'Leve Saúde';
  if (family === 'porto') return 'Porto Saúde';
  if (family === 'medsenior') return 'MedSênior';
  if (family === 'supermed') {
    if (normalized.includes('OPERADORA AMIL') || normalized.includes(' AMIL ')) return 'Amil';
  }
  const known = [
    ['SULAMERICA', 'SulAmérica'],
    ['BRADESCO', 'Bradesco Saúde'],
    ['AMIL', 'Amil'],
    ['ASSIM SAUDE', 'Assim Saúde'],
    ['KLini'.toUpperCase(), 'Klini Saúde'],
    ['LEVE SAUDE', 'Leve Saúde'],
    ['PORTO SAUDE', 'Porto Saúde'],
    ['MEDSENIOR', 'MedSênior'],
  ] as const;
  if (family === 'qualicorp') {
    const planPages = document.pages.filter((page) => normalize(page.text).includes('PLANO PRETENDIDO'));
    const qualicorpKnown = [
      [/SULAMERICA/, 'SulAmérica'],
      [/\bKLINI\b/, 'Klini Saúde'],
      [/\bAMIL\b/, 'Amil'],
      [/BRADESCO/, 'Bradesco Saúde'],
      [/ASSIM PLENUS|ASSIM SAUDE|OPERADORA ASSIM/, 'Assim Saúde'],
    ] as const;
    const detectIn = (pages: ParsedPdfDocument['pages']) => {
      const relevantText = normalize(pages.map((page) => page.text).join('\n'));
      return qualicorpKnown.filter(([pattern]) => pattern.test(relevantText));
    };
    const planMentions = detectIn(planPages);
    if (planMentions.length > 0) return planMentions.length === 1 ? planMentions[0][1] : null;
    const initialMentions = detectIn(document.pages.slice(0, 4));
    return initialMentions.length === 1 ? initialMentions[0][1] : null;
  }
  return known.find(([token]) => normalized.includes(token))?.[1] ?? null;
};

const detectFamily = (text: string): DocumentClassification['family'] => {
  const normalized = normalize(text);
  if (normalized.includes('PROPOSTA DE ADMISSAO COLETIVO EMPRESARIAL') && (
    normalized.includes('EMPRESA CONTRATANTE')
    || normalized.includes('DADOS DO BENEFICIARIO TITULAR')
  )) return 'hcommerce';
  if (normalized.includes('PROPOSTA DE CONTRATACAO PF') && normalized.includes('LEVE SAUDE')) return 'planium';
  if ((normalized.includes('QUALICORP') || normalized.includes('QUALI CORP')) && normalized.includes('CONTRATO DE ADESAO')) return 'qualicorp';
  if (normalized.includes('SUPERMED') && normalized.includes('CONTRATO DE ADESAO')) return 'supermed';
  if (normalized.includes('INDICATIVO DE PRECOS SAUDE PME') || normalized.includes('ORCAMENTO DE PLANO DE SAUDE')) return 'porto';
  if ((normalized.includes('MEDSENIOR') || normalized.includes('SAMEDIL')) && normalized.includes('CONTRATO')) return 'medsenior';
  return 'generic';
};

const familyForOverride = (profile: ContractDocumentProfile) => profile === 'auto'
  ? null
  : profile;

const classifyRole = (
  family: DocumentClassification['family'],
  text: string,
): DocumentClassification['role'] => {
  const normalized = normalize(text);
  if (family === 'hcommerce') {
    const companyScore = ['EMPRESA CONTRATANTE', 'ENDERECO DE FATURAMENTO', 'PLANOS ADERIDOS PELA EMPRESA']
      .filter((anchor) => normalized.includes(anchor)).length;
    const beneficiaryScore = ['DADOS DO BENEFICIARIO TITULAR', 'DADOS DO BENEFICIARIO DEPENDENTE', 'INFORMACOES SOBRE O PAGAMENTO']
      .filter((anchor) => normalized.includes(anchor)).length;
    if (companyScore > beneficiaryScore) return 'company';
    if (beneficiaryScore > 0) return 'beneficiaries';
  }
  if (family === 'porto') return 'quote';
  if (family === 'planium' || family === 'qualicorp') return 'proposal';
  if (family === 'supermed' || family === 'medsenior') return 'contract';
  return 'unknown';
};

const typeForFamily = (family: DocumentClassification['family']) => ({
  hcommerce: 'collective_business',
  planium: 'individual_proposal',
  qualicorp: 'collective_membership',
  supermed: 'collective_membership',
  porto: 'pme_quote',
  medsenior: 'individual_contract',
  generic: 'unknown',
})[family];

const bundleKeyFrom = (text: string, family: DocumentClassification['family']) => {
  if (family !== 'hcommerce') return null;
  const match = normalize(text).match(/\bPJ\s*([0-9]{5,})\b/);
  return match ? `PJ${match[1]}` : null;
};

export const classifyDocuments = (
  documents: ParsedPdfDocument[],
  profileOverride: ContractDocumentProfile,
): DocumentClassification[] => documents.map((document) => {
  const text = documentText(document);
  const detectedFamily = detectFamily(text);
  const family = familyForOverride(profileOverride) ?? detectedFamily;
  const operator = detectOperator(document, family);
  const supportStatus = family === 'generic'
    ? operator ? 'GENERIC_FALLBACK' : 'UNKNOWN'
    : 'SUPPORTED_PROFILE';
  return {
    document,
    family,
    documentType: typeForFamily(family),
    role: classifyRole(family, text),
    operator,
    administrator: family === 'qualicorp'
      ? 'Qualicorp'
      : family === 'supermed' ? 'Supermed' : null,
    supportStatus,
    bundleKey: bundleKeyFrom(text, family),
  };
});

export const validateDocumentSet = (classifications: DocumentClassification[]) => {
  const supportedFamilies = new Set(classifications
    .map((item) => item.family)
    .filter((family) => family !== 'generic'));
  if (supportedFamilies.size > 1) {
    throw new Error('CONFLICTING_DOCUMENTS: os PDFs pertencem a famílias documentais diferentes.');
  }

  const hcommerce = classifications.filter((item) => item.family === 'hcommerce');
  const bundleKeys = new Set(hcommerce.map((item) => item.bundleKey).filter(Boolean));
  if (bundleKeys.size > 1) {
    throw new Error('CONFLICTING_DOCUMENTS: os PDFs HCommerce possuem identificadores de proposta diferentes.');
  }
};

const PAGE_ANCHORS: Record<DocumentClassification['family'], Array<[string, number]>> = {
  hcommerce: [
    ['DADOS DO BENEFICIARIO TITULAR', 12],
    ['DADOS DO BENEFICIARIO DEPENDENTE', 10],
    ['INFORMACOES SOBRE O PAGAMENTO', 12],
    ['EMPRESA CONTRATANTE', 12],
    ['DADOS CADASTRAIS', 8],
    ['PRODUTO EMPRESARIAL', 10],
    ['RESUMO DE VALORES', 12],
    ['PLANOS ADERIDOS PELA EMPRESA', 10],
  ],
  planium: [
    ['DADOS CADASTRAIS DO CONTRATANTE', 12],
    ['DADOS DO RESPONSAVEL PELO CONTRATO', 10],
    ['RESUMO DA CONTRATACAO', 15],
    ['DADOS CADASTRAIS DO 1 DEPENDENTE', 8],
  ],
  qualicorp: [
    ['PROPONENTE TITULAR', 12],
    ['ENDERECO', 7],
    ['PLANO PRETENDIDO', 15],
    ['VALOR POR PROPONENTE', 12],
    ['INICIO DA VIGENCIA DO BENEFICIO', 8],
  ],
  supermed: [
    ['DADOS CADASTRAIS', 12],
    ['BENEFICIARIO TITULAR', 12],
    ['BENEFICIARIOS DEPENDENTES', 10],
    ['PRODUTOS E VALORES', 14],
    ['PLANO SAUDE', 14],
    ['NOME DO PLANO DE SAUDE ESCOLHIDO', 16],
  ],
  porto: [
    ['INDICATIVO DE PRECOS SAUDE PME', 12],
    ['DADOS DA EMPRESA', 10],
    ['ORCAMENTO DE PLANO DE SAUDE', 15],
    ['ESTIPULANTE', 10],
    ['RESUMO', 8],
    ['VALOR TOTAL MENSAL', 15],
  ],
  medsenior: [
    ['CONTRATO N', 10],
    ['QUALIFICACAO DO CONTRATANTE', 10],
    ['NOME COMERCIAL E NUMERO DE REGISTRO', 12],
    ['TIPO DE CONTRATACAO DO PLANO', 12],
    ['PADRAO DE ACOMODACAO', 10],
    ['PROPOSTA DE ADESAO', 12],
  ],
  generic: [
    ['BENEFICIARIO TITULAR', 10],
    ['PROPONENTE TITULAR', 10],
    ['DADOS CADASTRAIS', 8],
    ['PLANO PRETENDIDO', 10],
    ['RESUMO DA CONTRATACAO', 10],
    ['PROPOSTA', 4],
    ['VIGENCIA', 4],
  ],
};

const NEGATIVE_ANCHORS = [
  'DISPOSICOES GERAIS',
  'LEI GERAL DE PROTECAO DE DADOS',
  'EXCLUSOES DE COBERTURA',
  'REDE CREDENCIADA',
  'CONDICOES GERAIS',
  'GUIA DE LEITURA CONTRATUAL',
];

const pageSection = (normalized: string, anchors: Array<[string, number]>) => (
  anchors.find(([anchor]) => normalized.includes(anchor))?.[0] ?? 'TRECHO CANDIDATO'
);

export const selectCandidatePages = (
  classifications: DocumentClassification[],
  maxPages = 8,
  maxCharacters = 24_000,
): SelectedPage[] => {
  const ranked = classifications.flatMap((classification) => {
    const anchors = PAGE_ANCHORS[classification.family];
    return classification.document.pages.map((page) => {
      const normalized = normalize(page.text);
      const positive = anchors.reduce((score, [anchor, weight]) => (
        normalized.includes(anchor) ? score + weight : score
      ), 0);
      const negative = NEGATIVE_ANCHORS.reduce((score, anchor) => (
        normalized.includes(anchor) ? score + 8 : score
      ), 0);
      return {
        document: classification.document,
        page,
        score: positive - negative,
        section: pageSection(normalized, anchors),
      };
    });
  }).filter((candidate) => candidate.score > 0 && candidate.page.characterCount > 0)
    .sort((left, right) => right.score - left.score || left.page.page - right.page.page);

  const selected: SelectedPage[] = [];
  const selectedKeys = new Set<string>();
  let characters = 0;
  const appendCandidate = (candidate: SelectedPage, perPageLimit = 6_000) => {
    if (selected.length >= maxPages) return;
    const remaining = maxCharacters - characters;
    if (remaining <= 0) return;
    const key = `${candidate.document.hash}:${candidate.page.page}`;
    if (selectedKeys.has(key)) return;
    const text = candidate.page.text.slice(0, Math.min(remaining, perPageLimit));
    selected.push({ ...candidate, page: { ...candidate.page, text } });
    selectedKeys.add(key);
    characters += text.length;
  };

  const reservedPerDocument = Math.max(1_000, Math.min(6_000, Math.floor(maxCharacters / Math.max(1, classifications.length))));
  for (const classification of classifications) {
    const bestForDocument = ranked.find((candidate) => candidate.document.hash === classification.document.hash);
    if (bestForDocument) appendCandidate(bestForDocument, reservedPerDocument);
  }
  for (const candidate of ranked) {
    if (selected.length >= maxPages || characters >= maxCharacters) break;
    appendCandidate(candidate);
  }

  if (selected.length > 0) return selected;
  for (const classification of classifications) {
    for (const page of classification.document.pages.filter((item) => item.characterCount > 0).slice(0, 2)) {
      appendCandidate({
      document: classification.document,
      page,
      score: 1,
      section: 'TRECHO INICIAL',
      }, reservedPerDocument);
    }
  }
  return selected;
};

export const normalizedDocumentText = documentText;
