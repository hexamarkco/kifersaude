import {
  COTADOR_AGE_RANGES,
  COTADOR_MODALITY_MATCHERS,
  COTADOR_MODALITY_OPTIONS,
  COTADOR_STORAGE_KEY,
  type CotadorAgeRange,
  type CotadorQuoteModality,
} from './cotadorConstants';
import type { CotadorAgeDistribution, CotadorQuote, CotadorQuoteDraft, CotadorQuoteInput } from './cotadorTypes';

const modalityLabelMap = new Map(COTADOR_MODALITY_OPTIONS.map((option) => [option.value, option.label]));

const normalizeCotadorText = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toNonNegativeInt = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
};

const createQuoteId = () => `cotacao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isCotadorQuoteModality = (value: unknown): value is CotadorQuoteModality =>
  COTADOR_MODALITY_OPTIONS.some((option) => option.value === value);

export const createEmptyCotadorAgeDistribution = (): CotadorAgeDistribution =>
  COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    accumulator[range] = 0;
    return accumulator;
  }, {} as CotadorAgeDistribution);

export const sanitizeCotadorAgeDistribution = (
  value: Partial<Record<CotadorAgeRange, unknown>> | null | undefined,
): CotadorAgeDistribution =>
  COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    accumulator[range] = toNonNegativeInt(value?.[range]);
    return accumulator;
  }, {} as CotadorAgeDistribution);

export const getCotadorTotalLives = (distribution: CotadorAgeDistribution) =>
  COTADOR_AGE_RANGES.reduce((total, range) => total + toNonNegativeInt(distribution[range]), 0);

export const getCotadorFilledAgeRanges = (distribution: CotadorAgeDistribution) =>
  COTADOR_AGE_RANGES.filter((range) => toNonNegativeInt(distribution[range]) > 0).map(
    (range) => `${range}: ${toNonNegativeInt(distribution[range])}`,
  );

export const formatCotadorAgeSummary = (distribution: CotadorAgeDistribution) => {
  const filledRanges = getCotadorFilledAgeRanges(distribution);
  return filledRanges.length ? filledRanges.join(' | ') : 'Nenhuma vida distribuida';
};

export const formatCotadorModality = (modality: CotadorQuoteModality) => modalityLabelMap.get(modality) ?? modality;

export const buildCotadorQuoteDraft = (quote?: CotadorQuote | null): CotadorQuoteDraft => ({
  name: quote?.name ?? '',
  modality: quote?.modality ?? null,
  ageDistribution: sanitizeCotadorAgeDistribution(quote?.ageDistribution),
});

export const createCotadorQuote = (input: CotadorQuoteInput): CotadorQuote => {
  const now = new Date().toISOString();
  const ageDistribution = sanitizeCotadorAgeDistribution(input.ageDistribution);

  return {
    id: createQuoteId(),
    name: input.name.trim(),
    modality: input.modality,
    ageDistribution,
    totalLives: getCotadorTotalLives(ageDistribution),
    selectedCatalogItemIds: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const updateCotadorQuote = (quote: CotadorQuote, input: CotadorQuoteInput): CotadorQuote => {
  const ageDistribution = sanitizeCotadorAgeDistribution(input.ageDistribution);

  return {
    ...quote,
    name: input.name.trim(),
    modality: input.modality,
    ageDistribution,
    totalLives: getCotadorTotalLives(ageDistribution),
    updatedAt: new Date().toISOString(),
  };
};

export const sortCotadorQuotesByRecent = (quotes: CotadorQuote[]) =>
  [...quotes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

const parseStoredQuote = (value: unknown): CotadorQuote | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CotadorQuote> & {
    ageDistribution?: Partial<Record<CotadorAgeRange, unknown>>;
    modality?: unknown;
  };

  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !isCotadorQuoteModality(candidate.modality)) {
    return null;
  }

  const ageDistribution = sanitizeCotadorAgeDistribution(candidate.ageDistribution);
  const selectedCatalogItemIds = Array.isArray(candidate.selectedCatalogItemIds)
    ? candidate.selectedCatalogItemIds.filter((item): item is string => typeof item === 'string')
    : [];

  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString();
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : createdAt;

  return {
    id: candidate.id,
    name: candidate.name,
    modality: candidate.modality,
    ageDistribution,
    totalLives: getCotadorTotalLives(ageDistribution),
    selectedCatalogItemIds,
    createdAt,
    updatedAt,
  };
};

export const loadCotadorQuotesFromStorage = (): CotadorQuote[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COTADOR_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortCotadorQuotesByRecent(parsed.map(parseStoredQuote).filter((item): item is CotadorQuote => item !== null));
  } catch (error) {
    console.error('Error loading cotador quotes:', error);
    return [];
  }
};

export const saveCotadorQuotesToStorage = (quotes: CotadorQuote[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(COTADOR_STORAGE_KEY, JSON.stringify(quotes));
  } catch (error) {
    console.error('Error saving cotador quotes:', error);
  }
};

export const formatCotadorDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Agora';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
};

export const catalogMatchesQuoteModality = (catalogModality: string | null | undefined, quoteModality: CotadorQuoteModality) => {
  const normalizedCatalogModality = normalizeCotadorText(catalogModality);
  if (!normalizedCatalogModality) {
    return true;
  }

  return COTADOR_MODALITY_MATCHERS[quoteModality].some((matcher) =>
    normalizedCatalogModality.includes(normalizeCotadorText(matcher)),
  );
};

export const matchesCotadorSearch = (search: string, values: Array<string | null | undefined>) => {
  const normalizedSearch = normalizeCotadorText(search);
  if (!normalizedSearch) {
    return true;
  }

  return values.some((value) => normalizeCotadorText(value).includes(normalizedSearch));
};
