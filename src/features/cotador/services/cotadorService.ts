import type { PostgrestError } from '@supabase/supabase-js';
import { configService } from '../../../lib/configService';
import {
  supabase,
  type CotadorAdministradora,
  type CotadorEntidadeClasse,
  type CotadorProduto,
  type CotadorProdutoEntidade,
  type CotadorQuoteBeneficiaryRecord,
  type CotadorQuoteItemRecord,
  type CotadorQuoteRecord,
  type Operadora,
  type ProdutoPlano,
} from '../../../lib/supabase';
import {
  createEmptyCotadorAgeDistribution,
  getCotadorTotalLives,
  loadCotadorQuotesFromStorage,
  sanitizeCotadorAgeDistribution,
  sortCotadorQuotesByRecent,
} from '../shared/cotadorUtils';
import type {
  CotadorCatalogItem,
  CotadorQuote,
  CotadorQuoteInput,
  CotadorQuoteItem,
} from '../shared/cotadorTypes';

type CatalogManagerPayload = {
  nome: string;
  ativo: boolean;
  observacoes?: string | null;
};

export type CotadorProductManagerRecord = CotadorProduto & {
  operadora: Operadora | null;
  administradora: CotadorAdministradora | null;
  entidadesClasse: CotadorEntidadeClasse[];
};

export type CotadorProductManagerInput = {
  operadora_id: string;
  administradora_id?: string | null;
  nome: string;
  modalidade?: string | null;
  abrangencia?: string | null;
  acomodacao?: string | null;
  comissao_sugerida?: number | null;
  bonus_por_vida_valor?: number | null;
  observacoes?: string | null;
  ativo: boolean;
  entidadeIds: string[];
};

const COTADOR_ADMINISTRADORAS_TABLE = 'cotador_administradoras';
const COTADOR_ENTIDADES_TABLE = 'cotador_entidades_classe';
const COTADOR_PRODUTOS_TABLE = 'cotador_produtos';
const COTADOR_PRODUTO_ENTIDADES_TABLE = 'cotador_produto_entidades';
const COTADOR_QUOTES_TABLE = 'cotador_quotes';
const COTADOR_QUOTE_BENEFICIARIES_TABLE = 'cotador_quote_beneficiaries';
const COTADOR_QUOTE_ITEMS_TABLE = 'cotador_quote_items';

const isMissingTableError = (error: unknown, table: string) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code, message, details, hint } = error as PostgrestError;
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : '';
  const tableLower = table.toLowerCase();
  const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
  const normalizedDetails = typeof details === 'string' ? details.toLowerCase() : '';
  const normalizedHint = typeof hint === 'string' ? hint.toLowerCase() : '';

  if (normalizedCode === 'PGRST302' || normalizedCode === 'PGRST301' || normalizedCode === '42P01') {
    return true;
  }

  return (
    normalizedMessage.includes(`resource ${tableLower}`)
    || normalizedMessage.includes(`relation \"${tableLower}`)
    || normalizedMessage.includes(`relation '${tableLower}`)
    || normalizedMessage.includes('does not exist')
    || normalizedMessage.includes(tableLower)
    || normalizedDetails.includes(tableLower)
    || normalizedHint.includes(tableLower)
  );
};

const toPostgrestError = (error: unknown): PostgrestError => {
  if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
    return error as PostgrestError;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    message,
    details: '',
    hint: '',
    code: 'UNKNOWN',
    name: 'Error',
  };
};

const normalizeText = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const cleanOptionalText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toNullableNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const compareCatalogItems = (left: CotadorCatalogItem, right: CotadorCatalogItem) => {
  const operadoraComparison = (left.operadora.name ?? '').localeCompare(right.operadora.name ?? '', 'pt-BR');
  if (operadoraComparison !== 0) {
    return operadoraComparison;
  }

  const sourceRank = (source: CotadorCatalogItem['source']) => {
    if (source === 'cotador_produto') {
      return 0;
    }
    if (source === 'legacy_produto') {
      return 1;
    }
    return 2;
  };

  const sourceComparison = sourceRank(left.source) - sourceRank(right.source);
  if (sourceComparison !== 0) {
    return sourceComparison;
  }

  return left.titulo.localeCompare(right.titulo, 'pt-BR');
};

const buildCatalogFingerprint = (item: Pick<CotadorCatalogItem, 'titulo' | 'operadora' | 'modalidade' | 'abrangencia' | 'acomodacao'>) =>
  [
    item.operadora.id,
    normalizeText(item.titulo),
    normalizeText(item.modalidade),
    normalizeText(item.abrangencia),
    normalizeText(item.acomodacao),
  ].join('|');

