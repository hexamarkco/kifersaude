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
  CotadorCatalogFilters,
  CotadorHospitalNetworkEntry,
  CotadorPriceByAgeRange,
  CotadorQuote,
  CotadorQuoteDraft,
  CotadorQuoteInput,
  CotadorQuoteItem,
  CotadorQuoteSharePayload,
} from './cotadorTypes';
import { DEFAULT_COTADOR_FILTERS } from './cotadorTypes';

const modalityLabelMap = new Map(COTADOR_MODALITY_OPTIONS.map((option) => [option.value, option.label]));

const normalizeCotadorText = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const COTADOR_HOSPITAL_NAME_NOISE_TOKENS = new Set([
  'a',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'eireli',
  'epp',
  'limitada',
  'ltda',
  'me',
  'mei',
  's',
  'sa',
  'ss',
]);

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

const sanitizeHospitalNetworkEntry = (value: unknown): CotadorHospitalNetworkEntry | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const cidade = typeof candidate.cidade === 'string' ? candidate.cidade.trim() : '';
  const hospital = typeof candidate.hospital === 'string' ? candidate.hospital.trim() : '';

  if (!cidade || !hospital) {
    return null;
  }

  return {
    cidade,
    regiao: typeof candidate.regiao === 'string' && candidate.regiao.trim() ? candidate.regiao.trim() : null,
    hospital,
    bairro: typeof candidate.bairro === 'string' && candidate.bairro.trim() ? candidate.bairro.trim() : null,
    atendimentos: Array.isArray(candidate.atendimentos)
      ? candidate.atendimentos.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
      : [],
    observacoes: typeof candidate.observacoes === 'string' && candidate.observacoes.trim() ? candidate.observacoes.trim() : null,
  };
};

const sanitizeHospitalNetwork = (value: unknown): CotadorHospitalNetworkEntry[] =>
  Array.isArray(value)
    ? value.map(sanitizeHospitalNetworkEntry).filter((item): item is CotadorHospitalNetworkEntry => item !== null)
    : [];

const sanitizePriceByAgeRange = (value: unknown): CotadorPriceByAgeRange => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    const candidate = (value as Record<string, unknown>)[range];
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      accumulator[range] = candidate;
    }
    return accumulator;
  }, {} as CotadorPriceByAgeRange);
};

const sanitizeCotadorCatalogFilters = (value: unknown): CotadorCatalogFilters => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_COTADOR_FILTERS };
  }

  const candidate = value as Partial<CotadorCatalogFilters>;

  return {
    search: typeof candidate.search === 'string' ? candidate.search : DEFAULT_COTADOR_FILTERS.search,
    networkLocation: typeof candidate.networkLocation === 'string' ? candidate.networkLocation : DEFAULT_COTADOR_FILTERS.networkLocation,
    operadoraId: typeof candidate.operadoraId === 'string' ? candidate.operadoraId : DEFAULT_COTADOR_FILTERS.operadoraId,
    linhaId: typeof candidate.linhaId === 'string' ? candidate.linhaId : DEFAULT_COTADOR_FILTERS.linhaId,
    administradoraId: typeof candidate.administradoraId === 'string' ? candidate.administradoraId : DEFAULT_COTADOR_FILTERS.administradoraId,
    entidadeId: typeof candidate.entidadeId === 'string' ? candidate.entidadeId : DEFAULT_COTADOR_FILTERS.entidadeId,
    perfilEmpresarial:
      candidate.perfilEmpresarial === 'todos' || candidate.perfilEmpresarial === 'mei' || candidate.perfilEmpresarial === 'nao_mei'
        ? candidate.perfilEmpresarial
        : DEFAULT_COTADOR_FILTERS.perfilEmpresarial,
    coparticipacao:
      candidate.coparticipacao === 'sem' || candidate.coparticipacao === 'parcial' || candidate.coparticipacao === 'total'
        ? candidate.coparticipacao
        : DEFAULT_COTADOR_FILTERS.coparticipacao,
    abrangencia: typeof candidate.abrangencia === 'string' ? candidate.abrangencia : DEFAULT_COTADOR_FILTERS.abrangencia,
    acomodacao: typeof candidate.acomodacao === 'string' ? candidate.acomodacao : DEFAULT_COTADOR_FILTERS.acomodacao,
    selectedOnly: candidate.selectedOnly === true,
  };
};

const collectUniqueDisplayValues = (values: Array<string | null | undefined>) => {
  const unique = new Map<string, string>();

  values.forEach((value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;

    const key = normalizeCotadorText(trimmed);
    if (!key || unique.has(key)) return;
    unique.set(key, trimmed);
  });

  return Array.from(unique.values());
};

