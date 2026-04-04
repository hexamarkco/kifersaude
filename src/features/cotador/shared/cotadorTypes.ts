import type { CotadorAgeRange, CotadorQuoteModality } from './cotadorConstants';

export type CotadorAgeDistribution = Record<CotadorAgeRange, number>;

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
  selectedCatalogItemIds: string[];
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
  source: 'produto' | 'operadora';
  titulo: string;
  subtitulo: string | null;
  operadora: CotadorCatalogActor;
  administradora: CotadorCatalogActor | null;
  entidadeClasse: CotadorCatalogActor | null;
  modalidade: string | null;
  abrangencia: string | null;
  acomodacao: string | null;
  comissaoSugerida: number | null;
  bonusPorVidaValor: number | null;
  observacao: string | null;
  ativo: boolean;
};

export type CotadorCatalogFilters = {
  search: string;
  operadoraId: string;
  abrangencia: string;
  acomodacao: string;
  selectedOnly: boolean;
};