const buildCotadorProductCatalogItem = (product: CotadorProductManagerRecord): CotadorCatalogItem => ({
  id: `cotador-produto:${product.id}`,
  source: 'cotador_produto',
  cotadorProdutoId: product.id,
  legacyProdutoPlanoId: product.legacy_produto_plano_id ?? null,
  titulo: product.nome,
  subtitulo: cleanOptionalText(product.modalidade) ?? cleanOptionalText(product.administradora?.nome) ?? 'Produto do Cotador',
  operadora: {
    id: product.operadora?.id ?? product.operadora_id,
    name: product.operadora?.nome ?? 'Operadora nao encontrada',
    active: product.operadora?.ativo ?? false,
  },
  administradora: product.administradora
    ? {
        id: product.administradora.id,
        name: product.administradora.nome,
        active: product.administradora.ativo,
      }
    : null,
  entidadesClasse: product.entidadesClasse.map((entity) => ({
    id: entity.id,
    name: entity.nome,
    active: entity.ativo,
  })),
  modalidade: cleanOptionalText(product.modalidade),
  abrangencia: cleanOptionalText(product.abrangencia),
  acomodacao: cleanOptionalText(product.acomodacao),
  comissaoSugerida: toNullableNumber(product.comissao_sugerida),
  bonusPorVidaValor: toNullableNumber(product.bonus_por_vida_valor),
  observacao: cleanOptionalText(product.observacoes),
  ativo: Boolean(product.ativo && product.operadora?.ativo !== false),
});

const buildLegacyCatalogItem = (produto: ProdutoPlano, operadora: Operadora | null): CotadorCatalogItem => ({
  id: `legacy-produto:${produto.id}`,
  source: 'legacy_produto',
  cotadorProdutoId: null,
  legacyProdutoPlanoId: produto.id,
  titulo: produto.nome,
  subtitulo: cleanOptionalText(produto.modalidade) ?? 'Produto legado',
  operadora: {
    id: operadora?.id ?? produto.operadora_id,
    name: operadora?.nome ?? 'Operadora nao encontrada',
    active: operadora?.ativo ?? false,
  },
  administradora: null,
  entidadesClasse: [],
  modalidade: cleanOptionalText(produto.modalidade),
  abrangencia: cleanOptionalText(produto.abrangencia),
  acomodacao: cleanOptionalText(produto.acomodacao),
  comissaoSugerida: toNullableNumber(produto.comissao_sugerida),
  bonusPorVidaValor: toNullableNumber(produto.bonus_por_vida_valor),
  observacao: null,
  ativo: Boolean(produto.ativo && operadora?.ativo !== false),
});

const buildOperadoraFallbackItem = (operadora: Operadora): CotadorCatalogItem => ({
  id: `operadora:${operadora.id}`,
  source: 'operadora',
  cotadorProdutoId: null,
  legacyProdutoPlanoId: null,
  titulo: operadora.nome,
  subtitulo: 'Carteira comercial ativa',
  operadora: {
    id: operadora.id,
    name: operadora.nome,
    active: operadora.ativo,
  },
  administradora: null,
  entidadesClasse: [],
  modalidade: null,
  abrangencia: null,
  acomodacao: null,
  comissaoSugerida: toNullableNumber(operadora.comissao_padrao),
  bonusPorVidaValor: toNullableNumber(operadora.bonus_padrao),
  observacao: cleanOptionalText(operadora.observacoes),
  ativo: operadora.ativo,
});

const buildQuoteBeneficiariesRows = (quoteId: string, input: CotadorQuoteInput) =>
  Object.entries(sanitizeCotadorAgeDistribution(input.ageDistribution))
    .map(([ageRange, quantidade], index) => ({
      quote_id: quoteId,
      age_range: ageRange,
      quantidade,
      ordem: index,
    }))
    .filter((item) => item.quantidade > 0);