const mergeDisplayValues = (
  values: Array<string | null | undefined>,
  separator = ' / ',
) => {
  const unique = collectUniqueDisplayValues(values);

  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];
  return unique.join(separator);
};

export const getCotadorComparableHospitalName = (value?: string | null) => {
  const normalized = normalizeCotadorText(value).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) return '';

  const filteredTokens = normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !COTADOR_HOSPITAL_NAME_NOISE_TOKENS.has(token));

  return filteredTokens.join(' ') || normalized;
};

export const buildCotadorComparableHospitalKey = (
  entry: Pick<CotadorHospitalNetworkEntry, 'hospital' | 'cidade'>,
) => [
  getCotadorComparableHospitalName(entry.hospital),
  normalizeCotadorText(entry.cidade),
].join('|');

const pickPreferredHospitalDisplayName = (values: Array<string | null | undefined>) => {
  const unique = collectUniqueDisplayValues(values);
  if (unique.length === 0) return '';

  return [...unique].sort((left, right) => {
    const comparableLengthDifference = getCotadorComparableHospitalName(left).length - getCotadorComparableHospitalName(right).length;
    if (comparableLengthDifference !== 0) return comparableLengthDifference;

    const rawLengthDifference = left.length - right.length;
    if (rawLengthDifference !== 0) return rawLengthDifference;

    return left.localeCompare(right, 'pt-BR');
  })[0];
};

export const mergeCotadorHospitalNetworkEntries = (entries: CotadorHospitalNetworkEntry[]) => {
  const grouped = new Map<string, {
    hospitalNames: string[];
    cidades: string[];
    bairros: string[];
    regioes: string[];
    atendimentos: string[];
    observacoes: string[];
  }>();

  entries.forEach((entry) => {
    const key = buildCotadorComparableHospitalKey(entry);
    if (!key) return;

    const current = grouped.get(key) ?? {
      hospitalNames: [],
      cidades: [],
      bairros: [],
      regioes: [],
      atendimentos: [],
      observacoes: [],
    };

    current.hospitalNames.push(entry.hospital);
    current.cidades.push(entry.cidade);
    if (entry.bairro) current.bairros.push(entry.bairro);
    if (entry.regiao) current.regioes.push(entry.regiao);
    current.atendimentos.push(...entry.atendimentos.filter(Boolean));
    if (entry.observacoes?.trim()) current.observacoes.push(entry.observacoes.trim());

    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((group) => ({
    hospital: pickPreferredHospitalDisplayName(group.hospitalNames),
    cidade: mergeDisplayValues(group.cidades, ' / ') ?? '',
    bairro: mergeDisplayValues(group.bairros, ' / '),
    regiao: mergeDisplayValues(group.regioes, ' / '),
    atendimentos: collectUniqueDisplayValues(group.atendimentos).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    observacoes: mergeDisplayValues(group.observacoes, ' | '),
  })).filter((entry) => entry.hospital && entry.cidade);
};

export const countCotadorUniqueNetworkProviders = (entries: CotadorHospitalNetworkEntry[]) =>
  mergeCotadorHospitalNetworkEntries(entries).length;

export const calculateCotadorEstimatedMonthlyTotal = (
  ageDistribution: CotadorAgeDistribution,
  pricesByAgeRange: CotadorPriceByAgeRange,
) => {
  const total = COTADOR_AGE_RANGES.reduce((sum, range) => {
    const quantity = ageDistribution[range] ?? 0;
    const price = pricesByAgeRange[range] ?? null;

    if (!quantity || price === null || typeof price !== 'number') {
      return sum;
    }

    return sum + quantity * price;
  }, 0);

  return total > 0 ? total : null;
};

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
    cotadorLinhaId: typeof candidate.cotadorLinhaId === 'string' ? candidate.cotadorLinhaId : null,
    cotadorTabelaId: typeof candidate.cotadorTabelaId === 'string' ? candidate.cotadorTabelaId : null,
    cotadorProdutoId: typeof candidate.cotadorProdutoId === 'string' ? candidate.cotadorProdutoId : null,
    legacyProdutoPlanoId: typeof candidate.legacyProdutoPlanoId === 'string' ? candidate.legacyProdutoPlanoId : null,
    linha: isCotadorCatalogActor(candidate.linha) ? sanitizeCatalogActor(candidate.linha) : null,
    titulo: candidate.titulo,
    subtitulo: typeof candidate.subtitulo === 'string' ? candidate.subtitulo : null,
    tabelaNome: typeof candidate.tabelaNome === 'string' ? candidate.tabelaNome : null,
    tabelaCodigo: typeof candidate.tabelaCodigo === 'string' ? candidate.tabelaCodigo : null,
    operadora: sanitizeCatalogActor(isCotadorCatalogActor(candidate.operadora) ? candidate.operadora : undefined),
    administradora: isCotadorCatalogActor(candidate.administradora) ? sanitizeCatalogActor(candidate.administradora) : null,
    entidadesClasse,
    modalidade: typeof candidate.modalidade === 'string' ? candidate.modalidade : null,
    perfilEmpresarial:
      candidate.perfilEmpresarial === 'mei' || candidate.perfilEmpresarial === 'nao_mei' || candidate.perfilEmpresarial === 'todos'
        ? candidate.perfilEmpresarial
        : null,
    coparticipacao:
      candidate.coparticipacao === 'sem' || candidate.coparticipacao === 'parcial' || candidate.coparticipacao === 'total'
        ? candidate.coparticipacao
        : null,
    vidasMin: typeof candidate.vidasMin === 'number' ? candidate.vidasMin : null,
    vidasMax: typeof candidate.vidasMax === 'number' ? candidate.vidasMax : null,
    pricesByAgeRange: sanitizePriceByAgeRange(candidate.pricesByAgeRange),
    estimatedMonthlyTotal: typeof candidate.estimatedMonthlyTotal === 'number' ? candidate.estimatedMonthlyTotal : null,
    abrangencia: typeof candidate.abrangencia === 'string' ? candidate.abrangencia : null,
    acomodacao: typeof candidate.acomodacao === 'string' ? candidate.acomodacao : null,
    comissaoSugerida: typeof candidate.comissaoSugerida === 'number' ? candidate.comissaoSugerida : null,
    bonusPorVidaValor: typeof candidate.bonusPorVidaValor === 'number' ? candidate.bonusPorVidaValor : null,
    carencias: typeof candidate.carencias === 'string' ? candidate.carencias : null,
    documentosNecessarios: typeof candidate.documentosNecessarios === 'string' ? candidate.documentosNecessarios : null,
    reembolso: typeof candidate.reembolso === 'string' ? candidate.reembolso : null,
    informacoesImportantes: typeof candidate.informacoesImportantes === 'string' ? candidate.informacoesImportantes : null,
    redeHospitalar: sanitizeHospitalNetwork(candidate.redeHospitalar),
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
  return filledRanges.length ? filledRanges.join(' | ') : 'Nenhuma vida distribuída';
};

export const formatCotadorModality = (modality: CotadorQuoteModality) => modalityLabelMap.get(modality) ?? modality;

export const formatCotadorSelectedModalities = (
  items: Array<Pick<CotadorQuoteItem, 'modalidade'>>,
) => {
  const uniqueLabels = Array.from(new Set(
    items
      .map((item) => item.modalidade?.trim())
      .filter((value): value is string => Boolean(value))
      .map((value) => (isCotadorQuoteModality(value) ? formatCotadorModality(value) : value)),
  ));

  return uniqueLabels.length > 0 ? uniqueLabels.join(' | ') : null;
};

export const formatCotadorCurrency = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const formatCotadorPercent = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
};

