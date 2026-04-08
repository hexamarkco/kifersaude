import type { CotadorAgeRange, CotadorQuoteModality } from './cotadorConstants';

export type CotadorAgeDistribution = Record<CotadorAgeRange, number>;

export type CotadorCatalogItemSource = 'cotador_tabela' | 'cotador_produto' | 'legacy_produto' | 'operadora';
export type CotadorBusinessProfile = 'todos' | 'mei' | 'nao_mei';
export type CotadorCoparticipationKind = 'sem' | 'parcial' | 'total';

export type CotadorQuoteDraft = {
  name: string;
  modality: CotadorQuoteModality | null;
  leadId?: string | null;
  ageDistribution: CotadorAgeDistribution;
};

export type CotadorQuoteInput = {
  name: string;
  modality: CotadorQuoteModality;
  leadId?: string | null;
  ageDistribution: CotadorAgeDistribution;
};

export type CotadorQuote = {
  id: string;
  name: string;
  modality: CotadorQuoteModality;
  ageDistribution: CotadorAgeDistribution;
  totalLives: number;
  filters: CotadorCatalogFilters;
  selectedItems: CotadorQuoteItem[];
  leadId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CotadorQuoteSharePayload = {
  version: 1;
  quote: {
    id: string;
    name: string;
    modality: CotadorQuoteModality;
    ageDistribution: CotadorAgeDistribution;
    totalLives: number;
    createdAt: string;
    updatedAt: string;
  };
  items: CotadorQuoteItem[];
};

export type CotadorQuoteShare = {
  id: string;
  quoteId: string;
  token: string;
  includeNetworkComparison: boolean;
  payload: CotadorQuoteSharePayload;
  createdAt: string;
  updatedAt: string;
};

export type CotadorCatalogActor = {
  id: string;
  name: string | null;
  active: boolean;
};

export type CotadorHospitalNetworkEntry = {
  cidade: string;
  regiao: string | null;
  hospital: string;
  bairro: string | null;
  atendimentos: string[];
  observacoes: string | null;
};

export type CotadorPriceByAgeRange = Partial<Record<CotadorAgeRange, number>>;

export type CotadorCatalogItem = {
  id: string;
  source: CotadorCatalogItemSource;
  cotadorLinhaId: string | null;
  cotadorTabelaId: string | null;
  cotadorProdutoId: string | null;
  legacyProdutoPlanoId: string | null;
  linha: CotadorCatalogActor | null;
  titulo: string;
  subtitulo: string | null;
  tabelaNome: string | null;
  tabelaCodigo: string | null;
  operadora: CotadorCatalogActor;
  administradora: CotadorCatalogActor | null;
  entidadesClasse: CotadorCatalogActor[];
  modalidade: string | null;
  perfilEmpresarial: CotadorBusinessProfile | null;
  coparticipacao: CotadorCoparticipationKind | null;
  vidasMin: number | null;
  vidasMax: number | null;
  pricesByAgeRange: CotadorPriceByAgeRange;
  estimatedMonthlyTotal: number | null;
  abrangencia: string | null;
  acomodacao: string | null;
  comissaoSugerida: number | null;
  bonusPorVidaValor: number | null;
  observacao: string | null;
  carencias: string | null;
  documentosNecessarios: string | null;
  reembolso: string | null;
  informacoesImportantes: string | null;
  redeHospitalar: CotadorHospitalNetworkEntry[];
  ativo: boolean;
};

export type CotadorQuoteItem = {
  id: string;
  catalogItemKey: string;
  source: CotadorCatalogItemSource;
  cotadorLinhaId: string | null;
  cotadorTabelaId: string | null;
  cotadorProdutoId: string | null;
  legacyProdutoPlanoId: string | null;
  linha: CotadorCatalogActor | null;
  titulo: string;
  subtitulo: string | null;
  tabelaNome: string | null;
  tabelaCodigo: string | null;
  operadora: CotadorCatalogActor;
  administradora: CotadorCatalogActor | null;
  entidadesClasse: CotadorCatalogActor[];
  modalidade: string | null;
  perfilEmpresarial: CotadorBusinessProfile | null;
  coparticipacao: CotadorCoparticipationKind | null;
  vidasMin: number | null;
  vidasMax: number | null;
  pricesByAgeRange: CotadorPriceByAgeRange;
  estimatedMonthlyTotal: number | null;
  abrangencia: string | null;
  acomodacao: string | null;
  comissaoSugerida: number | null;
  bonusPorVidaValor: number | null;
  observacao: string | null;
  carencias: string | null;
  documentosNecessarios: string | null;
  reembolso: string | null;
  informacoesImportantes: string | null;
  redeHospitalar: CotadorHospitalNetworkEntry[];
  createdAt?: string;
};

export type CotadorCatalogFilters = {
  search: string;
  networkLocation: string;
  operadoraId: string;
  linhaId: string;
  administradoraId: string;
  entidadeId: string;
  perfilEmpresarial: CotadorBusinessProfile | '';
  coparticipacao: CotadorCoparticipationKind | '';
  abrangencia: string;
  acomodacao: string;
  selectedOnly: boolean;
};

export const DEFAULT_COTADOR_FILTERS: CotadorCatalogFilters = {
  search: '',
  networkLocation: '',
  operadoraId: '',
  linhaId: '',
  administradoraId: '',
  entidadeId: '',
  perfilEmpresarial: '',
  coparticipacao: '',
  abrangencia: '',
  acomodacao: '',
  selectedOnly: false,
};
