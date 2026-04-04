import {
  COTADOR_AGE_RANGES,
  COTADOR_MODALITY_MATCHERS,
  COTADOR_MODALITY_OPTIONS,
  COTADOR_STORAGE_KEY,
  type CotadorAgeRange,
  type CotadorQuoteModality,
} from './cotadorConstants';
import type {
  CotadorAgeDistribution,
  CotadorCatalogActor,
  CotadorCatalogItem,
  CotadorQuote,
  CotadorQuoteDraft,
  CotadorQuoteInput,
  CotadorQuoteItem,
} from './cotadorTypes';

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

const createQuoteItemId = () => `cotacao-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isCotadorQuoteModality = (value: unknown): value is CotadorQuoteModality =>
  COTADOR_MODALITY_OPTIONS.some((option) => option.value === value);

const isCotadorCatalogActor = (value: unknown): value is CotadorCatalogActor =>
  Boolean(
    value
    && typeof value === 'object'
    && typeof (value as CotadorCatalogActor).id === 'string'
    && 'name' in (value as CotadorCatalogActor)
    && typeof (value as CotadorCatalogActor).active === 'boolean',
  );

const sanitizeCatalogActor = (value: Partial<CotadorCatalogActor> | null | undefined): CotadorCatalogActor => ({
  id: typeof value?.id === 'string' ? value.id : `actor-${Math.random().toString(36).slice(2, 8)}`,
  name: typeof value?.name === 'string' ? value.name : null,
  active: value?.active !== false,
});

const sanitizeQuoteItem = (value: unknown): CotadorQuoteItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CotadorQuoteItem> & {
    operadora?: unknown;
    administradora?: unknown;
    entidadesClasse?: unknown;
  };

  if (typeof candidate.catalogItemKey !== 'string' || typeof candidate.titulo !== 'string' || typeof candidate.source !== 'string') {
    return null;
  }

  const entidadesClasse = Array.isArray(candidate.entidadesClasse)
    ? candidate.entidadesClasse.filter(isCotadorCatalogActor).map((item) => sanitizeCatalogActor(item))
    : [];

  return {
    id: typeof candidate.id === 'string' ? candidate.id : createQuoteItemId(),
    catalogItemKey: candidate.catalogItemKey,
    source: candidate.source,
    cotadorProdutoId: typeof candidate.cotadorProdutoId === 'string' ? candidate.cotadorProdutoId : null,
    legacyProdutoPlanoId: typeof candidate.legacyProdutoPlanoId === 'string' ? candidate.legacyProdutoPlanoId : null,
    titulo: candidate.titulo,
    subtitulo: typeof candidate.subtitulo === 'string' ? candidate.subtitulo : null,
    operadora: sanitizeCatalogActor(isCotadorCatalogActor(candidate.operadora) ? candidate.operadora : undefined),
    administradora: isCotadorCatalogActor(candidate.administradora) ? sanitizeCatalogActor(candidate.administradora) : null,
    entidadesClasse,
    modalidade: typeof candidate.modalidade === 'string' ? candidate.modalidade : null,
    abrangencia: typeof candidate.abrangencia === 'string' ? candidate.abrangencia : null,
    acomodacao: typeof candidate.acomodacao === 'string' ? candidate.acomodacao : null,
    comissaoSugerida: typeof candidate.comissaoSugerida === 'number' ? candidate.comissaoSugerida : null,
    bonusPorVidaValor: typeof candidate.bonusPorVidaValor === 'number' ? candidate.bonusPorVidaValor : null,
    observacao: typeof candidate.observacao === 'string' ? candidate.observacao : null,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
  };
};

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

export const buildCotadorQuoteItemFromCatalogItem = (item: CotadorCatalogItem): CotadorQuoteItem => ({
  id: createQuoteItemId(),
  catalogItemKey: item.id,
  source: item.source,
  cotadorProdutoId: item.cotadorProdutoId,
  legacyProdutoPlanoId: item.legacyProdutoPlanoId,
  titulo: item.titulo,
  subtitulo: item.subtitulo,
  operadora: sanitizeCatalogActor(item.operadora),
  administradora: item.administradora ? sanitizeCatalogActor(item.administradora) : null,
  entidadesClasse: item.entidadesClasse.map((entity) => sanitizeCatalogActor(entity)),
  modalidade: item.modalidade,
  abrangencia: item.abrangencia,
  acomodacao: item.acomodacao,
  comissaoSugerida: item.comissaoSugerida,
  bonusPorVidaValor: item.bonusPorVidaValor,
  observacao: item.observacao,
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
    selectedItems: [],
    leadId: null,
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
    selectedCatalogItemIds?: unknown;
    selectedItems?: unknown;
  };

  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !isCotadorQuoteModality(candidate.modality)) {
    return null;
  }

  const ageDistribution = sanitizeCotadorAgeDistribution(candidate.ageDistribution);
  const selectedItems = Array.isArray(candidate.selectedItems)
    ? candidate.selectedItems.map(sanitizeQuoteItem).filter((item): item is CotadorQuoteItem => item !== null)
    : [];
  const legacySelectedIds = Array.isArray(candidate.selectedCatalogItemIds)
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
    selectedItems: selectedItems.length
      ? selectedItems
      : legacySelectedIds.map((catalogItemKey) => ({
          id: createQuoteItemId(),
          catalogItemKey,
          source: 'operadora',
          cotadorProdutoId: null,
          legacyProdutoPlanoId: null,
          titulo: catalogItemKey,
          subtitulo: null,
          operadora: sanitizeCatalogActor({ id: catalogItemKey, name: catalogItemKey, active: true }),
          administradora: null,
          entidadesClasse: [],
          modalidade: null,
          abrangencia: null,
          acomodacao: null,
          comissaoSugerida: null,
          bonusPorVidaValor: null,
          observacao: null,
        })),
    leadId: typeof candidate.leadId === 'string' ? candidate.leadId : null,
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
