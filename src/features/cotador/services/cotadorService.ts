import type { PostgrestError } from '@supabase/supabase-js';
import { configService } from '../../../lib/configService';
import {
  supabase,
  type CotadorAdministradora,
  type CotadorEntidadeClasse,
  type CotadorHospital,
  type CotadorHospitalAlias,
    type CotadorLinhaProduto,
  type CotadorProduto,
  type CotadorProdutoEntidade,
  type CotadorProdutoHospital,
  type CotadorQuoteBeneficiaryRecord,
  type CotadorQuoteItemRecord,
  type CotadorQuoteRecord,
  type CotadorTabela,
  type CotadorTabelaFaixaPreco,
  type Operadora,
  type ProdutoPlano,
} from '../../../lib/supabase';
import { COTADOR_AGE_RANGES, type CotadorAgeRange } from '../shared/cotadorConstants';
import {
  createEmptyCotadorAgeDistribution,
  getCotadorTotalLives,
  loadCotadorQuotesFromStorage,
  sanitizeCotadorAgeDistribution,
  sortCotadorQuotesByRecent,
} from '../shared/cotadorUtils';
import type {
  CotadorBusinessProfile,
  CotadorCatalogActor,
  CotadorCatalogItem,
  CotadorCoparticipationKind,
  CotadorHospitalNetworkEntry,
  CotadorPriceByAgeRange,
  CotadorQuote,
  CotadorQuoteInput,
  CotadorQuoteItem,
} from '../shared/cotadorTypes';

type CatalogManagerPayload = {
  nome: string;
  ativo: boolean;
  observacoes?: string | null;
};

export type CotadorLineManagerRecord = CotadorLinhaProduto & {
  operadora: Operadora | null;
};

export type CotadorProductManagerRecord = CotadorProduto & {
  operadora: Operadora | null;
  linha: CotadorLinhaProduto | null;
  administradora: CotadorAdministradora | null;
  entidadesClasse: CotadorEntidadeClasse[];
};

export type CotadorProductNetworkManagerRecord = CotadorHospitalNetworkEntry & {
  link_id: string | null;
  hospital_id: string | null;
  aliases: string[];
};

export type CotadorProductNetworkManagerInput = CotadorHospitalNetworkEntry & {
  linkId?: string | null;
  hospitalId?: string | null;
  aliases?: string[];
};

export type CotadorHospitalLinkedProductRecord = {
  link_id: string;
  hospital_id: string;
  produto_id: string;
  produto_nome: string;
  produto_acomodacao: string | null;
  produto_abrangencia: string | null;
  operadora: Operadora | null;
  linha: CotadorLinhaProduto | null;
  atendimentos: string[];
  observacoes: string | null;
  ordem: number;
};

export type CotadorHospitalManagerRecord = CotadorHospital & {
  aliases: string[];
  linkedProducts: CotadorHospitalLinkedProductRecord[];
};

export type CotadorHospitalManagerInput = {
  nome: string;
  cidade: string;
  regiao?: string | null;
  bairro?: string | null;
  aliases: string[];
  ativo: boolean;
};

export type CotadorPriceRowInput = Partial<Record<CotadorAgeRange, number>>;

export type CotadorProductManagerInput = {
  operadora_id: string;
  linha_id: string;
  administradora_id?: string | null;
  nome: string;
  modalidade?: string | null;
  abrangencia?: string | null;
  acomodacao?: string | null;
  comissao_sugerida?: number | null;
  bonus_por_vida_valor?: number | null;
  carencias?: string | null;
  documentos_necessarios?: string | null;
  reembolso?: string | null;
  informacoes_importantes?: string | null;
  rede_hospitalar?: CotadorHospitalNetworkEntry[] | null;
  observacoes?: string | null;
  ativo: boolean;
  entidadeIds: string[];
};

export type CotadorTableManagerRecord = CotadorTabela & {
  produto: CotadorProductManagerRecord | null;
  pricesByAgeRange: CotadorPriceByAgeRange;
};

export type CotadorTableManagerInput = {
  produto_id: string;
  nome: string;
  codigo?: string | null;
  modalidade: 'PF' | 'ADESAO' | 'PME';
  perfil_empresarial: CotadorBusinessProfile;
  coparticipacao: CotadorCoparticipationKind;
  acomodacao?: string | null;
  vidas_min?: number | null;
  vidas_max?: number | null;
  observacoes?: string | null;
  ativo: boolean;
  pricesByAgeRange: CotadorPriceRowInput;
};

const COTADOR_ADMINISTRADORAS_TABLE = 'cotador_administradoras';
const COTADOR_ENTIDADES_TABLE = 'cotador_entidades_classe';
const COTADOR_LINHAS_TABLE = 'cotador_linhas_produto';
const COTADOR_PRODUTOS_TABLE = 'cotador_produtos';
const COTADOR_HOSPITAIS_TABLE = 'cotador_hospitais';
const COTADOR_HOSPITAL_ALIASES_TABLE = 'cotador_hospital_aliases';
const COTADOR_PRODUTO_HOSPITAIS_TABLE = 'cotador_produto_hospitais';
const COTADOR_PRODUTO_ENTIDADES_TABLE = 'cotador_produto_entidades';
const COTADOR_TABELAS_TABLE = 'cotador_tabelas';
const COTADOR_TABELA_PRECOS_TABLE = 'cotador_tabela_faixas_preco';
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

const isMissingRpcError = (error: unknown, functionName: string) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code, message, details, hint } = error as PostgrestError;
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : '';
  const normalizedFunctionName = functionName.toLowerCase();
  const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
  const normalizedDetails = typeof details === 'string' ? details.toLowerCase() : '';
  const normalizedHint = typeof hint === 'string' ? hint.toLowerCase() : '';

  if (normalizedCode === 'PGRST202' || normalizedCode === '42883') {
    return true;
  }

  return (
    normalizedMessage.includes(normalizedFunctionName)
    || normalizedDetails.includes(normalizedFunctionName)
    || normalizedHint.includes(normalizedFunctionName)
    || normalizedMessage.includes('function')
    || normalizedMessage.includes('could not find')
  );
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

const sanitizeHospitalNetwork = (value: unknown): CotadorHospitalNetworkEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      const cidade = typeof candidate.cidade === 'string' ? candidate.cidade.trim() : '';
      const hospital = typeof candidate.hospital === 'string' ? candidate.hospital.trim() : '';
      if (!cidade || !hospital) return null;

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
    })
    .filter((entry): entry is CotadorHospitalNetworkEntry => entry !== null);
};

const sanitizeHospitalAliases = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, 'pt-BR'));
};

const buildNormalizedProductNetworkEntry = (
  hospital: CotadorHospital,
  link: CotadorProdutoHospital,
  aliases: CotadorHospitalAlias[],
): CotadorProductNetworkManagerRecord => ({
  link_id: link.id,
  hospital_id: hospital.id,
  hospital: hospital.nome,
  cidade: hospital.cidade,
  regiao: hospital.regiao ?? null,
  bairro: hospital.bairro ?? null,
  atendimentos: Array.isArray(link.atendimentos) ? link.atendimentos.map((item) => item.trim()).filter(Boolean) : [],
  observacoes: cleanOptionalText(link.observacoes),
  aliases: sanitizeHospitalAliases(aliases.map((alias) => alias.alias_nome).filter((name) => normalizeText(name) !== normalizeText(hospital.nome))),
});