export const buildCotadorQuoteDraft = (quote?: CotadorQuote | null): CotadorQuoteDraft => ({
  name: quote?.name ?? '',
  modality: quote?.modality ?? null,
  leadId: quote?.leadId ?? null,
  ageDistribution: sanitizeCotadorAgeDistribution(quote?.ageDistribution),
});

export const buildCotadorQuoteItemFromCatalogItem = (item: CotadorCatalogItem): CotadorQuoteItem => ({
  id: createQuoteItemId(),
  catalogItemKey: item.id,
  source: item.source,
  cotadorLinhaId: item.cotadorLinhaId,
  cotadorTabelaId: item.cotadorTabelaId,
  cotadorProdutoId: item.cotadorProdutoId,
  legacyProdutoPlanoId: item.legacyProdutoPlanoId,
  linha: item.linha ? sanitizeCatalogActor(item.linha) : null,
  titulo: item.titulo,
  subtitulo: item.subtitulo,
  tabelaNome: item.tabelaNome,
  tabelaCodigo: item.tabelaCodigo,
  operadora: sanitizeCatalogActor(item.operadora),
  administradora: item.administradora ? sanitizeCatalogActor(item.administradora) : null,
  entidadesClasse: item.entidadesClasse.map((entity) => sanitizeCatalogActor(entity)),
  modalidade: item.modalidade,
  perfilEmpresarial: item.perfilEmpresarial,
  coparticipacao: item.coparticipacao,
  vidasMin: item.vidasMin,
  vidasMax: item.vidasMax,
  pricesByAgeRange: sanitizePriceByAgeRange(item.pricesByAgeRange),
  estimatedMonthlyTotal: item.estimatedMonthlyTotal,
  abrangencia: item.abrangencia,
  acomodacao: item.acomodacao,
  comissaoSugerida: item.comissaoSugerida,
  bonusPorVidaValor: item.bonusPorVidaValor,
  carencias: item.carencias,
  documentosNecessarios: item.documentosNecessarios,
  reembolso: item.reembolso,
  informacoesImportantes: item.informacoesImportantes,
  redeHospitalar: item.redeHospitalar,
  observacao: item.observacao,
});