const buildQuoteItemsRows = (quoteId: string, items: CotadorQuoteItem[]) =>
  items.map((item, index) => ({
    quote_id: quoteId,
    cotador_produto_id: item.cotadorProdutoId,
    legacy_produto_plano_id: item.legacyProdutoPlanoId,
    operadora_id: item.operadora.id,
    administradora_id: item.administradora?.id ?? null,
    catalog_item_key: item.catalogItemKey,
    source: item.source,
    titulo_snapshot: item.titulo,
    subtitulo_snapshot: item.subtitulo,
    operadora_nome_snapshot: item.operadora.name ?? item.titulo,
    administradora_nome_snapshot: item.administradora?.name ?? null,
    entidade_nomes_snapshot: item.entidadesClasse.map((entity) => entity.name ?? '').filter(Boolean),
    modalidade_snapshot: item.modalidade,
    abrangencia_snapshot: item.abrangencia,
    acomodacao_snapshot: item.acomodacao,
    comissao_sugerida_snapshot: item.comissaoSugerida,
    bonus_por_vida_valor_snapshot: item.bonusPorVidaValor,
    observacoes_snapshot: item.observacao,
    ordem: index,
  }));

const buildQuoteItemFromRow = (row: CotadorQuoteItemRecord): CotadorQuoteItem => ({
  id: row.id,
  catalogItemKey: row.catalog_item_key,
  source: row.source,
  cotadorProdutoId: row.cotador_produto_id ?? null,
  legacyProdutoPlanoId: row.legacy_produto_plano_id ?? null,
  titulo: row.titulo_snapshot,
  subtitulo: row.subtitulo_snapshot ?? null,
  operadora: {
    id: row.operadora_id ?? `operadora:${row.id}`,
    name: row.operadora_nome_snapshot,
    active: true,
  },
  administradora: row.administradora_nome_snapshot
    ? {
        id: row.administradora_id ?? `administradora:${row.id}`,
        name: row.administradora_nome_snapshot,
        active: true,
      }
    : null,
  entidadesClasse: (Array.isArray(row.entidade_nomes_snapshot) ? row.entidade_nomes_snapshot : []).map((name, index) => ({
    id: `entidade:${row.id}:${index}`,
    name,
    active: true,
  })),
  modalidade: row.modalidade_snapshot ?? null,
  abrangencia: row.abrangencia_snapshot ?? null,
  acomodacao: row.acomodacao_snapshot ?? null,
  comissaoSugerida: toNullableNumber(row.comissao_sugerida_snapshot),
  bonusPorVidaValor: toNullableNumber(row.bonus_por_vida_valor_snapshot),
  observacao: row.observacoes_snapshot ?? null,
  createdAt: row.created_at,
});

const buildQuoteFromRows = (
  quoteRow: CotadorQuoteRecord,
  beneficiaryRows: CotadorQuoteBeneficiaryRecord[],
  itemRows: CotadorQuoteItemRecord[],
): CotadorQuote => {
  const ageDistribution = createEmptyCotadorAgeDistribution();

  beneficiaryRows
    .filter((row) => row.quote_id === quoteRow.id)
    .sort((left, right) => left.ordem - right.ordem)
    .forEach((row) => {
      if (row.age_range in ageDistribution) {
        ageDistribution[row.age_range as keyof typeof ageDistribution] = row.quantidade;
      }
    });

  const selectedItems = itemRows
    .filter((row) => row.quote_id === quoteRow.id)
    .sort((left, right) => left.ordem - right.ordem)
    .map(buildQuoteItemFromRow);

  return {
    id: quoteRow.id,
    name: quoteRow.nome,
    modality: quoteRow.modalidade,
    ageDistribution,
    totalLives: quoteRow.total_vidas || getCotadorTotalLives(ageDistribution),
    selectedItems,
    leadId: quoteRow.lead_id ?? null,
    createdAt: quoteRow.created_at,
    updatedAt: quoteRow.updated_at,
  };
};

async function syncProductEntities(productId: string, entityIds: string[]) {
  const normalizedEntityIds = Array.from(new Set(entityIds.filter(Boolean)));

  const { error: deleteError } = await supabase
    .from(COTADOR_PRODUTO_ENTIDADES_TABLE)
    .delete()
    .eq('produto_id', productId);

  if (deleteError) {
    throw deleteError;
  }

  if (normalizedEntityIds.length === 0) {
    return;
  }

  const rows: Array<Omit<CotadorProdutoEntidade, 'created_at'>> = normalizedEntityIds.map((entityId) => ({
    produto_id: productId,
    entidade_id: entityId,
  }));

  const { error: insertError } = await supabase
    .from(COTADOR_PRODUTO_ENTIDADES_TABLE)
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}