const buildHospitalLinkedProductRecord = (
  link: CotadorProdutoHospital,
  product: CotadorProductManagerRecord | null,
): CotadorHospitalLinkedProductRecord => ({
  link_id: link.id,
  hospital_id: link.hospital_id,
  produto_id: link.produto_id,
  produto_nome: product?.nome ?? 'Produto nao encontrado',
  produto_acomodacao: cleanOptionalText(product?.acomodacao),
  produto_abrangencia: cleanOptionalText(product?.abrangencia),
  operadora: product?.operadora ?? null,
  linha: product?.linha ?? null,
  atendimentos: Array.isArray(link.atendimentos) ? link.atendimentos.map((item) => item.trim()).filter(Boolean) : [],
  observacoes: cleanOptionalText(link.observacoes),
  ordem: link.ordem,
});

const compareHospitalLinkedProducts = (left: CotadorHospitalLinkedProductRecord, right: CotadorHospitalLinkedProductRecord) => {
  const operadoraComparison = normalizeText(left.operadora?.nome).localeCompare(normalizeText(right.operadora?.nome), 'pt-BR');
  if (operadoraComparison !== 0) return operadoraComparison;

  const lineComparison = normalizeText(left.linha?.nome).localeCompare(normalizeText(right.linha?.nome), 'pt-BR');
  if (lineComparison !== 0) return lineComparison;

  const productComparison = normalizeText(left.produto_nome).localeCompare(normalizeText(right.produto_nome), 'pt-BR');
  if (productComparison !== 0) return productComparison;

  return left.ordem - right.ordem;
};

const compareHospitals = (left: CotadorHospitalManagerRecord, right: CotadorHospitalManagerRecord) => {
  const cityComparison = normalizeText(left.cidade).localeCompare(normalizeText(right.cidade), 'pt-BR');
  if (cityComparison !== 0) return cityComparison;

  const regionComparison = normalizeText(left.regiao).localeCompare(normalizeText(right.regiao), 'pt-BR');
  if (regionComparison !== 0) return regionComparison;

  return normalizeText(left.nome).localeCompare(normalizeText(right.nome), 'pt-BR');
};

async function loadNormalizedProductNetworkMap() {
  const { data: linksData, error: linksError } = await supabase
    .from(COTADOR_PRODUTO_HOSPITAIS_TABLE)
    .select('*')
    .order('ordem', { ascending: true });

  if (linksError) {
    if (isMissingTableError(linksError, COTADOR_PRODUTO_HOSPITAIS_TABLE)) {
      return new Map<string, CotadorHospitalNetworkEntry[]>();
    }
    throw linksError;
  }

  const links = (linksData as CotadorProdutoHospital[] | null) ?? [];
  if (links.length === 0) {
    return new Map<string, CotadorHospitalNetworkEntry[]>();
  }

  const hospitalIds = Array.from(new Set(links.map((link) => link.hospital_id).filter(Boolean)));
  if (hospitalIds.length === 0) {
    return new Map<string, CotadorHospitalNetworkEntry[]>();
  }

  const { data: hospitalsData, error: hospitalsError } = await supabase
    .from(COTADOR_HOSPITAIS_TABLE)
    .select('*')
    .in('id', hospitalIds);

  if (hospitalsError) {
    if (isMissingTableError(hospitalsError, COTADOR_HOSPITAIS_TABLE)) {
      return new Map<string, CotadorHospitalNetworkEntry[]>();
    }
    throw hospitalsError;
  }

  const hospitalById = new Map(((hospitalsData as CotadorHospital[] | null) ?? []).map((hospital) => [hospital.id, hospital]));
  const networkByProduct = new Map<string, CotadorHospitalNetworkEntry[]>();

  links.forEach((link) => {
    const hospital = hospitalById.get(link.hospital_id);
    if (!hospital) return;

    const current = networkByProduct.get(link.produto_id) ?? [];
    current.push({
      hospital: hospital.nome,
      cidade: hospital.cidade,
      regiao: cleanOptionalText(hospital.regiao),
      bairro: cleanOptionalText(hospital.bairro),
      atendimentos: Array.isArray(link.atendimentos) ? link.atendimentos.map((item) => item.trim()).filter(Boolean) : [],
      observacoes: cleanOptionalText(link.observacoes),
    });
    networkByProduct.set(link.produto_id, current);
  });

  return new Map(
    Array.from(networkByProduct.entries()).map(([productId, entries]) => [productId, sanitizeHospitalNetwork(entries)]),
  );
}

async function syncHospitalAliases(hospitalId: string, aliases: string[]) {
  const normalizedAliases = sanitizeHospitalAliases(aliases);

  const { data: hospitalData, error: hospitalError } = await supabase
    .from(COTADOR_HOSPITAIS_TABLE)
    .select('nome')
    .eq('id', hospitalId)
    .single();

  if (hospitalError) {
    throw hospitalError;
  }

  const canonicalName = typeof hospitalData?.nome === 'string' ? hospitalData.nome.trim() : '';
  const aliasRows = Array.from(new Set([canonicalName, ...normalizedAliases].filter(Boolean))).map((aliasNome) => ({
    hospital_id: hospitalId,
    alias_nome: aliasNome,
  }));

  const { error: deleteError } = await supabase
    .from(COTADOR_HOSPITAL_ALIASES_TABLE)
    .delete()
    .eq('hospital_id', hospitalId);

  if (deleteError) {
    throw deleteError;
  }

  if (aliasRows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from(COTADOR_HOSPITAL_ALIASES_TABLE)
    .insert(aliasRows);

  if (insertError) {
    throw insertError;
  }
}

async function buildFallbackHospitalsFromProducts() {
  const products = await cotadorService.getProdutos();
  const grouped = new Map<string, CotadorHospitalManagerRecord>();

  products.forEach((product) => {
    sanitizeHospitalNetwork(product.rede_hospitalar).forEach((entry, index) => {
      const key = [normalizeText(entry.hospital), normalizeText(entry.cidade), normalizeText(entry.regiao), normalizeText(entry.bairro)].join('|');
      const current = grouped.get(key);
      const linkedProduct = {
        link_id: `${product.id}:${key}:${index}`,
        hospital_id: key,
        produto_id: product.id,
        produto_nome: product.nome,
        produto_acomodacao: cleanOptionalText(product.acomodacao),
        produto_abrangencia: cleanOptionalText(product.abrangencia),
        operadora: product.operadora ?? null,
        linha: product.linha ?? null,
        atendimentos: entry.atendimentos,
        observacoes: entry.observacoes,
        ordem: index,
      } satisfies CotadorHospitalLinkedProductRecord;

      if (current) {
        current.linkedProducts.push(linkedProduct);
        return;
      }

      grouped.set(key, {
        id: key,
        nome: entry.hospital,
        nome_normalizado: normalizeText(entry.hospital),
        cidade: entry.cidade,
        cidade_normalizada: normalizeText(entry.cidade),
        regiao: entry.regiao,
        regiao_normalizada: normalizeText(entry.regiao),
        bairro: entry.bairro,
        bairro_normalizado: normalizeText(entry.bairro),
        ativo: true,
        created_at: '',
        updated_at: '',
        aliases: [],
        linkedProducts: [linkedProduct],
      });
    });
  });

  return Array.from(grouped.values())
    .map((hospital) => ({
      ...hospital,
      linkedProducts: [...hospital.linkedProducts].sort(compareHospitalLinkedProducts),
    }))
    .sort(compareHospitals);
}

const sanitizePriceRows = (value: CotadorPriceRowInput): CotadorPriceByAgeRange =>
  COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    const candidate = value[range];
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      accumulator[range] = candidate;
    }
    return accumulator;
  }, {} as CotadorPriceByAgeRange);