export const createCotadorQuote = (input: CotadorQuoteInput): CotadorQuote => {
  const now = new Date().toISOString();
  const ageDistribution = sanitizeCotadorAgeDistribution(input.ageDistribution);

  return {
    id: createQuoteId(),
    name: input.name.trim(),
    modality: input.modality,
    leadId: input.leadId ?? null,
    ageDistribution,
    totalLives: getCotadorTotalLives(ageDistribution),
    filters: { ...DEFAULT_COTADOR_FILTERS },
    selectedItems: [],
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
    leadId: input.leadId ?? null,
    ageDistribution,
    totalLives: getCotadorTotalLives(ageDistribution),
    filters: sanitizeCotadorCatalogFilters(quote.filters),
    updatedAt: new Date().toISOString(),
  };
};

export const buildCotadorQuoteSharePayload = (
  quote: CotadorQuote,
  items: CotadorQuoteItem[] = quote.selectedItems,
): CotadorQuoteSharePayload => ({
  version: 1,
  quote: {
    id: quote.id,
    name: quote.name,
    modality: quote.modality,
    ageDistribution: sanitizeCotadorAgeDistribution(quote.ageDistribution),
    totalLives: getCotadorTotalLives(quote.ageDistribution),
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  },
  items: items
    .map((item) => sanitizeQuoteItem(item))
    .filter((item): item is CotadorQuoteItem => item !== null),
});

export const parseCotadorQuoteSharePayload = (value: unknown): CotadorQuoteSharePayload | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CotadorQuoteSharePayload> & {
    quote?: Partial<CotadorQuote> & { ageDistribution?: Partial<Record<CotadorAgeRange, unknown>> };
    items?: unknown;
  };

  if (candidate.version !== 1 || !candidate.quote || typeof candidate.quote.id !== 'string' || typeof candidate.quote.name !== 'string' || !isCotadorQuoteModality(candidate.quote.modality)) {
    return null;
  }

  const items = Array.isArray(candidate.items)
    ? candidate.items.map((item) => sanitizeQuoteItem(item)).filter((item): item is CotadorQuoteItem => item !== null)
    : [];

  return {
    version: 1,
    quote: {
      id: candidate.quote.id,
      name: candidate.quote.name,
      modality: candidate.quote.modality,
      ageDistribution: sanitizeCotadorAgeDistribution(candidate.quote.ageDistribution),
      totalLives: typeof candidate.quote.totalLives === 'number'
        ? candidate.quote.totalLives
        : getCotadorTotalLives(candidate.quote.ageDistribution ?? null),
      createdAt: typeof candidate.quote.createdAt === 'string' ? candidate.quote.createdAt : new Date().toISOString(),
      updatedAt: typeof candidate.quote.updatedAt === 'string' ? candidate.quote.updatedAt : typeof candidate.quote.createdAt === 'string' ? candidate.quote.createdAt : new Date().toISOString(),
    },
    items,
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
  const filters = sanitizeCotadorCatalogFilters(candidate.filters);

  return {
    id: candidate.id,
    name: candidate.name,
    modality: candidate.modality,
    leadId: typeof candidate.leadId === 'string' ? candidate.leadId : null,
    ageDistribution,
    totalLives: getCotadorTotalLives(ageDistribution),
    filters,
    selectedItems: selectedItems.length
      ? selectedItems
      : legacySelectedIds.map((catalogItemKey) => ({
          id: createQuoteItemId(),
          catalogItemKey,
          source: 'operadora',
          cotadorLinhaId: null,
          cotadorTabelaId: null,
          cotadorProdutoId: null,
          legacyProdutoPlanoId: null,
          linha: null,
          titulo: catalogItemKey,
          subtitulo: null,
          tabelaNome: null,
          tabelaCodigo: null,
          operadora: sanitizeCatalogActor({ id: catalogItemKey, name: catalogItemKey, active: true }),
          administradora: null,
          entidadesClasse: [],
          modalidade: null,
          perfilEmpresarial: null,
          coparticipacao: null,
          vidasMin: null,
          vidasMax: null,
          pricesByAgeRange: {},
          estimatedMonthlyTotal: null,
          abrangencia: null,
          acomodacao: null,
          comissaoSugerida: null,
          bonusPorVidaValor: null,
          carencias: null,
          documentosNecessarios: null,
          reembolso: null,
          informacoesImportantes: null,
          redeHospitalar: [],
          observacao: null,
        })),
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