async function syncQuoteBeneficiaries(quoteId: string, input: CotadorQuoteInput) {
  const { error: deleteError } = await supabase
    .from(COTADOR_QUOTE_BENEFICIARIES_TABLE)
    .delete()
    .eq('quote_id', quoteId);

  if (deleteError) {
    throw deleteError;
  }

  const rows = buildQuoteBeneficiariesRows(quoteId, input);
  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from(COTADOR_QUOTE_BENEFICIARIES_TABLE)
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}

export const cotadorService = {
  async getAdministradoras(): Promise<CotadorAdministradora[]> {
    try {
      const { data, error } = await supabase
        .from(COTADOR_ADMINISTRADORAS_TABLE)
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        if (isMissingTableError(error, COTADOR_ADMINISTRADORAS_TABLE)) {
          return [];
        }
        throw error;
      }

      return (data as CotadorAdministradora[] | null) ?? [];
    } catch (error) {
      console.error('Error loading cotador administradoras:', error);
      return [];
    }
  },

  async createAdministradora(payload: CatalogManagerPayload): Promise<{ data: CotadorAdministradora | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase
        .from(COTADOR_ADMINISTRADORAS_TABLE)
        .insert([{ nome: payload.nome.trim(), ativo: payload.ativo, observacoes: cleanOptionalText(payload.observacoes) }])
        .select()
        .single();

      return { data: (data as CotadorAdministradora) ?? null, error };
    } catch (error) {
      console.error('Error creating cotador administradora:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateAdministradora(id: string, payload: CatalogManagerPayload): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase
        .from(COTADOR_ADMINISTRADORAS_TABLE)
        .update({
          nome: payload.nome.trim(),
          ativo: payload.ativo,
          observacoes: cleanOptionalText(payload.observacoes),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating cotador administradora:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async deleteAdministradora(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase.from(COTADOR_ADMINISTRADORAS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting cotador administradora:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getEntidadesClasse(): Promise<CotadorEntidadeClasse[]> {
    try {
      const { data, error } = await supabase
        .from(COTADOR_ENTIDADES_TABLE)
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        if (isMissingTableError(error, COTADOR_ENTIDADES_TABLE)) {
          return [];
        }
        throw error;
      }

      return (data as CotadorEntidadeClasse[] | null) ?? [];
    } catch (error) {
      console.error('Error loading cotador entidades:', error);
      return [];
    }
  },

  async createEntidadeClasse(payload: CatalogManagerPayload): Promise<{ data: CotadorEntidadeClasse | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase
        .from(COTADOR_ENTIDADES_TABLE)
        .insert([{ nome: payload.nome.trim(), ativo: payload.ativo, observacoes: cleanOptionalText(payload.observacoes) }])
        .select()
        .single();

      return { data: (data as CotadorEntidadeClasse) ?? null, error };
    } catch (error) {
      console.error('Error creating cotador entidade:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateEntidadeClasse(id: string, payload: CatalogManagerPayload): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase
        .from(COTADOR_ENTIDADES_TABLE)
        .update({
          nome: payload.nome.trim(),
          ativo: payload.ativo,
          observacoes: cleanOptionalText(payload.observacoes),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating cotador entidade:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async deleteEntidadeClasse(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase.from(COTADOR_ENTIDADES_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting cotador entidade:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getProdutos(): Promise<CotadorProductManagerRecord[]> {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from(COTADOR_PRODUTOS_TABLE)
        .select('*')
        .order('nome', { ascending: true });

      if (productsError) {
        if (isMissingTableError(productsError, COTADOR_PRODUTOS_TABLE)) {
          return [];
        }
        throw productsError;
      }

      const products = (productsData as CotadorProduto[] | null) ?? [];
      const [operadoras, administradoras, entidades, links] = await Promise.all([
        configService.getOperadoras(),
        cotadorService.getAdministradoras(),
        cotadorService.getEntidadesClasse(),
        (async () => {
          const { data, error } = await supabase
            .from(COTADOR_PRODUTO_ENTIDADES_TABLE)
            .select('*');

          if (error) {
            if (isMissingTableError(error, COTADOR_PRODUTO_ENTIDADES_TABLE)) {
              return [] as CotadorProdutoEntidade[];
            }
            throw error;
          }

          return (data as CotadorProdutoEntidade[] | null) ?? [];
        })(),
      ]);

      const operadoraById = new Map(operadoras.map((operadora) => [operadora.id, operadora]));
      const administradoraById = new Map(administradoras.map((administradora) => [administradora.id, administradora]));
      const entidadeById = new Map(entidades.map((entity) => [entity.id, entity]));
      const entityIdsByProduct = new Map<string, string[]>();

      links.forEach((link) => {
        const current = entityIdsByProduct.get(link.produto_id) ?? [];
        current.push(link.entidade_id);
        entityIdsByProduct.set(link.produto_id, current);
      });

      return products.map((product) => ({
        ...product,
        operadora: operadoraById.get(product.operadora_id) ?? null,
        administradora: product.administradora_id ? administradoraById.get(product.administradora_id) ?? null : null,
        entidadesClasse: (entityIdsByProduct.get(product.id) ?? [])
          .map((entityId) => entidadeById.get(entityId) ?? null)
          .filter((entity): entity is CotadorEntidadeClasse => entity !== null),
      }));
    } catch (error) {
      console.error('Error loading cotador products:', error);
      return [];
    }
  },

  async createProduto(input: CotadorProductManagerInput): Promise<{ data: CotadorProduto | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase
        .from(COTADOR_PRODUTOS_TABLE)
        .insert([{
          operadora_id: input.operadora_id,
          administradora_id: input.administradora_id ?? null,
          nome: input.nome.trim(),
          modalidade: cleanOptionalText(input.modalidade),
          abrangencia: cleanOptionalText(input.abrangencia),
          acomodacao: cleanOptionalText(input.acomodacao),
          comissao_sugerida: input.comissao_sugerida ?? null,
          bonus_por_vida_valor: input.bonus_por_vida_valor ?? null,
          observacoes: cleanOptionalText(input.observacoes),
          ativo: input.ativo,
        }])
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      await syncProductEntities((data as CotadorProduto).id, input.entidadeIds);
      return { data: (data as CotadorProduto) ?? null, error: null };
    } catch (error) {
      console.error('Error creating cotador product:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateProduto(id: string, input: CotadorProductManagerInput): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase
        .from(COTADOR_PRODUTOS_TABLE)
        .update({
          operadora_id: input.operadora_id,
          administradora_id: input.administradora_id ?? null,
          nome: input.nome.trim(),
          modalidade: cleanOptionalText(input.modalidade),
          abrangencia: cleanOptionalText(input.abrangencia),
          acomodacao: cleanOptionalText(input.acomodacao),
          comissao_sugerida: input.comissao_sugerida ?? null,
          bonus_por_vida_valor: input.bonus_por_vida_valor ?? null,
          observacoes: cleanOptionalText(input.observacoes),
          ativo: input.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return { error };
      }

      await syncProductEntities(id, input.entidadeIds);
      return { error: null };
    } catch (error) {
      console.error('Error updating cotador product:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async deleteProduto(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase.from(COTADOR_PRODUTOS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting cotador product:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async loadCatalog(): Promise<CotadorCatalogItem[]> {
    const [operadoras, legacyProdutos, cotadorProdutos] = await Promise.all([
      configService.getOperadoras(),
      configService.getProdutosPlanos(),
      cotadorService.getProdutos(),
    ]);

    const operadoraById = new Map(operadoras.map((operadora) => [operadora.id, operadora]));
    const normalizedItems = cotadorProdutos
      .map(buildCotadorProductCatalogItem)
      .filter((item) => item.ativo);
    const fingerprints = new Set(normalizedItems.map(buildCatalogFingerprint));

    const legacyItems = legacyProdutos
      .map((produto) => buildLegacyCatalogItem(produto, operadoraById.get(produto.operadora_id) ?? null))
      .filter((item) => item.ativo)
      .filter((item) => {
        const fingerprint = buildCatalogFingerprint(item);
        if (fingerprints.has(fingerprint)) {
          return false;
        }

        fingerprints.add(fingerprint);
        return true;
      });

    const coveredOperadoraIds = new Set([...normalizedItems, ...legacyItems].map((item) => item.operadora.id));
    const fallbackItems = operadoras
      .filter((operadora) => operadora.ativo && !coveredOperadoraIds.has(operadora.id))
      .map(buildOperadoraFallbackItem);

    return [...normalizedItems, ...legacyItems, ...fallbackItems].sort(compareCatalogItems);
  },

  async getQuotes(): Promise<CotadorQuote[]> {
    try {
      const { data: quoteRows, error: quotesError } = await supabase
        .from(COTADOR_QUOTES_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

      if (quotesError) {
        if (isMissingTableError(quotesError, COTADOR_QUOTES_TABLE)) {
          return loadCotadorQuotesFromStorage();
        }
        throw quotesError;
      }

      const quotes = (quoteRows as CotadorQuoteRecord[] | null) ?? [];
      if (quotes.length === 0) {
        return [];
      }

      const quoteIds = quotes.map((quote) => quote.id);
      const [{ data: beneficiariesRows, error: beneficiariesError }, { data: itemRows, error: itemsError }] = await Promise.all([
        supabase
          .from(COTADOR_QUOTE_BENEFICIARIES_TABLE)
          .select('*')
          .in('quote_id', quoteIds),
        supabase
          .from(COTADOR_QUOTE_ITEMS_TABLE)
          .select('*')
          .in('quote_id', quoteIds),
      ]);

      if (beneficiariesError) {
        throw beneficiariesError;
      }

      if (itemsError) {
        throw itemsError;
      }

      return sortCotadorQuotesByRecent(
        quotes.map((quoteRow) =>
          buildQuoteFromRows(
            quoteRow,
            (beneficiariesRows as CotadorQuoteBeneficiaryRecord[] | null) ?? [],
            (itemRows as CotadorQuoteItemRecord[] | null) ?? [],
          ),
        ),
      );
    } catch (error) {
      console.error('Error loading cotador quotes:', error);
      return loadCotadorQuotesFromStorage();
    }
  },

  async createQuote(input: CotadorQuoteInput): Promise<{ data: CotadorQuote | null; error: PostgrestError | null }> {
    try {
      const ageDistribution = sanitizeCotadorAgeDistribution(input.ageDistribution);
      const totalLives = getCotadorTotalLives(ageDistribution);
      const { data, error } = await supabase
        .from(COTADOR_QUOTES_TABLE)
        .insert([{
          nome: input.name.trim(),
          modalidade: input.modality,
          total_vidas: totalLives,
        }])
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      const quoteRecord = data as CotadorQuoteRecord;
      await syncQuoteBeneficiaries(quoteRecord.id, input);

      return {
        data: {
          id: quoteRecord.id,
          name: quoteRecord.nome,
          modality: quoteRecord.modalidade,
          ageDistribution,
          totalLives,
          selectedItems: [],
          leadId: quoteRecord.lead_id ?? null,
          createdAt: quoteRecord.created_at,
          updatedAt: quoteRecord.updated_at,
        },
        error: null,
      };
    } catch (error) {
      console.error('Error creating cotador quote:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateQuote(quote: CotadorQuote, input: CotadorQuoteInput): Promise<{ data: CotadorQuote | null; error: PostgrestError | null }> {
    try {
      const ageDistribution = sanitizeCotadorAgeDistribution(input.ageDistribution);
      const totalLives = getCotadorTotalLives(ageDistribution);
      const { error } = await supabase
        .from(COTADOR_QUOTES_TABLE)
        .update({
          nome: input.name.trim(),
          modalidade: input.modality,
          total_vidas: totalLives,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (error) {
        return { data: null, error };
      }

      await syncQuoteBeneficiaries(quote.id, input);

      return {
        data: {
          ...quote,
          name: input.name.trim(),
          modality: input.modality,
          ageDistribution,
          totalLives,
          updatedAt: new Date().toISOString(),
        },
        error: null,
      };
    } catch (error) {
      console.error('Error updating cotador quote:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async saveQuoteSelection(quoteId: string, items: CotadorQuoteItem[]): Promise<{ error: PostgrestError | null }> {
    try {
      const { error: deleteError } = await supabase
        .from(COTADOR_QUOTE_ITEMS_TABLE)
        .delete()
        .eq('quote_id', quoteId);

      if (deleteError) {
        return { error: deleteError };
      }

      if (items.length === 0) {
        const { error: touchError } = await supabase
          .from(COTADOR_QUOTES_TABLE)
          .update({ updated_at: new Date().toISOString() })
          .eq('id', quoteId);

        return { error: touchError };
      }

      const { error: insertError } = await supabase
        .from(COTADOR_QUOTE_ITEMS_TABLE)
        .insert(buildQuoteItemsRows(quoteId, items));

      if (insertError) {
        return { error: insertError };
      }

      const { error: touchError } = await supabase
        .from(COTADOR_QUOTES_TABLE)
        .update({ updated_at: new Date().toISOString() })
        .eq('id', quoteId);

      return { error: touchError };
    } catch (error) {
      console.error('Error saving cotador quote selection:', error);
      return { error: toPostgrestError(error) };
    }
  },
};