const buildPriceMapFromRows = (rows: CotadorTabelaFaixaPreco[]) =>
  rows.reduce((accumulator, row) => {
    if (COTADOR_AGE_RANGES.includes(row.age_range as CotadorAgeRange)) {
      accumulator[row.age_range as CotadorAgeRange] = row.valor;
    }
    return accumulator;
  }, {} as CotadorPriceByAgeRange);

const buildActor = (id: string, name: string | null | undefined, active = true): CotadorCatalogActor => ({
  id,
  name: name ?? null,
  active,
});

const compareCatalogItems = (left: CotadorCatalogItem, right: CotadorCatalogItem) => {
  const operadoraComparison = (left.operadora.name ?? '').localeCompare(right.operadora.name ?? '', 'pt-BR');
  if (operadoraComparison !== 0) {
    return operadoraComparison;
  }

  const lineComparison = (left.linha?.name ?? '').localeCompare(right.linha?.name ?? '', 'pt-BR');
  if (lineComparison !== 0) {
    return lineComparison;
  }

  const titleComparison = left.titulo.localeCompare(right.titulo, 'pt-BR');
  if (titleComparison !== 0) {
    return titleComparison;
  }

  return (left.tabelaNome ?? '').localeCompare(right.tabelaNome ?? '', 'pt-BR');
};

const buildCatalogFingerprint = (
  item: Pick<CotadorCatalogItem, 'operadora' | 'linha' | 'titulo' | 'tabelaNome' | 'modalidade' | 'perfilEmpresarial' | 'coparticipacao' | 'acomodacao' | 'vidasMin' | 'vidasMax'>,
) => [
  item.operadora.id,
  item.linha?.id ?? '',
  normalizeText(item.titulo),
  normalizeText(item.tabelaNome),
  normalizeText(item.modalidade),
  normalizeText(item.perfilEmpresarial),
  normalizeText(item.coparticipacao),
  normalizeText(item.acomodacao),
  item.vidasMin ?? '',
  item.vidasMax ?? '',
].join('|');

const buildLineCatalogActor = (line: CotadorLinhaProduto | null | undefined) =>
  line ? buildActor(line.id, line.nome, line.ativo) : null;

const buildCotadorTableCatalogItem = (table: CotadorTableManagerRecord): CotadorCatalogItem => ({
  id: `cotador-tabela:${table.id}`,
  source: 'cotador_tabela',
  cotadorLinhaId: table.produto?.linha_id ?? null,
  cotadorTabelaId: table.id,
  cotadorProdutoId: table.produto_id,
  legacyProdutoPlanoId: table.produto?.legacy_produto_plano_id ?? null,
  linha: buildLineCatalogActor(table.produto?.linha),
  titulo: table.produto?.nome ?? table.nome,
  subtitulo: table.produto?.linha?.nome ?? table.produto?.modalidade ?? 'Tabela comercial',
  tabelaNome: table.nome,
  tabelaCodigo: cleanOptionalText(table.codigo),
  operadora: buildActor(
    table.produto?.operadora?.id ?? table.produto?.operadora_id ?? `operadora:${table.id}`,
    table.produto?.operadora?.nome ?? 'Operadora nao encontrada',
    table.produto?.operadora?.ativo ?? false,
  ),
  administradora: table.produto?.administradora
    ? buildActor(table.produto.administradora.id, table.produto.administradora.nome, table.produto.administradora.ativo)
    : null,
  entidadesClasse: (table.produto?.entidadesClasse ?? []).map((entity) => buildActor(entity.id, entity.nome, entity.ativo)),
  modalidade: table.modalidade,
  perfilEmpresarial: table.perfil_empresarial,
  coparticipacao: table.coparticipacao,
  vidasMin: table.vidas_min ?? null,
  vidasMax: table.vidas_max ?? null,
  pricesByAgeRange: table.pricesByAgeRange,
  estimatedMonthlyTotal: null,
  abrangencia: cleanOptionalText(table.produto?.abrangencia),
  acomodacao: cleanOptionalText(table.acomodacao) ?? cleanOptionalText(table.produto?.acomodacao),
  comissaoSugerida: toNullableNumber(table.produto?.comissao_sugerida),
  bonusPorVidaValor: toNullableNumber(table.produto?.bonus_por_vida_valor),
  carencias: cleanOptionalText(table.produto?.carencias),
  documentosNecessarios: cleanOptionalText(table.produto?.documentos_necessarios),
  reembolso: cleanOptionalText(table.produto?.reembolso),
  informacoesImportantes: cleanOptionalText(table.produto?.informacoes_importantes),
  redeHospitalar: sanitizeHospitalNetwork(table.produto?.rede_hospitalar),
  observacao: cleanOptionalText(table.observacoes) ?? cleanOptionalText(table.produto?.observacoes),
  ativo: Boolean(table.ativo && table.produto?.ativo && table.produto?.operadora?.ativo !== false && table.produto?.linha?.ativo !== false),
});

const buildCotadorProductCatalogItem = (product: CotadorProductManagerRecord): CotadorCatalogItem => ({
  id: `cotador-produto:${product.id}`,
  source: 'cotador_produto',
  cotadorLinhaId: product.linha_id ?? null,
  cotadorTabelaId: null,
  cotadorProdutoId: product.id,
  legacyProdutoPlanoId: product.legacy_produto_plano_id ?? null,
  linha: buildLineCatalogActor(product.linha),
  titulo: product.nome,
  subtitulo: cleanOptionalText(product.linha?.nome) ?? cleanOptionalText(product.modalidade) ?? 'Produto do Cotador',
  tabelaNome: null,
  tabelaCodigo: null,
  operadora: buildActor(
    product.operadora?.id ?? product.operadora_id,
    product.operadora?.nome ?? 'Operadora nao encontrada',
    product.operadora?.ativo ?? false,
  ),
  administradora: product.administradora
    ? buildActor(product.administradora.id, product.administradora.nome, product.administradora.ativo)
    : null,
  entidadesClasse: product.entidadesClasse.map((entity) => buildActor(entity.id, entity.nome, entity.ativo)),
  modalidade: cleanOptionalText(product.modalidade),
  perfilEmpresarial: null,
  coparticipacao: null,
  vidasMin: null,
  vidasMax: null,
  pricesByAgeRange: {},
  estimatedMonthlyTotal: null,
  abrangencia: cleanOptionalText(product.abrangencia),
  acomodacao: cleanOptionalText(product.acomodacao),
  comissaoSugerida: toNullableNumber(product.comissao_sugerida),
  bonusPorVidaValor: toNullableNumber(product.bonus_por_vida_valor),
  carencias: cleanOptionalText(product.carencias),
  documentosNecessarios: cleanOptionalText(product.documentos_necessarios),
  reembolso: cleanOptionalText(product.reembolso),
  informacoesImportantes: cleanOptionalText(product.informacoes_importantes),
  redeHospitalar: sanitizeHospitalNetwork(product.rede_hospitalar),
  observacao: cleanOptionalText(product.observacoes),
  ativo: Boolean(product.ativo && product.operadora?.ativo !== false && product.linha?.ativo !== false),
});

