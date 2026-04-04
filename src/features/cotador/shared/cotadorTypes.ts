import type { CotadorAgeRange, CotadorQuoteModality } from './cotadorConstants';

export type CotadorAgeDistribution = Record<CotadorAgeRange, number>;

export type CotadorCatalogItemSource = 'cotador_produto' | 'legacy_produto' | 'operadora';

export type CotadorQuoteDraft = {
  name: string;
  modality: CotadorQuoteModality | null;
  ageDistribution: CotadorAgeDistribution;
};

export type CotadorQuoteInput = {
  name: string;
  modality: CotadorQuoteModality;
  ageDistribution: CotadorAgeDistribution;
};

export type CotadorQuote = {
  id: string;
  name: string;
  modality: CotadorQuoteModality;
  ageDistribution: CotadorAgeDistribution;
  totalLives: number;
  selectedItems: CotadorQuoteItem[];
  leadId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CotadorCatalogActor = {
  id: string;
  name: string | null;
  active: boolean;
};

export type CotadorCatalogItem = {
  id: string;
  source: CotadorCatalogItemSource;
  cotadorProdutoId: string | null;
  legacyProdutoPlanoId: string | null;
  titulo: string;
  subtitulo: string | null;
  operadora: CotadorCatalogActor;
  administradora: CotadorCatalogActor | null;
  entidadesClasse: CotadorCatalogActor[];
  modalidade: string | null;
  abrangencia: string | null;
  acomodacao: string | null;
  comissaoSugerida: number | null;
  bonusPorVidaValor: number | null;
  observacao: string | null;
  ativo: boolean;
};

export type CotadorQuoteItem = {
  id: string;
  catalogItemKey: string;
  source: CotadorCatalogItemSource;
  cotadorProdutoId: string | null;
  legacyProdutoPlanoId: string | null;
  titulo: string;
  subtitulo: string | null;
  operadora: CotadorCatalogActor;
  administradora: CotadorCatalogActor | null;
  entidadesClasse: CotadorCatalogActor[];
  modalidade: string | null;
  abrangencia: string | null;
  acomodacao: string | null;
  comissaoSugerida: number | null;
  bonusPorVidaValor: number | null;
  observacao: string | null;
  createdAt?: string;
};

export type CotadorCatalogFilters = {
  search: string;
  operadoraId: string;
  administradoraId: string;
  entidadeId: string;
  abrangencia: string;
  acomodacao: string;
  selectedOnly: boolean;
};