const buildLegacyCatalogItem = (produto: ProdutoPlano, operadora: Operadora | null): CotadorCatalogItem => ({
  id: `legacy-produto:${produto.id}`,
  source: 'legacy_produto',
  cotadorLinhaId: null,
  cotadorTabelaId: null,
  cotadorProdutoId: null,
  legacyProdutoPlanoId: produto.id,
  linha: null,
  titulo: produto.nome,
  subtitulo: cleanOptionalText(produto.modalidade) ?? 'Produto legado',
  tabelaNome: null,
  tabelaCodigo: null,
  operadora: buildActor(
    operadora?.id ?? produto.operadora_id,
    operadora?.nome ?? 'Operadora nao encontrada',
    operadora?.ativo ?? false,
  ),
  administradora: null,
  entidadesClasse: [],
  modalidade: cleanOptionalText(produto.modalidade),
  perfilEmpresarial: null,
  coparticipacao: null,
  vidasMin: null,
  vidasMax: null,
  pricesByAgeRange: {},
  estimatedMonthlyTotal: null,
  abrangencia: cleanOptionalText(produto.abrangencia),
  acomodacao: cleanOptionalText(produto.acomodacao),
  comissaoSugerida: toNullableNumber(produto.comissao_sugerida),
  bonusPorVidaValor: toNullableNumber(produto.bonus_por_vida_valor),
  carencias: null,
  documentosNecessarios: null,
  reembolso: null,
  informacoesImportantes: null,
  redeHospitalar: [],
  observacao: null,
  ativo: Boolean(produto.ativo && operadora?.ativo !== false),
});

const buildOperadoraFallbackItem = (operadora: Operadora): CotadorCatalogItem => ({
  id: `operadora:${operadora.id}`,
  source: 'operadora',
  cotadorLinhaId: null,
  cotadorTabelaId: null,
  cotadorProdutoId: null,
  legacyProdutoPlanoId: null,
  linha: null,
  titulo: operadora.nome,
  subtitulo: 'Carteira comercial ativa',
  tabelaNome: null,
  tabelaCodigo: null,
  operadora: buildActor(operadora.id, operadora.nome, operadora.ativo),
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
  comissaoSugerida: toNullableNumber(operadora.comissao_padrao),
  bonusPorVidaValor: toNullableNumber(operadora.bonus_padrao),
  carencias: null,
  documentosNecessarios: null,
  reembolso: null,
  informacoesImportantes: null,
  redeHospitalar: [],
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
    cotador_linha_id: item.cotadorLinhaId,
    cotador_tabela_id: item.cotadorTabelaId,
    cotador_produto_id: item.cotadorProdutoId,
    legacy_produto_plano_id: item.legacyProdutoPlanoId,
    operadora_id: item.operadora.id,
    administradora_id: item.administradora?.id ?? null,
    catalog_item_key: item.catalogItemKey,
    source: item.source,
    titulo_snapshot: item.titulo,
    subtitulo_snapshot: item.subtitulo,
    linha_nome_snapshot: item.linha?.name ?? null,
    tabela_nome_snapshot: item.tabelaNome,
    codigo_tabela_snapshot: item.tabelaCodigo,
    operadora_nome_snapshot: item.operadora.name ?? item.titulo,
    administradora_nome_snapshot: item.administradora?.name ?? null,
    entidade_nomes_snapshot: item.entidadesClasse.map((entity) => entity.name ?? '').filter(Boolean),
    modalidade_snapshot: item.modalidade,
    perfil_empresarial_snapshot: item.perfilEmpresarial,
    coparticipacao_snapshot: item.coparticipacao,
    vidas_min_snapshot: item.vidasMin,
    vidas_max_snapshot: item.vidasMax,
    precos_faixa_snapshot: item.pricesByAgeRange,
    mensalidade_total_snapshot: item.estimatedMonthlyTotal,
    abrangencia_snapshot: item.abrangencia,
    acomodacao_snapshot: item.acomodacao,
    comissao_sugerida_snapshot: item.comissaoSugerida,
    bonus_por_vida_valor_snapshot: item.bonusPorVidaValor,
    carencias_snapshot: item.carencias,
    documentos_necessarios_snapshot: item.documentosNecessarios,
    reembolso_snapshot: item.reembolso,
    informacoes_importantes_snapshot: item.informacoesImportantes,
    rede_hospitalar_snapshot: item.redeHospitalar,
    observacoes_snapshot: item.observacao,
    ordem: index,
  }));

const buildQuoteItemFromRow = (row: CotadorQuoteItemRecord): CotadorQuoteItem => ({
  id: row.id,
  catalogItemKey: row.catalog_item_key,
  source: row.source,
  cotadorLinhaId: row.cotador_linha_id ?? null,
  cotadorTabelaId: row.cotador_tabela_id ?? null,
  cotadorProdutoId: row.cotador_produto_id ?? null,
  legacyProdutoPlanoId: row.legacy_produto_plano_id ?? null,
  linha: row.linha_nome_snapshot
    ? buildActor(row.cotador_linha_id ?? `linha:${row.id}`, row.linha_nome_snapshot, true)
    : null,
  titulo: row.titulo_snapshot,
  subtitulo: row.subtitulo_snapshot ?? null,
  tabelaNome: row.tabela_nome_snapshot ?? null,
  tabelaCodigo: row.codigo_tabela_snapshot ?? null,
  operadora: buildActor(row.operadora_id ?? `operadora:${row.id}`, row.operadora_nome_snapshot, true),
  administradora: row.administradora_nome_snapshot
    ? buildActor(row.administradora_id ?? `administradora:${row.id}`, row.administradora_nome_snapshot, true)
    : null,
  entidadesClasse: (Array.isArray(row.entidade_nomes_snapshot) ? row.entidade_nomes_snapshot : []).map((name, index) =>
    buildActor(`entidade:${row.id}:${index}`, name, true),
  ),
  modalidade: row.modalidade_snapshot ?? null,
  perfilEmpresarial:
    row.perfil_empresarial_snapshot === 'mei'
    || row.perfil_empresarial_snapshot === 'nao_mei'
    || row.perfil_empresarial_snapshot === 'todos'
      ? row.perfil_empresarial_snapshot
      : null,
  coparticipacao:
    row.coparticipacao_snapshot === 'sem'
    || row.coparticipacao_snapshot === 'parcial'
    || row.coparticipacao_snapshot === 'total'
      ? row.coparticipacao_snapshot
      : null,
  vidasMin: typeof row.vidas_min_snapshot === 'number' ? row.vidas_min_snapshot : null,
  vidasMax: typeof row.vidas_max_snapshot === 'number' ? row.vidas_max_snapshot : null,
  pricesByAgeRange:
    row.precos_faixa_snapshot && typeof row.precos_faixa_snapshot === 'object'
      ? (row.precos_faixa_snapshot as CotadorPriceByAgeRange)
      : {},
  estimatedMonthlyTotal: toNullableNumber(row.mensalidade_total_snapshot),
  abrangencia: row.abrangencia_snapshot ?? null,
  acomodacao: row.acomodacao_snapshot ?? null,
  comissaoSugerida: toNullableNumber(row.comissao_sugerida_snapshot),
  bonusPorVidaValor: toNullableNumber(row.bonus_por_vida_valor_snapshot),
  carencias: row.carencias_snapshot ?? null,
  documentosNecessarios: row.documentos_necessarios_snapshot ?? null,
  reembolso: row.reembolso_snapshot ?? null,
  informacoesImportantes: row.informacoes_importantes_snapshot ?? null,
  redeHospitalar: sanitizeHospitalNetwork(row.rede_hospitalar_snapshot),
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

async function syncTablePrices(tableId: string, pricesByAgeRange: CotadorPriceRowInput) {
  const { error: deleteError } = await supabase
    .from(COTADOR_TABELA_PRECOS_TABLE)
    .delete()
    .eq('tabela_id', tableId);

  if (deleteError) {
    throw deleteError;
  }

  const priceMap = sanitizePriceRows(pricesByAgeRange);
  const rows = Object.entries(priceMap).map(([age_range, valor]) => ({
    tabela_id: tableId,
    age_range,
    valor,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from(COTADOR_TABELA_PRECOS_TABLE)
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

  async createAdministradora(payload: CatalogManagerPayload) {
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

  async updateAdministradora(id: string, payload: CatalogManagerPayload) {
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

  async deleteAdministradora(id: string) {
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

  async createEntidadeClasse(payload: CatalogManagerPayload) {
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

  async updateEntidadeClasse(id: string, payload: CatalogManagerPayload) {
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

  async deleteEntidadeClasse(id: string) {
    try {
      const { error } = await supabase.from(COTADOR_ENTIDADES_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting cotador entidade:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getLinhas(): Promise<CotadorLineManagerRecord[]> {
    try {
      const [{ data: linesData, error: linesError }, operadoras] = await Promise.all([
        supabase
          .from(COTADOR_LINHAS_TABLE)
          .select('*')
          .order('nome', { ascending: true }),
        configService.getOperadoras(),
      ]);

      if (linesError) {
        if (isMissingTableError(linesError, COTADOR_LINHAS_TABLE)) {
          return [];
        }
        throw linesError;
      }

      const operadoraById = new Map(operadoras.map((operadora) => [operadora.id, operadora]));
      return ((linesData as CotadorLinhaProduto[] | null) ?? []).map((line) => ({
        ...line,
        operadora: operadoraById.get(line.operadora_id) ?? null,
      }));
    } catch (error) {
      console.error('Error loading cotador lines:', error);
      return [];
    }
  },

  async createLinha(payload: { operadora_id: string } & CatalogManagerPayload) {
    try {
      const { data, error } = await supabase
        .from(COTADOR_LINHAS_TABLE)
        .insert([{
          operadora_id: payload.operadora_id,
          nome: payload.nome.trim(),
          ativo: payload.ativo,
          observacoes: cleanOptionalText(payload.observacoes),
        }])
        .select()
        .single();

      return { data: (data as CotadorLinhaProduto) ?? null, error };
    } catch (error) {
      console.error('Error creating cotador line:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateLinha(id: string, payload: { operadora_id: string } & CatalogManagerPayload) {
    try {
      const { error } = await supabase
        .from(COTADOR_LINHAS_TABLE)
        .update({
          operadora_id: payload.operadora_id,
          nome: payload.nome.trim(),
          ativo: payload.ativo,
          observacoes: cleanOptionalText(payload.observacoes),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating cotador line:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async deleteLinha(id: string) {
    try {
      const { error } = await supabase.from(COTADOR_LINHAS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting cotador line:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getProdutos(): Promise<CotadorProductManagerRecord[]> {
    try {
      const [{ data: productsData, error: productsError }, operadoras, lines, administradoras, entidades, linksData, normalizedNetworkByProduct] = await Promise.all([
        supabase
          .from(COTADOR_PRODUTOS_TABLE)
          .select('*')
          .order('nome', { ascending: true }),
        configService.getOperadoras(),
        cotadorService.getLinhas(),
        cotadorService.getAdministradoras(),
        cotadorService.getEntidadesClasse(),
        supabase
          .from(COTADOR_PRODUTO_ENTIDADES_TABLE)
          .select('*'),
        loadNormalizedProductNetworkMap(),
      ]);

      if (productsError) {
        if (isMissingTableError(productsError, COTADOR_PRODUTOS_TABLE)) {
          return [];
        }
        throw productsError;
      }

      const linksError = linksData.error;
      if (linksError && !isMissingTableError(linksError, COTADOR_PRODUTO_ENTIDADES_TABLE)) {
        throw linksError;
      }

      const products = (productsData as CotadorProduto[] | null) ?? [];
      const entityLinks = ((linksData.data as CotadorProdutoEntidade[] | null) ?? []);
      const operadoraById = new Map(operadoras.map((operadora) => [operadora.id, operadora]));
      const lineById = new Map(lines.map((line) => [line.id, line]));
      const administradoraById = new Map(administradoras.map((administradora) => [administradora.id, administradora]));
      const entidadeById = new Map(entidades.map((entity) => [entity.id, entity]));
      const entityIdsByProduct = new Map<string, string[]>();

      entityLinks.forEach((link) => {
        const current = entityIdsByProduct.get(link.produto_id) ?? [];
        current.push(link.entidade_id);
        entityIdsByProduct.set(link.produto_id, current);
      });

      return products.map((product) => ({
        ...product,
        rede_hospitalar: normalizedNetworkByProduct.get(product.id) ?? sanitizeHospitalNetwork(product.rede_hospitalar),
        operadora: operadoraById.get(product.operadora_id) ?? null,
        linha: product.linha_id ? lineById.get(product.linha_id) ?? null : null,
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

  async createProduto(input: CotadorProductManagerInput) {
    try {
      const { data, error } = await supabase
        .from(COTADOR_PRODUTOS_TABLE)
        .insert([{
          operadora_id: input.operadora_id,
          linha_id: input.linha_id,
          administradora_id: input.administradora_id ?? null,
          nome: input.nome.trim(),
          modalidade: cleanOptionalText(input.modalidade),
          abrangencia: cleanOptionalText(input.abrangencia),
          acomodacao: cleanOptionalText(input.acomodacao),
          comissao_sugerida: input.comissao_sugerida ?? null,
          bonus_por_vida_valor: input.bonus_por_vida_valor ?? null,
          carencias: cleanOptionalText(input.carencias),
          documentos_necessarios: cleanOptionalText(input.documentos_necessarios),
          reembolso: cleanOptionalText(input.reembolso),
          informacoes_importantes: cleanOptionalText(input.informacoes_importantes),
          rede_hospitalar: input.rede_hospitalar ?? [],
          observacoes: cleanOptionalText(input.observacoes),
          ativo: input.ativo,
        }])
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      const createdProduct = (data as CotadorProduto) ?? null;

      try {
        await syncProductEntities(createdProduct.id, input.entidadeIds);
        return { data: createdProduct, error: null };
      } catch (syncError) {
        const { error: rollbackError } = await supabase.from(COTADOR_PRODUTOS_TABLE).delete().eq('id', createdProduct.id);
        if (rollbackError) {
          console.error('Error rolling back cotador product after entity sync failure:', rollbackError);
        }
        return { data: null, error: toPostgrestError(syncError) };
      }
    } catch (error) {
      console.error('Error creating cotador product:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateProduto(id: string, input: CotadorProductManagerInput) {
    try {
      const [{ data: previousProduct, error: previousProductError }, { data: previousEntityLinks, error: previousEntityLinksError }] = await Promise.all([
        supabase
          .from(COTADOR_PRODUTOS_TABLE)
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from(COTADOR_PRODUTO_ENTIDADES_TABLE)
          .select('*')
          .eq('produto_id', id),
      ]);

      if (previousProductError) {
        return { error: previousProductError };
      }

      if (previousEntityLinksError && !isMissingTableError(previousEntityLinksError, COTADOR_PRODUTO_ENTIDADES_TABLE)) {
        return { error: previousEntityLinksError };
      }

      const previousProductRow = previousProduct as CotadorProduto;
      const previousEntityIds = ((previousEntityLinks as CotadorProdutoEntidade[] | null) ?? []).map((link) => link.entidade_id);

      const { error } = await supabase
        .from(COTADOR_PRODUTOS_TABLE)
        .update({
          operadora_id: input.operadora_id,
          linha_id: input.linha_id,
          administradora_id: input.administradora_id ?? null,
          nome: input.nome.trim(),
          modalidade: cleanOptionalText(input.modalidade),
          abrangencia: cleanOptionalText(input.abrangencia),
          acomodacao: cleanOptionalText(input.acomodacao),
          comissao_sugerida: input.comissao_sugerida ?? null,
          bonus_por_vida_valor: input.bonus_por_vida_valor ?? null,
          carencias: cleanOptionalText(input.carencias),
          documentos_necessarios: cleanOptionalText(input.documentos_necessarios),
          reembolso: cleanOptionalText(input.reembolso),
          informacoes_importantes: cleanOptionalText(input.informacoes_importantes),
          ...(input.rede_hospitalar !== undefined ? { rede_hospitalar: input.rede_hospitalar } : {}),
          observacoes: cleanOptionalText(input.observacoes),
          ativo: input.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return { error };
      }

      try {
        await syncProductEntities(id, input.entidadeIds);
        return { error: null };
      } catch (syncError) {
        const { error: rollbackError } = await supabase
          .from(COTADOR_PRODUTOS_TABLE)
          .update({
            operadora_id: previousProductRow.operadora_id,
            linha_id: previousProductRow.linha_id,
            administradora_id: previousProductRow.administradora_id ?? null,
            nome: previousProductRow.nome,
            modalidade: cleanOptionalText(previousProductRow.modalidade),
            abrangencia: cleanOptionalText(previousProductRow.abrangencia),
            acomodacao: cleanOptionalText(previousProductRow.acomodacao),
            comissao_sugerida: previousProductRow.comissao_sugerida ?? null,
            bonus_por_vida_valor: previousProductRow.bonus_por_vida_valor ?? null,
            carencias: cleanOptionalText(previousProductRow.carencias),
            documentos_necessarios: cleanOptionalText(previousProductRow.documentos_necessarios),
            reembolso: cleanOptionalText(previousProductRow.reembolso),
            informacoes_importantes: cleanOptionalText(previousProductRow.informacoes_importantes),
            rede_hospitalar: previousProductRow.rede_hospitalar ?? [],
            observacoes: cleanOptionalText(previousProductRow.observacoes),
            ativo: previousProductRow.ativo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (rollbackError) {
          console.error('Error rolling back cotador product update:', rollbackError);
          return { error: toPostgrestError(syncError) };
        }

        try {
          await syncProductEntities(id, previousEntityIds);
        } catch (restoreError) {
          console.error('Error restoring cotador product entities after rollback:', restoreError);
        }

        return { error: toPostgrestError(syncError) };
      }
    } catch (error) {
      console.error('Error updating cotador product:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async updateProdutoRedeHospitalar(id: string, redeHospitalar: CotadorHospitalNetworkEntry[]) {
    try {
      const sanitizedNetwork = sanitizeHospitalNetwork(redeHospitalar);
      const { error } = await supabase.rpc('replace_cotador_produto_rede_hospitalar', {
        p_produto_id: id,
        p_entries: sanitizedNetwork,
      });

      if (error) {
        if (isMissingRpcError(error, 'replace_cotador_produto_rede_hospitalar')) {
          const fallback = await supabase
            .from(COTADOR_PRODUTOS_TABLE)
            .update({
              rede_hospitalar: sanitizedNetwork,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);

          return { error: fallback.error };
        }

        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error updating cotador product network:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getProdutoRedeHospitalarDetalhada(produtoId: string): Promise<CotadorProductNetworkManagerRecord[]> {
    try {
      const { data: linksData, error: linksError } = await supabase
        .from(COTADOR_PRODUTO_HOSPITAIS_TABLE)
        .select('*')
        .eq('produto_id', produtoId)
        .order('ordem', { ascending: true });

      if (linksError) {
        if (isMissingTableError(linksError, COTADOR_PRODUTO_HOSPITAIS_TABLE)) {
          return [];
        }
        throw linksError;
      }

      const links = (linksData as CotadorProdutoHospital[] | null) ?? [];
      if (links.length === 0) {
        return [];
      }

      const hospitalIds = Array.from(new Set(links.map((link) => link.hospital_id).filter(Boolean)));
      const [{ data: hospitalsData, error: hospitalsError }, { data: aliasesData, error: aliasesError }] = await Promise.all([
        supabase
          .from(COTADOR_HOSPITAIS_TABLE)
          .select('*')
          .in('id', hospitalIds),
        supabase
          .from(COTADOR_HOSPITAL_ALIASES_TABLE)
          .select('*')
          .in('hospital_id', hospitalIds),
      ]);

      if (hospitalsError) {
        throw hospitalsError;
      }

      if (aliasesError && !isMissingTableError(aliasesError, COTADOR_HOSPITAL_ALIASES_TABLE)) {
        throw aliasesError;
      }

      const hospitalById = new Map(((hospitalsData as CotadorHospital[] | null) ?? []).map((hospital) => [hospital.id, hospital]));
      const aliasesByHospitalId = new Map<string, CotadorHospitalAlias[]>();

      ((aliasesData as CotadorHospitalAlias[] | null) ?? []).forEach((alias) => {
        const current = aliasesByHospitalId.get(alias.hospital_id) ?? [];
        current.push(alias);
        aliasesByHospitalId.set(alias.hospital_id, current);
      });

      return links.reduce<CotadorProductNetworkManagerRecord[]>((accumulator, link) => {
        const hospital = hospitalById.get(link.hospital_id);
        if (!hospital) return accumulator;
        accumulator.push(buildNormalizedProductNetworkEntry(hospital, link, aliasesByHospitalId.get(link.hospital_id) ?? []));
        return accumulator;
      }, []);
    } catch (error) {
      console.error('Error loading detailed cotador product network:', error);
      return [];
    }
  },

  async replaceProdutoRedeHospitalarDetalhada(produtoId: string, redeHospitalar: CotadorProductNetworkManagerInput[]) {
    try {
      const payload = redeHospitalar
        .map((entry) => {
          const sanitizedBase = sanitizeHospitalNetwork([entry])[0] ?? null;
          if (!sanitizedBase) return null;

          return {
            hospitalId: entry.hospitalId ?? null,
            linkId: entry.linkId ?? null,
            hospital: sanitizedBase.hospital,
            cidade: sanitizedBase.cidade,
            regiao: sanitizedBase.regiao,
            bairro: sanitizedBase.bairro,
            atendimentos: sanitizedBase.atendimentos,
            observacoes: sanitizedBase.observacoes,
            aliases: sanitizeHospitalAliases(entry.aliases),
          };
        })
        .filter((entry): entry is {
          hospitalId: string | null;
          linkId: string | null;
          hospital: string;
          cidade: string;
          regiao: string | null;
          bairro: string | null;
          atendimentos: string[];
          observacoes: string | null;
          aliases: string[];
        } => entry !== null);

      const { error } = await supabase.rpc('replace_cotador_produto_rede_hospitalar', {
        p_produto_id: produtoId,
        p_entries: payload,
      });

      if (error) {
        if (isMissingRpcError(error, 'replace_cotador_produto_rede_hospitalar')) {
          return cotadorService.updateProdutoRedeHospitalar(produtoId, payload);
        }

        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error replacing detailed cotador product network:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getHospitaisRedeDetalhados(): Promise<CotadorHospitalManagerRecord[]> {
    try {
      const [{ data: hospitalsData, error: hospitalsError }, { data: aliasesData, error: aliasesError }, { data: linksData, error: linksError }, products] = await Promise.all([
        supabase
          .from(COTADOR_HOSPITAIS_TABLE)
          .select('*')
          .order('cidade_normalizada', { ascending: true })
          .order('regiao_normalizada', { ascending: true })
          .order('nome_normalizado', { ascending: true }),
        supabase
          .from(COTADOR_HOSPITAL_ALIASES_TABLE)
          .select('*'),
        supabase
          .from(COTADOR_PRODUTO_HOSPITAIS_TABLE)
          .select('*')
          .order('ordem', { ascending: true }),
        cotadorService.getProdutos(),
      ]);

      if (hospitalsError) {
        if (isMissingTableError(hospitalsError, COTADOR_HOSPITAIS_TABLE)) {
          return buildFallbackHospitalsFromProducts();
        }
        throw hospitalsError;
      }

      if (aliasesError && !isMissingTableError(aliasesError, COTADOR_HOSPITAL_ALIASES_TABLE)) {
        throw aliasesError;
      }

      if (linksError && !isMissingTableError(linksError, COTADOR_PRODUTO_HOSPITAIS_TABLE)) {
        throw linksError;
      }

      const hospitals = (hospitalsData as CotadorHospital[] | null) ?? [];
      const aliases = (aliasesData as CotadorHospitalAlias[] | null) ?? [];
      const links = (linksData as CotadorProdutoHospital[] | null) ?? [];
      const productById = new Map(products.map((product) => [product.id, product]));
      const aliasesByHospitalId = new Map<string, CotadorHospitalAlias[]>();
      const linksByHospitalId = new Map<string, CotadorProdutoHospital[]>();

      aliases.forEach((alias) => {
        const current = aliasesByHospitalId.get(alias.hospital_id) ?? [];
        current.push(alias);
        aliasesByHospitalId.set(alias.hospital_id, current);
      });

      links.forEach((link) => {
        const current = linksByHospitalId.get(link.hospital_id) ?? [];
        current.push(link);
        linksByHospitalId.set(link.hospital_id, current);
      });

      return hospitals
        .map<CotadorHospitalManagerRecord>((hospital) => ({
          ...hospital,
          aliases: sanitizeHospitalAliases((aliasesByHospitalId.get(hospital.id) ?? []).map((alias) => alias.alias_nome).filter((name) => normalizeText(name) !== normalizeText(hospital.nome))),
          linkedProducts: (linksByHospitalId.get(hospital.id) ?? [])
            .map((link) => buildHospitalLinkedProductRecord(link, productById.get(link.produto_id) ?? null))
            .sort(compareHospitalLinkedProducts),
        }))
        .sort(compareHospitals);
    } catch (error) {
      console.error('Error loading cotador hospitals network:', error);
      return buildFallbackHospitalsFromProducts();
    }
  },

  async updateHospitalRede(id: string, input: CotadorHospitalManagerInput) {
    try {
      const payload = {
        nome: input.nome.trim(),
        cidade: input.cidade.trim(),
        regiao: cleanOptionalText(input.regiao),
        bairro: cleanOptionalText(input.bairro),
        ativo: input.ativo,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(COTADOR_HOSPITAIS_TABLE)
        .update(payload)
        .eq('id', id);

      if (error) {
        return { error };
      }

      await syncHospitalAliases(id, input.aliases);
      return { error: null };
    } catch (error) {
      console.error('Error updating cotador hospital network:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async deleteProduto(id: string) {
    try {
      const { error } = await supabase.from(COTADOR_PRODUTOS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting cotador product:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getTabelas(): Promise<CotadorTableManagerRecord[]> {
    try {
      const [{ data: tablesData, error: tablesError }, { data: priceData, error: priceError }, products] = await Promise.all([
        supabase
          .from(COTADOR_TABELAS_TABLE)
          .select('*')
          .order('nome', { ascending: true }),
        supabase
          .from(COTADOR_TABELA_PRECOS_TABLE)
          .select('*'),
        cotadorService.getProdutos(),
      ]);

      if (tablesError) {
        if (isMissingTableError(tablesError, COTADOR_TABELAS_TABLE)) {
          return [];
        }
        throw tablesError;
      }

      if (priceError && !isMissingTableError(priceError, COTADOR_TABELA_PRECOS_TABLE)) {
        throw priceError;
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      const priceRows = (priceData as CotadorTabelaFaixaPreco[] | null) ?? [];

      return ((tablesData as CotadorTabela[] | null) ?? []).map((table) => ({
        ...table,
        produto: productById.get(table.produto_id) ?? null,
        pricesByAgeRange: buildPriceMapFromRows(priceRows.filter((row) => row.tabela_id === table.id)),
      }));
    } catch (error) {
      console.error('Error loading cotador tables:', error);
      return [];
    }
  },

  async createTabela(input: CotadorTableManagerInput) {
    try {
      const { data, error } = await supabase
        .from(COTADOR_TABELAS_TABLE)
        .insert([{
          produto_id: input.produto_id,
          nome: input.nome.trim(),
          codigo: cleanOptionalText(input.codigo),
          modalidade: input.modalidade,
          perfil_empresarial: input.perfil_empresarial,
          coparticipacao: input.coparticipacao,
          acomodacao: cleanOptionalText(input.acomodacao),
          vidas_min: input.vidas_min ?? null,
          vidas_max: input.vidas_max ?? null,
          observacoes: cleanOptionalText(input.observacoes),
          ativo: input.ativo,
        }])
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      const createdTable = (data as CotadorTabela) ?? null;

      try {
        await syncTablePrices(createdTable.id, input.pricesByAgeRange);
        return { data: createdTable, error: null };
      } catch (syncError) {
        const { error: rollbackError } = await supabase.from(COTADOR_TABELAS_TABLE).delete().eq('id', createdTable.id);
        if (rollbackError) {
          console.error('Error rolling back cotador table after price sync failure:', rollbackError);
        }
        return { data: null, error: toPostgrestError(syncError) };
      }
    } catch (error) {
      console.error('Error creating cotador table:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateTabela(id: string, input: CotadorTableManagerInput) {
    try {
      const [{ data: previousTable, error: previousTableError }, { data: previousPriceRows, error: previousPriceRowsError }] = await Promise.all([
        supabase
          .from(COTADOR_TABELAS_TABLE)
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from(COTADOR_TABELA_PRECOS_TABLE)
          .select('*')
          .eq('tabela_id', id),
      ]);

      if (previousTableError) {
        return { error: previousTableError };
      }

      if (previousPriceRowsError && !isMissingTableError(previousPriceRowsError, COTADOR_TABELA_PRECOS_TABLE)) {
        return { error: previousPriceRowsError };
      }

      const previousTableRow = previousTable as CotadorTabela;
      const previousPrices = buildPriceMapFromRows((previousPriceRows as CotadorTabelaFaixaPreco[] | null) ?? []);

      const { error } = await supabase
        .from(COTADOR_TABELAS_TABLE)
        .update({
          produto_id: input.produto_id,
          nome: input.nome.trim(),
          codigo: cleanOptionalText(input.codigo),
          modalidade: input.modalidade,
          perfil_empresarial: input.perfil_empresarial,
          coparticipacao: input.coparticipacao,
          acomodacao: cleanOptionalText(input.acomodacao),
          vidas_min: input.vidas_min ?? null,
          vidas_max: input.vidas_max ?? null,
          observacoes: cleanOptionalText(input.observacoes),
          ativo: input.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return { error };
      }

      try {
        await syncTablePrices(id, input.pricesByAgeRange);
        return { error: null };
      } catch (syncError) {
        const { error: rollbackError } = await supabase
          .from(COTADOR_TABELAS_TABLE)
          .update({
            produto_id: previousTableRow.produto_id,
            nome: previousTableRow.nome,
            codigo: cleanOptionalText(previousTableRow.codigo),
            modalidade: previousTableRow.modalidade,
            perfil_empresarial: previousTableRow.perfil_empresarial,
            coparticipacao: previousTableRow.coparticipacao,
            acomodacao: cleanOptionalText(previousTableRow.acomodacao),
            vidas_min: previousTableRow.vidas_min ?? null,
            vidas_max: previousTableRow.vidas_max ?? null,
            observacoes: cleanOptionalText(previousTableRow.observacoes),
            ativo: previousTableRow.ativo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (rollbackError) {
          console.error('Error rolling back cotador table update:', rollbackError);
          return { error: toPostgrestError(syncError) };
        }

        try {
          await syncTablePrices(id, previousPrices);
        } catch (restoreError) {
          console.error('Error restoring cotador table prices after rollback:', restoreError);
        }

        return { error: toPostgrestError(syncError) };
      }
    } catch (error) {
      console.error('Error updating cotador table:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async deleteTabela(id: string) {
    try {
      const { error } = await supabase.from(COTADOR_TABELAS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting cotador table:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async loadCatalog(): Promise<CotadorCatalogItem[]> {
    const [operadoras, legacyProdutos, products, tables] = await Promise.all([
      configService.getOperadoras(),
      configService.getProdutosPlanos(),
      cotadorService.getProdutos(),
      cotadorService.getTabelas(),
    ]);

    const operadoraById = new Map(operadoras.map((operadora) => [operadora.id, operadora]));
    const normalizedTableItems = tables
      .map(buildCotadorTableCatalogItem)
      .filter((item) => item.ativo);
    const fingerprints = new Set(normalizedTableItems.map(buildCatalogFingerprint));
    const productsWithActiveTables = new Set(
      tables.filter((table) => table.ativo).map((table) => table.produto_id),
    );

    const normalizedProductItems = products
      .filter((product) => product.ativo && !productsWithActiveTables.has(product.id))
      .map(buildCotadorProductCatalogItem)
      .filter((item) => item.ativo)
      .filter((item) => {
        const fingerprint = buildCatalogFingerprint(item);
        if (fingerprints.has(fingerprint)) {
          return false;
        }
        fingerprints.add(fingerprint);
        return true;
      });

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

    const coveredOperadoraIds = new Set([...normalizedTableItems, ...normalizedProductItems, ...legacyItems].map((item) => item.operadora.id));
    const fallbackItems = operadoras
      .filter((operadora) => operadora.ativo && !coveredOperadoraIds.has(operadora.id))
      .map(buildOperadoraFallbackItem);

    return [...normalizedTableItems, ...normalizedProductItems, ...legacyItems, ...fallbackItems].sort(compareCatalogItems);
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

  async createQuote(input: CotadorQuoteInput) {
    try {
      const ageDistribution = sanitizeCotadorAgeDistribution(input.ageDistribution);
      const totalLives = getCotadorTotalLives(ageDistribution);
      const { data, error } = await supabase
        .from(COTADOR_QUOTES_TABLE)
        .insert([{
          nome: input.name.trim(),
          modalidade: input.modality,
          lead_id: input.leadId ?? null,
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
          leadId: quoteRecord.lead_id ?? null,
          ageDistribution,
          totalLives,
          selectedItems: [],
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

  async updateQuote(quote: CotadorQuote, input: CotadorQuoteInput) {
    try {
      const ageDistribution = sanitizeCotadorAgeDistribution(input.ageDistribution);
      const totalLives = getCotadorTotalLives(ageDistribution);
      const { error } = await supabase
        .from(COTADOR_QUOTES_TABLE)
        .update({
          nome: input.name.trim(),
          modalidade: input.modality,
          lead_id: input.leadId ?? null,
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
          leadId: input.leadId ?? null,
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

  async saveQuoteSelection(quoteId: string, items: CotadorQuoteItem[]) {
    try {
      const { error: deleteError } = await supabase
        .from(COTADOR_QUOTE_ITEMS_TABLE)
        .delete()
        .eq('quote_id', quoteId);

      if (deleteError) {
        return { error: deleteError };
      }

      if (items.length > 0) {
        const { error: insertError } = await supabase
          .from(COTADOR_QUOTE_ITEMS_TABLE)
          .insert(buildQuoteItemsRows(quoteId, items));

        if (insertError) {
          return { error: insertError };
        }
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
